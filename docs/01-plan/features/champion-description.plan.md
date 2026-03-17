# Plan: 챔피언 설명 표시 + Tooltip 위치 자동 조정

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | champion-description |
| 작성일 | 2026-03-17 |
| 예상 소요 | 1 PDCA 사이클 |

| 관점 | 내용 |
|------|------|
| **Problem** | 챔피언 어빌리티 정보를 확인할 수 없고, Tooltip이 화면 밖으로 잘려서 보이지 않는 경우 발생 |
| **Solution** | ChampionCard hover Tooltip 추가, SelectedUnitPanel 어빌리티 표시, Tooltip 위치 자동 보정 |
| **Function UX Effect** | 챔피언 정보를 즉시 확인 가능 + Tooltip이 항상 화면 안에서 표시됨 |
| **Core Value** | 외부 참조 없이 시뮬레이터 내에서 챔피언 정보 완결적 제공 |

---

## 1. 문제 분석

### 문제 1: 챔피언 선택 탭에 어빌리티 정보 없음

**현상**: ChampionCard에 이미지/이름/코스트만 표시. 어빌리티 정보를 보려면 외부 자료 참고 필요.

**현재 구현** (`ChampionCard.tsx`):
- hover 시 `scale-105`만 적용, Tooltip 없음
- `RawChampion.ability.name`, `ability.desc` 데이터는 존재하지만 미사용

### 문제 2: SelectedUnitPanel에 어빌리티 설명 없음

**현상**: 유닛 수정 패널에서 이름, 성급, 아이템, 특성만 표시. 어빌리티 설명 없음.

**현재 구현** (`SelectedUnitPanel.tsx:87-89`):
```tsx
<div className="text-[10px] text-gray-500 space-y-0.5">
  <div>특성: {placed.champion.traits.join(', ')}</div>
</div>
```

### 문제 3: Tooltip 위치가 고정되어 잘리는 경우 발생

**현상**: Tooltip이 항상 대상 위쪽 중앙에 표시됨. 화면 상단/좌우 가장자리에 있는 요소의 Tooltip이 뷰포트 밖으로 잘림.

**원인 분석** (`Tooltip.tsx:58-64`):
```tsx
style={{
  position: 'absolute',
  top: pos.top,
  left: pos.left,
  transform: 'translate(-50%, -100%)',  // 항상 위쪽 중앙
  marginTop: -8,
}}
```
- 위치 계산이 대상의 상단 중앙 고정 (`translate(-50%, -100%)`)
- 뷰포트 경계 체크 없음
- 긴 설명의 Tooltip이 화면 위/좌/우로 넘칠 수 있음
- `maxWidth: 320` 고정이지만 내용에 따라 높이가 가변 → 위로 넘침

---

## 2. 해결 계획

### Fix 1: Tooltip 위치 자동 보정 (뷰포트 경계 감지)

**파일**: `src/components/ui/Tooltip.tsx`

**변경 내용**:
1. Tooltip 렌더 후 실제 크기를 측정하여 뷰포트 경계 초과 시 위치 조정
2. 기본: 대상 위쪽 중앙 → 위쪽이 잘리면 아래쪽으로, 좌우가 잘리면 좌우 보정
3. `useRef`로 Tooltip DOM 참조 → `useLayoutEffect` 또는 `ref callback`으로 위치 재계산

**위치 보정 로직**:
```
1. 기본 위치 계산: 대상 위쪽 중앙
2. Tooltip 렌더 후 getBoundingClientRect()로 실제 크기 측정
3. 경계 체크:
   - top < 0 → 대상 아래쪽에 표시 (translate(-50%, 0) + marginTop: 8)
   - left < 0 → left: 8 (좌측 여백)
   - right > viewportWidth → right: 8 (우측 여백)
```

**구현 방향**:
```tsx
const tooltipRef = useRef<HTMLDivElement>(null);
const [adjusted, setAdjusted] = useState<{ top: number; left: number; flipY: boolean }>(...);

// Tooltip이 렌더된 후 위치 보정
const adjustPosition = useCallback(() => {
  if (!tooltipRef.current || !ref.current) return;
  const tooltip = tooltipRef.current.getBoundingClientRect();
  const trigger = ref.current.getBoundingClientRect();

  let top = trigger.top + window.scrollY;
  let left = trigger.left + trigger.width / 2 + window.scrollX;
  let flipY = false;

  // 위로 잘리면 아래에 표시
  if (trigger.top - tooltip.height - 8 < 0) {
    top = trigger.bottom + window.scrollY;
    flipY = true;
  }

  // 좌우 보정
  const halfWidth = tooltip.width / 2;
  if (left - halfWidth < 0) left = halfWidth + 8;
  if (left + halfWidth > window.innerWidth) left = window.innerWidth - halfWidth - 8;

  setAdjusted({ top, left, flipY });
}, []);
```

---

### Fix 2: ChampionCard에 hover Tooltip 추가

**파일**: `src/components/builder/ChampionCard.tsx`

**변경 내용**:
1. `Tooltip` import하여 카드 전체를 감싸기
2. 내용: 챔피언 이름, 특성, 코스트, 어빌리티 이름 + 설명
3. HTML 태그 제거 (`stripHtml`)
4. 터치 디바이스에서는 자동 비활성화 (기존 Tooltip 로직)

```tsx
<Tooltip content={
  <div className="max-w-[220px]">
    <div className="font-bold text-yellow-400">{champion.name}</div>
    <div className="text-xs text-gray-400">{champion.cost}코스트 · {champion.traits.join(' · ')}</div>
    <div className="text-xs text-cyan-400 mt-1 font-bold">{champion.ability.name}</div>
    <div className="text-xs text-gray-300 mt-0.5">{stripHtml(champion.ability.desc)}</div>
  </div>
}>
  {/* 기존 카드 */}
</Tooltip>
```

---

### Fix 3: SelectedUnitPanel 하단에 어빌리티 표시

**파일**: `src/components/builder/SelectedUnitPanel.tsx`

**변경 내용**: 기존 "특성: ..." 아래에 어빌리티 섹션 추가 (인라인, 항상 표시)

```tsx
{/* 기존 특성 */}
<div className="text-[10px] text-gray-500">
  특성: {placed.champion.traits.join(', ')}
</div>

{/* 새로 추가 */}
<div className="border-t border-gray-700 pt-2">
  <div className="text-xs text-cyan-400 font-bold">{placed.champion.ability.name}</div>
  <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
    {stripHtml(placed.champion.ability.desc)}
  </div>
</div>
```

---

### stripHtml 유틸

`ItemIcon.tsx`에 이미 존재하는 3줄 함수. 사용하는 각 파일에 인라인 정의 (과도한 추상화 방지):
```tsx
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/@\w+@/g, '').replace(/%i:\w+%/g, '');
}
```

---

## 3. 변경 대상 파일

| 파일 | 변경 |
|------|------|
| `src/components/ui/Tooltip.tsx` | 뷰포트 경계 감지 + 위치 자동 보정 |
| `src/components/builder/ChampionCard.tsx` | Tooltip 추가 (어빌리티 hover 표시) |
| `src/components/builder/SelectedUnitPanel.tsx` | 하단 어빌리티 설명 인라인 추가 |

---

## 4. 구현 순서

1. **Tooltip 위치 보정** — 다른 fix의 기반이 됨 (ChampionCard Tooltip도 혜택)
2. **ChampionCard Tooltip** — Tooltip 의존
3. **SelectedUnitPanel 어빌리티** — 독립적

---

## 5. 검증 계획

1. `pnpm typecheck && pnpm lint && pnpm build` 통과
2. 확인 항목:
   - [ ] 챔피언 카드 hover 시 어빌리티 Tooltip 표시
   - [ ] 화면 상단 가장자리 챔피언 → Tooltip이 아래쪽에 표시
   - [ ] 화면 좌/우 가장자리 → Tooltip이 잘리지 않고 보정됨
   - [ ] 긴 설명(아지르 등) Tooltip이 완전히 보임
   - [ ] 아이템 Tooltip도 동일하게 위치 보정 적용됨
   - [ ] SelectedUnitPanel에서 어빌리티 이름 + 설명 표시
   - [ ] 모바일에서 Tooltip 미표시 (기존 동작 유지)
   - [ ] 데스크톱에서 아이템 Tooltip 정상 동작 유지
