'use client';

import { useDraggable } from '@dnd-kit/core';
import { RawItem, DragData } from '@/types';
import ItemIcon from './ItemIcon';

interface DraggableItemIconProps {
  item: RawItem;
  size?: number;
}

export default function DraggableItemIcon({ item, size = 36 }: DraggableItemIconProps) {
  const dragData: DragData = { type: 'item', item };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-item-${item.apiName}`,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
    >
      <ItemIcon item={item} size={size} />
    </div>
  );
}
