/**
 * Mountain 변종의 단위 단계별 effects 정확성 회귀 가드.
 *
 * - AP 단위: percentage points (예: ADAP 0.12 → +12 AP)
 * - minUnits=8+ 활성 시 Mountain_StatIncrease 가 다른 보너스 증폭
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const STARGAZER_EMBLEM = items.find((i) => i.apiName === 'TFT17_Item_StargazerEmblemItem')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const apJax = champions.find((c) => c.apiName === 'TFT17_Jax')!;
const apTalon = champions.find((c) => c.apiName === 'TFT17_Talon')!;
const apAatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
const apMilio = champions.find((c) => c.apiName === 'TFT17_Milio')!;
const apCorki = champions.find((c) => c.apiName === 'TFT17_Corki')!;
const apCaitlyn = champions.find((c) => c.apiName === 'TFT17_Caitlyn')!;
const apRiven = champions.find((c) => c.apiName === 'TFT17_Riven')!;
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Galio')
  ?? champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, extraItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: extraItems };
}

describe('Mountain — AP 단위 + StatIncrease 증폭', () => {
  it('minUnits=6 활성 + 강화 칸 안 별돌보미 AP +12 (pts), AD ×1.12', () => {
    // player 6 별돌보미 (champion 3 + emblem 3) — 모두 mountain 강화 칸 axial 좌표:
    // (2,0)(3,0)(4,0)(5,0)(1,1)(5,1) 등. 강화 칸 외엔 효과 안 받음 — 별도 케이스 검증.
    const ally: PlacedChampion[] = [
      placed(apTwistedFate, 2, 0),
      placed(apTalon, 3, 0),
      placed(apJax, 4, 0),
      placed(apAatrox, 5, 0, [STARGAZER_EMBLEM]),
      placed(apMilio, 1, 1, [STARGAZER_EMBLEM]),
      placed(apCorki, 5, 1, [STARGAZER_EMBLEM]),
    ];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];

    const withMountain = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      stageNumber: 5,
      playerStargazerConstellation: 'mountain',
      enemyStargazerConstellation: 'mountain',
    });
    const withoutConst = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      stageNumber: 5,
    });

    for (let i = 0; i < ally.length; i++) {
      const um = withMountain.playerUnits[i];
      const ub = withoutConst.playerUnits[i];
      // AD: damage × 1.12, 정수 round 오차 ±1.
      const expectedAD = Math.round(ub.stats.damage * 1.12);
      expect(Math.abs(um.stats.damage - expectedAD)).toBeLessThanOrEqual(1);
      // AP: +12 percentage points (다른 trait 영향 없음)
      expect(um.stats.ap - ub.stats.ap).toBeCloseTo(12, 1);
    }
  });

  it('비-별돌보미 unit (강화 칸 무관) 변화 없음 — Mountain 은 teamwide 없음', () => {
    const ally: PlacedChampion[] = [
      // 별돌보미 6명 (강화 칸 안)
      placed(apTwistedFate, 2, 0),
      placed(apTalon, 3, 0),
      placed(apJax, 4, 0),
      placed(apAatrox, 5, 0, [STARGAZER_EMBLEM]),
      placed(apMilio, 1, 1, [STARGAZER_EMBLEM]),
      placed(apCorki, 5, 1, [STARGAZER_EMBLEM]),
      // 비-별돌보미 2명 — 강화 칸 안에 있더라도 Mountain teamwide 없으니 영향 없음.
      placed(apCaitlyn, 0, 2),
      placed(apRiven, 5, 2),
    ];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];

    const withMountain = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      stageNumber: 5,
      playerStargazerConstellation: 'mountain',
      enemyStargazerConstellation: 'mountain',
    });
    const withoutConst = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      stageNumber: 5,
    });

    // 비-별돌보미 unit (Caitlyn, Riven)
    for (const apiName of ['TFT17_Caitlyn', 'TFT17_Riven']) {
      const um = withMountain.playerUnits.find((u) => u.champion.apiName === apiName)!;
      const ub = withoutConst.playerUnits.find((u) => u.champion.apiName === apiName)!;
      expect(um.stats.damage).toBe(ub.stats.damage);
      expect(um.stats.ap).toBe(ub.stats.ap);
      expect(um.maxHp).toBe(ub.maxHp);
    }
  });
});
