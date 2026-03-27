# Design: 시너지 능력치 적용 전면 감사 및 수정

> Plan: `docs/01-plan/features/trait-stat-audit.plan.md`

---

## 1. stat.ts — TRAIT_STAT_MAP 확장 + ArmorMR 통합 처리

### 1.1 현재 TRAIT_STAT_MAP (7개)

```ts
const TRAIT_STAT_MAP: Record<string, Record<string, string>> = {
  TFT16_Vanquisher: { BaseCritChance: 'critChance', CritDmg: 'critDamage' },
  TFT16_Slayer: { BonusAD: 'ad', BonusOmnivamp: 'omnivamp' },
  TFT16_Rapidfire: { MinBonusAS: 'as' },
  TFT16_Sorcerer: { BonusAP: 'ap', AllyAP: 'ap' },
  TFT16_Brawler: { TeamFlatHealth: 'hp', BonusPercentHealth: 'hpPercent' },
  TFT16_Defender: { BonusArmorMR: 'armor', TeamwideArmorMR: 'armor' },
  TFT16_Warden: { PercentHealthShield: 'shield' },
};
```

### 1.2 변경 후 TRAIT_STAT_MAP

```ts
const TRAIT_STAT_MAP: Record<string, Record<string, string>> = {
  TFT16_Vanquisher: { BaseCritChance: 'critChance', CritDmg: 'critDamage' },
  TFT16_Slayer: { BonusAD: 'ad', BonusOmnivamp: 'omnivamp' },
  TFT16_Rapidfire: { MinBonusAS: 'as', TeamwideAS: 'as' },
  TFT16_Sorcerer: { BonusAP: 'ap', AllyAP: 'ap' },
  TFT16_Brawler: { TeamFlatHealth: 'hp', BonusPercentHealth: 'hpPercent' },
  TFT16_Defender: { BonusArmorMR: 'armorMR', TeamwideArmorMR: 'armorMR' },
  TFT16_Warden: { PercentHealthShield: 'shield' },
  // ── 추가 ──
  TFT16_Demacia: { ArmorMR: 'armorMR' },
  TFT16_Yordle: { BonusHealth: 'hp', AS: 'as' },
  TFT16_Shurima: { ArmorMR: 'armorMR', BonusHealth: 'hpPercent', ASPerSecond: 'as' },
  TFT16_ShadowIsles: { ADAP: 'adap' },
  TFT16_Invoker: { TeamBonusMana: 'manaRegen' },
};
```

### 1.3 ArmorMR 통합 처리

`TRAIT_STAT_MAP`에서 `'armorMR'`이라는 특수 키를 사용하고, `getTraitBonuses()` 내에서 이를 `armor` + `magicResist` 양쪽에 분배합니다.

```ts
// getTraitBonuses() 내부 — TRAIT_STAT_MAP 적용 후
if (traitMap) {
  for (const [varKey, statKey] of Object.entries(traitMap)) {
    const val = vars[varKey];
    if (typeof val === 'number') {
      if (statKey === 'armorMR') {
        // ArmorMR → armor + magicResist 동시 적용
        result.armor = (result.armor || 0) + val;
        result.magicResist = (result.magicResist || 0) + val;
      } else if (statKey === 'adap') {
        // ADAP → ad(%) + ap(flat) 동시 적용
        result.ad = (result.ad || 0) + val;
        result.ap = (result.ap || 0) + val * 100;
      } else {
        (result as Record<string, number>)[statKey] =
          ((result as Record<string, number>)[statKey] || 0) + val;
      }
    }
  }
}
```

### 1.4 ExtendedTraitEffect에 manaRegen 추가

```ts
export interface ExtendedTraitEffect extends ItemEffect {
  omnivamp?: number;
  damageAmp?: number;
  hpPercent?: number;
  shield?: number;
  manaRegen?: number;   // ← 추가 (기원자 TeamBonusMana)
}
```

---

## 2. combatLoop.ts — 데마시아 결집 효과

### 2.1 현재 상태

`trySpawnGalio()` 함수가 결집 조건(팀 HP 손실 비율) 달성 시 갈리오를 소환하지만, 데마시아 유닛에 대한 능력치 버프는 적용하지 않음.

### 2.2 추가할 함수: `applyDemaciaRally()`

갈리오 소환 성공 시 (또는 `trySpawnGalio()` 내부에서) 데마시아 유닛에 결집 버프 적용:

```ts
function applyDemaciaRally(
  activeTraits: ActiveTrait[],
  teamUnits: CombatUnit[],
): void {
  const demacia = activeTraits.find(t => t.trait.apiName === 'TFT16_Demacia' && t.activeEffect);
  if (!demacia?.activeEffect) return;

  const vars = demacia.activeEffect.variables;
  const armorMR = (vars['ArmorMR'] ?? 0) as number;
  const manaReductionPct = (vars['ManaReductionPct'] ?? 0) as number;
  const enemyTrueDamage = (vars['EnemyTrueDamage'] ?? 0) as number;

  // 데마시아 유닛에게만 적용
  for (const u of teamUnits) {
    if (!u.champion.traits.includes('데마시아')) continue;
    u.stats.armor += armorMR;
    u.stats.magicResist += armorMR;
    u.maxMana = Math.round(u.maxMana * (1 - manaReductionPct));
    u.damageAmp += enemyTrueDamage;
  }
}
```

### 2.3 호출 위치

`trySpawnGalio()` 내부에서 갈리오 소환 성공 직후:

```ts
// trySpawnGalio() 끝 부분, return galio; 직전
applyDemaciaRally(activeTraits, teamUnits);
```

---

## 3. combatLoop.ts — 기원자 마나 재생

### 3.1 현재 상태

`mana.ts`의 `gainManaPerTick()`이 Caster 역할군에 초당 2 마나를 지급. 기원자 시너지의 `TeamBonusMana`는 미적용.

### 3.2 설계

전투 시작 시 기원자 시너지가 활성화되어 있으면, 팀 전체 유닛에 틱당 마나 재생 보너스를 적용.

`CombatUnit`에 이미 `augmentManaRegen: number` 필드가 있으므로, 이 필드에 기원자 보너스를 합산합니다.

```ts
// 전투 시작 시 (applyWardenShields 근처)
function applyInvokerManaRegen(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const invoker = activeTraits.find(t => t.trait.apiName === 'TFT16_Invoker' && t.activeEffect);
  if (!invoker?.activeEffect) return;
  const teamMana = (invoker.activeEffect.variables['TeamBonusMana'] ?? 0) as number;
  if (teamMana <= 0) return;
  for (const u of units) {
    u.augmentManaRegen += teamMana;
  }
}
```

---

## 4. combatLoop.ts — 전쟁기계 DR

### 4.1 현재 상태

`CombatUnit.damageReduction`은 존재하지만 전쟁기계가 이 값을 설정하지 않음.

### 4.2 설계

전투 시작 시 전쟁기계 유닛에 `BaseDR`을 `damageReduction`에 적용:

```ts
function applyJuggernautDR(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const jugg = activeTraits.find(t => t.trait.apiName === 'TFT16_Juggernaut' && t.activeEffect);
  if (!jugg?.activeEffect) return;
  const baseDR = (jugg.activeEffect.variables['BaseDR'] ?? 0) as number;
  for (const u of units) {
    if (u.champion.traits.includes('전쟁기계')) {
      u.damageReduction += baseDR;
    }
  }
}
```

> `IncreasedDR` (HP 손실 비례 DR 증가)는 Tier 4로 분류 — 매 틱 동적 계산이 필요하므로 이번 범위에서는 BaseDR만 적용.

---

## 5. combatLoop.ts — 수확자 효과

### 5.1 설계

적 사망 이벤트(`on_death`) 발생 시 수확자 유닛에 마나 지급 + 적 전체 방저 감소:

```ts
// on_death 이벤트 핸들러에 추가
function applyHarvesterOnKill(
  activeTraits: ActiveTrait[],
  killerTeamUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
): void {
  const harvester = activeTraits.find(t => t.trait.apiName === 'TFT16_Harvester' && t.activeEffect);
  if (!harvester?.activeEffect) return;
  const manaPerKill = (harvester.activeEffect.variables['ManaPerEnemyDeath'] ?? 0) as number;
  const armorMRReduction = (harvester.activeEffect.variables['EnemyArmorMRReduction'] ?? 0) as number;

  // 수확자 유닛에 마나 지급
  for (const u of killerTeamUnits) {
    if (u.champion.traits.includes('수확자') && u.state !== 'dead') {
      u.currentMana = Math.min(u.maxMana, u.currentMana + manaPerKill);
    }
  }
  // 적 전체 방저 감소 (영구)
  for (const e of enemyUnits) {
    if (e.state !== 'dead') {
      e.stats.armor = Math.max(0, e.stats.armor - armorMRReduction);
      e.stats.magicResist = Math.max(0, e.stats.magicResist - armorMRReduction);
    }
  }
}
```

호출 위치: 사망 처리 로직 내 (`state = 'dead'` 설정 직후).

---

## 6. 엄호대 유닛 필터링 문제

### 6.1 현재 문제

`TRAIT_STAT_MAP`에서 `BonusArmorMR`과 `TeamwideArmorMR` 모두 `armor`에만 합산. 실제로는:
- `BonusArmorMR`: 엄호대 유닛만 추가 (armor + MR)
- `TeamwideArmorMR`: 팀 전체 추가 (armor + MR)

### 6.2 설계 결정

현재 `getTraitBonuses()`는 팀 전체에 동일한 ExtendedTraitEffect를 반환하므로, 유닛별 분기가 불가능.

**간소화 접근**: `TeamwideArmorMR`만 전체 적용하고, `BonusArmorMR`은 `combatLoop.ts`에서 전투 시작 시 엄호대 유닛에만 별도 추가.

```ts
// TRAIT_STAT_MAP 변경
TFT16_Defender: { TeamwideArmorMR: 'armorMR' },
// BonusArmorMR은 TRAIT_STAT_MAP에서 제거 → combatLoop에서 처리

// combatLoop.ts 추가
function applyDefenderBonus(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const defender = activeTraits.find(t => t.trait.apiName === 'TFT16_Defender' && t.activeEffect);
  if (!defender?.activeEffect) return;
  const bonus = (defender.activeEffect.variables['BonusArmorMR'] ?? 0) as number;
  for (const u of units) {
    if (u.champion.traits.includes('엄호대')) {
      u.stats.armor += bonus;
      u.stats.magicResist += bonus;
    }
  }
}
```

---

## 7. 비전 마법사 유닛 필터링

### 7.1 현재 문제

`AllyAP` + `BonusAP` 모두 전체 팀에 합산됨. 실제: AllyAP은 전체, BonusAP는 비전 마법사만.

### 7.2 설계

`TRAIT_STAT_MAP`에서 `BonusAP`를 제거하고, `combatLoop.ts`에서 비전 마법사 유닛에만 추가:

```ts
// TRAIT_STAT_MAP 변경
TFT16_Sorcerer: { AllyAP: 'ap' },
// BonusAP는 제거 → combatLoop에서 처리

// combatLoop.ts
function applySorcererBonus(activeTraits: ActiveTrait[], units: CombatUnit[]): void {
  const sorc = activeTraits.find(t => t.trait.apiName === 'TFT16_Sorcerer' && t.activeEffect);
  if (!sorc?.activeEffect) return;
  const bonusAP = (sorc.activeEffect.variables['BonusAP'] ?? 0) as number;
  for (const u of units) {
    if (u.champion.traits.includes('비전 마법사')) {
      u.stats.ap += bonusAP;
    }
  }
}
```

---

## 8. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | `ExtendedTraitEffect`에 `manaRegen` 추가 | `stat.ts` |
| 2 | `TRAIT_STAT_MAP` 확장 (데마시아/요들/슈리마/그림자군도/기원자/기동타격대) | `stat.ts` |
| 3 | `getTraitBonuses()`에 `armorMR`/`adap` 특수 키 분배 로직 추가 | `stat.ts` |
| 4 | 엄호대: `TeamwideArmorMR`만 MAP에 남기고, `BonusArmorMR`은 combatLoop 처리 | `stat.ts` + `combatLoop.ts` |
| 5 | 비전 마법사: `AllyAP`만 MAP에 남기고, `BonusAP`는 combatLoop 처리 | `stat.ts` + `combatLoop.ts` |
| 6 | `applyDemaciaRally()` — 결집 시 ArmorMR/ManaReduction/TrueDamage | `combatLoop.ts` |
| 7 | `applyInvokerManaRegen()` — 기원자 팀 마나 재생 | `combatLoop.ts` |
| 8 | `applyJuggernautDR()` — 전쟁기계 BaseDR | `combatLoop.ts` |
| 9 | `applyHarvesterOnKill()` — 수확자 처치 효과 | `combatLoop.ts` |
| 10 | lint + typecheck + build 확인 | — |

---

## 9. 이번 범위에서 제외

- 비전 마법사 `PercentManaIncrease` (마법사 본인 마나 획득 증가 배율)
- 학살자 `AmountIncrease` (HP 손실 비례 AD 증가 — 매 틱 동적)
- 파수꾼 HP 임계값 (75%/25%) 재발동
- 슈리마 `HealthRestorePerSecond` (초당 HP 회복 — 매 틱 동적)
- Teamup 전부, T-헥스, 우두머리, 자운 시머 주입
