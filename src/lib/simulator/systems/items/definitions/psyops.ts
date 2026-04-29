/**
 * PsyOps Item Definitions.
 *
 * Phase 3: Drone Uplink (Timer primitive 예제)
 * Phase 4 Part 1: 반도체 (Counter primitive), 공감 임플란트 (Timer + mana)
 * Phase 4 Part 2 (예정): 악성코드(Debuff+ICD), 표적 고정(on_windup_start per-target),
 *                        유기물 보존기, TrueDamageConversion 등
 *
 * 설계 문서: docs/02-design/features/item-effect-engine.design.md §6.3
 */

import type { ItemEffect } from '@/types';
import type { Action, ItemEffectDescriptor, Cond } from '../primitives/types';

/**
 * 초능력(PsyOps) 트레이트 활성 체크 — Radiant 보너스 조건.
 *
 * 간소화: "장착 유닛의 champion.traits 에 '초능력' 이 있는지" 로 판정.
 * 실게임은 team 의 PsyOps 유닛 수에 따른 trait tier 활성이지만, 개별 유닛
 * 효과만 다루는 primitive 레벨에선 소유 여부로 근사.
 */
const isPsyOpsUnit: Cond = (ctx) => ctx.unit.champion.traits.includes('초능력');

const statPatch = (stats: Partial<ItemEffect>): ItemEffectDescriptor => ({ kind: 'stat', stats });

/**
 * 드론 업링크 공통 descriptor 빌더.
 *
 * 효과: "드론이 3초마다 장착 유닛의 기본 공격 및 스킬 피해량의 @DamageRepeat@% 를
 *        동일한 대상에게 입힘"
 *
 * 구현:
 *  1) on_hit: 기본 공격 피해(payload.value) 를 `drone_dmg_window` 스택에 누적
 *  2) on_cast: 스킬 피해(payload.value) 를 같은 스택에 누적
 *  3) timer (3초): 누적 스택의 N% 를 공격 대상에게 마법 피해 → 스택 0 초기화
 *
 * 주의:
 *  - combatLoop 의 on_cast payload.value 는 resistance 적용 전 raw 피해.
 *    실게임 `DamageRepeat` 계산 방식과 ~5% 편차 가능. Phase 4 이후 정밀화.
 *  - TargetSelector 'attackTarget' 는 현재 타겟. 대상이 변했다면 새 타겟에 적용됨.
 */
function buildDroneUplink(
  apiName: string,
  ap: number,
  damageRepeatPct: number,
  radiantBonusPct = 0,
  // 17.2: Radiant 변종은 base stats 도 강화 — AP 25→30, DR 0.20→0.25 (Radiant 만).
): [string, ItemEffectDescriptor[]] {
  const stackKey = `drone_window::${apiName}`;
  // Radiant: 초능력 유닛일 경우 추가 미니 드론 (SecondDroneDamageRepeat)
  // 같은 window stack 을 공유하되, 초능력 조건 만족 시 추가 피해
  const descriptors: ItemEffectDescriptor[] = [
    statPatch({ ap }),
    {
      kind: 'trigger',
      event: 'on_hit',
      action: { kind: 'addStack', stack: stackKey, amount: 'payload.value' },
    },
    {
      kind: 'trigger',
      event: 'on_cast',
      action: { kind: 'addStack', stack: stackKey, amount: 'payload.value' },
    },
    {
      kind: 'timer',
      intervalTicks: 90, // 3초 × 30 tick/s
      action: {
        kind: 'chain',
        actions: [
          {
            kind: 'dealDamage',
            amount: { mode: 'pctOfStack', stack: stackKey, pct: damageRepeatPct },
            type: 'magic',
            target: 'attackTarget',
          },
          { kind: 'setStack', stack: stackKey, value: 0 },
        ],
      },
    },
  ];
  // Radiant 보너스 드론: 초능력 유닛일 때만 발동 (별도 timer 로 분리)
  if (radiantBonusPct > 0) {
    const bonusStack = `${stackKey}_radiant`;
    // Radiant 보너스 누적도 별도 stack 으로 유지 — main stack reset 에 영향 안 줌
    descriptors.push(
      {
        kind: 'trigger',
        event: 'on_hit',
        condition: isPsyOpsUnit,
        action: { kind: 'addStack', stack: bonusStack, amount: 'payload.value' },
      },
      {
        kind: 'trigger',
        event: 'on_cast',
        condition: isPsyOpsUnit,
        action: { kind: 'addStack', stack: bonusStack, amount: 'payload.value' },
      },
      {
        kind: 'timer',
        intervalTicks: 90,
        action: {
          kind: 'branch',
          condition: isPsyOpsUnit,
          then: {
            kind: 'chain',
            actions: [
              {
                kind: 'dealDamage',
                amount: { mode: 'pctOfStack', stack: bonusStack, pct: radiantBonusPct },
                type: 'magic',
                target: 'attackTarget',
              },
              { kind: 'setStack', stack: bonusStack, value: 0 },
            ],
          },
        },
      },
    );
  }
  return [apiName, descriptors];
}

/**
 * 반도체 (Semiconductor) — Counter primitive 예제.
 *
 * 효과: "기본 공격 @AttacksToLaunch@회마다 및 @AttacksToReceive@회 공격받을 때마다
 *        가까운 적 @NumEnemies@명을 감전시켜 적 체력의 @PctHealthDamage*100@% 마법 피해"
 *
 * 구현:
 *  1) on_attack counter(n=AttacksToLaunch): 도달 시 proc → nearestEnemy 에게 pctMaxHp 피해
 *  2) on_hit_taken counter(n=AttacksToReceive): 도달 시 동일 proc
 *  3) reset='cycle' (default) — 매 주기 반복
 *
 * 단순화:
 *  - NumEnemies=3 은 'nearestEnemy' 1명 으로 근사 (실피해 1/3 수준).
 *    'nearestEnemies(N)' selector 는 Phase 5 에서 추가 예정.
 *  - 감전 (stun/disarm) CC 효과는 미구현 — primitive 만 피해 전달.
 */
function buildSemiconductor(
  apiName: string,
  hp: number,
  attacksToLaunch: number,
  attacksToReceive: number,
  damagePct: number,
): [string, ItemEffectDescriptor[]] {
  const procAction: Action = {
    kind: 'dealDamage',
    amount: { mode: 'pctMaxHp', pct: damagePct },
    type: 'magic',
    target: 'nearestEnemy',
  };
  return [
    apiName,
    [
      statPatch({ hp }),
      { kind: 'counter', event: 'on_attack', n: attacksToLaunch, action: procAction },
      { kind: 'counter', event: 'on_hit_taken', n: attacksToReceive, action: procAction },
    ],
  ];
}

/**
 * 공감 임플란트 (Sympathetic Implant) — Timer + mana gain.
 *
 * 효과 (base): "@Interval@초마다 추가 마나 재생 @ManaRegenOverTime@ 획득"
 *
 * 구현:
 *  - 5초 interval timer → modifyStat mana +1
 *  - 초기 ManaRegen=2 (탑레벨 재생율) 은 ItemEffect 미확장 으로 스킵 (Phase 5+)
 *  - radiant TrueDamageConversion=0.2 (스킬 피해의 20% 를 고정 피해로) 는
 *    ability 공식 수정이 필요해 Phase 5+ 에서 처리
 */
function buildSympatheticImplant(
  apiName: string,
  manaRegen: number = 2,
  trueDamageConversion: number = 0,
): [string, ItemEffectDescriptor[]] {
  const descriptors: ItemEffectDescriptor[] = [
    // base ManaRegen: 전투 내내 초당 +N 마나 재생 (17.2: 일반 2, Radiant 4)
    statPatch({ ap: 20, manaRegen }),
    // ManaRegenOverTime 1: 5초마다 +1 추가 (이건 주기적 스파이크라 Timer 로 유지)
    {
      kind: 'timer',
      intervalTicks: 150, // 5초 × 30 tick/s
      action: { kind: 'modifyStat', stat: 'mana', delta: 1 },
    },
  ];
  // 17.2 Radiant: 초능력 유닛 ability 시전 시 스킬 피해의 N% 를 고정 피해로 추가.
  // on_cast payload.rawValue (resistance 적용 전 raw ability damage) 의 trueDamageConversion%
  // 만큼 true damage 를 attackTarget 에 적용. raw 기반이라 mitigated 편차 없음.
  if (trueDamageConversion > 0) {
    descriptors.push({
      kind: 'trigger',
      event: 'on_cast',
      condition: isPsyOpsUnit,
      action: {
        kind: 'dealDamage',
        amount: { mode: 'pctDealtRaw', pct: trueDamageConversion },
        type: 'true',
        target: 'attackTarget',
      },
    });
  }
  return [apiName, descriptors];
}

/**
 * 악성코드 매트릭스 (Chemical Capacitor) — on_hit + ICD + armor shred.
 *
 * 효과: "적에게 물리 피해를 입힐 경우 대상 방어력 @ResistReduce@ 감소
 *        (스킬 피해 재사용 대기시간: @Cooldown@초)"
 *
 * 구현:
 *  - on_hit trigger + ICD condition (tick - last_proc >= 22 tick, 0.75s × 30)
 *  - chain:
 *    ① modifyStat armor -2 target:attackTarget (영구 누적 — 실게임 shred 가
 *       10초 duration 이지만 전투 시간 짧아 근사)
 *    ② setStack malware_icd value 'tick' (현재 tick 으로 마지막 발동 시각 기록)
 *
 * 단순화:
 *  - StatOmnivamp 는 ItemEffect 확장으로 이미 반영 (Bloodthirster 와 동일 경로)
 *  - radiant CleaveDamage/NumAttacks (초능력 전용) 는 Phase 5+ 에서 condition 확장
 */
function buildChemicalCapacitor(
  apiName: string,
  resistReduce: number,
  radiantCleaveDamage = 0,
  radiantCleaveEvery = 3,
): [string, ItemEffectDescriptor[]] {
  const icdKey = `malware_icd::${apiName}`;
  const icdTicks = Math.round(0.75 * 30); // 22 tick
  const descriptors: ItemEffectDescriptor[] = [
    statPatch({ ad: 0.15, as: 15, omnivamp: 0.10 }),
    {
      kind: 'trigger',
      event: 'on_hit',
      condition: (ctx) => {
        const last = ctx.state.stacks.get(icdKey) ?? -Infinity;
        return ctx.tick - last >= icdTicks;
      },
      action: {
        kind: 'chain',
        actions: [
          {
            kind: 'modifyStat',
            stat: 'armor',
            delta: -resistReduce,
            target: 'attackTarget',
          },
          { kind: 'setStack', stack: icdKey, value: 'tick' },
        ],
      },
    },
  ];
  // Radiant: 초능력 유닛이 기본 공격 N회마다 주변 적 cleave (flat magic damage)
  if (radiantCleaveDamage > 0) {
    descriptors.push({
      kind: 'counter',
      event: 'on_attack',
      n: radiantCleaveEvery,
      action: {
        kind: 'branch',
        condition: isPsyOpsUnit,
        then: {
          kind: 'dealDamage',
          amount: { mode: 'flat', value: radiantCleaveDamage },
          type: 'physical', // desc: physicalDamage
          target: 'adjacentEnemies',
        },
      },
    });
  }
  return [apiName, descriptors];
}

/**
 * 표적 고정 광학 장치 (Targetlock Optic) — per-target first-hit bonus.
 *
 * 효과: "장착 유닛이 각 적에게 가하는 첫 공격이 @AttackPct@% AD 추가 피해"
 *        (AttackPct=150 → +150% AD)
 *
 * 구현:
 *  - on_hit trigger, condition: state.stacks[`targetlock_hit::{targetId}`] 가 0
 *    (첫 공격 체크 — stack 템플릿 치환으로 per-target 누적)
 *  - chain:
 *    ① dealDamage pctAttackDamage 1.5 to attackTarget, physical
 *    ② addStack 'targetlock_hit::{targetId}' = 1 (이 적에게 발동 표시)
 *
 * Radiant HealPct 0.15 (초능력 사망 시 15% maxHP 회복) 은 별도 on_kill trigger
 * 필요 + 초능력 조건 처리 복잡 → Phase 5+ 로 이월.
 */
function buildTargetlockOptic(
  apiName: string,
  radiantHealPct = 0,
  baseAd: number = 0.15,
): [string, ItemEffectDescriptor[]] {
  // 17.2: Radiant 는 base AD 0.15 → 0.25 강화.
  const descriptors: ItemEffectDescriptor[] = [
    statPatch({ ad: baseAd, as: 35 }),
    {
      kind: 'trigger',
      event: 'on_hit',
      condition: (ctx) => {
        const tgt = ctx.payload?.targetId;
        if (!tgt) return false;
        const fired = ctx.state.stacks.get(`targetlock_hit::${tgt}`) ?? 0;
        return fired === 0;
      },
      action: {
        kind: 'chain',
        actions: [
          {
            kind: 'dealDamage',
            amount: { mode: 'pctAttackDamage', pct: 1.5 },
            type: 'physical',
            target: 'attackTarget',
          },
          { kind: 'addStack', stack: 'targetlock_hit::{targetId}', amount: 1 },
        ],
      },
    },
  ];
  // Radiant: 초능력 유닛이 대상을 처치하면 최대체력 N% 회복
  if (radiantHealPct > 0) {
    descriptors.push({
      kind: 'trigger',
      event: 'on_kill',
      condition: isPsyOpsUnit,
      action: {
        kind: 'heal',
        amount: { mode: 'pctMaxHp', pct: radiantHealPct },
        target: 'self',
      },
    });
  }
  return [apiName, descriptors];
}

/**
 * 유기물 보존기 (Organic Preserver, Grenade Mod) — Timer heal.
 *
 * 효과: "최대 체력 +5% 및 8초마다 구슬이 장착 유닛의 잃은 체력을 18% 회복"
 *
 * 구현:
 *  - StatPatch: hp +250 (base) / hp +400 (radiant) — PctMaxHP 5% 는 champion base hp
 *    기반 연산이 필요해 flat 으로 근사
 *  - Timer intervalTicks 240 (8초 × 30) → heal pctMissingHp 0.18 on 'self'
 *  - Grenade entity spawn (NumGrenades 3) 은 엔진 확장 필요 → Phase 6+ 이월
 */
function buildGrenadeMod(
  apiName: string,
  hp: number,
  healPct: number,
  increasedHealing: number = 0,
): [string, ItemEffectDescriptor[]] {
  // 17.2 Radiant: IncreasedHealing 0.22 — 회복량 +22% 증폭. healAmp statPatch 로 적용.
  // PsyOps Radiant swap 메커니즘 이 (4) tier + 초능력 unit 게이트 역할 → 본 entry 가
  // 사용되는 시점 = 이미 조건 충족 → 무조건 적용 OK.
  const stats: Partial<ItemEffect> = { hp };
  if (increasedHealing > 0) stats.healAmp = increasedHealing;
  return [
    apiName,
    [
      statPatch(stats),
      {
        kind: 'timer',
        intervalTicks: 240, // 8초 × 30
        action: {
          kind: 'heal',
          amount: { mode: 'pctMissingHp', pct: healPct },
          target: 'self',
        },
      },
    ],
  ];
}

/**
 * PsyOps 아이템 정의 — 일반(4-tier) + Radiant 변종.
 *
 * 게임 시스템 (17.2):
 *   - (2) 초능력 시너지: 5종 PsyOps 아이템 중 1개 자동 획득. 비-초능력 unit 도 장착 가능.
 *     이 단계는 일반 4-tier 효과만 적용.
 *   - (4) 초능력 시너지: 추가 1개 PsyOps 아이템 획득 (총 2개).
 *     초능력 unit 이 장착 시 Radiant 변종 효과 (강화 base + 추가 효과) 자동 발동.
 *     비-초능력 unit 이 장착 시 일반 4-tier 효과만 적용.
 *
 * 시뮬 구현:
 *   - 사용자는 빌더에서 일반 5종 (`*Mod`) 만 노출 — Radiant entry 는 disabledContent 로 숨김.
 *   - 시뮬 시작 시 자동 swap: PsyOps (4) tier 활성 + 초능력 unit 이 일반 PsyOps 아이템
 *     장착 → 일반 apiName 을 `_Radiant` 로 swap (createCombatUnit 직전).
 *
 * 17.2 raw 데이터 매핑:
 *   - DroneMod (일반): AP 25, DamageRepeat 0.20
 *   - DroneMod_Radiant: AP 30, DamageRepeat 0.25, SecondDroneDamageRepeat 0.20
 *   - GrenadeMod (일반): Health 250
 *   - GrenadeMod_Radiant: Health 550 (+ IncreasedHealing 0.22 추가, primitive 미지원)
 *   - TargetlockMod (일반): AD 0.15
 *   - TargetlockMod_Radiant: AD 0.25, HealPct 0.20 (kill 시 maxHp 회복)
 *   - SympatheticImplantMod (일반): ManaRegen 2
 *   - SympatheticImplantMod_Radiant: ManaRegen 4, TrueDamageConversion 0.25
 *   - ChemicalCapacitorMod (일반): base 동일
 *   - ChemicalCapacitorMod_Radiant: + CleaveDamage 75 / NumAttacks 3
 */
export const PSYOPS_ITEMS: Record<string, ItemEffectDescriptor[]> = Object.fromEntries([
  // 드론 업링크 — 17.2 일반 (AP 25, DR 0.20) / Radiant (AP 30, DR 0.25, SecondDrone 0.20)
  buildDroneUplink('TFT17_Item_PsyOps_DroneMod', 25, 0.20),
  buildDroneUplink('TFT17_Item_PsyOps_DroneMod_Radiant', 30, 0.25, 0.20),
  // 반도체 — Phase 4 Part 1 (set 17 PsyOps 4-tier 5종에 미포함, legacy 호환 유지)
  buildSemiconductor('TFT17_Item_PsyOps_SemiconductorMod', 200, 4, 8, 0.07),
  buildSemiconductor('TFT17_Item_PsyOps_SemiconductorMod_Radiant', 300, 4, 12, 0.075),
  // 공감 임플란트 — 17.2 일반 (ManaRegen 2) / Radiant (ManaRegen 4 + TrueDamage 0.25)
  buildSympatheticImplant('TFT17_Item_PsyOps_SympatheticImplantMod', 2),
  buildSympatheticImplant('TFT17_Item_PsyOps_SympatheticImplantMod_Radiant', 4, 0.25),
  // 악성코드 매트릭스 — 17.2 일반 (base) / Radiant (+ CleaveDamage 75, NumAttacks 3)
  buildChemicalCapacitor('TFT17_Item_PsyOps_ChemicalCapacitorMod', 2),
  buildChemicalCapacitor('TFT17_Item_PsyOps_ChemicalCapacitorMod_Radiant', 2, 75, 3),
  // 표적 고정 광학 — 17.2 일반 (AD 0.15) / Radiant (AD 0.25 + HealPct 0.20)
  buildTargetlockOptic('TFT17_Item_PsyOps_TargetlockMod'),
  buildTargetlockOptic('TFT17_Item_PsyOps_TargetlockMod_Radiant', 0.20, 0.25),
  // 유기물 보존기 — 17.2 일반 (Health 250) / Radiant (Health 550, IncreasedHealing 미구현)
  buildGrenadeMod('TFT17_Item_PsyOps_GrenadeMod', 250, 0.18),
  // 17.2 Radiant: Health 550 + IncreasedHealing 0.22 (회복량 +22%)
  buildGrenadeMod('TFT17_Item_PsyOps_GrenadeMod_Radiant', 550, 0.18, 0.22),
]);
