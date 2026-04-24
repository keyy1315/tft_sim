# Plan: Set 17 팀 코드 Import 복구

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | team-code-set17 |
| 작성일 | 2026-04-21 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | `tft_set17_teamplanner.json` 의 `mapping` 이 **빈 배열** 이어서 Set 17 팀 코드를 붙여넣어도 모든 슬롯이 "알 수 없는 코드" 로 튕기고 보드에 아무도 올라가지 않음. 또한 디코드된 유닛이 현재 1성 기본이라 사용자 의도(2성 기본)와 불일치 |
| **Solution** | (1) Set 17 챔피언 → `teamPlannerCode` 매핑 JSON 채우기 (CommunityDragon 기반, 사용자가 준 예제 코드 8명으로 역산 검증) (2) `decodeTeamCode` 의 star=0 → 2성으로 해석 변경 (3) 기존 `autoPlaceChampions` (전방 Tank/Fighter/Assassin, 후방 나머지) 로직은 그대로 재사용 |
| **Function UX Effect** | `0204601404e02d02102e011037000000TFTSet17` 붙여넣기 → 리산드라/꼬마정령/모데카이저/파이크/라아스트/빅토르/일라오이/나미 8명이 2성으로 TEAM A 보드에 배치, 전방/후방 자동 구분 |
| **Core Value** | 팀 코드를 통한 빠른 덱 재현 — 시뮬레이터 진입 시간 단축 및 공유 가능한 빌드 워크플로우 복구 |

---

## 1. 현재 상태

### 1.1 이미 구현됨 (재사용)

| 항목 | 위치 | 상태 |
|------|------|------|
| 팀 코드 디코더 `decodeTeamCode` | `src/lib/teamCode.ts:22-72` | ✅ 128-bit 포맷, header 10 + slot 12 (code 10 + star 2) 파싱 |
| 팀 코드 인코더 `encodeTeamCode` | `src/lib/teamCode.ts:74-99` | ✅ |
| 역할군 기반 자동 배치 `autoPlaceChampions` | `src/lib/teamCode.ts:109-148` | ✅ Tank/Fighter/Assassin 전방, 나머지 후방 |
| `TeamCodePanel` UI (import 입력 + export 복사) | `src/components/builder/TeamCodePanel.tsx` | ✅ 버튼/입력/에러 표시 동작 |
| Simulator 페이지 통합 | `src/app/simulator/page.tsx:299-312` | ✅ 패널 토글 + onImport → `updatePlayerTeam / updateEnemyTeam` |

### 1.2 결함

**핵심**: `public/data/tft_set17_teamplanner.json` 의 내용:

```json
{ "mapping": [] }
```

→ `decodeTeamCode` 가 모든 plannerCode 에 대해 `mapping.find()` 를 실패시켜 warnings 만 누적, `result.champions.length === 0` 으로 "디코딩된 챔피언이 없습니다" 표시.

**부차**: `decodeTeamCode:67` 의 기본값 정책: `starLevel === 0 ? 1 : starLevel` — 사용자 요구사항 "코드로 import 한 유닛은 기본 2성" 과 상반.

### 1.3 예제 코드 역산 (검증용)

`0204601404e02d02102e011037000000TFTSet17` 를 수동 디코드:

| 슬롯 | plannerCode | 사용자 제공 챔피언 | 예상 apiName |
|------|------------|-------------------|-------------|
| 0 | 70 | 리산드라 | `TFT17_Lissandra` |
| 1 | 20 | 꼬마정령 | `TFT17_???` (Fae 계열) |
| 2 | 78 | 모데카이저 | `TFT17_Mordekaiser` |
| 3 | 45 | 파이크 | `TFT17_Pyke` |
| 4 | 33 | 라아스트 | `TFT17_Rhaast` |
| 5 | 46 | 빅토르 | `TFT17_Viktor` |
| 6 | 17 | 일라오이 | `TFT17_Illaoi` |
| 7 | 55 | 나미 | `TFT17_Nami` |

모든 star 필드 = `00` (요구사항: 2성으로 해석).

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 내용 | 우선순위 |
|----|------|---------|
| FR-01 | `tft_set17_teamplanner.json` 에 Set 17 전체 챔피언의 `{ apiName, teamPlannerCode }` 매핑이 채워져 있어야 한다 | P0 |
| FR-02 | 예제 코드 `0204601404e02d02102e011037000000TFTSet17` 을 TEAM A 에 import 하면 리산드라/꼬마정령/모데카이저/파이크/라아스트/빅토르/일라오이/나미 8명이 보드에 배치된다 | P0 |
| FR-03 | 팀 코드로 import 된 유닛의 `starLevel` 기본값은 **2성** | P0 |
| FR-04 | 역할군 기반 자동 배치: Tank/Fighter/Assassin → 전방, Caster/Marksman/Specialist → 후방 | P0 |
| FR-05 | 빈 슬롯(plannerCode=0)은 건너뛰고 오류 없음 | P0 |
| FR-06 | 코드에 포함된 챔피언 중 매핑되지 않은 것은 warning 에 남기고 나머지는 정상 import | P1 |

### 2.2 비기능 요구사항

- 기존 Set 16 매핑(`tft_set16_teamplanner.json`) 불변.
- `encodeTeamCode` 와의 round-trip: 2성 유닛을 export → import 시 동일한 유닛 세트가 2성으로 복원되어야 한다 (FR-03 영향).
- `teamPlannerCode` 는 라이엇 공식 TeamPlanner 포맷과 호환 유지 — 해당 데이터가 CommunityDragon 에 제공되면 우선 사용, 없으면 예제 역산으로 시드 후 사용자 관측 시 확장.

---

## 3. 구현 방안

### 3.1 매핑 데이터 수집

**A 경로 (권장): CommunityDragon 에서 전체 매핑 수집**

- 조사 대상: `https://raw.communitydragon.org/latest/cdragon/tft/en_us.json` 의 `setData[setId].champions` 내 `teamPlannerCode` 필드 (또는 `cdragon/tft/.../teamplanner.json` 계열).
- 발견 시 → Set 17 챔피언 전체에 대해 매핑 JSON 일괄 생성.
- 스크립트가 필요하면 `scripts/build-teamplanner.ts` 1회성 작성 후 결과만 커밋 (스크립트 자체도 커밋).

**B 경로 (A 실패 시): 부분 매핑 + 점진 확장**

- 사용자 제공 예제 코드에서 역산된 8쌍 먼저 하드코딩:
  ```json
  { "mapping": [
    { "apiName": "TFT17_Illaoi",      "teamPlannerCode": 17 },
    { "apiName": "TFT17_???" ,        "teamPlannerCode": 20 },   // 꼬마정령
    { "apiName": "TFT17_Rhaast",      "teamPlannerCode": 33 },
    { "apiName": "TFT17_Pyke",        "teamPlannerCode": 45 },
    { "apiName": "TFT17_Viktor",      "teamPlannerCode": 46 },
    { "apiName": "TFT17_Nami",        "teamPlannerCode": 55 },
    { "apiName": "TFT17_Lissandra",   "teamPlannerCode": 70 },
    { "apiName": "TFT17_Mordekaiser", "teamPlannerCode": 78 }
  ]}
  ```
- 나머지 챔피언은 dev 환경에서 TFT 공식 Team Planner 를 열어 각 유닛 단독 export → 코드 역산 → 매핑 추가.
- 이 경우 구현 단계에서 "꼬마정령" 의 정확한 `apiName` 먼저 확정 (Set 17 챔피언 목록에서 Fae/Sprite 계열 검색).

Design 단계에서 A/B 어느 경로로 가는지 확정. 일단 Plan 은 A 우선, B 백업으로 기술.

### 3.2 기본 2성 정책 (FR-03)

`src/lib/teamCode.ts:67` 수정:

```diff
-      starLevel: starLevel === 0 ? 1 : starLevel,
+      // 팀 코드 import 시 star=0 (미지정) 은 "기본 2성" 으로 해석 — UX 요구사항.
+      // star=1/2/3 은 명시적 값이면 그대로 사용.
+      starLevel: starLevel === 0 ? 2 : starLevel,
```

- Encoder (`encodeTeamCode:87`) 의 `starLevel <= 1 ? 0 : ...` 는 그대로 유지 (export 시 1성 → 0). import 쪽만 의미 재해석.
- Round-trip 의미: 1성 유닛을 export → import 하면 2성이 되는 비대칭 발생. 다만 요구사항 명시적이므로 수용. 문서로 표기.

### 3.3 자동 배치 검증

`autoPlaceChampions` 는 이미:
- `FRONT_ROLES = {'Tank', 'Fighter', 'Assassin'}` 전방
- 나머지 (`Caster`, `Marksman`, `Specialist`) 후방
- TEAM A: 전방 row 0→1, 후방 row 3→2 (시뮬레이터 규약에서 `toEightRowCoords(+4)` 적용)
- TEAM B: 전방 row 3→2, 후방 row 0→1

사용자가 "전사, 탱커 전방, 딜러 후방" 이라고 한 요구와 일치 (Assassin 은 전방이지만 위치를 뒤로 보내고 싶으면 별도 논의 — 현 스펙 상 전방 유지).

구현 변경 **없음**. 기능 테스트로만 검증.

### 3.4 에러 처리 (FR-05, FR-06)

- 현재 `decodeTeamCode` 는 매핑되지 않은 코드를 warnings 에 push, plannerCode=0 은 skip. 이미 적합.
- `TeamCodePanel.handleImport` 는 warnings 를 노란색 텍스트로 표시. 그대로 사용.

---

## 4. 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `public/data/tft_set17_teamplanner.json` | 수정 (데이터 채우기) | 핵심 — mapping 배열 완성 |
| `src/lib/teamCode.ts` | 1줄 수정 | `starLevel === 0 ? 2 : starLevel` |
| (optional) `scripts/build-teamplanner.ts` | 신규 (A 경로 선택 시) | CommunityDragon → JSON 생성 스크립트 |

---

## 5. 테스트 계획

### 5.1 핵심 시나리오

- [ ] 시뮬레이터 진입 → "팀 코드" 버튼 → TEAM A 선택 → `0204601404e02d02102e011037000000TFTSet17` 붙여넣기 → "로드" 클릭.
- [ ] 8명(리산드라/꼬마정령/모데카이저/파이크/라아스트/빅토르/일라오이/나미)이 보드에 표시.
- [ ] 모두 **2성**.
- [ ] Tank/Fighter/Assassin 역할은 전방 row(하단), Caster/Marksman/Specialist 는 후방 row(상단).
- [ ] "전투 시작" → 시뮬레이션 정상 실행.

### 5.2 회귀

- [ ] TEAM A / TEAM B 버튼 전환 후 같은 코드 import → 해당 팀에만 유닛 올라감.
- [ ] 팀 코드 export → clipboard 복사 → 다시 import → 동일 유닛(2성) 복원.
- [ ] Set 16 팀 코드는 영향받지 않음 (시즌 탭이 16일 때 또는 Set 16 매핑 사용 시 기존 동작 유지).
- [ ] 매핑되지 않은 코드 포함 시 warnings 만 표시, 나머지는 정상 import.

### 5.3 빌드

- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과.

---

## 6. 범위 외

- 팀 코드에 아이템/증강 정보 인코딩 (현재 포맷은 유닛+성급만 지원).
- CommunityDragon 자동 동기화 파이프라인 (스크립트 1회성 실행으로 충분).
- Set 16 기존 매핑 재정비.
- 팀 코드 공유 URL 생성.
