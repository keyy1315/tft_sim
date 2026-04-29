import { describe, it, expect } from 'vitest';
import type { ChampionStats, RawItem } from '@/types';
import {
  scoreItemsForDamage,
  tagReason,
  filterItemPool,
} from '@/lib/analysis/itemRecommender';

/** isCombinedItem 통과를 위해 composition 2개 이상 채움. */
function item(apiName: string, effects: Record<string, number> = {}): RawItem {
  return {
    apiName,
    name: apiName,
    composition: ['TFT_Item_A', 'TFT_Item_B'],
    effects,
    desc: '',
    icon: '',
  };
}

const apCarryStats: ChampionStats = {
  hp: 900, armor: 30, magicResist: 30, damage: 40, ap: 100,
  attackSpeed: 0.8, critChance: 0.25, critMultiplier: 1.4,
  mana: 0, maxMana: 60, range: 4, armorPen: 0, magicPen: 0,
};

describe('tagReason — 스킬 치명타 언락 태그', () => {
  it('보건(JG) → "스킬 치명타 언락"', () => {
    expect(tagReason(item('TFT_Item_JeweledGauntlet', { AP: 20 }))).toBe('스킬 치명타 언락');
  });

  it('무대(IE) → "스킬 치명타 언락"', () => {
    expect(tagReason(item('TFT_Item_InfinityEdge', { AD: 70, CritChance: 75 }))).toBe('스킬 치명타 언락');
  });

  it('찬란한 보건 → "스킬 치명타 언락"', () => {
    expect(tagReason(item('TFT_Item_Radiant_JeweledGauntlet', {}))).toBe('스킬 치명타 언락');
  });

  it('타락한 무대 → "스킬 치명타 언락"', () => {
    expect(tagReason(item('TFT_Item_CorruptedInfinityEdge', {}))).toBe('스킬 치명타 언락');
  });

  it('일반 AD 아이템 → "스킬 치명타 언락" 아님', () => {
    const tag = tagReason(item('TFT_Item_Bloodthirster', { AD: 0.55, Omnivamp: 0.25 }));
    expect(tag).not.toBe('스킬 치명타 언락');
  });

  it('라바돈 → AP 태그 (crit 언락 아님)', () => {
    const tag = tagReason(item('TFT_Item_RabadonsDeathcap', { AP: 70 }));
    expect(tag).not.toBe('스킬 치명타 언락');
  });
});

describe('scoreItemsForDamage — AP 캐리에게 보건 스코어 상승', () => {
  it('보건(JG) 스코어가 동일 AP 보너스 대조 아이템보다 SPELL_CRIT_UNLOCK_BONUS 만큼 상승', () => {
    const jg = item('TFT_Item_JeweledGauntlet', { AP: 20 });
    const dummy = item('TFT_Item_DummyAP', { AP: 20 });

    const scores = scoreItemsForDamage(apCarryStats, true, 2, [jg, dummy]);
    const jgScore = scores.find(s => s.item.apiName === 'TFT_Item_JeweledGauntlet')!.score;
    const dummyScore = scores.find(s => s.item.apiName === 'TFT_Item_DummyAP')!.score;

    // flatStatBonus 에 +400 (SPELL_CRIT_UNLOCK_BONUS) + estimateDps 의 AP critMul 기댓값 상승
    expect(jgScore).toBeGreaterThan(dummyScore);
    // 최소 프리미엄 300 (flatStatBonus 400 - estimateDps 오차 여유)
    expect(jgScore - dummyScore).toBeGreaterThan(300);
  });

  it('AD 캐리에게는 보건 스코어 프리미엄 없음 (AP 전용)', () => {
    const adStats: ChampionStats = { ...apCarryStats, damage: 70 };
    const jg = item('TFT_Item_JeweledGauntlet', { AP: 20 });
    const dummy = item('TFT_Item_DummyAP', { AP: 20 });

    const scores = scoreItemsForDamage(adStats, false, 2, [jg, dummy]);
    const jgScore = scores.find(s => s.item.apiName === 'TFT_Item_JeweledGauntlet')!.score;
    const dummyScore = scores.find(s => s.item.apiName === 'TFT_Item_DummyAP')!.score;

    // AD 분기는 보건 보너스 미적용 — effects 동일하면 점수도 동일
    expect(Math.abs(jgScore - dummyScore)).toBeLessThan(1);
  });
});

describe('filterItemPool — AP 풀에 보건 포함 확인', () => {
  it('AP 캐리 풀에 보건(JG) 은 AP effect 로 포함', () => {
    const pool: RawItem[] = [
      item('TFT_Item_JeweledGauntlet', { AP: 20 }),
      item('TFT_Item_RabadonsDeathcap', { AP: 70 }),
      item('TFT_Item_BFSword', { AD: 70 }),
    ];
    const result = filterItemPool(pool, 'DAMAGE', 'ap');
    const names = result.map(i => i.apiName);
    expect(names).toContain('TFT_Item_JeweledGauntlet');
    expect(names).toContain('TFT_Item_RabadonsDeathcap');
    expect(names).not.toContain('TFT_Item_BFSword');
  });
});
