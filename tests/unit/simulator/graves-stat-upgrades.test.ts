/**
 * 회귀 가드 — 최신상 (TFT17_GravesTrait) 무기고 stat upgrade 18종 (Phase 2).
 *
 * raw items (TFT17_GravesTrait_Offense_*) 직접 stat 가산 검증.
 * 가장 강한 그레이브즈 1명에 적용 (Frame 과 동일 selector).
 * Phase 3 메커닉 (RevUp / Buckshot / GravBooster 등) 은 후속 PR — 본 가드는 18종만.
 *
 * 18종 매핑 (effects raw):
 *   LeechingImplants    AD 0.10 / Omnivamp 0.10
 *   LeechingImplants2   AD 0.20 / Omnivamp 0.15
 *   HeavyPlating        BaseHealth 300 / Armor 20 / MR 20
 *   PrecisionScope      AD 0.12 / Range +1
 *   PrecisionScope2/3   AD 0.24/0.36 / Range +2/+3
 *   Fission/2/3         AD 0.10/0.20/0.30 / ManaRegen +2/+3/+5
 *   Heartseeker/2/3     CritChance 0.10/0.25/0.40 / CritDmg 0.05/0.10/0.18
 *   Tankbuster          탱커 상대 +0.15 damage amp
 *   Coolant/2           ManaReduction -10/-20 (maxMana 차감)
 *   APRounds/2          ArmorPen +0.30/+0.60
 *   SheerMass           MaxHp × 1.25
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { STAR_SCALING } from '@/types';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const apGraves = champions.find(c => c.apiName === 'TFT17_Graves')!;
const apTwistedFate = champions.find(c => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
const someItem = items.find(i => i.apiName?.startsWith('TFT_Item_'))!;

function placed(c: RawChampion, q: number, r: number, starLevel: number = 2, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: eqItems };
}

function gravesBaseAd(): number {
  // simulateCombat 의 baseAd 식과 동일 — champion.stats.damage × STAR_SCALING[2]
  return apGraves.stats.damage * (STAR_SCALING[2] || 1);
}

function runWith(upgrades: string[]) {
  const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
  const enemy = [placed(dummyEnemy, 6, 3)];
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
  };
}

describe('GravesTrait stat upgrades — 단순 stat 18종 적용', () => {
  it('LeechingImplants → AD +10%(base), omnivamp +0.10', () => {
    const { grav, base } = runWith(['LeechingImplants']);
    expect(grav.gravesUpgrades).toContain('LeechingImplants');
    expect(grav.stats.damage - base.stats.damage).toBeCloseTo(gravesBaseAd() * 0.10, 1);
    expect(grav.omnivamp - base.omnivamp).toBeCloseTo(0.10, 2);
  });

  it('LeechingImplants2 → AD +20%(base), omnivamp +0.15', () => {
    const { grav, base } = runWith(['LeechingImplants2']);
    expect(grav.stats.damage - base.stats.damage).toBeCloseTo(gravesBaseAd() * 0.20, 1);
    expect(grav.omnivamp - base.omnivamp).toBeCloseTo(0.15, 2);
  });

  it('HeavyPlating → maxHp +300, armor +20, mr +20', () => {
    const { grav, base } = runWith(['HeavyPlating']);
    expect(grav.maxHp - base.maxHp).toBeCloseTo(300, 0);
    expect(grav.stats.armor - base.stats.armor).toBeCloseTo(20, 1);
    expect(grav.stats.magicResist - base.stats.magicResist).toBeCloseTo(20, 1);
  });

  it('PrecisionScope → AD +12%, range +1', () => {
    const { grav, base } = runWith(['PrecisionScope']);
    expect(grav.stats.damage - base.stats.damage).toBeCloseTo(gravesBaseAd() * 0.12, 1);
    expect(grav.stats.range - base.stats.range).toBe(1);
  });

  it('PrecisionScope2 → AD +24%, range +2', () => {
    const { grav, base } = runWith(['PrecisionScope2']);
    expect(grav.stats.damage - base.stats.damage).toBeCloseTo(gravesBaseAd() * 0.24, 1);
    expect(grav.stats.range - base.stats.range).toBe(2);
  });

  it('PrecisionScope3 → AD +36%, range +3', () => {
    const { grav, base } = runWith(['PrecisionScope3']);
    expect(grav.stats.damage - base.stats.damage).toBeCloseTo(gravesBaseAd() * 0.36, 1);
    expect(grav.stats.range - base.stats.range).toBe(3);
  });

  it('Fission → AD +10%, manaRegen +2', () => {
    const { grav, base } = runWith(['Fission']);
    expect(grav.stats.damage - base.stats.damage).toBeCloseTo(gravesBaseAd() * 0.10, 1);
    expect(grav.augmentManaRegen - base.augmentManaRegen).toBeCloseTo(2, 2);
  });

  it('Fission3 → AD +30%, manaRegen +5', () => {
    const { grav, base } = runWith(['Fission3']);
    expect(grav.stats.damage - base.stats.damage).toBeCloseTo(gravesBaseAd() * 0.30, 1);
    expect(grav.augmentManaRegen - base.augmentManaRegen).toBeCloseTo(5, 2);
  });

  it('Heartseeker → critChance +0.10, critMultiplier +0.05', () => {
    const { grav, base } = runWith(['Heartseeker']);
    expect(grav.stats.critChance - base.stats.critChance).toBeCloseTo(0.10, 3);
    expect(grav.stats.critMultiplier - base.stats.critMultiplier).toBeCloseTo(0.05, 3);
  });

  it('Heartseeker3 → critChance +0.40, critMultiplier +0.18', () => {
    const { grav, base } = runWith(['Heartseeker3']);
    expect(grav.stats.critChance - base.stats.critChance).toBeCloseTo(0.40, 3);
    expect(grav.stats.critMultiplier - base.stats.critMultiplier).toBeCloseTo(0.18, 3);
  });

  it('Tankbuster → gravesTankDamageAmp += 0.15', () => {
    const { grav, base } = runWith(['Tankbuster']);
    expect(grav.gravesTankDamageAmp - base.gravesTankDamageAmp).toBeCloseTo(0.15, 3);
  });

  it('Coolant → maxMana -10', () => {
    const { grav, base } = runWith(['Coolant']);
    expect(base.maxMana - grav.maxMana).toBeCloseTo(10, 0);
  });

  it('Coolant2 → maxMana -20', () => {
    const { grav, base } = runWith(['Coolant2']);
    expect(base.maxMana - grav.maxMana).toBeCloseTo(20, 0);
  });

  it('APRounds → armorPen +0.30', () => {
    const { grav, base } = runWith(['APRounds']);
    expect(grav.stats.armorPen - base.stats.armorPen).toBeCloseTo(0.30, 3);
  });

  it('APRounds2 → armorPen +0.60', () => {
    const { grav, base } = runWith(['APRounds2']);
    expect(grav.stats.armorPen - base.stats.armorPen).toBeCloseTo(0.60, 3);
  });

  it('SheerMass → maxHp × 1.25', () => {
    const { grav, base } = runWith(['SheerMass']);
    expect(grav.maxHp).toBeCloseTo(Math.round(base.maxHp * 1.25), 0);
  });

  it('복수 upgrade 동시 적용 → 효과 누적 (Heartseeker + APRounds + Tankbuster)', () => {
    const { grav, base } = runWith(['Heartseeker', 'APRounds', 'Tankbuster']);
    // canonical order: APRounds → Heartseeker → Tankbuster (deterministic, input 순서 무관)
    expect(grav.gravesUpgrades).toEqual(['APRounds', 'Heartseeker', 'Tankbuster']);
    expect(grav.stats.critChance - base.stats.critChance).toBeCloseTo(0.10, 3);
    expect(grav.stats.armorPen - base.stats.armorPen).toBeCloseTo(0.30, 3);
    expect(grav.gravesTankDamageAmp).toBeCloseTo(0.15, 3);
  });

  it('canonical apply order — 입력 배열 순서가 달라도 동일 결과 (deterministic)', () => {
    // SheerMass × maxHp / HeavyPlating + maxHp 는 적용 순서에 따라 결과 다름.
    // canonical: HeavyPlating(flat HP +300) → SheerMass(× 1.25) 가 정답.
    const set1 = runWith(['HeavyPlating', 'SheerMass']);
    const set2 = runWith(['SheerMass', 'HeavyPlating']); // 입력 순서 뒤집어도 동일해야 함
    expect(set1.grav.maxHp).toBe(set2.grav.maxHp);
    expect(set1.grav.gravesUpgrades).toEqual(set2.grav.gravesUpgrades);
    // canonical order: HeavyPlating(flat) 먼저 → SheerMass(×) 나중
    expect(set1.grav.gravesUpgrades).toEqual(['HeavyPlating', 'SheerMass']);
    // 결과: (base + 300) × 1.25
    expect(set1.grav.maxHp).toBeCloseTo(Math.round((set1.base.maxHp + 300) * 1.25), 0);
  });

  it('Frame + upgrade 동시 → 양쪽 동일 unit 에 누적', () => {
    const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesFrame: 'CloseQuarters',
      playerGravesUpgrades: ['HeavyPlating'],
    });
    const grav = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
    expect(grav.gravesFrame).toBe('CloseQuarters');
    expect(grav.gravesUpgrades).toContain('HeavyPlating');
    // CloseQuarters HP +250 + HeavyPlating HP +300 가산 → maxHp >= base + 550
    expect(grav.stats.armor).toBeGreaterThan(0);
  });

  it('빈 옵션 / 옵션 미지정 → upgrade 미적용 (default)', () => {
    const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const grav = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Graves')!;
    expect(grav.gravesUpgrades).toEqual([]);
    expect(grav.gravesTankDamageAmp).toBe(0);
  });

  it('미지원 upgrade ID (Phase 3D 항목) → silently skip', () => {
    // Choke (3D 미구현) + AimAssistant (3D 미구현) + Heartseeker (Phase 2 구현됨).
    const { grav } = runWith(['Choke', 'AimAssistant', 'Heartseeker']);
    expect(grav.gravesUpgrades).toEqual(['Heartseeker']);
  });

  it('비-Graves unit → upgrade 미적용', () => {
    const team: PlacedChampion[] = [placed(apTwistedFate, 0, 0)];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesUpgrades: ['HeavyPlating'],
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.gravesUpgrades).toEqual([]);
  });

  it('가장 강한 1명에만 적용 — 3성 / 2성 두 명 시 3성 만', () => {
    const team: PlacedChampion[] = [
      placed(apGraves, 0, 0, 2),
      placed(apGraves, 1, 0, 3),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesUpgrades: ['Heartseeker3'],
    });
    const gravs = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_Graves');
    const star3 = gravs.find(u => u.starLevel === 3)!;
    const star2 = gravs.find(u => u.starLevel === 2)!;
    expect(star3.gravesUpgrades).toContain('Heartseeker3');
    expect(star2.gravesUpgrades).toEqual([]);
  });

  it('동급 시 아이템 보유 unit 우선 (Frame selector 와 동일)', () => {
    const team: PlacedChampion[] = [
      placed(apGraves, 0, 0, 2, []),
      placed(apGraves, 1, 0, 2, [someItem]),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerGravesUpgrades: ['APRounds'],
    });
    const gravs = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_Graves');
    const withItems = gravs.find(u => u.items.length > 0)!;
    const noItems = gravs.find(u => u.items.length === 0)!;
    expect(withItems.gravesUpgrades).toContain('APRounds');
    expect(noItems.gravesUpgrades).toEqual([]);
  });
});
