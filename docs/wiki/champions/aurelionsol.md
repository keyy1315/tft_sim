---
id: aurelionsol
type: champion
display_name_kr: 아우렐리온 솔
api_name: TFT17_AurelionSol
cost: 4
traits:
  - 메카
  - 전달자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active
sim_active: partial   # ability 「죽음의 광선」 직선 광선 3초 DOT — DamagePerSecond(매초 scaleAP) 마법. sim line + dot { duration:3, perSecond:true } → DamagePerSecond × 3 (Bard/Viktor 동형 perSecond). 유일 damage var = DamagePerSecond, auto-detect pick. non-filler(v0<v1) → ★1=250/★2=320/★3=480. 메카(Mecha AD%/AP)/전달자(ManaTrait InnateManaGain) trait 정합. ⚠️ 미반영: MagicPen(0.3 MR 무시 — raw ability MagicPen 이 unit.stats.magicPen 에 미주입) / DamageReductionPerTarget(raw 0.8 관통 감소 — DOT burn path 라 damageDecay 미적용, 다관통 시 과대) / AugmentedDuration(Concentration augment 4초이나 disable:true set17 inactive — 영향 0). calibration 0 라운드(두 game 모두 부재 — 미측정)
last_verified: 2026-06-16
sources:
  - "public/data/tft_set17_champions.json (TFT17_AurelionSol entry — cost 4, role APCaster, traits [메카/전달자], hp 850, armor/MR 30/30, AD 30, AS 0.75, range 6, mana 15/75, ability '죽음의 광선' variables Duration/AugmentedDuration/DamagePerSecond/MagicPen/DamageReductionPerTarget)"
  - "public/data/tft_set17_traits.json (TFT17_Mecha = 메카 bp 3/4/6 / TFT17_ManaTrait = 전달자 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:260 (TFT17_AurelionSol: { pattern: 'line', damageDecay: 0.15, dot: { duration: 3, perSecond: true } } — auto-detect damageVar 'DamagePerSecond')"
  - "src/lib/simulator/engine/combatLoop.ts:6813 (main) / :7676 (OOR) dot.perSecond → dotTotal = DamagePerSecond × duration(3) / :2299 applyMechaEffects 메카 / :601 전달자(ManaTrait) InnateManaGain(:599-604 read)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[bard]]"
  - "[[viktor]]"
---

# 아우렐리온 솔 (AurelionSol)

## 요약

4코스트 **메카 (`TFT17_Mecha`)** + **전달자 (`TFT17_ManaTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). range 6 (최장급), mana 15/75.
- **ability "죽음의 광선"**: 현재 대상을 향해 `Duration`(3)초 동안 일직선 광선 발사. 광선은 **매초** `DamagePerSecond`(scaleAP) 마법. 관통한 적 하나당 `DamageReductionPerTarget`(80%)씩 감소, 적 MR `MagicPen`(30%) 무시.

> 🎯 **AurelionSol 은 지속 광선 DOT 캐스터** — `DamagePerSecond` 가 **매초** 적용이라 [[bard]]·[[viktor]] 와 동일하게 `dot.perSecond` 로 × Duration(3) 반영. 유일 damage var 라 auto-detect 가 `DamagePerSecond` pick.

> ⚠️ **set17 entity confirm**: `TFT17_AurelionSol` apiName 으로 소속 확인 (cost 4, traits 메카/전달자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 30 / 30 |
| damage | 30 |
| attackSpeed | 0.75 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 15 / 75 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 죽음의 광선 (직선 DOT)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| DamagePerSecond | [250, 320, 480, 2000, ...] | ✅ auto-detect `damageVar 'DamagePerSecond'` non-filler(v0<v1) → idx=star-1 → ★1=250/★2=320/★3=480 (scaleAP, **매초**) |
| Duration | [3, ...] | ✅ `dot.duration: 3` |
| AugmentedDuration | [4, ...] | ⚠️ **미반영(영향 0)** — Concentration augment 시 4초이나 `TFT17_Augment_Concentration` 은 `disable: true` (set17 inactive) → sim 영향 없음 |
| MagicPen | [0.3, ...] | ⚠️ **미반영** — 적 MR 30% 무시. DOT path 는 `unit.stats.magicPen`(item/trait/augment 합산) read 하나 raw ability `MagicPen` 주입 경로 없음 → 과소 피해 |
| DamageReductionPerTarget | [0.8, ...] | ⚠️ **미반영(과대)** — 관통 적당 80% 감소. AurelionSol 은 DOT(burn) path 라 관통 감소(`damageDecay`)가 **아예 적용 안 됨** → raw 0.8 보다 더 과대 |

- sim: `pattern: 'line', damageDecay: 0.15, dot: { duration: 3, perSecond: true }`. `dot.perSecond` → DOT 총량 = `DamagePerSecond★ × Duration(3)` (매초값 × 3, [[bard]]·[[viktor]] 동형).
- ⚠️ **MagicPen 미반영**: 실제는 적 MR 30% 무시이나 raw ability `MagicPen` 이 `unit.stats.magicPen` 에 주입되지 않음 → 탱커 상대 과소.
- ⚠️ **DamageReductionPerTarget 미반영(과대)**: `config.damageDecay`(0.15) 가드는 **즉발 line path(combatLoop:6909) 전용**이고 AurelionSol 은 DOT(burn) 분기(`config.dot`)로 처리되어 per-target loop 의 관통 감소가 없다 → 관통한 전 대상에 동일 `dotTotal` 적용. raw 0.8 감소 대비 sim 은 감소 0 → 다관통 시 과대.

### Trait — 메카 (Mecha) / 전달자 (ManaTrait)

- **메카** (`TFT17_Mecha`, bp 3/4/6): `applyMechaEffects` (`:2299`) — 메카 unit 한정 `AD`%/`AP` flat 가산 (pre-battle setup `:4790-4793`). raw 에 TeamSize/TransformedPercentHealth 변신 변수 존재하나 sim 은 AD/AP 가산만 반영.
- **전달자** (`TFT17_ManaTrait`, bp 2/3/4/5): `InnateManaGain` (`:601`, read `:599-604`) — 전달자 unit mana gain × (1 + N).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 850, armor/MR 30, AD 30, AS 0.75, range 6, mana 15/75)
- role Caster (`mapGameRole('APCaster')`)
- 광선 DOT: `DamagePerSecond★ × Duration(3)` (dot.perSecond), line pattern
- 메카(AD%/AP) / 전달자(InnateManaGain) trait

⚠️ **미반영 / mis-modeled** (Lint 후보):
- **P2**: MagicPen(0.3 MR 무시) 미반영 — raw ability MagicPen 이 unit.stats.magicPen 에 미주입
- **P2**: DamageReductionPerTarget(raw 0.8) 미반영(과대) — DOT(burn) path 라 damageDecay(즉발 path :6909 전용) 미적용 → 다관통 시 감소 0
- **P2(영향 0)**: AugmentedDuration(Concentration augment 4초) — `TFT17_Augment_Concentration` disable:true (set17 inactive)
- **P2**: 메카 변신(TransformedPercentHealth) 미반영 — AD/AP 가산만
- calibration 0 라운드(game-423/424 모두 부재) — perSecond fix 는 correctness ([[bard]]·[[viktor]] 동형, unit test 검증).

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[bard]] — dot.perSecond 동형 (초당값 × duration)
- [[viktor]] — dot.perSecond 동형 DOT 캐스터
