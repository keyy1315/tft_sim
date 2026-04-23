# Plan: 전적검색 비주얼 업그레이드 (챔피언/아이템/시너지)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 전적검색 챔피언/아이템/시너지 비주얼 업그레이드 |
| 작성일 | 2026-04-17 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 매치 카드에서 챔피언이 텍스트로만 표시, 아이템/시너지 정보 없음 → 한눈에 덱 파악 불가 |
| **Solution** | 챔피언 아이콘 + 성급 별 + 아이템 이미지 + 시너지 아이콘(티어 색상)을 매치 카드에 렌더링 |
| **Function UX Effect** | 매치 카드만 보면 덱 구성(챔피언/성급/아이템)과 활성 시너지를 즉시 파악 |
| **Core Value** | lolchess.gg 수준의 시각적 전적 분석 경험 |

---

## 1. 현재 상태 분석

### 1.1 현재 매치 카드

```
┌────────────────────────────────────────┐
│ #1  랭크  32분 14초 · 2시간 전          │
│                                        │
│ [Jinx] [Ezreal★★] [Caitlyn★★★]  ...  │  ← 텍스트 뱃지
└────────────────────────────────────────┘
```

**문제점:**
1. 챔피언이 **텍스트 이름**으로만 표시 → TFT 유저는 아이콘으로 인식
2. **아이템 정보 없음** → 어떤 아이템을 줬는지 알 수 없음
3. **성급(별)이 텍스트 ★** → 시각적으로 약함
4. **시너지 정보 없음** → 어떤 시너지를 활성화했는지 알 수 없음

### 1.2 기존 인프라

| 리소스 | 경로 | 상태 |
|--------|------|------|
| `getChampionImage(apiName)` | `src/data/imageMap.ts:7` | 구현됨 |
| `getItemImage(apiName)` | `src/data/imageMap.ts:99` | 구현됨 |
| `getTraitImage(apiName)` | `src/data/imageMap.ts:147` | 구현됨 (캐시 기반) |
| 챔피언 이미지 | `public/data/images/tft_set17_champions/` | 65개 |
| 시너지 이미지 | `public/data/images/traits/trait_icon_17_*.png` | 40개+ |
| 아이템 이미지 | `public/data/common/images/combined/` 등 | 있음 |
| 시너지 JSON | `public/data/tft_set17_traits.json` | apiName↔icon 매핑 |

### 1.3 데이터 흐름 변경 필요

현재 `riot.ts`에서 trait의 `style` 필드를 파싱하지 않고 있고, DB `matches` 테이블에 `traits` 컬럼이 없음.

---

## 2. 목표 UI

### 2.1 목표 매치 카드 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│ #1  랭크  32분 14초 · 2시간 전                            │
│                                                         │
│ 시너지: [🔶도전자4] [🔷스나이퍼2] [⬡메카1]  ...          │  ← 시너지 (아이콘+티어색)
│                                                         │
│   ★★★      ★★       ★        ★★      ...              │  ← 성급 (상단)
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│  │ 챔프 │ │ 챔프 │ │ 챔프 │ │ 챔프 │                   │  ← 챔피언 아이콘
│  │ icon │ │ icon │ │ icon │ │ icon │                   │
│  └──────┘ └──────┘ └──────┘ └──────┘                   │
│  [아1][아2] [아1]    [아1][아2][아3]                      │  ← 아이템 (하단)
└─────────────────────────────────────────────────────────┘
```

### 2.2 챔피언 디자인 스펙

| 요소 | 크기 | 비고 |
|------|------|------|
| 챔피언 아이콘 | 40x40px | rounded, 성급에 따른 border 색상 |
| 성급 별 | 상단 중앙 정렬 | 1성: 없음, 2성: ★★, 3성: ★★★ (금색) |
| 아이템 아이콘 | 16x16px | 챔피언 하단, 최대 3개 가로 배치 |
| 챔피언 간격 | gap 8px | flex wrap |

### 2.3 성급별 스타일

| 성급 | 별 표시 | 챔피언 border |
|------|---------|--------------|
| 1성 | 없음 | gray-600 |
| 2성 | ★★ (gray-300) | gray-400 |
| 3성 | ★★★ (yellow-400) | yellow-500 |

### 2.4 시너지 티어별 스타일

Riot API `style` 필드 값 → 시너지 표시 색상:

| style 값 | 티어 | 아이콘 배경/border | 텍스트 색상 |
|-----------|------|-------------------|------------|
| 0 | 비활성 | 표시하지 않음 (숨김) | - |
| 1 | 브론즈 | border-amber-700, bg-amber-900/30 | text-amber-600 |
| 2 | 실버 | border-gray-300, bg-gray-400/20 | text-gray-300 |
| 3 | 골드 | border-yellow-400, bg-yellow-500/20 | text-yellow-400 |
| 4 | 프리즘 | border-fuchsia-300, bg-gradient rainbow | text-white |
| - | 고유 (effects=1) | border-orange-400, bg-orange-500/20 | text-orange-400 |

**고유 시너지 판별**: `tft_set17_traits.json`에서 `effects` 배열 길이가 1인 시너지 = 고유 특성.
활성화 시 style=3(골드)로 오지만, 고유 시너지는 주황색으로 표시.

### 2.5 ���너지 배치

- 활성화된 시너지만 표시 (style >= 1)
- 높은 티어 순으로 정렬 (프리즘 > 골드/고유 > 실버 > 브론즈)
- 시너지 아이콘 20x20px + `num_units` 수 표시
- 챔피언 영역 위에 한 줄로 배치, flex wrap 허용

---

## 3. 구현 범위

### 3.1 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/riot.ts` | trait에 `style` 필드 추가, `ParsedMatch`에 `traits` 추가 |
| `src/app/api/lookup/route.ts` | traits를 DB에 저장 |
| `src/app/lookup/page.tsx` | 챔피언/아이템/시너지 비주얼 렌더링 |

### 3.2 DB 변경

```sql
ALTER TABLE matches ADD COLUMN set_id text DEFAULT 'set17';
ALTER TABLE matches ADD COLUMN traits jsonb DEFAULT '[]';
```

- `set_id`: 시즌 구분 컬럼. 매치 ID에서 세트 번호를 파싱하거나 현재 활성 세트를 기본값으로 저장. 향후 시즌별 필터링에 활용.

traits 저장 형식:
```json
[
  { "name": "TFT17_ASTrait", "numUnits": 4, "style": 3, "tierCurrent": 2 }
]
```

### 3.3 시너지 이미지 매핑

Riot API trait `name` (예: `TFT17_ASTrait`) → `getTraitImage()` 사용.
단, `getTraitImage()`는 `registerTraitImages()` 호출 후에만 캐시가 채워지므로,
lookup 페이지에서는 trait JSON을 로드하여 apiName→icon 매핑을 직접 구축하거나
fallback 경로를 사용.

**접근 방식**: traits JSON에서 `apiName`→`icon` 매핑 테이블을 API 응답에 포함하거나,
프론트에서 traits JSON을 로드하여 `registerTraitImages()` 호출.

### 3.4 데이터 매핑 요약

| 소스 | 변환 | UI |
|------|------|-----|
| `champion.id` (TFT17_Jinx) | `getChampionImage()` | 챔피언 아이콘 |
| `champion.tier` (1/2/3) | tier별 스타일 | 별 + border 색상 |
| `champion.items` ([apiName...]) | `getItemImage()` | 아이템 아이콘 |
| `trait.name` (TFT17_ASTrait) | `getTraitImage()` | 시너지 아이콘 |
| `trait.style` (0-4) | 티어 색상 매핑 | 아이콘 border/bg |
| `trait.numUnits` | 숫자 표시 | 시너지 옆 유닛 수 |

### 3.5 고려사항

- **이미지 로딩 실패**: `onError`로 fallback 처리 (텍스트)
- **고유 시너지 판별**: traits JSON에서 effects 길이 1인 apiName 목록을 미리 구축
- **반응형**: 모바일에서 챔피언 32x32, 시너지 16x16으로 축소

---

## 4. MVP 제외 항목

- 챔피언/시너지 클릭 시 상세 팝업
- 아이템/시너지 툴팁
- 시너지별 챔피언 하이라이트
