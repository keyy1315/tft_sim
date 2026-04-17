# estimateDps-magic-numbers Planning Document

> **Summary**: 정적 분석 DPS 추정의 매직 넘버 6개를 시뮬 기반으로 보정
>
> **Project**: TFT Combat Simulator
> **Author**: Dayoung
> **Date**: 2026-04-17
> **Status**: Draft

---

## 개요

`src/lib/analysis/itemOptimizer.ts`의 `estimateDps` 함수에 근거 없는 추정 계수 6개가 들어가 있음.
시뮬레이터로 각 아이템 효과별 실제 DPS 기여도를 측정해서 계수를 역산해야 함.

## 매직 넘버 목록

| # | 코드 | 현재 값 | 문제 |
|---|------|---------|------|
| 1 | `flatDamage * totalAS * 0.3` | 루덴/악성코드 발동률 30% | 아이템마다 쿨다운이 다름. 실제 쿨다운 기반으로 보정 필요 |
| 2 | `burnPercent * 20` | 적 평균 체력 2000 | 2성이면 3000+, 3성이면 5000+. 성급별 평균 체력 측정 필요 |
| 3 | `bonusAttacks * 0.3` | 야스오 검술 = DPS 30% 증가 | 실제 발동 주기에 따라 다름. 시뮬 측정 필요 |
| 4 | `ASPerMissingHealthPercent * 50` | 잃은 체력 평균 50% | 전투 초반 0%, 후반 80%+. 시간 경과 평균 역산 |
| 5 | `manaRegen * duration * 0.1` | 마나 재생 효율 10% | 근거 없음. 실제 마나 사이클 측정 필요 |
| 6 | `adapPerKill * 2` | 평균 2킬 | 캐리는 3-4킬, 탱커는 0-1킬. 역할별 측정 |

## 보정 방법

1. 시뮬레이터에서 각 아이템 ON/OFF로 여러 조합 DPS 측정
2. 아이템 있을 때 / 없을 때 DPS 차이로 실제 기여도 역산
3. 역산된 계수로 매직 넘버 교체
4. 최소 10개 조합 × 6개 아이템 = 60회 시뮬 필요

## 선행 작업

- `engine-stacking-items.plan.md` — 엔진에 중첩 아이템 동적 효과가 구현되어야 정확한 DPS 측정 가능

## 우선순위

Medium — 엔진 중첩 아이템 구현 후 진행. 현재 매직 넘버로도 대략적인 상대 비교는 가능하지만 절대값이 부정확.

## 관련 문서

- 엔진 중첩 아이템: `engine-stacking-items.plan.md`
- 전투 분석 기능: `combat-analysis.plan.md`
