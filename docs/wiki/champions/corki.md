---
id: corki
type: champion
display_name_kr: 코르키
api_name: TFT17_Corki
cost: 4
traits:
  - 정령족
  - 운명술사
role: Caster   # raw "ADCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: ADCaster
current_patch_status: active
sim_active: partial   # active 소행성 발사기 aoe_circle dash + hitCount 21 MissileAD(no-filler ★1=25/30/44) split + ProcChance 20%×3.5 proc 기대값(procChance/procDamageMult → ×1.5, main+OOR) + 평타 미사일(MissilesPerLaunchAttack 5, MissileAD+MissileAP+Proc) + 정령족(Astronaut)/운명술사(Fateweaver) 정합. P2 active 미사일 MissileAP(scaleAP) 미반영 (damageVar MissileAD 만 — secondaryDamageVar 는 타겟당 1회 flat 이라 21미사일 AP 부적합) / P2 Meep(정령 추가 MeepDamage/BaseMeepCooldown) 미반영 (grep 0) / P2 운명술사 Lucky 미구현
last_verified: 2026-06-05
sources:
  - "public/data/tft_set17_champions.json (TFT17_Corki entry — cost 4, role ADCaster, traits [정령족/운명술사], ability '소행성 발사기' variables BaseMissiles/MissileAD/MissileAP/ProcChance/ProcDamageMult/MissilesPerLaunchAttack/MeepDamage/BaseMeepCooldown/CDRPerMeep/CooldownReductionPerAstro)"
  - "public/data/tft_set17_traits.json (TFT17_Astronaut = 정령족 / TFT17_Fateweaver = 운명술사)"
  - "src/types/index.ts (mapGameRole — 'ADCaster' includes 'Caster' → Caster)"
  - "src/lib/simulator/systems/ability.ts:246 (TFT17_Corki: { pattern: 'aoe_circle', radius: 2, dash: 'to_target', hitCount: 21, damageVar: 'MissileAD', procChance: 0.20, procDamageMult: 3.5 } — active 미사일 21개 AOE, MissileAD + proc 기대값. MissileAP 미참조)"
  - "src/lib/simulator/engine/combatLoop.ts (hitCountTotal × procExpectedMult = 1−p+p×mult, main + OOR oorHitTotal 일관 — Corki 0.2/3.5 → ×1.5)"
  - "src/lib/simulator/engine/combatLoop.ts:6289-6320 (평타 미사일 — MissilesPerLaunchAttack 5, 각 MissileAD physical + MissileAP magic, ProcChance 20% → ProcDamageMult 3.5×, 미사일별 proc 체크 + applyAbilityMitigation + lethal markTargetDead)"
  - "src/lib/simulator/engine/combatLoop.ts:2060 (applyAstronautEffects — 정령족 BonusHealth + meeps stack) / :1878 (applyFateweaverEffects — 운명술사 Precision spellCanCrit + (4) crit, Lucky 미구현)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[caitlyn]]"
  - "[[poppy]]"
  - "[[spell-crit]]"
---

# 코르키 (Corki)

## 요약

4코스트 **정령족 (`TFT17_Astronaut`)** + **운명술사 (`TFT17_Fateweaver`)** trait. raw role `ADCaster`.

- **role**: `mapGameRole('ADCaster')` → sim **Caster** ([[role-passive]]). carry augment 없음.
- **ability "소행성 발사기"**: 저공 비행(dash) + 대상 및 2칸 내 적에 미사일 `BaseMissiles`(21)개 split. 미사일 MissileAD(scaleAD)+MissileAP(scaleAP), ProcChance(20%) 초강력(×3.5).
- **평타 미사일**: 평타 시 `MissilesPerLaunchAttack`(5) 추가 미사일 (sim 구현됨).

> 🎯 **Corki 는 "미사일 다발" carry** — active 21개 + 평타 5개 미사일. active 는 MissileAD split + Proc(기대값 ×1.5) 반영, MissileAP(부차 scaleAP) 만 미반영. [[caitlyn]] 와 동일 운명술사 (Precision/Lucky), [[poppy]] 와 동일 정령족.

> ⚠️ **set17 entity confirm**: `TFT17_Corki` apiName 으로 소속 확인 (cost 4, traits 정령족/운명술사, role ADCaster). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 30 / 30 |
| damage | 45 |
| attackSpeed | 0.8 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 60 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('ADCaster')` includes 'Caster' ([[role-passive]] Caster 마나 규칙) |

### Active — 소행성 발사기 (`ability.ts:246`)

raw desc: "주변 위치로 저공 비행한 뒤 대상 및 2칸 이내 모든 적에게 미사일을 `@BaseMissiles@`(21)개 나누어 발사. 미사일 `@ModifiedDamage@`(scaleAD scaleAP) 물리 + `@ProcChance@`(20)% 확률 초강력 미사일 `@ModifiedProcDamage@`(scaleAD)."

raw variables: `BaseMissiles` [21] / `MissileAD` [25,30,44,280,200] / `MissileAP` [6,5,7,24,30] / `ProcChance` [20] / `ProcDamageMult` [3.5]

**sim 적용** (`ability.ts:246`):
```ts
TFT17_Corki: { pattern: 'aoe_circle', radius: 2, dash: 'to_target', hitCount: 21, damageVar: 'MissileAD', procChance: 0.20, procDamageMult: 3.5 }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 저공 비행 (dash) | ✅ `dash: 'to_target'` | 현재 타겟으로 dash |
| 미사일 21개 split (`BaseMissiles`) | ✅ `hitCount: 21` | aoe_circle(≠single) → split → 총피해 `MissileAD × 21 / aliveTargets` 분배 (radius 2) |
| 미사일 damage (`MissileAD`, scaleAD) | ✅ `damageVar: 'MissileAD'` | no-filler `[25,30,44]` → ★1=25 / ★2=30 / ★3=44 |
| 미사일 scaleAP (`MissileAP`) | ❌ **미사용** | config `damageVar` 는 `MissileAD` 만 → `MissileAP` (filler ★1=5/★2=7/★3=24) 미참조. desc 미사일 = scaleAD+scaleAP 인데 active 는 scaleAD 만. **Lint P2** |
| ProcChance(20%) 초강력 (×3.5) | ✅ **기대값 반영** | config `procChance:0.20, procDamageMult:3.5` → `procExpectedMult = 1−0.2+0.2×3.5 = ×1.5` 를 hitCountTotal(main) / oorHitTotal(OOR) 에 적용. 결정론(N-run 평균 정합) |

> active 는 generic `hitCount` split (`MissileAD × 21`) + Proc 기대값(×1.5) 반영. MissileAP(scaleAP) 만 미반영 (damageVar MissileAD). 평타 미사일은 MissileAP 까지 반영.

### Passive — 평타 미사일 (`combatLoop.ts:6289-6320`)

raw: `MissilesPerLaunchAttack`(5) — 평타당 5 미사일.

**sim 적용** ✅ (평타 hook, `:6289` `apiName === 'TFT17_Corki'`):

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 평타당 5 미사일 (`MissilesPerLaunchAttack`) | ✅ | `numMissiles` 루프 5회 (`:6292`) |
| 각 미사일 MissileAD(physical) + MissileAP(magic) | ✅ | `physRaw = MissileAD × procFactor × (1+damageAmp)` + `magRaw = MissileAP × apFactor × procFactor × ...` (`:6303-6304`). 미사일별 `applyAbilityMitigation` (physical/magic 분리) |
| ProcChance 20% → ProcDamageMult 3.5× | ✅ | 미사일별 `rng.next() < procChance ? procMult : 1` (`:6301`, codex P2 PR #100) |
| lethal | ✅ | 미사일 lethal 시 `markTargetDead` + break (`:6314`) |

> **평타 미사일 = active 보다 정확** (MissileAD+MissileAP+Proc 모두 반영). active(21개)는 MissileAD split 만. 비대칭은 active 의 generic hitCount 처리 한계.

### 정령 추가 효과 (Meep) — 미반영

raw desc: "정령 추가 효과: `@ModifiedMeepCooldown@`(BaseMeepCooldown 8, CDRPerMeep) 초마다 대상에게 폭발성 정령 → 적중 시 반경 1칸 `@ModifiedMeepDamage@`(scaleAD) 물리."

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 정령 폭발 (MeepDamage scaleAD, BaseMeepCooldown 주기) | ❌ **미반영** | `MeepDamage`/`BaseMeepCooldown`/`CDRPerMeep` repo-wide grep **0 hit**. 정령족 활성 시 N초 주기 폭발 정령 sim 부재. **Lint P2** |

### 정령족 (`TFT17_Astronaut`) / 운명술사 (`TFT17_Fateweaver`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 정령족 (Astronaut) | ✅ | `applyAstronautEffects` (`:2060`) — BonusHealth flat + meeps stack (astronautMeepsStack). Corki 정령족 8명 중 하나 |
| 운명술사 (Fateweaver) | ⚠️ Precision/crit ✅ / Lucky ❌ | `applyFateweaverEffects` (`:1878`) — Precision (spellCanCrit) + (4) crit stat ✅. Lucky (행운, 확률 두 번 굴림) 미구현 (`:1775` 후속 PR) → Corki ProcChance/active proc 에 행운 미적용. **Lint P2** ([[caitlyn]] 와 동일) |

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Corki 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active aoe_circle dash + hitCount 21 MissileAD split | `ability.ts:246` |
| **OOR (out-of-range dash)** | ✅ Corki dash user — OOR cast 시 omnivamp heal 누락 방지 가드 (codex P1, `:7762`). dash to_target | `:7762` |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **평타 미사일** (`:6289`) + **Meep** (미반영) + **정령족/운명술사 trait** 는 cast pipeline 과 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 850, armor/MR 30, AD 45, AS 0.8, mana 0/60, range 4)
- role Caster (`mapGameRole('ADCaster')`)
- active aoe_circle dash + hitCount 21 MissileAD split (no-filler ★1=25/★2=30/★3=44)
- **평타 미사일** (MissilesPerLaunchAttack 5, MissileAD+MissileAP, ProcChance 20% 3.5×) ✅ 완전 반영
- **정령족 (Astronaut)** BonusHealth/meeps + **운명술사 (Fateweaver)** Precision/crit

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: active 미사일 (hitCount 21) MissileAP(scaleAP) 미반영 — damageVar MissileAD 만. Proc 는 procExpectedMult ×1.5 기대값으로 반영됨
- **P2**: Meep (정령 추가, MeepDamage/BaseMeepCooldown) 미반영 — grep 0
- **P2**: 운명술사 Lucky (행운, 확률 두 번) 미구현 (`:1775` 후속 PR)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P2 | active 미사일 MissileAP 미반영 | active config `damageVar='MissileAD'` + generic hitCount 21 split → MissileAP(scaleAP) 미참조. Proc 는 procExpectedMult ×1.5 로 반영됨 | **P2** | cast-time — active 미사일에 MissileAP 합산 (secondaryDamageVar 는 타겟당 1회 flat 이라 부적합, 별도 per-missile 구조 필요) | MissileAP 부차 누락(작음). proc 는 #fix 반영 |
| P2 | Meep (정령 추가) 미반영 | desc "정령 추가: BaseMeepCooldown 초마다 폭발 정령 MeepDamage(scaleAD) 1칸". 정령족 활성 시 N초 주기 폭발. grep 0 | **P2** | (b) tick — 정령족 활성 Corki 에 MeepCooldown 주기 폭발 정령 (CDRPerMeep 감소) | 정령족 시너지 추가 DPS. 별도 구현 |
| P2 | 운명술사 Lucky 미구현 | 확률 효과 두 번 굴림 — Corki ProcChance/active proc 에 영향. `:1775` 후속 PR | **P2** | rng — 운명술사 unit 확률 효과 better-of-2. trait 전반 | [[caitlyn]] 와 동일 (운명술사 trait 차원 별도 PR) |

> 📌 **평타 미사일 (MissileAD+MissileAP+Proc) + 정령족/운명술사 trait 는 sim 정합**. `partial` 사유는 active 미사일 비대칭 (MissileAP/Proc 미반영) + Meep 미반영 + 운명술사 Lucky 미구현 등 P2. active MissileAD split 주력은 반영.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Corki` apiName 확인 (cost 4, traits [정령족/운명술사], role ADCaster)
- [x] entity-wide grep `Corki` + `코르키` + `소행성` + `Meep` — sim site (active config / 평타 미사일 / Meep grep 0 / 정령족·운명술사)
- [x] raw stats 17.4 정합 (hp 850 / armor·MR 30 / AD 45 / AS 0.8 / mana 0·60 / range 4)
- [x] **raw role `ADCaster` → mapGameRole → Caster** — `includes('Caster')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — 평타 미사일 블록 (`:6289-6320`, numMissiles 루프 + MissileAD/AP + proc + lethal) + active config (`ability.ts:246` damageVar MissileAD 만) + 정령족/운명술사 helper
- [x] **변수 filler 판정** — MissileAD `[25,30,44]` no-filler ★1=25 / MissileAP `[6,5,7]` v0>v1 filler ★1=5 / BaseMissiles·ProcChance·ProcDamageMult·MissilesPerLaunchAttack 상수
- [x] **actual sim integration verify (5단계)** — 평타 미사일 MissileAD+MissileAP+Proc read 확인 (`:6289-6314`) / **active config damageVar MissileAD 만 → MissileAP/Proc 미반영 확인 P2** / **`MeepDamage`/`BaseMeepCooldown` grep 0 → Meep 미반영 P2**
- [x] **cast path 3종 (PR #129 룰)** — main (active aoe_circle ✅) / OOR (dash user omnivamp 가드 `:7762` ✅) / recast (carry 없음 ➖). 평타 미사일·Meep·trait 별개 경로
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 정령족 `TFT17_Astronaut` `applyAstronautEffects` (`:2060`) ✅ / 운명술사 `TFT17_Fateweaver` `applyFateweaverEffects` (`:1878`) Precision+crit ✅, Lucky 미구현 (P2). 둘 다 scaling.json synergies 아닌 별도 helper
- [x] **spell crit read site (PR #183 학습)** — 운명술사 Precision (spellCanCrit `:1785`) → Corki active cast 는 spell crit 가능. 평타 미사일 proc(ProcDamageMult)은 crit 아닌 별도 배수
- [x] **본문 Lint P2 3건 등록 → sim 미구현 기능 3건 존재 → 보수적 `sim_active: partial` 유지** (P0 case 없음 → 룰 #15 미해당)
- [ ] (선택) active 미사일 MissileAP+Proc / Meep / 운명술사 Lucky sim 도입 (P2)

## 관련

- [[role-passive]] — Caster role 마나 규칙 (공격당 7 / 초당 2 / 피격 ❌)
- [[ability-targeting]] — `aoe_circle` + dash + hitCount 21 split. cast path main/OOR (dash user)
- [[caitlyn]] — 동일 운명술사 (Fateweaver) Precision/Lucky. Lucky 미구현 공통. Corki 도 ProcChance 확률 효과
- [[poppy]] — 동일 정령족 (Astronaut) meeps stack
- [[spell-crit]] — 운명술사 Precision → Corki active spell crit 가능
- 코드: `src/lib/simulator/systems/ability.ts:246`, `src/lib/simulator/engine/combatLoop.ts:1878/2060/6289/7762`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Corki), `public/data/tft_set17_traits.json` (TFT17_Astronaut / TFT17_Fateweaver)
