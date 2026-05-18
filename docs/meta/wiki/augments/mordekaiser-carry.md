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
last_verified: 2026-05-18
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

**⚠️ Multi-source drift** (PR #123 Codex P2 review 발견): LeonaCarry 와 달리 `mordekaiserCarryActive` 플래그/duplicate const 는 없으나, **`applyMordekaiserProcCast` (combatLoop.ts:939) + `tickMordekaiserProc` (line 969) 가 raw `unit.champion.ability.variables` 를 직접 read** → `carryAugments.ts:238` 의 일부 변수 (shield/mana/empoweredDuration 등) 가 실제 sim 에 사용 안 됨. 자세한 분석은 아래 "Lint finding #7" 섹션.

## 변환 후 메커니즘

- **role**: `Fighter` (default, statOverrides 미설정)
- **ability pattern**: `aoe_circle, radius: 1`
- **cast 흐름**:
  1. 시전자 보호막 부여 (shield `[175, 200, 400]` starLevel별, 17.3)
  2. 4초 동안 오라 강화 (`empoweredAuraDamage` × 4초)
- **패시브 (별도 hook 미구현)**:
  - 매초 반경 N칸 magic damage (시작 N=1, 6초마다 +1)
  - sim 미반영 — Mordekaiser passive hook 부재

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
| [[patch-17-3]] (2026-05-13) | shield `[225,250,300]` → **`[175,200,400]`** (1/2성 17.2 원복 + 3성 대폭 buff) / mana `40/100` → **`10/40`** (큰 폭 buff, 매우 빠른 발동). PR #115 (`39cbce2`) sim 정합 |

→ **3성 shield 폭증 + mana 단축** 으로 17.3 에서 3성 Mordekaiser 의 Heat Death 가 강력한 carry 옵션으로 부상 (사용자 패치 의도 추정).

## sim 적용 상태 — `partial`

✅ **활성**:
- role 변환 `Fighter` (default)
- aoe_circle radius 1 cast (`carryAugments.ts:238` abilityOverride 사용 — `getAbilityConfigForUnit:627` findCarryAugment 경로)
- cast `damage` (carryAugments entry 사용, line 659 `damageArr = carryCfg.abilityData.damage`)

❌ **미반영 — Lint finding #7 (위키 검출 7번째 사례, PR #123 Codex P2 review 발견)**:

`applyMordekaiserProcCast` (combatLoop.ts:939) + `tickMordekaiserProc` (line 969) 가 **raw `unit.champion.ability.variables` 직접 read**:

```ts
const vars = unit.champion.ability.variables;
const initialShield = readVarByStar(vars.find(v => v.name === 'InitialShield')?.value, ...);
const duration = readVarByStar(vars.find(v => v.name === 'Duration')?.value, ...);
```

→ `carryAugments.ts:238` 의 다음 변수가 **sim 에 사용 안 됨**:
- `shield` `[175, 200, 400]` (17.3) — raw `InitialShield` vars 가 실제 적용
- `mana` `'10/40'` (17.3) — combatLoop 에서 `carryCfg.abilityData.mana` read 0건 (전체 코드 grep)
- `empoweredDuration: 4` — raw `Duration` vars 가 실제 적용
- `empoweredAuraDamage`, `passiveDamage` — `tickMordekaiserProc` 의 raw `DamagePerProc` / `ShieldPerProc` 사용

**중대 결과**: **PR #115 의 Mordekaiser shield/mana 17.3 정합 코드 변경이 실제 sim 에 반영 안 됨**. PR #116 의 "resolved" 표기 부정확. raw champion variables (`public/data/tft_set17_champions.json` 의 InitialShield/Duration/DamagePerProc/ShieldPerProc) 가 17.3 값을 반영하고 있는지 별도 verify 필요.

**조치 후보 (별도 sim 정확도 PR)**:
- 옵션 A: `applyMordekaiserProcCast` 가 carry augment 활성 시 `carryCfg.abilityData` 우선 read (다른 carry 와 일관성)
- 옵션 B: raw champion variables (InitialShield/Duration 등) 가 17.3 값 반영하도록 `tft_set17_champions.json` 검증/갱신. carryAugments.ts entry 의 shield/mana 필드는 제거 (raw vars 단일 source)

## Lint 체크리스트

- [ ] **Mordekaiser carry shield/mana raw vars 적용 verify** — `tft_set17_champions.json` 의 InitialShield/Duration 이 17.3 값 반영하는지 (별도 sim 클린업 PR — Lint #7)
- [ ] **`carryAugments.ts:238` 의 shield/mana/empoweredDuration 필드 정리** — raw vars 단일 source 이면 entry 에서 제거 권장
- [ ] **PR #115/#116 의 "resolved" 표기 정확화** — patch-17-3.md / hero-augment-carry.md 의 Mordekaiser 표 row 정정 필요
- [ ] Mordekaiser passive 매초 오라 — `tickMordekaiserProc` 가 raw `DamagePerProc` 로 구현되어 있는지 (line 969 컨텍스트 read 시 적용 site 확인 가능)
- [ ] statOverrides 인게임 측정
- [ ] 17.2 LIVE 초기 shield 값 — 17.2 패치노트 명시 없음

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
