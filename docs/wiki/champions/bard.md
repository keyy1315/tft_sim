---
id: bard
type: champion
display_name_kr: 바드
api_name: TFT17_Bard
cost: 5
traits:
  - 정령족
  - 전달자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active (17.4 데이터 기준 — 17.5/17.5b patch pending: Spell Damage 220/330→240/360 (buff). 데이터/sim 미반영, [[patch-17-5]] 참조)
sim_active: partial   # ability 「미확인 친절 물체」 비행접시 4초 DOT — DamagePerSecond(초당값)×Duration(4) 을 dot.perSecond 로 모델(#241), aoe_circle radius 1 (SecondaryHexRange). ★ filler ★1=220/★2=330/★3=3000. 정령족(Astronaut)/전달자(ManaTrait) trait 정합. ⚠️ 미반영: SplitDamagePerSecond(주변 적은 DamagePerSecond 가 아닌 split 값이어야 하나 sim 은 aoe 전체에 DamagePerSecond 동일 적용 → 주변 과다) / TankDamageIncrease(탱커 상대 +30%) / AbductChance(납치 — economy, sim 무관) / 정령 추가효과(전투시작 정령족 아군 추가 meep) / cast 빈도·DOT 4초 vs 짧은 전투(duration-bound, 잔여 -84%)
last_verified: 2026-06-15
sources:
  - "public/data/tft_set17_champions.json (TFT17_Bard entry — cost 5, role APCaster, traits [정령족/전달자], hp 900, armor/MR 40/40, AD 30, AS 0.85, range 4, mana 0/65, ability '미확인 친절 물체' variables DamagePerSecond/SplitDamagePerSecond/Duration/TankDamageIncrease/SecondaryHexRange/AbductChance/MeepsPerMeep)"
  - "public/data/tft_set17_traits.json (TFT17_Astronaut = 정령족 bp 3/5/7/10 / TFT17_ManaTrait = 전달자 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:265 (TFT17_Bard: { pattern: 'aoe_circle', radius: 1, dot: { duration: 4, perSecond: true } })"
  - "src/lib/simulator/engine/combatLoop.ts:6812-6813 (dot.perSecond → dotTotal = abilityDmg × duration, DamagePerSecond 초당값 × 4) / :7667 (OOR 동일)"
  - "src/lib/simulator/engine/combatLoop.ts:2060 applyAstronautEffects (정령족 BonusHealth/Meeps) / :601 전달자(ManaTrait) InnateManaGain"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[stargazer-fountain]]"
  - "[[corki]]"
  - "[[veigar]]"
---

# 바드 (Bard)

## 요약

5코스트 **정령족 (`TFT17_Astronaut`)** + **전달자 (`TFT17_ManaTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌).
- **ability "미확인 친절 물체"**: 현재 대상 위에 `Duration`(4)초 유지되는 비행접시 소환. 비행접시는 **매초** 대상에 `DamagePerSecond`(scaleAP) 마법 피해 + `SecondaryHexRange`(1)칸 내 적에 `SplitDamagePerSecond`(scaleAP) 분배. 탱커에 `TankDamageIncrease`(+30%). 비행접시 아래 적 사망 시 `AbductChance` 확률 납치(대기석 ★1 복사본 — economy).

> 🎯 **Bard 는 지속 DOT 캐스터** — 비행접시가 4초간 매초 피해. `DamagePerSecond` 는 **초당값**이라 sim 은 `dot.perSecond` 로 × Duration(4) 적용(#241). 정령족(Astronaut) 추가 효과로 전투 시작 시 아군 정령족에 추가 정령 부여.

> ⚠️ **set17 entity confirm**: `TFT17_Bard` apiName 으로 소속 확인 (cost 5, traits 정령족/전달자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 900 |
| armor / magicResist | 40 / 40 |
| damage | 30 |
| attackSpeed | 0.85 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 65 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 미확인 친절 물체 (비행접시 DOT)

raw desc: "`@Duration@`(4)초 유지 비행접시 소환. 매초 대상에 `@ModifiedDamagePerSecond@`(scaleAP) 마법 + `@SecondaryHexRange@`(1)칸 내 적에 `@ModifiedSplitDamagePerSecond@`(scaleAP) 분배. 탱커에 `@TankDamageIncrease@`(+30%). 비행접시 아래 적 사망 시 `@AbductChance@` 확률 납치."

| 변수 | raw value | ★ 인덱싱 (readVarByStar) |
|------|-----------|------------------------|
| DamagePerSecond | [2, 220, 330, 3000, 5000, ...] | filler(sentinel 2) → idx=star → ★1=220 / ★2=330 / ★3=3000 (**초당값**) |
| SplitDamagePerSecond | [0, 135, 205, 1500, ...] | filler(v0=0) → idx=star → ★1=135 / ★2=205 / ★3=1500 (초당값) |
| Duration | [4, 4, 4, ...] | 4초 |
| AugmentedDuration | [5, 5, ...] | sim 미사용 — Concentration augment(집중) 활성 시 5초, 활성 augment 없음 |
| TankDamageIncrease | [0.3, 0.3, ...] | 탱커 상대 +30% |
| SecondaryHexRange | [1, 1, ...] | 주변 1칸 |

- sim: `pattern: 'aoe_circle', radius: 1, dot: { duration: 4, perSecond: true }`. `dot.perSecond` → DOT 총량 = `DamagePerSecond★ × Duration(4)` (초당값 × 4, #241). aoe_circle radius 1 로 비행접시 + 주변 1칸 포함.
- ⚠️ **SplitDamagePerSecond 미반영**: sim dot 은 aoe radius 1 전체에 `DamagePerSecond` 동일 적용 → 주변 적이 split(작은) 값 대신 full DamagePerSecond 받음(주변 과다). primary=DamagePerSecond / 주변=SplitDamagePerSecond 구분은 per-target 구조 필요 (보류).
- ⚠️ **TankDamageIncrease(+30% vs 탱커) 미반영** — champion-specific tank amp 필드 미설정.
- ⚠️ **AbductChance(납치)**: 전투 외 economy 메커니즘 — sim 무관 (의도적 미모델).

### Trait — 정령족 (Astronaut) / 전달자 (ManaTrait)

- **정령족** (`TFT17_Astronaut`, bp 3/5/7/10): `applyAstronautEffects` (`:2060`) BonusHealth flat + Meeps stack. desc 의 "정령 추가 효과(전투 시작 시 아군 정령족에 추가 정령)" 는 별도 미모델.
- **전달자** (`TFT17_ManaTrait`, bp 2/3/4/5): `InnateManaGain` (`:601`) — 전달자 unit mana gain × (1 + N).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 900, armor/MR 40, AD 30, AS 0.85, range 4, mana 0/65)
- role Caster (`mapGameRole('APCaster')`)
- 비행접시 DOT: `DamagePerSecond★ × Duration(4)` (dot.perSecond #241), aoe_circle radius 1
- 정령족 BonusHealth/Meeps + 전달자 InnateManaGain

⚠️ **미반영 / 부정확** (Lint 후보):
- **P2**: SplitDamagePerSecond — 주변 적에 DamagePerSecond 동일 적용 (split 값 미구분, 주변 과다)
- **P2**: TankDamageIncrease (+30% vs 탱커) 미반영
- **P2**: 정령 추가 효과 (전투 시작 정령족 아군 추가 meep) 미반영
- **➖**: AbductChance(납치) — economy, sim 무관
- ⚠️ **calibration 잔여 -84%** (#241 후): cast 빈도(5코 mana 65) + DOT 4초가 짧은 sim 전투(6~12s)에서 일부만 적중 — systemic duration 한계 (별개). perSecond fix 로 -90%→-84% 개선.

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[stargazer-fountain]] — 정령족(Astronaut) trait
- [[corki]] / [[veigar]] — 동류 정령족 캐스터
