# Opponent Carries ★ Audit + Poppy Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set 17 opponent carries(Lissandra/Veigar/Mordekaiser/Poppy/Illaoi) ★3 ability sim 정확도 진단 보고서 + Poppy Shield/ally Resists 정확 구현 + 회귀 가드 6건.

**Architecture:** 5명 진단 보고서(`docs/meta/`)를 commit 1으로, Poppy 챔프별 분기(`combatLoop.ts`)와 `StatusEffectType 'resists-buff'` 추가를 commit 2로, 회귀 가드 6 케이스를 commit 3으로 분리. 만료 처리는 직접 stat 수정 + line 3014 shield cleanup 패턴 차용 (status effect 조회 기반 미적용 — 82개 read site 변경 회피).

**Tech Stack:** TypeScript, Vitest, Next.js 15 App Router

---

## Spec Reference

`docs/superpowers/specs/2026-05-07-opponent-carries-audit-design.md`

## File Structure

**New files:**
- `docs/meta/opponent-carries-audit-2026-05-07.md` — 5명 진단 보고서
- `tests/unit/poppy-shield-resists.test.ts` — 6 회귀 가드 케이스

**Modified files:**
- `src/types/index.ts` line 417 — `StatusEffectType` union에 `'resists-buff'` 추가
- `src/lib/simulator/systems/ability.ts` line 184 — Poppy entry 단순화
- `src/lib/simulator/engine/combatLoop.ts`:
  - line 53 `STATUS_EFFECT_LABELS` — `'resists-buff'` 라벨 추가
  - 새 helper function `applyPoppyShieldAndResists` (line 843 `applyResistance` 인근에 배치)
  - line 3010-3028 expired effect cleanup — `'resists-buff'` 만료 시 stats 복원
  - line 6366-6380 in-range cast handler 직후 — Poppy 분기 추가
  - line 6481-6488 OOR cast handler 직후 — Poppy 분기 추가

---

## Phase A — Diagnostic Report (commit 1)

### Task 1: Read raw data + sim config for 5 champions

**Files:**
- Read: `public/data/tft_set17_champions.json`
- Read: `src/lib/simulator/systems/ability.ts:182-216`

- [ ] **Step 1: Extract raw variables for 5 champs**

Run:
```bash
python3 -c "
import json
data = json.load(open('public/data/tft_set17_champions.json'))
targets = ['TFT17_Lissandra', 'TFT17_Veigar', 'TFT17_Mordekaiser', 'TFT17_Poppy', 'TFT17_Illaoi']
for c in data['champions']:
    if c.get('apiName') in targets:
        ab = c.get('ability', {}) or {}
        print(f'=== {c[\"apiName\"]} ({c.get(\"name\")}) ===')
        for v in (ab.get('variables', []) or []):
            print(f'  {v.get(\"name\")}: {v.get(\"value\")}')
        print()
"
```
Expected: prints variables array for all 5 champs.

- [ ] **Step 2: Apply readVarByStar logic (sentinel filler) for each var**

For each variable: check `isFiller = v[0] === 0 || v[0] > v[1] || v[1]/v[0] > 5`. If filler, ★1=index 1, else ★1=index 0. Record ★1/★2/★3 values.

Reference: `combatLoop.ts:171-181`.

- [ ] **Step 3: Identify each champ's sim config**

Read `ability.ts` entries:
- TFT17_Lissandra (line 195): `{ pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'SecondaryDamage' }`
- TFT17_Veigar (line 185): `{ pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'MiniDamage' }`
- TFT17_Mordekaiser (line 210): `{ pattern: 'aoe_circle', radius: 1, heal: true, dot: { duration: 4 } }`
- TFT17_Poppy (line 184): `{ pattern: 'self_buff', selfBuff: { durability: 0.2, duration: 4 } }`
- TFT17_Illaoi (line 215): `{ pattern: 'aoe_circle', radius: 2, heal: true, dot: { duration: 3 } }`

### Task 2: Write diagnostic report

**Files:**
- Create: `docs/meta/opponent-carries-audit-2026-05-07.md`

- [ ] **Step 1: Create file with header + Summary table**

```markdown
# Opponent Carries ★ Audit — 2026-05-07

> game-20260423-001 baseline의 4x sim duration mismatch 해소 작업 진단 보고서.
> 후속 patch attribution: `docs/meta/diff-attribution-2026-05-06-followup.md`

## Summary

| 챔프 | game-1 ★/R | Gap 카테고리 | Severity | 본 PR fix? | 후속 P |
|------|:---:|----|:---:|:---:|:---:|
| Lissandra | ★1/2/3, 14R | A,D | 🟢 | - | P2 |
| Veigar | ★2, 4R | A,E | 🟡 | - | P3 |
| Mordekaiser | ★2, 4R | C (proc trigger) | 🔴 | - | **P1** |
| Poppy | ★1/2/3, 10R | B + A (ally Resists) | 🔴 | ✅ | - |
| Illaoi | ★1, 3R | A (NumEnemies) | 🟡 | - | P3 |

## Methodology

각 챔프에 대해 3개 소스를 교차 비교:
1. Raw data (`public/data/tft_set17_champions.json` → `ability.variables`)
2. Sim config (`src/lib/simulator/systems/ability.ts` `ABILITY_DEFS[TFT17_X]`)
3. Sim execution (`combatLoop.ts` 핸들러)

★별 변수 값은 `readVarByStar` (line 171) 의 sentinel filler 컨벤션 적용.

Gap 카테고리:
- **A**: 변수 미소비 (raw 변수 존재 but sim 무시)
- **B**: 변수 잘못 사용 (sim 하드코딩 또는 다른 변수 fallback)
- **C**: Mechanic mismatch (proc vs DOT 등 메커니즘 자체 오류)
- **D**: ★ scaling 불일치
- **E**: 시너지 interaction 누락 (Astronaut 등)
```

- [ ] **Step 2: Append per-champion sections**

For each champ, write:
```markdown
### TFT17_X (코스트, ★/R)

**Raw data variables** (★1/2/3, sentinel filler resolved):
| Var | ★1 | ★2 | ★3 | Sim usage |
|-----|----|----|----|----|
| ... | ... | ... | ... | ✅/❌ |

**Real mechanic** (raw `desc` 해석):
- (간단 한 문단)

**Sim config** (`ability.ts:line N`):
- `pattern: ..., damageVar: ..., ...`

**Verdict**: 🟢/🟡/🔴
- 발견 사항 1
- 발견 사항 2

**Severity**: ...
**후속 PR 우선순위**: P1/P2/P3 또는 N/A
```

Concrete content per champ:

**Lissandra (1코, ★1/2/3, 14R)** — 🟢 P2:
- Variables ★1/2/3: Damage [200, 250, 375], SecondaryDamage [50, 75, 115] (sentinel filler)
- Sim: aoe_circle r=1 + secondaryDamageVar='SecondaryDamage'
- Verdict: 변수 모두 consumed. ★3 raw values 정확성 정밀 검증은 후속 P2.

**Veigar (1코, ★2, 4R)** — 🟡 P3:
- Variables ★1/2/3: Damage [250, 310, 465], MiniDamage [31, 47, 70] (sentinel filler), MiniMeepsPerAstro [2, 2, 2]
- Sim: aoe_circle r=1 + MiniDamage secondary
- Verdict: 🟡 Astronaut MeepsPerAstro 시너지 interaction 미구현 (Astronaut 활성 시 미니유성 갯수 변화 누락).

**Mordekaiser (2코, ★2, 4R)** — 🔴 **P1**:
- Variables ★1/2/3: InitialShield [300, 375, 500], ShieldPerProc [75, 90, 105], DamagePerProc [45, 70, 100], HealRefund=0.4 (40%), Duration=4
- Real mechanic: InitialShield 보호막 + 4초 동안 평타당 N회 proc → DamagePerProc 광역 마법 + ShieldPerProc 보호막 보충 + HealRefund 회복.
- Sim: aoe_circle r=1 + heal + DOT 4s.
- Verdict: 🔴 **proc trigger를 DOT로 잘못 근사**. 실제는 평타당(1~2회/s) 발동, sim은 매 tick 1회 (DOT total / duration). 시간당 발동 수 mismatch → damage shortfall.
- 후속 PR P1: DOT → on-attack proc 변환.

**Poppy (1코, ★1/2/3, 10R)** — 🔴 **이번 PR fix**:
- Variables ★1/2/3: Shield [300, 400, 475], ShieldDuration=4, Resists [15, 25, 60] (sentinel filler 핵심), MeepShield [100, 125, 160], MeepsPerAstro=1
- Real mechanic: Shield 보호막 + 2칸 내 아군 방어력+마법저항 +Resists.
- Sim (현재): self_buff + durability 0.2 / 4s 하드코딩 → Shield 변수 무시 + ally Resists 완전 미구현.
- Fix (이 PR): Shield 변수 + AP scaling, ally Resists buff 2칸 radius, MeepShield/MeepsPerAstro Astronaut interaction은 scope OUT.

**Illaoi (3코, ★1, 3R)** — 🟡 P3:
- Variables ★1/2/3: Shield [250, 450, 525], Duration=3, HealthDrain [40, 55, 85], NumEnemies=3, Damage [80, 80, 120]
- Sim: aoe_circle r=2 + heal + DOT 3s.
- Verdict: 🟡 NumEnemies 미반영 (실제는 N명에서 흡수, sim은 단일 DOT). 마지막 Damage hit 누락 가능. 후속 P3.

- [ ] **Step 3: Append follow-up priority section + Verification**

```markdown
## 후속 PR 우선순위

1. **P1** (Critical): Mordekaiser proc 시스템 (DOT → on-attack proc) — 4R × ★2 영향
2. **P2** (Moderate): Lissandra ★3 raw values 정밀 검증 — 14R × 다양 ★
3. **P3** (Low): Veigar Astronaut MeepsPerAstro + Illaoi NumEnemies 다중 흡수 + Bard abduct

## Verification (this PR)

- pnpm lint && pnpm typecheck && pnpm build pass
- tests/unit/poppy-shield-resists.test.ts 6 케이스 통과
- 사용자 수동: pnpm tsx scripts/compute-diff-cache.ts 후 winnerMatchRate 변화 측정
```

- [ ] **Step 4: Commit docs**

```bash
git add docs/meta/opponent-carries-audit-2026-05-07.md
git commit -m "docs(meta): opponent carries ★ audit 2026-05-07 — 5명 진단 + 후속 P1~P3

- Lissandra/Veigar/Mordekaiser/Poppy/Illaoi 진단
- Severity 기반 후속 PR 우선순위 (P1=Mordekaiser proc, P2=Lissandra ★3, P3=Veigar/Illaoi)
- 본 PR scope: Poppy Shield + ally Resists 정확 구현"
```

---

## Phase B — Poppy Fix Implementation (commit 2)

### Task 3: Add 'resists-buff' to StatusEffectType + label

**Files:**
- Modify: `src/types/index.ts` line 417
- Modify: `src/lib/simulator/engine/combatLoop.ts` line 53

- [ ] **Step 1: Extend StatusEffectType union**

Edit `src/types/index.ts:417` — change:
```ts
export type StatusEffectType = 'stun' | 'slow' | 'burn' | 'shield' | 'invulnerable' | 'disarm' | 'taunt' | 'mark' | 'poison';
```
to:
```ts
export type StatusEffectType = 'stun' | 'slow' | 'burn' | 'shield' | 'invulnerable' | 'disarm' | 'taunt' | 'mark' | 'poison' | 'resists-buff';
```

- [ ] **Step 2: Add label entry**

Read `combatLoop.ts:53` STATUS_EFFECT_LABELS object. Add entry:
```ts
'resists-buff': '방어력+마법저항 버프',
```
(insert before closing brace; preserve existing entries)

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS (no new errors).

### Task 4: Add applyPoppyShieldAndResists helper function

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts` (new function near line 843 `applyResistance`)

- [ ] **Step 1: Add helper function**

Insert new function immediately AFTER the existing `applyResistance` function (line 843+). This co-locates damage/buff helpers in one area.

```ts
/**
 * Poppy 스킬 효과 적용:
 * - 본인: Shield 보호막 (AP scaling, ShieldDuration 만료)
 * - 2칸 내 아군: 방어력+마법저항 +Resists (AP scaling, ShieldDuration 만료)
 *
 * sentinel filler (Resists [36, 15, 25, 60, ...] 등) 는 readVarByStar 로 자동 처리.
 *
 * 만료 처리: 직접 stat 수정 + statusEffect 추적 + tickStatusEffects expired loop 에서 revert
 * (line 3014 shield cleanup 패턴 차용 — armor/MR read site 82개 변경 회피).
 */
function applyPoppyShieldAndResists(
  unit: CombatUnit,
  allies: CombatUnit[],
): void {
  const vars = unit.champion.ability.variables;
  if (!vars) return;
  const shieldBase = readVarByStar(
    vars.find(v => v.name === 'Shield')?.value, unit.starLevel, 0
  );
  const shieldDur = readVarByStar(
    vars.find(v => v.name === 'ShieldDuration')?.value, unit.starLevel, 4
  );
  const resistsBase = readVarByStar(
    vars.find(v => v.name === 'Resists')?.value, unit.starLevel, 0
  );
  const apMul = 1 + unit.stats.ap / 100;
  const shieldValue = shieldBase * apMul;
  const resistsValue = resistsBase * apMul;
  const durTicks = Math.round(shieldDur * TICKS_PER_SECOND);

  // Self shield (line 1080 warden / line 6477 OOR shield 패턴 차용)
  if (shieldValue > 0) {
    unit.shield += shieldValue;
    unit.statusEffects.push({
      type: 'shield',
      sourceId: 'poppy-shield',
      remainingTicks: durTicks,
      value: shieldValue,
    });
  }

  // Ally Resists buff (2칸 radius)
  if (resistsValue > 0) {
    for (const ally of allies) {
      if (ally.id === unit.id) continue;
      if (ally.state === 'dead') continue;
      if (hexDistance(unit.position, ally.position) > 2) continue;
      ally.stats.armor += resistsValue;
      ally.stats.magicResist += resistsValue;
      ally.statusEffects.push({
        type: 'resists-buff',
        sourceId: 'poppy-resists',
        remainingTicks: durTicks,
        value: resistsValue,
      });
    }
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 5: Wire helper into in-range cast handler

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:6366-6380`

- [ ] **Step 1: Insert Poppy call after self_buff/allyBuff handlers**

Locate line 6380 (closing brace of `if (config.allyBuff)` block in in-range cast). Insert immediately after:

```ts
            // === Set 17 Poppy: Shield + 2칸 내 아군 Resists ===
            if (unit.champion.apiName === 'TFT17_Poppy') {
              const allyTeam = unit.team === 'player' ? playerUnits : enemies;
              applyPoppyShieldAndResists(unit, allyTeam);
            }
```

Context (lines 6373-6381):
```ts
            // === 아군 전체 버프 ===
            if (config.allyBuff) {
              const allyTeam = unit.team === 'player' ? playerUnits : enemies;
              for (const ally of allyTeam) {
                if (ally.state === 'dead') continue;
                if (config.allyBuff.attackSpeed) ally.stats.attackSpeed *= (1 + config.allyBuff.attackSpeed);
              }
            }
            // ← INSERT HERE
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 6: Wire helper into OOR cast handler

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:6481-6488`

- [ ] **Step 1: Insert Poppy call after OOR self_buff handler**

Locate line 6488 (closing brace of `if (outOfRangeConfig.selfBuff)` block in OOR cast). Insert immediately after:

```ts
          // === Set 17 Poppy: Shield + 2칸 내 아군 Resists (OOR cast) ===
          if (unit.champion.apiName === 'TFT17_Poppy') {
            const allyTeamOOR = unit.team === 'player' ? playerUnits : enemies;
            applyPoppyShieldAndResists(unit, allyTeamOOR);
          }
```

Context (lines 6481-6489):
```ts
          // self_buff
          if (outOfRangeConfig.selfBuff) {
            if (outOfRangeConfig.selfBuff.attackSpeed) {
              unit.stats.attackSpeed *= (1 + outOfRangeConfig.selfBuff.attackSpeed);
            }
            if (outOfRangeConfig.selfBuff.ad) {
              unit.stats.damage += outOfRangeConfig.selfBuff.ad;
            }
          }
          // ← INSERT HERE
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 7: Add expired effect cleanup for 'resists-buff'

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:3010-3028`

- [ ] **Step 1: Add cleanup branch in tickStatusEffects expired loop**

Locate line 3014 (existing shield cleanup branch in `tickStatusEffects` expired loop). Add new branch immediately after:

Existing (lines 3010-3016):
```ts
  for (const effect of expired) {
    // shield statusEffect 만료 시 unit.shield 에서 잔존 amount 차감 (codex P1 회귀 가드).
    // applyShield 가 damage 흡수 시 unit.shield 만 줄어들어 statusEffect.value 와 desync 가능.
    // Math.max(0, ...) 로 over-subtract 방지 — broken 상태 (unit.shield=0) 시에도 안전.
    if (effect.type === 'shield' && effect.value) {
      unit.shield = Math.max(0, unit.shield - effect.value);
    }
```

Add after line 3016:
```ts
    // Poppy ally Resists buff 만료 시 stats.armor / stats.magicResist 에서 차감.
    // 직접 stat 수정 + 만료 시 revert 패턴 (line 3014 shield cleanup 차용).
    if (effect.type === 'resists-buff' && effect.value) {
      unit.stats.armor = Math.max(0, unit.stats.armor - effect.value);
      unit.stats.magicResist = Math.max(0, unit.stats.magicResist - effect.value);
    }
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

### Task 8: Simplify ability.ts Poppy entry

**Files:**
- Modify: `src/lib/simulator/systems/ability.ts:184`

- [ ] **Step 1: Replace Poppy entry**

Replace line 184:
```ts
  TFT17_Poppy:       { pattern: 'self_buff', selfBuff: { durability: 0.2, duration: 4 } },  // 보호막 + 아군 방어력 버프 (real ability 데미지 0; pattern: 'aoe_circle' 사용 시 Shield 변수가 damage 로 잘못 fallback — codex audit PR #97 후속)
```
with:
```ts
  TFT17_Poppy:       { pattern: 'self_buff' },  // 보호막 + 2칸 내 아군 방어력+마법저항 — combatLoop applyPoppyShieldAndResists 헬퍼에서 처리 (Shield/ShieldDuration/Resists 변수 + AP scaling + 만료)
```

- [ ] **Step 2: Verify typecheck + lint + build**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm build
```
Expected: ALL PASS.

### Task 9: Verify existing tests still pass

**Files:**
- (existing) `tests/unit/*.test.ts`

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: ALL existing tests PASS (no regressions). 새로운 테스트는 commit 3에서 추가.

If any existing test fails: investigate (likely Poppy-related test exists somewhere; if so, fix or note for commit 2 message).

### Task 10: Commit feat(sim)

- [ ] **Step 1: Stage and commit**

```bash
git add src/types/index.ts src/lib/simulator/systems/ability.ts src/lib/simulator/engine/combatLoop.ts
git commit -m "feat(sim): Poppy Shield + ally Resists 버프 정확 구현 (★별 변수 + AP scaling + 2칸 radius)

기존: self_buff + durability 0.2 / 4s 하드코딩 (Shield 변수 무시 + ally Resists 미구현).
신규: applyPoppyShieldAndResists 헬퍼 — Shield/ShieldDuration/Resists 변수 readVarByStar
(sentinel filler 자동 처리) + AP scaling + 2칸 radius 아군 armor/magicResist 가산.
만료: StatusEffectType 'resists-buff' 추가 + tickStatusEffects expired loop 에서 stats revert
(line 3014 shield cleanup 패턴 차용 — armor/MR read site 82개 변경 회피).
in-range/OOR cast 양 경로 모두 호출.

scope OUT (후속 PR):
- Mordekaiser proc 시스템 (DOT → on-attack proc) → P1
- Lissandra ★3 raw values 정밀 검증 → P2
- Veigar Astronaut + Illaoi NumEnemies 다중 흡수 → P3"
```

---

## Phase C — Regression Tests (commit 3)

### Task 11: Write 6 regression test cases

**Files:**
- Create: `tests/unit/poppy-shield-resists.test.ts`

- [ ] **Step 1: Inspect existing test for combat unit creation pattern**

Read `tests/unit/spellCrit.engine.test.ts` (or similar combat-related unit test) to learn how CombatUnit fixtures are constructed in this codebase.

Run:
```bash
ls tests/unit/ | grep -iE "spell|combat|engine"
```
Then read whichever exists to find combat unit factory patterns.

- [ ] **Step 2: Create test file with all 6 cases**

```ts
import { describe, it, expect } from 'vitest';
import type { CombatUnit, RawChampion, AbilityVariable } from '@/types';
// NOTE: applyPoppyShieldAndResists 는 export 되어야 사용 가능.
// 만약 not exported, Task 4 에 export 추가 필요 — 또는 statusEffect 발생 후의 결과만 검증.

// === 헬퍼: Poppy CombatUnit 픽스처 ===
function makePoppyUnit(starLevel: 1 | 2 | 3, ap: number, position = { q: 0, r: 0 }): CombatUnit {
  const variables: AbilityVariable[] = [
    { name: 'Shield', value: [300, 400, 475, 575, 675, 390, 390] },
    { name: 'ShieldDuration', value: [4, 4, 4, 4, 4, 4, 4] },
    { name: 'Resists', value: [36, 15, 25, 60, 100, 36, 36] },  // sentinel filler at index 0
  ];
  const champion: RawChampion = {
    apiName: 'TFT17_Poppy',
    name: '뽀삐',
    cost: 1,
    traits: [],
    role: 'Tank',
    stats: { hp: [600, 1080, 1944], damage: [40, 60, 90], attackSpeed: 0.6, range: 1, armor: 30, magicResist: 30, mana: 0, maxMana: 50, critChance: 0.25, critMultiplier: 1.4 },
    ability: { name: '소환', desc: '', icon: '', variables },
    icon: '', tileIcon: '',
  } as unknown as RawChampion;

  return {
    id: 'poppy-1',
    champion,
    team: 'player',
    position,
    starLevel,
    role: 'Tank',
    items: [],
    currentHp: 1000, maxHp: 1000,
    currentMana: 50, maxMana: 50,
    state: 'idle', target: null,
    stats: { hp: 1000, damage: 60, attackSpeed: 0.6, range: 1, armor: 30, magicResist: 30, mana: 0, maxMana: 50, critChance: 0.25, critMultiplier: 1.4, ap, armorPen: 0, magicPen: 0 },
    attackCooldown: 0, moveCooldown: 0,
    totalDamageDealt: 0, itemDamageDealt: 0, totalDamageTaken: 0,
    statusEffects: [],
    omnivamp: 0, damageAmp: 0, damageReduction: 0, shield: 0,
    augmentManaRegen: 0, augmentGrievousWounds: 0, augmentExecuteThreshold: 0, augmentBurnPercent: 0,
    itemFlatManaPerAttack: 0, inventionTankDamageAmp: 0, madredsTankDamageAmp: 0,
    healAmp: 0, darkStarExecuteThreshold: 0, darkStarSupermassive: false,
    attackCount: 0, castCount: 0,
    bastionDoubleEndTick: 0, bastionDoubleArmorBonus: 0, bastionDoubleMrBonus: 0,
  } as unknown as CombatUnit;
}

function makeAllyUnit(id: string, position: { q: number; r: number }, armor = 30, mr = 30): CombatUnit {
  const champion: RawChampion = {
    apiName: 'TFT17_Aatrox', name: '아트록스', cost: 1, traits: [], role: 'Fighter',
    stats: { hp: [600, 1080, 1944], damage: [40, 60, 90], attackSpeed: 0.6, range: 1, armor, magicResist: mr, mana: 0, maxMana: 50, critChance: 0.25, critMultiplier: 1.4 },
    ability: { name: '', desc: '', icon: '', variables: [] }, icon: '', tileIcon: '',
  } as unknown as RawChampion;
  return { ...makePoppyUnit(1, 0, position), id, champion, stats: { ...makePoppyUnit(1, 0).stats, armor, magicResist: mr } } as unknown as CombatUnit;
}

// 본 테스트는 helper 함수가 export 되어야 동작 — Task 4 에서 export 추가 (또는 이름이 export 되도록).
import { applyPoppyShieldAndResists } from '@/lib/simulator/engine/combatLoop';

describe('TFT17_Poppy — Shield + ally Resists 버프', () => {
  it('C1: ★1 AP=0 cast → shield ≈ 300, dur=4s', () => {
    const poppy = makePoppyUnit(1, 0);
    applyPoppyShieldAndResists(poppy, [poppy]);
    const shieldEffect = poppy.statusEffects.find(e => e.type === 'shield');
    expect(shieldEffect).toBeDefined();
    expect(shieldEffect!.value).toBeCloseTo(300, 0);
    expect(shieldEffect!.remainingTicks).toBeGreaterThan(0);
  });

  it('C2: ★2 AP=100 cast → shield ≈ 800 (400 × 2)', () => {
    const poppy = makePoppyUnit(2, 100);
    applyPoppyShieldAndResists(poppy, [poppy]);
    const shieldEffect = poppy.statusEffects.find(e => e.type === 'shield');
    expect(shieldEffect!.value).toBeCloseTo(800, 0);
  });

  it('C3: ★3 AP=50 cast → shield ≈ 712.5 (475 × 1.5)', () => {
    const poppy = makePoppyUnit(3, 50);
    applyPoppyShieldAndResists(poppy, [poppy]);
    const shieldEffect = poppy.statusEffects.find(e => e.type === 'shield');
    expect(shieldEffect!.value).toBeCloseTo(712.5, 0);
  });

  it('C4: ★3 + 2칸 내 ally 2명 → ally armor +60, MR +60 (AP=0)', () => {
    const poppy = makePoppyUnit(3, 0, { q: 0, r: 0 });
    const ally1 = makeAllyUnit('ally-1', { q: 1, r: 0 }); // 1칸
    const ally2 = makeAllyUnit('ally-2', { q: 0, r: 2 }); // 2칸
    applyPoppyShieldAndResists(poppy, [poppy, ally1, ally2]);
    expect(ally1.stats.armor).toBeCloseTo(30 + 60, 0);
    expect(ally1.stats.magicResist).toBeCloseTo(30 + 60, 0);
    expect(ally2.stats.armor).toBeCloseTo(30 + 60, 0);
    expect(ally2.stats.magicResist).toBeCloseTo(30 + 60, 0);
    expect(ally1.statusEffects.some(e => e.type === 'resists-buff')).toBe(true);
  });

  it('C5: ★3 + 3칸 떨어진 ally → 미버프 (radius 초과)', () => {
    const poppy = makePoppyUnit(3, 0, { q: 0, r: 0 });
    const allyFar = makeAllyUnit('ally-far', { q: 0, r: 3 }); // 3칸
    applyPoppyShieldAndResists(poppy, [poppy, allyFar]);
    expect(allyFar.stats.armor).toBe(30); // 변화 없음
    expect(allyFar.stats.magicResist).toBe(30);
    expect(allyFar.statusEffects.some(e => e.type === 'resists-buff')).toBe(false);
  });

  it('C6: ★1 Resists base=15 (sentinel filler 회귀 가드 — raw[0]=36 무시)', () => {
    const poppy = makePoppyUnit(1, 0, { q: 0, r: 0 });
    const ally = makeAllyUnit('ally-1', { q: 1, r: 0 });
    applyPoppyShieldAndResists(poppy, [poppy, ally]);
    expect(ally.stats.armor).toBeCloseTo(30 + 15, 0); // 36 NOT applied
    expect(ally.stats.magicResist).toBeCloseTo(30 + 15, 0);
  });
});
```

**중요**: `applyPoppyShieldAndResists` 가 Task 4 에서 module-level `function` 으로 정의됐지만 `export` 안 됐을 수 있음. Task 4 의 helper 정의를 `export function applyPoppyShieldAndResists(...)` 로 변경하거나, 테스트 import 방식을 internal-test 패턴으로 조정 필요.

- [ ] **Step 3: Add export to helper if needed**

If `applyPoppyShieldAndResists` 정의가 `function ...` (no export):

Edit `combatLoop.ts` Task 4 helper 정의:
```ts
// Before
function applyPoppyShieldAndResists(...)
// After
export function applyPoppyShieldAndResists(...)
```

- [ ] **Step 4: Adjust fixture if CombatUnit type mismatches**

기존 `tests/unit/spellCrit.engine.test.ts` 의 픽스처 패턴이 위 makePoppyUnit 과 다르면 그쪽 패턴 따라 조정. 핵심 필드만 채우고 나머지는 `as unknown as CombatUnit` 캐스팅.

### Task 12: Verify tests pass

- [ ] **Step 1: Run new test file**

Run: `pnpm test poppy-shield-resists`
Expected: All 6 cases PASS.

If any fail:
- C1/C2/C3 (shield value): readVarByStar 결과 확인 — Shield [300, 400, 475] 는 not filler 이므로 ★1=300, ★2=400, ★3=475 직접 인덱스
- C4 (ally radius 2): hexDistance 계산 검증 — axial coords 기준 (q=1,r=0) 거리=1, (q=0,r=2) 거리=2
- C5 (radius 3 미버프): hexDistance > 2 일 때 skip 확인
- C6 (sentinel filler): readVarByStar isFiller 분기 확인 — Resists [36, 15, ...] v0=36 > v1=15 → filler → ★1=index 1=15

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: ALL tests PASS (no regressions in other tests).

### Task 13: Commit test(sim)

- [ ] **Step 1: Stage and commit**

```bash
git add tests/unit/poppy-shield-resists.test.ts
# If applyPoppyShieldAndResists export 변경 필요했다면 combatLoop.ts 도 추가
git status  # 확인
git commit -m "test(sim): Poppy shield/resists 회귀 가드 6건

- C1~C3: ★1/2/3 Shield value × AP scaling (300/800/712.5)
- C4: 2칸 내 ally 2명 armor/MR +60×AP 가산
- C5: 3칸 ally 미버프 (radius 초과)
- C6: Resists [36, 15, ...] sentinel filler 회귀 가드 (raw[0]=36 무시, ★1=15)"
```

---

## Phase D — Final Verification & PR

### Task 14: Full verification + PR open

- [ ] **Step 1: Final lint/typecheck/build/test**

```bash
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```
Expected: ALL PASS.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/opponent-carries-audit-poppy-fix
```

- [ ] **Step 3: Open PR (target dev)**

```bash
gh pr create --base dev --title "feat(sim): opponent carries ★ audit + Poppy Shield/ally Resists 정확 구현" --body "$(cat <<'EOF'
## Summary
- 5명 opponent carries 진단 보고서 (Lissandra/Veigar/Mordekaiser/Poppy/Illaoi)
- Poppy Shield + ally Resists 버프 정확 구현 (★별 변수 + AP scaling + 2칸 radius + 만료 처리)
- 회귀 가드 6 케이스

## Spec & Design
- Spec: docs/superpowers/specs/2026-05-07-opponent-carries-audit-design.md
- Plan: docs/superpowers/plans/2026-05-07-opponent-carries-audit.md
- Diagnostic: docs/meta/opponent-carries-audit-2026-05-07.md

## 후속 PR 우선순위
- **P1** (Critical): Mordekaiser proc 시스템 (DOT → on-attack proc)
- **P2**: Lissandra ★3 raw values 정밀 검증
- **P3**: Veigar Astronaut MeepsPerAstro + Illaoi NumEnemies 다중 흡수

## Test plan
- [ ] pnpm lint && typecheck && build pass
- [ ] tests/unit/poppy-shield-resists.test.ts 6 케이스 통과
- [ ] 사용자 수동 diff cache 재실행: pnpm tsx scripts/compute-diff-cache.ts → winnerMatchRate 변화 측정

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for codex review + handle P1/P2 issues**

After PR opens, codex review will fire. Address P1 issues in same PR (commits 4+), P2 if time allows.

---

## Self-Review Notes

**Spec coverage check**:
- Spec §2 Deliverables: 진단 보고서 ✓ (Task 1-2), Poppy fix ✓ (Task 3-10), 회귀 가드 ✓ (Task 11-13)
- Spec §3 Methodology: ★별 변수 + sentinel filler ✓ (Task 1)
- Spec §4 Report structure: Summary table + per-champ + 후속 priority ✓ (Task 2)
- Spec §5 Poppy fix: Shield + ally Resists + AP scaling + 2 hex radius ✓ (Task 4)
- Spec §5.5 만료 처리: **Plan 단계 조정 — status effect 조회 기반 → 직접 stat 수정 + revert (line 3014 shield cleanup 패턴)**. Same observable behavior, 82 read site 변경 회피.
- Spec §5.6 회귀 가드 6 케이스: ✓ (Task 11)
- Spec §6 조건부 2nd fix: 진단 결과 대기 — 본 plan 에선 추가 fix 없이 진행 (사전 평가 결과 < 30 LOC 단순 버그 후보 없음). 진단 작성 중 새 발견 시 plan 보강 가능.
- Spec §7 Verification: lint/typecheck/build/test ✓ (Task 8, 9, 12, 14), 사용자 수동 diff cache ✓ (PR description)
- Spec §8 PR 구조: 3 commits (docs / feat / test) ✓ (Task 2, 10, 13)
- Spec §10 Risks: status effect 신규 타입 회귀, AP scaling, sourceId 추적 — 모두 Task 9 에서 회귀 검증 + Task 11 에서 명시 케이스로 가드.

**Spec deviations (acknowledged in plan)**:
1. **만료 처리**: 직접 stat 수정 + revert (line 3014 shield cleanup 패턴) — 82개 read site 변경 회피. Same observable behavior.

**Type consistency check**:
- `applyPoppyShieldAndResists(unit, allies)` signature consistent across Task 4/5/6/11.
- `'resists-buff'` literal consistent across Task 3/4/7/11.
- `readVarByStar` import path consistent (already imported in combatLoop.ts).

**Placeholder scan**: 없음 (모든 step에 구체적 코드/명령 포함).
