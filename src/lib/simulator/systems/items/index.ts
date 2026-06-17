/**
 * Item Effect Engine — public barrel.
 *
 * 설계: item-effect-engine
 */

export { ItemEffectRuntime } from './runtime';
export { ITEM_EFFECTS, hasRegisteredEffects, getDescriptorsOfKind } from './registry';
export { executeAction, resolveTargets, applyStatDelta } from './primitives/action';
export type { ActionContext, ActionDeps } from './primitives/action';
export type {
  ItemEffectDescriptor,
  StatPatch,
  Trigger,
  Counter,
  IntervalTimer,
  Action,
  DamageAmount,
  DamageType,
  TargetSelector,
  StatKey,
  Cond,
  DebuffSpec,
  TriggerContext,
  UnitItemState,
} from './primitives/types';
