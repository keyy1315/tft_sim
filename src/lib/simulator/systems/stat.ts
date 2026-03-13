import { RawChampion, RawItem, ChampionStats, StatBreakdown, ItemEffect, ActiveTrait, STAR_SCALING } from '@/types';
import { ITEM_EFFECT_KEYS } from '@/lib/simulator/models/constants';

export function getItemEffects(items: RawItem[]): ItemEffect {
  const result: ItemEffect = {};
  for (const item of items) {
    for (const [key, value] of Object.entries(item.effects)) {
      const mapped = ITEM_EFFECT_KEYS[key];
      if (mapped && typeof value === 'number') {
        (result as Record<string, number>)[mapped] = ((result as Record<string, number>)[mapped] || 0) + value;
      }
    }
  }
  return result;
}

/** Trait-specific variable → stat mapping table */
const TRAIT_STAT_MAP: Record<string, Record<string, string>> = {
  TFT16_Vanquisher: { BaseCritChance: 'critChance', CritDmg: 'critDamage' },
  TFT16_Slayer: { BonusAD: 'ad', BonusOmnivamp: 'omnivamp' },
  TFT16_Rapidfire: { MinBonusAS: 'as' },
  TFT16_Sorcerer: { BonusAP: 'ap', AllyAP: 'ap' },
  TFT16_Brawler: { TeamFlatHealth: 'hp', BonusPercentHealth: 'hpPercent' },
  TFT16_Defender: { BonusArmorMR: 'armor', TeamwideArmorMR: 'armor' },
  TFT16_Warden: { PercentHealthShield: 'shield' },
};

export interface ExtendedTraitEffect extends ItemEffect {
  omnivamp?: number;
  damageAmp?: number;
  hpPercent?: number;
  shield?: number;
}

export function getTraitBonuses(activeTraits: ActiveTrait[]): ExtendedTraitEffect {
  const result: ExtendedTraitEffect = {};
  for (const at of activeTraits) {
    if (!at.activeEffect) continue;
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
          (result as Record<string, number>)[statKey] = ((result as Record<string, number>)[statKey] || 0) + val;
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

  const baseAd = champion.stats.damage;
  const adBreakdown: StatBreakdown = {
    base: baseAd,
    starScaling: baseAd * star - baseAd,
    items: baseAd * star * (itemFx.ad || 0),
    traits: baseAd * star * (traitFx.ad || 0),
    augments: baseAd * star * (augmentEffects.ad || 0),
    total: baseAd * star * (1 + (itemFx.ad || 0) + (traitFx.ad || 0) + (augmentEffects.ad || 0)),
  };

  const apBreakdown: StatBreakdown = {
    base: 0,
    starScaling: 0,
    items: itemFx.ap || 0,
    traits: traitFx.ap || 0,
    augments: augmentEffects.ap || 0,
    total: (itemFx.ap || 0) + (traitFx.ap || 0) + (augmentEffects.ap || 0),
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
  const hpBreakdown: StatBreakdown = {
    base: baseHp,
    starScaling: baseHp * star - baseHp,
    items: itemFx.hp || 0,
    traits: traitFx.hp || 0,
    augments: augmentEffects.hp || 0,
    total: baseHp * star + (itemFx.hp || 0) + (traitFx.hp || 0) + (augmentEffects.hp || 0),
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
