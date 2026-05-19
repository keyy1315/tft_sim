---
id: patch-17-2
type: patch
live_date: (Set 17 메이저 패치 — 정확 날짜 미확정)
status: LIVE (superseded by 17.2b mid-patch + 17.3)
last_verified: 2026-05-18
sources:
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-2/ (공식, 17.2 LIVE 본문 + 17.2b mid-patch 섹션 분리)
  - public/data/tft_set17_augments.json (carry augment entry verify)
  - src/data/carryAugments.ts (sim 코드 entry verify)
  - src/data/disabledContent.ts
related:
  - "[[stargazer-fountain]]"
  - "[[hero-augment-carry]]"
  - "[[patch-17-2b]]"
  - "[[patch-17-3]]"
---

# Patch 17.2 LIVE

Set 17 메이저 패치. 17.2b (2026-04-29 mid-patch) + [[patch-17-3]] 로 부분 obsoleted. [[hero-augment-carry]] 의 carry augment **3종 (Heat Death/Self-Destruct/Shieldmaiden) 게임 도입** + [[stargazer-fountain]] 첫 비활성화 시점.

## Trait 변경 (핵심)

### Anima Squad
- Double-Up Tech/Loss 15 → **18**
- Anima Squad Armory Time 35s → **28s**
- Tier 1 items: Savage Slicer hits 6 → **10**, Rocket Swarm dmg 45% → **35%**
- Tier 2 items: The Annihilator delay 18s → **16s**, Battle Bunny stacks **1 per attack 제한**, Cyclonic Slicers dmg ↓, UwU Blaster AD 15% → **25%**

### Arbiter / Brawler / Challenger / Mecha
- Arbiter: 다수 트리거 조건 조정 (damage/attacks/rerolls/HP threshold)
- Brawler HP 20/40/60% → **25/45/65%**
- Challenger AS 36/48% → **40/55%**
- Mecha AD/AP 20/35% → **25/45%**

### Psionic 4-Piece Items
- Biomatter Preserver HP 400 → **550**
- Drone Uplink AP 25 → **30**, repeated dmg 20% → **25%**
- Sympathetic Implant mana regen 2 → **4**, true dmg 20% → **25%**
- Target-Lock Optics AD 15% → **25%**, heal 15% → **20%**

### Meeple 7-Piece Gold/Cloned Champion
1-cost 3→**2**, 2-cost 6→**5**, 3-cost 10→**8**, 4-cost 2→**1**, 5-cost 5→**2** (전반 nerf)

### Stargazer
- **Huntress AS 10/30/45% → 12/35/55%, heal 10% → 15%**
- **Fountain pattern temporarily disabled** ← [[stargazer-fountain]] 17.2 LIVE inactive 시작점
- Medallion damage amp per 3-star 6.5% → **5%**
- Mountain: HP% 12% → **15%**, AD/AP 12% → **15%**, resists 12 → **10**, AS 12% → **10%**

### Timebreaker (Reworked)
- (2): 팀 AS +15%
- (3): Lose 시 무료 리롤, Win 시 Temporal Core 에 XP 저장 (stage 스케일)
- (4): Timebreakers AS +50%

## Champion 변경 (~30 챔프)

대표적 변경만 ([[patch-17-3]] 가 일부 재변경 → 비교 시 [[patch-17-3]] 참조):

### 1-cost
| 챔프 | 변경 |
|------|------|
| Caitlyn | Headshot missile size 확대, speed 2500 → **3000** |
| Cho'Gath | Base HP 650 → **700**, bonus HP 25/35/65/110 → **30/40/70/115** |
| Ezreal | Ability AD 155/235/355 → **160/240/365**, AP 10/15/25 → **14/21/32** |
| Talon | Omnivamp 적용 정상화, AS 0.8 → **0.75**, ability 460/690/1090 → **430/645/1000** |
| Gnar | Ability 3성 525 → **560** |
| Gragas | Healing 385/440/600/760 → **415/470/630/790** |

### 2-cost
| 챔프 | 변경 |
|------|------|
| Jinx | AD 27/40/60/102 → **29/44/65/110** |
| Milio | Damage 230/345/520/885 → **255/380/575/975**, bounce 75/115/175/300 → **85/130/190/325** |
| Diana | Shield 225/275/375 → **250/290/375**, dmg 45/70/110 → **50/75/120**, magic on-hit 50/75/130 → **52/78/135** |
| Lulu | Mana 0/60 → **0/55**, Medallion gold 1/3/6 → **1/3/5** |
| Miss Fortune | Channeler 65/100/155 → **72/108/173**, Replicator mana 20/70 → **20/65** |
| Samira | Ability 380/570/915 → **360/540/860** |

### 3-cost
| 챔프 | 변경 |
|------|------|
| Viktor | Ability AP 200/300/530 → **185/275/475** |
| Karma | AS 0.75 → **0.8** |
| Kindred | Spell AD 60/90 → **75/115** |
| Master Yi | Passive AD 60/90 → **70/105** |
| Nunu | Base mana 40/145 → **40/155**, stun 1.75/2/8 → **1.5/1.75/8** |
| Tahm Kench | Ability heal 275/315/1500 → **300/360/1500**, 3성 dmg 800% → **1500%** |

### 4-cost
| 챔프 | 변경 |
|------|------|
| Corki | AD 28/42/280 → **30/44/280** |
| Graves | Spell 360/540 → **390/585**, secondary 120/180 → **135/200**, Frame 조정 |
| Jhin | AD 38/57/644 → **41/62/644** |
| Fiora | Mana 0/80 → **0/70** |
| Shen | On-hit 40/60 AP → **45/75 AP**, shield base 225/300 → **200/250**, shield HP ratio 10% → **15%** |
| Sona | Debris 260/390 → **280/420**, 5th cast 620/930 → **680/1050** |

### 5-cost
| 챔프 | 변경 |
|------|------|
| Vex | **사거리 8 → 5 hex** (큰 변경), ability 140/210/1000 → **130/195/1000** |

## ⭐ 신규 Augments (5건)

**Carry augment 3종 — 게임 도입 시점** (sim 정식화는 [[patch-17-2b]] 에서):

| Augment | tier | apiName | sim 코드 |
|---------|------|---------|---------|
| **Heat Death** (Mordekaiser) | Gold, Stage 2 only | `TFT17_Augment_MordekaiserCarry` | ✅ `carryAugments.ts:238`, `tft_set17_augments.json:168` |
| **Self-Destruct** (Gragas) | Gold, Stage 2 only | `TFT17_Augment_GragasCarry` | ✅ `carryAugments.ts:254`, `tft_set17_augments.json:584` |
| **Shieldmaiden** (Leona) | Gold, Stage 2 only | `TFT17_Augment_LeonaCarry` | ✅ `carryAugments.ts:171`, `tft_set17_augments.json:66` |
| **Heart of the Swarm** (Primordian) | Prismatic, Stage 2 only | (별도 detection) | 17.2b 에서 disabled 됨 → 17.3 재도입 |
| **Divine Amendment** (Leona + Zoe) | Gold, Stage 3 only | (별도 검증 필요) | 🔍 |

→ Carry augment 시스템 자체 (CarryAugmentConfig + abilityData + statOverrides) 의 sim 정식화는 [[patch-17-2b]] (PR #68 + PR3) 에서. 17.2 는 raw augment entry + 기본 효과만 도입.

### 제거된 Augment
- **Pandora's Bench** (`TFT_Item_PandoraSeat` 관련) — disabledContent 항목인지 별도 verify 필요

## 조정 Augments (다수)

- AFK Gold 20 → **17**, At What Cost XP 12 → **8**, Anima Commander HP 10 → **5**
- Expedition Gold 27 → **20**, Hedge Fund Gold 25 → **22**
- Savings Account Gold 30 → **25**
- The Big Bang (Meepsie) — dmg ↓, hex falloff ↑
- Bronze for Life I&II 2.5% → **2%**
- Early Learnings AD/AP 4 → **1**
- Forged in Strength HP threshold 40 → **35**
- New Recruit — **team size +1 + 3 four-costs** (이전 duplicator). 17.2b 에서 four-cost 수 3→**1** 재변경
- On a Roll: rerolls 2 → **1**, gold 2 → **6**
- Patience is a Virtue: rerolls/turn 2 → **1**, initial 0 → **4**
- Prismatic Ticket reroll chance 50% → **45%**
- **Reach for the Stars (Jax) Resists 45 → 50** (17.3 에서 또 변경)
- Solo Plate Max HP 20% → **17%**
- **Termeepnal Velocity (Poppy)** ability dmg ↑ (17.3 에서 AS 0.7 → 0.75 — [[hero-augment-carry]] TODO)
- Two Much Value: **Disabled**

### 제약 추가
- Cosmic Restart / Dummify / Restart Mission — Hero Augments 와 동시 출현 금지
- Golden Gamble (2-1, 3-2, 4-2) 상호 배타
- Cosmic Restart/Dummify/Restart Mission — No Scout No Pivot 와 동시 출현 금지

## Items & Artifacts

### Emblem nerf (상위 power 조정)
- Dark Star AD/AP 25% → **18%**
- Rogue dmg amp 15% → **10%**
- Shepherd mana regen 3 → **2**, mana share 12% → **8%**
- Space Groove mana regen 3 → **0**, HP 0 → **200**, groove 3s → **2.5s**, cooldown min 4s
- Timebreaker HP 300 → **200**
- Vanguard HP 150 → **0**, AP/shield 3 → **2**
- Voyager Omnivamp 18% → **10%**, bonus resists 15 → **10**

### Artifacts
- Ahri's Aura Foxfire 55% → **50% AP**
- Dawncore mana regen 0 → **2**, AD/AP 20% → **15%**
- Ekko's Patience bonus dmg 45% → **40%**
- **Kayle's Exaltation — Removed** (버그)
- Titanic Hydra splash 8% → **6% AD**
- Thresh's Lantern AR/MR 25 → **35**
- Yasuo's Bladework bonus interval 3.5s → **3s**

## 3-star 4-cost 조정
- The Mighty Mech: 내구력 90% → **60%**, AoE 1500% → **800%**, line 4000% → **2000%**
- Aurelion Sol Fighter dmg 450 → **275 AP**
- LeBlanc passive 400 → **250 AP**

## System 변경

### Opening Encounters
**Returning**: Golden Gala, Prismatic Party/Finale/Opener, 3-cost/2-cost Start, Upgraded Start, Component Anvils, Loot Subscription, Emblem Ensemble, Gold Subscription, No Encounter, Howling Abyss, Silver Scrapes, Scouting Party

**Removed**: Augment Round Swap, Gwen's Gifts, Reckoner Arena, Scuttle Puddle

**New**: Double Duplicators, Artifact Anvil (3-3), Stage Three Augments, Reroll Start (8 free at 2-1), Cheaper Levels (-2 XP/level)

### Augment Distribution 조정
- Prismatic-heavy 조합 frequency ↓
- Gold-heavy 조합 frequency ↑

### God Armory (4-7)
- Gold offering 12 → **10**

### Loot system
- 7/8th place guaranteed Reforger 버그 fix
- Stage 1-3 average loot 약간 ↓

## Bug Fixes (30+ 건, sim 관련 발췌)
- Blitzcrank 부활 시 적군 부활 버그 fix ([[patch-17-2b]] 도 동일 fix 명시)
- Master Yi dash speed + targeting 정상화
- Kayle Craftmanship gold per Reforger 정상화
- Varus Starcrossed Blessing duration fix
- Flexible/Climb the Ladder augment summon 카운트 제외
- Galio ability Aurelion redirect 차단
- Nasus Bonk augment attack range fix
- Stargazer Double Up reinforcement death tracking fix
- **NOVA Emblem removal 버그 fix**
- Lucky Gloves & Invader Zed 상호 배타

## sim 적용 상태

### ✅ 활성 (코드 verify)
- 신규 carry augment 3종 (Heat Death/Self-Destruct/Shieldmaiden) → `carryAugments.ts` entries + `tft_set17_augments.json` raw
- Stargazer Fountain inactive — [[stargazer-fountain]] 의 17.2 LIVE inactive history
- Stargazer Huntress AS/heal stat 변경 — [[stargazer]] (별도 verify 필요)

### 🔍 검증 필요 / 미확정
- 챔프 stat ~30건 변경 — PR (#107 직전 PR들) 에서 일괄 갱신됐을 가능성 높으나 위키 차원 verify 안 함
- Divine Amendment augment sim 적용 상태
- New Recruit 17.2 → 17.2b 두 단계 변경 — `tft_set17_augments.json:8380` 신병 entry 가 17.2b 최종값 (4-cost 1개) 인지 verify
- 17.2 LIVE 정확 날짜 — 공식 패치 페이지에 명시 안 됨 (Set 17 패치 일정 외부 verify 필요)

## 패치 계보

```
17.1 (Set 17 출시) → 17.2 LIVE (본 페이지) → [[patch-17-2b]] (mid-patch, 2026-04-29) → [[patch-17-3]] (LIVE, 2026-05-13)
```

각 후속 패치에서 변경된 항목:
- **17.2b 변경분** (Heat Death shield buff / Self-Destruct hp cost↓ + hex reduction↓ / Shieldmaiden dmg↓ / Heart of the Swarm disabled / New Recruit four-cost 3→1 등) → [[patch-17-2b]]
- **17.3 변경분** (Stargazer Fountain **재활성화** / Morgana 5→4코 리워크 / 다수 carry augment 재조정) → [[patch-17-3]]

## 관련

- [[stargazer-fountain]] — 17.2 LIVE inactive 시작점 (lolchess.gg 17.3 패치노트 "재활성화" 의미)
- [[hero-augment-carry]] — carry augment 게임 도입 (17.2 LIVE) vs sim 정식화 (17.2b)
- [[patch-17-2b]] — mid-patch update (본 페이지 부분 obsoleted)
- [[patch-17-3]] — 다수 항목 재변경 (carry augment 5건 등 — [[hero-augment-carry]] drift 검출의 source)
- 메모리 `feedback_wiki_ingest_verify` — 본 페이지 fact 는 공식 패치노트 + 코드 verify
