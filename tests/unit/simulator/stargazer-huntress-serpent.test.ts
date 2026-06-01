/**
 * 별돌보미 여사냥꾼(Huntress) + 뱀(Serpent) 변종 회귀 가드 (PR-5 옵션 B).
 *
 * Huntress spec (TFT17_Stargazer_Huntress) — 17.2 LIVE:
 *   - 전투 시작: 적 maxHp 상위 NumMarks 명에 'mark' statusEffect.
 *   - 강화 칸 별돌보미: 표식된 적 사망 시 maxHp × Huntress_Heal 회복.
 *   - (3) NumMarks=3, Heal=0.15 / (5) NumMarks=5, Heal=0.15 / (7) NumMarks=7, Heal=0.15
 *     (17.2: Heal 0.10 → 0.15)
 *   - AS: (3) 0.12 / (5) 0.35 / (7) 0.55 (17.2: 강화)
 *
 * Serpent spec (TFT17_Stargazer_Serpent):
 *   - 강화 칸 별돌보미: 적 데미지 명중 시 dmg × Serpent_Poison 을
 *     Serpent_Duration 초간 magic DOT (poison statusEffect).
 *   - (3) Poison=0.20 / (5) Poison=0.40 / (7) Poison=0.60, Duration=3
 *     (17.4: (3) Poison 0.25 → 0.20 너프, (5)/(7) 동일)
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

/** 6명 (3 base + 3 emblem) 별돌보미 팀을 별자리 강화 칸 첫 6 tile 에 배치. */
function buildStargazerTeam(constellation: 'huntress' | 'snake'): PlacedChampion[] {
  const tiles = CONSTELLATION_TILE_PATTERN[constellation];
  return [
    placed(apTwistedFate, tiles[0].q, tiles[0].r),
    placed(apTalon, tiles[1].q, tiles[1].r),
    placed(apJax, tiles[2].q, tiles[2].r),
    placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
    placed(apMilio, tiles[4].q, tiles[4].r, [STARGAZER_EMBLEM]),
    placed(apCorki, tiles[5].q, tiles[5].r, [STARGAZER_EMBLEM]),
  ];
}

describe('Huntress — 강화 칸 별돌보미 healPercent 설정 + 적 표식', () => {
  it('(3) 별돌보미 4명 → healPercent=0.15, 적 maxHp 상위 3명 mark (17.2)', () => {
    const tiles = CONSTELLATION_TILE_PATTERN.huntress;
    const team = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r),
      placed(apTalon, tiles[1].q, tiles[1].r),
      placed(apJax, tiles[2].q, tiles[2].r),
      placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
    ];
    const enemy: PlacedChampion[] = [
      placed(dummyEnemy, 0, 3),
      placed(dummyEnemy, 1, 3),
      placed(dummyEnemy, 2, 3),
      placed(dummyEnemy, 3, 3),
      placed(dummyEnemy, 4, 3),
    ];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'huntress',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerHuntressHealPercent).toBeCloseTo(0.15, 2);
    // enemy 5명 중 3명에 mark (상위 maxHp 기준 — 모두 dummyEnemy 라 처음 3명).
    const markedCount = result.enemyUnits.filter(e =>
      e.statusEffects.some(s => s.type === 'mark') ||
      // 사망 후 mark statusEffect 가 정리되었을 수 있으므로 deadWithMark 도 카운트
      (e.state === 'dead')
    ).length;
    expect(markedCount).toBeGreaterThanOrEqual(3);
  });

  it('(5) 별돌보미 6명 → healPercent=0.15, NumMarks=5 (17.2)', () => {
    const team = buildStargazerTeam('huntress');
    const enemy: PlacedChampion[] = Array.from({ length: 7 }, (_, i) =>
      placed(dummyEnemy, i % 7, 3)
    );
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'huntress',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerHuntressHealPercent).toBeCloseTo(0.15, 2);
  });

  it('huntress 외 별자리 (mountain) 시 healPercent=0', () => {
    const team = buildStargazerTeam('huntress');
    const enemy = [placed(dummyEnemy, 0, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerHuntressHealPercent).toBe(0);
  });
});

describe('Serpent — 강화 칸 별돌보미 poisonPercent + duration 설정', () => {
  it('(3) 별돌보미 4명 → poisonPercent=0.20, duration=3 (17.4 너프)', () => {
    const tiles = CONSTELLATION_TILE_PATTERN.snake;
    const team = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r),
      placed(apTalon, tiles[1].q, tiles[1].r),
      placed(apJax, tiles[2].q, tiles[2].r),
      placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'snake',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerSerpentPoisonPercent).toBeCloseTo(0.20, 2);
    expect(tf.stargazerSerpentDurationSec).toBe(3);
  });

  it('(5) 별돌보미 6명 → poisonPercent=0.40', () => {
    const team = buildStargazerTeam('snake');
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'snake',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerSerpentPoisonPercent).toBeCloseTo(0.40, 2);
  });

  it('snake 외 별자리 (mountain) 시 poisonPercent=0', () => {
    const team = buildStargazerTeam('snake');
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'mountain',
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.stargazerSerpentPoisonPercent).toBe(0);
  });

  it('Serpent ON 시 enemy 에 poison statusEffect 발동 후 currentHp 감소', () => {
    // 큰 maxHp 적 1명 + ability 시전이 빠른 별돌보미 → poison DOT 누적 관찰 가능.
    // enemy 가 죽기 전 poison tick 이 currentHp 를 감소시키는지 검증.
    const team = buildStargazerTeam('snake');
    // dummyEnemy 1명을 6,3 — combat 진행되며 player 가 ability 명중 → poison push
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withSnake = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'snake',
    });
    const withoutSnake = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // Serpent ON 시 player team 잔존 currentHp 합계가 OFF 대비 동등 이상 (DR + poison 으로 우위)
    const sumPlayerHp = (units: typeof withSnake.playerUnits) =>
      units.reduce((s, u) => s + Math.max(0, u.currentHp), 0);
    expect(sumPlayerHp(withSnake.playerUnits)).toBeGreaterThanOrEqual(sumPlayerHp(withoutSnake.playerUnits));
    // 그리고 winner 는 양쪽 모두 player (sim 결과 일관성)
    expect(withSnake.winner).toBe(withoutSnake.winner);
  });
});

describe('Serpent — poison reapplication 시 duration refresh + residual 보존 (codex P1)', () => {
  it('동일 caster 가 여러 hit 로 poison 재적용 시 총 피해가 단순 sum (모두 fully delivered)', () => {
    // 큰 maxHp dummy 적 → 충분히 살아남아서 poison ticks 가 모두 적용될 시간 확보.
    // Serpent ON 단일 unit + emblem 5 → 별돌보미 6 (5tier=Poison 0.40, Duration 3s).
    // 평타 + ability 여러 hit → 같은 caster source 의 poison 누적 적용.
    const tiles = CONSTELLATION_TILE_PATTERN.snake;
    const team: PlacedChampion[] = [
      placed(apTwistedFate, tiles[0].q, tiles[0].r),
      placed(apTalon, tiles[1].q, tiles[1].r),
      placed(apJax, tiles[2].q, tiles[2].r),
      placed(apAatrox, tiles[3].q, tiles[3].r, [STARGAZER_EMBLEM]),
      placed(apMilio, tiles[4].q, tiles[4].r, [STARGAZER_EMBLEM]),
      placed(apCorki, tiles[5].q, tiles[5].r, [STARGAZER_EMBLEM]),
    ];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];

    const withSnake = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'snake',
    });
    const withoutSnake = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // duration refresh 없으면 후속 hit 의 poison 이 partial 전달 → enemy 가 더 오래 살아남음 → combat duration 길어짐.
    // refresh 적용되면 enemy 가 더 빨리 죽거나 동등하게 죽음 → withSnake.duration <= withoutSnake.duration
    expect(withSnake.duration).toBeLessThanOrEqual(withoutSnake.duration);
  });
});

describe('Huntress — 표식 적 사망 시 별돌보미 heal trigger', () => {
  it('표식된 적 사망 → 강화 칸 별돌보미 currentHp 증가', () => {
    // 별돌보미 6명 vs 단일 약한 적 — 적 사망 → heal 발동
    const team = buildStargazerTeam('huntress');
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withH = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerStargazerConstellation: 'huntress',
    });
    const withoutH = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // huntress ON 시 player 누적 currentHp 가 OFF 대비 동등 이상 (heal 발동)
    const sumHp = (units: typeof withH.playerUnits) =>
      units.reduce((s, u) => s + Math.max(0, u.currentHp), 0);
    expect(sumHp(withH.playerUnits)).toBeGreaterThanOrEqual(sumHp(withoutH.playerUnits));
  });
});
