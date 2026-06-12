---
id: teemo
type: champion
display_name_kr: 티모
api_name: TFT17_Teemo
cost: 1
traits:
  - 우주 그루브
  - 길잡이
role: Marksman   # raw "APCarry" → mapGameRole() → sim Marksman (types/index.ts:43 includes('Carry')). carry augment 없음
raw_role: APCarry
current_patch_status: active
sim_active: partial   # onAttack passive 추가 마법(hitDamage scaleAP, ★1=30 filler) ✅ + active selfBuff AS + 우주그루브(SpaceGroove) 정합. P1: 독 DOT(MagicDamage/poisonDamage, PoisonDuration 6초) 미반영 — onAttack extraDamage 핸들러는 단일 hit 만 (Teemo 핵심 지속 피해 누락) / P1: active selfBuff attackSpeed 0.5 vs raw AttackSpeed 1.5 (3배 과소, ability.ts:195 하드코딩) / P2: active "ActiveAttacks 3회 평타 동안" vs sim duration 3 (selfBuff.duration read 0 → 영구) 메커니즘 불일치 / P2: SpaceGroove TheGroove(적 GrooveStacks 5 중첩 시) 미반영 grep 0 / P2: 길잡이(SummonTrait) apply 함수 없음
last_verified: 2026-06-12
sources:
  - "public/data/tft_set17_champions.json (TFT17_Teemo entry — cost 1, role APCarry, traits [우주 그루브/길잡이], ability '더블 타임' variables HitDamage/MagicDamage/PoisonDuration/GrooveStacks/AttackSpeed/ActiveAttacks)"
  - "public/data/tft_set17_traits.json (TFT17_SpaceGroove = 우주 그루브 / TFT17_SummonTrait = 길잡이)"
  - "src/types/index.ts:43 (mapGameRole — 'APCarry' includes 'Carry' → Marksman)"
  - "src/lib/simulator/engine/combatLoop.ts:6275-6298 (onAttack extraDamage 핸들러 — hitDamage 단일 magic hit 만, poison DOT 분기 없음)"
  - "src/lib/simulator/systems/ability.ts:195 (TFT17_Teemo: { pattern: 'self_buff', selfBuff: { attackSpeed: 0.5, duration: 3 } } — active AS 버프, raw AttackSpeed 1.5 와 불일치)"
  - "public/data/tft_set17_scaling.json (TFT17_Teemo — trigger onAttack, effect extraDamage/magic/ap, hitDamage [100,30,45,100], poisonDamage [60,70,105,190], poisonDuration 6, grooveStacks 5)"
  - "src/lib/simulator/engine/combatLoop.ts:1791 (applySpaceGrooveBuffs — 우주 그루브 매초 ADAP) / 길잡이 TFT17_SummonTrait apply 함수 grep 0"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[ivernminion]]"
---

# 티모 (Teemo)

## 요약

1코스트 **우주 그루브 (`TFT17_SpaceGroove`)** + **길잡이 (`TFT17_SummonTrait`)** trait. raw role `APCarry`.

- **role**: `mapGameRole('APCarry')` → sim **Marksman** (`includes('Carry')`, [[role-passive]]). carry augment 없음.
- **ability "더블 타임"**: (passive) 평타 시 `HitDamage`(scaleAP) 추가 마법 + `PoisonDuration`(6)초 동안 `MagicDamage`(scaleAP) **독 DOT 중첩** + 적 `GrooveStacks`(5) 중첩 시 티모 그루브 상태. (active) `ActiveAttacks`(3)회 평타 동안 AS `AttackSpeed`(150%).

> 🎯 **Teemo 는 독 DOT AP carry** — 단 **sim 은 평타 추가 마법(hitDamage) 만 반영, 독 DOT(MagicDamage) 미반영** (P1). active AS 버프도 sim 0.5 vs raw 1.5 (P1). 1코 carry 의 핵심 지속 피해가 빠져 있어 under-damage calibration 대상 (메모리 `project_underdamage_calibration`).

> ⚠️ **set17 entity confirm**: `TFT17_Teemo` apiName 으로 소속 확인 (cost 1, traits 우주 그루브/길잡이, role APCarry). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 450 |
| armor / magicResist | 15 / 15 |
| damage | 15 |
| attackSpeed | 0.7 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 50 |

### Role — Marksman

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Marksman** | 1 | 10 | 0 | ❌ | `mapGameRole('APCarry')` includes 'Carry' → Marksman (`types/index.ts:43`, [[role-passive]]) |

> ⚠️ raw role 이 `APCarry`(AP 캐스터형)지만 `mapGameRole` 은 'Carry' 매칭으로 **Marksman** 반환 (Caster 아님) — 공격당 10 마나 / 초당 0 / 피격 ❌.

### Passive — 평타 추가 마법 + 독 DOT (`combatLoop.ts:6275-6298`)

raw desc: "기본 공격 시 `@ModifiedHitDamage@`(scaleAP) 추가 마법 피해 + `@PoisonDuration@`(6)초 동안 `@ModifiedMagicDamage@`(scaleAP) 추가 마법 피해. 지속 피해 중첩. 적 중첩이 `@GrooveStacks@`(5) 이상이면 티모가 그루브 상태."

raw variables: `HitDamage` [100,30,45,100,...] / `MagicDamage` [60,65,95,170,...] / `PoisonDuration` [6] / `GrooveStacks` [5]

**sim 적용** (onAttack scaling, `getChampionScaling` trigger `onAttack`):

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 평타당 추가 마법 (`HitDamage`, scaleAP) | ✅ | `:6280` `effType === 'extraDamage'` → `dmgArr = hitDamage`, `starValue(dmgArr, starLevel)` (`ability.ts:565`, `arr[starLevel]` 직접 인덱싱) + magic resistance/pen. **HitDamage [100,30,45,100] (idx0=dummy 100) → ★1=arr[1]=30 / ★2=45 / ★3=100** |
| 독 DOT (`MagicDamage`, `PoisonDuration` 6초, 중첩) | ❌ **미반영** | onAttack `extraDamage` 핸들러 (`:6279-6297`) 는 **단일 hit 만** 적용 — poison/DOT 분기 없음. scaling.json `poisonDamage`/`poisonDuration` 미참조. **Teemo 핵심 지속 피해 누락. Lint P1** |
| 적 5중첩 시 티모 그루브 (`GrooveStacks`) | ❌ **미반영** | `GrooveStacks`/`TheGroove` repo-wide grep **0 hit**. 독 중첩 자체가 미모델이라 그루브 트리거도 부재. **Lint P2** |

> ⚠️ sim 은 **즉시 추가 마법(hitDamage) 만** 반영하고 **독 DOT(MagicDamage 6초 중첩) 은 미반영**. Teemo 의 주력 지속 피해가 빠져 있어 1코 AP carry DPS 가 크게 과소. scaling.json `poisonDamage [60,70,105,190]` 는 raw `MagicDamage [60,65,95,170]` 와 **~8-12% 불일치** (★1 65→70 / ★2 95→105 / ★3 170→190, 둘 다 sim 미참조). 독 DOT fix 시 **raw json(MagicDamage) 기준** (룰 #20 — raw json ground truth).

### Active — 공격 속도 버프 (`ability.ts:195`)

raw desc: "사용 시: `@ActiveAttacks@`(3)회의 기본 공격 동안 공격 속도를 `@AttackSpeed*100@`%(150%) 얻습니다."

raw variables: `AttackSpeed` [1.5] / `ActiveAttacks` [3]

**sim 적용** (`ability.ts:195`):
```ts
TFT17_Teemo: { pattern: 'self_buff', selfBuff: { attackSpeed: 0.5, duration: 3 } }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| AS 버프 발동 | ✅ `pattern: 'self_buff'` + `selfBuff.attackSpeed` | `:7176-7189` `unit.stats.attackSpeed *= (1 + 0.5)` |
| AS +150% (`AttackSpeed` 1.5) | ❌ **3배 과소** | sim `selfBuff.attackSpeed: 0.5` (+50%) vs raw `AttackSpeed` [1.5] (+150%). `ability.ts:195` 하드코딩 0.5 — raw 미반영. **Lint P1** |
| 3회 평타 동안 (`ActiveAttacks` 3) | ❌ **메커니즘 불일치** | sim `duration: 3` 선언만 — `selfBuff.duration` read site 0 (`:7176` 영구 `*= 1.5`). raw 는 "3회 평타 동안" (attack-count 기반), sim 은 영구 (revert 없음). **Lint P2** |

### 우주 그루브 (`TFT17_SpaceGroove`) / 길잡이 (`TFT17_SummonTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 우주 그루브 (SpaceGroove) | ✅ | `applySpaceGrooveBuffs` (`combatLoop.ts:1791`) — 그루비안 활성 시 매 1초 ADAP +N% (`spaceGrooveAdapPerSec`, `spaceGrooveDurationSec` 동안). Teemo 우주 그루브 멤버 |
| 길잡이 (Summon / `TFT17_SummonTrait`) | ❌ **미반영** | `applySummonTrait`/`SummonTrait` apply 함수 grep **0 hit** (trait.ts:41 emblem 매핑만). 소환 trait — 소환수 메커니즘 sim 부재. **Lint P2** |

> 룰 #16/#19: 우주 그루브는 generic 경로 (`applySpaceGrooveBuffs`) 존재 ✅. 길잡이는 apply 함수 부재 → 미반영 (verify 면제 아님, 매 champion grep 재검증).

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Teemo 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active self_buff (AS 버프) | `ability.ts:195`, `combatLoop.ts:7176` (selfBuff) |
| **OOR (out-of-range)** | ➖ self_buff 는 caster self-target (dash 무관) | `findAbilityTargets` self_buff case |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **평타 추가 마법 + 독 DOT** (onAttack `:6275`) 은 cast pipeline 과 별개 (평타 hook). 우주 그루브/길잡이 trait 도 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 450, armor/MR 15, AD 15, AS 0.7, range 4, crit 0.25/1.4, mana 0/50)
- role Marksman (`mapGameRole('APCarry')`)
- **평타 추가 마법** (onAttack hitDamage scaleAP, ★1=30 filler) ✅
- active selfBuff AS 발동 (단 값 0.5 ≠ raw 1.5)
- **우주 그루브 (SpaceGroove)** 매초 ADAP

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: 독 DOT (`MagicDamage`, `PoisonDuration` 6초 중첩) 미반영 — onAttack extraDamage 핸들러 단일 hit 만. Teemo 핵심 지속 피해 누락
- **P1**: active selfBuff `attackSpeed: 0.5` vs raw `AttackSpeed` 1.5 — 3배 과소 (`ability.ts:195` 하드코딩)
- **P2**: active "3회 평타 동안" vs sim duration 3 (selfBuff.duration read 0 → 영구) — attack-count 기반 메커니즘 불일치
- **P2**: SpaceGroove TheGroove (적 GrooveStacks 5 중첩 시 그루브 상태) 미반영 (grep 0)
- **P2**: 길잡이 (SummonTrait) 미반영 — apply 함수 부재 (소환 trait)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | 독 DOT 미반영 | passive 핵심 = `MagicDamage`(scaleAP) `PoisonDuration`(6초) 중첩 DOT. onAttack `extraDamage` 핸들러(`:6279`)는 단일 hit 만 → DOT 미적용 | **P1** | (b) per-attack — 평타 hit 시 target 에 `poison` statusEffect 추가 (DOT helper `:5009` 패턴 차용, scaleAP magic, 6초 중첩) | Teemo 주력 DPS 누락 → 1코 AP carry under-damage. sim fix 후보 |
| P1 | active AS 0.5 vs raw 1.5 | `ability.ts:195` `selfBuff.attackSpeed: 0.5` 하드코딩 — raw `AttackSpeed` [1.5] (+150%) 의 1/3 | **P1** | (c) cast-time — `selfBuff.attackSpeed` 0.5 → raw `AttackSpeed` read (1.5) 또는 config 1.5 교정 | active AS 버프 3배 과소. sim fix 후보 |
| P2 | active 3회 평타 vs 영구 | raw "3회 평타 동안" (attack-count), sim duration 3 미반영 → 영구 `*=1.5` | **P2** | (c) cast-time + attack-count 만료 — `ActiveAttacks` 평타 소비 후 AS 복원 (최신상 GravBooster `NumAttacks` 패턴 `:5936/6090` 차용) | AS 버프 영구화 (over-model) |
| P2 | SpaceGroove TheGroove 미반영 | 적 GrooveStacks(5) 중첩 시 Teemo 그루브 상태 — grep 0. 독 중첩 미모델이라 트리거 부재 | **P2** | (b) per-attack 누적 + 상태 진입 — 독 stack 모델 선행 필요 | 독 DOT(P1) 의존 후속 |
| P2 | 길잡이 (SummonTrait) 미반영 | `applySummonTrait` 함수 부재 (소환 trait) — emblem 매핑만 | **P2** | trait — 소환수 메커니즘 별도 구현 | 소환 trait 차원 별도 PR |

> 📌 **평타 추가 마법(hitDamage) + active AS 발동 + 우주 그루브 trait 는 sim 정합**(값/메커니즘 정정 필요). `partial` 사유는 **독 DOT 미반영(P1)** + active AS 3배 과소(P1) 등 핵심 누락. 독 DOT 은 Teemo 주력이라 sim fix 우선 후보.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Teemo` apiName 확인 (cost 1, traits [우주 그루브/길잡이], role APCarry)
- [x] entity-wide grep `Teemo` + `poison`/`Groove` + `SummonTrait` — sim site (onAttack hitDamage / 독 DOT 미반영 / SpaceGroove / 길잡이 grep 0)
- [x] raw stats 17.4 정합 (hp 450 / armor·MR 15 / AD 15 / AS 0.7 / range 4 / mana 0·50)
- [x] **raw role `APCarry` → mapGameRole → Marksman** — `includes('Carry')` (`types/index.ts:43`). carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — onAttack extraDamage 핸들러 (`:6275-6298`, 단일 hit 만 — poison DOT 분기 없음 확인) + active config (`ability.ts:195` selfBuff 0.5) + selfBuff apply (`:7176`)
- [x] **변수 인덱싱 판정** — onAttack 핸들러는 `starValue(dmgArr, starLevel)` (`ability.ts:565` `arr[starLevel] ?? arr[1]` 직접 인덱싱 — `readVarByStar` 의 filler-aware 로직 아님, [dummy,★1,★2,★3] placeholder 컨벤션 가정) → HitDamage `[100,30,45,100]` ★1=arr[1]=30/★2=45/★3=100 (idx0=100 dummy) / MagicDamage `[60,65,95]` (★1=60) 는 placeholder 컨벤션 무관, onAttack 미참조 / PoisonDuration·GrooveStacks·AttackSpeed·ActiveAttacks 상수
- [x] **actual sim integration verify (5단계)** — onAttack hitDamage read 확인 (`:6280`) / **`MagicDamage`/`poisonDamage`/`poisonDuration` DOT read site 0 → 독 미반영 P1** / **active `selfBuff.attackSpeed: 0.5` ≠ raw `AttackSpeed` 1.5 → P1** / **`GrooveStacks`/`TheGroove` grep 0 → P2** / **`SummonTrait` apply 함수 grep 0 → 길잡이 미반영 P2**
- [x] **cast path 3종 (PR #129 룰)** — main (active self_buff ✅) / OOR (self-target ➖) / recast (carry 없음 ➖). 평타 passive·trait 별개 경로
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 우주 그루브 `TFT17_SpaceGroove` `applySpaceGrooveBuffs` (`:1791`) ✅ / 길잡이 `TFT17_SummonTrait` apply 함수 grep 0 → 미반영 (P2). "verify 면제" 어휘 미사용
- [x] **본문 Lint P1 2건(독 DOT / active AS) + P2 3건 등록 → 핵심 sim 미반영 존재 → 보수적 `sim_active: partial` 유지** (P0 회귀 case 없음 → 룰 #15 미해당)
- [ ] (선택) 독 DOT sim fix (P1) / active AS 0.5→1.5 (P1) / TheGroove / 길잡이 (P2)

## 관련

- [[role-passive]] — Marksman role 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `self_buff` (caster self-target). cast path main only
- [[ivernminion]] — 동일 길잡이 (Summon) trait (양쪽 미반영 가능 — SummonTrait apply 부재)
- under-damage calibration (메모리 `project_underdamage_calibration`) — Teemo 독 DOT(P1) + active AS(P1) 미반영 = 1코 AP carry under-damage 사례
- 코드: `src/lib/simulator/engine/combatLoop.ts:6275/7176/1791`, `src/lib/simulator/systems/ability.ts:195`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Teemo), `public/data/tft_set17_traits.json` (TFT17_SpaceGroove / TFT17_SummonTrait)
