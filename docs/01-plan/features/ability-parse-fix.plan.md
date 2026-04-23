# Plan: 챔피언 스킬 파싱 시스템 수정 (Set 17 데이터 형식 대응)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | `parseAbility`가 Set 17 데이터 형식을 인식 못함 — 피해 변수명 불일치(72명 중 46명 variables[0] 폴백), 피해 타입 판별 실패(HTML 태그 0건), AP/AD 스케일링 미적용 |
| **Solution** | 피해 변수 탐색 로직을 Set 17 변수명 패턴에 맞게 확장 + desc의 한글 "물리/마법/고정 피해"로 타입 판별 + 변수명 접미사(AD/AP)로 스케일링 판별 |
| **Function UX Effect** | 전체 챔피언의 스킬 피해가 정확하게 계산되어 시뮬레이션 결과가 실제 게임과 일치 |
| **Core Value** | 시뮬레이터의 핵심 기능인 전투 피해 계산의 정확도 복구 — 현재 사실상 대부분 챔피언의 스킬이 깨져있음 |

---

## 1. 현재 문제 상세

### 1.1 피해 변수명 인식 실패

현재 `parseAbility`가 찾는 변수명:
```
Damage, MagicDamage, PhysicalDamage, TotalDamage, BonusDamage, DamagePerTick
```

Set 17 실제 피해 변수명 (72명 전수 조사):

| 패턴 | 사용 챔피언 수 | 예시 |
|------|-------------|------|
| `Damage` (정확 일치) | 15 | Veigar, Lissandra, Gragas, Karma... |
| `ADDamage` / `APDamage` | 8 | Briar, Belveth, Jinx, Kaisa, Kindred, Xayah... |
| `DamageAD` / `DamageAP` | 6 / 4 | Aatrox, Akali, Gnar, MasterYi, Rammus... |
| 고유명 | 30+ | `SpearDamage`(Pyke), `ShotgunDamage`(Urgot), `DashDamage`(Fizz), `VitalDamage`(Fiora)... |
| `Damage` 변수 **없음** | 6 | Poppy, Jax, Galio, Zed... (보호막/유틸 스킬) |

**variables[0]이 피해가 아닌 경우**: 46명/72명 (64%)
→ 폴백 시 Shield, Duration, PercentMissingHealth 등 엉뚱한 값으로 피해 계산

### 1.2 피해 타입 판별 실패

코드: `desc.includes('<physicalDamage>')` → **0건 매칭**

실제 데이터 desc 형식:
- 물리: `"...155()의 물리 피해를 입힙니다..."` — **22명**
- 마법: `"...120()의 마법 피해를 입힙니다..."` — **38명**
- 고정: `"...50()의 고정 피해를..."` — **3명** (Aurora, Fiora, Shen)
- 미표기: **9명** (보호막/유틸 스킬, Zed 등)

### 1.3 스케일링 판별 실패

코드: `desc.includes('scaleAP')` → **0건 매칭**

Set 17에서는 스케일링 정보가 변수명에 내포:
- `ADDamage` / `DamageAD` → AD 스케일링
- `APDamage` / `DamageAP` → AP 스케일링
- `Damage` (단독) → 대부분 AP 스케일링 (마법 피해)

---

## 2. 수정 방안

### 2.1 피해 변수 탐색 — 확장된 매칭 (우선순위)

```typescript
const DAMAGE_VAR_PRIORITY = [
  // 1순위: 정확 매칭
  'Damage', 'MagicDamage', 'PhysicalDamage', 'TotalDamage',
  // 2순위: Set 17 AD/AP 패턴
  'ADDamage', 'APDamage', 'DamageAD', 'DamageAP',
  // 3순위: 기타 공통 패턴
  'BonusDamage', 'DamagePerTick', 'DamagePerSecond',
  'PassiveDamage', 'SpellDamage',
];

// 우선순위 매칭 후, 없으면 이름에 'Damage' 포함하는 첫 변수
// 그래도 없으면 null (피해 없는 스킬)
```

### 2.2 피해 타입 판별 — 한글 매칭

```typescript
function detectDamageType(desc: string): DamageType {
  if (desc.includes('고정 피해')) return 'true';
  if (desc.includes('물리 피해')) return 'physical';
  if (desc.includes('마법 피해')) return 'magic';
  // HTML 태그 폴백 (이전 세트 호환)
  if (desc.includes('<physicalDamage>')) return 'physical';
  if (desc.includes('<trueDamage>')) return 'true';
  return 'magic'; // 기본값
}
```

### 2.3 스케일링 판별 — 변수명 기반

```typescript
function detectScaling(varName: string | null, desc: string): 'ap' | 'ad' | 'none' {
  if (!varName) return 'none';
  // 변수명에서 AD/AP 판별
  if (varName.includes('AD') || varName.endsWith('AD')) return 'ad';
  if (varName.includes('AP') || varName.endsWith('AP')) return 'ap';
  // desc 기반 폴백
  if (desc.includes('scaleAD')) return 'ad';
  if (desc.includes('scaleAP')) return 'ap';
  // 물리 피해 → AD, 마법 피해 → AP
  if (desc.includes('물리 피해')) return 'ad';
  if (desc.includes('마법 피해')) return 'ap';
  return 'ap'; // 기본 AP
}
```

---

## 3. 챔피언별 피해 변수 매핑 (전수 검증)

### 기존 로직으로 정상 매칭되는 챔피언 (15명)
Veigar(`Damage`), Caitlyn(`Damage`), Lissandra(`Damage`), RekSai(`Damage`), Gragas(`Damage`), Milio(`Damage`), Zoe(`Damage`), Illaoi(`Damage`), Viktor(`Damage`), Samira(`Damage`), Ornn(`Damage`), Lulu(`Damage`), Karma(`Damage`), Nami(`Damage`), Rhaast(`Damage`)

### 확장 매칭으로 새로 잡히는 챔피언 (30명+)
| 변수 | 챔피언 |
|------|--------|
| `ADDamage` | Briar, Belveth, Jinx, Kaisa, Kindred, Xayah, Ezreal, Jhin |
| `DamageAD` | Aatrox, Gnar, MasterYi |
| `DamageAP` | Akali, Nasus, Rammus, TahmKench |
| `DamagePerSecond` | Bard, AurelionSol |
| `PassiveDamage` | Riven |
| `SpellDamage` | Kindred |

### 고유 변수명 — 하드코딩 필요 (15명)
| 챔피언 | 변수명 | 이유 |
|--------|--------|------|
| Pyke | `SpearDamage` | 고유명 |
| Urgot | `ShotgunDamage` | 고유명 |
| Fizz | `DashDamage` | 고유명 |
| Fiora | `VitalDamage` | 고유명 |
| Corki | `ProcDamageMult` | 특수 계산 |
| Blitzcrank | `BoltDamage` | 고유명 |
| Sona | `DebrisDamage` | 고유명 |
| Vex | `ShadowHandDamage` | 고유명 |
| Shen | `BonusDamageOnAttack` | 고유명 |
| Graves | `Damage` (정상) | — |
| Morgana | `TetherDamagePerSecond` | DOT |
| Nunu | `InitialDamage` | 고유명 |
| Leblanc | `BoltDamage` | 고유명 |
| Mordekaiser | `DamagePerProc` | 고유명 |
| Pantheon | `TrueDamagePerSecond` | DOT |

### 피해 없는 스킬 (6명) — 스킵 정상
Poppy(보호막), Jax(보호막+스턴), Galio(보호막), Zed(분신), DarkStar_FakeUnit, Chogath(% 최대체력)

---

## 4. 수정 파일

| # | 파일 | 변경 |
|---|------|------|
| 1 | `src/lib/simulator/systems/ability.ts` | `parseAbility` 전면 수정 — 변수 탐색/타입/스케일링 로직 |
| 2 | `src/lib/simulator/systems/ability.ts` | 고유 변수명 챔피언 오버라이드 맵 추가 (선택) |

---

## 5. 구현 순서

### Phase 1: 핵심 파싱 수정
1. `detectDamageType` — 한글 desc 기반 피해 타입 판별
2. `DAMAGE_VAR_PRIORITY` — 확장된 변수명 매칭 목록
3. `detectScaling` — 변수명 + desc 기반 스케일링 판별
4. `parseAbility` 리팩토링 — 위 3개 함수 통합

### Phase 2: 고유 변수명 처리
5. 'Damage' 문자열을 포함하는 변수 중 첫 번째를 폴백으로 사용
6. 그래도 없으면 null 반환 (피해 0)

### Phase 3: 검증
7. 72명 전체 챔피언에 대해 `parseAbility` 결과 확인 스크립트
8. `pnpm lint && pnpm typecheck && pnpm build`

---

## 6. 영향 범위

- **전투 피해 계산이 완전히 바뀜** — 기존 시뮬레이션 결과와 달라짐
- 결정론적 동작은 유지 (동일 시드 → 동일 결과)
- 타 시스템(마나, 타게팅, 시너지) 영향 없음

---

*Created: 2026-04-16*
*Feature: ability-parse-fix*
*Phase: Plan*
