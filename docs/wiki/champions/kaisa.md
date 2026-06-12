---
id: kaisa
type: champion
display_name_kr: 카이사
api_name: TFT17_Kaisa
cost: 3
traits:
  - 암흑의 별
  - 불한당
role: Caster   # raw "ADCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: ADCaster
current_patch_status: active
sim_active: partial   # P1: onKill 마나(ManaPerKill 10, :6300) 핸들러가 평타 auto-attack 루프 내에만 → 스킬 kill/어시스트 미발동 (raw "처치 관여"보다 좁음, 도메인 verify). active(aoe_circle 16미사일 hitCount 16, damageVar default→ADDamage scaleAD) + 암흑의별(DarkStar)/불한당(AssassinTrait) trait 정합. P2: PercentTargetedMissiles(0.5, 미사일 절반 targeted) 미반영 — aoe_circle 균등 split / P2: SpellDuration(1초간 발사) instant 처리 / dead/unknown: APDamage(desc scaleAD 만, 미렌더 — sim 미참조 정상)
last_verified: 2026-06-12
sources:
  - "public/data/tft_set17_champions.json (TFT17_Kaisa entry — cost 3, role ADCaster, traits [암흑의 별/불한당], mana 0/50, ability '탄환 세례' variables BaseNumMissiles/HexRange/ADDamage/APDamage/SpellDuration/ManaPerKill/PercentTargetedMissiles)"
  - "public/data/tft_set17_traits.json (TFT17_DarkStar = 암흑의 별 / TFT17_AssassinTrait = 불한당)"
  - "src/types/index.ts (mapGameRole — 'ADCaster' includes 'Caster' → Caster)"
  - "src/lib/simulator/systems/ability.ts:226 (TFT17_Kaisa: { pattern: 'aoe_circle', radius: 2, hitCount: 16 } — 미사일 16개 반경 2칸 split, damageVar default → ADDamage)"
  - "src/lib/simulator/engine/combatLoop.ts:6300-6304 (onKill 마나 — killSc.trigger onKill + effect.type mana → manaPerKill 10 가산)"
  - "src/lib/simulator/engine/combatLoop.ts:2141 (applyDarkStarEffects 암흑의 별) + :564 (불한당 AssassinTrait AD/AP 시너지)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[jhin]]"
  - "[[chogath]]"
  - "[[briar]]"
---

# 카이사 (Kai'Sa)

## 요약

3코스트 **암흑의 별 (`TFT17_DarkStar`)** + **불한당 (`TFT17_AssassinTrait`)** trait. raw role `ADCaster`.

- **role**: `mapGameRole('ADCaster')` → sim **Caster** ([[role-passive]]). carry augment 없음. mana 0/50.
- **ability "탄환 세례"**: (passive) 처치 관여 시 마나 `ManaPerKill`(10) 획득. (active) 현재 대상 주변 반경 `HexRange`(2)칸에 미사일 `BaseNumMissiles`(16)개 발사, 각 `TotalDamage`(scaleAD) 물리.

> 🎯 **Kai'Sa 는 미사일 다발 AOE caster** — passive(처치 마나) + active(16 미사일 aoe_circle) **둘 다 sim 반영**. active 는 [[jhin]] 과 달리 `damageVar` 미지정 → default 우선순위로 **ADDamage 정상 선택** (Jhin 의 APDamage 오선택 P0 와 대조). [[jhin]]/[[chogath]] 동일 암흑의 별, [[briar]] 동일 불한당.

> ⚠️ **set17 entity confirm**: `TFT17_Kaisa` apiName 으로 소속 확인 (cost 3, traits 암흑의별/불한당, role ADCaster). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 650 |
| armor / magicResist | 25 / 25 |
| damage | 45 |
| attackSpeed | 0.8 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 50 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('ADCaster')` includes 'Caster' ([[role-passive]] Caster 마나 규칙) |

### Passive — 처치 관여 마나 (`scaling.json` trigger onKill, `combatLoop.ts:6300`)

raw desc: "처치 관여 시 마나를 `@ManaPerKill@`(10) 얻습니다."

raw variables: `ManaPerKill` [10]

scaling.json: `trigger: onKill`, `effect: mana`, `manaPerKill 10`

**sim 적용** ✅ (`:6300-6304`):

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 처치 관여 시 마나 +10 (`ManaPerKill`) | ⚠️ **평타 kill 전용** | `:6302` `killSc.trigger === 'onKill' && effect.type === 'mana' && target.state === 'dead'` → `currentMana += manaGain(10)` (maxMana cap). 단 핸들러가 **평타(auto-attack) 루프 내**에만 존재 → **스킬(aoe_circle) kill / 팀원 어시스트 시 미발동** (raw "처치 **관여**" 보다 좁음). **Lint P1** (도메인 verify: 인게임 spell kill 마나 여부) |

### Active — 탄환 세례 미사일 16개 (`ability.ts:226`)

raw desc: "현재 대상 주변 반경 `@HexRange@`(2)칸에 미사일 `@BaseNumMissiles@`(16)개 발사 → 각 `@TotalDamage@`(scaleAD) 물리 피해."

raw variables: `BaseNumMissiles` [16] / `HexRange` [2] / `ADDamage` [0,30,45,72,136] / `APDamage` [0,3,5,7,13] / `SpellDuration` [1] / `PercentTargetedMissiles` [0.5]

**sim 적용** (`ability.ts:226`):
```ts
TFT17_Kaisa: { pattern: 'aoe_circle', radius: 2, hitCount: 16 }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 반경 2칸 AOE (`HexRange`) | ✅ `radius: 2` | aoe_circle 대상 중심 반경 2칸 |
| 미사일 16개 (`BaseNumMissiles`) | ✅ `hitCount: 16` | 총 피해 = ADDamage × 16, 범위 내 적 split |
| 미사일 피해 (`TotalDamage`, scaleAD) | ✅ `damageVar` default → `ADDamage` | DAMAGE_VAR_PRIORITY 우선순위 (override 없음) → `ADDamage` [0,30,45,72,136] filler ★1=30/★2=45/★3=72(/★4=136). **[[jhin]] 의 APDamage 명시 override 오선택과 대조 — Kaisa 는 정상** |
| 미사일 절반 targeted (`PercentTargetedMissiles` 0.5) | ❌ **미반영** | `PercentTargetedMissiles` grep 0 — aoe_circle 은 균등 split (50% 대상 집중/50% 무작위 분배 미모델). **Lint P2** |
| 1초간 발사 (`SpellDuration` 1) | ⚠️ instant | sim 은 cast 시점 1회 일괄 적용 (1초 분산 발사 아님). **Lint P2** |
| 미사일 scaleAP (`APDamage`) | ➖ **dead/unknown** | raw desc 는 `<physicalDamage>@TotalDamage@(scaleAD)` **scaleAD 만 렌더** → `APDamage` [0,3,5,7] 는 spell 구성 요소 아님 (desc 미참조). sim 미참조 정상 ([[xayah]] APDamage dead 동형, "미반영 gap" 아님) |

### 암흑의 별 (`DarkStar`) / 불한당 (`AssassinTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 암흑의 별 (DarkStar) | ✅ | `applyDarkStarEffects` (`:2141`, `unitHasTrait '암흑의 별'`) — tier별 ADAP + ExecuteHPPercent. Kaisa 암흑의 별 6명 중 하나 ([[jhin]]/[[chogath]]/[[mordekaiser]] 동일) |
| 불한당 (Assassin / `TFT17_AssassinTrait`) | ✅ | `:564` 불한당 AD/AP 획득 (`applySet17SynergyBuffs` 시너지, leading-0 off-by-one PR #185 수정). Kaisa 불한당 멤버 ([[briar]] 동일) |

> 룰 #16/#19: 두 trait 모두 champion-specific 구현(분기 추가)은 불필요하나, generic 경로(`applyDarkStarEffects` / `applySet17SynergyBuffs` adap) 존재 여부 verify 는 매 champion grep 재검증 필수.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Kaisa 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active aoe_circle 16 ADDamage | `ability.ts:226`, `combatLoop.ts:6594` (findAbilityTargets aoe_circle) |
| **OOR (out-of-range)** | ➖ aoe_circle 은 dash 없음 (range 4) | `findAbilityTargets` aoe_circle case |
| **recast (onKill)** | ➖ onKill 은 마나 트리거 (passive), recast carry 아님 — carry augment 없음 | — |

> **passive onKill 마나** (`:6300`) 은 cast pipeline 과 별개 트리거. 암흑의별/불한당 trait 도 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 650, armor/MR 25, AD 45, AS 0.8, range 4, mana 0/50)
- role Caster (`mapGameRole('ADCaster')`)
- passive 마나 (onKill ManaPerKill 10) — ⚠️ 평타 kill 전용 (스킬 kill 미발동 P1)
- **active 미사일 16개** (aoe_circle radius 2, hitCount 16, ADDamage scaleAD) ✅
- **암흑의 별 (DarkStar)** + **불한당 (AssassinTrait AD/AP)** trait

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: passive onKill 마나(`ManaPerKill` 10) 가 **평타 auto-attack 루프 내에만** 발동 (`:6300`) → 스킬(aoe_circle) kill / 팀원 어시스트 시 미발동 (raw "처치 관여"보다 좁음, 도메인 verify 필요)
- **P2**: `PercentTargetedMissiles`(0.5, 미사일 절반 대상 집중) 미반영 — aoe_circle 균등 split
- **P2**: `SpellDuration`(1초간 발사) instant 처리 (1초 분산 아님)

> dead/unknown: `APDamage`(desc scaleAD 만 렌더, 미참조 정상 — gap 아님)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | onKill 마나 평타 kill 전용 | passive `ManaPerKill`(10) 핸들러가 평타 auto-attack 루프 내(`:6300-6304`)에만 → 스킬(aoe_circle) kill/어시스트 미발동. raw "처치 관여"는 spell kill 포함 | **P1** | (c) kill event 리스너 — spell cast resolution 사망 처리 블록에도 동일 onKill 마나 핸들러 추가 (또는 범용 kill event) | Caster cast 주기 영향. ⚠️ 도메인 verify (인게임 spell kill 마나) 선행 |
| P2 | PercentTargetedMissiles 미반영 | 미사일 16개 중 50% 는 대상 집중, 50% 무작위 분배 (`PercentTargetedMissiles` 0.5). aoe_circle 은 균등 split | **P2** | cast — aoe_circle 에 targeted/random 분배 비율 적용 | 미사일 분배 정밀도 (총량 동일, primary 집중도 차이) |
| P2 | SpellDuration instant | 1초간 발사를 cast 시점 1회 일괄 적용 | **P2** | cast — `SpellDuration` 동안 분산 발사 (tick 분배) | 발사 타이밍 단순화 (총량 동일) |

> 📌 **active(aoe_circle 16 ADDamage) + 암흑의별/불한당 trait 는 sim 반영**. `partial` 사유는 **passive onKill 마나 평타 전용 P1** (스킬 kill 미발동) + `PercentTargetedMissiles`/`SpellDuration` 분배·타이밍 P2 (active 총 피해량은 정합). **active damageVar 가 default 우선순위로 ADDamage 정상 선택** ([[jhin]] APDamage override P0 와 대조 — Kaisa 는 override 없어 정상).

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Kaisa` apiName 확인 (cost 3, traits [암흑의별/불한당], role ADCaster)
- [x] entity-wide grep `Kaisa` + `ManaPerKill`/`PercentTargetedMissiles`/`DarkStar`/`AssassinTrait` — sim site (onKill 마나 / active aoe_circle / 암흑의별·불한당)
- [x] raw stats 17.4 정합 (hp 650 / armor·MR 25 / AD 45 / AS 0.8 / range 4 / mana 0·50)
- [x] **raw role `ADCaster` → mapGameRole → Caster** — `includes('Caster')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — onKill 마나 핸들러 (`:6300-6304` trigger onKill + effect mana + target dead 가드) + active config (`ability.ts:226` aoe_circle radius 2 hitCount 16, damageVar 미지정)
- [x] **변수 filler 판정** — ADDamage `[0,30,45,72,136]` v0=0 filler ★1=30/★2=45/★3=72/★4=136 / APDamage `[0,3,5,7]` v0=0 filler ★1=3 (단 desc 미렌더 dead) / BaseNumMissiles·HexRange·SpellDuration·ManaPerKill·PercentTargetedMissiles 상수
- [x] **actual sim integration verify (5단계)** — onKill 마나 read 확인 (`:6302`, ⚠️ 평타 auto-attack 루프 내 전용 → spell kill 미발동 P1, 함수 컨텍스트 2단계) / **active damageVar 미지정 → DAMAGE_VAR_PRIORITY default ADDamage 선택 정상** ([[jhin]] APDamage override 오선택 P0 와 대조) / **`PercentTargetedMissiles`/`SpellDuration` grep 0 → 미반영 P2** / **APDamage desc scaleAD 만 렌더 → dead/unknown (gap 아님, [[xayah]] 학습)**
- [x] **cast path 3종 (PR #129 룰)** — main (active aoe_circle ✅) / OOR (dash 없음 ➖) / recast (carry 없음, onKill 은 마나 passive ➖). 암흑의별/불한당 별개
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 암흑의별 `TFT17_DarkStar` `applyDarkStarEffects` (`:2141`) ✅ / 불한당 `TFT17_AssassinTrait` AD/AP 시너지 (`:564`) ✅. "verify 면제" 어휘 미사용
- [x] **trait cross-ref 멤버십 verify** (Fiora #226 Aatrox 오링크 학습) — 암흑의별 [[jhin]]/[[chogath]]/[[mordekaiser]] + 불한당 [[briar]] 모두 raw traits 실재 확인
- [x] **본문 Lint P1 1건(onKill 마나 평타 전용) + P2 2건 등록 → passive 좁은 트리거 + 분배/타이밍 → 보수적 `sim_active: partial` 유지** (P0 회귀 case 없음 → 룰 #15 미해당)
- [ ] (선택) PercentTargetedMissiles 분배 / SpellDuration 분산 발사 (P2)

## 관련

- [[role-passive]] — Caster role 마나 규칙 (공격당 7 / 초당 2 / 피격 ❌)
- [[ability-targeting]] — `aoe_circle` (radius 2, hitCount 16 split). cast path main only
- [[jhin]] — 동일 암흑의 별. active damageVar 대조 (Kaisa default→ADDamage 정상 vs Jhin APDamage override P0)
- [[chogath]] — 동일 암흑의 별 (DarkStar) trait (멤버)
- [[briar]] — 동일 불한당 (AssassinTrait) trait (멤버)
- under-damage calibration (메모리 `project_underdamage_calibration`) — Kaisa 는 active ADDamage 정상 반영이라 영향 적음, 분배 P2 만
- 코드: `src/lib/simulator/systems/ability.ts:226`, `src/lib/simulator/engine/combatLoop.ts:6300/2141/564`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Kaisa), `public/data/tft_set17_traits.json` (TFT17_DarkStar / TFT17_AssassinTrait)
