/**
 * Riot 매치 API 가 반환하는 챔피언 raw ID 를 우리 카탈로그의 canonical apiName 으로 정규화한다.
 *
 * 같은 챔피언이 CommunityDragon 의 `apiName` 과 `characterName` 두 표기를 갖는 경우가 있고,
 * Riot 매치 API 는 `characterName` 쪽을 내려보낸다. 우리 카탈로그는 `apiName` 을 키로 쓰므로
 * 매치 데이터로 카탈로그 조회 시 미스매치가 발생한다 (예: 렉사이).
 *
 * 일반 챔피언은 입력값을 그대로 반환한다.
 */
const CHAMPION_ID_ALIASES: Record<string, string> = {
  // TFT17 렉사이: Riot characterName='TFT17_RekSai' (대문자 S) vs CommunityDragon apiName='TFT17_Reksai'
  'TFT17_RekSai': 'TFT17_Reksai',
};

export function normalizeChampionId(rawId: string): string {
  return CHAMPION_ID_ALIASES[rawId] ?? rawId;
}

/**
 * canonical apiName → 그 canonical 로 정규화되는 Riot raw ID 목록.
 * 모듈 로드 시점에 1회 역매핑 캐시.
 *
 * lookup 페이지의 `championMeta` 같이 raw ID 로 직접 조회하는 경로에서
 * canonical 메타를 alias 키에도 미러 등록해 미지원 표시(`?`) 를 방지하기 위함.
 */
const CANONICAL_TO_RAW_IDS: Record<string, string[]> = (() => {
  const reverse: Record<string, string[]> = {};
  for (const [raw, canonical] of Object.entries(CHAMPION_ID_ALIASES)) {
    (reverse[canonical] ??= []).push(raw);
  }
  return reverse;
})();

export function getRiotChampionRawIds(canonicalApiName: string): string[] {
  return CANONICAL_TO_RAW_IDS[canonicalApiName] ?? [];
}
