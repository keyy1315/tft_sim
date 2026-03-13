# Plan: 팀 코드 임포트/익스포트

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 시뮬레이터에서 팀 구성을 저장/공유할 방법이 없어 매번 수동으로 챔피언을 배치해야 한다 |
| **Solution** | TFT 공식 팀 코드 형식(128-bit bit-packed + "TFTSet16")을 파싱/생성하여 임포트/익스포트 기능 제공 |
| **Function UX Effect** | 텍스트 입력으로 즉시 팀 로드, 버튼 클릭으로 현재 팀을 공유 가능한 코드로 변환 |
| **Core Value** | 외부 커뮤니티(인벤, 롤체지지 등)의 팀 코드를 바로 시뮬레이터에 가져와 분석 가능 |

---

## 1. 기능 정의

### 1.1 목표
- TFT 공식 팀 코드(TeamPlanner Code) 형식을 디코딩하여 시뮬레이터에 챔피언 배치 (임포트)
- 시뮬레이터의 현재 팀 구성을 팀 코드로 인코딩하여 클립보드 복사 (익스포트)
- TEAM A / TEAM B 각각 독립적으로 임포트/익스포트 가능

### 1.2 팀 코드 형식 (역분석 결과)

```
[128-bit hex string][TFTSet16]

128비트 = 32자리 hex
구조: [10-bit header] + [9 × 12-bit champion slot] + [10-bit padding]

각 12-bit champion slot:
  - 상위 10-bit: team_planner_code (CommunityDragon 기준 챔피언 고유 ID)
  - 하위 2-bit: star level (0=빈 슬롯, 1=1성, 2=2성, 3=3성)

header 값: 배치된 챔피언 수 (예: 8명이면 0b0000001000 = 8)
```

**예시**: `0236b02533601935d35901f013012000TFTSet16`
→ 다리우스(875), 스웨인(37), 타릭(822), 멜(25), 쉬바나(861), 아지르(857), 제라스(31), 라이즈(19), 사일러스(18)

### 1.3 제약

- 팀 코드에는 **챔피언 + 성급**만 포함 (아이템, 배치 위치는 미포함)
- 임포트 시 배치 위치는 자동 할당 (row 0부터 좌→우 순차 배치)
- `team_planner_code` 매핑 데이터가 필요 (CommunityDragon 소스)
- 최대 9명 (TFT 팀 슬롯 한계)

---

## 2. team_planner_code 매핑 데이터

### 2.1 데이터 소스
CommunityDragon `tftchampions-teamplanner.json`에서 각 챔피언의 `team_planner_code` 필드를 사용.

### 2.2 데이터 저장 방식
`public/data/tft_set16_teamplanner.json` 파일로 매핑 테이블 저장:

```json
{
  "meta": { "set": 16, "source": "communitydragon" },
  "mapping": [
    { "apiName": "TFT16_Darius", "teamPlannerCode": 875 },
    { "apiName": "TFT16_Swain", "teamPlannerCode": 37 },
    ...
  ]
}
```

### 2.3 대안
챔피언 JSON에 `teamPlannerCode` 필드를 직접 추가하는 방법도 있으나, 기존 데이터 스키마 변경을 최소화하기 위해 별도 파일로 분리.

---

## 3. 구현 범위

### 3.1 신규 파일

| 파일 | 역할 |
|------|------|
| `src/lib/teamCode.ts` | 팀 코드 인코딩/디코딩 순수 함수 |
| `src/components/builder/TeamCodePanel.tsx` | 임포트/익스포트 UI 컴포넌트 |
| `public/data/tft_set16_teamplanner.json` | team_planner_code 매핑 데이터 |

### 3.2 수정 파일

| 파일 | 변경 |
|------|------|
| `src/app/simulator/page.tsx` | TeamCodePanel 통합, 임포트 시 팀 state 업데이트 |
| `src/data/loader.ts` | teamplanner 매핑 데이터 로드 함수 추가 |
| `src/hooks/useGameData.ts` | teamplanner 데이터 로드 훅 확장 |

---

## 4. 핵심 로직 설계

### 4.1 디코딩 (`decodeTeamCode`)

```
입력: "0236b02533601935d35901f013012000TFTSet16"
1. "TFTSet16" 접미사 검증 및 제거
2. hex 문자열 → 128비트 이진수 변환
3. 상위 10비트 = header (챔피언 수)
4. 이후 header × 12비트씩 읽기:
   - 상위 10비트 → team_planner_code
   - 하위 2비트 → star level
5. team_planner_code → apiName 매핑 (매핑 테이블 lookup)
6. apiName → RawChampion 매핑 (champions 배열 lookup)
출력: { champion: RawChampion, starLevel: number }[]
```

### 4.2 인코딩 (`encodeTeamCode`)

```
입력: PlacedChampion[]
1. 각 챔피언의 apiName → team_planner_code 매핑
2. header = 챔피언 수 (10비트)
3. 각 챔피언: team_planner_code(10비트) + starLevel(2비트) = 12비트
4. 빈 슬롯은 0으로 채움 (총 9슬롯까지)
5. 나머지를 0으로 패딩하여 128비트 완성
6. 128비트 → 32자리 hex 변환
7. "TFTSet16" 접미사 추가
출력: string (예: "0236b02533601935d35901f013012000TFTSet16")
```

### 4.3 자동 배치 (임포트 시)

디코딩된 챔피언을 보드에 배치할 때:
- 해당 팀 영역의 빈 셀에 좌→우, 상→하 순서로 배치
- player: row 0-3 (데이터 기준), enemy: row 0-3
- 기존 팀이 있으면 **덮어쓰기** (임포트 전 확인 다이얼로그 없이 즉시 적용)

---

## 5. UI 설계

### 5.1 TeamCodePanel 위치
시뮬레이터 헤더 영역 ("전체 초기화" 버튼 옆)에 "팀 코드" 토글 버튼 추가.
클릭 시 드롭다운/패널이 열림.

### 5.2 패널 구성

```
┌─────────────────────────────────────┐
│  [TEAM A 임포트]  [TEAM B 임포트]  │
│  ┌───────────────────────┐         │
│  │ 팀 코드 입력...       │ [로드]  │
│  └───────────────────────┘         │
│                                     │
│  [TEAM A 익스포트]  [TEAM B 익스포트]│
│  ┌───────────────────────┐         │
│  │ (생성된 코드 표시)     │ [복사]  │
│  └───────────────────────┘         │
└─────────────────────────────────────┘
```

### 5.3 UX 흐름

**임포트**:
1. 팀 선택 (TEAM A / TEAM B) 탭 또는 버튼
2. 텍스트 입력에 팀 코드 붙여넣기
3. "로드" 클릭 → 디코딩 → 해당 팀에 챔피언 배치
4. 유효하지 않은 코드 시 에러 메시지 (빨간 텍스트)

**익스포트**:
1. 팀 선택 탭
2. "익스포트" 클릭 → 현재 팀 인코딩 → 코드 표시
3. "복사" 클릭 → 클립보드 복사 + "복사됨!" 피드백

---

## 6. 에러 처리

| 에러 상황 | 대응 |
|-----------|------|
| "TFTSet16" 접미사 없음 | "유효하지 않은 팀 코드입니다" |
| hex 파싱 실패 | "팀 코드 형식이 올바르지 않습니다" |
| team_planner_code 매핑 실패 | 해당 챔피언 건너뛰기 + "일부 챔피언을 찾을 수 없습니다" 경고 |
| 빈 팀 익스포트 시도 | 버튼 비활성화 |

---

## 7. 구현 순서

1. **team_planner_code 매핑 데이터 수집 및 JSON 생성** — CommunityDragon에서 Set 16 챔피언의 team_planner_code 추출
2. **`src/lib/teamCode.ts`** — 인코딩/디코딩 순수 함수 구현
3. **`src/data/loader.ts`** — 매핑 데이터 로드 함수
4. **`src/components/builder/TeamCodePanel.tsx`** — UI 컴포넌트
5. **`src/app/simulator/page.tsx`** — TeamCodePanel 통합 및 팀 state 연동
6. **빌드 검증** — `pnpm lint && pnpm typecheck && pnpm build`

---

## 8. 검증 체크리스트

- [ ] 알려진 팀 코드 `0236b02533601935d35901f013012000TFTSet16` 디코딩 → 9명 챔피언 정확히 매칭
- [ ] 디코딩 후 재인코딩 → 동일한 팀 코드 출력 (라운드트립 검증)
- [ ] TEAM A / TEAM B 독립 임포트/익스포트
- [ ] 성급 정보 유지 (2성, 3성 등)
- [ ] 잘못된 코드 입력 시 적절한 에러 메시지
- [ ] 클립보드 복사 정상 동작
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과
