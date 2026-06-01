---
id: stargazer-fountain
type: mechanic
api_name: TFT17_Stargazer_Fountain
display_name_kr: 별돌보미 우물
parent_entity: "[[stargazer]]"
current_patch_status: active (17.4 LIVE, ADAP sim 통합 — C-5e PR)
sim_active: true (partial — StackingADAP ✅ / periodic heal ⏸️ C-5a 대기)
last_verified: 2026-06-01 (17.4 sequence C-5e — Fountain_StackingADAP 매핑 풀림 + (5) tier 7→9 너프 적용)
sources:
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-4/ (공식 17.4 패치노트)
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-3/ (공식 17.3 패치노트)
  - docs/wiki/raw/lolchess/set17-stargazer-constellations.md
  - public/data/tft_set17_traits.json
  - src/lib/simulator/engine/combatLoop.ts (applyStargazerEffects, triggerFountainHeal, fountain tick periodic)
related:
  - "[[stargazer]]"
  - "[[patch-17-3]]"
  - "[[patch-17-4]]"
---

# Stargazer Fountain (별돌보미 우물)

## 요약

별돌보미 7별자리 중 하나. 강화된 칸의 아군에게 **마나 재생**, 강화 칸의 별돌보미에게는 **추가 마나 재생 + 스킬 시전 시 회복** 효과. **17.3 LIVE 에서 재활성화** — 이전 패치(17.2 LIVE/17.2b)에서는 Riot 효과 미확정으로 sim 에서 no-op 였다.

## 현재 메커니즘 (17.4 LIVE)

| 대상 | 효과 | 변수 |
|------|------|------|
| 강화 칸 아군 (전체) | `augmentManaRegen += 1.0/s` | `Fountain_ManaRegen_Teamwide` |
| 강화 칸 **별돌보미** | 추가 `augmentManaRegen += 1.0~5.0/s` | `Fountain_ManaRegen` (tier별) |
| 강화 칸 별돌보미 cast | 가장 낮은 체력 아군 회복 `totalAbilityDmg × 18~25%` | `Fountain_HealPercent` (tier별) |
| 강화 칸 **별돌보미** | **`Fountain_Interval` (2초) 마다 누적 AD/AP** | `Fountain_StackingADAP` (raw `{13a2a786}`) — 17.4 sim 통합 (C-5e) |

Tier별 변수 (TFT17_Stargazer_Fountain):
- **(3) tier**: heal 18%, mana 1.0, StackingADAP 4%
- **(5) tier**: heal 25%, mana 5.0, **StackingADAP 9%** (17.4 너프 7→9 ✅)

## 시뮬 적용

### 데이터
- `public/data/tft_set17_traits.json` — `TFT17_Stargazer_Fountain` entry 의 effects 에 정식 이름 변수 노출 (PR `bfa7794`)

### 엔진
- `src/lib/simulator/engine/combatLoop.ts:applyStargazerEffects` — `apiName === 'TFT17_Stargazer_Fountain'` 분기에서:
  - 강화 칸 아군 → `augmentManaRegen += teamwideMana`
  - 강화 칸 별돌보미 → `augmentManaRegen += ownerMana` (추가)
  - 별돌보미에 `stargazerFountainHealPercent = healPct` 부여
  - 별돌보미에 `fountainStackingAdapPerTick = stackingAdapPct/100` 부여 (raw `{13a2a786}` percent → fraction) — **17.4 sim 통합 (C-5e)**
- `src/lib/simulator/engine/combatLoop.ts:triggerFountainHeal` — cast pipeline 에서 호출:
  - `stargazerFountainHealPercent > 0` 이고 즉발 dmg > 0 일 때
  - `healAmount = totalAbilityDmg × healPct × healAmp` (lowest HP ally 에 적용)
  - OOR(dash/self_buff) cast path 에도 적용 (codex P1 review `6eea7b7`)
- `src/lib/simulator/engine/combatLoop.ts:5333-5363` — main loop fountain tick (매 `Fountain_Interval` × `TICKS_PER_SECOND` ticks 마다):
  - `fountainStackingAdapPerTick > 0` 인 unit 에 누적 ADAP 적용: `damage *= (1+fraction)`, `ap += fraction*100`
  - `fountainHealPctPerTick > 0` 인 unit healing (현재 0 유지 — C-5a 대기)

### 테스트 가드
- `tests/unit/simulator/stargazer-fountain-1703-active.test.ts` (PR #109, 7 케이스) — data-only → active 검증. C-5e (본 PR) 에서 `PR sequence C-5e — Stacking ADAP 활성화` it 갱신: StackingADAP 0.04 set + HealPctPerTick 0 유지 검증
- `tests/unit/simulator/stargazer-variants-effects.test.ts` — Fountain 변종 describe (`describe.skip` 해제) — ManaRegen + StackingADAP (5) tier 0.09 + 누적 damage/ap 회귀
- `tests/.../17-2-fountain-inactive.test.ts` (legacy) — 17.2 시점 no-op 검증

## 패치 히스토리

| 패치 | 상태 | 변경 |
|------|------|------|
| 17.2 PBE | data-only | hash 변수로 추출 (`F1` `ebf3fcf`). PBE 의 매초 효과 (`fountainHealPctPerTick` / `fountainStackingAdapPerTick`) 시도 |
| 17.2 LIVE ([[patch-17-2]]) | **inactive** | Fountain 17.2 LIVE no-op 확정 (`059547c`). 공식 패치노트: "Fountain pattern temporarily disabled". PBE 매초 효과는 LIVE 에서 빠짐 |
| 17.2b ([[patch-17-2b]]) | inactive | 비활성 표기 유지 (`08b5615`) |
| 17.3 LIVE (2026-05-13) | **active** | CDragon Latest 5/9 부터 hash → 정식 이름 변수. lolchess.gg 17.3 패치노트 "별돌보미 우물 강화된 칸 효과 완전 재설계" 명시. sim 재활성화 (PR #109) |
| 17.4 LIVE (2026-05-27, [[patch-17-4]]) | **partial active** | (5) tier StackingADAP `7% → 9%` 너프. **C-5e (본 PR)** — raw `{13a2a786}` 가 desc `@Fountain_StackingADAP@` 와 매핑됨을 확인 + `fountainStackingAdapPerTick` state field sim 통합. periodic heal (1%/2.5% per 2s) 은 여전히 sim 미반영 (C-5a 대기) |

## 17.2 vs 17.3+ — periodic tick 메커니즘은 부분 채택

17.2 PBE 시점에 추출했던 두 매초 효과 (`fountainHealPctPerTick`, `fountainStackingAdapPerTick`) 중:
- **`fountainStackingAdapPerTick`** — 17.3 LIVE 부터 lolchess.gg "4%/7%" 명시. **17.4 sim 통합 완료** (C-5e 본 PR). raw `{13a2a786}` (percent points) ÷ 100 으로 fraction 변환 후 set. main loop tick (5357-5361) 이 매 `Fountain_Interval` (2초) 마다 누적 적용 (`damage *= (1+f)`, `ap += f*100`)
- **`fountainHealPctPerTick`** — periodic heal (1%/2.5% per 2s) 메커니즘. raw `{f2840aed}` / `{d7e6d620}` 매핑 추정. sim 미반영 — **C-5a 별도 PR 대기**

## (3)/(5) AD/AP — sim 매핑 풀림 + 17.4 너프 적용

raw `{13a2a786}` = `Fountain_StackingADAP` 매핑이 17.4 패치 시점에 확인됨 (desc `@Fountain_StackingADAP@` 와 1:1 매핑 + 값 일치):
- **(3) Fountain**: AD/AP +4% per 2s (17.3 부터 / 17.4 동일)
- **(5) Fountain**: AD/AP **+9%** per 2s (**17.4 너프 7 → 9**)

추가 메커니즘 (공식 패치노트, 17.4):
- 강화 칸 **아군**: max HP **1%** heal / 2초 (raw `{d7e6d620}` 추정)
- 강화 칸 **별돌보미**: 추가 **3% (17.4 너프 2.5→3)** heal / 2초 (raw `{f2840aed}` 추정)

→ ADAP 매핑 해소 ✅. periodic heal 매핑은 C-5a 대기.

## 보류 / 미반영

- ~~AD/AP 4%/7% 효과의 CDragon 변수명 미발견~~ **해소 (C-5e)** — raw `{13a2a786}` = `Fountain_StackingADAP` 확정
- 강화 칸 아군 max HP 1% heal / 2초 + 별돌보미 추가 3% (17.4) heal / 2초 — sim 미반영 (**C-5a 별도 PR**)
- 별돌보미 여사냥꾼 보드 좌상단 hex 추가 — 17.3 공식 확정 ([[patch-17-3]] Stargazer 섹션). 별도 보드 데이터 작업 필요

## Lint 체크리스트

- [x] 17.4 패치 머지 — (5) StackingADAP 7→9 너프 raw json 적용 + sim 매핑 풀림 (C-5e ✅)
- [x] AD/AP 4%/9% sim 변수 매핑 — raw `{13a2a786}` = `Fountain_StackingADAP` 확정 (C-5e ✅)
- [ ] periodic heal (1%/3% per 2s) sim 적용 — C-5a 별도 PR
- [ ] memory `stargazer_fountain_inactive.md` 의 description — 17.3 active → 17.4 partial active 갱신 필요

## 관련

- [[stargazer]] — 부모 trait
- [[patch-17-3]] — 재활성화 패치
- [[patch-17-4]] — StackingADAP (5) 너프 + sim 매핑 풀림 (C-5e)
- PR #109 — sim 활성화 머지
- PR sequence C-5e (본 PR) — StackingADAP sim 통합
- 메모리: `stargazer_fountain_inactive.md` (이름은 legacy, 내용은 17.4 partial active)
