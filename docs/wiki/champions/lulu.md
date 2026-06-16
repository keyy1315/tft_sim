---
id: lulu
type: champion
display_name_kr: 룰루
api_name: TFT17_Lulu
cost: 3
traits:
  - 별돌보미
  - 복제자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active   # Lulu ability vars(Damage/NumEnemies) 17.4/17.5 변경 없음. 17.4 "산악(Mountain) 별자리 스펠 stun 0.5→0.25"는 Stargazer 변종 effect(constellation-level, [[stargazer-fountain]])라 Lulu 고유 ability 와 무관
last_verified: 2026-06-16
sim_active: partial   # ability 「쏟아지는 별」 주변 적 NumEnemies(3)명 Damage(scaleAP) 마법 + 별돌보미 별자리별 특수효과. sim multi maxTargets:4 (auto-detect 주 damageVar 'Damage' sentinel filler v0=2 → ★1=140/★2=210/★3=335). 별돌보미(Stargazer applyStargazerEffects:3283 — combat-start stat buff 만, spell 별자리 효과 미구현, [[stargazer-fountain]])/복제자(APTrait applyReplicatorTrait:1855, Lulu 포함 :1850) trait. ⚠️ config maxTargets 4 > NumEnemies 3 (P1 over-target +33%, fix maxTargets 3). 별자리별 spell 특수효과(예: 산악 stun)는 Lulu config 아닌 Stargazer 변종 경로. calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Lulu entry — cost 3, role APCaster, traits [별돌보미/복제자], hp 650, armor/MR 25/25, AD 30, AS 0.75, range 4, mana 0/55, ability '쏟아지는 별' variables Damage/NumEnemies)"
  - "public/data/tft_set17_traits.json (TFT17_Stargazer_Wolf = 별돌보미 bp 3/4/5/6 / TFT17_APTrait = 복제자 bp 2/4)"
  - "src/lib/simulator/systems/ability.ts:251 (TFT17_Lulu: { pattern: 'multi', maxTargets: 4 } — auto-detect 주 damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:3283 applyStargazerEffects 별돌보미(변종 Mountain :3352 등) / :1855 applyReplicatorTrait 복제자(:1850 Lulu 포함)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[stargazer-fountain]]"
  - "[[veigar]]"
---

# 룰루 (Lulu)

## 요약

3코스트 **별돌보미 (`TFT17_Stargazer_Wolf`)** + **복제자 (`TFT17_APTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). hp 650, range 4, mana 0/55.
- **ability "쏟아지는 별"**: 기본 지속 — 별돌보미 **별자리(constellation)에 따라 게임마다 다른 부가효과**. 사용 시 하늘에서 떨어뜨려 주변 적 `NumEnemies`(3)명에 `Damage`(scaleAP) 마법 + 이번 게임 별자리 특수효과 발동.

> 🎯 **Lulu 는 별돌보미 AOE 캐스터** — 주변 `Damage`(scaleAP) + 별자리별 특수효과(예: 산악=stun). sim multi 로 Damage 모델. 별돌보미 trait **stat buff** 는 `applyStargazerEffects` 로 반영되나, Lulu 스펠에 붙는 **별자리 spell 효과(산악 stun 등)는 sim 미구현**([[stargazer-fountain]]).

> ⚠️ **set17 entity confirm**: `TFT17_Lulu` apiName 으로 소속 확인 (cost 3, traits 별돌보미/복제자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 650 |
| armor / magicResist | 25 / 25 |
| damage | 30 |
| attackSpeed | 0.75 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 55 |

> ℹ️ Lulu ability vars(Damage/NumEnemies)는 17.4/17.5 변경 없음. patch-17-4 "Lulu 산악 스펠 stun 0.5→0.25"는 **산악(Mountain) 별자리 효과**(Stargazer 변종 constellation-level, [[stargazer-fountain]]) — Lulu 고유 ability 데이터와 무관.

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 쏟아지는 별 (AOE + 별자리 효과)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [2, 140, 210, 335, 495, ...] | ✅ auto-detect 주 `damageVar 'Damage'` sentinel filler(v0=2, ratio>5) → ★1=140/★2=210/★3=335 (scaleAP) |
| NumEnemies | [3, ...] | ⚠️ config `maxTargets: 4` > NumEnemies 3 → over-target +1 |

- sim: `pattern: 'multi', maxTargets: 4`. 주변 적 `Damage`(scaleAP).
- ⚠️ **over-target (P1)**: 실제 `NumEnemies`(3)명인데 config maxTargets 4 → 매 cast 1명 더 타격(+33% 과대). raw ground truth(NumEnemies=3) 부정합 — fix: `maxTargets: 3`.
- ⚠️ **별자리 spell 특수효과 미구현**: `applyStargazerEffects`(`:3283`)는 **combat-start stat buff(HP/ADAP/AS/DR/Resists)만** 적용. Lulu 스펠에 붙는 별자리 효과(산악 stun, 뱀 poison 등 spell-level)는 **sim 미구현**(Mountain 분기 `:3352`에 stun 없음). 별돌보미 stat buff 는 반영, spell 특수효과는 미반영 — 상세 [[stargazer-fountain]].

### Trait — 별돌보미 (Stargazer) / 복제자 (APTrait)

- **별돌보미** (`TFT17_Stargazer_Wolf`, bp 3/4/5/6): `applyStargazerEffects` (`:3283`) — 활성 변종(`TFT17_Stargazer_*`: Mountain/Serpent/Huntress/Fountain)에 따라 강화 칸 별돌보미 또는 teamwide 효과 적용 (ADAP/Health/shield/poison/heal 등). 상세는 [[stargazer-fountain]] mechanic 페이지.
- **복제자** (`TFT17_APTrait`, bp 2/4): `applyReplicatorTrait` (`:1855`) — 복제자 보유 unit `mfReplicatorEffectiveness` (Lulu 포함 `:1850`).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 650, armor/MR 25, AD 30, AS 0.75, range 4, mana 0/55)
- role Caster (`mapGameRole('APCaster')`)
- 주변 `Damage`(scaleAP) multi
- 별돌보미 stat buff(Stargazer 변종 applyStargazerEffects combat-start) / 복제자 trait — ⚠️ spell 별자리 효과는 미구현

⚠️ **미반영 / mis-model** (Lint 후보):
- **P1**: config `maxTargets: 4` > raw `NumEnemies`(3) — 매 cast +1 타겟(+33% 과대, ground truth 부정합). fix: maxTargets 3
- **P1**: 별자리 spell 특수효과(산악 stun 등) **sim 미구현** — applyStargazerEffects 는 stat buff(HP/ADAP)만 적용, spell-level 효과 미반영(Mountain 분기 stun 없음). 별돌보미 stat buff 는 반영([[stargazer-fountain]])
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[stargazer-fountain]] — 별돌보미(Stargazer) 변종 메커니즘 (별자리 효과)
- [[veigar]] — 동류 복제자 AOE 캐스터
