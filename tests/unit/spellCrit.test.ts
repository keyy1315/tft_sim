import { describe, it, expect } from 'vitest';
import type { ActiveTrait, RawItem, RawTrait } from '@/types';
import {
  SPELL_CRIT_ITEMS,
  SPELL_CRIT_TRAIT_APINAMES,
  hasSpellCritItem,
  hasSpellCritEnableTrait,
  computeSpellCanCrit,
  expectedSpellCritMultiplier,
} from '@/lib/combat/spellCrit';

function item(apiName: string): RawItem {
  return {
    apiName,
    name: apiName,
    composition: [],
    effects: {},
    desc: '',
    icon: '',
  };
}

function trait(apiName: string, count: number): ActiveTrait {
  const rawTrait: RawTrait = {
    name: apiName,
    apiName,
    desc: '',
    icon: '',
    effects: [],
  };
  return {
    trait: rawTrait,
    count,
    activeEffect: null,
    style: 0,
  };
}

describe('SPELL_CRIT_ITEMS', () => {
  it('6종 (기본/Corrupted/Radiant × 보건/무대) 포함', () => {
    expect(SPELL_CRIT_ITEMS.size).toBe(6);
    expect(SPELL_CRIT_ITEMS.has('TFT_Item_JeweledGauntlet')).toBe(true);
    expect(SPELL_CRIT_ITEMS.has('TFT_Item_CorruptedJeweledGauntlet')).toBe(true);
    expect(SPELL_CRIT_ITEMS.has('TFT_Item_Radiant_JeweledGauntlet')).toBe(true);
    expect(SPELL_CRIT_ITEMS.has('TFT_Item_InfinityEdge')).toBe(true);
    expect(SPELL_CRIT_ITEMS.has('TFT_Item_CorruptedInfinityEdge')).toBe(true);
    expect(SPELL_CRIT_ITEMS.has('TFT_Item_Radiant_InfinityEdge')).toBe(true);
  });
});

describe('hasSpellCritItem', () => {
  it('빈 배열 → false', () => {
    expect(hasSpellCritItem([])).toBe(false);
  });

  it('보건 포함 → true', () => {
    expect(hasSpellCritItem([item('TFT_Item_JeweledGauntlet')])).toBe(true);
  });

  it('찬란한 무대 포함 → true', () => {
    expect(hasSpellCritItem([item('TFT_Item_Radiant_InfinityEdge')])).toBe(true);
  });

  it('타락한 보건 포함 → true', () => {
    expect(hasSpellCritItem([item('TFT_Item_CorruptedJeweledGauntlet')])).toBe(true);
  });

  it('관계없는 아이템만 → false', () => {
    expect(hasSpellCritItem([item('TFT_Item_BFSword'), item('TFT_Item_Bloodthirster')])).toBe(false);
  });

  it('보건 + 다른 아이템 섞여도 → true', () => {
    expect(hasSpellCritItem([
      item('TFT_Item_BFSword'),
      item('TFT_Item_JeweledGauntlet'),
      item('TFT_Item_RabadonsDeathcap'),
    ])).toBe(true);
  });
});

describe('hasSpellCritEnableTrait', () => {
  it('Set 17 엔 crit-enable trait 없음 — 항상 false', () => {
    expect(SPELL_CRIT_TRAIT_APINAMES.length).toBe(0);
    expect(hasSpellCritEnableTrait([])).toBe(false);
    expect(hasSpellCritEnableTrait([trait('TFT17_Sorcerer', 4)])).toBe(false);
  });
});

describe('computeSpellCanCrit', () => {
  it('아이템 X + trait X → false', () => {
    expect(computeSpellCanCrit([], [])).toBe(false);
  });

  it('보건 있으면 trait 무관 → true', () => {
    expect(computeSpellCanCrit([item('TFT_Item_JeweledGauntlet')], [])).toBe(true);
  });

  it('undefined 입력도 안전하게 false', () => {
    expect(computeSpellCanCrit(undefined, undefined)).toBe(false);
  });

  it('items undefined + traits [] → false', () => {
    expect(computeSpellCanCrit(undefined, [])).toBe(false);
  });
});

describe('expectedSpellCritMultiplier', () => {
  it('기본 critChance=0.25, critMult=1.4 → 1.10', () => {
    expect(expectedSpellCritMultiplier(0.25, 1.4)).toBeCloseTo(1.10, 5);
  });

  it('critChance=0 → 1 (크리 불가)', () => {
    expect(expectedSpellCritMultiplier(0, 1.4)).toBe(1);
  });

  it('critChance=1 → critMultiplier 와 동일 (확정 크리)', () => {
    expect(expectedSpellCritMultiplier(1, 1.4)).toBeCloseTo(1.4, 5);
  });

  it('critMult=1 (1배) → 1 (크리 의미 없음)', () => {
    expect(expectedSpellCritMultiplier(0.5, 1)).toBe(1);
  });
});
