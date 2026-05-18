---
id: ability-targeting
type: mechanic
display_name_kr: 어빌리티 타게팅 (패턴 기반)
current_patch_status: active
sim_active: true
last_verified: 2026-05-18
sources:
  - src/lib/simulator/systems/ability.ts (findAbilityTargets, AbilityConfig)
  - src/types/index.ts (AbilityPattern 9종, AbilityTargetingType 8종 — dead code)
  - src/lib/simulator/engine/combatLoop.ts (findAbilityTargets 호출 3 위치)
related:
  - "[[role-passive]]"
  - "[[hero-augment-carry]]"
---

# Ability Targeting (패턴 기반 적중 hex 집합 결정)

## 요약

어빌리티 시전 시 **어떤 유닛에 효과가 적용되는가**를 결정하는 시스템. `AbilityConfig.pattern` + `findAbilityTargets` (plural) 가 live 플로우. **9 패턴** 지원 (single / line / aoe_circle / cone / multi / bounce / global / self_buff / x_shape).

[[role-passive]] 의 `findTarget` 은 primary target 1명 선정. 본 페이지는 그 primary target 을 중심으로 **추가 적중 유닛 집합** 을 계산한다.

## 시스템 흐름

```
1. unit.target = findTarget(unit, enemies, rng)   ← [[role-passive]] (거리+role weight+RNG)
2. config = CHAMPION_ABILITY_PATTERNS[apiName]    ← 챔프별 AbilityConfig
   (carry augment 활성 시 carryAugments.ts 의 abilityOverride 가 대체)
3. targets = findAbilityTargets(unit, primaryTarget, opposingTeam, config)
   → pattern 별로 hex 집합 계산 → 그 안의 alive unit 만 반환
4. targets 각각에 damage / debuff / stun 등 적용
```

`combatLoop.ts` 의 호출처 3곳: main cast (line 6351), recast on-kill (6552), out-of-range fallback (6991).

## 9 패턴 (`AbilityPattern` ground truth)

| pattern | 알고리즘 | 핵심 변수 | 사용처 |
|---------|---------|----------|--------|
| `single` | primary target 1명만 반환 | — | Nasus carry, 단일 타겟 챔프 |
| `line` | caster→target 직선 8칸 hex 집합, 거리순 정렬, `maxTargets` cap | `maxTargets`, `dash` | Leona carry (maxTargets=4) |
| `aoe_circle` | primary target 위치 기준 `radius` 반경 hex 집합 | `radius` (default 1) | Mordekaiser/Gragas/IvernMinion carry |
| `cone` | caster→target 방향 원뿔 (`radius` deep) | `radius` (default 2) | Aatrox carry (radius=1) |
| `multi` | caster 기준 가까운 순 정렬 `maxTargets` 개 (primary 무시) | `maxTargets` (default 3) | Mel, Azir 등 |
| `bounce` | primary 시작, 마지막 hit 기준 가까운 미적중 unit 으로 튕김, `maxTargets` 회 | `maxTargets` (default 2) | Poppy 정령단 속도 (`spiritBounceOnKill` 별도) |
| `global` | alive enemy 전원 | — | 글로벌 ult |
| `self_buff` | caster 본인 1명 (적 대상 X) | `selfBuff` config 객체 | Jax carry, Sion 등 |
| `x_shape` | primary 위치 + 4 diagonal hex (NE/NW/SE/SW), horizontal 제외 | — | Pyke carry (PR7-A, 17.2b 도입) |

## `AbilityConfig` 핵심 필드

```ts
interface AbilityConfig {
  pattern: AbilityPattern;        // 위 9종
  radius?: number;                 // aoe_circle, cone
  maxTargets?: number;             // line, multi, bounce
  damageDecay?: number;            // 거리당 감소 (hexReduction 과 다름 — Config 자체 감쇠)
  dash?: 'to_target' | 'to_farthest' | 'to_lowest_hp' | 'to_backline' | 'to_largest_cluster';
  stun?: number;                   // 타겟 기절 (초), stunTargets 로 대상 제한
  heal?: boolean;                  // 시전자 회복 (JSON Heal 변수)
  selfBuff?: { attackSpeed?, ad?, ap?, durability?, duration? };
  allyBuff?: { attackSpeed?, duration? };
  debuff?: { armorReduction?, mrReduction?, duration? };
  hitCount?: number;               // 다회 타격 (벨베스 12, 아칼리 5)
  dot?: { duration: number };      // DOT 지속 피해
  damageVar?: string;              // parseAbility 오버라이드
  // ... + carry augment 전용 27 변수 ([[hero-augment-carry]] 참조)
}
```

> `CHAMPION_ABILITY_PATTERNS` (ability.ts) 가 챔프별 default config 저장. `carryAugments.ts:CarryAugmentConfig.abilityOverride` 가 augment 활성 시 대체.

## Pattern 별 알고리즘 노트

### `line` — 거리순 cap
직선 hex 집합 → caster 와의 거리 오름차순 정렬 → `maxTargets` slice. 즉 가까운 순으로 cap.

### `multi` — primary 무시
다른 패턴과 달리 primary target 을 안 씀. caster 위치 기준 가까운 순으로 `maxTargets` 개 (primary 가 포함되든 말든).

### `bounce` — 누적 hit 추적
`hit: Set<id>` 로 이미 맞은 unit 제외하며 마지막 hit 위치 기준 가까운 unit 으로 튕김. `maxTargets` 도달 또는 후보 없으면 종료.

### `x_shape` — axial 4 diagonal
TFT axial 6 방향 중 horizontal (E/W = `[±1, 0]`) 제외, 4 diagonal direction 만 사용:
- NE `[+1, -1]`, NW `[0, -1]`, SE `[0, +1]`, SW `[-1, +1]`

대상 본인 + 4 diagonal hex 의 alive unit 반환. raw 데이터 없어 sim 추정 (PR7-A 17.2b 도입).

### `default` (unknown pattern)
fallback = `[primaryTarget]` (single 과 동일). 안전 default.

## ⚠️ Lint finding — Dead code triad (위키 검출 4번째 사례)

다음 3 식별자가 **0 호출처** (sim 미사용 dead code):

| 식별자 | 위치 | 상태 |
|--------|------|------|
| `AbilityTargetingType` | `src/types/index.ts:396` | 8 값 (current_target/farthest/nearest/lowest_hp/lowest_hp_ally/random/self/aoe_center) 정의되어 있으나 어떤 데이터/코드도 이 type 의 string 을 set/read 하지 않음 |
| `findAbilityTarget` (singular) | `src/lib/simulator/systems/targeting.ts:71` | switch 8 케이스 구현되어 있으나 grep 결과 호출처 없음 (정의만 있음) |
| `Ability.targeting` 필드 | `src/types/index.ts:439` (Ability interface) | `interface Ability` 의 `targeting: AbilityTargetingType` 필드 — 어떤 코드도 `.targeting` 으로 읽지 않음 |

**왜 dead 인가**: sim 은 `AbilityConfig.pattern` (위 9종) + `findAbilityTargets` (plural) 경로만 사용. legacy `Ability` interface 가 transition 중에 남은 잔재로 추정. 

**조치 제안 (sim 정확도 아님, 코드 클린업 차원)**:
- 옵션 A: dead code 제거 (`AbilityTargetingType` type, `findAbilityTarget` 함수, `Ability.targeting` 필드)
- 옵션 B: 보존하고 데드 표시 (`@deprecated` JSDoc) — 향후 어떤 챔프가 actual targeting 분기 필요 시 재활성 후보

→ 별도 sim 클린업 PR 후보 (위키 차원 결정 아님).

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| (Set 17 초기) | `findAbilityTargets` 8 패턴 도입 (single/line/aoe_circle/cone/multi/bounce/global/self_buff) |
| [[patch-17-2b]] (PR7-A) | `x_shape` 패턴 추가 — Pyke carry "X 모양 베기". 9 패턴 완성 |
| (legacy 잔재) | `AbilityTargetingType` + `findAbilityTarget` (singular) + `Ability.targeting` 필드 — 도입 시점 미상, 현재 dead code |

## sim 적용 상태 — `active`

✅ **모두 활성**:
- 9 패턴 전부 sim 동작
- `combatLoop.ts` 3 호출처 (main / recast / OOR fallback)
- carry augment override 작동 ([[hero-augment-carry]])
- **`damageDecay` 적용 중** — 6 챔프 사용 (TFT16_Yunara/Gangplank/Caitlyn/Ryze, TFT17_Gnar/AurelionSol). `combatLoop.ts:6479` 에서 `dmg *= (1 - damageDecay)^ti` 적용 (타겟 인덱스별 감쇠)
- **`dot.duration` 적용 중** — 8 챔프 사용 (TFT17_Nasus/Talon/Pantheon/Viktor/Diana/AurelionSol/Bard/Morgana). `combatLoop.ts:6390` (main) + `:7050` (OOR fallback) 양 경로 처리. `perTickDmg = mitigated / duration * TICK_DURATION`

❌ **미완 / 검증 필요**:
- (현재 본 페이지 범위에서 명확히 unused 인 ability config 필드 없음 — 정기 lint 시 재확인)

## Lint 체크리스트

- [ ] 신규 챔프 abilityConfig 추가 시 9 패턴 중 하나로 매핑되는지 (`default` fallback 의존 금지)
- [ ] `findAbilityTarget` (singular) / `AbilityTargetingType` / `Ability.targeting` — 사용자 결정 후 제거 또는 deprecated 표시
- [x] `damageDecay` 실제 사용 챔프 검증 (2026-05-18 — PR #113 Codex P2 자기-fix). 6 챔프 + combatLoop:6479 active.
- [x] `dot.duration` 실제 사용 챔프 검증 (2026-05-18 동일 fix). 8 챔프 + combatLoop:6390/7050 active.
- [ ] 신규 패턴 추가 시 `AbilityPattern` type + `findAbilityTargets` switch 양쪽 갱신 필요

## 관련

- [[role-passive]] — primary target 1명 선정 (`findTarget` — 본 페이지의 input)
- [[hero-augment-carry]] — `carryAugments.ts:abilityOverride` 가 패턴/config 대체
- 메모리 `feedback_wiki_ingest_verify` — 본 페이지 fact 는 코드 직접 grep 으로 verify (CLAUDE.md 미인용)
