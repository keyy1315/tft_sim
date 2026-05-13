/**
 * 별돌보미 우물(Fountain) 변종 17.3 데이터 가드 (sim 핸들러 비활성).
 *
 * 17.3 LIVE 패치 (2026-05-13):
 *   - Fountain hash 변수가 정식 이름(Fountain_HealPercent / Fountain_ManaRegen / Fountain_ManaRegen_Teamwide) 으로 풀림
 *   - 데이터 측면 정상 노출, sim 핸들러 활성화는 PR 3
 *
 * 본 테스트의 역할:
 *   - 데이터 자동 매핑(stargazerFountainHealPercent 등) 가드만 유지
 *   - 매초 효과(fountainHealPctPerTick, fountainStackingAdapPerTick) 는 PR 3 까지 0
 *
 * PR 3 (Stargazer Fountain helper) 머지 시:
 *   - applyStargazerFountainBuffs() 활성화 → tick 효과 검증으로 가드 갱신
 *   - 본 파일명 stargazer-fountain-1703-active.test.ts 로 재변경
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

describe('Fountain 17.3 — sim 핸들러 미구현 (PR 3 의존)', () => {
  it('(3) 별돌보미 4명 + well 별자리 → 매초 효과 0 (핸들러 비활성)', () => {
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
    // 17.3 데이터 자동 매핑은 발생하나 매초 효과 핸들러는 PR 3 까지 비활성
    expect(tf.fountainHealPctPerTick).toBe(0);
    expect(tf.fountainStackingAdapPerTick).toBe(0);
  });

  it('(5) 별돌보미 6명 + well 별자리 → 매초 효과 0', () => {
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
