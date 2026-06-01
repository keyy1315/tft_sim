---
name: TFT Wiki — Raw Sources Catalog
purpose: Layer 1 (raw sources) 카탈로그. 출처별 분류 + 외부 raw 위치 매핑
updated: 2026-05-18
---

# Raw Sources Catalog

위키의 **Layer 1**. LLM은 여기 있는 파일을 **읽기만 하고 수정하지 않는다** (출처 자체가 갱신될 때만 갱신).

위키 본문(`traits/`, `mechanics/`, `patches/` 등)은 이 raw를 기반으로 합성·교차참조한다.

## 분류 원칙

**출처(source) 기준**으로 분류한다. 어떤 entity에 속하는지는 위키 본문에서 결정.

## 폴더

### `lolchess/` — lolchess.gg 추출

> 특징: HTML 파싱 한계 — 색 아이콘 텍스트, 일부 ?스탯 누락 가능. 인게임 툴팁 교차검증 필요.

- `set17-stargazer-constellations.md` — Set 17 별돌보미 7별자리 ([[stargazer]], [[stargazer-fountain]])
- `set17-factory-new-arsenal.md` — Set 17 최신상 무기고 (그레이브즈 전용 트리)
- `set17-graves-factory-tree.md` — 최신상 트리 + 코드 매핑 (52 entries)
- `set17-yasuo-tiles.md` — 야스오 칸 수치 (gods-system 추정수치 대체본)

### `in-game/` — 실제 게임 플레이/스크린샷

> 특징: 사용자 직접 측정. 가장 신뢰도 높음. 패치 변경 직후 가장 빠르게 반영 가능.

- `set17-hero-augments.md` — Set 17 영웅 증강 8종 (2026-04-30 17.2b 시점 측정)

### `cdragon/` — _빈 폴더_

CDragon 추출은 현재 `public/data/tft_set17_*.json` (시뮬 코드가 직접 참조하는 본진) 이 담당. 별도 발췌 raw가 필요해지면 여기에.

### `patch-notes/` — _빈 폴더_

Riot 공식 patch notes 복붙·발췌가 필요하면 여기에. 현재는 [[patch-17-3]] 본문에서 외부 URL로 참조.

### `assets/` — _빈 폴더_

스크린샷·이미지. 필요 시 생성.

## docs/meta/ 루트에 남아있는 set17-* (raw 아님)

다음은 사용자 합성물 (analysis/plan/audit/guide) 이라 raw가 **아니다**. 위키 본문으로 점진 ingest 대상.

| 파일 | 성격 | 향후 |
|------|------|------|
| `docs/meta/set17-trait-audit.md` | audit (17.2 hash 변수 ↔ 시뮬 매핑) | 트레잇별 페이지 ingest 후 archive |
| `docs/meta/set17-meta-guide.md` | 정리 가이드 (성급 시스템 등) | `mechanics/` 다수로 분리 ingest |

> Archived (ingest 완료 후 삭제):
> - `set17-patch-17-2b-plan.md` → [[patch-17-2b]] (2026-05-18)
> - `set17-gods-system.md` → [[../raw/lolchess/set17-yasuo-tiles]] raw 로 대체 (2026-05-19, Phase 2). 추정 수치였음
> - `nova-selector-ui-handoff.md` → PR #85/86/87 머지 완료, 작업 핸드오프 의의 종료 (2026-05-19, Phase 2)

## 다른 raw 위치 (위키 외부, 참조 매핑)

다음은 `wiki/raw/` 가 아닌 곳에 있지만 raw 성격을 가진다:

| 위치 | 용도 | 비고 |
|------|------|------|
| `public/data/tft_set17_*.json` | CDragon fetch 결과 (traits/champions/items/augments) | **코드 직접 참조 본진**. 시뮬 정확도의 ground truth |
| `public/data/` 기타 JSON | 보드 데이터 등 | |
| 메모리 (`~/.claude/projects/.../memory/`) | 세션 간 컨텍스트 | raw 아님 (Karpathy 의미상), 그러나 stale claim 검출 소스 |

## Lint 체크리스트

- [ ] `lolchess/` 파일의 "출처:" 날짜가 6개월 이상 지났는가? → 재추출 필요
- [ ] `in-game/` 파일의 "측정일"이 현재 패치와 다른가? → 재측정 필요
- [ ] docs/meta/ 루트의 set17-* 가 위키 본문으로 ingest 완료되었는가? → 완료 후 archive
