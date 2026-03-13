import { RawChampion } from '@/types';

export type DamageType = 'magic' | 'physical' | 'true';

export interface ParsedAbility {
  damageType: DamageType;
  scalingType: 'ap' | 'ad' | 'none';
  damageValues: number[]; // [base, 1star, 2star, 3star]
  damageVarName: string | null;
}

export function parseAbility(champion: RawChampion): ParsedAbility {
  const desc = champion.ability.desc;
  const variables = champion.ability.variables;

  // Determine damage type from desc tags
  let damageType: DamageType = 'magic';
  if (desc.includes('<physicalDamage>')) damageType = 'physical';
  else if (desc.includes('<trueDamage>')) damageType = 'true';

  // Determine scaling type
  let scalingType: 'ap' | 'ad' | 'none' = 'none';
  if (desc.includes('scaleAP')) scalingType = 'ap';
  else if (desc.includes('scaleAD')) scalingType = 'ad';

  // Find the primary damage variable
  const damageVarNames = ['Damage', 'MagicDamage', 'PhysicalDamage', 'TotalDamage', 'BonusDamage', 'DamagePerTick'];
  let damageVar = variables.find(v => damageVarNames.includes(v.name));
  if (!damageVar && variables.length > 0) {
    damageVar = variables[0];
  }

  return {
    damageType,
    scalingType,
    damageValues: damageVar?.value || [0, 0, 0, 0],
    damageVarName: damageVar?.name || null,
  };
}

export function getAbilityDamage(
  champion: RawChampion,
  starLevel: number,
  ap: number,
  bonusAdPercent: number = 0
): { damage: number; type: DamageType } {
  const parsed = parseAbility(champion);
  const baseValue = parsed.damageValues[starLevel] ?? parsed.damageValues[1] ?? 0;

  let damage = baseValue;
  if (parsed.scalingType === 'ap') {
    damage = baseValue * (1 + ap / 100);
  } else if (parsed.scalingType === 'ad') {
    damage = baseValue * (1 + bonusAdPercent);
  }

  return { damage, type: parsed.damageType };
}
