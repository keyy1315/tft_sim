import { HexCoord, hexDistance } from '@/types';
import { MOVE_SPEED, TICKS_PER_SECOND, BOARD_ROWS, BOARD_COLS } from '@/lib/simulator/models/constants';

export { hexDistance };

export function canAttack(unitPos: HexCoord, targetPos: HexCoord, range: number): boolean {
  return hexDistance(unitPos, targetPos) <= range;
}

export function getMoveTicks(): number {
  return Math.round(MOVE_SPEED * TICKS_PER_SECOND);
}

/** Axial 좌표 기준 6방향 이웃 */
const AXIAL_DIRECTIONS: [number, number][] = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1],
];

/** Axial → Offset 변환 (범위 체크용) */
function axialToRow(r: number): number { return r; }
function axialToCol(q: number, r: number): number { return q + Math.floor(r / 2); }

export function getNeighbors(pos: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS
    .map(([dq, dr]) => ({ q: pos.q + dq, r: pos.r + dr }))
    .filter(p => {
      const row = axialToRow(p.r);
      const col = axialToCol(p.q, p.r);
      return row >= 0 && row < BOARD_ROWS * 2 && col >= 0 && col < BOARD_COLS;
    });
}

/** 좌표 key 생성 (occupied set용) */
export function coordKey(pos: HexCoord): string {
  return `${pos.q},${pos.r}`;
}

export function findBestMoveToward(
  from: HexCoord,
  target: HexCoord,
  occupiedPositions: Set<string>
): HexCoord | null {
  const neighbors = getNeighbors(from);
  let best: HexCoord | null = null;
  let bestDist = Infinity;

  for (const n of neighbors) {
    if (occupiedPositions.has(coordKey(n))) continue;
    const dist = hexDistance(n, target);
    if (dist < bestDist) {
      bestDist = dist;
      best = n;
    }
  }

  return best;
}
