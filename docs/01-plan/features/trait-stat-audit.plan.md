# Plan: 시너지 능력치 적용 전면 감사 및 수정

## Executive Summary

| 관점 | 설명 |
|------|------|
| Problem | 53개 시너지 중 4개만 완전 구현, 12개 부분 구현 — 데마시아 결집 방어력/마나감소, 엄호대 마법방어, 비전마법사 유닛 필터링 등 핵심 스탯이 미적용되어 시뮬레이션 정확도가 낮음 |
| Solution | `stat.ts`의 `TRAIT_STAT_MAP` + `getTraitBonuses()` 확장 및 `combatLoop.ts`에 전투 중 동적 효과 추가 |
| Function UX Effect | 시너지 활성 시 능력치가 실제 게임과 동일하게 반영되어 UnitDetailPanel의 스탯 수치가 정확해짐 |
| Core Value | 시뮬레이션 정확도를 MVP 수준에서 게임 실제값에 근접하게 향상 |

---

## 1. 현황 분석

### 1.1 전체 시너지 구현 상태

| 상태 | 수 | 비고 |
|------|-----|------|
| 완전 구현 | 4 | 필트오버, 영웅, 녹서스, 난동꾼 |
| 부분 구현 | 12 | 데마시아, 엄호대, 비전마법사, 기동타격대, 파수꾼, 학살자, 총잡이, 토벌자, 프렐요드, 빌지워터, 아이오니아, 공허 |
| 미구현 (전투 관련) | 22 | 전쟁기계, 원거리사격, 기원자, 슈리마, 자운, 요들 등 |
| 해당 없음 (게임 플로우) | 15 | 관리인, 대식가, 대장장이 등 메타/경제 시너지 |

### 1.2 우선순위 기준

MVP에 포함된 시너지 + 현재 사용 가능한 챔피언에 영향을 미치는 것 우선.
"스탯 매핑만으로 수정 가능" → "combatLoop 로직 추가 필요" 순서로 진행.

---

## 2. 수정 대상 (우선순위순)

### Tier 1 — stat.ts만 수정 (즉시 적용, 단순 매핑)

| # | 시너지 | apiName | 문제 | 수정 내용 |
|---|--------|---------|------|----------|
| 1 | **데마시아** | TFT16_Demacia | ArmorMR 미적용 | `TRAIT_STAT_MAP`에 `{ ArmorMR: 'armorMR' }` 추가, `getTraitBonuses()`에서 ArmorMR → armor + magicResist 동시 적용 |
| 2 | **엄호대** | TFT16_Defender | BonusArmorMR→armor만 매핑, MR 누락 | `TRAIT_STAT_MAP`에서 `BonusArmorMR`을 armor+magicResist 양쪽에 적용하도록 수정. TeamwideArmorMR도 동일 |
| 3 | **기원자** | TFT16_Invoker | TeamBonusMana 미적용 | `getTraitBonuses()`에 `TeamBonusMana` 감지 → manaRegen 필드 추가 |
| 4 | **슈리마** | TFT16_Shurima | ArmorMR, BonusHealth, ASPerSecond 모두 미적용 | `TRAIT_STAT_MAP`에 매핑 추가 |
| 5 | **그림자 군도** | TFT16_ShadowIsles | ADAP 미적용 | `getTraitBonuses()`에서 `ADAP` → ad + ap 동시 적용 |
| 6 | **요들** | TFT16_Yordle | BonusHealth, AS 미적용 | `TRAIT_STAT_MAP` 추가 |
| 7 | **기동타격대** | TFT16_Rapidfire | TeamwideAS 미적용 | `TRAIT_STAT_MAP`에 `TeamwideAS: 'as'` 추가 |

### Tier 2 — stat.ts + getTraitBonuses() 로직 변경 (유닛 필터링 필요)

| # | 시너지 | 문제 | 수정 내용 |
|---|--------|------|----------|
| 8 | **비전 마법사** | AllyAP + BonusAP 구분 없이 합산 | `getTraitBonuses()`를 유닛별 트레잇 보유 여부에 따라 분기하는 구조로 변경 필요. 현재 `calculateStats()`는 activeTraits 전체를 받으므로, 비전 마법사 trait의 AllyAP는 팀 전원에게, BonusAP는 비전마법사 유닛에게만 적용하도록 분기 |
| 9 | **엄호대** | BonusArmorMR은 엄호대 유닛만, TeamwideArmorMR은 전체 | 유닛 필터링 로직 추가 |

### Tier 3 — combatLoop.ts 전투 중 동적 효과 추가

| # | 시너지 | 문제 | 수정 내용 |
|---|--------|------|----------|
| 10 | **데마시아** | ManaReductionPct 미적용 | 결집 발동 시 데마시아 유닛의 maxMana를 % 감소 |
| 11 | **데마시아** | EnemyTrueDamage 미적용 | 결집 발동 시 데마시아 유닛의 공격에 고정 피해 추가 |
| 12 | **전쟁기계** | BaseDR/IncreasedDR 미적용 | `damageReduction` 필드에 DR 적용, HP 손실 비례 증가분 tick마다 계산 |
| 13 | **파수꾼** | HP 임계값 트리거 없음 | 75%/25% HP 이하 시 보호막 재발동 로직 추가 |
| 14 | **학살자** | AmountIncrease 미적용 | HP 손실 비례 AD 동적 증가 로직 추가 |
| 15 | **수확자** | ManaPerEnemyDeath, EnemyArmorMRReduction 미적용 | 적 사망 이벤트 시 마나 획득 + 적 방저 감소 디버프 |

### Tier 4 — 복잡한 메커니즘 (향후 구현)

| # | 시너지 | 설명 |
|---|--------|------|
| - | 마법공학기계 | T-헥스 탑승 시스템 |
| - | 우두머리 | 세트 턱걸이→회복→강화 |
| - | 자운 | 시머 주입 사이클 |
| - | 원거리 사격 | 거리 비례 추가 피해 |
| - | 방해꾼 | 현혹 디버프 |
| - | Teamup 전부 | 2챔피언 연동 메커니즘 |

---

## 3. 수정 파일

| 파일 | 수정 내용 |
|------|----------|
| `src/lib/simulator/systems/stat.ts` | TRAIT_STAT_MAP 확장, getTraitBonuses() 로직 보강, ArmorMR→armor+MR 동시 적용, 유닛별 트레잇 필터링 |
| `src/lib/simulator/engine/combatLoop.ts` | 데마시아 결집 시 ManaReduction/TrueDamage/ArmorMR 적용, 파수꾼 HP 임계값, 전쟁기계 DR, 학살자 동적 AD |
| `src/types/index.ts` | 필요 시 CombatUnit에 trueDamageBonus, manaRegenBonus 등 필드 추가 |

---

## 4. 구현 순서

| 순서 | 작업 | Tier |
|------|------|------|
| 1 | stat.ts: TRAIT_STAT_MAP에 데마시아/엄호대/슈리마/요들/그림자군도/기원자/기동타격대 매핑 추가 | T1 |
| 2 | stat.ts: getTraitBonuses() — ArmorMR 변수 → armor + magicResist 동시 적용 통합 로직 | T1 |
| 3 | stat.ts: 비전 마법사/엄호대 유닛 필터링 (calculateStats에 유닛 트레잇 정보 전달) | T2 |
| 4 | combatLoop: 데마시아 결집 시 ArmorMR + ManaReductionPct + EnemyTrueDamage | T3 |
| 5 | combatLoop: 파수꾼 HP 임계값 보호막 재발동 | T3 |
| 6 | combatLoop: 전쟁기계 DR, 학살자 동적 AD | T3 |
| 7 | lint + typecheck + build 확인 | — |

---

## 5. 범위 제한 (이번 작업에서 제외)

- Teamup 시너지 (2챔피언 연동 — 별도 Plan 필요)
- T-헥스/마법공학기계 (탑승 시스템)
- 메타/경제 시너지 (관리인, 대식가, 대장장이 등)
- 우두머리(세트 턱걸이), 자운(시머 주입) 등 복잡한 전투 시퀀스
