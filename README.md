# TFT Simulator

롤토체스(TFT) 전투 시뮬레이션 분석 툴.
실제 게임 그래픽이 아닌 **아이콘 기반 2D 분석 스타일 UI**로, 시뮬레이션 정확도에 초점을 둔 프로젝트입니다.

Set 17 (현재) / Set 16 데이터를 지원합니다.

## 주요 기능

- **전적검색** — Riot API + Supabase 기반 소환사 전적 조회 (챔피언/아이템/시너지 비주얼, 시즌 필터링, 매치 상세 8명 전적)
- **전투 시뮬레이션** — 아군 vs 적군 자동 전투, 이동/사거리 시스템, 턴별 이벤트 로그
- **전투 리플레이** — 틱 스냅샷 기반 전투 재생

### 시뮬레이션 지원 시너지 효과

- **중재자 법률** — trigger/effect 선택 → 전투 중 실시간 적용 (7종 trigger, 6종 effect)
- **길잡이 소환** — 3길잡이 활성 시 비아와 바이엔 자동 배치
- **아이오니아 길 선택** — 전투 중 능력치 적용
- 녹서스, 프렐요드, 데마시아, 빌지워터, 필트오버 등 시너지 효과

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | TailwindCSS 4 |
| State | Zustand |
| Simulation | 순수 TypeScript 엔진 (결정론적 설계) |
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
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm build        # 프로덕션 빌드
```

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              # 홈 (기능 선택)
│   ├── simulator/            # 전투 시뮬레이션 페이지
│   ├── lookup/               # 전적검색 페이지
│   └── api/
│       ├── simulate/         # 전투 시뮬레이션 API
│       ├── metadata/         # 메타데이터 API
│       └── lookup/           # 전적검색 API (소환사 조회, 매치 상세)
├── components/
│   ├── battle/               # SetupBoard, ReplayBoard, UnitToken, DamageSidebar
│   ├── builder/              # ChampionGrid, SynergyPanel, ArbiterLawPanel, ItemIcon
│   └── ui/                   # Tooltip, NavHeader, Modal
├── lib/
│   ├── simulator/
│   │   ├── engine/           # combatLoop (전투 엔진)
│   │   ├── systems/          # targeting, attack, ability, mana, trait, item, stat
│   │   └── models/           # constants, hex
│   ├── riot.ts               # Riot API 클라이언트
│   └── supabase.ts           # Supabase 클라이언트
├── hooks/                    # useTeamManagement, useGameData, useReplayControls
├── store/                    # Zustand 슬라이스 (team, battle, replay, ui)
├── data/                     # 데이터 로더, 이미지 매핑, 특수 유닛
└── types/                    # 공용 타입 정의
```

## 게임 데이터

`public/data/`에 CommunityDragon 기반 JSON 데이터가 포함되어 있습니다.

### Set 17 (현재)
- `tft_set17_champions.json` — 챔피언 65명 (스탯, 스킬)
- `tft_set17_items.json` — 아이템
- `tft_set17_traits.json` — 시너지 44개
- `tft_set17_augments.json` — 증강
- `arbiter_laws.json` — 중재자 법률 데이터 (9종 trigger × 9종 effect)

### Set 16 (아카이브)
- `set16/` — Set 16 전체 데이터 (챔피언, 아이템, 시너지, 증강, 이미지)

### 공용
- `common/` — 기본 재료, 조합, 찬란한, 유물 아이템
- `images/` — 챔피언, 시너지, 아이템 아이콘

## 라이선스

이 프로젝트는 [Riot Games](https://www.riotgames.com/)의 공식 프로젝트가 아닙니다.
TFT 관련 게임 데이터 및 이미지의 저작권은 Riot Games에 있습니다.
