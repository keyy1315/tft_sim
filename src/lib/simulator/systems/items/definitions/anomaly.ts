/**
 * Anomaly Item Definitions (Phase 5).
 *
 * Role 기반 분기 — 장착 유닛의 UnitRole 에 따라 전혀 다른 효과 적용.
 * `on_combat_start` trigger + condition 으로 role 분기 구현.
 *
 * 데이터 출처: TFT17_EkkoOffering_AnomalyItem (public/data/tft_set17_items.json)
 * 설계: item-effect-engine §6.5
 */

import type { ItemEffectDescriptor } from '../primitives/types';

/* ──────────────── Role 별 효과 ────────────────
 * Tank      : 체력 +1100
 * Marksman  : 공격 속도 +60% (knockback 은 엔진 미지원으로 스킵)
 * Fighter/
 * Assassin  : AD +30% (damageAmp 로 근사), AP +30
 *             체력 85% 미만 때 3배 → HP 기반 조건부는 진입 시점 1회만 적용 (근사)
 * Caster    : on_mana_spent 누적 50마다 주변 적 에게 %최대체력 고정피해
 *             (상처/화상 CC 는 미구현 — 단순 피해)
 * Specialist: 별 6개 공전 (entity spawn 필요, Phase 5 Part 2)
 * ──────────────────────────────────────────── */

const ANOMALY_API = 'TFT17_EkkoOffering_AnomalyItem';
const CASTER_MANA_STACK = 'anomaly_caster_mana';
const CASTER_THRESHOLD = 50;

/**
 * Anomaly descriptor 배열.
 *
 * 각 role 에 대해 독립된 trigger entry 를 둬서 condition mismatch 시 no-op.
 * 다른 role 이 아이템을 장착해도 해당 role trigger 만 fire (나머지 skip).
 */
export const ANOMALY_ITEMS: Record<string, ItemEffectDescriptor[]> = {
  [ANOMALY_API]: [
    // ───── Tank: HP +1100 ─────
    {
      kind: 'trigger',
      event: 'on_combat_start',
      condition: (ctx) => ctx.unit.role === 'Tank',
      action: { kind: 'modifyStat', stat: 'hp', delta: 1100 },
    },

    // ───── Marksman: AS +60% ─────
    {
      kind: 'trigger',
      event: 'on_combat_start',
      condition: (ctx) => ctx.unit.role === 'Marksman',
      action: { kind: 'modifyStat', stat: 'as', delta: 0.6 },
    },

    // ───── Fighter/Assassin: AD +30% (damageAmp), AP +30 ─────
    // HP<85% 때 3배 조건은 on_combat_start 시점엔 100% HP 라 base 적용.
    // threshold 발동은 on_hit_taken condition 으로 추가 (체력 변화 시점 재평가).
    {
      kind: 'trigger',
      event: 'on_combat_start',
      condition: (ctx) => ctx.unit.role === 'Fighter' || ctx.unit.role === 'Assassin',
      action: {
        kind: 'chain',
        actions: [
          { kind: 'modifyStat', stat: 'damageAmp', delta: 0.30 },
          { kind: 'modifyStat', stat: 'ap', delta: 30 },
        ],
      },
    },
    // HP 85% 미만 진입 시 2x 추가 (총 3배 근사 — 이미 base 1x 적용되어 있으므로 +2x)
    // state.stacks['triggered_low_hp'] 로 1회만 적용.
    {
      kind: 'trigger',
      event: 'on_hit_taken',
      condition: (ctx) => {
        const isFighterLike = ctx.unit.role === 'Fighter' || ctx.unit.role === 'Assassin';
        if (!isFighterLike) return false;
        const alreadyTriggered = (ctx.state.stacks.get('triggered_low_hp') ?? 0) > 0;
        if (alreadyTriggered) return false;
        return ctx.unit.currentHp / ctx.unit.maxHp < 0.85;
      },
      action: {
        kind: 'chain',
        actions: [
          // base 1x 이미 적용됨 → 2x 추가 = 총 3x
          { kind: 'modifyStat', stat: 'damageAmp', delta: 0.60 },
          { kind: 'modifyStat', stat: 'ap', delta: 60 },
          { kind: 'addStack', stack: 'triggered_low_hp' },
        ],
      },
    },

    // ───── Caster: 마나 50 쓸 때마다 주변 적에게 %최대체력 고정피해 ─────
    // Step 1: on_mana_spent payload.value 누적
    {
      kind: 'trigger',
      event: 'on_mana_spent',
      condition: (ctx) => ctx.unit.role === 'Caster',
      action: { kind: 'addStack', stack: CASTER_MANA_STACK, amount: 'payload.value' },
    },
    // Step 2: 누적 50 이상 시 proc — 가장 가까운 적에게 6% 최대체력 고정피해 + 스택 -50
    // (상처/화상 CC 는 StatusEffect 확장 필요 — 생략)
    {
      kind: 'trigger',
      event: 'on_mana_spent',
      condition: (ctx) => {
        if (ctx.unit.role !== 'Caster') return false;
        return (ctx.state.stacks.get(CASTER_MANA_STACK) ?? 0) >= CASTER_THRESHOLD;
      },
      action: {
        kind: 'chain',
        actions: [
          {
            kind: 'dealDamage',
            amount: { mode: 'pctMaxHp', pct: 0.06 },
            type: 'true',
            target: 'nearestEnemy',
          },
          // -50 만큼 차감 (addStack 에 음수 amount 로 구현)
          { kind: 'addStack', stack: CASTER_MANA_STACK, amount: -CASTER_THRESHOLD },
        ],
      },
    },

    // ───── Specialist: 별 6개 공전 근사 (Phase 5 Part 2) ─────
    // 실게임: 6개 별이 공전 궤도 확장해 현재 대상 타격, 각 85 마법 피해
    // 근사 구현: 1초마다 1개 별 발사 (최대 6회) — 공전/확장 시각화 없이 DPS 기여만
    {
      kind: 'trigger',
      event: 'on_combat_start',
      condition: (ctx) => ctx.unit.role === 'Specialist',
      action: { kind: 'addStack', stack: 'specialist_activated', amount: 1 },
    },
  ],
};

/* Specialist star orbit — Timer 로 근사 발사. 아이템 descriptor 레벨에선
 * Trigger + Timer 조합이 필요한데, 현재 구조상 role condition 을 Timer 에
 * 직접 걸 수 없어서 on_combat_start 에 Timer 를 런타임 등록하는 방식이 필요.
 * 임시 우회: anomaly 에 모든 유닛 대상 Timer 를 두고, action 내부에서
 * role === 'Specialist' 체크 + 발동 제한. */
ANOMALY_ITEMS[ANOMALY_API].push({
  kind: 'timer',
  intervalTicks: 30, // 1초마다
  maxRepeats: 6,     // 최대 6회 (별 6개)
  action: {
    kind: 'branch',
    condition: (ctx) => ctx.unit.role === 'Specialist',
    then: {
      kind: 'dealDamage',
      amount: { mode: 'flat', value: 85 },
      type: 'magic',
      target: 'nearestEnemy',
    },
  },
});
