---
id: stargazer
type: trait
api_name: TFT17_Stargazer
display_name_kr: 별돌보미
tiers: [3, 5, 7]
current_patch_status: active
sim_active: partial   # 별자리별로 다름 — 아래 표 참조
last_verified: 2026-05-18
sources:
  - docs/wiki/raw/lolchess/set17-stargazer-constellations.md
  - https://lolchess.gg/synergies/set17/guide
related:
  - "[[stargazer-fountain]]"
  - "[[patch-17-3]]"
---

# Stargazer (별돌보미)

## 요약

Set 17 시너지. (3) tier 부터 활성. 매 게임마다 **별자리 1개**가 무작위로 결정되어 고정된다. 보드에는 **강화된 칸(Enhanced Tile)** 이 숨겨져 있고, 플레이어 레벨이 오를 때마다 추가 칸이 드러난다. 별자리 효과는 강화 칸의 아군 + 별돌보미 유닛에 적용.

## 별자리 7종 (current_patch: 17.3 LIVE)

| 별자리 (KR) | ID | API name 추정 | sim 상태 |
|------------|----|--------------|---------|
| 제단 | altar | `TFT17_Stargazer_Altar` | partial — Shield_NumDeaths 카운팅 활성 |
| 멧돼지 | boar | `TFT17_Stargazer_Boar` | partial |
| **우물** | **fountain** | **`TFT17_Stargazer_Fountain`** | **active (17.3에서 재활성화)** — [[stargazer-fountain]] |
| 여사냥꾼 | huntress | `TFT17_Stargazer_Huntress` | active — 표식 + heal |
| 메달 | medallion | `TFT17_Stargazer_Medallion` | active — 회귀 가드 있음 |
| 산 | mountain | `TFT17_Stargazer_Mountain` | partial |
| 뱀 | snake | `TFT17_Stargazer_Snake` | active — 중독 reapplication |

> 정확한 API name 은 `public/data/tft_set17_traits.json` 에서 확인. 별자리별 변종 trait 으로 분리됨.

## 강화된 칸 (Enhanced Tile)

- 게임 시작 시 무작위 배치, 본인만 볼 수 있음
- 플레이어 레벨이 오를수록 드러나는 칸 수가 증가 (정확한 레벨별 개수 — 미확정)
- 효과는 **강화 칸의 아군** + **강화 칸의 별돌보미** 두 단계로 적용 (별돌보미가 더 받음)

## 시뮬레이터 적용

- 데이터 표현: `GameStargazerState { constellationId }` + `TeamStargazerState { revealedTiles }` (자세히는 [[schema]] 참고하여 분기)
- 코드: `src/lib/simulator/engine/combatLoop.ts:applyStargazerEffects` — apiName 별 분기
- A팀/B팀 강화 칸 매핑은 mirror 일치 (PR10 `eea4fbc`)

## 패치 히스토리

| 패치 | 변경 |
|------|------|
| 17.2 PBE | hash 변수로 7별자리 추출 (`F1` `ebf3fcf`) |
| 17.2 LIVE | Fountain 만 비활성 처리 (`08b5615`). 나머지 active |
| 17.2b | Fountain 비활성 표기 유지 |
| **17.3 LIVE (2026-05-13)** | **Fountain 정식 이름 변수로 풀림 + 재활성화** (PR #109) |

## 미확정

- 각 별자리의 색 아이콘 텍스트 (HTML 파싱 누락) — 실제 게임 툴팁 확인 필요
- 별자리 8번째 존재 여부 (Set 별자리는 통상 8~9종, 현재 7종만 확인)
- 플레이어 레벨별 드러나는 강화 칸 개수 규칙

## 관련

- [[stargazer-fountain]] — 우물 별자리 상세
- [[patch-17-3]] — Fountain 재활성화 패치
- raw source: `docs/wiki/raw/lolchess/set17-stargazer-constellations.md`
