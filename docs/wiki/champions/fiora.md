---
id: fiora
type: champion
display_name_kr: 피오라
api_name: TFT17_Fiora
cost: 5
traits:
  - 신성 결투가
  - 동물특공대
  - 습격자
role: Fighter   # raw "ADFighter" → mapGameRole() → sim Fighter (types/index.ts includes('Fighter')). carry augment 없음
raw_role: ADFighter
current_patch_status: active
sim_active: partial   # passive(onAttack every:2 급소 돌진 VitalDamage true + PercentHealing 15% damage% heal — PR #216) ✅ + active single dash + self heal(main) + 습격자(MeleeTrait) trait 정합. active cast VitalDamage 도 true(detectDamageType desc <trueDamage>). P1: active OOR cast self-heal 미반영 — resolveSelfHeal 이 main pipeline(:7164)에만, OOR path(:7287-7589) 누락 (Fiora dash user, #129 동형) / P2: active 6급소(NumVitals 6)+AuraHealing(주변 2칸 오라 teamwide 힐 scaleAP) 미반영 grep 0 / P2: 동물특공대(AnimaSquad) combatLoop trait apply 없음 (item UwuBlaster 와 별개) / P2: 신성 결투가(FioraUniqueTrait) grep 0 미반영
last_verified: 2026-06-12
sources:
  - "public/data/tft_set17_champions.json (TFT17_Fiora entry — cost 5, role ADFighter, traits [신성 결투가/동물특공대/습격자], mana 0/70, ability '완벽한 대가의 검술' variables NumAttacks/VitalDamage/PercentHealing/NumVitals/AuraHealing/AuraDuration)"
  - "public/data/tft_set17_traits.json (TFT17_FioraUniqueTrait = 신성 결투가 / TFT17_AnimaSquad = 동물특공대 / TFT17_MeleeTrait = 습격자)"
  - "src/types/index.ts (mapGameRole — 'ADFighter' includes 'Fighter' → Fighter)"
  - "src/lib/simulator/systems/ability.ts:252 (TFT17_Fiora: { pattern: 'single', dash: 'to_target', heal: true } — 급소 돌진 + 회복)"
  - "src/lib/simulator/engine/combatLoop.ts:6280-6296 (onAttack every:2 — vitalDamage true damage(sDmgType==='true' 저항 무시) + healPercent damage% heal)"
  - "src/lib/simulator/engine/combatLoop.ts:186-235 (classifyHealVar — PercentHealing 'damagePercent', Aura exclude) + :7162-7165 (resolveSelfHeal, codex P2 PR #216)"
  - "src/lib/simulator/engine/combatLoop.ts:528/593 (습격자 MeleeTrait 흡혈→보호막) / 동물특공대 AnimaSquad·신성결투가 FioraUniqueTrait combatLoop apply grep 0"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[masteryi]]"
  - "[[briar]]"
  - "[[aatrox]]"
---

# 피오라 (Fiora)

## 요약

5코스트 **신성 결투가 (`TFT17_FioraUniqueTrait`)** + **동물특공대 (`TFT17_AnimaSquad`)** + **습격자 (`TFT17_MeleeTrait`)** trait. raw role `ADFighter`.

- **role**: `mapGameRole('ADFighter')` → sim **Fighter** ([[role-passive]]). carry augment 없음. mana 0/70.
- **ability "완벽한 대가의 검술"**: (passive) 기본 공격 `NumAttacks`(2)회마다 급소 드러냄 → 돌진해 급소 공격 `VitalDamage`(scaleAD) **고정(true) 피해** + 입힌 피해의 `PercentHealing`(15%) 회복. (active) 급소 `NumVitals`(6)개 드러내고 모두 공격 → 마지막 급소 타격 시 주변 2칸 오라 `AuraHealing`(scaleAP) 아군 회복.

> 🎯 **Fiora 는 급소 돌진 true-damage brawler** — **passive(급소 돌진 true + 15% damage% 회복)는 sim 정확 반영** (PR #216 heal find 일반화). active 는 single dash + self heal 로 단순화 (6급소/오라 teamwide 힐 미반영). [[masteryi]] 동일 습격자, [[briar]]/[[aatrox]] 동일 동물특공대.

> ⚠️ **set17 entity confirm**: `TFT17_Fiora` apiName 으로 소속 확인 (cost 5, traits 신성결투가/동물특공대/습격자, role ADFighter). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 1200 |
| armor / magicResist | 65 / 65 |
| damage | 80 |
| attackSpeed | 0.9 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 70 |

### Role — Fighter

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Fighter** | 2 | 10 | 0 | ❌ | `mapGameRole('ADFighter')` includes 'Fighter' ([[role-passive]] Fighter 마나 규칙) |

### Passive — 급소 돌진 (`scaling.json` onAttack every:2)

raw desc: "기본 공격 `@NumAttacks@`(2)회마다 급소 드러냄. 급소가 드러나 있다면 돌진하여 급소 공격 `@ModifiedVitalDamage@`(scaleAD) **고정 피해** + 입힌 피해의 `@PercentHealing*100@`%(15%) 체력 회복."

raw variables: `NumAttacks` [2] / `VitalDamage` [50,40,60,777,...] / `PercentHealing` [0.15]

scaling.json: `trigger: onAttack`, `every: 2`, `effect: trueDamage`, `vitalDamage [50,40,60,777]`, `healPercent 0.15`

**sim 적용** ✅ (onAttack 핸들러 `:6275`, `attackCount % 2 === 0`):

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 평타 2회마다 급소 (`VitalDamage`, **고정/true**) | ✅ | `:6280` `dmgArr = vitalDamage`, `effect.type === 'trueDamage'` → `sDmgType === 'true'` → 저항 무시 (`:6286`). filler [50,40,60,777] → ★1=40 / ★2=60 / ★3=777 |
| 입힌 피해의 15% 회복 (`PercentHealing`) | ✅ | `:6290-6294` `healAmount = sDmg × healPct(0.15) × (1+healAmp)` — **maxHp% 아닌 damage%** (`classifyHealVar` 'damagePercent', codex P2 PR #216) |

> ✅ Fiora 의 핵심 passive (급소 true 피해 + damage% 회복) 는 sim 정확 반영. `PercentHealing` 은 PR #216 heal find 일반화로 `classifyHealVar` 'damagePercent' 분류 (maxHp% 오분류 방지).

### Active — 급소 6개 + 오라 힐 (`ability.ts:252`)

raw desc: "사용 시: 급소 `@NumVitals@`(6)개 드러내고 모두 빠르게 공격. 사망 시 급소 가장 가까운 적에 이전. 마지막 급소 타격 시 주변 2칸 오라 → `@AuraDuration@`(5)초 동안 범위 아군 `@ModifiedHealing@`(scaleAP) 회복."

raw variables: `NumVitals` [6] / `AuraHealing` [250,200,250,999,...] / `AuraDuration` [5]

**sim 적용** (`ability.ts:252`):
```ts
TFT17_Fiora: { pattern: 'single', dash: 'to_target', heal: true }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 대상 돌진 (dash) | ✅ `dash: 'to_target'` | `:6587` 대상 인접 칸 이동 |
| 자가 회복 (heal) | ✅ `heal: true` | `resolveSelfHeal` (`:7162`) — config.heal:true 챔프 변수 순회 (PercentHealing) |
| 급소 6개 (`NumVitals`) 모두 공격 | ❌ **미반영** | `NumVitals` grep 0 — active 는 single dash 1회로 단순화 (6 급소 반복 미모델). **Lint P2** |
| 급소 데미지 type (true) | ✅ active 도 **true** | active `single` damageVar default → `VitalDamage` ('Damage' 부분매칭). `detectDamageType(desc)` 가 desc 의 `<trueDamage>`/`고정 피해` → **'true'** 반환 → `:6732` `applyAbilityMitigation` dmgType 'true' 저항 무시. **passive·active 모두 true 정확** (physical 아님) |
| 마지막 급소 오라 teamwide 힐 (`AuraHealing` scaleAP) | ❌ **미반영** | `AuraHealing` grep 0 — `classifyHealVar` 가 `/Aura/` exclude (self-heal 오합산 방지) + teamwide 오라 힐도 미모델. **Lint P2** |

### 신성 결투가 (`FioraUniqueTrait`) / 동물특공대 (`AnimaSquad`) / 습격자 (`MeleeTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 습격자 (Melee / `TFT17_MeleeTrait`) | ✅ | 흡혈→보호막 변환 (`:528/:593`) — `MaxPercentHealthShield` + `ShieldAD`. Fiora 습격자 멤버 ([[masteryi]] 동일) |
| 동물특공대 (`TFT17_AnimaSquad`) | ❌ **미반영** | combatLoop trait apply grep 0 (emblem 매핑 `trait.ts:23` + AnimaSquad **아이템** UwuBlaster `stacking.ts:157` 만 — trait 효과 별개). **Lint P2** |
| 신성 결투가 (`TFT17_FioraUniqueTrait`) | ❌ **미반영** | repo-wide grep 0 — unique trait (Fiora 단독), combat 효과 sim 부재. **Lint P2** |

> 룰 #16/#19: 습격자만 generic 경로 존재. 동물특공대/신성결투가는 combatLoop apply 부재 (verify 면제 아님 — grep 재검증). 동물특공대는 [[briar]]/[[aatrox]] 등 다른 멤버에서도 trait 효과 미모델 동형 가능 (item 과 별개).

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Fiora 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active single dash + heal | `ability.ts:252`, `combatLoop.ts:6587` (dash) / `:7162` (heal) |
| **OOR (out-of-range)** | ❌ **active self-heal 미반영** | Fiora dash user → range 1 밖 시 OOR cast 진입 가능. main pipeline `config.heal` `resolveSelfHeal`(`:7164`) 이 **OOR path(`:7287-7589`) 에 없음** (omnivamp/fountain heal 만). active self-heal(PercentHealing) 누락 — #129 OOR stun 누락 동형. **Lint P1** |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **passive 급소 돌진** (onAttack every:2) 은 cast pipeline 과 별개 (평타 hook). 3 trait 도 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1200, armor/MR 65, AD 80, AS 0.9, range 1, mana 0/70)
- role Fighter (`mapGameRole('ADFighter')`)
- **passive 급소 돌진** (onAttack every:2, `VitalDamage` **true** + `PercentHealing` 15% damage% heal) ✅ 정확 반영 (PR #216)
- active single dash + self heal
- **습격자 (MeleeTrait)** 흡혈→보호막

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: active OOR cast self-heal 미반영 — `resolveSelfHeal`(`config.heal`) 이 main pipeline(`:7164`)에만, OOR path(`:7287-7589`) 누락 (Fiora dash user, range 1 밖 cast 시, #129 동형)
- **P2**: active 6급소(`NumVitals` 6) 반복 + `AuraHealing` 오라 teamwide 힐(scaleAP) 미반영 (single dash 단순화, grep 0)
- **P2**: 동물특공대(AnimaSquad) combatLoop trait apply 없음 (item 과 별개)
- **P2**: 신성 결투가(FioraUniqueTrait) 미반영 (grep 0, unique trait)

> 참고: active cast `VitalDamage` 는 `detectDamageType(desc)` 가 desc 의 `<trueDamage>`/`고정 피해` → 'true' 반환 → **passive·active 모두 true damage** (당초 "physical" 표기는 codex/verifier 정정).

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P2 | active 6급소 + 오라 힐 미반영 | active = `NumVitals`(6) 급소 모두 공격 + 마지막 급소 시 주변 2칸 `AuraHealing`(scaleAP) `AuraDuration`(5초) teamwide 힐. single dash 로 단순화, grep 0 | **P2** | (b) per-target/반복 + (combat-start 아닌) cast-time aura — active 6회 VitalDamage true + 오라 범위 아군 heal | active 폭딜+팀힐 누락. 단 passive 가 주력 |
| P1 | active OOR self-heal 미반영 | Fiora dash user → range 1 밖 OOR cast 시 main pipeline `config.heal` `resolveSelfHeal`(`:7164`) 이 OOR path(`:7287-7589`)에 없어 active self-heal(PercentHealing) 누락. #129 OOR stun 누락 동형 (4-sub cast path 룰) | **P1** | (c) cast-time 1회 — OOR path 의 omnivamp/fountain heal 직후 `if (outOfRangeConfig.heal) resolveSelfHeal(...)` 추가 | range-dependent under-heal. sim fix 후보 |
| P2 | 동물특공대 trait 미반영 | combatLoop apply 없음 (emblem + UwuBlaster item 만) | **P2** | trait — 동물특공대 시너지 효과 별도 구현 | trait 차원 (다중 멤버 공통) |
| P2 | 신성 결투가 trait 미반영 | FioraUniqueTrait grep 0 (unique) | **P2** | trait — unique trait 효과 구현 | Fiora 단독 |

> 📌 **passive(급소 true + 15% damage% heal)는 sim 정확 반영** (Fiora 주력, PR #216). active(dash+self heal main)+습격자 trait 반영. `partial` 사유는 **active OOR self-heal 미반영 P1** + active 6급소/오라 힐 단순화 + 동물특공대/신성결투가 trait 미반영 P2. 주력 passive 는 정합.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Fiora` apiName 확인 (cost 5, traits [신성결투가/동물특공대/습격자], role ADFighter)
- [x] entity-wide grep `Fiora` + `Vital`/`Aura`/`AnimaSquad`/`MeleeTrait` — sim site (passive vitalDamage true+heal / active single dash / AuraHealing grep 0 / 3 trait)
- [x] raw stats 17.4 정합 (hp 1200 / armor·MR 65 / AD 80 / AS 0.9 / range 1 / mana 0·70)
- [x] **raw role `ADFighter` → mapGameRole → Fighter** — `includes('Fighter')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — onAttack vitalDamage 핸들러 (`:6280-6296` trueDamage 저항 무시 + healPercent damage% heal) + active config (`ability.ts:252` single dash heal) + classifyHealVar (`:186-235` PercentHealing damagePercent / Aura exclude)
- [x] **변수 filler 판정** — VitalDamage `[50,40,60,777]` v0>v1 filler ★1=40/★2=60/★3=777 / AuraHealing `[250,200,250,999]` v0>v1 filler ★1=200 (단 미모델) / NumAttacks·PercentHealing·NumVitals·AuraDuration 상수
- [x] **actual sim integration verify (5단계)** — passive vitalDamage `:6281` dmgArr=passiveDamage??...??vitalDamage(fallback chain) true(`:6286` sDmgType true 저항 무시) + PercentHealing damage% heal(`:6290`) read 확인 (PR #216) / **active `NumVitals`/`AuraHealing` grep 0 → 6급소+오라 힐 미반영 P2** / **active cast VitalDamage 도 detectDamageType(desc <trueDamage>) → 'true' (`:6732`), passive·active 모두 true (physical 아님)** / **OOR path resolveSelfHeal grep 0 → active OOR self-heal 미반영 P1 (#129 동형)** / AuraHealing `classifyHealVar` /Aura/ exclude (self-heal 오합산 방지 ✅)
- [x] **cast path 3종 (PR #129 룰)** — main (active single dash heal ✅) / **OOR (dash user — `resolveSelfHeal` OOR path 누락 → active self-heal 미반영 P1, `:7287-7589`)** / recast (carry 없음 ➖). passive·trait 별개
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 습격자 `TFT17_MeleeTrait` 흡혈→보호막 (`:528/:593`) ✅ / 동물특공대 `TFT17_AnimaSquad` combatLoop apply grep 0 (item UwuBlaster 별개) 미반영 / 신성결투가 `TFT17_FioraUniqueTrait` grep 0 미반영. "verify 면제" 어휘 미사용
- [x] **본문 Lint P1 1건(active OOR self-heal) + P2 3건 등록 → active 단순화/OOR + trait 2개 미반영 → 보수적 `sim_active: partial` 유지** (P0 회귀 case 없음 → 룰 #15 미해당)
- [ ] (선택) active 6급소+오라 힐 / VitalDamage true / 동물특공대·신성결투가 trait (P2)

## 관련

- [[role-passive]] — Fighter role 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `single` + dash(to_target) + heal. cast path main/OOR (dash user)
- [[masteryi]] — 동일 습격자 (MeleeTrait) 흡혈→보호막
- [[briar]] — 동일 동물특공대 (AnimaSquad) trait (멤버)
- [[aatrox]] — 동일 동물특공대 (AnimaSquad) trait (멤버)
- under-damage calibration (메모리 `project_underdamage_calibration`) — Fiora 는 passive 정합이라 영향 적음, active 단순화만 P2
- 코드: `src/lib/simulator/systems/ability.ts:252`, `src/lib/simulator/engine/combatLoop.ts:6280/7162/528/186`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Fiora), `public/data/tft_set17_traits.json` (TFT17_FioraUniqueTrait / TFT17_AnimaSquad / TFT17_MeleeTrait)
