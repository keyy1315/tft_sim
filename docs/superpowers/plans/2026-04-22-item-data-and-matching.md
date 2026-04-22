# 아이템 데이터 교정 + 전적검색 매칭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전적검색 UI 에서 찬란 아이템 + 도박꾼의 칼날/거물의 갑옷 아이콘·툴팁이 표시되도록 하고, 후자 두 아이템의 효과 스탯을 현재 인게임 값으로 교정한다.

**Architecture:**
(1) `public/data/common/tft_common_items.json` 에서 Shimmerscale 두 아이템을 `_Revival` 변형 → base 변형으로 apiName·effects·desc 교체.
(2) 그 apiName 을 참조하는 `FORCE_ARTIFACT` set 갱신.
(3) 순수 함수 `getRiotIdAliases()` 를 신규 모듈에 추가, 전적검색 API 의 `getItemMeta()` 가 canonical 엔트리 등록 시 Riot 매치 API 의 raw ID alias (찬란 suffix 형식) 를 미러 등록하도록 통합.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-22-item-data-and-matching-design.md`

---

## File Structure

| 파일 | 역할 | 상태 |
|---|---|---|
| `src/lib/analysis/itemIdAliases.ts` | 순수 함수 `getRiotIdAliases(canonical) → string[]` — canonical 찬란/타락 아이템 apiName 을 받아 Riot 매치 API 의 raw ID 변형 목록 반환 | **신규** |
| `tests/unit/itemIdAliases.test.ts` | `getRiotIdAliases()` 단위 테스트 | **신규** |
| `src/app/api/lookup/route.ts` | `getItemMeta()` 에서 canonical 엔트리 등록 직후 `getRiotIdAliases()` 로 alias 키 미러 등록 | **수정** |
| `public/data/common/tft_common_items.json` | 도박꾼의 칼날·거물의 갑옷 엔트리를 base 변형 apiName/effects/desc 로 교체 | **수정** |
| `src/lib/simulator/systems/item.ts` | `FORCE_ARTIFACT` set 에서 `_Revival` apiName 2건을 base apiName 으로 교체 | **수정** |

범위 밖 (변경 금지):
- `public/data/set16/tft_set16_items.json` 의 Shimmerscale `_Revival` 엔트리 — Set 16 은 기본 레벨 지원 대상이 아니며 loader 의 dedupe 에서 common 이 우선되므로 Set 17 동작에 무영향.
- matchAdapter · coverageChecker · imageMap — 현 로직 그대로 동작.

---

## Task 1: `getRiotIdAliases()` 의 실패하는 테스트 작성

**Files:**
- Create: `tests/unit/itemIdAliases.test.ts`

- [ ] **Step 1: 테스트 파일 생성**

```typescript
// tests/unit/itemIdAliases.test.ts
import { describe, it, expect } from 'vitest';
import { getRiotIdAliases } from '@/lib/analysis/itemIdAliases';

describe('getRiotIdAliases', () => {
  it('찬란 canonical (TFT_Item_Radiant_X) → Riot raw ID alias 2종 반환', () => {
    const aliases = getRiotIdAliases('TFT_Item_Radiant_BlueBuff');
    expect(aliases).toEqual([
      'TFT5_Item_BlueBuffRadiant',
      'TFT_Item_BlueBuffRadiant',
    ]);
  });

  it('타락 canonical (TFT_Item_CorruptedX) → Riot raw ID alias 2종 반환', () => {
    const aliases = getRiotIdAliases('TFT_Item_CorruptedJeweledGauntlet');
    expect(aliases).toEqual([
      'TFT5_Item_JeweledGauntletRadiant',
      'TFT_Item_JeweledGauntletRadiant',
    ]);
  });

  it('찬란/타락이 아닌 canonical → 빈 배열', () => {
    expect(getRiotIdAliases('TFT_Item_BFSword')).toEqual([]);
    expect(getRiotIdAliases('TFT7_Item_ShimmerscaleGamblersBlade')).toEqual([]);
    expect(getRiotIdAliases('TFT17_Item_PsyOps_DroneMod_Radiant')).toEqual([]);
  });

  it('잘못된 형식 입력 → 빈 배열', () => {
    expect(getRiotIdAliases('')).toEqual([]);
    expect(getRiotIdAliases('garbage')).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행으로 실패 확인**

Run: `pnpm vitest run tests/unit/itemIdAliases.test.ts`
Expected: `Error: Cannot find module '@/lib/analysis/itemIdAliases'` 또는 `getRiotIdAliases is not defined`.

- [ ] **Step 3: 커밋**

```bash
git add tests/unit/itemIdAliases.test.ts
git commit -m "test(analysis): getRiotIdAliases 실패하는 단위 테스트 추가"
```

---

## Task 2: `getRiotIdAliases()` 최소 구현

**Files:**
- Create: `src/lib/analysis/itemIdAliases.ts`

- [ ] **Step 1: 함수 구현**

```typescript
// src/lib/analysis/itemIdAliases.ts
/**
 * Canonical 찬란/타락 아이템 apiName 에 대응하는 Riot 매치 API raw ID 변형 목록을 반환한다.
 *
 * Riot 매치 API 는 찬란 아이템을 `TFT5_Item_{Base}Radiant` 형식으로 반환하지만
 * 우리 JSON 의 canonical 키는 `TFT_Item_Radiant_{Base}` 형식.
 * 전적검색 UI 가 raw Riot ID 로 itemMeta 를 조회할 수 있도록 alias 를 노출한다.
 *
 * 찬란/타락이 아닌 일반 아이템은 빈 배열을 반환한다.
 */
export function getRiotIdAliases(canonicalApiName: string): string[] {
  const radiantMatch = canonicalApiName.match(/^TFT_Item_Radiant_(.+)$/);
  const corruptedMatch = canonicalApiName.match(/^TFT_Item_Corrupted(.+)$/);
  const base = radiantMatch?.[1] ?? corruptedMatch?.[1];
  if (!base) return [];

  return [
    `TFT5_Item_${base}Radiant`,
    `TFT_Item_${base}Radiant`,
  ];
}
```

- [ ] **Step 2: 테스트 재실행으로 통과 확인**

Run: `pnpm vitest run tests/unit/itemIdAliases.test.ts`
Expected: 모든 케이스 PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/analysis/itemIdAliases.ts
git commit -m "feat(analysis): getRiotIdAliases 구현 — 찬란/타락 canonical → Riot raw ID alias"
```

---

## Task 3: `getItemMeta()` 에 alias 등록 통합

**Files:**
- Modify: `src/app/api/lookup/route.ts`

- [ ] **Step 1: import 추가**

파일 상단 import 섹션 (line 12 근처, `resolveDescription` 다음) 에 추가:

```typescript
import { getRiotIdAliases } from '@/lib/analysis/itemIdAliases';
```

- [ ] **Step 2: `getItemMeta()` 내부에 alias 등록 헬퍼 정의 및 호출**

현재 `getItemMeta()` 함수 (line 127–159) 를 아래로 교체:

```typescript
let cachedItemMeta: Record<string, ItemMeta> | null = null;

function registerItemWithAliases(
  apiName: string,
  meta: ItemMeta,
  dict: Record<string, ItemMeta>,
): void {
  dict[apiName] = meta;
  for (const alias of getRiotIdAliases(apiName)) {
    // canonical 로 이미 등록된 키는 덮지 않는다 (정확도 우선).
    if (!dict[alias]) dict[alias] = meta;
  }
}

function getItemMeta(): Record<string, ItemMeta> {
  if (cachedItemMeta) return cachedItemMeta;
  cachedItemMeta = {};
  const dataDir = path.join(process.cwd(), 'public/data');

  const commonPath = path.join(dataDir, 'common/tft_common_items.json');
  if (fs.existsSync(commonPath)) {
    const common = JSON.parse(fs.readFileSync(commonPath, 'utf-8'));
    for (const item of common.items ?? common) {
      const meta: ItemMeta = {
        name: item.name,
        desc: formatDesc(item.desc ?? '', item.effects ?? {}),
        icon: resolveItemIcon(item.apiName, item.icon ?? ''),
      };
      registerItemWithAliases(item.apiName, meta, cachedItemMeta);
    }
  }

  for (const p of ['tft_set17_items.json', 'set16/tft_set16_items.json']) {
    const fp = path.join(dataDir, p);
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    for (const item of data.items ?? data) {
      if (cachedItemMeta[item.apiName]) continue;
      const meta: ItemMeta = {
        name: item.name,
        desc: formatDesc(item.desc ?? '', item.effects ?? {}),
        icon: resolveItemIcon(item.apiName, item.icon ?? ''),
      };
      registerItemWithAliases(item.apiName, meta, cachedItemMeta);
    }
  }

  return cachedItemMeta;
}
```

- [ ] **Step 3: typecheck 로 import/타입 통과 확인**

Run: `pnpm typecheck`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/lookup/route.ts
git commit -m "feat(lookup): 찬란 아이템 Riot raw ID alias 자동 등록

getItemMeta 가 canonical 엔트리 등록 시 getRiotIdAliases 로
Riot 매치 API raw ID 변형을 같은 meta 로 미러 등록한다.
전적검색 UI 가 수정 없이 raw ID 로 itemMeta 조회 가능."
```

---

## Task 4: 도박꾼의 칼날 / 거물의 갑옷 데이터 base 변형으로 교체

**Files:**
- Modify: `public/data/common/tft_common_items.json`

- [ ] **Step 1: 거물의 갑옷 엔트리 교체**

line 2543–2561 (거물의 갑옷 블록) 를 아래로 교체:

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
      "apply_seasons": [
        16,
        17
      ]
    },
```

- [ ] **Step 2: 도박꾼의 칼날 엔트리 교체**

line 2618–2638 (도박꾼의 칼날 블록) 를 아래로 교체:

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
        "{46736b3f}": 4,
        "{b38e1643}": 20
      },
      "desc": "보유한 골드%i:goldCoins%마다 추가 공격 속도%i:scaleAS% @AttackSpeedPerGold*100@% 획득 (최대 @AttackSpeedGoldLimit@골드%i:goldCoins%)<br><br>기본 공격할 때마다 @ChanceToProc*100@% 확률로 @GoldPerProc@골드%i:goldCoins% 획득<br><br><tftitemrules>이번 게임에서 획득한 골드: @TFTUnitProperty.item:TFT_Item_GoldGenerated@</tftitemrules><br><br><tftitemrules>[고유 - 중복 적용 불가]</tftitemrules>",
      "icon": "tft7_item_shimmerscalegamblersblade.tft_set13.png",
      "apply_seasons": [
        16,
        17
      ]
    },
```

- [ ] **Step 3: JSON 구문 유효성 확인**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/data/common/tft_common_items.json', 'utf-8')); console.log('OK')"`
Expected: `OK` 출력.

- [ ] **Step 4: 교체 후 값 확인 (grep)**

Run: `grep -A3 '"apiName": "TFT7_Item_ShimmerscaleGamblersBlade"' public/data/common/tft_common_items.json`
Expected: `AttackSpeedGoldLimit` 에 `30`, `AttackSpeedPerGold` 에 `0.009999999776482582`, `ChanceToProc` 에 `0.05999999865889549` 가 포함됨.

Run: `grep -A3 '"apiName": "TFT7_Item_ShimmerscaleMogulsMail"' public/data/common/tft_common_items.json`
Expected: `BaseHealthPerStack: 8`, `GoldAtFullStacks: 1`, `GoldInterval: 11`, `Health: 300` 포함.

- [ ] **Step 5: 커밋**

```bash
git add public/data/common/tft_common_items.json
git commit -m "data(items): 도박꾼의 칼날·거물의 갑옷 인게임 값으로 교정

_Revival 변형(과거 이벤트 값) → CommunityDragon base 변형으로 apiName/
effects/desc 교체. Riot 매치 API 가 base ID 를 반환하므로 매칭까지 복원."
```

---

## Task 5: `FORCE_ARTIFACT` set 의 apiName 갱신

**Files:**
- Modify: `src/lib/simulator/systems/item.ts:85–96`

- [ ] **Step 1: `_Revival` 두 apiName 을 base 로 교체**

현재 `FORCE_ARTIFACT` set (line 85–96) 중 line 87–88 을 교체:

**Before (line 87–88)**
```typescript
  'TFT7_Item_ShimmerscaleMogulsMail_Revival',       // 거물의 갑옷
  'TFT7_Item_ShimmerscaleGamblersBlade_Revival',    // 도박꾼의 칼날
```

**After**
```typescript
  'TFT7_Item_ShimmerscaleMogulsMail',                // 거물의 갑옷
  'TFT7_Item_ShimmerscaleGamblersBlade',             // 도박꾼의 칼날
```

- [ ] **Step 2: repo 전체에 `_Revival` 하드코딩 참조가 남아 있지 않은지 확인**

Run: `grep -rn 'ShimmerscaleGamblersBlade_Revival\|ShimmerscaleMogulsMail_Revival' src tests`
Expected: 출력 없음 (빈 결과).

만약 결과가 있으면 해당 파일을 열어 base 버전으로 교체 후 이 Task 에 추가 step 으로 기록.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/simulator/systems/item.ts
git commit -m "refactor(item): FORCE_ARTIFACT set apiName 을 base 변형으로 갱신

데이터 교체 (Task 4) 에 맞춰 Shimmerscale 2건의 _Revival → base 로 전환."
```

---

## Task 6: Lint / Typecheck / Build 전체 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: 에러 0, 경고 기존 baseline 유지 (신규 경고 없음).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: 에러 0.

- [ ] **Step 3: 전체 유닛 테스트**

Run: `pnpm vitest run`
Expected: 모든 테스트 PASS. 골든 스냅샷은 Shimmerscale 미포함이므로 변동 없음.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: 성공. Next.js 15 빌드 산출물 생성.

- [ ] **Step 5: 실패 시 대응**

4개 중 실패가 있으면 원인 파악 후 해당 Task 로 돌아가 수정. 모두 통과 시 다음 Task.

- [ ] **Step 6: 검증 성공 시 — 추가 커밋 불필요 (이 Task 는 체크 전용)**

---

## Task 7: 수동 QA 체크리스트

**Files:** 없음 (사람이 수행)

사전 조건: `pnpm dev` 로 로컬 서버 구동. 테스트 계정 준비 (찬란 아이템 또는 Shimmerscale 두 아이템 중 하나 이상을 사용한 매치 이력이 있는 계정 권장).

- [ ] **Step 1: 전적검색 — 찬란 아이템 아이콘·툴팁 표시**

절차:
1. `/lookup` 페이지 진입.
2. 찬란 아이템을 사용한 매치가 있는 소환사명#태그 검색.
3. 매치 카드에서 찬란 아이템 장착 유닛 확인.

Expected: 찬란 아이템 아이콘이 그레이 `?` 플레이스홀더가 아니라 실제 이미지로 렌더링됨. 호버 시 툴팁에 아이템 이름(예: "찬란한 푸른 파수꾼") 과 설명 표시.

- [ ] **Step 2: 전적검색 — 도박꾼의 칼날 / 거물의 갑옷 표시**

해당 아이템 포함 매치를 찾거나, 동료/친구 계정을 검색해 확장(▶) 하여 다른 참가자 인벤토리에서 해당 아이템 확인.

Expected: 아이콘 표시 + 툴팁에 이름("도박꾼의 칼날" / "거물의 갑옷") 과 **새로 교체된 인게임 값** 설명 표시.

- [ ] **Step 3: 가상 대전 → 전투 시뮬레이션 복원**

절차:
1. 찬란 / 도박꾼 / 거물 포함 매치에서 "가상 대전 분석" 클릭.
2. 복원된 시뮬레이션 탭 진입.
3. 해당 유닛의 아이템 슬롯 확인.

Expected: 세 종류 아이템 모두 유닛 슬롯에 유지된 채로 복원됨.

- [ ] **Step 4: 빌더 유물 탭 — 스탯 확인**

절차:
1. `/simulator` 진입.
2. 챔피언 선택 → 아이템 그리드의 `유물` 탭.
3. 도박꾼의 칼날 / 거물의 갑옷 아이콘에 호버.

Expected (도박꾼의 칼날 툴팁):
- "보유한 골드마다 추가 공격 속도 1% 획득 (최대 30골드)"
- "기본 공격할 때마다 6% 확률로 1골드 획득"

Expected (거물의 갑옷 툴팁):
- "피해를 입으면 방어력 1, 마법 저항력 1, 체력 8 획득 (최대 35회 중첩)"
- "최대 중첩 시 1골드 획득. 이후 11초마다 1골드 획득"

- [ ] **Step 5: QA 결과 기록**

모두 통과하면 PR 설명(또는 완료 보고) 에 체크리스트 복사. 실패 시 이슈 생성 후 원인 분석.

---

## Task 8: 최종 정리 (선택) — 캐시 busting 확인

**Files:** 없음

- [ ] **Step 1: `getItemMeta` 캐시 검토**

`cachedItemMeta` 는 모듈 레벨 캐시라 서버 프로세스 재시작 시 자동 재생성. 프로덕션에서 배포 후 첫 응답이 올바른지 확인.

- [ ] **Step 2: 클라이언트 `useLookupStore` zustand persist 영향 검토**

`src/store/lookupSlice.ts` 가 itemMeta 를 persist 하면 이전 응답이 캐시될 가능성 있음. 확인 후 필요 시 persist 키에서 itemMeta 제외하거나 버전 bump.

Run: `grep -n 'persist\|itemMeta' src/store/lookupSlice.ts`
Expected: itemMeta 가 persist 대상에 포함되지 않음. 포함된 경우 이슈로 기록 후 후속 작업.

---

## Rollback

모든 변경이 git 추적 소스·데이터 파일이므로 문제 발생 시:

```bash
git log --oneline -10
git revert <commit-sha>  # 또는 여러 커밋을 한 번에: git revert <first>^..<last>
```

DB / 런타임 상태 변경 없음, 마이그레이션 없음.
