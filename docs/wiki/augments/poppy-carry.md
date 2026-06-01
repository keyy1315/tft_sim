---
id: poppy-carry
type: augment
display_name_kr: 정령단 속도 (Termeepnal Velocity)
api_name: TFT17_Augment_PoppyCarry
target_champion: TFT17_Poppy
tier: (미확인 — 패치노트 verify 필요)
stage: stage 2 (carry augment 일반)
current_patch_status: active
sim_active: active
last_verified: 2026-05-19
sources:
  - src/data/carryAugments.ts:150-169 (PoppyCarry entry)
  - src/lib/simulator/engine/combatLoop.ts:549-554 (applyCarryAugmentRange — rangeOverride 4)
  - src/lib/simulator/engine/combatLoop.ts:1288-1333 (applyCarryDamageModifiers — armorScale 분기)
  - src/lib/simulator/engine/combatLoop.ts:6231-6233 (spiritEffectPerStack 적용 — main pipeline only)
  - src/lib/simulator/engine/combatLoop.ts:6396-6399 (primaryOverkillForBounce 캡처)
  - src/lib/simulator/engine/combatLoop.ts:6526-6530 (cast loop 사망 처리 overkill 캡처)
  - src/lib/simulator/engine/combatLoop.ts:6648-6680 (spiritBounceOnKill bouncing loop — main pipeline only)
  - src/lib/simulator/engine/combatLoop.ts:873-920 (applyPoppyShieldAndResists — Set 17 Poppy passive, augment 무관)
  - "공식 17.3 패치노트 (Termeepnal Velocity AS: 0.7 → 0.75 — verify 필요)"
related:
  - "[[hero-augment-carry]]"
  - "[[ability-targeting]]"
  - "[[role-passive]]"
  - "[[patch-17-3]]"
---

# 정령단 속도 (PoppyCarry, Termeepnal Velocity)

## 요약

Poppy (`TFT17_Poppy`) carry augment. 활성 시 가장 강한 Poppy 1명 → `Fighter` 변환 + **ranged projectile** (rangeOverride 4, dash 없음) + AD physical single + **armorScale 1.0** (target armor 100% 가산) + **spiritBounceOnKill** (처치 시 overkill 잔여 damage 가장 가까운 적에 튕김 max 50 chain) + 미프 정령족 잠재력 stack 당 damage amp.

또한 raw Set 17 Poppy 의 **applyPoppyShieldAndResists** (본인 shield + 2칸 내 아군 armor/MR 가산) passive 가 별도로 작동 (augment 무관, 두 cast path 모두 호출).

## 변환 후 메커니즘

- **role**: `Fighter` (default — `applyHeroCarryTransforms` line 2227)
- **rangeOverride**: `4` (`applyCarryAugmentRange` line 549-554 → `unit.stats.range = 4`)
- **abilityOverride**: `{ pattern: 'single' }` — dash 없음 + self_buff 아님 (`carryAugments.ts:156`)
- **damageTypeOverride**: `physical`
- **cast 효과** (main pipeline):
  - single pattern → 가장 가까운 적 1명 (rangeOverride 4 덕분에 사거리 확장)
  - base damage: `damage[starLevel-1]` AD physical (`resolveAbilityDamage` carryForDamage 경로)
  - **armorScale 1.0**: `applyCarryDamageModifiers` line 1322-1324 → `baseDmg += t.stats.armor * 1.0` (target armor 만큼 raw 가산, 호출 순서 4번째 = secondary/tankBonus 이후)
  - **spiritEffectPerStack 0.15**: line 6231-6233 → `baseDmg *= (1 + astronautMeepsStack × 0.15)` (미프 trait active 시 적용)
  - **spiritBounceOnKill**: cast loop 의 primary target 처치 시 `primaryOverkillForBounce = -t.currentHp` 캡처 (clamp 전, line 6526-6530). 사후 bouncing loop (line 6648-6680) — `overkill > 0 && bounceCount < 50` while, 처치된 target 위치 기준 가장 가까운 alive 적 정렬 + applyAbilityMitigation 통과 + currentHp 차감 → 새 overkill 계산 누적
- **mana**: 30/100 (raw 채택)

### Set 17 Poppy passive (augment 와 별개)

`applyPoppyShieldAndResists` (line 873-920) — augment 활성 여부 무관, raw Poppy cast 시 발동:
- 본인 Shield (`Shield` raw var × (1+AP/100), `ShieldDuration` 만료)
- 2칸 내 아군 armor + magicResist 가산 (`Resists` raw var × (1+AP/100), 같은 duration)
- 만료 처리: statusEffect 추적 + tickStatusEffects expired loop revert
- **두 cast path 모두 호출** (line 6902 main, line 7040 OOR) — 다만 PoppyCarry 는 OOR 진입 불가 (아래 cast path 표 참조)

## 변수 (carryAugments.ts:159-168 abilityData, 17.3 LIVE 기준)

| 변수 | 값 | sim 적용 | 비고 |
|------|-----|---------|------|
| `mana` | `30/100` | ✅ | raw 채택 |
| `damage` | `[340, 510, 850]` | ✅ | single pattern + carryForDamage 경로 + physical |
| `armorScale` | `1.0` | ✅ | line 1322-1324 raw 가산. 100% armor 가산 |
| `spiritEffectPerStack` | `0.15` | ✅ | line 6231-6233 미프 정령족 잠재력 stack 당 multiplicative |
| `spiritBounceOnKill` | `true` | ✅ | line 6648-6680 overkill chain (MAX_BOUNCE_HARD_LIMIT 50) |
| `damageType` | `physical` | ✅ | damageTypeOverride 우선 |
| `rangeOverride` (top-level) | `4` | ✅ | line 549-554 |

**statOverrides**: 없음 — Lint #5 잔존 TODO (AS 0.7→0.75 인게임 verify 필요).

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| 17.2b | spiritBounceOnKill PR7-D 구현 (cast loop 사망 처리 + overkill 캡처 + bouncing loop). codex P1 (PR #75) overkill clamp 회귀 수정 |
| 17.3 (2026-05-13) | 패치노트 "Termeepnal Velocity AS: 0.7 → 0.75" — augment grant 인지 base stat 변경인지 모호. `carryAugments.ts:153-155` TODO 주석. **인게임 verify 필요 (Lint #5 잔존)** |
| 도입 시점 | 17.2 (carry augment 1세대) — verify 필요 |

## sim 적용 상태 — `active`

✅ **활성** (entity-wide grep + cast path 전수 + actual integration 모두 verify):
- `role='Fighter'` 변환 + `rangeOverride 4` (사거리 확장이 핵심)
- single pattern + damage [340, 510, 850] AD physical
- `armorScale 1.0` (`applyCarryDamageModifiers` line 1322-1324)
- `spiritEffectPerStack 0.15` (미프 trait active 시 main pipeline 적용)
- `spiritBounceOnKill` bouncing chain (primary 처치 시 overkill 캡처 → 가장 가까운 alive 적 chain, mitigation 통과, max 50)
- Set 17 Poppy passive (`applyPoppyShieldAndResists`) — augment 와 별개 작동, 2 cast path 호출

🔍 **검증 / 미완**:
- **Lint #5 잔존 — AS 0.7→0.75 인게임 verify**: statOverrides.attackSpeed 적용 위치 결정 필요. (1) base AS 절댓값 set, (2) base AS 곱셈자, (3) PoppyCarry-specific stat field 추가 — 사용자 인게임 측정 데이터 제공 후 확정
- `statOverrides` 인게임 측정 (HP/AS/range 변화)

## Cast path 전수 확인 (5단계 워크플로우 cast path 3종)

| Cast path | Poppy 진입? | sim 정합 |
|-----------|:-----------:|:--------:|
| Main pipeline (line ~6137) | ✅ single 패턴 cast (armorScale + spiritEffect + spiritBounceOnKill + Poppy passive 모두 적용) | ✓ |
| Recast (onKill) (line ~6544) | ❌ (PykeCarry 전용 `onKillRecastMultiplier` 분기, PoppyCarry 무관) | — |
| OOR fallback (line 6973-7037) | ❌ **진입 불가** (line 6977-78 `canDashCast = dash \|\| self_buff` 가드 — PoppyCarry abilityOverride `{ pattern: 'single' }` 만, dash/self_buff 둘 다 없음) | n/a |

**확인**:
- PoppyCarry 의 ability override 자체가 dash 없고 self_buff 도 아니므로 OOR fallback cast path 진입 자체 불가
- 따라서 `spiritBounceOnKill` / `armorScale` / `spiritEffectPerStack` 이 main pipeline 에만 있는 것은 정합 — PR #129 같은 OOR 누락 패턴 위험 없음
- 단, `applyPoppyShieldAndResists` 자체는 main + OOR 양쪽 호출되도록 helper 통합 — Poppy 가 미래에 OOR 진입 가능 변경 시 자동 정합 (codex P1 #76 일관성 가드 효과)

## Lint finding

### Lint #5 잔존 — PoppyCarry AS 0.7→0.75 인게임 verify (기존)

`carryAugments.ts:154-155` TODO 주석 — 17.3 패치노트 변경분이 augment grant 인지 base 인지 verify 필요. **사용자 인게임 측정 데이터 제공 후 statOverrides.attackSpeed 채움**.

신규 lint 검출 없음 — PoppyCarry 는 entity-wide grep + cast path 전수 + actual integration 모두 정합. carry augment 중 가장 많은 메커니즘 (rangeOverride / armorScale / spiritEffect / spiritBounce + raw Poppy passive) 이 모두 sim 도달.

## Lint 체크리스트

- [x] entity-wide grep `Poppy` — multi-source 확인: `applyPoppyShieldAndResists` (raw passive, augment 무관) + `applyCarryAugmentRange` (range override) + `applyCarryDamageModifiers` (armorScale) + spiritBounce loop (main only). 모두 의도 정합
- [x] cast path 3종 — main 만 진입 (OOR/recast 무관), spiritBounce 가 main only 인 것 정합 (OOR 진입 불가)
- [x] actual integration verify — 5 필드 (rangeOverride/damage/armorScale/spiritEffect/spiritBounce) 모두 main pipeline read 위치 확인. 신규 lint 0건
- [ ] Lint #5 잔존 — AS 0.7→0.75 인게임 측정 후 statOverrides 채움
- [ ] integration test — primary overkill 캡처 (clamp 전) → bounce loop 정확성 (codex P1 PR #75 회귀 가드)

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[role-passive]] — Fighter role mana/타게팅 규칙
- [[ability-targeting]] — `single` 패턴 (main only)
- [[patch-17-3]] — AS 변경 (verify 대기)
- 코드: `src/data/carryAugments.ts:150-169`, `src/lib/simulator/engine/combatLoop.ts:549/873/1226/1322/6231/6526/6648`
