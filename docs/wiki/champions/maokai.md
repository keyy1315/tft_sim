---
id: maokai
type: champion
display_name_kr: 마오카이
api_name: TFT17_Maokai
cost: 3
traits:
  - N.O.V.A.
  - 싸움꾼
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts:41 includes('Tank')). carry augment 없음 → role 변환 분기 없음
raw_role: APTank
current_patch_status: active
sim_active: partial   # active X덩굴 aoe_circle Damage(scaleAP magic ★1=100/100/150) + stun 1.5 + N.O.V.A.(DRX) surge heal(maokaiHealPct 0.12)/selector 광역 stun + 싸움꾼(applyBrawlerEffects maxHp) + passive maxHp +50%(applyMaokaiPassive PR #190) 정합. P2 selector stun ★3=1.75 vs raw NovaStunDuration ★3=1.5 off-by-one (코드가 raw ★4 값을 ★3에) / P2 NOVA 타격 기본공격 추가 물리(NovaHealthDamage 0.08 scaleHealth) 미반영 / info active stun starLevel ★4/5(1.75/2) 미반영 (config 고정 1.5, 3코 ★1-3=1.5 동일 무관)
last_verified: 2026-06-05
sources:
  - "public/data/tft_set17_champions.json (TFT17_Maokai entry — cost 3, role APTank, traits [N.O.V.A./싸움꾼], ability '교차의 마수' variables PassiveRatio/Damage/StunDuration/NovaStunDuration/NovaHealthDamage)"
  - "public/data/tft_set17_traits.json (TFT17_DRX = N.O.V.A. — Heal 0.12 등 / TFT17_HPTank = 싸움꾼)"
  - "src/types/index.ts:41 (mapGameRole — 'APTank' includes 'Tank' → Tank)"
  - "src/lib/simulator/systems/mana.ts:23 (Tank manaPerAttack 5 / manaPerSecond 0 / manaFromDamage true)"
  - "src/lib/simulator/systems/ability.ts:225 (TFT17_Maokai: { pattern: 'aoe_circle', radius: 2, stun: 1.5 })"
  - "src/lib/simulator/systems/ability.ts:371-375 (detectDamageType — desc '마법 피해' → magic) / :390 DAMAGE_VAR_PRIORITY first 'Damage' (Maokai Damage var 선택)"
  - "src/lib/simulator/engine/combatLoop.ts:4794-4799 (N.O.V.A. surge — hasMaokai → 모든 아군 maxHp × maokaiHealPct(Heal 0.12) × (1+healAmp) 회복)"
  - "src/lib/simulator/engine/combatLoop.ts:4819-4835 (Maokai selector — surge 시 모든 적 광역 stun [1.5,1.5,1.75] starLevel별)"
  - "src/lib/simulator/engine/combatLoop.ts:2011-2022 (applyBrawlerEffects — 싸움꾼 maxHp × multiplier, unitHasTrait '싸움꾼')"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[aatrox]]"
  - "[[kindred]]"
  - "[[spell-crit]]"
---

# 마오카이 (Maokai)

## 요약

3코스트 **N.O.V.A. (`TFT17_DRX`)** + **싸움꾼 (Brawler)** trait. raw role `APTank`.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]]). carry augment 없음 → role 변환 분기 없음.
- **ability "교차의 마수"**: passive (모든 요소 최대 체력 +50%) + active (X자 덩굴 교차 magic + 기절).
- **N.O.V.A. (DRX) carry 5종 중 하나** — surge 시 모든 아군 maxHp 12% 회복 + selector 시 적 전체 광역 기절.

> 🎯 **Maokai 는 N.O.V.A. 5종 중 "탱커/CC 형"** — surge teamwide heal + selector 광역 stun. NOVA 공통 surge 는 [[aatrox]] 참조. [[kindred]] (표식) / akali (출혈+Precision) 와 다른 유틸 (heal + CC) carry.

> ⚠️ **set17 entity confirm**: `TFT17_Maokai` apiName 으로 소속 확인 (cost 3, traits N.O.V.A./싸움꾼, role APTank). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 1100 |
| armor / magicResist | 40 / 40 |
| damage | 60 |
| attackSpeed | 0.6 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 30 / 100 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` includes 'Tank' (`types/index.ts:41`), `mana.ts:23` (manaFromDamage true) |

### Passive — 최대 체력 +50% (`PassiveRatio`)

raw desc: "모든 요소로부터 최대 체력을 `@PassiveRatio*100@`%(50%) 더 얻습니다."

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| maxHp +50% (PassiveRatio 0.5) | ✅ **적용 (PR #190)** | `applyMaokaiPassive` (`combatLoop.ts:2044`) — combat-start 에 Maokai unit `maxHp/currentHp × (1 + PassiveRatio)`. "모든 요소로부터" → item/Astronaut(flat)/Brawler(×) 적용 후 ×1.5 (호출 `:4628`, Stargazer mark 선택 전). 회귀 가드 `maokai-passive-maxhp.test.ts`. **PR #190 전엔 grep 0 미반영 (Lint P1) → 해소** |

### Active — 교차의 마수 (`ability.ts:225`)

raw desc: "대상에게 X자 형태 덩굴을 교차시켜 적중한 적에게 `@DamageTotal@`(scaleAP)의 마법 피해를 입히고 `@StunDuration@`초 동안 기절."

raw variables: `Damage` [100,100,150,225,300] / `StunDuration` [1.5,1.5,1.5,1.75,2]

**sim 적용** (`ability.ts:225`):
```ts
TFT17_Maokai: { pattern: 'aoe_circle', radius: 2, stun: 1.5 }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| X덩굴 magic 피해 (`Damage`, scaleAP) | ✅ | `damageVar` 없음 → `DAMAGE_VAR_PRIORITY` first **'Damage'** 선택 (`ability.ts:390`). `detectDamageType` desc "마법 피해" → **magic** (`:371-375`). no-filler `[100,100,150]` → ★1=100 / ★2=100 / ★3=150 (★1=★2 raw) |
| aoe_circle radius 2 | ✅ | 반경 2칸 적중. `hitCount` 없음 → split 아님 (타겟별 full damage) |
| 기절 (`StunDuration`) | ⚠️ **고정 1.5** | sim `stun: 1.5` config (cast loop `config.stun` read). raw `StunDuration` [1.5,1.5,1.5,1.75,2] → **★1-3 모두 1.5 정합**. ★4=1.75/★5=2 는 sim 미반영이나 3코 ★3까지라 실전 무관 (info). Leona Lint #9 (starLevel stun) 과 달리 ★1-3 동일값이라 회귀 없음 |

### N.O.V.A. (`TFT17_DRX`) trait — surge + Maokai 효과

NOVA 공통 surge (TeamAttackDelay 6초, setupDrxNova/tickDrxNova, autoAssignNovaSelector) 는 [[aatrox]] 참조. Maokai-specific:

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| **surge teamwide heal** | ✅ | `hasMaokai && maokaiHealPct > 0` → 모든 아군 `maxHp × maokaiHealPct(DRX Heal 0.12) × (1+healAmp)` 회복 (`:4794-4799`) |
| **selector 광역 stun** | ⚠️ **코드 ★3 불일치** | `maokaiSelector` (aatroxNovaStrikeSelector) → surge 시 모든 적 `stun` `maokaiStunArr [1.5,1.5,1.75]` (`:4826`, starLevel별). ★1/★2=1.5 정합. ⚠️ **코드 ★3=1.75 vs raw `NovaStunDuration` ★3=1.5 불일치** (코드가 raw ★4 값 1.75 를 ★3 에 사용 — 잠재 off-by-one, 3코 ★3 시 0.25초 과다). **Lint P2** |
| **NOVA 타격 기본공격 추가 물리** (`NovaHealthDamage` 0.08 scaleHealth) | ❌ **미반영** | `NovaHealthDamage` repo-wide grep **0 hit**. desc "전투 끝까지 기본 공격이 ModifiedNovaDamage(scaleHealth) 추가 물리" — selector 시 기본공격 강화 sim 부재 (광역 stun 만 반영). **Lint P2** |

### 싸움꾼 (Brawler) trait

`applyBrawlerEffects` (`:2011-2022`) — `unitHasTrait('싸움꾼')` unit 에 `maxHp × multiplier` (brawlerBonus 가산). Maokai 싸움꾼 7명 (Maokai/Urgot/Gragas/Chogath/TahmKench/RekSai/Pantheon) 중 하나 → maxHp 증폭 수령 (전투 시작 시점, currentHp 비례 증가).

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Maokai 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ active aoe_circle Damage(magic) + stun 1.5 | `ability.ts:225`, cast loop `config.stun` |
| **OOR (out-of-range dash)** | ✅ stun config 동일 (`config.stun` 1.5 고정 — starLevel 비대칭 없음, Leona Lint #9 회귀 무관). Maokai range 1 melee 라 OOR dash 가능하나 stun 값 동일 | cast loop OOR 분기 |
| **recast (onKill)** | ➖ 없음 — carry augment 전용. Maokai carry augment 없음 | — |

> **NOVA surge/selector** (`:4794`/`:4819`) 와 **passive maxHp** (`applyMaokaiPassive` PR #190) 는 cast pipeline 과 별개 (surge 시점 / 전투 시작). 싸움꾼 maxHp 도 combat-start.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 1100, armor/MR 40, AD 60, AS 0.6, mana 30/100, range 1)
- role Tank (`mapGameRole('APTank')`) + Tank 마나 (공격당 5 / 피격 ✅)
- active X덩굴 aoe_circle radius 2 + Damage(scaleAP magic, ★1=100/★2=100/★3=150) + stun 1.5 (★1-3 정합)
- **N.O.V.A. (DRX)**: surge teamwide heal (maokaiHealPct 0.12) + selector 광역 stun [1.5,1.5,1.75]
- **싸움꾼 (Brawler)** maxHp 증폭 (`applyBrawlerEffects`)
- **passive maxHp +50%** (`PassiveRatio` 0.5) — `applyMaokaiPassive` combat-start ×1.5 (**PR #190 수정**)

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: selector 광역 stun `maokaiStunArr` 코드 ★3=1.75 vs raw `NovaStunDuration` ★3=1.5 불일치 (코드가 raw ★4 값을 ★3 에 사용 — 잠재 off-by-one, 3코 ★3 selector stun 0.25초 과다)
- **P2**: NOVA 타격 기본공격 추가 물리 (`NovaHealthDamage` 0.08 scaleHealth) 미반영 — selector stun 만, 기본공격 강화 부재
- (info): active stun starLevel ★4/5 (1.75/2) 미반영 — config 고정 1.5, 3코 ★1-3=1.5 동일이라 실전 무관

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ✅ resolved | passive maxHp +50% 미반영 | desc "모든 요소 최대 체력 +50%" — `PassiveRatio` 0.5 grep 0 이던 것 (maxHp 1.5배 탱커 핵심 패시브 부재) | ~~P1~~ → ✅ | (a) combat-start — `applyMaokaiPassive` maxHp ×(1+PassiveRatio) | **PR #190 수정 완료** (`applyMaokaiPassive` `:2044`, 호출 `:4628` Brawler 이후/Stargazer mark 전 + 회귀 가드 `maokai-passive-maxhp.test.ts`). Codex Maokai #189 P1 |
| P2 | selector stun ★3 코드/raw 불일치 | `maokaiStunArr [1.5,1.5,1.75]` (`:4826`) ★3=1.75 vs raw `NovaStunDuration` ★3=1.5. 코드가 raw ★4 값(1.75)을 ★3 에 사용 — 잠재 off-by-one (3코 ★3 selector stun 0.25초 과다) | **P2** | (a) surge-time — `maokaiStunArr` 를 raw `NovaStunDuration` read 로 전환 (★3=1.5 정합). 또는 의도 확인 | ★1/★2=1.5 정합. ★3 만 0.25초 차이. 의도(NOVA stun 강화) 가능성 — 인게임/패치노트 확인 후 결정 |
| P2 | NOVA 타격 기본공격 추가 물리 미반영 | desc "전투 끝까지 기본공격 NovaHealthDamage(0.08 scaleHealth) 추가 물리" — selector 시 기본공격 강화. grep 0 | **P2** | (b) attack-hook — selector Maokai 평타에 maxHp × 0.08 추가 물리 (akali 단검 burn 패턴 유사) | selector 시점만. 광역 stun 은 반영됨. 기본공격 강화만 gap |
| info | active stun starLevel ★4/5 미반영 | sim `config.stun` 고정 1.5 vs raw StunDuration ★4=1.75/★5=2. 단 3코 ★1-3=1.5 동일 | info | cast-time — starLevel별 stun (Leona Lint #9 패턴) | 3코 ★3까지 1.5 동일이라 실전 무관. 명시만 |

> 📌 **active X덩굴 + N.O.V.A. surge heal/selector stun + 싸움꾼 maxHp + passive maxHp +50%(PR #190) 는 sim 정합**. `partial` 잔여 사유는 P2 (selector stun ★3 off-by-one / NOVA 타격 기본공격 추가 미반영). NOVA 공통은 [[aatrox]] 와 동일 코드 path.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Maokai` apiName 확인 (cost 3, traits [N.O.V.A./싸움꾼], role APTank)
- [x] entity-wide grep `Maokai` + `마오카이` + `maokai` — sim site (active config / NOVA surge heal·selector stun / 싸움꾼 / passive·NovaHealthDamage grep 0)
- [x] raw stats 17.4 정합 (hp 1100 / armor·MR 40 / AD 60 / AS 0.6 / mana 30·100 / range 1)
- [x] **raw role `APTank` → mapGameRole → Tank** — `includes('Tank')` (`types/index.ts:41`). carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — surge heal (`:4794-4799`) + Maokai selector stun (`:4819-4835`) + `applyBrawlerEffects` (`:2011-2022`) 전체 read. passive/NovaHealthDamage 는 grep 0 확인
- [x] **변수 filler 판정** — Damage `[100,100,150,225,300]` no-filler (v0=v1=100) → ★1=100/★2=100/★3=150 / StunDuration `[1.5,1.5,1.5,1.75,2]` ★1-3=1.5 / PassiveRatio·NovaHealthDamage 상수
- [x] **actual sim integration verify (5단계)** — active Damage 'Damage' auto-detect read 확인 / **`PassiveRatio` → `applyMaokaiPassive` (`:2044`) read (PR #190 수정, 이전 grep 0 P1 해소)** / **`NovaHealthDamage` grep 0 → NOVA 기본공격 추가 미반영 (P2)** / surge heal maokaiHealPct(`:4725` Heal) read. 효과 주장 전 read site 검증
- [x] **cast path 3종 (PR #129 룰)** — main (aoe_circle stun ✅) / OOR (config.stun 1.5 고정 동일 ✅) / recast (carry 없음 ➖). stun starLevel 비대칭 없음 (1.5 고정)
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — N.O.V.A. `TFT17_DRX` surge heal/selector stun ✅ ([[aatrox]] 공통) / 싸움꾼 `TFT17_HPTank` `applyBrawlerEffects` (`:2011-2022`, `unitHasTrait '싸움꾼'` :2021 `apiName === 'TFT17_HPTank'`) maxHp 증폭 ✅. 싸움꾼은 scaling.json synergies 아닌 별도 helper (PR #186 off-by-one 무관)
- [x] **재발 패턴 적용** — ① role canonical APTank→Tank ② Damage scaleAP magic (scaleArmor 아님) / **NovaHealthDamage scaleHealth 미반영 P2** ③ spell crit: Maokai active magic 은 cast loop crit 분기 가능 (운명술사/Akali Precision 시), 자체 부여 없음 ④ 함수 본문 read (surge/selector/brawler) + passive/Nova grep 0 ⑤ trait 경로 (싸움꾼 별도 helper)
- [x] **본문 Lint 등록 → frontmatter `sim_active: partial` 강등** (룰 #15) — P1 passive maxHp 는 PR #190 수정 완료 (✅ resolved), 잔여 P2 (selector stun off-by-one / NovaHealthDamage)
- [ ] (선택) NovaHealthDamage 기본공격 추가 / selector stun ★3 off-by-one sim 도입 (P2)

## 관련

- [[role-passive]] — Tank role 마나·타게팅 규칙 (공격당 5 / 피격 ✅ / weight 3)
- [[ability-targeting]] — `aoe_circle` 패턴 + stun. cast path main/OOR (stun 1.5 고정 대칭)
- [[aatrox]] — **N.O.V.A. (DRX) 공통 surge 메커니즘**. Aatrox cycle+knockup vs Maokai surge heal+selector 광역 stun (유틸/CC carry)
- [[kindred]] — 동일 N.O.V.A. carry (Kindred 표식 vs Maokai heal+CC). 싸움꾼 trait 는 scaling.json synergies 아닌 별도 helper (도전자 off-by-one 무관)
- [[spell-crit]] — Maokai active magic 은 spell crit 가능 (Akali NOVA Precision / 운명술사 시 `spellCanCrit`)
- 코드: `src/lib/simulator/systems/ability.ts:225/371/390`, `src/lib/simulator/engine/combatLoop.ts:2011/4770/4796`, `src/types/index.ts:41`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Maokai), `public/data/tft_set17_traits.json` (TFT17_DRX)
