/**
 * Item Effect Registry
 *
 * apiName → ItemEffectDescriptor[] 매핑.
 * definitions/ 아래 카테고리별 파일을 병합하여 최종 registry 생성.
 *
 * 설계 문서: docs/02-design/features/item-effect-engine.design.md §4
 */

import type { ItemEffectDescriptor } from './primitives/types';
import { COMBINED_ITEMS } from './definitions/combined';
import { STACKING_ITEMS } from './definitions/stacking';

/**
 * 여러 카테고리 registry 를 합병한다.
 *
 * 같은 apiName 이 여러 파일에 분산되어 있을 경우 descriptor 배열을 concat.
 * (object spread 를 쓰면 덮어쓰기가 발생해 Phase 3 trigger 가 Phase 2 stat 을 지워버림.)
 */
function mergeRegistries(
  ...registries: Record<string, ItemEffectDescriptor[]>[]
): Record<string, ItemEffectDescriptor[]> {
  const result: Record<string, ItemEffectDescriptor[]> = {};
  for (const reg of registries) {
    for (const [apiName, descriptors] of Object.entries(reg)) {
      if (!result[apiName]) result[apiName] = [];
      result[apiName].push(...descriptors);
    }
  }
  return result;
}

/**
 * 전체 아이템 효과 registry.
 *
 * Phase 1: 빈 상태 (legacy fallback 만 사용).
 * Phase 2: combined.ts — 주요 조합 아이템 StatPatch 이관.
 * Phase 3: stacking.ts — Guinsoos/Titans/Deathblade/Rabadon trigger 추가.
 * Phase 4 (예정): psyops.ts — PsyOps 12종.
 * Phase 5 (예정): anomaly.ts — Anomaly.
 */
export const ITEM_EFFECTS: Record<string, ItemEffectDescriptor[]> = mergeRegistries(
  COMBINED_ITEMS,
  STACKING_ITEMS,
);

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
