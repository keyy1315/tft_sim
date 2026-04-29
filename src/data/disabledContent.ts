/**
 * Disabled augments / items / market offerings.
 *
 * 데이터 자체는 JSON 에 보존하고, loader 단계에서 필터하여 UI/시뮬 풀에서 제외.
 * 게임 내 실제로 등장하지 않는 (또는 미구현) 컨텐츠를 사용자 빌더에 노출하지 않기 위함.
 *
 * 추가/제거 시 이 파일만 수정하면 loader.ts (클라이언트) 와
 * serverCatalogs.ts (서버 validation) 양쪽에서 동일하게 반영됨.
 */

/**
 * Disabled augments (apiName → 제외).
 *
 * NOTE: 본 Set 은 augments JSON 의 disable:true 분류와 함께 동작.
 * loader.ts / serverCatalogs.ts 가 둘 다 체크하여 augment 풀에서 제외.
 *
 * - TFT17_Augment_Concentration (집중) — 17.2 raw 추가, 게임 풀 미반영
 * - TFT17_Augment_Timebreaker_Timestream (시간의 흐름) — 17.2 raw 추가, 게임 풀 미반영
 * - TFT17_Augment_EmergencySupplies — 17.2 raw 추가, name 미정의 (placeholder)
 *   (회귀 노트: 이전 'Psionic_' 접두사는 raw apiName 과 불일치하여 필터 미적용 — 17.2 fetch 후 발견)
 * - TFT17_Augment_DarkStar_NeutronStar (중성자별) — 17.2 raw 추가, 게임 풀 미반영
 * - TFT17_Augment_ShieldTank_DivinePaladins (신성한 성기사단) — 17.2 raw 추가, 게임 풀 미반영
 */
export const DISABLED_AUGMENT_API_NAMES: ReadonlySet<string> = new Set([
  'TFT17_Augment_Concentration',
  'TFT17_Augment_Timebreaker_Timestream',
  'TFT17_Augment_EmergencySupplies',
  'TFT17_Augment_DarkStar_NeutronStar',
  'TFT17_Augment_ShieldTank_DivinePaladins',
]);

/**
 * Disabled items / market offerings (apiName → 제외).
 *
 * - TFT17_MarketOffering_PandorasSeat (판도라의 좌석) —
 *     17.2 신상 신의 축복(MarketOffering). 사용자 disable 요청.
 *     "대기석 우측 N명이 라운드 시작마다 동일 단계 무작위 챔프로 변신" 메커니즘
 *     은 시뮬과 무관 (배치/메타 시스템).
 *
 * - PsyOps `_Radiant` 변종 6종 — 빌더 UI 에서 노출 차단.
 *     17.2 게임 시스템: 사용자는 일반 5종 (`*Mod`) 만 장착. (4) 초능력 시너지 활성 +
 *     초능력 unit 이 장착 시 시뮬이 자동 Radiant apiName 으로 swap (combatLoop
 *     applyPsyOpsRadiantSwap). 빌더에서 사용자가 직접 Radiant 선택 불가.
 *
 * - TFT17_Item_PsyOps_SemiconductorMod (반도체) — 17.2 raw 데이터에 있지만
 *     실제 게임 풀에 없음. 데이터 보존, 차단만 (이후 패치 reactivate 가능).
 *
 * - TFT17_Item_Artifact_KayleArtifact (케일의 승천) +
 *   TFT17_Item_Artifact_KayleArtifact_Radiant (케일의 찬란한 승천) —
 *     17.2 패치에서 삭제. 데이터 보존, 차단만 (다음 패치 부활 가능).
 */
export const DISABLED_ITEM_API_NAMES: ReadonlySet<string> = new Set([
  'TFT17_MarketOffering_PandorasSeat',
  'TFT17_Item_PsyOps_DroneMod_Radiant',
  'TFT17_Item_PsyOps_TargetlockMod_Radiant',
  'TFT17_Item_PsyOps_SympatheticImplantMod_Radiant',
  'TFT17_Item_PsyOps_ChemicalCapacitorMod_Radiant',
  'TFT17_Item_PsyOps_GrenadeMod_Radiant',
  'TFT17_Item_PsyOps_SemiconductorMod_Radiant',
  'TFT17_Item_PsyOps_SemiconductorMod',
  'TFT17_Item_Artifact_KayleArtifact',
  'TFT17_Item_Artifact_KayleArtifact_Radiant',
]);

export function isDisabledAugment(apiName: string): boolean {
  return DISABLED_AUGMENT_API_NAMES.has(apiName);
}

export function isDisabledItem(apiName: string): boolean {
  return DISABLED_ITEM_API_NAMES.has(apiName);
}
