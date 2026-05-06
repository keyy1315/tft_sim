/**
 * Legacy AS scaling 정규화 회귀 가드 (PR #94 fix).
 *
 * 진단:
 *   - Set 17 데이터의 53 AS 보유 items 모두 integer percentage pts (10~100).
 *   - sim 의 stat.ts 는 fraction 가정 (baseAs × (1 + itemFx.as))
 *   - 5 items 는 registry (combined/stacking 등) 에서 explicit fraction 사용 (정상)
 *   - 나머지 48 items (대부분 artifacts, anima squad, psyops, emblems) 는 legacy
 *     fallback 으로 raw integer 가 fraction 으로 잘못 적용 → +4000% AS 등 over-buff.
 *
 * Fix: stat.ts mergeLegacy 가 AS / BonusAS / AttackSpeed 키 값이 >=1 이면 /100 정규화.
 *
 * 본 테스트는 fix 동작 검증 + EvelynnArtifact (AS=40) 표본으로 회귀 catch.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { getItemEffects } from '@/lib/simulator/systems/stat';
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

describe('PR94 — legacy AS scaling 정규화', () => {
  it('getItemEffects: legacy item AS=40 → itemFx.as = 0.40 (정규화)', () => {
    // EvelynnArtifact 는 registry 미등록 → legacy fallback. AS=40 (integer pts).
    const evelynn = requireItem('TFT17_Item_Artifact_EvelynnArtifact');
    expect(evelynn.effects.AS).toBe(40);
    const itemFx = getItemEffects([evelynn]);
    // fix 후: 0.40 (= 40/100). fix 전: 40 (그대로 — sim 에서 +4000% AS 발생).
    expect(itemFx.as).toBeCloseTo(0.40, 5);
  });

  it('getItemEffects: 여러 legacy item AS 합산도 정규화', () => {
    // RecurveBow (AS=10) + GuardianAngel (AS=15) → 0.10 + 0.15 = 0.25
    const rec = requireItem('TFT_Item_RecurveBow');
    const ga = requireItem('TFT_Item_GuardianAngel');
    expect(rec.effects.AS).toBe(10);
    expect(ga.effects.AS).toBe(15);
    const itemFx = getItemEffects([rec, ga]);
    expect(itemFx.as).toBeCloseTo(0.25, 5);
  });

  it('getItemEffects: AS < 1 (이미 fraction 인 데이터) 는 변경 없음', () => {
    // 임의 fraction AS 를 가진 가상 RawItem 으로 검증 (실제 데이터 없을 수 있음)
    const fakeItem: RawItem = {
      apiName: 'fake_test_item',
      name: 'fake',
      desc: '',
      icon: '',
      composition: [],
      effects: { AS: 0.40 },  // 이미 fraction
    };
    const itemFx = getItemEffects([fakeItem]);
    expect(itemFx.as).toBeCloseTo(0.40, 5);
  });

  it('CritChance 정규화: NightHarvester CritChance=20 → itemFx.critChance = 0.20 (PR95)', () => {
    const nh = requireItem('TFT_Item_NightHarvester');
    expect(nh.effects.CritChance).toBe(20);
    const fx = getItemEffects([nh]);
    // fix 후: 0.20. fix 전: 20 (하지만 stat.ts cap=Math.min(1, ...) 로 +100% 로 잘림 → 부분 정확).
    expect(fx.critChance).toBeCloseTo(0.20, 5);
  });

  it('AD 정규화: FreeBFSword AD=15 → itemFx.ad = 0.15 (PR95 — integer outlier)', () => {
    const fbf = requireItem('TFT_Item_FreeBFSword');
    expect(fbf.effects.AD).toBe(15);
    const fx = getItemEffects([fbf]);
    // fix 후: 0.15 (= +15% AD). fix 전: 15 (+1500% AD 잘못).
    expect(fx.ad).toBeCloseTo(0.15, 5);
  });

  it('AD 정규화: SilvermereDawn AD=1.4 → itemFx.ad = 1.4 보존 (fraction <2 threshold)', () => {
    const sd = requireItem('TFT_Item_Artifact_SilvermereDawn');
    expect(sd.effects.AD).toBeCloseTo(1.4, 5);
    const fx = getItemEffects([sd]);
    // SilvermereDawn AD=1.4 는 fraction 으로 추정 (=+140% AD), 보존.
    expect(fx.ad).toBeCloseTo(1.4, 5);
  });

  it('simulateCombat: EvelynnArtifact 보유 unit AS 가 합리적 범위 (×1.40 정도)', () => {
    const evelynn = requireItem('TFT17_Item_Artifact_EvelynnArtifact');
    const aatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

    const ally: PlacedChampion[] = [placed(aatrox, 0, 0, 2, [evelynn])];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];

    const withItem = simulateCombat(ally, enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });
    const withoutItem = simulateCombat([placed(aatrox, 0, 0, 2)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });

    const a = withItem.playerUnits[0];
    const b = withoutItem.playerUnits[0];
    const ratio = a.stats.attackSpeed / b.stats.attackSpeed;
    // fix 전: ratio ≈ 41 (4000% over-buff). fix 후: ratio ≈ 1.40 (+40% AS).
    // 다른 stat source 가 0 가정 시 정확히 1.40. 약간 여유두고 1.30~1.55 범위 검증.
    expect(ratio).toBeGreaterThanOrEqual(1.30);
    expect(ratio).toBeLessThanOrEqual(1.55);
  });
});
