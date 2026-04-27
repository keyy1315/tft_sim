# Stargazer System — Session Handoff (2026-04-27)

> **이 문서의 용도**: 새 세션에서 별돌보미 trait 시스템 구현 작업을 이어받을 수 있도록 현재
> 상태와 다음 결정을 정리. 새 세션은 이 파일만 읽으면 이어서 실행 가능.

## 어디서 작업 중?

- **메인 브랜치**: `dev` (= `99ea6f9` / PR #16 머지 직후)
- **현재 작업 디렉토리**: `/Users/kim/cursorProjects/tft_sim`
- **상태**: 깨끗 (`git status -sb` → `## dev`)

## 머지된 PR (별돌보미 trait 시스템)

| # | 제목 | 핵심 |
|---|------|------|
| #13 | PR-1 — 별자리 데이터/UI 입력 | schema enum + 매핑 헬퍼 + GameMetaEditor dropdown |
| #14 | PR-2 — Mountain 변종 + emblem 매핑 (Stargazer 1종) | resolveTraits constellation 분기 + Mountain effects + AP 단위 fix + StatIncrease |
| #15 | PR-A — emblem 19종 매핑 + resolvedTraits 합산 | Set 17 모든 emblem trait 카운트 + per-unit trait 멤버십 일관 |
| #16 | PR-3 — 7 변종 강화 칸 패턴 + 6 변종 effects | TILE_PATTERN + Wolf/Medallion/Huntress/Serpent/Shield/Fountain effects + enemy mirror |

## 양 게임 baseline (N=10, dev=99ea6f9 시점)

| | 23일 (`game-20260423-001`) | 24일 (`game-20260424-001`) |
|---|---|---|
| 별자리 | mountain | well |
| pvpRoundCount | 22 | 21 |
| **winnerMatchRate** | 40.9% | 76.2% |
| **avgPlayerDamageErrorPct** | -43.8% | -15.2% |
| avgSurvivorHpErrorPts | ~7.7 | 2.36 |
| weakSignalRoundCount | 0 | 2 |

`actual-data/diff-game-*.json` 가 git 에 commit 돼있어 회귀 직접 관찰 가능 (`git diff` 로).

## PR-4 후보 (복잡 메커니즘 — 사용자 선택 대기)

별돌보미 변종의 statusEffect / event-driven 효과 — 단순 stat 가산 외:

| 옵션 | 후보 | 영향 게임 | 사이즈 |
|---|---|---|---|
| **A** | Fountain 스킬 힐 (`Fountain_HealPercent`) | 24일 직접 | 작음 |
| **B** | Huntress 표식 + Serpent 중독 (statusEffect 시스템) | 양 게임 잠재 | 중간 |
| **C** | Shield cashout (사망 카운트 → 강화 칸 별돌보미 buff) | (현재 게임 영향 적음) | 중간 |
| **D** | Mountain emblem 누적 (RoundsPerEmblem) | 23일 잠재 | 작음 |
| **E** | 강화 칸 player level 점진 추가 (revealedTiles) | 양 게임 정확도 | 중간 |
| **F** | 통합 PR (A+B+C+D+E 한 번에) | 측정 베이스 한 번에 | 크게 |

**추천 순서**: A (Fountain — 24일 직접 영향, 단일 메커니즘) → B → C → D → E.

## 다음 세션 시작 가이드

### 0. 환경 확인
```bash
cd /Users/kim/cursorProjects/tft_sim
git status            # 깨끗 (## dev)
git log --oneline -5  # 최근 5 커밋 — PR #16 머지 (99ea6f9) 가 head
pnpm install          # node_modules 동기화
pnpm test --run       # baseline 306 pass 확인
```

### 1. PR-4 시작 결정
- 사용자에게 옵션 (A~F) 중 선택 받기
- 옵션 A (Fountain) 추천 — 작고 측정 가능

### 2. 작업 패턴 (이전 세션 표준)
1. 새 feature 브랜치 (`feature/stargazer-...`)
2. 데이터 + 코드 + 단위 테스트
3. 4-게이트 (`pnpm lint && pnpm typecheck && pnpm test --run && pnpm build`)
4. 양 게임 캐시 재실행 (`DIFF_GAME_ID=... pnpm test tests/calibration/compute-diff-cache.test.ts --run`)
5. 커밋 + PR open (base=dev, codex review 자동 트리거)
6. codex P1/P2 review 처리 → 답글 (한글, `@chatgpt-codex-connector` 멘션)
7. 머지 후 로컬 정리 (`git checkout dev && pull && fetch --prune && branch -D ...`)

### 3. 핵심 파일 / 모듈
- `src/lib/simulator/engine/combatLoop.ts:applyStargazerEffects` — 별돌보미 effect 적용 진입점
- `src/lib/simulator/systems/trait.ts` — `resolveTraits` + `EMBLEM_ITEM_TO_TRAIT_NAME` + `getEmblemTraitNames`
- `src/lib/actualData/stargazerMapping.ts` — `CONSTELLATION_TILE_PATTERN` + `isOnEmpoweredTile`
- `tests/unit/simulator/stargazer-*.test.ts` — 회귀 가드 패턴
- `actual-data/game-20260423-001.json` (mountain), `game-20260424-001.json` (well)

### 4. 좌표 시스템 reminder
- BOARD = 4 row × 7 col (player half), 8 rows total (0~7) — enemy mirror 시 r=4..7
- `q = col - floor(r/2), r = row` (axial)
- `mirrorPosition(p)`: r → 7-r, q 보존하며 재계산
- `r >= 4` 일 때 enemy mirror — `applyStargazerEffects` 의 `isOnTile` 이 자동 환원

### 5. statusEffect 시스템 (PR-4 B/C 시 사용)
- `unit.statusEffects: StatusEffect[]`
- 종류: `stun`, `slow`, `burn`, `disarm`, `taunt`, `shield` 등
- `tickStatusEffects` 가 매 tick 처리
- 새 종류 추가 시 `StatusEffectType` union 확장 필요

## 새 세션 프롬프트 (한 줄)

> docs/superpowers/plans/2026-04-27-stargazer-system-handoff.md 읽고 PR-4 시작.
> 옵션 A~F 중 어디로 갈지 사용자에게 물어보고 진행.

## 참고

- **CC Pull Request 흐름**: codex review 가 자동 달림. P1/P2 우선순위. 답글 시 `@chatgpt-codex-connector` 멘션 + 한글
- **CLAUDE.md 엄수**: `eslint-disable` / `console.log` (calibration 외) / `any` 금지
- **caching harness**: `tests/calibration/compute-diff-cache.test.ts` — `DIFF_GAME_ID` env 로 다른 게임 적용 가능
