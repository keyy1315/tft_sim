# Plan: 전투 로그 CC/상태이상 이벤트 추가

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 전투 로그 CC/상태이상 이벤트 |
| 작성일 | 2026-03-20 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 전투 로그에 attack/ability/move/death/mana만 기록되어 CC(스턴, 둔화 등) 적용·해제 시점을 파악할 수 없음. 전투 분석에서 "왜 딜러가 멈췄는지"를 로그만으로 추적 불가 |
| **Solution** | CombatLog 타입에 `status_apply` / `status_expire` 이벤트를 추가하고, 엔진에서 statusEffects 변경 시 로그 자동 생성 |
| **Function UX Effect** | 전투 로그에서 "가렌에게 기절 적용 (2초)", "기절 해제" 등 CC 이벤트가 시간순으로 표시됨 |
| **Core Value** | CC 타이밍 분석이 가능해져 시뮬레이터의 전투 분석 정확도가 크게 향상됨 |

---

## 1. 현재 상태 분석

### 1.1 CombatLog 타입 (현재)

```typescript
// src/types/index.ts (line 345-353)
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

**문제**: `type`에 상태이상 관련 이벤트가 없다.

### 1.2 상태이상이 적용되는 위치 (combatLoop.ts)

엔진에서 `statusEffects.push()`가 호출되는 곳:

| 위치 | 상태이상 | 설명 |
|------|---------|------|
| Warden 시너지 | shield | 전투 시작 시 보호막 부여 |
| 키네틱 배리어 아이템 | shield | 아이템 효과로 보호막 |
| 어빌리티 시전 | shield | 스킬 보호막 |
| 증강 (burn) | burn | 화상 도트 데미지 |
| 어빌리티 (stun) | stun | 스킬 CC |
| tickStatusEffects() | (해제) | remainingTicks 감소 → 0이면 제거 |

**문제**: 이 모든 곳에서 `statusEffects.push()`만 하고 `CombatLog`를 생성하지 않는다.

### 1.3 분석 시나리오 영향

- "왜 내 딜러가 3초간 공격 안 했지?" → 로그에 스턴 기록 없음
- "보호막이 언제 걸렸고 언제 깨졌지?" → 로그에 보호막 적용/해제 없음
- "도발로 어그로가 전환된 시점은?" → 추적 불가

---

## 2. 변경 사항

### 2.1 R1: CombatLog 타입 확장

```typescript
export interface CombatLog {
  tick: number;
  time: number;
  type: 'attack' | 'ability' | 'move' | 'death' | 'mana'
      | 'status_apply' | 'status_expire';  // ← 추가
  sourceId: string;
  targetId?: string;
  value?: number;
  statusType?: StatusEffectType;  // ← 추가: 어떤 상태이상인지
  message: string;
}
```

### 2.2 R2: 엔진에서 상태이상 로그 자동 생성

`statusEffects.push()` 호출 직후에 `status_apply` 로그를 생성한다.

```typescript
// 적용 시
const log: CombatLog = {
  tick, time,
  type: 'status_apply',
  sourceId: caster.id,
  targetId: target.id,
  statusType: 'stun',
  value: durationTicks,
  message: `${caster.champion.name}이(가) ${target.champion.name}에게 기절 적용 (${durationSec}초)`,
};
logs.push(log);
tickLogs.push(log);
```

`tickStatusEffects()`에서 `remainingTicks`가 0이 되어 제거될 때 `status_expire` 로그를 생성한다.

```typescript
// 해제 시
const log: CombatLog = {
  tick, time,
  type: 'status_expire',
  sourceId: unit.id,
  statusType: effect.type,
  message: `${unit.champion.name}의 기절 해제`,
};
logs.push(log);
tickLogs.push(log);
```

### 2.3 R3: 전투 로그 UI에 CC 이벤트 표시

현재 전투 로그 UI가 `EventLog` 컴포넌트로 별도 구현되어 있지 않으므로 (ReplayBoard의 `snapshot.events`로만 표시), 향후 EventLog 컴포넌트 구현 시 CC 이벤트를 색상 구분하여 표시할 수 있다.

당장은 엔진 로그(`CombatLog[]`)와 `TickSnapshot.events`에 기록되는 것만으로도 리플레이 분석이 가능하다.

---

## 3. 스코프 경계

### 포함 (In Scope)
- `CombatLog` 타입에 `status_apply` / `status_expire` 추가
- `CombatLog`에 `statusType` 필드 추가
- `combatLoop.ts`에서 상태이상 적용/해제 시 로그 생성
- `tickStatusEffects()`에서 만료 시 로그 생성

### 제외 (Out of Scope)
- EventLog UI 컴포넌트 신규 개발 (별도 feature)
- 전투 로그 필터링 (상태이상만 보기 등)
- CC 통계 집계 (총 CC 시간, CC 체인 분석 등)
- ReplayBoard에서 CC 로그 인라인 표시

---

## 4. 구현 순서

1. `src/types/index.ts` — `CombatLog` 타입 확장 (`status_apply`, `status_expire`, `statusType`)
2. `src/lib/simulator/engine/combatLoop.ts` — `tickStatusEffects()`에 만료 로그 추가
3. `src/lib/simulator/engine/combatLoop.ts` — 각 `statusEffects.push()` 위치에 적용 로그 추가
4. `pnpm lint && pnpm typecheck && pnpm build` 검증

---

## 5. 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/types/index.ts` | `CombatLog.type`에 `status_apply` / `status_expire` 추가, `statusType` 필드 추가 |
| `src/lib/simulator/engine/combatLoop.ts` | 상태이상 적용/해제 시 CombatLog 생성 (약 6~8곳) |

---

## 6. 기술 고려사항

### 6.1 로그 볼륨
- 상태이상 적용/해제는 tick 단위로 빈번하게 발생할 수 있음
- burn DoT는 매 틱마다 로그를 생성하지 **않음** — 적용/해제 시점만 기록
- shield 만료도 마찬가지로 적용/해제만 기록

### 6.2 tickStatusEffects 리팩터링
- 현재 `tickStatusEffects()`는 unit만 받지만, 로그를 생성하려면 `logs`, `tickLogs`, `tick`, `time` 파라미터가 추가로 필요
- 시그니처를 확장하거나, 만료된 효과를 반환값으로 돌려 호출자에서 로그 생성

### 6.3 기존 UI 호환성
- `CombatLog.type`에 새 값이 추가되므로, 기존에 `type`으로 분기하는 코드가 있다면 확인 필요
- `ReplayBoard`는 `snapshot.events`에서 `attack`/`ability`만 사용하므로 영향 없음

### 6.4 메시지 포맷
- 한글 레이블은 `statusEffectConfig.ts`의 `label` 필드를 재사용
- 예: "가렌이(가) 다리우스에게 기절 적용 (2.0초)"
- 예: "다리우스의 기절 해제"
