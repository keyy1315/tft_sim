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
 * 설계: item-effect-engine §6
 */

import type { ItemEffectDescriptor, Action } from '../primitives/types';

/* ──────────────── Helper builders ──────────────── */

const statPatch = (stats: {
  ad?: number; ap?: number; as?: number; hp?: number;
  armor?: number; magicResist?: number;
  critChance?: number; critDamage?: number; mana?: number;
  armorPen?: number; magicPen?: number;
  omnivamp?: number; manaRegen?: number;
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

  // 수은 (Quicksilver) — Phase 3 6번째 중첩 아이템
  // 효과: AS 15 / CritChance 20 / MR 20 + 매초 AS +3% (ProcAttackSpeed, 중첩)
  //       전투 시작 18초 CC 면역 (SpellShieldDuration) 은 엔진 미지원 → skip
  'TFT_Item_Quicksilver': [
    statPatch({ as: 15, critChance: 20, magicResist: 20 }),
    {
      kind: 'timer',
      intervalTicks: 30, // 1초마다
      action: { kind: 'modifyStat', stat: 'as', delta: 0.03 },
    },
  ],

  // 크라켄의 분노 (set17 — apiName TFT_Item_RunaansHurricane 재활용, Runaan's 효과 아님!)
  // 효과 (tft_set17_items.json): AD 0.10 base / 평타당 +3.5% AD (ADOnAttack, MaxStacks 15)
  //   / 15스택 후 AS +15% (ASCapstone) / MR 20 / AS 10 base.
  // AD% 스택은 damageAmp 로 근사 (Titans 패턴 — ChampionStats.damage 는 최종값이라 % 주입 불가).
  // calibration: 미모델 시 AD 캐리 평타 데미지 과소 (project_underdamage_calibration).
  'TFT_Item_RunaansHurricane': [
    // ⚠️ registry(statPatch) 경로는 as 를 fraction 직접 사용 (legacy normalizeLegacyPct 미적용,
    //    stat.ts:216 baseAs*(1+itemFx.as)). raw effects AS:10(integer pts) → fraction 0.10. codex P1 #217.
    statPatch({ ad: 0.10, as: 0.10, magicResist: 20 }),
    {
      kind: 'trigger',
      event: 'on_attack',
      condition: (ctx) => (ctx.state.stacks.get('kraken') ?? 0) < 15,
      action: {
        kind: 'chain',
        actions: [
          { kind: 'addStack', stack: 'kraken', cap: 15 },
          { kind: 'modifyStat', stat: 'damageAmp', delta: 0.035 },
        ],
      },
    },
    {
      // 15스택 도달 시 1회 AS capstone (kraken_cap 플래그로 단발성)
      kind: 'trigger',
      event: 'on_attack',
      condition: (ctx) =>
        (ctx.state.stacks.get('kraken') ?? 0) >= 15 && (ctx.state.stacks.get('kraken_cap') ?? 0) === 0,
      action: {
        kind: 'chain',
        actions: [
          { kind: 'addStack', stack: 'kraken_cap', cap: 1 },
          { kind: 'modifyStat', stat: 'as', delta: 0.15 },
        ],
      },
    },
  ],

  // 귀여운 발사기 (UwuBlaster, set17 Anima Squad Tier2)
  // 효과: AD 0.25 / AS 45 base + 평타마다 레이저 3발(NumUwUBlasts) 사거리 내 무작위 대상에
  //   각 장착유닛 AD의 40%(ADDamage) 물리 피해. on_attack proc ×3 randomEnemy.
  'TFT17_AnimaSquadItem_Tier2_UwuBlaster': [
    // as 는 fraction (registry 경로 미정규화) — raw effects AS:45(integer pts) → 0.45. codex P1 #217.
    statPatch({ ad: 0.25, as: 0.45 }),
    {
      kind: 'trigger',
      event: 'on_attack',
      action: {
        kind: 'chain',
        actions: [
          { kind: 'dealDamage', amount: { mode: 'pctAttackDamage', pct: 0.40 }, type: 'physical', target: 'randomEnemy' },
          { kind: 'dealDamage', amount: { mode: 'pctAttackDamage', pct: 0.40 }, type: 'physical', target: 'randomEnemy' },
          { kind: 'dealDamage', amount: { mode: 'pctAttackDamage', pct: 0.40 }, type: 'physical', target: 'randomEnemy' },
        ],
      },
    },
  ],
};
