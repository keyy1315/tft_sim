# Design: 중재자 시너지 법률 시스템

> Plan 참조: `docs/01-plan/features/arbiter-law.plan.md`

---

## 1. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | `ArbiterLaw` 타입 정의 | `src/types/index.ts` |
| 2 | `SimulateOptions`에 arbiterLaw 추가 | `src/lib/simulator/engine/combatLoop.ts` |
| 3 | `ArbiterLawPanel` 선택 UI | `src/components/builder/ArbiterLawPanel.tsx` (신규) |
| 4 | `useTeamManagement`에 state 연결 | `src/hooks/useTeamManagement.ts` |
| 5 | `SynergyPanel`에 중재자 법률 패널 렌더링 | `src/components/builder/SynergyPanel.tsx` |
| 6 | `simulator/page.tsx`에서 법률 전달 | `src/app/simulator/page.tsx` |
| 7 | `combatLoop`에 trigger/effect 적용 | `src/lib/simulator/engine/combatLoop.ts` |
| 8 | lint/typecheck/build | - |

---

## 2. 타입 정의

### 2.1 ArbiterLaw (src/types/index.ts)

```ts
export interface ArbiterLaw {
  triggerId: string;  // 'on_deal_10_hits' | 'every_4_seconds' | ...
  effectId: string;   // 'mana' | 'ap' | 'armor_mr' | ...
}
```

### 2.2 SimulateOptions 확장

```ts
export interface SimulateOptions {
  // ... 기존 필드 ...
  playerArbiterLaw?: ArbiterLaw;
  enemyArbiterLaw?: ArbiterLaw;
}
```

---

## 3. ArbiterLawPanel 컴포넌트

### 3.1 Props

```ts
interface ArbiterLawPanelProps {
  law: ArbiterLaw | null;
  onChange: (law: ArbiterLaw) => void;
  tier: 'silver' | 'gold';
}
```

### 3.2 렌더링

아이오니아 경로 선택과 동일한 패턴 — `<select>` 2개:

```
┌─────────────────────────────────────┐
│ 법률 원인: [중재자가 피해를 10번 ▼] │
│ 법률 결과: [주문력 8 획득        ▼] │
│ ⚖ 주문력 +8 (silver) / +12 (gold)  │
└───────────────��─────────────────────┘
```

1. **trigger 선택**: `arbiter_laws.json`의 `triggers` 배열에서 옵션 생성
2. **effect 선택**: 선택된 trigger의 `laws[triggerId]` 배열에서 옵션 생성
3. **수치 미리보기**: 선택된 effect의 `silver`/`gold` 수치 표시
4. MVP 제외 trigger (`combat_start_per_interest`, `combat_start_if_refreshed`)는 `(추후)` 라벨 + disabled

### 3.3 JSON 로드

`arbiter_laws.json`을 컴포넌트 내에서 fetch:

```ts
const [lawData, setLawData] = useState<ArbiterLawData | null>(null);
useEffect(() => {
  fetch('/data/arbiter_laws.json').then(r => r.json()).then(setLawData);
}, []);
```

---

## 4. useTeamManagement 변경

### 4.1 State 추가

```ts
const [playerArbiterLaw, setPlayerArbiterLaw] = useState<ArbiterLaw | null>(null);
const [enemyArbiterLaw, setEnemyArbiterLaw] = useState<ArbiterLaw | null>(null);
```

### 4.2 시너지 해제 시 자동 초기화

`playerTraits`/`enemyTraits` 변경 감지:

```ts
// 중재자 시너지 비활성화 시 법률 초기화
const playerArbiterActive = playerTraits.some(
  t => t.trait.apiName === 'TFT17_Arbiter' && t.activeEffect
);
if (!playerArbiterActive && playerArbiterLaw) setPlayerArbiterLaw(null);
```

React Compiler 규칙 준수를 위해 useEffect가 아닌 파생 값으로 처리:
- `playerArbiterActive`는 파생값
- 비활성 시 `playerArbiterLaw`를 무시 (null로 설정하지 않고, 전달 시 null 처리)

### 4.3 반환값 추가

```ts
return {
  // ... 기존 ...
  playerArbiterLaw,
  setPlayerArbiterLaw,
  enemyArbiterLaw,
  setEnemyArbiterLaw,
};
```

---

## 5. SynergyPanel 연결

아이오니아 패턴과 동일하게 SynergyPanel props에 추가:

```tsx
// SynergyPanelProps
arbiterLaw?: ArbiterLaw | null;
onArbiterLawChange?: (law: ArbiterLaw) => void;

// 렌더링 (중재자 시너지 항목 하단)
{isActive && at.trait.apiName === 'TFT17_Arbiter' && onArbiterLawChange && (
  <ArbiterLawPanel
    law={arbiterLaw ?? null}
    onChange={onArbiterLawChange}
    tier={at.style >= 3 ? 'gold' : 'silver'}
  />
)}
```

---

## 6. combatLoop 전투 적용

### 6.1 법률 데이터 로드

`combatLoop.ts`에서 `arbiter_laws.json`을 직접 로드하지 않고, `SimulateOptions`로 받은 `ArbiterLaw` (triggerId+effectId)만으로 처리.

법률 수치는 `arbiter_laws.json`을 빌드 타임에 임포트하거나, 전투 시작 시 options에 resolved value를 전달.

**접근: options에 resolved value 전달**

```ts
// simulator/page.tsx에서 전투 시작 시
const resolvedLaw = resolveLawValues(law, arbiterLawData, tier);
// → { triggerId, effectId, value, triggerType, triggerThreshold, ... }
```

### 6.2 ArbiterLawRuntime 인터페이스

```ts
interface ArbiterLawRuntime {
  triggerId: string;
  triggerType: string;       // 'on_hit_count' | 'periodic' | ...
  triggerThreshold?: number; // 10, 3, 50 등
  intervalSeconds?: number;  // periodic용
  hpPercent?: number;        // on_hp_threshold용
  effectId: string;
  value: number;             // resolved silver/gold 수치
}
```

### 6.3 Trigger 처리 (combatLoop 내부)

```ts
function checkArbiterTrigger(
  runtime: ArbiterLawRuntime,
  state: ArbiterTriggerState,
  tick: number,
  // ... context params
): boolean {
  switch (runtime.triggerType) {
    case 'on_hit_count':
      return state.hitCount >= (runtime.triggerThreshold ?? 10);
    case 'on_attack_count':
      return state.attackCount >= (runtime.triggerThreshold ?? 3);
    case 'periodic':
      return tick > 0 && tick % ((runtime.intervalSeconds ?? 4) * TICKS_PER_SECOND) === 0;
    case 'on_enemy_death':
      return state.enemyDiedThisTick;
    case 'on_hp_threshold':
      // 각 유닛별 1회 체크 → 별도 처리
      return false;
    case 'on_mana_spent':
      return state.manaSpent >= (runtime.triggerThreshold ?? 50);
    case 'combat_start_per_star':
      return tick === 0;
    default:
      return false;
  }
}
```

### 6.4 Effect 적용

```ts
function applyArbiterEffect(
  effectId: string,
  value: number,
  arbiterUnits: CombatUnit[],
  tick: number,
  logs: CombatLog[],
) {
  for (const unit of arbiterUnits) {
    if (unit.state === 'dead') continue;
    switch (effectId) {
      case 'mana':
        unit.currentMana = Math.min(unit.maxMana, unit.currentMana + value);
        break;
      case 'ap':
        unit.stats.ap += value;
        break;
      case 'armor_mr':
        unit.stats.armor += value;
        unit.stats.magicResist += value;
        break;
      case 'attack_speed':
        unit.stats.attackSpeed *= (1 + value / 100);
        break;
      case 'permanent_hp':
        unit.maxHp += value;
        unit.currentHp += value;
        break;
      case 'shield':
        unit.shield += unit.maxHp * value / 100;
        // 4초 후 제거 → statusEffect로 관리
        break;
    }
  }
}
```

### 6.5 Trigger State 관리

```ts
interface ArbiterTriggerState {
  hitCount: number;        // on_hit_count: 전체 히트 카운터
  attackCount: number;     // on_attack_count: 기본공격 카운터
  manaSpent: number;       // on_mana_spent: 마나 소모 누적
  enemyDiedThisTick: boolean;
  hpTriggered: Set<string>; // on_hp_threshold: 유닛별 1회 발동 추적
}
```

`on_hit_count`와 `on_attack_count`는 threshold 도달 시 카운터 리셋.
`on_mana_spent`는 50 도달 시 리셋.

### 6.6 combat_start_per_star 처리

전투 시작 시 1회:
```ts
if (runtime.triggerType === 'combat_start_per_star') {
  const totalStars = arbiterUnits.reduce((sum, u) => sum + u.starLevel, 0);
  applyArbiterEffect(runtime.effectId, runtime.value * totalStars, arbiterUnits, 0, logs);
}
```

### 6.7 중재자 유닛 식별

```ts
const arbiterUnits = teamUnits.filter(u =>
  u.champion.traits.includes('중재자')
);
```

---

## 7. simulator/page.tsx 연결

전투 시작 시 `SimulateOptions`에 법률 전달:

```ts
const result = simulateCombat(playerTeam, enemyTeam, {
  // ... 기존 옵션 ...
  playerArbiterLaw: tm.playerArbiterLaw ?? undefined,
  enemyArbiterLaw: tm.enemyArbiterLaw ?? undefined,
});
```

---

## 8. 전투 로그

법률 발동 시 로그 기록:

```ts
logs.push({
  tick, time,
  type: 'ability',
  sourceId: 'arbiter-law',
  message: `중재자 법률 발동: ${triggerName} → ${effectName} +${value}`,
});
```

---

## 9. 에러/엣지 케이스

| 케이스 | 처리 |
|--------|------|
| 법률 미선택 상태로 전투 시작 | 법률 적용 안 �� |
| 중재자 유닛 전원 사망 | 발동 중단 |
| 2→3 중재자 승급 (전투 중 불가) | 편집 탭에서만 가능, 전투 시작 시 tier 확정 |
| shield effect | 4초 타이머 → statusEffect로 관리 |
| 전투 외 효과 (reroll/gold/leona) | 전투 결과에 텍스트로만 표시 |
