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
  // composition 을 2개로 채워 isCombinedItem === true 로 만든다. 이를 통해
  // getItemCategory === 'combined' 판정을 받아 추천 풀 통과.
  return {
    apiName,
    name: apiName,
    desc: '',
    icon: '',
    effects,
    composition: ['TFT_Item_A', 'TFT_Item_B'],
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

describe('filterItemPool — trait rules', () => {
  const noCtx = { psyOpsLevel: 0, animaSquadLevel: 0 };

  it('유물 아이템은 항상 제외', () => {
    const all = [
      item('TFT_Item_Artifact_ShadowPuppet', { AD: 20 }),
      item('TFT17_Item_Artifact_ZekesHeraldShadow', { AD: 30 }),
      item('TFT_Item_InfinityEdge', { AD: 70 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', noCtx);
    const names = out.map(i => i.apiName);
    expect(names).not.toContain('TFT_Item_Artifact_ShadowPuppet');
    expect(names).not.toContain('TFT17_Item_Artifact_ZekesHeraldShadow');
    expect(names).toContain('TFT_Item_InfinityEdge');
  });

  it('찬란한(Radiant) / 타락한(Corrupted) 아이템 항상 제외', () => {
    const all = [
      item('TFT_Item_Radiant_Deathblade', { AD: 80 }),
      item('TFT_Item_Radiant_VoidStaff', { AP: 80 }),
      item('TFT_Item_CorruptedInfinityEdge', { AD: 100, CritChance: 75 }),
      item('TFT_Item_InfinityEdge', { AD: 70 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', noCtx);
    const names = out.map(i => i.apiName);
    expect(names).not.toContain('TFT_Item_Radiant_Deathblade');
    expect(names).not.toContain('TFT_Item_Radiant_VoidStaff');
    expect(names).not.toContain('TFT_Item_CorruptedInfinityEdge');
    expect(names).toContain('TFT_Item_InfinityEdge');
  });

  it('번역 안 된 데이터 (name prefix tft_item_name_ 또는 빈 name) 아이템 제외', () => {
    const bad = item('TFT_Item_SwordOfTheDivine', { AD: 50 });
    (bad as unknown as { name: string }).name = 'tft_item_name_SwordOfTheDivine2';
    const good = item('TFT_Item_InfinityEdge', { AD: 70 });
    (good as unknown as { name: string }).name = '무한의 대검';
    const out = filterItemPool([bad, good], 'DAMAGE', 'ad', noCtx);
    expect(out.map(i => i.apiName)).not.toContain('TFT_Item_SwordOfTheDivine');
    expect(out.map(i => i.apiName)).toContain('TFT_Item_InfinityEdge');
  });

  it('PsyOps Radiant 변종은 PsyOps 규칙 우선 (일반 Radiant 규칙이 아님)', () => {
    const all = [
      item('TFT17_Item_PsyOps_DroneMod_Radiant', { AD: 60 }),
    ];
    // PsyOps 비활성 → 제외
    expect(
      filterItemPool(all, 'DAMAGE', 'ad', noCtx).length,
    ).toBe(0);
    // PsyOps 2 활성 → 포함
    expect(
      filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 2, animaSquadLevel: 0 }).length,
    ).toBe(1);
  });

  it('동물특공대 만능 무기는 항상 제외 (시너지 활성도 무관)', () => {
    const all = [
      item('TFT17_AnimaSquadItem_Tier4_Omniweapon', { AD: 100 }),
      item('TFT_Item_InfinityEdge', { AD: 70 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 0, animaSquadLevel: 6 });
    expect(out.map(i => i.apiName)).not.toContain('TFT17_AnimaSquadItem_Tier4_Omniweapon');
  });

  it('AnimaSquad 비활성 시 AnimaSquad 아이템 제외', () => {
    const all = [
      item('TFT17_AnimaSquadItem_Tier2_SearingShortbow', { AD: 40 }),
      item('TFT_Item_InfinityEdge', { AD: 70 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', noCtx);
    expect(out.map(i => i.apiName)).not.toContain('TFT17_AnimaSquadItem_Tier2_SearingShortbow');
  });

  it('AnimaSquad 3+ 활성 시 AnimaSquad 아이템 포함', () => {
    const all = [
      item('TFT17_AnimaSquadItem_Tier2_SearingShortbow', { AD: 40 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 0, animaSquadLevel: 3 });
    expect(out.map(i => i.apiName)).toContain('TFT17_AnimaSquadItem_Tier2_SearingShortbow');
  });

  it('PsyOps 비활성 시 PsyOps 아이템 제외', () => {
    const all = [
      item('TFT17_Item_PsyOps_DroneMod', { AD: 40 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', noCtx);
    expect(out.map(i => i.apiName)).not.toContain('TFT17_Item_PsyOps_DroneMod');
  });

  it('PsyOps 2+ 활성 시 PsyOps 아이템 포함', () => {
    const all = [
      item('TFT17_Item_PsyOps_DroneMod', { AD: 40 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 2, animaSquadLevel: 0 });
    expect(out.map(i => i.apiName)).toContain('TFT17_Item_PsyOps_DroneMod');
  });
});

describe('pickTopCombo — maxPsyOps 제약', () => {
  it('maxPsyOps=1 이면 조합에 PsyOps 최대 1개', () => {
    const scored = [
      { item: item('TFT17_Item_PsyOps_DroneMod', { AD: 100 }), score: 100, reason: '' },
      { item: item('TFT17_Item_PsyOps_ChemicalCapacitorMod', { AD: 95 }), score: 95, reason: '' },
      { item: item('TFT_Item_InfinityEdge', { AD: 90 }), score: 90, reason: '' },
      { item: item('TFT_Item_LastWhisper', { AD: 85 }), score: 85, reason: '' },
      { item: item('TFT_Item_GuinsoosRageblade', { AD: 80 }), score: 80, reason: '' },
    ];
    const combo = pickTopCombo(scored, baseStats, false, 2, { maxPsyOps: 1 });
    const psyCount = combo.filter(r => r.item.apiName.startsWith('TFT17_Item_PsyOps_')).length;
    expect(psyCount).toBeLessThanOrEqual(1);
  });

  it('maxPsyOps=0 이면 조합에 PsyOps 없음', () => {
    const scored = [
      { item: item('TFT17_Item_PsyOps_DroneMod', { AD: 100 }), score: 100, reason: '' },
      { item: item('TFT_Item_InfinityEdge', { AD: 90 }), score: 90, reason: '' },
      { item: item('TFT_Item_LastWhisper', { AD: 85 }), score: 85, reason: '' },
      { item: item('TFT_Item_GuinsoosRageblade', { AD: 80 }), score: 80, reason: '' },
    ];
    const combo = pickTopCombo(scored, baseStats, false, 2, { maxPsyOps: 0 });
    const psyCount = combo.filter(r => r.item.apiName.startsWith('TFT17_Item_PsyOps_')).length;
    expect(psyCount).toBe(0);
  });
});
