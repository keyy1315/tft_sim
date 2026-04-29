# Golden Tests

`item-effect-engine` Phase 2 gate — 시뮬 결과 snapshot 비교로 regression을 0으로 유지한다.

## 개요

- **목적**: 엔진/registry 변경 전후 동일 시나리오의 결과가 완전히 같은지 검증
- **원리**: `simulateCombat()` 실행 → `ScenarioSummary` 로 요약 → Vitest `toMatchSnapshot()`
- **보관**: 최초 실행 시 `__snapshots__/` 아래 자동 저장. 이후 실행은 저장본과 diff

## 실행

```bash
pnpm test:golden          # 검증 (diff 있으면 실패)
pnpm test:golden -u       # 의도적 변경 — snapshot 갱신
pnpm test:watch            # 개발 중 watch
```

## 파일 구조

```
tests/golden/
├── helpers.ts             # 데이터 로더 + ScenarioSummary 구성기
├── scenarios/
│   ├── basic.ts           # 샘플 (Phase 2 시작 시점)
│   └── <category>.ts      # 카테고리별 추가
├── golden.test.ts         # 테스트 러너
└── __snapshots__/         # 자동 생성
```

## 시나리오 추가 방법

1. `scenarios/` 아래에 `.ts` 파일 추가 또는 기존 파일에 append
2. `Scenario` 인터페이스 충족:
   ```ts
   export const MY_SCENARIO: Scenario = {
     name: '설명적 이름',
     seed: 42,                              // 결정론 필수
     player: [
       { apiName: 'TFT17_Jinx', position: { q: 0, r: 0 }, starLevel: 2,
         items: ['TFT_Item_InfinityEdge'] },
     ],
     enemy: [
       { apiName: 'TFT17_Briar', position: { q: 0, r: 7 }, starLevel: 2 },
     ],
   };
   ```
3. `golden.test.ts` 의 시나리오 배열에 import + 추가 (혹은 새 `describe` block)
4. `pnpm test:golden` 실행 → 첫 실행은 snapshot 자동 생성 (review 후 커밋)

## 좌표 시스템

- Axial hex (`q`, `r`). 플레이어 팀은 r=0~3, 적 팀은 r=4~7 관례
- `skipMirror: true` 기본 — 명시적 위치 유지가 디버깅에 유리

## Summary Schema

Snapshot에 저장되는 `ScenarioSummary` 구조:

| Field | 용도 |
|-------|------|
| `winner` | `'player' \| 'enemy' \| 'draw'` |
| `duration` | 전투 소요 시간 (초) |
| `snapshotCount` | 총 tick 수 간접 지표 |
| `logCounts` | `{ attack: n, ability: n, death: n, ... }` |
| `units[]` | 유닛별 `finalHp`, `totalDamageDealt`, `castCount`, ... |

`TickSnapshot` 전체가 아닌 "핵심 invariant"만 저장 → diff 노이즈 최소화 + 파일 크기 제한.

## 변경 승인 프로세스

시뮬 결과가 **의도적으로** 바뀐 경우 (예: 버그 수정, 공식):

1. 변경 전 `pnpm test:golden` 으로 기존 snapshot 확정
2. 엔진 수정
3. `pnpm test:golden -u` 로 snapshot 갱신
4. PR 에서 snapshot diff 리뷰 — 변경이 기대한 영향 범위와 일치하는지 확인
5. 범위 밖 snapshot 변경이 있으면 regression — 원인 조사 후 재작업

## Phase 2 목표

- 100 시나리오 (챔프 10 × 아이템 조합 10) — Design §11.1 기준
- `ITEM_EFFECTS` registry 에 기존 19개 + 신규 ~30개 StatPatch 등록
- `getItemEffects` 경로 registry 우선 + legacy fallback 전환
- 이 과정 동안 golden diff 0 유지
