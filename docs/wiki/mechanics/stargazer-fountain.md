---
id: stargazer-fountain
type: mechanic
api_name: TFT17_Stargazer_Fountain
display_name_kr: 별돌보미 우물
parent_entity: "[[stargazer]]"
current_patch_status: active (17.4 LIVE, sequence C-5 완전 통합)
sim_active: true (StackingADAP ✅ + periodic heal ✅ + cast-on-heal ✅ + ManaRegen ✅)
last_verified: 2026-06-01 (17.4 sequence C-5a — Fountain periodic heal 매핑 풀림 + (별돌보미 추가) 2.5→3% 너프 적용 + sim 통합. sequence C-5 완료)
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
| 강화 칸 **별돌보미** | `Fountain_Interval` (2초) 마다 누적 AD/AP | `Fountain_StackingADAP` (raw `{13a2a786}`) — sim 통합 (C-5e) |
| 강화 칸 아군 (전체) | **`Fountain_Interval` (2초) 마다 max HP × 1% heal** | raw `{d7e6d620}` — 17.4 sim 통합 (C-5a) |
| 강화 칸 **별돌보미** | **추가 max HP × 3% heal (17.4 너프 2.5→3) / 2초** | raw `{f2840aed}` — 17.4 sim 통합 (C-5a) |

Tier별 변수 (TFT17_Stargazer_Fountain) — (3)/(5) tier 의 periodic heal raw 값 동일:
- **(3) tier**: cast heal 18%, mana 1.0, StackingADAP 4%, teamwide heal 1%, 별돌보미 추가 heal 3% (17.4)
- **(5) tier**: cast heal 25%, mana 5.0, **StackingADAP 9% (17.4 너프 7→9)**, teamwide heal 1%, 별돌보미 추가 heal 3% (17.4)

별돌보미 합산 periodic heal = teamwide + ownerExtra = 1% + 3% = **4% per 2초** (17.4).

## 시뮬 적용

### 데이터
- `public/data/tft_set17_traits.json` — `TFT17_Stargazer_Fountain` entry 의 effects 에 정식 이름 변수 노출 (PR `bfa7794`)

### 엔진
- `src/lib/simulator/engine/combatLoop.ts:applyStargazerEffects` — `apiName === 'TFT17_Stargazer_Fountain'` 분기에서:
  - 강화 칸 아군 → `augmentManaRegen += teamwideMana`
  - 강화 칸 아군 → `fountainHealPctPerTick = teamwidePeriodicHeal` (raw `{d7e6d620}` = 0.01) — **17.4 sim 통합 (C-5a)**
  - 강화 칸 별돌보미 → `augmentManaRegen += ownerMana` (추가)
  - 별돌보미에 `stargazerFountainHealPercent = healPct` 부여
  - 별돌보미에 `fountainStackingAdapPerTick = stackingAdapPct/100` 부여 (raw `{13a2a786}` percent → fraction) — sim 통합 (C-5e)
  - 별돌보미에 `fountainHealPctPerTick += ownerExtraPeriodicHeal` 합산 (raw `{f2840aed}` = 0.03 for 17.4) — **17.4 sim 통합 (C-5a)**
- `src/lib/simulator/engine/combatLoop.ts:triggerFountainHeal` — cast pipeline 에서 호출:
  - `stargazerFountainHealPercent > 0` 이고 즉발 dmg > 0 일 때
  - `healAmount = totalAbilityDmg × healPct × healAmp` (lowest HP ally 에 적용)
  - OOR(dash/self_buff) cast path 에도 적용 (codex P1 review `6eea7b7`)
- `src/lib/simulator/engine/combatLoop.ts:5333-5363` — main loop fountain tick (매 `Fountain_Interval` × `TICKS_PER_SECOND` ticks 마다):
  - `fountainStackingAdapPerTick > 0` 인 unit 에 누적 ADAP 적용: `damage *= (1+fraction)`, `ap += fraction*100`
  - `fountainHealPctPerTick > 0` 인 unit healing (C-5a 활성): `heal = maxHp × fraction × (1+healAmp)` 적용 (line 5352-5356)

### 테스트 가드
- `tests/unit/simulator/stargazer-fountain-1703-active.test.ts` (PR #109, 7 케이스) — data-only → active 검증. C-5a (본 PR) 에서 it 갱신: (3) tier 별돌보미 fountainStackingAdapPerTick=0.04 + **fountainHealPctPerTick=0.04** (teamwide 0.01 + ownerExtra 0.03 합산) 동시 검증
- `tests/unit/simulator/stargazer-variants-effects.test.ts` — Fountain 변종 describe — ManaRegen + StackingADAP (5) tier 0.09 + **periodic heal (5) tier 별돌보미 합산 0.04** + 누적 damage/ap/heal 회귀
- `tests/.../17-2-fountain-inactive.test.ts` (legacy) — 17.2 시점 no-op 검증

## 패치 히스토리

| 패치 | 상태 | 변경 |
|------|------|------|
| 17.2 PBE | data-only | hash 변수로 추출 (`F1` `ebf3fcf`). PBE 의 매초 효과 (`fountainHealPctPerTick` / `fountainStackingAdapPerTick`) 시도 |
| 17.2 LIVE ([[patch-17-2]]) | **inactive** | Fountain 17.2 LIVE no-op 확정 (`059547c`). 공식 패치노트: "Fountain pattern temporarily disabled". PBE 매초 효과는 LIVE 에서 빠짐 |
| 17.2b ([[patch-17-2b]]) | inactive | 비활성 표기 유지 (`08b5615`) |
| 17.3 LIVE (2026-05-13) | **active** | CDragon Latest 5/9 부터 hash → 정식 이름 변수. lolchess.gg 17.3 패치노트 "별돌보미 우물 강화된 칸 효과 완전 재설계" 명시. sim 재활성화 (PR #109) |
| 17.4 LIVE (2026-05-27, [[patch-17-4]]) | **full active** | sequence C-5 5건 모두 완료. **C-5e (PR #172)**: raw `{13a2a786}` = `Fountain_StackingADAP` 매핑 + (5) StackingADAP `7→9%` 너프 + `fountainStackingAdapPerTick` sim 통합. **C-5a (본 PR)**: raw `{d7e6d620}` (teamwide 1%) + `{f2840aed}` (별돌보미 추가 2.5→3% 너프) 매핑 + `fountainHealPctPerTick` sim 통합. main loop fountain tick (line 5333-5363) 완전 활성화 — Fountain 변종 4 메커니즘 (ManaRegen / Cast-on-Heal / StackingADAP / Periodic Heal) 모두 sim 일치 |

## 17.2 vs 17.3+ — periodic tick 메커니즘 완전 채택

17.2 PBE 시점에 추출했던 두 매초 효과는 17.3+ LIVE 에서도 유효한 메커니즘이었음. 17.4 패치 시점에 모든 raw 매핑 풀림 + sim 통합:
- **`fountainStackingAdapPerTick`** — sequence C-5e (PR #172) 완료. raw `{13a2a786}` (percent points) ÷ 100 으로 fraction 변환. main loop tick (5357-5361) 이 매 `Fountain_Interval` (2초) 마다 누적 적용
- **`fountainHealPctPerTick`** — sequence C-5a (본 PR) 완료. raw `{d7e6d620}` (teamwide 1%) + `{f2840aed}` (별돌보미 추가 17.4 너프 2.5→3%) 합산. main loop tick (5352-5356) 이 매 `Fountain_Interval` 마다 적용

## (3)/(5) AD/AP — sim 매핑 풀림 + 17.4 너프 적용

raw `{13a2a786}` = `Fountain_StackingADAP`, raw `{d7e6d620}`/`{f2840aed}` = periodic heal 매핑이 17.4 패치 시점에 확인됨:
- **(3) Fountain**: AD/AP +4% per 2s (17.3 부터 / 17.4 동일), teamwide heal 1% + 별돌보미 추가 heal 3% per 2s (17.4 너프 2.5→3)
- **(5) Fountain**: AD/AP **+9%** per 2s (**17.4 너프 7 → 9**), teamwide heal 1% + 별돌보미 추가 heal 3% per 2s (17.4 너프 2.5→3)

별돌보미 합산 periodic heal: 1% + 3% = **4% maxHp per 2초** (17.4).

## 보류 / 미반영

- ~~AD/AP 4%/7% 효과의 CDragon 변수명 미발견~~ **해소 (C-5e)** — raw `{13a2a786}` = `Fountain_StackingADAP` 확정
- ~~periodic heal 1%/2.5%~~ **해소 (C-5a, 본 PR)** — raw `{d7e6d620}` = teamwide heal / `{f2840aed}` = 별돌보미 추가 heal 매핑 + 17.4 너프 2.5→3 적용
- 별돌보미 여사냥꾼 보드 좌상단 hex 추가 — 17.3 공식 확정 ([[patch-17-3]] Stargazer 섹션). 별도 보드 데이터 작업 필요

## Lint 체크리스트

- [x] 17.4 패치 머지 — (5) StackingADAP 7→9 너프 raw json 적용 + sim 매핑 풀림 (C-5e ✅ PR #172)
- [x] AD/AP 4%/9% sim 변수 매핑 — raw `{13a2a786}` = `Fountain_StackingADAP` 확정 (C-5e ✅)
- [x] periodic heal (1%/3% per 2s) sim 적용 — raw `{d7e6d620}` (teamwide) + `{f2840aed}` (별돌보미 추가) 매핑 확정 + 17.4 너프 2.5→3 적용 (C-5a ✅ 본 PR)
- [ ] memory `stargazer_fountain_inactive.md` 의 description — 17.3 active → 17.4 full active 갱신 필요

## 관련

- [[stargazer]] — 부모 trait
- [[patch-17-3]] — 재활성화 패치
- [[patch-17-4]] — sequence C-5 (Mountain/Serpent/Huntress/Fountain) 완전 통합
- PR #109 — sim 활성화 머지
- PR sequence C-5e (#172) — StackingADAP sim 통합
- PR sequence C-5a (본 PR) — Periodic heal sim 통합 + 17.4 (별돌보미 추가) 2.5→3 너프
- 메모리: `stargazer_fountain_inactive.md` (이름은 legacy, 내용은 17.4 full active)
