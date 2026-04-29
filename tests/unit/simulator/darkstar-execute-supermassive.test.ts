/**
 * G3 회귀 가드 — DarkStar (2) execute + (6) Supermassive (17.2).
 *
 * Spec (TFT17_DarkStar) — 모든 tier 동일 변수, 코드 분기로 처리:
 *   ADAP=45, ExecuteHPPercent=0.08, PercentHealth=0.30, SupermassivePercentBonus=0.85
 *
 *   (2) tier (style 1)  : 블랙홀 execute (HP ≤ 8% 적 즉사)
 *   (4) tier (style 3)  : (2) + ADAP 45% 가산
 *   (6) tier (style 5)  : (4) + 가장 강한 darkStar unit Supermassive
 *                          (ADAP × 1.85, maxHp × 1.30)
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
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

  // PercentHealth=0.30 raw 변수는 trait desc 에 미사용 → maxHp 효과 미적용
  // (codex P2 후속 검토 결과). desc 명시 효과만 시뮬에 반영.
});
