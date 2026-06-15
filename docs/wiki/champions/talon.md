---
id: talon
type: champion
display_name_kr: 탈론
api_name: TFT17_Talon
cost: 1
traits:
  - 별돌보미
  - 불한당
role: Assassin   # raw "ADReaper" → mapGameRole() → sim Assassin (types/index.ts includes('Reaper')). carry augment 없음
raw_role: ADReaper
current_patch_status: active
sim_active: partial   # active 점술가의 심판 bleed DOT(ADBleedDamage scaleAD, BleedDuration 18초, burn statusEffect) — dealer totalDamageDealt 귀속 PR #234(이전 burn 미크레딧으로 -79% under 였음) + dash + 별돌보미/불한당 trait. P2: APBleedDamage(scaleAP) 미반영 (dot damageVar ADBleedDamage 만) / P2: dash 'to_target'(현재 타겟) vs raw "공격 후 3칸 내 최고 체력 적 도약". 잔여 under ~-70% (18초 bleed 가 전투 duration 동안 부분 전달 + scaleAP 누락 + 생존)
last_verified: 2026-06-15
sources:
  - "public/data/tft_set17_champions.json (TFT17_Talon entry — cost 1, role ADReaper, traits [별돌보미/불한당], mana 0/30, ability '점술가의 심판' variables HexDistance/BleedDuration/ADBleedDamage/APBleedDamage)"
  - "public/data/tft_set17_traits.json (TFT17_Stargazer = 별돌보미 / TFT17_AssassinTrait = 불한당)"
  - "src/types/index.ts (mapGameRole — 'ADReaper' includes 'Reaper' → Assassin)"
  - "src/lib/simulator/systems/ability.ts:198 (TFT17_Talon: { pattern: 'single', dash: 'to_target', dot: { duration: 18 } })"
  - "src/lib/simulator/engine/combatLoop.ts:6672 (dot 처리 — abilityDmg(ADBleedDamage) 를 BleedDuration 초 burn statusEffect 로 spread) / tickStatusEffects burn per-tick dealer 크레딧 (PR #234)"
  - "src/lib/simulator/systems/trait.ts:111-126 (별돌보미 constellation variant 선택)"
  - "src/lib/simulator/engine/combatLoop.ts:3238 (applyStargazerEffects 별돌보미 효과 적용, 호출 :4714) + :564 (불한당 AssassinTrait AD/AP 시너지)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[twistedfate]]"
  - "[[xayah]]"
  - "[[kaisa]]"
  - "[[briar]]"
---

# 탈론 (Talon)

## 요약

1코스트 **별돌보미 (`TFT17_Stargazer`)** + **불한당 (`TFT17_AssassinTrait`)** trait. raw role `ADReaper`.

- **role**: `mapGameRole('ADReaper')` → sim **Assassin** (`includes('Reaper')`, [[role-passive]]). carry augment 없음. mana 0/30.
- **ability "점술가의 심판"**: 대상에 `BleedDuration`(18)초 동안 `ADBleedDamage`(scaleAD scaleAP) 물리 출혈(bleed DOT) + 공격 후 `HexDistance`(3)칸 내 체력 비율 최고 적에게 도약(dash).

> 🎯 **Talon 은 bleed DOT 암살자** — under-damage 재진단(2026-06-15)에서 **burn DOT 미크레딧 버그**의 대표 사례로 발견(−79%). bleed 가 `burn` statusEffect 로 적용되나 dealer `totalDamageDealt` 미집계였음 → **PR #234 로 burn DOT per-tick 크레딧** (Talon/Bard/Viktor 등 burn-DOT 챔프 systemic fix). 잔여 −70% (scaleAP 누락 + 18초 bleed 부분 전달).

> ⚠️ **set17 entity confirm**: `TFT17_Talon` apiName 으로 소속 확인 (cost 1, traits 별돌보미/불한당, role ADReaper). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

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
| initialMana / mana | 0 / 30 |

### Role — Assassin

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Assassin** | 2 | 10 | 0 | ❌ | `mapGameRole('ADReaper')` includes 'Reaper' → Assassin (`types/index.ts`, [[role-passive]]) |

### Active — 점술가의 심판 bleed DOT (`ability.ts:198`)

raw desc: "대상을 찔러 `@BleedDuration@`(18)초 동안 `@ModifiedBleedDamage@`(scaleAD scaleAP) **물리** 출혈. 공격 후 `@HexDistance@`(3)칸 내 체력 비율 최고 적에게 도약."

raw variables: `HexDistance` [3] / `BleedDuration` [18] / `ADBleedDamage` [2.5,430,645,1000,...] / `APBleedDamage` [0,60,90,135,...]

**sim 적용** (`ability.ts:198`):
```ts
TFT17_Talon: { pattern: 'single', dash: 'to_target', dot: { duration: 18 } }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 출혈 피해 (`ADBleedDamage`, scaleAD) | ✅ | `:6672` dot 처리 — `abilityDmg`(`ADBleedDamage` filler ★1=430/★2=645/★3=1000) 를 `BleedDuration`(18)초 동안 `burn` statusEffect 로 spread (MR mitigate 후 perTick). desc `<physicalDamage>` → physical |
| **bleed DOT dealer 귀속** | ✅ **PR #234** | 이전 burn tick(`:3531`)이 target HP 만 차감, dealer `totalDamageDealt` 미집계 → calibration −79% under. **PR #234**: tickStatusEffects burn/poison 통합 per-tick `dotSrc.totalDamageDealt` + `victim.totalDamageTaken` 귀속 + lethal source-aware 사망 |
| 출혈 scaleAP (`APBleedDamage`) | ❌ **미반영** | dot `abilityDmg` = `getAbilityDamage` default → `ADBleedDamage` 만 (DAMAGE_VAR_PRIORITY 'Damage' 부분매칭). `APBleedDamage` (filler ★1=60) 미참조. raw bleed = scaleAD+scaleAP 인데 sim 은 scaleAD 만. **Lint P2** (raw `<physicalDamage>` → 합산 시 magic 아님, physical) |
| 도약 (`HexDistance` 3, 최고 체력 적) | ⚠️ **dash 대상 차이 + 데미지 결합** | sim `dash: 'to_target'` = 현재 타겟으로 dash. ⚠️ cast resolution 이 `applyAbilityDash` → `findAbilityTargets` 순서(`:6628-6637`, OOR `:7365-7373`)라 **dash 반환 타겟이 곧 DOT 대상**. raw 는 "**현재 타겟에 bleed 적용 후** 3칸 내 최고 체력 적 도약" → 데미지 타겟(현재)과 post-hit dash 타겟(최고체력)이 **분리**돼야 함. **Lint P2** |

> ⚠️ **잔여 under ~-70%** (PR #234 로 −79%→−70% 개선 후): ① `APBleedDamage`(scaleAP) 누락 ② 18초 bleed 가 전투 duration(보통 <18초) 동안 부분만 전달 (게임도 전투 종료 시 cut 되나 sim survival/duration 차이) ③ dash 재타겟 차이. 추가 모델 후속.

### 별돌보미 (`TFT17_Stargazer`) / 불한당 (`TFT17_AssassinTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 별돌보미 (Stargazer) | ✅ | constellation variant 선택 (`trait.ts:111-126`) + 효과 적용 `applyStargazerEffects` (`combatLoop.ts:3238`, 호출 `:4714`). 제단/우물 game-level 은 [[stargazer-fountain]] (17.4 full active) |
| 불한당 (Assassin / `TFT17_AssassinTrait`) | ✅ | `:564` 불한당 AD/AP 시너지 (`applySet17SynergyBuffs`, leading-0 off-by-one PR #185 수정). Talon 불한당 멤버 ([[kaisa]]/[[briar]] 동일) |

> 룰 #16/#19: 두 trait 모두 generic 경로 존재 — champion-specific 구현 불필요하나 grep 재검증.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Talon 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active single + dash + dot(bleed) | `ability.ts:198`, `combatLoop.ts:6672` (dot) |
| **OOR (out-of-range)** | ✅ Talon dash user — OOR cast 시 dot 분기 (`:7505` outOfRangeConfig.dot) | `:7505-7513` |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> bleed DOT 의 dealer 크레딧/사망은 `tickStatusEffects` (per-tick, PR #234). 별돌보미/불한당 trait 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 650, armor/MR 35, AD 35, AS 0.75, range 1, mana 0/30)
- role Assassin (`mapGameRole('ADReaper')`)
- **active bleed DOT** (ADBleedDamage scaleAD, 18초 burn statusEffect) + **dealer 크레딧 (PR #234)**
- dash (to_target)
- **별돌보미 (Stargazer)** + **불한당 (AssassinTrait AD/AP)** trait

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: `APBleedDamage`(scaleAP) 미반영 — dot damageVar `ADBleedDamage` 만 (bleed = scaleAD+scaleAP)
- **P2**: dash `'to_target'`(현재 타겟) vs raw "3칸 내 체력 최고 적 도약" — 대상 선택 차이
- ℹ️ 잔여 under ~-70% (18초 bleed 부분 전달 + scaleAP 누락 + 생존/dash). PR #234 로 -79%→-70%

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ✅ resolved | bleed DOT dealer 미크레딧 | burn DOT 가 totalDamageDealt 미집계던 −79% 주원인 | **resolved (PR #234)** | tickStatusEffects per-tick dealer/victim 귀속 + lethal 사망 | systemic burn 크레딧 fix (Talon/Bard/Viktor 등). −79→−70% |
| P2 | APBleedDamage scaleAP 미반영 | dot `abilityDmg` = ADBleedDamage 만, APBleedDamage(scaleAP) 미참조. raw bleed = scaleAD+scaleAP physical | **P2** | cast-time — dot abilityDmg 에 APBleedDamage×ap 합산 (physical, magic 아님) | scaleAP 누락 (소량, filler ★1=60) |
| P2 | dash 대상 선택 차이 (+ 데미지 타겟 결합) | sim `to_target`(현재) vs raw "현재 타겟 bleed 후 3칸 내 최고체력 도약". ⚠️ `applyAbilityDash` 가 `findAbilityTargets` 보다 먼저라 dash 타겟=DOT 대상 | **P2** | dash — **데미지 타겟(현재)과 post-hit dash 타겟(highest-HP)을 분리** 필요. dash retarget 모드만 추가하면 bleed 가 점프 타겟으로 이동돼 오류 (codex P2 PR #235) | 도약 대상 부정확. 분리 구현 필요 |

> 📌 **bleed DOT(ADBleedDamage scaleAD) + dealer 크레딧(PR #234) + 별돌보미/불한당 trait 반영**. `partial` 사유는 APBleedDamage scaleAP 미반영 + dash 재타겟 차이 P2 + 잔여 under(bleed 18초 부분전달). burn 크레딧 systemic fix 로 −79→−70% 개선.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Talon` apiName 확인 (cost 1, traits [별돌보미/불한당], role ADReaper)
- [x] entity-wide grep `Talon` + `Bleed`/`dot`/`Stargazer`/`AssassinTrait` — sim site (ability.ts:198 dot / combatLoop dot :6672 / burn 크레딧 PR #234 / 별돌보미·불한당)
- [x] raw stats 17.4 정합 (hp 650 / armor·MR 35 / AD 35 / AS 0.75 / range 1 / mana 0·30)
- [x] **raw role `ADReaper` → mapGameRole → Assassin** — `includes('Reaper')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — dot 처리 (`:6672` abilityDmg→burn spread) + tickStatusEffects burn per-tick 크레딧 (PR #234) + active config (`ability.ts:198` single/dash/dot)
- [x] **변수 filler 판정** — ADBleedDamage `[2.5,430,645,1000]` v0>v1 filler ★1=430/★2=645/★3=1000 / APBleedDamage `[0,60,90,135]` v0=0 filler ★1=60 (단 미반영) / HexDistance·BleedDuration 상수
- [x] **actual sim integration verify (5단계)** — dot abilityDmg = ADBleedDamage(scaleAD) burn spread read 확인 (`:6672`) / **burn dealer 크레딧 PR #234 (tickStatusEffects)** / **`APBleedDamage` dot 미참조 → scaleAP 미반영 P2** / **dash 'to_target' vs raw 최고체력 retarget P2** / 잔여 under ~-70% empirical(diff-cache Talon)
- [x] **cast path 3종 (PR #129 룰)** — main (single+dash+dot ✅) / OOR (dash user dot 분기 `:7501` ✅) / recast (carry 없음 ➖)
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 별돌보미 `TFT17_Stargazer` constellation (`trait.ts:111`) ✅ / 불한당 `TFT17_AssassinTrait` AD/AP 시너지 (`:564`) ✅. "verify 면제" 어휘 미사용
- [x] **trait cross-ref 멤버십 verify** (Fiora #226 Aatrox 오링크 학습) — 별돌보미 [[twistedfate]]/[[xayah]] + 불한당 [[kaisa]]/[[briar]] raw traits 실재 확인
- [x] **bleed DOT 크레딧 회귀 가드** — `tests/unit/simulator/talon-bleed-credit.test.ts` (PR #234, Talon★3 totalDamageDealt >1500)
- [x] **본문 Lint P2 2건 + resolved 1건(burn 크레딧 #234) → 보수적 `sim_active: partial` 유지** (P0 회귀 case 없음 → 룰 #15 미해당)
- [ ] (선택) APBleedDamage scaleAP 합산 / dash 최고체력 retarget (P2)

## 관련

- [[role-passive]] — Assassin role 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `single` + dash(to_target) + dot(bleed). cast path main/OOR (dash user)
- [[twistedfate]] / [[xayah]] — 동일 별돌보미 (Stargazer) trait (멤버)
- [[kaisa]] / [[briar]] — 동일 불한당 (AssassinTrait) trait (멤버)
- under-damage calibration (메모리 `project_underdamage_calibration`) — Talon 이 burn DOT 미크레딧(#234) 발견 계기 + 잔여 −70% (under-damage 최대 gap 챔프)
- 코드: `src/lib/simulator/systems/ability.ts:198`, `src/lib/simulator/engine/combatLoop.ts:6672/3531`, `src/lib/simulator/systems/trait.ts:111`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Talon), `public/data/tft_set17_traits.json` (TFT17_Stargazer / TFT17_AssassinTrait)
- 테스트: `tests/unit/simulator/talon-bleed-credit.test.ts`
