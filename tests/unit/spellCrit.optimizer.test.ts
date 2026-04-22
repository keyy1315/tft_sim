import { describe, it, expect } from 'vitest';
import type { ChampionStats, RawItem } from '@/types';
import { extractItemDpsModifiers, estimateDps } from '@/lib/analysis/itemOptimizer';

function item(apiName: string, effects: Record<string, number> = {}): RawItem {
  return { apiName, name: apiName, composition: [], effects, desc: '', icon: '' };
}

const baseApStats: ChampionStats = {
  hp: 900, armor: 30, magicResist: 30, damage: 40, ap: 100,
  attackSpeed: 0.8, critChance: 0.25, critMultiplier: 1.4,
  mana: 0, maxMana: 60, range: 4, armorPen: 0, magicPen: 0,
};

const baseAdStats: ChampionStats = {
  hp: 900, armor: 30, magicResist: 30, damage: 70, ap: 100,
  attackSpeed: 0.9, critChance: 0.25, critMultiplier: 1.4,
  mana: 0, maxMana: 60, range: 4, armorPen: 0, magicPen: 0,
};

describe('extractItemDpsModifiers — canSpellCrit', () => {
  it('빈 배열 → canSpellCrit=false', () => {
    const mods = extractItemDpsModifiers([]);
    expect(mods.canSpellCrit).toBe(false);
  });

  it('보건 포함 → canSpellCrit=true', () => {
    const mods = extractItemDpsModifiers([item('TFT_Item_JeweledGauntlet', { AP: 20 })]);
    expect(mods.canSpellCrit).toBe(true);
  });

  it('무대 포함 → canSpellCrit=true', () => {
    const mods = extractItemDpsModifiers([item('TFT_Item_InfinityEdge', { AD: 0.15, CritChance: 0.15 })]);
    expect(mods.canSpellCrit).toBe(true);
  });

  it('찬란한 보건 포함 → canSpellCrit=true', () => {
    const mods = extractItemDpsModifiers([item('TFT_Item_Radiant_JeweledGauntlet', {})]);
    expect(mods.canSpellCrit).toBe(true);
  });

  it('BFSword 만 → canSpellCrit=false', () => {
    const mods = extractItemDpsModifiers([item('TFT_Item_BFSword', { AD: 0.1 })]);
    expect(mods.canSpellCrit).toBe(false);
  });
});

describe('estimateDps — AP 분기 critMul 반영', () => {
  it('AP 캐리 + 보건 → 보건 제외 대비 상승 (대략 10%)', () => {
    // 보건 effects 중 AP 20 같은 플랫 스탯도 DPS 를 올리므로 "동일 effects, apiName만 다른 대조군" 으로 비교
    const jg = item('TFT_Item_JeweledGauntlet', { AP: 20 });
    const dummyAp = item('DummyApItem', { AP: 20 }); // 같은 AP 보너스, crit 언락 없음

    const withJG = estimateDps(baseApStats, true, 2, [jg]);
    const withDummy = estimateDps(baseApStats, true, 2, [dummyAp]);

    // 보건은 1 + 0.25 * (1.4 - 1) = 1.10 배 만큼 baseApDps 가 추가로 상승
    // 정확히 10% 일치는 아님 (damageAmp, flatDpsBonus 등 다른 항목은 critMul 미반영) 이지만 명확히 차이 나야 함
    expect(withJG).toBeGreaterThan(withDummy);
    const ratio = withJG / withDummy;
    expect(ratio).toBeGreaterThan(1.05);
    expect(ratio).toBeLessThan(1.15);
  });

  it('AD 캐리 + 무대 → AD 는 이미 critMul 반영 중, canSpellCrit 과 무관', () => {
    // AD 분기에는 자체적으로 const critMul = 1 + critChance * (critMult - 1) 이 있음.
    // canSpellCrit 은 AP 분기 전용이므로 AD 캐리 DPS 에 영향 X.
    const ie = item('TFT_Item_InfinityEdge', {});
    const dummyAd = item('DummyAdItem', {});

    const withIE = estimateDps(baseAdStats, false, 2, [ie]);
    const withDummy = estimateDps(baseAdStats, false, 2, [dummyAd]);

    // effects 가 동일 (빈 객체) 이므로 AD DPS 차이는 사실상 없어야 함
    expect(Math.abs(withIE - withDummy)).toBeLessThan(0.01);
  });

  it('critChance=0 AP 캐리 → 보건 있어도 critMul = 1 (피해 증가 없음)', () => {
    const zeroCritAp: ChampionStats = { ...baseApStats, critChance: 0 };
    const jg = item('TFT_Item_JeweledGauntlet', { AP: 20 });
    const dummy = item('DummyApItem', { AP: 20 });

    const withJG = estimateDps(zeroCritAp, true, 2, [jg]);
    const withDummy = estimateDps(zeroCritAp, true, 2, [dummy]);

    expect(withJG).toBeCloseTo(withDummy, 1);
  });

  it('apScalarBonus (타오르는 단궁) 도 critMul 반영 — 보건과 함께', () => {
    // BlazingBow 는 APScalar effect. 이것도 AP 스킬 데미지 경로이므로 crit 반영되어야 함
    const jg = item('TFT_Item_JeweledGauntlet', {});
    const bow = item('TFT_Item_BlazingBow', { APScalar: 0.75 });
    const dummy = item('DummyNoCrit', {});

    const withBoth = estimateDps(baseApStats, true, 2, [jg, bow]);
    const withBowOnly = estimateDps(baseApStats, true, 2, [dummy, bow]);

    // 보건이 baseApDps + apScalarBonus 양쪽 모두 critMul 배 상승시켜야 함
    expect(withBoth).toBeGreaterThan(withBowOnly);
  });
});
