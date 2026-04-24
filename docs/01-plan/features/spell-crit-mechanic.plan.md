# Plan: 스킬 치명타 메커니즘 구현

> **Summary**: TFT 룰대로 보건/무대/정밀 계열 시너지 착용 시에만 스킬에 크리가 터지도록 엔진·DPS 추정·추천 3개 레이어에 crit 판정 추가.
>
> **Project**: tft_sim
> **Version**: 0.1
> **Author**: Dayoung
> **Date**: 2026-04-22
> **Status**: Draft
> **Source**: `docs/todo/spell-crit-mechanic.md` (2026-04-21 작성)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | TFT 룰상 스킬 크리는 보건(JeweledGauntlet)/무대(InfinityEdge)/정밀 계열 시너지 중 하나가 있어야만 터지는데, 현재 엔진·`itemOptimizer.estimateDps`·`itemRecommender` 3개 레이어 **전부 미구현**. 결과적으로 AP 캐리 실제 DPS 가 20~30% 과소평가되고, 추천 Top-3 에 보건/무대가 낮은 순위로 밀림 |
| **Solution** | (A) `CombatUnit.spellCanCrit` 플래그 추가 → 전투 시작 시 보건/무대/trait 착용 여부로 계산. (B) `combatLoop.ts:1966` ability 피해 계산 직후 `rng.next() < critChance` 판정 삽입. (C) `estimateDps` AP 분기 (line 256-265)에 `critMul` 곱하기 (AD 분기 line 269 와 대칭). (D) `itemRecommender.flatStatBonus` 와 `pickTopCombo` 에 "보건/무대 crit 언락" 조합 가중치 추가 |
| **Function UX Effect** | 시뮬레이션 결과가 실제 게임과 일치 (AP 캐리 피해 정상화). 추천 시스템이 AP 캐리에게 보건 또는 무대를 Top-3 에 자동 포함. 추천 이유 태그에 "스킬 치명타 언락" 추가 |
| **Core Value** | 시뮬레이션 정확도 ↑ — 프로젝트 핵심 철학("시뮬레이션 정확도 > 그래픽")에 직결. 현재 AP 캐리 DPS 과소평가는 모든 하위 기능(추천, 가상 매치 분석, DPS 캘리브레이션)에 연쇄 영향 |

---

## 1. Overview

### 1.1 Purpose

TFT 실제 룰에서 **스킬은 기본적으로 크리가 터지지 않는다**. 다음 조건 중 하나라도 만족해야 `unit.critChance` 확률로 `critMultiplier` 배율 크리가 발동한다:

- 보건 (JeweledGauntlet / CorruptedJeweledGauntlet / Radiant_JeweledGauntlet)
- 무대 (InfinityEdge / CorruptedInfinityEdge / Radiant_InfinityEdge)
- 정밀 계열 시너지 (Set 17 에는 해당 trait 없음 — 향후 확장 훅만 준비)

이 룰을 엔진/DPS 추정/추천에 모두 반영해 AP 캐리의 실제 전투력을 정확히 시뮬레이션한다.

### 1.2 Background

- 현재 엔진 `combatLoop.ts:1966` 의 ability 피해 계산은 `baseDmg * (1 + abilityDamageAmp)` 뿐 crit 판정 없음
- `itemOptimizer.estimateDps` AP 분기 (line 256-265) 는 `castFreq` 까지 계산하지만 `critMul` 곱셈 누락. **AD 분기 (line 269) 는 이미 `critMul = 1 + critChance*(critMultiplier-1)` 반영** — 비대칭 버그
- `itemRecommender.flatStatBonus` 는 `CritChance`/`CritDamage` effects 에 AD 가중치만 줌. 보건/무대의 "스킬 크리 언락" 조합 가치는 전혀 평가 안 됨
- 결과: AP 캐리(벡스, 리산드라, 아우솔, 갈리오 등) 추천에 보건/무대가 Top-3 에 들어오지 않음 — 실제 게임 메타와 큰 괴리

### 1.3 Related Documents

- TODO 원본: `docs/todo/spell-crit-mechanic.md`
- 관련 메모: `docs/meta/user_tft_knowledge.md` (유저 실전 지식 기반 버그 발견)
- 선행 작업: `docs/01-plan/features/estimateDps-magic-numbers.plan.md` (DPS 캘리브레이션)

---

## 2. Scope

### 2.1 In Scope

- [ ] `CombatUnit.spellCanCrit: boolean` 필드 추가 (`src/types/index.ts`)
- [ ] 전투 시작 시 플래그 계산 (`combatLoop.ts` 초기화 지점)
- [ ] ability 피해 계산에 crit 판정 삽입 (`combatLoop.ts:1966` + line 2200 근처 OOR 경로)
- [ ] `estimateDps` AP 분기에 `critMul` 곱셈 추가 (`itemOptimizer.ts:265`)
- [ ] `extractItemDpsModifiers` 에 `canSpellCrit` 플래그 추가
- [ ] `flatStatBonus` 또는 `pickTopCombo` 에 "AP 캐리 조합 내 보건/무대 포함" 가중치
- [ ] `tagReason` 에 "스킬 치명타 언락" 태그 추가
- [ ] 단위 테스트 2종: 엔진 crit 동작, 추천 Top-3 에 보건/무대 포함
- [ ] SPELL_CRIT_ITEMS 상수 공통 모듈에 정의 (중복 방지)

### 2.2 Out of Scope

- Set 별 "정밀" 계열 trait apiName 실제 등록 — 훅만 뚫어두고 빈 배열. 향후 Set 18+ 대응 시 추가
- 다단히트 스킬의 crit 확률 분리 (모든 히트가 동일 crit 판정 공유)
- 크리 확률 cap 처리 (`critChance > 100%` 는 현재 프로젝트 전반 미처리 상태 유지)
- Riot 공식 "스킬 크리 시 AD 크리와 별도 계수" 같은 서브룰 — 기본 `critMultiplier` 그대로 사용
- UI 표시 (크리 발생 시 이펙트/로그 하이라이트) — 기본 로그로 충분

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 내용 | 우선순위 | 상태 |
|----|------|---------|------|
| FR-01 | `CombatUnit` 에 `spellCanCrit: boolean` 필드 추가 | High | Pending |
| FR-02 | 전투 초기화 시 `unit.items` 에 보건/무대(기본/타락한/찬란한 6종) 있으면 `spellCanCrit = true` | High | Pending |
| FR-03 | `resolvedTraits` 또는 `activeTraits` 에 "정밀 계열" apiName 포함 시 `spellCanCrit = true` (훅만; Set 17 은 빈 배열) | High | Pending |
| FR-04 | `combatLoop.ts:1966` ability 피해 계산 직후 `if (unit.spellCanCrit && rng.next() < critChance) dmg *= critMultiplier` 적용 | High | Pending |
| FR-05 | OOR (out-of-range) ability 경로 (`combatLoop.ts:2200` 근처) 에도 동일 crit 판정 적용 | High | Pending |
| FR-06 | `extractItemDpsModifiers` 에 `canSpellCrit: boolean` 필드 추가 | High | Pending |
| FR-07 | `estimateDps` AP 분기 (line 256-265) 에 `canSpellCrit` 시 `critMul = 1 + critChance*(critMultiplier-1)` 곱하기 | High | Pending |
| FR-08 | `flatStatBonus` 에서 AP 캐리의 보건/무대 `bonus` 를 기존 대비 크게 상승 (crit 언락 프리미엄) | High | Pending |
| FR-09 | `pickTopCombo` 에서 AP 조합 평가 시 보건/무대 미포함이면 score 에 페널티 또는 `estimateDps` 재계산 시 `canSpellCrit=false` 반영 | Medium | Pending |
| FR-10 | `tagReason` 에 보건/무대 → "스킬 치명타 언락" 태그 추가 | Low | Pending |
| FR-11 | `SPELL_CRIT_ITEMS` 상수를 `src/lib/simulator/constants.ts` 또는 신규 `src/lib/combat/spellCrit.ts` 에 정의해 엔진/분석 3개 레이어가 공유 | Medium | Pending |

### 3.2 Non-Functional Requirements

| 카테고리 | 기준 | 검증 방법 |
|---------|------|---------|
| 결정론 | Replay 보장 — seed 동일 시 crit 결과 재현 | 동일 seed 2회 실행 후 damage 배열 일치 |
| 성능 | ability 피해 경로 <1% 오버헤드 | 1000 tick 전투 시뮬 벤치 전/후 비교 |
| 테스트 | 기존 테스트 통과 + 신규 2종 추가 | `pnpm test` 77 개 → 79 개 (최소) |
| Lint/빌드 | 전 항목 통과 | `pnpm lint && pnpm typecheck && pnpm build` |
| React Compiler 준수 | 순수 함수, 부작용 없음 | ESLint React Compiler 규칙 통과 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] FR-01 ~ FR-11 전부 Pending → Done
- [ ] 단위 테스트: AP 캐리(벡스 2성) 에게 보건/무대 있을 때 vs 없을 때 `castAbility` 20회 평균 피해 비교 → 없을 때 15~30% 낮음
- [ ] 추천 테스트: `getStaticRecommendations(vex, stats, 2, allItems)` 결과 Top-3 에 보건 또는 무대 포함
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과
- [ ] Design 문서 (`spell-crit-mechanic.design.md`) 작성 완료

### 4.2 Quality Criteria

- [ ] 기존 77개 테스트 무손실 통과
- [ ] 신규 crit 테스트 2종 결정론 보장 (동일 seed 재현 가능)
- [ ] `console.log` 커밋 없음
- [ ] `eslint-disable` 없음
- [ ] `Math.random()` 직접 사용 없음 (`rng.next()` 만 사용)

---

## 5. Risks and Mitigation

| Risk | 영향 | 확률 | Mitigation |
|------|------|-----|-----------|
| DPS 캘리브레이션 값(Part 2/3/4) 재측정 필요 | 중 | 중 | AP 분기 `critMul` 추가 후 `tests/calibration/calibrate-dps.test.ts` 재실행해 영향 계수만 갱신. 영향 없는 계수는 유지 |
| Replay 결정론 손상 (crit 판정이 기존 rng sequence 에 영향) | 고 | 저 | `rng.next()` 를 새 지점에서 호출하면 기존 snapshot 재현 깨짐 — migration 테스트로 검출하되, snapshot 파일 재생성 허용 (세이브된 replay 호환성은 보장 안 함) |
| 추천 Top-3 에 보건/무대가 과도하게 등장 (모든 AP 캐리에 일괄) | 중 | 중 | `flatStatBonus` 가중치를 너무 크게 주지 않고 실측 `estimateDps(AP critMul 반영)` 차이만으로도 순위 상승하는지 먼저 확인. 과보정이면 롤백 |
| 다단히트 스킬의 crit 공유 문제 | 저 | 중 | 현재 scope 외. 동일 히트 세트는 crit 결과 공유, 별 히트는 별도 판정 — 향후 확장 시 `CombatUnit.currentCastCrit: boolean` 캐시 추가 |
| `itemRecommender` 의 2차 엔진 검증(`verify`) 에서 crit 적용 후 variance 증가 | 중 | 중 | `runSims` 의 N 값 (현재 5~10) 을 유지하되 결과 표준편차 모니터링. 필요 시 N 상향 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| Starter | 단순 구조 | 정적 사이트 | ☐ |
| **Dynamic** | Feature-based modules | SaaS MVP, 풀스택 | ☑ |
| Enterprise | 엄격한 레이어 분리 | 대규모 트래픽 | ☐ |

**현재 프로젝트 Level**: Dynamic (session #28 에서 확정).

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| SPELL_CRIT_ITEMS 위치 | `itemOptimizer.ts` / `combatLoop.ts` / 신규 모듈 | **신규 `src/lib/combat/spellCrit.ts`** | 엔진/분석/추천 3개 레이어 공유 필요. 순환 의존 방지 |
| crit 판정 시점 | `baseDmg` 계산 후 vs `dmg` (amp 적용 후) | **`dmg = baseDmg * (1 + amp)` 직후** | 기본 공격 경로(line 1688) 와 일관성 유지 |
| 시너지 훅 | 상수 배열 / 함수 콜백 | **`hasSpellCritEnableTrait(activeTraits)` 함수** | Set 별 로직 확장성 확보 |
| 추천 가중치 | flatStatBonus 조정 / pickTopCombo 페널티 | **두 방식 모두** — flatStatBonus 는 개별 item 점수, pickTopCombo 는 조합 평가 | 계층적 반영이 더 정확 |
| AP critMul 공식 | `1 + critChance*(critMult-1)` (AD 와 동일) | **AD 와 동일** | 일관성, 향후 튜닝 단일 지점 |

### 6.3 Clean Architecture Approach

```
src/lib/combat/spellCrit.ts           ← 신규: 상수 + 헬퍼 (순수 함수)
├─ SPELL_CRIT_ITEMS (Set<string>)
├─ SPELL_CRIT_TRAIT_APINAMES (string[])  ← Set 17 에선 빈 배열
├─ hasSpellCritItem(items)
├─ hasSpellCritEnableTrait(traits)
└─ computeSpellCanCrit(unit, traits)

src/types/index.ts                    ← CombatUnit.spellCanCrit 추가
src/lib/simulator/engine/combatLoop.ts ← 초기화 + ability 피해 crit 판정
src/lib/analysis/itemOptimizer.ts     ← ItemDpsModifiers.canSpellCrit + AP critMul
src/lib/analysis/itemRecommender.ts   ← flatStatBonus + pickTopCombo 조합 가중치
tests/unit/spellCrit.engine.test.ts   ← 신규
tests/unit/spellCrit.recommender.test.ts ← 신규
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` 에 코딩 컨벤션 명시
- [x] React Compiler 규칙 (`react-hooks/set-state-in-effect` 등)
- [x] TypeScript strict mode, `any` 금지
- [x] 엔진은 `Math.random()` 직접 금지, `rng.next()` 만 사용
- [x] `console.log` 커밋 금지

### 7.2 Conventions to Define/Verify

| Category | Current | To Define | Priority |
|----------|---------|-----------|:--------:|
| **네이밍** | `computeX` / `hasX` / `isX` 관례 | `computeSpellCanCrit`, `hasSpellCritItem` 준수 | High |
| **상수 위치** | 파일 로컬 (`SPELL_CRIT_ITEMS`) 충돌 위험 | 신규 공유 모듈 `src/lib/combat/spellCrit.ts` | High |
| **rng 사용** | `rng.next() < critChance` 패턴 준수 (기본 공격 참고) | 동일 패턴 유지 | High |
| **테스트 seed** | `1234` / `42` 혼재 | 테스트별 명시적 seed | Medium |

### 7.3 Environment Variables Needed

없음. 순수 로직 변경.

### 7.4 Pipeline Integration

본 작업은 시뮬레이션 엔진/분석 레이어 보강이므로 9-phase pipeline 과 독립. Phase 4(API) 영향 없음.

---

## 8. Implementation Phases

TODO 원본의 3-Phase 계획을 그대로 승계한다.

### Phase A: 엔진 스킬 치명타 판정 (FR-01 ~ FR-05, FR-11)

1. `src/lib/combat/spellCrit.ts` 신규 생성 — `SPELL_CRIT_ITEMS` (6종), `SPELL_CRIT_TRAIT_APINAMES` ([]), 헬퍼 함수들
2. `CombatUnit.spellCanCrit: boolean` 필드 추가
3. `combatLoop.ts` 초기화 부분 — `unit.spellCanCrit = computeSpellCanCrit(unit, activeTraits)`
4. `combatLoop.ts:1966` 직후 crit 판정 삽입
5. `combatLoop.ts:2200` 근처 OOR ability 경로에도 동일 처리
6. 테스트 `tests/unit/spellCrit.engine.test.ts` — 벡스/리산드라 크리 유/무 비교

### Phase B: DPS 추정 보정 (FR-06, FR-07)

1. `ItemDpsModifiers` 인터페이스에 `canSpellCrit: boolean` 추가
2. `extractItemDpsModifiers` 에서 `SPELL_CRIT_ITEMS` 체크해 플래그 세팅
3. `estimateDps` AP 분기 (line 256-265) 에 `critMul` 곱셈
4. `tests/calibration/calibrate-dps.test.ts` 재실행 — AP 분기 영향 계수만 재조정

### Phase C: 추천 가중치 (FR-08, FR-09, FR-10)

1. `flatStatBonus` 에서 AP=true 이고 `item.apiName` ∈ SPELL_CRIT_ITEMS 이면 큰 bonus (+500 수준으로 시작, 실측 기반 튜닝)
2. 또는 `pickTopCombo` 에서 AP 조합 평가 시 `canSpellCrit` 동적 계산 → `estimateDps(stats, isAP, starLevel, combo, {canSpellCrit})` 시그니처 확장
3. `tagReason` 에 "스킬 치명타 언락" 추가
4. 테스트 `tests/unit/spellCrit.recommender.test.ts` — 벡스 2성 Top-3 에 보건 또는 무대 포함 검증

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`/pdca design spell-crit-mechanic`)
2. [ ] Phase A → B → C 순서 구현 (`/pdca do spell-crit-mechanic`)
3. [ ] Gap 분석 (`/pdca analyze spell-crit-mechanic`)
4. [ ] 필요 시 자동 반복 개선 (`/pdca iterate spell-crit-mechanic`)
5. [ ] 완료 보고서 (`/pdca report spell-crit-mechanic`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-22 | TODO → Plan 승격. 실제 코드 검증 기반 line 번호/공식 확정 | Dayoung |
