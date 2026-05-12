# Mordekaiser Proc System — Design

> **Date**: 2026-05-07
> **Branch**: `feat/mordekaiser-proc-system`
> **Base**: `dev`
> **Audit reference**: `docs/meta/opponent-carries-audit-2026-05-07.md` (P1 — Critical)
> **Path**: A — Mordekaiser focused, 후속 별도 PR로 broader shield source refactor

---

## 1. Background

PR #102 audit 진단:
- game-20260423-001 baseline: real 33s 전투 vs sim 7.77s (4x 빠름)
- Player carry HP +40~56% / Opponent HP -15~22% — opponent damage 부족이 dominant
- Mordekaiser ★2 (4R) 의 proc 시스템이 **DOT으로 잘못 근사** → ~25%만 적용됨

**정정된 Mechanic** (raw `desc` 정밀 분석):
- Cast 시점: InitialShield 즉시 보호막
- **4초 동안 매초 1Hz 펄스** (audit doc의 "평타당" 표기는 잘못된 해석):
  - ShieldPerProc 보호막 추가
  - 인접 적(1칸)에게 DamagePerProc 마법 피해
- 종료 시: 남은 보호막 × HealRefund(40%) → 체력 회복

**현 sim의 4가지 gap**:
1. **DamagePerProc**: sim total = DamagePerProc (단일 값 4초 분산) vs real 4 × DamagePerProc → ~25%만 적용
2. **ShieldPerProc**: 완전 미구현
3. **HealRefund**: 완전 미구현
4. **InitialShield**: generic `getAbilityShield`로 적용되지만 **모든 shield와 통합 풀(`unit.shield`)** — HealRefund 정확 계산 불가

---

## 2. Scope & Deliverables

### Goals
1. **Mordekaiser proc 정확 구현**: 매초 1Hz 펄스 (ShieldPerProc + DamagePerProc) × 4회 + 종료 시 HealRefund
2. **Mordekaiser shield = 별도 pool**: `unit.mordekaiserShieldRemaining` 추적. damage 흡수 시 우선 차감, HealRefund 정확 계산
3. **DOT 근사 제거**: ability.ts entry에서 `dot:{duration:4}` 제거, `{ pattern: 'self_buff' }` 단순화
4. **회귀 가드 7 케이스**: 별도 pool 검증, 펄스 timing, HealRefund, 사망 cancel, applyShield priority

### Deliverables (1 PR, 3 commits)

| 산출물 | 경로 | 비고 |
|--------|------|------|
| CombatUnit typed 필드 | `src/types/index.ts` | 3개 추가 (`mordekaiserProcEndTick`, `mordekaiserNextProcTick`, `mordekaiserShieldRemaining`) |
| `createCombatUnit` 초기화 | `combatLoop.ts:197+` | 3 필드 0 default |
| `applyShield` 수정 | `combatLoop.ts:923` | Mordekaiser pool 우선 흡수 |
| `getAbilityShield` short-circuit | `combatLoop.ts:5950` + `:6557` | Poppy + Mordekaiser apiName 모두 0 반환 |
| `applyMordekaiserProcCast` helper | `combatLoop.ts` (line 871+ 인근) | export, cast 시점 호출 |
| `tickMordekaiserProc` helper | `combatLoop.ts` | export, 매 tick 호출 |
| In-range cast wiring | `combatLoop.ts:6462` 인근 | Poppy wiring 다음 |
| OOR cast wiring | `combatLoop.ts:6575` 인근 | Poppy wiring 다음 |
| Main loop tick wiring | `combatLoop.ts` | `tickStatusEffects(unit)` 호출 직후 |
| ability.ts entry 단순화 | `src/lib/simulator/systems/ability.ts:210` | `dot` 제거, `{ pattern: 'self_buff' }` |
| 회귀 가드 | `tests/unit/mordekaiser-proc.test.ts` | 7 케이스 |
| Design spec | `docs/superpowers/specs/2026-05-07-mordekaiser-proc-design.md` | 본 문서 |

### Out of scope (후속 PR로)

- **시너지/아이템 shield source 분리** (broader refactor) — 본 PR은 Mordekaiser pool만 별도 분리. 시너지(예: 보호병) 와 아이템(예: 가시 갑옷) shield는 여전히 통합 `unit.shield` 풀 — broader refactor PR로 후속 처리
- **AugmentedDuration (Concentration augment 6초)** — augment 시스템 통합 시
- **`getAbilityShield` 자체의 `value[starLevel]` shifted indexing 버그** (PR #102 codex P1 후속)
- **Lissandra ★3 / Veigar Astronaut / Illaoi NumEnemies** — audit P2/P3
- **diff cache 자동 재실행** — 사용자 수동 검증

---

## 3. Mechanic & State Lifecycle

### Raw values (sentinel filler resolved via readVarByStar)

| Variable | ★1 | ★2 | ★3 | filler? |
|----------|:---:|:---:|:---:|:---:|
| InitialShield | 300 | 375 | 500 | Yes (raw[0]=0) |
| ShieldPerProc | 75 | 90 | 105 | Yes (raw[0]=0) |
| DamagePerProc | 45 | 70 | 100 | Yes (raw[0]=0) |
| HealRefund | 0.4 | 0.4 | 0.4 | No |
| Duration | 4 | 4 | 4 | No |
| AugmentedDuration | 6 | 6 | 6 | No (scope OUT) |

### State Machine

```
[Cast]                                                      [End]
  │                                                            │
  ▼                                                            ▼
t=0 ─── t=1 ─── t=2 ─── t=3 ─── t=4
 │       │       │       │       │
 │     pulse   pulse   pulse   pulse  HealRefund
 │       1       2       3       4
 │
 InitialShield ─→ mordekaiserShieldRemaining (별도 pool)
                  (NOT general unit.shield)
```

### Cast 시점 (t=0) — `applyMordekaiserProcCast(unit, tick)`

1. raw 변수 읽기 (readVarByStar)
2. `unit.mordekaiserShieldRemaining += InitialShield × (1 + ap/100)` (별도 pool, 기존 값에 누적 — 재시전 대응)
3. `unit.mordekaiserProcEndTick = tick + Duration × TICKS_PER_SECOND`
4. `unit.mordekaiserNextProcTick = tick + 1 × TICKS_PER_SECOND` (첫 펄스 t=1)

`getAbilityShield`의 InitialShield 적용은 **Mordekaiser일 때 short-circuit** (Poppy P1 fix와 동일 패턴).

### 매 tick — `tickMordekaiserProc(unit, tick, time, enemies, eventBus, logs, tickLogs)`

main combat loop의 per-unit 단계에서 `tickStatusEffects(unit)` 직후 호출.

1. **State inactive**: `mordekaiserProcEndTick === 0` → early return
2. **사망 시 cancel** (Q2 A): `state === 'dead'` 또는 `currentHp <= 0` → 3 필드 0 reset (잔여 무효), HealRefund 미발동
3. **펄스 발동** (`tick >= mordekaiserNextProcTick && tick < mordekaiserProcEndTick`):
   - 적 1칸 내 (`hexDistance ≤ 1`)에게: `applyAbilityMitigation(unit, e, DamagePerProc × (1+ap/100) × (1+damageAmp), 'magic', eventBus, tick)`로 마법 피해
   - 적 사망 처리: `markTargetDead` 패턴 (Caitlyn/Corki 펄스와 동일)
   - Mordekaiser: `mordekaiserShieldRemaining += ShieldPerProc × (1+ap/100)` (별도 pool, `unit.shield` 안 건드림)
   - `mordekaiserNextProcTick += TICKS_PER_SECOND` (다음 1초 후)
4. **만료** (`tick >= mordekaiserProcEndTick`):
   - HealRefund 계산: `heal = mordekaiserShieldRemaining × HealRefund × (1 + healAmp ?? 0)`
   - `unit.currentHp = min(maxHp, currentHp + heal)`
   - `mordekaiserShieldRemaining = 0` (소모됨)
   - `mordekaiserProcEndTick = 0`, `mordekaiserNextProcTick = 0` (state cleanup)

### Damage 흡수 순서 — `applyShield` 수정

기존 (line 923-934): `unit.shield` 단일 풀만 처리.
수정: Mordekaiser pool 우선 흡수, 다른 챔프 영향 없음 (`mordekaiserShieldRemaining = 0` default).

```ts
function applyShield(unit: CombatUnit, damage: number, eventBus: EventBus, tick: number): number {
  let remaining = damage;

  // === Mordekaiser 스킬 보호막 (별도 pool, source별 분리) ===
  if (unit.mordekaiserShieldRemaining > 0 && remaining > 0) {
    const absorbed = Math.min(unit.mordekaiserShieldRemaining, remaining);
    unit.mordekaiserShieldRemaining -= absorbed;
    remaining -= absorbed;
  }

  // === General unit.shield (시너지/아이템) — 기존 로직 ===
  if (unit.shield > 0 && remaining > 0) {
    const absorbed = Math.min(unit.shield, remaining);
    unit.shield -= absorbed;
    remaining -= absorbed;
    if (unit.shield <= 0) {
      unit.shield = 0;
      unit.statusEffects = unit.statusEffects.filter(e => e.type !== 'shield');
      eventBus.emit('on_shield_break', { sourceId: unit.id, tick });
    }
  }

  return remaining;
}
```

→ 모든 damage 사이트가 `applyShield` 통해 흡수하므로 자동으로 Mordekaiser pool 우선 적용.

### Edge cases

| 시나리오 | 동작 |
|----------|------|
| Mordekaiser 사망 | tickMordekaiserProc early return + 3 필드 0 reset (잔여 무효) |
| 스턴/도발 | 펄스 계속 (Q2 A) |
| Cast 중복 시전 | 두 번째 cast가 첫 번째 state 덮어씀 (`mordekaiserShieldRemaining`은 누적, EndTick/NextProcTick은 새 값) |
| HealRefund 시 시너지/아이템 shield 잔존 | 영향 없음 (Mordekaiser pool만 보고 계산) |
| 시너지 shield + Mordekaiser shield 동시 보유 + damage | Mordekaiser pool 먼저 → 시너지 (general 풀) |
| 시너지 vs 아이템 shield 구분 | 본 PR scope OUT (general 풀 단일 — broader refactor PR로 후속) |

---

## 4. Code Design 상세

### 4.1 CombatUnit type 변경 (`src/types/index.ts`)

기존 typed 필드 (`bastionDoubleEndTick`, `bastionDoubleArmorBonus` 등) 패턴 따라 추가:

```ts
// Mordekaiser proc 추적 (PR #N — Mordekaiser proc 시스템)
mordekaiserProcEndTick: number;          // proc 종료 tick (0 = 비활성)
mordekaiserNextProcTick: number;         // 다음 펄스 발동 tick
mordekaiserShieldRemaining: number;      // 별도 shield pool 잔여량
```

### 4.2 `createCombatUnit` 초기화 (`combatLoop.ts:197+`)

기존 typed 필드 초기화 영역에 추가:
```ts
mordekaiserProcEndTick: 0,
mordekaiserNextProcTick: 0,
mordekaiserShieldRemaining: 0,
```

### 4.3 `ability.ts:210` Mordekaiser entry 단순화

```ts
// Before
TFT17_Mordekaiser: { pattern: 'aoe_circle', radius: 1, heal: true, dot: { duration: 4 } },

// After
TFT17_Mordekaiser: { pattern: 'self_buff' },  // 4초간 매초 펄스 (ShieldPerProc + DamagePerProc) — combatLoop applyMordekaiserProcCast/tickMordekaiserProc 헬퍼
```

### 4.4 `applyShield` 수정 (line 923-934)

§3 코드 그대로.

### 4.5 `getAbilityShield` short-circuit 확장 (Poppy 기존 + Mordekaiser 추가)

`combatLoop.ts:5950` + `:6557` 양쪽:
```ts
// Before (Poppy P1 fix 적용된 상태)
const abilityShield = unit.champion.apiName === 'TFT17_Poppy'
  ? 0
  : getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);

// After
const abilityShield = (unit.champion.apiName === 'TFT17_Poppy' || unit.champion.apiName === 'TFT17_Mordekaiser')
  ? 0
  : getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
```

### 4.6 `applyMordekaiserProcCast` helper (export)

`combatLoop.ts` 의 `applyPoppyShieldAndResists` 인근 (line 871+) 에 추가:

```ts
/**
 * Mordekaiser 캐스트 시점 호출:
 * - InitialShield 를 mordekaiserShieldRemaining 별도 pool 에 추가 (general unit.shield 안 건드림)
 * - 4초간 매초 펄스 state 등록 (mordekaiserProcEndTick, mordekaiserNextProcTick)
 *
 * getAbilityShield 의 InitialShield 적용은 Mordekaiser 일 때 short-circuit 됨 (line 5950/6557).
 */
export function applyMordekaiserProcCast(unit: CombatUnit, tick: number): void {
  const vars = unit.champion.ability.variables;
  if (!vars) return;

  const initialShield = readVarByStar(
    vars.find(v => v.name === 'InitialShield')?.value, unit.starLevel, 0
  );
  const duration = readVarByStar(
    vars.find(v => v.name === 'Duration')?.value, unit.starLevel, 4
  );
  const apMul = 1 + unit.stats.ap / 100;

  unit.mordekaiserShieldRemaining += initialShield * apMul;
  unit.mordekaiserProcEndTick = tick + Math.round(duration * TICKS_PER_SECOND);
  unit.mordekaiserNextProcTick = tick + TICKS_PER_SECOND;  // 첫 펄스 t=1
}
```

### 4.7 `tickMordekaiserProc` helper (export)

```ts
/**
 * Mordekaiser 매 tick 처리:
 * - 사망 시 cancel + state cleanup (Q2 A)
 * - 펄스 발동 (tick >= mordekaiserNextProcTick): 1칸 적 DamagePerProc + 본인 ShieldPerProc
 * - 만료 (tick >= mordekaiserProcEndTick): HealRefund (잔여 × 0.4) + state cleanup
 */
export function tickMordekaiserProc(
  unit: CombatUnit,
  tick: number,
  time: number,
  enemies: CombatUnit[],
  eventBus: EventBus,
  logs: CombatLog[],
  tickLogs: CombatLog[],
): void {
  if (unit.mordekaiserProcEndTick === 0) return;
  if (unit.state === 'dead' || unit.currentHp <= 0) {
    unit.mordekaiserProcEndTick = 0;
    unit.mordekaiserNextProcTick = 0;
    unit.mordekaiserShieldRemaining = 0;
    return;
  }

  const vars = unit.champion.ability.variables;
  if (!vars) return;
  const apMul = 1 + unit.stats.ap / 100;

  // 펄스 발동
  if (tick >= unit.mordekaiserNextProcTick && tick < unit.mordekaiserProcEndTick) {
    const damagePerProc = readVarByStar(
      vars.find(v => v.name === 'DamagePerProc')?.value, unit.starLevel, 0
    );
    const shieldPerProc = readVarByStar(
      vars.find(v => v.name === 'ShieldPerProc')?.value, unit.starLevel, 0
    );

    // 적에게 마법 피해 (1칸 내) — applyAbilityMitigation 파이프라인 통과
    const dmgRaw = damagePerProc * apMul * (1 + unit.damageAmp);
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      if (hexDistance(unit.position, e.position) > 1) continue;
      const dmg = applyAbilityMitigation(unit, e, dmgRaw, 'magic', eventBus, tick);
      e.currentHp -= dmg;
      e.totalDamageTaken += dmg;
      unit.totalDamageDealt += dmg;
      // 사망 처리: markTargetDead 패턴 (구현 시 정확한 호출 사이트 결정 — Caitlyn/Corki 펄스와 동일)
    }

    // 본인 보호막 추가 (별도 pool)
    unit.mordekaiserShieldRemaining += shieldPerProc * apMul;

    unit.mordekaiserNextProcTick += TICKS_PER_SECOND;
  }

  // 만료
  if (tick >= unit.mordekaiserProcEndTick) {
    const healRefund = readVarByStar(
      vars.find(v => v.name === 'HealRefund')?.value, unit.starLevel, 0
    );
    const heal = unit.mordekaiserShieldRemaining * healRefund * (1 + (unit.healAmp ?? 0));
    if (heal > 0) {
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
    }
    unit.mordekaiserShieldRemaining = 0;
    unit.mordekaiserProcEndTick = 0;
    unit.mordekaiserNextProcTick = 0;
  }
}
```

### 4.8 Cast 사이트 wiring

**In-range cast** (`combatLoop.ts:6462` 인근, 기존 Poppy wiring 다음):
```ts
if (unit.champion.apiName === 'TFT17_Mordekaiser') {
  applyMordekaiserProcCast(unit, tick);
}
```

**OOR cast** (`combatLoop.ts:6575` 인근, 기존 Poppy wiring 다음):
```ts
if (unit.champion.apiName === 'TFT17_Mordekaiser') {
  applyMordekaiserProcCast(unit, tick);
}
```

### 4.9 Main loop tick wiring

per-unit tick 단계에서 `tickStatusEffects(unit, ...)` 직후 호출. 정확한 라인은 구현 시 grep으로 식별.

```ts
tickStatusEffects(unit, tick, time, logs, tickLogs);
tickMordekaiserProc(unit, tick, time, enemies, eventBus, logs, tickLogs);  // ← INSERT
```

`enemies` 변수는 `unit.team` 기준 (player → enemyUnits, enemy → playerUnits) — main loop scope 확인 시 정확한 변수명 결정.

---

## 5. 회귀 가드 (`tests/unit/mordekaiser-proc.test.ts`, 7 케이스)

| # | 케이스 | 입력 | 기대 |
|---|--------|------|------|
| C1 | ★1 AP=0 cast → InitialShield 별도 pool | Mordekaiser ★1 AP=0, tick=0 | `mordekaiserShieldRemaining ≈ 300`, **`unit.shield` 변화 없음**, `mordekaiserProcEndTick = 120` (4s × 30tps), `mordekaiserNextProcTick = 30` (t=1) |
| C2 | ★2 AP=100 cast | Mordekaiser ★2 AP=100, tick=0 | `mordekaiserShieldRemaining ≈ 750` (375 × 2.0) |
| C3 | 펄스 1회 발동 — damage + shield | ★1 cast 후 tick=30 (t=1), 1칸 적 1명 (armor=0, MR=0) | 적: `currentHp` 차감 ≈ 45, Mordekaiser: `mordekaiserShieldRemaining ≈ 300 + 75 = 375` |
| C4 | 4 펄스 누적 | ★1 cast → tick 30/60/90/120 진행 | 적 누적 damage ≈ 4 × 45 = 180, 펄스 중 shield 누적 = 300 + 4×75 = 600, 만료 후 0 |
| C5 | 만료 시 HealRefund | ★1 cast, 4 펄스 후 t=4s 도달 (피해 안 받음) | 잔여 600 × 0.4 = 240 heal, `currentHp += 240` (clamped), `mordekaiserShieldRemaining = 0`, state cleanup |
| C6 | 사망 시 cancel | ★1 cast, tick=45 에 `currentHp = 0` | tickMordekaiserProc early return + state cleanup, 추가 펄스 안 나감, HealRefund 안 발동 |
| C7 | `applyShield` priority — Mordekaiser pool 먼저 | unit에 `mordekaiserShieldRemaining = 100` + `unit.shield = 200` 상태에서 damage 150 hit | Mordekaiser pool 100 모두 흡수, `unit.shield` 50 흡수, 잔여 0, `mordekaiserShieldRemaining = 0`, `unit.shield = 150` |

(Sentinel filler 회귀: C1이 `★1 = 300`을 검증하므로 raw[0]=0 sentinel 스킵 자동 가드)

---

## 6. Verification

### 자동 검증 (mandatory)
```bash
pnpm lint && pnpm typecheck && pnpm build  # CLAUDE.md 룰
pnpm test                                    # 기존 + 신규 7 케이스
pnpm test mordekaiser-proc                   # 신규 7 케이스 통과
pnpm test poppy-shield-resists               # Poppy 회귀 (getAbilityShield short-circuit 확장 영향)
```

### 사용자 수동 검증 (out of automated)
```bash
pnpm tsx scripts/compute-diff-cache.ts
```
- 기대: sim 전투 종료 시간 4x → 2~3x로 감소, winnerMatchRate +5pt 이상 (audit doc 예상)
- Mordekaiser 등장 라운드 (★2 4R) opponent damage 증가, player HP 오차 감소

### Definition of Done

✅ **Mandatory**:
- [ ] CombatUnit typed 필드 3개 추가
- [ ] `createCombatUnit` 초기화 (3 필드 = 0)
- [ ] `applyShield` 수정 (Mordekaiser pool 우선)
- [ ] `getAbilityShield` short-circuit Mordekaiser 추가
- [ ] `applyMordekaiserProcCast` export helper
- [ ] `tickMordekaiserProc` export helper
- [ ] in-range/OOR cast wiring
- [ ] main loop tick wiring
- [ ] ability.ts:210 entry 단순화
- [ ] 7 회귀 가드 통과
- [ ] lint/typecheck/build/test pass (Poppy 회귀 가드 포함)
- [ ] codex review의 P1 issue 모두 해결

❌ **Out of scope**:
- 시너지/아이템 shield source 분리 (broader refactor) → 후속 PR
- AugmentedDuration (Concentration augment)
- `getAbilityShield` value[starLevel] 자체 버그 (PR #102 codex P1 후속)
- diff cache 자동 재실행

---

## 7. PR 구조 (commit 분할)

```
1. feat(sim): infrastructure — Mordekaiser shield pool 기반 마련
   - CombatUnit typed 필드 3개 추가
   - applyShield 수정 (별도 pool 우선 흡수)
   - getAbilityShield short-circuit 확장 (Poppy + Mordekaiser)
   - createCombatUnit 초기화

2. feat(sim): Mordekaiser proc 시스템 — 4초간 매초 펄스 + HealRefund
   - applyMordekaiserProcCast helper (cast 시점 InitialShield + state 등록)
   - tickMordekaiserProc helper (펄스 발동 + 만료 시 HealRefund + 사망 cancel)
   - in-range/OOR cast wiring + main loop tick wiring
   - ability.ts:210 entry 단순화 (dot 제거)

3. test(sim): Mordekaiser proc 회귀 가드 7건
   - C1~C2: ★별 InitialShield × AP scaling (별도 pool 검증)
   - C3~C4: 펄스 timing + damage/shield 누적
   - C5: HealRefund (잔여 × 0.4)
   - C6: 사망 시 cancel
   - C7: applyShield priority (Mordekaiser pool 우선)
```

+ codex review 후속 fix commits (있을 경우)

---

## 8. 참고 문서

- `docs/meta/opponent-carries-audit-2026-05-07.md` — P1 audit (PR #102)
- `docs/meta/diff-attribution-2026-05-06-followup.md` — root cause 진단
- `docs/superpowers/specs/2026-05-07-opponent-carries-audit-design.md` — 선행 PR design
- 코드: `combatLoop.ts:171` (`readVarByStar`), `:843` (`applyResistance`), `:923` (`applyShield`), `:871` (`applyPoppyShieldAndResists` — Poppy 헬퍼 인근에 신규 helper 배치)

---

## 9. Risks & Mitigation

| 위험 | 가능성 | 영향 | Mitigation |
|------|:---:|:---:|------|
| `applyShield` 수정으로 다른 챔프 shield 동작 영향 | Low | High | `mordekaiserShieldRemaining = 0` default → 다른 unit은 skip 후 기존 로직. C7 회귀 가드 + Poppy 가드 회귀 | 
| typed 필드 3개 추가로 CombatUnit dirtiness | Low | Low | `bastionDoubleEndTick` 등 기존 패턴 일관성 |
| 사망 처리 `markTargetDead` 호출 사이트 부정확 | Medium | Medium | Caitlyn(line 5497+)/Corki(5523+) 펄스 패턴 참고, 구현 시 정확 식별 |
| HealRefund 잔여 계산이 시너지/아이템 shield 잔존 시 부정확 | N/A | N/A | 별도 pool로 분리됐으므로 영향 없음 (이번 PR 핵심 fix) |
| Cast 중복 시전 시 state 누적 | Low | Low | EndTick/NextProcTick은 새 값으로 덮어씀, ShieldRemaining은 누적 — 게임 정합 (재시전이 새 보호막 추가) |
| Mordekaiser ★3 등장 안 함 (game-1 baseline 기준) | N/A | N/A | sim 정확도 측면에서 ★1/2 영향 dominant — ★3 회귀 가드는 안전망 |
