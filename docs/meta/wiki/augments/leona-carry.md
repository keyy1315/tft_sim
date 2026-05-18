---
id: leona-carry
type: augment
display_name_kr: 방패 여전사 (Shieldmaiden)
api_name: TFT17_Augment_LeonaCarry
target_champion: TFT17_Leona
tier: Gold
stage: 2 only
current_patch_status: active
sim_active: partial   # carryAugments.ts entry vs combatLoop legacy const duplicate (아래 Lint finding)
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

## ⚠️ Lint finding (위키 검출 6번째 사례) — Duplicate config inconsistency

LeonaCarry 가 **2개 config 로 정의**되어 있음. `getAbilityConfigForUnit` (`combatLoop.ts:622-630`) 에서 flag 우선 체크 → legacy const 가 carryAugments entry 를 shadow:

| 출처 | stun (config) | stunDuration (abilityData) |
|------|:--:|:--:|
| `combatLoop.ts:614` `LEONA_CARRY_ABILITY` const | **`1.5`** (fixed) | — |
| `carryAugments.ts:171` `LeonaCarry.abilityOverride` | `1.0` (fixed) | `[1.0, 1.25, 1.5]` (starLevel별) |

**실제 sim 동작**: `LEONA_CARRY_ABILITY.stun = 1.5` 사용 (`applyHeroCarryTransforms:2250` 가 `leonaCarryActive = true` 설정 후 `getAbilityConfigForUnit:626` 가 우선 분기).

**결과**:
- 1성/2성 stun 도 1.5초 적용 (abilityData.stunDuration `[1.0, 1.25]` 무시됨)
- carryAugments entry 의 stun 1.0 도 무시됨
- starLevel 별 다른 stun duration 의도가 sim 에 반영 안 됨

→ **별도 sim 클린업 PR 후보**:
- 옵션 A: `LEONA_CARRY_ABILITY` 제거 + flag 경로 우회 → carryAugments entry 사용. starLevel별 stun 정확화. CC duration 변경 (Codex review 필요)
- 옵션 B: `LEONA_CARRY_ABILITY` 가 `abilityData.stunDuration[starLevel]` 참조하도록 동적화

GragasCarry 도 동일 패턴 추정 (`GRAGAS_CARRY_ABILITY` const + `gragasCarryActive` flag). 별도 페이지 작성 시 verify.

## 패치 히스토리 (3회 연속 변경)

| 패치 | 변경 |
|------|------|
| [[patch-17-2]] LIVE | **게임 도입** — Heat Death/Self-Destruct 와 함께 carry augment 3종 신규. 초기 값: damage `[110,165,250]`, baseDamageHpFrac 0.28 (추정 — 17.2 패치노트 명시 없음, 17.2b plan doc 가 17.2b 시점 값 기록) |
| [[patch-17-2b]] (2026-04-29) | damage `[110,165,250]` → **`[90,135,225]`** (큰 nerf). carry augment sim 정식화 (CarryAugmentConfig + abilityData + statOverrides) |
| [[patch-17-3]] (2026-05-13) | baseDamageHpFrac 0.28 → **0.24** (HP scale nerf) + secondaryDamage `[180,270,405]` → **`[200,300,480]`** (line buff). PR #115 (`39cbce2`) sim 정합 |

## sim 적용 상태 — `partial`

✅ **활성**:
- role 변환 `Fighter` (default)
- line dash + maxTargets 4 + firstHitOnlyStun
- primary damage (carryAugments entry) + secondaryDamage (line 추가 대상)
- baseDamageHpFrac maxHP 24% 가산
- shield + duration

❌ **미반영 / Lint finding**:
- **stun duration starLevel별 분기** — abilityData.stunDuration `[1.0, 1.25, 1.5]` 가 LEONA_CARRY_ABILITY const 의 `stun: 1.5` 에 shadow 됨. 1성/2성 stun 도 1.5초 적용 (위 Lint finding 참조)
- statOverrides (HP/AS/range/etc 변환 후 stat) 미설정 — [[hero-augment-carry]] 의 모든 entry 공통 미완 항목

## Lint 체크리스트

- [ ] **LEONA_CARRY_ABILITY const vs carryAugments entry duplicate 정리** — 본 페이지 Lint finding (별도 sim 클린업 PR)
- [ ] statOverrides 인게임 측정 — Leona augment 활성 vs 비활성 stat 차이
- [ ] 17.2 LIVE 초기 값 정확성 — 17.2 패치노트 명시 없음, 17.2b plan doc 의 "before" 표기로 역추정. 외부 archive 로 검증 가능

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[patch-17-2]] / [[patch-17-2b]] / [[patch-17-3]] — 변경 시점
- [[ability-targeting]] — line pattern 알고리즘 (`maxTargets` 거리순 cap)
- 코드: `src/data/carryAugments.ts:171`, `src/lib/simulator/engine/combatLoop.ts:614/626/2249`
