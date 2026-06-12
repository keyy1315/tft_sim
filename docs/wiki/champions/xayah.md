---
id: xayah
type: champion
display_name_kr: 자야
api_name: TFT17_Xayah
cost: 4
traits:
  - 별돌보미
  - 저격수
role: Marksman   # raw "ADCarry" → mapGameRole() → sim Marksman (types/index.ts:43 includes('Carry')). carry augment 없음
raw_role: ADCarry
current_patch_status: active
sim_active: partial   # 평타 깃털 bounce passive 완전 반영 (PrimaryTargetBonusDamage + (AttackNumEnemies-1) bounce, AD×(1-reduction), lethal auto 포함 — PR #219/#220) + active 깃털 회수(multi 3명 ADDamage) + AS 버프(0.75) + 별돌보미/저격수 trait 정합. 회수 피해 = @TotalDamage@(scaleAD) 물리 → sim damageVar ADDamage 정합. P2: selfBuff AS 4초 duration 미반영 (cast 시 영구 *=1.75, revert 없음, over-model) / P2: 깃털 회수 timing (raw 는 4초 후 recall, sim 은 cast 즉시) / P2: 저격수 amp bounce/primaryBonus 미적용 (computeSniperDamageAmp 미호출) / dead/unknown: scaling.json onCast(featherDamageAD/attackSpeedBuff)+NumAttacks + APDamage/ActivePercentReducedDamage (active desc 미렌더) — sim 추가 시 오히려 부정확 (codex P2 PR #221)
last_verified: 2026-06-12
sources:
  - "public/data/tft_set17_champions.json (TFT17_Xayah entry — cost 4, role ADCarry, traits [별돌보미/저격수], ability '별빛 튕기는 깃털' variables AttackNumEnemies/PassivePercentReducedDamage/ADDamage/APDamage/ActivePercentReducedDamage/RecallFeatherTargets/AttackSpeed/Duration/PrimaryTargetBonusDamage)"
  - "public/data/tft_set17_traits.json (TFT17_Stargazer = 별돌보미 / TFT17_RangedTrait = 저격수)"
  - "src/types/index.ts:43 (mapGameRole — 'ADCarry' includes 'Carry' → Marksman)"
  - "src/lib/simulator/systems/ability.ts:247 (TFT17_Xayah: { pattern: 'multi', maxTargets: 3, selfBuff: { attackSpeed: 0.75, duration: 4 }, damageVar: 'ADDamage' } — active 깃털 회수 3명 ADDamage + AS 버프)"
  - "src/lib/simulator/systems/ability.ts:313 (multi case — caster 거리순 sort → slice(maxTargets))"
  - "src/lib/simulator/engine/combatLoop.ts:6235-6271 (평타 깃털 bounce passive — PrimaryTargetBonusDamage primary 생존 가드 + (AttackNumEnemies-1) bounce, AD×(1-PassivePercentReducedDamage), lethal auto 시에도 bounce 발동 — PR #219)"
  - "src/lib/simulator/engine/combatLoop.ts:7175-7189 (selfBuff.attackSpeed cast 적용 — unit.stats.attackSpeed *= (1 + 0.75), duration revert 없음)"
  - "src/lib/simulator/systems/trait.ts:111-126 (별돌보미 constellation resolution) + src/lib/simulator/engine/combatLoop.ts:4698-4699 (applyStargazerEffects 호출) / :3238 (구현) — state 는 SimulateOptions :119/121"
  - "src/lib/simulator/engine/combatLoop.ts:1949 (applySniperEffects) + :1095/:1253 (computeSniperDamageAmp — 저격수 거리 기반 damage amp, hit site 별 합산)"
  - "tests/unit/simulator/xayah-bounce-passive.test.ts (bounce passive 회귀 가드 — multi-bounce / 단일 타겟 / lethal opening auto 3 케이스, PR #220)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[corki]]"
  - "[[kindred]]"
  - "[[stargazer-fountain]]"
---

# 자야 (Xayah)

## 요약

4코스트 **별돌보미 (`TFT17_Stargazer`)** + **저격수 (`TFT17_RangedTrait`)** trait. raw role `ADCarry`.

- **role**: `mapGameRole('ADCarry')` → sim **Marksman** ([[role-passive]]). carry augment 없음.
- **ability "별빛 튕기는 깃털"**: (passive) 평타가 `AttackNumEnemies`(★1-3=3)회 튕기며 `PassivePercentReducedDamage`(0.6) 감소 피해 + 깃털 생성. (active) `Duration`(4)초 공격 속도 `AttackSpeed`(75%) → 종료 시 깃털 회수해 가장 가까운 `RecallFeatherTargets`(3)명에 ADDamage 물리.
- **평타 bounce passive**: combatLoop 에 모델 (PR #219 — primary `PrimaryTargetBonusDamage` flat + (AttackNumEnemies-1) bounce 각 AD×40%). **lethal auto (primary 처치) 시에도 bounce 발동** (PR #219 codex P2 fix, PR #220 회귀 가드).

> 🎯 **Xayah 는 평타 bounce AD carry** — under-damage calibration 에서 평타 단일 타겟만이던 모델에 bounce 추가 (Xayah diffPct -2%, 메모리 `project_underdamage_calibration`). [[corki]] 평타 미사일 / [[kindred]] 표식 화살과 동형의 "평타 추가 hit" 패턴.

> ⚠️ **set17 entity confirm**: `TFT17_Xayah` apiName 으로 소속 확인 (cost 4, traits 별돌보미/저격수, role ADCarry). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 30 / 30 |
| damage | 50 |
| attackSpeed | 0.75 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 50 |

### Role — Marksman

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Marksman** | 1 | 10 | 0 | ❌ | `mapGameRole('ADCarry')` includes 'Carry' → Marksman (`types/index.ts:43`, [[role-passive]] Marksman 마나 규칙) |

### Passive — 평타 깃털 bounce (`combatLoop.ts:6235-6271`)

raw desc: "기본 공격이 튕기며 `@AttackNumEnemies@`(★1-3=3)회 타격하고 대상에게 적중할 때마다 `@PassivePercentReducedDamage*100@`%(60%) 감소한 피해를 입힙니다. 또한 마지막 대상 뒤에 깃털을 남깁니다."

raw variables: `AttackNumEnemies` [3,3,3,5,5,5,5] / `PassivePercentReducedDamage` [0.6,0.6,0.6,0.3,...] / `PrimaryTargetBonusDamage` [10,10,15,200,...]

**sim 적용** ✅ (평타 hook, `:6235` `apiName === 'TFT17_Xayah'`):

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| primary 추가 피해 (`PrimaryTargetBonusDamage`, physical flat) | ✅ — **primary 생존 시만** | `:6242` `primaryBonus > 0 && target.state !== 'dead'` 가드. ★1=10 / ★2=10 / ★3=15 (`readVarByStar`) |
| bounce — (AttackNumEnemies-1) 가장 가까운 다른 적 | ✅ `numBounce = max(0, numEnemies-1)` = 2 (★1-3) | `:6253-6258` primary 위치 기준 거리순 sort, 죽은 적 제외 (`e.state !== 'dead' && e.id !== target.id`) |
| bounce 피해 = AD × (1 - reduction) | ✅ `bounceRaw = stats.damage × (1-0.6) × (1+damageAmp)` = 평타 AD 의 40% | `:6259` (★1-3 reduction 0.6 → 40%) |
| **lethal auto (primary 처치) 시 bounce 발동** | ✅ — **PR #219 codex P2 fix** | outer 가드에서 `target.state` 검사 제거. primary 가 base auto 로 죽어도 bounce 는 다른 적을 치므로 발동. `PrimaryTargetBonusDamage` 만 primary 생존 가드 유지 |
| 깃털 생성 (raw "마지막 대상 뒤 깃털") | ➖ 추상화 | sim 은 깃털 객체 미추적 — active 회수가 "가장 가까운 3명 multi" 로 추상 처리 (아래) |

> 회귀 가드: `tests/unit/simulator/xayah-bounce-passive.test.ts` — multi-bounce 3명 전원 피해 / 단일 적 bounce 없음 / **lethal opening auto 같은 tick bounce 2명** 3 케이스 (PR #220). lethal 케이스는 "첫 사망 tick 의 bounce 사망 ≥2" 로 판별 (bounce skip 회귀 시 0 → fail).

### Active — 깃털 회수 + 공격 속도 버프 (`ability.ts:247`)

raw desc: "사용 시: `@Duration@`(4)초 동안 공격 속도를 `@AttackSpeed*100@`%(75%) 얻습니다. 지속시간이 끝나면 모든 깃털을 불러들여 가장 가까운 적 `@RecallFeatherTargets@`(3)명에게 각각 `@TotalDamage@`(scaleAD) 물리 피해."

raw variables: `AttackSpeed` [0.75] / `Duration` [4] / `RecallFeatherTargets` [3] / `ADDamage` [40,45,68,900,...] / `APDamage` [10,6,9,...] / `ActivePercentReducedDamage` [0.2]

**sim 적용** (`ability.ts:247`):
```ts
TFT17_Xayah: { pattern: 'multi', maxTargets: 3, selfBuff: { attackSpeed: 0.75, duration: 4 }, damageVar: 'ADDamage' }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 깃털 회수 대상 3명 (`RecallFeatherTargets`) | ✅ `pattern: 'multi', maxTargets: 3` | `ability.ts:313` caster 거리순 sort → `slice(0, 3)`. `findAbilityTargets` (`combatLoop.ts:6594`) |
| 회수 피해 (`TotalDamage`, scaleAD) | ✅ `damageVar: 'ADDamage'` | no-filler `[40,45,68]` → ★1=40 / ★2=45 / ★3=68. `getAbilityDamage` AD-scaled |
| 공격 속도 +75% (`AttackSpeed`) | ✅ `selfBuff.attackSpeed: 0.75` | `:7175-7189` `unit.stats.attackSpeed *= (1 + 0.75)` (Xayah 는 carry override 없음 → config 값 0.75) |
| 회수 피해 `APDamage` | ➖ **dead/unknown — sim 정합** | raw active desc 는 회수를 `@TotalDamage@`(%i:scaleAD%) **물리만** 렌더 → `APDamage` [10,6,9,...] 는 spell 구성 요소 아님 (desc 미참조). sim `damageVar: 'ADDamage'` (scaleAD) 가 raw 와 정확히 정합 — APDamage 는 dead-data/unknown variable (codex P2 PR #221, "미반영 gap" 으로 보면 게임에 없는 AP 추가 유도 → 오히려 부정확) |
| `ActivePercentReducedDamage` (0.2) | ➖ **dead/unknown — sim 정합** | raw active desc: "가장 가까운 적 3명에게 **각각** `@TotalDamage@`" — per-target 감소 미렌더. `ActivePercentReducedDamage` 는 spell 구성 요소 아님 (desc 미참조) → dead-data/unknown. generic `multi` 의 각 타겟 full 적용이 raw 와 정합 (codex P2 PR #221) |
| AS 버프 4초 만료 (`Duration`) | ❌ **미반영 (over-model)** | `selfBuff.duration` read site 0 — `:7189` 영구 `*= 1.75`, 4초 후 revert 없음 → 전투 끝까지 지속. **Lint P2** |
| 회수 timing (raw: 4초 후 recall) | ⚠️ 단순화 | sim 은 cast 즉시 multi 피해 + AS 버프 동시 적용 (4초 지연 후 recall 아님). **Lint P2** |

> ⚠️ **scaling.json onCast dead data**: `public/data/tft_set17_scaling.json` 의 `TFT17_Xayah` 엔트리 (`featherDamageAD [40,48,72,900]` / `attackSpeedBuff 0.75` / `featherRecallTargets 3`) 는 **sim 미참조** — `featherDamageAD`/`attackSpeedBuff`/`featherRecallTargets` repo-wide grep **0 hit**. combatLoop 에 `onCast` 트리거 핸들링 없음. sim 은 `CHAMPION_ABILITY_PATTERNS` (`ability.ts:247`) 로 active 처리 → 회수 피해는 raw `ADDamage` read, scaling.json `featherDamageAD` 는 미사용. drift: ★2 48 vs `ADDamage` 45 / ★3 72 vs 68. 또한 raw `NumAttacks`[6] (게임: 6회 공격 후 깃털 회수) 도 sim 미참조 — `Duration`(4초) 기반 cast 로 추상화. **Lint P2** (redundant data, sim 영향 0).

### 별돌보미 (`TFT17_Stargazer`) / 저격수 (`TFT17_RangedTrait`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 별돌보미 (Stargazer) | ✅ | constellation state 수신 (`combatLoop.ts:119/121` SimulateOptions 필드) → resolution `trait.ts:111-126` (`CONSTELLATION_TO_TRAIT_API` + 변종 lookup, 8개 변종 7 + base 모두 name '별돌보미') → effect `applyStargazerEffects` (호출 `combatLoop.ts:4698-4699`, 구현 `:3238`). 제단/우물 등 game-level 메커니즘은 [[stargazer-fountain]] (17.4 full active) |
| 저격수 (Sniper / RangedTrait) | ✅ | `applySniperEffects` (`combatLoop.ts:1949`) + `computeSniperDamageAmp` (`:1095`/`:1253`) — base damage amp + per-hex 추가 amp. hit site 에서 `hexDistance(caster, target)` 계산 → 거리 비례 증폭. Xayah range 6 → 원거리 amp 수혜 |

> 룰 #16/#19: 두 trait 모두 generic 경로 (`trait.ts` constellation resolution / `applySniperEffects`) 존재 — Xayah-specific 구현(분기 추가)은 불필요하나, generic 경로 존재·line 인용은 매 champion grep 재검증 (verify 면제 아님).

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Xayah 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active multi 3명 ADDamage + selfBuff AS | `ability.ts:247`, `combatLoop.ts:6594` (findAbilityTargets) / `:7176` (selfBuff) |
| **OOR (out-of-range)** | ➖ Xayah 는 dash 없음 (multi pattern, range 6) — OOR fallback dash 무관 | `findAbilityTargets` (`:7330`) 은 OOR config 사용하나 Xayah 는 dash 미지정 |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **평타 bounce passive** (`:6235`) 은 cast pipeline 과 별개 (평타 hook). 별돌보미/저격수 trait 도 별개 경로.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 850, armor/MR 30, AD 50, AS 0.75, range 6, crit 0.25/1.4, mana 0/50)
- role Marksman (`mapGameRole('ADCarry')`)
- **평타 깃털 bounce passive** — primary `PrimaryTargetBonusDamage` flat(생존 가드) + (AttackNumEnemies-1) bounce 각 AD×40%, **lethal auto 포함** (PR #219/#220) ✅ 완전 반영
- active 깃털 회수 (multi 3명 ADDamage) + AS 버프 0.75
- **별돌보미 (Stargazer)** constellation + **저격수 (Sniper)** 거리 기반 damage amp

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: selfBuff AS `Duration`(4초) 미반영 — cast 시 영구 `*= 1.75` (revert 없음, over-model)
- **P2**: 회수 timing — raw 는 4초 후 recall, sim 은 cast 즉시 (단순화)
- **P2**: dead/unknown variables — scaling.json onCast (`featherDamageAD`/`attackSpeedBuff`/`featherRecallTargets`) + raw `NumAttacks`[6] + raw `APDamage`/`ActivePercentReducedDamage` (active desc 미렌더) 모두 sim 미참조 (grep 0). **APDamage/ActivePercentReducedDamage 는 "미반영 gap" 아님** — `@TotalDamage@`(scaleAD) 물리만 렌더되므로 sim 추가 시 오히려 부정확 (codex P2 PR #221)
- **P2**: 저격수 amp 의 bounce/primaryBonus 적용 비대칭 — bounce(`:6259`)·primaryBonus(`:6243`)은 `unit.damageAmp` 만, `computeSniperDamageAmp` 미호출 (verify 후속)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P2 | selfBuff AS 4초 duration 미반영 | `selfBuff.duration: 4` config 존재하나 read site 0 → cast 시 영구 `*=1.75`. 4초 후 revert 없음 | **P2** | (c) cast-time 1회 helper + 만료 tick 스케줄 — `selfBuff.duration` 만큼 buff, 만료 시 AS 복원 | AS 버프 영구화 → DPS over-model. recast 시 compound |
| P2 | scaling.json onCast dead data | `TFT17_Xayah` scaling 엔트리 (featherDamageAD/attackSpeedBuff/featherRecallTargets) grep 0 + raw `NumAttacks`[6] grep 0 — sim 은 CHAMPION_ABILITY_PATTERNS read | **P2** | data — onCast 핸들러 미구현 시 scaling 엔트리 제거 또는 핸들러 추가 | sim 영향 0 (redundant). featherDamageAD drift ★2 48 vs 45 / ★3 72 vs 68 |
| P2 | 저격수 amp 의 bounce/primaryBonus 적용 비대칭 | bounce(`:6259`)·primaryBonus(`:6243`)은 `unit.damageAmp` 만 사용 — hit site 별 `computeSniperDamageAmp(unit, e)` 미호출. base auto / 다른 hit site 와 달리 저격수 거리 amp 가 bounce/primaryBonus 에 미적용 가능 | **P2** | (b) per-target loop — bounce/primaryBonus `dmgRaw` 에 `computeSniperDamageAmp(unit, e)` 합산 (base auto hit site 패턴 차용) | bounce 가 평타의 일부이므로 저격수 amp 받는 게 자연스러움 — verify 후속 |

> 📌 **평타 bounce passive (lethal 포함) + active multi ADDamage(=@TotalDamage@ scaleAD) + AS 버프 + 별돌보미/저격수 trait 는 sim 정합**. `partial` 사유는 AS duration over-model + 회수 timing 단순화 + 저격수 amp bounce 미적용 등 P2 (P0 회귀 없음 → 룰 #15 미해당). APDamage/ActivePercentReducedDamage 는 active desc 미렌더 → dead/unknown (미반영 gap 아님). 주력 평타 bounce + 회수 ADDamage DPS 는 반영.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Xayah` apiName 확인 (cost 4, traits [별돌보미/저격수], role ADCarry)
- [x] entity-wide grep `Xayah` + `자야` + `featherDamageAD`/`featherRecall`/`attackSpeedBuff` (scaling.json grep 0) — sim site (combatLoop bounce passive / ability.ts active config / selfBuff)
- [x] raw stats 17.4 정합 (hp 850 / armor·MR 30 / AD 50 / AS 0.75 / range 6 / crit 0.25·1.4 / mana 0·50)
- [x] **raw role `ADCarry` → mapGameRole → Marksman** — `includes('Carry')` (`types/index.ts:43`). carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — bounce passive 블록 (`:6235-6271`, primaryBonus 생존 가드 + bounce 거리순 sort + lethal 발동) + active config (`ability.ts:247` multi/maxTargets 3/selfBuff/damageVar ADDamage) + selfBuff apply (`:7175-7189`) + multi case (`ability.ts:313`)
- [x] **변수 filler 판정** — ADDamage `[40,45,68]` no-filler ★1=40 (회수 = @TotalDamage@ scaleAD 와 정합) / `APDamage`[10,6,9]·`ActivePercentReducedDamage`[0.2]·`NumAttacks`[6] 는 active/passive desc 미렌더 → dead/unknown (sim 미참조 정상) / AttackNumEnemies·PassivePercentReducedDamage·PrimaryTargetBonusDamage·AttackSpeed·Duration·RecallFeatherTargets 상수/star별
- [x] **actual sim integration verify (5단계)** — bounce passive read 확인 (`:6235-6271`) / active selfBuff AS read (`:7176`) + multi 회수 ADDamage (`ability.ts:247/313`, =@TotalDamage@ scaleAD raw 정합) / **`selfBuff.duration` read site 0 → AS 영구 over-model P2** / **scaling.json `featherDamageAD`/`attackSpeedBuff`/`featherRecallTargets` + `APDamage`/`ActivePercentReducedDamage` grep 0 + desc 미렌더 → dead/unknown (미반영 gap 아님, codex P2 PR #221)**
- [x] **cast path 3종 (PR #129 룰)** — main (active multi ✅) / OOR (Xayah dash 없음 ➖) / recast (carry 없음 ➖). 평타 bounce passive·trait 별개 경로
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 별돌보미 `TFT17_Stargazer` constellation resolution (`trait.ts:119-126`) ✅ / 저격수 `TFT17_RangedTrait` `applySniperEffects` (`:1949`) + `computeSniperDamageAmp` (`:1095/:1253`) ✅. "verify 면제" 어휘 미사용 (구현 면제 ≠ verify 면제)
- [x] **lethal auto bounce 회귀 가드** — `tests/unit/simulator/xayah-bounce-passive.test.ts` (PR #220) "첫 사망 tick bounce 사망 ≥2" red/green 검증
- [x] **본문 Lint P2 3건 (AS duration over-model / 회수 timing / 저격수 amp bounce) + dead/unknown 다수 → 보수적 `sim_active: partial` 유지** (P0 case 없음 → 룰 #15 미해당)
- [x] **codex P2 (PR #221) 반영** — APDamage/ActivePercentReducedDamage 를 "미반영 gap" → "dead/unknown" 재분류 (active desc `@TotalDamage@` scaleAD 물리만 렌더, sim 추가 시 오히려 부정확)
- [ ] (선택) AS 4초 duration revert / 회수 timing / 저격수 amp bounce 적용 (P2)

## 관련

- [[role-passive]] — Marksman role 마나 규칙 (공격당 10 / 초당 0 / 피격 ❌)
- [[ability-targeting]] — `multi` (caster 거리순 maxTargets 3) + selfBuff. cast path main only (dash 없음)
- [[corki]] — 동형 "평타 추가 hit" (평타 미사일). 단 corki active 는 MissileAP(scaleAP) 미반영이 실제 gap, Xayah 회수는 raw 가 scaleAD 물리만이라 gap 아님 (차이 주의)
- [[kindred]] — 동형 `multi` ADDamage 화살 (표식 패시브는 combatLoop)
- [[stargazer-fountain]] — 별돌보미 (Stargazer) game-level 메커니즘 (제단/우물, 17.4 full active)
- under-damage calibration (메모리 `project_underdamage_calibration`) — 평타 bounce passive 도입 배경 (Xayah diffPct -2%)
- 코드: `src/lib/simulator/systems/ability.ts:247/313`, `src/lib/simulator/engine/combatLoop.ts:6235/7176/1949/1095`, `src/lib/simulator/systems/trait.ts:119`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Xayah), `public/data/tft_set17_traits.json` (TFT17_Stargazer / TFT17_RangedTrait)
- 테스트: `tests/unit/simulator/xayah-bounce-passive.test.ts`
