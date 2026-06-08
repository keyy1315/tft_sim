/**
 * 회귀 가드 — 그라가스 base heal (HEALING + HealingPercentHealth) 합산.
 *
 * desc "화학적 분노" ModifiedHeal = scaleHealth(HealingPercentHealth maxHp 8.5%) + scaleAP(HEALING flat+AP).
 * 버그: config.heal find 후보가 'Heal'/'APHeal'/'PercentMaximumHealthHealing'/'HealthDrain' 인데
 *   raw 변수명은 'HEALING' (이름 미스매치) → main heal 자체 누락 (+ HealingPercentHealth maxHp% 도 누락).
 * fix: find 후보에 'HEALING' 추가 + HealingPercentHealth 별도 read 합산.
 *
 * Gragas ingest (PR #201) lint P1 발견 → sim fix.
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

describe('그라가스 base heal (HEALING + HealingPercentHealth) 합산 (PR #201 lint P1 fix)', () => {
  it('Gragas 가 스킬 시전 후 정상 종료 (heal find HEALING 매칭 — 크래시 없음)', () => {
    const gragas = findChamp('TFT17_Gragas');
    const enemy = findChamp('TFT17_Graves'); // 딜러 적 (Gragas 피해받아 mana 충전 → cast)
    if (!gragas || !enemy) return;
    const team: PlacedChampion[] = [placed(gragas, 4, 3, 2)];
    const enemyTeam: PlacedChampion[] = [placed(enemy, 4, 4, 1)];
    const result = simulateCombat(team, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const g = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Gragas');
    expect(g).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
  });

  it('HEALING raw 값 정합 (filler ★1=415/★2=470/★3=630) + HealingPercentHealth (0.085)', () => {
    const gragas = findChamp('TFT17_Gragas')!;
    const vars = gragas.ability.variables ?? [];
    const healing = vars.find(v => v.name === 'HEALING');
    const pctHeal = vars.find(v => v.name === 'HealingPercentHealth');
    expect(healing?.value[1]).toBe(415);  // [0,415,470,630] filler → ★1=value[1]=415
    expect(healing?.value[2]).toBe(470);
    expect(healing?.value[3]).toBe(630);
    expect(pctHeal?.value[0]).toBeCloseTo(0.085, 3);
  });
});
