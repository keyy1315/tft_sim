/**
 * G3 회귀 가드 — DarkStar (2) execute + (6) Supermassive (17.2).
 *
 * Spec (TFT17_DarkStar) — 모든 tier 동일 변수, 코드 분기로 처리:
 *   ADAP=45, ExecuteHPPercent=0.08, PercentHealth=0.30, SupermassivePercentBonus=0.85
 *
 *   (2) tier (style 1)  : 블랙홀 execute (HP ≤ 8% 적 즉사)
 *   (4) tier (style 3)  : (2) + ADAP 45% 가산
 *   (6) tier (style 5)  : (4) + 가장 강한 darkStar unit Supermassive
 *                          (ADAP × 1.85, ExecuteHPPercent × 1.85)
 *                          + 소형 블랙홀 maxHp = (아군 darkStar maxHp 합) × 0.30
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { DARKSTAR_BLACKHOLE_CHAMPION } from '@/data/specialUnits';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();

// 암흑의 별 챔프 (6명)
const apKaisa = champions.find(c => c.apiName === 'TFT17_Kaisa')!;
const apKarma = champions.find(c => c.apiName === 'TFT17_Karma')!;
const apJhin = champions.find(c => c.apiName === 'TFT17_Jhin')!;
const apChogath = champions.find(c => c.apiName === 'TFT17_Chogath')!;
const apLissandra = champions.find(c => c.apiName === 'TFT17_Lissandra')!;
const apMordekaiser = champions.find(c => c.apiName === 'TFT17_Mordekaiser')!;
// 비-darkStar
const apTwistedFate = champions.find(c => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, starLevel: number = 2, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: eqItems };
}

describe('G3 — DarkStar (2) tier execute', () => {
  it('darkStar 2명 → execute threshold 활성 (ExecuteHPPercent=0.08)', () => {
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const kaisa = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Kaisa')!;
    const karma = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Karma')!;
    expect(kaisa.darkStarExecuteThreshold).toBeCloseTo(0.08, 3);
    expect(karma.darkStarExecuteThreshold).toBeCloseTo(0.08, 3);
  });

  it('darkStar 1명 → trait inactive, execute threshold 0', () => {
    const team: PlacedChampion[] = [placed(apKaisa, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const kaisa = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Kaisa')!;
    expect(kaisa.darkStarExecuteThreshold).toBe(0);
  });

  it('비-darkStar unit → execute threshold 0 (darkStar trait 활성이어도 본인은 미적용)', () => {
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apTwistedFate, 2, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.darkStarExecuteThreshold).toBe(0);
  });
});

describe('G3 — DarkStar (6) tier Supermassive', () => {
  it('darkStar 6명 → 가장 강한 unit Supermassive 활성 + maxHp +30%', () => {
    // 6명 모두 2성 → 동급 → maxHp 최고 unit 이 Supermassive (Mordekaiser 950 base)
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
      placed(apLissandra, 4, 0),
      placed(apMordekaiser, 5, 0), // 950 base hp — 가장 높음
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const supermassiveUnits = result.playerUnits.filter(u => u.darkStarSupermassive);
    expect(supermassiveUnits).toHaveLength(1);
    expect(supermassiveUnits[0].champion.apiName).toBe('TFT17_Mordekaiser');
  });

  it('darkStar 4명 ((6) tier 미활성) → Supermassive 없음', () => {
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const supermassive = result.playerUnits.filter(u => u.darkStarSupermassive);
    expect(supermassive).toHaveLength(0);
  });

  it('Supermassive unit 의 ADAP 가 일반 darkStar unit 보다 강함 (× 1.85)', () => {
    // 같은 챔프 (Mordekaiser) 2명 — Supermassive vs 일반 비교 어려움.
    // 대신 Mordekaiser (Supermassive) 와 Karma (일반) 의 AP 증가량 비교.
    // 둘 다 2성 동등. 17.2 raw AP 0 base — 모두 ADAP 만으로 결정.
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
      placed(apLissandra, 4, 0),
      placed(apMordekaiser, 5, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const mord = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Mordekaiser')!;
    const karma = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Karma')!;
    // Mordekaiser AP = base(0) + 45 + 45×0.85 ≈ 83.25
    // Karma AP = base(0) + 45
    expect(mord.stats.ap).toBeGreaterThan(karma.stats.ap);
    expect(mord.stats.ap - karma.stats.ap).toBeCloseTo(45 * 0.85, 0);
  });

  it('Supermassive unit 의 ExecuteHPPercent 도 +85% 강화 (codex P1 회귀 가드)', () => {
    // desc: "암흑의 별 효과 +85% 증가" → ADAP + ExecuteHPPercent 둘 다 +85%.
    // base 0.08 × 1.85 ≈ 0.148. 일반 darkStar unit 은 그대로 0.08.
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
      placed(apLissandra, 4, 0),
      placed(apMordekaiser, 5, 0), // strongest (hp 950)
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const mord = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Mordekaiser')!;
    const karma = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Karma')!;
    // Supermassive (Mord): 0.08 × 1.85 ≈ 0.148
    expect(mord.darkStarExecuteThreshold).toBeCloseTo(0.08 * 1.85, 3);
    // 일반 (Karma): 0.08
    expect(karma.darkStarExecuteThreshold).toBeCloseTo(0.08, 3);
  });
});

describe('G3 — 소형 블랙홀 maxHp 보정 (PercentHealth=0.30, FakeUnit ability desc)', () => {
  function placedBlackhole(q: number, r: number): PlacedChampion {
    return { champion: DARKSTAR_BLACKHOLE_CHAMPION, starLevel: 1, position: { q, r }, items: [], isSummon: true };
  }

  it('(6) DarkStar 활성 + 소형 블랙홀 2개 → maxHp = 아군 darkStar 합 × 30%', () => {
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
      placed(apLissandra, 4, 0),
      placed(apMordekaiser, 5, 0),
      placedBlackhole(0, 1),
      placedBlackhole(1, 1),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const blackholes = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_DarkStar_FakeUnit');
    expect(blackholes).toHaveLength(2);

    // 아군 darkStar maxHp 합산 (Brawler/Astronaut 등 buff 적용 후)
    const darkStarUnits = result.playerUnits.filter(u =>
      ['TFT17_Kaisa', 'TFT17_Karma', 'TFT17_Jhin', 'TFT17_Chogath', 'TFT17_Lissandra', 'TFT17_Mordekaiser']
        .includes(u.champion.apiName)
    );
    const totalHp = darkStarUnits.reduce((s, u) => s + u.maxHp, 0);
    const expectedBlackholeMax = 1 + Math.round(totalHp * 0.30);

    for (const bh of blackholes) {
      expect(bh.maxHp).toBe(expectedBlackholeMax);
      expect(bh.currentHp).toBe(bh.maxHp);
    }
  });

  it('(6) DarkStar 미활성 ((4) tier) → 블랙홀 maxHp 보정 없음 (raw hp=1 그대로)', () => {
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
      // 4명 only — (4) tier, supermassive 미발동
      placedBlackhole(0, 1),  // 비정상적이나 가드 목적
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const bh = result.playerUnits.find(u => u.champion.apiName === 'TFT17_DarkStar_FakeUnit');
    if (bh) {
      // (4) tier — supermassive 비활성 → 블랙홀 hp 보정 안 됨 (base 1)
      expect(bh.maxHp).toBe(1);
    }
  });

  it('블랙홀 maxHp 가 1보다 충분히 커서 첫 공격에 즉사하지 않음 (사용자 보고 회귀 가드)', () => {
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
      placed(apLissandra, 4, 0),
      placed(apMordekaiser, 5, 0),
      placedBlackhole(0, 1),
      placedBlackhole(1, 1),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const blackholes = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_DarkStar_FakeUnit');
    // base hp=1 였으면 합산 30% 보정 안 됐다는 신호 — 최소 100 이상 (실제론 darkStar hp 합 30% 라 수천대)
    for (const bh of blackholes) {
      expect(bh.maxHp).toBeGreaterThan(100);
    }
  });
});
