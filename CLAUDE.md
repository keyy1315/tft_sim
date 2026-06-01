# CLAUDE.md — TFT Combat Simulator

## 프로젝트 개요

롤토체스(TFT) 전투 시뮬레이션 분석 툴.
실제 게임 그래픽이 아닌 **아이콘 기반 2D 분석 스타일 UI**로 구현한다.
핵심 철학: **시뮬레이션 정확도 > 그래픽**

---

## 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS
- **State**: Zustand
- **Rendering**: React absolute layout (Canvas는 애니메이션 필요 시)
- **Simulation Engine**: TypeScript pure logic (결정론적 설계 필수)
- **Data Source**: CommunityDragon / Riot API

---

## 개발 명령어

```bash
pnpm dev          # 개발 서버 (localhost:3000)
pnpm build        # 프로덕션 빌드
pnpm lint         # ESLint 실행
pnpm typecheck    # tsc --noEmit
```

코드 수정 후 반드시 아래 세 가지를 순서대로 통과시킬 것:

```bash
pnpm lint && pnpm typecheck && pnpm build
```

셋 중 하나라도 실패하면 커밋하지 않는다.

---

## 디렉토리 구조

```
src/
├── app/
│   ├── simulator/
│   ├── builder/
│   └── api/
│       ├── simulate/
│       └── metadata/
├── components/
│   ├── battle/        # BattleBoard, UnitToken, BattleControls
│   ├── builder/       # ChampionGrid, ItemSlot, AugmentSelector
│   └── analysis/      # DamageTable, EventLog, ResultChart
├── lib/
│   └── simulator/
│       ├── engine/    # combatLoop.ts, replayEngine.ts
│       ├── systems/   # targeting.ts, attack.ts, ability.ts, mana.ts, trait.ts, item.ts
│       ├── models/    # unit.ts, ability.ts, hex.ts
│       └── events/    # eventBus.ts
├── store/             # teamSlice, battleSlice, replaySlice, uiSlice
├── data/              # champions.json, items.json, augments.json, traits.json
└── types/             # unit.ts, ability.ts, combat.ts
```

---

## React Compiler 규칙 (중요)

이 프로젝트는 `next.config.ts`에서 `reactCompiler: true`로 React Compiler를 활성화하고 있다.
`eslint-plugin-react-hooks` v7.0.0 이상의 React Compiler 전용 린트 규칙을 반드시 준수해야 한다.

### `react-hooks/set-state-in-effect` — useEffect 안에서 setState 호출 금지

React Compiler의 자동 메모이제이션과 충돌하여 의도치 않은 동작이 발생할 수 있다.
`eslint-disable`로 무시하지 말 것.

대안:
- 읽기 전용 데이터 → state 대신 파생 값으로 직접 계산
  ```ts
  // ❌ 금지
  useEffect(() => { setData(queryData ?? default) }, [queryData])

  // ✅ 대안
  const data = queryData ?? default
  ```
- 폼 편집 등 로컬 state가 반드시 필요한 경우 → 부모에서 `key` prop으로 리마운트 제어

### `react-hooks/set-state-in-render` — 렌더링 중 setState 호출 금지

렌더 함수 본문에서 직접 setState를 호출하지 않는다.

### 기타 Compiler 규칙

`purity`, `immutability`, `refs`, `globals`, `use-memo`, `static-components` 등
`pnpm lint`로 검출되며, `eslint-disable` 처리 대신 규칙에 맞게 코드를 수정할 것.

---

## 코딩 컨벤션

### 컴포넌트
- 서버 컴포넌트를 기본으로 사용하고, 인터랙션이 필요한 경우에만 `"use client"` 추가
- `app/` 내부 `page.tsx`, `layout.tsx`는 서버 컴포넌트 유지
- 컴포넌트 파일명은 PascalCase, 유틸 함수는 camelCase
- 절대 경로 임포트 사용 (`@/components/...`, `@/lib/...`)

### TypeScript
- `any` 사용 금지 — 반드시 명시적 타입 정의
- 시뮬레이터 핵심 타입(`Unit`, `Ability`, `HexCoord` 등)은 `src/types/`에서 중앙 관리
- `UnitRole`, `AbilityTargetingType`, `DamageType`은 union type으로 정의

### 시뮬레이션 엔진
- 엔진 로직(`src/lib/simulator/`)은 React에 의존하지 않는 **순수 TypeScript**로 작성
- 시뮬레이션은 **결정론적(Deterministic)** 으로 설계 — 동일 입력은 반드시 동일 결과를 내야 한다 (Replay 보장)
- `console.log`는 커밋하지 않음

### 상태 관리 (Zustand)
4개 슬라이스를 분리해서 관리한다:

| 슬라이스 | 역할 |
|---------|------|
| `teamSlice` | 팀 구성, 유닛 배치, 보드 상태 |
| `battleSlice` | 현재 틱, 전투 상태(`idle/running/paused/finished`), 실시간 유닛 상태 |
| `replaySlice` | 틱별 스냅샷 배열, 재생 틱, 재생 속도 |
| `uiSlice` | 선택된 유닛 ID, 활성 패널 |

슬라이스 간 직접 참조 금지 — 필요 시 selector로 조합할 것.

---

## 타게팅 시스템 핵심 원칙 (Patch 15.1 Roles Revamped 기준)

`src/lib/simulator/systems/targeting.ts` 작성 시 반드시 준수한다.

**1단계 — 거리 우선**: 가장 가까운 적을 타겟. Hex 거리는 Axial Coordinates 기준 `hexDistance()` 사용.

**2단계 — Role 타이브레이커** (동거리 유닛이 여러 명일 때):
```
Tank (weight=3) > Fighter/Assassin (weight=2) > Marksman/Caster/Specialist (weight=1)
```

> 위 가중치는 `src/lib/simulator/systems/targeting.ts:TARGETING_WEIGHT` ground truth 기준. 자세한 흐름은 위키 `docs/wiki/mechanics/role-passive.md` 참조.

**타게팅 오버라이드 조건** (우선순위 높은 순):
1. 도발(Taunt) 효과 → 강제 어그로 전환
2. 경로 막힘 → 차선 타겟 재선택
3. 타겟 사망 → 즉시 재타겟팅
4. 어빌리티 지정 타겟 → `AbilityTargetingType`에 따라 처리

---

## Role별 마나 획득 규칙

`src/lib/simulator/systems/mana.ts` 작성 시 참고한다.

| Role | 공격당 마나 | 초당 마나 | 피격 시 마나 |
|------|-----------|---------|------------|
| Tank | 5 | 0 | ✅ |
| Fighter | 10 | 0 | ❌ |
| Marksman | 10 | 0 | ❌ |
| Caster | 7 | 2 | ❌ |
| Assassin | 10 | 0 | ❌ |
| Specialist | 10 | 0 | ❌ |

> Specialist는 위 표준값 (Fighter/Marksman/Assassin 와 동일) 으로 분기되며, 챔프별 고유 메커니즘은 ability 레벨에서 처리한다. ground truth: `src/lib/simulator/systems/mana.ts:ROLE_MANA_CONFIG`.

**CC 상태 시 마나 차단** — 스턴 등 CC 가 적용되면 **모든 role**이 공격 마나 획득 중단 (`gainManaOnAttack` 의 `isStunned` 가드). Caster는 추가로 초당 마나(`gainManaPerTick`)도 차단되어 영향이 가장 큼.

> 마나/타게팅 시스템 전체 흐름·아이템·trait 보너스는 위키 `docs/wiki/mechanics/role-passive.md` 참조.

---

## 데이터 관리

- `data/*.json`에는 반드시 `patch_version`과 `fetched_at` 필드를 포함할 것
- CommunityDragon 호출 실패 시 → 로컬 캐시 JSON fallback + 버전 불일치 경고 배너 표시
- DB 접근 없음 — 모든 게임 데이터는 JSON 파일 기반

---

## MVP 범위

챔피언 10명 / 아이템 10개 / 증강 5개 / 시너지 5개

MVP에서 구현하는 것:
- Role 기반 타게팅이 포함된 전투 시뮬레이션
- Damage Table
- Combat Replay (틱 스냅샷 방식)
- 기본 Event Log

MVP에서 제외하는 것:
- 이동 경로 탐색 (A*)
- 복합 스킬 효과
- 도발 오버라이드
- 차트 시각화

---

## 주의사항

- `eslint-disable` 주석으로 React Compiler 경고를 억제하지 말 것 — 반드시 코드를 수정할 것
- 시뮬레이션 엔진은 UI 레이어와 완전히 분리되어야 한다
- Replay 정확성을 위해 엔진에 `Math.random()` 직접 사용 금지 — seed 기반 난수 생성기를 통해서만 사용
- `console.log` 커밋 금지

---

## TFT Domain Wiki Ingest 검증

`docs/wiki/` 에 champion / mechanic / carry-augment 페이지를 작성·수정할 때 누적된 9건 lint case 가 모두 Codex review 가 catch 했다 (self-catch 0%). 사전 verify forcing function 으로 `wiki-ingest-verifier` subagent 를 도입한다.

### Dispatch 규칙 (필수)

다음 경로의 파일을 **write 또는 edit 직후 commit 전** 에 반드시 `wiki-ingest-verifier` subagent 를 dispatch 한다.

- `docs/wiki/champions/*.md` (모든 champion 페이지)
- `docs/wiki/mechanics/*.md` (모든 mechanic 페이지)
- `docs/wiki/augments/*-carry.md` (carry augment 만, 일반 augment 제외)

### Dispatch 호출 예시

```
Agent (subagent_type=wiki-ingest-verifier) — dispatch with page paths
```

Subagent 는 read-only. P0/P1/P2 finding 을 tiered 로 반환하며, **P0 finding 은 commit 전 반드시 fix**. P1 은 본 PR 내 가능하면 fix, P2 는 다음 사이클 허용.

### Single source of truth

- 룰셋: `docs/wiki/lint-rules.md` — 5단계 verify rule + entity-type checklist + 9건 lint history + Severity Tier 정의. 룰 진화 시 본 파일만 수정 (git diff 추적).
- Subagent: `.claude/agents/wiki-ingest-verifier.md` — lint-rules.md 를 dispatch 첫 단계에서 Read 하여 룰 로드.
- 메모리 `feedback_wiki_ingest_verify` (user-local) — main agent 작성 워크플로우 (positive verify). lint subagent (negative verify) 와 책임 분리.

### 평가

다음 6 PR 후 `docs/wiki/lint-rules.md` 의 Self-catch Metric 표 업데이트. Target: **self-catch / (self-catch + Codex) ≥ 50%** (P0 기준). 미달 시 subagent prompt 강화 / 룰 추가.