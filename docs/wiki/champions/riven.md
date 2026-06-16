---
id: riven
type: champion
display_name_kr: 리븐
api_name: TFT17_Riven
cost: 4
traits:
  - 시간 균열자
  - 불한당
role: Fighter   # raw "HFighter" → mapGameRole() → sim Fighter (types/index.ts includes('Fighter')). carry augment 없음
raw_role: HFighter
current_patch_status: active   # 17.4/17.5 변경 없음 (patch-17-4/17-5 champion list 미포함)
last_verified: 2026-06-16
sim_active: partial   # ability 「시간 왜곡」 hybrid(AP/AD 중 높은쪽) passive 평타 PassiveDamage + 돌진 시 Shield + 인접 베기 Damage + 3회마다 직선 파동 WaveDamage. sim aoe_circle r1 + dash to_target + secondaryDamageVar 'WaveDamage'. auto-detect 주 damageVar 'Damage' filler(v0>v1) → ★1=90/★2=135/★3=1000. 보호막 getAbilityShield(Shield filler ★1=100/★2=150/★3=1200). 시간 균열자(Timebreaker :2100)/불한당(AssassinTrait AD/AP :579). ⚠️ WaveDamage over-model(3회 cadence SpecialCastCount 무시 + aoe 전 타겟 over-application, Fizz 동형). ⚠️ 미반영: passive 평타(PassiveDamage — AD=0 hybrid) / 불한당 stealth / hybrid AP/AD 단일 타입 처리. calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Riven entry — cost 4, role HFighter, traits [시간 균열자/불한당], hp 1100, armor/MR 60/60, AD 0, AS 0.85, range 1, mana 0/20, ability '시간 왜곡' variables PassiveDamage/DashRange/Shield/ShieldDuration/Damage/WaveDamage/SpecialCastCount/ThirdCastConeHexRange)"
  - "public/data/tft_set17_traits.json (TFT17_Timebreaker = 시간 균열자 bp 2/3/4 / TFT17_AssassinTrait = 불한당 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:265 (TFT17_Riven: { pattern: 'aoe_circle', radius: 1, dash: 'to_target', secondaryDamageVar: 'WaveDamage' } — auto-detect 주 damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:6895-6898 secondaryDamageVar 가산 / getAbilityShield(ability.ts:505) Shield / :2100 applyTimebreakerEffects 시간 균열자(:2098 Riven 포함) / :579 불한당 AD/AP synergy"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[fizz]]"
  - "[[ezreal]]"
---

# 리븐 (Riven)

## 요약

4코스트 **시간 균열자 (`TFT17_Timebreaker`)** + **불한당 (`TFT17_AssassinTrait`)** trait. raw role `HFighter`(Hybrid Fighter). carry augment 없음.

- **role**: `mapGameRole('HFighter')` → sim **Fighter** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌). hp 1100, armor/MR 60, range 1, mana 0/20, **AD 0**(hybrid passive).
- **ability "시간 왜곡"**: 기본 지속 — AP/AD 중 **높은 능력치** 기준, 평타 시 `PassiveDamage`(AP/AD) 추가. 사용 시 주변 칸 돌진 → `ShieldDuration`(2초) `Shield` 보호막 + 인접 적 베기 `Damage`(AP/AD). **3회 사용마다**(`SpecialCastCount` 3) 도약 후 직선 파동 `WaveDamage`(AP/AD).

> 🎯 **Riven 은 hybrid(AP/AD) 돌진 파이터** — 돌진 베기 `Damage` + 3회째 파동 `WaveDamage` + 보호막. ⚠️ sim 은 [[fizz]] 와 동일하게 `WaveDamage` 를 `secondaryDamageVar` 로 모델 → **3회 cadence 무시 + aoe 전 타겟 over-application**. passive 평타(AD=0)·불한당 stealth 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Riven` apiName 으로 소속 확인 (cost 4, traits 시간 균열자/불한당, role HFighter). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE — 17.4 변경 없음)

| Stat | 값 |
|------|---|
| hp | 1100 |
| armor / magicResist | 60 / 60 |
| damage | **0** (hybrid passive — AP/AD 중 높은쪽) |
| attackSpeed | 0.85 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 20 |

### Role — Fighter

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Fighter** | 2 | 10 | 0 | ❌ | `mapGameRole('HFighter')` includes 'Fighter' ([[role-passive]]) |

### Active — 시간 왜곡 (돌진 + 3회째 파동)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [180, 90, 135, 1000, 1250, ...] | ✅ auto-detect 주 `damageVar 'Damage'` filler(v0>v1) → ★1=90/★2=135/★3=1000 (hybrid AP/AD) |
| WaveDamage | [300, 160, 240, 2000, 1350, ...] | ⚠️ **over-model** — `secondaryDamageVar 'WaveDamage'` filler → ★1=160/★2=240/★3=2000. 3회째 전용인데 매 캐스트·전 aoe 타겟에 가산(아래) |
| Shield | [160, 100, 150, 1200, 900, ...] | ✅ `getAbilityShield` filler(v0>v1) → ★1=100/★2=150/★3=1200. ⚠️ Shield 자체는 고정값(scaleAP 없음)이나 `getAbilityShield`(ability.ts:543) 가 desc 전체 `scaleAP` 검사로 `× (1+ap/100)` 적용 → AP 빌드 시 Shield 과대(systemic, Riven 고유 아님) |
| PassiveDamage | [50, 75, 115, 300, 400, ...] | ⚠️ **미반영** — passive 평타 추가 피해(AP/AD). AD=0 라 sim 평타 기여 작음. no-filler → ★1=50/★2=75/★3=115 |
| SpecialCastCount | [3, ...] | ⚠️ **미반영** — 3회마다 파동 발동 cadence (secondaryDamageVar 는 매 캐스트) |
| ShieldDuration | [2, ...] | (보호막 지속) |
| ThirdCastConeHexRange | [3, ...] | ⚠️ **미반영** — 파동 직선 사거리 (sim aoe_circle r1 로 근사) |

- sim: `pattern: 'aoe_circle', radius: 1, dash: 'to_target', secondaryDamageVar: 'WaveDamage'`. 돌진 → 주 `Damage` + `WaveDamage`(secondaryDamageVar) + 보호막(getAbilityShield).
- ⚠️ **WaveDamage over-model**: 실제 `WaveDamage` 는 **3회 사용마다**(`SpecialCastCount` 3) 1회 직선 파동인데, sim 은 `secondaryDamageVar` 로 **매 캐스트** 가산 + `combatLoop:6895-6898` per-target loop 라 aoe **전 타겟**에 `Damage + WaveDamage` 둘 다([[fizz]]/[[gwen]] 공통 over-application). → Riven 데미지 과대 가능.
- ⚠️ **passive 평타 미반영**: `PassiveDamage`(AP/AD higher) 평타 추가 피해 미모델 (AD=0 hybrid).
- ⚠️ **hybrid AP/AD**: 실제 AP/AD 중 높은쪽 기준이나 sim 은 `Damage` 단일 var + 단일 타입(`resolveDamageType`)으로 처리.

### Trait — 시간 균열자 (Timebreaker) / 불한당 (AssassinTrait)

- **시간 균열자** (`TFT17_Timebreaker`, bp 2/3/4): `applyTimebreakerEffects` (`:2100`) — teamwide AS + 시간 균열자 unit 추가 AS. Riven 포함(`:2098` Riven/Milio/Ezreal/Pantheon).
- **불한당** (`TFT17_AssassinTrait`, bp 2/3/4/5): synergy scaling(`:579`)로 AD/AP 가산. ⚠️ raw `HealthThreshold`(0.5)/`Duration`(3) stealth/retarget 미반영(AD/AP 만, [[fizz]]/[[gwen]] 동일).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1100, armor/MR 60, AD 0, AS 0.85, range 1, mana 0/20)
- role Fighter (`mapGameRole('HFighter')`)
- 돌진(to_target) + 주 `Damage` + `WaveDamage`(secondaryDamageVar) + 보호막(getAbilityShield Shield)
- 시간 균열자(AS) / 불한당(AD/AP) trait

⚠️ **미반영 / over-model** (Lint 후보):
- **P2**: WaveDamage over-model — 3회 cadence(`SpecialCastCount`) 무시(매 캐스트) + aoe 전 타겟 over-application ([[fizz]] 동형)
- **P2**: passive 평타(`PassiveDamage` AP/AD) 미반영 (AD=0 hybrid)
- **P2**: hybrid AP/AD 단일 타입 처리 / ThirdCastConeHexRange(파동 직선 3칸) aoe_circle r1 근사
- **P2**: 불한당 stealth/retarget(HealthThreshold/Duration) 미반영 ([[fizz]]/[[gwen]] 동일)
- **P2**: getAbilityShield AP 스케일 systemic — Shield 고정값인데 desc 전체 scaleAP 검사(ability.ts:543)로 AP 빌드 시 과대 (Riven 고유 아님, Nunu/Diana 등 동일)
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Fighter role 마나/타게팅
- [[fizz]] — 3회 cadence + secondaryDamageVar over-model 공통
- [[ezreal]] — 동류 시간 균열자
