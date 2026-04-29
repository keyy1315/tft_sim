# Mobile / Tablet Simulator 재설계 Spec

**작성일**: 2026-04-22
**작성자**: Dayoung (with Claude)
**상태**: Draft — 사용자 리뷰 대기
**관련 PR**: TBD

---

## 1. 배경 및 문제 정의

전투 시뮬레이션 탭(`/simulator`)이 `lg` (≥1024px) 에서는 3-컬럼 레이아웃으로 잘 동작하지만, 그 미만 뷰포트에서는 사용성이 떨어진다. 사용자가 브레인스토밍 중 직접 선택한 pain point 는 다음 6가지:

| 코드 | 문제 | 원인 |
|------|------|------|
| A | 끝없는 세로 스크롤 | 보드 → 선택 유닛 → 시너지 2개 → 필트오버 2개 → 풀 — 모든 패널이 세로 스택 |
| B | 보드 축소로 인한 빈 공간 / 작은 헥스 | `transform: scale(0.5~0.65)` + 고정 높이 `h-[320/420px]` 로 여백 낭비 |
| C | 태블릿 최적화 부재 | `md:` breakpoint 미사용 — 640~1023px 구간이 모바일 레이아웃 그대로 |
| D | 풀 → 보드 드래그가 불편 | 챔피언/아이템 풀이 보드 아래에 있어 드래그하면서 스크롤 필요 |
| F | 헤더 버튼이 너무 빽빽 | 초기화·팀코드·Stage·시작·100회 가 좁은 화면에서 줄바꿈되어 지저분 |
| H | 리플레이 모드 답답 | 보드 + 데미지 사이드바 + 로그가 세로로 쌓여 동시 파악 어려움 |

**비-타깃**: E(터치 타겟 크기), G(시너지 패널 장황함) — 사용자가 명시적으로 우선순위에서 제외.

---

## 2. 해결 방향

### 2.1 선택된 전략: **보드 중심 + 바텀 시트 (모바일) / 2-컬럼 (태블릿)**

브레인스토밍 단계에서 비교한 3개 옵션 (A: 보드 + 바텀 시트 / B: 컴팩트 리니어 / C: 모드별 탭) 중 **A + 태블릿은 2-컬럼 하이브리드** 채택.

**채택 이유**:
- B(컴팩트)는 근본 원인(정보량 과다)을 해소하지 못함
- C(탭)는 드래그-드롭 중심 UX 와 궁합이 나쁨 — 풀 탭에서 보드 탭으로의 제스처 설계 난해
- A(바텀 시트)는 TFT 인게임 멘탈 모델(보드 중심 + 아래에 벤치/아이템)과 일치해 학습 비용 낮음
- 태블릿은 가로 공간이 충분하므로 모바일의 바텀 시트 대신 고정 사이드 패널이 더 효율적

### 2.2 Breakpoint 정의

```
sm (default) : < 768px      — 모바일 (지원 최소 360px)
md           : 768 ~ 1023px — 태블릿 (신규 도입)
lg           : ≥ 1024px     — 데스크톱 (현재 유지)
```

Tailwind 기본 `md:` 프리셋이 768px 라 config 변경 불필요.

---

## 3. 상위 레이아웃 설계

### 3.1 모바일 (< 768px)

```
┌─────────────────────────────────┐
│ 헤더: 제목 + ▶시작 + ⋯ 메뉴     │ ← 1줄 압축
├─────────────────────────────────┤
│ Board (헥스 36px, scale 제거)   │ ← 자연 크기, 너비 fit
│ + 증강 슬롯 (우상단 미니)       │
│ + 현재 틱 이벤트 60px 바 (리플레이)│
├─────────────────────────────────┤
│ [TEAM B 시너지 chip] [A chip]    │ ← 2-chip (탭하면 sheet 확장)
├─────────────────────────────────┤
│ ━━ 드래그 핸들 ━━               │
│ [챔피언 / 아이템 / 유닛 / 시너지] │ ← BottomSheet (3-state)
│ ... 탭별 콘텐츠 ...              │
└─────────────────────────────────┘
```

- 기본 상태: **peek** (56px, 탭만 보임)
- 중간 상태: **half** (42vh)
- 확장 상태: **full** (86vh)
- 드래그 시작 → 자동 peek
- 유닛 클릭 → 자동 half + 유닛 탭 활성

### 3.2 태블릿 (768~1023px)

```
┌─────────────────────────────────────┐
│ 헤더: 데스크톱과 동일 풀 노출       │
├─────────────────────────┬───────────┤
│                         │ [풀│시너지│유닛] 탭
│   Board (헥스 48px)     ├───────────┤
│                         │           │
│                         │ 탭 콘텐츠 │
├─────────────────────────┤           │
│ [B 증강] [A 증강]       │           │
└─────────────────────────┴───────────┘
       flex-2                flex-1
```

- 바텀 시트 없음. 우측 패널이 항상 보임
- `md:` breakpoint 에서만 렌더

### 3.3 데스크톱 (≥ 1024px)

현재 3-컬럼 레이아웃 유지. 단, 코드는 `SimulatorLayoutDesktop.tsx` 로 추출.

---

## 4. 컴포넌트 설계

### 4.1 신규 컴포넌트

#### `BottomSheet` — `src/components/ui/BottomSheet.tsx`

```ts
interface BottomSheetProps {
  state: 'peek' | 'half' | 'full';
  onStateChange: (s: 'peek' | 'half' | 'full') => void;
  tabs: { id: string; label: string; content: ReactNode; disabled?: boolean }[];
  activeTabId: string;
  onTabChange: (id: string) => void;
}
```

- 3단계 스냅 높이: **peek 56px / half 42vh / full 86vh**
- 상단 드래그 핸들 — native pointer/touch events 직접 사용 (dnd-kit sensor 와 분리)
- CSS `translateY` transform 기반 60fps 애니메이션
- Portal → `document.body`, `z-index: 2147483646` (hover tooltip 보다 한 단계 낮음)
- 모바일에서만 렌더 — 호출부에서 `useViewport() === 'mobile'` 체크

#### `OverflowMenu` — `src/components/ui/OverflowMenu.tsx`

```ts
interface OverflowMenuProps {
  items: { label: string; onClick: () => void; active?: boolean; disabled?: boolean }[];
  children?: ReactNode;  // Stage select 등 커스텀 컨트롤 슬롯
}
```

- 헤더 ⋯ 드롭다운. 외부 클릭 시 닫힘. 모바일 전용 사용.

#### `SynergyChip` — `src/components/builder/SynergyChip.tsx`

```ts
interface SynergyChipProps {
  team: 'player' | 'enemy';
  activeTraits: ActiveTrait[];
  onExpand: () => void;
}
```

- 모바일 보드 아래 좌우로 2개 렌더
- chip 내용: 활성 시너지 아이콘 + 발동 수 (예: 🛡️3 ⚔️2), 스타일 색상 표시
- 탭 → BottomSheet "시너지" 탭 활성화 + full 확장

#### `useViewport` — `src/hooks/useViewport.ts`

```ts
type Viewport = 'mobile' | 'tablet' | 'desktop';
export function useViewport(): Viewport;
```

- `useSyncExternalStore` + `window.matchMedia` 기반 — React Compiler 안전 (useEffect+setState 금지 규칙 준수)
- 기준: `< 768` mobile / `768~1023` tablet / `≥ 1024` desktop
- SSR safe — 초기값 'desktop', 하이드레이션 후 정확값

### 4.2 기존 컴포넌트 수정

| 컴포넌트 | 변경 |
|---------|------|
| `SetupBoard.tsx` | `cellSize` prop 추가 (default 56, mobile 36, tablet 48) |
| `ReplayBoard.tsx` | `cellSize` prop 추가 |
| `DroppableHexCell.tsx` | `cellSize` 기반 위치 계산 통일 |
| `src/app/simulator/page.tsx` | viewport 분기, `transform: scale()` 제거, 레이아웃 서브컴포넌트로 분리 |

`SynergyPanel` / `PiltoverModulePanel` 자체는 수정 불필요 — 그대로 재사용. 단 모바일 컨테이너 크기에서도 레이아웃 유효한지 수동 확인 필요.

### 4.3 파일 트리

```
src/
├── app/simulator/
│   ├── page.tsx                         [수정] ~200줄로 축소
│   └── layout/
│       ├── SimulatorLayoutMobile.tsx    [신규] ~300줄
│       ├── SimulatorLayoutTablet.tsx    [신규] ~250줄
│       ├── SimulatorLayoutDesktop.tsx   [신규] ~500줄 (기존 이관)
│       └── types.ts                     [신규] 공유 props 타입
├── components/
│   ├── ui/
│   │   ├── BottomSheet.tsx              [신규]
│   │   └── OverflowMenu.tsx             [신규]
│   ├── battle/
│   │   ├── SetupBoard.tsx               [수정] cellSize prop
│   │   ├── ReplayBoard.tsx              [수정] cellSize prop
│   │   └── DroppableHexCell.tsx         [수정] cellSize 연동
│   └── builder/
│       └── SynergyChip.tsx              [신규]
└── hooks/
    └── useViewport.ts                   [신규]
```

---

## 5. 상태 오너십

| 상태 | 오너 | 이유 |
|------|------|------|
| `viewport` | `page.tsx` (useViewport) | 레이아웃 분기 기준 |
| `sheetState` / `activeTabId` | `SimulatorLayoutMobile` 로컬 useState | 모바일 전용 |
| `tabletSideTab` | `SimulatorLayoutTablet` 로컬 useState | 태블릿 전용 |
| `champSearch` / `itemSearch` / `filters` | `page.tsx` (공유) | 뷰포트 전환 시 검색 상태 보존 |
| 팀 상태 / replay 상태 | 기존 훅 (`useTeamManagement`, `useReplayControls`) | 변경 없음 |

### 공유 Props 인터페이스 (`layout/types.ts`)

```ts
export interface SimulatorLayoutProps {
  tm: ReturnType<typeof useTeamManagement>;
  replay: ReturnType<typeof useReplayControls>;
  dnd: ReturnType<typeof useDndHandlers>;
  data: {
    champions: RawChampion[];
    items: RawItem[];
    traits: RawTrait[];
    augments: RawAugment[];
    teamPlannerMapping: TeamPlannerMapping[];
  };
  hexBuffs: {
    player: HexBuff[];
    enemy: HexBuff[];
    overrides: Record<string, Record<string, HexCoord>>;
    setOverrides: Dispatch<SetStateAction<Record<string, Record<string, HexCoord>>>>;
    moving: { team: 'player' | 'enemy'; apiName: string } | null;
    setMoving: Dispatch<SetStateAction<{ team: 'player' | 'enemy'; apiName: string } | null>>;
  };
  stageNumber: number;
  setStageNumber: (n: number) => void;
  isRunning: boolean;
  runSimulation: () => void;
  runMultiple: () => void;
  teamNames: { player: string | null; enemy: string | null };
  poolFilters: {
    champSearch: string; setChampSearch: (s: string) => void;
    champCostFilter: number | null; setChampCostFilter: (n: number | null) => void;
    itemSearch: string; setItemSearch: (s: string) => void;
    itemCategoryFilter: ItemFilterTab; setItemCategoryFilter: (f: ItemFilterTab) => void;
    activePoolTab: 'champions' | 'items' | 'bilgewater';
    setActivePoolTab: (t: 'champions' | 'items' | 'bilgewater') => void;
  };
}
```

---

## 6. 주요 상호작용 흐름

### 6.1 Flow 1 — 모바일 챔피언 드래그

1. 사용자가 bottom sheet 를 `half` 로 올림 (풀 탭 활성)
2. 챔피언 카드 롱프레스/드래그 시작 → dnd-kit `onDragStart` 발화
3. `DndContext onDragStart` 핸들러가 감지 → `sheetState` 를 `peek` 으로 setState (보드 풀스크린 노출)
4. 사용자가 원하는 헥스 셀로 드래그 → `DroppableHexCell` 에 드롭
5. `onDragEnd` → 기존 `handleDragEnd` 로 처리 (변경 없음)
6. 시트는 `peek` 상태 유지 — 사용자가 원하면 다시 올릴 수 있음

### 6.2 Flow 2 — 모바일 유닛 클릭 → 선택 유닛 상세

1. 사용자가 보드의 챔피언 셀 탭
2. `tm.handleUnitClick(team, index)` — 기존 로직 그대로
3. `SimulatorLayoutMobile` 의 cell click 핸들러에서 **직접** sheet 열기 (React Compiler 규칙 준수: useEffect 비교 금지)
   - `setSheetState('half')` + `setActiveTabId('unit')` 를 onUnitClick wrapper 안에서 호출
4. 사용자가 시트 드래그 핸들로 `full` 확장 가능 — 아이템 장착 등 작업

### 6.3 Flow 3 — 리플레이 모드 모바일 레이아웃

```
┌ 승리 배너 (컴팩트 1줄)
├ Battle Controls (재생/일시정지/속도)
├ ReplayBoard (헥스 36px, scale 없음)
├ 현재 틱 이벤트 (60px 고정 바)
└ BottomSheet [로그 | 데미지 | 유닛]
    • 로그 탭:  전투 로그 + 필터 (현재 로직 그대로)
    • 데미지 탭: DamageSidebar 를 시트 안에 임베드
    • 유닛 탭:  UnitDetailPanel (선택된 유닛 있을 때만 활성)
```

보드 유닛 클릭 → 유닛 탭 자동 선택 + sheet `half` 확장.

---

## 7. 변하지 않는 것

- **분석 페이지 핸드오프** (`sessionStorage 'analysis_handoff'`) — `page.tsx` 최상위 useEffect 그대로 유지
- **Hover 툴팁** (`position:fixed` portal + `positionHoverTooltipRef`) — z-index 는 sheet 보다 높게 유지
- **Modal** 들 (`ChampionGrid` / `AugmentSelector` / `MfModeSelector` / `AugmentDetailPopup`) — `page.tsx` 상위에서 렌더, 레이아웃 독립
- **DragOverlay** — `DndContext` 바로 아래, 레이아웃 분기 상위에 위치
- **시뮬레이션 엔진** — UI 변경과 완전 독립

---

## 8. 엣지 케이스

| 케이스 | 대응 |
|-------|------|
| 뷰포트 리사이즈 중 상태 보존 | 모바일↔태블릿 전환 시 레이아웃 로컬 state(sheetState, tabletSideTab)는 소실됨. `page.tsx` 에서 호출된 훅(`useTeamManagement`, `useReplayControls`) 의 상태 및 `page.tsx` 로컬 state(검색/필터)는 레이아웃 전환과 무관하게 유지됨 |
| 가상 키보드 (모바일 검색 포커스) | 풀 탭 검색바 `focus` 이벤트에서 sheet 를 `full` 로 전환. 키보드 높이로 인한 뷰포트 축소는 `window.visualViewport.resize` 리스너로 감지해 sheet 높이 재계산 (full=86vh 대신 visualViewport.height 기준 계산) |
| 드래그 중 시트 제스처 충돌 | dnd-kit `PointerSensor activationConstraint.distance: 8` + sheet 드래그 핸들에서만 시트 제스처 활성 — 보드/카드 터치는 간섭 없음 |
| hexBuff `movable` 이동 모드 | 모바일에서 이동 모드 진입 시 sheet 자동 `peek` (보드가 다 보여야 이동 가능) |
| 회전 (orientationchange) | `useViewport` 자동 감지, CSS transition 으로 smooth 전환 |

---

## 9. 구현 단계

6단계로 쪼개서 각 Phase 가 독립 shippable. 데스크톱 사용자는 Phase 2 이후 regression 없음.

### Phase 1 — Foundation (독립)
- `useViewport.ts`, `BottomSheet.tsx`, `OverflowMenu.tsx`
- 완료 조건: 단독 스토리 페이지 수동 확인, `pnpm lint && typecheck && build` 통과

### Phase 2 — Board cellSize prop (desktop 불변)
- `SetupBoard`/`ReplayBoard`/`DroppableHexCell` 에 cellSize prop 도입 (default 56)
- `page.tsx` 의 `transform: scale()` wrapper 제거
- 데스크톱 픽셀 동일 검증 (스크린샷 비교)
- 완료 조건: golden engine 테스트 영향 없음, 데스크톱 시각 regression 없음

### Phase 3 — Desktop 레이아웃 추출 (behavior 불변)
- 기존 3-column 로직 → `SimulatorLayoutDesktop.tsx` 로 이관
- `page.tsx` 는 `useViewport()` + 단일 라우팅 (mobile/tablet 도 임시로 desktop 레이아웃 렌더)
- 공용 props 타입 확정
- 완료 조건: 데스크톱 동작 동일 (수동 QA)

### Phase 4 — Mobile 레이아웃 (sm: < 768px)
- `SimulatorLayoutMobile.tsx`, `SynergyChip.tsx`
- 헤더 압축 + OverflowMenu 적용
- Setup mode + Replay mode 둘 다 모바일 레이아웃 구현
- 완료 조건: 360px / 375px / 390px 3개 기기/에뮬레이터 확인

### Phase 5 — Tablet 레이아웃 (md: 768~1023px)
- `SimulatorLayoutTablet.tsx` (2-column + 탭형 사이드)
- 완료 조건: 768px / 820px 확인 (iPad Air landscape 1180px 는 lg 취급)

### Phase 6 — 폴리시 & 엣지 케이스
- 가상 키보드 대응 (focus → sheet full)
- 드래그 중 sheet 자동 peek (`DndContext onDragStart` 연결)
- hexBuff movable 이동 모드 시 sheet auto-peek
- 회전 smooth 전환 확인
- 완료 조건: 엣지케이스 수동 QA 시나리오 통과

---

## 10. 테스트 전략

| 종류 | 전략 |
|------|------|
| 엔진 Golden 스냅샷 | 기존 `tests/golden/` 영향 없음 — 엔진 순수 TS |
| BottomSheet 상태머신 | 신규 unit test: peek↔half↔full 전환 · 드래그 임계값 (Phase 1) |
| useViewport | `matchMedia` mock · 브레이크포인트 경계값 테스트 |
| 레이아웃 렌더 | 수동 QA 매트릭스 (아래). Playwright 도입은 out of scope |
| 필수 CI 체크 | `pnpm lint && pnpm typecheck && pnpm build` 각 phase 통과 |

### 수동 QA 매트릭스 (Phase 4-6)

**3 뷰포트 × 2 모드 × 9 플로우**

- 뷰포트: 360 / 768 / 1024 px
- 모드: Setup / Replay
- 플로우: 챔프 드래그 · 유닛 클릭 · 아이템 장착 · 증강 추가 · 시너지 확인 · 전투 시작 · 리플레이 재생 · 로그/데미지 확인 · 분석 핸드오프 복귀

---

## 11. 성능 체크포인트

- **BottomSheet 드래그**: CSS `translateY` transform 기반, React state 프레임 업데이트 없음 — 60fps 유지
- **useViewport**: `useSyncExternalStore` — 리사이즈 중 필요 시에만 렌더
- **레이아웃 switch**: React Compiler 자동 메모이제이션으로 불필요한 자식 재렌더 방지
- **SetupBoard render cost**: 변화 없음 — cellSize 는 prop 일 뿐

---

## 12. Out of Scope

- Landscape 모바일 최적화 (세로 위주, 가로는 tablet 급으로 취급 가능성만 열어둠)
- 폴더블 / Surface Duo 등 특수 디바이스
- 전체 a11y 감사 — 신규 컴포넌트에만 기본 `role` / `aria-*` 적용
- Playwright 비주얼 회귀 자동화 (향후 별도 과제)
- E(터치 타겟) / G(시너지 장황함) 관련 근본 재설계 — 부수적 개선만

---

## 13. 리스크 & 완화

| 리스크 | 완화 |
|--------|------|
| Phase 2 에서 desktop 픽셀 어긋남 | `cellSize` default=56 엄격 유지 + 배포 전 전/후 스크린샷 비교 |
| BottomSheet 제스처 ↔ dnd-kit 충돌 | 시트 제스처는 드래그 핸들에서만 활성 · `activationConstraint.distance: 8` 유지 |
| 분석 페이지 핸드오프 깨짐 | 핸드오프 useEffect 는 `page.tsx` 상위 유지, 레이아웃 분기와 독립 |
| 이관 중 실수로 기능 누락 | Phase 3 는 behavior 불변만 목표 · Phase 별 QA 체크리스트 준수 |

---

## 14. 완료 기준 (전체)

- [ ] 6 Phase 모두 완료, 각 Phase PR 머지
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과
- [ ] 기존 `tests/golden/` 전체 pass
- [ ] 3 뷰포트 × 2 모드 수동 QA 매트릭스 전체 통과
- [ ] 데스크톱 시각 regression 없음 (전/후 비교)
- [ ] 분석 페이지 핸드오프 정상 동작
