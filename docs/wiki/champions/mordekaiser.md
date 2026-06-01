---
id: mordekaiser
type: champion
display_name_kr: 모데카이저
api_name: TFT17_Mordekaiser
cost: 2
traits:
  - 암흑의 별
  - 전달자
  - 선봉대
role: Tank   # raw "APTank" → mapGameRole() → sim Tank. ⚠️ MordekaiserCarry augment 활성 시 Fighter 로 변환 (applyHeroCarryTransforms) — base 의 helper 메커니즘은 carry 활성 여부와 무관 동작 (mordekaiserCarryShield 만 InitialShield override)
raw_role: APTank
current_patch_status: active
sim_active: active   # base raw 메커니즘 거의 완성 (helper 2개 + 별도 shield pool + healRefund + main/OOR cast parity)
last_verified: 2026-05-26
sources:
  - "public/data/tft_set17_champions.json (TFT17_Mordekaiser entry)"
  - "src/lib/simulator/systems/ability.ts:210 (abilityOverride pattern 'self_buff' + comment helper 참조)"
  - "src/lib/simulator/engine/combatLoop.ts:230-233 (mordekaiser proc state field 3개 + mordekaiserShieldRemaining default)"
  - "src/lib/simulator/engine/combatLoop.ts:292 (mordekaiserCarryShield: null default — carry data 보유 필드)"
  - "src/lib/simulator/engine/combatLoop.ts:953-975 (applyMordekaiserProcCast — InitialShield × AP → shield pool + proc state 등록)"
  - "src/lib/simulator/engine/combatLoop.ts:990-1067 (tickMordekaiserProc — 매초 펄스 + 만료 healRefund)"
  - "src/lib/simulator/engine/combatLoop.ts:1213-1218 (mordekaiserShieldRemaining 별도 pool 우선 흡수)"
  - "src/lib/simulator/engine/combatLoop.ts:2041 (암흑의 별 6 챔프 — Kaisa/Karma/Jhin/Chogath/Lissandra/Mordekaiser)"
  - "src/lib/simulator/engine/combatLoop.ts:5533 (tickMordekaiserProc — combat loop per-tick 호출)"
  - "src/lib/simulator/engine/combatLoop.ts:7037 / :7185 (applyMordekaiserProcCast — main + OOR cast path 양쪽 호출, cast path parity)"
  - "src/lib/simulator/engine/combatLoop.ts:2305-2312 (applyHeroCarryTransforms — MordekaiserCarry 활성 시 mordekaiserCarryShield carry data 저장)"
  - "src/lib/simulator/engine/combatLoop.ts:524-529 (전달자/Channeler TFT17_ManaTrait InnateManaGain → unit.channelerInnateManaGain 설정)"
  - "src/lib/simulator/engine/combatLoop.ts:5549 (channelerMult — 매 tick mana gain × (1 + channelerInnateManaGain))"
  - "src/lib/simulator/systems/mana.ts:36-41 (channelerInnateManaGain 곱셈자 helper)"
  - "tests/unit/mordekaiser-proc.test.ts (applyMordekaiserProcCast + tickMordekaiserProc 전용 test)"
  - "tests/unit/simulator/darkstar-execute-supermassive.test.ts:27+ (apMordekaiser 암흑의 별 fixture)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[hero-augment-carry]]"
  - "[[mordekaiser-carry]]"
  - "[[shen]]"
  - "[[jax]]"
  - "[[nasus]]"
---

# 모데카이저 (Mordekaiser)

## 요약

2코스트 **Tank** (raw `APTank` → `mapGameRole()` → sim Tank, [[role-passive]]), 암흑의 별(Dark Star) + 전달자 + 선봉대(Vanguard) 시너지. raw 어빌리티 "불멸" — InitialShield 부여 + 4초 동안 매초 (본인 shield +N + 인접 적 magic damage) 펄스 + 종료 시 잔여 shield × 40% healRefund.

[[mordekaiser-carry]] (뜨거운 죽음 / Heat Death) augment 활성 시 가장 강한 Mordekaiser 1명이 **Fighter 로 변환** + `mordekaiserCarryShield` carry data 저장 + statOverrides `mana 10/40`. 본 페이지는 **base raw Mordekaiser** 의 sim 동작을 다루며, carry 변환 사항은 [[mordekaiser-carry]] 참조.

> ⚠️ Role 주의 — base vs carry: raw role `APTank` → sim **Tank** (weight 3, 공격당 마나 5, 피격 시 마나 ✅). **MordekaiserCarry augment 활성 시** `applyHeroCarryTransforms` 가 `target.role = 'Fighter'` overwrite → Fighter 룰 ([[jax]] / [[nasus]] 와 동일 패턴). 단 **proc helper 자체는 carry 활성 여부와 무관 동작** — base sim 이 helper 통합 (cast 진입 시점 + tick 처리) 라 carry 활성 시 `mordekaiserCarryShield` 만 InitialShield override 로 작용 (PR #124 lint #7 해소).

## 메커니즘 (base raw, helper 통합 sim)

### Stats (raw, 17.3 LIVE)

| Stat | 값 |
|------|---|
| hp | 950 |
| armor / magicResist | 45 / 45 |
| damage | 40 |
| attackSpeed | 0.6 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 40 / 100 |

### Active — 불멸 (Immortal)

raw 명세: "`@ModifiedInitialShield@(scaleAP)`의 보호막을 얻습니다. 다음 `@Duration@`초 (`@AugmentedDuration@` if Concentration) 동안 매초 `@ModifiedShieldPerProc@(scaleAP)`의 보호막을 더 얻고 인접한 적에게 `@ModifiedDamagePerProc@(scaleAP)`의 마법 피해를 입힙니다. 이 스킬이 끝나면 남은 보호막을 소모하고 보호막 수치의 `@HealRefund*100@%`만큼 체력을 회복합니다."

→ **4단계 효과** (모두 sim 적용 ✅): (1) 즉시 InitialShield × (1+AP/100) 부여, (2) Duration (기본 4s) 동안 매초 펄스 = 본인 ShieldPerProc + 1칸 적 DamagePerProc magic, (3) Duration 만료 시 잔여 shield × HealRefund (40%) × (1+healAmp) currentHp 회복, (4) `mordekaiserShieldRemaining` 별도 pool 로 unit.shield 와 분리 (HealRefund 정확 계산).

**sim 적용** (`ability.ts:210` + 헬퍼 2개):
```ts
TFT17_Mordekaiser: { pattern: 'self_buff' },  // 헬퍼가 메인 처리
```

| 단계 | 코드 위치 | 동작 |
|------|----------|------|
| cast 시점 (main pipeline) | `combatLoop.ts:7037` `applyMordekaiserProcCast(unit, tick)` | InitialShield × AP → `mordekaiserShieldRemaining` 누적. `mordekaiserProcEndTick = tick + Duration × TICKS_PER_SECOND`. `mordekaiserNextProcTick = tick + TICKS_PER_SECOND` (첫 펄스 t=1) |
| cast 시점 (OOR cast path) | `combatLoop.ts:7185` 동일 helper 호출 | **main + OOR parity** (cast path 3종 룰 일관 — [[ability-targeting]]) |
| 매 tick 처리 | `combatLoop.ts:5533` `tickMordekaiserProc(unit, ...)` | 펄스 발동 + 만료 처리 (사망 시 cancel + cleanup) |
| 펄스 발동 (`t = mordekaiserNextProcTick ~ ProcEndTick`) | `combatLoop.ts:1016-1052` | 1칸 적 → DamagePerProc × AP magic (`applyAbilityMitigation` 표준 통과 + per-target damageAmp + tank amp 3종 + sniper). 본인 → ShieldPerProc × AP shield pool 누적. nextProcTick += TICKS_PER_SECOND |
| 만료 (`t >= ProcEndTick`) | `combatLoop.ts:1055-1066` | `heal = mordekaiserShieldRemaining × HealRefund (0.4) × (1+healAmp)` → `currentHp` 회복. shield pool reset 0 |
| 별도 shield pool 흡수 | `combatLoop.ts:1213-1218` | damage 가 mitigation 통과 후 `mordekaiserShieldRemaining > 0` 시 우선 흡수 (general `unit.shield` 와 분리 — HealRefund 잔여 정확 계산) |

### raw ability variables (★1~★5 — 첫 값 sentinel filler)

| 변수 | raw 값 | sim 적용 | 비고 |
|------|--------|---------|------|
| `InitialShield` | `[0, 300, 375, 500, 650, 200, 240]` ★1=300, ★2=375, ★3=500, ★4=650 | ✅ `applyMordekaiserProcCast` line 962-966 `readVarByStar` (sentinel 0 처리) | MordekaiserCarry 활성 시 `mordekaiserCarryShield` 우선 read (PR #124 lint #7 해소) |
| `Duration` | `[4,4,4,4,4,4,4]` (전부 4초) | ✅ `applyMordekaiserProcCast` line 967-969 | base 동작 — `AugmentedDuration` (Concentration augment 활성 시 6초) 는 별도 미반영 |
| `ShieldPerProc` | `[0, 75, 90, 105, 120, 0, 0]` ★1=75, ★2=90, ★3=105, ★4=120 | ✅ `tickMordekaiserProc` line 1020-1022 매 펄스 read | shield × (1+AP/100) 누적 |
| `DamagePerProc` | `[0, 45, 70, 100, 170, 0, 0]` ★1=45, ★2=70, ★3=100, ★4=170 | ✅ `tickMordekaiserProc` line 1017-1019 매 펄스 read | 1칸 내 적 magic damage (per-target amp + sniper + mitigation 표준) |
| `HealRefund` | `[0.4,...]` 전부 40% | ✅ `tickMordekaiserProc` line 1056-1058 만료 시 read | `mordekaiserShieldRemaining × 0.4 × (1+healAmp)` → currentHp |
| `AugmentedDuration` | `[6,6,6,6,6,6,6]` Concentration augment 활성 시 | ❌ **미반영** | `TFT17_Augment_Concentration` augment (집중) 활성 시 Duration 4→6초로 확장. sim 분기 없음 |

### 펄스 카운트 = 4 (`tick <= ProcEndTick` 포함)

`tickMordekaiserProc` line 1016 의 `tick <= ProcEndTick` (≤) 조건으로 t=4 펄스 발동 + 만료 동시 처리. 4 펄스 정확 (`mordekaiser-proc.test.ts` 검증).

### Trait — 암흑의 별(Dark Star) + 전달자 + 선봉대(Vanguard)

- **암흑의 별 (Dark Star)** — `combatLoop.ts:2041` 6 챔프 그룹: Kaisa / Karma / Jhin / Chogath / Lissandra / **Mordekaiser**. Set 17 신규 시너지 — execute / supermassive 메커니즘 (`darkstar-execute-supermassive.test.ts` 27+ apMordekaiser fixture)
- **전달자 (Channeler, `TFT17_ManaTrait`)** — 활성 시 전달자 unit 의 mana gain 곱셈자. `combatLoop.ts:524-529` `InnateManaGain` (raw 0.20) → `unit.channelerInnateManaGain`. 매 tick mana 가산 시 `combatLoop.ts:5549` `channelerMult = 1 + channelerInnateManaGain` 적용 (`augmentManaRegen` 도 곱셈 적용, codex P1 PR #64). Tank stat 보강 아님 — **mana regen 곱셈** (`mana.ts:36-41` helper)
- **선봉대 (Vanguard)** — `applyVanguardEffects` (`combatLoop.ts:4664`) 전투 시작 시 보호막 (tick=0). Tank role 보강

## MordekaiserCarry 변환 시 (참조)

MordekaiserCarry augment 활성 시:
- `applyHeroCarryTransforms` (`combatLoop.ts:2258-2312`): `target.role = 'Fighter'` + `target.selectedCarryAugment = 'TFT17_Augment_MordekaiserCarry'`
- **statOverrides 적용** (`mana 10/40`) — `applyHeroCarryTransforms` 가 item delta 보존하며 적용 (Tear/Blue Buff 등 mana item bonus 위에 누적, PR #124 codex P2 정합)
- **`mordekaiserCarryShield` carry data 저장** (`combatLoop.ts:2306-2311`) — `cfg.abilityData?.shield` (17.3 `[175, 200, 400]`) → `applyMordekaiserProcCast` 가 raw `InitialShield` 대신 우선 read (PR #124 lint #7 해소)
- **helper 자체는 동일 동작** — proc system (cast 진입 + tick 처리 + shield pool + healRefund) 그대로 작동 (base raw 구현이 carry 와 통합)

상세 cast path / 패치 변경 / lint history 는 [[mordekaiser-carry]] 참조.

⚠️ **메모리 cleanup 후보**: `mordekaiserCarryShield` 필드는 `selectedCarryAugment === 'TFT17_Augment_MordekaiserCarry'` + `carryCfg.abilityData?.shield` 로 derive 가능 (불필요한 unit field). PR #144 selected-single-carry 일반화 후속으로 deprecate 검토 가능 — 단 현재 필드는 `null | number[]` 데이터 보유라 단순 boolean flag deprecate (PR #147 xxxCarryActive) 와 다른 work 필요.

## 패치 히스토리 (base raw)

| 패치 | 변경 |
|------|------|
| 17.2~17.3 base | raw stats / InitialShield / Duration / ShieldPerProc / DamagePerProc / HealRefund 별도 변경 검출 없음 (patch wiki 의 Mordekaiser 항목은 모두 MordekaiserCarry 한정) |

## sim 적용 상태 — `active`

✅ **활성** (base raw helper 통합):
- stats 17.3 정합 (hp 950, armor/MR 45, AS 0.6, mana 40/100, range 1)
- ability override `pattern: 'self_buff'` + helper 통합 (applyMordekaiserProcCast + tickMordekaiserProc)
- InitialShield × AP → 별도 shield pool (`mordekaiserShieldRemaining`)
- 4초 동안 매초 펄스 (4 펄스): ShieldPerProc 본인 + DamagePerProc 1칸 적 magic
- 매 펄스 per-target damageAmp + tank amp 3종 (invention/madreds/graves) + sniper + mitigation pipeline 표준
- 만료 시 HealRefund 40% × (1+healAmp) → currentHp 회복
- 사망 시 proc cancel + state cleanup (잔여 shield 무효)
- **cast path parity**: main + OOR 양쪽 `applyMordekaiserProcCast` 호출 ([[ability-targeting]] cast path 3종 룰 일관)
- 별도 shield pool 우선 흡수 (general `unit.shield` 와 분리 — HealRefund 정확 계산)
- 암흑의 별 (Dark Star) 6 챔프 그룹 멤버 (`combatLoop.ts:2041`)
- 선봉대 (Vanguard) `applyVanguardEffects` 보호막 (tick=0)
- 전용 test 2 file 회귀 가드 (`mordekaiser-proc.test.ts` + `darkstar-execute-supermassive.test.ts`)
- MordekaiserCarry 활성 시 `mordekaiserCarryShield` carry data 우선 read (PR #124 lint #7 해소)

❌ **미반영**:
- **`AugmentedDuration` (Concentration augment 활성 시 Duration 4→6초)** — `TFT17_Augment_Concentration` augment 활성 시 펄스 +2회 (6 펄스). sim 분기 없음. ⚠️ `public/data/tft_set17_augments.json:83-102` 에서 해당 augment `"disable": true` (set17 inactive) — 본 미반영의 실제 sim 영향 0, M1 lint 자동 무효 (retro lint pilot 2026-05-26)

🔍 **검증 필요**:
- `mordekaiserCarryShield` 의 cleanup 가능성 — `selectedCarryAugment + carryCfg.abilityData.shield` 로 derive 가능 여부 (PR #147 후속 후보)

## Lint 신규 등록 후보 (champion ingest 발견)

본 페이지 작성 중 **base Mordekaiser** sim 미반영 1건 검출:

| # | 항목 | 의미 | 상태 |
|---|------|------|------|
| M1 | `AugmentedDuration` 6초 (Concentration augment 활성 시) | 펄스 +2회 = ShieldPerProc + DamagePerProc 50% 추가 손실 | ✅ 자동 무효 — Concentration augment `disable: true` set17 inactive (retro lint pilot 2026-05-26 verify) |

**Jax L1~L5 + Nasus N1~N4 + Mordekaiser M1 (자동 무효) = base champion 미반영 lint 9건 활성 + 1건 무효** — Mordekaiser 는 가장 정합 (검출 1건도 augment inactive 로 자동 무효) → helper 통합 sim 의 효율성 입증.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `public/data/tft_set17_champions.json` `TFT17_Mordekaiser` apiName grep 확인 (한글 매칭 금지)
- [x] entity-wide grep `Mordekaiser` + `mordekaiser` — sim 23+ site + test 2 file 전수 식별 (helper 2개 + state 3 field + shield pool + carry data field + dark star group + per-tick 호출)
- [x] raw stats 17.3 정합
- [x] **raw role `APTank` → mapGameRole → sim Tank** ([[jax]] / [[nasus]] 와 동일 매핑 — 3번째 base APTank champion)
- [x] MordekaiserCarry 변환 시 role overwrite `Fighter` + `mordekaiserCarryShield` carry data 저장 (lint #7 해소)
- [x] **cast path 3종** — main (`combatLoop.ts:7037`) + OOR (`:7185`) 양쪽 `applyMordekaiserProcCast` 호출 parity verify. recast 무관 (self_buff 패턴 + onKillRecast 없음)
- [x] 별도 shield pool (`mordekaiserShieldRemaining`) general unit.shield 와 분리 — HealRefund 정확 계산 verify
- [x] 사망 시 proc cleanup verify (`tickMordekaiserProc` line 1004-1009)
- [x] **전달자 (Channeler, `TFT17_ManaTrait`) trait 효과 verify** — `combatLoop.ts:524-529` + `:5549` + `mana.ts:36-41` mana gain 곱셈자 (`InnateManaGain=0.20` raw) integration 완료. Tank stat 보강 아님 (retro lint pilot 2026-05-26 catch)
- [x] **Concentration augment `disable: true` verify** — `tft_set17_augments.json:83-102` `"disable": true` set17 inactive. M1 lint 자동 무효
- [ ] (선택) `mordekaiserCarryShield` cleanup 가능성 평가 (selectedCarryAugment + carryCfg derive)
- [ ] (선택) Lint M1 정식 등록 보류 — Concentration disable 으로 자동 무효, 추후 augment 재활성 시만 의미

## 관련

- [[role-passive]] — Tank role 마나/타게팅 규칙 (base raw 적용)
- [[ability-targeting]] — `self_buff` 패턴 + cast path 3종
- [[hero-augment-carry]] — MordekaiserCarry 변환 시 role/stat/ability override 시스템
- [[mordekaiser-carry]] — MordekaiserCarry augment 페이지 (Heat Death + lint #7 history)
- [[jax]] / [[nasus]] — 동일 raw `APTank` → Tank 매핑 + augment 시 Fighter overwrite 패턴 (3 챔프 누적)
- [[shen]] — 다른 raw role 변형 사례 (APFighter → Fighter, augment 무관)
- 코드: `src/lib/simulator/systems/ability.ts:210`, `src/lib/simulator/engine/combatLoop.ts:953/990/1213/2306/5533/7037/7185`
- 테스트: `tests/unit/mordekaiser-proc.test.ts` (전용) / `tests/unit/simulator/darkstar-execute-supermassive.test.ts:27+`
