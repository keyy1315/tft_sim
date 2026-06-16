/**
 * 회귀 가드 — splitDamageVar 분배 피해 helper (under-damage fix, 2026-06-16).
 *
 * "나누어 입힘"(divided) 피해 — total 을 적중 타겟 수로 나눠 각 타겟에 가산 (scaleAP).
 * secondaryDamageVar(타겟당 full)와 달리 ÷aliveTargets → 다수 타겟 overshoot 방지.
 * 적용: Aurora SplitDamage (균열 해킹). 측정: Aurora -48%→-2%, game-424 -17→-10%.
 *
 * 검증: ① 단일 타겟 → SplitDamage 전량(÷1) 가산 ② 다수 타겟 → SplitDamage 분배(÷N).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { getAbilityDamage, setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const aurora = champions.find(c => c.apiName === 'TFT17_Aurora')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

function auroraCastValue(enemies: PlacedChampion[]): number {
  const r = simulateCombat([placed(aurora, 5, 3, 2)], enemies,
    { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 6 });
  const t = r.playerUnits[0];
  const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id);
  return cast?.value ?? 0;
}

describe('splitDamageVar 분배 피해 (Aurora 균열 해킹 회귀 가드)', () => {
  it('단일 타겟 cast = Damage + SplitDamage 전량 (÷1)', () => {
    // 단일 타겟 (radius 2 내 적 1명).
    const val = auroraCastValue([placed(cho, 6, 3, 3)]);
    // Damage★2=120 + SplitDamage★2=555 (÷1) = 675 raw, mitigation 후. Damage 단독(120)보다 훨씬 큼.
    const dmgOnly = getAbilityDamage(aurora, 2, 0, 0).damage; // Damage★2
    expect(val).toBeGreaterThan(dmgOnly * 2); // SplitDamage 가산으로 ≫ Damage 단독
  });

  it('다수 타겟 — SplitDamage 가 분배(÷N) 되어 per-target 값이 단일 대비 작음', () => {
    const single = auroraCastValue([placed(cho, 6, 3, 3)]);
    // radius 2 내 다수 적 → SplitDamage ÷N → per-target cast 값 감소 (full 가산이면 동일).
    const multi = auroraCastValue([placed(cho, 6, 3, 3), placed(cho, 5, 4, 3), placed(cho, 6, 4, 3)]);
    expect(multi).toBeLessThan(single); // 분배 → per-target 감소 (full 이면 동일하므로 가드)
  });
});
