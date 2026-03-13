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

export interface PlacedChampion {
  champion: RawChampion;
  position: HexCoord;
  starLevel: number; // 1, 2, 3
  items: RawItem[];
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

export type StatusEffectType = 'stun' | 'slow' | 'burn' | 'shield' | 'invulnerable' | 'disarm' | 'taunt';

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
  statusEffects: StatusEffect[];
  omnivamp: number;
  shield: number;
}

export interface CombatLog {
  tick: number;
  time: number;
  type: 'attack' | 'ability' | 'move' | 'death' | 'mana';
  sourceId: string;
  targetId?: string;
  value?: number;
  message: string;
}

export interface CombatResult {
  winner: 'player' | 'enemy' | 'draw';
  duration: number;
  logs: CombatLog[];
  playerUnits: CombatUnit[];
  enemyUnits: CombatUnit[];
  snapshots: TickSnapshot[];
}

export interface TickSnapshot {
  tick: number;
  units: Record<string, {
    id: string;
    currentHp: number;
    currentMana: number;
    position: HexCoord;
    isAlive: boolean;
    statusEffects: { type: string; remainingTicks: number; value?: number }[];
  }>;
  events: CombatLog[];
}

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
  | { type: 'item'; item: RawItem };

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
