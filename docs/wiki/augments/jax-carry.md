---
id: jax-carry
type: augment
display_name_kr: 저 별을 향해 (Reach for the Stars)
api_name: TFT17_Augment_JaxCarry
target_champion: TFT17_Jax
tier: (미확인 — 패치노트 verify 필요)
stage: stage 2 (carry augment 일반)
current_patch_status: active
sim_active: partial
last_verified: 2026-05-19 (Lint #11-B resolved PR #136)
sources:
  - src/data/carryAugments.ts:205-218 (JaxCarry entry)
  - src/lib/simulator/engine/combatLoop.ts:618-622 (getAbilityConfigForUnit)
  - src/lib/simulator/engine/combatLoop.ts:2220-2267 (applyHeroCarryTransforms role='Fighter')
  - src/lib/simulator/engine/combatLoop.ts:5618-5660 (onAttackBonus passive)
  - src/lib/simulator/engine/combatLoop.ts:6146-6149 (self_buff carry damage override 미적용 주석)
  - src/lib/simulator/engine/combatLoop.ts:6226 (self_buff → rawAbilityDmgBase=0)
  - src/lib/simulator/engine/combatLoop.ts:6885-6891 (config.selfBuff stat 적용)
  - 공식 17.3 패치노트 (damage 변경분)
related:
  - "[[hero-augment-carry]]"
  - "[[patch-17-3]]"
  - "[[ability-targeting]]"
  - "[[role-passive]]"
---

# 저 별을 향해 (JaxCarry, Reach for the Stars)

## 요약

Jax (`TFT17_Jax`) carry augment. 활성 시 가장 강한 Jax 1명 → `Fighter` 변환 + **self_buff 패턴** (cast 시 attackSpeed 영구 가산) + 매 기본 공격마다 `onAttackBonus` 추가 magic damage.

abilityOverride 가 `self_buff` 라서 cast 자체는 damage 없음. 실질 효과는 **(1) onAttackBonus 패시브** (매 기본 공격 추가 magic) + **(2) cast 마다 AS *= 1.15 누적** 두 가지.

## 변환 후 메커니즘

- **role**: `Fighter` (default — `applyHeroCarryTransforms` line 2227)
- **abilityOverride**: `{ pattern: 'self_buff', selfBuff: { attackSpeed: 0.15, duration: 999 } }` (`carryAugments.ts:208`)
- **cast 효과** (`combatLoop.ts:6885-6891`):
  - `unit.stats.attackSpeed *= (1 + 0.15)` — duration:999 무시 (sim 에 expiry 추적 없음 → 영구). 매 cast 마다 multiplicative 누적.
  - selfBuff.ad / ap / durability 없음
  - cast damage: `self_buff` 패턴이므로 `rawAbilityDmgBase = 0` 강제 (`combatLoop.ts:6226`) — carry abilityData.damage override 미적용
- **passive (onAttackBonus)**: 매 기본 공격마다 `onAttackBonus[starLevel-1]` AP scaling magic damage 추가 (`combatLoop.ts:5618-5660`)
  - target.state ≠ 'dead' && currentHp > 0 가드 (PR #74)
  - 통합 mitigation (resistance + DR + non-target reduction + shield + invulnerable)
- **mana**: 20/80 (raw 채택, statOverrides 없음 → calculateStats item bonus 그대로)

## 변수 (carryAugments.ts:209-217 abilityData, 17.3 LIVE 기준)

| 변수 | 값 | sim 적용 | 비고 |
|------|-----|---------|------|
| `mana` | `20/80` | ✅ | raw 채택 |
| `damage` | `[170, 250, 450]` | ❌ **미반영** | self_buff 패턴 → rawAbilityDmgBase=0 (line 6226). 17.3: `[155, 230, 375] → [170, 250, 450]` (entry 정합만) |
| `onAttackBonus` | `[45, 70, 105]` | ✅ | `combatLoop.ts:5626` AP scaling magic. 매 기본 공격마다 추가 |
| `asGain` | `[0.15, 0.15, 0.20]` | ✅ **활성** (PR #136 Lint #11-B 해소) | cast loop selfBuff 분기 (main `combatLoop.ts:6926` + OOR `:7071`) 에 starLevel별 우선 read. `unit.jaxCarryActive` 가드 (selected single-carry semantics). ★3 +20% 정합 |
| `damageType` | `magic` | n/a | damage 미반영이라 무의미. onAttackBonus 는 hardcoded 'magic' (line 5637) |

**abilityOverride.selfBuff.attackSpeed**: `0.15` (fallback — `asGain` 정의 안 된 경우만 사용). PR #136 이후 `asGain[starLevel-1]` 우선 read. ★3 시 +20% (`unit.jaxCarryActive` 가드 필수 — 다중 Jax 카피 시 selected 만).

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| [[patch-17-3]] (2026-05-13) | damage `[155, 230, 375] → [170, 250, 450]` (entry 정합 — 단 sim 미반영) |
| 17.3 이전 | 정확한 도입 패치 미verify (carryAugments.ts entry 외 source 없음) |

## sim 적용 상태 — `partial`

✅ **활성**:
- `role='Fighter'` 변환 (`applyHeroCarryTransforms`)
- selfBuff.attackSpeed 0.15 cast 마다 multiplicative 누적 (raw `config.selfBuff` 분기, line 6886-7)
- `onAttackBonus[starLevel]` AP scaling magic 매 기본 공격 (line 5618-5660)
- mana 20/80 raw 채택 (item bonus delta 보존)

✅ **활성** (PR #136 Lint #11-B 해소):
- **`asGain[0.15, 0.15, 0.20]` starLevel별 적용** — cast loop selfBuff 분기 (main + OOR 양쪽) `unit.jaxCarryActive` 가드. ★3 +20% 정합. selected single-carry semantics 적용

❌ **미반영** (잔존):
1. **`damage[170,250,450]` 미반영** — self_buff 패턴 → `rawAbilityDmgBase=0` (line 6226). user spec "사용: 대상 magic damage" 의도 vs 실제 cast damage 0. **Lint #11-A 잔존** — 별도 PR 필요 (single-target damage 분기 추가 vs 필드 dead 명시 결정)
2. **MS (이동속도) gain** — abilityData 에 movementSpeed 필드 없음. desc "AS/MS" 중 MS 부분 sim 미반영

🔍 **검증 필요**:
- selfBuff.duration 999 와 매 cast multiplicative AS *= 1.15 의 의도 일치성 — desc "전투 종료까지 누적" 표현이 multiplicative 인지 additive 인지 모호. PR #71 (codex P1) 가 self_buff 패턴 자체는 처리하나 starLevel별 분기는 별도.
- statOverrides 인게임 측정 (HP/AS base/range 변화 여부)

## Cast path 전수 확인 (5단계 워크플로우 cast path 3종)

| Cast path | Jax self_buff 진입? | sim 정합 |
|-----------|:-------------------:|:--------:|
| Main pipeline (line ~6137) | ✅ self_buff 분기 (line 6226 damage 0) | ✓ |
| Recast (onKill) (line ~6544) | ❌ (PykeCarry 전용 onKillRecastMultiplier 분기, Jax 무관) | — |
| OOR fallback (line 6973-7037) | ✅ self_buff OOR 경로 (line 7001-2 self-hit 회귀 방지) | ✓ |

**확인**: self_buff 패턴 자체는 main + OOR 양쪽 일관 — PR #98 codex P1 회귀 가드 (line 6222-6226 + 7001-7002). single fix 회귀 위험 없음.

## Lint finding (신규 검출)

### Lint candidate #11-A — JaxCarry `damage` 필드 sim 미반영

- carryAugments.ts:213 `damage: [170, 250, 450]` 와 desc "사용: 대상 magic damage" 명시
- combatLoop.ts:6149 주석 "self_buff pattern 은 carry damage override 적용 안 함" + line 6226 `if (config.pattern === 'self_buff') rawAbilityDmgBase = 0;`
- 17.3 patch entry 정합 (PR #115 같은 정합) 만 진행, sim 효과 도달 안 함
- **해소 방향**: (1) damage 필드 자체 deprecate + entry 에서 제거, (2) self_buff 패턴에서 별도 single-target damage 추가 분기, (3) "design intent" 로 sim 미반영 명시

### Lint #11-B — JaxCarry `asGain` ✅ resolved (PR #136)

- carryAugments.ts:215 `asGain: [0.15, 0.15, 0.20]` 가 dead field → sim 도달
- 해소 방식 (cast loop selfBuff 분기 inline 분기 추가):
  - **read site 2개** (main + OOR): selfBuff.attackSpeed 적용 직전 `carryCfg?.abilityData?.asGain` 우선 read. starLevel별 `asGain[unit.starLevel-1] ?? asGain[0]`. fallback `config.selfBuff.attackSpeed` (raw 0.15)
  - **`jaxCarryActive` flag 가드** (selected single-carry semantics, PR #135 codex P2 패턴): 다중 Jax 카피 시 selected 1명만 starLevel별 적용. non-selected 는 raw fallback
- 호출: main pipeline `combatLoop.ts:6926-6938` + OOR cast path `:7071-7081` 양쪽 일관 (cast path 3종 룰 — PR #129 stun 같은 OOR 누락 회귀 가드)
- 테스트: `tests/unit/simulator/hero-carry-augments.test.ts` 3 case — 활성 시 jaxCarryActive=true + role=Fighter / 미활성 false / 다중 Jax 카피 회귀 가드

## Lint 체크리스트

- [x] entity-wide grep `Jax` — multi-source drift 없음 (combatLoop.ts 의 self_buff 분기 + onAttackBonus 패시브 외 specific helper 함수 없음)
- [x] cast path 3종 (main + recast + OOR) — main + OOR 정합 (PR #136 asGain 양쪽 fix), recast 무관
- [x] actual integration verify — asGain ✅ resolved (PR #136), damage 잔존 (Lint #11-A)
- [x] **Lint #11-B ✅ resolved** (PR #136 — asGain starLevel별 우선 + jaxCarryActive 가드)
- [ ] **Lint #11-A 잔존** — damage 필드 미반영 (설계 결정 필요)
- [ ] statOverrides 인게임 측정 (HP/AS base/range)

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[role-passive]] — Fighter role mana/타게팅 규칙
- [[ability-targeting]] — `self_buff` 패턴 (3 cast path)
- [[patch-17-3]] — damage 변경 시점
- 코드: `src/data/carryAugments.ts:205-218`, `src/lib/simulator/engine/combatLoop.ts:618/2220/5618/6226/6886`
