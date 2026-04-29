/**
 * 회귀 가드 — 암흑의 별 (6) tier 자동 소형 블랙홀 2개 spawn.
 *
 * 17.2 게임 spec: "(6) 암흑의 별: 가장 강한 darkStar unit Supermassive +
 *                 소형 블랙홀 2개 생성"
 * 시뮬: useTeamManagement.syncDarkStarBlackholesInTeam — darkStarStyle ≥ 5 시 추가.
 */
import { describe, it, expect } from 'vitest';
import { syncDarkStarBlackholesInTeam } from '@/hooks/useTeamManagement';
import { DARKSTAR_BLACKHOLE_CHAMPION } from '@/data/specialUnits';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions } = loadServerCatalogs();
const apKaisa = champions.find(c => c.apiName === 'TFT17_Kaisa')!;

function placed(c: RawChampion, q: number, r: number): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: [] };
}

describe('syncDarkStarBlackholesInTeam — (6) tier 자동 spawn', () => {
  it('darkStarStyle ≥ 5 ((6)+ tier 활성) → 소형 블랙홀 2개 추가', () => {
    const team: PlacedChampion[] = [placed(apKaisa, 0, 0)];
    const result = syncDarkStarBlackholesInTeam(team, 5);
    const blackholes = result.filter(p => p.champion.apiName === DARKSTAR_BLACKHOLE_CHAMPION.apiName);
    expect(blackholes).toHaveLength(2);
    // 위치는 빈 hex 자동 할당
    expect(blackholes[0].position).toBeDefined();
    expect(blackholes[1].position).toBeDefined();
    expect(blackholes[0].position).not.toEqual(blackholes[1].position);
  });

  it('darkStarStyle = 3 ((4) tier 만 활성) → 블랙홀 spawn 없음', () => {
    const team: PlacedChampion[] = [placed(apKaisa, 0, 0)];
    const result = syncDarkStarBlackholesInTeam(team, 3);
    const blackholes = result.filter(p => p.champion.apiName === DARKSTAR_BLACKHOLE_CHAMPION.apiName);
    expect(blackholes).toHaveLength(0);
  });

  it('darkStarStyle = 0 (미활성) → 블랙홀 없음', () => {
    const team: PlacedChampion[] = [placed(apKaisa, 0, 0)];
    const result = syncDarkStarBlackholesInTeam(team, 0);
    const blackholes = result.filter(p => p.champion.apiName === DARKSTAR_BLACKHOLE_CHAMPION.apiName);
    expect(blackholes).toHaveLength(0);
  });

  it('이미 2개 있으면 그대로 유지 (idempotent)', () => {
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      { champion: DARKSTAR_BLACKHOLE_CHAMPION, position: { q: 1, r: 1 }, starLevel: 1, items: [], isSummon: true },
      { champion: DARKSTAR_BLACKHOLE_CHAMPION, position: { q: 2, r: 1 }, starLevel: 1, items: [], isSummon: true },
    ];
    const result = syncDarkStarBlackholesInTeam(team, 5);
    const blackholes = result.filter(p => p.champion.apiName === DARKSTAR_BLACKHOLE_CHAMPION.apiName);
    expect(blackholes).toHaveLength(2);
    expect(blackholes[0].position).toEqual({ q: 1, r: 1 });
    expect(blackholes[1].position).toEqual({ q: 2, r: 1 });
  });

  it('시너지 비활성 시 기존 블랙홀 자동 제거', () => {
    const team: PlacedChampion[] = [
      placed(apKaisa, 0, 0),
      { champion: DARKSTAR_BLACKHOLE_CHAMPION, position: { q: 1, r: 1 }, starLevel: 1, items: [], isSummon: true },
      { champion: DARKSTAR_BLACKHOLE_CHAMPION, position: { q: 2, r: 1 }, starLevel: 1, items: [], isSummon: true },
    ];
    const result = syncDarkStarBlackholesInTeam(team, 0);
    const blackholes = result.filter(p => p.champion.apiName === DARKSTAR_BLACKHOLE_CHAMPION.apiName);
    expect(blackholes).toHaveLength(0);
    expect(result.filter(p => p.champion.apiName === 'TFT17_Kaisa')).toHaveLength(1);
  });

  it('블랙홀 unit 은 isSummon: true + items 빈 배열', () => {
    const team: PlacedChampion[] = [placed(apKaisa, 0, 0)];
    const result = syncDarkStarBlackholesInTeam(team, 5);
    const blackholes = result.filter(p => p.champion.apiName === DARKSTAR_BLACKHOLE_CHAMPION.apiName);
    for (const bh of blackholes) {
      expect(bh.isSummon).toBe(true);
      expect(bh.items).toEqual([]);
      expect(bh.starLevel).toBe(1);
    }
  });

  it('블랙홀 champion stats: range=0, attackSpeed=0, damage=0 (이동/공격 비활성)', () => {
    expect(DARKSTAR_BLACKHOLE_CHAMPION.stats.range).toBe(0);
    expect(DARKSTAR_BLACKHOLE_CHAMPION.stats.attackSpeed).toBe(0);
    expect(DARKSTAR_BLACKHOLE_CHAMPION.stats.damage).toBe(0);
  });
});
