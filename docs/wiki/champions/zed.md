---
id: zed
type: champion
display_name_kr: 제드
api_name: TFT17_Zed
cost: 5
traits:
  - 은하계 사냥꾼
role: Fighter   # raw "ADFighter" → mapGameRole() → sim Fighter (types/index.ts:46 includes('Fighter'))
raw_role: ADFighter
current_patch_status: active
sim_active: partial   # 의도된 단순화 — 분신 unit 메커니즘 자체 미반영 (combatLoop.ts:1607 주석). applyZedShadow trait helper 는 active (분신 alive 가정 +40% AD 가산)
last_verified: 2026-05-27
sources:
  - "public/data/tft_set17_champions.json:5444-5495 (TFT17_Zed entry — cost 5, role ADFighter, traits 은하계 사냥꾼)"
  - "src/types/index.ts:39-48 (mapGameRole — ADFighter → Fighter)"
  - "src/lib/simulator/systems/ability.ts:251 (TFT17_Zed: { pattern: 'self_buff' } — 단순화 주석)"
  - "src/lib/simulator/engine/combatLoop.ts:1603-1620 (applyZedShadow — TFT17_ZedUniqueTrait, 분신 alive 가정 +BonusAD% Zed 본인 즉시 가산)"
  - "src/lib/simulator/engine/combatLoop.ts:6277 (self_buff 패턴 → rawAbilityDmgBase=0 강제, invader-zed:43 인용 — drift 갱신 2026-05-27)"
  - "src/lib/simulator/engine/combatLoop.ts:7001-7019 (config.selfBuff stat 적용 — selfBuff undefined 시 skip, invader-zed:44 인용 — drift 갱신 2026-05-27)"
  - "src/data/carryAugments.ts:274-286 (TFT17_Augment_InvaderZed — carry augment 진입점)"
  - "public/data/tft_set17_traits.json:423 (TFT17_ZedUniqueTrait — 은하계 사냥꾼)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[invader-zed]]"
  - "[[hero-augment-carry]]"
  - "[[shen]]"
---

# 제드 (Zed)

## 요약

5코스트 **Fighter** (raw `ADFighter` → `mapGameRole()` → sim Fighter, [[role-passive]]), **은하계 사냥꾼** (`TFT17_ZedUniqueTrait`) unique trait. 양자 분신 ability — "대상 뒤에 HP 감소 + ManaCostIncrease 증가한 분신 생성 (동일 아이템·능력치·현재 체력, 분신도 양자 분신 사용 가능)".

**sim 단순화**: 분신 unit 메커니즘 자체는 sim 에 없음 (`ability.ts:251` `pattern: 'self_buff'` + 1줄 주석, `combatLoop.ts:1607` 명시). raw ability 의 "분신 생성" 효과는 `applyZedShadow` trait helper 가 **분신 alive 가정 + Zed 본인에게 즉시 +40% AD 가산** 으로 단순화 — 즉 cast 자체는 stat-only no-op 이고 trait helper 가 combat-start 시 한 번 stat 변경으로 대체.

> ⚠️ Role 주의: raw `ADFighter` → sim **Fighter** (weight 2, 공격당 마나 10, on-hit 0, non-target damage reduction ×0.85). [[shen]] (raw APFighter → Fighter) 와 동일 매핑 family — 단 Shen 은 helper passive (`shenPassiveStack`) + selfBuff AS+30% 가 sim active, Zed 는 helper trait (`applyZedShadow`) 단순 stat 가산만 active.

## 메커니즘

### Stats (raw, 17.3 LIVE)

| Stat | 값 |
|------|---|
| hp | 1300 |
| armor / magicResist | 60 / 60 |
| damage | 85 |
| attackSpeed | 0.85 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 50 / 100 |

### Active — 양자 분신 (Quantum Shadow)

raw 명세 (`tft_set17_champions.json:5463-5491`):

> "대상 뒤에 `@HPPenalty*100@%` 감소한 최대 체력과 `@ManaCostIncrease@` 증가한 마나 소모량을 지닌 분신을 생성합니다. 분신은 제드와 동일한 아이템, 능력치, 현재 체력을 가지며 양자 분신을 사용할 수 있습니다."

| 변수 | raw 값 (★1~★7) | sim 적용 | 비고 |
|------|----------------|---------|------|
| `HPPenalty` | `[0.33, 0.33, 0.4, 0.4, 0.4, 0.33, 0.33]` ★1=0.33, ★2=0.33, ★3=0.4 | ❌ **미반영** | 분신 unit 자체 sim 미존재 |
| `ManaCostIncrease` | `[30, ...]` 전부 30 | ❌ **미반영** | 분신 mana 별도 추적 없음 |

**sim 적용** (`ability.ts:251`):
```ts
TFT17_Zed: { pattern: 'self_buff' },  // 분신 소환 (복제)
```

- abilityOverride 의 `selfBuff` 필드 **없음** → `combatLoop.ts:7001-7019` if 가드 false → cast 시 어떤 stat 변경도 없음
- `pattern: 'self_buff'` → `combatLoop.ts:6277` `rawAbilityDmgBase = 0` 강제 → cast damage 0
- 결론: **cast 자체는 mana 100 소비 외 sim 효과 없음** (no-op). 분신 unit 생성은 아예 미구현

이 단순화는 [[invader-zed]] carry augment 와 동일 패턴 (carry augment 도 abilityOverride `{ pattern: 'self_buff' }` 만, selfBuff 필드 부재).

### Trait — 은하계 사냥꾼 (`TFT17_ZedUniqueTrait`)

`applyZedShadow` (`combatLoop.ts:1610-1620`) — 분신 alive 가정 단순화:

```ts
function applyZedShadow(activeTraits, ownTeam) {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_ZedUniqueTrait' && t.activeEffect);
  if (!trait?.activeEffect) return;
  const bonusAd = (trait.activeEffect.variables['BonusAD'] ?? 0.40) as number;
  if (bonusAd <= 0) return;
  for (const u of ownTeam) {
    if (u.champion.apiName === 'TFT17_Zed') {
      u.stats.damage = Math.round(u.stats.damage * (1 + bonusAd));
    }
  }
}
```

- raw `BonusAD` = **0.40 (40%)**
- combat-start 시 Zed 본인 `stats.damage *= 1.40` 즉시 가산 (반올림)
- 분신이 항상 살아있다고 가정 — 실제 게임에서는 분신이 죽으면 buff 사라지지만 sim 은 항상 active
- trait active 조건만 만족하면 cast 무관 항상 적용

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.3 정합 (hp 1300, armor/MR 60, AD 85, AS 0.85, range 1, mana 50/100)
- `mapGameRole` 결과 Fighter role 룰 적용 (마나 / 타게팅 weight 2 / non-target DR ×0.85)
- `applyZedShadow` trait helper — `TFT17_ZedUniqueTrait` 활성 시 combat-start 시 Zed 본인에게 +40% AD 가산 (분신 alive 가정)
- ability override `pattern: 'self_buff'` 분기 진입 정합 (cast path 정합 — main + OOR 모두 진입, 효과 0)

❌ **미반영** (의도된 단순화 — `combatLoop.ts:1607` 주석 명시):
- **분신 unit 자체 sim 미존재** — raw HPPenalty / ManaCostIncrease 모두 적용 위치 없음. cast 시 두 번째 unit 생성하는 메커니즘 sim 에 없음
- **`selfBuff` 필드 부재** → cast 시 어떤 stat 변경도 없음 ([[invader-zed]] Lint #13 와 동일 패턴, base 측에도 적용)
- **cast 효과 0** — mana 100 소비만 의미. 분신 효과는 trait helper 가 stat-only 로 대체

🔍 **검증 필요** (Lint Z1 후보):
- 분신 alive 가정 단순화의 정확도 — 실제 게임에서 분신 사망 시 buff 사라짐. sim 은 항상 +40% AD 유지 → DPS 과대평가 가능성
- 분신의 자체 attack / cast 가 별도 damage source 인데 sim 미반영 → 단일 unit 평타 + selfBuff(없음) 만 평가하는 현재 sim 은 raw 의도 대비 DPS 과소평가 가능 (실제로는 두 Zed 가 동시에 평타 + cast)
- 위 두 효과의 net direction 측정 필요 — 인게임 측정 또는 patch note 분석 (`BonusAD` 0.40 이 분신 1체 평타 + cast contribution 의 대체값으로 calibrate 되어 있을 가능성)

## Lint 신규 등록 후보 (champion ingest 발견)

| # | 항목 | 의미 | 처리 |
|---|------|------|------|
| Z1 | 분신 unit 메커니즘 자체 sim 미반영 (의도된 단순화) | raw "분신 생성 + 분신도 양자 분신 사용" desc vs sim "stat-only +40% AD" — net direction 측정 필요. `applyZedShadow` BonusAD 0.40 이 분신 contribution 의 적절한 대체값인지 calibration 필요 | **P1 informational** — 의도된 단순화 명시됨 (`combatLoop.ts:1607` 주석). 추후 fidelity 개선 시 fix 후보. sim_active `partial` 강등으로 본문↔frontmatter 정합 (룰 #15 적용) |

**의도된 단순화** 라 P0 까지는 아님 — `combatLoop.ts:1607` 주석에 "시뮬에 분신 unit 메커니즘 없음 → ... +40% AD 즉시 가산 (분신 항상 alive 가정)" 명시. frontmatter `sim_active: partial` 로 본문 lint case 와 정합 (룰 #15).

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `public/data/tft_set17_champions.json:5446` `TFT17_Zed` apiName grep 확인 (한글 매칭 금지). cost 5, traits ['은하계 사냥꾼']
- [x] entity-wide grep `Zed` — sim 3 site (ability.ts:251 / combatLoop.ts:1616 / carryAugments.ts:276) 전수 식별. trait helper (`applyZedShadow`) 가 raw `BonusAD` 직접 read
- [x] raw stats 17.3 정합 (`public/data/tft_set17_champions.json:5451-5462`)
- [x] **raw role `ADFighter` → mapGameRole → sim Fighter** (`src/types/index.ts:46` `includes('Fighter')`). [[shen]] (APFighter) 와 동일 family
- [x] **Cast path 3종** — main + OOR self_buff 분기 모두 진입 정합 ([[invader-zed]] cast path table 인용). recast 무관 (onKillRecast 없음)
- [x] `selfBuff` 필드 부재로 cast 효과 0 — `combatLoop.ts:7001-7019` if 가드 verify
- [x] `applyZedShadow` 가 raw `BonusAD` 직접 read (entity-specific helper multi-source pattern) — `combatLoop.ts:1613`
- [x] **`TFT17_ZedUniqueTrait` raw entry verify** — `public/data/tft_set17_traits.json:423`
- [x] **본문 Lint Z1 등록 → frontmatter `sim_active: partial` 강등** (룰 #15 적용, [[mordekaiser]] M1 / [[leona-carry]] 패턴)
- [x] **carry augment cross-ref** — [[invader-zed]] (TFT17_Augment_InvaderZed, stage 4-2 special). carry 활성 시 role overwrite 무관 (raw 가 이미 ADFighter → Fighter)
- [ ] (선택) `BonusAD 0.40` calibration verify — 인게임 측정 (분신 contribution net direction)
- [ ] (선택) `HPPenalty 0.4` (★3) sim 적용 시 효과 측정 — 추후 fidelity 개선 시

## 관련

- [[role-passive]] — Fighter role 마나/타게팅 규칙 (공격당 10, on-hit 0, weight 2, non-target DR ×0.85)
- [[ability-targeting]] — `self_buff` 패턴 + cast path 3종 (main + OOR 진입, recast 무관)
- [[invader-zed]] — `TFT17_Augment_InvaderZed` carry augment (stage 4-2 special, sim 효과 거의 0 — Lint #13)
- [[hero-augment-carry]] — carry augment 시스템 전체
- [[shen]] — 동일 Fighter family (raw `APFighter` → Fighter, base sim 정합도 높음 — passive 완성)
- 코드: `src/lib/simulator/systems/ability.ts:251`, `src/lib/simulator/engine/combatLoop.ts:1610-1620`
- Raw: `public/data/tft_set17_champions.json:5444-5495`, `public/data/tft_set17_traits.json:423`
