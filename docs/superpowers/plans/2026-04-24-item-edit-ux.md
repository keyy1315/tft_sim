# 아이템 편집 UX 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/actual-data` 편집기에서 아이템을 **개별 슬롯 제거(×)**, **드래그 교체(A→B)**, **자석 제거기 드래그(전체 초기화)**로 편집하도록 지원한다.

**Architecture:** 기존 `DragData` union을 확장해 `tool` 타입을 추가하고, `ActualBoard`에 유닛 위 HTML 오버레이로 슬롯 단위 droppable + X 버튼을 렌더한다. `actualDndHandlers`의 drop 라우팅을 슬롯 ID → 셀 ID 순서로 시도하고, 슬롯 히트 시 해당 인덱스에 교체한다. `ChampionItemSidebar`에 "도구" 탭을 추가해 자석 제거기를 드래그 소스로 노출. 중첩 droppable(작은 슬롯 in 큰 헥스) 매칭을 위해 DndContext의 `collisionDetection`을 `pointerWithin` → `rectIntersection` fallback으로 교체.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zustand (`actualDataSlice`), @dnd-kit/core, TailwindCSS, Vitest.

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/types/index.ts` | `DragData` union에 `{ type: 'tool'; toolKind: 'remove-all' }` 추가 |
| `src/components/actual-data/actualDndHandlers.ts` | `parseSlotId`, 슬롯 인덱스 기반 아이템 교체/설정, `tool: remove-all` drop 처리 |
| `src/components/actual-data/ActualBoard.tsx` | 유닛 점유 헥스 위에 슬롯 오버레이(3칸 droppable + 채워진 슬롯 X 버튼) 추가 |
| `src/components/actual-data/ChampionItemSidebar.tsx` | 탭 목록에 `도구`(tools) 추가, 자석 제거기 노출 |
| `src/components/actual-data/DraggableItemRemoverTool.tsx` | 신규 — 자석 제거기 드래그 소스 컴포넌트 (@dnd-kit `useDraggable`) |
| `src/components/actual-data/PvPRoundEditor.tsx` | `DndContext collisionDetection` 조정 (pointerWithin → rectIntersection fallback) |
| `tests/unit/actualData/actualDndHandlers.test.ts` | 신규 — DnD handler 단위 테스트 (slot id 파싱, 교체, 제거기 동작) |

---

## Task 1: DragData union에 `tool` 타입 추가

**Files:**
- Modify: `src/types/index.ts:557-560`

- [ ] **Step 1: 현재 DragData 확인 (읽기만)**

  `src/types/index.ts:557-560`은 아래 형태.
  ```ts
  export type DragData =
    | { type: 'champion'; champion: RawChampion }
    | { type: 'placed-unit'; team: 'player' | 'enemy'; position: HexCoord }
    | { type: 'item'; item: RawItem };
  ```

- [ ] **Step 2: `tool` 분기 추가**

  `src/types/index.ts:557-560`을 다음으로 교체:
  ```ts
  export type DragData =
    | { type: 'champion'; champion: RawChampion }
    | { type: 'placed-unit'; team: 'player' | 'enemy'; position: HexCoord }
    | { type: 'item'; item: RawItem }
    | { type: 'tool'; toolKind: 'remove-all' };
  ```

- [ ] **Step 3: 타입체크로 기존 호환성 확인**

  ```bash
  pnpm typecheck
  ```
  Expected: 에러 없음 (기존 핸들러는 switch 없이 `dragData.type === 'x'` 체크만 해서 새 variant는 fall-through로 무시됨).

- [ ] **Step 4: 커밋**

  ```bash
  git add src/types/index.ts
  git commit -m "feat(actual-data): DragData union에 'tool' 타입 추가 (자석 제거기 준비)"
  ```

---

## Task 2: 슬롯 ID 파서 + 슬롯 단위 아이템 헬퍼 (TDD)

**Files:**
- Modify: `src/components/actual-data/actualDndHandlers.ts`
- Create: `tests/unit/actualData/actualDndHandlers.test.ts`

- [ ] **Step 1: 실패하는 테스트 먼저 작성**

  `tests/unit/actualData/actualDndHandlers.test.ts`를 새로 만든다.
  ```ts
  import { describe, it, expect } from 'vitest';
  import {
    parseSlotId,
    setItemAtSlot,
    clearUnitItems,
  } from '@/components/actual-data/actualDndHandlers';
  import type { PlacedUnit } from '@/lib/actualData/types';

  const sampleItem = { apiName: 'TFT_Item_BFSword' } as const;

  describe('parseSlotId', () => {
    it('player 팀 슬롯 id 를 파싱한다', () => {
      expect(parseSlotId('item-slot-player-1-2-0')).toEqual({
        team: 'player', hex: { q: 1, r: 2 }, slotIdx: 0,
      });
    });

    it('enemy 팀 음수 좌표도 파싱한다', () => {
      expect(parseSlotId('item-slot-enemy--1-3-2')).toEqual({
        team: 'enemy', hex: { q: -1, r: 3 }, slotIdx: 2,
      });
    });

    it('잘못된 포맷은 null 을 반환한다', () => {
      expect(parseSlotId('cell-4-3')).toBeNull();
      expect(parseSlotId('item-slot-foo-1-2-0')).toBeNull();
      expect(parseSlotId('item-slot-player-1-2-9')).toBeNull();
    });
  });

  const unit = (items: (string | undefined)[]): PlacedUnit => ({
    championId: 'TFT17_Ahri',
    hex: { q: 0, r: 0 },
    starLevel: 2,
    items: [items[0], items[1], items[2]] as PlacedUnit['items'],
  });

  describe('setItemAtSlot', () => {
    it('빈 슬롯을 지정된 인덱스에 채운다', () => {
      const u = unit([undefined, undefined, undefined]);
      const next = setItemAtSlot(u, 'TFT_Item_BFSword', 1);
      expect(next.items).toEqual([undefined, 'TFT_Item_BFSword', undefined]);
    });

    it('채워진 슬롯을 덮어쓴다 (교체)', () => {
      const u = unit(['TFT_Item_BFSword', 'TFT_Item_RecurveBow', undefined]);
      const next = setItemAtSlot(u, 'TFT_Item_Rabadon', 0);
      expect(next.items).toEqual(['TFT_Item_Rabadon', 'TFT_Item_RecurveBow', undefined]);
    });

    it('원본 객체를 mutate 하지 않는다', () => {
      const u = unit(['A', undefined, undefined]);
      setItemAtSlot(u, 'B', 0);
      expect(u.items).toEqual(['A', undefined, undefined]);
    });
  });

  describe('clearUnitItems', () => {
    it('3칸 모두 undefined 로 만든다', () => {
      const u = unit(['A', 'B', 'C']);
      const next = clearUnitItems(u);
      expect(next.items).toEqual([undefined, undefined, undefined]);
    });

    it('원본 객체를 mutate 하지 않는다', () => {
      const u = unit(['A', 'B', 'C']);
      clearUnitItems(u);
      expect(u.items).toEqual(['A', 'B', 'C']);
    });
  });
  ```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

  ```bash
  pnpm test tests/unit/actualData/actualDndHandlers.test.ts
  ```
  Expected: FAIL — `parseSlotId`, `setItemAtSlot`, `clearUnitItems` 모두 export 안 됨.

- [ ] **Step 3: 최소 구현 추가**

  `src/components/actual-data/actualDndHandlers.ts`의 `setItemInSlot` 함수 정의(32-41줄) 아래에 다음을 추가 (export 주의):
  ```ts
  /** Parse an item-slot droppable id `item-slot-{team}-{q}-{r}-{slotIdx}`. */
  export function parseSlotId(id: string): { team: 'player' | 'enemy'; hex: HexCoord; slotIdx: 0 | 1 | 2 } | null {
    const match = id.match(/^item-slot-(player|enemy)-(-?\d+)-(-?\d+)-(\d+)$/);
    if (!match) return null;
    const slotIdx = Number(match[4]);
    if (slotIdx !== 0 && slotIdx !== 1 && slotIdx !== 2) return null;
    return {
      team: match[1] as 'player' | 'enemy',
      hex: { q: Number(match[2]), r: Number(match[3]) },
      slotIdx,
    };
  }

  /** Replace or fill a specific slot (0..2) with the given item apiName. Returns a new unit. */
  export function setItemAtSlot(u: PlacedUnit, itemApiName: string, slotIdx: 0 | 1 | 2): PlacedUnit {
    const next = [...u.items] as PlacedUnit['items'];
    next[slotIdx] = itemApiName;
    return { ...u, items: next };
  }

  /** Clear all three item slots of a unit. Returns a new unit. */
  export function clearUnitItems(u: PlacedUnit): PlacedUnit {
    return { ...u, items: [undefined, undefined, undefined] as PlacedUnit['items'] };
  }
  ```

- [ ] **Step 4: 테스트 통과 확인**

  ```bash
  pnpm test tests/unit/actualData/actualDndHandlers.test.ts
  ```
  Expected: PASS — 3개 describe 블록의 모든 it 통과.

- [ ] **Step 5: 커밋**

  ```bash
  git add src/components/actual-data/actualDndHandlers.ts tests/unit/actualData/actualDndHandlers.test.ts
  git commit -m "feat(actual-data): 슬롯 단위 아이템 조작 헬퍼 (parseSlotId, setItemAtSlot, clearUnitItems)"
  ```

---

## Task 3: Drop 라우팅에 슬롯 교체 + 제거기 분기 추가 (TDD)

**Files:**
- Modify: `src/components/actual-data/actualDndHandlers.ts`
- Modify: `tests/unit/actualData/actualDndHandlers.test.ts`

- [ ] **Step 1: 통합 동작 테스트 추가 (실패 예상)**

  `tests/unit/actualData/actualDndHandlers.test.ts` 파일 **상단 import 블록에 다음을 추가**:
  ```ts
  import { createActualDragEndHandler, type ActualDndContext } from '@/components/actual-data/actualDndHandlers';
  import type { PvPRound, TeamSnapshot, OpponentSnapshot } from '@/lib/actualData/types';
  import type { DragEndEvent } from '@dnd-kit/core';
  ```

  그리고 파일 **맨 아래**에 describe 블록 이어서 추가:
  ```ts
  const baseTeam = (units: PlacedUnit[]): TeamSnapshot => ({
    units,
    augments: [undefined, undefined, undefined, undefined],
    level: 6,
    hp: 100,
    hexModifiers: [],
  });
  const baseOpponent = (units: PlacedUnit[]): OpponentSnapshot => ({ ...baseTeam(units) });

  const makeRound = (playerUnits: PlacedUnit[], opponentUnits: PlacedUnit[] = []): PvPRound => ({
    type: 'pvp',
    roundName: '2-1',
    videoStartTime: 0,
    playerTeam: baseTeam(playerUnits),
    opponent: baseOpponent(opponentUnits),
    winner: 'player',
  });

  /** Minimal DragEndEvent stub with just what the handler reads. */
  const makeEvent = (dragData: unknown, overId: string | null): DragEndEvent =>
    ({
      active: { data: { current: dragData }, id: 'active' },
      over: overId ? { id: overId } : null,
    } as unknown as DragEndEvent);

  describe('createActualDragEndHandler - item slot routing', () => {
    it('item drop 이 정확한 슬롯을 교체한다', () => {
      const unitA: PlacedUnit = {
        championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
        items: ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', undefined],
      };
      let player: PlacedUnit[] = [unitA];
      const ctx: ActualDndContext = {
        round: makeRound(player),
        roundIndex: 0,
        updatePlayerTeam: (_i, patch) => { player = patch.units; },
        updateOpponent: () => {},
      };
      const handler = createActualDragEndHandler(() => ctx);
      handler(makeEvent(
        { type: 'item', item: { apiName: 'TFT_Item_Rabadon' } },
        'item-slot-player-0-3-0',
      ));
      expect(player[0].items).toEqual(['TFT_Item_Rabadon', 'TFT_Item_RecurveBow', undefined]);
    });

    it('item drop 이 지정된 빈 슬롯을 채운다', () => {
      const unitA: PlacedUnit = {
        championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
        items: ['TFT_Item_BFSword', undefined, undefined],
      };
      let player: PlacedUnit[] = [unitA];
      const ctx: ActualDndContext = {
        round: makeRound(player),
        roundIndex: 0,
        updatePlayerTeam: (_i, patch) => { player = patch.units; },
        updateOpponent: () => {},
      };
      const handler = createActualDragEndHandler(() => ctx);
      handler(makeEvent(
        { type: 'item', item: { apiName: 'TFT_Item_Rabadon' } },
        'item-slot-player-0-3-2',
      ));
      expect(player[0].items).toEqual(['TFT_Item_BFSword', undefined, 'TFT_Item_Rabadon']);
    });

    it('item drop 이 헥스 본체 (cell-*) 에서는 기존 자동 채움 동작 유지', () => {
      const unitA: PlacedUnit = {
        championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
        items: [undefined, undefined, undefined],
      };
      let player: PlacedUnit[] = [unitA];
      const ctx: ActualDndContext = {
        round: makeRound(player),
        roundIndex: 0,
        updatePlayerTeam: (_i, patch) => { player = patch.units; },
        updateOpponent: () => {},
      };
      const handler = createActualDragEndHandler(() => ctx);
      // cell id: player 팀은 row 4-7, q=0,r=3 → dataRow=3, col=q+floor(r/2)=0+1=1, display row=4+3=7
      handler(makeEvent(
        { type: 'item', item: { apiName: 'TFT_Item_Rabadon' } },
        'cell-7-1',
      ));
      expect(player[0].items).toEqual(['TFT_Item_Rabadon', undefined, undefined]);
    });
  });

  describe('createActualDragEndHandler - remove-all tool', () => {
    it('점유된 헥스(cell) 위에 drop 하면 3칸 모두 비운다', () => {
      const unitA: PlacedUnit = {
        championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
        items: ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', 'TFT_Item_Rabadon'],
      };
      let player: PlacedUnit[] = [unitA];
      const ctx: ActualDndContext = {
        round: makeRound(player),
        roundIndex: 0,
        updatePlayerTeam: (_i, patch) => { player = patch.units; },
        updateOpponent: () => {},
      };
      const handler = createActualDragEndHandler(() => ctx);
      handler(makeEvent({ type: 'tool', toolKind: 'remove-all' }, 'cell-7-1'));
      expect(player[0].items).toEqual([undefined, undefined, undefined]);
    });

    it('점유된 유닛의 슬롯 위에 drop 해도 3칸 모두 비운다', () => {
      const unitA: PlacedUnit = {
        championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
        items: ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', undefined],
      };
      let player: PlacedUnit[] = [unitA];
      const ctx: ActualDndContext = {
        round: makeRound(player),
        roundIndex: 0,
        updatePlayerTeam: (_i, patch) => { player = patch.units; },
        updateOpponent: () => {},
      };
      const handler = createActualDragEndHandler(() => ctx);
      handler(makeEvent({ type: 'tool', toolKind: 'remove-all' }, 'item-slot-player-0-3-1'));
      expect(player[0].items).toEqual([undefined, undefined, undefined]);
    });

    it('빈 헥스에 drop 하면 아무 변화 없음', () => {
      let player: PlacedUnit[] = [];
      const ctx: ActualDndContext = {
        round: makeRound(player),
        roundIndex: 0,
        updatePlayerTeam: (_i, patch) => { player = patch.units; },
        updateOpponent: () => {},
      };
      const handler = createActualDragEndHandler(() => ctx);
      handler(makeEvent({ type: 'tool', toolKind: 'remove-all' }, 'cell-7-1'));
      expect(player).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

  ```bash
  pnpm test tests/unit/actualData/actualDndHandlers.test.ts
  ```
  Expected: 새로 추가한 5개 케이스 모두 FAIL (슬롯 라우팅/툴 미구현).

- [ ] **Step 3: `createActualDragEndHandler` 내부 라우팅 수정**

  `src/components/actual-data/actualDndHandlers.ts`의 `createActualDragEndHandler` 본체를 아래로 교체 (기존 `parseCellId` 호출부부터 함수 끝까지):

  ```ts
  export function createActualDragEndHandler(ctx: () => ActualDndContext | null) {
    return (event: DragEndEvent) => {
      const context = ctx();
      if (!context) return;
      const { round, roundIndex, updatePlayerTeam, updateOpponent } = context;

      const { active, over } = event;
      const dragData = active.data.current as DragData | undefined;
      if (!dragData) return;

      // Drop outside any cell
      if (!over) {
        if (dragData.type === 'placed-unit') {
          const srcTeam = dragData.team;
          const srcUnits = srcTeam === 'player' ? round.playerTeam.units : round.opponent.units;
          const srcIdx = findUnitIndexAt(srcUnits, dragData.position);
          if (srcIdx < 0) return;
          const nextUnits = srcUnits.filter((_, i) => i !== srcIdx);
          if (srcTeam === 'player') updatePlayerTeam(roundIndex, { units: nextUnits });
          else updateOpponent(roundIndex, { units: nextUnits });
        }
        return;
      }

      // Resolve target: item slot first, then hex cell.
      const slotInfo = parseSlotId(over.id as string);
      const cellInfo = slotInfo ? null : parseCellId(over.id as string);
      if (!slotInfo && !cellInfo) return;

      const destTeam: 'player' | 'enemy' = slotInfo ? slotInfo.team : getTeamFromRow(cellInfo!.row);
      const destHex: HexCoord = slotInfo ? slotInfo.hex : cellToHex(cellInfo!.row, cellInfo!.col);
      const destUnits = destTeam === 'player' ? round.playerTeam.units : round.opponent.units;
      const setDest = (nextUnits: PlacedUnit[]) => {
        if (destTeam === 'player') updatePlayerTeam(roundIndex, { units: nextUnits });
        else updateOpponent(roundIndex, { units: nextUnits });
      };
      const existingDestIdx = findUnitIndexAt(destUnits, destHex);

      // Tool: remove-all — clears all items on the target unit.
      if (dragData.type === 'tool' && dragData.toolKind === 'remove-all') {
        if (existingDestIdx < 0) return;
        const cleared = clearUnitItems(destUnits[existingDestIdx]);
        setDest(destUnits.map((u, i) => (i === existingDestIdx ? cleared : u)));
        return;
      }

      // Champion drop (sidebar → empty hex only). Slot drops are ignored for champion type.
      if (dragData.type === 'champion') {
        if (slotInfo) return;
        if (existingDestIdx >= 0) return;
        const newUnit: PlacedUnit = {
          championId: dragData.champion.apiName,
          hex: destHex,
          starLevel: 2,
          items: [undefined, undefined, undefined],
        };
        setDest([...destUnits, newUnit]);
        return;
      }

      // Placed unit drag — movement only on hex cells, not item slots.
      if (dragData.type === 'placed-unit') {
        if (slotInfo) return;
        const srcTeam = dragData.team;
        const srcUnits = srcTeam === 'player' ? round.playerTeam.units : round.opponent.units;
        const srcIdx = findUnitIndexAt(srcUnits, dragData.position);
        if (srcIdx < 0) return;
        const dragged = srcUnits[srcIdx];

        if (srcTeam !== destTeam) {
          if (existingDestIdx >= 0) return; // no cross-team swap
          const nextSrc = srcUnits.filter((_, i) => i !== srcIdx);
          const nextDest = [...destUnits, { ...dragged, hex: destHex }];
          if (srcTeam === 'player') {
            updatePlayerTeam(roundIndex, { units: nextSrc });
            updateOpponent(roundIndex, { units: nextDest });
          } else {
            updateOpponent(roundIndex, { units: nextSrc });
            updatePlayerTeam(roundIndex, { units: nextDest });
          }
          return;
        }

        // Same-team move / swap
        if (existingDestIdx >= 0 && existingDestIdx !== srcIdx) {
          const nextUnits = destUnits.map((u, i) => {
            if (i === srcIdx) return { ...u, hex: destUnits[existingDestIdx].hex };
            if (i === existingDestIdx) return { ...u, hex: destUnits[srcIdx].hex };
            return u;
          });
          setDest(nextUnits);
        } else if (existingDestIdx < 0) {
          const nextUnits = destUnits.map((u, i) => (i === srcIdx ? { ...u, hex: destHex } : u));
          setDest(nextUnits);
        }
        return;
      }

      // Item drop
      if (dragData.type === 'item') {
        if (existingDestIdx < 0) return;
        const target = destUnits[existingDestIdx];
        if (slotInfo) {
          // Explicit slot → replace or fill that exact slot.
          const updated = setItemAtSlot(target, dragData.item.apiName, slotInfo.slotIdx);
          setDest(destUnits.map((u, i) => (i === existingDestIdx ? updated : u)));
        } else {
          // Hex body → first empty slot (legacy fast-attach).
          const updated = setItemInSlot(target, dragData.item);
          if (!updated) return;
          setDest(destUnits.map((u, i) => (i === existingDestIdx ? updated : u)));
        }
      }
    };
  }
  ```

- [ ] **Step 4: 전체 테스트 통과 확인**

  ```bash
  pnpm test tests/unit/actualData/actualDndHandlers.test.ts
  ```
  Expected: 모든 케이스 PASS.

- [ ] **Step 5: 기존 전체 테스트 회귀 확인**

  ```bash
  pnpm test
  ```
  Expected: 196+신규 케이스 모두 PASS.

- [ ] **Step 6: 커밋**

  ```bash
  git add src/components/actual-data/actualDndHandlers.ts tests/unit/actualData/actualDndHandlers.test.ts
  git commit -m "feat(actual-data): drop 라우팅에 슬롯 교체 + 자석 제거기 툴 분기 추가"
  ```

---

## Task 4: ActualBoard에 슬롯 오버레이 (droppable + X 버튼)

**Files:**
- Modify: `src/components/actual-data/ActualBoard.tsx`

- [ ] **Step 1: 신규 오버레이 서브컴포넌트 파일 만들기**

  `PlacedChampion.items`는 `unitAdapter.toPlacedChampion` 단계에서 `undefined` 슬롯이 drop 되어 slot index 정보가 유실되므로, 오버레이는 **raw `PlacedUnit`** 을 받아야 한다.

  `src/components/actual-data/ActualItemSlotsOverlay.tsx` 파일을 새로 만든다.

  ```tsx
  'use client';

  import { useDroppable } from '@dnd-kit/core';
  import { axialToOffset } from '@/types';
  import { createHexLayout } from '@/components/battle/HexBoard';
  import { BOARD_COLS } from '@/lib/simulator/models/constants';
  import type { PlacedUnit } from '@/lib/actualData/types';

  interface Props {
    playerUnits: PlacedUnit[];
    opponentUnits: PlacedUnit[];
    cellSize: number;
    onRemoveItem: (team: 'player' | 'enemy', hexKey: string, slotIdx: 0 | 1 | 2) => void;
  }

  const SLOT_SIZE = 18; // SetupBoardCore itemSize(16) + 2px padding
  const SLOT_GAP = 2;

  /**
   * Overlays a droppable + click X button on each of the three item slots of every
   * placed unit. Positioned to match SetupBoardCore's SVG item row exactly so the
   * visual icon and the interactive zone overlap.
   */
  export default function ActualItemSlotsOverlay({ playerUnits, opponentUnits, cellSize, onRemoveItem }: Props) {
    const { HEX_R, hexCenter } = createHexLayout(cellSize);
    const entries: Array<{ team: 'player' | 'enemy'; u: PlacedUnit }> = [
      ...opponentUnits.map(u => ({ team: 'enemy' as const, u })),
      ...playerUnits.map(u => ({ team: 'player' as const, u })),
    ];

    return (
      <>
        {entries.map(({ team, u }) => {
          const off = axialToOffset(u.hex);
          const displayRow = team === 'player' ? off.row + 4 : off.row;
          if (displayRow < 0 || displayRow > 7 || off.col < 0 || off.col >= BOARD_COLS) return null;
          const { cx, cy } = hexCenter(displayRow, off.col);
          const totalWidth = 3 * SLOT_SIZE + 2 * SLOT_GAP;
          const startX = cx - totalWidth / 2;
          const yCenter = cy + HEX_R - 12;

          return [0, 1, 2].map((slotIdx) => {
            const slotItemApi = u.items[slotIdx]; // string | null | undefined
            const filled = !!slotItemApi;
            const hexKey = `${u.hex.q},${u.hex.r}`;
            const slotCenterX = startX + slotIdx * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
            return (
              <SlotCell
                key={`${team}-${hexKey}-${slotIdx}`}
                team={team}
                q={u.hex.q}
                r={u.hex.r}
                slotIdx={slotIdx as 0 | 1 | 2}
                cx={slotCenterX}
                cy={yCenter}
                filled={filled}
                onRemove={() => onRemoveItem(team, hexKey, slotIdx as 0 | 1 | 2)}
              />
            );
          });
        })}
      </>
    );
  }

  function SlotCell({ team, q, r, slotIdx, cx, cy, filled, onRemove }: {
    team: 'player' | 'enemy';
    q: number; r: number; slotIdx: 0 | 1 | 2;
    cx: number; cy: number;
    filled: boolean;
    onRemove: () => void;
  }) {
    const id = `item-slot-${team}-${q}-${r}-${slotIdx}`;
    const { isOver, setNodeRef } = useDroppable({ id });

    return (
      <div
        ref={setNodeRef}
        data-slot-id={id}
        style={{
          position: 'absolute',
          left: cx - SLOT_SIZE / 2,
          top: cy - SLOT_SIZE / 2,
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          pointerEvents: 'all',
          // transparent outline that appears when a droppable hover occurs
          outline: isOver ? '1.5px solid #fbbf24' : filled ? 'none' : '1px dashed rgba(156,163,175,0.35)',
          borderRadius: 2,
          boxSizing: 'border-box',
          background: 'transparent',
        }}
        className="group"
      >
        {filled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={`슬롯 ${slotIdx + 1} 제거`}
            className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            ×
          </button>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: ActualBoard 에서 오버레이 사용**

  `src/components/actual-data/ActualBoard.tsx`의 import 블록에 추가:
  ```tsx
  import ActualItemSlotsOverlay from './ActualItemSlotsOverlay';
  import { clearUnitItems as _clear } from './actualDndHandlers'; // unused; remove if imported elsewhere
  ```
  (주: 두 번째 줄은 실제론 필요 없으면 넣지 말 것. clearUnitItems 는 이 파일에서 직접 쓰지 않음.)

  `ActualBoard` 함수 안에 슬롯 제거 핸들러 추가 (기존 `handleRemoveUnit` 바로 아래, 57-67줄 부근):

  ```tsx
  /** Clear a single item slot on a unit at the given hex. */
  const handleRemoveItemSlot = (team: 'player' | 'enemy', hexKey: string, slotIdx: 0 | 1 | 2) => {
    const units = team === 'player' ? round.playerTeam.units : round.opponent.units;
    const unitIdx = units.findIndex(u => `${u.hex.q},${u.hex.r}` === hexKey);
    if (unitIdx < 0) return;
    const target = units[unitIdx];
    const nextItems = [...target.items] as PlacedUnit['items'];
    nextItems[slotIdx] = undefined;
    const nextUnits = units.map((u, i) => (i === unitIdx ? { ...u, items: nextItems } : u));
    if (team === 'player') updatePlayerTeam(roundIndex, { units: nextUnits });
    else updateOpponent(roundIndex, { units: nextUnits });
  };
  ```

  `return (...)` 안 `<SetupBoardCore ... />` 바로 다음, 기존 droppable 오버레이 `<div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>...</div>` 블록 **다음에** 아래 두 번째 오버레이를 추가:

  ```tsx
        {/* Item slot overlay — placed on top so slot droppables win pointer events over the hex cell. */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <ActualItemSlotsOverlay
            playerUnits={round.playerTeam.units}
            opponentUnits={round.opponent.units}
            cellSize={cellSize}
            onRemoveItem={handleRemoveItemSlot}
          />
        </div>
  ```

- [ ] **Step 3: 타입/린트 확인**

  ```bash
  pnpm typecheck && pnpm lint
  ```
  Expected: 에러 없음. `clearUnitItems` 잘못 import 했으면 지우기. `PlacedUnit` import 가 아직 없으면 기존 import 라인에 추가.

- [ ] **Step 4: 개발 서버에서 수동 확인**

  `pnpm dev` 상태에서 브라우저로 `/actual-data/<gameId>` 편집 페이지 열어서:
  - 유닛 아래 3개 슬롯 영역에 (아이템 있을 때) 빨간 × 버튼 hover로 나타나는지
  - × 클릭 시 해당 슬롯만 비워지고 다른 슬롯은 그대로인지

- [ ] **Step 5: 커밋**

  ```bash
  git add src/components/actual-data/ActualItemSlotsOverlay.tsx src/components/actual-data/ActualBoard.tsx
  git commit -m "feat(actual-data): 슬롯 단위 droppable 오버레이 + hover X 제거 버튼"
  ```

---

## Task 5: DndContext collisionDetection 조정

**Files:**
- Modify: `src/components/actual-data/PvPRoundEditor.tsx`

- [ ] **Step 1: collisionDetection 확인**

  현재 `src/components/actual-data/PvPRoundEditor.tsx:79-89`의 `<DndContext>` 에는 `collisionDetection` prop 이 없음 → @dnd-kit 기본 `rectIntersection` 사용. 이 전략은 큰 헥스 droppable 이 작은 슬롯 droppable 을 덮을 때 헥스를 이기게 해서 슬롯 drop 이 잘 안 걸림.

- [ ] **Step 2: `pointerWithin` → `rectIntersection` fallback 적용**

  `src/components/actual-data/PvPRoundEditor.tsx` import 블록에서 `@dnd-kit/core` 라인에 아래 2개 추가 import:
  ```tsx
  import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core';
  ```

  컴포넌트 함수 안(예: `const sensors = useSensors(...)` 아래)에 collision detection 함수 정의:

  ```tsx
  // pointerWithin 으로 작은 슬롯 drop 을 우선 매칭하고, 포인터가 헥스 밖으로 살짝 벗어나면
  // rectIntersection 으로 fallback 해 기존 헥스 본체 drop 을 잃지 않는다.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) return pointerHits;
    return rectIntersection(args);
  };
  ```

  `<DndContext sensors={sensors} ...>` 에 prop 추가:
  ```tsx
  <DndContext
    sensors={sensors}
    collisionDetection={collisionDetection}
    onDragStart={...}
    ...
  ```

- [ ] **Step 3: 타입체크 + 기존 유닛 드래그 회귀 없는지 수동 확인**

  ```bash
  pnpm typecheck
  ```
  수동: `pnpm dev`에서 유닛 드래그 이동 / 아이템 드래그로 빈 헥스 본체에 드롭 / 슬롯 위 드롭 모두 정상 동작.

- [ ] **Step 4: 커밋**

  ```bash
  git add src/components/actual-data/PvPRoundEditor.tsx
  git commit -m "feat(actual-data): DndContext collisionDetection을 pointerWithin+fallback으로 교체 (슬롯 drop 우선)"
  ```

---

## Task 6: 사이드바 "도구" 탭 + 자석 제거기 드래그 소스

**Files:**
- Create: `src/components/actual-data/DraggableItemRemoverTool.tsx`
- Modify: `src/components/actual-data/ChampionItemSidebar.tsx`

- [ ] **Step 1: 드래그 가능한 툴 컴포넌트 생성**

  `src/components/actual-data/DraggableItemRemoverTool.tsx` 파일 새로 만든다:
  ```tsx
  'use client';

  import { useDraggable } from '@dnd-kit/core';
  import type { DragData } from '@/types';

  const ICON_SRC = '/data/images/items/tft_consumable_itemremover.tft_set13.png';

  /**
   * Drag source for the "자석 제거기" tool. Drop onto a placed unit (hex or slot)
   * clears all three item slots via the `{ type: 'tool', toolKind: 'remove-all' }`
   * branch in createActualDragEndHandler.
   */
  export default function DraggableItemRemoverTool({ size = 44 }: { size?: number }) {
    const data: DragData = { type: 'tool', toolKind: 'remove-all' };
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: 'tool-remove-all',
      data,
    });

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={{ width: size, height: size, opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
        className="relative cursor-grab active:cursor-grabbing rounded border border-gray-700 bg-[#1f2937] hover:border-red-500 hover:bg-red-900/30 transition-colors flex items-center justify-center overflow-hidden"
        title="자석 제거기 — 유닛 위에 드롭하면 아이템 3칸 모두 제거"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ICON_SRC} alt="자석 제거기" width={size - 4} height={size - 4} draggable={false} />
      </div>
    );
  }
  ```

- [ ] **Step 2: 사이드바에 "도구" 탭 추가**

  `src/components/actual-data/ChampionItemSidebar.tsx` 상단 타입 라인 수정:
  ```tsx
  type Tab = 'champions' | 'items' | 'tools';
  ```

  import 추가:
  ```tsx
  import DraggableItemRemoverTool from './DraggableItemRemoverTool';
  ```

  탭 버튼 그룹(33-49줄)에 "도구" 버튼 한 개 추가 (아이템 버튼 뒤에):
  ```tsx
  <button
    type="button"
    className={`px-2 py-1 rounded ${tab === 'tools' ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
    onClick={() => setTab('tools')}
  >
    도구
  </button>
  ```

  섹션 렌더 블록(52-56줄)을 다음으로 교체:
  ```tsx
  <div className="flex-1 overflow-hidden">
    {tab === 'champions' && <ChampionSection champions={champions} onChampionClick={onChampionClick} />}
    {tab === 'items' && <ItemSection items={items} onItemClick={onItemClick} />}
    {tab === 'tools' && <ToolsSection />}
  </div>
  ```

  파일 맨 아래(혹은 `ItemSection` 정의 아래)에 `ToolsSection` 추가:
  ```tsx
  function ToolsSection() {
    return (
      <div className="flex flex-col h-full p-2 space-y-3">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          유닛 위로 드래그해서 사용합니다.
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          <DraggableItemRemoverTool size={44} />
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: 린트 + 타입체크**

  ```bash
  pnpm lint && pnpm typecheck
  ```
  Expected: 에러 없음. `<img>` 관련 `@next/next/no-img-element` 경고는 이미 전역적으로 존재하는 수준. 신규 파일도 동일한 inline disable 처리(이미 포함).

- [ ] **Step 4: 수동 확인**

  브라우저에서 사이드바 "도구" 탭 클릭 → 자석 제거기 아이콘 보임 → 드래그해서 유닛 위에 드롭 → 3칸 모두 비워지는지.

- [ ] **Step 5: 커밋**

  ```bash
  git add src/components/actual-data/DraggableItemRemoverTool.tsx src/components/actual-data/ChampionItemSidebar.tsx
  git commit -m "feat(actual-data): 사이드바 '도구' 탭 + 자석 제거기 드래그 소스"
  ```

---

## Task 7: 전체 검증 + 최종 커밋

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 빌드/테스트 스위트 실행**

  ```bash
  pnpm lint && pnpm typecheck && pnpm build && pnpm test
  ```
  Expected: lint 0 errors (사전 존재 warning 유지), typecheck 통과, build 성공, test 전부 PASS.

- [ ] **Step 2: 수동 회귀 체크리스트**

  `pnpm dev` 상태에서 `/actual-data/<gameId>` 열고 모든 인터랙션 1회씩 확인:
  - [ ] 유닛 슬롯(채워진 것) hover → × 버튼 노출
  - [ ] × 클릭 → 해당 슬롯만 비워지고 다른 슬롯은 그대로 (재정렬 없음)
  - [ ] 아이템 사이드바에서 드래그 → 채워진 슬롯 위에 drop → 교체
  - [ ] 아이템 드래그 → 빈 슬롯 위에 drop → 해당 슬롯 채움
  - [ ] 아이템 드래그 → 챔프 아이콘(슬롯 바깥) 위에 drop → 첫 빈 슬롯 자동 채움 (기존 UX)
  - [ ] 아이템 3칸 다 찬 유닛의 챔프 아이콘 위에 drop → 변화 없음
  - [ ] 자석 제거기 드래그 → 유닛 위 drop → 3칸 전부 undefined
  - [ ] 자석 제거기 드래그 → 빈 헥스 drop → 변화 없음
  - [ ] 플레이어팀과 상대팀 모두 동일하게 작동
  - [ ] 유닛 자체 드래그 이동 / 삭제 등 기존 UX 회귀 없음
  - [ ] 저장(수동 또는 자동) 후 새로고침 → 슬롯 상태 유지

- [ ] **Step 3: 문제 없으면 체크리스트 통과 커밋 불필요 (이전 단계 커밋으로 완결)**

  체크리스트가 전부 OK 면 최종 PR/머지 단계로. 실패 항목 있으면 해당 Task 로 돌아가 수정 후 재검증.

---

## 참고

- 공식 spec: `docs/superpowers/specs/2026-04-24-item-edit-ux-design.md`
- 기반 브랜치: `dev` (PR #10 머지로 영상 업로드 기능 포함됨)
- 새 작업은 새로운 feature 브랜치(예: `feature/item-edit-ux`)에서 시작 권장
- 테스트 원칙: drop handler 같은 순수 로직은 vitest 단위 테스트, DnD/UI 상호작용은 수동 체크리스트
