'use client';

import { useDroppable, useDraggable } from '@dnd-kit/core';
import { hexCenter, HEX_R } from './HexBoard';
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
}

export default function DroppableHexCell({ id, row, col, placedUnit, onClick, onDoubleClick, onContextMenu, onMouseEnter, onMouseLeave }: DroppableHexCellProps) {
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
