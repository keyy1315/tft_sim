# Plan: 아이오니아 시너지 — 길 선택 + 전투 능력치 적용

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 아이오니아 시너지 길 선택 |
| 작성일 | 2026-03-23 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 아이오니아 시너지가 켜져도 5가지 길(검/깨달음/초월/번영/영혼)의 능력치가 전투 시뮬레이션에 반영되지 않음. 아이오니아 유닛은 시너지 효과 없이 전투하여 시뮬레이션 정확도 저하 |
| **Solution** | UI에 길 선택 드롭다운 추가 + 선택한 길의 능력치를 `SimulateOptions`로 전달 + 전투 엔진에서 적용 |
| **Function UX Effect** | 아이오니아 시너지 활성 시 5가지 길 중 선택 가능, 선택한 길의 공격력/방어력/체력 등이 아이오니아 유닛에 즉시 반영 |
| **Core Value** | 아이오니아 조합의 전투력을 정량적으로 분석 가능. 길별 차이 비교 시뮬레이션 |

---

## 1. 아이오니아 5가지 길 (JSON 데이터 기준)

### 1.1 검의 길 (Blades)

| 변수 | 3/5/7/10 | 설명 |
|------|----------|------|
| `BladesPercentChance` | 30/38/45/70% | 기본 공격 시 추가 피해 확률 |
| `BladesFlatDamage` | -/-/-/25 | 추가 고정 피해 (10단계만) |

### 1.2 깨달음의 길 (Enlightenment)

| 변수 | 3/5/7/10 | 설명 |
|------|----------|------|
| `EnlightenmentADAP` | 10/15/20/100 | 공격력 + 주문력 |
| `EnlightenmentADAPPerLevel` | 2/3/4/- | 레벨당 추가 AD+AP |
| `EnlightenmentXP` | 1/2/4/4 | 경험치 보너스 (시뮬 제외) |

### 1.3 초월의 길 (Transcendence)

| 변수 | 3/5/7/10 | 설명 |
|------|----------|------|
| `TranscendenceHealth` | 10/15/20/30% | 최대 체력 % 증가 |
| `TranscendenceMagicDamage` | 20/25/30/70% | 마법 피해 증폭 |
| `Transcendence3StarBuff` | 1.3배 | 3성 유닛 버프 배율 |

### 1.4 번영의 길 (Generosity)

| 변수 | 3/5/7/10 | 설명 |
|------|----------|------|
| `GenerosityADAP` | 10/25/40/50 | 공격력 + 주문력 |
| `GenerosityIncreasePerGold` | 2% | 보유 골드당 추가 % (시뮬에서 고정값 필요) |

### 1.5 영혼의 길 (Spirit)

| 변수 | 3/5/7/10 | 설명 |
|------|----------|------|
| `SpiritADAP` | 3/4/5/7 | 매 전투 시작 시 AD+AP |
| `SpiritHealth` | 25/30/35/75% | 최대 체력 % 증가 |

### 1.6 추가 변수 (해시 키)

| 해시 | 3/5/7/10 | 추정 |
|------|----------|------|
| `{11fa863c}` | 5/4/3/1 | 전투 시작 쿨다운 (초?) |
| `{da553f4f}` | 15/25/50/100 | 피해량 관련 |

---

## 2. 전투 시뮬레이션 적용 가능한 능력치

### 2.1 MVP 적용 대상

| 길 | 적용할 능력치 | 적용 방식 |
|----|-------------|----------|
| **검의 길** | 기본 공격 시 `BladesPercentChance` 확률로 추가 물리 피해 | 공격 데미지 계산부 |
| **깨달음의 길** | `EnlightenmentADAP`만큼 AD+AP 증가 | 전투 시작 시 스탯 버프 |
| **초월의 길** | 체력 `TranscendenceHealth`% 증가 + 마법 피해 `TranscendenceMagicDamage`% 증폭 | 전투 시작 시 체력 버프 + damageAmp |
| **번영의 길** | `GenerosityADAP`만큼 AD+AP 증가 (골드 비례는 UI에서 입력) | 전투 시작 시 스탯 버프 |
| **영혼의 길** | `SpiritADAP` AD+AP + `SpiritHealth`% 체력 증가 | 전투 시작 시 스탯+체력 버프 |

### 2.2 시뮬레이터 제외

- `EnlightenmentXP`: 경험치는 전투 시뮬레이션과 무관
- `GenerosityIncreasePerGold`: 골드 보유량은 UI에서 별도 입력 필요 (후순위)
- `Transcendence3StarBuff`: 3성 유닛 추가 버프 (후순위)

---

## 3. 구현 범위

### 3.1 UI 변경

- `useTeamManagement` 훅에 `playerIoniaPath` / `enemyIoniaPath` 상태 추가
- 아이오니아 시너지 활성 시 길 선택 드롭다운 표시 (SynergyPanel 옆 또는 별도 패널)
- 5가지 선택지: 검의 길 / 깨달음의 길 / 초월의 길 / 번영의 길 / 영혼의 길

### 3.2 엔진 변경

- `SimulateOptions`에 `playerIoniaPath` / `enemyIoniaPath` 필드 추가
- `simulateCombat()` 내 전투 시작 전에 아이오니아 유닛에 선택된 길의 능력치 적용
- 검의 길: 공격 데미지 계산부에 확률 기반 추가 피해 로직

### 3.3 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/hooks/useTeamManagement.ts` | 길 선택 상태 + 핸들러 |
| `src/app/simulator/page.tsx` | `simulateCombat` 호출 시 ioniaPath 전달 |
| `src/lib/simulator/engine/combatLoop.ts` | `SimulateOptions` 확장 + 아이오니아 능력치 적용 함수 |
| `src/components/builder/SynergyPanel.tsx` 또는 새 패널 | 길 선택 UI |
| `src/data/traitModules.ts` | 아이오니아 길 상수 정의 |

---

## 4. 수용 기준

1. 아이오니아 시너지 활성 시 5가지 길 중 하나를 선택할 수 있음
2. 선택한 길의 능력치가 아이오니아 유닛에 전투 시작 시 적용됨
3. 깨달음/번영/영혼: AD+AP 및 체력 증가가 스탯에 반영
4. 초월: 체력 % 증가 + 마법 피해 증폭이 반영
5. 검: 기본 공격 시 확률적 추가 피해가 발동
6. 전투 로그에 `[아이오니아] {길 이름} 적용!` 로그 기록
7. `pnpm lint && pnpm typecheck && pnpm build` 통과
