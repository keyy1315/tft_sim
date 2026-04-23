import type { PlacedChampion, RawChampion, RawItem } from '@/types';
import type { PlacedUnit } from './types';

/**
 * Convert actual-data PlacedUnit -> simulator PlacedChampion for rendering on SetupBoardCore.
 * Requires champion/item catalog lookups. Returns null if champion is not found in the catalog.
 *
 * PlacedUnit.items is a 3-tuple of optional item apiName strings; any missing / unresolved slot
 * is dropped (PlacedChampion.items is a plain RawItem[] with no slot semantics).
 */
export function toPlacedChampion(
  u: PlacedUnit,
  championCatalog: Map<string, RawChampion>,
  itemCatalog: Map<string, RawItem>,
): PlacedChampion | null {
  const champion = championCatalog.get(u.championId);
  if (!champion) return null;
  const items: RawItem[] = [];
  for (const id of u.items) {
    if (!id) continue;
    const item = itemCatalog.get(id);
    if (item) items.push(item);
  }
  return {
    champion,
    position: u.hex,
    starLevel: u.starLevel,
    items,
    voidItem: null,
    mfMode: null,
    permanentStacks: null,
    isDummy: false,
    isSummon: false,
  };
}

/**
 * Convert simulator PlacedChampion -> actual-data PlacedUnit for persistence.
 * starLevel is narrowed to 1|2|3 (PlacedChampion.starLevel is `number`; out-of-range
 * values are clamped to 1).
 */
export function fromPlacedChampion(p: PlacedChampion): PlacedUnit {
  const star = p.starLevel === 2 || p.starLevel === 3 ? p.starLevel : 1;
  return {
    championId: p.champion.apiName,
    hex: p.position,
    starLevel: star,
    items: [
      p.items[0]?.apiName,
      p.items[1]?.apiName,
      p.items[2]?.apiName,
    ] as PlacedUnit['items'],
  };
}
