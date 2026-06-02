---
id: aatrox
type: champion
display_name_kr: 아트록스
api_name: TFT17_Aatrox
cost: 1
traits:
  - N.O.V.A.
  - 요새
role: Tank   # raw "ADTank" → mapGameRole() → sim Tank (types/index.ts:41 includes('Tank')). ⚠️ TFT17_Augment_AatroxCarry 활성 시 Fighter 로 변환 (applyHeroCarryTransforms) — Jax/Nasus/Poppy 와 동일 규칙 (frontmatter 는 base/canonical role)
raw_role: ADTank
current_patch_status: active
sim_active: partial   # carry 3-skill cycle + N.O.V.A. 타격 + shredPct(trait) + 요새(Bastion) trait 정합. A1 base heal(HealHP/HealAP) healVar 미매칭 → 미발동 / A2 주석 단독 ×2.5 → 2.0 정정 완료(fix/aatrox-fortress-trait-doc, 코드 동작은 원래 정합) / A3 armorReduction "AP 스케일" 주석 vs flat 코드 / A4 base NOVAModifier(비-carry NOVA 타격) sim 부재 / A5 base ModifiedDamage 의 DamagePercentArmor(scaleArmor) sim 미소비 (DamageAD scaleAD 만)
last_verified: 2026-06-02
sources:
  - "public/data/tft_set17_champions.json (TFT17_Aatrox entry — cost 1, role ADTank, traits N.O.V.A./요새, ability '별빛 베기' variables HealHP/HealAP/DamageAD/DamagePercentArmor/NOVAModifier)"
  - "public/data/tft_set17_traits.json (TFT17_DRX = N.O.V.A. — TeamAttackDelay 6, ShredAndSunder 0.30, AS 0.20, Heal 0.12, ShieldValue 800, BonusTrueDamage 0.10 / 양 tier (2-4)/(5+) 동일)"
  - "src/types/index.ts:39-48 (mapGameRole — 'ADTank' includes 'Tank' → Tank)"
  - "src/lib/simulator/systems/ability.ts:193 (TFT17_Aatrox base config: { pattern: 'single', heal: true })"
  - "src/data/carryAugments.ts:131-148 (TFT17_Augment_AatroxCarry abilityData — damage/secondaryDamage/slamDamage/armorReduction/novaDamage/singleTargetMultiplier 2.0)"
  - "src/lib/simulator/systems/augment.ts:55 (TFT17_Augment_AatroxCarry: 'silver' — 별빛 연계)"
  - "src/lib/simulator/engine/combatLoop.ts:2265-2272 (applyHeroCarryTransforms — AatroxCarry role → Fighter)"
  - "src/lib/simulator/engine/combatLoop.ts:6235-6296 (Aatrox 3-skill cycle 분기 — cycleCounter % 3, cycle damage 직접 사용)"
  - "src/lib/simulator/engine/combatLoop.ts:6805-6863 (N.O.V.A. 타격 추가 발동 — selector + surge active 시 모든 적 novaDamage + 1초 stun, cycle counter++)"
  - "src/lib/simulator/engine/combatLoop.ts:1328-1333 (applyCarryDamageModifiers — 찍기 단독 적중 singleTargetMultiplier)"
  - "src/lib/simulator/engine/combatLoop.ts:6996 (휩쓸기 armorReduction debuff flat -10 적용)"
  - "src/lib/simulator/engine/combatLoop.ts:7002-7029 (config.heal 처리 — healVar 이름 매칭 'Heal'|'APHeal'|'PercentMaximumHealthHealing'|'HealthDrain')"
  - "src/lib/simulator/engine/combatLoop.ts:4640-4671 (autoAssignNovaSelector — DRX (5)+ 활성 시 가장 강한 NOVA unit 자동 선택)"
  - "src/lib/simulator/engine/combatLoop.ts:4713-4755 (setupDrxNova + tickDrxNova — TeamAttackDelay 6s 후 Aatrox alive 시 모든 적 armor/MR ×(1-shredPct))"
  - "src/lib/simulator/engine/combatLoop.ts:7342-7348 (OOR cast path — Aatrox cycle 미적용 명시, aatroxIsSingleTargetSlam=false)"
  - "src/lib/simulator/novaSelector.ts:12-18 (NOVA_SELECTOR_APIS 5종 — Aatrox/Caitlyn/Akali/Maokai/Kindred)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[stargazer-fountain]]"
  - "[[galio]]"
  - "[[poppy]]"
---

# 아트록스 (Aatrox)

## 요약

1코스트 **N.O.V.A. (`TFT17_DRX`)** + **요새 (Fortress)** trait. raw role `ADTank`.

- **base (증강 없음)**: `mapGameRole('ADTank')` → sim **Tank** ([[role-passive]]). raw ability "별빛 베기" — 체력 회복 후 현재 대상에게 단일 물리 피해.
- **별빛 연계 carry (`TFT17_Augment_AatroxCarry`, silver)**: `applyHeroCarryTransforms` 로 role → **Fighter** 변환. 3-skill cycle (타격 → 휩쓸기 → 찍기) + N.O.V.A. 활성 시 전장 가르는 추가 타격.

> 🎯 **Aatrox 는 N.O.V.A. 5종 "타격 선택기" 대상 중 sim 효과가 가장 완성된 carry**. `novaSelector.ts` 의 `NOVA_SELECTOR_APIS` 5종 (Aatrox/Caitlyn/Akali/Maokai/Kindred) 중 cycle global 변환 + 모든 적 knockup 이 구현된 유일 carry (나머지 4명은 surge 시점 효과만 — [[stargazer-fountain]] 와 무관한 별개 trait).

> ⚠️ **PR #149 P2 학습 (apiName grep ground truth)**: `TFT17_Aatrox` apiName 으로 set17 소속 confirm (cost 1, traits N.O.V.A./요새). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 700 |
| armor / magicResist | 45 / 45 |
| damage | 50 |
| attackSpeed | 0.6 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 30 / 90 |

### Role — base Tank / carry Fighter

| 형태 | role | weight | 공격당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | ✅ | `mapGameRole('ADTank')` includes 'Tank' (`types/index.ts:41`) |
| 별빛 연계 carry | **Fighter** | 2 | 10 | ❌ | `applyHeroCarryTransforms` (`combatLoop.ts:2272`) `target.role = 'Fighter'` |

> [[galio]] (raw `ADTank` → Tank) 와 동일 raw role 이지만, Aatrox 는 carry 증강 적용 시 Fighter 로 변환되는 점이 다름. [[role-passive]] 의 role별 마나/타게팅 규칙 자동 적용.

### Base Active — 별빛 베기 (증강 없음)

raw desc: "체력을 `@ModifiedHeal@`(scaleAP) 회복한 후, 현재 대상에게 `@ModifiedDamage@`(scaleAD scaleArmor)의 물리 피해를 입힙니다. (N.O.V.A. 타격 시: 전장을 갈라 모든 적을 공중에 띄우고 `@ModifiedNovaDamage@` 물리 피해)"

**sim 적용** (`ability.ts:193`):
```ts
TFT17_Aatrox: { pattern: 'single', heal: true }
```

| 요소 | sim 적용 | 비고 |
|------|---------|------|
| 단일 물리 피해 (ModifiedDamage = scaleAD + scaleArmor) | ⚠️ **부분** — `resolveAbilityDamage` → `getAbilityDamage` default 가 `DamageAD` (scaleAD) 선택. `DamagePercentArmor` (scaleArmor) **sim 미소비** (repo-wide grep 0 hit) | base 단일 타격. armor scaling 누락 — **Lint A5** |
| 체력 회복 (ModifiedHeal) | ❌ **미발동** | `config.heal` 분기 (`combatLoop.ts:7002`) 진입은 하나, healVar lookup (`:7006`) 이 `'Heal'\|'APHeal'\|'PercentMaximumHealthHealing'\|'HealthDrain'` 이름만 검색 → Aatrox 변수명 `HealHP`/`HealAP` **미매칭** → `healVar` undefined → heal 0. **Lint A1** |
| N.O.V.A. 타격 (base, NOVAModifier) | ❌ **미반영** | base (비-carry) Aatrox 의 NOVA 타격 (`ModifiedNovaDamage` = NOVAModifier 0.5 계수) sim 부재. NOVA 타격 추가 발동은 carry (`isAatroxCarry`) 경로에만 존재. **Lint A4** |

### 별빛 연계 carry — 3-skill cycle (`TFT17_Augment_AatroxCarry`)

`carryAugments.ts:131-148` abilityData. cast 마다 `aatroxCycleCounter % 3` 으로 분기 (`combatLoop.ts:6256`). cycle damage 는 `resolveAbilityDamage` 우회하고 abilityData 값 직접 사용 (`:6292-6296`, physical 이라 AP scaling 없음).

| cycle | 스킬 | pattern (sim) | damage (★1/★2/★3) | 부가 효과 | 근거 |
|-------|------|---------------|---------------------|----------|------|
| 0 | 타격 | `single` | `damage` [140, 210, 315] | — | `:6257-6260` |
| 1 | 휩쓸기 | `cone` radius 1 | `secondaryDamage` [110, 165, 275] | armor 감소 (debuff) | `:6261-6269` |
| 2 | 찍기 | `aoe_circle` radius 1 | `slamDamage` [200, 300, 475] | 공중 띄움 (stun) + 단독 적중 ×배율 | `:6270-6279` |

| abilityData 필드 | 값 | sim 적용 | 비고 |
|------------------|-----|---------|------|
| `damage` (타격) | [140, 210, 315] | ✅ cycle 0 | |
| `secondaryDamage` (휩쓸기) | [110, 165, 275] | ✅ cycle 1 | 17.3: 100/150/225 → 110/165/275 |
| `slamDamage` (찍기) | [200, 300, 475] | ✅ cycle 2 | 17.3: 160/240/360 → 200/300/475 |
| `slamStunDuration` | 1.0 | ✅ `config.stun` (`:6276`) | 찍기 공중 띄움 1초 |
| `armorReduction` | 10 | ✅ flat -10 armor (`:6996` `t.stats.armor - 10`) | ⚠️ carryAugments 주석은 "AP 스케일" 인데 코드는 flat — **Lint A3** |
| `novaDamage` | [120, 180, 270] | ✅ N.O.V.A. 타격 (아래) | |
| `singleTargetMultiplier` | **2.0** | ✅ 찍기 단독 적중 (`:1329-1332`, aliveTargetCount===1) | 17.3 nerf 2.5 → 2.0. `combatLoop.ts:6239` 주석 ×2.5 → ×2.0 정정 완료 (**Lint A2 해소**) |

> **찍기 단독 적중 multiplier** (`applyCarryDamageModifiers` `:1328-1333`): `aatroxIsSingleTargetSlam && aliveTargetCount === 1 && singleTargetMultiplier` 조건. 찍기 cycle 에서 적이 1명만 남았을 때 damage ×2.0 (고립 대상 처형 메커니즘).

> **사망 시 cycle reset** (`:6249-6252`): `aatroxPreviouslyDead` true 면 `aatroxCycleCounter = 0`. resurrect 메커니즘 연동 대비 (현재 set17 Aatrox resurrect 없음 — 미래 대비 가드). cast 완료 후 `aatroxCycleCounter++` (`:6862`).

### N.O.V.A. (`TFT17_DRX`) trait — power surge

raw spec (`tft_set17_traits.json` TFT17_DRX, (2-4)/(5+) 양 tier 동일 variables):

| 변수 | 값 | 효과 (N.O.V.A. 챔프 alive 시) |
|------|-----|------------------------------|
| `TeamAttackDelay` | 6 | surge 발동 시점 (전투 시작 6초 후) |
| `ShredAndSunder` | 0.30 | **Aatrox**: 모든 적 Armor/MR ×(1-0.30) |
| `AS` | 0.20 | Caitlyn: 아군 +20% AS |
| `Heal` | 0.12 | Maokai: 아군 maxHp ×12% 회복 |
| `ShieldValue` | 800 | Kindred: 최강 Tank +800 shield |
| `BonusTrueDamage` | 0.10 | Emblem (sim 미반영) |

**surge 발동** (`setupDrxNova` `:4713` + `tickDrxNova` `:4739`): `tick === TeamAttackDelay × TICKS_PER_SECOND` 시점 1회. 발동 시점에 **alive 재평가** (codex P1 회귀 가드 — setup 시 살아있어도 6초 전 사망 시 효과 미발동).

**Aatrox shredPct** (`:4749-4753`): `hasAatrox && shredPct > 0` → 모든 살아있는 적에 `e.stats.armor *= (1 - 0.30)`, `e.stats.magicResist *= (1 - 0.30)`. ✅ raw `ShredAndSunder 0.30` 정합.

> **(5)+ 타격 선택기 자동 할당** (`autoAssignNovaSelector` `:4640-4671`): DRX `minUnits >= 5` 활성 + explicit selector 미지정 시, NOVA 5종 중 **가장 강한 (starLevel × cost)** unit 에 `aatroxNovaStrikeSelector = true`. explicit 옵션 (`options.playerNovaStrikeSelectorUnit`) 우선.

### N.O.V.A. 타격 — 추가 발동 (carry + selector + surge)

cycle ability 와 **별개의 추가 효과** (사용자 정정 spec: "기존 스킬 그대로 + 6초 NOVA 각성 시 특수 효과 추가"). cast loop 끝 post-cast 직전 발동 (`:6805-6857`).

**조건** (`:6817-6818`): `isAatroxCarry && aatroxNovaStrikeSelector && novaSurgeActive (ownDrxState.triggered) && abilityData.novaDamage`.

**효과** (모든 살아있는 적 대상, `:6825-6856`):
- `novaDamage` [120, 180, 270] 물리 피해 (`applyAbilityMitigation` 통합 mitigation)
- 1초 공중 띄움 (`stun`, `novaStunTicks = TICKS_PER_SECOND`)
- `triggerSerpentPoison` 연동 (별돌보미 뱀 trait 상호작용)
- damage 누적 (`totalAbilityDmg` / `totalRawAbilityDmg`) — omnivamp / Fountain / on_cast 정합

> ⚠️ **DRX trait 비활성 또는 surge 미발동 시 미발동** (codex P1 PR #73): selector flag 만으로 불충분 — `ownDrxState.triggered` (6초 도달) 까지 gating. surge 전 cast 에서는 cycle ability 만 발동.

### 요새 (Bastion) trait — sim 통합 (보조 trait)

Aatrox 는 frontmatter `traits: [N.O.V.A., 요새]` 의 **두 번째 trait 으로 요새 (Bastion)** 를 보유. raw desc (`tft_set17_traits.json` 요새): "아군이 방어력·마법저항력을 `@TeamwideResists@` 얻습니다. 요새는 추가 수치를 얻고, 전투 시작 후 `@Duration@`초 동안 추가 수치를 2배로 얻습니다."

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| 아군 전체 Armor/MR (`TeamwideResists`) | ✅ | `applyBastionEffects` (`combatLoop.ts:1824`), 전투 시작 시 양팀 호출 (`:4610-4611`) |
| 요새 unit 추가 `BonusArmor`/`BonusMR` | ✅ | `unitHasTrait(u, '요새')` 분기 (`:1844`) — Aatrox `traits.includes('요새')` 로 **자동 진입** |
| 첫 `Duration`초 doubled buff | ✅ | setup 시 2배 적용 → `:5197` main loop tick 에서 만료 시 차감 (`:1860` helper) |
| (6) tier 비-요새 unit `EnhancedTeamwideArmor` | ✅ | `isHighTier && !unitHasTrait(u, '요새')` 분기 (`:1840`) — Aatrox 는 요새라 해당 없음 |

> ✅ **sim 통합 완료 — Aatrox-specific 처리 불필요**. 요새는 `unitHasTrait` 기반 **generic Bastion 경로** 이므로 carry/base 무관하게 동일 적용 (N.O.V.A. 와 달리 champion-specific 분기 없음). 후속 champion 인제스트 시 요새 trait 중복 verify 불필요.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Aatrox 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ 3-skill cycle + N.O.V.A. 타격 추가 발동 (cycle counter 진행) | `:6235-6296`, `:6805-6863` |
| **OOR (out-of-range dash)** | ✅ **cycle 미적용** (의도) — `aatroxIsSingleTargetSlam=false`, cycle counter 는 in-range cast 에서만 진행 | `:7342-7348` |
| **recast (onKill)** | N/A — Aatrox 에 recast 메커니즘 없음 | — |

> Aatrox 는 melee (range 1) + carry abilityOverride `{ pattern: 'cone', radius: 1 }` (dash 없음) → 실전에서 OOR dash cast 진입 가능성 낮음. OOR path 가 cycle 미적용을 명시적으로 처리 (`:7342` 주석) → range-dependent 회귀 없음.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 700, armor/MR 45, AD 50, AS 0.6, mana 30/90, range 1)
- base role Tank / carry role Fighter 변환 (`applyHeroCarryTransforms`)
- 별빛 연계 3-skill cycle (타격 single / 휩쓸기 cone+armorReduction / 찍기 aoe_circle+stun+단독 ×2.0) — abilityData 값 star별 정확
- 휩쓸기 armor 감소 flat -10 (`:6996`)
- 찍기 단독 적중 ×2.0 (`:1329-1332`)
- **N.O.V.A. shredPct 30%** (`:4749-4753`) — raw ShredAndSunder 0.30 정합
- **N.O.V.A. 타격 추가 발동** — selector + surge active 시 모든 적 novaDamage [120/180/270] + 1초 공중 띄움 (`:6817-6856`)
- 타격 선택기 자동 할당 (가장 강한 NOVA unit)
- surge alive 재평가 / surge gating (codex P1 가드)
- OOR cast path cycle 미적용 명시 처리
- **요새 (Bastion) trait** — `applyBastionEffects` (`:1824`, 양팀 `:4610-4611`) generic 경로로 Teamwide Armor/MR + 요새 추가 BonusArmor/MR + 첫 Duration초 doubled 자동 수령 (`unitHasTrait(u, '요새')` `:1844`)

⚠️ **부정확 / 미반영** (Lint 후보):
- **A1 (P2)**: base "별빛 베기" 체력 회복 (`HealHP`/`HealAP`) 미발동 — `config.heal` 핸들러 healVar lookup 이 `HealHP`/`HealAP` 이름 미포함. base (비-carry) Aatrox 의 heal 효과 sim 부재. carry (별빛 연계) 는 heal 없는 3-skill 이라 무영향
- **A2 (P2) — 해소**: `combatLoop.ts:6239` 주석 "찍기 ... 단독 적중 ×2.5" → "×2.0 (17.3: 2.5→2.0)" 정정 완료 (본 PR). 코드 동작은 abilityData 직접 read 라 원래부터 정합, 주석만 stale 이었음
- **A3 (P2)**: `carryAugments.ts:143` `armorReduction: 10, // 휩쓸기 armor 감소 (AP 스케일)` 주석은 AP 스케일 표기인데 코드 (`:6996`) 는 flat -10 (AP scaling 없음). 주석 vs 코드 불일치 (도메인상 AP 스케일이 맞는지 인게임 verify 필요)
- **A4 (P2)**: base (비-carry) Aatrox 의 N.O.V.A. 타격 (`NOVAModifier 0.5` × `ModifiedNovaDamage`) sim 부재 — NOVA 타격 추가 발동은 `isAatroxCarry` 경로 한정. base 1코스트 Aatrox 가 carry 없이 NOVA selector 받는 경우 추가 타격 없음 (의도된 단순화 가능성)
- **A5 (P2)**: base 단일 물리 피해의 `DamagePercentArmor` (scaleArmor) sim 미소비 — raw `ModifiedDamage` 는 scaleAD + scaleArmor 인데 `resolveAbilityDamage` default 가 `DamageAD` (scaleAD) 만 선택, `DamagePercentArmor` 는 repo-wide grep 0 hit. base damage 가 armor scaling 만큼 과소 적용 (carry 는 cycle damage 직접 사용이라 무관)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| A1 | base 별빛 베기 heal (`HealHP`/`HealAP`) healVar 미매칭 → 미발동 | `config.heal` 핸들러가 `'Heal'\|'APHeal'\|'PercentMaximumHealthHealing'\|'HealthDrain'` 이름만 검색 → Aatrox 변수명 (`HealHP`/`HealAP`) 미매칭 → heal 0. base Aatrox active 의 회복 단계 sim 부재 | **P2** | (c) cast-time 1회 helper — healVar lookup 에 `HealHP`/`HealAP` (또는 `ModifiedHeal` resolve) 추가. HealHP=flat%(maxHp), HealAP=AP scaling 분리 처리 | 본 wiki PR scope 밖 (sim fix). 1코스트 base carry 빈도 낮아 P2. 문서에 미발동 명시로 처리 |
| A2 | `:6239` 주석 단독 적중 "×2.5" stale | 실제 `singleTargetMultiplier 2.0` (17.3 nerf 2.5→2.0). 코드 동작 정합, 주석만 과거 값 | **P2** | 주석 cleanup (코드 동작은 abilityData 직접 read) | ✅ **해소** — 본 PR (`fix/aatrox-fortress-trait-doc`) 에서 `:6239` 주석 ×2.5→×2.0 (17.3) 정정 |
| A3 | `carryAugments.ts:143` armorReduction 주석 "AP 스케일" vs 코드 flat -10 | 코드는 flat 차감인데 주석은 AP 스케일 표기 — 도메인 의도 (raw 가 AP scaling 인지) 확인 필요 | **P2** | (b) per-target — 휩쓸기 cone hit 시 armor 감소. AP 스케일 맞으면 `armorReduction × (1 + ap/100)` 적용 후 차감 | 인게임 측정 후 결정. 현재 flat -10 (낮은 영향) |
| A4 | base (비-carry) NOVAModifier 0.5 N.O.V.A. 타격 sim 부재 | NOVA 타격 추가 발동이 `isAatroxCarry` 한정 — base Aatrox 가 NOVA selector 받아도 추가 타격 없음 | **P2** | (c) cast-time — base Aatrox NOVA selector 시 `ModifiedNovaDamage` (NOVAModifier × ModifiedDamage) 발동 분기 추가 | 의도된 단순화 가능성 (carry 중심 메타) — 인게임 spec verify 후 결정 |
| A5 | base 단일 피해 `DamagePercentArmor` (scaleArmor) sim 미소비 | raw `ModifiedDamage` = scaleAD + scaleArmor 인데 `getAbilityDamage` default 가 `DamageAD` (scaleAD) 만 선택 → base damage 가 armor scaling 만큼 과소. `DamagePercentArmor` repo-wide grep 0 hit | **P2** | (b) per-target — base single hit damage 에 caster armor × `DamagePercentArmor[star]` 가산. 단 base ability 가 abilityOverride 없는 generic resolve 경로라 champion-specific 분기 필요 | carry (별빛 연계) 는 cycle damage 직접 사용이라 무관. base Aatrox 한정 — 인게임 측정 후 결정 |

> 📌 **shredPct 는 sim 정합 (lint 아님)**: 메모리 후속 후보 "sequence C-7 NOVA Aatrox shredPct" 검토 결과 — `ShredAndSunder 0.30` 이 `combatLoop.ts:4721` read → `:4749-4753` 적용으로 **이미 정확히 구현**. armor/MR 양쪽 ×0.7. C-7 후속 작업은 shredPct 외 다른 항목 (별도 verify) 또는 이미 해소됨.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Aatrox` apiName 확인 (cost 1, traits ['N.O.V.A.', '요새'], role ADTank)
- [x] entity-wide grep `Aatrox` + `aatrox` — sim 75+ site (cycle / NOVA strike / shredPct / selector / state field)
- [x] raw stats 17.4 정합 (hp 700 / armor·MR 45 / AD 50 / AS 0.6 / mana 30·90 / range 1)
- [x] **raw role `ADTank` → mapGameRole → Tank (base), carry → Fighter** — base/carry role 분기 명시
- [x] **3-skill cycle** verify — `combatLoop.ts:6256` cycleCounter % 3 분기 + cycle damage 직접 사용 (`:6292`)
- [x] **abilityData 값** verify — `carryAugments.ts:131-148` damage/secondaryDamage/slamDamage/armorReduction/novaDamage/singleTargetMultiplier 전수
- [x] **단독 적중 multiplier** verify — `:1328-1333` aliveTargetCount===1 조건, 실제 2.0 (`:6239` 주석 ×2.5→×2.0 정정 = A2 해소)
- [x] **N.O.V.A. shredPct** verify — DRX raw `ShredAndSunder 0.30` (`tft_set17_traits.json`) → `:4721` read → `:4749-4753` armor/MR ×0.7. 정합
- [x] **요새 (Bastion) trait 통합** verify (룰 #16 — traits frontmatter 각 entry sim 통합 여부 명시) — `applyBastionEffects` (`:1824`) + 양팀 호출 (`:4610-4611`) + `unitHasTrait(u, '요새')` 분기 (`:1844`) + doubled 만료 (`:5197`). Aatrox `traits.includes('요새')` 자동 진입 → generic Bastion 경로 ✅ sim 통합 완료 (champion-specific 분기 불필요)
- [x] **N.O.V.A. 타격 추가 발동** verify — `:6817-6856` selector + surge gating (`ownDrxState.triggered`) + novaDamage + 1초 stun
- [x] **actual sim integration verify (5단계)** — base heal: `config.heal` 핸들러 (`:7002`) healVar lookup 이 `HealHP`/`HealAP` 미매칭 확인 → heal 미발동 (A1). 효과 주장 전 read site 부재 확인
- [x] **cast path 3종 (PR #129 룰)** — main (cycle ✅) / OOR (`:7342-7348` cycle 미적용 명시 ✅) / recast (N/A). [[ability-targeting]] 3 호출처 참조
- [x] **본문 Lint A1~A4 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [x] **룰 #17 fix guidance 적용 분기 명시** — A1 (c) cast-time / A3 (b) per-target / A4 (c) cast-time
- [x] **base 단일 damage scaleArmor verify** (Codex P2) — `DamagePercentArmor` repo-wide grep 0 hit → sim 미소비 확인. `getAbilityDamage` default `DamageAD` (scaleAD) 만 적용 → **Lint A5 등록**, 단일 피해 ⚠️ 부분 강등
- [ ] (선택) base 단일 물리 damage 의 default damageVar (DamageAD) star별 매핑 정밀 verify

## 관련

- [[role-passive]] — base Tank / carry Fighter role별 마나·타게팅 규칙
- [[ability-targeting]] — `single`/`cone`/`aoe_circle` 패턴 + cast path 3종 (main/OOR/recast)
- [[stargazer-fountain]] — 별개 trait (혼동 주의 — Aatrox 는 N.O.V.A.)
- [[galio]] — 동일 raw `ADTank` (단 Galio 는 Tank 유지, Aatrox 는 carry 시 Fighter 변환)
- [[poppy]] — 동일 carry 변환 패턴 (Fighter 변환 + abilityData cycle/override)
- 코드: `src/lib/simulator/systems/ability.ts:193`, `src/data/carryAugments.ts:131`, `src/lib/simulator/engine/combatLoop.ts:2272/4640/4713/6235/6805/6996/7342`, `src/lib/simulator/novaSelector.ts:12`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Aatrox), `public/data/tft_set17_traits.json` (TFT17_DRX)
