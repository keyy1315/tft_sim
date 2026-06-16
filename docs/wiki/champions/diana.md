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
sim_active: partial   # ability 「은빛 가호」 passive 평타 BonusDamageToAttacks(scaleAP) 마법 추가 + 사용 시 Shield + AS 버프(ASDuration 4 / AttackSpeed 0.5) + 구체 NumAttacks(3)개 관통 CleaveDamage(scaleAP) 마법(AS 비례 회전). sim aoe_circle r1 + selfBuff{attackSpeed:0.5, duration:4} + damageVar 'CleaveDamage' + dot{duration:3}. CleaveDamage scaleAP(desc scaleAD 없음 → AP 스케일 정상) no-filler → ★1=100/★2=100/★3=150. 보호막 getAbilityShield(Shield scaleAP). 중재자(ADMIN=Arbiter law)/도전자(ASTrait) trait 반영. ⚠️ 미반영: passive 평타 BonusDamageToAttacks(AD=0 autos) / 구체 3개 AS 회전 반복타(sim CleaveDamage 1회 dot total) / ShieldPercent(maxHp%) / ShieldDuration(3초 — generic shield 10초 고정 systemic). calibration: game-423/424 부재(미측정)
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

> 🎯 **Diana 는 보호막 + 구체 회전 AP 파이터** — AS 버프 + 구체 CleaveDamage(scaleAP). CleaveDamage 는 desc 에 scaleAD 없어 **AP 스케일 정상**([[leblanc]]/[[riven]] 의 AD=0 미스케일 함정 회피). ⚠️ 구체 AS 비례 반복타·passive 평타는 미반영.

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
| CleaveDamage | [100, 100, 150, 240, 330, ...] | ✅ `damageVar 'CleaveDamage'` no-filler(v0=v1) → ★1=100/★2=100/★3=150 (scaleAP, dot 3초). desc scaleAD 없어 AP 스케일 정상 |
| Shield | [100, 275, 325, 475, 460, ...] | ✅ `getAbilityShield` **non-filler**(v0=100<v1=275, sentinelRatio 2.75<5) → ★1=100/★2=275/★3=325 (scaleAP) |
| ShieldPercent | [0.05, 0.05, 0.07, 0.1, 0.13, ...] | ⚠️ **미반영** — 최대 체력 % 보호막 가산 (getAbilityShield 미처리, [[pantheon]] PercentHealthShield 동일) |
| AttackSpeed / ASDuration | [0.5] / [4] | ✅ `selfBuff: { attackSpeed: 0.5, duration: 4 }` |
| NumAttacks | [3, ...] | ⚠️ **미반영** — 구체 3개 (sim CleaveDamage 1회 dot total) |
| ShieldDuration | [3, ...] | ⚠️ **미반영** — generic shield `remainingTicks 300`(10초) 고정, raw 3초 무시 (systemic) |
| BonusDamageToAttacks | [0, 52, 78, 135, 230, ...] | ⚠️ **미반영** — passive 평타 추가 마법. Diana AD=0 라 sim 평타 ~0. filler → ★1=52/★2=78/★3=135 |
| BaseDamage | [50, 60, 90, 145, 250, ...] | ⚠️ **미반영** — (구체/평타 base 추정, sim 미사용) |

- sim: `pattern: 'aoe_circle', radius: 1, selfBuff: { attackSpeed: 0.5, duration: 4 }, damageVar: 'CleaveDamage', dot: { duration: 3 }`. AS 버프 + 구체 CleaveDamage 를 3초 dot total + 보호막.
- ⚠️ **구체 반복타 미반영**: 실제 구체 3개가 AS 비례로 회전하며 반복 타격하나 sim 은 `CleaveDamage` 1회를 3초 dot total 로 근사 (반복 횟수 미모델 → under).
- ⚠️ **passive 평타 미반영**: `BonusDamageToAttacks`(scaleAP) 평타 추가 마법 미모델 (AD=0 autos).
- ⚠️ **ShieldPercent/ShieldDuration**: 최대 체력% 보호막 미반영 + 보호막 지속 10초 고정(raw 3초 무시) — generic systemic.

### Trait — 중재자 (ADMIN/Arbiter) / 도전자 (ASTrait)

- **중재자** (`TFT17_ADMIN`, bp 2/3): Arbiter 법률 시스템(`applyArbiterEffect` `:4448`, effectId mana/ap/armor_mr/attack_speed/permanent_hp/shield 6종) 반영.
- **도전자** (`TFT17_ASTrait`, bp 2/3/4/5): `:592` — 새 대상 dash 시 AS +BurstPercent% Burst. (Diana 는 ability selfBuff AS + 도전자 AS 양쪽으로 고AS).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 850, armor/MR 50, AD 0, AS 0.8, range 1, mana 0/50)
- role Fighter (`mapGameRole('APFighter')`)
- AS 버프(selfBuff 0.5/4초) + 구체 `CleaveDamage`(scaleAP, dot 3초) + 보호막(getAbilityShield Shield)
- 중재자(Arbiter law) / 도전자(Burst AS) trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2**: 구체 3개 AS 비례 반복타(`NumAttacks` 3) 미반영 — sim CleaveDamage 1회 dot total (under)
- **P2**: passive 평타 `BonusDamageToAttacks`(scaleAP) 미반영 (AD=0 autos)
- **P2**: ShieldPercent(maxHp%) 미반영 ([[pantheon]] 동일) + ShieldDuration(3초) generic shield 10초 고정(systemic)
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Fighter role 마나/타게팅
- [[leblanc]] / [[belveth]] — 동류 중재자/도전자
- [[pantheon]] — ShieldPercent(maxHp%) 미반영 공통
