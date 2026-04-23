# Design: 전적검색 비주얼 업그레이드 (챔피언/아이템/시너지)

> Plan 참조: `docs/01-plan/features/lookup-visual-upgrade.plan.md`

---

## 1. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | riot.ts — trait `style` 필드 추가, ParsedMatch에 traits/setId 추가 | `src/lib/riot.ts` |
| 2 | API 라우트 — traits, set_id를 DB에 저장 | `src/app/api/lookup/route.ts` |
| 3 | lookup 페이지 — 시너지 이미지 매핑 로직 + trait JSON 로드 | `src/app/lookup/page.tsx` |
| 4 | lookup 페이지 — 챔피언 아이콘 + 성급 별 + 아이템 이미지 렌더링 | `src/app/lookup/page.tsx` |
| 5 | lookup 페이지 — 시너지 아이콘 티어별 색상 렌더링 | `src/app/lookup/page.tsx` |
| 6 | lint/typecheck/build 검증 | - |

---

## 2. 데이터 레이어 변경

### 2.1 riot.ts 변경

```ts
// TftMatchParticipant.traits에 style 필드 추가
traits: Array<{
  name: string;
  num_units: number;
  tier_current: number;
  style: number;        // 0=inactive, 1=bronze, 2=silver, 3=gold, 4=chromatic
}>;

// ParsedMatch에 traits, setId 추가
export interface ParsedMatch {
  matchId: string;
  placement: number;
  champions: Array<{ id: string; tier: number; items: string[] }>;
  gameDatetime: string;
  gameLength: number;
  queueId: number;
  setId: string;         // 'set17'
  traits: Array<{
    name: string;        // apiName (TFT17_ASTrait)
    numUnits: number;
    style: number;
    tierCurrent: number;
  }>;
}
```

`parseMatchForPlayer()`에서 traits를 파싱하되, **style >= 1인 활성 시너지만** 포함:

```ts
traits: participant.traits
  .filter((t) => t.style >= 1)
  .map((t) => ({
    name: t.name,
    numUnits: t.num_units,
    style: t.style,
    tierCurrent: t.tier_current,
  })),
```

`setId`는 매치 ID에서 파싱: `KR_1234567` → `'set17'` (현재는 하드코딩, 향후 매치 메타데이터에서 추출).

### 2.2 API 라우트 변경

DB insert에 `traits`, `set_id` 추가:

```ts
await supabase.from('matches').insert({
  match_id: parsed.matchId,
  puuid,
  placement: parsed.placement,
  champions: parsed.champions,
  game_datetime: parsed.gameDatetime,
  game_length: parsed.gameLength,
  queue_id: parsed.queueId,
  set_id: parsed.setId,
  traits: parsed.traits,
});
```

### 2.3 기존 데이터 호환성

이미 저장된 매치는 `traits: null`, `set_id: 'set17'(default)`. 프론트에서 `traits ?? []`로 처리.

---

## 3. 시너지 이미지 매핑 전략

### 3.1 문제

`getTraitImage(apiName)`은 `registerTraitImages()` 호출 후에만 동작 (캐시 기반).
lookup 페이지는 시뮬레이터와 별도 진입점이라 캐시가 비어있음.

### 3.2 해결: API 응답에 traitMeta 포함

API 라우트에서 `tft_set17_traits.json`을 읽어 apiName→이미지경로, apiName→한글이름, 고유시너지 여부를 매핑 테이블로 응답에 포함:

```ts
// API 응답 구조
{
  summoner: { ... },
  matches: [ ... ],
  traitMeta: {
    "TFT17_ASTrait": {
      name: "도전자",
      icon: "/data/images/traits/trait_icon_17_challenger.tft_set17.png",
      isUnique: false
    },
    "TFT17_VexUniqueTrait": {
      name: "파멸자",
      icon: "/data/images/traits/trait_icon_17_doomer.tft_set17.png",
      isUnique: true
    },
    ...
  }
}
```

**장점**: 프론트에서 추가 fetch 불필요, 이미지 경로를 서버에서 확정.

### 3.3 고유 시너지 목록 (15개)

effects 배열 길이 1인 traits:

```
TFT17_VexUniqueTrait, TFT17_JhinUniqueTrait, TFT17_MissFortuneUniqueTrait,
TFT17_ZedUniqueTrait, TFT17_ShenUniqueTrait, TFT17_SonaUniqueTrait,
TFT17_Stargazer_Medallion, Set17_CarouselMarket_EmpoweredHexTrait,
TFT17_Stargazer_Shield, TFT17_RhaastUniqueTrait, TFT17_GravesTrait,
TFT17_BlitzcrankUniqueTrait, TFT17_TahmKenchUniqueTrait,
TFT17_FioraUniqueTrait, TFT17_MorganaUniqueTrait
```

API에서 `isUnique` 플래그로 전달하면 프론트에서 style=3(골드)이어도 주황색으로 오버라이드.

---

## 4. 프론트엔드 컴포넌트 설계

### 4.1 매치 카드 구조

```
MatchCard
├── Header: #순위 | 큐타입뱃지 | 게임시간 · 날짜
├── TraitRow: 활성 시너지 아이콘 목록 (style순 정렬)
└── ChampionRow: 챔피언 카드 목록 (flex wrap)
    └── ChampionUnit (반복)
        ├── StarBadge: 상단 별 표시 (2성/3성만)
        ├── Icon: 40x40 챔피언 이미지
        └── ItemRow: 하단 아이템 이미지 (16x16, 최대 3개)
```

### 4.2 ChampionUnit 렌더링

```tsx
<div className="flex flex-col items-center w-[48px]">
  {/* 성급 별 - 2성 이상만 */}
  {tier >= 2 && (
    <div className={`text-[10px] ${tier >= 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
      {'★'.repeat(tier)}
    </div>
  )}
  {/* 챔피언 아이콘 */}
  <img
    src={getChampionImage(id)}
    alt={cleanChampionName(id)}
    className={`w-10 h-10 rounded border-2 ${tierBorderClass}`}
    onError={(e) => { /* fallback to text */ }}
  />
  {/* 아이템 */}
  <div className="flex gap-0.5 mt-0.5">
    {items.slice(0, 3).map((item, i) => (
      <img key={i} src={getItemImage(item)} className="w-4 h-4 rounded-sm" />
    ))}
  </div>
</div>
```

### 4.3 성급별 border 클래스

```ts
const TIER_BORDER: Record<number, string> = {
  1: 'border-gray-600',
  2: 'border-gray-400',
  3: 'border-yellow-500',
};
```

### 4.4 시너지 아이콘 렌더링

```tsx
<div className="flex flex-wrap gap-1.5 mb-2">
  {traits
    .sort((a, b) => b.style - a.style)  // 높은 티어 먼저
    .map((t) => {
      const meta = traitMeta[t.name];
      const isUnique = meta?.isUnique && t.style >= 1;
      const styleClass = isUnique
        ? TRAIT_STYLES.unique
        : TRAIT_STYLES[t.style] ?? TRAIT_STYLES[1];
      return (
        <div key={t.name} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${styleClass.bg}`}>
          <img src={meta?.icon} className="w-5 h-5" />
          <span className={`text-xs ${styleClass.text}`}>{t.numUnits}</span>
        </div>
      );
    })}
</div>
```

### 4.5 시너지 티어 스타일 맵

```ts
const TRAIT_STYLES: Record<number | 'unique', { bg: string; text: string }> = {
  1: { bg: 'border-amber-700/60 bg-amber-900/30', text: 'text-amber-500' },
  2: { bg: 'border-gray-400/60 bg-gray-500/20', text: 'text-gray-300' },
  3: { bg: 'border-yellow-400/60 bg-yellow-500/20', text: 'text-yellow-400' },
  4: { bg: 'border-fuchsia-400/60 bg-fuchsia-500/20', text: 'text-white' },
  unique: { bg: 'border-orange-400/60 bg-orange-500/20', text: 'text-orange-400' },
};
```

### 4.6 이미지 fallback 처리

```tsx
onError={(e) => {
  const target = e.currentTarget;
  target.style.display = 'none';
  target.parentElement?.insertAdjacentHTML(
    'afterbegin',
    `<span class="w-10 h-10 rounded bg-gray-700 flex items-center justify-center text-[10px] text-gray-400">${name}</span>`
  );
}}
```

실패가 잦을 경우 state로 관리하는 것보다 DOM 직접 처리가 리렌더 비용 없이 가벼움.
단, React Compiler 호환 문제 없음 (이벤트 핸들러 내부 DOM 조작은 허용).

---

## 5. API 응답 변경

### 5.1 traitMeta 생성 로직 (route.ts)

```ts
import fs from 'fs';
import path from 'path';

// traits JSON에서 메타데이터 빌드 (서버 시작 시 1회, 캐시)
let cachedTraitMeta: Record<string, { name: string; icon: string; isUnique: boolean }> | null = null;

function getTraitMeta() {
  if (cachedTraitMeta) return cachedTraitMeta;
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/data/tft_set17_traits.json'), 'utf-8')
  );
  cachedTraitMeta = {};
  for (const t of raw.traits) {
    const filename = t.icon.split('/').pop().toLowerCase().replace('.tex', '.png');
    const isSet16 = t.apiName.startsWith('TFT16_');
    const base = isSet16 ? '/data/set16/images/traits' : '/data/images/traits';
    cachedTraitMeta[t.apiName] = {
      name: t.name,
      icon: `${base}/${filename}`,
      isUnique: Array.isArray(t.effects) ? t.effects.length === 1 : false,
    };
  }
  return cachedTraitMeta;
}
```

### 5.2 응답에 포함

```ts
return NextResponse.json({
  summoner: { ... },
  matches: allMatches ?? [],
  traitMeta: getTraitMeta(),
});
```

---

## 6. 반응형 대응

| 화면 | 챔피언 아이콘 | 아이템 아이콘 | 시너지 아이콘 |
|------|-------------|-------------|-------------|
| Desktop (>=768px) | 40x40 | 16x16 | 20x20 |
| Mobile (<768px) | 32x32 | 14x14 | 16x16 |

Tailwind 반응형 클래스: `w-8 h-8 md:w-10 md:h-10`

---

## 7. 에러/엣지 케이스

| 케이스 | 처리 |
|--------|------|
| 챔피언 이미지 로딩 실패 | onError → 회색 박스 + 챔피언명 약칭 |
| 아이템 이미지 로딩 실패 | onError → 숨김 |
| traits가 null (기존 DB 데이터) | `traits ?? []` → 시너지 영역 미표시 |
| traitMeta에 없는 시너지 | apiName 텍스트로 fallback |
| 아이템 0개인 챔피언 | 아이템 영역 미렌더링 |
