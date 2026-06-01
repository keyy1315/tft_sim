---
id: leona-carry
type: augment
display_name_kr: 방패 여전사 (Shieldmaiden)
api_name: TFT17_Augment_LeonaCarry
target_champion: TFT17_Leona
tier: Gold
stage: 2 only
current_patch_status: active
sim_active: partial   # Lint #6 resolved (PR #127) + Lint #9 resolved (PR #129) — 단 PR #154 retro lint 에서 Lint #10 (shield/shieldDuration main pipeline 미read) + Lint #11 (baseDamageHpFrac && hexReduction AND 가드로 미진입) 신규 등록, 도메인 verify 대기. 본 룰셋 #8 (sub-entity partial 시 보수적 minimum) 적용
last_verified: 2026-05-26 (retro lint subagent — frontmatter sources stale 식별자 정리, line drift 갱신; P0 shield/baseDamageHpFrac sim 미반영 lint case #10/#11 신규 등록 → 도메인 verify 대기)
sources:
  - src/data/carryAugments.ts:171 (LeonaCarry entry — abilityOverride/abilityData)
  - src/lib/simulator/engine/combatLoop.ts:630 (getAbilityConfigForUnit — findSelectedCarryAugment 단일 source; ~~LEONA_CARRY_ABILITY const~~ PR #127 제거)
  - src/lib/simulator/engine/combatLoop.ts:2258 (applyHeroCarryTransforms — selectedCarryAugment set; ~~leonaCarryActive 필드~~ PR #147 제거, selectedCarryAugment === '...' 비교로 대체)
  - public/data/tft_set17_augments.json:66
  - 공식 17.2 / 17.3 패치노트
related:
  - "[[hero-augment-carry]]"
  - "[[patch-17-2]]"
  - "[[patch-17-2b]]"
  - "[[patch-17-3]]"
  - "[[ability-targeting]]"
---

# 방패 여전사 (LeonaCarry, Shieldmaiden)

## 요약

[[patch-17-2]] LIVE 게임 도입 carry augment. Gold tier, Stage 2 only. 활성 시 Leona (`TFT17_Leona`) 가 가장 강한 1명 → `Fighter` 변환 + line-pattern dash 어빌리티 + 첫 적중 stun. **17.2 → 17.2b → 17.3 3회 연속 변경** (가장 변경 잦은 carry augment 중 하나).

## 변환 후 메커니즘

- **role**: `Fighter` (default, statOverrides 미설정)
- **ability pattern**: `line, maxTargets: 4, dash: to_target, firstHitOnlyStun: true`
- **cast 흐름**:
  1. 2초 동안 시전자 보호막 (shield `[200, 240, 280]` starLevel별, duration 2s)
  2. 최대 3칸 돌진해 적이 가장 많은 일직선 타격 (탱커 우선)
  3. 첫 적중 대상: **AD 데미지 + maxHP 24% 추가 + 기절** (17.3 nerf, 이전 28%)
  4. 추가 line 대상 (최대 3명 추가): AD secondaryDamage

## 변수 (carryAugments.ts:171 abilityData, 17.3 LIVE 기준)

| 변수 | 값 | 설명 |
|------|-----|------|
| `damage` | `[90, 135, 225]` | starLevel별 primary AD damage (17.2b nerf 이후 17.3 변경 없음) |
| `shield` | `[200, 240, 280]` | starLevel별 시전자 보호막 |
| `shieldDuration` | `2` (초) | 보호막 지속 |
| `baseDamageHpFrac` | **`0.24`** | primary 데미지에 maxHP × 24% 가산 (17.3: 0.28 → 0.24) |
| `stunDuration` | `[1.0, 1.25, 1.5]` (초) | starLevel별 stun 지속 |
| `secondaryDamage` | **`[200, 300, 480]`** | line 추가 대상 AD damage (17.3: [180,270,405] → [200,300,480]) |
| `damageType` | `physical` | |

## ✅ Lint finding #6 — RESOLVED (PR #127, `9e6ddb3`, 2026-05-18)

PR #123 검출 → PR #127 (Option B 채택) 동시 해소 ([[gragas-carry]] Lint #8 와 같은 사이클).

### 검출 시점 (PR #123) — 기록 보존

LeonaCarry 가 2개 config 로 정의되어 있었음. `getAbilityConfigForUnit` 가 flag 우선 분기 → legacy const 가 carryAugments entry shadow:

| 출처 | stun (config) | stunDuration (abilityData) |
|------|:--:|:--:|
| `combatLoop.ts:614` `LEONA_CARRY_ABILITY` const (제거됨) | **`1.5`** (fixed) | — |
| `carryAugments.ts:171` `LeonaCarry.abilityOverride` | `1.0` (fixed) | `[1.0, 1.25, 1.5]` (starLevel별) |

**이전 sim 동작**: const stun 1.5 사용 → 1성/2성 stun 도 1.5초 적용. abilityData.stunDuration `[1.0, 1.25, 1.5]` starLevel별 의도 무시.

### Fix (PR #127, Option B)

- `combatLoop.ts:614` `LEONA_CARRY_ABILITY` const **제거** (`GRAGAS_CARRY_ABILITY` 동시 제거)
- `getAbilityConfigForUnit:625-627` flag 우선 분기 우회 → `findCarryAugment(...) → carry.abilityOverride` 단일 경로
- 결과: `LeonaCarry.abilityOverride.stun = 1.0` (config 베이스) + abilityData.stunDuration starLevel별 활용 가능 (main pipeline 의 stunDuration read 위치는 별도 verify)

### scope strict 보존 (CLAUDE.md)
`leonaCarryActive` flag 자체는 보존 — 테스트 assertion 4건 (`hero-carry-augments.test.ts`) 호환. flag 자체 dead 정리는 별도 PR 후보 (sim 코드 사용처 0).

## 패치 히스토리 (3회 연속 변경)

| 패치 | 변경 |
|------|------|
| [[patch-17-2]] LIVE | **게임 도입** — Heat Death/Self-Destruct 와 함께 carry augment 3종 신규. 초기 값: damage `[110,165,250]`, baseDamageHpFrac 0.28 (추정 — 17.2 패치노트 명시 없음, 17.2b plan doc 가 17.2b 시점 값 기록) |
| [[patch-17-2b]] (2026-04-29) | damage `[110,165,250]` → **`[90,135,225]`** (큰 nerf). carry augment sim 정식화 (CarryAugmentConfig + abilityData + statOverrides) |
| [[patch-17-3]] (2026-05-13) | baseDamageHpFrac 0.28 → **0.24** (HP scale nerf) + secondaryDamage `[180,270,405]` → **`[200,300,480]`** (line buff). PR #115 (`39cbce2`) sim 정합 |
| 2026-05-18 (PR #127, `9e6ddb3`) | **Lint #6 sim 해소** — `LEONA_CARRY_ABILITY` const 제거 (`GRAGAS_CARRY_ABILITY` 동시) + flag 우선 분기 우회 → carryAugments entry 단일 source. **stun 1.0 fixed 적용** (이전 1.5 → 1.0 fixed). [[gragas-carry]] Lint #8 과 같은 사이클 |
| 2026-05-18 (PR #129, `8abbba0`) | **Lint #9 sim 해소** — main pipeline (당시 line 6819-6831, 현재 6941-6953) + OOR fallback (당시 line 7129-7140, 현재 7325-7332) 양쪽 분기 확장: `carryCfg?.abilityData?.stunDuration?.[starLevel-1] ?? config.stun`. **starLevel별 stun [1.0, 1.25, 1.5] sim 적용** (1성 변경 없음, 2★ 1.0→1.25, 3★ 1.0→1.5). Codex P2 amend 로 OOR 누락 catch — 위키 [[ability-targeting]] cast path 3종 정보가 워크플로우 룰 도입 배경 |
| 2026-05-26 (retro lint subagent) | **신규 P0 lint case #10/#11 등록** (도메인 verify 대기, [[lint-rules]] 참조). #10 = `shield [200,240,280]` + `shieldDuration 2s` 의 sim main pipeline read site 부재 (실제는 raw vars `ShieldAmount` 우선 read). #11 = `baseDamageHpFrac 0.24` 의 sim 분기 진입 가드 (`baseDamageHpFrac && hexReduction` 양쪽 가드) 로 LeonaCarry 미진입. P0 fix 는 도메인 사실 (인게임 측정 / 패치노트) verify 후 코드 fix PR 진행 예정 |

## sim 적용 상태 — `partial` (Lint #6 + #9 resolved, Lint #10/#11 미반영 sim 갭 잔존)

✅ **활성**:
- role 변환 `Fighter` (default)
- line dash + maxTargets 4 + firstHitOnlyStun
- primary damage (carryAugments entry) + secondaryDamage (line 추가 대상)
- **starLevel별 stun `[1.0, 1.25, 1.5]` sim 적용 (PR #129)** — main pipeline + OOR fallback 양쪽 분기. 1★ 1.0초 / 2★ 1.25초 / 3★ 1.5초

🔍 **sim 미반영 — Lint case #10/#11 신규 등록 (PR #154 retro lint, 도메인 verify 대기)**:
- **#10 shield / shieldDuration**: carry abilityData `shield [200, 240, 280]` + `shieldDuration 2s` 가 main pipeline read site 부재. 실제 cast 시점 shield 는 `combatLoop.ts:6425-6427` 의 `getAbilityShield(unit.champion, ...)` fallback path 가 raw vars `ShieldAmount [0, 420, 480, 620, ...]` + `ShieldDuration [4, ...]` 우선 read. carry 의도 (짧은 cast 보호막) vs sim 동작 (긴 raw 보호막) 불일치 — Mordekaiser 패턴 (`mordekaiserCarryShield` 필드) 차용 fix 필요 또는 sim_active 정정. ⚠️ 인게임 측정 / 17.3 패치노트 verify 후 fix 결정
- **#11 baseDamageHpFrac**: carry abilityData `baseDamageHpFrac 0.24` 가 main pipeline 분기 진입 가드 (`baseDamageHpFrac && hexReduction` AND 가드, `combatLoop.ts:6329`) 로 인해 LeonaCarry (hexReduction 없음) 미진입. maxHP 24% 가산 sim 영향 0. ⚠️ 인게임 측정 / 패치 명세 verify 후 fix 결정

🔍 **검증 필요 / 미완**:
- statOverrides (HP/AS/range/etc) — 사용자 인게임 측정 대기
- integration test (실제 simulateCombat 으로 starLevel별 stun 측정) — 후속 후보 (PR #129 는 code fingerprint + entry fact 가드)

## ✅ Lint finding #9 — RESOLVED (PR #129, `8abbba0`, 2026-05-18)

PR #128 검출 → PR #129 (옵션 A 채택 — 옵션 C와 사실상 동일) 해소. Codex P2 amend 로 OOR cast path 누락 catch 후 main + OOR 양쪽 fix 완결.

### 검출 시점 (PR #128) — 기록 보존
- `combatLoop.ts:6819-6820` main pipeline (당시 line, 현재 6941-6953): `if (config.stun && config.stun > 0) { stunTicks = config.stun * TICKS_PER_SECOND; }` — **config.stun fixed 만 read**
- `combatLoop.ts:1234` (당시 line, 현재 1256): `carryCfg.abilityData.stunDuration` read 는 IvernMinion-specific 분기 전용
- LeonaCarry abilityData.stunDuration `[1.0, 1.25, 1.5]` 정의되어 있으나 main pipeline 미read → 모든 starLevel 1.0초

### Fix (PR #129, Option A + Codex P2 amend)
1. **main pipeline (PR #129 당시 line 6819-6831, 현재 6941-6953)**: `starLevelStun = carryCfg?.abilityData?.stunDuration?.[starLevel-1] ?? config.stun` 분기 추가
2. **OOR (out-of-range dash) fallback (PR #129 당시 line 7129-7140, 현재 7325-7332)**: 동일 패턴 추가 (`oorCarryCfg?.abilityData?.stunDuration?.[starLevel-1] ?? outOfRangeConfig.stun`)
3. fallback: 다른 carry (`abilityData.stunDuration` 미정의) / non-carry → 기존 `config.stun` fixed 동작 보존

### 워크플로우 메모리 도입 배경
PR #129 의 Codex P2 amend (OOR 누락) 가 `feedback_wiki_ingest_verify` 메모리의 **"cast path 3종 전수 확인"** sub-rule 도입 배경. 위키 [[ability-targeting]] 페이지의 "3 cast 호출처 (main / recast / OOR fallback)" 정보가 sim fix workflow 의 도우미 역할.

### 회귀 가드 (PR #129)
- "Lint #9 해소 — main pipeline 의 stun 분기가 carry abilityData.stunDuration starLevel별 우선" — code fingerprint (main + OOR 양쪽)
- LeonaCarry entry fact (stunDuration starLevel별 정확값)
- integration test 는 후속 후보

## Lint 체크리스트

- [x] **LEONA_CARRY_ABILITY const vs carryAugments entry duplicate 정리** — PR #127 (`9e6ddb3`) 머지 완료
- [x] **Lint #9: starLevel별 stunDuration main pipeline 반영** — PR #129 (`8abbba0`) 머지 완료. main + OOR 양쪽 fix
- [ ] integration test (실제 simulateCombat 으로 LeonaCarry 1★/2★/3★ stun 측정) — 후속 후보
- [ ] statOverrides 인게임 측정 — Leona augment 활성 vs 비활성 stat 차이
- [ ] 17.2 LIVE 초기 값 정확성 — 17.2 패치노트 명시 없음, 17.2b plan doc 의 "before" 표기로 역추정. 외부 archive 로 검증 가능

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[patch-17-2]] / [[patch-17-2b]] / [[patch-17-3]] — 변경 시점
- [[ability-targeting]] — line pattern 알고리즘 (`maxTargets` 거리순 cap)
- 코드: `src/data/carryAugments.ts:171`, `src/lib/simulator/engine/combatLoop.ts:614/626/2249`
