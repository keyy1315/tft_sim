# actual-data 아이템 편집 UX 개선 설계

> **상태**: Design 단계 — 브레인스토밍 완료, 구현 플랜 작성 대기
> **작성일**: 2026-04-24
> **선행 문서**: `docs/superpowers/specs/2026-04-23-actual-data-design.md` (actual-data 전체 설계)
> **대상**: `/actual-data/[gameId]` 편집 페이지 (Sub-project 1 Core가 이미 구현된 상태)

## 1. 배경과 문제

`/actual-data` 편집기에서 보드에 챔피언을 배치하고 아이템을 장착할 수 있지만, **장착된 아이템을 개별적으로 제거하거나 교체하는 수단이 없다**. 현재 흐름은:

1. 잘못 장착된 아이템이 있는 유닛을 **삭제**(보드 밖으로 드래그)
2. 해당 챔피언을 사이드바에서 다시 드래그
3. 별 레벨/위치 재설정
4. 나머지 올바른 아이템 2개 재장착
5. 새 아이템 장착

이 흐름은 1개 아이템 수정에 5단계가 필요해 ground truth 수집 속도를 크게 떨어뜨린다.

## 2. 목표

- **개별 슬롯 제거**: 1슬롯만 비우기 — O(1) 조작
- **아이템 교체**: A → B 로 바꾸기 — O(1) 조작
- **전체 초기화**: 한 유닛의 3슬롯을 한 번에 비우기 — O(1) 조작
- 기존 "빈 헥스에 아이템 드롭 시 첫 빈 슬롯 자동 채움" UX는 **유지**

## 3. 비목표 (Non-goals)

- 모바일 터치 최적화: 일단 데스크톱 우선. 필요 시 후속 작업.
- 아이템 이동(A유닛 → B유닛): 본 설계 대상 아님. 현재처럼 제거 후 재장착.
- 아이템 재조합기(Reforger) 같은 무작위화: 에디터 맥락에 맞지 않아 제외.
- Undo/Redo: 본 설계 대상 아님.

## 4. UX 설계

### 4.1 개별 슬롯 X 버튼 (정밀 제거)

- 보드 위 유닛 토큰 하단의 아이템 슬롯 3칸 중 **채워진 슬롯**에 hover 시 우상단에 `×` 버튼 노출
- `×` 클릭 → 해당 슬롯만 `undefined`로 설정 (다른 슬롯 위치·내용 유지, **재정렬 없음**)
- 비어있는 슬롯에는 `×` 미노출
- 접근성: `aria-label="{아이템 이름} 제거"`, 키보드 포커스 가능

### 4.2 드래그 교체 (A → B)

- 현재 동작:
  - `type: 'item'` 드래그 → 점유된 헥스에 drop → 첫 빈 슬롯 자동 채움 → 빈 슬롯 없으면 drop 무시
- 변경:
  - 기존 헥스 레벨 droppable은 그대로 두고, 유닛 토큰 하단의 **아이템 슬롯 UI 3칸 각각을 중첩 droppable**로 추가 등록
  - DnD 라이브러리(@dnd-kit) 특성상 마우스 커서가 슬롯 위에 있으면 슬롯 droppable이 우선 매칭되고, 슬롯 바깥(챔프 아이콘/헥스 여백)에 있으면 헥스 droppable이 매칭됨
  - 드롭 지점별 동작:
    | 드롭 위치 | 기존 슬롯 상태 | 동작 |
    |---|---|---|
    | 특정 슬롯 UI 영역(`slotIdx`) | 채워짐 | **교체** (해당 slotIdx 덮어씀) |
    | 특정 슬롯 UI 영역(`slotIdx`) | 비어있음 | 해당 slotIdx 채움 |
    | 슬롯 바깥 (챔프 아이콘/헥스 여백) | — | 기존 동작: 첫 빈 슬롯 자동 채움. 3칸 다 차있으면 drop 무시 |
- 슬롯 바깥 드롭 시 자동 채움을 유지하는 이유: 빠른 장착 흐름(아이템 드래그 → 유닛 위 대략 드롭) 보존
- 유닛이 없는 빈 헥스: 슬롯 자체가 없으므로 자동으로 기존 "챔프 없으면 drop 무시" 규칙 적용

### 4.3 자석 제거기 툴 (전체 초기화)

- `ChampionItemSidebar`의 탭 하단에 고정 노출되는 **Tools** 섹션 신설
- 현재 툴 1개: **자석 제거기** (`TFT_Consumable_ItemRemover`)
  - 아이콘: `public/data/images/items/tft_consumable_itemremover.tft_set13.png` (이미 리포 포함)
  - 이름 툴팁: "자석 제거기 — 유닛 위에 드롭하면 아이템 3칸 모두 제거"
- 드래그 타입: `type: 'tool', toolKind: 'remove-all'`
- 점유된 헥스에 drop → `items = [undefined, undefined, undefined]`로 초기화
- 빈 헥스 또는 보드 밖 drop → 무시 (사라지지 않음)

### 4.4 요약 Matrix

| 작업 | 조작 | 결과 |
|---|---|---|
| 슬롯 1개 비우기 | 슬롯 hover → `×` 클릭 | 해당 슬롯만 `undefined` |
| A→B 교체 | 새 아이템을 해당 슬롯 위에 드롭 | 해당 슬롯 덮어씀 |
| 3칸 초기화 | 자석 제거기를 유닛 위에 드롭 | 3칸 모두 `undefined` |
| 빠른 장착 | 아이템을 헥스 본체(슬롯 외)에 드롭 | 첫 빈 슬롯 자동 채움 (기존) |

## 5. 구현 변경 지점

### 5.1 DragData 타입 확장
파일: `src/components/actual-data/actualDndHandlers.ts` (또는 타입 정의 위치)

```ts
type DragData =
  | { type: 'champion'; champion: RawChampion }
  | { type: 'placed-unit'; team: 'player' | 'opponent'; position: HexCoord }
  | { type: 'item'; item: RawItem }
  | { type: 'tool'; toolKind: 'remove-all' };  // NEW
```

Drop target ID도 확장:
- 기존: `cell-{row}-{col}`
- 신규 추가: `item-slot-{team}-{q}-{r}-{slotIdx}` — 유닛의 개별 아이템 슬롯

`parseCellId`와 유사한 `parseSlotId(id) → { team, hex, slotIdx } | null` 추가.

### 5.2 보드 유닛 토큰 렌더
파일: `src/components/actual-data/ActualBoard.tsx` (또는 토큰 렌더 컴포넌트)

- 각 아이템 슬롯을 `useDroppable({ id: 'item-slot-...' })` 지정
- 채워진 슬롯에 hover hover 상태 → `×` 버튼 렌더
  - 위치: 슬롯 우상단, 작은 원형 버튼
  - 클릭 시 `onRemoveSlot(slotIdx)` 호출
- `onRemoveSlot` 로직: `units[unitIdx].items[slotIdx] = undefined` 패치 후 `updatePlayerTeam/updateOpponent` 호출

### 5.3 actualDndHandlers.ts drop 로직 분기
- drop target ID를 `parseCellId` / `parseSlotId` 순으로 시도
- `item-slot-*`에 drop 시: 해당 유닛·슬롯 특정 → 교체/채움
- `cell-*`에 drop 시: 기존 동작 유지 (헥스 본체 자동 채움, 챔프/유닛 이동 등)
- `tool: remove-all` drop:
  - target이 `item-slot-*` 또는 `cell-*` 중 점유된 헥스 → 해당 유닛 3칸 초기화
  - 빈 헥스 / 보드 밖 → no-op

### 5.4 사이드바 Tools 섹션
파일: `src/components/actual-data/ChampionItemSidebar.tsx`

- 탭 헤더 하단(모든 탭에서 공통 노출) 혹은 별도 `tools` 탭 — 후자가 깔끔
- 현재 탭 state를 `'champions' | 'items' | 'tools'`로 확장
- Tools 섹션: 자석 제거기 1개 렌더, `useDraggable({ id: 'tool-remove-all', data: { type: 'tool', toolKind: 'remove-all' } })`
- 아이콘 경로: `/data/images/items/tft_consumable_itemremover.tft_set13.png`

### 5.5 변경 파일 목록

| 파일 | 변경 요지 |
|---|---|
| `src/components/actual-data/actualDndHandlers.ts` | DragData union 확장, parseSlotId 추가, item/tool drop 분기 |
| `src/components/actual-data/ActualBoard.tsx` | 아이템 슬롯 개별 droppable + hover `×` 버튼 |
| `src/components/actual-data/ChampionItemSidebar.tsx` | Tools 탭/섹션 추가 (자석 제거기) |
| `src/components/actual-data/OpponentPanel.tsx` | (상대팀도 동일 처리 필요하면 연동) |

## 6. 데이터 모델 영향

없음. `PlacedUnit.items: [slot0, slot1, slot2]` 구조 그대로 사용. `undefined` 슬롯은 이미 JSON 직렬화 시 `null`로 저장되는 기존 규약 유지.

## 7. 검증

- 기존 테스트 스위트(196 pass) 유지되는지 확인
- 수동 확인 항목:
  1. 1/2/3번 슬롯 각각 X 클릭 시 해당 슬롯만 제거되는가 (재정렬 없이)
  2. 점유된 슬롯에 새 아이템 드롭 시 교체되는가
  3. 빈 슬롯에 드롭 시 해당 슬롯 채움
  4. 헥스 본체(슬롯 외)에 드롭 시 기존처럼 첫 빈 슬롯 자동 채움
  5. 자석 제거기를 유닛 위에 드롭 시 3칸 모두 초기화
  6. 자석 제거기를 빈 헥스 드롭 시 아무 일도 일어나지 않음
  7. 플레이어팀/상대팀 양쪽 모두 동일하게 동작
  8. 저장/재로드 후 슬롯 상태 유지

## 8. 오픈 이슈 / 후속 작업

- 모바일/태블릿 터치 UX: `×` 버튼을 항상 노출 또는 long-press 확인 팝업
- 키보드 단축키 (1/2/3으로 선택 유닛 슬롯 비우기): 파워 유저용, 필요 시
- 아이템 이동(유닛 간 drag): 현재 범위 제외
- 재조합기(Reforger) 툴: 에디터에 적합한 사용처가 떠오르면 Tools 섹션에 추가
