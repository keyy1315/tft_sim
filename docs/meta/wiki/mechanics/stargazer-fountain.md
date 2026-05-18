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
  - docs/meta/wiki/raw/lolchess/set17-stargazer-constellations.md
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
| 17.2 LIVE | **inactive** | Fountain 17.2 LIVE no-op 확정 (`059547c`). PBE 매초 효과는 LIVE 에서 빠짐 |
| 17.2b | inactive | 비활성 표기 유지 (`08b5615`) |
| 17.3 LIVE (2026-05-13) | **active** | CDragon Latest 5/9 부터 hash → 정식 이름 변수. lolchess.gg 17.3 패치노트 "별돌보미 우물 강화된 칸 효과 완전 재설계" 명시. sim 재활성화 (PR #109) |

## 17.2 vs 17.3 — 메커니즘 자체가 다름

17.2 PBE 의 **매초 tick** 모델 (`fountainHealPctPerTick`, `fountainStackingAdapPerTick`) 은 17.3 LIVE 에 채택되지 않았다. 17.3 는 **mana regen + cast-on heal** 모델로 재설계. → legacy tick 코드 (`5263~` 라인 부근) 는 보존되어 있지만 `applyStargazerEffects` 가 해당 변수를 0 으로 둬서 dead path.

## 보류 / 미반영

- lolchess.gg 17.3 의 **"(3) AD/AP 4%, (5) AD/AP 7%"** — CDragon Latest 데이터에 노출 안 됨. 별도 변수 미발견 (실제 sim 영향은 미확정)
- 별돌보미 여사냥꾼 보드 7,0 강화칸 추가 — 별도 보드 데이터 작업 필요

## Lint 체크리스트

- [ ] 다음 패치(17.4 등) 머지 시: Fountain 변수명/값 변경 여부 재확인
- [ ] AD/AP 4%/7% 효과: CDragon 갱신/툴팁 확인 시 미반영 항목 해소
- [ ] memory `stargazer_fountain_inactive.md` 의 description — 현재 17.3 active 로 갱신되어 있음 (2026-05-13 확인) ✓

## 관련

- [[stargazer]] — 부모 trait
- [[patch-17-3]] — 재활성화 패치
- PR #109 — sim 활성화 머지
- 메모리: `stargazer_fountain_inactive.md` (이름은 legacy, 내용은 17.3 active)
