---
name: TFT Domain Wiki — Lint Rules
purpose: 위키 ingest 직후 lint subagent (`wiki-ingest-verifier`) 가 사용하는 단일 출처 룰셋
scope: docs/wiki/{champions,mechanics,augments}/*.md (carry-augment 만, 일반 augment 제외)
based_on: 자기-lint 9건 누적 (모두 Codex catch — self-catch rate 0%)
goal: self-catch rate ≥ 50% (P0 기준) in 6 PR
updated: 2026-05-27 (PR #160 룰 보강 #16/#17 적용 — traits frontmatter 각 entry 의 `apply<Trait>Effects` 패턴 grep 전수 verify / sim fix guidance 작성 시 적용 분기 명시 필수. PR #158/#159 학습 종합 — subagent 의 trait verify systematic 강화 + Codex domain expert catch 패턴 룰화)
---

# Wiki Ingest Lint Rules

## 목적

위키 ingest 시 9건의 lint case 가 누적되었으나 **전부 Codex review 가 catch** (self-catch 0%). 룰을 알아도 작성 단계에서 실행되지 않는 패턴이 반복 → reactive 진화. 본 문서는 사전 verify 강제용 **lint subagent** (`.claude/agents/wiki-ingest-verifier.md`) 가 참조하는 단일 룰셋이다.

본 문서는 **lint 관점** (negative verify, Codex-style). main agent 의 작성 워크플로우 (positive verify) 는 user-local 메모리 `feedback_wiki_ingest_verify` 가 담당 — 책임 분리.

## Scope (entity type 별 적용)

| Entity type | Path 패턴 | Lint 적용 | 비고 |
|-------------|----------|-----------|------|
| Champion | `docs/wiki/champions/*.md` | ✅ | 9건 중 5건 (cast path / starLevel / carry helper) |
| Mechanic | `docs/wiki/mechanics/*.md` | ✅ | 9건 중 3건 (trigger context / ground truth) |
| Carry augment | `docs/wiki/augments/*-carry.md` | ✅ | 9건 중 1건 (entity-wide multi-source) |
| 일반 augment | `docs/wiki/augments/*.md` (non-carry) | ❌ | 단순 fact lookup, lint case 0건. 발생 시 확장 |
| Trait | `docs/wiki/traits/*.md` | ❌ | lint case 0건. 발생 시 확장 |
| Patch | `docs/wiki/patches/*.md` | ❌ | lint case 0건. 발생 시 확장 |
| Item | `docs/wiki/items/*.md` | ❌ | 미작성. 발생 시 확장 |

확장 트리거: trait/patch/item lint case **1건 발생 즉시** scope 추가.

## Severity Tier

Codex review vocabulary 와 정렬. lint output 은 반드시 tier 부여.

| Tier | 의미 | 처리 |
|------|------|------|
| **P0** | sim 회귀 / 잘못된 fact / 검증 실패 (ground truth 부정합) | **commit 전 fix 필수** |
| **P1** | 의미는 맞으나 부정확 표현 / 출처 누락 / 좁은 주장 (multi-source 미명시) | follow-up PR 허용, 단 본 PR 에서 가능하면 fix |
| **P2** | wording / frontmatter wording / cross-ref 누락 / nice-to-have | 다음 ingest 사이클에서 정리 가능 |

## 5단계 Verify Rule (모든 entity 공통)

Lint subagent 는 페이지에 적힌 모든 fact / 코드 참조 / sim 효과 주장에 대해 다음 순서로 검증.

### 0. Entity set 소속 (champion / mechanic / carry-augment 모두)

작업 대상이 set17 entity 인지 raw json 으로 확인.

- **Champion**: `public/data/tft_set17_champions.json` 에서 `TFT17_<id>` prefix entry 존재 확인
- **Carry augment**: `src/lib/simulator/carryAugments.ts` 등에서 entry 존재 확인
- **Mechanic**: 코드 ground truth (예: `targeting.ts:TARGETING_WEIGHT`) 존재 확인

#### 0-sub. Conditional augment `disable: true` verify (PR #152 retro pilot 도입)

페이지에 **"특정 augment 활성 시" 효과** (예: "Concentration augment 활성 시 Duration 6초") 주장이 있으면 그 augment 의 `disable` 필드를 0단계 part 로 확인:

```bash
# 권장 (structure-aware, robust) — node -e
node -e "const j=require('./public/data/tft_set17_augments.json'); const a=j.augments.find(x=>x.apiName==='TFT17_Augment_<Name>'); console.log({apiName: a?.apiName, disable: a?.disable})"

# 또는 jq (structure-aware)
jq '.augments[] | select(.apiName == "TFT17_Augment_<Name>") | {apiName, disable}' public/data/tft_set17_augments.json

# grep fallback — entry 크기 (set17 max 31 line) 보다 큰 window + 첫 disable 만
grep -A 50 '"apiName": "TFT17_Augment_<Name>"' public/data/tft_set17_augments.json | grep -m1 '"disable"'
```

⚠️ **grep window 주의** (PR #153 codex P2 catch): `-A 20` 같은 작은 window 는 entry size 가 21 line 이상인 augment (예: `TFT17_Augment_Weightlifting` apiName line 671 → disable line 692, gap 21) 를 miss → false finding 또는 downgrade 누락. set17 max augment entry size 31 line 기준 `-A 50` 안전 마진. **가능하면 node -e / jq 사용**.

`"disable": true` 면 해당 augment 는 set17 inactive — **그 augment 활성 시 효과 미반영은 sim 영향 0** (자동 무효). 본문에 그 사실 명시 권장. M1 사례 (`mordekaiser.md` AugmentedDuration → Concentration `disable: true`) 가 도입 배경.

❌ **금지**: `docs/01-plan/features/` plan 파일 존재만으로 후보 선정 — 이전 set 작업물 잔존 가능

❌ **금지**: 한글 이름 list 만으로 검증 — 한글 이름과 apiName 이 미스매치 가능 (`TFT17_Galio = 거대 메크 로봇`, `TFT17_Reksai = 렉사이` 등)

✅ **허용 패턴**:
```bash
node -e "require('./public/data/tft_set17_champions.json').champions.find(c => c.apiName === 'TFT17_X')"
# 또는
grep -n "TFT17_X" public/data/tft_set17_champions.json
```

### 1. 좁은 grep — 식별자 정의/사용 위치

```bash
grep -rn "<식별자>" src/
```

페이지에 등장하는 모든 코드 식별자 (함수명 / 변수명 / 상수명 / api_name) 의 정의·사용 위치 추출.

### 2. 함수 컨텍스트 read — 트리거/조건/타이밍

추출 라인이 단순 정의/할당이면 **그 함수 전체 read** 로 트리거/조건/타이밍 확인.

> **예시**: `u.spellCanCrit = true` 한 줄 → if 블록 + 함수 시그니처 + 함수 호출처 1회 확인. PR #121 사례에서 `tickDrxNova` 함수 컨텍스트 누락 → "Akali 어빌리티 시전 시" 로 잘못 주장 (실제는 DRX N.O.V.A. surge 트리거).

### 3. Entity-wide grep — 좁은 식별자 외 entity 이름 자체

`grep "MordekaiserCarry"` 만 ❌ → `grep "Mordekaiser"` 도 함께 ✅.

엔티티 이름으로 wider grep 하면 specific helper (`applyMordekaiserProcCast`, `tickMordekaiserProc` 등) 가 raw vars 직접 read 하는 multi-source drift 발견.

> **예시**: PR #123 — `carryAugments.ts entry` 만 보고 "단일 source" 단정 → 실제는 entity-specific helper 가 raw `unit.champion.ability.variables` 별도 read. PR #115/#116 미반영 검출.

### 4. 호출 순서 / 영향 범위 trace (sim 코드 변경 / override 주장 시)

변경되거나 주장되는 필드 / 값이:

- **누가 set** 하는가? (직접 set, calculateStats, applyXxxEffects 등)
- **누가 read** 하는가? (단일 read 가정 금지)
- **호출 순서** 는? (item bonus → augment override → trait effect → ...)
- **절대값 override 가 기존 시스템을 손실시키는가?** (Tear/Blue Buff item mana 손실 등)

손실되면 → **delta 보존 / 적용 위치 이동 / 우선순위 명시** 중 선택.

#### 4-sub: Cast path 3종 전수 확인 (PR #129 도입)

Cast 관련 동작 (stun apply / damage apply / debuff / dot / shield 등) 은 **3 cast path 에 별도 분기**:

1. **Main pipeline** (`combatLoop.ts` cast 메인)
2. **OOR (out-of-range) fallback** dash cast
3. **Recast** (`onKill` 재시전)

한 곳만 fix 시 range-dependent / kill-pattern-dependent 회귀 발생. **반드시 위키 [[ability-targeting]] 의 "3 호출처" 정보를 참고**.

✅ **검증 패턴**:
```bash
grep -n "config\.<field>\|outOfRangeConfig\.<field>\|recastConfig\.<field>" src/lib/simulator/engine/combatLoop.ts
```

### 5. Actual sim integration verify (sim 효과 주장 시 필수, PR #128 도입)

페이지에 "X 효과가 적용된다" 라고 주장하기 전에:

- 주장된 효과 (예: "starLevel별 stun 1.0/1.25/1.5 적용") **를 실현하는 main pipeline read 위치** 가 실제 존재하는가?
- **entry 값 변경 + config 정합 ≠ sim 효과**. main pipeline 이 그 값을 read 하는 위치까지 grep 으로 trace.
- "entry 정합" / "config 단일 source" 는 **저장소 정합 + 1차 read 정합** 까지만 의미. starLevel별 / 조건부 / 다단계 효과는 별도 verify.

❌ **금지**: "abilityData 에 정의돼 있음" → "sim 적용됨" 결론

✅ **검증 패턴**:
```
효과 주장: "abilityData.stunDuration starLevel별 적용"
verify: grep -n "abilityData\.stunDuration\b" src/lib/simulator/engine/combatLoop.ts
  → IvernMinion 분기에만 사용 (line ~1234)
  → 다른 carry (LeonaCarry 등) 의 stunDuration 은 sim 미반영 → P0 finding
```

read 위치 없으면 → 본문에 "🔍 sim 효과 검증 필요" 표기 또는 신규 lint case 등록.

## Entity-type 별 추가 Checklist

5단계 공통 룰에 더해 entity type 별 특이 fail mode.

### Champion (`docs/wiki/champions/*.md`)

| Check | 빈도 | 사례 |
|-------|------|------|
| `TFT17_<id>` set17 entry 존재 (0단계) | 항상 | 한글-apiName 미스매치 catch |
| Carry augment 활성 시 role 변환 확인 | 카리 augment 가진 champ | Jax: APTank → Fighter 변환 |
| `<Champion>Carry` raw helper 함수 multi-source (`apply<X>Cast`, `tick<X>Proc`) | 항상 | Mordekaiser helper 가 raw vars 직접 read |
| starLevel별 ability variables (`[1.0, 1.25, 1.5]`) 의 main pipeline read site | 항상 | Leona stunDuration 미반영 (#9) |
| Cast path 3종 (main / OOR / recast) 각 분기 일관성 | cast 변경 시 | Leona OOR stun 누락 (#9 amend) |
| 절대값 stat override (`maxMana`, `maxHp` 등) 의 calculateStats 이후 호출 순서 | override 적용 시 | Mordekaiser mana 40 override → Tear 손실 (#7) |
| Base ability variables 의 starLevel별 sim 적용 여부 (ShieldAP/FlatDR/MaxHealth 등) | 항상 | Jax base 5건 / Nasus base 4건 lint 후보 |
| **Carry augment 활성 시 abilityData self-buff / damage modifier 가 base raw vars 보다 우선 read 되는지 verify** (룰 #11/#12 cross-ref, PR #155 도입) | carry augment 가진 champ | Mordekaiser shield 는 `mordekaiserCarryShield` 패턴 ✅. Leona / 다른 carry 도 동형 패턴 필요 (#154 #10/#11) |
| **본문에 P0 lint case (sim 미반영) 등록 시 frontmatter `sim_active: active` 유지 → P1 raise + `partial` 강등 권장** (룰 #15, PR #155 도입) | P0 lint case 등록 시 | champion 페이지에 base ability vars sim 미반영 lint case (Jax L1~L5 등) 등록 시 sim_active 강등 검토 |
| **`traits` frontmatter 각 entry 에 대해 `apply<Trait>Effects` 함수 / `unitHasTrait(u, '<TraitName>')` 분기 grep 전수 verify** (룰 #16, PR #160 도입) | 항상 (모든 trait entry) | Poppy `traits: [정령족, 요새]` 양쪽 모두 `applyBastionEffects` (`combatLoop.ts:1817`) + `applyAstronautEffects` (`:1951+`) 정상 통합인데 페이지가 "별도 verify 필요" 잘못 표기 (PR #159 self-catch P1 + Codex P2 추가 catch). 모든 trait entry 별 `apply` helper 존재 시 → 그 fact 본문에 반영, 미존재 시만 "verify 필요" 표기 |
| **sim fix guidance 작성 시 적용 분기 명시 필수** (룰 #17, PR #160 도입) | Lint 후보 fix 항목 작성 시 | Blitzcrank Lint B1 "UppercutDamage 미반영 → `secondaryDamageVar: 'UppercutDamage'` 추가" 권장 잘못 — `secondaryDamageVar` 는 per-target loop 적용이라 AoE 모든 target 에 over-damage (PR #158 Codex P2 catch). fix guidance 는 **(a) primary target 단독 / (b) per-target loop / (c) cast-time 1회 helper** 중 어느 분기인지 명시 필수 |

### Mechanic (`docs/wiki/mechanics/*.md`)

| Check | 빈도 | 사례 |
|-------|------|------|
| 코드 ground truth 인용 (CLAUDE.md / 다른 wiki 인용 금지) | 항상 | `targeting.ts:TARGETING_WEIGHT` 인용 |
| 트리거 함수의 컨텍스트 (단순 grep 라인 ❌, 함수 시그니처 + 호출처) | 항상 | spell-crit `spellCanCrit = true` → `tickDrxNova` (#1) |
| `<field>` "미사용 같음" 추정 표기 시 grep 전수 확인 | 추정 표기 시 | `damageDecay` "미사용 추정" → 실제 6 챔프 + combatLoop active (#2) |
| 패치별 active/inactive 분기 (current_patch_status frontmatter 와 본문 정합) | 항상 | Stargazer Fountain 17.2 inactive → 17.3 active |
| **Entity summary 표 (carry 표 / 시너지 표 / 챔프 표) → entity 페이지 / 코드 ground truth cross-check** (룰 #13, PR #155 도입) | 항상 | hero-augment-carry `IvernMinion hexReduction 0.45` 표 stale → 코드 0.35 (#154 P0-3) |
| `[[other-page]]` 링크 깨짐 / orphan | 항상 | dead link lint |

### Carry augment (`docs/wiki/augments/*-carry.md`)

| Check | 빈도 | 사례 |
|-------|------|------|
| `<X>Carry` entry 외 entity 이름 wider grep (helper 함수 multi-source) | 항상 | Mordekaiser helper 가 carryAugments 외 read (#3) |
| `selected single-carry` semantics (Layer 1 state/stack flag + Layer 2 abilityOverride 가드) | onKill / cast cycle 변경 시 | PR #135/#136 학습 |
| `selfBuff` 필드 부재로 인한 sim no-op | new carry 도입 시 | Zed: selfBuff 부재 + damage 미반영 (#13) |
| Cast path 3종 cycle/x_shape 일관성 | cycle/recast carry | Aatrox/Pyke follow-up verify |
| 17.2 → 17.2b → 17.3 변경 누적 fact 정합 | 패치 boundary 페이지 | 3회 연속 변경 보존 |
| **abilityData self-buff 필드 (`shield` / `shieldDuration` / `heal` / `damageReduction`) main pipeline cast-time apply 분기 read site verify** (룰 #11, PR #155 도입) | self-buff 필드 정의 시 | Leona shield/duration → raw `ShieldAmount` 우선 read (#154 #10). Mordekaiser 패턴 (`mordekaiserCarryShield` 필드) 차용 fix 필수 |
| **abilityData damage modifier 필드 (`baseDamageHpFrac` / `tankBonusMultiplier` / `armorScale` / `singleTargetMultiplier` / `hexReduction`) 의 main pipeline read site 진입 가드 (`&&` 조합) 전수 확인** (룰 #12, PR #155 도입) | damage modifier 필드 정의 시 | Leona baseDamageHpFrac → `baseDamageHpFrac && hexReduction` AND 가드로 미진입 (#154 #11) |
| **신규 carry augment 도입 시 관련 mechanic page (spell-crit / mana / cast path / role-passive) 의 cast roll / trigger / 호출처 리스트 stale 검증 + last_verified 갱신** (룰 #14, PR #155 도입) | 신규 carry / cast path 변경 시 | Jax carry hero augment (PR #135/#147) 가 5번째/6번째 spellCanCrit cast roll 추가 → spell-crit.md last_verified 갱신 누락 (#154 P1-1) |
| **본문에 P0 lint case (sim 미반영) 등록 시 frontmatter `sim_active: active` 유지 → page-internal contradiction P1 raise + `partial` 강등 권장** (룰 #15, PR #155 도입, 룰 #8 의 carry-augment / champion 일반화) | P0 lint case 등록 시 | leona-carry frontmatter active ↔ 본문 Lint #10/#11 등록 모순 (#154 codex P2) |
| **sim fix guidance 작성 시 적용 분기 명시 필수** (룰 #17, PR #160 도입, 룰 #11/#12 보강) | Lint 후보 fix 항목 작성 시 | Blitzcrank B1 "UppercutDamage `secondaryDamageVar` 추가" guidance 잘못 — per-target loop 적용 (PR #158 Codex P2 catch). fix guidance 는 적용 분기 (primary single / per-target / cast-time 1회 helper / combat-start helper) 명시 필수 |

## Page-internal Cross-check (PR #152 retro pilot 도입)

같은 entity / 같은 fact 가 페이지의 **여러 line 에서 모순 표기** 될 때 단일 finding 으로 통합 처리.

### 사례 (mordekaiser.md pilot)

같은 trait "전달자" 가:
- line 102 "전달자 — 시너지 stat 보강 분기 (Tank 보조)" (부정확)
- line 142 "전달자 trait 효과 — sim 별도 분기 verify 필요" (부정확, 실제는 통합 완료)
- line 145 "전달자 trait 의 정확한 효과 ... — sim 통합 위치 verify 필요" (부정확)
- line 171 "(사용자 verify) 전달자 trait 효과 + sim 통합 위치" (부정확)

→ 4 line 모두 같은 fact 의 다른 표기. 4개 finding 으로 잘게 raise 하지 말고 **단일 finding 으로 통합** ("전달자 trait 표기 부정확 — 본문 4 line 영향, 일괄 정정 필요"). 권장 fix 도 통합 patch 로.

### 룰

- 같은 entity (trait / champ / mechanic / augment) 의 같은 fact 가 페이지 내 다중 line 에 등장 시 → **단일 finding + 모든 영향 line 명시**
- 모순 (line A "X 적용" + line B "X 미적용") 발견 시 → P1 이상 priority + Page-internal contradiction 명시
- frontmatter 와 본문 모순 (예: `sim_active: true` + 본문 "🔍 검증 필요") → 단일 finding, frontmatter 정정 + 본문 정정 동시 권장
- **본문에 P0 lint case (sim 미반영) 등록 시 frontmatter `sim_active: active` 유지** → page-internal contradiction P1 raise + `partial` 강등 권장 (룰 #15, PR #155 도입). 본 룰셋 #8 (PR #146 mechanic-level 보수적 minimum) 의 carry-augment / champion 일반화. **사례**: leona-carry frontmatter active ↔ 본문 Lint #10/#11 등록 모순 (#154 codex P2)

## Lint Output 형식 (subagent → main agent)

```markdown
## Lint Result: <page-path>

**Entity type**: <champion | mechanic | carry-augment>
**Verify 수행 단계**: 0 ✅ / 0-sub ✅ / 1 ✅ / 2 ✅ / 3 ✅ / 4 ✅ / 4-sub cast path ✅ / 5 ✅
**Finding 통계**: raised P0 <N> / P1 <M> / P2 <K> / **downgraded known** <D>

### P0 (commit 전 fix 필수)
- **[Finding name]** — 본문 위치 (line 또는 섹션 헤딩; 다중 line 영향 시 모두 명시)
  - 주장: "<인용>"
  - 검증: <grep / read 결과>
  - 회귀 위험: <sim 영향>
  - 권장 fix: <action>

### P1 (follow-up 허용)
- ...

### P2 (다음 사이클; informational 포함)
- ...

### Downgraded known findings (false-positive 방지 작동 사례)
- **[#lint-history-num 또는 self-raised lint name]** — 본문 표기 ("PR #XYZ resolved" / "🔍 검증 필요" / "disable: true 자동 무효") + 코드 verify 결과로 downgrade
- ...

### Self-verify check
- 9건 lint history 유사 패턴: #번호 인용
- 본 lint 가 놓쳤을 가능성 영역: <명시>
- 보강 권장 룰 (있으면): <항목>
```

## Lint History (학습 사례)

### Codex catch 9건 (self-catch 0% 시기)

| # | PR | Entity type | Finding | 5단계 중 catch 단계 | Tier |
|---|----|-----------|--------|--------------------|------|
| 1 | #111 | augment | CLAUDE.md weight 표 인용 → stale 전파. 실제 `targeting.ts:TARGETING_WEIGHT` 다름 | 1 (좁은 grep) | P0 |
| 2 | #113 | mechanic | `damageDecay` "미사용 같음" 추정 → 실제 6 챔프 + `combatLoop.ts:6479` active | 1 (좁은 grep) | P0 |
| 3 | #121 | mechanic | `u.spellCanCrit = true` → "Akali 어빌리티 시전 시" 추정. 실제 `tickDrxNova` DRX N.O.V.A. surge 트리거 | 2 (함수 컨텍스트) | P0 |
| 4 | #123 | augment (carry) | `grep "MordekaiserCarry"` 만 보고 "단일 source" 단정 → `applyMordekaiserProcCast` / `tickMordekaiserProc` 가 raw vars read | 3 (entity-wide grep) | P0 |
| 5 | #124 | champion | `statOverrides.mana = 40` 절대값 override → `calculateStats` 이후 호출 시 Tear-based item mana 손실 | 4 (호출 순서 trace) | P0 |
| 6 | #128 | augment (carry) | "starLevel별 stun [1.0/1.25/1.5] sim 적용" 주장 → 실제 `config.stun` fixed 만 read. `abilityData.stunDuration` 은 IvernMinion 분기 전용 | 5 (integration verify) | P0 |
| 7 | #129 amend | augment (carry) | Main pipeline stun fix → OOR cast path `outOfRangeConfig.stun` 분기 fix 누락. range-dependent 회귀 | 4-sub (cast path 3종) | P0 |
| 8 | #146 | mechanic | mechanic-level `sim_active: true` 가 sub-entity partial 상태를 가림 | 0 + frontmatter | P1 |
| 9 | #149 P2 | champion | "Galio set17 아님" 잘못 표기 — 한글 이름 list 만으로 검증, apiName grep 누락 | 0 (set 소속) | P1 |

### Subagent self-catch 신규 (PR #154 retro lint 5 페이지, 2026-05-26)

| # | PR | Entity type | Finding | 5단계 중 catch 단계 | Tier | 상태 |
|---|----|-----------|--------|--------------------|------|------|
| 10 | #154 (등록) | augment (carry) | `leona-carry.md`: `shield [200,240,280]` + `shieldDuration 2s` 가 carry abilityData 에만 정의, main pipeline `getAbilityShield` fallback 이 raw vars (`ShieldAmount`) 우선 read → carry 의도 미반영 | 5 (integration verify) + 3 (entity-wide grep) | P0 | 도메인 verify 대기 (인게임 측정 / 패치노트) |
| 11 | #154 (등록) | augment (carry) | `leona-carry.md`: `baseDamageHpFrac 0.24` sim 분기 (`combatLoop.ts:6329`) 진입 가드 `baseDamageHpFrac && hexReduction` AND 가드로 인해 LeonaCarry (hexReduction 없음) 미진입. maxHP 24% 가산 sim 영향 0 | 4 (호출 순서 / 진입 가드) + 5 (integration verify) | P0 | 도메인 verify 대기 |

### Subagent self-catch 신규 (PR #159 그린필드 운영, 2026-05-27)

| # | PR | Entity type | Finding | 5단계 중 catch 단계 | Tier | 상태 |
|---|----|-----------|--------|--------------------|------|------|
| 12 | #159 (등록) | champion | `poppy.md`: 요새 (Bastion) trait `applyBastionEffects` (`combatLoop.ts:1817-1850`) 정상 통합인데 페이지가 5 line 에서 "별도 verify 필요" 잘못 표기 | 5 (integration verify) + Page-internal cross-check (5 line 통합 finding) | **P1** | 본 commit fix 완료 — 🎯 **첫 subagent P1 self-catch** |
| 13 | #159 fix-2 | champion (Codex 추가 catch) | `poppy.md`: 정령족 (Astronaut) trait `applyAstronautEffects` (`combatLoop.ts:1951+`) 정상 통합인데 페이지가 "별도 verify 필요" 잘못 표기 (#12 와 동일 패턴, subagent 누락 → Codex P2 raise) | 5 (integration verify) — subagent 가 요새는 catch 했으나 정령족 누락 | P2 (Codex) | 본 fix-2 commit fix 완료 — 룰 #16 도입 trigger |

### Subagent prompt 보강 사례 (P2 catch, infra self-evolution)

| PR | catch 주체 | Finding | Tier | 해소 |
|----|----------|--------|------|------|
| #153 | Codex (P2) | lint-rules.md 0-sub 의 grep `-A 20` fallback window 부족 → entry size ≥ 21 line augment (`Weightlifting`) miss. node -e / jq / `-A 50` + `grep -m1` 로 강화 | P2 | PR #153 fix commit `a4c1d90` ✅ |
| #154 | Codex (P2) | leona-carry frontmatter `sim_active: active` ↔ 본문 P0 Lint #10/#11 등록 (sim 미반영) 모순. 본 룰셋 #8 (PR #146 mechanic-level 보수적 minimum) 의 carry-augment / champion 일반화 누락 | P2 | PR #154 fix commit `3e0412d` + **신규 룰 #15** 등록 (PR #155) ✅ |
| #155 | Codex (P1+P2) | subagent grep 패턴 3건 — recursive `-r` flag 누락 (silent fail) + BRE `\?` quantifier (optional chaining `?.` 매칭 실패) + `damageReduction` 필드 grep 누락 | P1+P2 | PR #155 fix commit `092ad94` ✅ — ERE `[?]` 문자 클래스로 교체 |
| #158 | Codex (P2) | blitzcrank.md Lint B1 "UppercutDamage `secondaryDamageVar` 추가" fix guidance 잘못 — `secondaryDamageVar` 는 cast resolution per-target loop 적용이라 AoE 모든 target 에 over-damage. primary-target-only 패턴 필요 (helper 또는 별도 abilityOverride 필드) | P2 | PR #158 fix commit `7125fba` + **신규 룰 #17** 등록 (PR #160) ✅ |
| #158 | Codex (P3 ×2) | blitzcrank.md (a) 누적 lint count 산술 mismatch (`11건 활성` → `13건` 5+4+1+3 계산 정정) + (b) BoltDamage fallback typo `cooldownArr[1]` → `damageArr[1]` (combatLoop.ts:1647 실제 코드) | P3 | PR #158 fix commit `7125fba` ✅ |
| #159 | Codex (P2) | poppy.md 정령족 (Astronaut) trait `applyAstronautEffects` (`combatLoop.ts:1951+`) 통합 인지 누락 — subagent 가 요새는 P1 catch 했으나 정령족 누락. 동일 패턴 부정확 표기. trait verify systematic 강화 필요 | P2 | PR #159 fix commit `09e8dc2` + **신규 룰 #16** 등록 (PR #160) ✅ |

### 룰 보강 #11~#15 (PR #155 적용 완료, 2026-05-26)

본 5건 보강은 PR #154 retro lint + Codex catch 학습. lint-rules.md (entity-type checklist + Page-internal Cross-check) + `.claude/agents/wiki-ingest-verifier.md` (실행 절차 + 핵심 패턴 + 금지 사항) 양쪽 동시 갱신.

| # | 룰 | 도입 사례 | 적용 위치 |
|---|----|----------|-----------|
| #11 | carry abilityData self-buff 필드 (shield / shieldDuration / heal / damageReduction) — main pipeline cast 시점 self-buff apply 분기 read site verify | Lint #10 (Leona shield, Mordekaiser 동형 재발) | Entity-type checklist "Carry augment" + "Champion" cross-ref |
| #12 | carry abilityData damage modifier 필드 (`baseDamageHpFrac` / `tankBonusMultiplier` / `armorScale` / `singleTargetMultiplier` / `hexReduction`) — 각 필드의 main pipeline read site 진입 가드 (`&&` 조합) 전수 확인 | Lint #11 (Leona baseDamageHpFrac && hexReduction AND 가드) | Entity-type checklist "Carry augment" + "Champion" cross-ref |
| #13 | mechanic 페이지의 entity summary 표 ↔ entity 페이지 / 코드 ground truth cross-check | PR #154 P0-3 (hero-augment-carry `IvernMinion hexReduction 0.45` 표 stale) | Entity-type checklist "Mechanic" |
| #14 | 신규 carry augment 도입 시 관련 mechanic page (spell-crit / mana / cast path / role-passive) 의 cast roll / trigger / 호출처 리스트 stale 검증 + last_verified 갱신 | PR #154 spell-crit.md P1-1 (Jax carry 가 cast roll 호출처 2개 추가했으나 mechanic page last_verified 갱신 누락) | Entity-type checklist "Carry augment" |
| #15 | 본문에 P0 lint case (sim 미반영) 등록 시 frontmatter `sim_active: active` 유지 → P1 raise + `partial` 강등 권장 (룰 #8 의 carry-augment / champion 일반화) | PR #154 codex P2 (leona-carry self-rule violation) | Entity-type checklist "Carry augment" + "Champion" + Page-internal Cross-check 룰 |

### 룰 보강 #16/#17 (PR #160 적용 완료, 2026-05-27)

본 2건 보강은 PR #158/#159 그린필드 운영 + Codex catch 학습. lint-rules.md (entity-type checklist Champion + Carry augment 양쪽) + `.claude/agents/wiki-ingest-verifier.md` (핵심 패턴 Champion grep + 금지 사항) 양쪽 동시 갱신.

| # | 룰 | 도입 사례 | 적용 위치 |
|---|----|----------|-----------|
| #16 | champion 페이지의 `traits` frontmatter 각 entry 에 대해 `apply<Trait>Effects` 함수 / `unitHasTrait(u, '<TraitName>')` 분기 grep 전수 verify — 각 trait 별 systematic check (요새, 정령족, 선봉대 등) | PR #159 Lint #12 (요새 subagent self-catch P1) + #13 (정령족 Codex P2 추가 catch — subagent 누락) | Entity-type checklist "Champion" + subagent 핵심 패턴 Champion grep section |
| #17 | sim fix guidance 작성 시 적용 분기 **(a) primary target 단독 / (b) per-target loop / (c) cast-time 1회 helper / (d) combat-start helper)** 명시 필수 — 패턴 잘못 선택 시 over-damage / under-damage 회귀 | PR #158 Codex P2 (Blitzcrank Lint B1 "UppercutDamage `secondaryDamageVar` 추가" guidance per-target loop 적용 → AoE over-damage) | Entity-type checklist "Champion" + "Carry augment" 공통 + subagent 금지 사항 |

> Codex catch 9건 (PR #111~#149) self-catch 0% → 룰셋 도입 후 PR #154 retro 에서 신규 P0 2건 self-catch (Lint #10/#11) + PR #156/#158/#159 그린필드 운영. **PR #159 가 첫 P1 self-catch 발생** (요새 trait Bastion). 룰 #16/#17 적용 (PR #160) 후 다음 champion ingest 부터 운영 적용. 6 PR 평가 target ≥ 50% self-catch (현재 3/6 PR 운영, P0 분모 0 / P1 분자 1).

## 워크플로우 진화

| 시점 | 룰 추가 | 도입 PR |
|------|---------|---------|
| 초기 | 1단계 좁은 grep + verify | — |
| 2026-05-XX | 2단계 함수 컨텍스트 read | #121 (spell-crit Akali) |
| 2026-05-XX | 3단계 entity-wide grep | #123 (Mordekaiser helper) |
| 2026-05-XX | 4단계 호출 순서/영향 trace | #124 (mana override item 손실) |
| 2026-05-XX | 5단계 actual integration verify | #128 (starLevel별 read site 부재) |
| 2026-05-XX | 4-sub cast path 3종 전수 | #129 (OOR stun 누락) |
| 2026-05-21 | 0단계 entity set 소속 (apiName grep) | #149 P2 (Galio 한글 list 누락) |
| 2026-05-26 | **본 룰셋 single source 화 + lint subagent 도입** | PR #152 |
| 2026-05-26 | 룰 #11~#15 도입 (carry self-buff field / damage modifier 진입 가드 / mechanic summary cross-check / mechanic page sync / sim_active partial 강등) | PR #155 |
| 2026-05-27 | **첫 P1 self-catch metric 발생** (요새 trait Bastion, poppy.md) | PR #159 |
| 2026-05-27 | 룰 #16/#17 도입 (traits frontmatter `apply<Trait>Effects` grep 전수 verify / sim fix guidance 적용 분기 명시 필수) | PR #160 |

## Self-catch Metric (6 PR 평가)

다음 champion / mechanic / carry-augment ingest 부터 lint subagent dispatch. 6 PR 후 다음 metric 산출.

| 평가 PR | Date | Page | Subagent P0 catch | Subagent P1 catch | Subagent P2 catch | Subagent downgraded known | Codex P0 catch | Self-catch rate (P0) |
|---------|------|------|-------------------|-------------------|-------------------|---------------------------|----------------|----------------------|
| (retro pilot) | 2026-05-26 | champions/mordekaiser.md | 0 (전부 downgrade) | 1 (전달자 trait) | 3 | 3 | 0 (이미 머지) | N/A (retro) |
| (retro #154) | 2026-05-26 | augments/leona-carry.md | 2 (#10 shield/duration, #11 baseDamageHpFrac) | 2 (sources stale) | 2 (line drift) | 3 (#6/#9/disable) | 0 (이미 머지) | N/A (retro) |
| (retro #154) | 2026-05-26 | augments/mordekaiser-carry.md | 0 (전부 downgrade) | 0 | 2 (line drift + frontmatter wording) | 4 (#3/#5/#7/명시적 보류) | 0 (이미 머지) | N/A (retro) |
| (retro #154) | 2026-05-26 | mechanics/spell-crit.md | 0 (전부 downgrade) | 1 (3→5 cast 호출처) | 2 (line drift + pickTopCombo) | 2 (#1 trigger / 정밀 trait 빈 배열) | 0 (이미 머지) | N/A (retro) |
| (retro #154) | 2026-05-26 | mechanics/ability-targeting.md | 0 (전부 downgrade) | 0 | 3 (line drift + frontmatter + multi 예시) | 2 (#2 damageDecay / Ability dead) | 0 (이미 머지) | N/A (retro) |
| (retro #154) | 2026-05-26 | mechanics/hero-augment-carry.md | 1 (#13 → IvernMinion hexReduction 0.45 stale) | 1 (legacy flag 4개 제거됨) | 3 (line drift 3건) | 3 (#1 weight / #10 Pyke / Mord radius) | 0 (이미 머지) | N/A (retro) |

**Retro 합계 (6 페이지)**: raised P0 **3** / P1 **5** / P2 **15** / downgraded known **17** / Codex P0 catch **0** (모두 이미 머지된 페이지). 9건 lint history 패턴 catch rate: 100% (false-positive 룰 정상 작동).

### 그린필드 운영 진행도 (2026-05-27 기준, 3 PR)

| 평가 PR | Date | Page | Subagent P0/P1/P2 | Codex P0/P1/P2-3 | Self-catch rate (P0) | 비고 |
|---------|------|------|-------------------|------------------|----------------------|------|
| 1 | 2026-05-27 | champions/zed.md (PR #156) | 0 / 0 / 3 (line drift) | 0 / 0 / 0 (응답 없음) | N/A (P0 분모 0) | false-positive 룰 정상 작동 (downgraded known 4). 첫 그린필드 |
| 2 | 2026-05-27 | champions/blitzcrank.md (PR #158) | 0 / 0 / 3 (metadata: state field count / fixture 라벨 / helper count) | 0 / 0 / 3 (P2 fix guidance + P3 count + P3 typo) | N/A (P0 분모 0) | 룰 #17 trigger (Codex P2 fix guidance) |
| 3 | 2026-05-27 | champions/poppy.md (PR #159) | 0 / **1 (self-catch ★)** / 1 | 0 / 0 / 1 (정령족 trait 동일 패턴) | N/A (P0 분모 0) | 🎯 **첫 P1 self-catch** (요새 trait Bastion) + 룰 #16 trigger (Codex P2 정령족 동일 패턴 subagent 누락) |
| 4~6 | 미정 | 다음 champion / mechanic / carry-augment ingest | TBD | TBD | TBD | 3 PR 더 필요 (룰 #16/#17 적용 효과 측정 시작) |

**그린필드 합계 (3 PR)**: subagent P0 **0** / P1 **1** (self-catch) / P2 **7** / downgraded known **15** / Codex P0 **0** / Codex P1 **0** / Codex P2-3 **4** (모두 무해 metadata / fix guidance / typo / 동일 패턴 누락 — P0/P1 회귀 없음).

Target: **self-catch / (self-catch + Codex) ≥ 50%** (P0 기준).

**현 상태 (P0)**: 0/0 = **N/A** (P0 분모 0 — 그린필드 운영 페이지 모두 P0 raise 없음, false-positive 룰 정상 작동 + 작성 단계 자기 verify 효율적).

**현 상태 (P1)**: 1/1 = **100%** (subagent P1 1건, Codex P1 0건 — 단 분모 작음). 룰 #16 적용 (PR #160) 후 동일 패턴 (trait verify 누락) 재발 시 self-catch 비율 유지 예상.

미달 시: subagent prompt 강화 / 5단계 룰 추가 / cast path 4종 이상 확장 검토.

### Pilot 검증 결과 (2026-05-26)

mordekaiser.md retro pilot 으로 subagent 동작 검증:
- ✅ 신규 P1 finding 1건 catch — "전달자 trait 효과 sim 별도 분기 verify 필요" 부정확 표기 → 실제 `TFT17_ManaTrait` `InnateManaGain` integration 완료 발견 (`combatLoop.ts:524-529 / 5549`, `mana.ts:36-41`)
- ✅ Known finding (#3 entity-wide helper / #7 mana override) 모두 false-positive 룰로 정상 downgrade
- ✅ 본문 self-raised M1 lint (Concentration AugmentedDuration) 도 `disable: true` verify 후 P2 downgrade
- Cost: 페이지당 Read 6회 + grep 9회 ≈ 15 tool call, sonnet 적정

### Pilot 발견 prompt 보강 (4건, 본 룰셋 + subagent 에 적용 완료 2026-05-26)

| # | 항목 | 적용 위치 |
|---|------|-----------|
| 1 | **Page-internal cross-check** — 같은 entity 가 페이지의 여러 line 에서 모순 표기 시 단일 finding 으로 통합 | "Page-internal Cross-check" 섹션 + Lint Output 형식 ("다중 line 영향 시 모두 명시") |
| 2 | **Line 번호 인용 정책** — 허용 + drift > 10 line 시 P2 informational | "허용 / 금지" 섹션의 line 정책 sub-section |
| 3 | **Conditional augment `disable` 0단계 verify** | "0. Entity set 소속" 의 0-sub section |
| 4 | **False-positive downgrade 통계 필드** | "Lint Output 형식" 의 통계 라인 + "Downgraded known findings" 섹션 |

## 허용 / 금지

### ✅ 허용

- 코드 ground truth (`src/...:identifier`) — **함수명 + line 번호 둘 다 허용** (이동 편의성). 단 line drift 시 P2 informational lint 가능 (아래 정책 참조)
- Raw source (`public/data/tft_set17_*.json`, `docs/wiki/raw/`)
- 패치노트 공식 URL
- PR/commit 참조 (`#PR번호`, short hash)
- PDCA plan/design — **도입 시점/동기 기록용으로만** (도메인 fact 는 코드 verify)

#### Line 번호 인용 정책 (2026-05-26 결정)

위키 페이지의 line 번호 인용 (`combatLoop.ts:524-529` 등) **허용**. 위키 22 페이지 (champion 4 + augment 10 + mechanic 5 + patch 3) 의 line 인용 관행 유지.

- subagent 가 lint 시 인용 line 의 함수 여전히 존재하는지 grep 으로 확인 (선택적)
- 인용 line 과 실제 함수 위치 **drift > 10 line** 인 경우만 **P2 informational** finding ("last_verified 업데이트 + line 번호 갱신 권장")
- drift ≤ 10 line 또는 함수 자체 위치 변경 없음 → finding 불요
- 함수 자체가 사라진 경우 (rename / 삭제) → **P0** (fact 의 ground truth 부재)

### ❌ 금지

- CLAUDE.md / 다른 wiki 페이지 / docs/meta/ 의 plan·audit·guide 문서를 **도메인 fact 출처로 인용**
- "관련 룰: 다른 페이지 참조" 식으로 fact 본체 위임 (cross-ref OK, 단 핵심 수치는 본문에 직접 verify 한 값)
- Grep 한 줄만 보고 fact 단정 (함수/조건 가드/타이밍 검증 없이)
- 좁은 식별자 grep 만 보고 단일 source 단정 (entity-wide grep 누락)
- 절대값 override 추가 시 호출 순서/영향 범위 분석 누락
- "sim 정합" / "X 효과 적용" 주장 시 actual integration verify 누락
- Cast path 한 곳만 fix (main 만, OOR/recast 누락)
- 한글 이름 list 만으로 set 소속 검증 (apiName grep 누락)

## 관련

- 메모리 `feedback_wiki_ingest_verify` — main agent 작성 워크플로우 (positive verify, user-local)
- 메모리 `feedback_codex_review_workflow` — Codex review reply 워크플로우
- 메모리 `feedback_pr_serial_workflow` — 1 PR 씩 직렬 처리
- Subagent: `.claude/agents/wiki-ingest-verifier.md` — 본 룰셋 reference
- 위키 메타: [[schema]] (구조), [[index]] (카탈로그), [[log]] (변경 기록)
