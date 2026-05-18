---
name: TFT Domain Wiki — Log
purpose: append-only 변경 기록 (ingest/lint/refactor 이벤트)
format: newest first
---

# TFT Domain Wiki — Log

## 2026-05-18

### Ingest: augments/leona-carry.md + augments/mordekaiser-carry.md — augments 폴더 정립
- **Source** (`feedback_wiki_ingest_verify` + 함수 컨텍스트 룰 적용):
  - `src/data/carryAugments.ts:171` (LeonaCarry entry) / `:238` (MordekaiserCarry entry)
  - `src/lib/simulator/engine/combatLoop.ts:614` (LEONA_CARRY_ABILITY const) — 함수 컨텍스트 read 로 발견
  - `src/lib/simulator/engine/combatLoop.ts:622-630` (getAbilityConfigForUnit flag 우선 분기 — duplicate config inconsistency 원인)
  - `src/lib/simulator/engine/combatLoop.ts:2249-2250` (applyHeroCarryTransforms leonaCarryActive set)
  - 공식 17.2 / 17.3 패치노트
- **선정 이유**: 10 carry augment 중 가장 패치 변경 많은 2개 (17.2 도입 → 17.2b → 17.3 3회 변경)
- **augments/ 폴더 컨벤션 정립** (schema.md 의 `augments/<id>.md` 첫 entry)
- **⚠️ 신규 Lint finding (위키 검출 6번째 사례) — LeonaCarry duplicate config inconsistency**:
  - `combatLoop.ts:614` `LEONA_CARRY_ABILITY` const `stun: 1.5`
  - `carryAugments.ts:171` `LeonaCarry.abilityOverride` `stun: 1.0`, abilityData `stunDuration: [1.0, 1.25, 1.5]` starLevel별
  - `getAbilityConfigForUnit:626` 가 `leonaCarryActive` flag 우선 분기 → legacy const 우선
  - 결과: starLevel별 stun duration 의도 (`[1.0, 1.25, 1.5]`) 가 sim 에 반영 안 됨. 1성/2성도 1.5초 적용
  - → 별도 sim 클린업 PR 후보 (옵션 A: const 제거 + flag 경로 우회 / 옵션 B: const 가 abilityData 참조 동적화)
  - **GragasCarry 도 동일 패턴 추정** (`GRAGAS_CARRY_ABILITY` const + `gragasCarryActive` flag) — 다음 PR (GragasCarry 페이지) 에서 verify
- **함수 컨텍스트 룰 가치 검증**: `grep LEONA_CARRY_ABILITY` 만 보고 const 정의 발견 → `getAbilityConfigForUnit` 함수 전체 read 로 flag 우선 분기 인식 → duplicate inconsistency 검출. 메모리 `feedback_wiki_ingest_verify` 의 "함수 컨텍스트 read" 룰이 정확히 작동
- **부수 갱신 — hero-augment-carry.md 표**:
  - LeonaCarry row: `baseDamageHpFrac 0.28` (drift) → `0.24` (17.3) + duplicate config lint 명시 + [[leona-carry]] 링크
  - MordekaiserCarry row: shield/mana 17.3 값 명시 + passive 미반영 명시 + [[mordekaiser-carry]] 링크
- **Cross-ref**:
  - `index.md` Augments 섹션 활성화 (_미작성_ → 2 entries)
  - `index.md` 작성 우선순위 갱신 (augments 나머지 8개로 1순위 — Gragas duplicate verify 가치 강조)
- **위키 lint 누적 (6건)**:
  1~5: 기존 (Fountain memory / "8 영웅 증강" / CLAUDE.md weight / dead code triad / carryAugments drift)
  6. **본 ingest — LeonaCarry duplicate config inconsistency**

### Ingest: patches/patch-17-2.md — Set 17 메이저 패치 계보 완결
- **Source** (`feedback_wiki_ingest_verify` 워크플로우):
  - 공식 17.2 패치노트 (URL 동일, 17.2 LIVE 본문 + 17.2b mid-patch 섹션 분리 추출)
  - `public/data/tft_set17_augments.json` (Mordekaiser/Gragas/Leona Carry raw entry verify — line 168/584/66)
  - `src/data/carryAugments.ts` (sim entry verify — line 238/254/171)
- **합성 범위**:
  - Trait 7카테고리 (Anima/Arbiter/Brawler/Challenger/Mecha/Psionic/Meeple/Stargazer/Timebreaker 리워크)
  - Champion ~30건 (1~5코 tier 별)
  - 신규 augment 5건 — **carry augment 3종 (Heat Death/Self-Destruct/Shieldmaiden) 게임 도입 시점** (sim 정식화는 17.2b)
  - 조정 augment ~20건, item/artifact emblem nerf 다수
  - System (Opening Encounters 리워크, Augment Distribution, God Armory, Loot)
  - Bug fixes 30+ (sim 관련 발췌)
- **패치 계보 명확화**:
  - 17.1 (Set 17 출시) → **17.2 (본 페이지)** → 17.2b → 17.3
  - 17.2 = carry augment 게임 도입 vs 17.2b = sim 정식화 — 두 시점 분리 명시
- **Cross-ref**:
  - `mechanics/stargazer-fountain.md` 패치 히스토리 17.2 LIVE row → `[[patch-17-2]]` 링크 + 공식 "Fountain pattern temporarily disabled" 인용
  - `patches/patch-17-2b.md` 도입부 → `[[patch-17-2]]` 부모 링크
  - `index.md` Patches 섹션 + 우선순위 갱신 (patch-17-2 완료 → augments 개별 페이지 1순위)
- **검증 / 미확정 항목**:
  - 17.2 LIVE 정확 날짜 — 공식 페이지 명시 없음
  - 챔프 stat ~30건 sim 코드 정합 — 위키 차원 일괄 verify 안 함 (PR #107 직전 PR 들 추정)
  - Divine Amendment augment sim 적용 상태
  - New Recruit 17.2 (team size+1 + 3 four-costs) vs 17.2b (four-costs 3→1) — `tft_set17_augments.json:8380` 신병 entry 가 17.2b 최종값인지 verify

### Ingest: mechanics/spell-crit.md
- **Source** (`feedback_wiki_ingest_verify` 워크플로우 — 코드 직접 grep 우선):
  - `src/lib/combat/spellCrit.ts` (computeSpellCanCrit / SPELL_CRIT_ITEMS / expectedSpellCritMultiplier / SPELL_CRIT_UNLOCK_BONUS)
  - `src/lib/simulator/engine/combatLoop.ts` (3 cast crit roll + 운명술사/Akali/Graves unit-level 분기)
  - `src/lib/analysis/itemOptimizer.ts:268-273` (estimateDps AP 분기 spellCritMul)
  - `src/lib/analysis/itemRecommender.ts:140` (flatStatBonus +400 프리미엄)
  - PDCA `docs/01-plan/features/spell-crit-mechanic.plan.md` (도입 시점/동기 기록용)
  - PDCA `docs/02-design/features/spell-crit-mechanic.design.md` (구조 참고)
- **합성 범위**:
  - 활성 조건 3 카테고리 (아이템 6종 / 시너지 / unit-level effect)
  - sim 3 cast 경로 crit roll 코드 위치 (line 6482/6595/7080)
  - 운명술사 Innate + (4) tier / Akali Precision (모든 아군) / Graves SharpshooterModule (위력)
  - DPS 추정 적용 (AP 분기 `expectedSpellCritMultiplier`)
  - 추천 적용 (`flatStatBonus` +400 + pickTopCombo / tagReason)
- **PDCA 상태 기록**: spell-crit-mechanic feature Phase: check, Match Rate 97% (세션 reminder 시점). 본 ingest 로 도메인 지식 위키 file back
- **Cross-ref**:
  - `index.md` Mechanics 섹션에 [[spell-crit]] 추가
  - `index.md` 작성 우선순위 갱신 (spell-crit 완료 제거, ability-pattern-internals 신규 후보 추가)
- **검증 / 미확인 항목** (페이지 내 명시):
  - `pickTopCombo` 조합 평가 + `tagReason` "스킬 치명타 언락" — design doc 명시 but 코드 직접 verify 안 함 → Lint 체크리스트 등록
  - Multi-hit 스킬 crit roll 횟수 — hitCount 마다 roll 인지 single roll 인지 미verify
  - non-damaging ability (실드/힐만) — crit roll 무시 분기 검증 필요

### Sim cleanup: Ability interface family 제거 (PR #117 후속, lint #4 보강)
- **Trigger**: PR #119 (`dc7137e`) 머지 완료 — 직렬 워크플로우
- **배경**: PR #117 는 위키 검출 triad 만 제거 (scope strict). PR #119 가 남은 `Ability` interface + 인접 type 까지 정리.
- **제거 (cascaded dead — 모두 호출처 0)**:
  - `EffectType` (7 string union)
  - `AbilityEffect` interface
  - `Ability` interface
  - **총 -18 lines** (PR #117 + #119 합산 -94 lines)
- **위키 갱신 내역**:
  - `mechanics/ability-targeting.md` 패치 히스토리 표에 PR #119 row 추가 (legacy ability 잔재 완전 제거)
  - Lint 체크리스트 — "Ability interface 자체 dead 검증 — 후속 정리 PR 후보" 항목 [x] 처리 + 커밋 `dc7137e` 명시
- **검증 (PR #119)**: pnpm lint/typecheck/build 통과 + `pnpm vitest run tests/unit/simulator/` 449 passed (변화 없음)
- **legacy ability 시스템 → AbilityConfig 통일 완결**: sim 어빌리티 경로가 architecture transition 완료된 상태로 정리됨 (`AbilityConfig` + `findAbilityTargets` 단일 경로)

### Lint resolved: AbilityTargetingType triad dead code (Lint finding 4 closed)
- **Trigger**: PR #117 (`bab401b`) 머지 완료 — 직렬 워크플로우 적용
- **위키 lint 사이클 완결 사례** (도입 후 2번째 full-cycle):
  - PR #113 [[ability-targeting]] ingest 가 dead code triad 3건 검출 (`AbilityTargetingType`, `findAbilityTarget` 단수, `Ability.targeting` 필드)
  - PR #117 (`bab401b`) — 3 식별자 sim 코드에서 제거 (-76 lines, 0 insertions)
  - 본 cleanup PR — 위키 표기 dead → resolved 갱신
- **위키 갱신 내역**:
  - `mechanics/ability-targeting.md` "⚠️ Lint finding — Dead code triad" 섹션 → "✅ Lint finding resolved — Dead code triad 제거" + 커밋 hash `bab401b` 명시
  - `mechanics/ability-targeting.md` 패치 히스토리 표에 "2026-05-18 (PR #117) — legacy triad 제거" row 추가
  - `mechanics/ability-targeting.md` Lint 체크리스트 — triad 항목 [x] 처리 + `Ability` interface 자체 dead 검증 후속 후보 추가
- **Scope strict (PR #117)**: `Ability` interface 자체도 dead 이지만 본 PR 범위 외 — 후속 정리 후보 (CLAUDE.md "Don't refactor beyond what task requires")
- **검증**: pnpm lint/typecheck/build 통과 + `pnpm vitest run tests/unit/simulator/` 449 passed (변화 없음 — sim 정확도 영향 없음 입증)
- **위키 lint 가치 검증 누적**:
  1. Fountain stale memory (PR #109 이전)
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건 (PR #112 로 해소)
  4. **AbilityTargetingType triad dead code (PR #117 + 본 cleanup PR 로 해소 ✅)**
  5. carryAugments.ts 17.3 drift (PR #115 + PR #116 로 해소 ✅)

### Lint resolved: carryAugments.ts 17.3 sim drift (Lint finding 5 closed)
- **Trigger**: PR #115 (`39cbce2`) 머지 완료 — 사용자 직렬 워크플로우 적용
- **위키 lint 사이클 완결 사례** (도입 후 첫 full-cycle):
  - PR #114 ingest 중 [[patch-17-3]] / [[hero-augment-carry]] 가 `carryAugments.ts` 17.3 drift 5+ entries 검출
  - PR #115 로 sim 정합 (Leona/Mord/Jax/Aatrox/IvernMinion 5건)
  - 본 cleanup PR — 위키 표기 drift → resolved 갱신
- **위키 갱신 내역**:
  - `patches/patch-17-3.md` "조정 Augments — Champion augments" 표: ⚠️ drift → ✅ PR #115 머지 완료. sim 정합 칼럼 추가 (✅/🔍 TODO)
  - `patches/patch-17-3.md` "Lint findings" 섹션: drift → resolved 표기 + 커밋 hash 명시
  - `mechanics/hero-augment-carry.md` "17.3 sim drift" 섹션 → "17.3 sim 정합" + PR #115 링크
  - `mechanics/hero-augment-carry.md` 패치 히스토리 17.3 row: "별도 PR 필요" → "PR #115 머지 완료"
  - `mechanics/hero-augment-carry.md` "시뮬 적용 상태" ✅ 활성 항목에 17.3 변경분 5건 정확 반영 추가
- **TODO 잔존 항목** (인게임 verify 후 후속 PR):
  - PoppyCarry Termeepnal AS 0.7 → 0.75 (augment grant vs statOverride 모호)
  - NasusCarry Bonk! resists 40 → 45 (statOverrides 채움 정책)
- **위키 lint 가치 검증 누적**:
  1. Fountain stale memory (PR #109 이전)
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건 (PR #112 로 해소)
  4. AbilityTargetingType triad dead code (별도 클린업 PR 대기)
  5. **carryAugments.ts 17.3 drift (PR #115 로 해소 ✅, 본 cleanup PR)**

### Major rewrite: patches/patch-17-3.md — 공식 패치노트 정상화 후 종합 ingest
- **Trigger**: 사용자 — "17.3 패치노트 정상화 됐을 것 같은데 찾아봐주라"
- **Source** (`feedback_wiki_ingest_verify` 워크플로우):
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-3/ (공식, 정상화 확인)
  - public/data/tft_set17_champions.json (Leona AR/MR 40 확인 등)
  - src/data/carryAugments.ts (17.2b 값 잔존 확인 — drift 검출)
- **이전 상태**: 46 lines, Fountain 만 다룸 + "추가 패치노트 별도 ingest 필요" 메모
- **변경 후**: ~230 lines, 7 카테고리 종합 (System/Traits/27 챔프/5 신규 aug/15+ 조정 aug/items/bug fixes)
- **해소된 미확정 항목**:
  - Fountain (3)/(5) AD/AP 4%/7% — 공식 확정 (이전 "CDragon 미노출" 상태)
  - Stargazer Huntress 좌상단 hex 추가 — 공식 확정 (이전 "별도 보드 데이터 작업" 표시)
- **⚠️ Lint finding (5번째 사례) — `carryAugments.ts` 17.3 drift**:
  - LeonaCarry baseDamageHpFrac 0.28→0.24, secondaryDamage [180,270,405]→[200,300,480]
  - MordekaiserCarry shield [225,250,300]→[175,200,400], mana 40/100→10/40
  - JaxCarry damage [155,230,375]→[170,250,450]
  - AatroxCarry secondaryDamage [100,150,225]→[110,165,275], slamDamage [160,240,360]→[200,300,475], singleTargetMultiplier 2.5→2.0
  - IvernMinionCarry hexReduction 0.45→0.35
  - PoppyCarry (Termeepnal) AS 0.7→0.75, NasusCarry resists 40→45
  → 별도 sim 정확도 PR 후보. PR #107 이 trait/champion json 갱신했으나 carryAugments.ts 누락.
- **부수 갱신**:
  - `mechanics/stargazer-fountain.md` — (3)/(5) 4%/7% 확정 섹션 추가 + 패치노트 공식 URL sources 추가 + Huntress hex 사실 (보드 작업 별도) + periodic heal (1%/2.5% per 2s) sim 적용 검증 추적 항목
  - `mechanics/hero-augment-carry.md` — 17.3 sim drift 5건을 Lint 섹션으로 추가 + 패치 히스토리 표의 17.3 row 갱신
- **위키 도입 후 lint 누적 (5건)**:
  1. Fountain stale memory (PR #109 이전)
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건
  4. AbilityTargetingType triad dead code (PR #113 ability-targeting)
  5. **본 ingest — carryAugments.ts 17.3 drift 5+ entries**

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
- **위키 도입 후 lint 누적 (4건, 본 ingest 시점)**:
  1. 메모리 `stargazer_fountain_inactive` stale claim
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건
  4. **본 ingest — AbilityTargetingType 트라이어드 dead code**

### Lint fix (PR #113 Codex P2): ability-targeting damageDecay/dot.duration "미완" 오기재 수정
- **Finding**: Codex 가 `damageDecay` 를 "미사용 같음 (별도 verify 필요)" 으로 적은 부분 지적. 실제 6 챔프 + combatLoop.ts:6479 active.
- **Verify (코드 grep)**:
  - `damageDecay`: TFT16_Yunara/Gangplank/Caitlyn/Ryze + TFT17_Gnar/AurelionSol 사용. `dmg *= (1 - decay)^ti` 적용.
  - 추가 verify — `dot.duration` 도 "일부만" 모호하게 적었으나 8 챔프 (Nasus/Talon/Pantheon/Viktor/Diana/AurelionSol/Bard/Morgana) + main(:6390) + OOR fallback(:7050) 양 경로 active.
- **Fix**: 두 필드 모두 "미완" → "활성" 섹션 이동, 구체적 사용처 + combatLoop 라인 명시.
- **자기-반성**: `feedback_wiki_ingest_verify` 워크플로우 위반. 페이지가 위키 lint 시작점인데 자체 fact 검증 누락. Codex가 정확히 catch — 자기-fix 패턴.

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
