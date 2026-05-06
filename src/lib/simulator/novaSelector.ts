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

/**
 * N.O.V.A. trait apiName. 게임 데이터 (`tft_set17_traits.json` apiName='TFT17_DRX',
 * 표시명 'N.O.V.A.') 기준. 트레잇은 두 tier 를 가짐:
 *  - [0] minUnits=2~4, style=1 (힘의 고조만)
 *  - [1] minUnits=5+,   style=5 (타격 선택기 부여 — UI 노출 조건)
 */
export const NOVA_TRAIT_API = 'TFT17_DRX';

/** 타격 선택기가 게임에서 부여되는 NOVA tier 의 minUnits 임계값. */
export const NOVA_STRIKE_SELECTOR_MIN_UNITS = 5;

/**
 * 활성 trait 배열에서 N.O.V.A. (5+) 시너지가 동작 중이고 따라서 "타격 선택기" 가
 * 게임에서 부여된 상태인지 검사. (2~4) 하위 tier 는 false 를 반환한다.
 */
export function isNovaStrikeSelectorActive(
  activeTraits: ReadonlyArray<{ trait: { apiName: string }; activeEffect?: { minUnits?: number } | null }>,
): boolean {
  return activeTraits.some(t =>
    t.trait.apiName === NOVA_TRAIT_API
    && !!t.activeEffect
    && (t.activeEffect.minUnits ?? 0) >= NOVA_STRIKE_SELECTOR_MIN_UNITS,
  );
}
