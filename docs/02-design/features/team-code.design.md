# Design: 팀 코드 임포트/익스포트

> Plan 참조: `docs/01-plan/features/team-code.plan.md`

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│  SimulatorPage                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ Header: [전체 초기화] [팀 코드] [전투 시작] ...  ││
│  │              ↕ toggle                            ││
│  │  ┌─────────────────────────────────────────────┐ ││
│  │  │ TeamCodePanel                               │ ││
│  │  │  ┌─ Import ──────────────────────────────┐  │ ││
│  │  │  │ [TEAM A][TEAM B] [코드입력___] [로드] │  │ ││
│  │  │  └───────────────────────────────────────┘  │ ││
│  │  │  ┌─ Export ──────────────────────────────┐  │ ││
│  │  │  │ [TEAM A 복사] [TEAM B 복사]           │  │ ││
│  │  │  └───────────────────────────────────────┘  │ ││
│  │  └─────────────────────────────────────────────┘ ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ┌── Pure Logic (UI 무관) ──────────────────────────┐│
│  │  src/lib/teamCode.ts                             ││
│  │  - decodeTeamCode(code, mapping, champions)      ││
│  │  - encodeTeamCode(team, mapping)                 ││
│  │  - autoPlaceChampions(decoded, boardCols)        ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ┌── Data Layer ────────────────────────────────────┐│
│  │  public/data/tft_set16_teamplanner.json          ││
│  │  src/data/loader.ts → loadTeamPlannerMapping()   ││
│  │  src/hooks/useGameData.ts → teamPlannerMapping   ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

---

## 2. 데이터 설계

### 2.1 TeamPlanner 매핑 JSON 스키마

**파일**: `public/data/tft_set16_teamplanner.json`

```ts
interface TeamPlannerData {
  meta: { set: number; source: string };
  mapping: TeamPlannerEntry[];
}

interface TeamPlannerEntry {
  apiName: string;       // "TFT16_Darius"
  teamPlannerCode: number; // 875
}
```

**데이터 수집 방법**: CommunityDragon `tftchampions-teamplanner.json`에서 `character_id`(apiName)와 `team_planner_code` 필드를 추출하여 Set 16 챔피언만 필터링.

### 2.2 타입 정의

**파일**: `src/types/index.ts` (기존 파일에 추가)

```ts
export interface TeamPlannerEntry {
  apiName: string;
  teamPlannerCode: number;
}

export interface TeamCodeDecodeResult {
  champions: { champion: RawChampion; starLevel: number }[];
  warnings: string[];  // 매핑 실패한 코드 등
}
```

---

## 3. 핵심 로직 상세 설계

### 3.1 `src/lib/teamCode.ts`

이 파일은 **순수 함수**만 포함. React/DOM 의존성 없음.

#### 3.1.1 `decodeTeamCode`

```ts
function decodeTeamCode(
  code: string,
  mapping: TeamPlannerEntry[],
  champions: RawChampion[]
): TeamCodeDecodeResult
```

**알고리즘**:
1. `code.endsWith('TFTSet16')` 검증 → 실패 시 throw
2. hex 부분 추출: `code.slice(0, -8)` → 32자 hex
3. hex → BigInt → 128비트 이진 문자열 (앞에 0 패딩)
4. bits[0..9] → header (챔피언 수, 최대 9)
5. `for i in 0..header`:
   - bits[10 + i*12 .. 10 + i*12 + 9] → teamPlannerCode
   - bits[10 + i*12 + 10 .. 10 + i*12 + 11] → starLevel
6. teamPlannerCode → `mapping.find(m => m.teamPlannerCode === code)` → apiName
7. apiName → `champions.find(c => c.apiName === apiName)` → RawChampion
8. 매핑 실패 시 warnings에 추가하고 해당 슬롯 건너뛰기

**반환**: `{ champions: [...], warnings: [...] }`

#### 3.1.2 `encodeTeamCode`

```ts
function encodeTeamCode(
  team: { champion: RawChampion; starLevel: number }[],
  mapping: TeamPlannerEntry[]
): string
```

**알고리즘**:
1. header = team.length (최대 9)
2. header를 10비트 이진으로
3. 각 챔피언: `mapping.find(m => m.apiName === champ.apiName)?.teamPlannerCode`
   - 10비트 + starLevel 2비트 = 12비트
4. 빈 슬롯(9 - team.length)은 12비트 0으로 채움
5. 나머지 10비트 padding = 0
6. 총 128비트 → BigInt → hex (32자, 소문자)
7. `hex + 'TFTSet16'` 반환

#### 3.1.3 `autoPlaceChampions`

```ts
function autoPlaceChampions(
  decoded: { champion: RawChampion; starLevel: number }[],
  cols: number  // BOARD_COLS = 7
): PlacedChampion[]
```

**배치 전략**: row 0부터 col 0→6 순서로 좌→우, 상→하 배치.

```
Row 0: [0,0] [0,1] [0,2] [0,3] [0,4] [0,5] [0,6]
Row 1: [1,0] [1,1] [1,2] ...
Row 2: ...
Row 3: ...
```

offset 좌표를 axial(`offsetToAxial`)로 변환하여 `PlacedChampion.position` 설정.

---

## 4. 데이터 로딩 설계

### 4.1 `src/data/loader.ts` 변경

```ts
// 추가
let teamPlannerCache: TeamPlannerEntry[] | null = null;

export async function loadTeamPlannerMapping(): Promise<TeamPlannerEntry[]> {
  if (teamPlannerCache) return teamPlannerCache;
  const res = await fetch('/data/tft_set16_teamplanner.json');
  const data: TeamPlannerData = await res.json();
  teamPlannerCache = data.mapping;
  return teamPlannerCache;
}
```

### 4.2 `src/hooks/useGameData.ts` 변경

`useGameData` 훅에 `teamPlannerMapping` 추가:

```ts
export function useGameData() {
  // ... 기존 hooks
  const { teamPlannerMapping, loading: tpLoading } = useTeamPlannerMapping();

  return {
    champions, items, traits, augments,
    teamPlannerMapping,
    loading: champLoading || itemsLoading || traitsLoading || augLoading || tpLoading,
  };
}
```

---

## 5. UI 컴포넌트 설계

### 5.1 `TeamCodePanel` 컴포넌트

**파일**: `src/components/builder/TeamCodePanel.tsx`

```ts
interface TeamCodePanelProps {
  playerTeam: PlacedChampion[];
  enemyTeam: PlacedChampion[];
  champions: RawChampion[];
  teamPlannerMapping: TeamPlannerEntry[];
  onImport: (team: 'player' | 'enemy', champions: PlacedChampion[]) => void;
}
```

**내부 State**:
- `importTarget: 'player' | 'enemy'` — 임포트 대상 팀
- `importCode: string` — 입력된 팀 코드
- `error: string | null` — 에러 메시지
- `warning: string | null` — 경고 메시지 (일부 챔피언 누락 등)
- `copied: 'player' | 'enemy' | null` — 복사 완료 피드백 (2초 후 해제)

**레이아웃**:
```
┌─────────────────────────────────────────────────┐
│ 임포트                                          │
│ [TEAM A ▼][TEAM B] ┌──────────────┐ [로드]     │
│                     │ 팀 코드 입력  │            │
│                     └──────────────┘            │
│ (에러/경고 메시지)                               │
│─────────────────────────────────────────────────│
│ 익스포트                                        │
│ [TEAM A 코드 복사]  [TEAM B 코드 복사]          │
└─────────────────────────────────────────────────┘
```

**스타일링**: 기존 시뮬레이터 다크 테마 유지 (`bg-[#1a1f2e]`, `text-gray-300`, `border-gray-700`)

### 5.2 시뮬레이터 페이지 통합

**파일**: `src/app/simulator/page.tsx` 변경

헤더 영역에 "팀 코드" 토글 버튼 추가:
```tsx
const [showTeamCode, setShowTeamCode] = useState(false);
```

"전체 초기화" 버튼과 "전투 시작" 버튼 사이에 배치.

**임포트 핸들러**:
```ts
const handleTeamCodeImport = (team: 'player' | 'enemy', imported: PlacedChampion[]) => {
  if (team === 'player') setPlayerTeam(imported);
  else setEnemyTeam(imported);
  setSelectedUnit(null);
};
```

패널이 열린 상태에서도 보드/시너지/챔피언풀은 그대로 사용 가능 (오버레이가 아닌 인라인).

---

## 6. 에러 처리 설계

| 에러 | 발생 위치 | 처리 |
|------|----------|------|
| 접미사 "TFTSet16" 없음 | `decodeTeamCode` | `throw new Error('유효하지 않은 팀 코드입니다')` |
| hex 길이 !== 32 | `decodeTeamCode` | `throw new Error('팀 코드 형식이 올바르지 않습니다')` |
| hex 파싱 실패 (비 hex 문자) | `decodeTeamCode` | `throw new Error('팀 코드 형식이 올바르지 않습니다')` |
| header > 9 | `decodeTeamCode` | `throw new Error('팀 코드 형식이 올바르지 않습니다')` |
| teamPlannerCode 매핑 없음 | `decodeTeamCode` | warnings에 추가, 해당 챔피언 건너뛰기 |
| apiName → champion 매핑 없음 | `decodeTeamCode` | warnings에 추가, 해당 챔피언 건너뛰기 |
| 빈 팀 익스포트 | `TeamCodePanel` | 버튼 비활성화 (disabled) |
| 클립보드 API 실패 | `TeamCodePanel` | fallback: `document.execCommand('copy')` |
| 매핑 데이터 미로드 | `TeamCodePanel` | 전체 패널 비활성화 + "데이터 로딩 중..." |

---

## 7. 구현 순서

```
Step 1: 데이터 수집
├── CommunityDragon에서 team_planner_code 추출
└── public/data/tft_set16_teamplanner.json 생성

Step 2: 타입 정의
└── src/types/index.ts에 TeamPlannerEntry, TeamCodeDecodeResult 추가

Step 3: 순수 로직
└── src/lib/teamCode.ts (decodeTeamCode, encodeTeamCode, autoPlaceChampions)

Step 4: 데이터 로딩
├── src/data/loader.ts에 loadTeamPlannerMapping 추가
└── src/hooks/useGameData.ts에 teamPlannerMapping 추가

Step 5: UI 컴포넌트
└── src/components/builder/TeamCodePanel.tsx

Step 6: 페이지 통합
└── src/app/simulator/page.tsx에 TeamCodePanel 연동

Step 7: 빌드 검증
└── pnpm lint && pnpm typecheck && pnpm build
```

---

## 8. 검증 기준

| # | 검증 항목 | 기대 결과 |
|---|----------|----------|
| 1 | 알려진 코드 디코딩 | `0236b02533601935d35901f013012000TFTSet16` → 다리우스, 스웨인, 타릭, 멜, 쉬바나, 아지르, 제라스, 라이즈, 사일러스 (9명) |
| 2 | 라운드트립 | decode → encode → 동일 코드 출력 |
| 3 | 임포트→보드 반영 | 팀 코드 로드 후 보드에 챔피언 표시, 시너지 패널 업데이트 |
| 4 | 익스포트→클립보드 | 복사 버튼 클릭 → 클립보드에 유효한 팀 코드 저장 |
| 5 | 성급 유지 | 2성/3성 챔피언의 star 정보가 인코딩/디코딩에서 보존 |
| 6 | 에러 표시 | 잘못된 코드 입력 시 빨간 에러 메시지 |
| 7 | TEAM A/B 독립 | 각 팀 개별 임포트/익스포트 가능 |
| 8 | 빌드 통과 | `pnpm lint && pnpm typecheck && pnpm build` 성공 |
