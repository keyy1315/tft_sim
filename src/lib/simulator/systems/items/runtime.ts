/**
 * Item Effect Runtime
 *
 * 전투 중 아이템의 trigger/counter/timer를 관리하는 런타임.
 * combatLoop.ts 최소 침투 원칙: install / onTick / dispose 3개 훅만 노출.
 *
 * 설계 문서: docs/02-design/features/item-effect-engine.design.md §7
 */

import type { CombatUnit } from '@/types';
import type { EventBus, CombatEventType, CombatEventPayload } from '@/lib/simulator/events/eventBus';
import type {
  ItemEffectDescriptor,
  UnitItemState,
  Trigger,
  Counter,
  IntervalTimer,
} from './primitives/types';
import type { ActionContext, ActionDeps } from './primitives/action';
import { executeAction, applyStatDelta } from './primitives/action';
import { ITEM_EFFECTS } from './registry';

/** (unitId, itemApiName) → state */
type StateKey = string;
const stateKey = (unitId: string, apiName: string): StateKey => `${unitId}::${apiName}`;

interface TimerEntry {
  unitId: string;
  apiName: string;
  timer: IntervalTimer;
}

export class ItemEffectRuntime {
  private readonly bus: EventBus;
  /** bus.on 으로 등록한 handler id 목록 (dispose 시 off 호출용) */
  private readonly registeredHandlers: Array<{ event: CombatEventType; id: string }> = [];
  /** (unit × item) 별 per-item state */
  private readonly states: Map<StateKey, UnitItemState> = new Map();
  /** 등록된 timer descriptor 목록 (onTick 에서 순회) */
  private readonly timers: TimerEntry[] = [];
  /** 등록된 unit 참조 (이벤트 payload의 sourceId → unit 조회용) */
  private readonly unitsById: Map<string, CombatUnit> = new Map();
  /** Action 실행 시점에 주입할 deps. install 에서 세팅. */
  private deps: ActionDeps | null = null;
  /** handler id 중복 방지용 일련번호 */
  private handlerSeq = 0;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  /**
   * 전투 시작 시 1회 호출.
   * 각 유닛의 아이템을 스캔해 descriptor를 bus에 구독/timer 등록.
   */
  install(units: CombatUnit[], deps: ActionDeps): void {
    this.deps = deps;
    for (const unit of units) {
      this.unitsById.set(unit.id, unit);
      for (const item of unit.items) {
        const descriptors = ITEM_EFFECTS[item.apiName];
        if (!descriptors) continue;
        const key = stateKey(unit.id, item.apiName);
        if (!this.states.has(key)) {
          this.states.set(key, {
            stacks: new Map(),
            counters: new Map(),
            timerLastTick: new Map(),
            timerRepeats: new Map(),
          });
        }
        for (const d of descriptors) {
          this.registerDescriptor(unit, item.apiName, d);
        }
      }
    }
  }

  /**
   * 매 tick 호출. Timer descriptor 의 interval 판정 및 dispatch.
   */
  onTick(tick: number): void {
    if (!this.deps) return;
    // 1) 만료된 pendingBuffs 되돌리기 (modifyStat durationTicks 처리)
    //    targetId 있으면 그 unit 에게 원복, 없으면 장착 unit 에게 원복
    for (const [key, state] of this.states) {
      const pending = state.pendingBuffs;
      if (!pending || pending.length === 0) continue;
      const ownerId = key.split('::')[0];
      const owner = this.unitsById.get(ownerId);
      if (!owner) continue;
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i].expireTick <= tick) {
          const revertTarget = pending[i].targetId
            ? this.unitsById.get(pending[i].targetId!)
            : owner;
          if (revertTarget) applyStatDelta(revertTarget, pending[i].stat, -pending[i].delta);
          pending.splice(i, 1);
        }
      }
    }
    // 2) Timer descriptor 의 interval 판정 및 dispatch
    for (const entry of this.timers) {
      const unit = this.unitsById.get(entry.unitId);
      if (!unit || unit.state === 'dead') continue;

      const key = stateKey(entry.unitId, entry.apiName);
      const state = this.states.get(key);
      if (!state) continue;

      const timerKey = `timer::${entry.timer.intervalTicks}`;
      const lastFire = state.timerLastTick.get(timerKey);
      // 첫 tick (lastFire === undefined) 은 install 시점(=tick 0)을 기준으로 intervalTicks 대기.
      // 최초 발동은 `tick >= intervalTicks` 시점.
      const shouldFire = lastFire === undefined
        ? tick >= entry.timer.intervalTicks
        : tick - lastFire >= entry.timer.intervalTicks;

      if (!shouldFire) continue;

      if (entry.timer.maxRepeats !== undefined) {
        const repeats = state.timerRepeats.get(timerKey) ?? 0;
        if (repeats >= entry.timer.maxRepeats) continue;
        state.timerRepeats.set(timerKey, repeats + 1);
      }

      state.timerLastTick.set(timerKey, tick);

      const ctx: ActionContext = {
        unit,
        payload: undefined,
        state,
        tick,
        deps: this.deps,
      };
      executeAction(entry.timer.action, ctx);
    }
  }

  /**
   * 전투 종료 시 호출. bus handler 해제.
   */
  dispose(): void {
    for (const { event, id } of this.registeredHandlers) {
      this.bus.off(event, id);
    }
    this.registeredHandlers.length = 0;
    this.timers.length = 0;
    this.states.clear();
    this.unitsById.clear();
    this.deps = null;
  }

  /* ──────────────── private ──────────────── */

  private registerDescriptor(unit: CombatUnit, apiName: string, d: ItemEffectDescriptor): void {
    switch (d.kind) {
      case 'stat':
        // StatPatch는 전투 시작 시점의 calculateStats에서 이미 처리됨 (stat.ts).
        // Runtime은 관여하지 않음.
        return;
      case 'trigger':
        this.registerTrigger(unit, apiName, d);
        return;
      case 'counter':
        this.registerCounter(unit, apiName, d);
        return;
      case 'timer':
        this.registerTimer(unit, apiName, d);
        return;
    }
  }

  private registerTrigger(unit: CombatUnit, apiName: string, d: Trigger): void {
    const handlerId = `item::${unit.id}::${apiName}::trigger::${this.handlerSeq++}`;
    this.bus.on(d.event, handlerId, (payload) => {
      this.dispatchTrigger(unit, apiName, d, payload);
    });
    this.registeredHandlers.push({ event: d.event, id: handlerId });
  }

  private registerCounter(unit: CombatUnit, apiName: string, d: Counter): void {
    const handlerId = `item::${unit.id}::${apiName}::counter::${this.handlerSeq++}`;
    const counterKey = `counter::${d.event}::${d.n}`;
    this.bus.on(d.event, handlerId, (payload) => {
      this.dispatchCounter(unit, apiName, counterKey, d, payload);
    });
    this.registeredHandlers.push({ event: d.event, id: handlerId });
  }

  private registerTimer(unit: CombatUnit, apiName: string, d: IntervalTimer): void {
    this.timers.push({ unitId: unit.id, apiName, timer: d });
  }

  private dispatchTrigger(
    unit: CombatUnit,
    apiName: string,
    d: Trigger,
    payload: CombatEventPayload,
  ): void {
    if (!this.deps) return;
    // Trigger는 "이 유닛이 장착한 아이템이 이 유닛 관련 이벤트에만 반응"이 기본.
    // on_hit_taken (피격): sourceId=피격자, on_attack/on_hit/on_cast: sourceId=공격자.
    // on_combat_start/end 는 broadcast 이벤트 — 모든 유닛 trigger 발동.
    const isBroadcast = d.event === 'on_combat_start' || d.event === 'on_combat_end';
    if (!isBroadcast && payload.sourceId !== unit.id) return;
    if (unit.state === 'dead') return;

    const state = this.states.get(stateKey(unit.id, apiName));
    if (!state) return;

    const ctx: ActionContext = {
      unit,
      payload,
      state,
      tick: payload.tick,
      deps: this.deps,
    };
    if (d.condition && !d.condition(ctx)) return;
    executeAction(d.action, ctx);
  }

  private dispatchCounter(
    unit: CombatUnit,
    apiName: string,
    counterKey: string,
    d: Counter,
    payload: CombatEventPayload,
  ): void {
    if (!this.deps) return;
    if (payload.sourceId !== unit.id) return;
    if (unit.state === 'dead') return;

    const state = this.states.get(stateKey(unit.id, apiName));
    if (!state) return;

    const current = (state.counters.get(counterKey) ?? 0) + 1;
    if (current < d.n) {
      state.counters.set(counterKey, current);
      return;
    }

    // 도달: action 실행
    const ctx: ActionContext = {
      unit,
      payload,
      state,
      tick: payload.tick,
      deps: this.deps,
    };
    executeAction(d.action, ctx);

    // reset 처리
    if (d.reset === 'never') {
      // 1회성 — 이후 발동 안 되도록 불가능한 큰 값으로 고정
      state.counters.set(counterKey, Number.POSITIVE_INFINITY);
    } else {
      state.counters.set(counterKey, 0);
    }
  }
}
