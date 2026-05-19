---
id: stargazer-fountain
type: mechanic
api_name: TFT17_Stargazer_Fountain
display_name_kr: 별돌보미 우물
parent_entity: "[[stargazer]]"
current_patch_status: active
sim_active: true
last_verified: 2026-05-18
sources:
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-3/ (공식 17.3 패치노트)
  - docs/wiki/raw/lolchess/set17-stargazer-constellations.md
  - public/data/tft_set17_traits.json
  - src/lib/simulator/engine/combatLoop.ts (applyStargazerEffects, triggerFountainHeal)
related:
  - "[[stargazer]]"
  - "[[patch-17-3]]"
---

# Stargazer Fountain (별돌보미 우물)

## 요약

별돌보미 7별자리 중 하나. 강화된 칸의 아군에게 **마나 재생**, 강화 칸의 별돌보미에게는 **추가 마나 재생 + 스킬 시전 시 회복** 효과. **17.3 LIVE 에서 재활성화** — 이전 패치(17.2 LIVE/17.2b)에서는 Riot 효과 미확정으로 sim 에서 no-op 였다.

## 현재 메커니즘 (17.3 LIVE)

| 대상 | 효과 | 변수 |
|------|------|------|
| 강화 칸 아군 (전체) | `augmentManaRegen += 1.0/s` | `Fountain_ManaRegen_Teamwide` |
| 강화 칸 **별돌보미** | 추가 `augmentManaRegen += 3.0~5.0/s` | `Fountain_ManaRegen` (tier별) |
| 강화 칸 별돌보미 cast | 가장 낮은 체력 아군 회복 `totalAbilityDmg × 18~25%` | `Fountain_HealPercent` (tier별) |

Tier별 (lolchess.gg 17.3):
- (3): heal 18%, mana 3.0
- (5): heal 25%, mana 4.0

## 시뮬 적용

### 데이터
- `public/data/tft_set17_traits.json` — `TFT17_Stargazer_Fountain` entry 의 effects 에 정식 이름 변수 노출 (PR `bfa7794`)

### 엔진
- `src/lib/simulator/engine/combatLoop.ts:applyStargazerEffects` — `apiName === 'TFT17_Stargazer_Fountain'` 분기에서:
  - 강화 칸 아군 → `augmentManaRegen += teamwideMana`
  - 강화 칸 별돌보미 → `augmentManaRegen += ownerMana` (추가)
  - 별돌보미에 `stargazerFountainHealPercent = healPct` 부여
- `src/lib/simulator/engine/combatLoop.ts:triggerFountainHeal` — cast pipeline 에서 호출:
  - `stargazerFountainHealPercent > 0` 이고 즉발 dmg > 0 일 때
  - `healAmount = totalAbilityDmg × healPct × healAmp` (lowest HP ally 에 적용)
  - OOR(dash/self_buff) cast path 에도 적용 (codex P1 review `6eea7b7`)

### 테스트 가드
- `tests/unit/simulator/stargazer-fountain-1703-active.test.ts` (PR #109, 7 케이스) — data-only → active 검증
- `tests/.../17-2-fountain-inactive.test.ts` (legacy) — 17.2 시점 no-op 검증

## 패치 히스토리

| 패치 | 상태 | 변경 |
|------|------|------|
| 17.2 PBE | data-only | hash 변수로 추출 (`F1` `ebf3fcf`). PBE 의 매초 효과 (`fountainHealPctPerTick` / `fountainStackingAdapPerTick`) 시도 |
| 17.2 LIVE ([[patch-17-2]]) | **inactive** | Fountain 17.2 LIVE no-op 확정 (`059547c`). 공식 패치노트: "Fountain pattern temporarily disabled". PBE 매초 효과는 LIVE 에서 빠짐 |
| 17.2b ([[patch-17-2b]]) | inactive | 비활성 표기 유지 (`08b5615`) |
| 17.3 LIVE (2026-05-13) | **active** | CDragon Latest 5/9 부터 hash → 정식 이름 변수. lolchess.gg 17.3 패치노트 "별돌보미 우물 강화된 칸 효과 완전 재설계" 명시. sim 재활성화 (PR #109) |

## 17.2 vs 17.3 — 메커니즘 자체가 다름

17.2 PBE 의 **매초 tick** 모델 (`fountainHealPctPerTick`, `fountainStackingAdapPerTick`) 은 17.3 LIVE 에 채택되지 않았다. 17.3 는 **mana regen + cast-on heal** 모델로 재설계. → legacy tick 코드 (`5263~` 라인 부근) 는 보존되어 있지만 `applyStargazerEffects` 가 해당 변수를 0 으로 둬서 dead path.

## (3)/(5) AD/AP 4%/7% — 공식 확정 (17.3 패치노트, 2026-05-18 update)

17.3 공식 패치노트가 정상화되며 lolchess.gg 에 있던 표기가 Riot 공식으로 확정:
- **(3) Fountain: AD/AP +4%**
- **(5) Fountain: AD/AP +7%**

추가 메커니즘 (공식 패치노트):
- 강화 칸 **아군**: max HP **1%** heal / 2초
- 강화 칸 **별돌보미**: 추가 **2.5%** heal + **AD/AP 누적 스택** / 2초

→ 이전 "보류 / 미반영" 항목 (lolchess.gg 표기 vs CDragon 미노출) **해소**.

## 보류 / 미반영

- AD/AP 4%/7% 효과의 **CDragon 변수명 미발견** — 공식 수치는 확정됐으나 코드 적용 시 어떤 변수로 노출되는지 별도 검증 필요. trait effect override 또는 새 변수 추가 가능성
- 강화 칸 아군 max HP 1% heal / 2초 + 별돌보미 추가 2.5% heal / 2초 — 현재 sim 의 cast-on-heal (`Fountain_HealPercent`) 외에 **별도 periodic heal** 분기 미구현 가능성. 코드 verify 필요
- 별돌보미 여사냥꾼 보드 좌상단 hex 추가 — 17.3 공식 확정 ([[patch-17-3]] Stargazer 섹션). 별도 보드 데이터 작업 필요

## Lint 체크리스트

- [ ] 다음 패치(17.4 등) 머지 시: Fountain 변수명/값 변경 여부 재확인
- [x] AD/AP 4%/7% 공식 수치 확정 (2026-05-18) — sim 변수 매핑 별도 검증 작업 남음
- [ ] periodic heal (1%/2.5% per 2s) sim 적용 검증 — `applyStargazerEffects` 또는 별도 tick 분기 확인
- [ ] memory `stargazer_fountain_inactive.md` 의 description — 현재 17.3 active 로 갱신되어 있음 (2026-05-13 확인) ✓

## 관련

- [[stargazer]] — 부모 trait
- [[patch-17-3]] — 재활성화 패치
- PR #109 — sim 활성화 머지
- 메모리: `stargazer_fountain_inactive.md` (이름은 legacy, 내용은 17.3 active)
