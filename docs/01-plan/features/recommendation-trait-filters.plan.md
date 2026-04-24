# Plan: 추천 아이템 시너지/유물 필터링

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | recommendation-trait-filters |
| 작성일 | 2026-04-21 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 추천 아이템 풀에 (1) 실전에서 장착 불가한 유물 아이템, (2) 시너지 미활성 시 쓸 수 없는 초능력/동물특공대 아이템, (3) 특별한 이벤트로만 얻는 만능 무기가 섞여 추천되어 현실성이 떨어짐 |
| **Solution** | `filterItemPool` 에 트레잇 규칙 레이어 추가: (a) 유물(`Artifact`) 전면 제외 (b) `TFT17_AnimaSquadItem_Tier4_Omniweapon` 전면 제외 (c) AnimaSquad 아이템 전체는 동물특공대 ≥ 3 활성 시에만 허용 (d) PsyOps 아이템은 초능력 ≥ 2 활성 시 허용, `pickTopCombo` 에서 조합 내 개수 상한 (초능력 2 → 1개, 4 → 2개) |
| **Function UX Effect** | 추천이 덱 상황에 맞는 장착 가능 아이템만 표시. PsyOps 덱 2레벨에선 초능력 1개 + 범용 2개, 동물특공대 3+레벨에선 자체 제작 무기 반영 |
| **Core Value** | 추천의 현실성 — 플레이어가 실제로 장착할 수 있는 조합만 제시해 혼란 제거 |

---

## 1. 데이터 조사 결과

### 1.1 제외 대상 apiName 패턴

| 카테고리 | 식별자 | 개수 | 조건 |
|---------|--------|------|------|
| 유물(Artifact) | `apiName.includes('_Artifact_') || apiName.includes('Artifact')` | ~49 | 항상 제외 |
| 만능 무기 | `apiName === 'TFT17_AnimaSquadItem_Tier4_Omniweapon'` | 1 | 항상 제외 |
| AnimaSquad (만능 제외) | `apiName.startsWith('TFT17_AnimaSquadItem_')` | ~27 | 동물특공대 ≥ 3 활성 시에만 |
| PsyOps | `apiName.startsWith('TFT17_Item_PsyOps_')` | ~13 | 초능력 ≥ 2 활성 시에만 + 조합 개수 상한 |

### 1.2 트레잇 활성 수준

- `TFT17_AnimaSquad` breakpoints: `[3, 6]` → minUnits 3 에서 1단계 활성.
- `TFT17_PsyOps` breakpoints: `[2, 4]` → minUnits 2 에서 1단계, 4 에서 2단계.

### 1.3 PsyOps 조합 슬롯 상한

| PsyOps 활성 수 | 조합에 포함 가능한 PsyOps 아이템 수 |
|--------------|--------------------------------|
| 0 (비활성) | 0 (풀에서 완전 제외) |
| 2 | 1 |
| 4 | 2 |
| 6+ | 2 (breakpoint 상으로는 유지, 게임 상 아이템 3개는 없음) |

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 내용 | 우선순위 |
|----|------|---------|
| FR-01 | 유물 아이템(apiName `_Artifact_` / `Artifact`)은 추천 풀에서 항상 제외 | P0 |
| FR-02 | `TFT17_AnimaSquadItem_Tier4_Omniweapon` 은 추천 풀에서 항상 제외 | P0 |
| FR-03 | AnimaSquad 아이템(`TFT17_AnimaSquadItem_*`, 만능 제외)은 동물특공대 ≥ 3 활성 시에만 추천 풀 포함 | P0 |
| FR-04 | PsyOps 아이템(`TFT17_Item_PsyOps_*`, Radiant 포함)은 초능력 ≥ 2 활성 시에만 추천 풀 포함 | P0 |
| FR-05 | `pickTopCombo` 가 PsyOps 아이템 조합 내 개수를 초능력 활성 수에 따라 제한 (2→1, 4→2) | P0 |
| FR-06 | `RecommendationSection` 이 현재 팀의 `activeTraits` 를 받아 위 규칙 적용 | P0 |
| FR-07 | `simulator/page.tsx` 가 `tm.playerTraits` 또는 `tm.enemyTraits` 중 **선택된 유닛의 팀** 을 주입 | P0 |
| FR-08 | 기존 1차 추천 동작(역할 필터, DPS score, greedy Top-3, reason 태깅) 은 유지. 새 규칙은 필터 레이어에서만 작동 | P0 |

### 2.2 비기능

- 기존 테스트(77 개) 전부 통과 유지.
- React Compiler 규칙 준수.
- 순수 함수 `filterItemPool` / `pickTopCombo` 에 파라미터만 추가. 부작용 없음.

---

## 3. 구현 방안

### 3.1 `activeTraits` 축약 타입

`RecommendationSection` 에서 필요한 정보는 "특정 trait 의 활성 minUnits 값" 뿐. 풀 ActiveTrait 대신 단순 맵 사용:

```ts
// src/types/analysis.ts
export type TraitActivation = Record<string /* trait apiName */, number /* 활성 minUnits, 비활성이면 0 */>;
```

또는 기존 `ActiveTrait` 객체 배열을 그대로 받되, `itemRecommender` 안에서 apiName → minUnits 조회 헬퍼 작성.

**선택**: `ActiveTrait[]` 그대로 받기. `ActiveTrait` 는 이미 `trait: RawTrait`, `activeEffect: TraitEffect | null` 구조. 조회 헬퍼:

```ts
function activeMinUnits(traits: ActiveTrait[], apiName: string): number {
  const t = traits.find(x => x.trait.apiName === apiName && x.activeEffect);
  return t?.activeEffect?.minUnits ?? 0;
}
```

### 3.2 `filterItemPool` 확장

**파일**: `src/lib/analysis/itemRecommender.ts`

`RoleCategory`/`damageType` 필터 뒤에 "trait rule" 레이어 추가:

```ts
export interface FilterContext {
  psyOpsLevel: number;   // 활성 minUnits, 비활성 0
  animaSquadLevel: number;
}

function filterByTraitRules(items: RawItem[], ctx: FilterContext): RawItem[] {
  return items.filter(it => {
    const api = it.apiName;
    // (1) 유물 완전 제외
    if (api.includes('_Artifact_') || api.includes('Artifact')) return false;
    // (2) 만능 무기 완전 제외
    if (api === 'TFT17_AnimaSquadItem_Tier4_Omniweapon') return false;
    // (3) AnimaSquad: 3 이상 활성 필요
    if (api.startsWith('TFT17_AnimaSquadItem_')) return ctx.animaSquadLevel >= 3;
    // (4) PsyOps: 2 이상 활성 필요
    if (api.startsWith('TFT17_Item_PsyOps_')) return ctx.psyOpsLevel >= 2;
    return true;
  });
}

// 기존 시그니처는 유지하되 선택적 ctx 추가
export function filterItemPool(
  all: RawItem[],
  role: RoleCategory,
  damageType: 'ad' | 'ap' | 'none',
  ctx?: FilterContext,
): RawItem[] {
  const roleFiltered = /* 기존 로직 */;
  return ctx ? filterByTraitRules(roleFiltered, ctx) : roleFiltered;
}
```

### 3.3 `pickTopCombo` — PsyOps 슬롯 상한

조합 열거 시 PsyOps 아이템 개수 체크:

```ts
export interface ComboConstraint {
  maxPsyOps?: number;  // undefined = 제한 없음
}

export function pickTopCombo(
  scored: Recommendation[],
  stats: ChampionStats,
  isAP: boolean,
  starLevel: number,
  constraint?: ComboConstraint,
): Recommendation[] {
  const maxPsy = constraint?.maxPsyOps;
  const isPsyOps = (r: Recommendation) => r.item.apiName.startsWith('TFT17_Item_PsyOps_');

  // ... 기존 후보 축소(상위 6) 및 조합 열거 ...
  for (/* i, j, k */) {
    const combo = [candidates[i], candidates[j], candidates[k]];
    if (maxPsy !== undefined) {
      const count = combo.filter(isPsyOps).length;
      if (count > maxPsy) continue;  // 슬롯 상한 초과
    }
    // ... DPS 계산 후 best 갱신 ...
  }
  return best;
}
```

초능력 활성 수 → `maxPsyOps` 매핑:
- 0 → 0 (아예 pool 에서 빠짐, 상한 무의미)
- 2 → 1
- 4+ → 2

### 3.4 `getStaticRecommendations` 인터페이스 확장

```ts
export function getStaticRecommendations(
  champ: RawChampion,
  stats: ChampionStats,
  starLevel: number,
  allItems: RawItem[],
  activeTraits?: ActiveTrait[],  // NEW
): Recommendation[] {
  const psyOpsLevel = activeTraits ? activeMinUnits(activeTraits, 'TFT17_PsyOps') : 0;
  const animaSquadLevel = activeTraits ? activeMinUnits(activeTraits, 'TFT17_AnimaSquad') : 0;

  const role = classifyRole(champ);
  const damageType = detectDamageType(champ);
  const pool = filterItemPool(allItems, role, damageType, { psyOpsLevel, animaSquadLevel });
  if (pool.length === 0) return [];

  const maxPsyOps = psyOpsLevel >= 4 ? 2 : psyOpsLevel >= 2 ? 1 : 0;
  const isAP = damageType === 'ap';

  const scored = role === 'TANK'
    ? scoreItemsForTank(stats, pool)
    : scoreItemsForDamage(stats, isAP, starLevel, pool);
  const combo = pickTopCombo(scored, stats, isAP, starLevel, { maxPsyOps });
  return combo.map(r => ({ ...r, reason: tagReason(r.item) }));
}
```

### 3.5 `RecommendationSection` 에 `activeTraits` 주입

**파일**: `src/components/battle/UnitDetailPanel.tsx`

- 기존 prop `activeTraits?` 는 이미 interface 에 있으나 미사용. 이제 `RecommendationSection` 에 전달.
- `getStaticRecommendations(..., activeTraits)` 호출 시 그대로 넘김.

### 3.6 `simulator/page.tsx` 에서 팀별 trait 주입

선택된 유닛의 팀 기준으로 `playerTraits` 또는 `enemyTraits` 를 `activeTraits` prop 으로 전달:

```tsx
<UnitDetailPanel
  // 기존 props ...
  activeTraits={selMeta.team === 'player' ? tm.playerTraits : tm.enemyTraits}
/>
```

`playerTraits` / `enemyTraits` 는 `useTeamManagement` 가 이미 계산해 둠.

---

## 4. 영향 파일

| 파일 | 변경 유형 | 라인 |
|------|----------|------|
| `src/lib/analysis/itemRecommender.ts` | 수정 | +30 / −5 |
| `src/components/battle/UnitDetailPanel.tsx` | 수정 | +3 (activeTraits prop 연결) |
| `src/app/simulator/page.tsx` | 수정 | +1 (prop 주입) |
| `tests/unit/itemRecommender.test.ts` | 수정 | +3 테스트 케이스 추가 (유물 제외, AnimaSquad 활성 조건, PsyOps 상한) |

---

## 5. 테스트 계획

### 5.1 단위 테스트 추가

```ts
describe('filterItemPool — trait rules', () => {
  it('유물 아이템 완전 제외', () => {
    const all = [
      item('TFT_Item_Artifact_ShadowPuppet', { AD: 20 }),
      item('TFT_Item_InfinityEdge', { AD: 70 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 0, animaSquadLevel: 0 });
    expect(out.map(i => i.apiName)).not.toContain('TFT_Item_Artifact_ShadowPuppet');
  });

  it('만능 무기 완전 제외', () => {
    const all = [
      item('TFT17_AnimaSquadItem_Tier4_Omniweapon', { AD: 100 }),
      item('TFT_Item_InfinityEdge', { AD: 70 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 0, animaSquadLevel: 6 });
    expect(out.map(i => i.apiName)).not.toContain('TFT17_AnimaSquadItem_Tier4_Omniweapon');
  });

  it('AnimaSquad 비활성 시 AnimaSquad 아이템 제외', () => {
    const all = [
      item('TFT17_AnimaSquadItem_Tier2_SearingShortbow', { AD: 40 }),
      item('TFT_Item_InfinityEdge', { AD: 70 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 0, animaSquadLevel: 0 });
    expect(out.map(i => i.apiName)).not.toContain('TFT17_AnimaSquadItem_Tier2_SearingShortbow');
  });

  it('AnimaSquad 3+ 활성 시 AnimaSquad 아이템 포함', () => {
    const all = [
      item('TFT17_AnimaSquadItem_Tier2_SearingShortbow', { AD: 40 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 0, animaSquadLevel: 3 });
    expect(out.map(i => i.apiName)).toContain('TFT17_AnimaSquadItem_Tier2_SearingShortbow');
  });

  it('PsyOps 비활성 시 PsyOps 아이템 제외', () => {
    const all = [
      item('TFT17_Item_PsyOps_DroneMod', { AD: 40 }),
    ];
    const out = filterItemPool(all, 'DAMAGE', 'ad', { psyOpsLevel: 0, animaSquadLevel: 0 });
    expect(out.map(i => i.apiName)).not.toContain('TFT17_Item_PsyOps_DroneMod');
  });
});

describe('pickTopCombo — maxPsyOps', () => {
  it('maxPsyOps=1 이면 조합에 PsyOps 최대 1개', () => {
    const scored = [
      { item: item('TFT17_Item_PsyOps_DroneMod', { AD: 100 }), score: 100, reason: '' },
      { item: item('TFT17_Item_PsyOps_ChemicalCapacitorMod', { AD: 95 }), score: 95, reason: '' },
      { item: item('TFT_Item_InfinityEdge', { AD: 90 }), score: 90, reason: '' },
      { item: item('TFT_Item_LastWhisper', { AD: 85 }), score: 85, reason: '' },
    ];
    const combo = pickTopCombo(scored, baseStats, false, 2, { maxPsyOps: 1 });
    const psyCount = combo.filter(r => r.item.apiName.startsWith('TFT17_Item_PsyOps_')).length;
    expect(psyCount).toBeLessThanOrEqual(1);
  });
});
```

### 5.2 통합 시나리오 (수동 QA)

- [ ] 리플레이에서 캐리 클릭 → 추천 아이템에 유물/만능 무기/무관계 시너지 아이템 없음
- [ ] 팀에 동물특공대 3+ 있으면 해당 캐리 추천에 AnimaSquad 아이템 포함
- [ ] 팀에 초능력 2 있으면 PsyOps 아이템 최대 1개
- [ ] 팀에 초능력 4 있으면 PsyOps 최대 2개
- [ ] 두 시너지 모두 비활성 → 기존 일반 아이템만 추천
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 전부 통과

---

## 6. 대안 검토

| 대안 | 채택 여부 | 이유 |
|------|---------|------|
| **A. apiName prefix 체크 (본 Plan)** | ✅ | 단순, 데이터 구조 명확, 유지보수 쉬움 |
| B. `getItemCategory` 재사용 (기존 `item.ts:getItemCategory` 활용) | 부분 | 유물 카테고리는 이미 있지만 AnimaSquad/PsyOps 카테고리는 `special`/기타로 묶여 세분화 부족. prefix 가 더 정확 |
| C. `item.effects` 키 기반 필터 | ❌ | effects 키는 효과 명세라 카테고리 판별 불가 |

---

## 7. 위험 요소 & 완화

| 위험 | 완화 |
|------|------|
| 새 Set 시즌 데이터에서 apiName 패턴 변경 | 패턴 상수를 파일 상단에 집약, 버전 bump 시 1곳만 수정 |
| 조합 열거가 `maxPsyOps` 제약으로 3개 미만만 반환 | 기존 `pickTopCombo` 는 3개 미만도 허용. 일반 아이템 + PsyOps 섞어 Top-3 유지 가능 |
| `activeTraits` 미주입 시 필터 우회 | `filterItemPool` 의 `ctx` 파라미터가 optional 이라 주입 안 되면 구 동작. 단 `simulator/page.tsx` 에서 반드시 주입하도록 보장 |
| Radiant 변종 PsyOps (`_Radiant` suffix) | prefix `TFT17_Item_PsyOps_` 로 이미 커버됨 (Radiant 도 동일 prefix) |

---

## 8. 범위 외

- PsyOps/AnimaSquad 외 "시너지 조건부 아이템" — 현재 Set 17 에는 이 둘만 해당
- 증강 기반 아이템 제한 (예: "아이템 상자" 증강 효과)
- 상대 방어 기반 동적 추천 — 엔진 검증(2차) 으로 이미 다룸
- 수동 override 테이블 (챔피언별 선호 아이템)
