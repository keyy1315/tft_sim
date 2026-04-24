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

    const cellInfo = parseCellId(over.id as string);
    if (!cellInfo) return;
    const destTeam = getTeamFromRow(cellInfo.row);
    const destHex = cellToHex(cellInfo.row, cellInfo.col);
    const destUnits = destTeam === 'player' ? round.playerTeam.units : round.opponent.units;
    const setDest = (nextUnits: PlacedUnit[]) => {
      if (destTeam === 'player') updatePlayerTeam(roundIndex, { units: nextUnits });
      else updateOpponent(roundIndex, { units: nextUnits });
    };
    const existingDestIdx = findUnitIndexAt(destUnits, destHex);

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
        const nextUnits = destUnits.map((u, i) => i === srcIdx ? { ...u, hex: destHex } : u);
        setDest(nextUnits);
      }
      return;
    }

    if (dragData.type === 'item') {
      if (existingDestIdx < 0) return;
      const target = destUnits[existingDestIdx];
      const updated = setItemInSlot(target, dragData.item);
      if (!updated) return;
      setDest(destUnits.map((u, i) => i === existingDestIdx ? updated : u));
    }
  };
}
