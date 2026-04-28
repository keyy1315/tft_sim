/**
 * 싸움꾼 (Brawler/HPTank) trait 회귀 가드.
 *
 * Spec (TFT17_HPTank):
 *   (2)/(4)/(6) 모두 모든 아군 +5% maxHP (TeamwideBonus=0.05)
 *   추가로 싸움꾼 unit 본인:
 *     (2) +20% (HealthBonus=0.20)
 *     (4) +40%
 *     (6) +60%
 *
 * 싸움꾼 챔프 (7명): Maokai, Urgot, Gragas, Chogath, TahmKench, RekSai, Pantheon.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apMaokai = champions.find((c) => c.apiName === 'TFT17_Maokai')!;
const apGragas = champions.find((c) => c.apiName === 'TFT17_Gragas')!;
const apChogath = champions.find((c) => c.apiName === 'TFT17_Chogath')!;
const apTahmKench = champions.find((c) => c.apiName === 'TFT17_TahmKench')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('Brawler — (2) tier teamwide +5% maxHp + 싸움꾼 +20%', () => {
  it('싸움꾼 2명 → 비-싸움꾼 maxHp 가 +5%, 싸움꾼 maxHp 가 +25% (1.05 × 1.20 = 1.26)', () => {
    const teamActive = [
      placed(apMaokai, 0, 0),
      placed(apGragas, 1, 0),
      placed(apTwistedFate, 2, 0),
    ];
    const teamInactive = [
      placed(apMaokai, 0, 0),
      placed(apTwistedFate, 1, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withTrait = simulateCombat(teamActive, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const without = simulateCombat(teamInactive, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tfWith = withTrait.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const maokaiWith = withTrait.playerUnits.find(u => u.champion.apiName === 'TFT17_Maokai')!;
    const maokaiWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_Maokai')!;

    // TwistedFate (비-싸움꾼) maxHp 비율 ≈ 1.05 (teamwide 만)
    expect(tfWith.maxHp / tfWithout.maxHp).toBeCloseTo(1.05, 2);
    // Maokai (싸움꾼) maxHp 비율 ≈ 1.05 + 0.20 = 1.25
    expect(maokaiWith.maxHp / maokaiWithout.maxHp).toBeCloseTo(1.25, 2);
  });
});

describe('Brawler — (4) tier 싸움꾼 +40% HealthBonus', () => {
  it('싸움꾼 4명 → 본인 maxHp 비율 ≈ 1.45 (1.05 + 0.40)', () => {
    const team4 = [
      placed(apMaokai, 0, 0),
      placed(apGragas, 1, 0),
      placed(apChogath, 2, 0),
      placed(apTahmKench, 3, 0),
    ];
    const teamInactive = [placed(apMaokai, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result4 = simulateCombat(team4, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const without = simulateCombat(teamInactive, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const maokaiT4 = result4.playerUnits.find(u => u.champion.apiName === 'TFT17_Maokai')!;
    const maokaiBaseline = without.playerUnits.find(u => u.champion.apiName === 'TFT17_Maokai')!;
    expect(maokaiT4.maxHp / maokaiBaseline.maxHp).toBeCloseTo(1.45, 2);
  });
});

describe('Brawler — 비활성 (1명) 시 효과 없음', () => {
  it('싸움꾼 1명 → trait inactive, maxHp 변화 없음', () => {
    const team1 = [
      placed(apMaokai, 0, 0),
      placed(apTwistedFate, 1, 0),
    ];
    const team2 = [
      placed(apMaokai, 0, 0),
      placed(apGragas, 1, 0),
      placed(apTwistedFate, 2, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result1 = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result2 = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf1 = result1.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tf2 = result2.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // 1명일 때 inactive, 2명일 때 active(+5%) → tf2 가 더 큼
    expect(tf2.maxHp).toBeGreaterThan(tf1.maxHp);
    expect(tf2.maxHp / tf1.maxHp).toBeCloseTo(1.05, 2);
  });
});
