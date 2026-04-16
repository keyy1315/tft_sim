# Plan: 전투 타이밍 개선 — Cast Time + 전투 시작 딜레이

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 전투 타이밍 개선 |
| 작성일 | 2026-03-23 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 스킬 시전 시간(cast time)이 0틱이라 스킬을 쓰자마자 즉시 다음 공격을 하고, 전투 시작 시 모든 유닛이 0틱에 동시 공격 시작. 실제 게임보다 전투가 훨씬 빠르게 진행됨 |
| **Solution** | 스킬 시전 후 cast time 동안 행동 불가 + 전투 시작 시 첫 공격까지 짧은 딜레이 추가 + initialMana 적용 검증 |
| **Function UX Effect** | 챔피언이 스킬 시전 후 잠시 멈추고, 전투 시작 시 약간의 준비 시간 후 공격 시작. 리플레이 체감이 실제 게임과 유사해짐 |
| **Core Value** | 전투 페이스가 실제 게임에 근접하여 시뮬레이션 결과의 신뢰도 향상 |

---

## 1. 현재 문제 분석

### 1.1 Cast Time 없음

```typescript
// combatLoop.ts line 1165-1167
if (unit.currentMana >= unit.maxMana) {
  unit.currentMana = 0;
  unit.state = 'casting'; // ← 설정만 하고 아무 효과 없음
  // 스킬 데미지 즉시 적용, 같은 틱에서 다시 공격 가능
}
```

- `canAct()`와 `canAutoAttack()`은 `'stun'`만 체크하고 `'casting'`은 무시
- 결과: 마나 차면 → 스킬 즉발 → 같은 틱에 다시 공격 → 마나 다시 참
- 실제 게임: 스킬 시전 후 약 0.5~1초 동안 공격 불가

### 1.2 전투 시작 즉시 공격

- 모든 유닛의 `attackCooldown`이 0으로 시작
- 0틱에 모든 유닛이 동시에 첫 공격 시작
- 실제 게임: 전투 시작 후 이동 → 사거리 도달 → 첫 공격까지 자연스러운 딜레이

### 1.3 initialMana 미적용 확인

```typescript
// createCombatUnit() line 75
currentMana: stats.mana, // stats.mana = champion.stats.initialMana
maxMana: stats.maxMana,  // stats.maxMana = champion.stats.mana
```

`calculateStats`에서 `mana`와 `maxMana`가 어떻게 매핑되는지 확인 필요.

---

## 2. 수정 계획

### 2.1 Cast Time 구현 (가장 큰 체감 개선)

**방법**: 스킬 시전 시 `attackCooldown`을 cast time 틱 수만큼 설정

```typescript
const CAST_TICKS = Math.round(0.5 * TICKS_PER_SECOND); // 15틱 = 0.5초

if (unit.currentMana >= unit.maxMana) {
  unit.currentMana = 0;
  unit.state = 'casting';
  unit.attackCooldown = CAST_TICKS; // 0.5초 동안 공격 불가
  // ... 스킬 효과 적용 ...
}
```

- 일괄 0.5초 적용 (실제 게임의 평균 cast time)
- `self_buff` 패턴은 cast time 0.25초 (짧은 자기 버프)
- 채널링 스킬은 별도 처리 (후순위)

### 2.2 전투 시작 첫 공격 딜레이

**방법**: `createCombatUnit()`에서 `attackCooldown`을 랜덤 초기값으로 설정

```typescript
// 전투 시작 시 0~0.3초 랜덤 딜레이 (자연스러운 시작)
attackCooldown: Math.round(rng.next() * 0.3 * TICKS_PER_SECOND),
```

- 모든 유닛이 동시에 공격하는 부자연스러움 해소
- 결정론적 (시드 기반 rng 사용)

### 2.3 initialMana 검증

현재 `calculateStats()`에서 `initialMana`가 올바르게 적용되는지 확인하고, 문제가 있으면 수정.

---

## 3. 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/simulator/engine/combatLoop.ts` | cast time 상수 추가, 스킬 시전 후 attackCooldown 설정, 전투 시작 딜레이 |
| `src/lib/simulator/models/constants.ts` | `CAST_TICKS` 상수 (필요 시) |

### 변경하지 않는 것

- `ability.ts`: AbilityConfig에 개별 castTime 필드는 추가하지 않음 (데이터 없으므로)
- `mana.ts`: 마나 공식은 현재 유지
- 공격 속도 공식: 현재 유지 (JSON 데이터 기반)

---

## 4. 수용 기준

1. 스킬 시전 후 0.5초 동안 공격 불가 (공격 쿨다운 리셋)
2. 전투 시작 시 유닛마다 0~0.3초 랜덤 첫 공격 딜레이
3. initialMana가 정확히 적용되어, 시작 마나가 있는 챔피언은 더 빨리 스킬 사용
4. 기존 테스트 흐름에 영향 없음 (결정론적 유지)
5. `pnpm lint && pnpm typecheck && pnpm build` 통과
