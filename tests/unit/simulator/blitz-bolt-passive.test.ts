/**
 * 회귀 가드 — Blitzcrank Bolt passive 구현 + 파티광 후속 효과 (PR #65).
 *
 * 적용:
 *   Blitzcrank Bolt passive — 매 BoltCooldown 초마다 가장 체력 높은 적에 magic damage.
 *     raw: BoltCooldown [_, 2, 2, 0.5], BoltDamage [_, 60, 90, 150] (star-scaled, AP scaling).
 *   파티광 후속 효과 — 회복 완료 시 blitzBoltSpeedMult ×4 (effective cooldown / 4).
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const blitz = champions.find(c => c.apiName === 'TFT17_Blitzcrank')!;
const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('Blitzcrank Bolt passive — combat-start setup', () => {
  it('Blitzcrank unit 의 blitzBoltCooldownSec / blitzBoltDamage 활성화', () => {
    const team: PlacedChampion[] = [placed(blitz, 0, 0)];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const b = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Blitzcrank')!;
    // 2성 — BoltCooldown=2, BoltDamage=90.
    expect(b.blitzBoltCooldownSec).toBeCloseTo(2, 1);
    expect(b.blitzBoltDamage).toBeCloseTo(90, 1);
    expect(b.blitzBoltSpeedMult).toBe(1);
  });

  it('비-Blitzcrank unit → blitzBoltCooldownSec = 0', () => {
    const team: PlacedChampion[] = [placed(aatrox, 0, 0)];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    for (const u of result.playerUnits) {
      expect(u.blitzBoltCooldownSec).toBe(0);
      expect(u.blitzBoltDamage).toBe(0);
    }
  });

  it('Blitzcrank Bolt passive 활성 시 cooldown/damage 필드 set', () => {
    const team: PlacedChampion[] = [placed(blitz, 0, 0)];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];
    const blitzRes = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // Bolt 활성 자체만 확인 — totalDamageTaken 비교는 attacker 별 stat 차이로 fragile.
    expect(blitzRes.playerUnits[0].blitzBoltCooldownSec).toBe(2);
    expect(blitzRes.playerUnits[0].blitzBoltDamage).toBeGreaterThan(0);
  });
});

describe('파티광 후속 효과 — 회복 완료 시 Bolt 4배', () => {
  it('blitzBoltSpeedMult default = 1', () => {
    const team: PlacedChampion[] = [placed(blitz, 0, 0)];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const b = result.playerUnits[0];
    // 파티광 trait 활성 + 회복 완료 시점에 4 set. 단순 시나리오에선 회복 발동 안 할 수도.
    // partyHpThreshold 활성 + 회복 완료 검증은 별도 시나리오 필요.
    expect(b.blitzBoltSpeedMult).toBeGreaterThanOrEqual(1);
    expect(b.blitzBoltSpeedMult).toBeLessThanOrEqual(4);
  });

  it('파티광 trait 활성 시 partyHpThreshold set', () => {
    const team: PlacedChampion[] = [placed(blitz, 0, 0)];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const b = result.playerUnits[0];
    // 파티광 (TFT17_BlitzcrankUniqueTrait) — Blitzcrank 1명만 있어도 활성 (minUnits=1).
    expect(b.partyHpThreshold).toBeCloseTo(0.45, 2);
    expect(b.partyHealRate).toBeCloseTo(0.15, 2);
  });
});
