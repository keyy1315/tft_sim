---
id: nami
type: champion
display_name_kr: 나미
api_name: TFT17_Nami
cost: 4
traits:
  - 우주 그루브
  - 복제자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: "active (⚠️ 17.3 데이터 기준 — raw 17.4 partial dataset 이 Nami 미갱신. 17.4 pending: mana 25/70→20/65 ([[patch-17-4]]). 17.5 변경 없음. 데이터/sim 미반영)"
last_verified: 2026-06-16
sim_active: partial   # ability 「버블 팝」 디스코 방울 반경 1칸 적에게 Damage(scaleAP) 나누어(divided) 입힘 + 폭발 시 작은 방울 NumProjectiles(3)개 FirstBounceDamage(scaleAP) 마법 + GrooveDuration(3) Groove. sim aoe_circle r1 + secondaryDamageVar 'FirstBounceDamage'. auto-detect 주 damageVar 'Damage' no-filler → ★1=260/★2=440/★3=660. FirstBounceDamage filler → ★1=110/★2=165/★3=1000. 우주 그루브(SpaceGroove)/복제자(APTrait) trait. ⚠️ over-model: main Damage "나누어(divided)" 인데 sim 은 aoe_circle 타겟당 full(÷N 미반영, hitCount 없어 isSplitDamage=false) + FirstBounceDamage ×3 projectiles 미반영 + over-application(전 aoe 타겟 Damage+FirstBounceDamage). ⚠️ Groove 자가 트리거 미반영. calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Nami entry — cost 4, role APCaster, traits [우주 그루브/복제자], hp 850, armor/MR 30/30, AD 40, AS 0.8, range 4, mana 25/70(17.3), ability '버블 팝' variables Damage/NumProjectiles/FirstBounceDamage/GrooveDuration)"
  - "public/data/tft_set17_traits.json (TFT17_SpaceGroove = 우주 그루브 bp 1/3/5/7/10 / TFT17_APTrait = 복제자 bp 2/4)"
  - "src/lib/simulator/systems/ability.ts:263 (TFT17_Nami: { pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'FirstBounceDamage' } — auto-detect 주 damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:6759 isSplitDamage 정의(hitCount 필요) / :6805-6807 분배 적용 / :6895-6898 secondaryDamageVar 가산 / :1826 applySpaceGrooveBuffs 우주 그루브 / :1855 applyReplicatorTrait 복제자(:1850 Nami 포함)"
related:
  - "[[patch-17-4]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[aurora]]"
  - "[[veigar]]"
---

# 나미 (Nami)

## 요약

4코스트 **우주 그루브 (`TFT17_SpaceGroove`)** + **복제자 (`TFT17_APTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). hp 850, range 4, mana 25/70(17.3).
- **ability "버블 팝"**: 대상에 디스코 방울 → 반경 1칸 내 적에게 `Damage`(scaleAP) **나누어(divided)** 입힘. 폭발 시 주변 적에게 작은 방울 `NumProjectiles`(3)개 → `FirstBounceDamage`(scaleAP) 마법. 시전 시 `GrooveDuration`(3초) 그루브 상태.

> 🎯 **Nami 는 분배(divided) AOE 캐스터** — main `Damage` 가 r1 타겟에 **나누어** 들어가나 sim 은 타겟당 full 적용(÷N 미반영, [[aurora]] SplitDamage 와 동류 분배 메커니즘인데 splitDamageVar 미사용). 작은 방울 ×3·over-application 도 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Nami` apiName 으로 소속 확인 (cost 4, traits 우주 그루브/복제자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, ⚠️ 17.3 — 17.4 partial dataset 미갱신)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 30 / 30 |
| damage | 40 |
| attackSpeed | 0.8 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 25 / **70** (⚠️ 17.4 → 20/65) |

> ⚠️ **raw 데이터 = 17.3** (raw 17.4 partial dataset 은 Zed/Shen/Jax 만 갱신, Nami 미갱신). **17.4** ([[patch-17-4]]): mana `25/70 → 20/65`. 17.5 변경 없음.

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 버블 팝 (분배 + 작은 방울)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [260, 440, 660, 5000, 3600, ...] | ⚠️ auto-detect 주 `damageVar 'Damage'` no-filler → ★1=260/★2=440/★3=660 (scaleAP). **divided 미반영**(아래) |
| FirstBounceDamage | [120, 110, 165, 1000, 2000, ...] | ⚠️ `secondaryDamageVar 'FirstBounceDamage'` filler(v0>v1) → ★1=110/★2=165/★3=1000 (scaleAP). ×3 projectiles 미반영 + over-application |
| NumProjectiles | [3, ...] | ⚠️ **미반영** — 작은 방울 3개 (sim FirstBounceDamage 1회) |
| GrooveDuration | [3, ...] | ⚠️ **미반영** — Groove 자가 트리거 |

- sim: `pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'FirstBounceDamage'`. r1 타겟에 주 `Damage` + `FirstBounceDamage`.
- ⚠️ **divided 미반영 (over-model)**: 실제 main `Damage` 는 r1 적에게 **나누어**(÷N) 들어가나, sim 은 `isSplitDamage`(= `config.hitCount && pattern!=='single'`, combatLoop:6759 정의 / :6805-6807 분배) 가 hitCount 없어 false → 타겟당 **full** 적용 → 다수 타겟 시 과대. [[aurora]] SplitDamage 처럼 `splitDamageVar` 로 ÷N 모델 가능(현재 미적용).
- ⚠️ **FirstBounceDamage over-application + ×3 미반영**: secondaryDamageVar 가 aoe 전 타겟(주 대상 포함)에 가산([[veigar]] 공통) + 작은 방울 `NumProjectiles`(3) 횟수 미모델.

### Trait — 우주 그루브 (SpaceGroove) / 복제자 (APTrait)

- **우주 그루브** (`TFT17_SpaceGroove`, bp 1/3/5/7/10): `applySpaceGrooveBuffs` (`:1826`) — 그루비안 매초 ADAP +N% (StartOfCombatDuration 동안).
- **복제자** (`TFT17_APTrait`, bp 2/4): `applyReplicatorTrait` (`:1855`) — 복제자 보유 unit `mfReplicatorEffectiveness` (Nami 포함 `:1850`).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.3 raw (hp 850, armor/MR 30, AD 40, AS 0.8, range 4, mana 25/70) — ⚠️ 17.4 mana 변경 미반영
- role Caster (`mapGameRole('APCaster')`)
- 주 `Damage`(scaleAP) + `FirstBounceDamage`(secondaryDamageVar)
- 우주 그루브 / 복제자 trait

⚠️ **미반영 / over-model** (Lint 후보):
- **P2 (divided over-model)**: main `Damage` "나누어(divided)" 인데 sim 타겟당 full(÷N 미반영, hitCount 없어 isSplitDamage=false) → 다수 타겟 과대. splitDamageVar 로 ÷N 모델 가능([[aurora]] 동형)
- **P2**: FirstBounceDamage ×3 projectiles(`NumProjectiles`) 미반영 + over-application(전 aoe 타겟, [[veigar]] 공통)
- **P2**: Groove 자가 트리거(`GrooveDuration`) 미반영
- **P2**: raw 17.3 — mana 17.4(25/70→20/65) 미반영([[patch-17-4]])
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[aurora]] — divided(나누어) SplitDamage splitDamageVar 모델 (#249) — Nami Damage 동류
- [[veigar]] — secondaryDamageVar over-application 공통 구조
