---
id: reksai
type: champion
display_name_kr: 렉사이
api_name: TFT17_Reksai
cost: 1
traits:
  - 태고족
  - 싸움꾼
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts:41 includes('Tank')). carry augment 없음
raw_role: APTank
current_patch_status: active
sim_active: partial   # ability 지반 돌출 aoe_circle Damage(scaleAP zero filler ★1=80/120/180) + stun 1.0 + heal(maxHp×PercentMaximumHealthHealing 0.065) + 태고족(Primordian (3) damageAmp+0.45) + 싸움꾼(HPTank maxHp) 정합. P1 heal scaleAP(APHealing ★1=90/★2=200) 미반영 — config.heal find 후보가 'APHeal' 인데 raw 는 'APHealing' (이름 미스매치) → heal = maxHp% 만, scaleAP heal 부분 누락 (heal 절반+ 손실)
last_verified: 2026-06-05
sources:
  - "public/data/tft_set17_champions.json (TFT17_Reksai entry — cost 1, role APTank, traits [태고족/싸움꾼], ability '지반 돌출' variables PercentMaximumHealthHealing/APHealing/Damage/StunDuration)"
  - "public/data/tft_set17_traits.json (TFT17_Primordian = 태고족 (3) DamageMultiplier 1.45 / TFT17_HPTank = 싸움꾼)"
  - "src/types/index.ts:41 (mapGameRole — 'APTank' includes 'Tank' → Tank)"
  - "src/lib/simulator/systems/mana.ts:23 (Tank manaPerAttack 5 / manaFromDamage true)"
  - "src/lib/simulator/systems/ability.ts:203 (TFT17_Reksai: { pattern: 'aoe_circle', radius: 1, stun: 1.0, heal: true })"
  - "src/lib/simulator/engine/combatLoop.ts:7028-7050 (config.heal — healVar find ['Heal','APHeal','PercentMaximumHealthHealing','HealthDrain']. Reksai 는 PercentMaximumHealthHealing(0.065<1 → maxHp×0.065) 매칭, APHealing 미매칭 ('APHeal'≠'APHealing'). healAmp 적용 + maxHp cap)"
  - "src/lib/simulator/engine/combatLoop.ts:2165 (applyPrimordianEffects 태고족 Primordian — (3) DamageMultiplier 1.45 → 태고족 unit damageAmp += 0.45, unitHasTrait '태고족')"
  - "src/lib/simulator/engine/combatLoop.ts:2020 (싸움꾼 applyBrawlerEffects — TFT17_HPTank maxHp × multiplier)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[illaoi]]"
  - "[[maokai]]"
  - "[[spell-crit]]"
---

# 렉사이 (Reksai)

## 요약

1코스트 **태고족 (`TFT17_Primordian`)** + **싸움꾼 (`TFT17_HPTank`)** trait. raw role `APTank`.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]]). carry augment 없음.
- **ability "지반 돌출"**: 체력 회복 (scaleHealth maxHp% + scaleAP) + 인접 적 공중 띄움(stun) + magic 피해.
- 1코 탱커 — 태고족 (3) 피해 증폭 + 싸움꾼 maxHp.

> ⚠️ **set17 entity confirm**: `TFT17_Reksai` apiName 으로 소속 확인 (cost 1, traits 태고족/싸움꾼, role APTank). Riot raw ID `TFT17_RekSai`(대문자 S) ↔ CommunityDragon `TFT17_Reksai` 정규화 (`championIdAliases.ts:12`). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 700 |
| armor / magicResist | 45 / 45 |
| damage | 50 |
| attackSpeed | 0.6 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 40 / 100 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | ✅ | `mapGameRole('APTank')` includes 'Tank' (`types/index.ts:41`), `mana.ts:23` (manaFromDamage true) |

### Active — 지반 돌출 (`ability.ts:203`)

raw desc: "체력을 `@TotalHealing@`(scaleHealth scaleAP) 회복한 후 인접한 적을 잠시 공중에 띄우고 `@ModifiedDamage@`(scaleAP)의 마법 피해."

raw variables: `PercentMaximumHealthHealing` [0.065] / `APHealing` [90,200,220,260,300] / `Damage` [0,80,120,180,315] / `StunDuration` [1]

**sim 적용** (`ability.ts:203`):
```ts
TFT17_Reksai: { pattern: 'aoe_circle', radius: 1, stun: 1.0, heal: true }
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| magic 피해 (`Damage`, scaleAP) | ✅ | `damageVar` 없음 → `DAMAGE_VAR_PRIORITY` first **'Damage'**. **zero filler** `[0,80,120,180]` (v0=0) → ★1=80 / ★2=120 / ★3=180 (`detectDamageType` "마법 피해" → magic) |
| aoe_circle radius 1 (인접 적) | ✅ | 반경 1칸 |
| 공중 띄움 (`StunDuration` 1) | ✅ | config `stun: 1.0` (raw StunDuration [1] 정합) |
| 체력 회복 scaleHealth (maxHp 6.5%) | ✅ | `config.heal` (`:7028`) → healVar `PercentMaximumHealthHealing` (0.065 < 1) → `maxHp × 0.065` (`:7035` `healVal < 1` 분기). healAmp 적용 + maxHp cap |
| 체력 회복 scaleAP (`APHealing`) | ❌ **미반영** | `config.heal` healVar find 후보 = `['Heal','APHeal','PercentMaximumHealthHealing','HealthDrain']` (`:7032`). raw 는 **`APHealing`** (find 의 `'APHeal'` 과 이름 미스매치) → 미매칭. heal = `maxHp×0.065` (scaleHealth) **만**, scaleAP heal (`APHealing` ★1=90/★2=200/★3=220) 누락 — **heal 절반 이상 손실**. **Lint P1** |

> ⚠️ desc `TotalHealing` = scaleHealth(maxHp 6.5%) + scaleAP(APHealing) 합산인데, sim 은 `PercentMaximumHealthHealing` 만 매칭하고 `APHealing` 은 find 후보 이름 (`'APHeal'`) 불일치로 미read. 1코 ★1 기준 heal 의도 ≈ maxHp×0.065(45.5) + APHealing 90 = 135.5 인데 sim 은 45.5 만 (APHealing 90 누락). ★2 는 APHealing 200 으로 누락분 더 큼.

### 태고족 (`TFT17_Primordian`) trait

`:2165-2176` — (3) tier `DamageMultiplier` 1.45 → 태고족 unit `damageAmp += 0.45` (`unitHasTrait '태고족'`). 태고족 3명 (Briar/Belveth/RekSai). Reksai 입히는 피해 +45% ((3) tier).

### 싸움꾼 (`TFT17_HPTank`) trait

`applyBrawlerEffects` (`:2020`) — `unitHasTrait('싸움꾼')` unit `maxHp × multiplier` (TeamwideBonus + HealthBonus). Reksai 싸움꾼 7명 중 하나 → maxHp 증폭.

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Reksai 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ✅ aoe_circle Damage(magic) + stun 1.0 + heal | `ability.ts:203`, `:7028` (heal) |
| **OOR (out-of-range dash)** | ➖ aoe_circle + dash 없음. range 1 melee 라 OOR fallback 진입 시 stun config 동일 (1.0 고정) | — |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 700, armor/MR 45, AD 50, AS 0.6, mana 40/100, range 1)
- role Tank (`mapGameRole('APTank')`) + Tank 마나 (공격당 5 / 피격 ✅)
- active aoe_circle radius 1 + Damage (scaleAP magic, zero filler ★1=80/★2=120/★3=180) + stun 1.0
- heal scaleHealth (maxHp × 0.065)
- **태고족 (Primordian)** (3) damageAmp +0.45 / **싸움꾼 (HPTank)** maxHp 증폭

⚠️ **부정확 / 미반영** (Lint 후보):
- **P1**: heal scaleAP (`APHealing` ★1=90/★2=200/★3=220) 미반영 — `config.heal` find 후보 `'APHeal'` ≠ raw `'APHealing'` 이름 미스매치. heal = maxHp×0.065 (scaleHealth) 만, scaleAP heal 부분 누락 (heal 절반 이상 손실)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P1 | heal scaleAP (APHealing) 미반영 | desc `TotalHealing` = scaleHealth(maxHp 6.5%) + scaleAP(APHealing). `config.heal` healVar find (`:7032`) 후보가 `'APHeal'` 인데 raw 변수명은 `'APHealing'` → 미매칭. heal = maxHp×0.065 만 (scaleAP 누락). ★1 heal 135.5 의도 vs sim 45.5 (APHealing 90 누락), ★2 누락분 더 큼 | **P1** | (c) cast-time heal — `config.heal` find 후보에 `'APHealing'` 추가 (또는 PercentMaximumHealthHealing + APHealing 합산 분기). 단 PercentMaximumHealthHealing 과 APHealing 둘 다 read 필요 (현재 find 는 첫 매칭 1개만) | heal 절반+ 손실 — 1코 탱커 생존 영향. find 후보 추가 + 합산 로직 필요. fix 권장 |

> 📌 **Damage(magic) + stun + heal scaleHealth + 태고족/싸움꾼 trait 는 sim 정합**. `partial` 핵심 사유는 **heal scaleAP (APHealing) 미반영 (P1, find 이름 미스매치)**. heal 의 maxHp% 부분만 반영되고 APHealing(scaleAP) 누락.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Reksai` apiName 확인 (cost 1, traits [태고족/싸움꾼], role APTank). RekSai/Reksai 정규화 (`championIdAliases.ts:12`)
- [x] entity-wide grep `Reksai` + `렉사이` + `RekSai` + `태고족` — sim site (ability config / config.heal / 태고족 Primordian / 싸움꾼)
- [x] raw stats 17.4 정합 (hp 700 / armor·MR 45 / AD 50 / AS 0.6 / mana 40·100 / range 1)
- [x] **raw role `APTank` → mapGameRole → Tank** — `includes('Tank')` (`types/index.ts:41`). carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — `config.heal` 블록 (`:7028-7050`, healVar find 후보 + healVal<1 maxHp% 분기) + 태고족 (`:2168-2176`) + 싸움꾼 (`applyBrawlerEffects` :2020) 전체 read
- [x] **변수 filler 판정** — Damage `[0,80,120,180,315]` zero filler (v0=0) → ★1=80/★2=120/★3=180 / APHealing `[90,200,220,260,300]` no-filler ★1=90 (단 sim 미사용) / PercentMaximumHealthHealing·StunDuration 상수
- [x] **actual sim integration verify (5단계)** — Damage 'Damage' auto-detect read / heal `config.heal` find → **PercentMaximumHealthHealing 매칭 (maxHp×0.065), APHealing 'APHeal'≠'APHealing' 미매칭 확인 (P1)** / stun config 1.0 read. 효과 주장 전 read site 검증
- [x] **cast path 3종 (PR #129 룰)** — main (aoe_circle ✅) / OOR (dash 없음 ➖) / recast (carry 없음 ➖)
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 태고족 `TFT17_Primordian` (`:2165` damageAmp+0.45, `unitHasTrait '태고족'`) ✅ / 싸움꾼 `TFT17_HPTank` `applyBrawlerEffects` (`:2020`, `unitHasTrait '싸움꾼'`) ✅. 둘 다 scaling.json synergies 아닌 별도 helper (PR #186 off-by-one 무관)
- [x] **heal find 이름 미스매치 검출** — `config.heal` find 후보 `['Heal','APHeal','PercentMaximumHealthHealing','HealthDrain']` vs raw `APHealing` → 'APHeal' 부분 매칭 안 됨 (find 는 정확 이름 비교). APHealing scaleAP heal 미반영 P1
- [x] **본문 Lint P1 1건 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [ ] (선택) heal find 후보에 'APHealing' 추가 + PercentMaximumHealthHealing 합산 (P1 fix)

## 관련

- [[role-passive]] — Tank role 마나·타게팅 규칙 (공격당 5 / 피격 ✅ / weight 3)
- [[ability-targeting]] — `aoe_circle` 패턴 + stun + heal. cast path main 중심
- [[illaoi]] — 동일 self-heal active (Illaoi drain heal vs Reksai scaleHealth+scaleAP heal). 둘 다 heal 단순화/미반영 부분 있음 (Illaoi instant 근사 / Reksai APHealing 미매칭)
- [[maokai]] — 동일 1코~3코 탱커 + aoe_circle stun (Maokai X덩굴 vs Reksai 지반 돌출). 싸움꾼 trait 공유
- [[spell-crit]] — Reksai magic 피해도 spell crit 가능 (운명술사 등 spellCanCrit 시)
- 코드: `src/lib/simulator/systems/ability.ts:203`, `src/lib/simulator/engine/combatLoop.ts:2020/2165/7028`, `src/types/index.ts:41`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Reksai), `public/data/tft_set17_traits.json` (TFT17_Primordian / TFT17_HPTank)
