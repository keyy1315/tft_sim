/**
 * Canonical 찬란/타락 아이템 apiName 에 대응하는 Riot 매치 API raw ID 변형 목록을 반환한다.
 *
 * Riot 매치 API 는 찬란 아이템을 `TFT5_Item_{Base}Radiant` 형식(끝 접미사)으로 반환하지만
 * 우리 JSON 의 canonical 키는 `TFT_Item_Radiant_{Base}` 형식이다.
 * 전적검색 UI 가 raw Riot ID 로 itemMeta 를 조회해도 hit 가능하도록 alias 를 노출한다.
 *
 * 찬란/타락이 아닌 일반 아이템은 빈 배열을 반환한다.
 */
export function getRiotIdAliases(canonicalApiName: string): string[] {
  const radiantMatch = canonicalApiName.match(/^TFT_Item_Radiant_(.+)$/);
  const corruptedMatch = canonicalApiName.match(/^TFT_Item_Corrupted(.+)$/);
  const base = radiantMatch?.[1] ?? corruptedMatch?.[1];
  if (!base) return [];

  return [
    `TFT5_Item_${base}Radiant`,
    `TFT_Item_${base}Radiant`,
  ];
}
