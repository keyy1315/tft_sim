/**
 * Role 기반 타게팅 시스템 (Patch 15.1 Roles Revamped 기준)
 *
 * 1단계: 거리 우선 — 가장 가까운 적
 * 2단계: Role 타이브레이커 — Tank(3) > Fighter/Marksman/Caster/Specialist(2) > Assassin(1)
 */

import { CombatUnit, UnitRole } from '@/types';
import { hexDistance } from '@/lib/simulator/systems/movement';
import { SeededRNG } from '@/lib/simulator/engine/rng';

const TARGETING_WEIGHT: Record<UnitRole, number> = {
  Tank: 3,
  Fighter: 2,
  Marksman: 2,
  Caster: 2,
  Specialist: 2,
  Assassin: 1,
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

/**
 * 어빌리티 타게팅 — AbilityTargetingType에 따라 타겟 선택
 */
export function findAbilityTarget(
  unit: CombatUnit,
  allies: CombatUnit[],
  enemies: CombatUnit[],
  targetingType: string,
  rng: SeededRNG
): CombatUnit | null {
  const aliveEnemies = enemies.filter(e => e.state !== 'dead');
  const aliveAllies = allies.filter(a => a.state !== 'dead');

  switch (targetingType) {
    case 'current_target':
      return aliveEnemies.find(e => e.id === unit.target) ?? null;

    case 'farthest': {
      if (aliveEnemies.length === 0) return null;
      let farthest = aliveEnemies[0];
      let maxDist = 0;
      for (const e of aliveEnemies) {
        const d = hexDistance(unit.position, e.position);
        if (d > maxDist) { maxDist = d; farthest = e; }
      }
      return farthest;
    }

    case 'nearest':
      return findTarget(unit, enemies, rng);

    case 'lowest_hp': {
      if (aliveEnemies.length === 0) return null;
      let lowest = aliveEnemies[0];
      for (const e of aliveEnemies) {
        if (e.currentHp < lowest.currentHp) lowest = e;
      }
      return lowest;
    }

    case 'lowest_hp_ally': {
      if (aliveAllies.length === 0) return null;
      let lowest = aliveAllies[0];
      for (const a of aliveAllies) {
        if (a.currentHp < lowest.currentHp) lowest = a;
      }
      return lowest;
    }

    case 'random': {
      if (aliveEnemies.length === 0) return null;
      const idx = Math.floor(rng.next() * aliveEnemies.length);
      return aliveEnemies[idx];
    }

    case 'self':
      return unit;

    case 'aoe_center':
      return findTarget(unit, enemies, rng);

    default:
      return aliveEnemies.find(e => e.id === unit.target) ?? null;
  }
}
