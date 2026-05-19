---
id: pyke-carry
type: augment
display_name_kr: 청부 살인마 (Hitman)
api_name: TFT17_Augment_PykeCarry
target_champion: TFT17_Pyke
tier: Gold
stage: 2 only
current_patch_status: active
sim_active: active
last_verified: 2026-05-18
sources:
  - src/data/carryAugments.ts:216 (PykeCarry entry)
  - src/lib/simulator/engine/combatLoop.ts:6544-6549 (onKillRecast cascade)
  - src/lib/simulator/engine/combatLoop.ts:1275 (tankBonusMultiplier)
  - src/lib/simulator/systems/ability.ts:339 (x_shape pattern algorithm)
  - 공식 17.2 / 17.2b 패치노트
related:
  - "[[hero-augment-carry]]"
  - "[[patch-17-2]]"
  - "[[patch-17-2b]]"
  - "[[ability-targeting]]"
---

# 청부 살인마 (PykeCarry, Hitman)

## 요약

[[patch-17-2]] LIVE 게임 도입 carry augment. Gold tier, Stage 2 only. 활성 시 Pyke (`TFT17_Pyke`) 가 가장 강한 1명 → `Fighter` 변환 + **X-shape 베기** + **dash to_lowest_hp** + **처치 시 재시전 cascade**.

복잡 메커니즘:
- **`x_shape` pattern** — 대상 본인 + 4 diagonal hex (NE/NW/SE/SW), horizontal 제외 ([[ability-targeting]] 의 9 패턴 중 하나, PR7-A 17.2b 추가)
- **onKillRecast** — primary target 처치 시 새 dash + 새 X-shape 재시전 (cascade max 5 chain)
- **tankBonusMultiplier** — primary target 이 Tank role 일 때 ×1.60 추가 damage
- **scalingInput** — 처치 수에 따라 영구 골드 +1 누적 (UI 표시)

## 변환 후 메커니즘

- **role**: `Fighter` (default, statOverrides 미설정)
- **ability pattern**: `x_shape, dash: 'to_lowest_hp'`
- **cast 흐름**:
  1. 적 가장 낮은 HP unit 으로 dash (`to_lowest_hp`)
  2. 대상 위치 기준 X-shape (대상 + 4 diagonal) 베기
  3. 대상 (primary) AD damage. Tank 일 때 ×1.60 (tankBonus)
  4. 주변 X-shape 적 (secondary) `secondaryDamage` AD
  5. **primary target 처치 시 cascade**: 새로운 가장 낮은 HP 적으로 새 dash + 새 X-shape 재시전 (max 5 chain). 재시전 damage 는 `onKillRecastMultiplier × baseDamage`

## 변수 (carryAugments.ts:216 abilityData, 17.2b LIVE 기준 — 17.3 변경 없음)

| 변수 | 값 | 설명 / sim apply site |
|------|-----|----------------------|
| `mana` | `0/40` | 시작/최대 마나 (매우 빠른 발동) |
| `damage` | `[220, 330, 500]` | primary target AD damage |
| `secondaryDamage` | `[60, 90, 135]` | X-shape 주변 적 AD damage |
| `tankBonusMultiplier` | `0.60` | primary 가 Tank 일 때 ×1.60 (`combatLoop.ts:1275`) |
| `onKillRecastMultiplier` | `0.70` | 처치 시 재시전 damage ×0.70 (`combatLoop.ts:6549`) |
| `damageType` | `physical` | |
| `scalingInput` | "처치 수 × 골드 +1" | UI 표시용 (실제 골드 적용은 별도) |

## sim 적용 상태 — `active`

✅ **활성** (entity-wide grep `Pyke` + cast path 전수 + actual integration 모두 verify):
- `x_shape` pattern — `ability.ts:339` (NE/NW/SE/SW 4 diagonal + 대상 본인)
- dash `to_lowest_hp` — `applyAbilityDash` 분기 (PR7-A)
- tankBonusMultiplier — `combatLoop.ts:1275` (primary target.role === 'Tank' 시 baseDmg × (1 + multiplier))
- **onKillRecast cascade** — `combatLoop.ts:6544-6580` (max 5 chain, 새 dash + 새 X-shape 재계산, primary vs secondary damage 분기, omnivamp/Fountain/on_cast 정합)
- 17.2b 도입 후 17.3 변경 없음 — sim 정합 안정

🔍 **검증 / 미완**:
- statOverrides (HP/armor/MR/AS/range/damage 등 augment 활성 시 변환된 stat) — 사용자 인게임 측정 대기
- recast cascade max 5 가 사용자 spec 의도와 정확 일치 — 무한 루프 방지 가드, 실제 게임 cascade 한도와 비교 필요

## ⚠️ Lint finding #10 — hero-augment-carry "미완" 표기 stale 검출 (위키 검출 10번째)

`mechanics/hero-augment-carry.md` 의 "sim 적용 상태 ❌ 미완 (사용자 인게임 측정 대기)" 섹션:

> Pyke X-shape onKill 재시전 (`onKillRecastMultiplier 0.70`) — onKill hook 분기 필요

→ **stale**. PR7-A (17.2b 후속) 이 이미 `combatLoop.ts:6544-6580` 에 cascade 구현 완료. entity-wide grep `Pyke` 로 발견.

**조치**: `mechanics/hero-augment-carry.md` 의 "Pyke X-shape onKill 재시전 미구현" 표기 → "구현 완료 (PR7-A, line 6544-6580)" 로 정정. wiki cleanup PR 후보 (별도).

## Cast path 전수 확인 (5단계 워크플로우)

| Cast path | Pyke 메커니즘 진입? | sim 정합 |
|-----------|:-------------------:|:--------:|
| Main pipeline (line ~6170) | ✅ primary cast + tank bonus + secondary | ✓ |
| **Recast (onKill cascade)** (line 6544) | ✅ **본 augment 전용 메커니즘** | ✓ — max 5 chain, 동일 mitigation/amp 적용 |
| OOR fallback (line ~7000) | ⚠️ x_shape pattern 진입 가능성 — `aoe_circle` 처럼 별도 처리되는지 별도 verify 필요 |

**🔍 후속 verify**: OOR cast path 에서 PykeCarry 의 x_shape + onKillRecast 가 일관 적용되는지. PR #129 의 stun 같은 패턴 가능성. **Lint 후보로 등록** (확정 검출 아님).

## Lint 체크리스트

- [x] entity-wide grep `Pyke` — multi-source drift 없음 확인. carryAugments.ts entry + ability.ts x_shape + combatLoop.ts main pipeline + onKillRecast cascade 모두 정합
- [x] **Lint #10 신규 검출** — hero-augment-carry "onKill 재시전 미구현" stale 표기. 본 페이지에서 정정 노트 + 별도 cleanup PR 등록
- [ ] OOR cast path 의 x_shape + onKillRecast 일관성 verify — PR #129 stun 같은 패턴 가능성
- [ ] cascade max 5 chain 인게임 spec 정합 verify
- [ ] statOverrides 인게임 측정

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체. Lint #10 (Pyke 미완 stale) 검출
- [[ability-targeting]] — `x_shape` 9 패턴 중 하나 (axial 4 diagonal — NE/NW/SE/SW, horizontal 제외)
- [[patch-17-2]] / [[patch-17-2b]] — 도입 + PR7-A (x_shape 추가) 시점
- 코드: `src/data/carryAugments.ts:216`, `src/lib/simulator/engine/combatLoop.ts:6544/1275`, `src/lib/simulator/systems/ability.ts:339`
