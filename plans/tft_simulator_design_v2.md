# TFT Combat Simulator
## UI/UX + System Design Document v2.1

> v2.0 기반으로 기술 스택 버전 확정, 데미지 계산·성급 스케일링·Seed RNG·데이터 파이프라인·StatusEffect·증강 시스템 섹션을 추가하고,
> 코드↔설계 불일치 항목에 마이그레이션 가이드를 명시한 보완본.

---

## 1. Overview

본 프로젝트는 롤토체스(TFT) 전투 시뮬레이션 분석 툴을 목표로 한다.
실제 게임 그래픽이 아닌 **아이콘 기반 2D 분석 스타일 UI**로 구현한다.

**목표:**
- 전투 결과 분석
- 아이템 / 증강 / 시너지 영향 분석
- 팀 조합 비교
- 전투 로그 기반 분석
- 전략 테스트 환경 제공

**핵심 철학: 시뮬레이션 정확도 > 그래픽**

---

## 2. Product Goals

### Primary Goals
- 전투 시뮬레이션
- 조합 비교
- 아이템/증강 영향 분석
- 전투 로그 시각화

### Secondary Goals
- 전략 테스트
- DPS 분석
- 메타 연구

---

## 3. Tech Stack

### Frontend
- **Next.js 16.1.6** (App Router, Turbopack)
- **React 19.2.4**
- **TypeScript 5.9.3**
- **TailwindCSS 4.2.1**
- **Zustand 5.0.11**

### 추가 의존성
- **@dnd-kit/core 6.3.1** — 드래그앤드롭 (유닛 배치, 아이템 장착)
- **recharts 3.8.0** — 차트 시각화 (DPS, HP Timeline 등)
- **babel-plugin-react-compiler 1.0.0** — React Compiler 지원

### Rendering
- React absolute layout (기본)
- Canvas (애니메이션 효과 필요 시)

### Simulation Engine
- TypeScript
- Pure logic engine (결정론적 설계 필수 — Replay 재연산 보장)

### Data Source
- CommunityDragon (비공식, fallback 필수)
- Riot API (공식, 패치 버전 관리)

---

## 4. High Level Architecture

```
UI Layer
  ├ Team Builder
  ├ Battle Viewer
  └ Result Analyzer

API Layer
  ├ Scenario API
  ├ Simulation API
  └ Metadata API

Simulation Engine
  ├ Combat Loop
  ├ Attack System
  ├ Ability System
  ├ Stat System         (v2.1 추가: 성급 스케일링, 아이템/증강 스탯 적용)
  ├ Trait System
  ├ Item System
  ├ Augment System
  ├ Movement System     (v2.1 추가: Hex 이동, Assassin 점프)
  └ Mana System         (v2.1 추가: Role별 마나 획득)

Data Layer
  ├ champions.json  (버전 명시 필수)
  ├ items.json
  ├ augments.json
  └ traits.json
```

---

## 5. Core Concepts

### Unit Types
- Champion
- Summon
- Training Dummy
- Turret

### Unit Model (v2 — 보완)

```ts
type UnitRole =
  | 'Tank'
  | 'Fighter'
  | 'Marksman'
  | 'Caster'
  | 'Assassin'
  | 'Specialist'

type AbilityTargetingType =
  | 'current_target'  // 기본: 현재 공격 대상
  | 'farthest'        // 가장 먼 적 (ex. Caitlyn)
  | 'nearest'         // 가장 가까운 적 (ex. Morgana)
  | 'lowest_hp'       // 체력 가장 낮은 적 (ex. Kha'Zix)
  | 'lowest_hp_ally'  // 체력 가장 낮은 아군 (힐러)
  | 'random'
  | 'self'
  | 'aoe_center'

type DamageType = 'physical' | 'magic' | 'true'

type Unit = {
  // 식별
  id: string
  name: string
  star_level: 1 | 2 | 3
  team: 'player' | 'enemy'
  role: UnitRole

  // 위치
  position: HexCoord

  // 체력
  max_hp: number
  current_hp: number

  // 마나 (Patch 15.1 Roles Revamped 기준)
  max_mana: number
  current_mana: number
  mana_per_attack: number    // Tank=5, Fighter/Marksman/Assassin/Caster=10 (Caster는 7)
  mana_per_second: number    // Caster=2, 나머지=0
  mana_from_damage: boolean  // Tank=true

  // 전투 스탯
  attack_damage: number
  attack_speed: number
  range: number              // hex 단위
  armor: number
  magic_resist: number
  crit_chance: number
  crit_damage: number
  omnivamp: number           // Fighter=8~20%, 나머지=0

  // 타게팅
  targeting_weight: 1 | 2 | 3  // Tank=3, 일반=2, Assassin=1 (자동 파생)
  target: string | null         // 현재 타겟 unit id

  // 스킬 / 아이템 / 특성
  ability: Ability
  items: Item[]
  traits: string[]

  // 상태
  status_effects: StatusEffect[]
  is_alive: boolean
}
```

> **⚠️ 코드 마이그레이션 필요 (Unit Model)**
>
> | 항목 | 현재 코드 | 설계 기준 (정본) |
> |------|----------|----------------|
> | 타입명 | `CombatUnit` | `Unit` |
> | 좌표 타입 | `HexPos { row, col }` | `HexCoord { q, r }` |
> | 팀 구분 | `'ally' \| 'enemy'` | `'player' \| 'enemy'` |
>
> 코드를 설계 기준에 맞춰 리네이밍할 것.

---

## 5-A. Star Level 스케일링 (v2.1 신설)

성급(Star Level)에 따른 스탯 배율. 챔피언 데이터의 **기본 스탯(1성)** 을 기준으로 적용한다.

```
Star Level별 스탯 배율:
  ★☆☆ (1성): ×1.0
  ★★☆ (2성): ×1.8
  ★★★ (3성): ×3.24

적용 대상: HP, Attack Damage
비적용 대상: Armor, Magic Resist, Attack Speed, Range, Mana
```

구현 위치: `src/lib/simulator/systems/stat.ts`

```ts
const STAR_MULTIPLIER: Record<1 | 2 | 3, number> = {
  1: 1.0,
  2: 1.8,
  3: 3.24,
}

function applyStarLevel(base: number, star: 1 | 2 | 3): number {
  return Math.round(base * STAR_MULTIPLIER[star])
}
```

---

## 5-B. StatusEffect 타입 정의 (v2.1 신설)

유닛에 적용되는 상태 효과의 공통 타입.

```ts
type StatusEffectType = 'stun' | 'slow' | 'burn' | 'shield' | 'invulnerable' | 'disarm' | 'taunt'

type StatusEffect = {
  type: StatusEffectType
  source_id: string        // 효과를 건 유닛 id
  remaining_ticks: number  // 남은 지속 틱
  value?: number           // 슬로우 %, 실드 량 등
}
```

### 스턴(stun) 시 영향
- 자동공격 불가
- 스킬 시전 불가
- Caster 마나 획득 중단 (mana_per_second, mana_per_attack 모두)
- 이동 불가

### 도발(taunt) 시 영향
- 강제 타겟 전환 → `source_id` 유닛만 공격
- 다른 타겟 선택 불가 (Section 7-A 타게팅 오버라이드 참고)

### 기타 효과
- **slow**: `value`% 만큼 attack_speed 감소
- **burn**: 매 틱 `value` 만큼 트루 데미지
- **shield**: `value` 만큼 피해 흡수 (0이 되면 `on_shield_break` 이벤트)
- **disarm**: 자동공격 불가, 스킬은 가능
- **invulnerable**: 모든 피해 무시

---

## 6. Board

### Hex Grid 구조

- 크기: **7 x 4** (플레이어 진영 기준, 전투 시뮬 전용)
  - 실제 TFT 전체 보드는 7 x 8 (양 플레이어 합산)이나 전투 시뮬은 4줄로 충분
- 좌표계: **Axial Coordinates (q, r)** 방식 사용 권장
  - Offset 방식 대비 거리 계산, 사거리 판정, 이동 경로 처리에 유리

```ts
type HexCoord = { q: number; r: number }

// 두 hex 사이 거리
function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

type HexCell = {
  coord: HexCoord
  occupant: string | null  // unit id
}
```

> **⚠️ 코드 마이그레이션 필요 (Board 좌표계)**
>
> | 항목 | 현재 코드 | 설계 기준 (정본) |
> |------|----------|----------------|
> | 좌표 방식 | Offset `{ row, col }` | Axial `{ q, r }` |
>
> Offset → Axial 변환 공식:
> ```
> q = col - Math.floor(row / 2)
> r = row
> ```
> `hexDistance()` 및 타게팅 로직이 Axial 좌표 기준으로 설계되어 있으므로, 좌표계 통일이 필수.

---

## 7. Combat Loop

전투는 **tick 기반 시뮬레이션**으로 동작한다.

- 권장: **30 ticks / second**
- 시뮬레이션은 **결정론적(Deterministic)** 으로 설계 (동일 입력 → 동일 결과, Replay 보장)

```
start_combat()

while battle_active:
  update_mana()          // 마나 재생 (Role별 mana_per_second 적용)
  find_target()          // 타게팅 로직 (Section 7-A 참고)
  move_toward_target()   // 사거리 밖이면 이동
  attack()               // 공격 및 mana_per_attack 적용
  cast_ability()         // 마나 가득 차면 스킬 발동
  apply_items()
  apply_traits()
  resolve_damage()       // armor / magic_resist 계산
  process_death()
  record_snapshot()      // Replay용 틱 스냅샷 저장
```

---

## 7-B. 데미지 계산 공식 (v2.1 신설)

전투에서 데미지가 적용될 때의 감소 공식.

### 물리 / 마법 데미지 감소

```
effective_damage = raw_damage × (100 / (100 + defense))
```

- 물리 데미지: `defense = armor`
- 마법 데미지: `defense = magic_resist`

예시: raw_damage=200, armor=50 → 200 × (100/150) = **133.3**

### 트루 데미지

```
effective_damage = raw_damage  (감소 없이 그대로 적용)
```

### 크리티컬 히트

```
crit_damage = attack_damage × crit_damage_multiplier
```

- 기본 `crit_damage_multiplier`: **1.4** (TFT 기본값)
- 크리티컬 판정: `seededRNG.next() < crit_chance` (Section 7-C 참고)

### 쉴드 처리

```
if target.shield > 0:
  absorbed = min(shield, effective_damage)
  shield -= absorbed
  effective_damage -= absorbed
  if shield == 0: emit('on_shield_break')
```

### Omnivamp (Fighter 패시브)

```
heal_amount = effective_damage × omnivamp_rate
current_hp = min(max_hp, current_hp + heal_amount)
```

구현 위치: `src/lib/simulator/systems/attack.ts` → `resolveDamage()`

---

## 7-C. Seed 기반 난수 생성기 (v2.1 신설)

CLAUDE.md 규칙에 따라 `Math.random()` 직접 사용을 금지하고, Replay 결정론을 보장하기 위해 seed 기반 RNG를 사용한다.

### 인터페이스

```ts
type SeededRNG = {
  seed: number
  next(): number  // 0~1 범위 반환
}
```

### 구현: Mulberry32

```ts
function createRNG(seed: number): SeededRNG {
  let s = seed | 0
  return {
    seed,
    next() {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}
```

### 사용처

| 용도 | 예시 |
|------|------|
| 크리티컬 판정 | `rng.next() < unit.crit_chance` |
| 동일 가중치 타이브레이커 | 같은 weight의 타겟이 여러 명일 때 |
| random 타겟팅 | `AbilityTargetingType = 'random'` |

### 주의사항
- 전투 시작 시 `combatLoop`에 seed를 주입하고, **모든 랜덤 판정**은 이 RNG를 통해서만 수행
- 같은 seed → 같은 전투 결과 (Replay 검증 기준)

구현 위치: `src/lib/simulator/engine/rng.ts`

---

## 7-A. Targeting System (Patch 15.1 Roles Revamped 기준)

### 타게팅 2단계 원칙

**1단계 — 거리 우선 (Primary)**
- 기본: 가장 가까운 적 유닛을 타겟
- 사거리 내 적 없음 → 이동 후 공격
- 이동 불가(경로 막힘) → 차선 타겟 재선택

**2단계 — Role 기반 타이브레이커 (Tiebreaker)**
- 동거리 유닛이 여러 명일 때 아래 우선순위로 결정
- 이전(Patch 15.1 이전)에는 50/50 랜덤이었으나 공식 패치로 변경됨

```
타겟 우선순위 (높음 → 낮음):
  Tank (weight=3)
    > Fighter / Marksman / Caster / Specialist (weight=2)
      > Assassin (weight=1)
```

### Role별 타게팅 특성 및 마나 획득

| Role       | 타게팅 가중치 | 마나 획득 방식                        | 특수 패시브              | 기본 위치 |
|------------|------------|-------------------------------------|------------------------|---------|
| Tank       | 3 (높음)    | 피격 시 마나 획득 + 5/공격             | -                      | 프론트라인 |
| Fighter    | 2 (보통)    | 10 마나/공격                          | Omnivamp 8~20% (Stage별) | 프론트라인 |
| Marksman   | 2 (보통)    | 10 마나/공격                          | -                      | 백라인   |
| Caster     | 2 (보통)    | **7 마나/공격** + **2 마나/초** 패시브  | 공격속도보다 마나 아이템 우선 | 백라인   |
| Assassin   | 1 (낮음)    | 10 마나/공격                          | 전투 시작 시 백라인 점프  | 점프형   |
| Specialist | 2 (보통)    | 고유 방식 (챔피언별 정의)               | 고유 메커니즘            | 유동    |

> **Caster 주의:** 공격속도가 높아도 마나 효율이 낮음 (7/attack). CC에 의한 스턴 시 마나 획득 완전 중단.

### 어빌리티 타게팅 패턴

스킬은 자동공격 타겟과 **독립적으로** 동작할 수 있다.

```ts
type Ability = {
  type: 'active' | 'passive'
  targeting: AbilityTargetingType
  damage_type: DamageType
  effects: Effect[]
}
```

주요 패턴 예시:

| 패턴             | 설명                            | 게임 내 예시          |
|-----------------|-------------------------------|---------------------|
| current_target  | 현재 공격 중인 대상 (기본값)       | 대부분의 챔피언        |
| farthest        | 가장 먼 적                      | Caitlyn, MADDIE     |
| nearest         | 가장 가까운 적                   | Morgana, Swain      |
| lowest_hp       | 체력이 가장 낮은 적               | Kha'Zix             |
| lowest_hp_ally  | 체력이 가장 낮은 아군             | 힐러 계열             |
| aoe_center      | 지점 기반 AoE (폭발, 장판)        | AoE 누커             |

### Assassin 특수 동작

```
전투 시작 → 스텔스 진입 (짧은 지속)
→ 적 백라인으로 점프 (기본 타겟: 가장 먼 적)
→ 착지 후 일반 타게팅 로직으로 전환
→ 백라인 공간 없을 시: 가능한 가장 가까운 위치로 착지
```

### 타게팅 오버라이드 조건

| 조건                  | 동작                              |
|--------------------|----------------------------------|
| 도발(Taunt) 효과 발동  | 강제 어그로 전환 — 다른 타겟 무시     |
| 경로 막힘             | 현재 타겟 포기 → 차선 타겟 재선택     |
| 타겟 사망             | 즉시 재타겟팅                      |
| 스킬 지정 타겟         | AbilityTargetingType 우선 적용    |

### 구현 우선순위 (MVP → 고도화)

```
Phase 1 (MVP):
  ✅ current_target — 거리 기반 + Role 타이브레이커
  ✅ Assassin 점프 로직

Phase 2:
  ✅ farthest / nearest 어빌리티 타게팅
  ✅ 도발(Taunt) 오버라이드

Phase 3:
  ✅ lowest_hp, aoe_center
  ✅ 경로 탐색 (A* or BFS)
```

---

## 8. Ability System

> 시뮬레이터 정확도의 핵심. MVP에서는 단순 타입부터 점진적으로 확장한다.

```ts
type Effect = {
  type: 'damage' | 'heal' | 'shield' | 'stun' | 'slow' | 'burn' | 'knockup'
  value: number
  duration_ticks?: number   // 지속형 효과
  damage_type?: DamageType
}

type Ability = {
  name: string
  type: 'active' | 'passive'
  targeting: AbilityTargetingType
  damage_type: DamageType
  effects: Effect[]
  cast_time_ticks: number
}
```

### MVP 구현 범위

```
Phase 1: single-target 누킹 (damage only)
Phase 2: AoE damage
Phase 3: 버프/디버프 효과 (heal, shield, stun, slow)
Phase 4: 복합 스킬 (조건부 발동, 연쇄 등)
```

---

## 8-A. 증강(Augment) 시스템 (v2.1 신설)

증강은 전투에 추가적인 효과를 부여하는 시스템이다.

### 증강 효과 타입

```ts
type AugmentEffectType = 'stat_modifier' | 'trait_bonus' | 'on_event' | 'unique'

type AugmentEffect = {
  type: AugmentEffectType
  target?: 'all' | 'role' | 'trait' | 'specific_champion'
  target_filter?: string            // role명 또는 trait명
  stat?: keyof Unit                 // stat_modifier일 때
  value?: number
  is_percentage?: boolean           // true이면 %, false이면 flat
  event_hook?: string               // on_event일 때 — 'on_kill', 'on_hit' 등
}

type Augment = {
  id: string
  name: string
  tier: 'silver' | 'gold' | 'prismatic'
  effects: AugmentEffect[]
}
```

### 적용 시점

| 시점 | 효과 타입 | 예시 |
|------|----------|------|
| 전투 시작 전 | `stat_modifier`, `trait_bonus` | AD+10, 시너지 카운트+1 |
| 전투 중 | `on_event` | on_kill 시 체력 회복, on_hit 시 마나 추가 |
| 전투 종료 후 | 보상/정산 효과 | (MVP 범위 외) |

### MVP 범위

**`stat_modifier`만 구현.** `trait_bonus`, `on_event`, `unique`는 Phase 2 이후.

### 구현 위치

- 타입: `src/types/augment.ts`
- 적용 로직: `src/lib/simulator/systems/augment.ts`
- 데이터: `src/data/augments.json`

---

## 9. Event System

```
지원 이벤트:
  on_combat_start
  on_combat_end    (v2.1 추가)
  on_attack
  on_hit
  on_cast
  on_kill
  on_death
  on_damage
  on_heal         (v2 추가)
  on_shield_break (v2 추가)
```

아이템 / 시너지 / 증강은 이 이벤트에 **hook** 방식으로 등록된다.
각 hook은 우선순위 값을 가지며, 동일 이벤트에서 순서 보장.

---

## 10. Replay System

### 방식 결정: **틱별 전체 스냅샷 저장 (MVP 권장)**

| 방식 | 메모리 | 구현 난이도 | 재생 안정성 |
|------|--------|------------|------------|
| A. 틱별 스냅샷 | 높음 | 쉬움 | 높음 |
| B. 이벤트 재연산 | 낮음 | 어려움 | 결정론적 엔진 필수 |

MVP는 **A 방식** 채택. 이후 최적화 시 B로 전환 가능.

```ts
type TickSnapshot = {
  tick: number
  units: Record<string, Pick<Unit,
    'id' | 'current_hp' | 'current_mana' | 'position' | 'is_alive' | 'status_effects'
  >>
  events: CombatEvent[]  // 해당 틱에서 발생한 이벤트 로그
}

// 용량 예상: 30tick/s × 60s = 1,800 프레임
// 유닛 10개 기준 약 1~2MB — 허용 범위 내
```

### 재생 컨트롤
- Play / Pause
- Speed x1 / x2 / x4
- Step (틱 단위 이동)
- Seek (슬라이더로 특정 틱 이동)

---

## 11. UI Design Philosophy

분석 중심 UI

- 읽기 쉬운 전투 시각화
- 빠른 분석 접근
- 명확한 데이터 표시
- **그래픽보다 정보 전달 우선**

---

## 12. Layout Structure

```
Header (버전, 컨트롤)

┌──────────────┬──────────────────────┬──────────────────┐
│ Team Builder │    Battle Viewer     │ Analysis Panel   │
│  (좌 패널)   │    (중앙 메인)       │    (우 패널)      │
└──────────────┴──────────────────────┴──────────────────┘
```

---

## 13. Team Builder Panel

**기능:**
- Champion 선택
- 아이템 장착
- 증강 선택
- 유닛 배치 (Hex Grid)
- 시너지 표시

**UI 요소:**
- Champion Grid
- Item Slot (3슬롯/유닛)
- Augment Selector
- Board Editor
- Synergy Tracker

---

## 14. Battle Viewer

### Unit Token UI

```
[ Champion Icon ]
[ HP Bar        ]
[ Mana Bar      ]
[ Item Icons    ]
[ Status Icons  ]
```

### Battle Controls

- Play / Pause
- Speed x1 / x2 / x4
- Step Tick (←→)
- Seek Slider

### Visual Effects

- Damage Numbers (물리/마법/트루 색상 구분)
- Attack Lines
- Ability Area (AoE 범위 표시)
- Status Icons (스턴, 슬로우 등)

---

## 15. Analysis Panel

### 실시간 표시

```
Current Tick      : 42
Remaining Units   : Player 5 vs Enemy 4
Combat Time       : 1.4s
```

### Damage Table

| Champion | Total DMG | DPS | DMG Taken | Healing |
|----------|-----------|-----|-----------|---------|

### Event Log

```
[Tick 12] Ahri cast ability → Garen (320 magic dmg)
[Tick 18] Yone dealt 800 physical dmg to Lux
[Tick 21] Garen killed Lux
```

---

## 16. Result Screen

- Winner Team
- Combat Duration
- Survivors

### Charts
- Damage per Champion (Bar)
- Healing per Champion (Bar)
- Damage Taken per Champion (Bar)
- HP Timeline (Line, 틱별 추이)

---

## 17. Component Structure

```
BattlePage
├── TeamBuilder
│   ├── ChampionGrid
│   ├── ItemSlot
│   ├── AugmentSelector
│   └── SynergyTracker
├── BattleBoard
│   ├── HexCell
│   └── UnitToken
│       ├── Portrait
│       ├── HpBar
│       ├── ManaBar
│       ├── ItemRow
│       └── StatusRow
├── BattleControls
│   ├── PlayPauseButton
│   ├── SpeedSelector
│   └── SeekSlider
├── AnalysisPanel
│   ├── DamageTable
│   ├── EventLog
│   └── ResultChart
└── ui/                   (v2.1 추가: 공통 컴포넌트)
    ├── Modal
    ├── SearchBar
    └── Tooltip
```

---

## 18. Zustand Store 구조

```ts
// 4개 슬라이스로 분리

useSimulatorStore
  ├── teamSlice
  │     team_player: Unit[]
  │     team_enemy: Unit[]
  │     board: HexCell[][]
  │
  ├── battleSlice
  │     current_tick: number
  │     battle_status: 'idle' | 'running' | 'paused' | 'finished'
  │     units_live: Record<string, Unit>  // 현재 전투 중 유닛 상태
  │
  ├── replaySlice
  │     snapshots: TickSnapshot[]
  │     playback_tick: number
  │     playback_speed: 1 | 2 | 4
  │
  └── uiSlice
        selected_unit_id: string | null
        active_panel: 'builder' | 'battle' | 'result'
```

---

## 19. Folder Structure

```
raw-data/                           (v2.1 추가: 빌드타임 원본 데이터)
├── champions/
├── items/
├── augments/
├── traits/
└── images/

src/
├── app/
│   ├── simulator/
│   ├── builder/
│   │   ├── team-builder/          (v2.1 추가: 팀 빌더 서브라우트)
│   │   └── calculator/            (v2.1 추가: 스탯 계산기 서브라우트)
│   └── api/
│       ├── simulate/
│       └── metadata/
├── components/
│   ├── battle/
│   │   ├── BattleBoard.tsx
│   │   ├── UnitToken.tsx
│   │   └── BattleControls.tsx
│   ├── builder/
│   │   ├── ChampionGrid.tsx
│   │   └── ItemSlot.tsx
│   ├── analysis/
│   │   ├── DamageTable.tsx
│   │   └── EventLog.tsx
│   └── ui/                        (v2.1 추가: 공통 컴포넌트)
│       ├── Modal.tsx
│       ├── SearchBar.tsx
│       └── Tooltip.tsx
├── hooks/                          (v2.1 추가)
│   └── useGameData.ts             ← 데이터 로딩 React hook
├── lib/
│   └── simulator/
│       ├── engine/
│       │   ├── combatLoop.ts
│       │   ├── replayEngine.ts
│       │   └── rng.ts             (v2.1 추가: Seed 기반 난수 생성기)
│       ├── systems/
│       │   ├── targeting.ts       ← Role 기반 타게팅 핵심 로직
│       │   ├── attack.ts
│       │   ├── ability.ts
│       │   ├── mana.ts            ← Role별 마나 획득
│       │   ├── stat.ts            (v2.1 추가: 성급 스케일링, 스탯 적용)
│       │   ├── augment.ts         (v2.1 추가: 증강 효과 적용)
│       │   ├── trait.ts
│       │   └── item.ts
│       ├── models/
│       │   ├── unit.ts
│       │   ├── ability.ts
│       │   └── hex.ts
│       └── events/
│           └── eventBus.ts
├── data/
│   ├── champions.json             ← 패치 버전 필드 포함
│   ├── items.json
│   ├── augments.json
│   ├── traits.json
│   ├── loader.ts                  (v2.1 추가: 데이터 파싱/정규화)
│   └── imageMap.ts                (v2.1 추가: 이미지 경로 매핑)
├── store/
│   ├── teamSlice.ts
│   ├── battleSlice.ts
│   ├── replaySlice.ts
│   └── uiSlice.ts
├── styles/                         (v2.1 추가)
│   └── globals.css
└── types/
    ├── unit.ts
    ├── ability.ts
    ├── augment.ts                  (v2.1 추가)
    └── combat.ts
```

> **⚠️ 코드 마이그레이션 필요 (Folder Structure)**
>
> | 항목 | 현재 코드 | 설계 기준 (정본) |
> |------|----------|----------------|
> | 모델 파일 | `models/constants.ts` (단일 파일) | `models/unit.ts`, `models/ability.ts`, `models/hex.ts` (분리) |
> | targeting.ts | 미구현 | `systems/targeting.ts` 구현 필요 |
> | mana.ts | 미구현 | `systems/mana.ts` 구현 필요 |

---

## 20. Data Layer 관리 전략

### 패치 버전 관리

```json
// champions.json 예시
{
  "patch_version": "16.5",
  "fetched_at": "2026-03-12T00:00:00Z",
  "source": "CommunityDragon",
  "champions": [ ... ]
}
```

### 데이터 fetch 전략

| 시점 | 방식 | 대상 |
|------|------|------|
| 빌드타임 | Static JSON | 챔피언, 아이템, 트레이트 기본 스탯 |
| 런타임 | API Route (캐시) | 패치 변경 감지, 최신 밸런스 |

### Fallback 전략

```
CommunityDragon 호출 실패
  → 로컬 캐시 JSON 사용
  → 버전 불일치 경고 배너 표시
```

---

## 20-A. 데이터 로딩 파이프라인 (v2.1 신설)

게임 데이터가 컴포넌트까지 전달되는 흐름을 정의한다.

### 데이터 흐름

```
raw-data/*.json (빌드타임 원본)
  → src/data/loader.ts (파싱, 정규화, 타입 변환)
  → src/hooks/useGameData.ts (React hook, 메모이제이션)
  → 컴포넌트에서 사용
```

### loader.ts 역할

```ts
// src/data/loader.ts

import championsRaw from '@/data/champions.json'
import itemsRaw from '@/data/items.json'

// 1. JSON → 타입 변환 및 검증
// 2. patch_version 확인
// 3. 성급 스케일링 미적용 (1성 기본 스탯 그대로)
// 4. 정규화된 데이터 export

export function loadChampions(): Champion[] { ... }
export function loadItems(): Item[] { ... }
```

### 이미지 매핑

```ts
// src/data/imageMap.ts

// CommunityDragon CDN 또는 로컬 이미지 경로를 중앙 관리
export function getChampionIcon(championId: string): string { ... }
export function getItemIcon(itemId: string): string { ... }
export function getTraitIcon(traitId: string): string { ... }
```

### useGameData Hook

```ts
// src/hooks/useGameData.ts

// 서버 컴포넌트에서는 loader.ts를 직접 호출
// 클라이언트 컴포넌트에서는 이 hook을 사용
export function useChampions(): Champion[] { ... }
export function useItems(): Item[] { ... }
```

---

## 21. MVP Scope

**챔피언 10명 / 아이템 10개 / 증강 5개 / 시너지 5개**

### Role 커버리지 (MVP)
- Tank × 2
- Fighter × 2
- Marksman × 2
- Caster × 2
- Assassin × 2
- ~~Specialist × 0~~ — **의도적 제외**: Specialist는 고유 메커니즘이 챔피언별로 다르므로 MVP에서 제외. Phase 2에서 개별 구현 예정.

### 구현 기능
- 전투 시뮬레이션 (Role 기반 타게팅 포함)
- Damage Table
- Combat Replay (틱 스냅샷 방식)
- 기본 Event Log

### MVP 제외 항목
- 이동 경로 탐색 (A*)
- 복합 스킬 효과
- 도발/특수 오버라이드
- 차트 시각화

---

## 22. Future Features

- Monte Carlo 시뮬레이션
- 조합 승률 분석
- AI 조합 생성기
- 패치 비교 분석
- 경로 탐색 고도화 (A*)
- Replay → 이벤트 재연산 방식 전환

---

## 23. Key Challenges

| 항목 | 주요 난이도 |
|------|-----------|
| Combat Accuracy | Role 기반 타게팅, Ability 로직, Summon 유닛 |
| Performance | 틱 시뮬레이션 최적화, 스냅샷 메모리 관리 |
| Data Consistency | 패치 업데이트 대응, CommunityDragon 비공식 API |
| Determinism | Replay 보장을 위한 결정론적 엔진 설계 |

---

## 24. Guiding Principle

```
Simple visuals
Accurate combat    ← Role-based targeting included
Clear analysis
```

---

*v2.0 — 2026.03 초판*
*Patch 15.1 Roles Revamped 공식 패치노트 기반 타게팅 시스템 반영*

*v2.1 — 2026.03.13 보완*
*기술 스택 버전 확정, 데미지 계산·성급 스케일링·Seed RNG·데이터 파이프라인·StatusEffect·증강 시스템 추가, 코드↔설계 불일치 마이그레이션 가이드 명시*
