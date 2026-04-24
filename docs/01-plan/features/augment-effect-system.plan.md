# Plan: 증강 효과 적용 시스템 (능력치/훈련봇/칸 버프)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 증강 선택 시 능력치가 전투에 미반영, 훈련봇 증강 시 필드에 훈련봇 미배치, 칸 버프 증강의 위치별 효과 미표시 |
| **Solution** | resolveAugmentEffects에서 79개 증강 효과 전투 반영 + 훈련봇 자동 배치 + 칸 버프 시각화 및 위치별 능력치 적용 |
| **Function UX Effect** | 증강 선택만으로 전투 결과가 즉시 변화, 훈련봇이 보드에 표시, 강화 칸이 시각적으로 구별됨 |
| **Core Value** | 실제 게임 상태 완전 재현 → 증강 포함 팀 편성 최적화 지원 |

---

## 1. 기능 범위

### 1.1 증강 능력치 → 전투 반영
- 79개 증강 선택 시 effects 데이터 기반으로 resolveAugmentEffects/resolvePerUnitMods에서 스탯 계산
- 이미 augment.ts에 30+ effect key 처리 로직 존재 — Set 17 증강에 맞게 보강

### 1.2 훈련봇 증강 → 필드 자동 배치

| 증강 | 훈련봇 | 특수 효과 |
|------|--------|----------|
| **탑** | 거대 훈련봇 (스테이지별 체력 증가) | 4초마다 적 3명에게 최대체력 5% 고정 피해 |
| **훈련 봇 변환** | 팀 체력 60%의 훈련봇 | 스테이지마다 체력 +1000 |
| **충돌 시험용 봇** | 훈련봇 2개 | 전투 시작 시 적 무리로 돌진 + 1초 기절 |

**훈련봇 기본 스탯** (CDragon `TFT_TrainingDummy`):
- HP: 550, AD: 50, AS: 0.5, Armor: 40, MR: 40, Range: 1
- 아이템 장착 불가, 특성 없음

### 1.3 칸 버프 증강 → 보드 표시 + 능력치 적용

#### A. 이동 가능한 칸 (사용자가 위치 선택)

| 증강 | 효과 | 칸 수 |
|------|------|-------|
| **야스오의 황금 칸** | 체력 +250, AS +25%, 처치 시 +1골드 | 1칸 |

#### B. 고정 위치 칸 (표시만, 이동 불가)

| 증강 | 위치 | 효과 |
|------|------|------|
| **중심 잡기** | 전방 1열 중앙 (row 4, col 3) | 피해 증폭 +15%, 최대 체력 +25% |
| **유리 대포 I/II** | 후방 1열 (row 7) | 체력 80%, 피해 증폭 +16%/25% |
| **정렬** | 전방 2열 유닛 수 비례 | 유닛당 방어력/마저 +2 |
| **권투 교습** | 전방 유닛 수 비례 | 유닛당 체력 +30 |
| **진형 유지** | 후방 2열 | 전방 유닛당 AP +10%, AD +9% |
| **부식** | 전방 2열 적 | 2초마다 방어력/마저 -4 |
| **쌍둥이 수호자** | 전방 정확히 2명 | 체력 +100, AR +45, MR +45 |
| **후방 지원** | 후방 2열 4명 이상 시 | AS +12% |

---

## 2. 기술 설계

### 2.1 훈련봇 자동 배치

```typescript
// useTeamManagement에서 증강 추가 시
handleAddAugment(team, aug) {
  // 기존 로직...
  
  // 훈련봇 증강이면 자동 배치
  if (isDummyAugment(aug)) {
    const dummy = createDummyFromAugment(aug, team);
    updateTeam(prev => [...prev, dummy]);
  }
}
```

PlacedChampion으로 훈련봇 생성:
- `champion`: TFT_TrainingDummy 데이터
- `items`: [] (장착 불가)
- `isDummy`: true (새 필드 — 아이템 장착/별 변경 차단)

### 2.2 칸 버프 시스템

```typescript
interface HexBuff {
  augmentApiName: string;
  position: HexCoord;      // 칸 위치
  movable: boolean;        // 이동 가능 여부
  effects: {               // 해당 칸 유닛에 적용할 효과
    hp?: number;
    attackSpeed?: number;
    damageAmp?: number;
    // ...
  };
  color: string;           // 보드 표시 색상
}
```

- `useTeamManagement`에 `playerHexBuffs: HexBuff[]` 상태 추가
- 증강 추가 시 해당 칸 버프 자동 생성
- `SetupBoard`에서 버프 칸을 색상으로 표시
- `combatLoop`에서 유닛 위치와 버프 칸 매칭 → 능력치 적용

### 2.3 보드 시각화

SetupBoard SVG에서:
- 이동 가능 칸: 금색 테두리 + 드래그 가능
- 고정 칸: 반투명 오버레이 + 효과 라벨

---

## 3. 수정 파일 목록

| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/types/index.ts` | HexBuff 타입, PlacedChampion.isDummy |
| 2 | `src/data/augmentHexBuffs.ts` | **신규** — 칸 버프 증강 설정 데이터 |
| 3 | `src/hooks/useTeamManagement.ts` | 훈련봇 자동 배치 + hexBuffs 상태 + 이동 핸들러 |
| 4 | `src/components/battle/SetupBoard.tsx` | 버프 칸 시각화 (색상/라벨) |
| 5 | `src/components/builder/SelectedUnitPanel.tsx` | isDummy면 아이템/별 UI 숨김 |
| 6 | `src/lib/simulator/engine/combatLoop.ts` | 칸 버프 → CombatUnit 스탯 적용 |
| 7 | `src/lib/simulator/systems/augment.ts` | resolveAugmentEffects 보강 |

---

## 4. 구현 순서

### Phase 1: 증강 능력치 → 전투 반영
1. resolveAugmentEffects에서 79개 증강의 effects 처리 검증
2. 누락된 effect key 추가

### Phase 2: 훈련봇 자동 배치
3. PlacedChampion.isDummy 필드 추가
4. 훈련봇 증강 선택 시 자동 배치 + 스탯 계산
5. SelectedUnitPanel에서 isDummy 시 아이템/별 차단

### Phase 3: 칸 버프 시스템
6. HexBuff 타입 + augmentHexBuffs.ts 설정 데이터
7. useTeamManagement에 hexBuffs 상태
8. SetupBoard에 버프 칸 시각화
9. combatLoop에서 칸 버프 → 유닛 스탯 적용
10. 야스오 황금 칸 이동 가능 구현

---

## 5. 테스트 시나리오

- [ ] "탑" 증강 선택 → 훈련봇이 필드에 자동 배치, 아이템 장착 불가
- [ ] "훈련 봇 변환" 선택 → 기존 팀 체력 60% 훈련봇 생성
- [ ] "야스오의 황금 칸" 선택 → 금색 칸 표시, 드래그로 위치 이동 가능
- [ ] 황금 칸에 챔피언 배치 → HP +250, AS +25% 적용
- [ ] "중심 잡기" 선택 → 전방 1열 중앙 칸 고정 표시
- [ ] 중심 잡기 칸에 챔피언 → 피해 증폭 +15%, 최대 체력 +25%
- [ ] "유리 대포 II" 선택 → 후방 1열 칸 표시, HP 80% + 피해증폭 25%
- [ ] 증강 제거 → 훈련봇/칸 버프 자동 제거

---

*Created: 2026-04-15*
*Feature: augment-effect-system*
*Phase: Plan*
