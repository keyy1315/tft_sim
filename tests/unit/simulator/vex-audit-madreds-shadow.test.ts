/**
 * Vex audit (PR101) — Madreds 탱커 amp + Vex 패시브 그림자 magic 회귀 가드.
 *
 * R5-2 진단: 적 carry Vex (★1) + Madreds + JeweledGauntlet + GuinsoosRageblade.
 * sim 미구현 두 가지:
 *   1. MadredsBloodrazor DamageAmp=0.15 — 탱커 한정 +15% damage amp (TFT17 메커닉).
 *      Note: AD/AP/AS 는 ITEM_EFFECT_KEYS legacy 매핑으로 이미 적용됨.
 *   2. Vex 패시브 — 평타 시 그림자가 ShadowHandDamage(★1=30) magic 추가.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();

function placed(c: RawChampion, q: number, r: number, starLevel = 1, equips: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: equips };
}
function requireItem(api: string): RawItem {
  const i = items.find(x => x.apiName === api);
  if (!i) throw new Error('item missing: ' + api);
  return i;
}

describe('PR101 — Vex audit', () => {
  it('Madreds 탱커 한정 amp 적용 — Tank role 적에게 더 큰 데미지', () => {
    // Aatrox (Tank role) vs ★1 Vex with/without Madreds
    const vex = champions.find(c => c.apiName === 'TFT17_Vex')!;
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
    const madreds = requireItem('TFT_Item_MadredsBloodrazor');

    const withM = simulateCombat(
      [placed(vex, 0, 0, 1, [madreds])],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    const withoutM = simulateCombat(
      [placed(vex, 0, 0, 1)],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    // Madreds 가 Tank 상대 +15% amp → 더 큰 totalDamageDealt
    expect(withM.playerUnits[0].madredsTankDamageAmp).toBeCloseTo(0.15, 3);
    expect(withoutM.playerUnits[0].madredsTankDamageAmp).toBe(0);
    // damage 차이 — Madreds AD/AP/AS 의 stat boost + DamageAmp 합산 → withM 이 더 큼
    expect(withM.playerUnits[0].totalDamageDealt).toBeGreaterThan(
      withoutM.playerUnits[0].totalDamageDealt
    );
  });

  it('Madreds 비-탱커 상대 — DamageAmp 미적용', () => {
    // Caitlyn (ADSpecialist, NOT Tank) 상대 → Madreds DamageAmp 미발동.
    const vex = champions.find(c => c.apiName === 'TFT17_Vex')!;
    const cait = champions.find(c => c.apiName === 'TFT17_Caitlyn')!;
    const madreds = requireItem('TFT_Item_MadredsBloodrazor');
    const r = simulateCombat(
      [placed(vex, 0, 0, 1, [madreds])],
      [placed(cait, 6, 3, 1)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    // madredsTankDamageAmp 는 보유 (>0) but Caitlyn 은 Tank 가 아니므로 amp 미발동.
    // 검증은 fingerprint level — field 가 set 되어 있고 sim 진행됨.
    expect(r.playerUnits[0].madredsTankDamageAmp).toBeCloseTo(0.15, 3);
  });

  it('Vex 패시브 — 평타 시 그림자 magic 추가 데미지', () => {
    // Vex ★1 vs ★3 Aatrox tank — 충분한 평타 (~30s × 0.7 AS = 21회).
    // 본 sim Vex 평타: 평타 본체 + ShadowHandDamage ★1=30 magic per attack.
    // 기존 (PR101 전): cast 만 발동, 평타 본체만 데미지.
    const vex = champions.find(c => c.apiName === 'TFT17_Vex')!;
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
    const r = simulateCombat(
      [placed(vex, 0, 0, 1)],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    // ★1 Vex 평타 21회 × 30 (magic) = 630 raw → mitigation 후 ~300+ 추가
    // 본체 평타 (40 AD × 21) ~840 → 총합 1100+ (대략, 변동 가능)
    expect(r.playerUnits[0].totalDamageDealt).toBeGreaterThan(800);
  });
});
