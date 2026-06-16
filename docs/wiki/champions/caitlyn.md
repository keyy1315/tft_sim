---
id: caitlyn
type: champion
display_name_kr: 케이틀린
api_name: TFT17_Caitlyn
cost: 1
traits:
  - N.O.V.A.
  - 운명술사
role: Specialist   # raw "ADSpecialist" → mapGameRole() → sim Specialist (types/index.ts includes('Specialist')). carry augment 없음. mana 0/0 → active cast 없음 (passive only)
raw_role: ADSpecialist
current_patch_status: active (17.4 데이터 기준 — 17.5/17.5b patch pending: Headshot AD ★2~ 170/255/510/875→190/285/540/925 (★1=145 불변, buff). 데이터/sim 미반영, [[patch-17-5]] 참조)
sim_active: partial   # passive 평타 헤드샷(ProcChance 15% + Damage ★1=145/170/255) + N.O.V.A.(DRX) surge AS 20%/selector mark +10% incoming/selector 헤드샷[76,114,222] + 운명술사(Fateweaver) Precision+crit stat 정합. P2 평타 헤드샷 Damage flat (desc scaleAD+scaleAP, BonusDamage(scaleAP) 미사용) / P2 운명술사 Lucky(행운, 확률 두 번 굴림) 미구현 (:1775 후속 PR — Caitlyn ProcChance 단일 roll) / info selector 헤드샷 [76,114,222] 하드코딩 (=(Damage+BonusDamage)[★+1]×0.4, scaleAD/AP 없는 flat) / info 운명술사 Precision(spellCanCrit) Caitlyn ability 없어(mana 0) 실효 제한
last_verified: 2026-06-05
sources:
  - "public/data/tft_set17_champions.json (TFT17_Caitlyn entry — cost 1, role ADSpecialist, traits [N.O.V.A./운명술사], mana 0/0, ability '머리를 노려라' variables ProcChance/Damage/BonusDamage/NovaMarkDamageAmp/NovaMarkThreshold/NovaHeadshotModifier)"
  - "public/data/tft_set17_traits.json (TFT17_DRX = N.O.V.A. — AS 0.20 등 / TFT17_Fateweaver = 운명술사)"
  - "src/types/index.ts (mapGameRole — 'ADSpecialist' includes 'Specialist' → Specialist)"
  - "src/lib/simulator/systems/ability.ts:194 (TFT17_Caitlyn: { pattern: 'single' } — 패시브 헤드샷 확률. mana 0/0 라 active cast 트리거 안 됨)"
  - "src/lib/simulator/engine/combatLoop.ts:6078-6092 (평타 헤드샷 passive — ProcChance(15%) 확률 → Damage(no-filler ★1=145) × (1+damageAmp), applyResistance physical)"
  - "src/lib/simulator/engine/combatLoop.ts:4782-4787 (N.O.V.A. surge — hasCaitlyn → 모든 아군 AS × (1+asBonus DRX AS 0.20))"
  - "src/lib/simulator/engine/combatLoop.ts:4848-4866 (Caitlyn selector — surge 시 모든 적 mark value 0.10 incoming damage +10%)"
  - "src/lib/simulator/engine/combatLoop.ts:5283-5327 (tickCaitlynHeadshot — mark 적 HP 50% 이하 처음 시 1회 헤드샷 [76,114,222] starLevel별, applyAbilityMitigation physical, triggeredSet 1회 보장)"
  - "src/lib/simulator/engine/combatLoop.ts:1778-1801 (applyFateweaverEffects — 운명술사 Precision spellCanCrit :1785 + (4) crit stat :1798-1799. Lucky 행운 :1772/:1775 후속 PR 미구현)"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[aatrox]]"
  - "[[spell-crit]]"
  - "[[maokai]]"
---

# 케이틀린 (Caitlyn)

## 요약

1코스트 **N.O.V.A. (`TFT17_DRX`)** + **운명술사 (`TFT17_Fateweaver`)** trait. raw role `ADSpecialist`.

- **role**: `mapGameRole('ADSpecialist')` → sim **Specialist** ([[role-passive]]). **mana 0/0 → active cast 없음** (passive only 챔프).
- **ability "머리를 노려라"**: passive — 평타 시 `ProcChance`(15%) 확률 강화 헤드샷 (물리). active 스킬 없음 (mana 0).
- **N.O.V.A. (DRX) carry 5종 중 하나** — surge 시 모든 아군 AS +20% + selector 시 적 표식(받는 피해 +10%) + mark 적 50% HP 이하 헤드샷.

> 🎯 **Caitlyn = N.O.V.A. 5종 중 "유일한 passive-only (mana 0)"** — active cast 없이 평타 헤드샷 + NOVA selector 효과로만 기여. NOVA 공통 surge 는 [[aatrox]] 참조. [[maokai]] (탱커/CC) 와 함께 NOVA 5종 (aatrox/akali/kindred/maokai/caitlyn) 완성.

> ⚠️ **set17 entity confirm**: `TFT17_Caitlyn` apiName 으로 소속 확인 (cost 1, traits N.O.V.A./운명술사, role ADSpecialist). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 500 |
| armor / magicResist | 15 / 15 |
| damage | 65 |
| attackSpeed | 0.55 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / **0** |

> **mana 0/0** — maxMana 0 이라 ability cast 가 영원히 트리거되지 않음. Caitlyn 은 active 스킬 없는 **passive-only** 챔프 (헤드샷은 평타 hook). `ability.ts:194` `{ pattern: 'single' }` config 는 형식상 존재하나 cast 미발동.

### Role — Specialist

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Specialist** | 1 | 10 | 0 | ❌ | `mapGameRole('ADSpecialist')` includes 'Specialist'. mana 0/0 라 마나 획득 무의미 (cast 없음) |

### Passive — 강화 헤드샷 (`combatLoop.ts:6078-6092`)

raw desc: "기본 공격 시 `@ProcChance@`%(15%) 확률로 강화된 헤드샷을 발사해 `@ModifiedHeadshotDamage@`(scaleAD scaleAP)의 물리 피해."

raw variables: `ProcChance` [15] / `Damage` [145,170,255,510,875] / `BonusDamage` [20,20,30,45,77]

**sim 적용** (평타 hook, `:6079` `apiName === 'TFT17_Caitlyn'`):

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 평타 시 ProcChance(15%) 확률 헤드샷 | ✅ | `rng.next() < procChance` (`:6084`). `ProcChance` [15] no-filler → 15% |
| 헤드샷 damage (`Damage`, scaleAD) | ⚠️ **flat (scaling 근사)** | `readVarByStar(Damage)` no-filler `[145,170,255]` → **★1=145 / ★2=170 / ★3=255**. `hsDmg × (1+damageAmp)` (`:6087`), `applyResistance` physical (armor). **단 desc `ModifiedHeadshotDamage`(scaleAD+scaleAP) 인데 sim 은 Damage flat (ad/ap scaling 미적용)** + raw `BonusDamage`(scaleAP) 미사용. **Lint P2** |
| 운명술사 행운 (확률 두 번 굴림) | ❌ **미구현** | desc "운명술사: 확률 효과에 행운 (두 번 시도 더 나은 결과)". ProcChance 15% 가 운명술사 시 두 번 roll 이어야 하나 sim 은 단일 `rng.next()` (`:6084`). `applyFateweaverEffects` Lucky 미구현 (`:1772`/`:1775` 후속 PR). **Lint P2** |

### N.O.V.A. (`TFT17_DRX`) trait — surge + Caitlyn 효과

NOVA 공통 surge (TeamAttackDelay 6초, setupDrxNova/tickDrxNova, autoAssignNovaSelector) 는 [[aatrox]] 참조. Caitlyn-specific:

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| **surge 모든 아군 AS +20%** | ✅ | `hasCaitlyn && asBonus > 0` → 모든 아군 `attackSpeed × (1 + asBonus)` (DRX `AS` 0.20, `:4782-4787`) |
| **selector 모든 적 mark (받는 피해 +10%)** | ✅ | `caitlynSelector` → 모든 적 `mark` statusEffect `value 0.10` (`caitlyn-nova-selector`, `:4848-4866`). `applyAbilityMitigation` 에서 mark.value 0.10 incoming amp 적용 (`:1416`, `:5708`). raw `NovaMarkDamageAmp` 0.10 |
| **selector 헤드샷** (mark 적 50% HP 이하) | ✅ | `tickCaitlynHeadshot` (`:5283-5327`) — mark 적 (`caitlyn-nova-selector`) HP `NovaMarkThreshold`(0.5) 이하 처음 도달 시 1회 헤드샷 `[76,114,222]` (`:5294` starLevel별 하드코딩), `applyAbilityMitigation` physical, `triggeredSet` 1회 보장. **역추적 공식: (Damage+BonusDamage)[★+1] × `NovaHeadshotModifier`(0.4)** — ★1 (170+20)×0.4=76 / ★2 (255+30)×0.4=114 / ★3 (510+45)×0.4=222 (★+1 인덱스 오프셋, scaleAD/AP 없는 flat 기반) |

### 운명술사 (`TFT17_Fateweaver`) trait

`applyFateweaverEffects` (`:1778-1801`):

| 효과 | sim 적용 | 근거 |
|------|---------|------|
| Innate Precision (spellCanCrit) | ⚠️ **적용되나 Caitlyn 실효 제한** | `unitHasTrait('운명술사')` unit `spellCanCrit = true` (`:1785`, trait count 무관). 단 Caitlyn 은 ability cast 없음 (mana 0) + 평타 헤드샷 (`:6087`) 은 `applyResistance` 직접 (spell crit 분기 아님) → **Caitlyn 본인은 Precision 실효 없음** (다른 운명술사 ability carry 용) |
| (4) crit chance/damage +20% | ✅ | 운명술사 (4) tier 시 unit crit stat (`:1798-1799`) |
| 행운 (Lucky, 확률 두 번) | ❌ **미구현** | `:1772`/`:1775` "후속 PR" — ability rng 곳곳 적용 필요. Caitlyn ProcChance 에 영향 (위 passive P2) |

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | Caitlyn 처리 | 근거 |
|-----------|------------|------|
| **main pipeline** | ➖ **active cast 없음** (mana 0/0) — 헤드샷은 평타 hook (`:6078`), cast pipeline 미진입 | `:6078` (평타 hook) |
| **OOR / recast** | ➖ 없음 — cast 자체가 없음 (passive only) | — |

> Caitlyn 은 cast pipeline 을 타지 않는 유일 NOVA 챔프. 모든 효과가 **평타 hook (헤드샷)** + **trait surge/selector** + **main loop tick (selector 헤드샷)** 경로.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 500, armor/MR 15, AD 65, AS 0.55, mana 0/0, range 4)
- role Specialist (`mapGameRole('ADSpecialist')`) / mana 0 passive-only
- passive 평타 헤드샷 — ProcChance 15% + Damage (★1=145/★2=170/★3=255) physical
- **N.O.V.A. (DRX)**: surge 모든 아군 AS +20% + selector mark (+10% incoming) + selector 헤드샷 [76,114,222] (mark 50% HP 이하)
- **운명술사 (Fateweaver)**: Precision (spellCanCrit, 단 Caitlyn 실효 제한) + (4) crit stat

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: 평타 헤드샷 Damage flat — desc `ModifiedHeadshotDamage`(scaleAD+scaleAP), `BonusDamage`(scaleAP) 미사용 (ad/ap scaling 미적용)
- **P2**: 운명술사 Lucky (행운, 확률 두 번 굴림) 미구현 (`:1775` 후속 PR) — Caitlyn ProcChance 15% 단일 roll
- (info): selector 헤드샷 [76,114,222] 하드코딩 — 역추적 공식 `(Damage+BonusDamage)[★+1] × NovaHeadshotModifier(0.4)` (★1=76/★2=114/★3=222, scaleAD/AP 없는 flat). raw read 전환 가능
- (info): 운명술사 Precision (spellCanCrit) — Caitlyn ability 없어(mana 0) 실효 제한 (헤드샷 평타 passive 는 crit 분기 없음)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P2 | 평타 헤드샷 Damage flat | desc `ModifiedHeadshotDamage`(scaleAD+scaleAP) vs sim `Damage × (1+damageAmp)` flat (`:6087`). raw `BonusDamage`(scaleAP) 미사용 | **P2** | (b) attack-hook — 헤드샷에 ad/ap scaling (Damage scaleAD + BonusDamage scaleAP) 적용 | scaling 누락으로 후반 under-damage. raw HeadshotDamage 산식 verify 후 결정 |
| P2 | 운명술사 Lucky (행운) 미구현 | desc "운명술사: 확률 효과 행운 (두 번 시도)". Caitlyn ProcChance 15% 가 운명술사 시 두 번 roll 이어야 하나 단일 `rng.next()`. `:1772`/`:1775` 후속 PR 명시 | **P2** | rng — 운명술사 unit 의 확률 효과 (Caitlyn ProcChance 등) 두 번 굴려 better. 전역 영향 | Caitlyn 외 확률 ability 전반 영향. 별도 Lucky PR (운명술사 trait 차원) |
| info | selector 헤드샷 [76,114,222] 하드코딩 | tickCaitlynHeadshot damage 하드코딩 — 역추적 공식 `(Damage+BonusDamage)[★+1] × NovaHeadshotModifier(0.4)` (★1=76/★2=114/★3=222) | info | raw read 전환 가능 (공식 확정됨, ★+1 오프셋 + flat) | sim 동작값 정확. 공식 확정 — 하드코딩 대신 raw 동적 read 로 전환 시 데이터 변경 drift 방지 |

> 📌 **passive 평타 헤드샷 + N.O.V.A. surge AS/selector mark·헤드샷 + 운명술사 crit stat 은 sim 정합**. `partial` 사유는 헤드샷 scaling flat (P2) + 운명술사 Lucky 미구현 (P2, trait 전반). Caitlyn 은 mana 0 passive-only 라 cast pipeline 무관.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Caitlyn` apiName 확인 (cost 1, traits [N.O.V.A./운명술사], role ADSpecialist, mana 0/0)
- [x] entity-wide grep `Caitlyn` + `케이틀린` — sim site (평타 헤드샷 / NOVA surge·selector mark·헤드샷 / tickCaitlynHeadshot / 운명술사)
- [x] raw stats 17.4 정합 (hp 500 / armor·MR 15 / AD 65 / AS 0.55 / mana 0·0 / range 4)
- [x] **raw role `ADSpecialist` → mapGameRole → Specialist** — `includes('Specialist')`. **mana 0/0 → active cast 없음** 명시 (passive only)
- [x] **함수 컨텍스트 read (2단계)** — 평타 헤드샷 블록 (`:6078-6092`) + `tickCaitlynHeadshot` (`:5283-5327`) + selector mark (`:4848-4866`) + `applyFateweaverEffects` (`:1778-1801`) 전체 read
- [x] **변수 filler 판정** — Damage `[145,170,255,510,875]` no-filler → ★1=145/★2=170/★3=255 / BonusDamage `[20,20,30]` no-filler / ProcChance·NovaMarkDamageAmp·NovaMarkThreshold·NovaHeadshotModifier 상수
- [x] **actual sim integration verify (5단계)** — 평타 헤드샷 Damage read (`:6086`, flat × damageAmp — **scaleAD/AP + BonusDamage 미적용 확인 P2**) / selector mark value 0.10 read (`:4860`) / tickCaitlynHeadshot [76,114,222] / **운명술사 Lucky `:1772`/`:1775` 미구현 (후속 PR 주석) 확인 P2**
- [x] **cast path 3종 (PR #129 룰)** — main/OOR/recast **모두 없음** (mana 0 active cast 부재). 평타 hook + trait surge/selector + main loop tick (selector 헤드샷) 별개 경로 명시
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — N.O.V.A. `TFT17_DRX` surge AS/selector mark·헤드샷 ✅ ([[aatrox]] 공통) / 운명술사 `TFT17_Fateweaver` `applyFateweaverEffects` (`:1778`, `unitHasTrait '운명술사'` :1785) Precision+crit ✅, Lucky 미구현 명시. 운명술사는 applyFateweaverEffects 별도 helper (scaling.json synergies 아님, PR #186 off-by-one 무관)
- [x] **spell crit read site (PR #183 학습)** — 운명술사 Precision (spellCanCrit `:1785`) 적용되나 Caitlyn 평타 헤드샷 (`:6087` applyResistance) 은 crit 분기 없음 + ability cast 없음 → Caitlyn 본인 spell crit 실효 없음 (다른 운명술사 carry 용) 명시
- [x] **본문 Lint P2 2건 등록 → frontmatter `sim_active: partial` 강등** (룰 #15)
- [ ] (선택) 평타 헤드샷 scaleAD/AP+BonusDamage / 운명술사 Lucky sim 도입 (Lucky 는 trait 전반 별도 PR)

## 관련

- [[role-passive]] — Specialist role (mana 0 라 마나 규칙 무의미, passive only)
- [[ability-targeting]] — Caitlyn 은 cast pipeline 미진입 (mana 0). 평타 hook + trait surge/selector 경로
- [[aatrox]] — **N.O.V.A. (DRX) 공통 surge 메커니즘**. Aatrox cycle vs Caitlyn surge AS+selector mark/헤드샷 (passive-only)
- [[spell-crit]] — 운명술사 Precision (spellCanCrit) — Caitlyn 은 ability 없어 실효 없으나 운명술사 trait 자체는 다른 ability carry 의 crit 인에이블러
- [[maokai]] — 동일 N.O.V.A. carry. NOVA 5종 (aatrox/akali/kindred/maokai/caitlyn) 완성
- 코드: `src/lib/simulator/systems/ability.ts:194`, `src/lib/simulator/engine/combatLoop.ts:1778/4782/4848/5283/6078`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Caitlyn), `public/data/tft_set17_traits.json` (TFT17_DRX / TFT17_Fateweaver)
