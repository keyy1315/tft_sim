/**
 * Mordekaiser proc 시스템 회귀 가드.
 *
 * Phase 2 가 추가한 helper:
 *   src/lib/simulator/engine/combatLoop.ts
 *     - applyMordekaiserProcCast(unit, tick) — InitialShield → 별도 pool + state 등록
 *     - tickMordekaiserProc(unit, tick, time, enemies, eventBus, arbiter, logs, _tickLogs)
 * 의 동작을 helper 단위로 검증한다 (full simulation 우회).
 *
 * 검증 대상:
 *   - C1/C2: ★별 InitialShield × AP scaling (별도 pool 검증 — unit.shield 미변화)
 *   - C3: 펄스 1회 — 1칸 적 damage + 본인 shield gain
 *   - C4: 4 펄스 누적 (t=1/2/3/4) — t=4 에서 펄스 + 만료 동시 처리
 *   - C5: 만료 시 HealRefund — 잔여 × 0.4 → currentHp 회복
 *   - C6: 사망 시 cancel — state cleanup, HealRefund 미발동
 *   - C7: 별도 pool 검증 — applyMordekaiserProcCast 후 unit.shield 변화 없음
 *
 * Sentinel filler 회귀: InitialShield raw[0]=0 → ★1=300 자동 (readVarByStar).
 * 결정론 + 순수 함수: full simulateCombat 우회, seed 불필요.
 */
import { describe, it, expect } from 'vitest';
import {
  applyMordekaiserProcCast,
  tickMordekaiserProc,
} from '@/lib/simulator/engine/combatLoop';
import { TICKS_PER_SECOND } from '@/lib/simulator/models/constants';
import type { CombatUnit, RawChampion, HexCoord, AbilityVariable, CombatLog } from '@/types';
import type { EventBus } from '@/lib/simulator/events/eventBus';

/* ──────────────── Fixture helpers ──────────────── */

/**
 * 실제 ability variables — sentinel filler 적용 (InitialShield/ShieldPerProc/DamagePerProc).
 * readVarByStar 가 raw[0]=0 → ★1=index 1, ★2=index 2 처럼 처리한다고 가정.
 */
const MORDEKAISER_ABILITY_VARIABLES: AbilityVariable[] = [
  { name: 'InitialShield', value: [0, 300, 375, 500, 650, 200, 240] },  // sentinel filler (★1=300)
  { name: 'ShieldPerProc', value: [0, 75, 90, 105, 120, 0, 0] },        // sentinel filler (★1=75)
  { name: 'DamagePerProc', value: [0, 45, 70, 100, 170, 0, 0] },        // sentinel filler (★1=45)
  { name: 'HealRefund',    value: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4] },
  { name: 'Duration',      value: [4, 4, 4, 4, 4, 4, 4] },
];

function makeMordekaiserChampion(): RawChampion {
  return {
    name: '모데카이저',
    apiName: 'TFT17_Mordekaiser',
    cost: 2,
    traits: [],
    role: 'Tank',
    stats: {
      hp: 800, armor: 50, magicResist: 50, damage: 55,
      attackSpeed: 0.65, range: 1, critChance: 0.25, critMultiplier: 1.4,
      initialMana: 30, mana: 60,
    },
    ability: {
      name: '검은 일격',
      desc: '',
      icon: '',
      variables: MORDEKAISER_ABILITY_VARIABLES,
    },
  } as unknown as RawChampion;
}

/**
 * 최소 Mordekaiser CombatUnit — helper 가 실제 읽는 필드만 채움.
 * mordekaiser proc 3 typed 필드 + base stats + currentHp/maxHp/healAmp/damageAmp.
 */
function makeMordekaiser(opts: {
  starLevel: 1 | 2 | 3;
  ap?: number;
  position?: HexCoord;
  id?: string;
  currentHp?: number;
  maxHp?: number;
}): CombatUnit {
  return {
    id: opts.id ?? 'morde',
    champion: makeMordekaiserChampion(),
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
      hp: 2000, damage: 55, attackSpeed: 0.65,
      range: 1, critChance: 0.25, critMultiplier: 1.4,
      mana: 0, maxMana: 60, armorPen: 0, magicPen: 0,
    },
    mordekaiserProcEndTick: 0,
    mordekaiserNextProcTick: 0,
    mordekaiserShieldRemaining: 0,
    // PR #124 추가 필드 — raw Mordekaiser test 라 null (MordekaiserCarry 비활성).
    // applyMordekaiserProcCast 가 carry override 검사 시 raw InitialShield fallback 진입.
    mordekaiserCarryShield: null,
    // codex P2 PR #103: pulse 의 per-target amp 계산에 사용되는 필드 (0 default).
    inventionTankDamageAmp: 0,
    madredsTankDamageAmp: 0,
    gravesTankDamageAmp: 0,
    sniperBaseDA: 0,
    sniperPerHexDA: 0,
  } as unknown as CombatUnit;
}

/**
 * 최소 enemy CombatUnit — applyAbilityMitigation 가 읽는 필드만 채움.
 * role='Tank' 로 NON_TARGET_DAMAGE_REDUCTION 회피 (Fighter/Assassin 만 적용).
 * armor=0, MR=0 → applyResistance × 1 (mitigation 없음).
 */
function makeEnemy(opts: {
  id: string;
  position: HexCoord;
  currentHp?: number;
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
      ap: 0, armor: 0, magicResist: 0,
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

/* ──────────────── Tests ──────────────── */

describe('TFT17_Mordekaiser — applyMordekaiserProcCast (cast 시점)', () => {
  it('C1: ★1 AP=0 cast → InitialShield 300 별도 pool, unit.shield 변화 없음', () => {
    const morde = makeMordekaiser({ starLevel: 1, ap: 0 });
    const initialUnitShield = morde.shield;
    applyMordekaiserProcCast(morde, 0);

    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(300, 0);
    expect(morde.shield).toBe(initialUnitShield);  // 별도 pool — unit.shield 미변화
    expect(morde.mordekaiserProcEndTick).toBe(4 * TICKS_PER_SECOND);  // 4s × tps
    expect(morde.mordekaiserNextProcTick).toBe(TICKS_PER_SECOND);  // 첫 펄스 t=1
  });

  it('C2: ★2 AP=100 cast → InitialShield 375 × 2.0 = 750', () => {
    const morde = makeMordekaiser({ starLevel: 2, ap: 100 });
    applyMordekaiserProcCast(morde, 0);

    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(750, 0);
  });
});

describe('TFT17_Mordekaiser — tickMordekaiserProc (펄스 + 만료)', () => {
  it('C3: 펄스 1회 — 1칸 적 damage 45 + 본인 shield +75', () => {
    const morde = makeMordekaiser({ starLevel: 1, ap: 0, position: { q: 0, r: 0 } });
    const enemy = makeEnemy({ id: 'e1', position: { q: 1, r: 0 }, currentHp: 1000 });

    applyMordekaiserProcCast(morde, 0);
    tickMordekaiserProc(morde, TICKS_PER_SECOND, 1.0, [enemy], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);

    // 적 damage: ★1 DamagePerProc=45, mitigation 없음 (armor=0, MR=0, role='Tank')
    expect(enemy.currentHp).toBeCloseTo(1000 - 45, 0);
    // Mordekaiser shield: 300 (Initial) + 75 (펄스) = 375
    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(375, 0);
    // 다음 펄스 t=2
    expect(morde.mordekaiserNextProcTick).toBe(2 * TICKS_PER_SECOND);
  });

  it('C4: 4 펄스 누적 — t=4 에서 펄스 + 만료 동시. 적 dmg 180, shield 0 (만료 후)', () => {
    const morde = makeMordekaiser({ starLevel: 1, ap: 0, position: { q: 0, r: 0 }, currentHp: 2000, maxHp: 2000 });
    const enemy = makeEnemy({ id: 'e1', position: { q: 1, r: 0 }, currentHp: 1000 });

    applyMordekaiserProcCast(morde, 0);
    // t=1/2/3/4 진행 — t=4 펄스 4번째 + 만료 (HealRefund) 동시
    for (let t = 1; t <= 4; t++) {
      tickMordekaiserProc(morde, t * TICKS_PER_SECOND, t * 1.0, [enemy], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);
    }

    // 4 펄스 × 45 = 180 누적 damage
    expect(enemy.currentHp).toBeCloseTo(1000 - 4 * 45, 0);
    // 만료 후 state cleanup: shield 0 (HealRefund 후 reset)
    expect(morde.mordekaiserShieldRemaining).toBe(0);
    expect(morde.mordekaiserProcEndTick).toBe(0);
    expect(morde.mordekaiserNextProcTick).toBe(0);
  });

  it('C5: 만료 시 HealRefund — 잔여 600 × 0.4 = 240 → currentHp +240', () => {
    const morde = makeMordekaiser({ starLevel: 1, ap: 0, position: { q: 0, r: 0 }, currentHp: 1500, maxHp: 2000 });
    const enemies: CombatUnit[] = [];  // 적 없음 → 펄스 발동되지만 damage 없음 (loop skip)

    applyMordekaiserProcCast(morde, 0);
    // 펄스 t=1/2/3/4 (4 × 75 = 300 추가). cast 시 Initial 300 → 누적 600.
    // t=4 에서 펄스 + 만료 동시: shield += 75 (600), 만료 시 HealRefund = 600 × 0.4 = 240.
    for (let t = 1; t <= 4; t++) {
      tickMordekaiserProc(morde, t * TICKS_PER_SECOND, t * 1.0, enemies, NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);
    }

    // currentHp 1500 + 240 = 1740 (maxHp=2000 미만 — clamp 영향 없음)
    expect(morde.currentHp).toBeCloseTo(1500 + 240, 0);
    expect(morde.mordekaiserShieldRemaining).toBe(0);
    expect(morde.mordekaiserProcEndTick).toBe(0);
  });

  it('C6: 사망 시 cancel — state cleanup, HealRefund 미발동', () => {
    const morde = makeMordekaiser({ starLevel: 1, ap: 0, position: { q: 0, r: 0 }, currentHp: 1500 });
    const enemies: CombatUnit[] = [];

    applyMordekaiserProcCast(morde, 0);
    // 펄스 1회 발동 (t=1) — shield 누적 375
    tickMordekaiserProc(morde, TICKS_PER_SECOND, 1.0, enemies, NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);
    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(375, 0);

    // 외부 시스템이 사망 처리 — state='dead' + currentHp=0
    morde.currentHp = 0;
    morde.state = 'dead';

    // 다음 tick 호출 → 사망 cancel branch — 3 필드 0 reset, heal 미발동
    tickMordekaiserProc(morde, 2 * TICKS_PER_SECOND, 2.0, enemies, NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);

    expect(morde.mordekaiserProcEndTick).toBe(0);
    expect(morde.mordekaiserNextProcTick).toBe(0);
    expect(morde.mordekaiserShieldRemaining).toBe(0);
    expect(morde.currentHp).toBe(0);  // heal 안 들어감
  });

  it('C7: applyMordekaiserProcCast 가 unit.shield (general pool) 안 건드림 — 별도 pool 검증', () => {
    // 시너지/아이템 shield (예: 가시 갑옷) 가 unit.shield = 200 인 상태에서 Mordekaiser cast.
    // Mordekaiser pool 만 변화, general unit.shield 그대로 유지되어야 함.
    // (integration test 에서 applyShield priority 도 자동 검증 — Mordekaiser pool 먼저 흡수.)
    const morde = makeMordekaiser({ starLevel: 1, ap: 0 });
    morde.shield = 200;

    applyMordekaiserProcCast(morde, 0);

    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(300, 0);
    expect(morde.shield).toBe(200);  // 별도 pool — 시너지/아이템 shield 무변화
  });

  it('C8: per-target tank amp — madredsTankDamageAmp 0.15 + enemy.role=Tank → dmg ×1.15 (codex P2 PR #103)', () => {
    // codex P2 fix: pulse damage 가 target 별 tank amp 적용. Vex 그림자 / 주공격 패턴 동일.
    // ★1 base DamagePerProc=45, madredsTankDamageAmp=0.15 → 45 × 1.15 = 51.75.
    const morde = makeMordekaiser({ starLevel: 1, ap: 0, position: { q: 0, r: 0 } });
    (morde as unknown as { madredsTankDamageAmp: number }).madredsTankDamageAmp = 0.15;
    const tankEnemy = makeEnemy({ id: 'tank', position: { q: 1, r: 0 }, currentHp: 1000 });

    applyMordekaiserProcCast(morde, 0);
    tickMordekaiserProc(morde, TICKS_PER_SECOND, 1.0, [tankEnemy], NULL_EVENT_BUS, NULL_ARBITER, NO_LOGS, []);

    // 45 × (1 + 0.15) = 51.75. enemy.role='Tank' 이므로 amp 적용.
    expect(tankEnemy.currentHp).toBeCloseTo(1000 - 51.75, 1);
  });
});
