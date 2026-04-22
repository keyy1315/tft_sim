import { useState } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { PlacedChampion, HexCoord, axialToOffset, DragData, RawItem } from '@/types';
import { DEFAULT_STAR_LEVEL } from '@/lib/simulator/models/constants';
import { getTeamFromRow, parseCellId } from '@/hooks/useTeamManagement';

interface UseDndHandlersArgs {
  playerTeam: PlacedChampion[];
  enemyTeam: PlacedChampion[];
  updatePlayerTeam: (action: PlacedChampion[] | ((prev: PlacedChampion[]) => PlacedChampion[])) => void;
  updateEnemyTeam: (action: PlacedChampion[] | ((prev: PlacedChampion[]) => PlacedChampion[])) => void;
  handleEquipItem: (team: 'player' | 'enemy', index: number, item: RawItem) => void;
  onChampionPlaced?: (team: 'player' | 'enemy', index: number, champion: PlacedChampion['champion']) => void;
}

export function useDndHandlers({
  playerTeam,
  enemyTeam,
  updatePlayerTeam,
  updateEnemyTeam,
  handleEquipItem,
  onChampionPlaced,
}: UseDndHandlersArgs) {
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) setActiveDragData(data);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragData(null);
    const { active, over } = event;
    const dragData = active.data.current as DragData | undefined;
    if (!dragData) return;

    // 보드 밖으로 drop → placed-unit 이면 해당 유닛을 팀에서 제거.
    // (모바일/태블릿에서 보드 위 유닛 터치 후 바깥으로 드래그하여 삭제하는 UX)
    if (!over) {
      if (dragData.type === 'placed-unit') {
        const team = dragData.team;
        const teamArr = team === 'player' ? playerTeam : enemyTeam;
        const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
        const srcOff = axialToOffset(dragData.position);
        const srcIdx = teamArr.findIndex(p => {
          const off = axialToOffset(p.position);
          return off.row === srcOff.row && off.col === srcOff.col;
        });
        if (srcIdx >= 0) {
          setTeam(prev => prev.filter((_, i) => i !== srcIdx));
        }
      }
      return;
    }

    const cellInfo = parseCellId(over.id as string);
    if (!cellInfo) return;

    const { row, col } = cellInfo;
    const team = getTeamFromRow(row);
    const dataRow = team === 'player' ? row - 4 : row;
    const pos: HexCoord = { q: col - Math.floor(dataRow / 2), r: dataRow };
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;

    const existingIdx = teamArr.findIndex(p => {
      const off = axialToOffset(p.position);
      return off.row === dataRow && off.col === col;
    });

    if (dragData.type === 'champion') {
      if (existingIdx >= 0) return;
      const isMf = dragData.champion.apiName === 'TFT17_MissFortune';
      const newIndex = teamArr.length;
      setTeam(prev => [...prev, {
        champion: dragData.champion,
        position: pos,
        starLevel: DEFAULT_STAR_LEVEL,
        items: [],
        ...(isMf ? { mfMode: null } : {}),
      }]);
      if (onChampionPlaced) onChampionPlaced(team, newIndex, dragData.champion);
    } else if (dragData.type === 'placed-unit') {
      if (dragData.team !== team) return;
      const srcIdx = teamArr.findIndex(p => {
        const off = axialToOffset(p.position);
        const srcOff = axialToOffset(dragData.position);
        return off.row === srcOff.row && off.col === srcOff.col;
      });
      if (srcIdx < 0) return;

      if (existingIdx >= 0 && existingIdx !== srcIdx) {
        setTeam(prev => prev.map((p, i) => {
          if (i === srcIdx) return { ...p, position: prev[existingIdx].position };
          if (i === existingIdx) return { ...p, position: prev[srcIdx].position };
          return p;
        }));
      } else if (existingIdx < 0) {
        setTeam(prev => prev.map((p, i) => {
          if (i === srcIdx) return { ...p, position: pos };
          return p;
        }));
      }
    } else if (dragData.type === 'item') {
      if (existingIdx < 0) return;
      handleEquipItem(team, existingIdx, dragData.item);
    }
  };

  return {
    activeDragData,
    handleDragStart,
    handleDragEnd,
  };
}
