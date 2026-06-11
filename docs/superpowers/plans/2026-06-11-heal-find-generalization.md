# 일반화 self-heal resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `config.heal:true` 인데 sim heal=0 이던 5챔프(IvernMinion/Aatrox/Rhaast/TahmKench/Fiora) 회복을 반영하고, Reksai/Illaoi heal star-indexing off-by-one 을 교정한다. (sim 소스 = `public/data/tft_set17_champions.json` — Morgana 는 public data 에 heal 변수 0개라 대상 아님)

**Architecture:** 단일 게이트 변수 find 방식을 폐기하고, ability 변수를 전수 순회하며 `classifyHealVar`(positive 패턴 + exclusion 가드, "Health"⊃"heal" false-positive 회피)로 분류 → `resolveSelfHeal` 순수 helper 가 `readVarByStar`(filler-aware) 일괄 인덱싱으로 합산. cast loop 은 helper 호출 + healAmp/maxHp cap 만.

**Tech Stack:** TypeScript, vitest (`pnpm test`), golden snapshot (`pnpm test:golden -u`). 결정론 엔진 (Math.random 무사용).

**Spec:** `docs/superpowers/specs/2026-06-11-heal-find-generalization-design.md`

---

## File Structure

- **Modify** `src/lib/simulator/engine/combatLoop.ts`
  - 신규 `classifyHealVar(name)` (순수, export) — 변수명 → `'drain'|'amount'|null`
  - 신규 `resolveSelfHeal(unit, aliveTargetCount)` (순수, export) — heal 총량 계산
  - 기존 인라인 heal 블록(`:7056-7102`) → `resolveSelfHeal` 호출로 교체
- **Create** `tests/unit/simulator/heal-resolver-generalization.test.ts` — classifyHealVar 단위 + resolveSelfHeal 단위(6 신규 + Reksai/Illaoi 교정 + Chogath 0) + 통합 smoke
- **Update (snapshot)** golden snapshots — 영향 챔프 시나리오 존재 시 `pnpm test:golden -u`

---

## Task 1: classifyHealVar 순수 분류 함수

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts` (readVarByStar 정의 `:172` 근처에 신규 함수 추가)
- Test: `tests/unit/simulator/heal-resolver-generalization.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/unit/simulator/heal-resolver-generalization.test.ts` 신규 생성:

```ts
/**
 * 회귀 가드 — 일반화 self-heal resolver (heal find generalization).
 * spec: docs/superpowers/specs/2026-06-11-heal-find-generalization-design.md
 */
import { describe, it, expect } from 'vitest';
import { classifyHealVar } from '@/lib/simulator/engine/combatLoop';

describe('classifyHealVar — positive 패턴 + exclusion', () => {
  it('positive heal 변수 → amount', () => {
    for (const n of [
      'PercentMaximumHealthHealing', 'APHealing', 'HealingPercentHealth', 'HealingAP',
      'HEALING', 'Heal', 'HealHP', 'HealAP', 'HealAmount',
      'APHealthGain', 'PercentHPHealthGain', 'PercentHealing',
    ]) {
      expect(classifyHealVar(n)).toBe('amount');
    }
  });

  it('HealthDrain → drain', () => {
    expect(classifyHealVar('HealthDrain')).toBe('drain');
  });

  it('exclusion — "Health" false-positive / amp / shield / duration 차단 → null', () => {
    for (const n of [
      'HealDuration', 'HealthGainDuration', 'HealingAndShieldingPerAstro', 'MeepsPerAstro',
      'PercentHealingToShield', 'AuraHealing',
      'PercentMaximumHealthDamage', 'BonusHealthOnKill', 'BonusHealthPerCast', 'HealthThreshold',
    ]) {
      expect(classifyHealVar(n)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test heal-resolver-generalization`
Expected: FAIL — `classifyHealVar is not a function` (또는 import 에러)

- [ ] **Step 3: classifyHealVar 구현**

`src/lib/simulator/engine/combatLoop.ts` 의 `readVarByStar` 함수(`:172`) 바로 위 또는 아래에 추가:

```ts
/**
 * ability 변수명이 self-heal 변수인지 분류 (positive 패턴 + exclusion).
 * 'drain' = HealthDrain (×NumEnemies special) / 'amount' = 일반 heal 금액
 * (maxHp% vs AP-scaled 는 resolveSelfHeal 가 값 크기로 결정) / null = heal 아님.
 *
 * ⚠️ "Health" 가 "heal" 을 포함하므로 (HealthDamage/HealthOnKill 등) exclusion 을
 *   positive 매칭보다 먼저 적용 — Chogath PercentMaximumHealthDamage(피해)/
 *   BonusHealthOnKill(HP성장) 같은 non-heal 변수 false-positive 차단.
 * spec: docs/superpowers/specs/2026-06-11-heal-find-generalization-design.md
 */
export function classifyHealVar(name: string): 'drain' | 'amount' | null {
  if (/Duration|Shield|Shielding|ToShield|PerAstro|Aura|Cooldown|Ratio|Threshold|Damage|OnKill|PerCast/i.test(name)) {
    return null;
  }
  if (/^HealthDrain$/i.test(name)) return 'drain';
  if (/Healing|^Heal(HP|AP|Amount)?$|HealthGain|PercentHealing/i.test(name)) return 'amount';
  return null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test heal-resolver-generalization`
Expected: PASS (classifyHealVar describe 블록 3 it 통과)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/simulator/engine/combatLoop.ts tests/unit/simulator/heal-resolver-generalization.test.ts
git commit -m "feat(sim): classifyHealVar — heal 변수 positive 패턴 분류 (Health false-positive 차단)"
```

---

## Task 2: resolveSelfHeal 순수 합산 helper

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts` (classifyHealVar 아래 추가)
- Test: `tests/unit/simulator/heal-resolver-generalization.test.ts` (describe 추가)

- [ ] **Step 1: 실패 테스트 작성**

위 테스트 파일에 import 추가 + describe 추가:

```ts
// 파일 상단 import 에 추가:
import { classifyHealVar, resolveSelfHeal, simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { CombatUnit, RawChampion } from '@/types';

const { champions } = loadServerCatalogs();
function champ(api: string): RawChampion { return champions.find(c => c.apiName === api)!; }

/** resolveSelfHeal 는 unit.champion.ability.variables / starLevel / maxHp / stats.ap 만 read.
 *  최소 mock 으로 충분 (나머지 필드 미사용). */
function mockUnit(api: string, opts: { starLevel?: number; maxHp?: number; ap?: number } = {}): CombatUnit {
  return {
    champion: champ(api),
    starLevel: opts.starLevel ?? 1,
    maxHp: opts.maxHp ?? 1000,
    stats: { ap: opts.ap ?? 0 },
  } as unknown as CombatUnit;
}

describe('resolveSelfHeal — readVarByStar 일괄 인덱싱 합산', () => {
  it('Reksai ★1 = maxHp×0.065 + APHealing 90 (off-by-one 교정 — 200 아님)', () => {
    // PercentMaximumHealthHealing 0.065(maxHp%) + APHealing readVarByStar ★1=90(non-filler idx0)
    expect(resolveSelfHeal(mockUnit('TFT17_Reksai', { maxHp: 1000, ap: 0 }), 1)).toBe(155);
  });

  it('IvernMinion ★1 = maxHp×0.08 + HealingAP 80 (edge case readVarByStar)', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_IvernMinion', { maxHp: 1000, ap: 0 }), 1)).toBe(160);
  });

  it('Illaoi ★1 = HealthDrain 40 × min(NumEnemies, aliveCount=1) = 40', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Illaoi', { maxHp: 1000, ap: 0 }), 1)).toBe(40);
  });

  it('Morgana ★1 = 0 (public/data: Shield/Tether/Omnivamp 만 — heal 변수 없음)', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Morgana', { maxHp: 1000, ap: 0 }), 1)).toBe(0);
  });

  it('Aatrox ★1 = maxHp×0.10 + HealAP 150 = 250 (신규 반영)', () => {
    // HealHP 0.10(maxHp%) + HealAP readVarByStar ★1=150(non-filler idx0)
    expect(resolveSelfHeal(mockUnit('TFT17_Aatrox', { maxHp: 1000, ap: 0 }), 1)).toBe(250);
  });

  it('Chogath = 0 (heal 변수 0개 — HealthDamage/HealthOnKill/PerCast 전부 exclusion)', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Chogath', { maxHp: 2000, ap: 0 }), 3)).toBe(0);
  });

  it('AP scaling 적용 — Reksai ap=100 → maxHp×0.065 + 90×2 = 65 + 180 = 245', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Reksai', { maxHp: 1000, ap: 100 }), 1)).toBe(245);
  });
});
```

> ⚠️ 구현 후 실제값이 다르면(raw 데이터 갱신 등) **테스트 기대값을 raw 기준으로 재계산** 후 정정 — 임의 통과 금지. Aatrox HealAP raw `[150,300,375,575]` 확인: `node -e "..."`.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test heal-resolver-generalization`
Expected: FAIL — `resolveSelfHeal is not a function`

- [ ] **Step 3: resolveSelfHeal 구현**

`classifyHealVar` 아래에 추가:

```ts
/**
 * cast 시 시전자 self-heal 총량 계산 (healAmp 적용 전, maxHp cap 전).
 * config.heal:true 챔프의 ability 변수를 전수 순회 → classifyHealVar 매칭 변수 합산.
 * star 인덱싱은 readVarByStar(filler-aware) 일괄. 결정론 — 입력 동일 시 동일 결과.
 * spec: docs/superpowers/specs/2026-06-11-heal-find-generalization-design.md
 */
export function resolveSelfHeal(unit: CombatUnit, aliveTargetCount: number): number {
  const vars = unit.champion.ability.variables ?? [];
  let healAmount = 0;
  for (const v of vars) {
    const kind = classifyHealVar(v.name);
    if (!kind) continue;
    const val = readVarByStar(v.value, unit.starLevel);
    if (kind === 'drain') {
      // HealthDrain — NumEnemies 명에게서 흡수 (cap to alive abilityTargets). AP scaling.
      const numEnemiesVar = vars.find(x => x.name === 'NumEnemies');
      const cap = numEnemiesVar ? (readVarByStar(numEnemiesVar.value, unit.starLevel) || 1) : 1;
      const numEnemies = Math.min(cap, Math.max(1, aliveTargetCount));
      healAmount += val * (1 + unit.stats.ap / 100) * numEnemies;
    } else if (val < 1) {
      // maxHp fraction (scaleHealth)
      healAmount += unit.maxHp * val;
    } else {
      // AP-scaled flat (scaleAP)
      healAmount += val * (1 + unit.stats.ap / 100);
    }
  }
  return Math.round(healAmount);
}
```

> `CombatUnit` 타입이 combatLoop.ts 에 이미 import/정의돼 있으면 추가 import 불요. 없으면 기존 import 라인에 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test heal-resolver-generalization`
Expected: PASS (resolveSelfHeal 7 it 통과). 만약 mock 의 `stats` 가 다른 필드 요구로 타입 에러면 `as unknown as CombatUnit` cast 가 흡수 — 런타임은 4 필드만 read.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/simulator/engine/combatLoop.ts tests/unit/simulator/heal-resolver-generalization.test.ts
git commit -m "feat(sim): resolveSelfHeal — ability 변수 전수 순회 heal 합산 (readVarByStar 일괄)"
```

---

## Task 3: cast loop 에 resolveSelfHeal 배선 (기존 인라인 블록 교체)

**Files:**
- Modify: `src/lib/simulator/engine/combatLoop.ts:7056-7102` (config.heal 인라인 블록)

- [ ] **Step 1: 기존 블록 확인 (read)**

`combatLoop.ts:7056` 의 `if (config.heal) {` 블록 전체(`:7102` `}` 까지)를 read. 현재 healVar find + apHealingVar + pctHealthHealVar + HealthDrain 인라인 로직 ~47줄.

- [ ] **Step 2: 통합 smoke 테스트 작성 (교체 전 — 5 신규 챔프 cast 후 crash 없음)**

위 테스트 파일에 describe 추가:

```ts
describe('통합 — 6 신규 반영 챔프 cast 후 정상 종료 (heal 배선)', () => {
  const { traits } = loadServerCatalogs();
  function placed(api: string, q: number, r: number) {
    return { champion: champ(api), starLevel: 2, position: { q, r }, items: [] };
  }
  for (const api of ['TFT17_IvernMinion', 'TFT17_Aatrox', 'TFT17_Rhaast', 'TFT17_TahmKench', 'TFT17_Fiora']) {
    it(`${api} cast → 정상 종료 (heal 반영 crash 없음)`, () => {
      const result = simulateCombat([placed(api, 4, 3)], [placed('TFT17_Graves', 4, 4)], {
        seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      });
      expect(result.duration).toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 3: 인라인 블록을 helper 호출로 교체**

`combatLoop.ts:7056-7102` 의 `if (config.heal) { ... }` 블록 전체를 아래로 교체:

```ts
            // === 시전자 체력 회복 ===
            // refactor (heal-find-generalization, spec 2026-06-11): 단일 게이트 변수 find →
            // resolveSelfHeal 전수 순회 helper. config.heal:true 챔프 5명(IvernMinion/Aatrox/
            // Rhaast/TahmKench/Fiora) 미반영 해소 + Reksai/Illaoi readVarByStar 교정.
            if (config.heal) {
              const healAmount = resolveSelfHeal(unit, aliveTargets.length);
              if (healAmount > 0) {
                // healAmp 곱셈 — ability self-heal 도 회복량 증폭 효과 대상.
                const finalHeal = healAmount * (1 + (unit.healAmp ?? 0));
                unit.currentHp = Math.min(unit.maxHp, unit.currentHp + finalHeal);
              }
            }
```

> `aliveTargets` 변수가 해당 스코프에 존재하는지 확인 (기존 HealthDrain 로직이 `aliveTargets.length` 사용했으므로 존재). 없으면 기존 블록이 쓰던 동일 식별자 사용.

- [ ] **Step 4: 기존 heal 테스트 + 신규 통합 회귀 확인**

Run: `pnpm test heal`
Expected: PASS — `reksai-heal-aphealing` / `gragas-heal` / `heal-amp-integration` / `heal-resolver-generalization` 모두 통과.
- 만약 `reksai-heal-aphealing.test.ts` 가 ★1 heal **값**을 단언했다면(현재는 raw value[0/1] 단언이라 무관) 교정값으로 갱신.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/simulator/engine/combatLoop.ts tests/unit/simulator/heal-resolver-generalization.test.ts
git commit -m "refactor(sim): config.heal 인라인 블록 → resolveSelfHeal 배선 (5챔프 미반영 해소)"
```

---

## Task 4: 전체 회귀 (golden snapshot + lint/typecheck/build)

**Files:**
- Update (snapshot): `tests/golden/__snapshots__/*` (영향 챔프 시나리오 존재 시)

- [ ] **Step 1: 전체 유닛 테스트**

Run: `pnpm test`
Expected: golden 외 전부 PASS. golden 에서 Reksai/Illaoi/6신규 챔프가 시나리오에 있으면 snapshot mismatch FAIL 발생 가능 — Step 2 에서 처리.

- [ ] **Step 2: golden snapshot diff 검토**

Run: `pnpm test:golden 2>&1 | head -80`
- mismatch 발생 시나리오의 champion 이 **영향 챔프(Reksai/Illaoi/IvernMinion/Aatrox/Rhaast/TahmKench/Fiora — 7챔프) 인지 확인**.
- ✅ 영향 챔프만 변경 → 의도된 변경. Step 3 으로.
- ❌ **무관 챔프(Gragas/Galio/Chogath 등) snapshot 변경 시 → false-positive/회귀 버그**. classifyHealVar exclusion 재점검 (특히 Chogath HealthDamage 차단 확인). 멈추고 디버그.

- [ ] **Step 3: golden snapshot 갱신 (영향 챔프만 변경 확인 후)**

Run: `pnpm test:golden -u`
그 후 `git diff tests/golden/__snapshots__/` 로 변경된 스냅샷이 영향 챔프 한정인지 최종 확인.

- [ ] **Step 4: lint / typecheck / build (CLAUDE.md 필수 게이트)**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: 셋 다 PASS. 하나라도 실패 시 커밋 금지 — 수정 후 재실행.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "test(sim): heal-find-generalization golden snapshot 갱신 + 회귀 확인 (영향 7챔프 한정)"
```

---

## Task 5: diff-cache 재생성 + 위키 P1 resolved 갱신 (후속)

**Files:**
- Update: diff-cache (actual-data 회귀 캐시 — 기존 패턴 `chore(calibration)` 참조)
- Update: `docs/wiki/champions/ivernminion.md` (P1 base heal → resolved), `docs/wiki/champions/reksai.md` (APHealing indexing 교정 반영)

- [ ] **Step 1: diff-cache 재생성**

기존 패턴(#213 `chore(calibration): diff 회귀 캐시 재생성`) 확인 후 동일 절차. engineSha 갱신. heal 변경이 actual-data diff 에 반영되는지 확인 (2게임 rounds 불변/변경 검토).

- [ ] **Step 2: ivernminion.md P1 resolved 갱신**

`docs/wiki/champions/ivernminion.md` 의 base heal P1 항목 → resolved 표기 + `sim_active: partial` 재평가(heal 반영됐으나 stun/meepwave P2 잔존 → partial 유지). frontmatter `last_verified` 갱신.
→ **mechanic/champion 페이지 수정이므로 `wiki-ingest-verifier` dispatch 필수** (CLAUDE.md), `WIKI_VERIFIED=1` 커밋.

- [ ] **Step 3: reksai.md indexing 교정 반영**

`docs/wiki/champions/reksai.md` 의 APHealing 설명에 readVarByStar ★1=90 정합(이전 sim 200 over-read 교정) 반영. → `wiki-ingest-verifier` dispatch.

- [ ] **Step 4: 메모리 갱신**

`champion-ingest-status` 메모리의 "heal find 일반화 시스템 과제" → resolved. 영향 7챔프(신규 5 + 교정 2) + classifyHealVar 패턴 + public/data 소스 교훈 기록.

- [ ] **Step 5: PR 생성**

[[feedback_pr_serial_workflow]] — sim fix PR 1개. 본문에 영향 7챔프(신규 5 + 교정 2) 표 + classifyHealVar 패턴 + exclusion(Aura/ToShield/Reduction 등) + public/data 소스 교훈 명시.

---

## Self-Review (작성자 체크)

- **Spec coverage**: §3.1 classifyHealVar→Task1 / §3.2-3.3 resolveSelfHeal→Task2 / §3.3 배선→Task3 / §4 회귀가드→Task4 / §5 보수제외 flag→Task5 위키 / §7 후속→Task5. ✅ 전 섹션 매핑.
- **Placeholder scan**: 모든 step 에 실제 코드/명령/기대값. golden 변경 챔프는 "영향 챔프 한정 확인" 으로 구체화. Aatrox 기대값은 raw 확인 주석 포함. ✅
- **Type consistency**: `classifyHealVar(name): 'drain'|'amount'|null` (Task1=Task2 호출 일관) / `resolveSelfHeal(unit, aliveTargetCount): number` (Task2 정의=Task3 호출 `resolveSelfHeal(unit, aliveTargets.length)` 일관). ✅
- **보류 검증**: AuraHealing/PercentHealingToShield 는 exclusion 으로 코드 제외 (public/data 엔 부재 — 방어적). Morgana 는 public/data heal 변수 0개라 미반영 대상 아님 (raw-data 와 다름 — 구현 중 발견) — spec §5 정합. ✅
