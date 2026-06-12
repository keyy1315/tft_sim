---
id: samira
type: champion
display_name_kr: 사미라
api_name: TFT17_Samira
cost: 3
traits:
  - 우주 그루브
  - 저격수
role: Caster   # raw "ADCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: ADCaster
current_patch_status: active
sim_active: partial   # active 단일 탄환(Damage scaleAD physical) + stun(공중 띄움) + 우주그루브(SpaceGroove)/저격수(Sniper) trait 정합. P1: passive(onEnemyAirborne 시 PassiveDamage scaleAD scaleAP physical + GrooveDuration TheGroove) 미반영 — onEnemyAirborne 트리거 핸들러 부재(grep 0, onAttack/onKill 만 존재) / P2: active stun 1.0 vs raw StunDuration 1.25 (sim 0.25s 적음) / P2: TheGroove 상태(passive 발동 시 3초) 미반영 (passive 자체 미모델) / P2: passive PassiveAP(scaleAP) — passive 미모델로 무의미
last_verified: 2026-06-12
sources:
  - "public/data/tft_set17_champions.json (TFT17_Samira entry — cost 3, role ADCaster, traits [우주 그루브/저격수], mana 0/60, ability '도약 난무' variables PassiveAD/PassiveAP/GrooveDuration/Damage/StunDuration)"
  - "public/data/tft_set17_traits.json (TFT17_SpaceGroove = 우주 그루브 / TFT17_RangedTrait = 저격수)"
  - "src/types/index.ts (mapGameRole — 'ADCaster' includes 'Caster' → Caster)"
  - "src/lib/simulator/systems/ability.ts:229 (TFT17_Samira: { pattern: 'single', stun: 1.0 } — 단일 탄환 + 공중 띄움(stun))"
  - "src/lib/simulator/engine/combatLoop.ts:7125-7127 (config.stun 적용 — carry abilityData.stunDuration 없으면 fixed 1.0)"
  - "public/data/tft_set17_scaling.json (TFT17_Samira — trigger onEnemyAirborne, extraDamage physical, passiveDamageAD [60,55,80,130], passiveDamageAP [20,10,15,25], grooveDuration 3 — onEnemyAirborne 핸들러 부재로 미발동)"
  - "src/lib/simulator/engine/combatLoop.ts:1791 (applySpaceGrooveBuffs 우주 그루브) + :1949 (applySniperEffects 저격수)"
  - "src/lib/simulator/engine/combatLoop.ts:6275/6302 (scaling 핸들러 — onAttack/onKill 만, onEnemyAirborne 분기 없음)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[teemo]]"
  - "[[gnar]]"
  - "[[reksai]]"
---

# 사미라 (Samira)

## 요약

3코스트 **우주 그루브 (`TFT17_SpaceGroove`)** + **저격수 (`TFT17_RangedTrait`)** trait. raw role `ADCaster`.

- **role**: `mapGameRole('ADCaster')` → sim **Caster** ([[role-passive]]). carry augment 없음. mana 0/60.
- **ability "도약 난무"**: (active) 대상에 탄환 `Damage`(scaleAD) 물리 + `StunDuration`(1.25)초 **공중 띄움**. (passive) **적이 공중에 뜰 때마다** `PassiveDamage`(scaleAD scaleAP) 물리 + `GrooveDuration`(3)초 그루브 상태.

> 🎯 **Samira 는 공중 띄움 + airborne 연계 caster** — 단 **passive(onEnemyAirborne) 가 sim 미반영** (트리거 핸들러 부재). active 탄환+stun 만 동작. [[teemo]] 독 DOT / [[gnar]] 부메랑처럼 **트리거 미연결 passive** 누락 패턴, [[reksai]] 와 동일 "공중 띄움(stun)" 모델.

> ⚠️ **set17 entity confirm**: `TFT17_Samira` apiName 으로 소속 확인 (cost 3, traits 우주 그루브/저격수, role ADCaster). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 650 |
| armor / magicResist | 25 / 25 |
| damage | 50 |
| attackSpeed | 0.75 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 60 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('ADCaster')` includes 'Caster' ([[role-passive]] Caster 마나 규칙) |

### Active — 도약 난무 탄환 + 공중 띄움 (`ability.ts:229`)

raw desc: "사용 시: 대상에게 탄환을 퍼부어 `@ModifiedDamage@`(scaleAD) 물리 피해 + `@StunDuration@`(1.25)초 동안 공중으로 띄워 올림."

raw variables: `Damage` [260,375,560,...] / `StunDuration` [1.25]

**sim 적용** (`ability.ts:229`):
```ts
TFT17_Samira: { pattern: 'single', stun: 1.0 }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 단일 대상 탄환 | ✅ `pattern: 'single'` | 현재 타겟 단일 타격 |
| 탄환 피해 (`Damage`, scaleAD) | ✅ | `damageVar` 미지정 → `getAbilityDamage` default `Damage` (no-filler ★1=260 / ★2=375 / ★3=560) scaleAD |
| 공중 띄움 (`StunDuration` 1.25초) | ⚠️ **값 불일치** | sim `stun: 1.0` (`:7125` config.stun fixed) vs raw `StunDuration` 1.25 → **sim 0.25s 적음**. **Lint P2** |

### Passive — 공중 띄움 시 추가 물리 + 그루브 (`scaling.json` onEnemyAirborne)

raw desc: "기본 지속 효과: 적이 **공중에 뜰 때마다** `@ModifiedPassiveDamage@`(scaleAD scaleAP) 물리 피해 + `@GrooveDuration@`(3)초 동안 그루브 상태."

raw variables: `PassiveAD` [60,55,80,...] / `PassiveAP` [20,10,15,...] / `GrooveDuration` [3]

scaling.json: `trigger: onEnemyAirborne`, `effect: extraDamage/physical`, `passiveDamageAD [60,55,80,130]`, `passiveDamageAP [20,10,15,25]`, `grooveDuration 3`

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 공중 띄움 시 추가 물리 (`PassiveDamage`, scaleAD scaleAP) | ❌ **미반영** | **`onEnemyAirborne` 트리거 핸들러 부재** — scaling 핸들러는 `onAttack`(`:6275`)/`onKill`(`:6302`) 만, `onEnemyAirborne` 분기 없음 (grep 0). Samira active 의 공중 띄움(stun)이 passive 를 트리거해야 하나 airborne 이벤트→passive 연결 부재. **Lint P1** |
| 그루브 상태 (`GrooveDuration` 3초) | ❌ **미반영** | passive 자체 미발동 → TheGroove 진입 부재. **Lint P2** |

> ⚠️ Samira 의 핵심 콤보 = **active 로 공중 띄움 → passive 추가 물리** 인데, sim 은 **airborne→passive 트리거가 없어** passive 물리(`PassiveAD` scaleAD + `PassiveAP` scaleAP) 가 누락. active 탄환(`Damage`)만 반영 → 캐리 DPS 과소. [[teemo]] 독 DOT(트리거 onAttack 핸들러 단일 hit) / 트리거 미연결 동형.

### 우주 그루브 (`TFT17_SpaceGroove`) / 저격수 (`TFT17_RangedTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 우주 그루브 (SpaceGroove) | ✅ | `applySpaceGrooveBuffs` (`combatLoop.ts:1791`, 호출 `:4684`) — 그루비안 매초 ADAP. Samira 우주 그루브 멤버 ([[teemo]] 동일) |
| 저격수 (Sniper / RangedTrait) | ✅ | `applySniperEffects` (`combatLoop.ts:1949`) + `computeSniperDamageAmp` — 거리 기반 damage amp. Samira range 6 → 원거리 amp 수혜 ([[gnar]] 동일) |

> 룰 #16/#19: 두 trait 모두 generic 경로 존재 — champion-specific 구현 불필요하나 generic 경로 grep 은 매 champion 재검증.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Samira 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active single Damage + stun 1.0 | `ability.ts:229`, `combatLoop.ts:7125` (config.stun) |
| **OOR (out-of-range)** | ➖ single 은 dash 없음 (range 6) | `findAbilityTargets` single case |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **passive(onEnemyAirborne)** 는 cast pipeline 과 별개 트리거 (미반영). 우주 그루브/저격수 trait 도 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 650, armor/MR 25, AD 50, AS 0.75, range 6, mana 0/60)
- role Caster (`mapGameRole('ADCaster')`)
- active 단일 탄환 (`Damage` scaleAD physical) + stun(공중 띄움) 1.0
- **우주 그루브 (SpaceGroove)** 매초 ADAP + **저격수 (Sniper)** 거리 amp

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: passive (onEnemyAirborne 시 `PassiveDamage` scaleAD scaleAP physical + `GrooveDuration` TheGroove) 미반영 — `onEnemyAirborne` 트리거 핸들러 부재 (grep 0)
- **P2**: active stun 1.0 vs raw `StunDuration` 1.25 (sim 0.25s 적음)
- **P2**: TheGroove 상태 (passive 발동 시 3초) 미반영 — passive 자체 미모델
- **P2**: passive `PassiveAP`(scaleAP) — passive 미모델로 무의미

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | passive onEnemyAirborne 미반영 | passive 핵심 = 공중 띄움 시 `PassiveDamage`(scaleAD scaleAP **물리**) + 그루브. `onEnemyAirborne` 트리거 핸들러 부재 (scaling 핸들러는 onAttack/onKill 만) | **P1** | (b) 이벤트 — stun/knockup 적용 site 에서 airborne 이벤트 emit → Samira `onEnemyAirborne` scaling 핸들러 추가 (PassiveDamage physical, scaleAD+scaleAP) | Samira active→passive 콤보 핵심 누락 → caster DPS 과소. sim fix 후보. ⚠️ PassiveAP 도 **물리** (raw `<physicalDamage>`) |
| P2 | active stun 1.0 vs raw 1.25 | `config.stun: 1.0` (`:7125`) vs raw `StunDuration` 1.25 | **P2** | cast config — `stun: 1.0` → 1.25 (raw `StunDuration`) | 공중 띄움 0.25s 짧음 → CC 과소 |
| P2 | TheGroove 미반영 | passive 발동 시 `GrooveDuration` 3초 그루브 상태 — passive 미모델로 진입 부재 | **P2** | passive 의존 — onEnemyAirborne(P1) 선행 필요 | 그루브 상태 효과 누락 |
| P2 | passive PassiveAP(scaleAP) | passive 물리의 AP 스케일 계수 — passive 미모델로 무의미 (모델 시 **물리** 로 합산) | **P2** | P1 의존 | scaleAP 누락 |

> 📌 **active 탄환(Damage scaleAD) + stun + 우주그루브/저격수 trait 는 sim 반영**. `partial` 사유는 **passive(onEnemyAirborne) 미반영 P1** (Samira 핵심 콤보) + stun 값/TheGroove P2. passive 는 트리거(airborne 이벤트) 연결이 선행 과제.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Samira` apiName 확인 (cost 3, traits [우주 그루브/저격수], role ADCaster)
- [x] entity-wide grep `Samira` + `onEnemyAirborne`/`airborne`/`SpaceGroove`/`Sniper` — sim site (active single config / passive 트리거 부재 / 우주그루브·저격수)
- [x] raw stats 17.4 정합 (hp 650 / armor·MR 25 / AD 50 / AS 0.75 / range 6 / mana 0·60)
- [x] **raw role `ADCaster` → mapGameRole → Caster** — `includes('Caster')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — active single config (`ability.ts:229` stun 1.0) + config.stun apply (`:7125`) + scaling 핸들러 trigger 분기 (`:6275` onAttack / `:6302` onKill — onEnemyAirborne 없음)
- [x] **변수 filler 판정** — Damage `[260,375,560]` no-filler ★1=260 / PassiveAD `[60,55,80]` v0>v1 filler ★1=55 / PassiveAP `[20,10,15]` v0>v1 filler ★1=10 (단 passive 미모델) / GrooveDuration·StunDuration 상수
- [x] **actual sim integration verify (5단계)** — active Damage read (single default `getAbilityDamage`) + stun config (`:7125`) / **`onEnemyAirborne` 트리거 핸들러 grep 0 (onAttack/onKill 만) → passive 미반영 P1** / **`StunDuration` raw 1.25 vs config.stun 1.0 → P2** / passive PassiveDamage `<physicalDamage>` 래핑 = AP 스케일도 물리 (모델 시 magic 아님)
- [x] **cast path 3종 (PR #129 룰)** — main (active single ✅) / OOR (dash 없음 ➖) / recast (carry 없음 ➖). passive(onEnemyAirborne)·trait 별개
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 우주 그루브 `TFT17_SpaceGroove` `applySpaceGrooveBuffs` (`:1791/:4684`) ✅ / 저격수 `TFT17_RangedTrait` `applySniperEffects` (`:1949`) ✅. "verify 면제" 어휘 미사용
- [x] **본문 Lint P1 1건(passive onEnemyAirborne) + P2 3건 등록 → 핵심 passive 미반영 → 보수적 `sim_active: partial` 유지** (P0 회귀 case 없음 → 룰 #15 미해당)
- [ ] (선택) passive onEnemyAirborne sim fix (P1) / active stun 1.25 / TheGroove (P2)

## 관련

- [[role-passive]] — Caster role 마나 규칙 (공격당 7 / 초당 2 / 피격 ❌)
- [[ability-targeting]] — `single` + stun(공중 띄움). cast path main only
- [[teemo]] — 동일 우주 그루브 (SpaceGroove) + 트리거 미연결 passive 미반영 패턴
- [[gnar]] — 동일 저격수 (Sniper) 거리 amp
- [[reksai]] — 동일 "공중 띄움(stun)" 모델 (aoe_circle stun)
- under-damage calibration (메모리 `project_underdamage_calibration`) — Samira passive(onEnemyAirborne) 미반영 = caster DPS 과소 사례
- 코드: `src/lib/simulator/systems/ability.ts:229`, `src/lib/simulator/engine/combatLoop.ts:7125/1791/1949/6275`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Samira), `public/data/tft_set17_traits.json` (TFT17_SpaceGroove / TFT17_RangedTrait)
