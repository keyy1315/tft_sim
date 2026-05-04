/**
 * 회귀 가드 — augment loader 가 disable=true 와 DISABLED_AUGMENT_API_NAMES 양쪽
 * 모두 필터링하는지 검증.
 *
 * 4-29 17.2 fetch 회귀 보호:
 *   - fetch 시 사용자 분류 (disable=true 252 entries) 가 통째로 사라진 사고 재발 방지
 *   - 신규 augment 의 raw apiName 과 DISABLED_AUGMENT_API_NAMES 등록 apiName
 *     불일치 (예: TFT17_Augment_Psionic_EmergencySupplies vs 실제 EmergencySupplies)
 *     발생 시 Set17 풀에 노출되는 회귀 방지
 */
import { describe, it, expect } from 'vitest';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { DISABLED_AUGMENT_API_NAMES, isDisabledAugment } from '@/data/disabledContent';
import * as fs from 'node:fs';
import * as path from 'node:path';

const { augments: filteredAugments } = loadServerCatalogs();
const rawJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'public/data/tft_set17_augments.json'), 'utf8'),
) as {
  meta: { totalAugments: number };
  augments: Array<{ apiName: string; disable?: boolean; name?: string }>;
};
const rawAugments = rawJson.augments;

describe('Augment Set17 풀 필터링 — disable + DISABLED 양쪽 검증', () => {
  it('disable 분류가 raw JSON 모든 entry 에 boolean 으로 보존되어 있다 (회귀 가드: 4-29 fetch 사고)', () => {
    const withFlag = rawAugments.filter(a => typeof a.disable === 'boolean');
    expect(withFlag.length).toBe(rawAugments.length);
  });

  it('disable=false (활성) 가 충분한 수 (>150) 보존되어 있다', () => {
    const enabled = rawAugments.filter(a => a.disable === false);
    expect(enabled.length).toBeGreaterThan(150);
  });

  it('loadServerCatalogs() 결과는 disable!==true 만 포함한다', () => {
    for (const a of filteredAugments) {
      const raw = rawAugments.find(r => r.apiName === a.apiName);
      expect(raw?.disable).not.toBe(true);
    }
  });

  it('loadServerCatalogs() 결과는 DISABLED_AUGMENT_API_NAMES 와 disjoint', () => {
    for (const a of filteredAugments) {
      expect(isDisabledAugment(a.apiName)).toBe(false);
    }
  });

  it('17.2 신규 disable 5종이 결과에서 제외된다', () => {
    const expectedDisabled = [
      'TFT17_Augment_Concentration',
      'TFT17_Augment_Timebreaker_Timestream',
      'TFT17_Augment_EmergencySupplies', // 회귀 가드 — 기존 'Psionic_' 접두사 오타로 미필터되던 케이스
      'TFT17_Augment_DarkStar_NeutronStar',
      'TFT17_Augment_ShieldTank_DivinePaladins',
    ];
    for (const api of expectedDisabled) {
      expect(filteredAugments.find(a => a.apiName === api)).toBeUndefined();
    }
  });

  it('DISABLED_AUGMENT_API_NAMES 에 등록된 apiName 은 모두 raw JSON 에 존재 (apiName 오타 가드)', () => {
    const rawApiSet = new Set(rawAugments.map(a => a.apiName));
    for (const api of DISABLED_AUGMENT_API_NAMES) {
      expect(rawApiSet.has(api)).toBe(true);
    }
  });

  it('lolchess set17 hidden augments 도 제외된다 (저격수의 은신처 / 이륙 / 은하계 여행 / 길잡이의 노래)', () => {
    const hidden = [
      'TFT17_Augment_SnipersNest',
      'TFT17_Augment_Weightlifting',
      'TFT17_Augment_TourOfTheGalaxy',
      'TFT17_Augment_ShepherdAugment',
    ];
    for (const api of hidden) {
      expect(filteredAugments.find(a => a.apiName === api)).toBeUndefined();
    }
  });

  // PR2 (17.2b) — 신병 augment 추가. CDragon raw 그대로 (NumUnits=3 라이브에서는 1로 너프).
  // 시뮬 영향 없는 econ augment 라 effects 수치는 무관, 카탈로그 노출만 검증.
  it('17.2b 신병 augment 가 raw JSON 에 추가되어 있다 (apiName=TFT6_Augment_ForceOfNature)', () => {
    const recruit = rawAugments.find(a => a.apiName === 'TFT6_Augment_ForceOfNature');
    expect(recruit).toBeDefined();
    expect(recruit?.name).toBe('신병');
    expect(recruit?.disable).toBe(false);
  });

  it('신병 augment 가 loadServerCatalogs() 결과에 노출된다', () => {
    const recruit = filteredAugments.find(a => a.apiName === 'TFT6_Augment_ForceOfNature');
    expect(recruit).toBeDefined();
  });

  it('meta.totalAugments 가 augments 배열 길이와 일치한다', () => {
    expect(rawJson.meta.totalAugments).toBe(rawAugments.length);
  });
});
