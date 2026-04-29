/**
 * 암흑의 별 (DarkStar) trait 회귀 가드 — (4)+ tier ADAP=45 가산.
 *
 * Spec (TFT17_DarkStar):
 *   (2) 8% maxHP 이하 적 execute 블랙홀 — 후속 PR
 *   (4) 추가로 ADAP=45% AD/AP — 본 PR 범위
 *   (6) 가장 강한 암흑의 별 unit Supermassive — 후속 PR
 *
 * 암흑의 별 챔프 (6명): Kaisa, Karma, Jhin, Chogath, Lissandra, Mordekaiser.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apKaisa = champions.find((c) => c.apiName === 'TFT17_Kaisa')!;
const apKarma = champions.find((c) => c.apiName === 'TFT17_Karma')!;
const apJhin = champions.find((c) => c.apiName === 'TFT17_Jhin')!;
const apChogath = champions.find((c) => c.apiName === 'TFT17_Chogath')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('DarkStar — (4) tier 활성 시 암흑의 별 unit ADAP +45%', () => {
  it('암흑의 별 4명 → Kaisa AD/AP 증가 vs (2) tier baseline', () => {
    const team4 = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
    ];
    const team2 = [
      placed(apKaisa, 0, 0),
      placed(apChogath, 1, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result4 = simulateCombat(team4, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result2 = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const kaisa4 = result4.playerUnits.find(u => u.champion.apiName === 'TFT17_Kaisa')!;
    const kaisa2 = result2.playerUnits.find(u => u.champion.apiName === 'TFT17_Kaisa')!;
    // (4) tier ADAP=45% → AD/AP 가 (2) tier 보다 큼
    expect(kaisa4.stats.damage).toBeGreaterThan(kaisa2.stats.damage);
    expect(kaisa4.stats.ap).toBeGreaterThan(kaisa2.stats.ap);
  });
});

describe('DarkStar — (2) tier 시 ADAP 미적용', () => {
  it('암흑의 별 2명 → Kaisa AD 가 1명 baseline 과 동일 (ADAP 적용 안 됨)', () => {
    const team2 = [
      placed(apKaisa, 0, 0),
      placed(apChogath, 1, 0),
    ];
    const team1 = [placed(apKaisa, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result2 = simulateCombat(team2, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const result1 = simulateCombat(team1, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const kaisa2 = result2.playerUnits.find(u => u.champion.apiName === 'TFT17_Kaisa')!;
    const kaisa1 = result1.playerUnits.find(u => u.champion.apiName === 'TFT17_Kaisa')!;
    // (2) tier 는 ADAP 적용 안 됨 → 동일
    expect(kaisa2.stats.damage).toBe(kaisa1.stats.damage);
    expect(kaisa2.stats.ap).toBe(kaisa1.stats.ap);
  });
});

describe('DarkStar — 비-암흑의 별 unit 영향 없음', () => {
  it('암흑의 별 4명 + TwistedFate (비-암흑의 별) → TF AD/AP 변화 없음', () => {
    const teamWithDS = [
      placed(apKaisa, 0, 0),
      placed(apKarma, 1, 0),
      placed(apJhin, 2, 0),
      placed(apChogath, 3, 0),
      placed(apTwistedFate, 4, 0),
    ];
    const teamWithoutDS = [placed(apTwistedFate, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const withDS = simulateCombat(teamWithDS, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const withoutDS = simulateCombat(teamWithoutDS, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tfWithDS = withDS.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    const tfWithoutDS = withoutDS.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // TwistedFate 는 비-암흑의 별 → DarkStar 효과 무관, 동일.
    expect(tfWithDS.stats.damage).toBe(tfWithoutDS.stats.damage);
    expect(tfWithDS.stats.ap).toBe(tfWithoutDS.stats.ap);
  });
});
