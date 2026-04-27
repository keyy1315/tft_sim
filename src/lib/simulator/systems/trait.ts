import { RawChampion, RawItem, RawTrait, ActiveTrait, TraitEffect, PlacedChampion, MF_MODE_CONFIG } from '@/types';
import type { StargazerConstellationId } from '@/lib/actualData/types';
import { CONSTELLATION_TO_TRAIT_API } from '@/lib/actualData/stargazerMapping';

/** MF "특성 선택" 트레이트를 선택된 모드의 실제 트레이트로 교체 */
function resolveMfTraits(champion: RawChampion, mfMode?: PlacedChampion['mfMode']): string[] {
  if (champion.apiName !== 'TFT17_MissFortune' || !mfMode) return champion.traits;
  const modeTrait = MF_MODE_CONFIG[mfMode];
  // "특성 선택" → 실제 트레이트 이름으로 교체 (trait name은 resolveTraits에서 name 매칭)
  return champion.traits.map(t => t === '특성 선택' ? modeTrait.name : t);
}

/** 모드 apiName → 트레이트 이름 매핑 (trait JSON의 name 기준) */
const MF_TRAIT_API_TO_NAME: Record<string, string> = {};

/**
 * Emblem 아이템 → 부여 trait 한글명 매핑 (Set 17 전체 19종).
 * 인벤토리 슬롯에 emblem 아이템이 들어가면 해당 unit 의 trait 카운트에 +1
 * 되고 unit 자체도 그 trait 보유 unit 으로 처리 (효과 받음).
 * 새 emblem 추가 시 여기에 등록.
 */
const EMBLEM_ITEM_TO_TRAIT_NAME: Record<string, string> = {
  TFT17_Item_AnimaSquadEmblemItem: '동물특공대',
  TFT17_Item_ASTraitEmblemItem: '도전자',
  TFT17_Item_AssassinTraitEmblemItem: '불한당',
  TFT17_Item_AstronautEmblemItem: '정령족',
  TFT17_Item_DarkStarEmblemItem: '암흑의 별',
  TFT17_Item_DRXEmblemItem: 'N.O.V.A.',
  TFT17_Item_FavoredEmblemItem: '중재자',
  TFT17_Item_FlexTraitEmblemItem: '여행자',
  TFT17_Item_HPTankEmblemItem: '싸움꾼',
  TFT17_Item_MeleeTraitEmblemItem: '습격자',
  TFT17_Item_PrimordianEmblemItem: '태고족',
  TFT17_Item_PsyOpsEmblemItem: '초능력',
  TFT17_Item_PulsefireEmblemItem: '시간 균열자',
  TFT17_Item_RangedTraitEmblemItem: '저격수',
  TFT17_Item_ResistTankEmblemItem: '요새',
  TFT17_Item_ShieldTankEmblemItem: '선봉대',
  TFT17_Item_SpaceGrooveEmblemItem: '우주 그루브',
  TFT17_Item_StargazerEmblemItem: '별돌보미',
  TFT17_Item_SummonTraitEmblemItem: '길잡이',
};

function emblemTraitFromItems(items: RawItem[] | undefined): string[] {
  if (!items || items.length === 0) return [];
  const out: string[] = [];
  for (const it of items) {
    const t = EMBLEM_ITEM_TO_TRAIT_NAME[it.apiName];
    if (t) out.push(t);
  }
  return out;
}

/** Public helper: emblem 아이템 배열로부터 부여 trait 한글명 목록 추출. */
export function getEmblemTraitNames(items: RawItem[] | undefined): string[] {
  return emblemTraitFromItems(items);
}

export interface ResolveTraitsOptions {
  /** 별돌보미 변종 — game-level state. 지정 시 base 대신 specific 변종 trait 활성. */
  stargazerConstellation?: StargazerConstellationId;
}

export interface ResolveTraitsInput {
  champion: RawChampion;
  mfMode?: PlacedChampion['mfMode'];
  /** Champion 의 inventory items. emblem 검출용. */
  items?: RawItem[];
}

export function resolveTraits(
  champions: ResolveTraitsInput[],
  allTraits: RawTrait[],
  options: ResolveTraitsOptions = {},
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

  // Count traits from placed champions (with MF mode substitution).
  // 기존 동작 보존 — unique champion 검사 없음 (별도 PR 에서 처리).
  const traitCounts = new Map<string, number>();
  for (const { champion, mfMode } of champions) {
    const traits = resolveMfTraits(champion, mfMode);
    for (const traitName of traits) {
      traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
    }
  }
  // Emblem 카운트는 unit 단위로 누적 — 같은 챔프에 emblem 여러 개 가능.
  for (const { items } of champions) {
    for (const traitName of emblemTraitFromItems(items)) {
      traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
    }
  }

  const stargazerVariantApi = options.stargazerConstellation
    ? CONSTELLATION_TO_TRAIT_API[options.stargazerConstellation]
    : null;

  const activeTraits: ActiveTrait[] = [];
  for (const [traitName, count] of traitCounts) {
    let trait: RawTrait | undefined;

    if (traitName === '별돌보미') {
      // 별돌보미는 8개 trait (변종 7 + base) 모두 같은 name. constellation 에
      // 따라 specific 변종 trait 우선, 없으면 base.
      if (stargazerVariantApi) {
        trait = allTraits.find(t => t.apiName === stargazerVariantApi);
      }
      if (!trait) {
        trait = allTraits.find(t => t.apiName === 'TFT17_Stargazer');
      }
    } else {
      trait = allTraits.find(t => t.name === traitName);
    }

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
