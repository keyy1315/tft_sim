---
id: patch-17-6
type: patch
live_date: 2026-06-24
status: LIVE
last_verified: 2026-06-26 (17.6 공식 패치노트 ingest. **raw data + sim 코드 = 17.4 partial 기준 (17.5/17.5b/17.6 미반영)** — 데이터 17.6 갱신 작업 예정. ⚠️ calibration 게임은 17.1/17.3 이라 raw 갱신 시 신규 게임으로 baseline 재기준 필요)
sources:
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-6/ (공식)
  - https://esports.gg/news/teamfight-tactics/tft-patch-17-6-notes-gnar-and-meeple-nerfs-loot-singularity-cashout-rework/ (esports.gg)
  - public/data/tft_set17_champions.json (meta.patch_version "17.4 LIVE (partial — sequence B 1차)" — 17.5/17.5b/17.6 미반영)
  - public/data/tft_set17_traits.json / tft_set17_items.json / tft_set17_augments.json (17.3~17.4 partial — 17.5/17.5b/17.6 미반영)
related:
  - "[[patch-17-5]]"
  - "[[patch-17-4]]"
  - "[[twistedfate]]"
  - "[[viktor]]"
  - "[[mordekaiser]]"
  - "[[gnar]]"
  - "[[gragas]]"
  - "[[karma]]"
  - "[[leblanc]]"
  - "[[morgana]]"
  - "[[masteryi]]"
  - "[[nami]]"
  - "[[aurelionsol]]"
  - "[[lulu]]"
  - "[[shen]]"
---

# Patch 17.6 (2026-06-24 LIVE)

> Set 17 Space Gods 의 6번째 메이저 패치. 메타가 안정적이라 큰 변화는 자제(지역 토너먼트 직전)한 **소규모 패치 + 대규모 augment 패스**가 핵심. 저활용 챔프 다수 버프(Twisted Fate/Viktor/Mordekaiser/Karma/LeBlanc/Morgana/Shen) + Gnar 리롤 견제(Gnar AD / Meeple(7) 너프) + augment "lobby shape 의존도 완화" 방향 재조정. **3주 패치**(17.7 = 2026-07-15, Riot 휴식 주). Pengu's Party 업데이트 + Space Gods augment 패스 동반.
>
> 본 페이지는 **17.6 변경을 fact 로 기록**하되, 작성 시점 **raw data + sim 코드는 여전히 17.4 partial 기준 (17.5/17.5b/17.6 미반영)** 임을 명시. (데이터 17.6 갱신은 후속 작업 — 아래 박스)

## ⚠️ sim / 데이터 적용 상태 — 미반영 + calibration 재기준 필요

| Asset | 17.6 적용 상태 | 비고 |
|-------|---------------|------|
| **raw data** (`public/data/tft_set17_*.json`) | ❌ **미반영** (`meta.patch_version` = "17.4 LIVE (partial — sequence B 1차)") | 17.5/17.5b 도 미반영 — 17.6 갱신 시 누적 delta(17.4→17.6) 적용 필요 |
| **sim 코드** (`combatLoop.ts` / `ability.ts` / `carryAugments.ts`) | ❌ 17.6 수치 미반영 | raw json 갱신 시 자동 반영 항목 다수(스탯/damageVar). carry augment(Heat Death=`MordekaiserCarry` / Self-Destruct=`GragasCarry`)는 `carryAugments.ts` hardcoded — 수동 수정. ※ **Blood Offering 은 carry 아닌 일반 augment** (carryAugments.ts/augments.json 부재 — 17.4 data 미수록, 신규 여부 확인 필요) |
| **champion 위키 페이지** | ⚠️ **17.4 stats 기준** — 17.6 변경 챔프(아래 표)는 페이지 stats 가 live 와 불일치 | 페이지는 데이터(17.4)와 정합. live(17.6)와는 본 패치 페이지가 delta source |

### 🎯 calibration 재기준 핵심 (raw data 17.6 갱신 시)

- **calibration 게임 = 과거 리플레이, 17.1/17.3 패치**: `game-20260423-001`/`game-20260424-001` = **patch 17.1**, `game-20260519-001` = **patch 17.3**.
- 현재 raw data(17.4)는 이미 calibration 게임보다 앞서 있고, 17.6 으로 올리면 격차가 더 벌어짐 → **기존 17.1/17.3 게임의 under-damage calibration(user-local 메모리 `project_underdamage_calibration`) baseline 은 17.6 데이터로는 무효**.
- → 17.6 raw 갱신을 진행하려면 **17.6 환경 신규 게임을 calibration 기준으로 함께 도입**해야 정합 유지. (이번 작업 방침: wiki 먼저 → raw 데이터 17.6 갱신 → calibration 재기준 논의)

## CHAMPION 변경 (17.5 → 17.6)

> ★ 표기 = 코스트별/스타별 스탯 배열. 패치노트 "before" = 17.5 값. 우리 데이터(17.4)는 **17.5+17.6 누적 미반영** — 누적 delta 는 [[patch-17-5]] 표와 본 표를 합산.

### Tier 1
| 챔프 | 항목 | 17.5 → 17.6 |
|------|------|-------------|
| [[twistedfate]] | Min Ability Damage AP | 190/285/430/730 → **205/305/460/800** (buff) |
| [[twistedfate]] | Max Ability Damage AP | 380/570/860/1460 → **410/610/920/1565** (buff) |

### Tier 2
| 챔프 | 항목 | 17.5 → 17.6 |
|------|------|-------------|
| [[gnar]] | Base AD | 50 → **48** (nerf — 리롤 견제) |
| [[mordekaiser]] | Initial Shield | 350/425/550 → **350/450/625** (buff) |
| [[mordekaiser]] | Shield Channel | 75/90/105 → **75/100/115** (buff) |

### Tier 3
| 챔프 | 항목 | 17.5 → 17.6 |
|------|------|-------------|
| [[viktor]] | Ability Damage | 190/290/500 → **200/300/530** (buff) |
| [[lulu]] | Altar Spell Damage AP | 150/225/375 → **160/240/400** (buff) |
| [[lulu]] | Serpent Spell Damage AP | 140/210/335 → **150/225/360** (buff) |

### Tier 4
| 챔프 | 항목 | 17.5 → 17.6 |
|------|------|-------------|
| [[aurelionsol]] | Non-Mech Spell Damage AP | 320/480 → **335/505** (buff) |
| [[karma]] | Split Damage AP | 570/855 → **630/945** (buff) |
| [[leblanc]] | Passive Damage AP | 62/93 → **66/99** (buff) |
| [[leblanc]] | Sigil Damage AP | 85/130 → **95/145** (buff) |
| [[morgana]] | Health Gain AP | 525/625 → **600/700** (buff) |
| [[morgana]] | Ally Heal AP | 100/150 → **125/185** (buff) |
| [[masteryi]] | Spell Damage AD | 50/75 → **55/85** (buff) |
| [[nami]] | Primary Spell Damage AP | 440/660 → **460/690** (buff) |
| [[nami]] | Secondary Spell Damage AP | 110/165 → **125/185** (buff) |

### Tier 5
| 챔프 | 항목 | 17.5 → 17.6 |
|------|------|-------------|
| [[shen]] | Attack Speed bonus | Shen 본인 버프 시 **비감쇠** (아군은 기존대로 감쇠) (buff) |

> ⚠️ **17.4 데이터 누적 갭 주의**: [[mordekaiser]](17.5 에서 Initial Shield 300→350 buff, 17.6 에서 다시 +Channel 버프 — 데이터 300 기준이라 2패치 누락) / [[twistedfate]]([[patch-17-5]] 미기재 — 17.6 before 190/285 가 곧 17.5 값, 데이터 180/270 은 17.5+17.6 누락) / [[leblanc]](17.5 Sigil 80/120→85/130 + 17.6 85/130→95/145 연속 buff) / [[karma]]/[[morgana]]/[[viktor]] 모두 누적 delta 존재. raw 17.6 갱신 시 **17.4→17.6 최종값** 으로 직접 세팅.

## TRAIT 변경 (17.6)

- **미플(Meeple) (7)**: Gold per 2-cost Cloned 5 → **3** (nerf — Gnar 리롤 동반 견제)
- **결투가(Arbiter) Input — Rerolled Last Turn**: Attack Speed 35/55%→**40/65%** / Resists 45/70→**55/80** / Shield 44/66%→**48/70%** / Gold 30%→**35%** (buff)
- **결투가(Arbiter) Output**: Combat Start Shield Duration 8s → **10s** (buff)
- **기갑(Mecha)**: AD/AP 25/45/35% → **25/40/40%** (조정)
- **N.O.V.A (5) 보너스**: Caitlyn Headshot 40%→**50%** / Akali Damage 12/18/24/30%→**15/22/28/34%** AD / Kindred Damage Amp 10%→**15%** (buff)
- **양치기(Shepherd) (5)**: Tail Sweep 200→**230** AP / Health Multiplier(Stage4-6) 6.5/7.25/8.5x→**6.75/7.8/9.5x** (buff)
- **양치기(Shepherd) (7)**: Shield 430→**460** AP / Tail Sweep 200→**275** AP / Health Multiplier 6.5/7.45/9.5x→**6.75/8/10x** (buff)
- **애니마 군단(Anima Squad) (6)**: 15g 캐시아웃 제거 / 3x 4코 캐시아웃 제거 / 2x Lesser Duplicator → 2x + 5g / Component/Emblem 리워드 확률 상향 (캐시아웃 개편)

## ITEM 변경 (17.6)

- 공식 패치노트에 **별도 아이템 밸런스 섹션 없음** (이번 패치는 augment 위주). items.json 직접 영향 없음.

## AUGMENT 변경 (17.6) — 대규모 패스

> 이번 패치 핵심. "augment 를 lobby shape/build 의존도 낮게 일반화" 방향. **carry augment(`carryAugments.ts`)** 영향 항목은 ⚑ 표기.

### sim 영향 큰 항목 (carry / combat)
- **Blood Offering** (일반 augment — carry 아님, carryAugments.ts/augments.json 부재): HP Loss 20%→**15%** max HP / Shield 30%→**20%** max HP / Stats 10% AD → **12% AP + AD** (AP 덱도 채용 가능하게 일반화)
- ⚑ **Heat Death ([[mordekaiser]], `MordekaiserCarry`)**: Active Ability Damage AP 50/75/115 → **55/82/140** (buff)
- ⚑ **Self-Destruct ([[gragas]], `GragasCarry`)**: Ability Damage AP 250/375/600 → **225/335/550** (nerf — 과열 조정). ※ [[gnar]] 는 별개로 Base AD 너프(위 Tier 2) — Self-Destruct 귀속 아님
- **Contract Killer (Pyke)**: Bonus Tank Damage 60% → **75%** (buff)
- **High Voltage**: Bonus Damage 20% → **25%** (buff)
- **Best Friends I/II**: 이제 **Magic Resist 도 부여**(기존 Armor 만) / Armor·MR 13/22 → **9/14**
- **Bodyguard Training**: Base Resists 10 → **15**
- **Forged in Strength**: Health Threshold 35 → **30**
- **Two Tanky**: Health 450 → **375** / Shield 40% → **35%** (nerf, 17.5b 450 에서 추가 너프)
- **Timestream**: 전 아군 +100 Health 추가 / AS Per Reroll 0.25% → **0.3%**
- **Deadlier Caps**: Rabadon Deathcap 당 +1 Mana Regen 추가
- **Recombobulator**: 무료 리롤 3회 추가

### 경제 / 유틸 augment (대표)
- **Expedition**: Gold 20→**15** + **1인 상호배제**(nerf)
- **Birthday Reunion**: 초기 3골드 / 2-star 2코는 Level 5 에서 지급 (nerf)
- **Restart Mission**: Expedition/Clear Mind/AFK 와 상호배제 / 2-star 2코 3→**2** (open-fort 시너지 차단)
- **Forward Thinking**: Rounds 5→**6** / Gold 70→**62**
- **Late Game Specialist**: Level Up 과 상호배제 해제 / Gold 30→**27**
- **Going Long** 13→**16**g / **Golden Gamble** 1→**2**g (+ 2→**3**g) / **Treasure Hunt** 16→**18**g/chest (5번째 = Artifact Anvil + 4g 고정) / **ReinFOURcement** 5→**7**g / **Urf's Gambit** 6→**3**g / **Wise Spending** 3→**1**g / **Pilfer** 21→**19**g
- **Band of Thieves II**: Turn Delay 8→**6** (Plus 6→**5**) / **Build-a-Bud** 8→**10**g / **Living Forge** 8→**9** rounds / **Shimmerscale Essence** 6→**7** rounds / **Lucky Gloves** 2-1 버전 +4골드 / **Early Learnings** 초기 AD/AP 8→**5**
- **Retribution**: 구버전 제거·신버전 교체 (Bonus Crit Chance 15%→**25%**)
- **Critical Success**: **비활성화(disabled)**

## PENGU'S PARTY / SPACE GODS (17.6)

> Pengu's Party 업데이트 + Space Gods augment 패스(returning trait 밸런스).

- **Nitro**: R-0B0T/T-H3X Bonus HP — Stage3 100→**150** / Stage4 300→**380** / T-H3X Laser 580→**610** AP
- **The Crew**: Base Rocket 95→**105** / Upgraded 120→**130**
- **Honeymancy**: Bronze 12→**10** / Prismatic 25→**21** (bee 당 damage, nerf)
- **Demacia**: Mana Reduction/rally 8%→**7%** / Bronze Armor·MR 15→**12** / Prismatic 20→**15** / Galio Ally Shield 400/550/2000%→**360/500/2000%** AP (nerf)
- **Overlord**: Prismatic AD/AP 35→**40** / **Mountain**: Prismatic 영구 HP/round 60→**70** / **Pyro**: AS per 5 Cinders 2.0%→**2.25%** / **Coven**: Prismatic Mana to Give 8→**10**
- **Storyweaver Kayle**: Active AP 125/250/390/730 → **125/250/390/700** / Passive 15/35/45/85 → **15/35/45/80** (★4 소폭 nerf)

## sim 통합 상태 — 미반영 (17.4 partial 기준)

- raw data / sim 코드 모두 17.5/17.5b/17.6 미반영. **17.6 raw 갱신 작업 예정** (이번 작업 방침: wiki 먼저 → raw 데이터 → calibration 재기준).
- 17.6 변경 챔프 위키 페이지(stats 표)는 현재 17.4 데이터와 정합 — live delta 는 본 패치 페이지 + [[patch-17-5]] 가 single source. raw 17.6 갱신 완료 후 개별 챔프 페이지 stats/patch-history 동기화 필요.
- raw json 갱신 시: ① 변경 필드만 부분 Edit(사용자 raw-data 규칙) ② carry augment 는 `carryAugments.ts` 수동 ③ 17.6 신규 게임으로 calibration 재기준.

## 관련 문서

- [[patch-17-5]] — 직전 패치 (econ augment 너프 + 저활용 챔프 버프 + 17.5b hotfix). 17.4→17.5 delta source
- [[patch-17-4]] — Arbiter 대규모 개편 + Sniper/Psionic 일관성
- [[twistedfate]] / [[viktor]] / [[mordekaiser]] / [[karma]] / [[leblanc]] / [[morgana]] — 17.6 버프 챔프 (데이터 17.4 기준, live delta 는 본 페이지)
