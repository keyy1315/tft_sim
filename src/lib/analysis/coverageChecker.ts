import type { RawChampion, RawItem } from '@/types';
import type { ParsedMatch, ParsedParticipant } from '@/lib/riot';
import type { CoverageResult, UnsupportedReason, AnalysisConfidence } from '@/types/analysis';

/** 소환/특수 유닛 — 커버리지 체크에서 무시 */
function isSpecialUnit(characterId: string): boolean {
  const id = characterId.toLowerCase();
  return id.includes('summon')
    || id.includes('dummy')
    || id.includes('golem')
    || id.includes('tibbers')
    || id.includes('soldier')
    || id.includes('nashor')
    || id.includes('atakhan')
    || id.includes('pve_')
    || id.includes('armory')
    || id.includes('chest')
    || id.includes('core')
    || id.includes('fakeunit')
    || id.includes('emblemarmorykey')
    || id.includes('follower');
}

/** 무시할 아이템 (빈 슬롯 등) */
function isSpecialItem(itemId: string): boolean {
  return itemId === 'TFT_Item_EmptyBag'
    || itemId === 'TFT_Item_Unknown';
}

/**
 * Riot API 레거시 아이템 ID → 현재 데이터 ID 매핑.
 * 예: TFT5_Item_DeathbladeRadiant → TFT_Item_CorruptedDeathblade
 */
export function resolveItemId(riotItemId: string, availableItems: Map<string, boolean>): string {
  // 이미 매칭되면 그대로
  if (availableItems.has(riotItemId)) return riotItemId;

  // 레거시 Radiant 패턴: TFT{N}_Item_{BaseName}Radiant → TFT_Item_Corrupted{BaseName} 또는 TFT_Item_Radiant_{BaseName}
  const radiantMatch = riotItemId.match(/^TFT\d+_Item_(.+?)Radiant$/);
  if (radiantMatch) {
    const base = radiantMatch[1];
    const corrupted = `TFT_Item_Corrupted${base}`;
    if (availableItems.has(corrupted)) return corrupted;
    const radiant = `TFT_Item_Radiant_${base}`;
    if (availableItems.has(radiant)) return radiant;
  }

  // 레거시 일반 아이템: TFT{N}_Item_{Name} → TFT_Item_{Name}
  const legacyMatch = riotItemId.match(/^TFT\d+_Item_(.+)$/);
  if (legacyMatch) {
    const normalized = `TFT_Item_${legacyMatch[1]}`;
    if (availableItems.has(normalized)) return normalized;
  }

  return riotItemId;
}

/**
 * 매치 데이터가 시뮬레이션 가능한지 판정한다.
 *
 * 판정 순서:
 * 1. Set 17이 아니면 즉시 unsupported
 * 2. 모든 character_id가 champions.json에 존재하는지
 * 3. 모든 itemNames가 items.json��� 존재하는지
 */
export function checkCoverage(
  match: ParsedMatch,
  participants: ParsedParticipant[],
  availableChampions: RawChampion[],
  availableItems: RawItem[],
): CoverageResult {
  const isSet17 = match.setId === 'set17';

  if (!isSet17) {
    return {
      confidence: 'unsupported',
      reasons: ['not_set17'],
      supportedChampionIds: [],
      unsupportedChampionIds: [],
      supportedItemIds: [],
      unsupportedItemIds: [],
      isSet17: false,
    };
  }

  const championApiNames = new Set(availableChampions.map(c => c.apiName));
  const itemApiNameSet = new Map(availableItems.map(i => [i.apiName, true]));

  const allChampionIds = new Set<string>();
  const allItemIds = new Set<string>();

  for (const p of participants) {
    for (const c of p.champions) {
      if (isSpecialUnit(c.id)) continue;
      allChampionIds.add(c.id);
    }
    for (const c of p.champions) {
      if (isSpecialUnit(c.id)) continue;
      for (const item of c.items) {
        if (isSpecialItem(item)) continue;
        allItemIds.add(item);
      }
    }
  }

  const supportedChampionIds: string[] = [];
  const unsupportedChampionIds: string[] = [];
  for (const id of allChampionIds) {
    if (championApiNames.has(id)) {
      supportedChampionIds.push(id);
    } else {
      unsupportedChampionIds.push(id);
    }
  }

  const supportedItemIds: string[] = [];
  const unsupportedItemIds: string[] = [];
  for (const id of allItemIds) {
    const resolved = resolveItemId(id, itemApiNameSet);
    if (itemApiNameSet.has(resolved)) {
      supportedItemIds.push(resolved);
    } else {
      unsupportedItemIds.push(id);
    }
  }

  const reasons: UnsupportedReason[] = [];
  if (unsupportedChampionIds.length > 0) reasons.push('unsupported_champion');
  if (unsupportedItemIds.length > 0) reasons.push('unsupported_item');

  let confidence: AnalysisConfidence;
  // 챔피언 미지원이면 재현 불가, 아이템 미지원은 경고만 (빠진 아이템 무시하고 시뮬 가능)
  if (unsupportedChampionIds.length > 0) {
    confidence = 'unsupported';
  } else {
    confidence = 'estimated';
  }

  return {
    confidence,
    reasons,
    supportedChampionIds,
    unsupportedChampionIds,
    supportedItemIds,
    unsupportedItemIds,
    isSet17: true,
  };
}
