# actual-data 기능 브레인스토밍 진행 상황

> 2026-04-22 진행 중 (WIP). 내일 이어서 설계안 섹션 나머지 진행 예정.
> 사용자: "여기까지 메모리에 저장, 내일 할게"

## 목적

실제 TFT 경기 영상을 보면서 라운드별 ground truth(양팀 배치/아이템/증강/신/승자/데미지)를
수기 입력·저장하는 내부 툴. 시뮬레이터 전투 검증(타겟팅/데미지/이동 정확도)의 기준 데이터.

- 영상 자체는 유튜브 등 외부에서 조달
- 플레이어가 영상 보면서 라운드별로 입력
- 저장된 JSON을 시뮬레이터에 투입하여 실제와 diff

## 확정된 결정 사항 (Q1~Q7)

| # | 결정 | 선택 |
|---|------|------|
| Q1 | 파일 단위 | **게임 1판 = JSON 파일 1개** (옵션 A) |
| Q2 | 상대 기록 범위 | **내 매치 상대 1명만** (옵션 A, 나중에 8명 확장 가능한 구조로) |
| Q3 | 라운드 이동 UX | **좌측 라운드 리스트 + "+ 추가" 시 이전 라운드 내 팀만 복사** (옵션 A + 하위 2) |
| Q4 | 저장 방식 | **Next.js API 라우트** → `./actual-data/<gameId>.json` (git 포함) |
| Q5 | 라운드 타입 | **PvP 라운드만 기록** (PvE/캐러셀 스킵). 증강은 라운드별 내/상대 각자 선택 (현 시뮬 UX와 동일) |
| Q6 | 라운드별 메타 필드 | **필수(roundName, videoStartTime, winner) + unitDamageChart + notes**. unitDamageChart는 수동 입력, 나중에 OCR 자동 채우기 확장 예정 |
| Q7 | 게임 레벨 메타데이터 | **옵션 B** — gameId(자동) + videoUrl + patchVersion + playerRiotId + finalPlacement + 라운드별 opponentRiotId. 라이엇ID는 `name#tag` 형식 |

## 페이지 레이아웃 (승인됨)

```
/actual-data              → 게임 리스트
/actual-data/[gameId]     → 게임 편집 페이지
```

편집 페이지:
```
┌─────────────────────────────────────────────────────────────┐
│ [← 뒤로] Game: game-20260422-001  [게임 메타 편집] [완료]    │
├──────────┬──────────────────────────────────────────────────┤
│ 라운드    │  [라운드명: 2-3 ▼]  [영상시각: 04:23]             │
│ 리스트    │                                                  │
│ 2-2 ✓    │  ┌─ 내 팀 ────┐  ┌─ 상대 팀 ────┐                 │
│ 2-3 ●    │  │ (SetupBoard) │  │ (SetupBoard) │                │
│ 2-4      │  │ 증강 x3      │  │ 증강 x3      │                │
│ + 추가   │  │ 신(TBD)      │  │ 신(TBD)      │                │
│          │  └─────────────┘  └──────────────┘                │
│          │  승리자, 상대 라이엇ID, 데미지표, 메모              │
│          │                    [💾 이 라운드 저장]              │
└──────────┴──────────────────────────────────────────────────┘
```

## 진행 중 — 신(Shrine) 처리 (Q8, 미해결)

### 제안한 구조 (사용자 승인 전)
- 라운드별 내/상대 팀에 `activeShrines: string[]` 추가
- 증강과 **평행 구조**로 관리 (UI도 별도 섹션, 데이터도 별도 JSON)
- 전투 영향 없는 신(경제/XP)도 기록은 하되 시뮬에서 무시 가능하도록 `combatImpact: boolean` 플래그
- 라운드 추가 시 `activeShrines`도 복사 (기본 영구 선택)

### 사용자에게 물어본 미해결 질문
1. Set 17 신은 게임당 최대 몇 개 선택?
2. 선택 시점이 고정 라운드인지, 자율 선택인지?
3. 신 별 효과 데이터는 어디서 가져올지 (CommunityDragon? 수동?)

### 참고 자료 — `docs/meta/set17-gods-system.md`에 이미 답 대부분 있음
- **2-4, 3-4, 4-4**: 3번 선택 (한 판에 신 2명 중 택1, 3라운드 내내 같은 2명)
- **4-7**: 가장 많이 고른 신의 **은총 증강** 자동 획득
- 총 최대 **4개** 효과 (신 보상 3개 + 은총 증강 1개) — 대부분 경제 보상, 은총만 전투 영향
- 실제로 시뮬 영향은 **은총 증강만** → 증강으로 간주해도 될 수 있음

→ **내일 재개 시 고려:** 신 전용 필드 따로 두지 말고 "은총 증강"을 일반 증강 풀에 편입하고 경제 보상 신은 기록 안 하는 방식으로 단순화 가능성. 사용자 의견 확인 필요.

## 남은 설계 섹션 (내일 진행)

1. **신(Shrine) 처리 결정** — Q8 재개
2. **JSON 스키마 전문** — TypeScript 타입 + 예시
3. **API 명세** — `POST /api/actual-data/[gameId]` 요청/응답
4. **새 Zustand 슬라이스** — `actualDataSlice` (게임/라운드 상태 관리)
5. **컴포넌트 분해** — `ActualDataEditor`, `RoundList`, `RoundEditor`, `DamageChartInput` 등
6. **에러 핸들링** — 파일 경합, 저장 실패, 데이터 검증
7. **Phase 분리** — MVP vs 확장(OCR 자동 채우기) 경계

## 설계 문서 최종 저장 위치 (내일 결정 시)

- **Spec 초안**: `docs/superpowers/specs/YYYY-MM-DD-actual-data-design.md` (superpowers 스킬 규칙)
- **또는**: `docs/02-design/actual-data.md` (bkit PDCA 컨벤션)
- 사용자 선호 확인 필요 (둘 다 레포 포함이라 git 공유 가능)

## 프로젝트 컨텍스트 요약 (내일 빠르게 재로드용)

- 기존 편집 UI: `src/app/simulator/page.tsx` (16K)
- 재사용 핵심: `src/components/battle/SetupBoard.tsx` (양팀 편집 가능 헥스 보드)
- Zustand: `teamSlice.ts` (현재 단일 팀 구조 → actualData는 새 슬라이스 필요)
- 타입: `src/types/index.ts` — `RawChampion`, `RawItem`, `RawAugment`, `PlacedChampion`, `HexCoord`
- API: `src/app/api/` 기존 존재 → 새 라우트 추가 가능

## 재개 방법

내일 대화에서:
> "`docs/meta/actual-data-brainstorm.md` 이어서 진행"
> 또는
> "/superpowers:brainstorming actual-data Q8 신 처리부터"
