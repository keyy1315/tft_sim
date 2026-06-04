---
id: illaoi
type: champion
display_name_kr: 일라오이
api_name: TFT17_Illaoi
cost: 3
traits:
  - 동물특공대
  - 선봉대
  - 길잡이
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts:41 includes('Tank')). carry augment 없음 → role 변환 분기 없음
raw_role: APTank
current_patch_status: active
sim_active: partial   # ability "영혼의 시험" 전체 정합 (self_buff Shield generic + NumEnemies 3 true drain heal + 3초 후 2칸 magic AOE AP snapshot, main+OOR cast 2종 대칭) / 선봉대(ShieldTank) 전투 시작 shield 정합. P1 선봉대 Durability +5% DR / HealthThreshold 재발동 미구현 (applyVanguardEffects shield 만, :1913-1914 후속 PR) / P2 길잡이(SummonTrait) 고유 효과 전투 엔진 미반영 (소환체는 빌더 autoSummons 배치 후 일반 CombatUnit 참여, 길잡이 tier별 buff 만 gap) / 동물특공대(AnimaSquad) 경제 trait — 전투 stat 분기 없음 (전투 패배 시 Tech, item 카테고리만)
last_verified: 2026-06-04
sources:
  - "public/data/tft_set17_champions.json (TFT17_Illaoi entry — cost 3, role APTank, traits [동물특공대/선봉대/길잡이], ability '영혼의 시험' variables Shield/Duration/HealthDrain/NumEnemies/Damage)"
  - "public/data/tft_set17_traits.json (TFT17_AnimaSquad=동물특공대 경제 trait / TFT17_ShieldTank=선봉대 전투 시작 shield+Durability / TFT17_SummonTrait=길잡이 비아·바이엔 소환)"
  - "src/types/index.ts:41 (mapGameRole — 'APTank' includes 'Tank' → Tank)"
  - "src/lib/simulator/systems/mana.ts:23 (Tank manaPerAttack 5 / manaPerSecond 0 / manaFromDamage true)"
  - "src/lib/simulator/systems/ability.ts:222 (TFT17_Illaoi: { pattern: 'self_buff' } — Shield generic getAbilityShield + applyIllaoiCast/tickIllaoiAfterShock 헬퍼)"
  - "src/lib/simulator/systems/ability.ts:502 (getAbilityShield Illaoi Shield no-filler [250,450,525] → ★1=250 판정, codex P1 PR #102/104)"
  - "src/lib/simulator/engine/combatLoop.ts:1079-1139 (applyIllaoiCast — NumEnemies(3) 가장 가까운 적 true drain × ap, Illaoi heal=totalDrain×(1+healAmp), AfterShock state 등록 endTick=tick+Duration×TICKS / apSnapshot=stats.ap, drain damage totalAbilityDmg 합산 codex P2 PR #106)"
  - "src/lib/simulator/engine/combatLoop.ts:1150-1208 (tickIllaoiAfterShock — 만료 시 2칸 magic AOE Damage × apSnapshot, per-target amp tank3종+sniper, 사망 cancel state cleanup)"
  - "src/lib/simulator/engine/combatLoop.ts:7088 (main cast) / :7250 (OOR cast) — applyIllaoiCast 양쪽 호출 (cast path 2종 대칭)"
  - "src/lib/simulator/engine/combatLoop.ts:6459 (main) / :7197 (OOR) — getAbilityShield self_buff shield 적용 양쪽"
  - "src/lib/simulator/engine/combatLoop.ts:5568-5573 (tickIllaoiAfterShock 매 tick 호출 — endTick≠0 가드)"
  - "src/lib/simulator/engine/combatLoop.ts:1918 (applyVanguardEffects — 선봉대 전투 시작 maxHp×ShieldPercent shield 10초만 구현. Durability +5% DR / HealthThreshold 50% 재발동은 미구현 — :1913-1914 주석 '후속 PR 분리'. unitHasTrait '선봉대' :1927, 호출 :4694)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[mordekaiser]]"
  - "[[poppy]]"
  - "[[stargazer]]"
---

# 일라오이 (Illaoi)

## 요약

3코스트 **동물특공대 (`TFT17_AnimaSquad`)** + **선봉대 (`TFT17_ShieldTank`)** + **길잡이 (`TFT17_SummonTrait`)** trait. raw role `APTank`.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]]). carry augment 없음 → role 변환 분기 없음.
- **ability "영혼의 시험"**: `self_buff` — ① 보호막(scaleAP) + ② 3초간 가장 가까운 적 3명 체력 흡수(true damage → 본인 heal) + ③ 3초 후 땅 내려찍어 2칸 magic AOE. **delayed AOE 는 cast 시점 AP snapshot** 으로 고정.

> 🎯 **Illaoi 는 "drain-tank + delayed nuke"** — cast 시 즉시 shield/drain/heal 로 생존, 3초 뒤 AfterShock 으로 광역 폭발. [[mordekaiser]] (4초 펄스 + HealRefund) 와 유사한 **state-driven delayed effect** 패턴 (endTick + apSnapshot 필드, 매 tick 만료 체크).

> ⚠️ **set17 entity confirm**: `TFT17_Illaoi` apiName 으로 소속 확인 (cost 3, traits 동물특공대/선봉대/길잡이, role APTank). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 1100 |
| armor / magicResist | 50 / 50 |
| damage | 50 |
| attackSpeed | 0.65 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 40 / 100 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` includes 'Tank' (`types/index.ts:41`), `mana.ts:23` (manaFromDamage true) |

> Tank 라 타게팅 tiebreaker weight 3 (최우선 어그로) + 피격 시 마나 획득 (`manaFromDamage: true`). initialMana 40 / maxMana 100 → 전투 시작 후 비교적 빠르게 첫 cast.

### Active — 영혼의 시험 (`self_buff`)

raw desc: "`@Duration@`(3)초 동안 `@ModifiedShield@`(scaleAP)의 보호막을 얻습니다. 지속시간 동안 가장 가까운 적 `@NumEnemies@`(3)명으로부터 체력을 `@ModifiedHealthDrain@`(scaleAP, trueDamage) 흡수합니다. 이후 땅을 내려찍어 2칸 내 모든 적에게 `@ModifiedDamage@`(scaleAP)의 마법 피해를 입힙니다."

raw variables: `Shield` [250,450,525,650,775,...] / `Duration` [3,...] / `HealthDrain` [40,55,85,130,175,...] / `NumEnemies` [3,...] / `Damage` [80,80,120,180,240,...]

**sim 적용** (`ability.ts:222` `{ pattern: 'self_buff' }` → `applyIllaoiCast` `:1079` + `tickIllaoiAfterShock` `:1150`):

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 보호막 (`Shield`, scaleAP) | ✅ generic | `getAbilityShield(champion, starLevel, ap)` (`:6459` main / `:7197` OOR). no-filler `[250,450,525]` → **★1=250 / ★2=450 / ★3=525** (`ability.ts:502`, codex P1 PR #102/104 shifted indexing fix) |
| 적 3명 체력 흡수 (`HealthDrain`, scaleAP, true) | ✅ | `applyIllaoiCast` — 가장 가까운 alive 적 `NumEnemies`(3)명 (distance ASC lock) 에 `HealthDrain × (1+ap/100)` true damage. **true 도 `applyAbilityMitigation` 통과** (resistance/pen 0, shield/invuln/DR 만 적용, codex P1 PR #106). ★1=40 / ★2=55 / ★3=85 |
| 흡수 → 본인 heal | ✅ | `unit.currentHp += totalDrain × (1 + healAmp)` (mitigated drain 합). maxHp cap (`:1128-1131`) |
| 3초 후 2칸 magic AOE (`Damage`, scaleAP) | ✅ delayed | `tickIllaoiAfterShock` — 만료 (`tick >= endTick`) 시 2칸 내 alive 적 전체 `Damage × AP snapshot` magic. ★1=80 / ★2=80 / ★3=120 (no-filler, ★1=★2 동일은 raw) |
| AP snapshot | ✅ | drain 은 **cast 시점 live ap** (`1+stats.ap/100`), AOE 는 **cast 시점 snapshot** (`illaoiAfterShockApSnapshot`, `:1135`). 3초 사이 ap 변동(item proc 등) 있어도 AOE 는 snapshot 사용 |

> AfterShock 은 state-driven: `applyIllaoiCast` 가 `illaoiAfterShockEndTick = tick + Duration×TICKS` / `illaoiAfterShockApSnapshot = stats.ap` 등록 → 매 tick (`:5569` `endTick≠0` 가드) `tickIllaoiAfterShock` 이 만료 체크. **Illaoi 사망 시 AOE cancel** (`:1163-1167` state cleanup, AOE 미발동).

> self_buff pattern 이라 cast loop 의 `rawAbilityDmgBase = 0` 강제 (Vex/Poppy 동일) — damage 는 cast loop 가 아닌 `applyIllaoiCast`(drain) / `tickIllaoiAfterShock`(AOE) 별도 분기에서 처리. shield 는 `getAbilityShield` generic.

> **drain damage on_cast 정합** (codex P2 PR #106): `applyIllaoiCast` 가 `{ totalDealt, totalRaw }` 반환 → `totalAbilityDmg` / `totalRawAbilityDmg` 합산 (`:7090-7093`). omnivamp / Fountain / on_cast 트리거 정합. (AfterShock AOE 는 tick 함수에서 직접 `totalDamageDealt` 만 누적 — on_cast accumulator 와 별개 타이밍)

### Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Illaoi 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ `applyIllaoiCast` (drain+heal+AfterShock 등록) + `getAbilityShield` (shield) | `:7088` (cast), `:6459` (shield) |
| **OOR (out-of-range dash)** | ✅ **대칭** — `applyIllaoiCast` 동일 호출 (`:7250`) + `getAbilityShield` (`:7197`). Illaoi range 1 melee 라 OOR 진입 빈도 있음 → drain/AfterShock 모두 OOR 에서도 발동 | `:7250` (cast), `:7197` (shield) |
| **recast (onKill)** | ➖ 없음 — onKill recast 는 carry augment (Pyke 등) 전용. Illaoi 는 carry augment 없음 | — |

> AfterShock AOE 발동(`tickIllaoiAfterShock`)은 cast path 와 무관 — main/OOR 어느 쪽으로 cast 했든 `illaoiAfterShockEndTick` state 만 등록되면 매 tick (`:5569`) 만료 체크로 동일하게 발동. self_buff 라 main/OOR drain 비대칭 위험 없음 (Pyke onKill recast 같은 cast-path-dependent 분기 없음).

### Trait — 선봉대 정합 / 동물특공대·길잡이 미반영

| trait | apiName | sim 적용 | 근거 |
|-------|---------|---------|------|
| **선봉대** | `TFT17_ShieldTank` | ⚠️ **부분** | `applyVanguardEffects` (`:1918`) — 전투 시작 시 `maxHp × ShieldPercent` shield (10초) **만 구현**. Spec 의 보호막 활성 중 Durability(`DamageReductionPct`) +5% / HealthThreshold(50% HP) 재발동은 **미구현** (`:1913-1914` 주석 "후속 PR 분리"). `unitHasTrait(u, '선봉대')` (`:1927`), 호출 `:4694`. Illaoi 는 Tank → shield 수령 |
| **동물특공대** | `TFT17_AnimaSquad` | ➖ 전투 분기 없음 | 경제 trait — desc "전투 패배 시 기술(Tech) 획득 + 연패 배수 + 동물특공대 처치 시…". 전투 stat 효과 아님 (`unitHasTrait` 목록 미포함). `trait.ts` emblem 매핑 + `item.ts:134` ItemGrid 카테고리 분기만. **champion 전투 페이지 범위 외** |
| **길잡이** | `TFT17_SummonTrait` | ⚠️ **부분/폴백** | desc "별의 결속 소환 (비아/바이엔)". **전투 엔진** (`src/lib/simulator/`) 에 길잡이 고유 처리 부재 (`TFT17_Summon` sim grep 0, `unitHasTrait` 미포함). 단 빌더 레이어 (`actualData/autoSummons.ts` `syncVoyagerSummon`) 가 소환체를 팀에 자동 배치 → 전투엔 **일반 CombatUnit 으로 참여** (stat 기반). 길잡이 tier별 고유 효과(소환수 강화 등)만 미반영. **Lint P2** |

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1100, armor/MR 50, AD 50, AS 0.65, mana 40/100, range 1)
- role Tank (`mapGameRole('APTank')`) + Tank 마나 규칙 (공격당 5 / 피격 ✅)
- ability "영혼의 시험" **전체 정합**: shield (generic getAbilityShield, ★1=250/★2=450/★3=525) + 3명 true drain (HealthDrain × ap, ★1=40/★2=55/★3=85) + 본인 heal (×healAmp) + 3초 후 2칸 magic AOE (Damage × AP snapshot, ★1=80/★2=80/★3=120)
- AfterShock state-driven (endTick + apSnapshot, 매 tick 만료 체크, 사망 cancel)
- cast path main + OOR 대칭 (drain/shield/AfterShock 양쪽 발동)
- drain damage on_cast accumulator 합산 (omnivamp/Fountain 정합)
- **선봉대 (ShieldTank)** trait — 전투 시작 shield (10초) 정합

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: 선봉대 (ShieldTank) Durability +5% DR / HealthThreshold(50% HP) 재발동 미구현 — `applyVanguardEffects` 는 전투 시작 shield 만 (`:1913-1914` 주석 "후속 PR"). Illaoi 외 mordekaiser/poppy 등 선봉대 보유 챔프 공통
- **P2**: 길잡이 (SummonTrait) 고유 효과 전투 엔진 미반영 — 소환체는 빌더(`autoSummons.ts`)가 팀 배치 후 일반 CombatUnit 으로 전투 참여, 길잡이 trait tier별 고유 buff 만 gap (`TFT17_Summon` sim 엔진 grep 0)
- (informational): 동물특공대 (AnimaSquad) 경제 trait — 전투 stat 분기 없음 (의도된 — 전투 외 경제/Tech 메커니즘, item 카테고리만)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | 선봉대 Durability / HealthThreshold 미구현 | `applyVanguardEffects` 는 전투 시작 shield 만 구현 (`:1928-1933`). Spec 의 보호막 활성 중 Durability +5% DR (`DamageReductionPct`) + (6) +8% / HealthThreshold(50% HP) 재발동 shield 미구현 (`:1913-1914` 주석 "후속 PR 분리") | **P1** | (a) combat-start + (tick 감시) — Durability 는 보호막 보유 중 `damageReduction` 가산 + HealthThreshold 는 매 tick HP% 감시 후 재shield | 선봉대 보유 챔프 공통 (mordekaiser/poppy 등). 별도 trait sim PR 로 일괄 처리 — codex catch (PR illaoi) |
| P2 | 길잡이 summon 고유 효과 미반영 | 빌더 레이어 (`autoSummons.ts` `syncVoyagerSummon`) 가 소환체(비아/바이엔)를 팀 배치 → 전투엔 일반 CombatUnit 으로 참여 (stat 동작). 단 길잡이 trait tier별 고유 효과 (소환수 강화 등) 는 전투 엔진 미처리 (`TFT17_Summon` sim grep 0) | **P2** | (a) combat-start — 길잡이 tier별 소환수 강화 효과 적용. 소환체 배치 자체는 빌더 레이어 기구현 | 소환체 stat 전투 참여는 동작. 길잡이 고유 buff 만 gap. 별도 trait sim PR |
| info | 동물특공대 경제 trait 전투 미반영 | `TFT17_AnimaSquad` 는 전투 패배 시 Tech 획득 (경제) — 전투 내 stat 효과 없음 | info | 해당 없음 (경제/augment 레벨) | 의도된 — champion 전투 페이지 범위 외. 명시만 |

> 📌 **Illaoi 본인 ability 는 full sim 정합**: shield / 3명 true drain / heal / delayed 2칸 AOE (AP snapshot) 모두 코드 ground truth 와 일치. `partial` 사유는 **trait 레벨 gap** — 선봉대 Durability/HealthThreshold 미구현 (P1, 선봉대 보유 챔프 공통) + 길잡이 summon 미구현 (P2, sim 전반 summon 시스템 부재). Illaoi 고유 전투 메커니즘 (영혼의 시험) 자체의 gap 은 아님.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Illaoi` apiName 확인 (cost 3, traits [동물특공대/선봉대/길잡이], role APTank)
- [x] entity-wide grep `Illaoi` + `일라오이` + `AfterShock` — sim site (applyIllaoiCast / tickIllaoiAfterShock / state 필드 / cast 호출 main+OOR)
- [x] raw stats 17.4 정합 (hp 1100 / armor·MR 50 / AD 50 / AS 0.65 / mana 40·100 / range 1)
- [x] **raw role `APTank` → mapGameRole → Tank** — `includes('Tank')` (`types/index.ts:41`). carry augment 없음 → 변환 없음
- [x] **함수 컨텍스트 read (2단계)** — `applyIllaoiCast` 전체 (drain lock + true mitigation + heal + AfterShock 등록 + on_cast 반환) + `tickIllaoiAfterShock` 전체 (만료/사망 cancel/AOE/cleanup) + 호출 site (`:5569` 가드, `:7088`/`:7250` cast)
- [x] **변수 filler 판정** — Shield `[250,450,525]` no-filler ★1=250 (`ability.ts:502` 주석) / HealthDrain `[40,55,85]` no-filler ★1=40 / Damage `[80,80,120]` no-filler ★1=80 (★1=★2 raw) / Duration·NumEnemies 상수 3
- [x] **actual sim integration verify (5단계)** — shield `getAbilityShield` (`:6459`/`:7197`) / drain `applyIllaoiCast` HealthDrain read / AOE `tickIllaoiAfterShock` Damage read 모두 main pipeline read 확인. AP snapshot (drain=live ap / AOE=snapshot) 분리 확인
- [x] **cast path 3종 (PR #129 룰)** — main (`:7088` ✅) / OOR (`:7250` ✅ 대칭) / recast (carry 없음 ➖). self_buff 라 main/OOR drain 비대칭 위험 없음 명시
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 선봉대 `applyVanguardEffects`(`:1918`, `unitHasTrait '선봉대'`) ⚠️ **함수 본문 read 결과 shield 만 구현, Durability/HealthThreshold 미구현** (`:1913-1914` 주석 — 함수 주석 Spec 만 보고 구현 단정 금지, codex P1 catch) / 동물특공대 `TFT17_AnimaSquad` 경제 trait 전투 분기 없음 (`unitHasTrait` 목록 미포함, item 카테고리만) / 길잡이 `TFT17_SummonTrait` summon grep 0 → 미구현 (P2). 각 trait apiName grep + helper 본문 read 로 실제 구현 범위 확인
- [x] **본문 Lint P1 1건 + P2 1건 + info 1건 등록 → frontmatter `sim_active: partial` 강등** (룰 #15) — Illaoi 본인 ability 는 full, partial 사유는 trait 레벨 gap (선봉대 Durability P1 / 길잡이 summon P2)
- [ ] (선택) 길잡이 summon unit 시스템 도입 여부 (sim 전반 summon 미지원 — 별도 대규모 plan)

## 관련

- [[role-passive]] — Tank role 마나·타게팅 규칙 (공격당 5 / 피격 ✅ / weight 3)
- [[ability-targeting]] — `self_buff` 패턴 + cast path 2종 대칭 (main/OOR drain·AfterShock 일관). Illaoi 는 state-driven delayed AOE
- [[mordekaiser]] — 동일 state-driven delayed effect 패턴 (Morde 4초 펄스+HealRefund vs Illaoi 3초 후 AfterShock AOE, 둘 다 endTick 필드 + 매 tick 만료 체크 + 사망 cancel)
- [[poppy]] — 동일 self_buff shield 패턴 (getAbilityShield generic, rawAbilityDmgBase=0 강제)
- [[stargazer]] — 별돌보미 trait (Illaoi 무관, drain heal vs Fountain heal 비교용)
- 코드: `src/lib/simulator/systems/ability.ts:222/502`, `src/lib/simulator/engine/combatLoop.ts:1079/1150/1918/5569/7088/7250`, `src/types/index.ts:41`, `src/lib/simulator/systems/mana.ts:23`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Illaoi), `public/data/tft_set17_traits.json` (TFT17_AnimaSquad / TFT17_ShieldTank / TFT17_SummonTrait)
