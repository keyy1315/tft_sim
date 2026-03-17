# Plan: 모바일 UI 버그 수정 + 기물 배치 개선 (8건)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | mobile-bugfix |
| 작성일 | 2026-03-17 |
| 예상 소요 | 1 PDCA 사이클 |

| 관점 | 내용 |
|------|------|
| **Problem** | 모바일 UX 결함 6건(보드 잘림, 탭 너비, 팝업, 증강 삭제, 챔피언 제거/수정) + 배치 개선 2건(기본 2성, 아지르 모래병사 소환) |
| **Solution** | 보드 scale 보정, 터치 대응, 싱글클릭→유닛 선택 통합, 기본 성급 2성, 아지르 소환물 자동 배치 |
| **Function UX Effect** | 모바일에서 모든 핵심 조작이 터치만으로 가능 + 실제 게임과 동일한 기본 2성 배치 + 아지르 소환물 지원 |
| **Core Value** | 모바일/데스크톱 모두에서 실제 TFT와 일치하는 직관적인 시뮬레이터 조작 |

---

## 1. 문제 분석

### Bug 1: 보드(필드)가 모바일에서 잘려서 보임

**현상**: 전투 시뮬레이션 화면에서 헥스 보드가 좌우로 잘림. TEAM B/TEAM A 라벨이 겨우 보이는 수준.

**원인 분석** (`src/app/simulator/page.tsx:667-668`):
```tsx
<div className="h-[310px] sm:h-[420px] lg:h-auto overflow-hidden">
  <div className="transform scale-[0.48] sm:scale-[0.65] lg:scale-100 origin-top">
```
- SVG 보드는 고정 크기(≈660×640px)로 렌더링됨
- `scale-[0.48]`로 축소하지만 `origin-top`만 설정 → 좌우 중앙 정렬 안 됨
- 부모 `overflow-hidden`으로 넘치는 부분이 잘림

**영향 범위**: `SetupBoard`, `ReplayBoard`, Droppable overlay

---

### Bug 2: 챔피언/아이템 선택 탭 너비가 화면에 맞지 않음

**현상**: 하단 챔피언/아이템 선택 패널이 전체 화면 너비를 채우지 않고 좁게 표시됨.

**원인 분석** (`src/app/simulator/page.tsx:806`):
```tsx
<div className="order-4 lg:order-3 lg:w-64 lg:shrink-0 ... self-start max-h-[40vh] ...">
```
- `self-start`가 모바일 flex-col에서 너비를 content 크기로 축소시킴
- 모바일에서 `w-full`이 명시되지 않음

---

### Bug 3: 아이템 Tooltip이 터치 없이 자동 표시됨

**현상**: 아이템 선택 모달에서 아이템을 터치하지 않았는데 설명 팝업이 표시됨.

**원인 분석** (`src/components/ui/Tooltip.tsx:34-35`):
```tsx
onMouseEnter={handleEnter}
onMouseLeave={handleLeave}
```
- 모바일 브라우저에서 `mouseenter`가 터치 시 자동 발생 (touch → hover 에뮬레이션)
- Tooltip에 터치 디바이스 감지 로직 없음

---

### Bug 4: 증강 슬롯 삭제 버튼이 모바일에서 접근 불가

**현상**: 증강을 선택한 후 삭제(X 버튼)가 모바일에서 보이지 않아 제거할 수 없음.

**원인 분석** (`src/components/builder/AugmentSlots.tsx:66`):
```tsx
className="... opacity-0 group-hover:opacity-100 transition-opacity"
```
- 삭제 버튼이 hover 시에만 표시, 모바일에서는 접근 불가

---

### Bug 5: 보드 위 챔피언 제거가 모바일에서 불가능

**현상**: 보드에 배치된 챔피언을 모바일에서 제거할 수 없음.

**원인 분석** (`src/app/simulator/page.tsx:705-710`):
- 챔피언 제거가 `onContextMenu`(우클릭)에만 바인딩
- 모바일에서 우클릭은 브라우저 기본 컨텍스트 메뉴가 먼저 뜸
- SelectedUnitPanel에 "제거" 버튼이 있지만 더블클릭으로 패널을 열어야 함

---

### Bug 6: 보드 유닛 클릭 동작이 비직관적 (데스크톱 포함)

**현상**: 현재 클릭=성급순환, 더블클릭=유닛 수정 패널 열기. 유닛 수정이 더블클릭 뒤에 숨어 있어 발견하기 어려움.

**현재 인터랙션 맵**:
| 동작 | 현재 기능 | 문제점 |
|------|-----------|--------|
| 클릭 | 성급 순환 (1→2→3→1) | 수정 패널을 열 수 없음 |
| 더블클릭 | 유닛 선택 (패널 열기) | 모바일 더블탭=줌, hidden interaction |
| 우클릭 | 유닛 제거 | 모바일 불가 |

---

### Bug 7: 챔피언 배치 시 기본 성급이 1성

**현상**: 챔피언을 필드에 배치하면 1성으로 올라감. 실제 TFT에서는 기본 2성.

**원인 분석** (`src/app/simulator/page.tsx:337`):
```tsx
setTeam(prev => [...prev, {
  champion,
  position: selectedCell,
  starLevel: 1,  // ← 하드코딩
  items: [],
}]);
```
- `starLevel: 1`로 하드코딩되어 있음
- 시뮬레이터에서 테스트 시 매번 수동으로 성급을 올려야 하는 불편함
- 소환물(티버, 얼어붙은 포탑, 아타칸 등)은 제외 — 이들은 소환자의 성급을 따름

---

### Bug 8: 아지르 배치 시 모래 병사가 자동 소환되지 않음

**현상**: 애니를 필드에 올리면 티버가 자동 소환되지만, 아지르를 올려도 모래 병사가 소환되지 않음.

**원인 분석**:
- 애니-티버 패턴이 `syncTibbersInTeam()` 함수로 구현되어 있음 (`page.tsx:132-153`)
- 아지르-모래병사에 대한 동일한 sync 함수가 없음
- 데이터상 `TFT16_AzirSoldier`는 존재하며 `MaxSummons = 2`
- `isAutoUnit()`에 `TFT16_AzirSoldier`가 등록되어 있지 않음

**참고 데이터** (`tft_set16_champions.json`):
```json
{
  "name": "모래 병사",
  "apiName": "TFT16_AzirSoldier",
  "cost": 11,
  "stats": { "armor": 50, "hp": 750, "range": 1, ... },
  "ability": { "name": "보초병", "desc": "이동/기본공격 불가. 황제 사망 시 함께 사망." }
}
```
- 아지르 어빌리티: `MaxSummons = 2` (모든 성급에서 2마리)

---

## 2. 해결 계획

### Fix 1: 보드 scale + 중앙 정렬 보정

**파일**: `src/app/simulator/page.tsx`

**변경 내용**:
1. 부모 컨테이너를 `flex justify-center`로 변경하여 축소된 보드 중앙 정렬 보장
2. `overflow-hidden` 유지하되 scale 값과 높이 조정

```tsx
// 현재
<div className="h-[310px] sm:h-[420px] lg:h-auto overflow-hidden">
  <div className="transform scale-[0.48] sm:scale-[0.65] lg:scale-100 origin-top">

// 수정 방향
<div className="flex justify-center lg:h-auto overflow-hidden">
  <div className="transform scale-[0.5] sm:scale-[0.65] lg:scale-100 origin-top">
```

---

### Fix 2: 선택 탭 모바일 full-width 적용

**파일**: `src/app/simulator/page.tsx`

**변경 내용**:
1. `w-full` 추가, `self-start` → `lg:self-start`

```tsx
// Before
<div className="order-4 lg:order-3 lg:w-64 lg:shrink-0 ... self-start max-h-[40vh] ...">

// After
<div className="order-4 lg:order-3 w-full lg:w-64 lg:shrink-0 ... lg:self-start max-h-[50vh] ...">
```

---

### Fix 3: Tooltip 터치 디바이스 비활성화

**파일**: `src/components/ui/Tooltip.tsx`

**변경 내용**: `@media (hover: hover)` 미디어 쿼리로 hover 가능 기기에서만 tooltip 활성화

```tsx
const [hasHover, setHasHover] = useState(true);

useEffect(() => {
  setHasHover(window.matchMedia('(hover: hover)').matches);
}, []);

if (!hasHover) return <>{children}</>;
```

---

### Fix 4: 증강 삭제 버튼 모바일 상시 표시

**파일**: `src/components/builder/AugmentSlots.tsx`

**변경 내용**: 기본 표시, hover 가능 기기에서만 숨겼다가 hover 시 표시

```tsx
// Before
className="... opacity-0 group-hover:opacity-100 transition-opacity"

// After
className="... opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"
```

---

### Fix 5+6: 보드 유닛 클릭 동작 통합 (모든 기기)

**파일**: `src/app/simulator/page.tsx`

**싱글 클릭 = 유닛 선택(SelectedUnitPanel 열기)으로 통합**

**변경 후 인터랙션 맵**:
| 동작 | 새 기능 | 이유 |
|------|---------|------|
| **클릭** | **유닛 선택 → SelectedUnitPanel 열기** | 가장 자주 쓰는 조작을 가장 쉬운 입력에 매핑 |
| 우클릭 | 유닛 제거 (데스크톱 숏컷 유지) | 파워 유저용 |

**SelectedUnitPanel에서 가능한 조작**: ★ 성급 변경, 아이템 장착/해제, "제거" 버튼

```tsx
// Before
const cellClick = () => {
  if (placed) handleCycleStars(team, placedIdx);  // 성급 순환
  else handleCellClick(pos, team);
};
const cellDblClick = () => {
  if (placed) handleUnitClick(team, placedIdx);    // 패널 열기
};

// After — 싱글 클릭으로 패널 열기, 더블클릭 제거
const cellClick = () => {
  if (placed) handleUnitClick(team, placedIdx);    // 패널 열기
  else handleCellClick(pos, team);
};
// cellDblClick 제거
```

**이점**: 터치 감지 불필요, 모든 기기 동일 동작, UX 단순화

---

### Fix 7: 기본 성급 2성으로 변경

**파일**: `src/app/simulator/page.tsx`

**변경 내용**: `handleChampionSelect`에서 `starLevel: 1` → `starLevel: 2`

```tsx
// Before
setTeam(prev => [...prev, {
  champion,
  position: selectedCell,
  starLevel: 1,
  items: [],
}]);

// After
setTeam(prev => [...prev, {
  champion,
  position: selectedCell,
  starLevel: 2,
  items: [],
}]);
```

**주의**: 소환물(티버, 모래병사, 얼어붙은 포탑)은 소환자의 성급을 따르므로 이 변경에 영향받지 않음 — 이들은 `handleChampionSelect`가 아닌 sync 함수에서 생성됨.

---

### Fix 8: 아지르 배치 시 모래 병사 2마리 자동 소환

**파일**: `src/app/simulator/page.tsx`

**변경 내용**: `syncTibbersInTeam()` 패턴을 따라 `syncAzirSoldiersInTeam()` 함수 추가

1. **상수 정의**: `AZIR_SOLDIER_CHAMPION` (티버 패턴 동일)
```tsx
const AZIR_SOLDIER_CHAMPION: RawChampion = {
  name: '모래 병사',
  apiName: 'TFT16_AzirSoldier',
  cost: 11,
  traits: [],
  role: null,
  stats: { armor: 50, attackSpeed: 0.8, critChance: 0.25, critMultiplier: 1.4, damage: 0, hp: 750, initialMana: 0, magicResist: 50, mana: 100, range: 1 },
  ability: { name: '보초병', desc: '이동/기본공격 불가. 황제 사망 시 함께 사망.', icon: '', variables: [] },
};
```

2. **sync 함수**: `syncAzirSoldiersInTeam(team)`
```tsx
function syncAzirSoldiersInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const azir = team.find(p => p.champion.apiName === 'TFT16_Azir');
  const soldiers = team.filter(p => p.champion.apiName === 'TFT16_AzirSoldier');

  // 아지르 없으면 → 모래병사 모두 제거
  if (!azir) {
    return soldiers.length > 0 ? team.filter(p => p.champion.apiName !== 'TFT16_AzirSoldier') : team;
  }

  // 성급 동기화
  let result = team.map(p =>
    p.champion.apiName === 'TFT16_AzirSoldier' && p.starLevel !== azir.starLevel
      ? { ...p, starLevel: azir.starLevel } : p
  );

  // 모래병사 부족하면 추가 (최대 2마리)
  const currentCount = soldiers.length;
  if (currentCount < 2) {
    const occupied = new Set(result.map(p => `${p.position.q},${p.position.r}`));
    for (let i = currentCount; i < 2; i++) {
      const pos = findEmptyAdjacentHex(azir.position, occupied);
      if (!pos) break;
      occupied.add(`${pos.q},${pos.r}`);
      result = [...result, {
        champion: AZIR_SOLDIER_CHAMPION,
        position: pos,
        starLevel: azir.starLevel,
        items: [],
      }];
    }
  }
  return result;
}
```

3. **isAutoUnit 등록**: `TFT16_AzirSoldier` 추가
```tsx
const isAutoUnit = (apiName: string) =>
  apiName === 'TFT16_AnnieTibbers' ||
  apiName === 'TFT16_FreljordTurret' ||
  apiName === 'TFT16_AzirSoldier';
```

4. **sync 호출**: 팀 변경 시 `syncTibbersInTeam` 호출 위치에 `syncAzirSoldiersInTeam`도 체인

**모래 병사 특성**:
- 이동 불가, 기본 공격 불가 (보초병)
- 아지르 사망 시 함께 사망
- 위치 변경 가능 (드래그)
- 아지르 성급과 동기화
- 아이템 장착 불가 (isAutoUnit이므로)

---

## 3. 변경 대상 파일

| 파일 | 변경 | Bug |
|------|------|-----|
| `src/app/simulator/page.tsx` | 보드 scale, 선택 탭 w-full, 클릭 통합, 기본 2성, 아지르 sync | #1, #2, #5, #6, #7, #8 |
| `src/components/ui/Tooltip.tsx` | 터치 디바이스 hover tooltip 비활성화 | #3 |
| `src/components/builder/AugmentSlots.tsx` | 삭제 버튼 모바일 상시 표시 | #4 |

---

## 4. 구현 순서

1. **Tooltip 수정** (Bug 3) — 가장 독립적
2. **AugmentSlots 수정** (Bug 4) — 독립적, CSS만 변경
3. **기본 2성** (Bug 7) — 한 줄 변경
4. **선택 탭 너비** (Bug 2) — page.tsx 클래스 수정
5. **보드 scale 보정** (Bug 1) — page.tsx 레이아웃 수정
6. **클릭 동작 통합** (Bug 5+6) — page.tsx cellClick/cellDblClick 변경
7. **아지르 모래병사** (Bug 8) — 새 함수 추가 + isAutoUnit 확장 + sync 체인

---

## 5. 검증 계획

1. `pnpm typecheck && pnpm lint && pnpm build` 통과
2. 모바일 Chrome DevTools (iPhone SE, iPhone 12 Pro, Galaxy S20) 확인
3. 확인 항목:
   - [ ] 보드가 모바일 화면에서 전체 보임 (잘림 없음)
   - [ ] 챔피언/아이템 선택 탭이 전체 너비를 채움
   - [ ] 아이템 위에 손가락을 올려도 팝업이 뜨지 않음
   - [ ] 증강 삭제 버튼(X)이 모바일에서 항상 보임
   - [ ] 보드 유닛 싱글 클릭 → SelectedUnitPanel 열림
   - [ ] 패널에서 성급 변경, 아이템 장착/해제, 유닛 제거 가능
   - [ ] 챔피언 배치 시 기본 2성으로 올라감
   - [ ] 아지르 배치 → 모래 병사 2마리 자동 소환
   - [ ] 모래 병사 위치 변경(드래그) 가능
   - [ ] 아지르 제거 → 모래 병사 자동 제거
   - [ ] 아지르 성급 변경 → 모래 병사 성급 동기화
   - [ ] 데스크톱에서 hover tooltip, 우클릭 제거 정상 동작
4. 실제 모바일 기기(tft-sim.vercel.app)에서 최종 확인

---

## 6. 참고 스크린샷

- `ex/KakaoTalk_20260317_100857374.png` — Bug 3: 아이템 팝업 자동 표시
- `ex/KakaoTalk_20260317_100857374_01.png` — Bug 1: 보드 잘림
- `ex/KakaoTalk_20260317_100857374_02.png` — Bug 2: 선택 탭 너비
