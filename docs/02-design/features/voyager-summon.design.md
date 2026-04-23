# Design: 길잡이 시너지 — 비아와 바이엔 소환

> Plan 참조: `docs/01-plan/features/voyager-summon.plan.md`

---

## 1. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | 전적검색 — 소환 유닛 코스트 숨김 | `src/app/lookup/page.tsx` |
| 2 | 아타칸 소환 로직 삭제 | `src/lib/simulator/engine/combatLoop.ts` |
| 3 | 타입 — PlacedChampion에 `isSummon` 플래그 | `src/types/index.ts` |
| 4 | 시너지 계산 후 자동 배치/제거 | `src/hooks/useTeamManagement.ts` |
| 5 | SetupBoard — 소환 유닛 드래그 허용, 아이템 거부 | `src/components/battle/SetupBoard.tsx` |
| 6 | lint/typecheck/build | - |

---

## 2. 전적검색 — 소환 유닛 코스트 숨김

현재 `cost <= 5`로 별 표시/숨김을 판단하는데, 코스트 표시 자체도 숨겨야 함.

**ChampionUnit에서:**
- `cost > 5` (소환 유닛) → 별 invisible (이미 구현됨)
- **추가**: 코스트 border 색상 → 특수 색상 (흰색 `#e5e7eb`) 적용
- **추가**: 툴팁에서 "코스트" 대신 "소환 유닛" 표시

```tsx
const champTitle = meta
  ? cost > 5
    ? `${meta.name} (소환 유닛)`
    : `${meta.name} (${meta.cost}코스트)\n${meta.traits.join(', ')}`
  : cleanChampionName(id);
```

---

## 3. 아타칸 소환 로직 삭제

`src/lib/simulator/engine/combatLoop.ts`에서 제거할 코드:

- `trySpawnNoxusAtakhan()` 함수 (약 120줄)
- `trySpawnFreljordTurrets()` 뒤에 있는 두 번째 소환 함수도 있으면 확인
- `playerAtakhanFlag`, `enemyAtakhanFlag` 변수
- tick 루프 내 소환 체크 코드:
  ```ts
  const playerAtakhan = trySpawnNoxusAtakhan(...);
  if (playerAtakhan) { ... }
  const enemyAtakhan = trySpawnNoxusAtakhan(...);
  if (enemyAtakhan) { ... }
  ```

---

## 4. 타입 변경

### 4.1 PlacedChampion 확장

`src/types/index.ts`의 `PlacedChampion` 인터페이스에 `isSummon` 플래그 추가:

```ts
interface PlacedChampion {
  champion: RawChampion;
  position: HexCoord;
  starLevel: 1 | 2 | 3;
  items: RawItem[];
  mfMode?: string;
  isSummon?: boolean;  // 신규: 시너지 소환 유닛 여부
}
```

---

## 5. 시너지 트리거 자동 배치/제거

### 5.1 위치: `src/hooks/useTeamManagement.ts`

`resolveTraits()` 호출 후 (`playerTraits`/`enemyTraits` 계산 직후) 길잡이 시너지를 감지하여 보드에 자동 배치/제거.

### 5.2 로직

```ts
// playerTraits/enemyTraits useMemo 뒤에 useEffect로 처리
// (시너지 변경 시에만 실행)

function syncVoyagerSummon(
  team: PlacedChampion[],
  traits: ActiveTrait[],
  setTeam: (updater: (prev: PlacedChampion[]) => PlacedChampion[]) => void,
  allChampions: RawChampion[],
) {
  const voyager = traits.find(t => t.trait.apiName === 'TFT17_Voyager');
  const voyagerActive = voyager && voyager.activeEffect != null;  // style >= 1, minUnits 충족
  const hasSummon = team.some(p => p.champion.apiName === 'TFT17_Summon');

  if (voyagerActive && !hasSummon) {
    // 소환: 빈 헥스 찾아서 배치
    const summonChamp = allChampions.find(c => c.apiName === 'TFT17_Summon');
    if (!summonChamp) return;

    const occupiedPositions = new Set(team.map(p => `${p.position.q},${p.position.r}`));
    const emptyHex = findEmptyHex(occupiedPositions, teamSide);
    if (!emptyHex) return;

    setTeam(prev => [...prev, {
      champion: summonChamp,
      position: emptyHex,
      starLevel: 1,
      items: [],
      isSummon: true,
    }]);
  } else if (!voyagerActive && hasSummon) {
    // 제거: 시너지 해제됨
    setTeam(prev => prev.filter(p => p.champion.apiName !== 'TFT17_Summon'));
  }
}
```

### 5.3 빈 헥스 탐색

플레이어 진영 (row 4~6 또는 row 0~2) 중앙부터 탐색:

```ts
function findEmptyHex(
  occupied: Set<string>,
  side: 'player' | 'enemy',
): HexCoord | null {
  const rows = side === 'player' ? [6, 5, 4] : [0, 1, 2];
  for (const r of rows) {
    for (const col of [3, 2, 4, 1, 5, 0, 6]) {
      const q = col - Math.floor(r / 2);
      if (!occupied.has(`${q},${r}`)) return { q, r };
    }
  }
  return null;
}
```

### 5.4 유닛 수 카운트 제외

소환 유닛은 팀 유닛 수에 포함되지 않아야 함. 유닛 수 카운트 시 `isSummon` 제외:

```ts
const unitCount = team.filter(p => !p.isSummon).length;
```

---

## 6. SetupBoard — 소환 유닛 처리

### 6.1 드래그 이동

소환 유닛도 다른 챔피언과 동일하게 드래그 이동 허용. 기존 드래그 로직 수정 불필요 (PlacedChampion으로 이미 처리됨).

### 6.2 아이템 장착 거부

아이템 드래그 → 소환 유닛 위에 드롭 시 거부:

```ts
// handleEquipItem 내부
if (placed.isSummon) return;  // 아이템 장착 불가
```

### 6.3 제거 거부

소환 유닛은 유저가 직접 보드에서 제거 불가:

```ts
// handleRemoveChampion 내부
if (placed.isSummon) return;  // 시너지가 유지되는 한 제거 불가
```

### 6.4 시각적 구분

소환 유닛 border를 흰색 + 미세한 glow로 표시하여 일반 챔피언과 구분:

```tsx
const isSummon = placed.isSummon;
// border: 흰색, 미세한 cyan glow
const summonStyle = isSummon ? 'stroke: #e5e7eb; filter: drop-shadow(0 0 3px #06b6d4)' : '';
```

---

## 7. 전투 참전

소환 유닛이 보드에 배치되어 있으면 기존 `simulateCombat()` 로직에서 자동으로 `CombatUnit`으로 변환됨 — 추가 코드 불필요.

스탯 스케일링 (길잡이 별레벨 합산)은 전투 시작 시 `CombatUnit` 생성 단계에서 처리:

```ts
// combatLoop.ts — CombatUnit 생성 시
if (placed.isSummon && placed.champion.apiName === 'TFT17_Summon') {
  const voyagerStars = teamPlaced
    .filter(p => !p.isSummon && p.champion.traits.includes('길잡이'))
    .reduce((sum, p) => sum + p.starLevel, 0);
  // voyagerStars로 스탯 스케일링 적용
}
```

---

## 8. 에러/엣지 케이스

| 케이스 | 처리 |
|--------|------|
| 보드 가득 참 (빈 헥스 없음) | 소환 안 됨 (경고 없음, 자리 나면 자동 소환) |
| 소환 유닛 위에 다른 챔피언 드래그 | 위치 교환 허용 |
| 시너지 3→2로 떨어짐 | 즉시 제거 |
| 양 팀 모두 길잡이 활성 | 각각 독립적으로 소환/제거 |
| 전적검색에서 TFT17_Summon | 코스트 숨김, "소환 유닛" 표시, 별 없음 |
