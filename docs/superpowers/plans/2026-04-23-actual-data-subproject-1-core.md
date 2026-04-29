# actual-data Sub-project 1 — Core (CRUD + 라운드 편집) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 TFT 경기 영상의 ground truth를 JSON으로 수기 입력/저장하는 툴의 **코어 기능**(게임 CRUD + 라운드 편집 + 자동 복사 + 은총 자동 집계)을 구현한다. 영상/타임라인/시너지 UI는 Sub-project 2, 3에서.

**Architecture:**
- 도메인 타입을 Zod 스키마 1벌로 정의하고 `z.infer`로 TS 타입 도출, 클라/서버 공유
- Zustand `actualDataSlice` 추가 (기존 4개 슬라이스와 독립)
- 순수 함수(`roundFactory`, `graceInference`)에 로직 집중, 슬라이스는 이들을 호출만
- 기존 `SetupBoard`를 `SetupBoardCore` (presentational) + `SetupBoardWithStore` (teamSlice 래퍼)로 분리, actual-data는 Core를 props로 주입

**Tech Stack:** Next.js 16 App Router, TypeScript, Zustand, Zod (신규), nanoid (신규), Vitest, TailwindCSS

**Scope (Sub-project 1)**:
- ✅ 포함: 게임 CRUD API, 리스트/편집 페이지, PvP/Shrine 라운드 편집, 자동 복사, 은총 자동 집계, Zod 검증, localStorage draft
- ⛔ 제외: 영상 업로드/플레이어 (Sub-project 2), 타임라인 마커 (Sub-project 2), 시너지 UI — 중재자/별돌보미/최신상 (Sub-project 3)
- 데이터 스키마에는 `videoSource`, `timeline`, `arbiterLaw`, `stargazer`, `factoryNew` 필드 **정의만 포함** (Sub-project 2/3이 이 타입 기반으로 UI 추가). 이번 스펙에서는 생성 시 기본값(`videoSource={kind:'none'}`, `timeline=[]` 등)으로 두고 UI 없이 pass-through

**선행 문서:** `docs/superpowers/specs/2026-04-23-actual-data-design.md`

---

## 파일 구조

### 신규 파일
```
src/lib/actualData/
├── types.ts                # z.infer로 도출한 도메인 타입
├── schema.ts               # Zod 스키마 단일 정의 (클라/서버 공유)
├── roundFactory.ts         # buildNextPvPRound / accumulateHexModifiers / generateGameId
├── graceInference.ts       # shrine 집계 → graceApplied + 은총 증강 추론
└── draftStorage.ts         # localStorage draft save/load/clear

src/lib/actualData/server/
└── gameStore.ts            # Node fs 기반 CRUD (API routes 전용, 클라에서 import 금지)

src/store/
└── actualDataSlice.ts      # Zustand 슬라이스

src/app/actual-data/
├── page.tsx                # 게임 리스트
└── [gameId]/
    └── page.tsx            # 게임 편집

src/app/api/actual-data/
├── route.ts                # GET(list) + POST(create)
└── [gameId]/
    └── route.ts            # GET + PUT + DELETE

src/components/actual-data/
├── GameListTable.tsx       # 리스트 행 + 삭제/편집 버튼
├── NewGameDialog.tsx       # 새 게임 생성 모달
├── ActualDataEditor.tsx    # 편집 페이지 레이아웃 (사이드바 + 메인)
├── GameMetaEditor.tsx      # patchVersion/playerRiotId/shrinesInPlay/finalPlacement 편집
├── RoundList.tsx           # 좌측 라운드 리스트 + "+ PvP" / "+ Shrine"
├── RoundEditor.tsx         # type 분기 래퍼
├── PvPRoundEditor.tsx      # winner/damageChart/양팀 편집
├── ShrineRoundEditor.tsx   # shrine 라운드 편집 (playerChosenShrine + Yasuo Tile)
├── TeamEditor.tsx          # 내 팀/상대 공통 컨테이너
├── OpponentPanel.tsx       # TeamEditor + riotId + QuickFill
├── OpponentQuickFill.tsx   # 이전 만남 상대 복사 드롭다운
├── AugmentSlotsQuad.tsx    # 증강 슬롯 4개 (4번째 = 은총)
├── HexModifierOverlay.tsx  # SetupBoardCore 위 야스오 칸 시각 표시
├── YasuoTilePicker.tsx     # 6종 칸 중 1개 선택
├── DamageChartInput.tsx    # 유닛별 데미지 수동 입력
├── GraceStatus.tsx         # 은총 자동 계산 결과 + 확정 버튼
└── SaveStatusBar.tsx       # 저장 상태 뱃지 + 자동 저장

src/components/battle/
└── SetupBoardCore.tsx      # SetupBoard에서 분리한 presentational 컴포넌트

tests/unit/actualData/
├── schema.test.ts
├── roundFactory.test.ts
├── graceInference.test.ts
└── draftStorage.test.ts
```

### 수정 파일
```
src/components/battle/SetupBoard.tsx        # Core 추출 → 얇은 store-bound 래퍼
src/app/simulator/page.tsx                  # SetupBoard → SetupBoardWithStore 치환 (이름 유지 가능)
src/app/simulator/layout/SimulatorLayout*.tsx # 위와 동일
package.json                                 # zod, nanoid 추가
```

### 저장 경로
```
<repoRoot>/actual-data/*.json              # 게임 JSON 파일 저장 디렉토리 (신규)
```

---

## Task 1: 의존성 추가 + 디렉토리 생성

**Files:**
- Modify: `package.json`
- Create: `actual-data/.gitkeep` (empty file, placeholder for directory)

- [ ] **Step 1: zod, nanoid 설치**

Run:
```bash
pnpm add zod nanoid
```
Expected: `package.json`에 `"zod": "^3..."` `"nanoid": "^5..."` 추가

- [ ] **Step 2: 저장 디렉토리 생성**

Run:
```bash
mkdir -p actual-data && touch actual-data/.gitkeep
```

- [ ] **Step 3: 타입 체크 확인**

Run:
```bash
pnpm typecheck
```
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add package.json pnpm-lock.yaml actual-data/.gitkeep
git commit -m "chore(actual-data): add zod/nanoid deps + storage dir"
```

---

## Task 2: Zod 스키마 + 타입 정의

**Files:**
- Create: `src/lib/actualData/schema.ts`
- Create: `src/lib/actualData/types.ts`
- Create: `tests/unit/actualData/schema.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `tests/unit/actualData/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ActualGameDataSchema,
  PvPRoundSchema,
  ShrineRoundSchema,
  HexCoordSchema,
} from '@/lib/actualData/schema';

describe('ActualGameDataSchema', () => {
  const validGame = {
    gameId: 'game-20260423-001',
    videoSource: { kind: 'none' as const },
    patchVersion: '17.1',
    playerRiotId: 'Player#KR1',
    finalPlacement: 3,
    shrinesInPlay: ['yasuo', 'ekko'] as const,
    timeline: [],
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    rounds: [],
  };

  it('accepts a minimal valid game', () => {
    expect(() => ActualGameDataSchema.parse(validGame)).not.toThrow();
  });

  it('rejects duplicate shrines', () => {
    const bad = { ...validGame, shrinesInPlay: ['yasuo', 'yasuo'] };
    expect(() => ActualGameDataSchema.parse(bad)).toThrow();
  });

  it('rejects finalPlacement > 8', () => {
    const bad = { ...validGame, finalPlacement: 9 };
    expect(() => ActualGameDataSchema.parse(bad)).toThrow();
  });

  it('rejects rounds out of order', () => {
    const bad = {
      ...validGame,
      rounds: [
        { type: 'pvp' as const, roundName: '2-5', videoStartTime: 0, playerTeam: minTeam(), opponent: minOpp(), winner: 'player' as const },
        { type: 'pvp' as const, roundName: '2-3', videoStartTime: 0, playerTeam: minTeam(), opponent: minOpp(), winner: 'player' as const },
      ],
    };
    expect(() => ActualGameDataSchema.parse(bad)).toThrow();
  });
});

describe('HexCoordSchema', () => {
  it('accepts valid coord', () => {
    expect(() => HexCoordSchema.parse({ q: 0, r: 0 })).not.toThrow();
  });
  it('rejects non-integers', () => {
    expect(() => HexCoordSchema.parse({ q: 1.5, r: 0 })).toThrow();
  });
});

function minTeam() {
  return {
    units: [],
    augments: [undefined, undefined, undefined, undefined],
    level: 7,
    hp: 80,
    hexModifiers: [],
  };
}
function minOpp() {
  return minTeam();
}
```

- [ ] **Step 2: Run test — expect fail (module not found)**

Run: `pnpm test tests/unit/actualData/schema.test.ts`
Expected: FAIL with "Cannot find module '@/lib/actualData/schema'"

- [ ] **Step 3: schema.ts 작성**

Create `src/lib/actualData/schema.ts`:

```ts
import { z } from 'zod';

export const HexCoordSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
});

export const ShrineNameSchema = z.enum([
  'ahri', 'aurelionSol', 'ekko', 'evelynn',
  'kayle', 'soraka', 'thresh', 'varus', 'yasuo',
]);

export const YasuoTileIdSchema = z.enum([
  'solar', 'cryo', 'starlight', 'accel', 'storm', 'cosmic',
]);

export const StargazerConstellationIdSchema = z.enum([
  'altar', 'boar', 'well', 'huntress', 'medal', 'mountain', 'snake',
]);

export const YasuoTilePlacementSchema = z.object({
  hex: HexCoordSchema,
  tileId: YasuoTileIdSchema,
});

export const HexModifierSchema = z.object({
  hex: HexCoordSchema,
  tileId: YasuoTileIdSchema,
  stageGranted: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});

export const UnitGrantSchema = z.object({
  source: z.enum(['ekko_implant', 'ekko_grace']),
  effectId: z.string(),
});

export const PlacedUnitSchema = z.object({
  championId: z.string(),
  hex: HexCoordSchema,
  starLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  items: z.tuple([
    z.string().optional(),
    z.string().optional(),
    z.string().optional(),
  ]),
  grants: z.array(UnitGrantSchema).optional(),
});

export const ArbiterLawSchema = z.object({
  triggerId: z.string(),
  effectId: z.string(),
});

export const TeamStargazerStateSchema = z.object({
  revealedTiles: z.array(HexCoordSchema),
});

export const TeamFactoryNewStateSchema = z.object({
  upgradePath: z.array(z.string()),
  nextUpgradeRoundsRemaining: z.number().int().min(0).optional(),
});

export const TeamSnapshotSchema = z.object({
  units: z.array(PlacedUnitSchema),
  augments: z.tuple([
    z.string().optional(),
    z.string().optional(),
    z.string().optional(),
    z.string().optional(),
  ]),
  level: z.number().int().min(1).max(10),
  hp: z.number().min(0),
  hexModifiers: z.array(HexModifierSchema),
  graceApplied: z.boolean().optional(),
  arbiterLaw: ArbiterLawSchema.optional(),
  stargazer: TeamStargazerStateSchema.optional(),
  factoryNew: TeamFactoryNewStateSchema.optional(),
});

export const OpponentSnapshotSchema = TeamSnapshotSchema.extend({
  riotId: z.string().optional(),
});

export const UnitDamageEntrySchema = z.object({
  championId: z.string(),
  damage: z.number().min(0),
});

const RoundBase = {
  roundName: z.string().regex(/^\d+-\d+$/),
  videoStartTime: z.number().min(0),
  videoEndTime: z.number().min(0).optional(),
  notes: z.string().optional(),
};

export const PvPRoundSchema = z.object({
  type: z.literal('pvp'),
  ...RoundBase,
  playerTeam: TeamSnapshotSchema,
  opponent: OpponentSnapshotSchema,
  winner: z.enum(['player', 'opponent', 'draw']),
  unitDamageChart: z.array(UnitDamageEntrySchema).optional(),
}).refine(
  (r) => r.videoEndTime === undefined || r.videoEndTime >= r.videoStartTime,
  { message: 'videoEndTime must be >= videoStartTime', path: ['videoEndTime'] },
);

export const ShrineRoundSchema = z.object({
  type: z.literal('shrine'),
  ...RoundBase,
  playerChosenShrine: ShrineNameSchema,
  playerYasuoTile: YasuoTilePlacementSchema.optional(),
}).refine(
  (r) => r.videoEndTime === undefined || r.videoEndTime >= r.videoStartTime,
  { message: 'videoEndTime must be >= videoStartTime', path: ['videoEndTime'] },
);

export const RoundSchema = z.discriminatedUnion('type', [
  PvPRoundSchema._def.schema,   // unwrap refine for discriminated union (z v3)
  ShrineRoundSchema._def.schema,
]);

export const TimelineMarkerSchema = z.object({
  id: z.string(),
  timestamp: z.number().min(0),
  kind: z.enum(['event', 'note', 'issue']),
  label: z.string().min(1),
  roundIndex: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const VideoSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('local'),
    filename: z.string(),
    mimeType: z.enum(['video/mp4', 'video/webm']),
    sizeBytes: z.number().int().positive(),
    durationSeconds: z.number().min(0).nullable(),
    uploadedAt: z.string(),
  }),
]);

export const ActualGameDataSchema = z.object({
  gameId: z.string(),
  videoSource: VideoSourceSchema,
  patchVersion: z.string().min(1),
  playerRiotId: z.string().regex(/^.{2,16}#[A-Z0-9]{2,5}$/i),
  finalPlacement: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4),
    z.literal(5), z.literal(6), z.literal(7), z.literal(8),
  ]),
  shrinesInPlay: z.tuple([ShrineNameSchema, ShrineNameSchema])
    .refine(([a, b]) => a !== b, { message: 'shrinesInPlay must be distinct' }),
  stargazerConstellation: StargazerConstellationIdSchema.optional(),
  timeline: z.array(TimelineMarkerSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  rounds: z.array(z.union([PvPRoundSchema, ShrineRoundSchema])),
}).superRefine((data, ctx) => {
  // rounds roundName 오름차순 + 중복 금지
  const names = data.rounds.map(r => r.roundName);
  for (let i = 1; i < names.length; i++) {
    if (compareRoundName(names[i - 1], names[i]) >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rounds', i, 'roundName'],
        message: 'rounds must be in ascending order, no duplicates',
      });
    }
  }
});

function compareRoundName(a: string, b: string): number {
  const [as, ar] = a.split('-').map(Number);
  const [bs, br] = b.split('-').map(Number);
  return as !== bs ? as - bs : ar - br;
}
```

- [ ] **Step 4: types.ts 작성**

Create `src/lib/actualData/types.ts`:

```ts
import { z } from 'zod';
import * as S from './schema';

export type HexCoord = z.infer<typeof S.HexCoordSchema>;
export type ShrineName = z.infer<typeof S.ShrineNameSchema>;
export type YasuoTileId = z.infer<typeof S.YasuoTileIdSchema>;
export type StargazerConstellationId = z.infer<typeof S.StargazerConstellationIdSchema>;
export type YasuoTilePlacement = z.infer<typeof S.YasuoTilePlacementSchema>;
export type HexModifier = z.infer<typeof S.HexModifierSchema>;
export type UnitGrant = z.infer<typeof S.UnitGrantSchema>;
export type PlacedUnit = z.infer<typeof S.PlacedUnitSchema>;
export type ArbiterLaw = z.infer<typeof S.ArbiterLawSchema>;
export type TeamStargazerState = z.infer<typeof S.TeamStargazerStateSchema>;
export type TeamFactoryNewState = z.infer<typeof S.TeamFactoryNewStateSchema>;
export type TeamSnapshot = z.infer<typeof S.TeamSnapshotSchema>;
export type OpponentSnapshot = z.infer<typeof S.OpponentSnapshotSchema>;
export type UnitDamageEntry = z.infer<typeof S.UnitDamageEntrySchema>;
export type PvPRound = z.infer<typeof S.PvPRoundSchema>;
export type ShrineRound = z.infer<typeof S.ShrineRoundSchema>;
export type Round = PvPRound | ShrineRound;
export type TimelineMarker = z.infer<typeof S.TimelineMarkerSchema>;
export type VideoSource = z.infer<typeof S.VideoSourceSchema>;
export type ActualGameData = z.infer<typeof S.ActualGameDataSchema>;

export type AugmentId = string;
export type ItemId = string;
export type FactoryNewUpgradeId = string;

export type ActualGameSummary = Pick<
  ActualGameData,
  'gameId' | 'videoSource' | 'patchVersion' | 'finalPlacement' | 'updatedAt'
>;

export type NewGameMeta = {
  patchVersion: string;
  playerRiotId: string;
  shrinesInPlay: [ShrineName, ShrineName];
};

export type ActualGameMeta = Omit<
  ActualGameData,
  'gameId' | 'createdAt' | 'updatedAt' | 'rounds' | 'timeline'
>;
```

- [ ] **Step 5: Run test — expect pass**

Run: `pnpm test tests/unit/actualData/schema.test.ts`
Expected: 4 tests pass

- [ ] **Step 6: typecheck**

Run: `pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
git add src/lib/actualData/schema.ts src/lib/actualData/types.ts tests/unit/actualData/schema.test.ts
git commit -m "feat(actual-data): zod schema + inferred types"
```

---

## Task 3: `generateGameId` 순수 함수

**Files:**
- Create: `src/lib/actualData/roundFactory.ts` (partial, will grow in later tasks)
- Create: `tests/unit/actualData/roundFactory.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `tests/unit/actualData/roundFactory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateGameId } from '@/lib/actualData/roundFactory';

describe('generateGameId', () => {
  it('produces 001 when no prior ids for today', () => {
    const id = generateGameId([], new Date('2026-04-23T10:00:00Z'));
    expect(id).toBe('game-20260423-001');
  });

  it('increments when today ids exist', () => {
    const id = generateGameId(
      ['game-20260423-001', 'game-20260423-002'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-003');
  });

  it('ignores ids from other dates', () => {
    const id = generateGameId(
      ['game-20260422-005', 'game-20260422-006'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-001');
  });

  it('handles large NNN', () => {
    const id = generateGameId(
      ['game-20260423-099'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-100');
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm test tests/unit/actualData/roundFactory.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

Create `src/lib/actualData/roundFactory.ts`:

```ts
export function generateGameId(existingIds: string[], now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;
  const prefix = `game-${datePart}-`;

  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  const nnn = String(max + 1).padStart(3, '0');
  return `${prefix}${nnn}`;
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm test tests/unit/actualData/roundFactory.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/actualData/roundFactory.ts tests/unit/actualData/roundFactory.test.ts
git commit -m "feat(actual-data): generateGameId pure fn"
```

---

## Task 4: `accumulateHexModifiers` 순수 함수

**Files:**
- Modify: `src/lib/actualData/roundFactory.ts`
- Modify: `tests/unit/actualData/roundFactory.test.ts`

- [ ] **Step 1: 테스트 추가**

Append to `tests/unit/actualData/roundFactory.test.ts`:

```ts
import { accumulateHexModifiers } from '@/lib/actualData/roundFactory';
import type { HexModifier, ShrineRound } from '@/lib/actualData/types';

describe('accumulateHexModifiers', () => {
  const base: HexModifier[] = [
    { hex: { q: 0, r: 0 }, tileId: 'solar', stageGranted: 2 },
  ];

  it('returns base unchanged when no shrine rounds', () => {
    expect(accumulateHexModifiers(base, [])).toEqual(base);
  });

  it('appends yasuo tile from a shrine round', () => {
    const shrine: ShrineRound = {
      type: 'shrine',
      roundName: '3-4',
      videoStartTime: 0,
      playerChosenShrine: 'yasuo',
      playerYasuoTile: { hex: { q: 1, r: 0 }, tileId: 'cryo' },
    };
    const result = accumulateHexModifiers(base, [shrine]);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      hex: { q: 1, r: 0 },
      tileId: 'cryo',
      stageGranted: 3,
    });
  });

  it('ignores non-yasuo shrine rounds', () => {
    const shrine: ShrineRound = {
      type: 'shrine',
      roundName: '3-4',
      videoStartTime: 0,
      playerChosenShrine: 'ekko',
    };
    expect(accumulateHexModifiers(base, [shrine])).toEqual(base);
  });

  it('derives stageGranted from roundName', () => {
    const shrines: ShrineRound[] = [
      { type: 'shrine', roundName: '2-4', videoStartTime: 0, playerChosenShrine: 'yasuo',
        playerYasuoTile: { hex: { q: 0, r: 1 }, tileId: 'accel' } },
      { type: 'shrine', roundName: '4-4', videoStartTime: 0, playerChosenShrine: 'yasuo',
        playerYasuoTile: { hex: { q: 0, r: 2 }, tileId: 'storm' } },
    ];
    const result = accumulateHexModifiers([], shrines);
    expect(result[0].stageGranted).toBe(2);
    expect(result[1].stageGranted).toBe(4);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm test tests/unit/actualData/roundFactory.test.ts`
Expected: FAIL (accumulateHexModifiers not exported)

- [ ] **Step 3: Implement**

Append to `src/lib/actualData/roundFactory.ts`:

```ts
import type { HexModifier, ShrineRound } from './types';

export function accumulateHexModifiers(
  base: HexModifier[],
  shrineRounds: ShrineRound[],
): HexModifier[] {
  const result = [...base];
  for (const r of shrineRounds) {
    if (r.playerChosenShrine !== 'yasuo' || !r.playerYasuoTile) continue;
    const stage = Number(r.roundName.split('-')[0]);
    if (stage !== 2 && stage !== 3 && stage !== 4) continue;
    result.push({
      hex: r.playerYasuoTile.hex,
      tileId: r.playerYasuoTile.tileId,
      stageGranted: stage,
    });
  }
  return result;
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm test tests/unit/actualData/roundFactory.test.ts`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/actualData/roundFactory.ts tests/unit/actualData/roundFactory.test.ts
git commit -m "feat(actual-data): accumulateHexModifiers"
```

---

## Task 5: `buildNextPvPRound` 순수 함수

**Files:**
- Modify: `src/lib/actualData/roundFactory.ts`
- Modify: `tests/unit/actualData/roundFactory.test.ts`

- [ ] **Step 1: 테스트 추가**

Append:

```ts
import { buildNextPvPRound } from '@/lib/actualData/roundFactory';
import type { PvPRound } from '@/lib/actualData/types';

describe('buildNextPvPRound', () => {
  const prev: PvPRound = {
    type: 'pvp',
    roundName: '2-3',
    videoStartTime: 10,
    playerTeam: {
      units: [{ championId: 'ahri', hex: { q: 0, r: 0 }, starLevel: 2, items: [undefined, undefined, undefined] }],
      augments: ['aug1', undefined, undefined, undefined],
      level: 6,
      hp: 80,
      hexModifiers: [],
    },
    opponent: {
      units: [],
      augments: [undefined, undefined, undefined, undefined],
      level: 6,
      hp: 100,
      hexModifiers: [],
    },
    winner: 'player',
  };

  it('copies playerTeam units/augments/level/hp from prev', () => {
    const next = buildNextPvPRound('2-5', prev, []);
    expect(next.playerTeam.units).toEqual(prev.playerTeam.units);
    expect(next.playerTeam.augments).toEqual(prev.playerTeam.augments);
    expect(next.playerTeam.level).toBe(6);
    expect(next.playerTeam.hp).toBe(80);
  });

  it('accumulates hexModifiers from intervening shrine rounds', () => {
    const next = buildNextPvPRound('2-5', prev, [
      { type: 'shrine', roundName: '2-4', videoStartTime: 20, playerChosenShrine: 'yasuo',
        playerYasuoTile: { hex: { q: 1, r: 0 }, tileId: 'solar' } },
    ]);
    expect(next.playerTeam.hexModifiers).toHaveLength(1);
    expect(next.playerTeam.hexModifiers[0].tileId).toBe('solar');
  });

  it('leaves opponent empty', () => {
    const next = buildNextPvPRound('2-5', prev, []);
    expect(next.opponent.units).toEqual([]);
    expect(next.opponent.level).toBe(1);   // default
    expect(next.opponent.hp).toBe(100);
    expect(next.opponent.riotId).toBeUndefined();
  });

  it('uses prev videoEndTime as new videoStartTime when provided', () => {
    const next = buildNextPvPRound('2-5', { ...prev, videoEndTime: 55 }, []);
    expect(next.videoStartTime).toBe(55);
  });

  it('returns videoStartTime=0 when prev=null', () => {
    const next = buildNextPvPRound('2-2', null, []);
    expect(next.videoStartTime).toBe(0);
    expect(next.playerTeam.units).toEqual([]);
  });

  it('sets winner to draw placeholder', () => {
    const next = buildNextPvPRound('2-5', prev, []);
    expect(next.winner).toBe('draw');
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm test tests/unit/actualData/roundFactory.test.ts`
Expected: FAIL (buildNextPvPRound not exported)

- [ ] **Step 3: Implement**

Append to `src/lib/actualData/roundFactory.ts`:

```ts
import type { PvPRound, TeamSnapshot, OpponentSnapshot } from './types';

function emptyTeam(): TeamSnapshot {
  return {
    units: [],
    augments: [undefined, undefined, undefined, undefined],
    level: 1,
    hp: 100,
    hexModifiers: [],
  };
}

function emptyOpponent(): OpponentSnapshot {
  return emptyTeam();
}

export function buildNextPvPRound(
  roundName: string,
  prev: PvPRound | null,
  shrineRoundsBetween: ShrineRound[],
): PvPRound {
  const playerTeam: TeamSnapshot = prev
    ? {
        units: prev.playerTeam.units.map(u => ({ ...u })),
        augments: [...prev.playerTeam.augments] as TeamSnapshot['augments'],
        level: prev.playerTeam.level,
        hp: prev.playerTeam.hp,
        hexModifiers: accumulateHexModifiers(prev.playerTeam.hexModifiers, shrineRoundsBetween),
        graceApplied: prev.playerTeam.graceApplied,
        arbiterLaw: prev.playerTeam.arbiterLaw,
        stargazer: prev.playerTeam.stargazer,
        factoryNew: prev.playerTeam.factoryNew,
      }
    : emptyTeam();

  return {
    type: 'pvp',
    roundName,
    videoStartTime: prev?.videoEndTime ?? 0,
    playerTeam,
    opponent: emptyOpponent(),
    winner: 'draw',
  };
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm test tests/unit/actualData/roundFactory.test.ts`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/actualData/roundFactory.ts tests/unit/actualData/roundFactory.test.ts
git commit -m "feat(actual-data): buildNextPvPRound"
```

---

## Task 6: `graceInference` 순수 함수

**Files:**
- Create: `src/lib/actualData/graceInference.ts`
- Create: `tests/unit/actualData/graceInference.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `tests/unit/actualData/graceInference.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inferGraceFromShrines } from '@/lib/actualData/graceInference';
import type { ShrineRound } from '@/lib/actualData/types';

function sr(playerChosenShrine: ShrineRound['playerChosenShrine'], roundName = '2-4'): ShrineRound {
  return { type: 'shrine', roundName, videoStartTime: 0, playerChosenShrine };
}

describe('inferGraceFromShrines', () => {
  it('returns null when no shrine rounds', () => {
    expect(inferGraceFromShrines([])).toBeNull();
  });

  it('returns yasuo grace when 3x yasuo', () => {
    const result = inferGraceFromShrines([sr('yasuo'), sr('yasuo'), sr('yasuo')]);
    expect(result).toEqual({ kind: 'yasuo_grace', appliesHexMultiplier: 1.5 });
  });

  it('does not return yasuo grace when only 2x yasuo', () => {
    const result = inferGraceFromShrines([sr('yasuo'), sr('yasuo'), sr('ekko')]);
    expect(result).toEqual({ kind: 'other_grace', shrine: 'yasuo' });
    // yasuo 2회 ≥ 2이므로 일반 은총 증강 규칙 적용 (4번째 슬롯 후보)
    // 단 칸 위력 ×1.5는 없음
  });

  it('returns other_grace when non-yasuo god chosen 2+ times', () => {
    const result = inferGraceFromShrines([sr('ekko'), sr('ekko'), sr('thresh')]);
    expect(result).toEqual({ kind: 'other_grace', shrine: 'ekko' });
  });

  it('returns null when all three different gods', () => {
    expect(inferGraceFromShrines([sr('ekko'), sr('thresh'), sr('varus')])).toBeNull();
  });

  it('ignores non-shrine rounds', () => {
    // edge case: caller should pass only shrine rounds, but robustness check
    expect(inferGraceFromShrines([sr('yasuo'), sr('yasuo')])).toEqual({
      kind: 'other_grace',
      shrine: 'yasuo',
    });
    // 2x yasuo without a 3rd → treated as other_grace (augment, no tile buff)
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

Create `src/lib/actualData/graceInference.ts`:

```ts
import type { ShrineRound, ShrineName } from './types';

export type GraceInference =
  | { kind: 'yasuo_grace'; appliesHexMultiplier: 1.5 }
  | { kind: 'other_grace'; shrine: ShrineName };

export function inferGraceFromShrines(shrines: ShrineRound[]): GraceInference | null {
  if (shrines.length === 0) return null;

  const counts = new Map<ShrineName, number>();
  for (const r of shrines) {
    counts.set(r.playerChosenShrine, (counts.get(r.playerChosenShrine) ?? 0) + 1);
  }

  // Yasuo special: 3회 선택 시에만 칸 위력 ×1.5
  if ((counts.get('yasuo') ?? 0) >= 3) {
    return { kind: 'yasuo_grace', appliesHexMultiplier: 1.5 };
  }

  // 그 외: 2회 이상 선택한 신이 있으면 그 신의 은총 증강
  // 동점 처리: 더 많이 선택한 신 우선, 동수면 먼저 나온 신
  let best: { shrine: ShrineName; count: number } | null = null;
  for (const [shrine, count] of counts) {
    if (count < 2) continue;
    if (!best || count > best.count) best = { shrine, count };
  }
  if (best) return { kind: 'other_grace', shrine: best.shrine };

  return null;
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm test tests/unit/actualData/graceInference.test.ts`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/actualData/graceInference.ts tests/unit/actualData/graceInference.test.ts
git commit -m "feat(actual-data): grace inference from shrine tally"
```

---

## Task 7: 서버 측 파일 I/O (`gameStore.ts`)

**Files:**
- Create: `src/lib/actualData/server/gameStore.ts`

참고: 서버 한정 모듈. `'use server'` 표시 없지만 클라에서 import 금지 (API route에서만 사용).

- [ ] **Step 1: Implement**

Create `src/lib/actualData/server/gameStore.ts`:

```ts
import { promises as fs } from 'fs';
import { constants as fsConstants } from 'fs';
import path from 'path';
import type { ActualGameData, ActualGameSummary } from '../types';

const DIR = path.join(process.cwd(), 'actual-data');

export async function listGameSummaries(): Promise<ActualGameSummary[]> {
  await ensureDir();
  const files = (await fs.readdir(DIR)).filter(f => f.endsWith('.json'));
  const summaries: ActualGameSummary[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(path.join(DIR, f), 'utf-8');
      const data = JSON.parse(raw) as ActualGameData;
      summaries.push({
        gameId: data.gameId,
        videoSource: data.videoSource,
        patchVersion: data.patchVersion,
        finalPlacement: data.finalPlacement,
        updatedAt: data.updatedAt,
      });
    } catch {
      // skip malformed file
    }
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readGame(gameId: string): Promise<ActualGameData | null> {
  try {
    const raw = await fs.readFile(filePath(gameId), 'utf-8');
    return JSON.parse(raw) as ActualGameData;
  } catch (err) {
    if (isFileNotFound(err)) return null;
    throw err;
  }
}

export async function writeGame(data: ActualGameData): Promise<void> {
  await ensureDir();
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath(data.gameId), json, 'utf-8');
}

export async function createGameFile(data: ActualGameData): Promise<void> {
  await ensureDir();
  const json = JSON.stringify(data, null, 2);
  // wx flag: fail if exists
  await fs.writeFile(filePath(data.gameId), json, { encoding: 'utf-8', flag: 'wx' });
}

export async function deleteGame(gameId: string): Promise<boolean> {
  try {
    await fs.unlink(filePath(gameId));
    return true;
  } catch (err) {
    if (isFileNotFound(err)) return false;
    throw err;
  }
}

export async function listGameIds(): Promise<string[]> {
  await ensureDir();
  return (await fs.readdir(DIR))
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -5));
}

function filePath(gameId: string): string {
  if (!/^[a-z0-9-]+$/i.test(gameId)) throw new Error(`invalid gameId: ${gameId}`);
  return path.join(DIR, `${gameId}.json`);
}

async function ensureDir(): Promise<void> {
  try {
    await fs.access(DIR, fsConstants.F_OK);
  } catch {
    await fs.mkdir(DIR, { recursive: true });
  }
}

function isFileNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ENOENT';
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/lib/actualData/server/gameStore.ts
git commit -m "feat(actual-data): server-side file I/O"
```

---

## Task 8: API `GET /api/actual-data` (list)

**Files:**
- Create: `src/app/api/actual-data/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/actual-data/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { listGameSummaries, createGameFile, listGameIds } from '@/lib/actualData/server/gameStore';
import { generateGameId } from '@/lib/actualData/roundFactory';
import type { ActualGameData, NewGameMeta } from '@/lib/actualData/types';
import { ShrineNameSchema } from '@/lib/actualData/schema';
import { z } from 'zod';

export const runtime = 'nodejs';

const NewGameBodySchema = z.object({
  patchVersion: z.string().min(1),
  playerRiotId: z.string().regex(/^.{2,16}#[A-Z0-9]{2,5}$/i),
  shrinesInPlay: z.tuple([ShrineNameSchema, ShrineNameSchema])
    .refine(([a, b]) => a !== b, { message: 'shrinesInPlay must be distinct' }),
});

export async function GET() {
  const games = await listGameSummaries();
  return NextResponse.json({ games });
}

export async function POST(req: Request) {
  let body: NewGameMeta;
  try {
    const raw = await req.json();
    body = NewGameBodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: 'validation', message: 'invalid body', issues: err instanceof z.ZodError ? err.issues : [] },
      { status: 400 },
    );
  }

  const existingIds = await listGameIds();
  const gameId = generateGameId(existingIds);
  const now = new Date().toISOString();

  const data: ActualGameData = {
    gameId,
    videoSource: { kind: 'none' },
    patchVersion: body.patchVersion,
    playerRiotId: body.playerRiotId,
    finalPlacement: 8,
    shrinesInPlay: body.shrinesInPlay,
    timeline: [],
    createdAt: now,
    updatedAt: now,
    rounds: [],
  };

  try {
    await createGameFile(data);
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'EEXIST') {
      // rare: retry once with N+1
      const retryId = generateGameId([...existingIds, gameId]);
      await createGameFile({ ...data, gameId: retryId });
      return NextResponse.json({ gameId: retryId, createdAt: now, updatedAt: now }, { status: 201 });
    }
    throw err;
  }

  return NextResponse.json({ gameId, createdAt: now, updatedAt: now }, { status: 201 });
}
```

- [ ] **Step 2: 수동 테스트**

Run dev server: `pnpm dev` (별도 터미널)

Test:
```bash
curl -s http://localhost:3000/api/actual-data | jq
# expect: { "games": [] }

curl -s -X POST http://localhost:3000/api/actual-data \
  -H 'Content-Type: application/json' \
  -d '{"patchVersion":"17.1","playerRiotId":"Player#KR1","shrinesInPlay":["yasuo","ekko"]}' | jq
# expect: { "gameId": "game-YYYYMMDD-001", "createdAt": "...", "updatedAt": "..." }

ls actual-data/
# expect: game-YYYYMMDD-001.json
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/actual-data/route.ts
git commit -m "feat(actual-data): GET list + POST create API"
```

---

## Task 9: API `[gameId]/route.ts` (GET/PUT/DELETE single)

**Files:**
- Create: `src/app/api/actual-data/[gameId]/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/actual-data/[gameId]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { readGame, writeGame, deleteGame } from '@/lib/actualData/server/gameStore';
import { ActualGameDataSchema } from '@/lib/actualData/schema';
import { z } from 'zod';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  const data = await readGame(gameId);
  if (!data) return NextResponse.json({ error: 'not_found', message: `${gameId} not found` }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { gameId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'validation', message: 'invalid JSON' }, { status: 400 });
  }

  const parsed = ActualGameDataSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', message: 'schema invalid', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (parsed.data.gameId !== gameId) {
    return NextResponse.json({ error: 'validation', message: 'gameId mismatch' }, { status: 400 });
  }

  const existing = await readGame(gameId);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const updatedAt = new Date().toISOString();
  const data = { ...parsed.data, updatedAt };
  await writeGame(data);

  return NextResponse.json({ ok: true, updatedAt });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  const deleted = await deleteGame(gameId);
  if (!deleted) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: 수동 테스트**

```bash
# GET
curl -s http://localhost:3000/api/actual-data/game-$(date +%Y%m%d)-001 | jq
# expect: full game JSON

# PUT (use result of GET as template)
curl -s -X PUT http://localhost:3000/api/actual-data/game-$(date +%Y%m%d)-001 \
  -H 'Content-Type: application/json' \
  -d @- <<< "$(curl -s http://localhost:3000/api/actual-data/game-$(date +%Y%m%d)-001 | jq '.finalPlacement = 3')" | jq
# expect: { "ok": true, "updatedAt": "..." }

# DELETE
curl -s -X DELETE -o /dev/null -w '%{http_code}\n' \
  http://localhost:3000/api/actual-data/game-$(date +%Y%m%d)-001
# expect: 204
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/actual-data/[gameId]/route.ts
git commit -m "feat(actual-data): GET/PUT/DELETE single game API"
```

---

## Task 10: `actualDataSlice` — state + game lifecycle actions

**Files:**
- Create: `src/store/actualDataSlice.ts`

참고: Sub-project 1에서는 slice의 핵심 기능만. round/team/field 액션은 Task 11+ 에서 추가.

- [ ] **Step 1: Implement**

Create `src/store/actualDataSlice.ts`:

```ts
import { create } from 'zustand';
import type {
  ActualGameData,
  ActualGameSummary,
  NewGameMeta,
} from '@/lib/actualData/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ActualDataState {
  currentGame: ActualGameData | null;
  currentRoundIndex: number | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  gameListCache: ActualGameSummary[] | null;

  // Game lifecycle
  loadGame: (gameId: string) => Promise<void>;
  createGame: (meta: NewGameMeta) => Promise<string>;
  deleteGame: (gameId: string) => Promise<void>;
  saveCurrentGame: () => Promise<void>;
  refreshGameList: () => Promise<void>;

  // Internal setter used by future tasks
  _patchGame: (patch: Partial<ActualGameData>) => void;
}

export const useActualDataStore = create<ActualDataState>((set, get) => ({
  currentGame: null,
  currentRoundIndex: null,
  isDirty: false,
  saveStatus: 'idle',
  saveError: null,
  lastSavedAt: null,
  gameListCache: null,

  loadGame: async (gameId) => {
    const res = await fetch(`/api/actual-data/${gameId}`);
    if (!res.ok) throw new Error(`loadGame failed: ${res.status}`);
    const data = (await res.json()) as ActualGameData;
    set({
      currentGame: data,
      currentRoundIndex: data.rounds.length > 0 ? 0 : null,
      isDirty: false,
      saveStatus: 'idle',
      lastSavedAt: data.updatedAt,
    });
  },

  createGame: async (meta) => {
    const res = await fetch('/api/actual-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`createGame failed: ${err.message ?? res.status}`);
    }
    const { gameId } = (await res.json()) as { gameId: string };
    return gameId;
  },

  deleteGame: async (gameId) => {
    const res = await fetch(`/api/actual-data/${gameId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`deleteGame failed: ${res.status}`);
    }
    // refresh list
    await get().refreshGameList();
  },

  saveCurrentGame: async () => {
    const game = get().currentGame;
    if (!game) return;
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await fetch(`/api/actual-data/${game.gameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `save failed: ${res.status}`);
      }
      const { updatedAt } = (await res.json()) as { updatedAt: string };
      set({
        saveStatus: 'saved',
        lastSavedAt: updatedAt,
        isDirty: false,
        currentGame: { ...game, updatedAt },
      });
      // transition saved → idle after 2s
      setTimeout(() => {
        if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
      }, 2000);
    } catch (err) {
      set({ saveStatus: 'error', saveError: err instanceof Error ? err.message : String(err) });
    }
  },

  refreshGameList: async () => {
    const res = await fetch('/api/actual-data');
    if (!res.ok) throw new Error(`refreshGameList failed: ${res.status}`);
    const { games } = (await res.json()) as { games: ActualGameSummary[] };
    set({ gameListCache: games });
  },

  _patchGame: (patch) => {
    const g = get().currentGame;
    if (!g) return;
    set({ currentGame: { ...g, ...patch }, isDirty: true });
  },
}));
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/store/actualDataSlice.ts
git commit -m "feat(actual-data): zustand slice skeleton (game lifecycle)"
```

---

## Task 11: `actualDataSlice` — round + team + field actions

**Files:**
- Modify: `src/store/actualDataSlice.ts`

- [ ] **Step 1: 액션 추가**

Edit `src/store/actualDataSlice.ts` — `ActualDataState` 인터페이스에 추가:

```ts
  // Round navigation
  setCurrentRound: (index: number) => void;
  addPvPRound: (roundName: string) => void;
  addShrineRound: (roundName: string) => void;
  removeRound: (index: number) => void;

  // Round field updates
  updateRoundMeta: (index: number, patch: Partial<{ roundName: string; videoStartTime: number; videoEndTime: number; notes: string }>) => void;
  updatePvPRound: (index: number, patch: Partial<Omit<import('@/lib/actualData/types').PvPRound, 'type'>>) => void;
  updateShrineRound: (index: number, patch: Partial<Omit<import('@/lib/actualData/types').ShrineRound, 'type'>>) => void;
  updatePlayerTeam: (index: number, patch: Partial<import('@/lib/actualData/types').TeamSnapshot>) => void;
  updateOpponent: (index: number, patch: Partial<import('@/lib/actualData/types').OpponentSnapshot>) => void;

  // Game meta
  updateGameMeta: (patch: Partial<import('@/lib/actualData/types').ActualGameMeta>) => void;

  // UI helper
  copyOpponentFromPreviousMeeting: (index: number, riotId: string) => void;
```

그리고 스토어 구현에 추가 (`_patchGame` 다음에):

```ts
  setCurrentRound: (index) => set({ currentRoundIndex: index }),

  addPvPRound: (roundName) => {
    const g = get().currentGame;
    if (!g) return;
    // 직전 PvP 라운드 + 사이 shrine 라운드 수집
    let prevPvP: import('@/lib/actualData/types').PvPRound | null = null;
    const shrinesBetween: import('@/lib/actualData/types').ShrineRound[] = [];
    for (let i = g.rounds.length - 1; i >= 0; i--) {
      const r = g.rounds[i];
      if (r.type === 'pvp') { prevPvP = r; break; }
      if (r.type === 'shrine') shrinesBetween.unshift(r);
    }
    const { buildNextPvPRound } = require('@/lib/actualData/roundFactory') as typeof import('@/lib/actualData/roundFactory');
    const newRound = buildNextPvPRound(roundName, prevPvP, shrinesBetween);
    const nextRounds = [...g.rounds, newRound];
    set({
      currentGame: { ...g, rounds: nextRounds },
      currentRoundIndex: nextRounds.length - 1,
      isDirty: true,
    });
  },

  addShrineRound: (roundName) => {
    const g = get().currentGame;
    if (!g) return;
    const newRound: import('@/lib/actualData/types').ShrineRound = {
      type: 'shrine',
      roundName,
      videoStartTime: g.rounds.length > 0 ? (g.rounds[g.rounds.length - 1].videoEndTime ?? 0) : 0,
      playerChosenShrine: g.shrinesInPlay[0],
    };
    const nextRounds = [...g.rounds, newRound];
    set({
      currentGame: { ...g, rounds: nextRounds },
      currentRoundIndex: nextRounds.length - 1,
      isDirty: true,
    });
  },

  removeRound: (index) => {
    const g = get().currentGame;
    if (!g) return;
    const nextRounds = g.rounds.filter((_, i) => i !== index);
    set({
      currentGame: { ...g, rounds: nextRounds },
      currentRoundIndex: nextRounds.length > 0 ? Math.max(0, Math.min(index, nextRounds.length - 1)) : null,
      isDirty: true,
    });
  },

  updateRoundMeta: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const nextRounds = g.rounds.map((r, i) => i === index ? { ...r, ...patch } : r);
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updatePlayerTeam: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const target = g.rounds[index];
    if (!target || target.type !== 'pvp') return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'pvp' ? { ...r, playerTeam: { ...r.playerTeam, ...patch } } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updateOpponent: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const target = g.rounds[index];
    if (!target || target.type !== 'pvp') return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'pvp' ? { ...r, opponent: { ...r.opponent, ...patch } } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updatePvPRound: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const target = g.rounds[index];
    if (!target || target.type !== 'pvp') return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'pvp' ? { ...r, ...patch } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updateShrineRound: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const target = g.rounds[index];
    if (!target || target.type !== 'shrine') return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'shrine' ? { ...r, ...patch } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updateGameMeta: (patch) => {
    const g = get().currentGame;
    if (!g) return;
    set({ currentGame: { ...g, ...patch }, isDirty: true });
  },

  copyOpponentFromPreviousMeeting: (index, riotId) => {
    const g = get().currentGame;
    if (!g) return;
    // 가장 최근에 만난 동일 riotId의 스냅샷 찾기
    let src: import('@/lib/actualData/types').OpponentSnapshot | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const r = g.rounds[i];
      if (r.type === 'pvp' && r.opponent.riotId === riotId) {
        src = r.opponent;
        break;
      }
    }
    if (!src) return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'pvp' ? { ...r, opponent: { ...src! } } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },
```

참고: `require()` 사용은 dynamic import 피하기 위한 임시 방편. Next.js에서 문제 있으면 상단 `import`로 옮길 것.

상단에 정적 import로 옮기자:

```ts
import { buildNextPvPRound } from '@/lib/actualData/roundFactory';
```

그리고 `addPvPRound` 내부의 `require(...)` 라인은 삭제.

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/store/actualDataSlice.ts
git commit -m "feat(actual-data): round + team + field actions"
```

---

## Task 12: `SetupBoard` 리팩터링 — Core 분리

**Files:**
- Create: `src/components/battle/SetupBoardCore.tsx`
- Modify: `src/components/battle/SetupBoard.tsx`

**주의**: 기존 `SetupBoard.tsx`는 14.6K로 복잡하다. 안전하게 하려면:
1. 기존 파일 복사 → 이름 변경으로 `SetupBoardCore.tsx` 생성
2. `SetupBoardCore.tsx`에서 teamSlice 직접 구독 부분을 `team` / `onChange` props로 대체
3. 기존 `SetupBoard.tsx`를 `SetupBoardCore`를 props로 감싸는 얇은 래퍼로 변경 (기본값 = teamSlice 바인딩)

- [ ] **Step 1: 기존 SetupBoard.tsx 읽고 teamSlice 직접 참조 지점 식별**

Run:
```bash
grep -n 'useTeamStore\|teamSlice' src/components/battle/SetupBoard.tsx
```
List 확인 후 각 참조를 props로 변환할 계획 세움.

- [ ] **Step 2: SetupBoardCore.tsx 생성**

Copy `src/components/battle/SetupBoard.tsx` → `src/components/battle/SetupBoardCore.tsx`.

편집:
- `useTeamStore`에서 가져오던 `placedChampions` / `selectedAugments` 등을 props로 변경
- `placeChampion` / `removeChampion` / `moveChampion` 같은 action을 props 콜백으로 변경
- 컴포넌트 props 타입:
```ts
export interface SetupBoardCoreProps {
  placedChampions: PlacedChampion[];
  selectedAugments: RawAugment[];
  onPlaceChampion: (champ: RawChampion, hex: HexCoord) => void;
  onRemoveChampion: (hex: HexCoord) => void;
  onMoveChampion: (from: HexCoord, to: HexCoord) => void;
  // ... 기존에 사용하던 다른 state들도 동일하게 props로
  readOnly?: boolean;
}
```

- [ ] **Step 3: 기존 SetupBoard.tsx 를 얇은 래퍼로 변경**

```ts
'use client';
import { useTeamStore } from '@/store/teamSlice';
import SetupBoardCore, { SetupBoardCoreProps } from './SetupBoardCore';

type WrapperProps = Omit<SetupBoardCoreProps, 'placedChampions' | 'selectedAugments' | 'onPlaceChampion' | 'onRemoveChampion' | 'onMoveChampion'>;

export default function SetupBoard(props: WrapperProps) {
  const placedChampions = useTeamStore(s => s.placedChampions);
  const selectedAugments = useTeamStore(s => s.selectedAugments);
  const placeChampion = useTeamStore(s => s.placeChampion);
  const removeChampion = useTeamStore(s => s.removeChampion);
  const moveChampion = useTeamStore(s => s.moveChampion);

  return (
    <SetupBoardCore
      {...props}
      placedChampions={placedChampions}
      selectedAugments={selectedAugments}
      onPlaceChampion={placeChampion}
      onRemoveChampion={removeChampion}
      onMoveChampion={moveChampion}
    />
  );
}
```

- [ ] **Step 4: lint + typecheck + build**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm build
```
Expected: 세 단계 모두 성공. 기존 `/simulator` 페이지는 변경 없이 동작해야 함.

- [ ] **Step 5: 수동 확인**

`pnpm dev` 실행 → `http://localhost:3000/simulator` 접속 → 유닛 배치/제거/이동이 이전과 동일하게 동작하는지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/components/battle/SetupBoardCore.tsx src/components/battle/SetupBoard.tsx
git commit -m "refactor(battle): split SetupBoard into Core + store wrapper"
```

---

## Task 13: 페이지 `/actual-data` 리스트 + `GameListTable` + `NewGameDialog`

**Files:**
- Create: `src/app/actual-data/page.tsx`
- Create: `src/components/actual-data/GameListTable.tsx`
- Create: `src/components/actual-data/NewGameDialog.tsx`

- [ ] **Step 1: GameListTable 작성**

Create `src/components/actual-data/GameListTable.tsx`:

```tsx
'use client';
import Link from 'next/link';
import type { ActualGameSummary } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function GameListTable({ games }: { games: ActualGameSummary[] }) {
  const deleteGame = useActualDataStore(s => s.deleteGame);

  if (games.length === 0) {
    return <p className="text-gray-500">아직 저장된 게임이 없습니다. "새 게임" 버튼으로 시작하세요.</p>;
  }

  return (
    <table className="w-full text-left">
      <thead className="border-b">
        <tr>
          <th className="p-2">Game ID</th>
          <th className="p-2">Patch</th>
          <th className="p-2">Placement</th>
          <th className="p-2">Video</th>
          <th className="p-2">Updated</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {games.map(g => (
          <tr key={g.gameId} className="border-b hover:bg-gray-50">
            <td className="p-2 font-mono">
              <Link href={`/actual-data/${g.gameId}`} className="text-blue-600 underline">
                {g.gameId}
              </Link>
            </td>
            <td className="p-2">{g.patchVersion}</td>
            <td className="p-2">{g.finalPlacement}</td>
            <td className="p-2">{g.videoSource.kind === 'local' ? '📹' : '—'}</td>
            <td className="p-2 text-sm text-gray-600">{new Date(g.updatedAt).toLocaleString()}</td>
            <td className="p-2">
              <button
                onClick={async () => {
                  if (!confirm(`${g.gameId}을(를) 삭제합니까?`)) return;
                  await deleteGame(g.gameId);
                }}
                className="text-red-600 hover:underline text-sm"
              >
                삭제
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: NewGameDialog 작성**

Create `src/components/actual-data/NewGameDialog.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActualDataStore } from '@/store/actualDataSlice';
import type { ShrineName } from '@/lib/actualData/types';

const SHRINES: ShrineName[] = ['ahri', 'aurelionSol', 'ekko', 'evelynn', 'kayle', 'soraka', 'thresh', 'varus', 'yasuo'];

export default function NewGameDialog({ onClose }: { onClose: () => void }) {
  const [patchVersion, setPatchVersion] = useState('17.1');
  const [playerRiotId, setPlayerRiotId] = useState('');
  const [shrine1, setShrine1] = useState<ShrineName>('yasuo');
  const [shrine2, setShrine2] = useState<ShrineName>('ekko');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const createGame = useActualDataStore(s => s.createGame);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (shrine1 === shrine2) {
      setError('두 신은 서로 달라야 합니다');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const gameId = await createGame({
        patchVersion,
        playerRiotId,
        shrinesInPlay: [shrine1, shrine2],
      });
      router.push(`/actual-data/${gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-lg w-96 space-y-3">
        <h2 className="text-lg font-bold">새 게임 만들기</h2>

        <label className="block">
          <span className="text-sm">Patch Version</span>
          <input value={patchVersion} onChange={e => setPatchVersion(e.target.value)}
            className="w-full border p-1 rounded" required />
        </label>

        <label className="block">
          <span className="text-sm">Player Riot ID (name#TAG)</span>
          <input value={playerRiotId} onChange={e => setPlayerRiotId(e.target.value)}
            className="w-full border p-1 rounded" pattern=".{2,16}#[A-Za-z0-9]{2,5}" required />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-sm">신 1</span>
            <select value={shrine1} onChange={e => setShrine1(e.target.value as ShrineName)}
              className="w-full border p-1 rounded">
              {SHRINES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-sm">신 2</span>
            <select value={shrine2} onChange={e => setShrine2(e.target.value as ShrineName)}
              className="w-full border p-1 rounded">
              {SHRINES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1 border rounded">취소</button>
          <button type="submit" disabled={submitting}
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
            {submitting ? '생성 중...' : '만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: 리스트 페이지 작성**

Create `src/app/actual-data/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';
import GameListTable from '@/components/actual-data/GameListTable';
import NewGameDialog from '@/components/actual-data/NewGameDialog';

export default function ActualDataListPage() {
  const games = useActualDataStore(s => s.gameListCache);
  const refresh = useActualDataStore(s => s.refreshGameList);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Actual Data</h1>
        <button onClick={() => setDialogOpen(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded">
          + 새 게임
        </button>
      </div>

      <GameListTable games={games ?? []} />

      {dialogOpen && <NewGameDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: lint + typecheck**

Run:
```bash
pnpm lint && pnpm typecheck
```
Expected: 에러 없음. React Compiler 규칙 위반 있으면 즉시 수정 (useEffect 안에서 setState 시 신중).

- [ ] **Step 5: 수동 테스트**

`pnpm dev` → `http://localhost:3000/actual-data` 접속 → 리스트 페이지 로드 + 새 게임 생성 → 편집 페이지로 리다이렉트 확인 (페이지는 아직 비어있음, 다음 태스크에서 작성).

- [ ] **Step 6: Commit**

```bash
git add src/app/actual-data/page.tsx src/components/actual-data/GameListTable.tsx src/components/actual-data/NewGameDialog.tsx
git commit -m "feat(actual-data): list page + new game dialog"
```

---

## Task 14: 편집 페이지 skeleton + `ActualDataEditor` + `RoundList`

**Files:**
- Create: `src/app/actual-data/[gameId]/page.tsx`
- Create: `src/components/actual-data/ActualDataEditor.tsx`
- Create: `src/components/actual-data/RoundList.tsx`

- [ ] **Step 1: RoundList 작성**

Create `src/components/actual-data/RoundList.tsx`:

```tsx
'use client';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function RoundList() {
  const game = useActualDataStore(s => s.currentGame);
  const currentIndex = useActualDataStore(s => s.currentRoundIndex);
  const setCurrentRound = useActualDataStore(s => s.setCurrentRound);
  const addPvPRound = useActualDataStore(s => s.addPvPRound);
  const addShrineRound = useActualDataStore(s => s.addShrineRound);

  if (!game) return null;

  function suggestNextRoundName(type: 'pvp' | 'shrine'): string {
    if (!game) return type === 'shrine' ? '2-4' : '2-2';
    const last = game.rounds[game.rounds.length - 1];
    if (!last) return type === 'shrine' ? '2-4' : '2-2';
    const [s, r] = last.roundName.split('-').map(Number);
    if (type === 'shrine') {
      // next shrine: 현재 스테이지의 -4 (이미 있으면 다음 스테이지)
      if (r < 4) return `${s}-4`;
      return `${s + 1}-4`;
    }
    // next pvp: -1→-2, -2→-3, -3→-5, -5→-6, -6→다음 스테이지
    if (r === 1 || r === 2) return `${s}-${r + 1}`;
    if (r === 3) return `${s}-5`;
    if (r === 5) return `${s}-6`;
    return `${s + 1}-2`;
  }

  return (
    <div className="border-r p-2 w-48">
      <ul className="space-y-1">
        {game.rounds.map((r, i) => (
          <li key={i}>
            <button onClick={() => setCurrentRound(i)}
              className={`w-full text-left p-1 rounded ${currentIndex === i ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`}>
              {r.roundName} {r.type === 'shrine' ? '◇' : '⚔'}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-1">
        <button onClick={() => addPvPRound(suggestNextRoundName('pvp'))}
          className="w-full text-sm border rounded p-1 hover:bg-gray-50">+ PvP</button>
        <button onClick={() => addShrineRound(suggestNextRoundName('shrine'))}
          className="w-full text-sm border rounded p-1 hover:bg-gray-50">+ Shrine</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ActualDataEditor 스켈레톤 작성**

Create `src/components/actual-data/ActualDataEditor.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';
import RoundList from './RoundList';

export default function ActualDataEditor({ gameId }: { gameId: string }) {
  const game = useActualDataStore(s => s.currentGame);
  const loadGame = useActualDataStore(s => s.loadGame);
  const currentRoundIndex = useActualDataStore(s => s.currentRoundIndex);

  useEffect(() => {
    loadGame(gameId).catch(console.error);
  }, [gameId, loadGame]);

  if (!game) return <div className="p-4">Loading...</div>;

  const currentRound = currentRoundIndex !== null ? game.rounds[currentRoundIndex] : null;

  return (
    <div className="flex h-screen">
      <RoundList />
      <main className="flex-1 p-4">
        {currentRound ? (
          <div>
            <h2 className="font-bold text-lg">
              {currentRound.roundName} ({currentRound.type})
            </h2>
            <p className="text-gray-500 text-sm">
              편집 UI는 다음 태스크에서 추가됩니다.
            </p>
          </div>
        ) : (
          <p className="text-gray-500">좌측에서 라운드를 선택하거나 "+ PvP"/"+ Shrine"으로 추가하세요.</p>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: 편집 페이지 작성**

Create `src/app/actual-data/[gameId]/page.tsx`:

```tsx
'use client';
import { use } from 'react';
import ActualDataEditor from '@/components/actual-data/ActualDataEditor';

export default function ActualDataEditPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  return <ActualDataEditor gameId={gameId} />;
}
```

- [ ] **Step 4: 수동 테스트**

`pnpm dev` → 새 게임 생성 → 편집 페이지에서 "+ PvP" 여러번, "+ Shrine" 클릭 → 좌측 리스트에 추가되고 라운드명이 자동 제안되는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/actual-data/[gameId]/page.tsx src/components/actual-data/ActualDataEditor.tsx src/components/actual-data/RoundList.tsx
git commit -m "feat(actual-data): editor skeleton + round list"
```

---

## Task 15: `RoundEditor` + `PvPRoundEditor` + `ShrineRoundEditor` 스켈레톤

**Files:**
- Create: `src/components/actual-data/RoundEditor.tsx`
- Create: `src/components/actual-data/PvPRoundEditor.tsx`
- Create: `src/components/actual-data/ShrineRoundEditor.tsx`
- Modify: `src/components/actual-data/ActualDataEditor.tsx`

- [ ] **Step 1: RoundEditor 분기 래퍼 작성**

Create `src/components/actual-data/RoundEditor.tsx`:

```tsx
'use client';
import { useActualDataStore } from '@/store/actualDataSlice';
import PvPRoundEditor from './PvPRoundEditor';
import ShrineRoundEditor from './ShrineRoundEditor';

export default function RoundEditor() {
  const game = useActualDataStore(s => s.currentGame);
  const idx = useActualDataStore(s => s.currentRoundIndex);

  if (!game || idx === null) return null;
  const r = game.rounds[idx];
  if (!r) return null;

  if (r.type === 'pvp') return <PvPRoundEditor index={idx} round={r} />;
  return <ShrineRoundEditor index={idx} round={r} />;
}
```

- [ ] **Step 2: PvPRoundEditor 스켈레톤**

Create `src/components/actual-data/PvPRoundEditor.tsx`:

```tsx
'use client';
import type { PvPRound } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function PvPRoundEditor({ index, round }: { index: number; round: PvPRound }) {
  const updateRoundMeta = useActualDataStore(s => s.updateRoundMeta);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <label className="flex flex-col">
          <span className="text-sm">라운드명</span>
          <input value={round.roundName}
            onChange={e => updateRoundMeta(index, { roundName: e.target.value })}
            className="border p-1 rounded w-20" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">영상 시작 (초)</span>
          <input type="number" value={round.videoStartTime}
            onChange={e => updateRoundMeta(index, { videoStartTime: Number(e.target.value) })}
            className="border p-1 rounded w-24" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">영상 종료 (초)</span>
          <input type="number" value={round.videoEndTime ?? ''}
            onChange={e => updateRoundMeta(index, { videoEndTime: e.target.value ? Number(e.target.value) : undefined })}
            className="border p-1 rounded w-24" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded p-2">
          <h3 className="font-semibold mb-2">내 팀</h3>
          <p className="text-sm text-gray-500">TeamEditor는 Task 16에서 추가</p>
        </div>
        <div className="border rounded p-2">
          <h3 className="font-semibold mb-2">상대</h3>
          <p className="text-sm text-gray-500">OpponentPanel은 Task 17에서 추가</p>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <span className="text-sm">승자:</span>
          <select value={round.winner}
            onChange={e => useActualDataStore.getState().updatePvPRound(index, { winner: e.target.value as 'player' | 'opponent' | 'draw' })}
            className="border p-1 rounded">
            <option value="player">내 팀</option>
            <option value="opponent">상대</option>
            <option value="draw">무승부</option>
          </select>
        </label>
      </div>
    </div>
  );
}
```

※ `winner` 같은 PvP 전용 필드는 Task 11에서 추가한 `updatePvPRound` 액션으로 타입 안전하게 업데이트. shrine 전용 필드는 `updateShrineRound` 사용.

- [ ] **Step 3: ShrineRoundEditor 스켈레톤**

Create `src/components/actual-data/ShrineRoundEditor.tsx`:

```tsx
'use client';
import type { ShrineRound, ShrineName } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function ShrineRoundEditor({ index, round }: { index: number; round: ShrineRound }) {
  const updateShrineRound = useActualDataStore(s => s.updateShrineRound);
  const updateRoundMeta = useActualDataStore(s => s.updateRoundMeta);
  const game = useActualDataStore(s => s.currentGame);

  if (!game) return null;
  const shrinesInPlay = game.shrinesInPlay;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <label className="flex flex-col">
          <span className="text-sm">라운드명</span>
          <input value={round.roundName}
            onChange={e => updateRoundMeta(index, { roundName: e.target.value })}
            className="border p-1 rounded w-20" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">영상 시작 (초)</span>
          <input type="number" value={round.videoStartTime}
            onChange={e => updateRoundMeta(index, { videoStartTime: Number(e.target.value) })}
            className="border p-1 rounded w-24" />
        </label>
      </div>

      <label className="flex flex-col">
        <span className="text-sm">선택한 신</span>
        <select value={round.playerChosenShrine}
          onChange={e => updateShrineRound(index, { playerChosenShrine: e.target.value as ShrineName })}
          className="border p-1 rounded w-40">
          {shrinesInPlay.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      {round.playerChosenShrine === 'yasuo' && (
        <p className="text-sm text-gray-500">
          YasuoTilePicker는 Task 18에서 추가.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: ActualDataEditor에서 RoundEditor 통합**

Edit `src/components/actual-data/ActualDataEditor.tsx` — `currentRound ?` 분기의 placeholder를 `<RoundEditor />`로 교체:

```tsx
import RoundEditor from './RoundEditor';
// ...
        {currentRound ? (
          <RoundEditor />
        ) : (
          <p className="text-gray-500">좌측에서 라운드를 선택하거나 "+ PvP"/"+ Shrine"으로 추가하세요.</p>
        )}
```

- [ ] **Step 5: 수동 테스트**

새 게임 → + PvP 라운드 생성 → 라운드명/영상 시작/종료 편집 → + Shrine → 선택한 신 변경 → 좌측 리스트 갱신 확인.

- [ ] **Step 6: Commit**

```bash
git add src/components/actual-data/RoundEditor.tsx src/components/actual-data/PvPRoundEditor.tsx src/components/actual-data/ShrineRoundEditor.tsx src/components/actual-data/ActualDataEditor.tsx
git commit -m "feat(actual-data): round editors skeleton"
```

---

## Task 16: `TeamEditor` + `AugmentSlotsQuad` + `HexModifierOverlay`

**Files:**
- Create: `src/components/actual-data/TeamEditor.tsx`
- Create: `src/components/actual-data/AugmentSlotsQuad.tsx`
- Create: `src/components/actual-data/HexModifierOverlay.tsx`
- Modify: `src/components/actual-data/PvPRoundEditor.tsx`

- [ ] **Step 1: HexModifierOverlay 작성 (간단한 배지 목록)**

Create `src/components/actual-data/HexModifierOverlay.tsx`:

```tsx
'use client';
import type { HexModifier } from '@/lib/actualData/types';

export default function HexModifierOverlay({ modifiers }: { modifiers: HexModifier[] }) {
  if (modifiers.length === 0) return null;
  return (
    <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-1">
      <strong>야스오 칸:</strong>
      <ul className="ml-2">
        {modifiers.map((m, i) => (
          <li key={i}>
            ({m.hex.q},{m.hex.r}) {m.tileId} [stage {m.stageGranted}]
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: AugmentSlotsQuad 작성 (단순 텍스트 입력)**

Create `src/components/actual-data/AugmentSlotsQuad.tsx`:

```tsx
'use client';
import type { AugmentId } from '@/lib/actualData/types';

interface Props {
  augments: [AugmentId?, AugmentId?, AugmentId?, AugmentId?];
  onChange: (augments: [AugmentId?, AugmentId?, AugmentId?, AugmentId?]) => void;
}

export default function AugmentSlotsQuad({ augments, onChange }: Props) {
  const updateSlot = (idx: number, v: string) => {
    const next = [...augments] as Props['augments'];
    next[idx] = v.trim() || undefined;
    onChange(next);
  };
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3].map(i => (
        <input key={i}
          value={augments[i] ?? ''}
          onChange={e => updateSlot(i, e.target.value)}
          placeholder={i === 3 ? '은총' : `증강 ${i + 1}`}
          className={`border p-1 rounded text-xs w-20 ${i === 3 ? 'border-amber-400 bg-amber-50' : ''}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: TeamEditor 작성 (SetupBoardCore 래핑 — props 기반 보드)**

Create `src/components/actual-data/TeamEditor.tsx`:

```tsx
'use client';
import type { TeamSnapshot } from '@/lib/actualData/types';
import AugmentSlotsQuad from './AugmentSlotsQuad';
import HexModifierOverlay from './HexModifierOverlay';

interface Props {
  label: string;
  team: TeamSnapshot;
  onChange: (team: TeamSnapshot) => void;
}

export default function TeamEditor({ label, team, onChange }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{label}</h3>

      <div className="flex gap-2">
        <label className="flex flex-col">
          <span className="text-xs">Level</span>
          <input type="number" min={1} max={10} value={team.level}
            onChange={e => onChange({ ...team, level: Number(e.target.value) })}
            className="border p-1 rounded w-16 text-sm" />
        </label>
        <label className="flex flex-col">
          <span className="text-xs">HP</span>
          <input type="number" min={0} value={team.hp}
            onChange={e => onChange({ ...team, hp: Number(e.target.value) })}
            className="border p-1 rounded w-20 text-sm" />
        </label>
      </div>

      <AugmentSlotsQuad
        augments={team.augments}
        onChange={augments => onChange({ ...team, augments })}
      />

      <HexModifierOverlay modifiers={team.hexModifiers} />

      <div className="border rounded p-2 text-xs text-gray-500">
        유닛 배치 보드 (SetupBoardCore 통합은 Task 17에서 수행).
        현재 유닛 수: {team.units.length}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: PvPRoundEditor에서 TeamEditor 통합**

Edit `PvPRoundEditor.tsx` — placeholder를 `<TeamEditor />`로 교체:

```tsx
import TeamEditor from './TeamEditor';
// ...
const updatePlayerTeam = useActualDataStore(s => s.updatePlayerTeam);
const updateOpponent = useActualDataStore(s => s.updateOpponent);
// ...
<div className="grid grid-cols-2 gap-4">
  <TeamEditor label="내 팀" team={round.playerTeam}
    onChange={t => updatePlayerTeam(index, t)} />
  <TeamEditor label="상대" team={round.opponent}
    onChange={t => updateOpponent(index, t)} />
</div>
```

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add src/components/actual-data/TeamEditor.tsx src/components/actual-data/AugmentSlotsQuad.tsx src/components/actual-data/HexModifierOverlay.tsx src/components/actual-data/PvPRoundEditor.tsx
git commit -m "feat(actual-data): team editor with augment slots + hex overlay"
```

---

## Task 17: `TeamEditor`에 `SetupBoardCore` 통합

**Files:**
- Modify: `src/components/actual-data/TeamEditor.tsx`

이 태스크는 Task 12에서 분리한 `SetupBoardCore`의 정확한 props 인터페이스에 따라 달라짐. Task 12에서 만든 실제 props를 보고 조정.

- [ ] **Step 1: SetupBoardCore props 확인**

Read `src/components/battle/SetupBoardCore.tsx` — 실제 props 목록 기록.

- [ ] **Step 2: TeamEditor에 Core 통합**

Edit `src/components/actual-data/TeamEditor.tsx` — placeholder 문단을 제거하고 `<SetupBoardCore />`를 props로 주입:

```tsx
import SetupBoardCore from '@/components/battle/SetupBoardCore';
// ...
<SetupBoardCore
  placedChampions={team.units as unknown as PlacedChampion[]}  // 타입 맵핑 필요 — 2단계
  selectedAugments={[]}  // augments는 별도 UI, 보드에 직접 전달 안 함
  onPlaceChampion={(champ, hex) => {
    onChange({
      ...team,
      units: [...team.units, {
        championId: champ.apiName,
        hex,
        starLevel: 1,
        items: [undefined, undefined, undefined],
      }],
    });
  }}
  onRemoveChampion={(hex) => {
    onChange({
      ...team,
      units: team.units.filter(u => !(u.hex.q === hex.q && u.hex.r === hex.r)),
    });
  }}
  onMoveChampion={(from, to) => {
    onChange({
      ...team,
      units: team.units.map(u =>
        u.hex.q === from.q && u.hex.r === from.r ? { ...u, hex: to } : u,
      ),
    });
  }}
/>
```

**타입 매핑 절차**:

1. `src/types/index.ts`에서 `PlacedChampion` 인터페이스 전체 필드를 확인 (`grep -n "interface PlacedChampion" src/types/index.ts` 후 해당 블록 읽기)
2. actual-data의 `PlacedUnit`에 없는 필드는 기본값 채움 (예: `mfMode: null`, `permanentStacks: null`, `isDummy: false`, `isSummon: false`)
3. 어댑터 모듈 분리: `src/lib/actualData/unitAdapter.ts`로 양방향 변환 함수 배치

어댑터 예시 (실제 필드명은 1단계에서 확인 후 교정):
```ts
// src/lib/actualData/unitAdapter.ts
import type { PlacedChampion, RawChampion } from '@/types';
import type { PlacedUnit, HexCoord } from './types';

export function toPlacedChampion(u: PlacedUnit, catalog: Map<string, RawChampion>): PlacedChampion {
  const raw = catalog.get(u.championId);
  if (!raw) throw new Error(`champion not in catalog: ${u.championId}`);
  return {
    champion: raw,
    position: u.hex,
    starLevel: u.starLevel,
    items: u.items.map(id => id ? lookupItem(id) : null),
    // 1단계에서 확인한 모든 나머지 필드에 기본값 제공
  };
}

export function fromPlacedChampion(p: PlacedChampion): PlacedUnit {
  return {
    championId: p.champion.apiName,
    hex: p.position,
    starLevel: p.starLevel,
    items: [
      p.items[0]?.apiName,
      p.items[1]?.apiName,
      p.items[2]?.apiName,
    ] as PlacedUnit['items'],
  };
}
```

`lookupItem`은 기존 `src/data/loader.ts`의 아이템 카탈로그를 이용. 카탈로그 주입은 `SetupBoardCore`의 props (Task 12 리팩터링 결과)에서 어떤 props가 필요한지에 따라 결정.

타입 불일치로 build 실패하면 해당 필드를 명확히 기록하고 fix 커밋 분리.

- [ ] **Step 3: lint + typecheck + build**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm build
```
Expected: 에러 없음. 타입 어댑터가 완전하지 않으면 여기서 발견됨 → 맞춤.

- [ ] **Step 4: 수동 테스트**

새 게임 → PvP 라운드 추가 → 내 팀 보드에 챔피언 드래그 배치 → 상대 보드에도 별도로 배치 → 라운드 변경해도 독립 상태 유지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/components/actual-data/TeamEditor.tsx
git commit -m "feat(actual-data): integrate SetupBoardCore into TeamEditor"
```

---

## Task 18: `YasuoTilePicker` + ShrineRoundEditor 통합

**Files:**
- Create: `src/components/actual-data/YasuoTilePicker.tsx`
- Modify: `src/components/actual-data/ShrineRoundEditor.tsx`

- [ ] **Step 1: YasuoTilePicker 작성**

Create `src/components/actual-data/YasuoTilePicker.tsx`:

```tsx
'use client';
import type { YasuoTileId, YasuoTilePlacement, HexCoord } from '@/lib/actualData/types';

const TILE_BY_STAGE: Record<2 | 3 | 4, YasuoTileId[]> = {
  2: ['solar', 'cryo', 'starlight', 'accel', 'storm', 'cosmic'],
  3: ['solar', 'cryo', 'starlight', 'accel', 'storm'],
  4: ['solar', 'cryo', 'starlight', 'accel', 'storm'],
};

interface Props {
  stage: 2 | 3 | 4;
  value?: YasuoTilePlacement;
  onChange: (placement: YasuoTilePlacement | undefined) => void;
}

export default function YasuoTilePicker({ stage, value, onChange }: Props) {
  const tileOptions = TILE_BY_STAGE[stage];

  function setTileId(id: YasuoTileId) {
    onChange({ hex: value?.hex ?? { q: 0, r: 0 }, tileId: id });
  }
  function setHex(part: Partial<HexCoord>) {
    if (!value) {
      onChange({ hex: { q: part.q ?? 0, r: part.r ?? 0 }, tileId: tileOptions[0] });
      return;
    }
    onChange({ ...value, hex: { ...value.hex, ...part } });
  }

  return (
    <div className="border rounded p-2 space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span>칸:</span>
        <select value={value?.tileId ?? ''} onChange={e => setTileId(e.target.value as YasuoTileId)}
          className="border p-1 rounded">
          <option value="" disabled>선택</option>
          {tileOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2 text-sm">
        <span>위치:</span>
        <input type="number" value={value?.hex.q ?? 0}
          onChange={e => setHex({ q: Number(e.target.value) })}
          className="border p-1 rounded w-16" placeholder="q" />
        <input type="number" value={value?.hex.r ?? 0}
          onChange={e => setHex({ r: Number(e.target.value) })}
          className="border p-1 rounded w-16" placeholder="r" />
        <button type="button" onClick={() => onChange(undefined)}
          className="text-xs text-red-600 underline">지우기</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ShrineRoundEditor에 통합**

Edit `ShrineRoundEditor.tsx`:

```tsx
import YasuoTilePicker from './YasuoTilePicker';
// ...
{round.playerChosenShrine === 'yasuo' && (
  <div>
    <span className="text-sm block mb-1">야스오 칸 설치</span>
    <YasuoTilePicker
      stage={Number(round.roundName.split('-')[0]) as 2 | 3 | 4}
      value={round.playerYasuoTile}
      onChange={tile => updateShrineRound(index, { playerYasuoTile: tile })}
    />
  </div>
)}
```

- [ ] **Step 3: 수동 테스트**

Shrine 라운드(2-4) 추가 → 야스오 선택 → 칸 옵션 6개 중 선택 → q/r 좌표 입력 → 다음 PvP 라운드 추가하면 `hexModifiers`에 야스오 칸이 자동 누적되는지 HexModifierOverlay로 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/actual-data/YasuoTilePicker.tsx src/components/actual-data/ShrineRoundEditor.tsx
git commit -m "feat(actual-data): yasuo tile picker + shrine integration"
```

---

## Task 19: `GraceStatus` — 은총 자동 계산

**Files:**
- Create: `src/components/actual-data/GraceStatus.tsx`
- Modify: `src/components/actual-data/TeamEditor.tsx`

- [ ] **Step 1: GraceStatus 작성**

Create `src/components/actual-data/GraceStatus.tsx`:

```tsx
'use client';
import { useActualDataStore } from '@/store/actualDataSlice';
import { inferGraceFromShrines } from '@/lib/actualData/graceInference';
import type { ShrineRound } from '@/lib/actualData/types';

export default function GraceStatus({ currentRoundIndex }: { currentRoundIndex: number }) {
  const game = useActualDataStore(s => s.currentGame);
  if (!game) return null;

  // 현재 라운드까지의 shrine 라운드만 집계
  const shrinesUpToNow = game.rounds
    .slice(0, currentRoundIndex + 1)
    .filter((r): r is ShrineRound => r.type === 'shrine');

  const inference = inferGraceFromShrines(shrinesUpToNow);

  // 4-7 이후인지 판별: roundName이 5-x 이상 or 4-7 이후
  const currentRound = game.rounds[currentRoundIndex];
  const isAfter47 = currentRound && isRoundAfter(currentRound.roundName, '4-7');

  if (!inference) {
    return <p className="text-xs text-gray-500">은총 없음 (야스오 3회 또는 다른 신 2회 이상 필요)</p>;
  }

  if (!isAfter47) {
    return <p className="text-xs text-gray-500">
      은총 예고: {inference.kind === 'yasuo_grace' ? '야스오 (칸 위력 ×1.5)' : `${inference.shrine}의 은총 증강`}
      (4-7 이후 적용)
    </p>;
  }

  if (inference.kind === 'yasuo_grace') {
    return <p className="text-xs text-amber-700 font-semibold">
      🌀 야스오의 은총 발동: 설치된 모든 칸 위력 +50% (graceApplied=true)
    </p>;
  }

  return <p className="text-xs text-amber-700">
    🌀 {inference.shrine}의 은총 증강 → 4번째 증강 슬롯 후보
  </p>;
}

function isRoundAfter(current: string, target: string): boolean {
  const [cs, cr] = current.split('-').map(Number);
  const [ts, tr] = target.split('-').map(Number);
  return cs !== ts ? cs > ts : cr > tr;
}
```

- [ ] **Step 2: TeamEditor에 통합 (내 팀에만, 상대는 알 수 없음)**

Edit `TeamEditor.tsx` — props에 `showGrace?: { roundIndex: number }` 추가:

```tsx
interface Props {
  label: string;
  team: TeamSnapshot;
  onChange: (team: TeamSnapshot) => void;
  showGrace?: { roundIndex: number };
}

// body 하단에
{showGrace && <GraceStatus currentRoundIndex={showGrace.roundIndex} />}
```

그리고 `PvPRoundEditor`에서 내 팀에만 `showGrace={{ roundIndex: index }}` 전달:

```tsx
<TeamEditor label="내 팀" team={round.playerTeam}
  onChange={t => updatePlayerTeam(index, t)}
  showGrace={{ roundIndex: index }} />
```

- [ ] **Step 3: 수동 테스트**

- Shrine 2-4, 3-4, 4-4 모두 야스오로 선택 → 5-1 PvP 라운드 추가 → "🌀 야스오의 은총 발동" 메시지 확인
- Shrine 2-4, 3-4 야스오 + 4-4 에코 → 5-1에서 "yasuo의 은총 증강" (2회 이상이므로)
- Shrine 2-4 야스오 + 3-4 에코 + 4-4 이블린 → 은총 없음

- [ ] **Step 4: Commit**

```bash
git add src/components/actual-data/GraceStatus.tsx src/components/actual-data/TeamEditor.tsx src/components/actual-data/PvPRoundEditor.tsx
git commit -m "feat(actual-data): grace status auto-calculation display"
```

---

## Task 20: `OpponentQuickFill` + `OpponentPanel`

**Files:**
- Create: `src/components/actual-data/OpponentQuickFill.tsx`
- Create: `src/components/actual-data/OpponentPanel.tsx`
- Modify: `src/components/actual-data/PvPRoundEditor.tsx`

- [ ] **Step 1: OpponentQuickFill 작성**

Create `src/components/actual-data/OpponentQuickFill.tsx`:

```tsx
'use client';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function OpponentQuickFill({ roundIndex }: { roundIndex: number }) {
  const game = useActualDataStore(s => s.currentGame);
  const copy = useActualDataStore(s => s.copyOpponentFromPreviousMeeting);
  if (!game) return null;

  // 이 라운드 이전의 PvP 라운드에서 기록된 모든 상대 riotId 수집 (중복 제거, 최신 우선)
  const seen = new Map<string, number>();   // riotId -> 마지막 등장 index
  for (let i = 0; i < roundIndex; i++) {
    const r = game.rounds[i];
    if (r.type === 'pvp' && r.opponent.riotId) {
      seen.set(r.opponent.riotId, i);
    }
  }
  const options = Array.from(seen.keys());

  if (options.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span>이전 만남 복사:</span>
      <select onChange={e => { if (e.target.value) copy(roundIndex, e.target.value); }}
        defaultValue="" className="border p-1 rounded">
        <option value="">선택...</option>
        {options.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: OpponentPanel 작성**

Create `src/components/actual-data/OpponentPanel.tsx`:

```tsx
'use client';
import type { OpponentSnapshot } from '@/lib/actualData/types';
import TeamEditor from './TeamEditor';
import OpponentQuickFill from './OpponentQuickFill';

interface Props {
  index: number;
  opponent: OpponentSnapshot;
  onChange: (o: OpponentSnapshot) => void;
}

export default function OpponentPanel({ index, opponent, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span>상대 Riot ID:</span>
        <input value={opponent.riotId ?? ''}
          onChange={e => onChange({ ...opponent, riotId: e.target.value || undefined })}
          className="border p-1 rounded" placeholder="name#TAG" />
      </label>
      <OpponentQuickFill roundIndex={index} />
      <TeamEditor label="상대 팀" team={opponent}
        onChange={t => onChange({ ...opponent, ...t })} />
    </div>
  );
}
```

- [ ] **Step 3: PvPRoundEditor에서 OpponentPanel 사용**

Edit `PvPRoundEditor.tsx`:

```tsx
import OpponentPanel from './OpponentPanel';
// ...
<OpponentPanel index={index} opponent={round.opponent}
  onChange={o => updateOpponent(index, o)} />
```

기존에 있던 상대 쪽 `<TeamEditor label="상대" .../>`는 삭제.

- [ ] **Step 4: 수동 테스트**

- PvP 라운드 1: 상대 riotId="Opp1#KR1" 입력, 유닛 배치
- PvP 라운드 2: 새 PvP 라운드 → OpponentQuickFill 드롭다운에 "Opp1#KR1" 보이는지 확인 → 선택 시 1라운드의 상대 스냅샷이 복사되는지 확인

- [ ] **Step 5: Commit**

```bash
git add src/components/actual-data/OpponentQuickFill.tsx src/components/actual-data/OpponentPanel.tsx src/components/actual-data/PvPRoundEditor.tsx
git commit -m "feat(actual-data): opponent panel with riot id + quick fill"
```

---

## Task 21: `DamageChartInput`

**Files:**
- Create: `src/components/actual-data/DamageChartInput.tsx`
- Modify: `src/components/actual-data/PvPRoundEditor.tsx`

- [ ] **Step 1: DamageChartInput 작성**

Create `src/components/actual-data/DamageChartInput.tsx`:

```tsx
'use client';
import type { UnitDamageEntry } from '@/lib/actualData/types';

interface Props {
  entries: UnitDamageEntry[];
  onChange: (entries: UnitDamageEntry[]) => void;
}

export default function DamageChartInput({ entries, onChange }: Props) {
  function addRow() {
    onChange([...entries, { championId: '', damage: 0 }]);
  }
  function updateRow(i: number, patch: Partial<UnitDamageEntry>) {
    onChange(entries.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  }
  function removeRow(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
  }

  return (
    <div className="border rounded p-2 space-y-1">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold">데미지 차트</h4>
        <button onClick={addRow} className="text-xs px-2 py-0.5 border rounded">+ 추가</button>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-500">유닛별 데미지 입력 (선택)</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr><th className="text-left">유닛 ID</th><th>데미지</th><th /></tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td><input value={e.championId} onChange={ev => updateRow(i, { championId: ev.target.value })}
                  className="border p-0.5 w-full text-xs" /></td>
                <td><input type="number" value={e.damage} onChange={ev => updateRow(i, { damage: Number(ev.target.value) })}
                  className="border p-0.5 w-full text-xs text-right" /></td>
                <td><button onClick={() => removeRow(i)} className="text-red-600">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: PvPRoundEditor에 통합**

Edit `PvPRoundEditor.tsx`:

```tsx
import DamageChartInput from './DamageChartInput';
// 하단에
<DamageChartInput
  entries={round.unitDamageChart ?? []}
  onChange={entries => useActualDataStore.getState().updatePvPRound(index, { unitDamageChart: entries })}
/>
```

- [ ] **Step 3: 수동 테스트**

PvP 라운드 편집창 → 데미지 차트 섹션 → "+ 추가" 여러번 → 유닛 ID + 데미지 입력 → 저장 후 다시 로드했을 때 유지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/actual-data/DamageChartInput.tsx src/components/actual-data/PvPRoundEditor.tsx
git commit -m "feat(actual-data): damage chart input"
```

---

## Task 22: `GameMetaEditor`

**Files:**
- Create: `src/components/actual-data/GameMetaEditor.tsx`
- Modify: `src/components/actual-data/ActualDataEditor.tsx`

- [ ] **Step 1: GameMetaEditor 작성**

Create `src/components/actual-data/GameMetaEditor.tsx`:

```tsx
'use client';
import { useActualDataStore } from '@/store/actualDataSlice';
import type { ShrineName } from '@/lib/actualData/types';

const SHRINES: ShrineName[] = ['ahri', 'aurelionSol', 'ekko', 'evelynn', 'kayle', 'soraka', 'thresh', 'varus', 'yasuo'];

export default function GameMetaEditor({ onClose }: { onClose: () => void }) {
  const game = useActualDataStore(s => s.currentGame);
  const updateGameMeta = useActualDataStore(s => s.updateGameMeta);
  if (!game) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-white p-6 rounded shadow-lg w-[420px] space-y-3">
        <h2 className="font-bold text-lg">게임 메타 편집</h2>

        <label className="flex flex-col text-sm">
          <span>Patch</span>
          <input value={game.patchVersion}
            onChange={e => updateGameMeta({ patchVersion: e.target.value })}
            className="border p-1 rounded" />
        </label>

        <label className="flex flex-col text-sm">
          <span>Player Riot ID</span>
          <input value={game.playerRiotId}
            onChange={e => updateGameMeta({ playerRiotId: e.target.value })}
            className="border p-1 rounded" />
        </label>

        <label className="flex flex-col text-sm">
          <span>Final Placement (1~8)</span>
          <input type="number" min={1} max={8} value={game.finalPlacement}
            onChange={e => updateGameMeta({ finalPlacement: Math.min(8, Math.max(1, Number(e.target.value))) as typeof game.finalPlacement })}
            className="border p-1 rounded w-20" />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-xs">신 1</span>
            <select value={game.shrinesInPlay[0]}
              onChange={e => updateGameMeta({ shrinesInPlay: [e.target.value as ShrineName, game.shrinesInPlay[1]] })}
              className="w-full border p-1 rounded">
              {SHRINES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-xs">신 2</span>
            <select value={game.shrinesInPlay[1]}
              onChange={e => updateGameMeta({ shrinesInPlay: [game.shrinesInPlay[0], e.target.value as ShrineName] })}
              className="w-full border p-1 rounded">
              {SHRINES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-3 py-1 border rounded">닫기</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ActualDataEditor에 버튼 추가**

Edit `ActualDataEditor.tsx` — 상단 헤더에 "게임 메타 편집" 버튼:

```tsx
const [metaOpen, setMetaOpen] = useState(false);
// ...
<header className="border-b p-2 flex justify-between items-center">
  <h1 className="font-bold">{game.gameId}</h1>
  <button onClick={() => setMetaOpen(true)} className="px-2 py-1 border rounded text-sm">
    게임 메타 편집
  </button>
</header>
{metaOpen && <GameMetaEditor onClose={() => setMetaOpen(false)} />}
```

- [ ] **Step 3: 수동 테스트**

편집 페이지 → 헤더의 "게임 메타 편집" 클릭 → patch/placement/shrines 수정 → 저장 후 재로드했을 때 반영 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/actual-data/GameMetaEditor.tsx src/components/actual-data/ActualDataEditor.tsx
git commit -m "feat(actual-data): game meta editor modal"
```

---

## Task 23: `SaveStatusBar` + 자동 저장 (30초)

**Files:**
- Create: `src/components/actual-data/SaveStatusBar.tsx`
- Modify: `src/components/actual-data/ActualDataEditor.tsx`

- [ ] **Step 1: SaveStatusBar 작성**

Create `src/components/actual-data/SaveStatusBar.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';

const AUTO_SAVE_MS = 30_000;

export default function SaveStatusBar() {
  const status = useActualDataStore(s => s.saveStatus);
  const lastSavedAt = useActualDataStore(s => s.lastSavedAt);
  const isDirty = useActualDataStore(s => s.isDirty);
  const saveError = useActualDataStore(s => s.saveError);
  const save = useActualDataStore(s => s.saveCurrentGame);

  // 자동 저장 30초
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => { save(); }, AUTO_SAVE_MS);
    return () => clearTimeout(timer);
  }, [isDirty, save]);

  // beforeunload 경고
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  let label: string;
  let color = 'text-gray-600';
  if (status === 'saving') label = '저장 중...';
  else if (status === 'saved') { label = '✓ 저장됨'; color = 'text-green-600'; }
  else if (status === 'error') { label = `⚠ ${saveError ?? '저장 실패'}`; color = 'text-red-600'; }
  else if (isDirty) { label = '● 변경됨 (30초 후 자동 저장)'; color = 'text-amber-600'; }
  else label = lastSavedAt ? `저장됨 ${new Date(lastSavedAt).toLocaleTimeString()}` : '';

  return (
    <div className={`flex items-center gap-2 text-sm ${color}`}>
      <span>{label}</span>
      {(isDirty || status === 'error') && (
        <button onClick={() => save()} className="px-2 py-0.5 border rounded text-xs">
          {status === 'error' ? '재시도' : '지금 저장'}
        </button>
      )}
    </div>
  );
}
```

**주의**: React Compiler의 `react-hooks/set-state-in-effect` 규칙 — useEffect 안에서 `save()` 호출은 side-effect이므로 OK (setState 자체는 아님).

- [ ] **Step 2: ActualDataEditor 헤더에 통합**

Edit `ActualDataEditor.tsx`:

```tsx
import SaveStatusBar from './SaveStatusBar';
// ...
<header className="border-b p-2 flex justify-between items-center">
  <h1 className="font-bold">{game.gameId}</h1>
  <div className="flex items-center gap-3">
    <SaveStatusBar />
    <button onClick={() => setMetaOpen(true)} className="px-2 py-1 border rounded text-sm">
      게임 메타 편집
    </button>
  </div>
</header>
```

- [ ] **Step 3: 수동 테스트**

- 편집 → 필드 변경 → "● 변경됨 (30초 후 자동 저장)" 표시 확인
- 30초 기다리면 자동 저장 → "✓ 저장됨" → 2초 후 "저장됨 HH:MM"
- "지금 저장" 버튼 수동 저장 확인
- 네트워크 오프라인 상태 재현 (dev tools) → 저장 시도 → "⚠ 저장 실패" + "재시도" 버튼 동작 확인
- 변경 있는 상태에서 새로고침 시도 → 브라우저 경고 팝업

- [ ] **Step 4: Commit**

```bash
git add src/components/actual-data/SaveStatusBar.tsx src/components/actual-data/ActualDataEditor.tsx
git commit -m "feat(actual-data): save status bar + 30s autosave + unload guard"
```

---

## Task 24: `draftStorage` — localStorage 복구

**Files:**
- Create: `src/lib/actualData/draftStorage.ts`
- Create: `tests/unit/actualData/draftStorage.test.ts`
- Modify: `src/store/actualDataSlice.ts`

- [ ] **Step 1: 테스트 작성**

Create `tests/unit/actualData/draftStorage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft } from '@/lib/actualData/draftStorage';
import type { ActualGameData } from '@/lib/actualData/types';

beforeEach(() => {
  // jsdom 필요 — 혹은 간단한 memory mock
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

function mkGame(gameId: string): ActualGameData {
  return {
    gameId,
    videoSource: { kind: 'none' },
    patchVersion: '17.1',
    playerRiotId: 'A#B',
    finalPlacement: 1,
    shrinesInPlay: ['yasuo', 'ekko'],
    timeline: [],
    createdAt: 'x',
    updatedAt: 'y',
    rounds: [],
  };
}

describe('draftStorage', () => {
  it('round-trips a game', () => {
    saveDraft(mkGame('g1'));
    const loaded = loadDraft('g1');
    expect(loaded?.gameId).toBe('g1');
  });

  it('returns null when no draft', () => {
    expect(loadDraft('missing')).toBeNull();
  });

  it('clears draft', () => {
    saveDraft(mkGame('g1'));
    clearDraft('g1');
    expect(loadDraft('g1')).toBeNull();
  });
});
```

Vitest config에 `environment: 'node'`로 되어 있어 localStorage 없음. `beforeEach`에서 모킹. 통과해야 함.

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm test tests/unit/actualData/draftStorage.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

Create `src/lib/actualData/draftStorage.ts`:

```ts
import type { ActualGameData } from './types';

const PREFIX = 'actualData:draft:';

export function saveDraft(game: ActualGameData): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(PREFIX + game.gameId, JSON.stringify(game)); } catch { /* quota */ }
}

export function loadDraft(gameId: string): ActualGameData | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(PREFIX + gameId);
  if (!raw) return null;
  try { return JSON.parse(raw) as ActualGameData; } catch { return null; }
}

export function clearDraft(gameId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(PREFIX + gameId);
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm test tests/unit/actualData/draftStorage.test.ts`
Expected: 3 tests pass

- [ ] **Step 5: 슬라이스에 통합 — 저장 실패 시 draft 백업 + 로드 시 복구**

Edit `src/store/actualDataSlice.ts`:

- 상단 import: `import { saveDraft, loadDraft, clearDraft } from '@/lib/actualData/draftStorage';`
- `saveCurrentGame`의 catch 블록에 `saveDraft(game);` 추가
- `saveCurrentGame`의 success path에 `clearDraft(game.gameId);` 추가
- `loadGame` 시작부에 draft 확인:

```ts
loadGame: async (gameId) => {
  const res = await fetch(`/api/actual-data/${gameId}`);
  if (!res.ok) throw new Error(`loadGame failed: ${res.status}`);
  const data = (await res.json()) as ActualGameData;

  // draft가 있고 서버 updatedAt보다 draft가 더 최근이면 복구 옵션 제시
  const draft = loadDraft(gameId);
  if (draft && confirm('저장 안 된 변경사항이 있습니다. 복구할까요?')) {
    set({
      currentGame: draft,
      currentRoundIndex: draft.rounds.length > 0 ? 0 : null,
      isDirty: true,
      saveStatus: 'idle',
      lastSavedAt: data.updatedAt,
    });
    return;
  }

  set({
    currentGame: data,
    currentRoundIndex: data.rounds.length > 0 ? 0 : null,
    isDirty: false,
    saveStatus: 'idle',
    lastSavedAt: data.updatedAt,
  });
},
```

- [ ] **Step 6: 수동 테스트**

- 편집 → 필드 변경 → dev tools에서 네트워크 오프라인 → "지금 저장" → 실패
- `localStorage` 확인: `actualData:draft:<gameId>` 키에 JSON 있음
- 페이지 새로고침 → "저장 안 된 변경사항이 있습니다. 복구할까요?" 프롬프트
- 예 → 변경 유지됨

- [ ] **Step 7: Commit**

```bash
git add src/lib/actualData/draftStorage.ts tests/unit/actualData/draftStorage.test.ts src/store/actualDataSlice.ts
git commit -m "feat(actual-data): localStorage draft recovery"
```

---

## Task 25: 전체 통합 테스트 체크리스트 (수동)

**Files:** 없음 (수동 검증)

- [ ] **Step 1: 서버 시작**

`pnpm dev`

- [ ] **Step 2: `/actual-data` 리스트 페이지 동작 확인**

- 페이지 로드 → 빈 리스트 or 기존 게임들 표시
- "+ 새 게임" → 모달 열림
- Patch/RiotId/신 2개 (서로 다르게) 입력 → "만들기" → 편집 페이지로 리다이렉트
- 신 2개 동일한 경우 에러 메시지 표시

- [ ] **Step 3: 편집 페이지 동작**

- 좌측 라운드 리스트 비어있음
- "+ PvP" 클릭 → 2-2 생성
- "+ PvP" → 2-3
- "+ Shrine" → 2-4
- "+ PvP" → 2-5 (hexModifiers 자동 누적 — 2-4에서 설정한 경우)
- "+ Shrine" → 3-4
- ...

- [ ] **Step 4: Shrine 라운드 야스오 칸 편집**

- 2-4 Shrine 선택 → 신: yasuo → 칸 종류 선택 + q/r 입력
- 2-5 PvP 로 이동 → 내 팀 섹션의 "야스오 칸" 오버레이에 선택한 칸이 표시되는지 확인
- 3-4 Shrine → 야스오 → 다른 칸 선택
- 3-5 PvP → 내 팀 hexModifiers에 2개 누적 표시

- [ ] **Step 5: 은총 자동 집계**

- 2-4, 3-4, 4-4 모두 야스오 → 5-1 PvP에서 "🌀 야스오의 은총 발동" 메시지
- 2-4, 3-4 야스오 + 4-4 에코 → 5-1에서 "yasuo의 은총 증강 → 4번째 슬롯 후보"
- 2-4 야스오 + 3-4 에코 + 4-4 이블린 → 은총 없음

- [ ] **Step 6: 상대 Quick Fill**

- PvP 2-2에서 상대 riotId "Opp1#KR1" + 유닛 배치
- PvP 2-5에서 OpponentQuickFill 드롭다운에 "Opp1#KR1" 표시 → 선택 → 스냅샷 복사

- [ ] **Step 7: 저장 동작**

- 변경 → 30초 대기 → 자동 저장 확인
- 변경 → "지금 저장" → 성공
- 페이지 새로고침 → 데이터 유지 확인
- (선택) 네트워크 끊고 저장 → draft 복구 확인

- [ ] **Step 8: 삭제**

- `/actual-data` 리스트 → "삭제" 버튼 → 확인 → 파일 사라짐 (`ls actual-data/`)

- [ ] **Step 9: `pnpm lint && pnpm typecheck && pnpm build`**

모두 성공해야 함.

- [ ] **Step 10: Commit**

변경 없으면 skip. 수동 테스트 도중 발견된 버그 있으면 별도 수정 커밋:

```bash
git add -p
git commit -m "fix(actual-data): <버그 내용>"
```

---

## 완료 기준 (Sub-project 1 Definition of Done)

- [ ] 모든 unit test pass (`pnpm test`)
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 성공
- [ ] `/actual-data` 리스트 + 생성 + 삭제 동작
- [ ] 편집 페이지에서 PvP/Shrine 라운드 추가/편집/삭제 가능
- [ ] 자동 복사 (내 팀 hexModifiers + units/augments/level/hp)가 예상대로 동작
- [ ] 은총 자동 집계 UI 표시 (야스오 3회 vs 다른 신 2회 이상)
- [ ] 상대 riot id + QuickFill 동작
- [ ] 30초 자동 저장 + 수동 저장 + draft 복구
- [ ] 기존 `/simulator` 페이지가 SetupBoard 리팩터링 후에도 동일하게 동작

## Sub-project 2 & 3 가이드 (참고)

이 플랜 완료 후:
- **Sub-project 2**: `docs/superpowers/plans/<date>-actual-data-subproject-2-video.md` — 영상 업로드/플레이어/타임라인
- **Sub-project 3**: `docs/superpowers/plans/<date>-actual-data-subproject-3-synergy.md` — 중재자/별돌보미/최신상 UI

각 sub-project는 스펙 `docs/superpowers/specs/2026-04-23-actual-data-design.md`의 해당 섹션을 참고.
