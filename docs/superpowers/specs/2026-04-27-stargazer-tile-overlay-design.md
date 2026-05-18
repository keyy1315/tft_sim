# 별돌보미 별자리 선택 + 강화 칸 보드 표시 — Design (2026-04-27)

> **목표**: 시뮬레이터 전투 화면에서 별돌보미 시너지가 활성화되면 사용자가 별자리를
> 선택할 수 있고, 선택한 별자리의 강화 칸이 보드 위에 시각적으로 표시되도록 한다.
> A 팀과 B 팀 각각 독립적으로 별자리를 선택할 수 있다.
>
> 부수: `resolveTraits` 가 동일 챔프를 여러 마리 두면 각각 카운트하던 알려진 버그
> (룰루 3마리 → 별돌보미 +3) 도 함께 수정.

## 1. 배경

- 별돌보미는 Set 17 trait 으로, **(3) 시너지부터 활성**. 실제 게임에서는 매 게임 7개
  별자리(제단/멧돼지/우물/여사냥꾼/메달/산/뱀) 중 하나가 무작위 결정되어 고정된다.
- 별자리는 보드에 **강화 칸 12~18 개를 분산 배치**하며, 그 칸 위 아군은 별자리별
  고유 효과를 받는다 (별돌보미 유닛은 더 큰 효과).
- **현 시뮬레이터 상태** (dev/`b8e4164`):
  - 별자리 → 강화 칸 좌표 매핑은 `CONSTELLATION_TILE_PATTERN` 으로 이미 구현
  - 별자리별 effect 도 `applyStargazerEffects` 에서 7 변종 분기 구현
  - **그러나 시뮬레이터 화면에서 사용자가 별자리를 선택할 UI 가 없음** —
    `SimulateOptions.stargazerConstellation` 이 호출 시 항상 `undefined` 로 전달
  - 결과: 별돌보미 시너지 활성도 base trait 만 적용, 변종 effect 미적용,
    강화 칸 표시도 안 됨
- **부수 버그**: `src/lib/simulator/systems/trait.ts:90` 주석에 명시 — 동일 챔프
  여러 마리 둘 때 trait 카운트 중복. 시뮬에서는 자유 배치라 발생, 실제 게임에서는
  같은 챔프가 한 슬롯에 합쳐지므로 미발생.

## 2. 사용자 요구사항

1. 시뮬레이터 화면에서 별돌보미 시너지가 활성될 때 별자리를 **선택할 수 있어야** 함
2. 선택된 별자리의 **강화 칸이 보드 위에 표시**되어야 함 (양 팀 모두)
3. **A 팀과 B 팀이 각자 다른 별자리를 선택할 수 있어야** 함 (시뮬 분석 편의)
4. **동일 챔프 여러 마리는 시너지 1 카운트** 로 처리 (룰루 3마리 → 별돌보미 1, 복제자 1)

## 3. 설계 결정

| 결정 | 선택 | 대안 / 이유 |
|---|---|---|
| 별자리 적용 범위 | 팀별 독립 (A/B 별개) | 게임 룰은 단일 1 별자리지만 시뮬은 분석 도구. 사용자가 같은 값 양쪽에 두면 자연히 게임-level 와 동일. |
| Dropdown 위치 | SynergyPanel 안 inline (별돌보미 trait 행 아래) | 이오니아 길/중재자 법률 패턴 그대로 차용. 게임-level 컨트롤 바보다 trait 활성과 1:1 묶이는 게 자연스럽다는 사용자 선택. |
| 강화 칸 시각화 | 보라색 테두리만 | 라벨/아이콘 없음. 12~18 칸이 한 팀에 깔리므로 시각적 노이즈 최소화. 별자리 정보는 dropdown 에 표시되니 칸은 "여기가 강화 칸이다" 만 알리면 충분. |
| 강화 칸 표시 조건 | 별자리 선택 + 별돌보미 trait 활성 (style > 0) 모두 충족 시 | 별자리만 선택 + trait 비활성 → 칸 미표시. 둘 다 만족해야 의미 있음. |
| Dedupe 키 | `apiName + mfMode` | MF 는 모드별로 다른 trait 부여 — 모드 다른 MF 2마리는 별개 카운트 유지. 그 외 챔프는 동일 챔프 dedupe. |
| Emblem 카운트 | dedupe 안 함 (현행 유지) | emblem 은 물리 아이템 — 룰루 3마리에 각자 emblem 박으면 +3 가 정상. unit-bound. |

## 4. 데이터 모델 변경

### 4.1 useTeamManagement state 추가

```ts
// src/hooks/useTeamManagement.ts
const [playerStargazerConstellation, setPlayerStargazerConstellation]
  = useState<StargazerConstellationId | null>(null);
const [enemyStargazerConstellation, setEnemyStargazerConstellation]
  = useState<StargazerConstellationId | null>(null);
```

기본값 `null` — 별돌보미 시너지 비활성이면 의미 없음. 사용자가 select 안 누르면
그대로 null 유지, 변종 effect 미적용 (현재 동작 유지).

훅 반환 객체에 4 항목 추가:
- `playerStargazerConstellation`
- `setPlayerStargazerConstellation`
- `enemyStargazerConstellation`
- `setEnemyStargazerConstellation`

### 4.2 SimulateOptions 분리

```ts
// src/lib/simulator/engine/combatLoop.ts
export interface SimulateOptions {
  // ... 기존 필드
  /** A 팀(player) 별자리. 미지정 시 base trait 활성. */
  playerStargazerConstellation?: StargazerConstellationId;
  /** B 팀(enemy) 별자리. 미지정 시 base trait 활성. */
  enemyStargazerConstellation?: StargazerConstellationId;
}
```

기존 `stargazerConstellation` 단일 필드 **제거**. 호출처 전수:

| 호출처 | 변경 |
|---|---|
| `src/app/simulator/page.tsx` `runSimulation` / `runMultiple` | `playerStargazerConstellation: tm.playerStargazerConstellation`, `enemyStargazerConstellation: tm.enemyStargazerConstellation` 전달 |
| `src/lib/validation/schemaAdapter.ts:195` | game-level `stargazerConstellation` → 양 팀 인자 동일 전달 |
| `src/lib/validation/gameDiffer.ts:92` | 동일 — game-level 단일 → 양 팀 분기 |
| `tests/unit/simulator/stargazer-mountain-effects.test.ts` | 호출 인자 업데이트 |
| `tests/unit/simulator/stargazer-trait.test.ts` | resolveTraits 호출은 그대로 (단일 팀) |
| `tests/unit/simulator/stargazer-variants-effects.test.ts` | 호출 인자 업데이트 |
| `tests/calibration/stargazer-mountain-applied.test.ts` | 호출 인자 업데이트 |

actual-data UI / schema 쪽 game-level 단일 필드는 **그대로 유지** — 게임 룰 상 단일이 정확. 변환은 simulate 호출 직전 어댑터에서만 양 팀 분기.

### 4.3 resolveTraits / applyStargazerEffects 시그니처

`resolveTraits` 의 `ResolveTraitsOptions.stargazerConstellation` 은 **그대로 유지**
(이미 한 팀씩 호출하므로 팀별 인자 그대로 전달 가능). 호출처에서:

```ts
const playerActiveTraits = resolveTraits(allyTeam, allTraits, {
  stargazerConstellation: options.playerStargazerConstellation,
});
const enemyActiveTraits = resolveTraits(enemyTeam, allTraits, {
  stargazerConstellation: options.enemyStargazerConstellation,
});
```

`applyStargazerEffects` 호출도 마찬가지:
```ts
applyStargazerEffects(playerActiveTraits, playerUnits, options.playerStargazerConstellation);
applyStargazerEffects(enemyActiveTraits, enemies, options.enemyStargazerConstellation);
```

함수 시그니처의 3 번째 인자 타입은 `SimulateOptions['stargazerConstellation']` (제거됨)
의존이므로 `StargazerConstellationId | undefined` 로 직접 받게 변경 (`combatLoop.ts:653`).

## 5. UI — SynergyPanel dropdown

### 5.1 SynergyPanel prop 추가

```ts
interface SynergyPanelProps {
  // ... 기존 필드
  stargazerConstellation?: StargazerConstellationId | null;
  onStargazerConstellationChange?: (id: StargazerConstellationId | null) => void;
}
```

### 5.2 렌더 위치

별돌보미 trait 행 (`isActive && at.trait.name === '별돌보미'`) 아래 dropdown.
Ionia path 패턴 그대로:

```tsx
{isActive && at.trait.name === '별돌보미' && onStargazerConstellationChange && (
  <select
    value={stargazerConstellation ?? ''}
    onChange={e => onStargazerConstellationChange(
      e.target.value === '' ? null : e.target.value as StargazerConstellationId
    )}
    className="w-full bg-gray-800 text-white text-[10px] rounded px-1 py-0.5 border border-gray-600 mt-1"
  >
    <option value="">별자리 선택...</option>
    {CONSTELLATION_IDS.map(id => (
      <option key={id} value={id}>{CONSTELLATION_KOREAN_NAME[id]}</option>
    ))}
  </select>
)}
```

별돌보미 시너지가 비활성(style=0, < 3 카운트)이면 `isActive` 조건이 false 라
dropdown 자연히 숨김. 사용자가 별자리 선택했다가 유닛 빼서 비활성되면 state 는
유지 (재활성 시 복원), dropdown 만 사라짐.

### 5.3 prop drilling

`SimulatorLayoutDesktop` / `SimulatorLayoutTablet` / `SimulatorLayoutMobile` 3 곳에서
`SynergyPanel` 호출. 각 layout 에 prop 전달 1줄씩 추가 (이미 `tm` 객체를 props 로
받고 있음).

## 6. 보드 렌더링 — 보라색 테두리

### 6.1 SetupBoardCore prop 추가

```ts
interface SetupBoardCoreProps {
  // ... 기존 필드
  /** A 팀 강화 칸 좌표 (데이터 row 0-3 기준). 보드 표시 시 row+4 로 매핑. */
  playerStargazerTiles?: ReadonlyArray<HexCoord>;
  /** B 팀 강화 칸 좌표 (데이터 row 0-3 기준). 그대로 표시. */
  enemyStargazerTiles?: ReadonlyArray<HexCoord>;
}
```

### 6.2 렌더 로직

기존 `hexBuffMap` 빌드 옆에 `stargazerTileSet: Set<string>` 추가:

```ts
const stargazerTileSet = new Set<string>();
for (const t of playerStargazerTiles ?? []) {
  const off = axialToOffset(t);
  stargazerTileSet.add(`${off.row + 4}-${off.col}`);  // player display row
}
for (const t of enemyStargazerTiles ?? []) {
  const off = axialToOffset(t);
  stargazerTileSet.add(`${off.row}-${off.col}`);  // enemy display row
}
```

각 hex polygon 의 stroke 결정 로직에 강화 칸 분기 추가. **stroke 우선순위**:

```
1. unitSel (선택된 유닛 — 노랑 #f59e0b)
2. sel (선택된 cell)
3. hexBuffInfo (증강 칸 — 기존 로직 유지)
4. stargazerTile (강화 칸 — 보라 #A855F7, strokeWidth=2.5)
5. result (cost color — 유닛 배치 시)
6. zone (포탑 효과 범위)
7. default (#2d3548)
```

기존 hex buff(증강 칸)와 강화 칸이 동시 발생하면 **hex buff 우선** — 회귀 방지.
사용자가 직접 설치한 증강 칸 정보가 더 중요.

빈 칸이지만 강화 칸인 경우: 보라 테두리 + 안의 `row,col` 디버그 텍스트 그대로.
유닛이 올라간 강화 칸: 보라 테두리 + 유닛 이미지 + 별/아이템 모두 그대로.

### 6.3 ReplayBoard 동일 패턴

전투 재생 중에도 강화 칸이 보여야 별돌보미 효과 발휘 위치를 시각적으로 추적 가능.
`ReplayBoard.tsx` 도 동일 prop 추가 + stroke 분기 추가.

### 6.4 page.tsx 좌표 계산

```ts
// src/app/simulator/page.tsx
const playerStargazerTiles = useMemo(() => {
  if (!tm.playerStargazerConstellation) return [];
  const active = tm.playerTraits.find(t => t.trait.name === '별돌보미' && t.style > 0);
  if (!active) return [];
  return CONSTELLATION_TILE_PATTERN[tm.playerStargazerConstellation];
}, [tm.playerStargazerConstellation, tm.playerTraits]);

const enemyStargazerTiles = useMemo(() => {
  if (!tm.enemyStargazerConstellation) return [];
  const active = tm.enemyTraits.find(t => t.trait.name === '별돌보미' && t.style > 0);
  if (!active) return [];
  return CONSTELLATION_TILE_PATTERN[tm.enemyStargazerConstellation];
}, [tm.enemyStargazerConstellation, tm.enemyTraits]);
```

별자리 선택했어도 별돌보미 비활성이면 칸 미표시. 양 팀이 같은 값 선택하면 동일
패턴이 양쪽 진영에 미러로 깔려 시각적으로 자연스러움 (강화 칸 좌표는 4행 × 7열로
이미 player half 기준).

## 7. 중복 유닛 시너지 1 카운트 (trait.ts dedupe)

### 7.1 현재 동작

```ts
// src/lib/simulator/systems/trait.ts:91-97
for (const { champion, mfMode } of champions) {
  const traits = resolveMfTraits(champion, mfMode);
  for (const traitName of traits) {
    traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
  }
}
```

룰루 3마리 → 별돌보미/복제자 각각 +3. trait.ts:90 주석 _"기존 동작 보존 — unique
champion 검사 없음 (별도 PR 에서 처리)"_ 에 명시된 알려진 버그.

### 7.2 수정

```ts
const seenChampions = new Set<string>();
for (const { champion, mfMode } of champions) {
  const dedupeKey = `${champion.apiName}:${mfMode ?? ''}`;
  if (seenChampions.has(dedupeKey)) continue;
  seenChampions.add(dedupeKey);
  const traits = resolveMfTraits(champion, mfMode);
  for (const traitName of traits) {
    traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
  }
}
```

**dedupe 키 = `apiName + mfMode`**:
- MF 는 모드(공격/주문력/회복)에 따라 다른 trait 부여 — 모드 다른 MF 2마리 별개 카운트
- 그 외 챔프는 mfMode = undefined → 동일 챔프면 같은 키

### 7.3 Emblem 카운트는 유지

```ts
// 현행 유지 (변경 없음) — emblem 은 unit-bound 물리 아이템
for (const { items } of champions) {
  for (const traitName of emblemTraitFromItems(items)) {
    traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
  }
}
```

게임 룰: emblem 은 **그 trait 을 이미 갖지 않은 유닛에게만 부착 가능** (`canEquipItem`
검증). 즉 별돌보미 emblem 은 룰루(이미 별돌보미) 에게 못 박음. 따라서 emblem 카운트
중복 케이스는 자연히 발생 안 함. dedupe 불필요.

emblem 정상 사용 예: 별돌보미 챔프 3마리 + 별돌보미 아닌 챔프(예: 가렌)에 별돌보미
emblem 1개 → 카운트 = 4.

### 7.4 자동 소환 유닛 영향 검토

자동 소환 유닛이란 사용자가 직접 배치하지 않고 시너지 효과로 보드에 자동 추가되는
유닛. `resolveTraits` 는 사용자 배치 유닛 + 자동 유닛 모두 받아서 카운트하므로 자동
유닛이 같은 apiName 을 여러 개 가질 때 dedupe 영향 가능.

**Set 17 활성 자동 유닛**:

| 자동 유닛 | apiName | traits | 동시 최대 | 트리거 | dedupe 영향 |
|---|---|---|---|---|---|
| 비아와 바이엔 | `TFT17_Summon` | `[]` | 1 | 길잡이 (3/5/7) — 성급만 변동 | 없음 |
| 유물 (셴 분신) | `TFT17_ShenProp` | `[]` | 셴당 1 | 셴 보드 배치 시 자동 생성 | 없음 |

> 유물은 반경 1칸(인접 6칸) 에 보루 시너지가 적용되는 hex buff 메커니즘 보유 (별도
> 작업 영역). 별돌보미 강화 칸과 stroke 우선순위 충돌 가능 — §6.2 우선순위 표에서
> hex buff 가 강화 칸보다 우선이라 회귀 없음.

**Set 16 자동 유닛 (Set 17 비활성, 데이터 잔존)**:

| 자동 유닛 | apiName | 상태 |
|---|---|---|
| 얼어붙은 포탑 | `TFT16_FreljordTurret` | Set 17 미사용 |
| 모래 병사 | `TFT16_AzirSoldier` | Set 17 미사용 |
| 티버 | `TFT16_AnnieTibbers` | Set 17 미사용 |

코드는 잔존하지만 Set 17 게임에서는 트리거 안 됨 (`syncFreljordTurretsInTeam` 등은
사실상 죽은 코드 — 별도 cleanup 후보, 본 spec 범위 외).

**결론**: Set 17 자동 유닛 모두 `traits: []` + 동시 최대 1 → dedupe 키 충돌 무관.
자동 유닛 dedupe 안전.

## 8. 테스트 전략

### 8.1 새 unit test

`tests/unit/simulator/trait-dedupe.test.ts`:
- 룰루 3마리 → `별돌보미: 1, 복제자: 1` 검증 (intrinsic trait dedupe)
- 룰루 1마리 + 다른 별돌보미 챔프 1마리 → `별돌보미: 2, 복제자: 1` (별개 챔프는 각자 카운트)
- 별돌보미 챔프 3마리 + 별돌보미 아닌 챔프에 별돌보미 emblem 1개 → `별돌보미: 4` (emblem 은 unit-bound 카운트)
- MF 2마리 (공격 모드 / 주문력 모드) → 각 모드 trait 별개 카운트 (apiName + mfMode 키 검증)

`tests/unit/simulator/stargazer-constellation-team.test.ts`:
- A 팀만 별자리 선택 + 별돌보미 활성 → A 팀 효과 적용, B 팀 미적용
- 양 팀 다른 별자리 + 양 팀 활성 → 각 팀 다른 효과

### 8.2 회귀 가드

`tests/calibration/compute-diff-cache.test.ts` 양 게임 N=10 재실행:
- 실제 게임은 동일 챔프 중복 없음 → dedupe 영향 0 예상
- 실제 게임은 game-level 단일 별자리 → 양 팀 동일 전달로 어댑터 변경 후 영향 0 예상
- 차이 발생 시 의외 회귀이므로 점검

### 8.3 4-게이트

```bash
pnpm lint && pnpm typecheck && pnpm test --run && pnpm build
```

모두 통과 후 커밋.

## 9. 영향 받는 파일 요약

| 파일 | 변경 종류 |
|---|---|
| `src/hooks/useTeamManagement.ts` | state + setter 4 추가 |
| `src/lib/simulator/engine/combatLoop.ts` | `SimulateOptions` 필드 분리, `resolveTraits` / `applyStargazerEffects` 호출 인자 변경 |
| `src/lib/simulator/systems/trait.ts` | dedupe 로직 추가 |
| `src/lib/validation/schemaAdapter.ts` | game-level 별자리 → 양 팀 동일 전달 |
| `src/components/builder/SynergyPanel.tsx` | dropdown 추가 |
| `src/components/battle/SetupBoardCore.tsx` | `playerStargazerTiles` / `enemyStargazerTiles` prop + stroke 분기 |
| `src/components/battle/ReplayBoard.tsx` | 동일 prop + stroke 분기 |
| `src/app/simulator/page.tsx` | 좌표 계산 useMemo 2개, layoutProps 전달 |
| `src/app/simulator/layout/SimulatorLayoutDesktop.tsx` | prop drilling |
| `src/app/simulator/layout/SimulatorLayoutTablet.tsx` | prop drilling |
| `src/app/simulator/layout/SimulatorLayoutMobile.tsx` | prop drilling |
| `src/app/simulator/layout/types.ts` | 새 prop 타입 추가 |
| `tests/unit/simulator/trait-dedupe.test.ts` | 새 테스트 |
| `tests/unit/simulator/stargazer-constellation-team.test.ts` | 새 테스트 |

## 10. 리스크 및 완화

| 리스크 | 완화 |
|---|---|
| `applyStargazerEffects` 단일 → 팀별 분리 시 호출처 누락 | grep `stargazerConstellation` 으로 호출처 전수 확인 + 4-게이트 typecheck 로 검출 |
| Hex buff 와 강화 칸 stroke 충돌 | hex buff 우선 — 기존 동작 유지 |
| ReplayBoard 누락 | 명시적 작업 항목으로 분리 |
| dedupe 가 actual-data 회귀 유발 | calibration cache 재실행으로 검증 — 실 게임은 중복 없으므로 무영향 예상, 영향 시 점검 |
| 별돌보미 trait name 매칭 의존 (`'별돌보미'` 한글 string) | 코드베이스 기존 관행 (다른 trait 들도 한글 name 매칭) — 일관성 유지. `public/data/tft_set17_traits.json` 확인 — 8개 variant 모두 `name: "별돌보미"` 동일. |

## 11. MVP 범위 외 (후속 PR 후보)

- 플레이어 레벨별 강화 칸 점진 공개 (현재는 풀 패턴 고정 — handoff doc 옵션 E)
- 별돌보미 statusEffect / event-driven 효과 (handoff doc 옵션 A~D)
- 강화 칸 hover tooltip — 별자리 효과 텍스트 표시
- 별자리 7번째 / 8번째 미확인 사항 (`docs/meta/wiki/raw/lolchess/set17-stargazer-constellations.md` 참고)

## 12. 작업 순서

1. **Phase 1 — 데이터 모델** (커밋 1): SimulateOptions 분리, useTeamManagement state, 호출처 업데이트, schemaAdapter 어댑터
2. **Phase 2 — Trait dedupe** (커밋 2): trait.ts 수정 + 새 테스트 + calibration 재실행
3. **Phase 3 — UI dropdown** (커밋 3): SynergyPanel + prop drilling 3 layout
4. **Phase 4 — 보드 렌더링** (커밋 4): SetupBoardCore + ReplayBoard 보라 테두리 + page.tsx 좌표 계산
5. **Phase 5 — 통합 테스트** (커밋 5): stargazer-constellation-team.test.ts + 양 게임 calibration 재실행 + 4-게이트

각 phase 종료 시 4-게이트(`pnpm lint && pnpm typecheck && pnpm test --run && pnpm build`)
통과 확인. 모두 통과해야 다음 phase 진행.
