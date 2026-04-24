# Design: 전적검색 개선 (비아바이엔 아이콘 + 툴팁 + 코스트 색상)

> Plan 참조: `docs/01-plan/features/lookup-enhancement.plan.md`

---

## 1. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | 비아바이엔 이미지 다운로드 | `public/data/images/tft_set17_champions/` |
| 2 | API route — championMeta/itemMeta 빌드 + traitMeta desc 추가 | `src/app/api/lookup/route.ts` |
| 3 | lookup 페이지 — 타입 확장 + 코스트별 border + title 툴팁 | `src/app/lookup/page.tsx` |
| 4 | lint/typecheck/build | - |

---

## 2. 이미지 다운로드

```bash
curl -o public/data/images/tft_set17_champions/summon_square.tft_set17.png \
  https://raw.communitydragon.org/latest/game/assets/characters/tft17_summon/hud/tft17_summon_square.tft_set17.png
```

`getChampionImage('TFT17_Summon')` 규칙:
- `TFT17_Summon` → strip prefix → `summon` → `/data/images/tft_set17_champions/summon_square.tft_set17.png`
- 코드 변경 없이 자동 매핑.

---

## 3. API route 변경

### 3.1 championMeta 빌드

`tft_set17_champions.json` 읽어서 apiName→{name, cost, traits} 매핑:

```ts
interface ChampionMeta {
  name: string;
  cost: number;
  traits: string[];
}

let cachedChampionMeta: Record<string, ChampionMeta> | null = null;

function getChampionMeta(): Record<string, ChampionMeta> {
  if (cachedChampionMeta) return cachedChampionMeta;
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/data/tft_set17_champions.json'), 'utf-8')
  );
  const champs = Array.isArray(raw) ? raw : raw.champions ?? [];
  cachedChampionMeta = {};
  for (const c of champs) {
    cachedChampionMeta[c.apiName] = {
      name: c.name,
      cost: c.cost,
      traits: c.traits ?? [],
    };
  }
  return cachedChampionMeta;
}
```

### 3.2 itemMeta 빌드

common items + set17 items 병합:

```ts
interface ItemMeta {
  name: string;
  desc: string;
}

let cachedItemMeta: Record<string, ItemMeta> | null = null;

function getItemMeta(): Record<string, ItemMeta> {
  if (cachedItemMeta) return cachedItemMeta;
  cachedItemMeta = {};

  // common items (base + combined)
  const common = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/data/common/tft_common_items.json'), 'utf-8')
  );
  for (const item of common.items ?? common) {
    cachedItemMeta[item.apiName] = {
      name: item.name,
      desc: stripHtml(item.desc ?? ''),
    };
  }

  // set17 items (override/add)
  const set17 = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/data/tft_set17_items.json'), 'utf-8')
  );
  for (const item of set17.items ?? set17) {
    cachedItemMeta[item.apiName] = {
      name: item.name,
      desc: stripHtml(item.desc ?? ''),
    };
  }

  return cachedItemMeta;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\{\{[^}]*\}\}/g, '').trim();
}
```

### 3.3 traitMeta desc 추가

기존 `TraitMeta` 인터페이스에 `desc` 필드 추가:

```ts
interface TraitMeta {
  name: string;
  icon: string;
  isUnique: boolean;
  desc: string;  // 새로 추가
}
```

`getTraitMeta()` 내부에서 `t.desc`를 `stripHtml()` 처리 후 저장.

### 3.4 응답 구조

```ts
return NextResponse.json({
  summoner: { ... },
  matches: allMatches ?? [],
  traitMeta: getTraitMeta(),
  championMeta: getChampionMeta(),
  itemMeta: getItemMeta(),
});
```

---

## 4. 프론트엔드 변경

### 4.1 타입 확장

```ts
interface ChampionMetaEntry {
  name: string;
  cost: number;
  traits: string[];
}

interface ItemMetaEntry {
  name: string;
  desc: string;
}

interface TraitMetaEntry {
  name: string;
  icon: string;
  isUnique: boolean;
  desc: string;
}

interface LookupResult {
  summoner: SummonerData;
  matches: MatchData[];
  traitMeta: Record<string, TraitMetaEntry>;
  championMeta: Record<string, ChampionMetaEntry>;
  itemMeta: Record<string, ItemMetaEntry>;
}
```

### 4.2 코스트별 border 색상

기존 `COST_COLORS` (src/types/index.ts)와 동일한 값을 lookup에서 인라인 정의:

```ts
const COST_COLORS: Record<number, string> = {
  1: '#9ca3af',  // gray
  2: '#22c55e',  // green
  3: '#3b82f6',  // blue
  4: '#a855f7',  // purple
  5: '#f59e0b',  // gold
};
```

ChampionUnit에서 `championMeta`를 받아 cost 기반 border 적용:

```tsx
const cost = meta?.cost ?? 1;
const borderColor = COST_COLORS[cost] ?? COST_COLORS[1];

<img
  style={{ borderColor }}
  className={`w-8 h-8 md:w-10 md:h-10 rounded border-2 ${tier >= 3 ? 'shadow-[0_0_6px_#f59e0b]' : ''}`}
/>
```

- 코스트 → border 색상
- 3성 → golden glow (box-shadow) 추가

### 4.3 title 툴팁

**챔피언**:
```tsx
title={meta ? `${meta.name} (${meta.cost}코스트)\n${meta.traits.join(', ')}` : cleanChampionName(id)}
```

**아이템**:
```tsx
title={itemMeta ? `${itemMeta.name}\n${itemMeta.desc}` : item}
```

**시너지**:
```tsx
title={traitMeta ? `${traitMeta.name} (${trait.numUnits})\n${traitMeta.desc}` : trait.name}
```

### 4.4 props 전달

`ChampionUnit`과 `TraitBadge`에 meta를 props로 전달:

```tsx
<ChampionUnit
  champion={c}
  meta={result.championMeta?.[c.id]}
  itemMeta={result.itemMeta}
/>

<TraitBadge
  trait={t}
  meta={result.traitMeta?.[t.name]}
/>
```

---

## 5. 에러/엣지 케이스

| 케이스 | 처리 |
|--------|------|
| championMeta에 없는 챔피언 | cost=1 fallback, 이름은 apiName에서 파싱 |
| itemMeta에 없는 아이템 | title 생략 |
| desc가 빈 문자열 | title에서 desc 줄 생략 |
| HTML 태그가 남은 desc | `stripHtml()` 서버에서 전처리 |
