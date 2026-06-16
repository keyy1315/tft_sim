---
id: rhaast
type: champion
display_name_kr: 라아스트
api_name: TFT17_Rhaast
cost: 3
traits:
  - 구원자
role: Tank   # raw "ADTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank')). carry augment 없음
raw_role: ADTank
current_patch_status: active
sim_active: partial   # ability 「신성한 낫」 내구력 + 회복 후 일직선 베기 Damage(scaleAD) + 띄움. sim line + stun 1.0 + heal:true + selfBuff durability. Damage filler ★1=120/★2=180/★3=300 (auto-detect, scaleAD 반영). 구원자(RhaastUniqueTrait) trait 정합. ⚠️ selfBuff durability 0.3 영구 적용 (selfBuff.duration combatLoop 미read → raw Duration 2초 시간제한 무시, 방어 과대) / HealAmount heal:true(resolveSelfHeal). 🔑 calibration -79% = cast-빈도/duration bound: mana 30/90 → sim 짧은 전투(4~8s)서 0~1회만 시전 → 베기 데미지 대부분 미발생 (값 갭 아님, Damage 자체는 모델됨)
last_verified: 2026-06-15
sources:
  - "public/data/tft_set17_champions.json (TFT17_Rhaast entry — cost 3, role ADTank, traits [구원자], hp 1200, armor/MR 60/60, AD 60, AS 0.65, range 1, mana 30/90, ability '신성한 낫' variables Duration/Durability/HealAmount/KnockupDuration/Damage)"
  - "public/data/tft_set17_traits.json (TFT17_RhaastUniqueTrait = 구원자 bp 1)"
  - "src/lib/simulator/systems/ability.ts:247 (TFT17_Rhaast: { pattern: 'line', stun: 1.0, heal: true, selfBuff: { durability: 0.3, duration: 4 } } — auto-detect damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:567 구원자(RhaastUniqueTrait) applySet17SynergyBuffs (활성 특성당 AS/방어/마저) / resolveSelfHeal (heal:true HealAmount)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[jax]]"
  - "[[nunu]]"
---

# 라아스트 (Rhaast)

## 요약

3코스트 **구원자 (`TFT17_RhaastUniqueTrait`)** 유니크 trait. raw role `ADTank`. carry augment 없음.

- **role**: `mapGameRole('ADTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 ✅).
- **ability "신성한 낫"**: `Duration`(2)초 동안 내구력 `Durability`(20%) + 체력 `HealAmount`(scaleAP) 회복. 이후 전방 일직선 베기 → 적중 적 `Damage`(scaleAD) 물리 + `KnockupDuration`(1)초 공중 띄움.

> 🎯 **Rhaast 는 자가 버프 + 베기 탱커** — 베기 Damage(scaleAD) 는 sim 반영. **단 mana 30/90 + sim 짧은 전투** → 0~1회만 시전 → calibration -79% 의 지배 요인은 값 모델링이 아닌 **cast 빈도/duration**.

> ⚠️ **set17 entity confirm**: `TFT17_Rhaast` apiName 으로 소속 확인 (cost 3, traits 구원자, role ADTank). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 1200 |
| armor / magicResist | 60 / 60 |
| damage | 60 |
| attackSpeed | 0.65 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 30 / 90 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| Rhaast | Tank | 3 | 5 | 0 | ✅ | `mapGameRole('ADTank')` → `includes('Tank')` → Tank ([[role-passive]]) |

### Active — 신성한 낫

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [0.2, 120, 180, 300, ...] | ✅ auto-detect `damageVar 'Damage'` filler(sentinel 0.2) → ★1=120/★2=180/★3=300 (scaleAD) — 일직선 베기 |
| Durability | [0.2, ...] | ⚠️ selfBuff `durability: 0.3` (raw 0.2 대비 과다). cast 시 `unit.damageReduction += 0.3` **영구 적용** |
| Duration | [2, ...] | ⚠️ **무시됨** — combatLoop 가 `selfBuff.duration` 을 read 안 함 (raw 2초/config 4초 둘 다 미반영) → durability 영구 지속 (시간제한 미구현) |
| HealAmount | [1, 500, 550, 650, ...] | ✅ `heal: true` → `resolveSelfHeal` (HealAmount, scaleAP) filler → ★1=500/★2=550/★3=650 |
| KnockupDuration | [1, ...] | ⚠️ `stun: 1.0` (띄움 근사) |

- sim: `pattern: 'line', stun: 1.0, heal: true, selfBuff: { durability: 0.3, duration: 4 }`. 일직선 베기 Damage(scaleAD) + 띄움 + 자가 회복 + 내구력 버프.
- ⚠️ **selfBuff durability/duration config 과다**: raw Durability 0.2(20%)/Duration 2초 → config 0.3/4초 (방어 과대 추정 — 데미지 무관, P2).

> 🔴 **핵심 sim 한계 — cast 빈도**: mana 30/90. sim 짧은 전투(4~8s)서 **0~1회만 시전** (calibration 측정 대부분 casts 0). 실전 장기전에선 반복 시전해 베기 + 회복 누적 → actual 654~1067 vs sim 67~262 (**-79%**). **값 모델링 갭 아닌 cast 빈도/duration systemic** (Damage 자체는 모델됨).

### Trait — 구원자 (Redeemer / RhaastUniqueTrait)

- **구원자** (`TFT17_RhaastUniqueTrait`, bp 1): `applySet17SynergyBuffs` (`:567`) — 활성 특성당 AS/방어력/마법저항 부여 (유니크 trait, Rhaast 단독).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1200, armor/MR 60, AD 60, AS 0.65, mana 30/90)
- role Tank (`mapGameRole('ADTank')`)
- 일직선 베기 Damage(scaleAD) + 띄움(stun 1.0) + 자가 회복(heal:true) + 내구력(selfBuff)
- 구원자(RhaastUniqueTrait) trait

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: selfBuff `durability: 0.3` (raw 0.2 대비 과다) 가 **영구 적용** — `selfBuff.duration` 은 combatLoop 가 read 안 함 (raw 2초/config 4초 둘 다 무시, 시간제한 미구현 → 방어 과대)
- 🔴 **systemic**: mana 90 → sim 짧은 전투서 cast 0~1회 → calibration -79% (duration/cast-frequency bound, 값 갭 아님)

## 관련 문서

- [[role-passive]] — Tank role 마나/타게팅 (Rhaast cast 빈도 핵심)
- [[jax]] / [[nunu]] — 동류 자가버프/AOE 탱커 (cast-bound 공통)
