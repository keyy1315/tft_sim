---
id: morgana
type: champion
display_name_kr: 모르가나
api_name: TFT17_Morgana
cost: 4
traits:
  - 어둠의 여인
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank')). carry augment 없음
raw_role: APTank
current_patch_status: active
sim_active: partial   # ability 「어둠의 형상」 변신 5초 + 사슬 NumEnemies(3) 매초 TetherDamagePerSecond(scaleAP) 마법 DOT + 보호막 + 변신 종료 FinalDamage 버스트 + omnivamp 20% 패시브. sim multi maxTargets:3 + dot{duration:5, perSecond:true} → 사슬 DOT = TetherDamagePerSecond × 5 (Bard/Viktor/AurelionSol/Pantheon 동형 perSecond). damage var = TetherDamagePerSecond(fuzzy includes 'Damage' pick), filler(v0=0) → ★1=50/★2=75/★3=1500. 보호막 getAbilityShield(Shield scaleAP) 반영. 어둠의 여인(MorganaUniqueTrait) — applyMorganaDarklight(combatLoop:1904) 아군 전체 damageReduction +10%(fallback) ✅. ⚠️ 미반영: FinalDamage(변신 종료 버스트) / OmnivampPercent(20% — config heal:true 가 classifyHealVar 매칭 변수 없어 no-op) / trait raw Durability(0.04) 별도 보너스 미read 여부 verify. calibration: game-423 에 enemy 로 존재(playerDamage 미측정) — perSecond fix 로 enemy coupling 통해 diff-cache 변동(avgErr -0.298→-0.298, flat)
last_verified: 2026-06-16
sources:
  - "public/data/tft_set17_champions.json (TFT17_Morgana entry — cost 4, role APTank, traits [어둠의 여인], hp 1300, armor/MR 70/70, AD 60, AS 0.65, range 2, mana 30/90, ability '어둠의 형상' variables Shield/TetherDamagePerSecond/NumEnemies/FinalDamage/OmnivampPercent/Duration)"
  - "public/data/tft_set17_traits.json (TFT17_MorganaUniqueTrait = 어둠의 여인 bp 1 — unique trait, variables {816175b9}:0.10 / Durability:0.04)"
  - "src/lib/simulator/engine/combatLoop.ts:1904 applyMorganaDarklight (어둠의 여인 — 아군 damageReduction += UntransformedAbilityDA fallback 0.10, :4776-4777 호출)"
  - "src/lib/simulator/systems/ability.ts:280 (TFT17_Morgana: { pattern: 'multi', maxTargets: 3, heal: true, dot: { duration: 5, perSecond: true } } — fuzzy damageVar 'TetherDamagePerSecond')"
  - "src/lib/simulator/engine/combatLoop.ts:6813 (main) / :7676 (OOR) dot.perSecond → dotTotal = TetherDamagePerSecond × duration(5) / getAbilityShield(ability.ts:505) Shield / classifyHealVar(:197) OmnivampPercent → null (no-op)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[pantheon]]"
  - "[[aurelionsol]]"
---

# 모르가나 (Morgana)

## 요약

4코스트 **어둠의 여인 (`TFT17_MorganaUniqueTrait`)** unique trait. raw role `APTank`. carry augment 없음.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 ✅). hp 1300, armor/MR 70/70, range 2.
- **ability "어둠의 형상"**: 패시브 — 스킬 피해의 `OmnivampPercent`(20%) 회복. 사용 시 `Duration`(5)초 변신 + `Shield`(scaleAP) 보호막. 변신 동안 가장 가까운 적 `NumEnemies`(3)명을 사슬로 연결해 **매초** `TetherDamagePerSecond`(scaleAP) 마법. 변신 종료 시 연결된 적에게 `FinalDamage`(scaleAP) 마법 버스트.

> 🎯 **Morgana 는 변신형 사슬 DOT 탱커** — 사슬 피해 `TetherDamagePerSecond` 가 **매초** 적용이라 [[pantheon]]·[[aurelionsol]] 와 동일하게 `dot.perSecond` 로 × Duration(5) 반영. FinalDamage 버스트 + omnivamp 는 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Morgana` apiName 으로 소속 확인 (cost 4, traits 어둠의 여인, role APTank). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 1300 |
| armor / magicResist | 70 / 70 |
| damage | 60 |
| attackSpeed | 0.65 |
| range | 2 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 30 / 90 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` includes 'Tank' ([[role-passive]]) |

### Active — 어둠의 형상 (변신 + 사슬 DOT)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Shield | [300, 250, 300, 4000, ...] | ✅ `getAbilityShield`(ability.ts:505) — 'Shield' 변수 pick. filler(v0>v1: 300>250) → ★1=250/★2=300/★3=4000. scaleAP |
| TetherDamagePerSecond | [0, 50, 75, 1500, 3000, ...] | ✅ fuzzy `damageVar` (includes 'Damage') filler(v0=0) → ★1=50/★2=75/★3=1500 (scaleAP, **매초**) |
| NumEnemies | [3, ...] | ✅ `maxTargets: 3` — 사슬 연결 적 수 |
| FinalDamage | [0, 240, 360, 4000, ...] | ⚠️ **미반영** — 변신 종료 시 버스트 (지연 final burst 메커니즘 부재). filler → ★1=240/★2=360 |
| OmnivampPercent | [0.2, ...] | ⚠️ **미반영** — config `heal:true` 이나 `classifyHealVar`(combatLoop:197)가 OmnivampPercent 를 매칭 못 함(null) → resolveSelfHeal 0. ability omnivamp 20% 누락 |
| Duration | [5, ...] | ✅ `dot.duration: 5` |

- sim: `pattern: 'multi', maxTargets: 3, heal: true, dot: { duration: 5, perSecond: true }`. `dot.perSecond` → 사슬 DOT 총량 = `TetherDamagePerSecond★ × Duration(5)` (매초값 × 5, [[pantheon]] 동형).
- ⚠️ **FinalDamage 미반영**: 변신 종료 시 1회 버스트(★2=360)는 지연 final burst 모델 부재로 미적용.
- ⚠️ **omnivamp 미반영**: `heal:true` flag 가 있으나 OmnivampPercent 가 `classifyHealVar` 매칭 패턴(Healing/Heal/HealthGain/PercentHealing) 에 없어 no-op. ability 피해 20% 회복 누락.

### Trait — 어둠의 여인 (MorganaUniqueTrait)

- **어둠의 여인** (`TFT17_MorganaUniqueTrait`, bp 1): unique trait (단일 unit 전용). `applyMorganaDarklight` (combatLoop.ts:1904, 전투 시작 시 아군/적군 각 1회 `:4776-4777`) — 아군 전체 `damageReduction += UntransformedAbilityDA`(fallback 0.10 ≈ 10%, 90% cap). raw trait json 은 `UntransformedAbilityDA` 심볼 부재(`{816175b9}`: 0.10 해시 + `Durability`: 0.04) → 코드가 항상 fallback 0.10 사용(값은 `{816175b9}` 와 일치). ⚠️ raw `Durability`(0.04) 별도 보너스는 미read 여부 추가 verify 필요.

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1300, armor/MR 70, AD 60, AS 0.65, range 2, mana 30/90)
- role Tank (`mapGameRole('APTank')`)
- 사슬 DOT: `TetherDamagePerSecond★ × Duration(5)` (dot.perSecond), maxTargets 3
- 보호막 Shield(scaleAP, getAbilityShield)
- trait 어둠의 여인: `applyMorganaDarklight` (combatLoop.ts:1904) — 아군 전체 `damageReduction +10%`(fallback)

⚠️ **미반영** (Lint 후보):
- **P2**: FinalDamage(변신 종료 버스트, ★2=360) — 지연 final burst 메커니즘 부재
- **P2**: OmnivampPercent(20% ability omnivamp) — config heal:true 가 classifyHealVar 매칭 없어 no-op
- **P2**: 어둠의 여인 raw `Durability`(0.04) 별도 보너스 — `applyMorganaDarklight` 가 `UntransformedAbilityDA` 만 read(fallback 0.10) → Durability 4% 미read 여부 verify 필요
- calibration: game-423 에 **enemy** 로 존재(playerDamage 미측정). perSecond fix 로 enemy Morgana 사슬 5× → player units 약간 빨리 사망 → diff-cache 변동(avgErr -0.298→-0.298, flat). correctness fix ([[pantheon]] 동형, unit test 검증).

## 관련 문서

- [[role-passive]] — Tank role 마나/타게팅
- [[pantheon]] — dot.perSecond 동형 (초당값 × duration)
- [[aurelionsol]] — dot.perSecond 동형 DOT
