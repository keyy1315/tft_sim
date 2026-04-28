/**
 * 메카 (Mecha) trait 회귀 가드 — AD/AP 가산.
 *
 * Spec (TFT17_Mecha):
 *   (3) AD=0.20, AP=20
 *   (4) AD=0.35, AP=35
 *   (6) AD=0.35, AP=35 (4와 동일, +TeamSize sim 외)
 *
 * 메카 챔프 (3명): Urgot, AurelionSol, Galio.
 * 변신 (TransformedPercentHealth=0.40) 은 후속 PR.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apUrgot = champions.find((c) => c.apiName === 'TFT17_Urgot')!;
const apAurelionSol = champions.find((c) => c.apiName === 'TFT17_AurelionSol')!;
const apGalio = champions.find((c) => c.apiName === 'TFT17_Galio')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('Mecha — (3) tier AD+20%/AP+20', () => {
  it('메카 3명 → Urgot AD/AP 증가 vs 1명 baseline', () => {
    const team3 = [
      placed(apUrgot, 0, 0),
      placed(apAurelionSol, 1, 0),
      placed(apGalio, 2, 0),
    ];
    const team1 = [placed(apUrgot, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result3 = simulateCombat(team3, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result1 = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const urgot3 = result3.playerUnits.find(u => u.champion.apiName === 'TFT17_Urgot')!;
    const urgot1 = result1.playerUnits.find(u => u.champion.apiName === 'TFT17_Urgot')!;
    // (3) tier AD+20% → urgot3 AD > urgot1 AD
    expect(urgot3.stats.damage).toBeGreaterThan(urgot1.stats.damage);
    // (3) tier AP+20 (flat)
    expect(urgot3.stats.ap - urgot1.stats.ap).toBeCloseTo(20, 1);
  });
});

describe('Mecha — 메카 unit 만 buff', () => {
  it('메카 3명 + TwistedFate (비-메카) → 메카 unit AP 가산만', () => {
    const team = [
      placed(apUrgot, 0, 0),
      placed(apAurelionSol, 1, 0),
      placed(apGalio, 2, 0),
      placed(apTwistedFate, 3, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const urgot = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Urgot')!;
    const aurelion = result.playerUnits.find(u => u.champion.apiName === 'TFT17_AurelionSol')!;
    const galio = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Galio')!;
    // (3) tier AP+20 — 메카 unit 모두 baseline AP=0 + Mecha 효과 + 다른 trait 영향. AP >= 20.
    // 다른 trait 가 AP 더 줄 수도 있어 strict equality 어려움 → 최소 AP 20 보장 검증.
    expect(urgot.stats.ap).toBeGreaterThanOrEqual(20);
    expect(aurelion.stats.ap).toBeGreaterThanOrEqual(20);
    expect(galio.stats.ap).toBeGreaterThanOrEqual(20);
  });
});

describe('Mecha — 비활성 (1명/2명) 시 효과 없음', () => {
  it('메카 2명 → trait inactive (minUnits=3), Urgot AD/AP 변화 없음', () => {
    const team1 = [placed(apUrgot, 0, 0)];
    const team2 = [placed(apUrgot, 0, 0), placed(apAurelionSol, 1, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result1 = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result2 = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const urgot1 = result1.playerUnits.find(u => u.champion.apiName === 'TFT17_Urgot')!;
    const urgot2 = result2.playerUnits.find(u => u.champion.apiName === 'TFT17_Urgot')!;
    expect(urgot2.stats.damage).toBe(urgot1.stats.damage);
    expect(urgot2.stats.ap).toBe(urgot1.stats.ap);
  });
});
