---
id: spell-crit
type: mechanic
display_name_kr: 스킬 치명타
current_patch_status: active
sim_active: true
last_verified: 2026-06-02 (PR #176 사후 P2-2 — combatLoop.ts 인용 10곳 line drift 일괄 갱신 [5 cast 호출처 +32~+57 + helper 4곳], 의미 매핑·JaxCarry 가드 재verify, fact 변경 0. 이전: 2026-05-26 retro lint cast roll 3→5 정정)
sources:
  - src/lib/combat/spellCrit.ts (computeSpellCanCrit, expectedSpellCritMultiplier, SPELL_CRIT_ITEMS)
  - src/lib/simulator/engine/combatLoop.ts (5 application sites + 3 buff sources — main + recast + OOR + Jax carry main + Jax carry OOR)
  - src/lib/analysis/itemOptimizer.ts (estimateDps AP 분기 spellCritMul)
  - src/lib/analysis/itemRecommender.ts (SPELL_CRIT_UNLOCK_BONUS 가중치 + pickTopCombo/tagReason "스킬 치명타 언락")
related:
  - "[[ability-targeting]]"
  - "[[hero-augment-carry]]"
  - "[[role-passive]]"
---

# 스킬 치명타 (Spell Crit)

## 요약

TFT 룰: **스킬 피해는 기본적으로 치명타가 안 터진다**. 특정 아이템/시너지/챔프 효과로 unit 의 `spellCanCrit` 플래그가 활성화되어야만 능력 시전 시 critical hit roll 이 적용된다 (`rng.next() < critChance` → `dmg *= critMultiplier`).

3 레이어 적용:
1. **sim 엔진** — `combatLoop.ts` **5 cast 호출처** (main / recast / OOR fallback + Jax carry main + Jax carry OOR) 에서 roll 후 데미지 곱
2. **DPS 추정** — `itemOptimizer:estimateDps` AP 분기에 `expectedSpellCritMultiplier = 1 + p×(m-1)` 곱셈자 적용
3. **아이템 추천** — `itemRecommender:flatStatBonus` 가 보건/무대 (AP 캐리) 에 +400 프리미엄 부여

도입: 2026-04-22 plan (PDCA spell-crit-mechanic feature, Match Rate 97% check 단계).

## 활성 조건 — `computeSpellCanCrit(items, traits)` (`src/lib/combat/spellCrit.ts`)

3 카테고리. 어느 하나라도 만족 시 unit `spellCanCrit = true`.

### 1. 아이템 — `SPELL_CRIT_ITEMS` (6종)

| 아이템 | apiName |
|--------|---------|
| 보건 (JeweledGauntlet) 기본 / 타락 / 찬란 | `TFT_Item_JeweledGauntlet`, `TFT_Item_CorruptedJeweledGauntlet`, `TFT_Item_Radiant_JeweledGauntlet` |
| 무대 (InfinityEdge) 기본 / 타락 / 찬란 | `TFT_Item_InfinityEdge`, `TFT_Item_CorruptedInfinityEdge`, `TFT_Item_Radiant_InfinityEdge` |

→ unit-level 활성 (해당 아이템 보유 unit 만 spell crit 가능)

### 2. 시너지 — `SPELL_CRIT_TRAIT_APINAMES`

현재 Set 17 기준 **빈 배열** (`[]`). 운명술사는 unit-level innate 으로 별도 처리 (아래 3번).

설계 의도: 향후 Set 의 Precision 계열 시너지 (team-level 활성 시 전원 spell crit) 추가 가능한 슬롯.

### 3. Unit-level 효과 (`combatLoop.ts` 내 별도 분기)

| 효과 | 위치 | 동작 |
|------|------|------|
| **운명술사 (Fateweaver)** Innate | `applyFateweaverEffects` (line 1776) | `TFT17_Fateweaver` trait count >= 1 (활성 여부 무관) → 운명술사 unit 에 `spellCanCrit = true`. (4) tier 시 추가 Crit Chance +20%, Crit Damage +20% |
| **Akali Precision (DRX N.O.V.A. surge)** | `tickDrxNova` (line 4739, Akali `spellCanCrit` 부여 line 4765) | **Akali cast 가 아님** — DRX N.O.V.A. (5 시너지) 활성 + `TeamAttackDelay` 경과 시 한 번 발동. 발동 시점에 Akali 가 alive 면 모든 alive 아군에 `spellCanCrit = true` 일괄 부여. `state.triggered` 가드로 단발성 |
| **Graves SharpshooterModule (위력)** | `applyGravesFrameEffects` (line 2337, SharpshooterModule case line 2358) | 위력 frame 적용된 Graves 에 `spellCanCrit = true` + AbilityDamage +5% |

## sim 엔진 적용 (`combatLoop.ts`)

### Init (전투 시작)
- `createCombatUnit` (`line 300`): `spellCanCrit: computeSpellCanCrit(allItems, activeTraits)` — 아이템 + 시너지 조합 기반 unit-level 초기화
- 추가 unit-level effect 들 (운명술사 / Akali / Graves) 가 init 후 분기로 활성화

### Critical Roll (5 cast 호출처)
모두 동일 패턴:
```ts
if (unit.spellCanCrit && rng.next() < unit.stats.critChance) {
  dmg *= unit.stats.critMultiplier;
}
```

5 호출처:
- **line 6581** — main cast pipeline (`findAbilityTargets` 결과 적용 시)
- **line 6705** — recast (onKill 등 재시전 경로)
- **line 6927** — **Jax carry damage (main cast 직후 분기)** — `selectedCarryAugment === 'TFT17_Augment_JaxCarry'` 가드 (PR #135/#147 도입)
- **line 7285** — **Jax carry damage (OOR 분기)** — OOR fallback path 내 별도 cast roll, `oorCarryCfg` + 동일 JaxCarry 가드
- **line 7351** — OOR fallback main path (abilityTargets OOR loop, `applyCarryDamageModifiers` 통합 helper 직후)

→ rng 결정론 보장 ([[ability-targeting]] 참조 — SeededRNG). carry-specific 분기 추가 패턴 — 향후 신규 carry augment 도입 시 본 cast roll 리스트 stale 검증 필수 ([[lint-rules]] "Carry augment ingest 시 관련 mechanic page cast roll 갱신" 룰 후보 #4)

## DPS 추정 적용 (`itemOptimizer.ts:estimateDps`)

AP 분기 (line 268~273):
```ts
const spellCritMul = mods.canSpellCrit
  ? expectedSpellCritMultiplier(stats.critChance, stats.critMultiplier)  // 1 + p × (m - 1)
  : 1;
const baseApDps = (100 + stats.ap + ...) * star * totalAS * castFreq * spellCritMul;
```

- `mods.canSpellCrit`: `extractItemDpsModifiers` 에서 `hasSpellCritItem(items)` 로 사전 계산
- AD 분기는 별도 `critMul = 1 + p × (m - 1)` 항상 적용 (line 279) — 평타는 기본 crit 가능
- **AP 캐리 vs AD 캐리 정확도 대칭화** — plan doc 의 핵심 동기 (이전엔 AP 만 crit mul 누락으로 DPS 20~30% 과소평가)

## 아이템 추천 적용 (`itemRecommender.ts`)

### `flatStatBonus` (line 140)
```ts
if (SPELL_CRIT_ITEMS.has(item.apiName)) bonus += SPELL_CRIT_UNLOCK_BONUS; // 400
```

AP 캐리에 보건/무대 추천 시 +400 프리미엄 (다른 AP 가중치 `SpellDamageAmp × 150` 대비 경쟁력).

### `pickTopCombo` / `tagReason` (코드 verify 완료, 2026-05-26)
- `pickTopCombo` (`itemRecommender.ts:190`) 호출 line 290
- `tagReason` (`itemRecommender.ts:229`) 호출 line 291
- `tagReason` 내부 line 231: `if (SPELL_CRIT_ITEMS.has(item.apiName)) return '스킬 치명타 언락';` — 보건/무대 추천 시 "스킬 치명타 언락" 태그 반환

## 코드 위치 정리

| 모듈 | 책임 |
|------|------|
| `src/lib/combat/spellCrit.ts` | `SPELL_CRIT_ITEMS` Set, `computeSpellCanCrit`, `expectedSpellCritMultiplier`, `SPELL_CRIT_UNLOCK_BONUS` |
| `src/lib/simulator/engine/combatLoop.ts` | unit init + 5 cast crit roll (main/recast/OOR + Jax carry main + Jax carry OOR) + 운명술사/Akali/Graves 분기 |
| `src/lib/analysis/itemOptimizer.ts` | `estimateDps` AP 분기 spellCritMul + `extractItemDpsModifiers.canSpellCrit` |
| `src/lib/analysis/itemRecommender.ts` | flatStatBonus 보건/무대 프리미엄 + pickTopCombo (line 190/290) + tagReason (line 229/291) |

## 패치 히스토리

| 시점 | 변경 |
|------|------|
| 2026-04-22 (plan) | PDCA spell-crit-mechanic plan 작성 (`docs/01-plan/features/spell-crit-mechanic.plan.md`) |
| 2026-04-22 이후 | design + 구현 — `spellCrit.ts` 모듈 도입, combatLoop 3 cast 경로에 crit roll 삽입, itemOptimizer AP 분기 + recommender 프리미엄 적용 |
| 2026-05-18 (현재) | **PDCA check 단계, Match Rate 97%** (세션 reminder 기준). 본 위키 페이지로 도메인 지식 file back |
| 17.3 LIVE 변경 | Set 17 운명술사 trait 메커니즘 안정 (별도 변경 없음). Akali Precision (line 4739, `tickDrxNova`) 도 안정 |
| 2026-06-02 | **line drift 일괄 정리** (PR #176 사후 검증 P2-2) — combatLoop.ts 인용 10곳 갱신: 5 cast 호출처 (6549/6673/6895/7228/7294 → 6581/6705/6927/7285/7351, drift +32~+57) + helper 4곳 (createCombatUnit 301→300 / applyFateweaverEffects 1769→1776 / tickDrxNova 4709→4739 / applyGravesFrameEffects 2330+→2337). 의미 매핑·Jax 가드 재verify 완료. **dispatch verify (wiki-ingest-verifier) 로 page-internal stale 2건 추가 fix**: 코드 위치 정리 표 "3 cast → 5 cast crit roll" (P1, Jax carry 분기 도입 후 표 갱신 누락) + itemRecommender 행 "(추정)" 제거 (P2, line 105 verify 완료와 모순) + Akali 부여 line 4761→4765 정정. itemOptimizer/itemRecommender 인용은 drift 없음 |
| 2026-05-26 | **retro lint subagent (PR #154)** — Jax carry hero augment (PR #135/#147 도입) 으로 cast roll 호출처 3 → 5곳 정정. line drift 일괄 갱신. pickTopCombo/tagReason "추정" → 코드 직접 검증 완료 |

## sim 적용 상태 — `active`

✅ **활성**:
- `computeSpellCanCrit` init + 5 cast crit roll (main/recast/OOR + Jax carry main + Jax carry OOR)
- 운명술사 Innate (count >= 1) + (4) tier crit stat
- Akali Precision — DRX N.O.V.A. surge 트리거 (TeamAttackDelay 경과 + Akali alive 시 1회 발동, 모든 alive 아군에 일괄 부여)
- Graves SharpshooterModule (위력) spell crit + AbilityDamage +5%
- `estimateDps` AP 분기 — `expectedSpellCritMultiplier` 적용
- `flatStatBonus` 보건/무대 +400 프리미엄

🔍 **검증 / 미확인 항목**:
- `SPELL_CRIT_TRAIT_APINAMES` 빈 배열 — 향후 Precision 계열 시너지 추가 시 채울 슬롯 (Set 18 등). 현 sim 영향 0 (빈 배열 → `hasSpellCritEnableTrait` early return false)

## 미완 / 보류

- 정밀 (Precision) 계열 시너지 — Set 17 에 명확한 team-level Precision trait 없음. 현재는 운명술사 (unit-level) + Akali (effect) + Graves SharpshooterModule (effect) 3 분기로 처리. 후속 Set 도입 시 `SPELL_CRIT_TRAIT_APINAMES` 활용 가능
- Multi-hit 스킬의 crit 적용 횟수 — 다단히트는 hitCount 마다 별도 roll 인지 single roll 적용인지 design doc 확인 필요 (`ability-targeting.md` `hitCount` 필드 참조)
- non-damaging ability (실드/힐만 주는 스킬) — crit roll 의미 없음. 적용 분기에서 자동 무시되는지 검증

## Lint 체크리스트

- [ ] 다음 패치에서 Precision 계열 신규 시너지 추가 시: `SPELL_CRIT_TRAIT_APINAMES` 갱신 + 본 페이지 update
- [x] `pickTopCombo` / `tagReason` 코드 직접 grep 검증 완료 (2026-05-26 retro lint, itemRecommender.ts:190/229/231)
- [ ] Multi-hit 스킬 crit roll 횟수 검증
- [ ] PDCA `spell-crit-mechanic` Match Rate 100% 달성 시 본 페이지 "검증/미확인" → "활성" 이동
- [ ] **신규 carry augment 도입 시 본 페이지 cast roll 호출처 stale 검증** (PR #154 retro lint 학습 — Jax carry 가 5번째/6번째 호출처 추가했으나 last_verified 갱신 누락 사례)

## 관련

- [[ability-targeting]] — 스킬 적중 unit 집합 결정 (crit roll 적용 전 단계)
- [[hero-augment-carry]] — carry augment 의 ability damage 도 동일 spell crit 경로 사용 (LeonaCarry damage, AatroxCarry slamDamage 등)
- [[role-passive]] — 마나/타게팅과 별개 — spell crit 은 ability cast 후 damage 적용 단계
- 메모리 `feedback_wiki_ingest_verify` — 본 페이지 fact 는 코드 직접 grep verify (PDCA doc 인용은 plan/design 사실 기록용으로만 사용)
