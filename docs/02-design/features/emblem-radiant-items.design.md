# Design: 상징 & 찬란 아이템 추가 (Emblem & Radiant Items)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 상징 & 찬란 아이템 시스템 |
| Plan 참조 | `docs/01-plan/features/emblem-radiant-items.plan.md` |
| 작성일 | 2026-03-16 |

| 관점 | 내용 |
|------|------|
| **Problem** | 상징(22개) / 찬란(10개) 아이템 누락 → lolchess.gg 대비 불완전한 아이템 목록 |
| **Solution** | CDragon 데이터/아이콘 추출 + ItemCategory 확장 + UI 탭 추가 |
| **Function UX Effect** | 사이드바/모달에 상징·찬란 탭 추가, 찬란 아이템 보라색 테두리 구분 |
| **Core Value** | lolchess.gg와 동일한 7개 카테고리 완성 |

---

## 1. 데이터 추가

### 1.1 상징 아이템 22개 → `tft_set16_items.json`

스크립트로 `raw-data/tft_ko_kr.json`에서 `TFT16_Item_*EmblemItem` 22개 추출 후 추가.

**아이콘 다운로드**: CommunityDragon → `public/data/images/emblems/`
```
https://raw.communitydragon.org/latest/game/assets/ux/traiticons/{filename}.png
```
아이콘 파일명: `tft16_emblem_*.tft_set16.png` (22개)

### 1.2 찬란(Corrupted) 아이템 10개 → 숨김 해제

현재 `isCorruptedItem()`으로 숨김 중 → 함수 제거하고 `'radiant'` 카테고리로 분류.
찬란 아이템은 **이름에 "(찬란)" 접미사** 추가하여 일반 아이템과 구분.

---

## 2. 타입 변경

### 2.1 `ItemCategory` 확장

**파일**: `src/types/index.ts`

```typescript
export type ItemCategory =
  | 'component'    // 조합재료
  | 'combined'     // 완성템
  | 'artifact'     // 유물
  | 'emblem'       // 상징 (NEW)
  | 'radiant'      // 찬란 (NEW)
  | 'piltover'     // 필트오버 모듈
  | 'bilgewater'   // 빌지워터
  | 'void'         // 공허 돌연변이
  | 'darkin'       // 다르킨
  | 'special';     // 특수
```

### 2.2 사이드바 필터 타입 확장

**파일**: `src/app/simulator/page.tsx`

```typescript
// 기존
const [itemCategoryFilter, setItemCategoryFilter] =
  useState<'all' | 'component' | 'combined' | 'artifact'>('all');

// 변경
const [itemCategoryFilter, setItemCategoryFilter] =
  useState<'all' | 'component' | 'combined' | 'artifact' | 'emblem' | 'radiant'>('all');
```

---

## 3. 카테고리 분류 로직

### 3.1 `getItemCategory` 확장

**파일**: `src/lib/simulator/systems/item.ts`

```typescript
export function getItemCategory(item: RawItem): ItemCategory {
  if (isArtifact(item)) return 'artifact';
  if (item.apiName.includes('EmblemItem')) return 'emblem';       // NEW
  if (item.apiName.includes('Corrupted')) return 'radiant';       // NEW
  if (item.apiName.includes('Consumable_Void')) return 'void';
  if (item.apiName.includes('TheDarkin')) return 'darkin';
  if (isBaseComponent(item)) return 'component';
  if (isCombinedItem(item)) return 'combined';
  if (item.apiName.includes('Piltover')) return 'piltover';
  if (item.apiName.includes('Bilgewater')) return 'bilgewater';
  return 'special';
}
```

### 3.2 `isCorruptedItem` 제거 + `isDisabledItem` 수정

Corrupted 아이템을 더 이상 숨기지 않으므로 `isCorruptedItem` 제거.
`isDisabledItem`에서 Corrupted 체크 제거.

```typescript
// 제거
// export function isCorruptedItem(item: RawItem): boolean { ... }

// 수정
export function isDisabledItem(item: RawItem): boolean {
  return DISABLED_ITEMS.has(item.apiName);
  // isCorruptedItem 호출 제거
}
```

---

## 4. 장착 규칙

### 4.1 `canEquipItem` 확장

```typescript
// 상징 → 일반 아이템 슬롯 사용, 제한 없음
// (시너지 부여는 별도 feature)

// 찬란 → 챔피언당 1개만
if (category === 'radiant') {
  const hasRadiant = champion.items.some(i => getItemCategory(i) === 'radiant');
  if (hasRadiant) {
    return { canEquip: false, reason: '찬란 아이템은 챔피언당 1개만 장착 가능합니다' };
  }
}
```

---

## 5. 이미지 경로

### 5.1 `imageMap.ts` 상징 경로 추가

```typescript
function resolveItemPath(apiName: string, iconFilename: string): string {
  // Emblem items
  if (apiName.includes('EmblemItem')) {
    return `/data/images/emblems/${iconFilename}`;
  }
  // ... 기존 로직
}
```

### 5.2 찬란 아이템 아이콘

Corrupted 아이템 아이콘은 `TFT_Item_*.TFT_Set13.tex` 형식 → 기존 `items/` 디렉토리에서 해결.
별도 다운로드 불필요 (이미 완성템 아이콘과 동일 경로).

---

## 6. UI 변경

### 6.1 사이드바 아이템 필터 버튼

**파일**: `src/app/simulator/page.tsx`

```typescript
// 기존
{ key: 'all', label: '전체' },
{ key: 'combined', label: '완성' },
{ key: 'artifact', label: '유물' },
{ key: 'component', label: '조합' },

// 변경
{ key: 'all', label: '전체' },
{ key: 'combined', label: '완성' },
{ key: 'artifact', label: '유물' },
{ key: 'radiant', label: '찬란' },
{ key: 'emblem', label: '상징' },
{ key: 'component', label: '조합' },
```

### 6.2 `ItemGrid.tsx` 모달 탭 확장

동일한 패턴으로 탭 추가.

### 6.3 찬란 아이템 시각적 구분

`ItemIcon.tsx`에서 찬란 아이템 테두리를 **보라색 그래디언트**로 표시:
```typescript
const isRadiant = item.apiName.includes('Corrupted');
const borderClass = isRadiant ? 'border-fuchsia-500' : isArtifact ? 'border-purple-500' : ...;
```

---

## 7. 구현 순서

| 순서 | 작업 | 파일 |
|:----:|------|------|
| 1 | CommunityDragon에서 상징 아이콘 22개 다운로드 | `public/data/images/emblems/` |
| 2 | `tft_set16_items.json`에 상징 22개 + 찬란 이름 수정 | `public/data/` |
| 3 | `ItemCategory`에 `'emblem'`, `'radiant'` 추가 | `types/index.ts` |
| 4 | `getItemCategory` 확장, `isCorruptedItem` 제거 | `systems/item.ts` |
| 5 | `canEquipItem`에 찬란 1개 제한 추가 | `systems/item.ts` |
| 6 | `imageMap.ts`에 상징 경로 추가 | `data/imageMap.ts` |
| 7 | 사이드바 + ItemGrid 탭 추가 | `page.tsx`, `ItemGrid.tsx` |
| 8 | `ItemIcon.tsx` 찬란 테두리 구분 | `builder/ItemIcon.tsx` |
| 9 | `pnpm typecheck && pnpm build` | — |
