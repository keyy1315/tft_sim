# Plan: 전적검색 상태 zustand 전환 + 새로고침 버튼

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | lookup-zustand-refresh |
| 작성일 | 2026-04-21 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 전적검색 결과(`result`)·입력값(`input`)·시즌 탭(`activeSet`)을 `sessionStorage + useSyncExternalStore` 로 관리. 거대한 `result`(메타 포함 수백 KB)를 매번 JSON 직렬화/파싱하며 hydration-safe 래퍼 60 라인이 필요. 새로고침(F5)으로 복원되지만 그 외 명시적 재조회 UX 가 없음 |
| **Solution** | (1) `src/store/lookupSlice.ts` 신규 zustand store 로 `input / activeSet / result` 관리. sessionStorage persist 사용 안 함 (2) `useSessionState` 훅/`subscribeKey`/`notifyKey` 유틸 제거 (3) 결과 영역 옆에 "새로고침" 버튼 추가 — 현재 input 값으로 `handleSearch()` 재호출 → Riot 최신 matchIds 조회 + DB 미존재 신규만 fetch |
| **Function UX Effect** | 페이지 이동/복귀 시 입력값/시즌 탭/결과 유지(zustand 메모리). 새로운 매치가 있으면 "새로고침" 한 번으로 최신화. F5(브라우저 새로고침)는 의도적으로 상태 초기화 — sessionStorage 파싱 오버헤드 제거 |
| **Core Value** | 렌더 성능 개선 + 명시적 최신화 UX + 코드 단순화 |

---

## 1. 현재 상태

### 1.1 관련 코드 (`src/app/lookup/page.tsx:534-632`)

```ts
const STORAGE_KEYS = { input, result, activeSet };

// useSyncExternalStore 기반 hydration-safe sessionStorage 래퍼
type Listener = () => void;
const sessionListeners = new Map<string, Set<Listener>>();
function subscribeKey(key) { ... }
function notifyKey(key) { ... }

function useSessionState<T>(key, fallback, parse, serialize): [T, (v: T) => void] {
  const cacheRaw = useRef(...);
  const cacheParsed = useRef(...);
  const value = useSyncExternalStore(subscribe, ..., () => fallback);
  const setValue = (next) => {
    sessionStorage.setItem(key, serialize(next));
    notifyKey(key);
  };
  return [value, setValue];
}

// 사용
const [input, setInput] = useSessionState<string>('lookup-input', '', ...);
const [result, setResult] = useSessionState<LookupResult | null>('lookup-result', null, ...);
const [activeSet, setActiveSet] = useSessionState<string>('lookup-active-set', 'set17', ...);
```

### 1.2 문제점

- `result` 는 메타(`traitMeta + championMeta + itemMeta`) 포함 수백 KB → 매 set 마다 `JSON.stringify` → `sessionStorage.setItem` 비용.
- `useSyncExternalStore` + `getSnapshot` 캐시 로직이 복잡 (referential identity 보존 필요).
- 브라우저 새로고침 외에는 "최신 매치 확인" 방법이 없음.

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 내용 | 우선순위 |
|----|------|---------|
| FR-01 | `input / activeSet / result` 를 zustand store 에서 관리 | P0 |
| FR-02 | sessionStorage persist 제거 (의도적 in-memory only) | P0 |
| FR-03 | 검색 완료 후 결과 영역 헤더에 "새로고침" 버튼 노출 | P0 |
| FR-04 | 새로고침 버튼 클릭 → 현재 `result.summoner.puuid` 대신 **현재 input 값**으로 `handleSearch()` 재호출 | P0 |
| FR-05 | 새로고침 중 `loading=true` 로 버튼 비활성 + "새로고침 중..." 라벨 | P0 |
| FR-06 | 검색 결과 없는 상태에서는 새로고침 버튼 미노출 | P0 |
| FR-07 | 페이지 이동(다른 라우트)→복귀 시 상태 유지. 브라우저 F5 시 초기화 | P0 |
| FR-08 | 기존 `useSessionState / subscribeKey / notifyKey / STORAGE_KEYS` 전부 제거 | P0 |

### 2.2 비기능 요구사항

- React Compiler 규약 준수. 이벤트 핸들러에서만 store 업데이트.
- 다른 페이지(`/lookup/[matchId]/analysis`, `/simulator`) 동작 영향 없음.
- 페이지네이션 `page` state 는 로컬 `useState` 유지(현 규약 그대로).

---

## 3. 구현 방안

### 3.1 `src/store/lookupSlice.ts` 신규

```ts
import { create } from 'zustand';

// LookupResult 타입은 page.tsx 에 선언돼 있음 — 공용화 or page 내부 import.
// 선택 A: 타입을 page → store 로 이동 (권장)
// 선택 B: 타입만 store 에 재정의 (duplication)

interface LookupState {
  input: string;
  activeSet: string;  // SetId 문자열
  result: LookupResult | null;
  setInput(value: string): void;
  setActiveSet(setId: string): void;
  setResult(result: LookupResult | null): void;
  reset(): void;
}

export const useLookupStore = create<LookupState>((set) => ({
  input: '',
  activeSet: 'set17',
  result: null,
  setInput: (input) => set({ input }),
  setActiveSet: (activeSet) => set({ activeSet }),
  setResult: (result) => set({ result }),
  reset: () => set({ input: '', activeSet: 'set17', result: null }),
}));
```

**타입 선언 위치**: `LookupResult`/`SummonerData`/`MatchData`/`TraitMetaEntry`/`ChampionMetaEntry`/`ItemMetaEntry` 가 현재 page.tsx 상단에 로컬 선언. store 와 공유하려면 옵션:

- **(A)** 그대로 두고 store 는 `unknown` 으로 두지 않고 `LookupResult` 타입을 store 에서 먼저 정의한 후 page 에서 import
- **(B)** 타입만 `src/types/lookup.ts` 로 분리 후 store + page 양측 import

B 채택 — 순환/중복 회피, 공용 타입이라 적절.

### 3.2 `src/app/lookup/page.tsx` 수정

**제거**:
- `STORAGE_KEYS` 상수
- `Listener`, `sessionListeners`, `subscribeKey`, `notifyKey` 유틸 (56줄 블록)
- `useSessionState` 훅 전체 (38줄)
- 로컬 `LookupResult`/`SummonerData` 등 타입 선언 (B 옵션 적용 시 types/lookup.ts 로 이동)

**교체**:

```tsx
import { useLookupStore } from '@/store/lookupSlice';

const { input, activeSet, result, setInput, setActiveSet, setResult } = useLookupStore();
```

**`handleSearch` 변경 없음** — store action 호출 방식이 기존과 동일 시그니처.

**새로고침 버튼**:

현재 `error` 블록과 `{result && (…)}` 사이 또는 result 헤더 근처에 추가:

```tsx
{result && (
  <div className="flex items-center justify-between mb-3">
    <div className="text-sm text-gray-500">
      {SET_LABELS[activeSet] ?? activeSet} — 전체 {filteredMatches.length}게임
      {totalPages > 1 && (
        <span className="ml-2 text-gray-600">· 페이지 {currentPage} / {totalPages}</span>
      )}
    </div>
    <button
      onClick={() => handleSearch()}
      disabled={loading}
      className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-xs text-gray-300 transition-colors"
    >
      {loading ? '새로고침 중...' : '↻ 새로고침'}
    </button>
  </div>
)}
```

- 위치 근거: 기존 Match count 줄과 병합해 한 row 에 배치, 낭비 공간 최소.
- `handleSearch()` 는 인자 없이 호출하면 현재 `input` 상태를 사용 (기존 구현 line 636-676 그대로).
- 내부에서 `setResult(null)` → 로딩 중 시각적 clear → `/api/lookup` 재조회. Set17 기준 응답 로직은 이미 incremental (신규만 detail fetch).

### 3.3 hydration 고려

zustand `create` 는 SSR/CSR 동일 초기값 (`{input: '', activeSet: 'set17', result: null}`) 반환 → React hydration mismatch 없음. `useSyncExternalStore` 커스텀 구현 불필요.

---

## 4. 영향 파일

| 파일 | 변경 유형 | 규모 |
|------|----------|------|
| `src/store/lookupSlice.ts` | 신규 | ~30 라인 |
| `src/types/lookup.ts` | 신규 | ~60 라인 (LookupResult 등 타입) |
| `src/app/lookup/page.tsx` | 수정 | −90(sessionStorage 래퍼) / +15(zustand 사용 + 새로고침 버튼) |

총 변경: 약 +105 / −90 라인 (net + 15).

---

## 5. 테스트 계획

### 5.1 상태 전환

- [ ] `/lookup` 첫 진입: input 빈 문자열, activeSet = set17, result = null.
- [ ] 검색 실행 → result, input, activeSet 업데이트.
- [ ] `/simulator` 로 이동 후 `/lookup` 복귀 → input/result/activeSet 유지.
- [ ] 브라우저 F5 → 초기 상태로 돌아옴 (sessionStorage 복원 없음).
- [ ] 시즌 탭 클릭 → activeSet 변경, page 는 로컬 useState 라 1로 리셋 (기존 동작 유지).

### 5.2 새로고침 버튼

- [ ] 검색 결과 있는 상태에서 버튼 노출.
- [ ] 클릭 → `loading=true`, 버튼 비활성화, "새로고침 중..." 라벨.
- [ ] 신규 매치가 있으면 목록 상단에 추가됨 (응답 구조 동일이라 자동 반영).
- [ ] 신규 매치 없으면 동일 목록 유지, 에러 없음.
- [ ] 빈 검색 상태에서 버튼 미노출.

### 5.3 회귀

- [ ] 페이지네이션 (←/→) 동작 유지.
- [ ] 매치 카드 펼치기, 참가자 뷰, 플레이어 점프 검색 정상.
- [ ] 가상 대전 분석 링크 이동 정상.
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 전부 통과.

---

## 6. 트레이드오프

| 현 구현 (sessionStorage) | 신 구현 (zustand) |
|-------------------------|-------------------|
| F5 새로고침으로 복원 | F5 = 초기화 (의도) |
| 탭 간 동기화 가능 | 탭 독립 |
| JSON stringify 매번 발생 | 메모리 참조만 |
| hydration-safe 래퍼 ~100 라인 | 없음 |
| 재조회 UX 없음 | 명시적 새로고침 버튼 |

**핵심**: sessionStorage 복원 UX 를 포기하고 명시적 새로고침 버튼으로 대체. 사용자 요구와 부합, 코드 단순화 + 렌더 비용 감소.

---

## 7. 범위 외

- zustand `persist` 미들웨어로 localStorage 복원 (의도적으로 제외 — 사용자 요구대로 in-memory only).
- 자동 새로고침 타이머 (예: 30초마다).
- 메타데이터 응답 크기 최적화 (별도 feature — 이전 대화에서 논의한 A/B/C 제안).
- `useSyncExternalStore` 다른 곳 사용처 확인 (현재 `lookup/page.tsx` 전용, 다른 파일 없음 확인 예정).
