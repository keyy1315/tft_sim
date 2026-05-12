/**
 * Illaoi NumEnemies 다중 흡수 + AfterShock 회귀 가드 (audit P3, 2026-05-07).
 *
 * Mechanic (raw `desc` 정밀 해석):
 *   - Duration(3초) 동안 Shield 보호막 (이미 PR #105 fix)
 *   - 가장 가까운 NumEnemies(3) 명에게 HealthDrain×AP true damage 흡수
 *     (사용자 결정: Duration 전체 총량 per-target, 즉시 한 번 적용 — instant simplified)
 *   - Illaoi 본인 회복: total drain 만큼
 *   - Duration 후: 2칸 내 모든 적에게 Damage×AP magic AOE
 *
 * Helper API:
 *   - applyIllaoiCast(unit, tick, enemies, eventBus, ownArbiter, logs)
 *     → NumEnemies 명 lock + instant trueDamage + Illaoi heal + AfterShock state 등록
 *   - tickIllaoiAfterShock(unit, tick, time, enemies, eventBus, ownArbiter, logs, tickLogs)
 *     → 사망 cancel / 만료 시 2칸 magic AOE
 *
 * 변수 (sentinel filler resolved):
 *   - Shield = [250, 450, 525, 650, 775, 400, 400] non-filler (★1=250) — PR #105 fix
 *   - Duration = 3 (모든 ★)
 *   - HealthDrain = [40, 55, 85, ...] non-filler (★1=40) — true damage drain
 *   - NumEnemies = 3 (모든 ★)
 *   - Damage = [80, 80, 120, ...] non-filler (★1=80) — AOE magic
 */
import { describe, it, expect } from 'vitest';
import {
  applyIllaoiCast,
  tickIllaoiAfterShock,
} from '@/lib/simulator/engine/combatLoop';
import { TICKS_PER_SECOND } from '@/lib/simulator/models/constants';
import type { CombatUnit, RawChampion, HexCoord, AbilityVariable, CombatLog } from '@/types';
import type { EventBus } from '@/lib/simulator/events/eventBus';

const ILLAOI_VARIABLES: AbilityVariable[] = [
  { name: 'Shield',       value: [250, 450, 525, 650, 775, 400, 400] },
  { name: 'Duration',     value: [3, 3, 3, 3, 3, 3, 3] },
  { name: 'HealthDrain',  value: [40, 55, 85, 130, 175, 240, 240] },
  { name: 'NumEnemies',   value: [3, 3, 3, 3, 3, 3, 3] },
  { name: 'Damage',       value: [80, 80, 120, 180, 240, 240, 240] },
];

function makeIllaoiChampion(): RawChampion {
  return {
    name: '일라오이',
    apiName: 'TFT17_Illaoi',
    cost: 3,
    traits: ['동물특공대', '선봉대', '길잡이'],
    role: 'APTank',
    stats: {
      hp: 800, armor: 50, magicResist: 50, damage: 60,
      attackSpeed: 0.6, range: 1, critChance: 0.25, critMultiplier: 1.4,
      initialMana: 0, mana: 60,
    },
    ability: {
      name: '시험',
      desc: '@Duration@초 동안 보호막. 가장 가까운 @NumEnemies@명 흡수. 이후 2칸 magic.',
      icon: '',
      variables: ILLAOI_VARIABLES,
    },
  } as unknown as RawChampion;
}

function makeIllaoi(opts: {
  starLevel: 1 | 2 | 3;
  ap?: number;
  position?: HexCoord;
  currentHp?: number;
  maxHp?: number;
}): CombatUnit {
  return {
    id: 'illaoi',
    champion: makeIllaoiChampion(),
    team: 'player',
    position: opts.position ?? { q: 0, r: 0 },
    starLevel: opts.starLevel,
    role: 'Tank',
    state: 'idle',
    target: null,
    statusEffects: [],
    shield: 0,
    currentHp: opts.currentHp ?? 1500,
    maxHp: opts.maxHp ?? 2000,
    totalDamageDealt: 0,
    damageAmp: 0,
    damageReduction: 0,
    healAmp: 0,
    stats: {
      ap: opts.ap ?? 0,
      armor: 50, magicResist: 50,
      hp: 2000, damage: 60, attackSpeed: 0.6,
      range: 1, critChance: 0.25, critMultiplier: 1.4,
      mana: 0, maxMana: 60, armorPen: 0, magicPen: 0,
    },
    illaoiAfterShockEndTick: 0,
    illaoiAfterShockApSnapshot: 0,
    inventionTankDamageAmp: 0,
    madredsTankDamageAmp: 0,
    gravesTankDamageAmp: 0,
    sniperBaseDA: 0,
    sniperPerHexDA: 0,
  } as unknown as CombatUnit;
}

function makeEnemy(opts: {
  id: string;
  position: HexCoord;
  currentHp?: number;
  armor?: number;
  magicResist?: number;
}): CombatUnit {
  return {
    id: opts.id,
    champion: { name: '적', apiName: 'TFT17_Aatrox' } as unknown as RawChampion,
    team: 'enemy',
    position: opts.position,
    state: 'idle',
    target: null,
    statusEffects: [],
    shield: 0,
    currentHp: opts.currentHp ?? 1000,
    maxHp: opts.currentHp ?? 1000,
    totalDamageTaken: 0,
    damageReduction: 0,
    role: 'Tank',  // NON_TARGET_DAMAGE_REDUCTION 회피
    stats: {
      ap: 0, armor: opts.armor ?? 100, magicResist: opts.magicResist ?? 100,
      hp: 1000, damage: 40, attackSpeed: 0.6,
      range: 1, critChance: 0.25, critMultiplier: 1.4,
      mana: 0, maxMana: 50, armorPen: 0, magicPen: 0,
    },
    mordekaiserProcEndTick: 0,
    mordekaiserNextProcTick: 0,
    mordekaiserShieldRemaining: 0,
  } as unknown as CombatUnit;
}

const NULL_EVENT_BUS: EventBus = { emit: () => {}, on: () => {} } as unknown as EventBus;
const NULL_ARBITER = { enemyDeathCount: 0 };
const NO_LOGS: CombatLog[] = [];

describe('Illaoi — applyIllaoiCast (cast 시점 drain + state 등록)', () => {
  it('C1: ★1 AP=0 cast → NumEnemies(3) 명 trueDamage 40, AfterShock state 등록', () => {
    const illaoi = makeIllaoi({ starLevel: 1, ap: 0 });
    const e1 = makeEnemy({ id: 'e1', position: { q: 1, r: 0 } });
    const e2 = makeEnemy({ id: 'e2', position: { q: 2, r: 0 } });
    const e3 = makeEnemy({ id: 'e3', position: { q: 3, r: 0 } });

    applyIllaoiCast(illaoi, 0, [e1, e2, e3], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS);

    // 각 적: HealthDrain ★1 = 40 true damage (armor/MR 무관)
    expect(e1.currentHp).toBeCloseTo(1000 - 40, 0);
    expect(e2.currentHp).toBeCloseTo(1000 - 40, 0);
    expect(e3.currentHp).toBeCloseTo(1000 - 40, 0);
    // AfterShock state 등록 — Duration ★1 = 3초
    expect(illaoi.illaoiAfterShockEndTick).toBe(3 * TICKS_PER_SECOND);
    expect(illaoi.illaoiAfterShockApSnapshot).toBe(0);
  });

  it('C2: ★1 AP=100 cast → drain ×2.0 (★1 HealthDrain 40 → 80), heal +총량', () => {
    const illaoi = makeIllaoi({ starLevel: 1, ap: 100, currentHp: 1500, maxHp: 2000 });
    const e1 = makeEnemy({ id: 'e1', position: { q: 1, r: 0 } });
    const e2 = makeEnemy({ id: 'e2', position: { q: 2, r: 0 } });
    const e3 = makeEnemy({ id: 'e3', position: { q: 3, r: 0 } });

    applyIllaoiCast(illaoi, 0, [e1, e2, e3], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS);

    // per-target = 40 × 2 = 80
    expect(e1.currentHp).toBeCloseTo(1000 - 80, 0);
    // Illaoi heal = 3 × 80 = 240
    expect(illaoi.currentHp).toBeCloseTo(1500 + 240, 0);
    expect(illaoi.illaoiAfterShockApSnapshot).toBe(100);
  });

  it('C3: alive 적이 NumEnemies 미만 → alive 만 처리', () => {
    const illaoi = makeIllaoi({ starLevel: 1, ap: 0 });
    const e1 = makeEnemy({ id: 'e1', position: { q: 1, r: 0 } });
    const e2 = makeEnemy({ id: 'e2', position: { q: 2, r: 0 } });
    e2.state = 'dead';  // alive enemy 1명 (e1) 만 처리
    const e3 = makeEnemy({ id: 'e3', position: { q: 3, r: 0 } });

    applyIllaoiCast(illaoi, 0, [e1, e2, e3], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS);

    // alive 2명 (e1, e3) 에게만 적용
    expect(e1.currentHp).toBeCloseTo(1000 - 40, 0);
    expect(e3.currentHp).toBeCloseTo(1000 - 40, 0);
    expect(e2.currentHp).toBe(1000);  // dead 적은 skip
  });

  it('C4: 가장 가까운 NumEnemies 명 선정 (distance ASC)', () => {
    const illaoi = makeIllaoi({ starLevel: 1, ap: 0, position: { q: 0, r: 0 } });
    const close1 = makeEnemy({ id: 'close1', position: { q: 1, r: 0 } });   // 1
    const close2 = makeEnemy({ id: 'close2', position: { q: 0, r: 1 } });   // 1
    const close3 = makeEnemy({ id: 'close3', position: { q: 1, r: -1 } });  // 1
    const far    = makeEnemy({ id: 'far',    position: { q: 5, r: 0 } });   // 5

    applyIllaoiCast(illaoi, 0, [close1, close2, close3, far], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS);

    // 가장 가까운 3명 만 적용 (far 는 skip)
    expect(close1.currentHp).toBeCloseTo(1000 - 40, 0);
    expect(close2.currentHp).toBeCloseTo(1000 - 40, 0);
    expect(close3.currentHp).toBeCloseTo(1000 - 40, 0);
    expect(far.currentHp).toBe(1000);
  });
});

describe('Illaoi — tickIllaoiAfterShock (만료 시 AOE)', () => {
  it('C5: 만료 시 2칸 magic AOE — Damage ★1=80, AP snapshot=100', () => {
    const illaoi = makeIllaoi({ starLevel: 1, ap: 100, position: { q: 0, r: 0 } });
    // cast 시 enemies 없음 (drain 안 함)
    applyIllaoiCast(illaoi, 0, [], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS);

    // 만료 시점에 새 적 (2칸 내 + 2칸 밖)
    const inRange = makeEnemy({ id: 'in', position: { q: 2, r: 0 }, armor: 0, magicResist: 0 });
    const outRange = makeEnemy({ id: 'out', position: { q: 3, r: 0 }, armor: 0, magicResist: 0 });

    // tick=90 (= 3×30) 만료
    tickIllaoiAfterShock(illaoi, 3 * TICKS_PER_SECOND, 3.0, [inRange, outRange], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);

    // 2칸 내: Damage ★1=80 × AP scaling (1+1.0)=2 → 160 (armor=0, MR=0 → applyResistance ×1)
    expect(inRange.currentHp).toBeCloseTo(1000 - 160, 0);
    // 2칸 밖: 영향 없음
    expect(outRange.currentHp).toBe(1000);
    // state cleanup
    expect(illaoi.illaoiAfterShockEndTick).toBe(0);
  });

  it('C6: Illaoi 사망 시 cancel — AfterShock 미발동, state cleanup', () => {
    const illaoi = makeIllaoi({ starLevel: 1, ap: 0, position: { q: 0, r: 0 } });
    const enemy = makeEnemy({ id: 'e1', position: { q: 1, r: 0 } });

    applyIllaoiCast(illaoi, 0, [enemy], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS);
    expect(illaoi.illaoiAfterShockEndTick).toBe(3 * TICKS_PER_SECOND);

    // 사망 처리
    illaoi.currentHp = 0;
    illaoi.state = 'dead';

    // 만료 tick — 사망 → cancel
    tickIllaoiAfterShock(illaoi, 3 * TICKS_PER_SECOND, 3.0, [enemy], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);

    // AOE 미발동 — enemy 추가 damage 없음 (cast 시 1번 -40 만)
    expect(enemy.currentHp).toBeCloseTo(1000 - 40, 0);
    // state cleanup
    expect(illaoi.illaoiAfterShockEndTick).toBe(0);
  });

  it('C7: 만료 전 tick 호출 → no-op (state 유지)', () => {
    const illaoi = makeIllaoi({ starLevel: 1, ap: 0, position: { q: 0, r: 0 } });
    const enemy = makeEnemy({ id: 'e1', position: { q: 1, r: 0 } });

    applyIllaoiCast(illaoi, 0, [enemy], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS);
    // tick=60 (2초) — 아직 만료 안 됨
    tickIllaoiAfterShock(illaoi, 2 * TICKS_PER_SECOND, 2.0, [enemy], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);

    // enemy 변화 없음 (cast drain 외)
    expect(enemy.currentHp).toBeCloseTo(1000 - 40, 0);
    // state 유지
    expect(illaoi.illaoiAfterShockEndTick).toBe(3 * TICKS_PER_SECOND);
  });
});
