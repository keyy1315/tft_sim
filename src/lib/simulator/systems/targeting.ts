/**
 * Role 기반 타게팅 시스템 (Patch 15.1 Roles Revamped 기준)
 *
 * 1단계: 거리 우선 — 가장 가까운 적
 * 2단계: Role 타이브레이커 — Tank(3) > Fighter/Assassin(2) > Marksman/Caster/Specialist(1)
 */

import { CombatUnit, UnitRole } from '@/types';
import { hexDistance } from '@/lib/simulator/systems/movement';
import { SeededRNG } from '@/lib/simulator/engine/rng';

const TARGETING_WEIGHT: Record<UnitRole, number> = {
  Tank: 3,
  Fighter: 2,
  Assassin: 2,
  Marksman: 1,
  Caster: 1,
  Specialist: 1,
};

export function getTargetingWeight(role: UnitRole): number {
  return TARGETING_WEIGHT[role];
}

/**
 * Role 기반 타게팅 — 거리 우선 + Role 타이브레이커
 * 도발(taunt) 오버라이드 포함
 */
export function findTarget(
  unit: CombatUnit,
  enemies: CombatUnit[],
  rng: SeededRNG
): CombatUnit | null {
  const alive = enemies.filter(e => e.state !== 'dead');
  if (alive.length === 0) return null;

  // 도발(taunt) 오버라이드: 도발 상태가 있으면 해당 유닛만 타겟
  if (unit.statusEffects.length > 0) {
    const taunt = unit.statusEffects.find(e => e.type === 'taunt');
    if (taunt) {
      const taunter = alive.find(e => e.id === taunt.sourceId);
      if (taunter) return taunter;
    }
  }

  // 1단계: 거리 계산
  const withDist = alive.map(e => ({
    unit: e,
    dist: hexDistance(unit.position, e.position),
  }));

  const minDist = Math.min(...withDist.map(w => w.dist));
  const nearest = withDist.filter(w => w.dist === minDist);

  if (nearest.length === 1) return nearest[0].unit;

  // 2단계: Role 타이브레이커
  const maxWeight = Math.max(...nearest.map(n => getTargetingWeight(n.unit.role)));
  const topPriority = nearest.filter(n => getTargetingWeight(n.unit.role) === maxWeight);

  if (topPriority.length === 1) return topPriority[0].unit;

  // 동일 가중치: seed RNG로 결정 (결정론적)
  const idx = Math.floor(rng.next() * topPriority.length);
  return topPriority[idx].unit;
}

