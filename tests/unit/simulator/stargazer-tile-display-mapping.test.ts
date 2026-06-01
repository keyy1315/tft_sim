/**
 * UI 강화 칸 표시 좌표 ↔ combat 효과 적용 좌표 일관성 (PR10 spec).
 *
 * 사용자 명시 spec:
 *  - A팀 (player, 화면 아래): display = (4 + pattern.row, pattern.col)
 *  - B팀 (enemy,  화면 위):    display = (3 - pattern.row, BOARD_COLS-1 - pattern.col) — 보드 중심 180° 회전
 *
 * 본 테스트는 spec 자체 + 산(Mountain) 별자리에 대한 명시 좌표 fingerprint 를
 * 잠근다 (사용자가 검증한 정확한 12 좌표).
 */
import { describe, it, expect } from 'vitest';
import { CONSTELLATION_TILE_PATTERN } from '@/lib/actualData/stargazerMapping';
import { axialToOffset } from '@/types';
import { BOARD_COLS } from '@/lib/simulator/models/constants';

/** A팀 강화 칸 display 좌표 (PR10 spec). */
function playerTileDisplay(patternRow: number, patternCol: number): { row: number; col: number } {
  return { row: 4 + patternRow, col: patternCol };
}

/** B팀 강화 칸 display 좌표 — 보드 중심 180° 회전. */
function enemyTileDisplay(patternRow: number, patternCol: number): { row: number; col: number } {
  return { row: 3 - patternRow, col: BOARD_COLS - 1 - patternCol };
}

describe('PR10 — 강화 칸 display 매핑 spec', () => {
  it('A팀: display.row 가 4..7 범위 (player half)', () => {
    for (const id of Object.keys(CONSTELLATION_TILE_PATTERN) as Array<keyof typeof CONSTELLATION_TILE_PATTERN>) {
      for (const tile of CONSTELLATION_TILE_PATTERN[id]) {
        const off = axialToOffset(tile);
        const disp = playerTileDisplay(off.row, off.col);
        expect(disp.row).toBeGreaterThanOrEqual(4);
        expect(disp.row).toBeLessThanOrEqual(7);
      }
    }
  });

  it('B팀: display.row 가 0..3 범위 (enemy half)', () => {
    for (const id of Object.keys(CONSTELLATION_TILE_PATTERN) as Array<keyof typeof CONSTELLATION_TILE_PATTERN>) {
      for (const tile of CONSTELLATION_TILE_PATTERN[id]) {
        const off = axialToOffset(tile);
        const disp = enemyTileDisplay(off.row, off.col);
        expect(disp.row).toBeGreaterThanOrEqual(0);
        expect(disp.row).toBeLessThanOrEqual(3);
      }
    }
  });

  it('A팀 / B팀 display 는 보드 중심 (3.5, 3) 기준 180° 회전 관계', () => {
    for (const id of Object.keys(CONSTELLATION_TILE_PATTERN) as Array<keyof typeof CONSTELLATION_TILE_PATTERN>) {
      for (const tile of CONSTELLATION_TILE_PATTERN[id]) {
        const off = axialToOffset(tile);
        const a = playerTileDisplay(off.row, off.col);
        const b = enemyTileDisplay(off.row, off.col);
        // 180° 회전: (r, c) ↔ (7-r, BOARD_COLS-1-c)
        expect(b.row).toBe(7 - a.row);
        expect(b.col).toBe(BOARD_COLS - 1 - a.col);
      }
    }
  });
});

describe('PR10 — Mountain(산) 별자리 명시 좌표 fingerprint (사용자 검증)', () => {
  /** 사용자가 검증한 A팀 Mountain 강화 칸 12 좌표 (display row.col). */
  const EXPECTED_A_MOUNTAIN: ReadonlyArray<readonly [row: number, col: number]> = [
    [4, 2], [4, 3], [4, 4], [4, 5],
    [5, 1], [5, 5],
    [6, 1], [6, 6],
    [7, 0], [7, 1], [7, 5], [7, 6],
  ];

  /** B팀 Mountain — A팀 좌표를 180° 회전. */
  const EXPECTED_B_MOUNTAIN: ReadonlyArray<readonly [row: number, col: number]> = [
    [3, 1], [3, 2], [3, 3], [3, 4],
    [2, 1], [2, 5],
    [1, 0], [1, 5],
    [0, 0], [0, 1], [0, 5], [0, 6],
  ];

  function patternMountainDisplay(side: 'A' | 'B'): Set<string> {
    const set = new Set<string>();
    for (const tile of CONSTELLATION_TILE_PATTERN.mountain) {
      const off = axialToOffset(tile);
      const disp = side === 'A'
        ? playerTileDisplay(off.row, off.col)
        : enemyTileDisplay(off.row, off.col);
      set.add(`${disp.row}-${disp.col}`);
    }
    return set;
  }

  it('A팀 Mountain: 12 강화 칸이 사용자 검증 좌표와 정확히 일치', () => {
    const computed = patternMountainDisplay('A');
    const expected = new Set(EXPECTED_A_MOUNTAIN.map(([r, c]) => `${r}-${c}`));
    expect(computed).toEqual(expected);
    expect(computed.size).toBe(12);
  });

  it('B팀 Mountain: 12 강화 칸이 A팀 180° 회전과 정확히 일치', () => {
    const computed = patternMountainDisplay('B');
    const expected = new Set(EXPECTED_B_MOUNTAIN.map(([r, c]) => `${r}-${c}`));
    expect(computed).toEqual(expected);
    expect(computed.size).toBe(12);
  });
});
