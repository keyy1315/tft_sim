---
id: nasus-carry
type: augment
display_name_kr: 꽁! (Bonk!)
api_name: TFT17_Augment_NasusCarry
target_champion: TFT17_Nasus
tier: (미확인 — 패치노트 verify 필요)
stage: stage 2 (carry augment 일반)
current_patch_status: active
sim_active: active
last_verified: 2026-05-19
sources:
  - src/data/carryAugments.ts:113-129 (NasusCarry entry)
  - src/lib/simulator/engine/combatLoop.ts:618-622 (getAbilityConfigForUnit)
  - src/lib/simulator/engine/combatLoop.ts:2220-2267 (applyHeroCarryTransforms role='Fighter')
  - src/lib/simulator/engine/combatLoop.ts:643-665 (resolveAbilityDamage carry damage 분기)
  - 공식 17.3 패치노트 (Bonk! Resists 40→45 — verify 필요)
related:
  - "[[hero-augment-carry]]"
  - "[[ability-targeting]]"
  - "[[role-passive]]"
---

# 꽁! (NasusCarry, Bonk!)

## 요약

Nasus (`TFT17_Nasus`) carry augment. 활성 시 가장 강한 Nasus 1명 → `Fighter` 변환 + **single 패턴** AD physical cast. desc 상 "이 스킬로 적을 처치하면 스킬 피해량이 영구적으로 증가" (처치 누적) — 그러나 `bonusPerKill` 필드는 sim 미반영.

가장 단순한 carry augment 구조: abilityOverride `{ pattern: 'single' }` 만 정의, abilityData 의 damage 가 표준 `resolveAbilityDamage` 경로로 사용됨.

## 변환 후 메커니즘

- **role**: `Fighter` (default — `applyHeroCarryTransforms` line 2227)
- **abilityOverride**: `{ pattern: 'single' }` (`carryAugments.ts:116`)
- **damageTypeOverride**: `physical` (line 117) — `resolveAbilityDamage` damageType 우선 physical
- **cast 효과**:
  - single pattern → 가장 가까운 적 1명에게 `damage[starLevel-1]` AD physical (carry damage override 경로, `combatLoop.ts:6216-6220` resolveAbilityDamage → carryForDamage)
  - physical 이므로 `baseValue * (1 + bonusAdPercent)` — carry abilityData 에 bonusAdPercent 없음 → baseValue 그대로
- **mana**: 60/120 (raw 채택)
- **scalingInput**: `{ label: '처치 수', unit: '회', max: 999, effectPerStack: '피해량 +10' }` — UI 표시용 (sim 미반영, scalingInput 자체는 sim 효과 분기 없음)

## 변수 (carryAugments.ts:121-128 abilityData, 17.3 LIVE 기준)

| 변수 | 값 | sim 적용 | 비고 |
|------|-----|---------|------|
| `mana` | `60/120` | ✅ | raw 채택 |
| `damage` | `[280, 420, 670]` | ✅ | `resolveAbilityDamage` carryForDamage 경로 — single 패턴 |
| `bonusPerKill` | `[10, 13, 20]` | ✅ **활성** (PR #135 Lint #12 해소) | `applyCarryDamageModifiers` line 1334 modifier #6 — `baseDmg += unit.nasusBonkStack × bonusPerKill[starLevel-1]`. Stack 누적: cast loop `markTargetDead` 직후 (NasusCarry 활성 + Nasus 본인 한정). basic attack kill 제외 |
| `damageType` | `physical` | ✅ | damageTypeOverride physical 우선 |

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| 17.3 (2026-05-13) | 패치노트 "Bonk! Resists: 40 → 45" — augment grant 인지 champion baseline 변경인지 모호. `carryAugments.ts:119-120` TODO 주석. **인게임 verify 필요 (Lint #5 잔존)** |

## sim 적용 상태 — `active`

✅ **활성**:
- `role='Fighter'` 변환
- single pattern + damage [280, 420, 670] AD physical (carryForDamage 경로)
- damageTypeOverride `physical` 우선
- mana 60/120 raw 채택
- **`bonusPerKill[10,13,20]` cast kill 누적** (PR #135 Lint #12 해소):
  - Stack 누적: cast loop `markTargetDead` 직후 (`combatLoop.ts:6549-6555`). NasusCarry 활성 + `unit.champion.apiName === 'TFT17_Nasus'` 한정. basic attack kill 제외 ("이 스킬로" desc 정합)
  - Read site: `applyCarryDamageModifiers` modifier #6 (`combatLoop.ts:1334-1340`) — `baseDmg += unit.nasusBonkStack × bonusPerKill[starLevel-1]`. base + scale 후 영구 buff raw 가산
  - Invariant: `nasusBonkStack ≤ killCount` (cast kill 만 누적)

❌ **잔존**:
- **Resists 40→45 buff** — 17.3 패치노트. statOverrides.armor/magicResist 없음. augment grant 인지 base stat 변경인지 모호 → 인게임 측정 후 확정 (Lint #5 잔존).

🔍 **검증 필요**:
- statOverrides 인게임 측정 (Lint #5):
  - augment 활성 시 armor +40 (또는 +45)
  - magicResist +40 (또는 +45)
  - HP/AS/range 변화 여부

## Cast path 전수 확인 (5단계 워크플로우 cast path 3종)

| Cast path | Nasus single 진입? | sim 정합 |
|-----------|:------------------:|:--------:|
| Main pipeline (line ~6137) | ✅ single 패턴 cast (carryForDamage 경로) | ✓ |
| Recast (onKill) (line ~6544) | ❌ (PykeCarry 전용 분기) | — |
| OOR fallback (line 6973-7037) | ⚠️ dash 없음 → OOR 진입 안 함 (line 6977-78: `dash || self_buff` 가드) | n/a |

**확인**: NasusCarry abilityOverride 에 dash 없음 + self_buff 아님 → OOR fallback path 진입 자체 없음. main pipeline single cast 만 사용 → single fix path.

## Lint finding

### Lint #12 — NasusCarry `bonusPerKill` ✅ resolved (PR #135)

- carryAugments.ts:127 `bonusPerKill: [10, 13, 20]` 가 dead field → sim 도달
- 해소 방식 (단순 inline hook, eventBus listener 미사용):
  - **Stack 누적**: cast loop `markTargetDead` 호출 직후 (`combatLoop.ts:6549-6555`) — NasusCarry 활성 + `unit.champion.apiName === 'TFT17_Nasus'` + `carryCfg.abilityData.bonusPerKill` 가드. basic attack kill 자동 제외 (cast site 한정)
  - **Stack read**: `applyCarryDamageModifiers` modifier #6 추가 (`combatLoop.ts:1334-1340`) — base + scale 후 raw 가산. caller 2 site (main + OOR) 자동 일관 — 다만 NasusCarry single pattern 은 OOR 진입 불가 (canDashCast 가드)
- 호출 순서: 단독 적중 → secondary → tankBonus → armorScale → hexReduction → **bonusPerKill** (마지막, 영구 buff 가산 의미)
- 테스트: `tests/unit/simulator/hero-carry-augments.test.ts` 3 case — 초기값 0 / cast kill ≤ killCount invariant / augment 미활성 시 stack 0

### Lint #5 잔존 — Resists 40→45 인게임 verify (기존)

`carryAugments.ts:119-120` TODO 주석 — 17.3 패치노트 변경분이 augment grant 인지 base 인지 verify 필요. **사용자 인게임 측정 데이터 제공 후 statOverrides.armor/magicResist 채움**.

## Lint 체크리스트

- [x] entity-wide grep `Nasus` — multi-source drift 없음. PR #135 후 inline 분기 추가 (cast loop markTargetDead 직후 + applyCarryDamageModifiers modifier #6)
- [x] cast path 3종 — main 만 진입 (OOR/recast 무관). modifier helper 자체는 main+OOR caller 2 site 자동 일관
- [x] actual integration verify — `bonusPerKill` sim 도달 (PR #135)
- [x] **Lint #12 ✅ resolved** (PR #135 — inline hook + modifier #6)
- [ ] Resists 40→45 인게임 측정 (Lint #5 잔존)

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[role-passive]] — Fighter role mana/타게팅 규칙
- [[ability-targeting]] — `single` 패턴 (main 만 진입)
- 코드: `src/data/carryAugments.ts:113-129`, `src/lib/simulator/engine/combatLoop.ts:618/2220/643`
