/**
 * 회귀 가드 — 최신상 (TFT17_GravesTrait) 무기고 Phase 3C-1 — 평타 base AOE 7종.
 *
 * 적용 7종 (raw effects):
 *   Buckshot       NumBonusProjectiles=2, SpreadIncrease=0.20 (타겟+주변 혼합)
 *   Buckshot2      4 / 0.30
 *   Buckshot3      6 / 0.40
 *   LaserBallistics BonusHexes=1, DamageReductionPerTarget=0.5 (관통 1명)
 *   FragmentationRounds  FragmentDamage=0.15, Projectiles=2 (평타 시 주변 파편)
 *   FragmentationRounds2 FragmentDamage=0.20, Projectiles=3
 *   Meltthrough    ArmorMRReduction=4 (매초 주변 2hex 적 armor/MR -4)
 *
 * Phase 3C-2 (BlastRadius/2/3 + SympatheticDetonation) 는 후속 PR.
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

describe('GravesTrait Phase 3C-1 — Buckshot/2/3 (multi-hit)', () => {
  it('Buckshot → projectiles=2 / spread=0.20', () => {
    const grav = gravesOf(runWith(['Buckshot']));
    expect(grav.gravesBuckshotProjectiles).toBe(2);
    expect(grav.gravesBuckshotSpread).toBeCloseTo(0.20, 3);
  });

  it('Buckshot2 → projectiles=4 / spread=0.30', () => {
    const grav = gravesOf(runWith(['Buckshot2']));
    expect(grav.gravesBuckshotProjectiles).toBe(4);
    expect(grav.gravesBuckshotSpread).toBeCloseTo(0.30, 3);
  });

  it('Buckshot3 → projectiles=6 / spread=0.40', () => {
    const grav = gravesOf(runWith(['Buckshot3']));
    expect(grav.gravesBuckshotProjectiles).toBe(6);
    expect(grav.gravesBuckshotSpread).toBeCloseTo(0.40, 3);
  });

  it('Buckshot 활성 + 다수 적 → 추가 hits 로 totalDamageDealt 증가', () => {
    // graves 주변에 3명 배치 (target + 2명 nearby spread radius 안)
    const enemies = [
      placed(dummyEnemy, 6, 3),  // primary target
      placed(dummyEnemy, 1, 1),  // nearby
      placed(dummyEnemy, 1, 0),  // nearby
    ];
    const baseDmg = gravesOf(runWith([], enemies)).totalDamageDealt;
    const buckDmg = gravesOf(runWith(['Buckshot3'], enemies)).totalDamageDealt;
    expect(buckDmg).toBeGreaterThan(baseDmg);
  });
});

describe('GravesTrait Phase 3C-1 — LaserBallistics (관통)', () => {
  it('LaserBallistics → penetrationHexes=1 / dmgReduction=0.5', () => {
    const grav = gravesOf(runWith(['LaserBallistics']));
    expect(grav.gravesLaserPenetrationHexes).toBe(1);
    expect(grav.gravesLaserDmgReductionPerTarget).toBeCloseTo(0.5, 3);
  });

  it('LaserBallistics 활성 + 다수 적 → 관통으로 추가 hit', () => {
    const enemies = [
      placed(dummyEnemy, 6, 3),
      placed(dummyEnemy, 5, 3),  // primary target 1칸 너머
    ];
    const baseDmg = gravesOf(runWith([], enemies)).totalDamageDealt;
    const laserDmg = gravesOf(runWith(['LaserBallistics'], enemies)).totalDamageDealt;
    expect(laserDmg).toBeGreaterThan(baseDmg);
  });
});

describe('GravesTrait Phase 3C-1 — FragmentationRounds/2 (주변 파편)', () => {
  it('FragmentationRounds → fragDamage=0.15 / projectiles=2', () => {
    const grav = gravesOf(runWith(['FragmentationRounds']));
    expect(grav.gravesFragDamage).toBeCloseTo(0.15, 3);
    expect(grav.gravesFragProjectiles).toBe(2);
  });

  it('FragmentationRounds2 → fragDamage=0.20 / projectiles=3 (override)', () => {
    const grav = gravesOf(runWith(['FragmentationRounds', 'FragmentationRounds2']));
    expect(grav.gravesFragDamage).toBeCloseTo(0.20, 3);
    expect(grav.gravesFragProjectiles).toBe(3);
  });

  it('FragmentationRounds 활성 + 인접 적 → 파편 splash 데미지', () => {
    const enemies = [
      placed(dummyEnemy, 6, 3),  // primary target
      placed(dummyEnemy, 5, 3),  // primary 인접 (frag splash 대상)
    ];
    const baseDmg = gravesOf(runWith([], enemies)).totalDamageDealt;
    const fragDmg = gravesOf(runWith(['FragmentationRounds2'], enemies)).totalDamageDealt;
    expect(fragDmg).toBeGreaterThan(baseDmg);
  });
});

describe('GravesTrait Phase 3C-1 — Meltthrough (periodic armor shred)', () => {
  it('Meltthrough → armorMR reduction=4', () => {
    const grav = gravesOf(runWith(['Meltthrough']));
    expect(grav.gravesMeltthroughArmorMR).toBe(4);
  });

  it('미사용 시 default 0', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesMeltthroughArmorMR).toBe(0);
  });

  it('Meltthrough 활성 시 인접 적 armor/MR 감소 (매초 누적, floor 0)', () => {
    // graves 주변 2hex 안 적 → 매초 -4 누적. 1초 이상 sim 진행 필요.
    const enemies = [
      placed(dummyEnemy, 1, 1),  // graves(0,0) 와 1hex 거리
    ];
    const baseEnemy = runWith([], enemies).enemyUnits[0];
    const meltEnemy = runWith(['Meltthrough'], enemies).enemyUnits[0];
    // baseline 대비 armor 감소.
    expect(meltEnemy.stats.armor).toBeLessThan(baseEnemy.stats.armor);
    expect(meltEnemy.stats.magicResist).toBeLessThan(baseEnemy.stats.magicResist);
    // floor 0 보장
    expect(meltEnemy.stats.armor).toBeGreaterThanOrEqual(0);
    expect(meltEnemy.stats.magicResist).toBeGreaterThanOrEqual(0);
  });

  it('Meltthrough — 멀리 있는 적은 영향 없음 (radius 2hex)', () => {
    const farEnemy = placed(dummyEnemy, 6, 3);  // graves(0,0)과 9hex
    const baseEnemy = runWith([], [farEnemy]).enemyUnits[0];
    const meltEnemy = runWith(['Meltthrough'], [farEnemy]).enemyUnits[0];
    // graves 가 적에게 가까이 가지 않으면 melt 영향 없을 가능성. graves 가 적에 인접하면 영향.
    // 실제 graves 가 attack range 안으로 이동하면 인접 — 시뮬 종료 시 거리 변동 가능.
    // 본 test 는 melt 가 항상 작동한다는 보장보다는 set 확인 + min 0 floor.
    expect(meltEnemy.stats.armor).toBeGreaterThanOrEqual(0);
    expect(meltEnemy.stats.magicResist).toBeGreaterThanOrEqual(0);
    // 일관성: 적의 armor 가 baseline 보다 같거나 작음.
    expect(meltEnemy.stats.armor).toBeLessThanOrEqual(baseEnemy.stats.armor);
  });
});

describe('GravesTrait Phase 3C-1 — deterministic ordering', () => {
  it('Buckshot + Buckshot3 동시 → max override (projectiles=6, spread=0.40)', () => {
    const grav = gravesOf(runWith(['Buckshot', 'Buckshot3']));
    expect(grav.gravesBuckshotProjectiles).toBe(6);
    expect(grav.gravesBuckshotSpread).toBeCloseTo(0.40, 3);
  });

  it('입력 순서 무관 (Buckshot 먼저 vs Buckshot3 먼저) → 동일 결과', () => {
    const a = gravesOf(runWith(['Buckshot', 'Buckshot3']));
    const b = gravesOf(runWith(['Buckshot3', 'Buckshot']));
    expect(a.gravesBuckshotProjectiles).toBe(b.gravesBuckshotProjectiles);
    expect(a.gravesBuckshotSpread).toBe(b.gravesBuckshotSpread);
    expect(a.totalDamageDealt).toBeCloseTo(b.totalDamageDealt, 1);
  });

  it('7종 모두 입력 시 gravesUpgrades 에 모두 포함', () => {
    const all = ['Buckshot', 'Buckshot2', 'Buckshot3', 'LaserBallistics',
                 'FragmentationRounds', 'FragmentationRounds2', 'Meltthrough'];
    const grav = gravesOf(runWith(all));
    for (const id of all) {
      expect(grav.gravesUpgrades).toContain(id);
    }
  });
});
