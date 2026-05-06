'use client';

import { useDraggable } from '@dnd-kit/core';
import type { DragData } from '@/types';

const ICON_SRC = '/data/images/items/tft17_drxselector.tft_set17.png';

/**
 * Drag source for the N.O.V.A. "타격 선택기" tool. Drop onto a NOVA unit
 * (Aatrox/Caitlyn/Akali/Maokai/Kindred) to set its `novaStrikeSelector` flag.
 * Same-team single-instance enforced by `createActualDragEndHandler`.
 */
export default function DraggableNovaSelectorTool({ size = 44 }: { size?: number }) {
  const data: DragData = { type: 'tool', toolKind: 'nova-selector' };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'tool-nova-selector',
    data,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ width: size, height: size, opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
      className="relative cursor-grab active:cursor-grabbing rounded border border-gray-700 bg-[#1f2937] hover:border-cyan-500 hover:bg-cyan-900/30 transition-colors flex items-center justify-center overflow-hidden"
      title="타격 선택기 — N.O.V.A. 유닛(아트록스/케이틀린/아칼리/마오카이/킨드레드)에 드롭하면 타격 효과 적용"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ICON_SRC} alt="타격 선택기" width={size - 4} height={size - 4} draggable={false} />
    </div>
  );
}
