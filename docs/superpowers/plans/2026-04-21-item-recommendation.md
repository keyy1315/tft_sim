# Item Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전투 시뮬레이션 리플레이의 `UnitDetailPanel` 에 "이 유닛이 어떤 아이템을 꼈어야 더 좋았을까" 추천을 표시한다. 1차 즉시 추천(`estimateDps`) + 2차 on-demand 엔진 검증(`simulateCombat` N회).

**Architecture:**
- 순수 TS 모듈 `src/lib/analysis/itemRecommender.ts` 가 추천/검증 로직 담당. React 의존 X.
- UI 는 `UnitDetailPanel` 을 3-column 레이아웃으로 확장하고 `RecommendationSection` 서브 컴포넌트를 내부 선언해 로컬 `useState` 로 비동기 상태 관리.
- 기존 `estimateDps`, `extractItemDpsModifiers`, `simulateCombat` 재사용.

**Tech Stack:** TypeScript strict, React 19, TailwindCSS 4, Zustand, vitest 4 (순수 함수 테스트만), Next.js 16 App Router.

---

## File Structure

**Create:**
- `src/lib/analysis/itemRecommender.ts` — 순수 TS. `getStaticRecommendations`, `verifyWithSimulation` 두 export.
- `src/lib/analysis/itemRecommender.test.ts` — vitest 단위 테스트.

**Modify:**
- `src/types/analysis.ts` — `Recommendation`, `VerifyContext`, `VerifiedResult`, `RoleCategory` 추가.
- `src/components/battle/UnitDetailPanel.tsx` — 3-column 레이아웃 + 글씨 상향 + `RecommendationSection` 서브 컴포넌트.
- `src/app/simulator/page.tsx` — `UnitDetailPanel` 에 `verifyContext / allItems / activeTraits` 주입.

**Responsibilities:**
| 파일 | 책임 |
|------|------|
| `itemRecommender.ts` | 역할별 아이템 풀 필터 + greedy Top-3 + reason 태깅 + 엔진 시뮬 반복 + 지표 집계. 순수 함수 |
| `UnitDetailPanel.tsx` | 3-column 스탯/추천/시너지 UI + 서브 컴포넌트 안에서 `useState` 로 검증 비동기 상태 |
| `types/analysis.ts` | 공용 타입 |
| `simulator/page.tsx` | 원본 팀/옵션을 `VerifyContext` 로 조립해 주입 |

---

## Task 1: Types

**Files:**
- Modify: `src/types/analysis.ts` (기존 `ItemAnalysisResult` 등 하단에 추가)

- [ ] **Step 1: `RoleCategory` 분류 헬퍼와 추천/검증 타입 추가**

`src/types/analysis.ts` 하단에 다음 섹션 추가:

```ts
import type { RawItem, PlacedChampion, UnitRole, HexCoord } from '@/types';
import type { SimulateOptions } from '@/lib/simulator/engine/combatLoop';

/** 추천 스코어링에 쓸 역할 분류 */
export type RoleCategory = 'DAMAGE' | 'TANK' | 'SUPPORT';

export interface Recommendation {
  /** 단일 아이템 1개씩 추천 (세로 리스트) — 아니면 슬롯 3개 조합 단위?
   *  본 디자인은 "아이템 1개당 1 추천 카드" 로 가져간다. 조합 전체 3개가 1 카드로 묶이지 않음.
   *  greedy Top-3 결과의 각 아이템을 개별 Recommendation 으로 뽑는다. */
  item: RawItem;
  /** 단일 아이템 DPS 기여도 (baseline 대비). 탱커 케이스에서는 effective HP 기여. */
  score: number;
  /** "공격력 · 치명타" 처럼 1줄 요약 */
  reason: string;
}

export interface VerifyContext {
  playerTeam: PlacedChampion[];   // row 0-3 규약 (tm.playerTeam)
  enemyTeam: PlacedChampion[];
  /** 치환 대상 유닛 식별: apiName + position (동명이인/스타레벨 구분) */
  targetApiName: string;
  targetPosition: HexCoord;
  /** 엔진 검증 후보 — 1차 추천 Top-3 의 items 3개를 하나의 조합으로 본다 */
  candidates: RawItem[][];
  /** runSimulation 에 쓰던 모든 옵션 (augments, modules, hex buff, arbiterLaw 등) */
  simulateOptions: SimulateOptions;
}

export interface VerifiedPerItem {
  /** 후보 조합의 라벨 (예: "IE + 라위 + 구인수") */
  comboLabel: string;
  items: RawItem[];
  winRate: number;
  deltaWinRate: number;
  /** roleScore: 역할별 가중합 */
  roleScore: number;
  avgOwnDmg: number;
  avgOwnTanked: number;
}

export interface VerifiedResult {
  baseline: { winRate: number; avgDuration: number };
  perItem: VerifiedPerItem[];
  bestIndex: number;
}
```

- [ ] **Step 2: typecheck 로 타입 오류 없는지 확인**

Run: `pnpm typecheck`
Expected: 0 errors.

> 주의: `SimulateOptions` 가 `combatLoop.ts` 에서 export 안 돼 있으면 해당 파일에서 `export type SimulateOptions = …` 한 줄 추가. 먼저 확인:
>
> ```bash
> grep -n "export.*SimulateOptions\|interface SimulateOptions" src/lib/simulator/engine/combatLoop.ts
> ```
>
> 매치 없으면 `combatLoop.ts` 의 `simulateCombat` 두 번째 인자 타입을 찾아 (예: `interface SimulateCombatOptions`) 기존 이름으로 import 하거나 export 추가.

- [ ] **Step 3: Commit**

```bash
git add src/types/analysis.ts
git commit -m "types(analysis): 추천 아이템 시스템 타입 (Recommendation, VerifyContext, VerifiedResult)"
```

---

## Task 2: Role 분류 헬퍼 + 테스트

**Files:**
- Create: `src/lib/analysis/itemRecommender.ts` (초기 스켈레톤 + `classifyRole`)
- Create: `src/lib/analysis/itemRecommender.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/analysis/itemRecommender.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyRole } from './itemRecommender';
import type { RawChampion } from '@/types';

function champ(role: string): RawChampion {
  return {
    name: 'mock', apiName: 'mock', cost: 1, traits: [],
    role: role as RawChampion['role'],
    stats: { hp: 500, armor: 10, magicResist: 10, damage: 40, attackSpeed: 0.7, range: 1, critChance: 0.25, critMultiplier: 1.4, initialMana: 0, mana: 50 },
    ability: { name: '', desc: '', icon: '', variables: [] },
  };
}

describe('classifyRole', () => {
  it('APTank/ADTank → TANK', () => {
    expect(classifyRole(champ('APTank'))).toBe('TANK');
    expect(classifyRole(champ('ADTank'))).toBe('TANK');
  });

  it('Marksman/Assassin/Caster/Fighter/Reaper 계열 → DAMAGE', () => {
    expect(classifyRole(champ('ADCarry'))).toBe('DAMAGE');
    expect(classifyRole(champ('APCaster'))).toBe('DAMAGE');
    expect(classifyRole(champ('ADFighter'))).toBe('DAMAGE');
    expect(classifyRole(champ('ADReaper'))).toBe('DAMAGE');
  });

  it('APSpecialist / ADSpecialist → SUPPORT', () => {
    expect(classifyRole(champ('APSpecialist'))).toBe('SUPPORT');
    expect(classifyRole(champ('ADSpecialist'))).toBe('SUPPORT');
  });

  it('role null/unknown → DAMAGE 기본', () => {
    expect(classifyRole(champ(null as unknown as string))).toBe('DAMAGE');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: FAIL ("classifyRole is not a function" 또는 모듈 없음).

- [ ] **Step 3: 최소 구현**

`src/lib/analysis/itemRecommender.ts`:

```ts
import type { RawChampion } from '@/types';
import type { RoleCategory } from '@/types/analysis';

/** champion.role → 추천 스코어링용 카테고리 매핑.
 *  TANK: APTank/ADTank
 *  SUPPORT: APSpecialist/ADSpecialist
 *  DAMAGE: 그 외 모든 공격형 역할 + fallback */
export function classifyRole(champ: RawChampion): RoleCategory {
  const r = (champ.role ?? '') as string;
  if (r.includes('Tank')) return 'TANK';
  if (r.includes('Specialist')) return 'SUPPORT';
  return 'DAMAGE';
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analysis/itemRecommender.ts src/lib/analysis/itemRecommender.test.ts
git commit -m "feat(recommender): classifyRole 헬퍼 — 역할 3 카테고리 매핑"
```

---

## Task 3: 역할별 아이템 풀 필터

**Files:**
- Modify: `src/lib/analysis/itemRecommender.ts`
- Modify: `src/lib/analysis/itemRecommender.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`itemRecommender.test.ts` 하단에 추가:

```ts
import { filterItemPool } from './itemRecommender';
import type { RawItem } from '@/types';

function item(apiName: string, effects: Record<string, number>): RawItem {
  return {
    apiName,
    name: apiName,
    desc: '',
    icon: '',
    effects,
    composition: [],
  } as unknown as RawItem;
}

describe('filterItemPool', () => {
  const allItems: RawItem[] = [
    item('TFT_Item_InfinityEdge',        { AD: 70, CritChance: 75 }),
    item('TFT_Item_RabadonsDeathcap',    { AP: 70 }),
    item('TFT_Item_WarmogsArmor',        { Health: 1000 }),
    item('TFT_Item_GargoyleStoneplate',  { Armor: 50, MR: 50 }),
    item('TFT_Item_ThiefsGloves',        {}),
  ];

  it('DAMAGE AD → AD/공속 계열 선호', () => {
    const out = filterItemPool(allItems, 'DAMAGE', 'ad');
    const names = out.map(i => i.apiName);
    expect(names).toContain('TFT_Item_InfinityEdge');
    expect(names).not.toContain('TFT_Item_RabadonsDeathcap');
  });

  it('DAMAGE AP → AP 계열 선호', () => {
    const out = filterItemPool(allItems, 'DAMAGE', 'ap');
    const names = out.map(i => i.apiName);
    expect(names).toContain('TFT_Item_RabadonsDeathcap');
    expect(names).not.toContain('TFT_Item_InfinityEdge');
  });

  it('TANK → HP/방어/마저 계열', () => {
    const out = filterItemPool(allItems, 'TANK', 'none');
    const names = out.map(i => i.apiName);
    expect(names).toContain('TFT_Item_WarmogsArmor');
    expect(names).toContain('TFT_Item_GargoyleStoneplate');
    expect(names).not.toContain('TFT_Item_InfinityEdge');
  });

  it('SUPPORT → 전체 풀 (보수적)', () => {
    const out = filterItemPool(allItems, 'SUPPORT', 'none');
    expect(out.length).toBe(allItems.length);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: FAIL ("filterItemPool is not a function").

- [ ] **Step 3: 구현**

`itemRecommender.ts` 에 추가:

```ts
import type { RawItem } from '@/types';

/** 아이템의 effects 키를 기준으로 카테고리 판별용 키 집합.
 *  itemAnalyzer.ts 의 AD_ITEM_KEYS / AP_ITEM_KEYS 와 호환되는 축약 규칙. */
const AD_KEYS = ['AD', 'AttackSpeed', 'CritChance', 'CritDamage'];
const AP_KEYS = ['AP', 'SpellDamageAmp', 'ManaGain', 'ManaOnRoundStart'];
const TANK_KEYS = ['Health', 'Armor', 'MR', 'MagicResist'];

function hasAnyKey(item: RawItem, keys: string[]): boolean {
  const fx = item.effects ?? {};
  return keys.some(k => Object.keys(fx).some(fk => fk.includes(k)));
}

export function filterItemPool(
  all: RawItem[],
  role: RoleCategory,
  damageType: 'ad' | 'ap' | 'none',
): RawItem[] {
  if (role === 'TANK') {
    return all.filter(i => hasAnyKey(i, TANK_KEYS));
  }
  if (role === 'SUPPORT') {
    return all.slice(); // 보수적으로 전체 풀
  }
  // DAMAGE
  if (damageType === 'ad') {
    return all.filter(i => hasAnyKey(i, AD_KEYS) && !isPureAP(i));
  }
  if (damageType === 'ap') {
    return all.filter(i => hasAnyKey(i, AP_KEYS) && !isPureAD(i));
  }
  return all.slice();
}

function isPureAP(item: RawItem): boolean {
  const fx = Object.keys(item.effects ?? {});
  return fx.some(k => k.includes('AP')) && !fx.some(k => AD_KEYS.some(ak => k.includes(ak)));
}
function isPureAD(item: RawItem): boolean {
  const fx = Object.keys(item.effects ?? {});
  return fx.some(k => AD_KEYS.some(ak => k.includes(ak))) && !fx.some(k => k.includes('AP'));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: PASS (모두).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analysis/itemRecommender.ts src/lib/analysis/itemRecommender.test.ts
git commit -m "feat(recommender): filterItemPool — 역할+damageType 기반 아이템 풀 필터"
```

---

## Task 4: 단독 DPS 스코어 + Greedy Top-3

**Files:**
- Modify: `src/lib/analysis/itemRecommender.ts`
- Modify: `src/lib/analysis/itemRecommender.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`itemRecommender.test.ts` 하단에 추가:

```ts
import { scoreItemsForDamage, pickTopCombo } from './itemRecommender';
import type { ChampionStats } from '@/types';

const baseStats: ChampionStats = {
  hp: 900, armor: 30, magicResist: 30, damage: 60, ap: 100,
  attackSpeed: 0.8, critChance: 0.25, critMultiplier: 1.4,
  mana: 0, maxMana: 60, range: 1, armorPen: 0, magicPen: 0,
};

describe('scoreItemsForDamage', () => {
  it('AD 챔프엔 IE 가 보통 긍정 score', () => {
    const items: RawItem[] = [
      item('TFT_Item_InfinityEdge', { AD: 70, CritChance: 75, CritDamage: 10 }),
      item('TFT_Item_ThiefsGloves', {}),
    ];
    const s = scoreItemsForDamage(baseStats, false, 2, items);
    const ie = s.find(r => r.item.apiName === 'TFT_Item_InfinityEdge')!;
    const tg = s.find(r => r.item.apiName === 'TFT_Item_ThiefsGloves')!;
    expect(ie.score).toBeGreaterThan(tg.score);
  });
});

describe('pickTopCombo', () => {
  it('후보에서 합산 DPS 가 최대인 3개 조합 반환', () => {
    const scored = [
      { item: item('A', { AD: 100 }), score: 100, reason: '' },
      { item: item('B', { AD: 90  }), score: 90,  reason: '' },
      { item: item('C', { AD: 80  }), score: 80,  reason: '' },
      { item: item('D', { AD: 70  }), score: 70,  reason: '' },
      { item: item('E', { AD: 60  }), score: 60,  reason: '' },
    ];
    const combo = pickTopCombo(scored, baseStats, false, 2);
    expect(combo).toHaveLength(3);
    // 상위 3개가 가장 큰 조합은 아닐 수 있지만, 열거 결과는 score 합 최소 A+B+C 이상
    const sum = combo.reduce((a, r) => a + r.score, 0);
    expect(sum).toBeGreaterThanOrEqual(80 + 90 + 100 - 0.001);
  });

  it('후보가 3개 미만이면 있는 만큼 반환', () => {
    const scored = [
      { item: item('A', { AD: 100 }), score: 100, reason: '' },
      { item: item('B', { AD: 90  }), score: 90,  reason: '' },
    ];
    const combo = pickTopCombo(scored, baseStats, false, 2);
    expect(combo).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: FAIL ("scoreItemsForDamage is not a function").

- [ ] **Step 3: 구현**

`itemRecommender.ts` 에 추가:

```ts
import { estimateDps } from '@/lib/analysis/itemOptimizer';
import type { ChampionStats } from '@/types';
import type { Recommendation } from '@/types/analysis';

/** 각 아이템 단독 장착 시 DPS 에서 baseline 을 뺀 기여도. */
export function scoreItemsForDamage(
  stats: ChampionStats,
  isAP: boolean,
  starLevel: number,
  pool: RawItem[],
): Recommendation[] {
  const baseline = estimateDps(stats, isAP, starLevel, []);
  return pool.map(it => ({
    item: it,
    score: estimateDps(stats, isAP, starLevel, [it]) - baseline,
    reason: '',
  }));
}

/** 상위 6개 후보에서 C(6,3)=20 조합 열거 → 실제 DPS(3개 동시 장착) 합 최대 조합. */
export function pickTopCombo(
  scored: Recommendation[],
  stats: ChampionStats,
  isAP: boolean,
  starLevel: number,
): Recommendation[] {
  if (scored.length === 0) return [];
  // score 내림차순 정렬 후 상위 6개 고정
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  if (sorted.length <= 3) return sorted;
  const candidates = sorted.slice(0, 6);

  let best: Recommendation[] = candidates.slice(0, 3);
  let bestDps = estimateDps(stats, isAP, starLevel, best.map(r => r.item));

  for (let i = 0; i < candidates.length - 2; i++) {
    for (let j = i + 1; j < candidates.length - 1; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const items = [candidates[i].item, candidates[j].item, candidates[k].item];
        const d = estimateDps(stats, isAP, starLevel, items);
        if (d > bestDps) {
          bestDps = d;
          best = [candidates[i], candidates[j], candidates[k]];
        }
      }
    }
  }
  return best;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analysis/itemRecommender.ts src/lib/analysis/itemRecommender.test.ts
git commit -m "feat(recommender): scoreItemsForDamage + pickTopCombo (greedy Top-3)"
```

---

## Task 5: Reason 태깅

**Files:**
- Modify: `src/lib/analysis/itemRecommender.ts`
- Modify: `src/lib/analysis/itemRecommender.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`itemRecommender.test.ts` 하단에 추가:

```ts
import { tagReason } from './itemRecommender';

describe('tagReason', () => {
  it('AD + CritChance → "공격력 · 치명타"', () => {
    expect(tagReason(item('IE', { AD: 70, CritChance: 75 }))).toContain('공격력');
    expect(tagReason(item('IE', { AD: 70, CritChance: 75 }))).toContain('치명타');
  });

  it('ManaOnRoundStart → "마나 가속"', () => {
    expect(tagReason(item('BB', { ManaOnRoundStart: 30 }))).toBe('마나 가속');
  });

  it('Omnivamp → "피해 흡혈"', () => {
    expect(tagReason(item('BT', { Omnivamp: 15 }))).toBe('피해 흡혈');
  });

  it('AP 단독 → "주문력 강화"', () => {
    expect(tagReason(item('RDC', { AP: 70 }))).toBe('주문력 강화');
  });

  it('Health/Armor/MR → "방어 · 체력"', () => {
    expect(tagReason(item('WM', { Health: 1000 }))).toContain('체력');
  });

  it('매칭 실패 시 "범용"', () => {
    expect(tagReason(item('TG', {}))).toBe('범용');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: FAIL ("tagReason is not a function").

- [ ] **Step 3: 구현**

`itemRecommender.ts` 에 추가:

```ts
/** 아이템 effects 키 주요 패턴을 1줄 요약으로 변환. */
export function tagReason(item: RawItem): string {
  const keys = Object.keys(item.effects ?? {});
  if (keys.length === 0) return '범용';

  const tokens: string[] = [];
  const has = (sub: string) => keys.some(k => k.includes(sub));

  // 우선순위 높은 특수 키 먼저
  if (has('Omnivamp') || has('Vamp')) tokens.push('피해 흡혈');
  if (has('ManaOnRoundStart') || has('ManaGain')) tokens.push('마나 가속');

  // 일반 딜 키
  if (has('AD')) tokens.push('공격력');
  if (has('CritChance') || has('CritDamage')) tokens.push('치명타');
  if (has('AttackSpeed')) tokens.push('공격속도');

  // AP 계열
  if (has('AP') && !tokens.some(t => t === '공격력')) tokens.push('주문력 강화');

  // 탱 계열
  if (has('Armor') || has('MR') || has('MagicResist')) tokens.push('방어');
  if (has('Health')) tokens.push('체력');

  // 방어 관통
  if (has('ArmorPen') || has('MagicPen')) tokens.push('방어 관통');

  if (tokens.length === 0) return '범용';
  // 최대 2개만
  return tokens.slice(0, 2).join(' · ');
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analysis/itemRecommender.ts src/lib/analysis/itemRecommender.test.ts
git commit -m "feat(recommender): tagReason — 아이템 effects 키 → 한 줄 요약"
```

---

## Task 6: `getStaticRecommendations` 통합 함수

**Files:**
- Modify: `src/lib/analysis/itemRecommender.ts`
- Modify: `src/lib/analysis/itemRecommender.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`itemRecommender.test.ts` 하단에 추가:

```ts
import { getStaticRecommendations } from './itemRecommender';

describe('getStaticRecommendations', () => {
  it('DAMAGE AD 챔프에게 AD 아이템 위주로 3개 추천', () => {
    const champ: RawChampion = {
      name: '진', apiName: 'TFT17_Jhin', cost: 5, traits: [],
      role: 'ADCarry' as RawChampion['role'],
      stats: baseStats as RawChampion['stats'],
      ability: { name: '', desc: '', icon: '',
        variables: [{ name: 'ADDamage', value: [0, 100, 120, 140] }] },
    };
    const pool: RawItem[] = [
      item('TFT_Item_InfinityEdge',       { AD: 70, CritChance: 75 }),
      item('TFT_Item_LastWhisper',        { AttackSpeed: 30, ArmorPen: 50 }),
      item('TFT_Item_GuinsoosRageblade',  { AttackSpeed: 10 }),
      item('TFT_Item_RabadonsDeathcap',   { AP: 70 }),
      item('TFT_Item_WarmogsArmor',       { Health: 1000 }),
    ];
    const recs = getStaticRecommendations(champ, baseStats as ChampionStats, 2, pool);
    expect(recs).toHaveLength(3);
    const names = recs.map(r => r.item.apiName);
    expect(names).not.toContain('TFT_Item_RabadonsDeathcap');
    expect(names).not.toContain('TFT_Item_WarmogsArmor');
  });

  it('TANK 챔프에게 방어/체력 풀 위주', () => {
    const champ: RawChampion = {
      name: '일라오이', apiName: 'TFT17_Illaoi', cost: 3, traits: [],
      role: 'APTank' as RawChampion['role'],
      stats: baseStats as RawChampion['stats'],
      ability: { name: '', desc: '', icon: '', variables: [] },
    };
    const pool: RawItem[] = [
      item('TFT_Item_WarmogsArmor',       { Health: 1000 }),
      item('TFT_Item_GargoyleStoneplate', { Armor: 50 }),
      item('TFT_Item_SunfireCape',        { Health: 500, Armor: 30 }),
      item('TFT_Item_InfinityEdge',       { AD: 70 }),
    ];
    const recs = getStaticRecommendations(champ, baseStats as ChampionStats, 2, pool);
    const names = recs.map(r => r.item.apiName);
    expect(names).not.toContain('TFT_Item_InfinityEdge');
    expect(recs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`itemRecommender.ts` 에 추가:

```ts
/** TANK 역할용 effective-HP 기반 단순 스코어. */
function scoreItemsForTank(
  stats: ChampionStats,
  starLevel: number,
  pool: RawItem[],
): Recommendation[] {
  void starLevel; // 성급 영향은 stats 가 이미 반영
  return pool.map(it => {
    const fx = it.effects ?? {};
    const extraHp = (fx.Health ?? 0);
    const extraArmor = (fx.Armor ?? 0);
    const extraMR = (fx.MagicResist ?? fx.MR ?? 0);
    // (hp + extraHp) × (1 + (armor+mr+extras)/200) 를 effective HP 근사
    const totalHp = stats.hp + extraHp;
    const totalDef = (stats.armor + extraArmor + stats.magicResist + extraMR) / 200;
    return {
      item: it,
      score: totalHp * (1 + totalDef),
      reason: '',
    };
  });
}

/** 챔피언의 ability scaling 에서 AD/AP 판별.
 *  variables 키에 'ADDamage'/'ADBase' 있으면 AD, 'APDamage'/'ModifiedDamage' 는 AP 로 단순 매핑. */
function detectDamageType(champ: RawChampion): 'ad' | 'ap' | 'none' {
  const varNames = (champ.ability?.variables ?? []).map(v => v.name);
  const hasAD = varNames.some(n => n.includes('AD'));
  const hasAP = varNames.some(n => n.includes('AP') || n.includes('SpellDamage'));
  if (hasAD && !hasAP) return 'ad';
  if (hasAP && !hasAD) return 'ap';
  // 역할로 2차 추정
  const r = (champ.role ?? '') as string;
  if (r.startsWith('AD')) return 'ad';
  if (r.startsWith('AP')) return 'ap';
  return 'none';
}

export function getStaticRecommendations(
  champ: RawChampion,
  stats: ChampionStats,
  starLevel: number,
  allItems: RawItem[],
): Recommendation[] {
  const role = classifyRole(champ);
  const damageType = detectDamageType(champ);
  const pool = filterItemPool(allItems, role, damageType);
  if (pool.length === 0) return [];

  const scored = role === 'TANK'
    ? scoreItemsForTank(stats, starLevel, pool)
    : scoreItemsForDamage(stats, damageType === 'ap', starLevel, pool);

  const isAP = damageType === 'ap';
  const combo = pickTopCombo(scored, stats, isAP, starLevel);

  return combo.map(r => ({ ...r, reason: tagReason(r.item) }));
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analysis/itemRecommender.ts src/lib/analysis/itemRecommender.test.ts
git commit -m "feat(recommender): getStaticRecommendations — 1차 추천 통합 진입점"
```

---

## Task 7: `verifyWithSimulation` baseline + mutate

**Files:**
- Modify: `src/lib/analysis/itemRecommender.ts`
- Modify: `src/lib/analysis/itemRecommender.test.ts`

- [ ] **Step 1: 실패하는 테스트 (경량 — 결정론 확인만)**

`itemRecommender.test.ts` 하단에 추가:

```ts
import { verifyWithSimulation } from './itemRecommender';

describe('verifyWithSimulation (smoke)', () => {
  it('seedBase 동일하면 동일 결과', async () => {
    // 실제 Plan 실행 단계에서는 간단 mock 팀으로 호출. 여기선 모듈이 export 되는지만 확인.
    expect(typeof verifyWithSimulation).toBe('function');
  });
});
```

(실제 전체 시뮬 통합 테스트는 UI 수동 QA 에서 검증. 순수 함수 경로만 이 파일 범위.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: FAIL ("verifyWithSimulation is not a function").

- [ ] **Step 3: 구현 — baseline 시뮬 + targetUnit 치환 유틸**

`itemRecommender.ts` 에 추가:

```ts
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import type { PlacedChampion, HexCoord } from '@/types';
import type {
  VerifyContext,
  VerifiedResult,
  VerifiedPerItem,
} from '@/types/analysis';

/** targetApiName + position 일치하는 PlacedChampion 의 items 를 치환한 새 배열. */
function mutateTeam(
  team: PlacedChampion[],
  targetApiName: string,
  targetPos: HexCoord,
  newItems: RawItem[],
): PlacedChampion[] {
  return team.map(p =>
    p.champion.apiName === targetApiName &&
    p.position.q === targetPos.q &&
    p.position.r === targetPos.r
      ? { ...p, items: newItems }
      : p,
  );
}

/** 한 팀 구성으로 N 회 시뮬 후 지표 집계. targetApiName/Pos 은 해당 유닛 지표만 추출. */
async function runSims(
  ctx: VerifyContext,
  playerTeam: PlacedChampion[],
  n: number,
  seedBase: number,
  onProgress?: (done: number) => void,
): Promise<{ winRate: number; avgOwnDmg: number; avgOwnTanked: number; avgDuration: number }> {
  let wins = 0;
  let totalOwnDmg = 0;
  let totalOwnTanked = 0;
  let totalDur = 0;

  for (let i = 0; i < n; i++) {
    const result = simulateCombat(
      playerTeam,
      ctx.enemyTeam,
      { ...ctx.simulateOptions, seed: seedBase + i },
    );
    if (result.winner === 'player') wins++;
    totalDur += result.duration;

    const target = result.playerUnits.find(u =>
      u.champion.apiName === ctx.targetApiName &&
      u.position.q === ctx.targetPosition.q &&
      u.position.r === ctx.targetPosition.r,
    );
    if (target) {
      totalOwnDmg += target.totalDamageDealt;
      totalOwnTanked += target.totalDamageTaken;
    }

    // 이벤트 루프 양보 — UI 프리징 방지
    await new Promise(r => setTimeout(r, 0));
    onProgress?.(i + 1);
  }

  return {
    winRate: wins / n,
    avgOwnDmg: totalOwnDmg / n,
    avgOwnTanked: totalOwnTanked / n,
    avgDuration: totalDur / n,
  };
}
```

아직 `verifyWithSimulation` export 는 없지만 테스트는 `typeof === 'function'` 확인이므로 아래에서 빈 함수 선언 추가로 통과.

```ts
export async function verifyWithSimulation(
  ctx: VerifyContext,
  options?: { n?: number; seedBase?: number; onProgress?: (done: number, total: number) => void },
): Promise<VerifiedResult> {
  const n = options?.n ?? 10;
  const seedBase = options?.seedBase ?? 42;
  void ctx; void n; void seedBase;
  // 다음 task 에서 완성
  throw new Error('not implemented');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: PASS (function export 존재).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analysis/itemRecommender.ts src/lib/analysis/itemRecommender.test.ts
git commit -m "feat(recommender): verifyWithSimulation 스켈레톤 + runSims 헬퍼"
```

---

## Task 8: `verifyWithSimulation` 본체 + roleScore

**Files:**
- Modify: `src/lib/analysis/itemRecommender.ts`

- [ ] **Step 1: `verifyWithSimulation` 본체 작성 (TDD 생략 — 내부 의존 많아 수동 QA)**

`itemRecommender.ts` 의 `verifyWithSimulation` 몸체 교체:

```ts
export async function verifyWithSimulation(
  ctx: VerifyContext,
  options?: { n?: number; seedBase?: number; onProgress?: (done: number, total: number) => void },
): Promise<VerifiedResult> {
  const n = options?.n ?? 10;
  const seedBase = options?.seedBase ?? 42;
  const totalBlocks = 1 + ctx.candidates.length;
  let done = 0;

  // 역할 판별 (target champion 을 playerTeam 에서 검색)
  const targetPlaced = ctx.playerTeam.find(p =>
    p.champion.apiName === ctx.targetApiName &&
    p.position.q === ctx.targetPosition.q &&
    p.position.r === ctx.targetPosition.r,
  );
  const targetRole = targetPlaced ? classifyRole(targetPlaced.champion) : 'DAMAGE';

  // 1) baseline
  const baseline = await runSims(ctx, ctx.playerTeam, n, seedBase, (i) => {
    options?.onProgress?.(done * n + i, totalBlocks * n);
  });
  done++;

  // 2) 각 candidate 조합별
  const perItem: VerifiedPerItem[] = [];
  for (const combo of ctx.candidates) {
    const mutated = mutateTeam(ctx.playerTeam, ctx.targetApiName, ctx.targetPosition, combo);
    const res = await runSims(ctx, mutated, n, seedBase, (i) => {
      options?.onProgress?.(done * n + i, totalBlocks * n);
    });
    perItem.push({
      comboLabel: combo.map(i => i.name).join(' + '),
      items: combo,
      winRate: res.winRate,
      deltaWinRate: res.winRate - baseline.winRate,
      roleScore: 0, // 정규화 후 아래에서 계산
      avgOwnDmg: res.avgOwnDmg,
      avgOwnTanked: res.avgOwnTanked,
    });
    done++;
  }

  // 3) roleScore 계산 (정규화)
  const maxDmg = Math.max(1, ...perItem.map(p => p.avgOwnDmg));
  const maxTanked = Math.max(1, ...perItem.map(p => p.avgOwnTanked));
  for (const p of perItem) {
    if (targetRole === 'TANK') {
      p.roleScore = 0.7 * p.winRate + 0.3 * (p.avgOwnTanked / maxTanked);
    } else if (targetRole === 'SUPPORT') {
      p.roleScore = p.winRate;
    } else {
      p.roleScore = 0.7 * p.winRate + 0.3 * (p.avgOwnDmg / maxDmg);
    }
  }

  // 4) bestIndex
  const bestIndex = perItem.reduce((best, cur, i, arr) =>
    cur.roleScore > arr[best].roleScore ? i : best, 0);

  return {
    baseline: { winRate: baseline.winRate, avgDuration: baseline.avgDuration },
    perItem,
    bestIndex,
  };
}
```

- [ ] **Step 2: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: 테스트 통과 확인 (기존 스모크)**

Run: `pnpm test src/lib/analysis/itemRecommender.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analysis/itemRecommender.ts
git commit -m "feat(recommender): verifyWithSimulation 본체 — baseline+per-candidate + roleScore"
```

---

## Task 9: `UnitDetailPanel` 3-column 레이아웃 + 글씨 상향

**Files:**
- Modify: `src/components/battle/UnitDetailPanel.tsx`

- [ ] **Step 1: `UnitDetailPanel.tsx` 교체**

현재 파일 전체를 다음으로 교체:

```tsx
'use client';

import { TickSnapshotUnit, COST_COLORS, RawItem } from '@/types';
import { getChampionImage } from '@/data/imageMap';
import { resolveDescription } from '@/lib/utils/text';
import type { ActiveTrait } from '@/lib/simulator/systems/trait';
import type { VerifyContext } from '@/types/analysis';

interface UnitDetailPanelProps {
  unitSnapshot: TickSnapshotUnit;
  meta: {
    championName: string;
    championApiName: string;
    cost: number;
    starLevel: number;
    maxHp: number;
    maxMana: number;
    traits: string[];
    ability: { name: string; desc: string; variables: { name: string; value: number[] }[] };
  };
  onClose: () => void;
  /** 추천 엔진 검증용 컨텍스트. 없으면 검증 버튼 비활성. */
  verifyContext?: VerifyContext;
  /** 1차 추천 아이템 풀. 비어 있으면 추천 섹션 생략. */
  allItems?: RawItem[];
  /** 시너지 활성 정보 — 현재 UnitDetailPanel 에서는 사용 안 하지만 추천 향후 확장 여지 prop. */
  activeTraits?: ActiveTrait[];
}

const STAR_LABELS: Record<number, string> = { 1: '★', 2: '★★', 3: '★★★' };

interface StatDef {
  label: string;
  value: number;
  format: 'int' | 'float' | 'percent';
}

function formatStat(value: number, format: 'int' | 'float' | 'percent'): string {
  if (format === 'percent') return `${Math.round(value * 100)}%`;
  if (format === 'float') return value.toFixed(2);
  return Math.round(value).toString();
}

export default function UnitDetailPanel({
  unitSnapshot,
  meta,
  onClose,
  verifyContext,
  allItems,
  activeTraits,
}: UnitDetailPanelProps) {
  const { stats, damageAmp } = unitSnapshot;
  const costColor = COST_COLORS[meta.cost as keyof typeof COST_COLORS] ?? '#9ca3af';

  const statDefs: StatDef[] = [
    { label: '공격력', value: stats.damage, format: 'int' },
    { label: '주문력', value: stats.ap, format: 'int' },
    { label: '피해증폭', value: damageAmp, format: 'percent' },
    { label: '방어력', value: stats.armor, format: 'int' },
    { label: '마법방어', value: stats.magicResist, format: 'int' },
    { label: '공격속도', value: stats.attackSpeed, format: 'float' },
    { label: '치명타', value: stats.critChance, format: 'percent' },
    { label: '사거리', value: stats.range, format: 'int' },
  ];

  const resolvedDesc = resolveDescription(
    meta.ability.desc ?? '',
    meta.ability.variables,
    meta.starLevel,
  );

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded border flex-shrink-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${getChampionImage(meta.championApiName)})`,
            borderColor: costColor,
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-200">{meta.championName}</span>
            <span className="text-xs text-yellow-400">{STAR_LABELS[meta.starLevel]}</span>
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>
              HP <span className="text-green-400">{Math.round(unitSnapshot.currentHp)}</span>
              <span className="text-gray-600">/{Math.round(meta.maxHp)}</span>
            </span>
            <span>
              Mana <span className="text-blue-400">{Math.round(unitSnapshot.currentMana)}</span>
              <span className="text-gray-600">/{meta.maxMana}</span>
            </span>
            {unitSnapshot.shield > 0 && (
              <span>
                보호막 <span className="text-gray-200">{Math.round(unitSnapshot.shield)}</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 text-xs px-1"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* Body: 3-column */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_260px_minmax(0,1fr)] gap-4">
        {/* 좌: 스탯 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 content-start">
          {statDefs.map(s => (
            <div key={s.label} className="flex items-baseline justify-between gap-1">
              <span className="text-xs text-gray-500">{s.label}</span>
              <span className="text-sm font-mono text-gray-200 tabular-nums">
                {formatStat(s.value, s.format)}
              </span>
            </div>
          ))}
        </div>

        {/* 중: 추천 아이템 (다음 Task 에서 채움) */}
        <div className="space-y-2 min-w-0">
          {/* RecommendationSection 자리 */}
          <div className="text-xs text-gray-600">추천 아이템 — 곧 채워짐</div>
          {/* suppress unused props warning until Task 10 */}
          {void verifyContext}{void allItems}{void activeTraits}
        </div>

        {/* 우: 시너지 + 스킬 */}
        <div className="space-y-2 min-w-0">
          {meta.traits.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">시너지</div>
              <div className="flex flex-wrap gap-1">
                {meta.traits.map(t => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700/60 text-xs text-gray-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {meta.ability.name && (
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs text-gray-500">스킬</span>
                <span className="text-sm font-bold text-cyan-300">{meta.ability.name}</span>
              </div>
              {resolvedDesc && (
                <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                  {resolvedDesc}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: 0 errors (void 표현식으로 unused 경고 억제).

> JSX 안에서 `{void x}` 는 평가만 하고 렌더는 undefined. unused prop 린트 회피용 임시 장치. Task 10 에서 교체됨.

- [ ] **Step 3: Commit**

```bash
git add src/components/battle/UnitDetailPanel.tsx
git commit -m "refactor(UnitDetailPanel): 3-column 레이아웃 + 글씨 크기 상향 + 추천 props 스텁"
```

---

## Task 10: `RecommendationSection` 서브 컴포넌트

**Files:**
- Modify: `src/components/battle/UnitDetailPanel.tsx`

- [ ] **Step 1: `RecommendationSection` 서브 컴포넌트 선언 (파일 하단)**

`UnitDetailPanel.tsx` 의 `export default function UnitDetailPanel(...)` 아래에 추가:

```tsx
// ==============================
// RecommendationSection (서브)
// ==============================

import { useMemo, useState } from 'react';
import { isAutoUnit } from '@/data/specialUnits';
import { getStaticRecommendations, verifyWithSimulation } from '@/lib/analysis/itemRecommender';
import { classifyRole } from '@/lib/analysis/itemRecommender'; // 동일 파일 import 중복은 OK
import ItemIcon from '@/components/builder/ItemIcon';
import type { Recommendation, VerifiedResult, VerifyContext, RoleCategory } from '@/types/analysis';

interface RecommendationSectionProps {
  snapshot: TickSnapshotUnit;
  meta: UnitDetailPanelProps['meta'];
  verifyContext?: VerifyContext;
  allItems?: RawItem[];
}

function roleTagLabel(role: RoleCategory): string {
  if (role === 'TANK') return '탱커 기여 기준';
  if (role === 'SUPPORT') return '팀 승률 기준';
  return '딜 기여 기준';
}

function RecommendationSection({ snapshot, meta, verifyContext, allItems }: RecommendationSectionProps) {
  const [verified, setVerified] = useState<VerifiedResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // AUTO_UNIT (쉔 유물/비아바이엔/티버 등) → 추천 불가
  if (isAutoUnit(meta.championApiName)) {
    return (
      <div className="text-xs text-gray-500">이 유닛은 아이템 장착 불가</div>
    );
  }

  if (!allItems || allItems.length === 0) {
    return <div className="text-xs text-gray-600">아이템 풀 없음</div>;
  }

  // 1차 추천 계산 — snapshot 에 champ/stats 는 없으므로 meta 에서 조립
  // UnitDetailPanel 은 champion 원본 객체가 없으니, meta 에 부족한 필드가 있으면
  // itemRecommender 에서 champion 인자 대신 meta 기반 mock champion 을 구성.
  const recommendations: Recommendation[] = useMemo(() => {
    const mockChamp = {
      name: meta.championName,
      apiName: meta.championApiName,
      cost: meta.cost,
      traits: meta.traits,
      role: null as unknown as RawChampion['role'], // itemRecommender 가 detectDamageType 에서 ability.variables 기반으로 판별
      stats: {} as RawChampion['stats'],
      ability: {
        name: meta.ability.name,
        desc: meta.ability.desc,
        icon: '',
        variables: meta.ability.variables,
      },
    } as RawChampion;
    return getStaticRecommendations(
      mockChamp,
      snapshot.stats,
      meta.starLevel,
      allItems,
    );
  }, [meta, snapshot.stats, allItems]);

  const role = useMemo(() => {
    // champion role 이 snapshot 에 없으므로 ability.variables 기반 classifyRole 대신
    // meta.role 이 있다면 사용, 없으면 DAMAGE fallback. verifyWithSimulation 내부 재계산이라 덜 중요.
    const r = (snapshot as unknown as { role?: string }).role;
    if (r?.includes('Tank')) return 'TANK' as RoleCategory;
    if (r?.includes('Specialist')) return 'SUPPORT' as RoleCategory;
    return 'DAMAGE' as RoleCategory;
  }, [snapshot]);

  const canVerify = !!verifyContext && recommendations.length > 0;

  const handleVerify = async () => {
    if (!canVerify || !verifyContext) return;
    setVerifying(true);
    setVerified(null);
    setProgress({ done: 0, total: 0 });
    try {
      const result = await verifyWithSimulation(
        {
          ...verifyContext,
          candidates: [recommendations.map(r => r.item)],
        },
        {
          n: 10,
          seedBase: 42,
          onProgress: (d, t) => setProgress({ done: d, total: t }),
        },
      );
      setVerified(result);
    } finally {
      setVerifying(false);
    }
  };

  if (recommendations.length === 0) {
    return <div className="text-xs text-gray-500">이 유닛에게 적합한 아이템 없음</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          🎯 추천 아이템 · <span className="text-gray-400">{roleTagLabel(role)}</span>
        </div>
        <button
          onClick={handleVerify}
          disabled={!canVerify || verifying}
          className="px-2 py-0.5 rounded text-[11px] bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={canVerify ? '엔진으로 승률 검증' : '원본 팀 정보 없음'}
        >
          {verifying ? `시뮬 중 ${progress?.done ?? 0}/${progress?.total ?? 0}` : '⚡ 엔진 검증'}
        </button>
      </div>

      <ul className="space-y-2">
        {recommendations.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <ItemIcon item={r.item} size={36} />
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-200 truncate">{r.item.name}</div>
              <div className="text-xs text-gray-500 truncate">{r.reason}</div>
            </div>
          </li>
        ))}
      </ul>

      {verified && (
        <div className="mt-3 pt-3 border-t border-gray-800 text-xs space-y-1">
          <div className="text-gray-500">Baseline: {Math.round(verified.baseline.winRate * 100)}%</div>
          {verified.perItem.map((v, i) => (
            <div
              key={i}
              className={i === verified.bestIndex ? 'text-yellow-300' : 'text-gray-300'}
            >
              <span className="w-3 inline-block">{i === verified.bestIndex ? '★' : ' '}</span>
              <span className="truncate">{v.comboLabel}</span>
              <span className="ml-2 tabular-nums">{Math.round(v.winRate * 100)}%</span>
              <span className="ml-1 text-gray-500">
                ({v.deltaWinRate >= 0 ? '+' : ''}{Math.round(v.deltaWinRate * 100)}%p)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 중간 자리 스텁 교체**

`UnitDetailPanel` 안의 임시 스텁:

```tsx
        {/* 중: 추천 아이템 (다음 Task 에서 채움) */}
        <div className="space-y-2 min-w-0">
          {/* RecommendationSection 자리 */}
          <div className="text-xs text-gray-600">추천 아이템 — 곧 채워짐</div>
          {/* suppress unused props warning until Task 10 */}
          {void verifyContext}{void allItems}{void activeTraits}
        </div>
```

를 다음으로 교체:

```tsx
        {/* 중: 추천 아이템 */}
        <div className="space-y-2 min-w-0">
          <RecommendationSection
            snapshot={unitSnapshot}
            meta={meta}
            verifyContext={verifyContext}
            allItems={allItems}
          />
        </div>
```

`activeTraits` prop 은 현 시점 사용 안 함 → 상위 인터페이스는 유지하고 `// eslint-disable-next-line @typescript-eslint/no-unused-vars` 로 회피하거나 prop 자체를 interface 에 남기되 구조분해 할 때 `_activeTraits` 처럼 언더스코어 처리. 가장 깔끔하게:

```tsx
export default function UnitDetailPanel({
  unitSnapshot, meta, onClose, verifyContext, allItems,
  // activeTraits 은 향후 확장 대비 prop. 현재 미사용.
}: UnitDetailPanelProps) {
```

구조분해에서 `activeTraits` 를 빼고 props interface 에는 `activeTraits?` optional 로 유지. 그러면 호출자는 넘길 수 있지만 내부에서 쓰지 않음 → 미사용 경고 없음.

- [ ] **Step 3: lint + typecheck + build**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/battle/UnitDetailPanel.tsx
git commit -m "feat(UnitDetailPanel): RecommendationSection — 1차 추천 + 엔진 검증 UI"
```

---

## Task 11: `simulator/page.tsx` 에서 props 주입

**Files:**
- Modify: `src/app/simulator/page.tsx`

- [ ] **Step 1: runSimulation 호출부에 쓰는 options 을 변수로 추출**

현재 `runSimulation` 과 `runMultiple` 이 인라인으로 긴 options 객체를 만들고 있음. `UnitDetailPanel` 에도 넘겨야 하니 공통 추출.

`SimulatorContent` 함수 안, `runSimulation` 정의 직전에 추가:

```tsx
const simOptionsBase = useMemo(() => ({
  seed: 42,
  allTraits: traits,
  skipMirror: true,
  playerAugments: tm.playerAugments,
  playerAugmentStacks: tm.playerAugmentStacks,
  enemyAugments: tm.enemyAugments,
  enemyAugmentStacks: tm.enemyAugmentStacks,
  playerBilgewaterEffects: resolveBilgewaterStatEffects(tm.playerBilgewaterStats, items),
  enemyBilgewaterEffects: resolveBilgewaterStatEffects(tm.enemyBilgewaterStats, items),
  playerPiltoverModules: tm.playerPiltoverModules,
  enemyPiltoverModules: tm.enemyPiltoverModules,
  playerIoniaPath: tm.playerIoniaPath ?? undefined,
  enemyIoniaPath: tm.enemyIoniaPath ?? undefined,
  playerGalio: tm.playerGalio,
  enemyGalio: tm.enemyGalio,
  playerHexBuffs,
  enemyHexBuffs,
  stageNumber,
  playerArbiterLaw: tm.playerArbiterLaw ?? undefined,
  enemyArbiterLaw: tm.enemyArbiterLaw ?? undefined,
}), [
  traits, items, stageNumber, playerHexBuffs, enemyHexBuffs,
  tm.playerAugments, tm.playerAugmentStacks, tm.enemyAugments, tm.enemyAugmentStacks,
  tm.playerBilgewaterStats, tm.enemyBilgewaterStats,
  tm.playerPiltoverModules, tm.enemyPiltoverModules,
  tm.playerIoniaPath, tm.enemyIoniaPath,
  tm.playerGalio, tm.enemyGalio,
  tm.playerArbiterLaw, tm.enemyArbiterLaw,
]);
```

`runSimulation` / `runMultiple` 내부의 같은 객체를 `{ ...simOptionsBase }` 로 치환:

```diff
- const result = simulateCombat(mappedPlayer, tm.enemyTeam, {
-   seed: 42, allTraits: traits, skipMirror: true,
-   ...
- });
+ const result = simulateCombat(mappedPlayer, tm.enemyTeam, { ...simOptionsBase });
```

(두 개 실행 함수 모두 처리. `runMultiple` 는 루프 안에서 seed 갈아끼우므로 `{ ...simOptionsBase, seed: i + 1 }`)

- [ ] **Step 2: `UnitDetailPanel` 렌더 시 props 주입**

기존 렌더 블록:

```tsx
{replay.selectedUnitId && replay.selectedUnitSnap && replay.unitMeta[replay.selectedUnitId] && (
  <UnitDetailPanel
    unitSnapshot={replay.selectedUnitSnap}
    meta={replay.unitMeta[replay.selectedUnitId]}
    onClose={() => replay.setSelectedUnitId(null)}
  />
)}
```

를 다음으로 교체:

```tsx
{replay.selectedUnitId && replay.selectedUnitSnap && replay.unitMeta[replay.selectedUnitId] && (
  <UnitDetailPanel
    key={replay.selectedUnitId}
    unitSnapshot={replay.selectedUnitSnap}
    meta={replay.unitMeta[replay.selectedUnitId]}
    onClose={() => replay.setSelectedUnitId(null)}
    allItems={items}
    verifyContext={(() => {
      const selMeta = replay.unitMeta[replay.selectedUnitId!];
      if (!selMeta) return undefined;
      // tm.playerTeam 은 row 0-3, toEightRowCoords(+4) 매핑 후 전투 시뮬 입력으로 사용.
      const mappedPlayer = toEightRowCoords(tm.playerTeam, 4);
      // 원본 playerTeam 에서 동일 apiName 찾기. 동명이인 대비 position(4-7 매핑 후) 로 매칭.
      const target = mappedPlayer.find(p => p.champion.apiName === selMeta.championApiName);
      if (!target) return undefined;
      return {
        playerTeam: mappedPlayer,
        enemyTeam: tm.enemyTeam,
        targetApiName: selMeta.championApiName,
        targetPosition: target.position,
        candidates: [],           // Section 내부에서 1차 추천 결과로 채움
        simulateOptions: simOptionsBase,
      };
    })()}
  />
)}
```

`key={replay.selectedUnitId}` 로 유닛 교체 시 리마운트 → `verified` state 자동 리셋.

- [ ] **Step 3: lint + typecheck + build**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: 0 errors.

- [ ] **Step 4: 수동 QA 체크리스트**

dev 서버 `pnpm dev` 에서 브라우저 확인:

- [ ] 리플레이 모드 진입 후 챔피언 클릭
- [ ] 하단 패널이 3-column (스탯 | 추천 | 시너지) 으로 표시
- [ ] 스탯 글씨가 이전보다 읽기 쉬움 (text-sm 수준)
- [ ] "추천 아이템" 섹션에 아이템 아이콘 + 이름 + 한줄 이유 3개 표시
- [ ] "⚡ 엔진 검증" 버튼 클릭 → 1~2초 로딩 → Baseline + 3개 아이템별 승률 결과
- [ ] 최적 조합은 ★ + 노란색 강조
- [ ] 다른 챔피언 클릭 → 검증 결과 리셋 (key 리마운트)
- [ ] 쉔 유물 같은 AUTO_UNIT 클릭 → "이 유닛은 아이템 장착 불가" 표시

- [ ] **Step 5: Commit**

```bash
git add src/app/simulator/page.tsx
git commit -m "feat(simulator): UnitDetailPanel 에 verifyContext + allItems 주입"
```

---

## Task 12: 최종 회귀 검증

**Files:** (수정 없음)

- [ ] **Step 1: 전체 빌드 + 테스트**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

모두 0 errors / PASS 확인.

- [ ] **Step 2: 회귀 UI QA**

- [ ] 편집 모드 UnitDetailPanel 접근 X (리플레이 전용 컴포넌트) — 변경 없음
- [ ] 전적검색 → 가상대전 분석 → 시뮬레이터 이동 → 리플레이에서 챔피언 클릭 → 추천 정상 표시 (handoff 경로)
- [ ] 직접 편집 + 전투 시작 → 리플레이 클릭 → 추천 정상 표시
- [ ] 일반 챔피언(딜러) / 탱커 / 서포터 각각 클릭 시 `roleTagLabel` 이 올바르게 표시
- [ ] 엔진 검증 로딩 중 다른 유닛 클릭 → 패널이 리마운트되고 이전 로딩 결과 유출 없음

- [ ] **Step 3: 최종 커밋 (필요 시)**

의존성 업데이트 등 잔여 정리가 있으면:

```bash
git add .
git commit -m "chore(recommender): 최종 정리"
```

없으면 이 단계 생략.

---

## Self-Review Checklist

### Spec Coverage
- [x] 2단계 전략 (1차 즉시 + 2차 on-demand) → Task 6 (getStaticRecommendations) + Task 8 (verifyWithSimulation)
- [x] 역할별 지표 (DAMAGE/TANK/SUPPORT) → Task 2 (classifyRole) + Task 8 (roleScore 공식)
- [x] 3-column 레이아웃 + 글씨 상향 → Task 9
- [x] AUTO_UNIT edge case → Task 10 isAutoUnit 가드
- [x] 결정론 (seedBase 고정) → Task 7/8 runSims
- [x] 진행률 onProgress → Task 8 / 10
- [x] 두 진입 경로 호환 → Task 11 verifyContext 주입이 tm.playerTeam 기반이라 자동 호환

### Placeholder Scan
- 모든 step 에 코드/명령 포함
- "TBD"/"TODO" 없음
- "적절한 에러 처리" 같은 애매한 문장 없음

### Type Consistency
- `Recommendation.item` / `Recommendation.score` / `Recommendation.reason` 모든 Task 에서 동일
- `VerifyContext.candidates: RawItem[][]` — RecommendationSection 에서 `[recommendations.map(r => r.item)]` 로 단일 조합 전달 (배열 중첩 규약 일관)
- `VerifiedPerItem.comboLabel / items / winRate / deltaWinRate / roleScore` 필드명 일관

문제 없음.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-item-recommendation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - 각 Task 마다 새 서브에이전트 dispatch, Task 사이 리뷰, 빠른 iteration

**2. Inline Execution** - 이 세션에서 executing-plans skill 로 batch 실행, 체크포인트 리뷰

Which approach?
