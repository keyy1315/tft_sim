/**
 * Artifact Item Definitions (Phase 6-B Part 3).
 *
 * Set 17 Artifact 카테고리 아이템들 — 단일 trigger / timer 기반의 비-stacking
 * 효과를 모은다. Phase 3 (stacking) / Phase 4 (psyops) / Phase 5 (anomaly)
 * 와 분리해서 카테고리적으로 정리.
 *
 * 본 Phase 의 일차 목표는 estimateDps DPS_CALIBRATION 매직 넘버 #1, #3 을
 * 시뮬 기반으로 측정 가능하게 만드는 것:
 *   - #1 FLAT_DAMAGE_PROC_RATE  ← 루덴의 폭풍 (BaseDamage 100, on_kill splash)
 *   - #3 BONUS_ATTACK_DPS_MULT ← 야스오의 검술 (NumBonusAttacks=1, Interval=3.5s)
 *
 * 단순화/근사 명시:
 *   - 루덴: 실제 메커닉 "처치된 대상 + 가까운 적 3명" 의 위치 정보를 위해서는
 *     dead target 의 position 보존이 필요. 단순화로 source 유닛 주변
 *     `adjacentEnemies` 로 splash. PercentOfOverkill 부분은 생략 (BaseDamage 100 만 적용).
 *   - 야스오: "다음 기본 공격 시 이중 공격" 메커닉을 attack-state 머신에 inject 하지
 *     않고 timer 로 근사. 3.5초마다 attackTarget 에게 AD 100% physical damage.
 *     onHit/crit 효과는 생략.
 */

import type { ItemEffectDescriptor } from '../primitives/types';

const statPatch = (stats: {
  ad?: number; ap?: number; as?: number; hp?: number;
  armor?: number; magicResist?: number;
  critChance?: number; critDamage?: number; mana?: number;
  armorPen?: number; magicPen?: number;
  omnivamp?: number; manaRegen?: number;
}): ItemEffectDescriptor => ({ kind: 'stat', stats });

export const ARTIFACT_ITEMS: Record<string, ItemEffectDescriptor[]> = {
  /**
   * 루덴의 폭풍 (TFT_Item_Artifact_LudensTempest)
   *   AD: 55%, AP: 55, BaseDamage: 100, PercentOfOverkill: 100
   *   원본: "대상 처치 후 남는 피해량의 100% + 100 마법 피해를 대상과 가까운 적 3명에게"
   *   엔진 근사: on_kill 시 source 주변 adjacentEnemies 에게 100 magic flat damage.
   *             overkill 부분 생략.
   */
  'TFT_Item_Artifact_LudensTempest': [
    statPatch({ ad: 0.55, ap: 55 }),
    {
      kind: 'trigger',
      event: 'on_kill',
      action: {
        kind: 'dealDamage',
        amount: { mode: 'flat', value: 100 },
        type: 'magic',
        target: 'adjacentEnemies',
      },
    },
  ],

  /**
   * 야스오의 검술 (TFT17_Item_Artifact_YasuoArtifact)
   *   AD: 30%, AS: 10, Interval: 3.5s, NumBonusAttacks: 1, Threshold: 0.7
   *   원본: "Interval 초마다 다음 기본 공격 시 이중 공격"
   *   엔진 근사: 3.5초(105 ticks) 주기 timer 로 attackTarget 에게 AD 100% physical 추가 피해.
   *             attack state 머신에 inject 하는 대신 직접 데미지 액션. crit/onHit 생략.
   */
  'TFT17_Item_Artifact_YasuoArtifact': [
    statPatch({ ad: 0.30, as: 10 }),
    {
      kind: 'timer',
      intervalTicks: 105, // 3.5s × 30 tps
      action: {
        kind: 'dealDamage',
        amount: { mode: 'pctAttackDamage', pct: 1.0 },
        type: 'physical',
        target: 'attackTarget',
      },
    },
  ],
};
