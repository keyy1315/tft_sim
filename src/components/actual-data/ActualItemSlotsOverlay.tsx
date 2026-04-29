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
