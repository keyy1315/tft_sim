---
id: gwen
type: champion
display_name_kr: 그웬
api_name: TFT17_Gwen
cost: 2
traits:
  - 우주 그루브
  - 불한당
role: Assassin   # raw "APReaper" → mapGameRole() → sim Assassin (types/index.ts includes('Reaper')). carry augment 없음
raw_role: APReaper
current_patch_status: active (⚠️ 17.3 데이터 기준 — raw 17.4 partial dataset(Zed/Shen/Jax 만 갱신)이 Gwen 미갱신. 17.4 pending: armor 45→50, Damage ★3/★4 380/650→410/700 ([[patch-17-4]]:84) / 17.5 pending: AreaDamage ★3 190→215, AS 0.85→0.8 ([[patch-17-5]]). 모두 데이터/sim 미반영)
last_verified: 2026-06-16
sim_active: partial   # ability 「춤추고 토막내기」 체력 최저 적에 돌진 → 대상 Damage(scaleAP) + 원뿔 AreaDamage(scaleAP) 마법. sim cone r2 + dash to_lowest_hp + secondaryDamageVar 'AreaDamage'. auto-detect 주 damageVar 'Damage' filler(v0>v1) → ★1=145/★2=220/★3=380. AreaDamage filler → ★1=75/★2=110/★3=190. 우주 그루브(SpaceGroove applySpaceGrooveBuffs:1826)/불한당(AssassinTrait AD/AP :579) trait 반영. role Assassin(APReaper). ⚠️ raw 17.3(17.4 partial dataset 미갱신 — armor/Damage 17.4 변경 미반영). 불한당 stealth(HealthThreshold/Duration) 미반영(AD/AP 만). ⚠️ 미반영: 처치 시 recast(ResetDamage 65%, onKillRecast config 없음) / Groove 상태(GrooveThreshold 0.4 자가 트리거) / passive 평타 마법 전환(평타는 sim 물리 유지). ⚠️ cone+secondaryDamageVar over-application(주 대상 포함 전 cone 타겟이 Damage+AreaDamage, combatLoop:6895-6898 공통). calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Gwen entry — cost 2, role APReaper, traits [우주 그루브/불한당], hp 750, armor/MR 45/45, AD 50, AS 0.85, range 2, mana 0/30, ability '춤추고 토막내기' variables GrooveThreshold/BonusDashRange/Damage/AreaDamage/ResetDamage)"
  - "public/data/tft_set17_traits.json (TFT17_SpaceGroove = 우주 그루브 bp 1/3/5/7/10 / TFT17_AssassinTrait = 불한당 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:232 (TFT17_Gwen: { pattern: 'cone', radius: 2, dash: 'to_lowest_hp', secondaryDamageVar: 'AreaDamage' } — auto-detect 주 damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:6895-6898 secondaryDamageVar 가산 / :1826 applySpaceGrooveBuffs 우주 그루브(:4760 호출) / :579 불한당(AssassinTrait) AD/AP synergy 획득"
related:
  - "[[patch-17-5]]"
  - "[[patch-17-4]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[veigar]]"
---

# 그웬 (Gwen)

## 요약

2코스트 **우주 그루브 (`TFT17_SpaceGroove`)** + **불한당 (`TFT17_AssassinTrait`)** trait. raw role `APReaper`. carry augment 없음.

- **role**: `mapGameRole('APReaper')` → sim **Assassin** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌). hp 750, armor/MR 45, range 2, mana 0/30 (빠른 시전).
- **ability "춤추고 토막내기"**: 기본 지속 — 평타 시 마법 피해 + 체력 `GrooveThreshold`(40%) 아래 적 지정 시 그루브 상태. 사용 시 주변 칸 돌진 → 체력 비율 최저 적 가위질 `Damage`(scaleAP) + 원뿔 범위 `AreaDamage`(scaleAP) 마법. **처치 시 다시 돌진**해 `ResetDamage`(65%) 피해 (recast).

> 🎯 **Gwen 은 돌진 원뿔 암살자(APReaper→Assassin)** — 주 `Damage` + 원뿔 `AreaDamage`. ⚠️ sim 은 [[veigar]] 와 동일 `cone + secondaryDamageVar` over-application(전 cone 타겟이 Damage+AreaDamage). 처치 recast(ResetDamage)/Groove 자가 트리거 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Gwen` apiName 으로 소속 확인 (cost 2, traits 우주 그루브/불한당, role APReaper). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, ⚠️ 17.3 — 17.4 partial dataset 미갱신)

| Stat | 값 |
|------|---|
| hp | 750 |
| armor / magicResist | **45** / 45 (⚠️ 17.4 → armor 50) |
| damage | 50 |
| attackSpeed | **0.85** (⚠️ 17.5 → 0.8) |
| range | 2 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 30 |

> ⚠️ **raw 데이터 = 17.3** (raw 17.4 partial dataset 은 Zed/Shen/Jax 만 갱신, Gwen 미갱신). pending 누적:
> - **17.4** ([[patch-17-4]]:84): armor `45→50`, 단일 대상 `Damage` ★3/★4 `380/650→410/700` (raw 현재 ★3=380 = **17.3 값**)
> - **17.5** ([[patch-17-5]]): `AreaDamage` ★3 `190→215`, AttackSpeed `0.85→0.8`

### Role — Assassin

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Assassin** | 2 | 10 | 0 | ❌ | `mapGameRole('APReaper')` includes 'Reaper' ([[role-passive]]) |

### Active — 춤추고 토막내기 (돌진 + 원뿔)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [180, 145, 220, 380, 650, ...] | ✅ auto-detect 주 `damageVar 'Damage'` filler(v0>v1) → ★1=145/★2=220/★3=380 (scaleAP) |
| AreaDamage | [120, 75, 110, 190, 325, ...] | ⚠️ `secondaryDamageVar 'AreaDamage'` filler → ★1=75/★2=110/★3=190 (scaleAP). over-application 주의(아래) |
| GrooveThreshold | [0.4, ...] | ⚠️ **미반영** — 체력 40% 아래 적 지정 시 Gwen 그루브 자가 트리거 (sim 미모델) |
| ResetDamage | [0.65, ...] | ⚠️ **미반영** — 처치 시 재돌진 가위질 65% 피해 (recast, `onKillRecast` config 없음) |
| BonusDashRange | null | — (raw null) |

- sim: `pattern: 'cone', radius: 2, dash: 'to_lowest_hp', secondaryDamageVar: 'AreaDamage'`. 체력 최저 적으로 돌진 → 주 `Damage` + 원뿔 `AreaDamage`.
- ⚠️ **over-application**: cone 타겟 전체(주 대상 포함)가 `Damage + AreaDamage` 둘 다 받음 (`combatLoop:6895-6898` per-target loop). 실제는 가위질 대상=Damage / 원뿔=AreaDamage 분리. `cone/aoe_circle + secondaryDamageVar` **공통 구조**([[veigar]] 동일).
- ⚠️ **main/OOR asymmetry**: Gwen 은 `dash: 'to_lowest_hp'` 라 사거리 밖 시전(OOR cast) 진입 가능한데, OOR 피해 loop(`combatLoop:7692-7729`)에는 `secondaryDamageVar` 처리가 **없음** → OOR cast 시 주 `Damage` 만 적용, 원뿔 `AreaDamage` 누락 (main cast 와 비일관).
- ⚠️ **처치 recast 미반영**: ResetDamage(65%) on-kill 재돌진 미모델.
- ⚠️ **passive 평타 마법 전환 미반영**: "평타 시 마법 피해"는 sim 에서 평타가 물리로 유지(별도 변수 없음, 타입 전환만).

### Trait — 우주 그루브 (SpaceGroove) / 불한당 (AssassinTrait)

- **우주 그루브** (`TFT17_SpaceGroove`, bp 1/3/5/7/10): `applySpaceGrooveBuffs` (`:1826`, `:4760` 호출) — 그루비안 매초 ADAP +N% (StartOfCombatDuration 동안). (10) tier EffectBonus 등 일부 미구현(`:1730` 주석).
- **불한당** (`TFT17_AssassinTrait`, bp 2/3/4/5): synergy scaling 경로(`:579` "불한당: AD/AP 획득")로 AD/AP 가산 (scaling.json 기반). ⚠️ **부분 반영** — raw trait 에 `HealthThreshold`(0.5)/`Duration`(3) = **체력 50% 이하 적 대상 시 3초 은신/재타게팅** 메커니즘 존재하나 sim 미반영(AD/AP 만 적용, `src/lib/simulator/` 에 stealth/retarget 처리 없음).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.3 raw (hp 750, armor/MR 45, AD 50, AS 0.85, range 2, mana 0/30) — ⚠️ 17.4/17.5 변경 미반영(위 stats 박스)
- role Assassin (`mapGameRole('APReaper')`)
- 돌진(to_lowest_hp) + 주 `Damage`(scaleAP) + 원뿔 `AreaDamage`(secondaryDamageVar)
- 우주 그루브(applySpaceGrooveBuffs) / 불한당(AD/AP synergy) trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2**: 처치 recast(ResetDamage 65% 재돌진) — onKillRecast config 없음
- **P2**: Groove 자가 트리거(GrooveThreshold 0.4) 미반영
- **P2**: passive 평타 마법 전환 미반영 (평타 sim 물리 유지)
- **P2**: cone+secondaryDamageVar over-application (주 대상에도 AreaDamage, combatLoop:6895-6898 공통 구조, [[veigar]] 동일)
- **P2**: main/OOR asymmetry — OOR cast loop(combatLoop:7692-7729)에 secondaryDamageVar 처리 없어 OOR 시전 시 AreaDamage 누락 (Gwen dash 라 OOR cast 진입 가능)
- **P2**: 불한당(AssassinTrait) stealth/retarget(HealthThreshold 0.5 / Duration 3 — 체력 50% 이하 대상 시 3초 은신·재타게팅) 미반영 — sim 은 AD/AP 만
- **P2**: raw 데이터 = 17.3 (17.4 partial dataset 미갱신) — armor 45→50 / Damage ★3/★4 380/650→410/700 (17.4) + AreaDamage·AS (17.5) 모두 데이터/sim 미반영([[patch-17-4]]/[[patch-17-5]])
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Assassin role 마나/타게팅
- [[veigar]] — cone/aoe_circle + secondaryDamageVar over-application 공통 구조
- [[ability-targeting]] — dash to_lowest_hp 타게팅
