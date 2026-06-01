/**
 * 별돌보미 우물(Fountain) 변종 17.3 LIVE 활성 회귀 가드.
 *
 * 17.3 LIVE 패치 (2026-05-13):
 *   - Fountain hash 변수 → 정식 이름 (Fountain_HealPercent / Fountain_ManaRegen / Fountain_ManaRegen_Teamwide)
 *   - applyStargazerEffects (combatLoop.ts:3294~) 활성 분기로 sim 핸들러 활성
 *
 * 메커니즘 (lolchess.gg + Latest 5/9 데이터):
 *   - 강화된 칸 아군: augmentManaRegen += 1.0/s
 *   - 강화된 칸 별돌보미: 추가 augmentManaRegen += 1.0~5.0/s + stargazerFountainHealPercent (0.18~0.25)
 *   - cast 시 가장 낮은 체력 아군 회복 (triggerFountainHeal — totalAbilityDmg × stargazerFountainHealPercent)
 *
 * (3)/(5) tier 별 변수 (TFT17_Stargazer_Fountain 변종):
 *   tier (3-4): HealPct=0.18 / ManaRegen=1.0 / Teamwide=1.0
 *   tier (5+):  HealPct=0.25 / ManaRegen=5.0 / Teamwide=1.0
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

describe('Fountain 17.3 LIVE active — 데이터 검증', () => {
  it('TFT17_Stargazer_Fountain 정식 이름 변수 (3-4 tier) 노출됨', () => {
    const t = traits.find((tt) => tt.apiName === 'TFT17_Stargazer_Fountain')!;
    const tierLow = t.effects.find((e) => e.minUnits === 3);
    expect(tierLow).toBeDefined();
    expect(tierLow!.variables.Fountain_HealPercent).toBeCloseTo(0.18, 2);
    expect(tierLow!.variables.Fountain_ManaRegen).toBe(1.0);
    expect(tierLow!.variables.Fountain_ManaRegen_Teamwide).toBe(1.0);
  });

  it('TFT17_Stargazer_Fountain (5+) tier 변수 노출됨', () => {
    const t = traits.find((tt) => tt.apiName === 'TFT17_Stargazer_Fountain')!;
    const tierHi = t.effects.find((e) => e.minUnits === 5);
    expect(tierHi).toBeDefined();
    expect(tierHi!.variables.Fountain_HealPercent).toBeCloseTo(0.25, 2);
    expect(tierHi!.variables.Fountain_ManaRegen).toBe(5.0);
    expect(tierHi!.variables.Fountain_ManaRegen_Teamwide).toBe(1.0);
  });
});

describe('Fountain 17.3 LIVE active — sim 동작', () => {
  it('(3) 별돌보미 4명 + well 별자리 → 강화 칸 별돌보미 stargazerFountainHealPercent 활성', () => {
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
    // 강화 칸 + 별돌보미 trait → stargazerFountainHealPercent > 0
    const onTileStargazer = result.playerUnits.filter((u) =>
      tiles.some((t) => t.q === u.position.q && t.r === u.position.r)
    );
    expect(onTileStargazer.length).toBeGreaterThan(0);
    const tf = result.playerUnits.find((u) => u.champion.apiName === 'TFT17_TwistedFate')!;
    // TF 는 강화 칸 + 별돌보미 → HealPct=0.18 적용
    expect(tf.stargazerFountainHealPercent).toBeCloseTo(0.18, 2);
    // 강화 칸 아군 → augmentManaRegen 에 Teamwide(1.0) 추가
    expect(tf.augmentManaRegen).toBeGreaterThanOrEqual(1.0);
  });

  it('(3) 별돌보미 + well → 강화 칸 별돌보미 augmentManaRegen 누적 (Teamwide + Owner)', () => {
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
    const tf = result.playerUnits.find((u) => u.champion.apiName === 'TFT17_TwistedFate')!;
    // TF 는 강화 칸 + 별돌보미 → Teamwide(1.0) + Owner(Stargazer trait 의 ManaRegen=3.0) = 4.0
    // 또는 변종 trait 의 ManaRegen(1.0) + Teamwide(1.0) = 2.0 — applyStargazerEffects 호출 순서에 따라
    // 최소 Teamwide(1.0) + 변종 owner(1.0) = 2.0 보장
    expect(tf.augmentManaRegen).toBeGreaterThanOrEqual(2.0);
  });

  it('우물 외 별자리 (mountain) 시 Fountain heal 효과 0', () => {
    const tiles = CONSTELLATION_TILE_PATTERN.well;
    const team = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r),
      placed(apTalon, tiles[1].q, tiles[1].r),
      placed(apJax, tiles[2].q, tiles[2].r),
      placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
      placed(apMilio, tiles[4].q, tiles[4].r, [STARGAZER_EMBLEM]),
      placed(apCorki, tiles[5].q, tiles[5].r, [STARGAZER_EMBLEM]),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
    });
    const tf = result.playerUnits.find((u) => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerFountainHealPercent).toBe(0);
  });

  it('비-별돌보미 unit (다른 트레이트만) → stargazerFountainHealPercent 0', () => {
    const team = [
      placed(apTwistedFate, 0, 0),
      placed(apAatrox, 1, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const aatrox = result.playerUnits.find((u) => u.champion.apiName === 'TFT17_Aatrox')!;
    expect(aatrox.stargazerFountainHealPercent).toBe(0);
  });

  it('PR sequence C-5e/C-5a — Stacking ADAP + periodic heal 활성화 ((3) tier)', () => {
    // 17.3 LIVE: cast 시 heal + 마나 재생 위주.
    // sequence C-5e: raw `{13a2a786}` (Fountain_StackingADAP) sim 통합 — fraction 0.04 ((3) tier).
    // sequence C-5a (본 PR): raw `{d7e6d620}` (teamwide 1%) + `{f2840aed}` (별돌보미 추가 17.4 3%) sim 통합.
    //   강화 칸 별돌보미: fountainHealPctPerTick = 0.01 + 0.03 = 0.04 (17.4 너프 2.5→3 적용).
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
    // 별돌보미 4명 → (3) tier 활성. 강화 칸 안 별돌보미 unit:
    //   - fountainStackingAdapPerTick = 0.04 (StackingADAP fraction, C-5e)
    //   - fountainHealPctPerTick = 0.01 + 0.03 = 0.04 (teamwide + ownerExtra, C-5a 17.4)
    const stargazerUnits = result.playerUnits.filter(
      (u) => u.champion.traits.includes('별돌보미') ||
             u.items.some((it) => it.apiName === 'TFT17_Item_StargazerEmblemItem'),
    );
    for (const u of stargazerUnits) {
      expect(u.fountainStackingAdapPerTick).toBeCloseTo(0.04, 3);
      expect(u.fountainHealPctPerTick).toBeCloseTo(0.04, 3);
    }
  });
});
