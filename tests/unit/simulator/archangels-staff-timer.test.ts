/**
 * 대천사의 지팡이 (TFT_Item_ArchangelsStaff) APPerInterval 회귀 가드 (PR98).
 *
 * 효과 (set 17.1): IntervalSeconds=5 / APPerInterval=20.
 *   → 5초마다 AP +20 영구 누적 (전투 종료까지 stacking).
 *
 * Fix: combined.ts 의 Archangels 정의에 Timer primitive 추가 — 150 ticks
 * (5s × 30 tps) 마다 modifyStat ap +20 (no durationTicks → permanent).
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();

function requireItem(api: string): RawItem {
  const item = items.find((i) => i.apiName === api);
  if (!item) throw new Error(`required item missing: ${api}`);
  return item;
}

function placed(c: RawChampion, q: number, r: number, starLevel = 2, equips: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: equips };
}

describe('PR98 — ArchangelsStaff APPerInterval', () => {
  it('Archangels 데이터 APPerInterval=20, IntervalSeconds=5 (set 17.1)', () => {
    const arch = requireItem('TFT_Item_ArchangelsStaff');
    expect(arch.effects.APPerInterval).toBe(20);
    expect(arch.effects.IntervalSeconds).toBe(5);
  });

  it('simulateCombat: Archangels 보유 caster AP 가 시간에 따라 누적 stacking', () => {
    // Lissandra ★3 caster vs ★3 Aatrox tank — 충분히 긴 전투 필요 (10s+).
    // Archangels 1개 보유 시 5s 후 +20 AP, 10s 후 +40 AP, 15s 후 +60 AP 누적.
    const liss = champions.find((c) => c.apiName === 'TFT17_Lissandra')!;
    const aatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
    const arch = requireItem('TFT_Item_ArchangelsStaff');

    const withArch = simulateCombat(
      [placed(liss, 0, 0, 3, [arch])],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    const withoutArch = simulateCombat(
      [placed(liss, 0, 0, 3)],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );

    const lissWith = withArch.playerUnits[0];
    const lissBase = withoutArch.playerUnits[0];

    // base stats: AP 시작 시점에 statPatch ap=30 적용. duration > 5s 이면 timer 1회 이상 발동.
    // duration > 0 인 경우 (combat 진행) AP 가 base 보다 ≥ 30 (statPatch) + 추가 0 이상 stacking.
    expect(lissWith.stats.ap).toBeGreaterThanOrEqual(lissBase.stats.ap + 30);
    // duration > 5s 이면 timer 1회 발동 → 추가 20 누적
    if (withArch.duration >= 5) {
      expect(lissWith.stats.ap).toBeGreaterThanOrEqual(lissBase.stats.ap + 30 + 20);
    }
  });

  it('Archangels 보유 caster damage 증가 (mana economy + AP stacking)', () => {
    const liss = champions.find((c) => c.apiName === 'TFT17_Lissandra')!;
    const aatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
    const arch = requireItem('TFT_Item_ArchangelsStaff');

    const withArch = simulateCombat(
      [placed(liss, 0, 0, 3, [arch])],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    const withoutArch = simulateCombat(
      [placed(liss, 0, 0, 3)],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );

    expect(withArch.playerUnits[0].totalDamageDealt).toBeGreaterThan(
      withoutArch.playerUnits[0].totalDamageDealt,
    );
  });
});
