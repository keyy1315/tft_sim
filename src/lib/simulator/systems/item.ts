import { RawItem, ItemEffect, ItemCategory, EquipValidation, PlacedChampion, ActiveTrait } from '@/types';
import { ITEM_EFFECT_KEYS } from '@/lib/simulator/models/constants';

/** 비활성(disable) 아이템 — UI에서 숨김 처리 */
const DISABLED_ITEMS = new Set([
  // 서포트/오라 아이템 (시뮬레이터 미지원)
  'TFT_Item_Shroud',           // 침묵의 장막
  'TFT_Item_BansheesVeil',     // 밴시의 장막
  'TFT_Item_Zephyr',           // 서풍
  'TFT_Item_RadiantVirtue',    // 순교자의 미덕
  'TFT_Item_SupportKnightsVow',// 기사의 맹세 (서포트 버전)
  'TFT_Item_EternalFlame',     // 영원한 불꽃
  'TFT_Item_LocketOfTheIronSolari', // 강철의 솔라리 펜던트
  'TFT_Item_Spite',            // 앙심
  'TFT_Item_Moonstone',        // 월석 재생기
  'TFT_Item_AegisOfTheLegion', // 군단의 방패
  'TFT_Item_Chalice',          // 힘의 성배
  // 유물 (미지원)
  'TFT_Item_Artifact_LesserMirroredPersona', // 하급 거울의 환영
  'TFT_Item_Artifact_ShadowPuppet',          // 그림자 꼭두각시
  'TFT_Item_Artifact_WitheringRelic',         // 해진 유물
  'TFT_Item_Artifact_ForbiddenIdol',          // 금지된 우상
  'TFT_Item_Artifact_MendingEchoes',          // 회복의 메아리
  'TFT_Item_Artifact_CursedBlade',            // 저주받은 칼날
  'TFT_Item_Artifact_CursedVampiricScepter',  // 타락한 흡혈의 낫
  // 기사의 맹세 (빈 effects 버전)
  'TFT_Item_KnightsVow',
  // 서포트 아이템 (조합 아이템 아님)
  'TFT_Item_SeraphsEmbrace',   // 푸른 파수꾼 (서포트 버전)
  'TFT_Item_CrestOfCinders',   // 잉걸불 문장
]);

/** 아이템이 비활성 상태인지 확인 */
export function isDisabledItem(item: RawItem): boolean {
  return DISABLED_ITEMS.has(item.apiName);
}

export function resolveItemEffect(item: RawItem): ItemEffect {
  const result: ItemEffect = {};
  for (const [key, value] of Object.entries(item.effects)) {
    // BonusArmorMR → 방어력 + 마법 저항력 동시 적용
    if (key === 'BonusArmorMR' && typeof value === 'number') {
      result.armor = (result.armor || 0) + value;
      result.magicResist = (result.magicResist || 0) + value;
      continue;
    }
    const mapped = ITEM_EFFECT_KEYS[key];
    if (mapped && typeof value === 'number') {
      (result as Record<string, number>)[mapped] = value;
    }
  }
  return result;
}

export function isBaseComponent(item: RawItem): boolean {
  return item.composition.length === 0 && !item.apiName.includes('TFT16_');
}

export function isCombinedItem(item: RawItem): boolean {
  return item.composition.length === 2;
}

export function isArtifact(item: RawItem): boolean {
  return item.apiName.includes('_Artifact_') || item.icon.includes('Artifact');
}

/** 유물로 분류해야 하지만 apiName에 Artifact가 없는 아이템들 */
const FORCE_ARTIFACT = new Set([
  'TFT9_Item_CrownOfDemacia',                      // 데마시아의 왕관
  'TFT7_Item_ShimmerscaleMogulsMail_Revival',       // 거물의 갑옷
  'TFT7_Item_ShimmerscaleGamblersBlade_Revival',    // 도박꾼의 칼날
  'TFT4_Item_OrnnInfinityForce',                    // 무한한 삼위일체
  'TFT9_Item_OrnnHullbreaker',                      // 선체분쇄자
  'TFT9_Item_OrnnHorizonFocus',                     // 저격수의 집중
  'TFT4_Item_OrnnDeathsDefiance',                   // 죽음의 저항
  'TFT4_Item_OrnnZhonyasParadox',                   // 존야의 역설
  'TFT4_Item_OrnnTheCollector',                     // 황금 징수의 총
  'TFT16_Item_Bilgewater_FreebootersFrock',         // 따개비 장갑
]);

export function getItemCategory(item: RawItem): ItemCategory {
  if (isArtifact(item) || FORCE_ARTIFACT.has(item.apiName)) return 'artifact';
  if (item.apiName.includes('EmblemItem')) return 'emblem';
  if (item.apiName.includes('Corrupted') || item.apiName.includes('Radiant_')) return 'radiant';
  if (item.apiName.includes('Consumable_Void')) return 'void';
  if (item.apiName.includes('TheDarkin')) return 'darkin';
  if (isBaseComponent(item)) return 'component';
  if (isCombinedItem(item)) return 'combined';
  if (item.apiName.includes('Piltover')) return 'piltover';
  if (item.apiName.includes('Bilgewater')) return 'bilgewater';
  return 'special';
}

/** 공허 돌연변이 아이템 여부 */
export function isVoidMutation(item: RawItem): boolean {
  return getItemCategory(item) === 'void';
}

/** 챔피언에 아이템 장착 가능 여부 검증 */
export function canEquipItem(
  item: RawItem,
  champion: PlacedChampion,
  activeTraits: ActiveTrait[],
): EquipValidation {
  const category = getItemCategory(item);

  // 특수 아이템 → 장착 불가
  if (category === 'special') {
    return { canEquip: false, reason: '특수 아이템은 장착할 수 없습니다' };
  }

  // 필트오버 모듈 → 챔피언 장착 불가 (팀 모듈 슬롯 전용)
  if (category === 'piltover') {
    return { canEquip: false, reason: '필트오버 모듈은 팀 모듈 슬롯에 배치해야 합니다' };
  }

  // 공허 돌연변이 → 별도 슬롯, 아이템 칸 미차지
  if (category === 'void') {
    const voidTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Void');
    if (!voidTrait || !voidTrait.activeEffect) {
      return { canEquip: false, reason: '공허 시너지가 활성화되어야 합니다' };
    }
    if (!champion.champion.traits.includes('공허')) {
      return { canEquip: false, reason: '공허 챔피언만 돌연변이를 장착할 수 있습니다' };
    }
    if (champion.voidItem) {
      return { canEquip: false, reason: '돌연변이는 챔피언당 1개만 장착 가능합니다' };
    }
    return { canEquip: true };
  }

  // 다르킨 → 챔피언당 1개만 장착
  if (category === 'darkin') {
    const hasDarkin = champion.items.some(i => getItemCategory(i) === 'darkin');
    if (hasDarkin) {
      return { canEquip: false, reason: '다르킨 아이템은 챔피언당 1개만 장착 가능합니다' };
    }
  }

  // 슬롯 초과 체크
  if (champion.items.length >= 3) {
    return { canEquip: false, reason: '아이템 슬롯이 가득 찼습니다 (3/3)' };
  }

  // 유물 중복 체크
  if (category === 'artifact') {
    const hasArtifact = champion.items.some(i => getItemCategory(i) === 'artifact');
    if (hasArtifact) {
      return { canEquip: false, reason: '유물은 챔피언당 1개만 장착 가능합니다' };
    }
  }

  // 찬란 → 챔피언당 1개만
  if (category === 'radiant') {
    const hasRadiant = champion.items.some(i => getItemCategory(i) === 'radiant');
    if (hasRadiant) {
      return { canEquip: false, reason: '찬란 아이템은 챔피언당 1개만 장착 가능합니다' };
    }
  }

  // 빌지워터 아이템 → 시너지 활성 확인
  if (category === 'bilgewater') {
    if (Object.keys(item.effects).length === 0) {
      return { canEquip: false, reason: '비전투 아이템은 장착할 수 없습니다' };
    }
    const bgTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Bilgewater');
    if (!bgTrait || !bgTrait.activeEffect) {
      return { canEquip: false, reason: '빌지워터 시너지가 활성화되어야 합니다 (최소 3)' };
    }
  }

  return { canEquip: true };
}

/** 필트오버 시너지 단계별 모듈 슬롯 수 */
export function getPiltoverModuleLimit(activeTraits: ActiveTrait[]): number {
  const piltTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Piltover');
  if (!piltTrait || !piltTrait.activeEffect) return 0;

  const count = piltTrait.count;
  if (count >= 6) return 3;
  if (count >= 4) return 2;
  if (count >= 2) return 1;
  return 0;
}

/** 필트오버 모듈 추가 가능 여부 검증 */
export function canAddPiltoverModule(
  item: RawItem,
  currentModules: RawItem[],
  activeTraits: ActiveTrait[],
): EquipValidation {
  if (getItemCategory(item) !== 'piltover') {
    return { canEquip: false, reason: '필트오버 모듈이 아닙니다' };
  }

  const limit = getPiltoverModuleLimit(activeTraits);
  if (limit === 0) {
    return { canEquip: false, reason: '필트오버 시너지가 활성화되어야 합니다 (최소 2)' };
  }

  if (currentModules.length >= limit) {
    return { canEquip: false, reason: `필트오버 모듈 슬롯이 가득 찼습니다 (${currentModules.length}/${limit})` };
  }

  return { canEquip: true };
}
