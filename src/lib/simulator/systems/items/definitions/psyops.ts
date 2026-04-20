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

import type { Action, ItemEffectDescriptor } from '../primitives/types';

const statPatch = (stats: {
  ad?: number; ap?: number; as?: number; hp?: number;
  armor?: number; magicResist?: number;
  critChance?: number; critDamage?: number; mana?: number;
  armorPen?: number; magicPen?: number;
}): ItemEffectDescriptor => ({ kind: 'stat', stats });

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
function buildDroneUplink(apiName: string, ap: number, damageRepeatPct: number): [string, ItemEffectDescriptor[]] {
  const stackKey = `drone_window::${apiName}`;
  return [
    apiName,
    [
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
    ],
  ];
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
function buildSympatheticImplant(apiName: string): [string, ItemEffectDescriptor[]] {
  return [
    apiName,
    [
      statPatch({ ap: 20 }),
      {
        kind: 'timer',
        intervalTicks: 150, // 5초 × 30 tick/s
        action: { kind: 'modifyStat', stat: 'mana', delta: 1 },
      },
    ],
  ];
}

export const PSYOPS_ITEMS: Record<string, ItemEffectDescriptor[]> = Object.fromEntries([
  // 드론 업링크 (Phase 3)
  buildDroneUplink('TFT17_Item_PsyOps_DroneMod', 25, 0.20),
  buildDroneUplink('TFT17_Item_PsyOps_DroneMod_Radiant', 25, 0.20),
  // 반도체 (Phase 4 Part 1) — base: HP 200, receive 8, dmg 7%
  buildSemiconductor('TFT17_Item_PsyOps_SemiconductorMod', 200, 4, 8, 0.07),
  // 반도체 찬란 — HP 300, receive 12, dmg 7.5%
  buildSemiconductor('TFT17_Item_PsyOps_SemiconductorMod_Radiant', 300, 4, 12, 0.075),
  // 공감 임플란트 (Phase 4 Part 1) — base + radiant (TrueDamageConversion 제외)
  buildSympatheticImplant('TFT17_Item_PsyOps_SympatheticImplantMod'),
  buildSympatheticImplant('TFT17_Item_PsyOps_SympatheticImplantMod_Radiant'),
]);
