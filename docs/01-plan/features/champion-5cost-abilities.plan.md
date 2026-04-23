# Plan: 5코스트 챔피언 스킬 + 고유 시너지 정확도 개선

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | champion-5cost-abilities |
| 작성일 | 2026-04-21 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 5코스트 챔피언의 스킬이 `multi/aoe_circle` 근사 수준으로만 구현되어 있고, 소환물(쉔 유물, 제드 분신)과 변신(모르가나 어둠의 형상) 같은 정체성이 빠져 있음. 더구나 각 5코의 **고유 시너지**(파멸자/신성결투가/어둠의 여인/말살자/파티광/보루/최신상/지휘관/은하계사냥꾼)가 실제 엔진에서 적용되는지 검증되지 않은 상태 |
| **Solution** | (1) **쉔 유물** 을 비아/바이엔과 동일한 `AUTO_UNIT` 패턴으로 편집창 배치 시 자동 소환 + 보루 시너지에 명시된 인접 아군 보호막/공속 부여 (2) 유물 아이콘은 로컬 → CommunityDragon → 쉔 스프라이트 폴백 순으로 확보 (3) 5코 고유 시너지 10개 각각 현재 구현 상태 감사 → 누락분 구현 (4) 5코 스킬 본체는 Phase 1 에 보호막/변신/소환 핵심만 구현, 고급 연출은 범위 외 |
| **Function UX Effect** | 쉔을 보드에 올리면 유물이 자동으로 옆 칸에 배치되고 전투 시작 시 인접 아군이 보호막+공속을 얻음. 벡스·피오라·모르가나·진·블리츠 등 5코의 고유 시너지 효과가 실제 전투 스탯/DPS 에 반영됨 |
| **Core Value** | 5코 챔피언을 덱에 넣었을 때의 "정체성" 과 "덱 밸류" 가 시뮬레이터에서 실제 게임 감각과 부합하도록 복구 |

---

## 1. 현재 구현 현황

### 1.1 재사용 (변경 없음)

| 항목 | 위치 | 역할 |
|------|------|------|
| `AUTO_UNIT_API_NAMES` 자동 소환 메커니즘 | `src/data/specialUnits.ts:45-54` | `TFT16_AnnieTibbers`, `TFT16_FreljordTurret`, `TFT16_AzirSoldier`, `TFT17_Summon` (비아/바이엔) |
| `isAutoUnit(apiName)` | `src/data/specialUnits.ts:52-54` | 편집창/보드에서 자동 배치 처리 분기 |
| `TFT17_Summon` 정의 (비아/바이엔 예시) | `src/data/specialUnits.ts:35-43` | `cost:11`, role, stats, ability 필수 |
| AbilityConfig registry | `src/lib/simulator/systems/ability.ts:228-239` | 5코 10명 스킬 근사 구현 |
| trait effect resolver | `src/lib/simulator/systems/trait.ts`, `items/definitions/` | 개별 trait 효과 엔진 적용 |

### 1.2 결함 개요

#### A. 쉔 유물 소환 (최우선)

- 쉔 trait **보루** (`TFT17_ShenUniqueTrait`, breakpoints=[1], unique=true) 설명:
  > "배치할 수 있는 **유물을 소환** 합니다. 전투 시작 시 유물은 인접한 아군에게 최대 체력의 `@PercentHealthShield*100@%` 에 해당하는 보호막과 `@AttackSpeed*100@%` 의 공격 속도를 부여합니다."
- 현재: 유물 유닛 entry 자체가 없음. `AUTO_UNIT_API_NAMES` 에도 미포함. 편집창에서 쉔을 올려도 아무 소환 없음.
- 시뮬 전투에서도 보호막/공속 buff 미적용.

#### B. 5코 고유 시너지 Unique Trait 10종 감사 대상

| 챔피언 | Unique Trait | apiName | 핵심 효과 |
|--------|-------------|---------|----------|
| 쉔 | 보루 | `TFT17_ShenUniqueTrait` | 유물 소환 + 인접 보호막/공속 |
| 벡스 | 파멸자 | `TFT17_VexUniqueTrait` | 첫 피격 시 적 AD/AP 강탈 → 벡스에게 부여 |
| 피오라 | 신성 결투가 | `TFT17_FioraUniqueTrait` | 1대1 대결 항상 승리 + 승리 시 전략가 HP 회복 |
| 모르가나 | 어둠의 여인 | `TFT17_MorganaUniqueTrait` | 아군 스킬 피해 감소 (변신 중 추가 감소) |
| 진 | 말살자 | `TFT17_JhinUniqueTrait` | 적 방어력/마저 감소 |
| 블리츠크랭크 | 파티광 | `TFT17_BlitzcrankUniqueTrait` | HP 임계치 → 대상지정 불가 + 자가 회복 |
| 제드 | 은하계 사냥꾼 | `TFT17_ZedUniqueTrait` | 분신 생존 중 제드 AD 보너스 |
| 그레이브즈 | 최신상 | `TFT17_GravesTrait` | 라운드 후 무기고 업그레이드 (PvP) |
| 소나 | 지휘관 | `TFT17_SonaUniqueTrait` | 랜덤 지휘 모드 (PvP) |
| — | — | — | (바드·그레이브즈·블리츠는 공유 trait 도 있으나 본 feature 에서는 Unique 만) |

현재 `TFT17_*UniqueTrait` 10 개가 엔진 trait resolver 에 등록/적용되는지 **검증 필요**.

#### C. 스킬 본체 근사 문제 (직전 대화 참고)

| 챔피언 | 누락 | 우선순위 |
|--------|-----|---------|
| 쉔 | 보호막 획득, 패시브 누적 추가피해 | P0 (본 feature) |
| 모르가나 | 어둠의 형상 변신, 보호막, 최종 폭발 | P0 |
| 제드 | 분신 소환 (완전 미구현) | P1 |
| 진 | 고정 공속 + AS→AD 전환 패시브 | P1 |
| 벡스 | 첫 피격 강탈 이벤트 | P1 |
| 기타 | 미세 근사 | P2 |

---

## 2. 요구사항

### 2.1 기능 요구사항 (Phase 1 — 본 feature 범위)

| ID | 내용 | 우선순위 |
|----|------|---------|
| FR-01 | 편집창에서 쉔(`TFT17_Shen`)을 보드에 올리면 인접한 빈 슬롯에 "유물" 유닛이 자동 배치된다 (비아/바이엔과 동일 UX) | P0 |
| FR-02 | 유물 유닛은 공격/이동 없이 자리 잡음 (보조 탱킹 또는 totem 형태) | P0 |
| FR-03 | 전투 시작 시점에 유물 주변 인접 6칸 아군에게 `최대 체력 × PercentHealthShield` 보호막 + `AttackSpeed` 공속 부여 | P0 |
| FR-04 | 쉔을 보드에서 제거하면 유물도 함께 제거된다 | P0 |
| FR-05 | 유물 아이콘: 로컬 champions.json 에 있으면 재사용, 없으면 CommunityDragon `Characters/TFT17_Shen*/HUD/*Square.png` 계열에서 다운로드해 `public/data/images/tft_set17_champions/` 에 저장 | P0 |
| FR-06 | 10개 Unique Trait 현재 적용 상태를 audit 스크립트 또는 문서로 기록 (pass/miss 표) | P0 |
| FR-07 | audit 결과에서 **완전 미적용** 인 trait 을 최소 구현 (단순 버프 타입부터) | P1 |
| FR-08 | 쉔 스킬 자체에 `shield` 획득 효과 추가 (`AbilityConfig.selfBuff.shield`) | P1 |
| FR-09 | 모르가나 스킬에 "변신 상태 + 보호막" selfBuff 추가 | P1 |

### 2.2 비기능 요구사항

- `AUTO_UNIT_API_NAMES` 확장 시 기존 비아/바이엔/티버/포탑/모래병사 동작 변화 없음.
- 결정론적 시뮬: 유물 소환은 팀 구성만으로 예측 가능, 무작위성 없음.
- React Compiler 규칙 준수 (편집창 `useEffect` 내 직접 `setState` 금지 — 기존 패턴 따름).
- 유물 아이콘 파일 크기 < 100KB 권장.

---

## 3. 구현 방안 개요

### 3.1 Phase A — 쉔 유물 소환 (P0, FR-01~FR-05, FR-08)

#### A.1 유물 유닛 정의

- `src/data/specialUnits.ts` 에 `SHEN_ARTIFACT_CHAMPION: RawChampion` 추가.
  ```ts
  apiName: 'TFT17_ShenArtifact',   // 실제 CD 에서 확인되는 apiName 으로 맞춤
  cost: 11,                        // 소환 유닛 규약
  traits: [],
  role: null,                      // 이동/공격 없음
  stats: { damage: 0, attackSpeed: 0, range: 0, hp: 1, ... },  // totem 형태
  ability: { name: '유물', desc: '...' , ... }
  ```
- `AUTO_UNIT_API_NAMES` 에 `'TFT17_ShenArtifact'` 추가.

#### A.2 편집창 자동 배치 트리거

- 쉔 챔피언을 보드에 배치할 때 `autoSpawnCompanion(championApiName) → companionApiName` 매핑 조회.
- 기존 `TFT17_Summon` (비아/바이엔) 이 길잡이 trait 에 의해 자동 소환되는 로직을 조사해 패턴 재사용.

#### A.3 전투 시작 buff 적용

- `TFT17_ShenUniqueTrait` trait resolver 에 "전투 시작 이벤트 훅" 등록 — 유물 유닛 주변 인접 6칸(axial hex 거리 1) 아군에게 보호막 + 공속 부여.
- 유물 유닛 자체는 피해/타겟 대상 (타겟팅 가능 여부는 원본 스펙 확인 후 결정 — 기본은 타겟 불가).

#### A.4 유물 아이콘 확보

1. **Do 단계 진입 시** 확인 순서:
   - 로컬 `public/data/images/tft_set17_champions/` 에 `shen_artifact*.png` 류 존재?
   - CommunityDragon `https://raw.communitydragon.org/latest/game/assets/characters/tft17_shen_artifact/hud/tft17_shen_artifact_square.tft_set17.png` 유사 경로 여러 변종 시도 (WebFetch).
   - 없으면 `tftchampions-teamplanner.json` / `en_us.json` 에서 `TFT17_Shen*` 또는 `TFT17_Artifact*` entry 탐색.
2. 최후 폴백: 쉔 본체 아이콘을 톤다운한 재활용 (확정적 실패 회피).
3. 찾은 파일 → `public/data/images/tft_set17_champions/` 에 저장, `imageMap.ts` 의 apiName 매핑 규칙 자동 적용.

### 3.2 Phase B — Unique Trait 감사 & 최소 구현 (P0, FR-06~FR-07)

#### B.1 Audit 방법

- 수동 / `grep` 로 `TFT17_VexUniqueTrait` 등 10개 apiName 이 다음 위치에서 참조되는지 확인:
  - `src/lib/simulator/systems/trait.ts`
  - `src/lib/simulator/systems/items/definitions/*.ts`
  - `src/lib/analysis/estimateDps*.ts`
- 결과표: pass/miss + 누락 효과 명시.
- 저장: `docs/02-design/features/champion-5cost-abilities.design.md` 의 Audit 섹션.

#### B.2 Audit 기반 구현 우선순위 (예상)

| Trait | 예상 구현 난이도 | 노트 |
|-------|---------------|------|
| 말살자(진) | 낮음 | 적 전체 정적 방어력/마저 감소 |
| 어둠의 여인(모르가나) | 중 | 아군 스킬 피해 감소 (damageReduction, magic 전용) |
| 파티광(블리츠) | 중 | HP 임계치 → 대상지정 불가 + 회복 |
| 은하계 사냥꾼(제드) | 높음 | 분신 의존 (스킬 구현 필요) |
| 파멸자(벡스) | 중 | 첫 피격 이벤트 훅 + AD/AP 강탈 |
| 신성 결투가(피오라) | 낮음 (부분) | 1대1 자동승 무시 (시뮬 단위), 회복만 플레이어 메타 |
| 보루(쉔) | Phase A 에서 처리 | 유물 소환 + 인접 buff |
| 지휘관(소나) | 범위 외 | PvP 지휘 모드 — 시뮬 미지원 |
| 최신상(그레이브즈) | 범위 외 | 라운드 간 업그레이드 — 시뮬 1 회전에 미지원 |
| — | | |

### 3.3 Phase C — 스킬 본체 수정 (P1, FR-08~FR-09)

- 쉔: `selfBuff.shield` (변수 `ModifiedShield`) 추가 + 기본 공격 추가 피해 스택 (가능 시).
- 모르가나: `selfBuff` 에 duration 변신 상태 + shield 추가, 변신 종료 폭발은 `onEffectEnd` 훅 (스코프 체크 필요).
- 기타(진 패시브, 제드 분신, 벡스 첫 피격) → Phase 2 (별도 feature 로 분리 고려).

---

## 4. 영향 파일 (예상)

| 파일 | 유형 |
|------|------|
| `src/data/specialUnits.ts` | 수정 (유물 유닛 정의 + AUTO_UNIT_API_NAMES 추가) |
| `public/data/images/tft_set17_champions/shen_artifact_square.png` | 신규 (이미지 리소스) |
| `src/hooks/useTeamManagement.ts` 또는 쉔 배치 로직이 있는 곳 | 수정 (쉔 배치 시 companion 자동 소환) |
| `src/lib/simulator/systems/trait.ts` 또는 `items/definitions/shen.ts` | 신규/수정 (보루 trait 효과) |
| `src/lib/simulator/systems/ability.ts` | 수정 (쉔/모르가나 selfBuff 추가) |
| `docs/02-design/features/champion-5cost-abilities.design.md` | Audit 섹션 작성 |

총 변경 규모: 본 Plan 범위 내 약 +200 / −20 라인, 신규 이미지 1개.

---

## 5. 테스트 계획

### 5.1 쉔 유물 소환 (Phase A)

- [ ] 편집창에서 쉔 배치 → 유물 유닛이 인접 칸에 자동 생성.
- [ ] 쉔 제거 → 유물도 제거.
- [ ] 유물 아이콘 정상 표시 (깨진 이미지 placeholder 아님).
- [ ] 전투 시작 → 유물 인접 아군의 `currentShield`, `bonusAttackSpeed` 증가 확인 (CombatUnit 스냅샷).
- [ ] 시너지 패널에서 "보루" 활성 표시.

### 5.2 Unique Trait 감사 (Phase B)

- [ ] 10개 trait audit 표가 design.md 에 완성됨.
- [ ] 구현된 trait 은 1인 구성 배치 + 전투 1회 시 기대 효과 확인 (예: 말살자 활성 시 적 방어력 수치가 감소 표시).

### 5.3 스킬 본체 (Phase C)

- [ ] 쉔 스킬 발동 시 본인에게 shield 획득.
- [ ] 모르가나 스킬 발동 시 본인에게 변신+shield.

### 5.4 회귀

- [ ] 기존 비아/바이엔, 티버, 포탑, 모래 병사 자동 소환 동작 영향 없음.
- [ ] 5코 이외 챔피언 및 공유 trait (요새/선봉대 등) 영향 없음.
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과.

---

## 6. 대안 및 분할

| 접근 | 장점 | 단점 | 선택 |
|------|------|------|-----|
| **단일 feature (본 Plan)** | 쉔 유물 + Audit + 최소 구현이 한 번에 | 범위 크고 PR 커질 위험 | Phase A/B/C 로 나눠 관리 |
| 각 챔피언별 micro-feature | 작은 PR | 10개 feature = 오버헤드 | 제드 분신 등 큰 건만 별도 분리 |
| 현 상태 유지 + 공지 | 즉시 해결 가능한 작업 없음 | 요구 불만족 | ❌ |

**결정**: Phase A/B 는 본 feature 로, Phase C(제드 분신/진 패시브 등 대공사) 는 Design 단계에서 분리 여부 확정.

---

## 7. 위험 요소 & 완화

| 위험 | 완화 |
|------|------|
| CommunityDragon 에 쉔 유물 별도 apiName/아이콘 없음 | `TFT17_Shen*` prefix 변종 다수 시도 (`ShenArtifact`, `ShenBastion`, `ShenSummon`, `ShenRelic`) + 쉔 본체 아이콘 재활용 폴백 |
| 비아/바이엔 자동 소환 로직이 "길잡이 trait" 과 강결합되어 있어 쉔 전용 패턴 재사용 어려움 | Design 단계에서 기존 `TFT17_Summon` 트리거 위치 파악 후 범용 `autoSpawnCompanion` 헬퍼 추출 검토 |
| Unique Trait audit 결과 대부분이 "완전 미구현" 으로 판명되어 Phase B 범위 폭발 | Phase B 는 **정적 버프 타입만** 처리 (말살자, 어둠의 여인 damageReduction, 신성결투가 회복 등). 복잡한 이벤트 훅 (파티광, 파멸자) 은 분리 feature 로 이관 |
| 5코 스킬 본체 대공사 (제드 분신) 가 본 Plan 에 섞이면 범위 관리 실패 | Phase C 는 선택적. Design 단계에서 "Phase C 별도 feature 로 분리" 명시적 결정 |

---

## 8. 범위 외

- 제드 분신 생성 시스템 (별도 feature: `zed-clone-summon` 예정).
- 진 패시브 고정 공속 + AS→AD 변환 (별도 feature: `jhin-passive-conversion` 예정).
- 벡스 파멸자 첫 피격 이벤트 훅 (별도: `vex-doomed-mark`).
- 그레이브즈 최신상 / 소나 지휘관 — PvP/Round-scope 메타로 현 시뮬 구조 밖.
- 5코 외 챔피언(1~4코) 스킬 정확도 감사.
- 쉔 유물 타겟팅 규칙 정밀화 (타겟 가능/불가 원본 확인 → Design 단계).
