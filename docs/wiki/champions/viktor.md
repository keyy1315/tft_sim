---
id: viktor
type: champion
display_name_kr: 빅토르
api_name: TFT17_Viktor
cost: 3
traits:
  - 초능력
  - 전달자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active
sim_active: partial   # ability 「초능력 폭풍」 4초 폭풍 — 매초 Damage(scaleAP) 마법 DOT (Bard 동형 perSecond). sim aoe_circle r1 + dot { duration:4, perSecond:true } → Damage × 4. Damage filler ★1=185/★2=275/★3=475. 초능력(PsyOps)/전달자(ManaTrait) trait 정합. ⚠️ 미반영: RadiusIncreasePerSecond(0.3 매초 반경 증가 — sim radius 1 고정) / FalloffPerHex(0.6 중심거리 감소 — radius 1 라 영향 작음) / AugmentedDuration(Concentration augment). calibration 0 라운드(미측정)
last_verified: 2026-06-16
sources:
  - "public/data/tft_set17_champions.json (TFT17_Viktor entry — cost 3, role APCaster, traits [초능력/전달자], hp 650, armor/MR 25/25, AD 30, AS 0.8, range 4, mana 20/80, ability '초능력 폭풍' variables Damage/Duration/RadiusIncreasePerSecond/FalloffPerHex)"
  - "public/data/tft_set17_traits.json (TFT17_PsyOps = 초능력 bp 2/4 / TFT17_ManaTrait = 전달자 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:248 (TFT17_Viktor: { pattern: 'aoe_circle', radius: 1, dot: { duration: 4, perSecond: true } })"
  - "src/lib/simulator/engine/combatLoop.ts:6812-6813 (main) / :7675-7676 (OOR) dot.perSecond → dotTotal = Damage × duration / :601 전달자(ManaTrait) InnateManaGain(:5772 read)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[bard]]"
  - "[[aurelionsol]]"
---

# 빅토르 (Viktor)

## 요약

3코스트 **초능력 (`TFT17_PsyOps`)** + **전달자 (`TFT17_ManaTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌).
- **ability "초능력 폭풍"**: `Duration`(4)초 동안 적을 따라다니는 1칸 폭풍 소환. 매초 크기가 커지며(`RadiusIncreasePerSecond` 0.3) 범위 내 적에 `Damage`(scaleAP) 마법. 중심에서 1칸 멀어질 때마다 `FalloffPerHex`(60%) 감소.

> 🎯 **Viktor 는 지속 폭풍 DOT 캐스터** — `Damage` 가 **매초** 적용(per-second)이라 [[bard]] 와 동일하게 `dot.perSecond` 로 × Duration(4) 반영. 폭풍 크기 증가/falloff 는 미반영(radius 1 고정).

> ⚠️ **set17 entity confirm**: `TFT17_Viktor` apiName 으로 소속 확인 (cost 3, traits 초능력/전달자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 650 |
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

### Active — 초능력 폭풍 (DOT)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [200, 185, 275, 475, ...] | ✅ auto-detect `damageVar 'Damage'` filler(v0>v1) → ★1=185/★2=275/★3=475 (scaleAP, **매초**) |
| Duration | [4, ...] | ✅ `dot.duration: 4` |
| RadiusIncreasePerSecond | [0.3, ...] | ⚠️ **미반영** — sim radius 1 고정 (폭풍 크기 증가 없음) |
| FalloffPerHex | [0.6, ...] | ⚠️ **미반영** — 중심거리 감소 (radius 1 이라 영향 작음) |

- sim: `pattern: 'aoe_circle', radius: 1, dot: { duration: 4, perSecond: true }`. `dot.perSecond` → DOT 총량 = `Damage★ × Duration(4)` (매초값 × 4, [[bard]] 동형). aoe_circle radius 1.
- ⚠️ **폭풍 크기 증가(RadiusIncreasePerSecond) 미반영**: 실제 폭풍은 매초 0.3 반경 증가하나 sim 은 radius 1 고정 → 후반 광역 미반영. FalloffPerHex 도 radius 1 이라 영향 작음.

### Trait — 초능력 (PsyOps) / 전달자 (ManaTrait)

- **초능력** (`TFT17_PsyOps`, bp 2/4): (4) tier 활성(`isPsyOpsTier4Active` `:2325`) 시 `applyPsyOpsRadiantSwap`(`:2344`) — pre-battle setup(`:4635-4652`)에서 초능력 unit 의 일반 PsyOps 아이템 → Radiant 변종 자동 swap. swap 후 아이템 효과는 ITEM_EFFECTS registry 적용.
- **전달자** (`TFT17_ManaTrait`, bp 2/3/4/5): `InnateManaGain` (`:601`) — 전달자 unit mana gain × (1 + N).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 650, armor/MR 25, AD 30, AS 0.8, range 4, mana 20/80)
- role Caster (`mapGameRole('APCaster')`)
- 폭풍 DOT: `Damage★ × Duration(4)` (dot.perSecond), aoe_circle radius 1
- 초능력 / 전달자 trait

⚠️ **미반영** (Lint 후보):
- **P2**: RadiusIncreasePerSecond(0.3 매초 반경 증가) — sim radius 1 고정
- **P2**: FalloffPerHex(0.6 중심거리 감소) — radius 1 이라 영향 작음
- **P2**: AugmentedDuration(Concentration augment 시 5초) 미반영
- calibration 0 라운드(미측정) — perSecond fix 는 correctness ([[bard]] 동형, unit test 검증).

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[bard]] — dot.perSecond 동형 (초당값 × duration)
- [[aurelionsol]] — 동류 DOT 캐스터
