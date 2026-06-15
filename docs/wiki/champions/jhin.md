---
id: jhin
type: champion
display_name_kr: 진
api_name: TFT17_Jhin
cost: 5
traits:
  - 암흑의 별
  - 말살자
  - 저격수
role: Marksman   # raw "ADCarry" → mapGameRole() → sim Marksman (types/index.ts includes('Carry')). carry augment 없음
raw_role: ADCarry
current_patch_status: active
sim_active: partial   # passive(asToAd 고정 AS + 추가 AS→AD 전환, applyStartPassives :460-475) + active 잔상 손 multi + 암흑의별(DarkStar)/말살자(JhinUniqueTrait)/저격수(Sniper) trait 정합. ✅ active damageVar 는 PR #229 에서 ADDamage 로 수정 (이전 P0: APDamage 미미값 → ~10배 under, Kindred:238/Xayah:247 동형 multi 는 ADDamage) / P2: active armorReduction 15/4s debuff 가 raw ArmorReduction=null (말살자 trait 이 armor/MR shred 담당 :1593, 비율 vs flat 중복 가능) / P2: FinalShotPercentDamageIncrease(244% 마지막 사격)+관통 미반영 / P2: PercentDamageReductionPerTargetHit(44% 적중당 감소) 미반영 / P2: NumHands(4)×NumAttacks(4) 잔상 손 단순화(hitCount 4)
last_verified: 2026-06-12
sources:
  - "public/data/tft_set17_champions.json (TFT17_Jhin entry — cost 5, role ADCarry, traits [암흑의 별/말살자/저격수], mana 0/44, ability '우주 활극' variables FixedAS/PercentBonusASToConvert/ADConversionRate/NumHands/NumAttacks/ADDamage/APDamage/FinalShotPercentDamageIncrease/PercentDamageReductionPerTargetHit, ArmorReduction=null)"
  - "public/data/tft_set17_traits.json (TFT17_DarkStar = 암흑의 별 / TFT17_JhinUniqueTrait = 말살자 / TFT17_RangedTrait = 저격수)"
  - "src/types/index.ts (mapGameRole — 'ADCarry' includes 'Carry' → Marksman)"
  - "src/lib/simulator/systems/ability.ts:253 (TFT17_Jhin: { pattern: 'multi', maxTargets: 3, debuff: { armorReduction: 15, duration: 4 }, hitCount: 4, damageVar: 'ADDamage' }) — PR #229 fix"
  - "src/lib/simulator/engine/combatLoop.ts:460-475 (applyStartPassives asToAd — fixedAS 설정 + bonusAS×100×convertRate AD 가산)"
  - "src/lib/simulator/engine/combatLoop.ts:1593 (말살자 JhinUniqueTrait 적 전체 armor/MR 감소) + :2141 (applyDarkStarEffects 암흑의 별) + :1949 (applySniperEffects 저격수)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[chogath]]"
  - "[[mordekaiser]]"
  - "[[xayah]]"
---

# 진 (Jhin)

## 요약

5코스트 **암흑의 별 (`TFT17_DarkStar`)** + **말살자 (`TFT17_JhinUniqueTrait`)** + **저격수 (`TFT17_RangedTrait`)** trait. raw role `ADCarry`.

- **role**: `mapGameRole('ADCarry')` → sim **Marksman** (`includes('Carry')`, [[role-passive]]). carry augment 없음. mana 0/44.
- **ability "우주 활극"**: (passive) **고정 AS** (`FixedAS`, ★2 0.9 / ★3 1.4) + 모든 추가 AS의 `PercentBonusASToConvert`(1%)를 `ADConversionRate`(0.75)의 추가 AD로 전환. (active) 잔상 손 `NumAttacks`(4)개 소환 → 다음 `NumHands`(4)회 평타 동안 함께 사격, 각 손 `TotalDamage`(scaleAD) 물리. 마지막 사격 일직선 관통 + `FinalShotPercentDamageIncrease`(244%) 증가, 적중마다 `PercentDamageReductionPerTargetHit`(44%) 감소.

> 🎯 **Jhin 은 고정 AS → AD 전환 마크스맨** — passive(AS→AD 전환)는 sim 반영. active damageVar 는 **PR #229 에서 ADDamage 로 수정** (이전 APDamage 오선택 → ~10배 under P0 resolved). [[chogath]]/[[mordekaiser]] 동일 암흑의 별, [[xayah]] 동일 저격수.

> ⚠️ **set17 entity confirm**: `TFT17_Jhin` apiName 으로 소속 확인 (cost 5, traits 암흑의별/말살자/저격수, role ADCarry). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 900 |
| armor / magicResist | 40 / 40 |
| damage | 80 |
| attackSpeed | 0.9 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 44 |

### Role — Marksman

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Marksman** | 1 | 10 | 0 | ❌ | `mapGameRole('ADCarry')` includes 'Carry' → Marksman ([[role-passive]]) |

### Passive — 고정 AS + AS→AD 전환 (`scaling.json` trigger passive, `applyStartPassives :460-475`)

raw desc: "진은 `@FixedAS@` 의 고정 공격 속도를 가지며 모든 추가 공격 속도의 `@PercentBonusASToConvert*100@`%(1%)를 `@ADConversionRate@`(0.75)의 추가 공격력으로 전환."

raw variables: `FixedAS` [0,0.9,0.9,1.4] / `PercentBonusASToConvert` [0.01] / `ADConversionRate` [0.75]

scaling.json: `trigger: passive`, `effect: asToAd`, `fixedAS [0,0.9,0.9,1.4]`, `convertRate 0.75`, `convertPercent 0.01`

**sim 적용** ✅ (`applyStartPassives` 전투 시작 `:460-475`):

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 고정 AS (`FixedAS`) | ✅ | `:467` `fixedAS = starValue(arr[starLevel])` → ★1=0.9 / ★2=0.9 / ★3=1.4. `:472` `unit.stats.attackSpeed = fixedAS` |
| 추가 AS → AD 전환 (`convertRate` 0.75) | ✅ | `:469-471` `bonusAS = attackSpeed - fixedAS`, `bonusAS > 0 && fixedAS > 0` → `damage += round(bonusAS × 100 × 0.75)` |

> ✅ Jhin 의 시그니처 passive (고정 AS + 추가 AS→AD 전환) 정확 반영. ⚠️ `convertPercent`(1%) 는 sim 에서 `bonusAS × 100` (percent-point 변환) 으로 처리 — 추가 AS 전부를 전환 (raw "추가 AS의 1%" 의 정확한 단위 해석은 measurement 권장이나 standard Jhin 패턴).

### Active — 잔상 손 사격 (`ability.ts:253`)

raw desc: "잔상 손 `@NumAttacks@`(4)개 소환 → 다음 `@NumHands@`(4)회 평타 동안 함께 사격. 각 손 `@TotalDamage@`(scaleAD) 물리. 마지막 사격 일직선 관통 + `@FinalShotPercentDamageIncrease*100@`%(244%) 증가. 적중마다 `@PercentDamageReductionPerTargetHit*100@`%(44%) 감소."

raw variables: `NumHands` [4] / `NumAttacks` [4] / `ADDamage` [0,41,62,644] / `APDamage` [0,4,6,44] / `FinalShotPercentDamageIncrease` [2.44] / `PercentDamageReductionPerTargetHit` [0.44] / `ArmorReduction` = **null**

**sim 적용** (`ability.ts:253`):
```ts
TFT17_Jhin: { pattern: 'multi', maxTargets: 3, debuff: { armorReduction: 15, duration: 4 }, hitCount: 4, damageVar: 'ADDamage' }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 잔상 손 4개 (`NumAttacks`/`NumHands`) | ⚠️ 단순화 | `pattern: 'multi', maxTargets: 3, hitCount: 4` — 4 hit multi (4 hands 근사). NumHands(4)회 평타 연동은 미모델 |
| 사격 피해 (`TotalDamage`, **scaleAD**) | ✅ **ADDamage (PR #229 resolved)** | config `damageVar: 'ADDamage'` [0,41,62,644] (★1=41/★2=62/★3=644, desc scaleAD). **이전 P0** (`'APDamage'` [0,4,6,44] 미미값 → ~10배 under, 동형 multi Kindred:238/Xayah:247는 ADDamage)을 **PR #229 fix** (`'APDamage'`→`'ADDamage'`). 회귀 가드 `jhin-active-addamage.test.ts`, diff-cache game-424 simMean 2688.7→3259.8 |
| armorReduction debuff 15/4s | ⚠️ **raw 근거 없음** | config `debuff.armorReduction: 15` 인데 raw `ArmorReduction` = **null**. **말살자(JhinUniqueTrait) trait 이 armor/MR shred 담당** (`:1593`) → ability debuff 는 spurious 또는 trait 와 중복 가능. **Lint P2** |
| 마지막 사격 관통 + 244% 증가 (`FinalShotPercentDamageIncrease`) | ❌ **미반영** | multi pattern 에 final-shot 분기 없음. `FinalShotPercentDamageIncrease` grep 0. **Lint P2** |
| 적중당 44% 감소 (`PercentDamageReductionPerTargetHit`) | ❌ **미반영** | config 에 `damageDecay` 없음 → per-target 감소 미적용. **Lint P2** |

> ✅ **PR #229 resolved**: active 핵심 직격이 `damageVar: 'ADDamage'`(scaleAD 주력)로 수정 — 이전 `'APDamage'` ~10배 under 해소 (회귀 가드 + diff-cache game-424 simMean +21%).

### 암흑의 별 (`DarkStar`) / 말살자 (`JhinUniqueTrait`) / 저격수 (`RangedTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 암흑의 별 (DarkStar) | ✅ | `applyDarkStarEffects` (`:2141`, `unitHasTrait '암흑의 별'` `:2151`) — tier별 ADAP + ExecuteHPPercent. Jhin 암흑의 별 6명 중 하나 ([[chogath]]/[[mordekaiser]] 동일) |
| 말살자 (`JhinUniqueTrait`) | ✅ | `:1593` 말살자(진) 적 전체 armor/MR 감소 (unique=1). raw `ArmorReduction` null 인데 armor shred 는 이 trait 이 담당 |
| 저격수 (Sniper / `RangedTrait`) | ✅ | `applySniperEffects` (`:1949`) + `computeSniperDamageAmp` — 거리 amp. Jhin range 6 → 원거리 amp 수혜 ([[xayah]] 동일) |

> 룰 #16/#19: 세 trait 모두 generic/unique 경로 존재 — champion-specific 구현 불필요하나 grep 재검증.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Jhin 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active multi 4-hit (ADDamage, PR #229) + armorReduction debuff | `ability.ts:253`, `combatLoop.ts:6594` (findAbilityTargets multi) |
| **OOR (out-of-range)** | ➖ multi 는 dash 없음 (range 6) | `findAbilityTargets` multi case |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **passive asToAd** (전투 시작 `:460`) 은 cast pipeline 과 별개. 3 trait 도 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 900, armor/MR 40, AD 80, AS 0.9, range 6, mana 0/44)
- role Marksman (`mapGameRole('ADCarry')`)
- **passive 고정 AS + AS→AD 전환** (`applyStartPassives` asToAd) ✅
- active 잔상 손 multi 4-hit (ADDamage, PR #229 resolved)
- **암흑의 별 (DarkStar)** + **말살자 (armor/MR shred)** + **저격수 (Sniper)** trait

⚠️ **부정확 / 미반영** (Lint 후보):
- ✅ **PR #229 resolved**: active `damageVar` APDamage→ADDamage 수정 (이전 ~10배 under P0 해소)
- **P2**: active armorReduction 15/4s debuff 가 raw `ArmorReduction`=null (말살자 trait 이 armor shred 담당) — spurious/중복 가능
- **P2**: `FinalShotPercentDamageIncrease`(244% 마지막 사격)+관통 미반영
- **P2**: `PercentDamageReductionPerTargetHit`(44% 적중당 감소) 미반영
- **P2**: NumHands(4)×NumAttacks(4) 잔상 손 단순화 (hitCount 4)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ✅ resolved | active damageVar APDamage→ADDamage (PR #229) | config `damageVar: 'APDamage'` [0,4,6,44] → `'ADDamage'` [0,41,62,644] (desc `TotalDamage` scaleAD) 수정. 이전 ~10배 under | **resolved (PR #229)** | cast config `'APDamage'` → `'ADDamage'` 적용됨 + 회귀 가드 + diff-cache | 5코 carry active DPS ~10배 under 해소. game-424 simMean 2688.7→3259.8 |
| P2 | active armorReduction raw 근거 없음 | config `debuff.armorReduction: 15` 인데 raw `ArmorReduction`=null. 말살자 trait(`:1593`)이 armor/MR shred 담당 | **P2** | cast config/trait — ability debuff 제거 (말살자 trait 와 중복) 또는 raw 근거 확인 | armor shred 이중 적용 가능 |
| P2 | FinalShot 244%+관통 미반영 | 마지막 사격 일직선 관통 + `FinalShotPercentDamageIncrease`(244%). grep 0 | **P2** | cast — multi 마지막 hit 에 final-shot 분기 (line 관통 + 배수) | active 마무리 폭딜 누락 |
| P2 | per-target 44% 감소 미반영 | `PercentDamageReductionPerTargetHit`(0.44) — config damageDecay 없음 | **P2** | cast config — `damageDecay: 0.44` 추가 | 다중 적중 시 후순 over-damage |

> 📌 **passive(고정 AS + AS→AD 전환) + active(ADDamage, PR #229) + 3 trait 는 sim 반영**. 이전 active damageVar APDamage 오선택 P0(~10배 under)는 **PR #229 resolved**. `partial` 잔존 사유는 armorReduction/FinalShot/per-target 감소 P2.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Jhin` apiName 확인 (cost 5, traits [암흑의별/말살자/저격수], role ADCarry)
- [x] entity-wide grep `Jhin` + `asToAd`/`FixedAS`/`DarkStar`/`말살자` — sim site (passive applyStartPassives / active config / 3 trait)
- [x] raw stats 17.4 정합 (hp 900 / armor·MR 40 / AD 80 / AS 0.9 / range 6 / mana 0·44)
- [x] **raw role `ADCarry` → mapGameRole → Marksman** — `includes('Carry')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — passive `applyStartPassives` (`:460-475` asToAd fixedAS+convert) + active config (`ability.ts:253` multi/hitCount 4/damageVar ADDamage(PR #229 fix)/debuff armorReduction) + 말살자/암흑의별/저격수 helper
- [x] **변수 filler 판정** — ADDamage `[0,41,62,644]` v0=0 filler ★1=41/★2=62/★3=644 / APDamage `[0,4,6,44]` v0=0 filler ★1=4 / FixedAS `[0,0.9,0.9,1.4]` starValue arr[starLevel] ★1=0.9/★2=0.9/★3=1.4 / 나머지 상수, ArmorReduction=null
- [x] **actual sim integration verify (5단계)** — passive asToAd fixedAS+convert read 확인 (`:467-472`) / **active damageVar 'ADDamage' (PR #229 resolved — 이전 'APDamage' ~10배 under P0)** / **armorReduction 15 debuff config 인데 raw ArmorReduction=null, 말살자 trait 이 shred 담당 P2** / **FinalShotPercentDamageIncrease/PercentDamageReductionPerTargetHit grep 0 → 미반영 P2**
- [x] **cast path 3종 (PR #129 룰)** — main (active multi ✅) / OOR (dash 없음 ➖) / recast (carry 없음 ➖). passive·trait 별개
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 암흑의별 `TFT17_DarkStar` `applyDarkStarEffects` (`:2141`) ✅ / 말살자 `TFT17_JhinUniqueTrait` armor/MR shred (`:1593`) ✅ / 저격수 `TFT17_RangedTrait` `applySniperEffects` (`:1949`) ✅. "verify 면제" 어휘 미사용
- [x] **trait cross-ref 멤버십 verify** — 암흑의 별 멤버(Kaisa/Karma/Jhin/Chogath/Lissandra/Mordekaiser) 중 페이지 존재 [[chogath]]/[[mordekaiser]] cross-ref / 저격수 [[xayah]] (Fiora #226 codex P2 Aatrox 오링크 학습 — 링크 대상 trait 실재 확인)
- [x] **이전 Lint P0(damageVar APDamage) → PR #229 resolved** (damageVar→ADDamage + 회귀 가드 + diff-cache). 잔존 P2 4건 → `sim_active: partial` 유지
- [ ] (선택) armorReduction / FinalShot / per-target 감소 sim fix (P2)

## 관련

- [[role-passive]] — Marksman role 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `multi` (maxTargets 3, hitCount 4) + debuff. cast path main only
- [[chogath]] — 동일 암흑의 별 (DarkStar) trait (멤버)
- [[mordekaiser]] — 동일 암흑의 별 (DarkStar) trait (멤버)
- [[xayah]] — 동일 저격수 (Sniper) 거리 amp
- under-damage calibration (메모리 `project_underdamage_calibration`) — Jhin active damageVar APDamage→ADDamage (PR #229 resolved) = 5코 carry under-damage 해소 사례
- 코드: `src/lib/simulator/systems/ability.ts:253`, `src/lib/simulator/engine/combatLoop.ts:460/1593/2141/1949`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Jhin), `public/data/tft_set17_traits.json` (TFT17_DarkStar / TFT17_JhinUniqueTrait / TFT17_RangedTrait)
