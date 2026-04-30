import {
  CombatUnit, CombatResult, CombatLog, PlacedChampion,
  HexCoord, HexBuff, TickSnapshot, mapGameRole,
  RawTrait, RawAugment, RawItem, RawChampion, ActiveTrait, ItemEffect,
  MF_MODE_CONFIG, ArbiterLaw, STAR_SCALING,
} from '@/types';
import arbiterLawsData from '../../../../public/data/arbiter_laws.json';
import { findCarryAugment } from '@/data/carryAugments';
import type { StatusEffectType } from '@/types';
import { calculateStats, getItemEffects } from '@/lib/simulator/systems/stat';
import { getAbilityDamage, getAbilityShield, findAbilityTargets, CHAMPION_ABILITY_PATTERNS, getChampionScaling, starValue, getSynergyScaling } from '@/lib/simulator/systems/ability';
import type { AbilityConfig } from '@/lib/simulator/systems/ability';
import { canAttack, getMoveTicks, findBestMoveToward, coordKey, getNeighbors, hexDistance } from '@/lib/simulator/systems/movement';
import { getHexesInRadius } from '@/lib/simulator/models/hex';
import { TICK_DURATION, MAX_TICKS, TICKS_PER_SECOND, CAST_TICKS, SELF_BUFF_CAST_TICKS, INITIAL_ATTACK_DELAY } from '@/lib/simulator/models/constants';
import { createRNG, SeededRNG } from '@/lib/simulator/engine/rng';
import { captureSnapshot } from '@/lib/simulator/engine/replayEngine';
import { findTarget } from '@/lib/simulator/systems/targeting';
import { gainManaOnAttack, gainManaPerTick, gainManaOnDamageTaken } from '@/lib/simulator/systems/mana';
import { EventBus } from '@/lib/simulator/events/eventBus';
import { ItemEffectRuntime } from '@/lib/simulator/systems/items';
import type { ActionDeps, DamageType } from '@/lib/simulator/systems/items';
import { ROLE_OMNIVAMP, getFighterASBonus } from '@/lib/simulator/models/unit';
import { resolveTraits, getEmblemTraitNames } from '@/lib/simulator/systems/trait';
import { CONSTELLATION_TILE_PATTERN } from '@/lib/actualData/stargazerMapping';
import type { StargazerConstellationId } from '@/lib/actualData/types';
import { isAutoUnit } from '@/data/specialUnits';

/**
 * unit 의 trait 멤버십 검사 헬퍼. champion.traits 직접 조회는 emblem 으로 부여된
 * trait 를 누락 — `resolvedTraits` 가 항상 createCombatUnit 시점에 emblem 까지
 * 합산해 둔 진짜 멤버십 list. fallback 은 champion.traits (resolvedTraits 미설정
 * 시 기본 traits 와 동일).
 */
function unitHasTrait(u: CombatUnit, traitName: string): boolean {
  return (u.resolvedTraits ?? u.champion.traits).includes(traitName);
}

/**
 * PlacedChampion (createCombatUnit 전 시점) 의 trait 멤버십 — champion.traits +
 * emblem 합산. unit 생성 후엔 unitHasTrait 사용.
 */
function placedHasTrait(p: PlacedChampion, traitName: string): boolean {
  if (p.champion.traits.includes(traitName)) return true;
  return getEmblemTraitNames(p.items).includes(traitName);
}
import { resolveAugmentEffects, resolveInCombatAugmentEffects, resolvePerUnitMods, applyPerUnitMods, AugmentWithStacks } from '@/lib/simulator/systems/augment';
import type { IoniaPathType } from '@/data/traitModules';
import { computeSpellCanCrit } from '@/lib/combat/spellCrit';

/** 상태이상 한글 레이블 (엔진 로그용 — UI 모듈에 의존하지 않음) */
const STATUS_EFFECT_LABELS: Record<StatusEffectType, string> = {
  stun: '기절',
  slow: '둔화',
  burn: '화상',
  disarm: '무장해제',
  taunt: '도발',
  shield: '보호막',
  invulnerable: '무적',
  mark: '표식',
  poison: '중독',
};

function mergeEffects(a: ItemEffect, b: ItemEffect): ItemEffect {
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (typeof value === 'number') {
      (result as Record<string, number>)[key] = ((result as Record<string, number>)[key] || 0) + value;
    }
  }
  return result;
}

export interface SimulateOptions {
  seed?: number;
  allTraits?: RawTrait[];
  playerAugments?: RawAugment[];
  enemyAugments?: RawAugment[];
  playerAugmentStacks?: Record<string, number>;
  enemyAugmentStacks?: Record<string, number>;
  /** When true, enemy positions are used as-is (no mirror). Use when positions are already in 8-row space. */
  skipMirror?: boolean;
  /** Pre-resolved bilgewater stat effects per team (from resolveBilgewaterStatEffects) */
  playerBilgewaterEffects?: ItemEffect;
  enemyBilgewaterEffects?: ItemEffect;
  /** 필트오버 팀 모듈 (팀 슬롯에서 선택한 모듈 아이템 배열) */
  playerPiltoverModules?: RawItem[];
  enemyPiltoverModules?: RawItem[];
  /** 아이오니아 선택된 길 */
  playerIoniaPath?: IoniaPathType;
  enemyIoniaPath?: IoniaPathType;
  /** 대기석 갈리오 (데마시아 결집 시 소환) */
  playerGalio?: { champion: RawChampion; starLevel: number } | null;
  enemyGalio?: { champion: RawChampion; starLevel: number } | null;
  /** 칸 버프 증강 */
  playerHexBuffs?: HexBuff[];
  enemyHexBuffs?: HexBuff[];
  /** 현재 스테이지 번호 (전사 AS 패시브, 기본값 4) */
  stageNumber?: number;
  /** 중재자 법률 */
  playerArbiterLaw?: ArbiterLaw;
  enemyArbiterLaw?: ArbiterLaw;
  /**
   * A 팀(player) 별자리. 미지정 시 base trait 활성, 변종 effect 미적용.
   * 게임 룰 상 한 게임 1 별자리지만 시뮬에서는 분석 편의로 팀별 독립.
   */
  playerStargazerConstellation?: StargazerConstellationId;
  /** B 팀(enemy) 별자리. 의미는 player 와 동일. */
  enemyStargazerConstellation?: StargazerConstellationId;
  /**
   * 별돌보미 제단(Shield) — 게임-level 누적 사망 카운트 (player 측 기준).
   * 시뮬은 단일 전투지만 NumDeaths(=60) 도달 여부는 게임 진행 누적이라
   * 외부에서 미리 입력 받음. 시뮬 안에서 누적되는 사망 + priorShieldDeaths
   * 합산 ≥ NumDeaths 시 cashout buff 발동. 미지정 시 0.
   */
  priorPlayerShieldDeaths?: number;
  /** B 팀(enemy) 누적 사망 카운트. 의미는 player 와 동일. */
  priorEnemyShieldDeaths?: number;
  /**
   * 최신상 (TFT17_GravesTrait) Frame 선택 — A 팀(player) 의 가장 강한 그레이브즈 1명에 적용.
   * 'CloseQuarters' (맹공): 사거리 -2, 공격력 전사 변환, +HP 250, +AD 25%, +흡혈 10%
   * 'SharpshooterModule' (위력): 정밀 (spellCanCrit) + 스킬 피해 5% 증가
   * 'DoubleTap' (사수): 25% 확률 2회 공격
   * 미지정 시 Frame 미적용. 하위 업그레이드 (Buckshot 등) 는 후속 PR.
   */
  playerGravesFrame?: 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap';
  /** B 팀(enemy) 그레이브즈 Frame. 의미는 player 와 동일. */
  enemyGravesFrame?: 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap';
  /**
   * 최신상 무기고 stat upgrade 활성 ID 목록 (suffix only, prefix 'TFT17_GravesTrait_Offense_' 제외).
   * A 팀(player) 의 가장 강한 그레이브즈 1명에 적용. 예:
   *   ['LeechingImplants', 'HeavyPlating', 'PrecisionScope2', 'Heartseeker']
   * Phase 2 단순 stat upgrade 18종만 처리. 메커닉 필요 항목 (RevUp 등) 은 후속.
   */
  playerGravesUpgrades?: string[];
  /** B 팀(enemy) 그레이브즈 stat upgrade. 의미는 player 와 동일. */
  enemyGravesUpgrades?: string[];
}

function createCombatUnit(
  placed: PlacedChampion,
  team: 'player' | 'enemy',
  index: number,
  activeTraits: ActiveTrait[] = [],
  augmentEffects: ItemEffect = {},
): CombatUnit {
  const allItems = placed.voidItem ? [...placed.items, placed.voidItem] : placed.items;
  const { stats } = calculateStats(placed.champion, placed.starLevel, allItems, activeTraits, augmentEffects);
  // 아이템 기반 omnivamp / manaRegen — ItemEffect 확장 (Set 17 StatOmnivamp / ManaRegen)
  const itemFx = getItemEffects(allItems);
  const role = mapGameRole(placed.champion.role);
  const unit: CombatUnit = {
    id: `${team}-${index}`,
    champion: placed.champion,
    team,
    position: { ...placed.position },
    starLevel: placed.starLevel as 1 | 2 | 3,
    role,
    items: allItems,
    currentHp: stats.hp,
    maxHp: stats.hp,
    currentMana: stats.mana,
    maxMana: stats.maxMana,
    state: 'idle',
    target: null,
    stats,
    attackCooldown: 0,
    moveCooldown: 0,
    totalDamageDealt: 0,
    itemDamageDealt: 0,
    totalDamageTaken: 0,
    statusEffects: [],
    omnivamp: ROLE_OMNIVAMP[role] + (itemFx.omnivamp ?? 0),
    damageAmp: 0,
    damageReduction: 0,
    shield: 0,
    augmentManaRegen: itemFx.manaRegen ?? 0,
    augmentGrievousWounds: 0,
    augmentExecuteThreshold: 0,
    augmentBurnPercent: 0,
    inventionTankDamageAmp: 0,
    healAmp: itemFx.healAmp ?? 0,
    darkStarExecuteThreshold: 0,
    darkStarSupermassive: false,
    gravesFrame: null,
    gravesDoubleAttackChance: 0,
    gravesAbilityDamageBonus: 0,
    gravesUpgrades: [],
    gravesTankDamageAmp: 0,
    gravesNanoRegenPct: 0,
    gravesRipperReduce: 0,
    gravesEmergencyTriggerHpFrac: 0,
    gravesEmergencyShieldFrac: 0,
    gravesEmergencyDurationSec: 0,
    gravesEmergencyUsed: false,
    gravesShockwaveActive: false,
    gravesReactivePerStack: 0,
    gravesReactiveStackCount: 0,
    gravesTripleAttackChance: 0,
    gravesRevUpPerStack: 0,
    gravesRevUpMaxBonus: 0,
    gravesRevUpStickyTargetId: null,
    gravesRevUpStackCount: 0,
    gravesGravBoosterBonusAS: 0,
    gravesGravBoosterMaxAttacks: 0,
    gravesGravBoosterAttacksRemaining: 0,
    gravesLatentStoredPct: 0,
    gravesLatentStored: 0,
    gravesBuckshotProjectiles: 0,
    gravesBuckshotSpread: 0,
    gravesLaserPenetrationHexes: 0,
    gravesLaserDmgReductionPerTarget: 0,
    gravesFragDamage: 0,
    gravesFragProjectiles: 0,
    gravesMeltthroughArmorMR: 0,
    gravesBlastIncreasedRadius: 0,
    gravesBlastDmgReductionPerHex: 0,
    gravesSympatheticReduction: 0,
    gravesVoidCoefficientPct: 0,
    gravesChokeSpreadDecrease: 0,
    gravesAimAssistBonusPerHex: 0,
    partyHealRate: 0,
    partyHpThreshold: 0,
    partyUsed: false,
    partyHealing: false,
    mfReplicatorEffectiveness: 0,
    gragasCarryActive: false,
    leonaCarryActive: false,
    attackCount: 0,
    castCount: 0,
    killCount: 0,
    spellCanCrit: computeSpellCanCrit(allItems, activeTraits),
    stargazerFountainHealPercent: 0,
    fountainHealPctPerTick: 0,
    fountainStackingAdapPerTick: 0,
    stargazerHuntressHealPercent: 0,
    stargazerSerpentPoisonPercent: 0,
    stargazerSerpentDurationSec: 0,
    stargazerShieldCashoutHpFrac: 0,
    stargazerShieldCashoutAsFrac: 0,
    bastionDoubleEndTick: 0,
    bastionDoubleArmorBonus: 0,
    bastionDoubleMrBonus: 0,
    sniperBaseDA: 0,
    sniperPerHexDA: 0,
  };

  // MF 특성 선택 → 실제 트레이트로 치환 + emblem 으로 부여된 trait 합산.
  // resolvedTraits 가 unit 의 진짜 trait 멤버십 — combat-time 효과 (시너지 per-unit
  // bonus / arbiter law) 가 emblem 보유 unit 도 일관되게 인식하도록 한다.
  const emblemTraits = getEmblemTraitNames(allItems);
  let baseTraits = placed.champion.traits;
  if (placed.champion.apiName === 'TFT17_MissFortune' && placed.mfMode) {
    const modeCfg = MF_MODE_CONFIG[placed.mfMode];
    baseTraits = baseTraits.map(t => t === '특성 선택' ? modeCfg.name : t);
  }
  if (emblemTraits.length > 0 || baseTraits !== placed.champion.traits) {
    // dedup — 동일 trait 가 champion 에 이미 있으면 emblem 으로 재추가하지 않음
    const merged = [...baseTraits];
    for (const t of emblemTraits) {
      if (!merged.includes(t)) merged.push(t);
    }
    unit.resolvedTraits = merged;
  }

  // 공허 돌연변이 전투 효과 적용
  for (const item of allItems) {
    if (!item.apiName.includes('Consumable_Void')) continue;
    const fx = item.effects;
    // 아드레날린 모듈: 피해증폭
    if (typeof fx['BaseDamageAmp'] === 'number') {
      unit.damageAmp += fx['BaseDamageAmp'] as number;
    }
    // 흡수 세포핵: 옴니뱀프 (피해량의 N% 체력 회복)
    if (typeof fx['HealPercent'] === 'number') {
      unit.omnivamp += fx['HealPercent'] as number;
    }
  }

  return unit;
}

/** 영구 스택 적용 (이즈리얼 드론, 초가스 체력) */
function applyPermanentStacks(unit: CombatUnit, placed: PlacedChampion): void {
  const stacks = placed.permanentStacks;
  if (!stacks || stacks.value <= 0) return;

  if (stacks.type === 'chogath_hp') {
    unit.maxHp += stacks.value;
    unit.currentHp += stacks.value;
  }
  // ezreal_drones: 전투 루프 내 스킬 시전 시 추가 피해로 처리
  // 드론 수는 unit에 임시 저장
  if (stacks.type === 'ezreal_drones') {
    const drones = Math.floor(stacks.value / 8);
    (unit as CombatUnit & { _ezrealDrones?: number })._ezrealDrones = drones;
  }
}

/** 전투 시작 패시브 적용 (진 AS→AD 등) */
function applyStartPassives(unit: CombatUnit): void {
  const sc = getChampionScaling(unit.champion.apiName);
  if (!sc || sc.trigger !== 'passive') return;

  // 진: AS → AD 전환
  if (sc.effect.type === 'asToAd') {
    const fixedAS = starValue(sc.fixedAS as number[], unit.starLevel);
    const convertRate = (sc.convertRate as number) ?? 0.75;
    const bonusAS = unit.stats.attackSpeed - fixedAS;
    if (bonusAS > 0 && fixedAS > 0) {
      unit.stats.damage += Math.round(bonusAS * 100 * convertRate);
      unit.stats.attackSpeed = fixedAS;
    }
  }
}

/** Set 17 시너지 전투 버프 적용 (JSON scaling 데이터 기반) */
function applySet17SynergyBuffs(traits: ActiveTrait[], units: CombatUnit[]): void {
  for (const at of traits) {
    if (!at.activeEffect || at.style === 0) continue;
    const sc = getSynergyScaling(at.trait.apiName);
    if (!sc) continue;

    // 활성 티어 인덱스 (effects 배열에서 몇 번째)
    const tierIdx = at.trait.effects.findIndex(e => e === at.activeEffect);
    const ti = Math.max(0, tierIdx);

    const isChampTrait = (u: CombatUnit) => unitHasTrait(u, at.trait.name);

    // 도전자: 아군 AS + 도전자 추가 AS
    if (sc.teamwideAS) {
      const teamAS = (sc.teamwideAS as number[])[ti] ?? 0;
      const champAS = (sc.championAS as number[])[ti] ?? 0;
      for (const u of units) {
        u.stats.attackSpeed *= (1 + teamAS);
        if (isChampTrait(u)) u.stats.attackSpeed *= (1 + champAS);
      }
    }

    // 습격자: 흡혈 + AD
    if (sc.teamwideOmnivamp) {
      const teamVamp = (sc.teamwideOmnivamp as number[])[ti] ?? 0;
      const champVamp = (sc.championOmnivamp as number[])[ti] ?? 0;
      const champAD = (sc.championAD as number[])[ti] ?? 0;
      for (const u of units) {
        u.omnivamp += teamVamp;
        if (isChampTrait(u)) {
          u.omnivamp += champVamp;
          u.stats.damage = Math.round(u.stats.damage * (1 + champAD));
        }
      }
    }

    // 전달자: 마나 재생
    if (sc.teamManaRegen) {
      const teamMR = (sc.teamManaRegen as number[])[ti] ?? 0;
      const champMR = (sc.channelerManaRegen as number[])[ti] ?? 0;
      for (const u of units) {
        u.augmentManaRegen += teamMR;
        if (isChampTrait(u)) u.augmentManaRegen += champMR;
      }
    }

    // 구원자: 활성 특성당 AS/방어력/마저
    if (sc.offensiveStat) {
      const activeTraitCount = traits.filter(t => t.style > 0).length;
      const asPerTrait = (sc.offensiveStat as number[])[ti] ?? 0;
      const defPerTrait = (sc.defensiveStat as number[])[ti] ?? 0;
      for (const u of units) {
        u.stats.attackSpeed *= (1 + asPerTrait * activeTraitCount);
        u.stats.armor += defPerTrait * activeTraitCount;
        u.stats.magicResist += defPerTrait * activeTraitCount;
      }
    }

    // 불한당: AD/AP 획득
    if (sc.adap) {
      const adap = (sc.adap as number[])[ti] ?? 0;
      for (const u of units) {
        if (isChampTrait(u)) {
          u.stats.damage = Math.round(u.stats.damage * (1 + adap / 100));
          u.stats.ap += adap;
        }
      }
    }
  }
}

/** 캐리 증강 사거리 오버라이드 */
function applyCarryAugmentRange(unit: CombatUnit, augmentApiNames: string[]): void {
  const carry = findCarryAugment(unit.champion.apiName, augmentApiNames);
  if (carry?.rangeOverride) {
    unit.stats.range = carry.rangeOverride;
  }
}

/** 칸 버프 증강 효과 적용 (전투 시작 시 유닛 위치 기반) */
function applyHexBuffs(units: CombatUnit[], hexBuffs: HexBuff[]): void {
  for (const buff of hexBuffs) {
    if (buff.positions.length === 0) continue;
    for (const unit of units) {
      const onBuff = buff.positions.some(
        p => p.q === unit.position.q && p.r === unit.position.r
      );
      if (!onBuff) continue;

      if (buff.effects.hp) {
        unit.maxHp += buff.effects.hp;
        unit.currentHp += buff.effects.hp;
        unit.stats.hp += buff.effects.hp;
      }
      if (buff.effects.hpPercent) {
        const bonus = Math.round(unit.maxHp * buff.effects.hpPercent);
        unit.maxHp += bonus;
        unit.currentHp += bonus;
        unit.stats.hp += bonus;
      }
      if (buff.effects.attackSpeed) {
        unit.stats.attackSpeed *= (1 + buff.effects.attackSpeed);
      }
      if (buff.effects.damageAmp) {
        unit.damageAmp += buff.effects.damageAmp;
      }
      if (buff.effects.armor) {
        unit.stats.armor += buff.effects.armor;
      }
      if (buff.effects.magicResist) {
        unit.stats.magicResist += buff.effects.magicResist;
      }
      if (buff.effects.ap) {
        unit.stats.ap += buff.effects.ap;
      }
      if (buff.effects.ad) {
        unit.stats.damage += buff.effects.ad;
      }
    }
  }
}

/**
 * 자폭 (TFT17_Augment_GragasCarry) ability 변환 config.
 * 거대한 폭발: 적군 데미지 없음, 자기 자신만 데미지 + HP floor=1 (자기 스킬로 죽지 않음).
 * damage 값은 그라가스 ability "Damage" 변수 그대로 (heal 제거).
 */
const GRAGAS_CARRY_ABILITY: AbilityConfig = {
  pattern: 'aoe_circle',
  radius: 0,
  selfDamage: true,
  selfDamageHpFloor: 1,
};

/**
 * 방패 여전사 (TFT17_Augment_LeonaCarry) ability 변환 config.
 * 적 가로질러 dash + line 관통 물리 피해 + 첫 적중 대상에만 기절 (CC).
 */
const LEONA_CARRY_ABILITY: AbilityConfig = {
  pattern: 'line',
  maxTargets: 4,
  dash: 'to_target',
  stun: 1.5,
  firstHitOnlyStun: true,
};

/** 캐리 증강 포함 AbilityConfig 결정 */
function getAbilityConfigForUnit(unit: CombatUnit, augmentApiNames: string[]): AbilityConfig {
  // hero augment carry 변환 — applyHeroCarryTransforms 가 활성 unit 에 flag 설정.
  if (unit.gragasCarryActive) return GRAGAS_CARRY_ABILITY;
  if (unit.leonaCarryActive) return LEONA_CARRY_ABILITY;
  const carry = findCarryAugment(unit.champion.apiName, augmentApiNames);
  if (carry) return carry.abilityOverride;
  return CHAMPION_ABILITY_PATTERNS[unit.champion.apiName] ?? { pattern: 'single' };
}

/** 대쉬 대상 헬퍼: 가장 먼 적 */
function findFarthestEnemy(unit: CombatUnit, enemies: CombatUnit[]): CombatUnit {
  let farthest = enemies[0];
  let maxDist = 0;
  for (const e of enemies) {
    const d = hexDistance(unit.position, e.position);
    if (d > maxDist) { maxDist = d; farthest = e; }
  }
  return farthest;
}

/** 대쉬 대상 헬퍼: 체력 가장 낮은 적 */
function findLowestHpEnemy(enemies: CombatUnit[]): CombatUnit {
  let lowest = enemies[0];
  for (const e of enemies) {
    if (e.currentHp < lowest.currentHp) lowest = e;
  }
  return lowest;
}

/** 대쉬 대상 헬퍼: 탱커/전사 아닌 가장 먼 적 (피즈) */
function findBacklineEnemy(unit: CombatUnit, enemies: CombatUnit[]): CombatUnit {
  const backline = enemies.filter(e => e.role !== 'Tank' && e.role !== 'Fighter');
  if (backline.length === 0) return findFarthestEnemy(unit, enemies);
  return findFarthestEnemy(unit, backline);
}

/** 스킬 시전 시 대쉬 이동 — 대상 인접 빈 칸으로 이동 */
function applyAbilityDash(
  unit: CombatUnit,
  dashType: 'to_target' | 'to_farthest' | 'to_lowest_hp' | 'to_backline',
  currentTarget: CombatUnit,
  enemyTeam: CombatUnit[],
  occupiedPositions: Set<string>,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  tick: number,
  time: number,
): CombatUnit {
  const aliveEnemies = enemyTeam.filter(e => e.state !== 'dead');
  if (aliveEnemies.length === 0) return currentTarget;

  let dashTarget: CombatUnit;
  switch (dashType) {
    case 'to_target': dashTarget = currentTarget; break;
    case 'to_farthest': dashTarget = findFarthestEnemy(unit, aliveEnemies); break;
    case 'to_lowest_hp': dashTarget = findLowestHpEnemy(aliveEnemies); break;
    case 'to_backline': dashTarget = findBacklineEnemy(unit, aliveEnemies); break;
  }

  const neighbors = getNeighbors(dashTarget.position);
  const freeNeighbors = neighbors.filter(n => !occupiedPositions.has(coordKey(n)));
  if (freeNeighbors.length === 0) return dashTarget;

  let bestHex = freeNeighbors[0];
  let bestDist = Infinity;
  for (const hex of freeNeighbors) {
    const dist = hexDistance(hex, dashTarget.position);
    if (dist < bestDist) { bestDist = dist; bestHex = hex; }
  }

  occupiedPositions.delete(coordKey(unit.position));
  unit.position = bestHex;
  occupiedPositions.add(coordKey(bestHex));
  unit.target = dashTarget.id;

  const log: CombatLog = {
    tick, time, type: 'move',
    sourceId: unit.id, targetId: dashTarget.id,
    message: `${unit.champion.name}이(가) ${dashTarget.champion.name}에게 돌진!`,
  };
  logs.push(log);
  tickLogs.push(log);

  return dashTarget;
}

/** 아이오니아 선택된 길의 능력치를 아이오니아 유닛에 적용 */
function applyIoniaPath(
  activeTraits: ActiveTrait[],
  teamUnits: CombatUnit[],
  pathType: IoniaPathType,
  logs: CombatLog[],
): void {
  const ionia = activeTraits.find(t => t.trait.apiName === 'TFT16_Ionia' && t.activeEffect);
  if (!ionia || !ionia.activeEffect) return;
  const vars = ionia.activeEffect.variables;

  const ioniaUnits = teamUnits.filter(u =>
    u.state !== 'dead' && unitHasTrait(u, '아이오니아')
  );
  if (ioniaUnits.length === 0) return;

  const pathNames: Record<IoniaPathType, string> = {
    blades: '검의 길', enlightenment: '깨달음의 길',
    transcendence: '초월의 길', generosity: '번영의 길', spirit: '영혼의 길',
  };

  switch (pathType) {
    case 'blades': {
      const chance = ((vars['BladesPercentChance'] ?? 30) as number) / 100;
      for (const u of ioniaUnits) {
        (u as CombatUnit & { ioniaBladeChance?: number }).ioniaBladeChance = chance;
      }
      break;
    }
    case 'enlightenment': {
      const adap = (vars['EnlightenmentADAP'] ?? 10) as number;
      for (const u of ioniaUnits) {
        u.stats.damage += adap;
        u.stats.ap += adap;
      }
      break;
    }
    case 'transcendence': {
      const hpPct = (vars['TranscendenceHealth'] ?? 0.10) as number;
      const magicAmp = (vars['TranscendenceMagicDamage'] ?? 0.20) as number;
      for (const u of ioniaUnits) {
        const hpGain = Math.round(u.maxHp * hpPct);
        u.maxHp += hpGain;
        u.currentHp += hpGain;
        u.damageAmp += magicAmp;
      }
      break;
    }
    case 'generosity': {
      const adap = (vars['GenerosityADAP'] ?? 10) as number;
      for (const u of ioniaUnits) {
        u.stats.damage += adap;
        u.stats.ap += adap;
      }
      break;
    }
    case 'spirit': {
      const adap = (vars['SpiritADAP'] ?? 3) as number;
      const hpPct = (vars['SpiritHealth'] ?? 0.25) as number;
      for (const u of ioniaUnits) {
        u.stats.damage += adap;
        u.stats.ap += adap;
        const hpGain = Math.round(u.maxHp * hpPct);
        u.maxHp += hpGain;
        u.currentHp += hpGain;
      }
      break;
    }
  }

  const sourceId = ioniaUnits[0].id;
  const log: CombatLog = {
    tick: 0, time: 0, type: 'ability', sourceId,
    message: `[아이오니아] ${pathNames[pathType]} 적용!`,
  };
  logs.push(log);
}

/** Fighter/Assassin 비타겟 피해 감소 비율 */
const NON_TARGET_DAMAGE_REDUCTION = 0.15;


function applyResistance(damage: number, resistance: number, penetration: number = 0): number {
  const effective = resistance * (1 - Math.min(penetration, 1));
  return damage * 100 / (100 + Math.max(0, effective));
}

function applyShield(unit: CombatUnit, damage: number, eventBus: EventBus, tick: number): number {
  if (unit.shield <= 0) return damage;
  const absorbed = Math.min(unit.shield, damage);
  unit.shield -= absorbed;
  const remaining = damage - absorbed;
  if (unit.shield <= 0) {
    unit.shield = 0;
    unit.statusEffects = unit.statusEffects.filter(e => e.type !== 'shield');
    eventBus.emit('on_shield_break', { sourceId: unit.id, tick });
  }
  return remaining;
}

/** Warden 시너지 전투 시작 시 보호막 부여 (최대 체력의 PercentHealthShield%) */
function applyWardenShields(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const warden = activeTraits.find(t => t.trait.apiName === 'TFT16_Warden' && t.activeEffect);
  if (!warden?.activeEffect) return;
  const shieldPct = (warden.activeEffect.variables['PercentHealthShield'] ?? 0) as number;
  if (shieldPct <= 0) return;
  for (const u of units) {
    const shieldAmount = u.maxHp * shieldPct;
    u.shield += shieldAmount;
    u.statusEffects.push({ type: 'shield', sourceId: 'warden', remainingTicks: 9999, value: shieldAmount });
  }
}

/** 엄호대 — BonusArmorMR은 엄호대 유닛만 추가 (armor + MR) */
function applyDefenderBonus(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const defender = activeTraits.find(t => t.trait.apiName === 'TFT16_Defender' && t.activeEffect);
  if (!defender?.activeEffect) return;
  const bonus = (defender.activeEffect.variables['BonusArmorMR'] ?? 0) as number;
  if (bonus <= 0) return;
  for (const u of units) {
    if (unitHasTrait(u, '엄호대')) {
      u.stats.armor += bonus;
      u.stats.magicResist += bonus;
    }
  }
}

/** 비전 마법사 — BonusAP는 비전 마법사 유닛에게만 추가 */
function applySorcererBonus(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const sorc = activeTraits.find(t => t.trait.apiName === 'TFT16_Sorcerer' && t.activeEffect);
  if (!sorc?.activeEffect) return;
  const bonusAP = (sorc.activeEffect.variables['BonusAP'] ?? 0) as number;
  if (bonusAP <= 0) return;
  for (const u of units) {
    if (unitHasTrait(u, '비전 마법사')) {
      u.stats.ap += bonusAP;
    }
  }
}

/** 기원자 — 팀 전체 마나 재생 보너스 */
function applyInvokerManaRegen(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const invoker = activeTraits.find(t => t.trait.apiName === 'TFT16_Invoker' && t.activeEffect);
  if (!invoker?.activeEffect) return;
  const teamMana = (invoker.activeEffect.variables['TeamBonusMana'] ?? 0) as number;
  if (teamMana <= 0) return;
  for (const u of units) {
    u.augmentManaRegen += teamMana;
  }
}

/** 보루 (쉔) — 유물 인접 아군에게 보호막 + 공격 속도 부여. TFT17_ShenUniqueTrait, unique=1 */
function applyShenBastionAura(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const bastion = activeTraits.find(t => t.trait.apiName === 'TFT17_ShenUniqueTrait' && t.activeEffect);
  if (!bastion?.activeEffect) return;
  const shieldPct = (bastion.activeEffect.variables['PercentHealthShield'] ?? 0.15) as number;
  const asPct = (bastion.activeEffect.variables['AttackSpeed'] ?? 0.25) as number;
  const artifact = units.find(u => u.champion.apiName === 'TFT17_ShenProp');
  if (!artifact) return;
  for (const u of units) {
    if (u.id === artifact.id) continue;
    if (hexDistance(u.position, artifact.position) > 1) continue;
    const shieldAmount = u.maxHp * shieldPct;
    u.shield += shieldAmount;
    u.statusEffects.push({ type: 'shield', sourceId: 'shen-artifact', remainingTicks: 9999, value: shieldAmount });
    if (asPct > 0) u.stats.attackSpeed *= (1 + asPct);
  }
}

/** 말살자 (진) — 적 전체 방어력/마법 저항력 감소. TFT17_JhinUniqueTrait, unique=1 */
function applyJhinAnnihilator(activeTraits: ActiveTrait[], enemies: CombatUnit[]): void {
  const annih = activeTraits.find(t => t.trait.apiName === 'TFT17_JhinUniqueTrait' && t.activeEffect);
  if (!annih?.activeEffect) return;
  const reductionPct = (annih.activeEffect.variables['PctResists'] ?? 0.15) as number;
  if (reductionPct <= 0) return;
  for (const e of enemies) {
    e.stats.armor *= (1 - reductionPct);
    e.stats.magicResist *= (1 - reductionPct);
  }
}

/**
 * 파멸자 (벡스) — TFT17_VexUniqueTrait. 전투 시작 시 모든 적 표식 → 첫 hit 시 ADAP1% 강탈.
 *
 * raw: ADAP1=12 (12%).
 * 시뮬 단순화: combat-start 시 즉시 일괄 적용 (적이 모두 hit 받게 됨 가정 — 표식 메커니즘 생략).
 * 모든 적 (damage + ap) × 0.12 합산 → 가장 강한 Vex 1명에게 가산 + 적 stat 차감.
 */
function applyVexDoom(activeTraits: ActiveTrait[], ownTeam: CombatUnit[], enemies: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_VexUniqueTrait' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const stealPct = ((trait.activeEffect.variables['ADAP1'] ?? 12) as number) / 100;
  if (stealPct <= 0) return;
  const vex = findStrongestUnitByApi(ownTeam, 'TFT17_Vex');
  if (!vex) return;
  let stolenAd = 0;
  let stolenAp = 0;
  for (const e of enemies) {
    if (e.state === 'dead') continue;
    const adSteal = e.stats.damage * stealPct;
    const apSteal = e.stats.ap * stealPct;
    e.stats.damage = Math.max(0, e.stats.damage - adSteal);
    e.stats.ap = Math.max(0, e.stats.ap - apSteal);
    stolenAd += adSteal;
    stolenAp += apSteal;
  }
  vex.stats.damage += stolenAd;
  vex.stats.ap += stolenAp;
}

/**
 * 은하계 사냥꾼 (제드) — TFT17_ZedUniqueTrait. 분신 살아있는 동안 +BonusAD%.
 *
 * raw: BonusAD=0.40 (40%).
 * 시뮬 단순화: 시뮬에 분신 unit 메커니즘 없음 → combat-start 시 Zed 에 +40% AD 즉시 가산
 * (분신 항상 alive 가정). Zed 의 self_buff ability 가 분신 소환이지만 시뮬에선 stat-only.
 */
function applyZedShadow(activeTraits: ActiveTrait[], ownTeam: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_ZedUniqueTrait' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const bonusAd = (trait.activeEffect.variables['BonusAD'] ?? 0.40) as number;
  if (bonusAd <= 0) return;
  for (const u of ownTeam) {
    if (u.champion.apiName === 'TFT17_Zed') {
      u.stats.damage = Math.round(u.stats.damage * (1 + bonusAd));
    }
  }
}

/**
 * 파티광 (블리츠크랭크) — TFT17_BlitzcrankUniqueTrait. 전투당 1회 트리거.
 * raw: HealthThreshold=0.45, PercentHealthHeal=0.15.
 *
 * combat-start 시 Blitzcrank 에 partyHealRate / partyHpThreshold 설정.
 * main loop tick 마다 HP < threshold 도달 시 invulnerable + heal mode 활성.
 * HP 100% 도달 시 heal mode 종료. 후속 SpaceGroove + 번개 4배 효과는 미구현.
 */
function applyPartyTrickster(activeTraits: ActiveTrait[], ownTeam: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_BlitzcrankUniqueTrait' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const threshold = (trait.activeEffect.variables['HealthThreshold'] ?? 0.45) as number;
  const healRate = (trait.activeEffect.variables['PercentHealthHeal'] ?? 0.15) as number;
  if (threshold <= 0 || healRate <= 0) return;
  for (const u of ownTeam) {
    if (u.champion.apiName === 'TFT17_Blitzcrank') {
      u.partyHpThreshold = threshold;
      u.partyHealRate = healRate;
    }
  }
}

/**
 * 복제자 (MF) — TFT17_APTrait. minUnits=2 / 4 두 tier.
 * raw: Effectiveness=0.22 (2-3) / 0.45 (4+).
 *
 * MF replicator mode 한정 — 스킬 cast 시 ability damage × Effectiveness 추가 적용.
 * combat-start 시 mfMode === 'replicator' 인 MF 에만 effectiveness 설정.
 */
function applyReplicatorTrait(activeTraits: ActiveTrait[], ownTeam: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_APTrait' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const effectiveness = (trait.activeEffect.variables['Effectiveness'] ?? 0.22) as number;
  if (effectiveness <= 0) return;
  for (const u of ownTeam) {
    if (u.champion.apiName === 'TFT17_MissFortune') {
      u.mfReplicatorEffectiveness = effectiveness;
    }
  }
}

/**
 * 운명술사 (Fateweaver) — 정밀 (Precision) innate + (4) crit stat.
 *
 * Spec (TFT17_Fateweaver):
 *   - Innate: 운명술사 unit 은 Precision 보유 → ability crit 가능 (trait count 무관)
 *   - (2) chance effects on abilities are Lucky (확률 두 번 굴려 좋은 결과 — 후속 PR)
 *   - (4) Crit Chance +20%, Crit Damage +20% (운명술사 unit 한정)
 *
 * Lucky 메커니즘은 ability rng 처 곳곳 적용 필요 → 별도 PR 로 분리.
 * 본 함수는 Innate Precision + (4) crit stat 만 적용.
 */
function applyFateweaverEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_Fateweaver');
  if (!trait || trait.count === 0) return;

  // Innate: 운명술사 unit 들에 spellCanCrit 활성 (trait 활성 여부 무관, count >= 1 이면).
  // 주의: hasSpellCritItem (보건/무대) 으로 이미 true 인 unit 은 그대로 유지 (idempotent).
  for (const u of units) {
    if (unitHasTrait(u, '운명술사')) {
      u.spellCanCrit = true;
    }
  }

  // (4) tier 활성 시 운명술사 unit 들에 crit stat 가산.
  if (!trait.activeEffect || trait.style === 0) return;
  const critChanceBonus = (trait.activeEffect.variables['CritChance'] ?? 0) as number;
  const critDamageBonusPct = (trait.activeEffect.variables['CritDamage'] ?? 0) as number; // percentage points
  if (critChanceBonus <= 0 && critDamageBonusPct <= 0) return;
  const critDamageBonusFrac = critDamageBonusPct / 100;
  for (const u of units) {
    if (!unitHasTrait(u, '운명술사')) continue;
    if (critChanceBonus > 0) u.stats.critChance += critChanceBonus;
    if (critDamageBonusFrac > 0) u.stats.critMultiplier += critDamageBonusFrac;
  }
}

/** 어둠의 여인 (모르가나) — 아군 스킬 피해량 감소. TFT17_MorganaUniqueTrait, unique=1 */
function applyMorganaDarklight(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_MorganaUniqueTrait' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const reduction = (trait.activeEffect.variables['UntransformedAbilityDA'] ?? 0.10) as number;
  if (reduction <= 0) return;
  for (const u of units) {
    u.damageReduction = Math.min(0.9, (u.damageReduction ?? 0) + reduction);
  }
}

/**
 * 요새 (Bastion/ResistTank) — Teamwide Armor/MR + 요새 unit 추가 + 첫 N초 doubled.
 *
 * Spec (TFT17_ResistTank):
 *   - 모든 아군 +TeamwideResists Armor/MR
 *   - 요새 unit 추가 +BonusArmor / +BonusMR
 *   - 전투 첫 Duration 초간 BonusArmor/MR 가 StatMultiplier 배 (=2)
 *   - (6) tier 시 비-요새 unit 들이 추가 +EnhancedTeamwideArmor Armor/MR
 *
 * Tier 별 BonusArmor/MR: (2) 16 / (4) 40 / (6) 60.
 * Duration 메커니즘: 시작 시 doubled 적용, Duration 후 single 로 복귀 (main loop tick check).
 */
function applyBastionEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_ResistTank');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const v = trait.activeEffect.variables;
  const teamwide = (v.TeamwideResists ?? 0) as number;
  const bonusArmor = (v.BonusArmor ?? 0) as number;
  const bonusMr = (v.BonusMR ?? 0) as number;
  const enhancedTeamwide = (v.EnhancedTeamwideArmor ?? 0) as number;
  const statMultiplier = (v.StatMultiplier ?? 1) as number;
  const durationSec = (v.Duration ?? 0) as number;
  const isHighTier = trait.count >= 6;
  for (const u of units) {
    if (teamwide > 0) {
      u.stats.armor += teamwide;
      u.stats.magicResist += teamwide;
    }
    if (isHighTier && enhancedTeamwide > 0 && !unitHasTrait(u, '요새')) {
      u.stats.armor += enhancedTeamwide;
      u.stats.magicResist += enhancedTeamwide;
    }
    if (unitHasTrait(u, '요새')) {
      u.stats.armor += bonusArmor;
      u.stats.magicResist += bonusMr;
      if (statMultiplier > 1 && durationSec > 0) {
        const extraArmor = bonusArmor * (statMultiplier - 1);
        const extraMr = bonusMr * (statMultiplier - 1);
        u.stats.armor += extraArmor;
        u.stats.magicResist += extraMr;
        u.bastionDoubleEndTick = Math.round(durationSec * TICKS_PER_SECOND);
        u.bastionDoubleArmorBonus = extraArmor;
        u.bastionDoubleMrBonus = extraMr;
      }
    }
  }
}

/** 매 tick main loop 에서 호출 — 요새 doubled buff 만료 시 stat 차감. */
function tickBastionDouble(unit: CombatUnit, tick: number): void {
  if (unit.bastionDoubleEndTick === 0) return;
  if (tick < unit.bastionDoubleEndTick) return;
  unit.stats.armor -= unit.bastionDoubleArmorBonus;
  unit.stats.magicResist -= unit.bastionDoubleMrBonus;
  unit.bastionDoubleEndTick = 0;
  unit.bastionDoubleArmorBonus = 0;
  unit.bastionDoubleMrBonus = 0;
}

/**
 * 저격수 (Sniper/RangedTrait) — base damage amp + per-hex 추가 amp.
 *
 * Spec (TFT17_RangedTrait):
 *   (2) PercentDamageIncrease=18%, PerHexIncrease=2%/hex
 *   (3) 24%, 3%/hex
 *   (4) 28%, 4%/hex
 *
 * 저격수 unit 의 damage hit 시 (hit site 에서 hexDistance(caster, target) 계산):
 *   추가 damageAmp = sniperBaseDA + sniperPerHexDA * dist
 */
function applySniperEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_RangedTrait');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const v = trait.activeEffect.variables;
  const baseDApct = (v.PercentDamageIncrease ?? 0) as number; // 18 = 18%
  const perHexPct = (v.PerHexIncrease ?? 0) as number; // 2 = 2% per hex
  if (baseDApct <= 0) return;
  const baseDA = baseDApct / 100;
  const perHexDA = perHexPct / 100;
  for (const u of units) {
    if (!unitHasTrait(u, '저격수')) continue;
    u.sniperBaseDA = baseDA;
    u.sniperPerHexDA = perHexDA;
  }
}

/** 저격수 damage amp 계산 — caster 가 저격수면 base + perHex × distance, 아니면 0. */
function computeSniperDamageAmp(caster: CombatUnit, target: CombatUnit): number {
  if (caster.sniperBaseDA <= 0) return 0;
  const dist = hexDistance(caster.position, target.position);
  return caster.sniperBaseDA + caster.sniperPerHexDA * dist;
}

/**
 * 선봉대 (Vanguard/ShieldTank) — 전투 시작 시 maxHp × ShieldPercent shield (10초).
 *
 * Spec (TFT17_ShieldTank):
 *   - 전투 시작 + 체력 HealthThreshold(=50%) 도달 시: maxHp × ShieldPercentAmount shield (10초)
 *   - 선봉대는 보호막 활성 중 Durability +5% (DamageReductionPct)
 *   - (6) 추가 +8% Durability (EnhancedDurability)
 *
 * 본 PR 은 전투 시작 shield 만 구현 — HealthThreshold 발동 (tick 감시) +
 * Durability 보너스 (보호막 활성 중) 는 후속 PR 분리.
 *
 * Tier 별 ShieldPercent: (2) 16% / (4) 30% / (6) 40%.
 */
function applyVanguardEffects(activeTraits: ActiveTrait[], units: CombatUnit[], tick: number, time: number, logs: CombatLog[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_ShieldTank');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const v = trait.activeEffect.variables;
  const shieldPct = (v.ShieldPercentAmount ?? 0) as number;
  const durationSec = (v.ShieldDuration ?? 0) as number;
  if (shieldPct <= 0 || durationSec <= 0) return;
  const ticks = Math.round(durationSec * TICKS_PER_SECOND);
  for (const u of units) {
    if (!unitHasTrait(u, '선봉대')) continue;
    const shieldAmount = Math.round(u.maxHp * shieldPct);
    u.shield += shieldAmount;
    u.statusEffects.push({
      type: 'shield', sourceId: 'vanguard',
      remainingTicks: ticks, value: shieldAmount,
    });
    logs.push({
      tick, time, type: 'status_apply',
      sourceId: u.id, statusType: 'shield',
      message: `${u.champion.name} 선봉대 보호막 ${shieldAmount} (${durationSec}초)`,
      value: shieldAmount,
    });
  }
}

/**
 * 정령족 (Astronaut/Meeple) — BonusHealth flat HP 가산.
 *
 * Spec (TFT17_Astronaut):
 *   (3) +100 HP, Meeps=2
 *   (5) +400 HP, Meeps=3
 *   (7) +400 HP, Meeps=4 + Cloning Slot (게임-level, 시뮬 외)
 *   (10) +500 HP, Meeps=6 + Four Meeplords (특수)
 *
 * Meeps 메커니즘은 챔프별 ability 에서 다르게 작동 (Bard MeepsPerMeep,
 * Rammus FlatDRPerMeep, Poppy MeepShield 등) — 복잡 → 별도 PR.
 * 본 함수는 BonusHealth flat 가산만.
 *
 * 정령족 챔프 (8명): Bard, Gnar, Fizz, Rammus, Poppy, Corki, Veigar, IvernMinion.
 */
function applyAstronautEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_Astronaut');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const bonusHp = (trait.activeEffect.variables['BonusHealth'] ?? 0) as number;
  if (bonusHp <= 0) return;
  for (const u of units) {
    if (!unitHasTrait(u, '정령족')) continue;
    u.maxHp += bonusHp;
    u.currentHp += bonusHp;
  }
}

/**
 * 시간 균열자 (Timebreaker/Pulsefire) — teamwide AS + 시간 균열자 추가 AS.
 *
 * Spec (TFT17_Timebreaker):
 *   (2)/(3)/(4) 모두 모든 아군 +15% AS (AttackSpeed=0.15)
 *   (3) 추가로 게임-level reroll/XP bonus ({aaae13a0}=1) — 시뮬 외
 *   (4) 시간 균열자 unit 추가 +50% AS (TimebreakerAdditionalAS=0.50)
 *
 * 시간 균열자 챔프 (4명): Riven, Milio, Ezreal, Pantheon.
 */
function applyTimebreakerEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_Timebreaker');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const v = trait.activeEffect.variables;
  const teamwideAs = (v.AttackSpeed ?? 0) as number;
  const additionalAs = (v.TimebreakerAdditionalAS ?? 0) as number;
  for (const u of units) {
    if (teamwideAs > 0) {
      u.stats.attackSpeed *= (1 + teamwideAs);
    }
    if (additionalAs > 0 && unitHasTrait(u, '시간 균열자')) {
      u.stats.attackSpeed *= (1 + additionalAs);
    }
  }
}

/**
 * 싸움꾼 (Brawler/HPTank) — teamwide +5% maxHp + 싸움꾼 unit 추가 % maxHp.
 *
 * Spec (TFT17_HPTank):
 *   (2)/(4)/(6) 모두 모든 아군 +5% maxHP (TeamwideBonus=0.05)
 *   추가로 싸움꾼 unit 본인:
 *     (2) +20% (HealthBonus=0.20)
 *     (4) +40% (HealthBonus=0.40)
 *     (6) +60% (HealthBonus=0.60)
 *
 * 싸움꾼 챔프 (7명): Maokai, Urgot, Gragas, Chogath, TahmKench, RekSai, Pantheon.
 *
 * Note: maxHp 가산 시 currentHp 도 비례 증가 (전투 시작 시점이라 unit 은 풀체).
 */
function applyBrawlerEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_HPTank');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const v = trait.activeEffect.variables;
  const teamwideBonus = (v.TeamwideBonus ?? 0) as number;
  const brawlerBonus = (v.HealthBonus ?? 0) as number;
  for (const u of units) {
    let multiplier = 1;
    if (teamwideBonus > 0) multiplier += teamwideBonus;
    if (brawlerBonus > 0 && unitHasTrait(u, '싸움꾼')) multiplier += brawlerBonus;
    if (multiplier === 1) continue;
    u.maxHp *= multiplier;
    u.currentHp *= multiplier;
  }
}

/**
 * 암흑의 별 (DarkStar) — tier 별 효과:
 *
 * Spec (TFT17_DarkStar) 17.2 raw (모든 tier 동일 변수):
 *   ADAP=45, ExecuteHPPercent=0.08, PercentHealth=0.30, SupermassivePercentBonus=0.85
 *
 * Tier 차이는 코드 로직으로 처리:
 *   (2) tier (style 1)  : 블랙홀 execute — currentHp/maxHp ≤ 0.08 적 즉사
 *   (4) tier (style 3)  : (2) + ADAP 45% AD/AP 가산
 *   (6) tier (style 5)  : (4) + 가장 강한 darkStar unit Supermassive
 *                          (ADAP × (1 + 0.85), maxHp × (1 + 0.30))
 *   (9) tier (style 6)  : 프리즘 — 별도 prism handler 처리 (10레벨 즉시 승리)
 *
 * 암흑의 별 챔프 (6명): Kaisa, Karma, Jhin, Chogath, Lissandra, Mordekaiser.
 */
function applyDarkStarEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_DarkStar');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const v = trait.activeEffect.variables;
  const adap = (v.ADAP ?? 0) as number;
  const executePct = (v.ExecuteHPPercent ?? 0) as number;
  const supermassiveBonus = (v.SupermassivePercentBonus ?? 0) as number;
  // PercentHealth=0.30 raw 변수는 desc 에 미사용 → 적용 안 함 (codex 후속 검토).

  // darkStar unit 식별 (FakeUnit 소형 블랙홀 은 traits=[] 라서 자연 제외됨)
  const darkStarUnits = units.filter(u => unitHasTrait(u, '암흑의 별'));
  if (darkStarUnits.length === 0) return;

  // (2)+ tier: execute threshold 활성 — 모든 darkStar unit 에 적용.
  if (trait.style >= 1 && executePct > 0) {
    for (const u of darkStarUnits) {
      u.darkStarExecuteThreshold = executePct;
    }
  }

  // (4)+ tier (style 3): ADAP 45% — 모든 darkStar unit.
  if (trait.style >= 3 && adap > 0) {
    for (const u of darkStarUnits) {
      u.stats.damage = Math.round(u.stats.damage * (1 + adap / 100));
      u.stats.ap = (u.stats.ap ?? 0) + adap;
    }
  }

  // (6)+ tier (style 5): 가장 강한 darkStar unit Supermassive — desc 명시:
  //   "암흑의 별 효과 SupermassivePercentBonus(0.85) 만큼 증가 + 소형 블랙홀 2개 생성".
  //   "암흑의 별 효과" = ADAP + ExecuteHPPercent 둘 다 포함 → 두 효과 모두 +85% 강화.
  //   소형 블랙홀 spawn 은 useTeamManagement.syncDarkStarBlackholesInTeam (UI 단계).
  if (trait.style >= 5 && supermassiveBonus > 0) {
    const strongest = findStrongestDarkStarUnit(darkStarUnits);
    if (strongest) {
      strongest.darkStarSupermassive = true;
      // ADAP 추가 강화: damage += baseAd × (adap/100) × bonus, ap += adap × bonus
      const baseDamageBeforeAdap = strongest.stats.damage / (1 + adap / 100);
      const extraDamage = baseDamageBeforeAdap * (adap / 100) * supermassiveBonus;
      strongest.stats.damage = Math.round(strongest.stats.damage + extraDamage);
      strongest.stats.ap = (strongest.stats.ap ?? 0) + adap * supermassiveBonus;
      // ExecuteHPPercent 도 +85% 강화 — base 0.08 × 1.85 ≈ 0.148 (codex P1 회귀 가드).
      if (executePct > 0) {
        strongest.darkStarExecuteThreshold = executePct * (1 + supermassiveBonus);
      }
    }
  }
}

/**
 * "가장 강한" darkStar unit 선정 — Supermassive 단일 대상.
 * 우선순위: starLevel → maxHp (아이템 보유 의미) → 첫 번째.
 */
function findStrongestDarkStarUnit(units: CombatUnit[]): CombatUnit | null {
  if (units.length === 0) return null;
  const maxStar = Math.max(...units.map(u => u.starLevel));
  const top = units.filter(u => u.starLevel === maxStar);
  if (top.length === 1) return top[0];
  // 동급 → maxHp 최고 (아이템 보유 비중 반영)
  return top.sort((a, b) => b.maxHp - a.maxHp)[0];
}

/**
 * 태고족 (Primordian) — (3) tier DamageMultiplier=1.45 → 태고족 unit damageAmp +0.45.
 *
 * Spec (TFT17_Primordian):
 *   (2) DamageMultiplier=1 (placeholder), DamageTakenPercentModifier=0.08, 군체 유충 spawn — 후속 PR
 *   (3) DamageMultiplier=1.45 (style=5), 태고족 unit 입히는 피해 +45% — 본 PR 범위
 *
 * 군체 유충 spawn 메커니즘 + DamageTakenPercentModifier 는 별도 minion 시스템 필요 — 후속 PR.
 *
 * 태고족 챔프 (3명): Briar, Belveth, RekSai.
 */
function applyPrimordianEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_Primordian');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const multiplier = (trait.activeEffect.variables.DamageMultiplier ?? 1) as number;
  if (multiplier <= 1) return;
  const ampDelta = multiplier - 1;
  for (const u of units) {
    if (!unitHasTrait(u, '태고족')) continue;
    u.damageAmp += ampDelta;
  }
}

/**
 * 메카 (TFT17_Mecha) — AD%/AP flat 가산을 메카 unit 한정 적용.
 *
 * Spec (TFT17_Mecha):
 *   (3) AD=0.20, AP=20
 *   (4) AD=0.35, AP=35
 *   (6) AD=0.35, AP=35 (4와 동일, +TeamSize sim 외)
 *
 * stat.ts 의 generic AD/AP processing 은 trait 멤버 체크 없이 모든 unit 에 적용되므로
 * 메카 trait 은 generic 경로에서 제외 (stat.ts) 하고 여기서 멤버 한정 후처리.
 * AD 는 % 가산 — base AD × star × ratio. AP 는 flat.
 */
function applyMechaEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const mecha = activeTraits.find(t => t.trait.apiName === 'TFT17_Mecha');
  if (!mecha?.activeEffect) return;
  const vars = mecha.activeEffect.variables;
  const adRatio = typeof vars.AD === 'number' ? vars.AD : 0;
  const apFlat = typeof vars.AP === 'number' ? vars.AP : 0;
  if (adRatio === 0 && apFlat === 0) return;
  for (const u of units) {
    if (!unitHasTrait(u, '메카')) continue;
    if (adRatio !== 0) {
      const baseAd = u.champion.stats.damage * (STAR_SCALING[u.starLevel] || 1);
      u.stats.damage += baseAd * adRatio;
    }
    if (apFlat !== 0) {
      u.stats.ap += apFlat;
    }
  }
}

/**
 * PsyOps (4) tier 시너지 활성 여부.
 *
 * 17.2 PsyOps trait raw 데이터:
 *   - (2) tier: minUnits=2, style=1 — 일반 효과 풀
 *   - (4) tier: minUnits=4, style=5 — Radiant 강화 (초능력 unit 한정)
 */
function isPsyOpsTier4Active(activeTraits: ActiveTrait[]): boolean {
  return activeTraits.some(t =>
    t.trait.apiName === 'TFT17_PsyOps'
    && t.activeEffect != null
    && (t.activeEffect.minUnits ?? 0) >= 4
  );
}

/**
 * PsyOps (4) tier 활성 + 초능력 unit → 일반 PsyOps 아이템 → Radiant 변종 자동 swap.
 *
 * 게임 시스템 (17.2):
 *   - 사용자는 빌더에서 일반 5종 PsyOps 아이템 (`TFT17_Item_PsyOps_*Mod`) 만 장착.
 *   - (4) tier 활성 + 본인 초능력 trait 보유 시 자동으로 Radiant 강화 효과 발동.
 *   - 비-초능력 unit 또는 (2) tier 활성 시 일반 효과만 적용 (swap 안 함).
 *
 * apiName 만 swap — ITEM_EFFECTS registry 가 apiName 기반 lookup 이라
 * effects 객체 자체는 변경 불필요 (stat.ts getItemEffects 가 ITEM_EFFECTS 우선).
 */
function applyPsyOpsRadiantSwap(placed: PlacedChampion, tier4Active: boolean): PlacedChampion {
  if (!tier4Active) return placed;
  // emblem (TFT17_Item_PsyOpsEmblemItem) 으로 초능력 trait 부여된 unit 도 포함 — placedHasTrait 사용.
  // base champion.traits 만 체크하면 emblem 보유 comp 가 회귀 (codex P1 review).
  if (!placedHasTrait(placed, '초능력')) return placed;
  let changed = false;
  const newItems = placed.items.map(it => {
    if (it.apiName.startsWith('TFT17_Item_PsyOps_') && !it.apiName.endsWith('_Radiant')) {
      changed = true;
      return { ...it, apiName: it.apiName + '_Radiant' };
    }
    return it;
  });
  return changed ? { ...placed, items: newItems } : placed;
}

/**
 * "가장 강한" unit 선정 — hero carry augment 의 단일 대상 선정 룰.
 *
 * 우선순위:
 *   1. 성급 (starLevel) 최고
 *   2. 동급 시 아이템 보유 unit 우선 (아이템 수가 많은 쪽)
 *   3. 둘 다 아이템 없음 → 첫 번째 (시뮬 결정론)
 */
function findStrongestUnitByApi(units: CombatUnit[], apiName: string): CombatUnit | null {
  const candidates = units.filter(u => u.champion.apiName === apiName);
  if (candidates.length === 0) return null;
  // 1. 성급 최고
  const maxStar = Math.max(...candidates.map(u => u.starLevel));
  const top = candidates.filter(u => u.starLevel === maxStar);
  if (top.length === 1) return top[0];
  // 2. 아이템 보유 우선 → 아이템 수 많은 순
  const withItems = top.filter(u => u.items.length > 0);
  if (withItems.length > 0) {
    return withItems.sort((a, b) => b.items.length - a.items.length)[0];
  }
  // 3. tie-break: 첫 번째 (deterministic)
  return top[0];
}

/**
 * Hero carry augment 변환 — 자폭(GragasCarry) / 방패 여전사(LeonaCarry).
 *
 * 자폭 (TFT17_Augment_GragasCarry):
 *   - 가장 강한 그라가스 → "주문력 전사" 변환 (role='APFighter').
 *   - ability 가 거대한 폭발 (자기 자신 데미지, 다른 아군 X) 로 변환.
 *   - 자폭 self-damage 로 hp 가 1 미만으로 떨어지지 않음 (HP floor=1).
 *
 * 방패 여전사 (TFT17_Augment_LeonaCarry):
 *   - 가장 강한 레오나 → "공격력 전사" 변환 (role='ADFighter').
 *   - ability 가 적 가로질러 dash + 첫 적중 대상 기절 (CC) 로 변환.
 *
 * 변환 결과 unit 만 gragasCarryActive / leonaCarryActive 가 true. 일반 그라가스/레오나
 * (carry 미선정) 는 기존 ability 그대로.
 */
function applyHeroCarryTransforms(augmentApiNames: string[], units: CombatUnit[]): void {
  const augSet = new Set(augmentApiNames);
  // 사용자 명세 "주문력 전사" / "공격력 전사" 는 raw GameRole 표기.
  // 시뮬 내부 UnitRole 은 단순화 ('Fighter' 단일) — 마나 획득/타게팅 룰 동일하게 처리됨.
  // 차별화 (AP vs AD) 는 ability config (selfDamage/firstHitOnlyStun) 로 표현.
  if (augSet.has('TFT17_Augment_GragasCarry')) {
    const target = findStrongestUnitByApi(units, 'TFT17_Gragas');
    if (target) {
      target.gragasCarryActive = true;
      target.role = 'Fighter';
    }
  }
  if (augSet.has('TFT17_Augment_LeonaCarry')) {
    const target = findStrongestUnitByApi(units, 'TFT17_Leona');
    if (target) {
      target.leonaCarryActive = true;
      target.role = 'Fighter';
    }
  }
}

/**
 * 최신상 (TFT17_GravesTrait) Frame 변환 — 가장 강한 그레이브즈 1명에 적용.
 *
 * raw items (TFT17_GravesTrait_Offense_*):
 *   CloseQuarters (맹공): { Range: -2, BaseHealth: 250, Omnivamp: 0.10, AttackDamage: 0.25 }
 *     → 사거리 -2, 공격력 전사 변환, +HP 250, +AD 25%, +흡혈 10%
 *   SharpshooterModule (위력): { AbilityDamagePercentIncrease: 0.05 }
 *     → 정밀 (spellCanCrit) + 스킬 피해 +5%
 *   DoubleTap (사수): { DoubleAttackChance: 0.25 }
 *     → 25% 확률 2회 공격
 *
 * 본 PR (Phase 1) — Frame 3종 stat 적용 + DoubleTap chance flag + Sharp 정밀 / ability damage.
 * 하위 업그레이드 (Buckshot, Heartseeker, GravBooster 등 30+) 는 후속 PR.
 */
function applyGravesFrameEffects(
  units: CombatUnit[],
  frame: 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap' | undefined,
): void {
  if (!frame) return;
  const target = findStrongestUnitByApi(units, 'TFT17_Graves');
  if (!target) return;
  target.gravesFrame = frame;
  if (frame === 'CloseQuarters') {
    // 맹공: Range -2 (최소 1), +HP 250, +AD 25%, +흡혈 10%, role='Fighter' (공격력 전사 단순화).
    target.stats.range = Math.max(1, target.stats.range - 2);
    target.maxHp += 250;
    target.currentHp += 250;
    const baseAd = target.champion.stats.damage * (STAR_SCALING[target.starLevel] || 1);
    target.stats.damage += baseAd * 0.25;
    target.omnivamp += 0.10;
    target.role = 'Fighter';
    return;
  }
  if (frame === 'SharpshooterModule') {
    // 위력: 정밀 (spellCanCrit) + 스킬 피해 +5%.
    target.spellCanCrit = true;
    target.gravesAbilityDamageBonus = 0.05;
    return;
  }
  if (frame === 'DoubleTap') {
    // 사수: 25% 확률 추가 공격 — eventBus on_attack hook 에서 처리.
    target.gravesDoubleAttackChance = 0.25;
    return;
  }
}

/**
 * 최신상 (TFT17_GravesTrait) 무기고 stat upgrade 적용 — Phase 2.
 *
 * raw items 기반 직접 stat 가산. 가장 강한 그레이브즈 1명에게만 적용.
 * RevUp / RevUp2 (sticky target stacking AS) / Buckshot 류 (투사체) 등
 * 메커닉 필요 항목은 본 함수 미처리 — 후속 Phase 3.
 *
 * 적용 18종 (raw effects 기반):
 *   LeechingImplants    AD +10%, omnivamp +0.10
 *   LeechingImplants2   AD +20%, omnivamp +0.15
 *   HeavyPlating        +HP 300, +Armor 20, +MR 20
 *   PrecisionScope      AD +12%, range +1
 *   PrecisionScope2     AD +24%, range +2
 *   PrecisionScope3     AD +36%, range +3
 *   Fission             AD +10%, manaRegen +2/s
 *   Fission2            AD +20%, manaRegen +3/s
 *   Fission3            AD +30%, manaRegen +5/s
 *   Heartseeker         critChance +0.10, critDmg +0.05
 *   Heartseeker2        critChance +0.25, critDmg +0.10
 *   Heartseeker3        critChance +0.40, critDmg +0.18
 *   Tankbuster          탱커 상대 damage amp +0.15
 *   Coolant             maxMana -10
 *   Coolant2            maxMana -20
 *   APRounds            armorPen +0.30
 *   APRounds2           armorPen +0.60
 *   SheerMass           maxHp × 1.25
 *
 * AD% 는 base × star scaling (Frame CloseQuarters 와 동일 기준).
 *
 * Phase 3A 추가 8종 (event-driven flag set — 실제 효과는 combatLoop hook 에서):
 *   RipperBullets       gravesRipperReduce = 1   (평타 시 적 armor/MR -1)
 *   RipperBullets2      gravesRipperReduce = 2   (평타 시 적 armor/MR -2)
 *   Nanomachines        gravesNanoRegenPct = 0.03 (매 1초 maxHp×3% heal)
 *   EmergencyShielding  triggerHpFrac=0.4 / shieldFrac=0.5 / durationSec=2.5
 *   EmergencyShielding2 triggerHpFrac=0.4 / shieldFrac=0.75 / durationSec=4
 *   Shockwave           gravesShockwaveActive = true (전투 시작 가까운 적 maxHp×15% 마법 + 2s stun)
 *   ReactiveArmor       gravesReactivePerStack = 4 (피격 시 armor/MR +4 stack, 최대 50회)
 */
const GRAVES_STAT_UPGRADE_HANDLERS: Record<string, (u: CombatUnit, baseAd: number) => void> = {
  LeechingImplants:  (u, ad) => { u.stats.damage += ad * 0.10; u.omnivamp += 0.10; },
  LeechingImplants2: (u, ad) => { u.stats.damage += ad * 0.20; u.omnivamp += 0.15; },
  HeavyPlating:      (u)     => { u.maxHp += 300; u.currentHp += 300; u.stats.armor += 20; u.stats.magicResist += 20; },
  PrecisionScope:    (u, ad) => { u.stats.damage += ad * 0.12; u.stats.range += 1; },
  PrecisionScope2:   (u, ad) => { u.stats.damage += ad * 0.24; u.stats.range += 2; },
  PrecisionScope3:   (u, ad) => { u.stats.damage += ad * 0.36; u.stats.range += 3; },
  Fission:           (u, ad) => { u.stats.damage += ad * 0.10; u.augmentManaRegen += 2; },
  Fission2:          (u, ad) => { u.stats.damage += ad * 0.20; u.augmentManaRegen += 3; },
  Fission3:          (u, ad) => { u.stats.damage += ad * 0.30; u.augmentManaRegen += 5; },
  Heartseeker:       (u)     => { u.stats.critChance += 0.10; u.stats.critMultiplier += 0.05; },
  Heartseeker2:      (u)     => { u.stats.critChance += 0.25; u.stats.critMultiplier += 0.10; },
  Heartseeker3:      (u)     => { u.stats.critChance += 0.40; u.stats.critMultiplier += 0.18; },
  Tankbuster:        (u)     => { u.gravesTankDamageAmp += 0.15; },
  Coolant:           (u)     => { u.maxMana = Math.max(0, u.maxMana - 10); },
  Coolant2:          (u)     => { u.maxMana = Math.max(0, u.maxMana - 20); },
  APRounds:          (u)     => { u.stats.armorPen += 0.30; },
  APRounds2:         (u)     => { u.stats.armorPen += 0.60; },
  SheerMass:         (u)     => {
    const newMax = Math.round(u.maxHp * 1.25);
    u.maxHp = newMax;
    u.currentHp = newMax;
  },
  // Phase 3A — flag setters. 실제 효과는 main loop / event hook 에서.
  // higher-tier 가 lower 를 덮어쓰도록 max() 적용 (RipperBullets1+2 동시 입력 방지/정렬은
  // canonical order 에서 보장하지만, Set 기반 dedup 후 양쪽 다 들어와도 의미가 일치하도록).
  RipperBullets:      (u)     => { u.gravesRipperReduce = Math.max(u.gravesRipperReduce, 1); },
  RipperBullets2:     (u)     => { u.gravesRipperReduce = Math.max(u.gravesRipperReduce, 2); },
  Nanomachines:       (u)     => { u.gravesNanoRegenPct = Math.max(u.gravesNanoRegenPct, 0.03); },
  EmergencyShielding: (u)     => {
    u.gravesEmergencyTriggerHpFrac = 0.4;
    u.gravesEmergencyShieldFrac = Math.max(u.gravesEmergencyShieldFrac, 0.5);
    u.gravesEmergencyDurationSec = Math.max(u.gravesEmergencyDurationSec, 2.5);
  },
  EmergencyShielding2:(u)     => {
    u.gravesEmergencyTriggerHpFrac = 0.4;
    u.gravesEmergencyShieldFrac = Math.max(u.gravesEmergencyShieldFrac, 0.75);
    u.gravesEmergencyDurationSec = Math.max(u.gravesEmergencyDurationSec, 4);
  },
  Shockwave:          (u)     => { u.gravesShockwaveActive = true; },
  ReactiveArmor:      (u)     => { u.gravesReactivePerStack = Math.max(u.gravesReactivePerStack, 4); },
  // Phase 3B-1 — DoubleTap2/TripleTap chance + RevUp/2 sticky stack.
  // DoubleTap2 (35%) 는 Frame DoubleTap (25%) 와 같은 필드 max() override.
  DoubleTap2:         (u)     => { u.gravesDoubleAttackChance = Math.max(u.gravesDoubleAttackChance, 0.35); },
  TripleTap:          (u)     => { u.gravesTripleAttackChance = Math.max(u.gravesTripleAttackChance, 0.18); },
  RevUp:              (u)     => {
    if (u.gravesRevUpPerStack < 0.08) {
      u.gravesRevUpPerStack = 0.08;
      u.gravesRevUpMaxBonus = 0.80;
    }
  },
  RevUp2:             (u)     => {
    // tier 2 가 더 높으니 항상 override.
    u.gravesRevUpPerStack = 0.15;
    u.gravesRevUpMaxBonus = 1.50;
  },
  // Phase 3B-2 — onKill dash + AS buff / 누적 저장 → splash.
  // GravBooster: BonusMultAS=0.40, NumAttacks=2 (raw).
  // GravBooster2: BonusMultAS=0.40, NumAttacks=3 (raw). 동상 효과는 raw 미정의 → 시뮬 미구현.
  GravBooster:        (u)     => {
    u.gravesGravBoosterBonusAS = Math.max(u.gravesGravBoosterBonusAS, 0.40);
    u.gravesGravBoosterMaxAttacks = Math.max(u.gravesGravBoosterMaxAttacks, 2);
  },
  GravBooster2:       (u)     => {
    u.gravesGravBoosterBonusAS = Math.max(u.gravesGravBoosterBonusAS, 0.40);
    u.gravesGravBoosterMaxAttacks = Math.max(u.gravesGravBoosterMaxAttacks, 3);
  },
  LatentExplosion:    (u)     => {
    u.gravesLatentStoredPct = Math.max(u.gravesLatentStoredPct, 0.15);
  },
  // Phase 3C-1 — 평타 base AOE (Buckshot/Laser/Frag/Melt).
  // Buckshot: NumBonusProjectiles 2/4/6, SpreadIncrease 0.20/0.30/0.40.
  Buckshot:           (u)     => {
    u.gravesBuckshotProjectiles = Math.max(u.gravesBuckshotProjectiles, 2);
    u.gravesBuckshotSpread = Math.max(u.gravesBuckshotSpread, 0.20);
  },
  Buckshot2:          (u)     => {
    u.gravesBuckshotProjectiles = Math.max(u.gravesBuckshotProjectiles, 4);
    u.gravesBuckshotSpread = Math.max(u.gravesBuckshotSpread, 0.30);
  },
  Buckshot3:          (u)     => {
    u.gravesBuckshotProjectiles = Math.max(u.gravesBuckshotProjectiles, 6);
    u.gravesBuckshotSpread = Math.max(u.gravesBuckshotSpread, 0.40);
  },
  // LaserBallistics: BonusHexes=1, DamageReductionPerTarget=0.5.
  LaserBallistics:    (u)     => {
    u.gravesLaserPenetrationHexes = Math.max(u.gravesLaserPenetrationHexes, 1);
    u.gravesLaserDmgReductionPerTarget = Math.max(u.gravesLaserDmgReductionPerTarget, 0.5);
  },
  // FragmentationRounds: FragmentDamage 0.15/0.20, FragmentProjectiles 2/3.
  FragmentationRounds: (u)    => {
    u.gravesFragDamage = Math.max(u.gravesFragDamage, 0.15);
    u.gravesFragProjectiles = Math.max(u.gravesFragProjectiles, 2);
  },
  FragmentationRounds2: (u)   => {
    u.gravesFragDamage = Math.max(u.gravesFragDamage, 0.20);
    u.gravesFragProjectiles = Math.max(u.gravesFragProjectiles, 3);
  },
  // Meltthrough: ArmorMRReduction=4 (매초 graves 주변 2hex 적군 armor/MR -4).
  Meltthrough:        (u)     => {
    u.gravesMeltthroughArmorMR = Math.max(u.gravesMeltthroughArmorMR, 4);
  },
  // Phase 3C-2 — ability AOE.
  // BlastRadius/2/3: IncreasedRadius=1/2/3, DamageReductionPerHex=0.5/0.30/0.30.
  // 상위 tier 가 항상 override (radius / reduction 별도 비교).
  BlastRadius:        (u)     => {
    if (u.gravesBlastIncreasedRadius < 1) {
      u.gravesBlastIncreasedRadius = 1;
      u.gravesBlastDmgReductionPerHex = 0.5;
    }
  },
  BlastRadius2:       (u)     => {
    if (u.gravesBlastIncreasedRadius < 2) {
      u.gravesBlastIncreasedRadius = 2;
      u.gravesBlastDmgReductionPerHex = 0.30;
    }
  },
  BlastRadius3:       (u)     => {
    u.gravesBlastIncreasedRadius = 3;  // 최상위 tier — 항상 override.
    u.gravesBlastDmgReductionPerHex = 0.30;
  },
  // SympatheticDetonation: SympatheticDamageReduction=0.30.
  SympatheticDetonation: (u)  => {
    u.gravesSympatheticReduction = Math.max(u.gravesSympatheticReduction, 0.30);
  },
  // Phase 3D — 복합 메커닉 (Heartseeker3 는 raw 가 critChance/critDmg 만 — Phase 2 에서
  // 이미 처리됨, 본 Phase 별도 작업 불필요).
  // VoidCoefficient: PercentManaReductionPerCast=0.15. 매 cast 직후 maxMana × (1-0.15).
  VoidCoefficient:    (u)     => {
    u.gravesVoidCoefficientPct = Math.max(u.gravesVoidCoefficientPct, 0.15);
  },
  // Choke: SpreadDecrease=0.75. Buckshot spread 75% 감소.
  Choke:              (u)     => {
    u.gravesChokeSpreadDecrease = Math.max(u.gravesChokeSpreadDecrease, 0.75);
  },
  // AimAssistant: BonusDamagePerHex=0.05. 평타 시 distance × 0.05 damage amp.
  AimAssistant:       (u)     => {
    u.gravesAimAssistBonusPerHex = Math.max(u.gravesAimAssistBonusPerHex, 0.05);
  },
};

/**
 * Stable canonical 적용 순서 — deterministic 보장 (codex P2).
 * 일부 upgrade 가 order-sensitive (SheerMass × maxHp vs HeavyPlating + maxHp 등) →
 * 입력 array 순서가 달라도 동일 set 이면 항상 같은 결과를 내야 replay/serialize 가능.
 *
 * 적용 순서 원칙:
 *   1. flat HP / armor / MR / range / mana 등 가산 먼저
 *   2. AD% / armorPen / crit 등 stat 가산
 *   3. maxHp 비례 multiplier (SheerMass) — 가장 마지막
 *   4. 동일 카테고리 내에선 알파벳 순 (deterministic)
 */
const GRAVES_UPGRADE_APPLY_ORDER: ReadonlyArray<string> = [
  // 1. flat additions (HP/armor/MR/range/mana)
  'APRounds',
  'APRounds2',
  'Coolant',
  'Coolant2',
  'Fission',
  'Fission2',
  'Fission3',
  'HeavyPlating',
  'LeechingImplants',
  'LeechingImplants2',
  'PrecisionScope',
  'PrecisionScope2',
  'PrecisionScope3',
  // 2. crit / damage amp
  'Heartseeker',
  'Heartseeker2',
  'Heartseeker3',
  'Tankbuster',
  // 3. event-driven flag setters (Phase 3A — Math.max 사용으로 순서 무관, 단 결정성 보장 위해 정렬)
  'EmergencyShielding',
  'EmergencyShielding2',
  'Nanomachines',
  'ReactiveArmor',
  'RipperBullets',
  'RipperBullets2',
  'Shockwave',
  // 4. Phase 3B-1 — chance / sticky stack (정렬 — 결정성).
  //    RevUp 먼저, RevUp2 가 override (강제 max-tier 가지므로 순서 중요).
  'DoubleTap2',
  'RevUp',
  'RevUp2',
  'TripleTap',
  // 5. Phase 3B-2 — onKill dash / 누적 splash (정렬 — 결정성).
  //    GravBooster 먼저, GravBooster2 가 NumAttacks override.
  'GravBooster',
  'GravBooster2',
  'LatentExplosion',
  // 6. Phase 3C-1 — 평타 base AOE (정렬 — 결정성).
  //    Buckshot 1→2→3 순서, Frag 1→2 순서로 max() override.
  'Buckshot',
  'Buckshot2',
  'Buckshot3',
  'FragmentationRounds',
  'FragmentationRounds2',
  'LaserBallistics',
  'Meltthrough',
  // 7. Phase 3C-2 — ability AOE (정렬 — 결정성).
  //    BlastRadius 1→2→3 순서로 override (radius/reduction 페어 보존).
  'BlastRadius',
  'BlastRadius2',
  'BlastRadius3',
  'SympatheticDetonation',
  // 8. Phase 3D — 복합 메커닉 (정렬 — 결정성).
  'AimAssistant',
  'Choke',
  'VoidCoefficient',
  // 9. % multiplier (가장 마지막 — 1·2 단계의 flat HP/AD 가산 후 적용)
  'SheerMass',
];

/**
 * Shockwave (충격파) — 전투 시작 시 가까운 적 N명에게 maxHp × 0.15 마법 피해 + 2초 stun.
 *
 * raw effects: ShockvavePercentMaxHealthDamage=0.15, ShockwaveStunDuration=2.
 * NumTargets 변수가 raw 에 정의되지 않음 → 원본은 cone shape (전방 부채꼴).
 * 시뮬은 facing 정보 없음 → "그레이브즈에게 가장 가까운 적 2명" 으로 단순화.
 *
 * applyGravesStatUpgrades 가 활성화한 unit 1명 한정 (가장 강한 그레이브즈).
 * tick=0, time=0 시점에 호출. on_death emit 으로 누적 핸들러 정합 유지.
 */
/**
 * EmergencyShielding/2 trigger — HP × triggerHpFrac 도달 시 1회 shield 부여.
 * 호출 시점: damage application 직후 (codex P1) + tick pre-check (safety net).
 *
 * 1-tick burst 시나리오 정합성: 평타 first hit 후 즉시 호출 → 후속 DoubleTap
 * 추가 hit 부터 shield 흡수. tick pre-check 만으로는 같은 tick 안에서
 * "trigger 도달 + lethal" 시 shield 미발동.
 */
function maybeTriggerEmergencyShield(unit: CombatUnit): void {
  if (unit.gravesEmergencyTriggerHpFrac <= 0) return;
  if (unit.gravesEmergencyUsed) return;
  if (unit.maxHp <= 0) return;
  if (unit.currentHp / unit.maxHp > unit.gravesEmergencyTriggerHpFrac) return;
  const shieldAmt = unit.maxHp * unit.gravesEmergencyShieldFrac;
  const shieldTicks = Math.round(unit.gravesEmergencyDurationSec * TICKS_PER_SECOND);
  unit.shield += shieldAmt;
  unit.statusEffects.push({
    type: 'shield',
    sourceId: unit.id,
    remainingTicks: shieldTicks,
    value: shieldAmt,
  });
  unit.gravesEmergencyUsed = true;
}

function applyGravesShockwave(
  ownTeam: CombatUnit[],
  enemyTeam: CombatUnit[],
  eventBus: EventBus,
  logs: CombatLog[],
): void {
  const graves = ownTeam.find((u) => u.gravesShockwaveActive && u.state !== 'dead');
  if (!graves) return;

  const aliveEnemies = enemyTeam.filter((e) => e.state !== 'dead');
  if (aliveEnemies.length === 0) return;

  // 가까운 적 2명 (cone 단순화)
  const sorted = [...aliveEnemies].sort(
    (a, b) => hexDistance(graves.position, a.position) - hexDistance(graves.position, b.position),
  );
  const targets = sorted.slice(0, 2);

  const stunTicks = Math.round(2 * TICKS_PER_SECOND);
  for (const target of targets) {
    const rawDmg = target.maxHp * 0.15;
    // codex P2: 정상 mitigation pipeline 사용 — Warden shield / damageReduction /
    // invulnerable 등 combat-start 방어 효과 우회 방지.
    let finalDmg = applyResistance(rawDmg, target.stats.magicResist, graves.stats.magicPen);
    if (target.damageReduction > 0) finalDmg *= (1 - target.damageReduction);
    finalDmg = applyShield(target, finalDmg, eventBus, 0);
    if (target.statusEffects.some(e => e.type === 'invulnerable')) finalDmg = 0;

    target.currentHp -= finalDmg;
    target.totalDamageTaken += finalDmg;
    graves.totalDamageDealt += finalDmg;
    target.statusEffects.push({ type: 'stun', sourceId: graves.id, remainingTicks: stunTicks });
    target.state = 'idle';
    target.attackCooldown = 0;

    const log: CombatLog = {
      tick: 0, time: 0, type: 'ability',
      sourceId: graves.id, targetId: target.id,
      value: Math.round(finalDmg),
      message: `${graves.champion.name} 충격파 발동! ${target.champion.name}에게 ${Math.round(finalDmg)} 마법 피해 + 기절 2초`,
    };
    logs.push(log);

    if (target.currentHp <= 0) {
      target.currentHp = 0;
      target.state = 'dead';
      eventBus.emit('on_death', { sourceId: target.id, targetId: graves.id, tick: 0 });
    }
  }
}

/**
 * GravBooster/2 — graves 가 처치 관여 시 호출. AS bonus N attacks 활성 + dash to next target.
 *
 * raw effects: BonusMultAS=0.40, NumAttacks=2 (GravBooster) / 3 (GravBooster2).
 * 동상 (chill) 효과는 raw 미정의 → 시뮬 미구현 (lolchess UI 텍스트 기반 추정).
 *
 * dash: applyAbilityDash(to_target) 재사용. nextTarget 이 없으면 dash skip, AS buff 만 적용.
 */
function triggerGravBooster(
  unit: CombatUnit,
  enemyTeamAlive: CombatUnit[],
  occupiedPositions: Set<string>,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  tick: number,
  time: number,
): void {
  if (unit.gravesGravBoosterMaxAttacks <= 0) return;
  // 1. AS bonus 활성 (다음 N attacks 동안).
  // codex P1: kill 직후 같은 attack cycle 끝의 attacksRemaining-- 가 1 stack 즉시 소비함.
  // → kill shot 자체는 boost 적용 대상 아니므로 +1 compensation. 결과: 다음 N attacks 보장.
  unit.gravesGravBoosterAttacksRemaining = unit.gravesGravBoosterMaxAttacks + 1;
  // 2. dash to next target — alive enemy 가 있으면 가장 가까운 적 한정으로 이동.
  if (enemyTeamAlive.length === 0) return;
  let nextTarget: CombatUnit | undefined;
  let bestDist = Infinity;
  for (const e of enemyTeamAlive) {
    const d = hexDistance(unit.position, e.position);
    if (d < bestDist) { bestDist = d; nextTarget = e; }
  }
  if (!nextTarget) return;
  applyAbilityDash(unit, 'to_target', nextTarget, enemyTeamAlive, occupiedPositions, logs, tickLogs, tick, time);
}

/**
 * LatentExplosion — target 사망 시 누적 stored damage 만큼 2 hex 반경 적군에 splash.
 *
 * raw: LatentExplosionStoredDamage=0.15. graves attacker 가 hit 한 만큼 target.gravesLatentStored
 * 에 누적. graves 처치 관여 시 splash. splash damage = stored 1.0 (raw 별도 factor 없음).
 *
 * splash 는 mitigation pipeline (resistance / shield / DR / invulnerable) 적용.
 */
function triggerLatentExplosion(
  killer: CombatUnit,  // graves
  deadTarget: CombatUnit,
  enemyTeam: CombatUnit[],
  eventBus: EventBus,
  tick: number,
  time: number,
  logs: CombatLog[],
  killerArbiterState: ArbiterTriggerState,  // codex P2: splash kill 도 enemyDeathCount 카운트
): void {
  if (deadTarget.gravesLatentStored <= 0) return;
  const splashDamage = deadTarget.gravesLatentStored;
  const splashEnemies = enemyTeam.filter(
    (e) => e.id !== deadTarget.id && e.state !== 'dead' &&
           hexDistance(deadTarget.position, e.position) <= 2,
  );
  for (const splashTarget of splashEnemies) {
    let final = applyResistance(splashDamage, splashTarget.stats.armor, killer.stats.armorPen);
    if (splashTarget.damageReduction > 0) final *= (1 - splashTarget.damageReduction);
    final = applyShield(splashTarget, final, eventBus, tick);
    if (splashTarget.statusEffects.some(e => e.type === 'invulnerable')) final = 0;

    splashTarget.currentHp -= final;
    splashTarget.totalDamageTaken += final;
    killer.totalDamageDealt += final;

    if (splashTarget.currentHp <= 0 && splashTarget.state !== 'dead') {
      splashTarget.currentHp = 0;
      splashTarget.state = 'dead';
      killer.killCount++;
      // codex P2: Arbiter on_enemy_death trigger 일관성 — 다른 kill path 와 동일하게 카운트.
      killerArbiterState.enemyDeathCount++;
      eventBus.emit('on_kill', { sourceId: killer.id, targetId: splashTarget.id, tick });
      eventBus.emit('on_death', { sourceId: splashTarget.id, targetId: killer.id, tick });
    }
  }
  if (splashEnemies.length > 0) {
    logs.push({
      tick, time, type: 'ability',
      sourceId: killer.id, targetId: deadTarget.id,
      value: Math.round(splashDamage),
      message: `${killer.champion.name} 지연 폭발! ${splashEnemies.length}명에 ${Math.round(splashDamage)} 물리 피해`,
    });
  }
  // 폭발 후 stored 초기화 (재사용 안 함 — target 이미 사망)
  deadTarget.gravesLatentStored = 0;
}

/**
 * Buckshot/2/3 — 평타 명중 시 추가 (N-1) projectile 을 nearby 적군에 분산.
 * 사용자 결정: "타겟 + 주변 혼합" — 첫 hit 은 target (이미 처리됨), 추가 (N-1) 은
 * graves 주변 가까운 적 N-1 명에 finalDmg 만큼 추가 hit. SpreadIncrease 는 nearby radius
 * 결정 (1 + round(spread × 2.5) → 0.20→1, 0.30→2, 0.40→2 hex).
 *
 * raw: NumBonusProjectiles=2/4/6, SpreadIncrease=0.20/0.30/0.40.
 * mitigation pipeline 적용 (resistance / DR / shield / invulnerable).
 */
/**
 * 공통 helper-hit kill follow-up — codex P2 (PR #57):
 *  1. arbiter enemyDeathCount++ (Arbiter on_enemy_death trigger 일관성)
 *  2. LatentExplosion splash (해당 enemy 의 stored > 0 일 때)
 *  3. GravBooster trigger (attacker 활성 시)
 * 평타 first hit / extra hit kill 사이트와 동일한 후속 처리 보장.
 */
function applyGravesHelperKill(
  attacker: CombatUnit,
  deadEnemy: CombatUnit,
  enemyTeam: CombatUnit[],
  occupiedPositions: Set<string>,
  killerArbiterState: ArbiterTriggerState,
  eventBus: EventBus,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): void {
  killerArbiterState.enemyDeathCount++;
  if (deadEnemy.gravesLatentStored > 0) {
    triggerLatentExplosion(attacker, deadEnemy, enemyTeam, eventBus, tick, time, logs, killerArbiterState);
  }
  if (attacker.gravesGravBoosterMaxAttacks > 0) {
    const aliveEnemies = enemyTeam.filter(e => e.state !== 'dead');
    triggerGravBooster(attacker, aliveEnemies, occupiedPositions, logs, tickLogs, tick, time);
  }
}

function triggerBuckshot(
  attacker: CombatUnit,
  primaryTarget: CombatUnit,
  finalDamage: number,
  enemyTeam: CombatUnit[],
  occupiedPositions: Set<string>,
  killerArbiterState: ArbiterTriggerState,
  eventBus: EventBus,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): void {
  if (attacker.gravesBuckshotProjectiles <= 0) return;
  const extraProjectiles = attacker.gravesBuckshotProjectiles;
  // Phase 3D Choke — SpreadDecrease 만큼 spread 감소 (raw SpreadDecrease=0.75).
  const effectiveSpread = attacker.gravesBuckshotSpread * (1 - attacker.gravesChokeSpreadDecrease);
  const spreadRadius = 1 + Math.round(effectiveSpread * 2.5);
  // primaryTarget 제외, attacker 주변 spread radius 안 가까운 적 (정렬 — distance asc).
  const candidates = enemyTeam
    .filter((e) => e.id !== primaryTarget.id && e.state !== 'dead')
    .map((e) => ({ enemy: e, dist: hexDistance(attacker.position, e.position) }))
    .filter((x) => x.dist <= spreadRadius)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, extraProjectiles);
  for (const { enemy } of candidates) {
    let dmg = applyResistance(finalDamage, enemy.stats.armor, attacker.stats.armorPen);
    if (enemy.damageReduction > 0) dmg *= (1 - enemy.damageReduction);
    dmg = applyShield(enemy, dmg, eventBus, tick);
    if (enemy.statusEffects.some(e => e.type === 'invulnerable')) dmg = 0;
    enemy.currentHp -= dmg;
    enemy.totalDamageTaken += dmg;
    attacker.totalDamageDealt += dmg;
    // codex P2: helper hit 도 LatentExplosion stored 누적 (graves 가 입힌 모든 피해).
    if (attacker.gravesLatentStoredPct > 0 && dmg > 0) {
      enemy.gravesLatentStored += dmg * attacker.gravesLatentStoredPct;
    }
    if (enemy.currentHp <= 0 && enemy.state !== 'dead') {
      enemy.currentHp = 0;
      enemy.state = 'dead';
      attacker.killCount++;
      eventBus.emit('on_kill', { sourceId: attacker.id, targetId: enemy.id, tick });
      eventBus.emit('on_death', { sourceId: enemy.id, targetId: attacker.id, tick });
      applyGravesHelperKill(attacker, enemy, enemyTeam, occupiedPositions, killerArbiterState, eventBus, tick, time, logs, tickLogs);
    }
  }
}

/**
 * LaserBallistics — 평타 hit 후 다음 가까운 적 1명에 추가 hit (감소 50%).
 * 단일화: BonusHexes=1 의미는 1 칸 너머 추가 비행. 시뮬은 단일 타겟 모델 → 가까운 적 next 1명.
 * raw: BonusHexes=1, DamageReductionPerTarget=0.5.
 */
function triggerLaserBallistics(
  attacker: CombatUnit,
  primaryTarget: CombatUnit,
  finalDamage: number,
  enemyTeam: CombatUnit[],
  occupiedPositions: Set<string>,
  killerArbiterState: ArbiterTriggerState,
  eventBus: EventBus,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): void {
  if (attacker.gravesLaserPenetrationHexes <= 0) return;
  // primaryTarget 제외 가장 가까운 적 (관통 다음 적).
  const candidates = enemyTeam.filter((e) => e.id !== primaryTarget.id && e.state !== 'dead');
  if (candidates.length === 0) return;
  let nextEnemy: CombatUnit | undefined;
  let bestDist = Infinity;
  for (const e of candidates) {
    const d = hexDistance(primaryTarget.position, e.position);
    if (d < bestDist) { bestDist = d; nextEnemy = e; }
  }
  if (!nextEnemy) return;
  const reducedDmg = finalDamage * (1 - attacker.gravesLaserDmgReductionPerTarget);
  let dmg = applyResistance(reducedDmg, nextEnemy.stats.armor, attacker.stats.armorPen);
  if (nextEnemy.damageReduction > 0) dmg *= (1 - nextEnemy.damageReduction);
  dmg = applyShield(nextEnemy, dmg, eventBus, tick);
  if (nextEnemy.statusEffects.some(e => e.type === 'invulnerable')) dmg = 0;
  nextEnemy.currentHp -= dmg;
  nextEnemy.totalDamageTaken += dmg;
  attacker.totalDamageDealt += dmg;
  // codex P2: helper hit 도 LatentExplosion stored 누적.
  if (attacker.gravesLatentStoredPct > 0 && dmg > 0) {
    nextEnemy.gravesLatentStored += dmg * attacker.gravesLatentStoredPct;
  }
  if (nextEnemy.currentHp <= 0 && nextEnemy.state !== 'dead') {
    nextEnemy.currentHp = 0;
    nextEnemy.state = 'dead';
    attacker.killCount++;
    eventBus.emit('on_kill', { sourceId: attacker.id, targetId: nextEnemy.id, tick });
    eventBus.emit('on_death', { sourceId: nextEnemy.id, targetId: attacker.id, tick });
    applyGravesHelperKill(attacker, nextEnemy, enemyTeam, occupiedPositions, killerArbiterState, eventBus, tick, time, logs, tickLogs);
  }
}

/**
 * FragmentationRounds/2 — 평타 hit 시 primaryTarget 주변 N hex 적군 N명에 magic damage.
 * raw: FragmentDamage=0.15/0.20, FragmentProjectiles=2/3.
 * splash radius = 1 hex (close fragments).
 */
function triggerFragmentation(
  attacker: CombatUnit,
  primaryTarget: CombatUnit,
  finalDamage: number,
  enemyTeam: CombatUnit[],
  occupiedPositions: Set<string>,
  killerArbiterState: ArbiterTriggerState,
  eventBus: EventBus,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): void {
  if (attacker.gravesFragDamage <= 0 || attacker.gravesFragProjectiles <= 0) return;
  const fragDmg = finalDamage * attacker.gravesFragDamage;
  const candidates = enemyTeam
    .filter((e) => e.id !== primaryTarget.id && e.state !== 'dead')
    .map((e) => ({ enemy: e, dist: hexDistance(primaryTarget.position, e.position) }))
    .filter((x) => x.dist <= 1)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, attacker.gravesFragProjectiles);
  for (const { enemy } of candidates) {
    let dmg = applyResistance(fragDmg, enemy.stats.magicResist, attacker.stats.magicPen);
    if (enemy.damageReduction > 0) dmg *= (1 - enemy.damageReduction);
    dmg = applyShield(enemy, dmg, eventBus, tick);
    if (enemy.statusEffects.some(e => e.type === 'invulnerable')) dmg = 0;
    enemy.currentHp -= dmg;
    enemy.totalDamageTaken += dmg;
    attacker.totalDamageDealt += dmg;
    // codex P2: helper hit 도 LatentExplosion stored 누적.
    if (attacker.gravesLatentStoredPct > 0 && dmg > 0) {
      enemy.gravesLatentStored += dmg * attacker.gravesLatentStoredPct;
    }
    if (enemy.currentHp <= 0 && enemy.state !== 'dead') {
      enemy.currentHp = 0;
      enemy.state = 'dead';
      attacker.killCount++;
      eventBus.emit('on_kill', { sourceId: attacker.id, targetId: enemy.id, tick });
      eventBus.emit('on_death', { sourceId: enemy.id, targetId: attacker.id, tick });
      applyGravesHelperKill(attacker, enemy, enemyTeam, occupiedPositions, killerArbiterState, eventBus, tick, time, logs, tickLogs);
    }
  }
}

/**
 * BlastRadius/2/3 — graves ability primary hit 위치 기준 N hex 내 적군에 추가 magic 폭발.
 * 거리 별 base × (1 - DamageReductionPerHex × distance) 감소.
 *
 * raw: IncreasedRadius=1/2/3, DamageReductionPerHex=0.5/0.30/0.30.
 * 기존 ability primaryTargets (cone hit) 에 이미 가한 적군 제외.
 * mitigation pipeline 적용 + on_kill/on_death + applyGravesHelperKill follow-up.
 */
function triggerAbilityBlastRadius(
  attacker: CombatUnit,
  primaryHitPos: HexCoord,
  primaryHitTargets: CombatUnit[],
  baseDmg: number,
  enemyTeam: CombatUnit[],
  occupiedPositions: Set<string>,
  killerArbiterState: ArbiterTriggerState,
  eventBus: EventBus,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): { dealt: number; rawDealt: number } {
  if (attacker.gravesBlastIncreasedRadius <= 0) return { dealt: 0, rawDealt: 0 };
  const radius = attacker.gravesBlastIncreasedRadius;
  const decay = attacker.gravesBlastDmgReductionPerHex;
  const primarySet = new Set(primaryHitTargets.map((t) => t.id));
  const candidates = enemyTeam
    .filter((e) => !primarySet.has(e.id) && e.state !== 'dead')
    .map((e) => ({ enemy: e, dist: hexDistance(primaryHitPos, e.position) }))
    .filter((x) => x.dist <= radius && x.dist >= 1);
  let dealt = 0;
  let rawDealt = 0;
  for (const { enemy, dist } of candidates) {
    const distFactor = Math.max(0, 1 - decay * dist);
    const reducedDmg = baseDmg * distFactor;
    rawDealt += reducedDmg;  // codex P2: raw (mitigation 전) 누적 — on_cast.rawValue 정합.
    let dmg = applyResistance(reducedDmg, enemy.stats.magicResist, attacker.stats.magicPen);
    if (enemy.damageReduction > 0) dmg *= (1 - enemy.damageReduction);
    dmg = applyShield(enemy, dmg, eventBus, tick);
    if (enemy.statusEffects.some(e => e.type === 'invulnerable')) dmg = 0;
    enemy.currentHp -= dmg;
    enemy.totalDamageTaken += dmg;
    attacker.totalDamageDealt += dmg;
    dealt += dmg;
    if (attacker.gravesLatentStoredPct > 0 && dmg > 0) {
      enemy.gravesLatentStored += dmg * attacker.gravesLatentStoredPct;
    }
    if (enemy.currentHp <= 0 && enemy.state !== 'dead') {
      enemy.currentHp = 0;
      enemy.state = 'dead';
      attacker.killCount++;
      eventBus.emit('on_kill', { sourceId: attacker.id, targetId: enemy.id, tick });
      eventBus.emit('on_death', { sourceId: enemy.id, targetId: attacker.id, tick });
      applyGravesHelperKill(attacker, enemy, enemyTeam, occupiedPositions, killerArbiterState, eventBus, tick, time, logs, tickLogs);
    }
  }
  return { dealt, rawDealt };
}

/**
 * SympatheticDetonation — graves ability primary hit 한 적 인접 1 hex 가까운 다른 적 1명에
 * 추가 magic 폭발. 단일 sympatheticTarget 만 처리 (게임 spec).
 *
 * raw: SympatheticDamageReduction=0.30.
 * codex P1 (PR #58): raw desc tooltip "@SympatheticDamageReduction*100@%" → 변수명 은
 * "Reduction" 이지만 실제 의미는 base 의 30% 데미지 (= 70% reduction). var × baseDmg 적용.
 */
function triggerAbilitySympatheticDetonation(
  attacker: CombatUnit,
  primaryHitTarget: CombatUnit,
  baseDmg: number,
  enemyTeam: CombatUnit[],
  occupiedPositions: Set<string>,
  killerArbiterState: ArbiterTriggerState,
  eventBus: EventBus,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): { dealt: number; rawDealt: number } {
  if (attacker.gravesSympatheticReduction <= 0) return { dealt: 0, rawDealt: 0 };
  const candidates = enemyTeam
    .filter((e) => e.id !== primaryHitTarget.id && e.state !== 'dead')
    .map((e) => ({ enemy: e, dist: hexDistance(primaryHitTarget.position, e.position) }))
    .filter((x) => x.dist <= 1)
    .sort((a, b) => a.dist - b.dist);
  if (candidates.length === 0) return { dealt: 0, rawDealt: 0 };
  const sympathy = candidates[0].enemy;
  // codex P1: raw 변수 (0.30) 가 곧 dealt damage fraction. baseDmg × 0.30 = 30% damage.
  const reducedDmg = baseDmg * attacker.gravesSympatheticReduction;
  let dmg = applyResistance(reducedDmg, sympathy.stats.magicResist, attacker.stats.magicPen);
  if (sympathy.damageReduction > 0) dmg *= (1 - sympathy.damageReduction);
  dmg = applyShield(sympathy, dmg, eventBus, tick);
  if (sympathy.statusEffects.some(e => e.type === 'invulnerable')) dmg = 0;
  sympathy.currentHp -= dmg;
  sympathy.totalDamageTaken += dmg;
  attacker.totalDamageDealt += dmg;
  if (attacker.gravesLatentStoredPct > 0 && dmg > 0) {
    sympathy.gravesLatentStored += dmg * attacker.gravesLatentStoredPct;
  }
  if (sympathy.currentHp <= 0 && sympathy.state !== 'dead') {
    sympathy.currentHp = 0;
    sympathy.state = 'dead';
    attacker.killCount++;
    eventBus.emit('on_kill', { sourceId: attacker.id, targetId: sympathy.id, tick });
    eventBus.emit('on_death', { sourceId: sympathy.id, targetId: attacker.id, tick });
    applyGravesHelperKill(attacker, sympathy, enemyTeam, occupiedPositions, killerArbiterState, eventBus, tick, time, logs, tickLogs);
  }
  return { dealt: dmg, rawDealt: reducedDmg };
}

function applyGravesStatUpgrades(units: CombatUnit[], upgrades: string[] | undefined): void {
  if (!upgrades || upgrades.length === 0) return;
  const target = findStrongestUnitByApi(units, 'TFT17_Graves');
  if (!target) return;
  const baseAd = target.champion.stats.damage * (STAR_SCALING[target.starLevel] || 1);

  // canonical order 로 정렬 — 입력 array 순서가 달라도 동일 set 이면 동일 결과.
  // 미지원 upgrade (Phase 3 메커닉) 는 GRAVES_STAT_UPGRADE_HANDLERS 에 없으므로 skip.
  // canonical order 에 없는 신규 upgrade 는 알파벳 순 fallback (정의 누락 가드).
  const requested = new Set(upgrades);
  const ordered: string[] = [];
  for (const id of GRAVES_UPGRADE_APPLY_ORDER) {
    if (requested.has(id) && GRAVES_STAT_UPGRADE_HANDLERS[id]) ordered.push(id);
  }
  const known = new Set(GRAVES_UPGRADE_APPLY_ORDER);
  const fallback = upgrades
    .filter(id => !known.has(id) && GRAVES_STAT_UPGRADE_HANDLERS[id])
    .sort();
  ordered.push(...fallback);

  const applied: string[] = [];
  for (const id of ordered) {
    GRAVES_STAT_UPGRADE_HANDLERS[id](target, baseAd);
    applied.push(id);
  }
  if (applied.length > 0) {
    target.gravesUpgrades = [...target.gravesUpgrades, ...applied];
  }
}

/** 전쟁기계 — BaseDR을 damageReduction에 적용 */
function applyJuggernautDR(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const jugg = activeTraits.find(t => t.trait.apiName === 'TFT16_Juggernaut' && t.activeEffect);
  if (!jugg?.activeEffect) return;
  const baseDR = (jugg.activeEffect.variables['BaseDR'] ?? 0) as number;
  if (baseDR <= 0) return;
  for (const u of units) {
    if (unitHasTrait(u, '전쟁기계')) {
      u.damageReduction += baseDR;
    }
  }
}

/**
 * 별돌보미 변종 effects 적용. 활성 trait 가 변종 (TFT17_Stargazer_*) 인 경우만
 * 해당 변종의 effect 변수를 적용. base TFT17_Stargazer 활성 (변종 미지정) 시
 * 효과 미적용.
 *
 * "강화된 칸" (empowered tiles) — `CONSTELLATION_TILE_PATTERN[id]` 의 hex 좌표
 * 풀 패턴 적용 (PR-3 단순화 — player level 점진 추가는 후속).
 *
 * 효과 분기:
 *   - *_Teamwide 변수 (예: Wolf_Health_Teamwide) → **강화 칸의 모든 아군**
 *     (별돌보미 trait 보유 무관)
 *   - 비-Teamwide 변수 (예: Wolf_Health, Wolf_ADAP) → **강화 칸의 별돌보미만**
 *     추가 stat
 */
function applyStargazerEffects(
  traits: ActiveTrait[],
  units: CombatUnit[],
  opposingUnits: CombatUnit[],
  constellation: StargazerConstellationId | undefined,
): void {
  const stargazer = traits.find((t) => t.trait.name === '별돌보미');
  if (!stargazer || !stargazer.activeEffect || stargazer.style === 0) return;

  const apiName = stargazer.trait.apiName;
  if (apiName === 'TFT17_Stargazer') return; // base trait — 변종 미지정
  if (!constellation) return;

  const eff = stargazer.activeEffect.variables;
  const empoweredTiles = CONSTELLATION_TILE_PATTERN[constellation];
  const isStargazerUnit = (u: CombatUnit): boolean => unitHasTrait(u, '별돌보미');
  // CONSTELLATION_TILE_PATTERN 은 player half (r=0..3) 만 정의. enemy 팀이
  // mirror 된 보드 (r=4..7) 에 있을 때 (skipMirror=false 또는 simulator 직접 호출)
  // 단순 좌표 비교는 항상 false → enemy 측이 효과 없음. mirror back 해서 검사.
  const isOnTile = (u: CombatUnit): boolean => {
    const checkPos = u.position.r >= 4 ? mirrorPosition(u.position) : u.position;
    return empoweredTiles.some((t) => t.q === checkPos.q && t.r === checkPos.r);
  };

  // 한 변종에 두 패스 — 강화 칸 모든 아군 + 강화 칸 별돌보미.
  // helper: per-unit stat 적용 (% fraction)
  const applyPctStats = (
    u: CombatUnit,
    hpPct: number,
    adapPct: number,
    asPct: number,
    drPct: number,
    resistsFlat: number,
  ) => {
    if (hpPct > 0) {
      u.maxHp = Math.round(u.maxHp * (1 + hpPct));
      u.currentHp = u.maxHp;
    }
    if (adapPct > 0) {
      u.stats.damage = Math.round(u.stats.damage * (1 + adapPct));
      // AP 는 percentage points 단위 — fraction × 100 가산 (다른 trait 컨벤션).
      u.stats.ap = (u.stats.ap ?? 0) + adapPct * 100;
    }
    if (asPct > 0) u.stats.attackSpeed *= (1 + asPct);
    if (drPct > 0) u.damageReduction += drPct;
    if (resistsFlat > 0) {
      u.stats.armor += resistsFlat;
      u.stats.magicResist += resistsFlat;
    }
  };

  // === Mountain 변종 (강화 칸 별돌보미만, teamwide 없음) ===
  if (apiName === 'TFT17_Stargazer_Mountain') {
    const hpPct = (eff.Mountain_Health ?? 0) as number;
    const adapPct = (eff.Mountain_ADAP ?? 0) as number;
    const asPct = (eff.Mountain_AS ?? 0) as number;
    const drPct = (eff.Mountain_DR ?? 0) as number;
    const resistsFlat = (eff.Mountain_Resists ?? 0) as number;
    // minUnits=8+ 활성 시 다른 모든 보너스를 (1 + StatIncrease) 배 증폭.
    const statIncrease = (eff.Mountain_StatIncrease ?? 0) as number;
    const amp = 1 + statIncrease;
    for (const u of units) {
      if (!isStargazerUnit(u) || !isOnTile(u)) continue;
      applyPctStats(u, hpPct * amp, adapPct * amp, asPct * amp, drPct * amp, resistsFlat * amp);
    }
    return;
  }

  // === Wolf (멧돼지) — Teamwide HP/AD/AP + 별돌보미 추가 HP/ADAP ===
  if (apiName === 'TFT17_Stargazer_Wolf') {
    const teamwide = (eff.Wolf_Health_Teamwide ?? 0) as number; // HP/AD/AP 동시
    const ownerHp = (eff.Wolf_Health ?? 0) as number;
    const ownerAdap = (eff.Wolf_ADAP ?? 0) as number; // percentage points (예: 10 = 10%)
    for (const u of units) {
      if (!isOnTile(u)) continue;
      // 강화 칸 모든 아군: HP/AD/AP +teamwide
      if (teamwide > 0) {
        u.maxHp = Math.round(u.maxHp * (1 + teamwide));
        u.currentHp = u.maxHp;
        u.stats.damage = Math.round(u.stats.damage * (1 + teamwide));
        u.stats.ap = (u.stats.ap ?? 0) + teamwide * 100;
      }
      // 강화 칸 별돌보미: 추가 HP fraction + ADAP percentage points
      if (isStargazerUnit(u)) {
        if (ownerHp > 0) {
          u.maxHp = Math.round(u.maxHp * (1 + ownerHp));
          u.currentHp = u.maxHp;
        }
        if (ownerAdap > 0) {
          u.stats.damage = Math.round(u.stats.damage * (1 + ownerAdap / 100));
          u.stats.ap = (u.stats.ap ?? 0) + ownerAdap;
        }
      }
    }
    return;
  }

  // === Medallion (메달) — Teamwide DA + 3성당 IncreasePer3Star ===
  if (apiName === 'TFT17_Stargazer_Medallion') {
    const baseDA = (eff.Medallion_DA ?? 0) as number; // percentage points
    const per3Star = (eff.Medallion_IncreasePer3Star ?? 0) as number;
    const threeStarCount = units.filter((u) => u.starLevel === 3).length;
    const totalDA = baseDA + per3Star * threeStarCount; // percentage points
    if (totalDA <= 0) return;
    const ampFraction = totalDA / 100;
    for (const u of units) {
      if (!isOnTile(u)) continue;
      u.damageAmp += ampFraction;
    }
    return;
  }

  // === Huntress (여사냥꾼) — Teamwide AS + 별돌보미 추가 AS / Heal / 표식 ===
  if (apiName === 'TFT17_Stargazer_Huntress') {
    const teamwideAs = (eff.Huntress_AS_Teamwide ?? 0) as number;
    const ownerAs = (eff.Huntress_AS ?? 0) as number;
    const healPercent = (eff.Huntress_Heal ?? 0) as number;
    const numMarks = Math.floor((eff.NumMarks ?? 0) as number);
    for (const u of units) {
      if (!isOnTile(u)) continue;
      if (teamwideAs > 0) u.stats.attackSpeed *= (1 + teamwideAs);
      if (isStargazerUnit(u)) {
        if (ownerAs > 0) u.stats.attackSpeed *= (1 + ownerAs);
        // 강화 칸 별돌보미 → 표식 적 사망 시 maxHp × healPercent 회복.
        if (healPercent > 0) u.stargazerHuntressHealPercent = healPercent;
      }
    }
    // 전투 시작 표식 — 적 팀 중 maxHp 기준 상위 numMarks 명에 'mark' statusEffect.
    // 상시 유지 (전투 종료까지). 같은 적에 mark 중복 방지.
    if (numMarks > 0 && opposingUnits.length > 0) {
      const sorted = [...opposingUnits]
        .filter((e) => e.state !== 'dead' && e.maxHp > 0)
        .sort((a, b) => b.maxHp - a.maxHp);
      const targets = sorted.slice(0, numMarks);
      for (const t of targets) {
        if (t.statusEffects.some((e) => e.type === 'mark')) continue;
        t.statusEffects.push({
          type: 'mark', sourceId: 'stargazer-huntress',
          remainingTicks: MAX_TICKS,
        });
      }
    }
    return;
  }

  // === Serpent (뱀) — Teamwide DR + 별돌보미 추가 DR / 중독 ===
  if (apiName === 'TFT17_Stargazer_Serpent') {
    const teamwideDr = (eff.Serpent_DR_Teamwide ?? 0) as number;
    const ownerDr = (eff.Serpent_DR ?? 0) as number;
    const poisonPercent = (eff.Serpent_Poison ?? 0) as number;
    const durationSec = (eff.Serpent_Duration ?? 0) as number;
    for (const u of units) {
      if (!isOnTile(u)) continue;
      if (teamwideDr > 0) u.damageReduction += teamwideDr;
      if (isStargazerUnit(u)) {
        if (ownerDr > 0) u.damageReduction += ownerDr;
        // 강화 칸 별돌보미 → 적 데미지 입힐 때 입힌 피해의 poisonPercent 를
        // durationSec 초간 magic DOT 으로 추가 (poison statusEffect).
        if (poisonPercent > 0 && durationSec > 0) {
          u.stargazerSerpentPoisonPercent = poisonPercent;
          u.stargazerSerpentDurationSec = durationSec;
        }
      }
    }
    return;
  }

  // === Shield (제단) — Teamwide HP/AS (percentage points) + 사망 트리거 cashout ===
  if (apiName === 'TFT17_Stargazer_Shield') {
    const teamwideHp = (eff.Shield_Health_Teamwide ?? 0) as number; // percentage points (예: 8 = 8%)
    const teamwideAs = (eff.Shield_AS_Teamwide ?? 0) as number;
    const cashoutHp = (eff.Shield_CashoutHP ?? 0) as number; // percentage points
    const cashoutAs = (eff.Shield_CashoutAS ?? 0) as number;
    const hpFrac = teamwideHp / 100;
    const asFrac = teamwideAs / 100;
    const cashoutHpFrac = cashoutHp / 100;
    const cashoutAsFrac = cashoutAs / 100;
    for (const u of units) {
      if (!isOnTile(u)) continue;
      if (hpFrac > 0) {
        u.maxHp = Math.round(u.maxHp * (1 + hpFrac));
        u.currentHp = u.maxHp;
      }
      if (asFrac > 0) u.stats.attackSpeed *= (1 + asFrac);
      if (isStargazerUnit(u)) {
        // cashout 발동 시 추가로 곱할 비율 저장 — 실제 적용은 NumDeaths 도달 시.
        if (cashoutHpFrac > 0) u.stargazerShieldCashoutHpFrac = cashoutHpFrac;
        if (cashoutAsFrac > 0) u.stargazerShieldCashoutAsFrac = cashoutAsFrac;
      }
    }
    return;
  }

  // === Fountain (우물) — 17.2 LIVE 비활성 (Riot patch note: "룰루와 자야 효과 찾는 중") ===
  //
  // 17.2 LIVE 패치노트에 "우물 비활성화" 명시. raw data 에는 hash 변수 + 값 정의되어 있지만
  // 인게임에서는 효과 미발동 상태. 시뮬도 동일하게 no-op 처리 (codex P1 정확성 가드).
  // 활성화하면 인게임에서 불가능한 combat power 발생 → 시뮬 결과 inflated.
  //
  // 매핑 보존 — 다음 patch 에서 reenable 시 즉시 활성화 가능.
  // legacy (pre-17.2) 경로는 유지: set 전환 / PBE rollback 시 자동 호환.
  //
  // raw hash 키 ↔ desc 변수 매핑 (minify 추정, 다음 reenable 시 사용):
  //   {8d19f5db} = Fountain_Interval = 2 (초)
  //   {d7e6d620} = Fountain_HealthRegen_Teamwide = 0.02 (2%)
  //   {f2840aed} = Fountain_HealthRegen = 0.04 (4%, 별돌보미 추가)
  //   {13a2a786} = Fountain_StackingADAP = 2 / 4 ((3)/(5) tier, % 단위)
  //
  // 17.2 메커니즘 (활성화 시):
  //   "강화된 칸 아군 N초마다 max HP × Teamwide% heal.
  //    강화된 칸 별돌보미 추가로 +HealthRegen% heal + StackingADAP% AD/AP 누적."
  if (apiName === 'TFT17_Stargazer_Fountain') {
    // legacy (16.x / pre-17.2) 경로 — Fountain_HealPercent 기반 ability 힐. set 전환 호환.
    const legacyHealPct = (eff.Fountain_HealPercent ?? 0) as number;
    const legacyTeamwideMana = (eff.Fountain_ManaRegen_Teamwide ?? 0) as number;
    const legacyOwnerMana = (eff.Fountain_ManaRegen ?? 0) as number;
    if (legacyHealPct > 0 || legacyTeamwideMana > 0 || legacyOwnerMana > 0) {
      for (const u of units) {
        if (!isOnTile(u)) continue;
        if (legacyTeamwideMana > 0) u.augmentManaRegen += legacyTeamwideMana;
        if (isStargazerUnit(u)) {
          if (legacyOwnerMana > 0) u.augmentManaRegen += legacyOwnerMana;
          if (legacyHealPct > 0) u.stargazerFountainHealPercent = legacyHealPct;
        }
      }
      return;
    }
    // 17.2 LIVE — Riot 비활성화 상태. 시뮬도 no-op.
    // 활성화 reenable 시 아래 매핑 코드 활성화:
    //   const teamRegenPct = (eff['{d7e6d620}'] ?? 0) as number;
    //   const selfRegenBonusPct = (eff['{f2840aed}'] ?? 0) as number;
    //   const stackingAdapPct = ((eff['{13a2a786}'] ?? 0) as number) / 100;
    //   for (const u of units) {
    //     if (!isOnTile(u)) continue;
    //     u.fountainHealPctPerTick = teamRegenPct;
    //     if (isStargazerUnit(u)) {
    //       u.fountainHealPctPerTick = teamRegenPct + selfRegenBonusPct;
    //       u.fountainStackingAdapPerTick = stackingAdapPct;
    //     }
    //   }
    return;
  }
}

function tickStatusEffects(
  unit: CombatUnit,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): void {
  for (const effect of unit.statusEffects) {
    effect.remainingTicks--;
    if (effect.type === 'burn' && effect.value) {
      unit.currentHp -= effect.value;
    }
    if (effect.type === 'poison' && effect.value) {
      unit.currentHp -= effect.value;
    }
  }

  // 만료된 상태이상 로그 생성 + side-effect cleanup (shield pool 차감 등).
  const expired = unit.statusEffects.filter(e => e.remainingTicks <= 0);
  for (const effect of expired) {
    // shield statusEffect 만료 시 unit.shield 에서 잔존 amount 차감 (codex P1 회귀 가드).
    // applyShield 가 damage 흡수 시 unit.shield 만 줄어들어 statusEffect.value 와 desync 가능.
    // Math.max(0, ...) 로 over-subtract 방지 — broken 상태 (unit.shield=0) 시에도 안전.
    if (effect.type === 'shield' && effect.value) {
      unit.shield = Math.max(0, unit.shield - effect.value);
    }
    const label = STATUS_EFFECT_LABELS[effect.type as StatusEffectType];
    if (label) {
      const log: CombatLog = {
        tick, time,
        type: 'status_expire',
        sourceId: unit.id,
        statusType: effect.type as StatusEffectType,
        message: `${unit.champion.name}의 ${label} 해제`,
      };
      logs.push(log);
      tickLogs.push(log);
    }
  }

  unit.statusEffects = unit.statusEffects.filter(e => e.remainingTicks > 0);
}

function canAct(unit: CombatUnit): boolean {
  return !unit.statusEffects.some(e => e.type === 'stun');
}

function canAutoAttack(unit: CombatUnit): boolean {
  return !unit.statusEffects.some(e => e.type === 'stun' || e.type === 'disarm');
}

/** 적 위치를 보드 반대편으로 미러링 (Axial 좌표) */
function mirrorPosition(pos: HexCoord): HexCoord {
  // r=0..3(적 원래) → r=7..4(미러), q는 보드 크기 기준 재계산
  const mirroredR = 7 - pos.r;
  // Offset col은 동일하게 유지, 새 row에 맞춰 q 재계산
  const originalCol = pos.q + Math.floor(pos.r / 2);
  const newQ = originalCol - Math.floor(mirroredR / 2);
  return { q: newQ, r: mirroredR };
}

function getEffectiveAttackSpeed(unit: CombatUnit): number {
  const slow = unit.statusEffects.find(e => e.type === 'slow');
  const mult = slow?.value ? Math.max(0.2, 1 - slow.value) : 1;
  let as = unit.stats.attackSpeed * mult;

  // 브라이어 패시브: 잃은 체력 1%당 AS 증가
  const briarSc = unit.champion.apiName === 'TFT17_Briar' ? getChampionScaling('TFT17_Briar') : null;
  if (briarSc) {
    const missingPct = 1 - (unit.currentHp / unit.maxHp);
    const asPerPct = starValue(briarSc.asPerMissingHpPercent as number[] | undefined, unit.starLevel) / 100;
    const apScale = briarSc.apScaling ? (1 + unit.stats.ap / 100) : 1;
    as *= (1 + missingPct * asPerPct * apScale);
  }

  // 최신상 RevUp/2 — 같은 대상 연속 공격 stack 한정 AS 가산 (cap = MaxBonus).
  if (unit.gravesRevUpPerStack > 0 && unit.gravesRevUpStackCount > 0) {
    const bonus = Math.min(
      unit.gravesRevUpStackCount * unit.gravesRevUpPerStack,
      unit.gravesRevUpMaxBonus,
    );
    as *= (1 + bonus);
  }

  // 최신상 GravBooster/2 — 처치 후 N attacks 동안 AS +40%.
  if (unit.gravesGravBoosterAttacksRemaining > 0 && unit.gravesGravBoosterBonusAS > 0) {
    as *= (1 + unit.gravesGravBoosterBonusAS);
  }

  return as;
}

/** Create Freljord turret units if trait is active */
function spawnFreljordTurrets(
  activeTraits: ActiveTrait[],
  team: 'player' | 'enemy',
  teamUnits: CombatUnit[],
  allUnits: CombatUnit[],
  _rng: SeededRNG,
): CombatUnit[] {
  const freljord = activeTraits.find(t => t.trait.apiName === 'TFT16_Freljord' && t.activeEffect);
  if (!freljord || !freljord.activeEffect) return [];

  const vars = freljord.activeEffect.variables;
  const numTurrets = (vars['{7dced3cd}'] ?? vars['NumTurrets'] ?? 1) as number;
  const healthPercent = ((vars['HealthPercent'] ?? 30) as number) / 100;
  const damagePercent = ((vars['DA'] ?? 10) as number) / 100;
  const stunDuration = (vars['StunDuration'] ?? 0) as number;

  const avgHp = teamUnits.reduce((sum, u) => sum + u.maxHp, 0) / (teamUnits.length || 1);
  const avgDmg = teamUnits.reduce((sum, u) => sum + u.stats.damage, 0) / (teamUnits.length || 1);

  const occupiedPositions = new Set(allUnits.filter(u => u.state !== 'dead').map(u => `${u.position.q},${u.position.r}`));

  const turrets: CombatUnit[] = [];
  for (let i = 0; i < numTurrets; i++) {
    // Find empty position in team's front rows
    const startRow = team === 'player' ? 4 : 0;
    const endRow = team === 'player' ? 6 : 2;
    let placed = false;
    for (let r = startRow; r <= endRow && !placed; r++) {
      const cols = [3, 2, 4, 1, 5, 0, 6]; // center-out
      for (const col of cols) {
        const q = col - Math.floor(r / 2);
        const key = `${q},${r}`;
        if (!occupiedPositions.has(key)) {
          const turretId = `${team}-turret-${i}`;
          const turretUnit: CombatUnit = {
            id: turretId,
            champion: { name: '얼어붙은 포탑', apiName: 'TFT16_FreljordTurret', cost: 0, traits: [], role: null, stats: { armor: 40, attackSpeed: 1.0, critChance: 0, critMultiplier: 1.5, damage: 0, hp: 0, initialMana: 0, magicResist: 40, mana: 0, range: 3 }, ability: { name: '냉기 사격', desc: '', icon: '', variables: [] } },
            team,
            position: { q, r },
            starLevel: 1,
            role: 'Specialist',
            items: [],
            currentHp: avgHp * healthPercent,
            maxHp: avgHp * healthPercent,
            currentMana: 0,
            maxMana: 999,
            state: 'idle',
            target: null,
            stats: { hp: avgHp * healthPercent, armor: 40, magicResist: 40, damage: avgDmg * damagePercent, attackSpeed: 1.0, critChance: 0, critMultiplier: 1.5, ap: 0, mana: 0, maxMana: 999, range: 3, armorPen: 0, magicPen: 0 },
            attackCooldown: 0,
            moveCooldown: 0,
            totalDamageDealt: 0,
            itemDamageDealt: 0,
            totalDamageTaken: 0,
            statusEffects: [],
            omnivamp: 0,
            damageAmp: 0,
            damageReduction: 0,
            shield: 0,
            augmentManaRegen: 0,
            augmentGrievousWounds: 0,
            augmentExecuteThreshold: 0,
            augmentBurnPercent: 0,
            inventionTankDamageAmp: 0,
            healAmp: 0,
            darkStarExecuteThreshold: 0,
            darkStarSupermassive: false,
            gravesFrame: null,
            gravesDoubleAttackChance: 0,
            gravesAbilityDamageBonus: 0,
            gravesUpgrades: [],
            gravesTankDamageAmp: 0,
            gravesNanoRegenPct: 0,
            gravesRipperReduce: 0,
            gravesEmergencyTriggerHpFrac: 0,
            gravesEmergencyShieldFrac: 0,
            gravesEmergencyDurationSec: 0,
            gravesEmergencyUsed: false,
            gravesShockwaveActive: false,
            gravesReactivePerStack: 0,
            gravesReactiveStackCount: 0,
            gravesTripleAttackChance: 0,
            gravesRevUpPerStack: 0,
            gravesRevUpMaxBonus: 0,
            gravesRevUpStickyTargetId: null,
            gravesRevUpStackCount: 0,
            gravesGravBoosterBonusAS: 0,
            gravesGravBoosterMaxAttacks: 0,
            gravesGravBoosterAttacksRemaining: 0,
            gravesLatentStoredPct: 0,
            gravesLatentStored: 0,
            gravesBuckshotProjectiles: 0,
            gravesBuckshotSpread: 0,
            gravesLaserPenetrationHexes: 0,
            gravesLaserDmgReductionPerTarget: 0,
            gravesFragDamage: 0,
            gravesFragProjectiles: 0,
            gravesMeltthroughArmorMR: 0,
            gravesBlastIncreasedRadius: 0,
            gravesBlastDmgReductionPerHex: 0,
            gravesSympatheticReduction: 0,
            gravesVoidCoefficientPct: 0,
            gravesChokeSpreadDecrease: 0,
            gravesAimAssistBonusPerHex: 0,
            partyHealRate: 0,
            partyHpThreshold: 0,
            partyUsed: false,
            partyHealing: false,
            mfReplicatorEffectiveness: 0,
            gragasCarryActive: false,
            leonaCarryActive: false,
            attackCount: 0,
            castCount: 0,
            killCount: 0,
            spellCanCrit: false,
            stargazerFountainHealPercent: 0,
            fountainHealPctPerTick: 0,
            fountainStackingAdapPerTick: 0,
            stargazerHuntressHealPercent: 0,
            stargazerSerpentPoisonPercent: 0,
            stargazerSerpentDurationSec: 0,
            stargazerShieldCashoutHpFrac: 0,
            stargazerShieldCashoutAsFrac: 0,
            bastionDoubleEndTick: 0,
            bastionDoubleArmorBonus: 0,
            bastionDoubleMrBonus: 0,
            sniperBaseDA: 0,
            sniperPerHexDA: 0,
          };
          // Store stun duration for prismatic tier
          if (stunDuration > 0) {
            (turretUnit as CombatUnit & { turretStunDuration?: number }).turretStunDuration = stunDuration;
          }
          turrets.push(turretUnit);
          occupiedPositions.add(key);
          placed = true;
          break;
        }
      }
    }
  }
  return turrets;
}

/** 갈리오 영웅 소환 — 데마시아 결집 시 대기석 갈리오가 전투에 합류 */
function trySpawnGalio(
  activeTraits: ActiveTrait[],
  team: 'player' | 'enemy',
  teamUnits: CombatUnit[],
  opposingUnits: CombatUnit[],
  allUnits: CombatUnit[],
  galioInfo: { champion: RawChampion; starLevel: number } | null | undefined,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  spawnedFlag: { spawned: boolean },
  eventBus: EventBus,
): CombatUnit | null {
  if (spawnedFlag.spawned) return null;
  if (!galioInfo) return null;

  const demacia = activeTraits.find(t => t.trait.apiName === 'TFT16_Demacia' && t.activeEffect);
  if (!demacia || !demacia.activeEffect) return null;

  const maxHealthLost = (demacia.activeEffect.variables['MaxHealthLost'] ?? 0.25) as number;

  // 아군 팀 HP 손실 비율 체크
  const totalMaxHp = teamUnits.reduce((sum, u) => sum + u.maxHp, 0);
  const totalCurrentHp = teamUnits.filter(u => u.state !== 'dead').reduce((sum, u) => sum + u.currentHp, 0);
  if (totalMaxHp === 0) return null;

  const hpLostRatio = 1 - (totalCurrentHp / totalMaxHp);
  if (hpLostRatio < maxHealthLost) return null;

  // 소환 트리거!
  spawnedFlag.spawned = true;

  const { stats } = calculateStats(galioInfo.champion, galioInfo.starLevel, [], activeTraits, {});
  const star = galioInfo.starLevel as 1 | 2 | 3;

  // 적 전방 빈 칸에 착지
  const occupiedPositions = new Set(
    allUnits.filter(u => u.state !== 'dead').map(u => `${u.position.q},${u.position.r}`)
  );
  const aliveEnemies = opposingUnits.filter(u => u.state !== 'dead');
  let spawnPos: HexCoord | null = null;

  // 적이 가장 밀집한 곳 근처 빈 칸
  if (aliveEnemies.length > 0) {
    const avgQ = Math.round(aliveEnemies.reduce((s, u) => s + u.position.q, 0) / aliveEnemies.length);
    const avgR = Math.round(aliveEnemies.reduce((s, u) => s + u.position.r, 0) / aliveEnemies.length);
    const center: HexCoord = { q: avgQ, r: avgR };
    const neighbors = getNeighbors(center);
    for (const n of [center, ...neighbors]) {
      if (!occupiedPositions.has(coordKey(n))) {
        spawnPos = n;
        break;
      }
    }
  }

  // 밀집 지역에 빈 칸이 없으면 팀 전방 빈 칸
  if (!spawnPos) {
    const startRow = team === 'player' ? 4 : 0;
    const endRow = team === 'player' ? 6 : 2;
    for (let r = startRow; r <= endRow && !spawnPos; r++) {
      for (const col of [3, 2, 4, 1, 5, 0, 6]) {
        const q = col - Math.floor(r / 2);
        if (!occupiedPositions.has(`${q},${r}`)) {
          spawnPos = { q, r };
          break;
        }
      }
    }
  }
  if (!spawnPos) return null;

  const galioId = `${team}-galio`;
  const galio: CombatUnit = {
    id: galioId,
    champion: galioInfo.champion,
    team,
    position: spawnPos,
    starLevel: star,
    role: mapGameRole(galioInfo.champion.role),
    items: [],
    currentHp: stats.hp,
    maxHp: stats.hp,
    currentMana: stats.mana,
    maxMana: stats.maxMana,
    state: 'idle',
    target: null,
    stats,
    attackCooldown: 0,
    moveCooldown: 0,
    totalDamageDealt: 0,
    itemDamageDealt: 0,
    totalDamageTaken: 0,
    statusEffects: [],
    omnivamp: 0,
    damageAmp: 0,
    damageReduction: 0,
    shield: 0,
    augmentManaRegen: 0,
    augmentGrievousWounds: 0,
    augmentExecuteThreshold: 0,
    augmentBurnPercent: 0,
    inventionTankDamageAmp: 0,
    healAmp: 0,
    darkStarExecuteThreshold: 0,
    darkStarSupermassive: false,
    gravesFrame: null,
    gravesDoubleAttackChance: 0,
    gravesAbilityDamageBonus: 0,
    gravesUpgrades: [],
    gravesTankDamageAmp: 0,
    gravesNanoRegenPct: 0,
    gravesRipperReduce: 0,
    gravesEmergencyTriggerHpFrac: 0,
    gravesEmergencyShieldFrac: 0,
    gravesEmergencyDurationSec: 0,
    gravesEmergencyUsed: false,
    gravesShockwaveActive: false,
    gravesReactivePerStack: 0,
    gravesReactiveStackCount: 0,
    gravesTripleAttackChance: 0,
    gravesRevUpPerStack: 0,
    gravesRevUpMaxBonus: 0,
    gravesRevUpStickyTargetId: null,
    gravesRevUpStackCount: 0,
    gravesGravBoosterBonusAS: 0,
    gravesGravBoosterMaxAttacks: 0,
    gravesGravBoosterAttacksRemaining: 0,
    gravesLatentStoredPct: 0,
    gravesLatentStored: 0,
    gravesBuckshotProjectiles: 0,
    gravesBuckshotSpread: 0,
    gravesLaserPenetrationHexes: 0,
    gravesLaserDmgReductionPerTarget: 0,
    gravesFragDamage: 0,
    gravesFragProjectiles: 0,
    gravesMeltthroughArmorMR: 0,
    gravesBlastIncreasedRadius: 0,
    gravesBlastDmgReductionPerHex: 0,
    gravesSympatheticReduction: 0,
    gravesVoidCoefficientPct: 0,
    gravesChokeSpreadDecrease: 0,
    gravesAimAssistBonusPerHex: 0,
    partyHealRate: 0,
    partyHpThreshold: 0,
    partyUsed: false,
    partyHealing: false,
    mfReplicatorEffectiveness: 0,
    gragasCarryActive: false,
    leonaCarryActive: false,
    attackCount: 0,
    castCount: 0,
    killCount: 0,
    spellCanCrit: false,
    stargazerFountainHealPercent: 0,
    fountainHealPctPerTick: 0,
    fountainStackingAdapPerTick: 0,
    stargazerHuntressHealPercent: 0,
    stargazerSerpentPoisonPercent: 0,
    stargazerSerpentDurationSec: 0,
    stargazerShieldCashoutHpFrac: 0,
    stargazerShieldCashoutAsFrac: 0,
    bastionDoubleEndTick: 0,
    bastionDoubleArmorBonus: 0,
    bastionDoubleMrBonus: 0,
    sniperBaseDA: 0,
    sniperPerHexDA: 0,
  };

  // 착지 충격파 — 영웅 시너지 variables
  const heroTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Heroic' && t.activeEffect);
  const heroVars = heroTrait?.activeEffect?.variables ?? {};
  const hexRadius = (heroVars['HexRadius'] ?? 3) as number;
  const percentMaxHP = (heroVars['PercentMaxHP'] ?? 0.10) as number;
  const knockupDuration = (heroVars['KnockupDuration'] ?? 1) as number;

  const impactHexes = getHexesInRadius(spawnPos, hexRadius);
  const impactSet = new Set(impactHexes.map(h => `${h.q},${h.r}`));
  let totalImpactDmg = 0;

  for (const enemy of aliveEnemies) {
    if (!impactSet.has(`${enemy.position.q},${enemy.position.r}`)) continue;
    const rawDmg = enemy.maxHp * percentMaxHP;
    const finalDmg = applyResistance(rawDmg, enemy.stats.magicResist);
    enemy.currentHp -= finalDmg;
    enemy.totalDamageTaken += finalDmg;
    totalImpactDmg += finalDmg;

    // 거리 비례 기절
    const dist = hexDistance(spawnPos, enemy.position);
    const stunDur = knockupDuration * Math.max(0.5, 1 - dist * 0.15);
    const stunTicks = Math.round(stunDur * TICKS_PER_SECOND);
    enemy.statusEffects.push({ type: 'stun', sourceId: galioId, remainingTicks: stunTicks });
    enemy.state = 'idle';
    enemy.attackCooldown = 0;

    if (enemy.currentHp <= 0) {
      enemy.currentHp = 0;
      enemy.state = 'dead';
      // 누락된 on_death emit (codex P1) — Shield cashout sacrifice 카운트 등 event-driven 핸들러 보장.
      eventBus.emit('on_death', { sourceId: enemy.id, targetId: galioId, tick });
    }
  }

  const spawnLog: CombatLog = {
    tick, time, type: 'ability', sourceId: galioId,
    value: Math.round(totalImpactDmg),
    message: `갈리오 소환! 착지 충격파 — ${hexRadius}칸 범위 적에게 최대 체력 ${Math.round(percentMaxHP * 100)}% 마법 피해 + 기절`,
  };
  logs.push(spawnLog);
  tickLogs.push(spawnLog);

  // 데마시아 결집 버프 — ArmorMR / ManaReductionPct / EnemyTrueDamage
  const dVars = demacia.activeEffect.variables;
  const rallyArmorMR = (dVars['ArmorMR'] ?? 0) as number;
  const manaReductionPct = (dVars['ManaReductionPct'] ?? 0) as number;
  const enemyTrueDamage = (dVars['EnemyTrueDamage'] ?? 0) as number;

  for (const u of teamUnits) {
    if (!unitHasTrait(u, '데마시아') || u.state === 'dead') continue;
    u.stats.armor += rallyArmorMR;
    u.stats.magicResist += rallyArmorMR;
    if (manaReductionPct > 0) {
      u.maxMana = Math.round(u.maxMana * (1 - manaReductionPct));
    }
    if (enemyTrueDamage > 0) {
      u.damageAmp += enemyTrueDamage;
    }
  }

  return galio;
}

/** 필트오버 모듈 한글명 매핑 */
const PILTOVER_MODULE_NAMES: Record<string, string> = {
  '90CaliberNets': '90구경 그물',
  'BlastShield': '폭발 방패',
  'ElectricalOverload': '전기 과부하',
  'EMP': 'EMP',
  'OverclockedCapacitors': '오버클럭 축전기',
  'TunedOscillator': '튜닝된 오실레이터',
  'ContinuumCogs': '연속 톱니',
  'GigantificationRay': '거대화 광선',
  'KineticBarrier': '역장 방벽',
  'MagnetronCoil': '마그네트론 코일',
  'MicroRockets': '마이크로 로켓',
  'AccelerationGate': '가속의 문',
  'Upgrade': '업그레이드',
  'ArmorNullifier': '방어구 무효화기',
  'EchoEngine': '에코 엔진',
  'MiningDrill': '채굴 드릴',
  'SuperiorLifeform': '우월한 생명체',
  'VoltageConduit': '전압 도관',
  'MomentumDrive': '모멘텀 드라이브',
  'UnstableCore': '불안정한 코어',
};

function getModuleShortName(apiName: string): string {
  const key = apiName.replace('TFT16_Item_Piltover_', '');
  return PILTOVER_MODULE_NAMES[key] ?? key;
}

function pushInventionLog(
  logs: CombatLog[], tickLogs: CombatLog[],
  tick: number, time: number, sourceId: string,
  message: string, value?: number, targetId?: string,
): void {
  const log: CombatLog = { tick, time, type: 'ability', sourceId, message, value, targetId };
  logs.push(log);
  tickLogs.push(log);
}

/** 배열에서 무작위 n개 선택 (결정론적, 중복 없음) */
function pickRandomN<T>(arr: T[], n: number, rng: SeededRNG): T[] {
  const copy = [...arr];
  const result: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng.next() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

/** 유닛 레벨 모듈 (팀 전체가 아닌 장착 유닛만 적용) */

function getModuleKey(apiName: string): string {
  return apiName.replace('TFT16_Item_Piltover_', '');
}

/** Apply Piltover invention effects at specified tick */
function applyPiltoverInvention(
  activeTraits: ActiveTrait[],
  teamUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  teamModules: RawItem[],
  tick: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  time: number,
  rng: SeededRNG,
  eventBus: EventBus,
): void {
  const piltover = activeTraits.find(t => t.trait.apiName === 'TFT16_Piltover' && t.activeEffect);
  if (!piltover || !piltover.activeEffect) return;

  // 팀 모듈 슬롯 + 유닛 장착 필트오버 아이템 모두 수집
  const allPiltoverItems: RawItem[] = [...teamModules];
  for (const unit of teamUnits) {
    for (const item of unit.items) {
      if (item.apiName.includes('TFT16_Item_Piltover_')) {
        allPiltoverItems.push(item);
      }
    }
  }
  if (allPiltoverItems.length === 0) return;

  const fireTime = (piltover.activeEffect.variables['InventionFireTime'] ?? 5) as number;
  const fireTick = Math.round(fireTime / TICK_DURATION);
  if (tick !== fireTick) return;

  const aliveTeam = teamUnits.filter(u => u.state !== 'dead');
  const aliveEnemies = enemyUnits.filter(u => u.state !== 'dead');
  if (aliveTeam.length === 0) return;

  const processedModules = new Set<string>();
  // 대표 sourceId — 팀 모듈은 특정 유닛에 귀속되지 않으므로 첫 번째 생존 유닛 사용
  const sourceUnit = aliveTeam[0];

  for (const item of allPiltoverItems) {
    if (!item.apiName.includes('TFT16_Item_Piltover_')) continue;
    const moduleKey = getModuleKey(item.apiName);
    const moduleName = getModuleShortName(item.apiName);

    if (processedModules.has(moduleKey)) continue;
    processedModules.add(moduleKey);

    if (moduleKey === 'VoltageConduit') {
      const reduction = (item.effects['ManaReduction'] ?? 0.30) as number;
      for (const ally of aliveTeam) {
        if (unitHasTrait(ally, '필트오버')) {
          ally.maxMana = Math.round(ally.maxMana * (1 - reduction));
        }
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 필트오버 유닛 최대 마나 ${Math.round(reduction * 100)}% 감소`);

    } else if (moduleKey === 'MicroRockets') {
      const adRatio = (item.effects['DamageRepeat'] ?? 0.66) as number;
      const numMissiles = (item.effects['NumMissiles'] ?? 16) as number;
      const avgDamage = aliveTeam.reduce((sum, u) => sum + u.stats.damage, 0) / aliveTeam.length;
      const dmgPerMissile = Math.round(avgDamage * adRatio);
      let totalDmg = 0;
      for (let i = 0; i < numMissiles; i++) {
        const alive = aliveEnemies.filter(e => e.state !== 'dead' && e.currentHp > 0);
        if (alive.length === 0) break;
        const target = alive[Math.floor(rng.next() * alive.length)];
        const finalDmg = applyResistance(dmgPerMissile, target.stats.armor);
        target.currentHp -= finalDmg;
        target.totalDamageTaken += finalDmg;
        totalDmg += finalDmg;
        if (target.currentHp <= 0) {
          target.currentHp = 0;
          target.state = 'dead';
          // 누락된 on_death emit (codex P1) — Shield cashout 등 event-driven 핸들러 보장.
          eventBus.emit('on_death', { sourceId: target.id, targetId: sourceUnit.id, tick });
        }
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 미사일 ${numMissiles}발 (각 AD ${Math.round(adRatio * 100)}% 물리 피해, 총 ${Math.round(totalDmg)})`,
        Math.round(totalDmg));

    } else if (moduleKey === 'BlastShield') {
      const pct = (item.effects['PercentHealthShield'] ?? 0.18) as number;
      for (const ally of aliveTeam) {
        const shieldAmt = Math.round(ally.maxHp * pct);
        ally.shield += shieldAmt;
        ally.statusEffects.push({ type: 'shield', sourceId: ally.id, remainingTicks: MAX_TICKS, value: shieldAmt });
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 아군 최대 체력 ${Math.round(pct * 100)}% 보호막`);

    } else if (moduleKey === 'OverclockedCapacitors') {
      const asBonus = (item.effects['AttackSpeed'] ?? 0.25) as number;
      for (const ally of aliveTeam) {
        ally.stats.attackSpeed *= (1 + asBonus);
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 아군 공격 속도 +${Math.round(asBonus * 100)}%`);

    } else if (moduleKey === 'ContinuumCogs') {
      const apBonus = (item.effects['AbilityPower'] ?? 15) as number;
      const manaGen = (item.effects['ManaGen'] ?? 2) as number;
      for (const ally of aliveTeam) {
        ally.stats.ap += apBonus;
        ally.augmentManaRegen += manaGen;
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 아군 주문력 +${apBonus}, 초당 마나 +${manaGen}`);

    } else if (moduleKey === 'GigantificationRay') {
      const hpGainPct = (item.effects['MaxHealthGain'] ?? 0.28) as number;
      for (const ally of aliveTeam) {
        const hpGain = Math.round(ally.maxHp * hpGainPct);
        ally.maxHp += hpGain;
        ally.currentHp += hpGain;
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 아군 최대 체력 +${Math.round(hpGainPct * 100)}%`);

    } else if (moduleKey === 'KineticBarrier') {
      const higher = (item.effects['HigherResist'] ?? 65) as number;
      const lower = (item.effects['LowerResist'] ?? 30) as number;
      for (const ally of aliveTeam) {
        if (ally.stats.armor >= ally.stats.magicResist) {
          ally.stats.armor += higher;
          ally.stats.magicResist += lower;
        } else {
          ally.stats.magicResist += higher;
          ally.stats.armor += lower;
        }
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 높은 저항 +${higher}, 낮은 저항 +${lower}`);

    } else if (moduleKey === 'Upgrade') {
      const as = (item.effects['AttackSpeed'] ?? 0.25) as number;
      const hp = (item.effects['MaxHealth'] ?? 300) as number;
      for (const ally of aliveTeam) {
        ally.stats.attackSpeed *= (1 + as);
        ally.maxHp += hp;
        ally.currentHp += hp;
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 아군 공속 +${Math.round(as * 100)}%, 체력 +${hp}`);

    } else if (moduleKey === 'ElectricalOverload') {
      const flat = (item.effects['FlatDamage'] ?? 50) as number;
      const maxHpPct = (item.effects['MaxHealthRatio'] ?? 0.10) as number;
      let totalDmg = 0;
      for (const enemy of aliveEnemies) {
        if (enemy.state === 'dead' || enemy.currentHp <= 0) continue;
        const rawDmg = flat + Math.round(enemy.maxHp * maxHpPct);
        const finalDmg = applyResistance(rawDmg, enemy.stats.magicResist);
        enemy.currentHp -= finalDmg;
        enemy.totalDamageTaken += finalDmg;
        totalDmg += finalDmg;
        if (enemy.currentHp <= 0) {
          enemy.currentHp = 0;
          enemy.state = 'dead';
          // 누락된 on_death emit (codex P1) — Shield cashout 등 event-driven 핸들러 보장.
          eventBus.emit('on_death', { sourceId: enemy.id, targetId: sourceUnit.id, tick });
        }
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 적 전체에 ${flat} + 최대 체력 ${Math.round(maxHpPct * 100)}% 마법 피해 (총 ${Math.round(totalDmg)})`,
        Math.round(totalDmg));

    } else if (moduleKey === '90CaliberNets') {
      const duration = (item.effects['Duration'] ?? 2) as number;
      const numTargets = (item.effects['NumEnemies'] ?? 3) as number;
      const stunTicks = Math.round(duration * TICKS_PER_SECOND);
      const targets = pickRandomN(aliveEnemies, numTargets, rng);
      const targetNames: string[] = [];
      for (const enemy of targets) {
        enemy.statusEffects.push({ type: 'stun', sourceId: sourceUnit.id, remainingTicks: stunTicks });
        enemy.state = 'idle';
        enemy.attackCooldown = 0;
        targetNames.push(enemy.champion.name);
        pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
          `[발명품] ${enemy.champion.name}에게 기절 적용 (${duration}초)`,
          undefined, enemy.id);
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 적 ${targets.length}명 기절 ${duration}초 (${targetNames.join(', ')})`);

    } else if (moduleKey === 'EMP') {
      const manaIncrease = (item.effects['ManaCostIncrease'] ?? 15) as number;
      for (const enemy of aliveEnemies) {
        enemy.maxMana += manaIncrease;
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 적 전체 최대 마나 +${manaIncrease}`);

    } else if (moduleKey === 'MagnetronCoil') {
      const baseAmp = (item.effects['BaseDamageAmp'] ?? 0.16) as number;
      for (const ally of aliveTeam) {
        ally.damageAmp += baseAmp;
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 아군 피해증폭 +${Math.round(baseAmp * 100)}%`);

    } else if (moduleKey === 'ArmorNullifier') {
      const baseAmp = (item.effects['BaseDamageAmp'] ?? 0.25) as number;
      const tankAmp = (item.effects['TankDamageAmp'] ?? 0.45) as number;
      for (const ally of aliveTeam) {
        ally.damageAmp += baseAmp;
        ally.inventionTankDamageAmp += (tankAmp - baseAmp);
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 피해증폭 +${Math.round(baseAmp * 100)}% (탱커 대상 ${Math.round(tankAmp * 100)}%)`);

    } else if (moduleKey === 'AccelerationGate') {
      const manaRefill = (item.effects['ManaRefill'] ?? 0.35) as number;
      for (const ally of aliveTeam) {
        const manaGain = Math.round(ally.maxMana * manaRefill);
        ally.currentMana = Math.min(ally.maxMana, ally.currentMana + manaGain);
      }
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! 아군 마나 ${Math.round(manaRefill * 100)}% 회복`);

    } else {
      // 후순위 모듈 (EchoEngine, SuperiorLifeform, MomentumDrive, UnstableCore, MiningDrill, TunedOscillator)
      pushInventionLog(logs, tickLogs, tick, time, sourceUnit.id,
        `[발명품] ${moduleName} 발동! (효과 미구현)`);
    }
  }
}

/* ─── Arbiter Law helpers ─── */

interface ArbiterTriggerState {
  hitCount: number;
  attackCount: number;
  manaSpent: number;
  enemyDeathCount: number;
  hpTriggered: Set<string>;
}

function createArbiterTriggerState(): ArbiterTriggerState {
  return { hitCount: 0, attackCount: 0, manaSpent: 0, enemyDeathCount: 0, hpTriggered: new Set() };
}

function resolveArbiterValue(law: ArbiterLaw, arbiterCount: number): { value: number; triggerType: string; threshold?: number; intervalSeconds?: number; hpPercent?: number } | null {
  const tier = arbiterCount >= 3 ? 'gold' : 'silver';
  const triggerDef = arbiterLawsData.triggers.find((t: { id: string }) => t.id === law.triggerId);
  if (!triggerDef) return null;
  const lawEntries = (arbiterLawsData.laws as Record<string, Array<{ effect: string; silver: number; gold: number }>>)[law.triggerId];
  if (!lawEntries) return null;
  const entry = lawEntries.find(e => e.effect === law.effectId);
  if (!entry) return null;
  return {
    value: entry[tier],
    triggerType: triggerDef.type,
    threshold: (triggerDef as Record<string, unknown>).threshold as number | undefined,
    intervalSeconds: (triggerDef as Record<string, unknown>).intervalSeconds as number | undefined,
    hpPercent: (triggerDef as Record<string, unknown>).hpPercent as number | undefined,
  };
}

function applyArbiterEffect(effectId: string, value: number, units: CombatUnit[], tick: number, time: number, logs: CombatLog[], tickLogs: CombatLog[]) {
  const alive = units.filter(u => u.state !== 'dead');
  if (alive.length === 0) return;
  for (const u of alive) {
    switch (effectId) {
      case 'mana':
        u.currentMana = Math.min(u.maxMana, u.currentMana + value);
        break;
      case 'ap':
        u.stats.ap += value;
        break;
      case 'armor_mr':
        u.stats.armor += value;
        u.stats.magicResist += value;
        break;
      case 'attack_speed':
        u.stats.attackSpeed *= (1 + value / 100);
        break;
      case 'permanent_hp':
        u.maxHp += value;
        u.currentHp += value;
        break;
      case 'shield':
        u.shield += u.maxHp * value / 100;
        break;
    }
  }
  const effectName = arbiterLawsData.effects.find((e: { id: string }) => e.id === effectId)?.name ?? effectId;
  const log: CombatLog = { tick, time, type: 'ability', sourceId: 'arbiter-law', message: `중재자 법률 발동: ${effectName} +${value}` };
  logs.push(log);
  tickLogs.push(log);
}

/**
 * 프리즘 시너지 — 최고 tier 활성 시 게임 메타 효과 (무조건 승리 등).
 *
 * raw data 의 `style: 6` 가 prism 시그널. 4종 알려진 prism trait:
 *   - DarkStar (9): "10레벨 달성 시 모두를 빨아들임"
 *   - Astronaut (10): "정령군주 넷 소환!"
 *   - SpaceGroove (10): ADAPPerSecond=10, EffectBonus=500%, Duration=60초
 *   - Stargazer Mountain (11): Mountain 별자리 한정 11명
 *
 * 카운터 룰: 5코스트 3성 유닛 보유 측은 상대측 prism 을 무력화하고 승리.
 *   (게임 내 룰 — TFT17 5코 3성이 prism 대결 시 우선)
 *
 * sim 처리 전략: prism 활성 측을 즉시 winner 결정. 양쪽 동시 활성 시 무승부.
 * 별도 hidden unit 소환/effect 적용은 후속 PR (정확도 개선용).
 */
export function detectPrismTraits(activeTraits: ActiveTrait[]): { active: boolean; names: string[] } {
  const PRISM_API_NAMES = [
    'TFT17_DarkStar',
    'TFT17_Astronaut',
    'TFT17_SpaceGroove',
    'TFT17_Stargazer_Mountain',
  ];
  const names: string[] = [];
  for (const t of activeTraits) {
    if (!PRISM_API_NAMES.includes(t.trait.apiName)) continue;
    if (!t.activeEffect) continue;
    // style=6 만 prism 시그널 (다른 tier 는 style 1/3/5).
    if (t.activeEffect.style === 6) {
      names.push(`${t.trait.name}(${t.count})`);
    }
  }
  return { active: names.length > 0, names };
}

/** 팀에 5코스트 3성 유닛이 있는지 — prism counter 로 작용. */
export function hasFiveCostStar3(team: PlacedChampion[]): boolean {
  return team.some(p => p.champion.cost === 5 && p.starLevel === 3);
}

/**
 * prism + 5코3성 카운터 결과 산출. 사용 가능 시 winner, 그 외 null (정상 sim).
 *
 * 우선순위:
 *   1. 단방 prism + 상대측 5코3성 보유 → 5코3성 측 win (counter)
 *   2. 양쪽 prism (양측 5코3성 없거나 양쪽 모두 보유) → draw
 *   3. 양쪽 prism + 한쪽만 5코3성 → 5코3성 측 win
 *   4. 단방 prism + 상대측 5코3성 없음 → prism 측 win
 *   5. 둘 다 prism 비활성 → null (정상 sim)
 */
export function resolvePrismOutcome(
  playerPrism: { active: boolean; names: string[] },
  enemyPrism: { active: boolean; names: string[] },
  playerHas5cs3: boolean,
  enemyHas5cs3: boolean,
): { winner: 'player' | 'enemy' | 'draw'; reason: string } | null {
  if (!playerPrism.active && !enemyPrism.active) return null;

  // 5코3성 카운터 우선 적용
  if (playerHas5cs3 && enemyPrism.active && !enemyHas5cs3) {
    return { winner: 'player', reason: `5코스트 3성 카운터 (vs ${enemyPrism.names.join(', ')})` };
  }
  if (enemyHas5cs3 && playerPrism.active && !playerHas5cs3) {
    return { winner: 'enemy', reason: `5코스트 3성 카운터 (vs ${playerPrism.names.join(', ')})` };
  }

  // 양쪽 다 prism 활성
  if (playerPrism.active && enemyPrism.active) {
    return { winner: 'draw', reason: '양측 프리즘 동시 발동' };
  }
  if (playerPrism.active) {
    return { winner: 'player', reason: `프리즘 발동: ${playerPrism.names.join(', ')}` };
  }
  return { winner: 'enemy', reason: `프리즘 발동: ${enemyPrism.names.join(', ')}` };
}

export function simulateCombat(
  allyTeam: PlacedChampion[],
  enemyTeam: PlacedChampion[],
  seedOrOptions: number | SimulateOptions = 42
): CombatResult {
  const options: SimulateOptions = typeof seedOrOptions === 'number'
    ? { seed: seedOrOptions }
    : seedOrOptions;
  const seed = options.seed ?? 42;
  const allTraits = options.allTraits ?? [];

  const playerAugsWithStacks: AugmentWithStacks[] = (options.playerAugments ?? []).map(aug => ({
    augment: aug,
    stackCount: options.playerAugmentStacks?.[aug.apiName] ?? 1,
  }));
  const enemyAugsWithStacks: AugmentWithStacks[] = (options.enemyAugments ?? []).map(aug => ({
    augment: aug,
    stackCount: options.enemyAugmentStacks?.[aug.apiName] ?? 1,
  }));

  const playerAugmentEffects = resolveAugmentEffects(playerAugsWithStacks);
  const enemyAugmentEffects = resolveAugmentEffects(enemyAugsWithStacks);

  const playerInCombatEffects = resolveInCombatAugmentEffects(playerAugsWithStacks);
  const enemyInCombatEffects = resolveInCombatAugmentEffects(enemyAugsWithStacks);

  const playerActiveTraits = resolveTraits(allyTeam, allTraits, {
    stargazerConstellation: options.playerStargazerConstellation,
  });
  const enemyActiveTraits = resolveTraits(enemyTeam, allTraits, {
    stargazerConstellation: options.enemyStargazerConstellation,
  });

  // 프리즘 시너지 사전 판정 — unit 생성 후 short-circuit 결정 (units/snapshot 보존).
  const playerPrism = detectPrismTraits(playerActiveTraits);
  const enemyPrism = detectPrismTraits(enemyActiveTraits);
  const playerHas5cs3 = hasFiveCostStar3(allyTeam);
  const enemyHas5cs3 = hasFiveCostStar3(enemyTeam);
  const prismOutcome = resolvePrismOutcome(playerPrism, enemyPrism, playerHas5cs3, enemyHas5cs3);

  // Bilgewater stat effects — merge into augmentEffects for bilgewater units
  const playerBWEffects = options.playerBilgewaterEffects ?? {};
  const enemyBWEffects = options.enemyBilgewaterEffects ?? {};

  const playerAugApiNames = playerAugsWithStacks.map(a => a.augment.apiName);
  const enemyAugApiNames = enemyAugsWithStacks.map(a => a.augment.apiName);

  const rng: SeededRNG = createRNG(seed);
  const eventBus = new EventBus();

  // 갈리오는 필드에 배치되지만 전투 시작 시 제외 → 데마시아 결집 시 소환
  const isGalio = (p: PlacedChampion) => p.champion.apiName === 'TFT16_Galio';
  const playerGalioPlaced = allyTeam.find(isGalio);
  const enemyGalioPlaced = enemyTeam.find(isGalio);
  const playerTeamFiltered = allyTeam.filter(p => !isGalio(p));
  const enemyTeamFiltered = enemyTeam.filter(p => !isGalio(p));

  // options에서 전달된 갈리오보다 필드 배치된 갈리오 우선
  const effectivePlayerGalio = playerGalioPlaced
    ? { champion: playerGalioPlaced.champion, starLevel: playerGalioPlaced.starLevel }
    : options.playerGalio ?? null;
  const effectiveEnemyGalio = enemyGalioPlaced
    ? { champion: enemyGalioPlaced.champion, starLevel: enemyGalioPlaced.starLevel }
    : options.enemyGalio ?? null;

  // PsyOps (4) 시너지 활성 시 초능력 unit 의 일반 PsyOps 아이템 → Radiant 변종 자동 swap.
  // 게임 시스템: (2) tier 는 일반 효과만, (4) tier + 초능력 unit 만 Radiant 강화 효과.
  const playerPsyOpsT4 = isPsyOpsTier4Active(playerActiveTraits);
  const enemyPsyOpsT4 = isPsyOpsTier4Active(enemyActiveTraits);

  const playerUnits = playerTeamFiltered.map((p, i) => {
    const swapped = applyPsyOpsRadiantSwap(p, playerPsyOpsT4);
    const isBW = placedHasTrait(swapped, '빌지워터');
    const effects = isBW ? mergeEffects(playerAugmentEffects, playerBWEffects) : playerAugmentEffects;
    const unit = createCombatUnit(swapped, 'player', i, playerActiveTraits, effects);
    const mod = resolvePerUnitMods(playerAugsWithStacks, swapped.champion);
    applyPerUnitMods(unit, mod);
    applyPermanentStacks(unit, swapped);
    applyCarryAugmentRange(unit, playerAugApiNames);
    applyStartPassives(unit);
    return unit;
  });
  const enemies = enemyTeamFiltered.map((p, i) => {
    const positioned = options.skipMirror ? p : { ...p, position: mirrorPosition(p.position) };
    const swapped = applyPsyOpsRadiantSwap(positioned, enemyPsyOpsT4);
    const isBW = placedHasTrait(swapped, '빌지워터');
    const effects = isBW ? mergeEffects(enemyAugmentEffects, enemyBWEffects) : enemyAugmentEffects;
    const unit = createCombatUnit(swapped, 'enemy', i, enemyActiveTraits, effects);
    const mod = resolvePerUnitMods(enemyAugsWithStacks, swapped.champion);
    applyPerUnitMods(unit, mod);
    applyPermanentStacks(unit, swapped);
    applyCarryAugmentRange(unit, enemyAugApiNames);
    applyStartPassives(unit);
    return unit;
  });

  // 프리즘 short-circuit — unit/snapshot populated 상태로 즉시 결과 반환.
  // downstream (defeat-report, replay) 가 빈 배열에 대한 가정으로 깨지지 않도록.
  if (prismOutcome) {
    const prismLogs: CombatLog[] = [];
    if (playerPrism.active) {
      prismLogs.push({
        tick: 0, time: 0, type: 'ability', sourceId: 'prism',
        message: `프리즘 시너지 (player): ${playerPrism.names.join(', ')}`,
      });
    }
    if (enemyPrism.active) {
      prismLogs.push({
        tick: 0, time: 0, type: 'ability', sourceId: 'prism',
        message: `프리즘 시너지 (enemy): ${enemyPrism.names.join(', ')}`,
      });
    }
    prismLogs.push({
      tick: 0, time: 0, type: 'ability', sourceId: 'prism',
      message: `결과: ${prismOutcome.winner} — ${prismOutcome.reason}`,
    });
    return {
      winner: prismOutcome.winner,
      duration: 0,
      logs: prismLogs,
      playerUnits,
      enemyUnits: enemies,
      snapshots: [captureSnapshot(-1, [...playerUnits, ...enemies], [])],
    };
  }

  // Apply trait omnivamp bonuses
  const playerTraitOmnivamp = playerActiveTraits.find(t => t.trait.apiName === 'TFT16_Slayer' && t.activeEffect);
  if (playerTraitOmnivamp?.activeEffect) {
    const vamp = (playerTraitOmnivamp.activeEffect.variables['BonusOmnivamp'] ?? 0) as number;
    if (typeof vamp === 'number') {
      for (const u of playerUnits) { u.omnivamp += vamp; }
    }
  }
  const enemyTraitOmnivamp = enemyActiveTraits.find(t => t.trait.apiName === 'TFT16_Slayer' && t.activeEffect);
  if (enemyTraitOmnivamp?.activeEffect) {
    const vamp = (enemyTraitOmnivamp.activeEffect.variables['BonusOmnivamp'] ?? 0) as number;
    if (typeof vamp === 'number') {
      for (const u of enemies) { u.omnivamp += vamp; }
    }
  }

  // === Set 17 시너지 전투 버프 (JSON 기반) ===
  applySet17SynergyBuffs(playerActiveTraits, playerUnits);
  applySet17SynergyBuffs(enemyActiveTraits, enemies);

  // === 전사 AS 패시브 (스테이지 비례 5~30%) ===
  const stageNumber = options.stageNumber ?? 4;
  const fighterASBonus = getFighterASBonus(stageNumber);
  if (fighterASBonus > 0) {
    for (const u of playerUnits) {
      if (u.role === 'Fighter') u.stats.attackSpeed *= (1 + fighterASBonus);
    }
    for (const u of enemies) {
      if (u.role === 'Fighter') u.stats.attackSpeed *= (1 + fighterASBonus);
    }
  }

  // === 칸 버프 증강 ===
  if (options.playerHexBuffs?.length) applyHexBuffs(playerUnits, options.playerHexBuffs);
  if (options.enemyHexBuffs?.length) applyHexBuffs(enemies, options.enemyHexBuffs);

  const logs: CombatLog[] = [];

  // Apply trait combat-start bonuses
  applyWardenShields(playerActiveTraits, playerUnits);
  applyWardenShields(enemyActiveTraits, enemies);
  applyDefenderBonus(playerActiveTraits, playerUnits);
  applyDefenderBonus(enemyActiveTraits, enemies);
  applySorcererBonus(playerActiveTraits, playerUnits);
  applySorcererBonus(enemyActiveTraits, enemies);
  applyInvokerManaRegen(playerActiveTraits, playerUnits);
  applyInvokerManaRegen(enemyActiveTraits, enemies);
  applyJuggernautDR(playerActiveTraits, playerUnits);
  applyJuggernautDR(enemyActiveTraits, enemies);
  applyShenBastionAura(playerActiveTraits, playerUnits);
  applyShenBastionAura(enemyActiveTraits, enemies);
  applyJhinAnnihilator(playerActiveTraits, enemies);  // 적 대상
  applyJhinAnnihilator(enemyActiveTraits, playerUnits);
  // 파멸자 (Vex) — 적 ADAP 12% 강탈 → 가장 강한 Vex 에 가산.
  applyVexDoom(playerActiveTraits, playerUnits, enemies);
  applyVexDoom(enemyActiveTraits, enemies, playerUnits);
  // 은하계 사냥꾼 (Zed) — Zed +40% AD (분신 alive 가정 단순화).
  applyZedShadow(playerActiveTraits, playerUnits);
  applyZedShadow(enemyActiveTraits, enemies);
  // 파티광 (Blitzcrank) — HP threshold/healRate 설정 (main loop tick 에서 trigger).
  applyPartyTrickster(playerActiveTraits, playerUnits);
  applyPartyTrickster(enemyActiveTraits, enemies);
  // 복제자 (MF replicator mode) — Effectiveness 설정 (cast 시 추가 발동).
  applyReplicatorTrait(playerActiveTraits, playerUnits);
  applyReplicatorTrait(enemyActiveTraits, enemies);
  // Astronaut/Brawler HP 가산은 Stargazer (Huntress) maxHp 상위 N명 mark 선택 전에
  // 적용해야 정확한 maxHp 기준으로 mark — codex P2 회귀 가드.
  applyAstronautEffects(playerActiveTraits, playerUnits);
  applyAstronautEffects(enemyActiveTraits, enemies);
  // 싸움꾼 +HP — multiplicative. Astronaut flat (+BonusHealth) 적용 후 multiply.
  // 정령족+싸움꾼 동시 보유 챔프 없어 corner case 영향 없음.
  applyBrawlerEffects(playerActiveTraits, playerUnits);
  applyBrawlerEffects(enemyActiveTraits, enemies);
  applyStargazerEffects(playerActiveTraits, playerUnits, enemies, options.playerStargazerConstellation);
  applyStargazerEffects(enemyActiveTraits, enemies, playerUnits, options.enemyStargazerConstellation);
  applyMorganaDarklight(playerActiveTraits, playerUnits);
  applyMorganaDarklight(enemyActiveTraits, enemies);
  applyFateweaverEffects(playerActiveTraits, playerUnits);
  applyFateweaverEffects(enemyActiveTraits, enemies);
  applyBastionEffects(playerActiveTraits, playerUnits);
  applyBastionEffects(enemyActiveTraits, enemies);
  applySniperEffects(playerActiveTraits, playerUnits);
  applySniperEffects(enemyActiveTraits, enemies);
  applyTimebreakerEffects(playerActiveTraits, playerUnits);
  applyTimebreakerEffects(enemyActiveTraits, enemies);
  applyDarkStarEffects(playerActiveTraits, playerUnits);
  applyDarkStarEffects(enemyActiveTraits, enemies);
  applyPrimordianEffects(playerActiveTraits, playerUnits);
  applyPrimordianEffects(enemyActiveTraits, enemies);
  // 메카 (TFT17_Mecha) — 메카 unit 한정 AD%/AP flat 가산.
  // stat.ts generic processing 에서 제외 (모든 아군 적용 회귀 방지).
  applyMechaEffects(playerActiveTraits, playerUnits);
  applyMechaEffects(enemyActiveTraits, enemies);
  // hero augment carry 변환 — 자폭(그라가스) / 방패 여전사(레오나).
  applyHeroCarryTransforms(playerAugApiNames, playerUnits);
  applyHeroCarryTransforms(enemyAugApiNames, enemies);
  // 최신상 (GravesTrait) Frame — 가장 강한 그레이브즈 1명에 stat/메커닉 적용.
  applyGravesFrameEffects(playerUnits, options.playerGravesFrame);
  applyGravesFrameEffects(enemies, options.enemyGravesFrame);
  // 최신상 무기고 stat upgrade — Frame 과 동일 unit 에 누적.
  applyGravesStatUpgrades(playerUnits, options.playerGravesUpgrades);
  applyGravesStatUpgrades(enemies, options.enemyGravesUpgrades);
  // Shockwave (충격파) — 전투 시작 시 가까운 적 2명에 maxHp×15% 마법 + 2s stun.
  // applyGravesStatUpgrades 가 gravesShockwaveActive=true 설정한 unit 한정 발동.
  applyGravesShockwave(playerUnits, enemies, eventBus, logs);
  applyGravesShockwave(enemies, playerUnits, eventBus, logs);
  // 선봉대 보호막은 전투 시작 시점 (tick=0, time=0).
  applyVanguardEffects(playerActiveTraits, playerUnits, 0, 0, logs);
  applyVanguardEffects(enemyActiveTraits, enemies, 0, 0, logs);

  /**
   * N.O.V.A. (DRX) — power surge.
   *
   * Spec (TFT17_DRX):
   *   (2) TeamAttackDelay(=6) 초 후 N.O.V.A. 챔프별 효과 발동:
   *     - Aatrox: 적 ShredAndSunder=30% Armor/MR 감소
   *     - Caitlyn: 모든 아군 +AS=20%
   *     - Akali: 모든 아군 Precision (spell crit 가능)
   *     - Maokai: 모든 아군 maxHp × Heal=12% 회복
   *     - Kindred: 가장 강한 Tank 에 ShieldValue=800 shield
   *     - Emblem: BonusTrueDamage=10% (stacking — 후속)
   *   (5) Striker selector — 게임-level (후속)
   *
   * 챔프가 unit list 에 살아있어야 그 효과 활성. tick=TeamAttackDelay×TICKS_PER_SECOND
   * 시점에 main loop 가 발동.
   */
  const setupDrxNova = (activeTraits: ActiveTrait[], teamUnits: CombatUnit[], opposingTeam: CombatUnit[]) => {
    const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_DRX' && t.activeEffect);
    if (!trait?.activeEffect) return null;
    const v = trait.activeEffect.variables;
    const delayTicks = Math.round(((v.TeamAttackDelay ?? 0) as number) * TICKS_PER_SECOND);
    if (delayTicks <= 0) return null;
    return {
      teamUnits, opposingTeam, delayTicks, triggered: false,
      shredPct: (v.ShredAndSunder ?? 0) as number,
      asBonus: (v.AS ?? 0) as number,
      maokaiHealPct: (v.Heal ?? 0) as number,
      kindredShield: (v.ShieldValue ?? 0) as number,
    };
  };
  const playerDrxState = setupDrxNova(playerActiveTraits, playerUnits, enemies);
  const enemyDrxState = setupDrxNova(enemyActiveTraits, enemies, playerUnits);

  /**
   * main loop tick 마다 호출 — delayTicks 도달 시 한 번만 effect 적용.
   * 챔프 alive 체크는 surge 발동 시점에 재평가 (codex P1 회귀 가드):
   * setup 시점에 살아 있어도 delayTicks 전에 죽으면 그 챔프 효과 발동 안 됨.
   */
  const tickDrxNova = (state: ReturnType<typeof setupDrxNova>, tick: number, time: number) => {
    if (!state || state.triggered || tick < state.delayTicks) return;
    state.triggered = true;
    // surge 시점에 alive 한 N.O.V.A. 챔프만 효과 활성.
    const isAlive = (api: string) => state.teamUnits.some(u => u.champion.apiName === api && u.state !== 'dead');
    const hasAatrox = isAlive('TFT17_Aatrox');
    const hasCaitlyn = isAlive('TFT17_Caitlyn');
    const hasAkali = isAlive('TFT17_Akali');
    const hasMaokai = isAlive('TFT17_Maokai');
    const hasKindred = isAlive('TFT17_Kindred');
    if (hasAatrox && state.shredPct > 0) {
      for (const e of state.opposingTeam) {
        if (e.state === 'dead') continue;
        e.stats.armor *= (1 - state.shredPct);
        e.stats.magicResist *= (1 - state.shredPct);
      }
    }
    if (hasCaitlyn && state.asBonus > 0) {
      for (const u of state.teamUnits) {
        if (u.state === 'dead') continue;
        u.stats.attackSpeed *= (1 + state.asBonus);
      }
    }
    if (hasAkali) {
      for (const u of state.teamUnits) {
        if (u.state === 'dead') continue;
        u.spellCanCrit = true;
      }
    }
    if (hasMaokai && state.maokaiHealPct > 0) {
      for (const u of state.teamUnits) {
        if (u.state === 'dead') continue;
        // healAmp 곱셈 적용 — GrenadeMod_Radiant 등 회복량 증폭 효과 반영.
        const heal = u.maxHp * state.maokaiHealPct * (1 + (u.healAmp ?? 0));
        u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
      }
    }
    if (hasKindred && state.kindredShield > 0) {
      // 가장 강한 Tank = role==='Tank' 중 maxHp 최고
      const tanks = state.teamUnits.filter(u => u.state !== 'dead' && u.role === 'Tank');
      const strongest = tanks.sort((a, b) => b.maxHp - a.maxHp)[0];
      if (strongest) {
        strongest.shield += state.kindredShield;
        strongest.statusEffects.push({
          type: 'shield', sourceId: 'drx-kindred',
          remainingTicks: 9999, value: state.kindredShield,
        });
      }
    }
    logs.push({
      tick, time, type: 'ability',
      sourceId: 'drx-nova',
      message: `N.O.V.A. power surge 발동 (${hasAatrox ? 'Aatrox ' : ''}${hasCaitlyn ? 'Caitlyn ' : ''}${hasAkali ? 'Akali ' : ''}${hasMaokai ? 'Maokai ' : ''}${hasKindred ? 'Kindred' : ''})`.trim(),
    });
  };

  // 아이오니아 길 적용
  if (options.playerIoniaPath) {
    applyIoniaPath(playerActiveTraits, playerUnits, options.playerIoniaPath, logs);
  }
  if (options.enemyIoniaPath) {
    applyIoniaPath(enemyActiveTraits, enemies, options.enemyIoniaPath, logs);
  }

  /**
   * 별돌보미 뱀(Serpent) — 강화 칸 별돌보미 가 적에게 데미지 입힐 때 호출.
   * dmg × poisonPercent 를 durationSec 초간 분산해서 'poison' statusEffect 로 적용 (magic DOT).
   * 같은 caster 의 기존 poison 이 있으면 합산 (피해 누적, 만료 시간은 기존 유지).
   */
  const triggerSerpentPoison = (
    caster: CombatUnit,
    target: CombatUnit,
    dmgDealt: number,
  ): void => {
    if (caster.stargazerSerpentPoisonPercent <= 0 || caster.stargazerSerpentDurationSec <= 0) return;
    if (dmgDealt <= 0 || target.state === 'dead') return;
    const totalPoison = dmgDealt * caster.stargazerSerpentPoisonPercent;
    const ticks = Math.round(caster.stargazerSerpentDurationSec * TICKS_PER_SECOND);
    if (ticks <= 0) return;
    // 기존 poison (같은 caster source) 가 있으면:
    //   - 잔여 totalDamage 보존 (residualTotal = old.value × old.remainingTicks)
    //   - 새 totalPoison 합산 후 새 ticks 기준 perTick 재계산
    //   - duration refresh (codex P1: refresh 안 하면 hit 마다 partial 전달 → under-proc)
    const existing = target.statusEffects.find(
      (e) => e.type === 'poison' && e.sourceId === caster.id,
    );
    if (existing) {
      const residualTotal = (existing.value ?? 0) * existing.remainingTicks;
      existing.value = (residualTotal + totalPoison) / ticks;
      existing.remainingTicks = ticks;
    } else {
      target.statusEffects.push({
        type: 'poison', sourceId: caster.id,
        remainingTicks: ticks, value: totalPoison / ticks,
      });
    }
  };

  /**
   * 별돌보미 우물(Fountain) — ability 시전 후 호출.
   * 시전자가 stargazerFountainHealPercent > 0 이고 즉발 dmg > 0 일 때
   * 같은 팀 살아있는 unit 중 currentHp/maxHp 비율 가장 낮은 unit 회복 (자기 포함).
   * in-range cast path 와 OOR (dash/self_buff) cast path 모두 호출 (codex P1 회귀 가드).
   * tickLogs 는 caller 가 tick 단위 local 배열을 주입.
   */
  const triggerFountainHeal = (
    caster: CombatUnit,
    totalAbilityDmg: number,
    castTick: number,
    castTime: number,
    tickLogsRef: CombatLog[],
  ): void => {
    if (caster.stargazerFountainHealPercent <= 0 || totalAbilityDmg <= 0) return;
    const teammates = caster.team === 'player' ? playerUnits : enemies;
    let lowest: CombatUnit | null = null;
    let lowestRatio = Infinity;
    for (const a of teammates) {
      if (a.state === 'dead') continue;
      if (a.maxHp <= 0) continue;
      const ratio = a.currentHp / a.maxHp;
      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        lowest = a;
      }
    }
    if (!lowest) return;
    // healAmp 곱셈 적용 — Fountain heal 은 17.2 비활성 (legacy) 이지만 reactivate 시 일관성 보장.
    const healAmount = totalAbilityDmg * caster.stargazerFountainHealPercent * (1 + (lowest.healAmp ?? 0));
    lowest.currentHp = Math.min(lowest.maxHp, lowest.currentHp + healAmount);
    const healLog: CombatLog = {
      tick: castTick, time: castTime, type: 'ability',
      sourceId: caster.id, targetId: lowest.id,
      value: Math.round(healAmount),
      message: `${caster.champion.name} 우물 효과: ${lowest.champion.name} 체력 ${Math.round(healAmount)} 회복`,
    };
    logs.push(healLog);
    tickLogsRef.push(healLog);
  };

  // 수확자 — 적 사망 시 마나 획득 + 적 방저 감소
  function registerHarvester(activeTraits: ActiveTrait[], killerTeam: CombatUnit[], enemyTeam: CombatUnit[]): void {
    const harvester = activeTraits.find(t => t.trait.apiName === 'TFT16_Harvester' && t.activeEffect);
    if (!harvester?.activeEffect) return;
    const manaPerKill = (harvester.activeEffect.variables['ManaPerEnemyDeath'] ?? 0) as number;
    const armorMRReduction = (harvester.activeEffect.variables['EnemyArmorMRReduction'] ?? 0) as number;
    if (manaPerKill <= 0 && armorMRReduction <= 0) return;
    eventBus.on('on_death', 'harvester', () => {
      for (const u of killerTeam) {
        if (unitHasTrait(u, '수확자') && u.state !== 'dead') {
          u.currentMana = Math.min(u.maxMana, u.currentMana + manaPerKill);
        }
      }
      for (const e of enemyTeam) {
        if (e.state !== 'dead') {
          e.stats.armor = Math.max(0, e.stats.armor - armorMRReduction);
          e.stats.magicResist = Math.max(0, e.stats.magicResist - armorMRReduction);
        }
      }
    });
  }
  registerHarvester(playerActiveTraits, playerUnits, enemies);
  registerHarvester(enemyActiveTraits, enemies, playerUnits);

  /**
   * 별돌보미 여사냥꾼(Huntress) — 표식된 적 사망 시 같은 팀 강화 칸 별돌보미들이
   * maxHp × healPercent 만큼 회복. event-driven 으로 등록 (사망 원인 무관).
   * sourceId 는 죽은 unit (target) — opposingTeam 에서 마크 보유했는지 확인.
   */
  const registerHuntressHeal = (huntressTeam: CombatUnit[], huntressEnemies: CombatUnit[], handlerKey: string): void => {
    eventBus.on('on_death', handlerKey, ({ sourceId }) => {
      const dead = huntressEnemies.find((e) => e.id === sourceId);
      if (!dead) return; // 죽은 unit 이 huntressTeam 의 적군이 아니면 무관
      if (!dead.statusEffects.some((e) => e.type === 'mark')) return;
      for (const h of huntressTeam) {
        if (h.state === 'dead') continue;
        if (h.stargazerHuntressHealPercent <= 0) continue;
        // healAmp 곱셈 적용 — GrenadeMod_Radiant 등 회복량 증폭 효과 반영.
        const healAmount = h.maxHp * h.stargazerHuntressHealPercent * (1 + (h.healAmp ?? 0));
        h.currentHp = Math.min(h.maxHp, h.currentHp + healAmount);
      }
    });
  };
  registerHuntressHeal(playerUnits, enemies, 'stargazer-huntress-player');
  registerHuntressHeal(enemies, playerUnits, 'stargazer-huntress-enemy');

  /**
   * 별돌보미 제단(Shield) — 같은 팀 unit 사망 시 제물 카운트 증가.
   * 누적 (priorShieldDeaths + 시뮬 내 사망) ≥ NumDeaths 도달 시 그 팀 강화 칸
   * 별돌보미들에게 cashout buff (HP × 1+CashoutHP, AS × 1+CashoutAS) 일회 적용.
   * 게임-level 누적 (전 게임의 player 사망) 은 priorShieldDeaths 로 외부 입력.
   */
  // Shield_NumDeaths — raw trait variable 에서 동적 읽기 (drift 방지). 미정의 시 60 fallback.
  // player / enemy 가 다른 별자리 활성 가능성 → 각 팀별 trait active 여부 체크 후 변수 추출.
  const playerShieldTrait = playerActiveTraits.find(t => t.trait.apiName === 'TFT17_Stargazer_Shield' && t.activeEffect);
  const enemyShieldTrait = enemyActiveTraits.find(t => t.trait.apiName === 'TFT17_Stargazer_Shield' && t.activeEffect);
  const playerShieldNumDeaths = (playerShieldTrait?.activeEffect?.variables?.Shield_NumDeaths as number | undefined) ?? 60;
  const enemyShieldNumDeaths = (enemyShieldTrait?.activeEffect?.variables?.Shield_NumDeaths as number | undefined) ?? 60;
  let playerShieldDeaths = options.priorPlayerShieldDeaths ?? 0;
  let enemyShieldDeaths = options.priorEnemyShieldDeaths ?? 0;
  let playerShieldCashoutDone = false;
  let enemyShieldCashoutDone = false;
  const applyShieldCashout = (team: CombatUnit[]): void => {
    for (const u of team) {
      if (u.state === 'dead') continue;
      if (u.stargazerShieldCashoutHpFrac <= 0 && u.stargazerShieldCashoutAsFrac <= 0) continue;
      if (u.stargazerShieldCashoutHpFrac > 0) {
        const newMaxHp = Math.round(u.maxHp * (1 + u.stargazerShieldCashoutHpFrac));
        u.currentHp = Math.min(newMaxHp, u.currentHp + (newMaxHp - u.maxHp));
        u.maxHp = newMaxHp;
      }
      if (u.stargazerShieldCashoutAsFrac > 0) {
        u.stats.attackSpeed *= (1 + u.stargazerShieldCashoutAsFrac);
      }
    }
  };
  // priorShieldDeaths 만 으로 이미 threshold 도달했으면 전투 시작 시 즉시 적용.
  if (playerShieldDeaths >= playerShieldNumDeaths) {
    applyShieldCashout(playerUnits);
    playerShieldCashoutDone = true;
  }
  if (enemyShieldDeaths >= enemyShieldNumDeaths) {
    applyShieldCashout(enemies);
    enemyShieldCashoutDone = true;
  }
  eventBus.on('on_death', 'stargazer-shield', ({ sourceId }) => {
    // sourceId 는 죽은 unit 의 id. 어느 팀인지 식별 후 그 팀의 카운트 증가.
    // 소환체 (포탑/티버스/Azir 병사/Voyager 소환/Shen 분신) 는 제물 카운트 제외 (codex P2).
    const deadPlayerUnit = playerUnits.find((u) => u.id === sourceId);
    const deadEnemyUnit = enemies.find((u) => u.id === sourceId);
    if (deadPlayerUnit && !isAutoUnit(deadPlayerUnit.champion.apiName)) {
      playerShieldDeaths++;
      if (!playerShieldCashoutDone && playerShieldDeaths >= playerShieldNumDeaths) {
        applyShieldCashout(playerUnits);
        playerShieldCashoutDone = true;
      }
    }
    if (deadEnemyUnit && !isAutoUnit(deadEnemyUnit.champion.apiName)) {
      enemyShieldDeaths++;
      if (!enemyShieldCashoutDone && enemyShieldDeaths >= enemyShieldNumDeaths) {
        applyShieldCashout(enemies);
        enemyShieldCashoutDone = true;
      }
    }
  });

  // 전투 시작 시 유닛별 랜덤 첫 공격 딜레이 (0~0.3초)
  const maxDelayTicks = Math.round(INITIAL_ATTACK_DELAY * TICKS_PER_SECOND);
  for (const u of playerUnits) {
    u.attackCooldown = Math.floor(rng.next() * maxDelayTicks);
  }
  for (const u of enemies) {
    u.attackCooldown = Math.floor(rng.next() * maxDelayTicks);
  }

  const allUnits = [...playerUnits, ...enemies];

  // Spawn Freljord turrets
  const playerTurrets = spawnFreljordTurrets(playerActiveTraits, 'player', playerUnits, allUnits, rng);
  const enemyTurrets = spawnFreljordTurrets(enemyActiveTraits, 'enemy', enemies, allUnits, rng);
  allUnits.push(...playerTurrets, ...enemyTurrets);
  playerUnits.push(...playerTurrets);
  enemies.push(...enemyTurrets);


  const snapshots: TickSnapshot[] = [];
  const moveTicks = getMoveTicks();

  // 갈리오 영웅 소환 플래그
  const playerGalioFlag = { spawned: false };
  const enemyGalioFlag = { spawned: false };

  // 중재자 법률 런타임
  const playerArbiterUnits = playerUnits.filter(u => unitHasTrait(u, '중재자'));
  const enemyArbiterUnits = enemies.filter(u => unitHasTrait(u, '중재자'));
  const playerLawResolved = options.playerArbiterLaw && playerArbiterUnits.length >= 2
    ? resolveArbiterValue(options.playerArbiterLaw, playerArbiterUnits.length) : null;
  const enemyLawResolved = options.enemyArbiterLaw && enemyArbiterUnits.length >= 2
    ? resolveArbiterValue(options.enemyArbiterLaw, enemyArbiterUnits.length) : null;
  const playerArbiterState = createArbiterTriggerState();
  const enemyArbiterState = createArbiterTriggerState();

  // combat_start_per_star 즉시 적용
  if (playerLawResolved?.triggerType === 'combat_start_per_star' && options.playerArbiterLaw) {
    const totalStars = playerArbiterUnits.reduce((s, u) => s + u.starLevel, 0);
    applyArbiterEffect(options.playerArbiterLaw.effectId, playerLawResolved.value * totalStars, playerArbiterUnits, 0, 0, logs, []);
  }
  if (enemyLawResolved?.triggerType === 'combat_start_per_star' && options.enemyArbiterLaw) {
    const totalStars = enemyArbiterUnits.reduce((s, u) => s + u.starLevel, 0);
    applyArbiterEffect(options.enemyArbiterLaw.effectId, enemyLawResolved.value * totalStars, enemyArbiterUnits, 0, 0, logs, []);
  }

  // === Item Effect Runtime 설치 ===
  // applyResistance/applyShield/HP 감소/on_damage emit 까지 캡슐화한 고수준 피해 헬퍼.
  // Item Action 에서 발생하는 피해는 이 경로로만 적용 (중복 로직 방지).
  const applyDamageForItem = (
    target: CombatUnit,
    amount: number,
    type: DamageType,
    source: CombatUnit,
    tick: number,
  ): number => {
    const resistance = type === 'physical' ? target.stats.armor
      : type === 'magic' ? target.stats.magicResist : 0;
    const pen = type === 'physical' ? source.stats.armorPen
      : type === 'magic' ? source.stats.magicPen : 0;
    const amped = amount * (1 + source.damageAmp);
    const reduced = target.damageReduction > 0 ? amped * (1 - target.damageReduction) : amped;
    let dmg = type === 'true' ? reduced : applyResistance(reduced, resistance, pen);
    dmg = applyShield(target, dmg, eventBus, 0);
    if (dmg > 0) {
      target.currentHp -= dmg;
      target.totalDamageTaken += dmg;
      source.totalDamageDealt += dmg;
      source.itemDamageDealt += dmg;
    }
    eventBus.emit('on_damage', {
      sourceId: target.id,
      targetId: source.id,
      value: dmg,
      damageType: type,
      tick,
    });
    return dmg;
  };
  const itemRuntime = new ItemEffectRuntime(eventBus);
  const itemRuntimeDeps: ActionDeps = {
    allUnits,
    rng,
    eventBus,
    applyDamage: applyDamageForItem,
  };
  itemRuntime.install(allUnits, itemRuntimeDeps);

  eventBus.emit('on_combat_start', { sourceId: '', tick: 0 });

  // 초기 배치 스냅샷 — tick 0 처리 이전의 원본 포지션 보존.
  // 리플레이 첫 프레임에 배치 상태를 노출하여, tick 0 에 발생하는
  // 이동/공격/돌진 시전 등의 상태 변화를 사용자가 관찰 가능하게 한다.
  snapshots.push(captureSnapshot(-1, allUnits, []));

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const time = +(tick * TICK_DURATION).toFixed(4);
    const tickLogs: CombatLog[] = [];
    const alivePlayers = playerUnits.filter(u => u.state !== 'dead');
    const aliveEnemies = enemies.filter(u => u.state !== 'dead');

    if (alivePlayers.length === 0 || aliveEnemies.length === 0) break;

    // 요새 (Bastion) doubled buff 만료 처리 — 모든 global per-tick handlers (Piltover invention,
    // Galio impact 등) 가 mitigation 계산 시점에 정확한 stats 를 보도록 가장 먼저 처리 (codex P2).
    for (const u of allUnits) {
      if (u.state === 'dead') continue;
      tickBastionDouble(u, tick);
    }
    // N.O.V.A. (DRX) power surge — TeamAttackDelay 도달 시 한 번만 발동.
    tickDrxNova(playerDrxState, tick, time);
    tickDrxNova(enemyDrxState, tick, time);

    // 아이템 효과 runtime — interval timer dispatch
    itemRuntime.onTick(tick);

    // 갈리오 영웅 소환 체크 (매초)
    if (tick > 0 && tick % TICKS_PER_SECOND === 0) {
      const playerGalio = trySpawnGalio(playerActiveTraits, 'player', playerUnits, enemies, allUnits, effectivePlayerGalio, tick, time, logs, tickLogs, playerGalioFlag, eventBus);
      if (playerGalio) { allUnits.push(playerGalio); playerUnits.push(playerGalio); }
      const enemyGalio = trySpawnGalio(enemyActiveTraits, 'enemy', enemies, playerUnits, allUnits, effectiveEnemyGalio, tick, time, logs, tickLogs, enemyGalioFlag, eventBus);
      if (enemyGalio) { allUnits.push(enemyGalio); enemies.push(enemyGalio); }
    }

    // 중재자 법률 periodic trigger (매초 체크)
    if (tick > 0 && tick % TICKS_PER_SECOND === 0) {
      const checkLaw = (resolved: typeof playerLawResolved, law: ArbiterLaw | undefined, state: ArbiterTriggerState, units: CombatUnit[]) => {
        if (!resolved || !law) return;
        let fired = false;
        switch (resolved.triggerType) {
          case 'periodic':
            if (tick % ((resolved.intervalSeconds ?? 4) * TICKS_PER_SECOND) === 0) fired = true;
            break;
          case 'on_hit_count':
            if (state.hitCount >= (resolved.threshold ?? 10)) { fired = true; state.hitCount = 0; }
            break;
          case 'on_attack_count':
            if (state.attackCount >= (resolved.threshold ?? 3)) { fired = true; state.attackCount = 0; }
            break;
          case 'on_mana_spent':
            if (state.manaSpent >= (resolved.threshold ?? 50)) { fired = true; state.manaSpent -= (resolved.threshold ?? 50); }
            break;
          case 'on_enemy_death':
            for (let d = 0; d < state.enemyDeathCount; d++) {
              applyArbiterEffect(law.effectId, resolved.value, units, tick, time, logs, tickLogs);
            }
            state.enemyDeathCount = 0;
            return;
          case 'on_hp_threshold': {
            const alive = units.filter(u => u.state !== 'dead');
            for (const u of alive) {
              if (!state.hpTriggered.has(u.id) && u.currentHp / u.maxHp < (resolved.hpPercent ?? 40) / 100) {
                state.hpTriggered.add(u.id);
                fired = true;
              }
            }
            break;
          }
        }
        if (fired) applyArbiterEffect(law.effectId, resolved.value, units, tick, time, logs, tickLogs);
        state.enemyDeathCount = 0;
      };
      checkLaw(playerLawResolved, options.playerArbiterLaw, playerArbiterState, playerArbiterUnits);
      checkLaw(enemyLawResolved, options.enemyArbiterLaw, enemyArbiterState, enemyArbiterUnits);
    }

    // 별돌보미 우물(Fountain) tick 처리 — 강화 칸 unit 에 heal/stack 적용.
    // 17.2 LIVE 에서 우물 비활성 (applyStargazerEffects 가 fountainHealPctPerTick 설정 안 함)
    // → 모든 unit 의 fountainHealPctPerTick / fountainStackingAdapPerTick 가 0 → no-op.
    // 활성화 시 (legacy 경로 또는 reenable patch) interval 은 trait raw 변수에서 동적 읽기
    // (codex P2 가드 — hardcoded drift 방지).
    const fountainPlayerTrait = playerActiveTraits.find(t => t.trait.apiName === 'TFT17_Stargazer_Fountain');
    const fountainEnemyTrait = enemyActiveTraits.find(t => t.trait.apiName === 'TFT17_Stargazer_Fountain');
    const fountainPlayerVars = fountainPlayerTrait?.activeEffect?.variables;
    const fountainEnemyVars = fountainEnemyTrait?.activeEffect?.variables;
    // raw hash 키 {8d19f5db} = Fountain_Interval (초). legacy 데이터에는 미정의 → 기본 2초.
    const fountainIntervalSecs = (
      (fountainPlayerVars?.['{8d19f5db}'] as number | undefined)
      ?? (fountainEnemyVars?.['{8d19f5db}'] as number | undefined)
      ?? 2
    );
    const fountainTickPeriod = Math.max(1, Math.round(fountainIntervalSecs * TICKS_PER_SECOND));
    if (tick > 0 && tick % fountainTickPeriod === 0) {
      for (const u of allUnits) {
        if (u.state === 'dead') continue;
        if (u.fountainHealPctPerTick > 0) {
          const healBase = u.maxHp * u.fountainHealPctPerTick;
          const heal = healBase * (1 + (u.healAmp ?? 0));
          u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
        }
        if (u.fountainStackingAdapPerTick > 0) {
          // damage 누적 multiplicative. ap 는 percentage points (×100 fraction → 가산).
          u.stats.damage = u.stats.damage * (1 + u.fountainStackingAdapPerTick);
          u.stats.ap = (u.stats.ap ?? 0) + u.fountainStackingAdapPerTick * 100;
        }
      }
    }

    // 최신상 Nanomachines — 매 1초마다 maxHp × N% 자가 회복 (healAmp 곱셈 적용).
    if (tick > 0 && tick % TICKS_PER_SECOND === 0) {
      for (const u of allUnits) {
        if (u.state === 'dead') continue;
        if (u.gravesNanoRegenPct > 0) {
          const nanoBase = u.maxHp * u.gravesNanoRegenPct;
          const heal = nanoBase * (1 + (u.healAmp ?? 0));
          u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
        }
      }
    }

    // 최신상 Meltthrough — 매 1초 graves 주변 2hex 적군 armor/MR -N (영구 누적, floor 0).
    if (tick > 0 && tick % TICKS_PER_SECOND === 0) {
      for (const u of allUnits) {
        if (u.state === 'dead') continue;
        if (u.gravesMeltthroughArmorMR <= 0) continue;
        const enemyTeam = u.team === 'player' ? enemies : playerUnits;
        for (const e of enemyTeam) {
          if (e.state === 'dead') continue;
          if (hexDistance(u.position, e.position) > 2) continue;
          e.stats.armor = Math.max(0, e.stats.armor - u.gravesMeltthroughArmorMR);
          e.stats.magicResist = Math.max(0, e.stats.magicResist - u.gravesMeltthroughArmorMR);
        }
      }
    }

    // 최신상 EmergencyShielding/2 — tick pre-check (safety net).
    // codex P1 fix: damage application 직후 maybeTriggerEmergencyShield() 호출이
    // primary path (평타/DoubleTap inline). 본 tick pre-check 는 비-attack
    // damage source (DoT/burn/poison/regen 후 HP threshold crossing) 보완.
    for (const u of allUnits) {
      if (u.state === 'dead') continue;
      maybeTriggerEmergencyShield(u);
    }

    // 파티광 (Blitzcrank) — HP < threshold 도달 시 1회 invulnerable + heal mode.
    // HP 100% 도달 시 종료. 후속 SpaceGroove 효과는 미구현.
    for (const u of allUnits) {
      if (u.state === 'dead') continue;
      if (u.partyHpThreshold <= 0) continue;
      // Trigger: 미사용 + HP < threshold
      if (!u.partyUsed && u.maxHp > 0 && u.currentHp / u.maxHp < u.partyHpThreshold) {
        u.partyUsed = true;
        u.partyHealing = true;
        // invulnerable status — 매 tick 평타/스킬 hit 에서 자동 검사 (기존 가드 사용).
        u.statusEffects.push({
          type: 'invulnerable', sourceId: u.id,
          remainingTicks: MAX_TICKS, value: 1,  // heal 종료 시 명시적 제거.
        });
      }
      // Heal mode 진행 중: 매초 maxHp × healRate 회복. healAmp 곱셈 적용.
      if (u.partyHealing && tick > 0 && tick % TICKS_PER_SECOND === 0) {
        const partyBase = u.maxHp * u.partyHealRate;
        const heal = partyBase * (1 + (u.healAmp ?? 0));
        u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
      }
      // Heal 종료 — HP 100% 도달.
      if (u.partyHealing && u.currentHp >= u.maxHp) {
        u.partyHealing = false;
        u.statusEffects = u.statusEffects.filter(e => !(e.type === 'invulnerable' && e.sourceId === u.id));
      }
    }

    // In-combat augment effects (apply every second = every 30 ticks)
    if (tick > 0 && tick % TICKS_PER_SECOND === 0) {
      const combatSecond = tick / TICKS_PER_SECOND;
      for (const effect of playerInCombatEffects) {
        if (combatSecond <= effect.maxDuration) {
          const pctBonus = effect.statsPerSecond / 100;
          for (const u of alivePlayers) {
            u.stats.damage = u.stats.damage * (1 + pctBonus);
            u.stats.ap = u.stats.ap + effect.statsPerSecond;
          }
        }
      }
      for (const effect of enemyInCombatEffects) {
        if (combatSecond <= effect.maxDuration) {
          const pctBonus = effect.statsPerSecond / 100;
          for (const u of aliveEnemies) {
            u.stats.damage = u.stats.damage * (1 + pctBonus);
            u.stats.ap = u.stats.ap + effect.statsPerSecond;
          }
        }
      }
    }

    // Piltover invention trigger
    const playerModules = options.playerPiltoverModules ?? [];
    const enemyModules = options.enemyPiltoverModules ?? [];
    applyPiltoverInvention(playerActiveTraits, playerUnits, enemies, playerModules, tick, logs, tickLogs, time, rng, eventBus);
    applyPiltoverInvention(enemyActiveTraits, enemies, playerUnits, enemyModules, tick, logs, tickLogs, time, rng, eventBus);

    const occupiedPositions = new Set(
      allUnits.filter(u => u.state !== 'dead').map(u => coordKey(u.position))
    );

    // 도전자(TFT17_ASTrait) 시너지 활성 유닛 id 집합 — 매 틱 lookup 비용 절감.
    // 타겟 사망 시 새 타겟으로 돌진하는 hook 조건에 사용.
    const playerChallengerActive = playerActiveTraits.some(t => t.trait.apiName === 'TFT17_ASTrait' && t.activeEffect);
    const enemyChallengerActive = enemyActiveTraits.some(t => t.trait.apiName === 'TFT17_ASTrait' && t.activeEffect);
    const challengerIds = new Set<string>();
    if (playerChallengerActive) {
      for (const u of playerUnits) {
        if (unitHasTrait(u, '도전자')) challengerIds.add(u.id);
      }
    }
    if (enemyChallengerActive) {
      for (const u of enemies) {
        if (unitHasTrait(u, '도전자')) challengerIds.add(u.id);
      }
    }

    for (const unit of allUnits) {
      if (unit.state === 'dead') continue;

      tickStatusEffects(unit, tick, time, logs, tickLogs);
      gainManaPerTick(unit, TICK_DURATION);

      // Augment mana regen (per second, applied per tick)
      if (unit.augmentManaRegen > 0) {
        unit.currentMana = Math.min(unit.maxMana, unit.currentMana + unit.augmentManaRegen * TICK_DURATION);
      }

      if (unit.attackCooldown > 0) unit.attackCooldown--;
      if (unit.moveCooldown > 0) {
        unit.moveCooldown--;
        if (unit.moveCooldown === 0) unit.state = 'idle';
        continue;
      }

      if (!canAct(unit)) continue;

      // Totem(쉔 유물 등): 공격/이동 불가. 편집창에서 배치된 자리 고정 유지.
      if (unit.stats.range === 0 && unit.stats.damage === 0 && unit.stats.attackSpeed === 0) continue;

      const enemyTeamAlive = unit.team === 'player' ? aliveEnemies : alivePlayers;
      const prevTargetId = unit.target;
      const target = findTarget(unit, enemyTeamAlive, rng);
      if (!target) continue;

      // 도전자 시너지: 이전 타겟이 사망해 새 타겟으로 바뀐 순간 돌진.
      if (
        challengerIds.has(unit.id) &&
        prevTargetId && prevTargetId !== target.id
      ) {
        const allEnemy = unit.team === 'player' ? enemies : playerUnits;
        const prev = allEnemy.find(e => e.id === prevTargetId);
        if (prev && prev.state === 'dead') {
          applyAbilityDash(unit, 'to_target', target, enemyTeamAlive, occupiedPositions, logs, tickLogs, tick, time);
        }
      }

      unit.target = target.id;

      if (canAttack(unit.position, target.position, unit.stats.range)) {
        if (unit.attackCooldown <= 0 && canAutoAttack(unit)) {
          const attackInterval = Math.round(1 / (getEffectiveAttackSpeed(unit) * TICK_DURATION));
          unit.attackCooldown = attackInterval;

          // 공격 windup 시작 — PsyOps AttackPct 등의 공격 직전 버프 창 훅
          eventBus.emit('on_windup_start', { sourceId: unit.id, targetId: target.id, tick });

          const isCrit = rng.next() < unit.stats.critChance;
          const critMult = isCrit ? unit.stats.critMultiplier : 1;
          let totalDamageAmp = unit.damageAmp;
          if (unit.inventionTankDamageAmp > 0 && target.role === 'Tank') {
            totalDamageAmp += unit.inventionTankDamageAmp;
          }
          // 최신상 Tankbuster — 탱커 상대 추가 damage amp
          if (unit.gravesTankDamageAmp > 0 && target.role === 'Tank') {
            totalDamageAmp += unit.gravesTankDamageAmp;
          }
          // 저격수 (Sniper) — 거리 기반 추가 damage amp
          totalDamageAmp += computeSniperDamageAmp(unit, target);
          // 최신상 AimAssistant — distance 1 hex 당 +N% damage amp.
          if (unit.gravesAimAssistBonusPerHex > 0) {
            const dist = hexDistance(unit.position, target.position);
            totalDamageAmp += dist * unit.gravesAimAssistBonusPerHex;
          }
          const rawDamage = unit.stats.damage * critMult * (1 + totalDamageAmp);
          let finalDamage = applyResistance(rawDamage, target.stats.armor, unit.stats.armorPen);

          // Apply target's damage reduction from augments
          if (target.damageReduction > 0) {
            finalDamage *= (1 - target.damageReduction);
          }

          // Fighter/Assassin 비타겟 피해 감소 15%
          if ((target.role === 'Fighter' || target.role === 'Assassin') && target.target !== unit.id) {
            finalDamage *= (1 - NON_TARGET_DAMAGE_REDUCTION);
          }

          // 아이오니아 검의 길: 확률적 추가 물리 피해
          const bladeChance = (unit as CombatUnit & { ioniaBladeChance?: number }).ioniaBladeChance ?? 0;
          if (bladeChance > 0 && rng.next() < bladeChance) {
            const bladeBonusDmg = Math.round(unit.stats.damage * 0.5);
            finalDamage += applyResistance(bladeBonusDmg, target.stats.armor, unit.stats.armorPen);
          }

          finalDamage = applyShield(target, finalDamage, eventBus, tick);

          if (target.statusEffects.some(e => e.type === 'invulnerable')) {
            finalDamage = 0;
          }

          target.currentHp -= finalDamage;
          target.totalDamageTaken += finalDamage;
          unit.totalDamageDealt += finalDamage;

          // 최신상 RevUp/2 — sticky target 매칭 시 stack++, 다른 대상 시 reset.
          // 한 공격 = 1 stack (DoubleTap/TripleTap extra hit 은 별도 카운트 안 함).
          // codex P2: sticky target 을 잡는 hit 도 자체로 1 stack — raw "AttackSpeedPerAttack"
          // semantics 정합. 0 으로 reset 하면 다음 attack 까지 AS bonus 1 stack 늦게 시작.
          if (unit.gravesRevUpPerStack > 0) {
            if (unit.gravesRevUpStickyTargetId === target.id) {
              unit.gravesRevUpStackCount++;
            } else {
              unit.gravesRevUpStickyTargetId = target.id;
              unit.gravesRevUpStackCount = 1;
            }
          }

          // 최신상 EmergencyShielding/2 — codex P1: damage application 직후 즉시 체크
          // (1-tick burst 시 후속 hit 부터 shield 흡수 보장).
          maybeTriggerEmergencyShield(target);

          // 최신상 LatentExplosion — 입힌 피해 N% 를 target 의 stored 에 누적.
          // graves attacker 에서만 활성. target 사망 시 splash.
          if (unit.gravesLatentStoredPct > 0 && finalDamage > 0) {
            target.gravesLatentStored += finalDamage * unit.gravesLatentStoredPct;
          }

          // 최신상 Phase 3C-1 — 평타 base AOE (Buckshot/Laser/Frag).
          // 모든 helper 가 mitigation pipeline 적용 + on_kill/on_death emit (kill 시).
          // codex P2 (PR #57): kill 시 arbiter death count + LatentExplosion + GravBooster
          // follow-up 일관성 위해 occupiedPositions/arbiterState/tickLogs/time 전달.
          {
            const ownEnemyTeam = unit.team === 'player' ? enemies : playerUnits;
            const ownArbiterState = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
            triggerBuckshot(unit, target, finalDamage, ownEnemyTeam, occupiedPositions, ownArbiterState, eventBus, tick, time, logs, tickLogs);
            triggerLaserBallistics(unit, target, finalDamage, ownEnemyTeam, occupiedPositions, ownArbiterState, eventBus, tick, time, logs, tickLogs);
            triggerFragmentation(unit, target, finalDamage, ownEnemyTeam, occupiedPositions, ownArbiterState, eventBus, tick, time, logs, tickLogs);
          }

          // 별돌보미 뱀(Serpent) — 강화 칸 별돌보미 가 평타로 적 명중 시 중독 적용
          triggerSerpentPoison(unit, target, finalDamage);

          // 자동공격으로 적 처치
          if (target.currentHp <= 0 && target.state !== 'dead') {
            target.currentHp = 0;
            target.state = 'dead';
            unit.killCount++;
            // 중재자 on_enemy_death 플래그
            if (unit.team === 'player') playerArbiterState.enemyDeathCount++;
            else enemyArbiterState.enemyDeathCount++;
            const deathLog: CombatLog = { tick, time, type: 'death', sourceId: target.id, message: `${target.champion.name} 사망! (${unit.champion.name}의 기본 공격)` };
            logs.push(deathLog); tickLogs.push(deathLog);
            eventBus.emit('on_kill', { sourceId: unit.id, targetId: target.id, tick });
            eventBus.emit('on_death', { sourceId: target.id, targetId: unit.id, tick });
            // 최신상 LatentExplosion — target 사망 시 stored 누적량 splash.
            if (target.gravesLatentStored > 0) {
              const ownEnemyTeam = unit.team === 'player' ? enemies : playerUnits;
              const ownArbiterState = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
              triggerLatentExplosion(unit, target, ownEnemyTeam, eventBus, tick, time, logs, ownArbiterState);
            }
            // 최신상 GravBooster/2 — 처치 관여 시 dash + AS buff start (NumAttacks 동안).
            if (unit.gravesGravBoosterMaxAttacks > 0) {
              const ownEnemyTeam = unit.team === 'player' ? enemies : playerUnits;
              const aliveEnemiesForDash = ownEnemyTeam.filter(e => e.state !== 'dead');
              triggerGravBooster(unit, aliveEnemiesForDash, occupiedPositions, logs, tickLogs, tick, time);
            }
          }

          if (unit.omnivamp > 0 && finalDamage > 0) {
            const grievousReduction = target.augmentGrievousWounds > 0 ? (1 - target.augmentGrievousWounds) : 1;
            // healAmp 곱셈 적용 — 모든 피해 흡혈 (omnivamp) 도 회복량 증폭 효과 대상.
            const heal = finalDamage * unit.omnivamp * grievousReduction * (1 + (unit.healAmp ?? 0));
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
            eventBus.emit('on_heal', { sourceId: unit.id, value: heal, tick });
          }

          // 최신상 (GravesTrait) DoubleTap / TripleTap — 추가 hit 발동.
          //   - DoubleTap Frame (25%) + DoubleTap2 weapon (35%) 는 같은 필드 max() override.
          //   - TripleTap weapon (18%) 은 별개 roll — 발동 시 2 추가 hit, DoubleTap path skip (mutual exclusive).
          // codex P1 가드: rawDamage 부터 mitigation pipeline 다시 거쳐야 (shielded target
          // 에 첫 hit post-shield 값 재사용 시 under-damage 발생).
          // codex P2 가드: 풀 attack 이벤트 emit (on_attack/on_damage/on_hit/on_hit_taken)
          // — item runtime counter 등 attack-count 기반 시스템 정확 작동.
          let extraHits = 0;
          let extraHitReason = '사수 프레임 추가 공격';
          if (target.state !== 'dead') {
            if (unit.gravesTripleAttackChance > 0 && rng.next() < unit.gravesTripleAttackChance) {
              extraHits = 2;
              extraHitReason = '한 발에 세 놈 추가 공격';
            } else if (unit.gravesDoubleAttackChance > 0 && rng.next() < unit.gravesDoubleAttackChance) {
              extraHits = 1;
            }
          }
          for (let extraHitIdx = 0; extraHitIdx < extraHits; extraHitIdx++) {
            if (target.state === 'dead') break;
            // 새 hit — rawDamage 재사용 (동일 source stats 기반) + mitigation 재계산.
            // 단, crit 은 첫 hit 와 동일하게 취급 (rawDamage 에 critMult 이미 포함).
            let extraFinal = applyResistance(rawDamage, target.stats.armor, unit.stats.armorPen);
            if (target.damageReduction > 0) extraFinal *= (1 - target.damageReduction);
            if ((target.role === 'Fighter' || target.role === 'Assassin') && target.target !== unit.id) {
              extraFinal *= (1 - NON_TARGET_DAMAGE_REDUCTION);
            }
            extraFinal = applyShield(target, extraFinal, eventBus, tick);
            if (target.statusEffects.some(e => e.type === 'invulnerable')) extraFinal = 0;

            target.currentHp -= extraFinal;
            target.totalDamageTaken += extraFinal;
            unit.totalDamageDealt += extraFinal;
            unit.attackCount++;

            // 최신상 EmergencyShielding/2 — codex P1: DoubleTap/TripleTap 추가 hit 직후도 즉시 체크.
            maybeTriggerEmergencyShield(target);

            // 풀 attack 이벤트 emit — 일반 평타와 동일 path.
            eventBus.emit('on_attack', { sourceId: unit.id, targetId: target.id, value: extraFinal, tick });
            eventBus.emit('on_hit', { sourceId: unit.id, targetId: target.id, value: extraFinal, damageType: 'physical', tick });
            eventBus.emit('on_damage', { sourceId: target.id, targetId: unit.id, value: extraFinal, damageType: 'physical', tick });
            eventBus.emit('on_hit_taken', { sourceId: target.id, targetId: unit.id, value: extraFinal, damageType: 'physical', tick });

            // 최신상 RipperBullets/2 — 추가 hit 도 동일하게 armor/MR shred.
            // state 'dead' 마킹은 아래 currentHp <= 0 분기에서 처리 → 여기선 currentHp 만 가드.
            if (unit.gravesRipperReduce > 0 && target.currentHp > 0) {
              target.stats.armor = Math.max(0, target.stats.armor - unit.gravesRipperReduce);
              target.stats.magicResist = Math.max(0, target.stats.magicResist - unit.gravesRipperReduce);
            }
            // 최신상 ReactiveArmor — 추가 hit 도 stack 누적.
            if (target.gravesReactivePerStack > 0 && target.gravesReactiveStackCount < 50 && target.currentHp > 0) {
              target.stats.armor += target.gravesReactivePerStack;
              target.stats.magicResist += target.gravesReactivePerStack;
              target.gravesReactiveStackCount++;
            }

            // 최신상 LatentExplosion — 추가 hit 도 stored 에 누적.
            // codex P2: 치명 extra hit (currentHp <= 0 으로 만든 hit) 의 damage 도 stored 에
            // 포함되어야 splash 폭발량 정확. currentHp 가드 제거 — 평타 first hit 과 동일.
            if (unit.gravesLatentStoredPct > 0 && extraFinal > 0) {
              target.gravesLatentStored += extraFinal * unit.gravesLatentStoredPct;
            }

            // 최신상 Phase 3C-1 — 추가 hit 도 base AOE (Buckshot/Laser/Frag) 트리거.
            // codex P2 (PR #57): helper kill follow-up 일관성 (arbiter / LatentExplosion / GravBooster).
            {
              const ownEnemyTeam = unit.team === 'player' ? enemies : playerUnits;
              const ownArbiterState = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
              triggerBuckshot(unit, target, extraFinal, ownEnemyTeam, occupiedPositions, ownArbiterState, eventBus, tick, time, logs, tickLogs);
              triggerLaserBallistics(unit, target, extraFinal, ownEnemyTeam, occupiedPositions, ownArbiterState, eventBus, tick, time, logs, tickLogs);
              triggerFragmentation(unit, target, extraFinal, ownEnemyTeam, occupiedPositions, ownArbiterState, eventBus, tick, time, logs, tickLogs);
            }

            if (target.currentHp <= 0) {
              target.currentHp = 0;
              target.state = 'dead';
              unit.killCount++;
              if (unit.team === 'player') playerArbiterState.enemyDeathCount++;
              else enemyArbiterState.enemyDeathCount++;
              const dlog: CombatLog = { tick, time, type: 'death', sourceId: target.id, message: `${target.champion.name} 사망! (${extraHitReason})` };
              logs.push(dlog); tickLogs.push(dlog);
              eventBus.emit('on_kill', { sourceId: unit.id, targetId: target.id, tick });
              eventBus.emit('on_death', { sourceId: target.id, targetId: unit.id, tick });
              // 최신상 LatentExplosion — 추가 hit 으로 사망해도 splash 발동.
              if (target.gravesLatentStored > 0) {
                const ownEnemyTeam = unit.team === 'player' ? enemies : playerUnits;
                const ownArbiterState = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                triggerLatentExplosion(unit, target, ownEnemyTeam, eventBus, tick, time, logs, ownArbiterState);
              }
              // 최신상 GravBooster/2 — 추가 hit 으로 처치 시에도 trigger.
              if (unit.gravesGravBoosterMaxAttacks > 0) {
                const ownEnemyTeam = unit.team === 'player' ? enemies : playerUnits;
                const aliveEnemiesForDash = ownEnemyTeam.filter(e => e.state !== 'dead');
                triggerGravBooster(unit, aliveEnemiesForDash, occupiedPositions, logs, tickLogs, tick, time);
              }
            }

            // 별돌보미 뱀(Serpent) — 추가 hit 도 중독 적용.
            triggerSerpentPoison(unit, target, extraFinal);

            // omnivamp 도 추가 hit 에 적용 (attack 1회 와 동일). healAmp 곱셈 적용.
            if (unit.omnivamp > 0 && extraFinal > 0) {
              const grievousReduction = target.augmentGrievousWounds > 0 ? (1 - target.augmentGrievousWounds) : 1;
              const heal = extraFinal * unit.omnivamp * grievousReduction * (1 + (unit.healAmp ?? 0));
              unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
              eventBus.emit('on_heal', { sourceId: unit.id, value: heal, tick });
            }
          }

          // Augment burn: apply burn DoT on auto-attack
          if (unit.augmentBurnPercent > 0) {
            const burnDmg = target.maxHp * unit.augmentBurnPercent;
            const burnPerTick = burnDmg / (TICKS_PER_SECOND * 3); // 3초간 도트
            target.statusEffects.push({
              type: 'burn', sourceId: unit.id,
              remainingTicks: TICKS_PER_SECOND * 3,
              value: burnPerTick,
            });
            const burnLog: CombatLog = {
              tick, time,
              type: 'status_apply',
              sourceId: unit.id,
              targetId: target.id,
              statusType: 'burn',
              value: TICKS_PER_SECOND * 3,
              message: `${unit.champion.name}이(가) ${target.champion.name}에게 화상 적용 (3.0초)`,
            };
            logs.push(burnLog);
            tickLogs.push(burnLog);
          }

          gainManaOnAttack(unit);
          gainManaOnDamageTaken(target, finalDamage);

          unit.state = 'attacking';
          unit.attackCount++;

          // 최신상 GravBooster/2 — boosted attack 한 번 소비 (NumAttacks 카운트 다운).
          if (unit.gravesGravBoosterAttacksRemaining > 0) {
            unit.gravesGravBoosterAttacksRemaining--;
          }

          // 중재자 법률 카운터 업데이트
          if (unitHasTrait(unit, '중재자')) {
            const arbState = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
            arbState.hitCount++;
            arbState.attackCount++;
          }

          // === 케이틀린: 15% 확률 헤드샷 추가 물리 피해 ===
          if (unit.champion.apiName === 'TFT17_Caitlyn' && target.state !== 'dead') {
            const procChance = (unit.champion.ability.variables?.find(v => v.name === 'ProcChance')?.value?.[unit.starLevel] ?? 15) / 100;
            if (rng.next() < procChance) {
              const hsVar = unit.champion.ability.variables?.find(v => v.name === 'Damage');
              const hsDmg = hsVar?.value?.[unit.starLevel] ?? 170;
              const hsFinal = applyResistance(hsDmg * (1 + unit.damageAmp), target.stats.armor, unit.stats.armorPen);
              target.currentHp -= hsFinal;
              target.totalDamageTaken += hsFinal;
              unit.totalDamageDealt += hsFinal;
            }
          }

          // === 킨드레드: 3표식 패시브 — 기본공격+스킬이 표식, 3표식 도달 시 추가 물리 피해 ===
          if (unit.champion.apiName === 'TFT17_Kindred' && target.state !== 'dead') {
            const marks = ((target as CombatUnit & { _kindredMarks?: number })._kindredMarks ?? 0) + 1;
            (target as CombatUnit & { _kindredMarks?: number })._kindredMarks = marks;
            if (marks >= 3) {
              (target as CombatUnit & { _kindredMarks?: number })._kindredMarks = 0;
              const markDmgVar = unit.champion.ability.variables?.find(v => v.name === 'SpellDamage');
              const markDmg = markDmgVar?.value?.[unit.starLevel] ?? 60;
              const markFinal = applyResistance(markDmg * (1 + unit.damageAmp), target.stats.armor, unit.stats.armorPen);
              target.currentHp -= markFinal;
              target.totalDamageTaken += markFinal;
              unit.totalDamageDealt += markFinal;
            }
          }

          // === 챔피언 전투 내 스케일링 (onAttack) — JSON 기반 ===
          const atkSc = getChampionScaling(unit.champion.apiName);
          if (atkSc?.trigger === 'onAttack' && target.state !== 'dead') {
            const every = atkSc.every ?? 1;
            if (unit.attackCount % every === 0) {
              const effType = atkSc.effect.type;
              if (effType === 'extraDamage' || effType === 'trueDamage') {
                // 피해 수치: 챔피언별 damage 배열에서 추출
                const dmgArr = (atkSc.passiveDamage ?? atkSc.damageAD ?? atkSc.hitDamage ?? atkSc.vitalDamage) as number[] | undefined;
                const val = starValue(dmgArr, unit.starLevel);
                const sDmgType = atkSc.effect.damageType ?? 'true';
                const resistance = sDmgType === 'magic' ? target.stats.magicResist : sDmgType === 'physical' ? target.stats.armor : 0;
                const pen = sDmgType === 'magic' ? unit.stats.magicPen : sDmgType === 'physical' ? unit.stats.armorPen : 0;
                let sDmg = sDmgType === 'true' ? val : applyResistance(val * (1 + unit.damageAmp), resistance, pen);
                sDmg = applyShield(target, sDmg, eventBus, tick);
                target.currentHp -= sDmg;
                unit.totalDamageDealt += sDmg;
                // 피오라 급소 회복 — healAmp 곱셈 적용.
                const healPct = atkSc.healPercent as number | undefined;
                if (healPct && sDmg > 0) {
                  const healAmount = sDmg * healPct * (1 + (unit.healAmp ?? 0));
                  unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healAmount);
                }
              }
            }
          }

          // === 카이사: 처치 관여 시 마나 (onKill) ===
          const killSc = getChampionScaling(unit.champion.apiName);
          if (killSc?.trigger === 'onKill' && killSc.effect.type === 'mana' && target.state === 'dead') {
            const manaGain = (killSc.manaPerKill as number) ?? 10;
            unit.currentMana = Math.min(unit.maxMana, unit.currentMana + manaGain);
          }

          eventBus.emit('on_attack', { sourceId: unit.id, targetId: target.id, value: finalDamage, tick });
          eventBus.emit('on_hit', { sourceId: unit.id, targetId: target.id, value: finalDamage, damageType: 'physical', tick });
          eventBus.emit('on_damage', { sourceId: target.id, targetId: unit.id, value: finalDamage, damageType: 'physical', tick });
          // 피격 방어자 관점 — 거인의 결의 / 반도체 카운터 등
          eventBus.emit('on_hit_taken', { sourceId: target.id, targetId: unit.id, value: finalDamage, damageType: 'physical', tick });

          // 최신상 RipperBullets/2 — 평타 명중 시 적 armor/MR -N (영구 누적, floor 0).
          if (unit.gravesRipperReduce > 0 && target.state !== 'dead') {
            target.stats.armor = Math.max(0, target.stats.armor - unit.gravesRipperReduce);
            target.stats.magicResist = Math.max(0, target.stats.magicResist - unit.gravesRipperReduce);
          }

          // 최신상 ReactiveArmor — 피격 시 armor/MR +perStack 누적 (max 50회).
          if (target.gravesReactivePerStack > 0 && target.gravesReactiveStackCount < 50 && target.state !== 'dead') {
            target.stats.armor += target.gravesReactivePerStack;
            target.stats.magicResist += target.gravesReactivePerStack;
            target.gravesReactiveStackCount++;
          }

          const log: CombatLog = {
            tick, time, type: 'attack',
            sourceId: unit.id, targetId: target.id,
            value: Math.round(finalDamage),
            message: `${unit.champion.name}이(가) ${target.champion.name}에게 ${Math.round(finalDamage)} 물리 피해${isCrit ? ' (크리티컬!)' : ''}`,
          };
          logs.push(log);
          tickLogs.push(log);

          // mana=0/0 챔프 (예: Caitlyn) 는 main ability 가 패시브 — 평타 트리거 onAttack
          // 핸들러로만 처리. cast 시스템에 진입하면 매 평타마다 ability "Damage" var 값이
          // 한 번 더 가산되는 이중 발동 버그 발생.
          if (unit.maxMana > 0 && unit.currentMana >= unit.maxMana) {
            const spentMana = unit.maxMana;
            unit.currentMana = 0;
            unit.state = 'casting';
            unit.castCount++;
            if (unitHasTrait(unit, '중재자')) {
              (unit.team === 'player' ? playerArbiterState : enemyArbiterState).manaSpent += unit.maxMana;
            }
            // 최신상 VoidCoefficient — 매 cast 직후 maxMana × (1 - N), min 10.
            // raw PercentManaReductionPerCast=0.15.
            if (unit.gravesVoidCoefficientPct > 0) {
              unit.maxMana = Math.max(10, unit.maxMana * (1 - unit.gravesVoidCoefficientPct));
            }
            // 마나 소모 시점 — PsyOps 공감 임플란트 등
            eventBus.emit('on_mana_spent', { sourceId: unit.id, value: spentMana, tick });

            const augNames = unit.team === 'player' ? playerAugApiNames : enemyAugApiNames;
            const config: AbilityConfig = getAbilityConfigForUnit(unit, augNames);

            // 스킬 시전 후 cast time — 이 시간 동안 공격 불가
            unit.attackCooldown = config.pattern === 'self_buff' ? SELF_BUFF_CAST_TICKS : CAST_TICKS;

            const { damage: rawAbilityDmgBase, type: dmgType } = getAbilityDamage(
              unit.champion, unit.starLevel, unit.stats.ap, 0, config.damageVar
            );
            // SharpshooterModule (위력 프레임) — 스킬 피해 +5% 가산.
            const rawAbilityDmg = rawAbilityDmgBase * (1 + (unit.gravesAbilityDamageBonus ?? 0));

            // 자폭 (GragasCarry) — 일반 ability target 흐름 skip + self 에 데미지 + HP floor.
            // 사용자 명세: 그라가스 본인 데미지, 다른 아군 X, 자기 스킬로 죽지 않음 (HP >= 1).
            if (config.selfDamage) {
              const hpFloor = config.selfDamageHpFloor ?? 0;
              const beforeHp = unit.currentHp;
              const dmgApplied = Math.max(0, Math.min(rawAbilityDmg, beforeHp - hpFloor));
              unit.currentHp = Math.max(hpFloor, beforeHp - rawAbilityDmg);
              unit.totalDamageTaken += dmgApplied;
              const selfLog: CombatLog = {
                tick, time, type: 'ability',
                sourceId: unit.id, targetId: unit.id,
                value: Math.round(dmgApplied),
                message: `${unit.champion.name}이(가) 자폭! 자기 자신에게 ${Math.round(dmgApplied)} 피해 (HP floor=${hpFloor})`,
              };
              logs.push(selfLog);
              tickLogs.push(selfLog);
              // on_cast 이벤트 emit — PsyOps 등 cast event subscriber 호환 (codex P2 회귀 가드).
              // targetId 는 self (적군 X). value 는 실제 입은 self damage. rawValue 는 동일 (no resistance for self).
              eventBus.emit('on_cast', { sourceId: unit.id, targetId: unit.id, value: dmgApplied, rawValue: rawAbilityDmg, tick });
              continue; // 일반 ability 흐름 skip — 적군/아군 데미지 없음
            }

            // hitCount: single은 곱연산, AOE/multi는 총 피해를 타겟 수로 분배 (후술)
            const hitCountTotal = config.hitCount ? rawAbilityDmg * config.hitCount : rawAbilityDmg;
            const isSplitDamage = config.hitCount && config.pattern !== 'single';
            const opposingTeam = unit.team === 'player' ? enemies : playerUnits;

            // 대쉬 이동 (config.dash가 있으면 대상 인접 칸으로 이동)
            let abilityTarget = target;
            if (config.dash) {
              abilityTarget = applyAbilityDash(
                unit, config.dash, target, opposingTeam,
                occupiedPositions, logs, tickLogs, tick, time
              );
            }

            const abilityTargets = findAbilityTargets(unit, abilityTarget, opposingTeam, config);

            // 어빌리티 보호막 적용 (자기 자신에게)
            const abilityShield = getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
            if (abilityShield > 0) {
              unit.shield += abilityShield;
              unit.statusEffects.push({ type: 'shield', sourceId: unit.id, remainingTicks: 300, value: abilityShield });
              const shieldLog: CombatLog = {
                tick, time, type: 'ability',
                sourceId: unit.id,
                value: Math.round(abilityShield),
                message: `${unit.champion.name}이(가) ${Math.round(abilityShield)} 보호막 획득!`,
              };
              logs.push(shieldLog);
              tickLogs.push(shieldLog);
            }

            // 다중 타겟 피해 루프
            let totalAbilityDmg = 0;
            // raw total — per-target modifier (damageAmp/sniper/crit/secondary/Chogath %hp 등) 적용 후,
            // resistance/shield/DR/invulnerable 적용 전. on_cast.rawValue 로 emit 되어
            // SympatheticImplant TrueDamageConversion 등 raw 기반 follow-up effect 가 사용.
            let totalRawAbilityDmg = 0;
            const aliveTargets = abilityTargets.filter(t => t.state !== 'dead');
            const abilityDmg = isSplitDamage && aliveTargets.length > 0
              ? hitCountTotal / aliveTargets.length
              : hitCountTotal;

            // DOT 스킬: 즉발 대신 burn statusEffect로 지속 피해 적용
            if (config.dot) {
              const dotTicks = Math.round(config.dot.duration * TICKS_PER_SECOND);
              for (const t of aliveTargets) {
                // DOT도 방어력/피해감소 적용
                const resistance = dmgType === 'magic' ? t.stats.magicResist : dmgType === 'physical' ? t.stats.armor : 0;
                const pen = dmgType === 'magic' ? unit.stats.magicPen : dmgType === 'physical' ? unit.stats.armorPen : 0;
                // 저격수 (Sniper) — DOT 도 거리 기반 추가 amp 포함 (codex P2 회귀 가드).
                const dotDamageAmp = unit.damageAmp + computeSniperDamageAmp(unit, t);
                const mitigated = dmgType === 'true' ? abilityDmg * (1 + dotDamageAmp) : applyResistance(abilityDmg * (1 + dotDamageAmp), resistance, pen);
                const perTickDmg = mitigated / config.dot.duration * TICK_DURATION;
                t.statusEffects.push({
                  type: 'burn', sourceId: unit.id,
                  remainingTicks: dotTicks, value: perTickDmg,
                });
              }
              const dotLog: CombatLog = {
                tick, time, type: 'ability',
                sourceId: unit.id, targetId: abilityTarget.id,
                value: Math.round(abilityDmg),
                message: `${unit.champion.name}이(가) ${unit.champion.ability.name} 시전! ${config.dot.duration}초 동안 ${Math.round(abilityDmg)} ${dmgType === 'magic' ? '마법' : '물리'} 지속 피해`,
              };
              logs.push(dotLog);
              tickLogs.push(dotLog);
            } else {
              // 즉발 피해
              for (let ti = 0; ti < abilityTargets.length; ti++) {
                const t = abilityTargets[ti];
                if (t.state === 'dead') continue;

                let abilityDamageAmp = unit.damageAmp;
                if (unit.inventionTankDamageAmp > 0 && t.role === 'Tank') {
                  abilityDamageAmp += unit.inventionTankDamageAmp;
                }
                // 최신상 Tankbuster — 탱커 상대 추가 damage amp (per target)
                if (unit.gravesTankDamageAmp > 0 && t.role === 'Tank') {
                  abilityDamageAmp += unit.gravesTankDamageAmp;
                }
                // 저격수 (Sniper) — 거리 기반 추가 damage amp (per target)
                abilityDamageAmp += computeSniperDamageAmp(unit, t);
                // 복제자 (MF replicator mode) — 스킬 한 번 더 발동 단순화: damage × (1 + Effectiveness).
                // raw "한 번 더 발동" 의 damage 결과는 base + base × Eff = base × (1 + Eff) 와 동일.
                if (unit.mfReplicatorEffectiveness > 0) {
                  abilityDamageAmp += unit.mfReplicatorEffectiveness;
                }
                // 초가스: % 최대체력 피해 추가
                let baseDmg = abilityDmg;
                if (unit.champion.apiName === 'TFT17_Chogath') {
                  const pctVar = unit.champion.ability.variables?.find(v => v.name === 'PercentMaximumHealthDamage');
                  const pctHp = pctVar?.value?.[unit.starLevel] ?? 0.08;
                  baseDmg += t.maxHp * pctHp;
                }
                // 트위스티드 페이트: 랜덤 범위 피해 (DamageMin ~ DamageMax)
                if (unit.champion.apiName === 'TFT17_TwistedFate') {
                  const minVar = unit.champion.ability.variables?.find(v => v.name === 'DamageMin');
                  const maxVar = unit.champion.ability.variables?.find(v => v.name === 'DamageMax');
                  const minDmg = minVar?.value?.[unit.starLevel] ?? baseDmg;
                  const maxDmg = maxVar?.value?.[unit.starLevel] ?? baseDmg;
                  baseDmg = minDmg + rng.next() * (maxDmg - minDmg);
                }
                // 브라이어: 탱커 대상 50% 추가 피해
                if (unit.champion.apiName === 'TFT17_Briar' && t.role === 'Tank') {
                  const bonusPct = unit.champion.ability.variables?.find(v => v.name === 'PercentBonusDamage')?.value?.[unit.starLevel] ?? 0.5;
                  baseDmg *= (1 + bonusPct);
                }
                // secondaryDamageVar: 2차 피해 합산 (리산드라 폭발, 베이가 미니유성 등)
                if (config.secondaryDamageVar) {
                  const secVar = unit.champion.ability.variables?.find(v => v.name === config.secondaryDamageVar);
                  const secVal = secVar?.value?.[unit.starLevel] ?? 0;
                  baseDmg += secVal;
                }
                let dmg = baseDmg * (1 + abilityDamageAmp);
                if (config.damageDecay && ti > 0) {
                  dmg *= Math.pow(1 - config.damageDecay, ti);
                }
                if (unit.spellCanCrit && rng.next() < unit.stats.critChance) {
                  dmg *= unit.stats.critMultiplier;
                }
                // raw (mitigation 전) 누적 — on_cast.rawValue 용.
                totalRawAbilityDmg += dmg;

                const resistance = dmgType === 'magic' ? t.stats.magicResist
                  : dmgType === 'physical' ? t.stats.armor : 0;
                const pen = dmgType === 'magic' ? unit.stats.magicPen
                  : dmgType === 'physical' ? unit.stats.armorPen : 0;
                let effectiveDmg = applyResistance(dmg, resistance, pen);

                if (t.damageReduction > 0) {
                  effectiveDmg *= (1 - t.damageReduction);
                }

                // Fighter/Assassin 비타겟 피해 감소 15%
                if ((t.role === 'Fighter' || t.role === 'Assassin') && t.target !== unit.id) {
                  effectiveDmg *= (1 - NON_TARGET_DAMAGE_REDUCTION);
                }

                effectiveDmg = applyShield(t, effectiveDmg, eventBus, tick);
                if (t.statusEffects.some(e => e.type === 'invulnerable')) {
                  effectiveDmg = 0;
                }

                t.currentHp -= effectiveDmg;
                t.totalDamageTaken += effectiveDmg;
                unit.totalDamageDealt += effectiveDmg;
                totalAbilityDmg += effectiveDmg;

                // 별돌보미 뱀(Serpent) — 강화 칸 별돌보미 ability 명중 시 중독 적용
                triggerSerpentPoison(unit, t, effectiveDmg);

                const abilityLog: CombatLog = {
                  tick, time, type: 'ability',
                  sourceId: unit.id, targetId: t.id,
                  value: Math.round(effectiveDmg),
                  message: `${unit.champion.name}이(가) ${unit.champion.ability.name} 시전! ${t.champion.name}에게 ${Math.round(effectiveDmg)} ${dmgType === 'magic' ? '마법' : dmgType === 'physical' ? '물리' : '트루'} 피해`,
                };
                logs.push(abilityLog);
                tickLogs.push(abilityLog);

                // 타겟 사망 처리
                if (t.currentHp <= 0) {
                  t.currentHp = 0;
                  t.state = 'dead';
                  unit.killCount++;
                  if (unit.team === 'player') playerArbiterState.enemyDeathCount++;
                  else enemyArbiterState.enemyDeathCount++;
                  const deathLog: CombatLog = {
                    tick, time, type: 'death',
                    sourceId: t.id,
                    message: `${t.champion.name} 사망! (${unit.champion.name}의 ${unit.champion.ability.name})`,
                  };
                  logs.push(deathLog);
                  tickLogs.push(deathLog);
                  eventBus.emit('on_kill', { sourceId: unit.id, targetId: t.id, tick });
                  eventBus.emit('on_death', { sourceId: t.id, targetId: unit.id, tick });
                }
              }

              // 최신상 Phase 3C-2 — ability AOE (BlastRadius / SympatheticDetonation).
              // ability primary hit 처리 끝난 직후 호출. abilityTarget 위치 기준.
              // baseDmg = abilityDmg (raw hit count damage 단위, mitigation 전).
              // codex P2 (PR #58): splash dealt/rawDealt 를 totalAbilityDmg / totalRawAbilityDmg
              // 에 누적 — omnivamp heal 및 on_cast.value/rawValue 정합.
              if (unit.gravesBlastIncreasedRadius > 0 || unit.gravesSympatheticReduction > 0) {
                const ownEnemyTeam = unit.team === 'player' ? enemies : playerUnits;
                const ownArbiterState = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                if (unit.gravesBlastIncreasedRadius > 0) {
                  const r = triggerAbilityBlastRadius(
                    unit, abilityTarget.position, abilityTargets, abilityDmg,
                    ownEnemyTeam, occupiedPositions, ownArbiterState,
                    eventBus, tick, time, logs, tickLogs,
                  );
                  totalAbilityDmg += r.dealt;
                  totalRawAbilityDmg += r.rawDealt;
                }
                if (unit.gravesSympatheticReduction > 0) {
                  const r = triggerAbilitySympatheticDetonation(
                    unit, abilityTarget, abilityDmg,
                    ownEnemyTeam, occupiedPositions, ownArbiterState,
                    eventBus, tick, time, logs, tickLogs,
                  );
                  totalAbilityDmg += r.dealt;
                  totalRawAbilityDmg += r.rawDealt;
                }
              }
            }

            // 전체 피해량 기반 흡혈 — healAmp 곱셈 적용.
            if (unit.omnivamp > 0 && totalAbilityDmg > 0) {
              const grievousReduction = target.augmentGrievousWounds > 0 ? (1 - target.augmentGrievousWounds) : 1;
              const heal = totalAbilityDmg * unit.omnivamp * grievousReduction * (1 + (unit.healAmp ?? 0));
              unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
            }

            // 별돌보미 우물(Fountain) — 강화 칸 안 별돌보미 스킬 시전 시
            // 즉발 피해 × HealPercent 만큼 같은 팀 중 가장 체력 낮은 아군 회복.
            triggerFountainHeal(unit, totalAbilityDmg, tick, time, tickLogs);

            // === CC 기절 적용 ===
            if (config.stun && config.stun > 0) {
              const stunTicks = Math.round(config.stun * TICKS_PER_SECOND);
              // firstHitOnlyStun (방패 여전사 LeonaCarry) — line 첫 적중만 stun.
              const stunLimit = config.firstHitOnlyStun ? 1 : (config.stunTargets ?? abilityTargets.length);
              let stunCount = 0;
              for (const t of abilityTargets) {
                if (t.state === 'dead' || stunCount >= stunLimit) break;
                t.statusEffects.push({ type: 'stun', sourceId: unit.id, remainingTicks: stunTicks });
                t.state = 'idle';
                t.attackCooldown = 0;
                stunCount++;
              }
            }

            // === 적 디버프 적용 ===
            if (config.debuff) {
              for (const t of abilityTargets) {
                if (t.state === 'dead') continue;
                if (config.debuff.armorReduction) t.stats.armor = Math.max(0, t.stats.armor - config.debuff.armorReduction);
                if (config.debuff.mrReduction) t.stats.magicResist = Math.max(0, t.stats.magicResist - config.debuff.mrReduction);
              }
            }

            // === 시전자 체력 회복 ===
            if (config.heal) {
              const healVar = unit.champion.ability.variables.find(v => v.name === 'Heal' || v.name === 'APHeal' || v.name === 'PercentMaximumHealthHealing');
              if (healVar) {
                const starIdx = Math.min(unit.starLevel, healVar.value.length - 1);
                const healVal = healVar.value[starIdx] ?? healVar.value[0] ?? 0;
                const healAmount = typeof healVal === 'number'
                  ? (healVal < 1 ? Math.round(unit.maxHp * healVal) : Math.round(healVal * (1 + unit.stats.ap / 100)))
                  : 0;
                if (healAmount > 0) {
                  // healAmp 곱셈 적용 — ability self-heal 도 회복량 증폭 효과 대상.
                  const finalHeal = healAmount * (1 + (unit.healAmp ?? 0));
                  unit.currentHp = Math.min(unit.maxHp, unit.currentHp + finalHeal);
                }
              }
            }

            // === 자기 버프 ===
            if (config.selfBuff) {
              if (config.selfBuff.attackSpeed) unit.stats.attackSpeed *= (1 + config.selfBuff.attackSpeed);
              if (config.selfBuff.ad) unit.stats.damage += config.selfBuff.ad;
              if (config.selfBuff.ap) unit.stats.ap += config.selfBuff.ap;
              if (config.selfBuff.durability) unit.damageReduction += config.selfBuff.durability;
            }

            // === 아군 전체 버프 ===
            if (config.allyBuff) {
              const allyTeam = unit.team === 'player' ? playerUnits : enemies;
              for (const ally of allyTeam) {
                if (ally.state === 'dead') continue;
                if (config.allyBuff.attackSpeed) ally.stats.attackSpeed *= (1 + config.allyBuff.attackSpeed);
              }
            }

            // === 이즈리얼 드론: 스킬 사용 시 타겟에게 추가 물리 피해 ===
            const ezDrones = (unit as CombatUnit & { _ezrealDrones?: number })._ezrealDrones ?? 0;
            if (ezDrones > 0 && abilityTarget.state !== 'dead') {
              const droneDmgBase = unit.champion.ability.variables?.find(v => v.name === 'DroneDamage')?.value?.[unit.starLevel] ?? 8;
              const droneTotalRaw = ezDrones * droneDmgBase * (1 + unit.damageAmp);
              const droneDmg = applyResistance(droneTotalRaw, abilityTarget.stats.armor, unit.stats.armorPen);
              abilityTarget.currentHp -= droneDmg;
              abilityTarget.totalDamageTaken += droneDmg;
              unit.totalDamageDealt += droneDmg;
              totalAbilityDmg += droneDmg;
            }

            // rawValue = totalRawAbilityDmg (per-target modifier 적용 후, resistance 미적용 누적).
            // value = totalAbilityDmg (실제 적용 mitigated total).
            // dot path 면 totalRawAbilityDmg 누적 안 됨 → hitCountTotal 폴백 (DOT total raw).
            const rawForCast = totalRawAbilityDmg > 0 ? totalRawAbilityDmg : hitCountTotal;
            eventBus.emit('on_cast', { sourceId: unit.id, targetId: target.id, value: totalAbilityDmg, rawValue: rawForCast, tick });
          }

          // Execute threshold: kill if below HP %.
          // augmentExecuteThreshold (augment) + darkStarExecuteThreshold (DarkStar (2)+ tier).
          const effectiveExecuteThreshold = Math.max(
            unit.augmentExecuteThreshold,
            unit.darkStarExecuteThreshold,
          );
          // Spec: HP/maxHp 가 임계값 이하 (≤) 시 execute. 정확히 임계값에 있는 적도 처치 대상.
          const shouldExecute = effectiveExecuteThreshold > 0
            && target.currentHp > 0
            && target.currentHp / target.maxHp <= effectiveExecuteThreshold;

          if ((target.currentHp <= 0 || shouldExecute) && target.state !== 'dead') {
            target.state = 'dead';
            target.currentHp = 0;
            if (unit.team === 'player') playerArbiterState.enemyDeathCount++;
            else enemyArbiterState.enemyDeathCount++;
            eventBus.emit('on_kill', { sourceId: unit.id, targetId: target.id, tick });
            eventBus.emit('on_death', { sourceId: target.id, targetId: unit.id, tick });
            const deathLog: CombatLog = {
              tick, time, type: 'death',
              sourceId: target.id,
              message: shouldExecute && target.currentHp > 0
                ? `${target.champion.name} 처형됨! (HP ${Math.round(effectiveExecuteThreshold * 100)}% 이하${unit.darkStarExecuteThreshold > 0 ? ' — 블랙홀' : ''})`
                : `${target.champion.name} 사망!`,
            };
            logs.push(deathLog);
            tickLogs.push(deathLog);
          }
        }
      } else {
        // === 사거리 밖 + 마나 풀 + dash/self_buff → 즉시 스킬 시전 ===
        const augNames = unit.team === 'player' ? playerAugApiNames : enemyAugApiNames;
        const outOfRangeConfig = getAbilityConfigForUnit(unit, augNames);
        const canDashCast = unit.currentMana >= unit.maxMana
          && unit.attackCooldown <= 0
          && (outOfRangeConfig.dash || outOfRangeConfig.pattern === 'self_buff');

        if (canDashCast) {
          const spentManaOOR = unit.maxMana;
          unit.currentMana = 0;
          unit.state = 'casting';
          unit.castCount++;
          unit.attackCooldown = outOfRangeConfig.pattern === 'self_buff' ? SELF_BUFF_CAST_TICKS : CAST_TICKS;
          // 마나 소모 시점 (사거리 밖 dash cast 경로)
          eventBus.emit('on_mana_spent', { sourceId: unit.id, value: spentManaOOR, tick });

          const { damage: rawOORDmg, type: dmgType } = getAbilityDamage(
            unit.champion, unit.starLevel, unit.stats.ap, 0, outOfRangeConfig.damageVar
          );
          const oorHitTotal = outOfRangeConfig.hitCount ? rawOORDmg * outOfRangeConfig.hitCount : rawOORDmg;
          const oorIsSplit = outOfRangeConfig.hitCount && outOfRangeConfig.pattern !== 'single';
          const opposingTeam = unit.team === 'player' ? enemies : playerUnits;

          let abilityTarget = target;
          if (outOfRangeConfig.dash) {
            abilityTarget = applyAbilityDash(
              unit, outOfRangeConfig.dash, target, opposingTeam,
              occupiedPositions, logs, tickLogs, tick, time
            );
          }

          const abilityTargets = findAbilityTargets(unit, abilityTarget, opposingTeam, outOfRangeConfig);

          // 보호막
          const abilityShield = getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
          if (abilityShield > 0) {
            unit.shield += abilityShield;
            unit.statusEffects.push({ type: 'shield', sourceId: unit.id, remainingTicks: 300, value: abilityShield });
          }

          // self_buff
          if (outOfRangeConfig.selfBuff) {
            if (outOfRangeConfig.selfBuff.attackSpeed) {
              unit.stats.attackSpeed *= (1 + outOfRangeConfig.selfBuff.attackSpeed);
            }
            if (outOfRangeConfig.selfBuff.ad) {
              unit.stats.damage += outOfRangeConfig.selfBuff.ad;
            }
          }

          // 피해 적용
          let totalAbilityDmg = 0;
          // raw total — per-target modifier (damageAmp/sniper/crit) 적용 후, mitigation 전.
          // on_cast.rawValue 로 emit 되어 SympatheticImplant 등 raw 기반 effect 가 사용.
          let totalRawAbilityDmg = 0;
          const oorAlive = abilityTargets.filter(t => t.state !== 'dead');
          const abilityDmg = oorIsSplit && oorAlive.length > 0
            ? oorHitTotal / oorAlive.length
            : oorHitTotal;

          if (outOfRangeConfig.dot) {
            const dotTicks = Math.round(outOfRangeConfig.dot.duration * TICKS_PER_SECOND);
            for (const t of oorAlive) {
              const resistance = dmgType === 'magic' ? t.stats.magicResist : dmgType === 'physical' ? t.stats.armor : 0;
              const pen = dmgType === 'magic' ? unit.stats.magicPen : dmgType === 'physical' ? unit.stats.armorPen : 0;
              // 저격수 (Sniper) — OOR DOT 도 거리 기반 추가 amp 포함 (codex P2 회귀 가드).
              const oorDotDamageAmp = unit.damageAmp + computeSniperDamageAmp(unit, t);
              const mitigated = dmgType === 'true' ? abilityDmg * (1 + oorDotDamageAmp) : applyResistance(abilityDmg * (1 + oorDotDamageAmp), resistance, pen);
              const perTickDmg = mitigated / outOfRangeConfig.dot.duration * TICK_DURATION;
              t.statusEffects.push({
                type: 'burn', sourceId: unit.id,
                remainingTicks: dotTicks, value: perTickDmg,
              });
            }
          } else {
            // firstHitOnlyStun (방패 여전사 LeonaCarry): OOR dash cast 에서도 첫 적중만 stun.
            let oorStunApplied = false;
            for (const t of abilityTargets) {
              if (t.state === 'dead') continue;
              const resistance = dmgType === 'magic' ? t.stats.magicResist : t.stats.armor;
              const pen = dmgType === 'magic' ? unit.stats.magicPen : unit.stats.armorPen;
              // 저격수 (Sniper) — 거리 기반 추가 damage amp
              const sniperAmp = computeSniperDamageAmp(unit, t);
              let rawDmg = abilityDmg * (1 + unit.damageAmp + sniperAmp);
              if (unit.spellCanCrit && rng.next() < unit.stats.critChance) {
                rawDmg *= unit.stats.critMultiplier;
              }
              // raw 누적 — mitigation 전 per-target modifier 적용 후.
              totalRawAbilityDmg += rawDmg;
              let dmg = dmgType === 'true' ? rawDmg : applyResistance(rawDmg, resistance, pen);
              if (t.damageReduction > 0) dmg *= (1 - t.damageReduction);
              dmg = applyShield(t, dmg, eventBus, tick);
              if (t.statusEffects.some(e => e.type === 'invulnerable')) dmg = 0;
              t.currentHp -= dmg;
              t.totalDamageTaken += dmg;
              unit.totalDamageDealt += dmg;
              totalAbilityDmg += dmg;

              // 별돌보미 뱀(Serpent) — OOR ability 명중 시 중독 적용
              triggerSerpentPoison(unit, t, dmg);

              if (t.currentHp <= 0) {
                t.state = 'dead';
                t.currentHp = 0;
                unit.killCount++;
                if (unit.team === 'player') playerArbiterState.enemyDeathCount++;
                else enemyArbiterState.enemyDeathCount++;
                eventBus.emit('on_kill', { sourceId: unit.id, targetId: t.id, tick });
                eventBus.emit('on_death', { sourceId: t.id, targetId: unit.id, tick });
                logs.push({ tick, time, type: 'death', sourceId: t.id, message: `${t.champion.name} 사망!` });
              }

              if (outOfRangeConfig.stun && outOfRangeConfig.stun > 0 && t.currentHp > 0) {
                // firstHitOnlyStun → 이미 한 번 적용했으면 skip (LeonaCarry 첫 적중 only).
                if (outOfRangeConfig.firstHitOnlyStun && oorStunApplied) continue;
                const stunTicks = Math.round(outOfRangeConfig.stun * TICKS_PER_SECOND);
                t.statusEffects.push({ type: 'stun', sourceId: unit.id, remainingTicks: stunTicks });
                t.state = 'idle';
                t.attackCooldown = 0;
                oorStunApplied = true;
              }
            }
          }

          // === 이즈리얼 드론: 스킬 사용 시 타겟에게 추가 물리 피해 ===
          const ezDronesOOR = (unit as CombatUnit & { _ezrealDrones?: number })._ezrealDrones ?? 0;
          if (ezDronesOOR > 0 && abilityTarget.state !== 'dead') {
            const droneDmgBase = unit.champion.ability.variables?.find(v => v.name === 'DroneDamage')?.value?.[unit.starLevel] ?? 8;
            const droneTotalRaw = ezDronesOOR * droneDmgBase * (1 + unit.damageAmp);
            const droneDmg = applyResistance(droneTotalRaw, abilityTarget.stats.armor, unit.stats.armorPen);
            abilityTarget.currentHp -= droneDmg;
            abilityTarget.totalDamageTaken += droneDmg;
            unit.totalDamageDealt += droneDmg;
            totalAbilityDmg += droneDmg;
          }

          const castLog: CombatLog = {
            tick, time, type: 'ability',
            sourceId: unit.id, targetId: abilityTarget.id,
            value: Math.round(totalAbilityDmg),
            message: `${unit.champion.name}이(가) ${outOfRangeConfig.dash ? '돌진하여 ' : ''}스킬 시전! (${Math.round(totalAbilityDmg)} ${dmgType === 'magic' ? '마법' : dmgType === 'true' ? '고정' : '물리'} 피해)`,
          };
          logs.push(castLog);
          tickLogs.push(castLog);

          // 별돌보미 우물(Fountain) — OOR cast (dash/self_buff) path 도 동일 heal 적용
          // (codex P1 회귀 가드: Talon/Corki 같은 dash user 가 사거리 밖 시전 시 누락 방지).
          triggerFountainHeal(unit, totalAbilityDmg, tick, time, tickLogs);

          // rawValue = totalRawAbilityDmg (per-target modifier 적용 후, resistance 미적용 누적).
          // dot path 면 raw 누적 안 됨 → oorHitTotal 폴백.
          const oorRawForCast = totalRawAbilityDmg > 0 ? totalRawAbilityDmg : oorHitTotal;
          eventBus.emit('on_cast', { sourceId: unit.id, targetId: target.id, value: totalAbilityDmg, rawValue: oorRawForCast, tick });
        } else {
          // 일반 이동
          const newPos = findBestMoveToward(unit.position, target.position, occupiedPositions);
          if (newPos) {
            occupiedPositions.delete(coordKey(unit.position));
            unit.position = newPos;
            occupiedPositions.add(coordKey(newPos));
            unit.state = 'moving';
            unit.moveCooldown = moveTicks;

            const moveLog: CombatLog = {
              tick, time, type: 'move',
              sourceId: unit.id,
              message: `${unit.champion.name}이(가) 이동`,
            };
            logs.push(moveLog);
            tickLogs.push(moveLog);
          }
        }
      }
    }

    snapshots.push(captureSnapshot(tick, allUnits, tickLogs));
  }

  const alivePlayers = playerUnits.filter(u => u.state !== 'dead').length;
  const aliveEnemies = enemies.filter(u => u.state !== 'dead').length;
  const winner = alivePlayers > aliveEnemies ? 'player'
    : aliveEnemies > alivePlayers ? 'enemy' : 'draw';

  const lastLog = logs[logs.length - 1];
  const duration = lastLog ? lastLog.time : 0;

  eventBus.emit('on_combat_end', { sourceId: '', tick: MAX_TICKS, value: duration });
  itemRuntime.dispose();
  eventBus.clear();

  return { winner, duration, logs, playerUnits, enemyUnits: enemies, snapshots };
}
