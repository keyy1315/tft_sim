# 아이템 데이터 교정 + 전적검색 매칭 설계

**일자**: 2026-04-22
**관련 영역**: 전적검색(lookup), 가상 대전(matchAdapter), 빌더·시뮬레이터 (유물 아이템)

---

## 1. 배경 / 문제

TFT 전투 시뮬레이터의 **전적검색 화면**에서 아래 두 부류 아이템이 아이콘·툴팁 매칭에 실패하고 있음:

1. **찬란 (Radiant) 아이템 전반** — 전적검색에서 실패, 시뮬레이터 빌더에서는 정상.
2. **도박꾼의 칼날·거물의 갑옷** — 전적검색에서 실패, 가상 대전 → 시뮬레이션 복원 경로에서도 해당 아이템이 누락됨.

탐색 결과 두 문제의 근본 원인은 서로 다르지만, 해결 경로가 같은 계층에 있어 하나의 Plan 으로 묶어서 처리한다.

### 1.1 찬란 아이템 매칭 실패

- Riot 매치 API 는 찬란 아이템을 `TFT5_Item_{Base}Radiant` 형태(끝 접미사, set5 prefix)로 반환.
- 우리 공용 JSON (`public/data/common/tft_common_items.json`) 의 canonical 키는 `TFT_Item_Radiant_{Base}` 형태.
- `src/lib/analysis/coverageChecker.ts` 의 `resolveItemId()` 가 이 매핑을 알고 있으나 **matchAdapter 에서만** 쓰임. 전적검색 UI (`src/app/lookup/page.tsx`) 는 `itemMeta?.[rawRiotId]` 로 raw ID 를 직접 조회 → 미스.
- 시뮬레이터 빌더는 JSON canonical 키로 아이템을 고르므로 영향 없음.

### 1.2 도박꾼의 칼날·거물의 갑옷 데이터 오류

CommunityDragon 최신 데이터(`https://raw.communitydragon.org/latest/cdragon/tft/ko_kr.json`) 확인 결과, 우리가 JSON 에 담고 있는 변형(`_Revival` suffix)이 **과거 이벤트 버전**이고 현재 인게임 값과 다름.

**도박꾼의 칼날 비교**

| 필드 | 현재 인게임 (`TFT7_Item_ShimmerscaleGamblersBlade`) | 우리 JSON (`_Revival`) |
|---|---|---|
| AttackSpeedPerGold | **1% (0.01)** | 1.5% (0.015) |
| AttackSpeedGoldLimit | **30 gold** | 60 gold |
| ChanceToProc | **6% (0.06)** | 7% (0.07) |
| GoldPerProc | 1 | 1 |
| 기본 AS | **55** | 15 (+ AP 15) |

**거물의 갑옷 비교**

| 필드 | 현재 인게임 (`TFT7_Item_ShimmerscaleMogulsMail`) | 우리 JSON (`_Revival`) |
|---|---|---|
| BaseHealthPerStack | **8** | 10 |
| BaseResistsPerStack | 1 | 1 |
| GoldAtFullStacks | **1** | 2 |
| GoldInterval | **11** | 8 |
| Health | **300** | 350 |
| StackCap | 35 | 35 |
| desc | "최대 중첩 시 1골드 획득. **이후 11초마다 1골드 획득**" | 반복 획득 문구 없음 |

**부가 효과**: Riot 매치 API 도 base ID (`TFT7_Item_ShimmerscaleGamblersBlade` / `TFT7_Item_ShimmerscaleMogulsMail`) 로 반환. 우리 JSON 엔 `_Revival` 만 있으니 apiName 매칭 자체가 실패 → 전적검색·가상 대전 양쪽에서 아이템이 아예 사라진 것처럼 보임.

---

## 2. 목표 / 범위

### 2.1 목표

1. 전적검색 UI 에서 찬란 아이템·도박꾼의 칼날·거물의 갑옷의 아이콘·툴팁이 정상 표시되도록 수정.
2. 가상 대전 → 시뮬레이터 복원 경로에서 세 종류 아이템이 유닛 슬롯에 유지되도록 수정.
3. 빌더·시뮬레이터가 참조하는 도박꾼의 칼날·거물의 갑옷 데이터를 **현재 인게임 값**으로 교정.

### 2.2 IN scope

- `public/data/common/tft_common_items.json` 에서 도박꾼의 칼날·거물의 갑옷 엔트리 **base 변형으로 교체** (apiName·effects·desc).
- `src/lib/simulator/systems/item.ts` 의 `FORCE_ARTIFACT` set 에서 `_Revival` → base apiName 갱신.
- `src/app/api/lookup/route.ts` 의 `getItemMeta()` 에 Riot raw ID alias 자동 등록 로직 추가 (찬란 suffix 형식).
- 관련 테스트·골든 스냅샷 영향 확인 및 업데이트.

### 2.3 OUT scope

- `_HR` / `_Radiant` Shimmerscale 변형 (Riot 매치 API 는 base 를 반환하므로 불필요).
- 다른 `_Revival` / `_HR` 계열 아이템 일괄 감사 (요청 범위 밖).
- matchAdapter 의 `resolveItemId` 패턴 확장 (작업 1 후 base ID 가 JSON canonical 이 되어 현재 resolver 로 충분).
- Set 16 전용 JSON (`public/data/set16/tft_set16_items.json`) 내 `_Revival` 엔트리 — Set 16 은 기본 레벨 지원 대상이 아니며 유저 요청 범위 밖. loader 가 common 먼저 읽고 dedupe 하므로 Set 17 기준 동작에 무영향.

### 2.4 성공 기준

- 전적검색 화면에서 찬란 아이템·도박꾼의 칼날·거물의 갑옷 아이콘이 표시되고, 툴팁에 이름·설명이 나타남.
- 가상 대전 복원 경로에서 세 종류 아이템이 유닛 슬롯에 유지됨.
- 빌더 유물 탭 툴팁 스탯이 CommunityDragon base 변형 값과 정확히 일치.
- `pnpm lint && pnpm typecheck && pnpm build` 모두 통과.

---

## 3. 데이터 교체 상세

### 3.1 도박꾼의 칼날

**Before** (`tft_common_items.json` line ~2618)
```json
{
  "name": "도박꾼의 칼날",
  "apiName": "TFT7_Item_ShimmerscaleGamblersBlade_Revival",
  "effects": {
    "AP": 15, "AS": 15, "AttackSpeedGoldLimit": 60,
    "AttackSpeedPerGold": 0.014999999664723873,
    "ChanceToProc": 0.07000000029802322,
    "GoldPerProc": 1,
    "{46736b3f}": 4, "{b38e1643}": 20
  },
  "desc": "...(Revival desc)...",
  "icon": "tft7_item_shimmerscalegamblersblade.tft_set13.png",
  "apply_seasons": [16, 17]
}
```

**After** (CommunityDragon base 변형 값)
```json
{
  "name": "도박꾼의 칼날",
  "apiName": "TFT7_Item_ShimmerscaleGamblersBlade",
  "composition": [],
  "effects": {
    "AS": 55,
    "AttackSpeedGoldLimit": 30,
    "AttackSpeedPerGold": 0.009999999776482582,
    "ChanceToProc": 0.05999999865889549,
    "GoldPerProc": 1,
    "{46736b3f}": 4, "{b38e1643}": 20
  },
  "desc": "보유한 골드%i:goldCoins%마다 추가 공격 속도%i:scaleAS% @AttackSpeedPerGold*100@% 획득 (최대 @AttackSpeedGoldLimit@골드%i:goldCoins%)<br><br>기본 공격할 때마다 @ChanceToProc*100@% 확률로 @GoldPerProc@골드%i:goldCoins% 획득<br><br><tftitemrules>이번 게임에서 획득한 골드: @TFTUnitProperty.item:TFT_Item_GoldGenerated@</tftitemrules><br><br><tftitemrules>[고유 - 중복 적용 불가]</tftitemrules>",
  "icon": "tft7_item_shimmerscalegamblersblade.tft_set13.png",
  "apply_seasons": [16, 17]
}
```

### 3.2 거물의 갑옷

**After**
```json
{
  "name": "거물의 갑옷",
  "apiName": "TFT7_Item_ShimmerscaleMogulsMail",
  "composition": [],
  "effects": {
    "BaseHealthPerStack": 8,
    "BaseResistsPerStack": 1,
    "GoldAtFullStacks": 1,
    "GoldInterval": 11,
    "Health": 300,
    "StackCap": 35
  },
  "desc": "피해를 입으면 방어력 @BaseResistsPerStack@, 마법 저항력 @BaseResistsPerStack@, 체력 @BaseHealthPerStack@ 획득 (최대 @StackCap@회 중첩)<br><br>최대 중첩 시 @GoldAtFullStacks@골드%i:goldCoins% 획득. 이후 @GoldInterval@초마다 @GoldAtFullStacks@골드%i:goldCoins% 획득<br><br><tftitemrules>이번 게임에서 획득한 골드: @TFTUnitProperty.item:TFT_Item_GoldGenerated@</tftitemrules><br><br><tftitemrules>[고유 - 중복 적용 불가]</tftitemrules>",
  "icon": "tft7_item_shimmerscalemogulsmail.tft_set13.png",
  "apply_seasons": [16, 17]
}
```

### 3.3 검증 항목

- 아이콘 파일명은 양쪽 변형이 동일 (`tft7_item_shimmerscalegamblersblade.tft_set13.png` 등) → `resolveItemIcon` · `registerItemImages` 로직 수정 불필요.
- `apply_seasons: [16, 17]` 유지.
- `set16/tft_set16_items.json` 에 `_Revival` 엔트리 존재하나 loader dedupe 에서 common 이 우선되므로 간섭 없음. base apiName 과 `_Revival` apiName 은 서로 다른 키이므로 충돌도 없음.

---

## 4. alias 생성 로직 (찬란 UI 매칭)

### 4.1 위치

`src/app/api/lookup/route.ts` 의 `getItemMeta()` 내부, 각 canonical 엔트리 등록 직후.

### 4.2 의사코드

```ts
function registerRadiantAliases(
  apiName: string,
  meta: ItemMeta,
  dict: Record<string, ItemMeta>,
) {
  // canonical 두 형태에서 baseName 추출:
  //   TFT_Item_Radiant_{Base}     → Radiant prefix
  //   TFT_Item_Corrupted{Base}    → Corrupted prefix (Base 는 CamelCase)
  const radiantMatch = apiName.match(/^TFT_Item_Radiant_(.+)$/);
  const corruptedMatch = apiName.match(/^TFT_Item_Corrupted(.+)$/);
  const base = radiantMatch?.[1] ?? corruptedMatch?.[1];
  if (!base) return;

  // Riot 매치 API 가 돌려주는 것으로 확인된 raw 형태
  //   TFT5_Item_{Base}Radiant      ← 실제 관찰됨
  //   TFT_Item_{Base}Radiant       ← 안전망 (미발견이지만 추가 비용 없음)
  const aliases = [
    `TFT5_Item_${base}Radiant`,
    `TFT_Item_${base}Radiant`,
  ];
  for (const alias of aliases) {
    if (!dict[alias]) dict[alias] = meta;  // canonical 덮어쓰기 방지
  }
}
```

### 4.3 호출 지점

```ts
// getItemMeta() 내부 (공용 + 세트별 items 로드 루프)
cachedItemMeta[item.apiName] = { name, desc, icon };
registerRadiantAliases(item.apiName, cachedItemMeta[item.apiName], cachedItemMeta);
```

### 4.4 범위 선택 근거

- raw-data 조사 결과 찬란 raw ID 는 `TFT5_Item_{Base}Radiant` 하나로 일관됨.
- Corrupted 계열은 raw ID 가 이미 canonical `TFT_Item_Corrupted{Base}` 와 같아 별도 alias 불필요.
- `TFT_Item_Corrupted{Base}` 에서 추출한 base 도 같은 alias 로직에 들어가 `TFT5_Item_{Base}Radiant` 를 생성 — Riot API 가 Corrupted 를 찬란 suffix 로 반환할 가능성 안전망.

### 4.5 영향

- `itemMeta` dict 키 증가: 찬란 엔트리 약 31개 × alias 2 = 최대 약 +62 키. 응답 payload 증가 미미.
- `src/app/lookup/page.tsx` 수정 불필요 — `itemMeta?.[rawRiotId]` 가 자연스럽게 hit.

---

## 5. 영향받는 파일

### 5.1 수정 대상

| 파일 | 변경 |
|---|---|
| `public/data/common/tft_common_items.json` | 도박꾼의 칼날·거물의 갑옷 엔트리 교체 (§3) |
| `src/lib/simulator/systems/item.ts` | `FORCE_ARTIFACT` set: `_Revival` → base apiName 2건 |
| `src/app/api/lookup/route.ts` | `registerRadiantAliases()` 추가 및 호출 (§4) |

### 5.2 점검 대상 (Plan 실행 시 repo 전체 grep)

| 대상 | 점검 이유 |
|---|---|
| `Shimmerscale.*_Revival` 문자열 하드코딩 | 누락 없는 일괄 교체 |
| `tests/golden/` 스냅샷 | Shimmerscale 두 아이템 포함 시나리오는 값 변경으로 갱신 필요 |
| `tests/unit/*.test.ts` | `_Revival` apiName 참조 단위 테스트 |

---

## 6. 테스트 계획

### 6.1 단위 테스트

- `registerRadiantAliases()` 로직:
  - `TFT_Item_Radiant_BlueBuff` 입력 → `TFT5_Item_BlueBuffRadiant`, `TFT_Item_BlueBuffRadiant` alias 생성.
  - `TFT_Item_CorruptedJeweledGauntlet` 입력 → `TFT5_Item_JeweledGauntletRadiant` alias 생성.
  - 일반 아이템 (`TFT_Item_BFSword`) 입력 → alias 없음.
  - 기존 canonical 이 이미 dict 에 있을 때 덮지 않음.

### 6.2 회귀 검증

- `pnpm lint && pnpm typecheck && pnpm build` 통과.
- 골든 스냅샷 값 변경 있으면 값 검토 후 갱신.

### 6.3 수동 QA

1. 전적검색에서 찬란 아이템 포함 매치 → 아이콘·툴팁 표시.
2. 전적검색에서 도박꾼의 칼날 또는 거물의 갑옷 포함 매치 → 아이콘·툴팁 표시.
3. 가상 대전 → 시뮬레이션 탭 복원 → 세 종류 아이템이 유닛 슬롯에 남아 있음.
4. 빌더 유물 탭 툴팁 → 인게임 값과 일치 (CommunityDragon base 값).

---

## 7. 롤백 / 리스크

### 7.1 롤백

- 모든 변경이 git 추적되는 소스·데이터 파일. DB 마이그레이션 없음, 런타임 상태 변경 없음. 문제 시 `git revert` 한 번으로 복구.

### 7.2 리스크

| 리스크 | 대응 |
|---|---|
| `_Revival` apiName 을 하드코딩한 파일 누락 | 수정 전 repo 전체 grep 으로 선발견 |
| 골든 스냅샷 변동 | 예상되는 변경. 값 검토 후 스냅샷 업데이트 |
| common JSON 에 canonical 없는 찬란 변형 (예: `LocketOfTheIronSolariRadiant`) | alias 는 canonical 엔트리에만 붙음. 미지원 아이템은 기존 "미지원" 라벨 유지 |
| Riot API 가 추후 다른 형식의 raw ID 반환 시작 | 미사용 alias 형식이 쌓여도 비용 미미. 새 형식 발견 시 alias 리스트 추가 |

---

## 8. 완료 후 다음 단계

- 본 Spec 승인 후 `superpowers:writing-plans` 스킬로 구현 플랜 작성.
- 구현 플랜에는 "repo 전체 grep → 일괄 교체 → lint/typecheck/build → 수동 QA" 순의 task breakdown 명시.
