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
   * Set 17에서 실제 사용되는 증강 여부 (CommunityDragon 기준).
   * false면 이전 시즌 잔재이거나 비활성 증강.
   * 누락된 경우 기본 false 취급.
   */
  inSet17?: boolean;
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
   * 별돌보미 우물(Fountain) 변종 — 스킬 시전 시 가장 체력 낮은 아군 회복.
   * 강화 칸 안 별돌보미 unit 만 양수 (예: 0.18 → 스킬 즉발 피해의 18% heal).
   * applyStargazerEffects 가 well 변종 활성 + 강화 칸 + 별돌보미 unit 에 설정.
   */
  stargazerFountainHealPercent: number;
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
