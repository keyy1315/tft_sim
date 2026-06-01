---
id: galio
type: champion
display_name_kr: 거대 메크 로봇 (갈리오)
api_name: TFT17_Galio
cost: 4
traits:
  - 메카
  - 여행자
role: Tank   # raw "ADTank" → mapGameRole() → sim Tank (types/index.ts:41 includes('Tank'))
raw_role: ADTank
current_patch_status: active
sim_active: partial   # G1 resolved PR #165 sequence C-2 — selfBuff.durability star별 read 통합. G2 ARMARScaling damage 계수 / G3 투사체 끌어당김 / G5 변신 메커니즘 / G6 2 슬롯 + 중첩 / G7 주석 stale / G8 shockwave timing gap 잔존. 메카 + 여행자 trait 양쪽 정상 통합 (룰 #16 verify)
last_verified: 2026-05-27
sources:
  - "public/data/tft_set17_champions.json (TFT17_Galio entry — cost 4, role ADTank, traits 메카/여행자)"
  - "src/lib/simulator/systems/ability.ts:234 (TFT17_Galio: { pattern: 'aoe_circle', radius: 2, heal: true, selfBuff: { durability: 0.3, duration: 4 } })"
  - "src/lib/simulator/engine/combatLoop.ts:2148-2177 (applyMechaEffects — TFT17_Mecha trait 활성 시 메카 unit 한정 AD%/AP flat 가산)"
  - "src/lib/simulator/engine/combatLoop.ts:4590 (combat-start 시 applyMechaEffects 호출)"
  - "src/lib/simulator/engine/combatLoop.ts:1666-1700 (applyFlexTraitBuffs — TFT17_FlexTrait 여행자 trait, 탱커 shield + 비탱커 damageAmp + 여행자 챔프 ×2)"
  - "src/lib/simulator/engine/combatLoop.ts:4561-4562 (combat-start 시 applyFlexTraitBuffs 호출)"
  - "src/lib/simulator/engine/combatLoop.ts:3676-3931 (trySpawnGalio — ⚠️ set 16 잔존 코드, TFT16_Demacia + TFT16_Heroic trait 만 처리, set 17 Galio 와 무관)"
  - "src/lib/simulator/engine/combatLoop.ts:4382 (isGalioPlaceholder — `TFT16_Galio` 만 인식, set 17 Galio 는 일반 unit 으로 combat roster 포함)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[mordekaiser]]"
  - "[[poppy]]"
  - "[[shen]]"
---

# 거대 메크 로봇 (Galio)

## 요약

4코스트 **Tank** (raw `ADTank` → `mapGameRole()` → sim Tank, [[role-passive]]), **메카 (`TFT17_Mecha`)** + **여행자 (`TFT17_FlexTrait`)** trait. raw ability "중력 매트릭스" — DurabilityDuration 4초 방어 태세 (Durability×100% 내구력) + 매초 heal + 종료 시 HexRange 2칸 충격파 (ARMARScaling × armor + MR 물리 피해).

> 🎯 **TFT17_Galio = 메카 trait 의 "궁극 형태" (변신 후)**: 메카 trait raw desc — "메카 유닛은 궁극의 형태로 변신할 수 있으며, 변신 시 스킬이 업그레이드되고 체력을 `TransformedPercentHealth*100`% 얻습니다. 변신한 메카는 **2개의 팀 슬롯을 차지하며 메카 특성 중첩 2개로 간주**됩니다." → "거대 메크 로봇" 은 변신 후 형태 (= TFT17_Galio). 변신 메커니즘 자체는 sim 미반영 — Lint G5/G6 참조.

> ⚠️ Role 주의: raw `ADTank` → sim **Tank** (weight 3, 공격당 마나 5, 피격 시 마나 ✅). [[jax]] / [[nasus]] / [[mordekaiser]] / [[poppy]] (raw `APTank` → Tank) 와 다른 raw role 변형 (`ADTank`) — set17 4번째 ADTank → Tank 케이스. AD-scaling tank 라 mana 획득 + 공격력 비중 높음.

> ⚠️ **PR #149 P2 학습**: TFT17_Galio = **거대 메크 로봇** 으로 **set 17 챔피언 맞음** (한글 명세 "갈리오" 와 별개로 apiName grep ground truth verify). 이전 한글 list 만으로 "set 17 아님" 잘못 표기한 사례 → 0단계 apiName grep 필수.

## 메커니즘

### Stats (raw, 17.3 LIVE)

| Stat | 값 |
|------|---|
| hp | 1300 |
| armor / magicResist | 60 / 60 |
| damage | 70 |
| attackSpeed | 0.65 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 40 / 100 |

### Active — 중력 매트릭스 (Gravity Matrix)

raw desc: "`@DurabilityDuration@`초 동안 방어 태세에 진입해 내구력을 `@Durability*100@%` 얻습니다. 방어 태세일 때 주변 적 투사체를 끌어당기고 지속 시간 동안 체력을 `@ModifiedHeal@`(scaleAP) 회복합니다. 이 효과가 끝나면 충격파를 방출해 `@HexRange@`칸 내에 `@ModifiedDamage@`(scaleArmor scaleMR) 물리 피해를 입힙니다."

**sim 적용** (`ability.ts:234`):
```ts
TFT17_Galio: { pattern: 'aoe_circle', radius: 2, heal: true, selfBuff: { durability: 0.3, duration: 4 } }
```

| 단계 | sim 적용 | 비고 |
|------|---------|------|
| 방어 태세 진입 (4초) | ✅ `selfBuff.duration 4초` | DurabilityDuration 정합 |
| 내구력 (Durability) | ⚠️ **hardcoded 0.3** | raw star별 (★1=0.2, ★2=0.2, ★3=0.6) **미반영** — Lint G1 |
| heal (cast 1회 lump-sum) | ✅ `heal: true` 분기 진입 + star별 정상 read | `combatLoop.ts:6974-6977` `healVar.value[starIdx]` star별 정확 적용 (★1=900, ★2=1300, ★3=3000). 단 raw desc "지속 시간 동안 회복" (tick-based) vs sim cast 시점 1회 lump-sum 단순화 |
| 충격파 (종료 시) | ⚠️ `aoe_circle r=2` 진입은 정합, **단 timing gap** | HexRange 2 정합. damage 는 default fallback. **raw**: 4초 방어 태세 **종료 후** 충격파 발동. **sim**: cast loop 진입 즉시 aoe_circle damage 적용 (`combatLoop.ts:6482-6555`) → selfBuff 적용 (`:7001-7019`). delayed event queue 없음 — Lint G8 (Codex P2 catch) |
| 충격파 damage 계수 (ARMARScaling × armor + MR) | ❌ **미반영** | raw 가 armor + MR scaling 인데 sim 은 default ability damage (champion ability variables) 사용. ARMARScaling [★1=0.8, ★2=1.2, ★3=30] 미반영 — Lint G2 |
| 방어 태세 시 적 투사체 끌어당김 | ❌ **미반영** | projectile attraction 메커니즘 sim 자체 없음 — Lint G3 |

### raw ability variables (★1~★3 + sentinel filler)

| 변수 | raw 값 | sim 적용 | 비고 |
|------|--------|---------|------|
| `HexRange` | `[2, 2, 2, ...]` 전부 2 | ✅ `aoe_circle radius: 2` 정합 | 충격파 반경 |
| `Durability` | `[0, 0.2, 0.2, 0.6, 0.6, 0, 0]` ★1=0.2, ★2=0.2, ★3=0.6 | ⚠️ **hardcoded 0.3** | sim 은 star 무관 0.3 — ★1/★2 과적용 / ★3 과소적용 — Lint G1 |
| `DurabilityDuration` | `[4, 4, 4, ...]` 전부 4초 | ✅ `selfBuff.duration 4초` | |
| `ARMARScaling` | `[0, 0.8, 1.2, 30, 25, 0, 0]` ★1=0.8, ★2=1.2, ★3=30 | ❌ **미반영** | 충격파 damage 의 (armor + MR) 곱셈 계수. ★3 spike 30 — sim 영향 큼 — Lint G2. raw 값 patternspe 확인 필요 (★3 30 vs ★4 25 dip 이상 패턴 — sentinel?) |
| `Heal` | `[0, 900, 1300, 3000, 5000, 0, 0]` ★1=900, ★2=1300, ★3=3000 | ✅ **star별 정상 적용** — `combatLoop.ts:6974-6977` `healVar.value[starIdx]` (starIdx = Math.min(starLevel, length-1)) | cast 1회 lump-sum heal (line 6995). raw desc "지속 시간 동안 회복" 의 tick-based vs sim lump-sum 단순화 차이는 별도 P2 후보 |

### Trait — 메카 (TFT17_Mecha) + 여행자 (TFT17_FlexTrait)

**룰 #16 적용** (PR #160) — traits frontmatter 각 entry 별 `apply<Trait>Effects` + `unitHasTrait` 분기 grep 전수 verify 완료:

#### 메카 (`TFT17_Mecha`)

**raw spec** (`public/data/tft_set17_traits.json`):

| Tier | minUnits | AD | AP | TransformedPercentHealth | TeamSize |
|------|----------|-----|----|--------------------------|----------|
| (3) 에너지 전지 | 3 | **0.25** (25%) | **25** (flat) | 0.40 (변신 시 +40% HP) | +1 |
| (4) 과출력 전지 | 4 | **0.45** (45%) | **45** (flat) | 0.40 | +1 |
| (6) 정밀 엔지니어링 | 6 | 0.35 | 35 | 0.40 | +1 (**최대 팀 규모 +1**) |

> ⚠️ **AD 는 %, AP 는 flat 단위**. (4) tier 가 (6) tier 보다 AD/AP 더 높음 — (6) 의 핵심은 "최대 팀 규모 +1" 이고 stat 은 오히려 (4) 보다 낮음. sim 의 `applyMechaEffects` 주석은 (4) AD=0.35 AP=35 로 stale 표기 (실제 raw 는 0.45/45) — **Lint G7 후보 (코드 주석 stale)**.

**고유 메커니즘** (raw desc):
- 메카 유닛 = **궁극의 형태로 변신** 가능 (변신 시 스킬 업그레이드 + 체력 +40% / `TransformedPercentHealth`)
- 변신한 메카 = **2개의 팀 슬롯 차지** + **메카 특성 중첩 2개로 간주**
- "메카 변신기" 아이템으로 형태 전환

**sim 통합** (`applyMechaEffects` `combatLoop.ts:2148-2177`):
- ✅ `unitHasTrait(u, '메카')` 분기 (line 2168) 에서 메카 unit (Galio 포함) 한정 AD ratio % + AP flat 가산
- ✅ generic stat.ts AD/AP processing 에서 제외 (line 133 `if (at.trait.apiName === 'TFT17_Mecha') continue`) + 여기서 멤버 한정 후처리 (codex P1 회귀 가드)
- ✅ combat-start 시 `combatLoop.ts:4590` 양 팀 호출
- ❌ **변신 메커니즘 자체 sim 미반영** (Lint G5) — 메카 unit 의 일반 형태 vs 궁극 형태 전환 sim 없음. Galio 는 보드 배치 시 바로 "거대 메크 로봇" (궁극 형태) 으로 사용 가능
- ❌ **`TransformedPercentHealth` (+40% HP)** sim 미반영 (Lint G5 연동) — 변신 메커니즘 자체 부재
- ❌ **2 슬롯 + 중첩 2개 trait 카운트** sim 미반영 (Lint G6) — Galio 가 메카 trait counter 에 1개로만 계산 (raw 의도는 2개)
- ❌ **메카 변신기 아이템** sim 미반영
- ❌ **TeamSize +1** sim 미반영 — 보드 슬롯 개수 자체는 sim 외부 (UI/builder)

#### 여행자 (`TFT17_FlexTrait`)

`applyFlexTraitBuffs` (`combatLoop.ts:1666-1700`) ✅ **base sim 통합 완료**. `unitHasTrait(u, '여행자')` 분기 (line 1689) 에서 여행자 챔프 (Galio 포함) 한정 `multiplier = 2` 적용. 비여행자: 탱커=ShieldHP 시간 보호막, 비탱커=BonusDA damage amp. 여행자 챔프: 본인 role effect 만 ×2. combat-start 시 `combatLoop.ts:4561-4562` 양 팀 호출.

**Galio 가 여행자 챔프 = 본인 role Tank → ShieldHP × 2 보호막** (다른 여행자 챔프 와 차별)

## ⚠️ Set 16 잔존 코드 (set 17 Galio 와 무관)

`combatLoop.ts:3676-3931` `trySpawnGalio` 함수는 **set 16 데마시아 + 영웅 trait** 메커니즘 (대기석 갈리오 → 데마시아 결집 시 spawn + 착지 충격파 + 데마시아 결집 버프). **set 17 Galio (메크 로봇) 와 완전 무관**:

- 조건: `TFT16_Demacia` trait active + 팀 HP 손실 ≥ 25%
- 착지 시: `TFT16_Heroic` trait variables 사용 (hexRadius, percentMaxHP, knockupDuration)
- 데마시아 결집 버프: ArmorMR / ManaReductionPct / EnemyTrueDamage 적용

`isGalioPlaceholder` (`combatLoop.ts:4382`) 도 `TFT16_Galio` apiName 만 인식 — set 17 Galio (`TFT17_Galio`) 는 placeholder 가 아닌 **일반 unit 으로 combat roster 에 포함** + 보드에 배치된 그 위치에서 전투 시작. set 17 에서 trySpawnGalio 는 호출되어도 `TFT16_Demacia` trait 없으면 즉시 return — set 17 게임에 무해.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.3 정합 (hp 1300, armor/MR 60, AD 70, AS 0.65, mana 40/100, range 1)
- `mapGameRole` 결과 Tank role 룰 적용 (마나 / 타게팅 weight 3 / 피격 시 마나 ✅)
- `ability.ts:234` 등록: aoe_circle r=2 + heal + selfBuff (durability 0.3, duration 4)
- **Heal star별 정상 적용** — `combatLoop.ts:6974-6977` `healVar.value[starIdx]` star별 정확 read (★1=900, ★2=1300, ★3=3000) — cast 1회 lump-sum
- **메카 trait** ✅ — `applyMechaEffects` Galio 포함 AD%/AP 가산 (룰 #16 verify 완료)
- **여행자 trait** ✅ — `applyFlexTraitBuffs` Galio 포함 + 여행자 챔프 ×2 multiplier (룰 #16 verify 완료)
- 일반 unit 으로 combat roster 포함 (set 17 spawn 메커니즘 없음, 보드 배치 위치에서 시작)
- `trySpawnGalio` set 16 잔존 코드 — set 17 무관 (TFT16_Demacia 없으면 immediate return, 무해)

⚠️ **부정확 / 미반영** (Lint 후보):
- ~~**G1 (P1)**~~ ✅ **resolved PR #165 sequence C-2**: ~~selfBuff.durability hardcoded 0.3 — raw star별 미반영~~. ability.ts `durabilityVar: 'Durability'` 필드 + readVarByStar 통합 (main + OOR cast 양쪽). 추가로 OOR cast durability 분기 누락 (PR #129 cast path 3종 룰 위반) 도 함께 fix → ★1=0.2 / ★2=0.2 / ★3=0.6 정확 적용
- **G2 (P1)**: 충격파 damage 의 `ARMARScaling × (armor + MR)` 계수 미반영. raw 는 (armor + MR) × ARMARScaling 곱셈자인데 sim 은 default ability damage 사용. ★3 ARMARScaling 30 spike → sim 충격파 damage 손실 큼
- **G3 (P2)**: 방어 태세 "주변 적 투사체 끌어당김" 미반영 — projectile attraction 메커니즘 sim 자체 없음
- **G5 (P1)**: 메카 trait 변신 메커니즘 + `TransformedPercentHealth +40%` HP 가산 sim 미반영 — Galio 자체가 "변신 후 형태" 라 의도된 단순화 가능성 (보드 배치 시 이미 궁극 상태 가정), 단 다른 메카 unit 의 변신 후 형태 spec 별도 verify 필요
- **G6 (P1)**: 변신한 메카 = "2 슬롯 + 메카 특성 중첩 2개" sim 미반영 — Galio 가 메카 trait counter 에 1개로만 계산. tier 진입 부정확 가능성 (예: Galio 1명 + 다른 메카 2명 = sim 3개 = (3) tier vs raw 의도 4개 = (4) tier)
- **G7 (P2)**: `applyMechaEffects` 코드 주석 (line 2151-2154) stale — (4) AD=0.35 주석인데 raw 는 (4) AD=0.45. 코드 동작은 raw vars 직접 read 라 정합
- **G8 (P2)**: 충격파 (shockwave) timing gap — raw "4초 방어 태세 종료 시 충격파" 인데 sim 은 cast 진입 즉시 aoe_circle damage 적용. delayed event queue 없음 — 4초 동안의 kill / on-cast 효과 trigger 시점 부정확 (Codex P2 catch — PR #161)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| G1 | ~~selfBuff.durability hardcoded 0.3 — star별 (0.2/0.2/0.6) 미반영~~ ✅ **resolved PR #165 sequence C-2** | ~~★1/★2 damage reduction 과적용 / ★3 과소적용. star별 sim 정합 부족~~ | ~~P1~~ ✅ | (c) cast-time helper + ability.ts `durabilityVar` 필드 + readVarByStar 통합 (main + OOR cast 양쪽, **OOR durability 분기 누락도 함께 fix** — cast path 3종 룰 PR #129 일관성 회복) | **sim fix 완료** — `ability.ts:206` Galio selfBuff `durabilityVar: 'Durability'` 추가 + `combatLoop.ts:7018-7032` (main) + `:7177-7187` (OOR) 분기 readVarByStar 통합. raw `Durability [0, 0.2, 0.2, 0.6, ...]` star별 정확 적용 (★1=0.2, ★2=0.2, ★3=0.6) |
| G2 | 충격파 damage 의 ARMARScaling × (armor + MR) 계수 미반영 | ★3 ARMARScaling 30 spike → sim 충격파 damage 손실 큼. raw 가 armor + MR scaling 인데 sim default ability damage 사용 | **P1** | **(b) per-target loop** — aoe_circle 패턴 damage 는 `combatLoop.ts:6482-6548` per-target loop 에서 처리. 각 target 에 대해 caster `stats.armor + stats.magicResist` snapshot × ARMARScaling[star] 곱셈 적용 (caster stat 기반이라 target 무관 동일 damage) | sim fix 권장 — abilityOverride 에 새 필드 `armorMrScalingVar: 'ARMARScaling'` 신설 후 aoe_circle damage 분기에서 caster armor + MR × var[star] 곱셈 적용 |
| G3 | 방어 태세 "주변 적 투사체 끌어당김" 미반영 | projectile attraction 메커니즘 sim 자체 없음 | **P2** | (c) cast-time 1회 helper — selfBuff active 동안 적 projectile 의 target redirect. sim 에 projectile 메커니즘 없음 → 단순화 의도 가능성. 도메인 verify 필요 | 의도된 단순화 가능성 — 인게임 효과 측정 후 lint 등급 결정 |
| G5 | 메카 trait 변신 메커니즘 (일반 형태 ↔ 궁극 형태 전환) + `TransformedPercentHealth +40%` HP 가산 sim 미반영 | sim 은 메카 unit (Galio 포함) 을 항상 단일 형태로 처리. 변신 메커니즘 자체 부재 → +40% HP 가산 누락 + 스킬 업그레이드 분기 없음 | **P1** | (d) combat-start helper — 메카 변신기 사용 시점 / 또는 `applyMechaEffects` 내부에서 메카 unit 의 currentForm 분기 set. 변신 시 maxHp × 1.4 + currentHp 비례 가산 | 의도된 단순화 가능성 — Galio 자체가 "변신 후 형태" 라서 보드 배치 시 이미 궁극 상태로 가정 가능. 인게임 측정 + 도메인 spec verify 필요 |
| G6 | 변신한 메카 = **2 슬롯 + 메카 특성 중첩 2개로 간주** sim 미반영 | 메카 변신 unit (Galio + 변신된 Urgot / Aurelion Sol — `node -e` verify 결과 set17 메카 3 챔프) 가 메카 trait counter 에 1개로만 계산 (raw 의도는 변신 상태일 때 2개) → 메카 시너지 tier 진입 부정확 | **P1** | (d) combat-start helper — `resolveTraits` 단계에서 메카 unit 의 **transformation state** 모델링 (`isMechaTransformed` flag 등) 후 transformed === true 일 때 stack ×2 카운트. **Galio 만 +1 권장은 잘못** (Codex P2 catch) — untransformed Galio over-count + transformed Urgot/Aurelion Sol 누락 위험 | sim fix 권장 — transformation state 시스템 도입 후 메카 변신 unit 전체에 stack ×2 적용 (Galio specific 하드코딩 금지) |
| G7 | `applyMechaEffects` 주석 (line 2151-2154) stale (3) + (4) + (6) tier 모두 | (3) 주석 AD=0.20 AP=20 → raw AD=0.25 AP=25 stale / (4) 주석 AD=0.35 AP=35 → raw AD=0.45 AP=45 stale / (6) 주석 "4와 동일" → raw (4)≠(6) 모순 (실제 (6) AD=0.35 AP=35) | **P2** | 주석 cleanup (코드 동작 자체는 raw vars 직접 read 라 정합 — line 2164 `vars.AD`) | 후속 PR 에서 주석 정리 — 본 wiki PR scope 밖 |
| G8 | **충격파 (shockwave) timing gap** — raw "4초 방어 태세 종료 시 충격파" 인데 sim 은 cast 진입 즉시 aoe_circle damage 적용 | sim 의 충격파 damage 가 4초 일찍 발동 → 4초 동안의 kill / damage / on-cast 효과 trigger 시점 부정확. 정밀한 sim 회귀 평가 시 영향 (Codex P2 catch — PR #161) | **P2** | (c) cast-time 1회 helper → delayed event queue 패턴으로 변경 — selfBuff 만료 시점 (`+ DurabilityDuration × TICKS_PER_SECOND` 후) 에 shockwave aoe_circle damage 발동 | sim fix 권장 — delayed event 시스템 도입 또는 mordekaiserProcEndTick 식 별도 state field (`galioShockwaveEndTick`) 신설 후 main loop tick 에서 발동 |

**누적 base 미반영 lint**: Jax L1~L5 + Nasus N1~N4 + Mordekaiser M1 자동 무효 + Zed Z1 + Blitzcrank B1/B2/B3 + Poppy P1 + **Galio G1/G2/G3/G5/G6/G7/G8 (7)** = **21건 활성 + 1건 자동 무효** (G4 subagent self-catch 후 제거 + G8 Codex P2 추가 등록 — shockwave timing gap).

> 🎯 **룰 #16/#17 첫 적용 운영 (PR #160 후속) + subagent P1 self-catch 2건**: trait helper grep 전수 verify (룰 #16) → 메카 + 여행자 양쪽 정상 통합 verify 완료. 단 메카 trait 의 변신 메커니즘 / +40% HP / 2 슬롯 + 중첩 2개 (Lint G5/G6) 가 추가 자기-lint 등록됨. fix guidance 분기 명시 (룰 #17) 적용 — G1 (c) cast-time / **G2 (b) per-target loop 단독** (subagent P1-2 catch — 이전 `(a) 또는 (b)` 이중 제시 단일화) / G5/G6 (d) combat-start helper. **subagent P1-1 catch**: G4 (Heal star별 미반영) 오등록 → 실제 `combatLoop.ts:6974-6977` `healVar.value[starIdx]` star별 정상 read 확인 후 제거.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Galio` apiName 확인 (cost 4, traits ['메카', '여행자'], role ADTank, 한글명 "거대 메크 로봇" — PR #149 P2 학습)
- [x] entity-wide grep `Galio` + `galio` — sim 39+ site (단 대부분 `trySpawnGalio` set 16 잔존 코드, `isGalioPlaceholder` `TFT16_Galio` 만 인식)
- [x] raw stats 17.3 정합
- [x] **raw role `ADTank` → mapGameRole → sim Tank** — 4번째 base ADTank → Tank 케이스 (다른 ADTank champion 추가 검색 필요)
- [x] **룰 #16 메카 trait** — `applyMechaEffects` (`combatLoop.ts:2160-2177`) + `unitHasTrait(u, '메카')` (line 2168) 분기 정상 통합 verify
- [x] **룰 #16 여행자 trait** — `applyFlexTraitBuffs` (`combatLoop.ts:1666-1700`) + `unitHasTrait(u, '여행자')` (line 1689) 분기 정상 통합 verify
- [x] **trySpawnGalio set 16 잔존 코드** verify — `TFT16_Demacia` + `TFT16_Heroic` trait 만 처리, set 17 무관 (호출 시 set 17 에서 immediate return, 무해)
- [x] **isGalioPlaceholder `TFT16_Galio` 만 인식** verify — set 17 Galio 는 일반 combat roster 포함 (보드 배치 위치에서 전투 시작)
- [x] **ability.ts:234 등록** verify — `aoe_circle r=2 + heal + selfBuff (durability 0.3, duration 4)`. durability hardcoded 0.3 → star별 미반영 P1 raise (G1)
- [x] **ARMARScaling sim 부재** verify — `damageVar` 미설정 + abilityOverride 에 armor+MR scaling 필드 없음. P1 raise (G2)
- [x] **본문 Lint G1~G4 등록 → frontmatter `sim_active: partial` 강등** (룰 #15 적용)
- [x] **룰 #17 fix guidance 적용 분기 명시** (PR #160) — G1 (c) cast-time / **G2 (b) per-target loop 단독** (subagent P1-2 catch 단일화) / G3 (c) cast-time / G5/G6 (d) combat-start helper
- [x] **mechanic page sync (룰 #14)** — base champion ingest, 신규 cast roll 호출처 추가 없음 → spell-crit.md / mana.md last_verified 갱신 불요
- [ ] (선택) Heal raw values star별 적용 verify (G4)
- [ ] (선택) 메카 trait Galio 카운트 검증 — Galio 가 메카 trait counter 에 정상 포함되는지 (placeholder 가 아니라 일반 unit 으로 포함되므로 정상 예상)
- [ ] (선택) 다른 ADTank champion 추가 검색 — Tank family base mapping 누적 사례

## 관련

- [[role-passive]] — Tank role 마나/타게팅 규칙
- [[ability-targeting]] — `aoe_circle` 패턴 + selfBuff 적용 + heal 분기
- [[mordekaiser]] / [[poppy]] / [[jax]] / [[nasus]] — 동일 base Tank family (APTank → Tank, 4 챔프 누적)
- [[shen]] / [[zed]] / [[blitzcrank]] — 동일 Fighter family (raw APFighter/ADFighter → Fighter)
- 코드: `src/lib/simulator/systems/ability.ts:234`, `src/lib/simulator/engine/combatLoop.ts:2160/1666/3676/4382/4561/4590`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Galio)
- Lint history: PR #149 P2 (Galio set17 정정 — 한글 list 만 보고 set17 아님 잘못 표기)
