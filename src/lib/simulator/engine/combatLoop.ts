import {
  CombatUnit, CombatResult, CombatLog, PlacedChampion,
  HexCoord, HexBuff, TickSnapshot, mapGameRole,
  RawTrait, RawAugment, RawItem, RawChampion, ActiveTrait, ItemEffect,
  MF_MODE_CONFIG, ArbiterLaw, STAR_SCALING,
} from '@/types';
import arbiterLawsData from '../../../../public/data/arbiter_laws.json';
import { findCarryAugment, CARRY_AUGMENTS, type CarryAugmentConfig } from '@/data/carryAugments';
import type { StatusEffectType } from '@/types';
import { calculateStats, getItemEffects } from '@/lib/simulator/systems/stat';
import { getAbilityDamage, getAbilityShield, findAbilityTargets, CHAMPION_ABILITY_PATTERNS, getChampionScaling, starValue, getSynergyScaling } from '@/lib/simulator/systems/ability';
import type { AbilityConfig } from '@/lib/simulator/systems/ability';
import { canAttack, getMoveTicks, findBestMoveToward, coordKey, getNeighbors, hexDistance } from '@/lib/simulator/systems/movement';
import { getHexesInRadius } from '@/lib/simulator/models/hex';
import { TICK_DURATION, MAX_TICKS, TICKS_PER_SECOND, CAST_TICKS, SELF_BUFF_CAST_TICKS, INITIAL_ATTACK_DELAY, BOARD_COLS } from '@/lib/simulator/models/constants';
import { axialToOffset } from '@/types';
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
  'resists-buff': '방어력+마법저항 버프',
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
  /**
   * N.O.V.A. (DRX 5+ 시너지) "타격 선택기" 아이템 받은 NOVA 유닛 apiName — PR7-C.
   * 보드 위 NOVA 유닛 1명 (Aatrox/Caitlyn/Akali/Maokai/Kindred) 에만 적용.
   * 시뮬에서는 apiName 으로 지정 (예: 'TFT17_Aatrox') — 매칭 unit 의
   * aatroxNovaStrikeSelector flag = true.
   * 본 PR (PR7-C) 은 carry Aatrox 한정 — cycle 패턴이 global 로 확장 + 모든 적 knockup.
   * 다른 NOVA 유닛 효과 변환은 후속 PR.
   */
  playerNovaStrikeSelectorUnit?: string;
  enemyNovaStrikeSelectorUnit?: string;
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

/**
 * 챔피언 ability variable 의 starLevel 별 값 읽기 — 데이터 컨벤션 자동 감지 (PR99).
 *
 * CommunityDragon TFT17 데이터의 컨벤션이 챔피언별로 혼재:
 *   - **filler** (대부분): `[dummy, ★1, ★2, ★3, ★4]` — index = starLevel
 *     예: Lissandra SecondaryDamage [100, 50, 75, 115, 195],
 *         Kindred SpellDamage [0, 75, 115, ...], Karma SecondaryDamage [0, 150, 225, ...],
 *         Sona SlamDamage [2.5, 680, 1050, ...] (작은 sentinel),
 *         Vex ShadowHandDamage [2.5, 30, 45, ...], Talon ADBleedDamage [2.5, 430, 645, ...]
 *   - **no-filler** (일부): `[★1, ★2, ★3, ★4, ★5]` — index = starLevel - 1
 *     예: Caitlyn Damage [145, 170, 255, 510, 875], Graves SecondaryDamageAD [120, 135, 200, ...],
 *         TF DamageMin [180, 190, 285, 430, 730]
 *
 * 자동 감지 규칙 (filler 판정 — codex P1 PR #99 후속):
 *   1. `value[0] === 0` (Kindred, Karma 등 zero filler)
 *   2. `value[0] > value[1]` (Lissandra 같은 dummy-larger pattern)
 *   3. `value[1] / value[0] > 5` (Sona/Talon/Vex 처럼 작은 sentinel — 2.5/3 등이 ★1 직전에)
 * 그 외 monotonic increase 면 no-filler.
 * 상수 배열 (ProcChance [15, 15, 15]) 은 ratio = 1, no-filler 처리되지만 모두 동일 값이라 안전.
 */
function readVarByStar(value: number[] | undefined, starLevel: number, fallback = 0): number {
  if (!value || value.length === 0) return fallback;
  if (value.length === 1) return value[0];
  const v0 = value[0];
  const v1 = value[1];
  // codex P1 (PR #99): 작은 sentinel (2.5 등) 도 filler 로 분류. v0 > 0 일 때 ratio 검사.
  const sentinelRatio = v0 > 0 && v1 / v0 > 5;
  const isFiller = v0 === 0 || v0 > v1 || sentinelRatio;
  const idx = isFiller ? starLevel : starLevel - 1;
  return value[idx] ?? value[isFiller ? 1 : 0] ?? fallback;
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
  // PR101: 매드레드의 검 — 탱커 상대 +15% damageAmp. 다중 부착 시 누적.
  const madredsCount = allItems.filter(i => i?.apiName === 'TFT_Item_MadredsBloodrazor').length;
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
    itemFlatManaPerAttack: 0,
    inventionTankDamageAmp: 0,
    madredsTankDamageAmp: madredsCount * 0.15,
    // Mordekaiser proc 시스템 — 모든 unit 0 default. cast 시점에 applyMordekaiserProcCast 가 set.
    mordekaiserProcEndTick: 0,
    mordekaiserNextProcTick: 0,
    mordekaiserShieldRemaining: 0,
    illaoiAfterShockEndTick: 0,
    illaoiAfterShockApSnapshot: 0,
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
    spaceGrooveAdapPerSec: 0,
    spaceGrooveDurationSec: 0,
    challengerBurstEndTick: 0,
    challengerBurstPercent: 0,
    channelerInnateManaGain: 0,
    meleeMaxShieldPct: 0,
    meleeShieldADBonus: 0,
    blitzBoltCooldownSec: 0,
    blitzBoltDamage: 0,
    blitzBoltLastFireTick: 0,
    blitzBoltSpeedMult: 1,
    gragasCarryActive: false,
    leonaCarryActive: false,
    aatroxCycleCounter: 0,
    aatroxPreviouslyDead: false,
    aatroxNovaStrikeSelector: false,
    astronautMeepsStack: 0,
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
    shenPassiveStack: 0,
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

/**
 * 아이템에서 비-stat per-unit 필드 (execute threshold 등) 를 추출해 unit 에 적용.
 * StatPatch (AD/AP/HP/AS) 는 이미 getItemEffects 에서 처리됨. 본 헬퍼는 trigger / threshold 류만.
 *
 * 현재 처리 대상:
 *   - EvelynnArtifact (TFT17_Item_Artifact_EvelynnArtifact): ExecuteThresholdForTarget=0.12
 *     장착 unit 의 기본 공격/스킬이 체력 12% 이하 적 처형. 기존 augmentExecuteThreshold 필드
 *     재활용 (per-unit execute 임계값 합집합).
 *
 * 향후 다른 artifact / item 의 per-unit threshold 추가 시 본 함수에 분기 추가.
 */
function applyItemStaticEffects(unit: CombatUnit, placed: PlacedChampion): void {
  for (const item of placed.items) {
    if (item.apiName === 'TFT17_Item_Artifact_EvelynnArtifact') {
      const threshold = item.effects['ExecuteThresholdForTarget'];
      if (typeof threshold === 'number' && threshold > 0) {
        unit.augmentExecuteThreshold = Math.max(unit.augmentExecuteThreshold, threshold);
      }
    }
    // FlatManaRestore: 기본 공격당 추가 마나 (쇼진의 창 + 변종 / 향후 신규 아이템).
    // apiName 분기 대신 effect key 기반 generic 처리 — 'TFT_Item_SpearOfShojin' +
    // 'TFT_Item_CorruptedSpearOfShojin' (찬란한 변종) 모두 FlatManaRestore=5 보유 (set 17.1).
    // gainManaOnAttack 에서 unit.itemFlatManaPerAttack 합산 사용.
    // 같은 unit 이 여러 Shojin/Corrupted Shojin 보유 시 누적 (real game stack 동작).
    const fmr = item.effects['FlatManaRestore'];
    if (typeof fmr === 'number' && fmr > 0) {
      unit.itemFlatManaPerAttack += fmr;
    }
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
/**
 * 습격자 (MeleeTrait) 흡혈→보호막 변환 helper.
 *
 * raw audit 발견 (PR #64): omnivamp heal 의 overflow (currentHp == maxHp cap 으로 손실되는 양) 을
 * 보호막으로 변환. cap: maxHp × meleeMaxShieldPct (0.25 = 25%).
 *
 * 호출자: 평타 / DoubleTap extra hit / ability heal 의 omnivamp 사이트.
 */
function applyOmnivampHealWithMeleeShield(unit: CombatUnit, heal: number): void {
  const before = unit.currentHp;
  unit.currentHp = Math.min(unit.maxHp, before + heal);
  if (unit.meleeMaxShieldPct <= 0) return;
  const overflow = heal - (unit.currentHp - before);
  if (overflow <= 0) return;
  const cap = unit.maxHp * unit.meleeMaxShieldPct;
  const room = Math.max(0, cap - unit.shield);
  const addShield = Math.min(overflow, room);
  if (addShield > 0) {
    unit.shield += addShield;
    unit.statusEffects.push({
      type: 'shield', sourceId: unit.id,
      remainingTicks: MAX_TICKS, value: addShield,
    });
  }
}

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

    // 도전자 (TFT17_ASTrait) Burst — 새 대상 dash 시 AS +BurstPercent% × BurstDuration 초.
    // raw audit 발견: BurstDuration=2.5, BurstPercent=0.5. combat-start 에선 burstPercent 만 set.
    if (at.trait.apiName === 'TFT17_ASTrait') {
      const burstPct = (at.activeEffect.variables['BurstPercent'] ?? 0) as number;
      for (const u of units) {
        if (isChampTrait(u)) u.challengerBurstPercent = burstPct;
      }
    }

    // 전달자 (TFT17_ManaTrait) InnateManaGain — 전달자 unit 의 mana gain × (1 + N).
    // raw audit 발견: InnateManaGain=0.20. mana 가산 함수 multiplier.
    if (at.trait.apiName === 'TFT17_ManaTrait') {
      const innate = (at.activeEffect.variables['InnateManaGain'] ?? 0) as number;
      for (const u of units) {
        if (isChampTrait(u)) u.channelerInnateManaGain = innate;
      }
    }

    // 습격자 (TFT17_MeleeTrait) MaxPercentHealthShield + ShieldAD —
    // raw audit 발견: 흡혈 초과량 → 보호막 변환 (cap maxHp × 0.25). (6) tier ShieldAD=0.20 (보호막 활성 시 +AD).
    if (at.trait.apiName === 'TFT17_MeleeTrait') {
      const maxShield = (at.activeEffect.variables['MaxPercentHealthShield'] ?? 0) as number;
      const shieldAD = (at.activeEffect.variables['ShieldAD'] ?? 0) as number;
      for (const u of units) {
        if (isChampTrait(u)) {
          u.meleeMaxShieldPct = maxShield;
          u.meleeShieldADBonus = shieldAD;
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

/**
 * PR5 (17.2b 후속) — Carry augment 활성 시 abilityData.damage override 적용.
 *
 * carry augment 가 활성이면 raw 챔프 ability 변수 대신 augment 의 abilityData.damage 사용.
 * augment 활성 시 챔프 damage 변수는 raw 와 무관 (예: 레오나 carry damage [90,135,225] AD
 * 는 raw 레오나 ShieldAmount 와 별개). damageType 도 augment 우선 (raw magic → physical 등).
 *
 * 공식 (일반 ability formula 일관):
 *   - magic: damage = baseValue × (1 + AP/100)
 *   - physical: damage = baseValue × (1 + bonusAdPercent), 0% default 는 baseValue 그대로
 *
 * 자폭 (그라가스 GragasCarry) 은 PR4 special formula (`maxHp × baseDamageHpFrac + AP × (damage/100)`)
 * 사용 — 본 함수는 일반 cast 경로용. 자폭 분기는 별도 처리.
 *
 * damageType 우선순위 (사용자 결정 PR5):
 *   1. damageTypeOverride (top-level, 명시적)
 *   2. abilityData.damageType (fallback)
 *   3. raw getAbilityDamage 결과 (carry abilityData 자체 없을 때)
 */
function resolveAbilityDamage(
  champion: RawChampion,
  starLevel: number,
  ap: number,
  carryCfg: CarryAugmentConfig | null | undefined,
  damageVar?: string,
): { damage: number; type: DamageType } {
  if (carryCfg?.abilityData?.damage) {
    const damageArr = carryCfg.abilityData.damage;
    const baseValue = damageArr[starLevel - 1] ?? damageArr[0];
    const dmgType: DamageType = carryCfg.damageTypeOverride
      ?? carryCfg.abilityData.damageType
      ?? 'magic';
    let damage = baseValue;
    if (dmgType === 'magic') {
      damage = baseValue * (1 + ap / 100);
    }
    // physical: bonusAdPercent=0 default (raw getAbilityDamage 일관). carry 는 baseValue 그대로.
    // true: scaling 없음.
    return { damage, type: dmgType };
  }
  return getAbilityDamage(champion, starLevel, ap, 0, damageVar);
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

/**
 * PR7-B (17.2b) — dash to_largest_cluster: 가장 큰 적 무리 식별.
 * 사용자 결정: 각 alive 적 위치 중심으로 radius 2 내 타 적 개수 카운트 → max count 적 반환.
 * tie 시 첫 번째 적 (정렬 stable). 꼬마정령 carry 전용.
 */
function findLargestClusterTarget(enemies: CombatUnit[]): CombatUnit {
  let best = enemies[0];
  let bestCount = -1;
  for (const center of enemies) {
    let count = 0;
    for (const other of enemies) {
      if (other === center) continue;
      if (hexDistance(center.position, other.position) <= 2) count++;
    }
    if (count > bestCount) { bestCount = count; best = center; }
  }
  return best;
}

/** 스킬 시전 시 대쉬 이동 — 대상 인접 빈 칸으로 이동 */
function applyAbilityDash(
  unit: CombatUnit,
  dashType: 'to_target' | 'to_farthest' | 'to_lowest_hp' | 'to_backline' | 'to_largest_cluster',
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
    case 'to_largest_cluster': dashTarget = findLargestClusterTarget(aliveEnemies); break;
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

/**
 * 캐스트 사이드 이펙트에서 자주 쓰이는 ally team 분기 헬퍼.
 * unit.team 기준 player/enemies 둘 중 하나를 반환.
 */
function getAllyTeam(
  unit: CombatUnit,
  playerUnits: CombatUnit[],
  enemies: CombatUnit[],
): CombatUnit[] {
  return unit.team === 'player' ? playerUnits : enemies;
}

/**
 * Poppy 스킬 효과 적용:
 * - 본인: Shield 보호막 (AP scaling, ShieldDuration 만료)
 * - 2칸 내 아군: 방어력+마법저항 +Resists (AP scaling, ShieldDuration 만료)
 *
 * sentinel filler (Resists [36, 15, 25, 60, ...] 등) 는 readVarByStar 로 자동 처리.
 *
 * 만료 처리: 직접 stat 수정 + statusEffect 추적 + tickStatusEffects expired loop 에서 revert
 * (line 3014 shield cleanup 패턴 차용 — armor/MR read site 82개 변경 회피).
 */
export function applyPoppyShieldAndResists(
  unit: CombatUnit,
  allies: CombatUnit[],
): void {
  const vars = unit.champion.ability.variables;
  if (!vars) return;
  const shieldBase = readVarByStar(
    vars.find(v => v.name === 'Shield')?.value, unit.starLevel, 0
  );
  const shieldDur = readVarByStar(
    vars.find(v => v.name === 'ShieldDuration')?.value, unit.starLevel, 4
  );
  const resistsBase = readVarByStar(
    vars.find(v => v.name === 'Resists')?.value, unit.starLevel, 0
  );
  const apMul = 1 + unit.stats.ap / 100;
  const shieldValue = shieldBase * apMul;
  const resistsValue = resistsBase * apMul;
  const durTicks = Math.round(shieldDur * TICKS_PER_SECOND);

  // Self shield (line 1080 warden / line 6477 OOR shield 패턴 차용)
  if (shieldValue > 0) {
    unit.shield += shieldValue;
    unit.statusEffects.push({
      type: 'shield',
      sourceId: 'poppy-shield',
      remainingTicks: durTicks,
      value: shieldValue,
    });
  }

  // Ally Resists buff (2칸 radius)
  if (resistsValue > 0) {
    for (const ally of allies) {
      if (ally.id === unit.id) continue;
      if (ally.state === 'dead') continue;
      if (hexDistance(unit.position, ally.position) > 2) continue;
      ally.stats.armor += resistsValue;
      ally.stats.magicResist += resistsValue;
      ally.statusEffects.push({
        type: 'resists-buff',
        sourceId: 'poppy-resists',
        remainingTicks: durTicks,
        value: resistsValue,
      });
    }
  }
}

/**
 * Mordekaiser 캐스트 시점 호출:
 * - InitialShield 를 mordekaiserShieldRemaining 별도 pool 에 추가 (general unit.shield 안 건드림)
 * - 4초간 매초 펄스 state 등록 (mordekaiserProcEndTick, mordekaiserNextProcTick)
 *
 * sentinel filler (InitialShield [0, 300, 375, 500, ...]) 는 readVarByStar 로 자동 처리.
 *
 * getAbilityShield 의 InitialShield 적용은 Mordekaiser 일 때 short-circuit 됨 (line 6031/6650).
 */
export function applyMordekaiserProcCast(unit: CombatUnit, tick: number): void {
  const vars = unit.champion.ability.variables;
  if (!vars) return;

  const initialShield = readVarByStar(
    vars.find(v => v.name === 'InitialShield')?.value, unit.starLevel, 0
  );
  const duration = readVarByStar(
    vars.find(v => v.name === 'Duration')?.value, unit.starLevel, 4
  );
  const apMul = 1 + unit.stats.ap / 100;

  unit.mordekaiserShieldRemaining += initialShield * apMul;
  unit.mordekaiserProcEndTick = tick + Math.round(duration * TICKS_PER_SECOND);
  unit.mordekaiserNextProcTick = tick + TICKS_PER_SECOND;  // 첫 펄스 t=1
}

/**
 * Mordekaiser 매 tick 처리:
 * - 사망 시 cancel + state cleanup (잔여 무효화)
 * - 펄스 발동 (tick >= mordekaiserNextProcTick && tick <= mordekaiserProcEndTick):
 *     1칸 적 → DamagePerProc × AP 마법 피해 (applyAbilityMitigation 통과)
 *     본인 → mordekaiserShieldRemaining += ShieldPerProc × AP (별도 pool)
 *     mordekaiserNextProcTick += TICKS_PER_SECOND
 * - 만료 (tick >= mordekaiserProcEndTick):
 *     HealRefund = 잔여 × 0.4 × (1 + healAmp) → currentHp 회복
 *     state 3 필드 0 reset (잔여 보호막 소모됨 — desc "남은 보호막을 소모하고")
 *
 * 펄스 카운트 4 (t=1/2/3/4): `tick <= mordekaiserProcEndTick` (≤) 로 t=4 펄스 + 만료 동시 처리.
 */
export function tickMordekaiserProc(
  unit: CombatUnit,
  tick: number,
  time: number,
  enemies: CombatUnit[],
  eventBus: EventBus,
  ownArbiterState: { enemyDeathCount: number },
  logs: CombatLog[],
  _tickLogs: CombatLog[],
): void {
  // 비활성: early return
  if (unit.mordekaiserProcEndTick === 0) return;

  // 사망 시 cancel + state cleanup (잔여 무효)
  if (unit.state === 'dead' || unit.currentHp <= 0) {
    unit.mordekaiserProcEndTick = 0;
    unit.mordekaiserNextProcTick = 0;
    unit.mordekaiserShieldRemaining = 0;
    return;
  }

  const vars = unit.champion.ability.variables;
  if (!vars) return;
  const apMul = 1 + unit.stats.ap / 100;

  // 펄스 발동 — 4 펄스 (t=1/2/3/4): "<=" 로 endTick 동시 펄스 + 만료 처리
  if (tick >= unit.mordekaiserNextProcTick && tick <= unit.mordekaiserProcEndTick) {
    const damagePerProc = readVarByStar(
      vars.find(v => v.name === 'DamagePerProc')?.value, unit.starLevel, 0
    );
    const shieldPerProc = readVarByStar(
      vars.find(v => v.name === 'ShieldPerProc')?.value, unit.starLevel, 0
    );

    // 적에게 마법 피해 (1칸 내) — applyAbilityMitigation 파이프라인 통과.
    // codex P2 PR #103: per-target amp 계산 (Vex/주공격 패턴 차용 — line 5378 / 5727).
    //   탱커 amp 3종 (invention/madreds/graves) + sniper amp 모두 target-conditional.
    //   pulse 마다 단일 dmgRaw 재사용은 tank under-damage 유발 → loop 안에서 amp 계산.
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      if (hexDistance(unit.position, e.position) > 1) continue;
      let amp = unit.damageAmp;
      if (unit.inventionTankDamageAmp > 0 && e.role === 'Tank') amp += unit.inventionTankDamageAmp;
      if (unit.madredsTankDamageAmp > 0 && e.role === 'Tank') amp += unit.madredsTankDamageAmp;
      if (unit.gravesTankDamageAmp > 0 && e.role === 'Tank') amp += unit.gravesTankDamageAmp;
      amp += computeSniperDamageAmp(unit, e);
      const dmgRaw = damagePerProc * apMul * (1 + amp);
      const dmg = applyAbilityMitigation(unit, e, dmgRaw, 'magic', eventBus, tick);
      e.currentHp -= dmg;
      e.totalDamageTaken += dmg;
      unit.totalDamageDealt += dmg;
      // 사망 처리: Corki 패턴 차용 (위 `state === 'dead'` 가드로 narrowing 되어 state 비교 불필요)
      if (e.currentHp <= 0) {
        logs.push({ tick, time, type: 'death', sourceId: e.id, message: `${e.champion.name} 사망! (${unit.champion.name}의 펄스)` });
        markTargetDead(unit, e, ownArbiterState, eventBus, tick);
      }
    }

    // 본인 보호막 추가 (별도 pool)
    unit.mordekaiserShieldRemaining += shieldPerProc * apMul;

    unit.mordekaiserNextProcTick += TICKS_PER_SECOND;
  }

  // 만료
  if (tick >= unit.mordekaiserProcEndTick) {
    const healRefund = readVarByStar(
      vars.find(v => v.name === 'HealRefund')?.value, unit.starLevel, 0
    );
    const heal = unit.mordekaiserShieldRemaining * healRefund * (1 + (unit.healAmp ?? 0));
    if (heal > 0) {
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
    }
    unit.mordekaiserShieldRemaining = 0;
    unit.mordekaiserProcEndTick = 0;
    unit.mordekaiserNextProcTick = 0;
  }
}

/**
 * Illaoi 시험 (TFT17_Illaoi) cast 시점 호출:
 * - 가장 가까운 NumEnemies(3) 명 alive 적 lock (distance ASC)
 * - 각 target 에게 HealthDrain × AP true damage 즉시 적용 (사용자 결정: Duration 전체 총량 per-target — simplified instant)
 * - Illaoi heal = total drain × (1 + healAmp)
 * - AfterShock state 등록 (Duration 후 2칸 magic AOE — tickIllaoiAfterShock 에서 발동)
 *
 * Shield 적용은 getAbilityShield 가 처리 (PR #105 fix 후 정확).
 * Damage AOE 는 만료 시 별도 발동 (tickIllaoiAfterShock).
 */
export function applyIllaoiCast(
  unit: CombatUnit,
  tick: number,
  enemies: CombatUnit[],
  eventBus: EventBus,
  ownArbiterState: { enemyDeathCount: number },
  logs: CombatLog[],
): { totalDealt: number; totalRaw: number } {
  const vars = unit.champion.ability.variables;
  if (!vars) return { totalDealt: 0, totalRaw: 0 };

  const healthDrain = readVarByStar(
    vars.find(v => v.name === 'HealthDrain')?.value, unit.starLevel, 0
  );
  const numEnemies = readVarByStar(
    vars.find(v => v.name === 'NumEnemies')?.value, unit.starLevel, 3
  );
  const duration = readVarByStar(
    vars.find(v => v.name === 'Duration')?.value, unit.starLevel, 3
  );
  const apMul = 1 + unit.stats.ap / 100;
  const drainPerTarget = healthDrain * apMul;

  // 가장 가까운 NumEnemies 명 alive 적 lock (distance ASC)
  const aliveByDistance = enemies
    .filter(e => e.state !== 'dead')
    .map(e => ({ e, d: hexDistance(unit.position, e.position) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, numEnemies);

  let totalDrain = 0;  // mitigated total (Illaoi heal source)
  let totalRaw = 0;    // raw total (on_cast.rawValue 용)
  for (const { e } of aliveByDistance) {
    // codex P1 PR #106: true damage 도 applyAbilityMitigation 통과 (shield/invulnerable hooks 적용).
    // dmgType='true' → resistance/pen=0 자동 처리. damageReduction/shield/invulnerable 만 적용.
    const dmg = applyAbilityMitigation(unit, e, drainPerTarget, 'true', eventBus, tick);
    e.currentHp -= dmg;
    e.totalDamageTaken += dmg;
    unit.totalDamageDealt += dmg;
    totalDrain += dmg;
    totalRaw += drainPerTarget;
    // 사망 처리
    if (e.currentHp <= 0) {
      logs.push({ tick, time: tick / TICKS_PER_SECOND, type: 'death', sourceId: e.id, message: `${e.champion.name} 사망! (${unit.champion.name}의 흡수)` });
      markTargetDead(unit, e, ownArbiterState, eventBus, tick);
    }
  }

  // Illaoi 본인 회복 (healAmp 적용)
  if (totalDrain > 0) {
    const heal = totalDrain * (1 + (unit.healAmp ?? 0));
    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
  }

  // AfterShock state 등록 — Duration 후 magic AOE 발동
  unit.illaoiAfterShockEndTick = tick + Math.round(duration * TICKS_PER_SECOND);
  unit.illaoiAfterShockApSnapshot = unit.stats.ap;

  // codex P2 PR #106: drain damage 를 cast 의 totalAbilityDmg accumulator 에 합산 → omnivamp/Fountain/on_cast 정합.
  return { totalDealt: totalDrain, totalRaw };
}

/**
 * Illaoi 매 tick 처리 (만료 체크 + AfterShock AOE):
 * - 비활성: early return
 * - 사망 cancel: state cleanup, AOE 미발동
 * - 만료 (tick >= illaoiAfterShockEndTick): 2칸 내 모든 alive 적에게 Damage × AP snapshot magic AOE
 *   - applyAbilityMitigation 통과 (Vex 그림자 / 주공격 패턴 차용)
 *   - per-target amp: damageAmp + tank 3종 + sniper
 * - state cleanup (2 필드 0 reset)
 */
export function tickIllaoiAfterShock(
  unit: CombatUnit,
  tick: number,
  time: number,
  enemies: CombatUnit[],
  eventBus: EventBus,
  ownArbiterState: { enemyDeathCount: number },
  logs: CombatLog[],
  _tickLogs: CombatLog[],
): void {
  if (unit.illaoiAfterShockEndTick === 0) return;

  // 사망 cancel
  if (unit.state === 'dead' || unit.currentHp <= 0) {
    unit.illaoiAfterShockEndTick = 0;
    unit.illaoiAfterShockApSnapshot = 0;
    return;
  }

  // 만료 전: no-op
  if (tick < unit.illaoiAfterShockEndTick) return;

  // 만료: 2칸 내 alive 적에게 Damage × AP snapshot magic AOE
  const vars = unit.champion.ability.variables;
  if (!vars) {
    unit.illaoiAfterShockEndTick = 0;
    unit.illaoiAfterShockApSnapshot = 0;
    return;
  }

  const damage = readVarByStar(
    vars.find(v => v.name === 'Damage')?.value, unit.starLevel, 0
  );
  const apMul = 1 + unit.illaoiAfterShockApSnapshot / 100;

  for (const e of enemies) {
    if (e.state === 'dead') continue;
    if (hexDistance(unit.position, e.position) > 2) continue;
    // per-target amp (Vex 그림자 / 주공격 패턴)
    let amp = unit.damageAmp;
    if (unit.inventionTankDamageAmp > 0 && e.role === 'Tank') amp += unit.inventionTankDamageAmp;
    if (unit.madredsTankDamageAmp > 0 && e.role === 'Tank') amp += unit.madredsTankDamageAmp;
    if (unit.gravesTankDamageAmp > 0 && e.role === 'Tank') amp += unit.gravesTankDamageAmp;
    amp += computeSniperDamageAmp(unit, e);
    const dmgRaw = damage * apMul * (1 + amp);
    const dmg = applyAbilityMitigation(unit, e, dmgRaw, 'magic', eventBus, tick);
    e.currentHp -= dmg;
    e.totalDamageTaken += dmg;
    unit.totalDamageDealt += dmg;
    if (e.currentHp <= 0) {
      logs.push({ tick, time, type: 'death', sourceId: e.id, message: `${e.champion.name} 사망! (${unit.champion.name}의 시험)` });
      markTargetDead(unit, e, ownArbiterState, eventBus, tick);
    }
  }

  // state cleanup
  unit.illaoiAfterShockEndTick = 0;
  unit.illaoiAfterShockApSnapshot = 0;
}

function applyShield(unit: CombatUnit, damage: number, eventBus: EventBus, tick: number): number {
  let remaining = damage;

  // === Mordekaiser 스킬 보호막 (별도 pool, source별 분리) ===
  // mordekaiserShieldRemaining 가 양수일 때 우선 흡수. 다른 챔프는 0 default → skip.
  if (unit.mordekaiserShieldRemaining > 0 && remaining > 0) {
    const absorbed = Math.min(unit.mordekaiserShieldRemaining, remaining);
    unit.mordekaiserShieldRemaining -= absorbed;
    remaining -= absorbed;
  }

  // === General unit.shield (시너지/아이템) — 기존 로직 ===
  if (unit.shield > 0 && remaining > 0) {
    const absorbed = Math.min(unit.shield, remaining);
    unit.shield -= absorbed;
    remaining -= absorbed;
    if (unit.shield <= 0) {
      unit.shield = 0;
      unit.statusEffects = unit.statusEffects.filter(e => e.type !== 'shield');
      eventBus.emit('on_shield_break', { sourceId: unit.id, tick });
    }
  }

  return remaining;
}

/**
 * 통합 carry post-cast effects helper (refactor: cast-post-processing-helper).
 *
 * cast loop 끝 (mitigation/사망 처리 후, post-cast pipeline 직전) 에 호출.
 * carry-specific 메커니즘 중 abilityTargets 후처리:
 *   1. **꼬마정령 multi-stun** (PR7-B): caster 위치 기준 가장 가까운 3명 stun (1.25/1.5/1.75초)
 *   2. **Akali 단검 burn refresh** (PR7-C.7): akali-nova-selector burn × 1.10
 *
 * caller 2 site (cast loop main + OOR cast loop). 두 site 모두 동일 호출 → 신규 carry
 * post-cast 메커니즘 추가 시 helper 한 곳만 수정 (PR #76 multi-stun OOR 누락 / PR #82 Akali
 * burn OOR 누락 같은 in-range/OOR 동기화 회귀 자동 방지).
 *
 * 향후 후속: post-cast pipeline (omnivamp / Fountain heal / on_cast emit) 도 helper 통합 가능.
 */
function applyCarryPostCastEffects(
  unit: CombatUnit,
  abilityTargets: CombatUnit[],
  carryCfg: CarryAugmentConfig | null | undefined,
): void {
  // 1. 꼬마정령 carry multi-stun — caster 위치 기준 가장 가까운 3명 stun
  if (carryCfg?.abilityData?.stunDuration
      && carryCfg.augmentApiName === 'TFT17_Augment_IvernMinionCarry') {
    const stunArr = carryCfg.abilityData.stunDuration;
    const ivernStunDur = stunArr[unit.starLevel - 1] ?? stunArr[0];
    if (ivernStunDur > 0) {
      const ivernStunTicks = Math.round(ivernStunDur * TICKS_PER_SECOND);
      const IVERN_STUN_TARGETS = 3;
      const sortedClose = abilityTargets
        .filter(t => t.state !== 'dead')
        .slice()
        .sort((a, b) =>
          hexDistance(unit.position, a.position) - hexDistance(unit.position, b.position)
        )
        .slice(0, IVERN_STUN_TARGETS);
      for (const t of sortedClose) {
        t.statusEffects.push({ type: 'stun', sourceId: unit.id, remainingTicks: ivernStunTicks });
        t.state = 'idle';
        t.attackCooldown = 0;
      }
    }
  }

  // 2. Akali raw ability "단검" hit 시 akali-nova-selector burn × 1.10 (refresh).
  // 사용자 spec PR7-C.7: "단검은 출혈 피해량을 10% 증가". surge 전 (burn 없음) → 자연스럽게 무효.
  if (unit.champion.apiName === 'TFT17_Akali') {
    for (const t of abilityTargets) {
      if (t.state === 'dead') continue;
      const akaliBurn = t.statusEffects.find(
        se => se.type === 'burn' && se.sourceId === 'akali-nova-selector'
      );
      if (akaliBurn && akaliBurn.value) {
        akaliBurn.value *= 1.10;
      }
    }
  }
}

/**
 * 통합 carry-specific damage modifier helper (refactor: carry-damage-modifier).
 *
 * cast loop 안의 baseDmg 계산 분기 5종 통합:
 *   1. **singleTargetMultiplier** (아트록스 찍기 cycle): aliveTargets.length === 1 시 ×N
 *   2. **secondaryDamage** (파이크 X-shape, 레오나 line): primary 외 target 에 별도 damage
 *   3. **tankBonusMultiplier** (파이크 onKillRecast): primary target 이 Tank 일 때 ×(1+N)
 *   4. **armorScale** (뽀삐): baseDmg + (target.armor × armorScale) — raw 가산
 *   5. **hexReduction** (꼬마정령): abilityTarget 위치 기준 multiplicative falloff
 *
 * 자폭 (그라가스) 의 hexReduction / tankBonusMultiplier / baseDamageHpFrac 은 selfDamage
 * 분기 special path (PR4) 라 본 helper 무관.
 *
 * caller 2 site (cast loop main + OOR cast loop). OOR 도 동일 helper 호출 → in-range 와
 * 동작 일관 보장 (codex P1 #76 권장 사항: 다른 carry-specific 메커니즘 OOR 누락 회귀 자동 해소).
 *
 * **호출 순서**: 단독 적중 → secondary → tankBonus → armorScale → hexReduction
 *   (기존 cast loop 분기 순서 보존).
 */
function applyCarryDamageModifiers(
  baseDmg: number,
  unit: CombatUnit,
  t: CombatUnit,
  carryCfg: CarryAugmentConfig | null | undefined,
  context: {
    abilityTarget: CombatUnit;
    aliveTargetCount: number;
    aatroxIsSingleTargetSlam: boolean;
  },
): number {
  if (!carryCfg?.abilityData) return baseDmg;
  const ad = carryCfg.abilityData;
  const isPrimaryTarget = t === context.abilityTarget;

  // 1. 단독 적중 multiplier (아트록스 찍기 cycle 한정)
  if (context.aatroxIsSingleTargetSlam
      && context.aliveTargetCount === 1
      && ad.singleTargetMultiplier) {
    baseDmg *= ad.singleTargetMultiplier;
  }
  // 2. secondary damage (파이크 X-shape 주변 적, 레오나 line 추가 적)
  if (ad.secondaryDamage && !isPrimaryTarget) {
    const secArr = ad.secondaryDamage;
    const secBase = secArr[unit.starLevel - 1] ?? secArr[0];
    const secDmgType: DamageType = carryCfg.damageTypeOverride ?? ad.damageType ?? 'magic';
    baseDmg = secDmgType === 'magic'
      ? secBase * (1 + unit.stats.ap / 100)
      : secBase;
  }
  // 3. tankBonusMultiplier (primary target 이 Tank 일 때만 +N%)
  if (isPrimaryTarget && ad.tankBonusMultiplier && t.role === 'Tank') {
    baseDmg *= (1 + ad.tankBonusMultiplier);
  }
  // 4. armorScale (뽀삐: raw damage + target.armor × armorScale)
  if (ad.armorScale) {
    baseDmg += t.stats.armor * ad.armorScale;
  }
  // 5. hexReduction (꼬마정령 한정 — augmentApiName 검사. 자폭 그라가스는 selfDamage 분기 별도)
  if (ad.hexReduction !== undefined
      && carryCfg.augmentApiName === 'TFT17_Augment_IvernMinionCarry') {
    const distFromCenter = hexDistance(context.abilityTarget.position, t.position);
    baseDmg *= Math.pow(1 - ad.hexReduction, distFromCenter);
  }
  return baseDmg;
}

/**
 * 통합 ability mitigation pipeline (refactor: cast-mitigation-helpers).
 *
 * 8 cast site 에서 동일하게 호출하던 mitigation 5단계 통합:
 *   1. resistance + penetration (magic/physical/true 분기)
 *   2. damageReduction (DR — 증강 등)
 *   3. Fighter/Assassin non-target reduction (`t.target !== unit.id` 시 ×0.85)
 *   4. shield 흡수 (applyShield)
 *   5. invulnerable 검사 (있으면 0)
 *
 * caller 8 곳:
 *   - 일반 cast loop (line ~5468) — 표준 ability damage
 *   - OOR cast loop (line ~6065) — 사거리 밖 dash cast
 *   - PR4 자폭 적군 AOE (line ~5012) — 그라가스 자폭
 *   - PR7-A 파이크 cascade (line ~5547) — onKillRecast
 *   - PR7-C 아트록스 N.O.V.A. (line ~5616) — 추가 발동
 *   - PR7-D 뽀삐 bouncing (line ~5687) — overkill chain
 *   - PR7-E 꼬마정령/잭스 onAttackBonus (line ~4671) — basic attack 추가 magic
 *
 * codex P1 (PR #76) 권장 — OOR cast 누락 회귀 방지 + 신규 cast site 추가 시 mitigation
 * 일관 보장. 본 helper 도입 후 신규 cast site 가 호출만 하면 모든 mitigation 자동 적용.
 */
function applyAbilityMitigation(
  unit: CombatUnit,
  t: CombatUnit,
  rawDmg: number,
  dmgType: DamageType,
  eventBus: EventBus,
  tick: number,
): number {
  const resistance = dmgType === 'magic' ? t.stats.magicResist
    : dmgType === 'physical' ? t.stats.armor : 0;
  const pen = dmgType === 'magic' ? unit.stats.magicPen
    : dmgType === 'physical' ? unit.stats.armorPen : 0;
  let effectiveDmg = applyResistance(rawDmg, resistance, pen);
  if (t.damageReduction > 0) effectiveDmg *= (1 - t.damageReduction);
  if ((t.role === 'Fighter' || t.role === 'Assassin') && t.target !== unit.id) {
    effectiveDmg *= (1 - NON_TARGET_DAMAGE_REDUCTION);
  }
  effectiveDmg = applyShield(t, effectiveDmg, eventBus, tick);
  if (t.statusEffects.some(e => e.type === 'invulnerable')) effectiveDmg = 0;
  // PR7-C.6 (17.2b): Caitlyn N.O.V.A. selector mark — incoming damage amp +10%.
  // mark statusEffect 의 value 가 incoming amp 비율 (0.10). caitlyn-nova-selector source 한정.
  // Kindred mark 는 value 없어 (표시만) 자연스럽게 무관.
  for (const mark of t.statusEffects) {
    if (mark.type === 'mark' && mark.sourceId === 'caitlyn-nova-selector' && mark.value) {
      effectiveDmg *= (1 + mark.value);
    }
  }
  return effectiveDmg;
}

/**
 * 통합 사망 처리 helper (refactor: cast-mitigation-helpers).
 *
 * caller 가 currentHp <= 0 검사 후 호출. helper 가:
 *   1. currentHp 0 clamp
 *   2. state = 'dead'
 *   3. unit.killCount + ownArbiterState.enemyDeathCount 증가
 *   4. on_kill / on_death event emit
 *
 * deathLog 작성은 caller 책임 (각 cast site 메시지 다름 — 자폭 / 일반 ability / 자동 재시전 등).
 *
 * **caller 책임**:
 *   - currentHp <= 0 검사
 *   - overkill 캡처 (PR7-D 뽀삐 bouncing 같이 clamp 전 음수 필요한 경우 — clamp 전에 직접 처리)
 *
 * 8 cast site 에서 일관 호출.
 */
function markTargetDead(
  unit: CombatUnit,
  t: CombatUnit,
  ownArbiterState: { enemyDeathCount: number },
  eventBus: EventBus,
  tick: number,
): void {
  t.currentHp = 0;
  t.state = 'dead';
  unit.killCount++;
  ownArbiterState.enemyDeathCount++;
  eventBus.emit('on_kill', { sourceId: unit.id, targetId: t.id, tick });
  eventBus.emit('on_death', { sourceId: t.id, targetId: unit.id, tick });
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
 * 파멸자 (벡스) — TFT17_VexUniqueTrait. 양 팀 동시 처리 (symmetric).
 *
 * raw: ADAP1=12 (12%).
 * codex P1 fix (PR #60): 양 팀 순차 호출 시 두 번째 Vex 가 이미 차감된 stats 에서 강탈 →
 * deterministic player advantage. 양쪽 강탈량 snapshot 으로 계산 후 동시 적용.
 *
 * 시뮬 단순화: combat-start 시 즉시 일괄 적용 (적이 모두 hit 받게 됨 가정 — 표식 메커니즘 생략).
 */
function applyVexDoomBothSides(
  playerActiveTraits: ActiveTrait[],
  enemyActiveTraits: ActiveTrait[],
  playerUnits: CombatUnit[],
  enemies: CombatUnit[],
): void {
  const playerTrait = playerActiveTraits.find(t => t.trait.apiName === 'TFT17_VexUniqueTrait' && t.activeEffect);
  const enemyTrait = enemyActiveTraits.find(t => t.trait.apiName === 'TFT17_VexUniqueTrait' && t.activeEffect);
  const playerVex = playerTrait ? findStrongestUnitByApi(playerUnits, 'TFT17_Vex') : null;
  const enemyVex = enemyTrait ? findStrongestUnitByApi(enemies, 'TFT17_Vex') : null;
  if (!playerVex && !enemyVex) return;

  const playerPct = playerTrait?.activeEffect ? ((playerTrait.activeEffect.variables['ADAP1'] ?? 12) as number) / 100 : 0;
  const enemyPct = enemyTrait?.activeEffect ? ((enemyTrait.activeEffect.variables['ADAP1'] ?? 12) as number) / 100 : 0;

  // Snapshot 단계: 원본 stats 기반 강탈량 계산. 양 팀 모두 원본에서 비례 차감.
  type Steal = { unit: CombatUnit; ad: number; ap: number };
  const enemySteals: Steal[] = [];  // playerVex 가 적군에서 가져갈 양
  const playerSteals: Steal[] = []; // enemyVex 가 player 에서 가져갈 양
  if (playerVex && playerPct > 0) {
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      enemySteals.push({ unit: e, ad: e.stats.damage * playerPct, ap: e.stats.ap * playerPct });
    }
  }
  if (enemyVex && enemyPct > 0) {
    for (const p of playerUnits) {
      if (p.state === 'dead') continue;
      playerSteals.push({ unit: p, ad: p.stats.damage * enemyPct, ap: p.stats.ap * enemyPct });
    }
  }
  // Apply 단계: 차감 + 가산.
  let playerVexAd = 0, playerVexAp = 0;
  let enemyVexAd = 0, enemyVexAp = 0;
  for (const s of enemySteals) {
    s.unit.stats.damage = Math.max(0, s.unit.stats.damage - s.ad);
    s.unit.stats.ap = Math.max(0, s.unit.stats.ap - s.ap);
    playerVexAd += s.ad;
    playerVexAp += s.ap;
  }
  for (const s of playerSteals) {
    s.unit.stats.damage = Math.max(0, s.unit.stats.damage - s.ad);
    s.unit.stats.ap = Math.max(0, s.unit.stats.ap - s.ap);
    enemyVexAd += s.ad;
    enemyVexAp += s.ap;
  }
  if (playerVex) {
    playerVex.stats.damage += playerVexAd;
    playerVex.stats.ap += playerVexAp;
  }
  if (enemyVex) {
    enemyVex.stats.damage += enemyVexAd;
    enemyVex.stats.ap += enemyVexAp;
  }
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
/**
 * Blitzcrank Bolt passive 활성화 — combat-start 시 Blitzcrank unit 에 cooldown/damage set.
 *
 * raw ability variables (champion):
 *   BoltCooldown: [_, 2, 2, 0.5] — star1=2s, star2=2s, star3=0.5s
 *   BoltDamage: [_, 60, 90, 150] — star1=60, star2=90, star3=150
 *
 * 매 BoltCooldown 초마다 main loop 에서 가장 체력 높은 적에 magic damage (AP scaling).
 * 파티광 회복 완료 시 blitzBoltSpeedMult ×4 적용 (effective cooldown / 4).
 */
function applyBlitzcrankBoltPassive(ownTeam: CombatUnit[]): void {
  for (const u of ownTeam) {
    if (u.champion.apiName !== 'TFT17_Blitzcrank') continue;
    const cooldownArr = u.champion.ability.variables?.find(v => v.name === 'BoltCooldown')?.value;
    const damageArr = u.champion.ability.variables?.find(v => v.name === 'BoltDamage')?.value;
    if (!cooldownArr || !damageArr) continue;
    u.blitzBoltCooldownSec = cooldownArr[u.starLevel] ?? cooldownArr[1] ?? 0;
    u.blitzBoltDamage = damageArr[u.starLevel] ?? damageArr[1] ?? 0;
  }
}

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
 * 여행자 (TFT17_FlexTrait) — 전투 시작 시 모든 아군에 효과.
 *
 * raw effects (tier별 — minUnits=2/3/4/5/6):
 *   BonusDA: 0.09 / 0.15 / 0.18 / 0.22 / 0.27 — 비탱커 damage amp
 *   ShieldHP: 175 / 250 / 350 / 500 / 700 — 탱커 shield HP
 *   ShieldDuration: 15 (모든 tier 동일) — 보호막 지속 시간 (초)
 *
 * 메커니즘 (desc 기반):
 *   - 모든 아군 탱커 (role==='Tank') 가 ShieldHP 보호막 ShieldDuration 초.
 *   - 그 외 아군 (비탱커) 은 BonusDA 만큼 damage amp.
 *   - 여행자 챔프 (unitHasTrait '여행자') 는 위 두 효과 모두 ×2 (능력치 두 배).
 */
function applyFlexTraitBuffs(activeTraits: ActiveTrait[], ownTeam: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_FlexTrait' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const v = trait.activeEffect.variables;
  const bonusDA = (v['BonusDA'] ?? 0) as number;
  const shieldHP = (v['ShieldHP'] ?? 0) as number;
  const shieldDurSec = (v['ShieldDuration'] ?? 15) as number;
  if (bonusDA <= 0 && shieldHP <= 0) return;
  const shieldTicks = Math.round(shieldDurSec * TICKS_PER_SECOND);
  for (const u of ownTeam) {
    if (u.state === 'dead') continue;
    const isFlexUnit = unitHasTrait(u, '여행자');
    const multiplier = isFlexUnit ? 2 : 1;
    // 해석 B (실험): 여행자 챔프도 role 별 본인 받는 effect 만 ×2 (보수적).
    // 일반 탱커 = shield 만, 비탱커 = damageAmp 만. 여행자 챔프 = 자기 role effect 만 ×2.
    if (u.role === 'Tank' && shieldHP > 0) {
      const sh = shieldHP * multiplier;
      u.shield += sh;
      u.statusEffects.push({
        type: 'shield', sourceId: u.id,
        remainingTicks: shieldTicks, value: sh,
      });
    } else if (u.role !== 'Tank' && bonusDA > 0) {
      u.damageAmp += bonusDA * multiplier;
    }
  }
}

/**
 * 우주 그루브 (TFT17_SpaceGroove) 일반 tier — 매 1초 ADAP +N% (그루비안 한정).
 *
 * raw effects (tier 별):
 *   (1) tier 0: minUnits=1 placeholder, 효과 null
 *   (3) tier 1: StartOfCombatDuration=3 (3초 동안 그루브 상태 — 매초 효과 미정)
 *   (5) tier 2: ADAPPerSecond=5, StartOfCombatDuration=3
 *   (7) tier 3: ADAPPerSecond=5, EffectBonus=10, StartOfCombatDuration=3
 *   (10) prism: ADAPPerSecond=10, EffectBonus=500, StartOfCombatDuration=60 — detectPrismTraits 가
 *               즉시 winner 결정 (별도 처리). 본 함수는 일반 tier 만 set.
 *
 * EffectBonus 의미는 raw 미해석 (단순화 — 미적용).
 * 매 1초 main loop tick 에서 ADAP 가산 — main loop 에서 spaceGrooveDurationSec 초 동안만.
 */
function applySpaceGrooveBuffs(activeTraits: ActiveTrait[], ownTeam: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_SpaceGroove' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const v = trait.activeEffect.variables;
  const adapPerSec = (v['ADAPPerSecond'] ?? 0) as number;
  const durationSec = (v['StartOfCombatDuration'] ?? 0) as number;
  if (adapPerSec <= 0 || durationSec <= 0) return;
  // prism (style=6) tier 는 detectPrismTraits 가 즉시 winner 결정 — 본 함수는 일반 tier 만.
  if (trait.style >= 6) return;
  for (const u of ownTeam) {
    if (!unitHasTrait(u, '우주 그루브')) continue;
    u.spaceGrooveAdapPerSec = adapPerSec;
    u.spaceGrooveDurationSec = durationSec;
  }
}

/**
 * 복제자 (MF) — TFT17_APTrait. minUnits=2 / 4 두 tier.
 * raw: Effectiveness=0.22 (2-3) / 0.45 (4+).
 *
 * codex P1 fix (PR #60): 모든 복제자 trait 보유 unit 에 적용 — MF replicator mode +
 * 자연 복제자 챔프 (Lulu/Nami/Veigar/Pantheon/Lissandra) 모두 포함.
 * unitHasTrait('복제자') 로 식별 (resolvedTraits 통합 검사).
 *
 * 스킬 cast 시 ability damage × (1 + Effectiveness) 적용 (단일 cast 등가).
 */
function applyReplicatorTrait(activeTraits: ActiveTrait[], ownTeam: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_APTrait' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const effectiveness = (trait.activeEffect.variables['Effectiveness'] ?? 0.22) as number;
  if (effectiveness <= 0) return;
  for (const u of ownTeam) {
    if (unitHasTrait(u, '복제자')) {
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
  // PR7-E (17.2b): Meeps stack 저장 — 정령족 unit 의 carry damage / onAttack 패시브 사용.
  // 사용자 결정: trait Meeps 변수 사용 (2/3/4/6 = tier 3/5/7/10).
  const meeps = (trait.activeEffect.variables['Meeps'] ?? 0) as number;
  for (const u of units) {
    if (!unitHasTrait(u, '정령족')) continue;
    if (bonusHp > 0) {
      u.maxHp += bonusHp;
      u.currentHp += bonusHp;
    }
    // PR7-E: Meeps stack 저장 (뽀삐 carry spiritEffectPerStack 등에 사용)
    if (meeps > 0) {
      u.astronautMeepsStack = meeps;
    }
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
 *                          (ADAP × (1 + 0.85), ExecuteHPPercent × (1 + 0.85))
 *                          + 소형 블랙홀 maxHp = (아군 darkStar maxHp 합) × 0.30
 *   (9) tier (style 6)  : 프리즘 — 별도 prism handler 처리 (10레벨 즉시 승리)
 *
 * 암흑의 별 챔프 (6명): Kaisa, Karma, Jhin, Chogath, Lissandra, Mordekaiser.
 *
 * PercentHealth=0.30 변수는 FakeUnit (소형 블랙홀) ability desc 에서 사용:
 *   "아군 암흑의 별 체력의 30% 만큼 최대 체력을 얻습니다."
 *   raw hp=1 base 만으로는 첫 공격에 즉사 → 합산 보정 필수.
 */
function applyDarkStarEffects(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_DarkStar');
  if (!trait || !trait.activeEffect || trait.style === 0) return;
  const v = trait.activeEffect.variables;
  const adap = (v.ADAP ?? 0) as number;
  const executePct = (v.ExecuteHPPercent ?? 0) as number;
  const supermassiveBonus = (v.SupermassivePercentBonus ?? 0) as number;
  const blackholeHpFrac = (v.PercentHealth ?? 0) as number;

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

  // (6)+ tier 소형 블랙홀 maxHp 보정 (FakeUnit ability desc):
  //   "아군 암흑의 별 체력의 30% 만큼 최대 체력을 얻습니다."
  //   합산 시점 — Brawler/Astronaut/Stargazer HP buff 모두 적용 후 (호출 순서 보장).
  //   미보정 시 hp=1 base 그대로 첫 공격에 즉사 (사용자 보고 회귀 가드).
  if (trait.style >= 5 && blackholeHpFrac > 0) {
    const blackholes = units.filter(u => u.champion.apiName === 'TFT17_DarkStar_FakeUnit');
    if (blackholes.length > 0) {
      const totalDarkStarHp = darkStarUnits.reduce((sum, u) => sum + u.maxHp, 0);
      const bonusHp = Math.round(totalDarkStarHp * blackholeHpFrac);
      for (const bh of blackholes) {
        bh.maxHp = bh.maxHp + bonusHp;
        bh.currentHp = bh.maxHp;
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
 * Hero carry augment 변환 — 영웅 증강 활성 시 가장 강한 챔프 1명을 augment-specific
 * 빌드로 변환:
 *   1. 역할군 변경 (사용자 명세 "주문력 전사" / "공격력 전사" → 시뮬 내부 'Fighter')
 *   2. statOverrides 적용 (HP/AS/range 등 — 사용자 인게임 측정 기반 채워넣기)
 *   3. ability override 는 getAbilityConfigForUnit (carry augment lookup) 에서 처리
 *
 * 변환 후 마나 재생 / 공격 속도 / 타게팅은 변경된 role 룰 자동 적용 (mana.ts 등).
 *
 * gragasCarryActive / leonaCarryActive 는 ability 분기용 flag 로 유지 (기존 호출 경로 호환).
 * 다른 carry augment (Nasus/Aatrox/Poppy/Pyke/IvernMinion/Jax/Mordekaiser) 는
 * findCarryAugment 에서 ability 가져오므로 별도 flag 불필요.
 */
function applyHeroCarryTransforms(augmentApiNames: string[], units: CombatUnit[]): void {
  const augSet = new Set(augmentApiNames);
  for (const cfg of CARRY_AUGMENTS) {
    if (!augSet.has(cfg.augmentApiName)) continue;
    const target = findStrongestUnitByApi(units, cfg.targetChampionApiName);
    if (!target) continue;
    // role 변환: statOverrides.role 우선, 없으면 default 'Fighter' (사용자 명세 단순화)
    target.role = cfg.statOverrides?.role ?? 'Fighter';
    // statOverrides 적용 — undefined 필드는 기존 stat 유지 (안전 default)
    const so = cfg.statOverrides;
    if (so) {
      if (so.hp !== undefined) {
        target.maxHp = so.hp;
        target.currentHp = so.hp;
      }
      if (so.armor !== undefined) target.stats.armor = so.armor;
      if (so.magicResist !== undefined) target.stats.magicResist = so.magicResist;
      if (so.damage !== undefined) target.stats.damage = so.damage;
      if (so.attackSpeed !== undefined) target.stats.attackSpeed = so.attackSpeed;
      if (so.range !== undefined) target.stats.range = so.range;
      if (so.mana !== undefined) target.maxMana = so.mana;
      if (so.initialMana !== undefined) target.currentMana = so.initialMana;
    }
    // ability 분기용 flag (기존 호출 경로 호환)
    if (cfg.augmentApiName === 'TFT17_Augment_GragasCarry') {
      target.gragasCarryActive = true;
    } else if (cfg.augmentApiName === 'TFT17_Augment_LeonaCarry') {
      target.leonaCarryActive = true;
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
  isPlayerTeam: boolean,
): void {
  const stargazer = traits.find((t) => t.trait.name === '별돌보미');
  if (!stargazer || !stargazer.activeEffect || stargazer.style === 0) return;

  const apiName = stargazer.trait.apiName;
  if (apiName === 'TFT17_Stargazer') return; // base trait — 변종 미지정
  if (!constellation) return;

  const eff = stargazer.activeEffect.variables;
  const empoweredTiles = CONSTELLATION_TILE_PATTERN[constellation];
  // 패턴 좌표(offset) 의 lookup set 을 미리 구축. 빠른 매칭.
  const patternOffsetSet = new Set<string>(
    empoweredTiles.map((t) => {
      const off = axialToOffset(t);
      return `${off.row}-${off.col}`;
    }),
  );
  const isStargazerUnit = (u: CombatUnit): boolean => unitHasTrait(u, '별돌보미');
  // 매핑 (PR10 — display 와 일관, 사용자 명시 spec):
  //  - A팀 (player): pattern.row = own-frame.row, pattern.col = own-frame.col (직접 매칭)
  //  - B팀 (enemy):  pattern.row = 3 - own-frame.row, pattern.col = BOARD_COLS-1 - own-frame.col (보드 중심 180° 회전)
  // own-frame 복원 (combat row → 0..3 own-frame row):
  //  - simulator path: player toEightRowCoords 후 r=4..7 → own=combat-4. enemy r=0..3 → own=combat.
  //  - default path A (skipMirror=false): player r=0..3 → own=combat. enemy mirrored r=4..7 → own=7-combat.
  //  - gameDiffer path (skipMirror=true, no pre-shift): 둘 다 r=0..3 → own=combat.
  const isOnTile = (u: CombatUnit): boolean => {
    const off = axialToOffset(u.position);
    const ownRow = isPlayerTeam
      ? (off.row >= 4 ? off.row - 4 : off.row)
      : (off.row >= 4 ? 7 - off.row : off.row);
    const ownCol = off.col;
    const patternRow = isPlayerTeam ? ownRow : 3 - ownRow;
    const patternCol = isPlayerTeam ? ownCol : BOARD_COLS - 1 - ownCol;
    return patternOffsetSet.has(`${patternRow}-${patternCol}`);
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
    // Poppy ally Resists buff 만료 시 stats.armor / stats.magicResist 에서 차감.
    // 직접 stat 수정 + 만료 시 revert 패턴 (line 3014 shield cleanup 차용).
    if (effect.type === 'resists-buff' && effect.value) {
      unit.stats.armor = Math.max(0, unit.stats.armor - effect.value);
      unit.stats.magicResist = Math.max(0, unit.stats.magicResist - effect.value);
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

  // 도전자 Burst — 새 대상 dash 후 BurstDuration 초 동안 AS +BurstPercent.
  // challengerBurstEndTick 만료 체크는 main loop 에서 처리. 여기선 endTick > 0 이면 활성.
  if (unit.challengerBurstEndTick > 0 && unit.challengerBurstPercent > 0) {
    as *= (1 + unit.challengerBurstPercent);
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
            itemFlatManaPerAttack: 0,
            inventionTankDamageAmp: 0,
            madredsTankDamageAmp: 0,
            mordekaiserProcEndTick: 0,
            mordekaiserNextProcTick: 0,
            mordekaiserShieldRemaining: 0,
            illaoiAfterShockEndTick: 0,
            illaoiAfterShockApSnapshot: 0,
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
            spaceGrooveAdapPerSec: 0,
            spaceGrooveDurationSec: 0,
            challengerBurstEndTick: 0,
            challengerBurstPercent: 0,
            channelerInnateManaGain: 0,
            meleeMaxShieldPct: 0,
            meleeShieldADBonus: 0,
            blitzBoltCooldownSec: 0,
            blitzBoltDamage: 0,
            blitzBoltLastFireTick: 0,
            blitzBoltSpeedMult: 1,
            gragasCarryActive: false,
            leonaCarryActive: false,
            aatroxCycleCounter: 0,
            aatroxPreviouslyDead: false,
            aatroxNovaStrikeSelector: false,
            astronautMeepsStack: 0,
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
            shenPassiveStack: 0,
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
    itemFlatManaPerAttack: 0,
    inventionTankDamageAmp: 0,
    madredsTankDamageAmp: 0,
    mordekaiserProcEndTick: 0,
    mordekaiserNextProcTick: 0,
    mordekaiserShieldRemaining: 0,
    illaoiAfterShockEndTick: 0,
    illaoiAfterShockApSnapshot: 0,
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
    spaceGrooveAdapPerSec: 0,
    spaceGrooveDurationSec: 0,
    challengerBurstEndTick: 0,
    challengerBurstPercent: 0,
    channelerInnateManaGain: 0,
    meleeMaxShieldPct: 0,
    meleeShieldADBonus: 0,
    blitzBoltCooldownSec: 0,
    blitzBoltDamage: 0,
    blitzBoltLastFireTick: 0,
    blitzBoltSpeedMult: 1,
    gragasCarryActive: false,
    leonaCarryActive: false,
    aatroxCycleCounter: 0,
    aatroxPreviouslyDead: false,
    aatroxNovaStrikeSelector: false,
    astronautMeepsStack: 0,
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
    shenPassiveStack: 0,
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

  // 갈리오는 필드에 배치되지만 전투 시작 시 보드에 없음 (데마시아 결집 시 소환).
  // BoonOfStars star sum 에 포함되면 over-buff 발생 (codex P2 PR #91) → 미리 제외 필터.
  const isGalioPlaceholder = (p: PlacedChampion) => p.champion.apiName === 'TFT16_Galio';
  const playerCombatRoster = allyTeam.filter(p => !isGalioPlaceholder(p));
  const enemyCombatRoster = enemyTeam.filter(p => !isGalioPlaceholder(p));

  // 팀별 starLevel 합 — 바루스의 은총(BoonOfStars) 등 별 레벨 합 기반 augment 입력.
  // Galio placeholder 는 전투 시작 시 보드에 없으므로 제외 (combat roster 기준).
  const playerStarLevelSum = playerCombatRoster.reduce((s, p) => s + (p.starLevel ?? 0), 0);
  const enemyStarLevelSum = enemyCombatRoster.reduce((s, p) => s + (p.starLevel ?? 0), 0);

  const playerAugmentEffects = resolveAugmentEffects(playerAugsWithStacks, playerStarLevelSum);
  const enemyAugmentEffects = resolveAugmentEffects(enemyAugsWithStacks, enemyStarLevelSum);

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

  // 갈리오는 필드에 배치되지만 전투 시작 시 제외 → 데마시아 결집 시 소환.
  // (위에서 이미 필터링한 playerCombatRoster/enemyCombatRoster 와 동일 — 이름만 다른 alias.)
  const isGalio = isGalioPlaceholder;
  const playerGalioPlaced = allyTeam.find(isGalio);
  const enemyGalioPlaced = enemyTeam.find(isGalio);
  const playerTeamFiltered = playerCombatRoster;
  const enemyTeamFiltered = enemyCombatRoster;

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
    applyItemStaticEffects(unit, swapped);
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
    applyItemStaticEffects(unit, swapped);
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
  // codex P2 (PR #68): hero carry augment 가 챔프 role 을 'Fighter' 로 변환할 수 있어
  // applyHeroCarryTransforms 직후로 호출 위치 이동 (변환된 carry 도 AS bonus 수령).
  // stageNumber 만 여기서 미리 계산해두고 실제 적용은 transform 이후로 연기.
  const stageNumber = options.stageNumber ?? 4;
  const fighterASBonus = getFighterASBonus(stageNumber);

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
  // 파멸자 (Vex) — 적 ADAP 12% 강탈. codex P1 (PR #60): 양 팀 snapshot 동시 처리로 order bias 제거.
  applyVexDoomBothSides(playerActiveTraits, enemyActiveTraits, playerUnits, enemies);
  // 은하계 사냥꾼 (Zed) — Zed +40% AD (분신 alive 가정 단순화).
  applyZedShadow(playerActiveTraits, playerUnits);
  applyZedShadow(enemyActiveTraits, enemies);
  // 파티광 (Blitzcrank) — HP threshold/healRate 설정 (main loop tick 에서 trigger).
  applyPartyTrickster(playerActiveTraits, playerUnits);
  applyPartyTrickster(enemyActiveTraits, enemies);
  // Blitzcrank Bolt passive — 매 BoltCooldown 초마다 가장 체력 높은 적에 magic damage.
  applyBlitzcrankBoltPassive(playerUnits);
  applyBlitzcrankBoltPassive(enemies);
  // 복제자 (MF replicator mode) — Effectiveness 설정 (cast 시 추가 발동).
  applyReplicatorTrait(playerActiveTraits, playerUnits);
  applyReplicatorTrait(enemyActiveTraits, enemies);
  // 여행자 (FlexTrait) — 탱커 보호막 + 비탱커 damage amp + 여행자 ×2.
  applyFlexTraitBuffs(playerActiveTraits, playerUnits);
  applyFlexTraitBuffs(enemyActiveTraits, enemies);
  // 우주 그루브 (SpaceGroove) 일반 tier — 그루비안 매초 ADAP +N% (StartOfCombatDuration 동안).
  applySpaceGrooveBuffs(playerActiveTraits, playerUnits);
  applySpaceGrooveBuffs(enemyActiveTraits, enemies);
  // Astronaut/Brawler HP 가산은 Stargazer (Huntress) maxHp 상위 N명 mark 선택 전에
  // 적용해야 정확한 maxHp 기준으로 mark — codex P2 회귀 가드.
  applyAstronautEffects(playerActiveTraits, playerUnits);
  applyAstronautEffects(enemyActiveTraits, enemies);
  // 싸움꾼 +HP — multiplicative. Astronaut flat (+BonusHealth) 적용 후 multiply.
  // 정령족+싸움꾼 동시 보유 챔프 없어 corner case 영향 없음.
  applyBrawlerEffects(playerActiveTraits, playerUnits);
  applyBrawlerEffects(enemyActiveTraits, enemies);
  applyStargazerEffects(playerActiveTraits, playerUnits, enemies, options.playerStargazerConstellation, true);
  applyStargazerEffects(enemyActiveTraits, enemies, playerUnits, options.enemyStargazerConstellation, false);
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
  // PR7-C (17.2b): N.O.V.A. 타격 선택기 — DRX 5+ 시너지 활성 시 사용자 지정 NOVA 유닛 1개에
  // aatroxNovaStrikeSelector flag = true. 본 PR 은 carry Aatrox 한정 처리 (N.O.V.A. 추가 발동
  // = 모든 적 novaDamage + 1초 공중 띄움). 다른 NOVA 유닛 (Caitlyn/Akali/Maokai/Kindred)
  // 효과 추가는 후속 PR.
  if (options.playerNovaStrikeSelectorUnit) {
    const t = playerUnits.find(u => u.champion.apiName === options.playerNovaStrikeSelectorUnit);
    if (t) t.aatroxNovaStrikeSelector = true;
  }
  if (options.enemyNovaStrikeSelectorUnit) {
    const t = enemies.find(u => u.champion.apiName === options.enemyNovaStrikeSelectorUnit);
    if (t) t.aatroxNovaStrikeSelector = true;
  }

  // PR7-C.8 (17.2b): N.O.V.A. 타격 선택기 자동 할당.
  // 사용자 spec: "전투 시뮬레이션에서 타격 선택기를 설정하지 않았다면 (5) N.O.V.A 유닛 중
  // 가장 강한 유닛에게 타격 선택기를 적용".
  // 조건: DRX trait minUnits >= 5 활성 (item 데이터 raw apiName='TFT17_DRXSelector').
  // 가장 강한 = starLevel × cost (사용자 결정 — findStrongestUnitByApi 패턴 일관).
  // explicit selector 옵션 우선, 미설정 시 fallback.
  const NOVA_APIS = ['TFT17_Aatrox', 'TFT17_Caitlyn', 'TFT17_Akali', 'TFT17_Maokai', 'TFT17_Kindred'];
  const autoAssignNovaSelector = (
    activeTraits: ActiveTrait[],
    teamUnits: CombatUnit[],
    explicitSelector: string | undefined,
  ) => {
    if (explicitSelector) return; // 명시적 옵션 우선
    const drxTrait = activeTraits.find(t => t.trait.apiName === 'TFT17_DRX' && t.activeEffect);
    // (5) 활성 검사: minUnits >= 5
    if (!drxTrait?.activeEffect) return;
    const minUnits = (drxTrait.activeEffect.minUnits ?? 0) as number;
    if (minUnits < 5) return;
    // NOVA 유닛 중 가장 강한 (starLevel × cost) 선정
    const novaUnits = teamUnits.filter(u =>
      u.state !== 'dead' && NOVA_APIS.includes(u.champion.apiName)
    );
    if (novaUnits.length === 0) return;
    novaUnits.sort((a, b) => {
      const scoreA = a.starLevel * (a.champion.cost ?? 0);
      const scoreB = b.starLevel * (b.champion.cost ?? 0);
      return scoreB - scoreA; // 내림차순
    });
    novaUnits[0].aatroxNovaStrikeSelector = true;
  };
  autoAssignNovaSelector(playerActiveTraits, playerUnits, options.playerNovaStrikeSelectorUnit);
  autoAssignNovaSelector(enemyActiveTraits, enemies, options.enemyNovaStrikeSelectorUnit);
  // 전사 AS 패시브 — carry 변환 후 적용 (codex P2 PR #68).
  // role='Fighter' 로 변환된 carry (Jax/Pyke/Poppy/Aatrox/Gragas/Leona/Mordekaiser)
  // 도 stage-based AS bonus 수령. 일반 'Fighter' role 챔프와 동일 처리.
  if (fighterASBonus > 0) {
    for (const u of playerUnits) {
      if (u.role === 'Fighter') u.stats.attackSpeed *= (1 + fighterASBonus);
    }
    for (const u of enemies) {
      if (u.role === 'Fighter') u.stats.attackSpeed *= (1 + fighterASBonus);
    }
  }
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
  // PR7-C.6 (17.2b): Caitlyn N.O.V.A. selector 헤드샷 1회 추적용. mark 적이 처음 50% HP 이하
  // 떨어진 시점만 trigger 발동 — 이후 HP 회복/재손실 시 재발동 안 함.
  const playerCaitlynHeadshotTriggered = new Set<string>();
  const enemyCaitlynHeadshotTriggered = new Set<string>();

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

    // === PR7-C.5 (17.2b): N.O.V.A. 타격 선택기 받은 NOVA 유닛 추가 효과 ===
    // 사용자 spec: DRX (5) + 타격 선택기 → NOVA 유닛 1명에 6초 surge 시 추가 효과.
    // Aatrox 는 cast loop 끝 별도 발동 (PR7-C). Maokai/Kindred 는 surge 시점 1회 발동.

    // Maokai selector — 적군 광역 stun (starLevel 1/2/3 = 1.5/1.5/1.75초). 회복은 hasMaokai 기존.
    const maokaiSelector = state.teamUnits.find(u =>
      u.champion.apiName === 'TFT17_Maokai'
      && u.aatroxNovaStrikeSelector
      && u.state !== 'dead'
    );
    if (maokaiSelector) {
      const maokaiStunArr = [1.5, 1.5, 1.75]; // starLevel 1/2/3
      const maokaiStunDur = maokaiStunArr[maokaiSelector.starLevel - 1] ?? maokaiStunArr[0];
      const maokaiStunTicks = Math.round(maokaiStunDur * TICKS_PER_SECOND);
      for (const e of state.opposingTeam) {
        if (e.state === 'dead') continue;
        e.statusEffects.push({
          type: 'stun', sourceId: 'maokai-nova-selector',
          remainingTicks: maokaiStunTicks,
        });
        e.state = 'idle';
        e.attackCooldown = 0;
      }
      logs.push({
        tick, time, type: 'ability', sourceId: 'maokai-nova-selector',
        message: `Maokai N.O.V.A. 선택기! 모든 적 ${maokaiStunDur}초 광역 기절`,
      });
    }

    // === PR7-C.6 (17.2b): Caitlyn N.O.V.A. 타격 선택기 추가 효과 ===
    // 사용자 spec: surge 시 모든 적 mark + mark 적 받는 피해 +10%. mark 적 HP 처음 50% 이하 시
    // 헤드샷 (76/114/222 물리, starLevel별, 1회). mark amp 적용은 applyAbilityMitigation 안
    // (caitlyn-nova-selector mark.value=0.10 검사). 헤드샷 trigger 는 main loop tick 별도.
    const caitlynSelector = state.teamUnits.find(u =>
      u.champion.apiName === 'TFT17_Caitlyn'
      && u.aatroxNovaStrikeSelector
      && u.state !== 'dead'
    );
    if (caitlynSelector) {
      for (const e of state.opposingTeam) {
        if (e.state === 'dead') continue;
        e.statusEffects.push({
          type: 'mark', sourceId: 'caitlyn-nova-selector',
          remainingTicks: 9999, value: 0.10, // incoming damage +10% (사용자 spec)
        });
      }
      logs.push({
        tick, time, type: 'ability', sourceId: 'caitlyn-nova-selector',
        message: `Caitlyn N.O.V.A. 선택기! 모든 적 표식 (받는 피해 +10%)`,
      });
    }

    // === PR7-C.6 (17.2b): Akali N.O.V.A. 타격 선택기 추가 효과 ===
    // 사용자 spec: surge 시 모든 적 출혈 (매초 10/14/18 starLevel별 물리). 영구 적용 (전투 끝까지).
    // burn statusEffect 사용 — value 는 매 tick damage. 매초 damage / TICKS_PER_SECOND.
    const akaliSelector = state.teamUnits.find(u =>
      u.champion.apiName === 'TFT17_Akali'
      && u.aatroxNovaStrikeSelector
      && u.state !== 'dead'
    );
    if (akaliSelector) {
      const akaliBleedPerSec = [10, 14, 18];
      const akaliBleedSec = akaliBleedPerSec[akaliSelector.starLevel - 1] ?? akaliBleedPerSec[0];
      const akaliBleedRawPerTick = akaliBleedSec / TICKS_PER_SECOND;
      for (const e of state.opposingTeam) {
        if (e.state === 'dead') continue;
        // codex P1 (PR #81): burn statusEffect 는 tickStatusEffects 에서 raw HP 차감 (mitigation 없음).
        // 사용자 spec "물리 피해" → armor + pen 미리 적용 후 mitigated value 저장.
        // DR 도 적용 (DOT snapshot 패턴 — 적용 시점 mitigation, armor 변동 시 추적 안 함).
        // shield/invulnerable 은 매 tick 검사 어려워 단순화 (DOT 일반 패턴).
        const mitigatedPerTick = applyResistance(akaliBleedRawPerTick, e.stats.armor, akaliSelector.stats.armorPen);
        const finalPerTick = e.damageReduction > 0
          ? mitigatedPerTick * (1 - e.damageReduction)
          : mitigatedPerTick;
        e.statusEffects.push({
          type: 'burn', sourceId: 'akali-nova-selector',
          remainingTicks: 9999, value: finalPerTick,
        });
      }
      logs.push({
        tick, time, type: 'ability', sourceId: 'akali-nova-selector',
        message: `Akali N.O.V.A. 선택기! 모든 적 출혈 (매초 ${akaliBleedSec} 물리, mitigation 적용)`,
      });
    }

    // Kindred selector — Kindred damageAmp +5% (영구) + 모든 적 표식. 5초 주기 mark 갱신은
    // main loop tick 별도 처리 (kindredNovaMarkState). Tank shield 는 hasKindred 기존.
    const kindredSelector = state.teamUnits.find(u =>
      u.champion.apiName === 'TFT17_Kindred'
      && u.aatroxNovaStrikeSelector
      && u.state !== 'dead'
    );
    if (kindredSelector) {
      kindredSelector.damageAmp += 0.05;
      for (const e of state.opposingTeam) {
        if (e.state === 'dead') continue;
        e.statusEffects.push({
          type: 'mark', sourceId: 'kindred-nova-selector',
          remainingTicks: 9999,
        });
      }
      logs.push({
        tick, time, type: 'ability', sourceId: 'kindred-nova-selector',
        message: `Kindred N.O.V.A. 선택기! +5% damage amp + 모든 적 표식`,
      });
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
    // PR7-C (17.2b): Aatrox carry — dead unit 의 aatroxPreviouslyDead = true 표시 (resurrect
    // 메커니즘 연동). 부활 시 다음 cast 진입 시 cycle counter 0 reset (cast site 처리).
    for (const u of allUnits) {
      if (u.state === 'dead') {
        if (u.aatroxCycleCounter > 0 || !u.aatroxPreviouslyDead) {
          u.aatroxPreviouslyDead = true;
        }
        continue;
      }
      tickBastionDouble(u, tick);
      // 도전자 Burst 만료 — dash 시점에 set 된 endTick 도달 시 0 reset.
      if (u.challengerBurstEndTick > 0 && tick >= u.challengerBurstEndTick) {
        u.challengerBurstEndTick = 0;
      }
    }
    // N.O.V.A. (DRX) power surge — TeamAttackDelay 도달 시 한 번만 발동.
    tickDrxNova(playerDrxState, tick, time);
    tickDrxNova(enemyDrxState, tick, time);

    // PR7-C.5 (17.2b): Kindred N.O.V.A. 선택기 — surge 후 5초 주기로 모든 적 표식 갱신.
    // 사용자 spec: surge (6초) → 5초 주기 (11초, 16초, ...) 로 모든 적 표식 부여.
    // 표식은 statusEffect 'mark' (영구). 5초 주기 = 5 × TICKS_PER_SECOND.
    const tickKindredNovaMark = (
      drxState: ReturnType<typeof setupDrxNova>,
      teamUnits: CombatUnit[],
      opposingTeam: CombatUnit[],
    ) => {
      if (!drxState || !drxState.triggered) return;
      const elapsedSinceSurge = tick - drxState.delayTicks;
      if (elapsedSinceSurge <= 0) return;
      const periodTicks = 5 * TICKS_PER_SECOND;
      // 5초 주기 도달 시점 (surge 직후 첫 발동은 tickDrxNova 에서 처리. 본 helper 는 후속 갱신).
      if (elapsedSinceSurge % periodTicks !== 0) return;
      const kindredSelector = teamUnits.find(u =>
        u.champion.apiName === 'TFT17_Kindred'
        && u.aatroxNovaStrikeSelector
        && u.state !== 'dead'
      );
      if (!kindredSelector) return;
      for (const e of opposingTeam) {
        if (e.state === 'dead') continue;
        // 기존 mark 있으면 갱신 (제거 후 재추가) — duration refresh 패턴
        e.statusEffects = e.statusEffects.filter(
          se => !(se.type === 'mark' && se.sourceId === 'kindred-nova-selector')
        );
        e.statusEffects.push({
          type: 'mark', sourceId: 'kindred-nova-selector',
          remainingTicks: 9999,
        });
      }
    };
    tickKindredNovaMark(playerDrxState, playerUnits, enemies);
    tickKindredNovaMark(enemyDrxState, enemies, playerUnits);

    // PR7-C.6 (17.2b): Caitlyn N.O.V.A. 선택기 헤드샷 trigger.
    // mark 적 (caitlyn-nova-selector source) 이 처음으로 HP 50% 이하 떨어질 때 1회 헤드샷.
    // 사용자 spec: 헤드샷 damage = [76, 114, 222] (starLevel 1/2/3 물리). caster = Caitlyn selector.
    // per-target Set (caitlynHeadshotTriggered) 으로 1회 보장. main loop tick 매번 검사.
    const tickCaitlynHeadshot = (
      teamUnits: CombatUnit[],
      opposingTeam: CombatUnit[],
      triggeredSet: Set<string>,
    ) => {
      const caitlynShooter = teamUnits.find(u =>
        u.champion.apiName === 'TFT17_Caitlyn'
        && u.aatroxNovaStrikeSelector
        && u.state !== 'dead'
      );
      if (!caitlynShooter) return;
      const headshotArr = [76, 114, 222];
      const headshotBase = headshotArr[caitlynShooter.starLevel - 1] ?? headshotArr[0];
      for (const e of opposingTeam) {
        if (e.state === 'dead') continue;
        if (triggeredSet.has(e.id)) continue;
        const hasMark = e.statusEffects.some(
          se => se.type === 'mark' && se.sourceId === 'caitlyn-nova-selector'
        );
        if (!hasMark) continue;
        if (e.currentHp / e.maxHp > 0.50) continue;
        // 처음으로 50% 이하 — 헤드샷 1회 발동
        triggeredSet.add(e.id);
        const ownArbHs = caitlynShooter.team === 'player' ? playerArbiterState : enemyArbiterState;
        // mitigation 통합 helper 사용 (in-range cast 와 일관)
        const headshotDmg = applyAbilityMitigation(caitlynShooter, e, headshotBase, 'physical', eventBus, tick);
        e.currentHp -= headshotDmg;
        e.totalDamageTaken += headshotDmg;
        caitlynShooter.totalDamageDealt += headshotDmg;
        triggerSerpentPoison(caitlynShooter, e, headshotDmg);
        const headshotLog: CombatLog = {
          tick, time, type: 'ability',
          sourceId: caitlynShooter.id, targetId: e.id,
          value: Math.round(headshotDmg),
          message: `Caitlyn N.O.V.A. 헤드샷! ${e.champion.name}에게 ${Math.round(headshotDmg)} 물리 피해`,
        };
        logs.push(headshotLog);
        tickLogs.push(headshotLog);
        if (e.currentHp <= 0) {
          markTargetDead(caitlynShooter, e, ownArbHs, eventBus, tick);
        }
      }
    };
    tickCaitlynHeadshot(playerUnits, enemies, playerCaitlynHeadshotTriggered);
    tickCaitlynHeadshot(enemies, playerUnits, enemyCaitlynHeadshotTriggered);

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

    // 우주 그루브 (SpaceGroove) 일반 tier — 매초 그루비안 ADAP +N% 가산.
    // applySpaceGrooveBuffs() 가 그루비안 unit 에 spaceGrooveAdapPerSec / spaceGrooveDurationSec set.
    // StartOfCombatDuration 초 동안만, 그 이후 효과 종료.
    if (tick > 0 && tick % TICKS_PER_SECOND === 0) {
      const combatSecond = tick / TICKS_PER_SECOND;
      for (const u of allUnits) {
        if (u.state === 'dead') continue;
        if (u.spaceGrooveAdapPerSec <= 0 || u.spaceGrooveDurationSec <= 0) continue;
        if (combatSecond > u.spaceGrooveDurationSec) continue;
        const pct = u.spaceGrooveAdapPerSec / 100;
        u.stats.damage = u.stats.damage * (1 + pct);
        u.stats.ap = u.stats.ap + u.spaceGrooveAdapPerSec;
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
    // HP 100% 도달 시 종료 + Bolt 발사 속도 4배 활성 (PR #65).
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
        // 파티광 후속 효과 (PR #65): 회복 완료 시 Bolt 발사 속도 ×4 활성 (전투 종료까지 지속).
        if (u.blitzBoltCooldownSec > 0) u.blitzBoltSpeedMult = 4;
      }
    }

    // Blitzcrank Bolt passive — 매 (BoltCooldown / boltSpeedMult) 초마다 가장 체력 높은 적에 magic damage.
    // raw: BoltCooldown 1성2 / 2성2 / 3성0.5, BoltDamage 1성60 / 2성90 / 3성150 (AP scaling).
    for (const u of allUnits) {
      if (u.state === 'dead') continue;
      if (u.blitzBoltCooldownSec <= 0 || u.blitzBoltDamage <= 0) continue;
      const effectiveCooldownTicks = Math.max(1, Math.round(u.blitzBoltCooldownSec / u.blitzBoltSpeedMult * TICKS_PER_SECOND));
      if (tick - u.blitzBoltLastFireTick < effectiveCooldownTicks) continue;
      // 가장 체력 높은 적군 찾기.
      const enemyTeam = u.team === 'player' ? aliveEnemies : alivePlayers;
      if (enemyTeam.length === 0) continue;
      let bestEnemy: CombatUnit | null = null;
      let bestHp = -1;
      for (const e of enemyTeam) {
        if (e.currentHp > bestHp) { bestHp = e.currentHp; bestEnemy = e; }
      }
      if (!bestEnemy) continue;
      // magic damage = boltDamage × (1 + ap/100). mitigation pipeline 적용.
      const rawDmg = u.blitzBoltDamage * (1 + u.stats.ap / 100);
      let final = applyResistance(rawDmg, bestEnemy.stats.magicResist, u.stats.magicPen);
      if (bestEnemy.damageReduction > 0) final *= (1 - bestEnemy.damageReduction);
      final = applyShield(bestEnemy, final, eventBus, tick);
      if (bestEnemy.statusEffects.some(e => e.type === 'invulnerable')) final = 0;
      bestEnemy.currentHp -= final;
      bestEnemy.totalDamageTaken += final;
      u.totalDamageDealt += final;
      u.blitzBoltLastFireTick = tick;
      if (bestEnemy.currentHp <= 0 && bestEnemy.state !== 'dead') {
        bestEnemy.currentHp = 0;
        bestEnemy.state = 'dead';
        u.killCount++;
        if (u.team === 'player') playerArbiterState.enemyDeathCount++;
        else enemyArbiterState.enemyDeathCount++;
        eventBus.emit('on_kill', { sourceId: u.id, targetId: bestEnemy.id, tick });
        eventBus.emit('on_death', { sourceId: bestEnemy.id, targetId: u.id, tick });
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

      // Mordekaiser proc 매 tick — 펄스 발동 / 만료 시 HealRefund / 사망 시 cancel.
      // 가드: 0 (비활성) 일 때 호출 skip → 다른 챔프 perf 손실 없음.
      if (unit.mordekaiserProcEndTick !== 0) {
        const enemyTeam = unit.team === 'player' ? enemies : playerUnits;
        const ownArbiterStateMorde = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
        tickMordekaiserProc(unit, tick, time, enemyTeam, eventBus, ownArbiterStateMorde, logs, tickLogs);
      }

      // Illaoi AfterShock 매 tick — 만료 시 2칸 magic AOE / 사망 시 cancel.
      if (unit.illaoiAfterShockEndTick !== 0) {
        const enemyTeam = unit.team === 'player' ? enemies : playerUnits;
        const ownArbiterStateIllaoi = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
        tickIllaoiAfterShock(unit, tick, time, enemyTeam, eventBus, ownArbiterStateIllaoi, logs, tickLogs);
      }

      gainManaPerTick(unit, TICK_DURATION);

      // Augment mana regen (per second, applied per tick)
      // codex P1 (PR #64): 전달자 InnateManaGain — augmentManaRegen 도 +N% 곱셈 적용.
      // 본 augmentManaRegen 에 trait ManaTrait 의 channelerManaRegen / teamManaRegen 도 가산되어 있음.
      if (unit.augmentManaRegen > 0) {
        const channelerMult = 1 + (unit.channelerInnateManaGain ?? 0);
        unit.currentMana = Math.min(unit.maxMana, unit.currentMana + unit.augmentManaRegen * TICK_DURATION * channelerMult);
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
          // 도전자 Burst — dash 시 AS +BurstPercent% × BurstDuration 초 활성.
          // raw BurstDuration=2.5. main loop 만료 체크에서 endTick 도달 시 0 reset.
          if (unit.challengerBurstPercent > 0) {
            unit.challengerBurstEndTick = tick + Math.round(2.5 * TICKS_PER_SECOND);
          }
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
          // PR101: 매드레드의 검 — 탱커 상대 +15% damageAmp
          if (unit.madredsTankDamageAmp > 0 && target.role === 'Tank') {
            totalDamageAmp += unit.madredsTankDamageAmp;
          }
          // 저격수 (Sniper) — 거리 기반 추가 damage amp
          totalDamageAmp += computeSniperDamageAmp(unit, target);
          // 최신상 AimAssistant — distance 1 hex 당 +N% damage amp.
          if (unit.gravesAimAssistBonusPerHex > 0) {
            const dist = hexDistance(unit.position, target.position);
            totalDamageAmp += dist * unit.gravesAimAssistBonusPerHex;
          }
          // 습격자 (6) ShieldAD — 보호막 활성 시 AD stat bonus (codex P2 PR #64).
          // raw 의미는 AD stat 보너스 — damage amp 가 아님. stat-side 곱셈 (multiplicative with damage amp).
          let effectiveAd = unit.stats.damage;
          if (unit.meleeShieldADBonus > 0 && unit.shield > 0) {
            effectiveAd *= (1 + unit.meleeShieldADBonus);
          }
          const rawDamage = effectiveAd * critMult * (1 + totalDamageAmp);
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

          // codex P1 (PR #81): Caitlyn N.O.V.A. selector mark — basic attack 도 +10% incoming amp.
          // applyAbilityMitigation 안에만 적용하면 ability 만 amp → basic attack 누락.
          // 사용자 spec "표식이 남은 대상이 받는 피해를 10% 증가" 모든 damage path 일관.
          for (const mark of target.statusEffects) {
            if (mark.type === 'mark' && mark.sourceId === 'caitlyn-nova-selector' && mark.value) {
              finalDamage *= (1 + mark.value);
            }
          }

          target.currentHp -= finalDamage;
          target.totalDamageTaken += finalDamage;
          unit.totalDamageDealt += finalDamage;

          // PR7-E (17.2b): carry augment onAttackBonus 패시브 — 매 기본 공격마다 추가 magic.
          // 사용자 결정: onAttackBonus[star] AP 고정 magic damage 추가 (stack 무관).
          //   꼬마정령 carry [40,60,90] AP / 잭스 carry [45,70,105] AP.
          // 정령족 trait 활성 의존 없음 — 단순 carry augment 활성 시 onAttack 추가.
          // mitigation: magic resist + magicPen + DR + non-target reduction + shield + invulnerable.
          {
            const augNamesAtk = unit.team === 'player' ? playerAugApiNames : enemyAugApiNames;
            const carryAtk = findCarryAugment(unit.champion.apiName, augNamesAtk);
            const onAttackArr = carryAtk?.abilityData?.onAttackBonus;
            // codex P1 (PR #74): basic attack damage 가 이미 target.currentHp 차감 적용됐으나
            // target.state 는 아직 'dead' 로 변경 안 된 상태 (사망 처리는 별도 위치).
            // currentHp <= 0 인 dead-but-not-yet-marked target 에 추가 damage 가해지면
            // totalDamageDealt/Taken inflate + 대체 death path 강제. currentHp > 0 가드 추가.
            if (onAttackArr && target.state !== 'dead' && target.currentHp > 0) {
              const onAttackBase = onAttackArr[unit.starLevel - 1] ?? onAttackArr[0];
              if (onAttackBase > 0) {
                // AP scaling — magic damage (꼬마정령/잭스 모두 magic)
                const onAttackRaw = onAttackBase * (1 + unit.stats.ap / 100);
                // refactor: 통합 mitigation helper 사용 (resistance + DR + non-target + shield + invulnerable)
                const onAttackDmg = applyAbilityMitigation(unit, target, onAttackRaw, 'magic', eventBus, tick);

                target.currentHp -= onAttackDmg;
                target.totalDamageTaken += onAttackDmg;
                unit.totalDamageDealt += onAttackDmg;

                if (onAttackDmg > 0) {
                  const onAttackLog: CombatLog = {
                    tick, time, type: 'attack',
                    sourceId: unit.id, targetId: target.id,
                    value: Math.round(onAttackDmg),
                    message: `${unit.champion.name} carry 패시브! ${target.champion.name}에게 추가 ${Math.round(onAttackDmg)} 마법 피해`,
                  };
                  logs.push(onAttackLog);
                  tickLogs.push(onAttackLog);
                }

                if (target.currentHp <= 0) {
                  // refactor: 통합 markTargetDead helper 사용
                  const ownArbiterStateAtk = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                  markTargetDead(unit, target, ownArbiterStateAtk, eventBus, tick);
                }
              }
            }
          }

          // 쉔 (TFT17_Shen) passive — cast 당 1 stack + 평타마다 stack × bonus 추가 (3+ true).
          // desc: "스킬 사용 시 기본 공격에 BonusDamage(scaleHealth+scaleAP) 의 중첩되는 추가 마법 피해.
          //        세 번째 스킬 사용부터 대신 고정 피해."
          // 17.3 LIVE: BonusDamageOnAttack ★1=20 / ★2=30 (이전 45/75 너프). DamageHP=0.01 유지.
          // 메커니즘 (사용자 결정): cast 당 1 stack 누적, 평타 시 stack × (BonusDamage + DamageHP×maxHp) × (1+AP/100).
          if (unit.champion.apiName === 'TFT17_Shen' && unit.shenPassiveStack > 0
              && target.state !== 'dead' && target.currentHp > 0) {
            const bonusVar = unit.champion.ability.variables?.find(v => v.name === 'BonusDamageOnAttack');
            const damageHpVar = unit.champion.ability.variables?.find(v => v.name === 'DamageHP');
            if (bonusVar) {
              const bonusBase = readVarByStar(bonusVar.value, unit.starLevel);
              const damageHpRatio = damageHpVar ? readVarByStar(damageHpVar.value, unit.starLevel) : 0;
              const bonusPerStack = (bonusBase + damageHpRatio * unit.maxHp) * (1 + unit.stats.ap / 100);
              const totalBonus = bonusPerStack * unit.shenPassiveStack;
              if (totalBonus > 0) {
                const isTrueDmg = unit.shenPassiveStack >= 3;
                // codex P1 (PR #108): true damage 도 표준 mitigation pipeline 통과 — shield 흡수 + DR + non-target +
                // invul 일관 적용. applyAbilityMitigation 의 dmgType='true' 분기는 resist/pen 만 0 자동 처리.
                const shenDmgType: DamageType = isTrueDmg ? 'true' : 'magic';
                const shenDmg = applyAbilityMitigation(unit, target, totalBonus, shenDmgType, eventBus, tick);
                if (shenDmg > 0) {
                  target.currentHp -= shenDmg;
                  target.totalDamageTaken += shenDmg;
                  unit.totalDamageDealt += shenDmg;
                  const shenLog: CombatLog = {
                    tick, time, type: 'attack',
                    sourceId: unit.id, targetId: target.id,
                    value: Math.round(shenDmg),
                    message: `${unit.champion.name} 패시브 ${unit.shenPassiveStack}중첩! ${target.champion.name}에게 추가 ${Math.round(shenDmg)} ${isTrueDmg ? '고정' : '마법'} 피해`,
                  };
                  logs.push(shenLog);
                  tickLogs.push(shenLog);
                  if (target.currentHp <= 0) {
                    const ownArbiterStateShen = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                    markTargetDead(unit, target, ownArbiterStateShen, eventBus, tick);
                  }
                }
              }
            }
          }

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
            // 습격자 흡혈→보호막 (PR #64): overflow 를 보호막으로 변환.
            applyOmnivampHealWithMeleeShield(unit, heal);
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
              applyOmnivampHealWithMeleeShield(unit, heal);
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

          // === 벡스: 평타마다 그림자 추가 magic 피해 (PR101 — Vex 패시브) ===
          // raw 메커닉: "기본 공격을 가할 때마다 그림자가 주변 적을 타격해 ShadowHandDamage 마법 피해"
          //   ★1=30, ★2=45, ★3=250 (sentinel filler 컨벤션 — readVarByStar 자동).
          //   AP scale (scaleAP). NumStrikesForPassive=5 — 적 5회 누적 시 그림자 재타격
          //   (별도 메커닉, 본 PR 범위 외).
          //
          // codex P2 (PR #101): target-conditional amp 통합 — Madreds (Tank), Invention,
          // Graves Tankbuster, Sniper 거리 amp 모두 평타와 동일하게 적용.
          // codex P1 (PR #101 후속, 사용자 결정): "주변 적" spread 해석 (옵션 c) —
          //   평타 target 우선 + alive 한 다른 적 있으면 Vex 본인 기준 가장 가까운 적 추가 hit.
          //   raw "주변 적" 명시적 반경 변수 없어 가장 가까운 1명에 spread 한정 (보수).
          if (unit.champion.apiName === 'TFT17_Vex') {
            const shadowVar = unit.champion.ability.variables?.find(v => v.name === 'ShadowHandDamage');
            const shadowBase = readVarByStar(shadowVar?.value, unit.starLevel, 30);
            const apFactor = 1 + unit.stats.ap / 100;
            const ownArbiterStateVex = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
            // helper: shadow hit 1 victim — target-conditional amp + mitigation + lethal mark.
            const applyShadow = (victim: CombatUnit) => {
              if (victim.state === 'dead') return;
              let amp = unit.damageAmp;
              if (unit.inventionTankDamageAmp > 0 && victim.role === 'Tank') amp += unit.inventionTankDamageAmp;
              if (unit.madredsTankDamageAmp > 0 && victim.role === 'Tank') amp += unit.madredsTankDamageAmp;
              if (unit.gravesTankDamageAmp > 0 && victim.role === 'Tank') amp += unit.gravesTankDamageAmp;
              amp += computeSniperDamageAmp(unit, victim);
              const raw = shadowBase * apFactor * (1 + amp);
              const dealt = applyAbilityMitigation(unit, victim, raw, 'magic', eventBus, tick);
              victim.currentHp -= dealt;
              victim.totalDamageTaken += dealt;
              unit.totalDamageDealt += dealt;
              if (victim.currentHp <= 0) {
                logs.push({ tick, time, type: 'death', sourceId: victim.id, message: `${victim.champion.name} 사망! (${unit.champion.name}의 그림자)` });
                markTargetDead(unit, victim, ownArbiterStateVex, eventBus, tick);
              }
            };
            applyShadow(target);
            // 추가 spread: alive 한 다른 적 중 Vex 본인 기준 가장 가까운 1명.
            const enemyTeamForShadow = unit.team === 'player' ? enemies : playerUnits;
            let nearestOther: CombatUnit | null = null;
            let nearestDist = Infinity;
            for (const e of enemyTeamForShadow) {
              if (e.state === 'dead' || e.id === target.id) continue;
              const d = hexDistance(unit.position, e.position);
              if (d < nearestDist) { nearestDist = d; nearestOther = e; }
            }
            if (nearestOther) applyShadow(nearestOther);
          }

          // === 케이틀린: 15% 확률 헤드샷 추가 물리 피해 ===
          if (unit.champion.apiName === 'TFT17_Caitlyn' && target.state !== 'dead') {
            // PR99: readVarByStar 로 데이터 컨벤션 자동 감지 (Caitlyn 은 no-filler).
            const procChance = readVarByStar(
              unit.champion.ability.variables?.find(v => v.name === 'ProcChance')?.value, unit.starLevel, 15
            ) / 100;
            if (rng.next() < procChance) {
              const hsVar = unit.champion.ability.variables?.find(v => v.name === 'Damage');
              const hsDmg = readVarByStar(hsVar?.value, unit.starLevel, 170);
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
              // PR99: Kindred SpellDamage [0, 75, 115] = filler — readVarByStar 자동.
              const markDmg = readVarByStar(markDmgVar?.value, unit.starLevel, 60);
              const markFinal = applyResistance(markDmg * (1 + unit.damageAmp), target.stats.armor, unit.stats.armorPen);
              target.currentHp -= markFinal;
              target.totalDamageTaken += markFinal;
              unit.totalDamageDealt += markFinal;
            }
          }

          // === 코르키: 평타 시 MissilesPerLaunchAttack 개의 추가 미사일 발사 (PR100) ===
          // raw 메커닉 (TFT17_Corki "소행성 발사기"):
          //   MissilesPerLaunchAttack=5 — 평타당 5 미사일.
          //   각 미사일: MissileAD physical + MissileAP magic.
          //   ProcChance=20% — 미사일별 별개 proc 체크. proc 시 ProcDamageMult=3.5× crit.
          // sim 단순화 (사용자 spec):
          //   - 본체 평타 AD 그대로 + 추가 5 missile 가산 (Caitlyn 패시브 패턴 따름).
          //   - 미사일별 mitigation 분리 (physical: armor, magic: magicResist).
          //   - damageAmp / sniper / 별돌보미 등 carry-modifier 는 본 패스에 미적용 (per-target loop 외).
          //
          // codex P1 (PR #100): applyAbilityMitigation 통합 — shield/invulnerable/DR/non-target
          // mitigation pipeline 전체 적용 (단순 applyResistance 회피). 사망 시 markTargetDead.
          if (unit.champion.apiName === 'TFT17_Corki' && target.state !== 'dead') {
            const vars = unit.champion.ability.variables;
            const numMissiles = readVarByStar(vars?.find(v => v.name === 'MissilesPerLaunchAttack')?.value, unit.starLevel, 5);
            const procChance = readVarByStar(vars?.find(v => v.name === 'ProcChance')?.value, unit.starLevel, 20) / 100;
            const procMult = readVarByStar(vars?.find(v => v.name === 'ProcDamageMult')?.value, unit.starLevel, 3.5);
            const missileAd = readVarByStar(vars?.find(v => v.name === 'MissileAD')?.value, unit.starLevel, 25);
            const missileAp = readVarByStar(vars?.find(v => v.name === 'MissileAP')?.value, unit.starLevel, 6);
            const apFactor = 1 + unit.stats.ap / 100;
            let totalMissileDmg = 0;
            let missileLethal = false;
            for (let m = 0; m < numMissiles; m++) {
              if (missileLethal) break;
              const procFactor = rng.next() < procChance ? procMult : 1;
              // damageAmp 는 applyAbilityMitigation 의 일부가 아니므로 raw 단계에서 적용.
              const physRaw = missileAd * procFactor * (1 + unit.damageAmp);
              const magRaw = missileAp * apFactor * procFactor * (1 + unit.damageAmp);
              const physDmg = applyAbilityMitigation(unit, target, physRaw, 'physical', eventBus, tick);
              const magDmg = applyAbilityMitigation(unit, target, magRaw, 'magic', eventBus, tick);
              const missileDmg = physDmg + magDmg;
              target.currentHp -= missileDmg;
              totalMissileDmg += missileDmg;
              // 미사일 lethal 시 즉시 사망 처리 — 후속 미사일은 break.
              if (target.currentHp <= 0) {
                const ownArbiterStateMissile = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                logs.push({ tick, time, type: 'death', sourceId: target.id, message: `${target.champion.name} 사망! (${unit.champion.name}의 미사일)` });
                markTargetDead(unit, target, ownArbiterStateMissile, eventBus, tick);
                missileLethal = true;
              }
            }
            target.totalDamageTaken += totalMissileDmg;
            unit.totalDamageDealt += totalMissileDmg;
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
            // 쉔 (TFT17_Shen) passive — cast 당 1 stack 누적. 평타 hook 에서 사용.
            if (unit.champion.apiName === 'TFT17_Shen') {
              unit.shenPassiveStack++;
            }
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
            // PR7-C (17.2b): Aatrox carry cycle 분기로 config dynamic 변경 가능 → const → let.
            let config: AbilityConfig = getAbilityConfigForUnit(unit, augNames);

            // 스킬 시전 후 cast time — 이 시간 동안 공격 불가
            unit.attackCooldown = config.pattern === 'self_buff' ? SELF_BUFF_CAST_TICKS : CAST_TICKS;

            // PR5 (17.2b): carry augment 활성 시 abilityData.damage override 우선 사용.
            // raw getAbilityDamage (raw 챔프 ability 변수) vs carry-specific damage 분기.
            // 자폭 (그라가스) 은 selfDamage 분기에서 abilityData 직접 참조 — 본 분기는 영향 없음
            // (selfDamage healthCost 가 있어 rawAbilityDmg fallback 미사용).
            // codex P1 (PR #71): self_buff pattern (Jax/Zed carry) 은 caster 본인이 target 이라
            // augment damage override 시 self-hit 대량 damage (예: Jax 155+/cast). raw 챔프
            // 변수 (작은 값, 예: Jax Duration=4초) 는 damage 의미 약해 self-hit 영향 미미.
            // → self_buff pattern 은 carry damage override 적용 안 함.
            const carryCfg = findCarryAugment(unit.champion.apiName, augNames);

            // === PR7-C (17.2b): Aatrox carry — 3-skill cycle + N.O.V.A. 변환 ===
            // cast 마다 cycle counter % 3 으로 분기:
            //   0 = 타격 (single AD)
            //   1 = 휩쓸기 (cone radius 1, AD + armor 감소 10)
            //   2 = 찍기 (aoe_circle radius 1, AD + knockup + 단독 적중 ×2.5)
            // N.O.V.A. 타격 (carry Aatrox + aatroxNovaStrikeSelector=true): pattern → global
            // + 모든 적 knockup. cycle damage 그대로 적용 (사용자 spec).
            // 사망 시 cycle reset: aatroxPreviouslyDead 검사 (resurrect 메커니즘 연동, 미래 대비).
            let aatroxCycleDamage: number | null = null;
            let aatroxCycleDamageType: DamageType | null = null;
            let aatroxIsSingleTargetSlam = false; // 찍기 cycle 단독 적중 multiplier 검사용
            const isAatroxCarry = carryCfg?.augmentApiName === 'TFT17_Augment_AatroxCarry'
              && !!carryCfg.abilityData;
            if (isAatroxCarry) {
              if (unit.aatroxPreviouslyDead) {
                unit.aatroxCycleCounter = 0;
                unit.aatroxPreviouslyDead = false;
              }
              const ad = carryCfg!.abilityData!;
              const dt: DamageType = carryCfg!.damageTypeOverride ?? ad.damageType ?? 'physical';
              aatroxCycleDamageType = dt;
              const cycleIdx = unit.aatroxCycleCounter % 3;
              if (cycleIdx === 0) {
                // 타격 — single
                config = { ...config, pattern: 'single' };
                aatroxCycleDamage = ad.damage?.[unit.starLevel - 1] ?? ad.damage?.[0] ?? 0;
              } else if (cycleIdx === 1) {
                // 휩쓸기 — cone radius 1 + armor 감소 debuff
                config = {
                  ...config,
                  pattern: 'cone',
                  radius: 1,
                  debuff: { ...(config.debuff ?? {}), armorReduction: ad.armorReduction ?? 0 },
                };
                aatroxCycleDamage = ad.secondaryDamage?.[unit.starLevel - 1] ?? ad.secondaryDamage?.[0] ?? 0;
              } else {
                // 찍기 — aoe_circle radius 1 + knockup (stun)
                config = {
                  ...config,
                  pattern: 'aoe_circle',
                  radius: 1,
                  stun: ad.slamStunDuration ?? 1.0,
                };
                aatroxCycleDamage = ad.slamDamage?.[unit.starLevel - 1] ?? ad.slamDamage?.[0] ?? 0;
                aatroxIsSingleTargetSlam = true; // 단독 적중 검사 enable
              }
              // N.O.V.A. 타격은 cycle ability 와 **별개의 추가 효과** (사용자 정정 spec):
              //   "기존 스킬은 그대로 유지 + 6초 NOVA 각성 시 특수 효과 추가"
              //   Aatrox: 모든 적에게 novaDamage 물리 + 1초 공중 띄움 (별도 추가 발동).
              //   cycle (single 타격 / cone 휩쓸기 / aoe_circle radius 1 찍기) 은 변경 없음.
              //   별도 N.O.V.A. 추가 발동 로직은 cast loop 끝난 후 처리 (post-cast pipeline 직전).
            }

            const carryForDamage = config.pattern !== 'self_buff' ? carryCfg : null;
            // PR7-C: Aatrox cycle damage 직접 사용 (resolveAbilityDamage 우회) — cycle 별 다른 damage.
            let rawAbilityDmgBase: number;
            let dmgType: DamageType;
            if (isAatroxCarry && aatroxCycleDamage !== null && aatroxCycleDamageType !== null) {
              const cycleType = aatroxCycleDamageType;
              rawAbilityDmgBase = cycleType === 'magic'
                ? aatroxCycleDamage * (1 + unit.stats.ap / 100)
                : aatroxCycleDamage;
              dmgType = cycleType;
            } else {
              const result = resolveAbilityDamage(
                unit.champion, unit.starLevel, unit.stats.ap, carryForDamage, config.damageVar
              );
              rawAbilityDmgBase = result.damage;
              dmgType = result.type;
            }
            // codex P1 (PR #98): self_buff pattern 은 caster 가 findAbilityTargets 의 self-target.
            // resolveAbilityDamage 의 damageVar fallback (Poppy ★3 'Shield'=575 등) 으로 인해
            // cast loop 가 caster 본인을 self-hit → 방금 얻은 shield 즉시 소모 회귀.
            // raw ability damage 0 강제 — selfBuff/shield 효과는 별도 분기에서 처리.
            if (config.pattern === 'self_buff') rawAbilityDmgBase = 0;
            // PR7-E (17.2b): 뽀삐 carry spiritEffectPerStack — 미프 정령족 잠재력 stack 당
            // damage amp. 사용자 결정: damage × (1 + Meeps × 0.15) multiplicative.
            // 정령족 trait 활성 시 unit.astronautMeepsStack > 0 (applyAstronautEffects).
            // 다른 carry (꼬마정령 spiritEffectPerStack=0) 는 자연스럽게 무관.
            if (carryCfg?.abilityData?.spiritEffectPerStack && unit.astronautMeepsStack > 0) {
              rawAbilityDmgBase *= (1 + unit.astronautMeepsStack * carryCfg.abilityData.spiritEffectPerStack);
            }
            // SharpshooterModule (위력 프레임) — 스킬 피해 +5% 가산.
            const rawAbilityDmg = rawAbilityDmgBase * (1 + (unit.gravesAbilityDamageBonus ?? 0));

            // 자폭 (GragasCarry) — self 데미지 + 반경 N칸 적군 magic AOE.
            // 사용자 명세: 그라가스 본인 데미지 (자기 스킬로 죽지 않음, HP >= 1) + 적군에게 magic damage.
            // 17.2b 변경:
            //   - self-damage: maxHp × healthCost (0.30 → 0.20)
            //   - hexReduction: 0.55 → 0.45
            // PR4 (17.2b 후속): 적군 AOE damage 적용 — 기존엔 self-damage 만 처리하던 회귀.
            //   공식 (도메인 set17-hero-augments.md + 사용자 결정):
            //     baseAOE = maxHp × baseDamageHpFrac + AP × (abilityData.damage[star] / 100)
            //     distance multiplier = (1 - hexReduction) ^ distance  (multiplicative)
            //     tank multiplier = role === 'Tank' 일 때 (1 + tankBonusMultiplier), 그 외 1
            //   적군에 일반 ability mitigation 동일 적용 (resistance + DR + Fighter/Assassin
            //   non-target reduction + shield + invulnerable). damageAmp / sniper / crit 는
            //   raw 도메인 공식에 명시 없어 미적용 — 자폭 mechanics 원형 보존.
            if (config.selfDamage) {
              const hpFloor = config.selfDamageHpFloor ?? 0;
              // 영웅 증강 abilityData.healthCost 가 있으면 maxHp × healthCost, 없으면 raw ability damage.
              // carryCfg 는 PR5 분기에서 이미 lookup (위 line). 자폭은 그라가스 carry 한정 진입.
              const healthCost = carryCfg?.abilityData?.healthCost;
              const selfDamageRaw = healthCost !== undefined
                ? unit.maxHp * healthCost
                : rawAbilityDmg;
              const beforeHp = unit.currentHp;
              const dmgApplied = Math.max(0, Math.min(selfDamageRaw, beforeHp - hpFloor));
              unit.currentHp = Math.max(hpFloor, beforeHp - selfDamageRaw);
              unit.totalDamageTaken += dmgApplied;
              const selfLog: CombatLog = {
                tick, time, type: 'ability',
                sourceId: unit.id, targetId: unit.id,
                value: Math.round(dmgApplied),
                message: `${unit.champion.name}이(가) 자폭! 자기 자신에게 ${Math.round(dmgApplied)} 피해 (HP floor=${hpFloor}${healthCost !== undefined ? `, ${Math.round(healthCost * 100)}% maxHp` : ''})`,
              };
              logs.push(selfLog);
              tickLogs.push(selfLog);

              // === PR4 (17.2b) — 자폭 적군 AOE damage ===
              // codex P1 (PR #70): post-cast pipeline 통합 — totalAbilityDmg 누적 후 omnivamp heal +
              // Fountain heal + on_cast emit (value/rawValue 에 self + enemy 합산). on_cast 위치를
              // self emit 직후가 아닌 적군 AOE 처리 끝난 시점으로 이동 (cast 1회 = emit 1회 표준 일관).
              let totalSelfDestructDmg = 0;
              let totalSelfDestructRawDmg = 0;
              const ad = carryCfg?.abilityData;
              if (ad?.damage && ad.baseDamageHpFrac !== undefined && ad.hexReduction !== undefined) {
                const aoeRadius = config.radius ?? 3;
                const baseDamage = ad.damage[unit.starLevel - 1] ?? ad.damage[0];
                const baseAOE = unit.maxHp * ad.baseDamageHpFrac + unit.stats.ap * (baseDamage / 100);
                const tankBonus = ad.tankBonusMultiplier ?? 0;
                const aoeDmgType: DamageType = ad.damageType ?? 'magic';
                const opposingTeam = unit.team === 'player' ? enemies : playerUnits;
                const ownArbiterState = unit.team === 'player' ? playerArbiterState : enemyArbiterState;

                for (const t of opposingTeam) {
                  if (t.state === 'dead') continue;
                  const dist = hexDistance(unit.position, t.position);
                  if (dist > aoeRadius) continue;

                  // multiplicative falloff (사용자 결정 — raw 미정의로 추정)
                  const distMul = Math.pow(1 - ad.hexReduction, dist);
                  // 탱커 정의: role === 'Tank' 만 (사용자 결정 — 코드 전반 일관)
                  const tankMul = t.role === 'Tank' ? (1 + tankBonus) : 1.0;
                  const rawDmg = baseAOE * distMul * tankMul;
                  totalSelfDestructRawDmg += rawDmg;

                  // refactor: 통합 mitigation helper (resistance + DR + non-target + shield + invulnerable)
                  const effectiveDmg = applyAbilityMitigation(unit, t, rawDmg, aoeDmgType, eventBus, tick);

                  t.currentHp -= effectiveDmg;
                  t.totalDamageTaken += effectiveDmg;
                  unit.totalDamageDealt += effectiveDmg;
                  totalSelfDestructDmg += effectiveDmg;

                  const aoeLog: CombatLog = {
                    tick, time, type: 'ability',
                    sourceId: unit.id, targetId: t.id,
                    value: Math.round(effectiveDmg),
                    message: `${unit.champion.name}의 자폭 폭발! ${t.champion.name}에게 ${Math.round(effectiveDmg)} 마법 피해 (${dist}칸${t.role === 'Tank' ? ', 탱커 +' + Math.round(tankBonus * 100) + '%' : ''})`,
                  };
                  logs.push(aoeLog);
                  tickLogs.push(aoeLog);

                  if (t.currentHp <= 0) {
                    // refactor: 통합 markTargetDead helper + deathLog 별도 작성
                    const deathLog: CombatLog = {
                      tick, time, type: 'death',
                      sourceId: t.id,
                      message: `${t.champion.name} 사망! (${unit.champion.name}의 자폭)`,
                    };
                    logs.push(deathLog);
                    tickLogs.push(deathLog);
                    markTargetDead(unit, t, ownArbiterState, eventBus, tick);
                  }
                }
              }

              // === codex P1 (PR #70): post-cast pipeline 통합 ===
              // 일반 ability cast 끝부분 (line ~5214-5222) 와 동일한 처리:
              //   1. omnivamp heal — totalSelfDestructDmg (적군 damage) 기반.
              //      자폭은 primary target 없어 grievousReduction = 1.0 (단순화).
              //   2. Fountain heal — 별돌보미 우물 별자리 강화칸 별돌보미 효과 (적군 damage 기반).
              //   3. on_cast emit — value/rawValue 에 self damage + enemy damage 합산.
              //      PsyOps 등 cast event subscriber 가 정확한 cast payload 수신.
              if (unit.omnivamp > 0 && totalSelfDestructDmg > 0) {
                const heal = totalSelfDestructDmg * unit.omnivamp * (1 + (unit.healAmp ?? 0));
                applyOmnivampHealWithMeleeShield(unit, heal);
              }
              triggerFountainHeal(unit, totalSelfDestructDmg, tick, time, tickLogs);
              eventBus.emit('on_cast', {
                sourceId: unit.id,
                targetId: unit.id, // primary target 없어 self 로 표기 (자폭 mechanics)
                value: dmgApplied + totalSelfDestructDmg,
                rawValue: selfDamageRaw + totalSelfDestructRawDmg,
                tick,
              });

              continue; // 일반 ability 흐름 skip — 자폭 전용 처리 끝
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
            // Poppy: helper(applyPoppyShieldAndResists)가 readVarByStar 로 정확한 Shield 값 적용
            //   (codex P1 PR #102 — getAbilityShield value[starLevel] shifted indexing 회피).
            // Mordekaiser: applyMordekaiserProcCast 가 InitialShield 를 별도 pool 에 적용
            //   (mordekaiserShieldRemaining — general unit.shield 와 분리, HealRefund 정확 계산).
            const abilityShield = (unit.champion.apiName === 'TFT17_Poppy' || unit.champion.apiName === 'TFT17_Mordekaiser')
              ? 0
              : getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
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
            // codex P1 (PR #75): PR7-D 뽀삐 spiritBounceOnKill — primary target 처치 시 overkill
            // 캡처용. cast loop 의 사망 처리에서 currentHp clamp (=0) 하기 전에 음수 절댓값
            // 저장. bouncing 분기에서 이 값 사용 (clamp 후엔 0 → bouncing dead-code 회귀).
            let primaryOverkillForBounce = 0;
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
                // PR101: 매드레드의 검 — 탱커 상대 +15% damageAmp (ability cast 도 적용)
                if (unit.madredsTankDamageAmp > 0 && t.role === 'Tank') {
                  abilityDamageAmp += unit.madredsTankDamageAmp;
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
                // refactor: 통합 carry-specific damage modifier helper (PR4~PR7-D 5 메커니즘).
                //   1. singleTargetMultiplier (아트록스 찍기 cycle 단독 적중)
                //   2. secondaryDamage (파이크 X-shape, 레오나 line)
                //   3. tankBonusMultiplier (파이크 primary target Tank)
                //   4. armorScale (뽀삐 raw 가산)
                //   5. hexReduction (꼬마정령 abilityTarget 기준 multiplicative falloff)
                let baseDmg = applyCarryDamageModifiers(abilityDmg, unit, t, carryCfg, {
                  abilityTarget,
                  aliveTargetCount: aliveTargets.length,
                  aatroxIsSingleTargetSlam,
                });
                // 초가스: % 최대체력 피해 추가
                if (unit.champion.apiName === 'TFT17_Chogath') {
                  const pctVar = unit.champion.ability.variables?.find(v => v.name === 'PercentMaximumHealthDamage');
                  const pctHp = readVarByStar(pctVar?.value, unit.starLevel, 0.08);
                  baseDmg += t.maxHp * pctHp;
                }
                // 트위스티드 페이트: 랜덤 범위 피해 (DamageMin ~ DamageMax)
                if (unit.champion.apiName === 'TFT17_TwistedFate') {
                  const minVar = unit.champion.ability.variables?.find(v => v.name === 'DamageMin');
                  const maxVar = unit.champion.ability.variables?.find(v => v.name === 'DamageMax');
                  // PR99: TF DamageMin [180, 190, 285] = no-filler — readVarByStar 자동.
                  const minDmg = readVarByStar(minVar?.value, unit.starLevel, baseDmg);
                  const maxDmg = readVarByStar(maxVar?.value, unit.starLevel, baseDmg);
                  baseDmg = minDmg + rng.next() * (maxDmg - minDmg);
                }
                // 브라이어: 탱커 대상 50% 추가 피해
                if (unit.champion.apiName === 'TFT17_Briar' && t.role === 'Tank') {
                  const bonusPct = readVarByStar(
                    unit.champion.ability.variables?.find(v => v.name === 'PercentBonusDamage')?.value, unit.starLevel, 0.5
                  );
                  baseDmg *= (1 + bonusPct);
                }
                // secondaryDamageVar: 2차 피해 합산 (리산드라 폭발, 베이가 미니유성 등)
                // PR99: Lissandra/Veigar/Karma 는 filler, Graves SecondaryDamageAD 는 no-filler — readVarByStar 자동.
                if (config.secondaryDamageVar) {
                  const secVar = unit.champion.ability.variables?.find(v => v.name === config.secondaryDamageVar);
                  const secVal = readVarByStar(secVar?.value, unit.starLevel, 0);
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

                // refactor: 통합 mitigation helper (resistance + DR + non-target + shield + invulnerable)
                const effectiveDmg = applyAbilityMitigation(unit, t, dmg, dmgType, eventBus, tick);

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
                  // codex P1 (PR #75): PR7-D 뽀삐 spiritBounceOnKill — primary target 처치 시
                  // currentHp clamp 이전에 overkill 캡처. helper 호출 전에 처리.
                  if (t === abilityTarget && carryCfg?.abilityData?.spiritBounceOnKill) {
                    primaryOverkillForBounce = -t.currentHp;
                  }
                  // refactor: 통합 markTargetDead helper + deathLog 별도
                  const ownArbCast = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                  const deathLog: CombatLog = {
                    tick, time, type: 'death',
                    sourceId: t.id,
                    message: `${t.champion.name} 사망! (${unit.champion.name}의 ${unit.champion.ability.name})`,
                  };
                  logs.push(deathLog);
                  tickLogs.push(deathLog);
                  markTargetDead(unit, t, ownArbCast, eventBus, tick);
                }
              }

              // === PR7-A (17.2b) — 파이크 carry onKillRecast cascade ===
              // primary target 처치 시 완전 재 cast (새 dash + 새 X-shape) damage × recastMul.
              // 사용자 결정: cascade max chain 5 (무한 루프 방지). 새 dash to_lowest_hp.
              // 재시전 damage 는 totalAbilityDmg / totalRawAbilityDmg 에 누적 — omnivamp / Fountain
              // / on_cast 정합. damageAmp / sniper / crit / mitigation 은 cast loop 와 동일 적용.
              const recastMul = carryCfg?.abilityData?.onKillRecastMultiplier ?? 0;
              if (recastMul > 0 && abilityTarget.state === 'dead') {
                const MAX_RECAST_CHAIN = 5;
                let chainCount = 0;
                while (chainCount < MAX_RECAST_CHAIN) {
                  chainCount++;
                  const aliveOpp = opposingTeam.filter(u => u.state !== 'dead');
                  if (aliveOpp.length === 0) break;
                  const newPrimary = findLowestHpEnemy(aliveOpp);
                  if (!newPrimary) break;

                  // 새 dash + 새 X-shape 재계산
                  let recastTarget = newPrimary;
                  if (config.dash) {
                    recastTarget = applyAbilityDash(
                      unit, config.dash, newPrimary, opposingTeam,
                      occupiedPositions, logs, tickLogs, tick, time
                    );
                  }
                  const recastTargets = findAbilityTargets(unit, recastTarget, opposingTeam, config);
                  const recastAlive = recastTargets.filter(rt => rt.state !== 'dead');

                  for (const t of recastAlive) {
                    const isPrimaryRecast = t === recastTarget;
                    // primary vs secondary base damage 분기 (cast loop 패턴 동일)
                    let recastBaseDmg: number;
                    if (carryCfg?.abilityData?.secondaryDamage && !isPrimaryRecast) {
                      const secArr = carryCfg.abilityData.secondaryDamage;
                      const secBase = secArr[unit.starLevel - 1] ?? secArr[0];
                      const secDt: DamageType = carryCfg.damageTypeOverride
                        ?? carryCfg.abilityData.damageType ?? 'magic';
                      recastBaseDmg = secDt === 'magic'
                        ? secBase * (1 + unit.stats.ap / 100)
                        : secBase;
                    } else {
                      recastBaseDmg = abilityDmg;
                    }
                    recastBaseDmg *= recastMul;
                    if (isPrimaryRecast && carryCfg?.abilityData?.tankBonusMultiplier && t.role === 'Tank') {
                      recastBaseDmg *= (1 + carryCfg.abilityData.tankBonusMultiplier);
                    }

                    // codex P2 (PR #72): full damage amp stack — 일반 cast loop (line ~5155)
                    // 와 동일하게 inventionTankDamageAmp / gravesTankDamageAmp /
                    // mfReplicatorEffectiveness 포함. Tank target 한정 buff 누락 시
                    // recast under-damage 회귀.
                    let recastDamageAmp = unit.damageAmp;
                    if (unit.inventionTankDamageAmp > 0 && t.role === 'Tank') {
                      recastDamageAmp += unit.inventionTankDamageAmp;
                    }
                    if (unit.gravesTankDamageAmp > 0 && t.role === 'Tank') {
                      recastDamageAmp += unit.gravesTankDamageAmp;
                    }
                    // PR101: 매드레드의 검 — 탱커 상대 +15% damageAmp (recast path)
                    if (unit.madredsTankDamageAmp > 0 && t.role === 'Tank') {
                      recastDamageAmp += unit.madredsTankDamageAmp;
                    }
                    recastDamageAmp += computeSniperDamageAmp(unit, t);
                    if (unit.mfReplicatorEffectiveness > 0) {
                      recastDamageAmp += unit.mfReplicatorEffectiveness;
                    }
                    let dmg = recastBaseDmg * (1 + recastDamageAmp);
                    if (unit.spellCanCrit && rng.next() < unit.stats.critChance) {
                      dmg *= unit.stats.critMultiplier;
                    }
                    totalRawAbilityDmg += dmg;

                    // refactor: 통합 mitigation helper
                    const effectiveDmg = applyAbilityMitigation(unit, t, dmg, dmgType, eventBus, tick);

                    t.currentHp -= effectiveDmg;
                    t.totalDamageTaken += effectiveDmg;
                    unit.totalDamageDealt += effectiveDmg;
                    totalAbilityDmg += effectiveDmg;

                    // codex P2 (PR #72): Serpent poison — 일반 cast loop 와 동일하게
                    // 강화 칸 별돌보미 ability 명중 시 중독 적용. recast hits 도 동일 처리.
                    triggerSerpentPoison(unit, t, effectiveDmg);

                    const recastLog: CombatLog = {
                      tick, time, type: 'ability',
                      sourceId: unit.id, targetId: t.id,
                      value: Math.round(effectiveDmg),
                      message: `${unit.champion.name} 자동 재시전 #${chainCount}! ${t.champion.name}에게 ${Math.round(effectiveDmg)} 피해 (×${recastMul})`,
                    };
                    logs.push(recastLog);
                    tickLogs.push(recastLog);

                    if (t.currentHp <= 0) {
                      // refactor: markTargetDead helper
                      const ownArbRecast = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                      markTargetDead(unit, t, ownArbRecast, eventBus, tick);
                    }
                  }
                  // primary recast target 처치 못했으면 cascade 종료
                  if (recastTarget.state !== 'dead') break;
                }
              }

              // === PR7-D (17.2b) — 뽀삐 carry spiritBounceOnKill ===
              // primary target 처치 시 가장 가까운 alive 적에 overkill (잔여) damage 튕김.
              // 사용자 결정:
              //   - 잔여 damage = overkill (처치 후 currentHp 음수 절댓값)
              //   - chain max 제한 없음 (overkill 0 되면 자연 종료) — 무한 루프 안전 hard limit 50
              //   - "가장 가까운" 기준 = 처치된 target 위치 (게임 내 튕김 메커니즘 일관)
              // mitigation 적용 (resistance + DR + non-target reduction + shield + invulnerable).
              // bouncing damage 누적 totalAbilityDmg / Raw — omnivamp / Fountain / on_cast 정합.
              if (carryCfg?.abilityData?.spiritBounceOnKill && abilityTarget.state === 'dead') {
                const MAX_BOUNCE_HARD_LIMIT = 50;
                let bounceCount = 0;
                let lastDeadTarget: CombatUnit = abilityTarget;
                // codex P1 (PR #75): primaryOverkillForBounce 사용 — cast loop 사망 처리에서
                // clamp (currentHp=0) 전 캡처된 overkill 음수 절댓값. clamp 후 currentHp 직접
                // 참조 시 항상 0 → bouncing dead-code 회귀 방지.
                let overkill = primaryOverkillForBounce;

                while (overkill > 0 && bounceCount < MAX_BOUNCE_HARD_LIMIT) {
                  bounceCount++;
                  const aliveOpp = opposingTeam.filter(u => u.state !== 'dead');
                  if (aliveOpp.length === 0) break;
                  // 가장 가까운 alive 적 (처치된 target 위치 기준)
                  aliveOpp.sort((a, b) =>
                    hexDistance(lastDeadTarget.position, a.position)
                    - hexDistance(lastDeadTarget.position, b.position)
                  );
                  const newTarget = aliveOpp[0];

                  // refactor: 통합 mitigation helper
                  const bounceDmg = applyAbilityMitigation(unit, newTarget, overkill, dmgType, eventBus, tick);

                  newTarget.currentHp -= bounceDmg;
                  newTarget.totalDamageTaken += bounceDmg;
                  unit.totalDamageDealt += bounceDmg;
                  totalAbilityDmg += bounceDmg;
                  totalRawAbilityDmg += overkill;

                  triggerSerpentPoison(unit, newTarget, bounceDmg);

                  const bounceLog: CombatLog = {
                    tick, time, type: 'ability',
                    sourceId: unit.id, targetId: newTarget.id,
                    value: Math.round(bounceDmg),
                    message: `${unit.champion.name} 정령 튕김 #${bounceCount}! ${newTarget.champion.name}에게 ${Math.round(bounceDmg)} 피해 (overkill ${Math.round(overkill)})`,
                  };
                  logs.push(bounceLog);
                  tickLogs.push(bounceLog);

                  // 새 target 처치 검사 — overkill 갱신 후 다음 chain (clamp 전 캡처)
                  if (newTarget.currentHp <= 0) {
                    const newOverkill = Math.max(0, -newTarget.currentHp);
                    // refactor: markTargetDead helper
                    const ownArbBounce = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                    markTargetDead(unit, newTarget, ownArbBounce, eventBus, tick);
                    lastDeadTarget = newTarget;
                    overkill = newOverkill;
                  } else {
                    // 처치 못 함 — bounce chain 자연 종료
                    break;
                  }
                }
              }

              // === PR7-C (17.2b): N.O.V.A. 타격 — 추가 발동 (cycle 과 별개) ===
              // 사용자 정정 spec: "기존 스킬 그대로 + 6초 NOVA 각성 시 특수 효과 추가".
              // Aatrox 추가 효과: 모든 적에게 novaDamage 물리 + 1초 공중 띄움.
              // 일반 ability mitigation (resistance + DR + non-target reduction + shield + invulnerable)
              // 동일 적용. damage 는 totalAbilityDmg / Raw 누적 (omnivamp / Fountain / on_cast 정합).
              //
              // codex P1 (PR #73): DRX surge 활성 검사 — selector flag 만으로는 불충분.
              // tickDrxNova 가 6초 (TeamAttackDelay) 도달 시 state.triggered = true 설정.
              // DRX trait 비활성 (state === null) 또는 surge 미발동 (triggered === false) 시
              // N.O.V.A. 효과 미발동 — tickDrxNova 의 timing/trait gating 동일 적용.
              const ownDrxState = unit.team === 'player' ? playerDrxState : enemyDrxState;
              const novaSurgeActive = !!(ownDrxState && ownDrxState.triggered);
              if (isAatroxCarry && unit.aatroxNovaStrikeSelector && novaSurgeActive
                  && carryCfg?.abilityData?.novaDamage) {
                const novaArr = carryCfg.abilityData.novaDamage;
                const novaBase = novaArr[unit.starLevel - 1] ?? novaArr[0];
                // novaDamage 는 도메인상 AD 표기 → physical, 0% bonusAdPercent default.
                // mitigation 패턴: physical 이라 armor / armorPen 직접 사용 (DamageType 비교 없이 단순화).
                const novaStunTicks = TICKS_PER_SECOND;
                const ownArbiterState = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                for (const t of opposingTeam) {
                  if (t.state === 'dead') continue;
                  // refactor: 통합 mitigation helper (physical novaDamage)
                  const novaEffective = applyAbilityMitigation(unit, t, novaBase, 'physical', eventBus, tick);

                  t.currentHp -= novaEffective;
                  t.totalDamageTaken += novaEffective;
                  unit.totalDamageDealt += novaEffective;
                  totalAbilityDmg += novaEffective;
                  totalRawAbilityDmg += novaBase;

                  triggerSerpentPoison(unit, t, novaEffective);

                  // N.O.V.A. knockup — 1초 stun (전장 가르고 모든 적 공중 띄움)
                  t.statusEffects.push({ type: 'stun', sourceId: unit.id, remainingTicks: novaStunTicks });
                  t.state = 'idle';
                  t.attackCooldown = 0;

                  const novaLog: CombatLog = {
                    tick, time, type: 'ability',
                    sourceId: unit.id, targetId: t.id,
                    value: Math.round(novaEffective),
                    message: `${unit.champion.name} N.O.V.A. 타격! ${t.champion.name}에게 ${Math.round(novaEffective)} 물리 피해 + 공중 띄움`,
                  };
                  logs.push(novaLog);
                  tickLogs.push(novaLog);

                  if (t.currentHp <= 0) {
                    // refactor: markTargetDead helper
                    markTargetDead(unit, t, ownArbiterState, eventBus, tick);
                  }
                }
              }

              // PR7-C (17.2b): Aatrox carry cycle counter +1 — cast 완료 후 다음 cast cycle 진입 준비.
              // 사용자 결정: 사망 시 reset (aatroxPreviouslyDead 검사 — cast 진입 시점에 이미 처리).
              if (isAatroxCarry) {
                unit.aatroxCycleCounter++;
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

              // codex P2 (PR #83): refactor (cast-post-processing-helper) helper 호출을
              // splash AOE (BlastRadius/SympatheticDetonation) 직후로 이동. 기존엔 splash
              // 전 호출 → splash 로 죽을 적이 꼬마정령 multi-stun 3 슬롯 차지 → 살아남는 적
              // stun 부족 회귀. splash 후 호출 시 alive 적만 stun 슬롯 채워서 정확.
              // 통합 helper: 꼬마정령 multi-stun + Akali burn refresh.
              applyCarryPostCastEffects(unit, abilityTargets, carryCfg);
            }

            // 전체 피해량 기반 흡혈 — healAmp 곱셈 적용.
            if (unit.omnivamp > 0 && totalAbilityDmg > 0) {
              const grievousReduction = target.augmentGrievousWounds > 0 ? (1 - target.augmentGrievousWounds) : 1;
              const heal = totalAbilityDmg * unit.omnivamp * grievousReduction * (1 + (unit.healAmp ?? 0));
              applyOmnivampHealWithMeleeShield(unit, heal);
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

            // === PR7-B (17.2b) — 꼬마정령 carry multi-stun ===
            // refactor (cast-post-processing-helper): applyCarryPostCastEffects helper 로 통합
            // (line ~6072 호출 — Akali burn refresh 와 함께 처리).

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
              // PR98: Illaoi 의 HealthDrain (drain × NumEnemies) 도 self-heal 로 인식.
              // Illaoi ability '영혼의 시험': 가까운 NumEnemies 명에게서 HealthDrain 흡수.
              // 단순화 — 실제 메커닉은 3s 동안 drain over time, sim 은 cast 순간 lump-sum heal.
              const healVar = unit.champion.ability.variables.find(v => v.name === 'Heal' || v.name === 'APHeal' || v.name === 'PercentMaximumHealthHealing' || v.name === 'HealthDrain');
              if (healVar) {
                const starIdx = Math.min(unit.starLevel, healVar.value.length - 1);
                const healVal = healVar.value[starIdx] ?? healVar.value[0] ?? 0;
                let healAmount = typeof healVal === 'number'
                  ? (healVal < 1 ? Math.round(unit.maxHp * healVal) : Math.round(healVal * (1 + unit.stats.ap / 100)))
                  : 0;
                // HealthDrain 은 NumEnemies 명에게서 흡수 — total = per_enemy × NumEnemies (cap to alive abilityTargets).
                // codex P2 (PR #98): cast 시점의 alive count (line 5810 의 aliveTargets) 재사용 —
                // damage resolution 후 abilityTargets.filter 면 cast 로 죽은 적 제외돼 under-heal.
                if (healVar.name === 'HealthDrain') {
                  const numEnemiesVar = unit.champion.ability.variables.find(v => v.name === 'NumEnemies');
                  const numCap = numEnemiesVar
                    ? (numEnemiesVar.value[Math.min(unit.starLevel, numEnemiesVar.value.length - 1)] ?? 1)
                    : 1;
                  const numEnemies = Math.min(numCap, Math.max(1, aliveTargets.length));
                  healAmount *= numEnemies;
                }
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

            // === Set 17 Poppy: Shield + 2칸 내 아군 Resists ===
            if (unit.champion.apiName === 'TFT17_Poppy') {
              applyPoppyShieldAndResists(unit, getAllyTeam(unit, playerUnits, enemies));
            }

            // === Set 17 Mordekaiser: 4초간 매초 펄스 + HealRefund ===
            if (unit.champion.apiName === 'TFT17_Mordekaiser') {
              applyMordekaiserProcCast(unit, tick);
            }

            // === Set 17 Illaoi: NumEnemies(3) 명 true drain + 3초 후 magic AOE ===
            if (unit.champion.apiName === 'TFT17_Illaoi') {
              const enemyTeamForIllaoi = unit.team === 'player' ? enemies : playerUnits;
              const ownArbiterStateIllaoi = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
              const illaoiResult = applyIllaoiCast(unit, tick, enemyTeamForIllaoi, eventBus, ownArbiterStateIllaoi, logs);
              // codex P2 PR #106: drain damage 를 on_cast accumulator 에 합산 (omnivamp/Fountain 정합).
              totalAbilityDmg += illaoiResult.totalDealt;
              totalRawAbilityDmg += illaoiResult.totalRaw;
            }

            // === 이즈리얼 드론: 스킬 사용 시 타겟에게 추가 물리 피해 ===
            const ezDrones = (unit as CombatUnit & { _ezrealDrones?: number })._ezrealDrones ?? 0;
            if (ezDrones > 0 && abilityTarget.state !== 'dead') {
              const droneDmgBase = readVarByStar(
                unit.champion.ability.variables?.find(v => v.name === 'DroneDamage')?.value, unit.starLevel, 8
              );
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
          // 쉔 (TFT17_Shen) passive — OOR cast 경로에서도 stack 누적.
          if (unit.champion.apiName === 'TFT17_Shen') {
            unit.shenPassiveStack++;
          }
          unit.attackCooldown = outOfRangeConfig.pattern === 'self_buff' ? SELF_BUFF_CAST_TICKS : CAST_TICKS;
          // 마나 소모 시점 (사거리 밖 dash cast 경로)
          eventBus.emit('on_mana_spent', { sourceId: unit.id, value: spentManaOOR, tick });

          // PR5 (17.2b): OOR cast 경로 (사거리 밖 dash cast) 도 carry augment 활성 시
          // abilityData.damage override 적용 — 일반 cast 경로 (line 4892~) 와 동일 패턴.
          // codex P1 (PR #71): self_buff pattern 은 self-hit 회귀 방지로 raw 사용 (일반 cast 와 동일).
          const oorCarryCfg = findCarryAugment(unit.champion.apiName, augNames);
          const oorCarryForDamage = outOfRangeConfig.pattern !== 'self_buff' ? oorCarryCfg : null;
          const { damage: rawOORDmgResolved, type: dmgType } = resolveAbilityDamage(
            unit.champion, unit.starLevel, unit.stats.ap, oorCarryForDamage, outOfRangeConfig.damageVar
          );
          // codex P1 (PR #98): self_buff OOR 경로도 self-hit 회귀 방지 — damage 0 강제.
          const rawOORDmg = outOfRangeConfig.pattern === 'self_buff' ? 0 : rawOORDmgResolved;
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
          // Poppy: helper(applyPoppyShieldAndResists)가 readVarByStar 로 정확한 Shield 값 적용
          //   (codex P1 PR #102 — getAbilityShield value[starLevel] shifted indexing 회피).
          // Mordekaiser: applyMordekaiserProcCast 가 InitialShield 를 별도 pool 에 적용
          //   (mordekaiserShieldRemaining — general unit.shield 와 분리, HealRefund 정확 계산).
          const abilityShield = (unit.champion.apiName === 'TFT17_Poppy' || unit.champion.apiName === 'TFT17_Mordekaiser')
            ? 0
            : getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
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

          // === Set 17 Poppy: Shield + 2칸 내 아군 Resists (OOR cast) ===
          if (unit.champion.apiName === 'TFT17_Poppy') {
            applyPoppyShieldAndResists(unit, getAllyTeam(unit, playerUnits, enemies));
          }

          // === Set 17 Mordekaiser: 4초간 매초 펄스 + HealRefund (OOR cast) ===
          if (unit.champion.apiName === 'TFT17_Mordekaiser') {
            applyMordekaiserProcCast(unit, tick);
          }

          // === Set 17 Illaoi: NumEnemies(3) 명 true drain + 3초 후 magic AOE (OOR cast) ===
          let illaoiOorResult: { totalDealt: number; totalRaw: number } | null = null;
          if (unit.champion.apiName === 'TFT17_Illaoi') {
            const enemyTeamForIllaoi = unit.team === 'player' ? enemies : playerUnits;
            const ownArbiterStateIllaoi = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
            illaoiOorResult = applyIllaoiCast(unit, tick, enemyTeamForIllaoi, eventBus, ownArbiterStateIllaoi, logs);
          }

          // 피해 적용
          let totalAbilityDmg = 0;
          // raw total — per-target modifier (damageAmp/sniper/crit) 적용 후, mitigation 전.
          // on_cast.rawValue 로 emit 되어 SympatheticImplant 등 raw 기반 effect 가 사용.
          let totalRawAbilityDmg = 0;
          // codex P2 PR #106: Illaoi drain damage 를 on_cast accumulator 에 합산 (omnivamp/Fountain 정합).
          if (illaoiOorResult) {
            totalAbilityDmg += illaoiOorResult.totalDealt;
            totalRawAbilityDmg += illaoiOorResult.totalRaw;
          }
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
              // 저격수 (Sniper) — 거리 기반 추가 damage amp
              const sniperAmp = computeSniperDamageAmp(unit, t);
              // refactor (carry-damage-modifier): 통합 helper 호출 — 5 carry modifier 모두 적용.
              // OOR cast 는 아트록스 cycle 미적용 (cycle counter 는 in-range cast 에서만 진행) →
              // aatroxIsSingleTargetSlam=false. 다른 메커니즘 (secondary/tankBonus/armorScale/
              // hexReduction) 은 in-range 와 일관 — codex P1 #76 의 다른 OOR 누락 회귀 자동 해소.
              const oorBaseDmg = applyCarryDamageModifiers(abilityDmg, unit, t, oorCarryCfg, {
                abilityTarget,
                aliveTargetCount: oorAlive.length,
                aatroxIsSingleTargetSlam: false,
              });
              let rawDmg = oorBaseDmg * (1 + unit.damageAmp + sniperAmp);
              if (unit.spellCanCrit && rng.next() < unit.stats.critChance) {
                rawDmg *= unit.stats.critMultiplier;
              }
              // raw 누적 — mitigation 전 per-target modifier 적용 후.
              totalRawAbilityDmg += rawDmg;
              // refactor (oor-cast-mitigation): 통합 mitigation helper — in-range 와 완전 일관.
              // 정정 사항 2건: (1) non-target reduction (Fighter/Assassin ×0.85) OOR 도 적용.
              // (2) true damage 처리 helper applyResistance(rawDmg, 0, 0) = rawDmg 자동 동일.
              // 사용자 결정 (refactor/oor-cast-mitigation): in-range 와 완전 일관.
              const dmg = applyAbilityMitigation(unit, t, rawDmg, dmgType, eventBus, tick);
              t.currentHp -= dmg;
              t.totalDamageTaken += dmg;
              unit.totalDamageDealt += dmg;
              totalAbilityDmg += dmg;

              // 별돌보미 뱀(Serpent) — OOR ability 명중 시 중독 적용
              triggerSerpentPoison(unit, t, dmg);

              if (t.currentHp <= 0) {
                // refactor: 통합 markTargetDead helper + deathLog 별도 작성
                const ownArbOOR = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
                logs.push({ tick, time, type: 'death', sourceId: t.id, message: `${t.champion.name} 사망!` });
                markTargetDead(unit, t, ownArbOOR, eventBus, tick);
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

          // refactor (cast-post-processing-helper): in-range / OOR 둘 다 동일 helper 호출
          // → 신규 carry post-cast 메커니즘 추가 시 helper 한 곳만 수정. PR #76 multi-stun
          // OOR 누락 / PR #82 Akali burn OOR 누락 같은 동기화 회귀 자동 방지.
          //   - 꼬마정령 multi-stun (PR7-B + PR #76 fix)
          //   - Akali 단검 burn refresh (PR7-C.7 + PR #82 fix)
          applyCarryPostCastEffects(unit, abilityTargets, oorCarryCfg);

          // === 이즈리얼 드론: 스킬 사용 시 타겟에게 추가 물리 피해 ===
          const ezDronesOOR = (unit as CombatUnit & { _ezrealDrones?: number })._ezrealDrones ?? 0;
          if (ezDronesOOR > 0 && abilityTarget.state !== 'dead') {
            const droneDmgBase = readVarByStar(
              unit.champion.ability.variables?.find(v => v.name === 'DroneDamage')?.value, unit.starLevel, 8
            );
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
