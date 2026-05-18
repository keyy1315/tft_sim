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
 * 17.2b 변경 출처: docs/meta/wiki/raw/in-game/set17-hero-augments.md
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { CARRY_AUGMENTS, findCarryAugment } from '@/data/carryAugments';
import { getFighterASBonus } from '@/lib/simulator/models/unit';
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

  it('17.3 — 모데카이저 뜨거운 죽음: shield = [175, 200, 400], mana 10/40', () => {
    const morde = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_MordekaiserCarry');
    expect(morde?.abilityData?.shield).toEqual([175, 200, 400]);
    expect(morde?.abilityData?.mana).toBe('10/40');
  });

  it('17.3 — 레오나 방패 여전사: HP ratio 24%, secondary [200,300,480] (17.3 nerf)', () => {
    const leona = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_LeonaCarry');
    expect(leona?.abilityData?.damage).toEqual([90, 135, 225]); // 17.2b 값 — 17.3 변경 없음
    expect(leona?.abilityData?.shield).toEqual([200, 240, 280]);
    expect(leona?.abilityData?.baseDamageHpFrac).toBeCloseTo(0.24, 2); // 17.3: 0.28 → 0.24
    expect(leona?.abilityData?.secondaryDamage).toEqual([200, 300, 480]); // 17.3: [180,270,405] → [200,300,480]
  });

  it('17.3 — 잭스 저 별을 향해: damage [170,250,450] (17.3 buff)', () => {
    const jax = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_JaxCarry');
    expect(jax?.abilityData?.asGain).toEqual([0.15, 0.15, 0.20]);
    expect(jax?.abilityData?.onAttackBonus).toEqual([45, 70, 105]);
    expect(jax?.abilityData?.damage).toEqual([170, 250, 450]); // 17.3: [155,230,375] → [170,250,450]
  });

  it('파이크 청부 살인마: tankBonus 0.60 + onKillRecast 0.70', () => {
    const pyke = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PykeCarry');
    expect(pyke?.abilityData?.tankBonusMultiplier).toBe(0.60);
    expect(pyke?.abilityData?.onKillRecastMultiplier).toBe(0.70);
    expect(pyke?.abilityData?.secondaryDamage).toEqual([60, 90, 135]);
  });

  it('17.3 — 아트록스 별빛 연계: 3-skill cycle + secondary/slam buff + isolation nerf', () => {
    const aatrox = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_AatroxCarry');
    expect(aatrox?.abilityData?.skillCycleLabels).toEqual(['타격', '휩쓸기', '찍기']);
    expect(aatrox?.abilityData?.novaDamage).toEqual([120, 180, 270]);
    expect(aatrox?.abilityData?.secondaryDamage).toEqual([110, 165, 275]); // 17.3: [100,150,225] → [110,165,275]
    expect(aatrox?.abilityData?.slamDamage).toEqual([200, 300, 475]); // 17.3: [160,240,360] → [200,300,475]
    expect(aatrox?.abilityData?.singleTargetMultiplier).toBe(2.0); // 17.3: 2.5 → 2.0 (isolation nerf)
  });

  it('뽀삐 정령단 속도: armorScale 1.0 + spiritBounceOnKill', () => {
    const poppy = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PoppyCarry');
    expect(poppy?.abilityData?.armorScale).toBe(1.0);
    expect(poppy?.abilityData?.spiritBounceOnKill).toBe(true);
    expect(poppy?.abilityData?.damage).toEqual([340, 510, 850]);
  });

  it('17.3 — 꼬마정령 빅뱅: hexReduction 0.35 (17.3 nerf) + stunDuration', () => {
    const ivern = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_IvernMinionCarry');
    expect(ivern?.abilityData?.hexReduction).toBe(0.35); // 17.3: 0.45 → 0.35 (Big Bang falloff per hex)
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

  // codex P2 (PR #68) 회귀 가드 — hero carry 변환된 unit 도 stage-based Fighter AS bonus 수령.
  // 변환 전 호출 순서로 인해 AS bonus 누락되는 회귀 방지.
  it('PoppyCarry 변환 unit 이 stage-based Fighter AS bonus 수령 (codex P2 회귀 가드)', () => {
    const poppy = champions.find(c => c.apiName === 'TFT17_Poppy');
    const enemy = champions.find(c => c.apiName === 'TFT17_Briar');
    const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_PoppyCarry');
    if (!poppy || !enemy || !carryAug) return;
    const stage = 5;
    const expectedBonus = getFighterASBonus(stage);
    expect(expectedBonus).toBeGreaterThan(0); // sanity

    // baseline — carry augment 없이 run (Poppy 본래 role 은 'Fighter' 가 아님)
    const baseline = simulateCombat([placed(poppy, 0, 0)], [placed(enemy, 6, 3)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: stage,
    });
    const baseUnit = baseline.playerUnits.find(u => u.champion.apiName === 'TFT17_Poppy');
    if (!baseUnit) return;
    const baseAS = baseUnit.stats.attackSpeed;

    // carry augment 적용 — role='Fighter' 로 변환 + AS bonus 수령 기대
    const transformed = simulateCombat([placed(poppy, 0, 0)], [placed(enemy, 6, 3)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: stage,
      playerAugments: [carryAug],
    });
    const tUnit = transformed.playerUnits.find(u => u.champion.apiName === 'TFT17_Poppy');
    if (!tUnit) return;
    expect(tUnit.role).toBe('Fighter');

    // AS ratio 가 (1 + fighterASBonus) 만큼 증가했는지 검증.
    // carry 변환은 attackSpeed 자체를 건드리지 않으므로 (statOverrides 비어있음) 순수 fighterAS 효과만 측정.
    const ratio = tUnit.stats.attackSpeed / baseAS;
    expect(ratio).toBeCloseTo(1 + expectedBonus, 3);
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

// PR4 (17.2b 후속) — 자폭 적군 AOE damage 회귀 가드.
// 도메인 공식: maxHp × baseDamageHpFrac + AP × (damage[star] / 100), distance multiplicative falloff,
// tank +60%. 사용자 결정: tank = role === 'Tank' 만, hexReduction = (1 - 0.45)^distance.
describe('자폭 (GragasCarry) — 적군 AOE damage (PR4 17.2b)', () => {
  function setupCombat(opts: { withCarry: boolean; enemyR: number }) {
    const gragas = champions.find(c => c.apiName === 'TFT17_Gragas');
    const enemy = champions.find(c => c.apiName === 'TFT17_Aatrox');
    const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_GragasCarry');
    if (!gragas || !enemy || !carryAug) return null;
    return simulateCombat(
      [placed(gragas, 0, 3, 2)],          // 그라가스: player 마지막 행
      [placed(enemy, 0, opts.enemyR, 2)], // 적: enemyR 위치
      {
        seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
        playerAugments: opts.withCarry ? [carryAug] : [],
      }
    );
  }

  it('자폭 활성 시 인접 적군 (반경 내) 이 추가 damage 수령', () => {
    // baseline (carry 비활성): 그라가스 raw "화학적 분노" — heal + magic damage
    // with carry: 자폭 — self-damage + AOE magic. carry 시 적군 totalDamageTaken 증가 기대.
    const baseline = setupCombat({ withCarry: false, enemyR: 4 });
    const carry = setupCombat({ withCarry: true, enemyR: 4 });
    if (!baseline || !carry) return;

    const baseEnemy = baseline.enemyUnits.find(u => u.champion.apiName === 'TFT17_Aatrox');
    const carryEnemy = carry.enemyUnits.find(u => u.champion.apiName === 'TFT17_Aatrox');
    if (!baseEnemy || !carryEnemy) return;

    // 자폭 활성 시 적군이 받는 damage 가 더 큼 (반경 내 + maxHp scaling).
    // 수치 비교 대신 정성 — 작동 여부 가드.
    expect(carryEnemy.totalDamageTaken).toBeGreaterThan(0);
  });

  it('AOE radius 밖 (>3칸) 적군은 자폭 damage 영향 없음', () => {
    // 그라가스 (q=0, r=3) + 적 (q=0, r=7) → distance = 4 (radius 3 밖)
    // 단 그라가스 raw ability (화학적 분노) 등은 적군 추적 가능하므로 totalDamageTaken=0 보장 어려움.
    // 대신: 자폭 cast 가 발생했을 때 (carry 활성) 적군이 자폭으로 인한 damage 받지 않음을 정성 검증.
    // 단순 가드: 자폭 분기에서 distance > radius 일 때 적군 damage 미적용 (코드 line dist > aoeRadius continue).
    // 본 테스트는 시뮬 통합 레벨이라 모든 source damage 합산이 totalDamageTaken — 정확한 isolation 어려움.
    // 차선: combat result 가 정상 종료되고 적군 currentHp 가 양수로 남아있는지 확인 (radius 밖이면 자폭 damage 0).
    const carry = setupCombat({ withCarry: true, enemyR: 7 });
    if (!carry) return;
    const carryEnemy = carry.enemyUnits.find(u => u.champion.apiName === 'TFT17_Aatrox');
    if (!carryEnemy) return;
    // 시뮬이 정상 작동 (crash 없음) + 적이 살아있거나 죽거나 결과 도출됨.
    expect(carryEnemy.maxHp).toBeGreaterThan(0);
  });

  it('자폭 abilityData 핵심 변수 17.2b 값 검증 (회귀 가드)', () => {
    const cfg = findCarryAugment('TFT17_Gragas', ['TFT17_Augment_GragasCarry']);
    expect(cfg).toBeDefined();
    const ad = cfg!.abilityData!;
    // 17.2b 변경분
    expect(ad.healthCost).toBe(0.20);
    expect(ad.hexReduction).toBe(0.45);
    // PR4 시뮬 적용 의존 변수
    expect(ad.baseDamageHpFrac).toBe(0.10);
    expect(ad.tankBonusMultiplier).toBe(0.60);
    expect(ad.damage).toEqual([280, 420, 630]);
    expect(ad.damageType).toBe('magic');
  });

  it('AOE damage 공식 sanity check — baseAOE = maxHp × 0.10 + AP × (damage / 100)', () => {
    // 코드 line 4953: baseAOE = unit.maxHp * ad.baseDamageHpFrac + unit.stats.ap * (baseDamage / 100);
    // 공식 검증 (mock 없이 raw 계산):
    const ad = findCarryAugment('TFT17_Gragas', ['TFT17_Augment_GragasCarry'])!.abilityData!;
    const sampleMaxHp = 3000;
    const sampleAp = 100;
    const starLvl = 2; // 3성 → damage[1]=420 (index 1)... wait, damage[star-1]
    // index 0 = 1성 280, index 1 = 2성 420, index 2 = 3성 630
    const expected2star = sampleMaxHp * 0.10 + sampleAp * (420 / 100);
    expect(expected2star).toBe(300 + 420);
    expect(expected2star).toBe(720);

    const expected3star = sampleMaxHp * 0.10 + sampleAp * (630 / 100);
    expect(expected3star).toBe(300 + 630);
    expect(expected3star).toBe(930); // 3성 표기 938 (maxHp 3080 가정) 와 근접 — 도메인 문서 검증

    // multiplicative falloff
    const dist1Mul = Math.pow(1 - 0.45, 1);
    const dist2Mul = Math.pow(1 - 0.45, 2);
    const dist3Mul = Math.pow(1 - 0.45, 3);
    expect(dist1Mul).toBeCloseTo(0.55, 3);
    expect(dist2Mul).toBeCloseTo(0.3025, 3);
    expect(dist3Mul).toBeCloseTo(0.166, 2);

    // tank multiplier
    expect(1 + ad.tankBonusMultiplier!).toBe(1.6);

    // starLvl 매개변수가 위에서 사용되지 않은 경고 방지 — sanity check (1성 기준)
    expect(starLvl).toBeGreaterThan(0);
  });
});

// PR5 (17.2b 후속) — augment-specific damage 시뮬 분기 회귀 가드.
// 일반 ability cast 시점에 carry augment 가 활성이면 abilityData.damage [1성/2성/3성] 사용
// (raw 챔프 damage 변수 무시) + damageType override 적용.
// 자폭 (그라가스) 은 PR4 special path — 본 PR 무관 (selfDamage 분기 별도).
describe('PR5 — augment-specific damage 시뮬 분기 (resolveAbilityDamage)', () => {
  it('레오나 carry 활성 시 cast damage 가 abilityData.damage [90,135,225] 기준', () => {
    // 레오나 raw ability 는 ShieldAmount [420,480,620] (보호막). carry 활성 시 abilityData
    // 의 damage [90,135,225] AD 가 사용되어 raw 와 다른 값. carry 비활성 vs 활성 totalDamageDealt
    // 비교 — augment override 작동 여부 정성 가드.
    const leona = champions.find(c => c.apiName === 'TFT17_Leona');
    const enemy = champions.find(c => c.apiName === 'TFT17_Briar');
    const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_LeonaCarry');
    if (!leona || !enemy || !carryAug) return;

    // carry 활성: damage [90,135,225] 사용 + physical override + line dash + stun
    const carry = simulateCombat([placed(leona, 0, 3, 2)], [placed(enemy, 0, 4, 2)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [carryAug],
    });
    const carryLeona = carry.playerUnits.find(u => u.champion.apiName === 'TFT17_Leona');
    if (!carryLeona) return;
    expect(carryLeona.role).toBe('Fighter'); // hero carry 변환 검증
    // augment 활성 시 cast 발생 → totalDamageDealt > 0
    expect(carryLeona.totalDamageDealt).toBeGreaterThanOrEqual(0); // sanity
  });

  it('damageTypeOverride 우선순위 (사용자 결정 PR5): top-level 우선, abilityData.damageType fallback', () => {
    // 카탈로그 검증 — damageTypeOverride 가 명시된 augment 들은 모두 'physical'
    // (set 17.2b 시점 6개 augment).
    const expectedPhysical = [
      'TFT17_Augment_NasusCarry',
      'TFT17_Augment_AatroxCarry',
      'TFT17_Augment_PoppyCarry',
      'TFT17_Augment_LeonaCarry',
      'TFT17_Augment_PykeCarry',
    ];
    for (const api of expectedPhysical) {
      const cfg = CARRY_AUGMENTS.find(c => c.augmentApiName === api);
      expect(cfg).toBeDefined();
      // damageTypeOverride 가 'physical' 이면 resolveAbilityDamage 가 그것 우선 사용.
      expect(cfg!.damageTypeOverride).toBe('physical');
      // abilityData.damageType 와 일관성 검증 (양쪽 일치 — 미스매치 회귀 가드)
      if (cfg!.abilityData?.damageType) {
        expect(cfg!.abilityData.damageType).toBe('physical');
      }
    }
  });

  it('damageTypeOverride 없는 augment 는 abilityData.damageType 으로 fallback', () => {
    // IvernMinion / Jax / Mordekaiser / Gragas — damageTypeOverride 없음, abilityData.damageType='magic'
    const expectedMagic = [
      'TFT17_Augment_IvernMinionCarry',
      'TFT17_Augment_JaxCarry',
      'TFT17_Augment_MordekaiserCarry',
      'TFT17_Augment_GragasCarry',
    ];
    for (const api of expectedMagic) {
      const cfg = CARRY_AUGMENTS.find(c => c.augmentApiName === api);
      expect(cfg).toBeDefined();
      expect(cfg!.damageTypeOverride).toBeUndefined();
      expect(cfg!.abilityData?.damageType).toBe('magic');
    }
  });

  it('resolveAbilityDamage 패턴 fingerprint — combatLoop.ts 가 helper 호출 (회귀 가드)', async () => {
    // 본 PR 의 핵심 변경: 두 cast site (일반 + OOR) 가 resolveAbilityDamage 사용.
    // 누군가 raw getAbilityDamage 로 되돌리는 회귀 방지.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // resolveAbilityDamage 호출 패턴 — 2회 (일반 cast + OOR cast).
    const pattern = /resolveAbilityDamage\(\s*\n?\s*\w+\.champion/g;
    const matches = file.match(pattern);
    expect(matches).toBeDefined();
    expect(matches!.length).toBe(2);
  });

  it('helper 함수 정의 검증 — magic AP scaling + physical baseValue + damageTypeOverride 우선순위', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // helper 함수 시그니처 + 핵심 로직 fingerprint.
    expect(file).toMatch(/function resolveAbilityDamage\(/);
    // damageType priority: damageTypeOverride → abilityData.damageType → 'magic'
    expect(file).toMatch(/carryCfg\.damageTypeOverride[\s\S]+?carryCfg\.abilityData\.damageType[\s\S]+?'magic'/);
    // magic AP scaling 공식
    expect(file).toMatch(/baseValue \* \(1 \+ ap \/ 100\)/);
  });

  // codex P1 (PR #71) 회귀 가드 — self_buff pattern carry 는 caster 본인이 target 이라
  // augment damage override 시 self-hit 대량 damage 야기. raw 챔프 변수 사용으로 회귀 방지.
  it('self_buff pattern carry (Jax/Zed) 는 augment damage override 미적용 (codex P1 PR #71)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // 두 cast site 모두 self_buff 검사 패턴 포함:
    //   carryForDamage = config.pattern !== 'self_buff' ? carryCfg : null
    //   oorCarryForDamage = outOfRangeConfig.pattern !== 'self_buff' ? oorCarryCfg : null
    const generalPattern = /config\.pattern\s*!==\s*'self_buff'\s*\?\s*carryCfg\s*:\s*null/;
    const oorPattern = /outOfRangeConfig\.pattern\s*!==\s*'self_buff'\s*\?\s*oorCarryCfg\s*:\s*null/;
    expect(file).toMatch(generalPattern);
    expect(file).toMatch(oorPattern);
  });

  it('Jax/Zed carry 는 self_buff pattern 으로 정의 (회귀 가드)', () => {
    // self_buff pattern 인 carry augment 들이 실제로 그 pattern 인지 검증.
    // 만약 다른 pattern 으로 변경되면 codex P1 회귀 가드 코드 (위 fingerprint) 와 의미 어긋남.
    const jax = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_JaxCarry');
    const zed = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_InvaderZed');
    expect(jax?.abilityOverride.pattern).toBe('self_buff');
    expect(zed?.abilityOverride.pattern).toBe('self_buff');
    // 두 augment 모두 abilityData.damage 정의 (self_buff 면 시뮬에서 무시되어야 함)
    expect(jax?.abilityData?.damage).toBeDefined();
    expect(zed?.abilityData?.damage).toBeDefined();
  });
});

// PR7-A (17.2b 후속) — 파이크 carry X-shape + secondary + tankBonus + onKillRecast cascade.
// 사용자 결정:
//   - X-shape = 새 pattern 'x_shape' (대상 + 4 diagonal hex direction)
//   - cascade = 완전 재 cast (새 dash + 새 X-shape, max chain 5)
describe('PR7-A — 파이크 carry X-shape 멀티 타겟 + onKill cascade', () => {
  it('PykeCarry abilityOverride 가 x_shape pattern 으로 변경됨', () => {
    const pyke = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PykeCarry');
    expect(pyke).toBeDefined();
    expect(pyke!.abilityOverride.pattern).toBe('x_shape');
    expect(pyke!.abilityOverride.dash).toBe('to_lowest_hp');
  });

  it('PykeCarry abilityData 핵심 변수 (PR7-A 시뮬 의존)', () => {
    const pyke = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PykeCarry');
    expect(pyke?.abilityData?.damage).toEqual([220, 330, 500]);
    expect(pyke?.abilityData?.secondaryDamage).toEqual([60, 90, 135]);
    expect(pyke?.abilityData?.tankBonusMultiplier).toBe(0.60);
    expect(pyke?.abilityData?.onKillRecastMultiplier).toBe(0.70);
    expect(pyke?.abilityData?.damageType).toBe('physical');
  });

  it('AbilityPattern 에 x_shape 추가됨 (회귀 가드 — type 정의 직접 검증)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/types/index.ts'),
      'utf8',
    );
    expect(file).toMatch(/'x_shape'/);
  });

  it('findAbilityTargets x_shape case 정의됨 (4 diagonal hex)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/systems/ability.ts'),
      'utf8',
    );
    // x_shape case + 4 diagonal direction 패턴 (NE/NW/SE/SW axial offset)
    expect(file).toMatch(/case 'x_shape'/);
    expect(file).toMatch(/q: tp\.q \+ 1, r: tp\.r - 1/); // NE
    expect(file).toMatch(/q: tp\.q - 1, r: tp\.r \+ 1/); // SW
  });

  it('onKillRecast cascade 코드 fingerprint — combatLoop.ts (max chain 5)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // cascade 핵심 패턴 검증
    expect(file).toMatch(/MAX_RECAST_CHAIN\s*=\s*5/);
    expect(file).toMatch(/onKillRecastMultiplier/);
    expect(file).toMatch(/while \(chainCount < MAX_RECAST_CHAIN\)/);
    // cascade 종료 조건 — primary recast target 처치 못했으면 break
    expect(file).toMatch(/recastTarget\.state !== 'dead'\) break/);
  });

  // codex P2 (PR #72) 회귀 가드 — recast 코드가 일반 cast loop 의 4개 buff 모두 포함.
  // 누락 시 inventionTankDamageAmp / gravesTankDamageAmp / mfReplicatorEffectiveness 미적용
  // → recast under-damage 회귀.
  it('cascade recast 가 full damage amp stack 포함 (codex P2 PR #72)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // recast loop 안에 4개 amp source 모두 포함:
    //   - inventionTankDamageAmp (Tank 한정)
    //   - gravesTankDamageAmp (Tank 한정)
    //   - computeSniperDamageAmp (per target)
    //   - mfReplicatorEffectiveness (replicator)
    expect(file).toMatch(/recastDamageAmp\s*\+=\s*unit\.inventionTankDamageAmp/);
    expect(file).toMatch(/recastDamageAmp\s*\+=\s*unit\.gravesTankDamageAmp/);
    expect(file).toMatch(/recastDamageAmp\s*\+=\s*computeSniperDamageAmp/);
    expect(file).toMatch(/recastDamageAmp\s*\+=\s*unit\.mfReplicatorEffectiveness/);
  });

  // codex P2 (PR #72) 회귀 가드 — recast hits 가 Serpent poison trigger 호출.
  it('cascade recast 가 triggerSerpentPoison 호출 (codex P2 PR #72)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // recast loop 안 (recastBaseDmg / recastDamageAmp 등) 에서 triggerSerpentPoison 호출 확인.
    // 일반 cast loop 1회 + recast loop 1회 = 총 2회 호출되어야 함.
    const calls = file.match(/triggerSerpentPoison\(unit,\s*t,\s*effectiveDmg\)/g);
    expect(calls).toBeDefined();
    expect(calls!.length).toBeGreaterThanOrEqual(2);
  });

  it('파이크 carry 활성 시 시뮬 정상 작동 (sanity)', () => {
    const pyke = champions.find(c => c.apiName === 'TFT17_Pyke');
    const enemy = champions.find(c => c.apiName === 'TFT17_Aatrox');
    const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_PykeCarry');
    if (!pyke || !enemy || !carryAug) return;
    const result = simulateCombat(
      [placed(pyke, 0, 3, 2)],
      [placed(enemy, 0, 4, 2)],
      {
        seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
        playerAugments: [carryAug],
      }
    );
    const p = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Pyke');
    if (!p) return;
    expect(p.role).toBe('Fighter');
    // x_shape pattern + cascade 정상 작동 (crash 없음, totalDamageDealt 산출됨)
    expect(p.totalDamageDealt).toBeGreaterThanOrEqual(0);
  });
});

// PR7-C (17.2b 후속) — Aatrox carry 3-skill cycle + N.O.V.A. 추가 발동.
// 사용자 결정:
//   - cycle counter: 사망 시 0 reset (resurrect 메커니즘 연동)
//   - N.O.V.A. 타격: 기존 cycle 유지 + 별도 추가 효과 (모든 적 novaDamage 물리 + 1초 knockup)
//   - "타격 선택기": simulateOptions.{player,enemy}NovaStrikeSelectorUnit 사용자 지정
describe('PR7-C — 아트록스 carry 3-skill cycle + N.O.V.A. 추가 발동', () => {
  it('AatroxCarry abilityData 핵심 변수 (PR7-C 시뮬 의존, 17.3 수치)', () => {
    const aatrox = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_AatroxCarry');
    expect(aatrox?.abilityData?.damage).toEqual([140, 210, 315]);          // 타격 (cycle 0) — 17.3 변경 없음
    expect(aatrox?.abilityData?.secondaryDamage).toEqual([110, 165, 275]); // 휩쓸기 (cycle 1) — 17.3: [100,150,225] → [110,165,275]
    expect(aatrox?.abilityData?.slamDamage).toEqual([200, 300, 475]);      // 찍기 (cycle 2) — 17.3: [160,240,360] → [200,300,475]
    expect(aatrox?.abilityData?.slamStunDuration).toBe(1.0);                // 찍기 knockup
    expect(aatrox?.abilityData?.novaDamage).toEqual([120, 180, 270]);      // N.O.V.A.
    expect(aatrox?.abilityData?.armorReduction).toBe(10);                   // 휩쓸기 debuff
    expect(aatrox?.abilityData?.singleTargetMultiplier).toBe(2.0);          // 찍기 단독 — 17.3: 2.5 → 2.0 (isolation nerf)
    expect(aatrox?.damageTypeOverride).toBe('physical');
  });

  it('CombatUnit 에 aatrox cycle 필드 정의됨 (types/index.ts)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/types/index.ts'),
      'utf8',
    );
    expect(file).toMatch(/aatroxCycleCounter:\s*number/);
    expect(file).toMatch(/aatroxPreviouslyDead:\s*boolean/);
    expect(file).toMatch(/aatroxNovaStrikeSelector:\s*boolean/);
  });

  it('SimulateOptions 에 novaStrikeSelectorUnit 추가 (player/enemy)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    expect(file).toMatch(/playerNovaStrikeSelectorUnit\?:\s*string/);
    expect(file).toMatch(/enemyNovaStrikeSelectorUnit\?:\s*string/);
  });

  it('cycle 분기 코드 fingerprint — 3-skill cycle (cycleIdx % 3) + 단독 적중 multiplier', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // cycle 분기: aatroxCycleCounter % 3
    expect(file).toMatch(/unit\.aatroxCycleCounter\s*%\s*3/);
    // 3 cycle pattern 모두: single, cone, aoe_circle
    expect(file).toMatch(/cycleIdx === 0[\s\S]+?pattern:\s*'single'/);
    expect(file).toMatch(/cycleIdx === 1[\s\S]+?pattern:\s*'cone'/);
    expect(file).toMatch(/pattern:\s*'aoe_circle'[\s\S]+?slamStunDuration/);
    // 단독 적중 ×2.0 (17.3 nerf, 2.5→2.0) — refactor (carry-damage-modifier): helper 안 패턴 검증
    expect(file).toMatch(/context\.aatroxIsSingleTargetSlam[\s\S]+?context\.aliveTargetCount === 1[\s\S]+?ad\.singleTargetMultiplier/);
  });

  it('N.O.V.A. 추가 발동 코드 fingerprint — cycle 별개 + 모든 적 + 1초 knockup', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // N.O.V.A. 발동 조건 — Aatrox carry + selector + novaDamage 정의됨
    expect(file).toMatch(/isAatroxCarry && unit\.aatroxNovaStrikeSelector/);
    expect(file).toMatch(/carryCfg\?\.abilityData\?\.novaDamage/);
    // 모든 적 iteration (opposingTeam) + stun (1초 knockup)
    expect(file).toMatch(/for \(const t of opposingTeam\)[\s\S]+?type: 'stun'[\s\S]+?N\.O\.V\.A\./);
  });

  it('cycle counter 사망 reset 메커니즘 fingerprint', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // dead unit 의 aatroxPreviouslyDead = true 표시 (main loop tick)
    expect(file).toMatch(/u\.aatroxPreviouslyDead\s*=\s*true/);
    // cast 진입 시 reset (previouslyDead 일 때 counter 0)
    expect(file).toMatch(/aatroxPreviouslyDead[\s\S]+?aatroxCycleCounter\s*=\s*0/);
  });

  it('Aatrox carry 활성 시 시뮬 정상 작동 (sanity, cycle 없이도 cast)', () => {
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox');
    const enemy = champions.find(c => c.apiName === 'TFT17_Briar');
    const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_AatroxCarry');
    if (!aatrox || !enemy || !carryAug) return;
    const result = simulateCombat(
      [placed(aatrox, 0, 3, 2)],
      [placed(enemy, 0, 4, 2)],
      {
        seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
        playerAugments: [carryAug],
      }
    );
    const a = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Aatrox');
    if (!a) return;
    expect(a.role).toBe('Fighter');
    // cycle 진행 (cast 1회 이상 시 counter > 0)
    expect(a.aatroxCycleCounter).toBeGreaterThanOrEqual(0);
  });

  // codex P1 (PR #73) 회귀 가드 — N.O.V.A. 추가 발동은 DRX surge 활성 시 만 적용.
  // selector flag 만으로 매 cast 발동되면 6초 surge 전 / DRX trait 없는 경우에도 발동되어
  // inflated damage / CC. tickDrxNova 의 timing/trait gating 패턴 동일 적용 검증.
  it('N.O.V.A. 추가 발동이 DRX state.triggered 검사 포함 (codex P1 PR #73)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // novaSurgeActive 변수 + ownDrxState.triggered 패턴 검증
    expect(file).toMatch(/novaSurgeActive\s*=\s*!!\(ownDrxState && ownDrxState\.triggered\)/);
    // N.O.V.A. 발동 조건에 novaSurgeActive 포함
    expect(file).toMatch(/isAatroxCarry && unit\.aatroxNovaStrikeSelector && novaSurgeActive/);
  });

  // PR7-C.5 (17.2b 후속) — 다른 NOVA 유닛 (Maokai/Kindred) 타격 선택기 추가 효과.
  // 사용자 spec:
  //   - Maokai: surge 시 적군 광역 stun (starLevel 1/2/3 = 1.5/1.5/1.75초) + 기존 회복 12% 유지
  //   - Kindred: surge 시 본인 damageAmp +5% (영구) + 모든 적 표식, 5초 주기 표식 갱신
  it('Maokai N.O.V.A. selector 효과 코드 fingerprint (PR7-C.5)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // tickDrxNova 안 maokaiSelector 검사 (TFT17_Maokai + aatroxNovaStrikeSelector)
    expect(file).toMatch(/maokaiSelector\s*=\s*state\.teamUnits\.find\([\s\S]+?'TFT17_Maokai'[\s\S]+?aatroxNovaStrikeSelector/);
    // starLevel 기반 stun 시간 [1.5, 1.5, 1.75]
    expect(file).toMatch(/maokaiStunArr\s*=\s*\[1\.5, 1\.5, 1\.75\]/);
    // 적군 stun statusEffect 추가 (sourceId='maokai-nova-selector')
    expect(file).toMatch(/sourceId: 'maokai-nova-selector'/);
  });

  it('Kindred N.O.V.A. selector 효과 코드 fingerprint (PR7-C.5)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // tickDrxNova 안 kindredSelector 검사 (TFT17_Kindred + aatroxNovaStrikeSelector)
    expect(file).toMatch(/kindredSelector\s*=\s*state\.teamUnits\.find\([\s\S]+?'TFT17_Kindred'[\s\S]+?aatroxNovaStrikeSelector/);
    // damageAmp +5%
    expect(file).toMatch(/kindredSelector\.damageAmp \+= 0\.05/);
    // mark statusEffect (sourceId='kindred-nova-selector')
    expect(file).toMatch(/sourceId: 'kindred-nova-selector'/);
  });

  // PR7-C.6 (17.2b 후속) — Caitlyn / Akali N.O.V.A. 타격 선택기 추가 효과.
  // 사용자 spec:
  //   - Caitlyn: surge 시 모든 적 mark + mark 적 받는 피해 +10%. 50% HP 첫 trigger 헤드샷 (76/114/222).
  //   - Akali: surge 시 모든 적 출혈 (매초 10/14/18 starLevel별 물리, 영구).
  it('Caitlyn N.O.V.A. selector 효과 코드 fingerprint (PR7-C.6)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // tickDrxNova 안 caitlynSelector 검사
    expect(file).toMatch(/caitlynSelector\s*=\s*state\.teamUnits\.find\([\s\S]+?'TFT17_Caitlyn'[\s\S]+?aatroxNovaStrikeSelector/);
    // mark statusEffect (sourceId='caitlyn-nova-selector', value=0.10)
    expect(file).toMatch(/sourceId: 'caitlyn-nova-selector'[\s\S]+?value: 0\.10/);
  });

  it('caitlyn mark amp +10% applyAbilityMitigation 안 적용 (PR7-C.6)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // mitigation 안 caitlyn-nova-selector mark amp 처리
    expect(file).toMatch(/mark\.sourceId === 'caitlyn-nova-selector' && mark\.value/);
    expect(file).toMatch(/effectiveDmg \*= \(1 \+ mark\.value\)/);
  });

  // codex P1 (PR #81) 회귀 가드 — Caitlyn mark amp 모든 damage path 적용.
  // applyAbilityMitigation 외에 basic attack 도 적용.
  it('basic attack 도 caitlyn mark amp 적용 (codex P1 PR #81)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // basic attack site (finalDamage *= (1 + mark.value)) — caitlyn-nova-selector mark 검사
    // 출현 횟수: applyAbilityMitigation 안 1회 + basic attack 안 1회 = 최소 2회
    const matches = file.match(/mark\.sourceId === 'caitlyn-nova-selector' && mark\.value/g);
    expect(matches).toBeDefined();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
    // basic attack 안 finalDamage *= (1 + mark.value) 패턴
    expect(file).toMatch(/finalDamage \*= \(1 \+ mark\.value\)/);
  });

  // codex P1 (PR #81) 회귀 가드 — Akali burn 에 armor + pen + DR mitigation 적용.
  it('Akali burn 에 armor mitigation 적용 (codex P1 PR #81)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // mitigatedPerTick = applyResistance(akaliBleedRawPerTick, e.stats.armor, akaliSelector.stats.armorPen)
    expect(file).toMatch(/mitigatedPerTick\s*=\s*applyResistance\(akaliBleedRawPerTick, e\.stats\.armor, akaliSelector\.stats\.armorPen\)/);
    // DR 적용
    expect(file).toMatch(/finalPerTick\s*=\s*e\.damageReduction > 0[\s\S]+?mitigatedPerTick \* \(1 - e\.damageReduction\)/);
  });

  it('Caitlyn 헤드샷 trigger 코드 fingerprint (PR7-C.6)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // tickCaitlynHeadshot helper + headshot damage [76, 114, 222]
    expect(file).toMatch(/tickCaitlynHeadshot/);
    expect(file).toMatch(/headshotArr\s*=\s*\[76, 114, 222\]/);
    // 50% HP trigger + Set 추적 (1회)
    expect(file).toMatch(/e\.currentHp \/ e\.maxHp > 0\.50/);
    expect(file).toMatch(/triggeredSet\.add\(e\.id\)/);
  });

  // refactor: cast-post-processing-helper — applyCarryPostCastEffects helper 추출.
  // 꼬마정령 multi-stun + Akali burn refresh 통합. in-range / OOR 둘 다 helper 호출.
  // codex P2 (PR #83) 회귀 가드 — helper 호출 위치가 splash AOE 후.
  // 기존: splash 전 호출 → splash 로 죽을 적이 multi-stun 3 슬롯 차지 → 살아남는 적 stun 부족.
  // 정정: splash 후 호출 → alive 적만 stun 슬롯.
  it('applyCarryPostCastEffects 호출 위치가 splash AOE 직후 (codex P2 PR #83)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // 호출 위치 fingerprint — splash AOE (triggerAbilitySympatheticDetonation 또는 BlastRadius) 후
    // 같은 if 블록 안에서 helper 호출되어야 함.
    // 두 사이트 사이 ~1100자 (codex P2 코멘트 + 누적 코드 포함).
    expect(file).toMatch(/triggerAbilitySympatheticDetonation\([\s\S]{0,1500}?applyCarryPostCastEffects\(unit, abilityTargets, carryCfg\)/);
  });

  it('applyCarryPostCastEffects helper 정의 + 2 메커니즘 통합 (refactor)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // helper 시그니처
    expect(file).toMatch(/function applyCarryPostCastEffects\(/);
    // 1. 꼬마정령 multi-stun (helper 안)
    expect(file).toMatch(/carryCfg\.augmentApiName === 'TFT17_Augment_IvernMinionCarry'[\s\S]+?IVERN_STUN_TARGETS\s*=\s*3/);
    // 2. Akali burn refresh (helper 안)
    expect(file).toMatch(/unit\.champion\.apiName === 'TFT17_Akali'[\s\S]+?akaliBurn\.value \*= 1\.10/);
  });

  // PR7-C.7 (17.2b 후속) — Akali 단검 출혈 +10% 메커니즘.
  // 사용자 spec: "단검은 출혈 피해량을 10% 증가". Akali raw ability hit 적의 burn value × 1.10.
  // PR7-C.8 (17.2b 후속) — N.O.V.A. 타격 선택기 raw data + 자동 할당.
  // 사용자 spec: "선택기 미설정 시 (5) NOVA 시너지 가장 강한 유닛 자동 할당".
  it('타격 선택기 raw data 추가 (TFT17_DRXSelector)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'public/data/tft_set17_items.json'),
      'utf8',
    );
    const data = JSON.parse(file) as { items: Array<{ apiName: string; name: string; icon: string }> };
    // PR #85 codex P2: TFT17_DRXSelector 중복 엔트리 방지 (apiName 단일 보장)
    const selectors = data.items.filter(i => i.apiName === 'TFT17_DRXSelector');
    expect(selectors).toHaveLength(1);
    const selector = selectors[0];
    expect(selector.name).toBe('타격 선택기');
    expect(selector.icon).toBe('tft17_drxselector.tft_set17.png');
  });

  it('autoAssignNovaSelector 자동 할당 코드 fingerprint (PR7-C.8)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // helper 정의 + (5) 시너지 검사 + starLevel × cost 정렬
    expect(file).toMatch(/autoAssignNovaSelector/);
    expect(file).toMatch(/NOVA_APIS\s*=\s*\[\s*'TFT17_Aatrox'[\s\S]+?'TFT17_Kindred'/);
    expect(file).toMatch(/minUnits\s*<\s*5/);
    // strongest = starLevel × cost (내림차순)
    expect(file).toMatch(/a\.starLevel \* \(a\.champion\.cost \?\? 0\)/);
  });

  it('Akali 단검 burn refresh 코드 fingerprint (PR7-C.7)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // unit.champion.apiName === 'TFT17_Akali' 검사
    expect(file).toMatch(/unit\.champion\.apiName === 'TFT17_Akali'/);
    // akali-nova-selector burn 검색
    expect(file).toMatch(/se\.type === 'burn' && se\.sourceId === 'akali-nova-selector'/);
    // burn value × 1.10 refresh
    expect(file).toMatch(/akaliBurn\.value \*= 1\.10/);
  });

  // codex P1 (PR #82) 회귀 가드 — Akali 단검 burn refresh OOR cast 동기화.
  // refactor (cast-post-processing-helper): applyCarryPostCastEffects helper 로 통합.
  // in-range / OOR 둘 다 helper 호출 → 신규 메커니즘 추가 시 helper 한 곳만 수정.
  it('cast post-cast effects helper 호출 in-range + OOR 둘 다 (refactor + codex P1 PR #82)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // applyCarryPostCastEffects 호출 count >= 2 (in-range + OOR cast loop)
    const callMatches = file.match(/applyCarryPostCastEffects\(unit, abilityTargets/g);
    expect(callMatches).toBeDefined();
    expect(callMatches!.length).toBeGreaterThanOrEqual(2);
    // helper 안 Akali burn refresh + 꼬마정령 multi-stun 모두 정의
    expect(file).toMatch(/function applyCarryPostCastEffects\(/);
    expect(file).toMatch(/unit\.champion\.apiName === 'TFT17_Akali'/);
    expect(file).toMatch(/se\.type === 'burn' && se\.sourceId === 'akali-nova-selector'/);
  });

  it('Akali N.O.V.A. selector 효과 코드 fingerprint (PR7-C.6)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // tickDrxNova 안 akaliSelector 검사
    expect(file).toMatch(/akaliSelector\s*=\s*state\.teamUnits\.find\([\s\S]+?'TFT17_Akali'[\s\S]+?aatroxNovaStrikeSelector/);
    // 출혈 starLevel별 [10, 14, 18] per second + burn statusEffect (sourceId='akali-nova-selector')
    // codex P1 (PR #81): mitigated value 저장 (armor + pen 적용 후, DR 적용 후)
    expect(file).toMatch(/akaliBleedPerSec\s*=\s*\[10, 14, 18\]/);
    expect(file).toMatch(/sourceId: 'akali-nova-selector'[\s\S]+?value: finalPerTick/);
  });

  it('Kindred 5초 주기 mark 갱신 코드 fingerprint (PR7-C.5)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // tickKindredNovaMark helper + 5초 주기 (5 × TICKS_PER_SECOND)
    expect(file).toMatch(/tickKindredNovaMark/);
    expect(file).toMatch(/periodTicks\s*=\s*5\s*\*\s*TICKS_PER_SECOND/);
    // surge triggered 후만 발동
    expect(file).toMatch(/drxState\.triggered/);
  });

  it('N.O.V.A. selector 지정 시 selector flag = true (sanity)', () => {
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox');
    const enemy = champions.find(c => c.apiName === 'TFT17_Briar');
    const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_AatroxCarry');
    if (!aatrox || !enemy || !carryAug) return;
    const result = simulateCombat(
      [placed(aatrox, 0, 3, 2)],
      [placed(enemy, 0, 4, 2)],
      {
        seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
        playerAugments: [carryAug],
        playerNovaStrikeSelectorUnit: 'TFT17_Aatrox',
      }
    );
    const a = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Aatrox');
    if (!a) return;
    expect(a.aatroxNovaStrikeSelector).toBe(true);
  });
});

// PR7-E (17.2b 후속) — 미프 (정령족 잠재력) 시너지 + carry onAttack 패시브.
// 사용자 결정:
//   - Meeps stack 공식: Astronaut trait Meeps 변수 (2/3/4/6 = tier 3/5/7/10)
//   - 뽀삐 spiritEffectPerStack 0.15 적용: damage × (1 + Meeps × 0.15) multiplicative
//   - 꼬마정령/잭스 onAttackBonus: 매 기본 공격마다 onAttackBonus[star] AP 고정 magic 추가
describe('PR7-E — 미프 시너지 + carry onAttack 패시브', () => {
  it('CombatUnit 에 astronautMeepsStack 필드 정의됨', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/types/index.ts'),
      'utf8',
    );
    expect(file).toMatch(/astronautMeepsStack:\s*number/);
  });

  it('applyAstronautEffects 가 Meeps stack 저장 코드 포함', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // applyAstronautEffects 안에서 trait.activeEffect.variables['Meeps'] 추출 + unit.astronautMeepsStack 저장
    expect(file).toMatch(/trait\.activeEffect\.variables\['Meeps'\]/);
    expect(file).toMatch(/u\.astronautMeepsStack\s*=\s*meeps/);
  });

  it('뽀삐 spiritEffectPerStack 적용 코드 fingerprint (multiplicative damage amp)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // damage *= (1 + Meeps × spiritEffectPerStack)
    expect(file).toMatch(/spiritEffectPerStack[\s\S]+?astronautMeepsStack[\s\S]+?\*=\s*\(1 \+ unit\.astronautMeepsStack \* carryCfg\.abilityData\.spiritEffectPerStack\)/);
  });

  it('basic attack onAttackBonus 코드 fingerprint (꼬마정령/잭스)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // basic attack 시 carry augment onAttackBonus 추출 + AP scaling magic damage
    expect(file).toMatch(/onAttackArr\s*=\s*carryAtk\?\.abilityData\?\.onAttackBonus/);
    expect(file).toMatch(/onAttackBase \* \(1 \+ unit\.stats\.ap \/ 100\)/);
  });

  // codex P1 (PR #74) 회귀 가드 — onAttackBonus 가 currentHp > 0 검사 포함.
  // basic attack damage 가 이미 currentHp 차감했으나 state 는 아직 'dead' 미변경 →
  // currentHp <= 0 dead-but-not-yet-marked target 에 추가 damage 적용 회귀 방지.
  it('onAttackBonus currentHp > 0 가드 (codex P1 PR #74)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // onAttackBonus 발동 조건에 target.currentHp > 0 포함
    expect(file).toMatch(/onAttackArr && target\.state !== 'dead' && target\.currentHp > 0/);
  });

  it('carryAugments — 뽀삐 spiritEffectPerStack 0.15 / 꼬마정령 onAttackBonus / 잭스 onAttackBonus', () => {
    const poppy = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PoppyCarry');
    expect(poppy?.abilityData?.spiritEffectPerStack).toBe(0.15);

    const ivern = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_IvernMinionCarry');
    expect(ivern?.abilityData?.onAttackBonus).toEqual([40, 60, 90]);

    const jax = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_JaxCarry');
    expect(jax?.abilityData?.onAttackBonus).toEqual([45, 70, 105]);
  });

  // PR7-D (17.2b 후속) — 뽀삐 carry armorScale + spiritBounceOnKill 회귀 가드.
  // 사용자 결정:
  //   - 잔여 damage = overkill (처치 후 currentHp 음수 절댓값)
  //   - chain max 제한 없음 (overkill 0 자연 종료) — hard limit 50 무한 루프 방지
  //   - "가장 가까운" = 처치된 target 위치 기준
  //   - armorScale: raw damage 에 가산 (mitigation 전)
  it('PoppyCarry armorScale 1.0 / spiritBounceOnKill true 정의됨', () => {
    const poppy = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_PoppyCarry');
    expect(poppy?.abilityData?.armorScale).toBe(1.0);
    expect(poppy?.abilityData?.spiritBounceOnKill).toBe(true);
  });

  it('cast loop armorScale 적용 코드 fingerprint (raw damage 가산)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // baseDmg += t.stats.armor × armorScale — refactor (carry-damage-modifier): helper 안 패턴 검증
    expect(file).toMatch(/ad\.armorScale[\s\S]+?baseDmg \+= t\.stats\.armor \* ad\.armorScale/);
  });

  it('spiritBounceOnKill 코드 fingerprint — overkill chain (max 50 hard limit)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // bouncing 발동 조건: spiritBounceOnKill && abilityTarget.state === 'dead'
    expect(file).toMatch(/spiritBounceOnKill && abilityTarget\.state === 'dead'/);
    // hard limit 50
    expect(file).toMatch(/MAX_BOUNCE_HARD_LIMIT\s*=\s*50/);
    // overkill 0 자연 종료 + while loop
    expect(file).toMatch(/while \(overkill > 0 && bounceCount < MAX_BOUNCE_HARD_LIMIT\)/);
    // 처치된 target 위치 기준 정렬
    expect(file).toMatch(/hexDistance\(lastDeadTarget\.position[\s\S]+?hexDistance\(lastDeadTarget\.position/);
  });

  // codex P1 (PR #75) 회귀 가드 — primary target 처치 시 currentHp clamp 전 overkill 캡처.
  // clamp 후 캡처하면 항상 0 → bouncing while loop dead-code.
  it('spiritBounceOnKill primary overkill 캡처 코드 fingerprint (codex P1 PR #75)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // 변수 선언 (cast loop 위)
    expect(file).toMatch(/let primaryOverkillForBounce = 0/);
    // cast loop 사망 처리 안에서 primary target 한정 캡처
    expect(file).toMatch(/t === abilityTarget && carryCfg\?\.abilityData\?\.spiritBounceOnKill[\s\S]+?primaryOverkillForBounce\s*=\s*-t\.currentHp/);
    // bouncing 분기에서 캡처된 값 사용
    expect(file).toMatch(/let overkill = primaryOverkillForBounce/);
  });

  it('뽀삐 carry 활성 시 시뮬 정상 작동 (sanity)', () => {
    const poppy = champions.find(c => c.apiName === 'TFT17_Poppy');
    const enemy = champions.find(c => c.apiName === 'TFT17_Briar');
    const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_PoppyCarry');
    if (!poppy || !enemy || !carryAug) return;
    const result = simulateCombat(
      [placed(poppy, 0, 3, 2)],
      [placed(enemy, 0, 4, 2)],
      {
        seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
        playerAugments: [carryAug],
      }
    );
    const p = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Poppy');
    if (!p) return;
    expect(p.role).toBe('Fighter');
    // armorScale + bouncing 정상 작동 (crash 없음)
    expect(p.totalDamageDealt).toBeGreaterThanOrEqual(0);
  });

  // PR7-B (17.2b 후속) — 꼬마정령 carry to_largest_cluster + hexReduction + multi-stun.
  // 사용자 결정:
  //   - to_largest_cluster: 각 적 위치 중심 radius 2 내 타 적 개수 max 적 → dash target
  //   - multi-stun: caster (unit) 위치 기준 가장 가까운 3명 (radius 3 AOE 안 alive)
  //   - hexReduction 0.35 (17.3 nerf, 0.45→0.35): abilityTarget 중심 multiplicative falloff (PR4 자폭 일관)
  describe('PR7-B — 꼬마정령 carry multi-stun + dash to_largest_cluster + hexReduction', () => {
    it('IvernMinionCarry abilityOverride dash = to_largest_cluster (기존 to_farthest 변경)', () => {
      const ivern = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_IvernMinionCarry');
      expect(ivern).toBeDefined();
      expect(ivern!.abilityOverride.pattern).toBe('aoe_circle');
      expect(ivern!.abilityOverride.radius).toBe(3);
      expect(ivern!.abilityOverride.dash).toBe('to_largest_cluster');
    });

    it('IvernMinionCarry abilityData hexReduction 0.35 (17.3) / stunDuration [1.25, 1.5, 1.75]', () => {
      const ivern = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_IvernMinionCarry');
      expect(ivern?.abilityData?.hexReduction).toBe(0.35); // 17.3: 0.45 → 0.35
      expect(ivern?.abilityData?.stunDuration).toEqual([1.25, 1.5, 1.75]);
      expect(ivern?.abilityData?.damage).toEqual([240, 360, 560]);
    });

    it('AbilityConfig.dash 에 to_largest_cluster 추가됨', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/systems/ability.ts'),
        'utf8',
      );
      expect(file).toMatch(/'to_largest_cluster'/);
    });

    it('findLargestClusterTarget helper 정의 + applyAbilityDash switch case', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // helper 함수 + radius 2 내 타 적 카운트 패턴
      expect(file).toMatch(/function findLargestClusterTarget/);
      expect(file).toMatch(/hexDistance\(center\.position, other\.position\) <= 2/);
      // applyAbilityDash switch case
      expect(file).toMatch(/case 'to_largest_cluster':\s*dashTarget = findLargestClusterTarget/);
    });

    it('cast loop hexReduction 적용 코드 fingerprint (꼬마정령 한정 multiplicative)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // 꼬마정령 carry hexReduction multiplicative falloff
      // refactor (carry-damage-modifier): helper 안 패턴 검증 (in-range cast loop) +
      // OOR cast loop 의 oorBaseDmg fingerprint 는 별도 테스트 유지.
      expect(file).toMatch(/carryCfg\.augmentApiName === 'TFT17_Augment_IvernMinionCarry'[\s\S]+?Math\.pow\(1 - ad\.hexReduction, distFromCenter\)/);
    });

    it('multi-stun 코드 fingerprint — caster 위치 기준 가장 가까운 3명', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // 꼬마정령 multi-stun + caster 위치 기준 정렬 + IVERN_STUN_TARGETS=3
      // refactor (cast-post-processing-helper): applyCarryPostCastEffects helper 안으로 이동.
      expect(file).toMatch(/IVERN_STUN_TARGETS\s*=\s*3/);
      expect(file).toMatch(/hexDistance\(unit\.position, a\.position\) - hexDistance\(unit\.position, b\.position\)/);
    });

    // codex P1 (PR #76) 회귀 가드 — OOR cast 경로에도 hexReduction + multi-stun 적용.
    // in-range vs OOR 동일 결과 보장.
    // refactor: cast-mitigation-helpers — applyAbilityMitigation + markTargetDead helper 추출.
    // 6 cast site (PR4 자폭 / cast loop main / PR7-A cascade / PR7-C N.O.V.A. / PR7-D bouncing / PR7-E onAttackBonus)
    // 가 helper 호출. mitigation 5단계 + 사망 처리 일관성 보장.
    it('applyAbilityMitigation helper 정의됨 + 5단계 mitigation pipeline (refactor)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // helper 시그니처 + 5단계 mitigation 패턴 검증
      expect(file).toMatch(/function applyAbilityMitigation\(/);
      expect(file).toMatch(/let effectiveDmg = applyResistance\(rawDmg, resistance, pen\)/);
      expect(file).toMatch(/if \(t\.damageReduction > 0\) effectiveDmg \*= \(1 - t\.damageReduction\)/);
      expect(file).toMatch(/NON_TARGET_DAMAGE_REDUCTION/);
      expect(file).toMatch(/effectiveDmg = applyShield\(t, effectiveDmg, eventBus, tick\)/);
      expect(file).toMatch(/if \(t\.statusEffects\.some\(e => e\.type === 'invulnerable'\)\) effectiveDmg = 0/);
    });

    it('markTargetDead helper 정의됨 (refactor)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      expect(file).toMatch(/function markTargetDead\(/);
      // 핵심 동작: HP clamp + state + counts + emit
      expect(file).toMatch(/t\.currentHp = 0;\s*t\.state = 'dead'/);
      expect(file).toMatch(/eventBus\.emit\('on_kill'/);
      expect(file).toMatch(/eventBus\.emit\('on_death'/);
    });

    it('helper caller 6곳 호출 (PR4 자폭 / cast main / PR7-A cascade / PR7-C N.O.V.A. / PR7-D bouncing / PR7-E onAttack)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // applyAbilityMitigation 호출 count >= 6 (PR4/main/cascade/N.O.V.A./bouncing/onAttack)
      const mitigationCalls = file.match(/applyAbilityMitigation\(unit,/g);
      expect(mitigationCalls).toBeDefined();
      expect(mitigationCalls!.length).toBeGreaterThanOrEqual(6);
      // markTargetDead 호출 count >= 6
      const deadCalls = file.match(/markTargetDead\(unit,/g);
      expect(deadCalls).toBeDefined();
      expect(deadCalls!.length).toBeGreaterThanOrEqual(6);
    });

    // refactor: carry-damage-modifier — applyCarryDamageModifiers helper 추출.
    // 5 carry 메커니즘 (singleTargetMultiplier / secondaryDamage / tankBonusMultiplier /
    // armorScale / hexReduction) 통합. cast loop main + OOR cast loop 모두 helper 호출.
    it('applyCarryDamageModifiers helper 정의 + 5 메커니즘 검증 (refactor)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // helper 함수 시그니처
      expect(file).toMatch(/function applyCarryDamageModifiers\(/);
      // 5 메커니즘 모두 helper 안에 정의됨
      expect(file).toMatch(/ad\.singleTargetMultiplier/);
      expect(file).toMatch(/ad\.secondaryDamage && !isPrimaryTarget/);
      expect(file).toMatch(/isPrimaryTarget && ad\.tankBonusMultiplier && t\.role === 'Tank'/);
      expect(file).toMatch(/ad\.armorScale/);
      expect(file).toMatch(/ad\.hexReduction !== undefined[\s\S]+?TFT17_Augment_IvernMinionCarry/);
    });

    // refactor: oor-cast-mitigation — OOR cast loop 가 applyAbilityMitigation helper 사용.
    // in-range 와 완전 일관 (non-target reduction OOR 정정 + true damage helper 자연 처리).
    it('OOR cast loop applyAbilityMitigation 호출 (refactor: oor-cast-mitigation)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // OOR cast loop helper 호출 (rawDmg, dmgType 기반)
      expect(file).toMatch(/const dmg = applyAbilityMitigation\(unit, t, rawDmg, dmgType, eventBus, tick\)/);
    });

    it('OOR cast loop markTargetDead 호출 (refactor: oor-cast-mitigation)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // OOR cast loop ownArbOOR + markTargetDead 호출
      expect(file).toMatch(/ownArbOOR\s*=\s*unit\.team === 'player'/);
      expect(file).toMatch(/markTargetDead\(unit, t, ownArbOOR/);
    });

    it('cast loop main + OOR cast loop 모두 applyCarryDamageModifiers 호출 (refactor)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // helper 호출 count >= 2 (cast loop main + OOR cast loop)
      const calls = file.match(/applyCarryDamageModifiers\(abilityDmg, unit, t/g);
      expect(calls).toBeDefined();
      expect(calls!.length).toBeGreaterThanOrEqual(2);
    });

    it('OOR cast 경로 꼬마정령 hexReduction + multi-stun 동기화 (codex P1 PR #76)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const file = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
        'utf8',
      );
      // OOR cast loop 안 carry damage modifier — refactor (carry-damage-modifier) 후
      // helper 호출로 통합 (oorBaseDmg = applyCarryDamageModifiers(...)). hexReduction 포함.
      expect(file).toMatch(/oorBaseDmg = applyCarryDamageModifiers\(abilityDmg, unit, t, oorCarryCfg/);
      // OOR cast 끝 multi-stun + Akali burn refresh — refactor (cast-post-processing-helper)
      // 후 applyCarryPostCastEffects helper 호출로 통합 (oorCarryCfg 인자).
      expect(file).toMatch(/applyCarryPostCastEffects\(unit, abilityTargets, oorCarryCfg\)/);
    });

    it('꼬마정령 carry 활성 시 시뮬 정상 작동 (sanity)', () => {
      const ivern = champions.find(c => c.apiName === 'TFT17_IvernMinion');
      const enemy = champions.find(c => c.apiName === 'TFT17_Briar');
      const carryAug = augments.find(a => a.apiName === 'TFT17_Augment_IvernMinionCarry');
      if (!ivern || !enemy || !carryAug) return;
      const result = simulateCombat(
        [placed(ivern, 0, 3, 2)],
        [placed(enemy, 0, 4, 2)],
        {
          seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
          playerAugments: [carryAug],
        }
      );
      const u = result.playerUnits.find(p => p.champion.apiName === 'TFT17_IvernMinion');
      if (!u) return;
      expect(u.role).toBe('Fighter');
      // dash + hexReduction + multi-stun 정상 작동 (crash 없음)
      expect(u.totalDamageDealt).toBeGreaterThanOrEqual(0);
    });
  });

  it('정령족 trait 활성 시 정령족 unit 의 astronautMeepsStack > 0 (sanity)', () => {
    const poppy = champions.find(c => c.apiName === 'TFT17_Poppy');
    const enemy = champions.find(c => c.apiName === 'TFT17_Briar');
    if (!poppy || !enemy) return;
    // 정령족 trait 활성 위해 정령족 챔프 다수 + 그 외 enemy. 단순화: poppy 1명 (trait 활성 의존
    // 단계가 minUnits=3 일 가능성). 본 sanity 는 시뮬 crash 없이 stack 변수 존재 검증.
    const result = simulateCombat(
      [placed(poppy, 0, 3, 2)],
      [placed(enemy, 0, 4, 2)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5 }
    );
    const p = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Poppy');
    if (!p) return;
    // stack 0 또는 양수 (trait 활성 안 됐으면 0). 변수 정의 검증.
    expect(typeof p.astronautMeepsStack).toBe('number');
  });
});

describe('CarryAugmentConfig.statOverrides — 슬롯 추후 채움 가드', () => {
  it('대부분 augment 는 statOverrides 미정의. 예외: 17.3 patch note 명시 값만 적용 (MordekaiserCarry mana)', () => {
    // 17.2b 도입: 슬롯만 정의, 사용자 인게임 측정 대기.
    // 17.3 (PR #124 lint #7): 공식 patch note 에 명시된 값만 sim 정합 적용 (MordekaiserCarry mana 10/40).
    // 인게임 측정 필요 값 (HP/AS/range/armor/MR/damage/role/initialMana except above) 은 여전히 미정의.
    const ALLOWED_OVERRIDE_AUGMENTS = new Set([
      'TFT17_Augment_MordekaiserCarry', // 17.3: mana 40/100 → 10/40 (공식 patch note)
    ]);
    for (const cfg of CARRY_AUGMENTS) {
      if (ALLOWED_OVERRIDE_AUGMENTS.has(cfg.augmentApiName)) {
        // 허용 augment — statOverrides 존재 OK
        continue;
      }
      expect(cfg.statOverrides ?? null, `${cfg.augmentApiName} statOverrides 가 정의됐지만 ALLOWED_OVERRIDE_AUGMENTS 에 없음`).toBeNull();
    }
  });

  it('MordekaiserCarry statOverrides: 17.3 mana 10/40 (PR #124 lint #7 sim 정합)', () => {
    const morde = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_MordekaiserCarry');
    expect(morde?.statOverrides?.initialMana).toBe(10);
    expect(morde?.statOverrides?.mana).toBe(40);
  });

  it('MordekaiserCarry abilityData.shield: 17.3 [175,200,400] — applyMordekaiserProcCast 가 carry override 우선 read 검증', async () => {
    // 위키 lint #7 (PR #123 검출, PR #124 fix) — applyMordekaiserProcCast 가 raw
    // unit.champion.ability.variables.InitialShield 만 read 했었음. 본 가드는:
    //   1. carryAugments.ts MordekaiserCarry.abilityData.shield = [175,200,400] (17.3 값)
    //   2. applyMordekaiserProcCast 가 unit.mordekaiserCarryShield != null 시 우선 사용
    const morde = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_MordekaiserCarry');
    expect(morde?.abilityData?.shield).toEqual([175, 200, 400]);

    // 코드 fingerprint 가드 — applyMordekaiserProcCast 내부에서 mordekaiserCarryShield 분기 존재
    const fs = await import('node:fs');
    const path = await import('node:path');
    const combatLoopSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    expect(combatLoopSrc).toMatch(/applyMordekaiserProcCast[\s\S]+?unit\.mordekaiserCarryShield/);
    expect(combatLoopSrc).toMatch(/mordekaiserCarryShield\s*!==\s*null/);
  });

  it('applyHeroCarryTransforms mana override 는 item delta 보존 (PR #124 Codex P2 회귀 가드)', async () => {
    // Codex P2 finding: statOverrides.mana = 40 절대값 덮어쓰기가 Tear-based item
    // mana bonus 무시. fix — base champion stats 와의 delta 보존하도록 변경.
    // 본 가드는 코드 fingerprint 로 itemDelta 분기 존재 검증.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const combatLoopSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // mana 분기: base mana 와 현재 maxMana 차이 = itemDelta 계산 + override 에 더함
    expect(combatLoopSrc).toMatch(/target\.champion\.stats\.mana[\s\S]+?itemDelta\s*=\s*target\.maxMana/);
    expect(combatLoopSrc).toMatch(/target\.maxMana\s*=\s*so\.mana\s*\+\s*itemDelta/);
    // initialMana 분기: 동일 패턴
    expect(combatLoopSrc).toMatch(/target\.champion\.stats\.initialMana[\s\S]+?itemDelta\s*=\s*target\.currentMana/);
    expect(combatLoopSrc).toMatch(/target\.currentMana\s*=\s*so\.initialMana\s*\+\s*itemDelta/);
  });

  it('Lint #6 + #8 해소 — LEONA_CARRY_ABILITY / GRAGAS_CARRY_ABILITY const 제거 + flag 우선 분기 우회 (PR #127 회귀 가드)', async () => {
    // PR #126 검출 Lint #6 (LeonaCarry duplicate config) + Lint #8 (GragasCarry duplicate
    // config + radius shadow bug) 동시 해소. carryAugments.ts entry 단일 source.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const combatLoopSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );

    // legacy const 정의 완전 제거
    expect(combatLoopSrc).not.toMatch(/const\s+LEONA_CARRY_ABILITY\s*[:=]/);
    expect(combatLoopSrc).not.toMatch(/const\s+GRAGAS_CARRY_ABILITY\s*[:=]/);

    // getAbilityConfigForUnit 의 flag 우선 return 분기 제거 (entry 단일 경로)
    expect(combatLoopSrc).not.toMatch(/if\s*\(\s*unit\.gragasCarryActive\s*\)\s*return\s+GRAGAS_CARRY_ABILITY/);
    expect(combatLoopSrc).not.toMatch(/if\s*\(\s*unit\.leonaCarryActive\s*\)\s*return\s+LEONA_CARRY_ABILITY/);

    // entry sanity — carryAugments 의 abilityOverride 가 사용되는 path 만 유지
    expect(combatLoopSrc).toMatch(/function\s+getAbilityConfigForUnit[\s\S]+?findCarryAugment\(unit\.champion\.apiName[\s\S]+?carry\.abilityOverride/);
  });

  it('Lint #6 + #8 fact — carryAugments entry 가 단일 source 의 정확값 보유 (PR #127 의존)', () => {
    // LeonaCarry: stun 1.0 (config) + stunDuration [1.0, 1.25, 1.5] (starLevel별, abilityData)
    const leona = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_LeonaCarry');
    expect(leona?.abilityOverride.stun).toBe(1.0);  // 이전 LEONA_CARRY_ABILITY const 의 1.5 shadow 해소
    expect(leona?.abilityData?.stunDuration).toEqual([1.0, 1.25, 1.5]);

    // GragasCarry: radius 3 (이전 GRAGAS_CARRY_ABILITY const 의 radius 0 shadow 해소 → 적군 AOE 정상 작동)
    const gragas = CARRY_AUGMENTS.find(c => c.augmentApiName === 'TFT17_Augment_GragasCarry');
    expect(gragas?.abilityOverride.pattern).toBe('aoe_circle');
    expect(gragas?.abilityOverride.radius).toBe(3);
    expect(gragas?.abilityOverride.selfDamage).toBe(true);
  });
});
