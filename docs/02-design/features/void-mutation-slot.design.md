# 공허 돌연변이 슬롯 분리 — Design Document

> Plan 참조: `docs/01-plan/features/void-mutation-slot.plan.md`

---

## 1. 타입 변경

### `src/types/index.ts` — PlacedChampion

```ts
export interface PlacedChampion {
  champion: RawChampion;
  position: HexCoord;
  starLevel: number;
  items: RawItem[];           // 일반 아이템 (최대 3개, 슬롯 차지)
  voidItem?: RawItem | null;  // 공허 돌연변이 (최대 1개, 슬롯 미차지)
}
```

---

## 2. 장착 로직 — `src/lib/simulator/systems/item.ts`

### canEquipItem() 수정

```
AS-IS:
  공허 아이템 → 시너지 체크 → 슬롯 3칸 체크 (일반과 동일)

TO-BE:
  공허 아이템 → 시너지 체크 → 공허 챔피언 체크 → voidItem 중복 체크
  (슬롯 3칸 체크 건너뜀)
```

**변경 상세:**

```ts
// 공허 돌연변이 → 별도 슬롯, 아이템 칸 미차지
if (category === 'void') {
  const voidTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Void');
  if (!voidTrait || !voidTrait.activeEffect) {
    return { canEquip: false, reason: '공허 시너지가 활성화되어야 합니다' };
  }
  // 공허 특성 챔피언만 장착 가능
  if (!champion.champion.traits.includes('공허')) {
    return { canEquip: false, reason: '공허 챔피언만 돌연변이를 장착할 수 있습니다' };
  }
  // 이미 돌연변이가 있으면 불가
  if (champion.voidItem) {
    return { canEquip: false, reason: '돌연변이는 챔피언당 1개만 장착 가능합니다' };
  }
  return { canEquip: true };  // 여기서 리턴 → 슬롯 체크 건너뜀
}
```

### isVoidMutation() 유틸 추가

```ts
export function isVoidMutation(item: RawItem): boolean {
  return getItemCategory(item) === 'void';
}
```

---

## 3. 장착/해제 핸들러 — `src/hooks/useTeamManagement.ts`

### handleAddItem 수정

```ts
// 현재: 모든 아이템을 items 배열에 push
return { ...p, items: [...p.items, item] };

// 변경: 공허 아이템이면 voidItem에 저장
if (isVoidMutation(item)) {
  return { ...p, voidItem: item };
} else {
  return { ...p, items: [...p.items, item] };
}
```

### handleRemoveItem — 변경 없음 (일반 아이템만 처리)

### handleRemoveVoidItem 추가

```ts
const handleRemoveVoidItem = (team: 'player' | 'enemy', index: number) => {
  const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
  setTeam(prev => prev.map((p, i) => {
    if (i !== index) return p;
    return { ...p, voidItem: null };
  }));
};
```

---

## 4. 스탯 계산 — `src/lib/simulator/systems/stat.ts`

### calculateStats 수정 불필요

현재 시그니처: `calculateStats(champion, starLevel, items, activeTraits, augments)`

**호출부에서 voidItem을 items에 합쳐서 전달:**

```ts
// combatLoop.ts 호출부
const allItems = placed.voidItem
  ? [...placed.items, placed.voidItem]
  : placed.items;
const { stats } = calculateStats(placed.champion, placed.starLevel, allItems, activeTraits, augmentEffects);
```

이 방식으로 `stat.ts`와 `getItemEffects()`는 수정 없이 공허 아이템의 effects가 자동 합산됩니다.

---

## 5. 전투 엔진 — `src/lib/simulator/engine/combatLoop.ts`

### CombatUnit 초기화 (line ~74)

```ts
// AS-IS
const { stats } = calculateStats(placed.champion, placed.starLevel, placed.items, ...);
// ...
items: placed.items,

// TO-BE
const allItems = placed.voidItem ? [...placed.items, placed.voidItem] : placed.items;
const { stats } = calculateStats(placed.champion, placed.starLevel, allItems, ...);
// ...
items: allItems,  // CombatUnit.items에도 공허 아이템 포함
```

이렇게 하면 전투 중 아이템 효과 참조 로직(`for (const item of unit.items)` line ~844)에서도 자동 반영.

---

## 6. UI 변경

### `src/components/builder/SelectedUnitPanel.tsx`

일반 아이템 슬롯 3칸 옆에 공허 슬롯 1칸 추가:

```
[아이템1] [아이템2] [아이템3]  |  [돌연변이]
```

- 공허 시너지 미활성 시: 돌연변이 슬롯 숨김
- 공허 시너지 활성 + 공허 챔피언: 빈 슬롯 표시 (보라색 테두리)
- 돌연변이 장착 시: 아이콘 표시 + 클릭으로 해제

### `src/components/builder/ItemGrid.tsx`

변경 없음 — 이미 공허 활성 시 상단 정렬 구현됨. 선택 시 `onSelect` 콜백은 동일하고, `handleAddItem` 내부에서 분기 처리.

---

## 7. 팀 코드 — `src/components/builder/TeamCodePanel.tsx`

### encode/decode에 voidItem 포함

팀 코드 생성/파싱 시 `voidItem`도 직렬화해야 함.
현재 팀 코드 형식을 확인 후 voidItem 필드 추가.

---

## 8. 수정 파일 목록 및 순서

| 순서 | 파일 | 변경 | 예상 변경량 |
|------|------|------|-----------|
| 1 | `src/types/index.ts` | `PlacedChampion.voidItem` 추가 | 1줄 |
| 2 | `src/lib/simulator/systems/item.ts` | `canEquipItem` 공허 분기 + `isVoidMutation` | ~15줄 |
| 3 | `src/hooks/useTeamManagement.ts` | `handleAddItem` 분기 + `handleRemoveVoidItem` | ~15줄 |
| 4 | `src/lib/simulator/engine/combatLoop.ts` | CombatUnit 초기화 시 allItems 합산 | ~5줄 |
| 5 | `src/components/builder/SelectedUnitPanel.tsx` | 공허 슬롯 UI | ~20줄 |
| 6 | `src/components/builder/TeamCodePanel.tsx` | encode/decode voidItem | ~10줄 |
| 7 | 빌드 검증 | `pnpm lint && typecheck && build` | — |
