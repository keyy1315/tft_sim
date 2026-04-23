# Plan: 가상 대전 분석 개선 (기본 상대 자동 대전 + 결과 요약 + 시뮬레이터 좌표 버그)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | virtual-match-analysis |
| 작성일 | 2026-04-21 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | (1) 매치 분석 진입 시 상대를 수동으로 골라 "실행" 버튼을 눌러야만 대전이 시작됨 (2) 결과 화면이 "승리!" 한 줄 또는 취약 요인만 보여 주고 양팀 딜량·생존 유닛 같은 핵심 수치가 빠져 있음 (3) "시뮬레이터에서 열기"를 누르면 플레이어(TEAM A) 유닛이 보드에서 사라짐 |
| **Solution** | (1) 매치 분석 페이지 진입 시 "한 등수 위 상대"와 자동으로 가상 대전 실행 (2) 결과 패널에 승자 배너 + 양팀 총 딜량 + 승리팀 생존 유닛 카드 리스트 추가 (3) `reconstruction.playerTeam` 좌표(row 4-7)를 시뮬레이터 상태 규약(row 0-3)으로 역변환한 뒤 주입 |
| **Function UX Effect** | 전적검색 → 가상대전 분석 클릭 한 번으로 기본 결과를 바로 확인, 결과 화면에서 양팀 딜량 및 남은 유닛을 한눈에 비교, 시뮬레이터로 이동해도 TEAM A가 정확히 복원 |
| **Core Value** | 가상대전 분석의 "즉각성 + 정보 밀도 + 정합성" 세 축을 복구해 전적검색의 실전 활용도를 높임 |

---

## 1. 배경

전적검색 라우트 `src/app/lookup/[matchId]/analysis/page.tsx` 에서 가상 대전은 다음 흐름이다.

1. `useCombatAnalysis.checkMatch()` — coverage 체크 후 `selectedOpponent`를 "바로 윗등수"로 기본 지정 (이미 구현됨, `useCombatAnalysis.ts:108-111`).
2. 사용자가 `▶ 가상 대전 실행` 버튼을 눌러야 `runSimulation()` 호출 → `reconstructMatch()` + `simulateCombat()`.
3. 결과가 나오면 승리 시 "가상 대전 결과: 승리!" 단문, 패배 시 `DefeatReport`만 노출.
4. `시뮬레이터에서 열기` 버튼은 `reconstruction.playerTeam / enemyTeam`을 `sessionStorage`에 저장 후 `/simulator`로 이동.
5. `/simulator`는 세션스토리지 데이터를 `tm.updatePlayerTeam()` / `tm.updateEnemyTeam()`으로 주입.

### 드러난 이슈

- **자동 대전 미지원**: 기본 상대는 정해지지만 실행은 수동. 사용자가 가장 자주 보고 싶어하는 "한 등수 위 결과"를 확인하려면 매번 버튼 클릭 필요.
- **결과 정보 빈약**:
  - 상단 배너는 결과 페이지에 존재하지 않음 (시뮬레이터 페이지 전용).
  - 양팀 총 딜량, 생존 유닛 시각화 없음.
  - 승리 시에는 아무 수치도 표시되지 않음.
- **시뮬레이터 좌표 버그**:
  - `matchAdapter.heuristicPlacement()` 은 player 기준 `row 4-7` 좌표로 `PlacedChampion.position.r` 를 만든다 (`matchAdapter.ts:128`).
  - 반면 `src/hooks/useTeamManagement.ts` 의 `playerTeam`은 `row 0-3` 좌표를 저장하고 `simulator/page.tsx:147` 에서 `toEightRowCoords(tm.playerTeam, 4)` 로 전투 시 +4 매핑한다.
  - 결과: `reconstruction.playerTeam` 을 그대로 `tm.updatePlayerTeam()` 에 주입하면 `row`가 4-7로 저장되고 `SetupBoard`/렌더 루프에서 0-3 범위 외로 취급되어 TEAM A 쪽 보드에 유닛이 표시되지 않음.
  - 적팀은 `row 0-3` 좌표라 정상 표시. ⇒ "상대 팀만 보이는" 증상.

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 내용 | 우선순위 |
|----|------|---------|
| FR-01 | 매치 분석 페이지 진입 시 한 등수 위 상대 (1등이면 2등) 와 자동으로 가상 대전을 1회 실행한다 | P0 |
| FR-02 | 다른 상대를 고르면 지금처럼 수동 실행 버튼으로 재시뮬 가능해야 한다 | P0 |
| FR-03 | 대전 결과 패널에 "TEAM A 승리 / TEAM B 승리 / 무승부" 배너를 전투 시간과 함께 표시 | P0 |
| FR-04 | 양팀 총 피해량 (합계) 2칸 요약을 표시. `playerUnits`/`enemyUnits`의 `totalDamageDealt` 합산 | P0 |
| FR-05 | 승리팀의 생존 유닛(살아있는 유닛, 잔여 HP % 포함)을 ChampionCard 아이콘 리스트로 보여준다 | P0 |
| FR-06 | `시뮬레이터에서 열기` 를 눌렀을 때 TEAM A(플레이어) 유닛이 시뮬레이터 보드 하단에 정상 배치된다 | P0 |
| FR-07 | 패배 시에도 기존 DefeatReport 는 계속 제공한다 (요약 패널과 병기) | P1 |

### 2.2 비기능 요구사항

- 기존 `useCombatAnalysis` 상태 머신 (`idle → loading → ready → simulating → done`) 을 깨지 않는다.
- `simulateCombat` 엔진 수정 없이 **소비 레이어 (page, hook, adapter, simulator entry)** 에서만 처리.
- React Compiler 규칙 위반 금지: `useEffect` 내 `setState` 지양 — 자동 실행은 `checkMatch` 완료 직후 상태 전이 + 단일 effect 가드 변수로 처리.

---

## 3. 구현 방안

### 3.1 자동 대전 실행 (FR-01, FR-02)

- `useCombatAnalysis` 에 `autoRunOnReady` 인자(또는 별도 액션) 추가 금지 — 호출 측 `analysis/page.tsx` 에서 처리한다.
- `analysis/page.tsx` 의 `loadMatch()` effect 끝부분 이후, 별도의 effect 로
  ```
  if (status === 'ready' && reconstruction === null && !autoRunTriggered.current) {
    autoRunTriggered.current = true;
    runSimulation(player);
  }
  ```
  패턴으로 첫 `ready` 진입 시 1회만 자동 실행한다.
- `autoRunTriggered` 는 `useRef<boolean>(false)` — 컴포넌트 마운트 동안 자동 실행을 한 번으로 제한.
- 사용자가 `OpponentSelector` 로 상대를 바꾸면 `selectOpponent()` 가 `status`를 `'ready'` 로 되돌리는데, 이 때는 **자동 재실행하지 않는다** (플래그가 true로 유지). 사용자는 `▶ 가상 대전 실행` 버튼으로 직접 재시뮬 — 요구사항 "기본적으로" 해석과 일치.

### 3.2 결과 요약 패널 (FR-03 ~ FR-05, FR-07)

- 새 컴포넌트 `src/components/analysis/MatchResultSummary.tsx` 신설.
- Props: `result: CombatResult`, `reconstruction: MatchReconstructionResult`.
- 내부 계산:
  - `winner`: `result.winner` → `player/enemy/draw` 라벨.
  - `playerDamage = Σ result.playerUnits[i].totalDamageDealt`
  - `enemyDamage = Σ result.enemyUnits[i].totalDamageDealt`
  - `survivors = (winner === 'player' ? playerUnits : enemyUnits).filter(u => u.state !== 'dead')`
  - 생존 유닛은 `<ChampionCard>` (이미 존재하는 `src/components/builder/ChampionCard.tsx`) 또는 `ChampionIcon` 재사용해 별 등급 포함 아이콘 + 잔여 HP% 뱃지.
- UI 구조(요약):
  ```
  ┌────────── 결과 배너 (TEAM A 승리, 12.4초) ──────────┐
  ├─ TEAM A 총딜 45,230 │ TEAM B 총딜 28,110 ─────────┤
  └─ 생존 유닛 (TEAM A): [카드][카드][카드] ──────────┘
  ```
- `analysis/page.tsx` 에서:
  - 기존 "승리 문구" 블록 (`line 130-134`) 제거, `MatchResultSummary` 로 교체.
  - `DefeatReport` 는 패배 시 `MatchResultSummary` **아래에** 이어서 표시 (FR-07).

### 3.3 시뮬레이터 좌표 역변환 (FR-06)

- 원인: `reconstruction.playerTeam[i].position.r ∈ [4,7]` (matchAdapter.ts:128), 반면 `tm.playerTeam` 은 `[0,3]` 를 가정.
- 수정 방침: **저장 시점** 또는 **로드 시점**에서 player 좌표를 `r -= 4` 해준다.
- 선택: `analysis/page.tsx` 의 `openInSimulator()` 에서 저장 직전 변환. 이유:
  - simulator 페이지를 건드리지 않고 전달 형식을 표준화.
  - enemyTeam (`r ∈ [0,3]`) 은 그대로 둔다 — 시뮬레이터 내부에서 적팀은 원본 좌표 그대로 사용.
- 구현:
  ```ts
  const shiftPlayerRows = (team: PlacedChampion[]) =>
    team.map(p => {
      const off = axialToOffset(p.position);
      const newPos = offsetToAxial({ row: off.row - 4, col: off.col });
      return { ...p, position: newPos };
    });
  sessionStorage.setItem('analysis_team', JSON.stringify({
    playerTeam: shiftPlayerRows(reconstruction.playerTeam),
    enemyTeam: reconstruction.enemyTeam,
  }));
  ```
- `axialToOffset`/`offsetToAxial` 는 `@/types` 에서 이미 내보내고 있음 (simulator/page.tsx 기존 import 재사용).
- 방어: `off.row - 4 < 0` 또는 `> 3` 인 경우 clamp (`Math.max(0, Math.min(3, row))`) — 휴리스틱 배치 실패 대비.

---

## 4. 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `src/app/lookup/[matchId]/analysis/page.tsx` | 수정 | 자동 실행 effect, 결과 패널 교체, openInSimulator 좌표 변환 |
| `src/components/analysis/MatchResultSummary.tsx` | 신규 | 승자/양팀 딜량/생존 유닛 요약 컴포넌트 |
| (선택) `src/hooks/useCombatAnalysis.ts` | 변경 없음 | 기존 액션만 사용 |
| (선택) `src/lib/analysis/matchAdapter.ts` | 변경 없음 | playerTeam 좌표는 엔진 입력 규약상 row 4-7 유지 |

---

## 5. 테스트 계획

- [ ] `/lookup/{matchId}/analysis?puuid=...` 진입 → 로딩 완료 직후 자동으로 "▶ 시뮬레이션 실행 중..." → `done` 까지 한 번에 진행되는지 확인.
- [ ] 결과 배너: `result.winner` 값별로 "TEAM A 승리" / "TEAM B 승리" / "무승부" + 시간(소수점 1자리) 노출.
- [ ] 양팀 총 딜량: 숫자 포맷 `toLocaleString()`, 양팀 카드의 합계가 `result.playerUnits`/`enemyUnits` 의 `totalDamageDealt` 총합과 일치.
- [ ] 생존 유닛: 이긴 팀의 `state !== 'dead'` 유닛 카드가 올바른 수로 표시. 모두 사망(무승부)인 경우 "생존 유닛 없음" 플레이스홀더.
- [ ] 패배 케이스에서 `MatchResultSummary` + `DefeatReport` 가 순서대로 표시.
- [ ] `시뮬레이터에서 열기` → `/simulator` 진입 시 TEAM A 보드 하단 row 0-3 에 유닛이 복원, TEAM B 는 row 0-3 에 정상 위치 (이 UX 상 row 0-3 는 상단 적팀 슬롯).
- [ ] 시뮬레이터에서 `전투 시작` 눌렀을 때 분석 결과와 동일한 승패 / 비슷한 스냅샷이 재생되는지 샘플 매치 1건 확인.
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 전부 통과.

---

## 6. 범위 외

- `simulateCombat` 엔진 자체 수정, 새로운 히어로/아이템 효과.
- 상대 선택기(`OpponentSelector`) 의 UX 변경.
- 매치 재현 신뢰도 (`confidence`) 계산 로직 변경.
- 모바일 레이아웃 튜닝 (기존 tailwind 클래스 유지).
- 시뮬레이터 페이지의 좌표 규약 전면 통일 (향후 별도 feature).
