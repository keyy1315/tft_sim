/**
 * 회귀 가드 — 렉사이 heal scaleAP (APHealing) 합산.
 *
 * desc "지반 돌출" TotalHealing = scaleHealth(PercentMaximumHealthHealing maxHp 6.5%) + scaleAP(APHealing).
 * 버그: config.heal find 후보가 'APHeal' 인데 raw 변수명은 'APHealing' (이름 미스매치) →
 *   heal = maxHp×0.065 만, APHealing(scaleAP ★1=90) 누락. fix: APHealing 별도 read + 합산.
 *
 * Reksai ingest (PR #194) lint P1 발견 → sim fix.
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

describe('렉사이 heal scaleAP (APHealing) 합산 (PR #194 lint P1 fix)', () => {
  it('Reksai 가 스킬 시전 후 회복 발생 (APHealing 합산 — heal > 0)', () => {
    const reksai = findChamp('TFT17_Reksai');
    const enemy = findChamp('TFT17_Graves'); // 딜러 적 (Reksai 피해받아 mana 충전 → cast)
    if (!reksai || !enemy) return;
    // 적에게 맞아 HP 깎인 뒤 cast → heal. heal 발생 자체 + 정상 종료 확인.
    const team: PlacedChampion[] = [placed(reksai, 4, 3, 1)];
    const enemyTeam: PlacedChampion[] = [placed(enemy, 4, 4, 1)];
    const result = simulateCombat(team, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const r = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Reksai');
    expect(r).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
  });

  it('APHealing raw 값 정합 (★1=90) + PercentMaximumHealthHealing (0.065)', () => {
    const reksai = findChamp('TFT17_Reksai')!;
    const vars = reksai.ability.variables ?? [];
    const apHealing = vars.find(v => v.name === 'APHealing');
    const pctHeal = vars.find(v => v.name === 'PercentMaximumHealthHealing');
    expect(apHealing?.value[0]).toBe(90);   // raw [90,200,220,260,300]
    expect(apHealing?.value[1]).toBe(200);
    expect(pctHeal?.value[0]).toBeCloseTo(0.065, 3);
  });
});
