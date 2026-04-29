# Design: 유닛 크로스팀 드래그 (A ↔ B 팀 전환)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 유닛 크로스팀 드래그 |
| Plan 참조 | `docs/01-plan/features/unit-team-switch.plan.md` |
| 작성일 | 2026-04-22 |
| 상태 | Design |

---

## 1. 핵심 아이디어

`useDndHandlers.handleDragEnd` 의 `placed-unit` 분기 시작부 `if (dragData.team !== team) return;` 한 줄을 **크로스팀 전환 블록으로 교체** 한다. source 팀 배열에서 제거, target 팀 배열에 `{ ...dragged, position: pos }` 로 추가. 두 번의 `setTeam` 은 같은 이벤트 핸들러 안에서 호출되므로 React 가 자동 배치하고 `syncTeam` 이 auto-unit 자동 이주를 처리. 상위(`page.tsx`)가 콜백으로 `setSelectedUnit(null)` 을 수행.

---

## 2. 데이터 / 타입 스펙 (고정)

### 2.1 보존 대상 = `PlacedChampion` 전체

`src/types/index.ts:319-329`:

```ts
export interface PlacedChampion {
  champion: RawChampion;
  position: HexCoord;
  starLevel: number;
  items: RawItem[];
  voidItem?: RawItem | null;
  mfMode?: MfMode | null;
  permanentStacks?: PermanentStack | null;
  isDummy?: boolean;
  isSummon?: boolean;
}
```

전환 시 구현은 **`{ ...dragged, position: pos }`** 한 줄로 위 모든 필드를 자동 보존한다. 필드 추가가 생겨도 스프레드가 자동 커버 → 유지보수 비용 0.

### 2.2 Auto-unit 식별

`src/data/specialUnits.ts:57-67`:

```ts
export const AUTO_UNIT_API_NAMES = [
  'TFT16_AnnieTibbers',
  'TFT16_FreljordTurret',
  'TFT16_AzirSoldier',
  'TFT17_Summon',
  'TFT17_ShenProp',
] as const;

export function isAutoUnit(apiName: string): boolean { ... }
```

이 5개 apiName 은 크로스팀 전환을 **금지** — 주인(Annie/Freljord 소유자/Azir/Voyager 3+/Shen) 이 팀 전환하면 `syncTeam` 이 자동 제거 + 재생성으로 따라붙는다.

### 2.3 좌표 계산 (기존 로직 재사용)

`useDndHandlers.ts:59-62` 에서 이미 드롭 셀 → `(team, dataRow, col, pos)` 변환이 돼 있다:

```ts
const { row, col } = cellInfo;
const team = getTeamFromRow(row);
const dataRow = team === 'player' ? row - 4 : row;
const pos: HexCoord = { q: col - Math.floor(dataRow / 2), r: dataRow };
```

크로스팀 분기에서도 이 `team`/`pos` 값을 그대로 사용. **player 는 dataRow 0..3, enemy 는 dataRow 0..3** 범위를 공유하므로 새 팀에서도 유효.

---

## 3. `useDndHandlers.ts` 변경 명세

### 3.1 Import 추가

```ts
import { isAutoUnit } from '@/data/specialUnits';
```

### 3.2 Args 인터페이스 확장

```ts
interface UseDndHandlersArgs {
  playerTeam: PlacedChampion[];
  enemyTeam: PlacedChampion[];
  updatePlayerTeam: (action: ...) => void;
  updateEnemyTeam: (action: ...) => void;
  handleEquipItem: (team, index, item) => void;
  onChampionPlaced?: (team, index, champion) => void;
  onTeamSwitched?: () => void;  // ← 신규
}
```

`onTeamSwitched` 는 옵셔널. 호출 시점은 크로스팀 전환이 실제로 일어난 직후 (차단된 케이스 FR-4/FR-5 에선 호출 안 함).

### 3.3 `placed-unit` 분기 재작성

기존 (`useDndHandlers.ts:83-103`):

```ts
} else if (dragData.type === 'placed-unit') {
  if (dragData.team !== team) return;     // ← 제거
  const srcIdx = teamArr.findIndex(...);   // ← 같은 팀 기준 search
  if (srcIdx < 0) return;
  if (existingIdx >= 0 && existingIdx !== srcIdx) {
    // swap 로직
  } else if (existingIdx < 0) {
    // move 로직
  }
}
```

변경 후:

```ts
} else if (dragData.type === 'placed-unit') {
  const srcTeam = dragData.team;
  const srcArr = srcTeam === 'player' ? playerTeam : enemyTeam;
  const setSrcTeam = srcTeam === 'player' ? updatePlayerTeam : updateEnemyTeam;
  const srcOff = axialToOffset(dragData.position);
  const srcIdx = srcArr.findIndex(p => {
    const off = axialToOffset(p.position);
    return off.row === srcOff.row && off.col === srcOff.col;
  });
  if (srcIdx < 0) return;

  // === NEW: 크로스팀 전환 ===
  if (srcTeam !== team) {
    const dragged = srcArr[srcIdx];
    if (isAutoUnit(dragged.champion.apiName)) return;   // FR-4
    if (existingIdx >= 0) return;                        // FR-5: 점유 셀 → no-op
    setSrcTeam(prev => prev.filter((_, i) => i !== srcIdx));
    setTeam(prev => [...prev, { ...dragged, position: pos }]); // FR-2, FR-3
    onTeamSwitched?.();                                  // FR-6 (상위에서 setSelectedUnit(null))
    return;
  }

  // === 기존 same-team swap/move (수정 없음) ===
  if (existingIdx >= 0 && existingIdx !== srcIdx) {
    setTeam(prev => prev.map((p, i) => {
      if (i === srcIdx) return { ...p, position: prev[existingIdx].position };
      if (i === existingIdx) return { ...p, position: prev[srcIdx].position };
      return p;
    }));
  } else if (existingIdx < 0) {
    setTeam(prev => prev.map((p, i) => {
      if (i === srcIdx) return { ...p, position: pos };
      return p;
    }));
  }
}
```

**주의**: 기존 코드는 `teamArr` / `setTeam` 을 상단에서 `team` 기준으로 이미 계산해 둔다 (`useDndHandlers.ts:63-64`). 그 값은 크로스팀에서는 **target 팀 용** 이다. 새로 `srcArr`/`setSrcTeam` 을 추가해 source 와 target 을 명시 구분. 기존 same-team 경로에서는 `srcArr === teamArr` 이므로 결과 동일.

### 3.4 setTeam 호출 순서

```
1. setSrcTeam(remove)     → source 팀에서 drag 유닛 제거
2. setTeam(add)           → target 팀에 추가
3. onTeamSwitched?.()     → selectedUnit 초기화
```

두 setTeam 은 서로 다른 `useState` 라 독립적. React 18+ 자동 배치로 한 번의 리렌더에서 반영. `syncTeam` 은 각 `setTeam` 내부에서 실행되어 source/target 양쪽의 auto-unit 정리/생성을 동시 처리.

**auto-unit 재생성 순서 주의** (FR-7 검증 포인트):
- Annie 를 A → B 전환:
  - `setSrcTeam(prev => prev.filter(...))` → source(A) 에서 Annie 만 제거 → `syncTeam` → Tibbers 도 Annie 없으니 제거
  - `setTeam(prev => [...prev, { ...Annie, position: pos }])` → target(B) 에 Annie 추가 → `syncTeam` → Annie 가 있고 Tibbers 가 없으니 `findEmptyAdjacentHex` 로 Tibbers 추가
- 결과: A팀에선 Annie+Tibbers 사라짐, B팀엔 Annie+Tibbers 생성 — 기대 동작

### 3.5 함수 반환 변화 없음

반환은 그대로 `{ activeDragData, handleDragStart, handleDragEnd }`. 외부 API 추가 없음.

---

## 4. `src/app/simulator/page.tsx` 변경

### 4.1 `useDndHandlers` 호출에 콜백 추가

```ts
// src/app/simulator/page.tsx:109-120
const dnd = useDndHandlers({
  playerTeam: tm.playerTeam,
  enemyTeam: tm.enemyTeam,
  updatePlayerTeam: tm.updatePlayerTeam,
  updateEnemyTeam: tm.updateEnemyTeam,
  handleEquipItem: tm.handleEquipItem,
  onChampionPlaced: (team, index, champion) => {
    if (champion.apiName === 'TFT17_MissFortune') {
      tm.setPendingMfPlacement({ team, index });
    }
  },
  onTeamSwitched: () => {
    tm.setSelectedUnit(null);   // ← 신규
  },
});
```

`tm.setSelectedUnit` 는 `useTeamManagement` 가 이미 노출하는 함수 (`useTeamManagement.ts:537`).

### 4.2 layout 파일들은 수정 없음

`SimulatorLayoutDesktop/Tablet/Mobile` 모두 `dnd` prop 을 받아 `DndContext` 에 연결만 한다. 훅 내부 동작 변경이므로 상위 레이아웃 수정 불필요.

---

## 5. 영향 / 비영향 요약

### 5.1 영향 받는 파일 (수정)

| 파일 | 변경 |
|------|------|
| `src/hooks/useDndHandlers.ts` | import 1개 추가, args 필드 1개 추가, placed-unit 분기 재작성 (~20 라인) |
| `src/app/simulator/page.tsx` | `onTeamSwitched` 콜백 1줄 추가 |

### 5.2 영향 없음 (확인 대상)

| 영역 | 이유 |
|------|------|
| 시뮬레이션 엔진 (`src/lib/simulator/`) | 엔진은 `team` 필드만 본다. 팀 결정 시점이 런타임 placement 수정이므로 결정론 유지 |
| `board-team-gap` | 팀↔row 규칙은 변함없음 (player=row4~7, enemy=row0~3). gap 정상 |
| `SetupBoard` / `ReplayBoard` / `HexBoard` / `DroppableHexCell` / `DroppableOverlay` | 렌더 로직 무변 |
| `useTeamManagement` 내부 핸들러 | `handleQuickAddChampion` (A팀 고정) 은 의도적으로 유지 — Plan out of scope 처리 |
| `teamCode.ts` / 세이브 포맷 | `PlacedChampion` 구조 변경 없음 |
| 아이템 드래그 (`dragData.type === 'item'`) | 기존 분기 그대로. 여전히 소속 팀 유닛에만 장착 |
| 챔피언 드래그 from 풀 (`dragData.type === 'champion'`) | 기존 분기 그대로. 드롭한 셀의 team 으로 자동 배치 (행 기반) |

---

## 6. 구현 순서

1. **`useDndHandlers.ts`**
   - `import { isAutoUnit } from '@/data/specialUnits';`
   - `UseDndHandlersArgs` 에 `onTeamSwitched?: () => void;` 추가
   - 함수 파라미터 분해 목록에 추가
   - `placed-unit` 분기 재작성: `srcArr`/`setSrcTeam` 변수 도입 → 크로스팀 가드 제거 → 크로스팀 분기 블록 추가
2. **`src/app/simulator/page.tsx:109`**
   - `onTeamSwitched: () => { tm.setSelectedUnit(null); }` 추가
3. **빌드 3종**: `pnpm lint && pnpm typecheck && pnpm build`
4. **수동 QA**: Plan §6.2 체크리스트 순서대로

단일 커밋. 2 파일 ~25 라인 변경.

---

## 7. 테스트 / 검증 체크리스트

### 7.1 빌드

- [ ] `pnpm lint` (React Compiler 규칙 준수, `any` 없음)
- [ ] `pnpm typecheck`
- [ ] `pnpm build`

### 7.2 핵심 시나리오 (데스크톱 / `pnpm dev` → `/simulator`)

**기본 크로스팀**:
- [ ] 패널에서 Ahri 클릭 → A팀 뒷줄에 배치
- [ ] Ahri 를 B 영역 대칭 위치로 드래그 → B팀으로 전환, 같은 dataRow/col 유지
- [ ] Ahri 에 아이템 3개 장착 후 다시 A → B 드래그 → 아이템/별 보존 확인
- [ ] B → A 반대 방향도 동일

**속성 보존 (FR-2)**:
- [ ] starLevel 3 로 올린 후 팀 전환 → 3성 유지
- [ ] void item 장착 → 팀 전환 → voidItem 필드 유지
- [ ] Miss Fortune (mfMode 설정 상태) 팀 전환 → mfMode 유지
- [ ] permanentStacks 있는 챔피언 팀 전환 → stacks 값 유지

**Auto-unit (FR-4, FR-7)**:
- [ ] Annie 팀 전환 → A 에서 Annie+Tibbers 사라짐, B 에서 Annie+Tibbers 생성
- [ ] Tibbers **자체** 를 드래그해서 B 영역 시도 → 드롭 무시 (FR-4)
- [ ] Azir 팀 전환 → A 의 AzirSoldier 5체 제거, B 의 Azir 주변 5체 생성 (board 여유 있다는 전제)
- [ ] Shen 팀 전환 → ShenProp 마이그레이션
- [ ] Freljord 상징 유닛 팀 전환 → Turret 개수 양 팀 재계산
- [ ] Voyager 3 명 중 1 명 팀 전환해서 A 의 Voyager 가 2 명 이하가 되면 → A 의 Summon 제거, B 의 voyager 가 3 명 되면 Summon 생성

**충돌 (FR-5)**:
- [ ] B 영역의 어떤 셀에 이미 B팀 유닛이 있을 때, A팀 유닛을 그 셀로 드래그 → 아무 변화 없음 (아래 로그: 드롭 무시)

**selectedUnit 초기화 (FR-6)**:
- [ ] A팀 유닛 클릭(선택) → 하이라이트 → 같은 유닛 B 로 드래그 → 전환 후 주황 highlight 사라짐

**회귀 방지**:
- [ ] 같은 팀 내부 swap/move 동작 정상 (기존 코드 경로 미수정)
- [ ] 풀에서 챔피언 드래그 정상 (`dragData.type === 'champion'`)
- [ ] 아이템 드래그는 여전히 소속 팀 유닛만 장착
- [ ] 보드 밖 드롭으로 유닛 제거 동작 정상
- [ ] `board-team-gap` 시각 결과 변화 없음

### 7.3 태블릿 / 모바일

- [ ] `SimulatorLayoutTablet` / `SimulatorLayoutMobile` 에서 터치 드래그로 크로스팀 전환 동작
- [ ] 모바일 BottomSheet / peek 동작 회귀 없음 (앞선 커밋 `43019f3`, `8cba2d3` 범위)

---

## 8. Risks & Mitigations

| 리스크 | 영향 | 완화 |
|--------|------|------|
| source `setTeam` 제거 vs target `setTeam` 추가 순서 race | 🟢 | 다른 `useState` 에 대한 독립 update, React 자동 배치. 경험적으로 문제 없을 것 |
| `syncTeam` 의 `findEmptyAdjacentHex` 가 target 팀에서 auto-unit 자리 못 찾을 때 | 🟢 | 이미 기존에도 동일 상황 (board 꽉참). 기존 동작 유지 |
| `existingIdx` 검사의 `teamArr` 참조가 target 팀을 가리키는지 재확인 | 🟡 | `teamArr` 은 라인 63에서 `team` 기준으로 계산 → target. `existingIdx` 는 target 팀 셀 점유 판정. 정상 |
| `srcArr` vs 기존 `teamArr` 혼동 | 🟡 | 코드 리뷰로 확인. 크로스팀에서만 `srcArr` 사용, 같은 팀에서는 `teamArr` (= `srcArr`) |
| selectedUnit 초기화 실패 시 잘못된 index 유닛 highlight | 🟢 | `onTeamSwitched` 콜백으로 확실히 null 처리 |

---

## 9. Rollout / Rollback

- **Rollout**: 단일 PR. Feature flag 불필요
- **Rollback**: `useDndHandlers.ts` 의 크로스팀 분기 블록을 삭제하고 원래의 `if (dragData.team !== team) return;` 한 줄 복구 + `onTeamSwitched` 관련 제거. `page.tsx` 의 콜백 라인 삭제. 양쪽 모두 수 라인

## 10. Open Items (Plan 에서 이월)

- 드롭 셀 점유 시 swap 추가 여부 → 일단 no-op. 사용 감각 확인 후 결정
- 패널 A/B 토글 / 우클릭 "팀 전환" 메뉴 → 후속 feature
