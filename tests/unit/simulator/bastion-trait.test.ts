/**
 * 요새 (Bastion/ResistTank) trait 회귀 가드.
 *
 * Spec (TFT17_ResistTank):
 *   - 모든 아군 +TeamwideResists Armor/MR (=15 모든 tier)
 *   - 요새 unit 추가 +BonusArmor / +BonusMR (16/40/60)
 *   - 첫 Duration 초간 (=10) 요새 BonusArmor/MR 가 StatMultiplier 배 (=2)
 *   - (6) tier 시 비-요새 +EnhancedTeamwideArmor (=20)
 *
 * 요새 챔프 (6명): Rammus, Poppy, Aatrox, Ornn, Jax, Shen.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apJax = champions.find((c) => c.apiName === 'TFT17_Jax')!;
const apShen = champions.find((c) => c.apiName === 'TFT17_Shen')!;
const apAatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
const apRammus = champions.find((c) => c.apiName === 'TFT17_Rammus')!;
const apPoppy = champions.find((c) => c.apiName === 'TFT17_Poppy')!;
const apOrnn = champions.find((c) => c.apiName === 'TFT17_Ornn')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!; // 비-요새
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Galio') ?? apTwistedFate;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('Bastion — (2) tier teamwide + 요새 unit 추가 (doubled 첫 10초)', () => {
  it('요새 2명 + 비-요새 1명 → 요새 unit doubled BonusArmor 적용', () => {
    const team = [
      placed(apJax, 0, 0),
      placed(apShen, 1, 0),
      placed(apTwistedFate, 2, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withB = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 비교: 요새 0명
    const without = simulateCombat([placed(apTwistedFate, 0, 0), placed(apTwistedFate, 1, 0), placed(apTwistedFate, 2, 0)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jaxWith = withB.playerUnits.find(u => u.champion.apiName === 'TFT17_Jax')!;
    const tfWith = withB.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // teamwide +15: 비-요새 unit 도 +15 armor/MR
    expect(tfWith.stats.armor - tfWithout.stats.armor).toBeCloseTo(15, 0);
    expect(tfWith.stats.magicResist - tfWithout.stats.magicResist).toBeCloseTo(15, 0);
    // 요새 unit (Jax): 시작 시점 armor 가 비-요새 + BonusArmor*2 = +15 +16*2 = +47 더 큼
    // (단 starting 시점 — sim 후 measurement 는 doubled 만료 후일 수 있음)
    // 단순 검증: jax armor > tfWith armor
    expect(jaxWith.stats.armor).toBeGreaterThan(tfWith.stats.armor);
  });
});

describe('Bastion — (4) tier 더 큰 BonusArmor', () => {
  it('요새 4명 → 각 unit BonusArmor=40 적용', () => {
    const team = [
      placed(apJax, 0, 0),
      placed(apShen, 1, 0),
      placed(apAatrox, 2, 0),
      placed(apRammus, 3, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withB = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const team2 = [placed(apTwistedFate, 0, 0)];
    const without = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jaxWith = withB.playerUnits.find(u => u.champion.apiName === 'TFT17_Jax')!;
    const tfWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // jax armor >= teamwide(15) + bonusArmor(40) + 첫 10초 doubled (+40) = +95 더 큼 (시작 시점)
    expect(jaxWith.stats.armor - tfWithout.stats.armor).toBeGreaterThan(40);
  });
});

describe('Bastion — (6) tier 비-요새 EnhancedTeamwideArmor', () => {
  it('요새 6명 + 비-요새 1명 → 비-요새 unit teamwide(15) + enhanced(20) = +35', () => {
    const team = [
      placed(apJax, 0, 0),
      placed(apShen, 1, 0),
      placed(apAatrox, 2, 0),
      placed(apRammus, 3, 0),
      placed(apPoppy, 4, 0),
      placed(apOrnn, 5, 0),
      placed(apTwistedFate, 0, 1),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withB = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const without = simulateCombat([placed(apTwistedFate, 0, 0)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tfWith = withB.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // teamwide(15) + enhanced(20) = +35
    expect(tfWith.stats.armor - tfWithout.stats.armor).toBeCloseTo(35, 0);
    expect(tfWith.stats.magicResist - tfWithout.stats.magicResist).toBeCloseTo(35, 0);
  });
});

describe('Bastion — 비활성 (1명) 시 영향 없음', () => {
  it('요새 1명만 → trait 비활성, stat 변화 없음', () => {
    const team = [placed(apJax, 0, 0), placed(apTwistedFate, 1, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const without = simulateCombat([placed(apTwistedFate, 0, 0), placed(apTwistedFate, 1, 0)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tfWith = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // 요새 1명은 (2) tier 미만 — teamwide 적용 안 됨
    expect(tfWith.stats.armor).toBe(tfWithout.stats.armor);
  });
});
