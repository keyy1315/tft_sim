/**
 * N.O.V.A. (DRX) trait 회귀 가드 — TeamAttackDelay(=6초) 후 power surge.
 *
 * Spec (TFT17_DRX):
 *   (2)/(5) TeamAttackDelay=6초 후 N.O.V.A. 챔프별 효과 활성:
 *     - Aatrox: 적 ShredAndSunder=30% Armor/MR 감소
 *     - Caitlyn: 모든 아군 +AS=20%
 *     - Akali: 모든 아군 Precision (spell crit)
 *     - Maokai: 모든 아군 maxHp × Heal=12% 회복
 *     - Kindred: 가장 강한 Tank 에 ShieldValue=800 shield
 *
 * 본 PR: 위 5 챔프별 효과만. Striker selector / Emblem 은 후속 PR.
 *
 * N.O.V.A. 챔프 (5명): Akali, Aatrox, Caitlyn, Maokai, Kindred.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apAatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
const apCaitlyn = champions.find((c) => c.apiName === 'TFT17_Caitlyn')!;
const apTwistedFate = champions.find((c) => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Galio') ?? apAatrox;

function placed(c: RawChampion, q: number, r: number, items: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items };
}

describe('DRX — (2) tier 활성 + power surge log', () => {
  it('N.O.V.A. 2명 (Aatrox + Caitlyn) → 6초 후 power surge log 발생', () => {
    const team = [
      placed(apAatrox, 0, 0),
      placed(apCaitlyn, 1, 0),
      placed(apTwistedFate, 2, 0),
    ];
    // 강한 enemy → 전투 6초 이상 지속
    const enemy = [
      placed(dummyEnemy, 0, 3),
      placed(dummyEnemy, 1, 3),
      placed(dummyEnemy, 2, 3),
    ];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const surgeLog = result.logs.find(l => l.message?.includes('N.O.V.A. power surge'));
    expect(surgeLog).toBeDefined();
    expect(surgeLog?.message).toContain('Aatrox');
    expect(surgeLog?.message).toContain('Caitlyn');
  });
});

describe('DRX — 비활성 (1명) 시 power surge 미발동', () => {
  it('N.O.V.A. 1명 → trait 비활성, surge log 없음', () => {
    const team = [placed(apAatrox, 0, 0), placed(apTwistedFate, 1, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const surgeLog = result.logs.find(l => l.message?.includes('N.O.V.A. power surge'));
    expect(surgeLog).toBeUndefined();
  });
});

describe('DRX — Caitlyn AS bonus 적용', () => {
  it('N.O.V.A. + Caitlyn → 6초 후 모든 아군 attackSpeed 증가 (sim 결과로 검증 어려움 — log 만 확인)', () => {
    // 정확한 attackSpeed 시점 검증은 sim 종료 시점에 stat 가산 누적이라 어려움.
    // log 발생 + 'Caitlyn' 포함 여부만 검증.
    const team = [
      placed(apAatrox, 0, 0),
      placed(apCaitlyn, 1, 0),
    ];
    const enemy = [
      placed(dummyEnemy, 0, 3),
      placed(dummyEnemy, 1, 3),
    ];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const surgeLog = result.logs.find(l => l.message?.includes('N.O.V.A. power surge'));
    expect(surgeLog?.message).toContain('Caitlyn');
  });
});
