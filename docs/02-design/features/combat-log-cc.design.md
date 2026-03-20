# Design: 전투 로그 CC/상태이상 이벤트 추가

> Plan 참조: `docs/01-plan/features/combat-log-cc.plan.md`

---

## 1. 아키텍처 개요

```
src/types/index.ts                          ← [수정] CombatLog 타입 확장
         │
         └──→ src/lib/simulator/engine/combatLoop.ts  ← [수정] 상태이상 로그 생성
                   │
                   ├── tickStatusEffects()   ← 시그니처 확장, 만료 로그 생성
                   ├── applyWardenShields()  ← shield 적용 로그 추가
                   ├── 어빌리티 shield       ← 이미 ability 로그 있음 (변경 없음)
                   ├── 아이템 shield          ← 이미 ability 로그 있음 (변경 없음)
                   └── 증강 burn             ← burn 적용 로그 추가
```

**핵심 원칙**: 상태이상 적용/해제 시점에 `CombatLog`를 생성하여 `TickSnapshot.events`에 포함시킨다. 기존 로그 흐름을 그대로 따르며, 새로운 이벤트 타입만 추가한다.

---

## 2. 모듈 상세 설계

### 2.1 `src/types/index.ts` — CombatLog 타입 확장

#### 변경 전 (line 345-353)

```typescript
export interface CombatLog {
  tick: number;
  time: number;
  type: 'attack' | 'ability' | 'move' | 'death' | 'mana';
  sourceId: string;
  targetId?: string;
  value?: number;
  message: string;
}
```

#### 변경 후

```typescript
export interface CombatLog {
  tick: number;
  time: number;
  type: 'attack' | 'ability' | 'move' | 'death' | 'mana'
      | 'status_apply' | 'status_expire';
  sourceId: string;
  targetId?: string;
  value?: number;
  /** 상태이상 이벤트일 때 어떤 상태이상인지 */
  statusType?: StatusEffectType;
  message: string;
}
```

**변경 사항**:
- `type` union에 `'status_apply' | 'status_expire'` 추가
- `statusType?: StatusEffectType` 필드 추가 (status 이벤트에서만 사용)

**호환성**: `statusType`은 optional이므로 기존 로그 생성 코드는 변경 없이 동작한다.

---

### 2.2 `combatLoop.ts` — `tickStatusEffects()` 시그니처 확장

#### 변경 전 (line 115-123)

```typescript
function tickStatusEffects(unit: CombatUnit): void {
  for (const effect of unit.statusEffects) {
    effect.remainingTicks--;
    if (effect.type === 'burn' && effect.value) {
      unit.currentHp -= effect.value;
    }
  }
  unit.statusEffects = unit.statusEffects.filter(e => e.remainingTicks > 0);
}
```

#### 변경 후

```typescript
function tickStatusEffects(
  unit: CombatUnit,
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): void {
  for (const effect of unit.statusEffects) {
    effect.remainingTicks--;
    if (effect.type === 'burn' && effect.value) {
      unit.currentHp -= effect.value;
    }
  }

  // 만료된 상태이상 로그 생성
  const expired = unit.statusEffects.filter(e => e.remainingTicks <= 0);
  for (const effect of expired) {
    const label = STATUS_EFFECT_LABELS[effect.type as StatusEffectType];
    if (label) {
      const log: CombatLog = {
        tick, time,
        type: 'status_expire',
        sourceId: unit.id,
        statusType: effect.type as StatusEffectType,
        message: `${unit.champion.name}의 ${label} 해제`,
      };
      logs.push(log);
      tickLogs.push(log);
    }
  }

  unit.statusEffects = unit.statusEffects.filter(e => e.remainingTicks > 0);
}
```

#### 호출부 변경 (line 542)

```typescript
// 변경 전
tickStatusEffects(unit);

// 변경 후
tickStatusEffects(unit, tick, time, logs, tickLogs);
```

---

### 2.3 한글 레이블 매핑 (combatLoop.ts 내부)

`statusEffectConfig.ts`는 UI 레이어 모듈이므로 엔진에서 import하지 않는다 (엔진 독립성 원칙). 대신 `combatLoop.ts` 상단에 간단한 레이블 맵을 정의한다.

```typescript
import type { StatusEffectType } from '@/types';

/** 상태이상 한글 레이블 (엔진 로그용) */
const STATUS_EFFECT_LABELS: Record<StatusEffectType, string> = {
  stun: '기절',
  slow: '둔화',
  burn: '화상',
  disarm: '무장해제',
  taunt: '도발',
  shield: '보호막',
  invulnerable: '무적',
};
```

**설계 결정**: 엔진(`src/lib/simulator/`)은 UI(`src/lib/statusEffectConfig.ts`)에 의존하지 않아야 하므로 (CLAUDE.md 규칙), 레이블을 별도로 정의한다. 7개 항목이라 중복 비용이 낮다.

---

### 2.4 상태이상 적용 로그 — 각 위치별 상세

#### (A) 증강 burn 적용 (line 598-605)

```typescript
// 기존 코드 뒤에 추가
if (unit.augmentBurnPercent > 0) {
  const burnDmg = target.maxHp * unit.augmentBurnPercent;
  const burnPerTick = burnDmg / (TICKS_PER_SECOND * 3);
  target.statusEffects.push({
    type: 'burn', sourceId: unit.id,
    remainingTicks: TICKS_PER_SECOND * 3,
    value: burnPerTick,
  });

  // ← 여기에 추가
  const burnLog: CombatLog = {
    tick, time,
    type: 'status_apply',
    sourceId: unit.id,
    targetId: target.id,
    statusType: 'burn',
    value: TICKS_PER_SECOND * 3,
    message: `${unit.champion.name}이(가) ${target.champion.name}에게 화상 적용 (3.0초)`,
  };
  logs.push(burnLog);
  tickLogs.push(burnLog);
}
```

#### (B) Warden 시너지 shield (line 103-112)

`applyWardenShields()`는 전투 시작 전에 호출되며 `logs`/`tickLogs` 접근이 없다. 이 함수는 전투 루프 밖에서 실행되므로:

**결정**: Warden shield는 전투 시작 이전에 적용되므로 로그를 생성하지 않는다. 이미 tick=0에서 shield가 존재하는 것으로 충분하다.

#### (C) 어빌리티 shield (line 638-648)

이미 `type: 'ability'` 로그가 "보호막 획득!" 메시지로 생성되고 있다. 중복을 피하기 위해 별도 `status_apply` 로그를 추가하지 않는다.

#### (D) 아이템 shield — KineticBarrier (line 381-393)

마찬가지로 이미 `type: 'ability'` 로그가 "역장 방벽 발동!" 메시지로 존재한다. 추가 안 함.

#### (E) 향후 stun/slow/disarm/taunt 적용 시

현재 엔진에서 stun을 직접 `statusEffects.push()`하는 코드가 없다 (포탑 `turretStunDuration`만 존재, 실제 push 미구현). 향후 어빌리티 CC 구현 시 아래 패턴을 따른다:

```typescript
// 어빌리티 CC 적용 패턴 (향후 구현 시)
target.statusEffects.push({
  type: 'stun', sourceId: unit.id,
  remainingTicks: stunTicks,
});
const ccLog: CombatLog = {
  tick, time,
  type: 'status_apply',
  sourceId: unit.id,
  targetId: target.id,
  statusType: 'stun',
  value: stunTicks,
  message: `${unit.champion.name}이(가) ${target.champion.name}에게 기절 적용 (${(stunTicks / TICKS_PER_SECOND).toFixed(1)}초)`,
};
logs.push(ccLog);
tickLogs.push(ccLog);
```

---

## 3. 데이터 흐름

```
Engine (combatLoop.ts)
  → statusEffects.push() + CombatLog { type: 'status_apply' }
  → tickStatusEffects() 만료 감지 + CombatLog { type: 'status_expire' }
    → logs[] (CombatResult.logs)
    → tickLogs[] (TickSnapshot.events)
      → ReplayBoard: snapshot.events에 status 이벤트 포함
      → 향후 EventLog UI: status 이벤트 표시 가능
```

---

## 4. 파일별 변경 명세

| 파일 | 작업 | 변경 라인(예상) |
|------|------|---------------|
| `src/types/index.ts` | `CombatLog.type` 확장 + `statusType` 필드 추가 | +3줄 |
| `src/lib/simulator/engine/combatLoop.ts` | `STATUS_EFFECT_LABELS` 추가, `tickStatusEffects` 확장, burn 적용 로그 추가 | +35줄 |

**총 변경**: 수정 2파일, 순증 ~38줄

---

## 5. 구현 순서

```
Step 1: src/types/index.ts — CombatLog 타입 확장
        → pnpm typecheck

Step 2: src/lib/simulator/engine/combatLoop.ts
        — STATUS_EFFECT_LABELS 상수 추가
        — tickStatusEffects() 시그니처 + 만료 로그 로직 추가
        — tickStatusEffects() 호출부 파라미터 추가
        — 증강 burn 적용 로그 추가
        → pnpm lint && pnpm typecheck && pnpm build

Step 3: 최종 검증
        → pnpm lint && pnpm typecheck && pnpm build
```

---

## 6. 기존 코드 영향 분석

### 6.1 ReplayBoard.tsx (line 70-82)

```typescript
const combatEvents: { ... type: 'attack' | 'ability' }[] = [];
if (snapshot) {
  for (const evt of snapshot.events) {
    if ((evt.type === 'attack' || evt.type === 'ability') && ...) {
```

`status_apply`/`status_expire` 이벤트는 `type === 'attack' || type === 'ability'` 조건에 해당하지 않으므로 **자동으로 무시된다**. 변경 불필요.

### 6.2 로그 볼륨 추정

| 이벤트 | 빈도 | 추가 로그 수 |
|--------|------|------------|
| burn 적용 | 공격당 1회 (증강 보유 유닛) | 전투당 ~10-20회 |
| burn 해제 | 3초마다 | 전투당 ~10-20회 |
| shield 해제 | shield 만료 시 | 전투당 ~5-10회 |
| stun 적용/해제 | (향후 구현) | - |

기존 전투당 로그 ~200-500개 대비 10-15% 증가 예상. 성능 영향 무시 가능.

### 6.3 `status_apply` 로그의 `value` 필드

`value`에 `remainingTicks`(지속시간 틱 수)를 저장한다. 이는 기존 `value` 필드가 damage/shield 수치를 담는 것과 의미가 다르지만, `statusType` 필드로 구분 가능하므로 문제없다.

---

## 7. 제외 사항

- Warden shield 전투 시작 로그 → 전투 루프 밖이므로 제외
- 어빌리티/아이템 shield 적용 로그 → 이미 `ability` 타입 로그로 충분
- EventLog UI 컴포넌트 → 별도 feature
- CC 통계 집계 → 별도 feature
