/**
 * 별돌보미 우물(Fountain) 변종 17.2 회귀 가드.
 *
 * 17.2 LIVE 패치노트 명시:
 *   "별돌보미 룰루와 자야 효과 찾는 중 — 우물 비활성화"
 *
 * raw data 에 hash 변수 + 값 정의되어 있지만 인게임 효과 미발동.
 * 시뮬도 동일하게 no-op (codex P1 가드) — 사용자가 well 별자리 선택해도
 * fountainHealPctPerTick / fountainStackingAdapPerTick = 0 (효과 없음).
 *
 * 다음 patch 에서 reenable 시 applyStargazerEffects 의 commented 매핑 코드
 * 활성화 + 본 테스트의 expected 값 갱신.
 *
 * raw hash ↔ desc 매핑 (reenable 시 사용):
 *   {8d19f5db}=2초 / {d7e6d620}=2% teamwide / {f2840aed}=4% 별돌보미 / {13a2a786}=2/4% StackingADAP
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { CONSTELLATION_TILE_PATTERN } from '@/lib/actualData/stargazerMapping';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const STARGAZER_EMBLEM = items.find((i) => i.apiName === 'TFT17_Item_StargazerEmblemItem')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const apTalon = champions.find((c) => c.apiName === 'TFT17_Talon')!;
const apJax = champions.find((c) => c.apiName === 'TFT17_Jax')!;
const apAatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
const apMilio = champions.find((c) => c.apiName === 'TFT17_Milio')!;
const apCorki = champions.find((c) => c.apiName === 'TFT17_Corki')!;
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: eqItems };
}

function buildFountainTeam(): PlacedChampion[] {
  const tiles = CONSTELLATION_TILE_PATTERN.well;
  return [
    placed(apTwistedFate, tiles[0].q, tiles[0].r),
    placed(apTalon, tiles[1].q, tiles[1].r),
    placed(apJax, tiles[2].q, tiles[2].r),
    placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
    placed(apMilio, tiles[4].q, tiles[4].r, [STARGAZER_EMBLEM]),
    placed(apCorki, tiles[5].q, tiles[5].r, [STARGAZER_EMBLEM]),
  ];
}

describe('Fountain 17.2 — Riot 우물 비활성화 (시뮬 no-op)', () => {
  it('(3) 별돌보미 4명 + well 별자리 → fountain 효과 0 (17.2 비활성 spec)', () => {
    const tiles = CONSTELLATION_TILE_PATTERN.well;
    const team = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r),
      placed(apTalon, tiles[1].q, tiles[1].r),
      placed(apJax, tiles[2].q, tiles[2].r),
      placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'well',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // 17.2 LIVE: 우물 비활성 → 모든 fountain 필드 0
    expect(tf.fountainHealPctPerTick).toBe(0);
    expect(tf.fountainStackingAdapPerTick).toBe(0);
    expect(tf.stargazerFountainHealPercent).toBe(0);
  });

  it('(5) 별돌보미 6명 + well 별자리 → fountain 효과 0', () => {
    const team = buildFountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'well',
    });
    for (const u of result.playerUnits) {
      expect(u.fountainHealPctPerTick).toBe(0);
      expect(u.fountainStackingAdapPerTick).toBe(0);
    }
  });

  it('우물 외 별자리 (mountain) 시 fountain 필드 0 (선택 무관)', () => {
    const team = buildFountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.fountainHealPctPerTick).toBe(0);
    expect(tf.fountainStackingAdapPerTick).toBe(0);
  });

  it('CombatUnit fountain 필드 default 값 0', () => {
    const team = [placed(apTwistedFate, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf = result.playerUnits[0];
    expect(tf.fountainHealPctPerTick).toBe(0);
    expect(tf.fountainStackingAdapPerTick).toBe(0);
  });

  it('비-별돌보미 unit (다른 트레이트만) → fountain 필드 0', () => {
    const team = [
      placed(apTwistedFate, 0, 0),
      placed(apAatrox, 1, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const aatrox = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Aatrox')!;
    expect(aatrox.fountainHealPctPerTick).toBe(0);
    expect(aatrox.fountainStackingAdapPerTick).toBe(0);
  });
});
