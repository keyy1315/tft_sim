/**
 * EventBus — 아이템 / 시너지 / 증강의 hook 등록 시스템
 * 각 hook은 우선순위(priority)를 가지며 동일 이벤트에서 순서 보장
 */

export type CombatEventType =
  | 'on_combat_start'
  | 'on_combat_end'
  | 'on_attack'
  | 'on_hit'
  | 'on_cast'
  | 'on_kill'
  | 'on_death'
  | 'on_damage'
  | 'on_heal'
  | 'on_shield_break'
  // v2 — item-effect-engine (설계: docs/02-design/features/item-effect-engine.design.md §5.2)
  /** 매 tick. IntervalTimer dispatch 용. */
  | 'on_tick'
  /** 스킬 마나 소모 시점 (on_cast 이전). PsyOps 공감 임플란트 등. */
  | 'on_mana_spent'
  /** 피격 당한 시점 (방어자 관점). on_hit은 공격자 관점과 혼용되어 애매 → 분리. */
  | 'on_hit_taken'
  /** 공격 windup 시작. PsyOps AttackPct 버프 창 용. */
  | 'on_windup_start';

export interface CombatEventPayload {
  sourceId: string;
  targetId?: string;
  value?: number;
  damageType?: 'physical' | 'magic' | 'true';
  tick: number;
}

type EventHandler = (payload: CombatEventPayload) => void;

interface RegisteredHandler {
  id: string;
  handler: EventHandler;
  priority: number; // 낮을수록 먼저 실행
}

export class EventBus {
  private handlers: Map<CombatEventType, RegisteredHandler[]> = new Map();

  on(event: CombatEventType, id: string, handler: EventHandler, priority: number = 100): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    const list = this.handlers.get(event)!;
    list.push({ id, handler, priority });
    list.sort((a, b) => a.priority - b.priority);
  }

  off(event: CombatEventType, id: string): void {
    const list = this.handlers.get(event);
    if (!list) return;
    this.handlers.set(event, list.filter(h => h.id !== id));
  }

  emit(event: CombatEventType, payload: CombatEventPayload): void {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const { handler } of list) {
      handler(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
