/**
 * 별돌보미 메달(Medallion) 변종 17.2 회귀 가드.
 *
 * 17.2 trait desc:
 *   "(3) Medallion_DA(12)% 피해 증폭, 아군 3성 unit 하나당 +Medallion_IncreasePer3Star(5)%"
 *
 * raw effects (TFT17_Stargazer_Medallion):
 *   (3) tier: Medallion_DA=12 (% pt), Medallion_IncreasePer3Star=5 (% pt per 3성)
 *
 * 17.2 변경: Medallion_IncreasePer3Star 6.5 → 5 (PR #37 fetch 자동 반영).
 *
 * 시뮬 (combatLoop.ts applyStargazerEffects Medallion 분기):
 *   - 강화 칸 (medal pattern) 안 unit 모두에게 damageAmp += (baseDA + per3Star × 3성수) / 100
 *   - 3성 카운트는 player team 전체 (강화 칸 외부 포함, desc "아군 3성 unit").
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
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, starLevel: number = 2, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: eqItems };
}

function buildMedalTeamWithStars(stars: number[]): PlacedChampion[] {
  const tiles = CONSTELLATION_TILE_PATTERN.medal;
  const champs = [apTwistedFate, apTalon, apJax, apAatrox];
  // 강화 칸 4 위치 + 별돌보미 4명. emblem 으로 Aatrox 도 별돌보미 trait.
  return [
    placed(champs[0], tiles[0].q, tiles[0].r, stars[0] ?? 2),
    placed(champs[1], tiles[1].q, tiles[1].r, stars[1] ?? 2),
    placed(champs[2], tiles[2].q, tiles[2].r, stars[2] ?? 2),
    placed(champs[3], tiles[3].q, tiles[3].r, stars[3] ?? 2, [STARGAZER_EMBLEM]),
  ];
}

describe('Medallion 17.2 — base damageAmp + 3성당 추가', () => {
  it('(3) 별돌보미 4명 (3성 0명) + medallion → damageAmp += 0.12 (base 12%)', () => {
    const team = buildMedalTeamWithStars([2, 2, 2, 2]);
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'medal',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.damageAmp).toBeCloseTo(0.12, 2);
  });

  it('3성 unit 1명 추가 → damageAmp += 0.12 + 0.05 = 0.17', () => {
    const team = buildMedalTeamWithStars([3, 2, 2, 2]); // 3성 1명
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'medal',
    });
    const talon = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Talon')!;
    // base 12% + 3성 1명당 5% → 17%
    expect(talon.damageAmp).toBeCloseTo(0.17, 2);
  });

  it('3성 unit 3명 → damageAmp += 0.12 + 3 × 0.05 = 0.27 (17.2 IncreasePer3Star=5)', () => {
    const team = buildMedalTeamWithStars([3, 3, 3, 2]); // 3성 3명
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'medal',
    });
    const aatrox = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Aatrox')!;
    // base 12% + 3 × 5% = 27%
    expect(aatrox.damageAmp).toBeCloseTo(0.27, 2);
  });

  it('medallion 외 별자리 (mountain) → Medallion damageAmp 미적용', () => {
    const team = buildMedalTeamWithStars([3, 3, 2, 2]);
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // mountain 별자리는 강화 칸 별돌보미만 buff (Medallion 미적용)
    expect(tf.damageAmp).toBe(0);
  });

  it('강화 칸 외 unit (medallion 별자리 활성이라도) → damageAmp 미적용', () => {
    const tiles = CONSTELLATION_TILE_PATTERN.medal;
    // 별돌보미 4명, 한 명만 강화 칸 안. 다른 3명은 medal pattern 외부 좌표.
    // medal pattern 외부 axial: (5,3) → (3,6), (4,2) → (2,5), (3,2) → (2,4) 등
    const team = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r, 2), // on tile
      placed(apTalon, 5, 3, 2), // off tile
      placed(apJax, 4, 2, 2),
      placed(apAatrox, 3, 2, 2, [STARGAZER_EMBLEM]),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'medal',
    });
    const talon = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Talon')!;
    // 강화 칸 외 → Medallion damageAmp 미적용 (0)
    expect(talon.damageAmp).toBe(0);
    // TF 는 강화 칸 안 → damageAmp 적용
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.damageAmp).toBeCloseTo(0.12, 2);
  });
});
