# spell-crit-mechanic Design Document

> **Summary**: 엔진·DPS 추정·추천 3개 레이어에 스킬 치명타 판정을 추가하는 설계. 공유 상수 모듈 + 기존 라인 번호에 정확히 맞춘 변경 지점 + 결정론 보장 테스트 케이스.
>
> **Project**: tft_sim
> **Version**: 0.1
> **Author**: Dayoung
> **Date**: 2026-04-22
> **Status**: Draft
> **Planning Doc**: [spell-crit-mechanic.plan.md](../../01-plan/features/spell-crit-mechanic.plan.md)
> **Source TODO**: [spell-crit-mechanic.md](../../todo/spell-crit-mechanic.md)

---

## 1. Overview

### 1.1 Design Goals

1. **엔진/분석 동등성** — 기본 공격과 스킬이 동일한 crit 공식을 사용 (`rng.next() < critChance` → `critMultiplier`). 현재 비대칭 (기본 ✓, 스킬 ✗) 해소
2. **DPS 추정과 엔진 일치** — `itemOptimizer.estimateDps` AP 분기가 엔진과 같은 공식으로 기댓값을 계산 (`1 + critChance*(critMult-1)`)
3. **추천 현실성** — AP 캐리 추천 Top-3 에 보건/무대 중 하나가 반드시 포함 (실제 메타와 일치)
4. **결정론 (Replay 보장)** — crit 판정 추가로 기존 snapshot 이 깨지되, 새 seed 기반으로는 완전 재현 가능
5. **순수성** — 엔진은 `rng.next()` 만 사용, 분석은 React-free 순수 함수 유지

### 1.2 Design Principles

- **단일 진실 원천 (SSoT)**: `SPELL_CRIT_ITEMS` 상수는 한 곳에만 정의, 엔진/분석 3개 파일이 모두 공유
- **기존 패턴 답습**: 기본 공격 crit 판정 패턴 (`combatLoop.ts:1682-1683`) 을 ability 경로에 그대로 이식
- **AD/AP 대칭**: `estimateDps` 의 AD `critMul` 공식을 AP 분기에도 동일하게 적용
- **최소 인터페이스 변경**: 가능한 기존 함수 시그니처 유지, 플래그 전파는 내부 계산으로 해결
- **확장 훅 선행**: Set 17 엔 crit-enable trait 없지만, `SPELL_CRIT_TRAIT_APINAMES: string[]` 빈 배열 선언으로 Set 18+ 대응

---

## 2. Architecture

### 2.1 Module Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                src/lib/combat/spellCrit.ts  (신규)            │
│  - SPELL_CRIT_ITEMS: Set<string>            [6종 apiName]    │
│  - SPELL_CRIT_TRAIT_APINAMES: string[]      [Set17=[]]       │
│  - hasSpellCritItem(items)                                   │
│  - hasSpellCritEnableTrait(traits)                           │
│  - computeSpellCanCrit(items, traits)                        │
│  - expectedSpellCritMultiplier(critChance, critMult)          │
└─────┬──────────────────────┬─────────────────────┬───────────┘
      │                      │                     │
      ▼                      ▼                     ▼
┌────────────────┐  ┌──────────────────┐  ┌───────────────────┐
│ combatLoop.ts  │  │ itemOptimizer.ts │  │ itemRecommender.ts│
│ (엔진)          │  │ (DPS 정적 추정)    │  │ (추천 스코어)       │
└────────────────┘  └──────────────────┘  └───────────────────┘
      │                      │                     │
      ▼                      ▼                     ▼
 CombatUnit             ItemDpsModifiers       Recommendation
 .spellCanCrit          .canSpellCrit          (+ tag)
 (types/index.ts)
```

### 2.2 Data Flow

**전투 시작 시**:
```
placedChampion.items + activeTraits
    │
    ▼
createCombatUnit (combatLoop.ts:80)
    │
    ▼  computeSpellCanCrit(items, activeTraits)
    │
    ▼
CombatUnit.spellCanCrit = true/false  ← 전투 내내 불변
```

**ability 시전 시**:
```
baseDmg * (1 + abilityDamageAmp) = dmg
    │
    ▼  if (unit.spellCanCrit && rng.next() < critChance) dmg *= critMultiplier
    │
    ▼
applyResistance → shield → ...
```

**DPS 추정 시**:
```
extractItemDpsModifiers(items) → mods.canSpellCrit = hasSpellCritItem(items)
    │
    ▼
estimateDps AP 분기: if (mods.canSpellCrit) baseApDps *= (1 + critChance*(critMult-1))
```

### 2.3 Dependencies

| Module | Depends On | Purpose |
|--------|-----------|---------|
| `spellCrit.ts` | (없음 — 순수) | 상수 + 헬퍼만. 도메인 타입 의존 X |
| `combatLoop.ts` | `spellCrit.ts`, `types/index.ts` | 엔진 초기화 + ability crit 판정 |
| `itemOptimizer.ts` | `spellCrit.ts` | DPS 추정에 canSpellCrit 반영 |
| `itemRecommender.ts` | `spellCrit.ts`, `itemOptimizer.ts` | 추천 가중치 + 조합 평가 |
| `tests/unit/spellCrit.*.test.ts` | 위 3개 모두 | 단위 테스트 |

**의존 순환 없음 확인**: `spellCrit.ts` 는 외부 의존 없음 → 3개 레이어가 자유롭게 import 가능.

---

## 3. Data Model

### 3.1 `CombatUnit` 확장

```typescript
// src/types/index.ts  (line 437~ 의 CombatUnit 인터페이스)
export interface CombatUnit {
  // ... 기존 필드 ...
  inventionTankDamageAmp: number;
  /** MF 특성 선택 등으로 치환된 실제 트레이트 목록 */
  resolvedTraits?: string[];

  /** [신규] 스킬 치명타 가능 여부.
   *  전투 시작 시 보건/무대 착용 또는 정밀 계열 시너지 활성 여부로 계산, 전투 중 불변.
   *  false 면 ability 피해 경로에서 crit 판정을 건너뜀. */
  spellCanCrit: boolean;
}
```

### 3.2 `ItemDpsModifiers` 확장

```typescript
// src/lib/analysis/itemOptimizer.ts (line 75 interface 확장)
export interface ItemDpsModifiers {
  // ... 기존 필드 (damageAmp, damageRepeat, adDamageAmp, ...) ...
  adapPerKill: number;

  /** [신규] AP 스킬에 치명타 판정이 적용될 수 있는 조합인지.
   *  보건/무대가 items 에 포함되면 true. estimateDps AP 분기의 critMul 반영용. */
  canSpellCrit: boolean;
}
```

### 3.3 `spellCrit.ts` 공개 API

```typescript
// src/lib/combat/spellCrit.ts  (신규 파일)

/** TFT 룰: 보건 또는 무대 착용 시 스킬 크리 가능.
 *  6종 (기본 / Corrupted / Radiant × 2) 전부 동일 효과. */
export const SPELL_CRIT_ITEMS: ReadonlySet<string> = new Set([
  'TFT_Item_JeweledGauntlet',
  'TFT_Item_CorruptedJeweledGauntlet',
  'TFT_Item_Radiant_JeweledGauntlet',
  'TFT_Item_InfinityEdge',
  'TFT_Item_CorruptedInfinityEdge',
  'TFT_Item_Radiant_InfinityEdge',
]);

/** 정밀 계열 시너지 apiName. Set 17 엔 없음 → 빈 배열.
 *  향후 Set 18+ 에서 해당 trait 등장 시 여기에 추가하면 자동 반영. */
export const SPELL_CRIT_TRAIT_APINAMES: ReadonlyArray<string> = [];

export function hasSpellCritItem(items: ReadonlyArray<RawItem>): boolean {
  return items.some(i => SPELL_CRIT_ITEMS.has(i.apiName));
}

export function hasSpellCritEnableTrait(traits: ReadonlyArray<ActiveTrait>): boolean {
  if (SPELL_CRIT_TRAIT_APINAMES.length === 0) return false;
  return traits.some(t =>
    SPELL_CRIT_TRAIT_APINAMES.includes(t.trait.apiName) && t.minUnits > 0
  );
}

export function computeSpellCanCrit(
  items: ReadonlyArray<RawItem>,
  traits: ReadonlyArray<ActiveTrait>,
): boolean {
  return hasSpellCritItem(items) || hasSpellCritEnableTrait(traits);
}

/** 기댓값 공식: E[crit] = 1 + critChance × (critMultiplier - 1).
 *  estimateDps / flatStatBonus 등 정적 분석에서 사용. */
export function expectedSpellCritMultiplier(
  critChance: number,
  critMultiplier: number,
): number {
  return 1 + critChance * (critMultiplier - 1);
}
```

---

## 4. Engine Integration Points

### 4.1 `combatLoop.ts` 변경 위치 (3곳)

#### (a) `createCombatUnit` — line 92~125 (unit 객체 리터럴)

**변경**: `spellCanCrit` 필드 초기화 추가. `activeTraits` 는 이미 파라미터로 전달되므로 추가 인자 필요 없음.

```typescript
// line 125 attackCount 위쪽 또는 아래에 필드 추가
const unit: CombatUnit = {
  // ... 기존 필드 ...
  killCount: 0,
  spellCanCrit: computeSpellCanCrit(allItems, activeTraits),  // [신규]
};
```

#### (b) 메인 ability 피해 경로 — line 1966 직후

**현재 코드**:
```typescript
let dmg = baseDmg * (1 + abilityDamageAmp);   // line 1966
if (config.damageDecay && ti > 0) {
  dmg *= Math.pow(1 - config.damageDecay, ti);
}
```

**변경 후**:
```typescript
let dmg = baseDmg * (1 + abilityDamageAmp);
if (config.damageDecay && ti > 0) {
  dmg *= Math.pow(1 - config.damageDecay, ti);
}
// [신규] 스킬 크리 판정 — 기본 공격 line 1682 와 동일 패턴
if (unit.spellCanCrit && rng.next() < unit.stats.critChance) {
  dmg *= unit.stats.critMultiplier;
}
```

**주의**: 다단히트 (`config.secondaryDamageVar` 있는 경우) 는 이미 `baseDmg` 에 합산된 후 한 번만 crit 판정. 별 히트로 분리된 스킬 처리는 scope 밖 (Plan §2.2).

#### (c) OOR ability 피해 경로 — line 2200

**현재 코드**:
```typescript
let dmg = dmgType === 'true'
  ? abilityDmg * (1 + unit.damageAmp)
  : applyResistance(abilityDmg * (1 + unit.damageAmp), resistance, pen);
```

**변경 후**:
```typescript
let rawDmg = abilityDmg * (1 + unit.damageAmp);
// [신규] OOR 경로도 동일 crit 판정 — 내부 오차 피하려 resistance 전에 적용
if (unit.spellCanCrit && rng.next() < unit.stats.critChance) {
  rawDmg *= unit.stats.critMultiplier;
}
let dmg = dmgType === 'true' ? rawDmg : applyResistance(rawDmg, resistance, pen);
```

**중요**: crit 은 resistance **전에** 적용 (기본 공격 line 1688 과 동일: `rawDamage = damage * critMult * (1+amp)` → `applyResistance`). 물리/마법 방어와 독립적.

### 4.2 `createCombatUnit` 시그니처

변경 없음. `activeTraits: ActiveTrait[] = []` 이 이미 파라미터로 존재. 내부에서 `computeSpellCanCrit(allItems, activeTraits)` 호출만 추가.

### 4.3 rng Consumption 영향

**문제**: 기존 snapshot 재현 시 `rng.next()` 호출이 ability 경로에 추가되면 이후 rng sequence 가 전부 shift.

**대응**:
1. 기존 snapshot replay 호환성 보장 X (Plan §5 Risk 2 인지된 상태)
2. `tests/golden/` 하위 snapshot 재생성 필요
3. seed 별 결정론은 **유지** — 동일 seed 2회 실행 시 동일 결과

---

## 5. Analysis Integration Points

### 5.1 `itemOptimizer.ts` — `extractItemDpsModifiers` (line 99)

**변경**:
```typescript
const mods: ItemDpsModifiers = {
  // ... 기존 필드 초기화 ...
  adapPerKill: 0,
  canSpellCrit: hasSpellCritItem(items),   // [신규]
};
```

`SPELL_CRIT_TRAIT_APINAMES` 는 아이템 정보만으로는 모르므로 이 함수는 **아이템 기반만** 체크. 시너지 기반 trigger 는 `estimateDps` 호출자가 처리 (scope 밖 — Set 17 엔 어차피 훅만 존재).

### 5.2 `itemOptimizer.ts` — `estimateDps` AP 분기 (line 256-265)

**현재 코드**:
```typescript
if (isAP) {
  const star = STAR_SCALING[starLevel] ?? 1;
  const effectiveMana = Math.max(
    stats.maxMana - mods.manaRegen * AVG_COMBAT_DURATION * DPS_CALIBRATION.MANA_REGEN_EFFICIENCY,
    20,
  );
  const castFreq = 100 / effectiveMana;
  const baseApDps = (100 + stats.ap + stackAP + killBonusAP) * star * totalAS * castFreq;
  const apScalarBonus = mods.apScalar > 0 ? (stats.ap + stackAP) * mods.apScalar * totalAS : 0;
  return (baseApDps + apScalarBonus + flatDpsBonus + burnDps) * ampMul * repeatMul * splashMul * bonusAttackMul;
}
```

**변경 후**:
```typescript
if (isAP) {
  const star = STAR_SCALING[starLevel] ?? 1;
  const effectiveMana = Math.max(
    stats.maxMana - mods.manaRegen * AVG_COMBAT_DURATION * DPS_CALIBRATION.MANA_REGEN_EFFICIENCY,
    20,
  );
  const castFreq = 100 / effectiveMana;
  // [신규] 스킬 크리 가능 시 기댓값 곱
  const spellCritMul = mods.canSpellCrit
    ? expectedSpellCritMultiplier(stats.critChance, stats.critMultiplier)
    : 1;
  const baseApDps = (100 + stats.ap + stackAP + killBonusAP) * star * totalAS * castFreq * spellCritMul;
  const apScalarBonus = mods.apScalar > 0
    ? (stats.ap + stackAP) * mods.apScalar * totalAS * spellCritMul
    : 0;
  return (baseApDps + apScalarBonus + flatDpsBonus + burnDps) * ampMul * repeatMul * splashMul * bonusAttackMul;
}
```

**이유**: `apScalarBonus` (타오르는 단궁의 AP 스케일링) 도 스킬 피해로 분류되므로 동일 crit 적용. `flatDpsBonus` / `burnDps` 는 proc-based 고정 피해 (루덴 등) 라 crit 미적용.

### 5.3 `itemRecommender.ts` — `flatStatBonus` 조정 (line 128)

**변경**: AP 분기에 보건/무대 감지 시 큰 bonus.

```typescript
function flatStatBonus(item: RawItem, isAP: boolean): number {
  const fx = item.effects ?? {};
  let bonus = 0;
  if (isAP) {
    bonus += (fx.AP ?? 0) * 3;
    bonus += (fx.ManaOnRoundStart ?? 0) * 2;
    bonus += (fx.ManaGain ?? 0) * 2;
    bonus += (fx.SpellDamageAmp ?? 0) * 150;
    // [신규] 보건/무대는 AP 캐리의 스킬 크리 언락 — 플랫 스탯 외 추가 가치
    if (SPELL_CRIT_ITEMS.has(item.apiName)) bonus += SPELL_CRIT_UNLOCK_BONUS;
  } else {
    // ... 기존 AD 분기 ...
  }
  return bonus;
}
```

**상수**: `SPELL_CRIT_UNLOCK_BONUS = 400` (초기값, 캘리브레이션 후 조정). 다른 AP bonus 스케일(예: `SpellDamageAmp * 150`) 과 비교해 단일 아이템으로 `estimateDps` 차이 + 400 이면 Top-3 진입 경쟁력 확보.

### 5.4 `itemRecommender.ts` — `pickTopCombo` 조합 평가 (line 185)

**옵션 A (권장)**: `estimateDps` 호출 시 `canSpellCrit` 이 자동으로 반영되므로 별도 수정 불필요. `combo.map(r => r.item)` 에 보건/무대 있으면 `extractItemDpsModifiers` → `canSpellCrit=true` 로 자동 반영됨.

**옵션 B (백업)**: 만약 옵션 A 로도 AP 조합에 보건/무대가 안 들어가면 `pickTopCombo` 에 AP 캐리 제약 추가:
```typescript
// AP 캐리 + pool 에 보건/무대 있을 때, 그 중 하나를 반드시 포함하지 않는 조합은 제외
if (isAP) {
  const poolHasCritItem = sorted.some(r => SPELL_CRIT_ITEMS.has(r.item.apiName));
  const comboHasCritItem = combo.some(r => SPELL_CRIT_ITEMS.has(r.item.apiName));
  if (poolHasCritItem && !comboHasCritItem) continue;
}
```

**결정**: Phase C 에서 옵션 A 먼저 구현 → 테스트로 Top-3 진입 확인 → 미흡 시 옵션 B 추가.

### 5.5 `itemRecommender.ts` — `tagReason` (line 224)

**변경**:
```typescript
export function tagReason(item: RawItem): string {
  // [신규] 보건/무대는 최우선 태그
  if (SPELL_CRIT_ITEMS.has(item.apiName)) return '스킬 치명타 언락';

  const keys = Object.keys(item.effects ?? {});
  // ... 기존 로직 ...
}
```

기존 태그 ("치명타", "공격력" 등) 보다 우선 표시.

---

## 6. Error Handling / Edge Cases

### 6.1 critChance / critMultiplier 이상값

| 시나리오 | 처리 |
|---------|------|
| `critChance = 0` | crit 불가, 정상 동작 |
| `critChance > 1` (초과치명타 메타) | 현재 프로젝트 전반 미처리. 본 작업 scope 외 — `rng.next() < critChance` 가 항상 true 여서 자동 100% crit |
| `critMultiplier = 1` (정확히 1배) | crit 이지만 피해 변화 없음. 기대값 공식도 `1 + p*(1-1) = 1` 로 정상 |
| `items` 가 `undefined` | `hasSpellCritItem` 호출 전 방어. `computeSpellCanCrit` 는 `items ?? []` fallback |

### 6.2 다단히트 스킬

현재 메인 ability 경로는 `baseDmg` 에 secondaryDamageVar 를 합산 후 한 번 crit 판정 → 모든 히트가 동일 crit 여부. 타격별 crit 은 scope 밖 (Plan §2.2).

### 6.3 non-damaging ability (실드/힐만 주는 스킬)

`abilityDmg = 0` 이면 `dmg = 0`, crit 판정 무의미. 성능상 무시 (추가 분기 불필요).

### 6.4 resolvedTraits 와 activeTraits 차이

`CombatUnit.resolvedTraits` 는 MF 특성 선택 치환용. `computeSpellCanCrit` 에는 **팀의 `activeTraits`** 를 사용 (개별 유닛 치환과 독립). Set 17 엔 어차피 crit-enable trait 없어 실익 없음.

---

## 7. Test Plan

### 7.1 Test Scope

| 유형 | 대상 | 도구 | 위치 |
|------|------|------|------|
| Unit | `spellCrit.ts` 헬퍼 함수 | Vitest | `tests/unit/spellCrit.test.ts` |
| Engine | ability crit 발동 / 피해 기대치 | Vitest | `tests/unit/spellCrit.engine.test.ts` |
| Analysis | `estimateDps` AP critMul 반영 | Vitest | `tests/unit/spellCrit.optimizer.test.ts` |
| Recommender | AP 캐리 Top-3 보건/무대 포함 | Vitest | `tests/unit/spellCrit.recommender.test.ts` |
| Calibration | DPS 계수 영향 재측정 | Vitest | `tests/calibration/calibrate-dps.test.ts` (기존 갱신) |

### 7.2 핵심 테스트 케이스

#### `spellCrit.test.ts` — 순수 헬퍼

- [ ] `hasSpellCritItem([])` → `false`
- [ ] `hasSpellCritItem([JG])` → `true`, `[CorruptedJG]` → `true`, `[RadiantIE]` → `true`
- [ ] `hasSpellCritItem([BFSword])` → `false`
- [ ] `hasSpellCritEnableTrait([])` → `false` (Set 17)
- [ ] `computeSpellCanCrit` 아이템 OR trait 작동 확인
- [ ] `expectedSpellCritMultiplier(0.25, 1.4)` → `1.1` (`1 + 0.25*0.4`)

#### `spellCrit.engine.test.ts` — 엔진 결정론

- [ ] **Happy path**: 벡스 2성 + 보건 1개, 적 피닉스 2성, seed=1234 → ability 20회 평균 피해가 보건 없는 대조군 대비 `1 + 0.25*(1.4-1) = 1.10` 배에 가깝게 (오차 ±8%, 20샘플)
- [ ] **결정론**: 동일 seed 2회 실행 → 모든 tick 에서 동일 피해 배열
- [ ] **spellCanCrit=false**: 보건/무대 없는 벡스 → ability 피해에 `critMultiplier` 배수 한 번도 안 나타남 (100회 시뮬)
- [ ] **basic attack 무영향**: 기본 공격 crit 판정은 `unit.stats.critChance` 그대로. `spellCanCrit` 과 무관 (회귀 방지)
- [ ] **OOR 경로**: 사거리 외 타겟 스킬에도 crit 적용 확인

#### `spellCrit.optimizer.test.ts` — estimateDps

- [ ] AP 캐리 stats + 보건 1개 → `estimateDps` 가 보건 제외 대비 `~1.1x` 상승
- [ ] AD 캐리 stats + 보건 1개 → **변화 없음** (AD 분기는 이미 critMul 반영 중, `canSpellCrit` 은 AP 분기 전용)
- [ ] `apScalarBonus` (타오르는 단궁) 도 critMul 반영 확인

#### `spellCrit.recommender.test.ts` — 추천 Top-3

- [ ] `getStaticRecommendations(vex, apStats, 2, allItems)` → 결과 Top-3 에 `JeweledGauntlet` 또는 `InfinityEdge` 중 최소 1개 포함
- [ ] AD 캐리 (예: 자크) 에겐 JG 가 Top-3 에 들어가지 **않아야** (AD 분기는 이미 IE crit 반영, JG 는 AP 특화이므로 순위 낮음)
- [ ] `tagReason(JG)` → `'스킬 치명타 언락'`
- [ ] 기존 77개 테스트 전부 통과 확인

### 7.3 Calibration 재측정

`DPS_CALIBRATION` 상수 6종 중 AP 계수 관련 (`MANA_REGEN_EFFICIENCY`) 은 영향 없음 (crit 과 독립). AD 계수 (`FLAT_DAMAGE_PROC_RATE`, `BONUS_ATTACK_DPS_MULT`) 도 영향 없음.

**영향 가능 지점**: AP 캐리 검증 시나리오의 `estimateDps` 오차 (기대값 vs 시뮬 실측). Phase B 완료 후 `tests/calibration/calibrate-dps.test.ts` 실행해 AP 계열 오차가 유지되거나 개선되는지 확인. 악화 시 Phase B 공식 재검토.

---

## 8. Rollout / Implementation Order

Plan §8 의 3-Phase 세부화.

### Phase A: 엔진 (FR-01 ~ FR-05, FR-11)

1. `src/lib/combat/spellCrit.ts` 신규 — 상수 + 헬퍼 (순수 함수)
2. `src/types/index.ts` — `CombatUnit.spellCanCrit: boolean` 추가
3. `tests/unit/spellCrit.test.ts` — 헬퍼 단위 테스트 (10건 내외)
4. `combatLoop.ts:125` — `createCombatUnit` 필드 초기화
5. `combatLoop.ts:1966+` — 메인 ability crit 판정 삽입
6. `combatLoop.ts:2200+` — OOR ability crit 판정 삽입
7. `tests/unit/spellCrit.engine.test.ts` — 엔진 테스트 (5건 내외)
8. 기존 golden snapshot 재생성 (`tests/golden/`)
9. `pnpm lint && pnpm typecheck && pnpm build` 통과

### Phase B: DPS 추정 (FR-06, FR-07)

1. `itemOptimizer.ts:75` — `ItemDpsModifiers.canSpellCrit` 필드 추가
2. `itemOptimizer.ts:99` — `extractItemDpsModifiers` 에서 플래그 세팅
3. `itemOptimizer.ts:256-265` — AP 분기 `spellCritMul` 곱셈
4. `tests/unit/spellCrit.optimizer.test.ts`
5. `tests/calibration/calibrate-dps.test.ts` 재실행 — 결과 비교

### Phase C: 추천 가중치 (FR-08 ~ FR-10)

1. `itemRecommender.ts:128` — `flatStatBonus` 에 `SPELL_CRIT_UNLOCK_BONUS`
2. `itemRecommender.ts:224` — `tagReason` 우선 태그
3. 테스트 실행 — Top-3 포함 확인
4. 미흡 시 `pickTopCombo` 에 옵션 B (제약) 추가
5. `tests/unit/spellCrit.recommender.test.ts`
6. 기존 77개 회귀 테스트

### Final

- 전체 lint + typecheck + build + test 통과
- `pnpm dev` 로 실제 추천 UI 에서 AP 캐리(벡스/리산드라) Top-3 에 JG/IE 등장 육안 확인
- Gap 분석 (`/pdca analyze spell-crit-mechanic`)

---

## 9. Coding Convention Reference

### 9.1 Naming

| 대상 | 규칙 | 예시 |
|------|------|------|
| 상수 | UPPER_SNAKE_CASE | `SPELL_CRIT_ITEMS`, `SPELL_CRIT_UNLOCK_BONUS` |
| 함수 | camelCase | `hasSpellCritItem`, `computeSpellCanCrit` |
| 필드 | camelCase | `spellCanCrit`, `canSpellCrit` |
| 파일 | camelCase.ts | `spellCrit.ts` |

### 9.2 Import Order

```typescript
// 외부 lib
import { describe, it, expect } from 'vitest';

// 내부 절대 경로
import type { CombatUnit, RawItem, ActiveTrait } from '@/types';
import {
  SPELL_CRIT_ITEMS,
  computeSpellCanCrit,
  expectedSpellCritMultiplier,
} from '@/lib/combat/spellCrit';
```

### 9.3 결정론 규칙

- `Math.random()` 직접 사용 금지 — `rng.next()` 만
- crit 판정 `rng.next()` 호출은 **항상 ability 피해 계산 직후** (순서 보장)
- 다단히트는 **한 번만** `rng.next()` 호출 (모든 히트 공유)

### 9.4 React Compiler 규칙

본 작업은 React 컴포넌트 변경 없음. `spellCrit.ts` 는 순수 함수이고 엔진/분석은 React 비의존 레이어.

---

## 10. Implementation Guide

### 10.1 File Structure

```
src/
├── lib/
│   ├── combat/
│   │   └── spellCrit.ts          ← 신규
│   ├── simulator/
│   │   └── engine/
│   │       └── combatLoop.ts     ← 3곳 수정 (line 92, 1966+, 2200+)
│   └── analysis/
│       ├── itemOptimizer.ts      ← interface + estimateDps AP 분기 + extract
│       └── itemRecommender.ts    ← flatStatBonus + tagReason (+ 옵션 B pickTopCombo)
├── types/
│   └── index.ts                  ← CombatUnit.spellCanCrit
└── tests/
    ├── unit/
    │   ├── spellCrit.test.ts              ← 신규
    │   ├── spellCrit.engine.test.ts       ← 신규
    │   ├── spellCrit.optimizer.test.ts    ← 신규
    │   └── spellCrit.recommender.test.ts  ← 신규
    └── calibration/
        └── calibrate-dps.test.ts ← 재실행 (수정 없음)
```

### 10.2 변경 요약

| 파일 | 변경 타입 | 규모 |
|------|---------|------|
| `src/lib/combat/spellCrit.ts` | 신규 | ~50 LOC |
| `src/types/index.ts` | 1 필드 추가 | +2 LOC |
| `src/lib/simulator/engine/combatLoop.ts` | 3곳 수정 | +10 LOC |
| `src/lib/analysis/itemOptimizer.ts` | interface + extract + estimateDps | +15 LOC |
| `src/lib/analysis/itemRecommender.ts` | flatStatBonus + tagReason | +8 LOC |
| `tests/unit/spellCrit*.test.ts` | 신규 4파일 | ~300 LOC |
| **총계** | | **~385 LOC** |

### 10.3 Implementation Order (재명시)

1. [ ] `spellCrit.ts` + `spellCrit.test.ts` (Phase A-1~3)
2. [ ] `CombatUnit.spellCanCrit` + `createCombatUnit` (Phase A-4)
3. [ ] `combatLoop.ts` ability 경로 2곳 수정 (Phase A-5~6)
4. [ ] `spellCrit.engine.test.ts` + golden snapshot 재생성 (Phase A-7~8)
5. [ ] `ItemDpsModifiers` + `estimateDps` (Phase B)
6. [ ] `spellCrit.optimizer.test.ts` + calibration 재실행 (Phase B)
7. [ ] `flatStatBonus` + `tagReason` (Phase C)
8. [ ] `spellCrit.recommender.test.ts` (Phase C)
9. [ ] 통합 검증: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`
10. [ ] `pnpm dev` 로 육안 확인

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-22 | Plan → Design. 공유 모듈 `spellCrit.ts` 설계, 3개 엔진 변경 지점 확정 (line 92/1966/2200), estimateDps AP 분기 공식 명시, 4개 테스트 파일 계획 | Dayoung |
