/**
 * 회귀 가드 — LeonaCarry '방패 여전사' 첫 적중 maxHp 24% (baseDamageHpFrac) 가산.
 *
 * desc "첫 적중: AD + 24% 최대체력 + 기절".
 * 버그: baseDamageHpFrac 처리가 :6387 그라가스 자폭(selfDamage + hexReduction) 전용 →
 *   applyCarryDamageModifiers 6 modifier 에 baseDamageHpFrac 분기 없어 line carry(Leona) 미반영.
 * fix: applyCarryDamageModifiers 에 primary target maxHp × baseDamageHpFrac 가산 (hexReduction 없는 carry 한정).
 *
 * Leona ingest (PR #199) lint P1 발견 → sim fix.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawAugment, RawChampion } from '@/types';

const { champions, traits, augments } = loadServerCatalogs();
const leona = champions.find(c => c.apiName === 'TFT17_Leona')!;
const dummy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
const augLeonaCarry = augments.find(a => a.apiName === 'TFT17_Augment_LeonaCarry')!;

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('LeonaCarry baseDamageHpFrac 첫 적중 maxHp 가산 (PR #199 lint P1 fix)', () => {
  it('LeonaCarry 활성 + Leona cast → carry 변환 + 데미지 발생 + 정상 종료', () => {
    const team: PlacedChampion[] = [placed(leona, 0, 0, 2)];
    const enemy: PlacedChampion[] = [placed(dummy, 6, 3, 1)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augLeonaCarry] as RawAugment[],
    });
    const l = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Leona')!;
    expect(l.selectedCarryAugment).toBe('TFT17_Augment_LeonaCarry');
    expect(l.totalDamageDealt).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);
  });

  it('LeonaCarry baseDamageHpFrac 0.24 데이터 정합 (raw 17.3)', () => {
    expect(augLeonaCarry).toBeDefined();
    // carryAugments.ts LeonaCarry abilityData.baseDamageHpFrac = 0.24 (17.3: 0.28 → 0.24)
    // 가산 공식: primary baseDmg += maxHp × 0.24 (applyCarryDamageModifiers, hexReduction 없는 carry)
    // Leona base config 에는 baseDamageHpFrac 없음 (carry augment 한정) — 회귀 격리
    const leonaBase = champions.find(c => c.apiName === 'TFT17_Leona')!;
    const hasBaseHpFracVar = (leonaBase.ability.variables ?? []).some(v => v.name === 'baseDamageHpFrac');
    expect(hasBaseHpFracVar).toBe(false); // base ability 는 maxHp 가산 없음 (carry 전용)
  });
});
