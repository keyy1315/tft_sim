# Plan: 애니 티버 자동 소환

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 애니가 전투에 참여해도 티버가 소환되지 않아 실제 게임과 시뮬레이션 결과가 크게 다르다 |
| **Solution** | 전투 시작 시 애니가 팀에 있으면 티버(TFT16_AnnieTibbers)를 자동으로 빈 칸에 소환 |
| **Function UX Effect** | 사용자가 별도 조작 없이 애니 배치만으로 티버가 전투에 함께 참여 |
| **Core Value** | 애니의 실제 전투력을 정확히 반영하여 시뮬레이션 정확도 향상 |

---

## 1. 기능 정의

### 1.1 목표
- 전투 시뮬레이션 시작 시, 팀에 애니(`TFT16_Annie`)가 있으면 티버(`TFT16_AnnieTibbers`)를 자동으로 소환
- 티버는 애니 인접 빈 칸에 배치
- 티버의 스탯은 `tft_set16_champions.json`의 `TFT16_AnnieTibbers` 데이터를 사용
- 티버의 성급은 애니의 성급을 따름

### 1.2 데이터 확인 결과

**티버 챔피언 데이터**: `TFT16_AnnieTibbers` (JSON에 존재)
- cost: 11 (소환수 특수값)
- traits: ["비전 마법사"]
- role: APTank
- stats: HP 1500, armor 80, MR 80, AD 90, AS 0.75, range 1

**티버 아이콘**: `public/data/images/tft_set16_champions/tft16_annietibbers_square.tft_set16.png` (존재 확인)

**애니 스킬 데이터**: "분노의 지옥불" — 전체 불태우기/상처 적용 (티버 소환은 스킬 데이터에 명시되지 않음, 별도 메커니즘)

### 1.3 제약
- 티버는 사용자가 직접 배치하는 유닛이 아님 (챔피언 풀에 노출 X)
- 전투 엔진에서만 자동 생성 (setup UI에는 표시하지 않음)
- 리플레이에서는 티버가 전투 유닛으로 보임

---

## 2. 구현 범위

### 2.1 수정 파일

| 파일 | 변경 |
|------|------|
| `src/lib/simulator/engine/combatLoop.ts` | `spawnAnnieTibbers()` 함수 추가, `simulateCombat` 시작 부분에서 호출 |
| `src/data/loader.ts` | `loadAllChampions()` 활용하여 티버 데이터 접근 (이미 존재) |

### 2.2 변경 없는 파일
- `src/data/imageMap.ts` — `getChampionImage('TFT16_AnnieTibbers')` 이미 정상 작동
- `src/components/` — UI 변경 없음
- `src/types/` — 기존 CombatUnit 타입 재사용

---

## 3. 핵심 로직

### 3.1 소환 조건
```
전투 시작 시:
  for each team (player, enemy):
    if team에 TFT16_Annie가 있다면:
      티버 데이터를 champions JSON에서 로드
      애니 인접 빈 칸에 티버 CombatUnit 생성
      티버 성급 = 애니 성급
      전투 유닛 목록에 추가
```

### 3.2 배치 위치
- 애니 위치 기준 인접 hex 중 빈 칸 (아군 영역 내)
- 우선순위: 애니 앞(적 방향) > 옆 > 뒤
- 빈 칸이 없으면 팀 영역 내 아무 빈 칸

### 3.3 티버 스탯
- 기본 스탯: `TFT16_AnnieTibbers`의 stats 값 사용
- 성급 스케일링: 애니와 동일 성급 적용 (STAR_SCALING 배율)
- 아이템: 없음
- 시너지: 비전 마법사 trait는 이미 팀 시너지에 포함되지 않음 (소환수는 별도)

### 3.4 기존 패턴 참조
프렐요드 포탑 소환 (`spawnFreljordTurrets`)과 동일한 패턴:
- `simulateCombat` 시작 부분에서 호출
- 빈 칸 탐색 → CombatUnit 생성 → 유닛 목록에 추가

---

## 4. 구현 순서

1. `combatLoop.ts`에 `spawnAnnieTibbers()` 함수 작성
2. `simulateCombat`의 프렐요드 포탑 소환 직후에 티버 소환 호출
3. 티버 데이터는 `champions` 파라미터로 전달 (또는 하드코딩 fallback)
4. 빌드 검증: `pnpm typecheck && pnpm build`

---

## 5. 검증 체크리스트

- [ ] 애니가 TEAM A에 있을 때 전투 시작 시 티버 자동 소환
- [ ] 애니가 TEAM B에 있을 때도 동일 동작
- [ ] 양 팀 모두 애니가 있으면 각각 티버 소환
- [ ] 티버 성급이 애니 성급을 따름
- [ ] 리플레이에서 티버 아이콘 정상 표시
- [ ] 애니가 없으면 티버 소환 안 됨
- [ ] `pnpm typecheck && pnpm build` 통과
