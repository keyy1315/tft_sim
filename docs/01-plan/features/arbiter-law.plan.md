# Plan: 중재자 시너지 법률 시스템

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 중재자(Arbiter) 시너지 법률 선택 + 전투 적용 |
| 작성일 | 2026-04-17 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 중재자 시너지 활성화 시 원인(trigger)과 결과(effect)를 선택하여 전투에 적용하는 법률 시스템이 미구현 |
| **Solution** | 편집 탭에서 trigger/effect 선택 UI + combatLoop에서 선택된 법률을 전투 중 실시간 적용 |
| **Function UX Effect** | 중재자 2/3 활성 시 법률 선택 패널이 나타나고, 전투에서 조건 충족 시 선택한 버프가 적용됨 |
| **Core Value** | 중재자 시너지의 핵심 메커닉(법률 선택)을 시뮬레이션에서 정확하게 재현 |

---

## 1. 게임 메커닉

### 1.1 중재자 시너지

| 단계 | 유닛 수 | 효과 |
|------|---------|------|
| Silver | 2 | 법률 선택 (trigger + effect) → silver 수치 적용 |
| Gold | 3 | 법률 선택 (trigger + effect) → gold 수치 적용 (강화) |

### 1.2 법률 구성

법률 = **원인(trigger)** 1개 + **결과(effect)** 1개

- **원인 9종**: `on_deal_10_hits`, `on_3_basic_attacks`, `every_4_seconds`, `on_enemy_death`, `on_hp_below_40`, `on_spend_50_mana`, `on_combat_start_per_interest`, `on_combat_start_if_refreshed`, `on_combat_start_per_star`
- **결과 9종**: `mana`, `ap`, `armor_mr`, `attack_speed`, `permanent_hp`, `shield`, `free_reroll`, `leona_drop`, `gold_drop`

### 1.3 데이터

`public/data/arbiter_laws.json` — trigger별 선택 가능한 effect 목록 + silver/gold 수치

---

## 2. 구현 범위

### 2.1 UI — 법률 선택 패널

편집 탭에서 중재자 시너지 활성화 시:
1. SynergyPanel 하단 또는 별도 영역에 법률 선택 UI 표시
2. **Step 1**: trigger(원인) 드롭다운 선택
3. **Step 2**: 선택된 trigger에서 가능한 effect(결과) 드롭다운 선택
4. silver/gold 수치 미리보기
5. 중재자 해제 시 법률 선택 초기화

참고 패턴: 아이오니아 경로 선택(`IoniaPathType`) — 시너지 활성 시 옵션 선택 UI

### 2.2 상태 관리

`useTeamManagement.ts`에 법률 선택 state 추가:

```ts
interface ArbiterLaw {
  triggerId: string;   // e.g. 'on_deal_10_hits'
  effectId: string;    // e.g. 'ap'
}

const [playerArbiterLaw, setPlayerArbiterLaw] = useState<ArbiterLaw | null>(null);
const [enemyArbiterLaw, setEnemyArbiterLaw] = useState<ArbiterLaw | null>(null);
```

중재자 시너지 해제 시 자동 null 처리.

### 2.3 전투 엔진 — 법률 적용

`combatLoop.ts`의 `simulateCombat()`에 법률 정보를 전달하고, trigger 조건 충족 시 effect 적용.

**trigger 타입별 처리:**

| trigger type | 전투 엔진 위치 | 구현 방식 |
|-------------|--------------|----------|
| `on_hit_count` | 공격 처리 후 | 글로벌 카운터, threshold 도달 시 발동 |
| `on_attack_count` | 기본 공격 후 | 글로벌 카운터, threshold 도달 후 리셋 반복 |
| `periodic` | 틱 루프 | 4초(120틱)마다 발동 |
| `on_enemy_death` | 유닛 사망 처리 | 적 사망 시 발동 |
| `on_hp_threshold` | HP 변경 후 | 각 중재자 유닛별 1회 체크 |
| `on_mana_spent` | 스킬 사용 후 | 글로벌 마나 소모 카운터, 50 도달 시 발동 리셋 |
| `combat_start_per_interest` | 전투 시작 시 | 이자 값 × 수치 적용 (시뮬레이션에서는 이자 입력 필요) |
| `combat_start_if_refreshed` | 전투 시작 시 | 리프레시 여부 입력 필요 |
| `combat_start_per_star` | 전투 시작 시 | 중재자 별레벨 합산 × 수치 |

**effect 타입별 처리:**

| effect | 적용 방식 |
|--------|----------|
| `mana` | 모든 중재자 currentMana += value |
| `ap` | 모든 중재자 stats.ap += value |
| `armor_mr` | 모든 중재자 stats.armor += value, stats.magicResist += value |
| `attack_speed` | 모든 중재자 stats.attackSpeed *= (1 + value/100) |
| `permanent_hp` | 모든 중재자 maxHp += value, currentHp += value |
| `shield` | 모든 중재자 shield += maxHp * value/100 (4초 후 제거) |
| `free_reroll` | 시뮬레이션 외부 효과 → 전투 결과에 확률 표시만 |
| `leona_drop` | 시뮬레이션 외부 효과 → 전투 결과에 확률 표시만 |
| `gold_drop` | 시뮬레이션 외부 효과 → 전투 결과에 확률 표시만 |

**전투 내 적용 가능 effect**: mana, ap, armor_mr, attack_speed, permanent_hp, shield (6종)
**전투 외 효과 (표시만)**: free_reroll, leona_drop, gold_drop (3종)

### 2.4 silver/gold 판별

중재자 유닛 수에 따라:
- 2 중재자 → `silver` 수치 사용
- 3+ 중재자 → `gold` 수치 사용

---

## 3. 수정 파일

| 파일 | 변경 |
|------|------|
| `src/hooks/useTeamManagement.ts` | `ArbiterLaw` state + setter 추가 |
| `src/components/builder/ArbiterLawPanel.tsx` | **신규** — trigger/effect 선택 UI |
| `src/app/simulator/page.tsx` | ArbiterLawPanel 렌더링 + 법률 데이터 전달 |
| `src/lib/simulator/engine/combatLoop.ts` | 법률 trigger 감지 + effect 적용 로직 |
| `src/types/index.ts` | `ArbiterLaw` 타입 정의 |

---

## 4. MVP 범위

**구현:**
- trigger/effect 선택 UI (드롭다운 2개)
- 전투 내 6종 effect 적용 (mana, ap, armor_mr, attack_speed, permanent_hp, shield)
- silver/gold 수치 자동 판별
- 전투 로그에 법률 발동 기록

**MVP 제외:**
- `combat_start_per_interest` (이자 입력 UI 필요 → 추후)
- `combat_start_if_refreshed` (리프레시 상태 추적 불가 → 추후)
- 전투 외 효과 (free_reroll, leona_drop, gold_drop) 확률 시뮬레이션
- 법률 프리셋/추천

---

## 5. 구현 순서

| 순서 | 작업 |
|------|------|
| 1 | `ArbiterLaw` 타입 + `arbiter_laws.json` 로드 |
| 2 | `ArbiterLawPanel` 선택 UI 컴포넌트 |
| 3 | `useTeamManagement`에 state 연결 |
| 4 | `combatLoop`에 trigger 감지 + effect 적용 |
| 5 | 전투 로그에 발동 기록 |
| 6 | lint/typecheck/build |
