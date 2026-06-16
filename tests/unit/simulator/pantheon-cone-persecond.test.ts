/**
 * 회귀 가드 — 판테온(Pantheon) 고급 방어술 원뿔 DOT 초당값 × duration (under-damage fix, 2026-06-16).
 *
 * Pantheon 「고급 방어술」 원뿔 피해 var = TrueDamagePerSecond 는 **매초** 값인데 dot 이
 * 총량 처리하던 것을 dot.perSecond 로 × Duration(4) 정정 (Bard #241 / Viktor #252 / AurelionSol #253 동형).
 * 미측정 챔프(game-423/424 부재)라 unit test 로 검증.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { getAbilityDamage, setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const pan = champions.find(c => c.apiName === 'TFT17_Pantheon')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

describe('판테온 고급 방어술 원뿔 DOT 초당값×duration (회귀 가드)', () => {
  it('cast DOT 총량 = TrueDamagePerSecond★ × Duration(4) — 초당값 ×4', () => {
    const r = simulateCombat(
      [placed(pan, 2, 3, 2)],
      [placed(cho, 5, 2, 2), placed(cho, 5, 3, 2), placed(cho, 5, 4, 2)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 4 },
    );
    const t = r.playerUnits[0];
    const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id && /지속 피해/.test(l.message ?? ''));
    expect(cast).toBeDefined();
    const dmg = getAbilityDamage(pan, 2, 0, 0).damage; // TrueDamagePerSecond★2=45 (per-second)
    expect(cast!.value ?? 0).toBeGreaterThan(dmg * 3.5); // ×4 (perSecond)
  });
});
