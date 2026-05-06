import type { DragEndEvent } from '@dnd-kit/core';
import type { DragData, HexCoord, RawItem } from '@/types';
import type { PlacedUnit, PvPRound } from '@/lib/actualData/types';

/** Match the cell id scheme used by /simulator overlay (`cell-${row}-${col}`). */
function parseCellId(id: string): { row: number; col: number } | null {
  const match = id.match(/^cell-(\d+)-(\d+)$/);
  if (!match) return null;
  return { row: parseInt(match[1], 10), col: parseInt(match[2], 10) };
}

function getTeamFromRow(row: number): 'player' | 'enemy' {
  return row < 4 ? 'enemy' : 'player';
}

/** Convert display (row,col) → data HexCoord (axial). Player rows 4-7 are flipped to dataRow 0-3. */
function cellToHex(row: number, col: number): HexCoord {
  const team = getTeamFromRow(row);
  const dataRow = team === 'player' ? row - 4 : row;
  return { q: col - Math.floor(dataRow / 2), r: dataRow };
}

function hexKey(h: HexCoord): string {
  return `${h.q},${h.r}`;
}

function findUnitIndexAt(units: PlacedUnit[], hex: HexCoord): number {
  const key = hexKey(hex);
  return units.findIndex(u => hexKey(u.hex) === key);
}

function setItemInSlot(u: PlacedUnit, item: RawItem): PlacedUnit | null {
  const next = [...u.items] as PlacedUnit['items'];
  for (let i = 0; i < 3; i++) {
    if (!next[i]) {
      next[i] = item.apiName;
      return { ...u, items: next };
    }
  }
  return null; // max 3 items
}

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

/**
 * N.O.V.A. (DRX) "타격 선택기" 가 적용 가능한 NOVA 5종 챔피언 apiName.
 * combatLoop 의 NOVA_APIS 와 일치 — 다섯 명 중 한 명에게만 동시 적용 (팀 단일성).
 */
const NOVA_SELECTOR_TARGETS: ReadonlySet<string> = new Set([
  'TFT17_Aatrox',
  'TFT17_Caitlyn',
  'TFT17_Akali',
  'TFT17_Maokai',
  'TFT17_Kindred',
]);

/**
 * 같은 팀 내에서 NOVA 타격 선택기는 단일 unit 에만 부여 가능.
 * 기존 보유자가 있으면 false 로 해제하고 target 에 true 를 부여한 새 배열을 반환한다.
 * target 이 NOVA 5종이 아니면 null 반환 (호출 측에서 무시).
 */
function applyNovaStrikeSelector(units: PlacedUnit[], targetIdx: number): PlacedUnit[] | null {
  const target = units[targetIdx];
  if (!target || !NOVA_SELECTOR_TARGETS.has(target.championId)) return null;
  return units.map((u, i) => {
    if (i === targetIdx) return { ...u, novaStrikeSelector: true };
    if (u.novaStrikeSelector) return { ...u, novaStrikeSelector: false };
    return u;
  });
}

export interface ActualDndContext {
  round: PvPRound;
  roundIndex: number;
  updatePlayerTeam: (index: number, patch: { units: PlacedUnit[] }) => void;
  updateOpponent: (index: number, patch: { units: PlacedUnit[] }) => void;
}

/**
 * Build a DragEnd handler tailored to the actual-data PvP round shape.
 *
 * Supports:
 *  - 'champion' dragged from sidebar → add PlacedUnit on target hex (2★ default)
 *  - 'placed-unit' move within / across teams → translate position, keep items & star
 *  - 'item' dragged onto occupied hex → append to first empty slot (max 3)
 *  - drop-outside on 'placed-unit' → remove the unit
 */
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

    // Tool: nova-selector — assign the NOVA 타격 선택기 flag to the target NOVA unit.
    // Non-NOVA targets are ignored. Same-team single-instance enforced.
    if (dragData.type === 'tool' && dragData.toolKind === 'nova-selector') {
      if (existingDestIdx < 0) return;
      const next = applyNovaStrikeSelector(destUnits, existingDestIdx);
      if (!next) return;
      setDest(next);
      return;
    }

    // Champion drop (sidebar → empty hex only). Slot id resolves to its parent hex via destHex.
    if (dragData.type === 'champion') {
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

    // Placed unit drag — slot id resolves to its parent hex via destHex (supports drops onto
    // the lower item-row region of another occupied hex under pointerWithin collision detection).
    if (dragData.type === 'placed-unit') {
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
