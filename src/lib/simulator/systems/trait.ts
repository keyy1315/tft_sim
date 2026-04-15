import { RawChampion, RawTrait, ActiveTrait, TraitEffect, PlacedChampion, MF_MODE_CONFIG } from '@/types';

/** MF "특성 선택" 트레이트를 선택된 모드의 실제 트레이트로 교체 */
function resolveMfTraits(champion: RawChampion, mfMode?: PlacedChampion['mfMode']): string[] {
  if (champion.apiName !== 'TFT17_MissFortune' || !mfMode) return champion.traits;
  const modeTrait = MF_MODE_CONFIG[mfMode];
  // "특성 선택" → 실제 트레이트 이름으로 교체 (trait name은 resolveTraits에서 name 매칭)
  return champion.traits.map(t => t === '특성 선택' ? modeTrait.name : t);
}

/** 모드 apiName → 트레이트 이름 매핑 (trait JSON의 name 기준) */
const MF_TRAIT_API_TO_NAME: Record<string, string> = {};

export function resolveTraits(
  champions: { champion: RawChampion; mfMode?: PlacedChampion['mfMode'] }[],
  allTraits: RawTrait[]
): ActiveTrait[] {
  // Build apiName→name map for MF mode traits (lazy init)
  if (Object.keys(MF_TRAIT_API_TO_NAME).length === 0) {
    for (const cfg of Object.values(MF_MODE_CONFIG)) {
      const t = allTraits.find(tr => tr.apiName === cfg.trait);
      if (t) MF_TRAIT_API_TO_NAME[cfg.trait] = t.name;
    }
    // Update MF_MODE_CONFIG names to match actual trait names from data
    for (const [mode, cfg] of Object.entries(MF_MODE_CONFIG)) {
      const realName = MF_TRAIT_API_TO_NAME[cfg.trait];
      if (realName) (MF_MODE_CONFIG as Record<string, typeof cfg>)[mode] = { ...cfg, name: realName };
    }
  }

  // Count traits from placed champions (with MF mode substitution)
  const traitCounts = new Map<string, number>();
  for (const { champion, mfMode } of champions) {
    const traits = resolveMfTraits(champion, mfMode);
    for (const traitName of traits) {
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
