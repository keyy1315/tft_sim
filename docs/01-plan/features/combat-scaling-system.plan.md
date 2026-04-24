# Plan: 전투 내 챔피언 스케일링 시스템

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 전투 중 공격 속도/피해량이 동적으로 변하는 챔피언과 시너지가 combatLoop에 미반영 — 시뮬레이션 정확도 저하 |
| **Solution** | CombatUnit에 전투 내 카운터 추가 + AbilityConfig에 scaling 선언 + 시너지 전투 버프를 resolveTraits → combatLoop에 반영 |
| **Function UX Effect** | 브라이어/마스터이/피오라 등 핵심 캐리의 실제 전투 DPS가 정확히 재현됨 |
| **Core Value** | 챔피언 간 전투력 비교 신뢰도 확보 — 팀 편성 의사결정 지원 |

---

## 1. 구현 범위

### 이미 구현됨 (제외)
- 이즈리얼 드론 (영구 스택 입력)
- 초가스 체력 (영구 스택 입력)
- 기본 AbilityConfig 패턴 63명 전체
- self_buff (마스터이 AS, 잭스 보호막 등) — 기존 combatLoop에서 처리

### 이번에 구현할 것

#### A. 챔피언 전투 내 스케일링 (combatLoop 확장)

| 우선순위 | 챔피언 | 트리거 | 효과 | 난이도 |
|---------|--------|--------|------|--------|
| 1 | **브라이어** | 매 틱 (패시브) | 잃은 체력 %당 AS 증가 | 낮음 |
| 2 | **나르** | 기본공격 5회 | 부메랑 추가 피해 | 중간 |
| 3 | **마스터 이** | 기본공격 3회 | 연속 베기 추가 피해 | 중간 |
| 4 | **피오라** | 기본공격 2회 | 급소 드러냄 → 돌진 고정 피해 | 높음 |
| 5 | **사미라** | 적 공중 띄움 | 추가 물리 피해 + 그루브 | 중간 |
| 6 | **카이사** | 처치 관여 | 마나 획득 | 낮음 |
| 7 | **쉔** | 스킬 사용 | 추가 피해 중첩 (3회째 고정 피해) | 중간 |
| 8 | **자야** | 스킬 사용 | AS 버프 + 깃털 회수 피해 | 중간 |
| 9 | **진** | 전투 시작 (패시브) | 고정 AS, 추가 AS → AD 전환 | 낮음 |
| 10 | **티모** | 기본공격 (패시브) | 독 중첩 → 그루브 진입 | 중간 |

#### B. 시너지 전투 버프 (resolveTraits → combatLoop)

| 우선순위 | 시너지 | 효과 | 난이도 |
|---------|--------|------|--------|
| 1 | **도전자** | 아군 AS + 도전자 추가 AS, 대상 사망 시 버스트 | 중간 |
| 2 | **습격자** | 흡혈 + AD, 초과 회복 → 보호막 | 중간 |
| 3 | **전달자** | 마나 재생 | 낮음 |
| 4 | **구원자** | 활성 특성당 AS/방어력/마저 | 낮음 |
| 5 | **불한당** | AD/AP + 체력 50% 이하 은신 | 중간 |
| 6 | **우주 그루브** | 그루브 중 그루비안당 AS + 체력 재생 | 높음 |

---

## 2. 기술 설계

### 2.1 CombatUnit 확장

```typescript
// 전투 내 카운터 (combatLoop에서 관리)
interface CombatUnit {
  // 기존...
  attackCount: number;      // 기본공격 횟수
  castCount: number;        // 스킬 사용 횟수
  killCount: number;        // 처치 수
  assistCount: number;      // 처치 관여 수
}
```

### 2.2 AbilityConfig 확장

```typescript
interface AbilityConfig {
  // 기존...
  scaling?: {
    trigger: 'onAttack' | 'onCast' | 'onKill' | 'onEnemyAirborne' | 'passive';
    every?: number;           // N회마다 발동
    effect: ScalingEffect;
  };
}

type ScalingEffect = 
  | { type: 'extraDamage'; damage: number; damageType: 'physical' | 'magic' | 'true' }
  | { type: 'attackSpeed'; amount: number; duration?: number }
  | { type: 'mana'; amount: number }
  | { type: 'bonusAD'; amountPerStack: number };
```

### 2.3 챔피언별 scaling 설정

```typescript
// ability.ts CHAMPION_ABILITY_PATTERNS에 추가
TFT17_Briar: {
  pattern: 'single',
  scaling: {
    trigger: 'passive',        // 매 틱 계산
    effect: { type: 'attackSpeed', amount: 0.02 }, // 잃은 체력 1%당 AS 2%
  },
},
TFT17_Gnar: {
  pattern: 'line', maxTargets: 3,
  scaling: {
    trigger: 'onAttack',
    every: 5,                  // 5회마다
    effect: { type: 'extraDamage', damage: 80, damageType: 'physical' },
  },
},
// ...
```

### 2.4 시너지 전투 버프

시너지 효과는 `resolveTraits`에서 이미 계산됨. combatLoop 초기화 시 유닛에 적용:

```typescript
// combatLoop에서 유닛 생성 후
for (const trait of activeTraits) {
  if (trait.apiName === 'TFT17_ASTrait' && trait.activeEffect) {
    // 도전자: 아군 전체 AS + 도전자 추가 AS
    const teamAS = trait.activeEffect.variables['TeamwideAS'];
    const champAS = trait.activeEffect.variables['AttackSpeedPercent'];
    // 적용
  }
}
```

---

## 3. 수정 파일 목록

| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/types/index.ts` | CombatUnit에 attackCount/castCount/killCount 추가 |
| 2 | `src/lib/simulator/systems/ability.ts` | AbilityConfig.scaling 타입 + 챔피언별 설정 |
| 3 | `src/lib/simulator/engine/combatLoop.ts` | 카운터 증가 로직 + scaling 효과 적용 + 시너지 버프 |

---

## 4. 구현 순서

### Phase 1: 카운터 인프라
1. CombatUnit에 카운터 필드 추가 (attackCount, castCount, killCount)
2. combatLoop에서 기본공격/스킬/처치 시 카운터 증가

### Phase 2: 챔피언 패시브 스케일링
3. 브라이어 — 잃은 체력당 AS (매 틱)
4. 진 — AS → AD 전환 (전투 시작)
5. 카이사 — 처치 관여 시 마나 획득

### Phase 3: N회 트리거
6. 나르 — 공격 5회마다 부메랑
7. 마스터 이 — 공격 3회마다 연속 베기
8. 피오라 — 공격 2회마다 급소

### Phase 4: 이벤트 트리거
9. 사미라 — 적 공중 띄움 시 추가 피해
10. 쉔 — 스킬 사용마다 중첩
11. 자야 — 스킬 사용 시 AS + 깃털

### Phase 5: 시너지 전투 버프
12. 도전자/습격자/전달자/구원자/불한당 전투 초기화 시 버프 적용

---

*Created: 2026-04-15*
*Feature: combat-scaling-system*
*Phase: Plan*
