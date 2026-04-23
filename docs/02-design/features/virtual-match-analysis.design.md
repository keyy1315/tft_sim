# Design: 가상 대전 분석 개선 — 자동 실행 · 결과 요약 · 시뮬레이터 좌표 역변환

Plan 참조: [`docs/01-plan/features/virtual-match-analysis.plan.md`](../../01-plan/features/virtual-match-analysis.plan.md)

---

## 1. 현재 구현 현황

### 1.1 이미 구현됨 (재사용)

| 항목 | 위치 | 역할 |
|------|------|------|
| `useCombatAnalysis` 상태 머신 | `src/hooks/useCombatAnalysis.ts` | `idle → loading → ready → simulating → done` 전이 |
| 기본 상대 = 한 등수 위 유저 지정 | `useCombatAnalysis.ts:108-111` | 사용자가 골라서 실행해야 했음 |
| `reconstructMatch` / `simulateCombat` | `matchAdapter.ts`, `engine/combatLoop.ts` | 팀 재구성 + 전투 시뮬 |
| 승리/패배 배너 + 유닛 요약 레이아웃 | `simulator/page.tsx:693-712, 822-846` | 시뮬레이터 리플레이 화면 |
| `DefeatReport` 컴포넌트 | `src/components/analysis/DefeatReport.tsx` | 패배 시 취약 요인 |
| `ChampionCard` (이미지 + 별 + 툴팁) | `src/components/builder/ChampionCard.tsx` | 생존 유닛 카드 재사용 |
| `axialToOffset` / `offsetToAxial` | `src/types` | 좌표 변환 |

### 1.2 이번에 구현할 것

| # | 항목 | 우선순위 |
|---|------|---------|
| 1 | 매치 분석 페이지 진입 시 기본 상대 1회 자동 대전 | P0 |
| 2 | `MatchResultSummary` 컴포넌트 (결과 배너 · 양팀 총 딜량 · 생존 유닛) | P0 |
| 3 | `openInSimulator` 좌표 역변환 (player row 4-7 → 0-3) | P0 |
| 4 | 패배 시 `MatchResultSummary` + `DefeatReport` 병기 | P1 |

---

## 2. 데이터 흐름

```
┌───────────────────────────────────────────────────────────────┐
│ 전적검색(/lookup) 클릭 → /lookup/[matchId]/analysis?puuid=..  │
└───────────────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌───────────────────────────────┐
        │ loadMatch() effect            │
        │  - /api/lookup/match 호출     │
        │  - participants 세팅          │
        │  - analysis.checkMatch(...)   │
        └───────────┬───────────────────┘
                    ▼
        ┌───────────────────────────────┐
        │ status === 'ready' 진입       │
        │ selectedOpponent = 한 등수 위 │
        └───────────┬───────────────────┘
                    ▼   (NEW: autoRunTriggered guard)
        ┌───────────────────────────────┐
        │ autoRun effect (first-ready)  │
        │  analysis.runSimulation(me)   │
        └───────────┬───────────────────┘
                    ▼
        ┌───────────────────────────────┐
        │ status === 'done'             │
        │  originalResult, reconstruction│
        └───────────┬───────────────────┘
                    ▼
        ┌───────────────────────────────┐
        │ <MatchResultSummary/>         │   ← 신규 컴포넌트
        │   배너 + 양팀 딜량 + 생존 유닛 │
        │ (패배 시 + <DefeatReport/>)    │
        └───────────────────────────────┘

  사용자가 상대 교체 → selectOpponent() → status 'ready', 재시뮬은 수동 버튼
  사용자가 '시뮬레이터에서 열기' → openInSimulator()
           playerTeam row 4-7 → row 0-3 역변환 후 sessionStorage 저장
           /simulator 로 라우팅 → tm.updatePlayerTeam() 정상 주입
```

---

## 3. 컴포넌트/모듈 설계

### 3.1 `MatchResultSummary` (신규)

**경로**: `src/components/analysis/MatchResultSummary.tsx`

**Props**:

```ts
import type { CombatResult } from '@/types';
import type { MatchReconstructionResult } from '@/types/analysis';

interface MatchResultSummaryProps {
  result: CombatResult;
  reconstruction: MatchReconstructionResult;
  /** 사용자(플레이어) 표시명 — 참가자 데이터에서 주입 */
  playerName?: string;
  /** 상대 표시명 */
  opponentName?: string;
}
```

**내부 계산**:

```ts
const playerDamage = result.playerUnits.reduce((s, u) => s + u.totalDamageDealt, 0);
const enemyDamage  = result.enemyUnits.reduce((s, u) => s + u.totalDamageDealt, 0);

const winningTeamLabel =
  result.winner === 'player' ? 'TEAM A' :
  result.winner === 'enemy'  ? 'TEAM B' : null;

const survivors = result.winner === 'draw'
  ? []
  : (result.winner === 'player' ? result.playerUnits : result.enemyUnits)
      .filter(u => u.state !== 'dead');
```

**DOM 구조**:

```
<section> (rounded, bg-gray-800/50, border-gray-700/50)
  ├ <header> 배너
  │   "TEAM A 승리 · 12.4초"  (winner 색상: player=blue, enemy=red, draw=gray)
  │   보조 텍스트: "{playerName} vs {opponentName}"
  ├ <div> grid-cols-2 양팀 총 딜량
  │   ├ TEAM A 총 피해량: 45,230  (toLocaleString)
  │   └ TEAM B 총 피해량: 28,110
  └ <div> 생존 유닛 (이긴 팀)
      ├ 제목: "TEAM A 생존 유닛 (3 / 8)"
      ├ <ul> flex row, gap-2
      │   └ for each survivor u:
      │       <ChampionCard champion={u.champion} starLevel={u.starLevel}
      │                      size={48} showName={false} tooltipDisabled />
      │       HP % 뱃지: Math.round(u.currentHp / u.maxHp * 100) + '%'
      └ 승리팀 없음(draw) → "무승부 — 생존 유닛 없음" 플레이스홀더
```

**스타일 규칙**:
- 배너: `winner === 'player'` → `bg-blue-600/10 border-blue-600/30 text-blue-300`, enemy는 red-600, draw는 gray-600.
- 총 딜량: 우세 팀을 `font-bold` + 색상 강조, 열세 팀은 기본 회색.
- HP% 뱃지: `90%+ → green`, `60-89% → yellow`, `<60% → orange`. Tailwind 직접 적용 (동적 색상은 삼항으로).

**의존성**:
- `@/components/builder/ChampionCard` (이미 존재).
- `@/types`의 `CombatResult`, `CombatUnit`.
- `@/types/analysis`의 `MatchReconstructionResult`.
- `Image` 등 외부 리소스 추가 없음.

### 3.2 `analysis/page.tsx` 수정

**변경 요지**:
1. `useRef<boolean>(false)` 로 `autoRunTriggered` 추가.
2. `status === 'ready' && reconstruction === null && !autoRunTriggered.current` 조건을 감시하는 effect 추가 → `runSimulation(player)` 호출 후 ref = true.
3. 상단 상대 선택기 아래 결과 영역: 승리 단문 제거, `<MatchResultSummary ... />` 삽입.
4. 패배 시: 기존 `<DefeatReport />` 를 `MatchResultSummary` 아래에 유지.
5. `openInSimulator()` 내부: `playerTeam` 좌표 역변환 후 저장 (§3.3 헬퍼 사용).

**effect 패턴 (React Compiler 규칙 준수)**:

```tsx
const autoRunTriggered = useRef(false);

useEffect(() => {
  if (autoRunTriggered.current) return;
  if (analysis.status !== 'ready') return;
  if (analysis.reconstruction !== null) return;
  if (!player || !analysis.selectedOpponent) return;
  autoRunTriggered.current = true;
  analysis.runSimulation(player);
}, [analysis.status, analysis.reconstruction, analysis.selectedOpponent, player, analysis.runSimulation]);
```

- `useEffect` 안에서 `setState` 를 직접 호출하지 않고 훅 액션(`runSimulation`)만 호출 → 규약 `set-state-in-effect` 위반 아님.
- 의존성 배열에 `runSimulation` 이 포함되어야 하며, `useCallback` 으로 메모이즈된 원본을 그대로 사용하므로 반복 트리거 방지 역할은 `autoRunTriggered.current` 가 담당.

### 3.3 `openInSimulator` 좌표 역변환 헬퍼

**정의 위치**: `analysis/page.tsx` 파일 내 로컬 함수 (공용 유틸로 승격하지 않음 — 이 경로 하나에서만 사용).

```ts
import { axialToOffset, offsetToAxial, PlacedChampion, HexCoord } from '@/types';

function shiftPlayerRowsForSimulator(team: PlacedChampion[]): PlacedChampion[] {
  return team.map(p => {
    const off = axialToOffset(p.position);
    const newRow = Math.max(0, Math.min(3, off.row - 4));
    return { ...p, position: offsetToAxial({ row: newRow, col: off.col }) };
  });
}
```

**`openInSimulator` 갱신**:

```ts
const openInSimulator = () => {
  if (!analysis.reconstruction) return;
  sessionStorage.setItem('analysis_team', JSON.stringify({
    playerTeam: shiftPlayerRowsForSimulator(analysis.reconstruction.playerTeam),
    enemyTeam:  analysis.reconstruction.enemyTeam,    // row 0-3 그대로
  }));
  router.push('/simulator');
};
```

**정당성**:
- `matchAdapter.heuristicPlacement` 의 엔진 입력 규약 (`skipMirror: true`, player row 4-7, enemy row 0-3) 은 그대로 유지 → 기존 `runSimulation` 경로 영향 없음.
- 시뮬레이터 `useTeamManagement.playerTeam` 의 규약 (row 0-3) 에 맞춰 **경계 레이어** 에서만 변환.
- clamp 로 heuristic 실패 (row 계산이 범위 밖) 상황 대비.

### 3.4 `analysis/page.tsx` 렌더 구조 변경

```tsx
{(analysis.status === 'ready' || analysis.status === 'simulating' || analysis.status === 'done') && (
  <div className="space-y-4">
    <OpponentSelector .../>

    <div className="flex gap-2">
      <button onClick={manualRun} disabled=...> ▶ 가상 대전 실행 </button>
      {analysis.status === 'done' && analysis.reconstruction && (
        <button onClick={openInSimulator}> 시뮬레이터에서 열기 </button>
      )}
    </div>

    {analysis.status === 'simulating' && (
      <div className="text-sm text-gray-500">시뮬레이션 실행 중...</div>
    )}

    {analysis.status === 'done' && analysis.reconstruction && analysis.originalResult && (
      <MatchResultSummary
        result={analysis.originalResult}
        reconstruction={analysis.reconstruction}
        playerName={player?.gameName}
        opponentName={analysis.selectedOpponent?.gameName}
      />
    )}

    {analysis.status === 'done' && analysis.defeatReport && (
      <DefeatReport result={analysis.defeatReport} />
    )}

    {analysis.status === 'done' && analysis.reconstruction && (
      <div className="p-2 rounded bg-gray-800/50 ... text-xs text-gray-400">
        "시뮬레이터에서 열기"로 배치/아이템을 수정하고 재시뮬레이션할 수 있습니다.
      </div>
    )}
  </div>
)}
```

- 승리 단문 박스 (`line 130-134`) 삭제 — 역할이 `MatchResultSummary` 로 흡수.
- 패배 분기는 단독으로 `DefeatReport` 렌더 (같은 위치).

---

## 4. 타입 변경

없음. `CombatUnit.currentHp/maxHp/state`, `CombatResult.winner/duration/playerUnits/enemyUnits` 모두 기존 타입을 그대로 사용 (`src/types/index.ts:440-507` 참조).

---

## 5. 구현 순서

1. `src/components/analysis/MatchResultSummary.tsx` 작성 (§3.1).
2. `src/app/lookup/[matchId]/analysis/page.tsx` 수정:
   - `useRef` 및 자동 실행 effect 추가 (§3.2).
   - 렌더 영역 교체 (§3.4).
   - `shiftPlayerRowsForSimulator` + `openInSimulator` 갱신 (§3.3).
3. 수동 검증 (§6).
4. `pnpm lint && pnpm typecheck && pnpm build` 3종 통과.

---

## 6. 테스트 시나리오

### 6.1 자동 실행

1. 임의 매치 카드 → 가상대전 분석 → 매치 분석 페이지 진입.
2. 로딩 완료 후 **자동으로** `시뮬레이션 실행 중...` 표시 → `done` 전이.
3. 기본 상대 선택 상태가 "한 등수 위" 유저인지 확인 (OpponentSelector 강조).
4. 상대를 다른 유저로 바꾼다 → 자동 재실행 **되지 않음** (수동 버튼 필요) 확인.

### 6.2 결과 요약 패널

| 케이스 | 기대 |
|--------|------|
| 플레이어 승리 | `TEAM A 승리`, 생존 유닛이 플레이어 쪽 유닛, 카운트 일치 |
| 상대 승리 | `TEAM B 승리`, 생존 유닛이 상대 쪽 유닛, 하단에 `DefeatReport` 병기 |
| 무승부 | `무승부`, 생존 유닛 영역에 "생존 유닛 없음" 플레이스홀더 |
| 큰 수치 | 딜량이 `45,230` 처럼 천 단위 콤마 포맷 |
| HP% | 만피 유닛 `100%` 초록, 30% 유닛 `30%` 주황 |

### 6.3 시뮬레이터 좌표

1. 승리 케이스에서 `시뮬레이터에서 열기` 클릭.
2. `/simulator` 진입 시 **TEAM A 보드 하단 (row 0-3 UX)** 에 플레이어 팀 유닛이 표시됨을 확인.
3. TEAM B 상단(row 0-3)에 상대 유닛 그대로 표시.
4. `전투 시작` 눌러 재시뮬 → 유사한 결과 (동일 시드 42 라면 사실상 동일) 확인.
5. 휴리스틱이 row 4 미만을 반환하는 edge 케이스 (시뮬레이션 중 예외적으로 없어야 하지만) clamp 로 안전.

### 6.4 회귀

- 기존 패배 케이스에서 `DefeatReport` 는 여전히 노출.
- `ConfidenceBadge`, `OpponentSelector`, `unsupported`/`error` 분기 변화 없음.
- `What-if` 기능은 본 작업 범위 외이며 훅 API는 그대로라 영향 없음.

---

## 7. 위험 요소 & 완화

| 위험 | 완화 |
|------|------|
| React Compiler `set-state-in-effect` 규칙 위반 | effect 내부에서 `useCallback` 훅 액션만 호출, `useRef` 는 state가 아니라 허용됨 |
| 상대를 바꿨을 때 의도치 않은 자동 재실행 | `autoRunTriggered.current` 는 컴포넌트 수명 동안 true 로 유지, 수동 실행만 허용 |
| 시뮬레이터가 row 4-7 좌표를 주입받아 잘못 표시 (기존 버그) | `openInSimulator` 저장 직전 변환 + clamp |
| heuristicPlacement 가 row 범위를 벗어난 좌표 생성 | `Math.max(0, Math.min(3, row))` clamp 로 방지 |
| `draw` 케이스에서 winner == 'draw' 라벨 누락 | `winner === 'draw'` 분기 명시, 배너/생존 유닛 둘 다 처리 |
| `originalResult` 는 있고 `reconstruction` 는 null 인 상태 불가 (훅이 원자적으로 set) | 방어적으로 둘 다 확인하는 조건 유지 |

---

## 8. 범위 외

- `OpponentSelector` UI 변경 (정렬/표시 포맷).
- `DefeatReport` 구조 개편.
- 시뮬레이터의 좌표 규약 통일 (별도 리팩터링 feature).
- 분석 결과에 대한 상세 DPS 차트 / 시계열 시각화.
- What-if 비교 기능의 UI 표출 (현재 훅에는 있으나 analysis 페이지에서는 미노출 — 본 작업에서도 유지).
