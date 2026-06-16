---
id: lissandra
type: champion
display_name_kr: 리산드라
api_name: TFT17_Lissandra
cost: 1
traits:
  - 암흑의 별
  - 길잡이
  - 복제자
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active   # 17.4 LIVE 데이터 기준 (raw json meta 17.4 partial). 17.5 raw 미취득 — 외부 17.5/17.5b 패치노트 champion list 에 Lissandra 미포함(보조 확인, raw diff 아님)
last_verified: 2026-06-16
sim_active: partial   # ability 「암흑 물질」 처음 적중 대상 Damage(scaleAP) 마법 + 폭발 시 주변 SecondaryDamage(scaleAP). sim aoe_circle r1 + secondaryDamageVar 'SecondaryDamage'. auto-detect 주 damageVar 'Damage' no-filler → ★1=200/★2=250/★3=375. SecondaryDamage filler(v0>v1) → ★1=50/★2=75/★3=115. 암흑의 별(DarkStar applyDarkStarEffects)/복제자(APTrait) trait 반영. ⚠️ 길잡이(SummonTrait) 미반영(별도 helper 없음 — 소환물 메커니즘 미모델). ⚠️ aoe_circle+secondaryDamageVar over-application (combatLoop:6895-6898 — 주 대상 포함 전 타겟에 Damage+SecondaryDamage, Veigar/Pyke/Gwen/Nami/Riven 공통). calibration: game-424 -88% — per-cast 정상(★2 232/cast)이나 cost1 hp450 squishy 조기사망(3캐스트 후 사망, duration-bound 모델링 아님)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Lissandra entry — cost 1, role APCaster, traits [암흑의 별/길잡이/복제자], hp 450, armor/MR 15/15, AD 30, AS 0.7, range 4, mana 0/30, ability '암흑 물질' variables Damage/SecondaryDamage)"
  - "public/data/tft_set17_traits.json (TFT17_DarkStar = 암흑의 별 bp 2/4/6/9 / TFT17_SummonTrait = 길잡이 bp 3/5/7 / TFT17_APTrait = 복제자 bp 2/4)"
  - "src/lib/simulator/systems/ability.ts:222 (TFT17_Lissandra: { pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'SecondaryDamage' } — auto-detect 주 damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:6895-6898 secondaryDamageVar 가산 / :2186 applyDarkStarEffects 암흑의 별(:2196 darkStarUnits unitHasTrait) / :1855 applyReplicatorTrait 복제자(:1850 Lissandra 포함). 길잡이=TFT17_SummonTrait sim helper 없음(trait.ts:41 emblem 매핑만)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[veigar]]"
  - "[[rammus]]"
---

# 리산드라 (Lissandra)

## 요약

1코스트 **암흑의 별 (`TFT17_DarkStar`)** + **길잡이 (`TFT17_SummonTrait`)** + **복제자 (`TFT17_APTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). hp 450 (squishy), range 4, mana 0/30 (저비용 빠른 시전).
- **ability "암흑 물질"**: 현재 대상에 파편 → 처음 적중 대상 `Damage`(scaleAP) 마법. 처음 대상 적중 또는 사거리 끝 도달 시 폭발 → 주변 대상 `SecondaryDamage`(scaleAP) 마법.

> 🎯 **Lissandra 는 1코 AOE 캐스터** — 주 `Damage` + 폭발 `SecondaryDamage`. ⚠️ sim 은 [[veigar]] 와 동일하게 `aoe_circle + secondaryDamageVar` over-application (원 안 전 타겟이 Damage+SecondaryDamage 둘 다). game-424 -88% 는 조기사망(duration)이 주인.

> ⚠️ **set17 entity confirm**: `TFT17_Lissandra` apiName 으로 소속 확인 (cost 1, traits 암흑의 별/길잡이/복제자, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 450 |
| armor / magicResist | 15 / 15 |
| damage | 30 |
| attackSpeed | 0.7 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 30 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 암흑 물질 (AOE + 폭발)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [200, 250, 375, 600, 1020, ...] | ✅ auto-detect 주 `damageVar 'Damage'` no-filler(v0<v1) → ★1=200/★2=250/★3=375 (scaleAP) |
| SecondaryDamage | [100, 50, 75, 115, 195, ...] | ⚠️ `secondaryDamageVar 'SecondaryDamage'` filler(v0>v1) → ★1=50/★2=75/★3=115 (scaleAP). over-application 주의(아래) |

- sim: `pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'SecondaryDamage'`. `combatLoop.ts:6895-6898` per-target loop 에서 모든 타겟 baseDmg 에 SecondaryDamage 가산.
- ⚠️ **over-application**: aoe_circle 은 원 안 적 전체를 타겟으로 반환 → 주 대상 포함 전원이 `Damage + SecondaryDamage` 둘 다 받음. 실제는 처음 적중 대상=Damage / 주변=폭발 SecondaryDamage 분리. `aoe_circle + secondaryDamageVar` **공통 구조**([[veigar]]/Pyke/Gwen/Nami/Riven 동일) — Lissandra 고유 아님.

### Trait — 암흑의 별 / 길잡이 / 복제자

- **암흑의 별** (`TFT17_DarkStar`, bp 2/4/6/9): `applyDarkStarEffects` (`:2186`) — darkStar unit(`unitHasTrait('암흑의 별')` `:2196`)에 ADAP/supermassive 보너스 + (6)+ 소형 블랙홀. Lissandra 도 darkStar unit 으로 수혜.
- **길잡이** (`TFT17_SummonTrait`, bp 3/5/7): ⚠️ **sim 미반영** — 별도 trait helper 함수 없음(`trait.ts:41` 은 emblem 아이템 이름 매핑만). 소환물 기반 메커니즘 미모델.
- **복제자** (`TFT17_APTrait`, bp 2/4): `applyReplicatorTrait` (`:1855`) — 복제자 보유 unit `mfReplicatorEffectiveness` (Lissandra 포함 `:1850`).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 450, armor/MR 15, AD 30, AS 0.7, range 4, mana 0/30)
- role Caster (`mapGameRole('APCaster')`)
- 주 `Damage`(scaleAP) AOE + 주변 `SecondaryDamage`(secondaryDamageVar)
- 암흑의 별(DarkStar) / 복제자 trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2**: 길잡이(SummonTrait) 미반영 — 별도 helper 없음, 소환물 메커니즘 미모델
- **P2**: aoe_circle+secondaryDamageVar over-application — 주 대상에도 SecondaryDamage, 주변에도 Damage (combatLoop:6895-6898 공통 구조, [[veigar]] 동일)
- calibration: game-424 **-88%** — per-cast 정상(★2 232/cast)이나 cost1 hp450 squishy 3캐스트 후 사망 → **조기사망(duration-bound, 모델링 아님)**. [[veigar]] 와 동일 패턴 — survivability systemic 레버 영역(clean fix 아님).

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[veigar]] — 동형 1코 AOE 캐스터 (aoe_circle+secondaryDamageVar over-application + 조기사망 공유)
- 암흑의 별 (DarkStar) — `applyDarkStarEffects` (combatLoop.ts:2186). trait 전용 위키 페이지 미작성
