# Design: 전적검색 페이지네이션

Plan 참조: [`docs/01-plan/features/lookup-pagination.plan.md`](../../01-plan/features/lookup-pagination.plan.md)

---

## 1. 현재 구현 현황

### 1.1 재사용 (변경 없음)

| 항목 | 위치 | 역할 |
|------|------|------|
| `useSessionState` 훅 (hydration-safe) | `page.tsx:573-610` | 입력값/시즌 탭 유지 |
| `useMatchAnalysis` + `analysisResults` Map | `page.tsx:633` | 자동 분석, de-dup |
| `MatchCard` 컴포넌트 | `page.tsx:395-530` | 개별 매치 카드 |
| 시즌 탭 UI | `page.tsx:729-748` | `availableSets` + `setActiveSet` |
| Riot `getMatchIds(puuid, count)` | `src/lib/riot.ts:65-69` | count 파라미터만 지원 (start 미사용) |

### 1.2 이번에 구현할 것

| # | 항목 | 우선순위 |
|---|------|---------|
| 1 | API fetch 수 20 → 60 확장 | P0 |
| 2 | 클라이언트 `page` state + `visibleMatches` slice | P0 |
| 3 | `PaginationBar` 로컬 컴포넌트 | P0 |
| 4 | 시즌 탭 / 새 검색 시 페이지 1 리셋 (이벤트 핸들러) | P0 |
| 5 | 자동 analyze effect 대상을 `visibleMatches` 로 축소 | P0 |
| 6 | "전체 X게임 · 페이지 Y/Z" 요약 | P1 |

---

## 2. 데이터 흐름

```
[소환사 검색]
      │
      ▼
/api/lookup?gameName=..&tagLine=..
      │  (neu: count=60)
      │  Riot getMatchIds(puuid, 60) → Supabase upsert
      │  Supabase .select().order().limit(60)
      ▼
 result.matches  (max 60)
      │
      ▼
 activeSet 필터 → filteredMatches  (시즌별 ≤ 60)
      │
      ▼
 page state + PAGE_SIZE=20
      │
      ▼
 visibleMatches = filteredMatches.slice((p-1)*20, p*20)
      │
      ├── map → <MatchCard>   ... × 20
      │
      └── useEffect([visibleMatches, ...]) → analyze(match.id)
            (analysisResults Map 가드로 재실행 없음)

 [시즌 탭 클릭]        [검색 재실행]        [← / → 버튼]
  setActiveSet()         handleSearch()        onPageChange(p)
  setPage(1)             setPage(1)            setPage(p)
  window.scrollTo(top)   window.scrollTo(top)  window.scrollTo(top)
```

---

## 3. 모듈/컴포넌트 설계

### 3.1 API 확장 (`src/app/api/lookup/route.ts`)

```diff
-    const matchIds = await getMatchIds(puuid, 20);
+    const matchIds = await getMatchIds(puuid, 60);
...
-      .limit(20);
+      .limit(60);
```

- 매직 넘버 감추기: 파일 상단에 `const MATCH_FETCH_LIMIT = 60;` 도입. 두 곳 동일 값으로 참조.
- 기타 로직 변경 없음 (rate limit, 캐싱, 에러 응답 포맷 유지).

### 3.2 페이지 상태 (`src/app/lookup/page.tsx`)

**위치**: `LookupPage` 함수 컴포넌트 내부, `analysisResults` 선언 바로 아래.

```tsx
const PAGE_SIZE = 20;
const [page, setPage] = useState(1);
```

**파생 값** (메모이제이션 불필요):

```tsx
const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
const currentPage = Math.min(page, totalPages);     // clamp (삭제 edge case 대비)
const pageStart = (currentPage - 1) * PAGE_SIZE;
const visibleMatches = filteredMatches.slice(pageStart, pageStart + PAGE_SIZE);
```

- `currentPage` 를 render 에 사용 — 데이터가 줄어들어 `page > totalPages` 가 된 경우 자동 보정.
- `setPage` 자체는 범위 밖 값도 받을 수 있지만 렌더는 clamp 로 안전.

### 3.3 리셋 시점 (React Compiler 규칙 준수)

`useEffect` 안에서 `setPage(1)` 호출 **금지** — 대신 **이벤트 핸들러에서** 동기 호출.

| 트리거 | 호출 지점 |
|--------|----------|
| 시즌 탭 클릭 | 탭 버튼 `onClick` 에서 `setActiveSet(setId); setPage(1);` 함께 |
| 새 검색 | `handleSearch()` 성공 분기에서 `setResult(data); setPage(1);` |
| 현 페이지 > 총 페이지 | render 시 `currentPage` clamp 로 해결 (state는 그대로, 표시만 보정) |

### 3.4 `PaginationBar` 로컬 컴포넌트

**위치**: `page.tsx` 파일 내 `LookupPage` 바깥(같은 파일 하단)에 선언. 별도 파일 분리하지 않음 — 단일 용도.

```tsx
interface PaginationBarProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function PaginationBar({ page, totalPages, onChange }: PaginationBarProps) {
  if (totalPages <= 1) return null;
  const go = (p: number) => {
    onChange(p);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  return (
    <div className="flex items-center justify-center gap-3 mt-6 text-sm">
      <button
        onClick={() => go(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="이전 페이지"
        className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ←
      </button>
      <span className="text-gray-400 tabular-nums">
        {page} <span className="text-gray-600">/</span> {totalPages}
      </span>
      <button
        onClick={() => go(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label="다음 페이지"
        className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        →
      </button>
    </div>
  );
}
```

- `totalPages <= 1` 이면 렌더하지 않음 (매치 < 20 케이스).
- `go()` 래퍼에서 부드러운 스크롤 동반 (FR-08 P2 즉시 포함 — 구현 비용 1 라인).
- SSR 안전을 위해 `typeof window !== 'undefined'` 가드.

### 3.5 자동 analyze 범위 축소

```diff
 useEffect(() => {
-  for (const m of filteredMatches) {
+  for (const m of visibleMatches) {
     if ((m.set_id ?? 'set17') === 'set17' && !analysisResults.has(m.match_id)) {
       analyze(m.match_id, {
         setId: m.set_id,
         placement: m.placement,
         champions: m.champions,
         traits: m.traits,
       });
     }
   }
-}, [filteredMatches, analysisResults, analyze]);
+}, [visibleMatches, analysisResults, analyze]);
```

- `visibleMatches` 는 매 렌더마다 `slice()` 결과로 새 배열이지만, 참조 동일성은 React 의존성 비교에 문제되지 않음 — `analysisResults.has()` 가드가 중복 실행 차단.
- `filteredMatches` 를 의존성에서 제거해도 동일한 상태 전이 (activeSet/page 변화 시 `visibleMatches` 갱신).

### 3.6 렌더 구조 변경

```tsx
{/* Match count */}
<div className="text-sm text-gray-500 mb-3">
  {SET_LABELS[activeSet] ?? activeSet} — 전체 {filteredMatches.length}게임
  {totalPages > 1 && (
    <span className="ml-2 text-gray-600">· 페이지 {currentPage} / {totalPages}</span>
  )}
</div>

{/* Match list */}
<div className="space-y-3">
  {visibleMatches.map((m) => (
    <MatchCard key={m.match_id} match={m} ... />
  ))}

  {filteredMatches.length === 0 && (
    <div className="text-center text-gray-500 py-8">
      {SET_LABELS[activeSet] ?? activeSet} 시즌 전적이 없습니다.
    </div>
  )}
</div>

<PaginationBar
  page={currentPage}
  totalPages={totalPages}
  onChange={setPage}
/>
```

- `visibleMatches.length === 0` 이면서 `filteredMatches.length > 0` 케이스는 clamp 로 발생 불가.
- `filteredMatches.length === 0` 빈 상태 메시지는 기존 유지.

### 3.7 시즌 탭 핸들러 래핑

```diff
 <button
   key={setId}
-  onClick={() => setActiveSet(setId)}
+  onClick={() => { setActiveSet(setId); setPage(1); }}
   className=...
 >
```

### 3.8 `handleSearch` 핸들러 리셋 추가

```diff
       setResult(data as LookupResult);
+      setPage(1);
     } catch {
```

- `setActiveSet('set17')` 는 이미 상단에 있음 (line 654) — `activeSet` 자체가 바뀌면서 `filteredMatches` 가 재계산되므로 페이지 리셋과 함께 자연스러움.

---

## 4. 타입 변경

없음. `MatchData`, `LookupResult` 모두 기존 타입 그대로 사용. `filteredMatches.length` 기반으로만 페이징 계산.

---

## 5. 경계 조건 정리

| 상황 | 기대 동작 |
|------|----------|
| 매치 0개 (해당 시즌 없음) | `filteredMatches.length === 0` → 기존 빈 상태 메시지, `PaginationBar` 렌더 안 됨 |
| 매치 1~19개 | `totalPages === 1` → `PaginationBar` 렌더 안 됨, 전체 목록 그대로 |
| 매치 20개 정확히 | `totalPages === 1` → 네비 숨김 |
| 매치 21~40개 | `totalPages === 2` → `← 1 / 2 →` |
| 매치 60개 | `totalPages === 3` → `← 1 / 3 →` |
| 새 검색으로 매치 수 감소 | `handleSearch` 에서 `setPage(1)` — clamp 에 의존 안 함 |
| 시즌 탭 전환 | `setPage(1)` — 각 시즌 페이지 독립 |
| 페이지 2 에서 `window.scrollTo` 실패 (SSR) | `typeof window` 가드로 skip |

---

## 6. 구현 순서

1. `src/app/api/lookup/route.ts`: `MATCH_FETCH_LIMIT = 60` 추가, 2 곳 참조 치환.
2. `src/app/lookup/page.tsx`:
   - `PAGE_SIZE`, `page` state 추가.
   - `totalPages / currentPage / visibleMatches` 파생 계산.
   - `visibleMatches` 기반으로 렌더 + `useEffect` 의존성 갱신.
   - 시즌 탭 `onClick` 리셋 포함.
   - `handleSearch` 성공 분기에서 `setPage(1)`.
   - 파일 하단 `PaginationBar` 컴포넌트 추가.
   - Match count 줄에 페이지 표기 추가.
3. `pnpm lint && pnpm typecheck && pnpm build` 통과.
4. 브라우저 수동 QA (§7).

---

## 7. 테스트 시나리오

### 7.1 데이터 확장 (FR-01)

- [ ] 기존 DB에 10개만 저장된 puuid 검색 → Riot 에서 50개 추가 fetch → 총 60개 반환.
- [ ] 이미 60개 저장된 puuid 재검색 → Supabase 에서 60개 조회, Riot API 호출은 새 매치에 한정.

### 7.2 페이지네이션 UX

- [ ] 매치 ≥ 21 개 시 `PaginationBar` 표시.
- [ ] 1페이지에서 `←` disabled, 마지막 페이지에서 `→` disabled.
- [ ] 페이지 전환 시 상단 부드러운 스크롤.
- [ ] 페이지 2에서 다시 `←` → 페이지 1 매치가 복원되고 이미 분석된 결과 즉시 표시.

### 7.3 리셋 조건

- [ ] 페이지 2에서 시즌 탭 전환 → 페이지 1로 리셋.
- [ ] 페이지 3에서 새 검색 → 페이지 1로 리셋.

### 7.4 자동 analyze 범위

- [ ] DevTools Network → 페이지 1 진입 시 분석 요청 20개 이하 관측.
- [ ] 페이지 2로 이동 → 새 20개에 대해서만 analyze 호출. 기존 20개는 재호출 없음.

### 7.5 회귀

- [ ] 가상 대전 분석 링크, `MatchCard` expand, 참가자 뷰 모두 정상.
- [ ] `useSessionState` 기반 검색어/시즌 탭 유지 정상 (새로고침 시 페이지는 1로 복귀 — sessionStorage 저장 안 함).

### 7.6 빌드

- [ ] `pnpm lint && pnpm typecheck && pnpm build` 전부 통과.

---

## 8. 위험 요소 & 완화

| 위험 | 완화 |
|------|------|
| React Compiler `set-state-in-effect` 규약 위반 | effect 내 `setPage` 호출 없음. 모든 리셋은 이벤트 핸들러에서. |
| 페이지 범위 밖 state (데이터 감소 후) | 렌더 시 `currentPage = Math.min(page, totalPages)` clamp. |
| 매 렌더마다 새 `visibleMatches` 배열 생성 → `useEffect` 의존성 매번 발화 | `analyze()` 내부는 `analysisResults.has()` 가드. 실제 분석은 1회만. |
| Riot rate limit | `getMatchIds` 1회 호출로 60개 수집 가능 (count 파라미터). 추가 API 호출 없음. `getMatchDetail` 은 신규 매치만 — 첫 검색 1회 비용 증가 가능. |
| SSR `window` 접근 | `typeof window !== 'undefined'` 가드 |

---

## 9. 범위 외

- 페이지 번호 URL 쿼리 연동 (`?page=2`).
- "더 불러오기" (무한 스크롤 + 서버 start offset).
- 매치 정렬 옵션 (등수/날짜).
- 모바일 페이지네이션 UI 별도 튜닝.
- 매치 수 60 초과 확장 (`lookup-infinite-history` 로 분리).
