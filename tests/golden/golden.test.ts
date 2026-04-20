/**
 * Golden Test Runner
 *
 * item-effect-engine Phase 2 gate: 시뮬 결과 snapshot 비교.
 * Registry/엔진 변경 후 diff 0 이어야 merge 가능.
 *
 * Snapshot 업데이트: `pnpm test:golden -u`
 * 가이드: tests/golden/README.md
 */

import { describe, it, expect } from 'vitest';
import { runScenario } from './helpers';
import { BASIC_SCENARIOS } from './scenarios/basic';

describe('golden — basic', () => {
  for (const scenario of BASIC_SCENARIOS) {
    it(scenario.name, () => {
      const summary = runScenario(scenario);
      expect(summary).toMatchSnapshot();
    });
  }
});

/**
 * 결정론 검증 — 동일 시나리오 2회 실행 시 완전 동일 결과.
 * 엔진 전역 상태 / Math.random 직접 사용 등 regression 조기 감지용.
 */
describe('golden — determinism', () => {
  for (const scenario of BASIC_SCENARIOS) {
    it(`${scenario.name} (2회 실행 동일)`, () => {
      const a = runScenario(scenario);
      const b = runScenario(scenario);
      expect(b).toEqual(a);
    });
  }
});
