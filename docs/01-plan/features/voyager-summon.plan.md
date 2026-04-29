# Plan: 길잡이 시너지 — 비아와 바이엔 소환

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 길잡이(Voyager) 시너지 소환 + 아타칸 로직 삭제 |
| 작성일 | 2026-04-17 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 길잡이 3/5 활성 시 비아와 바이엔이 보드에 나타나야 하지만 미구현. Set 16 아타칸 로직은 사용하지 않으므로 삭제 필요 |
| **Solution** | 시너지 계산 시 길잡이 3+ 달성 → 편집 탭 보드에 TFT17_Summon 자동 배치, 유저 드래그 이동 가능, 아이템 장착 불가 |
| **Function UX Effect** | 3길잡이 달성 시 보드에 비아바이엔이 나타나고, 다른 챔피언처럼 자유롭게 배치 가능. 전투에서 AP탱커로 참전 |
| **Core Value** | 길잡이 시너지의 핵심 메커닉을 정확하게 재현 |

---

## 1. 게임 메커닉

### 1.1 길잡이 시너지 단계

| 단계 | 유닛 수 | 효과 |
|------|---------|------|
| (1) | 3 | 비아 소환 (비아와 바이엔 기물 등장) |
| (2) | 5 | 바이엔 추가 → 결속 강화 (스탯 강화) |

### 1.2 비아와 바이엔 (TFT17_Summon)

- cost: 11 (특수 유닛, 상점 등장 불가)
- role: APTank
- HP: 320, AD: 20, AS: 0.6, Range: 1
- 능력: 울음소리 — AA 추가 마법 피해 + 보호막 + 아군 AP 버프
- **아이템 장착 불가**
- 위력: 길잡이 챔피언 별레벨 총합에 비례

### 1.3 동작 흐름

```
[편집 탭]
  길잡이 유닛 배치 → 시너지 계산
    ├─ 길잡이 >= 3 → 비아와 바이엔 보드에 자동 추가 (빈 헥스)
    │   └─ 유저가 자유롭게 드래그 이동 가능
    │   └─ 아이템 드래그 시 장착 거부
    └─ 길잡이 < 3 → 비아와 바이엔 보드에서 자동 제거

[전투]
  비아와 바이엔이 일반 유닛처럼 전투 참전
  role=APTank → Tank 마나 규칙 적용 (공격당 5, 피격 시 획득)
```

---

## 2. 구현 범위

### 2.1 삭제: 아타칸 소환 로직

`src/lib/simulator/engine/combatLoop.ts`에서 제거:
- `trySpawnNoxusAtakhan()` 함수
- `playerAtakhanFlag`, `enemyAtakhanFlag` 변수
- 매 틱 소환 체크 코드

### 2.2 편집 탭 — 시너지 트리거 배치

시너지 계산 로직 (teamSlice 또는 시너지 계산 함수)에서:
1. 길잡이 활성 유닛 수 >= 3 감지
2. 보드에 TFT17_Summon이 아직 없으면 → 빈 헥스에 자동 배치
3. 길잡이 < 3으로 떨어지면 → TFT17_Summon 자동 제거
4. TFT17_Summon은 `isSummon: true` 플래그로 구분

### 2.3 배치 규칙

- 유저가 드래그로 자유롭게 위치 변경 가능 (다른 챔피언과 동일)
- 유저가 직접 보드에서 제거 불가 (시너지가 유지되는 한)
- 아이템 장착 시도 → 거부 (드래그 무시 또는 경고)
- 팀 유닛 수 카운트에 포함되지 않음 (벤치 슬롯 차지 안 함)

### 2.4 전투 참전

기존 전투 로직에서 보드 위 유닛으로 그대로 참전:
- `CombatUnit`으로 변환 시 기존 로직 재사용
- 스탯: 길잡이 별레벨 합산으로 스케일링
- 스킬: 보호막 + 아군 AP 버프 (단순 self_buff 패턴)

### 2.5 스탯 스케일링

길잡이 챔피언 별레벨 총합 → 비아바이엔 위력:

```ts
const voyagerStarSum = voyagerChampions.reduce((sum, u) => sum + u.starLevel, 0);
// ability.variables에서 스케일링 계수 적용
const aaDamage = [0, 50, 80, 140][clamp(voyagerStarSum / 3, 1, 3)];
const shield = [0, 125, 300, 300][clamp(voyagerStarSum / 3, 1, 3)];
```

---

## 3. 수정 파일

| 파일 | 변경 |
|------|------|
| `src/lib/simulator/engine/combatLoop.ts` | 아타칸 로직 삭제 |
| `src/store/teamSlice.ts` (또는 시너지 계산) | 길잡이 3+ 감지 → TFT17_Summon 자동 배치/제거 |
| `src/components/battle/SetupBoard.tsx` | 소환 유닛 드래그 허용, 아이템 장착 거부 |
| `src/types/index.ts` | PlacedChampion에 `isSummon` 플래그 추가 |

---

## 4. 선행 작업

- **lookup-enhancement Plan** 완료 후 진행 권장
- 비아바이엔 아이콘이 로컬에 있어야 함 (lookup-enhancement에서 다운로드)
