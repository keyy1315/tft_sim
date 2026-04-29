# Design: 증강 스케일링 & 챔피언 스킬 변경 시스템

## 1. 타입 변경

### 1.1 PlacedChampion 확장 (`src/types/index.ts`)

```typescript
export type PermanentStackType = 'ezreal_drones' | 'chogath_hp';

export interface PermanentStack {
  type: PermanentStackType;
  value: number;
}

// PlacedChampion에 추가
export interface PlacedChampion {
  // 기존...
  permanentStacks?: PermanentStack | null;
}
```

### 1.2 영구 스택 설정 데이터 (`src/types/index.ts`)

```typescript
export const PERMANENT_STACK_CONFIG: Record<string, {
  type: PermanentStackType;
  label: string;
  unit: string;
  max: number;
  applyToUnit: (unit: CombatUnit, value: number, starLevel: number) => void;
}> = {
  TFT17_Ezreal: {
    type: 'ezreal_drones',
    label: '처치 관여',
    unit: '회',
    max: 30,
    applyToUnit: (unit, value, starLevel) => {
      // 3회당 드론 1개, 드론 피해 = DroneDamage variable
      const drones = Math.floor(value / 3);
      // 드론 피해는 combatLoop에서 스킬 사용 시 추가
      (unit as any)._ezrealDrones = drones;
    },
  },
  TFT17_Chogath: {
    type: 'chogath_hp',
    label: '추가 체력',
    unit: '',
    max: 9999,
    applyToUnit: (unit, value) => {
      unit.maxHp += value;
      unit.currentHp += value;
    },
  },
};
```

### 1.3 캐리 증강 설정 (`src/data/carryAugments.ts` 신규)

```typescript
import { AbilityConfig } from '@/lib/simulator/systems/ability';

export interface CarryAugmentConfig {
  augmentApiName: string;
  targetChampionApiName: string;
  abilityOverride: AbilityConfig;
  rangeOverride?: number;         // 사거리 변경 (정령단 속도 뽀삐: 4)
  damageTypeOverride?: 'physical' | 'magic';
  scalingInput?: {                // 캐리 증강 내 영구 스케일링
    label: string;
    unit: string;
    max: number;
    effectPerStack: string;       // 표시 텍스트 (예: "피해량 +5%")
  };
}

export const CARRY_AUGMENTS: CarryAugmentConfig[] = [
  {
    augmentApiName: 'TFT17_Augment_NasusCarry',
    targetChampionApiName: 'TFT17_Nasus',
    abilityOverride: { pattern: 'single', heal: true },
    damageTypeOverride: 'physical',
    scalingInput: {
      label: '처치 수',
      unit: '회',
      max: 50,
      effectPerStack: '피해량 +5%',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_AatroxCarry',
    targetChampionApiName: 'TFT17_Aatrox',
    abilityOverride: { pattern: 'multi', maxTargets: 3 },
    damageTypeOverride: 'physical',
  },
  {
    augmentApiName: 'TFT17_Augment_PoppyCarry',
    targetChampionApiName: 'TFT17_Poppy',
    abilityOverride: { pattern: 'multi', maxTargets: 3 },
    rangeOverride: 4,
    damageTypeOverride: 'physical',
  },
  {
    augmentApiName: 'TFT17_Augment_LeonaCarry',
    targetChampionApiName: 'TFT17_Leona',
    abilityOverride: { pattern: 'line', dash: 'to_target', stun: 1.0 },
    damageTypeOverride: 'physical',
  },
  {
    augmentApiName: 'TFT17_Augment_IvernMinionCarry',
    targetChampionApiName: 'TFT17_IvernMinion',
    abilityOverride: { pattern: 'aoe_circle', radius: 3, dash: 'to_farthest' },
  },
  {
    augmentApiName: 'TFT17_Augment_JaxCarry',
    targetChampionApiName: 'TFT17_Jax',
    abilityOverride: { pattern: 'self_buff', selfBuff: { attackSpeed: 0.3, duration: 999 } },
  },
  {
    augmentApiName: 'TFT17_Augment_PykeCarry',
    targetChampionApiName: 'TFT17_Pyke',
    abilityOverride: { pattern: 'single', dash: 'to_target' },
    damageTypeOverride: 'physical',
    scalingInput: {
      label: '처치 수',
      unit: '회',
      max: 30,
      effectPerStack: '골드 +1',
    },
  },
  {
    augmentApiName: 'TFT17_Augment_MordekaiserCarry',
    targetChampionApiName: 'TFT17_Mordekaiser',
    abilityOverride: { pattern: 'aoe_circle', radius: 2 },
  },
  {
    augmentApiName: 'TFT17_Augment_GragasCarry',
    targetChampionApiName: 'TFT17_Gragas',
    abilityOverride: { pattern: 'aoe_circle', radius: 3 },
  },
  {
    augmentApiName: 'TFT17_Augment_InvaderZed',
    targetChampionApiName: 'TFT17_Zed',
    abilityOverride: { pattern: 'self_buff' },
    damageTypeOverride: 'physical',
  },
];
```

---

## 2. 구현 상세

### 2.1 Phase 1: 영구 스케일링 입력

#### 2.1.1 useTeamManagement 변경

```typescript
// handlePermanentStackChange 추가
const handlePermanentStackChange = (team: 'player' | 'enemy', index: number, value: number) => {
  const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
  setTeam(prev => prev.map((p, i) => {
    if (i !== index) return p;
    const config = PERMANENT_STACK_CONFIG[p.champion.apiName];
    if (!config) return p;
    return { ...p, permanentStacks: { type: config.type, value } };
  }));
};
```

#### 2.1.2 SelectedUnitPanel UI

`StarSelector` 아래에 조건부 렌더링:
```
champion.apiName in PERMANENT_STACK_CONFIG → 스택 입력 표시
```

입력 컴포넌트:
- 라벨 (예: "처치 관여")
- 숫자 입력 (min=0, max=config.max)
- +/- 버튼
- 효과 미리보기 (예: "→ 드론 4개")

#### 2.1.3 combatLoop 반영

`createCombatUnit` 후, `applyPerUnitMods` 전에:

```typescript
// 영구 스택 적용
if (placed.permanentStacks) {
  const config = PERMANENT_STACK_CONFIG[placed.champion.apiName];
  if (config) config.applyToUnit(unit, placed.permanentStacks.value, placed.starLevel);
}
```

### 2.2 Phase 2: 캐리 증강 스킬 변경

#### 2.2.1 combatLoop에서 AbilityConfig 결정

현재 `CHAMPION_ABILITY_PATTERNS[champion.apiName]`으로 직접 조회.
변경: 증강 리스트를 받아 캐리 증강이 있으면 오버라이드.

```typescript
function getAbilityConfig(
  champion: RawChampion,
  augments: AugmentWithStacks[]
): AbilityConfig {
  // 캐리 증강 체크
  const carry = CARRY_AUGMENTS.find(ca =>
    ca.targetChampionApiName === champion.apiName &&
    augments.some(a => a.augment.apiName === ca.augmentApiName)
  );
  if (carry) return carry.abilityOverride;
  
  // 기본 패턴
  return CHAMPION_ABILITY_PATTERNS[champion.apiName] ?? { pattern: 'single' };
}
```

#### 2.2.2 사거리 오버라이드

`createCombatUnit` 후:
```typescript
if (carry?.rangeOverride) {
  unit.stats.range = carry.rangeOverride;
}
```

#### 2.2.3 AugmentDetailPopup 확장

캐리 증강에 `scalingInput`이 있으면 스택 입력 UI 추가:
- 기존 `stacks` 슬라이더와 별도로 `carryStacks` 입력
- `augmentStacks` 키: `{augmentApiName}_carry` (예: `TFT17_Augment_NasusCarry_carry`)

### 2.3 Phase 3: 버프 증강 능력치 적용

#### 2.3.1 Set 17 버프 증강 → resolveAugmentEffects 매핑

| 증강 | effect key | 처리 |
|------|-----------|------|
| 이블린의 은총 | `Durability` | `damageReduction += Durability` |
| 소라카의 은총 | `Heal` | `hp += Heal * stacks` (stacks = 잃은 체력) |
| 아리의 은총 | `{048fe876}` | `ad += 0.02 * stacks`, `ap += 0.02 * stacks` (stacks = 레벨) |
| 저격수의 은신처 | `DamageAmp`, `MaxAmp` | `damageAmp += DamageAmp * stacks` (stacks = 유지 라운드, max 4) |
| 은하계 여행 | `AD`, `AP`, `HP` | 기본값 + `stacks * 10%` 증가 (stacks = 새 상대 수) |

#### 2.3.2 resolveAugmentEffects 추가 코드

```typescript
// 이블린의 은총 — 내구력 (damage reduction)
const durability = ef(e, 'Durability');
if (durability != null) {
  // per-unit mod에서 처리 (damageReduction)
}

// 소라카의 은총 — 잃은 체력당 HP
const heal = ef(e, 'Heal');
if (heal != null && augment.apiName.includes('SorakaGodAugment')) {
  result.hp = (result.hp ?? 0) + heal * stacks;
}
```

#### 2.3.3 resolvePerUnitMods 추가

이블린 내구력, 저격수 피해증폭 등 per-unit 효과:
```typescript
if (augment.apiName === 'TFT17_Augment_EvelynnGodAugment') {
  mod.damageReduction += ef(e, 'Durability') ?? 0;
}
if (augment.apiName === 'TFT17_Augment_SnipersNest') {
  const amp = (ef(e, 'DamageAmp') ?? 0) * stackCount;
  const max = ef(e, 'MaxAmp') ?? 100;
  mod.damageAmp += Math.min(amp, max) / 100;
}
```

---

## 3. 수정 파일 목록 (구현 순서)

### Phase 1 (영구 스케일링)
| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/types/index.ts` | `PermanentStack` 타입, `PERMANENT_STACK_CONFIG`, `PlacedChampion.permanentStacks` |
| 2 | `src/hooks/useTeamManagement.ts` | `handlePermanentStackChange` 핸들러, return에 추가 |
| 3 | `src/components/builder/SelectedUnitPanel.tsx` | 스택 입력 UI, `onPermanentStackChange` prop |
| 4 | `src/app/simulator/page.tsx` | SelectedUnitPanel에 prop 전달 |
| 5 | `src/lib/simulator/engine/combatLoop.ts` | `createCombatUnit` 후 스택 적용 |

### Phase 2 (캐리 증강)
| # | 파일 | 변경 |
|---|------|------|
| 6 | `src/data/carryAugments.ts` | **신규** — 10개 캐리 증강 설정 |
| 7 | `src/lib/simulator/engine/combatLoop.ts` | `getAbilityConfig()` 함수 + 사거리 오버라이드 |
| 8 | `src/components/builder/AugmentDetailPopup.tsx` | 캐리 증강 스케일링 입력 UI |
| 9 | `src/hooks/useTeamManagement.ts` | 캐리 스택 키 관리 |

### Phase 3 (버프 증강)
| # | 파일 | 변경 |
|---|------|------|
| 10 | `src/lib/simulator/systems/augment.ts` | Set 17 버프 증강 effect 처리 |
| 11 | `src/lib/simulator/systems/augment.ts` | resolvePerUnitMods에 내구력/피해증폭 추가 |

---

## 4. 데이터 흐름

```
[사용자 입력]
  ├── SelectedUnitPanel: permanentStacks 입력
  ├── AugmentDetailPopup: carryStacks / augmentStacks 입력
  └── AugmentSlots: 증강 선택
           │
           ▼
[useTeamManagement]
  ├── playerTeam[i].permanentStacks = { type, value }
  ├── playerAugments = [RawAugment...]
  └── playerAugmentStacks = { apiName: count, apiName_carry: count }
           │
           ▼
[simulateCombat(options)]
  ├── resolveAugmentEffects(augs) → ItemEffect (글로벌 스탯)
  ├── resolvePerUnitMods(augs, champion) → PerUnitAugmentMod
  │
  ├── createCombatUnit(placed, ..., augmentEffects)
  │     └── calculateStats(champion, star, items, traits, augEffects)
  │
  ├── permanentStacks 적용 (초가스 HP, 이즈리얼 드론)
  ├── carry augment 사거리 오버라이드
  ├── applyPerUnitMods(unit, mod) → 피해증폭, 내구력, 범위 등
  │
  └── combat tick loop
        ├── ability cast → getAbilityConfig(champion, augments)
        │     └── carry augment이면 오버라이드된 패턴 사용
        └── 이즈리얼 드론: 스킬 사용 시 추가 피해 계산
```

---

## 5. 테스트 체크리스트

- [ ] 초가스 추가 체력 300 → maxHP에 300 가산
- [ ] 초가스 스택 0 → 기본 HP로 전투
- [ ] 이즈리얼 처치 관여 12 → 드론 4개 → 스킬 시 추가 피해
- [ ] 이즈리얼 처치 관여 0 → 드론 0개 → 추가 피해 없음
- [ ] 꽁! 증강 + 나서스 → 스킬 패턴이 single(AD)로 변경
- [ ] 정령단 속도 + 뽀삐 → 사거리 4로 변경
- [ ] 저격수의 은신처 (stacks=4) → 피해 증폭 32%
- [ ] 이블린의 은총 → damageReduction 10% 적용
- [ ] 캐리 증강 없이 나서스 배치 → 기본 스킬 유지
- [ ] 증강 제거 → 오버라이드 해제, 기본 스킬 복원

---

*Created: 2026-04-15*
*Feature: augment-scaling-system*
*Phase: Design*
*References: augment-scaling-system.plan.md*
