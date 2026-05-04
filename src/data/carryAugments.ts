import type { AbilityConfig } from '@/lib/simulator/systems/ability';
import type { UnitRole } from '@/types';

export interface CarryScalingInput {
  label: string;
  unit: string;
  max: number;
  effectPerStack: string;
}

/**
 * Hero Augment 활성 시 챔프의 stat override.
 *
 * 사용자가 게임 내에서 augment 활성 vs 비활성 stat 차이를 측정 후 채워넣는 슬롯.
 * undefined 필드는 기존 stat 유지 (안전 default).
 *
 * `applyHeroCarryTransforms` 가 augment 활성 시 적용 (중첩 가능 — 다른 buff 와 합산).
 */
export interface HeroAugmentStatOverrides {
  hp?: number;
  armor?: number;
  magicResist?: number;
  damage?: number;
  attackSpeed?: number;
  range?: number;
  mana?: number;
  initialMana?: number;
  /** 변환 후 역할군. 마나 재생 / 공격 속도 / 타게팅 룰을 따라감. */
  role?: UnitRole;
}

/**
 * Hero Augment ability data.
 *
 * 모든 변수는 [1성, 2성, 3성] tuple. `damage` 는 cast primary damage.
 * 추가 변수는 augment 별 메커니즘 (shield / hex reduction / self-damage 등) 에 사용.
 */
export interface CarryAbilityData {
  name: string;
  desc: string;
  mana: string;
  /** Cast primary damage [1성, 2성, 3성]. 일부 augment 는 hp/armor 스케일도 포함 → 별도 필드. */
  damage: [number, number, number];
  damageType: 'physical' | 'magic';
  /** 처치당 영구 추가 피해 [1성, 2성, 3성] */
  bonusPerKill?: [number, number, number];

  // ── augment 전용 변수 (옵셔널) ──

  /** Cast 시 자기 보호막 [1성, 2성, 3성] (Mordekaiser/Leona 등). */
  shield?: [number, number, number];
  /** 보호막 지속시간 (초). */
  shieldDuration?: number;
  /** 패시브 onAttack 추가 damage [1성, 2성, 3성] (Jax/꼬마정령 등). */
  onAttackBonus?: [number, number, number];
  /** 패시브 오라 damage [1성, 2성, 3성] (Mordekaiser). */
  passiveDamage?: [number, number, number];
  /** 사용 시 강화된 오라 damage [1성, 2성, 3성] (Mordekaiser cast). */
  empoweredAuraDamage?: [number, number, number];
  /** 강화 오라 지속시간 (초). */
  empoweredDuration?: number;
  /** 추가 대상 damage [1성, 2성, 3성] (Pyke X-shape, Leona line secondary). */
  secondaryDamage?: [number, number, number];
  /** 자기 maxHp 비율 self-damage (Gragas healthCost). */
  healthCost?: number;
  /** Self-damage HP floor (자기 스킬로 죽지 않음 보장). */
  selfDamageHpFloor?: number;
  /** 헥스 거리당 damage 감소 비율 (Gragas hexReduction, 꼬마정령). */
  hexReduction?: number;
  /** maxHp 비율 base damage (Gragas: 0.10 = 최대체력 10%). */
  baseDamageHpFrac?: number;
  /** 탱커 상대 추가 damage 배율 (Gragas/Pyke: 0.60 = +60%). */
  tankBonusMultiplier?: number;
  /** Cast 시 영구 AS 가산 [1성, 2성, 3성] (Jax). */
  asGain?: [number, number, number];
  /** Stun/공중 띄움 지속시간 [1성, 2성, 3성] (Leona / 꼬마정령). */
  stunDuration?: [number, number, number];
  /** 처치 시 재시전 damage 배율 (Pyke onKill: 0.70 = 70% damage 재시전). */
  onKillRecastMultiplier?: number;
  /** 단일 적중 시 damage 배율 (Aatrox 찍기: 2.50). */
  singleTargetMultiplier?: number;
  /** Armor 비율 추가 damage (Poppy: 1.00 = 100% armor 가산). */
  armorScale?: number;
  /** 정령족 잠재력 (미프) 스케일 — 챔프별 onAttack 또는 cast damage 에 가산. */
  spiritEffectPerStack?: number;
  /** 처치 시 가장 가까운 적에게 잔여 damage 튕김 (Poppy). */
  spiritBounceOnKill?: boolean;
  /** Aatrox 휩쓸기 armor 감소 (AP 스케일). */
  armorReduction?: number;
  /** Aatrox 찍기 damage [1성, 2성, 3성] (cycle counter % 3 == 2). PR7-C 추가. */
  slamDamage?: [number, number, number];
  /** Aatrox 찍기 stun 지속시간 (공중 띄움). PR7-C 추가. */
  slamStunDuration?: number;
  /** Aatrox N.O.V.A. 타격 damage [1성, 2성, 3성] (5-NOVA 시너지 + 타격 선택기 활성 시). */
  novaDamage?: [number, number, number];
  /** Aatrox 3-skill cycle 패턴 라벨 — 후속 PR 에서 cycle counter 분기. */
  skillCycleLabels?: readonly string[];
}

export interface CarryAugmentConfig {
  augmentApiName: string;
  targetChampionApiName: string;
  abilityOverride: AbilityConfig;
  rangeOverride?: number;
  damageTypeOverride?: 'physical' | 'magic';
  scalingInput?: CarryScalingInput;
  abilityData?: CarryAbilityData;
  /** Augment 활성 시 stat 변경 (사용자 인게임 데이터 기반 채움). */
  statOverrides?: HeroAugmentStatOverrides;
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
      desc: '세 가지 스킬을 번갈아 사용합니다.\n타격: 물리 피해\n휩쓸기: 원뿔 범위 물리 피해 + 방어력 감소\n찍기: 반경 1칸 피해 + 공중 띄움 (단독 적중 시 250%)\nN.O.V.A. 활성 시: 전장 가르고 모든 적 공중 띄움 + 추가 타격',
      mana: '30/90',
      damage: [140, 210, 315], // 타격 (cycle 0)
      secondaryDamage: [100, 150, 225], // 휩쓸기 (cycle 1)
      slamDamage: [160, 240, 360], // 찍기 (cycle 2) — PR7-C 추가
      slamStunDuration: 1.0, // 찍기 공중 띄움 (knockup → stun) — PR7-C 추가
      armorReduction: 10, // 휩쓸기 armor 감소 (AP 스케일)
      novaDamage: [120, 180, 270], // N.O.V.A. 타격
      singleTargetMultiplier: 2.5, // 찍기 단독 적중 시 250%
      damageType: 'physical',
      skillCycleLabels: ['타격', '휩쓸기', '찍기'] as const,
    },
  },
  {
    augmentApiName: 'TFT17_Augment_PoppyCarry',
    targetChampionApiName: 'TFT17_Poppy',
    // 정령단 속도: ranged projectile (rangeOverride=4). dash 없음 — 사거리 증가가 핵심.
    abilityOverride: { pattern: 'single' },
    rangeOverride: 4,
    damageTypeOverride: 'physical',
    abilityData: {
      name: '정령단 속도',
      desc: '원거리 공격력 마법사로 변환 (사거리 +N칸). 거대한 정령을 발사. 적중한 적에게 AD + 100% 방어력 + 미프 정령족 잠재력 가산. 처치 시 가장 가까운 적에게 잔여 damage 튕김.',
      mana: '30/100',
      damage: [340, 510, 850],
      armorScale: 1.0, // 100% armor 가산
      spiritEffectPerStack: 0.15,
      spiritBounceOnKill: true,
      damageType: 'physical',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_LeonaCarry',
    targetChampionApiName: 'TFT17_Leona',
    abilityOverride: { pattern: 'line', maxTargets: 4, dash: 'to_target', stun: 1.0, firstHitOnlyStun: true },
    damageTypeOverride: 'physical',
    abilityData: {
      name: '방패 여전사',
      desc: '2초 동안 보호막. 최대 3칸 돌진해 적이 가장 많은 일직선 타격 (탱커 우선). 첫 적중: AD + 28% 최대체력 + 기절. 추가 대상: AD damage. (17.2b 너프)',
      mana: '50/110',
      damage: [90, 135, 225], // 17.2b: 110/165/250 → 90/135/225
      shield: [200, 240, 280],
      shieldDuration: 2,
      baseDamageHpFrac: 0.28, // primary damage 에 maxHp 28% 가산
      stunDuration: [1.0, 1.25, 1.5],
      secondaryDamage: [180, 270, 405],
      damageType: 'physical',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_IvernMinionCarry',
    targetChampionApiName: 'TFT17_IvernMinion',
    abilityOverride: { pattern: 'aoe_circle', radius: 3, dash: 'to_farthest' },
    abilityData: {
      name: '빅뱅',
      desc: '주문력 전사로 변환. 패시브: 기본 공격당 추가 magic damage (미프 시너지 잠재력 스케일). 사용: 2칸 내 가장 큰 적 무리에 도약, 반경 3칸 magic damage (1칸당 45% 감소), 가장 가까운 3명 1.25/1.5/1.75초 공중 띄움.',
      mana: '50/100',
      damage: [240, 360, 560],
      onAttackBonus: [40, 60, 90],
      hexReduction: 0.45,
      stunDuration: [1.25, 1.5, 1.75],
      spiritEffectPerStack: 0,
      damageType: 'magic',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_JaxCarry',
    targetChampionApiName: 'TFT17_Jax',
    abilityOverride: { pattern: 'self_buff', selfBuff: { attackSpeed: 0.15, duration: 999 } },
    abilityData: {
      name: '저 별을 향해',
      desc: '주문력 전사로 변환. 패시브: 기본 공격당 추가 magic damage. 사용: 대상 magic damage + 영구 AS/MS +15/15/20% (전투 종료까지 누적).',
      mana: '20/80',
      damage: [155, 230, 375],
      onAttackBonus: [45, 70, 105],
      asGain: [0.15, 0.15, 0.20],
      damageType: 'magic',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_PykeCarry',
    targetChampionApiName: 'TFT17_Pyke',
    // PR7-A (17.2b): X-shape pattern (대상 + 4 diagonal hex). dash to_lowest_hp 후 X 모양 베기.
    abilityOverride: { pattern: 'x_shape', dash: 'to_lowest_hp' },
    damageTypeOverride: 'physical',
    scalingInput: { label: '처치 수', unit: '회', max: 999, effectPerStack: '골드 +1' },
    abilityData: {
      name: '청부 살인마',
      desc: '공격력 전사로 변환. 2칸 내 lowest HP 적에 dash 후 X 모양 베기. 대상 AD damage (탱커 +60%) + 주변 모든 적 secondaryDamage. 처치 시 70% damage 즉시 재시전.',
      mana: '0/40',
      damage: [220, 330, 500],
      secondaryDamage: [60, 90, 135],
      tankBonusMultiplier: 0.60,
      onKillRecastMultiplier: 0.70,
      damageType: 'physical',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_MordekaiserCarry',
    targetChampionApiName: 'TFT17_Mordekaiser',
    abilityOverride: { pattern: 'aoe_circle', radius: 1 },
    abilityData: {
      name: '뜨거운 죽음',
      desc: '주문력 전사로 변환. 패시브: 매초 반경 N칸 magic damage (시작 1, 6초마다 +1). 사용: 보호막 + 4초 동안 오라 damage 강화. (17.2b: shield 175/200/250 → 225/250/300)',
      mana: '40/100',
      damage: [50, 75, 115], // 사용 시 오라 damage
      passiveDamage: [20, 30, 45], // 패시브 오라
      empoweredAuraDamage: [50, 75, 115],
      empoweredDuration: 4,
      shield: [225, 250, 300], // 17.2b: 175/200/250 → 225/250/300
      damageType: 'magic',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_GragasCarry',
    targetChampionApiName: 'TFT17_Gragas',
    abilityOverride: { pattern: 'aoe_circle', radius: 3, selfDamage: true, selfDamageHpFloor: 1 },
    abilityData: {
      name: '자폭',
      desc: '주문력 전사로 변환. 자폭하여 maxHp 20% 희생 + 반경 3칸 magic damage (10% 최대체력 + AP). 1칸당 45% 감소. 탱커 상대 +60%. (17.2b: healthCost 30%→20%, hexReduction 55%→45%)',
      mana: '30/80',
      damage: [280, 420, 630], // AP 스케일 base
      healthCost: 0.20, // 17.2b: 0.30 → 0.20
      hexReduction: 0.45, // 17.2b: 0.55 → 0.45
      baseDamageHpFrac: 0.10, // 10% maxHp
      tankBonusMultiplier: 0.60,
      selfDamageHpFloor: 1,
      damageType: 'magic',
    },
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
