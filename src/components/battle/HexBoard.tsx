'use client';

import { PlacedChampion, HexCoord, axialToOffset, offsetToAxial, COST_COLORS } from '@/types';
import { getChampionImage } from '@/data/imageMap';
import { BOARD_COLS } from '@/lib/simulator/models/constants';

interface HexBoardProps {
  rows: number;
  cols?: number;
  placedChampions: PlacedChampion[];
  onCellClick: (pos: HexCoord) => void;
  selectedCell?: HexCoord | null;
  highlightColor?: string;
  cellSize?: number;
}

export const DEFAULT_HEX_R = 44;
const PAD = 5;

export const DEFAULT_TEAM_GAP = 10;
export const PLAYER_TEAM_ROW_START = 4;

export interface HexLayout {
  HEX_R: number;
  HEX_W: number;
  HEX_H: number;
  PAD: number;
  teamGap: number;
  hexPoints: (cx: number, cy: number, r: number) => string;
  hexCenter: (row: number, col: number) => { cx: number; cy: number };
}

export function createHexLayout(
  hexR: number = DEFAULT_HEX_R,
  teamGap: number = DEFAULT_TEAM_GAP,
): HexLayout {
  const HEX_W = hexR * Math.sqrt(3);
  const HEX_H = hexR * 2;

  const hexPoints = (cx: number, cy: number, r: number): string => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return pts.join(' ');
  };

  const hexCenter = (row: number, col: number): { cx: number; cy: number } => {
    const offset = row % 2 === 1 ? HEX_W / 2 : 0;
    const cx = col * (HEX_W + PAD) + HEX_W / 2 + 20 + offset;
    const gapOffset = row >= PLAYER_TEAM_ROW_START ? teamGap : 0;
    const cy = row * (HEX_H * 0.75 + PAD) + hexR + 20 + gapOffset;
    return { cx, cy };
  };

  return { HEX_R: hexR, HEX_W, HEX_H, PAD, teamGap, hexPoints, hexCenter };
}

const defaultLayout = createHexLayout(DEFAULT_HEX_R);
export const HEX_R = defaultLayout.HEX_R;
export const HEX_W = defaultLayout.HEX_W;
export const HEX_H = defaultLayout.HEX_H;
export { PAD };
export const hexPoints = defaultLayout.hexPoints;
export const hexCenter = defaultLayout.hexCenter;

export default function HexBoard({ rows, cols = BOARD_COLS, placedChampions, onCellClick, selectedCell, highlightColor = '#8b5cf6' }: HexBoardProps) {
  const width = cols * (HEX_W + PAD) + HEX_W / 2 + 40;
  const height = rows * (HEX_H * 0.75 + PAD) + HEX_R + 40;

  const selectedOffset = selectedCell ? axialToOffset(selectedCell) : null;

  const getPlacedAt = (row: number, col: number) =>
    placedChampions.find(p => {
      const off = axialToOffset(p.position);
      return off.row === row && off.col === col;
    });

  const isSelected = (row: number, col: number) =>
    selectedOffset?.row === row && selectedOffset?.col === col;

  return (
    <svg width={width} height={height} className="select-none">
      <defs>
        {placedChampions.map((p) => {
          const off = axialToOffset(p.position);
          const id = `img-${off.row}-${off.col}`;
          return (
            <pattern key={id} id={id} width="1" height="1" patternContentUnits="objectBoundingBox">
              <image
                href={getChampionImage(p.champion.apiName)}
                width="1" height="1"
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          );
        })}
      </defs>
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const { cx, cy } = hexCenter(row, col);
          const placed = getPlacedAt(row, col);
          const sel = isSelected(row, col);
          const costColor = placed ? COST_COLORS[placed.champion.cost] : undefined;

          return (
            <g key={`${row}-${col}`} onClick={() => onCellClick(offsetToAxial({ row, col }))} className="hex-cell">
              <polygon
                points={hexPoints(cx, cy, HEX_R)}
                fill={placed ? `url(#img-${row}-${col})` : '#1a1f2e'}
                stroke={sel ? highlightColor : placed ? costColor : '#2d3548'}
                strokeWidth={sel ? 2.5 : placed ? 2 : 1}
                className={placed ? 'occupied' : ''}
              />
              {placed && placed.starLevel > 0 && (
                <text x={cx} y={cy - HEX_R + 10} textAnchor="middle" fill="#f59e0b" fontSize="10" className="star">
                  {'★'.repeat(placed.starLevel)}
                </text>
              )}
              {placed && placed.items.length > 0 && (
                <g>
                  {placed.items.slice(0, 3).map((_, i) => (
                    <circle
                      key={i}
                      cx={cx - 8 + i * 8}
                      cy={cy + HEX_R - 8}
                      r={3}
                      fill="#f59e0b"
                      stroke="#111"
                      strokeWidth={0.5}
                    />
                  ))}
                </g>
              )}
              {!placed && (
                <text x={cx} y={cy + 4} textAnchor="middle" fill="#374151" fontSize="10">
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
