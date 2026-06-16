---
id: ezreal
type: champion
display_name_kr: 이즈리얼
api_name: TFT17_Ezreal
cost: 1
traits:
  - 시간 균열자
  - 저격수
role: Caster   # raw "ADCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: ADCaster
current_patch_status: "active (17.4 데이터 기준 — 17.5/17.5b patch pending: Ability AD 160/240/365/620→170/255/380/650 (buff). 데이터/sim 미반영, [[patch-17-5]] 참조)"
sim_active: partial   # ability 「시간의 일격」 단일 파동 TotalDamage(scaleAD scaleAP) 물리. sim single, auto-detect damageVar 'ADDamage'(scaleAD, bonusAD #238). ADDamage filler ★1=160/★2=240/★3=365. 시간 균열자(Timebreaker)/저격수(Sniper RangedTrait) trait 정합. 드론 ✅ 반영 (permanentStacks ezreal_drones → cast 시 DroneDamage, combatLoop :7423-7434 main / :7755-7766 OOR — 단 전투 중 실시간 takedown 누적은 미추적, UI 사전설정 스택 의존). ⚠️ 미반영: APDamage(auto-detect 가 ADDamage 우선 pick) / 전투 중 실시간 takedown 누적 / TakedownsToForm3(60) 변신. calibration -25%(moderate)
last_verified: 2026-06-16
sources:
  - "public/data/tft_set17_champions.json (TFT17_Ezreal entry — cost 1, role ADCaster, traits [시간 균열자/저격수], hp 450, armor/MR 15/15, AD 40, AS 0.7, range 6, mana 0/30, ability variables ADDamage/APDamage/DroneDamage/TakedownsToDrone/TakedownsToForm3)"
  - "public/data/tft_set17_traits.json (TFT17_Timebreaker = 시간 균열자 bp 2/3/4 / TFT17_RangedTrait = 저격수 bp 2/3/4)"
  - "src/lib/simulator/systems/ability.ts:219 (TFT17_Ezreal: { pattern: 'single' } — auto-detect damageVar 'ADDamage')"
  - "src/lib/simulator/engine/combatLoop.ts:1984 applySniperEffects 저격수 (base+per-hex amp) / :2100 applyTimebreakerEffects 시간 균열자"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[milio]]"
  - "[[jhin]]"
---

# 이즈리얼 (Ezreal)

## 요약

1코스트 **시간 균열자 (`TFT17_Timebreaker`)** + **저격수 (`TFT17_RangedTrait`)** trait. raw role `ADCaster`. carry augment 없음.

- **role**: `mapGameRole('ADCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). mana 0/30 (저비용 — 빠른 시전). range 6 (최장).
- **ability**: 현재 대상에 파동 → `TotalDamage`(=`ADDamage` scaleAD + `APDamage` scaleAP) 물리. 처치 관여 `TakedownsToDrone`(8)회마다 드론 획득 → 스킬 사용 시 드론이 `DroneDamage`(scaleAD) 추가 물리.

> 🎯 **Ezreal 은 파동 + 드론 누적 캐스터** — 주 데미지 TotalDamage(ADDamage scaleAD) + 드론(permanentStacks) sim 반영. ⚠️ 전투 중 실시간 takedown 누적 + APDamage 부차는 미반영 → -25%.

> ⚠️ **set17 entity confirm**: `TFT17_Ezreal` apiName 으로 소속 확인 (cost 1, traits 시간 균열자/저격수, role ADCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 450 |
| armor / magicResist | 15 / 15 |
| damage | 40 |
| attackSpeed | 0.7 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 30 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('ADCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 시간의 일격 (파동 + 드론)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| ADDamage | [0, 160, 240, 365, ...] | ✅ auto-detect `damageVar 'ADDamage'` filler → ★1=160/★2=240/★3=365 (scaleAD, bonusAD #238) |
| APDamage | [0, 14, 21, 32, ...] | ⚠️ **미반영** — auto-detect 가 ADDamage 우선 pick (`DAMAGE_VAR_PRIORITY` ability.ts:416), APDamage 무시. 부차 scaleAP 작음. filler → ★1=14/★2=21/★3=32 |
| DroneDamage | [0, 8, 12, 18, ...] | ✅ **반영** — cast 당 `_ezrealDrones × DroneDamage × (1+damageAmp)` 물리 (combatLoop :7426). filler → ★1=8/★2=12/★3=18. 드론 수 = permanentStacks ezreal_drones(`:438` ⌊처치/8⌋, UI 사전설정) |
| TakedownsToDrone | [8, ...] | 처치 관여 8회마다 드론 1기. sim 은 permanentStacks(UI 입력)/8 로 드론 수 산출 (`:438`) — 전투 중 실시간 누적은 미추적 |
| TakedownTimerThreshold | [5, ...] | ⚠️ 미반영 — 처치 관여 누적 타이머(5초); sim 미추적 |
| TakedownsToForm3 | [60, ...] | 60 처치 시 3단 변신 (sim 미반영) |

- sim: `pattern: 'single'` (damageVar 미지정 → auto-detect `ADDamage`). 단일 대상 ADDamage(scaleAD).
- ✅ **드론 반영 (permanentStacks)**: `_ezrealDrones`(= permanentStacks ezreal_drones, UI 사전설정 ⌊처치/8⌋) × DroneDamage × (1+damageAmp) 를 cast 시 타겟에 물리 (main :7423-7434 / OOR :7755-7766). ⚠️ 전투 중 실시간 takedown 누적은 미추적 (사전설정 스택만). (UI preview droneDmg 도 raw DroneDamage[0,8,12,18] 로 정정 — 본 PR, types/index.ts).
- ⚠️ **APDamage 부차 미반영**: ★2=21 (ADDamage 240 대비 작음).

### Trait — 시간 균열자 (Timebreaker) / 저격수 (Sniper)

- **시간 균열자** (`TFT17_Timebreaker`, bp 2/3/4): `applyTimebreakerEffects` (`:2100`) — teamwide AS + 시간 균열자 unit 추가 AS.
- **저격수** (`TFT17_RangedTrait`, bp 2/3/4): `applySniperEffects` (`:1984`) — base damage amp + per-hex 거리 비례 amp (Ezreal range 6 로 거리 amp 수혜 큼).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 450, armor/MR 15, AD 40, AS 0.7, range 6, mana 0/30)
- role Caster (`mapGameRole('ADCaster')`)
- 단일 ADDamage(scaleAD, bonusAD #238) + 드론(permanentStacks × DroneDamage)
- 시간 균열자 / 저격수(거리 amp) trait

⚠️ **미반영** (Lint 후보):
- **P2**: 전투 중 실시간 takedown 누적 미추적 — 드론 수는 permanentStacks(UI 사전설정)로만 지정
- **P2**: APDamage 부차 scaleAP 미반영 (auto-detect ADDamage 우선)
- **P2**: TakedownsToForm3(60) 3단 변신 미반영
- calibration -25%(moderate): 실시간 takedown 누적 + APDamage 누락.

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[milio]] — 동류 시간 균열자
- [[jhin]] — 동류 저격수
