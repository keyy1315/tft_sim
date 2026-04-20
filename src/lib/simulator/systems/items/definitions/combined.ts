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

  // 대천사의 지팡이: AP 30, ManaRegen 1 (APPerInterval → Phase 5+ Timer)
  'TFT_Item_ArchangelsStaff': [statPatch({ ap: 30, manaRegen: 1 })],

  // 덤불 조끼: Armor 50 (AutoDamageReduction/PercentMaxHP/AoE reflect → Phase 4+)
  'TFT_Item_BrambleVest': [statPatch({ armor: 50 })],
};
