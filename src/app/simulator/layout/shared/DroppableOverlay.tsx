'use client';

import { MouseEvent, useState } from 'react';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { axialToOffset, offsetToAxial, HexCoord } from '@/types';
// 강화 칸 표시 매핑 (PR10):
//  - A팀 (player, 화면 아래): display.row = 4 + pattern.row, display.col = pattern.col
//  - B팀 (enemy,  화면 위):    display = 보드 중심 180° 회전 = (3 - pattern.row, BOARD_COLS-1 - pattern.col)
// 사용자 입력 좌표(예: 산 A팀 7.0, 7.1, ..., 4.5) 기준 명시적 매핑.
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import { createHexLayout, DEFAULT_HEX_R } from '@/components/battle/HexBoard';
import { formatStargazerEffectSummary } from '@/lib/actualData/stargazerMapping';
import type { StargazerConstellationId } from '@/lib/actualData/types';
import type { SimulatorLayoutProps } from '../types';

interface DroppableOverlayProps {
  tm: SimulatorLayoutProps['tm'];
  hexBuffs: SimulatorLayoutProps['hexBuffs'];
  setHoverUnit: SimulatorLayoutProps['setHoverUnit'];
  /** undefined 시 DEFAULT_HEX_R 사용 (Desktop 기본값). */
  cellSize?: number;
  onUnitClick: (team: 'player' | 'enemy', index: number) => void;
  /** movable hexBuff 이동 모드 활성화 시 호출 (모바일에서 sheet peek 용) */
  onMovableActivate?: () => void;
  /** A 팀 강화 칸 (data row 0-3 axial). 표시는 보드 r=7-data_r mirror. */
  playerStargazerTiles?: ReadonlyArray<HexCoord>;
  /** B 팀 강화 칸 (그대로 표시). */
  enemyStargazerTiles?: ReadonlyArray<HexCoord>;
  playerStargazerConstellation?: StargazerConstellationId | null;
  enemyStargazerConstellation?: StargazerConstellationId | null;
  playerStargazerInfo?: { effectVariables: Record<string, number | null | undefined> | null; count: number };
  enemyStargazerInfo?: { effectVariables: Record<string, number | null | undefined> | null; count: number };
}

/**
 * 공용 Droppable overlay — 8×BOARD_COLS 의 투명 drop zone 을 보드 위에 배치.
 * 모바일/태블릿/데스크톱 레이아웃에서 재사용.
 */
export default function DroppableOverlay({
  tm, hexBuffs, setHoverUnit, cellSize = DEFAULT_HEX_R, onUnitClick, onMovableActivate,
  playerStargazerTiles = [], enemyStargazerTiles = [],
  playerStargazerConstellation, enemyStargazerConstellation,
  playerStargazerInfo, enemyStargazerInfo,
}: DroppableOverlayProps) {
  const { playerTeam, enemyTeam } = tm;
  const { player: playerHexBuffs, enemy: enemyHexBuffs, moving, setMoving, setOverrides } = hexBuffs;

  // 강화 칸 zoneKey 별 팀 매핑 (PR10 — display 매핑 변경, 위 주석 참조).
  const playerStargazerTileSet = new Set<string>();
  const enemyStargazerTileSet = new Set<string>();
  for (const t of playerStargazerTiles) {
    const off = axialToOffset(t);
    playerStargazerTileSet.add(`${4 + off.row}-${off.col}`);
  }
  for (const t of enemyStargazerTiles) {
    const off = axialToOffset(t);
    enemyStargazerTileSet.add(`${3 - off.row}-${BOARD_COLS - 1 - off.col}`);
  }

  // hover 강화 칸 — tooltip 표시용. cell pixel center (cx, cy) + team 보관.
  const [hoverStargazer, setHoverStargazer] = useState<{ zoneKey: string; team: 'player' | 'enemy'; cx: number; cy: number } | null>(null);
  const { hexCenter, HEX_R } = createHexLayout(cellSize);

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
          const zoneKey = `${row}-${col}`;
          const isPlayerStargazer = playerStargazerTileSet.has(zoneKey);
          const isEnemyStargazer = enemyStargazerTileSet.has(zoneKey);
          const isStargazerTile = isPlayerStargazer || isEnemyStargazer;

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
              onMovableActivate?.();
              return;
            }
            if (placed && placedIdx >= 0) onUnitClick(team, placedIdx);
            else tm.handleCellClick(offsetToAxial({ row: dataRow, col }), team);
          };

          const cellContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            if (placed && placedIdx >= 0) tm.handleRemoveUnit(team, placedIdx);
          };

          // hover 핸들러 우선순위: placed unit > stargazer tile > 없음.
          // 두 개 동시 활성 시 placed unit detail 우선 (기존 동작 유지).
          const onMouseEnterHandler =
            placed
              ? (rect: DOMRect) => setHoverUnit({ placed, rect })
              : isStargazerTile
                ? () => {
                    const { cx, cy } = hexCenter(row, col);
                    setHoverStargazer({
                      zoneKey,
                      team: isPlayerStargazer ? 'player' : 'enemy',
                      cx, cy,
                    });
                  }
                : undefined;
          // mouseLeave 는 항상 두 hover state 모두 정리 — unit 제거/이동 후 cell 이 empty 로
          // 재렌더되면 placed 가 false 라도 hoverUnit 이 stale 이므로 무조건 clear (codex P2 회귀 가드).
          const onMouseLeaveHandler = () => {
            setHoverUnit(null);
            setHoverStargazer((prev) => (prev?.zoneKey === zoneKey ? null : prev));
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
              onMouseEnter={onMouseEnterHandler}
              onMouseLeave={onMouseLeaveHandler}
              cellSize={cellSize}
            />
          );
        })
      )}
      {/* 강화 칸 hover tooltip — DnD overlay 가 SVG 위에 있어 SVG hover 가 안 닿으므로 여기서 처리 */}
      {hoverStargazer && (() => {
        const constellation = hoverStargazer.team === 'player'
          ? playerStargazerConstellation
          : enemyStargazerConstellation;
        if (!constellation) return null;
        const info = hoverStargazer.team === 'player' ? playerStargazerInfo : enemyStargazerInfo;
        const summary = formatStargazerEffectSummary(
          constellation,
          info?.effectVariables ?? null,
          info?.count ?? 0,
        );
        const ttWidth = 240;
        let ttLeft = hoverStargazer.cx - ttWidth / 2;
        let ttTop = hoverStargazer.cy - HEX_R - 140;
        if (ttLeft < 4) ttLeft = 4;
        if (ttTop < 4) ttTop = hoverStargazer.cy + HEX_R + 6;
        return (
          <div
            style={{
              position: 'absolute',
              left: ttLeft,
              top: ttTop,
              width: ttWidth,
              background: 'rgba(15,23,42,0.96)',
              border: '1px solid #A855F7',
              borderRadius: 6,
              padding: '6px 8px',
              color: '#e5e7eb',
              fontSize: 11,
              lineHeight: 1.4,
              whiteSpace: 'pre-line',
              fontFamily: 'system-ui, sans-serif',
              pointerEvents: 'none',
              zIndex: 50,
            }}
          >
            {summary}
          </div>
        );
      })()}
    </div>
  );
}
