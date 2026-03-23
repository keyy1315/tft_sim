import { RawItem } from '@/types';

/** 필트오버 시너지 단계별 선택 가능 모듈 apiName */
export const PILTOVER_MODULE_TIERS: Record<number, string[]> = {
  2: [
    'TFT16_Item_Piltover_90CaliberNets',
    'TFT16_Item_Piltover_BlastShield',
    'TFT16_Item_Piltover_ElectricalOverload',
    'TFT16_Item_Piltover_EMP',
    'TFT16_Item_Piltover_OverclockedCapacitors',
    'TFT16_Item_Piltover_TunedOscillator',
    'TFT16_Item_Piltover_ContinuumCogs',
  ],
  4: [
    'TFT16_Item_Piltover_GigantificationRay',
    'TFT16_Item_Piltover_KineticBarrier',
    'TFT16_Item_Piltover_MagnetronCoil',
    'TFT16_Item_Piltover_MicroRockets',
    'TFT16_Item_Piltover_AccelerationGate',
  ],
  6: [
    'TFT16_Item_Piltover_Upgrade',
    'TFT16_Item_Piltover_ArmorNullifier',
    'TFT16_Item_Piltover_EchoEngine',
    'TFT16_Item_Piltover_MiningDrill',
    'TFT16_Item_Piltover_SuperiorLifeform',
  ],
};

/** 주어진 필트오버 시너지 활성화 수에 따라 선택 가능한 티어들 반환 */
export function getAvailablePiltoverTiers(piltoverCount: number): number[] {
  const tiers: number[] = [];
  if (piltoverCount >= 2) tiers.push(2);
  if (piltoverCount >= 4) tiers.push(4);
  if (piltoverCount >= 6) tiers.push(6);
  return tiers;
}

/** 주어진 티어에서 선택 가능한 모듈 apiName Set 반환 */
export function getAllowedModuleApiNames(piltoverCount: number): Set<string> {
  const tiers = getAvailablePiltoverTiers(piltoverCount);
  return new Set(tiers.flatMap(tier => PILTOVER_MODULE_TIERS[tier] ?? []));
}

/** 빌지워터 능력치(스탯) 아이템인지 판별 */
export function isBilgewaterStatItem(apiName: string): boolean {
  return apiName.includes('TFT16_Item_Bilgewater_') && /Tier\d/.test(apiName);
}

/** 빌지워터 명명 아이템인지 판별 (장비형 아이템) */
export function isBilgewaterNamedItem(apiName: string): boolean {
  return apiName.includes('TFT16_Item_Bilgewater_') && !/Tier\d/.test(apiName);
}

/** 빌지워터 능력치 구매 합산 */
export function sumBilgewaterEffects(
  purchases: Record<string, number>,
  allItems: RawItem[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [apiName, count] of Object.entries(purchases)) {
    const item = allItems.find(i => i.apiName === apiName);
    if (!item) continue;
    for (const [key, value] of Object.entries(item.effects)) {
      if (typeof value === 'number') {
        totals[key] = (totals[key] ?? 0) + value * count;
      }
    }
  }
  return totals;
}

// === 아이오니아 시너지 길 ===
export type IoniaPathType = 'blades' | 'enlightenment' | 'transcendence' | 'generosity' | 'spirit';

export const IONIA_PATH_NAMES: Record<IoniaPathType, string> = {
  blades: '검의 길',
  enlightenment: '깨달음의 길',
  transcendence: '초월의 길',
  generosity: '번영의 길',
  spirit: '영혼의 길',
};

/** 길별 간단 설명 (드롭다운 옵션용) */
export const IONIA_PATH_DESCRIPTIONS: Record<IoniaPathType, string> = {
  blades: '기본 공격 시 추가 물리 피해',
  enlightenment: 'AD+AP 증가, 레벨당 추가 AD+AP',
  transcendence: '체력 증가 + 마법 피해 증폭, 3성 강화',
  generosity: 'AD+AP 증가, 보유 골드당 추가 증가',
  spirit: 'AD+AP + 최대 체력 증가',
};

/** 길별 효과를 trait variables에서 읽어 상세 포맷 문자열 반환 */
export function getIoniaPathEffectText(
  pathType: IoniaPathType,
  variables: Record<string, unknown>,
): string {
  switch (pathType) {
    case 'blades': {
      const chance = (variables['BladesPercentChance'] ?? 30) as number;
      const flat = variables['BladesFlatDamage'] as number | null;
      let text = `기본 공격 시 ${chance}% 확률로 추가 물리 피해`;
      if (flat != null && flat > 0) text += ` (+${flat} 고정 피해)`;
      return text;
    }
    case 'enlightenment': {
      const adap = (variables['EnlightenmentADAP'] ?? 10) as number;
      const perLvl = variables['EnlightenmentADAPPerLevel'] as number | null;
      let text = `AD+AP +${adap}`;
      if (perLvl != null && perLvl > 0) text += `, 레벨당 AD+AP +${perLvl} 추가`;
      return text;
    }
    case 'transcendence': {
      const hp = (variables['TranscendenceHealth'] ?? 0.10) as number;
      const magic = (variables['TranscendenceMagicDamage'] ?? 0.20) as number;
      const starBuff = (variables['Transcendence3StarBuff'] ?? 1.3) as number;
      return `체력 +${Math.round(hp * 100)}%, 마법 피해 +${Math.round(magic * 100)}% 증폭. 3성 유닛 수치 ${Math.round(starBuff * 100)}% 증가`;
    }
    case 'generosity': {
      const adap = (variables['GenerosityADAP'] ?? 10) as number;
      const perGold = (variables['GenerosityIncreasePerGold'] ?? 0.02) as number;
      return `AD+AP +${adap}. 보유 골드당 수치 ${Math.round(perGold * 100)}% 추가 증가`;
    }
    case 'spirit': {
      const adap = (variables['SpiritADAP'] ?? 3) as number;
      const hp = (variables['SpiritHealth'] ?? 0.25) as number;
      return `AD+AP +${adap}, 최대 체력 +${Math.round(hp * 100)}%`;
    }
  }
}
