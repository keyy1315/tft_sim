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

/** 전사 스테이지별 AS 보너스 (lolchess.gg: 5~30%) */
const FIGHTER_AS_BY_STAGE = [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.30];

export function getFighterASBonus(stageNumber: number): number {
  const clamped = Math.max(1, Math.min(stageNumber, 7));
  return FIGHTER_AS_BY_STAGE[clamped];
}

/** Role별 타게팅 가중치 — Tank(3) > Fighter/Assassin(2) > Marksman/Caster/Specialist(1) */
export const TARGETING_WEIGHT: Record<UnitRole, number> = {
  Tank: 3,
  Fighter: 2,
  Assassin: 2,
  Marksman: 1,
  Caster: 1,
  Specialist: 1,
};
