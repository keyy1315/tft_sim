---
id: ivern-minion-carry
type: augment
display_name_kr: "빅뱅 (Big Bang / Meepsie)"
api_name: TFT17_Augment_IvernMinionCarry
target_champion: TFT17_IvernMinion
tier: gold
stage: stage 2 (carry augment 일반)
current_patch_status: active
sim_active: active
last_verified: 2026-05-19
sources:
  - "src/data/carryAugments.ts:188-204 (IvernMinionCarry entry)"
  - "src/lib/simulator/systems/augment.ts:58 (tier='gold')"
  - "src/lib/simulator/systems/ability.ts:209 (TFT17_IvernMinion raw — aoe_circle r=1, heal:true — augment 활성 시 override)"
  - "src/lib/simulator/engine/combatLoop.ts:694-711 (findLargestClusterTarget — cluster radius 2 hex)"
  - "src/lib/simulator/engine/combatLoop.ts:713-758 (applyAbilityDash to_largest_cluster 분기)"
  - "src/lib/simulator/engine/combatLoop.ts:1226-1252 (applyCarryPostCastEffects multi-stun 3 nearest)"
  - "src/lib/simulator/engine/combatLoop.ts:1326-1331 (applyCarryDamageModifiers hexReduction falloff)"
  - "src/lib/simulator/engine/combatLoop.ts:5618-5660 (onAttackBonus passive — Jax 와 공유)"
  - "src/lib/simulator/engine/combatLoop.ts:6820-6824 (IvernMinion abilityOverride.stun 없음 — applyCarryPostCastEffects 별도 분기)"
  - "공식 17.3 패치노트 (Big Bang hexReduction: 0.45 → 0.35)"
related:
  - "[[hero-augment-carry]]"
  - "[[ability-targeting]]"
  - "[[role-passive]]"
  - "[[patch-17-3]]"
---

# 빅뱅 (IvernMinionCarry, Big Bang / Meepsie)

## 요약

꼬마정령 (`TFT17_IvernMinion`) carry augment, **gold tier**. 활성 시 가장 강한 꼬마정령 1명 → `Fighter` 변환 + 매 기본 공격 추가 magic (`onAttackBonus`) + **dash to_largest_cluster** (가장 큰 적 무리 중심으로 도약) + **aoe_circle radius 3** magic damage + 1칸당 35% multiplicative falloff (`hexReduction`) + **가장 가까운 3명 starLevel별 multi-stun**.

**가장 복잡한 dash-based carry** — cluster 탐지 알고리즘 + hexReduction multiplicative falloff + multi-stun post-cast 3 메커니즘이 main + OOR cast path 양쪽 일관 적용 (`applyCarryPostCastEffects` 통합 helper 덕분).

## 변환 후 메커니즘

- **role**: `Fighter` (default — `applyHeroCarryTransforms` line 2227)
- **abilityOverride**: `{ pattern: 'aoe_circle', radius: 3, dash: 'to_largest_cluster' }` (`carryAugments.ts:192`)
- **damageType**: `magic` (abilityData.damageType, damageTypeOverride 없음 → resolveAbilityDamage 의 abilityData.damageType fallback)
- **cast 효과**:
  - **dash**: `applyAbilityDash` line 734 → `findLargestClusterTarget(aliveEnemies)` (line 694-711) — 각 alive 적 위치 중심으로 radius 2 내 타 적 개수 카운트, max count 적 반환. tie 시 첫 번째 (stable). dashTarget 인접 빈 칸 중 가장 가까운 곳으로 unit 이동
  - **abilityTarget = dashTarget** (cluster center) 기준 `findAbilityTargets` aoe_circle r=3 — center 로부터 hex distance ≤ 3 의 모든 적
  - **base damage**: `damage[starLevel-1]` magic → `baseValue × (1 + ap/100)` (resolveAbilityDamage carryForDamage)
  - **`hexReduction 0.35` falloff** (`applyCarryDamageModifiers` line 1326-1331): `baseDmg *= Math.pow(1 - 0.35, dist)` — dist = abilityTarget (cluster center) 로부터 hex distance. IvernMinionCarry 한정 (augmentApiName 검사)
  - **multi-stun** (`applyCarryPostCastEffects` line 1232-1252): IvernMinionCarry 한정. abilityTargets 를 caster (unit) 위치 기준 sort → 가장 가까운 3명 (IVERN_STUN_TARGETS=3) starLevel별 `stunDuration[starLevel-1]` 초 stun (state='idle', attackCooldown=0)
- **passive (onAttackBonus)**: 매 기본 공격마다 `onAttackBonus[starLevel-1]` AP scaling magic damage 추가 (`combatLoop.ts:5618-5660`, Jax 와 공유)
  - target.state ≠ 'dead' && currentHp > 0 가드 (PR #74)
  - 통합 mitigation (resistance + DR + non-target reduction + shield + invulnerable)
- **`spiritEffectPerStack 0`** (`carryAugments.ts:201`): falsy → line 6231 if 가드 false → no-op (Poppy 와 달리 미프 trait stack damage amp 미적용)
- **mana**: 50/100 (raw 채택)

## 변수 (carryAugments.ts:193-203 abilityData, 17.3 LIVE 기준)

| 변수 | 값 | sim 적용 | 비고 |
|------|-----|---------|------|
| `mana` | `50/100` | ✅ | raw 채택 |
| `damage` | `[240, 360, 560]` | ✅ | aoe_circle base — magic AP scaling. resolveAbilityDamage carryForDamage |
| `onAttackBonus` | `[40, 60, 90]` | ✅ | 매 기본 공격 추가 magic (line 5626). Jax 와 동일 helper |
| `hexReduction` | `0.35` | ✅ | line 1330 `Math.pow(1 - 0.35, dist)`. **17.3: `0.45 → 0.35`** (3성 falloff 완화 = buff). center=cluster center (abilityTarget) |
| `stunDuration` | `[1.25, 1.5, 1.75]` | ✅ | line 1234-1235 starLevel별. 3명 (IVERN_STUN_TARGETS=3 hardcoded). PR #129 Lint #9 fix 이전부터 이미 IvernMinion 전용 분기에서 정합 |
| `spiritEffectPerStack` | `0` | ✅ (no-op) | falsy → 미프 stack damage amp 미적용 |
| `damageType` | `magic` | ✅ | resolveAbilityDamage 의 abilityData.damageType fallback |

**radius**: top-level abilityOverride 의 `radius: 3` (`carryAugments.ts:192`) — abilityData.radius 아님. config.radius 통해 findAbilityTargets 에 전달.

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| [[patch-17-2b]] (2026-04-29) | PR7-B 구현 — `dash: to_largest_cluster` + `aoe_circle radius 3` + `applyCarryPostCastEffects` multi-stun 통합 helper 도입 (PR #76 의 OOR multi-stun 누락 회귀 자동 해소) |
| [[patch-17-3]] (2026-05-13) | `hexReduction 0.45 → 0.35` (3성 falloff 완화 — buff). 다른 필드 (damage / onAttackBonus / stunDuration) 변경 없음 (verify 필요) |
| 17.2 도입 시점 | carry augment 1세대 — `gold` tier |

## sim 적용 상태 — `active`

✅ **활성** (entity-wide grep + cast path 전수 + actual integration 모두 verify):
- `role='Fighter'` 변환
- dash to_largest_cluster (cluster 탐지 알고리즘 — radius 2 hex 내 적 카운트)
- aoe_circle radius 3 + damage AP scaling magic
- `hexReduction 0.35` multiplicative falloff (cluster center 기준)
- `stunDuration[starLevel]` 3 nearest multi-stun (caster 위치 기준 sort)
- `onAttackBonus[starLevel]` AP scaling magic 매 기본 공격
- `spiritEffectPerStack 0` no-op (의도된 unused)

🔍 **검증 필요**:
- 17.3 패치노트 의 IvernMinion 관련 추가 변경분 verify (damage / onAttackBonus / stunDuration 변경 여부)
- statOverrides 인게임 측정 (HP/AS/range 변화 — 사용자 측정 후 채움)
- desc "2칸 내 가장 큰 적 무리에 도약" 해석 — sim 은 cluster radius=2 (cluster 정의의 거리, line 706) 로 구현. desc 가 "Ivern 으로부터 2칸" 의미일 가능성 → 사용자 의도 확정 필요
- IVERN_STUN_TARGETS=3 hardcoded — desc "가장 가까운 3명" 정합. starLevel별 변동 의도 여부 확인 (현재 모든 star 3명 fixed)

## Cast path 전수 확인 (5단계 워크플로우 cast path 3종)

| Cast path | IvernMinion 진입? | sim 정합 |
|-----------|:----------------:|:--------:|
| Main pipeline (line ~6137) | ✅ aoe_circle + dash + hexReduction + multi-stun 모두 적용 | ✓ |
| Recast (onKill) (line ~6544) | ❌ (PykeCarry 전용 `onKillRecastMultiplier` 분기) | — |
| OOR fallback (line 6973-7037) | ✅ `canDashCast = dash` true (to_largest_cluster) — 진입. dash + damage + hexReduction (applyCarryDamageModifiers line 7098) + multi-stun (applyCarryPostCastEffects line 7151) 모두 일관 | ✓ |

**확인** (PR #76 / codex P1 #76 helper 통합 효과):
- `applyAbilityDash` to_largest_cluster: main + OOR 양쪽 동일 helper 호출
- `applyCarryDamageModifiers` (hexReduction): caller 2 site main+OOR. IvernMinionCarry 한정 분기 양쪽 일관 (line 1328)
- `applyCarryPostCastEffects` (multi-stun): caller 2 site main+OOR. PR #76 의 "다른 carry-specific 메커니즘 OOR 누락 회귀 자동 해소" — 신규 carry post-cast 추가 시 helper 한 곳만 수정
- `outOfRangeConfig.stun` 분기 (line 7129) 와 무관 — IvernMinion abilityOverride.stun 없음 (`combatLoop.ts:6820-6824` 명시). multi-stun 은 별도 line 1232 분기 전용

## Lint finding

**신규 lint 검출 0건** — IvernMinionCarry 는 dash + hexReduction + multi-stun 모두 cast path 양쪽 일관. helper 통합 (`applyCarryDamageModifiers`, `applyCarryPostCastEffects`) 덕분에 PR #129 같은 OOR 누락 패턴 위험 자체 없음.

대신 desc 해석 ambiguity (cluster "2칸 내" 의미) 와 17.3 패치노트 다른 변경분 verify 정도가 후속 항목.

## Lint 체크리스트

- [x] entity-wide grep `Ivern` — multi-source: `findLargestClusterTarget` (line 694, dash helper) + `applyCarryDamageModifiers` (line 1328, hexReduction IvernMinionCarry 한정) + `applyCarryPostCastEffects` (line 1232, multi-stun IvernMinionCarry 한정) + `onAttackBonus` (line 5626, Jax 와 공유 helper) — 모두 의도된 분리, drift 없음
- [x] cast path 3종 — main + OOR 양쪽 일관 (helper 통합). recast 무관
- [x] actual integration verify — 6 필드 (damage/onAttackBonus/hexReduction/stunDuration/dash/spiritEffectPerStack) 모두 read 위치 확인. 신규 lint 0건
- [ ] 17.3 패치노트 IvernMinion 추가 변경분 verify (damage / onAttackBonus / stunDuration)
- [ ] statOverrides 인게임 측정
- [ ] desc "2칸 내" 해석 확정 (cluster radius vs Ivern-relative distance)

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[role-passive]] — Fighter role mana/타게팅 규칙
- [[ability-targeting]] — `aoe_circle` 패턴 + `to_largest_cluster` dash
- [[patch-17-2b]] / [[patch-17-3]] — PR7-B 도입 + hexReduction 변경
- 코드: `src/data/carryAugments.ts:188-204`, `src/lib/simulator/engine/combatLoop.ts:694/1226/1326/5618`
