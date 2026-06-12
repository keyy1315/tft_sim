---
id: masteryi
type: champion
display_name_kr: 마스터 이
api_name: TFT17_MasterYi
cost: 4
traits:
  - 초능력
  - 습격자
role: Fighter   # raw "ADFighter" → mapGameRole() → sim Fighter (types/index.ts includes('Fighter')). carry augment 없음
raw_role: ADFighter
current_patch_status: active
sim_active: partial   # passive(onAttack every:3 연속 베기 PassiveDamage scaleAD) + active selfBuff AS + 초능력(PsyOps)/습격자(MeleeTrait) trait 정합. ⚠️ P1: active 초필살 잔상 주기 데미지(초당 2번 무작위 적 Damage scaleAD scaleAP physical) 미반영 — self_buff 패턴은 buff 만, 주기 데미지 분기 없음 (초필살 주력 active DPS 누락) / P2: active Omnivamp(10%) 미반영 — selfBuff config 에 omnivamp 필드 없음 / P2: selfBuff AS 0.8 vs raw AttackSpeed 0.7 (sim 0.1 높음) / P2: selfBuff duration 5 미반영 (read 0 → AS 영구 over-model)
last_verified: 2026-06-12
sources:
  - "public/data/tft_set17_champions.json (TFT17_MasterYi entry — cost 4, role ADFighter, traits [초능력/습격자], mana 30/70, ability '일격 초필살' variables PassiveDamage/DamageAD/DamageAP/Omnivamp/AttackSpeed/Duration)"
  - "public/data/tft_set17_traits.json (TFT17_PsyOps = 초능력 / TFT17_MeleeTrait = 습격자)"
  - "src/types/index.ts (mapGameRole — 'ADFighter' includes 'Fighter' → Fighter)"
  - "src/lib/simulator/systems/ability.ts:242 (TFT17_MasterYi: { pattern: 'self_buff', selfBuff: { attackSpeed: 0.8, duration: 5 } } — 초필살 AS 버프, 흡혈/잔상 미포함)"
  - "src/lib/simulator/engine/combatLoop.ts:7176-7210 (selfBuff block — attackSpeed/ad/ap/durability 만, omnivamp/duration revert 없음)"
  - "public/data/tft_set17_scaling.json (TFT17_MasterYi — trigger onAttack every 3, extraDamage physical ad, passiveDamage [60,60,90,550])"
  - "src/lib/simulator/engine/combatLoop.ts:2280 (isPsyOpsTier4Active 초능력) + :528/:593 (습격자 MeleeTrait 흡혈→보호막)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[teemo]]"
  - "[[gnar]]"
  - "[[samira]]"
---

# 마스터 이 (Master Yi)

## 요약

4코스트 **초능력 (`TFT17_PsyOps`)** + **습격자 (`TFT17_MeleeTrait`)** trait. raw role `ADFighter`.

- **role**: `mapGameRole('ADFighter')` → sim **Fighter** ([[role-passive]]). carry augment 없음. mana 30/70.
- **ability "일격 초필살"**: (passive) 기본 공격 3회마다 연속 베기 `PassiveDamage`(scaleAD) 추가 물리. (active) 명상 후 `Duration`(5)초 초필살 — `Omnivamp`(10%) 흡혈 + `AttackSpeed`(70%) + 이동속도, **초당 2번 무작위 주변 적 1명에게 잔상 `Damage`(scaleAD scaleAP) 물리**.

> 🎯 **Master Yi 는 초필살 흡혈 brawler carry** — 단 **active 가 AS 버프만 sim 반영**, 흡혈(10%) + 잔상 주기 데미지(초당 2번)는 미반영 (self_buff 패턴 한계). passive 베기(every:3)는 반영. [[teemo]]/[[gnar]] 처럼 active 주력 일부 누락 패턴.

> ⚠️ **set17 entity confirm**: `TFT17_MasterYi` apiName 으로 소속 확인 (cost 4, traits 초능력/습격자, role ADFighter). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 1100 |
| armor / magicResist | 65 / 65 |
| damage | 60 |
| attackSpeed | 0.85 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 30 / 70 |

### Role — Fighter

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Fighter** | 2 | 10 | 0 | ❌ | `mapGameRole('ADFighter')` includes 'Fighter' ([[role-passive]] Fighter 마나 규칙) |

### Passive — 연속 베기 (`scaling.json` onAttack every:3)

raw desc: "기본 공격 **3회마다** 연속으로 베어 날려 `@ModifiedPassiveDamage@`(scaleAD) 추가 물리 피해."

raw variables: `PassiveDamage` [60,70,105,550,...]

scaling.json: `trigger: onAttack`, `every: 3`, `effect: extraDamage/physical/ad`, `passiveDamage [60,60,90,550]`

**sim 적용** ✅ (onAttack 핸들러 `:6275`, `attackCount % 3 === 0`):

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 평타 3회마다 추가 물리 (`PassiveDamage`, scaleAD) | ✅ | `:6280` `dmgArr = passiveDamage`, `starValue(arr[starLevel])` → scaling.json `[60,60,90,550]` → ★1=60 / ★2=90 / ★3=550. magic 아닌 physical (`damageType: physical`) |

> ⚠️ scaling.json `passiveDamage [60,60,90,550]` 는 raw `PassiveDamage [60,70,105,550]` 와 **★1 (60 vs 70) / ★2 (90 vs 105) 차이, ★3=550 일치** — sim 은 scaling.json 사용 (`starValue` arr[starLevel] → ★1=60/★2=90/★3=550). 큰 ★3 값은 placeholder 컨벤션.

### Active — 초필살 (`ability.ts:242`)

raw desc: "사용 시: 명상 후 `@Duration@`(5)초 초필살 — 모든 흡혈 `@Omnivamp*100@`%(10%), 공격 속도 `@AttackSpeed*100@`%(70%), 이동속도 상승. **초당 두 번, 무작위 주변 적 1명에게 잔상 `@ModifiedDamage@`(scaleAD scaleAP) 물리.**"

raw variables: `Omnivamp` [0.1] / `AttackSpeed` [0.7] / `Duration` [5] / `DamageAD` [60,50,75,...] / `DamageAP` [30,20,30,...]

**sim 적용** (`ability.ts:242`):
```ts
TFT17_MasterYi: { pattern: 'self_buff', selfBuff: { attackSpeed: 0.8, duration: 5 } }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| AS 버프 | ⚠️ **값 불일치** | sim `selfBuff.attackSpeed: 0.8` (`:7176` `*= 1.8`) vs raw `AttackSpeed` 0.7 (+70%) → sim 0.1 높음. **Lint P2** |
| 5초 지속 (`Duration`) | ❌ **미반영** | `selfBuff.duration` read site 0 → AS 영구 `*= 1.8` (revert 없음, over-model). **Lint P2** |
| 흡혈 (`Omnivamp` 10%) | ❌ **미반영** | selfBuff config 에 `omnivamp` 필드 없음 (`:7176-7210` block 은 attackSpeed/ad/ap/durability 만). 초필살 흡혈 미적용. **Lint P2** |
| **초당 2번 잔상 주기 데미지 (`Damage` scaleAD scaleAP)** | ❌ **미반영** | self_buff 패턴은 buff 만 — 주기 데미지 분기 없음. `DamageAD`/`DamageAP` (잔상 물리) 미참조. **초필살 주력 active DPS 누락. Lint P1**. raw `<physicalDamage>` → DamageAP 도 **물리** (magic 아님) |

> ⚠️ active 가 **AS 버프(0.8)만** 반영하고 **흡혈(10%) + 잔상 주기 데미지(초당 2번)는 미반영**. 초필살의 핵심(지속 흡혈 + 잔상 폭딜)이 빠져 brawler carry DPS/생존 과소.

### 초능력 (`TFT17_PsyOps`) / 습격자 (`TFT17_MeleeTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 초능력 (PsyOps) | ✅ | `isPsyOpsTier4Active` (`combatLoop.ts:2280`) + PsyOps 아이템 (`TFT17_Item_PsyOps_*Mod`). tier4 시너지 분기 |
| 습격자 (Melee / `TFT17_MeleeTrait`) | ✅ | 흡혈→보호막 변환 helper (`:479/:528/:593`) — `MaxPercentHealthShield` + `ShieldAD`, 흡혈 + AD. Master Yi 습격자 멤버 |

> 룰 #16/#19: 두 trait 모두 generic 경로 존재 — champion-specific 구현 불필요하나 generic 경로 grep 은 매 champion 재검증.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Master Yi 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active self_buff (AS 버프) | `ability.ts:242`, `combatLoop.ts:7176` (selfBuff) |
| **OOR (out-of-range)** | ⚠️ self_buff caster self-target — OOR cast 시 omnivamp heal 누락 방지 가드 (`:7567`, MasterYi/Jax/Warwick) | `:7567` (단 active 추가 omnivamp 자체는 미적용) |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **passive 베기** (onAttack every:3) + **잔상 주기 데미지(미반영)** 은 cast pipeline 과 별개. 초능력/습격자 trait 도 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1100, armor/MR 65, AD 60, AS 0.85, range 1, mana 30/70)
- role Fighter (`mapGameRole('ADFighter')`)
- **passive 연속 베기** (onAttack every:3, PassiveDamage scaleAD) ✅
- active self_buff AS 버프 (단 값 0.8 ≠ raw 0.7, 영구)
- **초능력 (PsyOps)** tier4 + **습격자 (MeleeTrait)** 흡혈→보호막

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: active 초필살 잔상 주기 데미지 (초당 2번 무작위 적 `Damage` scaleAD scaleAP **물리**) 미반영 — self_buff 패턴 buff 만
- **P2**: active `Omnivamp`(10%) 미반영 — selfBuff config 에 omnivamp 필드 없음
- **P2**: selfBuff AS 0.8 vs raw `AttackSpeed` 0.7 (sim 0.1 높음)
- **P2**: selfBuff `Duration`(5초) 미반영 — read 0 → AS 영구 (over-model)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | active 잔상 주기 데미지 미반영 | active 핵심 = 초필살 `Duration`(5)초 동안 **초당 2번** 무작위 주변 적에 `Damage`(scaleAD scaleAP 물리). self_buff 패턴은 buff 만 → 주기 데미지 분기 없음 | **P1** | periodic-per-tick — 초필살 buff 활성 동안 N틱마다(초당 2회) **random 단수 인접 적** 1명에 단발 physical Damage (scaleAD+scaleAP). ⚠️ **per-target loop `(b)` 아님** — 무작위 1명 (loop 적용 시 모든 인접 적 over-damage 회귀). DamageAP 도 **물리** (raw `<physicalDamage>`, magic 처리 시 MR 경감 오류) | 초필살 주력 DPS 누락 → brawler carry under-damage. sim fix 후보 |
| P2 | active Omnivamp 10% 미반영 | 초필살 중 모든 피해 흡혈 +10%. selfBuff config 에 omnivamp 필드 없음 (block 은 attackSpeed/ad/ap/durability 만) | **P2** | (c) cast-time — selfBuff 에 omnivamp 필드 추가 + cast 시 `unit.omnivamp += 0.1` (duration 만료 시 복원) | 초필살 생존(흡혈) 누락 |
| P2 | selfBuff AS 0.8 vs raw 0.7 | `selfBuff.attackSpeed: 0.8` vs raw `AttackSpeed` 0.7 | **P2** | cast config — 0.8 → 0.7 (raw `AttackSpeed`) | AS 버프 0.1 과다 |
| P2 | selfBuff duration 5 미반영 | `Duration` 5초 — `selfBuff.duration` read 0 → AS 영구 `*= 1.8` | **P2** | (c) cast-time + 만료 tick — duration 후 AS 복원 | AS 버프 영구화 (over-model). [[teemo]] 동형 |

> 📌 **passive 베기(PassiveDamage onAttack every:3) + active AS 버프 + 초능력/습격자 trait 는 sim 반영**. `partial` 사유는 **active 잔상 주기 데미지 미반영 P1** (초필살 주력) + 흡혈/AS값/duration P2. active 의 핵심 폭딜·생존이 빠져 brawler carry under-model.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_MasterYi` apiName 확인 (cost 4, traits [초능력/습격자], role ADFighter)
- [x] entity-wide grep `MasterYi` + `omnivamp`/`PsyOps`/`MeleeTrait` — sim site (passive onAttack every:3 / active self_buff / 잔상 미반영 / 초능력·습격자)
- [x] raw stats 17.4 정합 (hp 1100 / armor·MR 65 / AD 60 / AS 0.85 / range 1 / mana 30·70)
- [x] **raw role `ADFighter` → mapGameRole → Fighter** — `includes('Fighter')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — active config (`ability.ts:242` self_buff AS 0.8/duration 5, 흡혈/잔상 미포함) + selfBuff block (`:7176-7210` attackSpeed/ad/ap/durability 만, omnivamp/duration revert 없음) + onAttack 핸들러 (`:6275` every:3)
- [x] **변수 filler 판정** — PassiveDamage 는 scaling.json `[60,60,90,550]` starValue(arr[starLevel]) ★1=60/★2=90/★3=550 (raw [60,70,105,550] → ★1 70/★2 105 차이, ★3 550 일치) / DamageAD `[60,50,75,600]` v0>v1 filler ★1=50/★3=600 / DamageAP `[30,20,30,200]` v0>v1 filler ★1=20/★3=200 (단 잔상 미모델) / Omnivamp·AttackSpeed·Duration 상수
- [x] **actual sim integration verify (5단계)** — passive onAttack every:3 PassiveDamage read 확인 (`:6280`) / **active self_buff 는 AS 만 → `Omnivamp`(omnivamp 필드 부재)·`DamageAD/DamageAP`(잔상 주기 데미지) 미반영 P1/P2** / **`selfBuff.duration` read 0 → AS 영구 P2** / 잔상 `<physicalDamage>` = AP 스케일도 물리 (모델 시 magic 아님, Gnar #223 학습)
- [x] **cast path 3종 (PR #129 룰)** — main (active self_buff ✅) / OOR (self-target, omnivamp heal 가드 `:7567` ⚠️) / recast (carry 없음 ➖). passive·trait 별개
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 초능력 `TFT17_PsyOps` `isPsyOpsTier4Active` (`:2280`) ✅ / 습격자 `TFT17_MeleeTrait` 흡혈→보호막 helper (`:479/:528/:593`) ✅. "verify 면제" 어휘 미사용
- [x] **본문 Lint P1 1건(잔상 주기 데미지) + P2 3건 등록 → active 주력 미반영 → 보수적 `sim_active: partial` 유지** (P0 회귀 case 없음 → 룰 #15 미해당)
- [ ] (선택) 잔상 주기 데미지 sim fix (P1) / Omnivamp / AS 0.7 / duration (P2)

## 관련

- [[role-passive]] — Fighter role 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `self_buff` (caster self-target). cast path main, OOR omnivamp 가드
- [[teemo]] — 동일 self_buff AS duration 미반영(영구) 패턴
- [[gnar]] — 잔상 `<physicalDamage>` AP 스케일 물리 (DamageAP physical) 동형 학습
- [[samira]] — 동일 active 주력 데미지 미반영(트리거/패턴 한계) 패턴
- under-damage calibration (메모리 `project_underdamage_calibration`) — Master Yi 초필살 잔상+흡혈 미반영 = brawler carry under-damage 사례
- 코드: `src/lib/simulator/systems/ability.ts:242`, `src/lib/simulator/engine/combatLoop.ts:7176/6275/2280/528`
- Raw: `public/data/tft_set17_champions.json` (TFT17_MasterYi), `public/data/tft_set17_traits.json` (TFT17_PsyOps / TFT17_MeleeTrait)
