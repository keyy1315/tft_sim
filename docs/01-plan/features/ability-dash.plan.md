# Plan: 이동형 스킬 (대쉬/도약) 구현

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 이동형 스킬 (대쉬/도약) |
| 작성일 | 2026-03-23 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 15개 챔피언의 스킬에 이동(대쉬/도약) 효과가 있으나, 현재 시뮬레이터는 스킬 사용 시 위치를 변경하지 않음. 돌진형 챔피언이 제자리에서 공격하여 실제 게임과 전투 양상이 다름 |
| **Solution** | `AbilityPattern`에 `dash` 패턴 추가. 스킬 시전 시 대상 위치로 이동 후 데미지 적용. 이동 유형별(대상 도약, 대상 주변 돌진, 후열 도약) 분류 |
| **Function UX Effect** | 브라이어가 후열 원딜에게 도약하고, 레넥톤이 체력 낮은 적에게 돌진하는 등 실제 게임과 동일한 이동 패턴 재현. 리플레이에서 위치 변화 확인 가능 |
| **Core Value** | 근접 돌진형 챔피언의 전투 시뮬레이션 정확도 향상. 프론트라인/백라인 포지셔닝 전략의 의미가 생김 |

---

## 1. 현재 상태 분석

### 1.1 AbilityPattern 현재 지원

```typescript
'single' | 'line' | 'aoe_circle' | 'cone' | 'multi' | 'bounce' | 'global' | 'self_buff'
```

**이동(dash) 패턴이 없음** — 스킬 시전 시 `unit.position`이 변경되지 않음.

### 1.2 이동형 스킬 챔피언 분류

#### 유형 A: 대상에게 도약 (타겟 위치로 이동 + 데미지)

| 챔피언 | 스킬 | 이동 대상 | 현재 패턴 |
|--------|------|----------|:--------:|
| 브라이어 | 핏빛 광분 | 가장 먼 적 | 미매핑 |
| 렉사이 | 매복 | 가장 먼 적 | cone |
| 니달리 | 끈질긴 급습 | 체력 낮은 인접 적 | 미매핑 |
| 레넥톤 | 자르고 토막내기 | 체력 낮은 적 | single |
| 피즈 | 장난치기 재간둥이 | 탱커/전사 아닌 가장 먼 적 | single |
| 니코 | 만개 | 대상 | aoe_circle |
| 킨드레드 | 양의 안식처 | 돌진 (방향) | aoe_circle |

#### 유형 B: 대상 주변 돌진 (대상 인접 칸으로 이동 + 데미지)

| 챔피언 | 스킬 | 현재 패턴 |
|--------|------|:--------:|
| 야스오 | 질풍검 | 미매핑 |
| 그웬 | 싹둑싹둑! | cone |
| 암베사 | 찢어 가르기 | line |
| 자헨 | 신성한 도전 | 미매핑 |
| 키아나 | 수풀 장악 | 미매핑 |

#### 유형 C: 특수 이동 (적 무리로 순간이동 등)

| 챔피언 | 스킬 | 현재 패턴 |
|--------|------|:--------:|
| 피들스틱 | 까마귀 폭풍 | aoe_circle |
| 사일러스 | 훔친 힘 | 미매핑 |
| 쉬바나 | 용의 강림 | 미매핑 |

---

## 2. 구현 범위

### 2.1 MVP — 단순 대쉬 이동

모든 이동형 스킬의 핵심 동작: **스킬 시전 시 대상 인접 칸으로 이동 + 기존 데미지 패턴 적용**

이동 타겟 선택:
- 기본: 현재 공격 대상 (findTarget 결과)
- 특수: 가장 먼 적 (브라이어, 렉사이, 피즈), 체력 낮은 적 (레넥톤, 니달리)

### 2.2 AbilityConfig 확장

```typescript
export interface AbilityConfig {
  pattern: AbilityPattern;
  radius?: number;
  maxTargets?: number;
  damageDecay?: number;
  /** 스킬 시전 시 이동 유형 */
  dash?: 'to_target' | 'to_farthest' | 'to_lowest_hp' | 'to_backline';
}
```

- `to_target`: 현재 공격 대상 인접 칸으로 이동
- `to_farthest`: 가장 먼 적 인접 칸으로 이동
- `to_lowest_hp`: 체력 가장 낮은 적 인접 칸으로 이동
- `to_backline`: 탱커/전사 아닌 가장 먼 적 (피즈)

### 2.3 챔피언 매핑

```typescript
// 기존 패턴 유지 + dash 속성 추가
TFT16_Briar:       { pattern: 'aoe_circle', radius: 1, dash: 'to_farthest' },
TFT16_RekSai:      { pattern: 'cone', radius: 1, dash: 'to_farthest' },
TFT16_Nidalee:     { pattern: 'aoe_circle', radius: 1, dash: 'to_lowest_hp' },
TFT16_Renekton:    { pattern: 'line', maxTargets: 3, dash: 'to_lowest_hp' },
TFT16_Fizz:        { pattern: 'aoe_circle', radius: 1, dash: 'to_backline' },
TFT16_Neeko:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
TFT16_Kindred:     { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
TFT16_Fiddlesticks:{ pattern: 'aoe_circle', radius: 2, dash: 'to_farthest' },
TFT16_Yasuo:       { pattern: 'aoe_circle', radius: 1, dash: 'to_target' },
TFT16_Gwen:        { pattern: 'cone', radius: 2, dash: 'to_target' },
TFT16_Ambessa:     { pattern: 'line', dash: 'to_target' },
TFT16_Zaahen:      { pattern: 'aoe_circle', radius: 1, dash: 'to_target' },
TFT16_Qiyana:      { pattern: 'line', maxTargets: 3, dash: 'to_target' },
TFT16_Sylas:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
TFT16_Shyvana:     { pattern: 'aoe_circle', radius: 3, dash: 'to_farthest' },
```

### 2.4 이동 로직

스킬 시전 시 (`combatLoop.ts` 어빌리티 발동 부분):

```
1. config.dash가 있으면:
   a. dash 유형에 따라 이동 대상 유닛 결정
   b. 대상 인접 빈 칸 탐색 (getNeighbors + occupiedPositions)
   c. 빈 칸이 있으면 unit.position 변경
   d. occupiedPositions 업데이트
   e. 전투 로그: "{챔피언}이(가) {대상}에게 돌진!"
2. 이후 기존 데미지 패턴 (findAbilityTargets) 실행 — 이동한 새 위치 기준으로 대상 탐색
```

---

## 3. 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/types/index.ts` | `AbilityPattern`은 변경 없음 |
| `src/lib/simulator/systems/ability.ts` | `AbilityConfig`에 `dash` 필드 추가, 챔피언 매핑 업데이트 |
| `src/lib/simulator/engine/combatLoop.ts` | 어빌리티 시전부에 대쉬 이동 로직 추가 |

---

## 4. 수용 기준

1. `dash` 속성이 있는 챔피언이 스킬 시전 시 대상 인접 칸으로 이동
2. 이동 후 새 위치 기준으로 AOE/Cone/Line 등 데미지 대상이 결정됨
3. 리플레이 스냅샷에서 위치 변화 확인 가능
4. 빈 칸이 없으면 이동하지 않고 제자리에서 스킬 사용
5. 결정론적 — 동일 시드에서 동일 결과
6. `pnpm lint && pnpm typecheck && pnpm build` 통과
