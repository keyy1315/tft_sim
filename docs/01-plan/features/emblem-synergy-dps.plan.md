# emblem-synergy-dps Planning Document

> **Summary**: 상징 아이템 재분배 시 시너지 보너스 변화까지 DPS 계산에 반영
>
> **Project**: TFT Combat Simulator
> **Author**: Dayoung
> **Date**: 2026-04-17
> **Status**: Draft

---

## 개요

`src/lib/analysis/itemOptimizer.ts`에서 상징 아이템 재분배 시, 상징이 부여하는 시너지로 인한
팀 전체 trait 보너스 변화까지 DPS 계산에 반영해야 함.

## 현재 상태

- 상징 아이템이 딜 아이템 풀에 포함됨 (isDamageItem에 해당하는 상징만)
- 해당 시너지를 이미 가진 유닛에게 상징 장착 불가 제약 구현됨
- **상징 기본 스탯(AD, AS 등)만 DPS에 반영됨**

## 미구현 사항

상징이 추가한 시너지로 인한 `resolveTraits` 결과 변화가 DPS에 반영되지 않음.

### 예시

별돌보미 상징을 비별돌보미 유닛에게 줬을 때:
1. 별돌보미 시너지 유닛 수 +1
2. 다음 시너지 티어 달성 가능
3. 팀 전체 스탯 보너스 변화 (AP, AS 등)
4. 이 변화가 DPS에 반영되어야 함

현재는 상징의 기본 스탯(예: Health +250)만 반영되고, 시너지 활성화 효과는 무시됨.

## 구현 방법

1. **상징 → 부여 시너지 매핑**: 아이템 이름에서 "상징" 제거하여 시너지 이름 추출 (이미 `getEmblemTraitName` 구현됨)
2. **calcDps 수정**: 상징이 포함된 아이템 세트로 DPS 계산 시:
   - 상징이 부여하는 시너지를 해당 유닛의 traits에 임시 추가
   - `resolveTraits` 재실행하여 새로운 activeTraits 산출
   - 재실행된 trait 결과로 `calculateStats` → `estimateDps`
3. **성능**: 상징은 보통 1-2개이므로 `resolveTraits` 재실행 횟수가 적어 성능 문제 없음

## 영향 범위

| 파일 | 변경 |
|------|------|
| `src/lib/analysis/itemOptimizer.ts` | `calcDps` 함수에 상징 감지 → resolveTraits 재계산 분기 |
| `src/lib/analysis/coverageChecker.ts` | `getEmblemTraitName` 이미 구현됨 (재활용) |

## 우선순위

Medium — 상징이 포함된 재분배 추천의 정확도에 직접 영향. 독립적으로 구현 가능 (엔진 수정 불필요).

## 관련 문서

- 전투 분석 기능: `combat-analysis.plan.md`
- 아이템 최적화: `itemOptimizer.ts`
