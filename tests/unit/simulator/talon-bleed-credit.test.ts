/**
 * 회귀 가드 — 탈론(Talon) bleed DOT(burn) 가 dealer totalDamageDealt 에 귀속 (PR #234).
 *
 * 버그 (under-damage 재진단 2026-06-15 발견): Talon 의 '점술가의 심판' bleed 는 `dot:{duration:18}`
 * 로 **burn statusEffect** 적용되는데, burn tick(tickStatusEffects)이 target HP 만 차감하고
 * dealer totalDamageDealt 에 미집계 → Talon(및 모든 burn-DOT 챔프 Bard/Viktor/Nasus 등) 의
 * 주력 데미지가 calibration 에 안 잡혀 -79% under. (poison 은 PR #231 에서 이미 크레딧)
 * fix: tickStatusEffects burn/poison 통합 — per-tick victim/dealer 귀속 + lethal source-aware 사망.
 *
 * Talon★3 인접 vs Chogath★3 고HP: bleed 4회 cast 풀 틱 → totalDamageDealt ~2300 (bleed 미크레딧 시 autos 만).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const talon = champions.find(c => c.apiName === 'TFT17_Talon')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3 = 2): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

describe('탈론 bleed DOT 크레딧 (PR #234 회귀 가드)', () => {
  it('bleed(burn DOT) 가 totalDamageDealt 에 귀속 — autos 단독 대비 대폭 증가', () => {
    const r = simulateCombat([placed(talon, 5, 3, 3)], [placed(cho, 6, 3, 3)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const t = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Talon')!;
    // bleed 4회 cast 풀 틱 시 ~2300. bleed 미크레딧(autos 만) 이면 훨씬 낮음.
    expect(t.totalDamageDealt).toBeGreaterThan(1500);
  });
});
