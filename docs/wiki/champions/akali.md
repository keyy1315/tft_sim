---
id: akali
type: champion
display_name_kr: 아칼리
api_name: TFT17_Akali
cost: 2
traits:
  - N.O.V.A.
  - 습격자
role: Fighter   # raw "ADFighter" → mapGameRole() → sim Fighter (types/index.ts:46 includes('Fighter')). carry augment 없음 → role 변환 분기 없음
raw_role: ADFighter
current_patch_status: active (17.4 데이터 기준 — 17.5/17.5b patch pending: Spell Damage AD ★2~ 37/56/84→39/59/88 (★1=27 불변, buff). 데이터/sim 미반영, [[patch-17-5]] 참조)
sim_active: partial   # active line dash 단검 5개(hitCount 5 split, DamageAD scaleAD) + armorReduction debuff + N.O.V.A.(DRX) surge Precision(팀 spellCanCrit)/selector burn[12,18,24]/단검 burn ×1.10 + 습격자(MeleeTrait) 정합. P2 armorReduction sim 15 flat vs raw ArmorShred 1/ArmorShredCrit 2 불일치 (단위 미확인) / P2 secondaryDamage SecondaryDamageModifier 0.4 (2차 적중 40%) 미반영 (grep 0) / P2 DamageAP(scaleAP) 미사용 (auto-detect DamageAD 우선)
last_verified: 2026-06-04
sources:
  - "public/data/tft_set17_champions.json (TFT17_Akali entry — cost 2, role ADFighter, traits [N.O.V.A./습격자], ability '별의 일격' variables NumShurikens/DamageAD/DamageAP/SecondaryDamageModifier/ArmorShred/ArmorShredCrit/NovaDamagePerSecond/NovaShurikenBonusDamage)"
  - "public/data/tft_set17_traits.json (TFT17_DRX = N.O.V.A. / TFT17_MeleeTrait = 습격자)"
  - "src/types/index.ts:46 (mapGameRole — 'ADFighter' includes 'Fighter' → Fighter)"
  - "src/lib/simulator/systems/mana.ts (Fighter manaPerAttack 10 / manaPerSecond 0 / manaFromDamage false)"
  - "src/lib/simulator/systems/ability.ts:207 (TFT17_Akali: { pattern: 'line', maxTargets: 3, dash: 'to_target', debuff: { armorReduction: 15, duration: 4 }, hitCount: 5 })"
  - "src/lib/simulator/systems/ability.ts:392 (DAMAGE_VAR_PRIORITY 15개 우선순위 배열 — 'Damage'/'MagicDamage'/'PhysicalDamage'/'TotalDamage'/'ADDamage'/'APDamage'/'DamageAD'/'DamageAP'/... 순. Akali variables 에 앞 항목 없어 DamageAD first match, DamageAP 미선택)"
  - "src/lib/simulator/engine/combatLoop.ts:6995-6999 (debuff armorReduction — config.debuff.armorReduction(15) flat armor 감소, line hit 타겟)"
  - "src/lib/simulator/engine/combatLoop.ts:6437/6485 (hitCount split — line(≠single) → 총피해 base×5 / aliveTargets 분배)"
  - "src/lib/simulator/engine/combatLoop.ts:4762-4767 (N.O.V.A. surge — hasAkali → 모든 아군 spellCanCrit Precision)"
  - "src/lib/simulator/engine/combatLoop.ts:4847-4874 (Akali selector — surge 시 모든 적 burn [12,18,24] 출혈 17.4 buff PR #166)"
  - "src/lib/simulator/engine/combatLoop.ts:1280-1290 (post-cast — Akali 단검 hit 시 akali-nova-selector burn × 1.10, NovaShurikenBonusDamage 10%)"
  - "src/lib/simulator/engine/combatLoop.ts:421-434 (습격자 MeleeTrait 흡혈→보호막 변환 cap maxHp×0.25) / :471-474 applySet17SynergyBuffs 습격자 분기 (teamwideOmnivamp/championOmnivamp/championAD) / :535-545 MeleeTrait MaxPercentHealthShield+ShieldAD"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[aatrox]]"
  - "[[spell-crit]]"
  - "[[kindred]]"
---

# 아칼리 (Akali)

## 요약

2코스트 **N.O.V.A. (`TFT17_DRX`)** + **습격자 (`TFT17_MeleeTrait`)** trait. raw role `ADFighter`.

- **role**: `mapGameRole('ADFighter')` → sim **Fighter** ([[role-passive]]). carry augment 없음 → role 변환 분기 없음.
- **ability "별의 일격"**: 가장 많은 적 타격 위치로 dash → 관통 단검 5개 (line) physical + 방어력 감소.
- **N.O.V.A. (DRX) carry 5종 중 하나** — surge 시 **모든 아군 Precision(spell crit 가능)** + selector 시 모든 적 출혈(burn).

> 🎯 **Akali 는 N.O.V.A. 5종 중 "팀 spell crit 인에이블러"** — surge 시 hasAkali 면 전 아군 `spellCanCrit` 부여 (다른 NOVA 챔프의 운명술사 의존 없이 crit 활성). NOVA 공통 surge 는 [[aatrox]] 참조. [[kindred]] 와 같은 NOVA carry 이나 Kindred(표식)·Akali(출혈+Precision) 효과 상이.

> ⚠️ **set17 entity confirm**: `TFT17_Akali` apiName 으로 소속 확인 (cost 2, traits N.O.V.A./습격자, role ADFighter). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 750 |
| armor / magicResist | 45 / 45 |
| damage | 45 |
| attackSpeed | 0.8 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 30 |

### Role — Fighter

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Fighter** | 2 | 10 | 0 | ❌ | `mapGameRole('ADFighter')` includes 'Fighter' (`types/index.ts:46`) |

### Active — 별의 일격 (`ability.ts:207`)

raw desc: "가장 많은 적을 타격할 수 있는 대상 옆으로 위치를 이동한 후, 관통하는 단검 `@NumShurikens@`(5)개를 던져 각각 처음 적중하는 적에게 `@ModifiedDamage@`(scaleAD)의 물리 피해를, 이후 적중하는 대상에게 `@ModifiedSecondaryDamage@`(scaleAD)의 피해. 단검은 방어력을 `@ArmorShred@` 감소 (치명타 시 `@ArmorShredCrit@`)."

raw variables: `NumShurikens` [5] / `DamageAD` [27,37,56,84,140,...] / `DamageAP` [6,4,6,9,15,...] / `SecondaryDamageModifier` [0.4] / `ArmorShred` [1] / `ArmorShredCrit` [2] / `NovaDamagePerSecond` [12,10,14,18,31,...] / `NovaShurikenBonusDamage` [0.1]

**sim 적용** (`ability.ts:207`):
```ts
TFT17_Akali: { pattern: 'line', maxTargets: 3, dash: 'to_target', debuff: { armorReduction: 15, duration: 4 }, hitCount: 5 }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| dash (가장 많은 적 타격 위치) | ⚠️ `dash: 'to_target'` | sim 은 현재 타겟으로 dash. desc "가장 많은 적 타격 위치" 와 targeting 차이 (line 관통 최적 위치 미계산) |
| 관통 단검 5개 (line) | ✅ `hitCount: 5` split | `line` (≠single) → `isSplitDamage` (`:6438`) → 총피해 `DamageAD × 5 / aliveTargets` 분배 (`:6437/6485`). maxTargets 3 관통 |
| 단검 damage (`DamageAD`, scaleAD) | ✅ auto-detect | config `damageVar` 없음 → `ability.ts:392` `DAMAGE_VAR_PRIORITY` (15개 우선순위) 에서 first match. Akali variables 에 Damage/MagicDamage/.../APDamage 없어 **DamageAD** 선택. no-filler `[27,37,56,84,140]` → ★1=27 / ★2=37 / ★3=56 |
| 2차 적중 (`SecondaryDamageModifier` 0.4) | ❌ **미반영** | `SecondaryDamageModifier` repo-wide grep **0 hit**. base config 에 `secondaryDamageVar` 없음 → 관통 2차 적중 40% 별도 피해 sim 부재 (line hitCount split 만). **Lint P2** |
| `DamageAP` (scaleAP 추가) | ❌ **미사용** | auto-detect 가 DamageAD 우선 선택 → `DamageAP` [6,4,6,9,15] (filler ★1=4/★2=6/★3=9) 미read. scaleAP 추가 피해 미반영. **Lint P2** |
| 방어력 감소 (`ArmorShred` 1 / `ArmorShredCrit` 2) | ⚠️ **값 불일치** | sim `debuff armorReduction: 15` flat (`:6998` `t.stats.armor -= 15`, 4초). raw `ArmorShred` 1 / `ArmorShredCrit` 2 → **sim 15 vs raw 1/2 불일치** (raw 단위 불명확 — 단검당? %? stacking?). 치명타 시 ArmorShredCrit 분기도 sim 미반영 (고정 15). **Lint P2** |

### N.O.V.A. (`TFT17_DRX`) trait — surge + Akali 효과

NOVA 공통 surge (TeamAttackDelay 6초, setupDrxNova/tickDrxNova, autoAssignNovaSelector) 는 [[aatrox]] 참조. Akali-specific:

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| **surge Precision (팀 spell crit)** | ✅ | `hasAkali` (surge 시 alive) → 모든 아군 `u.spellCanCrit = true` (`:4762-4767`). 운명술사 없이도 팀 전체 ability spell crit 활성 |
| **selector 모든 적 출혈 (burn)** | ✅ | `akaliSelector` (aatroxNovaStrikeSelector) → 모든 적 `burn` statusEffect, 매초 `[12,18,24]` (starLevel별) physical, **17.4 buff 10/14/18→12/18/24** (PR #166). mitigation snapshot (armor+pen+DR 적용 시점, `:4847-4874`) |
| **단검 burn ×1.10** | ✅ | post-cast (`:1280-1290`) — Akali 단검 hit 시 `akali-nova-selector` burn value × 1.10 (`NovaShurikenBonusDamage` 10%). surge 전 (burn 없음) 자연 무효 |

### 습격자 (`TFT17_MeleeTrait`) trait

`applySet17SynergyBuffs` (`:458-466`) — `championOmnivamp` [0.05,0.07,0.1] + `championAD` [0.2,0.4,0.6] (도전자 unit 추가) + `teamwideOmnivamp` [0.05] (모든 아군). 흡혈 초과량 → 보호막 변환 (cap maxHp × 0.25, `:421-434` `meleeMaxShieldPct`). (6) tier `shieldAD` 0.2. **습격자는 leading-0 없는 정상 컨벤션** (PR #186 off-by-one 미영향, idx 0 = 2습격자).

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Akali 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ line dash to_target + 단검 5개 (hitCount split) + armorReduction debuff + 단검 burn ×1.10 | `ability.ts:207`, `:6437`, `:6998`, `:1280` |
| **OOR (out-of-range dash)** | ✅ post-cast helper (`:1280` 단검 burn refresh) 는 main/OOR 공통 (PR #82 fix — Akali burn OOR 누락 회귀 방지, `:7397-7399`) | `:7397-7399` |
| **recast (onKill)** | ➖ 없음 — carry augment 전용. Akali carry augment 없음 | — |

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 750, armor/MR 45, AD 45, AS 0.8, mana 0/30, range 1)
- role Fighter (`mapGameRole('ADFighter')`)
- active line dash to_target + 단검 5개 (hitCount 5 split) + DamageAD scaleAD (★1=27/★2=37/★3=56)
- armorReduction debuff (flat 15, 4초)
- **N.O.V.A. (DRX)**: surge Precision (팀 spellCanCrit) + selector burn [12,18,24] (17.4) + 단검 burn ×1.10
- **습격자 (MeleeTrait)**: championOmnivamp/championAD + 흡혈→보호막 변환

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: armorReduction sim 15 flat vs raw `ArmorShred` 1 / `ArmorShredCrit` 2 불일치 (단위 미확인 + 치명타 분기 미반영)
- **P2**: secondaryDamage (`SecondaryDamageModifier` 0.4, 관통 2차 적중 40%) 미반영 (grep 0, base config secondaryDamageVar 없음)
- **P2**: `DamageAP` (scaleAP 추가 피해) 미사용 (auto-detect DamageAD 우선)
- (info): dash `to_target` vs desc "가장 많은 적 타격 위치" (line 관통 최적 위치 미계산)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P2 | armorReduction 15 vs raw ArmorShred 1/2 | sim `debuff.armorReduction: 15` flat 하드코딩 (`:6998`) vs raw `ArmorShred` [1] / `ArmorShredCrit` [2]. 단위/매핑 불명확 + 치명타 시 ArmorShredCrit 분기 sim 미반영 (고정 15) | **P2** | cast-time debuff — raw ArmorShred 단위 확인 후 정합. 치명타 분기 추가 | raw 1/2 의미 (단검당/%/stack) 인게임 측정 필요. sim 15 가 의도된 단순화일 수도 |
| P2 | secondaryDamage 0.4 미반영 | desc "이후 적중 대상 SecondaryDamage (40%)" — 관통 2차 타겟 별도 피해. `SecondaryDamageModifier` grep 0, base config `secondaryDamageVar` 없음 | **P2** | cast-time — line 관통 2차 적중에 `DamageAD × 0.4` 적용 (secondaryDamageVar 추가) | line hitCount split 이 근사. 정확한 2차 40% 별도 미반영 |
| P2 | DamageAP (scaleAP) 미사용 | auto-detect (`ability.ts:394`) 가 DamageAD 우선 선택 → DamageAP 미read. desc 는 scaleAD physical 만 명시하나 raw DamageAP 존재 | **P2** | damageVar — DamageAP 가 실제 추가 magic 피해인지 raw 확인. desc 미언급이라 미사용이 맞을 수도 | desc physical(scaleAD) 만 → DamageAP 는 미사용 의도 가능. raw 용도 확인 후 결정 |

> 📌 **active line/단검 + N.O.V.A. surge·selector·burn + 습격자 는 sim 정합**. `partial` 사유는 armorReduction 값 불일치 + secondaryDamage/DamageAP 미반영 등 base ability 세부 (P2). 단검 주력 피해 (DamageAD ×5 split) 와 NOVA 효과는 정합.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Akali` apiName 확인 (cost 2, traits [N.O.V.A./습격자], role ADFighter)
- [x] entity-wide grep `Akali` + `아칼리` — sim site (line config / debuff / NOVA surge·selector·burn / post-cast 단검 ×1.10 / 습격자)
- [x] raw stats 17.4 정합 (hp 750 / armor·MR 45 / AD 45 / AS 0.8 / mana 0·30 / range 1)
- [x] **raw role `ADFighter` → mapGameRole → Fighter** — `includes('Fighter')` (`types/index.ts:46`). carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — debuff 적용 (`:6995-6999`) + NOVA surge Precision (`:4762`) + Akali selector burn (`:4847-4874`) + post-cast 단검 burn ×1.10 (`:1280-1290`)
- [x] **변수 filler 판정** — DamageAD `[27,37,56,84,140]` no-filler ★1=27 / DamageAP `[6,4,6,9,15]` v0>v1 filler ★1=4 (미사용) / NumShurikens·ArmorShred·SecondaryDamageModifier·NovaShurikenBonusDamage 상수 / NovaDamagePerSecond `[12,10,14,...]` 는 sim 하드코딩 `[12,18,24]` 사용 (raw 미read, PR #166)
- [x] **actual sim integration verify (5단계)** — DamageAD auto-detect read 확인 / **`SecondaryDamageModifier` grep 0 → 2차 적중 미반영** / **`DamageAP` auto-detect 미선택 (DamageAD 우선)** / armorReduction raw(1/2) vs sim(15) 불일치 확인. 효과 주장 전 read site 검증
- [x] **cast path 3종 (PR #129 룰)** — main (line ✅) / OOR (post-cast 단검 burn 공통 ✅, PR #82 fix) / recast (carry 없음 ➖)
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — N.O.V.A. `TFT17_DRX` surge Precision/selector burn ✅ ([[aatrox]] 공통) / 습격자 `TFT17_MeleeTrait` championOmnivamp/AD (`:471-474`) + 보호막 변환 (`:421-434`) + MaxPercentHealthShield (`:535-545`) ✅. **습격자는 PR #186 off-by-one 미영향 (`teamwideOmnivamp [0.05,0.05,0.05,0.05]` leading-0 없음, idx 0 = 2습격자)** 확인
- [x] **spell crit read site (PR #183 학습)** — Akali surge 시 팀 `spellCanCrit = true` (`:4764`) → Akali ability(line) 도 cast loop spell crit 분기 (`:6581`) 적용 가능. NOVA Precision 인에이블러
- [x] **본문 Lint P2 3건 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [ ] (선택) armorReduction raw 단위 / secondaryDamage 40% / DamageAP 용도 인게임 측정

## 관련

- [[role-passive]] — Fighter role 마나·타게팅 규칙 (공격당 10 / 피격 ❌)
- [[ability-targeting]] — `line` 패턴 + hitCount split + dash to_target. cast path main/OOR (post-cast 단검 burn 공통)
- [[aatrox]] — **N.O.V.A. (DRX) 공통 surge 메커니즘**. Aatrox cycle+knockup vs Akali surge Precision(팀 crit)+출혈
- [[spell-crit]] — Akali NOVA surge 가 팀 전체 `spellCanCrit` 부여 (Precision) — 다른 carry 의 ability crit 인에이블러. Akali 본인 line ability 도 crit 가능
- [[kindred]] — 동일 N.O.V.A. carry (Kindred 표식 vs Akali 출혈+Precision). 습격자 trait 는 PR #186 off-by-one 미영향 (도전자/전달자/구원자/불한당과 달리 정상)
- 코드: `src/lib/simulator/systems/ability.ts:207/394`, `src/lib/simulator/engine/combatLoop.ts:1280/4762/4847/6437/6998`, `src/types/index.ts:46`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Akali), `public/data/tft_set17_traits.json` (TFT17_DRX / TFT17_MeleeTrait)
