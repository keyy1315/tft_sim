---
name: TFT Domain Wiki — Log
purpose: append-only 변경 기록 (ingest/lint/refactor 이벤트)
format: newest first
---

# TFT Domain Wiki — Log

## 2026-05-18

### Ingest: mechanics/ability-targeting.md
- **Source** (`feedback_wiki_ingest_verify` 워크플로우 — 코드 직접 grep, doc 인용 없음):
  - `src/lib/simulator/systems/ability.ts:findAbilityTargets` + `AbilityConfig` 정의
  - `src/types/index.ts:AbilityPattern` (9종 union)
  - `src/types/index.ts:AbilityTargetingType` (8종 — dead 검출 대상)
  - `src/lib/simulator/systems/targeting.ts:findAbilityTarget` (singular — dead 검출 대상)
  - `src/lib/simulator/engine/combatLoop.ts` findAbilityTargets 3 호출 위치
- **합성 범위**:
  - 9 패턴 알고리즘 표 (single/line/aoe_circle/cone/multi/bounce/global/self_buff/x_shape)
  - 시스템 흐름 (findTarget → AbilityConfig → findAbilityTargets pattern 분기)
  - AbilityConfig 핵심 필드 (radius/maxTargets/dash/stun/heal/buff/debuff/hitCount/dot 등)
  - 패턴별 알고리즘 노트 (line 거리순 cap, multi primary 무시, bounce 누적 hit, x_shape diagonal)
- **⚠️ Lint finding (4번째 사례) — Dead code triad**:
  1. `AbilityTargetingType` (types/index.ts:396) — 8 string union, 어떤 코드/데이터도 set/read 안 함
  2. `findAbilityTarget` (singular, targeting.ts:71) — switch 8 케이스 구현되어 있으나 호출처 0
  3. `Ability.targeting` 필드 (types/index.ts:439) — `.targeting` 으로 읽히는 곳 없음
  → sim 정확도 영향 없음 (architecture transition 잔재). 별도 클린업 PR 후보 — index.md 우선순위 3번 등록.
- **Cross-ref**:
  - `index.md` Mechanics 섹션에 [[ability-targeting]] 추가
  - `index.md` 우선순위 갱신: 완료된 항목 (ability-targeting, CLAUDE.md) 제거, dead code 클린업 신규 후보 추가
- **위키 도입 후 lint 누적 (4건)**:
  1. 메모리 `stargazer_fountain_inactive` stale claim
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건
  4. **본 ingest — AbilityTargetingType 트라이어드 dead code**

### Ingest: mechanics/role-passive.md
- **Source**:
  - `src/types/index.ts` (UnitRole 6종 type)
  - `src/lib/simulator/systems/mana.ts` (ROLE_MANA_CONFIG + 3 gain helpers)
  - `src/lib/simulator/systems/targeting.ts` (TARGETING_WEIGHT + findTarget)
  - `src/lib/simulator/engine/combatLoop.ts` (FlatManaRestore aggregation, channelerInnateManaGain init)
  - CLAUDE.md (마나 / 타게팅 룰 — *stale claim 검출 대조군*)
- **합성 범위**:
  - 6 Role 마나 표 (공격당 / 초당 / 피격 시) — 코드 ground truth
  - 3 마나 gain 경로 흐름 (attack/tick/damage) + stun 차단 + 보너스 (FlatManaRestore, channelerInnateManaGain)
  - 타게팅 4단계 (taunt → 거리 → role weight → seed RNG)
  - role 변환 시 자동 따라오는 동작 ([[hero-augment-carry]] 와 cross-ref)
- **⚠️ Lint findings (CLAUDE.md vs 코드 stale 3건)**:
  1. **Targeting weight 5/6 role mismatch** — CLAUDE.md `Fighter/Marksman/Caster/Specialist=2, Assassin=1` vs 코드 `Fighter/Assassin=2, Marksman/Caster/Specialist=1`. 사용자 인지 필요 — Patch 15.1 spec 자체가 바뀐 건지 처음부터 잘못 적힌 건지 확인.
  2. **Specialist 마나 "고유"** — CLAUDE.md 표기, 코드는 표준 (10/0/false). spec vs sim 차이.
  3. **Caster CC-마나 차단** — CLAUDE.md "Caster 만", 코드는 모든 role 적용 (attack 자체가 stun 으로 막혀서).
- **Cross-ref**:
  - `index.md` Mechanics 섹션에 [[role-passive]] 추가
  - `index.md` 우선순위: CLAUDE.md 갱신을 신규 후보로 추가, ability-targeting 신규 후보 추가
- **Lint 가치 검증 (3번째)**: 위키 도입 후 stale 검출 사례 누적 — (1) Fountain inactive memory, (2) hero-augment-carry CARRY_AUGMENTS 8 vs 10건, (3) **본 ingest 의 CLAUDE.md weight/mana 표 3건**

### Ingest: mechanics/hero-augment-carry.md
- **Source**:
  - `src/data/carryAugments.ts` (CarryAugmentConfig + CARRY_AUGMENTS 10건)
  - `src/lib/simulator/engine/combatLoop.ts:applyHeroCarryTransforms` + `findStrongestUnitByApi`
  - `wiki/raw/in-game/set17-hero-augments.md` (사용자 인게임 측정)
  - `[[patch-17-2b]]` "Hero Augment Carry 시스템" 섹션
- **합성 범위**:
  - 변환 흐름 (role + statOverrides + ability override + flag)
  - findStrongestUnitByApi tie-break (성급 → 아이템 수 → deterministic)
  - CarryAugmentConfig 구조 (statOverrides 9 필드 + abilityData 27 변수)
  - CARRY_AUGMENTS 표 (10건 — augment / 챔프 / pattern / abilityData / statOverrides / 핵심 변수)
  - role 변환 시 자동 따라오는 것 (mana/AS baseline/타게팅 weight)
  - 패치 히스토리 (17.2 LIVE → 17.2b 도입 → PR7-A/B/C → N.O.V.A.)
  - 시뮬 적용 상태 (active/partial 분리)
  - 미완 (사용자 측정 대기 statOverrides, onKill hook 분기 등)
- **Cross-ref**:
  - `patches/patch-17-2b.md` "Hero Augment Carry 시스템" 섹션을 [[hero-augment-carry]] 링크로 축약 (17.2b 한정 변경분 3건만 남김)
  - `index.md` Mechanics 섹션에 [[hero-augment-carry]] 추가
  - `index.md` "작성 우선순위" 1번 제거 (완료) → 다음 후보는 patches/patch-17-2 또는 mechanics/role-passive
- **Lint 관찰**: CARRY_AUGMENTS 가 10건인데 plan doc 은 "8 영웅 증강"이라 표기 — 이 페이지에서 10건 (Nasus, 8 hero augment, Zed special) 명확화

### Lint fix (PR #110 Codex P2): patches 파일명 prefix 통일
- **Finding**: `patches/17-3.md` frontmatter `id: patch-17-3` 인데 파일명이 `17-3.md`. 다른 entity (traits/mechanics) 는 id와 파일명 일치. patches 만 prefix mismatch — `[[patch-17-3]]` Obsidian 링크 컨벤션 위반 (schema.md "id: 파일명과 일치" 규칙).
- **Verify**: `[[patch-17-3]]` / `[[patch-17-2b]]` 가 9개 파일 27곳 사용 중. id/링크 통일 필요.
- **Fix (옵션 A — 파일명 변경)**:
  - `git mv patches/17-3.md  patches/patch-17-3.md`
  - `git mv patches/17-2b.md patches/patch-17-2b.md`
  - 기존 27개 `[[patch-17-*]]` 링크는 그대로 정합
- **Schema 갱신**: `### patches/<id>.md` 섹션에 "파일명 `patch-` prefix 필수" 명시
- **위 entries 의 path 참조 (예: "Ingest: patches/17-2b.md") 는 append-only 원칙 상 그대로 보존** (그 시점 기준 사실)
- **Lint 가치 검증**: 위키 도입 후 첫 외부 review (Codex) 가 정확히 schema-implementation drift 를 잡음 — 향후 lint script 자동화 시 동일 패턴 검출 가능

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
