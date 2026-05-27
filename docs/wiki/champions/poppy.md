---
id: poppy
type: champion
display_name_kr: 뽀삐
api_name: TFT17_Poppy
cost: 1
traits:
  - 정령족
  - 요새
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts:41 includes('Tank'))
raw_role: APTank
current_patch_status: active
sim_active: partial   # 정령(Meeps) 추가 효과 (MeepShield + MeepsPerAstro) 미반영 — combatLoop.ts:1946 주석 "복잡 → 별도 PR" 의도된 단순화. raw base shield + ally Resists 는 active
last_verified: 2026-05-27
sources:
  - "public/data/tft_set17_champions.json (TFT17_Poppy entry — cost 1, role APTank, traits 정령족/요새)"
  - "src/lib/simulator/systems/ability.ts:184 (TFT17_Poppy: { pattern: 'self_buff' } — helper 가 메인 처리)"
  - "src/lib/simulator/engine/combatLoop.ts:895-942 (applyPoppyShieldAndResists — base raw passive, augment 무관)"
  - "src/lib/simulator/engine/combatLoop.ts:3428-3433 (Resists buff 만료 처리 — armor/magicResist 차감 revert)"
  - "src/lib/simulator/engine/combatLoop.ts:6421-6425 (main cast self_buff 분기 — Poppy/Mordekaiser 는 getAbilityShield fallback skip, helper 가 정확 shield 적용)"
  - "src/lib/simulator/engine/combatLoop.ts:7030-7032 (main cast — applyPoppyShieldAndResists 호출)"
  - "src/lib/simulator/engine/combatLoop.ts:7147-7151 (OOR cast self_buff 분기 — main 과 동일 fallback skip)"
  - "src/lib/simulator/engine/combatLoop.ts:7178-7180 (OOR cast — applyPoppyShieldAndResists 호출, main + OOR parity)"
  - "src/lib/simulator/engine/combatLoop.ts:1949 (정령족 8 챔프 — Bard / Gnar / Fizz / Rammus / Poppy / Corki / Veigar / IvernMinion)"
  - "src/lib/simulator/engine/combatLoop.ts:1946 (Meeps 미반영 의도된 단순화 주석 — Rammus FlatDRPerMeep / Poppy MeepShield 등 — 별도 PR)"
  - "src/data/carryAugments.ts:150-169 (TFT17_Augment_PoppyCarry — base 와 별개, [[poppy-carry]] 참조)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[poppy-carry]]"
  - "[[hero-augment-carry]]"
  - "[[mordekaiser]]"
  - "[[jax]]"
  - "[[nasus]]"
---

# 뽀삐 (Poppy)

## 요약

1코스트 **Tank** (raw `APTank` → `mapGameRole()` → sim Tank, [[role-passive]]), 정령족 (Astronaut) + 요새 (Bastion) trait. raw ability "다들 모여!" — base shield (본인) + 2칸 내 아군에 armor/magicResist 가산 + 정령(Meeps) 추가 효과 (MeepShield + MeepsPerAstro — sim 미반영).

[[poppy-carry]] (정령단 속도 / Termeepnal Velocity) augment 활성 시 가장 강한 Poppy 1명이 **Fighter 로 변환** + ranged projectile (rangeOverride 4) + AD physical single + armorScale + spiritBounceOnKill + 미프 stack damage amp. 본 페이지는 **base raw Poppy** 의 sim 동작을 다루며 carry 변환 사항은 [[poppy-carry]] 참조.

> ⚠️ Role 주의 — base vs carry: raw role `APTank` → sim **Tank** (weight 3, 공격당 마나 5, 피격 시 마나 ✅). **PoppyCarry augment 활성 시** `applyHeroCarryTransforms` 가 `target.role = 'Fighter'` overwrite → Fighter 룰 ([[jax]] / [[nasus]] / [[mordekaiser]] 와 동일 패턴, 4번째 base APTank → Fighter 변환). 단 **`applyPoppyShieldAndResists` helper 자체는 carry 활성 여부와 무관 동작** — base sim 이 helper 통합 (main + OOR cast 양쪽 호출).

## 메커니즘 (base raw, helper 통합 sim)

### Stats (raw, 17.3 LIVE)

| Stat | 값 |
|------|---|
| hp | 700 |
| armor / magicResist | 45 / 45 |
| damage | 60 |
| attackSpeed | **0.65** |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 30 / 100 |

> ⚠️ AS **0.65** 는 raw base. PoppyCarry augment desc "AS 0.7→0.75" 는 augment 측 stat 변경 — [[poppy-carry]] Lint #5 참조 (base AS 0.65 와 별개로 augment grant 인지 base override 인지 인게임 verify 필요).

### Active — 다들 모여! (Set 17 Poppy)

raw desc: "`@ShieldDuration@`초 동안 `@ModifiedShield@`(scaleAP)의 보호막을 얻습니다. 지속시간 동안 2칸 내 아군이 방어력 및 마법 저항력을 `@ModifiedResists@`(scaleAP) 얻습니다. **정령 추가 효과:** 정령들이 가장 가까운 아군 `@ModifiedNumMeeps@`명에게 `@ShieldDuration@`초 동안 `@ModifiedMeepShield@`(scaleAP)의 보호막을 부여합니다."

**sim 적용** (`ability.ts:184`):
```ts
TFT17_Poppy: { pattern: 'self_buff' },  // 보호막 + 2칸 내 아군 방어력+마법저항 — combat-start 시 helper 호출
```

| 단계 | 코드 위치 | 동작 |
|------|----------|------|
| cast 시점 (main pipeline) | `combatLoop.ts:7030-7032` `applyPoppyShieldAndResists(unit, getAllyTeam(...))` | base shield + ally Resists 적용 |
| cast 시점 (OOR cast path) | `combatLoop.ts:7178-7180` 동일 helper 호출 | **main + OOR parity** ([[mordekaiser]] 와 동일 cast path 3종 룰) |
| main self_buff 분기 | `combatLoop.ts:6421-6425` | Poppy/Mordekaiser 는 `getAbilityShield` fallback skip — helper 가 정확 shield 적용 (codex P1 PR #102 — value[starLevel] shifted indexing 회피) |
| Resists buff 만료 (`durTicks` 후) | `combatLoop.ts:3428-3433` | ally `stats.armor` / `stats.magicResist` 차감 revert (`Math.max(0, ...)` over-subtract 방지) |

### Helper — `applyPoppyShieldAndResists` (`combatLoop.ts:895-942`)

```ts
function applyPoppyShieldAndResists(unit, allies) {
  // readVarByStar 로 Shield / ShieldDuration / Resists star별 정확 추출 (sentinel filler 자동 처리)
  const shieldBase = readVarByStar(Shield, starLevel, 0);
  const shieldDur = readVarByStar(ShieldDuration, starLevel, 4);
  const resistsBase = readVarByStar(Resists, starLevel, 0);
  const apMul = 1 + ap / 100;
  // 본인 shield 적용 + statusEffect 추적
  if (shieldValue > 0) {
    unit.shield += shieldValue;
    statusEffects.push({ type: 'shield', sourceId: 'poppy-shield', remainingTicks: durTicks, value: shieldValue });
  }
  // 2칸 내 아군에 armor/magicResist 가산 + statusEffect 추적
  if (resistsValue > 0) {
    for ally in allies (id != unit.id):
      // 2칸 radius check + stat 직접 가산 + statusEffect 추적
  }
}
```

`readVarByStar` 가 sentinel filler (Resists `[36, 15, 25, 60, 100, 36, 36]` 등) 자동 처리. armor/MR 만료 시 `tickStatusEffects` expired loop 에서 revert (line 3014 shield cleanup 패턴 차용 — armor/MR read site 82개 변경 회피).

### raw ability variables (★1~★3 + sentinel filler)

| 변수 | raw 값 | sim 적용 | 비고 |
|------|--------|---------|------|
| `Shield` | `[300, 400, 475, 575, 675, 390, 390]` ★1=400, ★2=475, ★3=575 | ✅ `applyPoppyShieldAndResists` readVarByStar → `shield × (1+AP/100)` | sentinel ★0=300 |
| `ShieldDuration` | `[4, 4, 4, 4, 4, 4, 4]` (전부 4초) | ✅ helper line 904 `readVarByStar` (fallback 4) | shield + ally Resists 만료 시간 공통 |
| `Resists` | `[36, 15, 25, 60, 100, 36, 36]` ★1=15, ★2=25, ★3=60 | ✅ helper line 907 `readVarByStar` → ally `armor + magicResist` 각 가산 | sentinel ★0=36 (★3 = 60 보다 큼 — fallback 안전) |
| `MeepShield` | `[100, 125, 160, 210, 260, 300, 300]` ★1=125, ★2=160, ★3=210 | ❌ **미반영** | 정령(Meeps) unit 추가 보호막 — Meeps 메커니즘 자체 sim 미존재 (`combatLoop.ts:1946` "별도 PR") |
| `MeepsPerAstro` | `[1, 1, 1, 1, 1, 1, 1]` (전부 1명) | ❌ **미반영** | 정령 1명당 1명 아군에 MeepShield 부여 — Meeps 메커니즘 자체 미존재 |

### Trait — 정령족 (Astronaut) + 요새 (Bastion)

- **정령족 (`TFT17_Astronaut`)** — 8 챔프 그룹 (`combatLoop.ts:1949`): Bard / Gnar / Fizz / Rammus / **Poppy** / Corki / Veigar / IvernMinion. 정령(Meeps) 효과 → 정령족 활성 시 Astronaut buff 적용. **현재 sim 미반영** (`combatLoop.ts:1946` "Rammus FlatDRPerMeep, Poppy MeepShield 등 — 복잡 → 별도 PR" 의도된 단순화)
- **요새 (`Bastion`, `TFT17_ResistTank`)** — `applyBastionEffects` (`combatLoop.ts:1817-1850`) ✅ **base sim 통합 완료**. `unitHasTrait(u, '요새')` 분기 (line 1837) 에서 Poppy 포함 요새 챔프 전체에 `stats.armor += bonusArmor` / `stats.magicResist += bonusMr` 가산. `bastionDoubleEndTick` 으로 Duration doubled 만료 처리 완비. combat-start 시 `combatLoop.ts:4580-4581` 양 팀 호출. Tank role 보강 — base Poppy 도 정상 적용

## PoppyCarry 변환 시 (참조)

PoppyCarry augment 활성 시:
- `applyHeroCarryTransforms`: `target.role = 'Fighter'` + `selectedCarryAugment = 'TFT17_Augment_PoppyCarry'`
- **ranged projectile** (rangeOverride 4, dash 없음) + AD physical single + armorScale + spiritBounceOnKill
- non-selected 카피도 rangeOverride 4 받음 (`combatLoop.ts:2299` 주석 — PR #144 학습)
- **`applyPoppyShieldAndResists` helper 는 augment 활성 여부와 무관 동작** — base sim 이 helper 통합 (raw cast 시점에 항상 호출)

상세 cast path / armorScale / spiritBounce / 패치 변경 / lint history 는 [[poppy-carry]] 참조.

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.3 정합 (hp 700, armor/MR 45, AD 60, AS **0.65**, range 1, mana 30/100)
- ability override `pattern: 'self_buff'` + helper 통합 (`applyPoppyShieldAndResists`)
- base **Shield × (1+AP/100)** 본인 적용 + statusEffect 추적 (`shieldDuration` 만료)
- 2칸 내 아군 **Resists × (1+AP/100)** armor + magicResist 각 가산 + statusEffect 추적
- **Resists buff 만료 처리** — `armor / magicResist` 차감 revert (`combatLoop.ts:3428-3433`, `Math.max(0, ...)` over-subtract 가드)
- **cast path parity**: main (`combatLoop.ts:7030-7032`) + OOR (`:7178-7180`) 양쪽 `applyPoppyShieldAndResists` 호출 ([[ability-targeting]] cast path 3종 룰 일관, [[mordekaiser]] 동일 패턴)
- `getAbilityShield` fallback skip (`combatLoop.ts:6421-6425` + `:7147-7151`) — helper 가 정확 shield 적용 (codex P1 PR #102 회피)
- `readVarByStar` sentinel filler 자동 처리 (Resists `[36, 15, 25, ...]` 등)
- PoppyCarry 활성 시 role overwrite (Fighter) — helper 는 영향 받지 않음

❌ **미반영** (의도된 단순화 — `combatLoop.ts:1946` 주석 명시):
- **MeepShield (정령 보호막) 미반영** — 정령(Meeps) unit 자체 sim 미존재 → 가장 가까운 아군 N명에 MeepShield 부여 메커니즘 누락
- **MeepsPerAstro (정령 N명) 미반영** — 정령족 활성 시 정령 1명 부여 메커니즘 미구현

🔍 **검증 필요**:
- 정령족 활성 시 Poppy 본인이 받는 buff (정령 1명 own) — Astronaut trait active 분기 sim 적용 여부

## Lint 신규 등록 후보 (champion ingest 발견)

| # | 항목 | 의미 | Tier | 처리 |
|---|------|------|------|------|
| P1 | MeepShield + MeepsPerAstro (정령 추가 효과) sim 미반영 — 정령(Meeps) unit 메커니즘 자체 미존재 | active cast 의 정령족 활성 시 정령 부여 + ally MeepShield 부여 누락. ★3 MeepShield = 210, MeepsPerAstro = 1 (아군 1명에게 210 shield 추가) | **P1** | 의도된 단순화 — `combatLoop.ts:1946` 주석 명시 "별도 PR". 추후 fidelity 개선 시 fix 후보. frontmatter `sim_active: partial` 강등 (룰 #15 적용) |

**Z1 (Zed) + B1/B2/B3 (Blitzcrank) + P1 (Poppy) = 7번째 champion 페이지 누적 base 미반영 lint** = Jax L1~L5 (5) + Nasus N1~N4 (4) + Mordekaiser M1 자동 무효 (1) + Zed Z1 P1 (1) + Blitzcrank B1 P1 / B2 P2 / B3 P2 (3) + Poppy P1 P1 (1) = **14건 활성 + 1건 자동 무효**.

> ✅ **subagent self-catch metric 1건 기여** (2026-05-27 PR #159): subagent 가 5단계 integration verify 로 "요새 trait base 적용 여부 별도 verify 필요" 잘못 표기를 **P1 self-catch** — 실제 `applyBastionEffects` (`combatLoop.ts:1817-1850`) 정상 통합 완료. 본 commit 에서 5 line 통합 fix.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Poppy` apiName 확인 (cost 1, traits ['정령족', '요새'], role APTank)
- [x] entity-wide grep `Poppy` + `poppy` — sim 21+ site (helper 1 + 만료 처리 1 + main cast 호출 1 + OOR cast 호출 1 + self_buff fallback skip 2 + carry 변환 4 + 정령족 group 1 + Meeps 미반영 주석 1)
- [x] raw stats 17.3 정합 (`public/data/tft_set17_champions.json` TFT17_Poppy entry — AS **0.65** 강조)
- [x] **raw role `APTank` → mapGameRole → sim Tank** ([[jax]] / [[nasus]] / [[mordekaiser]] 와 동일 매핑 — 4번째 base APTank champion. PoppyCarry 활성 시 Fighter 변환 동일 패턴)
- [x] PoppyCarry 변환 시 role overwrite `Fighter` + helper 영향 없음 (mordekaiser 동일 패턴)
- [x] **cast path 3종** — main (`:7030-7032`) + OOR (`:7178-7180`) `applyPoppyShieldAndResists` 호출 parity verify. recast 무관 (self_buff 패턴 + onKillRecast 없음)
- [x] `getAbilityShield` fallback skip (`:6421-6425` + `:7147-7151`) — helper 가 정확 shield 적용 (codex P1 PR #102 회피 verify)
- [x] `readVarByStar` sentinel filler 자동 처리 (Resists `[36, 15, 25, 60, 100, 36, 36]` 등)
- [x] Resists buff 만료 처리 verify — `armor / magicResist` 차감 revert (`:3428-3433` `Math.max(0, ...)` over-subtract 가드)
- [x] **Meeps 미반영 의도된 단순화** verify — `combatLoop.ts:1946` 주석 명시 "별도 PR"
- [x] **본문 Lint P1 (P1) 등록 → frontmatter `sim_active: partial` 강등** (룰 #15 적용, [[mordekaiser]] M1 / [[zed]] Z1 / [[blitzcrank]] B1 패턴)
- [x] **mechanic page sync (룰 #14)** — base champion ingest, 신규 cast roll 호출처 추가 없음 → `spell-crit.md` / `mana.md` last_verified 갱신 불요
- [x] **carry augment cross-ref** — [[poppy-carry]] (TFT17_Augment_PoppyCarry) + Lint #5 (AS 0.7→0.75 augment 영역, base AS 0.65 와 별개 명시)
- [x] 정령족 8 챔프 그룹 멤버 확인 (`combatLoop.ts:1949`)
- [x] **요새 (Bastion) trait base Poppy 적용 여부 verify** — `applyBastionEffects` (`combatLoop.ts:1817-1850`) `unitHasTrait(u, '요새')` 분기로 정상 통합 (subagent P1 self-catch, PR #159)
- [ ] (선택) 정령족 활성 시 Poppy 본인 정령 1명 own buff 적용 여부 verify

## 관련

- [[role-passive]] — Tank role 마나/타게팅 규칙 (base raw 적용)
- [[ability-targeting]] — `self_buff` 패턴 + cast path 3종
- [[hero-augment-carry]] — PoppyCarry 변환 시 role/stat/ability override 시스템
- [[poppy-carry]] — PoppyCarry augment 페이지 (정령단 속도 + Lint #5 잔존)
- [[mordekaiser]] — 동일 raw `APTank` → Tank 매핑 + helper 통합 sim 패턴 (`applyMordekaiserProcCast` 차용)
- [[jax]] / [[nasus]] — 동일 raw `APTank` → Tank 매핑 + augment 시 Fighter overwrite 패턴 (4 챔프 누적)
- [[shen]] / [[zed]] / [[blitzcrank]] — 동일 helper 통합 sim family (helper + main loop tick / cast path 양쪽 호출 패턴)
- 코드: `src/lib/simulator/systems/ability.ts:184`, `src/lib/simulator/engine/combatLoop.ts:895/3428/6421/7030/7147/7178`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Poppy)
