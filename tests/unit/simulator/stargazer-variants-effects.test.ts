/**
 * 6 별자리 변종 effects 회귀 가드 (PR-3).
 *
 * 각 변종마다:
 *   1. 강화 칸 모든 아군 (별돌보미 trait 무관) — *_Teamwide 변수
 *   2. 강화 칸 별돌보미 추가 — 비-Teamwide 변수
 *
 * 강화 칸 패턴: CONSTELLATION_TILE_PATTERN. 강화 칸 외 unit 은 변화 없음.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { CONSTELLATION_TILE_PATTERN } from '@/lib/actualData/stargazerMapping';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';
import type { StargazerConstellationId } from '@/lib/actualData/types';

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

/** 별돌보미 6명을 해당 별자리 강화 칸의 첫 6개 tile 에 배치한 ally team 빌드. */
function buildStargazerTeam(constellation: StargazerConstellationId): PlacedChampion[] {
  const tiles = CONSTELLATION_TILE_PATTERN[constellation];
  if (tiles.length < 6) throw new Error(`tile count <6 for ${constellation}`);
  const champs = [apTwistedFate, apTalon, apJax];
  const emblemChamps = [apAatrox, apMilio, apCorki];
  return [
    ...champs.map((c, i) => placed(c, tiles[i].q, tiles[i].r)),
    ...emblemChamps.map((c, i) => placed(c, tiles[3 + i].q, tiles[3 + i].r, [STARGAZER_EMBLEM])),
  ];
}

function simWith(constellation: StargazerConstellationId | undefined, ally: PlacedChampion[]) {
  return simulateCombat(ally, [placed(dummyEnemy, 6, 3)], {
    seed: 0,
    allTraits: traits,
    skipMirror: true,
    stageNumber: 5,
    playerStargazerConstellation: constellation,
    enemyStargazerConstellation: constellation,
  });
}

describe('Wolf 변종 — 강화 칸 모든 아군 + 별돌보미 추가', () => {
  it('teamwide: 강화 칸 비-별돌보미 unit 도 HP/AD/AP 8% 증가', () => {
    // (멧돼지) — TwistedFate 별돌보미, 비-별돌보미 unit 비교
    const ally = buildStargazerTeam('boar');
    const withC = simWith('boar', ally);
    const without = simWith(undefined, ally);
    const tf = withC.playerUnits[0]; // TwistedFate
    const tfBase = without.playerUnits[0];
    // (3) 단계 — Wolf_Health_Teamwide=0.08 + Wolf_Health=0.02 + Wolf_ADAP=10
    // TwistedFate (별돌보미) 합산: HP × 1.08 × 1.02 ≈ 1.10, AD × 1.08 × 1.10 ≈ 1.188
    expect(tf.maxHp / tfBase.maxHp).toBeGreaterThan(1.08);
  });
});

describe('Medallion 변종 — 강화 칸 모든 아군 피해증폭', () => {
  it('teamwide damageAmp 증가, 비-강화 칸 영향 없음', () => {
    const ally = buildStargazerTeam('medal');
    const withC = simWith('medal', ally);
    const without = simWith(undefined, ally);
    const u = withC.playerUnits[0];
    const ub = without.playerUnits[0];
    // (3) Medallion_DA=12 + IncreasePer3Star × 3성 수. 3성 0명 → 12% damageAmp
    expect(u.damageAmp - ub.damageAmp).toBeCloseTo(0.12, 2);
  });
});

describe('Huntress 변종 — Teamwide AS + 별돌보미 추가 AS', () => {
  it('강화 칸 별돌보미 AS 가 base 대비 큰 폭 증가', () => {
    const ally = buildStargazerTeam('huntress');
    const withC = simWith('huntress', ally);
    const without = simWith(undefined, ally);
    // 17.4: (5) Huntress_AS_Teamwide=0.12 + Huntress_AS=0.45 — 별돌보미 합산: 1.12 × 1.45 = 1.624
    // (이전 17.3: AS_Teamwide=0.15 + AS=0.35 = 1.15 × 1.35 = 1.5525)
    const tf = withC.playerUnits[0]; // TwistedFate (별돌보미 + 강화 칸)
    const tfBase = without.playerUnits[0];
    expect(tf.stats.attackSpeed / tfBase.stats.attackSpeed).toBeGreaterThan(1.20);
  });
});

describe('Serpent 변종 — Teamwide DR + 별돌보미 추가 DR', () => {
  it('강화 칸 별돌보미 damageReduction 합산 증가', () => {
    const ally = buildStargazerTeam('snake');
    const withC = simWith('snake', ally);
    const without = simWith(undefined, ally);
    const tf = withC.playerUnits[0]; // 별돌보미
    const tfBase = without.playerUnits[0];
    // count=6 → minUnits=5 활성: DR_Teamwide=0.05 + DR=0.10 = 0.15 합산
    expect(tf.damageReduction - tfBase.damageReduction).toBeCloseTo(0.15, 2);
  });
});

describe('Shield 변종 — Teamwide HP/AS (percentage points → fraction 변환)', () => {
  it('강화 칸 모든 unit HP/AS 8% 증가', () => {
    const ally = buildStargazerTeam('altar');
    const withC = simWith('altar', ally);
    const without = simWith(undefined, ally);
    const tf = withC.playerUnits[0];
    const tfBase = without.playerUnits[0];
    // Shield_Health_Teamwide=8 (pts) = 0.08 fraction
    expect(tf.maxHp / tfBase.maxHp).toBeCloseTo(1.08, 2);
    expect(tf.stats.attackSpeed / tfBase.stats.attackSpeed).toBeGreaterThan(1.06);
  });
});

// 17.2 LIVE: Fountain 변수 완전 재설계됨 (Fountain_ManaRegen / Fountain_ManaRegen_Teamwide
// raw 에서 제거, hash 키로 변경) → 시뮬 효과 0 으로 자연 무효화. 메커니즘 마이그 후 .skip 제거.
describe.skip('Fountain 변종 — Teamwide ManaRegen + 별돌보미 추가 (17.2 마이그 대기)', () => {
  it('강화 칸 별돌보미 augmentManaRegen 증가', () => {
    const ally = buildStargazerTeam('well');
    const withC = simWith('well', ally);
    const without = simWith(undefined, ally);
    const tf = withC.playerUnits[0];
    const tfBase = without.playerUnits[0];
    // (3) Fountain_ManaRegen_Teamwide=1 + Fountain_ManaRegen=1 (별돌보미 추가) = +2
    expect(tf.augmentManaRegen - tfBase.augmentManaRegen).toBeGreaterThanOrEqual(2);
  });
});

describe('Enemy 팀 (mirror r=4..7) 도 강화 칸 효과 받음', () => {
  it('skipMirror=false 패턴에서 enemy 별돌보미 unit 도 buff 적용 (PR10 spec — 180° 회전)', () => {
    // PR10 spec: B팀 own-frame 의 Mountain 강화 칸 = A팀 패턴의 180° 회전 (3-r, 6-c).
    // Mountain pattern.r=3 cols {0,1,5,6} → B own-frame r=0 cols {6,5,1,0} (B 등록 4칸).
    // Mountain pattern.r=2 cols {1,6}      → B own-frame r=1 cols {5,0}        (B 등록 2칸).
    // 별돌보미 6명 배치 — q = offset col - floor(r/2). enemy own-frame r=0..1 → q=col.
    const enemyAlly: PlacedChampion[] = [
      placed(apTwistedFate, 0, 0),  // own (0, 0) → pattern (3, 6) ✓ Mountain r=3 col=6
      placed(apTalon, 1, 0),         // own (0, 1) → pattern (3, 5) ✓
      placed(apJax, 5, 0),           // own (0, 5) → pattern (3, 1) ✓
      placed(apAatrox, 6, 0, [STARGAZER_EMBLEM]),  // own (0, 6) → pattern (3, 0) ✓
      placed(apMilio, 0, 1, [STARGAZER_EMBLEM]),   // own (1, 0) → pattern (2, 6) ✓ Mountain r=2 col=6
      placed(apCorki, 5, 1, [STARGAZER_EMBLEM]),   // own (1, 5) → pattern (2, 1) ✓
    ];
    const playerDummy: PlacedChampion[] = [placed(dummyEnemy, 0, 3)];
    // skipMirror 미지정 → 기본 false → enemy 자동 mirror 됨 (r=4..7 위치)
    const withC = simulateCombat(playerDummy, enemyAlly, {
      seed: 0,
      allTraits: traits,
      playerStargazerConstellation: 'mountain',
      enemyStargazerConstellation: 'mountain',
    });
    const without = simulateCombat(playerDummy, enemyAlly, {
      seed: 0,
      allTraits: traits,
    });
    // enemyUnits 에는 mirror 된 좌표로 들어감. mountain 효과는 r=0..3 강화 칸 정의를
    // mirror back 해서 검사 → enemy 측도 동일 buff 받음 (별돌보미 6명).
    const enemyUnitWith = withC.enemyUnits.find((u) => u.champion.apiName === 'TFT17_TwistedFate')!;
    const enemyUnitBase = without.enemyUnits.find((u) => u.champion.apiName === 'TFT17_TwistedFate')!;
    // 17.2: Mountain_Health 0.12 → 0.15
    expect(enemyUnitWith.maxHp / enemyUnitBase.maxHp).toBeCloseTo(1.15, 2);
  });
});

describe('강화 칸 외부 unit 은 변종 효과 무관', () => {
  it('강화 칸 밖 placement 의 unit 은 stat 변화 없음', () => {
    // 모든 unit 을 강화 칸 외 좌표에 배치 (예: medal 패턴은 (0,0) (1,0) 미포함)
    const ally: PlacedChampion[] = [
      placed(apTwistedFate, 0, 0),
      placed(apTalon, 1, 0),
      placed(apJax, 6, 0),
    ];
    const withC = simWith('medal', ally);
    const without = simWith(undefined, ally);
    // 모든 unit 이 강화 칸 외 — Medallion teamwide 효과 없음
    for (let i = 0; i < ally.length; i++) {
      expect(withC.playerUnits[i].damageAmp).toBe(without.playerUnits[i].damageAmp);
    }
  });
});
