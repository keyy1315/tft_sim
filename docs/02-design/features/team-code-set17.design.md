# Design: Set 17 팀 코드 Import 복구

Plan 참조: [`docs/01-plan/features/team-code-set17.plan.md`](../../01-plan/features/team-code-set17.plan.md)

---

## 1. 현재 구현 현황

### 1.1 재사용 (변경 없음)

| 항목 | 위치 | 역할 |
|------|------|------|
| 128-bit 팀코드 디코더 | `src/lib/teamCode.ts:22-72` | header 10 + slot 12 (code10 + star2) |
| 팀코드 인코더 | `src/lib/teamCode.ts:74-99` | 보드 → 코드 |
| 역할군 기반 자동 배치 `autoPlaceChampions` | `src/lib/teamCode.ts:109-148` | `FRONT_ROLES={Tank,Fighter,Assassin}` 전방, 나머지 후방 |
| `TeamCodePanel` UI | `src/components/builder/TeamCodePanel.tsx` | import/export 입력, `onImport → updatePlayerTeam/updateEnemyTeam` |
| `loadTeamPlannerMapping` | `src/data/loader.ts:101-108` | `tft_{setId}_teamplanner.json` 로딩 + cache |

### 1.2 이번에 구현할 것

| # | 항목 | 우선순위 |
|---|------|---------|
| 1 | `tft_set17_teamplanner.json` mapping 채우기 | P0 |
| 2 | `decodeTeamCode`: star=0 → 2성 해석 | P0 |
| 3 | 수집 스크립트 `scripts/build-teamplanner.ts` (CommunityDragon → JSON) | P1 (자동화) |

---

## 2. 데이터 확보 전략

### 2.1 CommunityDragon 경로 후보 (우선순위 순)

실제 존재 여부는 Do 단계에서 `WebFetch` 로 1차 확인 후 결정.

| 후보 | URL | 비고 |
|------|-----|------|
| **C1** | `https://raw.communitydragon.org/latest/cdragon/tft/en_us.json` | champion entries 에 `teamPlannerCode` 필드 포함 여부 확인 |
| **C2** | `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/tftchampions-teamplanner.json` | 오피셜 Team Planner dataset (존재 시 가장 신뢰) |
| **C3** | `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json` 스타일 static data 인덱스 | 간접 탐색 용 |

경로 C1 발견 → 최우선.

### 2.2 실행 분기

```
┌────────────────────────────────────────────────┐
│ Do 단계 진입                                   │
└──────────────┬─────────────────────────────────┘
               │
     ┌─────────▼──────────┐
     │ C1 / C2 WebFetch   │
     └─────────┬──────────┘
               │
      ┌────────▼────────┐        ┌───────────────────────────┐
      │ 전체 매핑 존재?  │  YES   │ 스크립트 경로 (권장)        │
      │                │────────▶│ scripts/build-teamplanner │
      │                │         │ → JSON 생성               │
      └────────┬───────┘         └───────────────────────────┘
               │ NO
               ▼
     ┌──────────────────────────────┐
     │ B 경로: 예제 역산 8쌍 + 수동 │
     │ 확장 (일단 현재 요구 커버)  │
     └──────────────────────────────┘
```

### 2.3 B 경로 확정 매핑 (예제 역산 결과)

| 슬롯 | code | apiName |
|------|------|---------|
| 0 | 70 | `TFT17_Lissandra` |
| 1 | 20 | `TFT17_IvernMinion`  (꼬마정령) ✅ 확인됨 |
| 2 | 78 | `TFT17_Mordekaiser` |
| 3 | 45 | `TFT17_Pyke` |
| 4 | 33 | `TFT17_Rhaast` |
| 5 | 46 | `TFT17_Viktor` |
| 6 | 17 | `TFT17_Illaoi` |
| 7 | 55 | `TFT17_Nami` |

최소한 위 8쌍은 반드시 JSON 에 포함 (FR-02 보장). C1/C2 성공 시 이 데이터와 일치 여부 교차 검증.

---

## 3. 모듈 설계

### 3.1 `tft_set17_teamplanner.json` 구조

Set 16 과 동일한 스키마 유지:

```json
{
  "meta": {
    "set": 17,
    "source": "communitydragon" | "manual",
    "fetchedAt": "2026-04-21T00:00:00Z"
  },
  "mapping": [
    { "apiName": "TFT17_Illaoi", "teamPlannerCode": 17 },
    { "apiName": "TFT17_IvernMinion", "teamPlannerCode": 20 },
    ...
  ]
}
```

- `meta` 는 현재 `loadTeamPlannerMapping` 에서 사용하지 않지만 Set 16 파일과 일관성 + 데이터 유래 추적용.
- `mapping` 이 핵심. `apiName` 중복 금지, `teamPlannerCode` 중복 금지.
- `src/data/loader.ts:105` 는 `data.mapping` 만 읽음 → 스키마 호환 OK.

### 3.2 `decodeTeamCode` 수정

**파일**: `src/lib/teamCode.ts`

```diff
     result.champions.push({
       champion,
-      starLevel: starLevel === 0 ? 1 : starLevel,
+      // 팀 코드 import 시 star=0 (미지정) 은 "기본 2성" 으로 해석 — UX 요구사항.
+      // star=1/2/3 은 명시적 값이면 그대로 사용.
+      starLevel: starLevel === 0 ? 2 : starLevel,
     });
```

- 타입 변화 없음 (`1 | 2 | 3` 그대로).
- Encoder 는 건드리지 않음 (1성 export → 0 으로 저장 → re-import 시 2성으로 해석되는 비대칭은 의도).

### 3.3 수집 스크립트 (optional, A 경로 시)

**경로**: `scripts/build-teamplanner.ts`

**책임**: CommunityDragon JSON 다운로드 → Set 17 `teamPlannerCode` 필드 추출 → `public/data/tft_set17_teamplanner.json` 쓰기.

**골격**:

```ts
// Usage: pnpm tsx scripts/build-teamplanner.ts
import fs from 'node:fs/promises';
import path from 'node:path';

const CD_TFT_URL = 'https://raw.communitydragon.org/latest/cdragon/tft/en_us.json';
const OUT_PATH = path.join(process.cwd(), 'public/data/tft_set17_teamplanner.json');
const SET_MUTATOR = 'TFTSet17';

async function main() {
  const res = await fetch(CD_TFT_URL);
  const data = await res.json() as { setData: Array<{ mutator: string; champions: Array<{ apiName: string; teamPlannerCode?: number }> }> };
  const set = data.setData.find(s => s.mutator === SET_MUTATOR);
  if (!set) throw new Error(`Set ${SET_MUTATOR} not found`);

  const mapping = set.champions
    .filter(c => typeof c.teamPlannerCode === 'number' && c.teamPlannerCode > 0)
    .map(c => ({ apiName: c.apiName, teamPlannerCode: c.teamPlannerCode! }));

  if (mapping.length === 0) {
    throw new Error('teamPlannerCode 필드가 응답에 없습니다. C1 실패 — B 경로로 수동 채우기 필요.');
  }

  const out = {
    meta: { set: 17, source: 'communitydragon', fetchedAt: new Date().toISOString() },
    mapping,
  };
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  console.log(`✅ wrote ${mapping.length} entries to ${OUT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- 성공 조건: `mapping.length > 0` 및 8개 예제 역산 검증 (스크립트 내 assert).
- 실패 시: 스크립트는 throw, 수동으로 B 경로 JSON 작성.

### 3.4 타입 변경

없음. `TeamPlannerEntry`, `TeamPlannerData`, `TeamCodeDecodeResult` 모두 그대로 사용.

---

## 4. 데이터 검증

### 4.1 예제 코드 검증 체크리스트

Do 단계에서 작성한 JSON 으로:

1. 브라우저 dev 환경 시뮬레이터 진입.
2. 팀코드 `0204601404e02d02102e011037000000TFTSet17` import.
3. 결과 보드에 8명 유닛 확인:
   - **전방**(하단 row): Tank/Fighter/Assassin
     - 일라오이 (Tank), 모데카이저 (Tank), 파이크 (Assassin), 라아스트 (Fighter), 리산드라 (? - 확인 필요)
   - **후방**(상단 row):
     - 빅토르 (Caster), 나미 (Caster), 꼬마정령 (Specialist — Fae summon)
4. 모두 2성 (별 2개 아이콘).

### 4.2 역할군 확인

```
챔피언          apiName              role (champion.role 기반)
리산드라        TFT17_Lissandra      (champions.json 확인 필요)
꼬마정령        TFT17_IvernMinion    (role = Specialist?/Minion?)
모데카이저      TFT17_Mordekaiser    APTank/Tank
파이크          TFT17_Pyke           Assassin
라아스트        TFT17_Rhaast         Fighter
빅토르          TFT17_Viktor         Caster/Mage
일라오이        TFT17_Illaoi         Tank
나미            TFT17_Nami           Caster
```

Do 단계에서 `champions.json` 에서 각 유닛의 `role` 필드 확인 — `mapGameRole` 이 기대대로 분류하는지 확인.

`FRONT_ROLES = {'Tank','Fighter','Assassin'}` — Role 이 이 중 하나면 전방. 꼬마정령이 Specialist 가 아니라면 전방 배치될 수 있어 예상 다를 수 있음. 검증 시 확인 후 필요시 배치 규칙 조정 논의.

### 4.3 round-trip 회귀

- 새 팀 구성 → export → clipboard 코드 → import → 2성으로 복원.
- 기존 1성으로 export 한 코드를 import 시 → 2성으로 복원 (의도된 비대칭).

---

## 5. 구현 순서

1. **Do 단계 시작 전**: `scripts/build-teamplanner.ts` 로 CommunityDragon 시도
   - 성공 → JSON 자동 생성 + 8쌍 교차 검증.
   - 실패 → §2.3 B 경로 하드코딩으로 최소 JSON 작성.
2. `src/lib/teamCode.ts:67` 수정 (star=0 → 2).
3. `pnpm lint && pnpm typecheck && pnpm build`.
4. 브라우저 수동 QA (§4).

---

## 6. 테스트 시나리오

### 6.1 핵심 (FR-01 ~ FR-05)

- [ ] 시뮬레이터 진입 → "팀 코드" 토글 → TEAM A 선택 → 예제 코드 paste → "로드" 클릭.
- [ ] **8명 유닛이 보드에 표시됨** (빈 슬롯 없음).
- [ ] **모두 2성** (★★ 아이콘).
- [ ] Tank/Fighter/Assassin 역할은 **전방 row (하단 4~5행)** 에 배치.
- [ ] Caster 등은 **후방 row (상단 6~7행)** 에 배치.
- [ ] "전투 시작" 눌러 시뮬레이션 정상 실행 (오류 없음).

### 6.2 회귀 (FR-06)

- [ ] Set 16 전적 또는 Set 16 팀 코드는 영향받지 않음.
- [ ] 일부 코드가 미매핑 상태 → warnings 노란 텍스트로 표시, 매핑된 나머지는 정상 import.
- [ ] TEAM B 로 import 시 유닛이 상단 row 에 배치 (enemy 규약).

### 6.3 Round-trip

- [ ] TEAM A 구성 후 export → 코드 복사 → import → 동일한 유닛 세트 2성으로 복원.

### 6.4 빌드

- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과.

---

## 7. 위험 요소 & 완화

| 위험 | 완화 |
|------|------|
| CommunityDragon 에 `teamPlannerCode` 필드가 없거나 경로 변경 | B 경로 하드코딩으로 최소 커버 + WebSearch 로 CC TFT Datamining 커뮤니티 자료 검색 |
| `autoPlaceChampions` 가 `FRONT_ROLES` 에 없는 역할(예: `Mage`, `Specialist` 세분화) 을 다 후방 처리 | Do 단계에서 각 유닛의 `champion.role` 원시값과 `mapGameRole` 결과를 콘솔로 찍어 확인. 필요 시 역할군 맵 보강은 별도 작업으로 미룸 |
| 1성 export → 2성 import 비대칭으로 팀 코드 공유 시 혼란 | `TeamCodePanel` 의 warning/info 영역에 "import 시 1성은 자동으로 2성 업그레이드됩니다" 안내 한 줄 추가 고려 (P2 — 구현 범위) |
| `teamPlannerCode` 중복 혹은 `apiName` 오타 | JSON 검증: Do 단계에서 `new Set(map(e=>e.apiName))` / `new Set(map(e=>e.teamPlannerCode))` 크기 비교 |

---

## 8. 범위 외

- 팀 코드에 아이템/증강/hex buff 정보 추가 (포맷 변경 필요).
- CommunityDragon 스크립트를 CI 에 넣어 자동 갱신.
- 팀 코드 공유 URL (쿼리 파라미터).
- Set 16 매핑 재수집 / 업데이트.
- `autoPlaceChampions` 의 Assassin 후방 선호 같은 role 세분화 정책.
