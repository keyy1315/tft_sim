/**
 * Item Effect Registry
 *
 * apiName → ItemEffectDescriptor[] 매핑.
 * Phase 2에서 기존 아이템을 StatPatch로 이관, Phase 3~5에서 복잡 효과 추가.
 *
 * 설계 문서: docs/02-design/features/item-effect-engine.design.md §4
 */

import type { ItemEffectDescriptor } from './primitives/types';
import { COMBINED_ITEMS } from './definitions/combined';

/**
 * 전체 아이템 효과 registry.
 *
 * Phase 1: 빈 상태 (legacy fallback 만 사용).
 * Phase 2: 주요 조합 아이템 10개를 StatPatch로 이관 (definitions/combined.ts).
 *   미이관 아이템은 stat.ts::getItemEffects 에서 legacy path로 계산.
 * Phase 3: 중첩 아이템 6종 (definitions/stacking.ts) 추가 예정.
 * Phase 4: PsyOps 12종 (definitions/psyops.ts) 추가 예정.
 * Phase 5: Anomaly (definitions/anomaly.ts) 추가 예정.
 */
export const ITEM_EFFECTS: Record<string, ItemEffectDescriptor[]> = {
  ...COMBINED_ITEMS,
};

/** registry에 entry가 존재하는지 확인. 없으면 legacy fallback. */
export function hasRegisteredEffects(apiName: string): boolean {
  return ITEM_EFFECTS[apiName] !== undefined && ITEM_EFFECTS[apiName].length > 0;
}

/** 특정 kind의 descriptor만 필터링해서 반환 */
export function getDescriptorsOfKind<K extends ItemEffectDescriptor['kind']>(
  apiName: string,
  kind: K,
): Extract<ItemEffectDescriptor, { kind: K }>[] {
  const list = ITEM_EFFECTS[apiName];
  if (!list) return [];
  return list.filter((d): d is Extract<ItemEffectDescriptor, { kind: K }> => d.kind === kind);
}
