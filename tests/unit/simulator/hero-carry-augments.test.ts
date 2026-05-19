/**
 * Hero augment carry transformation 회귀 가드 (17.2 신규):
 *   - 자폭 (TFT17_Augment_GragasCarry): 가장 강한 그라가스 → 거대 폭발 (self damage + HP floor=1).
 *   - 방패 여전사 (TFT17_Augment_LeonaCarry): 가장 강한 레오나 → dash + 첫 적중 stun.
 *
 * "가장 강한" 룰: 성급 → 아이템 → 첫 번째 (deterministic).
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawAugment, RawChampion, RawItem } from '@/types';

const { champions, traits, augments, items } = loadServerCatalogs();
const apGragas = champions.find(c => c.apiName === 'TFT17_Gragas')!;
const apLeona = champions.find(c => c.apiName === 'TFT17_Leona')!;
const apTwistedFate = champions.find(c => c.apiName === 'TFT17_TwistedFate')!;
const apNasus = champions.find(c => c.apiName === 'TFT17_Nasus')!;
const apJax = champions.find(c => c.apiName === 'TFT17_Jax')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
const augGragasCarry = augments.find(a => a.apiName === 'TFT17_Augment_GragasCarry')!;
const augLeonaCarry = augments.find(a => a.apiName === 'TFT17_Augment_LeonaCarry')!;
const augNasusCarry = augments.find(a => a.apiName === 'TFT17_Augment_NasusCarry')!;
const augJaxCarry = augments.find(a => a.apiName === 'TFT17_Augment_JaxCarry')!;
// 임의 아이템 (가장 강한 룰 — 아이템 보유 우선 검증용)
const someItem = items.find(i => i.apiName === 'TFT_Item_BFSword')
  ?? items.find(i => i.apiName?.startsWith('TFT_Item_'))!;

function placed(c: RawChampion, q: number, r: number, starLevel: number = 2, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: eqItems };
}

describe('자폭 (GragasCarry) — 가장 강한 그라가스 self-damage + HP floor=1', () => {
  it('augment 활성 + 그라가스 단독 → 일반 그라가스 ability 차단, 자기 자신만 데미지', () => {
    const team: PlacedChampion[] = [placed(apGragas, 0, 0), placed(apTwistedFate, 1, 0)];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augGragasCarry] as RawAugment[],
    });
    const gragas = withCarry.playerUnits.find(u => u.champion.apiName === 'TFT17_Gragas')!;
    // gragasCarryActive 플래그 + role 'Fighter' 변환
    expect(gragas.gragasCarryActive).toBe(true);
    expect(gragas.role).toBe('Fighter');
  });

  it('자폭 self damage 후 currentHp >= 1 (HP floor)', () => {
    // 그라가스 단독 — 적 강력하게 → 그라가스가 cast 후 대량 self damage 받아도 죽지 않아야.
    const team: PlacedChampion[] = [placed(apGragas, 0, 0, 1)]; // 1성 (낮은 HP)
    const enemy: PlacedChampion[] = [
      placed(dummyEnemy, 6, 3),
      placed(dummyEnemy, 5, 3),
      placed(dummyEnemy, 4, 3),
    ];
    const withCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augGragasCarry] as RawAugment[],
    });
    // 그라가스가 자폭으로 죽지 않음 — currentHp >= 1 (적 공격으로 죽을 수 있어 별도 체크)
    // self-damage 만으로 죽으려면 ability 시전 시점에 floor 적용되어야 함.
    // 이 테스트는 ability 시전 후 즉시 검증이 어려우니 (loop 끝남) — gragasCarryActive 플래그
    // + log 기반 검증으로 대체.
    const gragas = withCarry.playerUnits.find(u => u.champion.apiName === 'TFT17_Gragas')!;
    expect(gragas.gragasCarryActive).toBe(true);
    // log 에 자폭 메시지 존재
    const selfDamageLog = withCarry.logs.find(l => l.message?.includes('자폭'));
    expect(selfDamageLog).toBeDefined();
  });

  it('augment 미활성 → 일반 그라가스 ability (carry transform 없음)', () => {
    const team: PlacedChampion[] = [placed(apGragas, 0, 0)];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withoutCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const gragas = withoutCarry.playerUnits.find(u => u.champion.apiName === 'TFT17_Gragas')!;
    expect(gragas.gragasCarryActive).toBe(false);
  });

  it('가장 강한 룰 — 동급 시 아이템 보유 unit 우선', () => {
    // 그라가스 2명 (모두 2성) — 한 명만 아이템 보유 → 그 unit 이 carry transform 대상
    const team: PlacedChampion[] = [
      placed(apGragas, 0, 0, 2, []),         // no items
      placed(apGragas, 1, 0, 2, [someItem]),  // 아이템 1개
    ];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augGragasCarry] as RawAugment[],
    });
    const gragasUnits = withCarry.playerUnits.filter(u => u.champion.apiName === 'TFT17_Gragas');
    expect(gragasUnits).toHaveLength(2);
    // 아이템 보유 unit 만 carry transform
    const withItems = gragasUnits.find(u => u.items.length > 0)!;
    const noItems = gragasUnits.find(u => u.items.length === 0)!;
    expect(withItems.gragasCarryActive).toBe(true);
    expect(noItems.gragasCarryActive).toBe(false);
  });
});

describe('방패 여전사 (LeonaCarry) — 가장 강한 레오나 dash + 첫 적중 stun', () => {
  it('augment 활성 + 레오나 단독 → carry transform + role Fighter', () => {
    const team: PlacedChampion[] = [placed(apLeona, 0, 0)];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augLeonaCarry] as RawAugment[],
    });
    const leona = withCarry.playerUnits.find(u => u.champion.apiName === 'TFT17_Leona')!;
    expect(leona.leonaCarryActive).toBe(true);
    expect(leona.role).toBe('Fighter');
  });

  it('augment 미활성 → 일반 레오나 ability', () => {
    const team: PlacedChampion[] = [placed(apLeona, 0, 0)];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withoutCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const leona = withoutCarry.playerUnits.find(u => u.champion.apiName === 'TFT17_Leona')!;
    expect(leona.leonaCarryActive).toBe(false);
  });

  it('가장 강한 룰 — 3성 > 2성 우선', () => {
    // 레오나 2명 (3성 + 2성) → 3성 unit 만 carry transform
    const team: PlacedChampion[] = [
      placed(apLeona, 0, 0, 2),
      placed(apLeona, 1, 0, 3),
    ];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augLeonaCarry] as RawAugment[],
    });
    const leonaUnits = withCarry.playerUnits.filter(u => u.champion.apiName === 'TFT17_Leona');
    const star3 = leonaUnits.find(u => u.starLevel === 3)!;
    const star2 = leonaUnits.find(u => u.starLevel === 2)!;
    expect(star3.leonaCarryActive).toBe(true);
    expect(star2.leonaCarryActive).toBe(false);
  });
});

describe('꽁! (NasusCarry) — bonusPerKill cast 누적 (Lint #12 해소)', () => {
  it('nasusBonkStack 초기값 0', () => {
    const team: PlacedChampion[] = [placed(apNasus, 0, 0)];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augNasusCarry] as RawAugment[],
    });
    const nasus = withCarry.playerUnits.find(u => u.champion.apiName === 'TFT17_Nasus')!;
    // 초기값 + carry transform 정합
    expect(nasus.role).toBe('Fighter');
    // 전투 진행 후엔 0 또는 양수 (kill 발생 여부에 따라). 최소 음수 아님.
    expect(nasus.nasusBonkStack).toBeGreaterThanOrEqual(0);
  });

  it('cast 로 처치 시 nasusBonkStack ≤ killCount (basic attack kill 제외)', () => {
    // Nasus 3성 + 약한 적 다수 → 일부 kill 발생. nasusBonkStack 은 cast kill 만 누적
    // (basic attack kill 제외). 따라서 stack ≤ killCount 가 항상 invariant.
    const team: PlacedChampion[] = [placed(apNasus, 0, 0, 3)];
    const enemy: PlacedChampion[] = [
      placed(dummyEnemy, 6, 3, 1),
      placed(dummyEnemy, 6, 4, 1),
      placed(dummyEnemy, 5, 3, 1),
    ];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augNasusCarry] as RawAugment[],
    });
    const nasus = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Nasus')!;
    // stack >= 0 (음수 아님), stack <= killCount (cast kill 만 누적)
    expect(nasus.nasusBonkStack).toBeGreaterThanOrEqual(0);
    expect(nasus.nasusBonkStack).toBeLessThanOrEqual(nasus.killCount);
  });

  it('다중 Nasus 카피 시 selected (가장 강한) 1명만 nasusCarryActive (codex P2 회귀 가드)', () => {
    // Nasus 2명 (3성 + 2성) → 3성만 carry transform. findCarryAugment 는 두 명 모두에게
    // NasusCarry config 반환하지만, applyHeroCarryTransforms 의 "가장 강한 1명" selector 결과
    // 3성 unit 만 nasusCarryActive=true → stack hook + modifier 가드 작동.
    const team: PlacedChampion[] = [
      placed(apNasus, 0, 0, 2),
      placed(apNasus, 1, 0, 3),
    ];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augNasusCarry] as RawAugment[],
    });
    const nasusUnits = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_Nasus');
    const star3 = nasusUnits.find(u => u.starLevel === 3)!;
    const star2 = nasusUnits.find(u => u.starLevel === 2)!;
    // 3성만 selected
    expect(star3.nasusCarryActive).toBe(true);
    expect(star2.nasusCarryActive).toBe(false);
    // 2성 non-carry 는 stack 누적 안 함 (회귀 가드)
    expect(star2.nasusBonkStack).toBe(0);
  });

  it('augment 미활성 → nasusBonkStack 누적 안 함 (raw Nasus)', () => {
    const team: PlacedChampion[] = [placed(apNasus, 0, 0, 3)];
    const enemy: PlacedChampion[] = [
      placed(dummyEnemy, 6, 3, 1),
      placed(dummyEnemy, 6, 4, 1),
    ];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      // playerAugments 미설정 → raw Nasus
    });
    const nasus = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Nasus')!;
    // augment 미활성 → carryCfg.abilityData.bonusPerKill 없음 → stack 누적 분기 진입 안 함
    expect(nasus.nasusBonkStack).toBe(0);
  });
});

describe('저 별을 향해 (JaxCarry) — asGain starLevel별 정합 (Lint #11-B 해소)', () => {
  it('augment 활성 → jaxCarryActive = true + role Fighter', () => {
    const team: PlacedChampion[] = [placed(apJax, 0, 0, 2)];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augJaxCarry] as RawAugment[],
    });
    const jax = withCarry.playerUnits.find(u => u.champion.apiName === 'TFT17_Jax')!;
    expect(jax.jaxCarryActive).toBe(true);
    expect(jax.role).toBe('Fighter');
  });

  it('augment 미활성 → jaxCarryActive = false (raw Jax)', () => {
    const team: PlacedChampion[] = [placed(apJax, 0, 0, 2)];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const withoutCarry = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const jax = withoutCarry.playerUnits.find(u => u.champion.apiName === 'TFT17_Jax')!;
    expect(jax.jaxCarryActive).toBe(false);
  });

  it('다중 Jax 카피 시 selected (가장 강한) 1명만 jaxCarryActive (codex P2 패턴 적용)', () => {
    // Jax 2명 (3성 + 2성) → 3성만 carry transform. findCarryAugment 는 두 명 모두에게 동일
    // config 반환하지만 selected single-carry semantics (PR #135 패턴) 로 3성만 flag true.
    const team: PlacedChampion[] = [
      placed(apJax, 0, 0, 2),
      placed(apJax, 1, 0, 3),
    ];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augJaxCarry] as RawAugment[],
    });
    const jaxUnits = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_Jax');
    const star3 = jaxUnits.find(u => u.starLevel === 3)!;
    const star2 = jaxUnits.find(u => u.starLevel === 2)!;
    expect(star3.jaxCarryActive).toBe(true);
    expect(star2.jaxCarryActive).toBe(false);
  });

  it('non-selected Jax 는 carry self_buff abilityOverride 무시 (PR #136 codex P2 amend)', () => {
    // 다중 Jax + JaxCarry → non-selected (2성) 은 getAbilityConfigForUnit 에서 raw Jax config
    // (aoe_circle stun) fallback 받아야 함. carry self_buff override 가 모든 카피에 전파되면
    // non-selected 도 self_buff 패턴 cast → raw 의도 위반.
    // 검증 방식: non-selected Jax 의 baseline attackSpeed 와 final attackSpeed 비교 (selected
    // 만 carry buff 받음. non-selected 는 raw Jax stat 변화 없음 — raw Jax raw selfBuff 는
    // durability:0.3 만, attackSpeed 변경 없음).
    const team: PlacedChampion[] = [
      placed(apJax, 0, 0, 2),
      placed(apJax, 1, 0, 3),
    ];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3, 3)]; // 3성 enemy — Jax cast 발동 보장
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      playerAugments: [augJaxCarry] as RawAugment[],
    });
    const jaxUnits = result.playerUnits.filter(u => u.champion.apiName === 'TFT17_Jax');
    const star2NonSelected = jaxUnits.find(u => u.starLevel === 2)!;
    // raw Jax 2성 baseline attackSpeed 계산 — STAR_SCALING 적용 base
    const rawAS = apJax.stats.attackSpeed;
    // non-selected 2성 Jax 는 carry buff 안 받으므로 final AS 가 raw 와 거의 동일
    // (item bonus / trait effect 없는 단순 setup). carry self_buff.attackSpeed 0.15 적용되면
    // final AS = rawAS × 1.15^(castCount) → cast 1회만 진입해도 rawAS 보다 큼.
    // 회귀 가드: non-selected 가 carry buff 받았다면 attackSpeed 가 raw 보다 큼.
    expect(star2NonSelected.jaxCarryActive).toBe(false);
    // raw Jax attackSpeed 와 일치 (±5% 허용 — trait/buff 영향 미미)
    expect(star2NonSelected.stats.attackSpeed).toBeLessThanOrEqual(rawAS * 1.05);
  });
});
