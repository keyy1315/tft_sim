/**
 * 회귀 가드 — 최신상 (TFT17_GravesTrait) 무기고 Phase 3C-2 — ability AOE 4종.
 *
 * 적용 4종 (raw effects):
 *   BlastRadius            IncreasedRadius=1, DamageReductionPerHex=0.5
 *   BlastRadius2           IncreasedRadius=2, DamageReductionPerHex=0.30
 *   BlastRadius3           IncreasedRadius=3, DamageReductionPerHex=0.30
 *   SympatheticDetonation  SympatheticDamageReduction=0.30 (가까운 적 1명 -30%)
 *
 * Phase 3C 마지막. 후속 Phase 3D (VoidCoefficient/Choke/AimAssistant/Heartseeker3 확장).
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

describe('GravesTrait Phase 3C-2 — BlastRadius/2/3 (ability AOE radius+decay)', () => {
  it('BlastRadius → radius=1 / decay=0.5', () => {
    const grav = gravesOf(runWith(['BlastRadius']));
    expect(grav.gravesBlastIncreasedRadius).toBe(1);
    expect(grav.gravesBlastDmgReductionPerHex).toBeCloseTo(0.5, 3);
  });

  it('BlastRadius2 → radius=2 / decay=0.30', () => {
    const grav = gravesOf(runWith(['BlastRadius2']));
    expect(grav.gravesBlastIncreasedRadius).toBe(2);
    expect(grav.gravesBlastDmgReductionPerHex).toBeCloseTo(0.30, 3);
  });

  it('BlastRadius3 → radius=3 / decay=0.30', () => {
    const grav = gravesOf(runWith(['BlastRadius3']));
    expect(grav.gravesBlastIncreasedRadius).toBe(3);
    expect(grav.gravesBlastDmgReductionPerHex).toBeCloseTo(0.30, 3);
  });

  it('BlastRadius + BlastRadius3 → radius=3 (BlastRadius3 항상 override)', () => {
    const grav = gravesOf(runWith(['BlastRadius', 'BlastRadius3']));
    expect(grav.gravesBlastIncreasedRadius).toBe(3);
    expect(grav.gravesBlastDmgReductionPerHex).toBeCloseTo(0.30, 3);
  });

  it('미사용 시 default 0', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesBlastIncreasedRadius).toBe(0);
    expect(grav.gravesBlastDmgReductionPerHex).toBe(0);
  });

  it('BlastRadius3 활성 + 인접 적 다수 → ability splash로 totalDamageDealt 증가', () => {
    // graves(0,0) + Aatrox 다수 (cone 안 + cone 외 인접)
    const enemies = [
      placed(dummyEnemy, 6, 3),  // primary cone target (가장 가까운)
      placed(dummyEnemy, 5, 3),  // primary 인접 (BlastRadius splash)
      placed(dummyEnemy, 6, 2),  // primary 인접
    ];
    const baseDmg = gravesOf(runWith([], enemies)).totalDamageDealt;
    const blastDmg = gravesOf(runWith(['BlastRadius3'], enemies)).totalDamageDealt;
    expect(blastDmg).toBeGreaterThan(baseDmg);
  });
});

describe('GravesTrait Phase 3C-2 — SympatheticDetonation (가까운 적 2nd 폭발)', () => {
  it('SympatheticDetonation → reduction=0.30', () => {
    const grav = gravesOf(runWith(['SympatheticDetonation']));
    expect(grav.gravesSympatheticReduction).toBeCloseTo(0.30, 3);
  });

  it('미사용 시 default 0', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesSympatheticReduction).toBe(0);
  });

  it('SympatheticDetonation 활성 + 인접 적 → 추가 폭발 (totalDamageDealt 증가)', () => {
    const enemies = [
      placed(dummyEnemy, 6, 3),  // primary
      placed(dummyEnemy, 5, 3),  // primary 인접 1hex (sympathy 대상)
    ];
    const baseDmg = gravesOf(runWith([], enemies)).totalDamageDealt;
    const sympDmg = gravesOf(runWith(['SympatheticDetonation'], enemies)).totalDamageDealt;
    expect(sympDmg).toBeGreaterThan(baseDmg);
  });
});

describe('GravesTrait Phase 3C-2 — deterministic ordering', () => {
  it('입력 순서 무관 (BlastRadius 먼저 vs BlastRadius3 먼저) → 동일 결과', () => {
    const a = gravesOf(runWith(['BlastRadius', 'BlastRadius3']));
    const b = gravesOf(runWith(['BlastRadius3', 'BlastRadius']));
    expect(a.gravesBlastIncreasedRadius).toBe(b.gravesBlastIncreasedRadius);
    expect(a.gravesBlastDmgReductionPerHex).toBe(b.gravesBlastDmgReductionPerHex);
    expect(a.totalDamageDealt).toBeCloseTo(b.totalDamageDealt, 1);
  });

  it('4종 모두 입력 시 gravesUpgrades 에 모두 포함', () => {
    const all = ['BlastRadius', 'BlastRadius2', 'BlastRadius3', 'SympatheticDetonation'];
    const grav = gravesOf(runWith(all));
    for (const id of all) {
      expect(grav.gravesUpgrades).toContain(id);
    }
  });

  it('BlastRadius + SympatheticDetonation 동시 활성 → 두 effect 모두 set', () => {
    const grav = gravesOf(runWith(['BlastRadius2', 'SympatheticDetonation']));
    expect(grav.gravesBlastIncreasedRadius).toBe(2);
    expect(grav.gravesSympatheticReduction).toBeCloseTo(0.30, 3);
  });
});
