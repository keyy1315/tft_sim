import type { ActiveTrait, RawItem } from '@/types';

/** TFT 룰: 보건 / 무대 착용 시에만 스킬에 치명타가 터진다.
 *  기본(Item) / 타락한(Corrupted) / 찬란한(Radiant) 3변종 × 2종 = 6개. */
export const SPELL_CRIT_ITEMS: ReadonlySet<string> = new Set([
  'TFT_Item_JeweledGauntlet',
  'TFT_Item_CorruptedJeweledGauntlet',
  'TFT_Item_Radiant_JeweledGauntlet',
  'TFT_Item_InfinityEdge',
  'TFT_Item_CorruptedInfinityEdge',
  'TFT_Item_Radiant_InfinityEdge',
]);

/** 정밀 계열 시너지(스킬 크리 언락). Set 17 엔 없음 — 빈 배열.
 *  향후 Set 에서 해당 trait 등장 시 여기에 apiName 추가. */
export const SPELL_CRIT_TRAIT_APINAMES: ReadonlyArray<string> = [];

/** 추천 스코어 가산 — AP 캐리가 보건/무대 장착 시 "스킬 크리 언락" 프리미엄.
 *  flatStatBonus 의 다른 AP 가중치 스케일 (SpellDamageAmp × 150 등) 대비 경쟁력 있게 튜닝. */
export const SPELL_CRIT_UNLOCK_BONUS = 400;

export function hasSpellCritItem(items: ReadonlyArray<RawItem>): boolean {
  return items.some(i => SPELL_CRIT_ITEMS.has(i.apiName));
}

export function hasSpellCritEnableTrait(traits: ReadonlyArray<ActiveTrait>): boolean {
  if (SPELL_CRIT_TRAIT_APINAMES.length === 0) return false;
  return traits.some(t =>
    SPELL_CRIT_TRAIT_APINAMES.includes(t.trait.apiName) && t.count > 0,
  );
}

export function computeSpellCanCrit(
  items: ReadonlyArray<RawItem> | undefined,
  traits: ReadonlyArray<ActiveTrait> | undefined,
): boolean {
  return hasSpellCritItem(items ?? []) || hasSpellCritEnableTrait(traits ?? []);
}

/** 스킬 크리 기댓값 배율. 1 + p × (m - 1).
 *  estimateDps AP 분기, flatStatBonus 등 정적 분석에서 사용. */
export function expectedSpellCritMultiplier(
  critChance: number,
  critMultiplier: number,
): number {
  return 1 + critChance * (critMultiplier - 1);
}
