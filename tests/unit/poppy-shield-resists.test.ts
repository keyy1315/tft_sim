/**
 * Poppy `applyPoppyShieldAndResists` 회귀 가드 (Phase C — opponent carries audit).
 *
 * Phase B 가 추가한 helper:
 *   src/lib/simulator/engine/combatLoop.ts → applyPoppyShieldAndResists(unit, allies)
 * 의 동작을 직접 검증한다 (full simulation 우회).
 *
 * 검증 대상:
 *   - ★별 Shield 값 (raw [300, 400, 475, 575, 675, 390, 390], non-filler)
 *   - ★별 Resists 값 (raw [36, 15, 25, 60, 100, 36, 36], **sentinel filler** — readVarByStar 가 v0 > v1 로 판정)
 *   - AP scaling (× (1 + ap/100))
 *   - 2 hex radius ally Resists buff
 *   - 자기 자신 / dead ally / radius 초과 ally 스킵
 *
 * 결정론 + 순수 함수: full simulateCombat 가 아니므로 seed 불필요.
 */
import { describe, it, expect } from 'vitest';
import { applyPoppyShieldAndResists } from '@/lib/simulator/engine/combatLoop';
import type { CombatUnit, RawChampion, HexCoord, AbilityVariable } from '@/types';

/* ──────────────── Fixture helpers ──────────────── */

/**
 * 실제 데이터(public/data/tft_set17_champions.json) 의 Poppy ability variables 을 fixture 화.
 * filler 분류 검증 일관성을 위해 raw value 그대로 사용.
 */
const POPPY_ABILITY_VARIABLES: AbilityVariable[] = [
  { name: 'Shield',         value: [300, 400, 475, 575, 675, 390, 390] }, // non-filler (★1=300)
  { name: 'ShieldDuration', value: [4, 4, 4, 4, 4, 4, 4] },               // 모두 4
  { name: 'Resists',        value: [36, 15, 25, 60, 100, 36, 36] },       // **sentinel filler** (★1=15)
];

function makePoppyChampion(): RawChampion {
  return {
    name: '뽀삐',
    apiName: 'TFT17_Poppy',
    cost: 1,
    traits: ['정령족', '요새'],
    role: 'APTank',
    stats: {
      hp: 700, armor: 45, magicResist: 45, damage: 60,
      attackSpeed: 0.65, range: 1, critChance: 0.25, critMultiplier: 1.4,
      initialMana: 30, mana: 100,
    },
    ability: {
      name: '다들 모여!',
      desc: '',
      icon: '',
      variables: POPPY_ABILITY_VARIABLES,
    },
  };
}

/**
 * 최소 CombatUnit 생성 — applyPoppyShieldAndResists 가 실제로 읽는 필드만 채움.
 * helper 가 참조하는 필드:
 *   - id, position, state, starLevel, champion, statusEffects, shield, stats.ap, stats.armor, stats.magicResist
 * 그 외 필드는 `as unknown as CombatUnit` 캐스팅으로 우회.
 */
function makePoppy(opts: {
  starLevel: 1 | 2 | 3;
  ap?: number;
  position?: HexCoord;
  id?: string;
}): CombatUnit {
  return {
    id: opts.id ?? 'poppy',
    champion: makePoppyChampion(),
    team: 'player',
    position: opts.position ?? { q: 0, r: 0 },
    starLevel: opts.starLevel,
    role: 'Tank',
    state: 'idle',
    statusEffects: [],
    shield: 0,
    stats: {
      ap: opts.ap ?? 0,
      armor: 45, magicResist: 45,
      hp: 700, damage: 60, attackSpeed: 0.65,
      range: 1, critChance: 0.25, critMultiplier: 1.4,
      mana: 0, maxMana: 100, armorPen: 0, magicPen: 0,
    },
  } as unknown as CombatUnit;
}

/**
 * 최소 ally CombatUnit. armor / magicResist / state / position 만 의미 있음.
 */
function makeAlly(opts: {
  id: string;
  position: HexCoord;
  state?: 'idle' | 'dead';
  armor?: number;
  magicResist?: number;
}): CombatUnit {
  return {
    id: opts.id,
    team: 'player',
    position: opts.position,
    state: opts.state ?? 'idle',
    statusEffects: [],
    shield: 0,
    stats: {
      ap: 0, armor: opts.armor ?? 30, magicResist: opts.magicResist ?? 30,
      hp: 500, damage: 50, attackSpeed: 0.7,
      range: 1, critChance: 0.25, critMultiplier: 1.4,
      mana: 0, maxMana: 100, armorPen: 0, magicPen: 0,
    },
  } as unknown as CombatUnit;
}

/* ──────────────── Tests ──────────────── */

describe('applyPoppyShieldAndResists — Shield AP scaling', () => {
  it('C1: ★1 Poppy AP=0 → self shield 300, statusEffect type=shield, remainingTicks > 0', () => {
    const poppy = makePoppy({ starLevel: 1, ap: 0 });
    applyPoppyShieldAndResists(poppy, []);

    const shieldFx = poppy.statusEffects.find(e => e.type === 'shield' && e.sourceId === 'poppy-shield');
    expect(shieldFx).toBeDefined();
    expect(shieldFx!.value).toBeCloseTo(300, 0);
    expect(shieldFx!.remainingTicks).toBeGreaterThan(0);
    // ShieldDuration=4초 × TICKS_PER_SECOND=30 = 120 tick
    expect(shieldFx!.remainingTicks).toBe(120);
    expect(poppy.shield).toBeCloseTo(300, 0);
  });

  it('C2: ★2 Poppy AP=100 → self shield 800 (400 × 2.0)', () => {
    const poppy = makePoppy({ starLevel: 2, ap: 100 });
    applyPoppyShieldAndResists(poppy, []);

    const shieldFx = poppy.statusEffects.find(e => e.type === 'shield' && e.sourceId === 'poppy-shield');
    expect(shieldFx).toBeDefined();
    expect(shieldFx!.value).toBeCloseTo(800, 0);
    expect(poppy.shield).toBeCloseTo(800, 0);
  });

  it('C3: ★3 Poppy AP=50 → self shield 712.5 (475 × 1.5)', () => {
    const poppy = makePoppy({ starLevel: 3, ap: 50 });
    applyPoppyShieldAndResists(poppy, []);

    const shieldFx = poppy.statusEffects.find(e => e.type === 'shield' && e.sourceId === 'poppy-shield');
    expect(shieldFx).toBeDefined();
    expect(shieldFx!.value).toBeCloseTo(712.5, 0);
    expect(poppy.shield).toBeCloseTo(712.5, 0);
  });
});

describe('applyPoppyShieldAndResists — ally Resists buff (2 hex radius)', () => {
  it('C4: ★3 Poppy AP=0 + 2칸 내 아군 2명 → 각 ally armor +60, MR +60, resists-buff statusEffect', () => {
    const poppy = makePoppy({ starLevel: 3, ap: 0, position: { q: 0, r: 0 } });
    const allyA = makeAlly({ id: 'ally-a', position: { q: 1, r: 0 }, armor: 30, magicResist: 30 }); // hex dist = 1
    const allyB = makeAlly({ id: 'ally-b', position: { q: 0, r: 2 }, armor: 30, magicResist: 30 }); // hex dist = 2

    applyPoppyShieldAndResists(poppy, [poppy, allyA, allyB]);

    // ★3 Resists raw[3] = 60, AP=0 → +60 to armor & MR
    expect(allyA.stats.armor).toBeCloseTo(90, 0);  // 30 + 60
    expect(allyA.stats.magicResist).toBeCloseTo(90, 0);
    expect(allyB.stats.armor).toBeCloseTo(90, 0);
    expect(allyB.stats.magicResist).toBeCloseTo(90, 0);

    // 각 ally 에 resists-buff statusEffect 존재 + value 60
    const allyABuff = allyA.statusEffects.find(e => e.type === 'resists-buff' && e.sourceId === 'poppy-resists');
    const allyBBuff = allyB.statusEffects.find(e => e.type === 'resists-buff' && e.sourceId === 'poppy-resists');
    expect(allyABuff).toBeDefined();
    expect(allyABuff!.value).toBeCloseTo(60, 0);
    expect(allyABuff!.remainingTicks).toBe(120);
    expect(allyBBuff).toBeDefined();
    expect(allyBBuff!.value).toBeCloseTo(60, 0);

    // poppy 자신은 resists-buff 받지 않음 (skip self)
    const poppyBuff = poppy.statusEffects.find(e => e.type === 'resists-buff');
    expect(poppyBuff).toBeUndefined();
  });

  it('C5: ★3 Poppy AP=0 + 3칸 떨어진 ally → ally 미버프 (armor/MR 변동 없음, statusEffect 없음)', () => {
    const poppy = makePoppy({ starLevel: 3, ap: 0, position: { q: 0, r: 0 } });
    const farAlly = makeAlly({ id: 'ally-far', position: { q: 0, r: 3 }, armor: 30, magicResist: 30 }); // hex dist = 3 > 2

    applyPoppyShieldAndResists(poppy, [poppy, farAlly]);

    expect(farAlly.stats.armor).toBe(30);            // unchanged
    expect(farAlly.stats.magicResist).toBe(30);      // unchanged
    const buff = farAlly.statusEffects.find(e => e.type === 'resists-buff');
    expect(buff).toBeUndefined();
  });
});

describe('applyPoppyShieldAndResists — Resists sentinel filler 회귀 가드', () => {
  it('C6: ★1 Poppy AP=0 → ally Resists 베이스 = 15 (raw[0]=36 sentinel 무시), armor +15', () => {
    // 핵심 회귀 시나리오: Resists raw [36, 15, 25, ...]
    //   v0=36, v1=15 → v0 > v1 → readVarByStar isFiller=true → ★1 = idx 1 = 15.
    //   만약 filler 판정이 깨지면 raw[0]=36 이 ★1 base 로 잘못 사용됨 → ally armor +36 (회귀!).
    const poppy = makePoppy({ starLevel: 1, ap: 0, position: { q: 0, r: 0 } });
    const ally = makeAlly({ id: 'ally', position: { q: 1, r: 0 }, armor: 30, magicResist: 30 });

    applyPoppyShieldAndResists(poppy, [poppy, ally]);

    // ★1 Resists 정확히 15. raw[0]=36 sentinel 사용 시 30+36=66 으로 폭증 — 본 가드가 catch.
    expect(ally.stats.armor).toBeCloseTo(45, 0);      // 30 + 15
    expect(ally.stats.magicResist).toBeCloseTo(45, 0);
    expect(ally.stats.armor).not.toBe(66);            // 회귀 방지 explicit assertion

    const buff = ally.statusEffects.find(e => e.type === 'resists-buff');
    expect(buff).toBeDefined();
    expect(buff!.value).toBeCloseTo(15, 0);
  });
});
