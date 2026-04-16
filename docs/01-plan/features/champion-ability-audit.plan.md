# Plan: Set 17 챔피언 스킬 전수 감사 (Ability Audit)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 대부분 챔피언의 AbilityConfig가 스킬 설명과 불일치 — DOT를 즉발로 처리, 다회 타격 횟수 미반영, 패시브/스킬 분리 안 됨, % 최대체력 피해 미구현 등 |
| **Solution** | 72명 전수 조사 후 AbilityConfig에 hitCount/dot 필드 추가, combatLoop에 DOT 시스템 + 다회 타격 곱연산 구현 |
| **Function UX Effect** | 모든 챔피언의 스킬이 실제 게임 설명대로 동작하여 시뮬레이션 결과가 신뢰 가능 |
| **Core Value** | 시뮬레이터 핵심 — 전투 피해/CC/회복 계산 정확도 복구 |

---

## 1. 전수 감사 결과 요약

### 72명 중 상태 분류

| 상태 | 수 | 챔피언 |
|------|---|--------|
| ✅ 정상 | 14 | 이즈리얼, 레오나, 렉사이, 밀리오, 마오카이, 오른, 룰루, 사미라, 라아스트, 마스터이, 피오라, 제드, 아트록스, 뽀삐 |
| ❌ 높음 (즉시 수정) | 16 | 아래 상세 |
| ⚠️ 중간 (후속) | 22 | 아래 상세 |
| 피해 없는 스킬 | 5 | 뽀삐, 잭스, 갈리오, 제드, 소형블랙홀 |
| PVE/특수 | 7 | Minion, Raptor, Krug 등 |

---

## 2. ❌ 높음 우선순위 — 16명 상세

### 유형 A: DOT → 즉발 오류 (7명)

스킬이 매초 지속 피해인데 1회 즉발 피해로 계산됨.

| 챔피언 | 변수 | 지속시간 | 현재 처리 |
|--------|------|---------|----------|
| 탈론 | `ADBleedDamage`(460/690) | 18초 출혈 | 즉발 1회 |
| 모데카이저 | `DamagePerProc`(45/70) | 4초 매초 | 즉발 1회 |
| 판테온 | `TrueDamagePerSecond`(45) | 4초 매초 | 즉발 1회 |
| 아우렐리온 솔 | `DamagePerSecond`(280) | 3초 매초 | 즉발 1회 |
| 바드 | `DamagePerSecond`(220) | 4초 매초 | 즉발 1회 |
| 모르가나 | `TetherDamagePerSecond`(75) | 5초 DOT + 최종 폭발 | 즉발 1회 |
| 빅토르 | `Damage`(220) | 4초 매초 | 즉발 1회 |

### 유형 B: 다수 피해 미반영 (5명)

피해 = base × 횟수인데, base만 적용되어 극도로 낮음.

| 챔피언 | base 피해 | 횟수 | 실제 총 피해 | 현재 |
|--------|----------|------|------------|------|
| 벨베스 | 20 | ×12 | 240 | 20 |
| 아칼리 | 4 | ×5 단검 | 20 | 4 |
| 징크스 | 27 | ×N 로켓 | 27×N | 27 |
| 카이사 | 32 | ×16 미사일 | 512 | 32 |
| 코르키 | MissileAD × 21 | ×21 | — | 배율값 사용 |

### 유형 C: 특수 피해 계산 (4명)

| 챔피언 | 문제 | 설명 |
|--------|------|------|
| 초가스 | `PercentMaximumHealthDamage` — % 최대체력 피해 | 고정값 아님, 적 HP 비례 |
| 블리츠크랭크 | 3단계 분리 필요 (패시브/띄움/폭발) | 현재 `BoltDamage`만 적용 |
| 다이애나 | `BaseAttackDamagePercent`(0.5) — %AD 피해 | 일반 계산 불가 |
| 르블랑 | 패시브(기본공격 대체) + 분신 5명 + 투사체 | 복합 미구현 |

---

## 3. 수정 방안

### Phase 1: AbilityConfig 확장

```typescript
interface AbilityConfig {
  // 기존...
  /** 다회 타격 횟수 (벨베스 12, 아칼리 5, 카이사 16 등) */
  hitCount?: number;
  /** DOT 지속 피해 */
  dot?: { duration: number };
  /** 피해 변수 오버라이드 (parseAbility 대신 직접 지정) */
  damageVar?: string;
  /** 2차 피해 변수 (폭발, 추가 타격 등) */
  secondaryDamageVar?: string;
}
```

### Phase 2: combatLoop — hitCount 곱연산

```typescript
// 스킬 피해 계산 시
let totalDmg = abilityDmg;
if (config.hitCount && config.hitCount > 1) {
  totalDmg = abilityDmg * config.hitCount;
}
```

### Phase 3: combatLoop — DOT 시스템

스킬 시전 시 대상에 DOT statusEffect 추가 → 매 틱 피해 적용:

```typescript
if (config.dot) {
  const dotTicks = Math.round(config.dot.duration * TICKS_PER_SECOND);
  target.statusEffects.push({
    type: 'burn',  // 기존 burn 타입 재활용
    sourceId: unit.id,
    remainingTicks: dotTicks,
    value: abilityDmg / config.dot.duration,  // 초당 피해
  });
}
```

### Phase 4: 특수 챔피언 개별 처리

combatLoop에서 apiName 분기:
- 초가스: `damage = targetMaxHp * percentValue`
- 블리츠크랭크: 패시브(2초 주기) + 띄움(1명) + 폭발(3칸) 분리
- 다이애나: `damage = casterAD * percentValue`

---

## 4. 챔피언별 AbilityConfig 수정 목록

### hitCount 추가

| 챔피언 | hitCount | 비고 |
|--------|----------|------|
| 벨베스 | 12 | `BaseNumSlashes` |
| 아칼리 | 5 | `NumShurikens` |
| 카이사 | 16 | `BaseNumMissiles` |
| 코르키 | 21 | `BaseMissiles` |

### dot 추가

| 챔피언 | duration | 비고 |
|--------|----------|------|
| 탈론 | 18 | 출혈 |
| 모데카이저 | 4 | 매초 피해 |
| 판테온 | 4 | 매초 고정 피해 |
| 아우렐리온 솔 | 3 | 광선 |
| 바드 | 4 | 비행접시 |
| 모르가나 | 5 | 사슬 |
| 빅토르 | 4 | 폭풍 |

### damageVar 오버라이드

| 챔피언 | damageVar | 이유 |
|--------|-----------|------|
| 블리츠크랭크 | `ExplosionDamage` | 주요 피해는 폭발 |
| 누누 | `InitialDamage` | ✅ 이미 잡힘 |
| 징크스 | `ADDamage` | ✅ 이미 잡힘 |

### stunTargets 수정

| 챔피언 | 현재 | 올바른 값 |
|--------|------|----------|
| 블리츠크랭크 | 전원(3칸) | stunTargets: 1 (띄움 1명만) |

---

## 5. 수정 파일

| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/lib/simulator/systems/ability.ts` | AbilityConfig 확장 + 챔피언별 설정 수정 |
| 2 | `src/lib/simulator/engine/combatLoop.ts` | hitCount 곱연산 + DOT 시스템 + 특수 챔피언 |
| 3 | `src/types/index.ts` | StatusEffectType 확장 (필요 시) |

---

## 6. 구현 순서

| Phase | 내용 | 영향 챔피언 수 | 난이도 |
|-------|------|-------------|--------|
| 1 | hitCount 다수 피해 | 4~5명 | 낮 |
| 2 | DOT 지속 피해 시스템 | 7명 | 중 |
| 3 | damageVar/stunTargets 교정 | 3~5명 | 낮 |
| 4 | 특수 챔피언 (초가스/블리츠/다이애나) | 3~4명 | 높 |
| 5 | ⚠️ 중간 우선순위 22명 | 22명 | 중~높 |

---

*Updated: 2026-04-16*
*Feature: champion-ability-audit*
*Phase: Plan*
