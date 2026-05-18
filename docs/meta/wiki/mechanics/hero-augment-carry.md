---
id: hero-augment-carry
type: mechanic
display_name_kr: 영웅 증강 carry 변환
current_patch_status: active
sim_active: partial   # role/ability 활성, statOverrides 슬롯 비어있는 augment 다수
last_verified: 2026-05-18
sources:
  - src/data/carryAugments.ts (CarryAugmentConfig + CARRY_AUGMENTS)
  - src/lib/simulator/engine/combatLoop.ts (applyHeroCarryTransforms, findStrongestUnitByApi)
  - docs/meta/wiki/raw/in-game/set17-hero-augments.md (사용자 인게임 측정 raw)
related:
  - "[[patch-17-2b]]"
  - "[[stargazer-fountain]]"
---

# Hero Augment Carry 변환 시스템

## 요약

영웅 증강(Hero Augment)이 활성화되면 **가장 강한 대상 챔프 1명**이 augment-specific 빌드로 변환된다 — 역할군 변경 + stat override + ability override. 17.2b에서 정식 도입된 시스템 ([[patch-17-2b]]). 시뮬 정확도의 핵심: TFT 인게임에서는 augment 활성 시 챔프의 spellCast/패시브 메커니즘이 통째로 바뀌는데, sim도 동일하게 분기해야 함.

## 변환 흐름

`applyHeroCarryTransforms(augmentApiNames, units)` 호출 흐름:

```
augmentApiNames 에서 active hero augment 발견
  ↓
findStrongestUnitByApi(targetChampionApiName) — 대상 챔프 1명 선정
  ↓
1. role 변환  → statOverrides.role ?? 'Fighter' (default)
2. stat 적용 → statOverrides 의 정의된 필드만 (undefined = 기존 유지)
3. ability  → getAbilityConfigForUnit 에서 findCarryAugment lookup
4. flag     → gragasCarryActive / leonaCarryActive (분기용, 호환 보존)
```

### `findStrongestUnitByApi` tie-break

여러 동일 챔프가 보드에 있을 때 단 1명에 적용. 우선순위:
1. **성급(starLevel) 최고**
2. **동급이면 아이템 수 많은 순**
3. **그래도 동률이면 첫 번째** (deterministic — Replay 정합)

## CarryAugmentConfig 구조

`src/data/carryAugments.ts` 정의:

```ts
interface CarryAugmentConfig {
  augmentApiName: string;
  targetChampionApiName: string;
  abilityOverride: AbilityConfig;           // pattern (single/cone/aoe_circle/line/x_shape/self_buff)
  rangeOverride?: number;                   // 사거리 변경 (Poppy 4칸 등)
  damageTypeOverride?: 'physical' | 'magic';
  scalingInput?: CarryScalingInput;         // 누적 스택 표시 (UI)
  abilityData?: CarryAbilityData;           // 27변수 — damage/shield/healthCost/etc
  statOverrides?: HeroAugmentStatOverrides; // 사용자 인게임 측정 대기 슬롯
}
```

### `HeroAugmentStatOverrides` 슬롯 (9개)
`hp / armor / magicResist / damage / attackSpeed / range / mana / initialMana / role`

> 모든 필드 optional. **사용자가 게임에서 augment 활성 vs 비활성 stat 차이를 측정한 데이터로 채움**. 비어있으면 기존 stat 유지 (안전 default).

### `CarryAbilityData` 변수 (27개)
공통: `name / desc / mana / damage / damageType / bonusPerKill`

augment 전용: `shield, shieldDuration, onAttackBonus, passiveDamage, empoweredAuraDamage, empoweredDuration, secondaryDamage, healthCost, selfDamageHpFloor, hexReduction, baseDamageHpFrac, tankBonusMultiplier, asGain, stunDuration, onKillRecastMultiplier, singleTargetMultiplier, armorScale, spiritEffectPerStack, spiritBounceOnKill, armorReduction, slamDamage, slamStunDuration, novaDamage, skillCycleLabels`

## 적용 대상 — CARRY_AUGMENTS (10건)

| augment | 챔프 | pattern | abilityData | statOverrides | 핵심 변수 |
|---------|------|---------|:-----------:|:-------------:|----------|
| `NasusCarry` (꽁!) | TFT17_Nasus | single | ✅ | ❌ | `bonusPerKill` |
| `AatroxCarry` (별빛 연계) | TFT17_Aatrox | cone r=1 | ✅ | ❌ | 3-skill cycle (`skillCycleLabels`) + `novaDamage` + `slamDamage` |
| `PoppyCarry` (정령단 속도) | TFT17_Poppy | single r=4 | ✅ | ❌ | `armorScale 1.0` + `spiritBounceOnKill` |
| [[leona-carry]] (방패 여전사) | TFT17_Leona | line maxT=4, dash | ✅ | ❌ | `shield` + `baseDamageHpFrac 0.24` (17.3) + `secondaryDamage`. ⚠️ **duplicate config**: combatLoop `LEONA_CARRY_ABILITY` (stun 1.5) 가 carryAugments entry (stun 1.0 + stunDuration starLevel별) 를 shadow — 위키 lint #6 |
| `IvernMinionCarry` (빅뱅) | TFT17_IvernMinion | aoe_circle r=3, dash to_largest_cluster | ✅ | ❌ | `hexReduction 0.45` + `stunDuration` |
| `JaxCarry` (저 별을 향해) | TFT17_Jax | self_buff AS+0.15 | ✅ | ❌ | `asGain` 영구 누적 + `onAttackBonus` |
| `PykeCarry` (청부 살인마) | TFT17_Pyke | x_shape, dash to_lowest_hp | ✅ | ❌ | `tankBonusMultiplier 0.60` + `onKillRecastMultiplier 0.70` |
| [[mordekaiser-carry]] (뜨거운 죽음) | TFT17_Mordekaiser | aoe_circle r=1 | ✅ | ❌ | `passiveDamage` (sim 미반영) + `empoweredAuraDamage` + `shield [175,200,400]` (17.3, 3성 대폭 buff) + mana `10/40` (17.3 단축) |
| `GragasCarry` (자폭) | TFT17_Gragas | aoe_circle r=3, selfDamage | ✅ | ❌ | `healthCost 0.20` + `hexReduction 0.45` + `tankBonusMultiplier 0.60` |
| `InvaderZed` (침략자 제드) | TFT17_Zed | self_buff (5단계) | ✅ | ❌ | stage 4-2 획득 전용 |

> **모든 augment 의 `statOverrides` 가 비어있음** — 사용자가 게임에서 augment 활성 후 stat 측정 작업 필요. 채워지면 sim 정확도 큰 폭 상승.

## role 변환 시 자동 따라오는 것

`role` 만 변경하면 다음이 자동 적용 (별도 코드 없이):
- **마나 재생** — `mana.ts:ROLE_MANA_CONFIG` 가 role 별로 분기
- **공격 속도 baseline** — role 별 기본값
- **타게팅 tiebreaker weight** — Tank(3) > Fighter/Assassin(2) > Marksman/Caster/Specialist(1) (`targeting.ts:TARGETING_WEIGHT` ground truth, [[role-passive]] 참조)

→ 사용자 명세 "주문력 전사" / "공격력 전사" 구분은 시뮬 내부 단일 `'Fighter'` 로 단순화. 차별화는 `damageType` + ability 로직으로.

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| 17.2 LIVE | Hero Augment 기초 구조 (carry 변환 개념 시작, 일부 ability override) |
| **[[patch-17-2b]]** (2026-04-29) | **CarryAugmentConfig 정식화 + 8 영웅 증강 abilityData 채움 + statOverrides 슬롯 도입** (PR #68 + PR3). 같은 패치에서 `GragasCarry.healthCost` 30→20%, `hexReduction` 55→45%; `MordekaiserCarry.shield` 175/200/250 → 225/250/300; `LeonaCarry.damage` 110/165/250 → 90/135/225 |
| 17.2b 후속 | PR7-A: `PykeCarry` x_shape pattern + dash to_lowest_hp + onKillRecast / PR7-B: `IvernMinionCarry` dash to_largest_cluster + hexReduction / PR7-C: `AatroxCarry` slam (cycle counter % 3 == 2) + slamStun |
| 17.2b N.O.V.A. 후속 | `AatroxCarry.novaDamage` 추가 — 5-NOVA 시너지 + 타격 선택기 활성 시 |
| 17.3 LIVE (2026-05-13) | **다수 carry augment 수치 조정** — 공식 패치노트 확정. 5건 sim 정합 적용 (PR #115, `39cbce2`, 2026-05-18): Leona/Mord/Jax/Aatrox/IvernMinion. Poppy/Nasus 2건은 적용 위치 모호로 TODO 코멘트 |

## ✅ 17.3 sim 정합 — PR #115 머지 완료 (Lint finding 5 resolved, 2026-05-18)

위키 lint 사이클 완결 사례: ingest (PR #114, 17.3 패치노트 종합) → drift 검출 → 코드 정합 PR (#115, `39cbce2`) → resolved.

| Carry augment | 17.2b → 17.3 변경 | sim 정합 |
|--------------|-------------------|:--------:|
| Shieldmaiden (Leona) | `baseDamageHpFrac` 0.28 → 0.24, `secondaryDamage` `[180,270,405]` → `[200,300,480]` | ✅ |
| Heat Death (Mordekaiser) | `shield` `[225,250,300]` → `[175,200,400]`, mana `40/100` → `10/40` | ✅ |
| Reach for the Stars (Jax) | `damage` `[155,230,375]` → `[170,250,450]` | ✅ |
| Stellar Combo (Aatrox) | 2nd `[100,150,225]` → `[110,165,275]`, 3rd `[160,240,360]` → `[200,300,475]`, isolation `2.5 → 2.0` | ✅ |
| The Big Bang (Meepsie/IvernMinion) | `hexReduction: 0.45 → 0.35` | ✅ |
| Termeepnal Velocity (Poppy) | AS `0.7 → 0.75` (augment grant vs statOverride 모호) | 🔍 TODO (`carryAugments.ts:PoppyCarry` 위 코멘트 — 인게임 verify) |
| Bonk! (Nasus) | resists `40 → 45` (statOverrides 채움 정책 — 인게임 측정 후) | 🔍 TODO (`carryAugments.ts:NasusCarry` 위 코멘트) |

검증: pnpm lint/typecheck/build 통과 + `pnpm vitest run tests/unit/simulator/` 449 passed.
자세한 매핑은 [[patch-17-3]] "조정 Augments — Champion augments" 참조.

## 시뮬 적용 상태 — `partial`

✅ **활성**:
- 10개 augment 모두 abilityData 채워짐 → cast damage 시뮬 정확
- role 변환 + ability pattern + dash + selfDamage 적용
- 17.2b 변경분 (Gragas/Mordekaiser/Leona) 정확 반영
- **17.3 변경분 (Leona/Mord/Jax/Aatrox/IvernMinion 5건) 정확 반영** (PR #115, `39cbce2`)

❌ **미완 (사용자 인게임 측정 대기)**:
- 모든 augment 의 `statOverrides` (HP/armor/MR/AS/range 등 변환 후 stat)
- 자폭(Gragas) 적군 damage path (현재 적군 damage flow skip 구조 — 적군 magic damage 분리 필요)
- Mordekaiser passive 매초 tick (시작 1, 6초마다 +1) — 패시브 hook 미구현
- Aatrox 3-skill cycle counter (현재 모든 cast가 첫 cycle '타격' 으로 적용)
- Pyke X-shape onKill 재시전 (`onKillRecastMultiplier 0.70`) — onKill hook 분기 필요
- Poppy `spiritBounceOnKill` — onKill hook 분기 필요
- 정령족 잠재력 (미프) `spiritEffectPerStack` 시너지 스케일

## 메모리 — 데이터 수정 원칙

`carryAugments.ts` 는 사용자가 직접 측정한 값으로 채우는 곳. raw augments JSON 과 달리 사용자 의도가 강한 파일. 17.2 작업 중 raw JSON 전체 덮어쓰기로 사용자 작성 한글 desc 가 모두 날아간 사고 발생 — **같은 사고 재발 방지**: 변경 필드만 부분 Edit. → `feedback_data_edit` 메모리.

## Lint 체크리스트

- [ ] 새 hero augment 추가 시: CARRY_AUGMENTS entry + abilityData 채워졌는지 + 본 페이지 표 update
- [ ] 사용자가 statOverrides 측정 채울 때: 이 페이지 "❌ 미완" → "✅ 활성" 으로 이동
- [ ] AbilityConfig pattern 새 추가 시 (x_shape 처럼): 본 페이지 흐름 섹션 갱신
- [ ] 다음 패치에서 abilityData 변수 추가/제거 시 ("27변수" 카운트 갱신)

## 관련

- [[patch-17-2b]] — 도입 패치
- raw: `docs/meta/wiki/raw/in-game/set17-hero-augments.md` (사용자 인게임 측정 데이터)
- `mana.ts:ROLE_MANA_CONFIG` — role 변환 후 자동 따라오는 마나 재생 룰 (향후 `mechanics/role-passive.md` 분리 가능)
- 메모리: `feedback_data_edit` (raw 수정 원칙)
