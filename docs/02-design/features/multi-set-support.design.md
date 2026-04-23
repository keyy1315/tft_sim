# Design: 멀티 세트 지원 — Set 17 팀 빌더 + 헤더 시즌 선택

> Plan: `docs/01-plan/features/multi-set-support.plan.md`

---

## 1. 세트 설정 상수 + 타입

**파일**: `src/data/setConfig.ts` (신규)

```ts
export type SetId = 'set16' | 'set17';

export interface SetConfig {
  id: SetId;
  number: number;
  name: string;
  label: string;         // "Set 16" / "Set 17"
  apiPrefix: string;     // "TFT16_" / "TFT17_"
  status: 'live' | 'pbe';
}

export const SET_CONFIGS: Record<SetId, SetConfig> = {
  set16: { id: 'set16', number: 16, name: '마법공학 시대', label: 'Set 16', apiPrefix: 'TFT16_', status: 'live' },
  set17: { id: 'set17', number: 17, name: 'Space Gods', label: 'Set 17', apiPrefix: 'TFT17_', status: 'pbe' },
};

export const DEFAULT_SET: SetId = 'set16';
export const AVAILABLE_SETS: SetId[] = ['set16', 'set17'];
```

---

## 2. loader.ts — 세트별 fetch + 캐시

**변경**: 모든 함수에 `setId` 파라미터 추가, 캐시를 `Map<SetId, T>` 구조로 변경.

```ts
import { SetId, DEFAULT_SET } from '@/data/setConfig';

const championsCache = new Map<string, RawChampion[]>();
const itemsCache = new Map<string, RawItem[]>();
const traitsCache = new Map<string, RawTrait[]>();
const augmentsCache = new Map<string, RawAugment[]>();
const teamPlannerCache = new Map<string, TeamPlannerEntry[]>();

export async function loadChampions(setId: SetId = DEFAULT_SET): Promise<RawChampion[]> {
  if (championsCache.has(setId)) return championsCache.get(setId)!;
  const res = await fetch(`/data/tft_${setId}_champions.json`);
  if (!res.ok) return [];  // Set 17 데이터 없으면 빈 배열
  const data = await res.json();
  // champions.json 구조 분기: Set16은 배열, Set17은 { meta, champions }
  const list: RawChampion[] = Array.isArray(data) ? data : data.champions ?? [];
  const filtered = list.filter(c =>
    c.traits.length > 0 && c.cost > 0 && !c.apiName.includes('Tibbers') &&
    !c.apiName.includes('Soldier') && !c.apiName.includes('Dummy')
  );
  championsCache.set(setId, filtered);
  return filtered;
}

// loadItems, loadTraits, loadAugments, loadTeamPlannerMapping 동일 패턴
// fetch 실패 시 빈 배열 반환 (Set 17 아이템/시너지 JSON 없음)
```

**캐시 무효화**: `clearCache(setId)` 함수 추가 (세트 전환 시 호출 불필요 — Map이므로 양쪽 다 유지).

---

## 3. imageMap.ts — 세트 파라미터화

### 3.1 getChampionImage

```ts
export function getChampionImage(apiName: string, setNum: number = 16): string {
  const resolved = CHAMPION_IMAGE_ALIASES[apiName] ?? apiName;
  const prefix = `TFT${setNum}_`;
  const name = resolved.replace(prefix, `tft${setNum}_`).replace('TFT_', 'tft_').toLowerCase();
  return `/data/images/tft_set${setNum}_champions/${name}_square.tft_set${setNum}.png`;
}
```

### 3.2 resolveItemPath / deriveItemPath

`TFT16_` 하드코딩을 `setNum` 파라미터로 교체:

```ts
function resolveItemPath(apiName: string, iconFilename: string, setNum: number = 16): string {
  if (apiName.includes(`TFT${setNum}_Item_Piltover_`)) {
    return `/data/images/tft_set${setNum}_piltover/${iconFilename}`;
  }
  if (apiName.includes(`TFT${setNum}_Item_Bilgewater_`)) {
    // ...
  }
  // ...기존 로직 유지
}
```

### 3.3 현재 세트 번호 전달

`registerItemImages(items, setNum)` 호출 시 세트 번호 전달.
`getItemImage(apiName, setNum)` — 호출측에서 현재 세트 번호를 전달.

---

## 4. useGameData 훅 — 세트 파라미터

```ts
export function useGameData(setId?: SetId) {
  const resolvedSet = setId ?? DEFAULT_SET;

  // 각 개별 훅에 setId 전달
  const { champions, loading: champLoading } = useChampions(resolvedSet);
  const { items, loading: itemsLoading } = useItems(resolvedSet);
  // ...

  return { champions, items, traits, augments, teamPlannerMapping, loading, setId: resolvedSet };
}
```

개별 훅 (`useChampions`, `useItems` 등)도 `setId` 파라미터 추가.
`useEffect` 의존성에 `setId` 포함하여 세트 변경 시 재로딩.

**React Compiler 준수**: `useEffect` 내에서 setState 허용 (비동기 콜백 내). 데이터 로딩은 이미 이 패턴을 사용 중.

---

## 5. layout.tsx — 세트 셀렉터

`layout.tsx`는 서버 컴포넌트이므로 세트 셀렉터를 별도 클라이언트 컴포넌트로 분리.

### 5.1 SetSelector 컴포넌트 (신규)

**파일**: `src/components/ui/SetSelector.tsx`

```tsx
'use client';
import { AVAILABLE_SETS, SET_CONFIGS, SetId } from '@/data/setConfig';

interface SetSelectorProps {
  activeSet: SetId;
  onSetChange: (setId: SetId) => void;
}

export default function SetSelector({ activeSet, onSetChange }: SetSelectorProps) {
  return (
    <div className="flex gap-0.5">
      {AVAILABLE_SETS.map(setId => {
        const cfg = SET_CONFIGS[setId];
        const isActive = activeSet === setId;
        return (
          <button key={setId} onClick={() => onSetChange(setId)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              isActive ? 'bg-yellow-600 text-black' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {cfg.label}
            {cfg.status === 'pbe' && <span className="ml-1 text-[9px] opacity-60">PBE</span>}
          </button>
        );
      })}
    </div>
  );
}
```

### 5.2 NavHeader 클라이언트 컴포넌트 (신규)

**파일**: `src/components/ui/NavHeader.tsx`

layout.tsx의 `<nav>` 내부를 클라이언트 컴포넌트로 추출. 세트 상태를 URL search param `?set=set17` 으로 관리하여 서버 컴포넌트 호환.

**설계 결정**: Zustand store 대신 **URL search param** 사용.
- 이유: `layout.tsx`는 서버 컴포넌트라 store 접근 불가. URL param이면 북마크/공유도 가능.
- `useSearchParams()`로 읽고, `router.push()` 또는 `<Link>`로 변경.

```tsx
'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import SetSelector from './SetSelector';
import { SetId, DEFAULT_SET, SET_CONFIGS } from '@/data/setConfig';

export default function NavHeader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeSet = (searchParams.get('set') as SetId) ?? DEFAULT_SET;
  const cfg = SET_CONFIGS[activeSet] ?? SET_CONFIGS[DEFAULT_SET];

  const handleSetChange = (setId: SetId) => {
    const params = new URLSearchParams(searchParams);
    if (setId === DEFAULT_SET) params.delete('set');
    else params.set('set', setId);
    const qs = params.toString();
    router.push(`${pathname}${qs ? '?' + qs : ''}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 lg:px-4 h-12 lg:h-14 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-1.5 text-base lg:text-lg font-bold">
          <span className="text-yellow-400">TFT</span>
          <span className="text-gray-300">{cfg.label}</span>
        </Link>
        <SetSelector activeSet={activeSet} onSetChange={handleSetChange} />
      </div>
      <div className="flex gap-1">
        <Link href="/builder/calculator" className="px-2 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors">
          계산기
        </Link>
        <Link href="/simulator" className="px-2 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors">
          전투 시뮬
        </Link>
      </div>
    </div>
  );
}
```

### 5.3 layout.tsx 변경

```tsx
// layout.tsx (서버 컴포넌트 유지)
import { Suspense } from 'react';
import NavHeader from '@/components/ui/NavHeader';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-40 bg-[#0a0e1a]/90 backdrop-blur border-b border-gray-800">
          <Suspense fallback={<div className="h-12 lg:h-14" />}>
            <NavHeader />
          </Suspense>
        </nav>
        <main className="max-w-7xl mx-auto px-2 py-3 lg:px-4 lg:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
```

`useSearchParams()`는 Suspense boundary 필요 — `<Suspense>`로 감쌈.

---

## 6. 페이지에서 세트 읽기

### 6.1 useActiveSet 훅 (신규)

**파일**: `src/hooks/useActiveSet.ts`

```ts
'use client';
import { useSearchParams } from 'next/navigation';
import { SetId, DEFAULT_SET } from '@/data/setConfig';

export function useActiveSet(): SetId {
  const params = useSearchParams();
  return (params.get('set') as SetId) ?? DEFAULT_SET;
}
```

### 6.2 simulator/page.tsx 변경

```ts
const activeSet = useActiveSet();
const { champions, items, traits, augments, teamPlannerMapping, loading } = useGameData(activeSet);
```

### 6.3 builder/calculator/page.tsx 변경

동일 패턴.

---

## 7. 이미지 경로 — 세트 번호 전달

`getChampionImage`를 호출하는 모든 곳에 `setNum` 전달 필요. 현재 호출처:

| 파일 | 호출 |
|------|------|
| `ReplayBoard.tsx` | `getChampionImage(apiName)` |
| `SetupBoard.tsx` | `getChampionImage(apiName)` |
| `DamageSidebar.tsx` | `getChampionImage(apiName)` |
| `UnitDetailPanel.tsx` | `getChampionImage(apiName)` |
| `ChampionCard.tsx` | `getChampionImage(apiName)` |
| `ChampionGrid.tsx` | `getChampionImage(apiName)` |

**접근 방식**: `SET_CONFIGS[activeSet].number`를 props로 전달하거나, `getChampionImage` 내부에서 apiName의 `TFT{N}_` prefix로 자동 감지:

```ts
export function getChampionImage(apiName: string): string {
  // apiName에서 세트 번호 자동 감지: TFT16_, TFT17_ 등
  const setMatch = apiName.match(/^TFT(\d+)_/);
  const setNum = setMatch ? parseInt(setMatch[1]) : 16;
  // ...
}
```

→ **자동 감지 채택** — 호출측 변경 불필요, apiName에 세트 정보가 이미 포함됨.

---

## 8. Set 17 데이터 파일 준비

```
public/data/
├── tft_set16_champions.json  (기존)
├── tft_set16_items.json      (기존)
├── tft_set16_traits.json     (기존)
├── tft_set16_augments.json   (기존)
├── tft_set16_teamplanner.json(기존)
├── tft_set17_champions.json  (tmp_ 제거)
├── tft_set17_items.json      (빈 구조: {"meta":{...},"items":[]})
├── tft_set17_traits.json     (빈 구조: {"meta":{...},"traits":[]})
├── tft_set17_augments.json   (빈 구조: {"meta":{...},"augments":[]})
└── images/
    └── tft_set17_champions/  (63개 이미지, 기존)
```

---

## 9. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | `setConfig.ts` 생성 (SetId 타입, SET_CONFIGS, DEFAULT_SET) | `src/data/setConfig.ts` |
| 2 | `loader.ts` 파라미터화 (Map 캐시, setId 파라미터) | `src/data/loader.ts` |
| 3 | `imageMap.ts` — `getChampionImage` apiName 자동 감지 | `src/data/imageMap.ts` |
| 4 | `useActiveSet` 훅 생성 | `src/hooks/useActiveSet.ts` |
| 5 | `useGameData` 훅에 setId 전달 | `src/hooks/useGameData.ts` |
| 6 | `SetSelector` + `NavHeader` 컴포넌트 생성 | `src/components/ui/` |
| 7 | `layout.tsx` — NavHeader 삽입 + Suspense | `src/app/layout.tsx` |
| 8 | `simulator/page.tsx` — useActiveSet 연결 | `src/app/simulator/page.tsx` |
| 9 | `builder/calculator/page.tsx` — useActiveSet 연결 | `src/app/builder/calculator/page.tsx` |
| 10 | `tmp_` prefix 제거 + 빈 JSON 파일 생성 | `public/data/` |
| 11 | lint + typecheck + build | — |

---

## 10. Set 17 전환 시 UX

- Set 17 선택 → 챔피언 목록은 63개 표시 (이미지 포함)
- 아이템/시너지/증강 → 빈 배열 → UI에서 "데이터 준비 중" 표시
- 전투 시작 버튼 → 스탯이 0이면 비활성화 + "PBE 데이터 대기 중" 경고
- Set 16으로 돌아오면 모든 기능 정상
