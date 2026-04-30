# Set 17 영웅 증강 (Hero Augment) — 시뮬 구현 도메인 지식

> 작성일: 2026-04-30 (17.2b 패치 시점)
> 출처: 사용자 인게임 데이터 (2026-04-30 직접 측정/스샷)
> 적용 PR: PR3 (`feature/hero-augment-stat-system`)
> 17.2b 변경 표시: ⚠️

## 핵심 개념

**영웅 증강 (Hero Augment)** = 보드 위 가장 강한 (`findStrongestUnitByApi`) 특정 챔프 1명을 augment-specific 빌드로 변환:

1. **역할군 변경** — Tank/Marksman 등 → "공격력 전사" / "주문력 전사" (Fighter / APFighter)
2. **stat 변경** — HP/Armor/MR/AS/range/mana 등 augment 기준으로 재산정
3. **ability 변경** — augment 전용 mana cost / damage / shield / 메커니즘
4. **마나 재생 / 공격 속도 / 타게팅** — 변경된 역할군 룰을 따름 (`mana.ts:ROLE_MANA_CONFIG`)

stat 데이터는 사용자 인게임 측정 후 `statOverrides` 슬롯에 채움. 본 도큐먼트는 **damage/shield/메커니즘 변수** 정리 (사용자 제공분).

## 8 영웅 증강

### 1. 그라가스 — 자폭 (Self-Destruct) `TFT17_Augment_GragasCarry`

| 변수 | 값 |
|---|---|
| 마나 | 30 / 80 |
| 패턴 | aoe_circle, radius 3 |
| 변환 후 역할 | 주문력 전사 (APFighter / Fighter) |
| ⚠️ healthCost (체력 비용) | 0.30 → **0.20** (maxHp 비율) |
| ⚠️ hexReduction (헥스당 감소) | 0.55 → **0.45** |
| baseDamageHpFrac (체력 비율 damage) | 0.10 |
| damage [1성/2성/3성] (AP) | 280 / 420 / 630 |
| tankBonusMultiplier (탱커 추가) | 0.60 (+60%) |
| HP floor | 1 (자기 스킬로 죽지 않음) |

**메커니즘**: 자폭 시 자기 maxHp × 0.20 만큼 self-damage (HP floor 1). 반경 3칸 magic damage = `maxHp × 0.10 + AP × (280|420|630/100)`. 중심에서 1칸 멀어질 때마다 55% → 45% 감소. 탱커 상대 +60%.

**3성 예시 표기**: 285 = maxHp × 30%(이전), 938 = 10% maxHp + 630 AP

---

### 2. 모데카이저 — 뜨거운 죽음 (Heat Death) `TFT17_Augment_MordekaiserCarry`

| 변수 | 값 |
|---|---|
| 마나 | 40 / 100 |
| 패턴 | aoe_circle (오라), 시작 radius 1 |
| 변환 후 역할 | 주문력 전사 (APFighter / Fighter) |
| 패시브 damage [1/2/3] (AP) | 20 / 30 / 45 |
| 오라 확장 주기 | 6초마다 +1칸 |
| ⚠️ shield [1/2/3] (AP) | 175/200/250 → **225/250/300** |
| 사용 시 damage [1/2/3] (AP) | 50 / 75 / 115 |
| 사용 시 지속시간 | 4초 |

**메커니즘**:
- 패시브: 매초 본인 주변 반경 N칸 (시작 1, 6초마다 +1) 에 magic damage `20|30|45`
- 사용 시: `225|250|300` AP 보호막 + 4초 동안 오라 damage 가 `50|75|115` 로 증가

---

### 3. 파이크 — 청부 살인마 `TFT17_Augment_PykeCarry`

| 변수 | 값 |
|---|---|
| 마나 | 0 / 40 |
| 패턴 | single, dash to_lowest_hp (2칸 내) |
| 변환 후 역할 | 공격력 전사 (Fighter) |
| damage [1/2/3] (AD) | 220 / 330 / 500 |
| secondaryDamage [1/2/3] (AD) | 60 / 90 / 135 |
| tankBonusMultiplier | 0.60 (+60%) |
| onKillRecast (처치 재시전) | 0.70 (70% damage) |
| killGoldChance (마지막 일격) | 0.40 / 0.50 / 1.00 |

**메커니즘**: 2칸 내 lowest HP 적에 dash. X 모양으로 베어 대상 + 주변 모든 적 타격. 대상 = AD damage (탱커 +60%), 주변 = secondaryDamage. 처치 시 70% damage 즉시 재시전 (1회 한정 추정 — 사용자 검증 필요).

---

### 4. 잭스 — 저 별을 향해 `TFT17_Augment_JaxCarry`

| 변수 | 값 |
|---|---|
| 마나 | 20 / 80 |
| 패턴 | self_buff |
| 변환 후 역할 | 주문력 전사 (APFighter / Fighter) |
| 패시브 onAttackBonus [1/2/3] (AP) | 45 / 70 / 105 |
| cast damage [1/2/3] (AP) | 155 / 230 / 375 |
| asGain [1/2/3] (영구) | 0.15 / 0.15 / 0.20 |
| moveSpeedGain | 동일 비율 (15/15/20%) |

**메커니즘**: 패시브 — 기본 공격당 추가 magic damage. 사용 — 대상 magic damage + 영구 AS/MS +15%/15%/20% (전투 종료까지 누적).

---

### 5. 꼬마정령 (Ivern Minion) — 빅뱅 `TFT17_Augment_IvernMinionCarry`

| 변수 | 값 |
|---|---|
| 마나 | 50 / 100 |
| 패턴 | aoe_circle, radius 3, dash to_largest_cluster (2칸 내) |
| 변환 후 역할 | 주문력 전사 (APFighter / Fighter) |
| 패시브 onAttackBonus [1/2/3] (AP, 미프) | 40 / 60 / 90 |
| cast damage [1/2/3] (AP) | 240 / 360 / 560 |
| hexReduction (헥스당 감소) | 0.45 |
| stunDuration [1/2/3] | 1.25 / 1.5 / 1.75 (가장 가까운 3명) |

**메커니즘**: 패시브 onAttack 추가 magic (미프 시너지 잠재력 스케일 — 정령족 잠재력 변수). 사용 — 2칸 내 가장 큰 적 무리에 dash, 반경 3칸 magic damage (1칸당 45% 감소), 가장 가까운 3명 1.25/1.5/1.75초 공중 띄움 (stun + knockup).

---

### 6. 아트록스 — 별빛 연계 `TFT17_Augment_AatroxCarry`

| 변수 | 값 |
|---|---|
| 마나 | 30 / 90 |
| 변환 후 역할 | 공격력 전사 (Fighter) |
| 3-skill cycle | 타격 → 휩쓸기 → 찍기 (반복) |
| 타격 damage [1/2/3] (AD) | 140 / 210 / 315 |
| 휩쓸기 damage [1/2/3] (AD) | 100 / 150 / 225 |
| 휩쓸기 패턴 | 원뿔 |
| 휩쓸기 armorReduction (AP) | 10 (방어력 감소) |
| 찍기 damage [1/2/3] (AD) | 160 / 240 / 360 |
| 찍기 패턴 | 반경 1칸 (대상 주변) + 공중 띄움 |
| 찍기 single-target multiplier | 2.50 (단일 적중 시 250%) |
| N.O.V.A. 타격 damage [1/2/3] (AD) | 120 / 180 / 270 |
| N.O.V.A. 효과 | 전장 가르고 모든 적 공중 띄움 |

**메커니즘**: 3가지 스킬을 마나 풀 때마다 번갈아 사용 (cycle counter 필요). 시너지 (4) N.O.V.A. 활성 시 cycle 진입 전 N.O.V.A. 타격 (별도 ability). **본 PR 시뮬 미구현 — abilityData 만 정의.** 후속 PR 로 cycle counter + 패턴 분기.

---

### 7. 뽀삐 — 정령단 속도 `TFT17_Augment_PoppyCarry`

| 변수 | 값 |
|---|---|
| 마나 | 30 / 100 |
| 패턴 | projectile, single, range 4 (이미 rangeOverride) |
| 변환 후 역할 | 원거리 공격력 마법사 (단순화 → Fighter / Marksman, 사용자 결정 필요) |
| baseDamage [1/2/3] (AD) | 340 / 510 / 850 |
| armorScale | 1.00 (100% armor 가산) |
| spiritBounceOnKill | true (처치 시 가장 가까운 적에 튕김, 잔여 damage) |
| spiritEffectPerStack (미프 정령족 스케일) | 0.15 |

**예시**: 1성 damage 표기 385 = 340 AD + 100% armor + 미프 효과. **미프 (정령족 잠재력) 시너지 의존이라 본 PR 시뮬 미구현.** abilityData 만 정의.

---

### 8. 레오나 — 방패 여전사 (Shieldmaiden) `TFT17_Augment_LeonaCarry`

| 변수 | 값 |
|---|---|
| 마나 | 50 / 110 |
| 패턴 | line, dash to_target (최대 3칸), tank-priority |
| 변환 후 역할 | 공격력 전사 (Fighter) |
| pre-dash shield [1/2/3] (AP) | 200 / 240 / 280 |
| pre-dash shield duration | 2초 |
| ⚠️ primary damage [1/2/3] (AD) | 110/165/250 → **90/135/225** |
| primary damage hp scale | 0.28 (+ maxHp × 28%) |
| stunDuration [1/2/3] | 1.0 / 1.25 / 1.5 |
| secondaryDamage [1/2/3] (AD) | 180 / 270 / 405 |

**메커니즘**: 2초 보호막 → 최대 3칸 dash (적이 가장 많은 일직선, 탱커 우선) → 첫 적중 적: AD damage + maxHp 28% + stun. 추가 대상: secondaryDamage AD.

**예시**: 1성 primary damage 306 = 90 AD + 28% maxHp.

---

## 시뮬 구현 우선순위 (PR3 본 범위)

### ✅ 본 PR 적용

| 챔프 | 적용 항목 |
|---|---|
| 그라가스 | healthCost 0.20, hexReduction 0.45 (17.2b), abilityData damage |
| 모데카이저 | shield 225/250/300 (17.2b), abilityData passive damage / cast damage |
| 잭스 | abilityData damage / asGain / passive onAttack damage |
| 레오나 | primary damage 90/135/225 (17.2b), abilityData secondaryDamage / shield |

### ⏭️ 후속 PR (메커니즘 복잡성)

| 챔프 | 미구현 항목 |
|---|---|
| 파이크 | X-shape 멀티 타겟 + onKill 재시전 + killGold |
| 꼬마정령 | dash to_largest_cluster + multi-stun + 미프 스케일 |
| 아트록스 | 3-skill cycle + N.O.V.A. 분기 |
| 뽀삐 | bouncing projectile + 미프 스케일 |

abilityData 슬롯은 모두 채워두되 시뮬 cast 로직만 후속 진행.

### ⏭️ 사용자 인게임 측정 후 채울 항목

`statOverrides` 슬롯 — HP/Armor/MR/AS/range. 사용자가 게임 내에서 augment 활성 vs 비활성 stat 비교 후 PR 추가.

## 17.2b 패치 변경 (본 PR 처리)

| 챔프 | 변수 | 이전 | 17.2b |
|---|---|---|---|
| 그라가스 (자폭) | healthCost | 0.30 | **0.20** |
| 그라가스 (자폭) | hexReduction | 0.55 | **0.45** |
| 모데카이저 (뜨거운 죽음) | shield AP | 175/200/250 | **225/250/300** |
| 레오나 (방패 여전사) | primary damage AD | 110/165/250 | **90/135/225** |

## 참고

- 시뮬 적용 위치: `src/data/carryAugments.ts`, `src/lib/simulator/engine/combatLoop.ts:applyHeroCarryTransforms`
- 마나 재생 룰: `src/lib/simulator/systems/mana.ts:ROLE_MANA_CONFIG`
- 17.2b 패치 계획: [`set17-patch-17-2b-plan.md`](./set17-patch-17-2b-plan.md)
- 17.2b 출처 URL: <https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-2/>
