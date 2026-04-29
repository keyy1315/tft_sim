import { RawChampion, RawItem, RawItemsData, RawTrait, RawTraitsData, RawAugment, RawAugmentsData, TeamPlannerEntry, TeamPlannerData } from '@/types';
import { registerItemImages } from '@/data/imageMap';
import { DEFAULT_SET, type SetId } from '@/data/setConfig';
import { setScalingData } from '@/lib/simulator/systems/ability';
import type { ScalingData } from '@/lib/simulator/systems/ability';
import { isDisabledAugment, isDisabledItem } from '@/data/disabledContent';

const championsCache = new Map<string, RawChampion[]>();
const itemsCache = new Map<string, RawItem[]>();
const traitsCache = new Map<string, RawTrait[]>();
const augmentsCache = new Map<string, RawAugment[]>();
const teamPlannerCache = new Map<string, TeamPlannerEntry[]>();

/** Set 16 data moved to /data/set16/ subdirectory */
function dataPath(setId: SetId, filename: string): string {
  if (setId === 'set16') return `/data/set16/${filename}`;
  return `/data/${filename}`;
}

export async function loadChampions(setId: SetId = DEFAULT_SET): Promise<RawChampion[]> {
  if (championsCache.has(setId)) return championsCache.get(setId)!;
  const res = await fetch(dataPath(setId, `tft_${setId}_champions.json`));
  if (!res.ok) { championsCache.set(setId, []); return []; }
  const data = await res.json();
  const raw = Array.isArray(data) ? data : data.champions ?? [];
  const defaultStats = { armor: 0, attackSpeed: 0, critChance: 0.25, critMultiplier: 1.4, damage: 0, hp: 0, initialMana: 0, magicResist: 0, mana: 0, range: 1 };
  const list: RawChampion[] = raw.map((c: RawChampion) => ({
    ...c,
    role: c.role ?? null,
    stats: { ...defaultStats, ...c.stats },
  }));
  const filtered = list.filter(c =>
    c.traits.length > 0 && c.cost > 0 && !c.apiName.includes('Tibbers') &&
    !c.apiName.includes('Soldier') && !c.apiName.includes('Golem') &&
    !c.apiName.includes('Dummy') && !c.apiName.includes('Nashor') &&
    !c.apiName.includes('Atakhan')
  );
  championsCache.set(setId, filtered);
  return filtered;
}

export async function loadAllChampions(setId: SetId = DEFAULT_SET): Promise<RawChampion[]> {
  const res = await fetch(dataPath(setId, `tft_${setId}_champions.json`));
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.champions ?? [];
}

export async function loadItems(setId: SetId = DEFAULT_SET): Promise<RawItem[]> {
  if (itemsCache.has(setId)) return itemsCache.get(setId)!;

  // 공용 아이템 (기본 재료 + 조합 + 찬란한) + 세트별 아이템 병합
  const [commonRes, setRes] = await Promise.all([
    fetch('/data/common/tft_common_items.json'),
    fetch(dataPath(setId, `tft_${setId}_items.json`)),
  ]);

  const commonItems: RawItem[] = commonRes.ok
    ? (await commonRes.json() as RawItemsData).items
    : [];
  const setItems: RawItem[] = setRes.ok
    ? (await setRes.json() as RawItemsData).items
    : [];

  // 거울 persona 는 set 17 미구현 + 신상 판도라 좌석 등은 disabledContent.ts 에서 관리.
  const LEGACY_DISABLED_ITEMS = new Set([
    'TFT_Item_Artifact_MirroredPersona',
    'TFT_Item_Artifact_LesserMirroredPersona',
  ]);

  // 공용 먼저, 세트별 추가 (중복 방지)
  const seen = new Set<string>();
  const merged: RawItem[] = [];
  for (const item of [...commonItems, ...setItems]) {
    if (seen.has(item.apiName)) continue;
    if (LEGACY_DISABLED_ITEMS.has(item.apiName)) continue;
    if (isDisabledItem(item.apiName)) continue;
    seen.add(item.apiName);
    merged.push(item);
  }

  itemsCache.set(setId, merged);
  registerItemImages(merged);
  return merged;
}

export async function loadTraits(setId: SetId = DEFAULT_SET): Promise<RawTrait[]> {
  if (traitsCache.has(setId)) return traitsCache.get(setId)!;
  const res = await fetch(dataPath(setId, `tft_${setId}_traits.json`));
  if (!res.ok) { traitsCache.set(setId, []); return []; }
  const data: RawTraitsData = await res.json();
  traitsCache.set(setId, data.traits);
  return data.traits;
}

export async function loadAugments(setId: SetId = DEFAULT_SET): Promise<RawAugment[]> {
  if (augmentsCache.has(setId)) return augmentsCache.get(setId)!;
  const res = await fetch(dataPath(setId, `tft_${setId}_augments.json`));
  if (!res.ok) { augmentsCache.set(setId, []); return []; }
  const data: RawAugmentsData = await res.json();
  // 두 단계 필터:
  //   1) augment.disable=true 는 시즌 미사용 → 제외 (raw data 의 1차 분류)
  //   2) DISABLED_AUGMENT_API_NAMES — apiName 강제 차단 (data 갱신 후에도 보호)
  const filtered = data.augments.filter(a =>
    a.disable !== true && !isDisabledAugment(a.apiName)
  );
  augmentsCache.set(setId, filtered);
  return filtered;
}

export async function loadTeamPlannerMapping(setId: SetId = DEFAULT_SET): Promise<TeamPlannerEntry[]> {
  if (teamPlannerCache.has(setId)) return teamPlannerCache.get(setId)!;
  const res = await fetch(dataPath(setId, `tft_${setId}_teamplanner.json`));
  if (!res.ok) { teamPlannerCache.set(setId, []); return []; }
  const data: TeamPlannerData = await res.json();
  teamPlannerCache.set(setId, data.mapping);
  return data.mapping;
}

const scalingCache = new Map<string, boolean>();

export async function loadScalingData(setId: SetId = DEFAULT_SET): Promise<void> {
  if (scalingCache.has(setId)) return;
  const res = await fetch(dataPath(setId, `tft_${setId}_scaling.json`));
  if (!res.ok) { scalingCache.set(setId, true); return; }
  const data: ScalingData = await res.json();
  setScalingData(data);
  scalingCache.set(setId, true);
}
