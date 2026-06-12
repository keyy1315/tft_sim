---
id: gnar
type: champion
display_name_kr: 나르
api_name: TFT17_Gnar
cost: 2
traits:
  - 정령족
  - 저격수
role: Specialist   # raw "ADSpecialist" → mapGameRole() → sim Specialist (types/index.ts includes('Specialist')). carry augment 없음
raw_role: ADSpecialist
current_patch_status: active
sim_active: partial   # 부메랑(DamageAD scaleAD) cast + 정령족(Astronaut)/저격수(Sniper) trait 정합. ⚠️ P1: 부메랑 발동 빈도 — sim 은 mana cast(line pattern)로 매 평타 발동(mana 0/5), raw 는 "평타 5회마다" → 빈도 ~5배 과다(empirical 확인) / P2: 부메랑 이중 발동 (cast(line) 매 평타 + scaling.json onAttack every:5 가 5번째 평타마다 추가 발동, 둘 다 active — onAttack 은 단일타겟·감소 미적용·scaling.json damageAD[★4]=525 vs raw 560) / P2: damageDecay 0.3 vs raw DamageReductionPerHit 0.75 관통 감소율 불일치 / P2: Meep(정령 추가 MeepPercentBAD/MeepASScaling/ModifiedMeepDPS) 미반영 grep 0 / P2: DamageAP(scaleAP) 미반영 (cast damageVar default)
last_verified: 2026-06-12
sources:
  - "public/data/tft_set17_champions.json (TFT17_Gnar entry — cost 2, role ADSpecialist, traits [정령족/저격수], mana 0/5, ability '새총 기동' variables DamageAD/DamageAP/DamageReductionPerHit/NumMeepsPerAstro/MeepPercentBAD/MeepASScaling)"
  - "public/data/tft_set17_traits.json (TFT17_Astronaut = 정령족 / TFT17_RangedTrait = 저격수)"
  - "src/types/index.ts (mapGameRole — 'ADSpecialist' includes 'Specialist' → Specialist)"
  - "src/lib/simulator/systems/ability.ts:209 (TFT17_Gnar: { pattern: 'line', maxTargets: 3, damageDecay: 0.3 } — 부메랑 관통 line cast)"
  - "src/lib/simulator/systems/ability.ts:289 (line case — caster→target 직선 관통 maxTargets)"
  - "src/lib/simulator/engine/combatLoop.ts:6722-6723 (damageDecay — `dmg *= Math.pow(1 - damageDecay, ti)` 관통 순번별 감소)"
  - "public/data/tft_set17_scaling.json (TFT17_Gnar — trigger onAttack every 5, extraDamage physical ad, damageAD [200,225,340,525] — 5번째 평타마다 추가 발동, cast(line)과 이중. raw DamageAD[★4]=560 과 525 불일치)"
  - "src/lib/simulator/engine/combatLoop.ts:2025 (applyAstronautEffects 정령족) + :1949 (applySniperEffects 저격수)"
  - "empirical probe (simulateCombat Gnar vs Shen — cast '새총 기동' 매 평타 발동 136 물리, attackCount=ability logs=14)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[corki]]"
  - "[[teemo]]"
  - "[[xayah]]"
---

# 나르 (Gnar)

## 요약

2코스트 **정령족 (`TFT17_Astronaut`)** + **저격수 (`TFT17_RangedTrait`)** trait. raw role `ADSpecialist`.

- **role**: `mapGameRole('ADSpecialist')` → sim **Specialist** ([[role-passive]]). carry augment 없음. mana 0/5.
- **ability "새총 기동"**: (passive) 기본 공격 5회마다 부메랑 — 처음 적 관통 후 2칸 더 날아갔다 복귀, `DamageAD`(scaleAD) 물리, 관통/적중마다 `DamageReductionPerHit`(75%) 감소. (정령 추가) 정령족 활성 시 `NumMeepsPerAstro` 정령이 매초 `MeepPercentBAD`/`MeepASScaling` 물리.

> 🎯 **Gnar 는 부메랑 AD specialist** — 단 **sim 모델링에 주의**: raw 는 부메랑이 "평타 5회마다" 패시브지만, **sim 은 `line` cast(mana 0/5)로 매 평타 발동** → 빈도 ~5배 과다 (empirical 확인). [[corki]]/[[teemo]] 처럼 정령 추가(Meep) 미반영, [[xayah]] 와 동일 저격수.

> ⚠️ **set17 entity confirm**: `TFT17_Gnar` apiName 으로 소속 확인 (cost 2, traits 정령족/저격수, role ADSpecialist). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 550 |
| armor / magicResist | 20 / 20 |
| damage | 50 |
| attackSpeed | 0.7 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 5 |

### Role — Specialist

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Specialist** | 1 | 10 | 0 | ❌ | `mapGameRole('ADSpecialist')` includes 'Specialist' ([[role-passive]] Specialist = 표준 10/공격) |

> ⚠️ mana **0/5** + Specialist 10/공격 → **1 평타마다 cast** (mana 즉시 충전). 부메랑이 cast 로 모델돼 매 평타 발동하는 원인 (아래 P1).

### Passive / Cast — 새총 기동 부메랑 (`ability.ts:209`)

raw desc: "기본 공격 **5회마다** 부메랑 — 처음 적중 적 관통해 2칸 더 날아갔다 복귀, `@ModifiedDamage@`(scaleAD scaleAP) 물리. 적중할 때마다 `@DamageReductionPerHit*100@`%(75%) 감소."

raw variables: `DamageAD` [200,225,340,...] / `DamageAP` [30,20,30,...] / `DamageReductionPerHit` [0.75]

**sim 적용** (`ability.ts:209`):
```ts
TFT17_Gnar: { pattern: 'line', maxTargets: 3, damageDecay: 0.3 }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 부메랑 관통 (line, 2칸) | ✅ `pattern: 'line', maxTargets: 3` | `ability.ts:289` caster→target 직선 관통, maxTargets 3 |
| 부메랑 피해 (`DamageAD`, scaleAD) | ✅ (cast damage) | empirical: cast "새총 기동 시전 136 물리" (★2 DamageAD 225 → decay/armor 후) |
| **발동 빈도 — "평타 5회마다"** | ❌ **매 평타 발동** | **sim 은 mana cast** — mana 0/5 + Specialist 10/공격 → 1 평타마다 cast. empirical: attackCount=14, ability(cast) logs=14 (매 평타). raw 는 5평타당 1회 → **빈도 ~5배 과다**. **Lint P1** |
| 관통 감소 (`DamageReductionPerHit` 75%) | ⚠️ **값 불일치** | sim `damageDecay: 0.3` (`combatLoop.ts:6722` `dmg *= (1-0.3)^ti`) = 순번당 30% 감소. raw `DamageReductionPerHit` 0.75 (75%). **Lint P2** |
| 부메랑 scaleAP (`DamageAP`) | ❌ **미반영** | raw 는 `<physicalDamage>@ModifiedDamage@(scaleAD scaleAP)` — 부메랑 전체가 **물리**, `DamageAP` 는 그 **물리 피해의 AP 스케일 계수**. cast `line` 은 `damageVar` default(scaleAD) → `DamageAP` (filler ★1=20) 미참조. **Lint P2** (AP 스케일 분이지만 magic 아님 — 물리) |

> ⚠️ **이중 발동 (double-fire)**: 부메랑이 **두 경로 모두 active** — (1) mana cast(line, mana 0/5)로 **매 평타** 발동 + (2) scaling.json **onAttack every:5** 핸들러(`combatLoop.ts:6275-6298`, `attackCount % 5 === 0`)가 **5번째 평타마다 추가** 발동 (단일 타겟, `damageReductionPerHit` 미적용, scaling.json `damageAD` 사용). 즉 5/10/15번째 평타는 **cast + onAttack 이중 타격**. raw 는 "평타 5회마다" 단일 부메랑인데 sim 은 매 평타 cast + 5평타마다 onAttack 추가 → 과다. 또한 onAttack 경로의 scaling.json `damageAD[★4]=525` 는 cast 경로가 쓰는 raw `DamageAD[★4]=560` 과 불일치(★4). **Lint P2** (모델 일원화 — onAttack every:5 채택 + cast(line)/mana 제거 검토).

### 정령 추가 효과 (Meep) — 미반영

raw desc: "정령 추가 효과: `@ModifiedNumMeeps@` 정령들이 나르와 함께 공격해 매초 `@ModifiedMeepDPS@`(scaleAD scaleAS) 물리."

raw variables: `NumMeepsPerAstro` [1] / `MeepPercentBAD` [0.23] / `MeepASScaling` [0.4]

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 정령 동반 공격 (MeepDPS, scaleAD scaleAS) | ❌ **미반영** | `MeepPercentBAD`/`MeepASScaling`/`NumMeepsPerAstro`/`ModifiedMeepDPS` repo-wide grep **0 hit**. 정령족 활성 시 매초 정령 DPS sim 부재 ([[corki]] Meep 동형). **Lint P2** |

> 참고: `astronautMeepsStack` (`:2040`) 는 **정령족 trait 의 meeps stack** (carry `spiritEffectPerStack` 용, `:6458`) — Gnar 의 부메랑 Meep DPS 와 별개.

### 정령족 (`TFT17_Astronaut`) / 저격수 (`TFT17_RangedTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 정령족 (Astronaut) | ✅ | `applyAstronautEffects` (`combatLoop.ts:2025`, 호출 `:4688-4689`) — BonusHealth + meeps stack. Gnar 정령족 8명 중 하나 ([[corki]]/[[teemo]] 동일) |
| 저격수 (Sniper / RangedTrait) | ✅ | `applySniperEffects` (`combatLoop.ts:1949`) + `computeSniperDamageAmp` — 거리 기반 damage amp. Gnar range 6 → 원거리 amp 수혜 ([[xayah]] 동일) |

> 룰 #16/#19: 두 trait 모두 generic 경로 (`applyAstronautEffects`/`applySniperEffects`) 존재 — champion-specific 구현 불필요하나 generic 경로 grep 은 매 champion 재검증.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Gnar 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ 부메랑 line cast (매 평타, mana 0/5) | `ability.ts:209`, `combatLoop.ts:6594` (findAbilityTargets line) |
| **OOR (out-of-range)** | ➖ line 은 dash 없음 (range 6) | `findAbilityTargets` line case (OOR config) |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **부메랑 발동 빈도/이중 정의** 이슈는 cast path 정합과 별개 (mana 값 + scaling.json onAttack 공존). 정령 추가(Meep)/trait 도 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 550, armor/MR 20, AD 50, AS 0.7, range 6, mana 0/5)
- role Specialist (`mapGameRole('ADSpecialist')`)
- 부메랑 line cast (관통 maxTargets 3, DamageAD scaleAD) — 피해 자체는 반영
- **정령족 (Astronaut)** BonusHealth/meeps + **저격수 (Sniper)** 거리 amp

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: 부메랑 발동 빈도 — sim mana cast(line) 매 평타 vs raw "평타 5회마다" → ~5배 과다 (empirical)
- **P2**: 부메랑 이중 발동 — cast(line) 매 평타 + scaling.json onAttack every:5 가 5번째 평타마다 추가 (둘 다 active, onAttack 은 단일타겟·감소 미적용)
- **P2**: `damageDecay` 0.3 vs raw `DamageReductionPerHit` 0.75 — 관통 감소율 불일치
- **P2**: Meep (정령 추가 MeepDPS) 미반영 (grep 0)
- **P2**: `DamageAP`(scaleAP) 미반영 — cast damageVar default(scaleAD)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | 부메랑 발동 빈도 ~5배 과다 | raw "평타 5회마다" 부메랑을 sim 은 mana cast(line, mana 0/5)로 **매 평타** 발동. empirical attackCount=cast logs=14 | **P1** | (a) cast 트리거 교정 — mana 모델 제거하고 scaling.json **onAttack every:5** 를 부메랑 effective 모델로 (또는 mana 5→~50 보정) | 부메랑 빈도 5배 → DPS over-model. 단 per-cast 데미지 보정 여부 측정 필요 (calibration). sim fix 후보 |
| P2 | 부메랑 이중 발동 | cast(line) 매 평타 + onAttack every:5 가 5/10/15번째 평타 추가 발동 (둘 다 active). onAttack 은 단일타겟·`damageReductionPerHit` 미적용·scaling.json damageAD(★4 525≠raw 560) | **P2** | data/cast — 단일 모델 채택 (onAttack every:5 권장 + cast(line)/mana 제거, raw 의도 정합) | 5평타마다 이중 타격 → 추가 over-damage. 모델 일원화 |
| P2 | damageDecay 0.3 vs raw 0.75 | 관통 적중 순번별 감소: sim 30% vs raw 75% | **P2** | cast config — `damageDecay: 0.3` → 0.75 (raw `DamageReductionPerHit`) | 관통 다중 적중 시 후순 타겟 over-damage |
| P2 | Meep (정령 추가) 미반영 | desc "정령족 활성 시 정령 매초 MeepDPS(scaleAD scaleAS)". grep 0 | **P2** | (b) tick — 정령족 Gnar 매초 정령 DPS ([[corki]] Meep 동형) | 정령족 시너지 추가 DPS |
| P2 | DamageAP(scaleAP) 미반영 | cast `line` damageVar default → scaleAD 만, `DamageAP` 미참조. raw `<physicalDamage>(scaleAD scaleAP)` — AP 스케일 분도 물리 | **P2** | cast-time — 부메랑 **physical** 피해에 `DamageAP × ap` 분 합산 (⚠️ **magic 아님** — raw `<physicalDamage>`, magic 처리 시 MR 로 경감돼 armor/MR 편향 타겟에서 Gnar 데미지 왜곡, codex P2 PR #223) | scaleAP 누락 (소량, filler ★1=20) |

> 📌 **부메랑 피해(DamageAD) + 정령족/저격수 trait 는 sim 반영**. `partial` 사유는 **부메랑 발동 빈도 P1(매 평타 vs 5평타)** + 이중 정의 + damageDecay/Meep/DamageAP 등 P2. 빈도 P1 은 mana 모델 vs onAttack 모델 선택 문제로 calibration 측정 후 sim fix 후보.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Gnar` apiName 확인 (cost 2, traits [정령족/저격수], role ADSpecialist)
- [x] entity-wide grep `Gnar` + `Meep`/`Astronaut`/`Sniper` — sim site (line cast / Meep grep 0 / 정령족·저격수 helper)
- [x] raw stats 17.4 정합 (hp 550 / armor·MR 20 / AD 50 / AS 0.7 / range 6 / mana 0·5)
- [x] **raw role `ADSpecialist` → mapGameRole → Specialist** — `includes('Specialist')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — line cast config (`ability.ts:209`) + line case (`ability.ts:289`) + damageDecay (`combatLoop.ts:6722`) + 정령족/저격수 helper
- [x] **actual sim integration verify (5단계) + empirical probe** — `simulateCombat(Gnar vs Shen)` 로 **부메랑 cast 매 평타 발동(136 물리, attackCount=cast logs=14) 실측 확인** → raw "평타 5회마다" 와 빈도 불일치 P1 / **scaling.json onAttack every:5 가 `attackCount % 5 === 0` 에 cast 와 별도 추가 발동 (이중 발동, 코드 verify) P2** / **`MeepPercentBAD`/`MeepASScaling` grep 0 → Meep 미반영 P2** / **damageDecay 0.3 vs raw 0.75 P2**
- [x] **cast path 3종 (PR #129 룰)** — main (line cast ✅) / OOR (dash 없음 ➖) / recast (carry 없음 ➖). Meep·trait 별개
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 정령족 `TFT17_Astronaut` `applyAstronautEffects` (`:2025/:4688`) ✅ / 저격수 `TFT17_RangedTrait` `applySniperEffects` (`:1949`) ✅. "verify 면제" 어휘 미사용
- [x] **본문 Lint P1 1건(부메랑 빈도) + P2 4건 등록 → 핵심 빈도 over-model 존재 → 보수적 `sim_active: partial` 유지** (P0 회귀 case 없음 → 룰 #15 미해당)
- [ ] (선택) 부메랑 모델 일원화 (onAttack every:5 채택 + mana 제거, P1) / damageDecay 0.75 / Meep / DamageAP (P2)

## 관련

- [[role-passive]] — Specialist role 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `line` (caster→target 직선 관통 maxTargets 3) + damageDecay. cast path main
- [[corki]] — 동일 정령족 (Astronaut) + Meep(정령 추가) 미반영 P2 공통
- [[teemo]] — 동일 정령족 멤버
- [[xayah]] — 동일 저격수 (Sniper) 거리 amp
- under-damage calibration (메모리 `project_underdamage_calibration`) — Gnar 는 반대로 부메랑 빈도 over-model (드문 over 사례)
- 코드: `src/lib/simulator/systems/ability.ts:209/289`, `src/lib/simulator/engine/combatLoop.ts:6722/2025/1949`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Gnar), `public/data/tft_set17_traits.json` (TFT17_Astronaut / TFT17_RangedTrait)
