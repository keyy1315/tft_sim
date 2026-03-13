import { RawAugment, ItemEffect } from '@/types';

export function resolveAugmentEffects(augments: RawAugment[]): ItemEffect {
  const result: ItemEffect = {};
  for (const aug of augments) {
    const effects = aug.effects;
    if (effects.AD) result.ad = (result.ad || 0) + effects.AD;
    if (effects.AP) result.ap = (result.ap || 0) + effects.AP;
    if (effects.AS) result.as = (result.as || 0) + effects.AS;
    if (effects.Health) result.hp = (result.hp || 0) + effects.Health;
    if (effects.Armor) result.armor = (result.armor || 0) + effects.Armor;
    if (effects.MagicResist) result.magicResist = (result.magicResist || 0) + effects.MagicResist;
    if (effects.CritChance) result.critChance = (result.critChance || 0) + effects.CritChance;
  }
  return result;
}
