---
name: TFT Domain Wiki Schema
purpose: tft_sim 도메인 지식 (TFT 게임 메커니즘) 위키의 구조·워크플로우 정의
scope: docs/meta/wiki/ 하위만. PDCA(docs/01-plan/ 등)는 별도 영역
based_on: Karpathy LLM Wiki pattern (https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
updated: 2026-05-18
---

# TFT Domain Wiki — Schema

## 목적

tft_sim 은 **결정론적 TFT 전투 시뮬레이터**다. 시뮬레이션 정확도는 다음 도메인 지식의 정합성에 의존한다:

- 패치별 메커니즘 변경 (예: Stargazer Fountain 17.2 inactive → 17.3 active)
- 챔피언 어빌리티의 정확한 변수·발동 조건
- 시너지·아이템·증강 상호작용

이 지식은 매 패치마다 갱신되고, 여러 PR·커밋·메모리에 분산된다. LLM Wiki 패턴으로 **영속 위키**에 합성·교차참조해 stale claim을 lint로 잡는다.

## 3-Layer 구조

| Layer | 위치 | 성격 |
|-------|------|------|
| **1. Raw Sources** | `docs/meta/wiki/raw/{lolchess,in-game,cdragon,patch-notes,assets}/` + `public/data/tft_set17_*.json` (코드 직접 참조 본진) | 불변 추출물. 직접 편집은 출처가 갱신될 때만 |
| **2. Wiki** | `docs/meta/wiki/{champions,traits,mechanics,patches,items,augments}/` | LLM이 합성·유지. 교차참조 `[[entity-id]]` 사용 |
| **3. Schema** | 이 파일 + `index.md` + `log.md` + `raw/README.md` (raw 카탈로그) | 위키 자체의 메타 |

### Raw 폴더 컨벤션

`docs/meta/wiki/raw/` 하위는 **출처(source) 기준**으로 분류:

| 폴더 | 출처 | 특징 |
|------|------|------|
| `lolchess/` | lolchess.gg | 외부 사이트 추출. HTML 파싱 한계로 색 아이콘 등 누락 가능 |
| `in-game/` | 실제 게임 플레이/스샷 | 사용자 직접 측정. 가장 신뢰도 높음 |
| `cdragon/` | CommunityDragon JSON 발췌 | 필요 시. `public/data/tft_set17_*.json` 본진과 중복 주의 |
| `patch-notes/` | Riot 공식 patch notes | 패치별 1파일 권장 |
| `assets/` | 스크린샷, 이미지 | binary |

**파일명 규칙**: `set{N}-<topic>.md` 형식. Set 구분이 명확해야 후속 Set 들어와도 충돌 없음.
**참조 갱신 규칙**: raw 파일을 옮기거나 이름 변경 시 `grep -rn` 으로 참조 전수 조사 후 일괄 치환.

> docs/meta/ 루트에 남아있는 `set17-*` 파일은 raw가 아닌 analysis/plan/audit 문서. 위키 본문으로 점진 ingest 대상 ([[index]] "다음 작성 후보" 섹션).

## Entity 종류

### `traits/<id>.md`
- 시너지 (별돌보미, 아이오니아, 필트오버, 신성 등)
- frontmatter: `id`, `api_name`, `tiers`, `current_patch_status`, `sources`
- 변종(별자리 같은 하위 메커니즘)은 별도 `mechanics/` 페이지로 분리하고 trait 페이지에서 링크

### `champions/<id>.md`
- 챔피언 1명당 1페이지
- frontmatter: `id`, `api_name`, `cost`, `traits`, `role`, `current_patch_status`
- 어빌리티 변수, 발동 조건, sim 적용 상태

### `mechanics/<id>.md`
- 특정 메커니즘 (Stargazer Fountain, role-passive, spell-crit 등)
- frontmatter: `id`, `parent_entity`, `current_patch_status`, `sim_active`
- 패치별 히스토리 섹션 필수 (stale claim 검출의 핵심)

### `items/<id>.md`, `augments/<id>.md`
- 동일 패턴. MVP 범위 외는 미작성 OK.

### `patches/<id>.md`
- 패치 1개당 1페이지. **파일명은 `patch-` prefix 필수** (예: `patch-17-2.md`, `patch-17-2b.md`, `patch-17-3.md`)
- frontmatter `id` 도 동일 prefix (예: `patch-17-3`) — Obsidian 스타일 `[[patch-17-3]]` 링크 정합
- frontmatter: `id`, `live_date`, `status` (PBE/LIVE/obsoleted)
- 해당 패치에서 변경된 entity 링크 모음

## 페이지 컨벤션

### Frontmatter (필수)
```yaml
---
id: stargazer-fountain         # kebab-case, 파일명과 일치
type: mechanic                  # trait | champion | mechanic | item | augment | patch
api_name: TFT17_Stargazer_Fountain  # 코드 참조 키 (있으면)
current_patch_status: active    # active | inactive | data-only | obsoleted
sim_active: true                # 시뮬에 실제 적용되어 있는가
last_verified: 2026-05-18       # 마지막 검증일
sources:                        # 출처 (Layer 1 / 외부 URL)
  - docs/meta/wiki/raw/lolchess/set17-stargazer-constellations.md
  - https://lolchess.gg/...
related:                        # 다른 위키 페이지 (자유 링크)
  - "[[stargazer]]"
  - "[[patch-17-3]]"
---
```

### 본문 섹션
- **요약** (1~3줄): 이 entity가 무엇인지
- **현재 상태** (active 패치 기준 메커니즘)
- **패치 히스토리** (역순, 변경점만)
- **시뮬 적용 상태** (코드 위치, 활성/비활성 분기)
- **미확정/보류** (모르는 것, 검증 필요한 것)
- **관련** (다른 위키 페이지 링크)

### 링크
- 다른 위키 페이지: `[[entity-id]]` (Obsidian 스타일)
- 코드: `src/lib/simulator/.../file.ts:functionName` (line은 적지 말 것 — 즉시 stale됨)
- 외부 URL: 일반 markdown
- PR/commit: `#PR번호` 또는 commit short hash

## 3-Operation 워크플로우

### Ingest (새 정보 들어왔을 때)
1. 출처 파악: 어느 Layer 1 (raw source) 에 추가/변경되었는가
2. 영향 entity 찾기: 위키에서 grep / `[[]]` 역참조
3. 영향 페이지 일괄 업데이트 (최대 10~15개 한 번에 OK)
4. `log.md` 에 append
5. `index.md` 갱신 (새 페이지 추가 시)

### Query (질문 받았을 때)
1. 위키부터 검색. 답이 있으면 위키만으로 응답
2. 위키에 없거나 stale 의심 → Layer 1 raw source 또는 코드 직접 확인
3. **새로 얻은 가치 있는 분석은 위키로 file back** (재발견 비용 방지)

### Lint (주기적 health check)
- `current_patch_status: inactive` 인데 최신 패치에서 활성화됐는가?
- `last_verified` 가 2주 이상 지났는데 그 사이 관련 코드 변경이 있는가?
- `[[]]` 링크 깨진 곳 (orphan link)
- frontmatter에 명시한 `sources` 파일 존재 여부
- 중복/모순 (같은 메커니즘이 두 페이지에 다르게 적혀있음)

Lint 주기: 각 패치 머지 직후, 또는 새 entity 5개 ingest마다.

## 적용 범위 / 비범위

### 포함
- TFT 게임 메커니즘 도메인 지식 (패치별, 시너지, 챔피언 어빌리티)
- sim 엔진과 게임 spec 간의 적용 상태 매핑

### 비포함
- 코드 아키텍처 (CLAUDE.md, `docs/02-design/`이 담당)
- 프로젝트 진행 상황 (PDCA `docs/01-plan/` `04-report/`가 담당)
- 일회성 작업 메모 (PR 설명, 커밋 메시지가 담당)

## 시드 이력

- 2026-05-18: 초기 schema + Stargazer Fountain seed 1개 (17.2 inactive → 17.3 active 사례 검증)
