---
id: aatrox-carry
type: augment
display_name_kr: 별빛 연계 (Stellar Combo)
api_name: TFT17_Augment_AatroxCarry
target_champion: TFT17_Aatrox
tier: Gold
stage: 2 only
current_patch_status: active
sim_active: active
last_verified: 2026-05-18
sources:
  - src/data/carryAugments.ts:129 (AatroxCarry entry)
  - src/lib/simulator/engine/combatLoop.ts:6173 (cycleIdx % 3 분기)
  - src/lib/simulator/engine/combatLoop.ts:6195 (slamDamage cycle 2)
  - src/lib/simulator/engine/combatLoop.ts:6713-6727 (novaDamage 추가 발동)
  - src/lib/simulator/engine/combatLoop.ts:1306 (singleTargetMultiplier 적용)
  - src/lib/simulator/engine/combatLoop.ts:4553-4593 (aatroxNovaStrikeSelector setup)
  - 공식 17.2 / 17.3 패치노트
related:
  - "[[hero-augment-carry]]"
  - "[[patch-17-2]]"
  - "[[patch-17-2b]]"
  - "[[patch-17-3]]"
  - "[[ability-targeting]]"
---

# 별빛 연계 (AatroxCarry, Stellar Combo)

## 요약

[[patch-17-2]] LIVE 게임 도입 carry augment. Gold tier, Stage 2 only. 활성 시 Aatrox (`TFT17_Aatrox`) 가 가장 강한 1명 → `Fighter` 변환 + **3-skill cycle** (타격 → 휩쓸기 → 찍기 반복) + N.O.V.A. (5 시너지) 추가 발동.

**가장 복잡한 carry augment** — cycle counter 분기 + N.O.V.A. 별도 추가 발동 + isolation multiplier (단독 적중 ×N) 3 메커니즘이 main cast pipeline 에 inline 구현.

## 변환 후 메커니즘

- **role**: `Fighter` (default)
- **3-skill cycle** (`combatLoop.ts:6173-` `cycleIdx = aatroxCycleCounter % 3`):
  - **cycle 0 (타격)**: pattern `cone, radius: 1`, `damage` (primary), AD physical
  - **cycle 1 (휩쓸기)**: 같은 cone radius 1, `secondaryDamage` + armor 감소 10 (debuff)
  - **cycle 2 (찍기)**: same cone radius 1 → 동작 → `slamDamage` + `slamStunDuration 1.0초` knockup
  - **isolation**: 찍기 (cycle 2) 단독 적중 시 `singleTargetMultiplier` ×배율
- **N.O.V.A. 추가 발동** (5 시너지 active + `aatroxNovaStrikeSelector = true`):
  - cycle damage 그대로 적용 후 **별도** 모든 적 `novaDamage` 물리 + 1초 공중 띄움
  - "타격 선택기" UI 가 NOVA unit 1명 지정 (`combatLoop.ts:4553-4593` `setupAatroxNovaStrikeSelector`)
  - 사용자 spec: 동일 cast 1회에 cycle damage + nova damage 둘 다 발생
- **사망/부활**: `aatroxPreviouslyDead` 검사 — resurrect 시 cycle counter 0 reset

## 변수 (carryAugments.ts:129 abilityData, 17.3 LIVE 기준)

| 변수 | 값 | 설명 / sim apply site |
|------|-----|----------------------|
| `mana` | `30/90` | 시작/최대 마나 |
| `damage` | `[140, 210, 315]` | 타격 (cycle 0) AD primary — main pipeline (carryCfg.abilityData.damage) |
| `secondaryDamage` | **`[110, 165, 275]`** | 휩쓸기 (cycle 1) AD — 17.3: [100,150,225] → [110,165,275] (PR #115 sim 정합) |
| `slamDamage` | **`[200, 300, 475]`** | 찍기 (cycle 2) AD — 17.3: [160,240,360] → [200,300,475] (`combatLoop.ts:6195`) |
| `slamStunDuration` | `1.0` (초) | 찍기 공중 띄움 (knockup → stun) |
| `armorReduction` | `10` | 휩쓸기 (cycle 1) armor 감소 (AP 스케일 debuff) |
| `novaDamage` | `[120, 180, 270]` | N.O.V.A. 타격 — `combatLoop.ts:6724` (5 시너지 active + selector flag) |
| `singleTargetMultiplier` | **`2.0`** | 찍기 단독 적중 시 ×배 — 17.3: 2.5 → 2.0 (PR #115 sim 정합, `combatLoop.ts:1306`) |
| `damageType` | `physical` | |
| `skillCycleLabels` | `['타격', '휩쓸기', '찍기']` | UI 표시용 |

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| [[patch-17-2]] LIVE | **게임 도입** — Carry augment 도입 cycle 시작 |
| [[patch-17-2b]] (2026-04-29) | PR7-C: `slamDamage` + `slamStunDuration` (cycle 2 찍기) 추가. N.O.V.A. 후속에서 `novaDamage` 추가 |
| [[patch-17-3]] (2026-05-13) | **3건 nerf/buff** (PR #115 sim 정합): secondaryDamage `[100,150,225]→[110,165,275]` (buff), slamDamage `[160,240,360]→[200,300,475]` (buff), singleTargetMultiplier `2.5 → 2.0` (isolation nerf) |

## sim 적용 상태 — `active`

✅ **활성** (entity-wide grep + cast path 전수 + actual integration 모두 verify):
- 3-skill cycle 분기 (`cycleIdx % 3`) — main cast pipeline `combatLoop.ts:6173`
- cycle별 dynamic config 변경 (cone → cone → cone 동일이지만 cycle 1 휩쓸기 debuff / cycle 2 찍기 slamDamage 등 별도 처리)
- N.O.V.A. 추가 발동 (`combatLoop.ts:6713-6727`) — 5 시너지 + aatroxNovaStrikeSelector + alive 가드. `novaArr[unit.starLevel-1] ?? novaArr[0]` starLevel별 적용
- singleTargetMultiplier (`combatLoop.ts:1306`) — `aliveTargetCount === 1 && context.aatroxIsSingleTargetSlam` 분기에서 baseDmg × multiplier
- 사망/부활 시 cycle counter reset (`aatroxPreviouslyDead`)
- 17.3 변경분 (secondary/slam/isolation) 정확 반영 (PR #115)

🔍 **검증 / 미완**:
- novaDamage / slamDamage / singleTargetMultiplier 의 starLevel별 적용 — main pipeline 정합 (5단계 워크플로우 verify 통과). recast cascade 가 발생하는 carry 가 아니므로 cast path 3종 중 main 만 진입 (Pyke 와 달리 onKill recast 없음 → 단일 cast path 정합)
- statOverrides 인게임 측정 — Aatrox augment 활성 시 HP/AS/range 변화

## Cast path 전수 확인 (5단계 워크플로우)

| Cast path | Aatrox cycle 진입? | sim 정합 |
|-----------|:-----------------:|:--------:|
| Main pipeline (line ~6170) | ✅ cycleIdx % 3 분기 | ✓ |
| Recast (onKill) (line 6544) | ❌ (PykeCarry 전용 onKillRecastMultiplier 분기) | — |
| OOR fallback (line ~7000) | ⚠️ 별도 verify 필요 — cycle 분기 OOR 에도 있는지? |

**🔍 후속 verify**: OOR (out-of-range dash) cast path 에서 Aatrox cycle 분기 일관 적용되는지. PR #129 의 OOR stun 누락 같은 패턴 가능성 — main pipeline 의 cycle 분기가 OOR cast 에도 적용되는지 별도 grep 필요. **Lint 후보로 등록** (확정 검출 아님, follow-up verify).

## Lint 체크리스트

- [x] entity-wide grep `Aatrox` — multi-source drift 없음 확인. `combatLoop.ts` 의 cycle 분기 + N.O.V.A. setup + sim apply 모두 main pipeline 내부 inline
- [ ] OOR cast path 의 cycle 분기 일관성 verify — PR #129 의 stun 같은 패턴 가능성
- [ ] cycle counter sim correctness — `aatroxPreviouslyDead` resurrect reset 회귀 가드
- [ ] N.O.V.A. selector UI 와 sim 의 정합 — playerNovaStrikeSelectorUnit / enemyNovaStrikeSelectorUnit SimulateOptions
- [ ] statOverrides 인게임 측정

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[ability-targeting]] — `cone` 패턴 알고리즘
- [[patch-17-2]] / [[patch-17-2b]] / [[patch-17-3]] — 변경 시점
- 코드: `src/data/carryAugments.ts:129`, `src/lib/simulator/engine/combatLoop.ts:6173/6195/6724/1306/4553`
