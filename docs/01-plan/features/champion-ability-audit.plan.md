# Champion Ability Audit Plan

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 116챔피언 중 다수가 JSON description과 ability.ts 구현이 불일치 — 시뮬레이션 정확도 저하 |
| **Solution** | 자동 감사 스크립트 + 배치 수정으로 전 챔피언 ability 구현을 description 기준으로 검증·교정 |
| **Function UX Effect** | 시뮬레이션 결과가 실제 게임과 일치하여 분석 도구로서의 신뢰도 확보 |
| **Core Value** | 시뮬레이션 정확도 > 그래픽 — 프로젝트 핵심 철학 실현 |

---

## 1. 현황 분석

### 1.1 데이터 규모

| 항목 | 수치 |
|------|------|
| TFT16 챔피언 (JSON) | 106명 |
| ability.ts 등록 | 87개 |
| **미등록** | **19개** |

### 1.2 미등록 챔피언 분류

**특수 유닛 (구현 불필요)** — 8개:
- `AnnieTibbers` (소환수), `AzirSoldier` (모래 병사), `MalzaharVoidling` (공허충)
- `FreljordProp` (장식물), `PiltoverInvention` (발명품), `RiftHerald` (전령)
- `BaronNashor` (내셔 남작), `THex` (T-헥스)

**실제 챔피언 미등록** — 11개:
| 챔피언 | 설명 요약 | 예상 난이도 |
|--------|----------|------------|
| Blitzcrank | 보호막 + 후킹(가장 먼 적 끌어오기) | High (위치 변경) |
| Atakhan | 패시브 흡혈 + AOE | Medium |
| Azir | 모래 병사 소환 + 패시브 | High (소환 메카닉) |
| Bard | 주변 적에게 정령 발사 | Medium |
| Kobuko | 유미 합체 패시브 | High (합체 메카닉) |
| Mel | 회전 찬란 + 스킬 발동 | High (패시브 메카닉) |
| Nautilus | 패시브 CC + 앵커 던지기 | Medium |
| Sion | 패시브 HP 성장 + AOE 시전 | Medium |
| Thresh | 패시브 주변 DOT + 후킹 | High (위치 변경) |
| Viego | 패시브 AS 버프 + 강화 공격 | Medium |
| Yorick | 체력 회복 + 구울 소환 | High (소환 메카닉) |

### 1.3 기등록 챔피언 잠재적 불일치 유형

| 불일치 유형 | 예시 | 영향도 |
|------------|------|--------|
| **패턴 오류** | description은 AOE인데 single로 등록 | Critical |
| **효과 누락** | description에 쉴드/힐/스턴이 있는데 미구현 | Major |
| **수치 오류** | maxTargets, radius, stunDuration 불일치 | Major |
| **대상 선택 오류** | "가장 먼 적" vs "가장 가까운 적" | Major |
| **패시브 미구현** | `<spellPassive>` 기반 효과 미반영 | Minor (MVP 범위 외 가능) |
| **버프/디버프 누락** | 공속 버프, 방관 디버프 등 미적용 | Minor |

---

## 2. 감사 전략

### 2.1 Phase 1 — 자동 감사 스크립트 (`scripts/audit-abilities.ts`)

JSON description에서 키워드를 추출하여 ability.ts 구현과 자동 비교:

**검출 가능한 불일치:**

| 검출 항목 | description 키워드 | ability.ts 대응 필드 |
|----------|-------------------|---------------------|
| 스턴 누락 | `기절`, `StunDuration` | `stun` |
| 힐 누락 | `회복`, `Heal` | `heal: true` |
| 쉴드 누락 | `보호막`, `Shield` | `getAbilityShield()` |
| 패턴 불일치 | `주변 적`, `범위 내` → AOE | `pattern` |
| 대시 누락 | `돌진`, `도약`, `날아가` | `dash` |
| 다수 대상 | `@NumTargets@`, `적 N명` | `maxTargets` |
| 디버프 누락 | `방어력 감소`, `마법 저항력` | `debuff` |
| 버프 누락 | `공격 속도`, `공격력` 증가 | `selfBuff`, `allyBuff` |

**스크립트 출력 형식:**
```
[CRITICAL] TFT16_Rumble: description에 보호막(Shield) 있음 → ability.ts에 shield 미구현
[MAJOR]    TFT16_Bard: ability.ts에 미등록
[MAJOR]    TFT16_Lulu: description에 StunDuration=1.5 → ability.ts stun=2.0 (수치 불일치)
[MINOR]    TFT16_Garen: description에 '주변' 키워드 → radius 확인 필요
```

### 2.2 Phase 2 — 수동 검증 (배치별)

자동 감사에서 잡지 못하는 케이스를 챔피언 10~15명씩 묶어서 검증:

| 배치 | 대상 | 기준 |
|------|------|------|
| Batch 1 | 1코스트 챔피언 (~18명) | 코스트순 |
| Batch 2 | 2코스트 챔피언 (~20명) | 코스트순 |
| Batch 3 | 3코스트 챔피언 (~20명) | 코스트순 |
| Batch 4 | 4코스트 챔피언 (~18명) | 코스트순 |
| Batch 5 | 5코스트 챔피언 (~15명) | 코스트순 |
| Batch 6 | 미등록 11명 + 특수 유닛 | 신규 등록 |

### 2.3 Phase 3 — 배치 수정

같은 유형의 불일치를 묶어서 일괄 수정:

| 수정 유형 | 작업 내용 |
|----------|----------|
| 미등록 추가 | 11개 챔피언 ability.ts 등록 |
| 효과 추가 | stun/heal/shield/dash 필드 추가 |
| 패턴 변경 | pattern 타입 변경 (single→aoe 등) |
| 수치 교정 | radius, maxTargets, stunDuration 수정 |
| 신규 메카닉 | 소환/합체/위치변경 등 (MVP 범위 판단 후) |

---

## 3. 구현 범위

### 3.1 In-Scope (이번에 하는 것)

- [ ] 감사 스크립트 작성 (`scripts/audit-abilities.ts`)
- [ ] 전체 불일치 리포트 생성
- [ ] 기등록 87개 챔피언 패턴/효과 교정
- [ ] 미등록 11개 챔피언 중 단순 패턴 챔피언 등록
- [ ] 쉴드/힐/스턴/디버프/버프 효과 누락분 추가

### 3.2 Out-of-Scope (이번에 안 하는 것)

- 소환 메카닉 (Azir 모래병사, Yorick 구울) — 별도 feature로 분리
- 위치 변경 메카닉 (Blitzcrank 후킹, Thresh 후킹) — 별도 feature로 분리
- 합체 메카닉 (Kobuko+유미) — 별도 feature로 분리
- 패시브 효과 전체 구현 (`<spellPassive>` 기반) — 별도 feature로 분리
- 특수 유닛 8개 — 소환수/장식물이라 ability 등록 불필요

---

## 4. 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `scripts/audit-abilities.ts` | 신규 — 감사 스크립트 |
| `src/lib/simulator/systems/ability.ts` | 수정 — 패턴/효과 교정, 미등록 추가 |
| `src/lib/simulator/engine/combatLoop.ts` | 수정 — 쉴드/힐/디버프 적용 로직 보강 (필요 시) |

---

## 5. 성공 기준

| 항목 | 목표 |
|------|------|
| 등록률 | 플레이어블 챔피언 100% 등록 (특수 유닛 제외) |
| 패턴 정확도 | description과 pattern 불일치 0건 |
| 효과 커버리지 | 스턴/힐/쉴드/대시 description 대비 90% 이상 구현 |
| 빌드 통과 | `pnpm lint && pnpm typecheck && pnpm build` 전부 통과 |

---

## 6. 작업 순서

1. 감사 스크립트 작성 및 실행
2. 불일치 리포트 분석 및 우선순위 분류
3. Critical/Major 불일치 일괄 수정
4. 미등록 챔피언 추가 (단순 패턴)
5. 빌드 검증
6. 복잡 메카닉 챔피언은 별도 Plan으로 분리
