# Plan: 방어구/마법 관통 시스템

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 아이템(이온 충격기, 공허의 지팡이, 유령 건틀릿)에 관통/파쇄 데이터가 존재하지만 전투 엔진이 무시하여, 탱커 상대 피해가 실제 게임보다 낮게 계산된다 |
| **Solution** | `applyResistance`에 관통/파쇄 값을 반영하고, 아이템 효과 파이프라인에 관통 스탯을 추가 |
| **Function UX Effect** | 관통 아이템 장착 시 전투 결과가 실제 게임에 가까워짐 (사용자 추가 조작 없음) |
| **Core Value** | 시뮬레이션 정확도 대폭 향상 — 특히 고방어 챔피언 상대 피해 계산 |

---

## 1. 현황 분석

### 1.1 현재 피해 감소 공식

```ts
// combatLoop.ts:62
function applyResistance(damage: number, resistance: number): number {
  return damage * 100 / (100 + Math.max(0, resistance));
}
```

- 물리 피해: `target.stats.armor` 사용
- 마법 피해: `target.stats.magicResist` 사용
- **관통/파쇄 미반영** — 저항값 그대로 적용

### 1.2 데이터에 존재하는 관통 효과

**아이템** (`tft_set16_items.json`):

| 아이템 | apiName | 효과 키 | 값 | 설명 |
|--------|---------|---------|-----|------|
| 이온 충격기 | TFT_Item_IonicSpark | `MRShred` | 30 | 2칸 내 적에게 마저 30% 파쇄 |
| 공허의 지팡이 | TFT_Item_StatikkShiv | `MRShred` | 30 | 공격/스킬 시 마저 30% 파쇄 (5초) |
| 유령 건틀릿 | TFT_Item_SpectralGauntlet | `ARReductionAmount` | 30 | 2칸 내 적에게 방어력 30% 감소 (15초) |

**증강** (`tft_set16_traits.json`):

| 증강 | apiName | 효과 키 | 값 |
|------|---------|---------|-----|
| 물의 공리 | TFT16_Augment_WaterAxiom | `ShredPercent` | 0.30 |

### 1.3 누락된 파이프라인

| 레이어 | 현재 상태 | 필요한 변경 |
|--------|----------|------------|
| `ITEM_EFFECT_KEYS` | `MRShred`, `ARReductionAmount` 매핑 없음 | 매핑 추가 |
| `ItemEffect` 타입 | 관통 필드 없음 | `armorPen`, `magicPen` 추가 |
| `ChampionStats` | 관통 필드 없음 | `armorPen`, `magicPen` 추가 |
| `calculateStats()` | 관통 스탯 미계산 | 합산 로직 추가 |
| `applyResistance()` | 관통 파라미터 없음 | 파쇄 후 저항값으로 계산 |
| `combatLoop` | 관통값 전달 안 함 | 공격자 관통 스탯 전달 |

---

## 2. 기능 정의

### 2.1 TFT 관통 공식 (실제 게임 기준)

```
effectiveResistance = resistance × (1 - percentPen)
finalDamage = damage × 100 / (100 + max(0, effectiveResistance))
```

- **퍼센트 파쇄 (% Shred)**: 저항값을 비율로 감소 (`MRShred`, `ARReductionAmount` → 퍼센트 감소)
- 여러 파쇄 효과는 곱연산: `(1 - shred1) × (1 - shred2)`
- 최종 저항값은 0 미만으로 내려가지 않음

### 2.2 구현 범위

**Phase 1 (이번 구현)**: 아이템의 정적 관통 스탯 반영
- `ChampionStats`에 `armorPen`, `magicPen` 필드 추가
- `ITEM_EFFECT_KEYS`에 관통 매핑 추가
- `calculateStats()`에서 관통 스탯 합산
- `applyResistance()`에 관통 파라미터 추가
- `combatLoop`에서 공격/스킬 피해 시 관통값 전달

**Phase 2 (향후)**: 동적 파쇄 효과 (이온 충격기 범위 파쇄, 공허의 지팡이 시간 제한 파쇄 등)
- `statusEffects`에 `armorShred`, `mrShred` 타입 추가
- 전투 중 특정 조건에서 적에게 파쇄 디버프 부여
- 디버프 스택 관리 + 지속시간

### 2.3 제약

- Phase 1에서는 관통 아이템 보유 시 **모든 피해에 일괄 적용** (간소화)
- Phase 2의 동적 파쇄(대상별, 시간제한)는 별도 feature로 분리

---

## 3. 수정 파일

| 파일 | 변경 |
|------|------|
| `src/types/index.ts` | `ChampionStats`에 `armorPen`, `magicPen` 추가. `ItemEffect`에 동일 추가 |
| `src/lib/simulator/models/constants.ts` | `ITEM_EFFECT_KEYS`에 `MRShred`→`magicPen`, `ARReductionAmount`→`armorPen` 추가 |
| `src/lib/simulator/systems/stat.ts` | `calculateStats()`에 관통 스탯 합산 로직 추가 |
| `src/lib/simulator/engine/combatLoop.ts` | `applyResistance()`에 관통 파라미터 추가, 공격/스킬 호출부 수정 |

### 3.1 변경 없는 파일

- `src/components/` — UI 변경 없음
- `public/data/` — 데이터 이미 존재
- `src/data/loader.ts` — 로딩 로직 변경 없음

---

## 4. 핵심 로직

### 4.1 `applyResistance` 변경

```ts
// Before
function applyResistance(damage: number, resistance: number): number {
  return damage * 100 / (100 + Math.max(0, resistance));
}

// After
function applyResistance(damage: number, resistance: number, penetration: number = 0): number {
  const effective = resistance * (1 - Math.min(penetration, 1));
  return damage * 100 / (100 + Math.max(0, effective));
}
```

### 4.2 호출부 변경

```ts
// 물리 피해
applyResistance(rawDamage, target.stats.armor, unit.stats.armorPen)

// 마법 피해
applyResistance(abilityDmg, target.stats.magicResist, unit.stats.magicPen)
```

### 4.3 스탯 파이프라인

```
아이템 effects → ITEM_EFFECT_KEYS 매핑 → ItemEffect.armorPen/magicPen
→ calculateStats() 합산 → ChampionStats.armorPen/magicPen
→ CombatUnit.stats.armorPen/magicPen → applyResistance()에 전달
```

---

## 5. 구현 순서

1. `types/index.ts`: `ChampionStats`, `ItemEffect`에 `armorPen`, `magicPen` 추가
2. `constants.ts`: `ITEM_EFFECT_KEYS`에 매핑 추가
3. `stat.ts`: `calculateStats()`에서 관통 스탯 계산
4. `combatLoop.ts`: `applyResistance()` 시그니처 변경 + 호출부 수정
5. `pnpm typecheck && pnpm build` 통과

---

## 6. 검증 체크리스트

- [ ] 관통 아이템 미장착 시 기존과 동일한 피해 (penetration=0, 하위 호환)
- [ ] 유령 건틀릿 장착 시 물리 피해 증가 (armor 30% 감소 효과)
- [ ] 이온 충격기/공허의 지팡이 장착 시 마법 피해 증가 (MR 30% 감소 효과)
- [ ] 관통값이 1(100%)을 초과해도 저항값이 음수로 내려가지 않음
- [ ] `pnpm typecheck && pnpm build` 통과
