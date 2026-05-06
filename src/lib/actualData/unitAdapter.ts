import type { PlacedChampion, RawChampion, RawItem } from '@/types';
import { VOYAGER_SUMMON_CHAMPION, TIBBERS_CHAMPION, AZIR_SOLDIER_CHAMPION, FRELJORD_TURRET, SHEN_ARTIFACT_CHAMPION } from '@/data/specialUnits';
import { normalizeChampionId } from '@/lib/analysis/championIdAliases';
import type { PlacedUnit } from './types';

/**
 * 시뮬의 소환체/보조 유닛은 public champions JSON에 없고 `src/data/specialUnits.ts`에 하드코딩.
 * actual-data catalog에는 JSON 유닛만 들어가므로, 소환체 조회 시 이 매핑으로 fallback.
 */
const SPECIAL_CHAMPIONS: Record<string, RawChampion> = {
  [VOYAGER_SUMMON_CHAMPION.apiName]: VOYAGER_SUMMON_CHAMPION,   // TFT17_Summon (비아와 바이엔)
  [TIBBERS_CHAMPION.apiName]: TIBBERS_CHAMPION,
  [AZIR_SOLDIER_CHAMPION.apiName]: AZIR_SOLDIER_CHAMPION,
  [FRELJORD_TURRET.apiName]: FRELJORD_TURRET,
  [SHEN_ARTIFACT_CHAMPION.apiName]: SHEN_ARTIFACT_CHAMPION,
};

const SUMMON_API_NAMES = new Set(Object.keys(SPECIAL_CHAMPIONS));

/** actual-data championId → RawChampion. special units(소환체) fallback 포함.
 * Riot raw ID(예: TFT17_RekSai) 는 canonical(예: TFT17_Reksai) 로 정규화 후 조회한다. */
export function resolveChampion(
  championId: string,
  championCatalog: Map<string, RawChampion>,
): RawChampion | null {
  const id = normalizeChampionId(championId);
  return championCatalog.get(id) ?? SPECIAL_CHAMPIONS[id] ?? null;
}

/**
 * Convert actual-data PlacedUnit -> simulator PlacedChampion for rendering on SetupBoardCore.
 * Requires champion/item catalog lookups. Returns null if champion is not found in the catalog.
 *
 * PlacedUnit.items is a 3-tuple of optional item apiName strings.
 *  - `items`: compacted RawItem[] (legacy 호환 — 빈/미해결 슬롯 제거)
 *  - `itemSlots`: 3-tuple (RawItem | null) — 슬롯 좌표 보존. SetupBoardCore 가 고정 3-슬롯
 *    레이아웃으로 렌더링할 때 ActualItemSlotsOverlay 의 droppable/X 버튼 위치와 정확히 겹치게 한다.
 */
export function toPlacedChampion(
  u: PlacedUnit,
  championCatalog: Map<string, RawChampion>,
  itemCatalog: Map<string, RawItem>,
): PlacedChampion | null {
  const championApiName = normalizeChampionId(u.championId);
  const champion = championCatalog.get(championApiName) ?? SPECIAL_CHAMPIONS[championApiName];
  if (!champion) return null;
  const itemSlots: Array<RawItem | null> = [null, null, null];
  const items: RawItem[] = [];
  for (let i = 0; i < 3; i++) {
    const id = u.items[i];
    if (!id) continue;
    const item = itemCatalog.get(id);
    if (!item) continue;
    itemSlots[i] = item;
    items.push(item);
  }
  return {
    champion,
    position: u.hex,
    starLevel: u.starLevel,
    items,
    itemSlots,
    voidItem: null,
    mfMode: null,
    permanentStacks: null,
    isDummy: false,
    isSummon: SUMMON_API_NAMES.has(championApiName),
    novaStrikeSelector: u.novaStrikeSelector,
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
    novaStrikeSelector: p.novaStrikeSelector,
  };
}
