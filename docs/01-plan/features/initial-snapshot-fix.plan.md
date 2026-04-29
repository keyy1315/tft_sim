# Plan: 전투 초기 스냅샷 누락 수정

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 전투 초기 스냅샷 누락 수정 (initial-snapshot-fix) |
| 작성일 | 2026-04-22 |
| 작성자 | Dayoung |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 리플레이 스냅샷이 각 틱 처리 **이후** 상태만 기록하므로, tick 0 에 발생한 모든 상태 변화(이동/공격/스킬 등)가 관찰 불가. 사용자는 배치 직후의 모습을 단 한 프레임도 볼 수 없고, 첫 프레임이 이미 tick 0 적용 완료 상태라서 "이동 없이 적 근처에서 전투 시작"처럼 보이는 오인 증상 발생 |
| **Solution** | `combatLoop.ts` 메인 틱 루프 진입 직전에 초기 상태 스냅샷 1장을 미리 push. 기존 틱 인덱스/필드는 건드리지 않고 배열 앞에 "pre-combat" 스냅샷만 삽입하는 최소 침습 방식. 틱 재색인이라 부르지만 실제로는 한 줄 추가 |
| **Function UX Effect** | 리플레이 재생 시 사용자가 배치된 원본 위치를 첫 프레임에서 확인 가능. 이후 프레임에서 tick 0 의 이동/공격/돌진 시전이 자연스럽게 관찰됨. "텔레포트처럼 보이던" 여러 증상이 일괄 해소 |
| **Core Value** | 시뮬레이션 결정론은 그대로 유지하면서, **관찰 가능성(observability)** 만 복원. 디버깅과 사용자 신뢰도 모두 향상 |

---

## 1. 현재 상태 분석

### 1.1 스냅샷 수집 구조

`src/lib/simulator/engine/combatLoop.ts:1524-2285` 구조:

```ts
eventBus.emit('on_combat_start', { sourceId: '', tick: 0 });

for (let tick = 0; tick < MAX_TICKS; tick++) {
  // 상태 효과 tick / 마나 gain / 쿨다운 감소
  for (const unit of allUnits) {
    // 이동 / 공격 / 스킬 시전 — tick 0 부터 이미 수행됨
    unit.position = newPos;           // ← tick 0 에 position 변경
  }
  snapshots.push(captureSnapshot(tick, allUnits, tickLogs));  // ← 변경 후 저장
}
```

**핵심 문제**: 루프 진입 전 상태를 저장하는 경로가 없음. `snapshots[0]` 은 이미 tick 0 처리 후 상태.

### 1.2 시각화 동작

`src/components/battle/ReplayBoard.tsx:50` 은 `snapshot.units[id].position` 을 그대로 axialToOffset 으로 변환해 렌더. 프레임 간 보간 없음. 즉, "이동 전 → 이동 후" 전환을 보려면 두 프레임 모두가 스냅샷 배열에 있어야 함. 현재는 "이동 전" 프레임이 부재.

### 1.3 재현 시나리오

1. 플레이어 측 근접 유닛(공격 사거리 = 1)을 전방 1열 (display row 4, col 0~6) 배치
2. 적 유닛을 배치 거리 2 이상 위치(예: display row 2)에 배치
3. 전투 시뮬레이션 실행
4. 리플레이 첫 프레임에 유닛이 이미 한 칸 전진한 위치에 있음 → 사용자는 "이동 없이 텔레포트해서 시작"으로 인식

### 1.4 영향 범위

현재 tick 0 에 발생하지만 관찰 불가한 상태 변화:

| 경로 | 코드 위치 | 현상 |
|------|----------|------|
| 일반 이동 (비돌진) | `combatLoop.ts:2264-2270` | 배치 → 1칸 이동이 보이지 않음 |
| 사거리 밖 돌진 시전 (full mana + dash ability) | `combatLoop.ts:2157-2162` | 처음부터 적 옆에 붙어 있음 |
| 도전자 시너지 초기 돌진 | `combatLoop.ts:1665-1674` | 원인 불명 점프 |
| 최초 자동 공격 (initial cooldown rng = 0 + 사거리 내) | `combatLoop.ts:1678-1681` | 첫 프레임부터 이미 공격 진행 |
| 아이템 `on_combat_start` trigger 효과 (damageAmp, 보호막 등) | `items/definitions/anomaly.ts`, `stacking.ts` | 버프 적용 전 상태 미관찰 |

---

## 2. 범위 (Scope)

### 2.1 포함 (In Scope)

- [ ] `combatLoop.ts` 의 `simulateCombat` 함수에서 tick 루프 진입 직전 초기 스냅샷 1장 push
- [ ] 초기 스냅샷의 tick 필드 = `-1` (pre-combat 의미로 음수 사용)
- [ ] 프렐요드 포탑 등 루프 진입 전 spawn 된 유닛 포함 확인
- [ ] 중재자 법률 `combat_start_per_star` 효과(`combatLoop.ts:1472-1480`) **적용 후** 상태를 초기 스냅샷에 포함 여부 결정 → 적용 후로 통일 (사용자는 "전투 시작 시점의 버프 완료 상태"를 기대)
- [ ] BattleControls 의 "Tick N / M" / 시간 표시가 자연스럽게 재매핑되는지 확인
- [ ] 단위 테스트: 새 스냅샷 배열 길이 = `previous length + 1`, `snapshots[0].tick === -1`, `snapshots[0].units` 에 배치된 원본 position 그대로 존재

### 2.2 제외 (Out of Scope)

- `applyAbilityDash` 자체의 한 프레임 텔레포트 동작 — 실제 게임의 돌진도 0.3~0.5초에 완료되므로 유지
- 프레임 간 이동 보간 애니메이션 — 별도 기능으로 분리
- 결정론적 시뮬레이션 로직 변경 — 관찰 계층만 수정, 엔진 자체는 불변

---

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | 전투 시뮬레이션 결과의 `snapshots[0]` 은 **배치 완료 직후** 상태를 나타내야 한다 (tick 0 처리 이전) | High | Pending |
| FR-02 | `snapshots[1]` 이후는 기존 동작과 동일하게 tick N 처리 후 상태를 나타낸다 | High | Pending |
| FR-03 | 초기 스냅샷에는 `on_combat_start` / `combat_start_per_star` 으로 적용된 전투 시작 버프가 이미 반영되어 있어야 한다 (유닛은 "전투를 시작할 준비가 된 상태") | High | Pending |
| FR-04 | 프렐요드 포탑 등 사전 spawn 된 유닛도 초기 스냅샷에 포함 | Medium | Pending |
| FR-05 | 리플레이 컨트롤(재생/슬라이더/스텝) 이 새 길이에 자동 적응해야 한다 | High | Pending |

### 3.2 비기능 요구사항

| 카테고리 | 기준 | 검증 방법 |
|---------|------|----------|
| 결정론 | 동일 시드에서 동일 결과 | 기존 calibration 테스트 통과 |
| 성능 | 스냅샷 메모리 증가 ≤ 1개 × 유닛 데이터 | `snapshots.length` 검증 |
| 호환성 | `defeatReport`, `useCombatAnalysis` 등 기존 분석 경로 무영향 | `log.tick` 기반이므로 영향 없음 확인 |
| 타입 안정성 | `pnpm typecheck` 통과 | CI |
| 린트 | `pnpm lint` 통과 | CI |
| 빌드 | `pnpm build` 통과 | CI |

---

## 4. 성공 기준

### 4.1 Definition of Done

- [ ] `simulateCombat` 이 초기 스냅샷을 포함한 배열 반환
- [ ] 단위 테스트 추가 (tick 0 이전 상태 보존 검증)
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 세 단계 모두 통과
- [ ] 재현 시나리오(근접 유닛 front row + 적 row 2 배치) 에서 리플레이 첫 프레임이 배치 그대로 보이는지 수동 확인
- [ ] 기존 calibration 테스트(`tests/calibration/*`) 전부 통과

### 4.2 품질 기준

- [ ] `eslint-disable` 주석 추가 금지 — React Compiler 규칙 유지
- [ ] `console.log` 추가 금지
- [ ] 엔진 로직 순수성 유지 (UI 의존 없음)
- [ ] Math.random() 직접 사용 없음 (seed RNG 유지)

---

## 5. 리스크와 완화

| 리스크 | 영향 | 가능성 | 완화 방안 |
|-------|------|------|----------|
| `BattleControls` 의 "Tick N / M" 표시가 0 기준에서 어긋남 | Low | Low | `snapshots.length` 로 자동 재매핑됨. 수동 확인 후 필요 시 라벨만 "Frame" 으로 변경 |
| 시간 표시(`currentTick / TICKS_PER_SECOND`) 가 초기 스냅샷에서 음수 값 노출 | Low | Medium | BattleControls 에서 `Math.max(0, currentTick)` 가드 추가 |
| defeatReport 의 `deathTick` 계산이 어긋남 | Medium | Very Low | 해당 경로는 `log.tick` 기반이라 snapshot 인덱스와 독립. 코드 확인 완료 |
| 스냅샷 직렬화 크기 증가 (상태 저장/복원 시) | Low | Low | 스냅샷 1개 추가분이라 무시 가능 |
| 멀티 시뮬레이션(N=100 `runMultiple`) 누적 메모리 증가 | Low | Low | 최종 스냅샷만 보존하거나 길이 기반 계산. 현재 코드가 `lastResult` 만 보존하므로 영향 없음 |
| 리플레이 auto-play 가 초기 스냅샷을 건너뛰고 바로 재생 | Medium | Low | `replayTick` 초기값 `0` 유지 — 초기 스냅샷이 index 0 이므로 정상 표시됨 |

---

## 6. 아키텍처 결정

### 6.1 구현 옵션 비교

| 옵션 | 설명 | 장점 | 단점 | 선택 |
|------|------|------|------|:----:|
| A. 초기 스냅샷 1장 push | 루프 진입 전 `snapshots.push(captureSnapshot(-1, ...))` 만 추가 | 최소 침습. 기존 로직/인덱스/tick 번호 모두 유지 | `snapshot.tick = -1` 이라는 특수값 등장 | ✅ |
| B. 전체 틱 재색인 (+1 shift) | 기존 tick N 을 N+1 로 매핑, `snapshot[0]` 을 초기 상태로 | 의미적으로 깔끔 | `event.tick`, `log.tick`, `ctx.tick` 등 전 영역 재매핑 필요. 버그 위험 ↑ | ❌ |
| C. 렌더링 레이어에서 첫 프레임만 특수 처리 | ReplayBoard 에서 `replayTick === 0` 일 때 `placed.position` 을 직접 사용 | 엔진 불변 | 렌더링 레이어가 엔진 placement 를 알아야 함 — 분리 원칙 위배 | ❌ |

**결정**: 옵션 A. 이유는 `CLAUDE.md` 의 "시뮬레이션 엔진은 UI 레이어와 완전히 분리" 원칙 준수 + 회귀 위험 최소화.

### 6.2 `snapshot.tick` 필드 정책

- `-1` = pre-combat (배치 직후, tick 0 처리 이전)
- `0..N` = 기존과 동일 (tick N 처리 후)
- `snapshot.events` 배열 = 초기 스냅샷은 빈 배열 (`[]`)

외부 소비자 영향 확인:
- `BattleControls.tsx:30-32`: `currentTick / TICKS_PER_SECOND`. `Math.max(0, currentTick)` 가드 추가 권장
- `replayEngine.ts:83-87` seek / step: `snapshots.length - 1` 경계라 자동 적응
- `useCombatAnalysis.ts`, `defeatReport.ts`: `log.tick` 기반이라 무관

---

## 7. 변경 대상 파일

| 파일 | 변경 내용 | 라인 |
|------|----------|------|
| `src/lib/simulator/engine/combatLoop.ts` | 초기 스냅샷 push 1줄 추가 | `1524` 뒤 |
| `src/components/battle/BattleControls.tsx` | 시간 표시 가드 (`Math.max(0, ...)`) | `30-32` |
| `tests/unit/combatLoop.test.ts` (신규 or 기존) | 초기 스냅샷 검증 테스트 추가 | — |

---

## 8. 구현 개요 (Design 단계에서 상세화)

### 8.1 핵심 패치

```ts
// combatLoop.ts — `on_combat_start` emit 직후, 메인 루프 직전
eventBus.emit('on_combat_start', { sourceId: '', tick: 0 });

// [NEW] 초기 배치 스냅샷 — tick 0 처리 전 원본 position 보존
snapshots.push(captureSnapshot(-1, allUnits, []));

for (let tick = 0; tick < MAX_TICKS; tick++) {
  // ... 기존 로직 유지 ...
  snapshots.push(captureSnapshot(tick, allUnits, tickLogs));
}
```

### 8.2 선결 과제

- `captureSnapshot` 의 tick 파라미터가 음수를 받아도 TickSnapshot 타입이 허용하는지 확인 (`src/lib/simulator/engine/replayEngine.ts:10-14` 에서 `tick: number` 이므로 OK)
- `TickSnapshot` 소비자 중 `tick >= 0` 를 가정하는 코드 없는지 grep 확인 완료 (`snapshot.tick` 은 외부 거의 미사용)

---

## 9. 다음 단계

1. [ ] Design 문서 작성 (`initial-snapshot-fix.design.md`) — 테스트 케이스, 회귀 시나리오 상세화
2. [ ] Do: 패치 구현 + 테스트
3. [ ] Check: Gap 분석으로 Match Rate 확인
4. [ ] Act: Report 작성 (성공 시 기존 텔레포트 관련 이슈 해소 내역 기록)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-22 | Initial draft | Dayoung |
