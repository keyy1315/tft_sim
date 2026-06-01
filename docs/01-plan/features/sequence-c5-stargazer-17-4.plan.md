---
id: sequence-c5-stargazer-17-4
type: plan
status: planning (next session)
created: 2026-05-29
related:
  - "[[patch-17-4]]"
  - "[[stargazer-fountain]]"
  - PR #162 (sequence A — patch-17-4.md 신규 + Codex P1 catch)
  - PR #163 (sequence B 1차 — raw json fetch)
  - PR #164~#167 (sequence C 1~4차 — 4 sub-PR 머지)
---

# Sequence C-5 — Stargazer 17.4 sim 적용 plan

> **다음 세션 진행 작업서**. 본 세션 (2026-05-29) 에 분석은 완료, 실제 변경은 보류 (복잡도 + verify 필요 요인 多).

## 배경

PR #162 (sequence A) 시 Codex P1 catch fact: "Stargazer heal 2.5% → 3%".

WebFetch 공식 patch notes (2026-05-29 본 세션 재확인) 결과 — Stargazer 17.4 변경 **6건 발견** (Codex catch 한 1건보다 훨씬 다수):

| Sub-trait | 변경 | 출처 |
|-----------|------|------|
| **Fountain Healing** | 2.5% → **3%** | Codex P1 + WebFetch |
| **Fountain (5) Bonus AD/AP Per 2s** | 7% → **9%** | WebFetch |
| **Huntress Teamwide AS** | 15% → **12%** (너프) | WebFetch |
| **Huntress Stargazer AS** | 12/35/55% → **15/45/70%** (buff) | WebFetch |
| **Huntress Mark Number** | 3/5/7 → **3/5/9** | WebFetch |
| **Serpent Magic Damage** | 25/40/60% → **20/40/60%** (★1 너프) | WebFetch |
| **Mountain AS** | 10% → **8%** (너프) | WebFetch |
| **Mountain Durability** | 6% → **5%** (너프) | WebFetch |

→ **8 변경 사항** 실제 (Sub-trait 4개 × 평균 2 변경).

## 본 세션 분석 발견

### 1. Fountain Healing 2.5%→3% — periodic heal 분기 미구현 가능성

`docs/wiki/mechanics/stargazer-fountain.md:85` 명시:
> "강화 칸 아군 max HP 1% heal / 2초 + 별돌보미 추가 2.5% heal / 2초 — 현재 sim 의 cast-on-heal (`Fountain_HealPercent`) 외에 **별도 periodic heal 분기 미구현 가능성**. 코드 verify 필요"

즉:
- 기존 sim `Fountain_HealPercent` (raw 18/25/20%) = **cast-on-heal** (별돌보미가 cast 시 `totalAbilityDmg × HealPercent` heal). `combatLoop.ts:3391-3405` `applyStargazerEffects` Fountain 분기 + `combatLoop.ts:4938-4953` cast 후 heal 적용.
- "2.5%" 는 **periodic heal** (매 2초 정기) — sim 미구현
- 본 작업의 **핵심 challenge**: periodic heal 메커니즘 자체 sim 추가 필요

### 2. raw json 단위 vs patch notes 단위 매핑 불명확

예시:
- raw `Serpent_Poison`: tier 0 (3명)=0.30 / tier 1 (5명)=0.45 / tier 2 (7명)=0.60
- patch notes "25/40/60% → 20/40/60%" — tier 별인지 ★ 별인지 모호
- raw 의 30/45/60 → patch notes 의 25/40/60 도 단위 차이 (30 ≠ 25)

→ 인게임 측정 또는 raw spec 추가 source verify 필요

### 3. sub-PR 분리 필요

한 PR 에 묶기 어려움 — 각 sub-trait 의 sim 구현 / raw 매핑 / 테스트 회귀 등 별도 검증 사이클 필요.

## sub-PR 분리 plan (C-5a ~ C-5e)

### C-5a — Fountain Healing 2.5%→3% periodic heal 분기 신설

**가장 큰 작업** (3~5시간 예상).

**Plan**:
1. **periodic heal 메커니즘 설계**:
   - state field 신규: `unit.fountainPeriodicHealRate` (number, ratio per 2초)
   - main loop tick: 매 60 ticks (2초) 마다 강화 칸 별돌보미 + 강화 칸 아군 heal
   - 2 종류 분기: 일반 아군 = 1% max HP, 별돌보미 = 2.5% (→ 3% 17.4) max HP
2. `applyStargazerEffects` Fountain 분기에서 state field set
3. main loop tick `applyStargazerFountainPeriodicHeal` 신규 helper 호출
4. raw 매핑: 2.5%→3% 의 정확한 raw field 식별 필요 (`Fountain_HealPercent` 외 별도 hash `{c32af02f}: 0.05` 후보)
5. 테스트 추가 — periodic heal 정확 timing + value verify

**Verify 필요**:
- 강화 칸 detection (`isOnTile`) 정합
- 2초 주기 정확도 (main loop tick `% (2 * TICKS_PER_SECOND) === 0`)
- raw field 단위 (0.025/0.03 ratio vs 2.5/3 percentage)

### C-5b — Serpent_Poison ★1 너프

**가장 단순** (30분~1시간 예상, raw json 만).

**Plan**:
1. raw `Serpent_Poison` 의 ★ 또는 tier 매핑 verify:
   - 현재 raw: tier 0=0.30 / tier 1=0.45 / tier 2=0.60
   - patch notes "25/40/60% → 20/40/60%" 가 tier 별인지 ★별인지
2. `sim 적용 위치` grep — `applyStargazerEffects` Serpent 분기 / `triggerSerpentPoison` 등
3. raw json `Serpent_Poison` ★1 (tier 0?) 0.25 → 0.20 또는 0.30 → 0.20 적용
4. 회귀 가드 test

### C-5c — Huntress Teamwide AS + Stargazer AS + Mark Number

**중간 복잡도** (1~2시간 예상).

**Plan**:
1. raw 매핑:
   - `Huntress_AS_Teamwide`: 0.15 (모든 tier 동일) → 0.12 (너프)
   - `Huntress_AS` (Stargazer): 0.30/0.45/0.60 (tier 별?) → 0.15/0.45/0.70 (★ 별?) — 매핑 verify
   - `NumMarks`: 3/5/7 (tier 별) → 3/5/9
2. `applyStargazerEffects` Huntress 분기 + `applyHuntressEffects` 등 grep
3. raw json 갱신 + sim 자동 반영 verify

### C-5d — Mountain AS + Durability

**단순** (30분~1시간 예상).

**Plan**:
1. raw 매핑:
   - `Mountain_AS`: 0.10 → 0.08 (단위 ratio)
   - `Mountain_DR`: 0.06 → 0.05 (단위 ratio)
2. raw json 갱신
3. `applyMountainEffects` 또는 유사 helper 자동 반영 verify
4. mountain-effects.test.ts 등 회귀 가드

### C-5e — Fountain ADAP (5) 7% → 9%

**단순~중간** (1시간 예상).

**Plan**:
1. raw 매핑:
   - Fountain ADAP buff (별도 hash 필드 `{e5275a69}: 0.02/0.03/0.04` 등 후보)
   - tier (5) 만 변경 (7→9%)
2. sim 구현 여부 확인 (cast-on-ADAP 또는 periodic ADAP)
3. raw json 갱신 + helper 통합 또는 신설

## 실행 순서 (권장)

| # | sub-PR | 우선순위 | 예상 시간 |
|---|--------|----------|----------|
| 1 | **C-5d Mountain** | 낮음 (단순) — 먼저 시도해서 raw 매핑 verify 패턴 확립 | 30분~1시간 |
| 2 | **C-5b Serpent** | 낮음 (단순) | 30분~1시간 |
| 3 | **C-5c Huntress** | 중간 | 1~2시간 |
| 4 | **C-5e Fountain ADAP** | 중간 | 1시간 |
| 5 | **C-5a Fountain Healing periodic** | 가장 복잡 (sim 메커니즘 신설) | 3~5시간 |

→ 총 예상 시간: **6~10시간** (모든 sub-PR 진행 시)

→ 단축 옵션: C-5d/b/c 만 진행 (raw json 갱신 위주, 4~5시간)

## 본 세션 학습 적용 패턴

PR #162 (sequence A) 의 Codex P1 catch + PR #163 (sequence B 1차) 의 Codex P1+P2 catch + PR #164 (sequence C 1차) 의 Codex P2 catch + PR #165~#167 (Codex 응답 없음) 학습:

1. **WebFetch fact + Codex domain expert verify 양쪽 필요** — patch notes 추출 한계
2. **raw json 인덱싱 convention verify** — `readVarByStar` `isFiller` 분기 시뮬레이션
3. **helper 코드 raw vars read 패턴 verify** — "자동 sim 반영" 주장 시 grep 전수
4. **entity-specific special-case branch** — JaxCarry 패턴 / Galio 패턴 / Stargazer Fountain 패턴 등
5. **`apply<Trait>Effects` + `<field>Var` 패턴** — `durabilityVar` 같은 raw vars read 통합 (PR #165)

→ Sequence C-5 의 각 sub-PR 적용 시 위 5 패턴 모두 verify

## 핵심 verify 명령

```bash
# raw field 위치
grep -n "Stargazer_\|Fountain_\|Huntress_\|Serpent_\|Mountain_" public/data/tft_set17_traits.json | head -30

# sim helper read 패턴
grep -n "applyStargazerEffects\|Fountain_HealPercent\|Huntress_AS\|Serpent_Poison\|Mountain_AS" src/lib/simulator/engine/combatLoop.ts

# 테스트 회귀 가드
grep -rln "Stargazer\|Fountain\|Huntress\|Serpent\|Mountain" tests/unit/simulator/ | head -10

# patch wiki cross-ref
cat docs/wiki/mechanics/stargazer-fountain.md
```

## 관련 PR / wiki

- PR #162 — sequence A (patch-17-4.md 신규)
- PR #163 — sequence B 1차 (raw json fetch, traits.json deferred 명시)
- PR #164 — sequence C 1차 (JaxCarry damage)
- PR #165 — sequence C 2차 (Galio durability + OOR fix)
- PR #166 — sequence C 3차 (NOVA Akali/Kindred)
- PR #167 — sequence C 4차 (SpaceGroove EffectBonus)
- `docs/wiki/mechanics/stargazer-fountain.md` — Fountain 메커니즘 + periodic heal 미구현 표기 (line 85)
- `docs/wiki/patches/patch-17-4.md` — Trait 변경 표 + sim 적용 상태 표 (sequence C 4/5 = 80% 진행)

## 본 세션 종료 시점 진행도

- ✅ sequence A (PR #162)
- ✅ sequence B 1차 (PR #163) — 나머지 raw json 갱신 deferred (sequence B 후속)
- ✅ sequence C 1~4차 (PR #164~#167)
- ⏸️ sequence C-5 (Stargazer) — **본 plan 작성, 내일 진행**
- ⏸️ sequence C-6 (Jax FlatDR 단위 변환 — 도메인 verify 필요)
- ⏸️ sequence C-7 (NOVA Aatrox shredPct raw 매핑 — sequence B 후속)
- ⏸️ sequence D (Arbiter 대규모 개편 + Psionic) — 별도 큰 작업
