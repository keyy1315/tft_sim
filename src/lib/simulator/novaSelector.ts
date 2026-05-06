/**
 * N.O.V.A. (DRX 5+) "타격 선택기" 적용 가능한 NOVA 5종 chamPApiName.
 *
 * combatLoop 의 autoAssignNovaSelector 내부 NOVA_APIS 와 동일한 5종.
 * 사용처:
 *  - actual-data 의 `'nova-selector'` drop 핸들러 (NOVA 5종 외 무시)
 *  - simulator(builder) 의 SelectedUnitPanel NOVA 토글 노출 조건
 *
 * 본 PR 시점에는 carry Aatrox 에만 효과가 구현되어 있고 (cycle global + knockup),
 * 나머지 4명은 후속 PR 에서 효과 변환 예정.
 */
export const NOVA_SELECTOR_APIS: ReadonlySet<string> = new Set([
  'TFT17_Aatrox',
  'TFT17_Caitlyn',
  'TFT17_Akali',
  'TFT17_Maokai',
  'TFT17_Kindred',
]);

/** 챔피언 apiName 이 NOVA 타격 선택기 대상인지 검사. */
export function isNovaSelectorTarget(apiName: string): boolean {
  return NOVA_SELECTOR_APIS.has(apiName);
}
