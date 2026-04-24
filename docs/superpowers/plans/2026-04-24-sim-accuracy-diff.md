# Sim Accuracy Diff Reporter (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a "actual-data vs sim" diff reporter that measures per-round winner/damage/survivor errors with N-run distribution, surfacing results both inline on the edit page and on a dedicated `/compare` page.

**Architecture:** New `src/lib/validation/` module (React-independent pure TS) exposing `nRunSimulator`, `schemaAdapter`, `diffReporter`, `gameDiffer`. Results cached to `actual-data/diff-<gameId>.json` via 3-endpoint API (POST/GET/DELETE). UI wraps around `useCompareDiff` SWR hook.

**Tech Stack:** TypeScript strict, Next.js 15 App Router, Zod validation, React 19 + React Compiler, Vitest, Zustand (existing, no new slice), TailwindCSS.

---

## Spec Errata (found during recon)

The spec (`docs/superpowers/specs/2026-04-24-sim-accuracy-diff-design.md`) assumed 3 things that differ from reality. Plan adjusts:

1. **`opponentDamageChart` already exists** in `PvPRoundSchema` (`src/lib/actualData/schema.ts:96`) with `DamageChartInput` UI wired in `PvPRoundEditor.tsx:178`. Plan skips adding.
2. **`arbiterLaw` already exists** as `ArbiterLawSchema` (`{ triggerId, effectId }` object) on `TeamSnapshotSchema`. `schemaAdapter` converts this object into `SimulateOptions.playerArbiterLaw` / `enemyArbiterLaw`. No schema change needed for this field.
3. **`IoniaPathType` values** are `'blades' | 'enlightenment' | 'transcendence' | 'generosity' | 'spirit'` (not `'purity' | 'balance' | 'chaos'` as written in spec).
4. **Sim winner enum** is `'player' | 'enemy' | 'draw'` (not `'opponent'`). `diffReporter` normalizes `'enemy'` → `'opponent'` when comparing to actual.
5. **`simulateCombat` signature**: `simulateCombat(allyTeam: PlacedChampion[], enemyTeam: PlacedChampion[], seedOrOptions: number | SimulateOptions)` returns `CombatResult { winner, duration, playerUnits, enemyUnits, snapshots }`.

Net effect: schema-side work is smaller; the 3 remaining additions (`survivors`, `augmentStacks`, `ioniaPath`) are the only schema changes.

---

## File Structure

### New files (17)

| File | Responsibility |
|------|----------------|
| `src/types/validation.ts` | `Distribution`, `RoundDiff`, `GameDiff`, `NumStats`, `HpStats`, `NRunInput`, `Survivor` TS types |
| `src/lib/validation/schemaAdapter.ts` | `toNRunInput(round, catalogs) → { input, warnings }` |
| `src/lib/validation/nRunSimulator.ts` | `runN(input, n, seedBase) → Distribution` — calls `simulateCombat` N times |
| `src/lib/validation/diffReporter.ts` | `compareRound(actual, dist, warnings) → RoundDiff` |
| `src/lib/validation/gameDiffer.ts` | `computeGameDiff`, `loadCachedDiff`, `saveDiffCache`, `deleteDiffCache` |
| `src/app/api/actual-data/[gameId]/compare/route.ts` | POST/GET/DELETE endpoints |
| `src/app/actual-data/[gameId]/compare/page.tsx` | Compare page (summary + table + detail) |
| `src/components/validation/RoundDiffInlineCard.tsx` | Edit-page 3-state card (A/B/C) |
| `src/components/validation/GameDiffSummaryCard.tsx` | Compare-page top summary card |
| `src/components/validation/RoundDiffTable.tsx` | Compare-page round list table |
| `src/components/validation/RoundDiffDetailPanel.tsx` | Compare-page per-round detail |
| `src/components/validation/RunCompareButton.tsx` | Shared run button with loading spinner |
| `src/hooks/useCompareDiff.ts` | SWR-style hook (manual fetch + state) |
| `tests/unit/validation/schemaAdapter.test.ts` | |
| `tests/unit/validation/nRunSimulator.test.ts` | |
| `tests/unit/validation/diffReporter.test.ts` | |
| `tests/unit/validation/gameDiffer.test.ts` | |

### Modified files (5)

| File | What changes |
|------|-------------|
| `src/lib/actualData/schema.ts` | Add `SurvivorSchema`; extend `TeamSnapshotSchema` with optional `survivors`, `augmentStacks`, `ioniaPath` |
| `src/lib/actualData/types.ts` | Re-exports / derived types if any (verify during task) |
| `src/components/actual-data/PvPRoundEditor.tsx` | Add ioniaPath dropdown, augmentStacks input, survivor input UI; mount `RoundDiffInlineCard` |
| `src/components/actual-data/TeamEditor.tsx` | Add team-level meta block (ioniaPath + stack inputs) |
| `src/data/traitModules.ts` | No change. Reuse existing `IoniaPathType` + `IONIA_PATH_NAMES` for dropdown |

---

## Phase 0: Performance Bench (1 task)

Single measurement to validate N=10 assumption. Run **before** any impl task.

### Task 0: Measure simulateCombat per-round time

**Files:**
- Create: `tests/calibration/simulate-round-bench.test.ts`

- [ ] **Step 1: Write benchmark test**

```typescript
// tests/calibration/simulate-round-bench.test.ts
import { describe, it } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import fs from 'node:fs';
import path from 'node:path';
import { loadAllChampions, loadAllTraits } from '@/data/loader';

describe('simulateCombat benchmark', () => {
  it('measures 10 runs on a late-game pvp round', async () => {
    const gamePath = path.join(process.cwd(), 'actual-data', 'game-20260424-001.json');
    const data = JSON.parse(fs.readFileSync(gamePath, 'utf-8'));
    const pvpRounds = data.rounds.filter((r: { type: string }) => r.type === 'pvp');
    const late = pvpRounds[pvpRounds.length - 1];  // last pvp round (fullest teams)

    const champions = await loadAllChampions();
    const traits = await loadAllTraits();

    const toPlaced = (u: { championId: string; starLevel: 1|2|3; hex: { q: number; r: number }; items: (string|null)[] }) => ({
      champion: champions.find(c => c.apiName === u.championId)!,
      starLevel: u.starLevel,
      position: u.hex,
      items: u.items.filter((x): x is string => !!x).map(id => ({ apiName: id } as never)),
    });

    const ally = late.playerTeam.units.map(toPlaced);
    const enemy = late.opponent.units.map(toPlaced);

    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      simulateCombat(ally, enemy, { seed: i, allTraits: traits, skipMirror: true, stageNumber: parseInt(late.roundName.split('-')[0], 10) });
    }
    const ms = performance.now() - t0;
    // Print to stdout for the plan to read. Don't assert — pure measurement.
    console.log(`[BENCH] 10 runs = ${ms.toFixed(0)}ms (avg ${(ms / 10).toFixed(0)}ms per round)`);
  });
});
```

- [ ] **Step 2: Run bench, record result**

Run: `pnpm test tests/calibration/simulate-round-bench.test.ts --run`
Expected: prints `[BENCH] 10 runs = <N>ms`.

Record the number:
- If avg per-round **< 500ms** → proceed with spec default (N=10, 21 rounds × 10 = 210 runs ≈ 20-60s total). No change.
- If avg per-round **≥ 500ms** → add note to plan: "Phase 4 initializes `defaultN = 5` instead of 10. Revisit with Web Worker in follow-up."

- [ ] **Step 3: Commit bench + decision note**

```bash
git add tests/calibration/simulate-round-bench.test.ts
git commit -m "test(validation): simulateCombat 라운드당 성능 벤치 + N=10 가정 검증"
```

---

## Phase 1: Types + schemaAdapter (4 tasks)

Establishes pure-TS foundation. No dependency on nRunSimulator or schema changes yet — adapter is written to be **tolerant of missing optional fields**.

### Task 1.1: Define validation types

**Files:**
- Create: `src/types/validation.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/types/validation.ts
import type { HexCoord } from '@/types';
import type { SimulateOptions, PlacedChampion } from '@/types';

export interface Survivor {
  hex: HexCoord;
  championId: string;
  alive: boolean;
  /** 0~100; alive=false면 0 */
  hpPercent: number;
}

export interface NumStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  /** 원본 N개 (디버그/차트용) */
  samples: number[];
}

export interface HpStats {
  /** N회 중 생존 횟수 */
  aliveCount: number;
  /** 생존했을 때 평균 HP% (aliveCount=0이면 0) */
  meanHpPercentIfAlive: number;
}

export interface Distribution {
  nRuns: number;
  winnerCounts: { player: number; opponent: number; draw: number };
  playerWinRate: number;
  /** hexKey (e.g. "2,0") → damage stats */
  playerDamage: Map<string, NumStats>;
  opponentDamage: Map<string, NumStats>;
  survivors: {
    player: Map<string, HpStats>;
    opponent: Map<string, HpStats>;
  };
  combatDurationTicks: NumStats;
}

export interface NRunInput {
  playerTeam: PlacedChampion[];
  opponentTeam: PlacedChampion[];
  simulateOptions: Omit<SimulateOptions, 'seed'>;
}

export interface DamageDiff {
  hex: HexCoord;
  championId: string;
  actual: number;
  simMean: number;
  simMedian: number;
  simRange: [number, number];
  /** (simMean - actual) / actual */
  diffPct: number;
}

export interface SurvivorDiff {
  hex: HexCoord;
  championId: string;
  team: 'player' | 'opponent';
  actualAlive: boolean;
  actualHp: number;
  /** 0~1 */
  simAliveRate: number;
  simMeanHp: number;
  aliveMismatch: boolean;
  /** simMeanHp - actualHp (percentage points) */
  hpDiffPoints: number;
}

export interface RoundDiff {
  roundName: string;
  winner: {
    actual: 'player' | 'opponent' | 'draw';
    simPlayerWinRate: number;
    /** majority sim winner === actual winner */
    matched: boolean;
    /** abs(playerWinRate - 0.5) < 0.15 */
    weakSignal: boolean;
  };
  playerDamage: DamageDiff[];
  opponentDamage?: DamageDiff[];
  survivors?: SurvivorDiff[];
  warnings: string[];
}

export interface GameDiff {
  gameId: string;
  computedAt: string;          // ISO
  sourceGameMtime: number;     // epoch ms
  engineSha: string | null;
  nRuns: number;
  seedBase: number;
  rounds: RoundDiff[];
  summary: {
    pvpRoundCount: number;
    /** rounds where majority winner matched actual */
    winnerMatchRate: number;
    /** rounds with weakSignal=true */
    weakSignalRoundCount: number;
    /** mean of all DamageDiff.diffPct across all rounds */
    avgPlayerDamageErrorPct: number;
    /** mean of SurvivorDiff.hpDiffPoints where alive agreement held */
    avgSurvivorHpErrorPts: number;
  };
}

export function hexKey(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/validation.ts
git commit -m "feat(validation): Distribution/RoundDiff/GameDiff 타입 정의"
```

---

### Task 1.2: schemaAdapter — TDD red

**Files:**
- Test: `tests/unit/validation/schemaAdapter.test.ts`

- [ ] **Step 1: Write failing tests (fixture-based)**

```typescript
// tests/unit/validation/schemaAdapter.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { toNRunInput } from '@/lib/validation/schemaAdapter';
import { loadAllChampions, loadAllTraits, loadAllAugments, loadAllItems } from '@/data/loader';
import type { RawChampion, RawTrait, RawAugment, RawItem } from '@/types';
import type { PvPRound } from '@/lib/actualData/types';

let champions: RawChampion[];
let traits: RawTrait[];
let augments: RawAugment[];
let items: RawItem[];

beforeAll(async () => {
  champions = await loadAllChampions();
  traits = await loadAllTraits();
  augments = await loadAllAugments();
  items = await loadAllItems();
});

function minimalRound(overrides: Partial<PvPRound> = {}): PvPRound {
  return {
    type: 'pvp',
    roundName: '5-5',
    videoStartTime: 0,
    playerTeam: {
      units: [{
        championId: 'TFT17_Xayah',
        hex: { q: -1, r: 3 },
        starLevel: 2,
        items: ['TFT_Item_InfinityEdge', null, null],
      }],
      augments: [null, null, null, null],
      level: 8,
      hp: 70,
      hexModifiers: [],
    },
    opponent: {
      units: [{
        championId: 'TFT17_Leona',
        hex: { q: 2, r: 3 },
        starLevel: 2,
        items: [null, null, null],
      }],
      augments: [null, null, null, null],
      level: 8,
      hp: 50,
      hexModifiers: [],
    },
    winner: 'player',
    ...overrides,
  } as PvPRound;
}

describe('schemaAdapter.toNRunInput', () => {
  it('maps minimal round to NRunInput with skipMirror=true', () => {
    const round = minimalRound();
    const { input, warnings } = toNRunInput(round, { champions, traits, augments, items });

    expect(input.simulateOptions.skipMirror).toBe(true);
    expect(input.playerTeam).toHaveLength(1);
    expect(input.opponentTeam).toHaveLength(1);
    expect(input.playerTeam[0].position).toEqual({ q: -1, r: 3 });
    expect(input.opponentTeam[0].position).toEqual({ q: 2, r: 3 });
    expect(warnings).toEqual([]);
  });

  it('parses stageNumber from roundName', () => {
    const round = minimalRound({ roundName: '5-5' });
    const { input } = toNRunInput(round, { champions, traits, augments, items });
    expect(input.simulateOptions.stageNumber).toBe(5);
  });

  it('emits warning when augmentStacks missing but stackable augment present', () => {
    const round = minimalRound({
      playerTeam: {
        ...minimalRound().playerTeam,
        augments: ['TFT11_Augment_Slammin', null, null, null],
      },
    });
    const { warnings } = toNRunInput(round, { champions, traits, augments, items });
    expect(warnings.some(w => w.includes('슬래민') && w.includes('스택'))).toBe(true);
  });

  it('emits warning when ioniaPath missing but ionia trait active', () => {
    // Build a team with 2+ ionia units to activate trait (assumes ionia min=2)
    const round = minimalRound({
      playerTeam: {
        ...minimalRound().playerTeam,
        units: [
          { championId: 'TFT17_Xayah', hex: { q: 0, r: 3 }, starLevel: 2, items: [null, null, null] },
          { championId: 'TFT17_Yasuo', hex: { q: 1, r: 3 }, starLevel: 2, items: [null, null, null] },
        ],
      },
    });
    const { warnings } = toNRunInput(round, { champions, traits, augments, items });
    // Only assert if Xayah+Yasuo both have 아이오니아 trait in current dataset; otherwise skip
    const isIonia = (c: RawChampion) => c.traits.includes('아이오니아');
    const xayah = champions.find(c => c.apiName === 'TFT17_Xayah');
    const yasuo = champions.find(c => c.apiName === 'TFT17_Yasuo');
    if (xayah && yasuo && isIonia(xayah) && isIonia(yasuo)) {
      expect(warnings.some(w => w.includes('아이오니아') && w.includes('길'))).toBe(true);
    }
  });

  it('passes ioniaPath when provided', () => {
    const round = minimalRound({
      playerTeam: {
        ...minimalRound().playerTeam,
        ioniaPath: 'blades',
      } as never,
    });
    const { input } = toNRunInput(round, { champions, traits, augments, items });
    expect(input.simulateOptions.playerIoniaPath).toBe('blades');
  });

  it('passes arbiterLaw effectId when provided', () => {
    const round = minimalRound({
      playerTeam: {
        ...minimalRound().playerTeam,
        arbiterLaw: { triggerId: 'trig1', effectId: 'eff_strength' },
      },
    });
    const { input } = toNRunInput(round, { champions, traits, augments, items });
    expect(input.simulateOptions.playerArbiterLaw).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — should fail (import resolve error)**

Run: `pnpm test tests/unit/validation/schemaAdapter.test.ts --run`
Expected: FAIL — `Cannot find module '@/lib/validation/schemaAdapter'`.

---

### Task 1.3: schemaAdapter — implement

**Files:**
- Create: `src/lib/validation/schemaAdapter.ts`

- [ ] **Step 1: Inspect existing loaders and data shapes**

Run: `rtk grep -n "export async function loadAllChampions\|export async function loadAllTraits\|export async function loadAllAugments\|export async function loadAllItems" src/data/loader.ts`
Expected: prints line numbers for these 4 exports. If any missing, check actual file and adjust imports in the impl below.

- [ ] **Step 2: Inspect stackable augments list**

Run: `rtk grep -rn "stackable\|Stackable\|stackCount" src/data src/lib/simulator/systems/augment.ts | head -20`
Expected: find either a data field `stackable: true` or a hardcoded list (`findCarryAugment` etc.). Record the source; implementation below uses a simple hardcoded set as fallback if no data flag exists — see STACKABLE_AUGMENT_APINAMES constant.

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/validation/schemaAdapter.ts
import type { NRunInput } from '@/types/validation';
import type { RawChampion, RawTrait, RawAugment, RawItem, PlacedChampion, ArbiterLaw } from '@/types';
import type { PvPRound, PlacedUnit, TeamSnapshot } from '@/lib/actualData/types';
import type { IoniaPathType } from '@/data/traitModules';

export interface AdapterCatalogs {
  champions: RawChampion[];
  traits: RawTrait[];
  augments: RawAugment[];
  items: RawItem[];
}

export interface AdapterResult {
  input: NRunInput;
  warnings: string[];
}

/** Set 17에서 시뮬 결과에 스택이 영향 주는 증강들. 구현 시 데이터에 flag 있으면 교체. */
const STACKABLE_AUGMENT_APINAMES = new Set<string>([
  'TFT11_Augment_Slammin',
  'TFT_Augment_Cremation',        // placeholder — 실제 apiName 확인 필요
  'TFT_Augment_Savior',
]);

/** 아이오니아 trait 활성 시 길 미지정이면 경고. */
const IONIA_TRAIT_KR = '아이오니아';
/** 중재자 trait 활성 시 법률 미지정이면 경고. */
const ARBITER_TRAIT_KR = '중재자';
/** 필트오버 모듈 미반영 경고. */
const PILTOVER_TRAIT_KR = '필트오버';

function toPlacedChampion(unit: PlacedUnit, catalogs: AdapterCatalogs): PlacedChampion | null {
  const champion = catalogs.champions.find(c => c.apiName === unit.championId);
  if (!champion) return null;
  const items = unit.items
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map(id => catalogs.items.find(i => i.apiName === id))
    .filter((i): i is RawItem => !!i);
  return {
    champion,
    starLevel: unit.starLevel,
    position: unit.hex,
    items,
  };
}

function countTraitUnits(units: PlacedChampion[], traitName: string): number {
  const seenChampIds = new Set<string>();
  let count = 0;
  for (const u of units) {
    if (seenChampIds.has(u.champion.apiName)) continue;
    seenChampIds.add(u.champion.apiName);
    if (u.champion.traits.includes(traitName)) count++;
  }
  return count;
}

function toTeamAugments(
  apiNames: (string | null)[],
  allAugments: RawAugment[],
): RawAugment[] {
  return apiNames
    .filter((n): n is string => !!n)
    .map(n => allAugments.find(a => a.apiName === n))
    .filter((a): a is RawAugment => !!a);
}

export function toNRunInput(round: PvPRound, catalogs: AdapterCatalogs): AdapterResult {
  const warnings: string[] = [];

  const playerPlaced = round.playerTeam.units
    .map(u => toPlacedChampion(u, catalogs))
    .filter((p): p is PlacedChampion => !!p);
  const opponentPlaced = round.opponent.units
    .map(u => toPlacedChampion(u, catalogs))
    .filter((p): p is PlacedChampion => !!p);

  const stageNumber = parseInt(round.roundName.split('-')[0], 10);

  const playerAugments = toTeamAugments(round.playerTeam.augments, catalogs.augments);
  const enemyAugments = toTeamAugments(round.opponent.augments, catalogs.augments);

  // stackable augment warnings
  const playerStackableMissing = playerAugments.filter(
    a => STACKABLE_AUGMENT_APINAMES.has(a.apiName) && !(round.playerTeam.augmentStacks?.[a.apiName]),
  );
  for (const a of playerStackableMissing) {
    warnings.push(`내 팀: '${a.name ?? a.apiName}' 스택 미입력 → 1로 가정`);
  }
  const enemyStackableMissing = enemyAugments.filter(
    a => STACKABLE_AUGMENT_APINAMES.has(a.apiName) && !(round.opponent.augmentStacks?.[a.apiName]),
  );
  for (const a of enemyStackableMissing) {
    warnings.push(`상대: '${a.name ?? a.apiName}' 스택 미입력 → 1로 가정`);
  }

  // ionia path warnings
  if (countTraitUnits(playerPlaced, IONIA_TRAIT_KR) >= 2 && !round.playerTeam.ioniaPath) {
    warnings.push('내 팀: 아이오니아 길 미선택 → 기본값 사용');
  }
  if (countTraitUnits(opponentPlaced, IONIA_TRAIT_KR) >= 2 && !round.opponent.ioniaPath) {
    warnings.push('상대: 아이오니아 길 미선택 → 기본값 사용');
  }

  // arbiter law warnings
  if (countTraitUnits(playerPlaced, ARBITER_TRAIT_KR) >= 1 && !round.playerTeam.arbiterLaw) {
    warnings.push('내 팀: 중재자 법률 미선택 → 기본값 사용');
  }
  if (countTraitUnits(opponentPlaced, ARBITER_TRAIT_KR) >= 1 && !round.opponent.arbiterLaw) {
    warnings.push('상대: 중재자 법률 미선택 → 기본값 사용');
  }

  // piltover warning (no schema field planned — always warn when active)
  if (countTraitUnits(playerPlaced, PILTOVER_TRAIT_KR) >= 1) {
    warnings.push('내 팀: 필트오버 모듈 정보 없음 — 시뮬 부정확 가능');
  }
  if (countTraitUnits(opponentPlaced, PILTOVER_TRAIT_KR) >= 1) {
    warnings.push('상대: 필트오버 모듈 정보 없음 — 시뮬 부정확 가능');
  }

  const playerIoniaPath: IoniaPathType | undefined =
    (round.playerTeam.ioniaPath as IoniaPathType | undefined) ?? undefined;
  const enemyIoniaPath: IoniaPathType | undefined =
    (round.opponent.ioniaPath as IoniaPathType | undefined) ?? undefined;

  return {
    input: {
      playerTeam: playerPlaced,
      opponentTeam: opponentPlaced,
      simulateOptions: {
        allTraits: catalogs.traits,
        playerAugments,
        enemyAugments,
        playerAugmentStacks: round.playerTeam.augmentStacks,
        enemyAugmentStacks: round.opponent.augmentStacks,
        playerIoniaPath,
        enemyIoniaPath,
        playerArbiterLaw: round.playerTeam.arbiterLaw as ArbiterLaw | undefined,
        enemyArbiterLaw: round.opponent.arbiterLaw as ArbiterLaw | undefined,
        skipMirror: true,
        stageNumber: Number.isFinite(stageNumber) ? stageNumber : 4,
      },
    },
    warnings,
  };
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `pnpm test tests/unit/validation/schemaAdapter.test.ts --run`
Expected: all tests PASS. If the "emits warning when augmentStacks missing" fails because `STACKABLE_AUGMENT_APINAMES` doesn't contain slammin's actual apiName, fix the constant by running `rtk grep -rn "Slammin\|슬래민" src/data public/data | head -10` to find the correct apiName and update.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation/schemaAdapter.ts tests/unit/validation/schemaAdapter.test.ts
git commit -m "feat(validation): schemaAdapter — actual-data round → NRunInput 변환 + 누락 경고"
```

---

### Task 1.4: Verify adapter against real fixture

**Files:**
- Modify: `tests/unit/validation/schemaAdapter.test.ts`

- [ ] **Step 1: Add integration-style test reading actual file**

Add this `describe` block at the end of the test file:

```typescript
describe('schemaAdapter with real fixture', () => {
  it('processes every pvp round in game-20260424-001.json without throw', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'actual-data', 'game-20260424-001.json'),
      'utf-8',
    );
    const data = JSON.parse(raw);
    const pvpRounds = data.rounds.filter((r: { type: string }) => r.type === 'pvp');
    expect(pvpRounds.length).toBeGreaterThan(0);

    for (const round of pvpRounds) {
      const { input, warnings } = toNRunInput(round, { champions, traits, augments, items });
      expect(input.playerTeam.length).toBeGreaterThanOrEqual(0);
      expect(input.opponentTeam.length).toBeGreaterThanOrEqual(0);
      expect(input.simulateOptions.skipMirror).toBe(true);
      expect(Array.isArray(warnings)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run, verify PASS**

Run: `pnpm test tests/unit/validation/schemaAdapter.test.ts --run`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/validation/schemaAdapter.test.ts
git commit -m "test(validation): schemaAdapter를 실제 fixture 21라운드로 통합 검증"
```

---

## Phase 2: nRunSimulator (3 tasks) — parallel with Phase 1

Does NOT depend on schemaAdapter. Can ship in parallel.

### Task 2.1: nRunSimulator — TDD red

**Files:**
- Test: `tests/unit/validation/nRunSimulator.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/validation/nRunSimulator.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { runN } from '@/lib/validation/nRunSimulator';
import { loadAllChampions, loadAllTraits, loadAllItems } from '@/data/loader';
import type { RawChampion, RawTrait, RawItem, PlacedChampion } from '@/types';
import type { NRunInput } from '@/types/validation';

let champions: RawChampion[];
let traits: RawTrait[];
let items: RawItem[];

beforeAll(async () => {
  champions = await loadAllChampions();
  traits = await loadAllTraits();
  items = await loadAllItems();
});

function makeInput(): NRunInput {
  const jinx = champions.find(c => c.apiName === 'TFT17_Jinx')!;
  const leona = champions.find(c => c.apiName === 'TFT17_Leona')!;
  return {
    playerTeam: [{ champion: jinx, starLevel: 2, position: { q: 0, r: 3 }, items: [] }],
    opponentTeam: [{ champion: leona, starLevel: 2, position: { q: 3, r: 3 }, items: [] }],
    simulateOptions: { allTraits: traits, skipMirror: true, stageNumber: 3 },
  };
}

describe('nRunSimulator.runN', () => {
  it('returns Distribution with correct nRuns', () => {
    const dist = runN(makeInput(), 5, 0);
    expect(dist.nRuns).toBe(5);
    expect(dist.winnerCounts.player + dist.winnerCounts.opponent + dist.winnerCounts.draw).toBe(5);
  });

  it('is deterministic for same seedBase', () => {
    const a = runN(makeInput(), 5, 42);
    const b = runN(makeInput(), 5, 42);
    expect(a.winnerCounts).toEqual(b.winnerCounts);
    expect(a.playerWinRate).toBe(b.playerWinRate);
    expect(a.combatDurationTicks.mean).toBe(b.combatDurationTicks.mean);
  });

  it('differs with different seedBase', () => {
    const a = runN(makeInput(), 5, 0);
    const b = runN(makeInput(), 5, 1000);
    // Not guaranteed different in every scenario, but samples should not all match
    const aSamples = a.combatDurationTicks.samples.join(',');
    const bSamples = b.combatDurationTicks.samples.join(',');
    expect(aSamples === bSamples && aSamples.length > 0).toBe(false);
  });

  it('collects per-unit damage stats keyed by hex', () => {
    const dist = runN(makeInput(), 3, 0);
    expect(dist.playerDamage.has('0,3')).toBe(true);
    const jinxStats = dist.playerDamage.get('0,3')!;
    expect(jinxStats.samples).toHaveLength(3);
    expect(jinxStats.mean).toBeGreaterThanOrEqual(0);
  });

  it('collects survivor HpStats per team', () => {
    const dist = runN(makeInput(), 3, 0);
    const leonaHp = dist.survivors.opponent.get('3,3');
    expect(leonaHp).toBeDefined();
    expect(leonaHp!.aliveCount).toBeGreaterThanOrEqual(0);
    expect(leonaHp!.aliveCount).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run — should fail (module not found)**

Run: `pnpm test tests/unit/validation/nRunSimulator.test.ts --run`
Expected: FAIL — `Cannot find module '@/lib/validation/nRunSimulator'`.

---

### Task 2.2: nRunSimulator — implement

**Files:**
- Create: `src/lib/validation/nRunSimulator.ts`

- [ ] **Step 1: Write implementation**

```typescript
// src/lib/validation/nRunSimulator.ts
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import type { CombatResult, CombatUnit } from '@/types';
import type { Distribution, NRunInput, NumStats, HpStats } from '@/types/validation';
import { hexKey } from '@/types/validation';

function numStats(samples: number[]): NumStats {
  if (samples.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, samples: [] };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    samples: [...samples],
  };
}

function collectDamagePerUnit(units: CombatUnit[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const u of units) {
    out.set(hexKey(u.position), u.totalDamageDealt);
  }
  return out;
}

function collectSurvivorState(units: CombatUnit[]): Map<string, { alive: boolean; hpPct: number }> {
  const out = new Map<string, { alive: boolean; hpPct: number }>();
  for (const u of units) {
    const alive = u.currentHp > 0;
    const hpPct = u.maxHp > 0 ? Math.max(0, Math.min(100, (u.currentHp / u.maxHp) * 100)) : 0;
    out.set(hexKey(u.position), { alive, hpPct: alive ? hpPct : 0 });
  }
  return out;
}

export function runN(input: NRunInput, n = 10, seedBase = 0): Distribution {
  const winnerCounts = { player: 0, opponent: 0, draw: 0 };
  const durations: number[] = [];

  const playerDamageSamples = new Map<string, number[]>();
  const opponentDamageSamples = new Map<string, number[]>();
  const playerSurvivorRuns = new Map<string, { aliveCount: number; hpSum: number }>();
  const opponentSurvivorRuns = new Map<string, { aliveCount: number; hpSum: number }>();

  for (let i = 0; i < n; i++) {
    const result: CombatResult = simulateCombat(
      input.playerTeam,
      input.opponentTeam,
      { ...input.simulateOptions, seed: seedBase + i },
    );

    // normalize 'enemy' → 'opponent' in winner counts
    if (result.winner === 'player') winnerCounts.player++;
    else if (result.winner === 'enemy') winnerCounts.opponent++;
    else winnerCounts.draw++;

    durations.push(result.duration);

    const pDmg = collectDamagePerUnit(result.playerUnits);
    for (const [k, v] of pDmg) {
      const arr = playerDamageSamples.get(k) ?? [];
      arr.push(v);
      playerDamageSamples.set(k, arr);
    }
    const eDmg = collectDamagePerUnit(result.enemyUnits);
    for (const [k, v] of eDmg) {
      const arr = opponentDamageSamples.get(k) ?? [];
      arr.push(v);
      opponentDamageSamples.set(k, arr);
    }

    const pSurv = collectSurvivorState(result.playerUnits);
    for (const [k, s] of pSurv) {
      const cur = playerSurvivorRuns.get(k) ?? { aliveCount: 0, hpSum: 0 };
      if (s.alive) { cur.aliveCount++; cur.hpSum += s.hpPct; }
      playerSurvivorRuns.set(k, cur);
    }
    const eSurv = collectSurvivorState(result.enemyUnits);
    for (const [k, s] of eSurv) {
      const cur = opponentSurvivorRuns.get(k) ?? { aliveCount: 0, hpSum: 0 };
      if (s.alive) { cur.aliveCount++; cur.hpSum += s.hpPct; }
      opponentSurvivorRuns.set(k, cur);
    }
  }

  const playerDamage = new Map<string, NumStats>();
  for (const [k, samples] of playerDamageSamples) playerDamage.set(k, numStats(samples));
  const opponentDamage = new Map<string, NumStats>();
  for (const [k, samples] of opponentDamageSamples) opponentDamage.set(k, numStats(samples));

  const playerSurv = new Map<string, HpStats>();
  for (const [k, v] of playerSurvivorRuns) {
    playerSurv.set(k, {
      aliveCount: v.aliveCount,
      meanHpPercentIfAlive: v.aliveCount === 0 ? 0 : v.hpSum / v.aliveCount,
    });
  }
  const opponentSurv = new Map<string, HpStats>();
  for (const [k, v] of opponentSurvivorRuns) {
    opponentSurv.set(k, {
      aliveCount: v.aliveCount,
      meanHpPercentIfAlive: v.aliveCount === 0 ? 0 : v.hpSum / v.aliveCount,
    });
  }

  return {
    nRuns: n,
    winnerCounts,
    playerWinRate: winnerCounts.player / n,
    playerDamage,
    opponentDamage,
    survivors: { player: playerSurv, opponent: opponentSurv },
    combatDurationTicks: numStats(durations),
  };
}
```

- [ ] **Step 2: Run tests, verify PASS**

Run: `pnpm test tests/unit/validation/nRunSimulator.test.ts --run`
Expected: all 5 tests PASS.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validation/nRunSimulator.ts tests/unit/validation/nRunSimulator.test.ts
git commit -m "feat(validation): nRunSimulator — N회 시뮬 + Distribution aggregate (재사용 코어)"
```

---

### Task 2.3: Smoke test nRunSimulator with fixture

**Files:**
- Modify: `tests/unit/validation/nRunSimulator.test.ts`

- [ ] **Step 1: Append smoke test**

Append at end of the file:

```typescript
describe('runN smoke test with real late-game round', () => {
  it('completes late-game round within 5s at N=3', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'actual-data', 'game-20260424-001.json'),
      'utf-8',
    );
    const data = JSON.parse(raw);
    const pvpRounds = data.rounds.filter((r: { type: string }) => r.type === 'pvp');
    const late = pvpRounds[pvpRounds.length - 1];

    // Smoke test — items empty for speed. Real adapter test is in schemaAdapter.test.ts
    const ally = late.playerTeam.units
      .map((u: { championId: string; starLevel: 1|2|3; hex: { q: number; r: number } }) => ({
        champion: champions.find(c => c.apiName === u.championId)!,
        starLevel: u.starLevel,
        position: u.hex,
        items: [],
      }))
      .filter((p: { champion: RawChampion | undefined }) => !!p.champion);
    const enemy = late.opponent.units
      .map((u: { championId: string; starLevel: 1|2|3; hex: { q: number; r: number } }) => ({
        champion: champions.find(c => c.apiName === u.championId)!,
        starLevel: u.starLevel,
        position: u.hex,
        items: [],
      }))
      .filter((p: { champion: RawChampion | undefined }) => !!p.champion);

    const t0 = performance.now();
    const dist = runN({ playerTeam: ally, opponentTeam: enemy, simulateOptions: { allTraits: traits, skipMirror: true, stageNumber: 5 } }, 3, 0);
    const ms = performance.now() - t0;

    expect(dist.nRuns).toBe(3);
    expect(ms).toBeLessThan(5000);
  }, 10_000);
});
```

- [ ] **Step 2: Run, verify PASS**

Run: `pnpm test tests/unit/validation/nRunSimulator.test.ts --run`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/validation/nRunSimulator.test.ts
git commit -m "test(validation): nRunSimulator smoke — 실제 후반 라운드 N=3 성능 경계 검증"
```

---

## Phase 3: diffReporter (2 tasks)

Depends on Phase 1 types and Phase 2 Distribution shape.

### Task 3.1: diffReporter — TDD red

**Files:**
- Test: `tests/unit/validation/diffReporter.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/validation/diffReporter.test.ts
import { describe, it, expect } from 'vitest';
import { compareRound } from '@/lib/validation/diffReporter';
import type { PvPRound } from '@/lib/actualData/types';
import type { Distribution, NumStats, HpStats } from '@/types/validation';

function fakeNumStats(mean: number, samples = [mean]): NumStats {
  return { mean, median: mean, min: Math.min(...samples), max: Math.max(...samples), samples };
}

function fakeDist(overrides: Partial<Distribution> = {}): Distribution {
  return {
    nRuns: 10,
    winnerCounts: { player: 7, opponent: 3, draw: 0 },
    playerWinRate: 0.7,
    playerDamage: new Map([['0,3', fakeNumStats(4000)]]),
    opponentDamage: new Map([['3,3', fakeNumStats(2000)]]),
    survivors: {
      player: new Map([['0,3', { aliveCount: 8, meanHpPercentIfAlive: 60 } as HpStats]]),
      opponent: new Map([['3,3', { aliveCount: 2, meanHpPercentIfAlive: 20 } as HpStats]]),
    },
    combatDurationTicks: fakeNumStats(200),
    ...overrides,
  };
}

function fakeRound(overrides: Partial<PvPRound> = {}): PvPRound {
  return {
    type: 'pvp',
    roundName: '5-5',
    videoStartTime: 0,
    playerTeam: {
      units: [{ championId: 'TFT17_Xayah', hex: { q: 0, r: 3 }, starLevel: 2, items: [null, null, null] }],
      augments: [null, null, null, null],
      level: 8, hp: 70, hexModifiers: [],
    },
    opponent: {
      units: [{ championId: 'TFT17_Leona', hex: { q: 3, r: 3 }, starLevel: 2, items: [null, null, null] }],
      augments: [null, null, null, null],
      level: 8, hp: 50, hexModifiers: [],
    },
    winner: 'player',
    playerDamageChart: [{ unitHex: { q: 0, r: 3 }, championId: 'TFT17_Xayah', damage: 5000 }],
    ...overrides,
  } as PvPRound;
}

describe('diffReporter.compareRound', () => {
  it('computes winner match', () => {
    const diff = compareRound(fakeRound(), fakeDist(), []);
    expect(diff.winner.actual).toBe('player');
    expect(diff.winner.simPlayerWinRate).toBe(0.7);
    expect(diff.winner.matched).toBe(true);
    expect(diff.winner.weakSignal).toBe(false);
  });

  it('flags weak signal when playerWinRate near 50%', () => {
    const dist = fakeDist({ winnerCounts: { player: 4, opponent: 6, draw: 0 }, playerWinRate: 0.4 });
    const diff = compareRound(fakeRound(), dist, []);
    expect(diff.winner.weakSignal).toBe(true);
  });

  it('computes player damage diffPct', () => {
    const diff = compareRound(fakeRound(), fakeDist(), []);
    const xayahDiff = diff.playerDamage.find(d => d.hex.q === 0 && d.hex.r === 3)!;
    expect(xayahDiff.actual).toBe(5000);
    expect(xayahDiff.simMean).toBe(4000);
    expect(xayahDiff.diffPct).toBeCloseTo((4000 - 5000) / 5000, 4);
  });

  it('skips opponent damage when actual chart absent', () => {
    const diff = compareRound(fakeRound(), fakeDist(), []);
    expect(diff.opponentDamage).toBeUndefined();
  });

  it('includes opponent damage diff when actual chart provided', () => {
    const round = fakeRound({
      opponentDamageChart: [{ unitHex: { q: 3, r: 3 }, championId: 'TFT17_Leona', damage: 1500 }],
    });
    const diff = compareRound(round, fakeDist(), []);
    expect(diff.opponentDamage).toHaveLength(1);
    expect(diff.opponentDamage![0].diffPct).toBeCloseTo((2000 - 1500) / 1500, 4);
  });

  it('computes survivor diffs when actual survivors provided', () => {
    const round = fakeRound({
      playerTeam: {
        ...fakeRound().playerTeam,
        survivors: [{ hex: { q: 0, r: 3 }, championId: 'TFT17_Xayah', alive: true, hpPercent: 40 }],
      },
      opponent: {
        ...fakeRound().opponent,
        survivors: [{ hex: { q: 3, r: 3 }, championId: 'TFT17_Leona', alive: false, hpPercent: 0 }],
      },
    });
    const diff = compareRound(round, fakeDist(), []);
    expect(diff.survivors).toHaveLength(2);
    const leonaDiff = diff.survivors!.find(s => s.team === 'opponent')!;
    expect(leonaDiff.actualAlive).toBe(false);
    expect(leonaDiff.simAliveRate).toBe(0.2);
    expect(leonaDiff.aliveMismatch).toBe(false);  // 0.2 < 0.5 → sim says dead too
  });

  it('passes through warnings', () => {
    const diff = compareRound(fakeRound(), fakeDist(), ['warn1', 'warn2']);
    expect(diff.warnings).toEqual(['warn1', 'warn2']);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `pnpm test tests/unit/validation/diffReporter.test.ts --run`
Expected: FAIL — module not found.

---

### Task 3.2: diffReporter — implement

**Files:**
- Create: `src/lib/validation/diffReporter.ts`

- [ ] **Step 1: Write implementation**

```typescript
// src/lib/validation/diffReporter.ts
import type { PvPRound, TeamSnapshot } from '@/lib/actualData/types';
import type { Distribution, RoundDiff, DamageDiff, SurvivorDiff } from '@/types/validation';
import { hexKey } from '@/types/validation';
import type { HexCoord } from '@/types';

const WEAK_SIGNAL_THRESHOLD = 0.15;

function majoritySimWinner(dist: Distribution): 'player' | 'opponent' | 'draw' {
  const { player, opponent, draw } = dist.winnerCounts;
  if (player >= opponent && player >= draw) return 'player';
  if (opponent >= draw) return 'opponent';
  return 'draw';
}

function toDamageDiff(
  hex: HexCoord,
  championId: string,
  actual: number,
  sim: Distribution['playerDamage'] extends Map<string, infer S> ? S : never,
): DamageDiff {
  return {
    hex,
    championId,
    actual,
    simMean: sim.mean,
    simMedian: sim.median,
    simRange: [sim.min, sim.max],
    diffPct: actual === 0 ? 0 : (sim.mean - actual) / actual,
  };
}

function collectDamageDiffs(
  chart: { unitHex: HexCoord; championId: string; damage: number }[] | undefined,
  dist: Distribution['playerDamage'],
): DamageDiff[] | undefined {
  if (!chart) return undefined;
  const out: DamageDiff[] = [];
  for (const entry of chart) {
    const sim = dist.get(hexKey(entry.unitHex));
    if (!sim) continue;
    out.push(toDamageDiff(entry.unitHex, entry.championId, entry.damage, sim));
  }
  return out;
}

function collectSurvivorDiffs(
  team: 'player' | 'opponent',
  snapshot: TeamSnapshot,
  dist: Distribution['survivors']['player'],
  nRuns: number,
): SurvivorDiff[] {
  if (!snapshot.survivors) return [];
  const out: SurvivorDiff[] = [];
  for (const s of snapshot.survivors) {
    const key = hexKey(s.hex);
    const simHp = dist.get(key);
    if (!simHp) continue;
    const simAliveRate = simHp.aliveCount / nRuns;
    const simMeanHp = simHp.meanHpPercentIfAlive;
    out.push({
      hex: s.hex,
      championId: s.championId,
      team,
      actualAlive: s.alive,
      actualHp: s.hpPercent,
      simAliveRate,
      simMeanHp,
      aliveMismatch: s.alive !== (simAliveRate > 0.5),
      hpDiffPoints: simMeanHp - s.hpPercent,
    });
  }
  return out;
}

export function compareRound(
  actual: PvPRound,
  distribution: Distribution,
  warnings: string[],
): RoundDiff {
  const simWinner = majoritySimWinner(distribution);
  const actualWinner = actual.winner === 'draw' ? 'draw' : actual.winner;
  const playerWinRate = distribution.playerWinRate;

  const playerDamage = collectDamageDiffs(actual.playerDamageChart, distribution.playerDamage) ?? [];
  const opponentDamage = collectDamageDiffs(actual.opponentDamageChart, distribution.opponentDamage);

  const playerSurv = collectSurvivorDiffs('player', actual.playerTeam, distribution.survivors.player, distribution.nRuns);
  const opponentSurv = collectSurvivorDiffs('opponent', actual.opponent, distribution.survivors.opponent, distribution.nRuns);
  const survivors = [...playerSurv, ...opponentSurv];

  return {
    roundName: actual.roundName,
    winner: {
      actual: actualWinner,
      simPlayerWinRate: playerWinRate,
      matched: simWinner === actualWinner,
      weakSignal: Math.abs(playerWinRate - 0.5) < WEAK_SIGNAL_THRESHOLD,
    },
    playerDamage,
    opponentDamage,
    survivors: survivors.length > 0 ? survivors : undefined,
    warnings: [...warnings],
  };
}
```

- [ ] **Step 2: Run tests, verify PASS**

Run: `pnpm test tests/unit/validation/diffReporter.test.ts --run`
Expected: all 7 tests PASS.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validation/diffReporter.ts tests/unit/validation/diffReporter.test.ts
git commit -m "feat(validation): diffReporter — 라운드 단위 actual vs sim 비교 (winner/딜/생존)"
```

---

## Phase 4: gameDiffer + API (3 tasks)

Brings adapter+runner+reporter together and exposes via API.

### Task 4.1: gameDiffer — TDD red + green

**Files:**
- Create: `src/lib/validation/gameDiffer.ts`
- Test: `tests/unit/validation/gameDiffer.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/validation/gameDiffer.test.ts
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { computeGameDiff, loadCachedDiff, saveDiffCache, deleteDiffCache, cacheFilePath } from '@/lib/validation/gameDiffer';
import fs from 'node:fs';

const TEST_GAME_ID = 'game-20260424-001';

afterEach(async () => {
  try { fs.unlinkSync(cacheFilePath(TEST_GAME_ID)); } catch {}
});

describe('gameDiffer', () => {
  it('computes GameDiff for all pvp rounds', async () => {
    const diff = await computeGameDiff(TEST_GAME_ID, { n: 2, seedBase: 0 });
    expect(diff.gameId).toBe(TEST_GAME_ID);
    expect(diff.rounds.length).toBeGreaterThan(0);
    expect(diff.summary.pvpRoundCount).toBe(diff.rounds.length);
    expect(diff.nRuns).toBe(2);
    expect(typeof diff.sourceGameMtime).toBe('number');
  }, 120_000);

  it('save + load roundtrips', async () => {
    const diff = await computeGameDiff(TEST_GAME_ID, { n: 1, seedBase: 0 });
    await saveDiffCache(TEST_GAME_ID, diff);
    const loaded = await loadCachedDiff(TEST_GAME_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.diff.gameId).toBe(TEST_GAME_ID);
    expect(loaded!.stale).toBe(false);
  }, 120_000);

  it('deleteDiffCache is idempotent', async () => {
    await deleteDiffCache(TEST_GAME_ID);  // no file
    await deleteDiffCache(TEST_GAME_ID);  // still no file — shouldn't throw
    expect(true).toBe(true);
  });

  it('returns null for non-existent game cache', async () => {
    const result = await loadCachedDiff('nonexistent-game-id');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Write gameDiffer impl**

```typescript
// src/lib/validation/gameDiffer.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ActualGameDataSchema } from '@/lib/actualData/schema';
import { loadAllChampions, loadAllTraits, loadAllAugments, loadAllItems } from '@/data/loader';
import { toNRunInput } from '@/lib/validation/schemaAdapter';
import { runN } from '@/lib/validation/nRunSimulator';
import { compareRound } from '@/lib/validation/diffReporter';
import type { GameDiff, RoundDiff } from '@/types/validation';

const DATA_DIR = path.join(process.cwd(), 'actual-data');

export function gameFilePath(gameId: string): string {
  return path.join(DATA_DIR, `${gameId}.json`);
}

export function cacheFilePath(gameId: string): string {
  return path.join(DATA_DIR, `diff-${gameId}.json`);
}

export interface ComputeOptions {
  n?: number;
  seedBase?: number;
}

function captureEngineSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return null;
  }
}

function computeSummary(rounds: RoundDiff[]): GameDiff['summary'] {
  const pvpRoundCount = rounds.length;
  if (pvpRoundCount === 0) {
    return {
      pvpRoundCount: 0,
      winnerMatchRate: 0,
      weakSignalRoundCount: 0,
      avgPlayerDamageErrorPct: 0,
      avgSurvivorHpErrorPts: 0,
    };
  }
  const matched = rounds.filter(r => r.winner.matched).length;
  const weak = rounds.filter(r => r.winner.weakSignal).length;

  const allPlayerDmg = rounds.flatMap(r => r.playerDamage);
  const avgPlayerDamageErrorPct = allPlayerDmg.length > 0
    ? allPlayerDmg.reduce((a, b) => a + b.diffPct, 0) / allPlayerDmg.length
    : 0;

  const allSurvHp = rounds.flatMap(r => r.survivors ?? []).filter(s => !s.aliveMismatch);
  const avgSurvivorHpErrorPts = allSurvHp.length > 0
    ? allSurvHp.reduce((a, b) => a + b.hpDiffPoints, 0) / allSurvHp.length
    : 0;

  return {
    pvpRoundCount,
    winnerMatchRate: matched / pvpRoundCount,
    weakSignalRoundCount: weak,
    avgPlayerDamageErrorPct,
    avgSurvivorHpErrorPts,
  };
}

export async function computeGameDiff(gameId: string, opts: ComputeOptions = {}): Promise<GameDiff> {
  const n = opts.n ?? 10;
  const seedBase = opts.seedBase ?? 0;

  const filePath = gameFilePath(gameId);
  const raw = await fs.readFile(filePath, 'utf-8');
  const stat = await fs.stat(filePath);
  const parsed = ActualGameDataSchema.parse(JSON.parse(raw));

  const [champions, traits, augments, items] = await Promise.all([
    loadAllChampions(), loadAllTraits(), loadAllAugments(), loadAllItems(),
  ]);

  const pvpRounds = parsed.rounds.filter(r => r.type === 'pvp');
  const roundDiffs: RoundDiff[] = [];

  for (const round of pvpRounds) {
    const { input, warnings } = toNRunInput(round, { champions, traits, augments, items });
    const dist = runN(input, n, seedBase);
    roundDiffs.push(compareRound(round, dist, warnings));
  }

  return {
    gameId,
    computedAt: new Date().toISOString(),
    sourceGameMtime: Math.floor(stat.mtimeMs),
    engineSha: captureEngineSha(),
    nRuns: n,
    seedBase,
    rounds: roundDiffs,
    summary: computeSummary(roundDiffs),
  };
}

/**
 * Serialize GameDiff, converting Maps inside (none at the top level — RoundDiff doesn't hold Maps).
 * Distribution lives inside nRunSimulator and is not persisted.
 */
function serializeDiff(diff: GameDiff): string {
  return JSON.stringify(diff, null, 2);
}

export async function saveDiffCache(gameId: string, diff: GameDiff): Promise<void> {
  await fs.writeFile(cacheFilePath(gameId), serializeDiff(diff), 'utf-8');
}

export async function loadCachedDiff(gameId: string): Promise<{
  diff: GameDiff;
  stale: boolean;
  currentGameMtime: number;
} | null> {
  try {
    const cachedRaw = await fs.readFile(cacheFilePath(gameId), 'utf-8');
    const diff = JSON.parse(cachedRaw) as GameDiff;
    const stat = await fs.stat(gameFilePath(gameId));
    const currentGameMtime = Math.floor(stat.mtimeMs);
    return {
      diff,
      stale: diff.sourceGameMtime !== currentGameMtime,
      currentGameMtime,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') return null;
    throw err;
  }
}

export async function deleteDiffCache(gameId: string): Promise<void> {
  try {
    await fs.unlink(cacheFilePath(gameId));
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') return;
    throw err;
  }
}
```

- [ ] **Step 3: Run tests, verify PASS**

Run: `pnpm test tests/unit/validation/gameDiffer.test.ts --run`
Expected: all 4 tests PASS. The `computes GameDiff` test may take 30-60s at N=2. If it times out, raise the timeout in that test or reduce N.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/gameDiffer.ts tests/unit/validation/gameDiffer.test.ts
git commit -m "feat(validation): gameDiffer — 게임 단위 오케스트레이션 + 캐시 I/O + engineSha 캡처"
```

---

### Task 4.2: API route POST/GET/DELETE

**Files:**
- Create: `src/app/api/actual-data/[gameId]/compare/route.ts`

- [ ] **Step 1: Inspect existing API pattern**

Run: `rtk head -70 src/app/api/actual-data/\[gameId\]/route.ts`
Expected: confirms `runtime = 'nodejs'`, `Ctx = { params: Promise<{ gameId: string }> }` pattern used.

- [ ] **Step 2: Write route**

```typescript
// src/app/api/actual-data/[gameId]/compare/route.ts
import { NextResponse } from 'next/server';
import {
  computeGameDiff,
  loadCachedDiff,
  saveDiffCache,
  deleteDiffCache,
} from '@/lib/validation/gameDiffer';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;  // Vercel hint; local dev ignores

type Ctx = { params: Promise<{ gameId: string }> };

const PostBodySchema = z.object({
  n: z.number().int().positive().max(50).optional(),
  seedBase: z.number().int().optional(),
}).default({});

export async function POST(req: Request, { params }: Ctx) {
  const { gameId } = await params;

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'validation', message: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', message: 'n must be 1..50', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const diff = await computeGameDiff(gameId, {
      n: parsed.data.n ?? 10,
      seedBase: parsed.data.seedBase ?? 0,
    });
    await saveDiffCache(gameId, diff);
    return NextResponse.json({ diff });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') {
      return NextResponse.json({ error: 'not_found', message: `game ${gameId} not found` }, { status: 404 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation', message: 'game schema invalid', issues: err.issues },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    // log full stack server-side; return summary to client
    console.error('[compare POST] computeGameDiff failed:', err);
    return NextResponse.json({ error: 'compute_failed', message }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  try {
    const result = await loadCachedDiff(gameId);
    if (!result) {
      return NextResponse.json({ error: 'no_cache', message: 'POST to compute' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') {
      return NextResponse.json({ error: 'not_found', message: `game ${gameId} not found` }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[compare GET] failed:', err);
    return NextResponse.json({ error: 'read_failed', message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  await deleteDiffCache(gameId);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Verify route builds**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. If ESLint flags the `console.error` lines in a way that requires adjustment, scope them with eslint-disable-next-line or route through a shared logger — check existing `src/app/api/**/route.ts` for pattern and match.

- [ ] **Step 4: Manual smoke test (with dev server)**

```bash
# Background terminal: pnpm dev (already running)

# In another terminal
curl -sX POST http://localhost:3000/api/actual-data/game-20260424-001/compare \
  -H 'content-type: application/json' -d '{"n":2}' | head -c 500
curl -sX GET http://localhost:3000/api/actual-data/game-20260424-001/compare | head -c 500
curl -sX DELETE http://localhost:3000/api/actual-data/game-20260424-001/compare
```

Expected:
- POST: 200 with `{ "diff": { gameId: "...", rounds: [...] } }`
- GET: 200 with `{ "diff", "stale": false, "currentGameMtime": <number> }`
- DELETE: 204

- [ ] **Step 5: Commit**

```bash
git add src/app/api/actual-data/\[gameId\]/compare/route.ts
git commit -m "feat(validation): compare API (POST/GET/DELETE) + stale 판정"
```

---

### Task 4.3: Remove .DS_Store and untracked game file policy check

**Files:**
- No changes needed to code.

- [ ] **Step 1: Ensure diff cache files will be tracked (per spec)**

Run: `rtk git check-ignore actual-data/diff-game-20260424-001.json || echo "not ignored"`
Expected: prints `not ignored` (file will be trackable).

- [ ] **Step 2: Note .DS_Store in .gitignore if not already**

Run: `rtk grep -n "\.DS_Store" .gitignore`
Expected: already listed. If missing, add it in a separate unrelated commit (not in this feature's scope).

No commit for this task (verification only).

---

## Phase 5: Schema Extension + Input UX (4 tasks)

Adds the 3 new optional fields and the UI to populate them. Independent of Phases 1-4 (API works without these — they're just all-optional), so can run anytime.

### Task 5.1: Schema — add survivors, augmentStacks, ioniaPath

**Files:**
- Modify: `src/lib/actualData/schema.ts`
- Test: `tests/unit/actualData/schema.test.ts` (existing file — extend)

- [ ] **Step 1: Write new test cases**

Open `tests/unit/actualData/schema.test.ts`. Add at the end:

```typescript
import { TeamSnapshotSchema } from '@/lib/actualData/schema';

describe('TeamSnapshotSchema v1 diff extensions', () => {
  const base = {
    units: [], augments: [null, null, null, null], level: 1, hp: 100, hexModifiers: [],
  };

  it('accepts survivors array', () => {
    const res = TeamSnapshotSchema.safeParse({
      ...base,
      survivors: [{ hex: { q: 0, r: 0 }, championId: 'TFT17_Xayah', alive: true, hpPercent: 42 }],
    });
    expect(res.success).toBe(true);
  });

  it('rejects hpPercent > 100', () => {
    const res = TeamSnapshotSchema.safeParse({
      ...base,
      survivors: [{ hex: { q: 0, r: 0 }, championId: 'x', alive: true, hpPercent: 101 }],
    });
    expect(res.success).toBe(false);
  });

  it('accepts augmentStacks record', () => {
    const res = TeamSnapshotSchema.safeParse({
      ...base,
      augmentStacks: { 'TFT11_Augment_Slammin': 3 },
    });
    expect(res.success).toBe(true);
  });

  it('accepts ioniaPath blades', () => {
    const res = TeamSnapshotSchema.safeParse({ ...base, ioniaPath: 'blades' });
    expect(res.success).toBe(true);
  });

  it('rejects unknown ioniaPath value', () => {
    const res = TeamSnapshotSchema.safeParse({ ...base, ioniaPath: 'purity' });
    expect(res.success).toBe(false);
  });

  it('treats all 3 new fields as optional', () => {
    const res = TeamSnapshotSchema.safeParse(base);
    expect(res.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `pnpm test tests/unit/actualData/schema.test.ts --run`
Expected: FAIL on the new tests.

- [ ] **Step 3: Extend schema**

Open `src/lib/actualData/schema.ts`. Right after `PlacedUnitSchema` (~line 44), add:

```typescript
export const SurvivorSchema = z.object({
  hex: HexCoordSchema,
  championId: z.string(),
  alive: z.boolean(),
  hpPercent: z.number().min(0).max(100),
});
```

Then locate `TeamSnapshotSchema = z.object({ ... })` and add these optional fields inside (before the closing `})`):

```typescript
  survivors: z.array(SurvivorSchema).optional(),
  augmentStacks: z.record(z.string(), z.number().int().nonnegative()).optional(),
  ioniaPath: z.enum(['blades', 'enlightenment', 'transcendence', 'generosity', 'spirit']).optional(),
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/actualData/schema.test.ts --run`
Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actualData/schema.ts tests/unit/actualData/schema.test.ts
git commit -m "feat(actual-data,validation): survivors/augmentStacks/ioniaPath optional 필드 추가"
```

---

### Task 5.2: types.ts sync if needed

**Files:**
- Modify: `src/lib/actualData/types.ts`

- [ ] **Step 1: Check if types.ts derives from schema**

Run: `rtk head -80 src/lib/actualData/types.ts`
Expected: observe whether types are derived via `z.infer<typeof ...>` or hand-written.
- If derived via `z.infer`: no change needed — types flow through automatically.
- If hand-written: add matching properties to `TeamSnapshot` interface. Survivor, augmentStacks as `Record<string, number> | undefined`, ioniaPath as the same enum union.

- [ ] **Step 2: If edits needed, apply them; otherwise proceed**

(no code block — depends on Step 1 finding)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit if changes made**

```bash
# Only if types.ts was modified
git add src/lib/actualData/types.ts
git commit -m "chore(actual-data): TeamSnapshot 타입 schema 확장과 동기화"
```

---

### Task 5.3: Input UI — survivor input per unit

**Files:**
- Modify: `src/components/actual-data/ChampionItemSidebar.tsx` (likely host of unit inspector) — verify first
- OR Modify: `src/components/actual-data/PvPRoundEditor.tsx`

- [ ] **Step 1: Find where per-unit editing happens**

Run: `rtk grep -rn "selectedUnit\|selectedHex\|inspector" src/components/actual-data/ | head -10`
Expected: identifies the sidebar or inspector component. Record the file path.

- [ ] **Step 2: Add survivor input block**

Scope: add to the identified component. Block structure:

```tsx
// Inside the selected unit's detail section
{selectedUnit && (
  <div className="border border-gray-700 rounded p-2 mt-2 text-xs text-gray-100">
    <div className="font-semibold mb-1">라운드 종료 상태</div>
    <label className="block">
      <input
        type="radio"
        name={`alive-${selectedUnit.championId}`}
        checked={currentSurvivor?.alive ?? true}
        onChange={() => onSurvivorChange({ ...selectedHex, championId: selectedUnit.championId, alive: true, hpPercent: currentSurvivor?.hpPercent ?? 100 })}
      /> 생존
    </label>
    {(currentSurvivor?.alive ?? true) && (
      <label className="block pl-4">
        HP:
        <input
          type="number" min={0} max={100}
          value={currentSurvivor?.hpPercent ?? 100}
          onChange={e => onSurvivorChange({ ...selectedHex, championId: selectedUnit.championId, alive: true, hpPercent: Number(e.target.value) })}
          className="ml-1 w-14 bg-gray-800 border border-gray-600 rounded px-1"
        /> %
      </label>
    )}
    <label className="block">
      <input
        type="radio"
        name={`alive-${selectedUnit.championId}`}
        checked={currentSurvivor?.alive === false}
        onChange={() => onSurvivorChange({ ...selectedHex, championId: selectedUnit.championId, alive: false, hpPercent: 0 })}
      /> 사망
    </label>
  </div>
)}
```

Wire `currentSurvivor` and `onSurvivorChange` through the component's existing props or state. The data path:
- Read: find `survivor` in `round.playerTeam.survivors` or `round.opponent.survivors` matching `selectedHex`
- Write: update `survivors` array in the appropriate team snapshot, passed up via the existing round-change handler

- [ ] **Step 3: Manual smoke test**

Open `http://localhost:3000/actual-data/game-20260424-001`. Select a unit. Change alive/hp%. Verify the save bar indicates unsaved changes. Save. Reload page. Verify the survivor state persists.

- [ ] **Step 4: Commit**

```bash
git add src/components/actual-data/<file>.tsx
git commit -m "feat(actual-data): 유닛 라운드 종료 상태 입력 (생존/사망 + HP%)"
```

---

### Task 5.4: Input UI — ioniaPath + augmentStacks + arbiterLaw entry points

**Files:**
- Modify: `src/components/actual-data/TeamEditor.tsx` (or PvPRoundEditor if TeamEditor is sparse)
- Modify: `src/components/actual-data/PvPRoundEditor.tsx` (for augmentStacks beside augment slots)

- [ ] **Step 1: Add ioniaPath dropdown in team meta area**

In the identified team meta area, add:

```tsx
import { IONIA_PATH_NAMES, type IoniaPathType } from '@/data/traitModules';

<label className="block text-xs mt-2">
  아이오니아 길:
  <select
    className="ml-1 bg-gray-800 border border-gray-600 rounded px-1"
    value={team.ioniaPath ?? ''}
    onChange={e => onTeamChange({ ...team, ioniaPath: (e.target.value || undefined) as IoniaPathType | undefined })}
  >
    <option value="">(미선택)</option>
    {(Object.keys(IONIA_PATH_NAMES) as IoniaPathType[]).map(k => (
      <option key={k} value={k}>{IONIA_PATH_NAMES[k]}</option>
    ))}
  </select>
</label>
```

- [ ] **Step 2: Add augmentStacks input beside each augment slot (stackable only)**

In `PvPRoundEditor.tsx` (where augments render), find the augment slot render and add conditional input. Reuse `STACKABLE_AUGMENT_APINAMES` by exporting from `src/lib/validation/schemaAdapter.ts`:

```typescript
// in schemaAdapter.ts — export the set
export { STACKABLE_AUGMENT_APINAMES };
```

Then in the editor:
```tsx
{augApiName && STACKABLE_AUGMENT_APINAMES.has(augApiName) && (
  <label className="text-xs ml-1">
    스택:
    <input
      type="number" min={1} max={99}
      value={team.augmentStacks?.[augApiName] ?? 1}
      onChange={e => {
        const next = { ...(team.augmentStacks ?? {}), [augApiName]: Number(e.target.value) };
        onTeamChange({ ...team, augmentStacks: next });
      }}
      className="ml-1 w-12 bg-gray-800 border border-gray-600 rounded px-1"
    />
  </label>
)}
```

- [ ] **Step 3: arbiterLaw entry**

**No new field** — schema already has `arbiterLaw: { triggerId, effectId }`. Verify existing UI:

Run: `rtk grep -rn "arbiterLaw\|ArbiterLaw" src/components/actual-data/ | head -10`
Expected: either UI already exists (no work) or it doesn't (add a simple object-field dropdown reading `public/data/arbiter_laws.json`). If missing and the user requested it, add a minimal dropdown tied to `team.arbiterLaw.effectId`. If time-constrained, defer to a follow-up note; the warning path already handles missing values.

- [ ] **Step 4: Manual smoke test**

Reload edit page. Select iona path, adjust slammin stack, save, reload. Verify persistence.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/actual-data/TeamEditor.tsx src/components/actual-data/PvPRoundEditor.tsx src/lib/validation/schemaAdapter.ts
git commit -m "feat(actual-data): 아이오니아 길/증강 스택 입력 UI + STACKABLE 셋 export"
```

---

## Phase 6: useCompareDiff hook + Inline Summary Card (3 tasks)

### Task 6.1: useCompareDiff hook

**Files:**
- Create: `src/hooks/useCompareDiff.ts`

- [ ] **Step 1: Write hook**

```typescript
// src/hooks/useCompareDiff.ts
'use client';
import { useCallback, useState, useEffect } from 'react';
import type { GameDiff } from '@/types/validation';

export type DiffState =
  | { kind: 'initial' }
  | { kind: 'loading' }
  | { kind: 'missing' }                          // GET 404
  | { kind: 'ready'; diff: GameDiff; stale: boolean }
  | { kind: 'error'; message: string };

export function useCompareDiff(gameId: string) {
  const [state, setState] = useState<DiffState>({ kind: 'initial' });

  const fetchCache = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`/api/actual-data/${gameId}/compare`, { cache: 'no-store' });
      if (res.status === 404) {
        setState({ kind: 'missing' });
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        setState({ kind: 'error', message: text });
        return;
      }
      const data = await res.json() as { diff: GameDiff; stale: boolean };
      setState({ kind: 'ready', diff: data.diff, stale: data.stale });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [gameId]);

  const run = useCallback(async (n = 10) => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`/api/actual-data/${gameId}/compare`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ n }),
      });
      if (!res.ok) {
        const text = await res.text();
        setState({ kind: 'error', message: text });
        return;
      }
      const data = await res.json() as { diff: GameDiff };
      setState({ kind: 'ready', diff: data.diff, stale: false });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [gameId]);

  useEffect(() => { fetchCache(); }, [fetchCache]);

  return { state, run, refresh: fetchCache };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCompareDiff.ts
git commit -m "feat(validation): useCompareDiff 훅 — GET/POST 상태 관리"
```

---

### Task 6.2: RunCompareButton shared component

**Files:**
- Create: `src/components/validation/RunCompareButton.tsx`

- [ ] **Step 1: Write component**

```tsx
// src/components/validation/RunCompareButton.tsx
'use client';
import type { ReactNode } from 'react';

interface Props {
  onClick: () => void;
  loading: boolean;
  children: ReactNode;
}

export default function RunCompareButton({ onClick, loading, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white"
    >
      {loading ? '실행 중... (약 30초)' : children}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/validation/RunCompareButton.tsx
git commit -m "feat(validation): RunCompareButton 공통 컴포넌트"
```

---

### Task 6.3: RoundDiffInlineCard + mount in PvPRoundEditor

**Files:**
- Create: `src/components/validation/RoundDiffInlineCard.tsx`
- Modify: `src/components/actual-data/PvPRoundEditor.tsx`

- [ ] **Step 1: Write RoundDiffInlineCard**

```tsx
// src/components/validation/RoundDiffInlineCard.tsx
'use client';
import { useCompareDiff } from '@/hooks/useCompareDiff';
import RunCompareButton from './RunCompareButton';
import type { RoundDiff } from '@/types/validation';

interface Props {
  gameId: string;
  currentRoundName: string;
}

function RoundSummary({ round }: { round: RoundDiff }) {
  const winnerLine = round.winner.matched
    ? `actual=${round.winner.actual}, sim ${Math.round(round.winner.simPlayerWinRate * 100)}% ✅`
    : `actual=${round.winner.actual}, sim ${Math.round(round.winner.simPlayerWinRate * 100)}% ❌`;
  const dmgAvg = round.playerDamage.length === 0
    ? '— 데미지 기록 없음'
    : `평균 오차 ${((round.playerDamage.reduce((a, b) => a + b.diffPct, 0) / round.playerDamage.length) * 100).toFixed(0)}%`;
  const survLine = (() => {
    if (!round.survivors) return '— (데이터 없음)';
    const total = round.survivors.length;
    const matched = round.survivors.filter(s => !s.aliveMismatch).length;
    return `${matched}/${total} 일치`;
  })();
  return (
    <div className="space-y-1">
      <div><span className="text-gray-400">Winner:</span> {winnerLine}{round.winner.weakSignal && ' ⚠️ 엣지케이스'}</div>
      <div><span className="text-gray-400">내 딜량:</span> {dmgAvg}</div>
      <div><span className="text-gray-400">상대 딜량:</span> {round.opponentDamage ? `오차 평균 ${((round.opponentDamage.reduce((a, b) => a + b.diffPct, 0) / round.opponentDamage.length) * 100).toFixed(0)}%` : '— (데이터 없음)'}</div>
      <div><span className="text-gray-400">생존:</span> {survLine}</div>
      {round.warnings.length > 0 && (
        <div className="text-yellow-400">⚠️ {round.warnings.join(' · ')}</div>
      )}
    </div>
  );
}

export default function RoundDiffInlineCard({ gameId, currentRoundName }: Props) {
  const { state, run } = useCompareDiff(gameId);

  return (
    <div className="border border-gray-700 rounded p-3 mt-3 bg-gray-900/50 text-xs text-gray-200">
      <div className="font-semibold text-sm mb-2">🧪 시뮬 비교</div>
      {state.kind === 'initial' || state.kind === 'loading' ? (
        <div className="text-gray-400">{state.kind === 'loading' ? '로딩 중...' : ''}</div>
      ) : state.kind === 'missing' ? (
        <div className="space-y-2">
          <div>이 게임은 아직 시뮬 비교를 돌리지 않았습니다.</div>
          <RunCompareButton onClick={() => run()} loading={false}>▶ 비교 실행 (예상 ~30초)</RunCompareButton>
          <a className="ml-2 text-blue-400 underline" href={`/actual-data/${gameId}/compare`}>전체 보기 →</a>
        </div>
      ) : state.kind === 'error' ? (
        <div className="text-red-400">에러: {state.message}</div>
      ) : (
        <>
          {state.stale && (
            <div className="text-yellow-400 mb-2">
              ⚠️ 데이터 변경됨 — <button type="button" onClick={() => run()} className="underline">▶ 다시 실행</button>
            </div>
          )}
          {(() => {
            const round = state.diff.rounds.find(r => r.roundName === currentRoundName);
            return round
              ? <RoundSummary round={round} />
              : <div className="text-gray-400">이 라운드는 캐시에 포함되지 않았습니다 — 재실행 필요</div>;
          })()}
          <div className="mt-2">
            <a className="text-blue-400 underline" href={`/actual-data/${gameId}/compare`}>전체 보기 →</a>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount in PvPRoundEditor**

Open `src/components/actual-data/PvPRoundEditor.tsx`. At the component render bottom (below the existing damage chart sections), add:

```tsx
import RoundDiffInlineCard from '@/components/validation/RoundDiffInlineCard';

// ...at render bottom
<RoundDiffInlineCard gameId={gameId} currentRoundName={round.roundName} />
```

If `gameId` isn't currently a prop, thread it through from the parent page — check parent component with `rtk grep -n "PvPRoundEditor" src/components/actual-data/ActualDataEditor.tsx` and add the prop.

- [ ] **Step 3: Manual smoke test**

Open the edit page. Open dev tools → Network. Confirm a single `GET /api/actual-data/.../compare` fires on mount (returns 404 first time). Click "▶ 비교 실행" and confirm POST runs and the card flips to ready state.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. If React Compiler flags `useEffect(() => { fetchCache() }, [fetchCache])` in `useCompareDiff`, adjust per CLAUDE.md rules — convert to derived value or refactor. Most likely safe since fetchCache is stable.

- [ ] **Step 5: Commit**

```bash
git add src/components/validation/RoundDiffInlineCard.tsx src/components/actual-data/PvPRoundEditor.tsx
git commit -m "feat(validation): 편집 페이지 인라인 요약 카드 (상태 A/B/C)"
```

---

## Phase 7: Compare Page (4 tasks)

### Task 7.1: GameDiffSummaryCard

**Files:**
- Create: `src/components/validation/GameDiffSummaryCard.tsx`

- [ ] **Step 1: Write**

```tsx
// src/components/validation/GameDiffSummaryCard.tsx
'use client';
import type { GameDiff } from '@/types/validation';
import RunCompareButton from './RunCompareButton';

interface Props {
  diff: GameDiff;
  stale: boolean;
  onRerun: () => void;
  loading: boolean;
}

export default function GameDiffSummaryCard({ diff, stale, onRerun, loading }: Props) {
  const { summary } = diff;
  const nonWeak = summary.pvpRoundCount - summary.weakSignalRoundCount;
  const matchedNonWeak = diff.rounds.filter(r => !r.winner.weakSignal && r.winner.matched).length;
  return (
    <div className="border border-gray-700 rounded p-4 bg-gray-900/50 text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">요약</h2>
        <RunCompareButton onClick={onRerun} loading={loading}>🔄 다시 실행</RunCompareButton>
      </div>
      {stale && <div className="text-yellow-400 mb-2 text-sm">⚠️ 게임이 수정된 후입니다 — 재실행 권장</div>}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-400">Winner 적중률</dt>
        <dd>{Math.round(summary.winnerMatchRate * 100)}% ({diff.rounds.filter(r => r.winner.matched).length}/{summary.pvpRoundCount})</dd>
        <dt className="text-gray-400">엣지케이스 제외</dt>
        <dd>{nonWeak === 0 ? '—' : `${Math.round((matchedNonWeak / nonWeak) * 100)}% (${matchedNonWeak}/${nonWeak})`}</dd>
        <dt className="text-gray-400">내 딜량 평균 오차</dt>
        <dd>{(summary.avgPlayerDamageErrorPct * 100).toFixed(1)}%</dd>
        <dt className="text-gray-400">Survivor HP 평균 오차</dt>
        <dd>{summary.avgSurvivorHpErrorPts.toFixed(1)} pt</dd>
        <dt className="text-gray-400">N / seedBase</dt>
        <dd>{diff.nRuns} / {diff.seedBase}</dd>
        <dt className="text-gray-400">Engine SHA</dt>
        <dd className="font-mono text-xs">{diff.engineSha?.slice(0, 7) ?? '—'}</dd>
        <dt className="text-gray-400">실행 시각</dt>
        <dd className="text-xs">{new Date(diff.computedAt).toLocaleString('ko-KR')}</dd>
      </dl>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/validation/GameDiffSummaryCard.tsx
git commit -m "feat(validation): GameDiffSummaryCard — compare 페이지 요약"
```

---

### Task 7.2: RoundDiffTable

**Files:**
- Create: `src/components/validation/RoundDiffTable.tsx`

- [ ] **Step 1: Write**

```tsx
// src/components/validation/RoundDiffTable.tsx
'use client';
import type { RoundDiff } from '@/types/validation';

interface Props {
  rounds: RoundDiff[];
  selectedRoundName: string | null;
  onSelect: (roundName: string) => void;
}

function avgDamagePct(round: RoundDiff): number {
  if (round.playerDamage.length === 0) return 0;
  return round.playerDamage.reduce((a, b) => a + b.diffPct, 0) / round.playerDamage.length;
}

function survSummary(round: RoundDiff): string {
  if (!round.survivors) return '—';
  const mismatches = round.survivors.filter(s => s.aliveMismatch).length;
  return mismatches === 0 ? '✅ all' : `❌ ${mismatches}/${round.survivors.length}`;
}

export default function RoundDiffTable({ rounds, selectedRoundName, onSelect }: Props) {
  return (
    <table className="w-full text-sm text-gray-100">
      <thead className="text-gray-400 text-xs">
        <tr>
          <th className="text-left py-1">라운드</th>
          <th className="text-left py-1">actual</th>
          <th className="text-right py-1">sim winrate</th>
          <th className="text-center py-1">일치</th>
          <th className="text-right py-1">내 딜 오차</th>
          <th className="text-center py-1">생존 오차</th>
        </tr>
      </thead>
      <tbody>
        {rounds.map(r => {
          const isSelected = r.roundName === selectedRoundName;
          return (
            <tr
              key={r.roundName}
              className={`cursor-pointer hover:bg-gray-800 ${isSelected ? 'bg-gray-800' : ''}`}
              onClick={() => onSelect(r.roundName)}
            >
              <td className="py-1">{r.roundName}</td>
              <td className="py-1">{r.winner.actual}</td>
              <td className="py-1 text-right">{Math.round(r.winner.simPlayerWinRate * 100)}%{r.winner.weakSignal && ' ⚠️'}</td>
              <td className="py-1 text-center">{r.winner.matched ? '✅' : '❌'}</td>
              <td className="py-1 text-right">{(avgDamagePct(r) * 100).toFixed(0)}%</td>
              <td className="py-1 text-center">{survSummary(r)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/validation/RoundDiffTable.tsx
git commit -m "feat(validation): RoundDiffTable — 라운드별 요약 테이블 + 선택 콜백"
```

---

### Task 7.3: RoundDiffDetailPanel

**Files:**
- Create: `src/components/validation/RoundDiffDetailPanel.tsx`

- [ ] **Step 1: Write**

```tsx
// src/components/validation/RoundDiffDetailPanel.tsx
'use client';
import type { RoundDiff } from '@/types/validation';

interface Props {
  round: RoundDiff;
}

export default function RoundDiffDetailPanel({ round }: Props) {
  return (
    <div className="border border-gray-700 rounded p-4 bg-gray-900/50 text-gray-100 text-sm space-y-3">
      <div className="font-semibold">라운드 {round.roundName} 상세</div>

      <div>
        <span className="text-gray-400">Winner:</span> actual={round.winner.actual}, sim player승 {Math.round(round.winner.simPlayerWinRate * 100)}%{round.winner.weakSignal && ' (엣지케이스)'} {round.winner.matched ? '✅' : '❌'}
      </div>

      {round.playerDamage.length > 0 && (
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-1">내 팀 딜량</div>
          <table className="w-full text-xs">
            <thead className="text-gray-500"><tr><th className="text-left">Champ</th><th className="text-right">actual</th><th className="text-right">sim mean (range)</th><th className="text-right">diff</th></tr></thead>
            <tbody>
              {round.playerDamage.map((d, i) => (
                <tr key={i}>
                  <td>{d.championId.replace(/^TFT\d+_/, '')} ({d.hex.q},{d.hex.r})</td>
                  <td className="text-right">{Math.round(d.actual)}</td>
                  <td className="text-right">{Math.round(d.simMean)} ({Math.round(d.simRange[0])}-{Math.round(d.simRange[1])})</td>
                  <td className={`text-right ${d.diffPct < -0.1 ? 'text-red-400' : d.diffPct > 0.1 ? 'text-green-400' : ''}`}>{(d.diffPct * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {round.opponentDamage && round.opponentDamage.length > 0 && (
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-1">상대 팀 딜량</div>
          <table className="w-full text-xs">
            <thead className="text-gray-500"><tr><th className="text-left">Champ</th><th className="text-right">actual</th><th className="text-right">sim mean</th><th className="text-right">diff</th></tr></thead>
            <tbody>
              {round.opponentDamage.map((d, i) => (
                <tr key={i}>
                  <td>{d.championId.replace(/^TFT\d+_/, '')} ({d.hex.q},{d.hex.r})</td>
                  <td className="text-right">{Math.round(d.actual)}</td>
                  <td className="text-right">{Math.round(d.simMean)}</td>
                  <td className="text-right">{(d.diffPct * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {round.survivors && round.survivors.length > 0 && (
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-1">생존 상태</div>
          <table className="w-full text-xs">
            <thead className="text-gray-500"><tr><th className="text-left">Team/Champ</th><th className="text-right">actual</th><th className="text-right">sim</th><th className="text-right">HP diff</th></tr></thead>
            <tbody>
              {round.survivors.map((s, i) => (
                <tr key={i}>
                  <td>[{s.team === 'player' ? '내' : '상대'}] {s.championId.replace(/^TFT\d+_/, '')}</td>
                  <td className="text-right">{s.actualAlive ? `HP ${s.actualHp}%` : '사망'}</td>
                  <td className="text-right">{(s.simAliveRate * 100).toFixed(0)}% alive, HP {s.simMeanHp.toFixed(0)}%</td>
                  <td className={`text-right ${Math.abs(s.hpDiffPoints) > 20 ? 'text-red-400' : ''}`}>{s.aliveMismatch ? '❌ alive mismatch' : `${s.hpDiffPoints > 0 ? '+' : ''}${s.hpDiffPoints.toFixed(0)} pt`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {round.warnings.length > 0 && (
        <div className="text-yellow-400">
          <div className="font-semibold text-xs mb-1">⚠️ 경고</div>
          <ul className="text-xs list-disc list-inside">
            {round.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/validation/RoundDiffDetailPanel.tsx
git commit -m "feat(validation): RoundDiffDetailPanel — 라운드 상세 (딜/생존/경고)"
```

---

### Task 7.4: Compare page assembly

**Files:**
- Create: `src/app/actual-data/[gameId]/compare/page.tsx`

- [ ] **Step 1: Write page**

```tsx
// src/app/actual-data/[gameId]/compare/page.tsx
'use client';
import { useState, use } from 'react';
import Link from 'next/link';
import { useCompareDiff } from '@/hooks/useCompareDiff';
import GameDiffSummaryCard from '@/components/validation/GameDiffSummaryCard';
import RoundDiffTable from '@/components/validation/RoundDiffTable';
import RoundDiffDetailPanel from '@/components/validation/RoundDiffDetailPanel';
import RunCompareButton from '@/components/validation/RunCompareButton';

export default function ComparePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { state, run } = useCompareDiff(gameId);
  const [selectedRoundName, setSelectedRoundName] = useState<string | null>(null);

  const selectedRound = state.kind === 'ready'
    ? state.diff.rounds.find(r => r.roundName === selectedRoundName) ?? state.diff.rounds[0] ?? null
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto text-gray-100">
      <div className="flex items-center mb-4">
        <Link href={`/actual-data/${gameId}`} className="text-blue-400 underline text-sm">← 편집으로 돌아가기</Link>
        <div className="ml-4 text-sm text-gray-400">Game: {gameId}</div>
      </div>

      {state.kind === 'initial' || state.kind === 'loading' ? (
        <div className="text-gray-400">로딩 중...</div>
      ) : state.kind === 'missing' ? (
        <div className="border border-gray-700 rounded p-6 bg-gray-900/50 text-center">
          <p className="mb-3">이 게임은 아직 시뮬 비교를 돌리지 않았습니다.</p>
          <RunCompareButton onClick={() => run()} loading={false}>▶ 비교 실행 (예상 ~30초)</RunCompareButton>
        </div>
      ) : state.kind === 'error' ? (
        <div className="text-red-400">에러: {state.message}</div>
      ) : (
        <div className="space-y-4">
          <GameDiffSummaryCard
            diff={state.diff}
            stale={state.stale}
            onRerun={() => run()}
            loading={false}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-gray-700 rounded p-4 bg-gray-900/50">
              <RoundDiffTable
                rounds={state.diff.rounds}
                selectedRoundName={selectedRound?.roundName ?? null}
                onSelect={setSelectedRoundName}
              />
            </div>
            {selectedRound && <RoundDiffDetailPanel round={selectedRound} />}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Navigate to `http://localhost:3000/actual-data/game-20260424-001/compare`. Verify:
- First load: shows "missing" with run button
- After run: shows summary + table
- Clicking rows updates detail panel
- Navigation back works

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/actual-data/\[gameId\]/compare/page.tsx
git commit -m "feat(validation): /actual-data/[gameId]/compare 페이지 (요약+테이블+상세)"
```

---

## Phase 8: Integration + QA (3 tasks)

### Task 8.1: Full lint + typecheck + build

- [ ] **Step 1: Run all three**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: all PASS. Fix any issues immediately (ESLint rule violations per CLAUDE.md — especially React Compiler rules). Do NOT suppress with `eslint-disable`.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test --run`
Expected: all tests PASS. If golden tests drift due to changes, investigate — they should not unless touching engine, which this feature doesn't.

- [ ] **Step 3: Commit any fixes**

```bash
git add -p  # review each fix
git commit -m "fix(validation): lint/typecheck adjustments post-integration"
```

(Skip this commit if nothing needed fixing.)

---

### Task 8.2: Run compare on both existing games + git diff inspection

- [ ] **Step 1: Start dev server if not already**

Run: `pnpm dev &` (or use existing background)

- [ ] **Step 2: Run compare for both games**

```bash
curl -sX POST http://localhost:3000/api/actual-data/game-20260423-001/compare \
  -H 'content-type: application/json' -d '{"n":10}' -o /tmp/diff-0423.json
curl -sX POST http://localhost:3000/api/actual-data/game-20260424-001/compare \
  -H 'content-type: application/json' -d '{"n":10}' -o /tmp/diff-0424.json

ls -la actual-data/diff-*.json
```

Expected: 2 files present, each ~dozens of KB.

- [ ] **Step 3: Sanity check a summary**

```bash
rtk jq '.diff.summary' /tmp/diff-0424.json
```
Expected: prints a summary object with sane numeric fields.

- [ ] **Step 4: Commit cache files**

```bash
git add actual-data/diff-*.json
git commit -m "data(validation): 초기 diff 캐시 2판 (game-20260423-001, game-20260424-001)"
```

---

### Task 8.3: Manual QA checklist + final commit

- [ ] **Step 1: Run through QA checklist**

In a browser:
- [ ] Open `/actual-data` — list loads without error
- [ ] Open each game — edit page renders RoundDiffInlineCard in state B
- [ ] Navigate rounds — card updates per round
- [ ] Modify a round and save — card flips to state C (stale)
- [ ] Click "다시 실행" on stale state — recomputes, card returns to B
- [ ] Open `/compare` page — summary + table renders
- [ ] Click a row — detail panel updates
- [ ] Check a round with weak signal (playerWinRate near 50%) — ⚠️ shown
- [ ] Check a round with warnings (e.g., 미션 오토) — warnings list visible
- [ ] Input survivors for a round → save → rerun → detail shows Surv diff rows
- [ ] Select ioniaPath for a ionia-deck round → rerun → warning for that round disappears

- [ ] **Step 2: Create QA summary note (optional)**

```bash
# Only if something surprising came up during QA
cat > /tmp/qa-notes.md <<'EOF'
[raw QA notes from manual testing]
EOF
```

- [ ] **Step 3: Final clean-up commit if needed**

If any tiny issues appeared and were fixed:
```bash
git add -p
git commit -m "fix(validation): QA patches — [specific issue]"
```

If nothing else to commit, just verify history:
```bash
rtk git log --oneline dev ^main | head -30
```

---

## Completion Checklist

- [ ] All tasks 0.0 through 8.3 have been checked off
- [ ] `pnpm lint && pnpm typecheck && pnpm build` all PASS
- [ ] `pnpm test --run` PASS
- [ ] 2 diff cache files tracked in git (`actual-data/diff-game-*.json`)
- [ ] No `eslint-disable` added (per CLAUDE.md)
- [ ] No `console.log` in committed code (per CLAUDE.md; benchmarks use `console.log` intentionally but those are in `tests/calibration/`)
