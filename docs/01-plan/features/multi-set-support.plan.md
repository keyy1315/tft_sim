# Plan: 멀티 세트 지원 — Set 17 팀 빌더 + 헤더 시즌 선택

## Executive Summary

| 관점 | 설명 |
|------|------|
| Problem | 모든 코드에 `set16`이 하드코딩되어 있어 Set 17 데이터를 사용할 수 없고, 시즌 전환이 불가능 |
| Solution | 데이터 로더/이미지 경로를 세트 파라미터화하고, 헤더에 시즌 셀렉터를 추가하여 Set 16/17 전환 |
| Function UX Effect | 헤더에서 시즌을 선택하면 챔피언/아이템/시너지가 해당 세트로 전환됨 |
| Core Value | 새 시즌 출시마다 JSON 데이터만 추가하면 바로 지원 가능한 확장 가능 구조 |

---

## 1. 현재 하드코딩 현황

| 파일 | 하드코딩 내용 |
|------|-------------|
| `src/data/loader.ts` | `/data/tft_set16_*.json` 5곳 |
| `src/data/imageMap.ts` | `tft_set16_champions/`, `.tft_set16.png`, `TFT16_` prefix |
| `src/hooks/useGameData.ts` | 세트 파라미터 없음 |
| `src/app/layout.tsx` | `Set 16` 타이틀/네비 |
| `src/app/page.tsx` | `Set 16` + 하드코딩된 챔피언 수 |
| `src/app/api/metadata/route.ts` | `Set 16` + `readFileSync` 경로 |
| `src/components/builder/SynergyPanel.tsx` | `tft_set16_piltover/` 경로 |

---

## 2. 설계 방향

### 2.1 세트 설정 상태 관리

**Zustand `uiSlice`에 `activeSet` 추가** (기존 슬라이스 활용):

```ts
activeSet: 'set16' | 'set17'
setActiveSet: (set: string) => void
```

- 기본값: `'set16'` (현재 완성된 세트)
- URL 파라미터 불필요 — 단일 페이지 내에서 전환

### 2.2 데이터 로더 파라미터화

`loader.ts`의 모든 fetch 함수에 `setId` 파라미터 추가:

```ts
// Before
export async function loadChampions(): Promise<RawChampion[]>

// After
export async function loadChampions(setId: string = 'set16'): Promise<RawChampion[]>
```

- 캐시: `Map<string, RawChampion[]>` (세트별 캐싱)
- fetch URL: `/data/tft_${setId}_champions.json`

### 2.3 이미지 경로 파라미터화

`imageMap.ts` 함수에 `setNum` 파라미터 추가:

```ts
export function getChampionImage(apiName: string, setNum: number = 16): string
```

- 디렉토리: `/data/images/tft_set${setNum}_champions/`
- 파일 접미사: `.tft_set${setNum}.png`
- `TFT${setNum}_` prefix 변환

### 2.4 헤더 시즌 셀렉터

`layout.tsx` 네비게이션에 드롭다운/토글 추가:

```
[TFT] [Set 16 ▾] [시뮬레이터]
              └─ Set 16 (현재 시즌)
                 Set 17 (PBE)
```

- 클릭 시 `uiSlice.setActiveSet()` 호출
- Set 17 선택 시 `(PBE)` 라벨 표시 (스탯 미완성 경고)

### 2.5 `useGameData` 훅 확장

```ts
export function useGameData(setId?: string) {
  // setId가 없으면 uiSlice.activeSet 사용
  const activeSet = setId ?? useStore(s => s.activeSet);
  // ...loadChampions(activeSet) 등
}
```

---

## 3. 세트 설정 정보

| 세트 | 파일 prefix | API prefix | 이미지 디렉토리 | 상태 |
|------|------------|------------|----------------|------|
| Set 16 | `tft_set16_` | `TFT16_` | `tft_set16_champions/` | 완성 |
| Set 17 | `tft_set17_` | `TFT17_` | `tft_set17_champions/` | PBE (스탯 미완성) |

### Set 17 데이터 파일 현황

| 파일 | 상태 |
|------|------|
| `tmp_tft_set17_champions.json` | 있음 (63챔, 스탯 placeholder) |
| `tft_set17_items.json` | 없음 — PBE 후 추가 필요 |
| `tft_set17_traits.json` | 없음 — PBE 후 추가 필요 |
| `tft_set17_augments.json` | 없음 — PBE 후 추가 필요 |
| `tft_set17_teamplanner.json` | 없음 — PBE 후 추가 필요 |
| 이미지 (63개) | 있음 |

→ Set 17 선택 시 **챔피언만 표시 가능**, 나머지는 빈 상태로 표시 또는 "데이터 준비 중" 안내

---

## 4. 수정 파일 목록

| 순서 | 파일 | 변경 |
|------|------|------|
| 1 | `src/data/loader.ts` | fetch URL 파라미터화, 세트별 캐시 |
| 2 | `src/data/imageMap.ts` | `getChampionImage()`, `deriveItemPath()` 세트 파라미터 |
| 3 | `src/hooks/useGameData.ts` | `setId` 파라미터 전달 |
| 4 | `src/store/` (uiSlice) | `activeSet` / `setActiveSet` 추가 |
| 5 | `src/app/layout.tsx` | 세트 셀렉터 UI, 동적 타이틀 |
| 6 | `src/app/page.tsx` | 동적 세트명/챔피언 수 |
| 7 | `src/app/simulator/page.tsx` | `useGameData(activeSet)` 전달 |
| 8 | `src/app/builder/calculator/page.tsx` | 동일 |
| 9 | `src/app/api/metadata/route.ts` | 세트 쿼리 파라미터 |
| 10 | `src/components/builder/SynergyPanel.tsx` | 이미지 경로 파라미터화 |
| 11 | `public/data/` | `tmp_` prefix 제거 → `tft_set17_champions.json` |

---

## 5. 구현 순서

| 단계 | 작업 |
|------|------|
| 1 | `uiSlice`에 `activeSet` 상태 추가 |
| 2 | `loader.ts` 파라미터화 (세트별 캐시 + fetch URL) |
| 3 | `imageMap.ts` 파라미터화 |
| 4 | `useGameData` 훅에 세트 파라미터 연결 |
| 5 | `layout.tsx` 헤더에 세트 셀렉터 추가 |
| 6 | `page.tsx` (홈) 동적 세트 표시 |
| 7 | `tmp_tft_set17_champions.json` → `tft_set17_champions.json` 리네임 |
| 8 | 나머지 컴포넌트 이미지 경로 수정 |
| 9 | lint + typecheck + build |

---

## 6. Set 17 전환 시 제약사항

- **전투 시뮬레이션**: Set 17 챔피언 스탯이 0이라 전투 실행 불가 → "스탯 데이터가 없어 전투를 시작할 수 없습니다" 경고
- **아이템/시너지**: JSON 파일 미존재 → 빈 배열 반환, UI에서 "데이터 준비 중" 표시
- **팀 코드**: Set 17용 teamplanner 매핑 없음 → 기능 비활성화
- PBE 데이터 추가 시 위 제약 자동 해제

---

## 7. MVP 범위

**포함**:
- 헤더 세트 셀렉터 (Set 16 / Set 17)
- Set 17 선택 시 챔피언 목록 표시 (이미지 포함)
- 데이터 로더/이미지 경로 멀티세트 구조

**제외 (PBE 후)**:
- Set 17 전투 시뮬레이션 (스탯 필요)
- Set 17 아이템/시너지/증강 (JSON 필요)
- Set 17 전용 시너지 엔진 로직
