# Design: 전투 데미지 사이드바 + 챔피언 상세 스탯 패널

> Plan: `docs/01-plan/features/battle-stats-panel.plan.md`

---

## 1. TickSnapshot 타입 확장

**파일**: `src/types/index.ts`

현재 `TickSnapshot.units[id]`에 `totalDamageDealt`, `stats`, `damageAmp` 등이 없어
리플레이 중 데미지/스탯 표시가 불가능하다.

### 1.1 변경할 타입

```ts
// src/types/index.ts — TickSnapshot 수정
export interface TickSnapshotUnit {
  id: string;
  currentHp: number;
  currentMana: number;
  position: HexCoord;
  isAlive: boolean;
  shield: number;
  statusEffects: { type: string; remainingTicks: number; value?: number }[];
  // ── 추가 필드 ──
  totalDamageDealt: number;
  stats: ChampionStats;
  damageAmp: number;
  omnivamp: number;
  damageReduction: number;
}

export interface TickSnapshot {
  tick: number;
  units: Record<string, TickSnapshotUnit>;
  events: CombatLog[];
}
```

**설계 결정**:
- 인라인 객체 리터럴 대신 `TickSnapshotUnit` 인터페이스를 분리하여 재사용성 확보
- `ChampionStats`는 스프레드 복사 (`{ ...u.stats }`) — 전투 중 mutate 되므로 값 복사 필수
- `stats` 안에 이미 `damage`(AD), `ap`, `armor`, `magicResist`, `attackSpeed`, `critChance` 포함

---

## 2. captureSnapshot 수정

**파일**: `src/lib/simulator/engine/replayEngine.ts`

```ts
// replayEngine.ts — captureSnapshot 수정
export function captureSnapshot(
  tick: number,
  units: CombatUnit[],
  tickEvents: CombatLog[]
): TickSnapshot {
  const unitMap: TickSnapshot['units'] = {};
  for (const u of units) {
    unitMap[u.id] = {
      id: u.id,
      currentHp: u.currentHp,
      currentMana: u.currentMana,
      position: { ...u.position },
      isAlive: u.state !== 'dead',
      shield: u.shield,
      statusEffects: u.statusEffects.map(e => ({
        type: e.type,
        remainingTicks: e.remainingTicks,
        value: e.value,
      })),
      // ── 추가 ──
      totalDamageDealt: u.totalDamageDealt,
      stats: { ...u.stats },           // 값 복사 (mutate 방지)
      damageAmp: u.damageAmp,
      omnivamp: u.omnivamp,
      damageReduction: u.damageReduction,
    };
  }
  return { tick, units: unitMap, events: tickEvents };
}
```

**주의**: `stats`는 반드시 스프레드 복사. `CombatUnit.stats`는 전투 중 직접 수정되므로
참조 복사 시 이전 틱 스냅샷의 값도 같이 변경된다.

---

## 3. DamageSidebar 컴포넌트

**파일**: `src/components/battle/DamageSidebar.tsx`

### 3.1 Props

```ts
interface DamageSidebarProps {
  combatResult: CombatResult;
  currentSnapshot: TickSnapshot | null;
  selectedUnitId: string | null;
  onUnitClick: (unitId: string) => void;
}
```

### 3.2 데이터 구조

```ts
interface DamageEntry {
  unitId: string;
  championName: string;
  championApiName: string;
  cost: number;
  starLevel: number;
  totalDamage: number;       // AD + AP 합산 데미지
  isAlive: boolean;
  team: 'player' | 'enemy';
}
```

### 3.3 동작

1. **데이터 소스 결정**:
   - `currentSnapshot`이 있으면 → `snapshot.units[id].totalDamageDealt` 사용 (리플레이 중)
   - 없으면 → `combatResult.playerUnits/enemyUnits`의 `totalDamageDealt` (전투 종료 후)

2. **팀별로 분리** → 내림차순 정렬 (totalDamage 기준)

3. **각 행 렌더링** (`DamageRow` 인라인):
   ```
   [초상화 32x32] [이름]          [데미지 수치]
   [██████████████░░░░░░░] (팀 내 최대 대비 비율 바)
   ```
   - 초상화: `getChampionImage(apiName)` (기존 유틸 재사용)
   - 데미지 수치: `toLocaleString()` 정수 포맷
   - 비율 바: 팀 내 최대 데미지 대비 % → `width` 스타일
   - 사망 챔피언: `opacity-40` + 취소선

4. **챔피언 클릭**: `onUnitClick(unitId)` → `selectedUnitId` 설정

### 3.4 레이아웃

```
┌─ DamageSidebar (w-60, 우측) ──────────┐
│ ▎ TEAM A — 데미지                       │
│ ┌──────────────────────────────────────┐│
│ │ [img] 징크스          3,247          ││
│ │ [████████████████░░░░]               ││
│ │ [img] 자이라          2,103          ││
│ │ [████████████░░░░░░░░]               ││
│ │ ...                                  ││
│ └──────────────────────────────────────┘│
│ ▎ TEAM B — 데미지                       │
│ ┌──────────────────────────────────────┐│
│ │ [img] 다리우스        2,891          ││
│ │ [████████████████░░░░]               ││
│ │ ...                                  ││
│ └──────────────────────────────────────┘│
└────────────────────────────────────────┘
```

---

## 4. UnitDetailPanel 컴포넌트

**파일**: `src/components/battle/UnitDetailPanel.tsx`

### 4.1 Props

```ts
interface UnitDetailPanelProps {
  /** 현재 틱의 스냅샷 유닛 데이터 (stats, damageAmp 등 포함) */
  unitSnapshot: TickSnapshotUnit;
  /** 챔피언 메타 정보 */
  meta: {
    championName: string;
    championApiName: string;
    cost: number;
    starLevel: number;
    maxHp: number;
    maxMana: number;
  };
  onClose: () => void;
}
```

### 4.2 표시할 스탯 7개

| 라벨 | 값 소스 | 포맷 |
|------|---------|------|
| 공격력 | `unitSnapshot.stats.damage` | 정수 |
| 주문력 | `unitSnapshot.stats.ap` | 정수 |
| 피해증폭 | `unitSnapshot.damageAmp` | `%` (×100) |
| 방어력 | `unitSnapshot.stats.armor` | 정수 |
| 마법방어력 | `unitSnapshot.stats.magicResist` | 정수 |
| 공격속도 | `unitSnapshot.stats.attackSpeed` | 소수 2자리 |
| 치명타 확률 | `unitSnapshot.stats.critChance` | `%` (×100) |

### 4.3 레이아웃

보드 하단 고정 영역. 챔피언 클릭 시 나타나고, 다시 클릭하거나 X 버튼으로 닫음.

```
┌─ UnitDetailPanel (보드 하단, full-width) ──────────────────────┐
│ [img] 징크스 ★★  ────────────────────────────── [X 닫기]       │
│                                                                │
│  공격력    85     주문력    40     피해증폭   15%               │
│  방어력    45     마법방어   30     공격속도   0.85              │
│  치명타   25%                                                  │
└────────────────────────────────────────────────────────────────┘
```

- 그리드: `grid grid-cols-3 gap-x-6 gap-y-1`
- 라벨: `text-[10px] text-gray-500`
- 값: `text-sm font-mono text-gray-200`
- 기본값 대비 증가 시 `text-green-400`, 감소 시 `text-red-400` (추후 확장, MVP에서는 단색)

### 4.4 데이터 접근 (idle 상태)

전투 전 (setup 모드)에서는 `TickSnapshot`이 없으므로 이 패널은 **replay 모드에서만 표시**.
setup 모드의 유닛 선택은 기존 `SelectedUnitPanel` 컴포넌트가 담당한다 (변경 없음).

---

## 5. Simulator 페이지 레이아웃 변경

**파일**: `src/app/simulator/page.tsx`

### 5.1 현재 레이아웃 (replay 모드)

```
┌────────────────────────────────────────────────────┐
│ [Board (flex-1)]              │ [Unit Detail (w-56)]│
│                               │  - UnitToken        │
│                               │  - HP/Mana/위치     │
│                               │  - TEAM A 목록      │
│                               │  - TEAM B 목록      │
└────────────────────────────────────────────────────┘
```

### 5.2 변경 후 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ [Board (flex-1)]              │ [DamageSidebar (w-60)]       │
│                               │  - TEAM A 데미지 랭킹         │
│                               │  - TEAM B 데미지 랭킹         │
├───────────────────────────────┴──────────────────────────────┤
│ [UnitDetailPanel — 클릭 시 표시, 7개 스탯 그리드]              │
└──────────────────────────────────────────────────────────────┘
```

**변경 사항**:
1. 기존 우측 패널 (UnitToken + HP/Mana + 유닛 목록)을 → `DamageSidebar`로 **교체**
   - 유닛 목록은 DamageSidebar 내부에서 데미지 수치와 함께 표시되므로 중복 제거
   - 선택된 유닛의 HP/Mana/상태이상 정보는 UnitDetailPanel로 이동
2. Board + DamageSidebar 아래에 `UnitDetailPanel` 추가 (챔피언 클릭 시 표시)

### 5.3 상태 관리

새로운 state 추가 불필요:
- `replay.selectedUnitId` — 이미 존재 (클릭된 유닛 ID)
- `replay.currentSnapshot` — 이미 존재 (틱별 스냅샷)
- `replay.combatResult` — 이미 존재 (전체 전투 결과)

DamageSidebar와 UnitDetailPanel 모두 기존 replay hook의 데이터를 props로 전달.

### 5.4 useReplayControls 확장

`selectedUnitSnap`이 이미 `TickSnapshotUnit`을 반환하므로, 타입 확장 후 자동으로
`stats`, `damageAmp` 등에 접근 가능. 추가 코드 불필요.

---

## 6. 구현 순서 및 파일 목록

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| 1 | `TickSnapshotUnit` 인터페이스 분리 + 확장 | `src/types/index.ts` | 없음 |
| 2 | `captureSnapshot()`에서 추가 필드 복사 | `src/lib/simulator/engine/replayEngine.ts` | #1 |
| 3 | `DamageSidebar` 컴포넌트 구현 | `src/components/battle/DamageSidebar.tsx` | #1 |
| 4 | `UnitDetailPanel` 컴포넌트 구현 | `src/components/battle/UnitDetailPanel.tsx` | #1 |
| 5 | Simulator 페이지 레이아웃 변경 | `src/app/simulator/page.tsx` | #2, #3, #4 |
| 6 | lint + typecheck + build 확인 | — | #5 |

---

## 7. 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| 전투 전 (idle) | DamageSidebar: "전투를 시작하세요" 표시, UnitDetailPanel: 미표시 |
| 사망 유닛 | DamageSidebar: `opacity-40` + 유지 (데미지 값 그대로), UnitDetailPanel: 마지막 스탯 표시 |
| 갈리오 (필드 소환 유닛) | `unitMeta`에 포함되어 있으므로 DamageSidebar에 정상 표시 |
| 모든 유닛 데미지 0 | 비율 바 0% 표시, 수치 "0" |
| 리플레이 틱 0 (전투 시작) | 모든 유닛 `totalDamageDealt: 0`, 스탯은 초기 전투 스탯 표시 |

---

## 8. React Compiler 준수 사항

- DamageSidebar 내 정렬된 데이터는 `useMemo` 없이 렌더링 중 계산 (파생값 패턴)
  ```ts
  // ✅ OK — 렌더링 중 계산, setState 없음
  const playerDamage = combatResult.playerUnits
    .map(u => ({ ...buildEntry(u) }))
    .sort((a, b) => b.totalDamage - a.totalDamage);
  ```
- `useEffect` 내 setState 금지 — 모든 데이터는 props/snapshot에서 직접 파생
- UnitDetailPanel은 `selectedUnitId` 변경 시 자동 리렌더 (별도 effect 불필요)
