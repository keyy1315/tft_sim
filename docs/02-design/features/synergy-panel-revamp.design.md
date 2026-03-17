# Design: synergy-panel-revamp — 시너지 패널 UI 개편 + 필트오버/빌지워터 티어별 모듈 시스템

> Plan: `docs/01-plan/features/synergy-panel-revamp.plan.md`

---

## 1. 데이터 레이어

### 1.1 trait 이미지 매핑 수정 — `src/data/imageMap.ts`

**문제**: `getTraitImage('TFT16_Freljord')` → `TFT16_Freljord.png` (존재하지 않음)
**실제 파일**: `trait_icon_16_freljord.tft_set16.png`

**해법**: `registerTraitImages()` 패턴 (아이템과 동일 방식)

```ts
const traitImageCache = new Map<string, string>();

export function registerTraitImages(traits: { apiName: string; icon: string }[]): void {
  for (const t of traits) {
    const parts = t.icon.split('/');
    const filename = parts[parts.length - 1].toLowerCase();
    traitImageCache.set(t.apiName, `/data/images/traits/${filename}`);
  }
}

export function getTraitImage(apiName: string): string {
  return traitImageCache.get(apiName) ?? `/data/images/traits/${apiName}.png`;
}
```

**호출 위치**: `useGameData.ts` 또는 `useTraits()` hook 내부에서 traits 로드 후 `registerTraitImages(traits)` 호출.

### 1.2 필트오버 티어별 모듈 상수 — `src/data/traitModules.ts` (신규)

```ts
/** 필트오버 시너지 단계별 선택 가능 모듈 (apiName suffix) */
export const PILTOVER_MODULE_TIERS: Record<number, string[]> = {
  2: [
    'TFT16_Item_Piltover_90CaliberNets',
    'TFT16_Item_Piltover_BlastShield',
    'TFT16_Item_Piltover_ElectricalOverload',
    'TFT16_Item_Piltover_EMP',
    'TFT16_Item_Piltover_OverclockedCapacitors',
    'TFT16_Item_Piltover_TunedOscillator',
    'TFT16_Item_Piltover_ContinuumCogs',
  ],
  4: [
    'TFT16_Item_Piltover_GigantificationRay',
    'TFT16_Item_Piltover_KineticBarrier',
    'TFT16_Item_Piltover_MagnetronCoil',
    'TFT16_Item_Piltover_MicroRockets',
    'TFT16_Item_Piltover_AccelerationGate',
  ],
  6: [
    'TFT16_Item_Piltover_Upgrade',
    'TFT16_Item_Piltover_ArmorNullifier',
    'TFT16_Item_Piltover_EchoEngine',
    'TFT16_Item_Piltover_MiningDrill',
    'TFT16_Item_Piltover_SuperiorLifeform',
  ],
};

/** 주어진 필트오버 시너지 활성화 수에 따라 선택 가능한 티어들 반환 */
export function getAvailablePiltoverTiers(piltoverCount: number): number[] {
  const tiers: number[] = [];
  if (piltoverCount >= 2) tiers.push(2);
  if (piltoverCount >= 4) tiers.push(4);
  if (piltoverCount >= 6) tiers.push(6);
  return tiers;
}

/** 주어진 티어에서 선택 가능한 모듈 apiName 목록 반환 */
export function getModulesForTier(tier: number): string[] {
  return PILTOVER_MODULE_TIERS[tier] ?? [];
}

/** 빌지워터 능력치(스탯) 아이템인지 판별 — apiName에 Tier가 포함 */
export function isBilgewaterStatItem(apiName: string): boolean {
  return apiName.includes('TFT16_Item_Bilgewater_') && /Tier\d/.test(apiName);
}

/** 빌지워터 명명 아이템인지 판별 (장비형 아이템) */
export function isBilgewaterNamedItem(apiName: string): boolean {
  return apiName.includes('TFT16_Item_Bilgewater_') && !/Tier\d/.test(apiName);
}
```

### 1.3 빌지워터 능력치 아이템 효과 매핑

아이템 JSON 효과값 → 스탯 적용 매핑:

| 효과 키 | 적용 스탯 | 예시 값 (Tier1/2/3) |
|---------|----------|-------------------|
| `BonusAD` | 공격력 % | 5%/8%/13% (AD 아이템) |
| `BonusAP` | 주문력 (flat) | 6/10/18 (AP 아이템) |
| `BonusAS` | 공격 속도 % | 4%/6%/8% |
| `BonusHealthPercent` | 최대 체력 % | 4%/6%/8% |
| `BonusArmorMR` | 방어력+마저 (flat) | 5/8/13 |
| `BonusAD` + `BonusAP` | 공격력 % + 주문력 | 3%+3 / 5%+5 / 7%+7 (ADAP) |

---

## 2. 상태 관리

### 2.1 빌지워터 능력치 구매 상태 — `useTeamManagement.ts`

```ts
// 추가할 상태
const [playerBilgewaterStats, setPlayerBilgewaterStats] = useState<Record<string, number>>({});
const [enemyBilgewaterStats, setEnemyBilgewaterStats] = useState<Record<string, number>>({});

// 핸들러
const handleBuyBilgewaterStat = (team: 'player' | 'enemy', item: RawItem) => {
  const setStat = team === 'player' ? setPlayerBilgewaterStats : setEnemyBilgewaterStats;
  setStat(prev => ({
    ...prev,
    [item.apiName]: (prev[item.apiName] ?? 0) + 1,
  }));
};

const handleRemoveBilgewaterStat = (team: 'player' | 'enemy', apiName: string) => {
  const setStat = team === 'player' ? setPlayerBilgewaterStats : setEnemyBilgewaterStats;
  setStat(prev => {
    const next = { ...prev };
    if (next[apiName] && next[apiName] > 1) {
      next[apiName]--;
    } else {
      delete next[apiName];
    }
    return next;
  });
};
```

**return에 추가**: `playerBilgewaterStats`, `enemyBilgewaterStats`, `handleBuyBilgewaterStat`, `handleRemoveBilgewaterStat`

**resetAll에 추가**: `setPlayerBilgewaterStats({})`, `setEnemyBilgewaterStats({})`

### 2.2 빌지워터 능력치 합산 함수

```ts
// src/data/traitModules.ts 또는 별도 유틸
export function sumBilgewaterEffects(
  purchases: Record<string, number>,
  allItems: RawItem[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [apiName, count] of Object.entries(purchases)) {
    const item = allItems.find(i => i.apiName === apiName);
    if (!item) continue;
    for (const [key, value] of Object.entries(item.effects)) {
      if (typeof value === 'number') {
        totals[key] = (totals[key] ?? 0) + value * count;
      }
    }
  }
  return totals;
}
```

---

## 3. UI 컴포넌트

### 3.1 SynergyPanel 개편 — `src/components/builder/SynergyPanel.tsx`

**변경 사항:**

1. **trait 아이콘 추가**: 숫자 카운트 배지 대신 `getTraitImage()` 아이콘 사용
2. **등급 배경색**: `TRAIT_STYLE_COLORS` 기반 배경 그라데이션
3. **Tooltip 감싸기**: 각 시너지 행을 `<Tooltip>`으로 감싸서 hover 시 상세 정보

**시너지 행 구조 변경:**

```
Before: [카운트 배지] [시너지명] [진행도]
After:  [trait 아이콘 16x16] [시너지명] [진행도]  ← 행 전체 배경색 = 등급색
        └ hover → Tooltip: 전 단계 능력치 테이블 + 설명
```

**아이콘 표시**: `<Image src={getTraitImage(at.trait.apiName)} width={16} height={16} />`

**등급 배경색**: 현재 `bg-[#1f2937]` → `backgroundColor: ${color}20` (등급색 투명도 12%)

**Tooltip 컨텐츠 (SynergyTooltipContent 내부 컴포넌트)**:
```
┌─────────────────────────────────┐
│ [아이콘] 프렐요드              │
│                                 │
│ (3) 포탑 1개 / 체력 5% / 피해 8% │ ← 현재 활성 단계 하이라이트
│ (5) 포탑 2개 / 체력 10% / 피해 15% │
│ (7) 포탑 2개 / 체력 18% / 피해 25% │
│                                 │
│ 프렐요드의 고유 설명 텍스트...   │
└─────────────────────────────────┘
```

**각 단계 표시**: `trait.effects[]` 순회, `minUnits` 표시, 현재 `at.activeEffect`와 일치하는 단계에 하이라이트 (예: `text-yellow-300 font-bold`)

### 3.2 TraitEffectDetail 변경 — `src/components/builder/TraitEffectDetail.tsx`

- `specialItems` 표시 제거 (FR-07)
- `TFT16_Piltover`, `TFT16_Bilgewater` 항목에서 아이템 목록 리턴하지 않음
- 인라인 label 텍스트는 유지 (Tooltip과 별개로 시너지 카드 아래 간단 요약)
- 필트오버: 선택된 모듈 아이콘 표시 (PiltoverModulePanel에서 가져옴)
- 빌지워터: 중첩된 총 능력치 요약 표시

### 3.3 PiltoverModulePanel 티어 필터 — `src/components/builder/PiltoverModulePanel.tsx`

**변경**: 모듈 선택 팝업에서 전체 필트오버 아이템 대신 티어별 필터링

**로직**:
```ts
const piltoverTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Piltover');
const piltoverCount = piltoverTrait?.count ?? 0;
const availableTiers = getAvailablePiltoverTiers(piltoverCount);

// 선택 가능한 모듈 = 활성 티어들의 모듈 합집합
const allowedApiNames = new Set(
  availableTiers.flatMap(tier => getModulesForTier(tier))
);

// 모듈 선택 팝업 필터
const availableModules = allItems.filter(i =>
  getItemCategory(i) === 'piltover' && allowedApiNames.has(i.apiName)
);
```

**티어 구분 UI**: 팝업 내에서 티어별 섹션 헤더 (2필트오버 / 4필트오버 / 6필트오버)

### 3.4 빌지워터 아이템 탭 — `page.tsx` 아이템 풀 영역

**조건**: `playerTraits` 또는 `enemyTraits`에서 `TFT16_Bilgewater`가 active

**탭 추가**: 기존 `'champions' | 'items'` → `'champions' | 'items' | 'bilgewater'`

**빌지워터 탭 내용**:
1. **능력치 아이템 섹션** (드래그 불가, 클릭 전용)
   - 6종 × 3티어 = 18개
   - 클릭 → `handleBuyBilgewaterStat(team, item)`
   - 각 아이콘에 구매 횟수 배지 표시
   - 우클릭 → 1개 제거

2. **명명 아이템 섹션** (기존 드래그 가능)
   - `isBilgewaterNamedItem()` 필터
   - 기존 `DraggableItemIcon` 사용

### 3.5 빌지워터 능력치 요약 표시 — SynergyPanel 내부

빌지워터 시너지 카드 하단에:
```
주문력: +16 | 공격력: +10% | 체력: +8% | 공격 속도: +6%
```

`sumBilgewaterEffects()` 결과를 포맷팅하여 표시.

---

## 4. 전투 시뮬레이션 반영

### 4.1 SimulateOptions 확장

```ts
// combatLoop.ts
export interface SimulateOptions {
  // ... 기존 필드
  playerBilgewaterStats?: Record<string, number>;  // 추가
  enemyBilgewaterStats?: Record<string, number>;   // 추가
}
```

### 4.2 createCombatUnit에 빌지워터 스탯 반영

```ts
// combatLoop.ts - simulateCombat 내부
const playerBWEffects = resolveBilgewaterStatEffects(
  options.playerBilgewaterStats ?? {},
  allItems
);

// createCombatUnit 호출 시
// 빌지워터 trait을 가진 유닛에만 적용
const unit = createCombatUnit(p, 'player', i, playerActiveTraits, playerAugmentEffects);
if (p.champion.traits.includes('빌지워터')) {
  applyBilgewaterStats(unit, playerBWEffects);
}
```

### 4.3 빌지워터 스탯 적용 함수 — `stat.ts`

```ts
export function resolveBilgewaterStatEffects(
  purchases: Record<string, number>,
  allItems: RawItem[]
): ItemEffect {
  const result: ItemEffect = {};
  for (const [apiName, count] of Object.entries(purchases)) {
    const item = allItems.find(i => i.apiName === apiName);
    if (!item) continue;
    for (const [key, value] of Object.entries(item.effects)) {
      if (typeof value !== 'number') continue;
      // 효과 키 → ItemEffect 키 매핑
      if (key === 'BonusAD') result.ad = (result.ad ?? 0) + value * count;
      if (key === 'BonusAP') result.ap = (result.ap ?? 0) + value * count;
      if (key === 'BonusAS') result.as = (result.as ?? 0) + value * count;
      if (key === 'BonusHealthPercent') result.hp = (result.hp ?? 0) + value * count;
      if (key === 'BonusArmorMR') {
        result.armor = (result.armor ?? 0) + value * count;
        result.magicResist = (result.magicResist ?? 0) + value * count;
      }
    }
  }
  return result;
}
```

**적용 방식**: `calculateStats`의 `augmentEffects` 파라미터에 합산하여 전달하거나, 별도로 `CombatUnit.stats`에 직접 적용.

→ **결정**: `augmentEffects`와 동일한 `ItemEffect` 타입이므로, 빌지워터 유닛의 `augmentEffects`에 merge하여 `calculateStats`에 전달하는 것이 가장 깔끔.

---

## 5. 파일별 변경 상세

| # | 파일 | 작업 | 의존성 |
|---|------|------|--------|
| 1 | `src/data/imageMap.ts` | `registerTraitImages()` + `getTraitImage()` 캐시 방식 수정 | - |
| 2 | `src/data/traitModules.ts` | **신규** — 필트오버 티어 상수 + 빌지워터 아이템 식별 + 합산 함수 | - |
| 3 | `src/hooks/useGameData.ts` | traits 로드 후 `registerTraitImages()` 호출 | #1 |
| 4 | `src/components/builder/SynergyPanel.tsx` | 아이콘 + 등급 배경색 + Tooltip | #1 |
| 5 | `src/components/builder/TraitEffectDetail.tsx` | specialItems 제거 + 필트오버 모듈/빌지워터 요약 표시 | #2 |
| 6 | `src/components/builder/PiltoverModulePanel.tsx` | 티어별 필터 | #2 |
| 7 | `src/hooks/useTeamManagement.ts` | 빌지워터 구매 상태 + 핸들러 | - |
| 8 | `src/app/simulator/page.tsx` | 빌지워터 탭 추가 + simulateCombat에 데이터 전달 | #2, #7 |
| 9 | `src/lib/simulator/systems/stat.ts` | `resolveBilgewaterStatEffects()` | - |
| 10 | `src/lib/simulator/engine/combatLoop.ts` | SimulateOptions 확장 + 빌지워터 유닛 스탯 반영 | #9 |

---

## 6. 구현 순서

1. `src/data/traitModules.ts` — 상수 + 유틸 함수 (의존성 없음)
2. `src/data/imageMap.ts` — `registerTraitImages()` 추가
3. `src/hooks/useGameData.ts` — `registerTraitImages()` 호출
4. `src/components/builder/SynergyPanel.tsx` — 아이콘 + 배경색 + Tooltip
5. `src/components/builder/TraitEffectDetail.tsx` — specialItems 제거
6. `src/components/builder/PiltoverModulePanel.tsx` — 티어별 필터
7. `src/hooks/useTeamManagement.ts` — 빌지워터 구매 상태
8. `src/app/simulator/page.tsx` — 빌지워터 탭 + 패널 통합
9. `src/lib/simulator/systems/stat.ts` — `resolveBilgewaterStatEffects()`
10. `src/lib/simulator/engine/combatLoop.ts` — SimulateOptions + 적용
11. 검증: `pnpm lint && pnpm typecheck && pnpm build`

---

## 7. 검증 기준

- [ ] trait 아이콘이 SynergyPanel에 정상 렌더링
- [ ] 등급별 배경색 (브론즈/실버/골드/프리즘) 적용
- [ ] hover → 전 단계 효과 Tooltip + 현재 단계 하이라이트
- [ ] 필트오버 2/4/6 시너지별 정확한 모듈만 팝업 표시
- [ ] 빌지워터 활성화 → 아이템 풀에 빌지워터 탭 등장
- [ ] 능력치 아이템 클릭 → 중첩 증가 + 배지 표시
- [ ] 능력치 우클릭 → 1개 감소
- [ ] 시너지 카드 하단: 필트오버 모듈 아이콘 / 빌지워터 총 능력 요약
- [ ] 시너지 카드에서 전체 아이템 목록 제거됨
- [ ] 전투 시뮬레이션에서 빌지워터 능력치 반영 확인
- [ ] lint 0 errors + build 성공
