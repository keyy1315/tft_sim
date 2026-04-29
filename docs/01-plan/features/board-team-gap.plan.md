# Plan: 보드 A/B 팀 간 시각적 간격

> **Summary**: Setup/Replay 보드에서 A팀(아래, row 4~7)과 B팀(위, row 0~3) 사이에 작은 시각적 간격(gap)을 추가해 전선(front line) 경계를 한눈에 알아볼 수 있게 한다. 기존에는 두 팀 사이가 완전히 붙어 있어 row 3과 row 4의 경계가 색상 톤(enemy `#ef4444` vs player `#3b82f6`)으로만 구분되었다.
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
| Feature | 보드 A/B 팀 간 시각적 간격 |
| 작성일 | 2026-04-22 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | SetupBoard/ReplayBoard에서 B팀(rows 0-3)과 A팀(rows 4-7)이 한 번도 끊기지 않고 연속된 hex grid로 붙어 있어, 어느 줄이 "전선"인지 눈으로 즉시 파악하기 어렵다. ReplayBoard는 점선 한 줄로 구분하지만 셀은 여전히 붙어 있음 |
| **Solution** | `createHexLayout()`의 `hexCenter()`에 `teamGap` 파라미터를 추가해 `row >= 4` (player 팀)일 때 `cy`를 `teamGap` px 만큼 아래로 밀어준다. 공유 레이아웃 헬퍼를 쓰는 SetupBoard/ReplayBoard/DroppableHexCell/DroppableOverlay가 자동으로 반영됨. 기본값은 8~12px 수준 (셀 1개 높이의 ~15% 이내, "조금만") |
| **Function UX Effect** | 드래그/배치 시 "우리팀 줄"과 "상대팀 줄"을 즉시 구분할 수 있음. 리플레이에서 전선(front line) 위치가 시각적으로 더 선명해지고, 이동/대시 애니메이션이 진영을 건너뛰는 순간을 잡아내기 쉬워짐 |
| **Core Value** | 분석 툴로서의 가독성 ↑. 시뮬레이션 결과나 배치를 보는 사람이 "누가 어느 편에 있는지" 인지하는 데 드는 노력을 줄인다. 데이터/엔진 변경 0, 순수 렌더링 레이어 한 파일 수정으로 4개 보드 컴포넌트에 동시 적용 |

---

## 1. Overview

### 1.1 Purpose

보드는 `src/components/battle/HexBoard.tsx`의 `createHexLayout()`이 반환하는 `hexCenter(row, col)` 하나로 모든 셀 좌표가 결정된다. 여기에 "player 팀이면 아래로 약간 내린다"는 규칙을 한 줄 넣어 팀 사이에 여백을 만든다.

### 1.2 Background

- 현재 `HexBoard.tsx:42-47`의 `hexCenter`는 `row`를 그대로 `HEX_H * 0.75 + PAD` 계수로 곱한 y 좌표를 쓴다. 두 팀의 경계(row 3 → row 4)와 다른 row들의 간격이 동일
- `SetupBoard.tsx:205-206`: 팀 배경 tint 두 장 (enemy `#ef444408`, player `#3b82f608`) 이 `y = 4 * (HEX_H * 0.75 + PAD) + 10` 기준으로 맞닿아 있음
- `SetupBoard.tsx:209-216`: 왼쪽 세로 "B" / "A" 라벨 역시 같은 기준으로 계산
- `ReplayBoard.tsx:100-114`: 점선 divider와 "TEAM B" / "TEAM A" 라벨
- `DroppableHexCell.tsx`, `DroppableOverlay.tsx`: 전부 `createHexLayout().hexCenter`를 거쳐 좌표를 얻으므로 레이아웃을 한 곳에서 고치면 공짜로 따라옴

### 1.3 Related Files

- `src/components/battle/HexBoard.tsx` — 레이아웃 엔진 (핵심 수정 지점)
- `src/components/battle/SetupBoard.tsx` — 셋업 뷰. 배경 tint/라벨 y 위치 재계산 필요
- `src/components/battle/ReplayBoard.tsx` — 리플레이 뷰. divider/라벨 y 위치 재계산 필요
- `src/components/battle/DroppableHexCell.tsx` — 자동 반영 (수정 불필요, 단 검증 필요)
- `src/app/simulator/layout/shared/DroppableOverlay.tsx` — 자동 반영 (수정 불필요, 단 검증 필요)

---

## 2. Scope

### 2.1 In Scope

- [ ] `createHexLayout(hexR, teamGap?)` 시그니처 확장 — 기본값 10px
- [ ] `hexCenter(row, col)` 내부에서 `row >= 4`이면 `cy += teamGap`
- [ ] `HexLayout` 타입에 `teamGap` 필드 추가 (외부 소비자가 divider y 계산에 사용)
- [ ] 보드 전체 SVG `height` 공식에 `teamGap` 더하기
- [ ] `SetupBoard.tsx`: 팀 배경 tint 2장과 좌측 B/A 라벨 y 좌표 재계산 (divider 윗/아래 반영)
- [ ] `ReplayBoard.tsx`: divider 선 y와 TEAM A/B 라벨 y 재계산
- [ ] 시각 검증: 데스크톱/태블릿/모바일 3 레이아웃에서 드래그/드롭, 리플레이 재생 정상 동작 확인
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 3종 통과

### 2.2 Out of Scope

- 셀 사이(내부 `PAD`) 간격 조정 — 팀 사이에만 적용, 같은 팀 내부 row 간격은 그대로
- A팀/B팀 배경색 변경, 팀 라벨 스타일 변경
- `HexBoard.tsx` (4열 legacy 단일 보드)는 단일 팀 전용이라 `row >= 4` 가 실제로 안 쓰임. 코드는 자동 반영되지만 효과는 없음 — 의도된 동작
- 간격 값을 사용자가 조절하는 설정 UI — 상수로 충분
- 애니메이션/전환 효과
- 엔진 좌표계 (`axial`, `offset`) 변경 — 순수 렌더링 좌표만 이동

### 2.3 Deterministic / 엔진 영향

- 엔진(`src/lib/simulator/`) 및 Zustand 슬라이스는 전혀 건드리지 않는다
- `axialToOffset`/`offsetToAxial` 로직 불변
- 결정론적 시뮬레이션(Replay) 에 영향 없음

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 내용 | 우선순위 | 상태 |
|----|------|---------|------|
| FR-1 | `createHexLayout()`가 `teamGap` 파라미터를 받고, 반환 객체의 `hexCenter(row, col)`은 `row >= 4`일 때 `cy`에 `teamGap` 만큼 offset을 더한다 | P0 | - |
| FR-2 | `createHexLayout()` 반환 객체는 `teamGap` 값을 필드로 노출해 외부(divider/라벨 y 계산)에서 재사용 가능하다 | P0 | - |
| FR-3 | SetupBoard의 팀 배경 tint 2장이 새 간격 기준으로 맞닿지 않고 gap이 비어 보인다 | P0 | - |
| FR-4 | SetupBoard 좌측 세로 B/A 라벨이 여전히 각 팀 중앙에 위치한다 | P1 | - |
| FR-5 | ReplayBoard 점선 divider가 gap 중앙에 오고, TEAM A/B 라벨이 각각 위/아래 진영에 붙는다 | P0 | - |
| FR-6 | 드래그 & 드롭이 새 좌표로도 정확히 올바른 셀에 떨어진다 (DroppableHexCell은 같은 `hexCenter`를 쓰므로 자동) | P0 | - |

### 3.2 Non-Functional Requirements

| ID | 내용 |
|----|------|
| NFR-1 | 기본 `teamGap = 10` px 상수로 `HexBoard.tsx`에 export. "조금만" 떨어뜨리는 것이 요구사항이므로 `HEX_H * 0.75 + PAD` 셀 간격(~60px @ default)의 약 16% |
| NFR-2 | 렌더링 비용 증가 없음 — 좌표 계산 1회 분기 추가 |
| NFR-3 | 기존 스냅샷/테스트 (있다면) 가 깨지지 않아야 함. 필요 시 스냅샷 갱신 허용 |

---

## 4. Design Preview (구현 방향 스케치)

```ts
// src/components/battle/HexBoard.tsx
export const DEFAULT_TEAM_GAP = 10;

export interface HexLayout {
  HEX_R: number;
  HEX_W: number;
  HEX_H: number;
  PAD: number;
  teamGap: number;
  hexPoints: (cx: number, cy: number, r: number) => string;
  hexCenter: (row: number, col: number) => { cx: number; cy: number };
}

export function createHexLayout(
  hexR: number = DEFAULT_HEX_R,
  teamGap: number = DEFAULT_TEAM_GAP,
): HexLayout {
  // ...기존...
  const hexCenter = (row: number, col: number) => {
    const offset = row % 2 === 1 ? HEX_W / 2 : 0;
    const cx = col * (HEX_W + PAD) + HEX_W / 2 + 20 + offset;
    const extraY = row >= 4 ? teamGap : 0; // ← 핵심
    const cy = row * (HEX_H * 0.75 + PAD) + hexR + 20 + extraY;
    return { cx, cy };
  };
  return { HEX_R: hexR, HEX_W, HEX_H, PAD, teamGap, hexPoints, hexCenter };
}
```

### SetupBoard / ReplayBoard divider y

```ts
// 기존
const dividerY = 4 * (HEX_H * 0.75 + PAD) + 10;
// 변경 (gap 중앙에 오도록)
const dividerY = 4 * (HEX_H * 0.75 + PAD) + 10 + teamGap / 2;

// 보드 전체 높이
const height = ROWS * (HEX_H * 0.75 + PAD) + HEX_R + 40 + teamGap;
```

## 5. Risks & Mitigations

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 좌표계 불일치로 드래그가 어긋남 | 🔴 UX 치명 | 모든 소비자가 `createHexLayout`의 `hexCenter`를 단일 출처로 쓰므로 동일한 shift를 공유 — 구현 후 3 레이아웃에서 수동 검증 |
| hexBuff/turret zone 배경 색이 gap 영역에 어색하게 걸림 | 🟡 시각적 거슬림 | gap 영역은 셀이 없는 빈 공간이므로 stroke/fill 영향 없음. 배경 tint rect 두 장을 gap 기준으로 잘라내기만 하면 깔끔 |
| 태블릿/모바일에서 보드 스케일/스크롤이 틀어짐 | 🟡 | `height`가 `teamGap`만큼 커지는 것 외 변화 없음. 기존 스케일 래퍼가 그대로 수용 |
| ReplayBoard의 이동 경로/arrow marker 좌표 | 🟡 | arrow 좌표도 `hexCenter` 경유이므로 자동 반영. 단 이동 애니메이션 경로가 gap을 "점프"하는 것으로 보일 수 있음 — 의도된 시각 효과 (실제로 진영을 넘는 순간) |

---

## 6. Verification Plan

### 6.1 수동 확인

1. `pnpm dev` 로 실행 후 `/simulator` 에서:
   - [ ] SetupBoard: row 3과 row 4 사이에 gap이 보이는가
   - [ ] 드래그하여 정확히 해당 셀에 떨어지는가 (enemy → player, player → enemy 양방향)
   - [ ] hex buff / turret 범위 하이라이트가 여전히 올바른 셀 위에 표시되는가
2. 전투 시작 → ReplayBoard:
   - [ ] 점선 divider가 gap 중앙에 위치
   - [ ] TEAM A/B 라벨이 올바른 진영에 표시
   - [ ] 리플레이 재생 시 이동/대시 애니메이션 정상
3. 태블릿/모바일 레이아웃에서도 동일 확인

### 6.2 자동 확인

```bash
pnpm lint && pnpm typecheck && pnpm build
```

---

## 7. Open Questions

- `teamGap` 기본값: `10` 으로 시작. 감각이 부족하면 `8`, `12` 로 조절 후 고정
- 추후 "팀 강조 모드" 같은 설정이 생기면 gap을 더 크게 조정할 여지 — 현재는 상수
