# Plan: 전적검색 개선 (비아바이엔 아이콘 + 툴팁 + 코스트 색상)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 전적검색 개선 (아이콘/툴팁/코스트 색상) |
| 작성일 | 2026-04-17 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 비아와 바이엔이 전적검색에서 이미지 없이 깨짐. 챔피언 코스트별 색상 구분 없음. hover 시 설명 없음 |
| **Solution** | 비아바이엔 아이콘 로컬 저장 + 코스트별 border 색상 + 챔피언/아이템/시너지 hover 툴팁 |
| **Function UX Effect** | 전적 카드에서 모든 유닛이 정상 표시되고, 코스트로 가치 파악, hover로 상세 정보 확인 |
| **Core Value** | 전적검색의 정보 밀도와 사용성 향상 |

---

## 1. 기능 A: 비아와 바이엔 아이콘 로컬 저장

### 1.1 데이터

- apiName: `TFT17_Summon`
- CommunityDragon: `https://raw.communitydragon.org/latest/game/assets/characters/tft17_summon/hud/tft17_summon_square.tft_set17.png`
- 로컬 저장 경로: `public/data/images/tft_set17_champions/summon_square.tft_set17.png`
- `getChampionImage('TFT17_Summon')` → `/data/images/tft_set17_champions/summon_square.tft_set17.png` — 기존 규칙대로 자동 매핑됨

### 1.2 작업

1. CommunityDragon에서 이미지 다운로드 → `public/data/images/tft_set17_champions/` 저장
2. 끝. 추가 코드 변경 없음.

---

## 2. 기능 B: 챔피언 코스트별 border 색상

### 2.1 현재 상태

전적검색에서 챔피언 border가 성급(tier)으로만 결정됨:
- 1성: gray-600, 2성: gray-400, 3성: yellow-500

### 2.2 목표

코스트별 border 색상 적용 (기존 `COST_COLORS` 활용):

| cost | 색상 | hex |
|------|------|-----|
| 1 | gray | #9ca3af |
| 2 | green | #22c55e |
| 3 | blue | #3b82f6 |
| 4 | purple | #a855f7 |
| 5 | gold | #f59e0b |

3성 챔피언은 코스트 색상 위에 **golden glow** 효과 추가로 구분.

### 2.3 문제: 코스트 데이터 부재

현재 Riot API 매치 데이터에 `character_id`와 `tier`만 있고 **cost는 없음**.
→ `tft_set17_champions.json`에서 apiName→cost 매핑 필요.
→ API 응답의 `traitMeta`처럼 `championMeta`를 추가하거나, 프론트에서 JSON 로드.

**접근**: API 응답에 `championMeta` 추가 (apiName→{name, cost}).

---

## 3. 기능 C: hover 툴팁

### 3.1 범위

| 대상 | hover 시 표시 내용 | 데이터 소스 |
|------|-------------------|------------|
| 챔피언 아이콘 | 한글 이름 + 코스트 + 시너지 목록 | `championMeta` |
| 아이템 이미지 | 한글 이름 + 설명 | `itemMeta` (새로 추가) |
| 시너지 아이콘 | 한글 이름 + 활성 단계 설명 | `traitMeta` (이미 있음, desc 추가) |

### 3.2 구현 방식

HTML `title` 속성 — 가장 단순. 커스텀 툴팁 컴포넌트 대비 구현 비용 0에 가까움.
단, 스타일링 불가하고 모바일에서 동작 안 함.

**커스텀 툴팁**: absolute positioned div, mouse enter/leave로 토글.
전적검색 수준에서는 `title`로 충분. 향후 필요 시 커스텀으로 업그레이드.

→ **1차: `title` 속성 사용. 필요 시 커스텀으로 전환.**

### 3.3 API 응답 확장

```ts
// 기존 traitMeta에 desc 추가
traitMeta: {
  "TFT17_ASTrait": { name: "도전자", icon: "...", isUnique: false, desc: "도전자는..." }
}

// 새로 추가
championMeta: {
  "TFT17_Jinx": { name: "징크스", cost: 2, traits: ["우주 그루브", "건 슬링어"] }
}

itemMeta: {
  "TFT_Item_InfinityEdge": { name: "무한의 대검", desc: "주문력 +20..." }
}
```

---

## 4. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | 비아바이엔 이미지 다운로드 | `public/data/images/tft_set17_champions/` |
| 2 | API route에 championMeta/itemMeta 추가 | `src/app/api/lookup/route.ts` |
| 3 | traitMeta에 desc 필드 추가 | `src/app/api/lookup/route.ts` |
| 4 | lookup 페이지 — 코스트별 border 색상 | `src/app/lookup/page.tsx` |
| 5 | lookup 페이지 — title 툴팁 추가 | `src/app/lookup/page.tsx` |
| 6 | lint/typecheck/build | - |

---

## 5. MVP 제외 항목

- 커스텀 스타일링 툴팁 (1차는 title 속성)
- 아이템 상세 스탯 표시
- 챔피언 클릭 시 상세 팝업
