/**
 * 별돌보미 강화 칸 점진 공개 (revealedTiles) 회귀 가드 (PR-7 옵션 E).
 *
 * Spec 텍스트: "플레이어 레벨이 오를 때마다 더 많은 칸이 드러납니다."
 * 정확한 reveal 매핑은 spec 자료 부족이라 추정 적용 (보수적):
 *   tiles = min(14, max(0, (level - 1) * 2))
 *   lvl 1 → 0, 2 → 2, 3 → 4, 4 → 6, ..., 8 → 14, 9 → 14 (capped).
 *
 * playerLevel 미지정 시 full 14 (PR-3 backward compat).
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

function placed(c: RawChampion, q: number, r: number, extraItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: extraItems };
}

/** mountain 첫 6 tile 에 별돌보미 6명 배치 (3 base + 3 emblem). */
function buildMountainTeam(): PlacedChampion[] {
  const tiles = CONSTELLATION_TILE_PATTERN.mountain;
  return [
    placed(apTwistedFate, tiles[0].q, tiles[0].r),
    placed(apTalon, tiles[1].q, tiles[1].r),
    placed(apJax, tiles[2].q, tiles[2].r),
    placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
    placed(apMilio, tiles[4].q, tiles[4].r, [STARGAZER_EMBLEM]),
    placed(apCorki, tiles[5].q, tiles[5].r, [STARGAZER_EMBLEM]),
  ];
}

describe('Tile reveal — playerLevel 미지정 시 full 14 (backward compat)', () => {
  it('playerLevel undefined 일 때 모든 6 unit (첫 6 tile) effect 받음', () => {
    const team = buildMountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const noLevel = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
      // playerLevel 미지정
    });
    const noConst = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf1 = noLevel.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tf2 = noConst.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // mountain 효과로 maxHp 증가 (level 미지정이라 full 14 reveal — 첫 6 tile 모두 강화 칸)
    expect(tf1.maxHp).toBeGreaterThan(tf2.maxHp);
  });
});

describe('Tile reveal — playerLevel 9 (full reveal)', () => {
  it('lvl 9 → revealed 14 (모든 unit effect)', () => {
    const team = buildMountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const lvl9 = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
      playerLevel: 9,
    });
    const noLevel = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
    });
    // lvl 9 = 14 reveal = full = no level (default 14)
    const tfLvl9 = lvl9.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfNoLevel = noLevel.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tfLvl9.maxHp).toBe(tfNoLevel.maxHp);
  });
});

describe('Tile reveal — playerLevel 1 (no tiles)', () => {
  it('lvl 1 → revealed 0 → 강화 칸 효과 미적용 (별자리 효과 없음)', () => {
    const team = buildMountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const lvl1 = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
      playerLevel: 1,
    });
    const noConst = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // lvl 1 = 0 reveal = 별자리 미선택과 동일
    const tf1 = lvl1.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tf2 = noConst.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf1.maxHp).toBe(tf2.maxHp);
  });
});

describe('Tile reveal — playerLevel 4 → 6 tiles (첫 6 unit 만 effect)', () => {
  it('lvl 4 reveal=6 → 6 unit 모두 강화 칸 안 (mountain 6 tile 위에 정확히)', () => {
    // 패턴 첫 6 tile = lvl 4 의 reveal 6 tile 과 일치 → 모두 effect.
    const team = buildMountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const lvl4 = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
      playerLevel: 4,
    });
    const lvl9 = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
      playerLevel: 9,
    });
    // 첫 6 unit 이 첫 6 tile 위 — lvl 4 (6 reveal) 와 lvl 9 (14 reveal) 동일 결과.
    const tf4 = lvl4.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tf9 = lvl9.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf4.maxHp).toBe(tf9.maxHp);
  });

  it('lvl 3 reveal=4 → 첫 4 unit 만 강화 칸, 5/6 번째 unit 미적용', () => {
    // mountain 첫 4 tile 안의 unit (TF/Talon/Jax/Aatrox) 만 effect, 5,6 (Milio/Corki) 미적용.
    const team = buildMountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const lvl3 = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
      playerLevel: 3,
    });
    const noConst = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 5 번째 unit (Milio) — 강화 칸 외 → maxHp 동일 (효과 미적용)
    const milio3 = lvl3.playerUnits.find(u => u.champion.apiName === 'TFT17_Milio')!;
    const milioNo = noConst.playerUnits.find(u => u.champion.apiName === 'TFT17_Milio')!;
    expect(milio3.maxHp).toBe(milioNo.maxHp);
    // 1 번째 unit (TF) — 강화 칸 안 → maxHp 큼
    const tf3 = lvl3.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfNo = noConst.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf3.maxHp).toBeGreaterThan(tfNo.maxHp);
  });
});
