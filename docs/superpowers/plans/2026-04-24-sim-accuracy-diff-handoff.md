# Sim Accuracy Diff — Session Handoff (2026-04-24)

> **이 문서의 용도**: 다른 세션/다른 컴퓨터에서 이 작업을 이어서 진행할 수 있도록 현재 상태,
> 중단 지점, 남은 작업을 정리. 새 세션은 이 파일 + 플랜 + 스펙만 읽으면 이어서 실행 가능.

## 어디서 작업 중?

- **원격 브랜치**: `origin/feature/sim-accuracy-diff` (dev에서 분기)
- **로컬 워크트리 (원본 머신)**: `/Users/kim/cursorProjects/tft_sim/.worktrees/sim-accuracy-diff`
- **다른 머신에서 이어받을 때**:
  ```bash
  git fetch origin
  git worktree add .worktrees/sim-accuracy-diff -b feature/sim-accuracy-diff origin/feature/sim-accuracy-diff
  cd .worktrees/sim-accuracy-diff
  pnpm install
  pnpm test --run        # baseline 228 passing 확인
  ```

## 핵심 문서 (새 세션에서 반드시 읽기)

1. **스펙**: `docs/superpowers/specs/2026-04-24-sim-accuracy-diff-design.md`
2. **플랜**: `docs/superpowers/plans/2026-04-24-sim-accuracy-diff.md`
   - 상단 **"Execution-time Corrections" (E1-E4) 섹션 필독** — 플랜 본문 코드 블록이 일부 실제 코드베이스와 맞지 않는 지점 보정
3. **후속 스펙 후보**: `docs/meta/sim-accuracy-followups.md` — 영상 자동 추출·시스템 귀속·Set 17 데이터 정합 노트

## 완료된 작업 (Phase 0-1)

브랜치에 쌓인 커밋 (dev 기반 위로):

| SHA | 요약 |
|-----|------|
| `1c75829` | docs: 설계 문서 |
| `94d8658` | plan: 27-task 구현 플랜 |
| `77df9a1` | plan errata E1-E4 추가 |
| `08d2b1e` | Phase 0: 성능 벤치 — **6ms/round** (N=10 안전) |
| `22d0a34` | Phase 1.1: `src/types/validation.ts` + `src/lib/validation/serverCatalogs.ts` |
| `4e8b661` | Phase 1.2: schemaAdapter TDD red — 6 unit + fixture 통합 테스트 |
| `2b8dbef` | Phase 1.3/1.4: `src/lib/validation/schemaAdapter.ts` 구현 |
| `d864454` | docs: Set 17 아이오니아 trait 부재 — 후속 노트 |

**테스트 통과**: 222/222 (baseline 214 + Phase 1 7 new + serverCatalogs 1)

**생성된 파일**:
- `src/types/validation.ts` — `Distribution`, `NumStats`, `HpStats`, `NRunInput`, `DamageDiff`, `SurvivorDiff`, `RoundDiff`, `GameDiff`, `hexKey`
- `src/lib/validation/serverCatalogs.ts` — `loadServerCatalogs()` 캐시된 sync 로더
- `src/lib/validation/schemaAdapter.ts` — `toNRunInput(round, catalogs?)` + 경고 생성
- `tests/unit/validation/serverCatalogs.test.ts`
- `tests/unit/validation/schemaAdapter.test.ts`
- `tests/calibration/simulate-round-bench.test.ts`

## 진행 중에 중단된 것 (⚠️ 다음 세션 가장 먼저 처리)

### E5. Set 17에 없는 레거시 trait 제거

**발견 사항** (실제 Set 17 trait 전수 확인 완료):
- 아이오니아 (Ionia) — **없음**
- 빌지워터 (Bilgewater) — **없음**
- 필트오버 (Piltover) — **없음**

Set 17 실제 trait 목록 (요약): `동물특공대, 태고족, 불한당, 도전자, 습격자, 기동총격여신, 파멸자, 메카, 별돌보미, N.O.V.A., 구원자, 길잡이, 말살자, ...`

**사용자 결정** (2026-04-24 세션 중단 직전): "`ioniaPath`, 빌지워터, 필트오버 지금 제거하고 진행"

**해야 할 일 (Phase 2 dispatch 전에 처리)**:

1. **`src/lib/validation/schemaAdapter.ts` 수정**:
   - `IONIA_TRAIT_KR`, `BILGEWATER`(없으면 건너뜀), `PILTOVER_TRAIT_KR` 상수 제거
   - 관련 warning 생성 루프 제거 (ionia/arbiter/piltover 3개 중 ionia·piltover 제거. arbiter는 Set 17에 존재하므로 유지)
   - `IoniaPathType` import 제거
   - `input.simulateOptions.playerIoniaPath / enemyIoniaPath` 매핑 제거
2. **`tests/unit/validation/schemaAdapter.test.ts` 수정**:
   - "emits warning when ioniaPath missing but ionia trait active" 테스트 제거
   - "passes ioniaPath when provided" 테스트 제거
3. **Plan 파일 수정** (`docs/superpowers/plans/2026-04-24-sim-accuracy-diff.md`):
   - Task 5.1 (schema 확장): `ioniaPath` 필드 추가 항목 제거. 남는 건 `survivors` + `augmentStacks` 2개
   - 관련 테스트 케이스(5.1 "accepts ioniaPath blades", "rejects unknown ioniaPath value") 제거
   - Task 5.4 (input UX): ioniaPath 드롭다운 추가 항목 제거
   - File Structure 표의 "ioniaPath" 언급 정리
   - `traitModules.ts` 언급은 남겨두되 Set 17 범위에선 arbiter만 유효하다고 노트
4. **Spec 파일 수정** (`docs/superpowers/specs/2026-04-24-sim-accuracy-diff-design.md`):
   - Q5 결정 테이블에서 `ioniaPath` 제거, "Set 17 필수 파라미터 2개 (augmentStacks + arbiterLaw 매핑)" 로 업데이트
   - Schema 확장 섹션에서 `ioniaPath` 필드 제거
   - 경고 규칙에서 ionia·piltover 제거
5. **`docs/meta/sim-accuracy-followups.md`** — "Set 17에 Ionia 없음" 블록은 유지 (Set 18 재등장 시 참고)
6. 모든 테스트 재통과 확인 (`pnpm test --run`)
7. 한 커밋으로 정리: `refactor(validation): Set 17 무관 trait(ionia/bilgewater/piltover) 제거`

## 남은 Phase (Phase 2 ~ 8)

각 Phase의 상세 태스크는 플랜 파일 참조. 아래는 dispatch 순서.

### Phase 2: nRunSimulator (Tasks 2.1-2.3) — 1 subagent

TDD red → green → smoke. 핵심 파일 `src/lib/validation/nRunSimulator.ts`.

**주의**:
- Test imports를 `loadServerCatalogs()` 사용 (플랜 코드 블록의 `loadAllChampions` 등 교체)
- Fixture는 `game-20260423-001.json`
- 챔피언 이름 검증 먼저 — 플랜은 `TFT17_Jinx`, `TFT17_Leona` 샘플 사용. 데이터에 있으면 OK, 없으면 실제 존재하는 Set 17 챔피언 2명으로 교체

### Phase 3: diffReporter (Tasks 3.1-3.2) — 1 subagent

TDD red → green. `src/lib/validation/diffReporter.ts`. Fake Distribution 픽스처로 6-7 단위 테스트.

### Phase 4: gameDiffer + API (Tasks 4.1-4.3) — 1 subagent

- `src/lib/validation/gameDiffer.ts` — **E4 준수 (loadServerCatalogs 사용)**
- `src/app/api/actual-data/[gameId]/compare/route.ts` — POST/GET/DELETE
- curl smoke test (dev 서버 띄워야 함)

### Phase 5: Schema 확장 + 입력 UX (Tasks 5.1-5.4) — 1 subagent

⚠️ E5 반영 후 실행. `survivors` + `augmentStacks`만 추가 (ioniaPath 제거됨).

UI 수정:
- PvPRoundEditor.tsx — 스택형 증강 옆 stack 입력
- 유닛 인스펙터 (ChampionItemSidebar.tsx 추정) — 생존/HP% 입력

### Phase 6: useCompareDiff + Inline summary (Tasks 6.1-6.3) — 1 subagent

- `src/hooks/useCompareDiff.ts`
- `src/components/validation/RunCompareButton.tsx`
- `src/components/validation/RoundDiffInlineCard.tsx` + PvPRoundEditor mount

### Phase 7: Compare page (Tasks 7.1-7.4) — 1 subagent

- `GameDiffSummaryCard` / `RoundDiffTable` / `RoundDiffDetailPanel` / `compare/page.tsx`

### Phase 8: 통합 + QA (Tasks 8.1-8.3) — 1 subagent + 수동

- `pnpm lint && pnpm typecheck && pnpm build && pnpm test --run`
- curl로 2게임 compare 실행 → `diff-*.json` git 포함
- 수동 QA 체크리스트 (편집·compare 페이지 동선, 상태 A/B/C 전환 등)

## 재개 지침 (새 세션용)

새 세션에서 이 작업을 이어받는 순서:

1. **브랜치·워크트리 체크아웃** (위 "다른 머신에서 이어받을 때" 참고)
2. **Baseline 테스트 확인**: `pnpm test --run` → 222 pass 확인
3. **이 handoff 파일 + 플랜 + 스펙 + followups 파일 읽기**
4. **⚠️ 먼저 E5 (ionia/bilgewater/piltover 제거) 처리** — 커밋 1개
5. 이후 Phase 2부터 순차 dispatch:
   - 각 Phase는 TDD 단위로 묶어 1개 subagent가 처리
   - 플랜의 E1-E4 ALWAYS 준수
   - 각 Phase 끝에 `pnpm test --run`으로 회귀 확인
6. 모든 Phase 완료 후 PR 열어 dev 병합

## 인수인계 체크리스트

- [x] 핸드오프 문서 작성
- [x] Plan + Spec + Followups 모두 브랜치에 포함
- [x] 이 문서도 브랜치에 commit
- [x] `origin/feature/sim-accuracy-diff` 원격 푸시 (2026-04-27 세션 종료)

## 2026-04-27 세션 결과

**E5 + Phase 2 ~ 8 모두 완료**. 커밋 19개 추가 (`dc995d3..HEAD`).

| 단계 | 커밋 SHA | 결과 |
|------|---------|------|
| E5 cleanup | `dc995d3` | ionia/bilgewater/piltover 제거 |
| Phase 2 | `c326ee8`, `98c244d` | nRunSimulator + smoke |
| Phase 3 | `a7897de`, `119d7d1` | diffReporter |
| Phase 4 | `55270d0`, `7755241` | gameDiffer + compare API |
| Phase 5 | `212db48`, `0eb1f67`, `8f26da9` | survivors/augmentStacks schema + UI |
| Phase 6 | `daa7ebf`, `8c6000d`, `60ac5db` | useCompareDiff + RunCompareButton + InlineCard |
| Phase 7 | `0eb46c0`, `c89c5fb`, `cd6cea7`, `dd95f23` | summary card + table + detail + page |
| Phase 8 | `47edd42`, `4728a7d` | compute-diff-cache 하네스 + 초기 캐시 |

**테스트**: 220 → **242 pass** (24 files). 매 커밋 직전 `pnpm lint && pnpm typecheck && pnpm build && pnpm test --run` 4 게이트 통과.

**초기 diff 결과 (game-20260423-001 N=10)**:
- pvpRoundCount: 22, winnerMatchRate: **45.5%** (10/22)
- avgPlayerDamageErrorPct: **-34.5%** (sim 이 실제 대비 낮음)
- weakSignalRoundCount: 1
- 사례: TFT17_Caitlyn actual=1168, simMean=7381 (+531% — sim 과대), TFT17_Aatrox actual=804 simMean=1095 (+36%)

이 신호가 v1 의 측정 목적 그대로 — 다음 단계는 시스템별 오차 귀속 분석 (followup 6).

**v1 미작업 / 후속 노트**:
- `arbiterLaw` 입력 UI 신규 추가는 미루고 followup 으로 기록 (`docs/meta/sim-accuracy-followups.md`)
- 두 번째 게임 (`game-20260424-001`) 은 worktree 에 부재 — 단일 게임으로만 캐시 생성
- React Compiler 의 `set-state-in-effect` 충돌 → `useCompareDiff` 에서 `void Promise.resolve().then(fetchCache)` microtask 우회 패턴 채택. 라인별 disable 0 건.

**수동 QA (브라우저)**: 사용자가 직접 수행 필요. dev 서버 띄운 상태에서 빠른 페이지 smoke 만 자동 수행:
- `GET /actual-data` → 200
- `GET /actual-data/game-20260423-001/compare` → 200 (페이지 렌더)
- `GET /api/actual-data/game-20260423-001/compare` → 200 (캐시 정상 반환)

## 참고

- **커밋 스타일**: `feat(validation): ...`, `test(validation): ...`, `refactor(validation): ...`, Co-Authored-By 꼬리표
- **CLAUDE.md 엄격 준수**: `pnpm lint && pnpm typecheck && pnpm build` 전부 통과해야 커밋
- **`eslint-disable` 금지** (calibration `console.log` 예외만 허용)
- **React Compiler 규칙**: `useEffect`에서 setState 금지 등
