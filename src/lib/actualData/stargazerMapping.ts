import type { StargazerConstellationId } from './types';

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
