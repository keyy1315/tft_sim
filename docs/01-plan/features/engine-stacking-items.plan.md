# engine-stacking-items Planning Document

> **Summary**: 전투 시뮬레이션 엔진에 중첩 아이템 동적 효과 구현
>
> **Project**: TFT Combat Simulator
> **Author**: Dayoung
> **Date**: 2026-04-17
> **Status**: Draft

---

## 개요

`combatLoop.ts`의 전투 시뮬레이션에서 중첩 아이템(구인수, 거결, 수은 등)의 동적 효과가 미구현 상태.
현재 엔진은 `getItemEffects`의 기본 스탯만 반영하고, 전투 중 스택이 쌓이는 효과는 처리하지 않음.

## 미구현 아이템 목록

| 아이템 | 효과 키 | 동작 |
|--------|---------|------|
| 구인수의 격노검 | `AttackSpeedPerStack: 7` | 공격마다 AS +7% 중첩 |
| 찬란한 구인수의 격노검 | `AttackSpeedPerStack: 7` | 공격마다 AS +7% 중첩 |
| 거인의 결의 | `StackingAD: 0.02`, `StackingSP: 2`, `StackCap: 25` | 공격/피격마다 AD +2%, AP +2 중첩 (최대 25스택) |
| 찬란한 거인의 결의 | 동일 | 동일 |
| 수은 | `ProcAttackSpeed: 0.03` | 공격마다 AS +3% 중첩 |
| 찬란한 수은 | 동일 | 동일 |
| 죽음의 검 | `BonusDamage: 0.1` | 전체 피해 +10% 증폭 |
| 찬란한 죽음의 검 | `BonusDamage: 0.15` | 전체 피해 +15% 증폭 |
| 찬란한 라바돈의 죽음모자 | `BonusDamage: 0.15` | 전체 피해 +15% 증폭 |
| 드론 업링크 | `DamageRepeat: 20`, `Interval: 3` | 3초마다 피해량의 20% 추가 마법 피해 |
| 동물특공대 전용 아이템 | 다수 | 유닛별 추가 효과 (해시 변수) |

## 구현 방법

1. `combatLoop.ts`의 공격 핸들러에서 아이템 효과 체크
2. 공격 시: `AttackSpeedPerStack`, `ProcAttackSpeed` → 유닛의 AS에 중첩 적용
3. 공격/피격 시: `StackingAD`, `StackingSP` → AD/AP에 중첩 적용 (StackCap 제한)
4. 피해 계산 시: `BonusDamage` → 전체 피해에 곱연산
5. 주기적: `DamageRepeat` → Interval마다 추가 피해 발생

## 우선순위

High — 정적 분석의 매직 넘버 보정(estimateDps-magic-numbers)이 이 작업에 의존함.

## 관련 문서

- 정적 분석 매직 넘버 보정: `estimateDps-magic-numbers.plan.md`
- 전투 분석 기능: `combat-analysis.plan.md`
