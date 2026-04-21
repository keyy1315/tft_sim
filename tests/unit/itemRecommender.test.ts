import { describe, it, expect } from 'vitest';
import type { RawChampion, RawItem, ChampionStats } from '@/types';
import {
  classifyRole,
  filterItemPool,
  scoreItemsForDamage,
  pickTopCombo,
  tagReason,
  getStaticRecommendations,
  verifyWithSimulation,
} from '@/lib/analysis/itemRecommender';

function champ(role: string | null): RawChampion {
  return {
    name: 'mock', apiName: 'mock', cost: 1, traits: [],
    role: role as RawChampion['role'],
    stats: { hp: 500, armor: 10, magicResist: 10, damage: 40, attackSpeed: 0.7, range: 1, critChance: 0.25, critMultiplier: 1.4, initialMana: 0, mana: 50 },
    ability: { name: '', desc: '', icon: '', variables: [] },
  };
}

function item(apiName: string, effects: Record<string, number>): RawItem {
  return {
    apiName,
    name: apiName,
    desc: '',
    icon: '',
    effects,
    composition: [],
  } as unknown as RawItem;
}

const baseStats: ChampionStats = {
  hp: 900, armor: 30, magicResist: 30, damage: 60, ap: 100,
  attackSpeed: 0.8, critChance: 0.25, critMultiplier: 1.4,
  mana: 0, maxMana: 60, range: 1, armorPen: 0, magicPen: 0,
};

describe('classifyRole', () => {
  it('APTank/ADTank → TANK', () => {
    expect(classifyRole(champ('APTank'))).toBe('TANK');
    expect(classifyRole(champ('ADTank'))).toBe('TANK');
  });

  it('Marksman/Assassin/Caster/Fighter/Reaper 계열 → DAMAGE', () => {
    expect(classifyRole(champ('ADCarry'))).toBe('DAMAGE');
    expect(classifyRole(champ('APCaster'))).toBe('DAMAGE');
    expect(classifyRole(champ('ADFighter'))).toBe('DAMAGE');
    expect(classifyRole(champ('ADReaper'))).toBe('DAMAGE');
  });

  it('APSpecialist / ADSpecialist → SUPPORT', () => {
    expect(classifyRole(champ('APSpecialist'))).toBe('SUPPORT');
    expect(classifyRole(champ('ADSpecialist'))).toBe('SUPPORT');
  });

  it('role null/unknown → DAMAGE 기본', () => {
    expect(classifyRole(champ(null))).toBe('DAMAGE');
  });
});

describe('filterItemPool', () => {
  const allItems: RawItem[] = [
    item('TFT_Item_InfinityEdge',        { AD: 70, CritChance: 75 }),
    item('TFT_Item_RabadonsDeathcap',    { AP: 70 }),
    item('TFT_Item_WarmogsArmor',        { Health: 1000 }),
    item('TFT_Item_GargoyleStoneplate',  { Armor: 50, MagicResist: 50 }),
    item('TFT_Item_ThiefsGloves',        {}),
  ];

  it('DAMAGE AD → AD/공속 계열 선호', () => {
    const out = filterItemPool(allItems, 'DAMAGE', 'ad');
    const names = out.map(i => i.apiName);
    expect(names).toContain('TFT_Item_InfinityEdge');
    expect(names).not.toContain('TFT_Item_RabadonsDeathcap');
  });

  it('DAMAGE AP → AP 계열 선호', () => {
    const out = filterItemPool(allItems, 'DAMAGE', 'ap');
    const names = out.map(i => i.apiName);
    expect(names).toContain('TFT_Item_RabadonsDeathcap');
    expect(names).not.toContain('TFT_Item_InfinityEdge');
  });

  it('TANK → HP/방어/마저 계열', () => {
    const out = filterItemPool(allItems, 'TANK', 'none');
    const names = out.map(i => i.apiName);
    expect(names).toContain('TFT_Item_WarmogsArmor');
    expect(names).toContain('TFT_Item_GargoyleStoneplate');
    expect(names).not.toContain('TFT_Item_InfinityEdge');
  });

  it('SUPPORT → 전체 풀', () => {
    const out = filterItemPool(allItems, 'SUPPORT', 'none');
    expect(out.length).toBe(allItems.length);
  });
});

describe('scoreItemsForDamage', () => {
  it('결과는 풀과 동일한 길이, score 는 숫자', () => {
    const items: RawItem[] = [
      item('TFT_Item_InfinityEdge', { AD: 70, CritChance: 75, CritDamage: 10 }),
      item('TFT_Item_ThiefsGloves', {}),
    ];
    const s = scoreItemsForDamage(baseStats, false, 2, items);
    expect(s).toHaveLength(items.length);
    for (const r of s) expect(typeof r.score).toBe('number');
  });
});

describe('pickTopCombo', () => {
  it('3개 이하면 있는 만큼 반환', () => {
    const scored = [
      { item: item('A', { AD: 100 }), score: 100, reason: '' },
      { item: item('B', { AD: 90  }), score: 90,  reason: '' },
    ];
    const combo = pickTopCombo(scored, baseStats, false, 2);
    expect(combo).toHaveLength(2);
  });

  it('후보 많으면 3개 반환 + score 상위 조합', () => {
    const scored = [
      { item: item('A', { AD: 100 }), score: 100, reason: '' },
      { item: item('B', { AD: 90  }), score: 90,  reason: '' },
      { item: item('C', { AD: 80  }), score: 80,  reason: '' },
      { item: item('D', { AD: 70  }), score: 70,  reason: '' },
      { item: item('E', { AD: 60  }), score: 60,  reason: '' },
    ];
    const combo = pickTopCombo(scored, baseStats, false, 2);
    expect(combo).toHaveLength(3);
    const sum = combo.reduce((a, r) => a + r.score, 0);
    // 상위 3 (A+B+C=270) 이 기본. 더 나은 조합이 나올 수도 있으나 최소 보장.
    expect(sum).toBeGreaterThanOrEqual(240);
  });
});

describe('tagReason', () => {
  it('AD + CritChance → "공격력" 포함', () => {
    const r = tagReason(item('IE', { AD: 70, CritChance: 75 }));
    expect(r).toContain('공격력');
  });

  it('ManaOnRoundStart → "마나 가속"', () => {
    expect(tagReason(item('BB', { ManaOnRoundStart: 30 }))).toContain('마나 가속');
  });

  it('Omnivamp → "피해 흡혈"', () => {
    expect(tagReason(item('BT', { Omnivamp: 15 }))).toContain('피해 흡혈');
  });

  it('AP 단독 → "주문력 강화"', () => {
    expect(tagReason(item('RDC', { AP: 70 }))).toContain('주문력 강화');
  });

  it('Health → "체력"', () => {
    expect(tagReason(item('WM', { Health: 1000 }))).toContain('체력');
  });

  it('매칭 실패 시 "범용"', () => {
    expect(tagReason(item('TG', {}))).toBe('범용');
  });
});

describe('getStaticRecommendations', () => {
  it('DAMAGE AD 챔프에게 AD 아이템 위주로 추천', () => {
    const c: RawChampion = {
      name: '진', apiName: 'TFT17_Jhin', cost: 5, traits: [],
      role: 'ADCarry' as RawChampion['role'],
      stats: { hp: 900, armor: 30, magicResist: 30, damage: 60, attackSpeed: 0.8, range: 6, critChance: 0.25, critMultiplier: 1.4, initialMana: 0, mana: 60 },
      ability: {
        name: '', desc: '', icon: '',
        variables: [{ name: 'ADDamage', value: [0, 100, 120, 140] }],
      },
    };
    const pool: RawItem[] = [
      item('TFT_Item_InfinityEdge',       { AD: 70, CritChance: 75 }),
      item('TFT_Item_LastWhisper',        { AttackSpeed: 30, ArmorPen: 50 }),
      item('TFT_Item_GuinsoosRageblade',  { AttackSpeed: 10 }),
      item('TFT_Item_RabadonsDeathcap',   { AP: 70 }),
      item('TFT_Item_WarmogsArmor',       { Health: 1000 }),
    ];
    const recs = getStaticRecommendations(c, baseStats, 2, pool);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(3);
    const names = recs.map(r => r.item.apiName);
    expect(names).not.toContain('TFT_Item_RabadonsDeathcap');
    expect(names).not.toContain('TFT_Item_WarmogsArmor');
  });

  it('TANK 챔프에게 방어/체력 풀 위주', () => {
    const c: RawChampion = {
      name: '일라오이', apiName: 'TFT17_Illaoi', cost: 3, traits: [],
      role: 'APTank' as RawChampion['role'],
      stats: { hp: 1200, armor: 60, magicResist: 60, damage: 50, attackSpeed: 0.7, range: 1, critChance: 0.25, critMultiplier: 1.4, initialMana: 0, mana: 50 },
      ability: { name: '', desc: '', icon: '', variables: [] },
    };
    const pool: RawItem[] = [
      item('TFT_Item_WarmogsArmor',       { Health: 1000 }),
      item('TFT_Item_GargoyleStoneplate', { Armor: 50 }),
      item('TFT_Item_SunfireCape',        { Health: 500, Armor: 30 }),
      item('TFT_Item_InfinityEdge',       { AD: 70 }),
    ];
    const recs = getStaticRecommendations(c, baseStats, 2, pool);
    const names = recs.map(r => r.item.apiName);
    expect(names).not.toContain('TFT_Item_InfinityEdge');
    expect(recs.length).toBeGreaterThan(0);
  });
});

describe('verifyWithSimulation (smoke)', () => {
  it('export 존재', () => {
    expect(typeof verifyWithSimulation).toBe('function');
  });
});
