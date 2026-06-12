/**
 * Combined Item Definitions — StatPatch 이관 (Phase 2).
 *
 * 원칙:
 * - 레거시 `ITEM_EFFECT_KEYS` 가 매핑하던 키와 동일 값만 포함
 * - trigger/stacking/interval 효과(BonusDamage, AttackSpeedPerStack, ManaRegen 등) 는
 *   Phase 3 이후 Trigger/Counter/Timer descriptor 로 별도 추가 (여기서는 의도적 제외)
 *
 * 데이터 출처: public/data/tft_set17_items.json (CDragon, 2026-04-18 patch)
 * 설계 문서: docs/02-design/features/item-effect-engine.design.md §8
 */

import type { ItemEffectDescriptor } from '../primitives/types';

/**
 * StatPatch 전용 entry 빌더 — 가독성용 헬퍼.
 */
const statPatch = (stats: {
  ad?: number;
  ap?: number;
  as?: number;
  hp?: number;
  armor?: number;
  magicResist?: number;
  critChance?: number;
  critDamage?: number;
  mana?: number;
  armorPen?: number;
  magicPen?: number;
  omnivamp?: number;
  manaRegen?: number;
}): ItemEffectDescriptor => ({ kind: 'stat', stats });

/**
 * 조합 아이템 정의. 각 apiName 에 대해 StatPatch 하나 (+ Phase 3 이후 trigger 추가 예정).
 */
/**
 * 순수 StatPatch 아이템 (trigger 없음).
 * Stacking/damageAmp trigger 아이템은 definitions/stacking.ts 로 분리.
 */
export const COMBINED_ITEMS: Record<string, ItemEffectDescriptor[]> = {
  // 무한의 대검: AD 35%, CritChance 35
  'TFT_Item_InfinityEdge': [statPatch({ ad: 0.35, critChance: 35 })],

  // 보석 건틀릿: AP 35, CritChance 35
  'TFT_Item_JeweledGauntlet': [statPatch({ ap: 35, critChance: 35 })],

  // 피바라기: AD 15%, AP 15, MR 20, StatOmnivamp 20% (ShieldDuration/HealthThreshold → Phase 5+ Trigger)
  'TFT_Item_Bloodthirster': [statPatch({ ad: 0.15, ap: 15, magicResist: 20, omnivamp: 0.20 })],

  // 쇼진의 창: AD 15%, AP 15, ManaRegen 1 (FlatManaRestore → 추후 별도 Trigger)
  'TFT_Item_SpearOfShojin': [statPatch({ ad: 0.15, ap: 15, manaRegen: 1 })],

  // 대천사의 지팡이: AP 30, ManaRegen 1 + 5초마다 AP +20 (APPerInterval=20, IntervalSeconds=5).
  // PR98: caster economy fix — Set 17 데이터 IntervalSeconds=5 / APPerInterval=20 시뮬 적용.
  // 시뮬 30 tps → 5s = 150 ticks. modifyStat permanent (no durationTicks) → 누적 stacking.
  'TFT_Item_ArchangelsStaff': [
    statPatch({ ap: 30, manaRegen: 1 }),
    {
      kind: 'timer',
      intervalTicks: 150,
      action: { kind: 'modifyStat', stat: 'ap', delta: 20 },
    },
  ],

  // 덤불 조끼: Armor 50 (AutoDamageReduction/PercentMaxHP/AoE reflect → Phase 4+)
  'TFT_Item_BrambleVest': [statPatch({ armor: 50 })],

  // 도적의 장갑: CritChance 20, Health 150 (실게임은 랜덤 아이템 부여 기믹이지만 스탯만 반영)
  'TFT_Item_ThiefsGloves': [statPatch({ critChance: 20, hp: 150 })],

  // 공포의 낫 (CursedBlade): AS 15, MR 25 (공격 적중 시 적 성급 강등 효과는 엔진 미지원)
  'TFT_Item_CursedBlade': [statPatch({ as: 15, magicResist: 25 })],

  // 찬란 보석 건틀릿 — base 와 동일 스탯으로 시작 (Corrupted 보너스는 trigger 계열이 많아 이월)
  'TFT_Item_CorruptedJeweledGauntlet': [statPatch({ ap: 35, critChance: 35 })],

  // 찬란 무한의 대검
  'TFT_Item_CorruptedInfinityEdge': [statPatch({ ad: 0.35, critChance: 35 })],

  // 정령의 형상 (Redemption, set17): HP 300 / ManaRegen 2 + 매초 잃은 체력 2% 회복
  //   (MissingHealthHeal 0.02, HealTickRate 1; MaxHeal 250 cap 은 근사 생략 — 2% missing 은
  //    maxHp 12500 미만이면 250 미달이라 거의 무영향).
  // ⚠️ registry 등록 시 legacy(getItemEffects) 경로가 멈추므로 base 스탯(HP/ManaRegen)을
  //    statPatch 로 명시 필수 (codex P1 #217 — registry vs legacy 경로 교훈).
  // calibration: 탱커 sustain 미반영 → 적 빨리 죽어 combat 단축 → AD 캐리 누적 데미지 컷
  //   (project_underdamage_calibration, combat-shortening 커플링 완화 목적).
  'TFT_Item_Redemption': [
    statPatch({ hp: 300, manaRegen: 2 }),
    {
      kind: 'timer',
      intervalTicks: 30, // 1초 (HealTickRate 1)
      action: {
        kind: 'heal',
        amount: { mode: 'pctMissingHp', pct: 0.02 },
        target: 'self',
      },
    },
  ],
};
