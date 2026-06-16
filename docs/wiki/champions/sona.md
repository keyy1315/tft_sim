---
id: sona
type: champion
display_name_kr: 소나
api_name: TFT17_Sona
cost: 5
traits:
  - 지휘관
  - 초능력
  - 길잡이
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active   # 17.4/17.5 변경 없음 (patch-17-4/17-5 champion list 미포함)
last_verified: 2026-06-16
sim_active: partial   # ability 「초능력 분쇄」 자성 파편 가장 가까운 단일 대상에 DebrisDamage(scaleAP) 부착 + 사망 시 파편 이전 + NumCasts(5)회마다 모든 파편 뜯어내 DebrisRipDamage + 내리꽂아 SlamDamage(scaleAP) + 기절(StunDuration 1). sim multi maxTargets:3 + secondaryDamageVar 'SlamDamage'. auto-detect 주 damageVar 'DebrisDamage'(fuzzy) no-filler(v0=v1) → ★1=300/★2=300/★3=450. SlamDamage sentinel filler(v0=2.5 ratio>5) → ★1=720/★2=1100/★3=9999(게임 scaleAP, sim raw 가산). 초능력(PsyOps Radiant swap :2325/:2344)/길잡이(SummonTrait 소환물 materialize) trait. 지휘관(SonaUniqueTrait)=지휘 모드 아이템(item.ts:114) 경로. ⚠️ over-model: DebrisDamage 단일 대상인데 multi 3 over-target + SlamDamage 5회 cadence 무시(매 캐스트) + DebrisRipDamage/stun/파편 이전 미반영. calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Sona entry — cost 5, role APCaster, traits [지휘관/초능력/길잡이], hp 900, armor/MR 40/40, AD 35, AS 0.9, range 4, mana 0/25, ability '초능력 분쇄' variables DebrisDamage/SlamDamage/NumCasts/DebrisRipDamage/StunDuration)"
  - "public/data/tft_set17_traits.json (TFT17_SonaUniqueTrait = 지휘관 bp 1 / TFT17_PsyOps = 초능력 bp 2/4 / TFT17_SummonTrait = 길잡이 bp 3/5/7)"
  - "src/lib/simulator/systems/ability.ts:275 (TFT17_Sona: { pattern: 'multi', maxTargets: 3, secondaryDamageVar: 'SlamDamage' } — auto-detect 주 damageVar 'DebrisDamage')"
  - "src/lib/simulator/engine/combatLoop.ts:6895 secondaryDamageVar 가산 / :2325 isPsyOpsTier4Active / :2344 applyPsyOpsRadiantSwap 초능력 / src/lib/simulator/systems/item.ts:114 TFT17_SonaUnique_ 지휘 모드 아이템(지휘관)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[viktor]]"
  - "[[lissandra]]"
  - "[[fizz]]"
---

# 소나 (Sona)

## 요약

5코스트 **지휘관 (`TFT17_SonaUniqueTrait`)** + **초능력 (`TFT17_PsyOps`)** + **길잡이 (`TFT17_SummonTrait`)** trait. raw role `APCaster`. carry augment 없음.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]] — 공격당 7 / 초당 2 / 피격 ❌). hp 900, range 4, mana 0/25 (매우 빠른 시전).
- **ability "초능력 분쇄"**: 자성 파편 없는 **가장 가까운 단일 대상**에 파편 부착 → `DebrisDamage`(scaleAP). 파편 부착 적 사망 시 가장 가까운 적에게 파편 이전. `NumCasts`(5)회마다 모든 파편을 뜯어내 `DebrisRipDamage`(scaleAP) + 모든 파편을 대상에 내리꽂아 `SlamDamage`(scaleAP) + `StunDuration`(1초) 기절.

> 🎯 **Sona 는 파편 스택 + 5회째 폭발 캐스터** — 매 캐스트 단일 DebrisDamage + 5회째 SlamDamage 대폭발. ⚠️ sim 은 DebrisDamage 를 multi 3 으로 over-target + SlamDamage 를 secondaryDamageVar 로 **매 캐스트** 적용(5회 cadence 무시, [[fizz]] 동형) + DebrisRip/stun/파편 이전 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Sona` apiName 으로 소속 확인 (cost 5, traits 지휘관/초능력/길잡이, role APCaster). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE — 17.4 변경 없음)

| Stat | 값 |
|------|---|
| hp | 900 |
| armor / magicResist | 40 / 40 |
| damage | 35 |
| attackSpeed | 0.9 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 25 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]]) |

### Active — 초능력 분쇄 (파편 스택 + 5회째 폭발)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| DebrisDamage | [300, 300, 450, 999, 999, ...] | ⚠️ auto-detect 주 `damageVar 'DebrisDamage'`(fuzzy) no-filler(v0=v1) → ★1=300/★2=300/★3=450 (scaleAP). 단 **단일 대상인데 multi 3 over-target**(아래) |
| SlamDamage | [2.5, 720, 1100, 9999, 9999, ...] | ⚠️ `secondaryDamageVar 'SlamDamage'` sentinel filler(v0=2.5, ratio>5) → ★1=720/★2=1100/★3=9999. **게임 scaleAP 이나 sim 은 raw 가산**(`baseDmg += readVarByStar`, AP 미적용 — secondaryDamageVar 공통). **5회 cadence 무시, 매 캐스트 적용**(아래) |
| DebrisRipDamage | [160, 120, 180, 999, 2000, ...] | ⚠️ **미반영** — 5회째 파편 뜯기 피해. filler → ★1=120/★2=180/★3=999 |
| NumCasts | [5, ...] | ⚠️ **미반영** — 5회마다 폭발 cadence |
| StunDuration | [1, ...] | ⚠️ **미반영** — 5회째 기절 (config stun 없음) |

- sim: `pattern: 'multi', maxTargets: 3, secondaryDamageVar: 'SlamDamage'`. 3타겟 `DebrisDamage` + `SlamDamage`.
- ⚠️ **over-target**: 실제 파편은 **가장 가까운 단일 대상**에 부착되나 sim multi maxTargets 3 으로 3명에 적용 → 과대(스택/이전 메커니즘 미모델).
- ⚠️ **SlamDamage 5회 cadence 무시**: 실제 SlamDamage(+DebrisRip+stun)는 `NumCasts`(5)회마다 1회인데 sim secondaryDamageVar 로 매 캐스트 적용([[fizz]] 동형 over-model) + 게임 scaleAP 인데 sim raw 가산(AP 미적용, secondaryDamageVar 공통). DebrisRipDamage·stun·파편 이전 미반영.

### Trait — 지휘관 (SonaUniqueTrait) / 초능력 (PsyOps) / 길잡이 (SummonTrait)

- **지휘관** (`TFT17_SonaUniqueTrait`, bp 1): unique trait. sim 효과는 **지휘 모드 아이템**(`TFT17_SonaUnique_*`) 경로(`item.ts:114`)로 처리 — 별도 combatLoop trait helper 없음(grep 전수 확인).
- **초능력** (`TFT17_PsyOps`, bp 2/4): (4) tier 활성(`isPsyOpsTier4Active` `:2325`) 시 `applyPsyOpsRadiantSwap`(`:2344`) — 초능력 unit 의 PsyOps 아이템 → Radiant 변종 swap.
- **길잡이** (`TFT17_SummonTrait`, bp 3/5/7): 소환물(`TFT17_Summon`)은 `useTeamManagement.syncVoyagerSummonInTeam` 로 전투 전 materialize. ⚠️ 길잡이 tier별 전투 버프는 sim helper 없음 미반영 ([[lissandra]] 동일).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 900, armor/MR 40, AD 35, AS 0.9, range 4, mana 0/25)
- role Caster (`mapGameRole('APCaster')`)
- 주 `DebrisDamage`(scaleAP) + `SlamDamage`(secondaryDamageVar)
- 초능력(PsyOps Radiant swap) trait / 길잡이 소환물 materialize / 지휘관(지휘 모드 아이템 경로)

⚠️ **미반영 / over-model** (Lint 후보):
- **P2 (over-target)**: DebrisDamage 단일 대상인데 multi maxTargets 3 으로 3명 적용 — 파편 스택/이전 메커니즘 미모델
- **P2 (cadence)**: SlamDamage 5회마다(`NumCasts`)인데 secondaryDamageVar 로 매 캐스트 적용([[fizz]] 동형) + DebrisRipDamage·stun(`StunDuration`)·파편 이전 미반영
- **P2**: 길잡이 tier별 전투 버프 미반영 (소환물 materialize 는 됨, [[lissandra]] 동일)
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Caster role 마나/타게팅
- [[viktor]] — 동류 초능력(PsyOps)
- [[fizz]] — N회 cadence + secondaryDamageVar over-model 공통
- [[lissandra]] — 동류 길잡이 (소환물 materialize)
