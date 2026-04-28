'use client';

import { PlacedChampion, HexCoord, HexBuff, axialToOffset, offsetToAxial, COST_COLORS, MF_MODE_CONFIG } from '@/types';
import { getChampionImage, getItemImage } from '@/data/imageMap';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { createHexLayout, DEFAULT_HEX_R } from './HexBoard';

export interface SetupBoardCoreProps {
  playerChampions: PlacedChampion[];
  enemyChampions: PlacedChampion[];
  onCellClick: (pos: HexCoord, team: 'player' | 'enemy') => void;
  onUnitClick: (team: 'player' | 'enemy', index: number) => void;
  onUnitRightClick?: (team: 'player' | 'enemy', index: number) => void;
  onUnitCycleStars?: (team: 'player' | 'enemy', index: number) => void;
  selectedCell?: HexCoord | null;
  selectedUnit?: { team: 'player' | 'enemy'; index: number } | null;
  playerHexBuffs?: HexBuff[];
  enemyHexBuffs?: HexBuff[];
  movingHexBuffApiName?: string | null;
  /** A 팀(player) 강화 칸 데이터-row 좌표 (0-3 기준). 보드 표시 시 row+4 매핑. */
  playerStargazerTiles?: ReadonlyArray<HexCoord>;
  /** B 팀(enemy) 강화 칸 데이터-row 좌표 (0-3 기준). 그대로 표시. */
  enemyStargazerTiles?: ReadonlyArray<HexCoord>;
  cellSize?: number;
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

/** 프렐요드 포탑 효과 범위:
 * 1) 포탑 인접 6칸
 * 2) 인접 위쪽 2칸 바로 위 행의 가운데 3칸 (전방)
 * 3) 인접 아래쪽 2칸 바로 아래 행의 가운데 3칸 (후방)
 * 같은 팀 진영만 표시
 */
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
    const teamMinRow = isPlayerTurret ? 4 : 0;
    const teamMaxRow = isPlayerTurret ? 7 : 3;

    const addIfValid = (r: number, c: number, zone: 'front' | 'back') => {
      if (r < teamMinRow || r > teamMaxRow || c < 0 || c >= BOARD_COLS) return;
      (zone === 'front' ? front : back).add(`${r}-${c}`);
    };

    // 1) 인접 6칸
    const adj = getHexNeighbors(tRow, tCol);
    const upperAdj = adj.filter(n => n.r < tRow); // 위쪽 2칸 (전방)
    const lowerAdj = adj.filter(n => n.r > tRow); // 아래쪽 2칸 (후방)
    const sameRow = adj.filter(n => n.r === tRow); // 같은 행 2칸

    for (const n of upperAdj) addIfValid(n.r, n.c, 'front');
    for (const n of lowerAdj) addIfValid(n.r, n.c, 'back');
    for (const n of sameRow) addIfValid(n.r, n.c, 'front'); // 같은 행은 전방

    // 2) 전방 확장: 위쪽 인접 칸들에서 한 행 더 위 → 3칸
    if (upperAdj.length > 0) {
      const extRow = upperAdj[0].r - 1; // 인접 위쪽에서 한 행 더 위
      // 위쪽 인접 칸들의 col 범위에서 3칸 결정
      const cols = upperAdj.map(n => n.c).sort((a, b) => a - b);
      const minC = Math.max(0, cols[0] - (extRow % 2 !== upperAdj[0].r % 2 ? 1 : 0));
      for (let i = 0; i < 3; i++) {
        addIfValid(extRow, minC + i, 'front');
      }
    }

    // 3) 후방 확장: 아래쪽 인접 칸들에서 한 행 더 아래 → 3칸
    if (lowerAdj.length > 0) {
      const extRow = lowerAdj[0].r + 1; // 인접 아래쪽에서 한 행 더 아래
      const cols = lowerAdj.map(n => n.c).sort((a, b) => a - b);
      const minC = Math.max(0, cols[0] - (extRow % 2 !== lowerAdj[0].r % 2 ? 1 : 0));
      for (let i = 0; i < 3; i++) {
        addIfValid(extRow, minC + i, 'back');
      }
    }
  }

  return { front, back };
}

export default function SetupBoardCore({
  playerChampions,
  enemyChampions,
  onCellClick,
  onUnitClick,
  onUnitRightClick,
  onUnitCycleStars,
  selectedCell,
  selectedUnit,
  playerHexBuffs = [],
  enemyHexBuffs = [],
  movingHexBuffApiName,
  playerStargazerTiles = [],
  enemyStargazerTiles = [],
  cellSize = DEFAULT_HEX_R,
}: SetupBoardCoreProps) {
  const { HEX_R, HEX_W, HEX_H, PAD, teamGap, hexCenter, hexPoints } = createHexLayout(cellSize);
  const cols = BOARD_COLS;
  const width = cols * (HEX_W + PAD) + HEX_W / 2 + 40;
  const height = ROWS * (HEX_H * 0.75 + PAD) + HEX_R + 40 + teamGap;

  // 프렐요드 포탑 효과 범위
  const turretZones = getTurretEffectZones(playerChampions, enemyChampions);

  // 칸 버프 → display row/col 기준 Set 생성
  const hexBuffMap = new Map<string, { color: string; label: string; movable: boolean }>();
  for (const buff of playerHexBuffs) {
    for (const pos of buff.positions) {
      const off = axialToOffset(pos);
      const displayRow = off.row + 4;
      const isMoving = buff.movable && movingHexBuffApiName === buff.augmentApiName;
      hexBuffMap.set(`${displayRow}-${off.col}`, { color: isMoving ? '#FF8C00' : buff.color, label: buff.label, movable: buff.movable });
    }
  }
  for (const buff of enemyHexBuffs) {
    for (const pos of buff.positions) {
      const off = axialToOffset(pos);
      const isMoving = buff.movable && movingHexBuffApiName === buff.augmentApiName;
      hexBuffMap.set(`${off.row}-${off.col}`, { color: isMoving ? '#FF8C00' : buff.color, label: buff.label, movable: buff.movable });
    }
  }

  // 강화 칸 (별돌보미 별자리) — 보라색 테두리. player 데이터 row 0-3 → 보드 row+4 (4-7).
  const stargazerTileSet = new Set<string>();
  for (const t of playerStargazerTiles) {
    const off = axialToOffset(t);
    stargazerTileSet.add(`${off.row + 4}-${off.col}`);
  }
  for (const t of enemyStargazerTiles) {
    const off = axialToOffset(t);
    stargazerTileSet.add(`${off.row}-${off.col}`);
  }

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

      {/* Team background tint */}
      <rect x={0} y={0} width={width} height={4 * (HEX_H * 0.75 + PAD) + 10} fill="#ef444408" rx={8} />
      <rect x={0} y={4 * (HEX_H * 0.75 + PAD) + 10 + teamGap} width={width} height={height - (4 * (HEX_H * 0.75 + PAD) + 10 + teamGap)} fill="#3b82f608" rx={8} />

      {/* Team labels - left side vertical */}
      <text x={14} y={2 * (HEX_H * 0.75 + PAD) + HEX_R} textAnchor="middle" fill="#ef4444" fontSize="20" fontWeight="900" opacity={0.3}
        transform={`rotate(-90, 14, ${2 * (HEX_H * 0.75 + PAD) + HEX_R})`}>
        B
      </text>
      <text x={14} y={6 * (HEX_H * 0.75 + PAD) + HEX_R + teamGap} textAnchor="middle" fill="#3b82f6" fontSize="20" fontWeight="900" opacity={0.3}
        transform={`rotate(-90, 14, ${6 * (HEX_H * 0.75 + PAD) + HEX_R + teamGap})`}>
        A
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
          const hexBuffInfo = hexBuffMap.get(zoneKey);
          const bgTint = hexBuffInfo ? `${hexBuffInfo.color}18` : isFrontZone ? '#152515' : isBackZone ? '#251a15' : team === 'enemy' ? '#1c1018' : '#101820';
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
                stroke={
                  unitSel ? '#f59e0b'
                  : sel ? teamHighlight
                  : hexBuffInfo ? `${hexBuffInfo.color}90`
                  : stargazerTileSet.has(zoneKey) ? '#A855F7'
                  : result ? costColor
                  : isFrontZone ? '#22c55e40'
                  : isBackZone ? '#f59e0b40'
                  : '#2d3548'
                }
                strokeWidth={unitSel ? 2.5 : sel ? 2.5 : hexBuffInfo ? 2 : stargazerTileSet.has(zoneKey) ? 2.5 : result ? 2 : (isFrontZone || isBackZone) ? 1.5 : 1}
                strokeDasharray={hexBuffInfo?.movable ? '4 2' : undefined}
              />
              {hexBuffInfo && !result && (
                <>
                  <text x={cx} y={hexBuffInfo.movable ? cy : cy + 4} textAnchor="middle" fill={hexBuffInfo.color} fontSize="8" fontWeight="bold" opacity={0.7}>
                    {hexBuffInfo.label}
                  </text>
                  {hexBuffInfo.movable && (
                    <text x={cx} y={cy + 12} textAnchor="middle" fill="#9CA3AF" fontSize="7" opacity={0.6}>
                      클릭하여 이동
                    </text>
                  )}
                </>
              )}
              {result && result.placed.starLevel > 0 && (
                <text x={cx} y={cy - HEX_R + 14} textAnchor="middle" fill="#f59e0b" fontSize="14" fontWeight="bold"
                  stroke="#fff" strokeWidth={2} paintOrder="stroke">
                  {'★'.repeat(result.placed.starLevel)}
                </text>
              )}
              {result && result.placed.mfMode && (
                (() => {
                  const modeIcon = MF_MODE_CONFIG[result.placed.mfMode].icon;
                  const badgeSize = 14;
                  const bx = cx + HEX_R * 0.45;
                  const by = cy - HEX_R + 24;
                  const patId = `mf-mode-${row}-${col}`;
                  return (
                    <g>
                      <defs>
                        <pattern id={patId} width="1" height="1" patternContentUnits="objectBoundingBox">
                          <image href={modeIcon} width="1" height="1" preserveAspectRatio="xMidYMid slice" />
                        </pattern>
                      </defs>
                      <circle cx={bx} cy={by} r={badgeSize / 2 + 1} fill="#111827" />
                      <circle cx={bx} cy={by} r={badgeSize / 2} fill={`url(#${patId})`} stroke="#fbbf24" strokeWidth={0.8} />
                    </g>
                  );
                })()
              )}
              {result && result.placed.itemSlots && (
                <g>
                  {(() => {
                    const slots = result.placed.itemSlots;
                    const itemSize = 16;
                    // 고정 3-슬롯 레이아웃 — ActualItemSlotsOverlay 의 droppable 위치와 정확히 일치.
                    const totalWidth = 3 * itemSize + 2 * 2;
                    const startX = cx - totalWidth / 2 + itemSize / 2;
                    const iy = cy + HEX_R - 12;
                    const nodes = [];
                    for (let i = 0; i < 3; i++) {
                      const item = slots[i];
                      if (!item) continue;
                      const ix = startX + i * (itemSize + 2);
                      const patId = `item-${row}-${col}-${i}`;
                      nodes.push(
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
                    }
                    return nodes;
                  })()}
                </g>
              )}
              {result && !result.placed.itemSlots && result.placed.items.length > 0 && (
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
