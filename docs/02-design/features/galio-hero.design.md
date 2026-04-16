# Design: 갈리오 영웅 시너지 — 조건부 소환 + 스킬 구현

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 갈리오 영웅 시너지 |
| Plan 참조 | `docs/01-plan/features/galio-hero.plan.md` |
| 작성일 | 2026-03-23 |
| 상태 | Design |

---

## 1. 소환 조건

### 1.1 데마시아 결집 메커닉

데마시아 시너지 `desc`: "아군이 최대 체력의 25%만큼 체력을 잃을 때마다 데마시아가 결집"

**소환 트리거**: 아군 팀 전체 HP 손실이 총 최대 HP의 25% 이상일 때 갈리오 소환 (`MaxHealthLost: 0.25`)

→ 아타칸과 동일 패턴: 매초 HP 비율 체크

### 1.2 소환 조건 확인

```typescript
function trySpawnGalio(
  activeTraits: ActiveTrait[],
  team: 'player' | 'enemy',
  teamUnits: CombatUnit[],
  allUnits: CombatUnit[],
  galioChampion: RawChampion | null,  // 대기석 갈리오 정보
  tick: number,
  time: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  spawnedFlag: { spawned: boolean },
): CombatUnit | null
```

**조건 체크 순서:**
1. `spawnedFlag.spawned === true` → return null
2. 데마시아 시너지 활성화 확인 (`TFT16_Demacia` + `activeEffect`)
3. `galioChampion`이 null → return null (대기석에 갈리오 없음)
4. 아군 팀 HP 손실 비율 >= `MaxHealthLost` (0.25) → 소환 트리거

---

## 2. 갈리오 CombatUnit 생성

### 2.1 스탯

갈리오 JSON 데이터 기준 (기본 2성 스탯 적용):

```typescript
const galioStats = {
  hp: 1100 * 1.8,          // 2성 = 1980
  armor: 55,
  magicResist: 55,
  damage: 50 * 1.8,        // 2성 = 90
  attackSpeed: 0.9,
  critChance: 0.25,
  critMultiplier: 1.4,
  ap: 0,
  mana: 90,                // initialMana
  maxMana: 140,
  range: 1,
  armorPen: 0,
  magicPen: 0,
};
```

→ 실제로는 `galioChampion` 데이터와 `starLevel`로 `calculateStats()` 호출.

### 2.2 소환 위치

적 무리(가장 밀집한 곳)의 중심 근처 빈 칸에 착지.

```typescript
// 가장 적이 많이 몰린 위치 찾기
const enemyPositions = opposingUnits.filter(u => u.state !== 'dead').map(u => u.position);
// 적 위치 중심(평균) 근처 빈 칸 선택
```

→ 간소화: 적 팀 전방 빈 칸에 소환 (아타칸과 동일 패턴)

### 2.3 착지 효과

소환 직후 즉시 적용:

```typescript
// 착지 충격파 — 영웅 시너지 variables에서 읽음
const heroTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Heroic');
const hexRadius = heroTrait?.activeEffect?.variables['HexRadius'] ?? 3;
const percentMaxHP = heroTrait?.activeEffect?.variables['PercentMaxHP'] ?? 0.10;
const knockupDuration = heroTrait?.activeEffect?.variables['KnockupDuration'] ?? 1;

// 착지 위치 기준 hexRadius칸 내 적
const impactTargets = getHexesInRadius(spawnPos, hexRadius);
for (const enemy of nearbyEnemies) {
  // 적 최대 체력 10% 마법 피해
  const dmg = applyResistance(enemy.maxHp * percentMaxHP, enemy.stats.magicResist);
  enemy.currentHp -= dmg;
  // 기절 (중심 거리에 따라 감소)
  const dist = hexDistance(spawnPos, enemy.position);
  const stunDuration = knockupDuration * Math.max(0.5, 1 - dist * 0.15);
  const stunTicks = Math.round(stunDuration * TICKS_PER_SECOND);
  enemy.statusEffects.push({ type: 'stun', sourceId: galioId, remainingTicks: stunTicks });
}
```

---

## 3. SimulateOptions 확장

```typescript
export interface SimulateOptions {
  // ... 기존 ...
  /** 대기석 갈리오 정보 (데마시아 결집 시 소환) */
  playerGalio?: { champion: RawChampion; starLevel: number } | null;
  enemyGalio?: { champion: RawChampion; starLevel: number } | null;
}
```

---

## 4. UI — 갈리오 대기석 토글

### 4.1 useTeamManagement 확장

```typescript
const [playerGalio, setPlayerGalio] = useState<{ champion: RawChampion; starLevel: number } | null>(null);
const [enemyGalio, setEnemyGalio] = useState<{ champion: RawChampion; starLevel: number } | null>(null);
```

### 4.2 SynergyPanel 또는 별도 UI

데마시아 시너지 활성 시, 갈리오 토글 버튼 표시:
- "갈리오 대기석 배치" 체크박스
- 체크 시 갈리오 이미지 + 별레벨 선택 (기본 2성)

### 4.3 page.tsx — simulateCombat 전달

```typescript
playerGalio: tm.playerGalio ?? undefined,
enemyGalio: tm.enemyGalio ?? undefined,
```

---

## 5. 갈리오 AbilityConfig

```typescript
TFT16_Galio: {
  pattern: 'aoe_circle',
  radius: 2,
  dash: 'to_farthest',
  stun: 1.0,
},
```

소환 후 일반 유닛으로 전투 참여. 마나가 차면 스킬 사용 (돌진 + 범위 피해 + 아군 보호막).

---

## 6. 구현 순서

| Step | 내용 | 파일 |
|------|------|------|
| 1 | `SimulateOptions`에 `playerGalio`/`enemyGalio` 추가 | `combatLoop.ts` |
| 2 | `trySpawnGalio()` 함수 구현 (아타칸 패턴 참고) | `combatLoop.ts` |
| 3 | 착지 충격파 (범위 피해 + CC) | `combatLoop.ts` |
| 4 | `simulateCombat()` 내 매초 소환 체크 호출 | `combatLoop.ts` |
| 5 | 갈리오 `AbilityConfig` 매핑 | `ability.ts` |
| 6 | `useTeamManagement`에 갈리오 대기석 상태 | `useTeamManagement.ts` |
| 7 | `SynergyPanel`에 갈리오 토글 UI | `SynergyPanel.tsx` |
| 8 | `page.tsx`에 갈리오 정보 전달 | `page.tsx` |
| 9 | 빌드 검증 | — |

---

## 7. 수용 기준

1. 데마시아 시너지 활성 + 갈리오 대기석 배치 시, 아군 HP 25% 손실 후 갈리오 소환
2. 착지 시 3칸 범위 적에게 최대 체력 10% 마법 피해 + 거리 비례 기절
3. 소환 후 일반 유닛으로 전투 참여 (공격, 스킬 사용)
4. 전투 로그에 `갈리오 소환!` + 착지 피해 기록
5. UI에서 갈리오 대기석 토글 가능
6. 갈리오 없이 데마시아 시너지만 있으면 소환 안 됨
7. `pnpm lint && pnpm typecheck && pnpm build` 통과
