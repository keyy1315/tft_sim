---
id: gragas
type: champion
display_name_kr: 그라가스
api_name: TFT17_Gragas
cost: 2
traits:
  - 초능력
  - 싸움꾼
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank'))
raw_role: APTank
current_patch_status: active
carry_augment: TFT17_Augment_GragasCarry   # 자폭 — abilityOverride aoe_circle selfDamage (conditional)
sim_active: partial   # base 화학적 분노 aoe_circle Damage(★별 200/300/450 scaleAP) + 싸움꾼(Brawler) maxHp + 초능력(PsyOps) + carry augment(GragasCarry 자폭 selfDamage+baseDamageHpFrac+hexReduction+tankBonus 전부) 정합. ✅ base heal #202 수정 완료 (find 후보 'HEALING' 추가 + HealingPercentHealth maxHp 8.5% 별도 합산) / P2 CCDuration 2초 냉각(ASSlow 30%)→stun 0.5 근사(CC 종류·시간 불일치) / P2 ASSlow 공속감소 미반영(stun 대체)
last_verified: 2026-06-08
sources:
  - "public/data/tft_set17_champions.json (TFT17_Gragas entry — cost 2, role APTank, traits [초능력/싸움꾼], mana 30/80, ability '화학적 분노' variables DURATION/HEALING/Damage/CCDuration/HealingPercentHealth/ASSlow)"
  - "public/data/tft_set17_traits.json (TFT17_PsyOps = 초능력 / TFT17_HPTank = 싸움꾼)"
  - "src/data/carryAugments.ts:258 (TFT17_Augment_GragasCarry '자폭' — abilityOverride aoe_circle radius 3/selfDamage, abilityData healthCost 0.20/hexReduction 0.45/baseDamageHpFrac 0.10/tankBonusMultiplier 0.60/damage [280,420,630])"
  - "src/types/index.ts (mapGameRole — 'APTank' includes 'Tank' → Tank)"
  - "src/lib/simulator/systems/ability.ts:211 (TFT17_Gragas: { pattern: 'aoe_circle', radius: 1, heal: true, stun: 0.5 })"
  - "src/lib/simulator/systems/ability.ts:379 (detectScaling — desc scaleAP → 'ap') / :442 (getAbilityDamage — Damage ★별 + ap scaling)"
  - "src/lib/simulator/engine/combatLoop.ts:7028-7082 (config.heal — healVar find 후보에 'HEALING' 포함 + HealingPercentHealth 별도 합산 — #202 fix 완료)"
  - "src/lib/simulator/engine/combatLoop.ts:2020 (applyBrawlerEffects 싸움꾼 maxHp, Gragas 7명 중) / :2234 (applyPsyOpsRadiantSwap 초능력) / :6353-6390 (GragasCarry 자폭 selfDamage 공식)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[reksai]]"
  - "[[maokai]]"
  - "[[leona]]"
---

# 그라가스 (Gragas)

## 요약

2코스트 **초능력 (`TFT17_PsyOps`)** + **싸움꾼 (`TFT17_HPTank`)** trait. raw role `APTank`. **carry augment 보유** (`TFT17_Augment_GragasCarry` 자폭).

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 시 ✅).
- **base ability "화학적 분노"**: `DURATION`(2)초 체력 `ModifiedHeal`(scaleHealth scaleAP) 회복 → 대상+인접 적 `Damage`(scaleAP) 마법 피해 + `CCDuration`(2)초 `ASSlow`(30%) 냉각.
- **carry augment "자폭"**: 반경 3칸 자폭 (maxHp 20% 희생 + maxHp 10% + AP, 1칸당 45% 감소, 탱커 +60%).

> 🎯 **Gragas 는 회복 + 광역 냉각 2코 탱커** (초능력/싸움꾼). carry augment 시 자폭 nuke 로 변환. base Damage·heal(#202)·싸움꾼·carry 자폭 sim 정합. base heal 은 변수명 미스매치를 **#202 로 해소** ([[reksai]] #195 APHealing 패턴).

> ⚠️ **set17 entity confirm**: `TFT17_Gragas` apiName 으로 소속 확인 (cost 2, traits 초능력/싸움꾼, role APTank). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 950 |
| armor / magicResist | 45 / 45 |
| damage | 50 |
| attackSpeed | 0.6 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 30 / 80 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` includes 'Tank' ([[role-passive]] Tank 마나 규칙) |

### Active — 화학적 분노 (base, `ability.ts:211`)

raw desc: "`@Duration@`(2)초 동안 체력을 `@ModifiedHeal@`(scaleHealth scaleAP) 회복. 이후 대상 및 인접한 적에게 `@DamageTotal@`(scaleAP) 마법 피해 + `@CCDuration@`(2)초 `@ASSlow*100@`(30)% 냉각."

raw variables: `DURATION` [2,..] 상수 / `HEALING` [0,415,470,630,790] filler / `Damage` [0,200,300,450,765] filler / `CCDuration` [2,..] 상수 / `HealingPercentHealth` [0.085,..] 상수 / `ASSlow` [0.3,..] 상수

**sim 적용** (`ability.ts:211`):
```ts
TFT17_Gragas: { pattern: 'aoe_circle', radius: 1, heal: true, stun: 0.5 }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 대상+인접 마법 피해 (`Damage`) | ✅ ★별 + scaleAP | `findDamageVariable` → `Damage` (filler → ★1=200/★2=300/★3=450). `detectScaling` desc `scaleAP` → `'ap'` → `getAbilityDamage` `× (1+ap/100)` (`:379`/`:442`). aoe_circle radius 1 = 대상+인접 각각 full |
| 체력 회복 (`HEALING` flat 415~630, scaleHealth+scaleAP) | ✅ **#202 수정** | `config.heal` find 후보에 `HEALING` 추가 (`:7032`) → `HEALING × (1+ap/100)` 합산. [[reksai]] #195 APHealing 패턴 |
| 회복 maxHp 비례 (`HealingPercentHealth` 8.5%) | ✅ **#202 수정** | `HealingPercentHealth` 별도 read → `maxHp × 0.085` 합산 (if healVar 블록 내, HEALING 가진 Gragas만 진입) |
| 냉각 (`CCDuration` 2초, `ASSlow` 30% 공속감소) | ⚠️ **stun 0.5 근사** | sim `stun: 0.5` 고정. raw 는 ASSlow 30%(공속 감소)를 CCDuration 2초간 → sim 은 기절(완전 행동불가) 0.5초로 대체. **CC 종류(냉각≠기절) + 시간(2초→0.5초) 모두 불일치**. **Lint P2** |
| 공속 감소 효과 (`ASSlow` 30%) | ❌ 미반영 | stun 0.5 대체 (위 P2 에 포함) — ASSlow 정확 적용 시 별도 |

> ✅ **base heal #202 수정 완료** — heal find 후보에 `HEALING` 추가 + `HealingPercentHealth` 별도 합산. 2코 탱커 생존 핵심기 정합 (회귀 가드 `gragas-heal.test.ts`).

### Conditional — 자폭 (carry augment `TFT17_Augment_GragasCarry`, `carryAugments.ts:258`)

선택 시 base ability 를 **완전 대체** (abilityOverride). raw: "자폭하여 maxHp 20% 희생 + 반경 3칸 magic damage (10% 최대체력 + AP). 1칸당 45% 감소. 탱커 상대 +60%."

```ts
abilityOverride: { pattern: 'aoe_circle', radius: 3, selfDamage: true, selfDamageHpFloor: 1 }
abilityData: { damage: [280,420,630], healthCost: 0.20, hexReduction: 0.45,
               baseDamageHpFrac: 0.10, tankBonusMultiplier: 0.60, damageType: 'magic' }
```

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 자폭 self-damage (`healthCost` 0.20 = maxHp 20%) | ✅ | `config.selfDamage` → `maxHp × healthCost` (`:6360`), hpFloor 1 (자기 스킬로 사망 안 함) |
| 적군 AOE (`maxHp × baseDamageHpFrac` 0.10 + AP × damage/100) | ✅ | `:6390` `baseAOE = maxHp × 0.10 + ap × (damage[★]/100)` (selfDamage 분기) |
| 거리 감소 (`hexReduction` 0.45, 1칸당) | ✅ | `(1 − 0.45)^distance` multiplicative (`:6353` 공식) |
| 탱커 상대 +60% (`tankBonusMultiplier`) | ✅ | role === 'Tank' 시 `× (1+0.60)` |
| spell crit | ❌ 미적용 | 자폭 AOE 는 `selfDamage` 분기(`:6359`) → `continue` 로 일반 cast crit roll(`:6607` 등) skip. Gragas `critChance` 0.25 이나 자폭은 crit 없음. **info** |

> **carry 자폭은 `selfDamage` 분기 special path** (`:6353-6390`) — `baseDamageHpFrac` 반영 ✅. [[leona]] LeonaCarry(line, selfDamage 없음)는 같은 `baseDamageHpFrac` 이 미반영(P1)인 것과 대조 — Gragas 는 selfDamage 분기라 정상 반영.

### 초능력 (`TFT17_PsyOps`) / 싸움꾼 (`TFT17_HPTank`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 싸움꾼 (HPTank/Brawler) | ✅ | `applyBrawlerEffects` (`:2020`) — teamwide +5% maxHp + 싸움꾼 unit 추가 % maxHp. Gragas 싸움꾼 7명(Maokai/Urgot/Gragas/Chogath/TahmKench/RekSai/Pantheon) 중. 호출 `:4624` |
| 초능력 (PsyOps) | ✅ | `applyPsyOpsRadiantSwap` (`:2234`) — PsyOps item Radiant swap (tier4). PsyOps 공감 임플란트/AttackPct 는 item 기반 (eventBus). Gragas 초능력 일원 |

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Gragas 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ base aoe_circle 대상+인접 Damage / carry aoe_circle radius 3 selfDamage 자폭 | `ability.ts:211` / carry abilityOverride |
| **OOR (out-of-range dash)** | ➖ dash 없음 (base/carry 모두 non-dash aoe_circle). heal/Fountain 등 post-cast hook 은 in-range cast 후 | config dash 미지정 |
| **recast (onKill)** | ➖ 없음 — carry 자폭 1회 (onKillRecast 없음) | — |

> **싸움꾼 maxHp · 초능력 item · 자폭 selfDamage** 는 cast pipeline 과 별개 / 특수 분기.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 950, armor/MR 45, AD 50, AS 0.6, range 1, mana 30/80)
- role Tank (`mapGameRole('APTank')`)
- base 화학적 분노: Damage ★별(200/300/450, scaleAP `ap` scaling) + 냉각 stun 0.5 근사
- **carry augment** (GragasCarry 자폭): selfDamage(healthCost 0.20) + 적군 AOE(baseDamageHpFrac 0.10 + AP) + hexReduction 0.45 + tankBonus 0.60 전부 반영
- **싸움꾼** maxHp 증폭 + **초능력** PsyOps item

⚠️ **부정확 / 미반영** (Lint 후보):
- ✅ **#202 수정 완료**: base heal (HEALING + HealingPercentHealth maxHp 8.5%) — find 후보 확장 + 별도 합산
- **P2**: CCDuration 2초 냉각(ASSlow 30%) → stun 0.5 근사 (CC 종류 + 시간 불일치)
- **P2**: ASSlow 공속감소 미반영 (stun 대체)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ✅ #202 | base heal 미반영 → **수정 완료** | healVar find 후보에 `HEALING` 추가 + `HealingPercentHealth`(maxHp 8.5%) 별도 합산 (Reksai APHealing 패턴) | ~~P1~~ resolved | cast-time — `:7032` 적용 | 회귀 가드 `gragas-heal.test.ts`. IvernMinion 등 heal find 일반화는 별도 과제 |
| P2 | 냉각→stun 근사 (CC 종류·시간) | sim `stun: 0.5` vs raw ASSlow 30% 공속감소 CCDuration 2초. 기절(완전 행동불가)≠냉각(공속 감소) + 0.5초≠2초 | **P2** | config — ASSlow 30% slow status 를 CCDuration 2초 적용 (stun 대체) | CC 종류·시간 부정확. stun 이 더 강한 CC 라 과대평가 가능 |

> 📌 **base Damage+heal(#202)+carry 자폭+싸움꾼/초능력 trait 는 sim 정합**. `partial` 잔존 사유는 냉각→stun 근사(P2)뿐 — base heal P1 은 #202 로 해소.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Gragas` apiName 확인 (cost 2, traits [초능력/싸움꾼], role APTank, vars DURATION/HEALING/Damage/CCDuration/HealingPercentHealth/ASSlow)
- [x] **0-sub conditional augment** — `TFT17_Augment_GragasCarry` (carryAugments.ts:258) abilityOverride aoe_circle selfDamage + abilityData 전 필드 (healthCost/baseDamageHpFrac/hexReduction/tankBonus 전부 selfDamage 분기 `:6353-6390` 반영 ✅)
- [x] entity-wide grep `Gragas` + `그라가스` + `화학적 분노` + `GragasCarry` + `HEALING` — sim site (base config / carry augment / heal find 미스매치 / 싸움꾼·초능력)
- [x] raw stats 17.4 정합 (hp 950 / armor·MR 45 / AD 50 / AS 0.6 / mana 30·80 / range 1)
- [x] **raw role `APTank` → mapGameRole → Tank** — `includes('Tank')`
- [x] **함수 컨텍스트 read (2단계)** — `config.heal` 블록 (`:7028-7064`, healVar find 후보 + APHealing 별도 read) + `detectScaling`/`getAbilityDamage` (`:379-442`) + `applyBrawlerEffects` (`:2020`) + GragasCarry selfDamage 자폭 (`:6353-6390`)
- [x] **변수 filler 판정** — HEALING/Damage v0=0 → isFiller → idx=starLevel → ★1=value[1] (HEALING ★1=415/★2=470/★3=630, Damage ★1=200/★2=300/★3=450). DURATION/CCDuration/HealingPercentHealth/ASSlow 상수
- [x] **actual sim integration verify (5단계)** — **`config.heal` healVar find 후보에 `HEALING` 없음 → Gragas heal find 실패 P1** / Damage findDamageVariable→'Damage' + detectScaling scaleAP→ap 확인 / **carry baseDamageHpFrac → selfDamage 분기 `:6390` 반영 (leona 와 대조)** / 냉각 stun 0.5 근사 P2
- [x] **cast path 3종 (PR #129 룰)** — main (base aoe_circle ✅ / carry selfDamage 자폭 ✅) / OOR (dash 없음 ➖) / recast (자폭 1회 ➖). 싸움꾼·초능력·자폭 별개 분기
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 싸움꾼 `TFT17_HPTank` `applyBrawlerEffects` (`:2020`) ✅ (Gragas 7명 중) / 초능력 `TFT17_PsyOps` `applyPsyOpsRadiantSwap` (`:2234`) ✅
- [x] **heal find 미스매치 (Reksai #195 동형) 재확인** — Gragas `HEALING` (main) + `HealingPercentHealth` 둘 다 find 후보 밖. Reksai 는 base heal 반영 + APHealing 만 누락이었으나 Gragas 는 main heal 자체 누락 (더 심각). heal find 후보 확장 과제와 연결
- [x] **본문 Lint P1 1건 + P2 2건 등록 → frontmatter `sim_active: partial`** (P1 sim 미반영 → 룰 #15)
- [ ] (선택) base heal(HEALING+HealingPercentHealth) sim 도입 (P1) / 냉각 slow status (P2)

## 관련

- [[role-passive]] — Tank role 마나 규칙 (공격당 5 / 초당 0 / 피격 ✅)
- [[ability-targeting]] — base/carry `aoe_circle`. cast path main only (dash 없음)
- [[reksai]] — 동일 heal 변수명 미스매치 (Reksai APHealing #195 / Gragas HEALING). 동일 싸움꾼 trait. heal find 후보 좁음 공통 과제
- [[maokai]] — 동일 싸움꾼 (Brawler/HPTank) maxHp 증폭. Maokai passive maxHp(#190) 와 합산 순서 (`:4622`)
- [[leona]] — 동일 carry augment 보유. carry baseDamageHpFrac 대조 (Gragas selfDamage 반영 ✅ vs Leona line 미반영 P1)
- 코드: `src/lib/simulator/systems/ability.ts:211/379/442`, `src/lib/simulator/engine/combatLoop.ts:2020/2234/6353/7028`, `src/data/carryAugments.ts:258`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Gragas), `public/data/tft_set17_traits.json` (TFT17_PsyOps / TFT17_HPTank)
