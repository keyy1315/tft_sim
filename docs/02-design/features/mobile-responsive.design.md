# mobile-responsive Design Document

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 모바일 반응형 레이아웃 |
| 작성일 | 2026-03-17 |
| Plan 문서 | `docs/01-plan/features/mobile-responsive.plan.md` |

### Value Delivered

| 관점 | 내용 |
|------|------|
| Problem | 390px 모바일에서 3컬럼(w-52 \| flex-1 \| w-64) 레이아웃이 완전히 깨짐 |
| Solution | Tailwind CSS `lg:` 브레이크포인트 기반 반응형 + CSS transform scale 보드 축소 |
| Function UX Effect | 모바일/태블릿에서 세로 스택 레이아웃, 보드 축소, 아코디언 패널로 사용 가능 |
| Core Value | 모바일 유저도 시뮬레이터를 불편 없이 사용 가능 |

---

## 1. 반응형 전략

### 1.1 브레이크포인트 정의

| 범위 | Tailwind 접두사 | 대상 디바이스 |
|------|----------------|--------------|
| < 640px | (기본) | iPhone 14 (390px), Galaxy S series |
| 640px ~ 1023px | `sm:` | iPad Mini, 태블릿 세로 |
| >= 1024px | `lg:` | 데스크톱, 태블릿 가로 |

**원칙**: 기본 = 모바일, `lg:` = 데스크톱 (Mobile First)

### 1.2 접근 방식: Tailwind CSS Only
- JS 기반 `useMediaQuery` 사용하지 않음
- `lg:` 프리픽스로 모든 레이아웃 분기
- uiSlice 확장 불필요

---

## 2. 수정 대상 파일 및 변경 상세

### 2.1 `src/app/simulator/page.tsx` (핵심)

#### Setup 모드 레이아웃
```
현재: flex gap-3 → [w-52 시너지] [flex-1 보드] [w-64 풀]
변경: flex flex-col lg:flex-row gap-3
  order-1: 보드 + 증강 (모바일 최상단, lg:order-2 lg:flex-1)
  order-2: SelectedUnitPanel (lg:hidden, 보드 바로 아래)
  order-3: 시너지 패널들 (lg:order-1 lg:w-52)
  order-4: 챔피언/아이템 풀 (lg:order-3 lg:w-64)
```

#### 보드 스케일링
- wrapper div: `h-[310px] sm:h-[420px] lg:h-auto overflow-hidden`
- 내부 div: `transform scale-[0.48] sm:scale-[0.65] lg:scale-100 origin-top`
- dnd-kit PointerSensor는 CSS transform을 자동 보정

#### 헤더 반응형
```
flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between
버튼: px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-xs
```

#### 리플레이 모드
```
flex flex-col lg:flex-row gap-3 lg:gap-4
보드: 동일 scale wrapper 적용
유닛 디테일: w-full lg:w-56
```

#### Setup 결과 요약
```
grid grid-cols-1 sm:grid-cols-2 gap-4
```

### 2.2 `src/app/layout.tsx`
- nav 로고: `text-base lg:text-lg`
- nav 링크: `px-2 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm`
- "시뮬레이터" 텍스트: `hidden sm:inline` (모바일에서 줄임)
- main 패딩: `px-2 py-3 lg:px-4 lg:py-6`

### 2.3 `src/components/builder/SynergyPanel.tsx`
- 아코디언 토글 버튼 추가 (`lg:hidden`)
- `useState(false)` → 모바일에서 기본 접힘
- 콘텐츠: `collapsed ? 'hidden lg:block' : 'block'`

### 2.4 `src/components/builder/PiltoverModulePanel.tsx`
- SynergyPanel과 동일한 아코디언 패턴 적용

### 2.5 `src/components/builder/ChampionGrid.tsx`
- grid: `grid-cols-4 sm:grid-cols-6 lg:grid-cols-8`

### 2.6 `src/components/builder/ItemGrid.tsx`
- grid: `grid-cols-5 sm:grid-cols-6 lg:grid-cols-8`

### 2.7 `src/components/battle/BattleControls.tsx`
- 시간 표시: `min-w-[70px] lg:min-w-[100px]`
- 속도 버튼 영역: `min-w-[70px] lg:min-w-[100px]`

### 2.8 `src/components/builder/AugmentSlots.tsx`
- 슬롯 크기: `w-10 h-10 lg:w-14 lg:h-14`
- 아이콘 SVG: `w-4 h-4 lg:w-5 lg:h-5`

### 2.9 `src/components/ui/Modal.tsx`
- 모바일 여백: `mx-2 lg:mx-4`
- 최대 높이: `max-h-[90vh] lg:max-h-[80vh]`
- 패딩 축소: `px-4 py-3 lg:px-6 lg:py-4`

---

## 3. 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| CSS transform + dnd-kit 좌표 호환 | PointerSensor가 CSS transform 자동 보정. 문제 시 `DndContext` measuring 옵션 추가 |
| SelectedUnitPanel 이중 렌더링 | 모바일용은 `lg:hidden`, 데스크톱용은 기존 위치 유지. 조건부 렌더링으로 성능 영향 없음 |
| 보드 축소 시 터치 타겟 | scale-[0.48]에서도 hex 셀이 최소 30px 유지 (원래 64px → ~31px) |

---

## 4. 검증 기준

1. Chrome DevTools: iPhone 14 (390x844), iPad (768x1024) 뷰포트
2. 보드 잘림 없이 scale 적용 확인
3. 1280px 이상에서 기존 3컬럼 레이아웃 유지 (회귀 테스트)
4. `pnpm lint && pnpm typecheck && pnpm build` 통과
