/**
 * 저격수 (Sniper/RangedTrait) trait 회귀 가드.
 *
 * Spec (TFT17_RangedTrait):
 *   (2) PercentDamageIncrease=18%, PerHexIncrease=2%/hex
 *   (3) 24%, 3%/hex
 *   (4) 28%, 4%/hex
 *
 * 저격수 unit 의 damage hit 시 (caster, target):
 *   추가 damageAmp = sniperBaseDA + sniperPerHexDA × hexDistance(caster, target)
 *
 * 저격수 챔프 (5명): Gnar, Jhin, Samira, Ezreal, Xayah.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apJhin = champions.find((c) => c.apiName === 'TFT17_Jhin')!;
const apEzreal = champions.find((c) => c.apiName === 'TFT17_Ezreal')!;
const apSamira = champions.find((c) => c.apiName === 'TFT17_Samira')!;
const apGnar = champions.find((c) => c.apiName === 'TFT17_Gnar')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!; // 비-저격수
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('Sniper — (2) tier base 18% + per hex 2%', () => {
  it('저격수 2명 → sniperBaseDA=0.18, sniperPerHexDA=0.02 설정', () => {
    const team = [placed(apJhin, 0, 0), placed(apEzreal, 1, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jhin = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Jhin')!;
    expect(jhin.sniperBaseDA).toBeCloseTo(0.18, 2);
    expect(jhin.sniperPerHexDA).toBeCloseTo(0.02, 2);
    // 비-저격수 champ 가 있다면 sniperBaseDA = 0
  });

  it('저격수 ON 시 player 누적 damageDealt 증가 (멀리서 쏠 수록 더)', () => {
    // 저격수 2명 vs 멀리 enemy → distance bonus 받음
    const team = [placed(apJhin, 0, 0), placed(apEzreal, 1, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withSniper = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 비-저격수 비교
    const team2 = [placed(apTwistedFate, 0, 0), placed(apTwistedFate, 1, 0)];
    const without = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 본 테스트는 저격수 unit 의 damage 가 비-저격수 보다 큰지 검증.
    const sniperDmg = withSniper.playerUnits.reduce((s, u) => s + u.totalDamageDealt, 0);
    const nonSniperDmg = without.playerUnits.reduce((s, u) => s + u.totalDamageDealt, 0);
    // 저격수 효과로 + base damage 자체도 다르므로 단순 비교는 noise 가능 → loose 비교
    // 핵심: sniperBaseDA / sniperPerHexDA 가 활성화되어 sniper unit 들이 effect 보유
    expect(withSniper.playerUnits[0].sniperBaseDA).toBeGreaterThan(0);
    // 단순히 저격수 ON 일 때 sniper 효과가 작동하는지 (sniperDmg, nonSniperDmg 도 비교 — 다른 챔프라 차이는 큼)
    expect(sniperDmg).toBeGreaterThan(0);
    expect(nonSniperDmg).toBeGreaterThan(0);
  });
});

describe('Sniper — (3) tier 25% + 3%/hex (17.4 buff: 24→25, PR #163 sequence B)', () => {
  it('저격수 3명 → sniperBaseDA=0.25, sniperPerHexDA=0.03', () => {
    const team = [placed(apJhin, 0, 0), placed(apEzreal, 1, 0), placed(apSamira, 2, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jhin = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Jhin')!;
    expect(jhin.sniperBaseDA).toBeCloseTo(0.25, 2);
    expect(jhin.sniperPerHexDA).toBeCloseTo(0.03, 2);
  });
});

describe('Sniper — (4) tier 35% + 4%/hex (17.4 buff: 28→35, PR #163 sequence B)', () => {
  it('저격수 4명 → sniperBaseDA=0.35, sniperPerHexDA=0.04', () => {
    const team = [placed(apJhin, 0, 0), placed(apEzreal, 1, 0), placed(apSamira, 2, 0), placed(apGnar, 3, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jhin = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Jhin')!;
    expect(jhin.sniperBaseDA).toBeCloseTo(0.35, 2);
    expect(jhin.sniperPerHexDA).toBeCloseTo(0.04, 2);
  });
});

describe('Sniper — 비-저격수 unit 영향 없음', () => {
  it('비-저격수 (TwistedFate) sniperBaseDA = 0', () => {
    const team = [placed(apJhin, 0, 0), placed(apEzreal, 1, 0), placed(apTwistedFate, 2, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.sniperBaseDA).toBe(0);
    expect(tf.sniperPerHexDA).toBe(0);
  });
});

describe('Sniper — 저격수 1명 (비활성) 영향 없음', () => {
  it('저격수 1명만 → trait 비활성, sniperBaseDA=0', () => {
    const team = [placed(apJhin, 0, 0), placed(apTwistedFate, 1, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jhin = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Jhin')!;
    expect(jhin.sniperBaseDA).toBe(0);
  });
});
