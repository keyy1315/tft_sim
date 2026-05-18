---
id: patch-17-3
type: patch
live_date: 2026-05-13
status: LIVE
last_verified: 2026-05-18
sources:
  - lolchess.gg 17.3 patch notes
  - CDragon Latest (5/9~)
related:
  - "[[stargazer-fountain]]"
  - "[[stargazer]]"
---

# Patch 17.3 LIVE

## 핵심 변경 (sim 영향 있는 것만)

### Stargazer Fountain 재활성화
- 17.2 LIVE 부터 비활성이던 [[stargazer-fountain]] 가 정식 active
- CDragon Latest 5/9 부터 hash 변수 → 정식 이름 (`Fountain_HealPercent` / `Fountain_ManaRegen` / `Fountain_ManaRegen_Teamwide`)
- lolchess.gg: "별돌보미 우물 강화된 칸 효과 완전 재설계"
- sim 적용: PR #109 (`feat/tft-17-3-stargazer-fountain` → dev)

## sim 적용 PR 그룹 (17.3 데이터 갱신)

- PR #107 — 17.3 trait/champion 데이터 갱신
- PR #108 — Shen passive fix (별도)
- PR #109 — Stargazer Fountain active

## 회귀 가드

- `tests/unit/simulator/stargazer-fountain-1703-active.test.ts` (신규, 7 케이스)
- 17.2/17.2b/Fountain-1702 obsolete 테스트 제거 (`e2031d7`)

## 미확정 / 추적 필요

- Fountain (3)/(5) AD/AP 4%/7% — lolchess.gg 명시 but CDragon 미노출
- 추가 패치노트 (Fountain 외 시너지/챔피언 변경) — 별도 ingest 필요

## 관련

- [[stargazer-fountain]]
- [[stargazer]]
- 메모리: `project_17-3-data-update-status` (위키 외부)
