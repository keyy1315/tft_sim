---
id: kindred
type: champion
display_name_kr: 킨드레드
api_name: TFT17_Kindred
cost: 4
traits:
  - N.O.V.A.
  - 도전자
role: Marksman   # raw "ADCarry" → mapGameRole() → sim Marksman (types/index.ts:43 includes('Carry')). carry augment 없음 → role 변환 분기 없음
raw_role: ADCarry
current_patch_status: active (17.4 데이터 기준 — 17.5/17.5b patch pending: Base AD 55→58 (buff). 데이터/sim 미반영, [[patch-17-5]] 참조)
sim_active: partial   # active multi 화살(ADDamage scaleAD ★1=115/175/900) + 3표식 passive(SpellDamage) + N.O.V.A.(DRX) surge/Tank shield 800/selector +10% damageAmp/4.5초 주기 mark + 도전자(ASTrait) AS+Burst 정합 (AS off-by-one 은 PR #186 수정 완료 — scaling.json leading-0 제거). P2 passive 표식 평타만(desc "기본공격+스킬" 중 스킬 표식 미반영) / P2 passive mark 피해 SpellDamage flat (desc TotalDamage scaleAD+scaleAP — ad/ap scaling 미적용) / P2 active HexDistance(1) 도약 미구현 (기본 공격 AI 이동 위임) / info raw NovaDamageAmp 0.05·NovaRepeatTimer 5 미사용 (sim 17.4 하드코딩 0.10·4.5초, PR #166) / info NumTargets ★4=5 미반영 (★1-3=3, 4코 ★3까지)
last_verified: 2026-06-04
sources:
  - "public/data/tft_set17_champions.json (TFT17_Kindred entry — cost 4, role ADCarry, traits [N.O.V.A./도전자], ability '우주의 추적' variables MaxMarks/NumTargets/SpellDamage/ADDamage/APDamage/HexDistance/NovaRepeatTimer/NovaDamageAmp)"
  - "public/data/tft_set17_traits.json (TFT17_DRX = N.O.V.A. — ShieldValue 800 등 / TFT17_ASTrait = 도전자)"
  - "src/types/index.ts:43 (mapGameRole — 'ADCarry' includes 'Carry' → Marksman)"
  - "src/lib/simulator/systems/mana.ts:25 (Marksman manaPerAttack 10 / manaPerSecond 0 / manaFromDamage false)"
  - "src/lib/simulator/systems/ability.ts:238 (TFT17_Kindred: { pattern: 'multi', maxTargets: 3, damageVar: 'ADDamage' } — 화살 3명 ADDamage, HexDistance 도약은 기본 공격 AI 이동 위임)"
  - "src/lib/simulator/engine/combatLoop.ts:6068-6082 (3표식 passive — 평타 시 _kindredMarks+1, 3 도달 시 SpellDamage filler 물리 applyResistance ×damageAmp)"
  - "src/lib/simulator/engine/combatLoop.ts:4776-4787 (N.O.V.A. surge — hasKindred + kindredShield(ShieldValue 800) → 가장 강한 Tank shield)"
  - "src/lib/simulator/engine/combatLoop.ts:4878-4896 (Kindred selector — damageAmp +0.10 [17.4 buff 0.05→0.10 PR #166] + 모든 적 mark 즉시)"
  - "src/lib/simulator/engine/combatLoop.ts:5221-5251 (tickKindredNovaMark — surge 후 4.5초 주기 [17.4 5s→4.5s PR #166] 모든 적 mark 갱신, kindredSelector 필요)"
  - "src/lib/simulator/engine/combatLoop.ts:4724 (setupDrxNova kindredShield = v.ShieldValue) / :4646 NOVA_APIS / novaSelector.ts:17"
  - "src/lib/simulator/engine/combatLoop.ts:458-466 (도전자 TFT17_ASTrait AS — applySet17SynergyBuffs sc.teamwideAS[ti] 모든 아군 + sc.championAS[ti] 도전자 추가, scaling.json 수치 teamwideAS[0,0.1,0.15,0.2,0.3]/championAS[0,0.2,0.35,0.55,0.9])"
  - "src/lib/simulator/engine/combatLoop.ts:517/3529/5541/5613 (도전자 Burst — :517 combat-start challengerBurstPercent(0.5) set / :5541 challengerIds Burst 트리거 id 집합 / :5613 새 대상 dash 시 challengerBurstEndTick=tick+2.5초 [scaling.json burstDuration:3 은 dead config] / :3529 AS read as×(1+burstPercent))"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[aatrox]]"
  - "[[spell-crit]]"
  - "[[stargazer]]"
---

# 킨드레드 (Kindred)

## 요약

4코스트 **N.O.V.A. (`TFT17_DRX`)** + **도전자 (`TFT17_ASTrait`)** trait. raw role `ADCarry`.

- **role**: `mapGameRole('ADCarry')` → sim **Marksman** ([[role-passive]]). carry augment 없음 → role 변환 분기 없음.
- **ability "우주의 추적"**: passive (기본공격/스킬 표식 → 3표식 시 늑대 추가 물리) + active (1칸 도약 후 가장 가까운 3명 화살).
- **N.O.V.A. (DRX) carry 5종 중 하나** — surge 시 가장 강한 Tank shield + 타격 선택기 (+10% damageAmp + 모든 적 표식 4.5초 주기).

> 🎯 **Kindred 는 N.O.V.A. 5종 (Aatrox/Caitlyn/Akali/Maokai/Kindred) 중 "표식 도배형"** — 평타 3표식 늑대 폭발 + selector 시 모든 적 영구 표식 (4.5초 갱신). NOVA 공통 surge 메커니즘은 [[aatrox]] 참조 (Aatrox 가 cycle 변환 + knockup 으로 가장 완성된 carry, Kindred 는 surge 시점 shield/selector 효과).

> ⚠️ **set17 entity confirm**: `TFT17_Kindred` apiName 으로 소속 확인 (cost 4, traits N.O.V.A./도전자, role ADCarry). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 30 / 30 |
| damage | 55 |
| attackSpeed | 0.8 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 40 |

### Role — Marksman

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Marksman** | 1 | 10 | 0 | ❌ | `mapGameRole('ADCarry')` includes 'Carry' (`types/index.ts:43`), `mana.ts:25` |

### Passive — 3표식 늑대 (`combatLoop.ts:6068-6082`)

raw desc: "기본 공격 및 스킬이 대상에게 표식을 남깁니다. 적이 `@MaxMarks@`(3)표식에 도달하면 늑대가 표식을 소모하고 `@TotalDamage@`(scaleAD scaleAP)의 물리 피해를 입힙니다."

raw variables: `MaxMarks` [3,...] / `SpellDamage` [0,75,115,600,810,...] / `ADDamage` [0,115,175,900,...] / `APDamage` [0,10,15,100,...]

**sim 적용** (평타 hook, `:6069` `apiName === 'TFT17_Kindred'`):

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 표식 누적 (MaxMarks 3) | ⚠️ **평타만** | `_kindredMarks + 1` (평타 hook `:6070`). 3 도달 시 reset (`:6073`). **desc "기본공격+스킬" 중 active 스킬 표식 미반영** (active multi 화살 경로에 mark 부여 없음). **Lint P2** |
| 3표식 늑대 피해 | ⚠️ **값 정합 / scaling 근사** | `SpellDamage` filler `[0,75,115,600]` → **★1=75 / ★2=115 / ★3=600** (`:6074-6076`). `applyResistance(markDmg × (1+damageAmp), armor)` (`:6077`) — physical. **단 desc `TotalDamage`(scaleAD+scaleAP) 인데 sim 은 SpellDamage flat (ad/ap scaling 미적용)** — raw ADDamage/APDamage 따로 있으나 mark 는 SpellDamage 만. **Lint P2** |

### Active — 도약 화살 (`ability.ts:238`)

raw desc: "최대 `@HexDistance@`(1)칸 멀리 도약한 후 가장 가까운 적 `@NumTargets@`(3, ★4=5)명에게 화살을 발사해 각각 `@ModifiedDamage@`(scaleAD)의 물리 피해."

**sim 적용** (`ability.ts:238`):
```ts
TFT17_Kindred: { pattern: 'multi', maxTargets: 3, damageVar: 'ADDamage' }
```

| desc 요소 | sim 적용 | 비고 |
|-----------|---------|------|
| 화살 damage (`ADDamage`, scaleAD) | ✅ `damageVar` | filler `[0,115,175,900]` → ★1=115 / ★2=175 / ★3=900 (`resolveAbilityDamage` main pipeline) |
| 가장 가까운 NumTargets 명 | ⚠️ `maxTargets: 3` | NumTargets `[3,3,3,5,5]` no-filler → ★1-3=3 (정합). **★4=5 는 sim 미반영** (maxTargets 하드코딩 3, 4코 ★3까지라 실전 무관 — info) |
| HexDistance(1) 도약 | ❌ **미구현** | 도약 reposition 미구현 — "제자리에서 화살, 이동은 기본 공격 AI 의 한 칸 이동에 맡긴다" (`ability.ts:238` 주석). **Lint P2** |

### N.O.V.A. (`TFT17_DRX`) trait — surge + Kindred 효과

NOVA 공통 surge 메커니즘 (TeamAttackDelay 6초, setupDrxNova/tickDrxNova, autoAssignNovaSelector (5)+ 가장 강한 NOVA unit) 은 [[aatrox]] 참조. Kindred-specific 효과:

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| **Tank shield** (surge 시) | ✅ | `hasKindred && kindredShield > 0` → 가장 강한 Tank (role Tank, maxHp 최고) 에 `kindredShield` (= DRX `ShieldValue` **800**) shield (`:4776-4787`, `setupDrxNova:4724`) |
| **타격 선택기 +10% damageAmp** | ✅ | `kindredSelector` (aatroxNovaStrikeSelector flag) → `damageAmp += 0.10` (`:4884`). **17.4 buff 0.05→0.10** (PR #166, Codex P1 #162). raw `NovaDamageAmp` 0.05 는 미사용 (sim 하드코딩 0.10) |
| **선택기 모든 적 표식 (즉시)** | ✅ | selector surge 시 모든 적 `mark` statusEffect (`kindred-nova-selector`, `:4885-4891`) |
| **표식 4.5초 주기 갱신** | ✅ | `tickKindredNovaMark` (`:5223-5251`) — surge 후 `4.5초` 주기 모든 적 mark 재부여 (`:5231` `periodTicks = 4.5 × TICKS_PER_SECOND`). **17.4 5s→4.5s** (PR #166). raw `NovaRepeatTimer` 5 미사용 (sim 하드코딩 4.5) |

> raw `NovaDamageAmp` 0.05 / `NovaRepeatTimer` 5 는 **base 값** — 17.4 패치가 코드에 0.10 / 4.5초로 하드코딩 (raw json 미반영). sim 은 17.4 LIVE 기준.

### 도전자 (`TFT17_ASTrait`) trait

raw trait desc: "아군이 `TeamwideAS` 공격속도. 도전자는 추가 AS. 대상 사망 시 새 대상에게 돌진하며 `BurstDuration`초 동안 AS `BurstPercent`(50%) 상승."

generic 도전자 통합 경로 (Kindred-specific 추가 분기 없음) — sim verify 완료:

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| 아군 AS + 도전자 추가 AS | ✅ **정합 (PR #186 수정)** | `applySet17SynergyBuffs` (`:458-466`) — `sc.teamwideAS[ti]` + `sc.championAS[ti]`, `ti = effects.findIndex(activeEffect)` (**0-based**, `:453`). `scaling.json` teamwideAS [0.1,0.15,0.2,0.3] / championAS [0.2,0.35,0.55,0.9] (effects [minUnits 2/3/4/5] 와 **1:1 정렬**). 2도전자(ti=0)=0.1/0.2. **PR #186 전엔 leading inactive `0` 배열로 off-by-one (2도전자 AS 0, 상위 한 칸씩 낮게) 버그 → scaling.json leading-0 제거로 해소** (회귀 가드 `synergy-scaling-offbyone.test.ts`). Codex PR #185 catch |
| Burst (대상 처치 후 재돌진 시 +50% AS) | ✅ | combat-start `:517-520` 도전자 unit `challengerBurstPercent = BurstPercent`(0.5) set → `challengerIds` 집합 (`:5541-5551`, **Burst dash 트리거 조건용 id 집합** — AS 적용 아님) → prev target 사망 후 새 대상 dash 시 `challengerBurstEndTick = tick + 2.5초` (`:5613`) → AS read `:3529-3530` `as *= (1 + challengerBurstPercent)`. ⚠️ burst duration 코드 하드코딩 **2.5초**, `scaling.json burstDuration: 3` 은 **dead config** (sim 미read, P2) |

> champion-specific 구현(분기 추가)은 불필요하나 generic 경로 grep verify 는 매 champion 필수 (룰 #16/#19). **AS 적용 경로(`:458` applySet17SynergyBuffs)와 Burst 트리거 경로(`:5541` challengerIds)는 별개** — 혼동 금지. Kindred 는 도전자라 추가 AS (championAS) + Burst (새 대상 돌진 시 +50% AS, 2.5초) 수령. range 6 marksman 이라 대상 처치 후 재타겟 시 AS 폭발.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Kindred 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active multi 화살 (maxTargets 3, ADDamage) | `ability.ts:238`, `resolveAbilityDamage` |
| **OOR (out-of-range dash)** | ➖ Kindred range 6 (장거리) + active dash 없음 (HexDistance 도약 미구현) → OOR fallback 진입 빈도 극히 낮음 | — |
| **recast (onKill)** | ➖ 없음 — carry augment 전용. Kindred carry augment 없음 | — |

> **passive 3표식** (`:6068`) 과 **NOVA mark/surge** (`:4776`/`:5221`) 는 cast pipeline 이 아닌 평타 hook / trait surge / main loop tick 별개 경로다.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 850, armor/MR 30, AD 55, AS 0.8, mana 0/40, range 6)
- role Marksman (`mapGameRole('ADCarry')`) + Marksman 마나 규칙
- active multi 화살 — ADDamage scaleAD (★1=115/★2=175/★3=900), maxTargets 3
- passive 3표식 늑대 — 평타 표식 누적 + SpellDamage (★1=75/★2=115/★3=600) physical
- **N.O.V.A. (DRX)**: surge Tank shield 800 + selector +10% damageAmp (17.4 buff) + 모든 적 표식 즉시 + 4.5초 주기 갱신 (17.4)
- **도전자 (ASTrait)** — 아군 AS + 도전자 추가 AS (`applySet17SynergyBuffs`, 전 tier 정합, **PR #186 off-by-one 수정**) + Burst (대상 처치 후 재돌진 시 +50% AS 2.5초)

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: passive 표식 평타만 (desc "기본공격+스킬" 중 active 스킬 표식 미반영)
- **P2**: passive mark 피해 SpellDamage flat — desc `TotalDamage`(scaleAD+scaleAP) 인데 ad/ap scaling 미적용 (raw ADDamage/APDamage 미사용)
- **P2**: active HexDistance(1) 도약 미구현 (기본 공격 AI 이동 위임)
- (info): raw `NovaDamageAmp` 0.05 / `NovaRepeatTimer` 5 미사용 — sim 17.4 하드코딩 0.10 / 4.5초 (PR #166)
- (info): active NumTargets ★4=5 미반영 (maxTargets 하드코딩 3, 4코 ★3까지 실전 무관)
- (info): 도전자 raw trait vars `AttackSpeedPercent` (0.15~0.55) ≠ sim 적용 `championAS` (0.2~0.9, scaling.json) — sim 은 scaling.json 우선 / `scaling.json burstDuration: 3` 은 dead config — 코드 `:5614` 는 2.5초 하드코딩 (raw trait json `BurstDuration: 2.5` 와 일치, scaling.json 3 만 불일치, sim 미read)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ✅ resolved | 도전자 AS 인덱싱 off-by-one | `applySet17SynergyBuffs:453` `ti = findIndex(activeEffect)` (0-based) vs `scaling.json` leading-0 배열 → 2도전자 `ti=0` → `scaling[0]=0` → AS 0, 3/4/5도전자 한 칸씩 낮게. **모든 도전자 unit 공통** (Kindred-specific 아님) | ~~P2~~ → ✅ | (a) scaling.json leading-0 제거 (effects 1:1 정렬) | **PR #186 수정 완료** — 도전자/전달자/구원자/불한당 4 trait leading-0 제거 + 회귀 가드 `synergy-scaling-offbyone.test.ts`. Codex PR #185 catch → #186 resolved |
| P2 | passive 표식 평타만 (스킬 표식 미반영) | desc "기본공격+스킬이 표식" 인데 sim 은 평타 hook (`:6069`) 에서만 `_kindredMarks+1`. active multi 화살 (`ability.ts:238`) 경로에 mark 부여 없음 → 3표식 도달 속도 과소 | **P2** | (c) cast-time — active cast 후 hit target 에 `_kindredMarks+1` 추가 | active 빈도만큼 표식 누적 누락. 평타 위주라 영향 제한적. 측정 후 결정 |
| P2 | passive mark 피해 SpellDamage flat | desc `TotalDamage`(scaleAD+scaleAP) vs sim `SpellDamage × (1+damageAmp)` flat (ad/ap scaling 없음, `:6077`). raw ADDamage/APDamage 미사용 | **P2** | (b) attack-hook — mark 피해에 ad/ap scaling 추가 (ADDamage scaleAD + APDamage scaleAP). 단 raw TotalDamage 산식 확인 필요 | scaling 누락으로 후반 under-damage 가능. raw 산식 verify 후 결정 |
| P2 | active HexDistance(1) 도약 미구현 | 도약 reposition sim 부재 — 제자리 화살 (`ability.ts:238` 주석, 이동은 평타 AI 위임) | **P2** | (c) cast-time — dash/reposition 분기 | 1칸 도약이라 영향 작음. sim 이동 모델 단순화 의도 가능 |
| info | raw NovaDamageAmp 0.05 / NovaRepeatTimer 5 미사용 | sim 은 17.4 buff 하드코딩 (0.10 / 4.5초, PR #166). raw json variable 은 base 값 (미갱신) | info | 해당 없음 (17.4 sim 정합) | raw json 이 17.4 미반영 — 룰 #20 (patch 변경 fact = raw diff) 상 sim 이 LIVE. 명시만 |

> 📌 **active / N.O.V.A. surge·shield·selector·mark / 도전자 는 sim 정합** (17.4 buff 반영). `partial` 사유는 passive 표식 (평타만 + flat scaling) + active 도약 미구현 등 P2. NOVA 공통 메커니즘은 [[aatrox]] 와 동일 코드 path.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Kindred` apiName 확인 (cost 4, traits [N.O.V.A./도전자], role ADCarry)
- [x] entity-wide grep `Kindred` + `킨드레드` + `NovaMark` + `kindredShield` — sim site (3표식 passive / active multi / NOVA surge·selector·mark / shield)
- [x] raw stats 17.4 정합 (hp 850 / armor·MR 30 / AD 55 / AS 0.8 / mana 0·40 / range 6)
- [x] **raw role `ADCarry` → mapGameRole → Marksman** — `includes('Carry')` (`types/index.ts:43`). carry augment 없음 → 변환 없음
- [x] **함수 컨텍스트 read (2단계)** — 3표식 passive 블록 (`:6068-6082`) + `tickKindredNovaMark` (`:5221-5251`) + NOVA surge Kindred shield (`:4776-4787`) + Kindred selector (`:4878-4896`) 전체 read
- [x] **변수 filler 판정** — SpellDamage `[0,75,115,600]` zero filler ★1=75 / ADDamage `[0,115,175,900]` zero filler ★1=115 / APDamage `[0,10,15,100]` zero filler ★1=10 / NumTargets `[3,3,3,5,5]` no-filler ★1-3=3 / MaxMarks·HexDistance·NovaRepeatTimer 상수
- [x] **actual sim integration verify (5단계)** — active ADDamage `resolveAbilityDamage` read / passive SpellDamage `:6076` read / NOVA kindredShield `setupDrxNova:4724` → surge `:4781` read / selector damageAmp `:4884` read. **17.4 buff (0.10/4.5초) sim 하드코딩 vs raw json (0.05/5) 분리 확인** / **scaleAD/AP scaling: passive mark 는 SpellDamage flat (ad/ap 미적용) 확인 → P2**
- [x] **cast path 3종 (PR #129 룰)** — main (multi 화살 ✅) / OOR (dash 없음 ➖) / recast (carry 없음 ➖). passive·NOVA mark/surge 별개 경로 명시
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — N.O.V.A. `TFT17_DRX` setupDrxNova/surge/selector ✅ ([[aatrox]] 공통) / 도전자 `TFT17_ASTrait`: AS 적용 `applySet17SynergyBuffs :458-466` ↔ Burst 트리거 `:5541` challengerIds 별개 경로 구분 + Burst (`:517` set → `:5613` endTick → `:3529` AS×1.5). **AS 인덱싱 off-by-one 버그 검출 → PR #186 수정 완료** (scaling.json leading-0 제거 + 회귀 가드). 각 trait apiName grep + 통합 경로 본문 명시 + **scaling.json 배열 인덱싱 정합까지 verify** (단순 "값 존재 → 정합" 단정 금지 — 룰 #16 P1 2회 + Codex P2 학습)
- [x] **본문 Lint P2 3건 + info 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [x] **함수 주석 stale 확인 + 교정** — `tickKindredNovaMark` 상단 주석이 "5초" stale 이었으나 (코드 `:5231` 4.5초) **본 cleanup 에서 코드 주석 4.5초로 교정 완료** (함수 주석 ≠ 코드, PR #184 학습 적용)
- [ ] (선택) passive 스킬 표식 / mark scaleAD·AP scaling / active 도약 sim 도입 인게임 측정

## 관련

- [[role-passive]] — Marksman role 마나·타게팅 규칙 (공격당 10 / 피격 ❌)
- [[ability-targeting]] — `multi` 패턴 (maxTargets 3). cast path Kindred 는 main 중심 (도약/recast 없음)
- [[aatrox]] — **N.O.V.A. (DRX) 공통 surge 메커니즘** (TeamAttackDelay 6초, setupDrxNova/tickDrxNova, autoAssignNovaSelector, novaSelector.ts 5종). Aatrox 가 cycle+knockup 으로 가장 완성된 NOVA carry, Kindred 는 shield/selector 효과
- [[spell-crit]] — Kindred active multi 화살은 cast loop 경로 → spell crit 가능 (운명술사 등 spellCanCrit 활성 시). passive 3표식 (`:6077` applyResistance 직접) 은 crit 분기 없음 (Vex passive 와 동일 — 평타 hook 비크리)
- [[stargazer]] — 별돌보미 (Kindred 무관, NOVA 별개 trait)
- 코드: `src/lib/simulator/systems/ability.ts:238`, `src/lib/simulator/engine/combatLoop.ts:4724/4776/4878/5221/5541/6068`, `src/types/index.ts:43`, `src/lib/simulator/novaSelector.ts:17`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Kindred), `public/data/tft_set17_traits.json` (TFT17_DRX / TFT17_ASTrait)
