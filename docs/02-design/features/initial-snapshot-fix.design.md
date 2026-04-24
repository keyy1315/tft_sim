# Design: 전투 초기 스냅샷 누락 수정

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 전투 초기 스냅샷 누락 수정 (initial-snapshot-fix) |
| Plan 참조 | `docs/01-plan/features/initial-snapshot-fix.plan.md` |
| 작성일 | 2026-04-22 |
| 작성자 | Dayoung |
| 상태 | Design |

| 관점 | 내용 |
|------|------|
| **Problem** | `snapshots[0]` 이 tick 0 처리 **이후** 상태라, 배치 직후 원본 포지션을 사용자가 단 한 프레임도 볼 수 없음. 비돌진 근접 유닛이 사거리 밖 적에 대해 tick 0 에 1칸 이동한 뒤 스냅샷이 찍혀, "이동 없이 적 앞에서 시작"처럼 보이는 증상 발생 |
| **Solution** | `simulateCombat` 메인 틱 루프 진입 직전에 초기 스냅샷 1장을 push. `snapshot.tick = -1` 을 pre-combat 의미로 사용. 기존 틱 인덱스/필드 그대로 유지 (최소 침습) |
| **Function UX Effect** | 리플레이 재생 시 첫 프레임이 배치 원본 상태 → tick 0 처리 후 → tick 1 처리 후 순서로 자연스럽게 관찰 가능. 텔레포트성 증상 일괄 해소 |
| **Core Value** | 결정론 불변, UI/엔진 분리 원칙 준수, 회귀 위험 최소화 |

---

## 1. Design Goals

1. **Observability 복원**: tick 0 에 발생하는 모든 상태 변화를 리플레이에서 관찰 가능
2. **최소 침습**: 엔진 로직과 외부 소비자(리플레이 UI, 분석 모듈) 모두 단 한 곳만 수정
3. **결정론 유지**: 스냅샷 타이밍만 변경, 시뮬레이션 로직은 불변
4. **UI/엔진 분리**: 렌더링 레이어에서 특수 케이스 처리하지 않음

---

## 2. 현재 동작 분석

### 2.1 스냅샷 생성 타임라인 (AS-IS)

```
시간축 →
┌─────────────────────────────────────────────────────────────┐
│ 배치 상태          [스냅샷 없음]                            │
│   ↓                                                         │
│ on_combat_start emit                                        │
│   ↓                                                         │
│ for (tick = 0; ...)                                         │
│   ├── unit.position = newPos (1칸 이동)                     │
│   └── snapshots.push(captureSnapshot(0, ...))   ← snapshots[0]
│   ├── ...                                                   │
│   └── snapshots.push(captureSnapshot(1, ...))   ← snapshots[1]
└─────────────────────────────────────────────────────────────┘

리플레이 첫 프레임 = snapshots[0] = 이미 tick 0 이동 적용 후
```

### 2.2 목표 동작 (TO-BE)

```
시간축 →
┌─────────────────────────────────────────────────────────────┐
│ 배치 상태                                                   │
│   ↓                                                         │
│ on_combat_start emit                                        │
│   ↓                                                         │
│ snapshots.push(captureSnapshot(-1, ...))  ← snapshots[0] NEW
│   ↓                                                         │
│ for (tick = 0; ...)                                         │
│   ├── unit.position = newPos                                │
│   └── snapshots.push(captureSnapshot(0, ...))   ← snapshots[1]
│   ├── ...                                                   │
│   └── snapshots.push(captureSnapshot(1, ...))   ← snapshots[2]
└─────────────────────────────────────────────────────────────┘

리플레이 첫 프레임 = snapshots[0] = 배치 원본 상태
```

---

## 3. `combatLoop.ts` 수정

### 3.1 삽입 위치

`src/lib/simulator/engine/combatLoop.ts:1524` (`on_combat_start` emit 다음 줄) 과 `1526` (for loop 진입) 사이에 1줄 추가.

### 3.2 패치 코드

```typescript
// src/lib/simulator/engine/combatLoop.ts
// 현재 1524 라인 뒤에 삽입

  eventBus.emit('on_combat_start', { sourceId: '', tick: 0 });

  // [NEW] 초기 배치 스냅샷 — tick 0 처리 이전의 원본 포지션 보존.
  // 리플레이 첫 프레임에 배치 상태를 노출하여, tick 0 에 발생하는
  // 이동/공격/돌진 시전 등의 상태 변화를 사용자가 관찰 가능하게 한다.
  snapshots.push(captureSnapshot(-1, allUnits, []));

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    // ... 기존 로직 유지 ...
    snapshots.push(captureSnapshot(tick, allUnits, tickLogs));
  }
```

### 3.3 삽입 타이밍의 선후 의존성

초기 스냅샷은 **반드시 다음 사항들 이후**에 push 되어야 한다:

| 선행 작업 | 이유 | 해당 라인 |
|----------|------|----------|
| 프렐요드 포탑 spawn (`playerTurrets`, `enemyTurrets`) | 전투 시작 시 기물로 존재해야 함 | `1448-1452` |
| 중재자 법률 `combat_start_per_star` 적용 | 버프 완료 상태를 초기 프레임으로 표시 | `1472-1480` |
| 첫 공격 랜덤 쿨다운 설정 (`attackCooldown = rng * maxDelayTicks`) | 스냅샷에는 영향 없지만 로직 완결성 | `1437-1443` |
| `ItemEffectRuntime.install` + `on_combat_start` emit | 아이템 전투 시작 트리거 버프 적용 후 상태 | `1515-1524` |

**결론**: 1524 (on_combat_start emit) 바로 다음이 안전. 이 지점에서 모든 전투 시작 상태가 확정됨.

### 3.4 `captureSnapshot` 타입 적합성

```typescript
// src/lib/simulator/engine/replayEngine.ts:10-14
export function captureSnapshot(
  tick: number,              // number — 음수 허용
  units: CombatUnit[],
  tickEvents: CombatLog[]
): TickSnapshot { ... }
```

`tick: number` 이므로 `-1` 전달 가능. 추가 타입 변경 불필요.

---

## 4. `BattleControls.tsx` 시간 표시 가드

### 4.1 현재 코드

```typescript
// src/components/battle/BattleControls.tsx:30-32
const timeSeconds = totalTicks > 0 ? (currentTick / ticksPerSecond).toFixed(1) : '0.0';
const totalSeconds = totalTicks > 0 ? (totalTicks / ticksPerSecond).toFixed(1) : '0.0';
const progress = totalTicks > 0 ? (currentTick / totalTicks) * 100 : 0;
```

**문제**: 초기 스냅샷은 배열 index 0 에 위치하므로 `replayTick === 0` 일 때 `currentTick = 0` 이 된다. 스냅샷 자체의 `tick = -1` 필드는 UI 에 직접 노출되지 않음. 따라서 **현재 코드 변경 불필요**.

단, 안전장치로 `Math.max(0, ...)` 가드 추가 권장 (스냅샷 index 기반 계산이 항상 양수 유지).

### 4.2 보정 패치 (선택)

```typescript
const safeTick = Math.max(0, currentTick);
const timeSeconds = totalTicks > 0 ? (safeTick / ticksPerSecond).toFixed(1) : '0.0';
const progress = totalTicks > 0 ? (safeTick / totalTicks) * 100 : 0;
```

실제로는 `currentTick = replayTick` 이며 `setReplayTick(0)` / `setReplayTick(prev + 1)` 로만 변경되므로 음수가 되지 않는다. 방어적 코드이지 필수는 아님.

---

## 5. 영향 범위 매트릭스

### 5.1 변경 필요 (수정 대상)

| 파일 | 변경 내용 | 예상 diff |
|------|----------|----------|
| `src/lib/simulator/engine/combatLoop.ts` | 초기 스냅샷 push 1줄 + 주석 3줄 | +4 |

### 5.2 자동 적응 (코드 수정 불필요)

| 파일 | 이유 |
|------|------|
| `src/hooks/useReplayControls.ts` | `snapshots.length` 기반 경계 체크. 길이가 +1 되어도 자동 반영 |
| `src/lib/simulator/engine/replayEngine.ts` | `totalTicks = snapshots.length`, `seek/step` 은 index 경계 기반 |
| `src/app/simulator/layout/SimulatorLayoutDesktop.tsx`<br>`SimulatorLayoutMobile.tsx`<br>`SimulatorLayoutTablet.tsx` | `snapshots.length` 와 `replay.replayTick` 만 사용 |
| `src/components/battle/ReplayBoard.tsx` | `snapshot.units[id].position` 직접 사용. 배치 상태도 정상 렌더 |
| `src/components/battle/BattleControls.tsx` | `currentTick` 은 `replayTick` (index), 음수 없음 |

### 5.3 무관 (영향 없음 확인)

| 파일 | 근거 |
|------|------|
| `src/lib/analysis/defeatReport.ts` | `log.tick` 기반. 스냅샷 index 와 독립 |
| `src/hooks/useCombatAnalysis.ts` | 동일. `deathLog.tick` 사용 |
| `src/lib/simulator/systems/items/runtime.ts` | `payload.tick` 은 eventBus 이벤트 시점. 엔진 내부 값 |
| `src/lib/simulator/systems/items/definitions/psyops.ts` | `ctx.tick` 은 아이템 런타임 내부 |
| `src/lib/simulator/systems/items/primitives/action.ts` | 동일 |

---

## 6. 테스트 계획

### 6.1 단위 테스트 (신규)

**파일**: `tests/unit/combatLoop-initial-snapshot.test.ts` (신규)

```typescript
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { offsetToAxial } from '@/types';
// ... 테스트용 fixture import

describe('전투 초기 스냅샷', () => {
  it('snapshots[0] 은 tick 0 처리 이전의 배치 상태를 보존한다', () => {
    const placedPos = offsetToAxial({ row: 4, col: 0 });  // player front left
    const player = makeMeleeUnit(placedPos);
    const enemyFarPos = offsetToAxial({ row: 2, col: 0 }); // distance 2
    const enemy = makeMeleeUnit(enemyFarPos);

    const result = simulateCombat([player], [enemy], {
      seed: 42, allTraits: [], skipMirror: true,
    });

    const firstSnap = result.snapshots[0];
    const playerSnap = firstSnap.units[player.id];

    expect(firstSnap.tick).toBe(-1);
    expect(playerSnap.position).toEqual(placedPos);  // 원본 위치 그대로
    expect(firstSnap.events).toEqual([]);
  });

  it('snapshots[1] 이후는 기존과 동일한 tick 처리 후 상태를 나타낸다', () => {
    const result = simulateCombat(/* ... */);
    expect(result.snapshots[1].tick).toBe(0);  // tick 0 처리 후
    expect(result.snapshots[2].tick).toBe(1);  // tick 1 처리 후
  });

  it('프렐요드 포탑은 초기 스냅샷에 포함된다', () => {
    // 프렐요드 시너지 활성 팀으로 구성
    const result = simulateCombat(/* Freljord team */);
    const turretIds = Object.keys(result.snapshots[0].units)
      .filter(id => id.endsWith('-turret'));
    expect(turretIds.length).toBeGreaterThan(0);
  });

  it('중재자 법률 combat_start_per_star 효과가 초기 스냅샷에 반영된다', () => {
    // 중재자 3명 + mana 효과 법률
    const result = simulateCombat(/* ... */, {
      playerArbiterLaw: { triggerId: 'combat_start_per_star', effectId: 'mana' },
    });
    const arbiterSnap = result.snapshots[0].units['player-0'];
    expect(arbiterSnap.currentMana).toBeGreaterThan(0);  // 법률 적용 후 값
  });
});
```

### 6.2 회귀 테스트

| 기존 테스트 | 경로 | 기대 |
|-----------|------|------|
| Calibration DPS | `tests/calibration/calibrate-dps.test.ts` | 기존과 동일하게 통과 — 시뮬레이션 결정론 불변 |
| Item recommender | `tests/unit/itemRecommender.test.ts` | 영향 없음 |
| 기타 combatLoop 관련 단위 테스트 | `tests/unit/*.test.ts` | `snapshots.length` 기반 assertion 은 +1 로 조정 필요 여부 확인 |

### 6.3 수동 검증 시나리오

**재현 시나리오 A — 비돌진 근접 유닛**:
1. Aatrox (TFT17_Aatrox, 돌진 없음) 를 player 4.0 에 배치
2. Poppy (TFT17_Poppy, 돌진 없음) 를 enemy 2.0 에 배치 (거리 2)
3. Run Simulation → Replay 재생
4. **기대**: 첫 프레임에 Aatrox 가 row 4 에 있고, 다음 프레임부터 row 3 으로 이동하는 것이 보인다

**재현 시나리오 B — 돌진 시전 (기존 동작 유지 확인)**:
1. Riven (TFT17_Riven, dash: to_target) 를 player 4.0 에 배치
2. 적을 enemy 0.6 에 배치
3. Run Simulation → Replay 재생
4. **기대**: 첫 프레임 배치 상태 → 이동 프레임들 → 스킬 시전 시점에 돌진 (여전히 한 프레임 텔레포트, 의도된 동작)

---

## 7. Edge Cases

| 케이스 | 처리 |
|-------|------|
| 양 팀 중 한 팀이 비어있음 | `simulateCombat` 진입 자체가 의미 없음. 초기 스냅샷 뒤에 바로 루프 break — snapshots 는 1개만 존재 |
| 모든 유닛이 토템(공격력=0, 공속=0, 사거리=0) | 이동/공격 모두 skip. snapshots[0] = 배치, snapshots[1] = 동일 상태. 정상 |
| `rng.next()` 가 attackCooldown 초기화에 이미 사용됨 | RNG 상태는 메인 루프 진입 전에 고정. 초기 스냅샷 push 는 RNG 를 쓰지 않으므로 결정론 유지 |
| Galio 소환 (매 1초) | tick 0 시점엔 소환되지 않음 (tick > 0 조건, `combatLoop.ts:1538`). 초기 스냅샷에 미포함 — 정상 |

---

## 8. Clean Architecture 위치

| Component | Layer | 위치 |
|-----------|-------|------|
| `simulateCombat` 엔진 | Infrastructure (Simulation Engine) | `src/lib/simulator/engine/combatLoop.ts` |
| `captureSnapshot` | Infrastructure | `src/lib/simulator/engine/replayEngine.ts` |
| `TickSnapshot` 타입 | Domain | `src/types/index.ts` |
| `useReplayControls` | Application | `src/hooks/useReplayControls.ts` |
| `ReplayBoard` / `BattleControls` | Presentation | `src/components/battle/` |

수정 대상은 Infrastructure 레이어 1개 파일. Presentation 은 자동 적응. 레이어 경계 침범 없음.

---

## 9. Coding Convention 준수

- `CLAUDE.md` — `console.log` 커밋 금지 ✅
- `eslint-disable` 추가 금지 ✅ (해당 없음)
- 시뮬레이션 엔진 순수성 (React 의존 없음) ✅
- `Math.random()` 직접 사용 금지 ✅ (RNG 미사용)
- TypeScript `any` 금지 ✅ (해당 없음)
- 주석은 한글 (프로젝트 관례) ✅

---

## 10. 구현 순서

| Step | 내용 | 파일 | 검증 |
|------|------|------|------|
| 1 | 초기 스냅샷 push 1줄 삽입 | `combatLoop.ts:1524` 뒤 | — |
| 2 | 단위 테스트 작성 (snapshots[0].tick === -1, 배치 상태 보존) | `tests/unit/combatLoop-initial-snapshot.test.ts` | `pnpm test` |
| 3 | 기존 테스트 중 `snapshots.length` / `snapshots[0]` 의존 케이스 확인 & 조정 | grep 기반 | `pnpm test` |
| 4 | 린트/타입/빌드 통과 확인 | — | `pnpm lint && pnpm typecheck && pnpm build` |
| 5 | 수동 재현 시나리오 A, B 검증 | 브라우저 | 시각 확인 |
| 6 | `BattleControls` 가드 추가 여부 결정 (선택) | `BattleControls.tsx:30-32` | — |

---

## 11. 수용 기준 (Acceptance Criteria)

1. `result.snapshots[0].tick === -1`
2. `result.snapshots[0].units[unitId].position` 가 placement 시 `unit.position` 과 동일 (이동 적용 전)
3. `result.snapshots[1].tick === 0` — 기존 tick 0 스냅샷이 index 1 로 이동
4. `result.snapshots.length === previousLength + 1` (기존 대비 정확히 1 증가)
5. 프렐요드 포탑 있는 팀일 경우 `snapshots[0].units` 에 포탑 포함
6. 중재자 `combat_start_per_star` 법률 적용 시 `snapshots[0]` 에 버프 완료 상태 반영
7. 리플레이 UI 에서 재생 시작 직후 배치 원본 위치가 1 프레임 표시됨
8. 기존 calibration 테스트 모두 통과 (결정론 불변)
9. `pnpm lint && pnpm typecheck && pnpm build` 세 단계 모두 성공
10. 새 `console.log` 나 `eslint-disable` 추가 없음

---

## 12. 롤백 계획

문제 발생 시 단일 커밋만 revert 하면 이전 동작 복원. 분리된 1줄 패치라 rollback 리스크 최소.

```bash
git revert <commit-sha>
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-22 | Initial draft | Dayoung |
