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
import type { ItemEffectDescriptor, UnitItemState, Trigger, Counter, IntervalTimer } from './primitives/types';
import { ITEM_EFFECTS } from './registry';

/** (unitId, itemApiName) → state */
type StateKey = string;
const stateKey = (unitId: string, apiName: string): StateKey => `${unitId}::${apiName}`;

export class ItemEffectRuntime {
  private readonly bus: EventBus;
  /** bus.on 으로 등록한 handler id 목록 (dispose 시 off 호출용) */
  private readonly registeredHandlers: Array<{ event: CombatEventType; id: string }> = [];
  /** (unit × item) 별 per-item state */
  private readonly states: Map<StateKey, UnitItemState> = new Map();
  /** 등록된 timer descriptor 목록 (onTick 에서 순회) */
  private readonly timers: Array<{ unitId: string; apiName: string; timer: IntervalTimer }> = [];
  /** 등록된 unit 참조 (이벤트 payload의 sourceId → unit 조회용) */
  private readonly unitsById: Map<string, CombatUnit> = new Map();

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  /**
   * 전투 시작 시 1회 호출.
   * 각 유닛의 아이템을 스캔해 descriptor를 bus에 구독/timer 등록.
   */
  install(units: CombatUnit[]): void {
    for (const unit of units) {
      this.unitsById.set(unit.id, unit);
      for (const item of unit.items) {
        const descriptors = ITEM_EFFECTS[item.apiName];
        if (!descriptors) continue;
        // state 초기화 (중복 아이템은 동일 state 공유 — stacking도 유닛당 1개로 취급)
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
   * 매 tick 호출. Timer descriptor 의 interval 판정.
   * Phase 1: stub — Phase 2에서 실제 dispatch 구현.
   */
  onTick(tick: number): void {
    // Phase 1: 아직 Action executor 없음. Phase 2에서 구현.
    void tick;
    void this.timers;
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
    const handlerId = `item::${unit.id}::${apiName}::trigger`;
    this.bus.on(d.event, handlerId, (payload) => {
      // Phase 1: 실제 executor는 Phase 2에서 구현.
      void payload;
      void this.resolveContext(unit, apiName, payload);
    });
    this.registeredHandlers.push({ event: d.event, id: handlerId });
  }

  private registerCounter(unit: CombatUnit, apiName: string, d: Counter): void {
    const handlerId = `item::${unit.id}::${apiName}::counter`;
    this.bus.on(d.event, handlerId, (payload) => {
      // Phase 1: 실제 executor는 Phase 2에서 구현.
      void payload;
      void this.resolveContext(unit, apiName, payload);
    });
    this.registeredHandlers.push({ event: d.event, id: handlerId });
  }

  private registerTimer(unit: CombatUnit, apiName: string, d: IntervalTimer): void {
    this.timers.push({ unitId: unit.id, apiName, timer: d });
  }

  /**
   * 이벤트/timer 발생 시 TriggerContext 구성 (Action executor 용).
   * Phase 1: stub.
   */
  private resolveContext(unit: CombatUnit, apiName: string, payload?: CombatEventPayload) {
    const state = this.states.get(stateKey(unit.id, apiName));
    if (!state) return null;
    return {
      unit,
      payload,
      state,
      tick: payload?.tick ?? 0,
    };
  }
}
