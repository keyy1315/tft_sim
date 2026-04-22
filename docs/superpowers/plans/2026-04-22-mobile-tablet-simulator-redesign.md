# 모바일/태블릿 시뮬레이터 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전투 시뮬레이터의 모바일(<768px) / 태블릿(768~1023px) 반응형 레이아웃을 재설계한다. 보드 중심 + 바텀 시트(모바일) / 2-컬럼(태블릿) 하이브리드.

**Architecture:**
1. **Phase 1-2**: 독립 유틸 — `useViewport` 훅, `BottomSheet` / `OverflowMenu` 컴포넌트, 보드 컴포넌트에 `cellSize` prop 도입 (desktop 불변).
2. **Phase 3**: 기존 1047줄 `page.tsx` 를 `SimulatorLayoutDesktop` 로 추출 (behavior 불변) — router 로 축소.
3. **Phase 4-5**: `SimulatorLayoutMobile` + `SynergyChip` / `SimulatorLayoutTablet` 신규 구현.
4. **Phase 6**: 가상 키보드 · dnd-kit ↔ 시트 제스처 통합 · 엣지 케이스 폴리시.

테스트 전략: 순수 함수(state machine · breakpoint 계산)는 vitest 단위 테스트. React 컴포넌트는 TDD 가능한 pure logic 을 최대한 분리해 단위 테스트하고, 렌더링 동작은 수동 QA 로 검증. 기존 golden 엔진 스냅샷은 영향 없음.

**Tech Stack:** Next.js 16 (App Router), React 19 + React Compiler, TypeScript strict, Tailwind v4, Vitest, @dnd-kit, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-22-mobile-tablet-simulator-redesign.md`

**Constraints:**
- `eslint-disable` 로 React Compiler 경고 억제 금지
- `useEffect + setState` 로 파생 값 계산 금지 — `useSyncExternalStore` 또는 렌더 시 계산
- 각 Task 후 `pnpm lint && pnpm typecheck && pnpm build` 통과 필수
- `console.log` 커밋 금지

---

## File Structure

| 파일 | 역할 | 상태 |
|---|---|---|
| `src/hooks/useViewport.ts` | `useSyncExternalStore` + matchMedia 기반 breakpoint 훅 + pure `widthToViewport()` 헬퍼 | **신규** |
| `tests/unit/useViewport.test.ts` | `widthToViewport` 경계값 테스트 | **신규** |
| `src/components/ui/BottomSheet.tsx` | 3-state drawer 컴포넌트 (peek/half/full) | **신규** |
| `src/components/ui/bottomSheetLogic.ts` | pure state machine: snap 계산, 높이 계산 | **신규** |
| `tests/unit/bottomSheetLogic.test.ts` | snap/높이 계산 단위 테스트 | **신규** |
| `src/components/ui/OverflowMenu.tsx` | 드롭다운 메뉴 — 클릭 외부 감지 | **신규** |
| `src/components/battle/HexBoard.tsx` | `createHexLayout(hexR)` 팩토리로 리팩터 — 상수 export 대신 함수 반환 | **수정** |
| `src/components/battle/SetupBoard.tsx` | `cellSize` prop 추가, `createHexLayout` 사용 | **수정** |
| `src/components/battle/ReplayBoard.tsx` | `cellSize` prop 추가 | **수정** |
| `src/components/battle/DroppableHexCell.tsx` | `cellSize` prop 추가, `hexCenter` 를 prop 으로 받음 | **수정** |
| `tests/unit/hexLayout.test.ts` | `createHexLayout` 치수 계산 단위 테스트 | **신규** |
| `src/app/simulator/layout/types.ts` | 3개 레이아웃 공유 props 인터페이스 | **신규** |
| `src/app/simulator/layout/SimulatorLayoutDesktop.tsx` | 기존 3-column 로직 이관 | **신규** |
| `src/app/simulator/layout/SimulatorLayoutMobile.tsx` | 모바일 레이아웃 (보드 + SynergyChip + BottomSheet) | **신규** |
| `src/app/simulator/layout/SimulatorLayoutTablet.tsx` | 태블릿 레이아웃 (2-column + tabbed side) | **신규** |
| `src/components/builder/SynergyChip.tsx` | 모바일 시너지 chip — activeTraits 요약 표시 | **신규** |
| `src/app/simulator/page.tsx` | 훅 호출 + 핸드오프 + modals + 레이아웃 분기 (약 200줄) | **수정** |

범위 밖:
- `SynergyPanel.tsx`, `PiltoverModulePanel.tsx`, `SelectedUnitPanel.tsx` — 수정 없음 (컨테이너만 바뀜)
- 시뮬레이션 엔진 (`src/lib/simulator/`) — 전혀 변경 없음
- 분석 페이지 핸드오프 (`sessionStorage 'analysis_handoff'`) — 위치 유지
- 골든 테스트 (`tests/golden/`) — 영향 없음

---

## Phase 1: Foundation — 독립 유틸 컴포넌트

### Task 1.1: `widthToViewport` pure 헬퍼 + 실패 테스트

**Files:**
- Create: `tests/unit/useViewport.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/unit/useViewport.test.ts
import { describe, it, expect } from 'vitest';
import { widthToViewport, VIEWPORT_MOBILE_MAX, VIEWPORT_TABLET_MAX } from '@/hooks/useViewport';

describe('widthToViewport', () => {
  it('<768: mobile', () => {
    expect(widthToViewport(0)).toBe('mobile');
    expect(widthToViewport(320)).toBe('mobile');
    expect(widthToViewport(767)).toBe('mobile');
  });

  it('768~1023: tablet', () => {
    expect(widthToViewport(768)).toBe('tablet');
    expect(widthToViewport(900)).toBe('tablet');
    expect(widthToViewport(1023)).toBe('tablet');
  });

  it('≥1024: desktop', () => {
    expect(widthToViewport(1024)).toBe('desktop');
    expect(widthToViewport(1920)).toBe('desktop');
  });

  it('breakpoint 상수 값 확인', () => {
    expect(VIEWPORT_MOBILE_MAX).toBe(767);
    expect(VIEWPORT_TABLET_MAX).toBe(1023);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run tests/unit/useViewport.test.ts`
Expected: `Cannot find module '@/hooks/useViewport'`

- [ ] **Step 3: `useViewport.ts` pure 헬퍼만 구현**

```typescript
// src/hooks/useViewport.ts
export type Viewport = 'mobile' | 'tablet' | 'desktop';

export const VIEWPORT_MOBILE_MAX = 767;   // < 768
export const VIEWPORT_TABLET_MAX = 1023;  // < 1024

export function widthToViewport(width: number): Viewport {
  if (width <= VIEWPORT_MOBILE_MAX) return 'mobile';
  if (width <= VIEWPORT_TABLET_MAX) return 'tablet';
  return 'desktop';
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/useViewport.test.ts`
Expected: 4 tests passed.

- [ ] **Step 5: lint/typecheck/build 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: 모두 성공.

- [ ] **Step 6: 커밋**

```bash
git add src/hooks/useViewport.ts tests/unit/useViewport.test.ts
git commit -m "feat(hooks): widthToViewport pure 헬퍼 + breakpoint 상수"
```

---

### Task 1.2: `useViewport` 훅 추가 (useSyncExternalStore)

**Files:**
- Modify: `src/hooks/useViewport.ts`

- [ ] **Step 1: 훅 구현 추가 (같은 파일)**

```typescript
// src/hooks/useViewport.ts (기존 내용 아래 추가)
import { useSyncExternalStore } from 'react';

/**
 * 현재 뷰포트 breakpoint 를 반환. SSR 에서는 'desktop' 기본.
 *
 * useSyncExternalStore 로 matchMedia 를 구독 — React Compiler 안전
 * (useEffect + setState 패턴 회피).
 */
export function useViewport(): Viewport {
  const subscribe = (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => onChange();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  };

  const getSnapshot = (): Viewport => {
    if (typeof window === 'undefined') return 'desktop';
    return widthToViewport(window.innerWidth);
  };

  const getServerSnapshot = (): Viewport => 'desktop';

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

- [ ] **Step 2: typecheck 통과 확인**

Run: `pnpm typecheck`
Expected: 에러 없음.

- [ ] **Step 3: 기존 테스트 영향 없음 확인**

Run: `pnpm vitest run tests/unit/useViewport.test.ts`
Expected: 4 tests passed (훅은 테스트 대상 아님 — 나중에 실사용으로 검증).

- [ ] **Step 4: 커밋**

```bash
git add src/hooks/useViewport.ts
git commit -m "feat(hooks): useViewport 훅 (useSyncExternalStore 기반)"
```

---

### Task 1.3: `BottomSheet` pure state machine + 실패 테스트

**Files:**
- Create: `tests/unit/bottomSheetLogic.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/unit/bottomSheetLogic.test.ts
import { describe, it, expect } from 'vitest';
import {
  snapStateFromDragY,
  computeSheetHeightPx,
  SHEET_PEEK_PX,
  SHEET_HALF_VH_RATIO,
  SHEET_FULL_VH_RATIO,
} from '@/components/ui/bottomSheetLogic';

describe('computeSheetHeightPx', () => {
  it('peek 은 항상 56px', () => {
    expect(computeSheetHeightPx('peek', 800)).toBe(SHEET_PEEK_PX);
    expect(computeSheetHeightPx('peek', 400)).toBe(SHEET_PEEK_PX);
  });

  it('half 은 vh * SHEET_HALF_VH_RATIO', () => {
    expect(computeSheetHeightPx('half', 1000)).toBe(Math.round(1000 * SHEET_HALF_VH_RATIO));
    expect(computeSheetHeightPx('half', 800)).toBe(Math.round(800 * SHEET_HALF_VH_RATIO));
  });

  it('full 은 vh * SHEET_FULL_VH_RATIO', () => {
    expect(computeSheetHeightPx('full', 1000)).toBe(Math.round(1000 * SHEET_FULL_VH_RATIO));
  });

  it('vh 가 작아도 peek 최소 높이 보장', () => {
    expect(computeSheetHeightPx('peek', 50)).toBe(SHEET_PEEK_PX);
  });
});

describe('snapStateFromDragY', () => {
  // currentY: 시트 상단의 viewport Y. 작을수록 위로 올라간 상태.
  const vh = 1000;

  it('아주 아래 (peek 영역): peek', () => {
    expect(snapStateFromDragY(vh - SHEET_PEEK_PX, vh)).toBe('peek');
    expect(snapStateFromDragY(vh - 100, vh)).toBe('peek');
  });

  it('중간 (half 영역): half', () => {
    const halfTop = vh - Math.round(vh * SHEET_HALF_VH_RATIO);
    expect(snapStateFromDragY(halfTop, vh)).toBe('half');
    expect(snapStateFromDragY(halfTop - 50, vh)).toBe('half');
  });

  it('위쪽 (full 영역): full', () => {
    const fullTop = vh - Math.round(vh * SHEET_FULL_VH_RATIO);
    expect(snapStateFromDragY(fullTop, vh)).toBe('full');
    expect(snapStateFromDragY(0, vh)).toBe('full');
  });

  it('경계 스냅은 중간 임계값 기준', () => {
    const halfTop = vh - Math.round(vh * SHEET_HALF_VH_RATIO);
    const peekTop = vh - SHEET_PEEK_PX;
    const mid = Math.round((halfTop + peekTop) / 2);
    // 중간보다 아래 → peek, 중간보다 위 → half
    expect(snapStateFromDragY(mid + 20, vh)).toBe('peek');
    expect(snapStateFromDragY(mid - 20, vh)).toBe('half');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run tests/unit/bottomSheetLogic.test.ts`
Expected: `Cannot find module '@/components/ui/bottomSheetLogic'`.

- [ ] **Step 3: pure state machine 구현**

```typescript
// src/components/ui/bottomSheetLogic.ts
export type BottomSheetState = 'peek' | 'half' | 'full';

export const SHEET_PEEK_PX = 56;
export const SHEET_HALF_VH_RATIO = 0.42;
export const SHEET_FULL_VH_RATIO = 0.86;

/** 현재 state + 뷰포트 높이로 시트의 실제 픽셀 높이 계산 */
export function computeSheetHeightPx(state: BottomSheetState, vh: number): number {
  if (state === 'peek') return SHEET_PEEK_PX;
  if (state === 'half') return Math.round(vh * SHEET_HALF_VH_RATIO);
  return Math.round(vh * SHEET_FULL_VH_RATIO);
}

/** 드래그 중 시트 상단 Y 좌표를 가장 가까운 state 로 스냅 */
export function snapStateFromDragY(dragY: number, vh: number): BottomSheetState {
  const peekTop = vh - SHEET_PEEK_PX;
  const halfTop = vh - Math.round(vh * SHEET_HALF_VH_RATIO);
  const fullTop = vh - Math.round(vh * SHEET_FULL_VH_RATIO);

  const peekHalfMid = (peekTop + halfTop) / 2;
  const halfFullMid = (halfTop + fullTop) / 2;

  if (dragY > peekHalfMid) return 'peek';
  if (dragY > halfFullMid) return 'half';
  return 'full';
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/bottomSheetLogic.test.ts`
Expected: 7 tests passed.

- [ ] **Step 5: 커밋**

```bash
git add src/components/ui/bottomSheetLogic.ts tests/unit/bottomSheetLogic.test.ts
git commit -m "feat(ui): BottomSheet pure state machine (snap/height)"
```

---

### Task 1.4: `BottomSheet` React 컴포넌트 구현

**Files:**
- Create: `src/components/ui/BottomSheet.tsx`

- [ ] **Step 1: 컴포넌트 구현**

```tsx
// src/components/ui/BottomSheet.tsx
'use client';

import { ReactNode, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BottomSheetState,
  computeSheetHeightPx,
  snapStateFromDragY,
  SHEET_PEEK_PX,
} from './bottomSheetLogic';

interface BottomSheetTab {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface BottomSheetProps {
  state: BottomSheetState;
  onStateChange: (s: BottomSheetState) => void;
  tabs: BottomSheetTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
}

/**
 * 3-state bottom drawer (peek / half / full).
 * 상단 핸들에서만 드래그 제스처 활성 — dnd-kit 과 간섭 없음.
 * CSS translateY 애니메이션 (60fps).
 */
export default function BottomSheet({
  state,
  onStateChange,
  tabs,
  activeTabId,
  onTabChange,
}: BottomSheetProps) {
  const [dragY, setDragY] = useState<number | null>(null);
  const startRef = useRef<{ clientY: number; baseHeight: number } | null>(null);

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const baseHeight = computeSheetHeightPx(state, vh);
  const height = dragY !== null ? Math.max(SHEET_PEEK_PX, vh - dragY) : baseHeight;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { clientY: e.clientY, baseHeight };
      setDragY(vh - baseHeight);
    },
    [baseHeight, vh],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const delta = e.clientY - startRef.current.clientY;
      const newHeight = startRef.current.baseHeight - delta;
      setDragY(vh - newHeight);
    },
    [vh],
  );

  const onPointerUp = useCallback(() => {
    if (dragY === null) return;
    const snapped = snapStateFromDragY(dragY, vh);
    setDragY(null);
    startRef.current = null;
    if (snapped !== state) onStateChange(snapped);
  }, [dragY, vh, state, onStateChange]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height,
        transition: dragY === null ? 'height 200ms ease-out' : 'none',
        zIndex: 2147483646,
      }}
      className="bg-[#0d1117] border-t border-gray-700 rounded-t-xl shadow-2xl flex flex-col"
    >
      {/* 드래그 핸들 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex-shrink-0 py-2 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto" />
      </div>

      {/* 탭 바 */}
      <div className="flex-shrink-0 flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTabId === tab.id
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200'
            } ${tab.disabled ? 'opacity-30' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-3">
        {tabs.find((t) => t.id === activeTabId)?.content ?? null}
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: lint/typecheck/build 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: 모두 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/components/ui/BottomSheet.tsx
git commit -m "feat(ui): BottomSheet 컴포넌트 — 3-state drawer with portal"
```

---

### Task 1.5: `OverflowMenu` 컴포넌트 구현

**Files:**
- Create: `src/components/ui/OverflowMenu.tsx`

- [ ] **Step 1: 컴포넌트 구현**

```tsx
// src/components/ui/OverflowMenu.tsx
'use client';

import { ReactNode, useState, useCallback, useRef, useEffect } from 'react';

interface OverflowMenuItem {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  children?: ReactNode; // Stage select 등 커스텀 컨트롤 슬롯
  ariaLabel?: string;
}

/**
 * ⋯ 드롭다운. 외부 클릭 시 자동 닫힘.
 * useEffect + setState 패턴이지만 open 상태는 이벤트 driven 이라 React Compiler 규칙과 무관.
 */
export default function OverflowMenu({ items, children, ariaLabel = 'more options' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1.5 bg-[#1f2937] text-gray-400 hover:text-gray-200 rounded-lg text-sm"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-[#1a1f2e] border border-gray-700 rounded-lg shadow-xl z-50">
          {children && <div className="p-2 border-b border-gray-800">{children}</div>}
          <div className="py-1">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick();
                  setOpen(false);
                }}
                disabled={item.disabled}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  item.active ? 'text-blue-400' : 'text-gray-300'
                } hover:bg-[#1f2937] ${item.disabled ? 'opacity-40' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: lint/typecheck/build 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: 모두 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/components/ui/OverflowMenu.tsx
git commit -m "feat(ui): OverflowMenu 드롭다운 (외부 클릭 닫힘)"
```

---

## Phase 2: Board cellSize prop 도입 (desktop 불변)

### Task 2.1: `createHexLayout` 팩토리 + 실패 테스트

**Files:**
- Create: `tests/unit/hexLayout.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// tests/unit/hexLayout.test.ts
import { describe, it, expect } from 'vitest';
import { createHexLayout } from '@/components/battle/HexBoard';

describe('createHexLayout', () => {
  it('hexR=44 (default): 기존 상수와 동일', () => {
    const layout = createHexLayout(44);
    expect(layout.HEX_R).toBe(44);
    expect(layout.HEX_W).toBeCloseTo(44 * Math.sqrt(3));
    expect(layout.HEX_H).toBe(88);
    expect(layout.PAD).toBe(5);
  });

  it('hexR=36 (mobile): 모든 치수가 비례', () => {
    const layout = createHexLayout(36);
    expect(layout.HEX_R).toBe(36);
    expect(layout.HEX_W).toBeCloseTo(36 * Math.sqrt(3));
    expect(layout.HEX_H).toBe(72);
  });

  it('hexCenter: row/col 에 따라 일관된 좌표', () => {
    const layout = createHexLayout(44);
    const c0 = layout.hexCenter(0, 0);
    const c1 = layout.hexCenter(0, 1);
    expect(c1.cx - c0.cx).toBeCloseTo(layout.HEX_W + layout.PAD);
    expect(c0.cy).toBeCloseTo(c1.cy);
  });

  it('hexCenter: 홀수 행은 가로 오프셋 적용', () => {
    const layout = createHexLayout(44);
    const even = layout.hexCenter(0, 0);
    const odd = layout.hexCenter(1, 0);
    expect(odd.cx - even.cx).toBeCloseTo(layout.HEX_W / 2);
  });

  it('hexPoints: 정확히 6개 좌표 쌍 반환', () => {
    const layout = createHexLayout(44);
    const pts = layout.hexPoints(100, 100, 44);
    expect(pts.split(' ').length).toBe(6);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run tests/unit/hexLayout.test.ts`
Expected: `createHexLayout is not exported` or `undefined`.

- [ ] **Step 3: `HexBoard.tsx` 에 `createHexLayout` 추가 (기존 export 유지)**

`src/components/battle/HexBoard.tsx` 의 상수 export 블록을 다음으로 교체:

```tsx
// src/components/battle/HexBoard.tsx
'use client';

import { PlacedChampion, HexCoord, axialToOffset, offsetToAxial, COST_COLORS } from '@/types';
import { getChampionImage } from '@/data/imageMap';
import { BOARD_COLS } from '@/lib/simulator/models/constants';

interface HexBoardProps {
  rows: number;
  cols?: number;
  placedChampions: PlacedChampion[];
  onCellClick: (pos: HexCoord) => void;
  selectedCell?: HexCoord | null;
  highlightColor?: string;
  cellSize?: number; // hexR — default 44
}

export const DEFAULT_HEX_R = 44;
const PAD = 5;

export interface HexLayout {
  HEX_R: number;
  HEX_W: number;
  HEX_H: number;
  PAD: number;
  hexPoints: (cx: number, cy: number, r: number) => string;
  hexCenter: (row: number, col: number) => { cx: number; cy: number };
}

export function createHexLayout(hexR: number = DEFAULT_HEX_R): HexLayout {
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
    const cy = row * (HEX_H * 0.75 + PAD) + hexR + 20;
    return { cx, cy };
  };

  return { HEX_R: hexR, HEX_W, HEX_H, PAD, hexPoints, hexCenter };
}

// 하위 호환: 기존 상수/함수 export 유지 (Phase 2 중 점진 전환)
const defaultLayout = createHexLayout(DEFAULT_HEX_R);
export const HEX_R = defaultLayout.HEX_R;
export const HEX_W = defaultLayout.HEX_W;
export const HEX_H = defaultLayout.HEX_H;
export { PAD };
export const hexPoints = defaultLayout.hexPoints;
export const hexCenter = defaultLayout.hexCenter;
```

그리고 기존 default export `HexBoard` 컴포넌트는 수정하지 않음 (Task 2.5 에서).

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/hexLayout.test.ts`
Expected: 5 tests passed.

- [ ] **Step 5: 기존 golden 테스트 영향 없음 확인**

Run: `pnpm test`
Expected: 모든 golden 및 기존 unit 테스트 통과.

- [ ] **Step 6: lint/typecheck/build 통과 + 커밋**

Run: `pnpm lint && pnpm typecheck && pnpm build`

```bash
git add src/components/battle/HexBoard.tsx tests/unit/hexLayout.test.ts
git commit -m "feat(battle): createHexLayout 팩토리 — cellSize 파라미터화 기반"
```

---

### Task 2.2: `SetupBoard` 에 `cellSize` prop 추가

**Files:**
- Modify: `src/components/battle/SetupBoard.tsx`

- [ ] **Step 1: props 인터페이스 확장**

`src/components/battle/SetupBoard.tsx` 의 상단 import 와 interface 를 다음으로 교체:

```tsx
import { PlacedChampion, HexCoord, HexBuff, axialToOffset, offsetToAxial, COST_COLORS, MF_MODE_CONFIG } from '@/types';
import { getChampionImage, getItemImage } from '@/data/imageMap';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { createHexLayout, DEFAULT_HEX_R } from './HexBoard';

interface SetupBoardProps {
  playerChampions: PlacedChampion[];
  enemyChampions: PlacedChampion[];
  onCellClick: (pos: HexCoord, team: 'player' | 'enemy') => void;
  onUnitClick: (team: 'player' | 'enemy', index: number) => void;
  onUnitRightClick?: (team: 'player' | 'enemy', index: number) => void;
  onUnitCycleStars?: (team: 'player' | 'enemy', index: number) => void;
  selectedCell?: HexCoord | null;
  selectedUnit?: { team: 'player' | 'enemy'; index: number } | null;
  playerHexBuffs?: HexBuff[];
  enemyHexBuffs?: HexBuff[];
  movingHexBuffApiName?: string | null;
  cellSize?: number;
}
```

- [ ] **Step 2: 컴포넌트 함수 진입부에서 layout 계산**

`export default function SetupBoard(...)` 의 시작 부분에:

```tsx
export default function SetupBoard({
  playerChampions, enemyChampions, onCellClick, onUnitClick, onUnitRightClick,
  onUnitCycleStars, selectedCell, selectedUnit, playerHexBuffs, enemyHexBuffs,
  movingHexBuffApiName, cellSize = DEFAULT_HEX_R,
}: SetupBoardProps) {
  const { HEX_R, HEX_W, HEX_H, PAD, hexCenter, hexPoints } = createHexLayout(cellSize);
  // ... 기존 로직 (HEX_R, HEX_W, HEX_H, PAD, hexCenter, hexPoints 는 로컬 변수로 치환됨)
```

그리고 파일 안 기존의 `import { hexPoints, hexCenter, HEX_R, HEX_W, HEX_H, PAD } from './HexBoard';` import 라인 제거.

**주의**: SetupBoard 내부에서 위 6개 심볼을 사용하는 모든 곳은 자동으로 로컬 스코프 변수를 참조하므로 추가 수정 불필요. `pnpm typecheck` 로 confirm.

- [ ] **Step 3: 데스크톱 수동 확인 — cellSize 미지정 시 픽셀 동일**

`pnpm dev` 실행, `localhost:3000/simulator` 열어 데스크톱 모드 (≥1024px) 보드 렌더 확인. 헥스 크기 · 간격이 변경 전과 픽셀 단위로 동일해야 함 (DEFAULT_HEX_R=44 가 기본값이므로 동일해야 정상).

- [ ] **Step 4: typecheck/lint/build 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: 모두 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/components/battle/SetupBoard.tsx
git commit -m "feat(battle): SetupBoard cellSize prop — default 44 (desktop 불변)"
```

---

### Task 2.3: `ReplayBoard` 에 `cellSize` prop 추가

**Files:**
- Modify: `src/components/battle/ReplayBoard.tsx`

- [ ] **Step 1: Task 2.2 와 동일 패턴 적용**

1. `HexBoard` 로부터의 상수 import 를 `createHexLayout, DEFAULT_HEX_R` import 로 교체
2. props 에 `cellSize?: number` 추가
3. 컴포넌트 body 첫 줄에서 `const { HEX_R, HEX_W, HEX_H, PAD, hexCenter, hexPoints } = createHexLayout(cellSize);`

- [ ] **Step 2: 데스크톱 리플레이 모드 수동 확인 — 픽셀 동일**

`pnpm dev` 실행 → 시뮬레이터에서 전투 실행 → 리플레이 모드 진입 → 보드 렌더 변화 없음 확인.

- [ ] **Step 3: lint/typecheck/build 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build`

- [ ] **Step 4: 커밋**

```bash
git add src/components/battle/ReplayBoard.tsx
git commit -m "feat(battle): ReplayBoard cellSize prop — default 44 (desktop 불변)"
```

---

### Task 2.4: `DroppableHexCell` 에 `cellSize` prop 추가

**Files:**
- Modify: `src/components/battle/DroppableHexCell.tsx`

- [ ] **Step 1: props 확장 + layout 사용**

`src/components/battle/DroppableHexCell.tsx` 전체 교체:

```tsx
'use client';

import { useDroppable, useDraggable } from '@dnd-kit/core';
import { createHexLayout, DEFAULT_HEX_R } from './HexBoard';
import { HexCoord, DragData } from '@/types';
import { MouseEvent } from 'react';

interface DroppableHexCellProps {
  id: string;
  row: number;
  col: number;
  placedUnit?: { team: 'player' | 'enemy'; position: HexCoord } | null;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  onMouseEnter?: (rect: DOMRect) => void;
  onMouseLeave?: () => void;
  cellSize?: number;
}

export default function DroppableHexCell({
  id, row, col, placedUnit, onClick, onDoubleClick, onContextMenu,
  onMouseEnter, onMouseLeave, cellSize = DEFAULT_HEX_R,
}: DroppableHexCellProps) {
  const { HEX_R, hexCenter } = createHexLayout(cellSize);
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id });
  const dragData: DragData | undefined = placedUnit
    ? { type: 'placed-unit', team: placedUnit.team, position: placedUnit.position }
    : undefined;
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-placed-${id}`,
    data: dragData,
    disabled: !placedUnit,
  });
  const { cx, cy } = hexCenter(row, col);
  const size = HEX_R * 2;

  return (
    <div
      ref={(node) => {
        setDropRef(node);
        setDragRef(node);
      }}
      {...(placedUnit ? listeners : {})}
      {...(placedUnit ? attributes : {})}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter ? (e) => onMouseEnter(e.currentTarget.getBoundingClientRect()) : undefined}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        pointerEvents: 'all',
        border: isOver ? '2px solid #fbbf24' : 'none',
        backgroundColor: isOver ? 'rgba(251,191,36,0.15)' : 'transparent',
        opacity: isDragging ? 0.3 : 1,
        transition: 'border-color 0.15s, background-color 0.15s',
        touchAction: 'none',
        cursor: placedUnit ? 'grab' : 'default',
      }}
    />
  );
}
```

- [ ] **Step 2: lint/typecheck/build 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build`

- [ ] **Step 3: 커밋**

```bash
git add src/components/battle/DroppableHexCell.tsx
git commit -m "feat(battle): DroppableHexCell cellSize prop"
```

---

### Task 2.5: `page.tsx` 에서 `transform: scale()` 제거 (desktop 경로만)

**Files:**
- Modify: `src/app/simulator/page.tsx`

- [ ] **Step 1: Setup mode 보드 wrapper 의 scale 제거**

`src/app/simulator/page.tsx` 에서 기존:

```tsx
<div className="h-[320px] sm:h-[420px] lg:h-auto overflow-hidden flex justify-center">
  <div className="transform scale-[0.5] sm:scale-[0.65] lg:scale-100 origin-top" style={{ position: 'relative', display: 'inline-block' }}>
    <SetupBoard ... />
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      ...
```

를 다음으로 교체 (transform/scale/fixed height 제거 — 일단 데스크톱 고정 동작 유지):

```tsx
<div className="overflow-auto flex justify-center">
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <SetupBoard
      playerChampions={tm.playerTeam}
      enemyChampions={tm.enemyTeam}
      onCellClick={tm.handleCellClick}
      onUnitClick={tm.handleUnitClick}
      onUnitRightClick={tm.handleRemoveUnit}
      onUnitCycleStars={tm.handleCycleStars}
      selectedCell={tm.selectedCell}
      selectedUnit={tm.selectedUnit}
      playerHexBuffs={playerHexBuffs}
      enemyHexBuffs={enemyHexBuffs}
      movingHexBuffApiName={movingHexBuff?.apiName}
    />
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      ...
```

동일하게 Replay mode 의:

```tsx
<div className="h-[310px] sm:h-[420px] lg:h-auto overflow-hidden">
  <div className="transform scale-[0.48] sm:scale-[0.65] lg:scale-100 origin-top">
    <ReplayBoard ... />
  </div>
</div>
```

를 다음으로 교체:

```tsx
<div className="overflow-auto">
  <ReplayBoard
    snapshot={replay.currentSnapshot}
    unitMeta={replay.unitMeta}
    selectedUnitId={replay.selectedUnitId}
    onUnitClick={replay.setSelectedUnitId}
  />
</div>
```

- [ ] **Step 2: 데스크톱 수동 확인 — 변화 없음**

`pnpm dev` 후 데스크톱 (≥1024px) setup + replay 양쪽 렌더 확인. 보드 크기/위치가 Task 2.2 이전과 동일해야 함.

- [ ] **Step 3: 모바일 (≤768px) 확인 — 임시로 보드 넘칠 수 있음 (예상됨)**

이 Task 에서는 모바일/태블릿에서 보드가 가로로 넘쳐 `overflow-auto` 로 가로 스크롤될 수 있음. 이는 Phase 4/5 에서 레이아웃과 함께 해결되므로 정상.

- [ ] **Step 4: lint/typecheck/build 통과 + 골든 테스트 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:golden`
Expected: 모두 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/app/simulator/page.tsx
git commit -m "refactor(simulator): transform:scale() 제거 — cellSize 기반으로 전환"
```

---

## Phase 3: Desktop 레이아웃 추출 (behavior 불변)

### Task 3.1: 공유 Props 타입 정의

**Files:**
- Create: `src/app/simulator/layout/types.ts`

- [ ] **Step 1: 타입 파일 작성**

```typescript
// src/app/simulator/layout/types.ts
import { Dispatch, SetStateAction } from 'react';
import { PlacedChampion, HexCoord, HexBuff, RawChampion, RawItem, RawTrait, RawAugment } from '@/types';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useReplayControls } from '@/hooks/useReplayControls';
import { useDndHandlers } from '@/hooks/useDndHandlers';

export type ItemFilterTab = 'all' | 'component' | 'combined' | 'artifact' | 'emblem' | 'radiant';
export type PoolTab = 'champions' | 'items' | 'bilgewater';

export interface HexBuffState {
  player: HexBuff[];
  enemy: HexBuff[];
  overrides: Record<string, Record<string, HexCoord>>;
  setOverrides: Dispatch<SetStateAction<Record<string, Record<string, HexCoord>>>>;
  moving: { team: 'player' | 'enemy'; apiName: string } | null;
  setMoving: Dispatch<SetStateAction<{ team: 'player' | 'enemy'; apiName: string } | null>>;
}

export interface PoolFiltersState {
  champSearch: string; setChampSearch: Dispatch<SetStateAction<string>>;
  champCostFilter: number | null; setChampCostFilter: Dispatch<SetStateAction<number | null>>;
  itemSearch: string; setItemSearch: Dispatch<SetStateAction<string>>;
  itemCategoryFilter: ItemFilterTab; setItemCategoryFilter: Dispatch<SetStateAction<ItemFilterTab>>;
  activePoolTab: PoolTab; setActivePoolTab: Dispatch<SetStateAction<PoolTab>>;
}

export interface SimulatorLayoutProps {
  tm: ReturnType<typeof useTeamManagement>;
  replay: ReturnType<typeof useReplayControls>;
  dnd: ReturnType<typeof useDndHandlers>;
  data: {
    champions: RawChampion[];
    items: RawItem[];
    traits: RawTrait[];
    augments: RawAugment[];
    teamPlannerMapping: Array<{ hex: string; apiName: string }>;
  };
  hexBuffs: HexBuffState;
  stageNumber: number;
  setStageNumber: Dispatch<SetStateAction<number>>;
  isRunning: boolean;
  runSimulation: () => void;
  runMultiple: () => void;
  teamNames: { player: string | null; enemy: string | null };
  poolFilters: PoolFiltersState;
  logFilter: import('@/types').CombatLog['type'] | 'all';
  setLogFilter: Dispatch<SetStateAction<import('@/types').CombatLog['type'] | 'all'>>;
  showTeamCode: boolean;
  setShowTeamCode: Dispatch<SetStateAction<boolean>>;
  hoverUnit: { placed: PlacedChampion; rect: DOMRect } | null;
  setHoverUnit: Dispatch<SetStateAction<{ placed: PlacedChampion; rect: DOMRect } | null>>;
  returnTo: { matchId: string; puuid: string } | null;
  onBackToAnalysis: () => void;
  /** 8-row 좌표로 매핑한 player 팀 (리플레이 verifyContext 용) */
  mappedPlayerForReplay: PlacedChampion[];
}
```

**주의**: `teamPlannerMapping` 은 실제 `useGameData` 의 반환 형태를 따라야 함. 위 타입은 예시이므로 `pnpm typecheck` 에서 `useGameData` 반환 타입과 호환되는지 확인 필수. 불일치 시 `ReturnType<typeof useGameData>['teamPlannerMapping']` 으로 교체.

- [ ] **Step 2: typecheck 통과**

Run: `pnpm typecheck`
Expected: 에러 없음. 오류 시 `teamPlannerMapping` / `CombatLog` 타입을 실제 정의에 맞게 조정.

- [ ] **Step 3: 커밋**

```bash
git add src/app/simulator/layout/types.ts
git commit -m "feat(simulator): SimulatorLayoutProps 공유 타입 정의"
```

---

### Task 3.2: `SimulatorLayoutDesktop` 신규 — 기존 로직 이관

**Files:**
- Create: `src/app/simulator/layout/SimulatorLayoutDesktop.tsx`
- Modify: `src/app/simulator/page.tsx`

- [ ] **Step 1: `SimulatorLayoutDesktop.tsx` 스켈레톤**

```tsx
// src/app/simulator/layout/SimulatorLayoutDesktop.tsx
'use client';

import { SimulatorLayoutProps } from './types';
// ... 기존 page.tsx 에서 쓰던 모든 import 를 여기로 이관

/**
 * 데스크톱 전용 레이아웃 (≥1024px).
 * 기존 page.tsx 의 3-column Setup/Replay 렌더를 그대로 이관 — behavior 불변.
 */
export default function SimulatorLayoutDesktop(props: SimulatorLayoutProps) {
  // 기존 page.tsx 의 JSX 를 이 함수 body 로 이동.
  // props 에서 받은 값으로 기존 로컬 변수 참조를 교체:
  //   - tm.* 는 그대로
  //   - replay.* 는 그대로
  //   - champions, items, traits, augments → data.*
  //   - playerHexBuffs, enemyHexBuffs → hexBuffs.player, hexBuffs.enemy
  //   - hexBuffOverrides, setHexBuffOverrides → hexBuffs.overrides, hexBuffs.setOverrides
  //   - movingHexBuff, setMovingHexBuff → hexBuffs.moving, hexBuffs.setMoving
  //   - champSearch 등 → poolFilters.*
  //   - filteredLogs 는 props 에서 받는 대신 여기서 재계산 또는 props 확장
  return (
    <>
      {/* 기존 page.tsx 의 header + setup mode + replay mode + last result summary JSX */}
    </>
  );
}
```

- [ ] **Step 2: 실제 JSX 이관 (단계별)**

`src/app/simulator/page.tsx` 의 `return (<DndContext ...>{ ... }</DndContext>)` 부분 중 **다음 영역만** `SimulatorLayoutDesktop` 으로 이관:

**이관 대상:**
- Header (line ~322-388): 제목, 모드 탭, 액션 버튼들
- TeamCodePanel (line ~390-403)
- Setup mode 전체 JSX (line ~406-772)
- Replay mode 전체 JSX (line ~774-946)
- Setup mode 의 last result summary (line ~948-972)

**이관 제외 (page.tsx 에 남김):**
- `DndContext` 래퍼 자체
- 분석 복귀 버튼 (line ~314-321) — SimulatorLayoutProps.onBackToAnalysis 를 통해 props 로 전달
- 모든 Modal (ChampionGrid, AugmentSelector, AugmentDetailPopup, MfModeSelector — line ~974-1011)
- DragOverlay (line ~1013-1036)
- Footer (line ~1040-1043)

이관 후 `<SimulatorLayoutDesktop {...layoutProps} />` 한 줄로 호출.

- [ ] **Step 3: `page.tsx` 를 thin wrapper 로 재구성**

`src/app/simulator/page.tsx` 의 `SimulatorContent()` 함수를 다음 구조로 재작성:

```tsx
function SimulatorContent() {
  const activeSet = useActiveSet();
  const router = useRouter();
  const { champions, items, traits, augments, teamPlannerMapping, loading } = useGameData(activeSet);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const tm = useTeamManagement({ traits });
  const replay = useReplayControls();
  const [returnTo, setReturnTo] = useState<{ matchId: string; puuid: string } | null>(null);
  const [teamNames, setTeamNames] = useState<{ player: string | null; enemy: string | null }>({ player: null, enemy: null });
  const [hexBuffOverrides, setHexBuffOverrides] = useState<Record<string, Record<string, HexCoord>>>({ player: {}, enemy: {} });
  const [movingHexBuff, setMovingHexBuff] = useState<{ team: 'player' | 'enemy'; apiName: string } | null>(null);
  const [champSearch, setChampSearch] = useState('');
  const [champCostFilter, setChampCostFilter] = useState<number | null>(null);
  const [activePoolTab, setActivePoolTab] = useState<'champions' | 'items' | 'bilgewater'>('champions');
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState<ItemFilterTab>('all');  // ItemFilterTab 은 './layout/types' 에서 import
  const [showTeamCode, setShowTeamCode] = useState(false);
  const [logFilter, setLogFilter] = useState<CombatLog['type'] | 'all'>('all');
  const [isRunning, setIsRunning] = useState(false);
  const [stageNumber, setStageNumber] = useState(4);
  const [hoverUnit, setHoverUnit] = useState<{ placed: PlacedChampion; rect: DOMRect } | null>(null);

  // 분석 핸드오프 useEffect (그대로 유지)
  useEffect(() => { /* 기존 로직 */ }, [champions, items, teamPlannerMapping]);

  const dnd = useDndHandlers({ /* 기존 props */ });

  const playerHexBuffs = useMemo(() => resolveHexBuffs(tm.playerAugments.map(a => a.apiName), tm.playerTeam, hexBuffOverrides.player), [tm.playerAugments, tm.playerTeam, hexBuffOverrides.player]);
  const enemyHexBuffs = useMemo(() => resolveHexBuffs(tm.enemyAugments.map(a => a.apiName), tm.enemyTeam, hexBuffOverrides.enemy), [tm.enemyAugments, tm.enemyTeam, hexBuffOverrides.enemy]);

  const toEightRowCoords = useCallback(/* 기존 로직 */, []);
  const mappedPlayerForReplay = useMemo(() => toEightRowCoords(tm.playerTeam, 4), [tm.playerTeam, toEightRowCoords]);

  const runSimulation = useCallback(/* 기존 로직 */, [/* deps */]);
  const runMultiple = useCallback(/* 기존 로직 */, [/* deps */]);

  if (loading) return <div className="flex items-center justify-center h-[60vh] text-gray-500">데이터 로딩 중...</div>;

  const layoutProps: SimulatorLayoutProps = {
    tm, replay, dnd,
    data: { champions, items, traits, augments, teamPlannerMapping },
    hexBuffs: {
      player: playerHexBuffs, enemy: enemyHexBuffs,
      overrides: hexBuffOverrides, setOverrides: setHexBuffOverrides,
      moving: movingHexBuff, setMoving: setMovingHexBuff,
    },
    stageNumber, setStageNumber, isRunning, runSimulation, runMultiple,
    teamNames,
    poolFilters: {
      champSearch, setChampSearch, champCostFilter, setChampCostFilter,
      itemSearch, setItemSearch, itemCategoryFilter, setItemCategoryFilter,
      activePoolTab, setActivePoolTab,
    },
    logFilter, setLogFilter, showTeamCode, setShowTeamCode,
    hoverUnit, setHoverUnit,
    returnTo,
    onBackToAnalysis: () => returnTo && router.push(`/lookup/${encodeURIComponent(returnTo.matchId)}/analysis?puuid=${encodeURIComponent(returnTo.puuid)}`),
    mappedPlayerForReplay,
  };

  return (
    <DndContext sensors={sensors} onDragStart={dnd.handleDragStart} onDragEnd={dnd.handleDragEnd}>
      <div className="space-y-4">
        {returnTo && (
          <button onClick={layoutProps.onBackToAnalysis} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← 매치 분석으로 돌아가기
          </button>
        )}
        <SimulatorLayoutDesktop {...layoutProps} />
      </div>

      {/* Modals */}
      <MfModeSelector /* ... */ />
      <Modal isOpen={tm.showPicker} onClose={() => tm.setShowPicker(false)} title="챔피언 선택">
        <ChampionGrid champions={champions} onSelect={tm.handleChampionSelect} />
      </Modal>
      <Modal isOpen={tm.showAugmentPicker !== null} onClose={() => tm.setShowAugmentPicker(null)} title="증강 선택">
        {/* ... */}
      </Modal>
      <AugmentDetailPopup /* ... */ />

      {/* DragOverlay */}
      <DragOverlay>{/* 기존 로직 */}</DragOverlay>

      <footer className="mt-8 py-4 border-t border-gray-800 text-center text-xs text-gray-600">
        <p>TFT Combat Simulator &mdash; Set 17: Space Gods</p>
        <p className="mt-1">Data from CommunityDragon &middot; Not affiliated with Riot Games</p>
      </footer>
    </DndContext>
  );
}
```

- [ ] **Step 4: 데스크톱 수동 QA — behavior 불변**

`pnpm dev` 실행, ≥1024px 화면에서:
- 챔피언 드래그 → 보드 배치
- 아이템 장착
- 증강 추가
- 전투 시작
- 리플레이 재생
- 시너지 확인
- 분석 페이지에서 팀 핸드오프로 진입 → "매치 분석으로 돌아가기" 동작

모든 동작이 Task 3.2 이전과 동일해야 함.

- [ ] **Step 5: lint/typecheck/build/golden 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:golden`

- [ ] **Step 6: 커밋**

```bash
git add src/app/simulator/page.tsx src/app/simulator/layout/SimulatorLayoutDesktop.tsx
git commit -m "refactor(simulator): SimulatorLayoutDesktop 추출 — page.tsx thin router"
```

---

## Phase 4: 모바일 레이아웃 (< 768px)

### Task 4.1: `SynergyChip` 컴포넌트

**Files:**
- Create: `src/components/builder/SynergyChip.tsx`

- [ ] **Step 1: 컴포넌트 구현**

```tsx
// src/components/builder/SynergyChip.tsx
'use client';

import { ActiveTrait } from '@/types';
import { getTraitImage } from '@/data/imageMap';

interface SynergyChipProps {
  team: 'player' | 'enemy';
  teamLabel: string;
  activeTraits: ActiveTrait[];
  onExpand: () => void;
}

/**
 * 모바일 전용 시너지 요약 chip.
 * 활성화된 시너지 아이콘 + 발동 수를 가로로 나열.
 * 탭하면 onExpand() — BottomSheet 의 시너지 탭으로 확장.
 */
export default function SynergyChip({ team, teamLabel, activeTraits, onExpand }: SynergyChipProps) {
  const accentColor = team === 'player' ? 'text-blue-400 border-blue-600/40' : 'text-red-400 border-red-600/40';
  const active = activeTraits.filter(t => t.style > 0);

  return (
    <button
      onClick={onExpand}
      className={`flex-1 min-w-0 flex items-center gap-1 px-2 py-1.5 bg-[#111827] border rounded-lg text-left ${accentColor}`}
    >
      <span className="text-[9px] font-bold truncate max-w-[60px]">{teamLabel}</span>
      <div className="flex items-center gap-0.5 overflow-hidden flex-1">
        {active.length === 0 && <span className="text-[9px] text-gray-600">시너지 없음</span>}
        {active.slice(0, 6).map(t => (
          <div key={t.trait.apiName} className="flex items-center shrink-0">
            <img src={getTraitImage(t.trait.apiName)} alt="" className="w-4 h-4" />
            <span className="text-[9px] ml-0.5">{t.count}</span>
          </div>
        ))}
        {active.length > 6 && <span className="text-[9px] text-gray-500 ml-0.5">+{active.length - 6}</span>}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: `getTraitImage` 가 존재하는지 확인**

Run: `rtk grep -r "export.*getTraitImage" /Users/kim/cursorProjects/tft_sim/src/data/`
Expected: `imageMap.ts` 에서 export.

없으면 존재하는 함수로 교체 — `getChampionImage` 옆에 비슷한 함수가 있을 것. 없으면 추론 가능한 직접 경로 (`/data/traits/{apiName}.png` 등) 로 임시 대체하되 TODO 금지 → grep 으로 기존 패턴 확인 후 진행.

- [ ] **Step 3: lint/typecheck/build 통과**

- [ ] **Step 4: 커밋**

```bash
git add src/components/builder/SynergyChip.tsx
git commit -m "feat(builder): SynergyChip — 모바일 시너지 요약 chip"
```

---

### Task 4.2: `SimulatorLayoutMobile` 스켈레톤 (Setup mode)

**Files:**
- Create: `src/app/simulator/layout/SimulatorLayoutMobile.tsx`

- [ ] **Step 1: 모바일 레이아웃 스켈레톤**

```tsx
// src/app/simulator/layout/SimulatorLayoutMobile.tsx
'use client';

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { axialToOffset, offsetToAxial } from '@/types';
import { resolveDescription } from '@/lib/utils/text';
import { SimulatorLayoutProps } from './types';
import SetupBoard from '@/components/battle/SetupBoard';
import ReplayBoard from '@/components/battle/ReplayBoard';
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import BattleControls from '@/components/battle/BattleControls';
import AugmentSlots from '@/components/builder/AugmentSlots';
import SynergyChip from '@/components/builder/SynergyChip';
import SelectedUnitPanel from '@/components/builder/SelectedUnitPanel';
import SynergyPanel from '@/components/builder/SynergyPanel';
import PiltoverModulePanel from '@/components/builder/PiltoverModulePanel';
import UnitDetailPanel from '@/components/battle/UnitDetailPanel';
import DamageSidebar from '@/components/battle/DamageSidebar';
import BottomSheet from '@/components/ui/BottomSheet';
import OverflowMenu from '@/components/ui/OverflowMenu';
import { BottomSheetState } from '@/components/ui/bottomSheetLogic';
import ChampionPoolContent from './pool/ChampionPoolContent'; // 뒤에 Task 에서 생성
import ItemPoolContent from './pool/ItemPoolContent';
import BilgewaterPoolContent from './pool/BilgewaterPoolContent';

const MOBILE_CELL_SIZE = 36;

type MobileTabId = 'pool' | 'unit' | 'synergy' | 'log' | 'damage';

export default function SimulatorLayoutMobile(props: SimulatorLayoutProps) {
  const { tm, replay, hexBuffs, poolFilters, teamNames, stageNumber, setStageNumber,
    isRunning, runSimulation, runMultiple, setShowTeamCode, showTeamCode } = props;

  const [sheetState, setSheetState] = useState<BottomSheetState>('peek');
  const [activeTabId, setActiveTabId] = useState<MobileTabId>(
    replay.viewMode === 'replay' ? 'log' : 'pool',
  );

  const playerLabel = teamNames.player ?? 'TEAM A';
  const enemyLabel = teamNames.enemy ?? 'TEAM B';

  // Cell click wrapper — bottom sheet 자동 확장 포함
  const onUnitClickWithSheet = useCallback(
    (team: 'player' | 'enemy', index: number) => {
      tm.handleUnitClick(team, index);
      setActiveTabId('unit');
      setSheetState('half');
    },
    [tm],
  );

  const tabs = replay.viewMode === 'setup'
    ? [
        { id: 'pool', label: '풀', content: <PoolContentRouter {...props} /> },
        { id: 'unit', label: '유닛', content: tm.selectedUnit && tm.selectedPlaced ? (
          <SelectedUnitPanel
            placed={tm.selectedPlaced}
            team={tm.selectedUnit.team}
            allItems={props.data.items}
            activeTraits={tm.selectedUnit.team === 'player' ? tm.playerTraits : tm.enemyTraits}
            onStarChange={(l) => tm.handleStarChange(tm.selectedUnit!.team, tm.selectedUnit!.index, l)}
            onEquipItem={(i) => tm.handleEquipItem(tm.selectedUnit!.team, tm.selectedUnit!.index, i)}
            onRemoveItem={(i) => tm.handleRemoveItem(tm.selectedUnit!.team, tm.selectedUnit!.index, i)}
            onRemoveVoidItem={() => tm.handleRemoveVoidItem(tm.selectedUnit!.team, tm.selectedUnit!.index)}
            onRemoveUnit={() => tm.handleRemoveUnit(tm.selectedUnit!.team, tm.selectedUnit!.index)}
            onMfModeChange={(m) => tm.handleMfModeChange(tm.selectedUnit!.team, tm.selectedUnit!.index, m)}
            onPermanentStackChange={(v) => tm.handlePermanentStackChange(tm.selectedUnit!.team, tm.selectedUnit!.index, v)}
          />
        ) : <div className="text-center text-xs text-gray-500 py-6">보드의 유닛을 선택하세요</div>, disabled: false },
        { id: 'synergy', label: '시너지', content: (
          <div className="space-y-3">
            <SynergyPanel activeTraits={tm.enemyTraits} team="enemy" items={props.data.items} champions={props.data.champions} piltoverModules={tm.enemyPiltoverModules} bilgewaterStats={tm.enemyBilgewaterStats} ioniaPath={tm.enemyIoniaPath} onIoniaPathChange={tm.setEnemyIoniaPath} arbiterLaw={tm.enemyArbiterLaw} onArbiterLawChange={tm.setEnemyArbiterLaw} />
            <PiltoverModulePanel modules={tm.enemyPiltoverModules} allItems={props.data.items} activeTraits={tm.enemyTraits} onAddModule={(i) => tm.handleAddPiltoverModule('enemy', i)} onRemoveModule={(i) => tm.handleRemovePiltoverModule('enemy', i)} />
            <SynergyPanel activeTraits={tm.playerTraits} team="player" items={props.data.items} champions={props.data.champions} piltoverModules={tm.playerPiltoverModules} bilgewaterStats={tm.playerBilgewaterStats} ioniaPath={tm.playerIoniaPath} onIoniaPathChange={tm.setPlayerIoniaPath} arbiterLaw={tm.playerArbiterLaw} onArbiterLawChange={tm.setPlayerArbiterLaw} />
            <PiltoverModulePanel modules={tm.playerPiltoverModules} allItems={props.data.items} activeTraits={tm.playerTraits} onAddModule={(i) => tm.handleAddPiltoverModule('player', i)} onRemoveModule={(i) => tm.handleRemovePiltoverModule('player', i)} />
          </div>
        )},
      ]
    : [
        { id: 'log', label: '로그', content: <ReplayLogTab {...props} /> },
        { id: 'damage', label: '데미지', content: <DamageSidebar combatResult={replay.combatResult} currentSnapshot={replay.currentSnapshot} selectedUnitId={replay.selectedUnitId} onUnitClick={replay.setSelectedUnitId} /> },
        { id: 'unit', label: '유닛',
          disabled: !replay.selectedUnitId,
          content: /* ReplayUnitDetailTab 헬퍼 — 뒤 Task 에서 */ <ReplayUnitDetailTab {...props} />,
        },
      ];

  return (
    <div className="space-y-2">
      {/* Header */}
      <MobileHeader
        title="전투 시뮬레이션"
        primaryLabel={isRunning ? '전투 중...' : '▶ 시작'}
        onPrimary={runSimulation}
        primaryDisabled={isRunning || tm.playerTeam.length === 0 || tm.enemyTeam.length === 0}
        overflowItems={[
          { label: '초기화', onClick: tm.resetAll },
          { label: showTeamCode ? '팀 코드 닫기' : '팀 코드 열기', onClick: () => setShowTeamCode(v => !v), active: showTeamCode },
          { label: '100회 시뮬', onClick: runMultiple, disabled: isRunning || tm.playerTeam.length === 0 || tm.enemyTeam.length === 0 },
          { label: replay.viewMode === 'setup' ? '리플레이 보기' : '편집으로', onClick: () => replay.setViewMode(replay.viewMode === 'setup' ? 'replay' : 'setup'), disabled: !replay.combatResult },
        ]}
        stageNumber={stageNumber}
        setStageNumber={setStageNumber}
      />

      {/* Board (scaled via cellSize, no transform) */}
      <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-2 overflow-x-auto">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {replay.viewMode === 'setup' && (
            <>
              <SetupBoard
                playerChampions={tm.playerTeam}
                enemyChampions={tm.enemyTeam}
                onCellClick={tm.handleCellClick}
                onUnitClick={onUnitClickWithSheet}
                onUnitRightClick={tm.handleRemoveUnit}
                onUnitCycleStars={tm.handleCycleStars}
                selectedCell={tm.selectedCell}
                selectedUnit={tm.selectedUnit}
                playerHexBuffs={hexBuffs.player}
                enemyHexBuffs={hexBuffs.enemy}
                movingHexBuffApiName={hexBuffs.moving?.apiName}
                cellSize={MOBILE_CELL_SIZE}
              />
              <MobileDroppableOverlay {...props} cellSize={MOBILE_CELL_SIZE} onUnitClick={onUnitClickWithSheet} />
            </>
          )}
          {replay.viewMode === 'replay' && replay.combatResult && (
            <ReplayBoard
              snapshot={replay.currentSnapshot}
              unitMeta={replay.unitMeta}
              selectedUnitId={replay.selectedUnitId}
              onUnitClick={(id) => {
                replay.setSelectedUnitId(id);
                if (id) { setActiveTabId('unit'); setSheetState('half'); }
              }}
              cellSize={MOBILE_CELL_SIZE}
            />
          )}
        </div>
      </div>

      {/* Synergy chips (setup mode only) */}
      {replay.viewMode === 'setup' && (
        <div className="flex gap-2">
          <SynergyChip team="enemy" teamLabel={enemyLabel} activeTraits={tm.enemyTraits}
            onExpand={() => { setActiveTabId('synergy'); setSheetState('full'); }} />
          <SynergyChip team="player" teamLabel={playerLabel} activeTraits={tm.playerTraits}
            onExpand={() => { setActiveTabId('synergy'); setSheetState('full'); }} />
        </div>
      )}

      {/* Augment slots (compact) */}
      <MobileAugmentRow {...props} />

      {/* Battle controls (replay mode only) */}
      {replay.viewMode === 'replay' && replay.combatResult && (
        <BattleControls
          currentTick={replay.replayTick}
          totalTicks={replay.combatResult.snapshots.length}
          playbackSpeed={replay.playbackSpeed}
          isPlaying={replay.isPlaying}
          onPlay={() => replay.setIsPlaying(true)}
          onPause={() => replay.setIsPlaying(false)}
          onStepForward={() => replay.setReplayTick(prev => Math.min(prev + 1, replay.combatResult!.snapshots.length - 1))}
          onStepBack={() => replay.setReplayTick(prev => Math.max(prev - 1, 0))}
          onSeek={replay.setReplayTick}
          onSpeedChange={replay.setPlaybackSpeed}
          ticksPerSecond={/* TICKS_PER_SECOND */ 30}
        />
      )}

      {/* Bottom sheet — 항상 렌더 (peek 상태라도 탭바 노출) */}
      <BottomSheet
        state={sheetState}
        onStateChange={setSheetState}
        tabs={tabs.map(t => ({ ...t, content: t.content as React.ReactNode, disabled: ('disabled' in t ? t.disabled : false) }))}
        activeTabId={activeTabId}
        onTabChange={(id) => setActiveTabId(id as MobileTabId)}
      />
    </div>
  );
}

// 아래 헬퍼 컴포넌트는 같은 파일 내 또는 별도 파일로 추출:
function MobileHeader(/* ... */) { /* Task 4.3 에서 구현 */ }
function MobileAugmentRow(/* ... */) { /* Task 4.4 에서 구현 */ }
function MobileDroppableOverlay(/* ... */) { /* Task 4.4 에서 구현 */ }
function PoolContentRouter(/* ... */) { /* Task 4.4 에서 구현 */ }
function ReplayLogTab(/* ... */) { /* Task 4.5 에서 구현 */ }
function ReplayUnitDetailTab(/* ... */) { /* Task 4.5 에서 구현 */ }
```

**주의**: 이 Step 은 스켈레톤 — 하위 헬퍼 컴포넌트는 다음 Task 에서 구현. typecheck 가 통과하려면 placeholder 로 최소한 반환값만 두는 방식이 필요.

- [ ] **Step 2: placeholder 헬퍼 구현 (임시 — Task 4.3/4.4/4.5 에서 교체)**

위 파일 하단에 임시 구현:

```tsx
function MobileHeader(props: any) {
  return <div className="text-xs text-gray-400">Header placeholder</div>;
}
function MobileAugmentRow(props: any) { return null; }
function MobileDroppableOverlay(props: any) { return null; }
function PoolContentRouter(props: any) { return <div>Pool placeholder</div>; }
function ReplayLogTab(props: any) { return <div>Log placeholder</div>; }
function ReplayUnitDetailTab(props: any) { return <div>Unit placeholder</div>; }
```

단 `any` 는 ESLint 가 차단할 수 있음. 만약 차단 시 `React.ComponentProps<any>` 대신 각 placeholder 의 props 타입을 정확히 선언 (`SimulatorLayoutProps & { ... }`) 해야 함.

- [ ] **Step 3: typecheck/lint 통과**

Run: `pnpm lint && pnpm typecheck`
Expected: 모두 성공. 단 이 레이아웃은 아직 page.tsx 에서 호출되지 않으므로 런타임 영향 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/app/simulator/layout/SimulatorLayoutMobile.tsx
git commit -m "feat(simulator): SimulatorLayoutMobile 스켈레톤 — bottom sheet 통합 준비"
```

---

### Task 4.3: 모바일 Header 서브컴포넌트

**Files:**
- Modify: `src/app/simulator/layout/SimulatorLayoutMobile.tsx`

- [ ] **Step 1: `MobileHeader` 실제 구현**

`SimulatorLayoutMobile.tsx` 하단의 `MobileHeader` placeholder 를 다음으로 교체:

```tsx
interface MobileHeaderProps {
  title: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled: boolean;
  overflowItems: { label: string; onClick: () => void; active?: boolean; disabled?: boolean }[];
  stageNumber: number;
  setStageNumber: (n: number) => void;
}

function MobileHeader({ title, primaryLabel, onPrimary, primaryDisabled, overflowItems, stageNumber, setStageNumber }: MobileHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-bold text-gray-200 flex-1 truncate">{title}</h2>
      <button
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-xs font-bold text-black transition-colors"
      >
        {primaryLabel}
      </button>
      <OverflowMenu items={overflowItems} ariaLabel="more simulator options">
        <div>
          <label className="text-[10px] text-gray-400 block mb-1">Stage</label>
          <select
            value={stageNumber}
            onChange={(e) => setStageNumber(Number(e.target.value))}
            className="w-full bg-[#1f2937] text-gray-300 text-xs rounded px-2 py-1 border border-gray-600"
          >
            {[1,2,3,4,5,6,7].map(s => (<option key={s} value={s}>Stage {s}</option>))}
          </select>
        </div>
      </OverflowMenu>
    </div>
  );
}
```

- [ ] **Step 2: typecheck/lint 통과**

- [ ] **Step 3: 커밋**

```bash
git add src/app/simulator/layout/SimulatorLayoutMobile.tsx
git commit -m "feat(simulator): MobileHeader — 제목 + 시작 + ⋯ 메뉴"
```

---

### Task 4.4: Setup mode 서브컴포넌트 (Overlay + Pool + Augments)

**Files:**
- Modify: `src/app/simulator/layout/SimulatorLayoutMobile.tsx`

- [ ] **Step 1: `MobileDroppableOverlay` 구현**

기존 `page.tsx` 의 droppable overlay 로직 (loop over 8 rows × BOARD_COLS) 을 그대로 복사하되 `cellSize={MOBILE_CELL_SIZE}` 를 `DroppableHexCell` 에 전달.

```tsx
interface MobileDroppableOverlayProps extends SimulatorLayoutProps {
  cellSize: number;
  onUnitClick: (team: 'player' | 'enemy', index: number) => void;
}

function MobileDroppableOverlay({ tm, hexBuffs, cellSize, onUnitClick, setHoverUnit }: MobileDroppableOverlayProps) {
  const { playerTeam, enemyTeam } = tm;
  const { player: playerHexBuffs, enemy: enemyHexBuffs, moving, setMoving, setOverrides } = hexBuffs;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: BOARD_COLS }, (_, col) => {
          const team = row < 4 ? 'enemy' : 'player';
          const teamArr = team === 'player' ? playerTeam : enemyTeam;
          const dataRow = team === 'player' ? row - 4 : row;
          const placedIdx = teamArr.findIndex(p => {
            const off = axialToOffset(p.position);
            return off.row === dataRow && off.col === col;
          });
          const placed = placedIdx >= 0 ? teamArr[placedIdx] : null;

          const cellClick = () => {
            if (moving) {
              const pos = offsetToAxial({ row: dataRow, col });
              setOverrides(prev => ({ ...prev, [moving.team]: { ...prev[moving.team], [moving.apiName]: pos } }));
              setMoving(null);
              return;
            }
            const buffs = team === 'player' ? playerHexBuffs : enemyHexBuffs;
            const movableBuff = buffs.find(b => b.movable && b.positions.some(p => {
              const off = axialToOffset(p); return off.row === dataRow && off.col === col;
            }));
            if (movableBuff && !placed) { setMoving({ team, apiName: movableBuff.augmentApiName }); return; }
            if (placed && placedIdx >= 0) onUnitClick(team, placedIdx);
            else tm.handleCellClick(offsetToAxial({ row: dataRow, col }), team);
          };

          const cellContextMenu = (e: React.MouseEvent) => {
            e.preventDefault();
            if (placed && placedIdx >= 0) tm.handleRemoveUnit(team, placedIdx);
          };

          return (
            <DroppableHexCell
              key={`cell-${row}-${col}`}
              id={`cell-${row}-${col}`}
              row={row}
              col={col}
              placedUnit={placed ? { team, position: placed.position } : null}
              onClick={cellClick}
              onContextMenu={cellContextMenu}
              onMouseEnter={placed ? (rect) => setHoverUnit({ placed, rect }) : undefined}
              onMouseLeave={() => setHoverUnit(null)}
              cellSize={cellSize}
            />
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 2: 풀 탭 컨텐츠 분리 — `pool/ChampionPoolContent.tsx` / `ItemPoolContent.tsx` / `BilgewaterPoolContent.tsx`**

기존 `page.tsx` 의 `activePoolTab === 'champions' | 'items' | 'bilgewater'` 블록 3개를 각각 별도 파일로 추출:

```tsx
// src/app/simulator/layout/pool/ChampionPoolContent.tsx
'use client';
import { useMemo } from 'react';
import { SimulatorLayoutProps } from '../types';
import SearchBar from '@/components/ui/SearchBar';
import DraggableChampionCard from '@/components/builder/DraggableChampionCard';

export default function ChampionPoolContent({ data, poolFilters }: SimulatorLayoutProps) {
  const { champSearch, setChampSearch, champCostFilter, setChampCostFilter } = poolFilters;

  const filteredChampions = useMemo(() => {
    let f = data.champions;
    if (champSearch) {
      const s = champSearch.toLowerCase();
      f = f.filter(c => c.name.toLowerCase().includes(s) || c.traits.some(t => t.toLowerCase().includes(s)));
    }
    if (champCostFilter) f = f.filter(c => c.cost === champCostFilter);
    return [...f].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [data.champions, champSearch, champCostFilter]);

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      <SearchBar value={champSearch} onChange={setChampSearch} placeholder="챔피언/특성 검색..." />
      <div className="flex gap-1">
        <button
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${champCostFilter === null ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
          onClick={() => setChampCostFilter(null)}
        >전체</button>
        {[1,2,3,4,5].map(cost => (
          <button
            key={cost}
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${champCostFilter === cost ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
            onClick={() => setChampCostFilter(champCostFilter === cost ? null : cost)}
          >{cost}</button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5 overflow-y-auto min-h-0 p-1">
        {filteredChampions.map(c => <DraggableChampionCard key={c.apiName} champion={c} size={40} />)}
      </div>
    </div>
  );
}
```

`ItemPoolContent.tsx`:

```tsx
// src/app/simulator/layout/pool/ItemPoolContent.tsx
'use client';
import { SimulatorLayoutProps, ItemFilterTab } from '../types';
import SearchBar from '@/components/ui/SearchBar';
import DraggableItemIcon from '@/components/builder/DraggableItemIcon';
import { getItemCategory, isDisabledItem } from '@/lib/simulator/systems/item';

export default function ItemPoolContent({ data, poolFilters, tm }: SimulatorLayoutProps) {
  const { itemSearch, setItemSearch, itemCategoryFilter, setItemCategoryFilter } = poolFilters;
  const filters: { key: ItemFilterTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'combined', label: '완성' },
    { key: 'artifact', label: '유물' },
    { key: 'radiant', label: '찬란' },
    { key: 'emblem', label: '상징' },
  ];

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      <SearchBar value={itemSearch} onChange={setItemSearch} placeholder="아이템 검색..." />
      <div className="flex gap-1 shrink-0">
        {filters.map(({ key, label }) => (
          <button key={key}
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${itemCategoryFilter === key ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
            onClick={() => setItemCategoryFilter(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 overflow-y-auto min-h-0 p-1">
        {data.items.filter(item => {
          if (isDisabledItem(item)) return false;
          const cat = getItemCategory(item);
          if (cat === 'piltover' || cat === 'special' || cat === 'bilgewater') return false;
          if (cat === 'void') {
            const voidTrait = tm.playerTraits.find(t => t.trait.apiName === 'TFT16_Void')
              ?? tm.enemyTraits.find(t => t.trait.apiName === 'TFT16_Void');
            if (!voidTrait || !voidTrait.activeEffect) return false;
          }
          if (itemSearch && !item.name.toLowerCase().includes(itemSearch.toLowerCase())) return false;
          if (itemCategoryFilter !== 'all') {
            if (cat === 'void' || cat === 'darkin') {
              if (itemCategoryFilter !== 'combined') return false;
            } else if (cat !== itemCategoryFilter) return false;
          }
          return true;
        }).map(item => <DraggableItemIcon key={item.apiName} item={item} size={32} />)}
      </div>
    </div>
  );
}
```

`BilgewaterPoolContent.tsx`:

```tsx
// src/app/simulator/layout/pool/BilgewaterPoolContent.tsx
'use client';
import { SimulatorLayoutProps } from '../types';
import DraggableItemIcon from '@/components/builder/DraggableItemIcon';
import ItemIcon from '@/components/builder/ItemIcon';
import { isBilgewaterStatItem } from '@/data/traitModules';

export default function BilgewaterPoolContent({ data, tm }: SimulatorLayoutProps) {
  const hasBWPlayer = tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const hasBWEnemy = tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);

  const statItems = data.items.filter(item => isBilgewaterStatItem(item.apiName));
  const equipItems = data.items.filter(item => {
    if (!item.apiName.includes('TFT16_Item_Bilgewater_')) return false;
    if (isBilgewaterStatItem(item.apiName)) return false;
    if (Object.keys(item.effects).length === 0) return false;
    return true;
  });

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      <div className="text-[10px] font-bold text-teal-400 shrink-0">능력치 (클릭으로 구매 — 빌지워터 챔피언 전체 적용)</div>
      <div className="grid grid-cols-7 gap-1.5 overflow-y-auto min-h-0 p-1">
        {statItems.map(item => {
          const playerCount = tm.playerBilgewaterStats[item.apiName] ?? 0;
          const enemyCount = tm.enemyBilgewaterStats[item.apiName] ?? 0;
          const totalCount = playerCount + enemyCount;
          return (
            <div key={item.apiName} className="relative"
              onContextMenu={(e) => {
                e.preventDefault();
                if (hasBWPlayer && playerCount > 0) tm.handleRemoveBilgewaterStat('player', item.apiName);
                else if (hasBWEnemy && enemyCount > 0) tm.handleRemoveBilgewaterStat('enemy', item.apiName);
              }}>
              <ItemIcon item={item} size={32}
                onClick={() => {
                  if (hasBWPlayer) tm.handleBuyBilgewaterStat('player', item);
                  else if (hasBWEnemy) tm.handleBuyBilgewaterStat('enemy', item);
                }} />
              {totalCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-600 rounded-full text-[8px] text-white flex items-center justify-center font-bold pointer-events-none">
                  {totalCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] font-bold text-teal-400 shrink-0 mt-2">장비 아이템 (드래그로 장착)</div>
      <div className="grid grid-cols-7 gap-1.5 overflow-y-auto min-h-0 p-1">
        {equipItems.map(item => <DraggableItemIcon key={item.apiName} item={item} size={32} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `PoolContentRouter` 구현**

```tsx
function PoolContentRouter(props: SimulatorLayoutProps) {
  const { poolFilters, tm } = props;
  const bwPlayerActive = tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const bwEnemyActive = tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const showBilgewaterTab = bwPlayerActive || bwEnemyActive;

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-2 shrink-0">
        <button onClick={() => poolFilters.setActivePoolTab('champions')}
          className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'champions' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>
          챔피언
        </button>
        <button onClick={() => poolFilters.setActivePoolTab('items')}
          className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'items' ? 'bg-yellow-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>
          아이템
        </button>
        {showBilgewaterTab && (
          <button onClick={() => poolFilters.setActivePoolTab('bilgewater')}
            className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'bilgewater' ? 'bg-teal-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>
            빌지워터
          </button>
        )}
      </div>
      {poolFilters.activePoolTab === 'champions' && <ChampionPoolContent {...props} />}
      {poolFilters.activePoolTab === 'items' && <ItemPoolContent {...props} />}
      {poolFilters.activePoolTab === 'bilgewater' && showBilgewaterTab && <BilgewaterPoolContent {...props} />}
    </div>
  );
}
```

- [ ] **Step 4: `MobileAugmentRow` 구현**

```tsx
function MobileAugmentRow({ tm, teamNames }: SimulatorLayoutProps) {
  const playerLabel = teamNames.player ?? 'TEAM A';
  const enemyLabel = teamNames.enemy ?? 'TEAM B';
  return (
    <div className="flex justify-between px-2 gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-red-400 font-bold mb-1 truncate">{enemyLabel} 증강</div>
        <AugmentSlots
          augments={tm.enemyAugments}
          augmentStacks={tm.enemyAugmentStacks}
          onOpenSelector={() => tm.setShowAugmentPicker('enemy')}
          onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'enemy' })}
          onRemove={(i) => tm.handleRemoveAugment('enemy', i)}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-blue-400 font-bold mb-1 truncate">{playerLabel} 증강</div>
        <AugmentSlots
          augments={tm.playerAugments}
          augmentStacks={tm.playerAugmentStacks}
          onOpenSelector={() => tm.setShowAugmentPicker('player')}
          onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'player' })}
          onRemove={(i) => tm.handleRemoveAugment('player', i)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: typecheck/lint/build 통과**

- [ ] **Step 6: 커밋**

```bash
git add src/app/simulator/layout/
git commit -m "feat(simulator): 모바일 Setup mode 서브컴포넌트 (pool router, overlay, augment row)"
```

---

### Task 4.5: Replay mode 서브컴포넌트 (Log / Unit Detail)

**Files:**
- Modify: `src/app/simulator/layout/SimulatorLayoutMobile.tsx`

- [ ] **Step 1: `ReplayLogTab` 구현**

```tsx
function ReplayLogTab({ replay, logFilter, setLogFilter }: SimulatorLayoutProps) {
  const filteredLogs = useMemo(() => {
    if (!replay.combatResult) return [];
    if (logFilter === 'all') return replay.combatResult.logs.slice(-200);
    return replay.combatResult.logs.filter(l => l.type === logFilter).slice(-200);
  }, [replay.combatResult, logFilter]);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-1 shrink-0 overflow-x-auto">
        {(['all', 'attack', 'ability', 'death', 'move'] as const).map(f => (
          <button key={f}
            onClick={() => setLogFilter(f)}
            className={`px-2 py-0.5 rounded text-[10px] shrink-0 ${logFilter === f ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-500'}`}>
            {f === 'all' ? '전체' : f === 'attack' ? '공격' : f === 'ability' ? '스킬' : f === 'death' ? '사망' : '이동'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto space-y-0.5 font-mono text-[10px]"
        ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
        {filteredLogs.map((log, i) => (
          <div key={`${log.tick}-${i}`}
            className={`py-0.5 px-2 rounded ${
              log.type === 'death' ? 'bg-red-900/20 text-red-400' :
              log.type === 'ability' ? 'text-purple-400' :
              log.type === 'move' ? 'text-gray-500' : 'text-gray-400'
            }`}>
            <span className="text-gray-600 mr-2">[{log.time.toFixed(1)}s]</span>{log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ReplayUnitDetailTab` 구현**

기존 `page.tsx` 의 replay mode 하단 `UnitDetailPanel` 블록을 그대로 이식:

```tsx
function ReplayUnitDetailTab(props: SimulatorLayoutProps) {
  const { tm, replay, data, hexBuffs, stageNumber, mappedPlayerForReplay } = props;
  if (!replay.selectedUnitId || !replay.selectedUnitSnap || !replay.unitMeta[replay.selectedUnitId]) {
    return <div className="text-center text-xs text-gray-500 py-6">보드의 유닛을 선택하세요</div>;
  }
  const selMeta = replay.unitMeta[replay.selectedUnitId];
  const target = selMeta.team === 'player'
    ? mappedPlayerForReplay.find(p => p.champion.apiName === selMeta.championApiName)
    : undefined;
  const verifyContext = target ? {
    playerTeam: mappedPlayerForReplay,
    enemyTeam: tm.enemyTeam,
    targetApiName: selMeta.championApiName,
    targetPosition: target.position,
    simulateOptions: {
      seed: 42, allTraits: data.traits, skipMirror: true,
      playerAugments: tm.playerAugments, playerAugmentStacks: tm.playerAugmentStacks,
      enemyAugments: tm.enemyAugments, enemyAugmentStacks: tm.enemyAugmentStacks,
      playerBilgewaterEffects: resolveBilgewaterStatEffects(tm.playerBilgewaterStats, data.items),
      enemyBilgewaterEffects: resolveBilgewaterStatEffects(tm.enemyBilgewaterStats, data.items),
      playerPiltoverModules: tm.playerPiltoverModules,
      enemyPiltoverModules: tm.enemyPiltoverModules,
      playerIoniaPath: tm.playerIoniaPath ?? undefined,
      enemyIoniaPath: tm.enemyIoniaPath ?? undefined,
      playerGalio: tm.playerGalio, enemyGalio: tm.enemyGalio,
      playerHexBuffs: hexBuffs.player, enemyHexBuffs: hexBuffs.enemy,
      stageNumber,
      playerArbiterLaw: tm.playerArbiterLaw ?? undefined,
      enemyArbiterLaw: tm.enemyArbiterLaw ?? undefined,
    },
  } : undefined;

  return (
    <UnitDetailPanel
      key={replay.selectedUnitId}
      unitSnapshot={replay.selectedUnitSnap}
      meta={selMeta}
      onClose={() => replay.setSelectedUnitId(null)}
      allItems={data.items}
      verifyContext={verifyContext}
      activeTraits={selMeta.team === 'player' ? tm.playerTraits : tm.enemyTraits}
    />
  );
}
```

**주의**: 파일 상단에 `import { resolveBilgewaterStatEffects } from '@/lib/simulator/systems/stat';` 추가.

- [ ] **Step 3: 승리 배너 + tick 이벤트 바 이식**

`SimulatorLayoutMobile` 의 main JSX 에 replay 모드 상단 섹션 추가:

```tsx
{replay.viewMode === 'replay' && replay.combatResult && (
  <>
    <div className={`text-center p-2 rounded-lg border text-xs ${
      replay.combatResult.winner === 'player' ? 'bg-blue-600/10 border-blue-600/30' :
      replay.combatResult.winner === 'enemy' ? 'bg-red-600/10 border-red-600/30' :
      'bg-gray-600/10 border-gray-600/30'
    }`}>
      <div className="text-sm font-black">
        {replay.combatResult.winner === 'player' ? `${playerLabel} 승리!` :
         replay.combatResult.winner === 'enemy' ? `${enemyLabel} 승리!` : '무승부'}
      </div>
      <div className="text-[10px] text-gray-400">전투 시간: {replay.combatResult.duration.toFixed(1)}초</div>
    </div>
  </>
)}
{/* 보드 ...  */}
{/* 틱 이벤트 — 보드 바로 아래에 */}
{replay.viewMode === 'replay' && (
  <div className="bg-[#111827] rounded-lg border border-gray-800 p-2" style={{ minHeight: 60 }}>
    <div className="text-[10px] font-bold text-gray-500 mb-1">현재 틱 이벤트</div>
    <div className="space-y-0.5 font-mono text-[10px] h-[44px] overflow-y-auto">
      {replay.tickEvents.length > 0 ? replay.tickEvents.map((e, i) => (
        <div key={`${e.tick}-${i}`} className={
          e.type === 'death' ? 'text-red-400' :
          e.type === 'ability' ? 'text-purple-400' :
          e.type === 'move' ? 'text-gray-600' : 'text-gray-400'
        }>{e.message}</div>
      )) : (
        <div className="text-gray-600">대기 중...</div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: `page.tsx` 에서 `useViewport()` 로 mobile 분기**

`src/app/simulator/page.tsx` 의 `<SimulatorLayoutDesktop {...layoutProps} />` 호출을 다음으로 교체:

```tsx
import { useViewport } from '@/hooks/useViewport';
import SimulatorLayoutMobile from './layout/SimulatorLayoutMobile';
// ...

const viewport = useViewport();
// ...
{viewport === 'mobile'
  ? <SimulatorLayoutMobile {...layoutProps} />
  : <SimulatorLayoutDesktop {...layoutProps} />}
```

- [ ] **Step 5: 모바일 수동 QA**

`pnpm dev` + DevTools responsive mode 로 360 / 375 / 390px 확인:
- 보드 렌더 (헥스 셀 36px)
- 챔피언 풀에서 드래그 → 보드 배치
- 유닛 탭 → bottom sheet half 로 자동 확장 + 아이템 장착
- 시너지 chip 탭 → sheet full + 시너지 탭 활성
- 증강 추가 → modal
- 전투 시작 → replay mode
- 로그/데미지 탭 전환
- 유닛 클릭 → 유닛 탭 자동 선택

- [ ] **Step 6: lint/typecheck/build 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build`

- [ ] **Step 7: 커밋**

```bash
git add src/app/simulator/
git commit -m "feat(simulator): 모바일 Replay mode + 뷰포트 분기 활성화"
```

---

## Phase 5: 태블릿 레이아웃 (768~1023px)

### Task 5.1: `DroppableOverlay` 공용 추출 (선행 작업 — DRY)

**Files:**
- Create: `src/app/simulator/layout/shared/DroppableOverlay.tsx`
- Modify: `src/app/simulator/layout/SimulatorLayoutMobile.tsx`

- [ ] **Step 1: 공용 컴포넌트 추출**

`MobileDroppableOverlay` (Task 4.4 에서 작성한) 로직을 그대로 공용 파일로 이동:

```tsx
// src/app/simulator/layout/shared/DroppableOverlay.tsx
'use client';

import React from 'react';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { axialToOffset, offsetToAxial } from '@/types';
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import { SimulatorLayoutProps } from '../types';

interface DroppableOverlayProps {
  tm: SimulatorLayoutProps['tm'];
  hexBuffs: SimulatorLayoutProps['hexBuffs'];
  setHoverUnit: SimulatorLayoutProps['setHoverUnit'];
  cellSize: number;
  onUnitClick: (team: 'player' | 'enemy', index: number) => void;
}

export default function DroppableOverlay({ tm, hexBuffs, setHoverUnit, cellSize, onUnitClick }: DroppableOverlayProps) {
  const { playerTeam, enemyTeam } = tm;
  const { player: playerHexBuffs, enemy: enemyHexBuffs, moving, setMoving, setOverrides } = hexBuffs;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: BOARD_COLS }, (_, col) => {
          const team = row < 4 ? 'enemy' : 'player';
          const teamArr = team === 'player' ? playerTeam : enemyTeam;
          const dataRow = team === 'player' ? row - 4 : row;
          const placedIdx = teamArr.findIndex(p => {
            const off = axialToOffset(p.position);
            return off.row === dataRow && off.col === col;
          });
          const placed = placedIdx >= 0 ? teamArr[placedIdx] : null;

          const cellClick = () => {
            if (moving) {
              const pos = offsetToAxial({ row: dataRow, col });
              setOverrides(prev => ({ ...prev, [moving.team]: { ...prev[moving.team], [moving.apiName]: pos } }));
              setMoving(null);
              return;
            }
            const buffs = team === 'player' ? playerHexBuffs : enemyHexBuffs;
            const movableBuff = buffs.find(b => b.movable && b.positions.some(p => {
              const off = axialToOffset(p); return off.row === dataRow && off.col === col;
            }));
            if (movableBuff && !placed) { setMoving({ team, apiName: movableBuff.augmentApiName }); return; }
            if (placed && placedIdx >= 0) onUnitClick(team, placedIdx);
            else tm.handleCellClick(offsetToAxial({ row: dataRow, col }), team);
          };

          const cellContextMenu = (e: React.MouseEvent) => {
            e.preventDefault();
            if (placed && placedIdx >= 0) tm.handleRemoveUnit(team, placedIdx);
          };

          return (
            <DroppableHexCell
              key={`cell-${row}-${col}`}
              id={`cell-${row}-${col}`}
              row={row}
              col={col}
              placedUnit={placed ? { team, position: placed.position } : null}
              onClick={cellClick}
              onContextMenu={cellContextMenu}
              onMouseEnter={placed ? (rect) => setHoverUnit({ placed, rect }) : undefined}
              onMouseLeave={() => setHoverUnit(null)}
              cellSize={cellSize}
            />
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 2: 모바일 레이아웃에서 inline `MobileDroppableOverlay` 제거하고 공용 import**

`SimulatorLayoutMobile.tsx` 하단의 `MobileDroppableOverlay` 함수 정의 삭제. 상단에 import 추가:

```tsx
import DroppableOverlay from './shared/DroppableOverlay';
```

JSX 에서 호출부를:

```tsx
<DroppableOverlay
  tm={tm}
  hexBuffs={hexBuffs}
  setHoverUnit={setHoverUnit}
  cellSize={MOBILE_CELL_SIZE}
  onUnitClick={onUnitClickWithSheet}
/>
```

로 교체.

- [ ] **Step 3: 모바일 수동 확인 — 동작 변화 없음**

`pnpm dev` → 모바일 (360px) 에서 챔프 드래그/드롭, 유닛 클릭, 우클릭 삭제, hexBuff movable 동작 확인.

- [ ] **Step 4: lint/typecheck/build 통과**

- [ ] **Step 5: 커밋**

```bash
git add src/app/simulator/layout/
git commit -m "refactor(simulator): DroppableOverlay 공용 추출 — 태블릿 레이아웃 선행 작업"
```

---

### Task 5.2: `SimulatorLayoutTablet` — 2-column + tabbed side

**Files:**
- Create: `src/app/simulator/layout/SimulatorLayoutTablet.tsx`

- [ ] **Step 1: 레이아웃 구현**

```tsx
// src/app/simulator/layout/SimulatorLayoutTablet.tsx
'use client';

import { useState, useCallback } from 'react';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { axialToOffset, offsetToAxial, TICKS_PER_SECOND } from '@/types';
import { SimulatorLayoutProps } from './types';
import SetupBoard from '@/components/battle/SetupBoard';
import ReplayBoard from '@/components/battle/ReplayBoard';
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import BattleControls from '@/components/battle/BattleControls';
import AugmentSlots from '@/components/builder/AugmentSlots';
import SynergyPanel from '@/components/builder/SynergyPanel';
import PiltoverModulePanel from '@/components/builder/PiltoverModulePanel';
import SelectedUnitPanel from '@/components/builder/SelectedUnitPanel';
import UnitDetailPanel from '@/components/battle/UnitDetailPanel';
import DamageSidebar from '@/components/battle/DamageSidebar';
import TeamCodePanel from '@/components/builder/TeamCodePanel';
import ChampionPoolContent from './pool/ChampionPoolContent';
import ItemPoolContent from './pool/ItemPoolContent';
import BilgewaterPoolContent from './pool/BilgewaterPoolContent';

const TABLET_CELL_SIZE = 48;

type TabletSideTab = 'pool' | 'synergy' | 'unit';

export default function SimulatorLayoutTablet(props: SimulatorLayoutProps) {
  const { tm, replay, hexBuffs, setHoverUnit, setShowTeamCode, showTeamCode, runSimulation, runMultiple, stageNumber, setStageNumber, isRunning, teamNames, data, poolFilters, logFilter, setLogFilter, mappedPlayerForReplay } = props;

  const [sideTab, setSideTab] = useState<TabletSideTab>('pool');

  const playerLabel = teamNames.player ?? 'TEAM A';
  const enemyLabel = teamNames.enemy ?? 'TEAM B';

  const onUnitClickWithTab = useCallback((team: 'player' | 'enemy', index: number) => {
    tm.handleUnitClick(team, index);
    setSideTab('unit');
  }, [tm]);

  return (
    <div className="space-y-3">
      {/* Header — 데스크톱과 유사한 풀 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-gray-200">전투 시뮬레이션</h2>
          {replay.combatResult && (
            <div className="flex gap-1">
              <button onClick={() => replay.setViewMode('setup')}
                className={`px-2 py-1 rounded text-xs font-medium ${replay.viewMode === 'setup' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>
                편집
              </button>
              <button onClick={() => replay.setViewMode('replay')}
                className={`px-2 py-1 rounded text-xs font-medium ${replay.viewMode === 'replay' ? 'bg-purple-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>
                리플레이
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={tm.resetAll} className="px-2 py-1.5 bg-[#1f2937] text-gray-500 hover:text-red-400 rounded-lg text-xs">초기화</button>
          <button onClick={() => setShowTeamCode(v => !v)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium ${showTeamCode ? 'bg-teal-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>
            팀 코드
          </button>
          <select value={stageNumber} onChange={e => setStageNumber(Number(e.target.value))}
            className="bg-[#1f2937] text-gray-300 text-xs rounded-lg px-2 py-1.5 border border-gray-600">
            {[1,2,3,4,5,6,7].map(s => <option key={s} value={s}>Stage {s}</option>)}
          </select>
          <button onClick={runSimulation} disabled={isRunning || tm.playerTeam.length === 0 || tm.enemyTeam.length === 0}
            className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-xs font-bold text-black">
            {isRunning ? '전투 중...' : '전투 시작'}
          </button>
          <button onClick={runMultiple} disabled={isRunning || tm.playerTeam.length === 0 || tm.enemyTeam.length === 0}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-xs font-bold text-white">
            100회
          </button>
        </div>
      </div>

      {showTeamCode && (
        <TeamCodePanel
          playerTeam={tm.playerTeam} enemyTeam={tm.enemyTeam}
          champions={data.champions} teamPlannerMapping={data.teamPlannerMapping}
          onImport={(team, imp) => {
            if (team === 'player') tm.updatePlayerTeam(imp);
            else tm.updateEnemyTeam(imp);
            tm.setSelectedUnit(null);
          }}
        />
      )}

      {/* 2-column grid */}
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        {/* Left: Board + Augments */}
        <div className="min-w-0 space-y-2">
          <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-2 overflow-x-auto flex justify-center">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {replay.viewMode === 'setup' ? (
                <>
                  <SetupBoard
                    playerChampions={tm.playerTeam} enemyChampions={tm.enemyTeam}
                    onCellClick={tm.handleCellClick} onUnitClick={onUnitClickWithTab}
                    onUnitRightClick={tm.handleRemoveUnit} onUnitCycleStars={tm.handleCycleStars}
                    selectedCell={tm.selectedCell} selectedUnit={tm.selectedUnit}
                    playerHexBuffs={hexBuffs.player} enemyHexBuffs={hexBuffs.enemy}
                    movingHexBuffApiName={hexBuffs.moving?.apiName}
                    cellSize={TABLET_CELL_SIZE}
                  />
                  <DroppableOverlay
                    tm={tm} hexBuffs={hexBuffs} setHoverUnit={props.setHoverUnit}
                    cellSize={TABLET_CELL_SIZE} onUnitClick={onUnitClickWithTab}
                  />
                </>
              ) : (
                replay.combatResult && (
                  <ReplayBoard
                    snapshot={replay.currentSnapshot} unitMeta={replay.unitMeta}
                    selectedUnitId={replay.selectedUnitId}
                    onUnitClick={(id) => { replay.setSelectedUnitId(id); if (id) setSideTab('unit'); }}
                    cellSize={TABLET_CELL_SIZE}
                  />
                )
              )}
            </div>
          </div>
          {replay.viewMode === 'setup' && (
            <div className="flex justify-between px-2 gap-4">
              {/* enemy / player augments — MobileAugmentRow 와 동일 패턴 */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-red-400 font-bold mb-1 truncate">{enemyLabel} 증강</div>
                <AugmentSlots augments={tm.enemyAugments} augmentStacks={tm.enemyAugmentStacks}
                  onOpenSelector={() => tm.setShowAugmentPicker('enemy')}
                  onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'enemy' })}
                  onRemove={(i) => tm.handleRemoveAugment('enemy', i)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-blue-400 font-bold mb-1 truncate">{playerLabel} 증강</div>
                <AugmentSlots augments={tm.playerAugments} augmentStacks={tm.playerAugmentStacks}
                  onOpenSelector={() => tm.setShowAugmentPicker('player')}
                  onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'player' })}
                  onRemove={(i) => tm.handleRemoveAugment('player', i)} />
              </div>
            </div>
          )}
          {replay.viewMode === 'replay' && replay.combatResult && (
            <BattleControls
              currentTick={replay.replayTick} totalTicks={replay.combatResult.snapshots.length}
              playbackSpeed={replay.playbackSpeed} isPlaying={replay.isPlaying}
              onPlay={() => replay.setIsPlaying(true)} onPause={() => replay.setIsPlaying(false)}
              onStepForward={() => replay.setReplayTick(p => Math.min(p + 1, replay.combatResult!.snapshots.length - 1))}
              onStepBack={() => replay.setReplayTick(p => Math.max(p - 1, 0))}
              onSeek={replay.setReplayTick} onSpeedChange={replay.setPlaybackSpeed}
              ticksPerSecond={TICKS_PER_SECOND}
            />
          )}
        </div>

        {/* Right: Tabbed side panel */}
        <div className="bg-[#111827] rounded-xl border border-gray-800 flex flex-col max-h-[calc(100vh-140px)] overflow-hidden">
          <div className="flex border-b border-gray-800 shrink-0">
            <button onClick={() => setSideTab('pool')}
              className={`flex-1 px-2 py-2 text-xs font-medium ${sideTab === 'pool' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>
              풀
            </button>
            <button onClick={() => setSideTab('synergy')}
              className={`flex-1 px-2 py-2 text-xs font-medium ${sideTab === 'synergy' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>
              시너지
            </button>
            <button onClick={() => setSideTab('unit')}
              className={`flex-1 px-2 py-2 text-xs font-medium ${sideTab === 'unit' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}>
              유닛
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {sideTab === 'pool' && replay.viewMode === 'setup' && <TabletPoolRouter {...props} />}
            {sideTab === 'pool' && replay.viewMode === 'replay' && (
              <DamageSidebar combatResult={replay.combatResult} currentSnapshot={replay.currentSnapshot}
                selectedUnitId={replay.selectedUnitId} onUnitClick={replay.setSelectedUnitId} />
            )}
            {sideTab === 'synergy' && <TabletSynergyContent {...props} />}
            {sideTab === 'unit' && <TabletUnitContent {...props} />}
          </div>
        </div>
      </div>

      {/* Replay: full log below */}
      {replay.viewMode === 'replay' && replay.combatResult && <TabletReplayLog {...props} />}
    </div>
  );
}

// --- 헬퍼들: 같은 파일 하단에서 구현 (아래 Step 들에서) ---
```

**주의**: `DroppableOverlay` 는 Task 5.1 에서 추출한 공용 컴포넌트. `TabletPoolRouter` / `TabletSynergyContent` / `TabletUnitContent` / `TabletReplayLog` 는 다음 Step 들에서 인라인 구현.

- [ ] **Step 2: `TabletPoolRouter` 구현 (같은 파일 하단)**

```tsx
function TabletPoolRouter(props: SimulatorLayoutProps) {
  const { poolFilters, tm } = props;
  const bwPlayerActive = tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const bwEnemyActive = tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const showBW = bwPlayerActive || bwEnemyActive;
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-2 shrink-0">
        <button onClick={() => poolFilters.setActivePoolTab('champions')}
          className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'champions' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>챔피언</button>
        <button onClick={() => poolFilters.setActivePoolTab('items')}
          className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'items' ? 'bg-yellow-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>아이템</button>
        {showBW && (
          <button onClick={() => poolFilters.setActivePoolTab('bilgewater')}
            className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'bilgewater' ? 'bg-teal-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}>빌지워터</button>
        )}
      </div>
      {poolFilters.activePoolTab === 'champions' && <ChampionPoolContent {...props} />}
      {poolFilters.activePoolTab === 'items' && <ItemPoolContent {...props} />}
      {poolFilters.activePoolTab === 'bilgewater' && showBW && <BilgewaterPoolContent {...props} />}
    </div>
  );
}
```

- [ ] **Step 3: `TabletSynergyContent` 구현**

```tsx
function TabletSynergyContent({ tm, data }: SimulatorLayoutProps) {
  return (
    <div className="space-y-3">
      <SynergyPanel activeTraits={tm.enemyTraits} team="enemy" items={data.items} champions={data.champions} piltoverModules={tm.enemyPiltoverModules} bilgewaterStats={tm.enemyBilgewaterStats} ioniaPath={tm.enemyIoniaPath} onIoniaPathChange={tm.setEnemyIoniaPath} arbiterLaw={tm.enemyArbiterLaw} onArbiterLawChange={tm.setEnemyArbiterLaw} />
      <PiltoverModulePanel modules={tm.enemyPiltoverModules} allItems={data.items} activeTraits={tm.enemyTraits} onAddModule={(i) => tm.handleAddPiltoverModule('enemy', i)} onRemoveModule={(i) => tm.handleRemovePiltoverModule('enemy', i)} />
      <SynergyPanel activeTraits={tm.playerTraits} team="player" items={data.items} champions={data.champions} piltoverModules={tm.playerPiltoverModules} bilgewaterStats={tm.playerBilgewaterStats} ioniaPath={tm.playerIoniaPath} onIoniaPathChange={tm.setPlayerIoniaPath} arbiterLaw={tm.playerArbiterLaw} onArbiterLawChange={tm.setPlayerArbiterLaw} />
      <PiltoverModulePanel modules={tm.playerPiltoverModules} allItems={data.items} activeTraits={tm.playerTraits} onAddModule={(i) => tm.handleAddPiltoverModule('player', i)} onRemoveModule={(i) => tm.handleRemovePiltoverModule('player', i)} />
    </div>
  );
}
```

- [ ] **Step 4: `TabletUnitContent` 구현**

```tsx
function TabletUnitContent(props: SimulatorLayoutProps) {
  const { tm, replay, data, hexBuffs, stageNumber, mappedPlayerForReplay } = props;

  if (replay.viewMode === 'setup') {
    if (!tm.selectedUnit || !tm.selectedPlaced) {
      return <div className="text-center text-xs text-gray-500 py-6">보드의 유닛을 선택하세요</div>;
    }
    return (
      <SelectedUnitPanel
        placed={tm.selectedPlaced}
        team={tm.selectedUnit.team}
        allItems={data.items}
        activeTraits={tm.selectedUnit.team === 'player' ? tm.playerTraits : tm.enemyTraits}
        onStarChange={(l) => tm.handleStarChange(tm.selectedUnit!.team, tm.selectedUnit!.index, l)}
        onEquipItem={(i) => tm.handleEquipItem(tm.selectedUnit!.team, tm.selectedUnit!.index, i)}
        onRemoveItem={(i) => tm.handleRemoveItem(tm.selectedUnit!.team, tm.selectedUnit!.index, i)}
        onRemoveVoidItem={() => tm.handleRemoveVoidItem(tm.selectedUnit!.team, tm.selectedUnit!.index)}
        onRemoveUnit={() => tm.handleRemoveUnit(tm.selectedUnit!.team, tm.selectedUnit!.index)}
        onMfModeChange={(m) => tm.handleMfModeChange(tm.selectedUnit!.team, tm.selectedUnit!.index, m)}
        onPermanentStackChange={(v) => tm.handlePermanentStackChange(tm.selectedUnit!.team, tm.selectedUnit!.index, v)}
      />
    );
  }

  // Replay 모드: `ReplayUnitDetailTab` (Task 4.5 에서 모바일용으로 작성한 것) 과 동일한 verifyContext 구성 후 UnitDetailPanel 렌더.
  // Task 4.5 의 ReplayUnitDetailTab 코드 본문을 그대로 복사해서 사용 가능 (props 구조 동일).
  if (!replay.selectedUnitId || !replay.selectedUnitSnap || !replay.unitMeta[replay.selectedUnitId]) {
    return <div className="text-center text-xs text-gray-500 py-6">보드의 유닛을 선택하세요</div>;
  }
  const selMeta = replay.unitMeta[replay.selectedUnitId];
  const target = selMeta.team === 'player'
    ? mappedPlayerForReplay.find(p => p.champion.apiName === selMeta.championApiName)
    : undefined;
  const verifyContext = target ? {
    playerTeam: mappedPlayerForReplay,
    enemyTeam: tm.enemyTeam,
    targetApiName: selMeta.championApiName,
    targetPosition: target.position,
    simulateOptions: {
      seed: 42, allTraits: data.traits, skipMirror: true,
      playerAugments: tm.playerAugments, playerAugmentStacks: tm.playerAugmentStacks,
      enemyAugments: tm.enemyAugments, enemyAugmentStacks: tm.enemyAugmentStacks,
      playerBilgewaterEffects: resolveBilgewaterStatEffects(tm.playerBilgewaterStats, data.items),
      enemyBilgewaterEffects: resolveBilgewaterStatEffects(tm.enemyBilgewaterStats, data.items),
      playerPiltoverModules: tm.playerPiltoverModules,
      enemyPiltoverModules: tm.enemyPiltoverModules,
      playerIoniaPath: tm.playerIoniaPath ?? undefined,
      enemyIoniaPath: tm.enemyIoniaPath ?? undefined,
      playerGalio: tm.playerGalio, enemyGalio: tm.enemyGalio,
      playerHexBuffs: hexBuffs.player, enemyHexBuffs: hexBuffs.enemy,
      stageNumber,
      playerArbiterLaw: tm.playerArbiterLaw ?? undefined,
      enemyArbiterLaw: tm.enemyArbiterLaw ?? undefined,
    },
  } : undefined;

  return (
    <UnitDetailPanel
      key={replay.selectedUnitId}
      unitSnapshot={replay.selectedUnitSnap}
      meta={selMeta}
      onClose={() => replay.setSelectedUnitId(null)}
      allItems={data.items}
      verifyContext={verifyContext}
      activeTraits={selMeta.team === 'player' ? tm.playerTraits : tm.enemyTraits}
    />
  );
}
```

**Import 필요**: `resolveBilgewaterStatEffects` from `@/lib/simulator/systems/stat`, `UnitDetailPanel`, `SelectedUnitPanel`.

- [ ] **Step 5: `TabletReplayLog` 구현**

```tsx
function TabletReplayLog({ replay, logFilter, setLogFilter }: SimulatorLayoutProps) {
  const filteredLogs = (() => {
    if (!replay.combatResult) return [];
    if (logFilter === 'all') return replay.combatResult.logs.slice(-200);
    return replay.combatResult.logs.filter(l => l.type === logFilter).slice(-200);
  })();

  return (
    <div className="p-4 bg-[#111827] rounded-xl border border-gray-800" style={{ minHeight: 280 }}>
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-sm font-bold text-gray-300">전투 로그</h4>
        <div className="flex gap-1 ml-auto">
          {(['all', 'attack', 'ability', 'death', 'move'] as const).map(f => (
            <button key={f}
              onClick={() => setLogFilter(f)}
              className={`px-2 py-0.5 rounded text-[10px] ${logFilter === f ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-500'}`}>
              {f === 'all' ? '전체' : f === 'attack' ? '공격' : f === 'ability' ? '스킬' : f === 'death' ? '사망' : '이동'}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[200px] overflow-y-auto space-y-0.5 font-mono text-xs"
        ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
        {filteredLogs.map((log, i) => (
          <div key={`${log.tick}-${i}`} className={`py-0.5 px-2 rounded ${
            log.type === 'death' ? 'bg-red-900/20 text-red-400' :
            log.type === 'ability' ? 'text-purple-400' :
            log.type === 'move' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            <span className="text-gray-600 mr-2">[{log.time.toFixed(1)}s]</span>{log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `page.tsx` 에 tablet 분기 추가**

`src/app/simulator/page.tsx` 의 viewport switch 확장:

```tsx
import SimulatorLayoutTablet from './layout/SimulatorLayoutTablet';
// ...
{viewport === 'mobile' ? <SimulatorLayoutMobile {...layoutProps} />
 : viewport === 'tablet' ? <SimulatorLayoutTablet {...layoutProps} />
 : <SimulatorLayoutDesktop {...layoutProps} />}
```

- [ ] **Step 7: lint/typecheck/build 통과**

Run: `pnpm lint && pnpm typecheck && pnpm build`

- [ ] **Step 8: 태블릿 수동 QA**

DevTools 에서 768 / 820 / 1023px 확인:
- 2-column 레이아웃 정상
- 보드 + 증강
- 풀/시너지/유닛 탭 전환
- Setup → Replay 전환
- 리플레이 하단 전체 로그

- [ ] **Step 9: 커밋**

```bash
git add src/app/simulator/
git commit -m "feat(simulator): SimulatorLayoutTablet — 2-column + tabbed side panel"
```

---

## Phase 6: 폴리시 & 엣지 케이스

### Task 6.1: DnD 드래그 시작 시 시트 자동 peek

**Files:**
- Modify: `src/app/simulator/page.tsx`, `src/app/simulator/layout/SimulatorLayoutMobile.tsx`

- [ ] **Step 1: sheet state 를 layoutProps 로 끌어올림**

모바일 레이아웃의 `sheetState/setSheetState` 를 `page.tsx` 로 끌어올리고 `SimulatorLayoutProps` 에 추가. (뷰포트 전환에도 상태 유지 + DndContext 에서 접근 가능.)

`types.ts`:
```typescript
// SimulatorLayoutProps 에 추가
sheetState: BottomSheetState;
setSheetState: Dispatch<SetStateAction<BottomSheetState>>;
activeMobileTab: MobileTabId;
setActiveMobileTab: Dispatch<SetStateAction<MobileTabId>>;
```

`MobileTabId` 를 `types.ts` 로도 이동.

- [ ] **Step 2: `page.tsx` 에서 `DndContext onDragStart` 가로채기**

```tsx
<DndContext sensors={sensors}
  onDragStart={(e) => {
    dnd.handleDragStart(e);
    if (viewport === 'mobile') setSheetState('peek');
  }}
  onDragEnd={dnd.handleDragEnd}>
```

- [ ] **Step 3: hexBuff movable 이동 모드 시 시트 peek**

`SimulatorLayoutMobile` 의 `MobileDroppableOverlay` → `DroppableOverlay` 의 `setMoving` 호출 직후 `setSheetState('peek')` 가 되도록 콜백 수정.

`DroppableOverlay` 에 `onMovableActivate?: () => void` prop 추가:
```tsx
if (movableBuff && !placed) {
  setMoving({ team, apiName: movableBuff.augmentApiName });
  onMovableActivate?.();
  return;
}
```

모바일 레이아웃에서 호출 시 `onMovableActivate={() => setSheetState('peek')}`.

- [ ] **Step 4: 모바일 수동 QA**

- 챔프 드래그 시작 → 시트가 peek 로 내려감 ✅
- hexBuff (야스오 황금 칸 등) movable 클릭 → 시트 peek ✅

- [ ] **Step 5: lint/typecheck/build 통과 + 커밋**

```bash
git add src/app/simulator/
git commit -m "feat(simulator): DnD/movable 시 bottom sheet 자동 peek"
```

---

### Task 6.2: 가상 키보드 대응 (visualViewport API)

**Files:**
- Modify: `src/components/ui/BottomSheet.tsx`

- [ ] **Step 1: visualViewport 높이를 height 계산에 반영**

`BottomSheet.tsx` 의 `vh` 계산을 다음으로 교체:

```tsx
// 기존: const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
// 교체: visualViewport 가 있으면 우선 사용 (키보드 올라오면 자동 축소됨)
function getViewportHeight(): number {
  if (typeof window === 'undefined') return 800;
  return window.visualViewport?.height ?? window.innerHeight;
}

// useSyncExternalStore 로 visualViewport 변화 구독
const vh = useSyncExternalStore(
  (onChange) => {
    if (typeof window === 'undefined' || !window.visualViewport) return () => {};
    const handler = () => onChange();
    window.visualViewport.addEventListener('resize', handler);
    window.addEventListener('resize', handler);
    return () => {
      window.visualViewport?.removeEventListener('resize', handler);
      window.removeEventListener('resize', handler);
    };
  },
  getViewportHeight,
  () => 800,
);
```

`useSyncExternalStore` import 추가.

- [ ] **Step 2: 풀 탭 검색바 focus 시 시트 full 전환**

`SearchBar` 컴포넌트의 input 에 `onFocus` 가 없다면 wrapper 에서 처리:

`SimulatorLayoutMobile` 의 풀 탭 내 `SearchBar` 를 감싸 `onFocusCapture` 추가:
```tsx
<div onFocusCapture={() => setSheetState('full')}>
  <SearchBar ... />
</div>
```

- [ ] **Step 3: 모바일 수동 QA (실기기 권장)**

- 풀 탭에서 검색바 포커스 → 시트가 full 로 올라감 ✅
- 키보드 뜬 상태에서 시트가 키보드 위에 올바르게 포지셔닝됨 ✅

- [ ] **Step 4: lint/typecheck/build 통과 + 커밋**

```bash
git add src/components/ui/BottomSheet.tsx src/app/simulator/layout/
git commit -m "feat(ui): BottomSheet visualViewport 대응 + 검색 포커스 시 full"
```

---

### Task 6.3: 전체 회귀 QA + 마무리

**Files:** 없음 (수동 QA + 미세 수정)

- [ ] **Step 1: 3 뷰포트 × 2 모드 × 9 플로우 매트릭스 수동 QA**

스프레드시트/메모에 체크리스트 작성:

| 뷰포트 | 모드 | 플로우 | 결과 |
|-------|------|--------|------|
| 360 | setup | 챔프 드래그 | |
| 360 | setup | 유닛 클릭→아이템 장착 | |
| 360 | setup | 증강 추가 | |
| 360 | setup | 시너지 확인 | |
| 360 | setup | 전투 시작 | |
| 360 | replay | 재생 | |
| 360 | replay | 로그/데미지 탭 | |
| 360 | replay | 유닛 클릭 | |
| 360 | - | 분석 핸드오프 복귀 | |
| 768 | ... (동일 플로우) | | |
| 1024 | ... | | |

- [ ] **Step 2: 발견된 버그 수정 (각각 별도 커밋)**

예: 특정 뷰포트에서 padding/overflow 문제, z-index 충돌, 이벤트 전파 이슈 등.

- [ ] **Step 3: 전체 final check**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`
Expected: 모두 통과, golden 스냅샷 변화 없음.

- [ ] **Step 4: 완료 커밋 (선택 — 버그 수정 없을 시 skip)**

```bash
git commit --allow-empty -m "chore(simulator): 모바일/태블릿 재설계 Phase 6 완료 — 전체 QA 통과"
```

---

## 완료 기준 (전체)

- [ ] 6 Phase 모든 Task 완료
- [ ] 각 Phase 커밋 로그 존재
- [ ] `pnpm lint && pnpm typecheck && pnpm build && pnpm test` 통과
- [ ] 기존 `tests/golden/` 영향 없음
- [ ] 3 뷰포트 × 2 모드 수동 QA 매트릭스 전체 통과
- [ ] 데스크톱 시각 regression 없음 (Phase 2 이후 전/후 스크린샷 비교)
- [ ] 분석 페이지 핸드오프 정상 동작
