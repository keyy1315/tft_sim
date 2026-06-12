/**
 * 회귀 가드 — 진(Jhin) active '우주 활극' 이 ADDamage(주력 scaleAD) 로 피해.
 *
 * 버그 (ingest PR #227 발견, P0): `ability.ts` Jhin config 가 `damageVar: 'APDamage'`
 * [0,4,6,44] (미미) 를 써서 raw 주력 `ADDamage` [0,41,62,644] (desc <physicalDamage>
 * TotalDamage scaleAD) 대비 ~10배 under. 동형 multi Kindred(:238)/Xayah(:247)는 ADDamage.
 * fix: damageVar 'APDamage' → 'ADDamage'.
 *
 * ★2 기준: APDamage=6 → cast hit ~5 / ADDamage=62 → cast hit ~50+ (threshold 30 으로 분리).
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const jhin = champions.find(c => c.apiName === 'TFT17_Jhin')!;
const tank = champions.find(c => c.apiName === 'TFT17_Shen')!;

function placed(c: RawChampion, q: number, r: number): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: [] };
}

describe('진 active 우주 활극 — ADDamage 피해 (P0 회귀 가드)', () => {
  it('cast 직격이 ADDamage scaleAD 기반 (APDamage 미미값 아님)', () => {
    const r = simulateCombat([placed(jhin, 0, 0)], [placed(tank, 6, 3), placed(tank, 6, 2), placed(tank, 6, 4)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const j = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Jhin')!;
    // active cast 로그 (우주 활극 시전) 의 per-hit 피해 추출
    const castHits = r.logs
      .filter(l => l.type === 'ability' && l.sourceId === j.id && l.message.includes('우주 활극'))
      .map(l => {
        const m = l.message.match(/(\d+) 물리 피해/);
        return m ? Number(m[1]) : 0;
      });
    expect(castHits.length).toBeGreaterThan(0);
    const maxHit = Math.max(...castHits);
    // ADDamage ★2=62 (mitigated ~44+) vs APDamage ★2=6 (~5). threshold 30 으로 분리.
    // 버그(APDamage) 시 maxHit ~5 → fail. fix(ADDamage) 시 ~44+ → pass.
    expect(maxHit).toBeGreaterThan(30);
  });
});
