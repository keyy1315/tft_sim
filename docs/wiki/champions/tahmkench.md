---
id: tahmkench
type: champion
display_name_kr: 탐 켄치
api_name: TFT17_TahmKench
cost: 4
traits:
  - 예언자
  - 싸움꾼
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank')). carry augment 없음
raw_role: APTank
current_patch_status: active   # 17.4/17.5 변경 없음 (patch-17-4/17-5 champion list 미포함)
last_verified: 2026-06-16
sim_active: partial   # ability 「혀 채찍」 passive 전투당 1회 체력 HPThreshold(35%) 아래 시 받은 힐의 PercentHealingToShield(40%) 보호막(ShieldDuration 4) + 사용 시 Heal(scaleHealth HealHP 8.5%maxHp + scaleAP HealAP) 회복 + 2칸 내 모든 적 Damage(scaleAP DamageAP + scaleHealth DamageHP) 마법. sim aoe_circle r2 + heal:true. auto-detect 주 damageVar 'DamageAP' filler(v0>v1) → ★1=45/★2=60/★3=1500. heal resolveSelfHeal(HealAP filler ★1=300/★2=360/★3=1500 + HealHP 8.5%maxHp). 싸움꾼(HPTank applyBrawlerEffects:2130) trait. ⚠️ 미반영: 예언자(TahmKenchUniqueTrait) sim helper 없음(grep 0건) / passive 힐→보호막(PercentHealingToShield) / Damage scaleHealth 성분(DamageHP 2%maxHp — main DamageAP 만). calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_TahmKench entry — cost 4, role APTank, traits [예언자/싸움꾼], hp 1300, armor/MR 60/60, AD 75, AS 0.5, range 1, mana 50/110, ability '혀 채찍' variables PercentHealingToShield/HealHP/HealAP/DamageHP/DamageAP/HPThreshold/ShieldDuration)"
  - "public/data/tft_set17_traits.json (TFT17_TahmKenchUniqueTrait = 예언자 bp 1 / TFT17_HPTank = 싸움꾼 bp 2/4/6)"
  - "src/lib/simulator/systems/ability.ts:268 (TFT17_TahmKench: { pattern: 'aoe_circle', radius: 2, heal: true } — auto-detect 주 damageVar 'DamageAP')"
  - "src/lib/simulator/engine/combatLoop.ts:197 classifyHealVar(HealAP/HealHP) resolveSelfHeal / :2130 applyBrawlerEffects 싸움꾼(:2126 TahmKench 포함)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[belveth]]"
  - "[[pantheon]]"
---

# 탐 켄치 (Tahm Kench)

## 요약

4코스트 **예언자 (`TFT17_TahmKenchUniqueTrait`)** + **싸움꾼 (`TFT17_HPTank`)** trait. raw role `APTank`. carry augment 없음.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 ✅). hp 1300, armor/MR 60, range 1, mana 50/110.
- **ability "혀 채찍"**: 기본 지속 — 전투당 1회 체력 `HPThreshold`(35%) 아래로 떨어지면 `ShieldDuration`(4초) 동안 이번 전투 받은 힐의 `PercentHealingToShield`(40%) 보호막. 사용 시 `Heal`(scaleHealth `HealHP` 8.5%maxHp + scaleAP `HealAP`) 회복 + 2칸 내 모든 적에게 `Damage`(scaleAP `DamageAP` + scaleHealth `DamageHP` 2%maxHp) 마법.

> 🎯 **Tahm Kench 는 자가 회복 + 2칸 AOE 탱커** — Heal(체력+AP) 자가힐 + 광역 Damage. sim heal(HealAP+HealHP maxHp%) + aoe_circle r2 Damage(DamageAP). ⚠️ Damage scaleHealth 성분(DamageHP)·passive 힐→보호막·예언자 trait 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_TahmKench` apiName 으로 소속 확인 (cost 4, traits 예언자/싸움꾼, role APTank). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE — 17.4 변경 없음)

| Stat | 값 |
|------|---|
| hp | 1300 |
| armor / magicResist | 60 / 60 |
| damage | 75 |
| attackSpeed | 0.5 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 50 / 110 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` includes 'Tank' ([[role-passive]]) |

### Active — 혀 채찍 (자가힐 + 2칸 AOE)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| DamageAP | [120, 45, 60, 1500, 1500, ...] | ✅ auto-detect 주 `damageVar 'DamageAP'` filler(v0>v1) → ★1=45/★2=60/★3=1500 (scaleAP) |
| DamageHP | [0.02, ...] | ⚠️ **미반영** — Damage scaleHealth 성분(2% maxHp). main DamageAP 만 적용 (Shen DamageHP 처리는 평타 stack 전용 :5943, TahmKench 미적용) |
| HealAP | [0, 300, 360, 1500, 2500, ...] | ✅ `heal:true` resolveSelfHeal(classifyHealVar 'HealAP'='amount') filler → ★1=300/★2=360/★3=1500 (scaleAP, ×(1+ap/100)) |
| HealHP | [0.085, ...] | ✅ resolveSelfHeal(classifyHealVar 'HealHP'='amount', val<1) → maxHp × 8.5% |
| PercentHealingToShield | [0.4, ...] | ⚠️ **미반영** — passive 받은 힐의 40% 보호막 (전용 핸들러 없음) |
| HPThreshold | [0.35, ...] | ⚠️ **미반영** — passive 발동 체력 35% 기준 |
| ShieldDuration | [4, ...] | ⚠️ **미반영** — passive 보호막 지속 (보호막 자체 미모델) |

- sim: `pattern: 'aoe_circle', radius: 2, heal: true`. 자가힐(HealAP + HealHP maxHp%) + 2칸 `DamageAP`(scaleAP) 광역.
- ⚠️ **Damage scaleHealth 미반영**: `DamageHP`(2% maxHp) 성분이 main 데미지에 미가산 (auto-detect DamageAP 만). 탱커 maxHp 비례 피해 누락.
- ⚠️ **passive 힐→보호막 미반영**: 체력 35% 아래 시 받은 힐 40% 보호막(`PercentHealingToShield`) sim 미모델 (전용 핸들러 없음).

### Trait — 예언자 (TahmKenchUniqueTrait) / 싸움꾼 (HPTank)

- **예언자** (`TFT17_TahmKenchUniqueTrait`, bp 1): unique trait. ⚠️ **sim 미반영** — combatLoop/hooks/item 전수 grep 0건, 별도 trait helper 없음.
- **싸움꾼** (`TFT17_HPTank`, bp 2/4/6): `applyBrawlerEffects` (`:2130`) — teamwide +5% maxHp + 싸움꾼 unit 추가 % maxHp. TahmKench 포함(`:2126`).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1300, armor/MR 60, AD 75, AS 0.5, range 1, mana 50/110)
- role Tank (`mapGameRole('APTank')`)
- 자가힐(HealAP + HealHP maxHp%, resolveSelfHeal) + 2칸 `DamageAP`(scaleAP)
- 싸움꾼(maxHp) trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2**: Damage scaleHealth 성분(`DamageHP` 2%maxHp) 미반영 — main DamageAP 만
- **P2**: passive 힐→보호막(`PercentHealingToShield` 40%, `HPThreshold` 35%) 미반영 — 전용 핸들러 없음
- **P2**: 예언자(TahmKenchUniqueTrait) sim 미반영 — trait helper 없음(grep 0건)
- **P2(informational)**: heal:true OOR cast path 미적용 — main(:7351)만 resolveSelfHeal, OOR loop 미호출(heal:true 구조적, range 1 melee 라 실질 영향 최소)
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Tank role 마나/타게팅
- [[belveth]] / [[pantheon]] — 동류 싸움꾼(HPTank)
- [[ability-targeting]] — aoe_circle 타게팅
