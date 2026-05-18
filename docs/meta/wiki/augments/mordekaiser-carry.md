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

LeonaCarry 와 달리 `mordekaiserCarryActive` 플래그 + duplicate const 없음 — `carryAugments.ts:238` entry 가 단일 source. Lint duplicate finding **해당 없음**.

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
- aoe_circle radius 1 cast
- cast damage + shield + duration
- 17.3 변경분 (shield/mana) 정합 ([[patch-17-3]] cleanup PR #116 + sim PR #115)

❌ **미반영**:
- **passive 매초 오라 (시작 N=1, 6초마다 +1)** — Mordekaiser 패시브 hook 부재. damage tick 분기 + 반경 확장 로직 미구현
- `empoweredAuraDamage` 4초 강화 — 현재 cast 후 별도 4초 dot 분기 없음 (`empoweredDuration` 변수 정의되어 있으나 적용 site 미확인). 별도 verify 필요
- statOverrides 미설정

## Lint 체크리스트

- [ ] **Mordekaiser passive 매초 오라 sim 구현** — Mordekaiser 패시브 hook 추가 (별도 sim 정확도 PR)
- [ ] `empoweredAuraDamage` × `empoweredDuration` (4초) sim 적용 site verify — combatLoop 에서 어떻게 처리되는지 (`dot.duration` 메커니즘과 통합 가능?)
- [ ] statOverrides 인게임 측정 — Mordekaiser augment 활성 vs 비활성 stat 차이
- [ ] 17.2 LIVE 초기 shield `[175,200,250]` 값 — 17.2 패치노트 명시 없음, 17.2b plan doc "before" 표기로 역추정

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
