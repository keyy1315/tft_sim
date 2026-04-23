# item-effect-engine Planning Document

> **Summary**: 이벤트 기반 아이템 효과 엔진 — 단순 스탯 버퍼에서 trigger/counter/interval 기반 동적 효과로 확장
>
> **Project**: TFT Combat Simulator
> **Author**: Dayoung
> **Date**: 2026-04-20
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 현재 `resolveItemEffect`는 순수 스탯 매퍼라 "12번 맞으면 4번 반격" 같은 조건부/카운터 기반 효과를 반영 못 함. Set 17 PsyOps/Anomaly 대규모 아이템이 시뮬에 실효 없이 존재만 인식되고, 구인수/거결/수은 등 중첩 아이템도 미구현. 4/18 CDragon 패치로 hash→named 키 마이그레이션까지 겹쳐 매핑 갭 390개 발생 |
| **Solution** | 이벤트 훅(onAttack/onHit/onManaSpent/onInterval/onAbilityCast) + per-unit counter/timer + trigger primitive로 구성된 이벤트 기반 아이템 효과 엔진. 기존 단순 스탯 아이템은 `StatPatch` primitive로 backward-compat 유지하면서 복잡 아이템은 `Trigger` 체인으로 표현 |
| **Function/UX Effect** | PsyOps 12종 + Anomaly + 중첩 6종(구인수/거결/수은/죽검/드론업링크/라바돈) 시뮬 정확 반영 → 가상 대전 분석의 DPS/사망 원인이 실제 게임에 근접. 정적 DPS 추정 매직넘버 6개도 시뮬 기반 역산으로 대체 |
| **Core Value** | "데이터만 있고 효과 없음"에서 "효과가 실제로 작동하는 시뮬레이터"로 근본 전환. 선행되던 3개 Plan(engine-stacking-items / estimateDps-magic-numbers / emblem-synergy-dps)을 이 엔진 위에서 통합 해결 |

---

## 1. Overview

### 1.1 Purpose

순수 스탯 매핑을 이벤트 기반 엔진으로 교체해서, Set 17이 도입한 복합 효과 아이템들(PsyOps, Anomaly, Graves Trait, 중첩 아이템 전반)을 시뮬에 정확 반영한다.

### 1.2 Background

- 2026-04-18 CDragon 패치로 Set 17 아이템 효과 키가 **hash → named 마이그레이션** 완료 (예: `{b9c681e9}` → `ResistReduce`). 이전엔 불가능했던 해독이 가능해짐
- 현재 `ITEM_EFFECT_KEYS` 매핑은 19개. 신규 데이터엔 **403개 named 키** 존재 → 390개 갭
- 갭 중 순수 스탯(~30개)은 단순 추가로 해결 가능
- PsyOps 12종, Anomaly 1종, 중첩 아이템 6종은 **카운터/타이머/조건 기반 로직** 필요 — 매핑만으론 불가능
- 관련 플랜 3건이 이 엔진 부재로 blocked 상태:
  - `engine-stacking-items.plan.md` (구인수/거결/수은 등 중첩)
  - `estimateDps-magic-numbers.plan.md` (시뮬 기반 DPS 역산 — 중첩 구현 의존)
  - `emblem-synergy-dps.plan.md` (상징 재분배 시 trait 재계산)

### 1.3 Related Documents

- 아이템 효과 매핑: `src/lib/simulator/systems/item.ts`, `src/lib/simulator/models/constants.ts`
- 전투 루프: `src/lib/simulator/engine/combatLoop.ts`
- 정적 분석: `src/lib/analysis/itemOptimizer.ts` (estimateDps)
- 선행 플랜 3건: `engine-stacking-items.plan.md`, `estimateDps-magic-numbers.plan.md`, `emblem-synergy-dps.plan.md`

---

## 2. Scope

### 2.1 In Scope

**Phase 0 — 이벤트 타입 설계 (Spike)**
- [ ] 이벤트 종류 열거: `onAttackWindup`, `onAttackLanded`, `onHitTaken`, `onManaSpent`, `onAbilityCast`, `onUnitDeath`, `onInterval`, `onCombatStart`
- [ ] Per-unit 상태 컨테이너 설계 (`attackCount`, `hitCount`, `procTimers`, `stacks`)
- [ ] Trigger primitive 설계: `{event, condition?, action}`
- [ ] 기존 `resolveItemEffect` → `StatPatch` primitive로 이행 경로 설계

**Phase 1 — 엔진 기반 구현**
- [ ] `EventBus` 확장: 아이템 효과용 이벤트 채널 추가
- [ ] `ItemEffectRuntime` 신설: 유닛 장착 아이템의 trigger 등록/해제
- [ ] Counter/Timer primitive: `interval`, `everyNAttacks`, `onThreshold`
- [ ] Action primitive: `dealDamage`, `applyBuff`, `spawnProjectile`, `modifyStat`

**Phase 2 — 기존 아이템 포팅 (backward compat)**
- [ ] 단순 스탯 아이템 전부 `StatPatch` primitive로 이관 (regression 없어야 함)
- [ ] 기존 19개 매핑 + 신규 ~30개 순수 스탯 키 추가 (HealPct/AttackDamage/ResistReduce/ManaRegen 등)
- [ ] Golden test: 포팅 전후 동일 스냅샷 보장

**Phase 3 — 중첩 아이템 구현**
- [ ] 구인수/찬란 구인수 (`AttackSpeedPerStack` × onAttackLanded)
- [ ] 거인의 결의/찬란 (`StackingAD/StackingSP` × onAttackLanded + onHitTaken, StackCap 25)
- [ ] 수은/찬란 (`ProcAttackSpeed` × onAttackLanded)
- [ ] 죽음의 검 계열/찬란 라바돈 (`BonusDamage` × dealDamage 훅)
- [ ] 드론 업링크 계열 (`DamageRepeat + Interval` 주기 피해)

**Phase 4 — PsyOps 12종 구현**
- [ ] 반도체/찬란 (`AttacksToReceive` → `AttacksToLaunch` 반격 + `PctHealthDamage`)
- [ ] 악성코드 매트릭스/찬란 (`ResistReduce` 디버프)
- [ ] 드론 모드/찬란 (`SecondDroneDamageRepeat`)
- [ ] 표적 고정 광학 장치/찬란 (`AttackPct` 공격 버프)
- [ ] 유기물 보존기/찬란 (`NumGrenades + PctMaxHP`)
- [ ] 공감 임플란트/찬란 (`ManaRegenOverTime + TrueDamageConversion`)

**Phase 5 — Anomaly 시스템**
- [ ] Role 기반 Anomaly 효과 적용 (desc의 `<TFTGuildActive>` 태그 기반 Role → 효과 매핑)
- [ ] Tank/Marksman/Fighter/Caster/Assassin/Specialist 6종 변형 구현

**Phase 6 — 선행 플랜 통합 해결**
- [ ] `estimateDps-magic-numbers`: 신규 엔진으로 시뮬 돌려서 매직 넘버 6개 역산 교체
- [ ] `emblem-synergy-dps`: 상징 재분배 시 `resolveTraits` 재실행 → 재산출된 trait을 새 엔진에 주입

### 2.2 Out of Scope

- Graves Trait 상점 아이템 55종 효과 구현 (매우 특수한 시너지 고유 시스템 — 별도 피처로 분리)
- Sona Command Mods 11종 효과 구현 (별도 피처)
- 증강(Augment) 효과 확장 (이번 엔진 범위는 아이템 한정)
- Anomaly의 정확한 수치 역산 (게임별 랜덤 지급 체계 — 확률/풀 설계는 별도)

### 2.3 Assumptions

- CDragon 효과 키가 계속 named 상태 유지 (패치마다 hash로 돌아가지 않음)
- 기존 시뮬의 Golden test가 Phase 2 regression 검증 기준으로 충분
- Role 기반 Anomaly 구분이 desc 파싱으로 가능 (effects hash 없이 desc만으로 충분)

---

## 3. Design Principles

1. **Backward compatibility 최우선** — 기존 시뮬 결과가 바뀌면 안 됨. `StatPatch`는 현재 `resolveItemEffect`의 완전한 대체
2. **결정론적 엔진 유지** — 모든 trigger/counter는 seed 기반, `Math.random()` 직접 사용 금지
3. **UI 레이어 분리** — `src/lib/simulator/systems/items/` 서브모듈로 격리, React 의존 없음
4. **최소 폭발 반경** — Phase 2까지는 엔진 리팩터링만, Phase 3 이후 신규 기능. 각 Phase 독립 커밋 가능

---

## 4. Success Criteria

| 지표 | 기준 |
|------|------|
| 기존 시뮬 regression | 0건 (Golden test 100% 통과) |
| 중첩 아이템 6종 시뮬 반영 | 시뮬 로그에 stack 증가 이벤트 관측 |
| PsyOps 12종 효과 발동 | 각 아이템 effect trigger 로그 최소 1회 |
| 매직 넘버 보정 | 6개 매직 넘버 시뮬 기반 값으로 대체 |
| 상징 재분배 정확도 | 상징 포함/미포함 DPS 차이가 시너지 보너스 반영된 값과 일치 |

---

## 5. Implementation Order

단계별 독립 커밋 가능한 순서:

```
Phase 0 Spike (이벤트 타입 설계)
  └─ Phase 1 엔진 기반 (EventBus/Runtime/Primitives)
      └─ Phase 2 기존 아이템 포팅 [← Golden test gate]
          ├─ Phase 3 중첩 아이템 (구인수/거결/수은/죽검/드론)
          ├─ Phase 4 PsyOps 12종
          └─ Phase 5 Anomaly
              └─ Phase 6 선행 플랜 해결
                  ├─ estimateDps 매직 넘버 보정
                  └─ 상징 재분배 DPS 정확화
```

---

## 6. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Phase 2 regression 발생 | High | High | Golden test snapshot 먼저 생성 → 포팅 전/후 diff 0 확인 |
| 이벤트 훅 누락으로 일부 아이템 미커버 | Medium | Medium | Phase 0에서 실제 아이템 desc 전부 스캔해 필요 훅 열거 |
| 결정론적 실행 깨짐 | Low | High | 기존 seed RNG 래핑 강제, 직접 `Math.random` PR 블록 |
| 확장으로 combatLoop 복잡도 폭발 | Medium | Medium | 아이템 효과 전부 서브모듈로 격리, combatLoop는 이벤트 dispatch만 |

---

## 7. Priority

**High** — 메모리 등록된 엔진 제약 3건을 동시 해결하는 기반 작업. 이게 없으면 아이템/시너지 밸런스 재검증이 어렵고, 가상 대전 분석 정확도 개선에 상한선이 생김.

예상 기간: **1-2주 (6 phase)**, Phase 2까지만 해도 4-5일 단기 승리 지점 존재.

---

## 8. Related Documents

- 엔진 중첩 아이템 (이 엔진의 Phase 3): `engine-stacking-items.plan.md`
- 정적 DPS 매직 넘버 보정 (Phase 6): `estimateDps-magic-numbers.plan.md`
- 상징 시너지 DPS (Phase 6): `emblem-synergy-dps.plan.md`
- 전투 분석 기능: `combat-analysis.plan.md`
- Anomaly 데이터 구조: `public/data/tft_set17_items.json` (`TFT17_EkkoOffering_AnomalyItem`)
