# combat-analysis Design Document

> **Summary**: 전적검색 → 시뮬레이션 기반 분석으로 차별화하는 4-Phase 기능 상세 설계
>
> **Project**: TFT Combat Simulator
> **Author**: Dayoung
> **Date**: 2026-04-17
> **Status**: Draft
> **Planning Doc**: [combat-analysis.plan.md](../../01-plan/features/combat-analysis.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. Riot API 전적 데이터와 기존 시뮬레이션 엔진(`simulateCombat`)을 최소 접합으로 연결
2. 분석 로직(`lib/analysis/`)은 UI와 store에 의존하지 않는 순수 TS 모듈로 유지 (엔진 입출력 타입에는 의존 가능)
3. 정확도 등급(`static` / `estimated` / `unsupported`)을 모든 분석 결과에 명시하여 유저 기대 관리
4. **Set 17 전적만 분석 대상** — 다른 세트 매치는 분석 자체를 스킵

### 1.2 Design Principles

- **정직한 분석**: "왜 졌는지"가 아닌 "엔진 기준 취약 요인"으로 표현 — 추정임을 숨기지 않음
- **점진적 가치**: Phase 0→1은 시뮬 없이도 동작, Phase 2→3은 엔진 연결 — 각 Phase가 독립적 가치를 가짐
- **기존 코드 재활용**: `SetupBoard`, `useTeamManagement`, `combatLoop` 등 이미 있는 것을 최대한 활용

---

## 2. Architecture

### 2.1 데이터 흐름

```
[Riot API]                     [Local Data]
    │                               │
    ▼                               ▼
riot.ts (ParsedMatch)       champions.json / items.json
    │                               │
    ├───────────┬───────────────────┘
    ▼           ▼
┌─────────────────────────┐
│  coverageChecker.ts     │ ← Phase 0: 시뮬 가능 여부 판정
│  (패치 정합성 + 엔진    │
│   커버리지 체크)         │
└────────┬────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
 supported  unsupported
    │         │
    │         └──→ UI: "재현 불가" 배지 + 사유 표시
    │
    ├──→ synergyAnalyzer.ts  ← Phase 1: 정적 분석 (시뮬 불필요)
    │    itemAnalyzer.ts
    │         │
    │         ▼
    │    SynergyDiagnosis (lookup UI에 인라인)
    │
    ├──→ matchAdapter.ts     ← Phase 2: 가상 대전 재구성
    │    (ParsedMatch + ParsedParticipant → SimulateOptions)
    │    (결측 배치 = heuristic 보정)
    │         │
    │         ▼
    │    simulateCombat()
    │         │
    │         ▼
    │    defeatReport.ts (CombatResult → 취약 요인 리포트)
    │         │
    │         ▼
    │    DefeatReport.tsx (정확도 등급 표시)
    │
    └──→ What-if (Phase 3)   ← SetupBoard 재활용
         (배치/아이템 수정 → 재시뮬 → 비교)
```

### 2.2 모듈 의존성

| 모듈 | 의존 대상 | 의존하지 않는 것 |
|------|----------|----------------|
| `coverageChecker.ts` | `data/*.json` 메타 (champion/item 목록) | 엔진, UI, store |
| `synergyAnalyzer.ts` | `data/traits.json` | 엔진, UI, store, coverageChecker (독립 실행 가능) |
| `itemAnalyzer.ts` | `data/items.json`, `data/champions.json` | 엔진, UI, store |
| `matchAdapter.ts` | `coverageChecker`, `data/*.json` | UI, store |
| `defeatReport.ts` | `CombatResult`, `CombatLog` 타입만 | UI, store, 엔진 함수 직접 호출 |
| `analysisSlice.ts` | 위 모듈들의 결과 타입 | 다른 슬라이스 직접 참조 금지 |

---

## 3. Data Model

### 3.1 핵심 타입 정의 (`src/types/analysis.ts`)

```typescript
import type { CombatResult, CombatLog, PlacedChampion } from '@/types';
import type { SimulateOptions } from '@/lib/simulator/engine/combatLoop';
// NOTE: SimulateOptions는 combatLoop.ts에만 정의됨. types/index.ts에는 없음.

// ── 정확도 등급 ──
export type AnalysisConfidence = 'static' | 'estimated' | 'unsupported';

// ── 재현 불가 사유 ──
export type UnsupportedReason =
  | 'unsupported_champion'
  | 'unsupported_item'
  | 'not_set17';  // Set 17이 아닌 매치 → 무조건 unsupported

// ── 커버리지 판정 결과 ──
export interface CoverageResult {
  confidence: AnalysisConfidence;
  reasons: UnsupportedReason[];
  /** 엔진이 지원하는 챔피언/아이템만 필터링한 목록 */
  supportedChampionIds: string[];
  unsupportedChampionIds: string[];
  supportedItemIds: string[];
  unsupportedItemIds: string[];
  isSet17: boolean; // Set 17 여부 (false → 분석 전체 스킵)
}

// ── 매치 재구성 결과 ──
export interface MatchReconstructionResult {
  playerTeam: PlacedChampion[];
  enemyTeam: PlacedChampion[];
  options: Partial<SimulateOptions>;
  confidence: AnalysisConfidence;
  reasons: UnsupportedReason[];
  heuristicFields: string[]; // heuristic으로 보정한 필드 목록
}

// ── 시너지 분석 결과 ──
export interface SynergyDiagnosisResult {
  confidence: 'static';
  score: number;           // 0-100 시너지 효율 점수
  issues: SynergyIssue[];
}

export interface SynergyIssue {
  type: 'item_mismatch' | 'carry_unfocused' | 'trait_waste' | 'comp_conflict';
  severity: 'warning' | 'critical';
  message: string;
  /** 관련 챔피언/아이템 ID */
  relatedIds: string[];
}

// ── 아이템 분석 결과 ──
export interface ItemAnalysisResult {
  confidence: 'static';
  issues: ItemIssue[];
}

export interface ItemIssue {
  championId: string;
  itemId: string;
  type: 'stat_mismatch' | 'duplicate_unique' | 'better_alternative';
  severity: 'warning' | 'critical';
  message: string;
  suggestion?: string; // "대신 X 아이템 추천"
}

// ── 취약 요인 리포트 ──
export interface DefeatReportResult {
  confidence: 'estimated';
  combatResult: CombatResult;
  factors: VulnerabilityFactor[];
  summary: string; // 한 줄 요약
}

export interface VulnerabilityFactor {
  type: 'carry_died_early' | 'damage_spread' | 'targeting_issue'
       | 'no_frontline' | 'cc_chain' | 'item_inefficiency';
  severity: 'minor' | 'major' | 'critical';
  message: string;
  /** 관련 로그의 tick 범위 */
  tickRange?: [number, number];
  /** 관련 유닛 ID */
  unitIds: string[];
}

// ── What-if 비교 결과 ──
export interface WhatIfComparisonResult {
  original: CombatResult;
  modified: CombatResult;
  delta: {
    winnerChanged: boolean;
    durationDelta: number;
    /** 각 유닛별 DPS 변화 */
    unitDeltas: Array<{
      unitId: string;
      championName: string;
      dpsDelta: number;
      survivalDelta: number; // 생존 틱 차이
    }>;
  };
}
```

### 3.2 Riot API 데이터 → 내부 타입 매핑 (Phase 0 핵심)

```
⚠️ 전제: Set 17 매치만 분석 대상. ParsedMatch.setId !== "set17" → 분석 스킵.

Riot API (ParsedMatch)           →   SimulateOptions 입력
─────────────────────────────────────────────────────────
character_id (e.g. "TFT17_Ahri") →   RawChampion.apiName 매칭
tier (1/2/3)                     →   PlacedChampion.starLevel
itemNames (string[])             →   RawItem[] (apiName으로 매칭)
traits (활성 시너지)              →   SimulateOptions.allTraits
setId ("set17")                  →   Set 17 판정용
placement                        →   분석 문맥용 (시뮬 입력 아님)
─── 결측 필드 (heuristic 보정) ──────────────────────────
유닛 위치 (없음)                  →   Role 기반 heuristic 배치
상대 보드 배치 (없음)             →   상대 참가자 최종 조합 + heuristic 배치
증강 (riot.ts에 없음)            →   빈 배열로 처리 (Phase 0에서 Riot raw 응답 확인 후 확장 가능)
```

> **NOTE**: 현재 `riot.ts`의 `ParsedMatch`에는 augment 필드가 없다. Riot API raw 응답에는
> `augments` 배열이 존재할 수 있으므로, Phase 0에서 raw 응답을 확인하고 필요 시 parser를 확장한다.

### 3.3 Heuristic 배치 전략

Riot API에 유닛 위치 데이터가 없으므로 Role 기반 규칙으로 보정한다.

**좌표계**: 실제 코드에서 player는 display row 4-7, enemy는 display row 0-3.
시뮬 실행 직전에 player만 +4 shift하여 `skipMirror: true`로 전달.

```
8x7 헥스 보드 (전체)
Row 0-3: Enemy 영역
Row 4-7: Player 영역

Player 배치 규칙 (row 4-7 기준):
Row 4   (전열):  Tank — 양쪽에 분산 (col 1, 5 우선)
Row 5   (전열2): Fighter — Tank 뒤에 배치
Row 6   (중열):  Specialist, Caster
Row 7   (후열):  Marksman, Assassin — carry는 col 2-4 중앙

Enemy 배치: 동일 규칙을 row 3→0 방향으로 미러 적용
```

**Carry 판정** (다단계 점수):
```
carry_score = (cost × 3) + (starLevel × 2) + (itemCount × 1)
```
> "비싼 챔피언 = carry"가 아닌 다단계 점수. 1코스트 3성 3아이템도 carry로 판정됨.

**Column 배정 규칙**:
- Tank: col 0, 6 (양쪽 끝) → col 1, 5 → col 2, 4 → col 3
- Carry: col 3 (중앙) → col 2, 4 → col 1, 5
- Assassin: col 0 또는 col 6 (측면)
- 동순위: carry_score 높은 순으로 중앙 우선 배치

`matchAdapter.ts`에서 구현:
```typescript
function heuristicPlacement(
  champions: Array<{ champion: RawChampion; starLevel: number; items: RawItem[] }>
): PlacedChampion[]  // 위치가 포함된 PlacedChampion 배열 반환
```

---

## 4. 모듈 상세 설계

### 4.1 `coverageChecker.ts` — 엔진 커버리지 판정

```typescript
/**
 * 매치 데이터가 시뮬레이션 가능한지 판정한다.
 * 
 * 판정 기준 (순서대로):
 * 1. Set 17이 아니면 즉시 unsupported (not_set17)
 * 2. 모든 champion.character_id가 champions.json에 존재하는지
 * 3. 모든 itemNames가 items.json에 존재하는지
 * 
 * @returns CoverageResult — confidence + 미지원 목록
 */
export function checkCoverage(
  match: ParsedMatch,
  participants: ParsedParticipant[],
  availableChampions: RawChampion[],
  availableItems: RawItem[]
): CoverageResult;
```

**판정 로직**:
- `setId !== "set17"` → 즉시 `unsupported` + `not_set17` (분석 전체 스킵)
- Set 17 + 모든 챔피언/아이템 지원 → `estimated` (배치는 추정이므로)
- Set 17 + 일부 챔피언/아이템 미지원 → `unsupported` + 사유 목록

### 4.2 `synergyAnalyzer.ts` — 시너지 효율 분석 (Phase 1)

```typescript
/**
 * 조합의 시너지 효율을 정적 분석한다.
 * 시뮬레이션 없이 data/traits.json 기반으로만 동작.
 * 
 * 분석 항목:
 * - 활성 시너지 수 vs 유닛 수 효율
 * - 불필요한 유닛 (시너지에 기여하지 않는 유닛)
 * - 시너지 티어 도달 가능성 (1유닛 추가로 다음 티어 가능한 경우)
 */
export function analyzeSynergy(
  champions: Array<{ id: string; tier: number; items: string[] }>,
  activeTraits: ParsedTrait[],
  traitData: RawTrait[]
): SynergyDiagnosisResult;
```

### 4.3 `itemAnalyzer.ts` — 아이템 궁합 분석 (Phase 1)

```typescript
/**
 * 챔피언-아이템 궁합을 정적 분석한다.
 * 
 * 분석 항목:
 * - AP 캐리에 AD 아이템 (stat_mismatch)
 * - 유니크 아이템 중복 장착 (duplicate_unique)
 * - 캐리 집중도: 메인 딜러에 아이템 3개 집중 여부 (carry_unfocused)
 * - 더 나은 대안 아이템 제안 (better_alternative)
 */
export function analyzeItems(
  champions: Array<{ id: string; tier: number; items: string[] }>,
  championData: RawChampion[],
  itemData: RawItem[]
): ItemAnalysisResult;
```

### 4.4 `matchAdapter.ts` — 전적 → SimulateOptions 변환 (Phase 2)

```typescript
/**
 * Riot API 전적 데이터를 시뮬레이터 입력으로 변환한다.
 * 결측 데이터(유닛 위치)는 heuristic으로 보정.
 * 
 * @param playerMatch - 검색 유저의 매치 데이터
 * @param opponentMatch - 비교 대상 상대의 매치 데이터
 * @param championData - 로컬 챔피언 데이터
 * @param itemData - 로컬 아이템 데이터
 * @returns MatchReconstructionResult
 */
export function reconstructMatch(
  playerMatch: ParsedMatch,
  opponentMatch: ParsedParticipant,
  championData: RawChampion[],
  itemData: RawItem[],
  traitData: RawTrait[]
): MatchReconstructionResult;

/** 내부 함수: Role 기반 heuristic 배치 */
function heuristicPlacement(
  champions: Array<{ champion: RawChampion; starLevel: number; items: RawItem[] }>
): PlacedChampion[];
```

### 4.5 `defeatReport.ts` — 취약 요인 리포트 (Phase 2)

```typescript
/**
 * 시뮬레이션 결과에서 취약 요인을 추출한다.
 * "패배 원인"이 아닌 "엔진 기준 취약 요인"으로 표현.
 * 
 * 분석 기준:
 * - carry_died_early: 가장 비싼 유닛이 전체 전투 시간의 30% 이내에 사망
 * - damage_spread: 딜 분산도 — 메인 딜러의 딜 비중이 40% 미만
 * - targeting_issue: 캐리가 탱커를 때리고 있는 시간이 50% 초과
 * - no_frontline: 전열 유닛이 1명 이하
 * - cc_chain: 아군 캐리에 스턴/둔화가 3초 이상 연속
 * - item_inefficiency: Phase 1 아이템 분석 결과 critical 이슈 존재
 */
export function generateDefeatReport(
  result: CombatResult,
  itemAnalysis: ItemAnalysisResult
): DefeatReportResult;
```

---

## 5. 상태 설계

### 5.1 아키텍처 결정: Feature Hook 패턴

> **결정 근거**: 실제 시뮬레이터 페이지는 `useTeamManagement` / `useReplayControls` 등
> 로컬 hook 기반으로 동작한다. `battleSlice`는 `playerTeam`, `enemyTeam`, `status`, `currentTick`만
> 보유하며 `CombatResult`를 저장하지 않는다. Zustand 슬라이스를 새로 만드는 것보다
> 기존 패턴에 맞춰 feature hook으로 시작하는 편이 리스크가 낮다.

### 5.2 `useCombatAnalysis()` hook (신규)

```typescript
// src/hooks/useCombatAnalysis.ts
export function useCombatAnalysis() {
  // ── 원본 매치 데이터 ──
  const [selectedMatch, setSelectedMatch] = useState<ParsedMatch | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<ParsedParticipant | null>(null);
  const [participants, setParticipants] = useState<ParsedParticipant[]>([]);

  // ── 분석 결과 (Phase별 독립) ──
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [synergyDiagnosis, setSynergyDiagnosis] = useState<SynergyDiagnosisResult | null>(null);
  const [itemAnalysis, setItemAnalysis] = useState<ItemAnalysisResult | null>(null);
  const [reconstruction, setReconstruction] = useState<MatchReconstructionResult | null>(null);
  const [defeatReport, setDefeatReport] = useState<DefeatReportResult | null>(null);

  // ── UI 상태 ──
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'unsupported' | 'ready' | 'running'>('idle');
  const [activeTab, setActiveTab] = useState<'synergy' | 'items' | 'combat' | 'whatif'>('synergy');

  // ── 워크플로우 ──
  const selectMatch = (match: ParsedMatch, allParticipants: ParsedParticipant[]) => { ... };
  const runStaticAnalysis = () => { ... };   // Phase 1: synergy + item 분석
  const runSimulation = () => { ... };        // Phase 2: reconstruct → simulateCombat → defeatReport
  const reset = () => { ... };

  return { selectedMatch, coverage, synergyDiagnosis, ... };
}
```

### 5.3 Phase 3 What-if 연결

```
Phase 3 진입 시:
1. useCombatAnalysis.reconstruction의 PlacedChampion[]을 초기값으로
   useTeamManagement에 전달 (기존 시뮬레이터 편집 흐름 그대로 재활용)
2. 유저가 SetupBoard에서 배치/아이템 수정
3. 재시뮬 → CombatResult 생성
4. 원본(useCombatAnalysis.defeatReport.combatResult)과 수정본 비교
   → WhatIfComparisonResult 생성
```

> **What-if 수정 가능 범위 (MVP)**:
> - ✅ 유닛 배치 변경 (드래그)
> - ✅ 아이템 변경 (클릭)
> - ❌ 증강 — 원본 매치에서 augment 데이터가 없으므로 빈 배열 고정
> - ❌ Piltover 모듈 / Bilgewater / Ionia / Arbiter 법률 — 원본에서 복원 불가, 기본값 고정
>
> ⓘ "이 결과는 배치와 아이템만 반영한 추정치입니다. 증강/특수 시너지 옵션은 반영되지 않았습니다."

---

## 6. UI/UX Design

### 6.1 전적검색 페이지 확장 (`lookup/page.tsx`)

```
┌────────────────────────────────────────────────────────────┐
│  전적 검색                                    [검색바]      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  매치 카드 ┌──────────────────────────────────────────┐    │
│           │ 🥇 1등  |  챔피언 아이콘 × 8  |  14:32    │    │
│           │ ┌─────────────────────────────────────┐   │    │
│           │ │ 📊 시너지 진단 (Phase 1)            │   │    │
│           │ │  ⚠️ AP 캐리에 AD 아이템 장착       │   │    │
│           │ │  ✅ 시너지 효율: 82/100             │   │    │
│           │ └─────────────────────────────────────┘   │    │
│           │ [가상 대전 분석] [재현 불가: 미지원 챔피언]│    │
│           └──────────────────────────────────────────┘    │
│                                                            │
│  매치 카드 (반복...)                                        │
└────────────────────────────────────────────────────────────┘
```

### 6.2 분석 상세 페이지 (`lookup/[matchId]/analysis`)

```
┌────────────────────────────────────────────────────────────┐
│  ← 전적 목록    매치 분석    ⚠️ 추정 시뮬레이션            │
├────────────────────────────────────────────────────────────┤
│  [시너지] [아이템] [가상 대전] [What-if]                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──── 가상 대전 탭 ────────────────────────────────────┐  │
│  │                                                      │  │
│  │  상대 선택: [1등 ▾] [2등] [3등] ... [8등]           │  │
│  │                                                      │  │
│  │  ┌─────────────┐    ┌─────────────┐                 │  │
│  │  │ 내 보드      │ vs │ 상대 보드    │                 │  │
│  │  │ (heuristic)  │    │ (heuristic)  │                 │  │
│  │  └─────────────┘    └─────────────┘                 │  │
│  │                                                      │  │
│  │  [▶ 시뮬레이션 실행]                                 │  │
│  │                                                      │  │
│  │  ── 취약 요인 리포트 ──                              │  │
│  │  🔴 캐리(아리) 4.2초 만에 사망 (전투의 28%)          │  │
│  │  🟡 딜 분산: 메인 딜러 딜 비중 35%                   │  │
│  │  🟢 전열 유지: Tank 2명이 8초 생존                   │  │
│  │                                                      │  │
│  │  ⓘ 이 결과는 엔진 기준 추정치이며,                  │  │
│  │    실제 게임 결과와 다를 수 있습니다.                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 6.3 What-if 탭 (Phase 3)

```
┌────────────────────────────────────────────────────────────┐
│  [What-if 시뮬레이션]                                      │
├────────────────────────────────────────────────────────────┤
│  ⓘ 배치와 아이템만 수정 가능합니다.                        │
│    증강/특수 시너지 옵션은 원본에서 복원 불가하여 반영되지   │
│    않습니다.                                               │
│                                                            │
│  ┌── 내 보드 (수정 가능) ──┐  ┌── 상대 보드 (고정) ──┐   │
│  │  드래그로 배치 변경       │  │                       │   │
│  │  클릭으로 아이템 변경     │  │                       │   │
│  └──────────────────────────┘  └───────────────────────┘   │
│                                                            │
│  [▶ 재시뮬레이션]                                          │
│                                                            │
│  ── 비교 결과 ──────────────────────────────────           │
│  │          원본        │     수정본      │ 변화          │
│  │ 결과:    패배        │     승리       │ 🔄 승패 역전  │
│  │ 전투시간: 15.2초     │     18.7초     │ +3.5초        │
│  │ 캐리 생존: 4.2초     │     12.1초     │ +7.9초 ✅     │
│  │ 캐리 DPS:  520      │     680        │ +160 ✅       │
│  └──────────────────────────────────────────────           │
└────────────────────────────────────────────────────────────┘
```

### 6.4 재현 불가 매치 UX

**Set 17이 아닌 매치**:
```
┌──────────────────────────────────────────┐
│ ⓘ 이 매치는 Set 17이 아니므로 분석할 수   │
│   없습니다.                               │
└──────────────────────────────────────────┘
```

**Set 17이지만 일부 미지원**:
```
┌──────────────────────────────────────────┐
│ 🚫 가상 대전을 실행할 수 없습니다         │
│                                          │
│ 사유:                                     │
│  • 미지원 챔피언: TFT17_NewChamp         │
│                                          │
│ 시너지/아이템 진단은 확인할 수 있습니다.    │
│ [시너지 진단 보기]                        │
└──────────────────────────────────────────┘
```

---

## 7. 컴포넌트 설계

### 7.1 컴포넌트 목록

| 컴포넌트 | 위치 | Phase | 역할 |
|----------|------|-------|------|
| `SynergyDiagnosis` | `components/analysis/` | 1 | 시너지 진단 인라인 카드 (lookup 매치 카드 내부) |
| `ItemDiagnosis` | `components/analysis/` | 1 | 아이템 궁합 진단 카드 |
| `ConfidenceBadge` | `components/analysis/` | 0 | 정확도 등급 배지 (`정적 분석` / `추정 시뮬레이션` / `재현 불가`) |
| `UnsupportedNotice` | `components/analysis/` | 0 | 재현 불가 사유 표시 |
| `MatchAnalysisPage` | `app/lookup/[matchId]/` | 2 | 분석 상세 페이지 (탭 네비게이션) |
| `OpponentSelector` | `components/analysis/` | 2 | 매치 참가자 중 비교 상대 선택 |
| `DefeatReport` | `components/analysis/` | 2 | 취약 요인 리포트 뷰 |
| `WhatIfComparison` | `components/analysis/` | 3 | 원본 vs 수정본 비교 뷰 |

### 7.2 라우팅

| Route | 컴포넌트 | 설명 |
|-------|---------|------|
| `/lookup` | `lookup/page.tsx` (기존) | 전적 검색 + Phase 1 인라인 진단 |
| `/lookup/[matchId]/analysis` | `MatchAnalysisPage` (신규) | Phase 2-3 분석 상세 |

---

## 8. Error Handling

### 8.1 에러 시나리오

| 시나리오 | 처리 |
|----------|------|
| 챔피언 ID 매핑 실패 (character_id가 로컬에 없음) | `unsupported_champion` → 해당 유닛 제외하고 분석, 경고 표시 |
| 아이템 ID 매핑 실패 | `unsupported_item` → 해당 아이템 제외, 경고 표시 |
| 패치 불일치 | `patch_mismatch` → 경고 배너 + Phase 1 정적 분석만 허용 |
| 시뮬레이션 런타임 에러 | try-catch로 잡아서 "시뮬레이션 실행 실패" UI 표시, 취약 요인 리포트 생략 |
| 상대 데이터 없음 | 상대 선택 UI에서 해당 참가자 비활성화 |

---

## 9. Clean Architecture

### 9.1 레이어 배치

| Layer | 위치 | 이 기능의 모듈 |
|-------|------|--------------|
| **Domain** | `src/types/analysis.ts` | 분석 관련 타입 정의 |
| **Infrastructure** | `src/lib/analysis/` | coverageChecker, matchAdapter, synergyAnalyzer, itemAnalyzer, defeatReport |
| **Application** | `src/hooks/useCombatAnalysis.ts` | 분석 워크플로우 오케스트레이션 (feature hook) |
| **Presentation** | `src/components/analysis/`, `src/app/lookup/[matchId]/` | UI 컴포넌트 |

### 9.2 임포트 규칙

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| `lib/analysis/*` | `types/analysis.ts`, `types/index.ts`, `data/*` | store, components, `lib/simulator/engine/*` 직접 호출 |
| `hooks/useCombatAnalysis` | `types/analysis.ts`, `lib/analysis/*` | store 슬라이스 직접 |
| `components/analysis/*` | `hooks/useCombatAnalysis`, `types/*` | `lib/analysis/*` 직접 (컴포넌트에서는 hook 통해 접근) |

**예외**: `defeatReport.ts`는 `CombatResult` 타입만 import하며, `simulateCombat()` 함수를 직접 호출하지 않는다. 시뮬레이션 실행은 컴포넌트/store 레벨에서 수행하고 결과만 `defeatReport`에 전달한다.

---

## 10. Implementation Order

### Phase 0 — 데이터 계약 검증 (Spike)

```
0-1. [ ] src/types/analysis.ts — 전체 타입 한 번에 정의
         AnalysisConfidence, UnsupportedReason, CoverageResult,
         SynergyDiagnosisResult, ItemAnalysisResult,
         MatchReconstructionResult, DefeatReportResult, WhatIfComparisonResult
0-2. [ ] riot.ts 확장 검토
         Riot API raw 응답에서 augments 필드 존재 여부 확인
         ParsedMatch/ParsedParticipant에 필요 시 augments 추가
0-3. [ ] src/lib/analysis/coverageChecker.ts — 커버리지 판정
         checkCoverage() 구현 (Set 17 판정 최우선)
0-4. [ ] Riot API 필드 매핑 검증
         ParsedMatch.character_id → RawChampion.apiName 매핑률 확인
         매핑 실패 케이스 목록화
0-5. [ ] src/components/analysis/ConfidenceBadge.tsx — Phase 0 산출물
         전적 카드에 coverage/set 배지 표시 (유저 노출 가치)
```

### Phase 1 — 시너지 충돌 진단

```
1-1. [ ] src/lib/analysis/synergyAnalyzer.ts
         analyzeSynergy() 구현 (coverageChecker에 의존하지 않음, 독립 실행)
1-2. [ ] src/lib/analysis/itemAnalyzer.ts
         analyzeItems() 구현
1-3. [ ] src/components/analysis/SynergyDiagnosis.tsx
1-4. [ ] src/components/analysis/ItemDiagnosis.tsx
1-5. [ ] lookup/page.tsx에 SynergyDiagnosis + ItemDiagnosis 인라인 통합
         (Set 17 매치에만 표시)
```

### Phase 2 — 가상 대전 재구성

```
2-1. [ ] src/lib/analysis/matchAdapter.ts
         reconstructMatch() + heuristicPlacement() 구현
         좌표계: player row 4-7, enemy row 0-3, skipMirror: true
2-2. [ ] src/lib/analysis/defeatReport.ts
         generateDefeatReport() 구현
2-3. [ ] src/hooks/useCombatAnalysis.ts — feature hook 생성
         (selectMatch → runStaticAnalysis → runSimulation 워크플로우)
2-4. [ ] src/app/lookup/[matchId]/analysis/page.tsx (라우트 생성)
2-5. [ ] src/components/analysis/OpponentSelector.tsx
         기본 상대: 바로 윗등수 (2등이면 1등, 1등이면 2등)
2-6. [ ] src/components/analysis/DefeatReport.tsx
2-7. [ ] src/components/analysis/UnsupportedNotice.tsx
2-8. [ ] lookup/page.tsx에 "가상 대전 분석" 버튼 추가
         (Set 17 아니면 숨김, 미지원 챔피언이면 비활성화)
```

### Phase 3 — What-if 시뮬레이션

```
3-1. [ ] reconstruction → useTeamManagement 초기값 전달 로직
         (기존 시뮬레이터 편집 흐름 재활용)
3-2. [ ] src/components/analysis/WhatIfComparison.tsx
3-3. [ ] 재시뮬레이션 실행 + WhatIfComparisonResult 생성 로직
3-4. [ ] MatchAnalysisPage에 What-if 탭 연결
3-5. [ ] What-if 제한 경고 영역: "배치/아이템만 반영, 증강/특수옵션 미반영"
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-17 | Initial draft | Dayoung |
| 0.2 | 2026-04-17 | Codex 리뷰 반영 — Set 17 한정, SimulateOptions import 정정, hook 기반 상태 설계, heuristic 좌표계/carry 판정 구체화, What-if 범위 한정, augment 부재 명시 | Dayoung |
