/**
 * 회귀 가드 — 최신상 (TFT17_GravesTrait) Frame 변환 (3종, Phase 1).
 *
 * 17.2 raw items:
 *   CloseQuarters (맹공): Range -2, BaseHealth 250, AttackDamage 0.25, Omnivamp 0.10
 *   SharpshooterModule (위력): AbilityDamagePercentIncrease 0.05 + 정밀
 *   DoubleTap (사수): DoubleAttackChance 0.25
 *
 * 가장 강한 그레이브즈 1명에 적용 (성급 → 아이템 → 첫 번째).
 * 본 Phase 는 Frame 3종 stat / 메커닉 적용. 하위 업그레이드 (30+) 는 후속 PR.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const apGraves = champions.find(c => c.apiName === 'TFT17_Graves')!;
const apTwistedFate = champions.find(c => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
const someItem = items.find(i => i.apiName?.startsWith('TFT_Item_'))!;

function placed(c: RawChampion, q: number, r: number, starLevel: number = 2, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: eqItems };
}

describe('GravesTrait Frame — 가장 강한 그레이브즈 1명에 적용', () => {
  it('CloseQuarters (맹공) → range -2, +HP 250, +AD 25%, +omnivamp 0.10, role=Fighter', () => {
    const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];

    const baseRange = apGraves.stats.range;
    const baseDamage = apGraves.stats.damage;
    const baseHp = apGraves.stats.hp;

    const withFrame = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesFrame: 'CloseQuarters',
    });
    const baseline = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });

    const grav = withFrame.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
    const gravBase = baseline.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;

    // gravesFrame flag 설정
    expect(grav.gravesFrame).toBe('CloseQuarters');
    // range -2 (최소 1)
    expect(grav.stats.range).toBe(Math.max(1, baseRange - 2));
    // maxHp 250 추가
    expect(grav.maxHp - gravBase.maxHp).toBeCloseTo(250, 0);
    // omnivamp +0.10
    expect(grav.omnivamp - gravBase.omnivamp).toBeCloseTo(0.10, 2);
    // role Fighter
    expect(grav.role).toBe('Fighter');
    // damage 증가 (base × 0.25 추가) — base × star × 0.25
    expect(grav.stats.damage).toBeGreaterThan(gravBase.stats.damage);
  });

  it('SharpshooterModule (위력) → spellCanCrit + gravesAbilityDamageBonus 0.05', () => {
    const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesFrame: 'SharpshooterModule',
    });
    const grav = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
    expect(grav.gravesFrame).toBe('SharpshooterModule');
    expect(grav.spellCanCrit).toBe(true);
    expect(grav.gravesAbilityDamageBonus).toBeCloseTo(0.05, 3);
  });

  it('DoubleTap (사수) → gravesDoubleAttackChance 0.25', () => {
    const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesFrame: 'DoubleTap',
    });
    const grav = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
    expect(grav.gravesFrame).toBe('DoubleTap');
    expect(grav.gravesDoubleAttackChance).toBeCloseTo(0.25, 3);
  });

  it('Frame 미지정 → Frame 효과 없음 (default 값)', () => {
    const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const grav = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
    expect(grav.gravesFrame).toBe(null);
    expect(grav.gravesDoubleAttackChance).toBe(0);
    expect(grav.gravesAbilityDamageBonus).toBe(0);
  });

  it('비-Graves unit → Frame 효과 없음 (TFT17_Graves 챔프만 적용)', () => {
    const team: PlacedChampion[] = [placed(apTwistedFate, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesFrame: 'CloseQuarters', // TwistedFate 만 있음, Graves 없음 → 적용 안 됨
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.gravesFrame).toBe(null);
  });

  it('가장 강한 그레이브즈 1명에만 적용 — Graves 2명 (성급 차이) 시 3성 만', () => {
    const team: PlacedChampion[] = [
      placed(apGraves, 0, 0, 2),
      placed(apGraves, 1, 0, 3),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesFrame: 'CloseQuarters',
    });
    const gravs = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_Graves');
    const star3 = gravs.find(u => u.starLevel === 3)!;
    const star2 = gravs.find(u => u.starLevel === 2)!;
    expect(star3.gravesFrame).toBe('CloseQuarters');
    expect(star2.gravesFrame).toBe(null);
  });

  it('가장 강한 룰 — 동급 시 아이템 보유 unit 우선', () => {
    const team: PlacedChampion[] = [
      placed(apGraves, 0, 0, 2, []), // no items
      placed(apGraves, 1, 0, 2, [someItem]), // 아이템 1개
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesFrame: 'DoubleTap',
    });
    const gravs = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_Graves');
    const withItems = gravs.find(u => u.items.length > 0)!;
    const noItems = gravs.find(u => u.items.length === 0)!;
    expect(withItems.gravesFrame).toBe('DoubleTap');
    expect(noItems.gravesFrame).toBe(null);
  });
});
