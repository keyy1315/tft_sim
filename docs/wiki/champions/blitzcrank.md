---
id: blitzcrank
type: champion
display_name_kr: 블리츠크랭크
api_name: TFT17_Blitzcrank
cost: 5
traits:
  - 파티광
  - 우주 그루브
  - 선봉대
role: Fighter   # raw "APFighter" → mapGameRole() → sim Fighter (types/index.ts:46)
raw_role: APFighter
current_patch_status: active
sim_active: partial   # 본 ability active 의 UppercutDamage 별도 가산 + GrooveDurationPerTarget SpaceGroove 상태 미반영. helper passive 2개 (Bolt + 파티광) 는 active
last_verified: 2026-05-27
sources:
  - "public/data/tft_set17_champions.json (TFT17_Blitzcrank entry, cost 5, role APFighter)"
  - "public/data/tft_set17_traits.json (TFT17_BlitzcrankUniqueTrait — 파티광, HealthThreshold 0.45, PercentHealthHeal 0.15)"
  - "src/lib/simulator/systems/ability.ts:247 (TFT17_Blitzcrank: { pattern: 'aoe_circle', radius: 3, stun: 1.5, stunTargets: 1, damageVar: 'ExplosionDamage' })"
  - "src/lib/simulator/engine/combatLoop.ts:276-291 (state field default 10개 — partyHealRate / partyHpThreshold / partyUsed / partyHealing / spaceGrooveAdapPerSec / spaceGrooveDurationSec / blitzBoltCooldownSec / blitzBoltDamage / blitzBoltLastFireTick / blitzBoltSpeedMult)"
  - "src/lib/simulator/engine/combatLoop.ts:1640-1648 (applyBlitzcrankBoltPassive — combat-start 시 Blitzcrank unit 에 cooldown/damage star별 set)"
  - "src/lib/simulator/engine/combatLoop.ts:1651-1663 (applyPartyTrickster — TFT17_BlitzcrankUniqueTrait active 시 Blitzcrank 에 partyHpThreshold / partyHealRate set)"
  - "src/lib/simulator/engine/combatLoop.ts:1720-1733 (applySpaceGrooveBuffs — TFT17_SpaceGroove trait 활성 시 그루비안 unit 에 spaceGrooveAdapPerSec / spaceGrooveDurationSec set)"
  - "src/lib/simulator/engine/combatLoop.ts:4552-4556 (combat-start 시 applyPartyTrickster + applyBlitzcrankBoltPassive 양 팀 호출)"
  - "src/lib/simulator/engine/combatLoop.ts:4563-4565 (combat-start 시 applySpaceGrooveBuffs 양 팀 호출)"
  - "src/lib/simulator/engine/combatLoop.ts:5407-5435 (파티광 tick — HP < threshold 시 invulnerable + 매초 heal, HP 100% 도달 시 종료 + blitzBoltSpeedMult ×4)"
  - "src/lib/simulator/engine/combatLoop.ts:5437-5472 (Bolt passive tick — effectiveCooldown 마다 가장 HP 높은 적에게 BoltDamage × (1+AP/100) magic + mitigation 표준)"
  - "src/lib/simulator/engine/combatLoop.ts:1911 / :4664 (applyVanguardEffects — 선봉대 trait combat-start shield)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[mordekaiser]]"
  - "[[shen]]"
  - "[[zed]]"
---

# 블리츠크랭크 (Blitzcrank)

## 요약

5코스트 **Fighter** (raw `APFighter` → `mapGameRole()` → sim Fighter, [[role-passive]]), 파티광 (`TFT17_BlitzcrankUniqueTrait`) unique trait + 우주 그루브 (SpaceGroove) + 선봉대 (Vanguard). raw ability "불청객" — **passive** (BoltCooldown 마다 가장 HP 높은 적에 magic 번개) + **active** (디스코 볼 소환 + 대상 띄움 + 반경 3칸 폭발 + 1초 SpaceGroove 상태).

**sim helper 3개 (Blitzcrank 전용 2 + SpaceGroove trait 범용 1) + cast 분기**:
- Bolt passive (`applyBlitzcrankBoltPassive` + main loop tick) — Blitzcrank 전용. combat-start 시 star별 cooldown/damage set, main loop 매 tick 검사 후 발사
- 파티광 (`applyPartyTrickster` + main loop tick) — Blitzcrank 전용. HP < HealthThreshold (0.45) 시 invulnerable + 매초 maxHp × PercentHealthHeal (0.15) heal, HP 100% 도달 시 종료 + Bolt 발사 속도 ×4
- SpaceGroove (`applySpaceGrooveBuffs` + main loop tick) — 그루비안 unit 범용 (Blitzcrank 포함). combat-start 시 그루비안 unit 에 spaceGrooveAdapPerSec / spaceGrooveDurationSec set, main loop 매초 ADAP 가산
- Active cast — `aoe_circle r=3 + stun 1.5 + stunTargets 1 + damageVar ExplosionDamage` 단순화 (UppercutDamage 별도 가산 미반영)

> ⚠️ Role 주의: raw `APFighter` → sim **Fighter** (weight 2, 공격당 마나 10, on-hit 0, non-target DR ×0.85). [[shen]] (raw `APFighter` → Fighter), [[zed]] (raw `ADFighter` → Fighter) 와 동일 family. Caster 처럼 보이지만 (AP scaling damage, mana-cast) sim role 은 Fighter (BoltPassive 가 mana 와 무관 cooldown-based + active cast 도 100 mana).

## 메커니즘

### Stats (raw, 17.3 LIVE)

| Stat | 값 |
|------|---|
| hp | 1000 |
| armor / magicResist | 50 / 50 |
| damage | 50 |
| attackSpeed | 0.9 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 20 / 100 |

### Passive — 번개 (Bolt)

raw desc: "`@BoltCooldown@`초마다 체력이 가장 높은 주변 적에게 번개를 내려 `@ModifiedBoltDamage@`(scaleAP)의 마법 피해를 입힙니다."

`applyBlitzcrankBoltPassive` (`combatLoop.ts:1640-1648`) — combat-start 시 Blitzcrank unit 에 `blitzBoltCooldownSec` / `blitzBoltDamage` star별 set.

`main loop tick` (`combatLoop.ts:5437-5472`) — 매 tick 검사:
```ts
effectiveCooldownTicks = Math.max(1, Math.round(blitzBoltCooldownSec / blitzBoltSpeedMult * TICKS_PER_SECOND));
if (tick - blitzBoltLastFireTick < effectiveCooldownTicks) continue;
// 가장 HP 높은 적 → magic damage = boltDamage × (1 + ap/100)
// mitigation: applyResistance + damageReduction + applyShield + invulnerable 가드
```

### Active — 불청객 (Trespasser)

raw desc: "가장 큰 적 무리에 디스코 볼을 소환한 후, 현재 대상을 디스코 볼로 띄워 올려 `@ModifiedUppercutDamage@`(scaleAP)의 마법 피해를 입힙니다. 해당 적이 디스코 볼과 충돌해 떨어지며 반경 3칸에 `@ModifiedExplosionDamage@`(scaleAP)의 마법 피해를 입힙니다. 적중한 적 하나당 `@GrooveDurationPerTarget@`초 동안 SpaceGroove 상태가 됩니다."

**sim 적용** (`ability.ts:247`):
```ts
TFT17_Blitzcrank: { pattern: 'aoe_circle', radius: 3, stun: 1.5, stunTargets: 1, damageVar: 'ExplosionDamage' }
```

- **aoe_circle r=3 + ExplosionDamage** ✅ — 반경 3칸 폭발 damage (primary target 위치 기준)
- **stun 1.5 + stunTargets 1** ✅ — 디스코 볼 띄움을 1.5초 stun (1명만, primary target) 으로 단순화
- ❌ **UppercutDamage 미반영** — primary target 에 별도 magic damage 가산 누락
- ❌ **GrooveDurationPerTarget 1초 SpaceGroove 상태** — 적중한 적에게 적 SpaceGroove 상태 부여 (디버프 / 마킹) 미반영

### raw ability variables (★1~★3 + sentinel filler)

| 변수 | raw 값 | sim 적용 | 비고 |
|------|--------|---------|------|
| `BoltCooldown` | `[2, 2, 2, 0.5, 1, 1, 1]` ★1=2s, ★2=2s, ★3=0.5s | ✅ `applyBlitzcrankBoltPassive` line 1646 `cooldownArr[u.starLevel]` (sentinel ★0 인덱싱) | ★1/★2 동일 2s, ★3 spike 0.5s |
| `BoltDamage` | `[90, 60, 90, 150, 150, 150, 150]` ★1=60, ★2=90, ★3=150 | ✅ `applyBlitzcrankBoltPassive` line 1647 | sentinel ★0=90 (★1 보다 큰 값) — `?? damageArr[1] ?? 0` fallback 으로 안전 |
| `UppercutDamage` | `[170, 150, 225, 999, 2000, 789, 5000]` ★1=150, ★2=225, ★3=999 | ❌ **미반영** | primary target 별도 magic damage. ability.ts:247 abilityOverride 에 별도 필드 없음 |
| `ExplosionDamage` | `[200, 175, 265, 5000, 5000, 5000, 5000]` ★1=175, ★2=265, ★3=5000 | ✅ `damageVar: 'ExplosionDamage'` (ability.ts:247) → aoe_circle damage 분기에서 raw vars read | ★3 = 5000 대형 spike (5코 5단계) |
| `GrooveDurationPerTarget` | `[1, 1, 1, 1, 1, 1, 1]` (전부 1초) | ❌ **미반영** | 적중한 적에게 SpaceGroove 상태 부여 미구현 |

### 파티광 trait (`TFT17_BlitzcrankUniqueTrait`)

raw desc: "전투당 1회 체력이 `@HealthThreshold*100@%` 아래로 떨어지면 대상으로 지정할 수 없는 상태가 되고 수리를 시작해 매초 최대 체력의 `@PercentHealthHeal*100@%`만큼 체력을 회복합니다. ... 체력이 모두 회복된 경우, 전투가 끝날 때까지 블리츠크랭크가 SpaceGroove 상태가 되며 불청객 기본 지속 효과 번개 발사 속도가 네 배 빨라집니다."

- raw `HealthThreshold` = **0.45** (45%), `PercentHealthHeal` = **0.15** (15%)
- `applyPartyTrickster` (`combatLoop.ts:1651-1663`) — combat-start 시 Blitzcrank 에 `partyHpThreshold` / `partyHealRate` set
- `main loop tick` (`combatLoop.ts:5407-5435`) — 매 tick 검사:
  - Trigger (1회만): `!partyUsed && currentHp / maxHp < partyHpThreshold` → `partyUsed = true` + `partyHealing = true` + `invulnerable` status 추가
  - Heal mode (매 1초): `partyBase = maxHp × partyHealRate`, `heal = partyBase × (1 + healAmp)` → currentHp 회복
  - 종료 (HP 100% 도달): `partyHealing = false` + `invulnerable` 제거 + **`blitzBoltSpeedMult = 4` 설정** (Bolt 발사 속도 ×4)
- ✅ Trigger / invulnerable / 매초 heal / 종료 / **Bolt 속도 ×4** 모두 sim 적용

🔍 **검증 필요 (Lint B3 후보)**: combatLoop.ts:1628 주석 "후속 SpaceGroove + 번개 4배 효과는 미구현" 은 stale — line 5433 에서 Bolt 속도 ×4 적용됨. 단 "후속 SpaceGroove 상태" (Blitzcrank 본인이 SpaceGroove 상태 + ADAP 가산?) 부분은 본 ability `applySpaceGrooveBuffs` 가 이미 그루비안 unit 에 ADAP 가산하므로 trait active 시 자동 적용. 주석만 stale 가능성 — 정확도 위해 후속 PR 에서 주석 정리 권장.

### Trait — 우주 그루브 (SpaceGroove) + 선봉대 (Vanguard)

- **우주 그루브 (`TFT17_SpaceGroove`)** — `applySpaceGrooveBuffs` (`combatLoop.ts:1720-1733`) 그루비안 unit 에 `spaceGrooveAdapPerSec` / `spaceGrooveDurationSec` set. `main loop tick` (`combatLoop.ts:5383-5395`) 매초 그루비안 unit 의 `stats.ap += spaceGrooveAdapPerSec` 가산 (StartOfCombatDuration 동안)
- **선봉대 (`Vanguard`)** — `applyVanguardEffects` (`combatLoop.ts:1911` / `:4664` combat-start 시 호출) — Tank role 보강 보호막 (tick=0)

## sim 적용 상태 — `partial`

✅ **활성**:
- stats 17.3 정합 (hp 1000, armor/MR 50, AD 50, AS 0.9, range 1, mana 20/100)
- `mapGameRole` 결과 Fighter role 룰 적용 (마나 / 타게팅 weight 2 / non-target DR ×0.85)
- **Bolt passive** — `applyBlitzcrankBoltPassive` + main loop tick (`combatLoop.ts:5437-5472`). effectiveCooldown 마다 가장 HP 높은 적에 BoltDamage × (1+AP/100) magic + mitigation 표준 (resistance + DR + shield + invulnerable 가드)
- **파티광 trait** — Trigger / invulnerable / 매초 maxHp × healRate heal / HP 100% 종료 / **Bolt 속도 ×4** 모두 sim 적용 (`combatLoop.ts:5407-5435`)
- **Active cast**: aoe_circle r=3 + stun 1.5 + ExplosionDamage (`ability.ts:247`)
- **우주 그루브 (SpaceGroove)** — `applySpaceGrooveBuffs` (`combatLoop.ts:1720-1733`) + main loop tick (`combatLoop.ts:5383-5395`). 그루비안 unit (Blitzcrank 포함) 매초 ADAP 가산
- **선봉대 (Vanguard)** — `applyVanguardEffects` (`combatLoop.ts:1911`) combat-start 시 호출

❌ **미반영** (Lint 후보):
- **UppercutDamage 미반영** (Lint B1) — primary target 에 별도 magic damage 가산 (★1=150, ★2=225, ★3=999). 현재 sim 은 aoe_circle ExplosionDamage 만 적용. ★3 의 UppercutDamage 999 + ExplosionDamage 5000 합계 sim 손실 ≈ 999 magic damage (primary target 단독 영향)
- **GrooveDurationPerTarget 1초 SpaceGroove 상태** (Lint B2) — 적중한 적에게 적 SpaceGroove 상태 (디버프 / 마킹) 미구현. 적 SpaceGroove 상태의 의미 (debuff 효과) raw 다른 곳 source verify 필요

🔍 **검증 필요**:
- **combatLoop.ts:1628 주석 stale** (Lint B3) — "후속 SpaceGroove + 번개 4배 효과는 미구현" 인데 line 5433 에서 ×4 적용됨. 주석만 stale (코드는 정합) → 후속 PR 에서 주석 정리 권장
- 적 SpaceGroove 상태 의미 — raw `TFT17_SpaceGroove_TheGroove` 가 그루비안 buff 인지 적 debuff 인지 분리 verify 필요 (raw desc 의 "적이 SpaceGroove 상태가 됨" 은 적 debuff 의도일 가능성)

## Lint 신규 등록 후보 (champion ingest 발견)

| # | 항목 | 의미 | Tier | 처리 |
|---|------|------|------|------|
| B1 | UppercutDamage 미반영 — primary target 별도 magic damage 가산 (★1=150 / ★2=225 / ★3=999) | active cast 의 2단계 (디스코 볼 띄움) damage 누락. ★3 = 999 magic damage 1명 영향 | **P1** | 도메인 verify 필요 — 인게임 측정 (UppercutDamage 가 실제 별도 hit 인지, ExplosionDamage 와 합산되는지 확인). ⚠️ sim fix 시 `secondaryDamageVar` 패턴 사용 금지 — `secondaryDamageVar` 는 per-target loop 적용이라 AoE 모든 target 에 over-damage (PR #158 codex P2 catch). primary target 단독 hit 패턴 필요: [[mordekaiser]] `applyMordekaiserProcCast` 식 전용 helper (primary target 1명에만 추가 magic damage cast 시점 1회), 또는 abilityOverride 에 새 `primaryBonusDamageVar` 필드 신설 후 main cast pipeline 의 primary target 분기에서만 read |
| B2 | GrooveDurationPerTarget 1초 적 SpaceGroove 상태 미반영 | 적중한 적에 SpaceGroove 상태 부여 (디버프 또는 마킹) 미구현 | **P2** | raw `TFT17_SpaceGroove_TheGroove` 의 적 debuff 의미 verify 필요. 그루비안 buff 인지 적 debuff 인지 raw json 추가 검색 |
| B3 | combatLoop.ts:1628 주석 stale — "Bolt 4배 미구현" 인데 line 5433 에서 ×4 적용됨 | 주석 vs 코드 모순. 후속 reader 혼동 | **P2** | 후속 PR 에서 주석 정리 (`// PR #65 후속: blitzBoltSpeedMult ×4 적용 완료`). 본 wiki PR scope 밖 (코드 주석 cleanup) |

**Z1 (Zed PR #156) + B1/B2/B3 (Blitzcrank) = 6번째 champion 페이지 누적 base 미반영 lint = Jax L1~L5 (5) + Nasus N1~N4 (4) + Mordekaiser M1 자동 무효 (1) + Zed Z1 P1 (1) + Blitzcrank B1 P1 / B2 P2 / B3 P2 (3) 자기-lint**. 누적 base sim 미반영 **13건 활성 + 1건 자동 무효** (PR #158 codex P3 catch — 합계 정정).

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_Blitzcrank` apiName 확인 (cost 5, traits ['파티광', '우주 그루브', '선봉대'])
- [x] entity-wide grep `Blitzcrank` + `blitzBolt` + `partyTrickster` + `spaceGroove` — 21+ site (helper 3 [Blitzcrank 전용 2 + SpaceGroove 범용 1] + state field 10 + main loop tick 3 + combat-start 4 + ability override 1)
- [x] raw stats 17.3 정합 (`public/data/tft_set17_champions.json` TFT17_Blitzcrank entry)
- [x] **raw role `APFighter` → mapGameRole → sim Fighter** ([[shen]] / [[zed]] 와 동일 family — 3 챔프 누적)
- [x] **carry augment 없음** verify — `carryAugments.ts` 에 TFT17_Blitzcrank entry 없음 + `augments/` 디렉토리에 blitzcrank-carry.md 없음. carry 변환 관련 룰 N/A
- [x] **Cast path 3종** — Blitzcrank 는 base ability 만 (carry override 없음). main + OOR self_buff 아님 (aoe_circle pattern). recast 무관 (PykeCarry 전용)
- [x] helper 3개 multi-source verify — `applyBlitzcrankBoltPassive` + `applyPartyTrickster` + `applySpaceGrooveBuffs` 모두 raw vars 직접 read (entity-specific helper pattern, [[mordekaiser]] applyMordekaiserProcCast 패턴과 동일)
- [x] state field 10개 default 정합 verify — `combatLoop.ts:276-291` (main unit factory) + `:3618-3633` (turret fixture, FreljordTurret 동적 생성) + `:3827-3842` (galio fixture 동적 생성) 3곳 모두 `blitzBoltSpeedMult=1`, 나머지 0 default
- [x] **본문 Lint B1 (P1) 등록 → frontmatter `sim_active: partial` 강등** (룰 #15 적용, [[mordekaiser]] M1 / [[zed]] Z1 패턴)
- [x] **mechanic page sync (룰 #14)** — base champion ingest, neue cast roll 호출처 추가 없음 → `spell-crit.md` / `mana.md` last_verified 갱신 불요
- [x] 파티광 trait 의 `partyUsed` 1회 트리거 가드 verify (`combatLoop.ts:5413`)
- [x] Bolt passive 의 `blitzBoltSpeedMult ×4` (HP 100% 도달 시) sim 적용 verify (`combatLoop.ts:5433`)
- [x] 우주 그루브 (SpaceGroove) trait 의 그루비안 unit ADAP 가산 sim 적용 verify (Blitzcrank traits 에 '우주 그루브' 포함 — 그루비안 unit 자격)
- [ ] (선택) UppercutDamage 인게임 측정 — 별도 hit 인지 ExplosionDamage 합산인지
- [ ] (선택) 적 SpaceGroove 상태 의미 (debuff vs marking) raw verify

## 관련

- [[role-passive]] — Fighter role 마나/타게팅 규칙 (공격당 10, on-hit 0, weight 2, non-target DR ×0.85)
- [[ability-targeting]] — `aoe_circle` 패턴 + cast path 3종
- [[mordekaiser]] — 가장 정합 helper 통합 sim 패턴 (applyMordekaiserProcCast 패턴 차용 — Blitzcrank 도 helper + main loop tick 패턴 동일)
- [[shen]] — 동일 Fighter family (raw `APFighter` → Fighter, passive helper `shenPassiveStack` 패턴)
- [[zed]] — 동일 Fighter family (raw `ADFighter` → Fighter, trait helper `applyZedShadow` 패턴)
- 코드: `src/lib/simulator/systems/ability.ts:247`, `src/lib/simulator/engine/combatLoop.ts:1640/1651/1720/4552/4564/5407/5437`
- Raw: `public/data/tft_set17_champions.json` (TFT17_Blitzcrank), `public/data/tft_set17_traits.json` (TFT17_BlitzcrankUniqueTrait, TFT17_SpaceGroove)
