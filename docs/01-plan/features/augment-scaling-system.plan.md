# Plan: 증강 스케일링 & 챔피언 스킬 변경 시스템

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 영구 스케일링 챔피언(이즈리얼/초가스)의 누적 스탯 반영 불가, 캐리 증강 선택 시 스킬 변경 미적용, 버프 증강의 능력치가 전투에 미반영 |
| **Solution** | 챔피언 상세 패널에 영구 스택 입력 UI 추가, 캐리 증강 선택 시 AbilityConfig 오버라이드, 버프 증강 효과를 resolveAugmentEffects에 통합 |
| **Function UX Effect** | 실제 게임 중반~후반 상태를 시뮬레이터에 재현 가능 → 시뮬레이션 정확도 대폭 향상 |
| **Core Value** | 게임 상태 충실 재현을 통한 시뮬레이션 신뢰도 확보 |

---

## 1. 기능 개요

### 1.1 영구 스케일링 챔피언 스택 입력
- **대상 챔피언**: 이즈리얼(드론 수), 초가스(추가 체력)
- **동작**: 해당 챔피언을 보드에 배치 후 선택하면 SelectedUnitPanel에 스택 입력 필드 표시
- **전투 반영**: 입력된 스택값이 CombatUnit 생성 시 스탯에 반영

### 1.2 캐리 증강 → 챔피언 스킬 변경
- **대상 증강**: 꽁!(나서스), 별빛 연계(아트록스), 정령단 속도(뽀삐), 방패 여전사(레오나), 빅뱅(꼬마정령), 저 별을 향해(잭스), 청부 살인마(파이크), 뜨거운 죽음(모데카이저), 자폭(그라가스), 침략자 제드(제드)
- **동작**: 증강 선택 시 해당 챔피언의 AbilityConfig + parseAbility 오버라이드
- **영구 스케일링**: 변경된 스킬이 영구 스택을 가질 경우(꽁! 나서스 등), 증강 상세 팝업에서 스택 입력

### 1.3 버프 증강 → 능력치 적용
- **대상 증강**: 저격수의 은신처, 은하계 여행, 이블린의 은총, 소라카의 은총, 아리의 은총
- **동작**: 증강 선택 시 effects 데이터 기반으로 resolveAugmentEffects에서 스탯 계산 → 전투 시뮬레이션에 반영
- **현재 상태**: resolveAugmentEffects가 이미 30+ effect key를 처리하므로, 누락된 Set 17 증강 효과만 추가

---

## 2. 기술 설계

### 2.1 데이터 모델

#### PlacedChampion 확장
```typescript
interface PlacedChampion {
  // 기존 필드...
  permanentStacks?: {
    type: 'ezreal_drones' | 'chogath_hp' | 'nasus_kills'; 
    value: number;
  };
}
```

#### 캐리 증강 설정 (신규 파일)
```typescript
// src/data/carryAugments.ts
interface CarryAugmentConfig {
  augmentApiName: string;
  targetChampion: string;          // 대상 챔피언 apiName
  abilityOverride: AbilityConfig;  // 스킬 패턴 교체
  statOverride?: Partial<ChampionStats>; // 스탯 변경 (예: 사거리)
  scalingInput?: {                 // 영구 스케일링 입력
    type: string;
    label: string;
    unit: string;
    effect: (value: number) => Partial<ChampionStats>;
  };
}
```

### 2.2 구현 순서

#### Phase 1: 영구 스케일링 입력 (챔피언 기본 스킬)
1. `PlacedChampion`에 `permanentStacks` 필드 추가
2. `SelectedUnitPanel`에 이즈리얼/초가스 전용 스택 입력 UI
3. `combatLoop.ts`의 `createCombatUnit`에서 스택값 → 스탯 반영
   - 이즈리얼: 드론 수 → 스킬 사용 시 추가 피해 (드론 수 × 드론 피해량)
   - 초가스: 추가 체력 → maxHP에 직접 가산

#### Phase 2: 캐리 증강 스킬 변경
1. `src/data/carryAugments.ts` 생성 — 10개 캐리 증강 설정
2. `combatLoop.ts`에서 CombatUnit 생성 시 증강 체크 → AbilityConfig 교체
3. `AugmentDetailPopup`에 캐리 증강 전용 스택 입력 UI
   - 꽁!(나서스): 처치 수 입력 → 스킬 피해량 스케일링

#### Phase 3: 버프 증강 능력치 적용
1. `resolveAugmentEffects`에 Set 17 증강 effect key 매핑 추가
2. 조건부 증강 처리 (저격수의 은신처: 같은 칸 유지 라운드 수 입력)
3. 동적 증강 처리 (은하계 여행: 새 상대 수 입력)

### 2.3 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/types/index.ts` | PlacedChampion.permanentStacks 타입 추가 |
| `src/data/carryAugments.ts` | **신규** — 10개 캐리 증강 설정 데이터 |
| `src/components/builder/SelectedUnitPanel.tsx` | 영구 스택 입력 UI (이즈리얼/초가스) |
| `src/components/builder/AugmentDetailPopup.tsx` | 캐리 증강 스택 입력 + 스킬 변경 미리보기 |
| `src/lib/simulator/systems/ability.ts` | 캐리 증강 AbilityConfig 오버라이드 로직 |
| `src/lib/simulator/systems/augment.ts` | Set 17 버프 증강 effect 처리 추가 |
| `src/lib/simulator/engine/combatLoop.ts` | 영구 스택 → CombatUnit 스탯 반영 |
| `src/hooks/useTeamManagement.ts` | permanentStacks 상태 관리 핸들러 |

---

## 3. 상세 스펙

### 3.1 영구 스케일링 챔피언

| 챔피언 | 입력 항목 | 라벨 | 전투 반영 |
|--------|----------|------|----------|
| 이즈리얼 | 처치 관여 수 | "처치 관여" | 3회당 드론 1개, 드론당 스킬 사용 시 추가 물리 피해 |
| 초가스 | 추가 체력 | "추가 체력" | maxHP에 직접 가산 (영구 스택 표시: "+{value}") |

### 3.2 캐리 증강 → 스킬 변경

| 증강 | 챔피언 | 변경된 스킬 패턴 | 사거리 변경 | 영구 스케일링 |
|------|--------|----------------|-----------|-------------|
| 꽁! | 나서스 | single → single (AD 기반, 처치마다 강화) | 유지 | 처치 수 입력 |
| 별빛 연계 | 아트록스 | single → multi (3방식 순환) | 유지 | 없음 |
| 정령단 속도 | 뽀삐 | aoe_circle → multi (원거리 발사) | 1→4 | 없음 |
| 방패 여전사 | 레오나 | single+stun → line+dash+stun | 유지 | 없음 |
| 빅뱅 | 꼬마정령 | aoe_circle → aoe_circle r=3+dash | 유지 | 없음 |
| 저 별을 향해 | 잭스 | aoe_circle+stun → self_buff (AS 중첩) | 유지 | 없음 |
| 청부 살인마 | 파이크 | aoe_circle+dash → single+dash (처치 초기화) | 유지 | 처치 수 입력 |
| 뜨거운 죽음 | 모데카이저 | aoe_circle → aoe_circle r=2 (커지는 오라) | 유지 | 없음 |
| 자폭 | 그라가스 | aoe_circle → aoe_circle r=3 (자해 포함) | 유지 | 없음 |
| 침략자 제드 | 제드 | self_buff → self_buff (5코 AD 전사) | 유지 | 없음 |

### 3.3 버프 증강 → 능력치 적용

| 증강 | 효과 | 입력 필요 | 처리 방식 |
|------|------|----------|----------|
| 저격수의 은신처 | 전투당 피해 증폭 +8% (최대 32%) | 유지 라운드 수 | augmentStacks로 처리 (1~4) |
| 은하계 여행 | 여행자 HP/AD/AP, 새 상대마다 +10% | 새 상대 수 | augmentStacks로 처리 |
| 이블린의 은총 | 내구력 +10% | 없음 | resolveAugmentEffects |
| 소라카의 은총 | 잃은 체력당 HP | 잃은 체력 수 | augmentStacks로 처리 |
| 아리의 은총 | 레벨당 AD/AP +2% | 레벨 | augmentStacks로 처리 |

---

## 4. UI 설계

### 4.1 SelectedUnitPanel 영구 스택 입력
```
┌─────────────────────────────┐
│ 이즈리얼 (1코스트)    [제거] │
│ ★★                          │
│                              │
│ 영구 스택                     │
│ 처치 관여: [  12  ] [-][+]   │
│ → 드론 4개 (36 추가 피해)    │
│                              │
│ 아이템 (1/3)                 │
│ [무한] [+]                   │
└─────────────────────────────┘
```

### 4.2 AugmentDetailPopup 캐리 증강
```
┌─────────────────────────────┐
│ [아이콘] 꽁!                 │
│ 프리즘                       │
│                              │
│ 나서스를 획득합니다.          │
│ 공격력 전사로 변하며 적을     │
│ 처치할 때마다 강화되는        │
│ 단일 대상 스킬을 얻습니다.    │
│                              │
│ ─── 캐리 스케일링 ───        │
│ 처치 수: [  8  ] [-][+]      │
│ → 피해량 +40% 증가           │
│                              │
│ 중첩 수: [  1  ] [-][+]      │
└─────────────────────────────┘
```

---

## 5. 구현 우선순위

| 순서 | 작업 | 난이도 | 영향도 |
|------|------|--------|--------|
| 1 | 초가스 영구 체력 스택 입력 + 전투 반영 | 낮음 | 높음 |
| 2 | 이즈리얼 드론 스택 입력 + 전투 반영 | 중간 | 높음 |
| 3 | 버프 증강 능력치 적용 (5개) | 중간 | 높음 |
| 4 | 캐리 증강 AbilityConfig 오버라이드 (10개) | 높음 | 중간 |
| 5 | 캐리 증강 영구 스케일링 입력 (꽁!/청부) | 중간 | 낮음 |

---

## 6. 테스트 시나리오

| 시나리오 | 검증 항목 |
|---------|----------|
| 초가스 추가 체력 300 입력 → 전투 시작 | CombatUnit.stats.hp에 300 가산 확인 |
| 이즈리얼 처치 관여 12 입력 → 전투 | 드론 4개, 스킬 사용 시 드론 피해 추가 확인 |
| 꽁! 증강 + 나서스 배치 | 스킬이 단일 AD로 변경, 처치 수 입력 가능 |
| 정령단 속도 + 뽀삐 배치 | 사거리 4로 변경, 원거리 발사 패턴 |
| 저격수의 은신처 (4라운드) | 피해 증폭 32% 적용된 전투 데미지 확인 |
| 이블린의 은총 | 전체 아군 내구력 +10% 반영 확인 |

---

*Created: 2026-04-15*
*Feature: augment-scaling-system*
*Phase: Plan*
