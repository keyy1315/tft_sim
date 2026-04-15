import type { AbilityConfig } from '@/lib/simulator/systems/ability';

export interface CarryScalingInput {
  label: string;
  unit: string;
  max: number;
  effectPerStack: string;
}

export interface CarryAbilityData {
  name: string;
  desc: string;
  mana: string;
  damage: [number, number, number];
  damageType: 'physical' | 'magic';
  /** 처치당 영구 추가 피해 [1성, 2성, 3성] */
  bonusPerKill?: [number, number, number];
}

export interface CarryAugmentConfig {
  augmentApiName: string;
  targetChampionApiName: string;
  abilityOverride: AbilityConfig;
  rangeOverride?: number;
  damageTypeOverride?: 'physical' | 'magic';
  scalingInput?: CarryScalingInput;
  abilityData?: CarryAbilityData;
}

export const CARRY_AUGMENTS: CarryAugmentConfig[] = [
  {
    augmentApiName: 'TFT17_Augment_NasusCarry',
    targetChampionApiName: 'TFT17_Nasus',
    abilityOverride: { pattern: 'single' },
    damageTypeOverride: 'physical',
    scalingInput: { label: '처치 수', unit: '회', max: 999, effectPerStack: '피해량 +10' },
    abilityData: {
      name: '꽁!',
      desc: '대상에게 물리 피해를 입힙니다. 이 스킬로 적을 처치하면 스킬 피해량이 영구적으로 증가합니다.',
      mana: '60/120',
      damage: [280, 420, 670],
      damageType: 'physical',
      bonusPerKill: [10, 13, 20],
    },
  },
  {
    augmentApiName: 'TFT17_Augment_AatroxCarry',
    targetChampionApiName: 'TFT17_Aatrox',
    abilityOverride: { pattern: 'cone', radius: 1 },
    damageTypeOverride: 'physical',
    abilityData: {
      name: '별빛 연계',
      desc: '세 가지 스킬을 번갈아 사용합니다.\n타격: 물리 피해\n휩쓸기: 원뿔 범위 물리 피해 + 방어력 감소\n찍기: 반경 1칸 피해 + 공중 띄움 (단독 적중 시 250%)',
      mana: '30/90',
      damage: [140, 210, 315],
      damageType: 'physical',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_PoppyCarry',
    targetChampionApiName: 'TFT17_Poppy',
    abilityOverride: { pattern: 'multi', maxTargets: 3 },
    rangeOverride: 4,
    damageTypeOverride: 'physical',
    abilityData: {
      name: '정령단 속도',
      desc: '원거리 공격력 마법사로 변하며 대상에게 고속 정령을 발사합니다.',
      mana: '0/40',
      damage: [100, 150, 240],
      damageType: 'physical',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_LeonaCarry',
    targetChampionApiName: 'TFT17_Leona',
    abilityOverride: { pattern: 'line', dash: 'to_target', stun: 1.0 },
    damageTypeOverride: 'physical',
  },
  {
    augmentApiName: 'TFT17_Augment_IvernMinionCarry',
    targetChampionApiName: 'TFT17_IvernMinion',
    abilityOverride: { pattern: 'aoe_circle', radius: 3, dash: 'to_farthest' },
    abilityData: {
      name: '빅뱅',
      desc: '주문력 전사로 변하며 주변 칸으로 도약하여 넓은 반경에 마법 피해를 입힙니다.',
      mana: '40/100',
      damage: [200, 300, 480],
      damageType: 'magic',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_JaxCarry',
    targetChampionApiName: 'TFT17_Jax',
    abilityOverride: { pattern: 'self_buff', selfBuff: { attackSpeed: 0.3, duration: 999 } },
    abilityData: {
      name: '저 별을 향해',
      desc: '주문력 전사로 변하며 기본 공격 시 추가 마법 피해를 입히고 스킬 사용 시 중첩되는 공격 속도를 얻습니다.',
      mana: '20/60',
      damage: [60, 90, 140],
      damageType: 'magic',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_PykeCarry',
    targetChampionApiName: 'TFT17_Pyke',
    abilityOverride: { pattern: 'single', dash: 'to_target' },
    damageTypeOverride: 'physical',
    scalingInput: { label: '처치 수', unit: '회', max: 999, effectPerStack: '골드 +1' },
    abilityData: {
      name: '청부 살인마',
      desc: '공격력 전사로 변하고, 아군 처치 관여 시 골드를 생성하며, 적 처치 시 초기화되는 스킬을 얻습니다.',
      mana: '0/50',
      damage: [200, 300, 480],
      damageType: 'physical',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_MordekaiserCarry',
    targetChampionApiName: 'TFT17_Mordekaiser',
    abilityOverride: { pattern: 'aoe_circle', radius: 2 },
  },
  {
    augmentApiName: 'TFT17_Augment_GragasCarry',
    targetChampionApiName: 'TFT17_Gragas',
    abilityOverride: { pattern: 'aoe_circle', radius: 3 },
  },
  {
    augmentApiName: 'TFT17_Augment_InvaderZed',
    targetChampionApiName: 'TFT17_Zed',
    abilityOverride: { pattern: 'self_buff' },
    damageTypeOverride: 'physical',
    abilityData: {
      name: '침략자 제드',
      desc: '5단계 공격력 전사로 변하며 자신의 분신을 생성합니다. 스테이지 4-2에 획득 가능.',
      mana: '50/100',
      damage: [300, 450, 720],
      damageType: 'physical',
    },
  },
];

/** 챔피언에 적용되는 캐리 증강 찾기 */
export function findCarryAugment(
  championApiName: string,
  augmentApiNames: string[],
): CarryAugmentConfig | null {
  return CARRY_AUGMENTS.find(ca =>
    ca.targetChampionApiName === championApiName &&
    augmentApiNames.includes(ca.augmentApiName)
  ) ?? null;
}
