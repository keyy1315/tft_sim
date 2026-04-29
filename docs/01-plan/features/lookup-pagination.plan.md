# Plan: 전적검색 페이지네이션 (페이지당 20개)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | lookup-pagination |
| 작성일 | 2026-04-21 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 현재 전적검색은 Riot API 에서 20개 매치만 받아 한 화면에 전부 렌더 → 과거 전적 열람 불가 + 렌더 시 자동 분석(useEffect)이 20개 전부에 대해 동시 실행되어 초기 로딩 부하가 큼 |
| **Solution** | (1) `/api/lookup` 이 최근 60개 매치까지 수집하도록 Riot/Supabase fetch 수 확장 (2) 클라이언트에서 한 페이지당 20개씩 slice (3) 페이지 네비게이션 UI (이전/다음 + 페이지 번호) (4) 시즌 탭/새 검색 시 페이지 리셋 (5) 자동 analyze 는 **현재 페이지 매치에 한정** |
| **Function UX Effect** | 최대 60경기 히스토리 열람, 20개 단위로 끊어 로딩 부담 ⅓로 감소, 시즌별 페이지 독립 동작 |
| **Core Value** | 전적검색의 정보 범위 확장 + 렌더/분석 부하 분산으로 체감 속도 개선 |

---

## 1. 현재 구현 현황

### 1.1 관련 파일 / 함수

| 파일 | 역할 |
|------|------|
| `src/app/api/lookup/route.ts` | Riot Account → puuid → `getMatchIds(puuid, 20)` → Supabase 저장/반환 (`limit(20)`) |
| `src/lib/riot.ts:65-69` | `getMatchIds(puuid, count=20)` — `start` 파라미터 미사용 |
| `src/app/lookup/page.tsx:677-693` | `filteredMatches` 전체를 map 렌더 + 자동 analyze useEffect (전부 순회) |

### 1.2 한계

- **데이터**: 20개로 고정. 한 달 치 과거 기록도 확인 불가.
- **성능**: `filteredMatches.map(...)` + `useEffect` 내부 `for (const m of filteredMatches)` 가 매치 20개에 대해 동시 `analyze()` 호출 → `useMatchAnalysis` 내부 시뮬 스케줄 압박.
- **UX**: 시즌 탭 전환 시 위치 감각이 없음 (20개밖에 없어 스크롤만으로 충분했으나 확장 시 네비 필요).

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 내용 | 우선순위 |
|----|------|---------|
| FR-01 | 검색 시 최근 60개 매치를 수집해 반환한다 (Riot API `getMatchIds(puuid, 60)` + Supabase `.limit(60)`) | P0 |
| FR-02 | 클라이언트에서 페이지당 20개씩 표시, 기본 페이지 1 | P0 |
| FR-03 | 페이지 네비게이션 UI: 이전/다음 + 현재 페이지/총 페이지 수 (예: `< 1 / 3 >`) | P0 |
| FR-04 | 시즌 탭 전환 시 페이지를 1로 리셋 | P0 |
| FR-05 | 새 검색 실행 시 페이지를 1로 리셋 | P0 |
| FR-06 | 자동 `analyze()` 호출은 **현재 페이지 매치에만** 실행 | P0 |
| FR-07 | 페이지 상단에 "전체 X게임 / 페이지 Y/Z" 요약 표시 | P1 |
| FR-08 | 페이지 변경 시 페이지 최상단으로 스크롤 (`window.scrollTo`) | P2 |

### 2.2 비기능 요구사항

- React Compiler 규약 준수 (`set-state-in-effect` 금지 — 페이지 상태는 `useState` 로 관리, 리셋은 이벤트 핸들러에서).
- 기존 hydration-safe `useSessionState` 패턴 유지. 페이지 번호는 sessionStorage 에 저장할지 **선택** (새로고침 시 1페이지 복귀가 자연스러워 보여 저장 안 함 — FR 논의).
- Riot API rate limit: 기본 `getMatchIds` 는 1회 호출이므로 60개로 확장해도 추가 호출 없음. `getMatchDetail` 은 **신규 매치에 한해서만** 호출하므로 누적 후에는 영향 미미.
- 기존 페이지 로딩 체감 속도를 해치지 않을 것. 특히 자동 analyze 제한으로 **1페이지 20개만 돌면 현재 대비 부하 동일**.

---

## 3. 구현 방안

### 3.1 서버 (`src/app/api/lookup/route.ts`)

```diff
-    const matchIds = await getMatchIds(puuid, 20);
+    const matchIds = await getMatchIds(puuid, 60);
...
-      .limit(20);
+      .limit(60);
```

- Riot match-v1 은 count 최대 200 허용하지만 60으로 보수적 설정 (rate limit / 초기 저장 시간 고려).
- 기존 저장된 매치가 DB에 있으면 Riot 재호출 없이 Supabase 에서 60개 조회 — 캐시 동작 유지.

### 3.2 클라이언트 상태 (`src/app/lookup/page.tsx`)

새 state:

```tsx
const PAGE_SIZE = 20;
const [page, setPage] = useState(1);
```

파생 값 (메모이제이션 불필요, 가벼움):

```tsx
const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
const currentPageClamped = Math.min(page, totalPages);
const visibleMatches = filteredMatches.slice(
  (currentPageClamped - 1) * PAGE_SIZE,
  currentPageClamped * PAGE_SIZE,
);
```

리셋 트리거 (이벤트 핸들러, effect 금지):
- `setActiveSet` 호출 시 `setPage(1)` 동반 (시즌 탭 버튼)
- `handleSearch` 성공 시 `setPage(1)`

### 3.3 자동 analyze 제한 (FR-06)

```diff
 useEffect(() => {
-  for (const m of filteredMatches) {
+  for (const m of visibleMatches) {
     if ((m.set_id ?? 'set17') === 'set17' && !analysisResults.has(m.match_id)) {
       analyze(m.match_id, { ... });
     }
   }
-}, [filteredMatches, analysisResults, analyze]);
+}, [visibleMatches, analysisResults, analyze]);
```

- 페이지 전환 시 새 페이지 매치만 분석 — 분석 누적은 `analysisResults.has()` 가드로 자동 de-dup.
- 순차 이동 시 이미 분석된 매치는 재실행 안 됨.

### 3.4 페이지 네비 컴포넌트

파일 내 로컬 컴포넌트(신규 파일 불필요):

```tsx
function PaginationBar({
  page, totalPages, onChange,
}: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4 text-sm">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-3 py-1 rounded bg-gray-800 text-gray-300 disabled:opacity-40"
      >
        ←
      </button>
      <span className="text-gray-400">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-3 py-1 rounded bg-gray-800 text-gray-300 disabled:opacity-40"
      >
        →
      </button>
    </div>
  );
}
```

- 페이지가 1개면 UI 자체를 숨김 (총 매치 < 20 케이스).
- FR-08: `onChange` 래퍼에서 `setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' })` 적용 (P2).

### 3.5 렌더 변경

- `filteredMatches.map(...)` → `visibleMatches.map(...)`
- Match count 표시: `"Set 17 — 27게임 (페이지 1 / 2)"` 형태로 FR-07 반영.
- 하단에 `<PaginationBar ... />` 배치.

---

## 4. 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `src/app/api/lookup/route.ts` | 수정 | 20 → 60 (2 곳) |
| `src/app/lookup/page.tsx` | 수정 | page state + PaginationBar + 자동 analyze 범위 축소 |

총 변경 규모 예상: 약 +40 / −5 라인.

---

## 5. 테스트 계획

### 5.1 데이터 검증

- [ ] 신규 puuid 검색 → Riot 에서 60개까지 fetch, Supabase 저장 확인
- [ ] 기존 puuid 재검색 → DB에서 60개까지 반환, Riot 추가 호출 없음 (기존 캐싱 유지)

### 5.2 UI/UX

- [ ] 60개 매치 케이스 → 페이지 수 3, 이전/다음 동작
- [ ] 1페이지에서 `←` 비활성, 마지막 페이지에서 `→` 비활성
- [ ] 시즌 탭 전환 → 페이지 1로 리셋
- [ ] 새 검색 → 페이지 1로 리셋
- [ ] 매치 < 20 → `PaginationBar` 노출 안 됨
- [ ] 매치 == 0 (해당 시즌 없음) → 기존 빈 상태 메시지 유지

### 5.3 성능/분석

- [ ] 페이지 전환 시 새 페이지 20개에 대해서만 analyze 로그 발생
- [ ] 이전 페이지로 돌아가면 재분석 없이 기존 결과 복원 (`analysisResults` Map 유지)

### 5.4 회귀

- [ ] 가상 대전 분석 링크 동작 (`/lookup/{matchId}/analysis?puuid=...`) 이전과 동일
- [ ] `MatchCard` expand, 참가자 뷰, 플레이어 검색 점프 모두 정상

### 5.5 빌드

- [ ] `pnpm lint && pnpm typecheck && pnpm build` 전부 통과

---

## 6. 대안 검토

| 대안 | 장점 | 단점 | 선택 이유 |
|------|------|------|----------|
| **A. 서버 사이드 페이지네이션** (`start`, `limit` 쿼리) | 대용량 시 확장성 | API 호출 증가, UI 페이지 전환마다 네트워크 왕복 | 60개 범위에서는 오버엔지니어링 |
| **B. 무한 스크롤** | 스크롤 1회로 OK | 위치 감각 없음, 시즌 탭과 궁합 나쁨 | UX 혼란 |
| **C. 클라이언트 사이드 slice** ✅ | 구현 최소, 페이지 이동 즉시, 분석 캐싱 유지 | 최대 매치 수 제한(60) | **선택** — 이번 범위에 적합 |

---

## 7. 범위 외

- Riot 매치 수 60개 초과 확장 (필요 시 별도 feature: `lookup-infinite-history`).
- 정렬 옵션(등수순/날짜순) 추가 — 현재 최신순 고정.
- 페이지 번호 URL 쿼리 연동 (`?page=2`) — 공유/뒤로가기 UX는 별도 작업.
- 모바일 레이아웃 튜닝 (기존 tailwind 유지).
