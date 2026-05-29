---
id: invader-zed
type: augment
display_name_kr: 침략자 제드 (Invader Zed)
api_name: TFT17_Augment_InvaderZed
target_champion: TFT17_Zed
tier: special (스테이지 4-2 전용 획득)
stage: stage 4-2 only
current_patch_status: active (17.3 LIVE, 17.4 patch pending — base Zed 변경, [[patch-17-4]] 참조)
sim_active: minimal
last_verified: 2026-05-29 (17.4 patch fact 추가 — base Zed 변경 cross-ref; 이전: 2026-05-27 line drift)
sources:
  - src/data/carryAugments.ts:274-286 (InvaderZed entry)
  - src/lib/simulator/engine/combatLoop.ts:630 (getAbilityConfigForUnit)
  - src/lib/simulator/engine/combatLoop.ts:2258 (applyHeroCarryTransforms role='Fighter')
  - src/lib/simulator/engine/combatLoop.ts:1610-1620 (applyZedShadow trait — augment 무관)
  - src/lib/simulator/engine/combatLoop.ts:6196 (self_buff carry damage override 미적용 주석)
  - src/lib/simulator/engine/combatLoop.ts:6277 (self_buff → rawAbilityDmgBase=0)
  - src/lib/simulator/engine/combatLoop.ts:7001-7019 (config.selfBuff stat 적용 — selfBuff undefined 시 skip)
  - src/lib/simulator/systems/ability.ts:251 (TFT17_Zed raw `{ pattern: 'self_buff' }` — 분신 소환, 시뮬 stat-only)
related:
  - "[[hero-augment-carry]]"
  - "[[ability-targeting]]"
  - "[[role-passive]]"
  - "[[zed]]"
  - "[[patch-17-4]]"
---

# 침략자 제드 (InvaderZed)

## 요약

Zed (`TFT17_Zed`) carry augment, **스테이지 4-2 전용 special**. desc: "5단계 공격력 전사로 변하며 자신의 분신을 생성".

raw Zed 는 이미 `TFT17_ZedUniqueTrait` (은하계 사냥꾼) trait 으로 +40% AD 가산을 받는다 (분신 alive 가정 단순화, `combatLoop.ts:1610-1620`). InvaderZed augment 가 추가하는 sim 효과는 **role 변환 + mana 조정** 외에는 사실상 없음 — abilityOverride `{ pattern: 'self_buff' }` 만 정의되어 있고 `selfBuff` 필드 자체 없어 cast 효과 0.

**가장 sim 효과 적은 carry augment**.

## 변환 후 메커니즘

- **role**: `Fighter` (default — `applyHeroCarryTransforms` line 2258, drift fix PR #162 subagent P2-2)
- **abilityOverride**: `{ pattern: 'self_buff' }` (`carryAugments.ts:277`) — `selfBuff` 필드 **없음**
- **damageTypeOverride**: `physical` (line 278) — damage 자체가 미반영이라 무의미
- **cast 효과**:
  - self_buff 패턴 → `rawAbilityDmgBase = 0` 강제 (`combatLoop.ts:6277`)
  - `config.selfBuff` undefined → `combatLoop.ts:7001` if 가드 false → 어떤 stat 변경도 발생 안 함
  - 결론: **cast 자체는 mana 소비 외 sim 효과 없음**
- **mana**: 50/100 (raw 채택, statOverrides 없음)
- **분신 (shadow)**: sim 에 분신 unit 메커니즘 자체 없음 (`combatLoop.ts:1607` 주석 명시). raw Zed `TFT17_Zed: { pattern: 'self_buff' }` (`ability.ts:251`) 도 동일하게 stat-only 단순화.

### applyZedShadow 와의 관계 (별도 메커니즘)

- `applyZedShadow` (`combatLoop.ts:1610`) 는 **trait `TFT17_ZedUniqueTrait`** 활성 조건. InvaderZed augment 와 무관.
- 분신 alive 가정 → Zed 본인에게 즉시 +40% AD 가산 (`u.stats.damage *= 1.40`).
- InvaderZed augment 없이도 Zed + trait active 면 동일 buff 적용.

## 변수 (carryAugments.ts:279-285 abilityData)

| 변수 | 값 | sim 적용 | 비고 |
|------|-----|---------|------|
| `mana` | `50/100` | ✅ | raw 채택 |
| `damage` | `[300, 450, 720]` | ❌ **미반영** | self_buff 패턴 → rawAbilityDmgBase=0 |
| `damageType` | `physical` | ❌ **무의미** | damage 미반영 |

abilityOverride.selfBuff: **필드 자체 없음** → 어떤 stat buff 도 적용 안 됨.

## 패치 히스토리

| 패치 | 변경 | sim 적용 |
|------|------|---------|
| (도입 시점 미verify) | InvaderZed entry 등록 (carryAugments.ts) | ✅ entry minimal sim (role Fighter + mana 50/100) |
| [[patch-17-4]] (2026-05-27) | **base Zed 변경의 간접 영향** (PoppyCarry / InvaderZed augment 자체 변경 없음): base Zed 마나 `50/100` → `40/100` + 분신 HPPenalty `0.40` → `0.45`. InvaderZed augment 의 mana `50/100` 표기는 raw 채택이라 base Zed 변경 시 정합 깨질 가능성 — raw data fetch (sequence B) 후 verify | ❌ **간접 영향 sim 미반영** — base Zed raw json 갱신 후 InvaderZed entry 의 mana override 분기 정합 verify 필요. carry augment 자체 변경 없음 |

패치 변경 이력 verify 안 됨 — 17.3 패치노트 등에서 변경분 미발견. **TODO: stage 4-2 special augment 의 정확한 도입 시점 verify**.

## sim 적용 상태 — `minimal`

✅ **활성** (사실상 이것뿐):
- `role='Fighter'` 변환 (`applyHeroCarryTransforms`)
- mana 50/100 raw 채택

❌ **미반영**:
1. **`damage[300,450,720]` 미반영** — self_buff 패턴 + rawAbilityDmgBase=0
2. **`damageType='physical'` 무의미** — damage 자체 0
3. **분신 (shadow) unit 생성** — sim 에 분신 메커니즘 자체 없음 (line 1569 stat-only)
4. **"5단계 공격력 전사" desc** — 단순 role='Fighter' 변환만, 별도 단계별 메커니즘 없음
5. **selfBuff 필드 부재** — config.selfBuff undefined → cast 시 어떤 stat 변경도 없음

🔍 **검증 필요**:
- InvaderZed 의 의도된 메커니즘 spec 확인 (desc "분신 생성" 외 구체적 효과)
- raw 패치노트 / lolchess.gg / CDragon json source 확인
- Zed 본인 statOverrides 의도 (HP/AS/AD 추가 등)

## Cast path 전수 확인 (5단계 워크플로우 cast path 3종)

| Cast path | Zed self_buff 진입? | sim 정합 |
|-----------|:-------------------:|:--------:|
| Main pipeline (line ~6184) | ✅ self_buff 분기 (line 6277 damage 0) | ✓ (효과 0) |
| Recast (onKill) (line ~6606) | ❌ (PykeCarry 전용 — `onKillRecast` cascade) | — |
| OOR fallback (line ~7117-7160) | ✅ self_buff OOR 경로 (line 7131 self-hit 회귀 방지 + line 7160 selfBuff 가드) | ✓ (효과 0) |

**확인**: self_buff 패턴 cast path 자체는 main + OOR 양쪽 일관. 단, selfBuff 필드 부재로 어떤 stat 변경도 발생 안 함 → cast path 정합성과 무관하게 효과 0.

## Lint finding

### Lint candidate #13 — InvaderZed augment 실효성 거의 0

- abilityOverride `{ pattern: 'self_buff' }` 만 정의, selfBuff 필드 부재 → cast 시 stat 변경 0
- abilityData.damage 정의되어 있으나 self_buff 패턴이라 미반영
- desc "5단계 공격력 전사 + 분신 생성" 표현 vs 실제 sim 효과 = role='Fighter' + mana 50/100 뿐
- **해소 방향**:
  - (1) abilityOverride 에 selfBuff 추가 (예: `{ attackSpeed: 0.5, ad: 0.5, duration: 999 }` 같이 stage 4-2 special 답게 강력한 buff)
  - (2) statOverrides 추가 (HP/AS/AD 등 5단계 강화 표현)
  - (3) raw spec 측 의도 확인 후 정합 — 사용자 인게임 측정 / 패치노트 출처 verify 필요

### applyZedShadow 와 augment 의 관계 모호

- raw Zed 의 `self_buff` 패턴이 "분신 소환" desc 이나 sim 은 stat-only (`applyZedShadow` 가 별도 trait 기반 처리)
- InvaderZed augment 가 추가로 무엇을 더 해야 하는지 spec 불분명
- **TODO**: augment vs trait 의 분리 의도 확인 (augment 가 trait 효과를 강화? 별도 효과 추가?)

## Lint 체크리스트

- [x] entity-wide grep `Zed` — applyZedShadow / TFT17_ZedUniqueTrait 발견 (augment 무관, trait 기반)
- [x] cast path 3종 — main + OOR 진입 (단 효과 0)
- [x] actual integration verify — sim 효과 사실상 0 검출 (Lint #13)
- [ ] InvaderZed 의도된 메커니즘 spec 확인 (사용자 / 패치노트 source)
- [ ] statOverrides 측정

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[role-passive]] — Fighter role mana/타게팅 규칙
- [[ability-targeting]] — `self_buff` 패턴 (3 cast path, single fix 회귀 가드)
- 코드: `src/data/carryAugments.ts:274-286`, `src/lib/simulator/engine/combatLoop.ts:630/2258/1610/6277/7001`
