/**
 * 회귀 가드 — 바드(Bard) 비행접시 DOT 가 초당값 × duration (under-damage fix, 2026-06-15).
 *
 * 버그: Bard 「비행접시」는 Duration(4)초 동안 **매초** ModifiedDamagePerSecond(scaleAP) 마법 피해
 *   를 입히는데, sim dot 모델이 damageVar(DamagePerSecond)를 **총량**으로 4초에 분산 →
 *   초당값 × duration(4) 누락 = ~4× under (Bard -90%).
 * fix: dot.perSecond 플래그 → dotTotal = DamagePerSecond★ × duration. main + OOR cast path.
 *
 * 검증: Bard -90%→-84% (sim +93%, dot 부분 ×4). 잔여는 cast 빈도/split/duration (별개).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { getAbilityDamage, setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const bard = champions.find(c => c.apiName === 'TFT17_Bard')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

describe('바드 비행접시 DOT 초당값×duration (회귀 가드)', () => {
  it('cast DOT 총량 = DamagePerSecond★ × Duration(4) — 초당값 ×4', () => {
    const r = simulateCombat(
      [placed(bard, 5, 3, 2)],
      [placed(cho, 6, 3, 3), placed(cho, 7, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 6 },
    );
    const t = r.playerUnits[0];
    const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id && /시전/.test(l.message));
    expect(cast).toBeDefined();
    // dotTotal = DamagePerSecond★2 × 4. 버그(perSecond 누락) 시 ×1 (DamagePerSecond 만).
    const dps = getAbilityDamage(bard, 2, 0, 0).damage; // DamagePerSecond★2 (AP 0)
    expect(cast!.value ?? 0).toBeGreaterThan(dps * 3.5); // ×4 (AP scaling 포함 시 더 큼)
  });
});
