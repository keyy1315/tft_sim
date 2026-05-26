---
id: mordekaiser-carry
type: augment
display_name_kr: 뜨거운 죽음 (Heat Death)
api_name: TFT17_Augment_MordekaiserCarry
target_champion: TFT17_Mordekaiser
tier: Gold
stage: 2 only
current_patch_status: active
sim_active: partial   # passive 매초 tick 미구현
last_verified: 2026-05-26 (retro lint subagent — line drift 갱신, frontmatter ↔ 본문 active wording 명확화)
sources:
  - src/data/carryAugments.ts:238 (MordekaiserCarry entry)
  - src/lib/simulator/engine/combatLoop.ts (carry augment 일괄 처리 — duplicate const 없음, carryAugments entry 직접 사용)
  - public/data/tft_set17_augments.json:168
  - 공식 17.2 / 17.3 패치노트
related:
  - "[[hero-augment-carry]]"
  - "[[patch-17-2]]"
  - "[[patch-17-2b]]"
  - "[[patch-17-3]]"
  - "[[leona-carry]]"
---

# 뜨거운 죽음 (MordekaiserCarry, Heat Death)

## 요약

[[patch-17-2]] LIVE 게임 도입 carry augment. Gold tier, Stage 2 only. 활성 시 Mordekaiser (`TFT17_Mordekaiser`) 가 가장 강한 1명 → `Fighter` 변환 + 매초 주변 aoe_circle magic damage 패시브 + 시전 시 보호막 + 강화된 오라 4초. **17.2 → 17.2b → 17.3 3회 연속 변경** ([[leona-carry]] 와 함께 가장 변경 잦은 carry augment).

**✅ Source-of-truth drift 해소 (PR #124, `3678add`, 2026-05-18)**: PR #123 Codex P2 review 가 검출한 `applyMordekaiserProcCast` raw vars 우선 read 이슈를 PR #124 가 Option A 로 해결. 이제 carry augment 활성 시 `carryAugments.ts:238` 의 `shield`/`mana` 값이 sim 에 정확히 반영. 자세한 history 는 아래 "Lint finding #7 (resolved)" 섹션.

## 변환 후 메커니즘

- **role**: `Fighter` (default)
- **ability pattern**: `aoe_circle, radius: 1`
- **statOverrides (PR #124 신규)**: `initialMana: 10, mana: 40` (17.3 patch note 정합) — `applyHeroCarryTransforms` 가 item delta 보존하며 적용 (Tear/Blue Buff 등 mana-altering item bonus 위에 누적)
- **cast 흐름**:
  1. 시전자 보호막 부여 (shield `[175, 200, 400]` starLevel별, 17.3) — `applyMordekaiserProcCast` 가 `unit.mordekaiserCarryShield` 우선 read (PR #124 신규 필드)
  2. 4초 동안 오라 강화 (`empoweredAuraDamage` × 4초)
- **패시브 (별도 hook 미구현)**:
  - 매초 반경 N칸 magic damage (시작 N=1, 6초마다 +1)
  - sim 미반영 — Mordekaiser passive hook 부재 (LIVE 패시브 동작 일부만 `tickMordekaiserProc` 가 구현 — N=1 고정, 6초마다 +1 확장 안 됨)

## 변수 (carryAugments.ts:238 abilityData, 17.3 LIVE 기준)

| 변수 | 값 | 설명 |
|------|-----|------|
| `mana` | **`10/40`** | 시작/최대 마나 (17.3: `40/100` → `10/40` — 매우 빠른 발동) |
| `damage` | `[50, 75, 115]` | starLevel별 cast 시 오라 damage |
| `passiveDamage` | `[20, 30, 45]` | starLevel별 패시브 매초 오라 (sim 미반영) |
| `empoweredAuraDamage` | `[50, 75, 115]` | cast 후 4초간 강화 오라 |
| `empoweredDuration` | `4` (초) | 강화 오라 지속 |
| `shield` | **`[175, 200, 400]`** | starLevel별 시전자 보호막 (17.3: `[225,250,300]` → `[175,200,400]` — 3성 대폭 buff, 1/2성 nerf) |
| `damageType` | `magic` | |

## 패치 히스토리 (3회 연속 변경)

| 패치 | 변경 |
|------|------|
| [[patch-17-2]] LIVE | **게임 도입** — Self-Destruct/Shieldmaiden 과 함께 carry augment 3종 신규. 초기 shield `[175, 200, 250]` (17.2b plan doc "before" 표기) |
| [[patch-17-2b]] (2026-04-29) | shield `[175,200,250]` → **`[225,250,300]`** (전반 buff). mana 변동 없음 추정. carry augment sim 정식화 (CarryAugmentConfig 도입) |
| [[patch-17-3]] (2026-05-13) | shield `[225,250,300]` → **`[175,200,400]`** (1/2성 17.2 원복 + 3성 대폭 buff) / mana `40/100` → **`10/40`** (큰 폭 buff, 매우 빠른 발동). PR #115 (`39cbce2`) carryAugments.ts entry 갱신 |
| 2026-05-18 (PR #124, `3678add`) | **sim 정합 완결** — PR #115 가 carryAugments entry 만 갱신했지만 `applyMordekaiserProcCast` 가 raw vars read 해서 sim 미반영이던 갭 해소. `CombatUnit.mordekaiserCarryShield` 필드 신설 + `applyHeroCarryTransforms` 가 carry abilityData.shield override 저장 + applyMordekaiserProcCast 가 우선 read. mana 도 statOverrides 적용 (item delta 보존). 회귀 가드 2건 추가 (451 → 452 tests). 위키 lint #7 closed |

→ **3성 shield 폭증 + mana 단축** 으로 17.3 에서 3성 Mordekaiser 의 Heat Death 가 강력한 carry 옵션으로 부상 (사용자 패치 의도 추정).

## sim 적용 상태 — core fact `active` (17.3 정합 완결) + edge passive `partial`

✅ **활성**:
- role 변환 `Fighter` (default)
- aoe_circle radius 1 cast (`carryAugments.ts:238` abilityOverride — `getAbilityConfigForUnit:627` findCarryAugment 경로)
- cast `damage` (carryAugments entry 사용)
- **shield `[175, 200, 400]` 17.3 sim 정합 (PR #124)** — `CombatUnit.mordekaiserCarryShield` 필드 + `applyHeroCarryTransforms` 가 carry abilityData.shield override 저장 → `applyMordekaiserProcCast` 가 raw `InitialShield` 대신 우선 read
- **mana `10/40` 17.3 sim 정합 (PR #124)** — `statOverrides: { initialMana: 10, mana: 40 }` + `applyHeroCarryTransforms` 가 base champion mana 와 delta 보존 (item bonus 보존, PR #124 Codex P2 catch 반영)

🔍 **미반영 / 검증 필요**:
- Mordekaiser passive 매초 오라 (시작 N=1, 6초마다 +1) — `tickMordekaiserProc` 는 raw `DamagePerProc`/`ShieldPerProc` 사용. **반경 N 확장 (6초마다 +1)** 분기 미구현. 별도 sim 작업 필요
- `empoweredAuraDamage` 4초 강화 — raw `Duration` vars 와 통합 검증 필요
- statOverrides 인게임 측정 — Mordekaiser augment 활성 시 다른 stat (HP/armor/range 등) 변화 (사용자 측정 대기)

## ✅ Lint finding #7 — RESOLVED (PR #124, `3678add`, 2026-05-18)

### 검출 (PR #123 Codex P2 review)
`applyMordekaiserProcCast` (combatLoop.ts:953) + `tickMordekaiserProc` (line 990) 가 raw `unit.champion.ability.variables` 직접 read:
```ts
const vars = unit.champion.ability.variables;
const initialShield = readVarByStar(vars.find(v => v.name === 'InitialShield')?.value, ...);
```

→ `carryAugments.ts:238` 의 shield `[175,200,400]` (17.3) / mana `'10/40'` / empoweredDuration 모두 sim 에 사용 안 됨. **PR #115 의 17.3 정합 코드 변경이 sim 미반영**.

### Fix (PR #124, Option A 선택)
1. `CombatUnit.mordekaiserCarryShield: readonly number[] | null` 필드 신규
2. `applyHeroCarryTransforms` (combatLoop.ts:2252): MordekaiserCarry case → `target.mordekaiserCarryShield = cfg.abilityData?.shield ?? null`
3. `applyMordekaiserProcCast` (line 962): `unit.mordekaiserCarryShield != null ? carryShield : rawInitialShield`
4. `MordekaiserCarry.statOverrides` 추가 (`initialMana: 10, mana: 40`)
5. `applyHeroCarryTransforms` mana 적용에 **item delta 보존** 추가 (PR #124 Codex P2 catch — `target.maxMana = so.mana + itemDelta`)

→ 17.3 patch note Heat Death shield/mana 가 sim 에 정확히 반영. mana-altering item (Tear/Blue Buff 등) 보존.

### 회귀 가드 (PR #124)
- `MordekaiserCarry statOverrides: 17.3 mana 10/40` (mana 정합 검증)
- `MordekaiserCarry abilityData.shield + override 분기` (code fingerprint)
- `applyHeroCarryTransforms mana override 는 item delta 보존` (Codex P2 회귀 가드)

## Lint 체크리스트

- [x] **Mordekaiser carry shield/mana sim 정합** — PR #124 (`3678add`) 머지 완료. carry abilityData 우선 read + statOverrides item delta 보존
- [ ] Mordekaiser passive 매초 오라 — `tickMordekaiserProc` 의 반경 N 확장 (6초마다 +1) 미구현
- [ ] `empoweredAuraDamage` × `empoweredDuration` (4초) sim 적용 site verify
- [ ] statOverrides (HP/armor/range 등) 인게임 측정 — 사용자 측정 대기
- [ ] 17.2 LIVE 초기 shield 값 — 17.2 패치노트 명시 없음 (역사적 기록만)

## 17.2 ↔ 17.3 비교 (역사적 흥미)

shield 변경 궤적:
- 17.2: `[175, 200, 250]` (게임 도입)
- 17.2b: `[225, 250, 300]` (전반 buff)
- **17.3: `[175, 200, 400]`** (1/2성 17.2 원복, 3성만 대폭 buff)

→ Riot 의 balance 의도 추정:
- 17.2b 까지: 모든 starLevel 강화 (carry augment 도입 후 사용률 낮음 → 활성화 의도)
- 17.3: 1/2성 nerf (사용률 과대 → 진입 장벽 강화) + 3성 buff (고난도 보상)

## 관련

- [[hero-augment-carry]] — carry augment 시스템 전체
- [[leona-carry]] — 같은 17.2 도입 carry augment 3종 중 하나
- [[patch-17-2]] / [[patch-17-2b]] / [[patch-17-3]] — 변경 시점
- 코드: `src/data/carryAugments.ts:238`, `tft_set17_augments.json:168`
