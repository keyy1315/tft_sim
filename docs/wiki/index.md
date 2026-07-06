---
name: TFT Domain Wiki — Index
purpose: 위키 전체 페이지 카탈로그 (content-oriented)
updated: 2026-05-21 (PR #151 mordekaiser.md)
---

# TFT Domain Wiki — Index

> 위키 구조·워크플로우는 [[schema]] 참조. 변경 기록은 [[log]]. Raw source 카탈로그는 `raw/README.md` 참조.

## Traits (시너지)

- [[stargazer]] — 별돌보미. 게임당 별자리 1개 고정. 강화 칸 시스템

## Mechanics

- [[stargazer-fountain]] — 별돌보미 우물 별자리. 17.2 inactive → 17.3 LIVE active
- [[hero-augment-carry]] — 영웅 증강 활성 시 챔프 role + stat + ability 변환. 17.2b 도입, 10 augments configured
- [[role-passive]] — 6 Role 별 마나/타게팅/AS 자동 분기. mana.ts + targeting.ts 통합. CLAUDE.md vs 코드 stale 3건 검출
- [[ability-targeting]] — 9 패턴 기반 적중 hex 집합 결정. `findAbilityTargets` + `AbilityConfig.pattern`. dead code triad 검출 + PR #117/#119 로 정리 완결
- [[spell-crit]] — 스킬 치명타 활성 조건 (보건/무대 + 운명술사 Innate + Akali/Graves effect) + 3 레이어 적용 (engine / DPS / recommender)

## Patches

- [[patch-17-6]] — 2026-06-24 LIVE. 소규모 패치 + **대규모 augment 패스**(lobby shape 의존도 완화). 저활용 챔프 버프(TwistedFate/Viktor/Mordekaiser/Karma/LeBlanc/Morgana/Shen) + Gnar AD·Meeple(7) 너프(리롤 견제) + Blood Offering AP 일반화/Expedition·Birthday Reunion·Self-Destruct 너프. 3주 패치(17.7=07-15). ⚠️ **raw data/sim = 17.4 partial 미반영** — 17.6 raw 갱신 작업 예정, calibration(17.1/17.3) 재기준 필요
- [[patch-17-5]] — 2026-06-10 LIVE (+ 17.5b mid-patch). econ augment 너프 + 저활용 챔프 버프(Bard/Veigar/Fizz/Caitlyn/Mordekaiser) + Meeple/Rammus 너프. ⚠️ **raw data/sim = 17.4 partial 미반영**, calibration 게임(17.1/17.3) 정렬상 17.5b raw 갱신 신중. 이번 세션 sim-fix 챔프(Bard/Ezreal/Rammus 등) 수치 delta source
- [[patch-17-4]] — 2026-05-27 LIVE. Bel'Veth 너프 revert + Arbiter 대규모 개편 + Sniper/Psionic 일관성. raw data 는 sequence B(Zed/Shen/Jax) 1차만 17.4, 나머지 17.3 기준
- [[patch-17-3]] — 2026-05-13 LIVE. **공식 패치노트 정상화 후 종합 ingest** (System/Traits/27 챔프/5 신규 aug/15+ 조정 aug/items/bug fixes). Morgana 4코 리워크, Stargazer Fountain 재활성화 + (3)/(5) 4%/7% 확정, carry augment sim drift 5건
- [[patch-17-2b]] — 2026-04-29 mid-patch. Hero Augment carry 시스템 sim 정식화 + 군체의 심장 disabled (17.3 로 부분 obsoleted)
- [[patch-17-2]] — Set 17 메이저 패치. carry augment 3종 (Heat Death/Self-Destruct/Shieldmaiden) **게임 도입** + Stargazer Fountain 첫 비활성화. 17.2b/17.3 로 다수 항목 superseded

## Champions

- [[shen]] (쉔) — 5코스트 Fighter (raw `APFighter`, sim mapGameRole → Fighter), 보루 + 요새 trait. cast 마다 `shenPassiveStack++` 누적 + 평타 시 stack × BonusDamage 추가 (3+ true damage). 17.3 nerf (45/75 → 20/30) + maxHp/ShieldHP buff 정합
- [[jax]] (잭스) — 2코스트 Tank (raw `APTank` → sim Tank), 별돌보미 + 요새. base raw "별의 반격" 3초 방어 태세 + AOE+stun. ⚠️ JaxCarry augment 활성 시 role=Fighter 로 변환 (augment 가 role 자체 변경, [[shen]] 과 다른 패턴). base 의 ShieldAP/FlatDR/StunDuration starLevel별 미반영 5건 lint 후보 검출
- [[nasus]] (나서스) — 1코스트 Tank (raw `APTank` → sim Tank, [[jax]] 와 동일 매핑), 우주 그루브 + 선봉대. base raw "두둠칫 수잔" 6초 변신 + 인접 매초 magic DOT. ⚠️ NasusCarry augment 활성 시 role=Fighter + `nasusBonkStack × bonusPerKill[★]` cast kill 누적 (PR #135 Layer 1 selected 가드). base 의 MaxHealth/DamageHealth/Space Groove `TheGroove` 상태 미반영 4건 lint 후보 검출. Lint #5 잔존 (Bonk! Resists 40→45 base vs augment grant 미verify)
- [[mordekaiser]] (모데카이저) — 2코스트 Tank (raw `APTank` → sim Tank), 암흑의 별 + 전달자 + 선봉대. base raw "불멸" InitialShield + 4초 매초 펄스 (본인 shield + 1칸 적 magic) + 만료 시 잔여 × 40% healRefund. ⭐ **가장 정합 base sim** — helper 통합 (`applyMordekaiserProcCast` + `tickMordekaiserProc`) + 별도 shield pool (`mordekaiserShieldRemaining`) + main/OOR cast parity + 전용 test. ⚠️ MordekaiserCarry 시 `mordekaiserCarryShield` carry data 우선 read (PR #124 lint #7 해소). 미반영 1건 (M1 `AugmentedDuration` Concentration augment 6초 확장)

## Items

_미작성_

## Augments

- [[leona-carry]] (방패 여전사) — 17.2 도입, 3회 연속 변경. ✅ Lint #6 resolved (PR #127) + ✅ Lint #9 resolved (PR #129): starLevel별 stun [1.0/1.25/1.5] sim 적용 (main + OOR cast path 양쪽)
- [[mordekaiser-carry]] (뜨거운 죽음) — 17.2 도입, 3회 연속 변경. ✅ Lint #7 resolved (PR #124 source drift fix). Mordekaiser passive 매초 오라 N 확장 sim 미반영
- [[gragas-carry]] (자폭) — 17.2 도입. ✅ Lint #8 resolved (PR #127) — 적군 AOE 반경 3칸 정상 작동 (이전 무력화)
- [[aatrox-carry]] (별빛 연계) — 17.2 도입. 가장 복잡 carry — 3-skill cycle + N.O.V.A. + isolation. 17.3 변경 3건 sim 정합
- [[pyke-carry]] (청부 살인마) — 17.2 도입. x_shape + onKillRecast cascade. ⚠️ Lint #10 (PR #131 검출): hero-augment-carry 의 "onKill hook 미구현" stale (실제 구현 완료, wiki cleanup 후보)
- [[jax-carry]] (저 별을 향해) — self_buff + onAttackBonus passive + **asGain starLevel별 정합** (PR #136 Lint #11-B ✅) + **cast damage target magic 적용** (PR #140 Lint #11-A ✅). cast path 3종 (main + OOR) + selected single-carry 가드 (PR #144 일반화)

## Lint #14 ✅ resolved (PR #144 + #145)

selected-carry-augment 일반화 foundation + 광범위 selected 가드 적용 — 7 sub-lint (14-A~G: Aatrox cycle / Pyke recast / Poppy bounce / Ivern hexReduction / Mord proc / Leona-Gragas abilityOverride pollution) 모두 동시 해소. 회귀 가드 test 4 case 추가 (전체 20/20).
- [[nasus-carry]] (꽁!) — single 패턴 AD physical + **bonusPerKill cast kill 누적** (PR #135 Lint #12 ✅ resolved). Lint #5 잔존 (Resists 40→45 인게임 verify)
- [[invader-zed]] (침략자 제드) — stage 4-2 special. ⚠️ Lint #13 (selfBuff 필드 부재 + damage 미반영으로 sim 효과 사실상 0 — role='Fighter' + mana 50/100 변경뿐)
- [[poppy-carry]] (정령단 속도) — ranged projectile (rangeOverride 4) + armorScale 1.0 + spiritBounceOnKill (max 50 chain) + Set 17 Poppy passive 별도 작동. 신규 lint 없음 — 가장 많은 메커니즘 sim 통합 완성도 carry. Lint #5 잔존 (AS 0.7→0.75 인게임 verify)
- [[ivern-minion-carry]] (빅뱅) — gold tier. dash to_largest_cluster (cluster radius 2 hex 알고리즘) + aoe_circle r=3 + hexReduction 0.35 (17.3 nerf 완화) + multi-stun 3 nearest + onAttackBonus passive. helper 통합 (applyCarryDamageModifiers / applyCarryPostCastEffects) 덕분에 main+OOR cast path 양쪽 일관 — 신규 lint 0건

## Raw Sources (Layer 1)

- `raw/lolchess/` — lolchess.gg 추출 (Stargazer / Factory New / Yasuo Tiles 등)
- `raw/in-game/` — 인게임 직접 측정 (Hero Augments 등)
- 카탈로그: `raw/README.md`

---

## 작성 우선순위 (다음 후보)

위키화 가치 높은 순:
1. **augments 완료** — 10 carry augments 전체 위키화 완료 (Leona/Mord/Gragas/Aatrox/Pyke/Jax/Nasus/Zed/Poppy/Ivern). 신규 작업 → sim 해소 또는 champion 페이지로 이동
2. **Lint #11-A/B (Jax) + #12 (Nasus) + #13 (Zed) sim 해소** — sim fix PR (필드 read 추가 vs 필드 dead 정리)
3. **flag 자체 dead 정리** (`gragasCarryActive` / `leonaCarryActive`) — sim 코드 사용처 0, 테스트 assertion 만 (Lint #6/#8 후속)
4. **Lint #10 cleanup** — `hero-augment-carry.md` 의 "Pyke onKill 미구현" stale 정정 (PR #131 에서 부분 정정, 후속 PR 로 더 깊이)
5. **챔피언별** (set17 한정 — `public/data/tft_set17_champions.json` `TFT17_` prefix entries 로 ground truth 확인 필수, **한글 이름이 아닌 apiName 으로**) — Shen ✅ / Jax ✅ / Nasus ✅ / Mordekaiser ✅ / 다음: Zed (Lint #13 spec 대기), Poppy (Lint #5 측정 대기), Galio (4코 메카 거대 메크 로봇 — 신규 plan 필요), 블리츠크랭크 (5코 우주 그루브 carry). ⚠️ Annie/Yasuo plan 파일은 이전 set 작업물 — set17 챔피언 아님 (2026-05-21 정정). ✅ **TFT17_Galio = 거대 메크 로봇 (4코 메카+여행자)** 으로 set17 챔피언 맞음 (codex PR #149 P2 정정) — 단 `galio-hero.plan.md` (5코 hero) 는 이전 set 작업물이라 직접 매핑 불가, 신규 plan 또는 raw 기반 ingest 필요
6. **Poppy/Nasus 인게임 verify 후 statOverrides 적용** (Lint #5 잔존 TODO — 사용자 측정 필요)
7. **integration test** — LeonaCarry / GragasCarry / AatroxCarry sim 통합 (cycle counter / 적군 AOE / starLevel별 stun 등)
8. **OOR cast path 의 cycle/x_shape 일관성 verify** — Aatrox/Pyke 페이지의 follow-up verify 항목 (PR #129 stun 같은 패턴 가능성)
