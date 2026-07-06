# Patch 17.6 데이터 반영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** raw 데이터(`public/data/tft_set17_*.json` + `src/data/carryAugments.ts`)를 17.4 partial 기준에서 **17.5 + 17.6 누적 반영**한 17.6 LIVE 기준으로 갱신하고, 위키 개별 챔프 페이지를 동기화한 뒤, 17.6 calibration baseline을 재기준한다.

**Architecture:** 데이터 마이그레이션. 각 데이터 파일을 패치노트 **최종값(after)으로 직접 세팅**(before 대조 비의존 — baseline이 챔프별 17.3~17.4로 섞여 있어 신뢰 불가). raw-data 규칙에 따라 **변경 필드만 부분 Edit**(전체 덮어쓰기 금지, 사용자 임의 필드 보존). 메커니즘 변경(수치 아님)은 데이터로 안 되므로 별도 sim-코드 Task로 분리.

**Tech Stack:** Next.js 15 / TypeScript strict / JSON 데이터 / pnpm (lint·typecheck·build 게이트)

## Global Constraints

- **부분 Edit 원칙**: raw data JSON은 전체 덮어쓰기 절대 금지. 변경되는 필드만 Edit. 사용자가 추가한 임의 필드(주석성 필드 등) 보존. (메모리 `feedback_data_edit`)
- **최종값 직접 세팅**: 패치노트 "before"는 신뢰하지 않는다. 17.6에서 바뀐 항목 = 17.6 after, 17.5에서만 바뀐 항목 = 17.5(또는 17.5b) after 를 최종 목표값으로 직접 세팅. 17.5b가 17.5를 덮은 항목(Stargazer Poison, Shepherd, Space Groove(7), Two Tanky)은 17.5b 값이 최종.
- **존재 확인 후 Edit**: items/augments/Pengu trait 항목은 해당 apiName이 우리 데이터에 실재하는지 grep 먼저. 없으면 skip + 본 plan에 "데이터 부재" 기록 (신규 추가 여부는 별도 판단).
- **검증 게이트**: 각 파일 Edit 후 변경 필드 재grep으로 값 확인. 전체 데이터 작업 후 `pnpm lint && pnpm typecheck && pnpm build` 3종 통과 필수.
- **메커니즘 vs 수치 분리**: "Shen AS 비감쇠", "Anima Squad 캐시아웃 개편", "augment 상호배제(mutually exclusive)" 등 로직 변경은 데이터 수치가 아님 → Phase 6에 sim-코드 영향 항목으로 격리. 데이터 Task에서는 **수치 필드만** 처리.
- **patch_version 갱신**: 각 파일 `meta.patch_version` / `meta.fetched_at`을 작업 완료 후 17.6 기준으로 갱신.
- **위키 single source**: 17.6 변경의 delta source는 `docs/wiki/patches/patch-17-6.md` + `patch-17-5.md`. 데이터 갱신 후 개별 챔프 페이지 stats를 데이터와 재정합.

---

## File Structure

| 파일 | 책임 | Phase |
|------|------|-------|
| `public/data/tft_set17_champions.json` | 챔프 ability variables / stats 수치 | 1 |
| `public/data/tft_set17_traits.json` | set17 trait effects.variables 수치 | 2 |
| `public/data/tft_set17_items.json` | Artifact/Radiant/Anima 아이템 effects | 3 |
| `public/data/tft_set17_augments.json` | augment effects 수치 | 4 |
| `src/data/carryAugments.ts` | hero carry augment hardcoded 수치 | 5 |
| `src/lib/simulator/**` (sim 코드) | 메커니즘 변경 (수치 아님) | 6 |
| `docs/wiki/champions/*.md` | 개별 챔프 stats/patch-history 정합 | 7 |
| `actual-data/game-17-6-*.json` (신규) | 17.6 calibration baseline | 8 |

---

## Phase 1: champions.json — 17.5+17.6 누적 (28종)

**Files:**
- Modify: `public/data/tft_set17_champions.json`

**절차 (각 챔프 공통):**
1. `python3`로 해당 apiName의 `ability.variables[].value` 현재값 출력 (구조 확인)
2. 목표 최종값으로 변경 필드만 Edit (배열 인덱스 = star level)
3. 재출력으로 값 확인

**목표 최종값 테이블** (★ = 코스트별/스타별 배열, 출처: [[patch-17-5]]/[[patch-17-6]] 위키 + 공식 노트):

### Tier 1
- [ ] **TFT17_TwistedFate** — DamageMin `205/305/460/800`, DamageMax `410/610/920/1565` (17.6)
- [ ] **TFT17_Caitlyn** — Headshot AD `190/285/540/925` (17.5; ★1=145 불변 주의 — 배열 첫 인덱스 확인)
- [ ] **TFT17_Ezreal** — Ability AD `170/255/380/650` (17.5)
- [ ] **TFT17_Nasus** — Flat Health gained `300/400/600/800` (17.5)
- [ ] **TFT17_Teemo** — Spell Damage `70/105/190/325` (17.5; ★1=60 불변)
- [ ] **TFT17_Veigar** — Spell Damage AP `330/495/750/1200` (17.5)

### Tier 2
- [ ] **TFT17_Gnar** — Base AD `48` (17.6; ability variables 아닌 stats.damage 필드 — 위치 확인)
- [ ] **TFT17_Mordekaiser** — Initial Shield `350/450/625`, Shield Channel `75/100/115` (17.6 최종)
- [ ] **TFT17_Akali** — Spell Damage AD `39/59/88` (17.5; ★1=27 불변)
- [ ] **TFT17_Belveth** (apiName 확인 — Bel'Veth) — Spell Damage AD `22/33/50` (17.5)
- [ ] **TFT17_Gwen** — Attack Speed `0.8`(stats.attackSpeed), AoE Spell Damage `75/110/215` (17.5)

### Tier 3
- [ ] **TFT17_Viktor** — Ability Damage `200/300/530` (17.6)
- [ ] **TFT17_Lulu** — Altar Spell Damage `160/240/400`, Serpent Spell Damage `150/225/360` (17.6)
- [ ] **TFT17_Fizz** — Dash Damage AP `140/210/310` (17.5)
- [ ] **TFT17_Ornn** — Groove Duration `2.5`(s) (17.5)

### Tier 4
- [ ] **TFT17_AurelionSol** — Non-Mech Spell Damage `335/505` (17.6)
- [ ] **TFT17_Karma** — Split Damage AP `630/945` (17.6)
- [ ] **TFT17_LeBlanc** — Passive Damage AP `66/99`, Sigil Damage `95/145` (17.6 최종 — 17.5 85/130 위에 17.6 덮음)
- [ ] **TFT17_Morgana** — Health Gain AP `600/700`, Ally Heal AP `125/185` (17.6)
- [ ] **TFT17_MasterYi** — Spell Damage AD `55/85` (17.6)
- [ ] **TFT17_Nami** — Primary Spell Damage `460/690`, Secondary Spell Damage `125/185` (17.6)
- [ ] **TFT17_Kindred** — Base AD `58` (17.5; stats.damage)
- [ ] **TFT17_Rammus** — Meeple bonus DR per Meep `3`, Mana `20/80` (17.5)

### Tier 5
- [ ] **TFT17_Bard** — Spell Damage `240/360` (17.5)
- [ ] **TFT17_Vex** — Spell Damage AP `140/210` (17.5)
- [ ] **TFT17_Samira** — Mana `0/65`(stats.mana 또는 initialMana/maxMana), Ability CC Duration `1`(s) (17.5b)
- [ ] **TFT17_Shen** — ⚠️ AS bonus 비감쇠 = **메커니즘 변경, 수치 아님** → Phase 6으로. 여기서는 skip.

- [ ] **Phase 1 검증**: 변경 챔프 전수 재grep으로 최종값 일치 확인. `git diff --stat`으로 champions.json만 변경됐는지 확인.
- [ ] **Phase 1 commit**: `git add public/data/tft_set17_champions.json && git commit -m "data(17.6): champion 수치 17.5+17.6 누적 반영 (27종)"`

> ⚠️ 각 챔프의 실제 변수명(DamageMin / Damage / Shield 등)과 stats 위치는 **파일에서 직접 확인** 후 Edit. 위 변수명은 추정 라벨 — 실제 키와 다르면 실제 키 사용. ★1 불변(Caitlyn 145 / Teemo 60 / Akali 27) 항목은 배열 첫 원소를 건드리지 말 것.

---

## Phase 2: traits.json — set17 active trait 수치

**Files:**
- Modify: `public/data/tft_set17_traits.json`

**절차**: 각 trait apiName grep → `effects[].variables{}` 현재값 확인 → 최종값 Edit. trait 효과는 breakpoint별 `effects` 배열이라 인덱스(activation tier) 주의.

- [ ] **결투가(Arbiter)** — (17.5) 3평타당 Leona `5/8%`, Armor `10/16`, 50마나당 Leona `9/12%` + (17.6) Rerolled-Last-Turn 보너스: AS `40/65%`, Resists `55/80`, Shield `48/70%`, Gold `35%` + Output Combat Start Shield Duration `10`(s). ⚠️ 17.5와 17.6이 **다른 변수** — 둘 다 반영. 변수명 파일에서 확인.
- [ ] **미플(Meeple)** — (17.5) Flat HP `100/350/450/550` + (10) Meeplord Big Slam `1500`, AoE Slam `1000`, Stun Duration `3`(s), Stun Damage `400` + (17.6) (7) Gold per 2-cost Cloned `3`
- [ ] **별돌보미/뱀(Stargazer/Serpent) Poison** — `25/45/60%` (17.5b 최종). ⚠️ [[stargazer-fountain]] 메커니즘과 충돌 없는지 확인 (Poison damage 변수만)
- [ ] **양치기(Shepherd)** — (17.5b) Summon AP per Cast `15`, Shield `100/275/430` + (17.6) (5) Tail Sweep `230`, HP Mult(stage4-6) `6.75/7.8/9.5`; (7) Shield `460`, Tail Sweep `275`, HP Mult `6.75/8/10`
- [ ] **기갑(Mecha)** — AD/AP `25/40/40%` (17.6; breakpoint별 배열)
- [ ] **N.O.V.A (5)** — Caitlyn Headshot `50%`, Akali Damage `15/22/28/34%`, Kindred Damage Amp `15%` (17.6). ⚠️ trait 레벨 보너스인지 champion 레벨인지 확인 — N.O.V.A trait effects에 있을 것
- [ ] **우주 그루브(Space Groove)** — Health Regen per Groovian `0.85%`, (7) Bonus `10%` (17.5/17.5b)
- [ ] **애니마 군단(Anima Squad)** — ⚠️ (6) 캐시아웃 개편 = **loot 메커니즘, 수치 아님**. sim 영향 없음 → skip (Phase 6 기록만).

- [ ] **Phase 2 검증**: 변경 trait 재grep. `pnpm typecheck` (traits 타입 깨짐 없는지).
- [ ] **Phase 2 commit**: `git commit -m "data(17.6): trait 수치 17.5+17.6 반영 (Arbiter/Meeple/Shepherd/Mecha/NOVA/Stargazer)"`

---

## Phase 3: items.json — Artifact/Radiant/Anima (17.5만, 17.6 변경 없음)

**Files:**
- Modify: `public/data/tft_set17_items.json`

**절차**: ⚠️ items.json은 710개 전 세트 공용. **각 아이템 apiName 존재 확인 필수** (Radiant/Anima는 별도 apiName일 수 있음 — `TFT_Item_Radiant*` / Anima는 set17 전용). grep으로 apiName 찾고 `effects{}` 필드 확인 후 Edit. 없으면 skip + 기록.

- [ ] **Artifact**: The Collector AD `35%`, Mogul's Mail HP/stack `5`
- [ ] **Radiant**: Deathblade AD `100%`, Protector's Vow Shield `50%`, Morellonomicon AP `35`, Quicksilver Base AS `40%`, Rabadon AP `100%`, Rageblade Base AS `25%`, Red Buff AS `80%`
- [ ] **Anima T1**: Guiding Hex Aurora AP `12`, Rocket Barrage AD `15%`/Jinx Bonus `40%`, Savage Slicer Briar Hits `15`, Tentacle Slam Illaoi `45%`
- [ ] **Anima T2**: Annihilator Store `25%`/ManaRegen `5`, Searing Shortbow AP `45`/AD `15%`, UwU Blaster AD `30%`
- [ ] **Anima T3**: Evolved Embershot AP `45`

> ⚠️ sim 모델 아이템(UwU Blaster #217, Rocket Barrage/Jinx #244)은 effects Edit 후 `STACKING_ITEMS`/`ITEM_EFFECTS` 코드 상수와 정합 재확인 — Phase 6 항목.

- [ ] **Phase 3 검증**: 변경 아이템 재grep. 존재하지 않아 skip한 항목 목록 기록.
- [ ] **Phase 3 commit**: `git commit -m "data(17.6): item 수치 17.5 반영 (Artifact/Radiant/Anima)"`

---

## Phase 4: augments.json — 17.5 + 17.6 대규모

**Files:**
- Modify: `public/data/tft_set17_augments.json`

**절차**: 440개. **각 augment apiName/name 존재 확인 필수**. effects 수치 항목만 Edit. **상호배제(mutually exclusive)/disabled/제거-교체** = 메커니즘 → Phase 6. 여기서는 **순수 수치만**.

### 17.6 수치 (combat/util)
- [ ] Blood Offering: HP Loss `0.15`, Shield `0.20`, Stats `12% AP+AD` (⚠️ AP+AD 동시 = 필드 구조 변경 가능 — 단순 수치 아니면 Phase 6)
- [ ] Contract Killer (Pyke): Bonus Tank Damage `0.75`
- [ ] High Voltage: Bonus Damage `0.25`
- [ ] Best Friends I/II: Armor·MR `9/14` (⚠️ MR 추가 = 신규 필드 → Phase 6 검토)
- [ ] Bodyguard Training: Base Resists `15`
- [ ] Forged in Strength: Health Threshold `30`
- [ ] Two Tanky: Health `375`, Shield `0.35` (17.5b 450 위에 17.6 375)
- [ ] Timestream: AS Per Reroll `0.003` (+전 아군 100 HP = 신규 효과 → Phase 6)
- [ ] Self-Destruct (Gragas): `carryAugments.ts` → Phase 5
- [ ] Heat Death (Mordekaiser): `carryAugments.ts` → Phase 5

### 17.6 경제/유틸 (순수 골드 수치)
- [ ] Expedition Gold `15`, Birthday Reunion 초기 `3`g, Forward Thinking Rounds `6`/Gold `62`, Late Game Specialist Gold `27`, Going Long `16`g, Golden Gamble `2`g/Golden Gamble+ `3`g, Treasure Hunt `18`g/chest, ReinFOURcement `7`g, Urf's Gambit `3`g, Wise Spending `1`g, Pilfer `19`g, Band of Thieves II Turn Delay `6`(Plus `5`), Build-a-Bud `10`g, Living Forge Rounds `9`, Shimmerscale Essence Rounds `7`, Early Learnings AD/AP `5%`

### 17.5 수치
- [ ] Bonk! AD `290/435/730/1250`, Climb the Ladder `7%`, Cry Me a River ManaRegen `4`, Healing Orbs I/II `250/575`, Heart of the Swarm Briars `3`, Little Buddies HP `65`/AS `7%`, Sunfire Board `18`(s), Tiny but Deadly AS `33%`, U.R.F AS `20%`/ManaRegen `3`, Win Out XP `10`
- [ ] Buried Treasures Rounds `5`, Call to Chaos Gold `52`/XP `58`/Rerolls `36`, Continuous Conjuration `42000`, Forge a Friend Gold `5`, Late Game Specialist Gold(17.5값 `30` → 17.6 `27`이 최종), Level Up! XP `6`, Risky Moves `26`, Savings Account `2`, Slammin'+ `4`, Upward Mobility Rerolls/Level `1`

> ⚠️ **17.5/17.6 중복 항목 = 17.6 최종 우선** (예: Late Game Specialist Gold 36→30(17.5)→27(17.6) = `27`).

### Phase 6으로 격리 (메커니즘 — 데이터 수치 아님)
- Restart Mission / Late Game Specialist / Expedition 상호배제, Critical Success disabled, Retribution 제거-교체, Recombobulator 무료 리롤 추가, Deadlier Caps Mana Regen 추가, Lucky Gloves 조건부 골드 → 기록만.

- [ ] **Phase 4 검증**: 변경 augment 재grep. skip/Phase6 격리 항목 목록 기록.
- [ ] **Phase 4 commit**: `git commit -m "data(17.6): augment 수치 17.5+17.6 반영 (combat/econ)"`

---

## Phase 5: carryAugments.ts — hero carry hardcoded

**Files:**
- Modify: `src/data/carryAugments.ts`

**검증된 사실** (wiki-ingest-verifier): `CARRY_AUGMENTS` 10개 = NasusCarry/AatroxCarry/PoppyCarry/LeonaCarry/IvernMinionCarry/JaxCarry/PykeCarry/MordekaiserCarry/GragasCarry/InvaderZed.

- [ ] **MordekaiserCarry (Heat Death)** — `abilityData` damage `[55, 82, 140]` (17.6; 현재 `[50,75,115]`)
- [ ] **GragasCarry (Self-Destruct)** — `abilityData` damage `[225, 335, 550]` (17.6; 현재 `[280,420,630]` = 17.4값. ⚠️ 17.4 280 vs 17.6 before 250 불일치 — 최종값 225/335/550 직접 세팅)
- [ ] **PykeCarry (Contract Killer)** — Bonus Tank Damage `0.75` (17.6; 필드 존재 시)
- [ ] Blood Offering — carryAugments.ts에 **없음** (검증됨). carry 아님 → skip. augments.json/Phase 6에서 판단.

- [ ] **Phase 5 검증**: `pnpm typecheck` (carryAugments 타입). 변경값 재확인.
- [ ] **Phase 5 commit**: `git commit -m "data(17.6): carry augment 수치 반영 (Heat Death/Self-Destruct/Contract Killer)"`

---

## Phase 6: sim-코드 메커니즘 변경 — 별도 평가 (이번 작업 범위 결정 필요)

> 데이터 수치로 안 되는 로직 변경 모음. **각 항목이 현재 sim에 모델링돼 있는지부터 확인** 후, 모델링됐으면 수정 / 안 됐으면 백로그.

- [ ] Shen AS bonus 비감쇠 — AS 감쇠 로직(`combatLoop.ts`)에 Shen 예외 분기 존재 여부 확인
- [ ] augment 상호배제(Restart Mission/Expedition/Late Game Specialist/Critical Success disabled/Retribution 교체) — augment 선택 로직이 sim에 있는지 (대개 빌더 UI 영역, sim 무관일 수 있음)
- [ ] Best Friends MR 추가 / Timestream 전아군 HP / Blood Offering AP+AD / Deadlier Caps Mana / Recombobulator 리롤 — 신규 효과 필드 (모델링 여부 확인)
- [ ] STACKING_ITEMS / ITEM_EFFECTS 상수 정합 (UwU Blaster 30%, Rocket Barrage) — Phase 3 effects와 동기화
- [ ] Anima Squad / Anima Tech 캐시아웃 — loot 메커니즘, sim 무관 (기록만)

- [ ] **결정 포인트**: Phase 6은 범위가 크고 sim 모델링 여부에 따라 갈림 → 데이터(Phase 1~5) 완료 후 사용자와 별도 논의. **데이터 우선 머지, 메커니즘은 후속 PR 권장.**

---

## Phase 7: 위키 개별 챔프 페이지 동기화

**Files:**
- Modify: `docs/wiki/champions/*.md` (Phase 1 변경 27종)

- [ ] 각 변경 챔프 페이지의 stats/ability 수치 표를 **데이터(이제 17.6)와 재정합**. patch-history row에 17.6 변경 추가.
- [ ] champion 페이지 수정이므로 **`wiki-ingest-verifier` dispatch 필수** (CLAUDE.md 규칙). P0 fix 후 진행.
- [ ] `WIKI_VERIFIED=1 git commit -m "docs(wiki): 17.6 챔프 stats 데이터 정합"` (pre-commit gate 통과)

> 27종 한 번에 말고 tier별/배치별로 dispatch (verifier 부하 분산).

---

## Phase 8: 17.6 calibration baseline 재기준

**Files:**
- Create: `actual-data/game-17-6-*.json` (사용자 제공 게임 리플레이)

- [ ] **사용자 입력 대기**: 17.6 환경 신규 게임 리플레이 데이터 확보 (기존 17.1/17.3 게임은 17.6 데이터로 무효).
- [ ] 신규 게임으로 under-damage calibration 재측정. 기존 진단(메모리 `project_underdamage_calibration`) 갱신.
- [ ] `meta.patch_version` 전 파일 17.6 LIVE로 최종 갱신 + 메모리/위키 calibration baseline 갱신 기록.

---

## Self-Review

- **Spec coverage**: 17.5+17.6 누적(champions/traits/items/augments/carry) ✅ Phase 1~5. calibration 17.6 신규 게임 ✅ Phase 8. 메커니즘 변경 ✅ Phase 6 격리.
- **Placeholder scan**: 변수명("DamageMin" 등)은 "파일에서 직접 확인" 명시 — 데이터 Edit은 파일 현재 내용 의존이라 실행 시 정확 string 생성 불가피. 최종 목표값은 모두 구체 수치로 명시(placeholder 없음).
- **누적 충돌**: 17.5/17.6 중복 항목(Mordekaiser Shield, LeBlanc Sigil, Late Game Specialist, Two Tanky) = 17.6 최종 우선 규칙 명시 ✅.
- **Risk**: items/augments apiName 부재 가능 → "존재 확인 후 Edit, 없으면 skip+기록" 절차 ✅. baseline 불일치(TF/Gragas) → 최종값 직접 세팅으로 우회 ✅.

---

## Execution Handoff

데이터 작업은 파일별 검증이 중요하므로 Phase 1(champions)부터 단계적 실행 권장.
