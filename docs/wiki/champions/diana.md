---
id: diana
type: champion
display_name_kr: 다이애나
api_name: TFT17_Diana
cost: 3
traits:
  - 중재자
  - 도전자
role: Fighter   # raw "APFighter" → mapGameRole() → sim Fighter (types/index.ts includes('Fighter')). carry augment 없음
raw_role: APFighter
current_patch_status: active   # 17.4/17.5 변경 없음 (patch-17-4/17-5 champion list 미포함)
last_verified: 2026-06-16
sim_active: partial   # ability 「은빛 가호」 passive 평타 BonusDamageToAttacks(scaleAP) 마법 추가 + 사용 시 Shield + AS 버프(ASDuration 4 / AttackSpeed 0.5) + 구체 NumAttacks(3)개 관통 CleaveDamage(scaleAP) 마법(AS 비례 회전). sim aoe_circle r1 + selfBuff{attackSpeed:0.5, duration:4} + damageVar 'CleaveDamage' + dot{duration:3}. ⚠️ wrong-variable 버그: 실제 구체 피해는 BaseDamage(patch-17-3 audit 60/90/145)인데 config 가 CleaveDamage(100/100/150) 사용. ⚠️ Shield under-shield: getAbilityShield 가 선두 100 non-filler 오판→★1=100(게임 275 filler). 중재자(ADMIN=Arbiter law)/도전자(ASTrait) trait 반영. ⚠️ 미반영: passive 평타 BonusDamageToAttacks(AD=0 autos) / 구체 3개 AS 회전 반복타(sim CleaveDamage 1회 dot total) / ShieldPercent(maxHp%) / ShieldDuration(3초 — generic shield 10초 고정 systemic). calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Diana entry — cost 3, role APFighter, traits [중재자/도전자], hp 850, armor/MR 50/50, AD 0, AS 0.8, range 1, mana 0/50, ability '은빛 가호' variables ASDuration/Shield/ShieldPercent/NumAttacks/BaseAttackDamagePercent/AttackSpeed/CleaveDamage/ShieldDuration/BaseDamage/BonusDamageToAttacks)"
  - "public/data/tft_set17_traits.json (TFT17_ADMIN = 중재자 bp 2/3 / TFT17_ASTrait = 도전자 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:252 (TFT17_Diana: { pattern: 'aoe_circle', radius: 1, selfBuff: { attackSpeed: 0.5, duration: 4 }, damageVar: 'CleaveDamage', dot: { duration: 3 } })"
  - "src/lib/simulator/engine/combatLoop.ts:6895 secondaryDamageVar(미사용) / getAbilityShield(ability.ts:505) Shield / :4448 applyArbiterEffect 중재자 / :592 도전자(ASTrait) Burst AS"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[leblanc]]"
  - "[[belveth]]"
---

# 다이애나 (Diana)

## 요약

3코스트 **중재자 (`TFT17_ADMIN`)** + **도전자 (`TFT17_ASTrait`)** trait. raw role `APFighter`. carry augment 없음.

- **role**: `mapGameRole('APFighter')` → sim **Fighter** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌). hp 850, armor/MR 50, range 1, mana 0/50, **AD 0**(평타 추가 마법 passive).
- **ability "은빛 가호"**: 기본 지속 — 평타 시 `BonusDamageToAttacks`(scaleAP) 추가 마법. 사용 시 `ShieldDuration`(3초) `Shield`(scaleAP) 보호막 + AS 버프(`ASDuration` 4초 / `AttackSpeed` +0.5) + 주변 구체 `NumAttacks`(3)개 소환 → 관통 `CleaveDamage`(scaleAP) 마법, **공격속도 비례 회전**(빠를수록 더 자주 타격).

> 🎯 **Diana 는 보호막 + 구체 회전 AP 파이터** — AS 버프 + 구체 CleaveDamage(scaleAP). ⚠️ sim 은 구체 데미지에 wrong-variable(CleaveDamage, 실제 BaseDamage)·Shield under-shield(getAbilityShield 선두 100 non-filler 오판) 버그 보유(patch-17-3 audit 대비). 구체 반복타·passive 평타도 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Diana` apiName 으로 소속 확인 (cost 3, traits 중재자/도전자, role APFighter). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE — 17.4 변경 없음)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 50 / 50 |
| damage | **0** (평타 추가 마법 passive) |
| attackSpeed | 0.8 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 50 |

### Role — Fighter

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Fighter** | 2 | 10 | 0 | ❌ | `mapGameRole('APFighter')` includes 'Fighter' ([[role-passive]]) |

### Active — 은빛 가호 (보호막 + 구체 회전)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| CleaveDamage | [100, 100, 150, 240, 330, ...] | ⚠️ **wrong-variable 버그** — config `damageVar 'CleaveDamage'`(→★1=100/★2=100/★3=150)를 쓰나, 실제 구체(orb) 피해는 **`BaseDamage`** (아래 + patch-17-3 audit Orb AP 60/90/145). desc `@ModifiedDamage@` = BaseDamage 매핑. CleaveDamage 는 desc 미참조 |
| BaseDamage | [50, 60, 90, 145, 250, ...] | ⚠️ **실제 구체 피해인데 sim 미사용** — patch-17-3 audit "Orb AP 60/90/145"(filler v?→★1=60/★2=90/★3=145, 선두 50=17.2 filler). config damageVar 가 CleaveDamage 라 미반영 |
| Shield | [100, 275, 325, 475, 460, ...] | ⚠️ **under-shield shifted-indexing 버그** — patch-17-3 audit Shield AP ★1-★3 = **275/325/475**(filler 의도, 선두 100=filler). 그러나 `getAbilityShield` 가 v0=100<v1=275 라 **non-filler 로 오판** → ★1=100/★2=275/★3=325 사용(★1 100 vs 게임 275 = under) |
| ShieldPercent | [0.05, 0.05, 0.07, 0.1, 0.13, ...] | ⚠️ **미반영** — 최대 체력 % 보호막 가산 (getAbilityShield 미처리, [[pantheon]] PercentHealthShield 동일) |
| AttackSpeed / ASDuration | [0.5] / [4] | ✅ `selfBuff: { attackSpeed: 0.5, duration: 4 }` |
| NumAttacks | [3, ...] | ⚠️ **미반영** — 구체 3개 (sim CleaveDamage 1회 dot total) |
| ShieldDuration | [3, ...] | ⚠️ **미반영** — generic shield `remainingTicks 300`(10초) 고정, raw 3초 무시 (systemic) |
| BonusDamageToAttacks | [0, 52, 78, 135, 230, ...] | ⚠️ **미반영** — passive 평타 추가 마법. Diana AD=0 라 sim 평타 ~0. filler → ★1=52/★2=78/★3=135 |

- sim: `pattern: 'aoe_circle', radius: 1, selfBuff: { attackSpeed: 0.5, duration: 4 }, damageVar: 'CleaveDamage', dot: { duration: 3 }`. AS 버프 + 구체 데미지를 3초 dot total + 보호막.
- ⚠️ **wrong-variable 버그**: config 가 `CleaveDamage`(100/100/150)를 구체 데미지로 쓰나, 실제 구체(orb) 피해는 `BaseDamage`(patch-17-3 audit 60/90/145). damageVar 를 BaseDamage 로 정정 필요 (sim fix 후보).
- ⚠️ **Shield under-shield**: getAbilityShield 가 Shield `[100,275,325,...]` 선두 100 을 non-filler 로 오판 → ★1=100 사용(게임 275). filler 의도(patch-17-3 275/325/475)와 불일치 → ★1 under-shield (getAbilityShield 휴리스틱 한계, sim fix 후보).
- ⚠️ **구체 반복타 미반영**: 실제 구체 3개가 AS 비례로 회전하며 반복 타격하나 sim 은 데미지 1회를 3초 dot total 로 근사 (반복 횟수 미모델 → under).
- ⚠️ **passive 평타 미반영**: `BonusDamageToAttacks`(scaleAP) 평타 추가 마법 미모델 (AD=0 autos).
- ⚠️ **ShieldPercent/ShieldDuration**: 최대 체력% 보호막 미반영 + 보호막 지속 10초 고정(raw 3초 무시) — generic systemic.

### Trait — 중재자 (ADMIN/Arbiter) / 도전자 (ASTrait)

- **중재자** (`TFT17_ADMIN`, bp 2/3): Arbiter 법률 시스템(`applyArbiterEffect` `:4448`, effectId mana/ap/armor_mr/attack_speed/permanent_hp/shield 6종) 반영.
- **도전자** (`TFT17_ASTrait`, bp 2/3/4/5): `:592` — 새 대상 dash 시 AS +BurstPercent% Burst. (Diana 는 ability selfBuff AS + 도전자 AS 양쪽으로 고AS).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 850, armor/MR 50, AD 0, AS 0.8, range 1, mana 0/50)
- role Fighter (`mapGameRole('APFighter')`)
- AS 버프(selfBuff 0.5/4초) + 구체 데미지(dot 3초, ⚠️ CleaveDamage 사용 — 실제 BaseDamage) + 보호막(getAbilityShield, ⚠️ ★1 under-shield)
- 중재자(Arbiter law) / 도전자(Burst AS) trait

⚠️ **미반영 / mis-model / 버그** (Lint 후보):
- **P2 (wrong-variable 버그)**: 구체 데미지 damageVar 가 `CleaveDamage`(100/100/150)인데 실제는 `BaseDamage`(patch-17-3 audit Orb AP 60/90/145) — config damageVar 정정 필요
- **P2 (under-shield 버그)**: Shield 선두 100 을 getAbilityShield 가 non-filler 오판 → ★1=100(게임 275, patch-17-3 audit filler 275/325/475) — getAbilityShield 휴리스틱 한계
- **P2**: 구체 3개 AS 비례 반복타(`NumAttacks` 3) 미반영 — sim 1회 dot total (under)
- **P2**: passive 평타 `BonusDamageToAttacks`(scaleAP) 미반영 (AD=0 autos)
- **P2**: ShieldPercent(maxHp%) 미반영 ([[pantheon]] 동일) + ShieldDuration(3초) generic shield 10초 고정(systemic)
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Fighter role 마나/타게팅
- [[leblanc]] / [[belveth]] — 동류 중재자/도전자
- [[pantheon]] — ShieldPercent(maxHp%) 미반영 공통
