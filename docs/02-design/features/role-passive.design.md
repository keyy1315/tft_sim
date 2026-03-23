# Design: 역할군 패시브 능력 구현

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 역할군 패시브 능력 구현 |
| Plan 참조 | `docs/01-plan/features/role-passive.plan.md` |
| 작성일 | 2026-03-23 |
| 상태 | Design |

---

## 1. 암살자 후열 점프

### 1.1 시점

`simulateCombat()` 내에서 메인 루프 진입 전, Warden 보호막/프렐요드 포탑 소환 이후.

```typescript
// combatLoop.ts — 기존 순서:
// 1. CombatUnit 생성
// 2. Trait 옴니뱀프/보호막 적용
// 3. Freljord 포탑 소환
// 4. ← 여기에 암살자 점프 삽입
// 5. 메인 전투 루프 시작
```

### 1.2 점프 목표 결정 알고리즘

```typescript
function applyAssassinJump(
  teamUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  allUnits: CombatUnit[],
  logs: CombatLog[],
): void
```

**각 암살자 유닛에 대해:**

1. 적 팀에서 가장 먼 유닛(현재 암살자 위치 기준 `hexDistance` 최대) 찾기
   - 동거리 시 Marksman/Caster 우선 (딜러/마법사를 노리는 것이 암살자의 본질)
2. 해당 유닛의 인접 빈 칸(`getNeighbors()`) 중 하나 선택
   - 빈 칸 판별: `allUnits`의 현재 위치를 `occupiedPositions` Set으로 관리
   - 여러 빈 칸 중 적 딜러에 가장 가까운 칸 선택
3. 빈 칸이 없으면 점프하지 않음 (로그도 남기지 않음)
4. 점프 시 위치 업데이트: `unit.position = targetHex`
5. 전투 로그: `[역할군] {챔피언}이(가) 적 후열로 점프!`

### 1.3 호출 위치

```typescript
// combatLoop.ts — applyWardenShields 이후, 메인 루프 전
applyWardenShields(playerActiveTraits, playerUnits);
applyWardenShields(enemyActiveTraits, enemies);

const allUnits = [...playerUnits, ...enemies];

// Freljord 포탑 소환
// ...

// 암살자 후열 점프 (포탑 소환 후, 점유 위치가 확정된 시점)
applyAssassinJump(playerUnits, enemies, allUnits, logs);
applyAssassinJump(enemies, playerUnits, allUnits, logs);
```

---

## 2. 비타겟 피해 감소 (Fighter/Assassin 15%)

### 2.1 로직

피해를 받는 유닛이 Fighter 또는 Assassin이고, 피해를 입히는 적이 자신의 현재 `target`이 아닌 경우 → 받는 피해 15% 감소.

```typescript
const NON_TARGET_DAMAGE_REDUCTION = 0.15;

// damageReduction 적용 직후에 추가
if ((target.role === 'Fighter' || target.role === 'Assassin') && target.target !== unit.id) {
  finalDamage *= (1 - NON_TARGET_DAMAGE_REDUCTION);
}
```

### 2.2 적용 위치 (2곳)

**일반 공격 데미지** — `combatLoop.ts` line ~842 (damageReduction 이후)

```typescript
// Apply target's damage reduction from augments
if (target.damageReduction > 0) {
  finalDamage *= (1 - target.damageReduction);
}

// Fighter/Assassin 비타겟 피해 감소 15%
if ((target.role === 'Fighter' || target.role === 'Assassin') && target.target !== unit.id) {
  finalDamage *= (1 - NON_TARGET_DAMAGE_REDUCTION);
}
```

**어빌리티 데미지** — `combatLoop.ts` line ~949 (damageReduction 이후)

```typescript
if (t.damageReduction > 0) {
  effectiveDmg *= (1 - t.damageReduction);
}

// Fighter/Assassin 비타겟 피해 감소 15%
if ((t.role === 'Fighter' || t.role === 'Assassin') && t.target !== unit.id) {
  effectiveDmg *= (1 - NON_TARGET_DAMAGE_REDUCTION);
}
```

### 2.3 주의사항

- `target.target`은 피해를 받는 유닛의 현재 공격 대상 ID
- `unit.id`는 피해를 입히는 유닛의 ID
- `target.target !== unit.id` → "나를 타겟하지 않은 적에게 받는 피해" 감소
- 전투 시작 전(target이 null인 경우)에는 모든 피해에 감소 적용 (null !== unit.id = true)
  → 이건 의도적. 전투 초반 암살자가 점프한 직후 아직 타겟을 잡지 않은 상태에서 보호

---

## 3. 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/simulator/engine/combatLoop.ts` | `applyAssassinJump()` 함수 추가, 비타겟 피해 감소 로직 2곳 추가, 상수 `NON_TARGET_DAMAGE_REDUCTION` 추가 |

### 변경하지 않는 것

- `targeting.ts`: 가중치는 이미 수정 완료
- `movement.ts`: `getNeighbors()`, `coordKey()` 이미 존재, 추가 불필요
- `unit.ts`: 추가 필드 불필요
- `mana.ts`: 이미 정상

---

## 4. 구현 순서

| Step | 내용 |
|------|------|
| 1 | `NON_TARGET_DAMAGE_REDUCTION` 상수 추가 |
| 2 | `applyAssassinJump()` 함수 구현 |
| 3 | `simulateCombat()` 내 암살자 점프 호출 추가 |
| 4 | 일반 공격 데미지 계산부에 비타겟 피해 감소 추가 |
| 5 | 어빌리티 데미지 계산부에 비타겟 피해 감소 추가 |
| 6 | `pnpm lint && pnpm typecheck && pnpm build` 통과 확인 |

---

## 5. 수용 기준

1. 암살자가 전투 시작 시 적 후열 빈 칸으로 이동, 로그에 `[역할군]` 점프 이벤트 기록
2. Fighter/Assassin이 비타겟에게 받는 피해 15% 감소 (일반 공격 + 어빌리티 모두)
3. 기존 타겟팅·마나·옴니뱀프 동작에 영향 없음
4. 결정론적 — 동일 시드에서 동일 결과
5. 빌드 통과
