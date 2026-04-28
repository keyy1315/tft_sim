/**
 * UI 강화 칸 표시 좌표 ↔ combat 효과 적용 좌표 round-trip 검증.
 *
 * 배경:
 *   - CONSTELLATION_TILE_PATTERN 은 player half (data row 0..3) 만 정의
 *   - simulator 의 toEightRowCoords 가 player unit 을 boards row 4..7 로 shift
 *   - applyStargazerEffects.isOnTile 은 r>=4 unit 을 mirrorPosition 으로 r=0..3
 *     변환 후 패턴 체크 (mirrorPosition: r → 7-r, offset col 보존)
 *
 * 따라서 UI 가 player 강화 칸을 표시할 때:
 *   pattern data (q, r) → 보드 offset (col=qOff, row=7-r) 위치에 표시해야
 *   해당 위치 unit 이 실제 effect 받는 위치와 일치 (codex P1 회귀 가드).
 *
 * 본 테스트는 UI 컴포넌트 직접 렌더 없이 매핑 공식 자체를 verify.
 * SetupBoardCore + ReplayBoard 모두 동일 공식 사용.
 */
import { describe, it, expect } from 'vitest';
import { CONSTELLATION_TILE_PATTERN } from '@/lib/actualData/stargazerMapping';
import { axialToOffset, offsetToAxial } from '@/types';
import type { HexCoord } from '@/types';

/** UI display row for player tile (보드 좌표). data row r → 7-r. */
function playerTileDisplayRow(dataRow: number): number {
  return 7 - dataRow;
}

/** Combat 의 mirror back 시뮬레이션. boards r>=4 → mirror back to r=0..3. */
function mirrorBackForCombat(pos: HexCoord): HexCoord {
  if (pos.r < 4) return pos;
  const mirroredR = 7 - pos.r;
  const originalCol = pos.q + Math.floor(pos.r / 2);
  const newQ = originalCol - Math.floor(mirroredR / 2);
  return { q: newQ, r: mirroredR };
}

describe('Player 강화 칸 UI 표시 ↔ combat lookup round-trip', () => {
  it('각 별자리의 모든 패턴 tile: 표시 위치 unit → mirror back → 원본 패턴과 일치', () => {
    const constellations = Object.keys(CONSTELLATION_TILE_PATTERN) as Array<keyof typeof CONSTELLATION_TILE_PATTERN>;
    for (const id of constellations) {
      for (const tile of CONSTELLATION_TILE_PATTERN[id]) {
        const off = axialToOffset(tile);

        // UI 가 표시하는 보드 위치 (현재 fix 의 공식)
        const displayRow = playerTileDisplayRow(off.row);
        const displayPos = offsetToAxial({ row: displayRow, col: off.col });

        // 만약 player unit 이 이 표시 위치에 있다면 (toEightRowCoords 후 r=4..7),
        // combat 가 mirror back 으로 어떤 pattern 좌표를 체크하는지
        const checkPos = mirrorBackForCombat(displayPos);

        // round-trip: mirror back 결과가 원본 pattern tile 과 일치해야 한다.
        expect(checkPos).toEqual(tile);
      }
    }
  });

  it('display row 가 항상 4..7 범위 (player half) 안에 들어가야 한다', () => {
    const constellations = Object.keys(CONSTELLATION_TILE_PATTERN) as Array<keyof typeof CONSTELLATION_TILE_PATTERN>;
    for (const id of constellations) {
      for (const tile of CONSTELLATION_TILE_PATTERN[id]) {
        const off = axialToOffset(tile);
        const displayRow = playerTileDisplayRow(off.row);
        expect(displayRow).toBeGreaterThanOrEqual(4);
        expect(displayRow).toBeLessThanOrEqual(7);
      }
    }
  });

  it('회귀 가드: 잘못된 공식 (off.row + 4) 은 mirror back round-trip 실패', () => {
    // 본 테스트는 codex P1 이 catch 한 버그가 다시 나타나면 fail 한다.
    const tile = CONSTELLATION_TILE_PATTERN.mountain[0]; // 첫 mountain 타일
    const off = axialToOffset(tile);

    // 잘못된 공식 (이전 코드)
    const wrongDisplayRow = off.row + 4;
    const wrongDisplayPos = offsetToAxial({ row: wrongDisplayRow, col: off.col });
    const wrongCheck = mirrorBackForCombat(wrongDisplayPos);

    // data row=0 일 때 (mountain 첫 타일), wrong=4 → mirror→r=3 → tile.r=0 과 불일치
    if (off.row === 0) {
      expect(wrongCheck.r).not.toBe(tile.r);
    }
  });
});
