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
  | 'animasquad'   // 동물특공대 전용 아이템 (TFT17_AnimaSquadItem_*)
  | 'psyops'       // 초능력 전용 아이템 (TFT17_Item_PsyOps_*)
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
  /**
   * N.O.V.A. (DRX 5+) "타격 선택기" 수동 지정 플래그.
   * true 인 NOVA 유닛(Aatrox/Caitlyn/Akali/Maokai/Kindred) 1명만 팀당 허용.
   * undefined/false 인 경우 combatLoop 의 autoAssignNovaSelector fallback 이 동작.
   * 시뮬 옵션 변환 시 이 boolean 을 SimulateOptions.{player|enemy}NovaStrikeSelectorUnit 의 apiName 으로 매핑.
   */
  novaStrikeSelector?: boolean;
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

export type AbilityPattern =
  | 'single'      // 타겟 1명
  | 'line'        // 직선 관통
  | 'aoe_circle'  // 원형 범위
  | 'cone'        // 원뿔형
  | 'multi'       // 지정 다수
  | 'bounce'      // 튕김
  | 'global'      // 전체 적
  | 'self_buff'   // 자기 버프
  | 'x_shape';    // X 모양 (대상 + 4 diagonal hex direction) — 파이크 carry

export type StatusEffectType = 'stun' | 'slow' | 'burn' | 'shield' | 'invulnerable' | 'disarm' | 'taunt' | 'mark' | 'poison' | 'resists-buff';

export interface StatusEffect {
  type: StatusEffectType;
  sourceId: string;
  remainingTicks: number;
  value?: number;
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
  /**
   * 아이템에서 부여되는 공격당 추가 마나 (집계). 쇼진의 창 FlatManaRestore=5 등.
   * gainManaOnAttack 에서 role 기본값에 더해진다. 기본 0.
   */
  itemFlatManaPerAttack: number;
  /** 발명품 탱커 대상 추가 피해증폭 (ArmorNullifier) */
  inventionTankDamageAmp: number;
  /**
   * 매드레드의 검 (TFT_Item_MadredsBloodrazor) 탱커 대상 +DamageAmp (PR101).
   * TFT17 메커닉: 탱커를 상대로 +15% 피해 증폭. 본 unit 의 평타+스킬 모두 적용.
   * 아이템 1개당 0.15 누적 (다중 부착 시 누적). target.role === 'Tank' 일 때 damageAmp 가산.
   */
  madredsTankDamageAmp: number;
  /**
   * Mordekaiser proc 시스템 (TFT17_Mordekaiser) — proc 종료 tick.
   * 0 = 비활성. cast 시점에 (currentTick + Duration × TICKS_PER_SECOND) 로 set.
   * 매 tick `tickMordekaiserProc` 에서 만료 체크 (HealRefund 적용 후 0 reset).
   */
  mordekaiserProcEndTick: number;
  /**
   * Mordekaiser proc 다음 펄스 발동 tick.
   * 0 = 비활성. cast 시 (currentTick + 1 × TICKS_PER_SECOND) — 첫 펄스 t=1.
   * 펄스 발동 후 += TICKS_PER_SECOND (다음 1초 후).
   */
  mordekaiserNextProcTick: number;
  /**
   * Mordekaiser 스킬 보호막 별도 pool (general unit.shield 와 분리 추적).
   * InitialShield + 매 펄스 ShieldPerProc 가산. damage 흡수 시 우선 차감.
   * 만료 시 HealRefund (잔여 × 0.4) → currentHp 회복 후 0.
   */
  mordekaiserShieldRemaining: number;
  /**
   * Illaoi 시험 (TFT17_Illaoi) AfterShock — Duration(3초) 후 2칸 magic AOE 발동 tick.
   * 0 = 비활성. applyIllaoiCast 가 (currentTick + Duration × TICKS_PER_SECOND) 로 set.
   * 매 tick `tickIllaoiAfterShock` 이 만료 체크 (AOE 발동 후 0 reset).
   * 사망 시 cancel (state cleanup, AOE 미발동).
   */
  illaoiAfterShockEndTick: number;
  /**
   * Illaoi AfterShock AP snapshot — cast 시점의 stats.ap 저장.
   * 만료 시 Damage × (1 + apSnapshot/100) × healAmp 계산에 사용
   * (cast 시 받은 AP buff 가 만료 시까지 유효, 중간 AP 변동 무관).
   */
  illaoiAfterShockApSnapshot: number;
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
   * 가고일 돌갑옷(GargoyleStoneplate) 동적 방어 — 자신을 공격 대상으로 삼은 적 1명당
   * armor/MR 증가 (착용 개수 × ArmorPerEnemy/MRPerEnemy, raw 각 10). static Armor/MR/HP 는
   * legacy stat 으로 이미 적용 — 본 필드는 **동적 per-attacker 성분만**. 0 = 미착용.
   * per-tick 재계산 (현재 공격자 수 변동 반영, applied-delta 로 누적 방지).
   */
  gargoyleArmorPerEnemy: number;
  gargoyleMRPerEnemy: number;
  /** 현재 stats 에 반영된 동적 armor/MR (delta 계산용 — 공격자 수 변동 시 차분 적용). */
  gargoyleAppliedArmor: number;
  gargoyleAppliedMR: number;
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
   * 도전자 Burst — 새 대상 dash 발동 시 burst 종료 tick.
   * dash 시점에 tick + BurstDuration × TICKS_PER_SECOND 로 set.
   * tick < endTick 동안 getEffectiveAttackSpeed 에 BurstPercent 가산.
   * 0 = 미활성 / 비활성. raw BurstDuration=2.5, BurstPercent=0.50.
   */
  challengerBurstEndTick: number;
  /** 도전자 Burst — 활성 시 AS multiplicative bonus. 0 = 미활성 / 0.50 (50%). */
  challengerBurstPercent: number;
  /**
   * 전달자 InnateManaGain — 모든 mana gain × (1 + N).
   * 0 = 미활성 / 0.20 (20% 증가). raw InnateManaGain.
   */
  channelerInnateManaGain: number;
  /**
   * 습격자 흡혈→보호막 — 흡혈 초과량 (currentHp == maxHp) 을 보호막으로 변환.
   * 보호막 cap: maxHp × meleeMaxShieldPct. 0 = 미활성 / 0.25 = 25%. raw MaxPercentHealthShield.
   */
  meleeMaxShieldPct: number;
  /**
   * 습격자 (6) tier ShieldAD — 보호막 활성 시 추가 AD %.
   * 0 = 미활성 / 0.20 (20%). raw ShieldAD.
   */
  meleeShieldADBonus: number;
  /**
   * Blitzcrank Bolt passive — 매 BoltCooldown 초마다 가장 체력 높은 적에 magic damage.
   * 0 = 미활성 / >0 = 활성 cooldown sec. raw star-scaled.
   * partyHealing 종료 시 boltSpeedMult ×4 적용 (effective = boltCooldownSec / boltSpeedMult).
   */
  blitzBoltCooldownSec: number;
  /** Blitzcrank Bolt — magic damage value (star-scaled). 0 = 미활성. */
  blitzBoltDamage: number;
  /** Blitzcrank Bolt — last fire tick. 다음 fire 시점 = lastFireTick + (cooldownSec / mult) × TPS. */
  blitzBoltLastFireTick: number;
  /** 파티광 후속 효과 — 회복 완료 후 Bolt 발사 속도 multiplier. 1 default / 4 (회복 완료 후). */
  blitzBoltSpeedMult: number;
  // PR #147 deprecate: gragasCarryActive / leonaCarryActive 필드 제거됨.
  // selectedCarryAugment === 'TFT17_Augment_GragasCarry' / 'TFT17_Augment_LeonaCarry'
  // 비교로 대체. sim 코드 read 0건이었음 (test assertion 만 갱신).
  /**
   * 뜨거운 죽음(TFT17_Augment_MordekaiserCarry) 활성 시 carry abilityData.shield override.
   * null = 비활성, 배열 = augment 활성 (starLevel 별 [1성, 2성, 3성]).
   * applyMordekaiserProcCast 가 raw InitialShield 대신 본 override 우선 read.
   * 위키 lint #7 (PR #123 검출): 17.3 patch note Heat Death shield 175/200/400 sim 정합.
   */
  mordekaiserCarryShield: readonly number[] | null;
  /**
   * 별빛 연계(TFT17_Augment_AatroxCarry) 3-skill cycle counter — PR7-C.
   * cast 마다 +1, (counter % 3) 으로 분기:
   *   0 = 타격 (single AD)
   *   1 = 휩쓸기 (cone AD + armor 감소 10)
   *   2 = 찍기 (aoe_circle radius 1 + 공중 띄움 + 단독 적중 ×2.5)
   * 사용자 결정: unit 사망 후 resurrect 시 counter 0 reset.
   */
  aatroxCycleCounter: number;
  /**
   * Aatrox carry resurrect 검사용 — 이전 tick state 가 'dead' 였는지 추적. PR7-C.
   * dead → alive 전환 시 aatroxCycleCounter 0 reset (사용자 결정).
   */
  aatroxPreviouslyDead: boolean;
  /**
   * N.O.V.A. 타격 선택기 적용 unit 표시 — PR7-C.
   * SimulateOptions.novaStrikeSelectorUnit (apiName) 와 일치하는 NOVA unit 만 true.
   * carry Aatrox + true 시 cycle 패턴이 global 로 확장 + 모든 적 knockup.
   */
  aatroxNovaStrikeSelector: boolean;
  /**
   * 정령족 (Astronaut) trait Meeps stack — PR7-E.
   * applyAstronautEffects 가 trait 활성 tier 기준 Meeps 변수 (2/3/4/6) 저장.
   * 정령족 unit (Bard/Gnar/Fizz/Rammus/Poppy/Corki/Veigar/IvernMinion) 만 > 0.
   * 사용처:
   *   - 뽀삐 carry: damage × (1 + Meeps × spiritEffectPerStack=0.15)
   *   - 후속 PR (Meeps 챔프별 메커니즘): Bard MeepsPerMeep 등
   */
  astronautMeepsStack: number;
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
   * 별돌보미 우물(Fountain) — 강화 칸 unit 의 max HP 회복 fraction per Fountain_Interval (2초).
   * raw 매핑: `{d7e6d620}` (teamwide 1%) + `{f2840aed}` (별돌보미 추가 2.5%→3% 17.4).
   * 강화 칸 모든 아군 = teamwide, 강화 칸 별돌보미 = teamwide + ownerExtra 합산 (1+3=4% 17.4).
   * 0 = 비활성. main loop tick 마다 fountainTickPeriod 만료 시 heal 발동 (line 5352-5356).
   * sim 통합 sequence C-5a (PR #173).
   */
  fountainHealPctPerTick: number;
  /**
   * 별돌보미 우물(Fountain) — 강화 칸 별돌보미 stacking AD/AP fraction per Fountain_Interval (2초).
   * (3) tier = 0.04, (5) tier = 0.09 (17.4 너프 0.07 → 0.09) — desc `@Fountain_StackingADAP@`.
   * raw `{13a2a786}` (percent points) ÷ 100 으로 fraction 변환 후 set.
   * 매 interval 마다 누적: damage *= (1 + fraction), ap += fraction * 100.
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
   * 쉔(TFT17_Shen) passive — cast 누적 stack.
   * 매 cast 시 +1. 평타 시점에 stack × (BonusDamageOnAttack[★] + DamageHP × maxHp) × (1 + AP/100) 추가.
   * stack < 3: magic damage. stack >= 3: true damage 전환.
   * 0 = passive 미발동 (cast 0회).
   */
  shenPassiveStack: number;
  /**
   * NasusCarry (꽁! / Bonk!) — cast kill 누적 stack (Lint #12 해소).
   * desc: "이 스킬로 적을 처치하면 스킬 피해량이 영구적으로 증가".
   * cast loop 의 markTargetDead 직후 (nasusCarryActive 가드) +1 누적.
   * basic attack kill 은 stack 미증가 (cast 로만 누적 — desc 정합).
   * Read site: applyCarryDamageModifiers 의 bonusPerKill modifier — baseDmg += stack × bonusPerKill[starLevel-1].
   */
  nasusBonkStack: number;
  // PR #147 deprecate: nasusCarryActive 필드 제거됨. selectedCarryAugment 비교로 대체
  // (cast loop bonusPerKill modifier + stack hook 두 read site 모두 갱신됨).
  /**
   * Selected single-carry semantics 일반화 helper (PR #144 foundation, Lint #14).
   * `applyHeroCarryTransforms` 가 "가장 강한 1명" selector 결과 target 에 본 필드 set
   * (해당 carry augment 의 apiName 저장). non-selected 카피는 null.
   *
   * **사용**: `getAbilityConfigForUnit` 에서 selected 확인 후 carry abilityOverride 반환,
   * 아니면 raw `CHAMPION_ABILITY_PATTERNS` fallback. carry-specific cast loop hook /
   * helper 에서도 동일 가드 가능.
   *
   * **xxxCarryActive 와의 관계**: 기존 boolean flag (jax/nasus/leona/gragas) 는 legacy.
   * 신규 가드는 `selectedCarryAugment === '<augment_api>'` 사용 권장. 점진 deprecate.
   */
  selectedCarryAugment: string | null;
  // PR #147 deprecate: jaxCarryActive 필드 제거됨. selectedCarryAugment 비교로 대체
  // (selfBuff asGain 분기 main + OOR + Jax damage 분기 main + OOR 4 read site 갱신됨).
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
  | { type: 'tool'; toolKind: 'remove-all' | 'nova-selector' };

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
