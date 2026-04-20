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
  | { mode: 'pctDealt'; pct: number };

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
  | { kind: 'modifyStat'; stat: StatKey; delta: number; durationTicks?: number }
  | { kind: 'applyDebuff'; debuff: DebuffSpec; target: TargetSelector; durationTicks: number }
  | { kind: 'addStack'; stack: string; amount?: number; cap?: number }
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
}
