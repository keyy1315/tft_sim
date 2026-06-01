---
id: role-passive
type: mechanic
display_name_kr: Role 패시브 시스템
based_on: Patch 15.1 Roles Revamped
current_patch_status: active
sim_active: true
last_verified: 2026-05-18
sources:
  - src/types/index.ts (UnitRole type)
  - src/lib/simulator/systems/mana.ts (ROLE_MANA_CONFIG + gain helpers)
  - src/lib/simulator/systems/targeting.ts (TARGETING_WEIGHT + findTarget)
  - src/lib/simulator/engine/combatLoop.ts (FlatManaRestore aggregation, channelerInnateManaGain init)
  - CLAUDE.md (Role 기반 마나 표 + 타게팅 룰)
related:
  - "[[hero-augment-carry]]"
---

# Role 패시브 시스템

## 요약

6 Role (`Tank / Fighter / Marksman / Caster / Assassin / Specialist`) 마다 **마나 획득** / **타게팅 우선순위** / 일부 baseline stat 이 자동 분기. role 변경만으로 ([[hero-augment-carry]] 처럼) 마나/타게팅 룰이 따라옴 — sim 의 핵심 자동 행동.

기반: Patch 15.1 "Roles Revamped" (TFT 룰), 현 sim 은 이를 코드 상수로 구현.

## 마나 시스템

### `ROLE_MANA_CONFIG` (`mana.ts`)

| Role | 공격당 마나 | 초당 마나 | 피격 시 마나 |
|------|:-----------:|:--------:|:-----------:|
| Tank       | 5  | 0 | ✅ |
| Fighter    | 10 | 0 | ❌ |
| Marksman   | 10 | 0 | ❌ |
| Caster     | 7  | 2 | ❌ |
| Assassin   | 10 | 0 | ❌ |
| Specialist | 10 | 0 | ❌ |

### 공격 시 마나 — `gainManaOnAttack(unit)`

```
stunned? → return (모든 role 적용 — Caster 만 아님!)
base = ROLE_MANA_CONFIG[role].manaPerAttack + unit.itemFlatManaPerAttack
gain = base × channelerMultiplier(unit)
unit.currentMana = min(maxMana, currentMana + gain)
```

### 틱마다 마나 재생 — `gainManaPerTick(unit, tickDuration)`

```
stunned? → return
ROLE_MANA_CONFIG[role].manaPerSecond ≤ 0 ? → return
gain = manaPerSecond × tickDuration × channelerMultiplier(unit)
```

**Caster 만 활성** (manaPerSecond = 2). 다른 role 은 모두 0 으로 short-circuit.

### 피격 시 마나 — `gainManaOnDamageTaken(unit, damageTaken)` (Tank 전용)

```
manaFromDamage = false ? → return
baseGain = min(42.5, (damageTaken / maxHp) × 100 × 0.7)
gain = baseGain × channelerMultiplier(unit)
```

- **42.5 cap**: 피해량이 maxHp 의 ~60.7% 이상일 때 cap 발동
- **× 0.7 계수**: TFT 룰 — damage% 의 70% 만 마나로 환산
- **Tank 만** `manaFromDamage: true`

## 마나 보너스 (role 무관)

### Item: `FlatManaRestore` → `itemFlatManaPerAttack`
- 쇼진의 창 (`TFT_Item_SpearOfShojin`) + 변종 (`TFT_Item_CorruptedSpearOfShojin`, 찬란한 변종) — 둘 다 Set 17 에서 `FlatManaRestore = 5`
- `applyItemStaticEffects` 가 `unit.itemFlatManaPerAttack += 5` 누적
- `gainManaOnAttack` 의 base 에 합산

### Trait: `TFT17_ManaTrait` (전달자) → `channelerInnateManaGain` 곱셈자
- `channelerMultiplier(unit) = 1 + (unit.channelerInnateManaGain ?? 0)`
- raw audit (PR #64): `InnateManaGain = 0.20` → 마나 가산 × 1.20
- 모든 마나 획득 경로 (attack/tick/damage) 에 적용
- 전달자 unit 한정

## 타게팅 시스템

### 우선순위 (`findTarget`)

```
1. 도발 (taunt) 오버라이드 — statusEffect 에 taunt 있으면 해당 unit 강제
2. 거리 (hexDistance) — 가장 가까운 적 후보군 추출
3. Role 가중치 (TARGETING_WEIGHT) — 가장 높은 가중치
4. 동률 → 시드 RNG (deterministic, Replay 정합)
```

### `TARGETING_WEIGHT` (`targeting.ts`)

| Role | 가중치 |
|------|:-----:|
| Tank | **3** |
| Fighter | 2 |
| Assassin | **2** |
| Marksman | 1 |
| Caster | 1 |
| Specialist | 1 |

**Tank(3) > Fighter/Assassin(2) > Marksman/Caster/Specialist(1)**.

## ⚠️ Lint findings — CLAUDE.md vs 코드 stale

위키 도입 ingest 중 검출. 코드가 ground truth:

### 1. Targeting weight 오류 (CLAUDE.md)

CLAUDE.md (현재):
> Tank (weight=3) > **Fighter/Marksman/Caster/Specialist** (weight=2) > **Assassin** (weight=1)

코드 (`TARGETING_WEIGHT`):
> Tank=3, Fighter=2, **Assassin=2**, **Marksman=1, Caster=1, Specialist=1**

→ 5/6 role mismatch. **CLAUDE.md update 권장** — Patch 15.1 spec 자체가 바뀐 건지, 처음부터 잘못 적혀있는 건지 추가 확인 필요. 단 sim 동작은 코드 기준.

### 2. Specialist 마나 룰 모호 (CLAUDE.md)

CLAUDE.md (현재):
> Specialist | 고유 | 고유 | 고유

코드 (`ROLE_MANA_CONFIG.Specialist`):
> { manaPerAttack: 10, manaPerSecond: 0, manaFromDamage: false } — Fighter/Marksman/Assassin 와 동일

→ "고유"는 spec 의미이고 sim 은 표준 적용 중 (Specialist 챔프별 고유 메커니즘은 ability 레벨에서 분기). CLAUDE.md 표현 갱신 권장.

### 3. CC-마나 차단 범위 (CLAUDE.md)

CLAUDE.md (현재):
> Caster는 CC(스턴 등)로 공격이 막히면 마나 획득이 완전 중단됨에 주의.

코드 (`gainManaOnAttack` + `gainManaPerTick`):
> `if (isStunned) return;` — **모든 role** 에 적용. Caster 만이 아님.

→ CLAUDE.md 가 Caster 특수성 강조하다 잘못 표현. 실제론 stun 이 attack 자체를 막아서 attack 마나 못 받는 게 모든 role 공통. Caster 만 추가로 per-second 마나도 차단되는 특징이 있긴 함.

## Role 변환 시 자동 따라오는 것

[[hero-augment-carry]] 등에서 `target.role = 'Fighter'` 단 한 줄로 변경하면 다음이 즉시 적용:
- **마나 획득**: `getManaConfig(role)` 가 분기
- **타게팅 가중치**: `getTargetingWeight(role)` 가 분기 (적이 이 unit 을 어떻게 타게팅하는가)
- **AS baseline** (champion.stats.attackSpeed 는 보존되지만 role 별 동작 차이는 ability 룰에서)

→ "주문력 전사" / "공격력 전사" 처럼 in-game 표현이 다르더라도 sim 내부엔 `'Fighter'` 단일. 차별화는 ability config (damageType, pattern) 로.

## Lint 체크리스트

- [ ] CLAUDE.md "타게팅 시스템 핵심 원칙" 섹션의 가중치 표 갱신 (이 페이지 검증값으로)
- [ ] CLAUDE.md "Role별 마나 획득 규칙" 표의 Specialist row 및 Caster CC 설명 갱신
- [ ] `0.7` 계수의 출처 (Riot patch note? 추정?) — 미확인. 다음 패치에 변경 가능성 모니터
- [ ] `42.5` mana cap 의 출처 동일 — 미확인
- [ ] Set 17 신규 trait 가 마나/타게팅 룰 분기 추가 시: 본 페이지 갱신

## 관련

- [[hero-augment-carry]] — role 변환의 주요 trigger (영웅 증강 활성 시)
- 메모리 `feedback_codex_review_workflow` — review-driven lint 처리 워크플로우
- 후속 ingest 후보: `mechanics/ability-targeting` (`findAbilityTarget` — role-passive 와 별개의 타게팅 경로)
