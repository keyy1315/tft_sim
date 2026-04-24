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
