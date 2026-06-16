---
id: karma
type: champion
display_name_kr: 카르마
api_name: TFT17_Karma
cost: 4
traits:
  - 암흑의 별
  - 여행자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active
sim_active: partial   # ability 「특이점」 블랙홀 — 대상+가장 가까운 적 NumEnemies명에게 Damage(scaleAP) "나누어"(분배) + 대상 추가 SecondaryDamage(scaleAP). sim multi maxTargets 3 + secondaryDamageVar 'SecondaryDamage'. Damage filler ★1=570/★2=855/★3=5000 / SecondaryDamage ★1=180/★2=270. ⚠️ **over-count 2건**: (a) Damage "나누어"=분배인데 multi 가 각 타겟에 full 적용(÷ 안 함) → 多타겟 시 과다 (b) SecondaryDamage 는 raw "대상 추가"(primary 한정)인데 secondaryDamageVar 가 全 타겟 가산 → 과다. 정확 모델은 primary-divided + primary-only secondary helper 필요 (divided-split helper 는 additive secondary 전용). 🔴 **calibration 0 라운드(미측정)** → fix 검증 불가 + 미진행. 암흑의 별/여행자 trait 정합
last_verified: 2026-06-16
sources:
  - "public/data/tft_set17_champions.json (TFT17_Karma entry — cost 4, role APCaster, traits [암흑의 별/여행자], mana 10/55, ability '특이점' variables Damage/SecondaryDamage/NumEnemies/BaseHexRange/MaximumHexes)"
  - "public/data/tft_set17_traits.json (TFT17_DarkStar = 암흑의 별 bp 2/4/6/9 / TFT17_FlexTrait = 여행자 bp 2/3/4/5/6)"
  - "src/lib/simulator/systems/ability.ts:259 (TFT17_Karma: { pattern: 'multi', maxTargets: 3, secondaryDamageVar: 'SecondaryDamage' })"
  - "src/lib/simulator/engine/combatLoop.ts:2186 applyDarkStarEffects 암흑의 별 / :1780 applyFlexTraitBuffs 여행자"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[aurora]]"
  - "[[chogath]]"
---

# 카르마 (Karma)

## 요약

4코스트 **암흑의 별 (`TFT17_DarkStar`)** + **여행자 (`TFT17_FlexTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌).
- **ability "특이점"**: 블랙홀로 대상 + 대상과 가장 가까운 적 `NumEnemies`(★1-3=2/★4+=4)명에게 `Damage`(scaleAP) 마법을 **나누어**(분배) 입힘 + 대상에 추가로 `SecondaryDamage`(scaleAP).

> 🎯 **Karma 는 분배형 블랙홀 캐스터** — Damage 가 적중 적에게 "나누어"(divided) 분배 + 대상 추가 데미지. ⚠️ sim 은 `multi` 가 Damage 를 각 타겟에 full 적용(분배 안 함) → over-count. **calibration 0 라운드(미측정)** 라 fix 검증 불가 → 미진행.

> ⚠️ **set17 entity confirm**: `TFT17_Karma` apiName 으로 소속 확인 (cost 4, traits 암흑의 별/여행자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 30 / 30 |
| damage | 40 |
| attackSpeed | 0.8 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 10 / 55 |

### Active — 특이점 (블랙홀)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [0, 570, 855, 5000, ...] | ⚠️ **over-count** — auto-detect `Damage`(scaleAP) filler → ★1=570/★2=855/★3=5000. raw "나누어"(분배)인데 `multi` 가 각 타겟에 **full** 적용(÷aliveTargets 안 함) → 多타겟 시 과다 |
| SecondaryDamage | [0, 180, 270, 1000, ...] | ⚠️ **over-apply** — `secondaryDamageVar` 가 全 타겟 가산. raw "대상 추가"(primary 한정) → 과다. filler → ★1=180/★2=270/★3=1000 |
| NumEnemies | [2, 2, 2, 4, 4, 4, 4] (no-filler) | 분배 대상 수 ★1-3=2 / ★4+=4 (readVarByStar idx=star-1). sim 은 maxTargets 3 고정 — NumEnemies raw 미read (불일치) |

- sim: `pattern: 'multi', maxTargets: 3, secondaryDamageVar: 'SecondaryDamage'`. multi 3명에 Damage(scaleAP) full + SecondaryDamage 가산.
- ⚠️ **분배 미구현**: Damage 는 "나누어"=총량 분배(÷타겟)인데 multi 는 각 타겟 full → over-count. [[aurora]] 의 `splitDamageVar`(additive divided) 와 달리 Karma 는 **primary 자체가 divided** → 별도 mechanism (primary-divided + primary-only secondary) 필요.
- 🔴 **calibration 0 라운드**: Karma 가 측정 게임에 player carry 로 미등장 → fix 검증/측정 불가 → 미진행 (over-count 는 documented known issue).

### Trait — 암흑의 별 (DarkStar) / 여행자 (FlexTrait)

- **암흑의 별** (`TFT17_DarkStar`, bp 2/4/6/9): `applyDarkStarEffects` (`:2186`).
- **여행자** (`TFT17_FlexTrait`, bp 2/3/4/5/6): `applyFlexTraitBuffs` (`:1780`) — 전투 시작 모든 아군 효과. 여행자 챔프(`unitHasTrait(u, '여행자')` `:1791`)는 ×2 (multiplier 2). Karma 는 여행자 보유 → ×2 대상.

## sim 통합 상태 — `partial`

✅ **활성**:
- role Caster (`mapGameRole('APCaster')`)
- multi 3명 Damage(scaleAP) + SecondaryDamage 가산
- 암흑의 별 / 여행자 trait

⚠️ **부정확** (Lint 후보, calibration 미측정 → 미진행):
- **P2**: Damage "나누어"(분배) 미구현 — multi 가 각 타겟 full → over-count (primary-divided helper 필요)
- **P2**: SecondaryDamage 가 全 타겟 가산 (raw "대상 추가" primary 한정) → over-apply
- **P2**: NumEnemies ★별(★1-3=2/★4=4) vs sim maxTargets 3 고정 불일치 (raw 미read)

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[aurora]] — divided-split helper (additive divided) 동류
- [[chogath]] — 동류 암흑의 별
