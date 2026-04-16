# Design: 역할군 패시브 능력 구현 (Set 17 업데이트)

## 1. 현재 구현 현황

| 항목 | 상태 | 위치 |
|------|:----:|------|
| Fighter/Assassin 비타겟 피해 감소 15% | ✅ | `combatLoop.ts:458-459, 1617-1619, 1797-1799` |
| 마나 수치 6종 | ✅ | `mana.ts:22-28` |
| Caster 초당 마나 2 재생 | ✅ | `mana.ts:51-60` |
| Tank 피격 시 마나 / 타게팅 가중치 / Fighter 옴니뱀프 | ✅ | 각각 구현 완료 |
| **암살자 후열 점프 — 잘못된 구현** | ⚠️ 제거 필요 | `combatLoop.ts:462-524` |
| **전사 AS 패시브 (5~30%, 스테이지 비례)** | ❌ | — |
| **스테이지 번호 입력 UI** | ❌ | — |

### 1.1 잘못된 구현: 암살자 후열 점프

`applyAssassinJump` (combatLoop.ts:462-524)는 Set 17 역할군 패시브에 존재하지 않는 기능.
lolchess.gg 기준 암살자 패시브는 **비타겟 피해 감소 15%만** 해당.
후열 점프는 이전 세트의 잔재이므로 **제거해야 함**.

---

## 2. 전사 AS 패시브 구현

### 2.1 상수 테이블 (`src/lib/simulator/models/unit.ts`)

```typescript
/** 전사 스테이지별 AS 보너스 (lolchess.gg: 5~30%) */
export const FIGHTER_AS_BY_STAGE: number[] = [
  0,     // stage 0 (미사용)
  0.05,  // stage 1: +5%
  0.10,  // stage 2: +10%
  0.15,  // stage 3: +15%
  0.20,  // stage 4: +20%
  0.25,  // stage 5: +25%
  0.30,  // stage 6: +30%
  0.30,  // stage 7: +30% (상한)
];

export function getFighterASBonus(stageNumber: number): number {
  const clamped = Math.max(1, Math.min(stageNumber, 7));
  return FIGHTER_AS_BY_STAGE[clamped];
}
```

### 2.2 SimulateOptions 확장 (`combatLoop.ts`)

```typescript
export interface SimulateOptions {
  // 기존...
  /** 현재 스테이지 번호 (전사 AS 패시브, 기본값 4) */
  stageNumber?: number;
}
```

### 2.3 전투 시작 시 적용 함수 (`combatLoop.ts`)

```typescript
import { getFighterASBonus } from '@/lib/simulator/models/unit';

function applyFighterASBonus(units: CombatUnit[], stageNumber: number): void {
  const bonus = getFighterASBonus(stageNumber);
  if (bonus <= 0) return;
  for (const unit of units) {
    if (unit.role === 'Fighter') {
      unit.stats.attackSpeed *= (1 + bonus);
    }
  }
}
```

### 2.4 호출 위치

시너지 버프 적용 직후, 칸 버프 전 (현재 ~1431줄):

```
applySet17SynergyBuffs(playerActiveTraits, playerUnits);
applySet17SynergyBuffs(enemyActiveTraits, enemies);

const stageNumber = options.stageNumber ?? 4;          ← 추가
applyFighterASBonus(playerUnits, stageNumber);          ← 추가
applyFighterASBonus(enemies, stageNumber);              ← 추가

if (options.playerHexBuffs?.length) applyHexBuffs(...);
```

---

## 3. 스테이지 번호 입력 UI

### 3.1 page.tsx 상태

```typescript
const [stageNumber, setStageNumber] = useState(4);
```

### 3.2 simulateCombat에 전달

두 곳 (runSimulation, runMultiple) 모두:
```typescript
simulateCombat(mappedPlayer, tm.enemyTeam, {
  // 기존...
  stageNumber,
});
```

useCallback 의존성 배열에 `stageNumber` 추가.

### 3.3 드롭다운 UI 위치

시뮬레이션 버튼 영역(팀 설정 패널)에 배치:

```tsx
<div className="flex items-center gap-2">
  <label className="text-xs text-gray-400">스테이지</label>
  <select
    value={stageNumber}
    onChange={e => setStageNumber(Number(e.target.value))}
    className="bg-[#1f2937] text-gray-200 text-sm rounded px-2 py-1 border border-gray-600"
  >
    {[1,2,3,4,5,6,7].map(s => (
      <option key={s} value={s}>
        Stage {s} (전사 AS +{s <= 6 ? s * 5 : 30}%)
      </option>
    ))}
  </select>
</div>
```

---

## 4. 암살자 후열 점프 제거

### 4.1 제거 대상

- `applyAssassinJump` 함수 (combatLoop.ts:462-524)
- 호출부 2곳 (combatLoop.ts:1501-1502)

### 4.2 주의사항

- 함수 제거 후 `getTargetingWeight` import가 이 함수에서만 사용되는지 확인
- 제거 후 암살자는 일반 유닛과 동일하게 배치 위치에서 전투 시작 (이동으로 접근)

---

## 5. 수정 파일 목록

| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/lib/simulator/models/unit.ts` | `FIGHTER_AS_BY_STAGE` 배열, `getFighterASBonus` 함수 추가 |
| 2 | `src/lib/simulator/engine/combatLoop.ts` | `applyAssassinJump` 제거, `SimulateOptions.stageNumber`, `applyFighterASBonus` 추가 |
| 3 | `src/app/simulator/page.tsx` | `stageNumber` 상태, simulateCombat 전달, 드롭다운 UI |

---

## 6. 구현 순서

### Phase 1: 잘못된 구현 제거
1. `combatLoop.ts` — `applyAssassinJump` 함수 + 호출부 제거

### Phase 2: 전사 AS 패시브 (엔진)
2. `unit.ts` — `FIGHTER_AS_BY_STAGE` + `getFighterASBonus`
3. `combatLoop.ts` — `SimulateOptions.stageNumber` + `applyFighterASBonus` + 호출

### Phase 3: UI
4. `page.tsx` — `stageNumber` 상태 + simulateCombat 전달 + 드롭다운

---

## 7. 테스트 체크리스트

- [ ] 암살자 전투 시작 → 후열 점프 없음 (배치 위치에서 시작)
- [ ] Stage 1 전사 → AS × 1.05
- [ ] Stage 4 전사 (기본값) → AS × 1.20
- [ ] Stage 7 전사 → AS × 1.30 (상한)
- [ ] 비전사 유닛 → AS 보너스 없음
- [ ] stageNumber 미입력 → 기본값 4 적용
- [ ] 100전 시뮬 → stageNumber 일관 적용
- [ ] 비타겟 피해 감소 → 기존 동작 유지

---

*Updated: 2026-04-16*
*Feature: role-passive*
*Phase: Design*
*References: role-passive.plan.md*
