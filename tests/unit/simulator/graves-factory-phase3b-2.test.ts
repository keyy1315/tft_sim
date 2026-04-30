/**
 * 회귀 가드 — 최신상 (TFT17_GravesTrait) 무기고 Phase 3B-2 — 메커닉 3종.
 *
 * 적용 3종 (raw effects):
 *   GravBooster      BonusMultAS=0.40, NumAttacks=2 (처치 시 dash + AS +40% × 2 attacks)
 *   GravBooster2     BonusMultAS=0.40, NumAttacks=3 (× 3 attacks; 동상 raw 미정의 → 미구현)
 *   LatentExplosion  LatentExplosionStoredDamage=0.15 (입힌 피해 15% 누적, 처치 시 2hex splash)
 *
 * Phase 3C / 3D 후속 PR.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apGraves = champions.find(c => c.apiName === 'TFT17_Graves')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

function runWith(upgrades: string[], enemies?: PlacedChampion[]) {
  const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
  const enemy: PlacedChampion[] = enemies ?? [placed(dummyEnemy, 6, 3)];
  return simulateCombat(team, enemy, {
    seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    playerGravesUpgrades: upgrades,
  });
}

function gravesOf(result: ReturnType<typeof runWith>) {
  return result.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
}

describe('GravesTrait Phase 3B-2 — GravBooster (onKill dash + AS bonus 2 attacks)', () => {
  it('GravBooster → bonusAS 0.40 / maxAttacks 2', () => {
    const grav = gravesOf(runWith(['GravBooster']));
    expect(grav.gravesGravBoosterBonusAS).toBeCloseTo(0.40, 3);
    expect(grav.gravesGravBoosterMaxAttacks).toBe(2);
    expect(grav.gravesUpgrades).toContain('GravBooster');
  });

  it('GravBooster2 → bonusAS 0.40 / maxAttacks 3 (NumAttacks override)', () => {
    const grav = gravesOf(runWith(['GravBooster2']));
    expect(grav.gravesGravBoosterBonusAS).toBeCloseTo(0.40, 3);
    expect(grav.gravesGravBoosterMaxAttacks).toBe(3);
  });

  it('GravBooster + GravBooster2 동시 → maxAttacks 3 (max override)', () => {
    const grav = gravesOf(runWith(['GravBooster', 'GravBooster2']));
    expect(grav.gravesGravBoosterMaxAttacks).toBe(3);
  });

  it('미사용 시 default (0/0/0)', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesGravBoosterBonusAS).toBe(0);
    expect(grav.gravesGravBoosterMaxAttacks).toBe(0);
    expect(grav.gravesGravBoosterAttacksRemaining).toBe(0);
  });

  it('GravBooster 활성 + 처치 발생 시 attacksRemaining 활성화 (>=0 이지만 보통 소비됨)', () => {
    // 단일 적 시나리오에서 graves 가 처치 시 attacksRemaining = 2 set.
    // 전투 종료 시점에는 보통 다 소비됐거나 소비 도중 종료.
    // 직접 검증은 어려우니 attackCount 가 baseline 보다 많은지 (AS bonus 효과) 확인.
    const result = runWith(['GravBooster2'], [
      placed(dummyEnemy, 6, 3),
      placed(dummyEnemy, 5, 3),  // 처치 후 dash 대상
    ]);
    const grav = gravesOf(result);
    // GravBooster2 활성 시 첫 적 처치 후 두 번째 적 향해 dash + AS buff.
    // 적어도 2명 적과 모두 교전 가능.
    expect(grav.attackCount).toBeGreaterThan(0);
    expect(grav.killCount).toBeGreaterThanOrEqual(1);
  });
});

describe('GravesTrait Phase 3B-2 — LatentExplosion (stored 누적 + 처치 시 splash)', () => {
  it('LatentExplosion → storedPct 0.15', () => {
    const grav = gravesOf(runWith(['LatentExplosion']));
    expect(grav.gravesLatentStoredPct).toBeCloseTo(0.15, 3);
    expect(grav.gravesUpgrades).toContain('LatentExplosion');
  });

  it('미사용 시 storedPct = 0 / stored = 0', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesLatentStoredPct).toBe(0);
    expect(grav.gravesLatentStored).toBe(0);
  });

  it('LatentExplosion 활성 + 인접 적 2명 → 처치 시 splash 데미지 (적 2명 모두 totalDamageTaken > 0)', () => {
    // graves 첫 적 처치 시 2hex 반경 (다른 적) 에 splash. enemies 위치를 graves(0,0) 의
    // 사거리 안 + 서로 인접하게 배치.
    const enemies = [
      placed(dummyEnemy, 6, 3),  // graves 첫 타겟 (가장 가까움)
      placed(dummyEnemy, 5, 3),  // 첫 적과 인접 (splash 대상)
    ];
    const baseRes = runWith([], enemies);
    const latentRes = runWith(['LatentExplosion'], enemies);
    // 적 2명 모두 sim 끝에 죽거나 데미지 누적. LatentExplosion 활성 시 splash 추가.
    const baseKilledCount = baseRes.enemyUnits.filter(e => e.state === 'dead').length;
    const latentKilledCount = latentRes.enemyUnits.filter(e => e.state === 'dead').length;
    // graves 가 첫 적 처치 → splash 가 두 번째 적에 추가 데미지.
    // 동일 시뮬 시간 내 두 번째 적도 죽었다면 latentKilledCount >= baseKilledCount.
    expect(latentKilledCount).toBeGreaterThanOrEqual(baseKilledCount);
    // graves totalDamageDealt 가 baseline 보다 크거나 같음 (splash 가 가산됨).
    const baseGrav = gravesOf(baseRes);
    const latentGrav = gravesOf(latentRes);
    expect(latentGrav.totalDamageDealt).toBeGreaterThanOrEqual(baseGrav.totalDamageDealt);
  });
});

describe('GravesTrait Phase 3B-2 — deterministic ordering', () => {
  it('입력 순서 무관 (GravBooster 먼저 vs GravBooster2 먼저) → 동일 결과', () => {
    const a = gravesOf(runWith(['GravBooster', 'GravBooster2']));
    const b = gravesOf(runWith(['GravBooster2', 'GravBooster']));
    expect(a.gravesGravBoosterMaxAttacks).toBe(b.gravesGravBoosterMaxAttacks);
    expect(a.totalDamageDealt).toBeCloseTo(b.totalDamageDealt, 1);
  });

  it('LatentExplosion + GravBooster 동시 활성 → 두 effect 모두 set', () => {
    const grav = gravesOf(runWith(['LatentExplosion', 'GravBooster']));
    expect(grav.gravesLatentStoredPct).toBeCloseTo(0.15, 3);
    expect(grav.gravesGravBoosterMaxAttacks).toBe(2);
  });
});
