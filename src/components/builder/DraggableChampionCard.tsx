'use client';

import { useDraggable, useDndContext } from '@dnd-kit/core';
import { RawChampion, DragData } from '@/types';
import ChampionCard from './ChampionCard';

interface DraggableChampionCardProps {
  champion: RawChampion;
  size?: number;
  /**
   * 클릭 (드래그 없음) 시 호출. dnd-kit activationConstraint (8px) 를 넘지 않은 포인터업 은
   * 드래그로 간주되지 않고 normal click 이벤트가 발생하므로 여기서 onClick 을 처리해도 안전.
   */
  onClick?: (champion: RawChampion) => void;
}

export default function DraggableChampionCard({ champion, size = 56, onClick }: DraggableChampionCardProps) {
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
      onClick={onClick ? () => onClick(champion) : undefined}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'none', cursor: onClick ? 'pointer' : undefined }}
    >
      <ChampionCard champion={champion} size={size} tooltipDisabled={anyDragging} />
    </div>
  );
}
