# Design: 증강 효과 적용 시스템 (능력치/훈련봇/칸 버프)

## 1. 현재 구현 현황

### 1.1 이미 구현됨 (제외)

| 항목 | 위치 | 상태 |
|------|------|------|
| resolveAugmentEffects 30+ effect key | `augment.ts:74-230` | ✅ |
| resolvePerUnitMods (damageAmp, omnivamp, shield 등) | `augment.ts:234-354` | ✅ |
| 소라카 은총 (잃은 체력당 HP) | `augment.ts:201-204` | ✅ |
| 아리 은총 (레벨당 AD/AP) | `augment.ts:207-214` | ✅ |
| 은하계 여행 (새 상대당 스탯 증가) | `augment.ts:217-226` | ✅ |
| 이블린 은총 (내구력 → damageReduction) | `augment.ts:336-339` | ✅ |
| 저격수 은신처 (라운드 유지당 DamageAmp) | `augment.ts:342-350` | ✅ |
| PermanentStack 타입 + UI (이즈리얼/초가스) | `types/index.ts`, `SelectedUnitPanel.tsx` | ✅ |
| 캐리 증강 10개 AbilityConfig 오버라이드 | `carryAugments.ts`, `combatLoop.ts` | ✅ |

### 1.2 이번에 구현할 것

| # | 항목 | 우선순위 |
|---|------|---------|
| 1 | 훈련봇 자동 배치 (3개 증강) | 높음 |
| 2 | 칸 버프 시스템 (9개 증강) | 높음 |
| 3 | 증강 효과 누락 key 보강 (검증 후 추가) | 중간 |

---

## 2. 훈련봇 자동 배치

### 2.1 타입 확장 (`src/types/index.ts`)

```typescript
// PlacedChampion에 추가
export interface PlacedChampion {
  // 기존...
  isDummy?: boolean; // 훈련봇 여부 — true면 아이템/별 변경 차단
}
```

### 2.2 훈련봇 증강 데이터 (`src/data/augmentDummies.ts`, 신규)

```typescript
export interface DummyAugmentConfig {
  augmentApiName: string;
  count: number;         // 생성 수
  statsOverride?: {
    hp?: number;
    damage?: number;
    attackSpeed?: number;
    armor?: number;
    magicResist?: number;
    range?: number;
  };
  /** 팀 체력 비율 기반 HP (훈련 봇 변환) */
  teamHpRatio?: number;
  /** 스테이지당 체력 증가 */
  hpPerStage?: number;
  /** 특수 행동 (돌진, 고정피해 등) — combatLoop에서 처리 */
  specialBehavior?: 'charge_stun' | 'aoe_fixed_damage';
}

export const DUMMY_AUGMENTS: DummyAugmentConfig[] = [
  {
    augmentApiName: 'TFT17_Augment_RiotTrainingBot',   // 탑
    count: 1,
    statsOverride: { hp: 1500, damage: 0, attackSpeed: 0.5, armor: 60, magicResist: 60, range: 1 },
    hpPerStage: 500,
    specialBehavior: 'aoe_fixed_damage',
  },
  {
    augmentApiName: 'TFT17_Augment_TrainingBotConvert', // 훈련 봇 변환
    count: 1,
    teamHpRatio: 0.6,
    hpPerStage: 1000,
  },
  {
    augmentApiName: 'TFT17_Augment_CrashTestBot',      // 충돌 시험용 봇
    count: 2,
    statsOverride: { hp: 800, damage: 0, attackSpeed: 0, armor: 40, magicResist: 40, range: 1 },
    specialBehavior: 'charge_stun',
  },
];

export function findDummyAugment(apiName: string): DummyAugmentConfig | undefined {
  return DUMMY_AUGMENTS.find(d => d.augmentApiName === apiName);
}
```

### 2.3 훈련봇 생성 함수 (`src/data/augmentDummies.ts`)

```typescript
export function createDummyChampion(
  config: DummyAugmentConfig,
  team: PlacedChampion[],
  stageNumber: number,
): PlacedChampion {
  const baseHp = config.teamHpRatio
    ? Math.round(team.reduce((sum, c) => sum + c.champion.stats[0].hp, 0) * config.teamHpRatio)
    : config.statsOverride?.hp ?? 550;
  const stageBonus = (config.hpPerStage ?? 0) * Math.max(0, stageNumber - 1);

  return {
    champion: {
      apiName: 'TFT_TrainingDummy',
      name: '훈련봇',
      cost: 0,
      traits: [],
      stats: [{ hp: baseHp + stageBonus, ...DUMMY_BASE_STATS, ...(config.statsOverride ?? {}) }],
      ability: { name: '없음', desc: '', icon: '' },
      icon: '/icons/training_dummy.png',
    } as RawChampion,
    position: findEmptyHex(team),  // 빈 칸 자동 배치
    starLevel: 1,
    items: [],
    isDummy: true,
  };
}
```

### 2.4 증강 추가/제거 시 훈련봇 관리 (`useTeamManagement.ts`)

```typescript
// handleAddAugment 내부
const dummyCfg = findDummyAugment(augment.apiName);
if (dummyCfg) {
  for (let i = 0; i < dummyCfg.count; i++) {
    const dummy = createDummyChampion(dummyCfg, currentTeam, stageNumber);
    currentTeam = [...currentTeam, dummy];
  }
}

// handleRemoveAugment 내부
const dummyCfg = findDummyAugment(augment.apiName);
if (dummyCfg) {
  // isDummy인 챔피언 제거
  currentTeam = currentTeam.filter(c => !c.isDummy);
}
```

### 2.5 UI 차단 (`SelectedUnitPanel.tsx`)

isDummy === true인 유닛 선택 시:
- 아이템 장착 슬롯 숨김
- 별 업그레이드 버튼 숨김
- "훈련봇" 라벨 표시

---

## 3. 칸 버프 시스템

### 3.1 타입 정의 (`src/types/index.ts`)

```typescript
export interface HexBuff {
  augmentApiName: string;
  positions: HexCoord[];  // 버프 적용 칸 목록
  movable: boolean;        // 드래그 이동 가능 여부
  effects: {
    hp?: number;           // flat HP
    hpPercent?: number;    // % HP (0.25 = +25%)
    attackSpeed?: number;  // % AS
    damageAmp?: number;    // 피해 증폭
    armor?: number;
    magicResist?: number;
    ap?: number;
    ad?: number;
  };
  color: string;           // 표시 색상 (CSS)
  label: string;           // 표시 라벨
}
```

### 3.2 칸 버프 증강 데이터 (`src/data/augmentHexBuffs.ts`, 신규)

```typescript
export type HexBuffResolver = (team: PlacedChampion[]) => HexBuff;

export const HEX_BUFF_AUGMENTS: Record<string, HexBuffResolver> = {
  // 야스오의 황금 칸 — 1칸, 이동 가능
  'TFT17_Augment_YasuoGoldenHex': (_team) => ({
    augmentApiName: 'TFT17_Augment_YasuoGoldenHex',
    positions: [{ row: 0, col: 3 }],  // 기본 위치, 이동 가능
    movable: true,
    effects: { hp: 250, attackSpeed: 0.25 },
    color: '#FFD700',
    label: '황금 칸',
  }),

  // 중심 잡기 — 전방 1열 중앙 고정
  'TFT17_Augment_Centering': (_team) => ({
    augmentApiName: 'TFT17_Augment_Centering',
    positions: [{ row: 0, col: 3 }],
    movable: false,
    effects: { damageAmp: 0.15, hpPercent: 0.25 },
    color: '#FF6B35',
    label: '중심',
  }),

  // 유리 대포 I — 후방 1열
  'TFT17_Augment_GlassCannon1': (_team) => ({
    augmentApiName: 'TFT17_Augment_GlassCannon1',
    positions: Array.from({ length: 7 }, (_, i) => ({ row: 3, col: i })),
    movable: false,
    effects: { hpPercent: -0.2, damageAmp: 0.16 },
    color: '#E74C3C',
    label: '유리 대포',
  }),

  // 유리 대포 II — 후방 1열
  'TFT17_Augment_GlassCannon2': (_team) => ({
    augmentApiName: 'TFT17_Augment_GlassCannon2',
    positions: Array.from({ length: 7 }, (_, i) => ({ row: 3, col: i })),
    movable: false,
    effects: { hpPercent: -0.2, damageAmp: 0.25 },
    color: '#C0392B',
    label: '유리 대포 II',
  }),

  // 정렬 — 전방 2열 유닛 수 비례 방어력/마저
  'TFT17_Augment_Alignment': (team) => {
    const frontRows = [0, 1];
    const frontCount = team.filter(c => frontRows.includes(c.position.row)).length;
    return {
      augmentApiName: 'TFT17_Augment_Alignment',
      positions: frontRows.flatMap(row => Array.from({ length: 7 }, (_, col) => ({ row, col }))),
      movable: false,
      effects: { armor: 2 * frontCount, magicResist: 2 * frontCount },
      color: '#3498DB',
      label: '정렬',
    };
  },

  // 권투 교습 — 전방 유닛당 체력 +30
  'TFT17_Augment_BoxingLessons': (team) => {
    const frontRows = [0, 1];
    const frontCount = team.filter(c => frontRows.includes(c.position.row)).length;
    return {
      augmentApiName: 'TFT17_Augment_BoxingLessons',
      positions: frontRows.flatMap(row => Array.from({ length: 7 }, (_, col) => ({ row, col }))),
      movable: false,
      effects: { hp: 30 * frontCount },
      color: '#E67E22',
      label: '권투 교습',
    };
  },

  // 진형 유지 — 후방 2열, 전방 유닛당 AP/AD
  'TFT17_Augment_HoldFormation': (team) => {
    const frontRows = [0, 1];
    const backRows = [2, 3];
    const frontCount = team.filter(c => frontRows.includes(c.position.row)).length;
    return {
      augmentApiName: 'TFT17_Augment_HoldFormation',
      positions: backRows.flatMap(row => Array.from({ length: 7 }, (_, col) => ({ row, col }))),
      movable: false,
      effects: { ap: 10 * frontCount, ad: 9 * frontCount },
      color: '#9B59B6',
      label: '진형 유지',
    };
  },

  // 쌍둥이 수호자 — 전방 정확히 2명 시 버프
  'TFT17_Augment_TwinGuardians': (team) => {
    const frontRows = [0, 1];
    const frontUnits = team.filter(c => frontRows.includes(c.position.row));
    const active = frontUnits.length === 2;
    return {
      augmentApiName: 'TFT17_Augment_TwinGuardians',
      positions: active ? frontUnits.map(c => c.position) : [],
      movable: false,
      effects: active ? { hp: 100, armor: 45, magicResist: 45 } : {},
      color: '#1ABC9C',
      label: '쌍둥이 수호자',
    };
  },

  // 후방 지원 — 후방 2열 4명 이상 시 AS
  'TFT17_Augment_BacklineSupport': (team) => {
    const backRows = [2, 3];
    const backUnits = team.filter(c => backRows.includes(c.position.row));
    const active = backUnits.length >= 4;
    return {
      augmentApiName: 'TFT17_Augment_BacklineSupport',
      positions: active ? backUnits.map(c => c.position) : [],
      movable: false,
      effects: active ? { attackSpeed: 0.12 } : {},
      color: '#2ECC71',
      label: '후방 지원',
    };
  },

  // 부식 — 전방 2열 적에게 방저/마저 감소 (적용은 combatLoop)
  'TFT17_Augment_Corrosion': (_team) => ({
    augmentApiName: 'TFT17_Augment_Corrosion',
    positions: [{ row: 0, col: 0 }],  // 적 전방 — combatLoop에서 처리
    movable: false,
    effects: { armor: -4, magicResist: -4 },
    color: '#8E44AD',
    label: '부식',
  }),
};

export function resolveHexBuffs(
  augments: RawAugment[],
  team: PlacedChampion[],
): HexBuff[] {
  const buffs: HexBuff[] = [];
  for (const aug of augments) {
    const resolver = HEX_BUFF_AUGMENTS[aug.apiName];
    if (resolver) buffs.push(resolver(team));
  }
  return buffs;
}
```

### 3.3 useTeamManagement 상태 확장

```typescript
// useTeamManagement.ts에 추가

// hexBuffs는 파생 값 — 증강 + 팀 구성이 바뀔 때마다 재계산
const hexBuffs = useMemo(() =>
  resolveHexBuffs(augments, champions),
  [augments, champions]
);

// 야스오 황금 칸 이동 핸들러
function moveHexBuff(augmentApiName: string, newPosition: HexCoord) {
  setHexBuffOverrides(prev => ({ ...prev, [augmentApiName]: newPosition }));
}
```

### 3.4 SetupBoard 시각화 (`SetupBoard.tsx`)

```typescript
// hex 렌더링 시 버프 칸 오버레이
{hexBuffs.map(buff =>
  buff.positions.map(pos => (
    <HexBuffOverlay
      key={`${buff.augmentApiName}-${pos.row}-${pos.col}`}
      position={pos}
      color={buff.color}
      label={buff.label}
      movable={buff.movable}
      onDrop={buff.movable ? (newPos) => moveHexBuff(buff.augmentApiName, newPos) : undefined}
    />
  ))
)}
```

오버레이 스타일:
- 배경: `${color}20` (투명도 12%)
- 테두리: `${color}80` (투명도 50%)
- 이동 가능: 금색 점선 테두리 + 드래그 커서
- 라벨: 칸 중앙 하단, 8px 텍스트

### 3.5 combatLoop 칸 버프 적용

```typescript
// CombatUnit 생성 후, 시너지 버프 적용과 동일 위치
function applyHexBuffs(units: CombatUnit[], hexBuffs: HexBuff[]): void {
  for (const buff of hexBuffs) {
    for (const unit of units) {
      const onBuff = buff.positions.some(
        p => p.row === unit.position.row && p.col === unit.position.col
      );
      if (!onBuff) continue;

      if (buff.effects.hp) unit.maxHp += buff.effects.hp;
      if (buff.effects.hpPercent) {
        const bonus = Math.round(unit.maxHp * buff.effects.hpPercent);
        unit.maxHp += bonus;
      }
      unit.currentHp = unit.maxHp; // 전투 시작이므로 최대 HP = 현재 HP
      if (buff.effects.attackSpeed) unit.stats.attackSpeed *= (1 + buff.effects.attackSpeed);
      if (buff.effects.damageAmp) unit.damageAmp += buff.effects.damageAmp;
      if (buff.effects.armor) unit.stats.armor += buff.effects.armor;
      if (buff.effects.magicResist) unit.stats.magicResist += buff.effects.magicResist;
      if (buff.effects.ap) unit.stats.ap += buff.effects.ap;
      if (buff.effects.ad) unit.stats.damage += buff.effects.ad;
    }
  }
}
```

---

## 4. 수정 파일 목록

| # | 파일 | 변경 | 신규 |
|---|------|------|------|
| 1 | `src/types/index.ts` | PlacedChampion.isDummy, HexBuff 타입 추가 | |
| 2 | `src/data/augmentDummies.ts` | 훈련봇 증강 설정 + 생성 함수 | ✅ |
| 3 | `src/data/augmentHexBuffs.ts` | 칸 버프 증강 설정 + resolver | ✅ |
| 4 | `src/hooks/useTeamManagement.ts` | 훈련봇 자동 배치/제거, hexBuffs 파생값, 이동 핸들러 | |
| 5 | `src/components/builder/SelectedUnitPanel.tsx` | isDummy 시 아이템/별 UI 숨김 | |
| 6 | `src/components/battle/SetupBoard.tsx` | HexBuffOverlay 컴포넌트 + 시각화 | |
| 7 | `src/lib/simulator/engine/combatLoop.ts` | applyHexBuffs 호출 + 훈련봇 특수 행동 | |

---

## 5. 구현 순서

### Phase 1: 타입 + 데이터
1. `types/index.ts` — PlacedChampion.isDummy, HexBuff 타입
2. `augmentDummies.ts` 신규 — 3개 훈련봇 증강 설정
3. `augmentHexBuffs.ts` 신규 — 9개 칸 버프 증강 설정

### Phase 2: 훈련봇 자동 배치
4. `useTeamManagement.ts` — 증강 추가/제거 시 훈련봇 배치/제거
5. `SelectedUnitPanel.tsx` — isDummy 시 아이템/별 차단
6. `combatLoop.ts` — 훈련봇 CombatUnit 생성 (특수 행동은 Phase 4)

### Phase 3: 칸 버프
7. `useTeamManagement.ts` — hexBuffs 파생값 + 이동 핸들러
8. `SetupBoard.tsx` — HexBuffOverlay 시각화 (색상/라벨/드래그)
9. `combatLoop.ts` — applyHexBuffs 함수 + 전투 시작 시 호출

### Phase 4: 특수 행동 (후순위)
10. 탑 훈련봇: 4초마다 적 3명에게 최대체력 5% 고정 피해
11. 충돌 시험용 봇: 전투 시작 돌진 + 1초 기절
12. 부식: 2초마다 적 전방 유닛 방어력/마저 -4

---

## 6. 테스트 체크리스트

- [ ] "탑" 증강 선택 → 훈련봇 필드 자동 배치, isDummy 확인
- [ ] 훈련봇 선택 → 아이템/별 UI 숨김
- [ ] 증강 제거 → 훈련봇 자동 제거
- [ ] "야스오의 황금 칸" → 금색 칸 표시, 드래그 이동 가능
- [ ] 황금 칸 위 유닛 → HP +250, AS +25% 전투 반영
- [ ] "유리 대포 II" → 후방 열 표시, HP -20% + 피해증폭 +25%
- [ ] "정렬" → 전방 유닛 수 비례 AR/MR 적용
- [ ] "쌍둥이 수호자" → 전방 2명일 때만 버프 활성화
- [ ] 유닛 위치 변경 → 칸 버프 실시간 재계산 (hexBuffs useMemo)

---

*Created: 2026-04-16*
*Feature: augment-effect-system*
*Phase: Design*
*References: augment-effect-system.plan.md*
