# Opponent Carries ★ Audit + Poppy Fix — Design

> **Date**: 2026-05-07
> **Branch**: `feat/opponent-carries-audit-poppy-fix`
> **Base**: `dev`
> **Approach**: 1 — 보수적 (진단 보고서 5명 + Poppy 단일 fix + 조건부 추가 1건)

---

## 1. Background

`docs/meta/diff-attribution-2026-05-06-followup.md` 에서 진단된 **sim 전투 종료 4x 빠름** 이슈의 후속 작업.

**Root cause 요약** (followup doc):
- game-20260423-001 baseline: real 33s 전투 vs sim 7.77s
- Player carry HP +40~56% (sim 너무 살아남음), Opponent HP -15~22% (sim 빨리 죽음)
- → **opponent damage/durability 부족**이 dominant

**B1 작업 목적**:
- Set 17 opponent carries(Lissandra/Veigar/Mordekaiser/Poppy/Illaoi)의 ★3 ability 구현 정확도 audit
- 가장 명백한 단일 버그(Poppy)를 같은 PR 내에서 fix
- 후속 PR 4개의 baseline 가이드 제공

---

## 2. Scope & Deliverables

### Goals
1. **진단**: 5명 raw data variables vs 현 sim 구현 gap 정량화
2. **즉시 fix**: Poppy 보호막+ally Resists 정확 구현
3. **조건부 추가 fix**: 진단 중 발견된 명백한 버그(< 30 LOC) 1건만 추가
4. **후속 가이드**: severity-based priority(P1/P2/P3)로 후속 PR 안내

### Deliverables (1 PR)

| 산출물 | 경로 | 비고 |
|--------|------|------|
| 진단 보고서 | `docs/meta/opponent-carries-audit-2026-05-07.md` | 5명 변수표 + gap + 영향 추정 |
| Poppy fix (config) | `src/lib/simulator/systems/ability.ts` | `self_buff` entry 단순화 |
| Poppy fix (engine) | `src/lib/simulator/engine/combatLoop.ts` | 챔프별 분기(5490+) Poppy 블록 |
| StatusEffect 타입 | `src/types/` | `'resists-buff'` 타입 추가 |
| Handler tick decrement | `combatLoop.ts` 기존 statusEffects loop | armor/MR 만료 처리 |
| 회귀 가드 | `tests/unit/poppy-shield-resists.test.ts` | 6 케이스 |
| Design spec | `docs/superpowers/specs/2026-05-07-opponent-carries-audit-design.md` | 본 문서 |

### Out of scope (후속 PR로)

- **Mordekaiser proc 시스템** (DOT → on-attack proc 변환) — 후속 P1
- **Lissandra ★3 raw values 정밀 검증** — 후속 P2
- **Veigar Astronaut MeepsPerAstro / Illaoi NumEnemies 다중 흡수** — 후속 P3
- **Aurora/Pyke/Karma/Bard/Nunu/Rammus/IvernMinion** — 부분 구현 audit, 별도 작업
- **diff cache 자동 재실행** — 사용자 수동 검증
- **TFT16 leftover allyBuff (JarvanIV/Kobuko)** — 별도 cleanup

---

## 3. Diagnostic Methodology

### 비교 소스 (per champ)

1. **Raw data**: `public/data/tft_set17_champions.json` → `champion.ability.variables`
2. **Sim config**: `src/lib/simulator/systems/ability.ts` `ABILITY_DEFS[TFT17_X]`
3. **Sim execution**: `src/lib/simulator/engine/combatLoop.ts` 핸들러 경로

### Gap 카테고리

| 코드 | 의미 | 예시 |
|:----:|------|------|
| A | 변수 미소비 | Veigar `MiniMeepsPerAstro` |
| B | 변수 잘못 사용 | Poppy: `Shield` 변수 → `durability 0.2` 하드코딩 |
| C | Mechanic mismatch | Mordekaiser: proc trigger → DOT 근사 |
| D | ★ scaling 불일치 | Lissandra ★3 multiplier 미검증 |
| E | 시너지 interaction 누락 | Astronaut `MeepShield`/`MeepsPerAstro` |

### 영향 추정

- `game-20260423-001` 기준 **(★별 등장 라운드 수) × (예상 damage delta)**
- 정량 계산 안 함 — 정성 severity tag (🔴 critical / 🟡 moderate / 🟢 low)
- 후속 diff cache 재실행은 사용자 수동 검증

### 변수 값 sentinel filler 처리

`combatLoop.ts:171` `readVarByStar(value, starLevel, fallback)` helper 사용 (PR #99에서 도입).
- `v0 === 0` 또는 `v0 > v1` 또는 `v1/v0 > 5` 시 filler로 분류 → index 0 skip
- Poppy `Resists [36, 15, 25, 60, 100, 36, 36]` → filler 감지 → ★1=15, ★2=25, ★3=60

---

## 4. Report Structure (`docs/meta/opponent-carries-audit-2026-05-07.md`)

### 4.1 헤더 + Summary 표

```markdown
# Opponent Carries ★ Audit — 2026-05-07

> PR #N — game-20260423-001 baseline 4x sim duration mismatch 해소 작업
> 후속 patch attribution: docs/meta/diff-attribution-2026-05-06-followup.md

## Summary

| 챔프 | game-1 ★/R | Gap | Severity | 본 PR fix? | 후속 P |
|------|:----:|----|:----:|:----:|:----:|
| Lissandra | ★1/2/3, 14R | A,D | 🟢 | - | P2 |
| Veigar | ★2, 4R | A,E | 🟡 | - | P3 |
| Mordekaiser | ★2, 4R | C (proc) | 🔴 | - | **P1** |
| Poppy | ★1/2/3, 10R | B + A (ally Resists) | 🔴 | ✅ | - |
| Illaoi | ★1, 3R | A (NumEnemies) | 🟡 | - | P3 |
```

### 4.2 Per-champion 섹션

각 챔프별로:

```markdown
### TFT17_X (코스트, ★/R)

**Raw data variables** (★1/2/3, sentinel filler resolved):
| Var | ★1 | ★2 | ★3 | Sim usage |
|-----|----|----|----|----|
| Damage | 200 | 250 | 375 | ✅ damageVar |
| SecondaryDamage | 50 | 75 | 115 | ✅ secondaryDamageVar |

**Real mechanic** (raw desc 해석):
- (간단 한 문단)

**Sim config** (`ability.ts`):
- `pattern: ..., damageVar: ..., ...`

**Verdict**: 🟢/🟡/🔴
- 발견 사항 1
- 발견 사항 2

**Severity**: ...
**후속 PR 우선순위**: P1/P2/P3 또는 N/A
```

### 4.3 후속 PR 우선순위 결론

```markdown
## 후속 PR 우선순위

1. **P1** (Critical): Mordekaiser proc 시스템 (DOT → on-attack proc)
2. **P2** (Moderate): Lissandra ★3 raw values 정밀 검증
3. **P3** (Low): Veigar Astronaut + Illaoi NumEnemies + Bard abduct + IvernMinion synergy

## Verification (this PR)
- lint/typecheck/build pass
- tests/unit/poppy-shield-resists.test.ts 6 케이스
- 사용자 수동 diff cache 재실행 (winnerMatchRate 변화 측정)
```

---

## 5. Poppy Fix Design

### 5.1 Raw values (sentinel filler resolved)

| Variable | ★1 | ★2 | ★3 | filler? | 본 PR 사용 |
|----------|:---:|:---:|:---:|:---:|:---:|
| Shield | 300 | 400 | 475 | No | ✅ |
| ShieldDuration | 4 | 4 | 4 | No | ✅ |
| Resists | 15 | 25 | 60 | **Yes** (raw[0]=36) | ✅ |
| MeepShield | 100 | 125 | 160 | No | ❌ (Astronaut, scope OUT) |
| MeepsPerAstro | 1 | 1 | 1 | No | ❌ (Astronaut, scope OUT) |

### 5.2 ability.ts 변경

```ts
// Before (line 184)
TFT17_Poppy: { pattern: 'self_buff', selfBuff: { durability: 0.2, duration: 4 } },

// After
TFT17_Poppy: { pattern: 'self_buff' },
// 효과는 combatLoop 챔프별 분기(5490+)에서 처리: Shield + ally Resists buff
```

### 5.3 combatLoop.ts 챔프별 분기 (Poppy 블록 추가)

위치: 5490+ 영역 (Vex/Caitlyn/Kindred/Corki 분기와 동일 라인 그룹)

```ts
} else if (apiName === 'TFT17_Poppy') {
  const vars = champion.ability.variables;
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
  const durTicks = shieldDur * TICKS_PER_SECOND;

  // Self shield (line 1080 warden 패턴 차용)
  unit.statusEffects = unit.statusEffects.filter(e => e.type !== 'shield');
  unit.statusEffects.push({
    type: 'shield',
    sourceId: 'poppy-shield',
    remainingTicks: durTicks,
    value: shieldValue,
  });

  // Ally Resists buff (2칸 radius)
  const allies = team === 'player' ? playerUnits : enemyUnits;
  for (const ally of allies) {
    if (ally.id === unit.id) continue;
    if (ally.currentHp <= 0) continue;
    if (hexDistance(unit.position, ally.position) > 2) continue;
    ally.statusEffects.push({
      type: 'resists-buff',
      sourceId: `poppy-resists-${unit.id}`,
      remainingTicks: durTicks,
      value: resistsValue,
    });
  }
}
```

### 5.4 StatusEffect 타입 추가

`src/types/` (해당 파일 검색 후 확장):
```ts
export type StatusEffectType =
  | 'shield'
  | 'stun'
  | 'invulnerable'
  | ... // 기존
  | 'resists-buff';  // 신규
```

`STATUS_EFFECT_LABELS` (combatLoop.ts:53) 에도 라벨 추가.

### 5.5 Tick decrement + 만료 처리

기존 statusEffects loop (매 tick 처리)에 `'resists-buff'` 분기 추가:
- tick마다 `remainingTicks--`
- 0 도달 시 effect 제거 — 별도 stat 복원 불필요 (status effect 조회 기반으로 동작)

방어력/마법저항 계산 시점에:
```ts
const resistsBuff = unit.statusEffects
  .filter(e => e.type === 'resists-buff')
  .reduce((sum, e) => sum + (e.value ?? 0), 0);
const effectiveArmor = unit.stats.armor + resistsBuff;
const effectiveMagicResist = unit.stats.magicResist + resistsBuff;
```

(damage mitigation 계산 부분에서 effective 사용 — 정확한 위치는 구현 시 식별)

### 5.6 회귀 가드 (`tests/unit/poppy-shield-resists.test.ts`)

| 케이스 | 입력 | 기대 |
|--------|------|------|
| C1 | ★1 Poppy AP=0 cast | shield ≈ 300, dur=4s |
| C2 | ★2 Poppy AP=100 cast | shield ≈ 800 (400×2) |
| C3 | ★3 Poppy AP=50 cast | shield ≈ 712.5 (475×1.5) |
| C4 | ★3 Poppy + 2칸 내 ally 2명 | ally armor +60×AP, MR +60×AP |
| C5 | ★3 Poppy + 3칸 떨어진 ally | ally 미버프 (radius 초과) |
| C6 | ★1 Resists | base=15 (sentinel filler 회귀 가드) |

### 5.7 변경 영향 범위 (예상)

| 파일 | 변경 |
|------|------|
| `src/lib/simulator/systems/ability.ts` | 1줄 (Poppy entry 단순화) |
| `src/lib/simulator/engine/combatLoop.ts` | ~30줄 추가 (Poppy 분기 + tick decrement + armor/MR 적용 분기) |
| `src/types/` (StatusEffectType) | 1줄 (타입 추가) |
| `combatLoop.ts:53` STATUS_EFFECT_LABELS | 1 entry |
| `tests/unit/poppy-shield-resists.test.ts` | 신규 파일 (~80줄) |

---

## 6. 조건부 2nd Fix 기준

진단 중 발견한 gap이 **3가지 조건 모두 만족** 시에만 같은 PR에 추가:

1. **명백한 단순 버그**: raw 변수 100% 무시 또는 변수 misuse
2. **< 30 LOC**: ability.ts 1줄 변경 + combatLoop 부분 수정
3. **기존 패턴 재사용**: 신규 type/mechanic 도입 불필요

### 사전 평가 (현재 분석 기준)

| 후보 | 조건 만족? | 비고 |
|------|:---:|------|
| Veigar `MiniMeepsPerAstro` | ❌ | Astronaut active state check 신규 |
| Illaoi `NumEnemies` 다중 흡수 | ❌ | 다중 타겟팅 핸들러 신규, 30 LOC 초과 |
| Lissandra ★3 raw values 검증 | ❌ | 이미 구현됨, fix 아닌 문서화 |
| Mordekaiser proc 시스템 | ❌ | 대규모 mechanic 변경 |

**현재 분석 기준 2nd fix 후보 없음**. 진단 작성 중 새로운 단순 버그가 드러나면 그때 평가. 없으면 단일 fix(Poppy)로 PR 완성.

---

## 7. Verification & Acceptance

### 7.1 자동 검증 (mandatory)

```bash
pnpm lint && pnpm typecheck && pnpm build  # CLAUDE.md 룰
pnpm test                                    # 기존 테스트 회귀 가드
pnpm test poppy-shield-resists               # 신규 6 케이스
```

### 7.2 사용자 수동 검증 (out of automated scope)

```bash
pnpm tsx scripts/compute-diff-cache.ts  # diff cache 재실행
```
- `actual-data/diff-game-20260423-001.json` winnerMatchRate 변화
- Poppy 등장 라운드(★1=3R, ★2=5R, ★3=2R)의 player HP 오차 변화

### 7.3 Definition of Done

✅ **Mandatory**:
- [ ] `docs/meta/opponent-carries-audit-2026-05-07.md` 작성: 5명 진단 + severity + 후속 PR 우선순위
- [ ] `ability.ts` Poppy entry 단순화
- [ ] `combatLoop.ts` 챔프별 분기 Poppy 블록
- [ ] `StatusEffectType` 'resists-buff' 추가
- [ ] tick decrement + 만료 처리
- [ ] armor/MR 계산에 buff 합산
- [ ] `tests/unit/poppy-shield-resists.test.ts` 6 케이스 통과
- [ ] lint/typecheck/build 통과
- [ ] codex review의 P1 issue 모두 해결

❌ **Out of scope (후속 PR 명시)**:
- Mordekaiser proc 시스템 → 후속 P1
- Lissandra ★3 deep audit → 후속 P2
- Veigar/Illaoi/Bard/IvernMinion 시너지 interaction → 후속 P3
- diff cache 자동 재실행

---

## 8. PR 구조 (commit 분할)

```
1. docs(meta): opponent carries ★ audit 2026-05-07 — 5명 진단 + 후속 P1~P3
2. feat(sim): Poppy Shield + ally Resists 버프 정확 구현 (★별 변수 + AP scaling + 2칸 radius)
3. test(sim): Poppy shield/resists 회귀 가드 6건
```

+ codex review 후속 fix commits (있을 경우)

---

## 9. 참고 문서

- `docs/meta/diff-attribution-2026-05-06-followup.md` — root cause 진단
- `docs/meta/sim-accuracy-followups.md` — v1 후속 작업 정리
- `docs/superpowers/specs/2026-04-24-sim-accuracy-diff-design.md` — diff cache 시스템 설계
- 코드: `src/lib/simulator/engine/combatLoop.ts` line 171 (`readVarByStar`), line 1080 (warden shield 패턴), line 5490+ (챔프별 분기 영역)

---

## 10. Risks & Mitigation

| 위험 | 가능성 | 영향 | Mitigation |
|------|:---:|:---:|------|
| `'resists-buff'` 신규 타입 추가가 기존 statusEffects loop의 다른 분기 깨뜨림 | Low | High | 회귀 가드 (기존 `pnpm test`) 먼저 실행 후 변경 |
| AP scaling 공식이 sim 내 다른 ability와 다름 | Low | Medium | line 967 의 기존 공식 재사용 (`* (1 + ap / 100)`) |
| Poppy 사망 시 ally buff 잔존 | Low | Low | sourceId 추적 — 사망 unit의 effect는 만료 처리 (필요 시) |
| 회귀 가드 테스트가 실제 combatLoop 통합과 isolation 차이로 false pass | Medium | Medium | 가능하면 mini integration test (combatLoop 1 tick 호출) 1건 포함 |
