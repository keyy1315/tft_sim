/**
 * 태고족 (Primordian) trait 회귀 가드 — (3) tier DamageMultiplier=1.45.
 *
 * Spec (TFT17_Primordian):
 *   (2) DamageMultiplier=1 (placeholder), DamageTakenPercentModifier=0.08, 군체 유충 spawn — 후속 PR
 *   (3) DamageMultiplier=1.45 → 태고족 unit damageAmp +0.45 — 본 PR 범위
 *
 * 태고족 챔프 (3명): Briar, Belveth, RekSai.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apBriar = champions.find((c) => c.apiName === 'TFT17_Briar')!;
const apBelveth = champions.find((c) => c.apiName === 'TFT17_Belveth')!;
const apRekSai = champions.find((c) => c.apiName === 'TFT17_RekSai')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('Primordian — (3) tier DamageMultiplier=1.45 → damageAmp +0.45', () => {
  it('태고족 3명 → Briar damageAmp 가 +0.45 (vs (2) tier baseline)', () => {
    const team3 = [
      placed(apBriar, 0, 0),
      placed(apBelveth, 1, 0),
      placed(apRekSai, 2, 0),
    ];
    const team2 = [
      placed(apBriar, 0, 0),
      placed(apBelveth, 1, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result3 = simulateCombat(team3, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result2 = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const briar3 = result3.playerUnits.find(u => u.champion.apiName === 'TFT17_Briar')!;
    const briar2 = result2.playerUnits.find(u => u.champion.apiName === 'TFT17_Briar')!;
    expect(briar3.damageAmp - briar2.damageAmp).toBeCloseTo(0.45, 2);
  });
});

describe('Primordian — (2) tier DamageMultiplier=1 (placeholder) → damageAmp 변화 없음', () => {
  it('태고족 2명 → Briar damageAmp 가 1명 baseline 과 동일', () => {
    const team2 = [
      placed(apBriar, 0, 0),
      placed(apBelveth, 1, 0),
    ];
    const team1 = [placed(apBriar, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result2 = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result1 = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const briar2 = result2.playerUnits.find(u => u.champion.apiName === 'TFT17_Briar')!;
    const briar1 = result1.playerUnits.find(u => u.champion.apiName === 'TFT17_Briar')!;
    // (2) tier DamageMultiplier=1 → ampDelta=0 → 변화 없음
    expect(briar2.damageAmp).toBeCloseTo(briar1.damageAmp, 3);
  });
});

describe('Primordian — 비-태고족 unit 영향 없음', () => {
  it('태고족 3명 + TwistedFate → TF damageAmp 변화 없음', () => {
    const team = [
      placed(apBriar, 0, 0),
      placed(apBelveth, 1, 0),
      placed(apRekSai, 2, 0),
      placed(apTwistedFate, 3, 0),
    ];
    const baseline = [placed(apTwistedFate, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const without = simulateCombat(baseline, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tfWith = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfWithout = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tfWith.damageAmp).toBeCloseTo(tfWithout.damageAmp, 3);
  });
});
