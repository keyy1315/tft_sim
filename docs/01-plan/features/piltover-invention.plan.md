# Plan: 필트오버 발명품 전투 효과 완전 구현

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 필트오버 발명품 전투 효과 |
| 작성일 | 2026-03-23 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | `applyPiltoverInvention()`이 17개 모듈 중 3개(VoltageConduit, MicroRockets, KineticBarrier)만 처리하며, 수치도 하드코딩되어 JSON 데이터와 불일치. 나머지 14개 모듈은 발동해도 아무 효과 없음 |
| **Solution** | 전체 17개 모듈의 효과를 JSON `effects` 데이터 기반으로 구현하고, 발동 시 전투 로그에 모듈명·수치를 포함한 이벤트 기록 |
| **Function UX Effect** | 발명품 발동 시 전투 로그에 "진의 폭발 방패 발동! 최대 체력 18% 보호막(360)" 형태로 표시되며, 데미지·보호막·방어력·피해증폭 등 수치가 실제 모듈 데이터대로 적용됨 |
| **Core Value** | 필트오버 시너지의 전투 시뮬레이션 정확도가 완성되어, 모듈 선택에 따른 전투력 차이를 정량적으로 분석할 수 있음 |

---

## 1. 현재 상태 분석

### 1.1 applyPiltoverInvention() (현재)

```typescript
// src/lib/simulator/engine/combatLoop.ts (line 381-433)
function applyPiltoverInvention(...): void {
  // 3개 모듈만 처리:
  // - VoltageConduit: 최대 마나 30% 감소 (하드코딩)
  // - MicroRockets: 200 마법 피해 (하드코딩, JSON의 DamageRepeat·NumMissiles 미사용)
  // - KineticBarrier: 최대 체력 25% 보호막 (하드코딩, JSON의 HigherResist·LowerResist 미사용)
}
```

**문제점:**
1. 17개 모듈 중 3개만 구현됨
2. 구현된 3개도 JSON `effects` 데이터를 읽지 않고 하드코딩
3. KineticBarrier는 JSON에 방어력(`HigherResist`/`LowerResist`)이 정의되어 있으나, 보호막으로 잘못 구현
4. 미구현 모듈 발동 시 전투 로그에 아무것도 남지 않음

### 1.2 필트오버 모듈 전체 목록 (JSON 데이터 기준)

#### 티어 2 (필트오버 2 활성화)

| apiName | 한글명 | effects 키 | 효과 설명 |
|---------|--------|-----------|----------|
| `90CaliberNets` | 90구경 그물 | `Duration: 2`, `NumEnemies: 3` | 적 3명 기절 2초 |
| `BlastShield` | 폭발 방패 | `PercentHealthShield: 0.18` | 아군 최대 체력 18% 보호막 |
| `ElectricalOverload` | 전기 과부하 | `FlatDamage: 50`, `MaxHealthRatio: 0.10` | 적 전체에 50 + 최대체력 10% 피해 |
| `EMP` | EMP | `ManaCostIncrease: 15` | 적 전체 다음 스킬 마나 소모 +15 |
| `OverclockedCapacitors` | 오버클럭 축전기 | `AttackSpeed: 0.25` | 아군 공속 25% 증가 |
| `TunedOscillator` | 튜닝된 오실레이터 | `HealingShielding: 0.28` | 아군 회복·보호막 28% 증가 |
| `ContinuumCogs` | 연속 톱니 | `AbilityPower: 15`, `ManaGen: 2` | 아군 주문력 +15, 초당 마나 +2 |

#### 티어 4 (필트오버 4 활성화)

| apiName | 한글명 | effects 키 | 효과 설명 |
|---------|--------|-----------|----------|
| `GigantificationRay` | 거대화 광선 | `MaxHealthGain: 0.28`, `SizeIncrease: 0.30` | 아군 최대 체력 28% 증가 |
| `KineticBarrier` | 역장 방벽 | `HigherResist: 65`, `LowerResist: 30` | 아군 높은 저항 +65, 낮은 저항 +30 |
| `MagnetronCoil` | 마그네트론 코일 | `BaseDamageAmp: 0.16`, `DamageAmpPerCast: 0.01` | 피해증폭 16% + 스킬 시전당 1% 추가 |
| `MicroRockets` | 마이크로 로켓 | `DamageRepeat: 0.66`, `NumMissiles: 16` | 미사일 16발, 각 AD 66% 피해 |
| `AccelerationGate` | 가속의 문 | `ManaRefill: 0.35`, `RefillDuration: 2` | 아군 마나 35% 회복, 2초간 |

#### 티어 6 (필트오버 6 활성화)

| apiName | 한글명 | effects 키 | 효과 설명 |
|---------|--------|-----------|----------|
| `Upgrade` | 업그레이드 | `AttackSpeed: 0.25`, `MaxHealth: 300` | 아군 공속 25% + 체력 300 |
| `ArmorNullifier` | 방어구 무효화기 | `BaseDamageAmp: 0.25`, `TankDamageAmp: 0.45` | 피해증폭 25%, 탱커 대상 45% |
| `EchoEngine` | 에코 엔진 | `RepeatSeconds: 7` | 7초마다 다른 모듈 효과 반복 |
| `MiningDrill` | 채굴 드릴 | `CastBreakpoint: 0.80`, `GoldChance: 0.70` | 전투 전용(시뮬레이터에서 제외 가능) |
| `SuperiorLifeform` | 우월한 생명체 | `DamageOutput: 0.50`, `NumUnitsToCopy: 2`, `PercentHealthOfOriginal: 0.40` | 복제체 2개 소환 |

#### 기타 (traitModules.ts에 미포함)

| apiName | 한글명 | effects 키 | 효과 설명 |
|---------|--------|-----------|----------|
| `VoltageConduit` | 전압 도관 | `ManaReduction: 0.30` | 필트오버 유닛 최대 마나 30% 감소 |
| `MomentumDrive` | 모멘텀 드라이브 | `Tenacity: 0.50` | CC 정화 + 강인함 50% |
| `UnstableCore` | 불안정한 코어 | `CastBreakpoint: 10`, `FailureMaxHealthDamage: 0.15`, `SuccessMaxHealthDamage: 0.30` | 10회 시전 달성 시 적 최대체력 30% 피해, 실패 시 15% |

### 1.3 전투 로그 시스템 (현재)

```typescript
// CombatLog.type:
'attack' | 'ability' | 'move' | 'death' | 'mana' | 'status_apply' | 'status_expire'
```

발명품 발동은 `type: 'ability'`로 기록하는 것이 적절. 현재 MicroRockets와 KineticBarrier만 로그 남김.

---

## 2. 구현 범위

### 2.1 MVP 구현 대상 모듈 (전투 시뮬레이션에 직접 영향)

**우선순위 1 — 스탯 버프 (단순 적용)**
- `BlastShield`: 보호막 (최대 체력 %)
- `OverclockedCapacitors`: 공속 버프
- `ContinuumCogs`: 주문력 + 마나 재생
- `GigantificationRay`: 최대 체력 증가
- `KineticBarrier`: 방어력(armor/MR) 버프 (현재 잘못 구현 → 수정)
- `Upgrade`: 공속 + 체력
- `VoltageConduit`: 마나 감소 (이미 구현, JSON 데이터로 전환)

**우선순위 2 — 데미지/CC**
- `ElectricalOverload`: 적 전체 데미지
- `MicroRockets`: 미사일 데미지 (현재 구현, JSON 데이터로 전환)
- `90CaliberNets`: 적 기절
- `EMP`: 적 마나 소모 증가
- `MagnetronCoil`: 피해증폭 버프
- `ArmorNullifier`: 피해증폭 (탱커 대상 차등)

**우선순위 3 — 복잡한 메커니즘 (후순위)**
- `AccelerationGate`: 마나 회복 (시간 제한)
- `TunedOscillator`: 회복·보호막 증폭 (시스템 전반 수정 필요)
- `EchoEngine`: 모듈 효과 반복 (재귀적 적용)
- `SuperiorLifeform`: 복제체 소환 (유닛 생성)
- `MomentumDrive`: CC 정화 + 강인함 (CC 시스템 확장 필요)
- `UnstableCore`: 시전 횟수 추적 조건부 효과
- `MiningDrill`: 전투 외 효과 (시뮬레이터 제외)

### 2.2 CombatLog 타입

`type: 'ability'`를 그대로 사용하되, `message`에 모듈명과 수치를 명시적으로 포함.

```typescript
// 로그 메시지 포맷 예시
"[발명품] 진의 폭발 방패 발동! 최대 체력 18% 보호막 (360)"
"[발명품] 전기 과부하 발동! 적 전체에 50 + 최대체력 10% 피해"
"[발명품] 마그네트론 코일 발동! 피해증폭 16%"
"[발명품] 방어구 무효화기 발동! 피해증폭 25% (탱커 45%)"
"[발명품] 역장 방벽 발동! 방어력 +65, 마법저항력 +30"
```

### 2.3 CombatUnit 확장

```typescript
// 발명품으로 인한 피해증폭을 저장할 필드
augmentDamageAmp: number;      // 이미 존재 → 발명품 피해증폭도 여기에 합산
augmentBurnPercent: number;    // 기존
// 추가 필요 없음 — 기존 CombatUnit 필드로 충분
```

---

## 3. 구현 계획

### 3.1 단계별 구현

**Step 1: JSON 데이터 연동 구조**
- `applyPiltoverInvention()`에서 `unit.items`의 `effects` 데이터를 직접 참조
- 하드코딩 수치 제거 → `item.effects[key]` 사용

**Step 2: 스탯 버프 모듈 구현 (우선순위 1)**
- 각 모듈의 효과를 CombatUnit 속성에 적용
- 발동 시 CombatLog 기록

**Step 3: 데미지/CC 모듈 구현 (우선순위 2)**
- ElectricalOverload: 적 전체에 데미지 적용
- 90CaliberNets: 적에 stun status effect 적용
- MagnetronCoil/ArmorNullifier: `augmentDamageAmp` 필드에 합산

**Step 4: 전투 로그 통합**
- 모든 모듈 발동 시 `[발명품]` 접두어 포함 로그 생성
- 수치 포함 (적용된 실제 값)

### 3.2 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/simulator/engine/combatLoop.ts` | `applyPiltoverInvention()` 전면 리팩토링 |
| `src/types/index.ts` | 필요 시 CombatUnit에 발명품 관련 필드 추가 |

### 3.3 변경하지 않는 것

- `traitModules.ts`: 기존 모듈 목록 구조 유지
- `PiltoverModulePanel.tsx`: UI 변경 없음 (전투 로직만 수정)
- `CombatLog` 인터페이스: 기존 타입 그대로 사용 (`type: 'ability'`)
- 이벤트 로그 UI: 이미 `ability` 타입 렌더링 지원

---

## 4. 수용 기준

1. **전투 로그**: 선택된 모든 필트오버 모듈이 발동 시 전투 로그에 `[발명품]` 접두어와 함께 모듈명·수치가 표시된다
2. **데미지 적용**: ElectricalOverload, MicroRockets 등 데미지 모듈이 JSON `effects` 값에 따라 정확한 피해를 입힌다
3. **보호막 적용**: BlastShield는 최대 체력 18% 보호막을 정확히 부여한다
4. **방어력 적용**: KineticBarrier는 방어력/마저 버프를 부여한다 (현재 보호막 → 수정)
5. **피해증폭 적용**: MagnetronCoil(16%), ArmorNullifier(25%/45%)가 유닛의 피해 계산에 반영된다
6. **JSON 기반**: 모든 수치가 `tft_set16_items.json`의 `effects`에서 읽히며 하드코딩 없음
7. **결정론적**: 동일 시드로 동일 결과 보장
8. **빌드 통과**: `pnpm lint && pnpm typecheck && pnpm build` 전부 통과
