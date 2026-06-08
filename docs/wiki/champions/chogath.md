---
id: chogath
type: champion
display_name_kr: 초가스
api_name: TFT17_Chogath
cost: 1
traits:
  - 암흑의 별
  - 싸움꾼
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank')). carry augment 없음
raw_role: APTank
current_patch_status: active
sim_active: partial   # base 응축 single + TotalDamage(BonusDamage no-filler ★1=140/210/290 scaleAP + 대상 maxHp 8% `:6585`) + chogath_hp permanentStacks 전투시작 영구체력(`:359`) + 암흑의 별(DarkStar)/싸움꾼(Brawler) 정합. ✅ 전투 중 cast당 maxHp 증가(BonusHealthPerCast 12/18/33) + 처치 시(BonusHealthOnKill 30/40/70) #208 수정 완료(cast loop 사망 처리 직후 maxHp+currentHp 가산) / P2 HP tier 진화(HPToTier2 1000/Tier3 2000) 미반영(grep 0) / info config.heal:true 무의미(healVar find 후보에 Chogath heal 변수 없음 — maxHp 영구 증가는 currentHp heal 과 별개)
last_verified: 2026-06-08
sources:
  - "public/data/tft_set17_champions.json (TFT17_Chogath entry — cost 1, role APTank, traits [암흑의 별/싸움꾼], mana 30/70, ability '응축' variables PercentMaximumHealthDamage/BonusDamage/BonusHealthOnKill/HPToTier2/HPToTier3/BonusHealthPerCast)"
  - "public/data/tft_set17_traits.json (TFT17_DarkStar = 암흑의 별 / TFT17_HPTank = 싸움꾼)"
  - "src/types/index.ts:327 (TFT17_Chogath permanentStacks 'chogath_hp' — '획득한 체력' UI 표시 정의)"
  - "src/lib/simulator/systems/ability.ts:201 (TFT17_Chogath: { pattern: 'single', heal: true, damageVar: 'BonusDamage' })"
  - "src/lib/simulator/engine/combatLoop.ts:6585 (Chogath 특수 처리 — baseDmg += t.maxHp × PercentMaximumHealthDamage) / :359 applyPermanentStacks chogath_hp → maxHp/currentHp"
  - "src/lib/simulator/engine/combatLoop.ts:2083 (applyDarkStarEffects 암흑의 별, Chogath 6명 중) / :2027 (applyBrawlerEffects 싸움꾼, Chogath 7명 중)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[gragas]]"
  - "[[maokai]]"
  - "[[mordekaiser]]"
---

# 초가스 (Cho'Gath)

## 요약

1코스트 **암흑의 별 (`TFT17_DarkStar`)** + **싸움꾼 (`TFT17_HPTank`)** trait. raw role `APTank`. carry augment 없음.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 ✅).
- **base ability "응축"**: 사거리 내 체력 가장 낮은 적에 `TotalDamage`(scaleHealth scaleAP — 대상 최대체력 8% + `BonusDamage`) 마법 피해 + 최대 체력 영구 `BonusHealthPerCast` 획득. 처치 시 대신 `BonusHealthOnKill` 획득.

> 🎯 **Chogath 는 영구 체력 성장 1코 탱커** (암흑의 별/싸움꾼). 매 cast·처치마다 maxHp 영구 증가가 핵심 — **#208 로 전투 중 증가 반영** (라운드 간 누적분 chogath_hp 전투 시작 + 전투 중 cast/처치 증가). TotalDamage(대상 maxHp 8% + BonusDamage)·trait 도 정합.

> ⚠️ **set17 entity confirm**: `TFT17_Chogath` apiName 으로 소속 확인 (cost 1, traits 암흑의 별/싸움꾼, role APTank). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 700 |
| armor / magicResist | 40 / 40 |
| damage | 45 |
| attackSpeed | 0.6 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 30 / 70 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` includes 'Tank' ([[role-passive]] Tank 마나 규칙) |

### Active — 응축 (`ability.ts:201` + `combatLoop.ts:6585`)

raw desc: "사거리 내 체력이 가장 낮은 적에게 `@TotalDamage@`(scaleHealth scaleAP) 마법 피해 + 최대 체력을 영구적으로 `@BonusHealthPerCast@` 획득. 처치 시 대신 `@BonusHealthOnKill@` 획득."

raw variables: `PercentMaximumHealthDamage` [0.08,..] 상수 / `BonusDamage` [140,210,290,420,715] no-filler / `BonusHealthOnKill` [35,30,40,70,115] filler / `HPToTier2` [1000,..] / `HPToTier3` [2000,..] / `BonusHealthPerCast` [0,12,18,33,50] filler

**sim 적용** (`ability.ts:201` config — `damageVar: 'BonusDamage'`, `combatLoop.ts:6585` 특수 처리):
```ts
// :6585 — TotalDamage 의 %최대체력 부분
if (unit.champion.apiName === 'TFT17_Chogath') {
  const pctHp = readVarByStar(PercentMaximumHealthDamage, star, 0.08);
  baseDmg += t.maxHp * pctHp;   // 대상 maxHp 8% 추가
}
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 체력 가장 낮은 적 타겟 | ✅ | `pattern: 'single'` (lowest-hp 타게팅) |
| `BonusDamage` (고정, scaleAP) | ✅ ★별 + scaleAP | `damageVar: 'BonusDamage'` no-filler → ★1=140/★2=210/★3=290. detectScaling desc `scaleAP` → 'ap' (`getAbilityDamage`) |
| 대상 최대체력 8% (`PercentMaximumHealthDamage`, scaleHealth) | ✅ | `:6585` `baseDmg += t.maxHp × 0.08`. TotalDamage = BonusDamage + 대상 maxHp 8% |
| **cast당 maxHp 영구 증가 (`BonusHealthPerCast` 12/18/33)** | ✅ **#208 수정** | cast loop 사망 처리 직후(`:6671`) — 미처치(`currentHp>0`) 시 `BonusHealthPerCast` → maxHp+currentHp 가산. 실측 ★2 +18 |
| **처치 시 maxHp 영구 증가 (`BonusHealthOnKill` filler ★1=30/★2=40/★3=70)** | ✅ **#208 수정** | 처치(`currentHp<=0`) 시 `BonusHealthOnKill` (PerCast 대신) 가산 |
| HP tier 진화 (`HPToTier2` 1000 / `HPToTier3` 2000) | ❌ **미반영** | `HPToTier2`/`HPToTier3` grep **0 hit**. 체력 임계 진화 sim 부재. **Lint P2** |
| config `heal: true` | ➖ **무의미** | healVar find 후보 `['Heal','APHeal','PercentMaximumHealthHealing','HealthDrain','HEALING']` 에 Chogath heal 변수 없음 → find 실패 → heal 0. Chogath 의 "체력 획득"은 currentHp heal 이 아닌 **maxHp 영구 증가** (별개 메커니즘). **info** |

### chogath_hp 영구 스택 (`combatLoop.ts:359` applyPermanentStacks)

```ts
function applyPermanentStacks(unit, placed) {
  const stacks = placed.permanentStacks;
  if (stacks.type === 'chogath_hp') {
    unit.maxHp += stacks.value;
    unit.currentHp += stacks.value;
  }
}
```

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 누적 영구 체력 → 전투 시작 maxHp 반영 | ✅ **라운드 간 입력만** | `:359` `placed.permanentStacks`(chogath_hp) 를 전투 시작 시 maxHp/currentHp 가산. types `chogath_hp` UI 표시 (`:327`) |

> ✅ **#208 로 전투 중 증가 반영** — `permanentStacks`(chogath_hp)는 라운드 간 입력값(전투 시작 반영), **전투 시뮬 중 cast/처치 maxHp 증가는 cast loop(`:6671` 직후)에서 별도 처리** (#208). 회귀 가드 `chogath-maxhp-growth.test.ts`.

### 암흑의 별 (`TFT17_DarkStar`) / 싸움꾼 (`TFT17_HPTank`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 암흑의 별 (DarkStar) | ✅ | `applyDarkStarEffects` (`:2083`) — tier별 ADAP + ExecuteHPPercent(처형) + "아군 암흑의 별 체력 30% maxHp". Chogath 암흑의 별 6명(Kaisa/Karma/Jhin/Chogath/Lissandra/Mordekaiser) 중. [[mordekaiser]] 와 동일 trait |
| 싸움꾼 (HPTank/Brawler) | ✅ | `applyBrawlerEffects` (`:2027`) — teamwide +5% maxHp + 싸움꾼 unit 추가 % maxHp. Chogath 싸움꾼 7명(Maokai/Urgot/Gragas/Chogath/TahmKench/RekSai/Pantheon) 중. [[gragas]]/[[maokai]] 와 동일 |

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Chogath 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ single lowest-hp + TotalDamage (BonusDamage + 대상 maxHp 8%) | `ability.ts:201` / `:6585` |
| **OOR (out-of-range dash)** | ➖ dash 없음 (single non-dash) | config dash 미지정 |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **chogath_hp 영구 스택(전투 시작) · 암흑의 별/싸움꾼 trait** 는 cast pipeline 과 별개.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 700, armor/MR 40, AD 45, AS 0.6, range 1, mana 30/70)
- role Tank (`mapGameRole('APTank')`)
- base 응축: TotalDamage = BonusDamage(★별 140/210/290 scaleAP) + 대상 maxHp 8% (`:6585`)
- **chogath_hp permanentStacks** 전투 시작 누적 영구 체력 (`:359`)
- **암흑의 별 (DarkStar)** + **싸움꾼 (Brawler)** trait

⚠️ **부정확 / 미반영** (Lint 후보):
- ✅ **#208 수정 완료**: 전투 중 cast당 maxHp 증가 (`BonusHealthPerCast`) + 처치 시 (`BonusHealthOnKill`) — cast loop 사망 처리 직후 maxHp+currentHp 가산
- **P2**: HP tier 진화 (`HPToTier2` 1000 / `HPToTier3` 2000) 미반영 — grep 0
- ℹ️ info: config `heal: true` 무의미 (healVar find 실패, maxHp 영구 증가는 heal 과 별개)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ✅ #208 | 전투 중 maxHp 영구 증가 → **수정 완료** | cast loop 사망 처리 직후(`:6671`) — 처치(`currentHp<=0`) 시 `BonusHealthOnKill` 아니면 `BonusHealthPerCast` → maxHp+currentHp 가산 | ~~P1~~ resolved | cast-time + onKill | 회귀 가드 `chogath-maxhp-growth.test.ts`, diff-cache #209 |
| P2 | HP tier 진화 미반영 | `HPToTier2`(1000)/`HPToTier3`(2000) 체력 임계 도달 시 진화(크기/스탯). grep 0 | **P2** | tick — maxHp 임계 도달 감시 + tier 효과 | 시각/스탯 효과. raw 의미 측정 후 |

> 📌 **TotalDamage + chogath_hp + 전투 중 maxHp 증가(#208) + 암흑의 별/싸움꾼 trait 는 sim 정합**. `partial` 잔존 사유는 HP tier 진화(P2)뿐 — maxHp 증가 P1 은 #208 해소. config.heal 무의미(info).

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Chogath` apiName 확인 (cost 1, traits [암흑의 별/싸움꾼], role APTank, vars PercentMaximumHealthDamage/BonusDamage/BonusHealthOnKill/HPToTier2/3/BonusHealthPerCast)
- [x] **carry augment 유무 (Leona/Gragas 학습)** — `carryAugments.ts` grep 0 → carry augment 없음 (0-sub 단계 불요)
- [x] entity-wide grep `Chogath` + `초가스` + `응축` + `chogath_hp` + `BonusHealthPerCast`/`BonusHealthOnKill`/`HPToTier` — sim site (특수처리 `:6585` / permanentStacks `:359` / maxHp 증가·tier grep 0 / 암흑의 별·싸움꾼)
- [x] raw stats 17.4 정합 (hp 700 / armor·MR 40 / AD 45 / AS 0.6 / mana 30·70 / range 1)
- [x] **raw role `APTank` → mapGameRole → Tank** — `includes('Tank')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — Chogath 특수처리 (`:6585`, baseDmg += t.maxHp × PercentMaximumHealthDamage) + `applyPermanentStacks` (`:353-368`, chogath_hp → maxHp/currentHp) + `applyDarkStarEffects` (`:2083`) + `applyBrawlerEffects` (`:2027`)
- [x] **변수 filler 판정** — BonusDamage [140,210,290] no-filler(v0<v1) ★1=140/★2=210/★3=290 / BonusHealthOnKill [35,30,40,70] v0>v1 filler ★1=30/★2=40/★3=70 / BonusHealthPerCast [0,12,18,33] v0=0 filler ★1=12/★2=18/★3=33 / PercentMaximumHealthDamage·HPToTier2/3 상수
- [x] **actual sim integration verify (5단계)** — TotalDamage: BonusDamage(`damageVar`) + 대상 maxHp 8%(`:6585`) read 확인 / **`BonusHealthPerCast`/`BonusHealthOnKill` → cast loop 사망 처리 직후 maxHp 증가 #208 fix ✅** / **`HPToTier2`/`HPToTier3` grep 0 → tier 진화 미반영 P2** / chogath_hp permanentStacks(`:359`) 전투 시작 반영 확인 / **config.heal healVar find 후보에 Chogath heal 변수 없음 → 무의미 info**
- [x] **cast path 3종 (PR #129 룰)** — main (single lowest-hp TotalDamage ✅) / OOR (dash 없음 ➖) / recast (carry 없음 ➖). chogath_hp·trait 별개
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 암흑의 별 `TFT17_DarkStar` `applyDarkStarEffects` (`:2083`) ✅ (Chogath 6명 중) / 싸움꾼 `TFT17_HPTank` `applyBrawlerEffects` (`:2027`) ✅ (Chogath 7명 중)
- [x] **본문 Lint P1 1건 + P2 1건 등록 → frontmatter `sim_active: partial`** (P1 sim 미반영 → 룰 #15)
- [x] **전투 중 maxHp 증가(P1) → #208 수정 완료**
- [ ] (선택) HP tier 진화(P2) sim 도입

## 관련

- [[role-passive]] — Tank role 마나 규칙 (공격당 5 / 초당 0 / 피격 ✅)
- [[ability-targeting]] — `single` lowest-hp 타겟. cast path main only (dash 없음)
- [[gragas]] — 동일 싸움꾼 (Brawler/HPTank) maxHp 증폭. carry augment 유무 대조 (Gragas 보유 / Chogath 없음)
- [[maokai]] — 동일 싸움꾼. maxHp 관련 (Maokai passive maxHp +50%)
- [[mordekaiser]] — 동일 암흑의 별 (DarkStar) trait. 6명 중
- 코드: `src/lib/simulator/systems/ability.ts:201`, `src/lib/simulator/engine/combatLoop.ts:359/2020/2083/6585`, `src/types/index.ts:327`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Chogath), `public/data/tft_set17_traits.json` (TFT17_DarkStar / TFT17_HPTank)
