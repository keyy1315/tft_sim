---
id: graves
type: champion
display_name_kr: 그레이브즈
api_name: TFT17_Graves
cost: 5
traits:
  - 최신상
role: Marksman   # raw "ADCarry" → mapGameRole() → sim Marksman (types/index.ts includes('Carry')). ⚠️ 최신상 CloseQuarters(맹공) Frame 선택 시 role → Fighter (applyGravesFrameEffects). carry augment 는 아니고 trait 무기고 Frame
raw_role: ADCarry
current_patch_status: active
sim_active: partial   # active cone Damage(scaleAD filler ★1=390/★2=585) + 인접 SecondaryDamageAD(no-filler ★1=120/135/200) + 최신상(GravesTrait) 무기고 Frame 3종(CloseQuarters/SharpshooterModule/DoubleTap) + stat upgrade 30+ + Shockwave 정합. P1 평타 원뿔 투사체 passive(NumProjectiles 5 × baseAD×PassivePercentBAD 0.33) 미반영 (grep 0 — carry 평타 핵심) / P2 active 인접 SecondaryDamageAP(scaleAP) 미사용 (config secondaryDamageVar=SecondaryDamageAD 만) / info Damage ★3=5555 sentinel (5코 3성 placeholder, ★1=390/★2=585 정상)
last_verified: 2026-06-05
sources:
  - "public/data/tft_set17_champions.json (TFT17_Graves entry — cost 5, role ADCarry, traits [최신상], ability '무고한 희생자' variables NumProjectiles/PassivePercentBAD/Damage/SecondaryDamageAD/SecondaryDamageAP)"
  - "public/data/tft_set17_traits.json (TFT17_GravesTrait = 최신상 — 무기고 upgrade 시스템, 가장 강한 그레이브즈 1명)"
  - "src/types/index.ts (mapGameRole — 'ADCarry' includes 'Carry' → Marksman)"
  - "src/lib/simulator/systems/ability.ts:259 (TFT17_Graves: { pattern: 'cone', radius: 2, secondaryDamageVar: 'SecondaryDamageAD' } — Damage auto-detect + 인접 SecondaryDamageAD)"
  - "src/lib/simulator/engine/combatLoop.ts:2359-2389 (applyGravesFrameEffects — Frame 3종: CloseQuarters Range-2/+HP250/+AD25%/흡혈10%/role Fighter, SharpshooterModule spellCanCrit+gravesAbilityDamageBonus 0.05, DoubleTap gravesDoubleAttackChance 0.25)"
  - "src/lib/simulator/engine/combatLoop.ts:3116 (applyGravesStatUpgrades — 무기고 stat upgrade 30+ 적용, 가장 강한 그레이브즈 1명) / :2468 GRAVES_STAT_UPGRADE_HANDLERS (Shockwave/DoubleTap2/TripleTap/RevUp/GravBooster/Buckshot/Laser/Frag/Reactive 등)"
  - "src/lib/simulator/engine/combatLoop.ts:2684 (Shockwave — gravesShockwaveActive 전투 시작 가까운 적 maxHp×15% magic + 2s stun)"
  - "src/lib/simulator/engine/combatLoop.ts:4710-4714 (applyGravesFrameEffects/applyGravesStatUpgrades 호출 — options.gravesFrame=picks[0] / gravesUpgrades=picks[1:])"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[spell-crit]]"
  - "[[vex]]"
  - "[[caitlyn]]"
---

# 그레이브즈 (Graves)

## 요약

5코스트 **최신상 (`TFT17_GravesTrait`)** 단일 trait. raw role `ADCarry`.

- **role**: `mapGameRole('ADCarry')` → sim **Marksman** ([[role-passive]]). ⚠️ 최신상 **CloseQuarters(맹공) Frame** 선택 시 role → **Fighter** (`applyGravesFrameEffects`).
- **ability "무고한 희생자"**: passive (평타 시 원뿔 투사체 5개) + active (폭발탄 cone Damage + 인접 SecondaryDamage).
- **최신상 무기고**: 전투 후 가장 강한 그레이브즈 1명에 영구 업그레이드 — **Frame 3종** (picks[0]) + **stat upgrade 30+** (picks[1:]) + Shockwave 등.

> 🎯 **Graves 는 "무기고 stat 조합형" 5코 carry** — Frame(맹공/위력/사수) + 무기고 upgrade picks 로 빌드 다양화. NOVA 5종 같은 공유 surge 는 없으나 단일 trait 무기고 시스템이 방대. UI(`GravesWeaponModal`) picks → `applyGravesFrameEffects`/`applyGravesStatUpgrades`.

> ⚠️ **set17 entity confirm**: `TFT17_Graves` apiName 으로 소속 확인 (cost 5, traits [최신상], role ADCarry). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 900 |
| armor / magicResist | 40 / 40 |
| damage | 60 |
| attackSpeed | 0.7 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 60 |

### Role — Marksman (CloseQuarters Frame 시 Fighter)

| 형태 | role | weight | 공격당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|------------|------|
| base / 대부분 Frame | **Marksman** | 1 | 10 | ❌ | `mapGameRole('ADCarry')` includes 'Carry' |
| CloseQuarters(맹공) Frame | **Fighter** | 2 | 10 | ❌ | `applyGravesFrameEffects` (`:2371`) `target.role = 'Fighter'` (Range -2 근접 변환) |

### Passive — 원뿔 투사체 (`combatLoop` 미반영)

raw desc: "기본 공격 시 원뿔 범위에 투사체 `@NumProjectiles@`(5)개를 발사해 각각 `@ModifiedPassiveDamage@`(TFTBaseAD) 물리 피해." (PassiveDamage = baseAD × `PassivePercentBAD` 0.33)

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 평타 원뿔 5투사체 (각 baseAD × 0.33) | ❌ **미반영** | `NumProjectiles` / `PassivePercentBAD` repo-wide grep **0 hit**. 평타 시 원뿔 5투사체 추가 물리 sim 부재 — **carry 평타 핵심 메커니즘 누락**. **Lint P1** (5코 carry 평타 DPS 과소) |

### Active — 무고한 희생자 (`ability.ts:259`)

raw desc: "폭발성 탄환을 발사해 대상에게 `@ModifiedDamage@`(scaleAD) 물리 피해 + 인접한 적에게 `@ModifiedSecondaryDamage@`(scaleAD scaleAP) 물리 피해."

raw variables: `Damage` [400,390,585,5555,...] / `SecondaryDamageAD` [120,135,200,3333,...] / `SecondaryDamageAP` [30,30,45,777,...]

**sim 적용** (`ability.ts:259`):
```ts
TFT17_Graves: { pattern: 'cone', radius: 2, secondaryDamageVar: 'SecondaryDamageAD' }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 폭발탄 damage (`Damage`, scaleAD) | ✅ | `damageVar` 없음 → `DAMAGE_VAR_PRIORITY` first **'Damage'**. **filler** `[400,390,585,5555]` (v0>v1) → ★1=390 / ★2=585 / **★3=5555 sentinel** (5코 3성 placeholder, 비정상값 — 실전 ★1 위주) |
| cone radius 2 | ✅ | 원뿔 범위 |
| 인접 적 (`SecondaryDamageAD`, scaleAD) | ✅ | `secondaryDamageVar: 'SecondaryDamageAD'` **no-filler** `[120,135,200]` → ★1=120 / ★2=135 / ★3=200 (`combatLoop.ts:162` 주석 — Graves SecondaryDamageAD no-filler) |
| 인접 적 scaleAP (`SecondaryDamageAP`) | ❌ **미사용** | config `secondaryDamageVar` 는 `SecondaryDamageAD` 만 → `SecondaryDamageAP` [30,30,45] (scaleAP 추가분) 미read. desc 인접 = scaleAD+scaleAP 인데 sim 은 scaleAD 만. **Lint P2** |

### 최신상 (`TFT17_GravesTrait`) trait — 무기고

전투 후 무기고를 열어 **가장 강한 그레이브즈 1명** 에 영구 업그레이드 구매 (`findStrongestUnitByApi`). UI picks → `options.gravesFrame` (picks[0]) + `options.gravesUpgrades` (picks[1:]).

#### Frame 3종 (`applyGravesFrameEffects` `:2359-2389`, picks[0])

| Frame | sim 효과 | 근거 |
|-------|---------|------|
| **CloseQuarters (맹공)** | ✅ | Range -2 (최소 1) + maxHp +250 + AD +25%(baseAD 기준) + 흡혈 +10% + **role → Fighter** (`:2367-2373`) |
| **SharpshooterModule (위력)** | ✅ | `spellCanCrit = true` (정밀) + `gravesAbilityDamageBonus = 0.05` (스킬 피해 +5%) (`:2380-2381`) |
| **DoubleTap (사수)** | ✅ | `gravesDoubleAttackChance = 0.25` (25% 확률 추가 공격, on_attack hook) (`:2386`) |

#### 무기고 stat upgrade (`applyGravesStatUpgrades` `:3116`, picks[1:])

`GRAVES_STAT_UPGRADE_HANDLERS` (`:2468`) 맵 기반 **30+ upgrade** — 가장 강한 그레이브즈 1명에 stat 직접 가산. 대표:

| upgrade | sim 효과 |
|---------|---------|
| Shockwave | `gravesShockwaveActive` — 전투 시작 가까운 적 2명 maxHp×15% magic + 2초 stun (`:2684`) |
| DoubleTap2 / TripleTap | 추가 공격 확률 0.35 / 0.18 (`:2472-2473`) |
| RevUp / GravBooster / Buckshot / Laser / Frag / Reactive / Latent / Meltthrough / Blast 등 | AS/투사체/관통/AD amp/방깎 등 각 stat (`combatLoop.ts:239-271` 필드 목록) |

> 무기고 stat upgrade 는 30+ 종으로 방대 — 본 champion 페이지는 시스템 개요 + 대표 upgrade 만 다룬다. 전체 상세는 별도 mechanic 페이지 (`graves-armory`) 후보. 각 upgrade 는 `GRAVES_STAT_UPGRADE_HANDLERS` (`:2468`) 에서 가장 강한 그레이브즈 unit stat 직접 set.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Graves 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active cone (Damage + SecondaryDamageAD) | `ability.ts:259` |
| **OOR (out-of-range dash)** | ➖ cone + dash 없음. range 4 → OOR fallback 진입 빈도 낮음 (CloseQuarters Frame 시 range 2 근접) | — |
| **recast (onKill)** | ➖ 없음 — carry augment 전용. Graves 는 trait 무기고 (carry augment 아님) | — |

> **평타 투사체 passive** (미반영) + **무기고 Frame/upgrade** (combat-start) + **Shockwave** (combat-start) 는 cast pipeline 과 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 900, armor/MR 40, AD 60, AS 0.7, mana 0/60, range 4)
- role Marksman (`mapGameRole('ADCarry')`) / CloseQuarters Frame 시 Fighter 변환
- active cone — Damage (scaleAD filler ★1=390/★2=585) + 인접 SecondaryDamageAD (no-filler ★1=120/★2=135/★3=200)
- **최신상 무기고**: Frame 3종 (CloseQuarters/SharpshooterModule/DoubleTap) + stat upgrade 30+ (`applyGravesStatUpgrades`) + Shockwave (가장 강한 Graves 1명)

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: 평타 원뿔 투사체 passive (`NumProjectiles` 5 × baseAD × `PassivePercentBAD` 0.33) 미반영 — grep 0, 5코 carry 평타 핵심 DPS 누락
- **P2**: active 인접 `SecondaryDamageAP` (scaleAP 추가분) 미사용 — config `secondaryDamageVar` 는 `SecondaryDamageAD` 만
- (info): Damage ★3=5555 sentinel (5코 3성 placeholder, ★1=390/★2=585 정상)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | 평타 원뿔 투사체 passive 미반영 | desc "평타 시 원뿔 5투사체 각 baseAD×0.33 물리". `NumProjectiles`/`PassivePercentBAD` grep 0. 5코 carry 평타 추가 DPS (5×0.33=1.65×baseAD/평타) 누락 | **P1** | (b) attack-hook — 평타 시 원뿔 범위 적에게 5 × (baseAD×0.33) 물리 (Corki/Vex spread 패턴 유사) | 5코 carry 평타 핵심. DPS 영향 큼 — 우선 fix 권장 |
| P2 | active 인접 SecondaryDamageAP 미사용 | config `secondaryDamageVar='SecondaryDamageAD'` 만 → SecondaryDamageAP(scaleAP) 미read. desc 인접 = scaleAD+scaleAP | **P2** | secondaryDamageVar — AD+AP 합산 분기 (Fizz BiteDamageAP 등 패턴). 단 secondaryDamageVar 단일 string 제약 | scaleAP 추가분만 누락. scaleAD 주력은 반영. 구조 변경 필요 |
| info | Damage ★3=5555 sentinel | filler 배열 ★3 placeholder (5코 3성 데이터 미정의). ★1=390/★2=585 정상 | info | 해당 없음 | 5코 3성 거의 없어 실전 무관. 명시만 |

> 📌 **active cone + 최신상 무기고 (Frame 3종 + stat upgrade + Shockwave) 는 sim 정합**. `partial` 핵심 사유는 **평타 원뿔 투사체 passive 미반영 (P1, 5코 carry 평타 DPS)**. 무기고 30+ upgrade 는 개요만 (상세 별도 mechanic 페이지 후보).

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Graves` apiName 확인 (cost 5, traits [최신상], role ADCarry)
- [x] entity-wide grep `Graves` + `그레이브즈` + `최신상` — sim site (ability cone / applyGravesFrameEffects / applyGravesStatUpgrades / Shockwave / 평타 투사체 grep 0)
- [x] raw stats 17.4 정합 (hp 900 / armor·MR 40 / AD 60 / AS 0.7 / mana 0·60 / range 4)
- [x] **raw role `ADCarry` → mapGameRole → Marksman** — `includes('Carry')`. CloseQuarters Frame 시 Fighter 변환 (`:2371`) 분기 명시
- [x] **함수 컨텍스트 read (2단계)** — `applyGravesFrameEffects` (`:2359-2389`, Frame 3종) + `applyGravesStatUpgrades` (`:3116`) + Shockwave (`:2684`) + 평타 투사체 grep 0 확인
- [x] **변수 filler 판정** — Damage `[400,390,585,5555]` filler (v0>v1) ★1=390/★2=585/★3=5555(sentinel) / SecondaryDamageAD `[120,135,200]` no-filler ★1=120 / SecondaryDamageAP `[30,30,45]` no-filler (미사용) / NumProjectiles·PassivePercentBAD 상수
- [x] **actual sim integration verify (5단계)** — active Damage 'Damage' auto-detect read / SecondaryDamageAD secondaryDamageVar read / **`NumProjectiles`/`PassivePercentBAD` grep 0 → 평타 투사체 passive 미반영 P1** / **`SecondaryDamageAP` config 미참조 → scaleAP 미사용 P2**
- [x] **cast path 3종 (PR #129 룰)** — main (cone ✅) / OOR (dash 없음 ➖) / recast (carry augment 없음 ➖). 평타 투사체·무기고·Shockwave 별개 경로
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 최신상 `TFT17_GravesTrait` `applyGravesFrameEffects` (`:2359`) + `applyGravesStatUpgrades` (`:3116`) + Shockwave (`:2684`) ✅. 단일 trait, scaling.json synergies 아닌 별도 helper (PR #186 off-by-one 무관). 가장 강한 Graves 1명 한정 (`findStrongestUnitByApi`)
- [x] **spell crit read site (PR #183 학습)** — SharpshooterModule Frame 시 `spellCanCrit = true` (`:2380`) → active cone cast loop spell crit 가능 (Frame 선택 시). base/타 Frame 은 운명술사 등 별도 필요
- [x] **본문 Lint P1 1건 + P2 1건 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [ ] (선택) 평타 원뿔 투사체 passive (P1) / SecondaryDamageAP scaleAP (P2) sim 도입. 무기고 30+ upgrade 별도 mechanic 페이지 (graves-armory)

## 관련

- [[role-passive]] — Marksman role (CloseQuarters Frame 시 Fighter 변환)
- [[ability-targeting]] — `cone` 패턴 + secondaryDamageVar. cast path main 중심 (dash/recast 없음)
- [[spell-crit]] — SharpshooterModule Frame 시 spellCanCrit → active cone spell crit 가능
- [[vex]] — 동일 단일 unique trait 5코 (Vex 파멸자 강탈 vs Graves 최신상 무기고). 평타 추가 메커니즘 (Vex 그림자 reflect vs Graves 원뿔 투사체) 비교 — 단 Graves 투사체는 미반영(P1)
- [[caitlyn]] — 동일 평타 추가 피해 (Caitlyn 헤드샷 확률 vs Graves 원뿔 투사체). range 4 marksman
- 코드: `src/lib/simulator/systems/ability.ts:259`, `src/lib/simulator/engine/combatLoop.ts:2359/2468/2684/3116/4710`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Graves), `public/data/tft_set17_traits.json` (TFT17_GravesTrait)
