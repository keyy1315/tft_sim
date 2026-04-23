# Design: 보드 A/B 팀 간 시각적 간격

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 보드 A/B 팀 간 시각적 간격 |
| Plan 참조 | `docs/01-plan/features/board-team-gap.plan.md` |
| 작성일 | 2026-04-22 |
| 상태 | Design |

---

## 1. 핵심 아이디어

보드 셀 좌표를 계산하는 **단일 출처** `createHexLayout().hexCenter(row, col)` 한 곳에 "player 팀(row 4~7)이면 cy에 `teamGap` px 추가" 분기를 넣는다. SetupBoard / ReplayBoard / DroppableHexCell / DroppableOverlay 가 이 헬퍼를 공유하므로 셀 좌표는 자동 정합. 두 보드 컴포넌트의 **고정 y 좌표(배경 tint, divider, 팀 라벨)** 만 추가로 `teamGap` 반영해 보정한다.

엔진(`src/lib/simulator/`) 및 상태 슬라이스는 전혀 건드리지 않는다.

---

## 2. 상수 정의

### 2.1 HexBoard.tsx 신규 상수

```ts
// src/components/battle/HexBoard.tsx
export const DEFAULT_HEX_R = 44;
const PAD = 5;

/** A/B 팀 사이에 추가할 시각적 간격 (px). Plan NFR-1 기준 "조금만" = 셀 간격의 ~16%. */
export const DEFAULT_TEAM_GAP = 10;

/** player 팀이 시작되는 offset row index. 이 값 이상이면 gap offset을 받는다. */
export const PLAYER_TEAM_ROW_START = 4;
```

`PAD` 는 기존 `const`(모듈 로컬) 유지 — 이미 `export { PAD }` 로 재노출 중. `DEFAULT_TEAM_GAP` / `PLAYER_TEAM_ROW_START` 는 처음부터 `export` 한다.

### 2.2 값 근거

- `HEX_H * 0.75 + PAD` = 같은 팀 내 row 간격 = `44*2*0.75 + 5` ≈ 71 px (default `HEX_R=44`)
- `teamGap = 10` ≈ 14% → "조금만" 수준. 8~12 범위에서 시각 확인 후 결정, 초기값은 10
- 향후 조절 필요 시 `DEFAULT_TEAM_GAP` 숫자만 변경

---

## 3. `createHexLayout()` 확장

### 3.1 시그니처 / 반환 타입

```ts
// src/components/battle/HexBoard.tsx
export interface HexLayout {
  HEX_R: number;
  HEX_W: number;
  HEX_H: number;
  PAD: number;
  teamGap: number; // ← 신규
  hexPoints: (cx: number, cy: number, r: number) => string;
  hexCenter: (row: number, col: number) => { cx: number; cy: number };
}

export function createHexLayout(
  hexR: number = DEFAULT_HEX_R,
  teamGap: number = DEFAULT_TEAM_GAP, // ← 신규 (기본값 있음, 기존 호출자 breaking 없음)
): HexLayout {
  const HEX_W = hexR * Math.sqrt(3);
  const HEX_H = hexR * 2;

  const hexPoints = (cx: number, cy: number, r: number): string => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return pts.join(' ');
  };

  const hexCenter = (row: number, col: number): { cx: number; cy: number } => {
    const offset = row % 2 === 1 ? HEX_W / 2 : 0;
    const cx = col * (HEX_W + PAD) + HEX_W / 2 + 20 + offset;
    const gapOffset = row >= PLAYER_TEAM_ROW_START ? teamGap : 0; // ← 핵심 변경
    const cy = row * (HEX_H * 0.75 + PAD) + hexR + 20 + gapOffset;
    return { cx, cy };
  };

  return { HEX_R: hexR, HEX_W, HEX_H, PAD, teamGap, hexPoints, hexCenter };
}
```

### 3.2 default export 동기화

```ts
const defaultLayout = createHexLayout(DEFAULT_HEX_R);
export const HEX_R = defaultLayout.HEX_R;
export const HEX_W = defaultLayout.HEX_W;
export const HEX_H = defaultLayout.HEX_H;
export { PAD };
export const hexPoints = defaultLayout.hexPoints;
export const hexCenter = defaultLayout.hexCenter;
// teamGap 은 consumer 가 `createHexLayout(...).teamGap` 으로 접근 — 상수 재export 불필요
```

`HexBoard` 컴포넌트(4열 단일팀용) 의 `height` 계산은 기존 그대로. `row >= 4` 가 발생하지 않는 `rows={4}` 기본 사용이므로 실제 영향 없음.

---

## 4. SetupBoard 수정

### 4.1 layout 구조 분해

```ts
// 기존
const { HEX_R, HEX_W, HEX_H, PAD, hexCenter, hexPoints } = createHexLayout(cellSize);
// 변경
const { HEX_R, HEX_W, HEX_H, PAD, teamGap, hexCenter, hexPoints } = createHexLayout(cellSize);
```

### 4.2 SVG 전체 `height`

```ts
// 기존
const height = ROWS * (HEX_H * 0.75 + PAD) + HEX_R + 40;
// 변경 (player 진영 4줄이 teamGap 만큼 밀려났으므로 총 높이도 증가)
const height = ROWS * (HEX_H * 0.75 + PAD) + HEX_R + 40 + teamGap;
```

### 4.3 팀 배경 tint

`SetupBoard.tsx:204-206` 의 두 `<rect>`:

```tsx
// 기존 — 두 rect 가 splitY 에서 맞닿음
const splitY = 4 * (HEX_H * 0.75 + PAD) + 10;
<rect x={0} y={0} width={width} height={splitY} fill="#ef444408" rx={8} />
<rect x={0} y={splitY} width={width} height={height - splitY} fill="#3b82f608" rx={8} />

// 변경 — 두 rect 가 teamGap 만큼 벌어짐
const splitY = 4 * (HEX_H * 0.75 + PAD) + 10;
<rect
  x={0} y={0}
  width={width}
  height={splitY}
  fill="#ef444408" rx={8}
/>
<rect
  x={0} y={splitY + teamGap}
  width={width}
  height={height - splitY - teamGap}
  fill="#3b82f608" rx={8}
/>
```

`splitY` 자체는 바꾸지 않음. player 팀 rect 만 시작 y 와 height 를 `teamGap` 만큼 보정.

### 4.4 좌측 세로 A/B 라벨

`SetupBoard.tsx:209-216`:

```tsx
// 기존
const bLabelY = 2 * (HEX_H * 0.75 + PAD) + HEX_R;                    // enemy 중앙
const aLabelY = 6 * (HEX_H * 0.75 + PAD) + HEX_R;                    // player 중앙

// 변경 — A 라벨은 player 진영이 밀린 만큼 같이 내림
const bLabelY = 2 * (HEX_H * 0.75 + PAD) + HEX_R;                    // 그대로
const aLabelY = 6 * (HEX_H * 0.75 + PAD) + HEX_R + teamGap;          // +teamGap
```

`transform` 의 rotate pivot 도 y 좌표에 맞춰 동일 값 사용:

```tsx
<text
  x={14} y={aLabelY}
  textAnchor="middle" fill="#3b82f6" fontSize="20" fontWeight="900" opacity={0.3}
  transform={`rotate(-90, 14, ${aLabelY})`}
>
  A
</text>
```

### 4.5 셀 렌더 영향 없음

- `hexCenter(row, col)` 이 gap 을 이미 반영하므로 `<polygon>`, `<text>` 별도 수정 불필요
- `hexBuffMap` key (`${displayRow}-${col}`) 는 논리적 grid 좌표 → 렌더 y 좌표 계산은 `hexCenter` 경유 → 자동 반영
- turret zone 계산(`getTurretEffectZones`) 은 offset 좌표 기반 → 영향 없음

---

## 5. ReplayBoard 수정

### 5.1 layout 구조 분해 / `height`

```ts
// 기존
const { HEX_R, HEX_W, HEX_H, PAD, hexCenter, hexPoints } = createHexLayout(cellSize);
const height = ROWS * (HEX_H * 0.75 + PAD) + HEX_R + 40;
// 변경
const { HEX_R, HEX_W, HEX_H, PAD, teamGap, hexCenter, hexPoints } = createHexLayout(cellSize);
const height = ROWS * (HEX_H * 0.75 + PAD) + HEX_R + 40 + teamGap;
```

### 5.2 Divider 선 + TEAM A/B 라벨

`ReplayBoard.tsx:99-114`:

```tsx
// 기존
const splitY = 4 * (HEX_H * 0.75 + PAD) + 10;
<line x1={10} y1={splitY} x2={width - 10} y2={splitY} stroke="#374151" strokeWidth={1} strokeDasharray="4,4" />
<text x={width - 16} y={splitY + 6} textAnchor="end" fill="#4b5563" fontSize="8">TEAM B</text>
<text x={width - 16} y={splitY + 18} textAnchor="end" fill="#4b5563" fontSize="8">TEAM A</text>

// 변경 — divider 를 gap 중앙에 위치시키고, 라벨은 각자 진영 쪽으로 당김
const splitY = 4 * (HEX_H * 0.75 + PAD) + 10;
const dividerY = splitY + teamGap / 2;
<line x1={10} y1={dividerY} x2={width - 10} y2={dividerY} stroke="#374151" strokeWidth={1} strokeDasharray="4,4" />
<text x={width - 16} y={dividerY - 4} textAnchor="end" fill="#4b5563" fontSize="8">TEAM B</text>
<text x={width - 16} y={dividerY + teamGap + 6} textAnchor="end" fill="#4b5563" fontSize="8">TEAM A</text>
```

TEAM B 라벨은 divider 바로 위, TEAM A 라벨은 player 진영 첫 row 가 시작되는 선 바로 아래에 위치 → gap 영역이 비어 보이면서 라벨이 각 진영에 붙음.

### 5.3 getUnitCenter / 이동 경로

```ts
function getUnitCenter(unitId: string): { cx: number; cy: number } | null {
  // ...
  const off = axialToOffset(unitSnap.position as HexCoord);
  return hexCenter(off.row, off.col); // ← 이미 gap 반영된 좌표 반환
}
```

수정 없음. 공격 arrow, 이동 애니메이션 경로 모두 `hexCenter` 를 거치므로 자동 정합.

- `player` 팀 유닛은 `off.row = 0..3` (데이터 좌표) 이지만 ReplayBoard 는 `off.row` 를 그대로 display row 로 사용하므로, player 유닛의 display row 가 4..7 이 되도록 저장되는 포인트가 맞는지 재확인 필요

**확인:** `ReplayBoard.tsx:44-52` 에서 `axialToOffset(unitSnap.position)` 의 결과를 그대로 `posMap` key 로 씀. 엔진의 `unitSnap.position` 은 이미 (플레이어는 row 4~7, 적은 row 0~3) 에 해당하는 axial 좌표로 저장되어 있어야 한다. SetupBoard 가 player 팀을 `row + 4` 로 display 하는 것과 달리, ReplayBoard 는 데이터 자체가 display row 와 일치. 따라서 `row >= 4` 분기로 player 팀이 정확히 걸린다.

### 5.4 영향 받지 않는 부분

- `posMap` key 형식 `${row},${col}` 불변
- `snapshot.events` 기반 combatEvents 순회 불변
- HP/mana 바, 별, 아이템 위치는 `cx`/`cy` 기준 — 자동 반영

---

## 6. DroppableHexCell / DroppableOverlay

### 6.1 DroppableHexCell.tsx

```ts
const { HEX_R, hexCenter } = createHexLayout(cellSize);
// ...
const { cx, cy } = hexCenter(row, col);
```

이미 `createHexLayout(cellSize)` 를 쓰므로 **수정 불필요**. player 팀 drop zone 이 자동으로 `teamGap` 만큼 아래로 내려감.

### 6.2 DroppableOverlay.tsx

`row < 4 → enemy`, `row >= 4 → player` 매핑은 논리 좌표이므로 그대로 유효. `DroppableHexCell` 의 pixel 위치는 `hexCenter` 가 처리. **수정 불필요**.

### 6.3 검증 포인트

- player 팀 첫 줄(`row = 4`) 의 drop zone 이 SetupBoard 의 첫 줄 셀과 정확히 겹치는지 (두 컴포넌트 모두 같은 `hexCenter` 결과 쓰므로 수학적으로 일치해야 함)
- 드래그 중 `DragOverlay` 의 상대 좌표가 어긋나지 않는지 (dnd-kit 은 pointer 기준이므로 gap 과 무관)

---

## 7. 영향 받지 않는 모듈 (확인 사항)

| 모듈 | 영향 여부 | 사유 |
|------|----------|------|
| `src/lib/simulator/` (엔진 전체) | ❌ | 순수 TS, DOM 좌표 무관 |
| `src/store/*` (Zustand 4개 슬라이스) | ❌ | 렌더링 좌표 저장 없음 |
| `src/types/index.ts`의 `axialToOffset` / `offsetToAxial` | ❌ | grid 논리 좌표계, DOM y 와 독립 |
| `turretZones` 계산 | ❌ | offset row/col 기반, 픽셀 없음 |
| `hexBuffMap` | ❌ | offset 좌표 key |
| UnitToken / StatusEffectBadge | ❌ | relative 좌표 |
| DamageSidebar / UnitDetailPanel | ❌ | 보드 밖 |
| SimulatorLayoutDesktop/Tablet/Mobile | ❌ | SVG wrapper 만 스케일. 내부 `height` 증가는 자동 수용 |

---

## 8. 구현 순서

1. **HexBoard.tsx**: 상수 추가 → `HexLayout.teamGap` 필드 → `createHexLayout` 시그니처 확장 → `hexCenter` 분기 추가
2. **SetupBoard.tsx**: 분해 구조에 `teamGap` 추가 → `height` 보정 → 배경 tint rect 2개 수정 → A 라벨 y 보정
3. **ReplayBoard.tsx**: 분해 구조에 `teamGap` 추가 → `height` 보정 → divider y / TEAM A·B 라벨 y 재계산
4. **DroppableHexCell.tsx / DroppableOverlay.tsx**: 코드 수정 없음, 런타임 검증만
5. `pnpm lint && pnpm typecheck && pnpm build` 3종 통과
6. `/simulator` 수동 확인 (데스크톱 → 태블릿 → 모바일 순)

단일 커밋으로 묶어도 무방. 약 4개 파일, ~15 라인 변경.

---

## 9. 테스트 / 검증 체크리스트

### 9.1 빌드

- [ ] `pnpm lint` 통과 (React Compiler 규칙 위반 없음)
- [ ] `pnpm typecheck` 통과 (HexLayout 필드 추가가 기존 소비자에 breaking 아님)
- [ ] `pnpm build` 통과

### 9.2 SetupBoard 수동 확인 (데스크톱)

- [ ] row 3 (enemy 최하단) 과 row 4 (player 최상단) 사이 약 10 px gap 확인
- [ ] 빨간 배경 tint / 파란 배경 tint 가 gap 영역에서 끊어짐
- [ ] 좌측 A / B 라벨이 각자 진영 중앙에 위치
- [ ] player 팀 row 4 빈 셀 클릭 시 해당 dataRow=0 로 배치되는지 (mapping 정상)
- [ ] 드래그로 B → A, A → B 팀 간 이동 → 드롭 좌표 정확
- [ ] turret 설치 시 front/back zone 하이라이트가 gap 에 겹치지 않고 같은 진영에만 적용
- [ ] hex buff 라벨 텍스트 위치 정상

### 9.3 ReplayBoard 수동 확인

- [ ] 전투 시작 → 점선 divider 가 gap 가운데
- [ ] TEAM B 라벨 divider 위, TEAM A 라벨 divider 아래 위치
- [ ] 재생 중 유닛 이동 애니메이션이 gap 을 자연스럽게 건너뜀
- [ ] 공격 arrow 가 정확한 셀 중심으로 이어짐
- [ ] HP/마나 바, 별, 아이템 아이콘이 셀 내부 위치 정상

### 9.4 태블릿 / 모바일 레이아웃

- [ ] `SimulatorLayoutTablet` / `SimulatorLayoutMobile` 에서도 동일 검증
- [ ] 스케일 래퍼(존재한다면) 와 새 `height` 가 호환되어 세로 스크롤 과다 발생 없음
- [ ] BottomSheet / 드래그 peek 동작 변화 없음 (이전 커밋 `8cba2d3`, `43019f3` 영향 없음 확인)

### 9.5 회귀 방지

- [ ] DroppableHexCell 좌표와 SetupBoard 셀 SVG 좌표 일치 (육안 + 실제 드롭 테스트)
- [ ] 기존 `HexBoard` (단일팀 4행) 컴포넌트 사용처에서 레이아웃 변화 없음 (`row < 4` 범위라 gap 적용 안됨)

---

## 10. Rollout / Rollback

- **Rollout**: 단일 PR, 순수 UI 변경이라 feature flag 불필요
- **Rollback**: `DEFAULT_TEAM_GAP = 0` 으로 바꾸면 모든 변경이 무효화 (수식 상 `gapOffset=0`, `height + 0`, divider/라벨 y 동일) → 사실상 safe toggle

## 11. Open Items

- 최종 `DEFAULT_TEAM_GAP` 값: 10 → 구현 후 실기기 확인 후 8 / 12 중 선택
- ReplayBoard 의 arrow marker / 이동 애니메이션이 gap 을 건너뛰는 모습이 오히려 어색하게 보이면 divider 두께/색을 미세 조정할 수 있으나 기본은 현 그대로 유지
