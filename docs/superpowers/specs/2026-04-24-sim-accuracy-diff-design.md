# Design: actual-data vs 시뮬 Diff 리포트 (v1)

**작성일**: 2026-04-24
**Status**: Design ready for implementation plan
**후속 스펙 보존**: `docs/meta/sim-accuracy-followups.md`

## 목적

실제 TFT 경기 데이터(`actual-data/game-*.json`)를 ground truth로 사용해 현재 전투 시뮬레이션
엔진의 결과를 비교하고, 라운드별 오차를 **측정**한다. v1은 **측정만** 담당 — 측정 결과로
어느 시스템을 어떻게 고칠지 판단하는 작업은 이 스펙 이후 단계.

v1 산출물:
- 라운드 단위: actual winner / survivor HP / 딜량 vs sim N-run 분포 비교
- 게임 단위: winnerMatchRate, avgDamageErrorPct, avgSurvivorHpErrorPts
- 편집 페이지 인라인 요약 + `/compare` 전용 페이지 + API 3개

또한 v1 설계는 **`nRunSimulator` 재사용 코어 모듈**을 분리 노출함으로써 미래 "임의의 두 팀
승률 비교 UI" 기능이 그대로 재활용할 수 있는 기반을 마련한다.

## 이 스펙이 푸는 문제 (Why now)

- 사용자가 `actual-data/` 에 실제 플레이 2판을 쌓았지만 시뮬과 실제가 얼마나 일치하는지
  측정 수단이 없음.
- "엔진을 새로 짜야 하나?"를 결정하려면 먼저 **어디가 얼마나 틀리는지**가 필요함.
- 전체 재작성은 리스크·기간 모두 크므로 측정 후 시스템 단위로 국소 재작성하는 전략.

## 핵심 결정 요약 (브레인스토밍 합의)

| # | 결정 | 선택 |
|---|------|------|
| Q1 | 비교 신호 스코프 | **현재 데이터 + 스키마 확장 병행**. `survivors` 필수 추가, `opponentDamageChart` optional |
| Q2 | v1 경계 | **A안** — 1+2+4+5. 영상 자동 추출(3)·시스템 귀속(6)은 후속 스펙으로 분리 |
| Q3 | 비결정성 처리 | **N-run + 분포 표시** (N=10 기본). winRate·damageDist·survivorDist 리턴 |
| Q4 | 노출 위치 | **(4)** 편집 페이지 인라인 요약 + `/compare` 별도 페이지 + API 엔드포인트 |
| Q5 | 시뮬 입력 누락 파라미터 | **(B)** `augmentStacks` + `ioniaPath` + `arbiterLaw` 3개만 스키마 추가. 필트오버·갈리오·bilgewater 등은 기본값 + 경고 |
| Arch | 실행·캐싱 전략 | **A2** — POST 시 계산 + `actual-data/diff-<gameId>.json` 캐시. stale 감지 있고 재실행은 명시적 |

## 전체 아키텍처

### 디렉토리 배치

```
src/lib/validation/              [신규, analysis/와 분리]
  schemaAdapter.ts               actual-data round → SimulateOptions 변환 + 누락 파라미터 경고
  nRunSimulator.ts               ⭐ runN(input, n, seedBase) → Distribution (재사용 코어)
  diffReporter.ts                compareRound(actual, dist) → RoundDiff
  gameDiffer.ts                  게임 단위 오케스트레이션 + 캐시 I/O

src/app/api/actual-data/[gameId]/compare/route.ts
  POST    # 계산 + 캐시 저장
  GET     # 캐시 읽기 + stale 판정
  DELETE  # 캐시 삭제

src/app/actual-data/[gameId]/
  page.tsx                       [수정] 인라인 요약 카드 추가
  compare/page.tsx               [신규] 전체 게임 diff 페이지

src/components/validation/       [신규]
  RoundDiffInlineCard.tsx        편집 페이지용 3상태 카드 (A/B/C)
  GameDiffSummaryCard.tsx        compare 상단 요약
  RoundDiffTable.tsx             compare 라운드 리스트
  RoundDiffDetailPanel.tsx       라운드 상세 (데미지·생존·경고)
  RunCompareButton.tsx           공통 실행 버튼 + fetch 핸들러

src/types/validation.ts          [신규] Distribution, RoundDiff, GameDiff, NumStats, HpStats

actual-data/
  game-<gameId>.json             (기존)
  diff-<gameId>.json             (신규, git 포함)
```

### 의존 방향 (단방향)

```
UI 컴포넌트
   ↓ fetch
API route (compare)
   ↓
gameDiffer
   ├→ schemaAdapter  → NRunInput + warnings
   ├→ nRunSimulator  → simulateCombat × N  → Distribution
   └→ diffReporter   → (actualRound, Distribution) → RoundDiff
```

- `src/lib/validation/*` 는 React·Zustand 미의존 (순수 TS, 엔진 레이어와 동일 격리 수준)
- `nRunSimulator` 는 **단일 라운드 단위** — 게임 전체 오케스트레이션은 `gameDiffer` 책임.
  이 분리 덕에 미래 팀 비교 UI에서 `nRunSimulator` 만 떼서 재사용 가능.

### 데이터 흐름 (compare 페이지 초기 로드)

```
1) UI: GET /api/actual-data/[gameId]/compare
2) 서버: 캐시 + stale 판정 → { diff, stale, currentGameMtime } 또는 404
3) 404면 UI 상태 A (실행 안 됨) → 사용자 클릭 → POST /compare
4) 서버: 각 PvP 라운드마다
     actualRound → schemaAdapter → NRunInput
                → nRunSimulator(input, n=10, seedBase=0) → Distribution
                → diffReporter(actualRound, Distribution) → RoundDiff
5) RoundDiff[] + summary → GameDiff
6) diff-<gameId>.json 저장 후 200 응답
7) UI 렌더 + 요약 카드 표시
```

## Schema 확장

### 신규 필드 추가

```typescript
// src/lib/actualData/schema.ts [수정]

interface PvpRound {
  // ...기존 필드
  winner: 'player' | 'opponent' | null;
  playerDamageChart: DamageEntry[];      // 기존
  opponentDamageChart?: DamageEntry[];   // ⭐ optional (HUD 열어본 경우만)
  playerTeam: TeamSnapshot;
  opponent: TeamSnapshot;
}

interface TeamSnapshot {
  units: PlacedUnit[];                   // 기존
  augments: (string | null)[];           // 기존
  level: number | null;                  // 기존
  hp: number | null;                     // 기존
  hexModifiers: HexBuff[];               // 기존

  // ⭐ 신규 (모두 optional)
  survivors?: Survivor[];                // 라운드 종료 시 상태
  augmentStacks?: Record<string, number>;// apiName → 스택 수
  ioniaPath?: 'purity' | 'balance' | 'chaos' | null;
  arbiterLaw?: string | null;            // arbiter_laws.json apiName
}

interface Survivor {
  hex: HexCoord;
  championId: string;
  alive: boolean;
  hpPercent: number;                     // 0~100, alive=false면 0
}

interface DamageEntry {
  unitHex: HexCoord;
  championId: string;
  damage: number;
}
```

**설계 원칙**: 모든 신규 필드는 **optional**. 기존 2판은 그대로 두고, diff 리포터가 없는
신호는 자동 스킵 (해당 메트릭만 "—" 로 표시).

### 입력 UX (편집 페이지 `RoundEditor` 확장)

**1) 팀 상단 메타 블록 (접기 가능)**
```
⚙️ 팀 설정
  레벨: [7]  HP: [50]
  아이오니아 길: [정결 ▼]        (기본값 null)
  중재자 법률: [힘의 법 ▼]       (arbiter_laws.json 로드)
```

**2) 증강 슬롯 옆 스택 입력**
```
[⚡ 슬래민 증강 ]  stacks: [3]
```
스택형 증강 화이트리스트(데이터상 `stackable: true` 플래그로 식별) 에 한해 노출. 일반 증강은
입력창 숨김. 기본값 1.

**3) 생존 상태 입력 (유닛 인스펙터 패널)**
```
Xayah ★★ [TFT_Item_...×3]
────────────────
종료 상태:
  (•) 생존   HP: [ 45 ]%
  ( ) 사망
```
- alive=true → HP% 입력 노출 (0~100, 기본 100)
- alive=false → HP% 숨김 (0 저장)
- **미입력 유닛은 `survivors`에 포함 안 됨** — diff 리포터가 해당 유닛만 스킵

**4) 상대 딜량 차트 섹션 (기존 내팀 차트 복제)**

기존 `DamageChartInput` 컴포넌트에 `target: 'player' | 'opponent'` prop 추가. 섹션 제목
"상대 유닛 딜량 (선택 — HUD 열어본 경우만)" 명시.

### 기존 2판 backfill 전략

**강제 안 함.** 기존 2판은 신규 필드 없이 유지. diff 리포터는:
- `survivors` 없음 → 생존 비교 섹션 전체 "—" 표시, 스킵
- `opponentDamageChart` 없음 → 상대 딜 비교 스킵
- `augmentStacks` 없음 → 스택 1 가정 + warning 발생
- `ioniaPath`/`arbiterLaw` 없음 → 해당 trait 활성 시만 warning, 비활성이면 조용히 무시

## 코어 로직

### `nRunSimulator` — 재사용 코어

```typescript
// src/lib/validation/nRunSimulator.ts

export interface NRunInput {
  playerTeam: TeamInput;        // units, augments, augmentStacks, ioniaPath, arbiterLaw, ...
  opponentTeam: TeamInput;
  simulateOptions: Omit<SimulateOptions, 'seed'>;  // skipMirror=true, stageNumber 등
}

export interface Distribution {
  nRuns: number;
  winnerCounts: { player: number; opponent: number; draw: number };
  playerWinRate: number;
  playerDamage: Map<string, NumStats>;   // hexKey → damage stats
  opponentDamage: Map<string, NumStats>;
  survivors: {
    player: Map<string, HpStats>;
    opponent: Map<string, HpStats>;
  };
  combatDurationTicks: NumStats;
}

export interface NumStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  samples: number[];   // 원본 N개 (디버그/차트용)
}

export interface HpStats {
  aliveCount: number;          // N회 중 생존 횟수
  meanHpPercentIfAlive: number;
}

export function runN(input: NRunInput, n = 10, seedBase = 0): Distribution;
```

**구현 요지**:
- `for (let i = 0; i < n; i++) { result = simulateCombat(..., { seed: seedBase + i, ...input.simulateOptions }); collect(result); }`
- 각 실행의 최종 snapshot에서 unit별 누적 딜량, 생존 여부, HP% 수집
- N개 결과를 aggregate → NumStats (mean/median/min/max) / HpStats
- 순수 동기 for-loop. N=10에서 <2초 예상 (라운드 1개 기준).
- **결정론 보장**: 동일 input + 동일 seedBase → 동일 Distribution.

### `schemaAdapter` — actual-data → sim 입력

```typescript
// src/lib/validation/schemaAdapter.ts

export interface AdapterResult {
  input: NRunInput;
  warnings: string[];
}

export function toNRunInput(
  round: PvpRound,
  allTraits: RawTrait[],
  allAugments: RawAugment[],
  allChampions: RawChampion[],
  allItems: RawItem[]
): AdapterResult;
```

**주요 매핑**:
- `round.playerTeam.units` → `input.playerTeam.units` (hex 그대로)
- `round.opponent.units` → `input.opponentTeam.units` (hex 그대로)
- `input.simulateOptions.skipMirror = true`
- `stageNumber`: `roundName` 앞자리 파싱 (`"5-5"` → `5`)
- `augments` + `augmentStacks` → `AugmentWithStacks[]`
- `ioniaPath`, `arbiterLaw`: 해당 trait 활성 시만 전달

**경고 규칙 (warnings)**:
- `augmentStacks` 누락 + 스택형 증강 존재 → `"'<name>' 스택 미입력 → 1로 가정"`
- `ioniaPath` 누락 + 아이오니아 활성 → `"아이오니아 길 미선택 → 기본값 사용"`
- `arbiterLaw` 누락 + 중재자 활성 → 동일 패턴
- 필트오버 활성 + `piltoverModules` 미지원 → `"필트오버 모듈 정보 없음 — 시뮬 부정확 가능"`
- 빌지워터 활성 → warning 없음 (trait 상태로부터 파생 가능)

### `diffReporter` — 라운드 비교

```typescript
// src/lib/validation/diffReporter.ts

export function compareRound(
  actual: PvpRound,
  distribution: Distribution,
  warnings: string[]
): RoundDiff;
```

**메트릭 정의**:

| 메트릭 | 계산 | 표시 조건 |
|--------|------|---------|
| Winner 일치 | `majorityWinner(dist) === actual.winner` | 항상 |
| Winner confidence | `abs(playerWinRate - 0.5)` | 항상. <0.15면 "엣지 케이스" 배지 |
| Player 딜 오차 (unit별) | `(simMean - actualDamage) / actualDamage` | `actual.playerDamageChart` 있을 때 |
| Opponent 딜 오차 | 동일 | `actual.opponentDamageChart` 있을 때만 |
| Survivor alive 일치 | `actual.alive === (simAliveRate > 0.5)` | `actual.survivors` 있을 때 |
| Survivor HP 오차 (pt) | `simMeanHpPercent - actual.hpPercent` | alive 일치 시만 |

**미입력 필드 처리**: 각 섹션 독립. `survivors` 없어도 winner·딜 비교는 출력.

### `gameDiffer` — 게임 단위 오케스트레이션

```typescript
// src/lib/validation/gameDiffer.ts

export interface ComputeOptions {
  n: number;         // 기본 10
  seedBase: number;  // 기본 0
}

export async function computeGameDiff(
  gameId: string,
  options?: ComputeOptions
): Promise<GameDiff>;

export async function loadCachedDiff(gameId: string): Promise<{
  diff: GameDiff;
  stale: boolean;
  currentGameMtime: number;
} | null>;

export async function saveDiffCache(gameId: string, diff: GameDiff): Promise<void>;
export async function deleteDiffCache(gameId: string): Promise<void>;
```

**처리 흐름**:
1. `actual-data/game-<id>.json` 읽기 + mtime 수집
2. PvP 라운드만 필터 (shrine 라운드 스킵)
3. 각 라운드: `schemaAdapter.toNRunInput` → `nRunSimulator.runN` → `diffReporter.compareRound`
4. 전체 요약 집계: `winnerMatchRate`, `weakSignalRoundCount`, `avgPlayerDamageErrorPct`, `avgSurvivorHpErrorPts`
5. `engineSha` 캡처 시도 (`execSync('git rev-parse HEAD')`, 실패 시 null)
6. `GameDiff` 리턴 — 저장은 API route 책임 (gameDiffer는 순수)

**`GameDiff` 타입**:
```typescript
interface GameDiff {
  gameId: string;
  computedAt: string;          // ISO
  sourceGameMtime: number;     // epoch ms
  engineSha: string | null;
  nRuns: number;
  seedBase: number;
  rounds: RoundDiff[];
  summary: {
    pvpRoundCount: number;
    winnerMatchRate: number;
    weakSignalRoundCount: number;   // playerWinRate ∈ [0.35, 0.65]
    avgPlayerDamageErrorPct: number;
    avgSurvivorHpErrorPts: number;
  };
}
```

## UI 서피스

### 편집 페이지 인라인 요약 (3상태)

**상태 A — 아직 실행 안 됨:**
```
🧪 시뮬 비교
  이 게임은 아직 시뮬 비교를 돌리지 않았습니다.
  [▶ 비교 실행 (예상 ~30초)]  [전체 보기 →]
```

**상태 B — 캐시 존재 (현재 라운드 요약):**
```
🧪 시뮬 비교 (2026-04-24 05:30 캐시)
  Winner:    actual=player  sim=7/10  ✅ 일치
  내 딜량:   평균 오차 -18%  (Xayah -42%)
  상대 딜량: — (데이터 없음)
  생존:      2/3 일치 (Leona HP 과소평가 -35pt)
  ⚠️ 경고:   '슬래민' 스택 미입력 → 1로 가정
                              [전체 보기 →]
```
라운드 네비 시 해당 라운드의 `RoundDiff` 로 업데이트.

**상태 C — stale:**
```
🧪 시뮬 비교  ⚠️ 데이터 변경됨
  마지막 실행: 2026-04-24 05:30
  게임 수정:   2026-04-24 06:54
  [▶ 다시 실행]  [기존 결과 그대로 보기 →]
```

### `/actual-data/[gameId]/compare` 페이지

**레이아웃** (2컬럼: 상단 요약 카드 → 라운드 테이블 → 상세 패널):

- **요약 카드**: winner 적중률 / 엣지케이스 제외 적중률 / 딜 오차 평균 / survivor HP 오차 평균 / 메타 (N, seedBase, engineSha, 실행시각) / [🔄 다시 실행] 버튼
- **라운드 테이블**: 라운드 / actual winner / sim winrate / 일치 / 내딜오차 / Survivor 오차. 행 클릭 시 하단 상세 패널 확장
- **상세 패널**: 선택된 라운드의 winner 설명, unit별 딜 오차 (mean ± range), 생존 상태, 경고 목록

### 실행 중 UX

- N=10 × 21라운드 기준 20-40초
- v1은 **단일 스피너 + 메시지** ("21라운드 시뮬 중... 약 30초 예상")
- 실시간 진행률(SSE)은 v1 외 — 복잡도 대비 가치 낮음

### 상태 관리

- `useCompareDiff(gameId)` 훅 (SWR 패턴) — `GameDiff | null | 'stale'` 관리
- Zustand 슬라이스 불필요 — 페이지 로컬 상태로 충분

## API + 캐시 무효화

### 엔드포인트

```
POST   /api/actual-data/[gameId]/compare   # 계산 + 캐시 저장
GET    /api/actual-data/[gameId]/compare   # 캐시 읽기 + stale 판정
DELETE /api/actual-data/[gameId]/compare   # 캐시 삭제
```

### POST

**Request Body (optional):**
```json
{ "n": 10, "seedBase": 0 }
```

**처리**:
1. 게임 파일 없음 → 404
2. schema 검증 실패 → 422 + 필드 경로
3. `computeGameDiff(gameId, {n, seedBase})` 호출
4. `diff-<id>.json` 저장
5. 200 `{ diff: GameDiff }`

**라운드 sim 실패**:
- 500 `{ error, failedRound }`
- **캐시 저장 안 함** (부분 저장 금지 — 일관성 우선)

**동시성**: 로컬 단일 사용자 툴. lock 없음. 동시 2건 POST → 뒤에 완료된 쪽이 덮어씀.

### GET

**응답**:
```json
// 캐시 있음
200 { "diff": GameDiff, "stale": false, "currentGameMtime": 1713940000000 }

// 캐시 없음
404 { "error": "no cache" }

// 게임 파일 없음
404 { "error": "game not found" }
```

**stale 판정**:
```
stale = diff.sourceGameMtime !== currentGameFileMtime
```

한 요청으로 UI가 상태 A/B/C 모두 결정 가능.

### DELETE

파일 삭제 후 204. 파일 없어도 204 (idempotent).

### 캐시 파일 git 포함

- 게임당 수십 KB. 게임 수 증가해도 리포지토리 부담 크지 않음
- 엔진 업그레이드 시 `git diff actual-data/diff-*.json` 로 회귀 직접 관찰 가능
- `.gitignore` 추가 안 함

### 엔진 버전 추적

`GameDiff.engineSha` — 계산 시점 git HEAD. 현재 HEAD와 다르면 UI에 정보성 배지 표시.
git 없는 환경 대비 try/catch, null 허용.

## 에러 핸들링

| 상황 | 처리 | UI |
|------|------|----|
| 게임 파일 없음 | 404 | "게임을 찾을 수 없습니다" |
| 게임 schema 이상 | 422 + 필드 경로 | "필드 X 형식 오류" |
| 라운드 sim 런타임 에러 | 500, 캐시 저장 X | "라운드 3-3 계산 실패: {msg}" |
| 빈 팀 (units 0) | 라운드 스킵 + warning | "빈 팀 — 스킵됨" |
| `survivors`에 unknown hex | 해당 생존자만 무시 + warning | "hex (2,3) 불일치 — 무시" |
| `augmentStacks`에 unknown apiName | 해당 스택 무시 + warning | "'xyz' 알 수 없는 증강 — 스킵" |
| 캐시 parse 실패 | 캐시 없음으로 간주 (상태 A) | 없음 |
| `engineSha` 가져오기 실패 | null 저장, 계산 진행 | 버전 배지 생략 |
| POST 중 게임 수정 race | 저장된 mtime이 즉시 stale | 다음 GET 때 stale 배지 |
| N=0 또는 음수 | 422 | "n은 1 이상이어야 합니다" |

**핵심 원칙**:
- **부분 캐시 저장 절대 금지** — 21라운드 중 1개 실패 시 파일 전체 안 씀
- **sim 내부 에러 스택은 서버 로그만** — UI에는 라운드 ID + 메시지 요약
- **schema validation은 API route 진입 직후** (`zod`) — 엔진까지 잘못된 데이터 미통과

## 스코프 경계

### v1 IN
- `survivors` / optional `opponentDamageChart` / `augmentStacks` / `ioniaPath` / `arbiterLaw` 스키마 + 입력 UI
- `nRunSimulator` 재사용 코어
- `schemaAdapter` + `diffReporter` + `gameDiffer`
- 편집 페이지 인라인 요약 (상태 A/B/C)
- `/compare` 페이지 (요약 카드 + 테이블 + 상세 패널)
- API 3개 (POST/GET/DELETE compare)
- 캐시 파일 git 포함

### v1 OUT (의도적 제외)
- **영상 프레임 자동 추출 파이프라인** → `docs/meta/sim-accuracy-followups.md` (후속 3)
- **시스템별 오차 자동 귀속** → 동일 파일 (후속 6)
- 필트오버 모듈 / 갈리오 / bilgewaterEffects 스키마 확장 (현재 기본값·경고 처리)
- 사망 시점 / 스킬 시전 타이밍 비교
- 실시간 진행률(SSE)
- 배치 API (shell 루프로 우회)
- CI 통합 / 회귀 자동 감지
- 여러 게임 간 교차 비교 (패치 A vs B 자동)
- 팀 비교 UI (미래에 `nRunSimulator` 재활용 예정)

### 암묵적 가정
- `simulateCombat`는 seed 결정론적
- PvP 양팀 좌표는 8-row 공간 완성 (mirror 불필요)
- 게임 JSON은 로컬 단일 사용자 — 동시성 보호 불필요
- N=10 · 21라운드 전체 계산 < 60초 (구현 전 측정 필요)

## 테스트 접근

### 단위 (vitest)
- `schemaAdapter.test.ts` — 라운드 fixture 5-10개로 매핑 + warnings 검증
- `nRunSimulator.test.ts` — 고정 seed·고정 입력으로 결정론 검증 (mean/max/min 동일)
- `diffReporter.test.ts` — actual/dist fixture 조합으로 메트릭 계산 검증 (missing field 케이스 포함)

### 통합
- `gameDiffer.test.ts` — `actual-data/game-20260424-001.json` 을 fixture로 사용, 전체 플로우 실행. 결과 구조 snapshot 검증

### 수동 QA 체크리스트
- 편집 페이지 ↔ compare 페이지 동선
- 상태 A → B → C 전환 (실행 → 게임 수정 → stale)
- 경고 표시 정상성 (ioniaPath 미입력 + 아이오니아 활성 등)
- 캐시 수동 삭제 후 동작

### 회귀 탐지 (future)
- 구현 안 함. 캐시 git 포함 구조상 `git diff actual-data/diff-*.json` 으로 수동 감지 가능.

## 성능 관찰 (구현 전 필수)

- **Phase 0 태스크**: 현재 엔진 `simulateCombat` 라운드당 평균 시간 측정
- 측정값 ≥ 500ms/round 이면 N=5 하향 또는 Web Worker 이관 검토
- 이 측정은 writing-plans 단계에서 첫 태스크로 반영

## 구현 순서 (개략 — writing-plans에서 확정)

1. **Phase 0**: 성능 벤치 — 엔진 현재 속도 측정
2. **Phase 1**: 타입 + schemaAdapter (nRunSimulator/diffReporter에 독립적)
3. **Phase 2**: nRunSimulator (schemaAdapter와 독립적 — 병렬 가능)
4. **Phase 3**: diffReporter (위 둘에 의존)
5. **Phase 4**: gameDiffer + API route (POST/GET/DELETE)
6. **Phase 5**: Schema 확장 + 입력 UX (편집 페이지 수정)
7. **Phase 6**: 편집 페이지 인라인 요약 카드 (상태 A/B/C)
8. **Phase 7**: `/compare` 페이지 (요약 카드 + 테이블 + 상세 패널)
9. **Phase 8**: 통합 테스트 + 수동 QA + git 커밋 정책 검증

## 위험과 대비

| 위험 | 대비 |
|------|------|
| 엔진 속도가 예상보다 느려 N=10 × 21라운드 ≫ 60초 | Phase 0 벤치. N 하향 또는 Web Worker |
| 기존 2판이 필트오버/갈리오 참여 덱이라 v1 정확도 낮음 | 해당 라운드 상세 패널에 "필트오버 모듈 정보 없음" 경고. 사용자가 판단 |
| set 17 업데이트로 `SimulateOptions` 필드 추가 시 schema 갭 재발 | `schemaAdapter`에 새 필드 경고 룰 추가하는 방식으로 확장 |
| 영상 자동 추출 안 하기 때문에 데이터 축적 속도 느림 | 후속 스펙(3)으로 이관 — v1에서 유의미한 수동 입력 UX로 체감 확인 후 판단 |
| 캐시 파일 git 포함이 bloat 유발 | 게임당 수십 KB, 수백 판 쌓여도 MB 단위 — 허용 범위 |

## 최종 산출물 목록

- **신규 파일** (13): `src/lib/validation/*.ts` 4개, `src/components/validation/*.tsx` 5개, `src/types/validation.ts`, `src/app/api/actual-data/[gameId]/compare/route.ts`, `src/app/actual-data/[gameId]/compare/page.tsx`, test 4개
- **수정 파일** (4): `src/lib/actualData/schema.ts`, `src/lib/actualData/types.ts`, `src/app/actual-data/[gameId]/page.tsx`, `src/components/actual-data/RoundEditor.tsx` (또는 유사 컴포넌트 — 실제 파일명은 구현 단계에서 확정)
- **git 포함 런타임 파일**: `actual-data/diff-<gameId>.json` (게임별 1개)
