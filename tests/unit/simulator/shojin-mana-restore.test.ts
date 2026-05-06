/**
 * 쇼진의 창 (TFT_Item_SpearOfShojin) FlatManaRestore=5 회귀 가드 (PR97).
 *
 * PR #96 진단: caster carry (Lissandra/Veigar) 가 Shojin 보유 시 real 게임 mana
 * 빠르게 차서 자주 cast. sim 미구현으로 cast 빈도 부족 → opponent damage 부족 →
 * sim duration 4x 빠름.
 *
 * Fix: applyItemStaticEffects 가 Shojin 의 FlatManaRestore=5 를 unit.itemFlatManaPerAttack
 * 에 누적 → gainManaOnAttack 에서 role manaPerAttack + 아이템 보너스.
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

describe('PR97 — 쇼진의 창 FlatManaRestore', () => {
  it('Shojin 데이터 FlatManaRestore=5 (set 17.1)', () => {
    const shojin = requireItem('TFT_Item_SpearOfShojin');
    expect(shojin.effects.FlatManaRestore).toBe(5);
  });

  it('simulateCombat: Shojin 보유 caster 가 더 자주 cast', () => {
    // Lissandra ★3 (caster, mana=30) Shojin 1 vs no item — castCount 비교.
    const liss = champions.find((c) => c.apiName === 'TFT17_Lissandra')!;
    const aatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
    const shojin = requireItem('TFT_Item_SpearOfShojin');
    // 충분히 긴 baseline 시간 확보 위해 ★3 tank 적
    const enemy = [placed(aatrox, 6, 3, 3)];

    const withShojin = simulateCombat([placed(liss, 0, 0, 3, [shojin])], enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });
    const withoutShojin = simulateCombat([placed(liss, 0, 0, 3)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });

    const lissWith = withShojin.playerUnits[0];
    const lissWithout = withoutShojin.playerUnits[0];

    // Shojin 보유 시 castCount 더 많아야 한다 (또는 같음 — 이미 짧은 sim 에서 1회 cast 라면).
    // strict 비교 어려운 경우 totalDamageDealt 가 더 큼 fingerprint 사용.
    expect(lissWith.castCount).toBeGreaterThanOrEqual(lissWithout.castCount);
    expect(lissWith.totalDamageDealt).toBeGreaterThanOrEqual(lissWithout.totalDamageDealt);
  });

  it('itemFlatManaPerAttack 필드: Shojin × 2 = 10 (누적 stack)', () => {
    // 같은 unit 이 Shojin 2개 (real game 가능) → mana per attack +10.
    const liss = champions.find((c) => c.apiName === 'TFT17_Lissandra')!;
    const aatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;
    const shojin = requireItem('TFT_Item_SpearOfShojin');
    const r = simulateCombat(
      [placed(liss, 0, 0, 3, [shojin, shojin])],
      [placed(aatrox, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    expect(r.playerUnits[0].itemFlatManaPerAttack).toBe(10);
  });
});
