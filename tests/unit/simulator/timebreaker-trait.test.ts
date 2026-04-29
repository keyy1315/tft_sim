/**
 * 시간 균열자 (Timebreaker/Pulsefire) trait 회귀 가드.
 *
 * Spec (TFT17_Timebreaker):
 *   (2)/(3)/(4) 모두 모든 아군 +AS=15% (AttackSpeed=0.15)
 *   (3) 추가로 게임-level reroll/XP bonus ({aaae13a0}=1) — 시뮬 외
 *   (4) 시간 균열자 unit 추가 +AS=50% (TimebreakerAdditionalAS=0.50)
 *
 * 시간 균열자 챔프 (4명): Riven, Milio, Ezreal, Pantheon.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apRiven = champions.find((c) => c.apiName === 'TFT17_Riven')!;
const apMilio = champions.find((c) => c.apiName === 'TFT17_Milio')!;
const apEzreal = champions.find((c) => c.apiName === 'TFT17_Ezreal')!;
const apPantheon = champions.find((c) => c.apiName === 'TFT17_Pantheon')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('Timebreaker — (2) tier 활성 시 teamwide +15% AS', () => {
  it('시간 균열자 2명 + 비-시간균열자 → 비-시간균열자 unit AS > inactive(1명) baseline', () => {
    const teamActive = [
      placed(apRiven, 0, 0),
      placed(apMilio, 1, 0),
      placed(apTwistedFate, 2, 0),
    ];
    const teamInactive = [placed(apTwistedFate, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withTrait = simulateCombat(teamActive, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const without = simulateCombat(teamInactive, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tfWith = withTrait.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // Timebreaker active (2명+) → TwistedFate AS 가 inactive baseline 보다 크다.
    expect(tfWith.stats.attackSpeed).toBeGreaterThan(tfWithout.stats.attackSpeed);
  });
});

describe('Timebreaker — (4) tier 시간 균열자 추가 +50% AS', () => {
  it('시간 균열자 4명 → 시간 균열자 unit AS 가 (3) tier 보다 크다', () => {
    const team4 = [
      placed(apRiven, 0, 0),
      placed(apMilio, 1, 0),
      placed(apEzreal, 2, 0),
      placed(apPantheon, 3, 0),
    ];
    const team3 = [
      placed(apRiven, 0, 0),
      placed(apMilio, 1, 0),
      placed(apEzreal, 2, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result4 = simulateCombat(team4, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result3 = simulateCombat(team3, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const rivenT4 = result4.playerUnits.find(u => u.champion.apiName === 'TFT17_Riven')!;
    const rivenT3 = result3.playerUnits.find(u => u.champion.apiName === 'TFT17_Riven')!;
    // (4) tier 시간 균열자 unit 추가 +50% → t4 AS > t3 AS
    expect(rivenT4.stats.attackSpeed).toBeGreaterThan(rivenT3.stats.attackSpeed);
  });
});

describe('Timebreaker — 비활성 (1명) 시 AS bonus 없음', () => {
  it('시간 균열자 1명 → trait inactive, AS bonus 미적용', () => {
    const team1 = [placed(apRiven, 0, 0), placed(apTwistedFate, 1, 0)];
    const team2 = [placed(apRiven, 0, 0), placed(apMilio, 1, 0), placed(apTwistedFate, 2, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result1 = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result2 = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 같은 TwistedFate 비교: 1명일 때 inactive (bonus 0%), 2명일 때 active (+15%)
    const tf1 = result1.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tf2 = result2.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf2.stats.attackSpeed).toBeGreaterThan(tf1.stats.attackSpeed);
  });
});
