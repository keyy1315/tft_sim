---
name: TFT Domain Wiki — Index
purpose: 위키 전체 페이지 카탈로그 (content-oriented)
updated: 2026-05-18
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

_미작성_

## Raw Sources (Layer 1)

- `raw/lolchess/` — lolchess.gg 추출 (Stargazer / Factory New / Yasuo Tiles 등)
- `raw/in-game/` — 인게임 직접 측정 (Hero Augments 등)
- 카탈로그: `raw/README.md`

---

## 작성 우선순위 (다음 후보)

위키화 가치 높은 순:
1. **augments 개별 페이지** — `LeonaCarry`, `GragasCarry`, `PykeCarry` 등 [[hero-augment-carry]] 의 entry 별 세부
2. **챔피언별** — Annie, Galio, Shen, Yasuo (이미 plan 문서 존재)
3. **Poppy/Nasus 인게임 verify 후 statOverrides 적용** (Lint #5 잔존 TODO — 사용자 측정 필요)
4. **`mechanics/ability-pattern-internals`** — `findAbilityTargets` 9 패턴 알고리즘 깊이 (line/bounce 알고리즘 디테일, getHexesInLine/Cone 헬퍼)
5. **`patches/patch-17-1`** — Set 17 출시 시점 (더 thin, 도메인 가치 낮음)
