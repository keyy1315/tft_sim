/**
 * 정령족 (Astronaut/Meeple) trait 회귀 가드.
 *
 * Spec (TFT17_Astronaut):
 *   (3) BonusHealth=100, Meeps=2
 *   (5) 400, 3
 *   (7) 400, 4 + Cloning Slot (게임-level, sim 외)
 *   (10) 500, 6 + Four Meeplords (특수)
 *
 * 본 PR 은 BonusHealth flat 가산만 — Meeps 메커니즘은 챔프별 ability 에서
 * 다르게 작동 (Bard/Rammus/Poppy/Corki/Veigar/Bard 등) → 후속 PR.
 *
 * 정령족 챔프 (8명): Bard, Gnar, Fizz, Rammus, Poppy, Corki, Veigar, IvernMinion.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apBard = champions.find((c) => c.apiName === 'TFT17_Bard')!;
const apGnar = champions.find((c) => c.apiName === 'TFT17_Gnar')!;
const apFizz = champions.find((c) => c.apiName === 'TFT17_Fizz')!;
const apRammus = champions.find((c) => c.apiName === 'TFT17_Rammus')!;
const apPoppy = champions.find((c) => c.apiName === 'TFT17_Poppy')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!; // 비-정령족
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('Astronaut — (3) tier +100 HP', () => {
  it('정령족 3명 → 정령족 unit maxHp +100', () => {
    const team = [placed(apBard, 0, 0), placed(apGnar, 1, 0), placed(apFizz, 2, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withTrait = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 비교: 정령족 1명 (비활성)
    const team1 = [placed(apBard, 0, 0), placed(apTwistedFate, 1, 0), placed(apTwistedFate, 2, 0)];
    const without = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const bardWith = withTrait.playerUnits.find(u => u.champion.apiName === 'TFT17_Bard')!;
    const bardWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_Bard')!;
    expect(bardWith.maxHp - bardWithout.maxHp).toBeCloseTo(100, 0);
  });
});

describe('Astronaut — (5) tier +400 HP', () => {
  it('정령족 5명 → 정령족 unit maxHp +400', () => {
    const team = [
      placed(apBard, 0, 0),
      placed(apGnar, 1, 0),
      placed(apFizz, 2, 0),
      placed(apRammus, 3, 0),
      placed(apPoppy, 4, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withTrait = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const team1 = [placed(apBard, 0, 0)];
    const without = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const bardWith = withTrait.playerUnits.find(u => u.champion.apiName === 'TFT17_Bard')!;
    const bardWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_Bard')!;
    expect(bardWith.maxHp - bardWithout.maxHp).toBeCloseTo(400, 0);
  });
});

describe('Astronaut — 비-정령족 unit 영향 없음', () => {
  it('비-정령족 (TwistedFate) maxHp 변화 없음', () => {
    const team = [
      placed(apBard, 0, 0),
      placed(apGnar, 1, 0),
      placed(apFizz, 2, 0),
      placed(apTwistedFate, 3, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withTrait = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const team1 = [placed(apTwistedFate, 0, 0)];
    const without = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tfWith = withTrait.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tfWith.maxHp).toBe(tfWithout.maxHp);
  });
});

describe('Astronaut — 비활성 (1명) 영향 없음', () => {
  it('정령족 1명 → trait 비활성, maxHp 변화 없음', () => {
    const team = [placed(apBard, 0, 0), placed(apTwistedFate, 1, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const team1 = [placed(apBard, 0, 0)];
    const without = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const bardWith = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Bard')!;
    const bardWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_Bard')!;
    expect(bardWith.maxHp).toBe(bardWithout.maxHp);
  });
});
