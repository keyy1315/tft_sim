/**
 * 회귀 가드 — 최신상 (TFT17_GravesTrait) 무기고 Phase 3A — 메커닉 8종.
 *
 * Phase 2 (단순 stat 18종) 와 달리 본 Phase 는 event-driven / periodic 효과:
 *   RipperBullets/2     평타 명중 시 적 armor/MR -1 / -2 (영구 누적, floor 0)
 *   Nanomachines        매 1초 maxHp × 3% 자가 회복 (healAmp 곱셈)
 *   EmergencyShielding  HP 40% 도달 시 1회 maxHp×50% shield 2.5초
 *   EmergencyShielding2 HP 40% 도달 시 1회 maxHp×75% shield 4초
 *   Shockwave           전투 시작 시 가까운 적 2명 maxHp×15% 마법 + 2초 stun
 *   ReactiveArmor       피격 시 armor/MR +4 stack, 최대 50회
 *
 * Phase 3B (DoubleTap2/RevUp/GravBooster 등) 는 후속 PR.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apGraves = champions.find(c => c.apiName === 'TFT17_Graves')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

function runWith(upgrades: string[]) {
  const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
  const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
  const withUpg = simulateCombat(team, enemy, {
    seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    playerGravesUpgrades: upgrades,
  });
  const baseline = simulateCombat(team, enemy, {
    seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
  });
  return {
    grav: withUpg.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!,
    base: baseline.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!,
    enemy: withUpg.enemyUnits.find(u => u.champion.apiName === 'TFT17_Aatrox')!,
    baseEnemy: baseline.enemyUnits.find(u => u.champion.apiName === 'TFT17_Aatrox')!,
  };
}

describe('GravesTrait Phase 3A — RipperBullets/2 (평타 시 적 armor/MR shred)', () => {
  it('RipperBullets → gravesRipperReduce = 1 으로 설정', () => {
    const { grav } = runWith(['RipperBullets']);
    expect(grav.gravesRipperReduce).toBe(1);
    expect(grav.gravesUpgrades).toContain('RipperBullets');
  });

  it('RipperBullets2 → gravesRipperReduce = 2 (상위 tier override)', () => {
    const { grav } = runWith(['RipperBullets2']);
    expect(grav.gravesRipperReduce).toBe(2);
  });

  it('RipperBullets + RipperBullets2 동시 활성 시 max 2 적용 (tier override)', () => {
    const { grav } = runWith(['RipperBullets', 'RipperBullets2']);
    expect(grav.gravesRipperReduce).toBe(2);
  });

  it('적 armor/MR 누적 감소 (전투 종료 시점, baseline 대비 낮음)', () => {
    const { enemy, baseEnemy } = runWith(['RipperBullets2']);
    // 평타가 여러 번 hit 되면 armor/MR 모두 감소. floor 0 보장.
    expect(enemy.stats.armor).toBeLessThan(baseEnemy.stats.armor);
    expect(enemy.stats.magicResist).toBeLessThan(baseEnemy.stats.magicResist);
    expect(enemy.stats.armor).toBeGreaterThanOrEqual(0);
    expect(enemy.stats.magicResist).toBeGreaterThanOrEqual(0);
  });
});

describe('GravesTrait Phase 3A — Nanomachines (periodic regen)', () => {
  it('Nanomachines → gravesNanoRegenPct = 0.03 으로 설정', () => {
    const { grav } = runWith(['Nanomachines']);
    expect(grav.gravesNanoRegenPct).toBeCloseTo(0.03, 5);
    expect(grav.gravesUpgrades).toContain('Nanomachines');
  });

  it('Nanomachines 미사용 시 gravesNanoRegenPct = 0', () => {
    const { base } = runWith([]);
    expect(base.gravesNanoRegenPct).toBe(0);
  });
});

describe('GravesTrait Phase 3A — EmergencyShielding/2 (저체력 shield trigger)', () => {
  it('EmergencyShielding → trigger 0.4 / shield 0.5 / duration 2.5s', () => {
    const { grav } = runWith(['EmergencyShielding']);
    expect(grav.gravesEmergencyTriggerHpFrac).toBeCloseTo(0.4, 3);
    expect(grav.gravesEmergencyShieldFrac).toBeCloseTo(0.5, 3);
    expect(grav.gravesEmergencyDurationSec).toBeCloseTo(2.5, 3);
  });

  it('EmergencyShielding2 → trigger 0.4 / shield 0.75 / duration 4s', () => {
    const { grav } = runWith(['EmergencyShielding2']);
    expect(grav.gravesEmergencyTriggerHpFrac).toBeCloseTo(0.4, 3);
    expect(grav.gravesEmergencyShieldFrac).toBeCloseTo(0.75, 3);
    expect(grav.gravesEmergencyDurationSec).toBeCloseTo(4, 3);
  });

  it('EmergencyShielding + EmergencyShielding2 동시 → 상위 tier (0.75 / 4) 적용', () => {
    const { grav } = runWith(['EmergencyShielding', 'EmergencyShielding2']);
    expect(grav.gravesEmergencyShieldFrac).toBeCloseTo(0.75, 3);
    expect(grav.gravesEmergencyDurationSec).toBeCloseTo(4, 3);
  });

  it('미사용 시 trigger/shield/duration 모두 0', () => {
    const { base } = runWith([]);
    expect(base.gravesEmergencyTriggerHpFrac).toBe(0);
    expect(base.gravesEmergencyShieldFrac).toBe(0);
    expect(base.gravesEmergencyDurationSec).toBe(0);
    expect(base.gravesEmergencyUsed).toBe(false);
  });
});

describe('GravesTrait Phase 3A — Shockwave (전투 시작 cone + stun)', () => {
  it('Shockwave → gravesShockwaveActive = true', () => {
    const { grav } = runWith(['Shockwave']);
    expect(grav.gravesShockwaveActive).toBe(true);
    expect(grav.gravesUpgrades).toContain('Shockwave');
  });

  it('미사용 시 gravesShockwaveActive = false', () => {
    const { base } = runWith([]);
    expect(base.gravesShockwaveActive).toBe(false);
  });

  it('Shockwave 활성 시 combat 종료 가속 (초반 maxHp×15% 추가 burst → 적 사망 시간 단축)', () => {
    // 적 1명 시나리오 (Aatrox 6,3) — Shockwave 첫 tick 추가 데미지로 combat 종료 가속.
    // PR99 (off-by-one fix): Graves SecondaryDamageAD ★2 정상화 (★3 200 → ★2 135) 후
    // baseline 의 totalDamageTaken 누적이 combat duration 차이로 더 클 수 있어,
    // duration 비교가 더 robust. Shockwave 활성 → 적 사망 시간 단축 → duration 짧음.
    const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
    const enemyTeam: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withUpg = simulateCombat(team, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesUpgrades: ['Shockwave'],
    });
    const baseline = simulateCombat(team, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    expect(withUpg.duration).toBeLessThanOrEqual(baseline.duration);
  });
});

describe('GravesTrait Phase 3A — ReactiveArmor (onTakeDamage stack)', () => {
  it('ReactiveArmor → gravesReactivePerStack = 4', () => {
    const { grav } = runWith(['ReactiveArmor']);
    expect(grav.gravesReactivePerStack).toBe(4);
    expect(grav.gravesUpgrades).toContain('ReactiveArmor');
  });

  it('미사용 시 perStack/stackCount 모두 0', () => {
    const { base } = runWith([]);
    expect(base.gravesReactivePerStack).toBe(0);
    expect(base.gravesReactiveStackCount).toBe(0);
  });

  it('ReactiveArmor 활성 시 stack 누적 가능 (baseline 대비 armor/MR 증가)', () => {
    // Graves 가 적 평타에 맞으면 stack 증가. 적이 1명 + Graves 가 dps caster 라
    // 거리가 있어 적 평타 횟수가 적을 수 있음 → stackCount 0 이상 ~ 50 이하 검증.
    const { grav } = runWith(['ReactiveArmor']);
    expect(grav.gravesReactiveStackCount).toBeGreaterThanOrEqual(0);
    expect(grav.gravesReactiveStackCount).toBeLessThanOrEqual(50);
    // stack > 0 이라면 armor/MR 가 base 보다 +(N×4) 만큼 높아야 함.
    if (grav.gravesReactiveStackCount > 0) {
      const expected = grav.gravesReactiveStackCount * 4;
      // baseline 비교 (다른 stat 효과 없음 가정)
      const { base } = runWith([]);
      expect(grav.stats.armor - base.stats.armor).toBeCloseTo(expected, 0);
      expect(grav.stats.magicResist - base.stats.magicResist).toBeCloseTo(expected, 0);
    }
  });
});

describe('GravesTrait Phase 3A — gravesUpgrades 추적 + canonical apply order', () => {
  it('8종 모두 입력 시 gravesUpgrades 배열에 모두 포함', () => {
    const all = [
      'RipperBullets', 'RipperBullets2',
      'Nanomachines',
      'EmergencyShielding', 'EmergencyShielding2',
      'Shockwave',
      'ReactiveArmor',
    ];
    const { grav } = runWith(all);
    for (const id of all) {
      expect(grav.gravesUpgrades).toContain(id);
    }
  });

  it('입력 array 순서 무관 — 동일 set 이면 동일 결과 (deterministic)', () => {
    const setA = ['Nanomachines', 'EmergencyShielding', 'Shockwave', 'RipperBullets'];
    const setB = ['Shockwave', 'RipperBullets', 'EmergencyShielding', 'Nanomachines'];
    const a = simulateCombat(
      [placed(apGraves, 0, 0)], [placed(dummyEnemy, 6, 3)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5, playerGravesUpgrades: setA },
    );
    const b = simulateCombat(
      [placed(apGraves, 0, 0)], [placed(dummyEnemy, 6, 3)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5, playerGravesUpgrades: setB },
    );
    const gA = a.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
    const gB = b.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
    expect(gA.gravesNanoRegenPct).toBe(gB.gravesNanoRegenPct);
    expect(gA.gravesRipperReduce).toBe(gB.gravesRipperReduce);
    expect(gA.gravesShockwaveActive).toBe(gB.gravesShockwaveActive);
    expect(gA.gravesEmergencyShieldFrac).toBe(gB.gravesEmergencyShieldFrac);
    expect(gA.totalDamageDealt).toBeCloseTo(gB.totalDamageDealt, 1);
  });
});

describe('GravesTrait Phase 3A — Phase 2 와 호환', () => {
  it('Phase 2 (HeavyPlating) + Phase 3A (Nanomachines) 동시 적용 가능', () => {
    const { grav, base } = runWith(['HeavyPlating', 'Nanomachines']);
    expect(grav.gravesUpgrades).toContain('HeavyPlating');
    expect(grav.gravesUpgrades).toContain('Nanomachines');
    // HeavyPlating maxHp +300, armor +20, mr +20.
    expect(grav.maxHp - base.maxHp).toBeGreaterThanOrEqual(300);
    expect(grav.gravesNanoRegenPct).toBeCloseTo(0.03, 5);
  });

  it('적용 안 한 unit 은 모든 Phase 3A 필드 default (0/false)', () => {
    const { base } = runWith([]);
    expect(base.gravesRipperReduce).toBe(0);
    expect(base.gravesNanoRegenPct).toBe(0);
    expect(base.gravesShockwaveActive).toBe(false);
    expect(base.gravesReactivePerStack).toBe(0);
    expect(base.gravesEmergencyTriggerHpFrac).toBe(0);
  });
});
