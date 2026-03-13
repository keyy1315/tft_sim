# Design: 애니 티버 자동 소환

> Plan 참조: `docs/01-plan/features/annie-tibbers.plan.md`

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────┐
│  simulateCombat()                                        │
│                                                          │
│  1. createCombatUnit() — 양 팀 유닛 생성                  │
│  2. spawnFreljordTurrets() — 프렐요드 포탑 소환           │
│  3. ★ spawnAnnieTibbers() — 애니 티버 자동 소환 (신규)    │
│  4. 전투 루프 시작                                        │
│                                                          │
│  ┌── Data Flow ──────────────────────────────────────┐   │
│  │  tft_set16_champions.json                         │   │
│  │       ↓ loadAllChampions()                        │   │
│  │  TFT16_AnnieTibbers 데이터 조회                    │   │
│  │       ↓                                            │   │
│  │  createCombatUnit() 패턴으로 CombatUnit 생성       │   │
│  │       ↓                                            │   │
│  │  allUnits 배열에 추가                              │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 데이터 설계

### 2.1 티버 원본 데이터 (JSON에서 확인)

```json
{
  "name": "티버",
  "apiName": "TFT16_AnnieTibbers",
  "cost": 11,
  "traits": ["비전 마법사"],
  "stats": {
    "armor": 80,
    "attackSpeed": 0.75,
    "critChance": 0.25,
    "critMultiplier": 1.4,
    "damage": 90,
    "hp": 1500,
    "initialMana": 40,
    "magicResist": 80,
    "mana": 100,
    "range": 1
  },
  "ability": {
    "name": "잉걸불의 분노",
    "desc": "기본 공격 시 체력 회복, 사용 시 공속/보호막 획득..."
  }
}
```

### 2.2 티버 아이콘

**경로**: `public/data/images/tft_set16_champions/tft16_annietibbers_square.tft_set16.png`

`getChampionImage('TFT16_AnnieTibbers')` → 정상 반환 (기존 imageMap 로직으로 자동 매핑)

### 2.3 데이터 접근 방식

티버 데이터를 전투 엔진에서 접근하는 두 가지 옵션:

| 옵션 | 장점 | 단점 |
|------|------|------|
| A) `loadAllChampions()` 비동기 호출 | JSON 데이터 100% 정확 | 엔진이 async가 됨 |
| **B) 하드코딩 fallback** | **엔진 순수 동기 유지** | **데이터 변경 시 수동 업데이트** |

**결정: 옵션 B (하드코딩)**
- 엔진 함수(`simulateCombat`)는 현재 **동기 함수**이며, 이를 유지하는 것이 결정론적 설계에 부합
- 티버 스탯은 세트가 바뀌지 않는 한 고정값
- `spawnFreljordTurrets()`도 동일하게 하드코딩 패턴 사용 중

---

## 3. 핵심 로직 상세 설계

### 3.1 `spawnAnnieTibbers()` 함수

**파일**: `src/lib/simulator/engine/combatLoop.ts`

```ts
function spawnAnnieTibbers(
  team: 'player' | 'enemy',
  teamUnits: CombatUnit[],
  allUnits: CombatUnit[],
): CombatUnit | null
```

#### 3.1.1 소환 조건

```
1. teamUnits에서 champion.apiName === 'TFT16_Annie'인 유닛을 찾는다
2. 없으면 null 반환
3. 있으면 해당 유닛의 starLevel을 기억
```

#### 3.1.2 배치 위치 결정

```
1. 현재 occupiedPositions 집합 생성 (allUnits 중 생존 유닛)
2. 애니 위치 기준 인접 hex 계산 (Axial 좌표 6방향)
3. 우선순위로 빈 칸 탐색:
   a) 애니 인접 hex 중 팀 영역 내 빈 칸 (적 방향 우선)
   b) 팀 영역 내 아무 빈 칸 (center-out, 프렐요드 패턴 재사용)
4. 빈 칸이 전혀 없으면 null 반환 (보드 꽉 참)
```

**팀 영역 범위**:
- player: row 4~7
- enemy: row 0~3

**인접 hex (Axial 좌표)**:
```ts
const ADJACENT_OFFSETS: HexCoord[] = [
  { q: 1, r: 0 }, { q: -1, r: 0 },   // 좌우
  { q: 0, r: -1 }, { q: 1, r: -1 },   // 위쪽 2개
  { q: 0, r: 1 }, { q: -1, r: 1 },    // 아래쪽 2개
];
```

**적 방향 우선 정렬**: player 팀은 r이 작은(위쪽) 인접 hex 우선, enemy 팀은 r이 큰(아래쪽) 인접 hex 우선.

#### 3.1.3 CombatUnit 생성

```ts
const tibberUnit: CombatUnit = {
  id: `${team}-tibbers`,
  champion: {
    name: '티버',
    apiName: 'TFT16_AnnieTibbers',
    cost: 11,
    traits: ['비전 마법사'],
    role: null,
    stats: {
      armor: 80, attackSpeed: 0.75, critChance: 0.25,
      critMultiplier: 1.4, damage: 90, hp: 1500,
      initialMana: 40, magicResist: 80, mana: 100, range: 1,
    },
    ability: { name: '잉걸불의 분노', desc: '', icon: '', variables: [] },
  },
  team,
  position: foundPosition,
  starLevel: annieStarLevel,  // 애니 성급 따라감
  role: 'Fighter',  // APTank → Fighter 매핑
  items: [],
  // 스탯은 STAR_SCALING 적용
  currentHp: baseHp * starScaling,
  maxHp: baseHp * starScaling,
  currentMana: 40,  // initialMana
  maxMana: 100,
  state: 'idle',
  target: null,
  stats: {
    hp: baseHp * starScaling,
    armor: 80, magicResist: 80,
    damage: 90 * starScaling,
    attackSpeed: 0.75,
    critChance: 0.25, critMultiplier: 1.4,
    ap: 0, mana: 40, maxMana: 100, range: 1,
  },
  attackCooldown: 0,
  moveCooldown: 0,
  totalDamageDealt: 0,
  totalDamageTaken: 0,
  statusEffects: [],
  omnivamp: 0,
  shield: 0,
};
```

**성급 스케일링**:
- STAR_SCALING: `{ 1: 1, 2: 1.8, 3: 3.24 }` (기존 상수 사용)
- HP: `1500 * starScaling`
- AD: `90 * starScaling`
- 나머지 스탯(armor, MR, AS 등)은 성급 무관

---

## 4. 호출 위치 설계

### 4.1 `simulateCombat()` 내 호출 순서

```ts
// 기존: 프렐요드 포탑 소환
const playerTurrets = spawnFreljordTurrets(...);
const enemyTurrets = spawnFreljordTurrets(...);
allUnits.push(...playerTurrets, ...enemyTurrets);
playerUnits.push(...playerTurrets);
enemies.push(...enemyTurrets);

// ★ 신규: 애니 티버 소환
const playerTibbers = spawnAnnieTibbers('player', playerUnits, allUnits);
if (playerTibbers) {
  allUnits.push(playerTibbers);
  playerUnits.push(playerTibbers);
}
const enemyTibbers = spawnAnnieTibbers('enemy', enemies, allUnits);
if (enemyTibbers) {
  allUnits.push(enemyTibbers);
  enemies.push(enemyTibbers);
}
```

---

## 5. 수정 파일 목록

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `src/lib/simulator/engine/combatLoop.ts` | 수정 | `spawnAnnieTibbers()` 함수 추가 + `simulateCombat()`에서 호출 |

### 5.1 변경 없는 파일

| 파일 | 이유 |
|------|------|
| `src/data/loader.ts` | `loadAllChampions()` 이미 존재하나 사용하지 않음 (하드코딩 방식) |
| `src/data/imageMap.ts` | `getChampionImage('TFT16_AnnieTibbers')` 이미 정상 작동 |
| `src/components/` | UI 변경 없음 (리플레이에서 자동 표시) |
| `src/types/` | 기존 `CombatUnit` 타입 그대로 사용 |

---

## 6. 에러 처리 설계

| 상황 | 처리 |
|------|------|
| 애니가 팀에 없음 | `null` 반환, 아무 작업 없음 |
| 인접 빈 칸 없음 + 팀 영역 빈 칸도 없음 | `null` 반환 (보드 꽉 참, 소환 불가) |
| 양 팀 모두 애니가 있음 | 각각 독립적으로 티버 소환 |
| 한 팀에 애니가 여러 명 | 첫 번째 애니 기준으로 1마리만 소환 (실제 게임 동일) |

---

## 7. 구현 순서

```
Step 1: spawnAnnieTibbers() 함수 작성
├── 애니 감지 로직
├── 인접 hex 빈 칸 탐색
├── CombatUnit 생성 (하드코딩 스탯 + 성급 스케일링)
└── STAR_SCALING import 추가

Step 2: simulateCombat()에서 호출
├── 프렐요드 포탑 소환 직후에 배치
└── playerTibbers / enemyTibbers → allUnits, teamUnits에 추가

Step 3: 빌드 검증
└── pnpm typecheck && pnpm build
```

---

## 8. 검증 기준

| # | 검증 항목 | 기대 결과 |
|---|----------|----------|
| 1 | 애니(TEAM A)가 있을 때 | 전투 시작 시 티버가 애니 인접 빈 칸에 소환됨 |
| 2 | 애니(TEAM B)가 있을 때 | 동일하게 티버 소환 |
| 3 | 양 팀 모두 애니 | 각각 티버 1마리씩 소환 |
| 4 | 애니가 없을 때 | 티버 소환 없음 |
| 5 | 애니 2성/3성 | 티버도 동일 성급, HP/AD 스케일링 적용 |
| 6 | 보드 꽉 참 | 소환 불가, 에러 없이 정상 진행 |
| 7 | 리플레이 | 티버 아이콘(`tft16_annietibbers_square.tft_set16.png`) 정상 표시 |
| 8 | 빌드 통과 | `pnpm typecheck && pnpm build` 성공 |
