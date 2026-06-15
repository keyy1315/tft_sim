/**
 * 회귀 가드 — 티모(Teemo) passive 독 DOT (ingest PR #222 발견, P1).
 *
 * 버그: onAttack extraDamage 핸들러가 즉시 추가 마법(hitDamage) 만 적용하고,
 * 독 DOT (scaling.json poisonDamage scaleAP, poisonDuration 6초, 중첩) 은 미반영.
 * Teemo 핵심 지속 피해 누락 → 1코 AP carry under-damage.
 * fix: onAttack 핸들러에 poison statusEffect 적용 (MR mitigate 후 poisonDuration 초 spread, 중첩).
 *
 * scaling 로드 + hitDamage 만이면 totalDamageDealt ~268. 독 DOT(poisonDamage ★2 6초 중첩) 추가 시 ~650.
 * (scaling 미로드 시 base auto 만 ~105 — calibration 경로는 scaling 미로드라 onAttack 자체 미발동)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();

// onAttack scaling (poison) 은 scaling.json 필요 — calibration 경로(loadServerCatalogs)는 미로드.
beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});
const teemo = champions.find(c => c.apiName === 'TFT17_Teemo')!;
const tank = champions.find(c => c.apiName === 'TFT17_Shen')!; // 고HP 생존 → 독 누적

function placed(c: RawChampion, q: number, r: number): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: [] };
}

describe('티모 독 DOT passive (P1 회귀 가드)', () => {
  it('평타 시 독 DOT(poisonDamage) 누적 — hitDamage 단독 대비 대폭 증가', () => {
    const r = simulateCombat([placed(teemo, 0, 0)], [placed(tank, 6, 3)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const t = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Teemo')!;
    // hitDamage 단독(scaling 로드)이면 ~268. 독 DOT 추가 시 poisonDamage 6초 중첩으로 ~650.
    // 버그(독 미반영) 시 ~268 → fail. fix(독 DOT) 시 ~650 > 400 → pass. (threshold 400 으로 분리)
    expect(t.totalDamageDealt).toBeGreaterThan(400);
  });
});
