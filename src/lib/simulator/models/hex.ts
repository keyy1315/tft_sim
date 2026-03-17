/**
 * Hex Grid 모델 상수 + 기하학 헬퍼
 */

import { HexCoord, hexDistance } from '@/types';

/** 보드 크기 (플레이어 진영 기준) */
export const BOARD_ROWS = 4;
export const BOARD_COLS = 7;

/** SVG 렌더링 상수 */
export const HEX_SIZE = 40; // px radius
export const HEX_WIDTH = HEX_SIZE * Math.sqrt(3);
export const HEX_HEIGHT = HEX_SIZE * 2;

/** 반경 radius 내 모든 hex 좌표 반환 (중심 포함) */
export function getHexesInRadius(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

/** from → to 방향으로 직선 확장, 경로 상의 hex 반환 (from 제외, to 포함) */
export function getHexesInLine(from: HexCoord, to: HexCoord, maxRange: number = 8): HexCoord[] {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  const dist = hexDistance(from, to);
  if (dist === 0) return [to];

  const results: HexCoord[] = [];
  // 방향 벡터를 정규화하고 각 스텝의 hex를 계산 (lerp 방식)
  for (let step = 1; step <= maxRange; step++) {
    const t = step / dist;
    const fq = from.q + dq * t;
    const fr = from.r + dr * t;
    const hex = hexRound(fq, fr);
    // 중복 방지
    if (results.length === 0 || results[results.length - 1].q !== hex.q || results[results.length - 1].r !== hex.r) {
      results.push(hex);
    }
  }
  return results;
}

/** origin → direction 방향 원뿔 범위 (±60도) 내 hex 반환 */
export function getHexesInCone(origin: HexCoord, direction: HexCoord, radius: number): HexCoord[] {
  const dq = direction.q - origin.q;
  const dr = direction.r - origin.r;
  const dirAngle = Math.atan2(dr, dq);

  const allInRadius = getHexesInRadius(origin, radius);
  return allInRadius.filter(h => {
    if (h.q === origin.q && h.r === origin.r) return false; // 원점 제외
    const hq = h.q - origin.q;
    const hr = h.r - origin.r;
    const angle = Math.atan2(hr, hq);
    let diff = Math.abs(angle - dirAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    return diff <= Math.PI / 3; // ±60도
  });
}

/** Axial 좌표 반올림 (fractional → integer) */
function hexRound(fq: number, fr: number): HexCoord {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);

  const qDiff = Math.abs(q - fq);
  const rDiff = Math.abs(r - fr);
  const sDiff = Math.abs(s - fs);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }

  return { q, r };
}
