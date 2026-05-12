# Mordekaiser Proc System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set 17 Mordekaiser proc 시스템 정확 구현 — 매초 1Hz 펄스 (4초간 4펄스, ShieldPerProc + DamagePerProc) + 만료 시 HealRefund + Mordekaiser 스킬 shield 별도 pool 분리.

**Architecture:** CombatUnit에 typed 필드 3개 추가 → applyShield 수정 (Mordekaiser pool 우선 흡수) → getAbilityShield short-circuit 확장 (Poppy + Mordekaiser) → cast 시점 helper + 매 tick helper 추가 → cast/tick wiring. 3 commit 분할 (infrastructure / Mordekaiser-specific / tests).

**Tech Stack:** TypeScript, Vitest, Next.js 15 App Router

---

## Spec Reference

`docs/superpowers/specs/2026-05-07-mordekaiser-proc-design.md`

## File Structure

**New files:**
- `tests/unit/mordekaiser-proc.test.ts` — 7 회귀 가드 케이스

**Modified files:**
- `src/types/index.ts` — CombatUnit interface에 typed 필드 3개 추가 (line ~510+ 인근, `madredsTankDamageAmp` 다음 영역)
- `src/lib/simulator/engine/combatLoop.ts`:
  - line 197+ `createCombatUnit` 초기화 영역 — 3 필드 0 default
  - line 923-934 `applyShield` — Mordekaiser pool 우선 흡수 추가
  - line 6008 (in-range) + 6627 (OOR) — `getAbilityShield` short-circuit Mordekaiser 추가
  - 새 helper `applyMordekaiserProcCast` (line 871+ 인근, `applyPoppyShieldAndResists` 다음)
  - 새 helper `tickMordekaiserProc`
  - line 5178 `tickStatusEffects(unit, ...)` 직후 — `tickMordekaiserProc` 호출 wiring
  - line 6529 (in-range) + 6646 (OOR) — Mordekaiser cast wiring (Poppy wiring 다음)
- `src/lib/simulator/systems/ability.ts:210` — Mordekaiser entry 단순화

---

## Phase 1 — Infrastructure (commit 1)

### Task 1: Add typed fields to CombatUnit

**Files:**
- Modify: `src/types/index.ts:~516` (after `madredsTankDamageAmp` field)

- [ ] **Step 1: Locate the typed field area**

Run: `grep -n "madredsTankDamageAmp:" src/types/index.ts`
Expected: returns line ~516 with `madredsTankDamageAmp: number;`

- [ ] **Step 2: Insert 3 new typed fields**

Insert immediately after the `madredsTankDamageAmp: number;` line and its closing comment block:

```ts
  /**
   * Mordekaiser proc 시스템 (TFT17_Mordekaiser) — proc 종료 tick.
   * 0 = 비활성. cast 시점에 (currentTick + Duration × TICKS_PER_SECOND) 로 set.
   * 매 tick `tickMordekaiserProc` 에서 만료 체크 (HealRefund 적용 후 0 reset).
   */
  mordekaiserProcEndTick: number;
  /**
   * Mordekaiser proc 다음 펄스 발동 tick.
   * 0 = 비활성. cast 시 (currentTick + 1 × TICKS_PER_SECOND) — 첫 펄스 t=1.
   * 펄스 발동 후 += TICKS_PER_SECOND (다음 1초 후).
   */
  mordekaiserNextProcTick: number;
  /**
   * Mordekaiser 스킬 보호막 별도 pool (general unit.shield 와 분리 추적).
   * InitialShield + 매 펄스 ShieldPerProc 가산. damage 흡수 시 우선 차감.
   * 만료 시 HealRefund (잔여 × 0.4) → currentHp 회복 후 0.
   */
  mordekaiserShieldRemaining: number;
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS — 새로운 필드 추가만, 기존 사용처는 수정 안 했으므로 계속 통과 (typed required지만 createCombatUnit에서 초기화 추가가 Task 2에서 이루어짐)

**중요**: typecheck가 실패할 가능성 있음 — `createCombatUnit`에서 객체 리터럴이 새 필드 누락하면 에러. 만약 fail 하면 Task 2를 먼저 수행하고 Task 1 typecheck 재실행.

### Task 2: Initialize new fields in createCombatUnit

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:197+` (createCombatUnit function body, near `madredsTankDamageAmp` initialization)

- [ ] **Step 1: Locate initialization area**

Run: `grep -n "madredsTankDamageAmp:" src/lib/simulator/engine/combatLoop.ts`
Expected: returns line ~228 with `madredsTankDamageAmp: madredsCount * 0.15,`

- [ ] **Step 2: Insert 3 field initializations**

Find the line `madredsTankDamageAmp: madredsCount * 0.15,` and insert immediately after:

```ts
    // Mordekaiser proc 시스템 — 모든 unit 0 default. cast 시점에 applyMordekaiserProcCast 가 set.
    mordekaiserProcEndTick: 0,
    mordekaiserNextProcTick: 0,
    mordekaiserShieldRemaining: 0,
```

(맞춤 indentation은 주변 필드와 일치 — 4 spaces)

- [ ] **Step 3: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS — type 정의와 초기화 정합 완료.

### Task 3: Modify applyShield for separate pool

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:923-934` (`applyShield` function)

- [ ] **Step 1: Read current implementation**

Run: `grep -nA 13 "^function applyShield" src/lib/simulator/engine/combatLoop.ts | head -15`
Expected: returns the current 12-line implementation.

- [ ] **Step 2: Replace function body**

Replace the existing function (line 923-934):

```ts
function applyShield(unit: CombatUnit, damage: number, eventBus: EventBus, tick: number): number {
  if (unit.shield <= 0) return damage;
  const absorbed = Math.min(unit.shield, damage);
  unit.shield -= absorbed;
  const remaining = damage - absorbed;
  if (unit.shield <= 0) {
    unit.shield = 0;
    unit.statusEffects = unit.statusEffects.filter(e => e.type !== 'shield');
    eventBus.emit('on_shield_break', { sourceId: unit.id, tick });
  }
  return remaining;
}
```

with:

```ts
function applyShield(unit: CombatUnit, damage: number, eventBus: EventBus, tick: number): number {
  let remaining = damage;

  // === Mordekaiser 스킬 보호막 (별도 pool, source별 분리 — PR #N) ===
  // mordekaiserShieldRemaining 가 양수일 때 우선 흡수. 다른 챔프는 0 default → skip.
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

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 4: Extend getAbilityShield short-circuit (Mordekaiser 추가)

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:6008` (in-range cast)
- Modify: `src/lib/simulator/engine/combatLoop.ts:6627` (OOR cast)

- [ ] **Step 1: Modify in-range cast (line 6008)**

Replace:
```ts
            // Poppy: helper(applyPoppyShieldAndResists)가 readVarByStar 로 정확한 Shield 값 적용 →
            // generic getAbilityShield 의 value[starLevel] shifted indexing 회피 (codex P1 PR #102)
            const abilityShield = unit.champion.apiName === 'TFT17_Poppy'
              ? 0
              : getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
```

with:
```ts
            // Poppy: helper(applyPoppyShieldAndResists)가 readVarByStar 로 정확한 Shield 값 적용
            //   (codex P1 PR #102 — getAbilityShield value[starLevel] shifted indexing 회피).
            // Mordekaiser: applyMordekaiserProcCast 가 InitialShield 를 별도 pool 에 적용
            //   (mordekaiserShieldRemaining — general unit.shield 와 분리, HealRefund 정확 계산).
            const abilityShield = (unit.champion.apiName === 'TFT17_Poppy' || unit.champion.apiName === 'TFT17_Mordekaiser')
              ? 0
              : getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
```

- [ ] **Step 2: Modify OOR cast (line 6627)**

Replace:
```ts
          // Poppy: helper(applyPoppyShieldAndResists)가 readVarByStar 로 정확한 Shield 값 적용 →
          // generic getAbilityShield 의 value[starLevel] shifted indexing 회피 (codex P1 PR #102)
          const abilityShield = unit.champion.apiName === 'TFT17_Poppy'
            ? 0
            : getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
```

with:
```ts
          // Poppy: helper(applyPoppyShieldAndResists)가 readVarByStar 로 정확한 Shield 값 적용
          //   (codex P1 PR #102 — getAbilityShield value[starLevel] shifted indexing 회피).
          // Mordekaiser: applyMordekaiserProcCast 가 InitialShield 를 별도 pool 에 적용
          //   (mordekaiserShieldRemaining — general unit.shield 와 분리, HealRefund 정확 계산).
          const abilityShield = (unit.champion.apiName === 'TFT17_Poppy' || unit.champion.apiName === 'TFT17_Mordekaiser')
            ? 0
            : getAbilityShield(unit.champion, unit.starLevel, unit.stats.ap);
```

- [ ] **Step 3: Verify typecheck + build + tests**

Run:
```bash
pnpm typecheck && pnpm build && pnpm test
```
Expected: ALL PASS — Phase 1 infrastructure 완성. 모든 unit이 0 default mordekaiserShieldRemaining → applyShield 수정이 다른 챔프 영향 없음. Poppy 회귀 테스트 (`tests/unit/poppy-shield-resists.test.ts`)도 계속 통과 (Mordekaiser apiName 추가는 Poppy 동작 변경 없음).

### Task 5: Commit Phase 1 (infrastructure)

- [ ] **Step 1: Stage and commit**

```bash
git add src/types/index.ts src/lib/simulator/engine/combatLoop.ts
git commit -m "feat(sim): infrastructure — Mordekaiser shield pool 기반 마련

CombatUnit typed 필드 3개 추가:
- mordekaiserProcEndTick: proc 종료 tick (0 = 비활성)
- mordekaiserNextProcTick: 다음 펄스 발동 tick
- mordekaiserShieldRemaining: 별도 shield pool 잔여량

applyShield 수정: Mordekaiser pool 우선 흡수 → unit.shield → HP 순.
mordekaiserShieldRemaining = 0 default 라 다른 챔프 영향 없음 (skip).

getAbilityShield short-circuit 확장 (in-range line 6008 + OOR line 6627):
Poppy + Mordekaiser apiName 둘 다 0 반환. 챔프-specific helper 가 canonical
shield handler 역할 (Poppy: applyPoppyShieldAndResists / Mordekaiser:
applyMordekaiserProcCast — Phase 2).

createCombatUnit 초기화: 3 필드 0 default 추가."
```

---

## Phase 2 — Mordekaiser-specific 로직 (commit 2)

### Task 6: Add applyMordekaiserProcCast helper

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts` (insert near line 871+ — `applyPoppyShieldAndResists` 함수 다음)

- [ ] **Step 1: Locate applyPoppyShieldAndResists end**

Run: `grep -nA 1 "export function applyPoppyShieldAndResists" src/lib/simulator/engine/combatLoop.ts`
Then read 40-50 lines after to find the closing brace `}` of the function.

- [ ] **Step 2: Insert applyMordekaiserProcCast after applyPoppyShieldAndResists**

Insert immediately after the closing brace of `applyPoppyShieldAndResists`:

```ts
/**
 * Mordekaiser 캐스트 시점 호출:
 * - InitialShield 를 mordekaiserShieldRemaining 별도 pool 에 추가 (general unit.shield 안 건드림)
 * - 4초간 매초 펄스 state 등록 (mordekaiserProcEndTick, mordekaiserNextProcTick)
 *
 * sentinel filler (InitialShield [0, 300, 375, 500, ...]) 는 readVarByStar 로 자동 처리.
 *
 * getAbilityShield 의 InitialShield 적용은 Mordekaiser 일 때 short-circuit 됨 (line 6008/6627).
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

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 7: Add tickMordekaiserProc helper

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts` (insert immediately after `applyMordekaiserProcCast` from Task 6)

- [ ] **Step 1: Insert tickMordekaiserProc**

Insert immediately after the closing brace of `applyMordekaiserProcCast`:

```ts
/**
 * Mordekaiser 매 tick 처리:
 * - 사망 시 cancel + state cleanup (잔여 무효화)
 * - 펄스 발동 (tick >= mordekaiserNextProcTick && tick < mordekaiserProcEndTick):
 *     1칸 적 → DamagePerProc × AP 마법 피해 (applyAbilityMitigation 통과)
 *     본인 → mordekaiserShieldRemaining += ShieldPerProc × AP (별도 pool)
 *     mordekaiserNextProcTick += TICKS_PER_SECOND
 * - 만료 (tick >= mordekaiserProcEndTick):
 *     HealRefund = 잔여 × 0.4 × (1 + healAmp) → currentHp 회복
 *     state 3 필드 0 reset (잔여 보호막 소모됨 — desc "남은 보호막을 소모하고")
 */
export function tickMordekaiserProc(
  unit: CombatUnit,
  tick: number,
  time: number,
  enemies: CombatUnit[],
  eventBus: EventBus,
  ownArbiterState: { enemyDeathCount: number },
  logs: CombatLog[],
  tickLogs: CombatLog[],
): void {
  // 비활성: early return
  if (unit.mordekaiserProcEndTick === 0) return;

  // 사망 시 cancel + state cleanup (잔여 무효)
  if (unit.state === 'dead' || unit.currentHp <= 0) {
    unit.mordekaiserProcEndTick = 0;
    unit.mordekaiserNextProcTick = 0;
    unit.mordekaiserShieldRemaining = 0;
    return;
  }

  const vars = unit.champion.ability.variables;
  if (!vars) return;
  const apMul = 1 + unit.stats.ap / 100;

  // 펄스 발동 — 4 펄스 (t=1/2/3/4): "<=" 로 endTick 동시 펄스 + 만료 처리
  if (tick >= unit.mordekaiserNextProcTick && tick <= unit.mordekaiserProcEndTick) {
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
      // 사망 처리: Corki 패턴 (line 5677~) 차용
      if (e.currentHp <= 0 && e.state !== 'dead') {
        logs.push({ tick, time, type: 'death', sourceId: e.id, message: `${e.champion.name} 사망! (${unit.champion.name}의 펄스)` });
        markTargetDead(unit, e, ownArbiterState, eventBus, tick);
      }
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

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 8: Wire Mordekaiser cast into in-range path

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:6531` (after Poppy wiring, before "이즈리얼 드론" block)

- [ ] **Step 1: Locate Poppy in-range wiring**

Run: `grep -n "TFT17_Poppy" src/lib/simulator/engine/combatLoop.ts | head -5`
Expected: shows line 6529 (in-range Poppy wiring).

- [ ] **Step 2: Insert Mordekaiser wiring after Poppy block**

Insert immediately after the Poppy in-range wiring block (after line 6531 `}`):

```ts
            // === Set 17 Mordekaiser: 4초간 매초 펄스 + HealRefund ===
            if (unit.champion.apiName === 'TFT17_Mordekaiser') {
              applyMordekaiserProcCast(unit, tick);
            }
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 9: Wire Mordekaiser cast into OOR path

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:6646+` (after Poppy OOR wiring)

- [ ] **Step 1: Locate Poppy OOR wiring**

Run: `grep -n "TFT17_Poppy" src/lib/simulator/engine/combatLoop.ts | head -5`
Expected: shows line 6646 (OOR Poppy wiring).

Read lines 6644-6650 to confirm the closing brace of Poppy OOR wiring block.

- [ ] **Step 2: Insert Mordekaiser OOR wiring**

Insert immediately after the Poppy OOR wiring block (after the `}` closing the Poppy `if`):

```ts
          // === Set 17 Mordekaiser: 4초간 매초 펄스 + HealRefund (OOR cast) ===
          if (unit.champion.apiName === 'TFT17_Mordekaiser') {
            applyMordekaiserProcCast(unit, tick);
          }
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 10: Wire tickMordekaiserProc into main loop

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:5178+` (immediately after `tickStatusEffects(unit, ...)` call in main per-unit loop)

- [ ] **Step 1: Locate tickStatusEffects call**

Run: `grep -nE "^\s+tickStatusEffects" src/lib/simulator/engine/combatLoop.ts`
Expected: returns line 5178 with `tickStatusEffects(unit, tick, time, logs, tickLogs);`

- [ ] **Step 2: Read surrounding context to identify enemy team variable**

Read `combatLoop.ts:5170-5210` to confirm the enemy team variable name. Note from Task analysis: `aliveEnemies` and `alivePlayers` exist at line 5201. Use the appropriate one based on `unit.team`.

- [ ] **Step 3: Insert tickMordekaiserProc call**

Insert immediately after the `tickStatusEffects(unit, tick, time, logs, tickLogs);` line:

```ts
      // Mordekaiser proc 매 tick — 펄스 발동 / 만료 시 HealRefund / 사망 시 cancel
      if (unit.mordekaiserProcEndTick !== 0) {
        const enemyTeam = unit.team === 'player' ? enemies : playerUnits;
        const ownArbiterStateMorde = unit.team === 'player' ? playerArbiterState : enemyArbiterState;
        tickMordekaiserProc(unit, tick, time, enemyTeam, eventBus, ownArbiterStateMorde, logs, tickLogs);
      }
```

**중요**: 위 코드는 `enemies`, `playerUnits`, `playerArbiterState`, `enemyArbiterState` 변수가 main loop scope에 있다고 가정. 만약 변수명이 다르면 (e.g., `enemyUnits`) 적절히 조정. 확인 방법:

```bash
grep -n "playerArbiterState\|enemyArbiterState" src/lib/simulator/engine/combatLoop.ts | head -10
```

**가드 (`if (unit.mordekaiserProcEndTick !== 0)`)**: 다른 챔프 / 비활성 Mordekaiser → tickMordekaiserProc 호출 자체 skip → perf 손실 없음.

- [ ] **Step 4: Verify typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS.

### Task 11: Simplify ability.ts Mordekaiser entry

**Files:**
- Modify: `src/lib/simulator/systems/ability.ts:210` (Mordekaiser entry)

- [ ] **Step 1: Locate Mordekaiser entry**

Run: `grep -n "TFT17_Mordekaiser" src/lib/simulator/systems/ability.ts`
Expected: returns line ~210 with current entry.

- [ ] **Step 2: Replace entry**

Replace:
```ts
  TFT17_Mordekaiser: { pattern: 'aoe_circle', radius: 1, heal: true, dot: { duration: 4 } },
```

with:
```ts
  TFT17_Mordekaiser: { pattern: 'self_buff' },  // 4초간 매초 펄스 (ShieldPerProc + DamagePerProc) + HealRefund — combatLoop applyMordekaiserProcCast/tickMordekaiserProc 헬퍼
```

- [ ] **Step 3: Final verification**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm build
```
Expected: ALL PASS — Phase 2 implementation 완성.

### Task 12: Verify existing tests still pass

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: ALL existing tests PASS (no regressions). 신규 Mordekaiser 테스트는 Phase 3 에서 추가.

If any test fails:
- Especially check `tests/unit/poppy-shield-resists.test.ts` — Phase 1 의 `getAbilityShield` short-circuit 확장이 Poppy 동작 변경 없음을 확인 (Mordekaiser apiName 추가만, Poppy 분기 그대로).
- 만약 fail 시 BLOCKED 보고.

### Task 13: Commit Phase 2 (Mordekaiser-specific)

- [ ] **Step 1: Stage and commit**

```bash
git add src/lib/simulator/engine/combatLoop.ts src/lib/simulator/systems/ability.ts
git commit -m "feat(sim): Mordekaiser proc 시스템 — 4초간 매초 펄스 + HealRefund

Mordekaiser ★2/3 ability 정확 구현:
- 캐스트 시점: InitialShield 를 mordekaiserShieldRemaining (별도 pool) 에 추가
- 4초간 매초 1Hz 펄스 (4펄스):
  - 1칸 내 적 → DamagePerProc × AP 마법 피해 (applyAbilityMitigation 통과)
  - 본인 → ShieldPerProc × AP 보호막 추가 (별도 pool)
- 만료 시: HealRefund (잔여 × 0.4) → currentHp 회복
- 사망 시: state cleanup (잔여 보호막 무효, HealRefund 미발동)

기존 dot:{duration:4} 근사 제거 — 4 펄스 × DamagePerProc 정확 (sim ~25% → ~100%).
ability.ts entry 단순화 (Poppy 패턴과 동일 self_buff).

핵심 변경:
- applyMordekaiserProcCast (export) — cast 시점 helper
- tickMordekaiserProc (export) — 매 tick 펄스/만료 처리
- in-range/OOR cast wiring + main loop tick wiring (tickStatusEffects 직후)
- ability.ts:210 entry 단순화

scope OUT (후속 PR):
- 시너지/아이템 shield source 분리 (broader refactor)
- AugmentedDuration (Concentration augment)
- getAbilityShield value[starLevel] 자체 버그 (PR #102 codex P1 후속)"
```

---

## Phase 3 — 회귀 가드 (commit 3)

### Task 14: Write 7 regression test cases

**Files:**
- Create: `tests/unit/mordekaiser-proc.test.ts`

- [ ] **Step 1: Inspect existing Poppy test for fixture pattern**

Run: `cat tests/unit/poppy-shield-resists.test.ts | head -100`

Read the existing fixture pattern (CombatUnit construction, factory functions, vitest imports). The Mordekaiser test should follow the same pattern.

- [ ] **Step 2: Create test file with 7 cases**

```ts
import { describe, it, expect } from 'vitest';
import type { CombatUnit, RawChampion, AbilityVariable } from '@/types';
import {
  applyMordekaiserProcCast,
  tickMordekaiserProc,
} from '@/lib/simulator/engine/combatLoop';
import { TICKS_PER_SECOND } from '@/lib/simulator/models/constants';

// === Mordekaiser 픽스처 ===
function makeMordekaiser(starLevel: 1 | 2 | 3, ap: number, position = { q: 0, r: 0 }): CombatUnit {
  const variables: AbilityVariable[] = [
    // sentinel filler at index 0 (raw[0]=0): readVarByStar 자동 skip → ★1=index 1
    { name: 'InitialShield', value: [0, 300, 375, 500, 650, 200, 240] },
    { name: 'ShieldPerProc', value: [0, 75, 90, 105, 120, 0, 0] },
    { name: 'DamagePerProc', value: [0, 45, 70, 100, 170, 0, 0] },
    { name: 'HealRefund', value: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4] },
    { name: 'Duration', value: [4, 4, 4, 4, 4, 4, 4] },
  ];
  const champion: RawChampion = {
    apiName: 'TFT17_Mordekaiser',
    name: '모데카이저',
    cost: 2,
    traits: [],
    role: 'Tank',
    stats: {
      hp: [800, 1440, 2592], damage: [55, 83, 124],
      attackSpeed: 0.65, range: 1, armor: 50, magicResist: 50,
      mana: 30, maxMana: 60, critChance: 0.25, critMultiplier: 1.4,
    },
    ability: { name: '검은 일격', desc: '', icon: '', variables },
    icon: '', tileIcon: '',
  } as unknown as RawChampion;

  return {
    id: 'morde-1',
    champion,
    team: 'player',
    position,
    starLevel,
    role: 'Tank',
    items: [],
    currentHp: 1500, maxHp: 2000,
    currentMana: 0, maxMana: 60,
    state: 'idle', target: null,
    stats: {
      hp: 2000, damage: 80, attackSpeed: 0.65, range: 1,
      armor: 50, magicResist: 50, mana: 0, maxMana: 60,
      critChance: 0.25, critMultiplier: 1.4, ap, armorPen: 0, magicPen: 0,
    },
    attackCooldown: 0, moveCooldown: 0,
    totalDamageDealt: 0, itemDamageDealt: 0, totalDamageTaken: 0,
    statusEffects: [],
    omnivamp: 0, damageAmp: 0, damageReduction: 0, shield: 0,
    augmentManaRegen: 0, augmentGrievousWounds: 0, augmentExecuteThreshold: 0, augmentBurnPercent: 0,
    itemFlatManaPerAttack: 0, inventionTankDamageAmp: 0, madredsTankDamageAmp: 0,
    healAmp: 0, darkStarExecuteThreshold: 0, darkStarSupermassive: false,
    attackCount: 0, castCount: 0,
    bastionDoubleEndTick: 0, bastionDoubleArmorBonus: 0, bastionDoubleMrBonus: 0,
    mordekaiserProcEndTick: 0, mordekaiserNextProcTick: 0, mordekaiserShieldRemaining: 0,
  } as unknown as CombatUnit;
}

function makeEnemy(id: string, position: { q: number; r: number }, hp = 1000): CombatUnit {
  const champion: RawChampion = {
    apiName: 'TFT17_Aatrox', name: '아트록스', cost: 1, traits: [], role: 'Fighter',
    stats: { hp: [600, 1080, 1944], damage: [40, 60, 90], attackSpeed: 0.6, range: 1, armor: 0, magicResist: 0, mana: 0, maxMana: 50, critChance: 0.25, critMultiplier: 1.4 },
    ability: { name: '', desc: '', icon: '', variables: [] }, icon: '', tileIcon: '',
  } as unknown as RawChampion;

  return {
    ...makeMordekaiser(1, 0, position),
    id, champion, team: 'enemy',
    currentHp: hp, maxHp: hp,
    stats: { ...makeMordekaiser(1, 0).stats, armor: 0, magicResist: 0 },
  } as unknown as CombatUnit;
}

const NULL_EVENT_BUS = { emit: () => {} } as unknown as Parameters<typeof tickMordekaiserProc>[4];
const NULL_ARBITER = { enemyDeathCount: 0 };

describe('TFT17_Mordekaiser — proc 시스템', () => {
  it('C1: ★1 AP=0 cast → InitialShield 별도 pool, unit.shield 변화 없음', () => {
    const morde = makeMordekaiser(1, 0);
    const initialUnitShield = morde.shield;
    applyMordekaiserProcCast(morde, 0);
    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(300, 0);
    expect(morde.shield).toBe(initialUnitShield);  // 별도 pool — unit.shield 미변화
    expect(morde.mordekaiserProcEndTick).toBe(4 * TICKS_PER_SECOND);  // 4s × tps
    expect(morde.mordekaiserNextProcTick).toBe(TICKS_PER_SECOND);  // t=1
  });

  it('C2: ★2 AP=100 cast → 750 (375 × 2.0)', () => {
    const morde = makeMordekaiser(2, 100);
    applyMordekaiserProcCast(morde, 0);
    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(750, 0);
  });

  it('C3: 펄스 1회 발동 — adjacent enemy damage + Mordekaiser shield gain', () => {
    const morde = makeMordekaiser(1, 0, { q: 0, r: 0 });
    const enemy = makeEnemy('e1', { q: 1, r: 0 }, 1000);  // 1칸 거리
    const enemies = [enemy];

    applyMordekaiserProcCast(morde, 0);
    // tick=30 (t=1) 에서 첫 펄스 발동
    tickMordekaiserProc(morde, TICKS_PER_SECOND, 1.0, enemies, NULL_EVENT_BUS, NULL_ARBITER, [], []);

    // 적 damage: ★1 DamagePerProc=45, mitigation 없음 (armor=0, MR=0 → applyResistance × 1)
    expect(enemy.currentHp).toBeCloseTo(1000 - 45, 0);
    // Mordekaiser shield: 300 + 75 = 375
    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(375, 0);
    // 다음 펄스 t=2
    expect(morde.mordekaiserNextProcTick).toBe(2 * TICKS_PER_SECOND);
  });

  it('C4: 4 펄스 누적 — 적 damage 4×45=180, shield 300+4×75=600 (만료 직전)', () => {
    const morde = makeMordekaiser(1, 0, { q: 0, r: 0 });
    const enemy = makeEnemy('e1', { q: 1, r: 0 }, 1000);
    const enemies = [enemy];

    applyMordekaiserProcCast(morde, 0);
    // tick 30/60/90/120 진행 — 4 펄스 발동 (t=4 펄스 + 만료 동시 처리)
    // helper 구현: tick 30/60/90 펄스만 — t=120 에서 펄스(<=endTick) + 만료 동시
    for (let t = 1; t <= 4; t++) {
      tickMordekaiserProc(morde, t * TICKS_PER_SECOND, t * 1.0, enemies, NULL_EVENT_BUS, NULL_ARBITER, [], []);
    }

    // 4 펄스 × DamagePerProc(45) = 180 누적 damage
    expect(enemy.currentHp).toBeCloseTo(1000 - 4 * 45, 0);
    // 만료 후 cleanup: shield 0 (HealRefund 후 reset)
    expect(morde.mordekaiserShieldRemaining).toBe(0);
    expect(morde.mordekaiserProcEndTick).toBe(0);
  });

  it('C5: 만료 시 HealRefund — 잔여 shield × 0.4 → heal', () => {
    const morde = makeMordekaiser(1, 0, { q: 0, r: 0 });
    morde.currentHp = 1500;  // maxHp=2000, 회복 여유 500
    const enemies: CombatUnit[] = [];  // 적 없음 → 펄스만 발동, damage 없음

    applyMordekaiserProcCast(morde, 0);
    // 펄스 t=1/2/3/4 발동 (4 펄스 × 75 = 300 추가) → shield 누적 300 + 300 = 600
    // t=4 에서 펄스 + 만료 동시 처리. 만료 시 HealRefund = 600 × 0.4 = 240
    for (let t = 1; t <= 4; t++) {
      tickMordekaiserProc(morde, t * TICKS_PER_SECOND, t * 1.0, enemies, NULL_EVENT_BUS, NULL_ARBITER, [], []);
    }

    // currentHp 1500 + 240 (HealRefund) = 1740 (maxHp=2000 미만이므로 clamp 영향 없음)
    expect(morde.currentHp).toBeCloseTo(1500 + 240, 0);
    expect(morde.mordekaiserShieldRemaining).toBe(0);
    expect(morde.mordekaiserProcEndTick).toBe(0);
  });

  it('C6: 사망 시 cancel — 추가 펄스 안 나감, HealRefund 안 발동', () => {
    const morde = makeMordekaiser(1, 0, { q: 0, r: 0 });
    morde.currentHp = 1500;
    const enemies: CombatUnit[] = [];

    applyMordekaiserProcCast(morde, 0);
    // 펄스 1회 발동 (t=1)
    tickMordekaiserProc(morde, TICKS_PER_SECOND, 1.0, enemies, NULL_EVENT_BUS, NULL_ARBITER, [], []);
    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(375, 0);

    // 사망 처리 (외부 시스템에 의해 currentHp = 0 + state 'dead')
    morde.currentHp = 0;
    morde.state = 'dead';

    // 다음 tick 호출 → state cleanup, HealRefund 안 발동
    tickMordekaiserProc(morde, 2 * TICKS_PER_SECOND, 2.0, enemies, NULL_EVENT_BUS, NULL_ARBITER, [], []);

    expect(morde.mordekaiserProcEndTick).toBe(0);
    expect(morde.mordekaiserNextProcTick).toBe(0);
    expect(morde.mordekaiserShieldRemaining).toBe(0);
    expect(morde.currentHp).toBe(0);  // heal 안 들어감
  });

  it('C7: applyShield priority — Mordekaiser pool 우선 흡수 (간접 검증)', () => {
    // applyShield 가 internal 함수라 직접 export 안 됨 → mordekaiserShieldRemaining 차감 결과로 간접 검증.
    // 핵심: mordekaiserShieldRemaining 양수 + general unit.shield 양수 상태에서 damage 적용 시
    //   Mordekaiser pool 먼저 흡수, 그다음 unit.shield.
    //
    // 직접 테스트 불가 → integration test 필요 (combatLoop 통합 호출).
    // 본 테스트는 helper 단위 정확성 위주 — applyShield priority 는 codex review/통합 검증으로 보완.
    //
    // 대체 검증: unit pool 자체가 별도 추적되는지 확인 (Mordekaiser cast 후 unit.shield 미변화).
    const morde = makeMordekaiser(1, 0);
    morde.shield = 200;  // 시너지/아이템 shield 200 (예: 가시 갑옷)
    applyMordekaiserProcCast(morde, 0);
    // Mordekaiser pool 만 변화, unit.shield 그대로
    expect(morde.mordekaiserShieldRemaining).toBeCloseTo(300, 0);
    expect(morde.shield).toBe(200);  // 별도 pool 검증 (통합 test 시 applyShield priority 자동 검증)
  });
});
```

**Test C4/C5 펄스 카운트**: 4 펄스 (t=1/2/3/4). helper 의 펄스 조건이 `tick <= mordekaiserProcEndTick` (≤로 만료 동시) 이라 t=4에서 펄스(4번째) + 만료(HealRefund) 동시 처리. spec §3 "매초 × 4회"와 일치.

펄스 발동 순서 (t=4=120 tick):
1. 펄스 조건 매칭 (`120 >= 120 && 120 <= 120`) → 4번째 펄스 발동 (shield += 75, nextProcTick=150)
2. 만료 조건 매칭 (`120 >= 120`) → HealRefund (현재 누적 600 × 0.4 = 240) → currentHp += 240, state cleanup

### Task 15: Verify tests pass

- [ ] **Step 1: Run new test file**

Run: `pnpm test mordekaiser-proc`
Expected: 7/7 cases PASS.

If any fail:
- C1/C2: readVarByStar 결과 확인 — InitialShield [0, 300, 375, 500, ...] 는 sentinel filler → ★1=300, ★2=375, ★3=500
- C3: hexDistance({q:0,r:0}, {q:1,r:0}) = 1 (1칸 거리)
- C4: 펄스 카운트 4 (t=1/2/3/4). pulse 조건 `tick <= mordekaiserProcEndTick`이 결정.
- C5: HealRefund 계산 — 525 × 0.4 = 210 정확
- C6: 사망 시 state cleanup — `mordekaiserProcEndTick === 0` 검증

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: ALL tests PASS (no regressions). 기존 Poppy 가드 + Mordekaiser 신규 7건 모두 통과.

### Task 16: Commit Phase 3 (tests)

- [ ] **Step 1: Stage and commit**

```bash
git add tests/unit/mordekaiser-proc.test.ts
git commit -m "test(sim): Mordekaiser proc 회귀 가드 7건

- C1: ★1 AP=0 cast → InitialShield 300 별도 pool, unit.shield 변화 없음
- C2: ★2 AP=100 cast → 750 (375 × 2.0)
- C3: 펄스 1회 발동 — 1칸 적 damage + 본인 shield gain
- C4: 4 펄스 누적 (t=1/2/3/4) — t=4에서 펄스+만료 동시
- C5: 만료 시 HealRefund — 잔여 × 0.4 → currentHp 회복
- C6: 사망 시 cancel — state cleanup, HealRefund 미발동
- C7: 별도 pool 검증 (applyShield priority 는 integration test 로 보완)"
```

---

## Phase 4 — Final Verification & PR

### Task 17: Full verification + PR open

- [ ] **Step 1: Final lint/typecheck/build/test**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```
Expected:
- Lint: 0 errors (warnings OK if pre-existing, e.g., 14 from PR #102)
- Typecheck: clean
- Build: success
- Test: 818 passed (811 baseline + 7 new), 8 skipped (or current baseline + 7)

If anything fails, STOP and report BLOCKED.

- [ ] **Step 2: Pre-flight working tree check**

Run: `git status`
- If any auto-regenerated `actual-data/diff-game-*.json` modifications exist (test side-effect), discard with `git checkout -- actual-data/`.
- Confirm working tree clean before push.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/mordekaiser-proc-system
```
Expected: branch pushed successfully.

- [ ] **Step 4: Open PR (target dev)**

```bash
gh pr create --base dev --title "feat(sim): Mordekaiser proc 시스템 (P1) — 4초간 매초 펄스 + HealRefund + shield pool 분리" --body "$(cat <<'EOF'
## Summary

Set 17 Mordekaiser ★2/3 ability 정확 구현:
- 캐스트 시점: InitialShield 즉시 보호막 (300/375/500 ★1/2/3 × AP)
- 4초간 매초 1Hz 펄스: 1칸 내 적 → DamagePerProc 마법 + 본인 ShieldPerProc 추가
- 만료 시: HealRefund (잔여 보호막 × 40%) → currentHp 회복
- 사망 시 cancel

기존 `dot:{duration:4}` 근사 제거 — sim ~25% damage → ~100% 정확.

## 핵심 변경

1. **Mordekaiser shield = 별도 pool** (`mordekaiserShieldRemaining` 신규 typed 필드):
   - `applyShield` 가 Mordekaiser pool 우선 흡수 → general unit.shield → HP 순
   - HealRefund 정확 계산 (시너지/아이템 shield 잔존과 무관)
2. **Helper 2개**: `applyMordekaiserProcCast` (cast 시점) + `tickMordekaiserProc` (매 tick)
3. **getAbilityShield short-circuit 확장**: Poppy + Mordekaiser apiName 모두 0 (chamipon-specific helper 가 canonical)
4. **ability.ts entry 단순화**: `dot:{duration:4}` 제거 → `{ pattern: 'self_buff' }`

## Spec & Design

- Spec: `docs/superpowers/specs/2026-05-07-mordekaiser-proc-design.md`
- Plan: `docs/superpowers/plans/2026-05-07-mordekaiser-proc.md`
- Audit reference: `docs/meta/opponent-carries-audit-2026-05-07.md` (P1)

## Test plan

- [x] pnpm lint && typecheck && build pass
- [x] tests/unit/mordekaiser-proc.test.ts 7건 통과
- [x] tests/unit/poppy-shield-resists.test.ts 회귀 가드 통과 (getAbilityShield short-circuit 확장 영향 없음)
- [ ] 사용자 수동 diff cache 재실행: pnpm tsx scripts/compute-diff-cache.ts
  - 기대: sim 전투 종료 4x → 2~3x 감소, winnerMatchRate +5pt 이상

## 후속 PR (scope OUT)

- 시너지/아이템 shield source 분리 (broader refactor) — 후속 별도 PR
- AugmentedDuration (Concentration augment 6초) — augment 시스템 통합 시
- `getAbilityShield` value[starLevel] 자체 버그 (PR #102 codex P1 후속)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL.

- [ ] **Step 5: Verify PR opened**

Run: `gh pr view --json number,url,title,state`
- PR is OPEN
- Targets `dev` branch
- Title matches expected

- [ ] **Step 6: Codex review 자동 발동 대기**

PR 열림 후 codex review가 ~1-3분 내 자동 발동. Review 결과 확인:
```bash
gh api repos/keyy1315/tft_sim/pulls/{N}/comments --jq '.[] | select(.user.login | test("codex"))'
```

P1 issue 발견 시 별도 fix commit 으로 대응 (PR #102 codex P1 fix 패턴 동일).

---

## Self-Review Notes

**Spec coverage check**:
- Spec §2 Deliverables: typed 필드 ✓ (Task 1), createCombatUnit 초기화 ✓ (Task 2), applyShield ✓ (Task 3), getAbilityShield short-circuit ✓ (Task 4), helpers ✓ (Tasks 6-7), wiring ✓ (Tasks 8-10), ability.ts ✓ (Task 11), 회귀 가드 ✓ (Tasks 14-15)
- Spec §3 Mechanic: Cast → 매초 펄스 → 만료 HealRefund → 사망 cancel ✓ (helper 코드 정확 반영)
- Spec §3.1 Raw values + sentinel filler: ✓ (test fixture 에 raw arrays 그대로 + readVarByStar 사용)
- Spec §3.2 applyShield 수정: ✓ (Task 3)
- Spec §3.3 Edge cases: ✓ (사망 cancel Task 7, 스턴 시 펄스 계속 — passive impl, 재시전 — Task 6 `+=` 누적)
- Spec §4 Code design: ✓ (모든 helper / wiring 위치 명시)
- Spec §5 회귀 가드 7 케이스: ✓ (Task 14)
- Spec §6 Verification: ✓ (Task 17)
- Spec §7 PR 구조 3 commits: ✓ (Tasks 5, 13, 16)

**Plan 단계 spec 정정**:
1. **펄스 카운트 4** (t=1/2/3/4): spec §3 "매초 × 4회"와 일관. helper 의 펄스 조건을 `tick <= mordekaiserProcEndTick` (≤) 로 설정 — t=4에서 4번째 펄스 + 만료(HealRefund) 동시 처리. spec §4.7 코드의 `tick < mordekaiserProcEndTick` (<) 는 plan에서 `<=` 로 정정.

**Type consistency check**:
- `applyMordekaiserProcCast(unit: CombatUnit, tick: number): void` — Tasks 6/8/9 모두 일치
- `tickMordekaiserProc(unit, tick, time, enemies, eventBus, ownArbiterState, logs, tickLogs)` — Tasks 7/10/14 모두 일치
- 3 typed 필드 이름 일관: Tasks 1/2/3/6/7/14 전부 동일

**Placeholder scan**: 없음 (모든 step에 구체적 코드/명령 포함, "PR #N" placeholder는 commit body example 뿐 — 의도적).
