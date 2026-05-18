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
- [[ability-targeting]] — 9 패턴 기반 적중 hex 집합 결정. `findAbilityTargets` + `AbilityConfig.pattern`. dead code triad 검출

## Patches

- [[patch-17-3]] — 2026-05-13 LIVE. Stargazer Fountain 재활성화 등
- [[patch-17-2b]] — 2026-04-29 mid-patch. Hero Augment carry 시스템 도입 + 군체의 심장 disabled (17.3 로 부분 obsoleted)

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
1. **`patches/patch-17-2`** — Fountain inactive 시기 컨텍스트 (17.2b 부모 패치)
2. **`mechanics/spell-crit`** — 현재 PDCA 진행 중 feature
3. **dead code 클린업 PR** — [[ability-targeting]] 가 검출한 `findAbilityTarget` / `AbilityTargetingType` / `Ability.targeting` 제거 또는 `@deprecated` 표시 (sim 정확도 아닌 코드 클린업)
4. **augments 개별 페이지** — `LeonaCarry`, `GragasCarry`, `PykeCarry` 등 [[hero-augment-carry]] 의 entry 별 세부
5. **챔피언별** — Annie, Galio, Shen, Yasuo (이미 plan 문서 존재)
