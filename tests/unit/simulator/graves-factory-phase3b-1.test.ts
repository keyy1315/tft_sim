/**
 * 회귀 가드 — 최신상 (TFT17_GravesTrait) 무기고 Phase 3B-1 — 메커닉 4종.
 *
 * 적용 4종 (raw effects):
 *   DoubleTap2  DoubleAttackChance=0.35   (Frame DoubleTap 25% 와 max() override)
 *   TripleTap   TripleAttackChance=0.18   (별개 roll, 발동 시 추가 2 hit, DoubleTap path skip)
 *   RevUp       AttackSpeedPerAttack=0.08, MaxAttackSpeed=0.80
 *   RevUp2      AttackSpeedPerAttack=0.15, MaxAttackSpeed=1.50
 *
 * Phase 3B-2 (GravBooster/2 + LatentExplosion) 는 후속 PR.
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

function runWith(upgrades: string[], frame?: 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap') {
  const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
  const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
  return simulateCombat(team, enemy, {
    seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    playerGravesUpgrades: upgrades,
    playerGravesFrame: frame,
  });
}

function gravesOf(result: ReturnType<typeof runWith>) {
  return result.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
}

describe('GravesTrait Phase 3B-1 — DoubleTap2 (35% chance, Frame override)', () => {
  it('DoubleTap2 → gravesDoubleAttackChance = 0.35', () => {
    const grav = gravesOf(runWith(['DoubleTap2']));
    expect(grav.gravesDoubleAttackChance).toBeCloseTo(0.35, 3);
    expect(grav.gravesUpgrades).toContain('DoubleTap2');
  });

  it('Frame DoubleTap (0.25) + DoubleTap2 (0.35) 동시 활성 → max 0.35', () => {
    const grav = gravesOf(runWith(['DoubleTap2'], 'DoubleTap'));
    expect(grav.gravesDoubleAttackChance).toBeCloseTo(0.35, 3);
  });

  it('DoubleTap2 미사용 + Frame DoubleTap 만 → 0.25 유지', () => {
    const grav = gravesOf(runWith([], 'DoubleTap'));
    expect(grav.gravesDoubleAttackChance).toBeCloseTo(0.25, 3);
  });
});

describe('GravesTrait Phase 3B-1 — TripleTap (18% chance, 추가 2 hit)', () => {
  it('TripleTap → gravesTripleAttackChance = 0.18', () => {
    const grav = gravesOf(runWith(['TripleTap']));
    expect(grav.gravesTripleAttackChance).toBeCloseTo(0.18, 3);
    expect(grav.gravesUpgrades).toContain('TripleTap');
  });

  it('미사용 시 gravesTripleAttackChance = 0', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesTripleAttackChance).toBe(0);
  });

  it('TripleTap 활성 시 평균 attackCount 증가 (chance proc 시 +2 hit)', () => {
    // 기준선
    const baseGrav = gravesOf(runWith([]));
    // TripleTap 활성 + DoubleTap 둘 다 미사용 (분리된 영향 측정)
    const tripleGrav = gravesOf(runWith(['TripleTap']));
    // attackCount = 평타 횟수. TripleTap proc 시 +2 hit per 평타.
    expect(tripleGrav.attackCount).toBeGreaterThanOrEqual(baseGrav.attackCount);
    // 18% chance × N 평타 → 약 18%×2 = 36% 평균 추가. 적어도 1번 proc 발생할 정도면 차이.
    if (baseGrav.attackCount >= 5) {
      expect(tripleGrav.attackCount).toBeGreaterThan(baseGrav.attackCount);
    }
  });
});

describe('GravesTrait Phase 3B-1 — RevUp/2 (sticky target AS stack)', () => {
  it('RevUp → perStack 0.08 / maxBonus 0.80', () => {
    const grav = gravesOf(runWith(['RevUp']));
    expect(grav.gravesRevUpPerStack).toBeCloseTo(0.08, 3);
    expect(grav.gravesRevUpMaxBonus).toBeCloseTo(0.80, 3);
    expect(grav.gravesUpgrades).toContain('RevUp');
  });

  it('RevUp2 → perStack 0.15 / maxBonus 1.50 (RevUp override)', () => {
    const grav = gravesOf(runWith(['RevUp', 'RevUp2']));
    // RevUp2 는 항상 override (canonical order: RevUp 먼저, RevUp2 가 덮어씀)
    expect(grav.gravesRevUpPerStack).toBeCloseTo(0.15, 3);
    expect(grav.gravesRevUpMaxBonus).toBeCloseTo(1.50, 3);
  });

  it('RevUp2 단독 → perStack 0.15', () => {
    const grav = gravesOf(runWith(['RevUp2']));
    expect(grav.gravesRevUpPerStack).toBeCloseTo(0.15, 3);
    expect(grav.gravesRevUpMaxBonus).toBeCloseTo(1.50, 3);
  });

  it('RevUp 활성 + 평타 N회 → 같은 target stack 누적 (1명 적 시나리오)', () => {
    const grav = gravesOf(runWith(['RevUp']));
    // 같은 적 1명 → 모든 평타 sticky target match → stack 누적.
    // codex P2 fix: sticky target 잡는 첫 hit 도 stack=1 → N hit 후 stack=N.
    expect(grav.gravesRevUpStickyTargetId).not.toBeNull();
    if (grav.attackCount >= 1) {
      expect(grav.gravesRevUpStackCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('미사용 시 RevUp 필드 default (0/0/null/0)', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesRevUpPerStack).toBe(0);
    expect(grav.gravesRevUpMaxBonus).toBe(0);
    expect(grav.gravesRevUpStickyTargetId).toBeNull();
    expect(grav.gravesRevUpStackCount).toBe(0);
  });

  it('RevUp 활성 시 같은 적 kill duration 단축 (AS stack → DPS 증가)', () => {
    // 단일 적 시나리오: hit 수는 동일 (같은 HP) 하지만 AS bonus 로 더 빠르게 kill.
    // duration 비교 → DPS = totalDamage / duration 으로 환산.
    const baseRes = runWith([]);
    const revUpRes = runWith(['RevUp2']);
    expect(revUpRes.duration).toBeLessThan(baseRes.duration);
    // RevUp stack 도 누적 확인
    const revUpGrav = gravesOf(revUpRes);
    expect(revUpGrav.gravesRevUpStackCount).toBeGreaterThan(0);
  });
});

describe('GravesTrait Phase 3B-1 — TripleTap vs DoubleTap mutual exclusive', () => {
  it('TripleTap + DoubleTap2 동시 활성 → TripleTap 우선 roll (proc 시 DoubleTap path skip)', () => {
    // 코드 상 if-else if 구조. TripleTap proc 시 extraHits=2, DoubleTap roll 안 함.
    // 기능 검증은 chance roll seed-dependent — 본 테스트는 두 필드 모두 set 됐는지만 확인.
    const grav = gravesOf(runWith(['TripleTap', 'DoubleTap2']));
    expect(grav.gravesTripleAttackChance).toBeCloseTo(0.18, 3);
    expect(grav.gravesDoubleAttackChance).toBeCloseTo(0.35, 3);
  });
});

describe('GravesTrait Phase 3B-1 — deterministic ordering', () => {
  it('입력 순서 무관 (RevUp 먼저 vs RevUp2 먼저) → 동일 RevUp2 결과', () => {
    const a = gravesOf(runWith(['RevUp', 'RevUp2']));
    const b = gravesOf(runWith(['RevUp2', 'RevUp']));
    expect(a.gravesRevUpPerStack).toBe(b.gravesRevUpPerStack);
    expect(a.gravesRevUpMaxBonus).toBe(b.gravesRevUpMaxBonus);
    // 같은 seed 라면 시뮬 결과도 동일
    expect(a.totalDamageDealt).toBeCloseTo(b.totalDamageDealt, 1);
  });
});
