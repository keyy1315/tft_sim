---
id: twistedfate
type: champion
display_name_kr: 트위스티드 페이트
api_name: TFT17_TwistedFate
cost: 1
traits:
  - 별돌보미
  - 운명술사
role: Caster   # raw "APCaster" → mapGameRole() → sim Caster (types/index.ts includes('Caster')). carry augment 없음
raw_role: APCaster
current_patch_status: active
sim_active: partial   # active 운명의 한 수 single + DamageMin~DamageMax 균등 랜덤(seed rng 결정론, no-filler ★1=180~330/★2=180~360/★3=270~540) + spell crit(운명술사 Precision) + 별돌보미 Serpent 중독(조건부) + 운명술사(Fateweaver) Precision/crit 정합. P2 spillover(처치 후 잔여 피해 가장 가까운 적) 미반영(single pattern, 뽀삐 bounce만) / P2 운명술사 Lucky(행운, 카드 두 번 뽑기) 미구현 (:1775 후속 PR) / P2 DamageMin/DamageMax scaleAP 미반영(flat read, apFactor 미적용 — AP 아이템 시 과소). info 카드 1~9 → min~max 균등 근사(raw 가 min/max 만 제공) / info 3성 9카드 1골드 전투 sim 무관 / info :6584 주석 예시값 stale([180,190,285]→[180,180,270], 결론 no-filler 유효)
last_verified: 2026-06-08
sources:
  - "public/data/tft_set17_champions.json (TFT17_TwistedFate entry — cost 1, role APCaster, traits [별돌보미/운명술사], mana 0/50, ability '운명의 한 수' variables DamageMin/DamageMax)"
  - "public/data/tft_set17_traits.json (TFT17_Stargazer = 별돌보미 / TFT17_Fateweaver = 운명술사)"
  - "src/types/index.ts (mapGameRole — 'APCaster' includes 'Caster' → Caster)"
  - "src/lib/simulator/systems/ability.ts:197 (TFT17_TwistedFate: { pattern: 'single' } — damageVar 없음, 카드 데미지는 combatLoop 특수 처리)"
  - "src/lib/simulator/engine/combatLoop.ts:6581-6588 (TwistedFate 특수 처리 — DamageMin/DamageMax readVarByStar no-filler + baseDmg = minDmg + rng.next() × (maxDmg − minDmg) 균등 랜덤)"
  - "src/lib/simulator/engine/combatLoop.ts:172 (readVarByStar — v0===v1 → isFiller=false → idx=starLevel−1)"
  - "src/lib/simulator/engine/combatLoop.ts:6607 (spell crit — unit.spellCanCrit && rng < critChance → ×critMultiplier)"
  - "src/lib/simulator/engine/combatLoop.ts:4944-4971 (triggerSerpentPoison — 별돌보미 Serpent 변종 강화칸 조건부 중독) / :6622 호출"
  - "src/lib/simulator/engine/combatLoop.ts:1779 (applyFateweaverEffects — 운명술사 Precision spellCanCrit + (4) crit, Lucky 미구현)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[caitlyn]]"
  - "[[corki]]"
  - "[[spell-crit]]"
  - "[[stargazer-fountain]]"
---

# 트위스티드 페이트 (Twisted Fate)

## 요약

1코스트 **별돌보미 (`TFT17_Stargazer`)** + **운명술사 (`TFT17_Fateweaver`)** trait. raw role `APCaster`.

- **role**: `mapGameRole('APCaster')` → sim **Caster** ([[role-passive]]). carry augment 없음.
- **ability "운명의 한 수"**: 확률로 1~9 카드 중 하나를 뽑아 대상에 던짐 → 카드에 따라 `DamageMin`~`DamageMax`(scaleAP) 마법 피해. 대상 처치 후 남는 피해는 가장 가까운 적에게(spillover). 3성: 9 뽑으면 1골드.
- sim 은 **카드 1~9 를 `DamageMin`~`DamageMax` 균등 랜덤으로 근사** (`rng.next()`, seed 기반 결정론).

> 🎯 **TwistedFate 는 "랜덤 범위 마법 폭딜" 1코 Caster** — `DamageMin`~`DamageMax` 균등 랜덤(★3 270~540). [[caitlyn]]·[[corki]] 와 동일 운명술사 (Precision/Lucky), [[stargazer-fountain]] 별돌보미 일원. sim 은 카드 분포·spillover·Lucky 를 근사/미반영 (아래 P2).

> ⚠️ **set17 entity confirm**: `TFT17_TwistedFate` apiName 으로 소속 확인 (cost 1, traits 별돌보미/운명술사, role APCaster). 한글명 list 만으로 후보 선정 금지 (룰 #149 P2 학습).

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 500 |
| armor / magicResist | 15 / 15 |
| damage | 30 |
| attackSpeed | 0.7 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 50 |

### Role — Caster

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Caster** | 1 | 7 | 2 | ❌ | `mapGameRole('APCaster')` includes 'Caster' ([[role-passive]] Caster 마나 규칙) |

### Active — 운명의 한 수 (`combatLoop.ts:6581`)

raw desc: "확률에 따라 1~9 카드 중 하나를 뽑은 후, 뽑은 카드를 대상에게 던집니다. 뽑은 카드에 따라 `@ModifiedDamageMin@`(scaleAP)~`@ModifiedDamageMax@`(scaleAP)의 마법 피해. 대상 처치 후 남는 피해는 가장 가까운 적에게. 3성 추가: 9를 뽑으면 1골드 생성. 행운: 두 번 시도하고 더 나은 결과를 선택."

raw variables: `DamageMin` [180,180,270,405,690,500,500] / `DamageMax` [330,360,540,810,1380,1000,1000]

**sim 적용** (`ability.ts:197` config 는 `{ pattern: 'single' }` damageVar 없음 → 카드 데미지는 `combatLoop.ts:6581` 특수 처리):
```ts
if (unit.champion.apiName === 'TFT17_TwistedFate') {
  const minDmg = readVarByStar(minVar?.value, unit.starLevel, baseDmg);
  const maxDmg = readVarByStar(maxVar?.value, unit.starLevel, baseDmg);
  baseDmg = minDmg + rng.next() * (maxDmg - minDmg);
}
```

| desc 요소 | sim 적용 | 근거 |
|-----------|---------|------|
| 단일 대상 카드 던지기 | ✅ `pattern: 'single'` | abilityTarget 단일 마법 피해 |
| 카드 1~9 (`DamageMin`~`DamageMax`) | ⚠️ **min~max 균등 근사** | sim 은 `minDmg + rng.next() × (maxDmg − minDmg)` (`:6587`). 카드 9단계 이산 분포가 아닌 연속 균등. raw 가 min/max 만 제공 → 적절한 근사. **info** |
| `DamageMin` 값 (★별) | ✅ no-filler | `readVarByStar` v0=180,v1=180 → `v0===0` F / `v0>v1`(180>180) F / `sentinelRatio`(180/180=1>5) F → `isFiller=false` → idx=starLevel−1 → ★1=180/★2=180/★3=270 (`:172`) |
| `DamageMax` 값 (★별) | ✅ no-filler | v0(330)≠v1(360) → no-filler → ★1=330/★2=360/★3=540 |
| → 실효 카드 범위 | ✅ | ★1 **180~330** / ★2 **180~360** / ★3 **270~540** |
| 결정론 (seed rng) | ✅ | `rng.next()` 는 seed 기반 생성기 (Replay 보장, `Math.random()` 미사용) |
| scaleAP (주문력 비례) | ❌ **미반영** | `baseDmg` 를 flat `DamageMin`~`DamageMax` 로 덮어씀 + 이후 `× (1+abilityDamageAmp)` 의 `abilityDamageAmp`=`unit.damageAmp`(딜증)뿐 → `apFactor` 미적용. AP 100 기준 flat (AP 아이템 시 과소). [[corki]] 평타 미사일은 `MissileAP × apFactor` 곱하나 TF active 는 미적용. **Lint P2** ([[caitlyn]] 동형) |
| spillover (처치 후 잔여 피해 → 가장 가까운 적) | ❌ **미반영** | single pattern, `:6634` 사망 처리에 transfer 없음. 잔여 피해 튕김은 **뽀삐 spiritBounce** (`:6769`) 전용. TF spillover 부재. **Lint P2** |
| 3성: 9 뽑으면 1골드 | ➖ 전투 sim 무관 | 골드 생성은 경제 효과 — 전투 시뮬 범위 밖. grep 0. **info** |

### Spell Crit (`combatLoop.ts:6607`)

```ts
if (unit.spellCanCrit && rng.next() < unit.stats.critChance) {
  dmg *= unit.stats.critMultiplier;
}
```

운명술사 Precision → `spellCanCrit = true` → **active 카드 피해 spell crit 가능** ✅ ([[spell-crit]]). crit 25% × 1.4배 (운명술사 (4) 시 가산).

### 별돌보미 뱀(Serpent) 중독 (`combatLoop.ts:4944` / 호출 `:6622`)

```ts
const triggerSerpentPoison = (caster, target, dmgDealt) => {
  if (caster.stargazerSerpentPoisonPercent <= 0 || caster.stargazerSerpentDurationSec <= 0) return;
  // ... dmgDealt × poisonPercent 를 durationSec 동안 poison status 로 적용
};
```

| 요소 | sim 적용 | 근거 |
|------|---------|------|
| 별돌보미 Serpent 변종 강화칸 → ability 명중 시 중독 | ✅ **조건부** | `:6622` TF active 피해(effectiveDmg)로 호출. `stargazerSerpentPoisonPercent>0` (Serpent 변종 별자리 활성) 가드. 미설정 시 no-op |

### 별돌보미 (`TFT17_Stargazer`) / 운명술사 (`TFT17_Fateweaver`) trait

| trait | sim 적용 | 근거 |
|-------|---------|------|
| 별돌보미 (Stargazer) | ✅ (변종 활성 시) | `applyStargazerEffects` (`:3173`) — base `TFT17_Stargazer` 만 활성(변종 미지정) 시 `:3184` early return → no-op. 변종(Serpent/Wolf 등) constellation 활성 시 HP/ADAP + 우물(Fountain) heal + 뱀(Serpent) 중독. TF 는 별돌보미 일원. 상세 [[stargazer-fountain]] |
| 운명술사 (Fateweaver) | ⚠️ Precision/crit ✅ / Lucky ❌ | `applyFateweaverEffects` (`:1779`) — Precision (spellCanCrit) + (4) crit stat ✅. Lucky (행운, 두 번 시도 더 나은 결과) 미구현 (`:1775` 후속 PR) → TF 카드 뽑기 better-of-2 미적용. **Lint P2** ([[caitlyn]]·[[corki]] 공통) |

## Cast path 분석 (PR #129 룰 — 3종 전수)

| cast path | TwistedFate 처리 | 근거 |
|-----------|------------------|------|
| **main pipeline** | ✅ single + DamageMin~DamageMax 균등 랜덤 | `combatLoop.ts:6581` |
| **OOR (out-of-range dash)** | ➖ dash 없음 (single non-dash) — dash omnivamp 가드 등 해당 없음. 별돌보미 Fountain heal 은 in-range cast 후 호출 가능 | config `:197` dash 미지정 |
| **recast (onKill)** | ➖ 없음 — carry augment 없음 | — |

> **별돌보미 Serpent 중독·Fountain heal + 운명술사 Precision** 은 cast pipeline 과 별개 (trait helper).

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 500, armor/MR 15, AD 30, AS 0.7, mana 0/50, range 4)
- role Caster (`mapGameRole('APCaster')`)
- active 운명의 한 수 single + `DamageMin`~`DamageMax` 균등 랜덤 (no-filler ★1=180~330/★2=180~360/★3=270~540, seed rng 결정론)
- **spell crit** (운명술사 Precision → spellCanCrit)
- **별돌보미 Serpent 중독** (조건부 — Serpent 변종 강화칸) + **별돌보미 trait** (applyStargazerEffects)
- **운명술사 (Fateweaver)** Precision + (4) crit stat

⚠️ **부정확 / 미반영** (Lint 후보):
- **P2**: spillover (처치 후 잔여 피해 가장 가까운 적) 미반영 — single pattern, 뽀삐 bounce 전용
- **P2**: 운명술사 Lucky (카드 두 번 뽑기 better-of-2) 미구현 (`:1775` 후속 PR)
- **P2**: `DamageMin`/`DamageMax` scaleAP 미반영 — flat read, `apFactor` 미적용 (AP 아이템 시 과소, [[caitlyn]] 동형)

ℹ️ **info** (Lint 아님):
- 카드 1~9 → min~max 균등 근사 (raw 가 min/max 만 제공 → 적절)
- 3성 9카드 1골드 → 경제 효과, 전투 sim 무관
- `:6584` 주석 예시값 stale (`[180,190,285]` → 실제 `[180,180,270]`, 결론 "no-filler" 는 유효)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| P2 | spillover 미반영 | desc "대상 처치 후 남는 피해는 가장 가까운 적에게". single pattern 처치 시 잔여 피해 transfer 없음. 뽀삐 spiritBounce(`:6769`) 전용 | **P2** | cast-time — primary 처치 시 overkill(잔여) 캡처 후 가장 가까운 alive 적에 재적용 (뽀삐 bounce 패턴 차용) | 카드 폭딜 overkill 손실. 뽀삐 bounce 일반화 후 |
| P2 | 운명술사 Lucky 미구현 | desc "행운: 두 번 시도 더 나은 결과". TF 카드 뽑기(고damage 카드)에 better-of-2. `:1775` 후속 PR | **P2** | rng — 운명술사 unit 확률 효과 better-of-2. trait 전반 | [[caitlyn]]·[[corki]] 와 동일 (운명술사 trait 차원 별도 PR) |
| P2 | DamageMin/Max scaleAP 미반영 | desc `(scaleAP)` 표기인데 sim flat `DamageMin`~`DamageMax` + `apFactor` 미적용. AP 100 기준 (AP 아이템 시 과소) | **P2** | cast-time — TF baseDmg 에 apFactor 곱 (corki MissileAP 패턴 차용) | flat read. base AP 100 정확, 증가分 누락 ([[caitlyn]] 동형) |

> 📌 **active 카드 데미지(균등 랜덤) + spell crit + 별돌보미 Serpent + 운명술사 Precision 은 sim 정합**. `partial` 사유는 spillover 미반영 + 운명술사 Lucky 미구현 + scaleAP 미반영 등 P2. 카드 범위 주력은 반영.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_TwistedFate` apiName 확인 (cost 1, traits [별돌보미/운명술사], role APCaster, vars DamageMin/DamageMax)
- [x] entity-wide grep `TwistedFate` + `트위스티드` + `운명의 한 수` + `Serpent` — sim site (active 특수 처리 `:6581` / spell crit / Serpent 중독 / 별돌보미·운명술사 helper)
- [x] raw stats 17.4 정합 (hp 500 / armor·MR 15 / AD 30 / AS 0.7 / mana 0·50 / range 4)
- [x] **raw role `APCaster` → mapGameRole → Caster** — `includes('Caster')`. carry augment 없음
- [x] **함수 컨텍스트 read (2단계)** — TF 특수 처리 블록 (`:6581-6588`, DamageMin/Max readVarByStar + rng 균등) + `readVarByStar` (`:172`, v0===v1 no-filler) + spell crit (`:6607`) + triggerSerpentPoison (`:4944`) + applyFateweaverEffects (`:1779`)
- [x] **변수 filler 판정** — DamageMin `[180,180,270]` v0=180,v1=180 → isFiller 3조건(`v0===0` / `v0>v1` / `sentinelRatio`) 모두 false → no-filler ★1=180/★2=180/★3=270 / DamageMax `[330,360,540]` v0(330)≠v1(360) no-filler ★1=330/★2=360/★3=540. ⚠️ `:6584` 주석 예시값 stale (옛 `[180,190,285]`, 결론 no-filler 유효)
- [x] **actual sim integration verify (5단계)** — DamageMin/DamageMax read site (`:6582-6587`) 확인 / **spillover grep → 뽀삐 spiritBounce(`:6769`)만, TF 미반영 P2** / **scaleAP: abilityDamageAmp=damageAmp 만, apFactor 미적용 → flat read P2** / **3성 골드 grep 0 (전투 무관 info)**
- [x] **cast path 3종 (PR #129 룰)** — main (active single ✅) / OOR (dash 없음 ➖, Fountain heal in-range cast 후) / recast (carry 없음 ➖). 별돌보미 Serpent·운명술사 별개 경로
- [x] **`traits` frontmatter 각 entry trait helper grep 전수 verify (룰 #16/#19)** — 별돌보미 `TFT17_Stargazer` `applyStargazerEffects` (`:3173`) ✅ ([[stargazer-fountain]]) / 운명술사 `TFT17_Fateweaver` `applyFateweaverEffects` (`:1779`) Precision+crit ✅, Lucky 미구현 (P2)
- [x] **spell crit read site (PR #183 학습)** — 운명술사 Precision (spellCanCrit `:1786`) → TF active cast 는 spell crit 가능 (`:6607` 소비). 평타 hook 별도 passive 없음 (single ability only)
- [x] **본문 Lint P2 3건 등록 → sim 미구현 기능 3건 존재 → 보수적 `sim_active: partial` 유지** (P0 case 없음 → 룰 #15 미해당)
- [ ] (선택) spillover / 운명술사 Lucky / scaleAP apFactor sim 도입 (P2)

## 관련

- [[role-passive]] — Caster role 마나 규칙 (공격당 7 / 초당 2 / 피격 ❌)
- [[ability-targeting]] — `single` 단일 대상. cast path main only (dash 없음)
- [[caitlyn]] — 동일 운명술사 (Fateweaver) Precision/Lucky. Lucky 미구현 + scaleAP 미반영(flat) 공통
- [[corki]] — 동일 운명술사. corki 평타 미사일은 `MissileAP × apFactor` 반영(대조) — TF active 는 apFactor 미적용
- [[spell-crit]] — 운명술사 Precision → TF active 카드 spell crit 가능
- [[stargazer-fountain]] — 별돌보미 (Stargazer) trait 우물/뱀(Serpent)/변종 효과
- 코드: `src/lib/simulator/systems/ability.ts:197`, `src/lib/simulator/engine/combatLoop.ts:172/1779/4944/6581/6607`
- Raw: `public/data/tft_set17_champions.json` (TFT17_TwistedFate), `public/data/tft_set17_traits.json` (TFT17_Stargazer / TFT17_Fateweaver)
