---
id: patch-17-3
type: patch
live_date: 2026-05-13
mid_patch_update: 2026-05-13
status: LIVE
last_verified: 2026-05-18
sources:
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-3/ (공식)
  - public/data/tft_set17_champions.json (코드 stat 검증)
  - public/data/tft_set17_traits.json (Fountain 변수)
  - src/data/carryAugments.ts (carry augment 코드 — 17.3 drift 검증 대상)
  - src/data/disabledContent.ts
related:
  - "[[stargazer-fountain]]"
  - "[[stargazer]]"
  - "[[hero-augment-carry]]"
  - "[[patch-17-2b]]"
---

# Patch 17.3 LIVE (2026-05-13)

> Set 17 의 메이저 패치. 신의 영역 (Realm of the Gods) 리워크, 모르가나 5코→4코 리워크, [[stargazer-fountain]] 재활성화, 신규 5 augment 도입 + 다수 carry augment 조정. 동일 날짜 mid-patch update 동반 (bug fix 위주).

## System 변경

### Realm of the Gods
- 아이템 컴포넌트 선택이 **God Offering → Pengu's Offering** 으로 이동
- 챔피언별 고유 컴포넌트 부여 / 보너스 골드 제거
- Pengu offering 테이블 조정

### God Boons rebalancing
- Kayle's Boon HP/Item: 15 → **10**
- Soraka's Boon HP/Missing Health: 2 → **2.5**
- Varus's Boon HP/Star Level: 18 → **15** (Dark Star Black Holes / Zed clones 제외)

### 신규 God Blessings
- **Ahri Wealth**: 챔프 +8% AD/AP, takedown 시 12% gold
- **Soraka Divine Empathy**: 플레이어 HP 66/33 도달 시 random component
- **Soraka Prosperity**: +80 HP, interest 회당 +4/6 HP

### 기존 God Blessing 조정
- Thresh Pandora's Seat **제거**, Stage 2 random loot 의 Pocket Recombobulator 제거
- Kayle Craftsmanship Initial Reforger 2 → **1**
- Varus Duplicator Tiny Duplicators 5 → **4**
- Varus Starcrossed Upgrade: Stage 3 한정, 2-cost 전원 shop, 첫 구매 무료 2-star
- Evelynn Steamroll: 즉시 +1 gold, 승리 후 추가 +1

### Opening Encounters 조정 + PvE
- Stage 3-7 Gromp Base AD: **500 → 350**

## Trait 변경

| Trait | 변경 | sim 영향 |
|-------|------|---------|
| Anima Squad (6) | Loot 획득: 매 승리 → **매 플레이어 전투 후** | 큼 (econ 분기) |
| Arbiter | Resists Gained: 16/24 → **12/18** | 작음 |
| Marauder | AD: 20/40/60% → **18/35/55%** | 중 |
| **[[stargazer]] Fountain** | **재활성화** (17.2 LIVE inactive → 17.3 active) | **큼** |
| [[stargazer]] Huntress | 좌상단 hexes 추가 | 큼 |

### Stargazer Fountain (재활성화 확정 수치)
- 강화 칸 아군: maxHP 1% heal / 2초
- 강화 칸 별돌보미: 추가 2.5% heal + AD/AP 누적 스택 / 2초
- **(3) Fountain: AD/AP 4%** ← 17.2 시점 lolchess.gg "미확정" 으로 표기됐던 값. **공식 확정**.
- **(5) Fountain: AD/AP 7%** ← 동일. **공식 확정**.

→ [[stargazer-fountain]] 의 "보류 / 미반영" 섹션 갱신 트리거.

## Champion 변경 (27건)

### Tier 1
| 챔프 | 변경 | sim 코드 정합 |
|------|------|---------------|
| Briar | Base AD: 40 → **35** | 코드 verify 필요 |
| Leona | Base AR/MR: 45 → **40** | ✓ (`tft_set17_champions.json` 40/40 확인) |
| Twisted Fate | Min Damage AP: 190/285/430/730 → **180/270/405/690** / Max: 380/570/860/1460 → **360/540/810/1380** | 코드 verify 필요 |
| Teemo | Damage AP: 70/105/190/325 → **65/95/170/300** | 코드 verify 필요 |

### Tier 2
| 챔프 | 변경 |
|------|------|
| Akali | Spell AD: 34/50/80/135 → **37/56/84/140** (buff) |
| Bel'veth | Spell AD: 20/30/45/77 → **18/27/41/69** (nerf) |
| Gnar | Base AD: 45 → **50** (buff) |
| Jax | Flat DR AP: 15/25/35/45 → **15/20/25/30** / Shield AP: 400/470/550 → **400/450/500** (nerf) |
| Jinx | Spell AD 3성: 65 → **70** (buff) |

### Tier 3
| 챔프 | 변경 |
|------|------|
| Diana | Shield AP: 250/290/375 → **275/325/475** / Orb AP: 50/75/120 → **60/90/145** (buff) |
| Fizz | Dash Damage AP: 110/165/265 → **120/180/290** (buff) |
| Kai'Sa | Spell AD: 32/48/77 → **30/45/72** (nerf) |
| Lulu | Serpent MR Shred: 5/7/10 → **4/6/8** / Spell: 150/225/360 → **140/210/335** (nerf) |
| Miss Fortune | Challenger Secondary: 30% → **35%** / Challenger Spell: 120/180/290 → **130/195/315** / Conduit: 72/108/172 → **80/120/190** (buff) |
| Ornn | Shield AP: 100/150/500 → **125/200/500** (buff) |
| Samira | Spell AD: 360/540/860 → **375/560/900** (buff) |

### Tier 4
| 챔프 | 변경 |
|------|------|
| Aurelion Sol | Mech Fighter: 78/118/275 → **82/123/275** / Non-Mech Beam: 185/280/2000 → **320/480/2000** / Falloff: 60% → **80%** (큰 변경) |
| Karma | Secondary AP: 150/225 → **180/270** (buff) |
| LeBlanc | Spell AP: 70/105 → **80/120** (buff) |
| Master Yi | Omnivamp: 15% → **10%** (nerf) |
| Nami | Spell: 410/615/5000 → **440/660/5000** (buff) |
| Nunu | Base Mana: 40/155 → **40/145** (buff) |
| Xayah | Spell Duration: 4초 → **6 attacks** / 깃털당 보너스 10/15/200 AD (cast→on-attack 메커니즘 변경) |
| **Morgana (리워크)** | **5코 → 4코 이동** / Role: Magic Fighter → **Magic Tank** / Dark Lady 패시브 (팀 4% durability, Dark Form 시 10%) / Mana 20/60→30/90 / AS 0.90→0.65 / HP 800→1300 / Resists 50→70 / AD 50→60 / **어빌리티 리워크**: 3초 변신, 525/625/2500 AP + 10% HP heal + 인접 챔프 tether, 가장 가까운 3 적에 100/150/3000 AP damage + 2 부상 아군 회복 |

### Tier 5
| 챔프 | 변경 | sim 코드 정합 |
|------|------|---------------|
| **Shen** | Shield HP Scalar: 10% → **15%** / Passive AD: 40/60 AP → **20/30 AP + 1% maxHP** / Base HP: 1200 → **1300** | ✓ PR #108 적용 |
| Sona | 타게팅 정렬: nearest unit → **nearest row** / Debris: 280/420 → **300/450** / Large Cast: 680/1050 → **720/1100** | 코드 verify 필요 |
| Zed | Clone HP 감소: 33% → **33/40/40%** / Bruiser Emblem 상호작용 버그 fix | 코드 verify 필요 |

## 신규 Augments (5건)

| Augment | 효과 | sim 적용 |
|---------|------|---------|
| Concentration | Conduit ability 지속 25-50% 증가 + Zoe/Mordekaiser 획득 | 미확인 |
| Heart of the Swarm | 3-star 챔프 카운트 Swarmling, lv9 + 6 unique 3-star → Apex Primordian 소환 + Briar/Bel'veth/2★ Rek'Sai 획득 | 미확인 |
| Loot Singularity | Black Hole 적 흡수 → space matter → loot. Cho'Gath/Lissandra 획득 + Dark Star breakpoint별 2/3/4 space matter | 미확인 |
| Tour of the Galaxy | Voyager +130 HP, +13% AD/AP. 새 플레이어 만날 때마다 +10%. Pyke/Meepsie 획득 | 미확인 |
| Timestream | Timebreaker 리롤당 +2 HP, +0.25% AS. Ezreal/Pantheon 획득 | 미확인 |

## 조정 Augments — 다수 (sim 정확도 핵심)

### Champion augments (carry augment 그룹)

✅ **PR #115 머지 완료 (2026-05-18, commit `39cbce2`)** — 5건 sim 정합 적용. Poppy/Nasus 2건은 적용 위치 모호로 TODO 코멘트 (인게임 verify 후 후속 PR).

| Augment | 17.2b | 17.3 LIVE | sim 정합 |
|---------|-------|----------|:--------:|
| Shieldmaiden (Leona) | `baseDamageHpFrac: 0.28`, secondary `[180,270,405]` | `0.24`, `[200,300,480]` | ✅ |
| Heat Death (Mordekaiser) | shield `[225,250,300]`, mana `40/100` | `[175,200,400]`, `10/40` | ✅ |
| Reach for the Stars (Jax) | damage `[155,230,375]` | `[170,250,450]` | ✅ |
| Stellar Combo (Aatrox) | 2nd `[100,150,225]`, 3rd `[160,240,360]`, isolation `2.5` | `[110,165,275]`, `[200,300,475]`, `2.0` | ✅ |
| The Big Bang (Meepsie/IvernMinion) | `hexReduction: 0.45` | `0.35` | ✅ |
| Termeepnal Velocity (Poppy) | AS `0.7` (별도 코드) | `0.75` | 🔍 TODO (`carryAugments.ts:PoppyCarry` 위 TODO 주석 — augment grant vs statOverride 모호, 인게임 verify) |
| Bonk! (Nasus) | resists 미설정 | resists `40 → 45` | 🔍 TODO (`carryAugments.ts:NasusCarry` 위 TODO 주석 — statOverrides 채움 정책, 인게임 측정 후) |

### Economy augments
- Buried Treasures Rounds: 5 → **4**
- Cosmic Restart Rerolls: 11 → **8**
- Exclusive Customization I/II Gold: 10 → **7**
- Golden Gamble+ Gold: 4 → **2**
- Golden Gamble++ Gold: 12 → **6**

### Other augments
- Flexible HP/Emblem: 40 → **30**
- Jeweled Lotus Crit: 20% → **10%**
- Kahunahuna Bonus True Damage: 150% AD → **125% AD**
- May the Fours Be With You HP: 254 → **144**
- The Tower HP: 600/900/1500/2000 → **450/700/1250/1600**
- New Recruit: **4-2 version 추가** (2개 4-cost grant)
- Vampiric Vitality II **제거**
- Mace's Will: AS 제거, Crit 20% → **25%**
- Retribution: 보유자 **15% Crit Chance** 추가 부여

### Arbiter Star Level Outputs
- AP/AS/Leona/Gold/Reroll/Shield/MaxHP/Resists 각각 미세 조정 (대부분 7→8, 12→13 등 step up)

## Items

- **Edge of Night**: Missing Health Heal 30% → **20%** (nerf)
- **Horizon Focus**: **Disabled**
- Titanic Hydra: Xayah primary basic attack 에만 AOE 발동

## Bug Fixes (sim 관련 발췌)

- Aurelion Sol 어빌리티 시각 사거리 초과 fix
- New Recruit 팀 크기 +1 정상 적용
- Loot Singularity spatula 보상 버그 fix
- Retribution 15% crit chance 정상 적용
- Varus's Obsession 가장 강한 Tank 타게팅 정확화
- Solo Plate HP 전투 중 갱신 정지
- Malware Matrix Armor Reduction Graves/Xayah on-hit 정상 적용
- Graves Fragmentation Rounds → Battle Bunny Crossbow crit 미카운트
- Kayle's Boon tooltip typo fix
- Dark Star Supernova 전투 중 갱신 정지
- Hold the Line / Twin Guardians 상호 배타
- Howling Abyss Encounter 시작 챔프 정정
- Bard / Viktor ability 실패 케이스 fix

## sim 적용 PR 그룹

- PR #107 — 17.3 trait/champion 데이터 갱신 (champions.json, traits.json)
- PR #108 — Shen passive fix (BonusDamageOnAttack 45/75 → 20/30) ✓
- PR #109 — Stargazer Fountain active (PR-3, dev 머지) ✓
- PR #115 (`39cbce2`) — carryAugments.ts 17.3 정합 ✅ 머지 완료

## ✅ Lint findings — sim 정확도 갭 (resolved)

### 1. `carryAugments.ts` 17.3 drift (위키 lint 5번째 사례) — **PR #115 (`39cbce2`) 머지 완료, 2026-05-18**

위 "조정 Augments — Champion augments" 표 참조. 5건 코드 정합 적용 + 2건 TODO 코멘트 (인게임 verify 대기):

- LeonaCarry: `baseDamageHpFrac` 0.28 → 0.24, `secondaryDamage` `[180,270,405]` → `[200,300,480]` ✅
- MordekaiserCarry: `shield` `[225,250,300]` → `[175,200,400]`, mana `40/100` → `10/40` ✅
- JaxCarry: `damage` `[155,230,375]` → `[170,250,450]` ✅
- AatroxCarry: `secondaryDamage` `[100,150,225]` → `[110,165,275]`, `slamDamage` `[160,240,360]` → `[200,300,475]`, `singleTargetMultiplier` 2.5 → 2.0 ✅
- IvernMinionCarry: `hexReduction` 0.45 → 0.35 ✅
- PoppyCarry (Termeepnal): AS 0.7 → 0.75 — 🔍 TODO (`carryAugments.ts:PoppyCarry` 코멘트, 인게임 verify 후 후속 PR)
- NasusCarry (Bonk!): resists 40 → 45 — 🔍 TODO (`carryAugments.ts:NasusCarry` 코멘트, statOverrides 채움 정책)

검증: pnpm lint/typecheck/build 통과 + `pnpm vitest run tests/unit/simulator/` 449 passed.

### 2. champion stat 검증 미완 항목
17.3 변경됐다고 명시되었으나 코드 verify 안 된 항목 — 추가 grep 필요:
- Briar Base AD 40 → 35 / Twisted Fate AP / Teemo AP / Akali AD / Bel'veth AD / Gnar AD / Jinx AD / Diana / Fizz / Kai'sa / Lulu / Miss Fortune / Ornn / Samira / Aurelion / Karma / LeBlanc / Yi omnivamp / Nami / Nunu / Xayah / Morgana 리워크 / Sona / Zed

→ PR #107 에서 일괄 갱신됐을 가능성 높으나 위키 차원에서 모두 verify 후 "✓ 코드 정합" 표시 필요.

## Cross-ref 갱신 트리거

- [[stargazer-fountain]]: "AD/AP 4%/7% 미확정" → **확정** 으로 갱신
- [[stargazer]]: Huntress 좌상단 hex 추가 사실 반영
- [[hero-augment-carry]]: 17.3 sim drift 5건을 Lint finding 으로 추가
- [[patch-17-2b]]: "17.3 와의 차이" 섹션은 그대로 (Fountain 활성화 만 언급)

## 회귀 가드

- `tests/unit/simulator/stargazer-fountain-1703-active.test.ts` (PR #109, 7 케이스)
- 17.2/17.2b/Fountain-1702 obsolete 테스트 제거 (`e2031d7`)
- carryAugments 17.3 정합 가드 — **미작성** (별도 PR 후보)

## 미확정 / 추적 필요

- 신규 5 augment 의 sim 적용 상태 (`disabledContent` 인지 active 인지)
- Sona 타게팅 변경 ("nearest row") — `findTarget` 룰 분기 가능성, 별도 검증
- Morgana 5→4코 리워크 — champions.json + ability config 양쪽 갱신 필요
- Horizon Focus disabled — `disabledContent.ts` 반영 확인
- 17.3 mid-patch update (5/13) — bug fix 위주, 별도 분리 추적 불필요

## 관련

- [[stargazer-fountain]] — 재활성화 + tier별 confirmed 수치
- [[stargazer]] — Huntress hex 추가
- [[hero-augment-carry]] — carry augment drift 5건
- [[patch-17-2b]] — 부분 obsoleted (Fountain 재활성, MordekaiserCarry 수치 재변경)
- 메모리: `project_17-3-data-update-status` (PR #107~#109 진행)
