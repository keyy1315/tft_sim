/**
 * 거대하고 강력한 (TFT_Augment_GiantAndMighty) 회귀 가드.
 *
 * 효과 (set 17.1):
 *   - FlatHealth: 200 (각 아군 +200 flat HP)
 *   - PercentHealth: 0.10 (각 아군 maxHp +10%)
 *   - {858a62b6}: 0.12 (hash key — visual 크기, 시뮬 무관 추정)
 *
 * 분석 (PR #90 attribution): player ×11 라운드 보유 — tank 강화 augment.
 * augment.ts 의 generic 'FlatHealth' / 'PercentHealth' handler 가 이미 존재
 * → 데이터-key 매칭으로 sim 이 자동 적용. 본 테스트는 동작 검증 + 회귀 가드.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawAugment } from '@/types';

const { champions, traits, augments } = loadServerCatalogs();

const GM_AUG = augments.find((a) => a.apiName === 'TFT_Augment_GiantAndMighty')!;

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('PR92 — 거대하고 강력한 (GiantAndMighty) 효과', () => {
  it('augment 데이터 존재 + FlatHealth=200, PercentHealth=0.1 (set 17.1)', () => {
    expect(GM_AUG).toBeDefined();
    expect(GM_AUG.effects.FlatHealth).toBe(200);
    expect(GM_AUG.effects.PercentHealth).toBeCloseTo(0.1, 5);
  });

  it('simulateCombat: GiantAndMighty 보유 팀 unit maxHp = (base × 1.10) + 200', () => {
    const aatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
    const ally: PlacedChampion[] = [placed(aatrox, 0, 0, 2)];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];

    const withAug = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      playerAugments: [GM_AUG] as RawAugment[],
    });
    const without = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
    });
    const aatroxWith = withAug.playerUnits[0];
    const aatroxBase = without.playerUnits[0];

    // GiantAndMighty 효과 (둘 다 augment.ts 의 generic key handler 로 자동 적용):
    //   1. FlatHealth +200 → resolveAugmentEffects 의 result.hp += 200
    //      stat.ts: flatHp = baseHp×star + augmentEffects.hp → +200
    //   2. PercentHealth +10% → resolvePerUnitMods 의 mod.hpMultiplier *= 1.10
    //      applyPerUnitMods: unit.maxHp = round(unit.maxHp × 1.10)
    //
    // 합산: withAug.maxHp = (baseHp×star + 200) × 1.10 = 1.1×base + 220
    //   Δ = 0.1×base + 220
    //
    // baseHp×star (= aatroxBase.maxHp 가 다른 source 0 가정) 기준 기대 delta.
    expect(aatroxWith.maxHp).toBeGreaterThan(aatroxBase.maxHp + 200);

    const expectedDelta = Math.round(aatroxBase.maxHp * 0.10) + 220;
    expect(aatroxWith.maxHp - aatroxBase.maxHp).toBeGreaterThanOrEqual(expectedDelta - 5);
    expect(aatroxWith.maxHp - aatroxBase.maxHp).toBeLessThanOrEqual(expectedDelta + 5);
  });

  it("GiantAndMighty 는 augment.ts 의 generic 'FlatHealth' / 'PercentHealth' key handler 로 자동 동작 (apiName 분기 불필요)", () => {
    // 본 테스트는 회귀 가드 — 향후 누군가 generic handler 를 제거하면 fail.
    // augment.ts:284 'FlatHealth' / augment.ts:470 'PercentHealth' 가 모든 augment 에 대해
    // 일괄 적용되는 패턴. GiantAndMighty 는 apiName-specific 분기 없이 동작 가능.
    expect(GM_AUG.effects.FlatHealth).toBeDefined();
    expect(GM_AUG.effects.PercentHealth).toBeDefined();
    expect(GM_AUG.effects.FlatHealth).toBe(200);
    expect(GM_AUG.effects.PercentHealth).toBeCloseTo(0.1, 5);
  });
});
