# actual-data 기능 설계

> **상태**: Design 단계 — 브레인스토밍 완료, 구현 플랜 작성 대기
> **작성일**: 2026-04-23
> **선행 문서**: `docs/meta/actual-data-brainstorm.md`, `docs/meta/wiki/raw/lolchess/set17-yasuo-tiles.md`, `docs/meta/set17-gods-system.md`
> **대상 패치**: Set 17 (패치 17.1)

## 1. 목적

실제 TFT 경기 영상을 보면서 **라운드별 ground truth**(양 팀 배치/아이템/증강/신 선택/승자/데미지 등)를 수기로 입력해 JSON 파일로 저장하는 내부 툴을 만든다. 저장된 데이터는 시뮬레이션 엔진 검증의 기준 데이터로 쓰인다.

- 영상 파일을 로컬 서버에 **업로드**해서 게임별로 1개씩 저장. mp4/webm만 지원, 외부 URL은 지원하지 않음.
- 편집 페이지 내장 플레이어 + 타임라인 UI로 영상과 JSON 기록을 동시 편집.
- 라운드별 `videoStartTime` / `videoEndTime` + 자유 타임라인 마커(`event` / `note` / `issue`)로 영상 분석 지점 표시.
- 저장된 JSON은 시뮬레이터에 투입해 실제 결과와 diff. 이후 분석 세션에서 JSON + 영상 파일을 함께 참조해 더 정밀한 검증.

### 시뮬레이터 기존 맥락
- 현재 `/simulator`는 단일 팀 편집 + 전투 시뮬.
- 이 툴은 **다중 라운드 스냅샷 편집**이라는 새로운 도메인이라, 기존 4개 슬라이스(`team/battle/replay/ui`)와 별도의 `actualDataSlice`를 추가.
- 보드 편집 UI(`SetupBoard`)는 재사용하되 **presentational + store-bound 2계층으로 리팩터링**하여 외부 state 주입 가능하게 만든다.

## 2. 범위 (Phase 1 — MVP)

### 포함
1. `/actual-data` 게임 리스트 + `/actual-data/[gameId]` 편집 페이지
2. 게임 생성/편집/삭제/목록 API (`GET`/`POST`/`PUT`/`DELETE`)
3. **영상 업로드/스트림/삭제 API** (`POST`/`GET`/`DELETE /api/actual-data/[gameId]/video`) — 로컬 파일시스템 저장, 최대 4GB, mp4/webm
4. **편집 페이지 내장 비디오 플레이어** (`<video>` 태그 기반, 타임라인 바 + 라운드 구간 시각화)
5. **타임라인 마커** (`event` / `note` / `issue` 3종, 게임 레벨 배열)
6. **라운드별 `videoStartTime` + `videoEndTime`** + "현재 영상 시점 지정" 버튼
7. PvP 라운드 편집 (내 팀 + 상대 1명 각각의 full snapshot)
8. Shrine 라운드 편집 (`playerChosenShrine` + 야스오 선택 시 타일 1개)
9. 자동 복사: 내 팀의 units/augments/level/hp/hexModifiers 를 이전 PvP 라운드에서 복사, shrine→PvP 칸 누적
10. 은총 자동 집계 + 수동 확정 UX (야스오 3회 → 칸 ×1.5, 다른 신 2회 이상 → 4번째 증강 슬롯에 해당 신의 은총 증강 자동 제시)
11. **특수 시너지 3종 기록**:
    - **중재자** (`arbiterLaw`): 기존 시뮬 타입 `ArbiterLaw` 재사용, `ArbiterLawPanel` 컴포넌트도 재사용
    - **별돌보미** (`stargazerConstellation` 게임 레벨 + `stargazer.revealedTiles` 팀 레벨): 7개 별자리 중 택1, 보드에 강화 헥스 레벨별 드러남
    - **최신상** (`factoryNew.upgradePath`): 그레이브즈 업그레이드 트리 경로 기록. 3 루트 프레임 × 트리 자식 노드
12. Zod 기반 유효성 검증 (클라/서버 공유 스키마)
13. localStorage draft 복구

### 제외 (Phase 2 이후)
- OCR 자동 채우기 (`unitDamageChart`)
- 8명 상대 전체 기록 (한 PvP에 관측 가능한 다른 7명)
- Shrine 라운드에서 상대 선택 기록
- **이블린 상징** — 시뮬레이터의 기존 "상징 아이템" 데이터로 대체하여 별도 신 기능 없이 다룸
- **쓰레쉬 주사위** — 경제 보상 위주라 전투 영향 없음, 기록 대상 외
- 시뮬 엔진 투입 파이프라인

## 3. 용어

| 용어 | 정의 |
|------|------|
| Game | 한 판 (8명 기준 1게임). 게임당 JSON 파일 1개 |
| Round | 한 스테이지 내의 한 라운드. Set 17은 스테이지당 -1~-7 총 7라운드 |
| PvP 라운드 | 플레이어끼리 전투하는 라운드 (X-2, X-3, X-5, X-6) |
| Shrine 라운드 | 신을 선택하는 라운드 (2-4, 3-4, 4-4 3회) |
| Creep / Carousel | PvE·캐러셀 라운드 (X-1, X-7). **기록 대상 아님** |
| 은총 (Grace) | 4-7 시점에 3회 신 선택을 모두 같은 신으로 채웠을 때 발동되는 특수 증강 |
| 칸 (Tile) | 야스오 신의 보상으로 보드 헥스에 설치되는 영구 효과물 |
| 타임라인 마커 | 영상 특정 시점에 붙는 메타데이터. 유닛 사망, 스킬 발동, 시뮬 diff 관심 지점 등 자유 기록 |
| 업로드 영상 | 게임당 1개 업로드되는 영상 파일. `actual-data/videos/<gameId>.<ext>` 저장, git 제외 |

## 4. 데이터 모델

### 4.1 TypeScript 스키마 전문

```ts
// src/lib/actualData/types.ts (z.infer로 생성됨)

// ─── 파일 단위 ───
interface ActualGameData {
  gameId: string                                       // "game-YYYYMMDD-NNN"
  videoSource: VideoSource                             // 업로드 영상 or 외부 URL or 없음
  patchVersion: string                                 // "17.1"
  playerRiotId: string                                 // "name#tag" 형식
  finalPlacement: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  shrinesInPlay: [ShrineName, ShrineName]              // 이 판에 걸린 신 2명 (서로 다름)
  stargazerConstellation?: StargazerConstellationId    // 이 판에 걸린 별돌보미 별자리 (별돌보미 시너지 안 나오면 undefined)
  timeline: TimelineMarker[]                           // 게임 전체 타임라인 마커 (자유 추가)
  createdAt: string                                    // ISO8601
  updatedAt: string                                    // ISO8601 (서버가 PUT 시 갱신)
  rounds: Round[]                                      // roundName 오름차순, 중복 불가
}

// ─── 영상 소스 ───
// 외부 URL은 지원하지 않음 (업로드 파일만 허용)
type VideoSource =
  | { kind: 'none' }                                   // 영상 없이 게임 생성/편집 가능
  | {
      kind: 'local'
      filename: string                                 // "<gameId>.mp4"
      mimeType: string                                 // "video/mp4" | "video/webm"
      sizeBytes: number
      durationSeconds: number                          // 서버가 ffprobe로 추출 (없으면 null 허용)
      uploadedAt: string                               // ISO8601
    }

// ─── 타임라인 마커 ───
interface TimelineMarker {
  id: string                                           // nanoid 등 로컬 고유 ID (UI key 용도)
  timestamp: number                                    // 초 단위, ≥ 0
  kind: 'event' | 'note' | 'issue'
  label: string                                        // "솔라카 사망", "첫 스킬 발동" 등
  roundIndex?: number                                  // 어느 라운드 범위에 속하는지 (없으면 게임 전체)
  notes?: string                                       // 장문 메모 (선택)
}

// ─── 라운드 ───
type Round = PvPRound | ShrineRound

interface RoundBase {
  roundName: string                                    // "2-3", "3-4" ...
  videoStartTime: number                               // 초 단위 (≥ 0)
  videoEndTime?: number                                // 초 단위, videoStartTime 이상
  notes?: string
}

interface ShrineRound extends RoundBase {
  type: 'shrine'                                       // 2-4 / 3-4 / 4-4 만
  playerChosenShrine: ShrineName
  playerYasuoTile?: YasuoTilePlacement                 // 야스오 선택 시에만
}

interface PvPRound extends RoundBase {
  type: 'pvp'
  playerTeam: TeamSnapshot
  opponent: OpponentSnapshot                           // MVP: 상대 1명. 향후 opponents: [] 확장 여지
  winner: 'player' | 'opponent' | 'draw'
  unitDamageChart?: UnitDamageEntry[]
}

// ─── 팀 스냅샷 ───
interface TeamSnapshot {
  units: PlacedUnit[]
  augments: [AugmentId?, AugmentId?, AugmentId?, AugmentId?]   // 4슬롯, 4번째 = 은총
  level: number                                                 // 1..10
  hp: number                                                    // ≥ 0
  hexModifiers: HexModifier[]                                   // 야스오 칸 (영구, 누적)
  graceApplied?: boolean                                        // shrine 집계로 자동 세팅. 야스오 3회면 true (칸 ×1.5)

  // ─── 시너지별 상세 상태 (활성 시만 채워짐) ───
  arbiterLaw?: ArbiterLaw                                       // 중재자: 기존 시뮬 타입 재사용
  stargazer?: TeamStargazerState                                // 별돌보미: 드러난 강화 칸
  factoryNew?: TeamFactoryNewState                              // 최신상: 그레이브즈 업그레이드 경로
}

interface OpponentSnapshot extends TeamSnapshot {
  riotId?: string                                               // 관측된 경우만
}

interface PlacedUnit {
  championId: string
  hex: HexCoord
  starLevel: 1 | 2 | 3
  items: [ItemId?, ItemId?, ItemId?]
  grants?: UnitGrant[]                                          // 에코 이식 등 신 기원 버프
}

interface UnitGrant {
  source: 'ekko_implant' | 'ekko_grace'
  effectId: string                                              // data/shrines.json 룩업
}

interface HexModifier {
  hex: HexCoord
  tileId: YasuoTileId
  stageGranted: 2 | 3 | 4                                       // 어느 shrine 라운드에서 설치됐는지
}

interface YasuoTilePlacement {
  hex: HexCoord
  tileId: YasuoTileId
}

interface UnitDamageEntry {
  championId: string
  damage: number
}

// ─── 시너지별 상세 타입 ───

// 중재자 (기존 src/types/index.ts 재사용)
interface ArbiterLaw {
  triggerId: string                                    // data/arbiter_laws.json의 trigger 참조
  effectId: string                                     // data/arbiter_laws.json의 effect 참조
}

// 별돌보미 — 게임 레벨(constellationId)은 ActualGameData에, 팀 레벨은 여기
interface TeamStargazerState {
  revealedTiles: HexCoord[]                            // 현재 라운드까지 드러난 강화 헥스 좌표 (레벨에 따라 증가)
  // 누적 카운터 (제물 수, 표식 수 등)는 MVP 제외 — 시뮬 투입 시 유효 시점 상태만 참조
}

// 최신상 — 그레이브즈 보유 팀만
interface TeamFactoryNewState {
  upgradePath: FactoryNewUpgradeId[]                   // 선택 순서대로 누적. [0]은 반드시 프레임 3종 중 1개
  nextUpgradeRoundsRemaining?: number                  // 다음 업그레이드까지 남은 라운드 수 (관찰 가능하면 기록)
}

// ─── 유니온 ───
type YasuoTileId =
  | 'solar' | 'cryo' | 'starlight' | 'accel' | 'storm' | 'cosmic'

type ShrineName =
  | 'ahri' | 'aurelionSol' | 'ekko' | 'evelynn'
  | 'kayle' | 'soraka' | 'thresh' | 'varus' | 'yasuo'

type StargazerConstellationId =
  | 'altar' | 'boar' | 'well' | 'huntress' | 'medal' | 'mountain' | 'snake'
  // 추가 별자리 발견 시 확장

type FactoryNewUpgradeId = string                      // data/factory_new_upgrades.json 참조
  // 영문 key: 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap' (3 프레임 루트)
  // 하위 노드 예: 'LeechingImplants', 'BlastRadius2', 'Fission3' 등
  // "Choke" 이름이 3곳에 등장 — id에 parent path suffix 추가 권장 (예: 'Choke_LeechingImplants2')

type AugmentId = string    // data/augments.json 참조. 은총은 augment metadata의 tier='grace'
type ItemId = string       // data/items.json 참조
type HexCoord = { q: number; r: number }     // 기존 시뮬 타입 재사용

// ─── 보조 타입 ───
// 게임 리스트 API 응답용 (각 파일 헤더만 파싱)
type ActualGameSummary = Pick<
  ActualGameData,
  'gameId' | 'videoSource' | 'patchVersion' | 'finalPlacement' | 'updatedAt'
>

// 새 게임 생성 시 필수로 받는 메타 (POST 바디)
// videoSource는 항상 { kind: 'none' }으로 서버가 설정 — 업로드 후 local로 전환
type NewGameMeta = {
  patchVersion: string
  playerRiotId: string
  shrinesInPlay: [ShrineName, ShrineName]
}

// 게임 레벨 메타 편집 시 사용 (rounds와 timestamps 제외)
type ActualGameMeta = Omit<
  ActualGameData,
  'gameId' | 'createdAt' | 'updatedAt' | 'rounds' | 'timeline'
>
```

### 4.2 Zod 스키마 (클라/서버 공유)

`src/lib/actualData/schema.ts`에 Zod 스키마 단일 정의. TypeScript 타입은 `z.infer<>`로 도출. 주요 refinement:

- `shrinesInPlay`: 길이 2 + 서로 다른 값
- `rounds[].roundName`: 오름차순, 중복 금지 (`superRefine`)
- `rounds[].videoEndTime`: 제공된 경우 `videoStartTime` 이상
- `augments`: 길이 4 고정. 4번째 슬롯이 있을 경우 해당 AugmentId는 `augments.json`에서 `tier === 'grace'` 여야 함 (런타임 참조 검증)
- `HexCoord`: 보드 범위 내 (q/r 제약은 기존 시뮬과 동일)
- `starLevel ∈ {1,2,3}`, `level ∈ [1,10]`, `hp ≥ 0`, `videoStartTime ≥ 0`, `finalPlacement ∈ [1,8]`
- `playerRiotId`: `/^.{3,16}#[A-Z0-9]{3,5}$/i` 대략 형태
- `videoSource`: discriminated union — `kind: 'local'`이면 `sizeBytes > 0`, `durationSeconds ≥ 0` (또는 null), `mimeType ∈ {'video/mp4', 'video/webm'}`
- `timeline[].timestamp`: `≥ 0`. 업로드 영상이 있을 때는 `videoSource.durationSeconds`보다 작거나 같아야 (soft warn, 검증 강제 X — 업로드 전후 편집 지원)
- `timeline[].kind ∈ {'event','note','issue'}`, `label` 비어있지 않음
- `timeline[].roundIndex`: 제공된 경우 `rounds` 유효 인덱스 범위

## 5. 자동 복사 & 누적 규칙

### 5.1 "+ PvP 라운드 추가" 시
직전 내 PvP 라운드의 `playerTeam`을 기반으로 새 PvP 라운드 생성:

1. `units`: 그대로 복사 (각 유닛의 `hex`, `starLevel`, `items`, `grants` 유지)
2. `augments`: 그대로 복사
3. `level`, `hp`: 그대로 복사 (사용자가 수정 전제)
4. `hexModifiers`:
   - 직전 PvP 라운드의 `hexModifiers` 복사
   - **사이에 끼어있는 shrine 라운드들**에서 `playerYasuoTile`이 있으면 `{ hex, tileId, stageGranted }` 로 변환해 추가
5. `graceApplied`: shrine 집계로 자동 계산 (야스오 3회 shrine 선택 시 true)
6. `opponent`: **빈 상태로 시작** (자동 복사 없음)
7. `videoStartTime`: 업로드 영상이 재생 중이면 **현재 `currentTime`으로 자동 설정**. 없으면 직전 PvP의 `videoEndTime` 또는 0
8. `videoEndTime`: 미설정 (사용자가 나중에 "지정" 버튼으로 채움)

### 5.2 "+ Shrine 라운드 추가" 시
빈 상태로 생성 (`playerChosenShrine`, `playerYasuoTile` 미정). `videoStartTime`은 5.1 규칙 7번과 동일.

### 5.3 상대 자동 복사
**없음**. UI helper `OpponentQuickFill`로 `riotId` 기준 이전 만남 드롭다운 → 사용자가 선택하면 해당 스냅샷 복사. 자동 아님.

### 5.4 구현 위치
`src/lib/actualData/roundFactory.ts` — React/Zustand 비의존 순수 함수:
```ts
buildNextPvPRound(roundName, previousPvP, shrineRoundsBetween): PvPRound
accumulateHexModifiers(base, newShrineRounds): HexModifier[]
generateGameId(existingIds): string
```

슬라이스 액션은 이 유틸을 호출만.

## 6. API 명세

### 6.1 게임 JSON API

#### `GET /api/actual-data`
- 응답: `{ games: ActualGameSummary[] }`
- 디렉토리 스캔 후 각 파일 헤더만 파싱 (라운드/타임라인 배열은 읽지 않음 — 최적화)

#### `GET /api/actual-data/[gameId]`
- 응답 200: `ActualGameData`
- 파일 없으면 404

#### `POST /api/actual-data`
- 요청 바디:
```json
{ "patchVersion": "17.1", "playerRiotId": "name#TAG",
  "shrinesInPlay": ["yasuo", "ekko"] }
```
- `videoSource`는 서버에서 항상 `{ kind: 'none' }` 초기화 — 영상 업로드는 `POST /video` 엔드포인트로 별도
- 서버: 오늘 날짜 기존 파일 스캔 → NNN 증가 → 새 `gameId`로 파일 생성 (`writeFile`, `{flag:'wx'}`)
- 응답 201: `{ gameId, createdAt, updatedAt }`

#### `PUT /api/actual-data/[gameId]`
- 요청 바디: `ActualGameData` 전체
- 서버: Zod 검증 → 실패 시 400. `updatedAt` 서버 타임스탬프로 교체 → 덮어쓰기 저장
- 응답 200: `{ ok: true, updatedAt }`

#### `DELETE /api/actual-data/[gameId]`
- 파일 즉시 삭제. 업로드 영상도 함께 삭제 (`videos/<gameId>.<ext>`)
- 응답 204

### 6.2 영상 파일 API

#### `POST /api/actual-data/[gameId]/video`
- `Content-Type: multipart/form-data` 또는 `application/octet-stream` 스트리밍
- Next.js route는 **Node.js runtime** (Edge 아님) + `export const runtime = 'nodejs'`
- 서버:
  1. 파일 크기 확인 (헤더 기반 pre-check, 4GB 초과 시 413)
  2. MIME 체크 (`video/mp4`, `video/webm`만 허용)
  3. 확장자 결정: mime → ext (`mp4`/`webm`)
  4. 기존 업로드 파일 있으면 먼저 삭제 (중복 확장자 방지)
  5. `actual-data/videos/<gameId>.<ext>`로 스트리밍 저장
  6. `ffprobe` 호출 → `durationSeconds` 추출 (ffprobe 없으면 null)
  7. 해당 게임 JSON을 읽어 `videoSource = { kind: 'local', filename, mimeType, sizeBytes, durationSeconds, uploadedAt }` 업데이트 → `updatedAt` 갱신 후 저장
- 응답 200: `{ videoSource: VideoSource, updatedAt }`
- 실패 코드: 400(mime), 404(게임 없음), 413(크기), 500(디스크/ffprobe)

#### `GET /api/actual-data/[gameId]/video`
- 영상 스트리밍 (Range 요청 지원 — `<video>` 태그 스크럽용)
- 파일 없으면 404
- 응답 헤더: `Accept-Ranges: bytes`, `Content-Type`은 저장된 mimeType

#### `DELETE /api/actual-data/[gameId]/video`
- 업로드 파일 삭제 → 게임 JSON의 `videoSource = { kind: 'none' }`로 업데이트
- 응답 200: `{ videoSource: { kind: 'none' }, updatedAt }`

### 6.3 공통 에러 포맷
```json
{ "error": "validation" | "not_found" | "conflict" | "too_large" | "unsupported_media" | "internal",
  "message": string, "issues"?: ZodIssue[] }
```

### 6.4 저장 위치
- 게임 JSON: `<repoRoot>/actual-data/<gameId>.json` (리포 루트 `process.cwd()` 기준). **git 포함**, 2-space 들여쓰기
- 영상 파일: `<repoRoot>/actual-data/videos/<gameId>.<ext>`. **`.gitignore`에 `actual-data/videos/` 추가, git 제외**
- ffprobe 의존성: 없으면 durationSeconds는 null로 두고 플레이어 로드 후 클라이언트에서 `onLoadedMetadata`로 보정해 PUT

## 7. 페이지 & 라우트

```
src/app/actual-data/
├── page.tsx                        # 리스트 (서버 컴포넌트 + 'use client' 내부 아일랜드)
└── [gameId]/
    └── page.tsx                    # 편집 (클라이언트 컴포넌트)

src/app/api/actual-data/
├── route.ts                        # GET(list) + POST(create)
└── [gameId]/
    ├── route.ts                    # GET + PUT + DELETE (게임 JSON)
    └── video/
        └── route.ts                # POST + GET + DELETE (영상 파일)
```

### 편집 페이지 레이아웃
```
┌──────────────────────────────────────────────────────────────────────┐
│ [← 뒤로] Game: game-20260423-001    [게임 메타 편집] [SaveStatus]    │
├──────────┬───────────────────────────────────────────────────────────┤
│ 라운드    │ ┌─ VideoPlayer (내장 <video>) ─────────────────────────┐  │
│ 리스트    │ │   [재생] 03:42 / 28:15   [속도 1.0x] [재생위치:지정]  │  │
│ 2-2 ✓    │ └───────────────────────────────────────────────────────┘  │
│ 2-3 ●    │ ┌─ TimelineBar ──────────────────────────────────────────┐ │
│ 2-4 ◇    │ │ ▓▓▓(2-2)▓(2-3)─(2-4)─▓(2-5)─(2-6)   ● ◆ ▲ (마커들)     │ │
│ (shrine)  │ └────────────────────────────────────────────────────────┘ │
│ 2-5      │  [라운드명: 2-3] [시작: 04:23] [종료: 05:18] [+ 마커]      │
│ + PvP    │                                                            │
│ + Shrine │  PvPRoundEditor:                                           │
│          │  ┌─ 내 팀 (TeamEditor) ─┐  ┌─ 상대 (OpponentPanel) ┐       │
│          │  │ SetupBoardCore      │  │ SetupBoardCore       │        │
│          │  │ AugmentSlotsQuad    │  │ AugmentSlotsQuad     │        │
│          │  │ level, hp           │  │ level, hp, riotId    │        │
│          │  │ GraceToggle         │  │ GraceToggle          │        │
│          │  │ HexModifierOverlay  │  │ HexModifierOverlay   │        │
│          │  └─────────────────────┘  └─────────────────────┘         │
│          │  winner, damageChart, notes                                │
│          │                                                            │
│          │  [영상이 아직 업로드되지 않은 경우 이 영역 상단에 │
│          │   VideoUploader 드롭존이 플레이어 대신 표시됨]    │
└──────────┴───────────────────────────────────────────────────────────┘
```

## 8. 컴포넌트 분해

```
src/components/actual-data/
├── GameListTable.tsx           # /actual-data 리스트 (편집/삭제/새로 만들기)
├── NewGameDialog.tsx           # 필수 메타 입력 모달 (patchVersion/playerRiotId/shrinesInPlay)
├── ActualDataEditor.tsx        # 편집 페이지 레이아웃 (사이드바 + 메인)
├── GameMetaEditor.tsx          # videoSource/patchVersion/playerRiotId/shrinesInPlay/finalPlacement 편집
│
├── video/                      # 영상 + 타임라인 관련
│   ├── VideoPlayer.tsx         # <video> 래퍼, currentTime을 슬라이스에 브로드캐스트
│   ├── VideoUploader.tsx       # 드롭존 + 진행률 표시, POST /video
│   ├── TimelineBar.tsx         # 라운드 구간 + 마커 시각화, 클릭 시 seek
│   ├── TimelineMarkerDialog.tsx # 마커 추가/편집 모달 (kind/label/roundIndex/notes)
│   └── VideoSourceIndicator.tsx # 현재 videoSource 상태 배지 (업로드/외부/없음)
│
├── RoundList.tsx               # 좌측 라운드 리스트 + "+ PvP" / "+ Shrine"
├── RoundEditor.tsx             # PvP vs Shrine 타입 분기 래퍼
├── PvPRoundEditor.tsx          # winner, damageChart, notes, 양 팀 편집
├── ShrineRoundEditor.tsx       # playerChosenShrine 선택 + (야스오시) YasuoTilePicker
├── RoundTimestampInputs.tsx    # videoStartTime/videoEndTime + "현재 시점 지정" 버튼
│
├── TeamEditor.tsx              # 내 팀/상대 공통 편집 컨테이너
├── OpponentPanel.tsx           # TeamEditor + riotId + OpponentQuickFill
├── OpponentQuickFill.tsx       # "이전 만난 상대에서 복사" 드롭다운
├── AugmentSlotsQuad.tsx        # 슬롯 4개 (4번째만 tier='grace' 필터)
├── HexModifierOverlay.tsx      # SetupBoardCore 위 야스오 칸 + 별돌보미 강화 칸 시각 표시
├── YasuoTilePicker.tsx         # 6종 중 1개 선택 (stage별 가용성 반영)
├── DamageChartInput.tsx        # 유닛별 데미지 수동 입력 테이블
├── GraceStatus.tsx             # 4-7 은총 자동 계산 결과 표시 + 사용자 확정 버튼
│
├── synergy/                    # 시너지별 편집 패널
│   ├── ArbiterLawEditor.tsx    # 기존 src/components/builder/ArbiterLawPanel.tsx 재사용 래퍼
│   ├── StargazerPanel.tsx      # 게임 레벨 별자리 선택 (GameMetaEditor에서 사용)
│   ├── StargazerTilesEditor.tsx # 팀 레벨 revealedTiles 편집 (헥스 클릭 토글)
│   ├── FactoryNewPanel.tsx     # 업그레이드 트리 시각화 + 누적 경로 선택
│   └── FactoryNewNode.tsx      # 트리 노드 (선택/비선택/잠금 상태)
│
└── SaveStatusBar.tsx           # 저장 상태 표시 우상단 뱃지
```

### 기존 컴포넌트 리팩터링

| 기존 파일 | 리팩터링 |
|----------|---------|
| `src/components/battle/SetupBoard.tsx` | **분리**: `SetupBoardCore.tsx` (presentational, props로 team/onChange 주입) + `SetupBoardWithStore.tsx` (teamSlice 바인딩 래퍼). 기존 `src/app/simulator/page.tsx`는 `SetupBoardWithStore` 사용으로 치환 |
| `src/components/builder/AugmentSelector.tsx` | 슬롯 수를 prop으로 받도록 경미한 확장. 슬롯 인덱스별 필터(예: 4번째 슬롯에 grace tier만 제공) 지원 |
| `src/components/builder/ArbiterLawPanel.tsx` | **그대로 재사용** — `law` / `onChange` props 기반이라 actual-data 슬라이스에서 바로 바인딩 가능 |
| `src/components/builder/ItemGrid.tsx` 등 | 변경 없이 재사용 |

### 기존 컨벤션 준수
- `app/` 내부 `page.tsx`, `layout.tsx`는 서버 컴포넌트 유지
- 컴포넌트 PascalCase, 유틸 camelCase
- 절대 경로 임포트 (`@/components/actual-data/...`)
- `any` 금지, `console.log` 커밋 금지
- `useEffect` 내 setState 금지 (React Compiler 규칙)

## 9. Zustand 슬라이스

```ts
// src/store/actualDataSlice.ts

interface ActualDataState {
  currentGame: ActualGameData | null
  currentRoundIndex: number | null
  isDirty: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  saveError: string | null
  lastSavedAt: string | null
  gameListCache: ActualGameSummary[] | null

  // Game lifecycle
  loadGame(gameId: string): Promise<void>
  createGame(meta: NewGameMeta): Promise<string>
  deleteGame(gameId: string): Promise<void>
  saveCurrentGame(): Promise<void>
  refreshGameList(): Promise<void>

  // Round navigation
  setCurrentRound(index: number): void
  addPvPRound(roundName: string): void
  addShrineRound(roundName: string): void
  removeRound(index: number): void

  // Round field updates
  updateRoundMeta(index: number, patch: Partial<RoundBase>): void
  updatePlayerTeam(index: number, patch: Partial<TeamSnapshot>): void
  updateOpponent(index: number, patch: Partial<OpponentSnapshot>): void
  updateShrineChoice(index: number, patch: Partial<ShrineRound>): void
  toggleGrace(index: number, team: 'player' | 'opponent'): void

  // Game meta
  updateGameMeta(patch: Partial<ActualGameMeta>): void

  // Video (영상 파일 관리)
  uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<void>
  deleteVideo(): Promise<void>
  patchVideoDuration(seconds: number): void  // 클라이언트에서 onLoadedMetadata로 보정

  // Video playback (슬라이스는 시간만 추적, <video> 요소는 VideoPlayer가 소유)
  currentPlaybackTime: number    // 0
  setPlaybackTime(seconds: number): void      // VideoPlayer가 timeupdate에서 호출
  seekRequest: { seconds: number; nonce: number } | null  // seek 트리거 (VideoPlayer 구독)
  requestSeek(seconds: number): void

  // Timeline markers
  addMarker(marker: Omit<TimelineMarker, 'id'>): void
  updateMarker(id: string, patch: Partial<TimelineMarker>): void
  removeMarker(id: string): void

  // Round video timestamp helpers
  setRoundStartToCurrent(index: number): void  // videoStartTime = currentPlaybackTime
  setRoundEndToCurrent(index: number): void    // videoEndTime = currentPlaybackTime

  // Synergy: 중재자
  updateArbiterLaw(index: number, team: 'player' | 'opponent', law: ArbiterLaw | null): void

  // Synergy: 별돌보미
  setStargazerConstellation(id: StargazerConstellationId | null): void    // 게임 레벨
  toggleStargazerRevealedTile(index: number, team: 'player' | 'opponent', hex: HexCoord): void

  // Synergy: 최신상
  addFactoryNewUpgrade(index: number, team: 'player' | 'opponent', upgradeId: FactoryNewUpgradeId): void
  // 트리 검증: 부모가 이미 선택됐는지 + 중복 여부 체크 후 에러/성공
  removeFactoryNewUpgrade(index: number, team: 'player' | 'opponent'): void  // 마지막 항목 pop
  setFactoryNewRoundsRemaining(index: number, team: 'player' | 'opponent', n: number): void

  // UI helper
  copyOpponentFromPreviousMeeting(index: number, riotId: string): void
}
```

### 슬라이스 경계
- actualDataSlice는 teamSlice/battleSlice/replaySlice/uiSlice를 **참조하지 않음**
- teamSlice와 도메인이 다름(시뮬 실행 vs ground truth 기록)
- 교차 동작 — "이 라운드를 teamSlice로 복사해서 시뮬 돌려보기"는 **명시적 복사 액션**(별도 `lib/actualData/toSim.ts`)에서만. 자동 양방향 동기화 없음.

## 10. 에러 핸들링

### 파일 경합
- MVP에서는 **lost-update 수용**. 두 탭에서 같은 gameId 편집 시 마지막 PUT이 승자.
- 응답의 `updatedAt`이 로컬 값보다 미래이면 "다른 탭에서 저장됨" 배너 + "새로고침" 버튼 노출.
- optimistic lock 미도입 (MVP 스코프 밖).

### 저장 실패
- `saveStatus: 'error'` + `saveError: string`
- 우상단 `SaveStatusBar`에 "저장 실패 — 재시도" 버튼
- **자동 재시도 없음** (사용자 명시적 재시도만)
- 실패 시 `localStorage.setItem('actualData:draft:<gameId>', JSON.stringify(currentGame))`로 draft 백업
- 다음 페이지 로드 시 draft 있으면 "복구할까요?" 프롬프트

### 스키마 검증
- 서버 PUT 400 응답: `{ error: 'validation', issues: ZodIssue[] }`
- 클라이언트: 저장 직전 동일 Zod 스키마로 선검증 → 필드별 빨간 테두리 + 에러 메시지
- 공유 스키마 덕분에 서버에 도달하기 전에 대부분 걸러짐

### 404 / 충돌
- GET 404 → 리스트로 리다이렉트 + 토스트
- POST 동시 gameId 충돌(writeFile `wx` 플래그) → 서버가 한 번 재시도 (NNN+1). 두 번째도 실패 시 500

### 영상 업로드 에러
- **413 too_large**: 4GB 초과 → "파일이 너무 큽니다 (최대 4GB)" 토스트. 업로드 중이면 abort.
- **400 unsupported_media**: mp4/webm/mov 외 → "지원하지 않는 포맷" 토스트
- **네트워크 중단**: `XMLHttpRequest.abort()` 또는 `AbortController` → "업로드 취소됨" + 재시도 버튼
- **중간 실패 시 부분 파일 정리**: 서버가 `try/finally`로 실패 시 `fs.unlink` 호출
- **ffprobe 미설치**: duration 추출 실패해도 업로드 성공. `videoSource.durationSeconds = null`. 클라이언트가 `<video>` `onLoadedMetadata`에서 duration 받아 `patchVideoDuration` 호출 → PUT으로 반영
- **업로드 진행률**: `XMLHttpRequest.upload.onprogress` 또는 `fetch` Streams. VideoUploader가 슬라이스에 진행률 state 브로드캐스트

### 영상 재생 에러
- 영상 파일이 디스크에서 지워졌거나 경로 꼬임 → `<video>` `onError` → 사용자에게 "영상 파일 손상/누락 — 재업로드 필요" 표시 + `DELETE /video` 후 재업로드 유도

### 상태별 UX
| saveStatus | 표시 |
|-----------|------|
| idle | "저장됨 HH:MM" |
| saving | "저장 중..." |
| saved | 2초간 "✓ 저장됨" → idle |
| error | "⚠ 저장 실패 [재시도]" |

- `isDirty === true`이면 `beforeunload`로 "저장 안 된 변경사항이 있습니다" 경고

## 11. UX 흐름

### 새 게임 생성
1. `/actual-data` → "새 게임 만들기" 클릭
2. `NewGameDialog` — `patchVersion`, `playerRiotId`, `shrinesInPlay` 필수
3. `POST /api/actual-data` → 생성된 gameId로 `/actual-data/[gameId]` 이동
4. 편집 페이지 상단 영상 영역:
   - `videoSource.kind === 'none'` → **VideoUploader 드롭존**이 플레이어 자리에 표시
   - `kind === 'local'` → 내장 VideoPlayer

### 영상 업로드
1. 편집 페이지의 VideoUploader 드롭존에 파일 드롭 or "파일 선택"
2. 클라이언트 pre-check: 크기 ≤ 4GB, mime ∈ {mp4, webm, mov}
3. `POST /api/actual-data/[gameId]/video` — 진행률 표시 (%, 전송된 바이트)
4. 완료 시 서버가 업데이트한 `videoSource` 수신 → 슬라이스 반영 → 플레이어 자동 로드
5. `<video>` `onLoadedMetadata`에서 실제 duration 확인 → 서버값 없으면 `patchVideoDuration` 호출 → PUT

### 영상 교체/삭제
1. "영상 교체" 버튼 → 확인 모달 → `DELETE /video` → 드롭존으로 복귀 → 새 업로드
2. 영상 삭제 시 `videoSource = { kind: 'none' }` — 게임 JSON은 유지. 재업로드로 local 복원 가능

### 라운드 추가 (+ PvP 2-5)
1. 좌측 `RoundList`에서 "+ PvP" → 다음 roundName 자동 제안 ("2-5")
2. `buildNextPvPRound` 호출 — 직전 내 PvP(2-3) 복사 + 사이 shrine(2-4) 칸 누적
3. `videoStartTime`에 현재 영상 `currentPlaybackTime`을 자동 대입
4. 생성 후 즉시 편집 모드 진입

### 라운드 타임스탬프 기록
1. 영상 재생하면서 라운드 시작 지점에 도달 → 해당 라운드 편집 영역의 "시작 지정" 버튼 클릭 → `setRoundStartToCurrent`
2. 라운드 종료 지점 → "종료 지정" 버튼 → `setRoundEndToCurrent`
3. TimelineBar에 해당 라운드 구간이 bar로 시각화

### 타임라인 마커 추가
1. 영상 재생 중 주목할 이벤트 발생 → "+ 마커 추가" 버튼
2. `TimelineMarkerDialog` 열림 — kind(event/note/issue), label, 현재 라운드 자동 지정(편집 가능), 자유 notes
3. 저장 → TimelineBar에 dot/icon으로 표시, 클릭 시 해당 시점으로 seek

### 라운드 편집
1. 좌측 리스트에서 선택 → 우측 `RoundEditor` 활성
2. 선택한 라운드의 `videoStartTime`이 영상 currentTime으로 자동 seek (옵션)
3. PvP면 내 팀/상대 양쪽 편집 가능. Shrine이면 신 선택 UI
4. 필드 변경 시 `isDirty = true`
5. "저장" 버튼 or 자동 저장(§14.1에서 주기 결정) → `PUT`

### 상대 재조우 복사
1. 새 PvP 라운드에서 `OpponentQuickFill` 드롭다운에 이전에 기록된 상대 riotId 목록
2. 선택 → 해당 상대의 가장 최근 스냅샷이 `opponent`에 복사됨
3. 사용자가 델타만 수정

## 12. Phase 경계

### Phase 1 (이 스펙)
위 범위 전체. 영상 업로드 + 타임라인 + 3개 특수 시너지 (중재자 / 별돌보미 / 최신상) 기록까지 포함.

**시뮬 엔진 구현 상태 (Phase 1 완료 시점)**:
- **중재자**: 시뮬 엔진에 이미 구현되어 있음 — `ArbiterLaw` 그대로 시뮬 투입 가능
- **별돌보미**: 시뮬 엔진 **미구현** — actual-data에는 기록만. 시뮬 투입 시 효과 미반영
- **최신상**: 시뮬 엔진 **미구현** — 그레이브즈 업그레이드 경로는 기록만. 시뮬에서는 원본 그레이브즈 스탯으로 계산됨

### Phase 2 — 확장 (별도 스펙)
- **OCR 자동 채우기** (unitDamageChart) — 업로드된 영상 프레임 → OCR 파이프라인. Phase 1의 영상 파일 + `timeline`이 이 Phase의 인풋이 됨
- **별돌보미 시뮬 엔진 구현** — 7개 별자리 × 강화 칸 효과 적용 로직
- **최신상 시뮬 엔진 구현** — 업그레이드 트리 효과 그레이브즈에 적용
- **8명 상대 전체 기록** — `opponents: OpponentSnapshot[]` 배열 확장. MVP는 길이 1. 스키마에서 배열로 선언해 두면 필드 변경 없이 길이만 풀면 됨
- **Shrine 라운드에서 상대 선택 기록** — 멀티뷰 환경 한정

### Phase 3 — 시뮬 검증 파이프라인 (별도 스펙)
- 저장된 PvP 라운드를 시뮬 엔진에 투입 → 실제 winner/damageChart와 diff
- 배치 검증 모드: 모든 게임 스캔 → 정확도 % 리포트
- Phase 1의 `timeline[].kind === 'issue'` 마커를 자동으로 diff 리포트에 링크

## 13. 영상 파일 관리 정책

- **저장 위치**: `<repoRoot>/actual-data/videos/<gameId>.<ext>`
- **git 제외**: `.gitignore`에 `actual-data/videos/` 라인 추가. JSON은 공유되지만 영상은 각 기기 로컬 전용
- **공유 방법 (다른 컴퓨터)**: JSON은 git pull로 자동 공유됨. 영상은 수동 복사(외장 드라이브, 클라우드, scp 등)해 동일 경로에 두면 `videoSource.filename` 그대로 재생 가능
- **디스크 용량 모니터링**: MVP에서는 경고 없음. 향후 리스트 페이지에 총 영상 용량 표시 고려
- **백업 책임**: 사용자. 영상은 소스 영상에서 재획득 가능한 파생 데이터로 취급
- **ffmpeg/ffprobe 의존성**: `POST /video`에서 `ffprobe`로 duration 추출. 없으면 null 허용 + 클라이언트 보정. 설치 가이드를 README에 명시

## 14. 결정된 사양 (사용자 답변 반영)

1. **자동 저장 주기**: **30초** 확정. `isDirty === true`일 때만 트리거, 사용자가 수동 저장하면 타이머 리셋
2. **은총 규칙** (수동 토글이 아니라 집계 기반 자동 부여):
   - **야스오**만 특수 — **3회 shrine 라운드 모두 야스오** 선택 시에만 "야스오의 은총" 활성화. 효과: 설치된 모든 칸 위력 ×1.5 (`TeamSnapshot.graceApplied = true` 자동 세팅)
   - **나머지 신 (8종)** — **2회 이상 동일 신** 선택 시, 4-7 이후 해당 팀 **4번째 증강 슬롯에 그 신의 은총 증강**이 부여됨 (아리의 은총, 바루스의 은총 등). 일반 `AugmentId`로 처리, `tier === 'grace'` 메타데이터
   - 자동 추론: `rounds` 중 shrine 타입의 `playerChosenShrine` 집계 → 조건 충족 시 자동으로 해당 팀 4-7 이후 PvP 라운드의 `augments[3]`에 은총 후보 제시. 사용자가 확인 클릭으로 확정
3. **야스오 칸 위치 제약**:
   - 플레이어가 **원하는 헥스에 자유 배치** (보드 범위 내 어디든)
   - 헥스에 **유닛이 없어도** 배치 가능
   - 일단 설치되면 **위치 변경 불가**(영구). 후속 라운드에서 `YasuoTilePlacement.hex`는 readonly 렌더
4. **영상 업로드 최대 크기**: **4GB** 확정
5. **영상 없는 게임**: 영구 허용. 승/패 + 데미지만 기록해도 시뮬 검증 가치 유지
6. **외부 URL**: **지원하지 않음**. `VideoSource = 'none' | 'local'`만

## 15. 설계 리스크

- **Zustand 리렌더 성능**: `currentGame`이 크면(라운드 수 많을 때) 개별 필드 변경마다 구독 컴포넌트 전체 리렌더. 대응: selector로 subset 구독, `zustand/shallow` 사용. 측정 후 필요 시 Immer 도입. `currentPlaybackTime`은 50ms 스로틀 처리 (timeupdate 이벤트가 초당 4~60회).
- **SetupBoard 리팩터링 파급**: 기존 `simulator/page.tsx` 외에도 `HexBoard`, `ReplayBoard`가 비슷한 구조일 가능성. 리팩터링 전 의존성 스캔 필요.
- **파일 기반 저장의 검색성 한계**: 파일이 많아지면 리스트 페이지 로딩 느려질 수 있음. MVP는 디렉토리 스캔 + 헤더만 파싱으로 대응. 장기적으로는 인덱스 파일 또는 SQLite 도입 고려.
- **대용량 영상 업로드 안정성**: Next.js 기본 body 파서가 대용량에 취약. Node.js runtime + 커스텀 스트리밍 핸들러 필수. 업로드 중 연결 끊김 → 서버 임시 파일 청소 누락 가능성. `try/finally`로 확실한 cleanup + 주기적 `actual-data/videos/` 오판 파일 점검 스크립트 고려.
- **Next.js Route `runtime = 'nodejs'` 전용**: 영상 파일 스트리밍/저장 때문에 Vercel Edge 함수 사용 불가. 배포 대상 환경 확인 필요 (이 프로젝트는 로컬/자체 호스팅 위주라 영향 없음).

## 16. 참고 문서

- `docs/meta/actual-data-brainstorm.md` — 어제까지의 브레인스토밍 WIP (Q1~Q8)
- `docs/meta/wiki/raw/lolchess/set17-yasuo-tiles.md` — 야스오 칸 수치 확정본 (lolchess.gg 긁기 결과)
- `docs/meta/set17-gods-system.md` — Set 17 신 시스템 개요 (추정 수치, yasuo-tiles 쪽이 우선)
- `docs/meta/wiki/raw/lolchess/set17-stargazer-constellations.md` — 별돌보미 7개 별자리 수치
- `docs/meta/wiki/raw/lolchess/set17-factory-new-arsenal.md` — 최신상 무기고 트리 (DOM 정확 복원 + 영문 key)
- `docs/meta/simulator-synergy-todos.md` — 별돌보미/최신상 시뮬 엔진 구현 TODO (Phase 2 대상)
- `docs/meta/user_tft_knowledge.md` — 유저 TFT 지식 프로파일
- `CLAUDE.md` — 프로젝트 전반 규칙
- 선행 Spec 예시: `docs/superpowers/specs/2026-04-22-mobile-tablet-simulator-redesign.md`
- 기존 구현 참고:
  - `src/types/index.ts:331` — `ArbiterLaw` 타입
  - `src/components/builder/ArbiterLawPanel.tsx` — 중재자 편집 UI (재사용)
  - `src/data/arbiter_laws.json` — 중재자 법률 데이터
