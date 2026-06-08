---
id: leona
type: champion
display_name_kr: 레오나
api_name: TFT17_Leona
cost: 1
traits:
  - 중재자
  - 선봉대
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank'))
raw_role: APTank
current_patch_status: active
carry_augment: TFT17_Augment_LeonaCarry   # 방패 여전사 — abilityOverride line dash (conditional)
sim_active: partial   # base 여명의 방패 single + Damage(★별 100/150/225 flat) + stun + selfBuff durability 0.3(ShieldAmount 근사) + 선봉대 전투시작 shield + 중재자 arbiter law 정합. carry augment(LeonaCarry) line dash + firstHitOnlyStun + stunDuration[1.0,1.25,1.5]★별 + secondaryDamage[200,300,480] 정합. ✅ carry baseDamageHpFrac 0.24(첫 적중 maxHp 24%) #203 수정 완료(applyCarryDamageModifiers primary 가산) / P2 carry abilityData.shield[200,240,280] 미반영(mordekaiser만 처리) / P2 base stun 1.5 하드코딩 vs raw StunDuration ★1=1.75/★2=1.75/★3=2(★별 무시·과소) / P2 base ShieldAmount flat(420~620)→durability 0.3 근사 / P2 DefenseToDamageRatio(scaleArmor/MR) 미반영(grep 0) / P2 선봉대 HealthThreshold+Durability 미구현(후속 PR, Illaoi #184 동형)
last_verified: 2026-06-08
sources:
  - "public/data/tft_set17_champions.json (TFT17_Leona entry — cost 1, role APTank, traits [중재자/선봉대], mana 50/110, ability '여명의 방패' variables ShieldAmount/Damage/StunDuration/DefenseToDamageRatio/ShieldDuration)"
  - "public/data/tft_set17_traits.json (TFT17_ADMIN = 중재자 / TFT17_ShieldTank = 선봉대)"
  - "src/data/carryAugments.ts:171 (TFT17_Augment_LeonaCarry '방패 여전사' — abilityOverride line/maxTargets 4/dash to_target/stun 1.0/firstHitOnlyStun, damage [90,135,225]/shield [200,240,280]/baseDamageHpFrac 0.24/stunDuration [1.0,1.25,1.5]/secondaryDamage [200,300,480])"
  - "src/types/index.ts (mapGameRole — 'APTank' includes 'Tank' → Tank)"
  - "src/lib/simulator/systems/ability.ts:200 (TFT17_Leona: { pattern: 'single', stun: 1.5, selfBuff: { durability: 0.3, duration: 4 } })"
  - "src/lib/simulator/systems/ability.ts:400 (findDamageVariable — default 'Damage' 매칭) / :442 (getAbilityDamage — filler + ap/ad scaling만)"
  - "src/lib/simulator/engine/combatLoop.ts:1315 (applyCarryDamageModifiers — secondaryDamage :1337, baseDamageHpFrac primary 가산 :1349 [#203 fix, hexReduction==undefined 가드]) / :1921 (applyVanguardEffects 선봉대 shield)"
  - "src/lib/simulator/engine/combatLoop.ts:6995/7002/7370/7416 (LeonaCarry stunDuration ★별 + firstHitOnlyStun main+OOR) / :6695 (secondaryDamage recast) / :6387 (baseDamageHpFrac 자폭 전용) / :2340 (abilityData.shield mordekaiser 전용)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[graves]]"
  - "[[pyke]]"
  - "[[poppy]]"
---

# 레오나 (Leona)

## 요약

1코스트 **중재자 (`TFT17_ADMIN`)** + **선봉대 (`TFT17_ShieldTank`)** trait. raw role `APTank`. **carry augment 보유** (`TFT17_Augment_LeonaCarry` 방패 여전사).

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 시 ✅).
- **base ability "여명의 방패"**: `ShieldDuration`(4)초 `ShieldAmount`(scaleAP) 보호막 + 현재 대상 강타 `Damage`(scaleArmor scaleMR) 마법 피해 + `StunDuration`초 기절.
- **carry augment "방패 여전사"**: line 돌진 → 첫 적중 AD + 24% 최대체력 + 기절, 추가 대상 secondary 피해.

> 🎯 **Leona 는 보호막 + 기절 1코 탱커** (선봉대/중재자). base 는 단일 강타 + 자버프 보호막, carry augment 시 line 돌진 광역 CC carry 로 변환. base/carry 모두 sim 반영. carry baseDamageHpFrac(maxHp 24%)은 #203 해소, 잔존 P2 = carry shield·base stun ★별·DefenseToDamageRatio 등 P1/P2 gap.

> ⚠️ **set17 entity confirm**: `TFT17_Leona` apiName 으로 소속 확인 (cost 1, traits 중재자/선봉대, role APTank). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 700 |
| armor / magicResist | 40 / 40 |
| damage | 50 |
| attackSpeed | 0.6 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 50 / 110 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` includes 'Tank' ([[role-passive]] Tank 마나 규칙) |

### Active — 여명의 방패 (base, `ability.ts:200`)

raw desc: "`@ShieldDuration@`(4)초 동안 `@ModifiedShield@`(scaleAP) 보호막을 얻습니다. 현재 대상을 강타해 `@ModifiedDamage@`(scaleArmor scaleMR) 마법 피해 + `@StunDuration@`초 기절."

raw variables (전부 v0=0 filler): `ShieldAmount` [0,420,480,620,760] / `Damage` [0,100,150,225,385] / `StunDuration` [0,1.75,1.75,2,2.25] / `DefenseToDamageRatio` [0,1.2,1.8,2.7,4.6] / `ShieldDuration` [4,4,...] 상수

**sim 적용** (`ability.ts:200`):
```ts
TFT17_Leona: { pattern: 'single', stun: 1.5, selfBuff: { durability: 0.3, duration: 4 } }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 단일 대상 강타 마법 피해 (`Damage`) | ✅ ★별 flat | `findDamageVariable` (`:400`) → `Damage` 선택, filler → ★1=100/★2=150/★3=225 (`getAbilityDamage` `:442`) |
| 보호막 (`ShieldAmount` flat 420~620) | ⚠️ **durability 근사** | sim 은 `selfBuff: { durability: 0.3 }` (받는 피해 30% 감소, `:7085`). raw 는 flat shield (420/480/620). flat→ratio 근사라 부정확. **Lint P2** |
| 보호막 지속 (`ShieldDuration` 4) | ✅ | `selfBuff.duration: 4` 정합 |
| 기절 (`StunDuration` ★1=1.75/★2=1.75/★3=2) | ⚠️ **1.5 하드코딩** | sim `stun: 1.5` 고정 → ★별 무시 + raw(1.75~2) 보다 과소. **Lint P2** |
| `Damage` scaleArmor / scaleMR (`DefenseToDamageRatio`) | ❌ **미반영** | `getAbilityDamage` scaling 은 ap/ad 만. `DefenseToDamageRatio` repo-wide grep **0 hit**. desc 방어→피해 전환 미반영. **Lint P2** |
| `ShieldAmount` scaleAP | ❌ 미반영 | durability 근사라 ShieldAmount 값·scaleAP 모두 미참조 (위 P2 에 포함) |

### Conditional — 방패 여전사 (carry augment `TFT17_Augment_LeonaCarry`, `carryAugments.ts:171`)

선택 시 base ability 를 **완전 대체** (abilityOverride). raw: "2초 보호막. 최대 3칸 돌진해 적이 가장 많은 일직선 타격(탱커 우선). 첫 적중: AD + 24% 최대체력 + 기절. 추가 대상: AD damage."

```ts
abilityOverride: { pattern: 'line', maxTargets: 4, dash: 'to_target', stun: 1.0, firstHitOnlyStun: true }
abilityData: { damage: [90,135,225], shield: [200,240,280], shieldDuration: 2,
               baseDamageHpFrac: 0.24, stunDuration: [1.0,1.25,1.5], secondaryDamage: [200,300,480] }
```

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| line 돌진 (maxTargets 4, dash to_target) | ✅ | abilityOverride `pattern: 'line'` |
| 첫 적중만 기절 (`firstHitOnlyStun`) | ✅ | `:7002` (main) `stunLimit = 1` + `:7370` (OOR dash) |
| 기절 시간 (`stunDuration` [1.0,1.25,1.5]) | ✅ ★별 | `:6995` main pipeline + `:7416` OOR — starLevel별 정확 적용 (이전 fixed 1.0 회귀 해소) |
| 추가 대상 secondary 피해 (`secondaryDamage` [200,300,480]) | ✅ | `applyCarryDamageModifiers` `:1337` (`!isPrimaryTarget`) + recast `:6695` |
| primary damage (`damage` [90,135,225]) | ✅ | abilityData.damage cast |
| **첫 적중 maxHp 24% (`baseDamageHpFrac` 0.24)** | ✅ **#203 수정** | `applyCarryDamageModifiers` (`:1336`) 에 primary target `maxHp × baseDamageHpFrac` 가산 추가 (`hexReduction === undefined` 가드 — 자폭형 GragasCarry 는 selfDamage continue 로 미진입). 회귀 가드 `leona-basedamagehpfrac.test.ts` |
| 보호막 (`shield` [200,240,280], `shieldDuration` 2) | ❌ **미반영** | abilityOverride 에 selfBuff 없음 → base durability 도 소거. `abilityData.shield` 처리는 `:2340` `mordekaiserCarryShield` 전용. LeonaCarry shield 미참조. **Lint P2** |

> carry augment 는 [[feedback_selected_single_carry]] — `findSelectedCarryAugment` 가 selected 1명만 carryCfg 반환. secondaryDamage/stunDuration 은 selected 카피만 적용 (비-carry 회귀 방지).

### 중재자 (`TFT17_ADMIN`) / 선봉대 (`TFT17_ShieldTank`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 중재자 (ADMIN) | ✅ arbiter law | `playerArbiterLaw`/`enemyArbiterLaw` + `arbiter_laws.json` (`:7`). 중재자 법률 시스템 (`:112`, `:4332` arbiter-law 발동) |
| 선봉대 (ShieldTank) | ⚠️ shield ✅ / HealthThreshold·Durability ❌ | `applyVanguardEffects` (`:1921`) — 전투 시작 maxHp×ShieldPercent shield ✅. 주석 Spec 의 HealthThreshold(50% 체력 시 추가 shield) + Durability +5%/(6)+8% 는 후속 PR 미구현. **Lint P2** ([[graves]] Illaoi #184 Vanguard 부분구현 동형) |

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Leona 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ base single 강타 / carry line 돌진 maxTargets 4 | `ability.ts:200` / carry abilityOverride |
| **OOR (out-of-range dash)** | ✅ carry line dash OOR — firstHitOnlyStun + stunDuration ★별 정확 적용 | `:7370`, `:7416` (codex P1 OOR 누락 회귀 가드) |
| **recast (onKill)** | ✅ carry secondaryDamage recast (`!isPrimaryRecast`) | `:6695` |

> **선봉대 shield · 중재자 law** 는 cast pipeline 과 별개 (trait helper).

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 700, armor/MR 40, AD 50, AS 0.6, range 1, mana 50/110)
- role Tank (`mapGameRole('APTank')`)
- base 여명의 방패: Damage ★별(100/150/225 flat) + stun + selfBuff durability 0.3 (ShieldAmount 근사) duration 4
- **carry augment** (LeonaCarry): line dash maxTargets 4 + firstHitOnlyStun + stunDuration[1.0,1.25,1.5]★별(main+OOR) + secondaryDamage[200,300,480] 추가대상(+recast)
- **선봉대** 전투 시작 shield + **중재자** arbiter law

⚠️ **부정확 / 미반영** (Lint 후보):
- ✅ **#203 수정 완료**: carry `baseDamageHpFrac` 0.24 (첫 적중 maxHp 24%) — applyCarryDamageModifiers primary 가산 (hexReduction 없는 carry 한정)
- **P2**: carry `abilityData.shield` [200,240,280] 미반영 — mordekaiser 만 처리
- **P2**: base stun 1.5 하드코딩 vs raw StunDuration ★1=1.75/★2=1.75/★3=2 (★별 무시 + 과소)
- **P2**: base ShieldAmount flat(420~620) → durability 0.3 근사
- **P2**: DefenseToDamageRatio (scaleArmor/MR) 미반영 (grep 0)
- **P2**: 선봉대 HealthThreshold + Durability 부분구현 (후속 PR, Illaoi #184 동형)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ✅ #203 | carry baseDamageHpFrac 미반영 → **수정 완료** | `applyCarryDamageModifiers`(`:1336`)에 primary `maxHp × baseDamageHpFrac` 가산 (hexReduction 없는 carry 한정 — GragasCarry 자폭 selfDamage continue 로 미진입) | ~~P1~~ resolved | cast-time 적용 | 회귀 가드 `leona-basedamagehpfrac.test.ts` |
| P2 | carry abilityData.shield 미반영 | LeonaCarry shield [200,240,280]/2초. abilityOverride selfBuff 없음 + abilityData.shield 는 `:2340` mordekaiser 전용 → carry Leona shield 전무 | **P2** | cast-time — carry cast 시 abilityData.shield[★] 보호막 부여 | carry 방어 효과 누락 |
| P2 | base stun ★별 무시 + 과소 | sim `stun: 1.5` 고정 vs raw StunDuration ★1=1.75/★2=1.75/★3=2. CC 0.25~0.5초 과소 + ★별 무시 | **P2** | config stun 을 raw StunDuration readVarByStar 로 전환 | base 강타 CC 과소. 의도적 근사 가능성(패치노트 확인) |
| P2 | DefenseToDamageRatio 미반영 | desc Damage `(scaleArmor scaleMR)` → 방어 비례 추가. `getAbilityDamage` ap/ad scaling 만, grep 0 | **P2** | cast-time — Damage 에 (armor+MR)×DefenseToDamageRatio 가산 | base 강타 피해 과소 (탱빌드 시 큼) |
| P2 | 선봉대 HealthThreshold/Durability 미구현 | `applyVanguardEffects` 전투시작 shield 만. HealthThreshold(50%) 추가 shield + Durability 미구현 | **P2** | tick — HealthThreshold 발동 감시 + 보호막 활성 중 Durability 가산 | trait 차원 후속 PR (Illaoi #184 동형) |

> 📌 **base Damage+stun+durability shield + carry line+firstHitOnlyStun+stunDuration★별+secondaryDamage+baseDamageHpFrac(#203) + 선봉대 shield + 중재자 law 는 sim 정합**. `partial` 잔존 사유는 carry shield + base stun ★별·ShieldAmount·DefenseToDamageRatio + 선봉대 부분구현 (전부 P2) — baseDamageHpFrac P1 은 #203 해소.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Leona` apiName 확인 (cost 1, traits [중재자/선봉대], role APTank, vars ShieldAmount/Damage/StunDuration/DefenseToDamageRatio/ShieldDuration)
- [x] **0-sub conditional augment** — `TFT17_Augment_LeonaCarry` (carryAugments.ts:171) abilityOverride line/firstHitOnlyStun + abilityData 전 필드 sim 처리 전수 (stunDuration★별 ✅ / secondaryDamage ✅ / baseDamageHpFrac ❌ P1 / shield ❌ P2)
- [x] entity-wide grep `Leona` + `레오나` + `여명의 방패` + `LeonaCarry` + `DefenseToDamageRatio` — sim site (base config / carry augment / 선봉대·중재자 / DefenseToDamageRatio grep 0)
- [x] raw stats 17.4 정합 (hp 700 / armor·MR 40 / AD 50 / AS 0.6 / mana 50·110 / range 1)
- [x] **raw role `APTank` → mapGameRole → Tank** — `includes('Tank')`
- [x] **함수 컨텍스트 read (2단계)** — `getAbilityDamage`/`findDamageVariable`/`parseAbility` (`:400-480`) + `applyCarryDamageModifiers` 6 modifier 전수 (`:1315-1373`, baseDamageHpFrac 분기 없음 확인) + `applyVanguardEffects` (`:1921`) + LeonaCarry stun/secondary site (`:6995/7002/7370/7416/6695`)
- [x] **변수 filler 판정** — ShieldAmount/Damage/StunDuration/DefenseToDamageRatio 전부 v0=0 → isFiller (`v0===0` true) → idx=starLevel → ★1=value[1]. Damage ★1=100/★2=150/★3=225. ShieldDuration [4,4,..] 상수
- [x] **actual sim integration verify (5단계)** — base Damage findDamageVariable→'Damage' read 확인 / **carry baseDamageHpFrac grep → `:6387` 자폭 전용, LeonaCarry 미반영 P1** / **carry shield grep → `:2340` mordekaiser 전용, LeonaCarry 미반영 P2** / **DefenseToDamageRatio grep 0 → 미반영 P2** / base stun 1.5 fixed vs raw StunDuration P2
- [x] **cast path 3종 (PR #129 룰)** — main (base single ✅ / carry line ✅) / OOR (carry firstHitOnlyStun+stunDuration ★별 `:7370/7416` ✅) / recast (carry secondaryDamage `:6695` ✅). 선봉대 shield·중재자 law 별개 경로
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 중재자 `TFT17_ADMIN` arbiter law (`:7`/`:112`/`:4332`) ✅ / 선봉대 `TFT17_ShieldTank` `applyVanguardEffects` (`:1921`) shield ✅, HealthThreshold+Durability 미구현 (P2)
- [x] **carry augment selected 가드 (룰 #135/#136)** — `findSelectedCarryAugment` selected 1명만 carryCfg 반환. secondaryDamage/stunDuration 비-carry 카피 회귀 방지
- [x] **본문 Lint P1 1건 + P2 5건 등록 → frontmatter `sim_active: partial`** (P1 sim 미반영 → 룰 #15 partial 강등)
- [ ] (선택) carry baseDamageHpFrac(P1) / carry shield / base stun ★별 / DefenseToDamageRatio / 선봉대 부분 sim 도입

## 관련

- [[role-passive]] — Tank role 마나 규칙 (공격당 5 / 초당 0 / 피격 ✅)
- [[ability-targeting]] — base `single` 강타 / carry `line` dash maxTargets 4. cast path main/OOR(dash)/recast
- [[graves]] — 동일 carry augment 보유 champion (abilityOverride 패턴). 선봉대(ShieldTank) 부분구현 Illaoi #184 동형
- [[pyke]] — 동일 `secondaryDamage` (X-shape vs line 추가 대상) applyCarryDamageModifiers
- [[poppy]] — 동일 carry augment modifier (armorScale) applyCarryDamageModifiers
- 코드: `src/lib/simulator/systems/ability.ts:200/400/442`, `src/lib/simulator/engine/combatLoop.ts:1315/1921/6387/6695/6995/7370`, `src/data/carryAugments.ts:171`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Leona), `public/data/tft_set17_traits.json` (TFT17_ADMIN / TFT17_ShieldTank)
