import type { StargazerConstellationId } from './types';
import type { HexCoord } from '@/types';
import { offsetToAxial } from '@/types';

/**
 * 별돌보미 별자리 (게임 데이터 schema enum) ↔ trait apiName 매핑.
 *
 * Riot internal apiName 과 인게임 한글 표기가 일관되지 않아 (`Wolf` apiName 이
 * 실제로는 "멧돼지" 별자리) 명시적 매핑 필요.
 *
 * 7개 변종은 base trait `TFT17_Stargazer` 위에 적용되는 컨스텔레이션. 게임마다
 * 하나씩 randomized — game-level field `ActualGameData.stargazerConstellation`
 * 에 사용자가 입력.
 */
export const CONSTELLATION_TO_TRAIT_API: Record<StargazerConstellationId, string> = {
  altar: 'TFT17_Stargazer_Shield',
  boar: 'TFT17_Stargazer_Wolf',
  huntress: 'TFT17_Stargazer_Huntress',
  medal: 'TFT17_Stargazer_Medallion',
  mountain: 'TFT17_Stargazer_Mountain',
  snake: 'TFT17_Stargazer_Serpent',
  well: 'TFT17_Stargazer_Fountain',
};

/** 인게임 한글 표기. UI dropdown / 디스플레이용. */
export const CONSTELLATION_KOREAN_NAME: Record<StargazerConstellationId, string> = {
  altar: '제단',
  boar: '멧돼지',
  huntress: '여사냥꾼',
  medal: '메달',
  mountain: '산',
  snake: '뱀',
  well: '우물',
};

/** 모든 별자리 id 를 한글 알파벳 순으로 정렬한 배열 — UI dropdown 옵션 순서. */
export const CONSTELLATION_IDS: StargazerConstellationId[] = (
  Object.keys(CONSTELLATION_KOREAN_NAME) as StargazerConstellationId[]
).sort((a, b) =>
  CONSTELLATION_KOREAN_NAME[a].localeCompare(CONSTELLATION_KOREAN_NAME[b], 'ko'),
);

/** trait apiName → constellation id 역매핑 (필요 시). */
export function traitApiToConstellationId(apiName: string): StargazerConstellationId | null {
  for (const [id, api] of Object.entries(CONSTELLATION_TO_TRAIT_API)) {
    if (api === apiName) return id as StargazerConstellationId;
  }
  return null;
}

/**
 * 별자리별 강화 칸 (offset) 패턴.
 * 4 행 × 7 열 (player half-board). 각 row 의 col 0~6 중 활성 칸을 명시.
 *
 * 단순화 (PR-3 v1):
 * - 게임 진행 중 player level 따라 점진 추가되지만 현재는 **고정 풀 패턴** 으로
 *   적용. 정밀화는 후속 PR.
 * - 별돌보미 trait 활성된 팀만 적용 (minUnits >= 3).
 *
 * 좌표 시스템 (`src/types/index.ts:offsetToAxial`):
 *   q = col - floor(row / 2), r = row
 *
 * 이미지 출처: docs/sim-accuracy/stargazer-tile-images.* (사용자 제공)
 */
const TILE_PATTERNS_OFFSET: Record<StargazerConstellationId, ReadonlyArray<readonly [row: number, col: number]>> = {
  // 멧돼지 (Wolf) — 좌측·중앙 집중 17칸
  // r=0 ·X·XXX· / r=1 XXXXX·· / r=2 XXXXX·· / r=3 X·XX···
  boar: [
    [0, 1], [0, 3], [0, 4], [0, 5],
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
    [3, 0], [3, 2], [3, 3],
  ],
  // 메달 (Medallion) — 보드 전반 분산 17칸
  // r=0 ··XXXX· / r=1 XX···X· / r=2 XXXX··X / r=3 XX·XXX·
  medal: [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 0], [1, 1], [1, 5],
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 6],
    [3, 0], [3, 1], [3, 3], [3, 4], [3, 5],
  ],
  // 여사냥꾼 (Huntress) — 중앙·후열 carry 보호 14칸
  // r=0 ··X··X· / r=1 ·XXXXX· / r=2 ··X·XX· / r=3 ···XXXX
  huntress: [
    [0, 2], [0, 5],
    [1, 1], [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 2], [2, 4], [2, 5],
    [3, 3], [3, 4], [3, 5], [3, 6],
  ],
  // 뱀 (Serpent) — 바둑판 분산 14칸
  // r=0 ··XX·XX / r=1 ·X·X·X· / r=2 ··X·X·X / r=3 XX··XX·
  snake: [
    [0, 2], [0, 3], [0, 5], [0, 6],
    [1, 1], [1, 3], [1, 5],
    [2, 2], [2, 4], [2, 6],
    [3, 0], [3, 1], [3, 4], [3, 5],
  ],
  // 제단 (Shield) — 보드 대칭 + 전열 풀 18칸
  // r=0 ·X·XX·X / r=1 X·X·X·X / r=2 ·X·XX·X / r=3 XXX·XXX
  altar: [
    [0, 1], [0, 3], [0, 4], [0, 6],
    [1, 0], [1, 2], [1, 4], [1, 6],
    [2, 1], [2, 3], [2, 4], [2, 6],
    [3, 0], [3, 1], [3, 2], [3, 4], [3, 5], [3, 6],
  ],
  // 우물 (Fountain) — 후열·전열 풀, 행 2 거의 비음 14칸
  // r=0 ·XX·XX· / r=1 X·XX·X· / r=2 ···X··· / r=3 XXXXXX·
  well: [
    [0, 1], [0, 2], [0, 4], [0, 5],
    [1, 0], [1, 2], [1, 3], [1, 5],
    [2, 3],
    [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5],
  ],
  // 산 (Mountain) — 중앙 라인 + 양 가장자리 12칸
  // r=0 ··XXXX· / r=1 ·X···X· / r=2 ·X····X / r=3 XX···XX
  mountain: [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 1], [1, 5],
    [2, 1], [2, 6],
    [3, 0], [3, 1], [3, 5], [3, 6],
  ],
};

/**
 * 별자리별 강화 칸 axial 좌표 (q, r) 배열. 사용자 측은 hex 의 q/r 로 검사.
 */
export const CONSTELLATION_TILE_PATTERN: Record<StargazerConstellationId, ReadonlyArray<HexCoord>> = (() => {
  const out = {} as Record<StargazerConstellationId, ReadonlyArray<HexCoord>>;
  for (const id of Object.keys(TILE_PATTERNS_OFFSET) as StargazerConstellationId[]) {
    out[id] = TILE_PATTERNS_OFFSET[id].map(([row, col]) => offsetToAxial({ row, col }));
  }
  return out;
})();

/** 주어진 unit position 이 별자리의 강화 칸인지 검사. O(N) — N=12~18 작음. */
export function isOnEmpoweredTile(
  position: HexCoord,
  constellation: StargazerConstellationId,
): boolean {
  const tiles = CONSTELLATION_TILE_PATTERN[constellation];
  return tiles.some((t) => t.q === position.q && t.r === position.r);
}
