---
id: fizz
type: champion
display_name_kr: 피즈
api_name: TFT17_Fizz
cost: 3
traits:
  - 정령족
  - 불한당
role: Assassin   # raw "APReaper" → mapGameRole() → sim Assassin (types/index.ts includes('Reaper')). carry augment 없음
raw_role: APReaper
current_patch_status: active (17.4 변경 없음 — 17.5 patch pending: DashDamage ★2~ 120/180/290→140/210/310 (★1=80 불변, buff). 데이터/sim 미반영, [[patch-17-5]] 참조)
last_verified: 2026-06-16
sim_active: partial   # ability 「정령 미끼」 관통 돌진 DashDamage(scaleAP) 마법 + 3회 사용마다 MegaMeep(ChompDamage=BiteDamageAP + 공중부양 stun 1.25 + 인접 SecondaryDamage 50%). sim line + dash to_target + secondaryDamageVar 'BiteDamageAP'. auto-detect 주 damageVar = DashDamage(fuzzy, no-filler) → ★1=80/★2=120/★3=180. 정령족(Astronaut)/불한당(AssassinTrait AD/AP) trait. ⚠️ **over-model**: secondaryDamageVar BiteDamageAP 가 3회째 MegaMeep nuke 를 매 캐스트·전 라인타겟에 적용(3-cast cadence 없음, line over-application). ⚠️ 미반영: MegaMeep stun(MegaMeepStunDuration 1.25) / 정령족 추가(MeepsPerAstro/BiteDamageMeep, desc computed MeepBonusDamage) / 인접 SecondaryDamage 별도 / 불한당 stealth(HealthThreshold/Duration). calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Fizz entry — cost 3, role APReaper, traits [정령족/불한당], hp 850, armor/MR 55/55, AD 30, AS 0.85, range 1, mana 0/20, ability '정령 미끼' variables DashDamage/BiteDamageAP/BiteDamageMeep/MeepsPerAstro/MegaMeepStunDuration/SecondaryDamage)"
  - "public/data/tft_set17_traits.json (TFT17_Astronaut = 정령족 bp 3/5/7/10 / TFT17_AssassinTrait = 불한당 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:244 (TFT17_Fizz: { pattern: 'line', dash: 'to_target', secondaryDamageVar: 'BiteDamageAP' } — auto-detect 주 damageVar 'DashDamage')"
  - "src/lib/simulator/engine/combatLoop.ts:6895-6898 secondaryDamageVar 가산 / :2060 applyAstronautEffects 정령족(IsActive 게이팅 :2079) / :579 불한당 AD/AP synergy"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[gwen]]"
  - "[[veigar]]"
---

# 피즈 (Fizz)

## 요약

3코스트 **정령족 (`TFT17_Astronaut`)** + **불한당 (`TFT17_AssassinTrait`)** trait. raw role `APReaper`. carry augment 없음.

- **role**: `mapGameRole('APReaper')` → sim **Assassin** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌). hp 850, armor/MR 55, range 1, mana 0/20 (매우 빠른 시전).
- **ability "정령 미끼"**: 현재 대상 관통 돌진 → `DashDamage`(scaleAP) 마법. **3회 사용마다** 초강력 정령(MegaMeep) 소환 → 대상 공중부양(`MegaMeepStunDuration` 1.25초) + `BiteDamageAP`(scaleAP) 마법, 인접 적 `SecondaryDamage`(50%). 정령(Astronaut) 추가효과: 미끼에 정령 `MeepsPerAstro` 추가 + MegaMeep 피해 증가(desc `@ModifiedMeepBonusDamage@` — raw variables 에 없는 computed 표현, `BiteDamageMeep`/정령족 보너스 기반).

> 🎯 **Fizz 는 관통 돌진 암살자(APReaper→Assassin)** — 주 `DashDamage` 관통 + 3회째 MegaMeep nuke. ⚠️ sim 은 MegaMeep `BiteDamageAP` 를 `secondaryDamageVar` 로 모델 → **3회 cadence 무시하고 매 캐스트·전 라인타겟에 적용**(over-model). stun/정령추가/인접피해 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Fizz` apiName 으로 소속 확인 (cost 3, traits 정령족/불한당, role APReaper). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE — 17.4 변경 없음)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 55 / 55 |
| damage | 30 |
| attackSpeed | 0.85 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 20 |

> ⚠️ **17.5 patch pending** (데이터 미반영, [[patch-17-5]]): `DashDamage` ★2~ 120/180/290 → **140/210/310** (★1=80 불변, buff).

### Role — Assassin

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Assassin** | 2 | 10 | 0 | ❌ | `mapGameRole('APReaper')` includes 'Reaper' ([[role-passive]]) |

### Active — 정령 미끼 (관통 돌진 + 3회째 MegaMeep)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| DashDamage | [80, 120, 180, 290, 470, ...] | ✅ auto-detect 주 `damageVar 'DashDamage'`(fuzzy) no-filler(v0<v1) → ★1=80/★2=120/★3=180 (scaleAP) |
| BiteDamageAP | [100, 185, 280, 445, 785, ...] | ⚠️ **over-model** — `secondaryDamageVar 'BiteDamageAP'` no-filler → ★1=100/★2=185/★3=280. **3회째 MegaMeep 전용인데 매 캐스트·전 라인타겟에 가산**(아래) |
| BiteDamageMeep | [70, 75, 115, 180, 320, ...] | ⚠️ **미반영** — 정령(Meep) 피해 |
| MeepsPerAstro | [1, ...] | ⚠️ **미반영** — 정령족 추가 정령 수 |
| MegaMeepStunDuration | [1.25, ...] | ⚠️ **미반영** — MegaMeep 공중부양 stun (config stun 없음) |
| SecondaryDamage | [0.5, ...] | ⚠️ **미반영** — MegaMeep 인접 적 50% 피해 (별도 모델 없음) |

- sim: `pattern: 'line', dash: 'to_target', secondaryDamageVar: 'BiteDamageAP'`. 관통 돌진 → 주 `DashDamage` + `BiteDamageAP`(secondaryDamageVar).
- ⚠️ **over-model (3회 cadence 무시)**: 실제 `BiteDamageAP`(MegaMeep ChompDamage)는 **3회 사용마다** 1회만 발동하나, sim 은 `secondaryDamageVar` 로 **매 캐스트** 가산. 또한 `combatLoop:6895-6898` per-target loop 라 line 관통 **전 타겟**에 `DashDamage + BiteDamageAP` 둘 다 적용(over-application, [[gwen]]/[[veigar]] 공통 구조). → Fizz 데미지 과대 가능.
- ⚠️ **MegaMeep stun/인접/정령추가 미반영**: 공중부양(1.25초)·인접 SecondaryDamage(50%)·정령족 MeepsPerAstro/MeepBonusDamage 모두 미모델.

### Trait — 정령족 (Astronaut) / 불한당 (AssassinTrait)

- **정령족** (`TFT17_Astronaut`, bp 3/5/7/10): `applyAstronautEffects` (`:2060`) — `TFT17_Astronaut_IsActive` 게이팅(`:2079`). 정령족 unit 효과.
- **불한당** (`TFT17_AssassinTrait`, bp 2/3/4/5): synergy scaling(`:579`)로 AD/AP 가산. ⚠️ raw 의 `HealthThreshold`(0.5)/`Duration`(3) = 체력 50% 이하 대상 시 3초 은신/재타게팅은 sim 미반영(AD/AP 만, [[gwen]] 동일).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 850, armor/MR 55, AD 30, AS 0.85, range 1, mana 0/20) — 17.4 변경 없음
- role Assassin (`mapGameRole('APReaper')`)
- 관통 돌진(line, to_target) + 주 `DashDamage`(scaleAP) + `BiteDamageAP`(secondaryDamageVar)
- 정령족(Astronaut) / 불한당(AD/AP) trait

⚠️ **미반영 / over-model** (Lint 후보):
- **P1 (sim-regression)**: BiteDamageAP **over-model** — 3회 cadence 무시(매 캐스트 가산, `castCount % 3` 처리 없음 — grep 0건) + line 전 타겟 over-application. AP carry ★3 기준 BiteDamageAP 가 DashDamage 대비 매 캐스트 추가돼 실효 데미지 ≈ +68% 과대(매 캐스트 460 vs 실제 평균 ~273). fix 방향: `castCount % 3 === 0` 조건부 (Aatrox `aatroxCycleCounter % 3` 패턴) — 단 calibration game-423/424 부재라 정량 검증 불가 → doc-only 보류. OOR path 는 secondaryDamageVar 없어 main/OOR 비대칭(OOR 는 BiteDamageAP 미적용)
- **P2**: MegaMeep stun(1.25초 공중부양) 미반영 (config stun 없음)
- **P2**: 정령족 추가(MeepsPerAstro/BiteDamageMeep, desc computed MeepBonusDamage) + 인접 SecondaryDamage(50%) 미반영
- **P2**: 불한당 stealth/retarget(HealthThreshold/Duration) 미반영 ([[gwen]] 동일)
- calibration: game-423/424 **부재(미측정)**. 17.5 DashDamage buff 데이터 미반영([[patch-17-5]]).

## 관련 문서

- [[role-passive]] — Assassin role 마나/타게팅
- [[gwen]] — 동류 정령족/불한당 Assassin + over-application/stealth 공통
- [[veigar]] — secondaryDamageVar over-application 공통 구조
