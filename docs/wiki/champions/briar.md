---
id: briar
type: champion
display_name_kr: 브라이어
api_name: TFT17_Briar
cost: 1
traits:
  - 동물특공대
  - 태고족
  - 불한당
role: Fighter   # raw "ADFighter" → mapGameRole() → sim Fighter (types/index.ts includes('Fighter')). carry augment 없음
raw_role: ADFighter
current_patch_status: active
sim_active: partial   # base 물고기 광분 single + 액티브 물리(ADDamage sentinel filler ★1=120/180/285 scaleAD) + 탱커 50% 추가(PercentBonusDamage) + 패시브 잃은체력 비례 AS(getEffectiveAttackSpeed scaling.json asPerMissingHpPercent+apScaling) + 태고족(Primordian) 정합. ✅ 패시브 AS 단위 + selfBuff #204 수정 완료 (:3530 /100 이중 변환 제거 + config selfBuff 제거 → 잃은체력 50% +100% AS raw 정합, golden 5건 갱신) / P2 APDamage[0,10,15,25] 미반영(DAMAGE_VAR_PRIORITY ADDamage 우선, desc scaleAD만) / P2 동물특공대(AnimaSquad) trait sim 전투효과 미반영(synergies/helper 없음) / P2 불한당 은신(healthThreshold stealth) 미반영
last_verified: 2026-06-08
sources:
  - "public/data/tft_set17_champions.json (TFT17_Briar entry — cost 1, role ADFighter, traits [동물특공대/태고족/불한당], mana 0/40, ability '물고기 광분' variables PercentMissingHealth/ADDamage/APDamage/PercentBonusDamage/AS)"
  - "public/data/tft_set17_traits.json (TFT17_AnimaSquad = 동물특공대 / TFT17_Primordian = 태고족 / TFT17_AssassinTrait = 불한당)"
  - "public/data/tft_set17_scaling.json (champions.TFT17_Briar — passive asPerMissingHpPercent [2,2,2,2.5], apScaling true / synergies.TFT17_AssassinTrait 불한당 adap [15,30,45,60] + 은신)"
  - "src/types/index.ts (mapGameRole — 'ADFighter' includes 'Fighter' → Fighter)"
  - "src/lib/simulator/systems/ability.ts:190 (TFT17_Briar: { pattern: 'single', selfBuff: { attackSpeed: 0.5, duration: 999 } })"
  - "src/lib/simulator/systems/ability.ts:392 (DAMAGE_VAR_PRIORITY — 'ADDamage' before 'APDamage') / :556 getChampionScaling"
  - "src/lib/simulator/engine/combatLoop.ts:3527 (getEffectiveAttackSpeed — briarSc 잃은체력 비례 AS: missingPct × asPerPct × apScale) / :6590 (탱커 50% PercentBonusDamage) / :2166 applyPrimordianEffects 태고족"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[reksai]]"
  - "[[maokai]]"
  - "[[graves]]"
---

# 브라이어 (Briar)

## 요약

1코스트 **동물특공대 (`TFT17_AnimaSquad`)** + **태고족 (`TFT17_Primordian`)** + **불한당 (`TFT17_AssassinTrait`)** 3 trait. raw role `ADFighter`.

- **role**: `mapGameRole('ADFighter')` → sim **Fighter** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌). carry augment 없음.
- **base ability "물고기 광분"**: 패시브 — 잃은 체력 `PercentMissingHealth`(1)%당 `ModifiedAS`(scaleAP)% 공격속도. 액티브 — 대상 `ModifiedDamage`(scaleAD) 물리 피해, 탱커 시 `PercentBonusDamage`(50%) 증가.

> 🎯 **Briar 는 잃은 체력 비례 광폭화 1코 Fighter** (3 trait). 액티브 물리 피해 + 탱커 50% 는 정합하나 **패시브 AS 단위 과소(P1) + config selfBuff 0.5 이중(P2)** 으로 AS 메커니즘 부정확.

> ⚠️ **set17 entity confirm**: `TFT17_Briar` apiName 으로 소속 확인 (cost 1, traits 동물특공대/태고족/불한당, role ADFighter). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 650 |
| armor / magicResist | 35 / 35 |
| damage | 35 |
| attackSpeed | 0.75 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 40 |

### Role — Fighter

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base | **Fighter** | 2 | 10 | 0 | ❌ | `mapGameRole('ADFighter')` includes 'Fighter' ([[role-passive]] Fighter 마나 규칙) |

### Passive — 잃은 체력 비례 AS (`combatLoop.ts:3527` getEffectiveAttackSpeed)

raw desc: "기본 지속 효과: 잃은 체력 `@PercentMissingHealth@`(1)%당 공격 속도를 `@ModifiedAS@`(scaleAP)% 얻습니다." (AS var [2,2,2,2.5] = 1%당 2%/★3 2.5%)

**sim 적용** (`:3527`, scaling.json `asPerMissingHpPercent`):
```ts
const missingPct = 1 - (unit.currentHp / unit.maxHp);          // 비율 0~1
const asPerPct = starValue(briarSc.asPerMissingHpPercent, star) / 100;  // 2/100 = 0.02
const apScale = briarSc.apScaling ? (1 + unit.stats.ap / 100) : 1;
as *= (1 + missingPct * asPerPct * apScale);
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 잃은 체력 비례 AS (동적) | ✅ 동적 + scaleAP | `getEffectiveAttackSpeed` 매 공격 계산. scaling.json `asPerMissingHpPercent` [2,2,2,2.5] + `apScaling` |
| AS 수치 단위 | ✅ **#204 수정** | `:3530` `/100` 이중 변환 제거 (scaling.json 값 [2,2,2,2.5] 가 이미 percent-point). 잃은체력 50% ★1: `0.5 × 2 = 1.0` → **+100% AS** (raw "1%당 2%" 정합). golden snapshot 5건 갱신 |

> ✅ **패시브 AS #204 수정 완료** — `:3530` `/100` 제거로 잃은체력 50% → +100% AS (raw 정합). 광폭화 1코 핵심 정상 작동 (회귀 가드 `briar-passive-as.test.ts` + golden 5건).

### Active — 물고기 광분 (`ability.ts:190`)

raw desc: "사용 시: 대상에게 `@ModifiedDamage@`(scaleAD) 물리 피해. 대상이 탱커일 경우 `@PercentBonusDamage*100@`(50)% 증가."

raw variables: `ADDamage` [3.3,120,180,285,485] (sentinel filler v1/v0=36>5) / `APDamage` [0,10,15,25,45] filler / `PercentBonusDamage` [0.5,..] 상수 / `AS` [2,2,2,2.5,2.5]

**sim 적용** (`ability.ts:190`):
```ts
TFT17_Briar: { pattern: 'single', selfBuff: { attackSpeed: 0.5, duration: 999 } }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 단일 대상 물리 피해 (`ADDamage`) | ✅ ★별 + scaleAD | `DAMAGE_VAR_PRIORITY` 'ADDamage' 매칭 (`:392`). sentinel filler → ★1=120/★2=180/★3=285. detectScaling 물리 → 'ad' |
| 탱커 시 +50% (`PercentBonusDamage`) | ✅ | `:6590` `if Briar && t.role === 'Tank' → baseDmg *= (1 + 0.5)` |
| `APDamage` ([0,10,15,25]) | ❌ **미반영** | `DAMAGE_VAR_PRIORITY` 에서 'ADDamage' 가 'APDamage' 보다 우선 → ADDamage 만 선택. APDamage 는 별도 추가 마법 피해 변수이나 ADDamage 에 가려 미선택 (AS·apScaling 과 무관). **Lint P2** |
| config `selfBuff` → **제거** (#204) | ✅ **#204 수정** | config 에서 `selfBuff` 제거 — raw 액티브는 물리 피해만(AS 버프 없음) + `duration` 미참조 매 cast ×1.5 누적 버그였음. 패시브 AS 는 getEffectiveAttackSpeed 전담 |

> config `selfBuff` 는 [[graves]] 와 같은 set16 Briar 광폭화 패턴 잔재였고, TFT17 raw 액티브엔 AS 버프 없음 → **#204 에서 제거** (패시브 AS 단위 fix 와 함께 AS 정합 완성).

### 3 trait — 동물특공대 / 태고족 / 불한당

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 태고족 (Primordian) | ✅ | `applyPrimordianEffects` (`:2166`) — 태고족 (3) DamageMultiplier 등. [[reksai]]/[[maokai]] 와 동일 trait |
| 불한당 (AssassinTrait) | ⚠️ adap ✅ / 은신 ❌ | scaling.json synergies `adap` [15,30,45,60] (AD/AP 획득) 일반 synergy 처리. 은신(체력 50% 이하 stealth, `healthThreshold`) 미반영 추정. **Lint P2** |
| 동물특공대 (AnimaSquad) | ❌ **미반영** | combatLoop / scaling.json synergies 모두 0 hit (itemRecommender 만). 동물특공대 trait 전투 효과 sim 부재. **Lint P2** |

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Briar 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ single 물리 피해 + 탱커 50% | `ability.ts:190` / `:6590` |
| **OOR (out-of-range dash)** | ➖ dash 없음 (single non-dash) | config dash 미지정 |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **패시브 잃은체력 AS (getEffectiveAttackSpeed) · 3 trait** 는 cast pipeline 과 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 650, armor/MR 35, AD 35, AS 0.75, range 1, mana 0/40)
- role Fighter (`mapGameRole('ADFighter')`)
- 패시브 잃은체력 비례 AS (getEffectiveAttackSpeed 동적, scaling.json + apScaling) — **#204 단위 fix** (잃은체력 50% → +100% AS, raw 정합)
- 액티브 물리 피해 (ADDamage sentinel filler ★1=120/★2=180/★3=285 scaleAD) + 탱커 50% 추가
- 태고족 (Primordian) trait

⚠️ **부정확 / 미반영** (Lint 후보):
- ✅ **#204 수정 완료**: 패시브 AS 단위 (`:3530` /100 제거) + config selfBuff 제거 — 잃은체력 50% → +100% AS (raw 정합), golden 5건 갱신
- **P2**: APDamage 미반영 (DAMAGE_VAR_PRIORITY ADDamage 우선)
- **P2**: 동물특공대 trait 전투 효과 미반영 (synergies/helper 없음)
- **P2**: 불한당 은신(healthThreshold stealth) 미반영

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ✅ #204 | 패시브 AS 단위 + selfBuff → **수정 완료** | `:3530` `/100` 이중 변환 제거 (scaling.json 값 percent-point 그대로) + config selfBuff 제거. 잃은체력 50% → +100% AS (raw "1%당 2%" 정합) | ~~P1+P2~~ resolved | runtime+config | 회귀 가드 `briar-passive-as.test.ts` + golden snapshot 5건 |
| P2 | APDamage 미반영 | ADDamage 만 DAMAGE_VAR_PRIORITY 선택. APDamage [0,10,15,25] 미참조 (desc scaleAD 만) | **P2** | cast-time — ModifiedDamage 에 APDamage 합산 여부 raw 확인 후 | minor (desc scaleAD 주력) |
| P2 | 동물특공대 trait 미반영 | AnimaSquad 전투 효과 sim 0 (synergies/helper 없음) | **P2** | trait — 동물특공대 synergy 효과 구현 | trait 차원 별도 (다수 동물특공대 champion 공통) |

> 📌 **패시브 AS(#204)+액티브 물리(ADDamage)+탱커 50% + 태고족 trait 는 sim 정합**. `partial` 잔존 사유는 APDamage·동물특공대·불한당 은신 (전부 P2) — 패시브 AS P1 + selfBuff 는 #204 해소.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Briar` apiName 확인 (cost 1, traits [동물특공대/태고족/불한당], role ADFighter, vars PercentMissingHealth/ADDamage/APDamage/PercentBonusDamage/AS)
- [x] **carry augment 유무 (Leona/Gragas 학습)** — `carryAugments.ts` grep 0 → carry augment 없음 (0-sub 단계 불요)
- [x] entity-wide grep `Briar` + `브라이어` + `물고기 광분` — sim site (config `:190` / getEffectiveAttackSpeed `:3527` / 탱커 50% `:6590` / 태고족)
- [x] raw stats 17.4 정합 (hp 650 / armor·MR 35 / AD 35 / AS 0.75 / mana 0·40 / range 1)
- [x] **raw role `ADFighter` → mapGameRole → Fighter** — `includes('Fighter')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — `getEffectiveAttackSpeed` briarSc 블록 (`:3527`, missingPct × asPerPct × apScale) + scaling.json Briar (asPerMissingHpPercent [2,2,2,2.5] apScaling) + selfBuff 처리 (`:7077`) + 탱커 50% (`:6590`) + DAMAGE_VAR_PRIORITY (`:392`)
- [x] **변수 filler 판정** — ADDamage [3.3,120,180,285] sentinel(v1/v0=36>5) filler → ★1=120/★2=180/★3=285 / APDamage [0,10,15,25] v0=0 filler / PercentMissingHealth/PercentBonusDamage 상수 / AS [2,2,2,2.5] no-filler (v0===v1)
- [x] **actual sim integration verify (5단계)** — **패시브 AS 단위: missingPct × asPerPct (scaling.json percent-point 그대로, `:3530` /100 제거) — #204 fix ✅** / ADDamage DAMAGE_VAR_PRIORITY 선택 (APDamage 미반영 P2) / 탱커 50% `:6590` 확인 / **config selfBuff 제거 — #204 fix ✅**
- [x] **cast path 3종 (PR #129 룰)** — main (single 물리 + 탱커 50% ✅, selfBuff 제거 #204) / OOR (dash 없음 ➖) / recast (carry 없음 ➖). 패시브 AS·trait 별개
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 태고족 `TFT17_Primordian` `applyPrimordianEffects` (`:2166`) ✅ / 불한당 `TFT17_AssassinTrait` scaling.json synergies adap ✅ 은신 ❌ (P2) / 동물특공대 `TFT17_AnimaSquad` combatLoop+synergies 0 → 미반영 (P2)
- [x] **본문 Lint P1 1건 + P2 4건 등록 → frontmatter `sim_active: partial`** (P1 sim 부정확 → 룰 #15)
- [x] **패시브 AS 단위(P1) + selfBuff 제거 → #204 수정 완료**
- [ ] (선택) APDamage / 동물특공대 trait sim 도입

## 관련

- [[role-passive]] — Fighter role 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `single` 단일 물리. cast path main only (dash 없음)
- [[reksai]] — 동일 태고족 (Primordian) trait. 1코 근접
- [[maokai]] — 동일 태고족. maxHp/passive 관련
- [[graves]] — getEffectiveAttackSpeed AS 동적 가산 (RevUp/GravBooster) 동일 함수. set16 Briar 광폭화 selfBuff 패턴
- 코드: `src/lib/simulator/systems/ability.ts:190/392`, `src/lib/simulator/engine/combatLoop.ts:2166/3527/6590`, `public/data/tft_set17_scaling.json` (Briar passive)
- Raw: `public/data/tft_set17_champions.json` (TFT17_Briar), `public/data/tft_set17_traits.json` (TFT17_AnimaSquad / TFT17_Primordian / TFT17_AssassinTrait)
