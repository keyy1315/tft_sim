import { RawChampion, RawItem, ChampionStats, StatBreakdown, ItemEffect, ActiveTrait, STAR_SCALING } from '@/types';
import { ITEM_EFFECT_KEYS } from '@/lib/simulator/models/constants';
import { ITEM_EFFECTS } from '@/lib/simulator/systems/items/registry';

/** 빌지워터 능력치 구매 → ItemEffect 변환 (빌지워터 유닛에만 적용) */
export function resolveBilgewaterStatEffects(
  purchases: Record<string, number>,
  allItems: RawItem[]
): ItemEffect {
  const result: ItemEffect = {};
  for (const [apiName, count] of Object.entries(purchases)) {
    const item = allItems.find(i => i.apiName === apiName);
    if (!item) continue;
    for (const [key, value] of Object.entries(item.effects)) {
      if (typeof value !== 'number') continue;
      if (key === 'BonusAD') result.ad = (result.ad ?? 0) + value * count;
      if (key === 'BonusAP') result.ap = (result.ap ?? 0) + value * count;
      if (key === 'BonusAS') result.as = (result.as ?? 0) + value * count;
      if (key === 'BonusHealthPercent') {
        (result as Record<string, number>)['hpPercent'] = ((result as Record<string, number>)['hpPercent'] ?? 0) + value * count;
      }
      if (key === 'BonusArmorMR') {
        result.armor = (result.armor ?? 0) + value * count;
        result.magicResist = (result.magicResist ?? 0) + value * count;
      }
    }
  }
  return result;
}

/**
 * 아이템 → ItemEffect 누적.
 *
 * Registry 우선 + legacy fallback 전략 (Design §8.1):
 * - ITEM_EFFECTS[apiName] 에 entry 존재 → StatPatch descriptor 합산 (새 경로)
 * - entry 없음 → 기존 ITEM_EFFECT_KEYS 매핑으로 effects 순회 (legacy 경로)
 *
 * Phase 2: 이관 완료 아이템과 미이관 아이템이 공존. 두 경로가 동일한 결과를 내도록 유지.
 */
export function getItemEffects(items: RawItem[]): ItemEffect {
  const result: ItemEffect = {};
  for (const item of items) {
    const descriptors = ITEM_EFFECTS[item.apiName];
    if (descriptors && descriptors.length > 0) {
      for (const d of descriptors) {
        if (d.kind === 'stat') mergeStatPatch(result, d.stats);
      }
      continue;
    }
    mergeLegacy(result, item.effects);
  }
  return result;
}

function mergeStatPatch(target: ItemEffect, patch: Partial<ItemEffect>): void {
  const t = target as Record<string, number>;
  const p = patch as Record<string, number | undefined>;
  for (const key in p) {
    const v = p[key];
    if (typeof v === 'number') {
      t[key] = (t[key] ?? 0) + v;
    }
  }
}

/**
 * data 가 integer percentage points 로 저장하는 키 (e.g., AS=40 = +40%) — sim 은 fraction
 * (1.0 = +100%) 사용. legacy fallback 경로에서 변환 필요.
 *
 * 진단 (PR #93 follow-up): set 17 데이터 53 AS 보유 items 모두 integer pts (10~100 범위).
 * 5 items 는 registry 에 등록되어 explicit fraction (예: as: 0.45) 사용 — 정상. 나머지
 * 48 items 는 legacy fallback 으로 흐르면서 raw integer 가 fraction 으로 잘못 적용 → +4000% AS 등
 * 광범위 over-buff. EvelynnArtifact 의 +30.75 AS (probe) 가 대표 사례.
 *
 * 정규화: legacy 경로에서 'AS' / 'BonusAS' / 'AttackSpeed' 키 값이 1 이상이면 /100 (fraction 으로).
 */
const LEGACY_AS_KEYS = new Set(['AS', 'BonusAS', 'AttackSpeed']);

function mergeLegacy(target: ItemEffect, effects: Record<string, number>): void {
  const t = target as Record<string, number>;
  for (const [key, value] of Object.entries(effects)) {
    const mapped = ITEM_EFFECT_KEYS[key];
    if (mapped && typeof value === 'number') {
      // AS family: data integer pts → sim fraction. value < 1 (이미 fraction) 인 경우 그대로.
      const normalized = (LEGACY_AS_KEYS.has(key) && value >= 1) ? value / 100 : value;
      t[mapped] = (t[mapped] ?? 0) + normalized;
    }
  }
}

/** Trait-specific variable → stat mapping table */
const TRAIT_STAT_MAP: Record<string, Record<string, string>> = {
  TFT16_Vanquisher: { BaseCritChance: 'critChance', CritDmg: 'critDamage' },
  TFT16_Slayer: { BonusAD: 'ad', BonusOmnivamp: 'omnivamp' },
  TFT16_Rapidfire: { MinBonusAS: 'as', TeamwideAS: 'as' },
  TFT16_Sorcerer: { AllyAP: 'ap' },
  TFT16_Brawler: { TeamFlatHealth: 'hp', BonusPercentHealth: 'hpPercent' },
  TFT16_Defender: { TeamwideArmorMR: 'armorMR' },
  TFT16_Warden: { PercentHealthShield: 'shield' },
  TFT16_Demacia: { ArmorMR: 'armorMR' },
  TFT16_Yordle: { BonusHealth: 'hp', AS: 'as' },
  TFT16_Shurima: { ArmorMR: 'armorMR', BonusHealth: 'hpPercent', ASPerSecond: 'as' },
  TFT16_ShadowIsles: { ADAP: 'adap' },
  TFT16_Invoker: { TeamBonusMana: 'manaRegen' },
};

export interface ExtendedTraitEffect extends ItemEffect {
  omnivamp?: number;
  damageAmp?: number;
  hpPercent?: number;
  shield?: number;
  manaRegen?: number;
}

export function getTraitBonuses(activeTraits: ActiveTrait[]): ExtendedTraitEffect {
  const result: ExtendedTraitEffect = {};
  for (const at of activeTraits) {
    if (!at.activeEffect) continue;
    // 메카 (TFT17_Mecha): 메카 unit 한정 효과. generic AD/AP team-wide 적용 회피.
    // combatLoop.applyMechaEffects 에서 멤버 한정 후처리.
    if (at.trait.apiName === 'TFT17_Mecha') continue;
    const vars = at.activeEffect.variables;

    // Generic variable mapping
    if (vars.AD && typeof vars.AD === 'number') result.ad = (result.ad || 0) + vars.AD;
    if (vars.AP && typeof vars.AP === 'number') result.ap = (result.ap || 0) + vars.AP;
    if (vars.AS && typeof vars.AS === 'number') result.as = (result.as || 0) + vars.AS;
    if (vars.Health && typeof vars.Health === 'number') result.hp = (result.hp || 0) + vars.Health;
    if (vars.Armor && typeof vars.Armor === 'number') result.armor = (result.armor || 0) + vars.Armor;
    if (vars.MagicResist && typeof vars.MagicResist === 'number') result.magicResist = (result.magicResist || 0) + vars.MagicResist;

    // Trait-specific mapping
    const traitMap = TRAIT_STAT_MAP[at.trait.apiName];
    if (traitMap) {
      for (const [varKey, statKey] of Object.entries(traitMap)) {
        const val = vars[varKey];
        if (typeof val === 'number') {
          if (statKey === 'armorMR') {
            result.armor = (result.armor || 0) + val;
            result.magicResist = (result.magicResist || 0) + val;
          } else if (statKey === 'adap') {
            result.ad = (result.ad || 0) + val;
            result.ap = (result.ap || 0) + val * 100;
          } else {
            (result as Record<string, number>)[statKey] = ((result as Record<string, number>)[statKey] || 0) + val;
          }
        }
      }
    }

    // Bilgewater StatMult: amplify bilgewater item effects
    if (at.trait.apiName === 'TFT16_Bilgewater' && typeof vars.StatMult === 'number') {
      result.damageAmp = (result.damageAmp || 0) + vars.StatMult;
    }

    // Rapidfire BaseDamageAmp
    if (at.trait.apiName === 'TFT16_Rapidfire' && typeof vars.BaseDamageAmp === 'number') {
      result.damageAmp = (result.damageAmp || 0) + vars.BaseDamageAmp;
    }
  }
  return result;
}

export function calculateStats(
  champion: RawChampion,
  starLevel: number,
  items: RawItem[],
  activeTraits: ActiveTrait[] = [],
  augmentEffects: ItemEffect = {}
): { stats: ChampionStats; breakdown: Record<string, StatBreakdown> } {
  const star = STAR_SCALING[starLevel] || 1;
  const itemFx = getItemEffects(items);
  const traitFx = getTraitBonuses(activeTraits);

  // 공허 돌연변이 ADAP (AD% + AP 동시 증가)
  const adapBonus = (itemFx as Record<string, number>)['adap'] || 0;

  const baseAd = champion.stats.damage;
  const adBreakdown: StatBreakdown = {
    base: baseAd,
    starScaling: baseAd * star - baseAd,
    items: baseAd * star * ((itemFx.ad || 0) + adapBonus),
    traits: baseAd * star * (traitFx.ad || 0),
    augments: baseAd * star * (augmentEffects.ad || 0),
    total: baseAd * star * (1 + (itemFx.ad || 0) + adapBonus + (traitFx.ad || 0) + (augmentEffects.ad || 0)),
  };

  const apBreakdown: StatBreakdown = {
    base: 0,
    starScaling: 0,
    items: (itemFx.ap || 0) + adapBonus * 100,
    traits: traitFx.ap || 0,
    augments: augmentEffects.ap || 0,
    total: (itemFx.ap || 0) + adapBonus * 100 + (traitFx.ap || 0) + (augmentEffects.ap || 0),
  };

  const baseAs = champion.stats.attackSpeed;
  const asBreakdown: StatBreakdown = {
    base: baseAs,
    starScaling: 0,
    items: baseAs * (itemFx.as || 0),
    traits: baseAs * (traitFx.as || 0),
    augments: baseAs * (augmentEffects.as || 0),
    total: baseAs * (1 + (itemFx.as || 0) + (traitFx.as || 0) + (augmentEffects.as || 0)),
  };

  const baseHp = champion.stats.hp;
  // 공허 거대 껍질: BonusPercentHP → hpPercent로 변환
  const voidHpPercent = items.reduce((sum, item) => {
    const bph = item.effects['BonusPercentHP'];
    return sum + (typeof bph === 'number' ? bph : 0);
  }, 0);
  const flatHp = baseHp * star + (itemFx.hp || 0) + (traitFx.hp || 0) + (augmentEffects.hp || 0);
  const hpPercentBonus = (traitFx.hpPercent || 0) + ((augmentEffects as Record<string, number>)['hpPercent'] || 0) + voidHpPercent;
  const hpBreakdown: StatBreakdown = {
    base: baseHp,
    starScaling: baseHp * star - baseHp,
    items: itemFx.hp || 0,
    traits: (traitFx.hp || 0) + Math.round(flatHp * (traitFx.hpPercent || 0)),
    augments: (augmentEffects.hp || 0) + Math.round(flatHp * ((augmentEffects as Record<string, number>)['hpPercent'] || 0)),
    total: Math.round(flatHp * (1 + hpPercentBonus)),
  };

  const armorBreakdown: StatBreakdown = {
    base: champion.stats.armor,
    starScaling: 0,
    items: itemFx.armor || 0,
    traits: traitFx.armor || 0,
    augments: augmentEffects.armor || 0,
    total: champion.stats.armor + (itemFx.armor || 0) + (traitFx.armor || 0) + (augmentEffects.armor || 0),
  };

  const mrBreakdown: StatBreakdown = {
    base: champion.stats.magicResist,
    starScaling: 0,
    items: itemFx.magicResist || 0,
    traits: traitFx.magicResist || 0,
    augments: augmentEffects.magicResist || 0,
    total: champion.stats.magicResist + (itemFx.magicResist || 0) + (traitFx.magicResist || 0) + (augmentEffects.magicResist || 0),
  };

  const critChanceBreakdown: StatBreakdown = {
    base: champion.stats.critChance,
    starScaling: 0,
    items: itemFx.critChance || 0,
    traits: traitFx.critChance || 0,
    augments: augmentEffects.critChance || 0,
    total: Math.min(1, champion.stats.critChance + (itemFx.critChance || 0) + (traitFx.critChance || 0) + (augmentEffects.critChance || 0)),
  };

  const critMultBreakdown: StatBreakdown = {
    base: champion.stats.critMultiplier,
    starScaling: 0,
    items: itemFx.critDamage || 0,
    traits: traitFx.critDamage || 0,
    augments: augmentEffects.critDamage || 0,
    total: champion.stats.critMultiplier + (itemFx.critDamage || 0) + (traitFx.critDamage || 0) + (augmentEffects.critDamage || 0),
  };

  const armorPen = Math.min(1, (itemFx.armorPen || 0) + (traitFx.armorPen || 0) + (augmentEffects.armorPen || 0)) / 100;
  const magicPen = Math.min(1, (itemFx.magicPen || 0) + (traitFx.magicPen || 0) + (augmentEffects.magicPen || 0)) / 100;

  const stats: ChampionStats = {
    hp: hpBreakdown.total,
    armor: armorBreakdown.total,
    magicResist: mrBreakdown.total,
    damage: adBreakdown.total,
    attackSpeed: asBreakdown.total,
    critChance: critChanceBreakdown.total,
    critMultiplier: critMultBreakdown.total,
    ap: apBreakdown.total,
    mana: champion.stats.initialMana,
    maxMana: champion.stats.mana,
    range: champion.stats.range,
    armorPen,
    magicPen,
  };

  return {
    stats,
    breakdown: {
      ad: adBreakdown,
      ap: apBreakdown,
      as: asBreakdown,
      hp: hpBreakdown,
      armor: armorBreakdown,
      mr: mrBreakdown,
      critChance: critChanceBreakdown,
      critMultiplier: critMultBreakdown,
    },
  };
}
