# TFT Set 16 — 전투 시뮬레이터

롤토체스(TFT) Set 16 전투 시뮬레이션 분석 툴.
실제 게임 그래픽이 아닌 **아이콘 기반 2D 분석 스타일 UI**로, 시뮬레이션 정확도에 초점을 둔 프로젝트입니다.

## 주요 기능

- **데미지 계산기** — 챔피언 DPS, 스킬 데미지를 아이템/시너지/증강 포함하여 실시간 계산
- **전투 시뮬레이션** — 아군 vs 적군 자동 전투, 이동/사거리 시스템, 턴별 이벤트 로그
- **전투 리플레이** — 틱 스냅샷 기반 전투 재생

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | TailwindCSS 4 |
| State | Zustand |
| Simulation | 순수 TypeScript 엔진 (결정론적 설계) |
| Data | CommunityDragon / Riot API (JSON 기반) |

## 시작하기

### 요구사항

- Node.js 20+
- pnpm

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버 (localhost:3000)
pnpm dev

# 프로덕션 빌드
pnpm build

# 프로덕션 서버
pnpm start
```

### 코드 검증

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm build       # 프로덕션 빌드
```

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              # 홈 (기능 선택)
│   ├── simulator/            # 전투 시뮬레이션 페이지
│   ├── builder/calculator/   # 데미지 계산기 페이지
│   └── api/                  # simulate, metadata API
├── components/
│   ├── battle/               # BattleBoard, UnitToken, BattleControls
│   ├── builder/              # ChampionGrid, ItemSlot, AugmentSelector
│   ├── analysis/             # DamageTable, EventLog
│   └── ui/                   # 공용 UI 컴포넌트
├── lib/
│   └── simulator/
│       ├── engine/           # combatLoop, replayEngine
│       ├── systems/          # targeting, attack, ability, mana, trait, item
│       ├── models/           # unit, ability, hex
│       └── events/           # eventBus
├── store/                    # Zustand 슬라이스 (team, battle, replay, ui)
├── data/                     # 데이터 로더, 이미지 매핑
└── types/                    # 공용 타입 정의
```

## 게임 데이터

`public/data/`에 Set 16 기준 JSON 데이터가 포함되어 있습니다.

- `tft_set16_champions.json` — 챔피언 스탯, 스킬
- `tft_set16_items.json` — 아이템
- `tft_set16_traits.json` — 시너지
- `tft_set16_augments.json` — 증강
- `tft_set16_teamplanner.json` — 팀 구성

## 라이선스

이 프로젝트는 [Riot Games](https://www.riotgames.com/)의 공식 프로젝트가 아닙니다.
TFT 관련 게임 데이터 및 이미지의 저작권은 Riot Games에 있습니다.
