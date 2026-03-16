'use client';

import { PlacedChampion, HexCoord, axialToOffset, offsetToAxial, COST_COLORS } from '@/types';
import { getChampionImage, getItemImage } from '@/data/imageMap';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { hexPoints, hexCenter, HEX_R, HEX_W, HEX_H, PAD } from './HexBoard';

interface SetupBoardProps {
  playerChampions: PlacedChampion[];
  enemyChampions: PlacedChampion[];
  onCellClick: (pos: HexCoord, team: 'player' | 'enemy') => void;
  onUnitClick: (team: 'player' | 'enemy', index: number) => void;
  onUnitRightClick?: (team: 'player' | 'enemy', index: number) => void;
  onUnitCycleStars?: (team: 'player' | 'enemy', index: number) => void;
  selectedCell?: HexCoord | null;
  selectedUnit?: { team: 'player' | 'enemy'; index: number } | null;
}

const ROWS = 8;

function getTeamFromRow(row: number): 'player' | 'enemy' {
  return row < 4 ? 'enemy' : 'player';
}

/** 헥스 인접 6칸 (offset 좌표 기준) */
function getHexNeighbors(row: number, col: number): { r: number; c: number }[] {
  const isOdd = row % 2 === 1;
  if (isOdd) {
    return [
      { r: row - 1, c: col }, { r: row - 1, c: col + 1 },
      { r: row, c: col - 1 }, { r: row, c: col + 1 },
      { r: row + 1, c: col }, { r: row + 1, c: col + 1 },
    ];
  }
  return [
    { r: row - 1, c: col - 1 }, { r: row - 1, c: col },
    { r: row, c: col - 1 }, { r: row, c: col + 1 },
    { r: row + 1, c: col - 1 }, { r: row + 1, c: col },
  ];
}

/** 프렐요드 포탑 효과 범위 — 인접 6칸 + 위 3칸 + 아래 3칸, 같은 팀 진영만 */
function getTurretEffectZones(
  playerChampions: PlacedChampion[],
  enemyChampions: PlacedChampion[],
): { front: Set<string>; back: Set<string> } {
  const front = new Set<string>();
  const back = new Set<string>();

  const allChamps = [
    ...playerChampions.map(p => ({ ...p, displayRow: axialToOffset(p.position).row + 4, displayCol: axialToOffset(p.position).col })),
    ...enemyChampions.map(p => ({ ...p, displayRow: axialToOffset(p.position).row, displayCol: axialToOffset(p.position).col })),
  ];

  const turrets = allChamps.filter(p => p.champion.apiName === 'TFT16_FreljordTurret');

  for (const turret of turrets) {
    const tRow = turret.displayRow;
    const tCol = turret.displayCol;
    const isPlayerTurret = tRow >= 4;
    // 같은 팀 진영 범위
    const teamMinRow = isPlayerTurret ? 4 : 0;
    const teamMaxRow = isPlayerTurret ? 7 : 3;

    // 1) 인접 6칸
    const neighbors = getHexNeighbors(tRow, tCol);
    for (const n of neighbors) {
      if (n.r < teamMinRow || n.r > teamMaxRow || n.c < 0 || n.c >= BOARD_COLS) continue;
      const key = `${n.r}-${n.c}`;
      if (isPlayerTurret) {
        if (n.r <= tRow) front.add(key); else back.add(key);
      } else {
        if (n.r >= tRow) front.add(key); else back.add(key);
      }
    }

    // 2) 인접 6칸 중 위쪽 행의 인접 → 위로 확장 3칸
    const upperNeighbors = neighbors.filter(n => n.r < tRow);
    for (const un of upperNeighbors) {
      const ext = getHexNeighbors(un.r, un.c);
      for (const e of ext) {
        if (e.r >= tRow || e.r < teamMinRow || e.c < 0 || e.c >= BOARD_COLS) continue;
        const key = `${e.r}-${e.c}`;
        if (isPlayerTurret) front.add(key); else back.add(key);
      }
    }

    // 3) 인접 6칸 중 아래쪽 행의 인접 → 아래로 확장 3칸
    const lowerNeighbors = neighbors.filter(n => n.r > tRow);
    for (const ln of lowerNeighbors) {
      const ext = getHexNeighbors(ln.r, ln.c);
      for (const e of ext) {
        if (e.r <= tRow || e.r > teamMaxRow || e.c < 0 || e.c >= BOARD_COLS) continue;
        const key = `${e.r}-${e.c}`;
        if (isPlayerTurret) back.add(key); else front.add(key);
      }
    }
  }

  return { front, back };
}

export default function SetupBoard({
  playerChampions,
  enemyChampions,
  onCellClick,
  onUnitClick,
  onUnitRightClick,
  onUnitCycleStars,
  selectedCell,
  selectedUnit,
}: SetupBoardProps) {
  const cols = BOARD_COLS;
  const width = cols * (HEX_W + PAD) + HEX_W / 2 + 40;
  const height = ROWS * (HEX_H * 0.75 + PAD) + HEX_R + 40;

  // 프렐요드 포탑 효과 범위
  const turretZones = getTurretEffectZones(playerChampions, enemyChampions);

  const selectedOffset = selectedCell ? axialToOffset(selectedCell) : null;

  // Player champions are placed at row 4-7 (offset row), enemy at 0-3
  const getPlacedAt = (row: number, col: number): { placed: PlacedChampion; team: 'player' | 'enemy'; index: number } | null => {
    const team = getTeamFromRow(row);
    const champions = team === 'player' ? playerChampions : enemyChampions;
    for (let i = 0; i < champions.length; i++) {
      const off = axialToOffset(champions[i].position);
      // Player positions stored as row 0-3 in data, displayed at row 4-7
      const displayRow = team === 'player' ? off.row + 4 : off.row;
      if (displayRow === row && off.col === col) {
        return { placed: champions[i], team, index: i };
      }
    }
    return null;
  };

  const isSelected = (row: number, col: number) =>
    selectedOffset?.row === row && selectedOffset?.col === col;

  const isUnitSelected = (team: 'player' | 'enemy', index: number) =>
    selectedUnit?.team === team && selectedUnit?.index === index;

  // Build pattern defs for all placed champions
  const allPlacements: { row: number; col: number; champion: PlacedChampion }[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < cols; col++) {
      const result = getPlacedAt(row, col);
      if (result) {
        allPlacements.push({ row, col, champion: result.placed });
      }
    }
  }

  return (
    <svg width={width} height={height} className="select-none">
      <defs>
        {allPlacements.map(({ row, col, champion }) => {
          const id = `setup-img-${row}-${col}`;
          return (
            <pattern key={id} id={id} width="1" height="1" patternContentUnits="objectBoundingBox">
              <image
                href={getChampionImage(champion.champion.apiName)}
                width="1" height="1"
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          );
        })}
      </defs>

      {/* Dividing line between enemy/player */}
      <line
        x1={10}
        y1={4 * (HEX_H * 0.75 + PAD) + 10}
        x2={width - 10}
        y2={4 * (HEX_H * 0.75 + PAD) + 10}
        stroke="#374151"
        strokeWidth={1}
        strokeDasharray="4,4"
      />
      <text x={width - 16} y={4 * (HEX_H * 0.75 + PAD) + 6} textAnchor="end" fill="#ef4444" fontSize="8" opacity={0.6}>
        TEAM B
      </text>
      <text x={width - 16} y={4 * (HEX_H * 0.75 + PAD) + 18} textAnchor="end" fill="#3b82f6" fontSize="8" opacity={0.6}>
        TEAM A
      </text>

      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const { cx, cy } = hexCenter(row, col);
          const result = getPlacedAt(row, col);
          const team = getTeamFromRow(row);
          const sel = isSelected(row, col);
          const unitSel = result ? isUnitSelected(result.team, result.index) : false;
          const zoneKey = `${row}-${col}`;
          const isFrontZone = turretZones.front.has(zoneKey);
          const isBackZone = turretZones.back.has(zoneKey);
          const bgTint = isFrontZone ? '#152515' : isBackZone ? '#251a15' : team === 'enemy' ? '#1a1520' : '#151a20';
          const costColor = result ? COST_COLORS[result.placed.champion.cost] : undefined;
          const teamHighlight = team === 'player' ? '#3b82f6' : '#ef4444';

          const handleClick = () => {
            if (result) {
              if (onUnitCycleStars) {
                onUnitCycleStars(result.team, result.index);
              } else {
                onUnitClick(result.team, result.index);
              }
            } else {
              // Convert display row to data row for player team
              const dataRow = team === 'player' ? row - 4 : row;
              const pos = offsetToAxial({ row: dataRow, col });
              onCellClick(pos, team);
            }
          };

          const handleDoubleClick = () => {
            if (result) {
              onUnitClick(result.team, result.index);
            }
          };

          const handleContextMenu = (e: React.MouseEvent) => {
            e.preventDefault();
            if (result && onUnitRightClick) {
              onUnitRightClick(result.team, result.index);
            }
          };

          return (
            <g key={`${row}-${col}`} onClick={handleClick} onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu} className="cursor-pointer">
              <polygon
                points={hexPoints(cx, cy, HEX_R)}
                fill={result ? `url(#setup-img-${row}-${col})` : bgTint}
                stroke={unitSel ? '#f59e0b' : sel ? teamHighlight : result ? costColor : isFrontZone ? '#22c55e40' : isBackZone ? '#f59e0b40' : '#2d3548'}
                strokeWidth={unitSel ? 2.5 : sel ? 2.5 : result ? 2 : (isFrontZone || isBackZone) ? 1.5 : 1}
              />
              {result && result.placed.starLevel > 0 && (
                <text x={cx} y={cy - HEX_R + 14} textAnchor="middle" fill="#f59e0b" fontSize="14" fontWeight="bold">
                  {'★'.repeat(result.placed.starLevel)}
                </text>
              )}
              {result && result.placed.items.length > 0 && (
                <g>
                  {result.placed.items.slice(0, 3).map((item, i) => {
                    const itemSize = 16;
                    const totalWidth = result.placed.items.length * itemSize + (result.placed.items.length - 1) * 2;
                    const startX = cx - totalWidth / 2 + itemSize / 2;
                    const ix = startX + i * (itemSize + 2);
                    const iy = cy + HEX_R - 12;
                    const patId = `item-${row}-${col}-${i}`;
                    return (
                      <g key={i}>
                        <defs>
                          <pattern id={patId} width="1" height="1" patternContentUnits="objectBoundingBox">
                            <image href={getItemImage(item.apiName)} width="1" height="1" preserveAspectRatio="xMidYMid slice" />
                          </pattern>
                        </defs>
                        <rect
                          x={ix - itemSize / 2}
                          y={iy - itemSize / 2}
                          width={itemSize}
                          height={itemSize}
                          rx={2}
                          fill={`url(#${patId})`}
                          stroke="#111"
                          strokeWidth={0.5}
                        />
                      </g>
                    );
                  })}
                </g>
              )}
              {!result && (
                <text x={cx} y={cy + 4} textAnchor="middle" fill="#374151" fontSize="9" opacity={0.5}>
                  {row},{col}
                </text>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
