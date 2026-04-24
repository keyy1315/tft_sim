# Plan: 분석 → 시뮬레이터 팀코드 방식 전환 + 복귀 네비

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | analysis-to-simulator |
| 작성일 | 2026-04-21 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 매치 분석 "시뮬레이터에서 열기" → `/simulator` 이동 시 `sessionStorage` 에 JSON 으로 전달된 `playerTeam`이 보드에 제대로 올라오지 않음. 좌표 역변환(`row 4-7 → 0-3`) 적용 이후에도 로드 타이밍/상태 전파 이슈로 불안정. 또한 시뮬레이터에서 분석 페이지로 돌아갈 "이전 버튼" 없어 UX 단절 |
| **Solution** | (1) **팀코드 방식으로 전환**: 기존 `encodeTeamCode/decodeTeamCode` + `autoPlaceChampions` 경로 재사용. 좌표 계산 책임을 기존 검증된 유틸에 위임 (2) 아이템/증강은 팀코드 포맷에 없으므로 별도 `extras` 필드로 sessionStorage 에 병행 전달 (3) 분석 페이지에서 진입했을 때만 시뮬레이터 상단에 "← 매치 분석으로 돌아가기" 버튼 표시, 클릭 시 `/lookup/{matchId}/analysis?puuid=...` 로 복귀 |
| **Function UX Effect** | 분석에서 "시뮬레이터에서 열기" 클릭 시 TEAM A/B 양팀의 유닛이 역할군 기반 자동 배치로 깔끔하게 올라가고 아이템/증강까지 복원. 시뮬레이터에서 분석으로 되돌아가는 경로가 1클릭 |
| **Core Value** | 분석 ↔ 시뮬레이터 왕복 워크플로우의 **정합성 + 내비게이션 폐쇄 루프** 확보 |

---

## 1. 현재 상태

### 1.1 이미 구현됨 (재사용 가능)

| 항목 | 위치 | 비고 |
|------|------|------|
| `encodeTeamCode(team, mapping)` | `src/lib/teamCode.ts:74-99` | 챔피언 apiName + 별 인코딩 → 128-bit hex + `TFTSet17` suffix |
| `decodeTeamCode(code, mapping, champions)` | `src/lib/teamCode.ts:22-72` | 역방향, warnings 반환 |
| `autoPlaceChampions(decoded, cols, team)` | `src/lib/teamCode.ts:109-148` | 역할군 기반 전/후방 배치. TEAM A 는 row 0-3, TEAM B 는 row 0-3 (상단) |
| `TeamCodePanel` import/export UI | `src/components/builder/TeamCodePanel.tsx` | 내부적으로 `decodeTeamCode + autoPlaceChampions + onImport` 체인 |
| Set 17 teamplanner 매핑 JSON | `public/data/tft_set17_teamplanner.json` | 63명 전체 매핑 (이전 feature 에서 채움) |

### 1.2 현재 경로의 문제

```
매치 분석 openInSimulator()
  ↓ sessionStorage.setItem('analysis_team', JSON.stringify({playerTeam, enemyTeam}))
  ↓ router.push('/simulator')
        ↓
/simulator mount → useEffect(() => {
  const stored = sessionStorage.getItem('analysis_team');
  tm.updatePlayerTeam(playerTeam);  // ← 여기서 유닛 적용 안 되는 이슈
  tm.updateEnemyTeam(enemyTeam);
}, [])
```

관찰된 증상/가설:
- 좌표 역변환(`shiftPlayerRowsForSimulator`) 은 이미 적용됨에도 불구, 사용자는 여전히 "유닛이 제대로 import 되지 않는다" 고 보고.
- 의심 원인:
  - `useTeamManagement` 의 `syncTeam` 체인이 JSON 직렬화 후 복원된 객체를 처리하는 과정에서 자동 소환 로직(`syncShenArtifactInTeam` 등) 이 예기치 않게 발화.
  - `teamPlannerMapping` / `champions` 데이터가 useEffect 최초 발화 시점에 아직 미로드 상태 가능성.
  - JSON stringify/parse 시 `position`, `items` 등 일부 필드가 유실되거나 타입 mismatch.
- 원인 진단보다 **검증된 경로(팀코드)로 우회** 가 신속·안전.

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 내용 | 우선순위 |
|----|------|---------|
| FR-01 | 분석 페이지 `openInSimulator()` 가 `encodeTeamCode` 로 양팀을 인코딩해 sessionStorage 에 저장 | P0 |
| FR-02 | 시뮬레이터 페이지가 sessionStorage 의 팀코드를 `decodeTeamCode + autoPlaceChampions` 로 복원 | P0 |
| FR-03 | 시뮬레이터 진입 시 양팀 챔피언이 역할군 기반 전/후방으로 **정확히** 배치 | P0 |
| FR-04 | 아이템/증강/특수 모듈은 팀코드 포맷 외 별도 필드(`extras`)로 전달되어 복원 | P0 |
| FR-05 | 분석에서 넘어왔을 때만 시뮬레이터 상단에 "← 매치 분석으로 돌아가기" 버튼 노출 | P0 |
| FR-06 | 복귀 버튼 클릭 시 `/lookup/{matchId}/analysis?puuid={puuid}` 로 이동 | P0 |
| FR-07 | 일반 시뮬레이터 진입(분석 경유 아님) 시 복귀 버튼 숨김 | P0 |
| FR-08 | sessionStorage 키는 1회성 (로드 후 제거) — 새로고침/재진입 시 상태 누수 없음 | P0 |

### 2.2 비기능 요구사항

- React Compiler 규칙 준수 (`useEffect` 내 직접 `setState` 지양, 기존 `tm.updatePlayerTeam` 액션 경로 유지).
- 결정론적 결과 보장: 팀코드 복원 → `autoPlaceChampions` 는 입력 순서에 의존하는 결정론적 배치.
- 기존 `TeamCodePanel` 의 수동 import/export 동작 영향 없음.
- 기존 `analysis_team` 키 사용처 제거 (병행 유지 시 레거시 혼란).

---

## 3. 구현 방안

### 3.1 새 sessionStorage 계약

**키**: `analysis_handoff`
**값**:
```ts
interface AnalysisHandoff {
  playerCode: string;            // encodeTeamCode(player, mapping)
  enemyCode: string;             // encodeTeamCode(enemy, mapping)
  extras: {
    player: HandoffExtras;
    enemy: HandoffExtras;
  };
  returnTo: {
    matchId: string;
    puuid: string;
  };
}

interface HandoffExtras {
  /** 챔피언 apiName → 장착 아이템 apiName 배열 */
  items: Record<string, string[]>;
  /** (선택) 증강 목록 */
  augments?: string[];
}
```

- `playerCode` / `enemyCode` 는 기존 포맷 (`...TFTSet17` suffix) 그대로 사용.
- 아이템은 챔피언 단위 매핑 (`{ TFT17_Jhin: ['TFT_Item_InfinityEdge', ...] }`). 복원 시 `autoPlaceChampions` 결과의 각 `PlacedChampion` 에 items 를 재주입.
- `returnTo` 는 FR-05~07 용. 분석에서 넘어오지 않았으면 `null` 이 아니라 **키 자체가 부재**.

### 3.2 분석 페이지 `openInSimulator` 재작성

**파일**: `src/app/lookup/[matchId]/analysis/page.tsx`

```ts
import { encodeTeamCode } from '@/lib/teamCode';
import type { TeamPlannerEntry } from '@/types';

// Set 17 mapping 은 페이지 진입 시 이미 useCombatAnalysis 가 로드해 두거나, 별도 훅 필요.
// 가장 단순: useGameData/useTeamPlannerMapping 을 분석 페이지에서도 사용.

const openInSimulator = () => {
  if (!analysis.reconstruction || !teamPlannerMapping) return;

  const handoff = {
    playerCode: encodeTeamCode(
      analysis.reconstruction.playerTeam.map(p => ({
        champion: p.champion,
        starLevel: p.starLevel,
      })),
      teamPlannerMapping,
    ),
    enemyCode: encodeTeamCode(
      analysis.reconstruction.enemyTeam.map(p => ({
        champion: p.champion,
        starLevel: p.starLevel,
      })),
      teamPlannerMapping,
    ),
    extras: {
      player: { items: collectItems(analysis.reconstruction.playerTeam) },
      enemy:  { items: collectItems(analysis.reconstruction.enemyTeam) },
    },
    returnTo: { matchId, puuid },
  };
  sessionStorage.setItem('analysis_handoff', JSON.stringify(handoff));
  router.push('/simulator');
};

function collectItems(team: PlacedChampion[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const p of team) {
    map[p.champion.apiName] = p.items.map(i => i.apiName);
  }
  return map;
}
```

- 기존 `shiftPlayerRowsForSimulator` 헬퍼 **제거** (팀코드 경로는 좌표 미포함).
- 레거시 `analysis_team` 키 저장 로직 제거.

### 3.3 시뮬레이터 로딩 변경

**파일**: `src/app/simulator/page.tsx`

```ts
import { decodeTeamCode, autoPlaceChampions } from '@/lib/teamCode';

const [returnTo, setReturnTo] = useState<{matchId: string; puuid: string} | null>(null);

useEffect(() => {
  const stored = sessionStorage.getItem('analysis_handoff');
  if (!stored) return;
  sessionStorage.removeItem('analysis_handoff');
  if (!champions.length || !items.length || !teamPlannerMapping.length) {
    // 데이터 아직 미로드 — 재시도용 sessionStorage 는 이미 지웠으므로
    // 재주입이 필요하면 tm.updateX 를 champions/items 로드 후 재시도하는 가드 로직 필요.
    // → 더 단순한 해법: useEffect 의존성에 champions 포함. 로드 완료 후 다시 진입.
    return;
  }
  try {
    const handoff = JSON.parse(stored) as AnalysisHandoff;
    applyHandoff(handoff);
    setReturnTo(handoff.returnTo);
  } catch { /* ignore */ }
}, [champions, items, teamPlannerMapping]);

function applyHandoff(handoff: AnalysisHandoff) {
  // 1) 팀코드 디코드 → PlacedChampion[] 반환 (역할군 자동 배치)
  const playerDecoded = decodeTeamCode(handoff.playerCode, teamPlannerMapping, champions);
  const enemyDecoded  = decodeTeamCode(handoff.enemyCode, teamPlannerMapping, champions);

  const playerPlaced = autoPlaceChampions(playerDecoded.champions, undefined, 'player');
  const enemyPlaced  = autoPlaceChampions(enemyDecoded.champions, undefined, 'enemy');

  // 2) 아이템 재주입
  const itemMap = new Map(items.map(i => [i.apiName, i]));
  const applyItems = (arr: PlacedChampion[], itemsByChamp: Record<string, string[]>) =>
    arr.map(p => ({
      ...p,
      items: (itemsByChamp[p.champion.apiName] ?? [])
        .map(id => itemMap.get(id))
        .filter((x): x is RawItem => !!x),
    }));

  tm.updatePlayerTeam(applyItems(playerPlaced, handoff.extras.player.items));
  tm.updateEnemyTeam(applyItems(enemyPlaced, handoff.extras.enemy.items));
}
```

**이슈**: `sessionStorage.removeItem` 을 데이터 로드 전에 호출하면 재시도 불가. 해법:
- 대안 A: `removeItem` 호출 타이밍을 실제 `applyHandoff` 성공 이후로 이동.
- 대안 B: 훅 의존성에 `champions/items/teamPlannerMapping` 을 포함해 로드 완료 시 재발화. sessionStorage 는 1회만 존재하므로 중복 적용 없음.
- **대안 B 채택** — 로직 단순.

### 3.4 복귀 버튼 UI

**파일**: `src/app/simulator/page.tsx`

```tsx
{returnTo && (
  <button
    onClick={() => router.push(`/lookup/${returnTo.matchId}/analysis?puuid=${returnTo.puuid}`)}
    className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
  >
    ← 매치 분석으로 돌아가기
  </button>
)}
```

위치: 헤더 상단 (팀 코드/초기화 버튼 옆, 또는 페이지 최상단).

- `returnTo` state 는 `applyHandoff` 성공 후에만 set. 일반 시뮬레이터 진입 시 `null` 유지 → 버튼 미노출 (FR-07).
- 페이지 내 상태이므로 새로고침 시 사라짐 (의도됨 — 새로 들어온 세션에서는 복귀 경로 상실).

### 3.5 레거시 경로 제거

- `shiftPlayerRowsForSimulator` 함수 및 `analysis_team` 키 참조 모두 제거.
- 제거 대상 위치: `analysis/page.tsx`, `simulator/page.tsx`.

---

## 4. 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `src/app/lookup/[matchId]/analysis/page.tsx` | 수정 | `openInSimulator` 재작성 + `teamPlannerMapping` 로드 훅 추가 + 레거시 헬퍼 제거 |
| `src/app/simulator/page.tsx` | 수정 | 로드 useEffect 재작성, `returnTo` state + 복귀 버튼 UI |
| (선택) `src/types/analysis.ts` | 확장 | `AnalysisHandoff` 타입 공용화 |

총 변경: 약 +70 / −25 라인.

---

## 5. 트레이드오프 검토

### 5.1 팀코드 vs 직접 PlacedChampion[] 전달

| 항목 | 팀코드 | 직접 전달 |
|------|--------|----------|
| 좌표 정합성 | ✅ 자동 배치, 좌표 버그 불가 | ❌ row 4-7/0-3 이중 변환 필요 |
| 아이템 포함 | ❌ 별도 extras 필요 (이 feature 에서 해결) | ✅ 내장 |
| 증강/모듈 | ❌ 별도 필드 (이번엔 아이템만 구현) | ✅ 내장 |
| 재사용성 | ✅ 기존 검증 경로 | ❌ 신규 코드 |
| 디버깅 | ✅ 팀코드 콘솔 출력 가능 | ❌ JSON 크기 큼 |

팀코드 + extras 조합이 "검증된 경로 재사용 + 누락 정보 보완" 으로 최선.

### 5.2 증강/Piltover 모듈/Bilgewater 스탯 보존?

현재 `MatchReconstructionResult` 는 아이템 정도만 포함 (증강/모듈은 reconstruction 범위 밖). 본 feature 는 **아이템만** 보존. 증강 등이 나중에 reconstruction 에 추가되면 `extras` 에 필드 추가하면 됨.

---

## 6. 테스트 계획

### 6.1 핵심 시나리오

- [ ] 매치 분석 페이지에서 "시뮬레이터에서 열기" 클릭.
- [ ] 시뮬레이터 TEAM A 영역(하단 row 0-3)에 플레이어 챔피언이 역할군 분포로 배치 (Tank/Fighter/Assassin 전방).
- [ ] TEAM B 영역(상단 row 0-3)에 상대 챔피언이 배치.
- [ ] 각 챔피언의 아이템(최대 3개)이 원본 매치 그대로 장착.
- [ ] 별 등급은 팀코드 인코딩 규약(1성=0→1 decode, 2/3성=그대로) 준수.
- [ ] 시뮬레이터 상단에 "← 매치 분석으로 돌아가기" 버튼 노출.
- [ ] 버튼 클릭 → 원래의 `/lookup/{matchId}/analysis?puuid=...` 페이지로 복귀, 분석 상태 유지(자동 실행 effect 는 이미 돌았으므로 중복 발화 없음).

### 6.2 엣지

- [ ] 분석 없이 `/simulator` 직접 진입 → 복귀 버튼 미노출.
- [ ] 시뮬레이터 진입 직후 새로고침 → `analysis_handoff` 이미 제거됨, 팀 유지 여부는 zustand 상태에 따름. 복귀 버튼 사라짐 (의도).
- [ ] 매치 reconstruction 에 미지원 챔피언 포함 시 → 팀코드 decode 의 warnings 와 동일 경로로 경고. 나머지 유닛은 정상 배치.

### 6.3 회귀

- [ ] `TeamCodePanel` 수동 import/export 동작 변화 없음.
- [ ] 길잡이/티버/쉔 유물 등 자동 소환 유닛은 `syncTeam` 경로에서 기존대로 추가됨.
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과.

---

## 7. 위험 요소 & 완화

| 위험 | 완화 |
|------|------|
| `autoPlaceChampions` 가 원본 매치 배치와 달라 "복원" 기대가 어긋남 | 현 UX 가 원본 배치 재현이 아닌 "분석 팀으로 실험" 용도라고 안내. Plan 의도 자체가 역할군 자동 배치 |
| `teamPlannerMapping` 매핑에 챔피언 없음 → 팀코드 encode 시 0 으로 빠짐 | 매핑은 63명 완비 (Set 17 전체). 현재 상태에서는 누락 거의 없음. 누락 발생 시 console.warn 로 표시하고 스킵 |
| 시뮬레이터 데이터 로드(`champions/items`) 가 매우 느려서 `returnTo` 설정 전 사용자가 새로고침 | useEffect 의존성으로 재발화 보장. 여러 번 진입해도 `removeItem` 직후 값 없음 |
| `applyItems` 가 itemMap 미스 시 아이템 소실 | `.filter((x): x is RawItem => !!x)` 로 안전 처리. 로깅으로 추적 가능 |
| 분석 페이지에서 `teamPlannerMapping` 미로드 상태에서 버튼 클릭 | 버튼 `disabled` 또는 `openInSimulator` 초기 가드로 early-return. `useGameData` 를 분석 페이지에서도 사용 |

---

## 8. 범위 외

- 증강/Piltover/Bilgewater/IoniaPath 등 시뮬레이터 고급 상태 전달 (별도 feature 필요).
- 원본 매치 **배치 좌표** 완전 복원 (팀코드 방식 포기 필요, 이 feature 는 역할군 자동 배치로 대체).
- URL 쿼리 파라미터로 handoff 전달 (공유 가능 링크 — 별도 `share-analysis-link` feature).
- 시뮬레이터에서 분석 페이지로 돌아간 후 **재시뮬 결과 반영** (현재는 복귀 후 분석은 원본 시뮬 결과 유지).
- TeamCodePanel 복귀 버튼 추가 (패널은 수동 import 용이라 연결 부자연스러움).
