/**
 * 회귀 가드 — 아우렐리온 솔(AurelionSol) 죽음의 광선 DOT 초당값 × duration (under-damage fix, 2026-06-16).
 *
 * AurelionSol 「죽음의 광선」 유일 damage var = DamagePerSecond 는 **매초** 값인데 dot 이
 * 총량 처리하던 것을 dot.perSecond 로 × Duration(3) 정정 (Bard #241 / Viktor #252 동형).
 * 미측정 챔프라 unit test 로 검증.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { getAbilityDamage, setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const asol = champions.find(c => c.apiName === 'TFT17_AurelionSol')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

describe('아우렐리온 솔 죽음의 광선 DOT 초당값×duration (회귀 가드)', () => {
  it('cast DOT 총량 = DamagePerSecond★ × Duration(3) — 초당값 ×3', () => {
    const r = simulateCombat(
      [placed(asol, 5, 3, 2)],
      [placed(cho, 6, 3, 3), placed(cho, 7, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 6 },
    );
    const t = r.playerUnits[0];
    const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id && /시전/.test(l.message));
    expect(cast).toBeDefined();
    const dmg = getAbilityDamage(asol, 2, 0, 0).damage; // DamagePerSecond★2 (per-second)
    expect(cast!.value ?? 0).toBeGreaterThan(dmg * 2.5); // ×3 (perSecond)
  });
});
