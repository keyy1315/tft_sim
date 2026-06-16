---
id: veigar
type: champion
display_name_kr: 베이가
api_name: TFT17_Veigar
cost: 1
traits:
  - 정령족
  - 복제자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active (17.4 데이터 기준 — 17.5/17.5b patch pending: Spell Damage(Damage) ★2~ 310/465/700/1190→330/495/750/1200 (★1=250 불변, buff). 데이터/sim 미반영, [[patch-17-5]] 참조)
last_verified: 2026-06-16
sim_active: partial   # ability 「정령유성우」 대상 Damage(scaleAP) 마법 + 정령족 추가효과 미니유성 MiniMeepsPerAstro(2)개 각 MiniDamage(scaleAP). sim aoe_circle r1 + secondaryDamageVar 'MiniDamage'(주변 타겟당 1회 full). auto-detect 주 damageVar 'Damage' no-filler → ★1=250/★2=310/★3=465. MiniDamage filler(v0>v1) → ★1=31/★2=47/★3=70. 정령족(Astronaut)/복제자(APTrait) trait 정합. ⚠️ 미니유성 mis-model 3중: (a) MiniMeepsPerAstro(×2) 미반영(under) + (b) 정령족 active 게이팅 없이 무조건 적용(over) + (c) secondaryDamageVar 가 aoe_circle 전 타겟(주 대상 포함)에 MiniDamage 가산(over, combatLoop:6895-6898 공통 구조) → 부분 상쇄. calibration: game-424 -64% — per-cast 정상(★2 255/cast)이나 cost1 squishy 2캐스트 후 사망(조기사망 duration-bound, 모델링 아님)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Veigar entry — cost 1, role APCaster, traits [정령족/복제자], hp 500, armor/MR 15/15, AD 30, AS 0.7, range 4, mana 10/50, ability '정령유성우' variables Damage/MiniMeepsPerAstro/MiniDamage)"
  - "public/data/tft_set17_traits.json (TFT17_Astronaut = 정령족 bp 3/5/7/10 / TFT17_APTrait = 복제자 bp 2/4)"
  - "src/lib/simulator/systems/ability.ts:212 (TFT17_Veigar: { pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'MiniDamage' } — auto-detect 주 damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:2060 applyAstronautEffects (정령족, TFT17_Astronaut_IsActive 게이팅 :2079) / :1855 applyReplicatorTrait 복제자(:1851 포함)"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[lissandra]]"
  - "[[rammus]]"
---

# 베이가 (Veigar)

## 요약

1코스트 **정령족 (`TFT17_Astronaut`)** + **복제자 (`TFT17_APTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). hp 500 (squishy), range 4, mana 10/50 (저비용 빠른 시전).
- **ability "정령유성우"**: 대상에 정령유성 → `Damage`(scaleAP) 마법. **정령(Astronaut) 추가효과**: 주변 대상에 미니 정령유성 `MiniMeepsPerAstro`(2)개 떨어뜨려 각 `MiniDamage`(scaleAP) 마법.

> 🎯 **Veigar 는 AOE 유성 캐스터** — 주 `Damage` + 정령족 active 시 미니유성 추가. ⚠️ sim 은 `secondaryDamageVar` 를 per-target loop 에서 **aoe_circle 원 안 모든 타겟(주 대상 포함)에 `Damage + MiniDamage` 둘 다** 가산 → 주 대상은 MiniDamage 만큼 over, 주변 대상은 Damage 만큼 over (실제는 주 대상만 Damage / 주변만 미니유성). 추가로 ×2(MiniMeepsPerAstro) + 정령족 게이팅 미반영. [[lissandra]] 와 동형 1코 AOE 캐스터(같은 over-application 구조 공유).

> ⚠️ **set17 entity confirm**: `TFT17_Veigar` apiName 으로 소속 확인 (cost 1, traits 정령족/복제자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 500 |
| armor / magicResist | 15 / 15 |
| damage | 30 |
| attackSpeed | 0.7 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 10 / 50 |

> ⚠️ **17.5 patch pending** (데이터 미반영, [[patch-17-5]]): Spell Damage `Damage` ★2~ 310/465/700/1190 → **330/495/750/1200** (★1=250 불변, buff).

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 정령유성우 (AOE + 미니유성)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [250, 310, 465, 700, 1190, ...] | ✅ auto-detect 주 `damageVar 'Damage'` no-filler(v0<v1) → ★1=250/★2=310/★3=465 (scaleAP) |
| MiniMeepsPerAstro | [2, ...] | ⚠️ **미반영** — 미니유성 개수(2). sim secondaryDamageVar 는 주변 타겟당 MiniDamage 1회만(×2 누락) |
| MiniDamage | [40, 31, 47, 70, 130, ...] | ⚠️ **partial** — `secondaryDamageVar 'MiniDamage'` 주변 타겟당 1회 full. filler(v0>v1) → ★1=31/★2=47/★3=70 (scaleAP). 정령족 active 게이팅 없이 무조건 적용 |

- sim: `pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'MiniDamage'`. `combatLoop.ts:6895-6898` 에서 per-target loop 의 **모든 타겟 baseDmg 에 MiniDamage 를 += 가산** (`baseDmg += secVal`). aoe_circle 은 원 안 적 전체를 타겟으로 반환하므로 → 주 대상 포함 전원이 `Damage + MiniDamage`.
- ⚠️ **미니유성 mis-model (3중)**:
  - **(a)** ×2 개수 미반영 — `MiniMeepsPerAstro`(2) 미사용(grep 0건), MiniDamage 1회만
  - **(b)** 정령족(Astronaut) active 게이팅 없이 무조건 적용 (정령 추가효과인데 비활성 시에도 발동)
  - **(c)** **over-application** — secondaryDamageVar 가 주 대상에도 가산됨(주 대상 = Damage + MiniDamage), 주변 대상도 Damage 까지 받음. 실제는 주 대상=Damage only / 주변=미니유성 only. (a) 는 under, (b)/(c) 는 over → 부분 상쇄
  - ⚠️ (c) 는 `aoe_circle + secondaryDamageVar` 조합 **공통 구조**(Lissandra/Pyke/Gwen/Nami/Riven 동일) — Veigar 고유 아님.

### Trait — 정령족 (Astronaut) / 복제자 (APTrait)

- **정령족** (`TFT17_Astronaut`, bp 3/5/7/10): `applyAstronautEffects` (`:2060`) — `TFT17_Astronaut_IsActive` 조건부 게이팅(`:2079`, 비활성 시 미발동). 정령족 unit 효과 적용.
- **복제자** (`TFT17_APTrait`, bp 2/4): `applyReplicatorTrait` (`:1855`) — 복제자 보유 unit `mfReplicatorEffectiveness` (Veigar 포함 `:1850`).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 500, armor/MR 15, AD 30, AS 0.7, range 4, mana 10/50)
- role Caster (`mapGameRole('APCaster')`)
- 주 `Damage`(scaleAP) AOE + 주변 `MiniDamage`(secondaryDamageVar)
- 정령족(Astronaut 게이팅) / 복제자 trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2 (a)**: MiniMeepsPerAstro(×2 미니유성 개수) 미반영 — secondaryDamageVar 1회만 (under)
- **P2 (b)**: 미니유성 정령족 active 게이팅 미반영 — secondaryDamageVar 무조건 적용 (over)
- **P2 (c)**: over-application — `combatLoop:6895-6898` 가 aoe_circle 전 타겟 baseDmg 에 MiniDamage += → 주 대상도 Damage+MiniDamage, 주변도 Damage 받음 (실제는 주=Damage/주변=미니유성). `aoe_circle + secondaryDamageVar` 공통 구조(Lissandra/Pyke/Gwen/Nami/Riven). (a) under / (b)(c) over → 부분 상쇄
- calibration: game-424 **-64%** — per-cast 정상(★2 255/cast)이나 cost1 hp500 squishy 2캐스트 후 사망 → **조기사망(duration-bound, 모델링 아님)**. [[lissandra]] 와 동일 패턴 — survivability systemic 레버 영역(clean fix 아님).
- 17.5 Spell Damage buff(310→330 등) 데이터 미반영([[patch-17-5]]).

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[lissandra]] — 동형 1코 AOE 캐스터 (조기사망 패턴 공유)
- [[rammus]] — 동류 정령족
