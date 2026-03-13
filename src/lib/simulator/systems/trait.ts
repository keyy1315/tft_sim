import { RawChampion, RawTrait, ActiveTrait, TraitEffect } from '@/types';

export function resolveTraits(
  champions: { champion: RawChampion }[],
  allTraits: RawTrait[]
): ActiveTrait[] {
  // Count traits from placed champions
  const traitCounts = new Map<string, number>();
  for (const { champion } of champions) {
    for (const traitName of champion.traits) {
      traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
    }
  }

  const activeTraits: ActiveTrait[] = [];
  for (const [traitName, count] of traitCounts) {
    const trait = allTraits.find(t => t.name === traitName);
    if (!trait) continue;

    // Find highest tier effect where count >= minUnits
    let activeEffect: TraitEffect | null = null;
    let style = 0;
    for (const effect of trait.effects) {
      if (count >= effect.minUnits) {
        activeEffect = effect;
        style = effect.style;
      }
    }

    activeTraits.push({
      trait,
      count,
      activeEffect,
      style,
    });
  }

  // Sort: active first (by style desc), then inactive
  activeTraits.sort((a, b) => {
    if (a.style !== b.style) return b.style - a.style;
    return b.count - a.count;
  });

  return activeTraits;
}
