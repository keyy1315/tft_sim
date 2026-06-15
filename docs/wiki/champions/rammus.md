---
id: rammus
type: champion
display_name_kr: 람머스
api_name: TFT17_Rammus
cost: 4
traits:
  - 정령족
  - 요새
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank')). carry augment 없음
raw_role: APTank
current_patch_status: active
sim_active: partial   # 액티브 「중력 회전」: 보호막(ShieldAP) + 일직선 3칸 마법(DamageAP scaleAP + DamageArmor scaleArmor). scaleArmor 성분은 casterArmorScaleVar 로 main+OOR cast path 에서 caster armor 비례 가산(ability.ts:238 / combatLoop.ts:6589,7466). selfBuff durability 0.3 근사. 정령 패시브(정령족 active 게이트): 20회 피격 후 반경 2칸 magic AoE = PassivePercentArmor★ × armor (applyAstronautEffects precompute :2068 + defender 평타훅 :6436). 정령족 BonusHealth/Meeps applyAstronautEffects 적용 / 요새(ResistTank) teamwide armor/MR 정합. ⚠️ 미구현: 패시브 FlatDR(받는 공격 피해 감소, FlatDRPerMeep) / 패시브 AoE 는 sim 전투 단축(6~12s)으로 20회 threshold 실전만큼 미충족 → calibration 잔여 -74~98% (systemic duration, AS캡 #236 후에도)
last_verified: 2026-06-15
sources:
  - "public/data/tft_set17_champions.json (TFT17_Rammus entry — cost 4, role APTank, traits [정령족/요새], hp 1300, armor/MR 60/60, mana 20/90, ability '중력 회전' variables ShieldAP/ShieldDuration/DamageAP/DamageArmor/AttacksPerPassiveTrigger/PassivePercentArmor/FlatDRPerMeep/MeepsPerAstro)"
  - "public/data/tft_set17_traits.json (TFT17_Astronaut = 정령족 bp 3/5/7/10 / TFT17_ResistTank = 요새 bp 2/4/6)"
  - "src/lib/simulator/systems/ability.ts:238 (TFT17_Rammus: { pattern: 'line', maxTargets: 3, selfBuff: { durability: 0.3, duration: 4 }, damageVar: 'DamageAP', casterArmorScaleVar: 'DamageArmor' })"
  - "src/lib/simulator/engine/combatLoop.ts:6589,7466 (액티브 scaleArmor — rawAbilityDmgBase += readVarByStar(DamageArmor)★ × caster armor, main + OOR cast path)"
  - "src/lib/simulator/engine/combatLoop.ts:2048 applyAstronautEffects (정령족 active 시 rammusPassiveArmorCoef = PassivePercentArmor★ 저장 :2068) / :6436 defender 평타훅 (rammusHitsTaken 20회 → 반경 2칸 magic AoE coef×armor)"
  - "src/lib/simulator/engine/combatLoop.ts:1914 applyBastionEffects 요새(ResistTank) teamwide Armor/MR (:1903 JSDoc) / :2048 정령족(Astronaut) BonusHealth/Meeps"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[stargazer-fountain]]"
  - "[[chogath]]"
  - "[[leona]]"
---

# 람머스 (Rammus)

## 요약

4코스트 **정령족 (`TFT17_Astronaut`)** + **요새 (`TFT17_ResistTank`)** trait. raw role `APTank`. carry augment 없음.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 ✅).
- **base ability "중력 회전"**: `ShieldDuration`(4초) 동안 `ShieldAP` 보호막을 얻고, 이후 일직선 3칸 내 적에게 `DamageAP`(scaleAP) + `DamageArmor × caster armor`(scaleArmor) 마법 피해.
- **정령 패시브 (정령족 active 시)**: 받는 공격 피해량 `FlatDR` 감소 + `AttacksPerPassiveTrigger`(20)회 피격 후 반경 2칸에 `PassivePercentArmor × armor`(scaleArmor) 마법 AoE.

> 🎯 **Rammus 는 방어력 비례 데미지 탱커**. 액티브·패시브 모두 자기 armor 에 스케일(scaleArmor). 프론트라인에서 피격 누적 → 패시브 AoE 가 실질 주력 딜이나, **패시브는 정령족 trait active 가 전제** (raw 존재 ≠ 도달 가능 — bp 3 미달 시 미발동).

> ⚠️ **set17 entity confirm**: `TFT17_Rammus` apiName 으로 소속 확인 (cost 4, traits 정령족/요새, role APTank). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 1300 |
| armor / magicResist | 60 / 60 |
| damage | 60 |
| attackSpeed | 0.65 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 20 / 90 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| Rammus | Tank | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` → `includes('Tank')` → Tank ([[role-passive]]) |

### 액티브 「중력 회전」 — 보호막 + 일직선 3칸 (scaleAP + scaleArmor)

| 변수 | raw value | ★ 인덱싱 (readVarByStar) |
|------|-----------|------------------------|
| ShieldAP | [300, 675, 825, 2000, 2500, ...] | filler 아님(v0<v1) → idx=star−1 → ★1=300 / ★2=675 / ★3=825 |
| ShieldDuration | [4, 4, 4, ...] | 4초 고정 |
| DamageAP | [100, 50, 75, 700, ...] | filler(v0>v1) → idx=star → ★1=50 / ★2=75 / ★3=700 |
| DamageArmor | [3, 0.5, 0.75, 11, ...] | filler(v0>v1) → idx=star → ★1=0.5 / ★2=0.75 / ★3=11 |

- sim: `pattern: 'line', maxTargets: 3, damageVar: 'DamageAP'` (scaleAP) + **`casterArmorScaleVar: 'DamageArmor'`** → `rawAbilityDmgBase += DamageArmor★ × caster.armor` (main `combatLoop.ts:6589` + OOR `:7466`, cast-path 일관).
- 보호막: `getAbilityShield` 가 `ShieldAP`(scaleAP) 를 실제 `unit.shield` 로 적용(`:6748`, Rammus 예외 없음) **+** `selfBuff: { durability: 0.3, duration: 4 }` → `unit.damageReduction += 0.3`(`:7339`) 양쪽 동시 적용 (durability 는 근사 아님 — shield pool 과 별개 피해 감소).

### 정령 패시브 — 받는 피해 감소 + 20회 피격 후 반경 2칸 AoE (정령족 active 게이트)

| 변수 | raw value | 의미 |
|------|-----------|------|
| AttacksPerPassiveTrigger | [20, 20, ...] | 20회 피격마다 AoE 발동 |
| PassivePercentArmor | [0.5, 0.2, 0.3, 5, ...] | filler(v0>v1) → idx=star → ★1=0.2 / ★2=0.3 (armor 30%) / ★3=5 — AoE 데미지 계수 |
| FlatDRPerMeep | [4, 4, ...] | 받는 공격 피해 감소 (Meep 당) |

- desc: `<mainText enabled=TFT17_Astronaut_IsActive>` → **정령족(Astronaut) active 시에만** 발동.
- sim 패시브 AoE: `applyAstronautEffects` 가 정령족 active 시 `rammusPassiveArmorCoef = PassivePercentArmor★` 저장(`:2068`). defender 평타훅(`:6436`)에서 `rammusHitsTaken` 누적 ≥ 20 → 반경 2칸(`hexDistance ≤ 2`) 적에게 `coef × armor` 마법 AoE(`applyAbilityMitigation` + `markTargetDead` 귀속), 카운터 0 reset.
- ⚠️ **미구현**: `FlatDR`(받는 공격 피해 감소) 는 미모델 (방어 effect, 데미지 dealt 무관).

### Trait — 정령족 (Astronaut) / 요새 (ResistTank)

- **정령족** (`TFT17_Astronaut`, bp 3/5/7/10): `applyAstronautEffects` (`:2048`) BonusHealth flat + Meeps stack. Rammus 패시브 게이트도 본 trait active 기준.
- **요새** (`TFT17_ResistTank`, bp 2/4/6): teamwide Armor/MR + 요새 unit 추가 + 첫 N초 doubled (`applyBastionEffects :1914`).

## sim 통합 상태

`sim_active: partial`.

- ✅ 액티브 scaleArmor (DamageAP scaleAP + DamageArmor × caster armor), main + OOR cast path 일관.
- ✅ 정령 패시브 AoE (정령족 active 게이트, 20회 피격 → 반경 2칸 magic AoE = PassivePercentArmor★ × armor).
- ✅ 정령족 BonusHealth/Meeps + 요새 teamwide armor/MR.
- ⚠️ 패시브 `FlatDR` 미구현 (받는 피해 감소).
- ⚠️ **calibration 잔여 -74~98%**: 패시브 AoE 가 실전 주력 딜이나 sim 전투가 6~12s 로 단축돼(AS캡 #236 후에도) 20회 피격 threshold 를 실전(20~40s)만큼 못 채움 → systemic duration 한계. 액티브 scaleArmor 는 정합 기여. 회귀가드 `tests/unit/simulator/rammus-armor-scaling.test.ts` (active armor 성분 + 패시브 발동·딜 귀속 + 정령족 미발동 시 coef 0).

## 관련 문서

- [[role-passive]] — Tank role 마나/타게팅
- [[ability-targeting]] — line pattern 타게팅
- [[stargazer-fountain]] — 정령족(Astronaut) trait 메커니즘
- [[chogath]] / [[leona]] — 동류 탱커
