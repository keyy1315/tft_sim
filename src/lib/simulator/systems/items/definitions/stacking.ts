/**
 * Stacking / Damage-Amp Item Definitions (Phase 3).
 *
 * 전투 중 trigger 로 동작하는 아이템:
 * - on_attack / on_hit_taken 기반 스태커 (Guinsoos, Titans)
 * - on_combat_start damageAmp (Deathblade, Rabadon)
 *
 * 각 아이템은 기존 StatPatch (베이스 스탯) + Phase 3 trigger 조합으로 선언.
 * 같은 apiName 이 combined.ts 에 있으면 registry 병합 단계에서 concat 됨.
 *
 * 단위 주의:
 * - modifyStat 'as': stats.attackSpeed 에 직접 덧셈 (절대치)
 * - modifyStat 'damageAmp': CombatUnit.damageAmp 에 덧셈. combatLoop 은
 *   `rawDamage * (1 + damageAmp)` 로 소모
 * - modifyStat 'ap': stats.ap 에 덧셈
 *
 * 설계 문서: docs/02-design/features/item-effect-engine.design.md §6
 */

import type { ItemEffectDescriptor, Action } from '../primitives/types';

/* ──────────────── Helper builders ──────────────── */

const statPatch = (stats: {
  ad?: number; ap?: number; as?: number; hp?: number;
  armor?: number; magicResist?: number;
  critChance?: number; critDamage?: number; mana?: number;
  armorPen?: number; magicPen?: number;
}): ItemEffectDescriptor => ({ kind: 'stat', stats });

/* ──────────────── Guinsoo's Rageblade ──────────────── */
// 공격마다 AS +7% 영구 (무제한 중첩)

/* ──────────────── Titan's Resolve ──────────────── */
// 공격/피격마다 AD+2%(damageAmp 로 근사), AP+2. 최대 25스택.

const TITAN_STACK_KEY = 'titan';

const titanStackChain: Action = {
  kind: 'chain',
  actions: [
    { kind: 'addStack', stack: TITAN_STACK_KEY, cap: 25 },
    // AD % 는 damageAmp 로 근사 — ChampionStats.damage 는 최종값이라 % delta 주입 불가.
    // damageAmp 는 이미 전투에서 `rawDamage * (1 + damageAmp)` 로 소모되므로
    // 25 스택 = +50% damage 근사 가능.
    { kind: 'modifyStat', stat: 'damageAmp', delta: 0.02 },
    { kind: 'modifyStat', stat: 'ap', delta: 2 },
  ],
};

/* ──────────────── Deathblade / Rabadon ──────────────── */
// 전투 시작 시 damageAmp % — 고정 버프 (스택 없음)

export const STACKING_ITEMS: Record<string, ItemEffectDescriptor[]> = {
  'TFT_Item_GuinsoosRageblade': [
    statPatch({ ap: 10, as: 10 }),
    {
      kind: 'trigger',
      event: 'on_attack',
      action: {
        kind: 'chain',
        actions: [
          { kind: 'addStack', stack: 'guinsoos_as' },
          { kind: 'modifyStat', stat: 'as', delta: 0.07 },
        ],
      },
    },
  ],

  'TFT_Item_TitansResolve': [
    statPatch({ as: 10, armor: 20 }),
    {
      kind: 'trigger',
      event: 'on_attack',
      condition: (ctx) => (ctx.state.stacks.get(TITAN_STACK_KEY) ?? 0) < 25,
      action: titanStackChain,
    },
    {
      kind: 'trigger',
      event: 'on_hit_taken',
      condition: (ctx) => (ctx.state.stacks.get(TITAN_STACK_KEY) ?? 0) < 25,
      action: titanStackChain,
    },
  ],

  'TFT_Item_Deathblade': [
    statPatch({ ad: 0.55 }),
    {
      kind: 'trigger',
      event: 'on_combat_start',
      action: { kind: 'modifyStat', stat: 'damageAmp', delta: 0.10 },
    },
  ],

  'TFT_Item_RabadonsDeathcap': [
    statPatch({ ap: 55 }),
    {
      kind: 'trigger',
      event: 'on_combat_start',
      action: { kind: 'modifyStat', stat: 'damageAmp', delta: 0.15 },
    },
  ],
};
