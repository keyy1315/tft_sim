---
id: aurora
type: champion
display_name_kr: 오로라
api_name: TFT17_Aurora
cost: 3
traits:
  - 동물특공대
  - 여행자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active
sim_active: partial   # ability 「고양된 해킹」 2칸 균열 — Damage(scaleAP) per-target. sim aoe_circle r2, auto-detect damageVar 'Damage'. Damage filler ★1=80/★2=120/★3=190. 여행자(FlexTrait) trait 정합 / 동물특공대(AnimaSquad)=전투 외 shop 시스템(sim 비해당). ⚠️ 미반영: SplitDamage(★1=370/★2=555 — "나누어 입힘"=분배 total, secondaryDamageVar full-per-target 적용 시 +96% overshoot 확인 → divided 시맨틱 별도 helper 필요, 보류) / HexPercent 저장 피해(받는 피해 10% 저장 → 해킹 종료 시 고정피해, 미모델) / HexDuration. calibration -48% — SplitDamage(주 성분) + Hex 누락
last_verified: 2026-06-15
sources:
  - "public/data/tft_set17_champions.json (TFT17_Aurora entry — cost 3, role APCaster, traits [동물특공대/여행자], hp 700, armor/MR 25/25, AD 30, AS 0.8, range 4, mana 20/80, ability '고양된 해킹' variables Damage/SplitDamage/HexPercent/HexDuration/SpellHexRadius)"
  - "public/data/tft_set17_traits.json (TFT17_AnimaSquad = 동물특공대 bp 3/6 / TFT17_FlexTrait = 여행자 bp 2/3/4/5/6)"
  - "src/lib/simulator/systems/ability.ts:237 (TFT17_Aurora: { pattern: 'aoe_circle', radius: 2 } — auto-detect damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:1780 applyFlexTraitBuffs 여행자 (AnimaSquad 은 applyAnimaSquadEffects 없음 — 전투 외 shop/tech, sim 비해당)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[jinx]]"
  - "[[twistedfate]]"
---

# 오로라 (Aurora)

## 요약

3코스트 **동물특공대 (`TFT17_AnimaSquad`)** + **여행자 (`TFT17_FlexTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌).
- **ability "고양된 해킹"**: 대상 포함 `SpellHexRadius`(2)칸 균열 → 범위 내 적을 `HexDuration`(4)초 해킹 + 각 `Damage`(scaleAP) 마법 + 적중 적 전체에 `SplitDamage`(scaleAP) **나누어**(분배). 해킹된 적은 받는 피해의 `HexPercent`(10%)를 저장 → 해킹 종료 시 저장량만큼 고정 피해(대상 처치 시 조기 종료).

> 🎯 **Aurora 는 균열 해킹 캐스터** — 주 데미지는 SplitDamage(★2=555 ≫ Damage 120)와 Hex 저장 피해. **단 둘 다 미모델** (SplitDamage 분배 시맨틱 + Hex 지연 true) → calibration -48%. sim 은 per-target Damage 만 반영.

> ⚠️ **set17 entity confirm**: `TFT17_Aurora` apiName 으로 소속 확인 (cost 3, traits 동물특공대/여행자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 700 |
| armor / magicResist | 25 / 25 |
| damage | 30 |
| attackSpeed | 0.8 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 20 / 80 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 고양된 해킹

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [2.5, 80, 120, 190, ...] | ✅ auto-detect `damageVar 'Damage'` filler(sentinel) → ★1=80/★2=120/★3=190 (scaleAP) |
| SplitDamage | [3, 370, 555, 890, ...] | ⚠️ **미반영** filler → ★1=370/★2=555/★3=890 (scaleAP). "나누어 입힘"=분배 total |
| HexPercent | [0.1, ...] | ⚠️ **미반영** — 받는 피해 10% 저장 → 해킹 종료 시 고정 피해 |
| HexDuration | [4, ...] | ⚠️ 해킹 지속 4초 (저장 메커니즘 미모델) |
| SpellHexRadius | [2, ...] | ✅ aoe_circle radius 2 |

- sim: `pattern: 'aoe_circle', radius: 2` (damageVar 미지정 → auto-detect `Damage`). 2칸 AOE 각 적에 Damage(scaleAP).
- ⚠️ **SplitDamage 미반영 (주 데미지원)**: ★2=555 로 Damage(120)보다 큼. **"나누어 입힘"=적중 적 전체에 분배(total split)** 인데, `secondaryDamageVar: 'SplitDamage'` 적용 시 per-target loop 에서 **full(분배 안 함)** 합산 → 측정 결과 Aurora **+96% overshoot** (game-424 -17→+1.6%). divided 시맨틱은 별도 helper 필요 → **보류**.
- ⚠️ **HexPercent 저장 피해 미반영**: 해킹된 적이 4초간 받는 모든 피해의 10% 저장 → 종료 시 고정(true) 피해. 지연 + 누적 메커니즘 미모델.

### Trait — 동물특공대 (AnimaSquad) / 여행자 (FlexTrait)

- **동물특공대** (`TFT17_AnimaSquad`, bp 3/6): `applyAnimaSquadEffects` **없음** — 전투 외 shop/tech 시스템(아이템 제작), scaling.json synergy 없음 → **전투 sim 비해당** ([[jinx]] 와 동일, 룰 #16).
- **여행자** (`TFT17_FlexTrait`, bp 2/3/4/5/6): `applyFlexTraitBuffs` (`:1780`) — 전투 시작 시 모든 아군 효과 (여행자 챔프는 ×2).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 700, armor/MR 25, AD 30, AS 0.8, range 4, mana 20/80)
- role Caster (`mapGameRole('APCaster')`)
- 2칸 AOE Damage(scaleAP) per-target
- 여행자(FlexTrait) trait

⚠️ **미반영** (Lint 후보):
- **P2**: SplitDamage (주 데미지원, ★2=555) — "나누어 입힘"=분배 total, secondaryDamageVar full 적용 시 +96% overshoot → divided helper 필요, 보류
- **P2**: HexPercent 저장 피해 (받는 피해 10% → 해킹 종료 시 고정) 미모델
- **➖**: 동물특공대 = 전투 외 shop 시스템 (sim 비해당)
- calibration -48%: SplitDamage + Hex 누락이 주 원인 (둘 다 특수 메커니즘 — 단순 fix 불가).

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[jinx]] — 동물특공대(전투 외) 동류
- [[twistedfate]] — 동류 AP 캐스터
