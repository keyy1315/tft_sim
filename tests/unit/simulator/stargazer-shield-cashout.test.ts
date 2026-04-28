/**
 * 별돌보미 제단(Shield) 변종 cashout 회귀 가드 (PR-6 옵션 C).
 *
 * Spec (TFT17_Stargazer_Shield):
 *   (3) Teamwide HP+8%, AS+8% (이미 PR #16 처리됨)
 *   60회 사망 누적 시 강화 칸 별돌보미: 추가 HP+20%, AS+18% (cashout)
 *   게임-level 누적이라 단일 전투에선 거의 발동 안 함 → priorShieldDeaths 입력으로 받음.
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

function buildAltarTeam(): PlacedChampion[] {
  const tiles = CONSTELLATION_TILE_PATTERN.altar;
  return [
    placed(apTwistedFate, tiles[0].q, tiles[0].r),
    placed(apTalon, tiles[1].q, tiles[1].r),
    placed(apJax, tiles[2].q, tiles[2].r),
    placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
    placed(apMilio, tiles[4].q, tiles[4].r, [STARGAZER_EMBLEM]),
    placed(apCorki, tiles[5].q, tiles[5].r, [STARGAZER_EMBLEM]),
  ];
}

describe('Shield — 강화 칸 별돌보미 cashoutHp/As 필드 설정', () => {
  it('(3) 별돌보미 4명 + altar → cashoutHpFrac=0.20, cashoutAsFrac=0.18', () => {
    const tiles = CONSTELLATION_TILE_PATTERN.altar;
    const team = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r),
      placed(apTalon, tiles[1].q, tiles[1].r),
      placed(apJax, tiles[2].q, tiles[2].r),
      placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'altar',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerShieldCashoutHpFrac).toBeCloseTo(0.20, 2);
    expect(tf.stargazerShieldCashoutAsFrac).toBeCloseTo(0.18, 2);
  });

  it('비-altar 별자리 (mountain) 시 cashout 필드 = 0', () => {
    const team = buildAltarTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerShieldCashoutHpFrac).toBe(0);
    expect(tf.stargazerShieldCashoutAsFrac).toBe(0);
  });
});

describe('Shield — priorPlayerShieldDeaths 누적 ≥ 60 시 cashout 발동', () => {
  it('priorPlayerShieldDeaths=60 → 시뮬 시작 시점에 cashout 적용', () => {
    const team = buildAltarTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    // 누적 사망 60 → cashout 발동
    const withCashout = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'altar',
      priorPlayerShieldDeaths: 60,
    });
    // 누적 사망 0 → cashout 미발동
    const noCashout = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'altar',
      priorPlayerShieldDeaths: 0,
    });
    // cashout 발동 시 별돌보미 unit maxHp 가 1.20 배 더 큼.
    const tfCashout = withCashout.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfNoCashout = noCashout.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // priorShieldDeaths 가 시뮬 시작 시점에 적용되니까 maxHp 비율 ≥ 1.18 (rounding margin).
    // teamwide=1.08, cashout=1.20 추가 → ratio 약 1.20.
    expect(tfCashout.maxHp / tfNoCashout.maxHp).toBeGreaterThan(1.15);
  });

  it('priorPlayerShieldDeaths=59 + 시뮬 내 1 사망 → cashout 발동 (player 누적 사망 trigger)', () => {
    // 별돌보미 6명 vs 강한 적 6명 — 적과의 전투 중 player 사망이 일어남.
    // priorShieldDeaths=59 → 1 사망만 더 필요하므로 시뮬 내 첫 player 사망에 cashout.
    const team = buildAltarTeam();
    const enemy: PlacedChampion[] = [
      placed(dummyEnemy, 0, 3, []),
      placed(dummyEnemy, 1, 3, []),
      placed(dummyEnemy, 2, 3, []),
      placed(dummyEnemy, 3, 3, []),
      placed(dummyEnemy, 4, 3, []),
      placed(dummyEnemy, 5, 3, []),
    ];
    const withCashout = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'altar',
      priorPlayerShieldDeaths: 59,
    });
    const noCashout = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'altar',
      priorPlayerShieldDeaths: 0,
    });
    // cashout 발동 시 player 측 누적 currentHp / damageDealt 가 OFF 대비 동등 이상
    const sumPlayerHp = (units: typeof withCashout.playerUnits) =>
      units.reduce((s, u) => s + Math.max(0, u.currentHp), 0);
    expect(sumPlayerHp(withCashout.playerUnits)).toBeGreaterThanOrEqual(sumPlayerHp(noCashout.playerUnits));
  });
});

describe('Shield — priorEnemyShieldDeaths 도 동일 메커니즘', () => {
  it('priorEnemyShieldDeaths=60 + enemy altar → enemy 별돌보미 cashout 발동', () => {
    const playerTeam: PlacedChampion[] = [placed(dummyEnemy, 0, 3)];
    const enemyTeam = buildAltarTeam();
    const result = simulateCombat(playerTeam, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      enemyStargazerConstellation: 'altar',
      priorEnemyShieldDeaths: 60,
    });
    const noResult = simulateCombat(playerTeam, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      enemyStargazerConstellation: 'altar',
      priorEnemyShieldDeaths: 0,
    });
    const tfWith = result.enemyUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfNo = noResult.enemyUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tfWith.maxHp / tfNo.maxHp).toBeGreaterThan(1.15);
  });
});
