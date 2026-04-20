/**
 * Item Effect Engine — Primitive Types
 *
 * 4가지 primitive를 조합해서 모든 아이템 효과를 표현한다.
 * - StatPatch: 전투 시작 시점 1회 스탯 합산 (기존 resolveItemEffect 대체)
 * - Trigger: event + condition + action (구인수, 거결 등)
 * - Counter: everyN 카운터 (반도체 등)
 * - Timer: interval (드론 업링크 등)
 *
 * 설계 문서: docs/02-design/features/item-effect-engine.design.md
 */

import type { ItemEffect, CombatUnit } from '@/types';
import type { CombatEventType, CombatEventPayload } from '@/lib/simulator/events/eventBus';

/* ─────────────────────────────────────────────────────────────
 * Action — primitive로 조립되는 최종 실행 단위
 * ──────────────────────────────────────────────────────────── */

/** 피해량 표현 방식 */
export type DamageAmount =
  | { mode: 'flat'; value: number }
  | { mode: 'pctMaxHp'; pct: number }
  | { mode: 'pctAttackDamage'; pct: number }
  | { mode: 'pctAbilityPower'; pct: number }
  /** payload.value 의 N% (trigger-chained action 에서 현재 이벤트 피해 기준) */
  | { mode: 'pctDealt'; pct: number }
  /** state.stacks[stack] 의 N% — 누적된 값 기반 (e.g. 드론 업링크 3초 window) */
  | { mode: 'pctOfStack'; stack: string; pct: number };

export type DamageType = 'physical' | 'magic' | 'true';

export type TargetSelector =
  | 'self'
  | 'attackTarget'
  | 'nearestEnemy'
  | 'randomEnemy'
  | 'allEnemies'
  | 'adjacentEnemies';

export type StatKey = keyof ItemEffect | 'omnivamp' | 'damageAmp' | 'damageReduction';

/** 조건부 분기용 술어. Runtime이 TriggerContext 주입. */
export type Cond = (ctx: TriggerContext) => boolean;

export type Action =
  | { kind: 'dealDamage'; amount: DamageAmount; type: DamageType; target: TargetSelector }
  /** target 미지정 시 자기 자신. 지정 시 selector 로 찾은 대상(들)에게 delta 적용 (악성코드 armor shred 등) */
  | { kind: 'modifyStat'; stat: StatKey; delta: number; durationTicks?: number; target?: TargetSelector }
  | { kind: 'applyDebuff'; debuff: DebuffSpec; target: TargetSelector; durationTicks: number }
  /**
   * 스택 증가. amount:
   * - number: 고정 증분 (default 1)
   * - 'payload.value': 현재 이벤트 payload.value 를 증분으로 사용 (trigger 전용,
   *   timer 에서는 payload undefined 이므로 0 증분)
   *
   * stack 은 `{targetId}` 템플릿 치환 지원 — payload.targetId 로 대체되어
   * per-target 스택 생성 (예: 표적 고정 'targetlock_hit::{targetId}')
   */
  | { kind: 'addStack'; stack: string; amount?: number | 'payload.value'; cap?: number }
  /**
   * 스택을 특정 값으로 고정. value:
   * - number: 고정값 (window reset 0 등)
   * - 'tick': 현재 ctx.tick 값으로 설정 (ICD 타임스탬프 기록용)
   *
   * stack 템플릿 치환 지원 (addStack 과 동일)
   */
  | { kind: 'setStack'; stack: string; value: number | 'tick' }
  | { kind: 'chain'; actions: Action[] }
  | { kind: 'branch'; condition: Cond; then: Action; else?: Action };

export interface DebuffSpec {
  /** 예: 'shred', 'wound', 'burn' */
  type: string;
  /** 수치 (예: shred 2 → 2% 저항 감소) */
  amount: number;
}

/* ─────────────────────────────────────────────────────────────
 * Descriptor — registry에 선언되는 아이템 효과
 * ──────────────────────────────────────────────────────────── */

/** 단순 스탯 버프. Phase 2에서 기존 resolveItemEffect 대체용. */
export interface StatPatch {
  kind: 'stat';
  stats: Partial<ItemEffect>;
}

export interface Trigger {
  kind: 'trigger';
  event: CombatEventType;
  condition?: Cond;
  action: Action;
}

export interface Counter {
  kind: 'counter';
  event: CombatEventType;
  /** N회 누적 시 action 발동 */
  n: number;
  action: Action;
  /** 'cycle': 매 N마다 반복, 'never': 1회만 */
  reset?: 'cycle' | 'never';
}

export interface IntervalTimer {
  kind: 'timer';
  /** TICKS_PER_SECOND = 30 기준 */
  intervalTicks: number;
  action: Action;
  maxRepeats?: number;
}

export type ItemEffectDescriptor = StatPatch | Trigger | Counter | IntervalTimer;

/* ─────────────────────────────────────────────────────────────
 * Runtime Context — Action/Condition 실행 시 주입되는 컨텍스트
 * ──────────────────────────────────────────────────────────── */

export interface TriggerContext {
  /** 아이템 장착 유닛 */
  unit: CombatUnit;
  /** 이벤트 payload (event-driven descriptor만 제공, timer는 undefined) */
  payload?: CombatEventPayload;
  /** 이 (유닛 × 아이템) 쌍의 상태 */
  state: UnitItemState;
  /** 현재 틱 */
  tick: number;
}

export interface UnitItemState {
  /** named stack → 현재 스택 수 (예: guinsoos_as = 14) */
  stacks: Map<string, number>;
  /** counter 누적 (예: 'semiconductor' = 7, 12 도달 시 proc) */
  counters: Map<string, number>;
  /** timer 마지막 발동 tick (interval 판정용) */
  timerLastTick: Map<string, number>;
  /** timer 누적 발동 횟수 (maxRepeats 체크용) */
  timerRepeats: Map<string, number>;
  /**
   * 임시 스탯 버프 만료 큐 — `modifyStat durationTicks` 로 적용된 delta 가
   * 만료 시점에 되돌려지도록 기록. runtime.onTick 에서 expireTick 도달 시 원복.
   */
  pendingBuffs?: PendingBuff[];
}

/** durationTicks 만료 시 delta 되돌리기용 기록 */
export interface PendingBuff {
  stat: StatKey;
  delta: number;
  expireTick: number;
  /** target 을 직접 지정한 modifyStat 에서 기록 (악성코드 shred 등). undefined = 자기 자신 */
  targetId?: string;
}
