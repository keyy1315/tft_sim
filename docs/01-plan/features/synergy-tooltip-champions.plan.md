# Plan: 시너지 툴팁에 해당 챔피언 목록 표시

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 시너지 툴팁에 효과 설명만 표시되고, 해당 시너지를 가진 챔피언이 누구인지 알 수 없음 |
| **Solution** | TraitTooltipContent 하단에 해당 시너지 소속 챔피언의 아이콘 + 이름 목록 추가 |
| **Function UX Effect** | 시너지에 마우스를 올리면 소속 챔피언을 즉시 확인 가능 → 조합 구성 시 참고 |
| **Core Value** | 팀 편성 판단에 필요한 정보를 툴팁 한 곳에서 제공 |

---

## 1. 현재 상태

- `SynergyPanel.tsx`의 `TraitTooltipContent` 컴포넌트가 시너지 툴팁 렌더링
- 현재 표시: 시너지 이름 + 설명 + 티어별 효과 수치
- 챔피언 목록은 표시하지 않음
- `SynergyPanel`은 `activeTraits`만 받고, 전체 챔피언 데이터를 받지 않음

---

## 2. 구현 범위

### 2.1 데이터 흐름

전체 챔피언 목록(`RawChampion[]`)을 `SynergyPanel`에 전달 → 시너지 이름으로 필터링 → 아이콘 + 이름 표시.

각 `RawChampion`은 `traits: string[]`을 가지고 있고, `ActiveTrait.trait.name`과 매칭하면 됨.

### 2.2 UI 디자인

기존 툴팁 하단에 구분선 + 챔피언 아이콘 그리드 추가:

```
┌──────────────────────────────┐
│ 도전자 (시너지명)              │
│ 설명 텍스트...                │
│ (2) 공격 속도 +10%           │
│ (4) 공격 속도 +20% ← 활성    │
│ (6) 공격 속도 +35%           │
│ ─────────────────────────    │
│ [아이콘] 피오라  [아이콘] 그웬  │
│ [아이콘] 야스오  [아이콘] 사미라 │
└──────────────────────────────┘
```

- 아이콘: 20×20px 원형, `getChampionImage` 사용
- 코스트별 테두리 색상 (`COST_COLORS`)
- 이름: 10px 텍스트
- 한 줄에 최대 4~5명, 자동 줄바꿈

---

## 3. 수정 파일

| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/components/builder/SynergyPanel.tsx` | `SynergyPanelProps`에 `champions` 추가, `TraitTooltipContent`에 챔피언 목록 렌더링 |
| 2 | `src/app/simulator/page.tsx` | `SynergyPanel`에 `champions` prop 전달 |

---

## 4. 구현 순서

1. `SynergyPanelProps`에 `champions: RawChampion[]` prop 추가
2. `TraitTooltipContent`에 `champions` prop 전달 + 시너지명으로 필터 + 아이콘/이름 렌더링
3. `page.tsx`에서 `SynergyPanel`에 `champions={champions}` 전달

---

*Created: 2026-04-16*
*Feature: synergy-tooltip-champions*
*Phase: Plan*
