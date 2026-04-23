# item-effect-engine Design Document

> **Summary**: 이벤트 기반 아이템 효과 엔진 — EventBus 확장 + StatPatch/Trigger primitive + 아이템별 registry
>
> **Project**: TFT Combat Simulator
> **Author**: Dayoung
> **Date**: 2026-04-20
> **Status**: Draft
> **Planning Doc**: [item-effect-engine.plan.md](../../01-plan/features/item-effect-engine.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **Backward compat 우선**: 기존 시뮬 Golden test가 변화 없이 통과해야 함. `resolveItemEffect`는 `StatPatch`로 1:1 치환 가능.
2. **최소 침투**: `combatLoop.ts`(90KB)를 건드리지 않고 아이템 로직은 `systems/items/` 서브모듈로 분리. combatLoop에는 이벤트 dispatch와 per-unit mod 주입 지점 한 곳씩만 추가.
3. **결정론 유지**: 모든 trigger/counter는 `rng.ts`의 seed RNG 경유. 직접 `Math.random()` 금지.
4. **점진 도입**: Phase 2(기존 포팅)까지는 엔진 재구조화만, Phase 3 이후 신규 효과. 각 Phase 독립 커밋.

### 1.2 Design Principles

- **"효과는 primitive 조합으로 표현"** — 새 아이템 추가 시 TypeScript 신규 클래스 말고 선언적 registry 엔트리만 작성
- **EventBus 재활용** — 이미 존재하는 10개 CombatEventType을 확장해서 쓰고, 새 채널은 꼭 필요한 것만 추가
- **augment.ts의 `PerUnitAugmentMod` 패턴 차용** — 증강이 이미 하고 있는 per-unit 누적 패턴을 아이템에도 적용

### 1.3 Non-Goals

- Augment/Trait 효과 리팩터링 (범위 밖)
- Graves Trait 상점 / Sona Command Mods 효과 구현 (별도 피처)
- CDragon 효과 키 자동 매핑 생성기

---

## 2. Current Architecture Analysis

### 2.1 기존 구조 (변경 없이 유지)

```
src/lib/simulator/
├── engine/
│   ├── combatLoop.ts         (90KB) — 전투 루프, emit 10종 이미 수행
│   ├── replayEngine.ts
│   └── rng.ts                (seed RNG, Math.random 래퍼)
├── events/
│   └── eventBus.ts           — on/off/emit/clear + priority 기반 handler
├── systems/
│   ├── stat.ts               — calculateStats, getItemEffects, resolveBilgewaterStatEffects
│   ├── item.ts               — getItemCategory, canEquipItem, resolveItemEffect
│   ├── augment.ts            (17KB) — PerUnitAugmentMod 패턴 (참고용)
│   ├── ability.ts, attack.ts, mana.ts, targeting.ts, trait.ts, movement.ts
└── models/
    └── constants.ts          — ITEM_EFFECT_KEYS (19 entries)
```

### 2.2 현재 아이템 효과 경로

```
items: RawItem[]
  → resolveItemEffect(item) / getItemEffects(items)   [stat.ts]
      → ITEM_EFFECT_KEYS 매핑 (19 키)
      → ItemEffect { ad, ap, as, hp, armor, ... }
  → calculateStats(champion, starLevel, items, ...)
      → 스탯 합산 → ChampionStats (전투 시작 시점 1회)
  → combatLoop 실행
      → emit events (on_attack 등) — 아무도 구독 안 함 ❌
```

**문제**: 아이템 효과는 **combat start 1회 스탯 합산**만. 전투 중 trigger/counter/interval 효과는 전혀 반영 안 됨.

---

## 3. New Architecture

### 3.1 데이터 흐름

```
items: RawItem[]
  │
  ├─ StatPatch primitive ────────────► calculateStats (기존 흐름 유지)
  │    (단순 스탯 +N 형태)
  │
  └─ ItemEffectDescriptor[] ─────────► ItemEffectRuntime (신규)
       (trigger/counter/interval)         │
                                          ├─ bus.on('on_attack', ...)
                                          ├─ bus.on('on_hit', ...)
                                          ├─ tick interval timer 등록
                                          └─ per-unit state (counters/stacks/timers)
                                                │
                                                ▼
                                          combatLoop emit
                                                ▼
                                          Action 실행
                                          (dealDamage / modifyStat / spawnProjectile)
```

### 3.2 모듈 구조 (신규)

```
src/lib/simulator/systems/items/
├── registry.ts               — apiName → ItemEffectDescriptor 선언적 매핑
├── runtime.ts                — ItemEffectRuntime (이벤트 구독 + per-unit 상태)
├── primitives/
│   ├── statPatch.ts          — 단순 스탯 버프 (기존 resolveItemEffect 대체)
│   ├── trigger.ts            — Trigger primitive (event + condition + action)
│   ├── counter.ts            — Counter primitive (everyNAttacks, onThreshold)
│   ├── timer.ts              — Interval timer primitive
│   └── action.ts             — Action primitives (dealDamage, modifyStat, 등)
└── definitions/
    ├── stacking.ts           — 구인수/거결/수은/죽검/드론/라바돈 (Phase 3)
    ├── psyops.ts             — PsyOps 12종 (Phase 4)
    └── anomaly.ts            — Anomaly role-based (Phase 5)
```

### 3.3 combatLoop.ts 변경점 (최소화)

| 위치 | 변경 |
|------|------|
| 전투 시작 부 (~L86) | `ItemEffectRuntime.install(units, bus)` 호출 1줄 추가 |
| tick 루프 시작 부 | `runtime.onTick(tick)` 호출 1줄 추가 (timer 발동용) |
| 전투 종료 부 | `runtime.dispose()` 호출 1줄 추가 |

**그 외 combatLoop.ts 기존 코드는 건드리지 않음**. 기존 emit은 그대로 활용.

---

## 4. Core Primitives

### 4.1 StatPatch (Phase 2 — 기존 포팅용)

```ts
// primitives/statPatch.ts
interface StatPatch {
  kind: 'stat';
  stats: Partial<ItemEffect>;  // { ad, ap, as, hp, armor, ... }
}

// registry.ts
const ITEM_EFFECTS: Record<string, ItemEffectDescriptor[]> = {
  'TFT_Item_InfinityEdge': [
    { kind: 'stat', stats: { ad: 0.25, critChance: 0.75, critDamage: 0.1 } },
  ],
  // ... 기존 단순 스탯 아이템 전부 여기에 이관
};
```

`getItemEffects`는 `ITEM_EFFECTS[api]`를 읽어 `kind === 'stat'`인 것만 합산. 결과 동일.

### 4.2 Trigger (event + condition + action)

```ts
// primitives/trigger.ts
interface Trigger<E extends CombatEventType> {
  kind: 'trigger';
  event: E;
  condition?: (ctx: TriggerContext) => boolean;
  action: Action;
}

interface TriggerContext {
  unit: CombatUnit;          // 아이템 장착 유닛
  payload: CombatEventPayload;
  state: UnitItemState;      // per-unit per-item counter/stacks
  bus: EventBus;
  rng: SeedRNG;
}
```

### 4.3 Counter (everyN / threshold)

```ts
// primitives/counter.ts
interface EveryN<E extends CombatEventType> {
  kind: 'counter';
  event: E;
  n: number;                 // every N events
  action: Action;
  reset?: 'cycle' | 'never'; // default: cycle
}

// 예: "공격 12번마다 반격 4번"
{ kind: 'counter', event: 'on_attack', n: 12, action: counterAttack(4) }
```

### 4.4 Timer (interval / delay)

```ts
// primitives/timer.ts
interface IntervalTimer {
  kind: 'timer';
  intervalTicks: number;     // TICKS_PER_SECOND=30 기준
  action: Action;
  maxRepeats?: number;       // optional cap
}

// 예: 드론 업링크 "3초마다 피해량의 20% 추가 피해"
{ kind: 'timer', intervalTicks: 90, action: magicDamagePercent(0.20) }
```

### 4.5 Action primitives

> **구현 반영 (2026-04-20)**: Phase 1~5 구현 과정에서 추가된 primitive 변형을 포함한 최종 스키마.

```ts
// primitives/action.ts (실구현: types.ts + action.ts 2-file)
type Action =
  | { kind: 'dealDamage'; amount: DamageAmount; type: DamageType; target: TargetSelector }
  | { kind: 'modifyStat'; stat: StatKey; delta: number; durationTicks?: number }
  | { kind: 'applyDebuff'; debuff: DebuffSpec; target: TargetSelector; durationTicks: number }
  /** amount: number | 'payload.value' (trigger 전용, on_hit/on_cast 피해값 누적) */
  | { kind: 'addStack'; stack: string; amount?: number | 'payload.value'; cap?: number }
  /** 스택 고정 설정 (window reset 용 — Drone Uplink timer 발동 후 0 초기화) */
  | { kind: 'setStack'; stack: string; value: number }
  | { kind: 'chain'; actions: Action[] }
  | { kind: 'branch'; condition: Cond; then: Action; else?: Action };

type DamageAmount =
  | { mode: 'flat'; value: number }
  | { mode: 'pctMaxHp'; pct: number }
  | { mode: 'pctAttackDamage'; pct: number }
  | { mode: 'pctAbilityPower'; pct: number }     // Caster trigger 대비
  | { mode: 'pctDealt'; pct: number }
  | { mode: 'pctOfStack'; stack: string; pct: number };  // 누적된 스택의 N% (Drone 3s window)

type TargetSelector =
  | 'self' | 'attackTarget' | 'nearestEnemy' | 'randomEnemy' | 'allEnemies'
  | 'adjacentEnemies';   // hexDistance ≤ 1
```

**`modifyStat.durationTicks` 동작**: 지정 tick 경과 후 runtime.onTick 에서 `applyStatDelta(unit, stat, -delta)` 로 되돌림. `UnitItemState.pendingBuffs: PendingBuff[]` 에 기록.

---

## 5. Event Taxonomy

### 5.1 기존 CombatEventType (재활용)

| Event | emit 시점 | 재활용 용도 |
|-------|-----------|-------------|
| `on_combat_start` | 전투 시작 | per-unit state 초기화 |
| `on_combat_end` | 전투 종료 | cleanup |
| `on_attack` | 기본 공격 발사 | 구인수(+AS), 수은, 반도체 카운터 |
| `on_hit` | 공격 적중 | 거인의 결의(+AD/AP) |
| `on_cast` | 스킬 발동 | 마나 관련 아이템 |
| `on_kill` | 처치 | ADAPPerKill 계열 |
| `on_death` | 사망 | — |
| `on_damage` | 피해 발생 | BonusDamage 증폭 hook |
| `on_heal` | 회복 | — |
| `on_shield_break` | 보호막 파괴 | — |

### 5.2 신규 추가 이벤트

| Event | emit 시점 | 용도 |
|-------|-----------|------|
| `on_tick` | 매 tick (30/s) | Interval timer dispatch (runtime 내부용) |
| `on_mana_spent` | 마나 소모 | PsyOps 공감 임플란트 |
| `on_hit_taken` | 피격 | 거결의 피격 중첩 |
| `on_windup_start` | 공격 windup | PsyOps AttackPct |

**`on_hit`은 "공격이 적중했을 때"(공격자 관점), `on_hit_taken`은 "맞았을 때"(방어자 관점)** — 기존 `on_hit` 시맨틱이 애매해서 명시적 분리.

---

## 6. 구체적 아이템 설계 예시

### 6.1 구인수의 격노검 (Phase 3)

**효과**: 공격마다 AS +7% 영구 중첩

```ts
// definitions/stacking.ts
'TFT_Item_GuinsoosRageblade': [
  {
    kind: 'trigger',
    event: 'on_attack',
    action: { kind: 'addStack', stack: 'guinsoos_as', amount: 0.07 },
  },
  // Runtime이 guinsoos_as 스택을 유닛 AS에 자동 반영
],
```

### 6.2 거인의 결의 (Phase 3)

**효과**: 공격/피격마다 AD +2%, AP +2 중첩 (최대 25스택)

> **구현 근사 (2026-04-20)**: AD +2% 를 `damageAmp` 로 근사. 이유는 `ChampionStats.damage` 가 최종값 (base × star × (1 + item AD% + trait AD% + ...)) 이라 `modifyStat 'ad' delta` 를 직접 주입하면 **base AD 가 아닌 final AD 에 덧셈** 되어 이중 증폭 발생. `damageAmp` 는 combatLoop 에서 `rawDamage × (1 + damageAmp)` 로 최종 곱해지므로 25 스택 = +50% damage 로 수학적 동등. cap 25 는 `addStack.cap` + 상위 trigger 의 `condition` 두 곳에서 제어.

```ts
'TFT_Item_TitansResolve': [
  statPatch({ as: 10, armor: 20 }),
  {
    kind: 'trigger', event: 'on_attack',
    condition: (ctx) => (ctx.state.stacks.get('titan') ?? 0) < 25,
    action: {
      kind: 'chain',
      actions: [
        { kind: 'addStack', stack: 'titan', cap: 25 },
        { kind: 'modifyStat', stat: 'damageAmp', delta: 0.02 },  // AD% 근사
        { kind: 'modifyStat', stat: 'ap', delta: 2 },
      ],
    },
  },
  { kind: 'trigger', event: 'on_hit_taken', condition: /* 위와 동일 */, action: /* 위와 동일 */ },
],
```

### 6.3 드론 업링크 (Phase 3)

**효과**: 3초마다 피해량의 20% 추가 마법 피해

```ts
'TFT17_Item_PsyOps_DroneMod': [
  {
    kind: 'timer',
    intervalTicks: 90,  // 3s × 30tick/s
    action: {
      kind: 'dealDamage',
      amount: { mode: 'pctDealt', pct: 0.20 },
      type: 'magic',
      target: 'attackTarget',
    },
  },
],
```

### 6.4 반도체 (Phase 4)

**효과**: 12번 맞으면 4번 반격 발사, 각 발사마다 대상 최대 HP 7.5% 피해

```ts
'TFT17_Item_PsyOps_SemiconductorMod': [
  {
    kind: 'counter',
    event: 'on_hit_taken',
    n: 12,
    action: {
      kind: 'chain',
      actions: Array.from({ length: 4 }, () => ({
        kind: 'dealDamage',
        amount: { mode: 'pctMaxHp', pct: 0.075 },
        type: 'magic',
        target: 'attackTarget',
      })),
    },
  },
],
```

### 6.5 Anomaly (Phase 5)

**효과**: Role 기반 분기

```ts
// definitions/anomaly.ts
'TFT17_EkkoOffering_AnomalyItem': [
  {
    kind: 'trigger',
    event: 'on_combat_start',
    action: {
      kind: 'branch',
      condition: (ctx) => ctx.unit.role === 'tank',
      then: { kind: 'modifyStat', stat: 'hp', delta: 1100 },
      else: { /* 다음 role branch */ },
    },
  },
],
```

실제로는 `switch (unit.role)`으로 더 깔끔하게 표현 — role별 action map 사용.

---

## 7. ItemEffectRuntime

### 7.1 라이프사이클

```ts
class ItemEffectRuntime {
  constructor(bus: EventBus, rng: SeedRNG) { ... }

  install(units: CombatUnit[]): void {
    for (const unit of units) {
      for (const item of unit.items) {
        const descriptors = ITEM_EFFECTS[item.apiName] ?? [];
        for (const d of descriptors) {
          this.registerDescriptor(unit, d);
        }
      }
    }
  }

  private registerDescriptor(unit: CombatUnit, d: ItemEffectDescriptor): void {
    switch (d.kind) {
      case 'stat': /* no-op (stat.ts가 이미 처리) */ return;
      case 'trigger': this.registerTrigger(unit, d); return;
      case 'counter': this.registerCounter(unit, d); return;
      case 'timer':   this.registerTimer(unit, d);   return;
    }
  }

  onTick(tick: number): void { /* timer dispatch */ }
  dispose(): void { /* bus.off all handlers */ }
}
```

### 7.2 Per-unit state

```ts
// registry.ts (runtime 내부 상태)
interface UnitItemState {
  stacks: Map<string, number>;       // guinsoos_as=14, titan=25, ...
  counters: Map<string, number>;     // 'semiconductor'=7 (12 쌓이면 proc)
  timerLastTick: Map<string, number>; // interval 마지막 발동 tick
}

// runtime은 unitId → UnitItemState 관리
```

### 7.3 결정론 보장

- Timer 발동: `onTick(tick)`에서 `tick - lastFireTick >= intervalTicks` 판정 (시계 기반 ❌ tick 기반 ✅)
- 랜덤 target 선택: `rng.pick(candidates)` (결정론 보장)
- Handler 순서: `bus.on(event, id, handler, priority)` — priority로 안정 순서

---

## 8. Migration Strategy (Phase 2 핵심)

### 8.1 StatPatch 이관

기존 코드:
```ts
// stat.ts:30 (기존)
export function getItemEffects(items: RawItem[]): ItemEffect {
  for (const item of items) {
    for (const [key, value] of Object.entries(item.effects)) {
      const mapped = ITEM_EFFECT_KEYS[key];
      if (mapped && typeof value === 'number') {
        result[mapped] += value;
      }
    }
  }
  return result;
}
```

신규:
```ts
export function getItemEffects(items: RawItem[]): ItemEffect {
  const result: ItemEffect = {};
  for (const item of items) {
    const descriptors = ITEM_EFFECTS[item.apiName] ?? [];
    for (const d of descriptors) {
      if (d.kind === 'stat') mergeStats(result, d.stats);
    }
    // Fallback: registry에 없으면 기존 ITEM_EFFECT_KEYS 매핑으로 처리
    // → 마이그레이션 기간 backward compat 보장
    if (!descriptors.length) mergeLegacy(result, item.effects);
  }
  return result;
}
```

### 8.2 Golden test gate

1. Phase 2 시작 전: **현재 시뮬 결과로 100개 시나리오 스냅샷** 생성 (champion 10 × item 조합 10)
2. 포팅 작업 후: 동일 시나리오 재실행 → diff 0이어야 merge
3. Fallback이 있으므로 registry 누락이 생겨도 결과 동일

### 8.3 단계적 registry 채우기

- Phase 2 첫 PR: registry 비워둔 상태로 배포 — 전부 legacy fallback 경유 (결과 동일)
- Phase 2 후속 PR: 조합 아이템 40여개를 점진적으로 registry로 이관
- 각 PR마다 Golden test 재실행

---

## 9. New Stat Keys (Phase 2 부가 작업)

> **구현 반영 (2026-04-20)**: 실데이터 스캔 결과(367 named numeric 키) 원래 제시한 11개 중 단순 StatPatch 로 즉시 매핑 가능한 건 2개뿐. 나머지는 trigger 파라미터 / 메타데이터 / 공식 확장 필요.

**실제 추가 매핑 (Phase 5 Part 2 커밋)**:

```ts
// constants.ts 에 추가된 매핑
'StatOmnivamp': 'omnivamp',   // Bloodthirster 0.2, ItemEffect.omnivamp 확장 필요
'ManaRegen':    'manaRegen',  // Shojin/Archangels 1, Empathic base 2
```

**ItemEffect 확장** (`src/types/index.ts`):
- `omnivamp?: number` — CombatUnit.omnivamp 에 합산
- `manaRegen?: number` — CombatUnit.augmentManaRegen 에 합산 (초당 마나 재생)

**StatPatch 로 매핑 불가능한 키 (이월 또는 제외)**:
- `HealPct` / `IncreasedHealing` — 회복 modifier 는 CombatUnit/calculateStats 확장 필요. 현재 엔진 미지원
- `ResistReduce` — 디버프 (targetdamage 적용). `applyDebuff` + CombatUnit.armorReduction 필드 필요 (Phase 4 Part 2 악성코드 선결)
- `ShieldDuration` / `StunDuration` / `BurnDuration` — trigger action 의 duration 파라미터. StatPatch 가 아닌 Trigger 의 `durationTicks` 활용
- `AttackDamage` — Graves Trait 상점 전용 (별도 피처로 분리됨)
- `BonusDamage` / `PctHealthDamage` — trigger 전용 (Rabadon/Deathblade/반도체)

**결론**: 실효 있는 순수 스탯 확장은 2개에서 멈추고, 나머지 복합 효과는 Phase 4 Part 2 / Phase 5 Part 2 에서 trigger primitive + 엔진 확장과 함께 진행.

---

## 10. 파일별 변경 요약

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `systems/items/` (신규 디렉토리) | 신규 | 전체 아이템 효과 모듈 |
| `systems/items/registry.ts` | 신규 | ITEM_EFFECTS 선언 + mergeRegistries (카테고리 병합) |
| `systems/items/runtime.ts` | 신규 | ItemEffectRuntime + pendingBuffs 만료 큐 |
| `systems/items/primitives/types.ts` | 신규 | Primitive 타입 정의 (당초 5-file 설계를 2-file 로 단순화) |
| `systems/items/primitives/action.ts` | 신규 | Action executor (dealDamage/modifyStat/applyDebuff/addStack/setStack/chain/branch) |
| `systems/items/definitions/combined.ts` | 신규 | 순수 StatPatch 아이템 (Phase 2) |
| `systems/items/definitions/stacking.ts` | 신규 | Guinsoos/Titans/Deathblade/Rabadon trigger (Phase 3) |
| `systems/items/definitions/psyops.ts` | 신규 | Drone/Semiconductor/Empathic (Phase 3~4) |
| `systems/items/definitions/anomaly.ts` | 신규 | Role 기반 분기 (Phase 5) |
| `systems/stat.ts` | 수정 | `getItemEffects` registry 우선 + legacy fallback |
| `systems/item.ts` | 수정 없음 | getItemCategory, canEquipItem 유지 |
| `events/eventBus.ts` | 수정 | `on_tick`/`on_mana_spent`/`on_hit_taken`/`on_windup_start` 4종 추가 |
| `models/constants.ts` | 수정 | ITEM_EFFECT_KEYS 에 `StatOmnivamp`/`ManaRegen` 추가 (Phase 5 Part 2 현실화) |
| `types/index.ts` | 수정 | ItemEffect 에 `omnivamp?`/`manaRegen?` 필드 추가 |
| `engine/combatLoop.ts` | 수정 | Runtime install/onTick/dispose + 신규 emit 3종 + applyDamageForItem closure |

---

## 11. Testing Strategy

### 11.1 Golden test (Phase 2 gate)

- `tests/golden/` 에 100개 시나리오 JSON (입력 + 기대 결과)
- `pnpm test:golden` 실행 시 diff 0 요구
- Phase 2 PR merge 전 필수

### 11.2 Primitive unit test

- `primitives/*.test.ts` — 각 primitive 단독 동작 검증
- `tests/unit/items/stacking.test.ts` — 구인수 AS 스택 증가 검증

### 11.3 End-to-end 시뮬 테스트

- `tests/e2e/psyops-combat.test.ts` — PsyOps 전체 장착 상태 30초 시뮬 후 예상 DPS 범위 검증

---

## 12. Implementation Order (Plan 6 Phase 매핑)

| Phase | 산출물 | 성공 기준 | 진행 상태 (2026-04-20) |
|-------|--------|-----------|----------------------|
| Phase 0 Spike | primitive 타입 / event taxonomy 확정 | 설계 문서 업데이트 반영 | ✅ 완료 |
| Phase 1 | runtime.ts + primitives/ 빈 구현 | `pnpm typecheck` 통과 | ✅ 완료 + executor/배선/신규 emit 3종 |
| Phase 2 | registry + legacy fallback + Golden test | 100 시나리오 diff 0 | ⚠️ 진행중 — 조합템 10 / Golden 20 시나리오 (확장 여지) |
| Phase 3 | stacking.ts 6 아이템 | 각 E2E 통과 | ⚠️ 진행중 — Guinsoos/Titans/Deathblade/Rabadon 4/6 + 드론 (psyops.ts), 수은 미구현 |
| Phase 4 | psyops.ts 12 아이템 | 각 E2E 통과 | ⚠️ Part 1 완료 — Drone/Semiconductor/Empathic 3종 + Radiant (6 entry). Part 2 = 악성코드/표적고정/유기물 |
| Phase 5 | anomaly.ts Role 분기 | Role 6종 분기 | ⚠️ Part 1 완료 — Tank/Marksman/Fighter-Assassin/Caster (5/6). Part 2 = Specialist (별 orbiter) |
| Phase 5 Part 2 후속 | ItemEffect omnivamp/manaRegen + modifyStat.durationTicks | 기존 snapshot 예상된 변경만 | ✅ 완료 (2026-04-20) |
| Phase 6 | estimateDps 매직 넘버 역산 + 상징 DPS | 6개 매직 넘버 교체 | ❌ 미착수 |

---

## 13. Open Questions

1. **Anomaly 효과 수치 출처**: CDragon `effects` hash 키는 있지만 사람이 읽을 수 있는 desc 텍스트와 매핑이 불분명. 일단 desc에서 역산(예: `@TankHP_TOOLTIPONLY@` → 1100)하되, 검증은 별도 스파이크 필요.
2. **Radiant 배수 처리**: `Radiant_` prefix 아이템은 base 아이템의 배수인 경우가 많음 (예: Radiant DamageRepeat = 1.5x). registry에 별도 entry로 둘지, base 재활용 메타로 둘지 결정 필요.
3. **Piltover/Bilgewater와의 경계**: `resolveBilgewaterStatEffects`가 별도로 존재. 이번 엔진에 흡수할지 유지할지? → **Phase 2에서는 유지**, Phase 6 이후 검토.

---

## 14. Related Documents

- Plan: [item-effect-engine.plan.md](../../01-plan/features/item-effect-engine.plan.md)
- 선행 플랜 3건 (이 엔진 Phase 3/6에서 통합 해결):
  - `engine-stacking-items.plan.md`
  - `estimateDps-magic-numbers.plan.md`
  - `emblem-synergy-dps.plan.md`
- 참고 패턴: `src/lib/simulator/systems/augment.ts` (PerUnitAugmentMod)
- 기존 EventBus: `src/lib/simulator/events/eventBus.ts`
- Combat Loop emit 지점: `src/lib/simulator/engine/combatLoop.ts` (L481, L1424, L1594, ...)
