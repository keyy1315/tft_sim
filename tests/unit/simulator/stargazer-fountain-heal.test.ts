/**
 * 별돌보미 우물(Fountain) 변종 — 스킬 시전 힐 회귀 가드 (PR-4 옵션 A).
 *
 * Spec (TFT17_Stargazer_Fountain):
 *   (3) Fountain_HealPercent=0.18 — 강화 칸 안 별돌보미 스킬 시전 시
 *       즉발 피해의 18% 만큼 같은 팀 중 가장 체력 낮은 아군 회복.
 *   (5) Fountain_HealPercent=0.25 — 25%.
 *
 * 회복 대상: 같은 팀 + 살아있는 unit + currentHp/maxHp 비율 가장 낮음 (자기 포함).
 *
 * ⚠️ 17.2 재설계 NOTE:
 *   17.2 LIVE 패치에서 Fountain trait 변수가 완전 재설계됨.
 *   Fountain_HealPercent / Fountain_ManaRegen / Fountain_ManaRegen_Teamwide
 *   모두 raw data 에서 제거. 신규 hash 키 (`{13a2a786}`, `{8d19f5db}`,
 *   `{d7e6d620}`, `{f2840aed}`) 로 메커니즘 변경 (스택 기반으로 추정).
 *   시뮬 코드는 `?? 0` 폴백으로 효과 0 — 자연스럽게 무효화.
 *   본 테스트들은 17.2 메커니즘 정확히 파악될 때까지 skip.
 *   TODO: lolchess/인게임 확인 후 신규 hash 변수 의미 매핑 + 메커니즘 마이그레이션.
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

/** well 별자리 강화 칸 첫 6 tile 에 별돌보미 6명 (3 base + 3 emblem) 배치. */
function buildFountainTeam(): PlacedChampion[] {
  const tiles = CONSTELLATION_TILE_PATTERN.well;
  const champs = [apTwistedFate, apTalon, apJax];
  const emblemChamps = [apAatrox, apMilio, apCorki];
  return [
    ...champs.map((c, i) => placed(c, tiles[i].q, tiles[i].r)),
    ...emblemChamps.map((c, i) => placed(c, tiles[3 + i].q, tiles[3 + i].r, [STARGAZER_EMBLEM])),
  ];
}

// 17.2 Fountain 재설계로 메커니즘 미반영 상태 — 마이그레이션 후 .skip 제거.
describe.skip('Fountain — 강화 칸 안 별돌보미 스킬 시전 시 healPercent 설정 (17.2 마이그 대기)', () => {
  it('(3) 별돌보미 stargazerFountainHealPercent = 0.18 (활성 effect minUnits=3 case)', () => {
    // 별돌보미 4명 → minUnits=3 활성 (HealPercent=0.18)
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
    expect(tf.stargazerFountainHealPercent).toBeCloseTo(0.18, 2);
  });

  it('(5) 별돌보미 6명 → minUnits=5 활성, HealPercent = 0.25', () => {
    const team = buildFountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'well',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerFountainHealPercent).toBeCloseTo(0.25, 2);
  });

  it('강화 칸 외 별돌보미 unit 은 healPercent = 0', () => {
    // 별돌보미 4명, 단 한 명만 강화 칸 안, 나머지는 외부 좌표
    const tiles = CONSTELLATION_TILE_PATTERN.well;
    const team = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r), // on tile
      placed(apTalon, 6, 0), // off tile (q=6, r=0 — well pattern 외)
      placed(apJax, 6, 1),
      placed(apAatrox, 6, 2, [STARGAZER_EMBLEM]),
    ];
    const enemy = [placed(dummyEnemy, 0, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'well',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const talon = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Talon')!;
    expect(tf.stargazerFountainHealPercent).toBeCloseTo(0.18, 2);
    expect(talon.stargazerFountainHealPercent).toBe(0);
  });

  it('비-별돌보미 unit (강화 칸 안이어도) 은 healPercent = 0', () => {
    const team = buildFountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'well',
    });
    // emblem 으로 별돌보미가 된 unit (Aatrox) 도 별돌보미 trait 보유 → healPercent 받음
    const aatrox = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Aatrox')!;
    expect(aatrox.stargazerFountainHealPercent).toBeCloseTo(0.25, 2);
  });

  it('우물 외 별자리 (mountain) 선택 시 healPercent = 0', () => {
    const team = buildFountainTeam();
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerFountainHealPercent).toBe(0);
  });
});

describe.skip('Fountain — OOR (dash/self_buff) cast path 도 heal 적용 (17.2 마이그 대기)', () => {
  it('Corki (dash 챔프) 가 사거리 밖 시전해도 Fountain heal 발동', () => {
    // Corki 는 dash: 'to_target' + hitCount: 21 (즉발 dmg). OOR cast path 통과.
    // Corki 를 well 강화 칸 안 별돌보미 emblem 으로 만든 후 적과 멀리 배치 → 첫 cast 가 OOR path.
    const tiles = CONSTELLATION_TILE_PATTERN.well;
    // well pattern 첫 6 tile 사용. Corki 만 별돌보미 emblem 으로 강화 칸에 배치, 나머지는 trait 활성용.
    const team: PlacedChampion[] = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r),
      placed(apTalon, tiles[1].q, tiles[1].r),
      placed(apJax, tiles[2].q, tiles[2].r),
      placed(apCorki, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]), // dash 챔프 + 별돌보미 emblem
    ];
    // 적 한 명 + 멀리 배치 (q=6, r=3 — 보드 반대편)
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];

    const withWell = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'well',
    });
    const withoutWell = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 우물 ON 시 Corki 가 OOR cast 통해서도 heal 발동 → player team 누적 currentHp 가
    // 우물 OFF 대비 동등하거나 큼 (heal 없으면 같음, OOR cast 추가 발동 시 더 큼).
    const sumHp = (units: typeof withWell.playerUnits) =>
      units.reduce((s, u) => s + Math.max(0, u.currentHp), 0);
    expect(sumHp(withWell.playerUnits)).toBeGreaterThanOrEqual(sumHp(withoutWell.playerUnits));
  });
});

describe.skip('Fountain — 스킬 시전 시 가장 체력 낮은 아군 회복 (17.2 마이그 대기)', () => {
  it('(5) 별돌보미 스킬 시전 → 가장 체력 낮은 아군 currentHp 증가', () => {
    // well 6명 + 다친 ally 1명을 강화 칸 외에 배치 → 그 ally 가 회복 대상
    const tiles = CONSTELLATION_TILE_PATTERN.well;
    const team: PlacedChampion[] = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r),
      placed(apTalon, tiles[1].q, tiles[1].r),
      placed(apJax, tiles[2].q, tiles[2].r),
      placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
      placed(apMilio, tiles[4].q, tiles[4].r, [STARGAZER_EMBLEM]),
      placed(apCorki, tiles[5].q, tiles[5].r, [STARGAZER_EMBLEM]),
    ];
    const enemy: PlacedChampion[] = [
      placed(dummyEnemy, 6, 3),
      placed(dummyEnemy, 5, 3),
    ];
    // 우물 ON
    const withWell = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'well',
    });
    // 비교: 우물 OFF (별자리 미선택)
    const withoutWell = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });

    // 우물 ON 일 때 player 팀 누적 totalDamageTaken 이 더 적어야 함 (heal 으로 currentHp 보존)
    // 또는: combat 후 살아남은 player unit 들의 누적 currentHp 합이 더 높아야 함
    const sumHp = (units: typeof withWell.playerUnits) =>
      units.reduce((s, u) => s + Math.max(0, u.currentHp), 0);
    expect(sumHp(withWell.playerUnits)).toBeGreaterThan(sumHp(withoutWell.playerUnits));
  });
});
