# Plan: 유닛 크로스팀 드래그 (A ↔ B 팀 전환)

> **Summary**: SetupBoard에서 이미 배치된 유닛을 상대편 진영으로 드래그하면 소속 팀이 전환되도록 허용한다. 현재 `useDndHandlers.ts:84` 의 `if (dragData.team !== team) return;` 가드가 크로스팀 드롭을 차단하고 있어, 패널 클릭으로 A팀에 올린 유닛을 B팀으로 옮길 방법이 전혀 없다. 이 가드를 "제거"가 아니라 "팀 전환 핸들러"로 교체.
>
> **Project**: tft_sim
> **Version**: 0.1
> **Author**: Dayoung
> **Date**: 2026-04-22
> **Status**: Draft

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 유닛 크로스팀 드래그 (A ↔ B 팀 전환) |
| 작성일 | 2026-04-22 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 패널에서 챔피언을 클릭하면 `handleQuickAddChampion`이 `updatePlayerTeam` 으로 고정 호출 → **항상 A팀으로만** 올라감. 올린 뒤 B팀으로 옮기려 드래그해도 `useDndHandlers.ts:84` 의 `dragData.team !== team` 가드가 드롭을 무시. 결과적으로 A팀에 올라간 유닛을 B팀으로 보낼 UI가 없다 |
| **Solution** | DnD handler 에서 크로스팀 드롭을 허용 — source 팀에서 유닛 제거 → target 팀에 **동일 `champion`/`starLevel`/`items`/`voidItem`/`mfMode`/`permanentStacks` 전체 보존**하여 추가. 드롭 셀의 `(dataRow, col)` 을 새 위치로 사용 (대칭 위치에 드롭하면 자연스럽게 원 배치 유지). `isAutoUnit` 은 팀 전환 금지 — 주인이 팀 전환하면 `syncTeam` 이 source 에서 제거 & target 에서 자동 재생성. 드롭 셀이 점유돼 있으면 드롭 취소 (swap은 out of scope) |
| **Function UX Effect** | A팀 유닛을 B 영역으로 드래그만 하면 즉시 팀 전환. 화면은 위아래 거울 반전처럼 보이지만 각 팀 기준 상대 위치 ("뒷줄 좌측 2번째") 가 유지돼 전술 의미 보존. 대칭 반대편 셀이 비어있으면 "팀만 바뀜", 다른 곳으로 드롭하면 "팀 + 위치 둘 다 바뀜" — 사용자 의도에 따라 선택 가능 |
| **Core Value** | 분석 툴 핵심 플로우("내 덱 vs 상대 덱") UX 완성. 지금은 B팀 구성 시 매번 B 진영 빈 칸을 먼저 클릭해 피커를 열어야만 하는데, 이 변경 후엔 **A팀에서 편집 → 드래그해서 B로 보내기** 가 가능해 양 팀 구성 속도가 크게 빨라짐. 엔진 0 변경, 순수 UX 레이어 수정 |

---

## 1. Overview

### 1.1 현재 동작 (문제점)

#### (a) 패널 클릭 → A팀 고정

`useTeamManagement.ts:306-325` `handleQuickAddChampion`:

```ts
const handleQuickAddChampion = (champion: RawChampion) => {
  for (let row = 3; row >= 0; row--) {
    for (let col = 0; col < BOARD_COLS; col++) {
      // ...
      updatePlayerTeam(prev => [...prev, { champion, position: pos, ... }]); // ← hardcoded
      return;
    }
  }
};
```

#### (b) 크로스팀 드롭 차단

`useDndHandlers.ts:83-84`:

```ts
} else if (dragData.type === 'placed-unit') {
  if (dragData.team !== team) return; // ← 차단
  // ...
}
```

결과: 패널 클릭으로 A팀에 올라간 유닛을 B팀으로 옮길 수단이 아예 없음.

### 1.2 데이터 좌표 구조 확인 (중요)

두 팀 모두 **`PlacedChampion.position` 은 `dataRow 0..3` 범위 axial 좌표** 로 저장된다. 차이는 화면 렌더링에서:
- `enemy` 팀: `displayRow = dataRow` (row 0~3)
- `player` 팀: `displayRow = dataRow + 4` (row 4~7)

(`SetupBoard.tsx:162`, `useDndHandlers.ts:61` 모두 이 규칙 사용)

따라서 **A팀 dataRow=3 유닛을 B팀으로 전환하면 B팀 dataRow=3 이 되어 화면상 거울 대칭 위치에 나타나고, "각 팀 기준 뒷줄 좌측 N" 이라는 전술적 의미는 그대로 유지** 된다. 이게 유저가 말한 "팀 내 배치는 그대로" 의 정확한 의미.

### 1.3 Related Files

- `src/hooks/useDndHandlers.ts` — 핵심 수정 지점 (크로스팀 가드 → 팀 전환 브랜치)
- `src/hooks/useTeamManagement.ts` — 유틸 함수 `isAutoUnit`, `syncTeam` 참조. `handleRemoveUnit` / add 로직 재활용
- `src/types/index.ts` — `PlacedChampion` 필드 전체 보존 여부 확인
- `src/data/specialUnits.ts` — `isAutoUnit` 정의 확인

영향 받지 않는 것: 엔진(`src/lib/simulator/`), Zustand 슬라이스, 시각 레이어(`SetupBoard`/`ReplayBoard`/`HexBoard`), `board-team-gap` 기능.

---

## 2. Scope

### 2.1 In Scope

- [ ] `useDndHandlers.ts` `handleDragEnd` 의 `placed-unit` 분기: `dragData.team !== team` 케이스를 "차단" → "크로스팀 전환" 으로 교체
- [ ] 크로스팀 전환 구현: source 제거 → target 에 전체 속성 보존 추가 (champion, position=드롭 셀의 dataRow/col, starLevel, items, voidItem, mfMode, permanentStacks, isSummon 등 `PlacedChampion` 의 모든 필드)
- [ ] auto-unit (`isAutoUnit(champion.apiName)` true) 은 팀 전환 금지 — 기존 삭제 가드와 동일한 패턴
- [ ] 드롭 셀에 target 팀의 다른 유닛이 이미 있으면 no-op (swap은 out of scope)
- [ ] 팀 전환 후 `selectedUnit` 초기화 (이전 팀의 index 가 의미 상실)
- [ ] 팀 전환은 단일 트랜잭션 느낌이 되도록 source/target `setTeam` 을 같은 이벤트 핸들러 내에서 연속 호출 (React 는 자동 배치)
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 3종 통과
- [ ] 수동 QA: A→B, B→A 양방향 / 아이템/별 유지 / 주인(아니/아지르/쉔) 팀 전환 시 auto-unit 자동 이주 확인

### 2.2 Out of Scope

- **Swap (두 유닛 동시 팀 교환)**: 드롭 셀이 점유되어 있을 때 양 유닛 팀을 동시에 바꾸는 기능. 내부 상태 일관성 리스크(양쪽 `syncTeam` 동시 실행) 대비 가치 낮음. 필요하면 후속 작업
- **패널 A/B 토글**: 이번 변경 후에도 패널 클릭은 A팀 고정 유지. 드래그로 B팀 이동 가능하므로 OK. 만약 불편하면 후속 feature `panel-team-toggle` 로 분리
- **우클릭 컨텍스트 메뉴의 "팀 전환"**: 위 토글과 마찬가지로 후속
- **board-team-gap 과의 연동 변경**: gap 은 그대로 row 기반 유지. 유닛은 여전히 player=row 4-7, enemy=row 0-3 규칙 준수 → 시각 규칙 변함 없음
- **엔진 backline/dash 재설계**: 해당 사항 없음 (팀 배치 규칙은 기존 그대로)
- **모바일 long-press → 팀 전환 메뉴** 같은 대체 UX: 드래그가 모바일에서도 이미 동작

### 2.3 엔진 / 결정론 영향

**없음.** 엔진은 `team: 'player' | 'enemy'` 필드만 본다. 시뮬 시작 시점 팀 구성만 확정되면 결정론 유지.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 내용 | 우선순위 | 상태 |
|----|------|---------|------|
| FR-1 | `useDndHandlers` 에서 `placed-unit` 드래그가 상대 팀 셀 위로 드롭되면 크로스팀 전환이 일어난다 | P0 | - |
| FR-2 | 전환 시 `champion`, `starLevel`, `items`, `voidItem`, `mfMode`, `permanentStacks`, `isSummon` 등 `PlacedChampion` 의 **모든 속성이 보존**된다 | P0 | - |
| FR-3 | 새 `position` 은 드롭한 셀의 `(dataRow, col)` 값. 사용자가 동일 dataRow/col (대칭 위치) 에 드롭하면 논리 좌표 유지 | P0 | - |
| FR-4 | `isAutoUnit(champion.apiName)` 이면 크로스팀 드롭 무시 (기존 `handleRemoveUnit` / `handleStarChange` 패턴과 일관) | P0 | - |
| FR-5 | 드롭 셀에 target 팀 다른 유닛이 있으면 no-op (기존 same-team 로직의 swap 분기 미적용) | P1 | - |
| FR-6 | 전환 완료 시 `setSelectedUnit(null)` | P1 | - |
| FR-7 | 주인(Annie/Azir/Shen/Freljord/Voyager) 이 팀 전환되면 `syncTeam` 이 source 팀에서 auto-unit 제거 + target 팀에서 자동 재생성 (기존 동작 유지되는지 확인) | P1 | - |

### 3.2 Non-Functional Requirements

| ID | 내용 |
|----|------|
| NFR-1 | 변경 범위: `useDndHandlers.ts` 한 파일, ~30 라인 추가/수정. 새 public API 추가 없음 |
| NFR-2 | `board-team-gap` 기능과 시각/좌표 모두 독립 |
| NFR-3 | React 19 / React Compiler 규칙 준수 (`set-state-in-effect` 없음, 이벤트 핸들러에서만 setState) |

---

## 4. 구현 방향 스케치

### 4.1 `useDndHandlers.ts` 변경 (의사 코드)

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

  const dragged = srcArr[srcIdx];

  // NEW: 크로스팀 분기
  if (srcTeam !== team) {
    if (isAutoUnit(dragged.champion.apiName)) return; // FR-4
    const targetArr = teamArr; // 이미 위에서 target 팀 배열 계산됨
    // 드롭 셀이 target 팀에서 점유중이면 no-op — FR-5
    if (existingIdx >= 0) return;
    // FR-2: 속성 전체 보존, position 은 드롭한 셀
    setSrcTeam(prev => prev.filter((_, i) => i !== srcIdx));
    setTeam(prev => [...prev, { ...dragged, position: pos }]);
    setSelectedUnit(null); // FR-6 — selectedUnit 이 DnD 훅 내부에 없으면 상위 prop 으로 노출 필요
    return;
  }

  // 기존 same-team 로직 (swap / move) 그대로
  // ...
}
```

### 4.2 `setSelectedUnit` 접근

현재 `useDndHandlers` 는 `selectedUnit` 을 모름. 두 가지 선택:

- **A**: `useDndHandlers` args 에 `onTeamSwitched?: () => void` 추가 → 상위 layout 에서 `setSelectedUnit(null)` 호출
- **B**: 호출 시점에서 `selectedUnit` 까지 전달받아 훅 내부에서 처리

A 가 훅 책임 분리상 깔끔. 실제 구현 시 A 로 진행.

### 4.3 `isAutoUnit` import

```ts
import { isAutoUnit } from '@/data/specialUnits';
```

---

## 5. Risks & Mitigations

| 리스크 | 영향 | 완화 |
|--------|------|------|
| source/target `setTeam` 호출이 별도 `useState` 라 순서 민감 | 🟡 배치 이상 | React 는 같은 이벤트 핸들러 내 state update 를 자동 배치. 명시적 `flushSync` 불필요. 만약 auto-unit 재생성이 이상하게 보이면 target setTeam 이후 source setTeam 순서를 바꿔 검증 |
| 주인(Annie) 팀 전환 → source 의 `syncTibbersInTeam` 이 Tibbers 제거, target 의 `syncTibbersInTeam` 이 Tibbers 추가. 근데 target 추가 시 `findEmptyAdjacentHex` 가 Annie 위치 기준으로 빈 칸을 찾는데, 방금 옮긴 Annie 주변이 비어있을 가능성 높아 정상 동작 예상 | 🟡 | 실제 테스트로 확인. 경계 케이스 (target 팀 board 가 꽉 차 있을 때) 는 기존과 동일하게 auto-unit 생성 실패 — 현재도 동일한 동작 |
| 드롭 셀이 dataRow 범위를 벗어날 수 있는가 | 🟢 | `parseCellId` + `getTeamFromRow(row)` 로 `dataRow = team==='player' ? row-4 : row` 계산. 항상 0..3 범위 |
| `selectedUnit` 이 남은 source 팀의 다른 index 와 우연히 겹쳐 잘못된 유닛 highlight | 🟡 | FR-6 의 `setSelectedUnit(null)` 로 예방 |
| 주인 팀 전환 시 새 팀의 `syncTeam` 이 재귀 호출되면서 auto-unit position 이 기존 target 팀 유닛과 충돌 | 🟡 | `syncTeam` 내부가 이미 `findEmptyAdjacentHex` 로 충돌 방지 |

---

## 6. Verification Plan

### 6.1 자동 확인

```bash
pnpm lint && pnpm typecheck && pnpm build
```

### 6.2 수동 시나리오 (`pnpm dev` → `/simulator`)

데스크톱 우선:

- [ ] 패널에서 챔피언 3개 연속 클릭 → A팀에 배치됨 (기존 동작)
- [ ] A팀 유닛을 B 영역 **같은 col / dataRow** 위치로 드래그 → B팀으로 전환, 아이템/별 유지
- [ ] A팀 유닛을 B 영역 **다른 위치** 로 드래그 → B팀으로 전환 + 그 위치로 이동
- [ ] B팀 → A팀 반대 방향도 동일 확인
- [ ] 같은 팀 내부 드래그는 기존처럼 swap/move (회귀 없음)
- [ ] **아이템** 드래그는 여전히 소속 팀 유닛에게만 드롭 가능 (변경 없음)
- [ ] **어니/아지르/쉔** 팀 전환 → source 팀의 Tibbers/Soldier/Artifact 자동 제거, target 팀에 자동 재생성
- [ ] **프렐요드/길잡이** 상징이 바뀌면 Turret/Summon 개수도 재계산 — source 감소, target 증가
- [ ] **Tibbers/Soldier/Artifact/Turret/Summon 자체를 드래그** → 크로스팀 드롭 무시 (FR-4)
- [ ] 팀 전환 대상 셀이 **이미 점유** 되어 있으면 드롭 무시 (FR-5)
- [ ] 전환 직후 `selectedUnit` 하이라이트 없음 (FR-6)

태블릿 / 모바일:

- [ ] `SimulatorLayoutTablet` / `SimulatorLayoutMobile` 에서 터치 드래그로도 동일 시나리오 동작

`board-team-gap` 회귀 확인:

- [ ] 팀 간 gap 여전히 정상, 팀 전환 동작이 gap 표시를 깨지 않음

---

## 7. Rollout / Rollback

- **Rollout**: 단일 PR, feature flag 불필요
- **Rollback**: `if (dragData.team !== team) return;` 를 다시 넣으면 이전 동작으로 원복

## 8. Open Questions

- 드롭 셀이 점유된 경우 **swap 을 추가**할지: 일단 no-op 기본. 사용 후 필요 판단되면 `unit-team-swap` 후속 feature
- 패널 클릭 시 "현재 선택 팀" 토글 UI 여부: 본 feature 완료 후 사용 감각 보고 결정
- 다중 선택 드래그 (여러 유닛 동시 팀 전환): out of scope
