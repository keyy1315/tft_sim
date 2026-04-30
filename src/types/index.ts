// === Coordinate Types ===
/** Axial 좌표계 (설계 정본) — 거리 계산/타게팅에 최적 */
export interface HexCoord {
  q: number;
  r: number;
}

/** @deprecated HexPos는 렌더링 레이어 전용. 엔진은 HexCoord 사용 */
export interface HexPos {
  row: number;
  col: number;
}

/** Offset → Axial 변환 */
export function offsetToAxial(pos: HexPos): HexCoord {
  return { q: pos.col - Math.floor(pos.row / 2), r: pos.row };
}

/** Axial → Offset 변환 */
export function axialToOffset(coord: HexCoord): HexPos {
  return { row: coord.r, col: coord.q + Math.floor(coord.r / 2) };
}

/** Axial 좌표 거리 계산 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// === Game Role Mapping ===
export type GameRole =
  | 'APTank' | 'ADTank'
  | 'APCaster' | 'ADCaster' | 'ADCasterFormSwapper'
  | 'APFighter' | 'ADFighter' | 'HFighter'
  | 'ADCarry' | 'APCarry'
  | 'ADReaper' | 'APReaper'
  | 'APSpecialist' | 'ADSpecialist';

/** 게임 데이터 role → 설계 UnitRole 매핑 */
export function mapGameRole(gameRole: string | null): UnitRole {
  if (!gameRole) return 'Fighter';
  if (gameRole.includes('Tank')) return 'Tank';
  if (gameRole.includes('Reaper')) return 'Assassin';
  if (gameRole.includes('Carry')) return 'Marksman';
  if (gameRole.includes('Caster')) return 'Caster';
  if (gameRole.includes('Specialist')) return 'Specialist';
  if (gameRole.includes('Fighter')) return 'Fighter';
  return 'Fighter';
}

// === Raw JSON Data Types ===
export interface RawChampion {
  name: string;
  apiName: string;
  cost: number;
  traits: string[];
  role: GameRole | null;
  stats: {
    armor: number;
    attackSpeed: number;
    critChance: number;
    critMultiplier: number;
    damage: number;
    hp: number;
    initialMana: number;
    magicResist: number;
    mana: number;
    range: number;
  };
  ability: {
    name: string;
    desc: string;
    icon: string;
    variables: AbilityVariable[];
  };
}

export interface AbilityVariable {
  name: string;
  value: number[];
}

export interface RawItem {
  name: string;
  apiName: string;
  composition: string[];
  effects: Record<string, number>;
  desc: string;
  icon: string;
}

export type ItemCategory =
  | 'component'    // 조합재료
  | 'combined'     // 완성템
  | 'artifact'     // 유물
  | 'emblem'       // 상징
  | 'radiant'      // 찬란
  | 'piltover'     // 필트오버 모듈
  | 'bilgewater'   // 빌지워터 아이템
  | 'void'         // 공허 돌연변이
  | 'darkin'       // 다르킨
  | 'special';     // 특수 (비전투)

export interface EquipValidation {
  canEquip: boolean;
  reason?: string;
}

export interface RawItemsData {
  meta: {
    set: number;
    totalItems: number;
    baseComponents: number;
    combinedItems: number;
    tft16Special: number;
    artifacts: number;
    supportItems: number;
  };
  items: RawItem[];
}

export interface TraitEffect {
  maxUnits: number;
  minUnits: number;
  style: number; // 1=bronze, 3=silver, 4=gold, 5=prismatic
  variables: Record<string, number | null>;
  tierDesc?: string;
}

export interface RawTrait {
  name: string;
  apiName: string;
  desc: string;
  icon: string;
  effects: TraitEffect[];
}

export interface RawTraitsData {
  meta: { set: number; totalTraits: number };
  traits: RawTrait[];
}

export interface RawAugment {
  name: string;
  apiName: string;
  desc: string;
  effects: Record<string, number>;
  icon: string;
  associatedTraits: string[];
  tags: string[];
  /**
   * 시즌 미사용 / 비활성 증강 여부.
   * true 면 builder UI / 시뮬 풀에서 제외.
   * 누락된 경우 기본 false (활성) 취급.
   *
   * 분류 출처: lolchess.gg/augments/set17 + 수동 검수.
   * fetch-set17.mjs 가 기존 분류를 보존 (회귀 방지).
   */
  disable?: boolean;
}

export interface RawAugmentsData {
  meta: { set: number; totalAugments: number };
  augments: RawAugment[];
}

// === Computed Types ===
export interface ChampionStats {
  hp: number;
  armor: number;
  magicResist: number;
  damage: number;
  attackSpeed: number;
  critChance: number;
  critMultiplier: number;
  ap: number;
  mana: number;
  maxMana: number;
  range: number;
  armorPen: number;
  magicPen: number;
}

export interface StatBreakdown {
  base: number;
  starScaling: number;
  items: number;
  traits: number;
  augments: number;
  total: number;
}

export interface DamageResult {
  autoAttackDps: number;
  autoAttackDamage: number;
  abilityDamage: number;
  abilityDamageType: 'magic' | 'physical' | 'true';
  totalDps10s: number;
  effectiveAutoAttackDps: number;
  effectiveAbilityDamage: number;
  effectiveTotalDps10s: number;
  statBreakdown: {
    ad: StatBreakdown;
    ap: StatBreakdown;
    as: StatBreakdown;
    hp: StatBreakdown;
    armor: StatBreakdown;
    mr: StatBreakdown;
    critChance: StatBreakdown;
    critMultiplier: StatBreakdown;
  };
}

export interface ItemEffect {
  ad?: number;
  ap?: number;
  as?: number;
  hp?: number;
  armor?: number;
  magicResist?: number;
  critChance?: number;
  critDamage?: number;
  mana?: number;
  armorPen?: number;
  magicPen?: number;
  /** 아이템 기반 흡혈 (Bloodthirster StatOmnivamp 등) — 최종적으로 CombatUnit.omnivamp 에 합산 */
  omnivamp?: number;
  /** 아이템 기반 마나 재생 (초당, Shojin/Archangels/Empathic Implant ManaRegen) */
  manaRegen?: number;
  /**
   * 회복량 증폭 (multiplicative bonus). 예: 0.22 = +22% 회복량.
   * GrenadeMod_Radiant IncreasedHealing 등 heal 증폭 효과용.
   * CombatUnit.healAmp 에 누적되어 execHeal 시 (1 + healAmp) 곱셈.
   */
  healAmp?: number;
}

export interface ActiveTrait {
  trait: RawTrait;
  count: number;
  activeEffect: TraitEffect | null;
  style: number;
}

export interface HexPos {
  row: number;
  col: number;
}

export type MfMode = 'replicator' | 'channeler' | 'challenger';

export interface MfModeAbility {
  name: string;
  desc: string;
  /** [star1, star2, star3] 피해량 */
  damage: [number, number, number];
}

export interface MfModeData {
  name: string;
  trait: string;
  icon: string;
  ability: MfModeAbility;
}

export const MF_MODE_CONFIG: Record<MfMode, MfModeData> = {
  channeler: {
    name: '전달자 모드',
    trait: 'TFT17_ManaTrait',
    icon: '/data/images/artifacts/tft17_missfortuneunique_manatraiticon.tft_set17.png',
    ability: {
      name: '기동총격여신: 전달자',
      desc: '가장 가까운 적 2명에게 2.5초 동안 탄환을 퍼부어 매초 물리 피해를 입힙니다.',
      damage: [75, 115, 180],
    },
  },
  challenger: {
    name: '도전자 모드',
    trait: 'TFT17_ASTrait',
    icon: '/data/images/artifacts/tft17_missfortuneunique_astraiticon.tft_set17.png',
    ability: {
      name: '기동총격여신: 도전자',
      desc: '대상에게 탄환을 발사해 물리 피해를 입힙니다. 탄환은 주변 적에게 튕기고 표식을 남깁니다. 표식이 남은 적에게 50% 증가한 피해를 입힙니다.',
      damage: [132, 198, 320],
    },
  },
  replicator: {
    name: '복제자 모드',
    trait: 'TFT17_APTrait',
    icon: '/data/images/artifacts/tft17_missfortuneunique_flextraiticon.tft_set17.png',
    ability: {
      name: '기동총격여신: 복제자',
      desc: '일직선상 적을 관통하는 탄환을 난사해 물리 피해를 입힙니다. 적중한 적 하나당 피해량이 30% 감소합니다.',
      damage: [280, 420, 670],
    },
  },
};

export type PermanentStackType = 'ezreal_drones' | 'chogath_hp';

export interface PermanentStack {
  type: PermanentStackType;
  value: number;
}

export interface PermanentStackConfig {
  type: PermanentStackType;
  label: string;
  unit: string;
  max: number;
  preview: (value: number, starLevel: number) => string;
}

export const PERMANENT_STACK_CONFIG: Record<string, PermanentStackConfig> = {
  TFT17_Ezreal: {
    type: 'ezreal_drones',
    label: '처치 관여',
    unit: '회',
    max: 30,
    preview: (value, starLevel) => {
      const drones = Math.floor(value / 8);
      const droneDmg = [0, 25, 38, 60][starLevel] ?? 25;
      return drones > 0 ? `드론 ${drones}개 (개당 ${droneDmg} 추가 피해)` : '드론 없음';
    },
  },
  TFT17_Chogath: {
    type: 'chogath_hp',
    label: '획득한 체력',
    unit: '',
    max: 9999,
    preview: (value) => value > 0 ? `최대 체력 +${value}` : '',
  },
};

export interface PlacedChampion {
  champion: RawChampion;
  position: HexCoord;
  starLevel: number; // 1, 2, 3
  items: RawItem[];
  /**
   * actual-data 경로에서 슬롯 좌표를 보존하기 위한 선택적 3-tuple.
   * 길이 3(빈 슬롯은 null). 존재하면 SetupBoardCore 의 고정 3-슬롯 레이아웃 렌더링에 사용된다.
   * /simulator 등 legacy 경로에서는 undefined → 기존 compacted items 기반 렌더링 유지.
   */
  itemSlots?: Array<RawItem | null>;
  voidItem?: RawItem | null;
  mfMode?: MfMode | null;
  permanentStacks?: PermanentStack | null;
  isDummy?: boolean;
  isSummon?: boolean;
}

// === Arbiter Law (중재자 법률) ===
export interface ArbiterLaw {
  triggerId: string;
  effectId: string;
}

// === Hex Buff (칸 버프 증강) ===
export interface HexBuffEffects {
  hp?: number;
  hpPercent?: number;
  attackSpeed?: number;
  damageAmp?: number;
  armor?: number;
  magicResist?: number;
  ap?: number;
  ad?: number;
}

export interface HexBuff {
  augmentApiName: string;
  positions: HexCoord[];
  movable: boolean;
  effects: HexBuffEffects;
  color: string;
  label: string;
}

export interface TeamComp {
  champions: PlacedChampion[];
  augments: RawAugment[];
}

// === Role & Status Types ===
export type UnitRole = 'Tank' | 'Fighter' | 'Marksman' | 'Caster' | 'Assassin' | 'Specialist';

export type AbilityTargetingType =
  | 'current_target'
  | 'farthest'
  | 'nearest'
  | 'lowest_hp'
  | 'lowest_hp_ally'
  | 'random'
  | 'self'
  | 'aoe_center';

export type AbilityPattern =
  | 'single'      // 타겟 1명
  | 'line'        // 직선 관통
  | 'aoe_circle'  // 원형 범위
  | 'cone'        // 원뿔형
  | 'multi'       // 지정 다수
  | 'bounce'      // 튕김
  | 'global'      // 전체 적
  | 'self_buff';  // 자기 버프

export type StatusEffectType = 'stun' | 'slow' | 'burn' | 'shield' | 'invulnerable' | 'disarm' | 'taunt' | 'mark' | 'poison';

export interface StatusEffect {
  type: StatusEffectType;
  sourceId: string;
  remainingTicks: number;
  value?: number;
}

// === Ability Types (Structured) ===
export type EffectType = 'damage' | 'heal' | 'shield' | 'stun' | 'slow' | 'burn' | 'knockup';

export interface AbilityEffect {
  type: EffectType;
  value: number;
  durationTicks?: number;
  damageType?: 'physical' | 'magic' | 'true';
}

export interface Ability {
  name: string;
  type: 'active' | 'passive';
  targeting: AbilityTargetingType;
  damageType: 'physical' | 'magic' | 'true';
  effects: AbilityEffect[];
  castTimeTicks: number;
}

// === Augment Types (Structured) ===
export type AugmentEffectType = 'stat_modifier' | 'trait_bonus' | 'on_event' | 'unique';

export interface AugmentEffect {
  type: AugmentEffectType;
  target?: 'all' | 'role' | 'trait' | 'specific_champion';
  targetFilter?: string;
  stat?: string;
  value?: number;
  isPercentage?: boolean;
  eventHook?: string;
}

export interface Augment {
  id: string;
  name: string;
  tier: 'silver' | 'gold' | 'prismatic';
  effects: AugmentEffect[];
}

// === Combat Types ===
export type UnitState = 'idle' | 'moving' | 'attacking' | 'casting' | 'dead';

export interface CombatUnit {
  id: string;
  champion: RawChampion;
  team: 'player' | 'enemy';
  position: HexCoord;
  starLevel: 1 | 2 | 3;
  role: UnitRole;
  items: RawItem[];
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  state: UnitState;
  target: string | null;
  stats: ChampionStats;
  attackCooldown: number;
  moveCooldown: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  /** ItemEffectRuntime 의 dealDamage primitive 로만 누적되는 피해량.
   *  totalDamageDealt 의 부분집합. Phase 6-B Part 4 calibration 측정용 — basic attack/ability
   *  damage 와 분리해서 trigger/timer 발동 기여를 측정. */
  itemDamageDealt: number;
  statusEffects: StatusEffect[];
  omnivamp: number;
  // 전투 내 카운터
  attackCount: number;
  castCount: number;
  killCount: number;
  damageAmp: number;
  damageReduction: number;
  shield: number;
  augmentManaRegen: number;
  augmentGrievousWounds: number;
  augmentExecuteThreshold: number;
  augmentBurnPercent: number;
  /** 발명품 탱커 대상 추가 피해증폭 (ArmorNullifier) */
  inventionTankDamageAmp: number;
  /**
   * 회복량 증폭 (additive bonus). 0 = base 1.0, 0.22 = 회복량 +22%.
   * primitive execHeal / heal site 에서 (1 + healAmp) 곱셈으로 적용.
   * GrenadeMod_Radiant IncreasedHealing 등 누적.
   */
  healAmp: number;
  /**
   * 암흑의 별 (TFT17_DarkStar) (2)+ tier 활성 시 darkStar unit 본인만 양수.
   * 이 unit 이 공격하여 target 의 currentHp/maxHp 가 임계값 이하면 즉사 처리 (블랙홀).
   * 0 = 미활성. ExecuteHPPercent 0.08 (8%) 가 17.2 spec.
   */
  darkStarExecuteThreshold: number;
  /**
   * 암흑의 별 (6)+ tier 활성 + "가장 강한" darkStar unit 1명만 true.
   * Supermassive 효과: ADAP 가산을 (1 + SupermassivePercentBonus) 만큼 추가 강화.
   * (PercentHealth 변수는 desc 미사용 → maxHp 효과 미적용)
   */
  darkStarSupermassive: boolean;
  /**
   * 최신상 (TFT17_GravesTrait) Frame 변환 — 가장 강한 그레이브즈 1명만 양수.
   * 'CloseQuarters' = 맹공 프레임 (공격력 전사: 사거리-2, +HP/AD/흡혈)
   * 'SharpshooterModule' = 위력 프레임 (정밀 + 스킬 피해 +5%)
   * 'DoubleTap' = 사수 프레임 (25% 확률 2회 공격)
   * null = Frame 미적용 (Graves 가 일반 챔프로 작동).
   */
  gravesFrame: 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap' | null;
  /**
   * Frame DoubleTap 활성 시 추가 공격 발동 확률 (0~1). 0 = 미활성.
   * eventBus 'on_attack' hook 에서 rng.next() < chance 시 추가 hit.
   */
  gravesDoubleAttackChance: number;
  /**
   * Frame SharpshooterModule 활성 시 ability damage 추가 % (0~1, 0.05 = +5%).
   * cast 처리 시 abilityDamage *= (1 + bonus). 0 = 미활성.
   */
  gravesAbilityDamageBonus: number;
  /**
   * 최신상 (TFT17_GravesTrait) 무기고 stat upgrade 활성 ID 목록.
   * 가장 강한 그레이브즈 1명에게만 채워지며 빈 배열 = 미적용.
   * 예: ['LeechingImplants', 'HeavyPlating', 'PrecisionScope2'].
   * upgrade 적용 후 stat (damage / range / armor / etc.) 는 직접 누적.
   */
  gravesUpgrades: string[];
  /**
   * Tankbuster (탱커 파괴자) 업그레이드 활성 시 target.role==='Tank' 한정 추가 damage amp.
   * 0 = 미활성 (기본). inventionTankDamageAmp 와 별도로 합산.
   */
  gravesTankDamageAmp: number;
  /**
   * Nanomachines 업그레이드 — 매초 maxHp × N% 자가 회복. 0 = 미활성, 0.03 = 활성.
   * main loop 의 1초 주기 tick 에서 누적 적용 (TICKS_PER_SECOND 마다).
   */
  gravesNanoRegenPct: number;
  /**
   * RipperBullets/2 업그레이드 — 평타 명중 시 대상 armor/MR -N. 0 = 미활성, 1/2 = tier.
   * 영구 누적 (전투 종료 시까지). on_attack hook 후 즉시 적용.
   */
  gravesRipperReduce: number;
  /**
   * EmergencyShielding/2 — 저체력 시 1회 maxHp×ShieldPct shield 부여 (Duration 초).
   * 0 = 미활성 / 0.4 (40%) = trigger HP fraction. 매 tick 의 hp/maxHp 체크.
   */
  gravesEmergencyTriggerHpFrac: number;
  /** EmergencyShielding/2 — shield 양 = maxHp × N. 0.5 = 50% (tier 1) / 0.75 = 75% (tier 2). */
  gravesEmergencyShieldFrac: number;
  /** EmergencyShielding/2 — shield 지속 시간 (초). 2.5 (tier 1) / 4 (tier 2). */
  gravesEmergencyDurationSec: number;
  /** EmergencyShielding/2 — 1회 한정 가드. trigger 발동 시 true 로 전환. */
  gravesEmergencyUsed: boolean;
  /**
   * Shockwave 업그레이드 — 전투 시작 시 그레이브즈 정면 가까운 적 N명에게
   * maxHp×0.15 마법 + 2초 stun. true = 활성. on_combat_start 시 1회 처리.
   */
  gravesShockwaveActive: boolean;
  /**
   * ReactiveArmor 업그레이드 — 피격 시 armor/MR +N stack (perStack), 최대 50회.
   * 0 = 미활성 / 4 = 활성 (per-hit 증가량). on_hit_taken hook 에서 stack.
   */
  gravesReactivePerStack: number;
  /** ReactiveArmor 누적 stack 수. 0..50 사이 제한. */
  gravesReactiveStackCount: number;
  /**
   * TripleTap (한 발에 세 놈) 업그레이드 — N% 확률 추가 2 hit (총 3회).
   * 0 = 미활성 / 0.18 = 활성. DoubleTap Frame / DoubleTap2 와 별개 roll —
   * TripleTap 발동 시 DoubleTap path skip (중복 방지).
   */
  gravesTripleAttackChance: number;
  /**
   * RevUp/2 (엔진 가동) 업그레이드 — 같은 대상 연속 공격마다 AS +N% stack.
   * 0 = 미활성 / 0.08 = RevUp / 0.15 = RevUp2.
   */
  gravesRevUpPerStack: number;
  /** RevUp/2 누적 AS bonus 한도. 0 / 0.80 (RevUp) / 1.50 (RevUp2). */
  gravesRevUpMaxBonus: number;
  /** RevUp/2 sticky target id — 마지막 공격 대상. 다른 대상 공격 시 stack reset. */
  gravesRevUpStickyTargetId: string | null;
  /** RevUp/2 누적 stack 수. 같은 target 연속 공격 시 ++, 다른 target 시 0. */
  gravesRevUpStackCount: number;
  /**
   * GravBooster/2 (중력 증폭기) — 처치 관여 시 다음 적으로 dash + AS +N% (M attacks 동안).
   * 0 = 미활성 / 0.40 = 활성. raw BonusMultAS=0.40 (tier 동일).
   */
  gravesGravBoosterBonusAS: number;
  /** GravBooster/2 — 처치 시 활성화될 max attacks (kill trigger 시 attacksRemaining=N). */
  gravesGravBoosterMaxAttacks: number;
  /**
   * GravBooster/2 — 현재 남은 boosted attacks. >0 일 때 AS bonus 활성.
   * Attack hit 후 -- → 0 시 boost 만료.
   */
  gravesGravBoosterAttacksRemaining: number;
  /**
   * LatentExplosion (지연 폭발) — 입힌 피해 N% 저장. 0 = 미활성 / 0.15 = 활성.
   * graves attacker 측 unit 에 set. damage 적용 시 target 의 stored 에 가산.
   */
  gravesLatentStoredPct: number;
  /**
   * LatentExplosion — 적 unit 에 누적 저장된 damage. graves 가 hit 한 만큼 누적.
   * target 사망 시 (graves 처치 관여) stored 만큼 2 hex 반경 splash.
   */
  gravesLatentStored: number;
  /**
   * Buckshot/2/3 — 평타 시 추가 발사 projectile 수 (N-1 nearby hits).
   * 0 = 미활성 / 2 / 4 / 6. raw NumBonusProjectiles.
   */
  gravesBuckshotProjectiles: number;
  /**
   * Buckshot/2/3 — spread 정도 (nearby radius 영향). 0 / 0.20 / 0.30 / 0.40.
   * radius = 1 + round(spread × 2.5) → 1 / 2 / 2 / 2 hex (단순화).
   */
  gravesBuckshotSpread: number;
  /**
   * LaserBallistics — 관통 hex 수 (다음 적까지 1칸). 0 / 1.
   * 단일 tier 만 존재 (LaserBallistics2/3 raw 는 tree 미표시 — Riot 미구현).
   */
  gravesLaserPenetrationHexes: number;
  /** LaserBallistics — 관통 적당 damage reduction. 0 / 0.5. */
  gravesLaserDmgReductionPerTarget: number;
  /**
   * FragmentationRounds/2 — 평타 시 주변 파편 fraction. 0 / 0.15 / 0.20.
   * raw FragmentDamage. magic damage type.
   */
  gravesFragDamage: number;
  /** FragmentationRounds/2 — 파편 개수 (nearby targets). 0 / 2 / 3. */
  gravesFragProjectiles: number;
  /**
   * Meltthrough — 매 1초 graves 주변 2 hex 적군 armor/MR -N (영구 누적, floor 0).
   * 0 = 미활성 / 4 = 활성. raw ArmorMRReduction.
   */
  gravesMeltthroughArmorMR: number;
  /**
   * BlastRadius/2/3 — ability primary hit 위치 기준 N hex 추가 폭발 반경.
   * 0 = 미활성 / 1 / 2 / 3. raw IncreasedRadius.
   */
  gravesBlastIncreasedRadius: number;
  /**
   * BlastRadius/2/3 — 거리당 데미지 감소. distance × N% 만큼 감소.
   * 0 / 0.5 (BlastRadius) / 0.30 (BlastRadius2/3). raw DamageReductionPerHex.
   */
  gravesBlastDmgReductionPerHex: number;
  /**
   * SympatheticDetonation — ability hit 한 적 인접 1 hex 가까운 적 1명에 추가 폭발.
   * 0 = 미활성 / 0.30 = 활성 (30% damage = -70% reduction; raw 변수명/의미 반전).
   * raw SympatheticDamageReduction — 실제 의미는 dealt fraction (codex P1 PR #58).
   */
  gravesSympatheticReduction: number;
  /**
   * VoidCoefficient — graves 매 cast 직후 maxMana × (1 - N) 적용 (min 10).
   * 0 = 미활성 / 0.15 = 활성. raw PercentManaReductionPerCast.
   */
  gravesVoidCoefficientPct: number;
  /**
   * Choke — Buckshot spread 를 N% 감소. triggerBuckshot 에서 spread × (1 - N) 적용.
   * 0 = 미활성 / 0.75 = 활성. raw SpreadDecrease.
   */
  gravesChokeSpreadDecrease: number;
  /**
   * AimAssistant — 평타 시 distance × N 만큼 damage amp.
   * 0 = 미활성 / 0.05 = 활성 (5% per hex). raw BonusDamagePerHex.
   */
  gravesAimAssistBonusPerHex: number;
  /**
   * 파티광 (TFT17_BlitzcrankUniqueTrait) — 전투당 1회 트리거.
   * HP < threshold 도달 시 invulnerable + 매초 maxHp × healRate heal.
   * HP 100% 도달 시 heal 종료 (invulnerable 제거).
   *
   * 0 = 미활성 / 0.15 = 활성 (per-second heal rate). raw PercentHealthHeal.
   */
  partyHealRate: number;
  /** 파티광 트리거 HP 비율. 0 = 미활성 / 0.45 = 활성. raw HealthThreshold. */
  partyHpThreshold: number;
  /** 파티광 트리거 사용 여부 (전투당 1회 가드). */
  partyUsed: boolean;
  /** 파티광 heal 진행 중 (true 동안 invulnerable + heal). */
  partyHealing: boolean;
  /**
   * 복제자 (TFT17_APTrait) — MF replicator mode 한정.
   * 스킬 한 번 더 발동, N% 위력. 0 = 미활성 / 0.22 (2-3) / 0.45 (4+).
   * raw Effectiveness.
   */
  mfReplicatorEffectiveness: number;
  /**
   * 우주 그루브 (TFT17_SpaceGroove) 일반 tier — 그루비안 unit 한정.
   * raw ADAPPerSecond. 0 = 미활성 / 5 / 10. 매 1초 ADAP +N% 가산 (StartOfCombatDuration 초 동안).
   */
  spaceGrooveAdapPerSec: number;
  /**
   * 우주 그루브 일반 tier — 그루비안 unit 한정 ADAP 적용 종료 시점 (combat seconds).
   * raw StartOfCombatDuration. 0 = 미활성 / 3 (일반) / 60 (prism — 별도 처리).
   */
  spaceGrooveDurationSec: number;
  /**
   * 자폭(TFT17_Augment_GragasCarry) 활성 + 가장 강한 그라가스로 선정된 unit 만 true.
   * 그라가스 ability 가 거대한 폭발 (자기 자신 데미지, 다른 아군 X) 로 변환되며,
   * 자폭 데미지로 hp 가 1 미만으로 떨어지지 않음 (HP floor=1).
   */
  gragasCarryActive: boolean;
  /**
   * 방패 여전사(TFT17_Augment_LeonaCarry) 활성 + 가장 강한 레오나로 선정된 unit 만 true.
   * 레오나 ability 가 적 가로질러 dash (line 패턴) + 첫 적중 대상 기절 (CC) 로 변환.
   */
  leonaCarryActive: boolean;
  /** MF 특성 선택 등으로 치환된 실제 트레이트 목록 */
  resolvedTraits?: string[];
  /** 스킬 치명타 가능 여부. 전투 시작 시 보건/무대 착용 또는 정밀 계열 시너지로 결정. */
  spellCanCrit: boolean;
  /**
   * @deprecated 17.2 이전 (legacy) — Fountain_HealPercent 기반 스킬 힐 트리거.
   * 17.2+ 에서는 {Fountain_StackingADAP / HealthRegen} 메커니즘으로 변경됨.
   * combatLoop applyStargazerEffects 의 legacy 경로에서만 사용.
   */
  stargazerFountainHealPercent: number;
  /**
   * 별돌보미 우물(Fountain) 변종 17.2 — 강화 칸 unit 의 max HP 회복 % per tick.
   * teamwide (강화 칸 아군) = 0.02, 별돌보미 추가 = 0.04 → 별돌보미 합산 0.06.
   * 0 = 비활성. main loop tick 마다 fountainTickInterval 만료 시 heal 발동.
   */
  fountainHealPctPerTick: number;
  /**
   * 별돌보미 우물(Fountain) 변종 17.2 — 강화 칸 별돌보미 stacking AD/AP % per tick.
   * (3) tier = 0.02, (5) tier = 0.04 — desc StackingADAP. 매 tick 누적 AD/AP 가산.
   * 0 = 비활성 (강화 칸 별돌보미 아닌 unit).
   */
  fountainStackingAdapPerTick: number;
  /**
   * 별돌보미 여사냥꾼(Huntress) 변종 — 표식된 적 사망 시 maxHp 비율 회복.
   * 강화 칸 안 별돌보미 unit 만 양수 (예: 0.10 → maxHp × 10% heal).
   */
  stargazerHuntressHealPercent: number;
  /**
   * 별돌보미 뱀(Serpent) 변종 — 적에게 입힌 피해의 일부를 N초간 magic DOT 으로 추가.
   * 강화 칸 안 별돌보미 unit 만 양수 (예: 0.40 → 입힌 피해의 40% 가 3초간 분산 적용).
   */
  stargazerSerpentPoisonPercent: number;
  /** Serpent 의 중독 지속시간 (초). poison statusEffect 의 remainingTicks 계산용. */
  stargazerSerpentDurationSec: number;
  /**
   * 요새 (Bastion/ResistTank) — 첫 N초 doubled BonusArmor.
   * 0 = 비활성. 양수면 그 tick 에 도달 시 doubled 부분 (bastionDoubleArmorBonus)
   * 을 stats.armor 에서 차감. tick 마다 main loop 가 체크.
   */
  bastionDoubleEndTick: number;
  bastionDoubleArmorBonus: number;
  bastionDoubleMrBonus: number;
  /**
   * 별돌보미 제단(Shield) 변종 — cashout 발동 시 추가 HP buff.
   * 강화 칸 안 별돌보미 unit 만 양수 (예: 0.20 → cashout 시 maxHp × 1.20).
   * cashout 미발동 시 0.
   */
  stargazerShieldCashoutHpFrac: number;
  /** Shield cashout 발동 시 추가 AS buff (예: 0.18 → AS × 1.18). */
  stargazerShieldCashoutAsFrac: number;
  /**
   * 저격수 (Sniper/RangedTrait) — base damage amp + per-hex 추가.
   * fraction 기준 (예: 0.18 = 18%). 0 = 비-저격수.
   * damage hit 시: sniperBaseDA + sniperPerHexDA × hexDistance(caster, target).
   */
  sniperBaseDA: number;
  sniperPerHexDA: number;
}

export interface CombatLog {
  tick: number;
  time: number;
  type: 'attack' | 'ability' | 'move' | 'death' | 'mana'
      | 'status_apply' | 'status_expire';
  sourceId: string;
  targetId?: string;
  value?: number;
  /** 상태이상 이벤트일 때 어떤 상태이상인지 */
  statusType?: StatusEffectType;
  message: string;
}

export interface MultiSimResult {
  playerWins: number;
  enemyWins: number;
  draws: number;
  total: number;
}

export interface CombatResult {
  winner: 'player' | 'enemy' | 'draw';
  duration: number;
  logs: CombatLog[];
  playerUnits: CombatUnit[];
  enemyUnits: CombatUnit[];
  snapshots: TickSnapshot[];
  multiSim?: MultiSimResult;
}

export interface TickSnapshotUnit {
  id: string;
  currentHp: number;
  currentMana: number;
  position: HexCoord;
  isAlive: boolean;
  shield: number;
  statusEffects: { type: string; remainingTicks: number; value?: number }[];
  totalDamageDealt: number;
  stats: ChampionStats;
  damageAmp: number;
  omnivamp: number;
  damageReduction: number;
}

export interface TickSnapshot {
  tick: number;
  units: Record<string, TickSnapshotUnit>;
  events: CombatLog[];
}

// === Augment Tier Types ===
export type AugmentTier = 'silver' | 'gold' | 'prismatic' | 'boon';

export const AUGMENT_TIER_TAGS: Record<string, AugmentTier> = {
  '{d11fd6d5}': 'silver',
  '{ce1fd21c}': 'gold',
  '{cf1fd3af}': 'prismatic',
  '{719abef1}': 'boon', // Set 17 신 은총 (GodAugment) 고유 티어
};

export const COST_COLORS: Record<number, string> = {
  1: '#9ca3af', // gray
  2: '#22c55e', // green
  3: '#3b82f6', // blue
  4: '#a855f7', // purple
  5: '#f59e0b', // gold
};

// === Drag & Drop Types ===
export type DragData =
  | { type: 'champion'; champion: RawChampion }
  | { type: 'placed-unit'; team: 'player' | 'enemy'; position: HexCoord }
  | { type: 'item'; item: RawItem }
  | { type: 'tool'; toolKind: 'remove-all' };

export const STAR_SCALING: Record<number, number> = {
  1: 1,
  2: 1.8,
  3: 3.24,
};

export const TRAIT_STYLE_COLORS: Record<number, string> = {
  0: '#6b7280', // inactive gray
  1: '#cd7f32', // bronze
  3: '#c0c0c0', // silver
  4: '#ffd700', // gold
  5: '#e879f9', // prismatic
  6: '#38bdf8', // unique (최고 티어 — 9~11 유닛)
};

// === Team Code Types ===
export interface TeamPlannerEntry {
  apiName: string;
  teamPlannerCode: number;
}

export interface TeamPlannerData {
  meta: { set: number; source: string };
  mapping: TeamPlannerEntry[];
}

export interface TeamCodeDecodeResult {
  champions: { champion: RawChampion; starLevel: number }[];
  warnings: string[];
}
