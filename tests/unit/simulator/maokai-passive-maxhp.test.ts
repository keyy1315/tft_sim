/**
 * 회귀 가드 — 마오카이 passive maxHp +50% (PassiveRatio 0.5).
 *
 * desc "모든 요소로부터 최대 체력을 50% 더 얻습니다" — applyMaokaiPassive 가 combat-start 에
 * maxHp × 1.5 적용 (Brawler/Astronaut maxHp 이후, Stargazer mark 선택 전).
 *
 * 버그: PassiveRatio sim 미반영 (grep 0) 이던 것을 applyMaokaiPassive 로 구현.
 * Maokai ingest (PR #189) lint P1 발견.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();

function findChamp(apiName: string): RawChampion | undefined {
  return champions.find(c => c.apiName === apiName);
}

function placed(c: RawChampion, q: number, r: number, starLevel = 1): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('마오카이 passive maxHp +50% (PR #189 lint P1 fix)', () => {
  it('Maokai ★1 단독 (싸움꾼 비활성) maxHp = base hp × 1.5', () => {
    const maokai = findChamp('TFT17_Maokai');
    const enemy = findChamp('TFT17_Aatrox'); // 임의 적 (싸움꾼 아님)
    if (!maokai || !enemy) return;
    const baseHp = maokai.stats.hp; // raw 1100 (★1 base)
    const team: PlacedChampion[] = [placed(maokai, 0, 0, 1)];
    const enemyTeam: PlacedChampion[] = [placed(enemy, 6, 3, 1)];
    const result = simulateCombat(team, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const m = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Maokai');
    expect(m).toBeDefined();
    // 단독이라 싸움꾼(minUnits 2)/teamwideBonus 비활성 → passive ×1.5 만 적용
    expect(m!.maxHp).toBeCloseTo(baseHp * 1.5, 0);
  });

  it('Maokai 가 아닌 챔프는 passive maxHp 증폭 없음 (회귀 가드)', () => {
    const aatrox = findChamp('TFT17_Aatrox');
    const enemy = findChamp('TFT17_Maokai');
    if (!aatrox || !enemy) return;
    const baseHp = aatrox.stats.hp;
    const team: PlacedChampion[] = [placed(aatrox, 0, 0, 1)];
    const enemyTeam: PlacedChampion[] = [placed(enemy, 6, 3, 1)];
    const result = simulateCombat(team, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const a = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Aatrox');
    expect(a).toBeDefined();
    // Aatrox 단독, 요새/NOVA 단독 비활성 → maxHp = base (passive 증폭 없음)
    expect(a!.maxHp).toBeCloseTo(baseHp, 0);
  });
});
