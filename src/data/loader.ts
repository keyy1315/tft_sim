import { RawChampion, RawItem, RawItemsData, RawTrait, RawTraitsData, RawAugment, RawAugmentsData, TeamPlannerEntry, TeamPlannerData } from '@/types';
import { registerItemImages } from '@/data/imageMap';

let championsCache: RawChampion[] | null = null;
let itemsCache: RawItem[] | null = null;
let traitsCache: RawTrait[] | null = null;
let augmentsCache: RawAugment[] | null = null;
let teamPlannerCache: TeamPlannerEntry[] | null = null;

export async function loadChampions(): Promise<RawChampion[]> {
  if (championsCache) return championsCache;
  const res = await fetch('/data/tft_set16_champions.json');
  const data: RawChampion[] = await res.json();
  // Filter out non-playable (summons, etc.) - keep only those with traits or cost > 0
  championsCache = data.filter(c =>
    c.traits.length > 0 && c.cost > 0 && !c.apiName.includes('Tibbers') &&
    !c.apiName.includes('Soldier') && !c.apiName.includes('Golem') &&
    !c.apiName.includes('Dummy') && !c.apiName.includes('Nashor') &&
    !c.apiName.includes('Atakhan')
  );
  return championsCache;
}

export async function loadAllChampions(): Promise<RawChampion[]> {
  const res = await fetch('/data/tft_set16_champions.json');
  return res.json();
}

export async function loadItems(): Promise<RawItem[]> {
  if (itemsCache) return itemsCache;
  const res = await fetch('/data/tft_set16_items.json');
  const data: RawItemsData = await res.json();
  const DISABLED_ITEMS = new Set([
    'TFT_Item_Artifact_MirroredPersona',
    'TFT_Item_Artifact_LesserMirroredPersona',
  ]);
  itemsCache = data.items.filter(i => !DISABLED_ITEMS.has(i.apiName));
  registerItemImages(itemsCache);
  return itemsCache;
}

export async function loadTraits(): Promise<RawTrait[]> {
  if (traitsCache) return traitsCache;
  const res = await fetch('/data/tft_set16_traits.json');
  const data: RawTraitsData = await res.json();
  traitsCache = data.traits;
  return traitsCache;
}

export async function loadAugments(): Promise<RawAugment[]> {
  if (augmentsCache) return augmentsCache;
  const res = await fetch('/data/tft_set16_augments.json');
  const data: RawAugmentsData = await res.json();
  augmentsCache = data.augments;
  return augmentsCache;
}

export async function loadTeamPlannerMapping(): Promise<TeamPlannerEntry[]> {
  if (teamPlannerCache) return teamPlannerCache;
  const res = await fetch('/data/tft_set16_teamplanner.json');
  const data: TeamPlannerData = await res.json();
  teamPlannerCache = data.mapping;
  return teamPlannerCache;
}
