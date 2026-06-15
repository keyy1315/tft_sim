---
id: nunu
type: champion
display_name_kr: 누누와 윌럼프
api_name: TFT17_Nunu
cost: 4
traits:
  - 별돌보미
  - 선봉대
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank')). carry augment 없음
raw_role: APTank
current_patch_status: active
sim_active: partial   # ability 「재앙」 2칸 AOE InitialDamage(scaleAP) + 띄움(stun). sim aoe_circle r2 + stun 1.75 + damageVar InitialDamage. InitialDamage filler ★1=120/★2=180/★3=2000. 별돌보미(Stargazer) 정합 / 선봉대(ShieldTank Vanguard) 는 전투 시작 보호막만(Durability+5%/re-shield 미구현). Shield 은 getAbilityShield 로 cast 시 적용(✅). ⚠️ 미반영: FollowupDamage(2번째 타격, ★2=150/★3=2000 — secondaryDamageVar 미설정) / ShieldDuration(4초→sim 30초 고정) / StunDuration ★scaling(hardcoded 1.75 = ★2값). 🔑 **calibration -82% 의 지배 요인은 값 갭 아니라 cast 빈도**: mana 40/**145**(초고비용) → sim 짧은 전투(6~12s, 10s 포위전에서도 cast 0회)서 거의 시전 못 함 → ability 데미지 대부분 미발생 (duration/cast-frequency bound, FollowupDamage fix 도 cast 없어 영향 0 → 미적용)
last_verified: 2026-06-15
sources:
  - "public/data/tft_set17_champions.json (TFT17_Nunu entry — cost 4, role APTank, traits [별돌보미/선봉대], hp 1300, armor/MR 60/60, AD 60, AS 0.65, range 1, mana 40/145, ability '재앙' variables Shield/InitialDamage/FollowupDamage/StunDuration/ShieldDuration/LockoutTime)"
  - "public/data/tft_set17_traits.json (TFT17_Stargazer* = 별돌보미 / TFT17_ShieldTank = 선봉대 bp 2/4/6)"
  - "src/lib/simulator/systems/ability.ts:258 (TFT17_Nunu: { pattern: 'aoe_circle', radius: 2, stun: 1.75, damageVar: 'InitialDamage' })"
  - "src/lib/simulator/engine/combatLoop.ts:2020 applyVanguardEffects 선봉대(ShieldTank) maxHp×ShieldPercent shield + Durability / :3283 applyStargazerEffects 별돌보미"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[stargazer]]"
  - "[[jax]]"
  - "[[leona]]"
---

# 누누와 윌럼프 (Nunu & Willump)

## 요약

4코스트 **별돌보미 (`TFT17_Stargazer`)** + **선봉대 (`TFT17_ShieldTank`)** trait. raw role `APTank`. carry augment 없음.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 ✅).
- **ability "재앙"**: `ShieldDuration`(4)초 `Shield`(scaleAP) 보호막 + 주변에 아스트롤라베 소환 → 2칸 내 적에 `InitialDamage`(scaleAP) 마법 + 전장 끝으로 밀어 `FollowupDamage`(scaleAP) 마법 + 적중 적 `StunDuration` 공중 띄움.

> 🎯 **Nunu 는 고비용 폭발 탱커** — ability 가 2칸 AOE 2타(InitialDamage + FollowupDamage) + 광역 띄움. **단 mana 40/145 (초고비용)** 라 짧은 sim 전투(6~12s)에선 거의 시전 못 함 → calibration -82% 의 지배 요인은 값 모델링이 아닌 **cast 빈도/duration**.

> ⚠️ **set17 entity confirm**: `TFT17_Nunu` apiName 으로 소속 확인 (cost 4, traits 별돌보미/선봉대, role APTank). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 1300 |
| armor / magicResist | 60 / 60 |
| damage | 60 |
| attackSpeed | 0.65 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 40 / 145 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| Nunu | Tank | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` → `includes('Tank')` → Tank ([[role-passive]]) |

### Active — 재앙

raw desc: "`@ShieldDuration@`(4)초 `@ModifiedShield@`(scaleAP) 보호막. 아스트롤라베 소환 → 2칸 내 적 `@ModifiedInitialDamage@`(scaleAP) 마법 + 전장 끝으로 밀어 `@ModifiedFollowupDamage@`(scaleAP) 마법. 적중 적 `@StunDuration@`초 공중 띄움."

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Shield | [0, 475, 575, 2000, ...] | ✅ **반영** — `getAbilityShield`(ability.ts:499, desc "보호막"+변수 'Shield' 매칭) 로 cast 시 자기 보호막 적용 (combatLoop.ts:6780/7542). filler ★1=475/★2=575/★3=2000 (scaleAP) |
| InitialDamage | [0, 120, 180, 2000, ...] | ✅ `damageVar: 'InitialDamage'` filler → ★1=120/★2=180/★3=2000 (scaleAP) |
| FollowupDamage | [0, 100, 150, 2000, ...] | ⚠️ **미반영** (2번째 타격 — secondaryDamageVar 미설정) filler → ★1=100/★2=150/★3=2000 |
| StunDuration | [0, 1.5, 1.75, 8, ...] | ⚠️ hardcoded `stun: 1.75` (★2값) — ★scaling 미반영 (★1=1.5/★3=8 [★3=8s = 극희소 filler]) |
| ShieldDuration | [4, 4, ...] | ⚠️ **부분 미반영** — Shield amount 는 적용, 단 duration 4초 무시 → sim `remainingTicks: 300`(30초) 고정 (combatLoop.ts:6783) |

- sim: `pattern: 'aoe_circle', radius: 2, stun: 1.75, damageVar: 'InitialDamage'`. 2칸 AOE InitialDamage(scaleAP) + 띄움(stun).
- ⚠️ **FollowupDamage(2타) 미반영**: ability 데미지의 약 절반(★2 150/330) 누락. `secondaryDamageVar: 'FollowupDamage'` 는 **per-target loop(분기 b)** 에 합산돼 AOE 전 대상에 동시 추가 → 게임의 "밀린 후 2차 타격(지연+대상 한정)" 메커니즘과 불일치(over-damage 위험). 정확 모델은 별도 helper 필요. **Nunu 가 sim 에서 거의 cast 안 해(아래) 영향 0 → 보류**.

> 🔴 **핵심 sim 한계 — Nunu 는 sim 에서 거의 시전 못 함**: mana 40/145 (max 145 초고비용). Tank 공격당 5 마나 + 피격 마나로 충전하나, sim 전투가 6~12s 로 짧아 **10초 포위전에서도 cast 0회** (mana ~91/145). 실전(20~40s 장기전)에선 1~2회 시전해 ★3 기준 InitialDamage 2000 + FollowupDamage 2000 대형 폭발 → calibration actual 4114 vs sim 755 (**-82%**). **값 모델링 갭이 아닌 cast 빈도/duration systemic 이슈** ([[role-passive]] 마나 + 전투시간).

### Trait — 별돌보미 (Stargazer) / 선봉대 (ShieldTank)

- **별돌보미** (`TFT17_Stargazer*`, bp 3/5/7...): `applyStargazerEffects` (`:3283`) — 강화 칸 별자리(constellation) 효과. 상세 [[stargazer]].
- **선봉대** (`TFT17_ShieldTank`, bp 2/4/6): `applyVanguardEffects` (`:2020`) — 전투 시작 시 maxHp × ShieldPercent 보호막만 적용. ⚠️ **보호막 중 Durability +5%(DamageReductionPct) + HealthThreshold re-shield 미구현** (코드 주석상 별도 PR — spec 만 존재).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1300, armor/MR 60, AD 60, AS 0.65, mana 40/145)
- role Tank (`mapGameRole('APTank')`)
- ability 시전 시: 2칸 AOE InitialDamage(scaleAP) + 띄움(stun 1.75)
- 별돌보미(Stargazer) trait / 선봉대(Vanguard) — 전투 시작 보호막만 (Durability/re-shield 미구현)

⚠️ **미반영** (Lint 후보):
- **P2**: FollowupDamage (2번째 타격) — secondaryDamageVar 미설정 (Nunu cast 없어 영향 0, 보류)
- **P2**: ShieldDuration 미반영 (Shield amount 는 `getAbilityShield` 로 반영됨 — duration 4초→30초 고정 부정확)
- **P2**: StunDuration ★scaling (hardcoded 1.75)
- **P2**: 선봉대(Vanguard) 보호막 중 Durability +5% + HealthThreshold re-shield 미구현 (전투 시작 보호막만)
- 🔴 **systemic**: mana 145 초고비용 → sim 짧은 전투서 cast 거의 없음 → calibration -82% (duration/cast-frequency bound, 값 갭 아님)

## 관련 문서

- [[role-passive]] — Tank role 마나/타게팅 (Nunu cast 빈도 핵심)
- [[stargazer]] — 별돌보미 trait
- [[jax]] / [[leona]] — 동류 탱커 (AOE + CC)
