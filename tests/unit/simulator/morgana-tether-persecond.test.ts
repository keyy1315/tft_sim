/**
 * 회귀 가드 — 모르가나(Morgana) 어둠의 형상 사슬 DOT 초당값 × duration (under-damage fix, 2026-06-16).
 *
 * Morgana 「어둠의 형상」 사슬 피해 var = TetherDamagePerSecond 는 **매초** 값인데 dot 이
 * 총량 처리하던 것을 dot.perSecond 로 × Duration(5) 정정
 * (Bard #241 / Viktor #252 / AurelionSol #253 / Pantheon #254 동형).
 * 미측정 챔프(diff-cache playerDamage 부재)라 unit test 로 검증.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { getAbilityDamage, setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const morg = champions.find(c => c.apiName === 'TFT17_Morgana')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

describe('모르가나 어둠의 형상 사슬 DOT 초당값×duration (회귀 가드)', () => {
  it('cast DOT 총량 = TetherDamagePerSecond★ × Duration(5) — 초당값 ×5', () => {
    const r = simulateCombat(
      [placed(morg, 2, 3, 2)],
      [placed(cho, 5, 2, 2), placed(cho, 5, 3, 2), placed(cho, 5, 4, 2)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 4 },
    );
    const t = r.playerUnits[0];
    const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id && /지속 피해/.test(l.message ?? ''));
    expect(cast).toBeDefined();
    const dmg = getAbilityDamage(morg, 2, 0, 0).damage; // TetherDamagePerSecond★2=75 (per-second)
    expect(cast!.value ?? 0).toBeGreaterThan(dmg * 4); // ×5 (perSecond)
  });
});
