/**
 * 회귀 가드 — 브라이어 패시브 잃은 체력 비례 AS 단위 fix.
 *
 * desc "기본 지속 효과: 잃은 체력 1%당 AS 2%(★3 2.5%)".
 * 버그 ①: getEffectiveAttackSpeed 에서 `missingPct(비율 0~1) × (asPerMissingHpPercent/100)` →
 *   잃은체력 50% 시 +1% AS (raw 의도 +100%, ~100배 과소). scaling.json 값은 이미 percent-point 단위.
 * 버그 ②: config selfBuff attackSpeed 0.5 (duration 999) — raw 액티브 AS 버프 없음 + duration 미참조 매 cast 누적.
 * fix: `/100` 제거 (asPerMissingHpPercent 그대로) + config selfBuff 제거.
 *
 * Briar ingest (PR #201) lint P1 발견 → sim fix.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { CHAMPION_ABILITY_PATTERNS } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const briar = champions.find(c => c.apiName === 'TFT17_Briar')!;
const enemy = champions.find(c => c.apiName === 'TFT17_Graves')!;

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('브라이어 패시브 AS 단위 fix (PR #201 lint P1)', () => {
  it('config selfBuff 제거 (패시브 AS 는 getEffectiveAttackSpeed 전담)', () => {
    expect(CHAMPION_ABILITY_PATTERNS['TFT17_Briar']?.selfBuff).toBeUndefined();
    expect(CHAMPION_ABILITY_PATTERNS['TFT17_Briar']?.pattern).toBe('single');
  });

  // fix 단위: getEffectiveAttackSpeed 에서 missingPct(0.5) × asPerMissingHpPercent(2) = 1.0 → AS ×2.0
  //   (+100%, raw "잃은체력 50% × 2%" 정합). 기존 `/100` 이중 변환 버그(~100배 과소) 제거.
  //   AS fix 의 전투 결과 회귀 가드는 golden snapshot (Briar 5 시나리오) 가 담당.

  it('Briar 가 피해받아 광폭화 후 정상 종료 + 데미지 발생 (잃은체력 비례 AS)', () => {
    const result = simulateCombat([placed(briar, 0, 0, 2)], [placed(enemy, 6, 3, 2)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const b = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Briar')!;
    expect(b).toBeDefined();
    expect(b.totalDamageDealt).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);
  });
});
