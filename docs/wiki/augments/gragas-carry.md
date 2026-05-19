---
id: gragas-carry
type: augment
display_name_kr: 자폭 (Self-Destruct)
api_name: TFT17_Augment_GragasCarry
target_champion: TFT17_Gragas
tier: Gold
stage: 2 only
current_patch_status: active
sim_active: active   # Lint #8 (sub-A + sub-B) resolved (PR #127, 9e6ddb3). 적군 AOE 정상 작동
last_verified: 2026-05-18
sources:
  - src/data/carryAugments.ts:254 (GragasCarry entry — radius 3)
  - src/lib/simulator/engine/combatLoop.ts:604 (GRAGAS_CARRY_ABILITY const — radius 0)
  - src/lib/simulator/engine/combatLoop.ts:626 (getAbilityConfigForUnit flag 우선 분기)
  - src/lib/simulator/engine/combatLoop.ts:2264 (applyHeroCarryTransforms gragasCarryActive set)
  - src/lib/simulator/engine/combatLoop.ts:6259-6299 (자폭 self damage + 적군 AOE inline 분기)
  - public/data/tft_set17_augments.json:584
  - 공식 17.2 / 17.2b 패치노트
related:
  - "[[hero-augment-carry]]"
  - "[[patch-17-2]]"
  - "[[patch-17-2b]]"
  - "[[leona-carry]]"
  - "[[mordekaiser-carry]]"
---

# 자폭 (GragasCarry, Self-Destruct)

## 요약

[[patch-17-2]] LIVE 게임 도입 carry augment. Gold tier, Stage 2 only. 활성 시 Gragas (`TFT17_Gragas`) 가 가장 강한 1명 → `Fighter` 변환 + selfDamage cast (자기 자신 데미지, HP floor=1) + 반경 3칸 적군 magic AOE (PR4 17.2b 후속 도입). **17.2b 1회 변경 후 17.3 변경 없음**.

⚠️ **2 lint findings 동시 검출** (PR #126 — 본 페이지 ingest 중):
1. **Duplicate config pattern** ([[leona-carry]] Lint #6 와 동일): `GRAGAS_CARRY_ABILITY` const + `carryAugments.ts:254` entry 가 다른 값 (`radius: 0` vs `radius: 3`)
2. **Radius shadow bug** — flag 우선 분기로 const radius 0 사용 → 적군 AOE 가 사실상 작동 안 함 (sim 정확도 큰 갭)

## 변환 후 메커니즘

- **role**: `Fighter` (default, statOverrides 미설정)
- **ability pattern**: `aoe_circle` (config 따라 radius 다름 — Lint #8 참조)
- **cast 흐름**:
  1. 자기 자신에게 selfDamage 적용 (`abilityData.healthCost = 0.20` × maxHp, HP floor 1)
  2. 반경 N 칸 적군 magic AOE (의도: `baseAOE = maxHp × baseDamageHpFrac + AP × (damage[star] / 100)`, distance multiplier `(1 - hexReduction)^dist`, tank 상대 ×1.60)

## 변수 (carryAugments.ts:254 abilityData, 17.2b LIVE 기준)

| 변수 | 값 | 설명 |
|------|-----|------|
| `mana` | `30/80` | 시작/최대 마나 |
| `damage` | `[280, 420, 630]` | starLevel별 AP base damage |
| `healthCost` | **`0.20`** | 자기 자신 maxHp 비율 self-damage (17.2b: 0.30 → 0.20) |
| `hexReduction` | **`0.45`** | 헥스당 감소 배율 (17.2b: 0.55 → 0.45) |
| `baseDamageHpFrac` | `0.10` | base AOE 에 maxHp × 10% 가산 |
| `tankBonusMultiplier` | `0.60` | 탱커 상대 +60% damage |
| `selfDamageHpFloor` | `1` | self-damage 로 0 이하 안 됨 |
| `damageType` | `magic` | |

## ✅ Lint finding #8 — RESOLVED (PR #127, `9e6ddb3`, 2026-05-18)

PR #126 검출 (sub-A duplicate + sub-B radius shadow bug) → PR #127 (Option B 채택) 동시 해소 ([[leona-carry]] Lint #6 와 같은 사이클).

### 검출 시점 (PR #126) — 기록 보존

`getAbilityConfigForUnit` 가 `gragasCarryActive` flag 우선 → `GRAGAS_CARRY_ABILITY` const 사용. carryAugments entry 의 `abilityOverride.radius: 3` 가 shadow.

| 출처 | pattern | radius |
|------|---------|:--:|
| `combatLoop.ts:604` `GRAGAS_CARRY_ABILITY` const (제거됨) | `aoe_circle` | **`0`** |
| `carryAugments.ts:254` `GragasCarry.abilityOverride` | `aoe_circle` | **`3`** |

### 이전 sim 동작 (Sub-B 결과)

`combatLoop.ts:6288` main cast pipeline:
```ts
const aoeRadius = config.radius ?? 3;  // ← 0 은 nullish 아님 → fallback 안 됨
if (dist > aoeRadius) continue;  // dist > 0 인 모든 적 skip
```

`config = GRAGAS_CARRY_ABILITY` (radius 0) → `0 ?? 3 = 0` → **caster 같은 hex 적군만 hit** (사실상 0명). patch note "반경 3칸 magic damage" 의도 무력화. PR4 (17.2b 후속) 의 적군 AOE 코드 비활성.

### Fix (PR #127, Option B)

- `combatLoop.ts:604` `GRAGAS_CARRY_ABILITY` const **제거** (`LEONA_CARRY_ABILITY` 동시 제거)
- `getAbilityConfigForUnit:625-627` flag 우선 분기 우회 → `findCarryAugment → carry.abilityOverride` 단일 경로
- 결과: `GragasCarry.abilityOverride.radius = 3` → **적군 AOE 반경 3칸 정상 작동** (hexReduction 0.45 + tankBonus 0.60 정확 적용)

### Mordekaiser pattern 과 비교 (역사적 기록)

| Carry | duplicate const | source drift 패턴 | 해소 |
|-------|:---------------:|:----------------:|:----:|
| LeonaCarry (#6) | ✅ → resolved | ❌ | **PR #127** ([[leona-carry]]) |
| MordekaiserCarry (#7) | ❌ | ✅ → resolved | PR #124 ([[mordekaiser-carry]]) |
| **GragasCarry (#8)** | ✅ → resolved | ❌ | **PR #127** |

### scope strict 보존 (CLAUDE.md)
`gragasCarryActive` flag 자체는 보존 — 테스트 assertion 4건 (`hero-carry-augments.test.ts` + `hero-augment-stat-system.test.ts`) 호환. flag 자체 dead 정리는 별도 PR 후보 (sim 코드 사용처 0).

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| [[patch-17-2]] LIVE | **게임 도입** — Heat Death/Shieldmaiden 과 함께 carry augment 3종 신규. PR4 (17.2b 후속) 가 적군 AOE 코드 도입 — 단 radius 0 때문에 작동 안 함 (Lint #8 sub-B) |
| [[patch-17-2b]] (2026-04-29) | healthCost `0.30 → 0.20` (자기 손실 완화) / hexReduction `0.55 → 0.45` (헥스당 감소 완화 — buff). carry augment sim 정식화 (CarryAugmentConfig 도입) |
| [[patch-17-3]] (2026-05-13) | **변경 없음** (17.3 patch note 에 Self-Destruct 항목 없음). 17.2b 값 그대로 유지 |
| 2026-05-18 (PR #127, `9e6ddb3`) | **Lint #8 sim 해소** — `GRAGAS_CARRY_ABILITY` const 제거 (`LEONA_CARRY_ABILITY` 동시) + flag 우선 분기 우회 → carryAugments entry 단일 source. **적군 AOE 반경 3칸 정상 작동** (이전 무력화). [[leona-carry]] Lint #6 과 같은 사이클 |

## sim 적용 상태 — `active` (Lint #8 sub-A + sub-B 모두 resolved)

✅ **활성**:
- role 변환 `Fighter`
- `aoe_circle` pattern (**radius 3, PR #127 sim 정합**) + `selfDamage: true` + HP floor 1
- self-damage 공식 (`maxHp × healthCost`)
- **적군 AOE radius 3 정상 작동 (PR #127)** — hexReduction 0.45 multiplicative falloff + tankBonus 0.60 정확 적용
- carry abilityData 직접 read — `healthCost`/`damage`/`baseDamageHpFrac`/`hexReduction`/`tankBonusMultiplier`/`damageType` 모두 main cast pipeline (line 6263-6299) 에서 사용 (Mordekaiser 와 달리 별도 specific helper 없음 — entity-wide grep 결과 verify 완료)

🔍 **검증 필요 / 미완**:
- 적군 AOE damage 실제 sim integration 정확성 — PR #127 회귀 가드는 entry fact + code fingerprint 만. 실제 적군 데미지 적용 sim 통합 테스트 후보
- statOverrides (HP/armor/MR/AS/range/damage) 인게임 측정 대기

## Lint 체크리스트

- [x] **Lint #8 sub-A**: `GRAGAS_CARRY_ABILITY` const 제거 (PR #127 `9e6ddb3`) — Option B 옵션 채택
- [x] **Lint #8 sub-B**: 적군 AOE radius shadow bug — PR #127 동시 해소 (radius 3 entry 사용)
- [x] specific helper 부재 — entity-wide grep `Gragas` 결과 main pipeline inline 분기만 (verify 완료)
- [ ] statOverrides 인게임 측정 — Gragas augment 활성 vs 비활성 stat 차이
- [ ] 17.2 LIVE 초기 healthCost/hexReduction 값 — 17.2b plan doc "before" 표기로 역추정 (`0.30` / `0.55`)
- [ ] **적군 AOE damage sim integration 테스트** — 회귀 가드 후보 (PR #127 의 entry fact 가드 너머)

## 17.2 vs 17.2b 비교 (역사적 기록)

| 변수 | 17.2 (도입) | 17.2b | 의도 |
|------|:-----------:|:----:|------|
| `healthCost` | `0.30` (추정) | **`0.20`** | 자기 손실 완화 |
| `hexReduction` | `0.55` (추정) | **`0.45`** | 헥스당 감소 완화 (먼 적도 더 맞음) |
| `damage` | `[280, 420, 630]` (변동 없음) | `[280, 420, 630]` | — |

→ 17.2b 는 전반적 buff. Gragas 사용률 활성화 의도.

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[leona-carry]] — 동일 duplicate const 패턴 (Lint #6) + 같은 17.2 도입 시점
- [[mordekaiser-carry]] — 다른 multi-source 패턴 (Lint #7, resolved PR #124)
- [[patch-17-2]] / [[patch-17-2b]] — 도입 + 조정 시점
- 코드: `src/data/carryAugments.ts:254`, `src/lib/simulator/engine/combatLoop.ts:604/626/6259`
