# 별돌보미 별자리 선택 + 강화 칸 표시 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시뮬레이터 전투 화면에서 별돌보미 시너지 활성 시 별자리 dropdown 으로 선택 + 보드 위 강화 칸 보라색 테두리 표시 (양 팀 독립). 부수: `resolveTraits` 동일 챔프 dedupe 버그 수정.

**Architecture:**
- `SimulateOptions.stargazerConstellation` (단일) → `playerStargazerConstellation` / `enemyStargazerConstellation` (분리)
- `useTeamManagement` 에 팀별 별자리 state 추가
- `SynergyPanel` 안에 별돌보미 행 아래 dropdown (Ionia path 패턴 차용)
- `SetupBoardCore` / `ReplayBoard` 에 `playerStargazerTiles` / `enemyStargazerTiles` prop 추가 + 보라색 stroke
- `resolveTraits` 에 `apiName + mfMode` 키로 dedupe 추가

**Tech Stack:** TypeScript, Next.js 15 App Router, React 19 (Compiler 활성), Zustand, TailwindCSS, Vitest

**Spec:** `docs/superpowers/specs/2026-04-27-stargazer-tile-overlay-design.md`

---

## 4-게이트 (각 phase 종료 시 필수)

```bash
pnpm lint && pnpm typecheck && pnpm test --run && pnpm build
```

모두 통과해야 다음 phase 진행. 셋 중 하나라도 실패 시 commit 금지 (CLAUDE.md 규칙).

---

## Phase 1 — SimulateOptions 분리

### Task 1.1: `applyStargazerEffects` 시그니처 직접 타입화

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:653`

현재 함수는 `SimulateOptions['stargazerConstellation']` 으로 타입 의존. SimulateOptions 필드 분리 시 컴파일 에러 방지를 위해 직접 타입으로 분리.

- [ ] **Step 1.1.1: import 추가 (이미 있는지 확인)**

`combatLoop.ts` 상단에 `import type { StargazerConstellationId } from '@/lib/actualData/types';` 가 이미 있음 (`grep -n StargazerConstellationId src/lib/simulator/engine/combatLoop.ts` 로 확인). 없으면 추가.

- [ ] **Step 1.1.2: 함수 시그니처 변경**

`combatLoop.ts:653` 부근 `applyStargazerEffects` 함수 정의의 3번째 매개변수 타입을:
```ts
constellation: SimulateOptions['stargazerConstellation'],
```
→
```ts
constellation: StargazerConstellationId | undefined,
```
로 변경.

- [ ] **Step 1.1.3: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 통과 (이 단계는 타입만 명시화, 동작 변화 없음).

### Task 1.2: SimulateOptions 필드 분리

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts` (SimulateOptions interface, resolveTraits 호출, applyStargazerEffects 호출)

- [ ] **Step 1.2.1: SimulateOptions 필드 교체**

`combatLoop.ts:104` 부근의 기존 단일 필드:
```ts
stargazerConstellation?: 'altar' | 'boar' | 'huntress' | 'medal' | 'mountain' | 'snake' | 'well';
```
를 두 필드로 분리:
```ts
/**
 * A 팀(player) 별자리. 미지정 시 base trait 활성, 변종 effect 미적용.
 * 게임 룰 상 한 게임 1 별자리지만 시뮬에서는 분석 편의로 팀별 독립.
 */
playerStargazerConstellation?: StargazerConstellationId;
/** B 팀(enemy) 별자리. 의미는 player 와 동일. */
enemyStargazerConstellation?: StargazerConstellationId;
```

JSDoc 코멘트는 위와 같이 그대로 유지.

- [ ] **Step 1.2.2: resolveTraits 호출 변경**

`combatLoop.ts:1515-1520` 부근:
```ts
const playerActiveTraits = resolveTraits(allyTeam, allTraits, {
  stargazerConstellation: options.stargazerConstellation,
});
const enemyActiveTraits = resolveTraits(enemyTeam, allTraits, {
  stargazerConstellation: options.stargazerConstellation,
});
```
→
```ts
const playerActiveTraits = resolveTraits(allyTeam, allTraits, {
  stargazerConstellation: options.playerStargazerConstellation,
});
const enemyActiveTraits = resolveTraits(enemyTeam, allTraits, {
  stargazerConstellation: options.enemyStargazerConstellation,
});
```

- [ ] **Step 1.2.3: applyStargazerEffects 호출 변경**

`combatLoop.ts:1624-1625`:
```ts
applyStargazerEffects(playerActiveTraits, playerUnits, options.stargazerConstellation);
applyStargazerEffects(enemyActiveTraits, enemies, options.stargazerConstellation);
```
→
```ts
applyStargazerEffects(playerActiveTraits, playerUnits, options.playerStargazerConstellation);
applyStargazerEffects(enemyActiveTraits, enemies, options.enemyStargazerConstellation);
```

- [ ] **Step 1.2.4: typecheck 실행 — 호출처 에러 모두 수집**

```bash
pnpm typecheck 2>&1 | grep -E "stargazerConstellation|error TS"
```

Expected: schemaAdapter, gameDiffer, 4개 테스트 파일에서 error.

### Task 1.3: schemaAdapter 어댑터 — 양 팀 동일 전달

**Files:**
- Modify: `src/lib/validation/schemaAdapter.ts` (line 55, 195)

- [ ] **Step 1.3.1: schemaAdapter Options 타입 갱신 확인**

`grep -n "stargazerConstellation" src/lib/validation/schemaAdapter.ts` 로 위치 확인. line 55 근처 type def 는 game-level 입력 필드이므로 그대로 유지 (단일 입력은 actual-data 모델과 일치).

- [ ] **Step 1.3.2: simulate 호출 인자 분기**

`schemaAdapter.ts:195` 부근:
```ts
stargazerConstellation: options.stargazerConstellation,
```
→
```ts
playerStargazerConstellation: options.stargazerConstellation,
enemyStargazerConstellation: options.stargazerConstellation,
```

JSDoc 한 줄 추가:
```ts
// game-level 단일 별자리 → 양 팀에 동일 전달 (실제 게임은 양 팀 동일 별자리).
```

- [ ] **Step 1.3.3: typecheck 통과 확인**

```bash
pnpm typecheck 2>&1 | grep "schemaAdapter"
```
Expected: 더 이상 schemaAdapter 에러 없음.

### Task 1.4: gameDiffer 어댑터 — 양 팀 동일 전달

**Files:**
- Modify: `src/lib/validation/gameDiffer.ts:88-92`

- [ ] **Step 1.4.1: 호출 인자 분기**

`gameDiffer.ts:88-92` 부근:
```ts
// stargazerConstellation 은 game-level — 모든 라운드 공통으로 전달.
... {
  stargazerConstellation: parsed.stargazerConstellation,
}
```
→
```ts
// stargazerConstellation 은 game-level — 양 팀 동일 별자리로 전달 (실제 게임 룰).
... {
  playerStargazerConstellation: parsed.stargazerConstellation,
  enemyStargazerConstellation: parsed.stargazerConstellation,
}
```

- [ ] **Step 1.4.2: typecheck 통과 확인**

```bash
pnpm typecheck 2>&1 | grep "gameDiffer"
```
Expected: 더 이상 gameDiffer 에러 없음.

### Task 1.5: 테스트 파일 호출 인자 갱신

**Files:**
- Modify: `tests/unit/simulator/stargazer-mountain-effects.test.ts:48,88`
- Modify: `tests/unit/simulator/stargazer-variants-effects.test.ts:50,149`
- Modify: `tests/calibration/stargazer-mountain-applied.test.ts:28`

`tests/unit/simulator/stargazer-trait.test.ts` 는 `resolveTraits` 직접 호출 (단일 팀) 이라 변경 불필요 — 기존 `stargazerConstellation` 키 그대로.

- [ ] **Step 1.5.1: 각 테스트 파일에서 simulateCombat options 키 변경**

각 파일의 `simulateCombat(...)` 또는 동등한 호출 옵션 객체에서:
```ts
stargazerConstellation: 'mountain',
```
→
```ts
playerStargazerConstellation: 'mountain',
enemyStargazerConstellation: 'mountain',
```

- [ ] **Step 1.5.2: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 모든 에러 해소.

- [ ] **Step 1.5.3: 테스트 실행**

```bash
pnpm test --run tests/unit/simulator/stargazer-mountain-effects.test.ts tests/unit/simulator/stargazer-variants-effects.test.ts tests/calibration/stargazer-mountain-applied.test.ts tests/unit/simulator/stargazer-trait.test.ts
```
Expected: 모든 테스트 통과.

### Task 1.6: useTeamManagement state 추가

**Files:**
- Modify: `src/hooks/useTeamManagement.ts`

- [ ] **Step 1.6.1: import 추가**

파일 상단:
```ts
import type { StargazerConstellationId } from '@/lib/actualData/types';
```

- [ ] **Step 1.6.2: state 2개 추가**

기존 `playerArbiterLaw` / `enemyArbiterLaw` state 정의 부근(line 289-290):
```ts
const [playerArbiterLaw, setPlayerArbiterLaw] = useState<ArbiterLaw | null>(null);
const [enemyArbiterLaw, setEnemyArbiterLaw] = useState<ArbiterLaw | null>(null);
```
바로 아래에 추가:
```ts
// 별돌보미 별자리 — 게임 룰은 단일이지만 시뮬은 분석 편의로 팀별 독립.
const [playerStargazerConstellation, setPlayerStargazerConstellation] = useState<StargazerConstellationId | null>(null);
const [enemyStargazerConstellation, setEnemyStargazerConstellation] = useState<StargazerConstellationId | null>(null);
```

- [ ] **Step 1.6.3: 훅 반환 객체에 4개 항목 추가**

훅 끝 `return { ... }` 부분에 추가 (기존 `playerArbiterLaw`, `setPlayerArbiterLaw` 등의 위치 근처):
```ts
playerStargazerConstellation,
setPlayerStargazerConstellation,
enemyStargazerConstellation,
setEnemyStargazerConstellation,
```

- [ ] **Step 1.6.4: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 통과.

### Task 1.7: simulator/page.tsx 호출 인자 갱신

**Files:**
- Modify: `src/app/simulator/page.tsx:166-241` (runSimulation, runMultiple)

- [ ] **Step 1.7.1: runSimulation 호출 인자 추가**

`simulateCombat(mappedPlayer, tm.enemyTeam, { ... })` 옵션 객체에 추가:
```ts
playerStargazerConstellation: tm.playerStargazerConstellation ?? undefined,
enemyStargazerConstellation: tm.enemyStargazerConstellation ?? undefined,
```

옵션 객체의 dependency array (`useCallback` 의 deps) 에 추가:
```ts
tm.playerStargazerConstellation, tm.enemyStargazerConstellation,
```

- [ ] **Step 1.7.2: runMultiple 호출 인자 추가**

`runMultiple` 의 simulateCombat 호출에도 동일하게 추가. dep array 에도 추가.

- [ ] **Step 1.7.3: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 통과.

### Task 1.8: Phase 1 4-게이트 + commit

- [ ] **Step 1.8.1: 4-게이트 실행**

```bash
pnpm lint && pnpm typecheck && pnpm test --run && pnpm build
```
Expected: 모두 통과. 실패 시 직전 단계 점검.

- [ ] **Step 1.8.2: 변경 파일 git status 확인**

```bash
git status -sb
```
Expected: 다음 파일 수정 표시:
- `src/lib/simulator/engine/combatLoop.ts`
- `src/lib/validation/schemaAdapter.ts`
- `src/lib/validation/gameDiffer.ts`
- `src/hooks/useTeamManagement.ts`
- `src/app/simulator/page.tsx`
- `tests/unit/simulator/stargazer-mountain-effects.test.ts`
- `tests/unit/simulator/stargazer-variants-effects.test.ts`
- `tests/calibration/stargazer-mountain-applied.test.ts`

- [ ] **Step 1.8.3: commit**

```bash
git add src tests
git commit -m "$(cat <<'EOF'
feat(simulator): SimulateOptions 별자리 필드 팀별 분리 + useTeamManagement state

- stargazerConstellation 단일 → playerStargazerConstellation / enemyStargazerConstellation
- schemaAdapter, gameDiffer: game-level 단일 → 양 팀 동일 전달
- useTeamManagement: 팀별 별자리 state 추가
- simulator/page.tsx: runSimulation/runMultiple 에 팀별 별자리 전달

UI 는 다음 phase. 본 phase 는 데이터 모델 분리만.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Trait dedupe 버그 수정

### Task 2.1: dedupe 회귀 가드 테스트 작성 (RED)

**Files:**
- Create: `tests/unit/simulator/trait-dedupe.test.ts`

- [ ] **Step 2.1.1: 테스트 파일 작성**

```ts
import { describe, it, expect } from 'vitest';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();

function findChamp(api: string): RawChampion {
  const c = champions.find((x) => x.apiName === api);
  if (!c) throw new Error(`champion ${api} missing`);
  return c;
}

function findItem(api: string): RawItem {
  const it = items.find((x) => x.apiName === api);
  if (!it) throw new Error(`item ${api} missing`);
  return it;
}

const STARGAZER_EMBLEM = 'TFT17_Item_StargazerEmblemItem';

describe('resolveTraits — 동일 챔프 dedupe', () => {
  it('룰루 3마리 → 별돌보미 1, 복제자 1 (intrinsic trait dedupe)', () => {
    const team = [
      { champion: findChamp('TFT17_Lulu') },
      { champion: findChamp('TFT17_Lulu') },
      { champion: findChamp('TFT17_Lulu') },
    ];
    const active = resolveTraits(team, traits);
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    const replicator = active.find((t) => t.trait.name === '복제자');
    expect(stargazer?.count).toBe(1);
    expect(replicator?.count).toBe(1);
  });

  it('룰루 1 + TwistedFate 1 → 별돌보미 2 (별개 챔프 각자 카운트)', () => {
    const team = [
      { champion: findChamp('TFT17_Lulu') },
      { champion: findChamp('TFT17_TwistedFate') },
    ];
    const active = resolveTraits(team, traits);
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer?.count).toBe(2);
  });

  it('별돌보미 3마리 + 별돌보미 아닌 챔프에 별돌보미 emblem 1개 → 별돌보미 4 (emblem unit-bound)', () => {
    const team = [
      { champion: findChamp('TFT17_TwistedFate') },
      { champion: findChamp('TFT17_Talon') },
      { champion: findChamp('TFT17_Jax') },
      { champion: findChamp('TFT17_Aatrox'), items: [findItem(STARGAZER_EMBLEM)] },
    ];
    const active = resolveTraits(team, traits);
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer?.count).toBe(4);
  });

  it('MF 2마리 (다른 모드) → 각 모드 trait 별개 카운트', () => {
    const mfChamp = findChamp('TFT17_MissFortune');
    const team = [
      { champion: mfChamp, mfMode: 'challenger' as const },  // → 도전자
      { champion: mfChamp, mfMode: 'replicator' as const },  // → 복제자
    ];
    const active = resolveTraits(team, traits);
    // challenger 모드 → 도전자 trait, replicator 모드 → 복제자 trait (각 1 카운트)
    // MF 자체 traits 의 "특성 선택" 은 mfMode 별 trait 으로 치환됨
    const challenger = active.find((t) => t.trait.name === '도전자');
    const replicator = active.find((t) => t.trait.name === '복제자');
    expect(challenger?.count).toBeGreaterThanOrEqual(1);
    expect(replicator?.count).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2.1.2: 테스트 실행 (RED 단계)**

```bash
pnpm test --run tests/unit/simulator/trait-dedupe.test.ts
```
Expected: 첫 번째 테스트(룰루 3마리) FAIL — `expected 1, received 3`. 두번째도 별돌보미 카운트가 다를 수 있음(예상 2지만 실제도 2 가능 — 별개 챔프). 세번째는 PASS 가능. 네번째는 MF 모드에 따라 다양 — 일단 RED 단계 확인 위해 실패하는 테스트 1개 이상 보면 OK.

### Task 2.2: dedupe 로직 구현 (GREEN)

**Files:**
- Modify: `src/lib/simulator/systems/trait.ts:90-97`

- [ ] **Step 2.2.1: dedupe Set 추가**

`trait.ts` 의 trait counting 루프 (line 91-97):
```ts
const traitCounts = new Map<string, number>();
for (const { champion, mfMode } of champions) {
  const traits = resolveMfTraits(champion, mfMode);
  for (const traitName of traits) {
    traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
  }
}
```

위 코드 바로 위 line 90 의 주석:
```ts
// 기존 동작 보존 — unique champion 검사 없음 (별도 PR 에서 처리).
```
을 다음으로 교체:
```ts
// 동일 챔프 (apiName + mfMode) 는 1 카운트로 dedupe — 시뮬에서 자유 배치 시 같은
// 챔프 여러 마리 두는 케이스 대응. MF 는 mfMode 따라 다른 trait 부여되므로 키에 포함.
// emblem 카운트는 unit-bound 이므로 별도 dedupe 안 함 (다음 루프).
```

루프 자체를 다음으로 교체:
```ts
const traitCounts = new Map<string, number>();
const seenChampions = new Set<string>();
for (const { champion, mfMode } of champions) {
  const dedupeKey = `${champion.apiName}:${mfMode ?? ''}`;
  if (seenChampions.has(dedupeKey)) continue;
  seenChampions.add(dedupeKey);
  const traits = resolveMfTraits(champion, mfMode);
  for (const traitName of traits) {
    traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
  }
}
```

- [ ] **Step 2.2.2: dedupe 테스트 통과 확인 (GREEN)**

```bash
pnpm test --run tests/unit/simulator/trait-dedupe.test.ts
```
Expected: 모든 테스트 PASS.

- [ ] **Step 2.2.3: 기존 stargazer-trait 테스트 회귀 없음 확인**

```bash
pnpm test --run tests/unit/simulator/stargazer-trait.test.ts
```
Expected: 통과 (별개 챔프 사용이라 dedupe 영향 없음).

### Task 2.3: calibration cache 회귀 검증

actual-data 양 게임에 대해 dedupe 가 baseline 에 영향이 있는지 확인. 실제 게임은 동일 챔프 중복이 없으므로 영향 0 예상.

- [ ] **Step 2.3.1: 양 게임 calibration 재실행**

```bash
DIFF_GAME_ID=game-20260423-001 pnpm test --run tests/calibration/compute-diff-cache.test.ts
DIFF_GAME_ID=game-20260424-001 pnpm test --run tests/calibration/compute-diff-cache.test.ts
```
Expected: 두 게임 모두 통과.

- [ ] **Step 2.3.2: diff 캐시 git 변경 확인**

```bash
git diff actual-data/diff-game-20260423-001.json actual-data/diff-game-20260424-001.json
```

Expected: 변경 없음 (실제 게임 중복 챔프 없음). 변경 있다면:
- 의외 회귀 발생 — 점검 필요
- 변경 패턴 분석: winnerMatchRate, avgPlayerDamageErrorPct 등 baseline 지표 비교
- 분석 후 수용 가능하면 cache 갱신 commit, 아니면 dedupe 로직 점검

### Task 2.4: Phase 2 4-게이트 + commit

- [ ] **Step 2.4.1: 4-게이트 실행**

```bash
pnpm lint && pnpm typecheck && pnpm test --run && pnpm build
```
Expected: 모두 통과.

- [ ] **Step 2.4.2: commit**

```bash
git add src/lib/simulator/systems/trait.ts tests/unit/simulator/trait-dedupe.test.ts
git commit -m "$(cat <<'EOF'
fix(simulator): resolveTraits 동일 챔프 dedupe — 같은 유닛 N마리 → 1 시너지 카운트

apiName + mfMode 조합 키로 dedupe. MF 는 모드 다른 2 마리 별개 카운트 유지.
emblem 카운트는 unit-bound 이라 dedupe 대상 아님 (게임 룰: emblem 은 trait
미보유 유닛에만 부착 가능 → 자연 중복 방지).

trait.ts:90 주석에 명시된 알려진 버그 수정 (룰루 3마리 → 별돌보미 +3 →
실제 +1 이 맞음).

회귀 가드: tests/unit/simulator/trait-dedupe.test.ts (4 케이스).
calibration cache 무영향 확인 (실 게임은 동일 챔프 중복 없음).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — SynergyPanel dropdown UI

### Task 3.1: SynergyPanel prop 추가

**Files:**
- Modify: `src/components/builder/SynergyPanel.tsx`

- [ ] **Step 3.1.1: import 추가**

`SynergyPanel.tsx` 상단 import 영역:
```ts
import {
  CONSTELLATION_IDS,
  CONSTELLATION_KOREAN_NAME,
} from '@/lib/actualData/stargazerMapping';
import type { StargazerConstellationId } from '@/lib/actualData/types';
```

- [ ] **Step 3.1.2: SynergyPanelProps interface 확장**

기존 `SynergyPanelProps` interface (line 131 부근) 에 두 prop 추가:
```ts
stargazerConstellation?: StargazerConstellationId | null;
onStargazerConstellationChange?: (id: StargazerConstellationId | null) => void;
```

- [ ] **Step 3.1.3: 함수 signature 에 prop destructure 추가**

`export default function SynergyPanel({ ... }: SynergyPanelProps)` 의 destructure list 에 추가:
```ts
stargazerConstellation, onStargazerConstellationChange,
```

### Task 3.2: SynergyPanel 별돌보미 행 아래 dropdown 렌더

**Files:**
- Modify: `src/components/builder/SynergyPanel.tsx`

- [ ] **Step 3.2.1: 기존 trait 행 매핑 안에 분기 추가**

`activeTraits.map((at) => { ... })` 내부 마지막 conditional block (Arbiter law 패널 분기 다음) 바로 앞에 추가. 정확한 위치는 `{isActive && at.trait.apiName === 'TFT17_ADMIN' && onArbiterLawChange && (` 블록 직전.

```tsx
{isActive && at.trait.name === '별돌보미' && onStargazerConstellationChange && (
  <div className="mt-1">
    <select
      value={stargazerConstellation ?? ''}
      onChange={e => onStargazerConstellationChange(
        e.target.value === '' ? null : e.target.value as StargazerConstellationId
      )}
      className="w-full bg-gray-800 text-white text-[10px] rounded px-1 py-0.5 border border-gray-600"
    >
      <option value="">별자리 선택...</option>
      {CONSTELLATION_IDS.map(id => (
        <option key={id} value={id}>{CONSTELLATION_KOREAN_NAME[id]}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 3.2.2: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 통과.

### Task 3.3: 3 layout (Desktop/Tablet/Mobile) 에 prop drilling

**Files:**
- Modify: `src/app/simulator/layout/SimulatorLayoutDesktop.tsx`
- Modify: `src/app/simulator/layout/SimulatorLayoutTablet.tsx`
- Modify: `src/app/simulator/layout/SimulatorLayoutMobile.tsx`

3 layout 모두 `<SynergyPanel ... />` 호출이 있음. 각 호출에 prop 추가.

- [ ] **Step 3.3.1: SimulatorLayoutDesktop.tsx 의 player SynergyPanel 호출에 prop 추가**

`SynergyPanel` 호출 중 `team='player'` 인 것을 찾아 prop 추가:
```tsx
<SynergyPanel
  // ... 기존 prop
  stargazerConstellation={tm.playerStargazerConstellation}
  onStargazerConstellationChange={tm.setPlayerStargazerConstellation}
/>
```

- [ ] **Step 3.3.2: SimulatorLayoutDesktop.tsx 의 enemy SynergyPanel 호출에 prop 추가**

`team='enemy'` 인 호출:
```tsx
<SynergyPanel
  // ... 기존 prop
  stargazerConstellation={tm.enemyStargazerConstellation}
  onStargazerConstellationChange={tm.setEnemyStargazerConstellation}
/>
```

- [ ] **Step 3.3.3: SimulatorLayoutTablet.tsx 동일 적용**

Desktop 과 같은 패턴으로 player/enemy SynergyPanel 호출 두 곳 모두 prop 추가.

- [ ] **Step 3.3.4: SimulatorLayoutMobile.tsx 동일 적용**

Mobile 도 player/enemy 두 곳 모두 prop 추가.

- [ ] **Step 3.3.5: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 통과.

### Task 3.4: 수동 UI 검증

UI 변경은 unit test 가 어렵다 — dev 서버로 직접 확인. 빌드 스모크는 4-게이트 가 처리하므로 manual smoke test 만.

- [ ] **Step 3.4.1: dev 서버 시작 (background)**

```bash
pnpm dev
```
백그라운드로 실행, `http://localhost:3000/simulator` 접속.

- [ ] **Step 3.4.2: 별돌보미 챔프 3마리 배치 후 dropdown 등장 확인**

UI 조작:
1. A 팀 (player, 아래 진영) 에 룰루/TwistedFate/Talon 등 별돌보미 챔프 3마리 배치
2. SynergyPanel 에 "별돌보미 3" 활성 표시 확인
3. 별돌보미 trait 행 바로 아래 dropdown 등장 확인
4. dropdown 옵션 7개 (제단/멧돼지/여사냥꾼/메달/산/뱀/우물) 확인
5. 선택 후 새로고침해도 state 유지 안 되는 게 정상 (휘발 state)

- [ ] **Step 3.4.3: 별돌보미 비활성 시 dropdown 숨김 확인**

별돌보미 챔프 1명 제거 → 카운트 2 → 비활성 → dropdown 사라짐 확인.

- [ ] **Step 3.4.4: 양 팀 독립 동작 확인**

A 팀 별자리 = 산, B 팀 별자리 = 우물 으로 설정 가능 확인.

- [ ] **Step 3.4.5: dev 서버 종료**

### Task 3.5: Phase 3 4-게이트 + commit

- [ ] **Step 3.5.1: 4-게이트 실행**

```bash
pnpm lint && pnpm typecheck && pnpm test --run && pnpm build
```
Expected: 모두 통과.

- [ ] **Step 3.5.2: commit**

```bash
git add src/components/builder/SynergyPanel.tsx src/app/simulator/layout
git commit -m "$(cat <<'EOF'
feat(simulator): SynergyPanel 안 별자리 dropdown — 별돌보미 활성 시 등장

- 별돌보미 trait 행 아래 select (Ionia path 패턴 차용)
- 7 별자리 (제단/멧돼지/여사냥꾼/메달/산/뱀/우물) 선택 가능
- A/B 팀 독립 — 각 팀 SynergyPanel 에 dropdown 따로
- 비활성 시 자동 숨김 (isActive 조건)
- 3 layout (Desktop/Tablet/Mobile) prop drilling

다음 phase: 보드 위 강화 칸 보라색 테두리 표시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — 보드 강화 칸 보라색 테두리

### Task 4.1: SetupBoardCore prop + stroke 분기

**Files:**
- Modify: `src/components/battle/SetupBoardCore.tsx`

- [ ] **Step 4.1.1: import 추가**

`SetupBoardCore.tsx` 상단:
```ts
// HexCoord 는 이미 import 됨 — 추가 import 없음
```

- [ ] **Step 4.1.2: SetupBoardCoreProps 에 prop 2개 추가**

기존 `SetupBoardCoreProps` interface (line 8) 에 추가:
```ts
/** A 팀(player) 강화 칸 데이터-row 좌표 (0-3 기준). 보드 표시 시 row+4 매핑. */
playerStargazerTiles?: ReadonlyArray<HexCoord>;
/** B 팀(enemy) 강화 칸 데이터-row 좌표 (0-3 기준). 그대로 표시. */
enemyStargazerTiles?: ReadonlyArray<HexCoord>;
```

- [ ] **Step 4.1.3: 함수 signature destructure 에 추가**

```tsx
export default function SetupBoardCore({
  // ... 기존 prop
  playerStargazerTiles = [],
  enemyStargazerTiles = [],
  cellSize = DEFAULT_HEX_R,
}: SetupBoardCoreProps) {
```

- [ ] **Step 4.1.4: stargazerTileSet 빌드**

기존 `hexBuffMap` 빌드 코드 (line 136-151) 다음에 추가:
```ts
const stargazerTileSet = new Set<string>();
for (const t of playerStargazerTiles) {
  const off = axialToOffset(t);
  stargazerTileSet.add(`${off.row + 4}-${off.col}`);
}
for (const t of enemyStargazerTiles) {
  const off = axialToOffset(t);
  stargazerTileSet.add(`${off.row}-${off.col}`);
}
```

- [ ] **Step 4.1.5: stroke 분기 수정**

기존 polygon stroke 결정 로직 (line 266 부근):
```tsx
stroke={unitSel ? '#f59e0b' : sel ? teamHighlight : result ? costColor : hexBuffInfo ? `${hexBuffInfo.color}90` : isFrontZone ? '#22c55e40' : isBackZone ? '#f59e0b40' : '#2d3548'}
```

다음으로 교체:
```tsx
stroke={
  unitSel ? '#f59e0b'
  : sel ? teamHighlight
  : hexBuffInfo ? `${hexBuffInfo.color}90`
  : stargazerTileSet.has(zoneKey) ? '#A855F7'
  : result ? costColor
  : isFrontZone ? '#22c55e40'
  : isBackZone ? '#f59e0b40'
  : '#2d3548'
}
```

기존 strokeWidth 도 강화 칸 분기 추가:
```tsx
strokeWidth={unitSel ? 2.5 : sel ? 2.5 : hexBuffInfo ? 2 : stargazerTileSet.has(zoneKey) ? 2.5 : result ? 2 : (isFrontZone || isBackZone) ? 1.5 : 1}
```

- [ ] **Step 4.1.6: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 통과.

### Task 4.2: ReplayBoard 동일 패턴 적용

**Files:**
- Modify: `src/components/battle/ReplayBoard.tsx`

- [ ] **Step 4.2.1: ReplayBoard interface 확장**

`ReplayBoard.tsx` 의 props interface 에 prop 2개 추가 (4.1 과 동일):
```ts
playerStargazerTiles?: ReadonlyArray<HexCoord>;
enemyStargazerTiles?: ReadonlyArray<HexCoord>;
```

- [ ] **Step 4.2.2: stargazerTileSet 빌드 + stroke 분기**

`SetupBoardCore` 4.1.4 / 4.1.5 와 동일 패턴 적용. ReplayBoard 도 hex polygon stroke 결정 로직 보유 (검색: `polygon.*stroke`).

- [ ] **Step 4.2.3: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 통과.

### Task 4.3: simulator/page.tsx 좌표 계산

**Files:**
- Modify: `src/app/simulator/page.tsx`

- [ ] **Step 4.3.1: import 추가**

```ts
import { CONSTELLATION_TILE_PATTERN } from '@/lib/actualData/stargazerMapping';
```

- [ ] **Step 4.3.2: 좌표 계산 useMemo 2개 추가**

기존 `playerHexBuffs` / `enemyHexBuffs` useMemo 다음(line 164 부근)에 추가:
```ts
const playerStargazerTiles = useMemo(() => {
  if (!tm.playerStargazerConstellation) return [];
  const active = tm.playerTraits.find(t => t.trait.name === '별돌보미' && t.style > 0);
  if (!active) return [];
  return CONSTELLATION_TILE_PATTERN[tm.playerStargazerConstellation];
}, [tm.playerStargazerConstellation, tm.playerTraits]);

const enemyStargazerTiles = useMemo(() => {
  if (!tm.enemyStargazerConstellation) return [];
  const active = tm.enemyTraits.find(t => t.trait.name === '별돌보미' && t.style > 0);
  if (!active) return [];
  return CONSTELLATION_TILE_PATTERN[tm.enemyStargazerConstellation];
}, [tm.enemyStargazerConstellation, tm.enemyTraits]);
```

- [ ] **Step 4.3.3: layoutProps 에 추가**

`layoutProps: SimulatorLayoutProps = { ... }` (line 253) 에 추가 — 다음 task 에서 layout types 까지 같이 수정해야 컴파일 통과:
```ts
playerStargazerTiles, enemyStargazerTiles,
```

이 단계만으로 typecheck 실패 — 다음 task 에서 SimulatorLayoutProps type 추가하면 통과.

### Task 4.4: SimulatorLayoutProps 타입 + 3 layout prop drilling

**Files:**
- Modify: `src/app/simulator/layout/types.ts`
- Modify: `src/app/simulator/layout/SimulatorLayoutDesktop.tsx`
- Modify: `src/app/simulator/layout/SimulatorLayoutTablet.tsx`
- Modify: `src/app/simulator/layout/SimulatorLayoutMobile.tsx`

- [ ] **Step 4.4.1: types.ts 에 prop 2개 추가**

`SimulatorLayoutProps` interface 에 추가:
```ts
playerStargazerTiles: ReadonlyArray<HexCoord>;
enemyStargazerTiles: ReadonlyArray<HexCoord>;
```

`HexCoord` import 가 없으면 추가:
```ts
import type { HexCoord } from '@/types';
```

- [ ] **Step 4.4.2: SimulatorLayoutDesktop.tsx 의 SetupBoard 호출에 prop 전달**

기존 `<SetupBoard ... />` 호출(line 204):
```tsx
<SetupBoard
  // ... 기존 prop
  movingHexBuffApiName={movingHexBuff?.apiName}
  playerStargazerTiles={playerStargazerTiles}
  enemyStargazerTiles={enemyStargazerTiles}
/>
```

ReplayBoard 호출도 동일하게 prop 전달 (검색: `<ReplayBoard`).

- [ ] **Step 4.4.3: SimulatorLayoutTablet.tsx 동일 적용**

SetupBoard + ReplayBoard 호출 모두 prop 전달.

- [ ] **Step 4.4.4: SimulatorLayoutMobile.tsx 동일 적용**

SetupBoard + ReplayBoard 호출 모두 prop 전달.

- [ ] **Step 4.4.5: typecheck 통과 확인**

```bash
pnpm typecheck
```
Expected: 통과.

### Task 4.5: 수동 UI 검증

- [ ] **Step 4.5.1: dev 서버 시작 + 검증**

```bash
pnpm dev
```

체크리스트:
1. A 팀에 별돌보미 3 + 별자리=산 선택 → 보드 아래 절반(row 4-7) 에 보라 테두리 12 칸 등장
2. B 팀에 별돌보미 3 + 별자리=우물 선택 → 보드 위 절반(row 0-3) 에 다른 패턴 14 칸 등장
3. 양 팀 같은 별자리 선택 → 양쪽 진영에 같은 패턴(서로 미러) 등장
4. 별돌보미 비활성(<3) → 강화 칸 사라짐
5. 별자리 미선택(null) → 강화 칸 표시 안 됨
6. 강화 칸 + 증강 칸(hex buff) 겹침 → hex buff 우선 (회귀 없음)
7. 시뮬레이션 실행 → ReplayBoard 에서도 강화 칸 표시 유지

- [ ] **Step 4.5.2: dev 서버 종료**

### Task 4.6: Phase 4 4-게이트 + commit

- [ ] **Step 4.6.1: 4-게이트 실행**

```bash
pnpm lint && pnpm typecheck && pnpm test --run && pnpm build
```
Expected: 모두 통과.

- [ ] **Step 4.6.2: commit**

```bash
git add src
git commit -m "$(cat <<'EOF'
feat(simulator): 보드 강화 칸 보라색 테두리 — 별자리 선택 시 양 팀 진영 표시

- SetupBoardCore + ReplayBoard 에 playerStargazerTiles / enemyStargazerTiles prop
- stargazerTileSet 빌드 후 hex polygon stroke #A855F7 (purple-500), strokeWidth=2.5
- stroke 우선순위: unitSel > sel > hexBuff > stargazer > cost > zone > default
- simulator/page.tsx: useMemo 로 좌표 계산 — 별돌보미 활성 + 별자리 선택 시만
- 3 layout (Desktop/Tablet/Mobile) prop drilling

증강 칸(hex buff) 과 강화 칸 겹치면 hex buff 우선 — 기존 동작 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — 통합 테스트 + 최종 검증

### Task 5.1: 팀별 별자리 분리 회귀 가드 테스트

**Files:**
- Create: `tests/unit/simulator/stargazer-team-split.test.ts`

- [ ] **Step 5.1.1: 테스트 파일 작성**

```ts
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';
import { offsetToAxial } from '@/types';

const { champions, traits } = loadServerCatalogs();

function findChamp(api: string): RawChampion {
  const c = champions.find((x) => x.apiName === api);
  if (!c) throw new Error(`champion ${api} missing`);
  return c;
}

function makeStargazerTeam(team: 'player' | 'enemy'): PlacedChampion[] {
  // 별돌보미 챔프 3명 — 강화 칸 위 배치 위치는 mountain 패턴 기준
  // mountain pattern: r=0 col 2,3,4,5 / r=1 col 1,5 / r=2 col 1,6 / r=3 col 0,1,5,6
  // 간단히 (0, 2), (0, 3), (0, 4) 에 배치 — mountain 강화 칸 위
  const baseRow = team === 'player' ? 4 : 0;
  return [
    { champion: findChamp('TFT17_TwistedFate'), position: offsetToAxial({ row: baseRow, col: 2 }), starLevel: 2, items: [] },
    { champion: findChamp('TFT17_Talon'), position: offsetToAxial({ row: baseRow, col: 3 }), starLevel: 2, items: [] },
    { champion: findChamp('TFT17_Jax'), position: offsetToAxial({ row: baseRow, col: 4 }), starLevel: 2, items: [] },
  ];
}

describe('simulateCombat — 팀별 별자리 분리', () => {
  it('A팀만 별자리 선택 + 별돌보미 활성 → A팀에만 변종 effect 적용', () => {
    const player = makeStargazerTeam('player');
    const enemy = makeStargazerTeam('enemy');
    const result = simulateCombat(player, enemy, {
      seed: 42,
      allTraits: traits,
      skipMirror: true,
      playerStargazerConstellation: 'mountain',
      // enemy 별자리 미지정 → base trait 만 활성, 변종 effect 미적용
    });
    // mountain 변종은 minUnits=3 부터 효과 — A팀 유닛 HP 가 강화되어야 함
    // base trait 도 effect 가 있으나 변종이 더 큼 — 단순 비교: A팀 합계 maxHp > B팀
    const playerHP = result.playerUnits.reduce((s, u) => s + u.maxHp, 0);
    const enemyHP = result.enemyUnits.reduce((s, u) => s + u.maxHp, 0);
    expect(playerHP).toBeGreaterThan(enemyHP);
  });

  it('양 팀 다른 별자리 → 각자 다른 변종 effect 받음', () => {
    const player = makeStargazerTeam('player');
    const enemy = makeStargazerTeam('enemy');
    const result1 = simulateCombat(player, enemy, {
      seed: 42, allTraits: traits, skipMirror: true,
      playerStargazerConstellation: 'mountain',
      enemyStargazerConstellation: 'mountain',
    });
    const result2 = simulateCombat(player, enemy, {
      seed: 42, allTraits: traits, skipMirror: true,
      playerStargazerConstellation: 'mountain',
      enemyStargazerConstellation: 'well',
    });
    // result1 양팀 mountain — 양팀 HP 동일
    // result2 player=mountain, enemy=well — well 은 mana regen 효과, mountain 은 HP — 차이 발생
    const r1PlayerHP = result1.playerUnits.reduce((s, u) => s + u.maxHp, 0);
    const r1EnemyHP = result1.enemyUnits.reduce((s, u) => s + u.maxHp, 0);
    const r2EnemyHP = result2.enemyUnits.reduce((s, u) => s + u.maxHp, 0);
    // 양팀 mountain → 진영만 다르고 effect 동일
    expect(r1PlayerHP).toBe(r1EnemyHP);
    // player mountain / enemy well → enemy HP 는 mountain 만큼 강화되지 않음
    expect(r2EnemyHP).toBeLessThan(r1EnemyHP);
  });
});
```

- [ ] **Step 5.1.2: 테스트 실행**

```bash
pnpm test --run tests/unit/simulator/stargazer-team-split.test.ts
```
Expected: 모두 통과. 실패 시 Phase 1 호출 인자 분리가 제대로 적용됐는지 점검.

### Task 5.2: 양 게임 calibration cache 최종 재실행

phase 1 데이터 모델 분리 + phase 2 dedupe 가 모두 적용된 상태에서 baseline 재측정.

- [ ] **Step 5.2.1: 23일 게임 cache 재실행**

```bash
DIFF_GAME_ID=game-20260423-001 pnpm test --run tests/calibration/compute-diff-cache.test.ts
```

- [ ] **Step 5.2.2: 24일 게임 cache 재실행**

```bash
DIFF_GAME_ID=game-20260424-001 pnpm test --run tests/calibration/compute-diff-cache.test.ts
```

- [ ] **Step 5.2.3: diff 캐시 git 변경 확인**

```bash
git diff actual-data/diff-game-20260423-001.json actual-data/diff-game-20260424-001.json
```

Expected: 변경 0 (실 게임은 양 팀 동일 별자리이고 동일 챔프 중복 없음). 변경 있으면:
- winnerMatchRate, avgPlayerDamageErrorPct, avgSurvivorHpErrorPts 비교
- baseline 23일 = 40.9% / -43.8% / 7.7, 24일 = 76.2% / -15.2% / 2.36 와 비교
- 회귀 없으면 cache 갱신, 회귀 있으면 점검

### Task 5.3: Phase 5 4-게이트 + commit

- [ ] **Step 5.3.1: 최종 4-게이트 실행**

```bash
pnpm lint && pnpm typecheck && pnpm test --run && pnpm build
```
Expected: 모두 통과.

- [ ] **Step 5.3.2: commit**

```bash
git add tests
# diff 캐시 변경 있으면 actual-data 도 add
# git add actual-data/diff-game-*.json
git commit -m "$(cat <<'EOF'
test(simulator): 별돌보미 팀별 별자리 분리 회귀 가드 + calibration 재실행

- tests/unit/simulator/stargazer-team-split.test.ts
- 한 팀만 별자리 선택 / 양 팀 다른 별자리 시 effect 분리 검증
- calibration cache 재측정 (23일/24일 N=10) — baseline 무영향 확인

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 완료 기준

- [ ] Phase 1~5 모든 commit 완료
- [ ] 각 phase 4-게이트 통과 (`pnpm lint && pnpm typecheck && pnpm test --run && pnpm build`)
- [ ] 양 게임 calibration cache 무영향 확인
- [ ] 수동 UI 검증 (Task 3.4, 4.5) 모든 체크리스트 통과
- [ ] `git log --oneline -5` 에 5개 commit 표시 확인

## 후속 작업 후보 (본 plan 범위 외)

- Set 16 자동 유닛 cleanup (포탑/모래병사/티버 — `useTeamManagement.syncFreljordTurretsInTeam` 등 죽은 코드 제거)
- 플레이어 레벨별 강화 칸 점진 공개 (현재는 풀 패턴 고정)
- 별돌보미 statusEffect / event-driven 효과 (Fountain heal, Huntress mark, Serpent poison 등)
- 강화 칸 hover tooltip — 별자리 효과 텍스트 표시
- 유물 (셴 분신) 인접 6칸 보루 시너지 hex buff 메커니즘
