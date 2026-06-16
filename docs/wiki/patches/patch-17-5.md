---
id: patch-17-5
type: patch
live_date: 2026-06-10
status: LIVE
last_verified: 2026-06-16 (17.5 + 17.5b mid-patch 공식/2차 소스 ingest. **raw data + sim 코드 = 17.4 partial 기준 (17.5/17.5b 미반영)**. ⚠️ calibration 게임은 17.1/17.3 이라 17.5b raw 갱신은 calibration 정렬을 오히려 악화 — 데이터 갱신 신중)
sources:
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-5/ (공식)
  - https://www.gamer.org/tft-patch-17-5-changes-every-buff-nerf-and-meta-shift-explained/ (gamer.org)
  - https://esports.gg/news/teamfight-tactics/tft-patch-17-5-notes-space-groove-and-ornn-nerfs/ (esports.gg)
  - public/data/tft_set17_champions.json (meta.patch_version "17.4 LIVE (partial — sequence B 1차)" — 17.5/17.5b 미반영)
  - public/data/tft_set17_traits.json / tft_set17_items.json / tft_set17_augments.json (17.3~17.4 partial — 17.5/17.5b 미반영)
related:
  - "[[patch-17-4]]"
  - "[[patch-17-3]]"
  - "[[bard]]"
  - "[[veigar]]"
  - "[[caitlyn]]"
  - "[[ezreal]]"
  - "[[rammus]]"
  - "[[mordekaiser]]"
  - "[[samira]]"
---

# Patch 17.5 + 17.5b (2026-06-10 LIVE)

> Set 17 Space Gods 의 5번째 메이저 패치 (+ 같은 날 17.5b mid-patch hotfix). 경제 augment 과열 억제(econ aug 너프 / combat aug 버프) + 저활용 챔프 다수 버프(Bard/Veigar/Fizz/Caitlyn/Mordekaiser) + Meeple/Rammus 너프. 본 페이지는 **17.5 + 17.5b 변경을 fact 로 기록**하되, **raw data + sim 코드는 17.4 partial 기준 (17.5/17.5b 미반영)** 임을 명시.

## ⚠️ sim / 데이터 적용 상태 — 미반영 + calibration 정렬 주의

| Asset | 17.5/17.5b 적용 상태 | 비고 |
|-------|---------------------|------|
| **raw data** (`public/data/tft_set17_*.json`) | ❌ **미반영** (`meta.patch_version` = "17.4 LIVE (partial — sequence B 1차)") | 17.4 자체도 partial (Zed/Shen/Jax 만 17.4, 나머지 17.3 기준) |
| **sim 코드** (`combatLoop.ts` / `ability.ts`) | ❌ 17.5/17.5b 수치 미반영 | raw json 갱신 시 자동 반영되는 항목 다수(스탯/damageVar) |
| **champion 위키 페이지** | ⚠️ **17.4 stats 기준** — 17.5/17.5b 변경 챔프(아래 표)는 페이지 stats 가 live 와 불일치 | 페이지는 데이터(17.4)와 정합. live(17.5b)와는 본 패치 페이지가 delta source |

### 🎯 calibration 정렬 핵심 (raw data 갱신 신중)

- **calibration 게임 = 과거 리플레이, 17.1/17.3 패치**: `game-20260423-001`/`game-20260424-001` = **patch 17.1**, `game-20260519-001` = **patch 17.3** (raw game json `patch` 필드).
- 즉 현재 raw data(17.4)는 **이미 calibration 게임보다 앞서 있음**. 17.5b 로 갱신하면 sim 이 게임 당시 밸런스에서 더 멀어져 **calibration 정렬이 오히려 악화**.
- → **17.5/17.5b raw 갱신은 calibration 목적이 아님**. live 17.5b 환경 시뮬레이션(신규 게임 분석)이 필요할 때만 별도 의사결정. 본 패치 페이지는 그때를 위한 delta 기록.

## CHAMPION 변경 (17.5)

> ★ 표기 = 코스트별 스탯 배열. 우리 데이터(17.4) 대비 delta.

### Tier 1
| 챔프 | 항목 | 17.4(데이터) → 17.5 |
|------|------|---------------------|
| [[caitlyn]] | Headshot AD | 170/255/510/875 → **190/285/540/925** (buff) |
| [[ezreal]] | Ability AD | 160/240/365/620 → **170/255/380/650** (buff) |
| Nasus | Flat Health gained | 250/350/550/750 → **300/400/600/800** (buff) |
| [[teemo]] | Spell Damage | 65/95/170/300 → **70/105/190/325** (buff) |
| Veigar | Spell Damage AP | 310/465/700/1190 → **330/495/750/1200** (buff) |

### Tier 2
| 챔프 | 항목 | 17.4 → 17.5 |
|------|------|-------------|
| [[akali]] | Spell Damage AD | 37/56/84 → **39/59/88** (buff) |
| Bel'Veth | Spell Damage AD | 20/30/45 → **22/33/50** (buff) |
| Gwen | Attack Speed / AoE AP | 0.85→**0.8** / 75/110/190 → **75/110/215** (★3 buff) |
| [[mordekaiser]] | Initial Shield | 300/375/500 → **350/425/550** (buff) |

### Tier 3
| 챔프 | 항목 | 17.4 → 17.5 |
|------|------|-------------|
| Fizz | Dash Damage AP | 120/180/290 → **140/210/310** (buff) |
| Ornn | Groove Duration | 3s → **2.5s** (nerf) |

### Tier 4
| 챔프 | 항목 | 17.4 → 17.5 |
|------|------|-------------|
| [[kindred]] | Base AD | 55 → **58** (buff) |
| LeBlanc | Sigil Damage | 80/120 → **85/130** (buff) |
| [[rammus]] | Meeple bonus DR per Meep / Mana | 4 → **3** (nerf) / 20/90 → **20/80** (buff) |

### Tier 5
| 챔프 | 항목 | 17.4 → 17.5 |
|------|------|-------------|
| [[bard]] | Spell Damage | 220/330 → **240/360** (buff) |
| [[vex]] | Spell Damage AP | 130/195 → **140/210** (buff) |

> ⚠️ **이번 세션 sim-fix 와 직접 충돌하는 챔프**: [[bard]](220/330→240/360 — perSecond #241 은 구조 fix 라 수치만 stale) / [[ezreal]](#251 ingest 한 ADDamage 160/240/365 가 stale) / [[rammus]](#237 ingest 한 Meeple DR/mana stale) / [[caitlyn]]/[[teemo]]/[[akali]]/[[mordekaiser]]/[[vex]]. 모두 **17.4 데이터 기준이라 페이지는 데이터와 정합** — live 갱신 시 본 표 참조.

## TRAIT 변경 (17.5)

- **결투가(Arbiter)**: 3평타당 Leona 8/12%→**5/8%** / Armor 12/18→**10/16** / 50마나당 Leona 10/15%→**9/12%** (nerf)
- **미플(Meeple)**: Flat HP 100/400/400/500 → **100/350/450/550** / (10) Meeplord — Big Slam 1100→**1500** AP / AoE Slam 700→**1000** AP / Stun 1.5s→**3s** / Stun Damage 150→**400** AP
- **별돌보미(Stargazer)/뱀(Serpent) Poison**: 20/40/60% → **18/35/50%** (17.5 nerf) → **17.5b 에서 25/45/60% 로 상향 조정** (아래 17.5b)
- **양치기(Shepherd)**: Summon AP per Cast 20→**15** / Shield 125/300/300→**100/275/430** (17.5b 추가 조정)
- **우주 그루브(Space Groove)**: Health Regen per Groovian 0.95%→**0.85%** / (7) Bonus 15%→**10%** (17.5b)

## ITEM 변경 (17.5)

- **Artifact**: The Collector AD 40%→**35%** / Mogul's Mail HP/stack 8→**5**
- **Radiant**: Deathblade AD 110%→**100%** / Protector's Vow Shield 40%→**50%** / Morellonomicon AP 40→**35** / Quicksilver AS 30%→**40%** / Rabadon AP 110%→**100%** / Rageblade AS 20%→**25%** / Red Buff AS 90%→**80%**
- **Anima (1~3티어)**: Guiding Hex(Aurora AP) 9→**12** / Rocket Barrage(AD 10%→**15%**, [[jinx]] Bonus 35%→**40%**) / Savage Slicer([[briar]] Hits 10→**15**) / Tentacle Slam([[illaoi]] 35%→**45%**) / The Annihilator(Store 20%→**25%**, ManaRegen 3→**5**) / Searing Shortbow(AP 40→**45**, AD 10%→**15%**) / UwU Blaster(AD 25%→**30%**) / Evolved Embershot(AP 40→**45**)

> ⚠️ **sim 모델 아이템 영향**: UwU Blaster(귀여운 발사기, #217 모델) AD 25→30%, Rocket Barrage([[jinx]] #244 hitCount 관련) — live 갱신 시 STACKING_ITEMS / ITEM_EFFECTS 수치 재확인 필요.

## AUGMENT 변경 (17.5) — 주요만

경제 augment 대거 너프 + combat augment 버프. 대표:
- Bonk! 280/420/670/1000 → **290/435/730/1250** AD (buff)
- Call to Chaos(Gold 58→52 / XP 64→58 / Reroll 40→36, nerf) / Late Game Specialist Gold 36→**30** / Risky Moves 30→**26** / Savings Account 4→**2** / Slammin'+ 8→**4** (econ nerf)
- Early Learnings 1%→**8%** / Climb the Ladder 6%→**7%** / Little Buddies(HP 55→65, AS 6%→7%) / Tiny but Deadly 30%→**33%** / U.R.F(AS 15%→20%, ManaRegen 2→3) (combat buff)
- Heart of the Swarm Initial Briars 1→**3** / Healing Orbs I/II 220/500→**250/575** / Sunfire Board 15s→**18s**

(전체 augment 목록은 공식 노트 참조 — 본 페이지는 sim 영향 큰 항목 위주.)

## 17.5b MID-PATCH HOTFIX (2026-06-10)

> Riot: "Fast 9 가 17.5 최강 전략이었고, Vex 너프가 과해서 일부 복구 + Bard 버프" — 의도된 메타 변경을 상쇄하던 버그 수정 포함.

| 항목 | 17.5 → 17.5b |
|------|--------------|
| [[samira]] Mana | 0/60 → **0/65** (nerf) |
| [[samira]] Ability CC Duration | 1.25s → **1s** (nerf) |
| 별돌보미/뱀 Poison Damage | 18/35/50% → **25/45/60%** (17.5 너프 일부 복구 + bug fix) |
| 양치기 Summon AP per Cast | 20 → **15** |
| 양치기 Summon Shield | 125/300/300 → **100/275/430** AP |
| 우주 그루브 (7) Bonus | 15% → **10%** |
| Two Tanky (augment) Health | 500 → **450** |
| Pengu's Party | bug fix (returning set trait 조정 — Glacial/Honeymancy/Demacia/Storyweaver/The Crew/Hacker) |

## sim 통합 상태 — 미반영 (17.4 partial 기준)

- raw data / sim 코드 모두 17.5/17.5b 미반영. **calibration 게임(17.1/17.3) 정렬상 raw 갱신은 신중** (위 핵심 박스).
- 17.5/17.5b 변경 챔프 위키 페이지(stats 표)는 17.4 데이터와 정합 — live delta 는 본 페이지가 single source.
- live 17.5b 환경 시뮬레이션이 필요해질 때: ① raw json 부분 Edit(변경 필드만, 사용자 raw-data 규칙) ② 변경 챔프 위키 patch-history row 추가 ③ 신규 게임으로 calibration 재기준.

## 관련 문서

- [[patch-17-4]] — 직전 패치 (Arbiter 개편 + Psionic)
- [[patch-17-3]] — Morgana 4코 리워크 + Stargazer Fountain 재활성화
- [[bard]] / [[ezreal]] / [[rammus]] — 이번 세션 sim-fix 챔프 중 17.5 수치 변경분
