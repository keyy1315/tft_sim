---
id: gragas-carry
type: augment
display_name_kr: 자폭 (Self-Destruct)
api_name: TFT17_Augment_GragasCarry
target_champion: TFT17_Gragas
tier: Gold
stage: 2 only
current_patch_status: active
sim_active: partial   # duplicate config + radius shadow bug (아래 Lint #8)
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

## ⚠️ Lint finding #8 — Gragas duplicate config + radius shadow (위키 검출 8번째 사례)

`getAbilityConfigForUnit` (combatLoop.ts:626) 가 `gragasCarryActive` flag 우선 → `GRAGAS_CARRY_ABILITY` const 사용. carryAugments entry 의 `abilityOverride.radius: 3` 가 shadow 됨.

### Sub-finding A: Duplicate config inconsistency

| 출처 | pattern | radius |
|------|---------|:--:|
| `combatLoop.ts:604` `GRAGAS_CARRY_ABILITY` const | `aoe_circle` | **`0`** |
| `carryAugments.ts:254` `GragasCarry.abilityOverride` | `aoe_circle` | **`3`** |

LeonaCarry Lint #6 와 동일 패턴.

### Sub-finding B: 적군 AOE radius shadow bug (sim 정확도 큰 갭)

`combatLoop.ts:6288` main cast pipeline 의 적군 AOE 분기:
```ts
const aoeRadius = config.radius ?? 3;  // ← 0 은 nullish 아님 → fallback 안 됨
for (const t of opposingTeam) {
  const dist = hexDistance(unit.position, t.position);
  if (dist > aoeRadius) continue;  // dist > 0 인 모든 적 skip
  // ... AOE damage 적용
}
```

`config = GRAGAS_CARRY_ABILITY` (radius 0) 라면 `0 ?? 3 = 0`. `dist > 0` 인 모든 적 skip → **caster 와 같은 hex 에 있는 적군만 hit** (사실상 0명).

→ patch note 와 desc 명시 "반경 3칸 magic damage" 가 sim 에 작동 안 함. PR4 (17.2b 후속) 가 적군 AOE 코드 추가했지만 radius 0 때문에 무력화. carryAugments entry 의 `radius: 3` 의도가 sim 미반영.

**조치 후보 (별도 sim 정확도 PR)**:
- 옵션 A: `GRAGAS_CARRY_ABILITY.radius` 0 → 3 (단순. const 의 "적군 데미지 없음" 주석은 17.2 도입 시점 — outdated. PR4 가 적군 AOE 도입 후 갱신 안 됨)
- 옵션 B: `LEONA_CARRY_ABILITY` / `GRAGAS_CARRY_ABILITY` const 둘 다 제거 + flag 경로 우회 → carryAugments entry 단일 source (LeonaCarry Lint #6 와 통합 해소)
- 옵션 C: `aoeRadius = (config.radius != null && config.radius > 0) ? config.radius : 3` 같은 fallback (0 도 fallback)

> 옵션 B 가 가장 깨끗 — Lint #6 (LeonaCarry duplicate) 와 동시 해소.

### 추가 — Mordekaiser pattern 과 비교

| Carry | duplicate const | source drift 패턴 | sim 정합 |
|-------|:---------------:|:----------------:|:--------:|
| LeonaCarry (#6) | ✅ ([[leona-carry]]) | ❌ (carryAugments entry 사용) | partial — stun duration mismatch |
| MordekaiserCarry (#7) | ❌ | ✅ (raw vars vs carryAugments entry) | **resolved (PR #124)** |
| **GragasCarry (#8)** | ✅ (radius mismatch) | ❌ | **partial — 적군 AOE 거의 무력화** |

→ Gragas 는 LeonaCarry 의 duplicate const 패턴 + 더 심각한 결과 (적군 AOE 무력화). 같은 sim 클린업 PR (옵션 B) 로 동시 해소 가능.

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| [[patch-17-2]] LIVE | **게임 도입** — Heat Death/Shieldmaiden 과 함께 carry augment 3종 신규. PR4 (17.2b 후속) 가 적군 AOE 코드 도입 — 단 radius 0 때문에 작동 안 함 (Lint #8 sub-B) |
| [[patch-17-2b]] (2026-04-29) | healthCost `0.30 → 0.20` (자기 손실 완화) / hexReduction `0.55 → 0.45` (헥스당 감소 완화 — buff). carry augment sim 정식화 (CarryAugmentConfig 도입) |
| [[patch-17-3]] (2026-05-13) | **변경 없음** (17.3 patch note 에 Self-Destruct 항목 없음). 17.2b 값 그대로 유지 |

## sim 적용 상태 — `partial`

✅ **활성**:
- role 변환 `Fighter`
- `aoe_circle` pattern + `selfDamage: true` + HP floor 1
- self-damage 공식 (`maxHp × healthCost`)
- carry abilityData 직접 read — `healthCost`/`damage`/`baseDamageHpFrac`/`hexReduction`/`tankBonusMultiplier`/`damageType` 모두 main cast pipeline (line 6263-6299) 에서 사용 (Mordekaiser 와 달리 별도 specific helper 없음)

❌ **미반영 (Lint #8 sub-B)**:
- **적군 AOE radius shadow bug** — `GRAGAS_CARRY_ABILITY.radius = 0` 이 carryAugments entry `radius: 3` 을 shadow → 적군 AOE 사실상 작동 안 함. patch note "반경 3칸 magic damage" 의도 무력화

❌ **미반영 (statOverrides 측정 대기)**:
- HP/armor/MR/AS/range/damage 등 augment 활성 시 변환된 stat — 사용자 인게임 측정 필요

## Lint 체크리스트

- [ ] **Lint #8 sub-A**: `GRAGAS_CARRY_ABILITY` const vs `carryAugments.ts:254` entry duplicate 정리 (옵션 B 권장 — LeonaCarry Lint #6 와 동시 해소)
- [ ] **Lint #8 sub-B**: 적군 AOE radius shadow bug fix — 사용자 결정 후 sim 클린업 PR (옵션 A 가 가장 단순)
- [ ] `tickGragasProc` 같은 specific helper 없는지 (entity-wide grep `Gragas` 결과 0건 확인됨 — Mordekaiser 와 달리 multi-source drift 없음)
- [ ] statOverrides 인게임 측정 — Gragas augment 활성 vs 비활성 stat 차이
- [ ] 17.2 LIVE 초기 healthCost/hexReduction 값 — 17.2b plan doc "before" 표기로 역추정 (`0.30` / `0.55`)

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
