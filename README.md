# TFT Simulator

롤토체스(TFT) 전투 시뮬레이션 분석 툴.
실제 게임 그래픽이 아닌 **아이콘 기반 2D 분석 스타일 UI**로, 시뮬레이션 정확도에 초점을 둔 프로젝트입니다.

Set 17 (현재) / Set 16 데이터를 지원합니다.

## 주요 기능

- **전적검색** — Riot API + Supabase 기반 소환사 전적 조회. 페이지당 20개(최대 60게임), 시즌 필터링, 매치 상세 8명 전적 확장, 챔피언/아이템/시너지 비주얼 툴팁.
- **가상 대전 분석** — 매치 분석 페이지 진입 시 "한 등수 위 상대"와 자동 시뮬레이션. 승자/양팀 총 피해량/승리팀 생존 유닛 요약 + 패배 시 취약 요인 리포트.
- **전투 시뮬레이션** — 아군 vs 적군 자동 전투, Role 기반 타게팅, 이동/사거리 시스템, 틱별 이벤트 로그, 100회 몬테카를로.
- **전투 리플레이** — 틱 스냅샷 기반 전투 재생 (재생/일시정지/스텝 네비).
- **팀 코드 Import/Export** — TFT 공식 Team Planner 호환 128-bit 포맷. 역할군 기반 자동 전/후방 배치 (Tank/Fighter/Assassin 전방).

### 시뮬레이션 지원 시너지 효과

- **Set 17 Unique Trait 일부** — 보루(쉔 유물 소환 + 인접 보호막/공속), 말살자(진 적 방어력/마저 감소), 어둠의 여인(모르가나 아군 피해 감소)
- **자동 소환 유닛** — 비아/바이엔(길잡이 3+), 쉔 유물, 티버(애니), 얼어붙은 포탑(프렐요드), 모래 병사(황제)
- **중재자 법률** — trigger/effect 선택 → 전투 중 실시간 적용
- **아이오니아 길 선택** — 전투 중 능력치 적용
- Set 16 시너지 (녹서스, 프렐요드, 데마시아, 빌지워터, 필트오버, 선봉대, 요새 등)

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router, Turbopack, React Compiler 활성) |
| Language | TypeScript (strict) |
| UI | React 19, TailwindCSS 4 |
| State | Zustand |
| DnD | @dnd-kit |
| Simulation | 순수 TypeScript 엔진 (결정론적 설계, seed 기반 RNG) |
| Data | CommunityDragon / Riot API (JSON 기반) |
| Database | Supabase (전적검색 데이터 저장) |

## 시작하기

### 요구사항

- Node.js 20+
- pnpm
- Riot API Key
- Supabase 프로젝트 (전적검색용)

### 환경 변수

`.env.example`을 `.env`로 복사하고 값을 채워주세요:

```
RIOT_API_KEY=your-riot-api-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### Supabase 테이블 생성

```sql
create table summoners (
  puuid text primary key,
  game_name text not null,
  tag_line text not null,
  last_fetched_at timestamptz default now()
);

create table matches (
  id bigint generated always as identity primary key,
  match_id text not null,
  puuid text not null references summoners(puuid),
  placement int not null,
  champions jsonb not null default '[]',
  game_datetime timestamptz not null,
  game_length real,
  queue_id int,
  set_id text default 'set17',
  traits jsonb default '[]',
  created_at timestamptz default now(),
  unique(match_id, puuid)
);

create index idx_matches_puuid on matches(puuid);
create index idx_matches_game_datetime on matches(puuid, game_datetime desc);
```

### 설치 및 실행

```bash
pnpm install
pnpm dev          # localhost:3000
pnpm build        # 프로덕션 빌드
pnpm start        # 프로덕션 서버
```

### 코드 검증

```bash
pnpm lint         # ESLint (React Compiler 규칙 포함)
pnpm typecheck    # tsc --noEmit
pnpm build        # 프로덕션 빌드
```

커밋 전 3종 모두 통과해야 합니다.

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # 홈 (기능 선택)
│   ├── layout.tsx                  # 루트 레이아웃
│   ├── simulator/                  # 전투 시뮬레이션 페이지
│   ├── lookup/                     # 전적검색 페이지
│   │   └── [matchId]/analysis/     # 매치 상세 + 가상 대전 분석
│   └── api/
│       ├── simulate/               # 전투 시뮬레이션 API
│       ├── metadata/               # 메타데이터 API
│       └── lookup/                 # 전적검색 API
│           └── match/              # 매치 상세 8명 데이터
├── components/
│   ├── analysis/                   # MatchResultSummary, DefeatReport, OpponentSelector
│   ├── battle/                     # SetupBoard, ReplayBoard, HexBoard, UnitToken, DamageSidebar
│   ├── builder/                    # ChampionCard, SynergyPanel, TeamCodePanel, AugmentSelector
│   └── ui/                         # Tooltip, NavHeader, Modal, SearchBar
├── lib/
│   ├── simulator/
│   │   ├── engine/                 # combatLoop, replayEngine, rng
│   │   ├── systems/                # targeting, attack, ability, mana, trait, item(+items/), stat, augment, movement
│   │   └── models/                 # constants, hex, unit, ability
│   ├── analysis/                   # matchAdapter, defeatReport, coverageChecker, itemAnalyzer
│   ├── utils/                      # 공용 유틸
│   ├── riot.ts                     # Riot API 클라이언트
│   ├── supabase.ts                 # Supabase 클라이언트
│   └── teamCode.ts                 # 팀 코드 encode/decode + 역할군 자동 배치
├── hooks/                          # useTeamManagement, useGameData, useReplayControls,
│                                   #  useCombatAnalysis, useMatchAnalysis, useDndHandlers
├── store/                          # Zustand 슬라이스 (team, battle, replay, ui)
├── data/                           # 데이터 로더, 이미지 매핑, 특수 유닛, 증강 칸 버프
└── types/                          # 공용 타입 정의
```

## 게임 데이터

`public/data/`에 CommunityDragon 기반 JSON 데이터가 포함되어 있습니다.

### Set 17 (현재)
- `tft_set17_champions.json` — 챔피언 데이터 (스탯, 스킬)
- `tft_set17_items.json` — 아이템
- `tft_set17_traits.json` — 시너지 44개
- `tft_set17_augments.json` — 증강
- `tft_set17_scaling.json` — 챔피언 스케일링 보정값
- `tft_set17_teamplanner.json` — 팀 코드 매핑 (`teamPlannerCode` 63개, CommunityDragon `tftchampions-teamplanner.json` 기반)
- `arbiter_laws.json` — 중재자 법률 데이터

### Set 16 (아카이브)
- `set16/` — Set 16 전체 데이터 (챔피언, 아이템, 시너지, 증강, 이미지)

### 공용
- `common/` — 기본 재료, 조합, 찬란한, 유물 아이템
- `images/` — 챔피언, 시너지, 아이템 아이콘

## 핵심 설계 원칙

- **결정론적 시뮬레이션** — 동일 입력에 동일 결과. 엔진 내 `Math.random()` 직접 사용 금지, seed 기반 `rng.ts` 사용.
- **UI-엔진 분리** — `src/lib/simulator/` 는 React 의존 없는 순수 TS. `simulateCombat()` 이 재현 가능한 `CombatResult` 반환.
- **Role 기반 타게팅** — 가장 가까운 적 우선, 동거리 타이브레이커는 Role weight (Tank=3 > Fighter/Marksman/Caster/Specialist=2 > Assassin=1).
- **React Compiler 준수** — `useEffect` 내 `setState` 금지, 의존성 배열 누락 금지. `eslint-disable` 로 우회하지 않고 코드 수정으로 해결.
- **좌표계 규약** — `useTeamManagement.playerTeam` 은 row 0-3, `combatLoop` 입력은 row 4-7 (전투 시 `toEightRowCoords(+4)` 매핑). 경계 레이어에서만 변환.

## 배포 (Docker + GitHub Actions)

`main` 푸시 시 GitHub Actions가 `lint·typecheck·test` → 이미지 빌드(ghcr) →
Lightsail SSH 배포를 자동 수행한다.

- 설계: `docs/superpowers/specs/2026-06-17-docker-github-actions-deploy-design.md`
- 셋업/Secrets: `docs/deploy/lightsail-setup.md`

로컬 컨테이너 실행:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="..." \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="..." \
  -t tft_sim:local .
docker run --rm -p 3000:3000 -e RIOT_API_KEY="..." tft_sim:local
```

## 라이선스

이 프로젝트는 [Riot Games](https://www.riotgames.com/)의 공식 프로젝트가 아닙니다.
TFT 관련 게임 데이터 및 이미지의 저작권은 Riot Games에 있습니다.
