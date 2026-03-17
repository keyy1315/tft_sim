# Plan: tooltip-enhancement — 모바일 Long-Press 툴팁 + PC 드래그 중 툴팁 숨김

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 모바일에서 챔피언/아이템 정보를 확인할 방법이 없고, PC에서 드래그 중 불필요한 툴팁이 표시되어 시각적 방해 |
| **Solution** | Tooltip 컴포넌트에 모바일 long-press 지원 추가 + 드래그 상태 감지로 자동 숨김 |
| **Function UX Effect** | 모바일: 길게 누르면 스탯/설명 확인 가능. PC: 드래그 시 툴팁 자동 제거로 깔끔한 조작 경험 |
| **Core Value** | 플랫폼 불문 동등한 정보 접근성 확보, 조작 흐름에 방해 없는 자연스러운 UX |

---

## 1. 현재 구조 분석

### 1.1 Tooltip.tsx (src/components/ui/Tooltip.tsx)
- `position: fixed` 포털 방식, `useSyncExternalStore`로 `(hover: hover)` 미디어쿼리 감지
- **hover 불가 기기**: `return <>{children}</>` — 툴팁 자체를 렌더링하지 않음
- `onMouseEnter`/`onMouseLeave`로 show/hide 제어
- 포지셔닝: 2단계 callback ref (hidden 측정 → 위치 계산 → visible)

### 1.2 ChampionCard / ItemIcon
- 이미 `<Tooltip content={...}>` 로 감싸져 있음
- ChampionCard: 이름, 코스트, 특성, 어빌리티 설명 표시
- ItemIcon: `showTooltip` prop으로 on/off 가능 (기본 true)

### 1.3 DraggableChampionCard / DraggableItemIcon
- 내부에 ChampionCard/ItemIcon을 렌더링 → 드래그 중에도 원본 위치에 툴팁 발동 가능
- `useDraggable` 사용, `isDragging` 상태 보유
- **하위 컴포넌트(Tooltip)에 드래그 상태를 전달하지 않음**

### 1.4 드래그 상태 접근성
- `activeDragData`는 `useDndHandlers` hook 로컬 상태
- 하위 컴포넌트에서 직접 접근 불가
- **dnd-kit 제공 `useDndContext()`**: DndContext 하위면 어디서든 `active` 상태 접근 가능

---

## 2. 요구사항

### FR-01: PC 드래그 중 툴팁 숨김
- 드래그 시작 시 모든 Tooltip 비활성화
- 드래그 종료 시 원래 동작 복원
- DndContext 바깥의 Tooltip은 영향 없음

### FR-02: 모바일 Long-Press 툴팁
- hover 불가 기기에서 500ms 길게 누르면 툴팁 표시
- 손가락 이동(`touchmove`) 시 타이머 취소 + 툴팁 닫기
- 손가락 떼면(`touchend`) 툴팁 닫기
- 드래그와 충돌하지 않아야 함 (dnd-kit PointerSensor: 8px 이동 후 활성화)

### FR-03: 기존 동작 보존
- PC hover 툴팁 동작 변경 없음
- 탭/클릭으로 챔피언 배치 등 기존 동작 유지
- DndContext 바깥에서 사용되는 Tooltip 정상 작동

---

## 3. 구현 설계

### 3.1 방안 (A): Tooltip `disabled` prop + Draggable 컴포넌트에서 상태 전달

```
DraggableChampionCard
  └─ useDndContext().active !== null → isDragging
     └─ ChampionCard(tooltipDisabled={isDragging})
        └─ Tooltip(disabled={tooltipDisabled})
```

**장점**: Tooltip이 DndContext에 의존하지 않음. 범용성 유지.
**단점**: ChampionCard/ItemIcon에 prop 추가 필요 (prop drilling 1단계)

### 3.2 변경 파일 및 내용

| 파일 | 변경 |
|------|------|
| `src/components/ui/Tooltip.tsx` | `disabled` prop 추가 + 모바일 long-press 터치 이벤트 |
| `src/components/builder/ChampionCard.tsx` | `tooltipDisabled` prop 추가 → Tooltip에 전달 |
| `src/components/builder/ItemIcon.tsx` | `tooltipDisabled` prop 추가 → Tooltip에 전달 |
| `src/components/builder/DraggableChampionCard.tsx` | `useDndContext`로 드래그 감지 → `tooltipDisabled` 전달 |
| `src/components/builder/DraggableItemIcon.tsx` | 동일 |

### 3.3 Tooltip.tsx 변경 상세

```ts
interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;  // 추가
}
```

**PC (hover 가능 기기)**:
- `disabled`이면 `onMouseEnter` 무시, show 강제 false

**모바일 (hover 불가 기기)**:
- 기존: `return <>{children}</>` (아무것도 안 함)
- 변경: long-press 핸들러 추가
  - `onTouchStart` → 500ms `setTimeout` 시작
  - `onTouchMove` → `clearTimeout` + 툴팁 닫기
  - `onTouchEnd` → `clearTimeout` + 툴팁 닫기
  - `disabled`이면 터치 이벤트도 무시

### 3.4 DnD 드래그 충돌 방지

| 시나리오 | 동작 |
|---------|------|
| 모바일에서 500ms 가만히 누름 | 툴팁 표시 (드래그 미발동 — 8px 미이동) |
| 모바일에서 누른 채 8px 이동 | `onTouchMove` → 툴팁 취소, dnd-kit 드래그 시작 |
| 모바일에서 빠른 탭 | 500ms 미달 → 툴팁 미표시, 기존 클릭 동작 |

---

## 4. 동작 매트릭스

| 상황 | PC | 모바일 |
|------|-----|--------|
| hover (드래그X) | 툴팁 표시 | - |
| long-press (500ms) | - | 툴팁 표시 |
| 드래그 중 | 툴팁 숨김 | 툴팁 숨김 |
| 탭/클릭 | 기존 동작 유지 | 기존 동작 유지 |

---

## 5. 구현 순서

1. `Tooltip.tsx` — `disabled` prop 추가 + hover 기기 대응
2. `Tooltip.tsx` — 모바일 long-press 터치 이벤트 추가
3. `ChampionCard.tsx` — `tooltipDisabled` prop 추가
4. `ItemIcon.tsx` — `tooltipDisabled` prop 추가
5. `DraggableChampionCard.tsx` — `useDndContext` + `tooltipDisabled` 전달
6. `DraggableItemIcon.tsx` — 동일
7. 검증: `pnpm lint && pnpm typecheck && pnpm build`

---

## 6. 검증 기준

- [ ] PC: 챔피언/아이템 hover → 툴팁 정상 표시
- [ ] PC: 드래그 시작 → 모든 툴팁 즉시 사라짐
- [ ] PC: 드래그 종료 → hover 툴팁 다시 정상 작동
- [ ] 모바일: 길게 누르기 500ms → 툴팁 표시
- [ ] 모바일: 손가락 이동 → 툴팁 닫히고 드래그 시작
- [ ] 모바일: 빠른 탭 → 기존 배치/선택 동작 유지
- [ ] DndContext 바깥의 Tooltip 정상 작동 (builder/calculator 등)
- [ ] lint 0 errors, 0 warnings
- [ ] build 성공

---

## 7. MVP 제외 사항

- 툴팁 애니메이션 (fade-in/out)
- 툴팁 위치 사용자 커스터마이징
- 보드 위 배치된 유닛의 long-press 툴팁 (SelectedUnitPanel로 대체)
