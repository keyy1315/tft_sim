# N.O.V.A. 타격 선택기 UI + 아이템 탭 필터링 — 작업 인계 가이드

**작성일**: 2026-05-04
**브랜치**: `feature/nova-selector-ui-trait-tabs` (dev base)
**재개 예정**: 2026-05-06 (수)
**선행 PR**: #85 머지 완료 (raw data + 자동 할당)

## 사용자 요청

1. **N.O.V.A. 타격 선택기 UI**: 자석 제거기 패턴(`DraggableItemRemoverTool`) 따라서 사용자가 수동으로 NOVA 5종(Aatrox/Caitlyn/Akali/Maokai/Kindred) 중 하나에게 타격 선택기를 적용할 수 있는 드래그 도구 추가.
2. **아이템 탭 필터링**: ItemGrid에 동물특공대(AnimaSquad) / 초능력(PsyOps) trait 전용 아이템 탭 추가.
3. 자동 할당(`autoAssignNovaSelector`)은 명시적 선택 없을 때 fallback으로 유지.
4. **하나의 PR로 진행** (사용자 명시).

## 진행 상태

**조사만 완료, 코드 변경 0**. 다음 세션에서 구현 시작.

## 발견된 사항 (재개 시 즉시 반영)

### 1. 시뮬 호출 사이트가 NOVA 옵션을 전달하지 않음 (중요)
- PR #85에서 `simulateOptions.playerNovaStrikeSelectorUnit` / `enemyNovaStrikeSelectorUnit` 옵션은 추가됐지만 **호출 사이트 3곳 모두 미전달**:
  - `src/app/api/simulate/route.ts:39-44` — body에서 안 받음
  - `src/hooks/useCombatAnalysis.ts:154-158, 186-190` — options에 안 넣음
- 즉 현재는 자동 할당만 동작. 수동 선택 UI를 만들려면 호출 경로도 손봐야 함.

### 2. 영역 분리
- `ItemGrid` (탭 추가 대상): `src/components/builder/ItemGrid.tsx` — `builder/SelectedUnitPanel.tsx`에서만 사용 (builder 영역)
- `DraggableItemRemoverTool` (NOVA selector UI 패턴): `src/components/actual-data/` — `ChampionItemSidebar.ToolsSection`에서만 사용 (actual-data 영역)
- 두 영역이 분리되어 있어 NOVA selector UI 위치는 actual-data만 우선, builder는 후속 PR 권장.

### 3. PlacedChampion / PlacedUnit 스키마
- `PlacedChampion` (`src/types/index.ts:334`): boolean 필드 없음. `mfMode?: MfMode | null` 같은 optional 패턴 존재 → `novaStrikeSelector?: boolean` 추가 가능
- `PlacedUnit` (`src/lib/actualData/schema.ts:40`): zod schema. `novaStrikeSelector: z.boolean().optional()` 추가 (기존 데이터 호환 유지)

### 4. 분류 함수 (이미 존재)
- `src/lib/simulator/systems/item.ts:124-143` `getItemCategory()`
  - `apiName.startsWith('TFT17_AnimaSquadItem_')` → 현재 `'combined'` 반환 → `'animasquad'`로 분기
  - `apiName.startsWith('TFT17_Item_PsyOps_')` → 현재 `'combined'` 반환 → `'psyops'`로 분기
- `ItemCategory` union 타입에 `'animasquad' | 'psyops'` 추가 필요

## 작업 계획 (한 PR, 4 commits)

### Commit 1 — 아이템 탭 추가 (animasquad / psyops)
- `src/types/index.ts` — `ItemCategory` union 확장
- `src/lib/simulator/systems/item.ts` — `getItemCategory()` 분기 + `canEquipItem()`에 통과 처리
- `src/components/builder/ItemGrid.tsx` — `ItemTab` union 확장, `tabs` 배열에 라벨 추가, 필터 로직에 `tab === 'animasquad' | 'psyops'` 분기

### Commit 2 — NOVA selector schema + 시뮬 옵션 변환
- `src/types/index.ts` `PlacedChampion` 인터페이스에 `novaStrikeSelector?: boolean`
- `src/lib/actualData/schema.ts` `PlacedUnitSchema`에 `novaStrikeSelector: z.boolean().optional()`
- `src/app/api/simulate/route.ts` — request body에서 받아 `SimulateOptions`로 전달
- `src/hooks/useCombatAnalysis.ts` — `reconstruction.playerTeam`/`enemyTeam`에서 `novaStrikeSelector === true`인 unit의 `champion.apiName`을 옵션으로 변환 (양 사이트)
- (필요 시) reconstruction 함수에서 PlacedUnit boolean → PlacedChampion boolean 매핑 추가

### Commit 3 — UI tool + drop handler
- `src/types/index.ts` `DragData` union에 `'nova-selector'` toolKind 추가 (`{ type: 'tool'; toolKind: 'nova-selector' }`)
- `src/components/actual-data/DraggableNovaSelectorTool.tsx` — 신규 (`DraggableItemRemoverTool` 복제 패턴)
  - 아이콘: `/data/images/items/tft17_drxselector.tft_set17.png`
  - 제목: "타격 선택기 — N.O.V.A. 유닛에 드롭하면 타격 효과 적용"
- `src/components/actual-data/actualDndHandlers.ts` — `'nova-selector'` 핸들러 추가
  - drop 대상이 NOVA 5종(`TFT17_Aatrox/Caitlyn/Akali/Maokai/Kindred`)이 아니면 무시
  - 같은 팀 내 기존 selector 보유 unit의 boolean 해제 후 drop 대상에 set (단일성 보장)
- `src/components/actual-data/ChampionItemSidebar.tsx:177-180` `ToolsSection`에 `<DraggableNovaSelectorTool size={44} />` 추가
- (선택) drop된 unit에 시각적 마커(쉬머 보더 등) 추가 — `PlacedUnitTile`/`SetupBoardCore`

### Commit 4 — 회귀 가드 + 검증
- 새 가드 5건 (예시):
  - `getItemCategory(AnimaSquadItem) === 'animasquad'`
  - `getItemCategory(PsyOpsItem) === 'psyops'`
  - `ItemTab` union에 신규 키 존재 fingerprint
  - `DragData`에 `'nova-selector'` toolKind 존재 fingerprint
  - simulate API/useCombatAnalysis 옵션 전달 fingerprint
- `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 모두 통과 후 PR

## 리스크 / 결정 미정 항목

1. **PlacedUnit schema 확장 → 기존 저장 JSON 호환성**: optional이라 기존 데이터는 `undefined`로 안전. 새 필드 추가만으로 마이그레이션 불필요.
2. **builder 영역 NOVA selector UI**: 이번 PR에서 제외 (후속 PR로). builder는 unit-by-unit 패널이라 별도 UX 설계 필요.
3. **drop 시 중복 selector 처리**: 같은 팀에서 두 unit이 동시에 selector 가질 수 없도록 핸들러에서 강제 해제 (단일성).
4. **자동 할당 fallback 우선순위**: `combatLoop.ts:4070-4078` (옵션 명시 시 적용) 후 `4110-4111` (autoAssignNovaSelector — 옵션 없을 때만 실행)이 이미 올바르게 처리됨. 추가 변경 불필요.

## 재개 시 첫 액션

1. `git checkout feature/nova-selector-ui-trait-tabs && git pull origin dev` (혹시 dev 진행)
2. 본 문서 + 위 메모리(`project_nova_selector_ui_status.md`) 읽기
3. Commit 1부터 순차 진행
4. PR 제목 안: `feat(ui): N.O.V.A. 타격 선택기 UI 도구 + ItemGrid 동물특공대/초능력 탭 (PR8)`

## 참고 파일

- 자석 제거기 패턴: `src/components/actual-data/DraggableItemRemoverTool.tsx`
- drop 핸들러 예시: `src/components/actual-data/actualDndHandlers.ts:122-128`
- 기존 ItemGrid 탭 시스템: `src/components/builder/ItemGrid.tsx:16-72`
- `getItemCategory()` 분류: `src/lib/simulator/systems/item.ts:124-143`
- 자동 할당 코드 (수정 X): `src/lib/simulator/engine/combatLoop.ts:4080-4111`
