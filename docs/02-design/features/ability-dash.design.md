# Design: 이동형 스킬 (대쉬/도약) 구현

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 이동형 스킬 (대쉬/도약) |
| Plan 참조 | `docs/01-plan/features/ability-dash.plan.md` |
| 작성일 | 2026-03-23 |
| 상태 | Design |

---

## 1. AbilityConfig 확장

### 1.1 dash 필드 추가

```typescript
// src/lib/simulator/systems/ability.ts
export interface AbilityConfig {
  pattern: AbilityPattern;
  radius?: number;
  maxTargets?: number;
  damageDecay?: number;
  /** 스킬 시전 시 이동 유형 */
  dash?: 'to_target' | 'to_farthest' | 'to_lowest_hp' | 'to_backline';
}
```

### 1.2 챔피언 매핑 업데이트

```typescript
// 기존 매핑 수정 + dash 추가 + 미매핑 챔피언 추가
TFT16_Briar:       { pattern: 'aoe_circle', radius: 1, dash: 'to_farthest' },
TFT16_RekSai:      { pattern: 'cone', radius: 1, dash: 'to_farthest' },
TFT16_Nidalee:     { pattern: 'aoe_circle', radius: 1, dash: 'to_lowest_hp' },
TFT16_Renekton:    { pattern: 'line', maxTargets: 3, dash: 'to_lowest_hp' },
TFT16_Fizz:        { pattern: 'aoe_circle', radius: 1, dash: 'to_backline' },
TFT16_Neeko:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
TFT16_Kindred:     { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
TFT16_Fiddlesticks:{ pattern: 'aoe_circle', radius: 2, dash: 'to_farthest' },
TFT16_Yasuo:       { pattern: 'aoe_circle', radius: 1, dash: 'to_target' },
TFT16_Gwen:        { pattern: 'cone', radius: 2, dash: 'to_target' },
TFT16_Ambessa:     { pattern: 'line', dash: 'to_target' },
TFT16_Zaahen:      { pattern: 'aoe_circle', radius: 1, dash: 'to_target' },
TFT16_Qiyana:      { pattern: 'line', maxTargets: 3, dash: 'to_target' },
TFT16_Sylas:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
TFT16_Shyvana:     { pattern: 'aoe_circle', radius: 3, dash: 'to_farthest' },
```

---

## 2. 대쉬 이동 함수

### 2.1 함수 설계

`combatLoop.ts`에 추가:

```typescript
/** 스킬 시전 시 대쉬 이동 — 대상 인접 빈 칸으로 이동 */
function applyAbilityDash(
  unit: CombatUnit,
  dashType: 'to_target' | 'to_farthest' | 'to_lowest_hp' | 'to_backline',
  currentTarget: CombatUnit,
  enemyTeam: CombatUnit[],
  occupiedPositions: Set<string>,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  tick: number,
  time: number,
  rng: SeededRNG,
): CombatUnit {
  // 1. 대쉬 대상 결정
  const aliveEnemies = enemyTeam.filter(e => e.state !== 'dead');
  let dashTarget: CombatUnit;

  switch (dashType) {
    case 'to_target':
      dashTarget = currentTarget;
      break;
    case 'to_farthest':
      dashTarget = findFarthestEnemy(unit, aliveEnemies);
      break;
    case 'to_lowest_hp':
      dashTarget = findLowestHpEnemy(aliveEnemies);
      break;
    case 'to_backline':
      dashTarget = findBacklineEnemy(unit, aliveEnemies);
      break;
  }

  // 2. 대상 인접 빈 칸 탐색
  const neighbors = getNeighbors(dashTarget.position);
  const freeNeighbors = neighbors.filter(n => !occupiedPositions.has(coordKey(n)));
  if (freeNeighbors.length === 0) return dashTarget; // 이동 불가

  // 3. 가장 가까운 빈 칸 선택
  let bestHex = freeNeighbors[0];
  let bestDist = Infinity;
  for (const hex of freeNeighbors) {
    const dist = hexDistance(hex, dashTarget.position);
    if (dist < bestDist) { bestDist = dist; bestHex = hex; }
  }

  // 4. 위치 업데이트
  occupiedPositions.delete(coordKey(unit.position));
  unit.position = bestHex;
  occupiedPositions.add(coordKey(bestHex));

  // 5. 로그
  pushInventionLog(logs, tickLogs, tick, time, unit.id,
    `${unit.champion.name}이(가) ${dashTarget.champion.name}에게 돌진!`);

  // 6. 타겟 변경 — 대쉬 대상을 새 타겟으로
  unit.target = dashTarget.id;
  return dashTarget;
}
```

### 2.2 대쉬 대상 헬퍼 함수

```typescript
function findFarthestEnemy(unit: CombatUnit, enemies: CombatUnit[]): CombatUnit {
  let farthest = enemies[0];
  let maxDist = 0;
  for (const e of enemies) {
    const d = hexDistance(unit.position, e.position);
    if (d > maxDist) { maxDist = d; farthest = e; }
  }
  return farthest;
}

function findLowestHpEnemy(enemies: CombatUnit[]): CombatUnit {
  let lowest = enemies[0];
  for (const e of enemies) {
    if (e.currentHp < lowest.currentHp) lowest = e;
  }
  return lowest;
}

function findBacklineEnemy(unit: CombatUnit, enemies: CombatUnit[]): CombatUnit {
  // 탱커/전사 아닌 적 중 가장 먼 적
  const backline = enemies.filter(e => e.role !== 'Tank' && e.role !== 'Fighter');
  if (backline.length === 0) return findFarthestEnemy(unit, enemies);
  return findFarthestEnemy(unit, backline);
}
```

---

## 3. combatLoop.ts 어빌리티 시전부 수정

### 3.1 삽입 위치

현재 어빌리티 시전 흐름:

```
1. unit.currentMana >= unit.maxMana → 마나 리셋
2. getAbilityDamage() → 데미지 계산
3. config = CHAMPION_ABILITY_PATTERNS[apiName]
4. findAbilityTargets(unit, target, ...) → 타겟 목록  ← 여기 전에 대쉬!
5. 데미지 적용 루프
```

**대쉬는 4번 전에 삽입**:

```typescript
const config: AbilityConfig = CHAMPION_ABILITY_PATTERNS[unit.champion.apiName] ?? { pattern: 'single' };
const opposingTeam = unit.team === 'player' ? enemies : playerUnits;

// 대쉬 이동 (config.dash가 있으면)
let abilityTarget = target;
if (config.dash) {
  abilityTarget = applyAbilityDash(
    unit, config.dash, target, opposingTeam,
    occupiedPositions, logs, tickLogs, tick, time, rng
  );
}

// 이동한 새 위치 기준으로 타겟 탐색
const abilityTargets = findAbilityTargets(unit, abilityTarget, opposingTeam, config);
```

### 3.2 occupiedPositions 접근

현재 `occupiedPositions`는 메인 루프 내에서 매 틱 `allUnits`로부터 재생성됨 (line ~867).
어빌리티 시전부에서 이 Set을 참조 가능.

---

## 4. 구현 순서

| Step | 내용 | 파일 |
|------|------|------|
| 1 | `AbilityConfig`에 `dash` 필드 추가 | `ability.ts` |
| 2 | 15개 챔피언 매핑 업데이트 (기존 수정 + 미매핑 추가) | `ability.ts` |
| 3 | 대쉬 헬퍼 함수 3개 추가 (findFarthestEnemy, findLowestHpEnemy, findBacklineEnemy) | `combatLoop.ts` |
| 4 | `applyAbilityDash()` 함수 추가 | `combatLoop.ts` |
| 5 | 어빌리티 시전부에 대쉬 호출 삽입 (findAbilityTargets 전) | `combatLoop.ts` |
| 6 | 빌드 검증 | — |

---

## 5. 수용 기준

1. `dash` 속성이 있는 챔피언이 스킬 시전 시 대상 인접 칸으로 이동
2. 이동 후 새 위치 기준으로 AOE/Cone/Line 데미지 대상 결정
3. 대쉬 시 전투 로그 기록
4. 빈 칸이 없으면 이동 없이 스킬 사용
5. 결정론적 — 동일 시드에서 동일 결과
6. `pnpm lint && pnpm typecheck && pnpm build` 통과
