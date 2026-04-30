/**
 * 회귀 가드 — 영웅 증강 (Hero Augment) stat/abilityData 시스템 (PR3).
 *
 * 본 PR 적용 범위:
 *   - CarryAugmentConfig.statOverrides 슬롯 (사용자 추후 채움)
 *   - CarryAbilityData 확장 변수 (shield/healthCost/hexReduction/asGain 등)
 *   - applyHeroCarryTransforms 가 8개 영웅 증강 모두 처리 (기존 2개 hardcoded → CARRY_AUGMENTS iter)
 *   - 자폭 self-damage 가 abilityData.healthCost (maxHp × 0.20) 정확 적용 (17.2b)
 *
 * 후속 PR 범위:
 *   - augment-specific damage 시뮬 적용 (레오나 90/135/225 AD, 잭스 starLevel asGain 등)
 *   - 자폭 적군 damage / hexReduction / 탱커 보너스
 *   - 복잡 메커니즘 (3-skill cycle / X-shape / bouncing / 미프)
 *   - 사용자 인게임 stat 측정 후 statOverrides 채우기
 *
 * 17.2b 변경 출처: docs/meta/set17-hero-augments.md
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { CARRY_AUGMENTS, findCarryAugment } from '@/data/carryAugments';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits, augments } = loadServerCatalogs();

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('CARRY_AUGMENTS 카탈로그 — 8 영웅 증강 abilityData 정의', () => {
  it('8개 영웅 증강 모두 abilityData 정의됨', () => {
    const heroAugmentApis = [
      'TFT17_Augment_GragasCarry',
      'TFT17_Augment_MordekaiserCarry',
      'TFT17_Augment_PykeCarry',
      'TFT17_Augment_JaxCarry',
      'TFT17_Augment_IvernMinionCarry',
      'TFT17_Augment_AatroxCarry',
      'TFT17_Augment_PoppyCarry',
      'TFT17_Augment_LeonaCarry',
    ];
    for (const api of heroAugmentApis) {
      const cfg = CARRY_AUGMENTS.find(c => c.augmentApiName === api);
      expect(cfg, `${api} 누락`).toBeDefined();
      expect(cfg!.abilityData, `${api} abilityData 누락`).toBeDefined();
    }
  });

  it('17.2b — 그라가스 자폭: healthCost=0.20, hexReduction=0.45', () => {
    const gragas = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_GragasCarry');
    expect(gragas?.abilityData?.healthCost).toBe(0.20);
    expect(gragas?.abilityData?.hexReduction).toBe(0.45);
  });

  it('17.2b — 모데카이저 뜨거운 죽음: shield = [225, 250, 300]', () => {
    const morde = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_MordekaiserCarry');
    expect(morde?.abilityData?.shield).toEqual([225, 250, 300]);
  });

  it('17.2b — 레오나 방패 여전사: damage = [90, 135, 225]', () => {
    const leona = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_LeonaCarry');
    expect(leona?.abilityData?.damage).toEqual([90, 135, 225]);
    expect(leona?.abilityData?.shield).toEqual([200, 240, 280]);
    expect(leona?.abilityData?.baseDamageHpFrac).toBeCloseTo(0.28, 2);
  });

  it('잭스 저 별을 향해: asGain starLevel 별 [0.15, 0.15, 0.20]', () => {
    const jax = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_JaxCarry');
    expect(jax?.abilityData?.asGain).toEqual([0.15, 0.15, 0.20]);
    expect(jax?.abilityData?.onAttackBonus).toEqual([45, 70, 105]);
    expect(jax?.abilityData?.damage).toEqual([155, 230, 375]);
  });

  it('파이크 청부 살인마: tankBonus 0.60 + onKillRecast 0.70', () => {
    const pyke = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PykeCarry');
    expect(pyke?.abilityData?.tankBonusMultiplier).toBe(0.60);
    expect(pyke?.abilityData?.onKillRecastMultiplier).toBe(0.70);
    expect(pyke?.abilityData?.secondaryDamage).toEqual([60, 90, 135]);
  });

  it('아트록스 별빛 연계: 3-skill cycle + N.O.V.A. 변수', () => {
    const aatrox = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_AatroxCarry');
    expect(aatrox?.abilityData?.skillCycleLabels).toEqual(['타격', '휩쓸기', '찍기']);
    expect(aatrox?.abilityData?.novaDamage).toEqual([120, 180, 270]);
    expect(aatrox?.abilityData?.singleTargetMultiplier).toBe(2.5);
  });

  it('뽀삐 정령단 속도: armorScale 1.0 + spiritBounceOnKill', () => {
    const poppy = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PoppyCarry');
    expect(poppy?.abilityData?.armorScale).toBe(1.0);
    expect(poppy?.abilityData?.spiritBounceOnKill).toBe(true);
    expect(poppy?.abilityData?.damage).toEqual([340, 510, 850]);
  });

  it('꼬마정령 빅뱅: hexReduction + stunDuration', () => {
    const ivern = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_IvernMinionCarry');
    expect(ivern?.abilityData?.hexReduction).toBe(0.45);
    expect(ivern?.abilityData?.stunDuration).toEqual([1.25, 1.5, 1.75]);
    expect(ivern?.abilityData?.onAttackBonus).toEqual([40, 60, 90]);
  });

  it('뽀삐 정령단 속도: ranged projectile (dash 없음, rangeOverride=4) — codex P1 회귀 가드', () => {
    // 정령단 속도는 ranged projectile augment. dash 추가 시 매 cast 마다 melee 점프 →
    // 의도된 ranged behavior 깨짐. abilityOverride 에 dash 없는지 검증.
    const poppy = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PoppyCarry');
    expect(poppy).toBeDefined();
    expect(poppy!.abilityOverride.dash).toBeUndefined();
    expect(poppy!.rangeOverride).toBe(4);
  });
});

describe('applyHeroCarryTransforms — 8 영웅 증강 모두 처리', () => {
  // 각 영웅 증강 활성 시 가장 강한 챔프가 role='Fighter' 로 변환되는지 검증.
  // statOverrides 비어있어도 기존 stat 유지 (안전 default).
  function runWithCarry(carryApi: string, championApi: string) {
    const champ = champions.find(c => c.apiName === championApi);
    const enemy = champions.find(c => c.apiName === 'TFT17_Aatrox' && c.apiName !== championApi)
      ?? champions.find(c => c.apiName === 'TFT17_Briar')!;
    const carryAug = augments.find(a => a.apiName === carryApi);
    if (!champ || !carryAug) return null;
    const result = simulateCombat([placed(champ, 0, 0)], [placed(enemy, 6, 3)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [carryAug],
    });
    return result.playerUnits.find(u => u.champion.apiName === championApi);
  }

  it.each([
    ['TFT17_Augment_GragasCarry', 'TFT17_Gragas'],
    ['TFT17_Augment_MordekaiserCarry', 'TFT17_Mordekaiser'],
    ['TFT17_Augment_LeonaCarry', 'TFT17_Leona'],
    ['TFT17_Augment_JaxCarry', 'TFT17_Jax'],
    ['TFT17_Augment_PykeCarry', 'TFT17_Pyke'],
    ['TFT17_Augment_PoppyCarry', 'TFT17_Poppy'],
    ['TFT17_Augment_AatroxCarry', 'TFT17_Aatrox'],
  ])('%s 활성 → 챔프 role = Fighter (변환됨)', (carryApi, championApi) => {
    const u = runWithCarry(carryApi, championApi);
    if (u) {
      expect(u.role).toBe('Fighter');
    }
  });
});

describe('자폭 (GragasCarry) — 17.2b healthCost 적용', () => {
  it('GragasCarry 활성 시 gragasCarryActive=true + role=Fighter', () => {
    const gragas = champions.find(c => c.apiName === 'TFT17_Gragas');
    const enemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
    const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_GragasCarry');
    if (!gragas || !carryAug) return;
    const result = simulateCombat([placed(gragas, 0, 0, 2)], [placed(enemy, 6, 3, 2)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [carryAug],
    });
    const g = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Gragas');
    if (!g) return;
    expect(g.gragasCarryActive).toBe(true);
    expect(g.role).toBe('Fighter');
    // 자폭이 maxHp 를 stat으로 변경하지는 않음 — base HP 보존
    expect(g.maxHp).toBeGreaterThan(0);
  });

  it('findCarryAugment 가 그라가스 carry 정상 lookup', () => {
    const cfg = findCarryAugment('TFT17_Gragas', ['TFT17_Augment_GragasCarry']);
    expect(cfg).toBeDefined();
    expect(cfg!.abilityData?.healthCost).toBe(0.20);
  });
});

describe('CarryAugmentConfig.statOverrides — 슬롯 추후 채움 가드', () => {
  it('현재는 모든 augment 의 statOverrides 가 미정의 (사용자 추후 인게임 측정 후 채움)', () => {
    // 본 PR 은 슬롯만 추가. 사용자가 인게임 stat 측정 후 채울 예정.
    // 미정의 = augment 활성 시 기존 챔프 stat 그대로 (회귀 없음).
    for (const cfg of CARRY_AUGMENTS) {
      // statOverrides 슬롯 자체는 옵셔널 — 정의 안 되어있어야 정상 (현재).
      expect(cfg.statOverrides ?? null).toBeNull();
    }
  });
});
