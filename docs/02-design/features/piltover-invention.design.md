# Design: 필트오버 발명품 전투 효과 완전 구현

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 필트오버 발명품 전투 효과 |
| Plan 참조 | `docs/01-plan/features/piltover-invention.plan.md` |
| 작성일 | 2026-03-23 |
| 상태 | Design |

---

## 1. 아키텍처 설계

### 1.1 현재 구조의 문제

```
applyPiltoverInvention()
├── VoltageConduit: unit.maxMana *= 0.7  (하드코딩)
├── MicroRockets: 200 마법 피해  (하드코딩, JSON과 불일치)
└── KineticBarrier: maxHp * 0.25 보호막  (JSON은 방어력인데 보호막으로 잘못 구현)
    → 나머지 14개 모듈: 무시됨
```

### 1.2 목표 구조

```
applyPiltoverInvention()
├── 모듈 발견: unit.items에서 Piltover 아이템 필터
├── 효과 분류: 모듈 apiName → 핸들러 매핑
├── 효과 적용: item.effects[key]에서 수치 읽어 CombatUnit에 적용
└── 로그 생성: [발명품] 접두어 + 모듈명 + 실제 수치
```

핵심 원칙: **모든 수치는 `item.effects`에서 읽는다. 하드코딩 없음.**

### 1.3 함수 시그니처 변경

```typescript
// 변경 전: 아군 유닛만 순회
function applyPiltoverInvention(
  activeTraits: ActiveTrait[],
  teamUnits: CombatUnit[],
  tick: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  time: number,
): void

// 변경 후: 적 유닛도 받아야 함 (적 대상 데미지/CC 모듈용)
function applyPiltoverInvention(
  activeTraits: ActiveTrait[],
  teamUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  tick: number,
  logs: CombatLog[],
  tickLogs: CombatLog[],
  time: number,
  rng: SeededRNG,
): void
```

**이유**: ElectricalOverload(적 전체 데미지), 90CaliberNets(적 기절), EMP(적 마나 증가), MicroRockets(적 대상 데미지) 등 적 유닛에 효과를 적용하는 모듈이 다수. `rng`는 MicroRockets 타겟 선택에 필요.

### 1.4 호출부 변경

```typescript
// combatLoop.ts line 568-569 변경
// 변경 전:
applyPiltoverInvention(playerActiveTraits, playerUnits, tick, logs, tickLogs, time);
applyPiltoverInvention(enemyActiveTraits, enemies, tick, logs, tickLogs, time);

// 변경 후:
applyPiltoverInvention(playerActiveTraits, playerUnits, enemies, tick, logs, tickLogs, time, rng);
applyPiltoverInvention(enemyActiveTraits, enemies, playerUnits, tick, logs, tickLogs, time, rng);
```

---

## 2. 모듈별 상세 구현 설계

### 2.1 로그 헬퍼 함수

모든 모듈에서 공통으로 사용할 로그 생성 헬퍼:

```typescript
function pushInventionLog(
  logs: CombatLog[],
  tickLogs: CombatLog[],
  tick: number,
  time: number,
  sourceId: string,
  message: string,
  value?: number,
  targetId?: string,
): void {
  const log: CombatLog = { tick, time, type: 'ability', sourceId, message, value, targetId };
  logs.push(log);
  tickLogs.push(log);
}
```

### 2.2 우선순위 1 — 아군 버프 모듈

#### BlastShield (폭발 방패)
```typescript
// effects: { PercentHealthShield: 0.18 }
// 대상: 아군 전체 생존 유닛
const pct = item.effects['PercentHealthShield'] ?? 0.18;
const shieldAmt = Math.round(unit.maxHp * pct);
unit.shield += shieldAmt;
unit.statusEffects.push({ type: 'shield', sourceId: unit.id, remainingTicks: MAX_TICKS, value: shieldAmt });
// 로그: "[발명품] 폭발 방패 발동! 전체 아군 최대 체력 18% 보호막"
```

**적용 방식**: `teamUnits` 전체 생존 유닛에 보호막 부여. 로그는 1회만 생성.

#### OverclockedCapacitors (오버클럭 축전기)
```typescript
// effects: { AttackSpeed: 0.25 }
// 대상: 아군 전체
const asBonus = item.effects['AttackSpeed'] ?? 0.25;
for (const ally of aliveTeamUnits) {
  ally.stats.attackSpeed *= (1 + asBonus);
}
// 로그: "[발명품] 오버클럭 축전기 발동! 아군 공격 속도 +25%"
```

#### ContinuumCogs (연속 톱니)
```typescript
// effects: { AbilityPower: 15, ManaGen: 2 }
// 대상: 아군 전체
const apBonus = item.effects['AbilityPower'] ?? 15;
const manaGen = item.effects['ManaGen'] ?? 2;
for (const ally of aliveTeamUnits) {
  ally.stats.ap += apBonus;
  ally.augmentManaRegen += manaGen;
}
// 로그: "[발명품] 연속 톱니 발동! 아군 주문력 +15, 초당 마나 +2"
```

#### GigantificationRay (거대화 광선)
```typescript
// effects: { MaxHealthGain: 0.28 }
// 대상: 아군 전체
const hpGainPct = item.effects['MaxHealthGain'] ?? 0.28;
for (const ally of aliveTeamUnits) {
  const hpGain = Math.round(ally.maxHp * hpGainPct);
  ally.maxHp += hpGain;
  ally.currentHp += hpGain;
}
// 로그: "[발명품] 거대화 광선 발동! 아군 최대 체력 +28%"
```

#### KineticBarrier (역장 방벽) — **기존 잘못된 구현 수정**
```typescript
// effects: { HigherResist: 65, LowerResist: 30 }
// 대상: 아군 전체
// 높은 저항 = max(armor, mr), 낮은 저항 = min(armor, mr)
const higher = item.effects['HigherResist'] ?? 65;
const lower = item.effects['LowerResist'] ?? 30;
for (const ally of aliveTeamUnits) {
  if (ally.stats.armor >= ally.stats.magicResist) {
    ally.stats.armor += higher;
    ally.stats.magicResist += lower;
  } else {
    ally.stats.magicResist += higher;
    ally.stats.armor += lower;
  }
}
// 로그: "[발명품] 역장 방벽 발동! 높은 저항 +65, 낮은 저항 +30"
```

#### Upgrade (업그레이드)
```typescript
// effects: { AttackSpeed: 0.25, MaxHealth: 300 }
// 대상: 아군 전체
const as = item.effects['AttackSpeed'] ?? 0.25;
const hp = item.effects['MaxHealth'] ?? 300;
for (const ally of aliveTeamUnits) {
  ally.stats.attackSpeed *= (1 + as);
  ally.maxHp += hp;
  ally.currentHp += hp;
}
// 로그: "[발명품] 업그레이드 발동! 아군 공속 +25%, 체력 +300"
```

#### VoltageConduit (전압 도관) — JSON 데이터로 전환
```typescript
// effects: { ManaReduction: 0.30 }
// 대상: 아군 필트오버 유닛 (필트오버 아이템 장착 유닛)
const reduction = item.effects['ManaReduction'] ?? 0.30;
// 기존 로직 유지하되 하드코딩 제거
unit.maxMana = Math.round(unit.maxMana * (1 - reduction));
// 로그: "[발명품] 전압 도관 발동! 최대 마나 30% 감소"
```

**특이사항**: VoltageConduit는 팀 전체가 아닌 장착 유닛에만 적용.

### 2.3 우선순위 2 — 데미지/CC 모듈

#### ElectricalOverload (전기 과부하)
```typescript
// effects: { FlatDamage: 50, MaxHealthRatio: 0.10 }
// 대상: 적 전체
const flat = item.effects['FlatDamage'] ?? 50;
const maxHpPct = item.effects['MaxHealthRatio'] ?? 0.10;
for (const enemy of aliveEnemyUnits) {
  const rawDmg = flat + Math.round(enemy.maxHp * maxHpPct);
  const finalDmg = applyResistance(rawDmg, enemy.stats.magicResist);
  enemy.currentHp -= finalDmg;
  enemy.totalDamageTaken += finalDmg;
  // 사망 처리는 메인 루프에서 체크
}
// 로그: "[발명품] 전기 과부하 발동! 적 전체에 50 + 최대 체력 10% 마법 피해"
```

#### MicroRockets (마이크로 로켓) — JSON 데이터로 전환
```typescript
// effects: { DamageRepeat: 0.66, NumMissiles: 16 }
// 대상: 무작위 적 유닛에게 미사일 분배
const adRatio = item.effects['DamageRepeat'] ?? 0.66;
const numMissiles = item.effects['NumMissiles'] ?? 16;
const dmgPerMissile = Math.round(unit.stats.damage * adRatio);

for (let i = 0; i < numMissiles; i++) {
  const target = aliveEnemyUnits[Math.floor(rng.next() * aliveEnemyUnits.length)];
  if (!target) break;
  const finalDmg = applyResistance(dmgPerMissile, target.stats.armor, unit.stats.armorPen);
  target.currentHp -= finalDmg;
  target.totalDamageTaken += finalDmg;
}
// 로그: "[발명품] {유닛}의 마이크로 로켓 발동! 미사일 16발 (각 AD 66% 물리 피해)"
```

#### 90CaliberNets (90구경 그물)
```typescript
// effects: { Duration: 2, NumEnemies: 3 }
// 대상: 무작위 적 3명 기절
const duration = item.effects['Duration'] ?? 2;
const numTargets = item.effects['NumEnemies'] ?? 3;
const stunTicks = Math.round(duration * TICKS_PER_SECOND);

const targets = pickRandomN(aliveEnemyUnits, numTargets, rng);
for (const enemy of targets) {
  enemy.statusEffects.push({ type: 'stun', sourceId: unit.id, remainingTicks: stunTicks });
  enemy.state = 'idle';
  enemy.attackCooldown = 0;
}
// 로그: "[발명품] 90구경 그물 발동! 적 3명 기절 2초"
// + 각 대상에 status_apply 로그
```

**헬퍼 필요**: `pickRandomN(arr, n, rng)` — 배열에서 무작위 n개 선택 (결정론적).

#### EMP
```typescript
// effects: { ManaCostIncrease: 15 }
// 대상: 적 전체
const manaIncrease = item.effects['ManaCostIncrease'] ?? 15;
for (const enemy of aliveEnemyUnits) {
  enemy.maxMana += manaIncrease;
}
// 로그: "[발명품] EMP 발동! 적 전체 최대 마나 +15"
```

#### MagnetronCoil (마그네트론 코일)
```typescript
// effects: { BaseDamageAmp: 0.16, DamageAmpPerCast: 0.01 }
// 대상: 아군 전체 (BaseDamageAmp만 즉시 적용, PerCast는 후순위)
const baseAmp = item.effects['BaseDamageAmp'] ?? 0.16;
for (const ally of aliveTeamUnits) {
  ally.damageAmp += baseAmp;
}
// 로그: "[발명품] 마그네트론 코일 발동! 아군 피해증폭 +16%"
```

**DamageAmpPerCast 처리**: 스킬 시전 시마다 damageAmp를 추가로 증가시키려면 `on_cast` 이벤트 핸들러 등록이 필요. 이번 구현에서는 BaseDamageAmp만 적용하고, PerCast는 후순위로 분류.

#### ArmorNullifier (방어구 무효화기)
```typescript
// effects: { BaseDamageAmp: 0.25, TankDamageAmp: 0.45 }
// 대상: 아군 전체 (BaseDamageAmp 적용)
// 탱커 대상 차등 피해증폭은 damageAmp 필드만으로는 표현 불가 → 단순화
const baseAmp = item.effects['BaseDamageAmp'] ?? 0.25;
for (const ally of aliveTeamUnits) {
  ally.damageAmp += baseAmp;
}
// 로그: "[발명품] 방어구 무효화기 발동! 아군 피해증폭 +25%"
```

**TankDamageAmp 차등 적용**: 현재 `damageAmp`는 대상 구분 없이 일괄 적용. 탱커 대상 차등 증폭은 CombatUnit에 `inventionTankDamageAmp` 필드를 추가하거나, 데미지 계산부에서 대상 role을 확인하는 방식이 필요. → **CombatUnit 필드 추가로 구현**.

---

## 3. CombatUnit 타입 확장

```typescript
// src/types/index.ts — CombatUnit에 추가
export interface CombatUnit {
  // ... 기존 필드 ...

  /** 발명품 탱커 대상 추가 피해증폭 (ArmorNullifier) */
  inventionTankDamageAmp: number;
}
```

### 3.1 데미지 계산 반영

```typescript
// combatLoop.ts — 공격 데미지 계산부 (line 608)
// 변경 전:
const rawDamage = unit.stats.damage * critMult * (1 + unit.damageAmp);

// 변경 후:
let totalDamageAmp = unit.damageAmp;
if (unit.inventionTankDamageAmp > 0 && target.role === 'tank') {
  totalDamageAmp += unit.inventionTankDamageAmp;
}
const rawDamage = unit.stats.damage * critMult * (1 + totalDamageAmp);
```

어빌리티 데미지 계산부(line 704)에도 동일하게 적용.

---

## 4. 팀 레벨 vs 유닛 레벨 적용 구분

현재 `applyPiltoverInvention()`은 **유닛별 아이템**을 순회하지만, 대부분의 모듈은 **팀 전체**에 효과를 적용한다. 중복 적용 방지가 핵심.

### 4.1 적용 범위 분류

| 적용 범위 | 모듈 |
|----------|------|
| **팀 전체 (1회만)** | BlastShield, OverclockedCapacitors, ContinuumCogs, GigantificationRay, KineticBarrier, Upgrade, ElectricalOverload, 90CaliberNets, EMP, MagnetronCoil, ArmorNullifier, AccelerationGate |
| **장착 유닛만** | VoltageConduit, MicroRockets |

### 4.2 중복 방지 전략

```typescript
// 팀 모듈은 Set으로 이미 처리된 apiName 추적
const processedModules = new Set<string>();

for (const unit of aliveTeamUnits) {
  for (const item of unit.items) {
    if (!item.apiName.includes('TFT16_Item_Piltover_')) continue;
    const moduleKey = item.apiName;

    if (isUnitScopedModule(moduleKey)) {
      // VoltageConduit, MicroRockets → 유닛별 적용
      applyUnitScopedModule(moduleKey, unit, ...);
    } else if (!processedModules.has(moduleKey)) {
      // 팀 전체 모듈 → 1회만 적용
      applyTeamScopedModule(moduleKey, item, aliveTeamUnits, aliveEnemyUnits, ...);
      processedModules.add(moduleKey);
    }
  }
}
```

---

## 5. 헬퍼 함수

### 5.1 pickRandomN

```typescript
/** 배열에서 무작위 n개 선택 (결정론적, 중복 없음) */
function pickRandomN<T>(arr: T[], n: number, rng: SeededRNG): T[] {
  const copy = [...arr];
  const result: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng.next() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}
```

### 5.2 모듈 한글명 매핑

```typescript
const PILTOVER_MODULE_NAMES: Record<string, string> = {
  '90CaliberNets': '90구경 그물',
  'BlastShield': '폭발 방패',
  'ElectricalOverload': '전기 과부하',
  'EMP': 'EMP',
  'OverclockedCapacitors': '오버클럭 축전기',
  'TunedOscillator': '튜닝된 오실레이터',
  'ContinuumCogs': '연속 톱니',
  'GigantificationRay': '거대화 광선',
  'KineticBarrier': '역장 방벽',
  'MagnetronCoil': '마그네트론 코일',
  'MicroRockets': '마이크로 로켓',
  'AccelerationGate': '가속의 문',
  'Upgrade': '업그레이드',
  'ArmorNullifier': '방어구 무효화기',
  'EchoEngine': '에코 엔진',
  'MiningDrill': '채굴 드릴',
  'SuperiorLifeform': '우월한 생명체',
  'VoltageConduit': '전압 도관',
  'MomentumDrive': '모멘텀 드라이브',
  'UnstableCore': '불안정한 코어',
};

function getModuleShortName(apiName: string): string {
  const key = apiName.replace('TFT16_Item_Piltover_', '');
  return PILTOVER_MODULE_NAMES[key] ?? key;
}
```

---

## 6. 구현 순서

| Step | 내용 | 파일 |
|------|------|------|
| 1 | `CombatUnit`에 `inventionTankDamageAmp` 필드 추가 | `src/types/index.ts` |
| 2 | CombatUnit 초기화 코드에 `inventionTankDamageAmp: 0` 추가 | `combatLoop.ts` (3곳) |
| 3 | `applyPiltoverInvention()` 시그니처 변경 (enemyUnits, rng 추가) | `combatLoop.ts` |
| 4 | 호출부 변경 (enemyUnits, rng 전달) | `combatLoop.ts` (2곳) |
| 5 | 헬퍼 함수 추가 (pushInventionLog, pickRandomN, PILTOVER_MODULE_NAMES, getModuleShortName) | `combatLoop.ts` |
| 6 | 우선순위 1 모듈 구현 (7개 스탯 버프) | `combatLoop.ts` |
| 7 | 우선순위 2 모듈 구현 (6개 데미지/CC) | `combatLoop.ts` |
| 8 | ArmorNullifier 탱커 차등 적용 — 데미지 계산부 수정 (2곳) | `combatLoop.ts` |
| 9 | 빌드 검증 (`pnpm lint && pnpm typecheck && pnpm build`) | — |

---

## 7. 후순위 (이번 구현 범위 밖)

| 모듈 | 사유 |
|------|------|
| AccelerationGate | 시간 제한 마나 회복 → 별도 틱 추적 필요 |
| TunedOscillator | 회복·보호막 증폭 → 시스템 전반 수정 |
| EchoEngine | 다른 모듈 효과 반복 → 재귀 적용 |
| SuperiorLifeform | 복제체 소환 → 유닛 동적 생성 |
| MomentumDrive | CC 정화 + 강인함 → CC 시스템 확장 |
| UnstableCore | 시전 횟수 추적 → 유닛별 카운터 필요 |
| MiningDrill | 전투 외 효과 → 시뮬레이터 범위 밖 |
| MagnetronCoil.DamageAmpPerCast | 시전당 증폭 → on_cast 이벤트 핸들러 등록 필요 |

---

## 8. 테스트 시나리오

1. **BlastShield**: 필트오버 2 + BlastShield 선택 → 발동 시 아군 전체에 maxHp 18% 보호막, 로그에 `[발명품] 폭발 방패` 표시
2. **KineticBarrier 수정 확인**: armor 60, mr 40인 유닛 → 발동 후 armor 125(+65), mr 70(+30)
3. **ElectricalOverload**: 적 유닛에 50 + maxHp 10% 마법 피해 적용, 저항 계산 포함
4. **MicroRockets**: 16발 미사일이 적에게 분배, 각 AD 66% 물리 피해
5. **90CaliberNets**: 무작위 적 3명에 stun 2초 적용, status_apply 로그 생성
6. **ArmorNullifier**: 일반 유닛 대상 피해증폭 25%, Tank role 대상 45%
7. **중복 방지**: 같은 모듈 여러 유닛에 장착 시 팀 버프는 1회만 적용
8. **결정론적**: 동일 시드에서 MicroRockets/90CaliberNets 타겟이 동일
