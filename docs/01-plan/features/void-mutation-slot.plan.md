# 공허 돌연변이 아이템 슬롯 분리 Plan

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 공허 돌연변이 아이템이 일반 아이템과 같은 3칸 슬롯을 차지하여 실제 게임과 동작이 다름 |
| **Solution** | 공허 아이템을 별도 슬롯으로 분리 — 아이템 칸을 차지하지 않고 공허 챔피언당 1개만 장착 |
| **Function UX Effect** | 공허 챔피언에게 일반 아이템 3개 + 돌연변이 1개를 동시 장착 가능 |
| **Core Value** | 실제 TFT 공허 시너지 메카닉 정확 반영 |

---

## 1. 현황

### 현재 구현
- `PlacedChampion.items: RawItem[]` — 공허 아이템도 일반 `items` 배열에 포함
- `canEquipItem()` — 슬롯 3개 중 하나를 차지 (`items.length >= 3`)
- `ItemGrid` — 공허 시너지 활성 시 표시, 상단 정렬 (방금 추가)

### 문제
- 공허 아이템 장착 시 일반 아이템 슬롯 1칸을 소비 → 최대 2개 일반 + 1개 공허
- 실제 게임: 공허 돌연변이는 **별도 슬롯**, 일반 3칸 + 돌연변이 1칸 = 총 4칸

### 공허 돌연변이 아이템 (6개)
```
TFT16_Consumable_Void_PredatorInstincts  포식자의 본능
TFT16_Consumable_Void_AdrenalineModules  아드레날린 모듈
TFT16_Consumable_Void_IronCarapace       강철 껍질
TFT16_Consumable_Void_SpitterSpines      가시 발사
TFT16_Consumable_Void_RoyalHusk          거대 껍질
TFT16_Consumable_Void_LeechingNucleus    흡수 세포핵
```

---

## 2. 변경 사항

### 2.1 타입 변경 (`src/types/index.ts`)

`PlacedChampion`에 공허 전용 슬롯 추가:
```ts
export interface PlacedChampion {
  champion: RawChampion;
  position: HexCoord;
  starLevel: number;
  items: RawItem[];           // 일반 아이템 (최대 3개)
  voidItem?: RawItem | null;  // 공허 돌연변이 (최대 1개, 슬롯 미차지)
}
```

### 2.2 장착 로직 변경 (`src/lib/simulator/systems/item.ts`)

`canEquipItem()` 수정:
- 공허 아이템은 `items.length >= 3` 슬롯 체크를 **건너뜀**
- 대신: 이미 `voidItem`이 있으면 장착 불가
- 공허 특성이 없는 챔피언에게는 장착 불가 (공허 챔피언 전용)

### 2.3 장착 핸들러 변경 (`src/hooks/useDndHandlers.ts` or `useTeamManagement.ts`)

공허 아이템 장착 시 `items` 배열이 아닌 `voidItem` 필드에 저장.

### 2.4 UI 변경 (`src/components/builder/`)

- `SelectedUnitPanel` — 공허 슬롯을 일반 3칸 옆에 별도 표시
- `UnitToken` — 공허 아이템 뱃지 표시 (있으면)
- `ItemGrid` — 공허 아이템 선택 시 `voidItem`으로 라우팅

### 2.5 시뮬레이션 엔진 (`src/lib/simulator/`)

- `stat.ts` — `voidItem`의 effects도 스탯 합산에 포함
- `combatLoop.ts` — CombatUnit 초기화 시 `voidItem` 효과 반영

---

## 3. 장착 규칙

| 규칙 | 설명 |
|------|------|
| 공허 시너지 활성 필수 | 시너지 미활성 시 장착 불가 |
| 공허 챔피언 전용 | 공허 특성을 가진 챔피언에게만 장착 가능 |
| 챔피언당 1개 | 같은 챔피언에 2개 이상 불가 |
| 슬롯 미차지 | 일반 아이템 3칸과 독립 |
| 시너지 해제 시 | 공허 시너지가 비활성화되면 장착된 돌연변이 자동 해제 |

---

## 4. 수정 대상 파일

| 파일 | 변경 |
|------|------|
| `src/types/index.ts` | `PlacedChampion.voidItem` 필드 추가 |
| `src/lib/simulator/systems/item.ts` | `canEquipItem()` 공허 슬롯 분리 로직 |
| `src/hooks/useTeamManagement.ts` 또는 `useDndHandlers.ts` | 장착 핸들러 분기 |
| `src/components/builder/SelectedUnitPanel.tsx` | 공허 슬롯 UI |
| `src/components/builder/ItemGrid.tsx` | 공허 아이템 선택 라우팅 |
| `src/lib/simulator/systems/stat.ts` | voidItem 효과 합산 |
| `src/lib/simulator/engine/combatLoop.ts` | CombatUnit 초기화 시 voidItem 반영 |
| `src/components/battle/UnitToken.tsx` | 공허 아이템 뱃지 (선택) |

---

## 5. 구현 순서

1. `PlacedChampion` 타입에 `voidItem` 추가
2. `canEquipItem()` 공허 슬롯 분리
3. 장착 핸들러에서 공허 아이템 → `voidItem`으로 라우팅
4. `SelectedUnitPanel`에 공허 슬롯 UI 추가
5. `stat.ts` + `combatLoop.ts` 에 voidItem 효과 반영
6. 빌드 검증
