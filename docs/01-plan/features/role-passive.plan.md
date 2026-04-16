# Plan: 역할군 패시브 능력 구현 (Set 17 업데이트)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | Set 17에서 AD/AP 역할 분화(12종) 도입 + 전사 공격속도 패시브(5~30%), 암살자 후열 점프가 미구현. lolchess.gg 역할군 설명과 시뮬레이션 결과가 불일치 |
| **Solution** | 전사 스테이지별 AS 패시브 추가, 암살자 후열 점프 구현, AD/AP 역할 구분을 UI에 표시, 역할군 설명 데이터 정비 |
| **Function UX Effect** | 전사가 실제 게임처럼 AS 보너스를 받고, 암살자가 후열로 점프하며, 역할군 설명이 정확히 일치 |
| **Core Value** | lolchess.gg 공식 역할군 스펙과 시뮬레이션 완전 일치 → 전투 결과 신뢰도 확보 |

---

## 1. lolchess.gg 역할군 공식 스펙 (Set 17)

### 1.1 역할군별 마나 + 패시브

| 역할군 | 공격당 마나 | 초당 마나 | 피격 시 마나 | 패시브 |
|--------|-----------|---------|------------|--------|
| **탱커** (Tank) | 5 | 0 | ✅ | 대상 지정 확률 증가 |
| **전사** (Fighter) | 10 | 0 | ❌ | AS 5~30% (스테이지 비례), 비타겟 피해 15% 감소 |
| **원거리 딜러** (Carry) | 10 | 0 | ❌ | (없음) |
| **마법사** (Caster) | 7 | 2 | ❌ | CC 시 마나 획득 중단 |
| **암살자** (Reaper) | 10 | 0 | ❌ | 후열 점프, 비타겟 피해 15% 감소 |
| **전문가** (Specialist) | 특수 | 특수 | 특수 | 고유 자원 생성 방식 |
| **혼합 전사** (HFighter) | 10 | 0 | ❌ | 전사와 동일 |

### 1.2 AD/AP 분화

Set 17에서는 각 역할이 AD/AP로 분화됨 (예: ADFighter, APFighter). **마나 수치와 패시브는 동일** — 차이는 스킬 피해 타입(물리/마법)과 추천 아이템뿐.

데이터 내 GameRole 종류 (12개):
```
APTank(18), APCaster(13), ADFighter(10), ADTank(8), ADCarry(5),
APFighter(4), ADCaster(4), APCarry(3), APReaper(2), ADSpecialist(2),
ADReaper(2), HFighter(1)
```

---

## 2. 현재 구현 상태

### 2.1 구현 완료 ✅

| 항목 | 위치 | 상태 |
|------|------|------|
| 마나 수치 (Tank 5, Fighter/Marksman/Assassin 10, Caster 7) | `mana.ts:22-28` | ✅ |
| 마나 재생 (Caster 초당 2) | `mana.ts:51-60` | ✅ |
| 탱커 피격 시 마나 획득 | `mana.ts:66-72` | ✅ |
| Caster CC 시 마나 중단 | `mana.ts:40-41` | ✅ |
| 타게팅 가중치 Tank(3) > Fighter/Assassin(2) > 나머지(1) | `unit.ts:18-26` | ✅ |
| Fighter 옴니뱀프 12% | `unit.ts:9-16` | ✅ |
| Fighter/Assassin 비타겟 피해 감소 15% | `combatLoop.ts:458-459` | ✅ |
| GameRole → UnitRole 매핑 (AD/AP 구분 없이) | `types/index.ts:39-48` | ✅ |

### 2.2 미구현 ❌

| # | 항목 | 영향도 | 난이도 |
|---|------|--------|--------|
| 1 | **전사 AS 패시브 (5~30%, 스테이지 비례)** | 높음 — 전사 DPS 직결 | 낮음 |
| 2 | **암살자 후열 점프 제거** | 높음 — Set 17에 없는 기능이 잘못 구현됨 | 낮음 |
| 3 | **역할군 설명 UI** (역할군별 패시브 툴팁) | 낮음 — 표시용 | 낮음 |

---

## 3. 구현 범위

### 3.1 전사 AS 패시브 (스테이지별 보너스)

**규칙**: 전사(Fighter, HFighter) 역할군은 전투 시작 시 스테이지에 비례한 AS 보너스를 획득.

| 스테이지 | AS 보너스 |
|---------|----------|
| 1 | 5% |
| 2 | 10% |
| 3 | 15% |
| 4 | 20% |
| 5 | 25% |
| 6+ | 30% |

**구현 위치**: `combatLoop.ts` — CombatUnit 생성 후, 시너지 버프 적용 전에 Fighter AS 보너스 적용.

**스테이지 입력**: SimulateOptions에 `stageNumber?: number` 추가 (기본값 4). UI에서 스테이지 선택 드롭다운 추가.

```typescript
function applyFighterASBonus(units: CombatUnit[], stageNumber: number): void {
  const asBonus = Math.min(0.30, 0.05 * stageNumber);
  for (const unit of units) {
    if (unit.role === 'Fighter') {
      unit.stats.attackSpeed *= (1 + asBonus);
    }
  }
}
```

### 3.2 암살자 후열 점프 제거

**현황**: `applyAssassinJump` 함수가 combatLoop에 구현되어 있으나, Set 17 lolchess.gg 역할군 가이드에는 후열 점프 패시브가 없음. 이전 세트의 잔재이므로 제거.

- `applyAssassinJump` 함수 삭제
- 호출부 2곳 삭제
- 암살자는 배치 위치에서 전투 시작, 이동으로 접근

### 3.3 스테이지 입력 UI

SimulatorContent의 BattleControls 영역에 스테이지 선택 드롭다운 추가:
- 기본값: Stage 4
- 범위: 1~7
- 전사 AS 보너스 미리보기 표시

---

## 4. 수정 파일 목록

| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/lib/simulator/engine/combatLoop.ts` | `applyFighterASBonus`, `applyAssassinJump`, SimulateOptions.stageNumber |
| 2 | `src/lib/simulator/models/unit.ts` | 전사 AS 보너스 상수 테이블 |
| 3 | `src/app/simulator/page.tsx` | stageNumber 상태 + simulateCombat에 전달 |
| 4 | `src/components/battle/BattleControls.tsx` | 스테이지 선택 드롭다운 |

---

## 5. 구현 순서

### Phase 1: 전사 AS 패시브
1. SimulateOptions에 `stageNumber` 추가
2. `applyFighterASBonus` 함수 구현 (CombatUnit 생성 후 호출)
3. page.tsx에서 stageNumber 상태 관리 + simulateCombat 전달

### Phase 2: 암살자 후열 점프
4. `applyAssassinJump` 함수 구현 (전투 시작 직후, tick 루프 전)
5. 점프 로그 기록

### Phase 3: UI
6. BattleControls에 스테이지 선택 드롭다운
7. 역할군 툴팁에 패시브 설명 표시 (후순위)

---

## 6. 검증 기준

| 시나리오 | 예상 결과 |
|---------|----------|
| Stage 4 전사 시뮬레이션 | AS +20% 적용 |
| Stage 1 전사 시뮬레이션 | AS +5% 적용 |
| 암살자 전투 시작 | 적 후열 근처로 점프, 로그에 기록 |
| 암살자 빈 칸 없음 | 점프 안 함, 제자리 |
| 마법사 CC 중 | 마나 획득/재생 없음 (기존 동작 유지) |
| 탱커 피격 | 피격 시 마나 획득 (기존 동작 유지) |
| lolchess.gg 설명과 비교 | 모든 수치 일치 |

---

*Updated: 2026-04-16*
*Feature: role-passive*
*Phase: Plan*
