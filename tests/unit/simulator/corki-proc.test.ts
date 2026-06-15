/**
 * 회귀 가드 — 코르키(Corki) 미사일 ProcChance proc 데미지 기대값 반영 (under-damage fix, 2026-06-15).
 *
 * 버그(ingest P2): Corki 「소행성 발사기」 미사일은 ProcChance(20%) 확률로 ProcDamageMult(3.5)배
 * 초강력 미사일을 발사하는데, sim 은 평시 MissileAD 만 적용 → proc 미반영으로 ~33% 과소.
 * fix: AbilityConfig.procChance/procDamageMult → hitCountTotal × (1 − p + p×mult) 기대값 배수
 * (Corki 0.2/3.5 → ×1.5). 결정론 (N-run 평균 정합). main + OOR(dash) cast path 일관.
 *
 * 검증: calibration game-423 Corki -46%→-39% (sim +13%), overshoot 0.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { getAbilityDamage, setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const corki = champions.find(c => c.apiName === 'TFT17_Corki')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

describe('코르키 미사일 proc 기대값 (회귀 가드)', () => {
  it('cast 데미지가 ProcChance proc(×1.5 기대) 을 반영 — 단일 타겟 미사일 21개', () => {
    const r = simulateCombat(
      [placed(corki, 5, 3, 2)],
      [placed(cho, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5 },
    );
    const t = r.playerUnits[0];
    const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id);
    expect(cast).toBeDefined();
    const enemy = r.enemyUnits[0];

    // 기대 raw = MissileAD★2 × 21(미사일) × 1.5(proc 기대값). 아이템 없어 AD scale ×1.
    const missileAd = getAbilityDamage(corki, 2, 0, 0, 'MissileAD').damage;
    const expectedRaw = missileAd * 21 * 1.5;
    // post-mitigation (Cho armor). cast 로그 value = 단일 타겟 mitigated 총합.
    const mitig = 100 / (100 + enemy.stats.armor);
    const expectedMitigated = expectedRaw * mitig;
    // proc 미반영(×1.0) 이면 expectedMitigated/1.5 → 크게 미달. ±12% tolerance.
    expect(cast!.value ?? 0).toBeGreaterThan(expectedMitigated * 0.88);
    expect(cast!.value ?? 0).toBeLessThan(expectedMitigated * 1.12);
  });
});
