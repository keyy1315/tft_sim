/**
 * Ability 모델 상수
 */

/** 기본 크리티컬 데미지 배율 (TFT 기본값) */
export const DEFAULT_CRIT_MULTIPLIER = 1.4;

/** 어빌리티 타게팅 타입 */
export const ABILITY_TARGETING_TYPES = [
  'current_target',
  'farthest',
  'nearest',
  'lowest_hp',
  'lowest_hp_ally',
  'random',
  'self',
  'aoe_center',
] as const;
