import {
  CombatUnit, CombatResult, CombatLog, PlacedChampion,
  HexCoord, TickSnapshot, mapGameRole,
  RawTrait, RawAugment, ActiveTrait, ItemEffect,
} from '@/types';
import { calculateStats } from '@/lib/simulator/systems/stat';
import { getAbilityDamage } from '@/lib/simulator/systems/ability';
import { canAttack, getMoveTicks, findBestMoveToward, coordKey } from '@/lib/simulator/systems/movement';
import { TICK_DURATION, MAX_TICKS } from '@/lib/simulator/models/constants';
import { createRNG, SeededRNG } from '@/lib/simulator/engine/rng';
import { captureSnapshot } from '@/lib/simulator/engine/replayEngine';
import { findTarget } from '@/lib/simulator/systems/targeting';
import { gainManaOnAttack, gainManaPerTick, gainManaOnDamageTaken } from '@/lib/simulator/systems/mana';
import { EventBus } from '@/lib/simulator/events/eventBus';
import { ROLE_OMNIVAMP } from '@/lib/simulator/models/unit';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { resolveAugmentEffects } from '@/lib/simulator/systems/augment';

export interface SimulateOptions {
  seed?: number;
  allTraits?: RawTrait[];
  playerAugments?: RawAugment[];
  enemyAugments?: RawAugment[];
  /** When true, enemy positions are used as-is (no mirror). Use when positions are already in 8-row space. */
  skipMirror?: boolean;
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
    shield: 0,
  };
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

function tickStatusEffects(unit: CombatUnit): void {
  for (const effect of unit.statusEffects) {
    effect.remainingTicks--;
    if (effect.type === 'burn' && effect.value) {
      unit.currentHp -= effect.value;
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
  rng: SeededRNG,
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
            shield: 0,
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

/** Apply Piltover invention effects at specified tick */
function applyPiltoverInvention(
  activeTraits: ActiveTrait[],
  teamUnits: CombatUnit[],
  tick: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  time: number,
): void {
  const piltover = activeTraits.find(t => t.trait.apiName === 'TFT16_Piltover' && t.activeEffect);
  if (!piltover || !piltover.activeEffect) return;

  const fireTime = (piltover.activeEffect.variables['InventionFireTime'] ?? 5) as number;
  const fireTick = Math.round(fireTime / TICK_DURATION);
  if (tick !== fireTick) return;

  for (const unit of teamUnits) {
    if (unit.state === 'dead') continue;
    // Check if unit has a Piltover item
    for (const item of unit.items) {
      if (!item.apiName.includes('TFT16_Item_Piltover_')) continue;

      if (item.apiName.includes('VoltageConduit')) {
        // Reduce max mana by 30%
        unit.maxMana = Math.round(unit.maxMana * 0.7);
      } else if (item.apiName.includes('MicroRockets')) {
        // Deal flat damage to target
        const rocketDmg = 200;
        const log: CombatLog = {
          tick, time, type: 'ability',
          sourceId: unit.id,
          value: rocketDmg,
          message: `${unit.champion.name}의 마이크로 로켓 발동! ${rocketDmg} 마법 피해`,
        };
        logs.push(log);
        tickLogs.push(log);
      } else if (item.apiName.includes('KineticBarrier')) {
        // Grant shield
        const shieldAmount = unit.maxHp * 0.25;
        unit.shield += shieldAmount;
        unit.statusEffects.push({ type: 'shield', sourceId: unit.id, remainingTicks: 300, value: shieldAmount });
        const log: CombatLog = {
          tick, time, type: 'ability',
          sourceId: unit.id,
          value: Math.round(shieldAmount),
          message: `${unit.champion.name}의 역장 방벽 발동! ${Math.round(shieldAmount)} 보호막`,
        };
        logs.push(log);
        tickLogs.push(log);
      }
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
  const playerAugmentEffects = resolveAugmentEffects(options.playerAugments ?? []);
  const enemyAugmentEffects = resolveAugmentEffects(options.enemyAugments ?? []);

  const playerActiveTraits = resolveTraits(allyTeam, allTraits);
  const enemyActiveTraits = resolveTraits(enemyTeam, allTraits);

  const rng: SeededRNG = createRNG(seed);
  const eventBus = new EventBus();

  const playerUnits = allyTeam.map((p, i) => createCombatUnit(p, 'player', i, playerActiveTraits, playerAugmentEffects));
  const enemies = enemyTeam.map((p, i) => {
    const positioned = options.skipMirror ? p : { ...p, position: mirrorPosition(p.position) };
    return createCombatUnit(positioned, 'enemy', i, enemyActiveTraits, enemyAugmentEffects);
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

  const allUnits = [...playerUnits, ...enemies];

  // Spawn Freljord turrets
  const playerTurrets = spawnFreljordTurrets(playerActiveTraits, 'player', playerUnits, allUnits, rng);
  const enemyTurrets = spawnFreljordTurrets(enemyActiveTraits, 'enemy', enemies, allUnits, rng);
  allUnits.push(...playerTurrets, ...enemyTurrets);
  playerUnits.push(...playerTurrets);
  enemies.push(...enemyTurrets);

  const logs: CombatLog[] = [];
  const snapshots: TickSnapshot[] = [];
  const moveTicks = getMoveTicks();

  eventBus.emit('on_combat_start', { sourceId: '', tick: 0 });

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const time = +(tick * TICK_DURATION).toFixed(4);
    const tickLogs: CombatLog[] = [];
    const alivePlayers = playerUnits.filter(u => u.state !== 'dead');
    const aliveEnemies = enemies.filter(u => u.state !== 'dead');

    if (alivePlayers.length === 0 || aliveEnemies.length === 0) break;

    // Piltover invention trigger
    applyPiltoverInvention(playerActiveTraits, playerUnits, tick, logs, tickLogs, time);
    applyPiltoverInvention(enemyActiveTraits, enemies, tick, logs, tickLogs, time);

    const occupiedPositions = new Set(
      allUnits.filter(u => u.state !== 'dead').map(u => coordKey(u.position))
    );

    for (const unit of allUnits) {
      if (unit.state === 'dead') continue;

      tickStatusEffects(unit);
      gainManaPerTick(unit, TICK_DURATION);

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
          const rawDamage = unit.stats.damage * critMult;
          let finalDamage = applyResistance(rawDamage, target.stats.armor, unit.stats.armorPen);

          finalDamage = applyShield(target, finalDamage, eventBus, tick);

          if (target.statusEffects.some(e => e.type === 'invulnerable')) {
            finalDamage = 0;
          }

          target.currentHp -= finalDamage;
          target.totalDamageTaken += finalDamage;
          unit.totalDamageDealt += finalDamage;

          if (unit.omnivamp > 0 && finalDamage > 0) {
            const heal = finalDamage * unit.omnivamp;
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
            eventBus.emit('on_heal', { sourceId: unit.id, value: heal, tick });
          }

          gainManaOnAttack(unit);
          gainManaOnDamageTaken(target, finalDamage);

          unit.state = 'attacking';
          eventBus.emit('on_attack', { sourceId: unit.id, targetId: target.id, value: finalDamage, tick });
          eventBus.emit('on_hit', { sourceId: unit.id, targetId: target.id, value: finalDamage, damageType: 'physical', tick });
          eventBus.emit('on_damage', { sourceId: target.id, targetId: unit.id, value: finalDamage, damageType: 'physical', tick });

          const { r, q } = unit.position;
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
            const { damage: abilityDmg, type: dmgType } = getAbilityDamage(
              unit.champion, unit.starLevel, unit.stats.ap
            );
            const resistance = dmgType === 'magic' ? target.stats.magicResist
              : dmgType === 'physical' ? target.stats.armor : 0;
            const pen = dmgType === 'magic' ? unit.stats.magicPen
              : dmgType === 'physical' ? unit.stats.armorPen : 0;
            let effectiveAbilityDmg = applyResistance(abilityDmg, resistance, pen);

            effectiveAbilityDmg = applyShield(target, effectiveAbilityDmg, eventBus, tick);

            if (target.statusEffects.some(e => e.type === 'invulnerable')) {
              effectiveAbilityDmg = 0;
            }

            target.currentHp -= effectiveAbilityDmg;
            target.totalDamageTaken += effectiveAbilityDmg;
            unit.totalDamageDealt += effectiveAbilityDmg;

            if (unit.omnivamp > 0 && effectiveAbilityDmg > 0) {
              const heal = effectiveAbilityDmg * unit.omnivamp;
              unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
            }

            unit.state = 'casting';
            eventBus.emit('on_cast', { sourceId: unit.id, targetId: target.id, value: effectiveAbilityDmg, tick });

            const abilityLog: CombatLog = {
              tick, time, type: 'ability',
              sourceId: unit.id, targetId: target.id,
              value: Math.round(effectiveAbilityDmg),
              message: `${unit.champion.name}이(가) ${unit.champion.ability.name} 시전! ${target.champion.name}에게 ${Math.round(effectiveAbilityDmg)} ${dmgType === 'magic' ? '마법' : dmgType === 'physical' ? '물리' : '트루'} 피해`,
            };
            logs.push(abilityLog);
            tickLogs.push(abilityLog);
          }

          if (target.currentHp <= 0) {
            target.state = 'dead';
            target.currentHp = 0;
            eventBus.emit('on_kill', { sourceId: unit.id, targetId: target.id, tick });
            eventBus.emit('on_death', { sourceId: target.id, targetId: unit.id, tick });
            const deathLog: CombatLog = {
              tick, time, type: 'death',
              sourceId: target.id,
              message: `${target.champion.name} 사망!`,
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
