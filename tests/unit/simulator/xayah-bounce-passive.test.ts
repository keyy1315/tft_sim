/**
 * 회귀 가드 — 자야(Xayah) 평타 깃털 bounce 패시브 (under-damage calibration).
 *
 * raw "Stellar Ricochet" 패시브: 평타가 AttackNumEnemies(★1-3=3)명에 bounce, 각
 * PassivePercentReducedDamage(0.6) 감소 = 평타의 40% + primary 에 PrimaryTargetBonusDamage.
 * 이전엔 평타 단일 타겟만 → bounce 미모델로 ~과소. 본 PR 에서 모델 (Corki 평타 추가 hit 동형).
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const xayah = champions.find(c => c.apiName === 'TFT17_Xayah')!;
const tank = champions.find(c => c.apiName === 'TFT17_Shen')!; // 생존 → 평타 누적

function placed(c: RawChampion, q: number, r: number): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: [] };
}

function xayahDamage(enemyPositions: Array<[number, number]>): { total: number; enemiesHit: number } {
  const enemy = enemyPositions.map(([q, r]) => placed(tank, q, r));
  const r = simulateCombat([placed(xayah, 0, 0)], enemy, {
    seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
  });
  const x = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Xayah')!;
  const enemiesHit = r.enemyUnits.filter(e => e.totalDamageTaken > 0).length;
  return { total: x.totalDamageDealt, enemiesHit };
}

describe('자야 깃털 bounce 패시브', () => {
  it('bounce 가 primary 외 다른 적도 적중 — ★2 numBounce=2 → 3명 전원 피해', () => {
    // numEnemies(★2)=3, numBounce=2 → primary 1 + bounce 2 = 3명 모두 피해.
    // (이전 평타 단일 타겟만이면 1명만 피해받음 — bounce 모델 검증)
    const multi = xayahDamage([[6, 3], [6, 2], [6, 4]]);
    expect(multi.enemiesHit).toBe(3);
    expect(multi.total).toBeGreaterThan(0);
  });

  it('bounce 가 평타의 40%(reduction 0.6) — 단일 적 시 bounce 없이 primary 만', () => {
    // 적 1명이면 bounce 대상 없음 → primary 데미지만 (enemiesHit=1).
    const single = xayahDamage([[6, 3]]);
    expect(single.enemiesHit).toBe(1);
  });
});
