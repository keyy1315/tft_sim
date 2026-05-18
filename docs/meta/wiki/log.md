---
name: TFT Domain Wiki — Log
purpose: append-only 변경 기록 (ingest/lint/refactor 이벤트)
format: newest first
---

# TFT Domain Wiki — Log

## 2026-05-18

### Ingest: patches/17-2b.md
- **Source**: `docs/meta/set17-patch-17-2b-plan.md` (2026-04-30 plan doc)
- **합성 범위**:
  - 17.2b 실제 변경 내역 (증강 5건, 챔프 3건, 시너지 1건, 버그픽스)
  - sim 적용 PR 매핑 (#67, #68, PR2 신병)
  - 17.3 와의 차이 (Fountain 재활성화 등)
  - Hero Augment Carry 시스템 개요 (후속 ingest 후보로 명시)
  - 미완 항목 (사용자 인게임 측정 대기)
  - 데이터 수정 원칙 (`feedback_data_edit` 메모리)
- **제외**: PR 세션 핸드오프, cheat sheet, 작업 순서 등 plan-time noise
- **Cross-ref 추가**: `[[index]]` Patches 섹션, "작성 우선순위" 1번을 hero-augment-carry 로 갱신, `mechanics/stargazer-fountain.md` 17.2b row 에 `[[patch-17-2b]]` 링크
- **Verify**: 코드 grep 으로 5개 augment + 3개 챔프 변경 모두 실제 반영 확인 (`carryAugments.ts`, `disabledContent.ts`, `tft_set17_champions.json`, `tft_set17_augments.json` 신병 line 8380)
- **Archive 결정 대기**: plan doc `set17-patch-17-2b-plan.md` 삭제 여부는 사용자 컨펌 후

### Raw layer 도입: 5 파일 wiki/raw/ 이전
- **Rationale**: Karpathy 패턴 정합 — raw가 위키 내부에 self-contained.
- **Decision (사용자 합의)**: set17-* 9개 중 진짜 raw 5개만 이전. 나머지 4개(plan/audit/guide/gods-system)는 docs/meta/ 유지 후 점진 ingest.
- **이전 (git mv)**:
  - `docs/meta/set17-factory-new-arsenal.md` → `wiki/raw/lolchess/`
  - `docs/meta/set17-graves-factory-tree.md` → `wiki/raw/lolchess/`
  - `docs/meta/set17-stargazer-constellations.md` → `wiki/raw/lolchess/`
  - `docs/meta/set17-yasuo-tiles.md` → `wiki/raw/lolchess/`
  - `docs/meta/set17-hero-augments.md` → `wiki/raw/in-game/`
- **참조 갱신 (perl literal 치환)**: 11곳
  - wiki: `schema.md`, `index.md`(개정), `log.md`(이 파일), `traits/stargazer.md`, `mechanics/stargazer-fountain.md`
  - 외부: `tests/unit/simulator/hero-augment-stat-system.test.ts`, `docs/meta/set17-patch-17-2b-plan.md`, `docs/meta/simulator-synergy-todos.md`, `docs/superpowers/specs/2026-04-23-actual-data-design.md`, `docs/superpowers/specs/2026-04-27-stargazer-tile-overlay-design.md`, `src/data/factoryNewTree.ts`
- **신규**: `wiki/raw/README.md` (raw 카탈로그) + 5 폴더 (lolchess/in-game/cdragon/patch-notes/assets — 후 3개는 빈 폴더 placeholder)
- **schema.md 갱신**: 3-Layer 표 + Raw 폴더 컨벤션 섹션 추가
- **검증**: `grep -rn 'docs/meta/set17-(factory-new-arsenal|...)'` 잔여 0건

### Seed: Schema + Stargazer Fountain
- **Ingest origin**: Karpathy LLM Wiki pattern 도입 결정 (대화 합의)
- **Sources consumed**:
  - `docs/meta/wiki/raw/lolchess/set17-stargazer-constellations.md` (lolchess.gg 2026-04-23 추출)
  - 메모리 `stargazer_fountain_inactive.md` (2026-05-13 업데이트 = 17.3 active)
  - git log: `bfa7794`, `6321f98`, `e6d5365`, `059547c`, `08b5615` 등 Fountain 관련 커밋
  - `src/lib/simulator/engine/combatLoop.ts` (applyStargazerEffects, triggerFountainHeal)
- **Pages created**:
  - `schema.md`
  - `index.md`
  - `log.md` (이 파일)
  - `traits/stargazer.md`
  - `mechanics/stargazer-fountain.md`
  - `patches/17-3.md`
- **Rationale**: Stargazer Fountain 은 17.2 inactive → 17.3 active 로 상태가 바뀐 실제 사례. LLM Wiki 패턴의 lint/patch-history 가치를 즉시 검증 가능한 seed.
- **Follow-up**:
  - 메모리 `stargazer_fountain_inactive.md` 는 이미 17.3 기준으로 최신화되어 있음 → 위키 포인터로만 보강 (메모리 description 갱신)
  - 다음 ingest 후보는 [[index]] "작성 우선순위" 섹션 참조
