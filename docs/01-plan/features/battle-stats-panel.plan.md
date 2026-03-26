# Plan: 전투 데미지 사이드바 + 챔피언 상세 스탯 패널

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | battle-stats-panel |
| 작성일 | 2026-03-26 |
| 예상 규모 | Medium (컴포넌트 3~4개 + 엔진 데이터 확장) |

### Value Delivered

| 관점 | 설명 |
|------|------|
| Problem | 전투 중 각 챔피언의 기여도와 최종 능력치를 확인할 수 없어 팀 분석이 어렵다 |
| Solution | 팀별 데미지 랭킹 사이드바 + 챔피언 클릭 시 상세 스탯 오버레이 |
| Function UX Effect | 전투 결과에서 바로 데미지 기여도 비교 가능, 아이템/시너지 효과를 수치로 검증 |
| Core Value | 팀 구성 최적화를 위한 정량적 데이터 제공 — 시뮬레이션 분석 도구의 핵심 가치 |

---

## 1. 배경 및 목적

현재 전투 시뮬레이션 결과 화면에서는 승패 결과와 리플레이만 확인 가능하다.
각 챔피언이 얼마나 데미지를 줬는지, 최종 능력치가 어떻게 계산되었는지 확인할 방법이 없다.

이 기능은 두 가지 패널을 추가한다:

1. **데미지 사이드바** — 팀별 데미지 랭킹을 실시간으로 보여줌
2. **챔피언 상세 스탯 패널** — 챔피언 클릭 시 아이템/시너지가 적용된 최종 능력치 표시

---

## 2. 기능 상세

### 2.1 데미지 사이드바 (DamageSidebar)

**위치**: 전투 시뮬레이션 화면 오른쪽

**구성**:
- 상단: A팀(Player) 데미지 랭킹
- 하단: B팀(Enemy) 데미지 랭킹
- 팀 구분선으로 시각적 분리

**각 챔피언 행**:
```
[챔피언 초상화(32x32)] [이름] ─── [데미지 수치]
[████████████████░░░░░░] (데미지 비율 바)
```

- 챔피언 이미지 (32x32) + 별 등급 표시
- 챔피언 이름
- 데미지 수치 (정수, 우측 정렬)
- 팀 내 최대 데미지 대비 비율 바 (물리: 빨강, 마법: 파랑, 트루: 흰색)
- **정렬**: 데미지 높은 순 (내림차순)

**데이터 소스**:
- `CombatResult.playerUnits` / `enemyUnits`의 `totalDamageDealt` 필드
- 리플레이 중: 현재 틱의 `TickSnapshot`에서 누적 데미지 계산 (로그 기반)

**상태 분기**:
- 전투 전 (idle): "전투를 시작하세요" 안내
- 전투 중/완료: 데미지 데이터 표시
- 사망한 챔피언: 흐리게(opacity) 처리 + 해골 아이콘

### 2.2 챔피언 상세 스탯 패널 (UnitDetailPanel)

**트리거**: 전투 화면 필드 위 챔피언 클릭 (ReplayBoard/SetupBoard)

**표시 위치**: 보드 하단 (고정 영역, 클릭 시 슬라이드업)

**핵심 능력치 7개** (아이템 + 시너지 + 증강 + 시간별 변동 모두 적용된 최종값):

| 스탯 | 키 | 비고 |
|------|-----|------|
| 공격력(AD) | `stats.damage` | 시너지/아이템 합산 |
| 주문력(AP) | `stats.ap` | 시간별 증가분 포함 (예: 대천사의 지팡이) |
| 피해증폭 | `damageAmp` | 시간별 증가분 포함 (예: 대마법사 시너지) |
| 방어력 | `stats.armor` | 시너지/아이템 합산 |
| 마법방어력 | `stats.magicResist` | 시너지/아이템 합산 |
| 공격속도 | `stats.attackSpeed` | 소수점 2자리 표시 |
| 치명타 확률 | `stats.critChance` | % 표시 |

**스탯 표시 형식**:
```
공격력    85   주문력    40   피해증폭  15%
방어력    45   마법저항  30   공격속도  0.85
치명타    25%
```
- 최종 수치를 크게 표시 (한 줄에 3개씩 그리드 배치)
- 기본값 대비 증가분이 있으면 초록색 수치, 감소분이 있으면 빨간색 수치

**시간별 변동 스탯 (중요)**:
전투 중 특정 아이템/시너지/증강 효과로 주문력, 피해증폭 등이 틱마다 변동될 수 있다.
- 대천사의 지팡이: 시간 경과에 따라 AP 증가
- 대마법사 시너지: 스킬 사용마다 AP 스택
- 기타 버프/디버프에 의한 일시적 능력치 변화

→ 리플레이 중에는 **해당 틱 시점의 stats**를 표시해야 하므로
`TickSnapshot`에 `stats` + `damageAmp` 등 특수 필드를 포함해야 한다 (3.4절 참조).

**데이터 소스**:
- 전투 전 (idle): `calculateStats()` (src/lib/simulator/systems/stat.ts) — StatBreakdown 포함
- 전투 중 (리플레이): `TickSnapshot.units[id].stats` + `.damageAmp` (틱별 스냅샷)
- 전투 후 (finished): `CombatResult.playerUnits/enemyUnits`의 `CombatUnit` 최종 상태

---

## 3. 기술 설계 방향

### 3.1 데이터 흐름

```
CombatResult
├── playerUnits[].totalDamageDealt → DamageSidebar (A팀)
├── enemyUnits[].totalDamageDealt  → DamageSidebar (B팀)
└── playerUnits/enemyUnits[].stats → UnitDetailPanel (클릭 시)

리플레이 중:
replaySlice.snapshots[currentTick] → 틱별 유닛 상태
combatResult.logs (attack/ability) → 누적 데미지 계산
```

### 3.2 컴포넌트 구조

```
src/components/battle/
├── DamageSidebar.tsx          # 데미지 랭킹 사이드바
│   └── DamageRow.tsx          # 개별 챔피언 데미지 행
├── UnitDetailPanel.tsx        # 챔피언 상세 스탯 패널
└── (기존) ReplayBoard.tsx     # 클릭 이벤트 추가
```

### 3.3 상태 관리

- `uiSlice.selectedUnitId` — 이미 존재. 클릭된 유닛 ID 저장
- `battleSlice` — `CombatResult` 참조하여 데미지/스탯 데이터 접근
- 새로운 state 추가 불필요 — 기존 슬라이스 조합으로 충분

### 3.4 TickSnapshot 확장 (리플레이 데미지 추적)

현재 `TickSnapshot.units`에는 `totalDamageDealt`가 포함되어 있지 않다.
리플레이 중 데미지 랭킹을 보여주려면 두 가지 접근 가능:

**방안 A (채택)**: TickSnapshot에 전투 스탯 필드 추가

TickSnapshot.units 각 항목에 다음 필드를 추가한다:

```ts
// TickSnapshot.units[id] 확장
{
  // 기존 필드 유지
  id, currentHp, currentMana, position, isAlive, shield, statusEffects,

  // 추가 필드
  totalDamageDealt: number;           // 누적 데미지 (데미지 사이드바용)
  stats: ChampionStats;               // 해당 틱의 최종 능력치 (스탯 패널용)
  damageAmp: number;                   // 피해증폭 (시간별 변동 반영)
  omnivamp: number;                    // 모든 피해 흡혈
  damageReduction: number;             // 피해감소
}
```

- 엔진 `combatLoop.ts`의 `captureSnapshot()`에서 `CombatUnit`의 현재 상태를 복사
- 시간별로 변동되는 스탯(AP 스택, 피해증폭 등)이 틱마다 정확히 기록됨
- 스냅샷 크기 증가는 미미 (유닛 최대 20개 × 필드 5개 추가)

### 3.5 CombatUnit 스탯 접근

전투 후 `CombatResult.playerUnits/enemyUnits`에 `CombatUnit` 배열이 이미 있으며,
각 유닛의 `stats: ChampionStats`와 `damageAmp`, `omnivamp`, `damageReduction` 등
모든 최종 능력치가 포함되어 있다. 별도 계산 로직 추가 불필요.

### 3.6 시간별 변동 스탯 추적

전투 중 일부 효과는 시간/이벤트에 따라 능력치를 동적으로 변경한다:

| 효과 | 변동 스탯 | 추적 방식 |
|------|----------|----------|
| 대천사의 지팡이 | AP 증가 | `CombatUnit.stats.ap`에 누적 반영됨 |
| 대마법사 시너지 | AP 스택 | 스킬 cast 시 `stats.ap` 직접 증가 |
| 피해증폭 버프 | damageAmp 증가 | `CombatUnit.damageAmp`에 반영 |
| 워모그 등 HP 회복 | currentHp 변화 | 이미 스냅샷에 포함 |

→ `captureSnapshot()`이 매 틱마다 `CombatUnit.stats`를 그대로 복사하므로
  시간별 변동은 자동으로 각 틱의 스냅샷에 반영된다.

---

## 4. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | TickSnapshot 타입에 `totalDamageDealt`, `stats`, `damageAmp` 등 추가 | `src/types/index.ts` |
| 2 | `captureSnapshot()`에서 CombatUnit 스탯/데미지 복사 | `src/lib/simulator/engine/combatLoop.ts` |
| 3 | DamageSidebar 컴포넌트 구현 (팀별 데미지 랭킹) | `src/components/battle/DamageSidebar.tsx` |
| 4 | UnitDetailPanel 컴포넌트 구현 (7개 핵심 스탯) | `src/components/battle/UnitDetailPanel.tsx` |
| 5 | ReplayBoard 유닛 클릭 → selectedUnitId 연결 | `src/components/battle/ReplayBoard.tsx` |
| 6 | Simulator 페이지에 사이드바(우측) + 스탯패널(하단) 통합 | `src/app/simulator/page.tsx` |

---

## 5. 제약사항 및 결정

- **성능**: DamageSidebar는 리플레이 틱 변경 시마다 리렌더링 — 챔피언 수 최대 10명이므로 부담 없음
- **반응형**: 사이드바는 `min-w-[240px]` 고정폭, 보드 영역은 나머지 flex
- **접근성**: 데미지 수치에 `aria-label` 추가
- **React Compiler**: `useEffect` 내 setState 금지 규칙 준수 — 데미지 데이터는 props/store에서 파생값으로 계산

---

## 6. MVP 범위

**포함**:
- [x] 팀별 데미지 랭킹 사이드바 (전투 완료 후)
- [x] 리플레이 중 틱별 데미지 업데이트
- [x] 챔피언 클릭 시 상세 스탯 표시 (최종 능력치)
- [x] 어빌리티 정보 표시

**제외 (추후)**:
- [ ] 데미지 타입별 분류 (물리/마법/트루 비율)
- [ ] 받은 데미지 랭킹
- [ ] 힐/쉴드 통계
- [ ] 시간별 데미지 그래프
