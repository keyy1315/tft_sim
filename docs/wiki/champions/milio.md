---
id: milio
type: champion
display_name_kr: 밀리오
api_name: TFT17_Milio
cost: 2
traits:
  - 시간 균열자
  - 운명술사
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active
sim_active: partial   # ability 「특급 시간 킥」 공 차기 → Damage(scaleAP) + 100% bounce(반감 확률 추가 bounce). sim bounce pattern maxTargets 4, auto-detect damageVar 'Damage'. Damage no-filler ★1=200/★2=255/★3=380. 시간 균열자(Timebreaker)/운명술사(Fateweaver) trait 정합. ⚠️ bounce 데미지 부정확: sim 은 bounce 패턴 전 타겟에 **Damage(255)** 동일 적용 — 실제는 primary Damage + bounce **BounceDamage(★2=85, 훨씬 작음)**. 즉 sim 이 bounce 를 과다 계상하나 calibration 은 -21% under (primary/cast 가 더 under → bounce 정확 수정 시 metric 악화하는 correctness-metric 텐션). 미반영: 운명술사 Lucky(확률 2회) / bounce 반감 확률(maxTargets 4 고정)
last_verified: 2026-06-15
sources:
  - "public/data/tft_set17_champions.json (TFT17_Milio entry — cost 2, role APCaster, traits [시간 균열자/운명술사], hp 550, armor/MR 20/20, AD 30, AS 0.7, range 4, mana 0/30, ability '특급 시간 킥' variables Damage/BounceDamage)"
  - "public/data/tft_set17_traits.json (TFT17_Timebreaker = 시간 균열자 bp 2/3/4 / TFT17_Fateweaver = 운명술사 bp 2/4)"
  - "src/lib/simulator/systems/ability.ts:228 (TFT17_Milio: { pattern: 'bounce', maxTargets: 4 } — auto-detect damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:1878 applyFateweaverEffects 운명술사 / :2100 applyTimebreakerEffects 시간 균열자"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[xayah]]"
  - "[[jhin]]"
---

# 밀리오 (Milio)

## 요약

2코스트 **시간 균열자 (`TFT17_Timebreaker`)** + **운명술사 (`TFT17_Fateweaver`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). mana 0/30 (저비용 — 빠른 시전).
- **ability "특급 시간 킥"**: 현재 대상에 공을 차 `Damage`(scaleAP) 마법. 적중 시 100% 확률로 새 대상에 튕겨 `BounceDamage`(scaleAP) 마법. 튕길 때마다 확률 절반 감소(100%/50%/25%...).

> 🎯 **Milio 는 bounce 캐스터** — primary Damage(★2=255) + bounce BounceDamage(★2=85, 작음). sim 은 bounce pattern(maxTargets 4)으로 모델하나 **모든 bounce 타겟에 Damage 동일 적용**(BounceDamage 미구분). 반감 확률도 고정 4타겟으로 근사.

> ⚠️ **set17 entity confirm**: `TFT17_Milio` apiName 으로 소속 확인 (cost 2, traits 시간 균열자/운명술사, role APCaster). 한글명 list 만으로 후보 선정 금지.

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
| initialMana / mana | 0 / 30 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 특급 시간 킥 (bounce)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [200, 255, 380, 575, ...] | ✅ auto-detect `damageVar 'Damage'` no-filler → ★1=200/★2=255/★3=380 (scaleAP) — **bounce 타겟 전부에 적용** |
| BounceDamage | [80, 85, 130, 190, ...] | ⚠️ **미참조** — sim 은 bounce 도 Damage 로 계상 (실제 bounce = BounceDamage ★2=85) no-filler → ★1=80/★2=85/★3=130 |

- sim: `pattern: 'bounce', maxTargets: 4` (damageVar 미지정 → auto-detect `Damage`). `findAbilityTargets` bounce → [primary, bounce1, bounce2, bounce3] 최대 4, 각 타겟에 동일 abilityDmg(Damage) 적용.
- ⚠️ **bounce 데미지 부정확 (correctness-metric 텐션)**: sim 이 bounce 타겟에 Damage(255)를 적용 → 실제 BounceDamage(85)보다 **과다**. 그런데 calibration 은 Milio **-21% under** — 즉 primary/cast 측이 더 under 라 bounce 과다가 부분 상쇄 중. **bounce 를 BounceDamage 로 정확히 고치면 sim 데미지 감소 → Milio 더 under (metric 악화)**. correctness fix 와 calibration 이 충돌 → 보류 (deeper under 규명 후).
- ⚠️ **반감 확률 미반영**: 실제 bounce 는 100%/50%/25%... 확률. sim 은 maxTargets 4 고정 (확률 무시).

### Trait — 시간 균열자 (Timebreaker) / 운명술사 (Fateweaver)

- **시간 균열자** (`TFT17_Timebreaker`, bp 2/3/4): `applyTimebreakerEffects` (`:2100`) — teamwide AS + 시간 균열자 unit 추가 AS.
- **운명술사** (`TFT17_Fateweaver`, bp 2/4): `applyFateweaverEffects` (`:1878`) — Precision(spellCanCrit) + crit. ⚠️ Lucky(행운, 확률 2회 시도 better-of-2) 미구현 → Milio bounce 확률에 행운 미적용.

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 550, armor/MR 20, AD 30, AS 0.7, range 4, mana 0/30)
- role Caster (`mapGameRole('APCaster')`)
- bounce pattern (maxTargets 4) Damage(scaleAP)
- 시간 균열자 / 운명술사(Precision/crit) trait

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: bounce 타겟에 Damage 적용 (실제 BounceDamage ★2=85) — 과다이나 calibration -21% under 라 정확 수정 시 metric 악화 (correctness-metric 텐션, 보류)
- **P2**: bounce 반감 확률 (100%/50%/25%) 미반영 — maxTargets 4 고정
- **P2**: 운명술사 Lucky (확률 2회 better-of-2) 미구현

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[xayah]] / [[jhin]] — 동류 bounce/다단 히트
