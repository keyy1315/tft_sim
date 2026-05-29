---
id: jax
type: champion
display_name_kr: 잭스
api_name: TFT17_Jax
cost: 2
traits:
  - 별돌보미
  - 요새
role: Tank   # raw "APTank" → mapGameRole() → sim Tank. ⚠️ JaxCarry augment 활성 시 Fighter 로 변환 (applyHeroCarryTransforms)
raw_role: APTank
current_patch_status: active (17.3 LIVE, 17.4 patch pending — sim 미반영, [[patch-17-4]] 참조)
sim_active: partial
last_verified: 2026-05-29 (17.4 patch fact 추가, sim 미반영 명시; 이전: 2026-05-21)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Jax entry)"
  - "src/types/index.ts:39 (mapGameRole: 'Tank' 포함 → 'Tank')"
  - "src/lib/simulator/systems/ability.ts:206 (abilityOverride aoe_circle r=1 + stun 1.5 + selfBuff durability 0.3 for 3s)"
  - "src/lib/simulator/engine/combatLoop.ts:2258-2296 (applyHeroCarryTransforms — JaxCarry 활성 시 role=Fighter + selectedCarryAugment set)"
  - "src/lib/simulator/engine/combatLoop.ts:4643 (carry 변환 시 Fighter AS bonus 자동 수령)"
  - "src/lib/simulator/engine/combatLoop.ts:6193-6195 (self_buff pattern self-hit 회피 comment — Jax/Zed carry 사례)"
  - "tests/unit/simulator/hero-carry-augments.test.ts:223+ (JaxCarry asGain starLevel별 회귀 가드)"
  - "tests/unit/simulator/stargazer-huntress-serpent.test.ts (apJax fixture — 별돌보미 + 사냥꾼 통합)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[hero-augment-carry]]"
  - "[[jax-carry]]"
  - "[[stargazer]]"
  - "[[patch-17-3]]"
  - "[[patch-17-4]]"
---

# 잭스 (Jax)

## 요약

2코스트 **Tank** (raw `APTank` → `mapGameRole()` → sim Tank, [[role-passive]]), 별돌보미(Stargazer) + 요새(Bastion) 시너지. raw 어빌리티 "별의 반격(Counter Strike)" — 3초 방어 태세 (피해 감소 + 보호막) 후 주변 적 AOE magic + stun.

[[jax-carry]] (저 별을 향해) augment 활성 시 가장 강한 Jax 1명이 **Fighter 로 변환** + abilityOverride `self_buff` 패턴 + onAttackBonus 패시브 + asGain 영구 누적. 본 페이지는 **base raw Jax** (carry 미활성) 의 sim 동작을 다루며, carry 변환 사항은 [[jax-carry]] 참조.

> ⚠️ Role 주의 — base vs carry: raw role `APTank` → `mapGameRole` ([[role-passive]]) **Tank** (weight 3, 공격당 마나 5, 피격 시 마나 ✅). 단 **JaxCarry augment 활성 시** `applyHeroCarryTransforms` (`combatLoop.ts:2265`) 가 `target.role = 'Fighter'` 로 덮어씀 → Fighter 룰 (weight 2, 공격당 마나 10, 피격 시 마나 ❌). 동일 챔프가 augment 유무에 따라 role 분기. ([[shen]] 의 raw `APFighter` → sim Fighter 와는 다른 메커니즘: Jax 는 augment 가 role 자체를 변경)

## 메커니즘 (base raw, carry 미활성)

### Stats (raw, 17.3 LIVE)

| Stat | 값 |
|------|---|
| hp | 950 |
| armor / magicResist | 45 / 45 |
| damage | 50 |
| attackSpeed | 0.65 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 20 / 80 |

### Active — 별의 반격 (Counter Strike)

raw 명세 (`public/data/tft_set17_champions.json` desc): "`@Duration@`초 동안 방어 태세에 들어가 받는 피해량이 `@ModifiedFlatDR@ (scaleAP)` 감소하고 `@ModifiedShield@(scaleAP)`의 보호막을 얻습니다. 방어 태세가 끝나면 주변 적을 후려쳐 `@ModifiedDamage@(scaleArmor scaleMR)`의 마법 피해를 입히고 `@StunDuration@`초 동안 기절시킵니다."

→ **3단계 효과**: (1) `Duration`초 자기 buff (DR + shield), (2) duration 만료 시 주변 AOE damage, (3) AOE 적에 stun.

**sim 적용** (`ability.ts:206`):
```ts
TFT17_Jax: { pattern: 'aoe_circle', radius: 1, stun: 1.5, selfBuff: { durability: 0.3, duration: 3 } }
```

→ cast 시점 즉시 모두 적용: aoe_circle r=1 damage + stun 1.5초 + selfBuff durability 0.3 (3초). **3초 지연 AOE 미모델링** (raw spec 의 "방어 태세가 끝나면" delay 가 sim 에 instant 로 처리됨).

### raw ability variables (★1~★4 인덱스 — 첫 값 sentinel filler)

| 변수 | raw 값 | sim 적용 | 비고 |
|------|--------|---------|------|
| `Duration` | `[3,3,3,3,3,3,3]` (전부 3초) | ✅ selfBuff.duration 3 (정합) | 단 sim 은 cast 시점 즉시 AOE → "방어 태세 끝나면" delay 누락 |
| `FlatDR` | `[0, 15, 20, 25, 30, 0, 0]` ★1=15, ★2=20, ★3=25, ★4=30 | ❌ **미반영 (semantic 불일치)** | raw 는 **flat damage reduction 수치 + AP 스케일**. sim 은 `selfBuff.durability 0.3` (30% **percentage** reduction) — 단위/스케일 양쪽 다름 |
| `ShieldAP` | `[0, 400, 450, 500, 600, 0, 0]` ★1=400, ★2=450, ★3=500, ★4=600 | ❌ **미반영** | base ability 가 shield 부여 — sim 의 selfBuff 분기에 shield 적용 없음. `getAbilityShield` 헬퍼는 별도 경로 (PR #105 등 carry 한정) |
| `StunDuration` | `[1.5, 1, 1.25, 1.5, 1.75, 1.5, 1.5]` ★1=1.0, ★2=1.25, ★3=1.5, ★4=1.75 (index 0 sentinel 1.5) | ❌ **미반영 (starLevel별)** | sim 은 `stun: 1.5` 하드코딩 — ★2 실제 1.25초, ★3 1.5초, ★4 1.75초 starLevel 스케일 미반영. [[ability-targeting]] cast path 3종 (main + OOR + recast) 모두 영향 |
| `ArmorMRScale` | `[50, 0.75, 1.15, 1.7, 2.9, 500, 500]` ★1=0.75, ★2=1.15, ★3=1.7, ★4=2.9 (base 50 + sentinel) | 🔍 **미verify** | raw 명세 `@ModifiedDamage@(scaleArmor scaleMR)` 는 `base + armor*scale + MR*scale` 추정. sim 의 aoe_circle damage 가 어떤 base 값을 read 하는지 추가 verify 필요 (`Damage` 필드 없음 — `readVarByStar` fallback 동작?) |
| `AttackRadius` | `[1,1,1,1,1,1,1]` (전부 1) | ✅ aoe_circle r=1 (정합) | — |

### Trait — 별돌보미(Stargazer) + 요새(Bastion)

- **별돌보미**: 강화 칸의 별돌보미 유닛에 별자리 효과 추가 적용 — [[stargazer]] 참조. Jax 는 1코 별돌보미 4명 (나서스/뽀삐/렉사이/리산드라/등) 그룹과 별개 2코.
- **요새**: Bastion — `applyBastionEffects` (`combatLoop.ts:1817` 함수 정의 + `:4580-4581` combat-start 호출) 통합. Tank role 보강 효과 (armor/MR 가산 + `bastionDoubleEndTick` Duration doubled 만료 처리). PR #162 subagent P2-4 정정 (이전 `traitModules.ts` 잘못 인용).

## JaxCarry 변환 시 (참조)

JaxCarry augment 활성 시:
- `applyHeroCarryTransforms` (`combatLoop.ts:2258-2296`): `target.role = 'Fighter'` + `target.selectedCarryAugment = 'TFT17_Augment_JaxCarry'`
- `getAbilityConfigForUnit` 가 base ability override 대신 JaxCarry abilityOverride (`self_buff` 패턴 + selfBuff.attackSpeed 0.15) 적용
- onAttackBonus 패시브 + asGain 영구 누적 + cast damage hook 분기
- **선택**: `selectedCarryAugment` 단일 — 다중 Jax 카피 시 가장 강한 1명만 변환 ([[hero-augment-carry]] selected single-carry semantics, PR #144 일반화)

상세 cast path / 패치 변경 / lint 사례는 [[jax-carry]] 참조.

## 패치 히스토리 (base raw)

| 패치 | 변경 | sim 적용 |
|------|------|---------|
| [[patch-17-2b]] (2026-04-29) | `ShieldAmount` (=`ShieldAP`): `400/500/625 → 400/470/550` — base ability shield 너프 | ❌ sim 미반영 (ShieldAP 자체 미적용) |
| [[patch-17-3]] (2026-05-13) | `FlatDR` (AP): `15/25/35/45 → 15/20/25/30` + `ShieldAP`: `400/470/550 → 400/450/500` — base ability 너프 2건 | ❌ sim 미반영 (양쪽 변수 모두 dead in sim) |
| [[patch-17-4]] (2026-05-27) | **조정 (Adjustment)**: `FlatDR` **AP 스케일링 제거** — `15/20/25 AP` (★1~★3) → **`20/25/30`** (평탄 수치, AP scaling 제거). raw desc 의 `(scaleAP)` 제거 | ❌ sim 미반영 + **분기 구조 영향**: AP scaling 자체 제거라 단순 수치 변경 아니라 변수 type 변경 (AP 의존 → flat). [[patch-17-4]] sequence B/C 대기 |

⚠️ **17.4 sim 영향 평가**:
- FlatDR 값 자체는 sim dead (Jax 의 `selfBuff.durability hardcoded 0.3` 우선 적용, [[poppy]] G1 패턴과 동일) → 17.4 변경의 sim 영향 sim dead state 라 0
- **분기 구조 변경**: raw desc 의 `(scaleAP)` 제거는 raw json 의 ability variable schema 변경 가능성 (variable name 또는 type 변경). raw data fetch (sequence B) 시 schema 정합 verify 필요
- ★ 수 감소 (4 → 3) — raw vars sentinel filler 패턴 변경 가능성 (이전 `[15, 25, 35, 45]` → 새 `[20, 25, 30]` 등). raw data fetch 시 길이 + sentinel 정합 verify

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.3 정합 (hp 950, armor/MR 45, AS 0.65, mana 20/80, range 1)
- ability pattern `aoe_circle r=1` + stun 1.5 (★2 starLevel 스케일은 미반영)
- selfBuff durability 0.3 (30% damage reduction) — 단 raw `FlatDR` (flat 수치) 의미와 다른 % 적용
- carry 미활성 시 raw role `APTank` → mapGameRole → **Tank** 자동 분기 (mana on-hit 수령 / weight 3 / damage reduction ×1.0)
- JaxCarry 변환 시 role `Fighter` + selectedCarryAugment set (`applyHeroCarryTransforms`)

❌ **미반영**:
- **3초 지연 AOE** — raw 는 "방어 태세 만료 시 주변 AOE" 시퀀스. sim 은 cast 즉시 selfBuff + damage + stun 동시 적용
- **`ShieldAP` (보호막)** — base ability 의 AP 스케일 shield 없음 (sim selfBuff 분기에 shield 추가 안 함)
- **`FlatDR` raw 수치** — 30% durability 하드코딩 (raw `15~30 + AP scale flat reduction` 의미 미반영)
- **`StunDuration` starLevel별** — 1.5초 하드코딩 (★1=1.0, ★2=1.25, ★3=1.5, ★4=1.75 raw 스케일 미반영)
- 17.2b/17.3 두 차례 patch 변경 (`FlatDR`, `ShieldAP`) — sim 미반영 (변수 자체 dead)

🔍 **검증 필요**:
- `ArmorMRScale` 기반 damage formula (`@ModifiedDamage@(scaleArmor scaleMR)`) — raw 명세는 `base + armor*scale + MR*scale` 추정. sim aoe_circle damage 가 어떤 값을 read 하는지 (`damageVar` 미지정 → `'Damage'` fallback? raw 에 `Damage` 변수 없음) 추가 verify 필요
- `Duration` 의 3초 selfBuff vs raw "방어 태세 만료 후 AOE" 의도 차이 — gameplay 시뮬 정확도 평가 필요 (boss 가 3초 후 죽으면 sim 은 다시 시전 가능 vs raw 는 만료 후 AOE 가 나옴)

## Lint 신규 등록 후보 (champion ingest 발견)

본 페이지 작성 중 **base Jax (carry 미활성)** 의 sim 미반영 5건 검출:

| # | 항목 | 의미 |
|---|------|------|
| L1 | `ShieldAP` AP 스케일 보호막 부여 | base ability 의 shield 단계 누락 |
| L2 | `FlatDR` flat 수치 + AP 스케일 | sim 30% percent durability 와 다른 의미 |
| L3 | `StunDuration` starLevel별 (1.0/1.25/1.5/1.75) | hardcoded 1.5 — ★1/★2 부족, ★4 부족 |
| L4 | 3초 지연 AOE 시퀀스 | "방어 태세 만료 후 AOE" 모델링 부재 |
| L5 | `ArmorMRScale` damage formula | sim aoe_circle damage source 미verify |

⚠️ **우선순위 평가**: Jax 는 carry augment 활성 시점 (`Stargazer JaxCarry`) 이 주된 사용 컨텍스트. base raw 사용 빈도가 낮으면 위 lint 5건은 후순위. 단 carry 미활성 시 sim 결과 신뢰도 낮음 (특히 starLevel별 stun 차이 ★2/★4 0.5초+).

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `public/data/tft_set17_champions.json` `TFT17_Jax` 존재 확인 (2026-05-21 신규 룰)
- [x] entity-wide grep `Jax` — base ability override (1 site) + JaxCarry (14+ sites) 다른 specific helper 없음
- [x] raw stats 17.3 정합 (`public/data/tft_set17_champions.json` 확인)
- [x] **raw role `APTank` → mapGameRole → sim Tank** (`src/types/index.ts:39` 'Tank' substring match 우선)
- [x] JaxCarry 변환 시 role overwrite `Fighter` (`combatLoop.ts:2265`)
- [x] cast path 3종 (main + OOR + recast) — base ability self_buff/aoe_circle 의 OOR 동작은 [[jax-carry]] 페이지에서 다룸 (base raw 는 단순 in-range aoe)
- [ ] (사용자 verify) ArmorMRScale damage formula sim read site 추적
- [ ] (사용자 verify) 3초 지연 AOE 의도 vs sim instant 차이 — gameplay impact 평가
- [ ] (선택) Lint L1~L5 정식 등록 (#17+) — 우선순위 평가 후

## 관련

- [[role-passive]] — Tank role 마나/타게팅 규칙 (base raw 적용)
- [[ability-targeting]] — `aoe_circle` 패턴 / cast path 3종
- [[hero-augment-carry]] — JaxCarry 변환 시 role/stat/ability override 시스템
- [[jax-carry]] — JaxCarry augment 페이지 (self_buff 패턴 + onAttackBonus + asGain + damage)
- [[stargazer]] — 별돌보미 trait + 강화 칸
- [[patch-17-3]] — Jax FlatDR + ShieldAP 너프 (sim dead)
- [[shen]] — 다른 raw role 변형 사례 (APFighter → Fighter)
- 코드: `src/lib/simulator/systems/ability.ts:206`, `src/lib/simulator/engine/combatLoop.ts:2258`
- 테스트: `tests/unit/simulator/hero-carry-augments.test.ts:223+` / `tests/unit/simulator/stargazer-huntress-serpent.test.ts`
