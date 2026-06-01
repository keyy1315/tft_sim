---
id: patch-17-4
type: patch
live_date: 2026-05-27
status: LIVE
last_verified: 2026-06-01 (sequence C-5b — Stargazer Serpent ★1 Poison 너프 raw json 적용 완료. C-5d Mountain (PR #169) + 본 PR 누적 2/5. sequence C-5a/c/e 및 sequence B 후속 + D 대기)
sources:
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-4/ (공식)
  - https://esports.gg/news/teamfight-tactics/tft-patch-17-4-notes-belveth-nerf-reverted-plus-arbiter-and-psionic-buffs/ (esports.gg)
  - https://www.pcgamesn.com/teamfight-tactics/patch-17-4-notes-conditionality (pcgamesn)
  - public/data/tft_set17_champions.json (17.3 기준 — 17.4 갱신 대기, **별도 PR sequence B**)
  - public/data/tft_set17_traits.json (17.3 기준 — 17.4 갱신 대기)
  - public/data/tft_set17_augments.json (17.3 기준 — 17.4 갱신 대기)
related:
  - "[[patch-17-3]]"
  - "[[patch-17-2b]]"
  - "[[zed]]"
  - "[[shen]]"
  - "[[jax]]"
  - "[[invader-zed]]"
  - "[[jax-carry]]"
  - "[[stargazer-fountain]]"
---

# Patch 17.4 LIVE (2026-05-27)

> Set 17 Space Gods 의 4번째 메이저 패치. 17.3 의 Bel'Veth 너프 reverted + Arbiter 대규모 개편 + Sniper/Psionic 일관성 강화. 본 위키 페이지는 **17.4 변경 사항을 fact 로 기록** 하되, **raw data + sim 코드는 17.3 기준 (17.4 미반영)** 임을 명시.

## ⚠️ sim 적용 상태 — 미반영 (별도 PR sequence 진행 중)

| Asset | 17.4 적용 상태 | PR |
|-------|----------------|----|
| **raw data** (`public/data/tft_set17_*.json`) | ⚠️ **sequence B 1차 완료** (PR #163): Zed (initialMana 40, HPPenalty ★3=value[2]=0.45 — Codex P1 catch 후 인덱싱 정정) + Shen (initialMana 20, BonusDamageOnAttack ★1/★2 25/40) + Jax (FlatDR value[1]/[2]/[3] 20/25/30) + ASTrait (AttackSpeedPercent tier 3/4 28%/42%) + RangedTrait (PercentDamageIncrease tier 3/4 25/35) + SpaceGroove (tier 7 EffectBonus 15 — ⚠️ sim 미반영, Codex P2 catch) | 본 PR (sequence B 1차) |
| **raw data 나머지** | ❌ deferred — DarkStar (SupermassivePercentBonus 0.85→0.70, PercentHealth 0.30→0.25, 4 effects vs (6) tier 검증 필요) / DRX (NOVA 챔프별 분기 = sim 코드 hardcoded) / Stargazer (정확한 필드 매핑 verify 필요) + 15 champion 미작성 entity | **sequence B 후속 PR** |
| **sim 코드** (`combatLoop.ts` trait helpers + ability config) | ⚠️ **자동 반영 + hardcoded 잔존**. raw json 갱신만으로 자동 sim 반영: Shen passive damage / Zed-Shen mana / Sniper amp / Challenger AS ✅ (4건). **sequence C 적용 완료**: ✅ JaxCarry damage (PR #164) / ✅ Galio selfBuff.durability star별 read + OOR durability 분기 fix (PR #165) / ✅ NOVA Akali Bleed + Kindred damageAmp + Mark Timer (PR #166) / ✅ SpaceGroove EffectBonus helper 통합 (PR #167) / ✅ Stargazer Mountain AS/DR 너프 (PR #169 sequence C-5d) / ✅ **Stargazer Serpent ★1 Poison 너프 (C-5b, 본 PR)** — raw json 만 변경 (sim helper `applyStargazerEffects` Serpent 분기가 raw `Serpent_Poison` 직접 read 라 자동 반영). 별도 hardcoded 갱신 필요: Jax selfBuff.durability (raw FlatDR 단위 변환 필요) / Stargazer Fountain/Huntress 필드 매핑 / NOVA Aatrox shredPct (raw 매핑 verify 필요) | **sequence C** (6/8 + 잔존 → 약 75% 진행, C-5 sub 5건 중 2건 완료) — helper 코드 hardcoded 갱신 + 테스트 회귀 |
| **Arbiter 시스템** | ❌ 17.3 의 입력/출력 구조 | **sequence D** — 3 카테고리 (일관성/조건부/경제) 개편 |
| **Psionic 아이템** | ❌ 17.3 stats | sequence D 일부 |
| **위키 페이지** (champion / mechanic) | ✅ **sequence A 완료** (PR #162) — 17.4 fact 명시 + frontmatter `current_patch_status: active (17.3 LIVE, 17.4 patch pending)` + 본문 패치 히스토리 row | PR #162 |

→ 본 페이지 작성 후 후속 PR sequence (B → C → D) 에서 sim 정합 회복.

## System 변경

### Arbiter 대규모 개편

입력/출력을 **세 가지 카테고리** 로 재구성:
- (1) **일관성** (Consistency) — 항상 보장
- (2) **조건부** (Conditional) — 상황 의존
- (3) **경제 기반** (Economy) — 골드/재료 의존

각 카테고리에서 하나씩 보장 제공 → 17.3 의 "운빨" 의존 줄이고 안정적 input/output 풀 형성.

**sim 영향**: `arbiter_laws.json` 구조 변경 + augment system 의 arbiter 분기 코드 영향. PR sequence D 큰 작업.

### Psionic 아이템 일반화

Psionic(2) / Psionic(4) 아이템들의 **스탯이 더욱 일반적으로** 변경 → 다양한 챔피언에서 사용 가능. 17.3 의 초능력 unit 전용 → 17.4 generic stats 로 완화.

## Trait 변경

| Trait | 변경 (17.3 → 17.4) | sim 영향 영역 |
|-------|--------------------|----------------|
| **챌린저** | 공속 `15/22/40/55%` → **`15/28/42/55%`** | `combatLoop.ts` 챌린저 burstEndTick / burstPercent helper |
| **다크스타 (6)** | 보너스 `85%` → **`70%`**, 미니 블랙홀 HP `30%` → **`25%`** | `combatLoop.ts:2041` 6 챔프 그룹 + Black Hole damage 분기 |
| **N.O.V.A. (5)** | Aatrox `50%` → **`65%`** (raw spec 매핑 verify 필요 — 별도 PR), Akali Bleed Damage `10/14/18 AD` → **`12/18/24 AD`** ✅, **Kindred Damage Amp `5%` → `10%`** ✅, **Kindred Mark Timer `5s` → `4.5s`** ✅ | ✅ **PR #166 sequence C-3 적용 완료** — `tickDrxNova` 의 Akali Bleed 배열 + Kindred damageAmp + `tickKindredNovaMark` periodTicks 갱신. Aatrox shredPct 는 raw `ShredAndSunder` (현재 0.30) 매핑 불명확 (Codex 정정 fact "50→65%" 와 raw 0.30 차이) — 별도 verify 후 raw json 갱신 (sequence B 후속) |
| **스나이퍼** | damage amp `18/24/28%` → **`18/25/35%`** | `sniperBaseDA` / `sniperPerHexDA` state field (combatLoop.ts:3866-3867) |
| **스페이스 그루브 (7)** | 보너스 `10%` → **`15%`** | ✅ **PR #167 sequence C-4 sim 적용 완료** — `applySpaceGrooveBuffs` (`combatLoop.ts:1720-1738`) 에 EffectBonus 곱셈 통합. `boostedAdapPerSec = adapPerSec × (1 + EffectBonus/100)` 적용 (tier 7 EffectBonus=15 → 5 × 1.15 = 5.75 매초 ADAP 가산). raw json 변경 (PR #163 sequence B) + helper 통합 (본 PR) 으로 17.4 sim 적용 |
| **스타게이저** | **Mountain 변종** AS `10%` → **`8%`** + DR `6%` → **`5%`** ✅, **Serpent 변종** Damage (3) tier `25%` → **`20%`** ✅, Fountain Healing `2.5%` → **`3%`** (C-5a 대기), Fountain (5) ADAP `7%` → **`9%`** (C-5e 대기), Huntress Teamwide AS `15%` → **`12%`** + Stargazer AS `12/35/55` → **`15/45/70`** + Mark `3/5/7` → **`3/5/9`** (C-5c 대기) | [[stargazer-fountain]] + `applyStargazerEffects` Mountain/Serpent 분기 (`combatLoop.ts:3220-3340`) ✅ — Fountain/Huntress 영역 별도 |

## Champion 변경 (18건)

### Tier 1
| 챔프 | 변경 | 영향 페이지 | sim 영향 |
|------|------|-------------|----------|
| Aatrox | 힐 `300/375/575 AP` → **`325/400/650 AP`** | [[aatrox-carry]] cross-ref (base 미작성) | ability.variables `Heal` 값 갱신 |
| Twisted Fate | 최소 데미지 `180/270/405/690 AP` → **`190/285/430/730`**, 최대 `360/540/810/1380` → **`380/570/860/1460`** | (base 미작성) | ✅ **17.3 너프 revert (buff)** — 17.3 에서 한 너프 (380/570/860/1460 → 360/540/810/1380) 를 17.4 에서 reverted (이전 값 복귀). **17.4 = 17.3 patch wiki 의 Twisted Fate row 와 1:1 revert 관계** (PR #162 codex P1 catch — 이전 방향 오기 정정) |

### Tier 2
| 챔프 | 변경 | 영향 페이지 | sim 영향 |
|------|------|-------------|----------|
| **Bel'Veth** | 스펠 데미지 AD `18/27/41/69` → **`20/30/45/77`** (17.3 너프 reverted) | (base 미작성) | ability.variables 갱신 |
| Gnar | 기본 공속 `0.7` → **`0.75`** | (base 미작성) | champion stats AS 갱신 |
| Gwen | 방어력 `45` → **`50`**, 단일 대상 데미지 `145/220/380/650 AP` → **`145/220/410/700 AP`** | (base 미작성) | champion stats armor + ability variables |
| **Jax** | 평탄 DR `15/20/25 AP` → **`20/25/30`** (**AP 스케일링 제거**) | [[jax]] / [[jax-carry]] | ⚠️ scaling 자체 제거 — sim 분기 구조 영향 (단순 계수 변경 아님) |
| Zoe | 스펠 데미지 `68/102/153% AP` → **`73/110/180 AP`** | (base 미작성) | ability.variables 갱신 |

### Tier 3
| 챔프 | 변경 | 영향 페이지 | sim 영향 |
|------|------|-------------|----------|
| Aurora | 분할 데미지 `370/555/890 AP` → **`400/600/960 AP`** | (base 미작성) | ability.variables 갱신 |
| Lulu | 산악 스펠 스턴 `0.5초` → **`0.25초`** | (base 미작성) | ability.ts stun 값 갱신 |
| MissFortune (복제) | 스펠 데미지 `250/375/600 AD` → **`275/415/660 AD`** | (base 미작성) | ability.variables 갱신 |
| Ornn | 기본 체력 `850` → **`950`** | (base 미작성) | champion stats hp 갱신 |
| Rhaast | 리디머 공속 `2/2.5/3%` → **`2/2/2%`**, 보너스 방어력 `2/2.5/3` → **`2/2/2`** | (base 미작성) | 너프 (star scaling 평탄화) |
| Viktor | 스펠 데미지 `185/275/475 AP` → **`190/290/500 AP`** | (base 미작성) | ability.variables 갱신 |

### Tier 4
| 챔프 | 변경 | 영향 페이지 | sim 영향 |
|------|------|-------------|----------|
| Corki | 미사일 데미지 `30/44% AD` → **`28/42%`**, 미플 로켓 `120/180% AD` → **`110/165% AD`** | (base 미작성) | ability.variables 너프 |
| Morgana | 사거리 `2` → **`1`** (!), 쉴드 HP 스칼라 `10%` → **`15%`** | (base 미작성) | ⚠️ **range 변경** — sim 타게팅 시스템 영향 (melee 변경) |
| Nami | 마나 `25/70` → **`20/65`** | (base 미작성) | champion stats mana 갱신 |
| Xayah | 기본 AD `50` → **`52`**, 스펠 메인 대상 데미지 `10/15% AD` → **`25/40% AD`** (대규모 buff) | (base 미작성) | champion stats + ability.variables 모두 |

### Tier 5
| 챔프 | 변경 | 영향 페이지 | sim 영향 |
|------|------|-------------|----------|
| Fiora | 스펠 진정한 데미지 `40/60 AD` → **`37/56 AD`** | (base 미작성) | ability.variables 너프 |
| Graves | 기본 공속 `0.7` → **`0.75`**, 레이저 탄도학 감소 `40%` → **`60%`** | (base 미작성) | champion stats AS + ability.variables |
| **Shen** | 마나 `10/70` → **`20/70`**, 스펠 데미지 `BonusDamageOnAttack 20/30 AP` → **`25/40 AP`** | [[shen]] | champion stats mana + ability.variables (17.3 너프 부분 revert) |
| **Zed** | 클론 체력 `33/40%` → **`33/45%`**, 마나 `50/100` → **`40/100`** | [[zed]] / [[invader-zed]] | ⚠️ **applyZedShadow** trait helper 영향 (분신 alive 가정 BonusAD 0.40 단순화) — sim 단순화 모델 재검토 필요 |

## 영향 페이지 cross-ref

본 PR (sequence A) 에서 **위키 페이지 17.4 fact 명시** 만 수행:

- [[zed]] — 17.4 클론 HP/마나 변경 추가 + frontmatter `current_patch_status: active (17.3 LIVE, 17.4 pending)` + 본문 패치 히스토리 row 추가
- [[shen]] — 17.4 마나 + spell damage 변경 추가 (17.3 nerf 부분 revert)
- [[jax]] — 17.4 평탄 DR AP 스케일링 제거 변경 추가 (sim 분기 구조 영향)
- [[invader-zed]] — Zed base 변경의 carry augment 영향 cross-ref
- [[jax-carry]] — Jax base 변경의 carry augment 영향 cross-ref
- [[stargazer-fountain]] — 17.4 stargazer heal 2.5%→3% trait 변경 cross-ref

## 17.4 ↔ 17.3 revert 관계

PR #162 codex P1 catch — Twisted Fate 방향 정정 + 일관성 회복:

- **Twisted Fate**: 17.3 너프 (380/570/860/1460 → 360/540/810/1380) → 17.4 **reverted (buff)** — 17.3 값 (380/570/860/1460) 복귀. patch wiki 의 17.3 row 와 17.4 row 가 1:1 revert 관계
- **Bel'Veth**: 17.3 너프 (20/30/45/77 → 18/27/41/69 — 추정) → 17.4 reverted (20/30/45/77 복귀, esports.gg 공식 표기)
- **Shen**: 17.3 너프 (BonusDamageOnAttack 45/75 → 20/30) → 17.4 partial revert (20/30 → 25/40)

## 17.4 augment 변경 (추가 — PR #162 codex P1 catch)

| Augment | 변경 | 영향 페이지 | sim 영향 |
|---------|------|-------------|----------|
| **Reach for the Stars (JaxCarry)** | damage `170/250/450` → **`160/240/420`** 너프 | [[jax-carry]] | ✅ **PR #164 sequence C sim 적용 완료** — `carryAugments.ts:209` damage 갱신 + test assertion update. **실 sim damage 감소 적용** — JaxCarry 전용 cast damage 분기 (`combatLoop.ts:6879-6899` main + `:7212-7240` OOR, PR #140 + #147) 가 `carryCfg.abilityData.damage` 를 cast target 에 적용 (PR #164 Codex P2 catch 후 정확화) |

## Lint 체크리스트 (mechanic entity-type)

- [x] **set17 entity 소속 0단계** — Champion 18건 + Trait 6건 모두 set17 (raw json 검증은 sequence B 단계)
- [x] **공식 patch notes URL 인용** (sources frontmatter) — 룰 #14 mechanic page sync 의 도메인 fact 출처
- [x] **17.4 ↔ 17.3 patch wiki cross-ref** — Twisted Fate / Bel'Veth / Shen 의 nerf/revert 관계 명시
- [x] **본 patch 페이지가 권위 출처** — entity summary 표 (champion 18건 / trait 6건) → entity 페이지 / 코드 ground truth cross-check 룰 #13 적용 필요는 sequence B (raw data 갱신 후)
- [x] **sim 미반영 명시** — frontmatter `last_verified` 에 "raw data 17.3 기준, 17.4 미반영" + 본문 ⚠️ sim 적용 상태 표
- [x] **mechanic page sync (룰 #14)** — 본 patch wiki 자체가 mechanic 영역의 권위 출처. 영향 영역 trait helper (챌린저/다크스타/N.O.V.A./스나이퍼/스페이스 그루브/스타게이저) sim helper 위치 + 영향 페이지 cross-ref 명시
- [x] **룰 #17 적용 분기 명시** — DarkStar/SpaceGroove/Sniper/Stargazer trait 은 **(d) combat-start helper** (applyXxxEffects 양 팀 호출). **예외**: N.O.V.A. (`tickDrxNova` PR #121) = **(d) combat-start setup + (c) cast-time/per-tick trigger 혼합** — `setupDrxNova` combat-start 값 로드 + `tickDrxNova` per-tick `delayTicks` 도달 시 효과 발동. **챌린저** burstPercent 도 동일 패턴 — combat-start `challengerBurstEndTick` SET + per-tick burst TRIGGER. 단순 (d) 일반화 금지 (PR #162 subagent self-catch P1-4 학습)
- [ ] (sequence B 후) raw data 갱신 확인 + 본 페이지 sim 영향 column update
- [ ] (sequence C 후) sim 코드 trait helper 값 갱신 후 frontmatter `last_verified` update

## 관련

- [[patch-17-3]] — 이전 패치 (17.3 → 17.4 변경 base)
- [[patch-17-2b]] — 17.2b 변경 누적 (Aatrox cycle / spiritBounce 등)
- [[stargazer-fountain]] — 17.4 stargazer heal 변경 cross-ref
- 코드: `src/lib/simulator/engine/combatLoop.ts` (trait helpers — sequence C 영향) / `src/data/carryAugments.ts` / `src/lib/simulator/systems/ability.ts`
- Raw: `public/data/tft_set17_*.json` (sequence B 갱신 대기)
