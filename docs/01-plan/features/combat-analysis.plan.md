# combat-analysis Planning Document

> **Summary**: 전적검색 데이터를 시뮬레이션 엔진과 연결하여 "왜 졌는지" 분석하는 차별화 기능
>
> **Project**: TFT Combat Simulator
> **Author**: Dayoung
> **Date**: 2026-04-17
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 기존 전적검색 사이트(op.gg, lolchess.gg 등)는 결과만 보여주고, 왜 졌는지/어떻게 하면 이겼는지 알려주지 않는다 |
| **Solution** | 전적 데이터를 시뮬레이션 엔진에 넣어 가상 대전 재구성 → 취약 요인 분석 → What-if 시뮬레이션 제공 |
| **Function/UX Effect** | 전적에서 매치 클릭 → 가상 대전 재구성(정확도 등급 표시) → 배치/아이템 변경 후 재시뮬 → 개선점 피드백 |
| **Core Value** | "기록을 보여주는 사이트"가 아닌 "이유를 알려주는 서비스"로 차별화 |

---

## 1. Overview

### 1.1 Purpose

전적검색은 진입점(hook)이고, 시뮬레이션 기반 분석이 본체인 구조를 만든다.
유저가 "왜 졌는지"를 이해하고, "어떻게 하면 이겼는지"를 시뮬레이션으로 직접 확인할 수 있게 한다.

### 1.2 Background

- 기존 전적검색 사이트들은 순위, 조합, 아이템, LP 변동 등 **결과 데이터 나열**에 그침
- 이 프로젝트에는 이미 결정론적 시뮬레이션 엔진(`combatLoop.ts`)과 전적검색(`riot.ts` + `lookup/`)이 구현되어 있음
- 두 시스템을 연결하면 다른 사이트에 없는 고유 가치를 제공할 수 있음

### 1.3 Related Documents

- 시뮬레이션 엔진: `src/lib/simulator/engine/combatLoop.ts`
- 전적검색: `src/app/lookup/page.tsx`, `src/lib/riot.ts`
- 코치 앱 아이디어: `docs/meta/tft-coach-app-idea.md`

---

## 2. Scope

### 2.1 In Scope

4개 기능을 4단계로 나눠 구현한다:

**Phase 0 — 데이터 계약 검증 (Spike)**
- [ ] Riot API 매치 데이터에서 `SimulateOptions`로 변환 가능한 필드 매핑 정리
- [ ] 결측 데이터(유닛 위치, 상대 배치) 보정 전략 설계 (reconstruction heuristic)
- [ ] 엔진 커버리지 판정 로직: 매치의 챔피언/아이템/증강이 엔진 지원 범위인지 확인
- [ ] 패치 버전 정합성 체크 로직 (전적 세트/패치 vs `data/` 버전)

**Phase 1 — 시너지 충돌 진단 (정적 분석)**
- [ ] 전적 매치 데이터에서 조합 + 아이템 조합의 시너지 효율 분석
- [ ] 아이템-시너지 불일치, 캐리 집중도 부족 등 문제점 진단
- [ ] 진단 결과를 전적검색 UI에 인라인 표시 (정확도 등급: `정적 분석`)

**Phase 2 — 가상 대전 재구성 + 취약 요인 리포트 (시뮬레이션 연결)**
- [ ] 전적 매치 데이터를 시뮬레이터 입력 형식으로 변환 (결측 배치는 heuristic 보정)
- [ ] 종료 시점 조합 기반 가상 대전 시뮬레이션 (실제 라운드 재현이 아닌 사후 추정)
- [ ] 취약 요인 리포트 생성 (캐리 생존 시간, 딜 분배, 타겟팅 문제 등)
- [ ] 정확도 등급 표시: `추정 시뮬레이션` / 엔진 미지원 매치는 `재현 불가` + 버튼 비활성화

**Phase 3 — What-if 시뮬레이션 (인터랙티브)**
- [ ] 재구성된 보드에서 배치/아이템을 수정하여 재시뮬레이션
- [ ] 원본 vs 수정본 결과 비교 UI
- [ ] "이렇게 했으면 이겼다" 피드백 (엔진 기준 추정치임을 명시)

### 2.2 Out of Scope

- 실시간 게임 연동 (Overwolf 오버레이 — 별도 프로젝트)
- 상대 보드 정보 자동 수집 (Riot API에서 제공하지 않는 라운드별 배치 데이터)
- AI 기반 자동 추천 (Claude API 연동 — 코치 앱 범위)
- 메타 통계 대시보드 (승률, 티어리스트 등)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-01 | 전적 매치에서 조합의 시너지 효율 점수를 계산하여 표시 | High | 1 |
| FR-02 | 아이템-챔피언 궁합 불일치를 감지하여 경고 표시 | High | 1 |
| FR-03 | 캐리 집중도(메인 캐리에 아이템/스타 집중 여부) 분석 | Medium | 1 |
| FR-04 | Riot API 매치 데이터 → `SimulateOptions` 필드 매핑 정리 | High | 0 |
| FR-05 | 결측 데이터(유닛 위치, 상대 배치) reconstruction heuristic 설계 | High | 0 |
| FR-06 | 엔진 커버리지 판정: 매치가 시뮬 가능한지 사전 검증 | High | 0 |
| FR-07 | 패치/세트 버전 정합성 체크 (전적 패치 vs `data/` 버전) | Medium | 0 |
| FR-08 | 전적 매치 데이터를 `SimulateOptions`로 변환하는 어댑터 (heuristic 배치 포함) | High | 2 |
| FR-09 | 전적 상세에서 "가상 대전" 버튼 (미지원 매치는 비활성화 + 사유 표시) | High | 2 |
| FR-10 | 가상 대전 결과에서 취약 요인 리포트 자동 생성 | High | 2 |
| FR-11 | 분석 결과에 정확도 등급 표시 (`정적 분석` / `추정 시뮬레이션` / `재현 불가`) | High | 2 |
| FR-12 | 재구성된 보드에서 유닛 배치 드래그 수정 | Medium | 3 |
| FR-13 | 재구성된 보드에서 아이템 변경 후 재시뮬 | Medium | 3 |
| FR-14 | 원본 vs 수정본 결과 비교 (승패, DPS, 생존 시간) | Medium | 3 |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement |
|----------|----------|-------------|
| Performance | 시너지 분석 < 100ms | 브라우저 console 측정 |
| Performance | 시뮬레이션 재현 < 500ms | combatLoop 실행 시간 |
| UX | 전적 → 시뮬 전환이 2클릭 이내 | 사용성 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] Phase 0: 데이터 필드 매핑 문서화 + reconstruction heuristic 설계 완료
- [ ] Phase 0: 엔진 커버리지 판정 + 패치 정합성 체크 로직 구현
- [ ] Phase 1: 전적검색에서 시너지 진단이 인라인 표시됨
- [ ] Phase 2: 매치 클릭 → 가상 대전 재구성 → 취약 요인 리포트가 동작함
- [ ] Phase 2: 엔진 미지원 매치에 `재현 불가` 표시 + 버튼 비활성화
- [ ] Phase 2: 패치 불일치 시 경고 배너 표시
- [ ] Phase 3: 배치/아이템 수정 후 재시뮬 → 비교 결과 표시됨
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과

### 4.2 Quality Criteria

- [ ] Zero lint errors
- [ ] Build succeeds
- [ ] 시뮬레이션 결정론성 유지 (같은 입력 → 같은 결과)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Riot API가 라운드별 배치/상대 보드 데이터를 제공하지 않음 | High | High | "라운드 재현"이 아닌 "가상 대전 재구성"으로 목표 재정의. 최종 조합 + heuristic 배치로 사후 추정 시뮬레이션 |
| 전적 데이터의 챔피언/아이템 ID가 시뮬레이터 내부 ID와 불일치 | Medium | Medium | ID 매핑 어댑터 레이어를 별도로 구현 (`matchAdapter.ts`) |
| 시뮬레이션 결과가 실제 게임 결과와 다를 수 있음 | Medium | High | 정확도 등급을 `추정 시뮬레이션`으로 명시. "엔진 기준 추정치"로 표현하여 유저 기대 관리 |
| **Set 17 외 매치** | High | High | Set 17이 아닌 매치는 분석 대상에서 제외 (unsupported 처리). 시너지/아이템 분석 포함 전체 스킵 |
| **엔진 커버리지 부족** | High | Medium | MVP 제외 항목(이동 경로, 복합 스킬, 도발)이 분석 신뢰도에 영향. 미지원 요소 포함 매치는 `재현 불가` 처리 + 사유 표시 |
| **Zustand 상태 소유권 미정의** | Medium | Medium | 원본 매치 / 재구성 보드 / 수정본 보드 / 비교 결과를 어느 슬라이스가 가질지 Design 단계에서 확정 (슬라이스 간 직접 참조 금지 규칙 준수) |
| **재현 불가 매치의 UX 부재** | Medium | High | 엔진 미지원 챔피언/아이템/증강 포함 매치에 대한 fallback UI 설계 필요 (Phase 0에서 판정 로직 구현) |
| 시너지 분석 로직이 패치마다 바뀜 | Low | High | 분석 로직을 `data/` 기반으로 구성하여 데이터 업데이트로 대응 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Selected |
|-------|-----------------|:--------:|
| **Starter** | Simple structure | ☐ |
| **Dynamic** | Feature-based modules, BaaS | ☒ |
| **Enterprise** | Strict layer separation, microservices | ☐ |

### 6.2 Key Architectural Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| 데이터 변환 레이어 | `src/lib/analysis/matchAdapter.ts` | 전적 데이터 ↔ 시뮬레이터 입력 변환을 엔진/UI와 분리 |
| 분석 엔진 위치 | `src/lib/analysis/` | 시뮬레이터(`lib/simulator/`)와 같은 레벨, UI 미의존 순수 TS |
| 시너지 분석 | 정적 분석 (시뮬레이션 불필요) | Phase 1을 빠르게 출시하기 위해 시뮬 없이 데이터만으로 분석 |
| 취약 요인 리포트 | `CombatResult` + `CombatLog` 파싱 | 이미 엔진이 생성하는 데이터를 재활용. "패배 원인"이 아닌 "엔진 기준 취약 요인"으로 표현 |
| What-if UI | 기존 `SetupBoard` 컴포넌트 재사용 | 보드 편집 UI를 새로 만들지 않음 |
| 배치 추정 전략 | Heuristic 기반 기본 배치 | Riot API에 위치 데이터 없으므로, Role 기반 배치 규칙으로 보정 (Tank 전열, Carry 후열 등) |

### 6.3 Zustand 상태 소유권

CLAUDE.md의 슬라이스 분리 규칙에 따라 분석 관련 상태를 정의한다:

| 상태 | 소유 슬라이스 | 설명 |
|------|-------------|------|
| 원본 매치 데이터 | 신규 `analysisSlice` | Riot API에서 가져온 매치 원본 |
| 재구성 보드 (SimulateOptions) | `analysisSlice` | matchAdapter가 변환한 시뮬 입력 |
| 수정본 보드 (What-if) | `teamSlice` 재활용 | 기존 SetupBoard 편집 흐름 그대로 사용 |
| 시뮬 결과 / 비교 결과 | `battleSlice` 재활용 | 기존 전투 결과 흐름 그대로 사용 |
| 정확도 등급 / 커버리지 상태 | `analysisSlice` | `supported` / `partial` / `unsupported` |

슬라이스 간 직접 참조 금지 — 필요 시 selector로 조합.

### 6.4 중앙 타입 정의

`src/types/analysis.ts`에 분석 전용 타입을 중앙 관리한다:

```ts
// 정확도 등급
type AnalysisConfidence = 'static' | 'estimated' | 'unsupported';

// 재현 불가 사유
type UnsupportedReason =
  | 'unsupported_champion'
  | 'unsupported_item'
  | 'not_set17';

// 매치 재구성 결과
interface MatchReconstructionResult {
  simulateOptions: SimulateOptions;
  confidence: AnalysisConfidence;
  unsupportedReasons: UnsupportedReason[];
  missingFields: string[];  // heuristic으로 보정한 필드 목록
}
```

### 6.5 신규 디렉토리 구조

```
src/lib/analysis/              # 신규 — 분석 전용 모듈 (순수 TS, UI 미의존)
├── matchAdapter.ts            # 전적 데이터 → SimulateOptions 변환 + heuristic 배치
├── coverageChecker.ts         # 엔진 커버리지 판정 + 패치 정합성 체크
├── synergyAnalyzer.ts         # 시너지 효율/충돌 정적 분석
├── itemAnalyzer.ts            # 아이템-챔피언 궁합 분석
└── defeatReport.ts            # 취약 요인 리포트 생성

src/components/analysis/   # 신규 — 분석 UI 컴포넌트
├── SynergyDiagnosis.tsx   # 시너지 진단 인라인 카드
├── DefeatReport.tsx       # 패배 원인 리포트 뷰
└── WhatIfComparison.tsx   # 원본 vs 수정본 비교 뷰
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section
- [x] ESLint configuration (React Compiler rules)
- [x] TypeScript configuration (`tsconfig.json`, strict mode)
- [x] 시뮬레이션 엔진 순수 TS 규칙

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| 분석 모듈 구조 | missing | `src/lib/analysis/` 내 파일 분리 규칙 | High |
| 어댑터 패턴 | missing | Riot API 데이터 ↔ 내부 타입 변환 규칙 | High |
| 분석 결과 타입 | missing | `src/types/analysis.ts` 정의 | Medium |

### 7.3 Environment Variables Needed

| Variable | Purpose | Scope | Status |
|----------|---------|-------|:------:|
| `RIOT_API_KEY` | Riot API 호출 | Server | ✅ 존재 |

---

## 8. Implementation Order

```
Phase 0 (데이터 계약 검증)        ← Spike — 이후 Phase 성립 여부 결정
  ├── Riot API 매치 데이터 → SimulateOptions 필드 매핑 문서화
  ├── lib/analysis/coverageChecker.ts   엔진 커버리지 + 패치 정합성
  └── reconstruction heuristic 설계 (Role 기반 배치 규칙)

Phase 1 (시너지 충돌 진단)        ← 시뮬레이션 없이 빠르게 가치 제공
  ├── types/analysis.ts           분석 전용 타입 중앙 정의
  ├── lib/analysis/synergyAnalyzer.ts
  ├── lib/analysis/itemAnalyzer.ts
  └── components/analysis/SynergyDiagnosis.tsx → lookup UI에 통합

Phase 2 (가상 대전 재구성 + 취약 요인 리포트)  ← 핵심 차별화
  ├── lib/analysis/matchAdapter.ts   전적 → SimulateOptions 변환 + heuristic 배치
  ├── lib/analysis/defeatReport.ts   CombatResult 파싱 → 취약 요인 리포트
  ├── components/analysis/DefeatReport.tsx (정확도 등급 표시 포함)
  ├── lookup UI에 "가상 대전" 버튼 추가 (미지원 매치는 비활성화)
  └── store/analysisSlice.ts       원본 매치 + 재구성 상태 관리

Phase 3 (What-if 시뮬레이션)      ← Phase 2 위에 인터랙션 추가
  ├── SetupBoard 컴포넌트 재사용 (배치/아이템 수정)
  ├── 재시뮬레이션 실행 로직
  └── components/analysis/WhatIfComparison.tsx
```

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`combat-analysis.design.md`)
2. [ ] Phase 1부터 구현 시작
3. [ ] Phase 1 완료 후 Gap 분석

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-17 | Initial draft | Dayoung |
| 0.2 | 2026-04-17 | Codex 리뷰 반영 — Phase 0 추가, Phase 2 목표 재정의, 리스크/상태관리/타입 보강 | Dayoung |
