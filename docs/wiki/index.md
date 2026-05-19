---
name: TFT Domain Wiki — Index
purpose: 위키 전체 페이지 카탈로그 (content-oriented)
updated: 2026-05-19
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

- [[patch-17-3]] — 2026-05-13 LIVE. **공식 패치노트 정상화 후 종합 ingest** (System/Traits/27 챔프/5 신규 aug/15+ 조정 aug/items/bug fixes). Morgana 4코 리워크, Stargazer Fountain 재활성화 + (3)/(5) 4%/7% 확정, carry augment sim drift 5건
- [[patch-17-2b]] — 2026-04-29 mid-patch. Hero Augment carry 시스템 sim 정식화 + 군체의 심장 disabled (17.3 로 부분 obsoleted)
- [[patch-17-2]] — Set 17 메이저 패치. carry augment 3종 (Heat Death/Self-Destruct/Shieldmaiden) **게임 도입** + Stargazer Fountain 첫 비활성화. 17.2b/17.3 로 다수 항목 superseded

## Champions

_미작성_

## Items

_미작성_

## Augments

- [[leona-carry]] (방패 여전사) — 17.2 도입, 3회 연속 변경. ✅ Lint #6 resolved (PR #127) + ✅ Lint #9 resolved (PR #129): starLevel별 stun [1.0/1.25/1.5] sim 적용 (main + OOR cast path 양쪽)
- [[mordekaiser-carry]] (뜨거운 죽음) — 17.2 도입, 3회 연속 변경. ✅ Lint #7 resolved (PR #124 source drift fix). Mordekaiser passive 매초 오라 N 확장 sim 미반영
- [[gragas-carry]] (자폭) — 17.2 도입. ✅ Lint #8 resolved (PR #127) — 적군 AOE 반경 3칸 정상 작동 (이전 무력화)
- [[aatrox-carry]] (별빛 연계) — 17.2 도입. 가장 복잡 carry — 3-skill cycle + N.O.V.A. + isolation. 17.3 변경 3건 sim 정합
- [[pyke-carry]] (청부 살인마) — 17.2 도입. x_shape + onKillRecast cascade. ⚠️ Lint #10 (PR #131 검출): hero-augment-carry 의 "onKill hook 미구현" stale (실제 구현 완료, wiki cleanup 후보)
- [[jax-carry]] (저 별을 향해) — self_buff + onAttackBonus passive + **asGain starLevel별 정합** (PR #136 Lint #11-B ✅) + **cast damage target magic 적용** (PR #140 Lint #11-A ✅). cast path 3종 (main + OOR) + selected single-carry 가드
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
5. **챔피언별** — Annie, Galio, Shen, Yasuo (이미 plan 문서 존재)
6. **Poppy/Nasus 인게임 verify 후 statOverrides 적용** (Lint #5 잔존 TODO — 사용자 측정 필요)
7. **integration test** — LeonaCarry / GragasCarry / AatroxCarry sim 통합 (cycle counter / 적군 AOE / starLevel별 stun 등)
8. **OOR cast path 의 cycle/x_shape 일관성 verify** — Aatrox/Pyke 페이지의 follow-up verify 항목 (PR #129 stun 같은 패턴 가능성)
