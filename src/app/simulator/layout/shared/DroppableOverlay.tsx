'use client';

import { MouseEvent } from 'react';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { axialToOffset, offsetToAxial } from '@/types';
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import type { SimulatorLayoutProps } from '../types';

interface DroppableOverlayProps {
  tm: SimulatorLayoutProps['tm'];
  hexBuffs: SimulatorLayoutProps['hexBuffs'];
  setHoverUnit: SimulatorLayoutProps['setHoverUnit'];
  cellSize: number;
  onUnitClick: (team: 'player' | 'enemy', index: number) => void;
}

/**
 * 공용 Droppable overlay — 8×BOARD_COLS 의 투명 drop zone 을 보드 위에 배치.
 * 모바일/태블릿/데스크톱 레이아웃에서 재사용.
 */
export default function DroppableOverlay({
  tm, hexBuffs, setHoverUnit, cellSize, onUnitClick,
}: DroppableOverlayProps) {
  const { playerTeam, enemyTeam } = tm;
  const { player: playerHexBuffs, enemy: enemyHexBuffs, moving, setMoving, setOverrides } = hexBuffs;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: BOARD_COLS }, (_, col) => {
          const team = row < 4 ? 'enemy' : 'player';
          const teamArr = team === 'player' ? playerTeam : enemyTeam;
          const dataRow = team === 'player' ? row - 4 : row;
          const placedIdx = teamArr.findIndex(p => {
            const off = axialToOffset(p.position);
            return off.row === dataRow && off.col === col;
          });
          const placed = placedIdx >= 0 ? teamArr[placedIdx] : null;

          const cellClick = () => {
            if (moving) {
              const pos = offsetToAxial({ row: dataRow, col });
              setOverrides(prev => ({
                ...prev,
                [moving.team]: { ...prev[moving.team], [moving.apiName]: pos },
              }));
              setMoving(null);
              return;
            }
            const buffs = team === 'player' ? playerHexBuffs : enemyHexBuffs;
            const movableBuff = buffs.find(b => b.movable && b.positions.some(p => {
              const off = axialToOffset(p);
              return off.row === dataRow && off.col === col;
            }));
            if (movableBuff && !placed) {
              setMoving({ team, apiName: movableBuff.augmentApiName });
              return;
            }
            if (placed && placedIdx >= 0) onUnitClick(team, placedIdx);
            else tm.handleCellClick(offsetToAxial({ row: dataRow, col }), team);
          };

          const cellContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            if (placed && placedIdx >= 0) tm.handleRemoveUnit(team, placedIdx);
          };

          return (
            <DroppableHexCell
              key={`cell-${row}-${col}`}
              id={`cell-${row}-${col}`}
              row={row}
              col={col}
              placedUnit={placed ? { team, position: placed.position } : null}
              onClick={cellClick}
              onContextMenu={cellContextMenu}
              onMouseEnter={placed ? (rect) => setHoverUnit({ placed, rect }) : undefined}
              onMouseLeave={() => setHoverUnit(null)}
              cellSize={cellSize}
            />
          );
        })
      )}
    </div>
  );
}
