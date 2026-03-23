import {
  CombatUnit, CombatResult, CombatLog, PlacedChampion,
  HexCoord, TickSnapshot, mapGameRole,
  RawTrait, RawAugment, RawItem, ActiveTrait, ItemEffect,
} from '@/types';
import type { StatusEffectType } from '@/types';
import { calculateStats } from '@/lib/simulator/systems/stat';
import { getAbilityDamage, getAbilityShield, findAbilityTargets, CHAMPION_ABILITY_PATTERNS } from '@/lib/simulator/systems/ability';
import type { AbilityConfig } from '@/lib/simulator/systems/ability';
import { canAttack, getMoveTicks, findBestMoveToward, coordKey, getNeighbors, hexDistance } from '@/lib/simulator/systems/movement';
import { TICK_DURATION, MAX_TICKS, TICKS_PER_SECOND } from '@/lib/simulator/models/constants';
import { createRNG, SeededRNG } from '@/lib/simulator/engine/rng';
import { captureSnapshot } from '@/lib/simulator/engine/replayEngine';
import { findTarget, getTargetingWeight } from '@/lib/simulator/systems/targeting';
import { gainManaOnAttack, gainManaPerTick, gainManaOnDamageTaken } from '@/lib/simulator/systems/mana';
import { EventBus } from '@/lib/simulator/events/eventBus';
import { ROLE_OMNIVAMP } from '@/lib/simulator/models/unit';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { resolveAugmentEffects, resolveInCombatAugmentEffects, resolvePerUnitMods, applyPerUnitMods, AugmentWithStacks } from '@/lib/simulator/systems/augment';

/** 상태이상 한글 레이블 (엔진 로그용 — UI 모듈에 의존하지 않음) */
const STATUS_EFFECT_LABELS: Record<StatusEffectType, string> = {
  stun: '기절',
  slow: '둔화',
  burn: '화상',
  disarm: '무장해제',
  taunt: '도발',
  shield: '보호막',
  invulnerable: '무적',
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
}

function createCombatUnit(
  placed: PlacedChampion,
  team: 'player' | 'enemy',
  index: number,
  activeTraits: ActiveTrait[] = [],
  augmentEffects: ItemEffect = {},
): CombatUnit {
  const { stats } = calculateStats(placed.champion, placed.starLevel, placed.items, activeTraits, augmentEffects);
  const role = mapGameRole(placed.champion.role);
  return {
    id: `${team}-${index}`,
    champion: placed.champion,
    team,
    position: { ...placed.position },
    starLevel: placed.starLevel as 1 | 2 | 3,
    role,
    items: placed.items,
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
    totalDamageTaken: 0,
    statusEffects: [],
    omnivamp: ROLE_OMNIVAMP[role],
    damageAmp: 0,
    damageReduction: 0,
    shield: 0,
    augmentManaRegen: 0,
    augmentGrievousWounds: 0,
    augmentExecuteThreshold: 0,
    augmentBurnPercent: 0,
    inventionTankDamageAmp: 0,
  };
}

/** Fighter/Assassin 비타겟 피해 감소 비율 */
const NON_TARGET_DAMAGE_REDUCTION = 0.15;

/** 전투 시작 시 암살자 유닛을 적 후열로 점프시킴 */
function applyAssassinJump(
  teamUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  allUnits: CombatUnit[],
  logs: CombatLog[],
): void {
  const assassins = teamUnits.filter(u => u.role === 'Assassin' && u.state !== 'dead');
  if (assassins.length === 0) return;

  const aliveEnemies = enemyUnits.filter(u => u.state !== 'dead');
  if (aliveEnemies.length === 0) return;

  const occupiedPositions = new Set(
    allUnits.filter(u => u.state !== 'dead').map(u => coordKey(u.position))
  );

  for (const assassin of assassins) {
    // 적 팀에서 가장 먼 유닛 찾기 (Marksman/Caster 우선)
    let farthestDist = 0;
    let farthestEnemy: CombatUnit | null = null;
    for (const enemy of aliveEnemies) {
      const dist = hexDistance(assassin.position, enemy.position);
      if (dist > farthestDist) {
        farthestDist = dist;
        farthestEnemy = enemy;
      } else if (dist === farthestDist && farthestEnemy) {
        const enemyWeight = getTargetingWeight(enemy.role);
        const currentWeight = getTargetingWeight(farthestEnemy.role);
        if (enemyWeight < currentWeight) {
          farthestEnemy = enemy;
        }
      }
    }
    if (!farthestEnemy) continue;

    // 해당 유닛 인접 빈 칸 중 하나 선택
    const neighbors = getNeighbors(farthestEnemy.position);
    const freeNeighbors = neighbors.filter(n => !occupiedPositions.has(coordKey(n)));
    if (freeNeighbors.length === 0) continue;

    // 가장 가까운 빈 칸 선택 (적 딜러에 가장 가까운 칸)
    let bestHex = freeNeighbors[0];
    let bestDist = Infinity;
    for (const hex of freeNeighbors) {
      const dist = hexDistance(hex, farthestEnemy.position);
      if (dist < bestDist) {
        bestDist = dist;
        bestHex = hex;
      }
    }

    // 이전 위치 해제, 새 위치 점유
    occupiedPositions.delete(coordKey(assassin.position));
    assassin.position = bestHex;
    occupiedPositions.add(coordKey(bestHex));

    const log: CombatLog = {
      tick: 0, time: 0, type: 'move',
      sourceId: assassin.id,
      message: `[역할군] ${assassin.champion.name}이(가) 적 후열로 점프!`,
    };
    logs.push(log);
  }
}

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
  }

  // 만료된 상태이상 로그 생성
  const expired = unit.statusEffects.filter(e => e.remainingTicks <= 0);
  for (const effect of expired) {
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
  return unit.stats.attackSpeed * mult;
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

/** 녹서스 아타칸 소환 — 적 팀 HP가 일정 비율 이하로 떨어지면 소환 */
function trySpawnNoxusAtakhan(
  activeTraits: ActiveTrait[],
  team: 'player' | 'enemy',
  teamUnits: CombatUnit[],
  opposingUnits: CombatUnit[],
  allUnits: CombatUnit[],
  rng: SeededRNG,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  spawnedFlag: { spawned: boolean },
): CombatUnit | null {
  if (spawnedFlag.spawned) return null;

  const noxus = activeTraits.find(t => t.trait.apiName === 'TFT16_Noxus' && t.activeEffect);
  if (!noxus || !noxus.activeEffect) return null;

  const vars = noxus.activeEffect.variables;
  const hpTrigger = (vars['HPLostTrigger'] ?? 0.15) as number;

  // 적 팀 총 HP 비율 계산
  const aliveOpposing = opposingUnits.filter(u => u.state !== 'dead');
  const totalMaxHp = opposingUnits.reduce((sum, u) => sum + u.maxHp, 0);
  const totalCurrentHp = aliveOpposing.reduce((sum, u) => sum + u.currentHp, 0);
  if (totalMaxHp === 0) return null;

  const hpLostRatio = 1 - (totalCurrentHp / totalMaxHp);
  if (hpLostRatio < hpTrigger) return null;

  // 소환 트리거!
  spawnedFlag.spawned = true;

  // 녹서스 챔피언 별레벨 합산 → 아타칸 위력
  const noxusChamps = teamUnits.filter(u =>
    u.champion.traits.includes('녹서스') && u.state !== 'dead'
  );
  const totalStarPower = noxusChamps.reduce((sum, u) => sum + u.starLevel, 0);
  const baseDamage = 80 + totalStarPower * 30;
  const baseHp = 1500 + totalStarPower * 200;

  // 빈 위치 찾기
  const occupiedPositions = new Set(
    allUnits.filter(u => u.state !== 'dead').map(u => `${u.position.q},${u.position.r}`)
  );
  const startRow = team === 'player' ? 4 : 0;
  const endRow = team === 'player' ? 6 : 2;
  let spawnPos: { q: number; r: number } | null = null;
  for (let r = startRow; r <= endRow && !spawnPos; r++) {
    for (const col of [3, 2, 4, 1, 5, 0, 6]) {
      const q = col - Math.floor(r / 2);
      if (!occupiedPositions.has(`${q},${r}`)) {
        spawnPos = { q, r };
        break;
      }
    }
  }
  if (!spawnPos) return null;

  const atakhanId = `${team}-atakhan`;
  const atakhan: CombatUnit = {
    id: atakhanId,
    champion: {
      name: '아타칸',
      apiName: 'TFT16_NoxusAtakhan',
      cost: 0,
      traits: ['녹서스'],
      role: null,
      stats: { armor: 60, attackSpeed: 0.7, critChance: 0.25, critMultiplier: 1.4, damage: baseDamage, hp: baseHp, initialMana: 0, magicResist: 60, mana: 100, range: 1 },
      ability: { name: '파멸의 일격', desc: '', icon: '', variables: [] },
    },
    team,
    position: spawnPos,
    starLevel: Math.min(3, Math.max(1, Math.floor(totalStarPower / 3))) as 1 | 2 | 3,
    role: 'Fighter',
    items: [],
    currentHp: baseHp,
    maxHp: baseHp,
    currentMana: 0,
    maxMana: 100,
    state: 'idle',
    target: null,
    stats: {
      hp: baseHp, armor: 60, magicResist: 60,
      damage: baseDamage, attackSpeed: 0.7,
      critChance: 0.25, critMultiplier: 1.4,
      ap: 0, mana: 0, maxMana: 100, range: 1,
      armorPen: 0, magicPen: 0,
    },
    attackCooldown: 0,
    moveCooldown: 0,
    totalDamageDealt: 0,
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
  };

  const logEntry: CombatLog = {
    tick, time,
    type: 'ability',
    sourceId: atakhanId,
    message: `아타칸 소환! (녹서스 별레벨 합: ${totalStarPower}, 공격력: ${baseDamage}, 체력: ${baseHp})`,
  };
  logs.push(logEntry);
  tickLogs.push(logEntry);

  return atakhan;
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
        if (ally.champion.traits.includes('필트오버')) {
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
        if (aliveEnemies.length === 0) break;
        const target = aliveEnemies[Math.floor(rng.next() * aliveEnemies.length)];
        const finalDmg = applyResistance(dmgPerMissile, target.stats.armor);
        target.currentHp -= finalDmg;
        target.totalDamageTaken += finalDmg;
        totalDmg += finalDmg;
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
        const rawDmg = flat + Math.round(enemy.maxHp * maxHpPct);
        const finalDmg = applyResistance(rawDmg, enemy.stats.magicResist);
        enemy.currentHp -= finalDmg;
        enemy.totalDamageTaken += finalDmg;
        totalDmg += finalDmg;
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

  const playerActiveTraits = resolveTraits(allyTeam, allTraits);
  const enemyActiveTraits = resolveTraits(enemyTeam, allTraits);

  // Bilgewater stat effects — merge into augmentEffects for bilgewater units
  const playerBWEffects = options.playerBilgewaterEffects ?? {};
  const enemyBWEffects = options.enemyBilgewaterEffects ?? {};

  const rng: SeededRNG = createRNG(seed);
  const eventBus = new EventBus();

  const playerUnits = allyTeam.map((p, i) => {
    const isBW = p.champion.traits.includes('빌지워터');
    const effects = isBW ? mergeEffects(playerAugmentEffects, playerBWEffects) : playerAugmentEffects;
    const unit = createCombatUnit(p, 'player', i, playerActiveTraits, effects);
    const mod = resolvePerUnitMods(playerAugsWithStacks, p.champion);
    applyPerUnitMods(unit, mod);
    return unit;
  });
  const enemies = enemyTeam.map((p, i) => {
    const positioned = options.skipMirror ? p : { ...p, position: mirrorPosition(p.position) };
    const isBW = p.champion.traits.includes('빌지워터');
    const effects = isBW ? mergeEffects(enemyAugmentEffects, enemyBWEffects) : enemyAugmentEffects;
    const unit = createCombatUnit(positioned, 'enemy', i, enemyActiveTraits, effects);
    const mod = resolvePerUnitMods(enemyAugsWithStacks, p.champion);
    applyPerUnitMods(unit, mod);
    return unit;
  });

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

  // Apply Warden trait shields at combat start
  applyWardenShields(playerActiveTraits, playerUnits);
  applyWardenShields(enemyActiveTraits, enemies);

  const allUnits = [...playerUnits, ...enemies];

  // Spawn Freljord turrets
  const playerTurrets = spawnFreljordTurrets(playerActiveTraits, 'player', playerUnits, allUnits, rng);
  const enemyTurrets = spawnFreljordTurrets(enemyActiveTraits, 'enemy', enemies, allUnits, rng);
  allUnits.push(...playerTurrets, ...enemyTurrets);
  playerUnits.push(...playerTurrets);
  enemies.push(...enemyTurrets);

  const logs: CombatLog[] = [];

  // 암살자 후열 점프 (전투 시작 직전)
  applyAssassinJump(playerUnits, enemies, allUnits, logs);
  applyAssassinJump(enemies, playerUnits, allUnits, logs);

  const snapshots: TickSnapshot[] = [];
  const moveTicks = getMoveTicks();

  // 녹서스 아타칸 소환 플래그
  const playerAtakhanFlag = { spawned: false };
  const enemyAtakhanFlag = { spawned: false };

  eventBus.emit('on_combat_start', { sourceId: '', tick: 0 });

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const time = +(tick * TICK_DURATION).toFixed(4);
    const tickLogs: CombatLog[] = [];
    const alivePlayers = playerUnits.filter(u => u.state !== 'dead');
    const aliveEnemies = enemies.filter(u => u.state !== 'dead');

    if (alivePlayers.length === 0 || aliveEnemies.length === 0) break;

    // 녹서스 아타칸 소환 체크 (매초)
    if (tick > 0 && tick % TICKS_PER_SECOND === 0) {
      const playerAtakhan = trySpawnNoxusAtakhan(playerActiveTraits, 'player', playerUnits, enemies, allUnits, rng, tick, time, logs, tickLogs, playerAtakhanFlag);
      if (playerAtakhan) { allUnits.push(playerAtakhan); playerUnits.push(playerAtakhan); }
      const enemyAtakhan = trySpawnNoxusAtakhan(enemyActiveTraits, 'enemy', enemies, playerUnits, allUnits, rng, tick, time, logs, tickLogs, enemyAtakhanFlag);
      if (enemyAtakhan) { allUnits.push(enemyAtakhan); enemies.push(enemyAtakhan); }
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
    applyPiltoverInvention(playerActiveTraits, playerUnits, enemies, playerModules, tick, logs, tickLogs, time, rng);
    applyPiltoverInvention(enemyActiveTraits, enemies, playerUnits, enemyModules, tick, logs, tickLogs, time, rng);

    const occupiedPositions = new Set(
      allUnits.filter(u => u.state !== 'dead').map(u => coordKey(u.position))
    );

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

      const enemyTeamAlive = unit.team === 'player' ? aliveEnemies : alivePlayers;
      const target = findTarget(unit, enemyTeamAlive, rng);
      if (!target) continue;

      unit.target = target.id;

      if (canAttack(unit.position, target.position, unit.stats.range)) {
        if (unit.attackCooldown <= 0 && canAutoAttack(unit)) {
          const attackInterval = Math.round(1 / (getEffectiveAttackSpeed(unit) * TICK_DURATION));
          unit.attackCooldown = attackInterval;

          const isCrit = rng.next() < unit.stats.critChance;
          const critMult = isCrit ? unit.stats.critMultiplier : 1;
          let totalDamageAmp = unit.damageAmp;
          if (unit.inventionTankDamageAmp > 0 && target.role === 'Tank') {
            totalDamageAmp += unit.inventionTankDamageAmp;
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

          finalDamage = applyShield(target, finalDamage, eventBus, tick);

          if (target.statusEffects.some(e => e.type === 'invulnerable')) {
            finalDamage = 0;
          }

          target.currentHp -= finalDamage;
          target.totalDamageTaken += finalDamage;
          unit.totalDamageDealt += finalDamage;

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
          eventBus.emit('on_attack', { sourceId: unit.id, targetId: target.id, value: finalDamage, tick });
          eventBus.emit('on_hit', { sourceId: unit.id, targetId: target.id, value: finalDamage, damageType: 'physical', tick });
          eventBus.emit('on_damage', { sourceId: target.id, targetId: unit.id, value: finalDamage, damageType: 'physical', tick });

          const log: CombatLog = {
            tick, time, type: 'attack',
            sourceId: unit.id, targetId: target.id,
            value: Math.round(finalDamage),
            message: `${unit.champion.name}이(가) ${target.champion.name}에게 ${Math.round(finalDamage)} 물리 피해${isCrit ? ' (크리티컬!)' : ''}`,
          };
          logs.push(log);
          tickLogs.push(log);

          if (unit.currentMana >= unit.maxMana) {
            unit.currentMana = 0;
            unit.state = 'casting';

            const { damage: abilityDmg, type: dmgType } = getAbilityDamage(
              unit.champion, unit.starLevel, unit.stats.ap
            );
            const config: AbilityConfig = CHAMPION_ABILITY_PATTERNS[unit.champion.apiName] ?? { pattern: 'single' };
            const opposingTeam = unit.team === 'player' ? enemies : playerUnits;
            const abilityTargets = findAbilityTargets(unit, target, opposingTeam, config);

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
            for (let ti = 0; ti < abilityTargets.length; ti++) {
              const t = abilityTargets[ti];
              if (t.state === 'dead') continue;

              let abilityDamageAmp = unit.damageAmp;
              if (unit.inventionTankDamageAmp > 0 && t.role === 'Tank') {
                abilityDamageAmp += unit.inventionTankDamageAmp;
              }
              let dmg = abilityDmg * (1 + abilityDamageAmp);
              if (config.damageDecay && ti > 0) {
                dmg *= Math.pow(1 - config.damageDecay, ti);
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
                const deathLog: CombatLog = {
                  tick, time, type: 'death',
                  sourceId: t.id,
                  message: `${t.champion.name} 사망! (${unit.champion.name}의 ${unit.champion.ability.name})`,
                };
                logs.push(deathLog);
                tickLogs.push(deathLog);
                eventBus.emit('on_death', { sourceId: t.id, tick });
              }
            }

            // 전체 피해량 기반 흡혈
            if (unit.omnivamp > 0 && totalAbilityDmg > 0) {
              const grievousReduction = target.augmentGrievousWounds > 0 ? (1 - target.augmentGrievousWounds) : 1;
              const heal = totalAbilityDmg * unit.omnivamp * grievousReduction;
              unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
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

    snapshots.push(captureSnapshot(tick, allUnits, tickLogs));
  }

  const alivePlayers = playerUnits.filter(u => u.state !== 'dead').length;
  const aliveEnemies = enemies.filter(u => u.state !== 'dead').length;
  const winner = alivePlayers > aliveEnemies ? 'player'
    : aliveEnemies > alivePlayers ? 'enemy' : 'draw';

  const lastLog = logs[logs.length - 1];
  const duration = lastLog ? lastLog.time : 0;

  eventBus.emit('on_combat_end', { sourceId: '', tick: MAX_TICKS, value: duration });
  eventBus.clear();

  return { winner, duration, logs, playerUnits, enemyUnits: enemies, snapshots };
}
