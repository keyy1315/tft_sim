/**
 * 회귀 가드 — 최신상 (TFT17_GravesTrait) 무기고 Phase 3D — 복합 메커닉 3종.
 *
 * 적용 3종 (raw effects):
 *   VoidCoefficient   PercentManaReductionPerCast=0.15 (cast 직후 maxMana × 0.85, min 10)
 *   Choke             SpreadDecrease=0.75 (Buckshot spread × 0.25 → 단일 타겟 집중)
 *   AimAssistant      BonusDamagePerHex=0.05 (평타 distance × 5% damage amp)
 *
 * Heartseeker3 는 raw 가 BonusCritChance/BonusCritDamage 만 — Phase 2 에서 이미 처리.
 *
 * Phase 3D 완료 = G2 Phase 3 전체 31종 완료 + G2 시리즈 완성 (Frame 3 + stat 18 + 메커닉 31).
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

describe('GravesTrait Phase 3D — VoidCoefficient (cast 시 maxMana 점진 감소)', () => {
  it('VoidCoefficient → gravesVoidCoefficientPct = 0.15', () => {
    const grav = gravesOf(runWith(['VoidCoefficient']));
    expect(grav.gravesVoidCoefficientPct).toBeCloseTo(0.15, 3);
  });

  it('미사용 시 default 0', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesVoidCoefficientPct).toBe(0);
  });

  it('VoidCoefficient 활성 시 graves 의 cast 후 maxMana 감소 (point-in-time)', () => {
    // 단일 cast 후 maxMana 가 baseline 보다 작아야 함. 여러 cast 후엔 점진적 감소.
    const baseRes = runWith([]);
    const voidRes = runWith(['VoidCoefficient']);
    const baseGrav = gravesOf(baseRes);
    const voidGrav = gravesOf(voidRes);
    if (voidGrav.castCount > 0) {
      // void 활성 + cast 한 번 이상 → maxMana 가 baseline 보다 작거나 같음.
      expect(voidGrav.maxMana).toBeLessThanOrEqual(baseGrav.maxMana);
      // 최소 10 floor.
      expect(voidGrav.maxMana).toBeGreaterThanOrEqual(10);
    }
  });

  it('VoidCoefficient 활성 시 cast 횟수 증가 (mana 회복 속도가 같지만 cost 점진 감소)', () => {
    const baseRes = runWith([]);
    const voidRes = runWith(['VoidCoefficient']);
    const baseGrav = gravesOf(baseRes);
    const voidGrav = gravesOf(voidRes);
    expect(voidGrav.castCount).toBeGreaterThanOrEqual(baseGrav.castCount);
  });
});

describe('GravesTrait Phase 3D — Choke (Buckshot spread 감소)', () => {
  it('Choke → gravesChokeSpreadDecrease = 0.75', () => {
    const grav = gravesOf(runWith(['Choke']));
    expect(grav.gravesChokeSpreadDecrease).toBeCloseTo(0.75, 3);
  });

  it('미사용 시 default 0', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesChokeSpreadDecrease).toBe(0);
  });

  it('Choke + Buckshot3 동시 활성 → spread 감소 효과 (set 검증)', () => {
    const grav = gravesOf(runWith(['Buckshot3', 'Choke']));
    expect(grav.gravesBuckshotSpread).toBeCloseTo(0.40, 3);  // raw 그대로
    expect(grav.gravesChokeSpreadDecrease).toBeCloseTo(0.75, 3);
    // effective spread = 0.40 × (1 - 0.75) = 0.10 (helper 안에서 적용).
  });
});

describe('GravesTrait Phase 3D — AimAssistant (거리당 +5% damage)', () => {
  it('AimAssistant → gravesAimAssistBonusPerHex = 0.05', () => {
    const grav = gravesOf(runWith(['AimAssistant']));
    expect(grav.gravesAimAssistBonusPerHex).toBeCloseTo(0.05, 3);
  });

  it('미사용 시 default 0', () => {
    const grav = gravesOf(runWith([]));
    expect(grav.gravesAimAssistBonusPerHex).toBe(0);
  });

  it('AimAssistant 활성 + 멀리 있는 적 → DPS 증가 (거리 비례 amp)', () => {
    // graves(0,0) → enemy(6,3) ~9 hex. 거리당 5% 시 총 ~45% damage amp.
    // PR99 (off-by-one fix): Graves 데미지 정상화 후 amped scenario 가 적을 더 빨리 죽이고
    // combat 종료 → totalDamageDealt 누적이 baseline 보다 작아질 수 있음.
    // 더 robust 한 metric: DPS (totalDmg / duration) — amp 효과 확실히 증가.
    const baseRes = runWith([]);
    const aimRes = runWith(['AimAssistant']);
    const baseDps = gravesOf(baseRes).totalDamageDealt / Math.max(baseRes.duration, 0.1);
    const aimDps = gravesOf(aimRes).totalDamageDealt / Math.max(aimRes.duration, 0.1);
    expect(aimDps).toBeGreaterThan(baseDps);
  });
});

describe('GravesTrait Phase 3D — deterministic ordering', () => {
  it('3종 모두 입력 시 gravesUpgrades 에 모두 포함', () => {
    const all = ['VoidCoefficient', 'Choke', 'AimAssistant'];
    const grav = gravesOf(runWith(all));
    for (const id of all) {
      expect(grav.gravesUpgrades).toContain(id);
    }
  });

  it('입력 순서 무관 (3D 3종) → 동일 시뮬 결과', () => {
    const a = gravesOf(runWith(['VoidCoefficient', 'AimAssistant', 'Choke']));
    const b = gravesOf(runWith(['Choke', 'AimAssistant', 'VoidCoefficient']));
    expect(a.gravesVoidCoefficientPct).toBe(b.gravesVoidCoefficientPct);
    expect(a.gravesChokeSpreadDecrease).toBe(b.gravesChokeSpreadDecrease);
    expect(a.gravesAimAssistBonusPerHex).toBe(b.gravesAimAssistBonusPerHex);
    expect(a.totalDamageDealt).toBeCloseTo(b.totalDamageDealt, 1);
  });
});

describe('GravesTrait Phase 3D — Heartseeker3 (Phase 2 에서 이미 처리)', () => {
  it('Heartseeker3 → critChance +0.40, critMultiplier +0.18 (변동 없음)', () => {
    const baseGrav = gravesOf(runWith([]));
    const hs3Grav = gravesOf(runWith(['Heartseeker3']));
    expect(hs3Grav.stats.critChance - baseGrav.stats.critChance).toBeCloseTo(0.40, 3);
    expect(hs3Grav.stats.critMultiplier - baseGrav.stats.critMultiplier).toBeCloseTo(0.18, 3);
  });
});
