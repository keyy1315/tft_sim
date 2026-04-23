# Design: 전투 내 챔피언 스케일링 시스템

## 1. CombatUnit 확장

### 1.1 카운터 필드 추가 (`src/types/index.ts`)

```typescript
// CombatUnit에 추가
attackCount: number;    // 기본공격 누적 횟수
castCount: number;      // 스킬 사용 누적 횟수
killCount: number;      // 처치 수
```

`createCombatUnit`에서 0으로 초기화.

### 1.2 카운터 증가 지점 (`combatLoop.ts`)

| 이벤트 | 위치 (현재 라인) | 증가 코드 |
|--------|----------------|----------|
| 기본공격 성공 | ~1496 `unit.state = 'attacking'` | `unit.attackCount++` |
| 스킬 시전 | ~1511 `unit.state = 'casting'` | `unit.castCount++` |
| 적 처치 (공격) | ~1600 `t.state = 'dead'` (스킬) | `unit.killCount++` |
| 적 처치 (자동공격) | 자동공격 후 HP <= 0 체크 추가 필요 | `unit.killCount++` |

---

## 2. 챔피언별 스케일링 구현

### 2.1 패시브 (매 틱/전투 시작)

#### 브라이어 — 잃은 체력당 AS
- **위치**: 매 틱 유닛 루프 시작 (unit.state !== 'dead' 직후)
- **로직**: `missingHpPct = 1 - (currentHp / maxHp)` → AS 보너스 = `missingHpPct * 2% * AP스케일`
- **CDragon 변수**: `PercentMissingHealth=1`, `AS=[2, 2, 2, 2.5]` → 잃은 HP 1%당 AS 2%
- **적용**: `getEffectiveAttackSpeed` 호출 전에 임시 AS 보너스 적용

```typescript
if (unit.champion.apiName === 'TFT17_Briar') {
  const missingPct = 1 - (unit.currentHp / unit.maxHp);
  const asPerPct = 0.02 * (1 + unit.stats.ap / 100);
  unit._tempASBonus = missingPct * asPerPct * 100;
}
```

#### 진 — AS → AD 전환
- **위치**: 유닛 생성 후 (전투 시작 1회)
- **CDragon 변수**: `FixedAS=0.85`, `PercentBonusASToConvert=0.8`, `ADConversionRate=?`
- **로직**: `bonusAS = (totalAS - fixedAS)` → `bonusAD = bonusAS * 0.8 * conversionRate` → AD에 가산, AS를 fixedAS로 고정

```typescript
if (unit.champion.apiName === 'TFT17_Jhin') {
  const fixedAS = 0.85;
  const bonusAS = unit.stats.attackSpeed - fixedAS;
  if (bonusAS > 0) {
    unit.stats.damage += Math.round(bonusAS * 100 * 0.8);
    unit.stats.attackSpeed = fixedAS;
  }
}
```

### 2.2 N회 트리거

#### 공통 처리 패턴

기본공격 성공 직후 (`unit.attackCount++` 이후):

```typescript
// N회 트리거 체크
const scaling = CHAMPION_SCALING[unit.champion.apiName];
if (scaling?.trigger === 'onAttack' && unit.attackCount % scaling.every === 0) {
  applyScalingEffect(unit, scaling.effect, target, ...);
}
```

#### 나르 — 공격 5회마다 부메랑
- **CDragon**: `DamageAD` 기반 물리 피해, `DamageReductionPerHit=0.3` (관통 시 30% 감소)
- **구현**: 5회째 공격 시 타겟 + 관통 2칸 적에게 추가 물리 피해

#### 마스터 이 — 공격 3회마다 연속 베기
- **CDragon**: `PassiveDamage` = AD 스케일 추가 물리 피해
- **구현**: 3회째 공격 시 대상에게 추가 물리 피해 (별도 hit)

#### 피오라 — 공격 2회마다 급소
- **CDragon**: `VitalDamage=[50, 40, 60, 777]` 고정 피해, `PercentHealing=0.15` 피해량의 15% 회복
- **구현**: 2회째 공격 시 대상에게 고정 피해 + 회복

### 2.3 이벤트 트리거

#### 카이사 — 처치 관여 시 마나
- **CDragon**: `ManaPerKill=10`
- **위치**: 적 사망 처리 직후 (처치자 + 같은 팀 카이사)
- **구현**: `unit.currentMana += 10` (maxMana 초과 안 하도록)

#### 사미라 — 적 공중 띄움 시 추가 피해
- **CDragon**: `PassiveAD`, `PassiveAP` 기반 물리 피해
- **위치**: 스턴(공중) 적용 직후
- **구현**: 같은 팀 사미라가 있으면 공중 뜬 적에게 자동 추가 피해

#### 쉔 — 스킬 사용마다 중첩
- **CDragon**: `BonusDamageOnAttack` = 스킬 사용마다 기본공격 추가 마법 피해 중첩
- **위치**: 스킬 시전 직후 (`castCount++` 이후)
- **구현**: `_shenStacks++` → 기본공격 시 스택 × bonusDamage 추가

#### 자야 — 스킬 사용 시 AS 버프 + 깃털
- **CDragon**: `AttackSpeed`, `Duration`
- **위치**: 스킬 시전 직후
- **구현**: AS 버프 statusEffect 추가 → 지속시간 후 깃털 회수 피해

---

## 3. 시너지 전투 버프

### 3.1 전투 시작 시 적용 (유닛 생성 후)

| 시너지 | apiName | 효과 변수 | 적용 방식 |
|--------|---------|----------|----------|
| **도전자** | TFT17_ASTrait | `TeamwideAS`, `AttackSpeedPercent` | 아군 전체 AS + 도전자 추가 AS |
| **습격자** | TFT17_MeleeTrait | `TeamwideBonus`, `Omnivamp`, `AD` | 아군 흡혈 + 습격자 AD/추가흡혈 |
| **전달자** | TFT17_ManaTrait | `TeamManaRegen`, `ChannelerManaRegen` | 아군 마나젠 + 전달자 추가 |
| **구원자** | TFT17_RhaastUniqueTrait | `BonusOffensiveStat`, `BonusDefensiveStat` | 활성 특성당 AS/방어력/마저 |
| **불한당** | TFT17_AssassinTrait | `AP` | AD/AP 획득 |

### 3.2 전투 중 동적 효과

| 시너지 | 트리거 | 효과 |
|--------|--------|------|
| **도전자** | 대상 사망 | 새 대상 돌진 + N초 AS 버스트 |
| **불한당** | 체력 50% 이하 | 은신 (대상 변경 유도) |
| **우주 그루브** | 그루브 상태 | 그루비안당 AS + 체력 재생 |

---

## 4. 데이터 구조

### 4.1 CHAMPION_SCALING 설정 (`ability.ts`)

```typescript
export interface ChampionScaling {
  trigger: 'onAttack' | 'onCast' | 'onKill' | 'onAssist' | 'passive';
  every?: number;
  effect: {
    type: 'extraDamage' | 'attackSpeed' | 'mana' | 'bonusAD' | 'trueDamage' | 'heal';
    value: number | number[];  // 성급별 [1성, 2성, 3성]
    damageType?: 'physical' | 'magic' | 'true';
    duration?: number;         // 초
  };
}

export const CHAMPION_SCALING: Partial<Record<string, ChampionScaling>> = {
  TFT17_Briar:     { trigger: 'passive', effect: { type: 'attackSpeed', value: 2 } },
  TFT17_Gnar:      { trigger: 'onAttack', every: 5, effect: { type: 'extraDamage', value: [80, 120, 190], damageType: 'physical' } },
  TFT17_MasterYi:  { trigger: 'onAttack', every: 3, effect: { type: 'extraDamage', value: [60, 90, 140], damageType: 'physical' } },
  TFT17_Fiora:     { trigger: 'onAttack', every: 2, effect: { type: 'trueDamage', value: [40, 60, 777] } },
  TFT17_Kaisa:     { trigger: 'onAssist', effect: { type: 'mana', value: 10 } },
  TFT17_Samira:    { trigger: 'passive', effect: { type: 'extraDamage', value: [50, 75, 120], damageType: 'physical' } },
  TFT17_Shen:      { trigger: 'onCast', effect: { type: 'bonusAD', value: [15, 20, 35] } },
  TFT17_Xayah:     { trigger: 'onCast', effect: { type: 'attackSpeed', value: 40, duration: 4 } },
  TFT17_Jhin:      { trigger: 'passive', effect: { type: 'bonusAD', value: 0 } },  // 특수 처리
  TFT17_Teemo:     { trigger: 'onAttack', every: 1, effect: { type: 'extraDamage', value: [20, 30, 50], damageType: 'magic' } },
};
```

---

## 5. Dash/이동 스킬 마나 기반 시전 버그 수정

### 5.1 현재 문제

combatLoop에서 스킬 시전(`unit.currentMana >= unit.maxMana`)은 **기본공격 성공 블록(`canAttack` 내부)**에서만 체크됨.

→ dash 스킬을 가진 챔피언이 사거리 밖에 있으면 마나가 가득 차도 스킬 시전 불가.
→ 이동만 반복하다가 사거리 안에 들어와야만 기본공격 → 마나 체크 → 스킬 시전 가능.

실제 게임: 마나가 가득 차면 사거리와 무관하게 dash/self_buff 스킬 즉시 시전.

### 5.2 영향 받는 Set 17 챔피언 (dash 있음, range 1~2)

| 챔피언 | dash | pattern | 증상 |
|--------|------|---------|------|
| **피즈** | `to_target` | line | 사거리 밖에서 마나젠으로 마나 차도 스킬 미시전 |
| **탈론** | `to_target` | single | 사거리 밖 이동 중 스킬 시전 불가 |
| **파이크** | `to_target` | aoe_circle r=1 | 동일 |
| **리븐** | `to_target` | aoe_circle r=1 | 동일 |
| **피오라** | `to_target` | single | 동일 |
| **그웬** | `to_lowest_hp` | cone r=2 | 동일 |
| **아칼리** | `to_target` | line | 동일 |
| **코르키** | `to_target` | aoe_circle r=2 | 사거리 3이라 덜 심각 |
| **킨드레드** | `to_farthest` | multi | 사거리 4라 덜 심각 |

### 5.3 영향 받는 Set 17 챔피언 (self_buff, range 1)

| 챔피언 | pattern | 증상 |
|--------|---------|------|
| **다이애나** | aoe_circle r=1 + selfBuff | 사거리 밖 이동 중 보호막+구체 시전 불가 |
| **마스터 이** | self_buff | 사거리 밖 이동 중 AS 버프 시전 불가 |
| **제드** | self_buff | 분신 소환 시전 불가 |

### 5.4 수정 방안

combatLoop tick 루프에서 `canAttack` 블록 **이전에** 마나 충분 + dash/self_buff 스킬인 경우 스킬 시전 분기 추가:

```typescript
// 사거리 밖이지만 마나 충분 + dash/self_buff → 즉시 시전
if (!canAttack(unit.position, target.position, unit.stats.range)
    && unit.currentMana >= unit.maxMana
    && unit.attackCooldown <= 0) {
  const config = getAbilityConfigForUnit(unit, augNames);
  if (config.dash || config.pattern === 'self_buff') {
    // 스킬 시전 (기존 시전 로직 재사용)
    unit.currentMana = 0;
    unit.state = 'casting';
    unit.castCount++;
    // ... 기존 ability 처리 로직 ...
  }
}
```

### 5.5 주의사항

- dash 없고 self_buff도 아닌 원거리 스킬(ex: aoe_circle 원거리)은 **사거리 안에서만 시전** 유지
- `canAutoAttack(unit)` 체크는 스킬 시전과 무관 — 스턴 중에는 `canAct`에서 이미 걸러짐
- 마나 소모 후 즉시 dash → 대상 인접 → 스킬 피해 적용 순서 유지

---

## 6. combatLoop 수정 지점 요약

```
combatLoop tick 루프:
│
├── [매 틱] 브라이어 패시브 AS 계산
│
├── [마나 충분 + 사거리 밖 + dash/self_buff] ← 신규
│   └── 즉시 스킬 시전 (dash → 이동 → 피해)
│
├── [기본공격 성공 후]
│   ├── unit.attackCount++
│   ├── N회 트리거 체크 (나르/마스터이/피오라/티모)
│   └── 쉔 중첩 추가 피해 적용
│
├── [스킬 시전 후]
│   ├── unit.castCount++
│   ├── 쉔 스택 증가
│   └── 자야 AS 버프 적용
│
├── [적 사망 후]
│   ├── 처치자.killCount++
│   ├── 카이사 마나 획득 (같은 팀)
│   ├── 도전자 버스트 AS 적용
│   └── 사미라 공중 피해 (stun 적용 시)
│
└── [전투 시작 1회]
    ├── 진 AS→AD 전환
    └── 시너지 버프 적용 (도전자/습격자/전달자/구원자/불한당)
```

---

## 7. 수정 파일 목록

| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/types/index.ts` | CombatUnit에 attackCount/castCount/killCount |
| 2 | `src/lib/simulator/systems/ability.ts` | ChampionScaling 타입 + CHAMPION_SCALING 데이터 |
| 3 | `src/lib/simulator/engine/combatLoop.ts` | 카운터 증가 + 스케일링 효과 + 시너지 버프 + **사거리 밖 dash/self_buff 시전** |

---

## 8. 테스트 체크리스트

### 챔피언 스케일링
- [ ] 브라이어 체력 50%: AS 약 100% 증가 확인
- [ ] 나르 공격 5회: 부메랑 추가 피해 로그 출력
- [ ] 마스터 이 공격 3회: 연속 베기 추가 피해 로그
- [ ] 피오라 공격 2회: 고정 피해 + 회복 확인
- [ ] 진 전투 시작: AS 고정 0.85, 추가 AS가 AD로 전환
- [ ] 카이사 아군 처치: 마나 +10 확인
- [ ] 도전자 시너지: 전투 시작 시 AS 버프 적용
- [ ] 전달자 시너지: 마나 재생 적용

### Dash/이동 스킬 시전 (신규)
- [ ] 피즈: 사거리 밖 + 마나 풀 → dash 스킬 즉시 시전, 대상에게 돌진 후 피해
- [ ] 다이애나: 사거리 밖 + 마나 풀 → self_buff (보호막+구체) 즉시 시전
- [ ] 탈론: 사거리 밖 + 마나 풀 → 대상에게 도약 후 출혈 피해
- [ ] 마스터 이: 사거리 밖 + 마나 풀 → self_buff (AS 증가) 즉시 시전
- [ ] 리븐: 사거리 밖 + 마나 풀 → 대상에게 돌진 후 베기
- [ ] 코르키(range 3): 사거리 안에서 정상 시전 확인 (dash 있어도 사거리 안이면 기존 로직)
- [ ] dash 없는 원거리 챔피언: 사거리 밖에서 마나 풀이어도 시전 안 됨 (기존 동작 유지)

---

*Created: 2026-04-15*
*Feature: combat-scaling-system*
*Phase: Design*
*References: combat-scaling-system.plan.md*
