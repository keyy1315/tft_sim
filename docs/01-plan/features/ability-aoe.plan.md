# Plan: 스킬 AOE/다중 타겟 시스템

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 현재 모든 챔피언 스킬이 단일 타겟에게만 피해를 주어, 럭스(직선 관통), 루시안(범위 폭발), 초가스(원형 AOE) 등 다중 타겟 스킬이 실제 게임 대비 피해량이 크게 과소 계산된다 |
| **Solution** | 스킬 타게팅 패턴(단일/직선/원형/원뿔/바운스/전체)을 분류하고, `executeAbility()` 시스템을 구축하여 패턴별 다중 타겟 피해 로직을 구현 |
| **Function UX Effect** | 사용자가 챔피언 배치 시 AOE 스킬의 위치 가치를 정확히 평가할 수 있게 됨 (추가 조작 불필요) |
| **Core Value** | 시뮬레이션 정확도 대폭 향상 — 특히 AOE 메타 챔피언(럭스, 초가스, 애니 등)의 전투 결과가 실제 게임에 근접 |

---

## 1. 현황 분석

### 1.1 현재 스킬 처리 방식

```ts
// combatLoop.ts:378-414
if (unit.currentMana >= unit.maxMana) {
  unit.currentMana = 0;
  const { damage: abilityDmg, type: dmgType } = getAbilityDamage(
    unit.champion, unit.starLevel, unit.stats.ap
  );
  // ❌ target 한 명에게만 피해
  target.currentHp -= effectiveAbilityDmg;
}
```

- 모든 스킬이 **현재 타겟 1명**에게만 피해
- AOE 범위, 직선 관통, 바운스 등 **멀티 타겟 메커니즘 없음**
- 스킬 타게팅 패턴 데이터 구조 없음

### 1.2 챔피언별 실제 스킬 패턴 (데이터 분석 결과)

105명 전체 챔피언의 ability desc를 분석한 결과:

| 타게팅 패턴 | 챔피언 수 | 대표 챔피언 |
|------------|----------|------------|
| **Single (단일)** | ~13 | 뽀삐, 드레이븐, 베인, 요네, 볼리베어 |
| **Line (직선 관통)** | ~10 | 럭스, 유나라, 일라오이, 스카너, 암베사 |
| **AOE (원형 범위)** | ~23 | 초가스, 니코, 에코, 케넨, 피들스틱, 킨드레드 |
| **Cone (원뿔)** | ~7 | 럼블, 그레이브즈, 그웬, 세주아니 |
| **Multi-target (다수 지정)** | ~35 | 아펠리오스, 징크스, 카이사, 제라스 |
| **Bounce (튕김)** | ~8 | 룰루, 케이틀린, 루시안, 라이즈 |
| **Global (전체)** | ~4 | 애니, 베이가, 브록 |
| **Self/Buff** | ~8 | 쉔, 트린다미어, 워윅, 타릭 |

### 1.3 핵심 문제

- 단일 타겟 챔피언(~13명)만 정확한 피해 계산
- **나머지 ~92명의 스킬이 과소 평가** — 실제로는 2~8명에게 피해를 주는 스킬이 1명에게만 적용

---

## 2. 기능 정의

### 2.1 스킬 타게팅 패턴 분류

```ts
type AbilityPattern =
  | 'single'     // 타겟 1명
  | 'line'       // 직선 관통 (경로 위 모든 적)
  | 'aoe_circle' // 원형 범위 (중심점 + 반경)
  | 'cone'       // 원뿔형 (방향 + 각도)
  | 'multi'      // 지정 다수 (N명)
  | 'bounce'     // 튕김 (순차 타겟)
  | 'global'     // 전체 적
  | 'self_buff'  // 자기 버프 (피해 없음)
```

### 2.2 패턴별 타겟 선정 로직

| 패턴 | 타겟 선정 | 피해 감쇠 |
|------|----------|----------|
| `single` | 현재 타겟 | 없음 |
| `line` | 시전자→타겟 방향 직선상 모든 적 | 관통당 감쇠 가능 (유나라: -N%) |
| `aoe_circle` | 타겟 중심 반경 N칸 내 적 | 없음 (동일 피해) |
| `cone` | 타겟 방향 원뿔 N칸 내 적 | 없음 |
| `multi` | 가장 가까운 N명 또는 랜덤 N명 | 없음 또는 분배 |
| `bounce` | 타겟→가장 가까운 미피격 적 순차 | 튕김당 감쇠 가능 |
| `global` | 모든 적 | 없음 |
| `self_buff` | 자신 (or 아군) | 해당 없음 |

### 2.3 구현 범위

**Phase 1 (이번 구현)**: 정적 타게팅 패턴 + 다중 타겟 피해

- `AbilityPattern` 타입 정의
- 챔피언별 패턴 매핑 테이블 (`CHAMPION_ABILITY_PATTERNS`)
- `findAbilityTargets()` — 패턴별 타겟 리스트 반환
- `combatLoop`에서 스킬 시전 시 다중 타겟에 피해 적용
- 각 타겟에 개별 저항/관통 적용

**Phase 2 (향후)**: 고급 메커니즘

- 피해 감쇠 (유나라 관통당 감소, 럭스 2차 피해 차등)
- CC 효과 다중 적용 (럭스 속박, 초가스 넉업)
- 시전 애니메이션/지연 (캐스팅 타임)
- 소환수 스킬 (말자하 공허충, 아지르 병사)

### 2.4 제약

- Phase 1에서는 **주 피해(primary damage)**만 다중 적용, 2차 피해(럭스 구체→빛줄기 차등)는 Phase 2
- 직선/원뿔 방향 계산은 Axial 좌표 기반 근사값 사용
- `self_buff` 패턴은 기존 단일 타겟 로직 유지 (향후 버프 시스템으로 분리)

---

## 3. 수정 파일

| 파일 | 변경 |
|------|------|
| `src/types/index.ts` | `AbilityPattern` 타입 추가 |
| `src/lib/simulator/systems/ability.ts` | `CHAMPION_ABILITY_PATTERNS` 매핑 테이블, `findAbilityTargets()` 함수, `parseAbility()` 확장 |
| `src/lib/simulator/engine/combatLoop.ts` | 스킬 시전부를 `executeAbility()` 호출로 교체, 다중 타겟 피해 루프 |
| `src/lib/simulator/models/hex.ts` | `getHexesInLine()`, `getHexesInRadius()`, `getHexesInCone()` 헬퍼 추가 (있을 경우 확장) |

### 3.1 변경 없는 파일

- `src/components/` — UI 변경 없음
- `public/data/` — 데이터 이미 존재 (desc에서 패턴 추론)
- `src/lib/simulator/systems/stat.ts` — 스탯 계산 변경 없음

---

## 4. 핵심 로직

### 4.1 챔피언별 패턴 매핑

```ts
interface AbilityConfig {
  pattern: AbilityPattern;
  radius?: number;        // aoe_circle, cone용 반경 (hex)
  maxTargets?: number;    // multi, bounce용 최대 타겟 수
  damageDecay?: number;   // 관통/바운스 감쇠율 (0~1)
}

const CHAMPION_ABILITY_PATTERNS: Record<string, AbilityConfig> = {
  // Single
  TFT16_Poppy:     { pattern: 'single' },
  TFT16_Draven:    { pattern: 'single' },
  TFT16_Vayne:     { pattern: 'single' },

  // Line (직선 관통)
  TFT16_Lux:       { pattern: 'line' },
  TFT16_Yunara:    { pattern: 'line', damageDecay: 0.15 },
  TFT16_Illaoi:    { pattern: 'line' },
  TFT16_Skarner:   { pattern: 'line', maxTargets: 3 },

  // AOE Circle
  TFT16_ChoGath:   { pattern: 'aoe_circle', radius: 2 },
  TFT16_Neeko:     { pattern: 'aoe_circle', radius: 2 },
  TFT16_Ekko:      { pattern: 'aoe_circle', radius: 2 },
  TFT16_Kennen:    { pattern: 'aoe_circle', radius: 2 },

  // Cone
  TFT16_Rumble:    { pattern: 'cone', radius: 2 },
  TFT16_Graves:    { pattern: 'cone', radius: 2 },
  TFT16_Gwen:      { pattern: 'cone', radius: 2 },

  // Multi-target
  TFT16_Aphelios:  { pattern: 'multi', maxTargets: 4 },
  TFT16_Jinx:      { pattern: 'multi', maxTargets: 3 },
  TFT16_Kaisa:     { pattern: 'multi', maxTargets: 4 },
  TFT16_Xerath:    { pattern: 'multi', maxTargets: 3 },

  // Bounce
  TFT16_Lulu:      { pattern: 'bounce', maxTargets: 2 },
  TFT16_Caitlyn:   { pattern: 'bounce', maxTargets: 2, damageDecay: 0.5 },
  TFT16_Lucian:    { pattern: 'aoe_circle', radius: 1 },  // 폭발 범위

  // Global
  TFT16_Annie:     { pattern: 'global' },
  TFT16_Veigar:    { pattern: 'global' },

  // Self/Buff
  TFT16_Shen:      { pattern: 'self_buff' },
  TFT16_Warwick:   { pattern: 'self_buff' },
  TFT16_Tryndamere:{ pattern: 'self_buff' },
};
```

### 4.2 Hex 기하학 헬퍼

```ts
// hex.ts에 추가
function getHexesInRadius(center: HexCoord, radius: number): HexCoord[];
function getHexesInLine(from: HexCoord, to: HexCoord, maxRange?: number): HexCoord[];
function getHexesInCone(origin: HexCoord, direction: HexCoord, radius: number): HexCoord[];
```

### 4.3 다중 타겟 탐색

```ts
// ability.ts에 추가
function findAbilityTargets(
  caster: CombatUnit,
  primaryTarget: CombatUnit,
  enemies: CombatUnit[],
  config: AbilityConfig
): CombatUnit[];
```

| 패턴 | 로직 |
|------|------|
| `single` | `[primaryTarget]` |
| `line` | 시전자→타겟 방향 연장선의 hex에 위치한 적 필터 |
| `aoe_circle` | 타겟 위치 기준 radius 내 hex에 위치한 적 필터 |
| `cone` | 시전자→타겟 방향 ±60° 범위 + radius 내 적 |
| `multi` | 거리순 정렬 → 상위 maxTargets명 |
| `bounce` | 타겟→가장 가까운 미피격 적 순차 탐색 (maxTargets까지) |
| `global` | 모든 생존 적 |
| `self_buff` | `[]` (피해 대상 없음) |

### 4.4 combatLoop 변경

```ts
// Before (현재) — 단일 타겟
if (unit.currentMana >= unit.maxMana) {
  const { damage, type } = getAbilityDamage(unit.champion, unit.starLevel, unit.stats.ap);
  target.currentHp -= applyResistance(damage, target.stats.magicResist, unit.stats.magicPen);
}

// After — 다중 타겟
if (unit.currentMana >= unit.maxMana) {
  unit.currentMana = 0;
  const { damage, type } = getAbilityDamage(unit.champion, unit.starLevel, unit.stats.ap);
  const config = CHAMPION_ABILITY_PATTERNS[unit.champion.apiName] || { pattern: 'single' };
  const targets = findAbilityTargets(unit, target, enemyTeamAlive, config);

  for (let i = 0; i < targets.length; i++) {
    let dmg = damage;
    if (config.damageDecay) dmg *= Math.pow(1 - config.damageDecay, i);

    const res = type === 'magic' ? targets[i].stats.magicResist
      : type === 'physical' ? targets[i].stats.armor : 0;
    const pen = type === 'magic' ? unit.stats.magicPen
      : type === 'physical' ? unit.stats.armorPen : 0;
    const finalDmg = applyResistance(dmg, res, pen);

    targets[i].currentHp -= finalDmg;
    targets[i].totalDamageTaken += finalDmg;
    unit.totalDamageDealt += finalDmg;
    // 로그 + 사망 처리 ...
  }
}
```

---

## 5. 구현 순서

1. `src/types/index.ts`: `AbilityPattern` 타입 추가
2. `src/lib/simulator/models/hex.ts`: `getHexesInRadius()`, `getHexesInLine()`, `getHexesInCone()` 추가
3. `src/lib/simulator/systems/ability.ts`: `CHAMPION_ABILITY_PATTERNS` + `findAbilityTargets()` 추가
4. `src/lib/simulator/engine/combatLoop.ts`: 스킬 시전부 다중 타겟 루프로 교체
5. `pnpm typecheck && pnpm build` 통과

---

## 6. 검증 체크리스트

- [ ] 단일 타겟 챔피언(뽀삐 등) 기존과 동일 피해
- [ ] 럭스 스킬이 직선상 여러 적에게 피해 (line 패턴)
- [ ] 초가스 스킬이 반경 2칸 내 적에게 피해 (aoe_circle)
- [ ] 애니 스킬이 모든 적에게 피해 (global)
- [ ] 루시안 스킬이 타겟 주변 1칸 폭발 (aoe_circle)
- [ ] 매핑 없는 챔피언은 `single` 폴백 → 기존 동작 유지
- [ ] 피해 감쇠(damageDecay) 적용 시 타겟 순서별 감소 확인
- [ ] 각 타겟에 개별 저항/관통 정상 적용
- [ ] `pnpm typecheck && pnpm build` 통과
