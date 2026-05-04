/**
 * Canonical 찬란/타락 아이템 apiName 에 대응하는 Riot 매치 API raw ID 변형 목록을 반환한다.
 *
 * Riot 매치 API 는 찬란 아이템을 `TFT5_Item_{Base}Radiant` 형식(끝 접미사)으로 반환하지만
 * 우리 JSON 의 canonical 키는 `TFT_Item_Radiant_{Base}` 형식이다.
 * 전적검색 UI 가 raw Riot ID 로 itemMeta 를 조회해도 hit 가능하도록 alias 를 노출한다.
 *
 * 찬란/타락이 아닌 일반 아이템은 빈 배열을 반환한다.
 */

/**
 * Riot 이 TFT5 시절 raw ID 를 유지한 채 표시 영문명만 변경한 아이템 매핑.
 * 예: Leviathan → Nashor's Tooth (raw 그대로, 한국어 "내셔의 이빨").
 * suffix 자동 변환만으로는 base 가 달라 매칭 실패하므로 명시 매핑이 필요하다.
 */
const RIOT_RENAME_ALIASES: Record<string, readonly string[]> = {
  'TFT_Item_Radiant_NashorsBloodrazor': ['TFT5_Item_LeviathanRadiant', 'TFT_Item_LeviathanRadiant'],
  'TFT_Item_Radiant_Evenshroud':        ['TFT5_Item_SpectralGauntletRadiant', 'TFT_Item_SpectralGauntletRadiant'],
  'TFT_Item_Radiant_VoidStaff':         ['TFT5_Item_StatikkShivRadiant', 'TFT_Item_StatikkShivRadiant'],
  'TFT_Item_Radiant_KrakenSlayer':      ['TFT5_Item_RunaansHurricaneRadiant', 'TFT_Item_RunaansHurricaneRadiant'],
  'TFT_Item_Radiant_RedBuff':           ['TFT5_Item_RapidFirecannonRadiant', 'TFT_Item_RapidFirecannonRadiant'],
};

export function getRiotIdAliases(canonicalApiName: string): string[] {
  const radiantMatch = canonicalApiName.match(/^TFT_Item_Radiant_(.+)$/);
  const corruptedMatch = canonicalApiName.match(/^TFT_Item_Corrupted(.+)$/);
  const base = radiantMatch?.[1] ?? corruptedMatch?.[1];

  const aliases: string[] = [];
  if (base) {
    aliases.push(`TFT5_Item_${base}Radiant`, `TFT_Item_${base}Radiant`);
  }
  const renames = RIOT_RENAME_ALIASES[canonicalApiName];
  if (renames) aliases.push(...renames);

  return aliases;
}

/**
 * Riot raw ID → canonical apiName 역방향 조회표.
 * `RIOT_RENAME_ALIASES` 의 정방향 매핑(canonical → [aliases]) 을 모듈 로드 시점에 1회 뒤집어 캐시.
 */
const RIOT_RAW_ID_TO_CANONICAL: Record<string, string> = (() => {
  const reverse: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(RIOT_RENAME_ALIASES)) {
    for (const alias of aliases) reverse[alias] = canonical;
  }
  return reverse;
})();

/**
 * Riot 매치 API 가 내려보낸 raw 아이템 ID 가 명시 rename 매핑에 있으면 canonical apiName 을 반환.
 *
 * 매핑이 없으면 null. `coverageChecker.resolveItemId` 같은 시뮬/coverage 경로에서 패턴 기반 fallback
 * 보다 먼저 시도하여 영문명 변경된 아이템(예: Leviathan→Nashor's Tooth) 도 시뮬 입력으로 인정되도록 한다.
 */
export function resolveRenameAlias(rawItemId: string): string | null {
  return RIOT_RAW_ID_TO_CANONICAL[rawItemId] ?? null;
}
