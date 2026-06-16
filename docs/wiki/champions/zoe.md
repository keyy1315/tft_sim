---
id: zoe
type: champion
display_name_kr: 조이
api_name: TFT17_Zoe
cost: 2
traits:
  - 중재자
  - 전달자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: "active (⚠️ raw Damage 17.3 추정 — patch-17-4 'Zoe 스펠 68/102/153→73/110/180'. 17.4 pending: Damage 73/110/180 ([[patch-17-4]]). 17.5 변경 없음. 데이터/sim 미반영)"
last_verified: 2026-06-16
sim_active: partial   # ability 「통통별」 처음 적중 Damage(scaleAP) + 관통 SecondaryDamage(scaleAP) + 방향전환 NumRedirects(4) 동일 피해. sim line + maxTargets 4 (auto-detect 주 damageVar 'Damage'). ⚠️ Damage [50,68,102,153] non-filler 판정 → sim ★1=50/★2=68/★3=102, 단 patch-17-4 표기 '68/102/153'(★1-★3 이면 leading 50=filler → 게임 ★1=68, sim 50=under shifted-indexing, Diana/Ornn 동류). ⚠️ config secondaryDamageVar 없음 → 관통 SecondaryDamage 미반영(line 전 타겟이 main Damage). 중재자(ADMIN Arbiter law :4448)/전달자(ManaTrait InnateManaGain :599) trait. calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Zoe entry — cost 2, role APCaster, traits [중재자/전달자], hp 550, armor/MR 20/20, AD 30, AS 0.7, range 4, mana 0/50, ability '통통별' variables Damage/SecondaryDamage/NumRedirects/AugmentedNumRedirects/BaseSpeed/SpeedPerBounce)"
  - "public/data/tft_set17_traits.json (TFT17_ADMIN = 중재자 bp 2/3 / TFT17_ManaTrait = 전달자 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:235 (TFT17_Zoe: { pattern: 'line', maxTargets: 4 } — auto-detect 주 damageVar 'Damage', secondaryDamageVar 미설정)"
  - "src/lib/simulator/engine/combatLoop.ts:4448 applyArbiterEffect 중재자 / :599 전달자(ManaTrait) InnateManaGain"
related:
  - "[[patch-17-4]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[diana]]"
  - "[[leblanc]]"
---

# 조이 (Zoe)

## 요약

2코스트 **중재자 (`TFT17_ADMIN`)** + **전달자 (`TFT17_ManaTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). hp 550, range 4, mana 0/50.
- **ability "통통별"**: 현재 대상에 통통별 → 처음 적중 `Damage`(scaleAP) + 관통 `SecondaryDamage`(scaleAP). 투사체가 목표 도달 시 방향 전환해 멀리 있는 적에게 날아가며(속도 증가) 동일 피해 — `NumRedirects`(4)/`AugmentedNumRedirects`(6, Concentration augment)회.

> 🎯 **Zoe 는 통통별 관통 + 방향전환 캐스터** — 처음 `Damage` + 관통/재유도 `SecondaryDamage`. sim line maxTargets 4 로 근사. ⚠️ config secondaryDamageVar 없어 관통 SecondaryDamage 미반영 + Damage filler 판정 가능성(아래).

> ⚠️ **set17 entity confirm**: `TFT17_Zoe` apiName 으로 소속 확인 (cost 2, traits 중재자/전달자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 550 |
| armor / magicResist | 20 / 20 |
| damage | 30 |
| attackSpeed | 0.7 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 50 |

> ⚠️ **Damage 17.3 추정**: patch-17-4 "Zoe 스펠 `68/102/153 → 73/110/180`". raw Damage [50,68,102,153,260] 의 [1,2,3]=68/102/153 과 일치 → 17.3 값(★1-★3 이면 leading 50=17.2 filler). 17.4 갱신(73/110/180) 미반영([[patch-17-4]]).

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 통통별 (관통 + 방향전환)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [50, 68, 102, 153, 260, ...] | ⚠️ auto-detect 주 `damageVar 'Damage'` **non-filler 판정**(v0=50<v1=68, ratio 1.36) → sim ★1=50/★2=68/★3=102. 단 patch-17-4 '68/102/153'(★1-★3)이면 leading 50=filler → 게임 ★1=68, **sim 50=under shifted-indexing**([[diana]]/Ornn 동류 getAbility 휴리스틱 한계 가능성) |
| SecondaryDamage | [20, 34, 51, 77, 130, ...] | ⚠️ **미반영** — config `secondaryDamageVar` 미설정. 관통/재유도 추가 피해 모델 안 됨(line 전 타겟이 main Damage). filler 시 ★1=34 |
| NumRedirects / AugmentedNumRedirects | [4] / [6] | ⚠️ 방향전환 4(증강 6)회 — sim line `maxTargets: 4` 로 근사(재유도 mechanism 미모델) |
| BaseSpeed / SpeedPerBounce | [1600] / [800] | — (투사체 속도, sim 즉발이라 무관) |

- sim: `pattern: 'line', maxTargets: 4`. 직선 관통 `Damage`(scaleAP) 최대 4타겟.
- ⚠️ **SecondaryDamage 미반영**: 관통/재유도 대상은 실제 `SecondaryDamage`(작은 값)인데 config 에 secondaryDamageVar 없어 line 전 타겟이 main `Damage` 적용 → 관통 타겟 과대(over).
- ⚠️ **Damage filler 가능성**: patch-17-4 값과 비교 시 leading 50 이 filler 일 수 있어 sim ★1 under 가능 — raw 17.3/17.4 스냅샷 확보 시 확정 필요(룰 #20).

### Trait — 중재자 (ADMIN/Arbiter) / 전달자 (ManaTrait)

- **중재자** (`TFT17_ADMIN`, bp 2/3): Arbiter 법률 시스템(`applyArbiterEffect` `:4448`, effectId mana/ap/armor_mr/attack_speed/permanent_hp/shield).
- **전달자** (`TFT17_ManaTrait`, bp 2/3/4/5): `InnateManaGain` (`:599`) — 전달자 unit mana gain × (1 + N).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 550, armor/MR 20, AD 30, AS 0.7, range 4, mana 0/50)
- role Caster (`mapGameRole('APCaster')`)
- 직선 관통 `Damage`(scaleAP) line maxTargets 4
- 중재자(Arbiter law) / 전달자(InnateManaGain) trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2**: SecondaryDamage(관통/재유도 추가 피해) 미반영 — config secondaryDamageVar 없음, line 전 타겟 main Damage 적용(over)
- **P2**: Damage filler 판정 가능성 — patch-17-4 '68/102/153'(★1-★3)이면 leading 50 filler → sim ★1=50 under(shifted-indexing). raw 17.3/17.4 스냅샷 확보 시 확정
- **P2**: 방향전환(NumRedirects 4) 재유도 mechanism 미모델 — line maxTargets 4 근사
- **P2**: raw Damage 17.3 — 17.4(68/102/153→73/110/180) 미반영([[patch-17-4]])
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[diana]] — getAbility filler shifted-indexing 휴리스틱 한계 공통
- [[leblanc]] — 동류 중재자(Arbiter)
