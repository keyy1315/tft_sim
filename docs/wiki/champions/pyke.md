---
id: pyke
type: champion
display_name_kr: 파이크
api_name: TFT17_Pyke
cost: 2
traits:
  - 초능력
  - 여행자
role: Assassin   # raw "ADReaper" → mapGameRole() → sim Assassin (types/index.ts:42 includes('Reaper')). ⚠️ TFT17_Augment_PykeCarry 활성 시 Fighter 로 변환 (applyHeroCarryTransforms, statOverrides.role 없으면 default Fighter)
raw_role: ADReaper
current_patch_status: active
sim_active: partial   # carry 청부 살인마 (X-shape + onKill recast cascade + tankBonus + secondary) 정합 / 여행자(FlexTrait) trait 정합. P1 base "죽음의 표식" 작살 단계(SpearDamage scaleAP) sim 부재 (repo grep 0 hit) — base config 는 TargetDamage(scaleAD)/AoEDamage(scaleAD) 만 / P2 base desc "가장 먼 적" vs config dash 'to_target' targeting 불일치 / P2 base 작살 pull(1칸 끌어당김) 메커니즘 미반영
last_verified: 2026-06-02
sources:
  - "public/data/tft_set17_champions.json (TFT17_Pyke entry — cost 2, role ADReaper, traits 초능력/여행자, ability '죽음의 표식' variables SpearDamage/AoEDamage/TargetDamage)"
  - "public/data/tft_set17_traits.json (TFT17_PsyOps = 초능력 — item 부여 trait / TFT17_FlexTrait = 여행자 — 전투 시작 탱커 ShieldHP / 비탱커 BonusDA, 여행자 챔프 ×2)"
  - "src/types/index.ts:42 (mapGameRole — 'ADReaper' includes 'Reaper' → Assassin)"
  - "src/lib/simulator/systems/ability.ts:210 (TFT17_Pyke base config: { pattern: 'aoe_circle', radius: 1, dash: 'to_target', damageVar: 'TargetDamage', secondaryDamageVar: 'AoEDamage' })"
  - "src/data/carryAugments.ts:220-233 (TFT17_Augment_PykeCarry — abilityOverride x_shape/to_lowest_hp, damage/secondaryDamage/tankBonusMultiplier 0.60/onKillRecastMultiplier 0.70)"
  - "src/lib/simulator/engine/combatLoop.ts:2265 (applyHeroCarryTransforms — PykeCarry role → Fighter, 양팀 :4625-4626)"
  - "src/lib/simulator/engine/combatLoop.ts:1312 (applyCarryDamageModifiers — secondaryDamage !primary + tankBonusMultiplier primary Tank, caller main+OOR 2 site)"
  - "src/lib/simulator/engine/combatLoop.ts:6638-6740 (파이크 carry onKillRecast cascade — primary 처치 시 70% damage 재시전, MAX_RECAST_CHAIN 5, 새 dash to_lowest_hp + 새 X-shape)"
  - "src/lib/simulator/engine/combatLoop.ts:6952 (dash retarget — abilityTarget = dash 결과, omnivamp/grievous 기준. main+OOR 양쪽 abilityTarget 사용)"
  - "src/lib/simulator/engine/combatLoop.ts:1678 (applyFlexTraitBuffs — 여행자, 양팀 :4591-4592, unitHasTrait '여행자' :1689 자동 진입)"
  - "src/lib/simulator/engine/combatLoop.ts:2193 (isPsyOpsTier4Active — 초능력 tier 체크, item 부여 trait)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[spell-crit]]"
  - "[[aatrox]]"
  - "[[jax]]"
---

# 파이크 (Pyke)

## 요약

2코스트 **초능력 (`TFT17_PsyOps`)** + **여행자 (`TFT17_FlexTrait`)** trait. raw role `ADReaper`.

- **base (증강 없음)**: `mapGameRole('ADReaper')` → sim **Assassin** ([[role-passive]]). raw ability "죽음의 표식" — 1칸 이동 후 가장 먼 적에 작살(끌어당김) → 순간이동 베기 + 주변 물리 피해.
- **청부 살인마 carry (`TFT17_Augment_PykeCarry`)**: `applyHeroCarryTransforms` 로 role → **Fighter** 변환. X-shape 베기 + **처치 시 70% damage 재시전 (onKill recast cascade)** 이 핵심.

> 🎯 **Pyke 는 onKill recast cascade 를 가진 유일 carry** — primary target 처치 시 새 dash + 새 X-shape 로 완전 재 cast (damage ×0.70), 최대 5연쇄. [[aatrox]] (cycle) / [[jax]] (self-buff) 와 다른 cast path 3종 (main / OOR / **recast**) 이 모두 의미 있는 첫 carry.

> ⚠️ **set17 entity confirm**: `TFT17_Pyke` apiName 으로 소속 확인 (cost 2, traits 초능력/여행자, role ADReaper). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 700 |
| armor / magicResist | 45 / 45 |
| damage | 45 |
| attackSpeed | 0.8 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 40 |

### Role — base Assassin / carry Fighter

| 형태 | role | weight | 공격당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|------------|------|
| base (증강 없음) | **Assassin** | 2 | 10 | ❌ | `mapGameRole('ADReaper')` includes 'Reaper' (`types/index.ts:42`) |
| 청부 살인마 carry | **Fighter** | 2 | 10 | ❌ | `applyHeroCarryTransforms` (`combatLoop.ts:2265`) `target.role = statOverrides?.role ?? 'Fighter'` (PykeCarry statOverrides 없음 → Fighter) |

> Assassin 과 Fighter 모두 weight 2 / 공격당 마나 10 / 피격 마나 ❌ 라 [[role-passive]] 의 마나·타게팅 규칙은 동일 ([[aatrox]] 의 Tank→Fighter 와 달리 실질 마나 변화 없음). role 변환의 주 효과는 타게팅 tiebreaker weight 가 아닌 carry abilityData 활성.

### Base Active — 죽음의 표식 (증강 없음)

raw desc: "위치를 최대 1칸 이동하여 가장 멀리 있는 적에게 작살을 던집니다. 작살은 처음 적중하는 적을 1칸 앞으로 끌어당기고 `@ModifiedDamage@`(scaleAP)의 물리 피해를 입힙니다. 이후 대상 뒤로 순간이동하여 베어 가르며 대상에게 `@ModifiedTargetDamage@`(scaleAD) + 주변 적에게 `@ModifiedAreaDamage@`(scaleAD) 물리 피해."

raw variables: `SpearDamage` [60,60,90,135,180,180,180] / `AoEDamage` [150,120,180,360,615,475,475] / `TargetDamage` [0,210,315,720,1225,0,0]

**sim 적용** (`ability.ts:210`):
```ts
TFT17_Pyke: { pattern: 'aoe_circle', radius: 1, dash: 'to_target', damageVar: 'TargetDamage', secondaryDamageVar: 'AoEDamage' }
```

| desc 요소 | raw var | sim 적용 | 비고 |
|-----------|---------|---------|------|
| 작살 피해 (`ModifiedDamage`, scaleAP) | `SpearDamage` | ❌ **미반영** | `SpearDamage` repo-wide grep **0 hit**. base config 에 미포함 → 작살 단계 sim 부재. **Lint P1** |
| 작살 끌어당김 (1칸 pull) | — | ❌ **미반영** | reposition 메커니즘 sim 부재. **Lint P2** |
| 순간이동 베기 (`ModifiedTargetDamage`, scaleAD) | `TargetDamage` | ✅ `damageVar` | primary target 단일. ★1 `TargetDamage[0]=0` (raw 특성 — base ★1 베기 무피해) |
| 주변 적 (`ModifiedAreaDamage`, scaleAD) | `AoEDamage` | ✅ `secondaryDamageVar` | `aoe_circle radius 1` 주변 적 |

> ⚠️ base desc 는 "가장 멀리 있는 적" 에 작살인데 sim config `dash: 'to_target'` 은 현재 타겟으로 dash → targeting 불일치 (**Lint P2**). carry (X-shape, dash to_lowest_hp) 는 별도 override 라 base 와 무관.

### 청부 살인마 carry — X-shape + onKill recast (`TFT17_Augment_PykeCarry`)

`carryAugments.ts:220-233` abilityData + abilityOverride. 공격력 전사로 변환 후 2칸 내 lowest HP 적에 dash, X 모양 베기.

abilityOverride: `{ pattern: 'x_shape', dash: 'to_lowest_hp' }`, damageTypeOverride: `'physical'`.

| abilityData 필드 | 값 | sim 적용 | 비고 |
|------------------|-----|---------|------|
| `damage` (primary) | [220, 330, 500] | ✅ primary target | dash 후 X-shape 중심 |
| `secondaryDamage` (X-shape 주변) | [60, 90, 135] | ✅ `applyCarryDamageModifiers` (`:1312`) `!isPrimaryTarget` 분기 | 대각선 4 hex |
| `tankBonusMultiplier` | 0.60 | ✅ primary 가 Tank 일 때 ×(1+0.60) (`:1312` `isPrimaryTarget && t.role === 'Tank'`) | 탱커 상대 +60% |
| `onKillRecastMultiplier` | 0.70 | ✅ onKill recast cascade (아래) | 처치 시 70% damage 재시전 |

#### onKill recast cascade (`combatLoop.ts:6638-6740`)

primary target (`abilityTarget`) 처치 시 **완전 재 cast**: 새 dash (to_lowest_hp) + 새 X-shape (`findAbilityTargets`) damage ×`recastMul` (0.70).

- **연쇄 가드**: `MAX_RECAST_CHAIN = 5` (무한 루프 방지, 사용자 결정). 각 연쇄마다 살아있는 적 중 `findLowestHpEnemy` 재선정.
- **primary/secondary 분기**: 재시전도 cast loop 패턴 동일 — `isPrimaryRecast` 면 `abilityDmg`, 아니면 `secondaryDamage[★]`. tankBonusMultiplier 도 primary Tank 시 재적용.
- **damage amp 전체 stack** (codex P2 PR #72): `inventionTankDamageAmp` / `gravesTankDamageAmp` / `madredsTankDamageAmp` (Tank 한정) + `computeSniperDamageAmp` — cast loop (`~5155`) 와 동일. 누락 시 recast under-damage 회귀.
- **damage 누적**: 재시전 damage 는 `totalAbilityDmg` / `totalRawAbilityDmg` 에 누적 → omnivamp / Fountain / on_cast 정합.

### 여행자 (`TFT17_FlexTrait`) trait — 전투 시작 buff

raw desc: "전투 시작: 아군 탱커가 `@ShieldDuration@`초 동안 보호막을 얻습니다. 그 외 아군이 피해 증폭을 얻습니다. 여행자는 능력치를 두 배로 얻습니다."

raw effects (tier 2/3/4/5/6): `BonusDA` 0.09/0.15/0.18/0.22/0.27 (비탱커 damage amp) / `ShieldHP` 175/250/350/500/700 (탱커 shield HP).

**sim 적용** (`applyFlexTraitBuffs` `combatLoop.ts:1678`, 양팀 호출 `:4591-4592`):

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| 비탱커 BonusDA (damage amp) | ✅ | 전투 시작 시 ownTeam 적용 |
| 탱커 ShieldHP (보호막) | ✅ | role Tank 분기 |
| 여행자 챔프 ×2 (능력치 두 배) | ✅ | `unitHasTrait(u, '여행자')` (`:1689`) — Pyke `traits.includes('여행자')` 자동 진입. 본인 role effect 만 ×2 (보수적 해석 B) |

> Pyke 는 base Assassin / carry Fighter 둘 다 **비탱커** → 여행자 buff 중 BonusDA (damage amp) 수령, ShieldHP (탱커) 미수령. 여행자 챔프라 BonusDA ×2.

### 초능력 (`TFT17_PsyOps`) trait — item 부여

raw desc: "모든 아군에게 장착시킬 수 있는 초능력 아이템을 획득합니다." (tier 별 item / (4) tier Radiant 강화).

**sim 영향**: 초능력은 **item 부여 trait** 으로, champion 전투 stat 직접 분기 없음. `isPsyOpsTier4Active` (`combatLoop.ts:2193`) 는 tier 체크 helper — 초능력 item 의 Radiant 강화 여부 판정용 (item 시스템 기반). Pyke-specific 전투 분기 아님 (champion 페이지 verify 대상 외, item 레벨 처리).

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Pyke 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ carry X-shape (`applyCarryDamageModifiers` secondary + tankBonus) + dash to_lowest_hp + onKill recast cascade | `:1312`, `:6638-6740` |
| **OOR (out-of-range dash)** | ✅ `applyCarryDamageModifiers` **동일 helper** (in-range 일관, codex P1 #76) | `:1312` caller 2 site (main + OOR) |
| **recast (onKill)** | ✅ **cascade loop** — primary 처치 시 새 dash + X-shape 재 cast ×0.70, MAX_CHAIN 5 | `:6638-6740` |

> **dash retarget** (`:6952` 주석): Pyke carry main pipeline dash (to_lowest_hp) 진입 시 `target` 은 pre-dash, `abilityTarget` 은 dash 결과. omnivamp / grievousReduction 은 `abilityTarget` (실제 primary hit) 기준. main+OOR 양쪽 `abilityTarget` 사용 (PR #141/#142 일관).

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 700, armor/MR 45, AD 45, AS 0.8, mana 0/40, range 1)
- base role Assassin / carry role Fighter 변환 (`applyHeroCarryTransforms`)
- carry 청부 살인마 — X-shape pattern + dash to_lowest_hp + damage [220/330/500] star별
- secondaryDamage (X-shape 주변) [60/90/135] (`applyCarryDamageModifiers` `:1312`)
- tankBonusMultiplier 0.60 (primary Tank 시 ×1.60)
- **onKill recast cascade** 0.70 — primary 처치 시 재 cast, MAX_CHAIN 5, primary/secondary/tankBonus 재계산 + full damage amp (`:6638-6740`)
- dash retarget abilityTarget 기준 (omnivamp/grievous)
- **여행자 (FlexTrait)** — 전투 시작 비탱커 BonusDA / 탱커 ShieldHP + 여행자 챔프 ×2 (`:1678`)
- base 순간이동 베기 (TargetDamage) + 주변 (AoEDamage)

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: base "죽음의 표식" 작살 단계 (`SpearDamage`, scaleAP) sim 부재 — `SpearDamage` repo-wide grep 0 hit. base config 는 `damageVar: 'TargetDamage'` + `secondaryDamageVar: 'AoEDamage'` 만 → 작살(scaleAP) 피해 미소비. carry (X-shape) 는 abilityData 직접 사용이라 무관 / base Pyke 빈도 낮아 P1
- **P2**: base 작살 끌어당김 (1칸 pull / reposition) 메커니즘 sim 부재
- **P2**: base desc "가장 멀리 있는 적" vs config `dash: 'to_target'` (현재 타겟) targeting 불일치

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | base 작살 `SpearDamage` (scaleAP) sim 부재 | base config 가 `TargetDamage`/`AoEDamage` 만 read → 작살(scaleAP) 단계 미반영. `SpearDamage` grep 0 hit | **P1** | (c) cast-time — base ability resolve 에 작살 hit 단계 추가 (SpearDamage scaleAP, 가장 먼 적 단일). 또는 multi-stage ability 분기 필요 | base Pyke 빈도 낮음. carry (X-shape) 무관. 문서 미반영 명시로 처리 |
| P2 | base 작살 pull (1칸 끌어당김) 미반영 | reposition 메커니즘 sim 부재 — hex 위치 이동 | **P2** | (c) cast-time — dash/reposition 분기. 단 sim 이동 모델 단순화 가능성 | 의도된 단순화 가능성. 인게임 영향 측정 후 결정 |
| P2 | base desc "가장 먼 적" vs config `dash: 'to_target'` | desc 는 가장 먼 적 작살인데 config 는 현재 타겟 dash. base targeting 불일치 | **P2** | base config `dash` 값 검토 (to_farthest 분기 존재 시 교체) | base ability 한정. carry override 무관 |

> 📌 **carry / 여행자 trait 는 sim 정합 (lint 아님)**: onKill recast cascade + tankBonus + secondaryDamage + dash retarget + 여행자 FlexTrait 모두 코드 ground truth 와 일치. Lint 후보는 모두 **base ability (작살 단계)** 한정 — carry 중심 메타에서 영향 제한적.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Pyke` apiName 확인 (cost 2, traits ['초능력', '여행자'], role ADReaper)
- [x] entity-wide grep `Pyke` + `pyke` — sim site (carry recast / applyCarryDamageModifiers / dash retarget / role 변환)
- [x] raw stats 17.4 정합 (hp 700 / armor·MR 45 / AD 45 / AS 0.8 / mana 0·40 / range 1)
- [x] **raw role `ADReaper` → mapGameRole → Assassin (base), carry → Fighter** — base/carry role 분기 명시 (`types/index.ts:42`, `combatLoop.ts:2265`)
- [x] **carry abilityData 값** verify — `carryAugments.ts:220-233` damage/secondaryDamage/tankBonusMultiplier/onKillRecastMultiplier 전수
- [x] **onKill recast cascade** verify — `:6638-6740` recastMul + MAX_RECAST_CHAIN 5 + 새 dash to_lowest_hp + primary/secondary 재계산 + full damage amp stack
- [x] **secondaryDamage / tankBonusMultiplier** verify — `applyCarryDamageModifiers` (`:1312`) `!isPrimaryTarget` / `isPrimaryTarget && Tank` 분기
- [x] **cast path 3종 (PR #129 룰)** — main (carry X-shape ✅) / OOR (`:1312` 동일 helper ✅) / **recast (`:6638` cascade ✅)**. [[ability-targeting]] 참조
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16)** — 여행자 `applyFlexTraitBuffs` (`:1678`, `unitHasTrait '여행자'` :1689) ✅ 정상 통합 / 초능력 `TFT17_PsyOps` = item 부여 trait, `isPsyOpsTier4Active` (`:2193`) tier 체크 — champion-specific 전투 분기 없음 (item 레벨, generic verify 매 champion 필수 — 룰 #19)
- [x] **actual sim integration verify (5단계)** — base 작살 `SpearDamage` repo-wide grep 0 hit 확인 → 작살 단계 미반영 (P1). 효과 주장 전 read site 부재 확인
- [x] **본문 Lint P1~P2 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [ ] (선택) base "죽음의 표식" 작살 SpearDamage scaleAP sim 도입 여부 인게임 측정

## 관련

- [[role-passive]] — base Assassin / carry Fighter role별 마나·타게팅 규칙
- [[ability-targeting]] — `x_shape` 패턴 + cast path 3종 (main/OOR/recast). Pyke 는 recast 가 실제 동작하는 첫 carry
- [[spell-crit]] — carry ability damage 도 spell crit 경로 사용 가능 (운명술사/보건/무대 시)
- [[aatrox]] — 동일 N.O.V.A.? 아님 — Pyke 는 초능력/여행자. cast path 비교용 (Aatrox cycle vs Pyke recast)
- [[jax]] — 동일 carry Fighter 변환 패턴 (Jax self-buff vs Pyke onKill recast)
- 코드: `src/lib/simulator/systems/ability.ts:210`, `src/data/carryAugments.ts:220`, `src/lib/simulator/engine/combatLoop.ts:1312/1678/2193/2265/6638/6952`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Pyke), `public/data/tft_set17_traits.json` (TFT17_PsyOps / TFT17_FlexTrait)
