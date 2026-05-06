/**
 * Corki on-attack missiles 회귀 가드 (PR100).
 *
 * raw 메커닉 (TFT17_Corki "소행성 발사기"):
 *   MissilesPerLaunchAttack=5 — 평타당 5 미사일.
 *   각 미사일: MissileAD ★1=25 physical + MissileAP ★1=6 magic (AP scale).
 *   ProcChance=20% / ProcDamageMult=3.5×.
 *
 * 기존 sim 미구현 → R5-2 Corki ★1 실제 6404 dmg vs sim 881 (-86%).
 * Fix: 평타 시 5 missile 추가 가산 (Caitlyn 패시브 패턴 따라).
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();

function placed(c: RawChampion, q: number, r: number, starLevel = 1): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('PR100 — Corki on-attack 5 missiles', () => {
  it('Corki 데이터 fingerprint: MissilesPerLaunchAttack=5 / MissileAD=25 ★1', () => {
    const corki = champions.find(c => c.apiName === 'TFT17_Corki')!;
    const vars = corki.ability.variables;
    const npla = vars.find(v => v.name === 'MissilesPerLaunchAttack')?.value?.[0];
    const ad1 = vars.find(v => v.name === 'MissileAD')?.value?.[0];
    expect(npla).toBe(5);
    expect(ad1).toBe(25);
  });

  it('Corki ★1 onAttack — 평타당 추가 미사일 데미지로 totalDamageDealt 대폭 증가', () => {
    const corki = champions.find(c => c.apiName === 'TFT17_Corki')!;
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
    // ★1 Corki vs ★3 Aatrox tank — 충분히 긴 전투, 다수 평타로 missile 데미지 누적.
    const r = simulateCombat(
      [placed(corki, 0, 0, 1)],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    // ★1 Corki 평타 ~18회 (30s × 0.6 AS) × 5 missile × ~30 raw = 2700+ raw → mitigation 후 1500+
    // 본체 AD 평타 (60 AD × 18) ~1080 추가 → 총합 2500+.
    expect(r.playerUnits[0].totalDamageDealt).toBeGreaterThan(1500);
  });

  it('Corki ★1 — missile 추가 후 totalDamageDealt 가 baseline (★1 Aatrox 대조군) 보다 훨씬 큼', () => {
    // 추가 가산 없는 ★1 Aatrox 평타 vs Corki 평타 + 5 missile 비교.
    // Aatrox baseline ~1000 dmg (★1 자체 ability 약함). Corki 는 missile 으로 압도적이어야.
    const corki = champions.find(c => c.apiName === 'TFT17_Corki')!;
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
    const dummyTank = champions.find(c => c.apiName === 'TFT17_Aatrox')!;

    const corkiRun = simulateCombat(
      [placed(corki, 0, 0, 1)],
      [placed(dummyTank, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    const aatroxRun = simulateCombat(
      [placed(aatrox, 0, 0, 1)],
      [placed(dummyTank, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    expect(corkiRun.playerUnits[0].totalDamageDealt).toBeGreaterThan(
      aatroxRun.playerUnits[0].totalDamageDealt
    );
  });
});
