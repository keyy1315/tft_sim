---
id: vex
type: champion
display_name_kr: 벡스
api_name: TFT17_Vex
cost: 5
traits:
  - 파멸자
role: Marksman   # raw "APCarry" → mapGameRole() → sim Marksman (types/index.ts:43 includes('Carry')). ⚠️ 실제 AP 메이지지만 mapGameRole string-match 가 Carry → Marksman 으로 분류 (Caster 아님). carry augment 없음 → role 변환 분기 없음
raw_role: APCarry
current_patch_status: active (17.4 데이터 기준 — 17.5/17.5b patch pending: Spell Damage AP 130/195→140/210 (buff). 데이터/sim 미반영, [[patch-17-5]] 참조)
sim_active: partial   # passive 그림자(ShadowHandDamage scaleAP + spread + amp + lethal) / active 강화타격(ShadowHandMagicDamage scaleAP hitCount 3 split, spell crit 가능) / 파멸자(VexUniqueTrait ADAP 12% 강탈 양팀 snapshot) 핵심 정합. P2 passive NumStrikesForPassive=5 그림자 재타격 미반영 (grep 0 read) / P2 파멸자 표식 트리거 단순화 (combat-start 즉시 일괄 강탈, "적 첫 피해 시" 표식 소모 생략) / P2 active "강화 타격 3회" desc vs sim aoe_circle split (총피해 base×3 / aliveTargets 분배) + NumActiveStrikes raw var 직접 read 아님 (hardcoded 3) / P2 passive "주변 적" spread = 최근접 1명 보수 해석 (raw 반경 변수 없음) / P2 passive 그림자 spell crit 미지원 (평타 hook crit 분기 부재, active cast :6581 만 crit, codex PR #183)
last_verified: 2026-06-02
sources:
  - "public/data/tft_set17_champions.json (TFT17_Vex entry — cost 5, role APCarry, traits [파멸자], ability '그림자야, 도와줘!' variables ShadowHandDamage/ShadowHandMagicDamage/NumActiveStrikes/NumStrikesForPassive)"
  - "public/data/tft_set17_traits.json (TFT17_VexUniqueTrait = 파멸자 — 단일 unique trait minUnits 1, ADAP1 12)"
  - "src/types/index.ts:43 (mapGameRole — 'APCarry' includes 'Carry' → Marksman. Tank/Reaper 우선 체크 미매치)"
  - "src/lib/simulator/systems/mana.ts:25 (Marksman manaPerAttack 10 / manaPerSecond 0 / manaFromDamage false)"
  - "src/lib/simulator/systems/ability.ts:256 (TFT17_Vex active config: { pattern: 'aoe_circle', radius: 1, damageVar: 'ShadowHandMagicDamage', hitCount: 3 })"
  - "src/lib/simulator/engine/combatLoop.ts:6005-6050 (passive 그림자 — 평타마다 ShadowHandDamage scaleAP, target + 최근접 1명 spread, target-conditional amp + applyAbilityMitigation magic + markTargetDead lethal)"
  - "src/lib/simulator/engine/combatLoop.ts:6437/6485 (hitCount split — hitCountTotal = rawAbilityDmg × config.hitCount, aoe_circle(≠single) → isSplitDamage → hitCountTotal / aliveTargets.length 분배)"
  - "src/lib/simulator/engine/combatLoop.ts:6581 (active cast spell crit 분기 — spellCanCrit && rng < critChance → ×critMultiplier. passive 평타 hook :6022-6030 에는 동일 분기 부재 → passive 비크리, codex PR #183 P2)"
  - "src/lib/simulator/engine/combatLoop.ts:1547-1601 (applyVexDoomBothSides — 파멸자 ADAP1 12% 강탈, 양팀 snapshot 동시 처리 codex P1 PR #60, combat-start 즉시 일괄, findStrongestUnitByApi)"
  - "src/lib/simulator/engine/combatLoop.ts:4577 (applyVexDoomBothSides 호출 — combat-start, 다른 unique trait 와 동위치)"
  - "src/lib/simulator/engine/combatLoop.ts:172-182 (readVarByStar filler 판정 — v0>v1 또는 v1/v0>5 → filler, idx=starLevel)"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[spell-crit]]"
  - "[[zed]]"
  - "[[jhin]]"
---

# 벡스 (Vex)

## 요약

5코스트 **파멸자 (`TFT17_VexUniqueTrait`)** 단일 unique trait. raw role `APCarry`.

- **role**: `mapGameRole('APCarry')` → sim **Marksman** ([[role-passive]]). 실제 AP 메이지이나 `mapGameRole` string-match 가 `Carry` → Marksman 으로 분류 (Caster 아님). carry augment 없음 → role 변환 분기 없음.
- **ability "그림자야, 도와줘!"**: 그림자 메커니즘 — **passive (평타마다 그림자 추가 magic 피해)** + **active (강화 타격 3회)** 2단계.
- **파멸자 trait**: 전투 시작 시 적 전체 AD/AP 12% 강탈 → 가장 강한 아군 벡스에게 부여 (양팀 snapshot 동시 처리로 order bias 제거).

> 🎯 **Vex 는 "강탈형 스케일링" carry** — 파멸자로 적 AD/AP 12% 를 가져와 자기 AP 로 누적 + 평타마다 그림자 scaleAP 추가타. [[zed]] (은하계 사냥꾼 self-buff +40% AD) 와 같은 **단일 unique trait** 패턴이나, Zed 는 self-buff·Vex 는 적 stat 강탈이라 방향이 반대.

> ⚠️ **set17 entity confirm**: `TFT17_Vex` apiName 으로 소속 확인 (cost 5, traits [파멸자], role APCarry). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 900 |
| armor / magicResist | 40 / 40 |
| damage | 15 |
| attackSpeed | 0.8 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 60 |

### Role — Marksman (mapGameRole 분류)

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Marksman** | 1 | 10 | 0 | ❌ | `mapGameRole('APCarry')` includes 'Carry' (`types/index.ts:43`), `mana.ts:25` |

> ⚠️ Vex 는 desc 상 AP 메이지(그림자 마법 피해)이나 raw role 이 `APCarry` 라 `mapGameRole` 의 `includes('Carry')` 분기에서 **Marksman** 으로 매핑된다 (`Caster` 분기는 `includes('Caster')` 이라 미매치). sim 상 role 효과는 Marksman 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌). carry augment 가 없어 role 변환은 발생하지 않음.

### Passive — 그림자 추가 타격 (`combatLoop.ts:6005-6050`)

raw desc: "벡스가 기본 공격을 가할 때마다 그림자가 주변 적을 타격해 `@ModifiedShadowHandDamage@`(scaleAP)의 마법 피해를 입힙니다. 적이 그림자에게 `@NumStrikesForPassive@`회 타격당할 때마다 그림자가 해당 적을 다시 타격합니다."

raw variables: `ShadowHandDamage` [2.5, 30, 45, 250, 1000, 2.5, 2.5] / `NumStrikesForPassive` [5, ...].

**sim 적용** (평타 hook, `combatLoop.ts:6016` `apiName === 'TFT17_Vex'` 분기):

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 평타마다 그림자 magic 피해 (`ShadowHandDamage`, scaleAP) | ✅ | `readVarByStar(ShadowHandDamage)` × `apFactor (1+ap/100)`. ★1=30 / ★2=45 / ★3=250 (`[2.5,30,45,250,...]` v1/v0=12>5 → filler) |
| "주변 적" 타격 | ⚠️ **최근접 1명 spread (보수 해석)** | `applyShadow(target)` (평타 대상) + alive 다른 적 중 **Vex 본인 기준 가장 가까운 1명** (`:6040-6049`). raw 에 명시적 반경 변수 없어 1명 한정 (codex P1 PR #101 옵션 c). **Lint P2** |
| target-conditional amp | ✅ | invention / madreds / graves Tank amp (victim Tank 시) + `computeSniperDamageAmp` 모두 평타와 동일 (`:6025-6028`, codex P2 PR #101) |
| 피해 적용 | ✅ | `applyAbilityMitigation(..., 'magic')` → currentHp 차감 + lethal 시 `markTargetDead` (중재자/arbiter state 연계, `:6036`) |
| spell crit | ❌ **미지원** | 평타 hook `applyShadow` (`:6022-6030`) 는 `spellCanCrit` 분기 없이 amp → `applyAbilityMitigation` 직접 호출. active cast (`:6581`) 와 달리 crit roll 부재 → 운명술사/spell-crit item 셋업 시에도 passive 는 비크리. **Lint P2** (codex PR #183) |
| 적 `NumStrikesForPassive`(5)회 누적 시 그림자 **재타격** | ❌ **미반영** | `NumStrikesForPassive` repo-wide grep **0 read** (주석 line 만). 적 누적 타격 카운트 → 재타격 메커니즘 sim 부재. **Lint P2** |

### Active — 강화 타격 (`ability.ts:256`)

raw desc: "사용 시: 그림자가 강화 타격을 `@NumActiveStrikes@`(3)회 날려 대신 `@ModifiedShadowHandMagicDamage@`(scaleAP)의 마법 피해를 입힙니다."

raw variables: `ShadowHandMagicDamage` [200, 130, 195, 1000, 9999, 200, 200] / `NumActiveStrikes` [3, ...].

**sim 적용** (`ability.ts:256`):
```ts
TFT17_Vex: { pattern: 'aoe_circle', radius: 1, damageVar: 'ShadowHandMagicDamage', hitCount: 3 }
```

| desc 요소 | sim 적용 | 비고 |
|-----------|---------|------|
| 강화 타격 damage (`ShadowHandMagicDamage`, scaleAP) | ✅ `damageVar` | `resolveAbilityDamage` → `getAbilityDamage(..., config.damageVar)` (`:6299-6301`). ★1=130 / ★2=195 / ★3=1000 (`[200,130,195,1000,...]` v0>v1 → filler) |
| 타격 3회 (`NumActiveStrikes`) | ⚠️ `hitCount: 3` (**hardcoded**) | `NumActiveStrikes` raw var 직접 read 아님 — config 에 값 3 만 하드코딩 (grep 0 read). 값은 raw 와 일치하나 데이터 변경 시 drift 가능 |
| 3회 × AOE | ⚠️ **split damage** | `hitCountTotal = rawAbilityDmg × 3` (`:6437`) 후 `aoe_circle`(≠single) → `isSplitDamage` (`:6438`) → **`hitCountTotal / aliveTargets.length` 로 타겟 수 분배** (`:6485`). "3회 타격" 의 의미가 sim 상 "base×3 총피해를 반경 1칸 적에게 분배" 로 처리됨 (Kaisa/Corki 동일 AOE hitCount 컨벤션). **Lint P2** |

> active 강화타격은 `aoe_circle radius 1` 라 반경 1칸 내 적에게 총피해(base×3)를 분배한다. 단일 타겟만 있으면 전부 그 타겟에 적중 = base×3, 여러 적이면 나눠짐. desc 의 "3회 타격" 직역(타겟당 3회)과는 다른 sim 해석.

> ✅ **active 는 spell crit 가능** — cast loop (`combatLoop.ts:6581`) `if (unit.spellCanCrit && rng.next() < critChance) dmg *= critMultiplier`. 운명술사 trait / SharpshooterModule / spell-crit item 으로 `spellCanCrit` 활성 시 active 강화타격 크리. **단 passive 그림자는 동일 분기 없어 비크리** (위 passive 표 참조, codex PR #183 P2).

### 파멸자 (`TFT17_VexUniqueTrait`) trait — 적 AD/AP 강탈

raw desc: "전투 시작: 모든 적에게 파멸 표식을 남깁니다. 각 전투에서 적이 처음으로 피해를 입으면 파멸 표식이 소모되고 해당 적의 공격력과 주문력을 `@ADAP1@`%만큼 강탈해 가장 강한 아군 벡스에게 부여합니다."

raw effects: 단일 effect (style 4, minUnits 1) `ADAP1` = 12 (12%). **단일 unique trait** — 벡스 1명만 있으면 활성.

**sim 적용** (`applyVexDoomBothSides` `combatLoop.ts:1547-1601`, 호출 `:4577`):

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| 적 전체 AD/AP 12% 강탈 → 벡스 가산 | ✅ | 적군 각 unit `stats.damage`/`stats.ap` × 12% 차감 후 합산 → `findStrongestUnitByApi(TFT17_Vex)` 에 가산 (`:1593-1600`) |
| 가장 강한 아군 벡스 | ✅ | `findStrongestUnitByApi(playerUnits, 'TFT17_Vex')` (`:1555`) — 복수 벡스 시 가장 강한 1명 수령 |
| 양팀 동시 처리 (order bias 제거) | ✅ | snapshot 단계 (원본 stats 기반 강탈량 계산) → apply 단계 (차감+가산) 분리. **codex P1 PR #60**: 순차 호출 시 두 번째 Vex 가 이미 차감된 stats 에서 강탈 → deterministic player advantage 회귀 방지 (`:1562-1592`) |
| "각 전투에서 적이 처음 피해 입으면 표식 소모" 트리거 | ⚠️ **combat-start 즉시 일괄 강탈 (단순화)** | sim 은 표식(damage 트리거) 메커니즘 생략, combat-start 시 모든 적이 hit 받음 가정하고 즉시 강탈 (`:1545` 주석). 적이 피해 전 사망하는 edge case 외엔 결과 동일. **Lint P2 (의도된 단순화)** |

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Vex 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active 강화타격 (aoe_circle, ShadowHandMagicDamage, hitCount 3 split) | `ability.ts:256`, `combatLoop.ts:6299/6437/6485` |
| **OOR (out-of-range dash)** | ➖ 사실상 무관 — Vex active 는 `dash` 없음 + range 6 (장거리). OOR fallback config (`:7147`) 는 동일 `getAbilityConfigForUnit` 라 진입 시 동일 damageVar 사용하나, dash 없는 aoe_circle 이라 OOR dash 경로 진입 빈도 극히 낮음 | `:7147` (동일 config helper) |
| **recast (onKill)** | ➖ 없음 — onKill recast 는 carry augment (Pyke 등) 전용. Vex 는 carry augment 없음 (`VexCarry` grep 0) | — |

> **passive 그림자** (`:6005-6050`) 는 cast pipeline 이 아닌 **평타 hook** 이라 위 3종과 별개 경로다. 평타가 적중할 때마다 발동하며 active cast 와 독립적으로 작동.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 900, armor/MR 40, AD 15, AS 0.8, mana 0/60, range 6)
- role Marksman (`mapGameRole('APCarry')`) + Marksman 마나 규칙
- passive 그림자 — 평타마다 ShadowHandDamage scaleAP (★1=30/★2=45/★3=250) + target-conditional amp (invention/madreds/graves Tank + sniper) + magic mitigation + lethal markTargetDead
- active 강화타격 — ShadowHandMagicDamage scaleAP (★1=130/★2=195/★3=1000) × hitCount 3, aoe_circle split (총피해/타겟수 분배)
- **파멸자 trait** — 적 AD/AP 12% 강탈 → 가장 강한 벡스 가산, 양팀 snapshot 동시 처리 (PR #60 order bias 제거)

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: passive `NumStrikesForPassive`(5)회 누적 시 그림자 재타격 미반영 (grep 0 read — passive 추가 DPS 메커니즘 부재)
- **P2**: 파멸자 표식 트리거 단순화 — combat-start 즉시 일괄 강탈 (desc "적 첫 피해 시 표식 소모" 트리거 생략)
- **P2**: active "강화 타격 3회" desc vs sim aoe_circle split (총피해 base×3 / aliveTargets 분배). `NumActiveStrikes` raw var 직접 read 아님 (hitCount 3 하드코딩)
- **P2**: passive "주변 적" spread = 최근접 1명 보수 해석 (raw 반경 변수 없음, PR #101 옵션 c)
- **P2**: passive 그림자 spell crit 미지원 — 평타 hook (`:6022-6030`) 이 crit 분기 없이 mitigation 직접 호출. active cast (`:6581`) 만 spell crit 가능 (codex PR #183)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P2 | passive `NumStrikesForPassive`(5) 재타격 미반영 | 적이 그림자에 5회 누적 타격 시 그림자 재타격 — 누적 카운트 + 재발동 메커니즘 부재. `NumStrikesForPassive` grep 0 read | **P2** | (b) attack-hook — victim별 그림자 누적 카운터 + 5 도달 시 재타격. 추가 passive DPS | 평타 빈도 높을수록 영향 ↑. base config 평타 그림자만 반영. 인게임 비중 측정 후 결정 |
| P2 | 파멸자 표식 트리거 단순화 | desc "각 전투에서 적이 처음 피해 입으면 표식 소모 강탈" vs sim combat-start 즉시 일괄. 적이 피해 전 사망 시 강탈 못하는 게 정확 | **P2** | (a) combat-start — 현재 즉시 일괄. 정확히는 첫 피해 트리거 deferred steal | 의도된 단순화 (`:1545` 주석). 대부분 적이 피해 받으므로 결과 동일. edge case 한정 |
| P2 | active hitCount 3 split vs "3회 타격" | sim `hitCount 3` × aoe_circle → 총피해 base×3 을 aliveTargets 로 분배. desc "강화 타격 3회" 직역과 해석 차이. `NumActiveStrikes` raw var 미read (하드코딩 3) | **P2** | AOE hitCount 컨벤션 (Kaisa/Corki 동일). 데이터 변경 시 drift 가능성 — `NumActiveStrikes` 동적 read 검토 | sim AOE 컨벤션 일관. 값 raw 와 일치. 문서 명시로 처리 |
| P2 | passive "주변 적" = 최근접 1명 | raw "주변 적" 명시 반경 변수 없어 평타 target + 가장 가까운 1명 한정 (보수) | **P2** | (b) attack-hook — 반경 기반 spread 검토. 단 raw 반경 변수 부재로 추정 위험 | codex P1 PR #101 옵션 c 결정. raw 변수 확정 시 재검토 |
| P2 | passive 그림자 spell crit 미지원 | 평타 hook (`:6022-6030`) 이 `spellCanCrit` 분기 없이 `applyAbilityMitigation` 직접 호출 → active cast (`:6581`) 와 달리 운명술사/spell-crit item 셋업 시에도 passive 비크리. **codex PR #183 catch** (당초 본문 "active/passive 모두 crit 가능" 오기) | **P2** | (b) attack-hook — passive 에 active 와 동일 `if (spellCanCrit && rng.next() < critChance) raw *= critMultiplier` 분기 추가 검토. 단 게임 내 passive crit 여부 raw 미명시 — 인게임 측정 후 결정 | sim ground truth 기준 현재 passive 비크리. 효과 주장 시 actual integration verify (read site 확인) 누락 self-lint 사례 |

> 📌 **passive·active·파멸자 trait 핵심은 sim 정합**: 평타 그림자(scaleAP+amp+lethal) / active 강화타격(scaleAP×3 split) / 파멸자 ADAP 12% 강탈(양팀 snapshot) 모두 코드 ground truth 와 일치. Lint 후보는 모두 P2 (추가 메커니즘 미반영 / 단순화 / 컨벤션 해석) — 메인 딜링 파이프라인 영향 제한적.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Vex` apiName 확인 (cost 5, traits [파멸자], role APCarry)
- [x] entity-wide grep `Vex` + `벡스` + `파멸자` + `VexUniqueTrait` — sim site (passive 그림자 / active config / applyVexDoomBothSides / markTargetDead 연계)
- [x] raw stats 17.4 정합 (hp 900 / armor·MR 40 / AD 15 / AS 0.8 / mana 0·60 / range 6)
- [x] **raw role `APCarry` → mapGameRole → Marksman** — `includes('Carry')` 분기 (`types/index.ts:43`), Caster 아님 명시. carry augment 없음 → 변환 없음 (`VexCarry` grep 0)
- [x] **함수 컨텍스트 read (2단계)** — `applyVexDoomBothSides` 전체 (snapshot/apply 2단계, 양팀 동시) + passive 그림자 블록 (`applyShadow` helper + spread + amp + lethal)
- [x] **변수 filler 판정** — `ShadowHandDamage` [2.5,30,45,250] v1/v0>5 → filler ★1=30/★2=45/★3=250 / `ShadowHandMagicDamage` [200,130,195,1000] v0>v1 → filler ★1=130/★2=195/★3=1000 (`readVarByStar:172-182`)
- [x] **actual sim integration verify (5단계)** — active damageVar `ShadowHandMagicDamage` 가 `resolveAbilityDamage`(`:6299`) → `getAbilityDamage(config.damageVar)`(`:686`) main pipeline read 확인. passive `ShadowHandDamage` 평타 hook read 확인. **`NumStrikesForPassive` / `NumActiveStrikes` grep 0 read → 미반영/하드코딩 확인** (효과 주장 전 read site 검증)
- [x] **spell crit read site verify (codex PR #183 catch 반영)** — active cast loop (`:6581`) `spellCanCrit && rng < critChance` 분기 존재 / passive 평타 hook (`:6022-6030`) 동일 분기 **부재** → **active 만 crit, passive 비크리**. 당초 본문 "active/passive 모두 crit 가능" 오기 정정 (효과 주장 시 read site 확인 누락 self-lint)
- [x] **cast path 3종 (PR #129 룰)** — main (active aoe_circle ✅) / OOR (dash 없음 ➖) / recast (carry 없음 ➖). passive 그림자는 평타 hook 별개 경로 명시
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 파멸자 `applyVexDoomBothSides`(`:1547`, 호출 `:4577`) ✅ 정상 통합. 단일 unique trait (minUnits 1)
- [x] **본문 Lint P2 4건 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [ ] (선택) passive `NumStrikesForPassive` 재타격 / active `NumActiveStrikes` 동적 read 인게임 영향 측정 후 sim 도입 검토

## 관련

- [[role-passive]] — Marksman role 마나·타게팅 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `aoe_circle` 패턴 + hitCount split (총피해/타겟수 분배). cast path 3종 (Vex 는 main 중심, dash/recast 없음)
- [[spell-crit]] — Vex **active 강화타격만** spell crit 가능 (`combatLoop.ts:6581` cast loop `spellCanCrit` 분기). **passive 그림자는 spell crit 미지원** — 평타 hook (`:6022-6030`) 이 crit 분기 없이 `applyAbilityMitigation` 직접 호출 → 운명술사/spell-crit item 셋업 시 passive 는 비크리 (codex PR #183 P2)
- [[zed]] — 동일 단일 unique trait 패턴 (은하계 사냥꾼 self-buff +40% AD vs 파멸자 적 stat 강탈)
- [[jhin]] — 동일 hitCount multi-strike ability (Jhin APDamage ×4 multi vs Vex ShadowHandMagicDamage ×3 aoe split)
- 코드: `src/lib/simulator/systems/ability.ts:256`, `src/lib/simulator/engine/combatLoop.ts:1547/4577/6005/6437`, `src/types/index.ts:43`, `src/lib/simulator/systems/mana.ts:25`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Vex), `public/data/tft_set17_traits.json` (TFT17_VexUniqueTrait)
