---
id: nasus
type: champion
display_name_kr: 나서스
api_name: TFT17_Nasus
cost: 1
traits:
  - 우주 그루브
  - 선봉대
role: Tank   # raw "APTank" → mapGameRole() → sim Tank. ⚠️ NasusCarry augment 활성 시 Fighter 로 변환 (applyHeroCarryTransforms)
raw_role: APTank
current_patch_status: active
sim_active: partial
last_verified: 2026-05-21
sources:
  - "public/data/tft_set17_champions.json (TFT17_Nasus entry)"
  - "src/types/index.ts:39 (mapGameRole: 'Tank' substring 매칭 우선)"
  - "src/types/index.ts:846-852 (nasusBonkStack field — Lint #12 해소)"
  - "src/lib/simulator/systems/ability.ts:189 (abilityOverride aoe_circle r=1 + selfBuff durability 0.2 for 6s + dot 6s)"
  - "src/lib/simulator/engine/combatLoop.ts:308/3650/3859 (nasusBonkStack 초기화 3 site)"
  - "src/lib/simulator/engine/combatLoop.ts:1357-1369 (applyCarryDamageModifiers #6 bonusPerKill — NasusCarry 한정, selectedCarryAugment 가드)"
  - "src/lib/simulator/engine/combatLoop.ts:2258-2296 (applyHeroCarryTransforms — NasusCarry 활성 시 role=Fighter + selectedCarryAugment set)"
  - "src/lib/simulator/engine/combatLoop.ts:6592-6602 (cast loop markTargetDead 직후 nasusBonkStack++ 누적)"
  - "tests/unit/simulator/hero-carry-augments.test.ts:151+ (nasusBonkStack 초기값 + cast kill 누적 회귀 가드)"
  - "tests/unit/simulator/vanguard-trait.test.ts:21 (apNasus 선봉대 시너지 fixture)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[hero-augment-carry]]"
  - "[[nasus-carry]]"
  - "[[shen]]"
  - "[[jax]]"
---

# 나서스 (Nasus)

## 요약

1코스트 **Tank** (raw `APTank` → `mapGameRole()` → sim Tank, [[role-passive]]), 우주 그루브(Space Groove) + 선봉대(Vanguard) 시너지. raw 어빌리티 "두둠칫 수잔" — 6초 변신 + 최대 체력 추가 + Space Groove 상태 + 인접 매초 magic DOT.

[[nasus-carry]] (꽁! / Bonk!) augment 활성 시 가장 강한 Nasus 1명이 **Fighter 로 변환** + abilityOverride `single` 패턴 (AD physical) + **cast kill 누적 `nasusBonkStack` × `bonusPerKill[★]` 영구 가산** (PR #135 Lint #12 ✅). 본 페이지는 **base raw Nasus** 의 sim 동작을 다루며, carry 변환 사항은 [[nasus-carry]] 참조.

> ⚠️ Role 주의 — base vs carry: raw role `APTank` → sim **Tank** (weight 3, 공격당 마나 5, 피격 시 마나 ✅). **NasusCarry augment 활성 시** `applyHeroCarryTransforms` (`combatLoop.ts:2265`) 가 `target.role = 'Fighter'` 로 덮어씀 → Fighter 룰 (weight 2, 공격당 마나 10, 피격 시 마나 ❌). [[jax]] 와 동일 패턴 (augment 가 role 자체 변경) — Shen 의 단순 mapping 패턴과 다름.

## 메커니즘 (base raw, carry 미활성)

### Stats (raw, 17.3 LIVE)

| Stat | 값 |
|------|---|
| hp | 700 |
| armor / magicResist | 45 / 45 |
| damage | 40 |
| attackSpeed | 0.65 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 60 / 120 |

### Active — 두둠칫 수잔 (Doom Doom Susan)

raw 명세 (`public/data/tft_set17_champions.json` desc): "`@Duration@`초 동안 변신하여 일시적으로 최대 체력을 `@MaxHealth@` 얻고 `{{TFT17_SpaceGroove_TheGroove}}` 상태가 되며 인접한 적에게 매초 `@ModifiedDamage@(scaleHealth scaleAP)`의 마법 피해를 입힙니다."

→ **3단계 효과**: (1) `Duration` 초 변신 (지속), (2) 일시적 maxHp 보강 (`MaxHealth` 추가 + 변신 종료 시 환원 추정), (3) 변신 중 인접 적에 매초 magic DOT (체력 + AP scaling), (4) Space Groove `TheGroove` trait 상태 활성.

**sim 적용** (`ability.ts:189`):
```ts
TFT17_Nasus: { pattern: 'aoe_circle', radius: 1, selfBuff: { durability: 0.2, duration: 6 }, dot: { duration: 6 } }
```

→ cast 시점: aoe_circle r=1 + dot for 6s + selfBuff durability 0.2 (20%) for 6s. **maxHp 추가 미모델링** + **Space Groove 상태 미모델링**.

### raw ability variables (★1~★5 — 첫 값 sentinel filler)

| 변수 | raw 값 | sim 적용 | 비고 |
|------|--------|---------|------|
| `Duration` | `[6,6,6,6,6,6,6]` (전부 6초) | ✅ selfBuff.duration 6 + dot.duration 6 (정합) | — |
| `MaxHealth` | `[400, 250, 350, 550, 750, 700, 700]` ★1=250, ★2=350, ★3=550, ★4=750 (index 0 sentinel 400) | ❌ **미반영** | 변신 중 임시 maxHp +N 효과 sim 없음. 탱킹 역량 ★별 차이 큼 (★3 +550 maxHp 무효) |
| `DamageAP` | `[18, 30, 45, 70, 120, 48, 48]` ★1=30, ★2=45, ★3=70, ★4=120 (index 0 sentinel 18) | 🔍 **미verify** | sim aoe_circle + dot 의 damage source 가 어떤 var read 하는지 추가 verify 필요 (`damageVar` 미지정 → `'Damage'` fallback? raw 에 `Damage` 변수 없음) |
| `DamageHealth` | `[0.02,...]` 전부 2% maxHp | ❌ **미반영** | raw desc `(scaleHealth scaleAP)` — caster maxHp × 0.02 추가 magic. sim DOT 의 hp scaling 적용 없음 |
| (없음) `TheGroove` state | (string ref `TFT17_SpaceGroove_TheGroove`) | ❌ **미반영** | 우주 그루브 시너지 strut 상태 — sim 별도 분기 없음 |

### Trait — 우주 그루브(Space Groove) + 선봉대(Vanguard)

- **우주 그루브**: Set 17 신규 시너지 — strut(춤) 메커니즘. `TheGroove` 상태 활성 시 별도 효과. Nasus 1코 그룹 중 우주 그루브 포함 (다른 1코: 그웬 등). sim 시너지 분기 별도 verify 필요
- **선봉대 (Vanguard)**: Tank 시너지 — `applyVanguardEffects` (`combatLoop.ts:4664`) 가 전투 시작 시 보호막 부여 (tick=0). Tank role 보강. `vanguard-trait.test.ts` apNasus fixture 사용

## NasusCarry 변환 시 (참조)

NasusCarry augment 활성 시:
- `applyHeroCarryTransforms` (`combatLoop.ts:2258-2296`): `target.role = 'Fighter'` + `target.selectedCarryAugment = 'TFT17_Augment_NasusCarry'`
- `getAbilityConfigForUnit` 가 base ability override 대신 NasusCarry abilityOverride (`single` 패턴 + damageTypeOverride `physical`) 적용
- abilityData damage `[280, 420, 670]` AD physical cast
- **`bonusPerKill[★]` cast kill 누적** (`applyCarryDamageModifiers` modifier #6, `combatLoop.ts:1357-1369`) — `unit.nasusBonkStack > 0` + `selectedCarryAugment === 'TFT17_Augment_NasusCarry'` 가드. raw 가산 `baseDmg += stack × bonusPerKill[starLevel-1]`
- **Stack 누적 위치**: cast loop `markTargetDead` 직후 (`combatLoop.ts:6600-6602`) — desc "이 스킬로 적을 처치하면" 의도라 **basic attack kill 제외** (cast site only). single 패턴 → main pipeline only (OOR/recast 진입 불가)
- **선택 가드** (PR #135 Layer 1 패턴): `selectedCarryAugment` 단일 — 다중 Nasus 카피 시 가장 강한 1명만 stack 누적. 비-selected 카피는 raw fallback ([[hero-augment-carry]] selected single-carry semantics, PR #144 일반화)

상세 cast path / 패치 변경 / 잔존 lint (#5 Resists 40→45 인게임 측정 대기) 는 [[nasus-carry]] 참조.

## 패치 히스토리 (base raw)

| 패치 | 변경 |
|------|------|
| 17.2~17.3 base | raw stats / ability variables 별도 변경 검출 없음 (patch wiki 에 Nasus base 항목 부재 — augment 한정 변경) |

⚠️ **Lint #5 (잔존)** — `Bonk! Resists: 40 → 45` 17.3 패치노트. **augment grant 인지 champion baseline 변경인지 모호** (carryAugments.ts:119-120 TODO). 인게임 측정 후 statOverrides 또는 base stats 결정 — 사용자 측정 대기.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.3 정합 (hp 700, armor/MR 45, AS 0.65, mana 60/120, range 1, dmg 40)
- ability pattern `aoe_circle r=1` + `dot 6s` + `selfBuff durability 0.2 for 6s`
- carry 미활성 시 raw role `APTank` → mapGameRole → **Tank** 자동 분기 (mana on-hit 수령 / weight 3 / damage reduction ×1.0)
- 선봉대 (Vanguard) `applyVanguardEffects` 보호막 (tick=0)
- NasusCarry 변환 시 role `Fighter` + selectedCarryAugment set (`applyHeroCarryTransforms`) + `nasusBonkStack` 3 site 초기화

❌ **미반영** (base raw):
- **`MaxHealth` 임시 buff** — 변신 중 +250/350/550/750 maxHp 추가 (raw desc "일시적으로 최대 체력을 얻고") sim 없음
- **`DamageHealth` (caster hp scaling)** — DOT damage 의 maxHp 2% scaling 미반영
- **Space Groove `TheGroove` 상태** — 변신 시 활성화되는 시너지 strut state 미반영
- 잠재적 6초 변신 후 stats 환원 메커니즘 — sim selfBuff 만료 후 처리 정합 verify 필요

🔍 **검증 필요**:
- `DamageAP` (★별 30/45/70/120) 가 sim DOT 의 damage 로 적용되는지 — `dot.duration 6` 의 perTick damage 가 어떤 var read 하는지 (default `'Damage'` var 없음 → fallback 동작?)
- 우주 그루브 (Space Groove) 시너지 sim 분기 — `TheGroove` 상태 trigger / 효과 / Nasus 외 메커니즘 통합 verify 필요
- Lint #5 — Bonk! Resists 40→45 17.3 패치노트의 base vs augment grant 구분 (인게임 측정 후 결정)

## Lint 신규 등록 후보 (champion ingest 발견)

본 페이지 작성 중 **base Nasus (carry 미활성)** sim 미반영 4건 검출:

| # | 항목 | 의미 |
|---|------|------|
| N1 | `MaxHealth` 변신 시 임시 maxHp +N 부여 | 탱킹 역량 ★별 핵심 차이 미반영 (★3 +550 hp 무효) |
| N2 | `DamageHealth` (DOT scaleHealth 2%) | DOT 의 maxHp 2% magic 추가 미반영 |
| N3 | Space Groove `TheGroove` 상태 | 변신 시 활성화되는 시너지 strut state 미모델링 |
| N4 | `DamageAP` ★별 sim read 위치 (★1=30 ★4=120 차이 4x) | DOT damage 가 어떤 var read 하는지 verify 필요 |

⚠️ **우선순위 평가**: Nasus 는 carry augment 활성 시점 ([[nasus-carry]]) 이 주된 사용 컨텍스트. base raw 사용 빈도가 낮으면 위 lint 4건은 후순위. 단 carry 미활성 시 sim 결과 신뢰도 낮음 (특히 MaxHealth ★별 차이).

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `public/data/tft_set17_champions.json` `TFT17_Nasus` apiName grep 확인 (한글 이름 매칭 금지 — codex PR #149 P2 sub-rule)
- [x] entity-wide grep `Nasus` + `nasus` — sim 4 site (ability override + applyCarryDamageModifiers #6 + cast loop markTargetDead 직후 + nasusBonkStack field) + test 2 file
- [x] raw stats 17.3 정합 (`public/data/tft_set17_champions.json` 확인)
- [x] **raw role `APTank` → mapGameRole → sim Tank** ([[jax]] 와 동일 매핑)
- [x] NasusCarry 변환 시 role overwrite `Fighter` (`combatLoop.ts:2265`) + selectedCarryAugment set
- [x] cast path 3종 — NasusCarry single 패턴 → main pipeline only (OOR/recast 진입 불가, `combatLoop.ts:6594` comment 확인)
- [x] PR #135 Layer 1 selected single-carry 가드 (`combatLoop.ts:1365` + `:6600`) — 다중 Nasus 카피 회귀 방지
- [ ] (사용자 verify) DamageAP DOT read site 추적
- [ ] (사용자 verify) Space Groove `TheGroove` 상태 시너지 sim 통합 여부
- [ ] (사용자 verify) Lint #5 Bonk! Resists 40→45 base vs augment grant 구분 — 인게임 측정 후 결정
- [ ] (선택) Lint N1~N4 정식 등록 (#17+) — Jax L1~L5 와 우선순위 묶음 평가

## 관련

- [[role-passive]] — Tank role 마나/타게팅 규칙 (base raw 적용)
- [[ability-targeting]] — `aoe_circle` + `dot` 패턴
- [[hero-augment-carry]] — NasusCarry 변환 시 role/stat/ability override 시스템 + selected single-carry semantics
- [[nasus-carry]] — NasusCarry augment 페이지 (single 패턴 + bonusPerKill stack)
- [[jax]] — 동일 raw `APTank` → Tank 매핑 + augment 시 Fighter overwrite 패턴
- [[shen]] — 다른 raw role 변형 사례 (APFighter → Fighter, augment 무관)
- 코드: `src/lib/simulator/systems/ability.ts:189`, `src/lib/simulator/engine/combatLoop.ts:1357/2258/6592`
- 테스트: `tests/unit/simulator/hero-carry-augments.test.ts:151+` / `tests/unit/simulator/vanguard-trait.test.ts:21`
