/**
 * 운명술사 (Fateweaver) trait 회귀 가드.
 *
 * Spec (TFT17_Fateweaver):
 *   - Innate: 운명술사 unit 은 Precision (spell crit 가능) — count >= 1 부터.
 *   - (2) chance effects on abilities are Lucky — 후속 PR 에서 처리.
 *   - (4) Crit Chance +20%, Crit Damage +20% — 운명술사 unit 한정.
 *
 * 운명술사 챔프: Corki, Caitlyn, TwistedFate, Milio.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const apCaitlyn = champions.find((c) => c.apiName === 'TFT17_Caitlyn')!;
const apCorki = champions.find((c) => c.apiName === 'TFT17_Corki')!;
const apMilio = champions.find((c) => c.apiName === 'TFT17_Milio')!;
const apJax = champions.find((c) => c.apiName === 'TFT17_Jax')!; // 비-운명술사
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('Fateweaver — Innate Precision (운명술사 unit spellCanCrit 활성)', () => {
  it('운명술사 1명 → 그 unit spellCanCrit=true (보건/무대 없어도)', () => {
    const team = [placed(apTwistedFate, 0, 0), placed(apJax, 1, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const jax = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Jax')!;
    expect(tf.spellCanCrit).toBe(true); // Innate Precision
    expect(jax.spellCanCrit).toBe(false); // 비-운명술사
  });
});

describe('Fateweaver — (4) tier crit stat 가산', () => {
  it('운명술사 4명 활성 → 운명술사 unit critChance +0.20, critMultiplier +0.20', () => {
    const team = [
      placed(apTwistedFate, 0, 0),
      placed(apCaitlyn, 1, 0),
      placed(apCorki, 2, 0),
      placed(apMilio, 3, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withFw = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 비교: Fateweaver 비활성 (운명술사 1명만 — Innate 적용되지만 (4) tier 미활성)
    const team1 = [placed(apTwistedFate, 0, 0), placed(apJax, 1, 0)];
    const without = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf4 = withFw.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tf1 = without.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // 4명 활성 시 crit chance 차이 ≥ 0.20 (다른 보너스 무시 시 정확히 0.20)
    expect(tf4.stats.critChance - tf1.stats.critChance).toBeCloseTo(0.20, 2);
    // crit damage = critMultiplier — +20% (= 0.20 fraction)
    expect(tf4.stats.critMultiplier - tf1.stats.critMultiplier).toBeCloseTo(0.20, 2);
  });

  it('비-운명술사 unit 은 (4) tier 효과 미적용', () => {
    const team = [
      placed(apTwistedFate, 0, 0),
      placed(apCaitlyn, 1, 0),
      placed(apCorki, 2, 0),
      placed(apMilio, 3, 0),
      placed(apJax, 4, 0), // 비-운명술사
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withFw = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const without = simulateCombat([placed(apJax, 4, 0)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jaxFw = withFw.playerUnits.find(u => u.champion.apiName === 'TFT17_Jax')!;
    const jaxNo = without.playerUnits.find(u => u.champion.apiName === 'TFT17_Jax')!;
    // Jax 는 운명술사 아니라 crit stat 변화 없음
    expect(jaxFw.stats.critChance).toBeCloseTo(jaxNo.stats.critChance, 3);
    expect(jaxFw.stats.critMultiplier).toBeCloseTo(jaxNo.stats.critMultiplier, 3);
    expect(jaxFw.spellCanCrit).toBe(false);
  });
});

describe('Fateweaver — trait 비활성 (0명) 시 영향 없음', () => {
  it('운명술사 0명 → spellCanCrit 모든 unit false (item 없으면)', () => {
    const team = [placed(apJax, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jax = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Jax')!;
    expect(jax.spellCanCrit).toBe(false);
  });
});
