---
id: ivernminion
type: champion
display_name_kr: 꼬마 정령
api_name: TFT17_IvernMinion
cost: 2
traits:
  - 정령족
  - 길잡이
  - 여행자
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts:41 includes('Tank')). carry augment(빅뱅) 활성 시 Fighter 변환
raw_role: APTank
current_patch_status: active
sim_active: partial   # base ability '정령 충격' aoe_circle Damage(magic filler ★1/2/3=160/240/360) ✅ + base heal ✅ **반영**(heal-find-generalization resolveSelfHeal — 이전 healVar 게이트 미매칭으로 0이던 것 해소: HealingPercentHealth maxHp×0.08 + HealingAP AP-scaled 합산) + 정령족(Astronaut BonusHealth)·여행자(FlexTrait shield) ✅. P2: HealingAP readVarByStar ★1=80 edge case(ratio 380/80=4.75<5 non-filler 오판 — 실의도 380 가능, 별도 검증) / stun config 1.0 고정(raw StunDuration ★1/2/3=1.5/1.75/2.0 미반영) / 정령 파동(PercentEffects 0.5 대상 열) 미반영 / 길잡이(SummonTrait) 미반영 / Astronaut ability self-amp 미반영. carry '빅뱅' form 은 [[ivern-minion-carry]] 별도 (active 정합)
last_verified: 2026-06-11
sources:
  - "public/data/tft_set17_champions.json (TFT17_IvernMinion — cost 2, role APTank, traits [정령족/길잡이/여행자], stats hp 950 / armor·MR 45 / AD 65 / AS 0.55 / mana 50·100 / range 1, ability '정령 충격' variables HealingPercentHealth/HealingAP/HealDuration/Damage/StunDuration/PercentEffects)"
  - "public/data/tft_set17_traits.json (TFT17_Astronaut=정령족 / TFT17_SummonTrait=길잡이 / TFT17_FlexTrait=여행자)"
  - "src/types/index.ts:41 (mapGameRole — 'APTank' includes 'Tank' → Tank)"
  - "src/lib/simulator/systems/mana.ts (Tank manaPerAttack 5 / manaFromDamage true)"
  - "src/lib/simulator/systems/ability.ts:216 (TFT17_IvernMinion: { pattern: 'aoe_circle', radius: 1, stun: 1.0, heal: true })"
  - "src/lib/simulator/engine/combatLoop.ts (config.heal → resolveSelfHeal helper, heal-find-generalization 2026-06-11. classifyHealVar 가 HealingPercentHealth(maxHp%) + HealingAP(AP-scaled) 매칭 → 합산. 이전 단일 healVar 게이트 미매칭으로 0이던 P1 해소)"
  - "src/lib/simulator/engine/combatLoop.ts (classifyHealVar / resolveSelfHeal — positive 패턴 분류 + readVarByStar 일괄 인덱싱)"
  - "src/lib/simulator/engine/combatLoop.ts:7066 (config.stun — base form config.stun 1.0 fixed, carryCfg null → starLevelStun 미적용)"
  - "src/lib/simulator/engine/combatLoop.ts:6384/7253 (resolveAbilityDamage — base form carryCfg null → getAbilityDamage 'Damage' magic, v0>v1 filler ★1/2/3=160/240/360)"
  - "src/lib/simulator/engine/combatLoop.ts:2013-2037 (applyAstronautEffects 정령족 — BonusHealth flat HP + Meeps stack 저장)"
  - "src/lib/simulator/engine/combatLoop.ts:1733-1758 (applyFlexTraitBuffs 여행자 — 탱커 shield / 비탱커 damageAmp / 여행자 ×2, 호출 :4623)"
  - "src/data/carryAugments.ts:188-204 (TFT17_Augment_IvernMinionCarry 빅뱅 — carry form, [[ivern-minion-carry]] 참조)"
related:
  - "[[ivern-minion-carry]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[reksai]]"
  - "[[gragas]]"
  - "[[spell-crit]]"
---

# 꼬마 정령 (IvernMinion / Meepsie)

## 요약

2코스트 **정령족 (`TFT17_Astronaut`)** + **길잡이 (`TFT17_SummonTrait`)** + **여행자 (`TFT17_FlexTrait`)** trait. raw role `APTank`. **carry augment 보유** (빅뱅 — [[ivern-minion-carry]]).

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]]). carry augment(빅뱅) 활성 시 **Fighter** 변환.
- **base ability "정령 충격" (Meep Impact)**: 체력 회복 (scaleHealth maxHp% + scaleAP, 3초) + 대상 강타(magic 피해 + 공중 띄움) + 정령 파동(대상 열에 50% 효과).
- 2코 탱커 — 정령족 BonusHealth + 여행자 shield.

> ⚠️ **set17 entity confirm**: `TFT17_IvernMinion` apiName 으로 소속 확인 (cost 2, traits 정령족/길잡이/여행자, role APTank). 한글명 "꼬마 정령" ≠ apiName "IvernMinion" — 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습). carry augment `TFT17_Augment_IvernMinionCarry` "The Big Bang" raw 실존 (도달 가능, 룰 0-1).

> 📌 **이 페이지 = base form (정령 충격) + trait 중심**. carry "빅뱅" (Fighter 변환 + dash to_largest_cluster + hexReduction falloff + multi-stun + onAttackBonus) 상세는 [[ivern-minion-carry]] 참조 (sim active 정합).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 950 |
| armor / magicResist | 45 / 45 |
| damage | 65 |
| attackSpeed | 0.55 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 50 / 100 |

### Role — Tank (base) / Fighter (carry)

| 형태 | role | weight | 공격당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | ✅ | `mapGameRole('APTank')` includes 'Tank' (`types/index.ts:41`), Tank 마나 (`mana.ts`) |
| 빅뱅 carry 활성 | **Fighter** | 2 | 10 | ❌ | `applyHeroCarryTransforms` (`combatLoop.ts:2301`) `role = statOverrides?.role ?? 'Fighter'` ([[ivern-minion-carry]]) |

### Active (base) — 정령 충격 (`ability.ts:216`)

raw desc: "@HealDuration@(3)초 동안 체력을 `@ModifiedHeal@`(scaleHealth scaleAP) 회복. 대상을 강타해 `@ModifiedDamage@`(scaleAP) 마법 피해 + `@StunDuration@`초 공중으로 띄움. 적중 시 정령 파동 생성 → 대상이 위치한 **열**에 이 효과의 `@PercentEffects*100@`(50)% 피해."

raw variables: `HealingPercentHealth` [0.08] / `HealingAP` [80,**380**,**430**,**600**,770,80,80] / `HealDuration` [3] / `Damage` [200,**160**,**240**,**360**,600,...] / `StunDuration` [1.5,**1.5**,**1.75**,**2.0**,2.25] / `PercentEffects` [0.5] / `HealingAndShieldingPerAstro` [0.12] / `MeepsPerAstro` [1]

> raw 변수는 **index0=placeholder 컨벤션** (★N=index N). 굵은 값이 ★1/2/3. (carry abilityData 는 index=★-1 별개 컨벤션 — [[ivern-minion-carry]])

**sim 적용** (`ability.ts:216`):
```ts
TFT17_IvernMinion: { pattern: 'aoe_circle', radius: 1, stun: 1.0, heal: true }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| magic 피해 (`Damage`, scaleAP) | ✅ | base form `carryCfg` null → `resolveAbilityDamage` (`:6384`/`:7253`) fallback `getAbilityDamage('Damage')`. **v0>v1 filler** (`[200,160,…]` v0=200>v1=160) → `idx=starLevel` → ★1=160 / ★2=240 / ★3=360 magic × (1+AP/100) |
| aoe_circle radius 1 (인접 적) | ✅ (근사) | 반경 1칸. raw 는 "대상 강타 + 대상 **열**(row) 에 정령 파동 50%" — sim 은 radius 1 circle 로 근사 |
| 공중 띄움 (`StunDuration`) | ⚠️ **부정확** | config `stun: 1.0` **고정** (`:7066`). base form `carryCfg` null → `starLevelStun` 미적용 → 모든 radius-1 적에 1.0초. raw starLevel별 ★1=1.5/★2=1.75/★3=2.0 **미반영** (P2) |
| 체력 회복 (scaleHealth maxHp 8% + scaleAP `HealingAP`, 3초) | ✅ **반영** (heal-find-generalization) | `config.heal` → `resolveSelfHeal`. `classifyHealVar` 가 `HealingPercentHealth`(maxHp×0.08) + `HealingAP`(AP-scaled) 둘 다 매칭 → 합산. 이전 단일 healVar 게이트(`'Heal'/'APHeal'/...`)에 IvernMinion 변수 0개 매칭으로 heal=0 이던 P1 해소. ⚠️ `HealingAP` readVarByStar ★1=**80**(ratio 380/80=4.75<5 라 non-filler 오판 — 실의도 380 가능, P2 edge case) |
| 정령 파동 (`PercentEffects` 0.5, 대상 **열**) | ❌ **미반영** | grep 0 (`PercentEffects`/`meepwave`). sim aoe_circle radius 1 circle 만 — row 방향 50% 효과 별도 미모델 (P2) |
| 정령 추가 효과 (Astronaut active: 받는 회복/보호막 증가) | ❌ **미반영** | `ModifiedHealingAndShielding` (`HealingAndShieldingPerAstro` 0.12 per Astronaut) self-amp grep 0. `MeepsPerAstro` [1] 도 미사용. 정령족 trait 의 BonusHealth(flat HP)는 별개 반영 (아래) |

> ✅ **resolved (heal-find-generalization, 2026-06-11)**: desc `ModifiedHeal` = maxHp×0.08 (scaleHealth) + `HealingAP`(scaleAP) over 3s. 이전엔 단일 healVar 게이트(`'Heal'/'APHeal'/'PercentMaximumHealthHealing'/'HealthDrain'/'HEALING'`)에 IvernMinion 변수 0개 매칭 → heal=0 이던 P1. **그들은 게이트 var 1개는 매칭됐던 반면 IvernMinion 은 게이트 var 0개라 더 심한 케이스**였음 ([[reksai]] #195 / [[gragas]] #202 동형 "heal find 이름 미스매치"의 결정적 사례). → `resolveSelfHeal` 전수 순회 분류로 5챔프(IvernMinion/Aatrox/Rhaast/TahmKench/Fiora) 일괄 해소 + Reksai/Illaoi indexing 교정. ⚠️ 잔존 P2: `HealingAP` readVarByStar 가 ★1=80(실의도 380 가능 — ratio 4.75<5 filler 미감지 edge case).

### carry (빅뱅) — [[ivern-minion-carry]] 참조

`TFT17_Augment_IvernMinionCarry` (gold tier) 활성 시 가장 강한 꼬마 정령 1명 → **Fighter** 변환. base ability config 를 abilityOverride 가 **완전 교체** (`getAbilityConfigForUnit:643` 은 `carry.abilityOverride` 직접 반환 — base 의 heal/stun **미상속**). 따라서 base heal(현 resolveSelfHeal 반영)은 **base form 한정** (carry form 은 heal 없음 — resolveSelfHeal 미호출). carry form (dash to_largest_cluster + radius 3 + hexReduction 0.35 falloff + multi-stun [1.25,1.5,1.75] nearest 3 + onAttackBonus [40,60,90]) 은 sim active 정합 — 상세 [[ivern-minion-carry]].

### 정령족 (`TFT17_Astronaut`) trait

`applyAstronautEffects` (`:2013`) — `unitHasTrait('정령족')` unit 에 `BonusHealth` flat HP 가산 ((3)+100 / (5)+400 / (7)+400 / (10)+500) + `Meeps` stack(2/3/4/6) 저장. IvernMinion 은 정령족 8명(Bard/Gnar/Fizz/Rammus/Poppy/Corki/Veigar/IvernMinion) 중 하나 → BonusHealth ✅. **단** Meeps stack 은 뽀삐 carry `spiritEffectPerStack` 등에 쓰이며 IvernMinion carry 는 `spiritEffectPerStack=0` 이라 미사용. ability 의 "정령 추가 효과"(회복/보호막 amp)는 별개로 미반영(위 표).

### 길잡이 (`TFT17_SummonTrait`) trait

`combatLoop` grep **0** → **sim 미반영**. 길잡이는 소환 기반 trait(board/game-level) — 전투 sim 에 효과 helper 부재 (`trait.ts:41` 은 emblem 매핑만). frontmatter `traits` 에는 raw 소속대로 기재하되 sim 효과 없음 명시.

### 여행자 (`TFT17_FlexTrait`) trait

`applyFlexTraitBuffs` (`:1733`, 호출 `:4623`) — 전투 시작 시 탱커 아군 shield / 비탱커 damageAmp, 여행자 챔프(`unitHasTrait '여행자'`)는 ×2. IvernMinion base = **Tank** → shield 수령 ✅ (여행자 챔프라 ×2). carry 시 Fighter 변환되면 비탱커 분기(damageAmp).

## Cast path 분석 (PR #129 룰 — 3종 전수)

base form 기준 (carry form cast path 는 [[ivern-minion-carry]]):

| cast path | IvernMinion base 처리 | 근거 |
|-----------|----------------------|------|
| **main pipeline** | ✅ aoe_circle Damage(magic) + stun 1.0 + heal(resolveSelfHeal) | `ability.ts:216`, `:6384`(damage), `:7066`(stun), `:7105`(heal → resolveSelfHeal) |
| **OOR (out-of-range dash)** | ➖ base config dash 없음 → range 1 melee. OOR fallback 진입 시 damage(`:7253`)·stun 동일 처리 | base abilityOverride dash 없음 |
| **recast (onKill)** | ➖ 없음 — base form recast 분기 없음 (carry 도 PykeCarry 전용) | — |

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 950, armor/MR 45, AD 65, AS 0.55, mana 50/100, range 1)
- role Tank (`mapGameRole('APTank')`) + Tank 마나 (공격당 5 / 피격 ✅) / carry 시 Fighter
- base active aoe_circle radius 1 + Damage (scaleAP magic, v0>v1 filler ★1/2/3=160/240/360)
- **정령족 (Astronaut)** BonusHealth flat HP / **여행자 (FlexTrait)** 탱커 shield ×2
- carry "빅뱅" form 전체 ([[ivern-minion-carry]] active)

✅ **추가 활성** (heal-find-generalization, 2026-06-11):
- base heal **반영** — `config.heal` → `resolveSelfHeal`. HealingPercentHealth(maxHp×0.08) + HealingAP(AP-scaled) 합산 (이전 healVar 게이트 0개 매칭 P1 해소)

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: `HealingAP` readVarByStar ★1=80 (ratio 4.75<5 non-filler 오판 — 실의도 380 가능, edge case)
- **P2**: base stun config 1.0 고정 (raw `StunDuration` ★1/2/3=1.5/1.75/2.0 starLevel별 미반영)
- **P2**: 정령 파동 (`PercentEffects` 0.5, 대상 열) 미반영 — sim radius 1 circle 근사
- **P2**: 길잡이 (`SummonTrait`) sim 미반영 (소환 trait, board-level)
- **P2**: Astronaut ability self-amp (받는 회복/보호막 증가) 미반영

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ~~P1~~ ✅ resolved | base heal 미반영 → **반영** | `config.heal` → `resolveSelfHeal`(heal-find-generalization). `classifyHealVar` 가 HealingPercentHealth(maxHp%) + HealingAP(AP) 매칭 합산. 이전 단일 healVar 게이트 0개 매칭 P1 해소 (5챔프 일괄) | ~~P1~~ | resolveSelfHeal 전수 순회 | ✅ 해소 (2026-06-11). 잔존 edge case 아래 P2 |
| P2 | `HealingAP` ★1 indexing edge | readVarByStar ratio 380/80=4.75<5 라 non-filler 오판 → ★1=80 (실의도 380 가능). filler heuristic 임계(5.0) 경계 | P2 | readVarByStar 휴리스틱 | 별도 검증 (lolchess 대조) — 미확정 |
| P2 | base stun starLevel별 미반영 | config `stun:1.0` 고정 vs raw `StunDuration` ★1/2/3=1.5/1.75/2.0 | P2 | (a) main cast — config.stun 분기 starLevel별 read | 정합 개선 (다음 사이클) |
| P2 | 정령 파동(PercentEffects 0.5 대상 열) 미반영 | desc "대상 열에 효과 50%" — sim radius 1 circle 근사 | P2 | 구조적 (row 패턴 미지원) | 근사 허용 |

> 📌 **Damage(magic filler) + base heal(resolveSelfHeal) + 정령족 BonusHealth + 여행자 shield + carry form([[ivern-minion-carry]]) 은 sim 정합**. P1 base heal 은 heal-find-generalization(2026-06-11)으로 **해소**. `partial` 잔여 사유는 P2 만 (HealingAP ★1 indexing edge / stun 1.0 고정 / 정령 파동·길잡이·Astronaut amp 미반영).

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_IvernMinion` apiName 확인 (cost 2, traits [정령족/길잡이/여행자], role APTank). 한글명 "꼬마 정령" ≠ apiName
- [x] **0-1 도달성** — carry augment `TFT17_Augment_IvernMinionCarry` raw "The Big Bang" 실존 확인 (게임 도달 가능, placeholder 아님)
- [x] entity-wide grep `Ivern` + `IvernMinion` + `꼬마 정령` + `정령족` — sim site (base ability config / config.heal gate / carry 분기 :1259/:1362 / Astronaut / FlexTrait)
- [x] raw stats 17.4 정합 (hp 950 / armor·MR 45 / AD 65 / AS 0.55 / mana 50·100 / range 1)
- [x] **raw role `APTank` → mapGameRole → Tank** — `includes('Tank')` (`types/index.ts:41`). carry augment 활성 시 Fighter (`:2301`)
- [x] **함수 컨텍스트 read (2단계)** — `config.heal`(`:7105`) → `resolveSelfHeal`/`classifyHealVar`(heal-find-generalization, 이전 단일 healVar 게이트 → 전수 순회 전환) + `config.stun`(`:7066`) + `applyAstronautEffects`(`:2013`) + `applyFlexTraitBuffs`(`:1733`) 전체 read
- [x] **변수 filler 판정** — Damage `[200,160,240,360,600,…]` v0>v1 filler (`getAbilityDamage:467`) → ★1=160/★2=240/★3=360 / HealingAP `[80,380,430,600,770,…]` v0<v1 ratio 4.75<5 → readVarByStar **non-filler 판정 ★1=80** (placeholder 컨벤션상 실의도 380 가능 — filler heuristic 임계 경계 edge case, resolveSelfHeal 반영되나 P2) / StunDuration·HealingPercentHealth·PercentEffects 상수성
- [x] **actual sim integration verify (5단계)** — Damage 'Damage' auto-detect read(`:6384`/`:7253`) ✅ / **heal `config.heal`(`:7105`) → `resolveSelfHeal` 가 classifyHealVar 로 HealingPercentHealth+HealingAP 매칭·합산 read 확인 (P1 해소)** / stun config 1.0 fixed read(`:7066`) / 정령 파동·Astronaut amp read site 부재 확인
- [x] **cast path 3종 (PR #129 룰)** — base: main(aoe_circle ✅) / OOR(dash 없음 ➖) / recast(없음 ➖). carry cast path 는 [[ivern-minion-carry]]
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 정령족 `TFT17_Astronaut` (`applyAstronautEffects:2013` BonusHealth+Meeps, `unitHasTrait '정령족'`) ✅ / 여행자 `TFT17_FlexTrait` (`applyFlexTraitBuffs:1733` 탱커 shield, `unitHasTrait '여행자'`) ✅ / **길잡이 `TFT17_SummonTrait` combatLoop grep 0 → sim 미반영 (소환 trait)** ⚠️
- [x] **abilityOverride merge 동작 확인** — `getAbilityConfigForUnit:643` carry.abilityOverride **직접 반환**(merge 아님) → carry form 은 base heal/stun 미상속 → P1 은 base form 한정
- [x] **본문 Lint P1 1건 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [x] **P1 base heal fix 완료** (heal-find-generalization, 2026-06-11) — `config.heal` → `resolveSelfHeal` 전수 순회. classifyHealVar(positive 패턴+exclusion) + readVarByStar 일괄. 5챔프 일괄 해소. 잔존 P2: HealingAP ★1=80 indexing edge (별도 검증)

## 관련

- [[ivern-minion-carry]] — carry "빅뱅" form (Fighter 변환 + dash to_largest_cluster + hexReduction falloff + multi-stun + onAttackBonus). base form 의 carry 변환 상세
- [[role-passive]] — Tank(base)/Fighter(carry) role 마나·타게팅 규칙
- [[ability-targeting]] — `aoe_circle` 패턴 + stun + heal. base cast path main 중심
- [[reksai]] — 동형 self-heal active + heal find 이름 미스매치 (Reksai `APHealing` 'APHeal'≠ → #195 fix). IvernMinion 은 게이트 var 0개라 더 심함
- [[gragas]] — 동형 heal find 미스매치 (`HEALING`/`HealingPercentHealth` → #202 fix). IvernMinion `HealingPercentHealth` 도 게이트 안이라 미read
- [[spell-crit]] — IvernMinion magic 피해도 spell crit 가능 (운명술사 등 spellCanCrit 시)
- 코드: `src/lib/simulator/systems/ability.ts:216`, `src/lib/simulator/engine/combatLoop.ts:1733(applyFlexTraitBuffs)/2013(applyAstronautEffects)/7066(config.stun)/7105(config.heal→resolveSelfHeal)`, `src/types/index.ts:41`
- Raw: `public/data/tft_set17_champions.json` (TFT17_IvernMinion), `public/data/tft_set17_traits.json` (TFT17_Astronaut/SummonTrait/FlexTrait)
