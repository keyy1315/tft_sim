'use client';

import { useDraggable, useDndContext } from '@dnd-kit/core';
import { RawChampion, DragData } from '@/types';
import ChampionCard from './ChampionCard';

interface DraggableChampionCardProps {
  champion: RawChampion;
  size?: number;
}

export default function DraggableChampionCard({ champion, size = 56 }: DraggableChampionCardProps) {
  const dragData: DragData = { type: 'champion', champion };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-champ-${champion.apiName}`,
    data: dragData,
  });
  const { active } = useDndContext();
  const anyDragging = active !== null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
    >
      <ChampionCard champion={champion} size={size} tooltipDisabled={anyDragging} />
    </div>
  );
}
