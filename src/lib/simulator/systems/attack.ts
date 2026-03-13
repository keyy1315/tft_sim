import { RawChampion, RawItem, ActiveTrait, ItemEffect, DamageResult } from '@/types';
import { calculateStats } from '@/lib/simulator/systems/stat';
import { getAbilityDamage } from '@/lib/simulator/systems/ability';

function applyResistance(damage: number, resistance: number): number {
  return damage * 100 / (100 + resistance);
}

export function calculateDamage(
  champion: RawChampion,
  starLevel: number,
  items: RawItem[],
  activeTraits: ActiveTrait[] = [],
  augmentEffects: ItemEffect = {},
  targetArmor: number = 40,
  targetMr: number = 40
): DamageResult {
  const { stats, breakdown } = calculateStats(champion, starLevel, items, activeTraits, augmentEffects);

  // Auto attack DPS
  const critExpectedMultiplier = 1 + stats.critChance * (stats.critMultiplier - 1);
  const autoAttackDamage = stats.damage * critExpectedMultiplier;
  const autoAttackDps = autoAttackDamage * stats.attackSpeed;

  // Ability damage
  const { damage: abilityDmg, type: abilityDmgType } = getAbilityDamage(
    champion,
    starLevel,
    stats.ap,
    (stats.damage - champion.stats.damage) / champion.stats.damage
  );

  // 10 second total DPS estimation
  const manaPerSecond = stats.attackSpeed * 10; // 10 mana per attack
  const castTime = stats.maxMana > 0 ? (stats.maxMana - stats.mana) / manaPerSecond : 10;
  const castsIn10s = stats.maxMana > 0 ? Math.floor(10 / castTime) : 0;
  const totalDps10s = autoAttackDps + (castsIn10s * abilityDmg / 10);

  // Effective damage (after resistance)
  const physResist = targetArmor;
  const magResist = targetMr;
  const effectiveAutoAttackDps = applyResistance(autoAttackDps, physResist);
  const effectiveAbilityDamage = abilityDmgType === 'magic'
    ? applyResistance(abilityDmg, magResist)
    : abilityDmgType === 'physical'
      ? applyResistance(abilityDmg, physResist)
      : abilityDmg; // true damage
  const effectiveTotalDps10s = effectiveAutoAttackDps + (castsIn10s * effectiveAbilityDamage / 10);

  return {
    autoAttackDps,
    autoAttackDamage,
    abilityDamage: abilityDmg,
    abilityDamageType: abilityDmgType,
    totalDps10s,
    effectiveAutoAttackDps,
    effectiveAbilityDamage,
    effectiveTotalDps10s,
    statBreakdown: breakdown as DamageResult['statBreakdown'],
  };
}
