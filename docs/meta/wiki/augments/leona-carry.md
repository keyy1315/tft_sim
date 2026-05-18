---
id: leona-carry
type: augment
display_name_kr: 방패 여전사 (Shieldmaiden)
api_name: TFT17_Augment_LeonaCarry
target_champion: TFT17_Leona
tier: Gold
stage: 2 only
current_patch_status: active
sim_active: active   # Lint #6 resolved (PR #127, 9e6ddb3) — entry 단일 source. statOverrides 인게임 측정만 남음
last_verified: 2026-05-18
sources:
  - src/data/carryAugments.ts:171 (LeonaCarry entry — abilityOverride/abilityData)
  - src/lib/simulator/engine/combatLoop.ts:614 (LEONA_CARRY_ABILITY const)
  - src/lib/simulator/engine/combatLoop.ts:626 (getAbilityConfigForUnit flag 분기)
  - src/lib/simulator/engine/combatLoop.ts:2249 (applyHeroCarryTransforms leonaCarryActive set)
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
| 2026-05-18 (PR #127, `9e6ddb3`) | **Lint #6 sim 해소** — `LEONA_CARRY_ABILITY` const 제거 (`GRAGAS_CARRY_ABILITY` 동시) + flag 우선 분기 우회 → carryAugments entry 단일 source. **stun 1.0 fixed 적용** (이전 1.5 → 1.0 fixed). starLevel별 stunDuration `[1.0, 1.25, 1.5]` 활용은 별도 — Lint #9 (아래) 참조. [[gragas-carry]] Lint #8 과 같은 사이클 |

## sim 적용 상태 — `partial` (Lint #6 resolved, Lint #9 신규 검출)

✅ **활성**:
- role 변환 `Fighter` (default)
- line dash + maxTargets 4 + firstHitOnlyStun
- primary damage (carryAugments entry) + secondaryDamage (line 추가 대상)
- baseDamageHpFrac maxHP 24% 가산 (17.3 sim 정합)
- shield + duration
- **`stun: 1.0` fixed (entry abilityOverride.stun, PR #127)** — 이전 const 1.5 → 1.0. 모든 starLevel 1초 적용

❌ **미반영 — Lint #9 (PR #128 Codex P2 review 검출)**:
- **starLevel별 stunDuration `[1.0, 1.25, 1.5]` 활용 안 됨** — `combatLoop.ts:6819-6820` main pipeline 이 `config.stun` (fixed 1.0) 만 read. `abilityData.stunDuration` 의 main pipeline read 0건. **IvernMinion-specific 분기 (line 1232-1234) 만 `carryCfg.abilityData.stunDuration` 사용**. → 2성/3성 stun 도 1.0초 (의도 1.25/1.5 미적용)
- statOverrides (HP/AS/range/etc) — 사용자 인게임 측정 대기

## ⚠️ Lint finding #9 — stunDuration starLevel별 main pipeline 미반영 (PR #128 Codex P2 검출)

### 검출
PR #128 Codex P2 review 가 PR #127 의 "starLevel별 stun sim 정합" 표기 부정확 catch:
- `combatLoop.ts:6819-6820` main cast pipeline: `if (config.stun && config.stun > 0) { const stunTicks = Math.round(config.stun * TICKS_PER_SECOND); }` — **config.stun fixed 만 read**
- `combatLoop.ts:1234`: `const stunArr = carryCfg.abilityData.stunDuration;` — IvernMinion-specific 분기에만 존재 (line 1232-1234 컨텍스트)
- LeonaCarry abilityOverride.stun = 1.0 (fixed) → 모든 starLevel 1.0초

### 결과
PR #127 가 한 일 = stun 1.5 (const) → 1.0 (entry config). **starLevel별 stunDuration 적용은 여전히 미반영**. abilityData.stunDuration `[1.0, 1.25, 1.5]` 의 의도 (3성 1.5초 stun) sim 미반영.

### 조치 후보 (별도 sim 정확도 PR)
- 옵션 A: main pipeline `config.stun` 분기를 `abilityData.stunDuration[unit.starLevel - 1] ?? config.stun` 로 확장
- 옵션 B: LeonaCarry abilityOverride.stun 제거 + IvernMinion-style 별도 분기 (LeonaCarry-specific) 추가
- 옵션 C: IvernMinion 분기를 generic 화 — 모든 carry augment 가 abilityData.stunDuration 있으면 우선 사용

### 영향 범위
- LeonaCarry: 2성/3성 stun 너프 잠재 (1.0 → 1.25/1.5)
- IvernMinion (`abilityData.stunDuration: [1.25, 1.5, 1.75]`) 는 이미 line 1232-1234 분기로 정확 적용 — 영향 없음
- 기타 carry: abilityData.stunDuration 정의 없음 (LeonaCarry/IvernMinion 만)

## Lint 체크리스트

- [x] **LEONA_CARRY_ABILITY const vs carryAugments entry duplicate 정리** — PR #127 (`9e6ddb3`) 머지 완료
- [ ] **Lint #9: starLevel별 stunDuration main pipeline 반영** — 별도 sim 정확도 PR (옵션 A/B/C 결정 후)
- [ ] statOverrides 인게임 측정 — Leona augment 활성 vs 비활성 stat 차이
- [ ] 17.2 LIVE 초기 값 정확성 — 17.2 패치노트 명시 없음, 17.2b plan doc 의 "before" 표기로 역추정. 외부 archive 로 검증 가능

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[patch-17-2]] / [[patch-17-2b]] / [[patch-17-3]] — 변경 시점
- [[ability-targeting]] — line pattern 알고리즘 (`maxTargets` 거리순 cap)
- 코드: `src/data/carryAugments.ts:171`, `src/lib/simulator/engine/combatLoop.ts:614/626/2249`
