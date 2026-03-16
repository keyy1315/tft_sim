# Design: 아이템 장착 제한 시스템 (Item Equip Restriction)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 아이템 장착 제한 시스템 |
| Plan 참조 | `docs/01-plan/features/item-equip-restriction.plan.md` |
| 작성일 | 2026-03-16 |
| 상태 | Design |

| 관점 | 내용 |
|------|------|
| **Problem** | 168개 전체 아이템을 아무 챔피언에게나 무제한 장착 가능 |
| **Solution** | 6개 카테고리별 장착 규칙 검증 + 필트오버 팀 모듈 + 빌지워터 시너지 조건부 장착 |
| **Function UX Effect** | 불가 아이템 회색 처리, 사유 툴팁, 필트오버 모듈 슬롯 패널 |
| **Core Value** | 실제 TFT Set 16 아이템 규칙과 100% 일치하는 시뮬레이션 |

---

## 1. 아이템 카테고리 분류 체계

### 1.1 `ItemCategory` 타입 정의

**파일**: `src/types/index.ts`

```typescript
export type ItemCategory =
  | 'component'    // 조합재료 (10개) — composition.length === 0, no TFT16_ prefix
  | 'combined'     // 완성템 (49개) — composition.length === 2
  | 'artifact'     // 유물 (36개) — apiName includes '_Artifact_'
  | 'piltover'     // 필트오버 모듈 (20개) — apiName includes 'Piltover'
  | 'bilgewater'   // 빌지워터 아이템 (34개) — apiName includes 'Bilgewater'
  | 'special';     // 특수 (1개: 공간 왜곡) — 나머지 TFT16_ 아이템
```

### 1.2 카테고리별 장착 규칙

| 카테고리 | 챔피언 장착 | 제한 조건 | 슬롯 |
|---------|:---------:|---------|------|
| component | ✅ | 없음 | 일반 아이템 슬롯 (3개) |
| combined | ✅ | 없음 | 일반 아이템 슬롯 (3개) |
| artifact | ✅ | **챔피언당 유물 1개만** | 일반 아이템 슬롯 (3개) 공유 |
| piltover | ❌ | 팀 모듈 슬롯에 배치, 시너지 2/4/6 필요 | **별도 팀 모듈 슬롯** |
| bilgewater | ✅ | **빌지워터 시너지 활성 시에만** | 일반 아이템 슬롯 (3개) |
| special | ❌ | 장착 불가 (비전투 아이템) | — |

---

## 2. 검증 함수 설계

### 2.1 `canEquipItem` 함수

**파일**: `src/lib/simulator/systems/item.ts`

```typescript
export interface EquipValidation {
  canEquip: boolean;
  reason?: string;
}

export function canEquipItem(
  item: RawItem,
  champion: PlacedChampion,
  activeTraits: ActiveTrait[],
): EquipValidation {
  const category = getItemCategory(item);

  // 1. 특수 아이템 → 장착 불가
  if (category === 'special') {
    return { canEquip: false, reason: '특수 아이템은 장착할 수 없습니다' };
  }

  // 2. 필트오버 모듈 → 챔피언 장착 불가 (팀 모듈 슬롯 전용)
  if (category === 'piltover') {
    return { canEquip: false, reason: '필트오버 모듈은 팀 모듈 슬롯에 배치해야 합니다' };
  }

  // 3. 슬롯 초과 체크
  if (champion.items.length >= 3) {
    return { canEquip: false, reason: '아이템 슬롯이 가득 찼습니다 (3/3)' };
  }

  // 4. 유물 중복 체크
  if (category === 'artifact') {
    const hasArtifact = champion.items.some(i => getItemCategory(i) === 'artifact');
    if (hasArtifact) {
      return { canEquip: false, reason: '유물은 챔피언당 1개만 장착 가능합니다' };
    }
  }

  // 5. 빌지워터 아이템 → 시너지 활성 확인
  if (category === 'bilgewater') {
    const bgTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Bilgewater');
    if (!bgTrait || !bgTrait.activeEffect) {
      return { canEquip: false, reason: '빌지워터 시너지가 활성화되어야 합니다 (최소 3)' };
    }
  }

  return { canEquip: true };
}
```

### 2.2 `canAddPiltoverModule` 함수

**파일**: `src/lib/simulator/systems/item.ts`

```typescript
export function getPiltoverModuleLimit(activeTraits: ActiveTrait[]): number {
  const piltTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Piltover');
  if (!piltTrait || !piltTrait.activeEffect) return 0;

  const count = piltTrait.count;
  // 2/4/6 → 1/2/3 모듈
  if (count >= 6) return 3;
  if (count >= 4) return 2;
  if (count >= 2) return 1;
  return 0;
}

export function canAddPiltoverModule(
  item: RawItem,
  currentModules: RawItem[],
  activeTraits: ActiveTrait[],
): EquipValidation {
  if (getItemCategory(item) !== 'piltover') {
    return { canEquip: false, reason: '필트오버 모듈이 아닙니다' };
  }

  const limit = getPiltoverModuleLimit(activeTraits);
  if (limit === 0) {
    return { canEquip: false, reason: '필트오버 시너지가 활성화되어야 합니다 (최소 2)' };
  }

  if (currentModules.length >= limit) {
    return { canEquip: false, reason: `필트오버 모듈 슬롯이 가득 찼습니다 (${currentModules.length}/${limit})` };
  }

  return { canEquip: true };
}
```

### 2.3 `getEquippableItems` 필터 함수

**파일**: `src/lib/simulator/systems/item.ts`

```typescript
export function getEquippableItems(
  allItems: RawItem[],
  champion: PlacedChampion,
  activeTraits: ActiveTrait[],
): { item: RawItem; validation: EquipValidation }[] {
  return allItems.map(item => ({
    item,
    validation: canEquipItem(item, champion, activeTraits),
  }));
}
```

---

## 3. 상태 관리 변경

### 3.1 SimulatorPage 로컬 상태 확장

**파일**: `src/app/simulator/page.tsx`

필트오버 모듈은 팀별로 관리한다. 기존 `teamSlice`를 수정하는 대신 `SimulatorPage`에 로컬 상태를 추가한다 (증강과 동일한 패턴).

```typescript
// 필트오버 모듈 상태 (팀별)
const [playerPiltoverModules, setPlayerPiltoverModules] = useState<RawItem[]>([]);
const [enemyPiltoverModules, setEnemyPiltoverModules] = useState<RawItem[]>([]);
```

### 3.2 `handleEquipItem` 검증 추가

**파일**: `src/app/simulator/page.tsx` (line 274)

기존:
```typescript
const handleEquipItem = (team: 'player' | 'enemy', index: number, item: RawItem) => {
  const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
  setTeam(prev => prev.map((p, i) => {
    if (i !== index) return p;
    if (p.items.length >= 3) return p;
    return { ...p, items: [...p.items, item] };
  }));
};
```

변경:
```typescript
const handleEquipItem = (team: 'player' | 'enemy', index: number, item: RawItem) => {
  const teamArr = team === 'player' ? playerTeam : enemyTeam;
  const placed = teamArr[index];
  if (!placed) return;

  const traits = team === 'player' ? playerTraits : enemyTraits;
  const validation = canEquipItem(item, placed, traits);
  if (!validation.canEquip) return;

  const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
  setTeam(prev => prev.map((p, i) => {
    if (i !== index) return p;
    return { ...p, items: [...p.items, item] };
  }));
};
```

### 3.3 필트오버 모듈 핸들러

```typescript
const handleAddPiltoverModule = (team: 'player' | 'enemy', item: RawItem) => {
  const modules = team === 'player' ? playerPiltoverModules : enemyPiltoverModules;
  const traits = team === 'player' ? playerTraits : enemyTraits;
  const validation = canAddPiltoverModule(item, modules, traits);
  if (!validation.canEquip) return;

  const setModules = team === 'player' ? setPlayerPiltoverModules : setEnemyPiltoverModules;
  setModules(prev => [...prev, item]);
};

const handleRemovePiltoverModule = (team: 'player' | 'enemy', index: number) => {
  const setModules = team === 'player' ? setPlayerPiltoverModules : setEnemyPiltoverModules;
  setModules(prev => prev.filter((_, i) => i !== index));
};
```

---

## 4. UI 변경 설계

### 4.1 `ItemGrid.tsx` 카테고리 세분화 + 비활성화

**파일**: `src/components/builder/ItemGrid.tsx`

#### Props 변경

```typescript
interface ItemGridProps {
  items: RawItem[];
  onSelect: (item: RawItem) => void;
  activeTraits?: ActiveTrait[];        // 추가: 활성 시너지
  equippedItems?: RawItem[];           // 추가: 현재 장착된 아이템 (유물 검증용)
  mode?: 'champion' | 'piltover';      // 추가: 챔피언 장착 vs 필트오버 모듈
  piltoverModules?: RawItem[];         // 추가: 현재 필트오버 모듈 목록
}
```

#### 카테고리 탭 변경

```typescript
type ItemCategory = 'all' | 'component' | 'combined' | 'artifact' | 'piltover' | 'bilgewater';

const categories: { key: ItemCategory; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'component', label: '조합재료' },
  { key: 'combined', label: '완성템' },
  { key: 'artifact', label: '유물' },
  { key: 'piltover', label: '필트오버' },
  { key: 'bilgewater', label: '빌지워터' },
];
```

#### 비활성화 표시

- 장착 불가 아이템: `opacity-30 cursor-not-allowed` 스타일
- 호버 시 사유를 보여주는 `title` 속성 추가
- `mode === 'piltover'`일 때 필트오버 아이템만 표시

### 4.2 `SelectedUnitPanel.tsx` 변경

**파일**: `src/components/builder/SelectedUnitPanel.tsx`

#### Props 변경

```typescript
interface SelectedUnitPanelProps {
  placed: PlacedChampion;
  team: 'player' | 'enemy';
  allItems: RawItem[];
  activeTraits: ActiveTrait[];         // 추가
  onStarChange: (level: number) => void;
  onEquipItem: (item: RawItem) => void;
  onRemoveItem: (itemIdx: number) => void;
  onRemoveUnit: () => void;
}
```

- `ItemGrid`에 `activeTraits`, `equippedItems` 전달
- 유물 장착 개수 표시: `유물 (0/1)` 또는 `유물 (1/1)`

### 4.3 필트오버 모듈 슬롯 패널

**파일**: `src/components/builder/PiltoverModulePanel.tsx` (신규)

팀별 필트오버 모듈 슬롯을 보여주는 컴포넌트. 시너지 패널 아래에 배치.

```typescript
interface PiltoverModulePanelProps {
  modules: RawItem[];
  moduleLimit: number;              // getPiltoverModuleLimit 결과
  allItems: RawItem[];
  activeTraits: ActiveTrait[];
  onAddModule: (item: RawItem) => void;
  onRemoveModule: (index: number) => void;
}
```

**UI 구조:**
```
┌─────────────────────────────────┐
│ ⚙️ 필트오버 모듈 (1/2)           │
│ ┌────┐ ┌────┐ ┌ ─ ─ ┐          │
│ │ 🔧 │ │  + │ │     │ (비활성) │
│ └────┘ └────┘ └ ─ ─ ┘          │
│ 8초 후 발동                       │
└─────────────────────────────────┘
```

- 활성 슬롯: 선택된 모듈 아이콘 표시 + 클릭으로 제거
- 빈 슬롯: `+` 버튼 → 필트오버 아이템만 표시하는 Modal
- 비활성 슬롯: 점선 테두리, 시너지 단계 안내 텍스트
- 시너지 0일 때: "필트오버 시너지를 활성화하세요" 안내 메시지

### 4.4 빌지워터 탭 안내

빌지워터 시너지 미활성 시 `ItemGrid`의 빌지워터 탭에 안내 메시지 표시:

```
빌지워터 시너지가 활성화되어야 합니다 (현재 0명, 최소 3명 필요)
```

---

## 5. 전투 엔진 연동

### 5.1 필트오버 모듈 효과 적용

**파일**: `src/lib/simulator/engine/combatLoop.ts`

`simulateCombat` 함수 시그니처에 필트오버 모듈 매개변수 추가:

```typescript
export function simulateCombat(
  playerTeam: PlacedChampion[],
  enemyTeam: PlacedChampion[],
  playerTraits?: ActiveTrait[],
  enemyTraits?: ActiveTrait[],
  playerAugmentEffects?: ItemEffect,
  enemyAugmentEffects?: ItemEffect,
  playerPiltoverModules?: RawItem[],  // 추가
  enemyPiltoverModules?: RawItem[],   // 추가
): CombatResult
```

**8초(=8 * TICKS_PER_SECOND) 지연 발동:**
- 전투 시작 시 모듈은 비활성
- tick이 `8 * TICKS_PER_SECOND`에 도달하면 모듈 효과를 팀 전체 유닛에 적용
- 이벤트 로그에 `type: 'piltover_module'` 이벤트 기록

> **Note**: 8초 지연 발동은 엔진 이벤트 시스템 확장이 필요하므로, 이번 구현에서는 **전투 시작 즉시 적용**으로 단순화한다. 8초 지연은 별도 feature로 분리.

### 5.2 빌지워터 스탯 아이템 적용

빌지워터 스탯 아이템(Tier 1-3)은 일반 아이템과 동일하게 `calculateStats`에서 처리된다. 다만 `BonusArmorMR`, `BonusAS`, `BonusAD`, `BonusAP`, `BonusHealthPercent` 등의 effect key를 `ITEM_EFFECT_KEYS`에 매핑해야 한다.

**파일**: `src/lib/simulator/models/constants.ts`

```typescript
// 기존 매핑에 추가
export const ITEM_EFFECT_KEYS: Record<string, string> = {
  // ... 기존 키 유지
  'BonusArmorMR': 'armor',      // 빌지워터: 방어력/마저 동시 부여
  'BonusAS': 'as',              // 빌지워터: 공격 속도
  'BonusAD': 'ad',              // 빌지워터: 공격력
  'BonusAP': 'ap',              // 빌지워터: 주문력
  'BonusHealthPercent': 'hpPercent', // 빌지워터: % 체력 (신규 키)
};
```

`BonusArmorMR`은 방어력과 마법 저항력에 동시 적용되므로 `resolveItemEffect`에서 특수 처리가 필요하다:

```typescript
// item.ts의 resolveItemEffect 확장
if (key === 'BonusArmorMR' && typeof value === 'number') {
  result.armor = (result.armor || 0) + value;
  result.magicResist = (result.magicResist || 0) + value;
}
```

---

## 6. 구현 순서

| 순서 | 작업 | 파일 | 의존성 |
|:----:|------|------|-------|
| 1 | `ItemCategory` 타입, `EquipValidation` 인터페이스 추가 | `types/index.ts` | 없음 |
| 2 | `canEquipItem`, `canAddPiltoverModule`, `getPiltoverModuleLimit`, `getEquippableItems` 구현 | `lib/simulator/systems/item.ts` | 순서 1 |
| 3 | `ITEM_EFFECT_KEYS` 빌지워터 키 추가, `resolveItemEffect` BonusArmorMR 처리 | `models/constants.ts`, `systems/item.ts` | 없음 |
| 4 | `ItemGrid.tsx` 카테고리 세분화 + 비활성화 처리 | `components/builder/ItemGrid.tsx` | 순서 2 |
| 5 | `SelectedUnitPanel.tsx` activeTraits prop 전달 | `components/builder/SelectedUnitPanel.tsx` | 순서 4 |
| 6 | `PiltoverModulePanel.tsx` 신규 생성 | `components/builder/PiltoverModulePanel.tsx` | 순서 2 |
| 7 | `SimulatorPage` 필트오버 상태 추가, handleEquipItem 검증, 패널 배치 | `app/simulator/page.tsx` | 순서 2-6 |
| 8 | `pnpm lint && pnpm typecheck && pnpm build` | — | 전체 |

---

## 7. 데이터 의존성

### 7.1 필트오버 시너지 데이터

```json
{
  "apiName": "TFT16_Piltover",
  "effects": [
    { "minUnits": 2, "maxUnits": 3, "style": 1, "variables": { "InventionFireTime": 8 } },
    { "minUnits": 4, "maxUnits": 5, "style": 3, "variables": { "InventionFireTime": 8 } },
    { "minUnits": 6, "maxUnits": 25000, "style": 5, "variables": { "InventionFireTime": 8 } }
  ]
}
```

→ 2/4/6 단계 = 모듈 1/2/3개

### 7.2 빌지워터 시너지 데이터

```json
{
  "apiName": "TFT16_Bilgewater",
  "effects": [
    { "minUnits": 3, "style": 1 },
    { "minUnits": 5, "style": 3 },
    { "minUnits": 7, "style": 5 },
    { "minUnits": 10, "style": 6 }
  ]
}
```

→ 3 이상일 때 빌지워터 아이템 장착 허용

### 7.3 빌지워터 아이템 하위 분류

| 분류 | apiName 패턴 | 개수 | 챔피언 장착 |
|------|------------|:----:|:---------:|
| 스탯 티어 (Tier 1-3) | `*_ArmorMRTier*`, `*_ASTier*`, `*_ADAPTier*`, `*_APTier*`, `*_ADTier*`, `*_HealthTier*` | 18 | ✅ (시너지 조건) |
| 고유 전투 아이템 | `*_DeadmansDagger`, `*_BilgeratCutlass` 등 | 10 | ✅ (시너지 조건) |
| 비전투/유틸 | `*_ShopRefresh`, `*_BrigandsDice`, `*_TheList` 등 | 6 | ❌ (effects 비어있음) |

`effects`가 빈 객체인 빌지워터 아이템은 장착 불가로 처리한다:

```typescript
if (category === 'bilgewater' && Object.keys(item.effects).length === 0) {
  return { canEquip: false, reason: '비전투 아이템입니다' };
}
```
