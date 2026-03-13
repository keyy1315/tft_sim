/**
 * Unit 모델 상수 및 Role 관련 설정
 */
import { UnitRole } from '@/types';

export const MAX_TEAM_SIZE = 8;

/** Role별 기본 Omnivamp 비율 (Fighter 전용) */
export const ROLE_OMNIVAMP: Record<UnitRole, number> = {
  Tank: 0,
  Fighter: 0.12, // 12% 기본 (Stage별 8~20% 범위)
  Marksman: 0,
  Caster: 0,
  Assassin: 0,
  Specialist: 0,
};

/** Role별 타게팅 가중치 */
export const TARGETING_WEIGHT: Record<UnitRole, number> = {
  Tank: 3,
  Fighter: 2,
  Marksman: 2,
  Caster: 2,
  Specialist: 2,
  Assassin: 1,
};
