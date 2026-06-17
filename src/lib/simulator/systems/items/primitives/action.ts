/**
 * Action Executor
 *
 * Trigger/Counter/Timer에서 발동된 Action primitive를 실제 실행한다.
 * 결정론 보장: rng는 주입된 SeededRNG만 사용, Math.random() 직접 호출 금지.
 *
 * 설계: item-effect-engine §4.5
 */

import type { CombatUnit, StatusEffect } from '@/types';
import { hexDistance } from '@/types';
import type { SeededRNG } from '@/lib/simulator/engine/rng';
import type { EventBus } from '@/lib/simulator/events/eventBus';
import type {
  Action,
  DamageAmount,
  DamageType,
  HealAmount,
  TargetSelector,
  StatKey,
  TriggerContext,
} from './types';

/**
 * Action 실행 시점에 필요한 외부 의존성.
 * Runtime이 combatLoop로부터 받아 보관하다가 주입한다.
 *
 * - allUnits: 타게팅을 위해 mutable reference (Galio 소환 등으로 증가 가능)
 * - applyDamage: 저항/쉴드/HP 감소/피해 이벤트까지 포함한 고수준 헬퍼
 */
export interface ActionDeps {
  allUnits: CombatUnit[];
  rng: SeededRNG;
  eventBus: EventBus;
  applyDamage: (
    target: CombatUnit,
    amount: number,
    type: DamageType,
    source: CombatUnit,
    tick: number,
  ) => number;
}

export interface ActionContext extends TriggerContext {
  deps: ActionDeps;
}

/** 최상위 실행 엔트리. chain/branch 재귀 포함. */
export function executeAction(action: Action, ctx: ActionContext): void {
  switch (action.kind) {
    case 'dealDamage':
      execDealDamage(action, ctx);
      return;
    case 'heal':
      execHeal(action, ctx);
      return;
    case 'modifyStat':
      execModifyStat(action, ctx);
      return;
    case 'applyDebuff':
      execApplyDebuff(action, ctx);
      return;
    case 'addStack':
      execAddStack(action, ctx);
      return;
    case 'setStack': {
      const v = action.value === 'tick' ? ctx.tick : action.value;
      ctx.state.stacks.set(resolveStackKey(action.stack, ctx), v);
      return;
    }
    case 'chain':
      for (const a of action.actions) executeAction(a, ctx);
      return;
    case 'branch':
      if (action.condition(ctx)) executeAction(action.then, ctx);
      else if (action.else) executeAction(action.else, ctx);
      return;
  }
}

/* ──────────────── Target Resolution ──────────────── */

export function resolveTargets(selector: TargetSelector, ctx: ActionContext): CombatUnit[] {
  const { unit, deps } = ctx;
  const enemies = deps.allUnits.filter(u => u.team !== unit.team && u.state !== 'dead');
  switch (selector) {
    case 'self':
      return [unit];
    case 'attackTarget': {
      if (!unit.target) return [];
      const t = deps.allUnits.find(u => u.id === unit.target);
      return t && t.state !== 'dead' ? [t] : [];
    }
    case 'nearestEnemy': {
      if (enemies.length === 0) return [];
      let nearest = enemies[0];
      let minDist = hexDistance(unit.position, nearest.position);
      for (let i = 1; i < enemies.length; i++) {
        const d = hexDistance(unit.position, enemies[i].position);
        if (d < minDist) {
          minDist = d;
          nearest = enemies[i];
        }
      }
      return [nearest];
    }
    case 'randomEnemy': {
      if (enemies.length === 0) return [];
      const idx = Math.floor(deps.rng.next() * enemies.length);
      return [enemies[idx]];
    }
    case 'allEnemies':
      return enemies;
    case 'adjacentEnemies':
      return enemies.filter(e => hexDistance(unit.position, e.position) <= 1);
  }
}

/* ──────────────── Damage Amount Resolution ──────────────── */

function resolveDamageAmount(amount: DamageAmount, ctx: ActionContext, target: CombatUnit): number {
  switch (amount.mode) {
    case 'flat':
      return amount.value;
    case 'pctMaxHp':
      return target.maxHp * amount.pct;
    case 'pctAttackDamage':
      return ctx.unit.stats.damage * amount.pct;
    case 'pctAbilityPower':
      return ctx.unit.stats.ap * amount.pct;
    case 'pctDealt':
      return (ctx.payload?.value ?? 0) * amount.pct;
    case 'pctDealtRaw':
      return (ctx.payload?.rawValue ?? ctx.payload?.value ?? 0) * amount.pct;
    case 'pctOfStack':
      return (ctx.state.stacks.get(amount.stack) ?? 0) * amount.pct;
  }
}

/* ──────────────── Action Implementations ──────────────── */

function execDealDamage(
  action: Extract<Action, { kind: 'dealDamage' }>,
  ctx: ActionContext,
): void {
  const targets = resolveTargets(action.target, ctx);
  for (const target of targets) {
    const amount = resolveDamageAmount(action.amount, ctx, target);
    if (amount <= 0) continue;
    ctx.deps.applyDamage(target, amount, action.type, ctx.unit, ctx.tick);
  }
}

function execHeal(
  action: Extract<Action, { kind: 'heal' }>,
  ctx: ActionContext,
): void {
  const targets = resolveTargets(action.target, ctx);
  for (const target of targets) {
    if (target.state === 'dead') continue;
    const baseAmount = resolveHealAmount(action.amount, target);
    if (baseAmount <= 0) continue;
    // healAmp (회복량 증폭, 예: GrenadeMod_Radiant IncreasedHealing 0.22) 적용.
    // 시전자 (ctx.unit) 기준이 아닌 대상 (target) 의 healAmp 사용 — heal 받는 unit
    // 효과로 정의 (예: 표적 고정 광학 Radiant healPct 등도 self-heal 이므로 동일).
    const amount = baseAmount * (1 + (target.healAmp ?? 0));
    target.currentHp = Math.min(target.maxHp, target.currentHp + amount);
  }
}

function resolveHealAmount(amount: HealAmount, target: CombatUnit): number {
  switch (amount.mode) {
    case 'flat':
      return amount.value;
    case 'pctMaxHp':
      return target.maxHp * amount.pct;
    case 'pctMissingHp':
      return (target.maxHp - target.currentHp) * amount.pct;
  }
}

function execModifyStat(
  action: Extract<Action, { kind: 'modifyStat' }>,
  ctx: ActionContext,
): void {
  // target 미지정: 자기 자신에게 적용 (기존 동작)
  if (!action.target) {
    applyStatDelta(ctx.unit, action.stat, action.delta);
    if (action.durationTicks !== undefined && action.durationTicks > 0) {
      if (!ctx.state.pendingBuffs) ctx.state.pendingBuffs = [];
      ctx.state.pendingBuffs.push({
        stat: action.stat,
        delta: action.delta,
        expireTick: ctx.tick + action.durationTicks,
        // target undefined → 자기
      });
    }
    return;
  }
  // target 지정: selector 로 찾은 대상(들)에게 적용 (악성코드 armor shred 등)
  const targets = resolveTargets(action.target, ctx);
  for (const target of targets) {
    applyStatDelta(target, action.stat, action.delta);
    if (action.durationTicks !== undefined && action.durationTicks > 0) {
      if (!ctx.state.pendingBuffs) ctx.state.pendingBuffs = [];
      ctx.state.pendingBuffs.push({
        stat: action.stat,
        delta: action.delta,
        expireTick: ctx.tick + action.durationTicks,
        targetId: target.id,
      });
    }
  }
}

/** 지정 stat에 delta 적용. StatKey 전범위 분기. */
export function applyStatDelta(unit: CombatUnit, stat: StatKey, delta: number): void {
  switch (stat) {
    case 'ad':
      unit.stats.damage += delta;
      return;
    case 'ap':
      unit.stats.ap += delta;
      return;
    case 'as':
      unit.stats.attackSpeed += delta;
      return;
    case 'hp': {
      unit.maxHp += delta;
      if (delta > 0) {
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + delta);
      } else {
        unit.currentHp = Math.min(unit.currentHp, unit.maxHp);
      }
      return;
    }
    case 'armor':
      unit.stats.armor += delta;
      return;
    case 'magicResist':
      unit.stats.magicResist += delta;
      return;
    case 'critChance':
      unit.stats.critChance += delta;
      return;
    case 'critDamage':
      unit.stats.critMultiplier += delta;
      return;
    case 'mana':
      unit.currentMana = Math.min(unit.maxMana, unit.currentMana + delta);
      return;
    case 'armorPen':
      unit.stats.armorPen += delta;
      return;
    case 'magicPen':
      unit.stats.magicPen += delta;
      return;
    case 'omnivamp':
      unit.omnivamp += delta;
      return;
    case 'damageAmp':
      unit.damageAmp += delta;
      return;
    case 'damageReduction':
      unit.damageReduction += delta;
      return;
  }
}

function execApplyDebuff(
  action: Extract<Action, { kind: 'applyDebuff' }>,
  ctx: ActionContext,
): void {
  const targets = resolveTargets(action.target, ctx);
  for (const target of targets) {
    // Phase 1: DebuffSpec.type은 string (shred/wound/burn 등). StatusEffect['type']에 포함되는 값만
    // StatusEffects에 push. 그 외(shred/wound)는 Phase 3/4에서 전용 처리 추가 예정.
    const effectType = action.debuff.type as StatusEffect['type'];
    target.statusEffects.push({
      type: effectType,
      sourceId: ctx.unit.id,
      remainingTicks: action.durationTicks,
      value: action.debuff.amount,
    });
  }
}

function execAddStack(
  action: Extract<Action, { kind: 'addStack' }>,
  ctx: ActionContext,
): void {
  const stackKey = resolveStackKey(action.stack, ctx);
  const current = ctx.state.stacks.get(stackKey) ?? 0;
  // 'payload.value': 현재 이벤트 payload 의 value (timer 에서는 undefined → 0)
  const inc = action.amount === 'payload.value'
    ? (ctx.payload?.value ?? 0)
    : (action.amount ?? 1);
  const next = action.cap !== undefined ? Math.min(current + inc, action.cap) : current + inc;
  ctx.state.stacks.set(stackKey, next);
}

/**
 * 스택 키 템플릿 치환 — `{targetId}` 를 payload.targetId 로 치환.
 * Per-target 누적 (표적 고정 첫 공격 여부, 개별 적 shred 카운터 등) 에 사용.
 * 치환값이 없으면 원본 키 반환.
 */
function resolveStackKey(template: string, ctx: ActionContext): string {
  if (!template.includes('{targetId}')) return template;
  return template.replace('{targetId}', ctx.payload?.targetId ?? 'unknown');
}
