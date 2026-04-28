import {
  CombatUnit, CombatResult, CombatLog, PlacedChampion,
  HexCoord, HexBuff, TickSnapshot, mapGameRole,
  RawTrait, RawAugment, RawItem, RawChampion, ActiveTrait, ItemEffect,
  MF_MODE_CONFIG, ArbiterLaw,
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
    attackCount: 0,
    castCount: 0,
    killCount: 0,
    spellCanCrit: computeSpellCanCrit(allItems, activeTraits),
    stargazerFountainHealPercent: 0,
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

/** 캐리 증강 포함 AbilityConfig 결정 */
function getAbilityConfigForUnit(unit: CombatUnit, augmentApiNames: string[]): AbilityConfig {
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
 * 암흑의 별 (DarkStar) — (4)+ tier 시 암흑의 별 unit 에 ADAP=45% 가산.
 *
 * Spec (TFT17_DarkStar):
 *   (2) 8% maxHP 이하 적 execute 블랙홀 — 후속 PR
 *   (4) 추가로 ADAP=45% AD/AP — 본 PR 범위
 *   (6) 가장 강한 암흑의 별 unit Supermassive (효과 +85%) — 후속 PR
 *   (9) 모두 Supermassive — 후속 PR
 *
 * 본 PR 은 (4)+ tier ADAP 만 처리. 모든 effects 의 ADAP 변수가 45 로 동일하지만
 * desc 상 (2) 행에는 ADAP 가 없어, style >= 3 (=tier (4)+) 일 때만 적용.
 *
 * 암흑의 별 챔프 (6명): Kaisa, Karma, Jhin, Chogath, Lissandra, Mordekaiser.
 */
function applyDarkStarEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_DarkStar');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  // (2) tier 는 블랙홀 execute 만 — 본 PR 범위 외. ADAP 는 (4)+ 부터.
  if (trait.style < 3) return;
  const v = trait.activeEffect.variables;
  const adap = (v.ADAP ?? 0) as number;
  if (adap <= 0) return;
  for (const u of units) {
    if (!unitHasTrait(u, '암흑의 별')) continue;
    u.stats.damage = Math.round(u.stats.damage * (1 + adap / 100));
    u.stats.ap = (u.stats.ap ?? 0) + adap;
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

  // === Fountain (우물) — Teamwide ManaRegen + 별돌보미 추가 마나 + 스킬 힐 ===
  if (apiName === 'TFT17_Stargazer_Fountain') {
    const teamwide = (eff.Fountain_ManaRegen_Teamwide ?? 0) as number; // 단순 mana/sec
    const ownerExtra = (eff.Fountain_ManaRegen ?? 0) as number;
    // (3) 0.18 → 즉발 ability dmg 의 18% 만큼 가장 체력 낮은 아군 회복.
    // (5) 0.25. 강화 칸 안 별돌보미 unit 만 trigger 보유 (heal 적용은 ability 시전 hook 에서).
    const healPercent = (eff.Fountain_HealPercent ?? 0) as number;
    for (const u of units) {
      if (!isOnTile(u)) continue;
      if (teamwide > 0) u.augmentManaRegen += teamwide;
      if (isStargazerUnit(u)) {
        if (ownerExtra > 0) u.augmentManaRegen += ownerExtra;
        if (healPercent > 0) u.stargazerFountainHealPercent = healPercent;
      }
    }
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
            attackCount: 0,
            castCount: 0,
            killCount: 0,
            spellCanCrit: false,
            stargazerFountainHealPercent: 0,
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
    attackCount: 0,
    castCount: 0,
    killCount: 0,
    spellCanCrit: false,
    stargazerFountainHealPercent: 0,
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

  const playerUnits = playerTeamFiltered.map((p, i) => {
    const isBW = placedHasTrait(p, '빌지워터');
    const effects = isBW ? mergeEffects(playerAugmentEffects, playerBWEffects) : playerAugmentEffects;
    const unit = createCombatUnit(p, 'player', i, playerActiveTraits, effects);
    const mod = resolvePerUnitMods(playerAugsWithStacks, p.champion);
    applyPerUnitMods(unit, mod);
    applyPermanentStacks(unit, p);
    applyCarryAugmentRange(unit, playerAugApiNames);
    applyStartPassives(unit);
    return unit;
  });
  const enemies = enemyTeamFiltered.map((p, i) => {
    const positioned = options.skipMirror ? p : { ...p, position: mirrorPosition(p.position) };
    const isBW = placedHasTrait(p, '빌지워터');
    const effects = isBW ? mergeEffects(enemyAugmentEffects, enemyBWEffects) : enemyAugmentEffects;
    const unit = createCombatUnit(positioned, 'enemy', i, enemyActiveTraits, effects);
    const mod = resolvePerUnitMods(enemyAugsWithStacks, p.champion);
    applyPerUnitMods(unit, mod);
    applyPermanentStacks(unit, positioned);
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
        const heal = u.maxHp * state.maokaiHealPct;
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
    const healAmount = totalAbilityDmg * caster.stargazerFountainHealPercent;
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
        const healAmount = h.maxHp * h.stargazerHuntressHealPercent;
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
  const SHIELD_NUM_DEATHS = 60; // Shield_NumDeaths spec value
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
  if (playerShieldDeaths >= SHIELD_NUM_DEATHS) {
    applyShieldCashout(playerUnits);
    playerShieldCashoutDone = true;
  }
  if (enemyShieldDeaths >= SHIELD_NUM_DEATHS) {
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
      if (!playerShieldCashoutDone && playerShieldDeaths >= SHIELD_NUM_DEATHS) {
        applyShieldCashout(playerUnits);
        playerShieldCashoutDone = true;
      }
    }
    if (deadEnemyUnit && !isAutoUnit(deadEnemyUnit.champion.apiName)) {
      enemyShieldDeaths++;
      if (!enemyShieldCashoutDone && enemyShieldDeaths >= SHIELD_NUM_DEATHS) {
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
          // 저격수 (Sniper) — 거리 기반 추가 damage amp
          totalDamageAmp += computeSniperDamageAmp(unit, target);
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
          }

          if (unit.omnivamp > 0 && finalDamage > 0) {
            const grievousReduction = target.augmentGrievousWounds > 0 ? (1 - target.augmentGrievousWounds) : 1;
            const heal = finalDamage * unit.omnivamp * grievousReduction;
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
            eventBus.emit('on_heal', { sourceId: unit.id, value: heal, tick });
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
                // 피오라 급소 회복
                const healPct = atkSc.healPercent as number | undefined;
                if (healPct && sDmg > 0) {
                  unit.currentHp = Math.min(unit.maxHp, unit.currentHp + sDmg * healPct);
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
            // 마나 소모 시점 — PsyOps 공감 임플란트 등
            eventBus.emit('on_mana_spent', { sourceId: unit.id, value: spentMana, tick });

            const augNames = unit.team === 'player' ? playerAugApiNames : enemyAugApiNames;
            const config: AbilityConfig = getAbilityConfigForUnit(unit, augNames);

            // 스킬 시전 후 cast time — 이 시간 동안 공격 불가
            unit.attackCooldown = config.pattern === 'self_buff' ? SELF_BUFF_CAST_TICKS : CAST_TICKS;

            const { damage: rawAbilityDmg, type: dmgType } = getAbilityDamage(
              unit.champion, unit.starLevel, unit.stats.ap, 0, config.damageVar
            );
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
                // 저격수 (Sniper) — 거리 기반 추가 damage amp (per target)
                abilityDamageAmp += computeSniperDamageAmp(unit, t);
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
            }

            // 전체 피해량 기반 흡혈
            if (unit.omnivamp > 0 && totalAbilityDmg > 0) {
              const grievousReduction = target.augmentGrievousWounds > 0 ? (1 - target.augmentGrievousWounds) : 1;
              const heal = totalAbilityDmg * unit.omnivamp * grievousReduction;
              unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
            }

            // 별돌보미 우물(Fountain) — 강화 칸 안 별돌보미 스킬 시전 시
            // 즉발 피해 × HealPercent 만큼 같은 팀 중 가장 체력 낮은 아군 회복.
            triggerFountainHeal(unit, totalAbilityDmg, tick, time, tickLogs);

            // === CC 기절 적용 ===
            if (config.stun && config.stun > 0) {
              const stunTicks = Math.round(config.stun * TICKS_PER_SECOND);
              const stunLimit = config.stunTargets ?? abilityTargets.length;
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
                  unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healAmount);
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

            eventBus.emit('on_cast', { sourceId: unit.id, targetId: target.id, value: totalAbilityDmg, tick });
          }

          // Execute threshold: kill if below HP %
          const shouldExecute = unit.augmentExecuteThreshold > 0
            && target.currentHp > 0
            && target.currentHp / target.maxHp < unit.augmentExecuteThreshold;

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
                ? `${target.champion.name} 처형됨! (HP ${Math.round(unit.augmentExecuteThreshold * 100)}% 이하)`
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
                const stunTicks = Math.round(outOfRangeConfig.stun * TICKS_PER_SECOND);
                t.statusEffects.push({ type: 'stun', sourceId: unit.id, remainingTicks: stunTicks });
                t.state = 'idle';
                t.attackCooldown = 0;
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

          eventBus.emit('on_cast', { sourceId: unit.id, targetId: target.id, value: totalAbilityDmg, tick });
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
