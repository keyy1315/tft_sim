# 증강(Augment) 데이터 관리 가이드

> 작성: 2026-04-29 (17.2 fetch 회귀 사고 후 정착)
> 적용 범위: TFT 패치마다 CDragon 데이터를 가져올 때

## ⚠️ 핵심 규칙: 현재 데이터 절대 덮어쓰지 말 것

**`public/data/tft_set17_augments.json` 은 사용자 검수 결과(disable 분류, 한글 이름 보정,
fallback 아이콘 등)가 누적된 파일이다.** CDragon raw 만으로 통째로 regenerate 하면
다음과 같은 사용자 작업이 통째로 사라진다:

- `disable` 필드 (시즌 미사용 분류, 250+ entries)
- 은총 퀘스트 한글 rename (`아우솔의 은총 퀘스트 I/II/III` 등)
- Riot 누락 raw 의 fallback 아이콘 경로
- 사용자 수동 복원 entry (예: `TFT11_Augment_Buildabud` — CDragon 에서 빠진
  prismatic "친구 만들기")

### 회귀 사례 — 4-29 17.2 fetch
`scripts/fetch-set17.mjs` 가 `extractAugments()` 결과로 augments JSON 을 통째로
덮어쓰면서:
- 사용자가 4-15, 4-23 에 분류한 `inSet17:false` 252 entries 손실
- 빌더 모달에 시즌 미사용 augment 250+종이 다시 노출
- `b891f18` 의 아우솔 quest rename + Missing-T2 fallback 아이콘 손실

→ **PR #47 + 후속 hotfix 로 수동 복구. 회귀 방지 로직을 fetch script 에 영구 추가.**

---

## fetch 시 보존 로직 (`scripts/fetch-set17.mjs`)

```js
function mergeDisableClassification(newAugments, existingPath) {
  // 1. 기존 JSON 이 있으면 disable 값을 apiName 별로 추출
  // 2. 신규 entry 마다:
  //    - apiName 이 기존에 있으면 → 기존 disable 값 그대로 유지
  //    - 신규 entry → disable=false (default 활성)
  // 3. 마찬가지로 name / icon 도 사용자 수정 흔적이 있으면 보존
}
```

**fetch 후 반드시 수동 검토할 항목**:
1. **신규 entry 일괄 review** — 콘솔 로그의 `신규 N개 (default false)` 카운트
   확인 후 lolchess.gg/augments/set17 에서 visible 여부 검수
2. **사라진 entry** — CDragon 에서 빠진 augment. 사용자 검수 결과 (override
   table, fallback icon) 가 있는 항목은 데이터 자체를 수동 보존 권장
3. **이름이 raw template 으로 돌아온 항목** — 한글화 rename 다시 적용

---

## 📦 증강 이미지 데이터

### 기본 동작 (`src/data/imageMap.ts` `getAugmentImage`)

```ts
// ASSETS/Maps/TFT/Icons/Augments/Hexcore/Xxx.TFT_Set17.tex
// → https://raw.communitydragon.org/latest/game/assets/maps/tft/icons/augments/hexcore/xxx.tft_set17.png
```

CDragon CDN 에서 직접 로드 — **로컬 캐싱 없음**. 패치 직후 latest branch 가
아직 갱신되지 않은 경우 (404) 가 가장 흔한 문제.

### PostLaunchAugments — PBE branch fallback

17.2 패치 중 추가된 augment (예: `LeonaCarry` `LeonaHero_I.TFT_Set17_PostLaunchAugments.tex`)
는 latest branch 미반영. 파일명에 `postlaunchaugments` 가 포함되면 **PBE branch URL** 로
자동 redirect:

```ts
if (lower.includes('postlaunchaugments')) {
  return `https://raw.communitydragon.org/pbe/game/${lower}`;
}
return `https://raw.communitydragon.org/latest/game/${lower}`;
```

> latest 브랜치가 17.2 LIVE 와 sync 되면 이 분기 제거 가능 (CDragon 대시보드에서
> Set 17.2 PBE → Production 승격 일정 확인).

### Fallback 아이콘 — 컴포넌트 레벨

`AugmentIcon` 컴포넌트가 `next/image` 의 `onError` 핸들러로 자동 swap:

- 1차 시도 — raw `icon` 경로의 CDragon URL
- onError → `Hexcore/Missing-T2.tex` (Riot stock "icon not provided" asset)

또한 raw 데이터 자체에 fallback 아이콘을 명시할 수도 있다:
- `b891f18` 의 아우솔 quest 3종 → JSON 의 `icon` 필드 자체를 `Missing-T2` 로 지정

### CDragon 에서 직접 다운로드해야 하는 경우

champion square 같은 자동 소환 unit 이미지는 CDragon URL 대신 **로컬 PNG** 가
필요 (`public/data/images/tft_set17_champions/`). 4-29 사례:
- `darkstar_fakeunit_square.tft_set17.png` (소형 블랙홀, 60KB)
- `enemy_aatrox_square.tft_set17.png` (태고족 우두머리, 19KB)

augment 의 경우 PostLaunchAugments fallback 으로 충분 — 로컬 다운로드는 마지막 수단.

---

## 🌟 은총(Boon) 증강 — Set 17 GodAugment 시스템

Set 17 은 12 신의 은총 시스템. 각 은총 본체 + 진행 보상(quest) + 변종으로 구성:

### 분류 규칙

| 항목 | tier | 설명 |
|---|---|---|
| `*GodAugment` 본체 | `boon` | 은총 자체 (예: `AurelionSolGodAugment`) |
| `*GodAugment_BoonOf*` 변종 | `boon` | 부활의 은총 / 피의 대가 등 |
| `*GodAugment_Scrapper` (KayleGod) | `boon` | 신성한 성기사단 변종 |
| `*GodAugment_SmallQuest/MediumQuest/LargeQuest` | `boon` | 은총 후 진행 보상 3단계 |
| `*GodAugment_*` 일반 변종 (예: `BloodPrice`) | `gold` | gold 티어 일반 증강 |

### tier 매핑은 어디서?

1. raw 태그 `{719abef1}` = `boon` (`src/types/index.ts AUGMENT_TIER_TAGS`)
2. raw 에 태그 누락 시 `APINAME_TIER_OVERRIDES` (`src/lib/simulator/systems/augment.ts`) 가
   apiName 단위로 명시

### 아우솔 은총 퀘스트 3종 — 특별 케이스

CDragon raw 의 `name` 필드가 효과 설명 template 으로 채워져 있어 빌더 UI 에서
가독성이 떨어진다:

```json
"name": "아군이 공격력 및 주문력을 @SmallQuestADAP@ 얻습니다."
```

수동 보정:

```json
"name": "아우솔의 은총 퀘스트 I",
"desc": "아군이 공격력 및 주문력을 @SmallQuestADAP@ 얻습니다.",
"icon": "ASSETS/Maps/TFT/Icons/Augments/Hexcore/Missing-T2.tex"
```

3종 모두 `desc` 에 원본 효과 설명을 보존하여 hover tooltip 에서 확인 가능.

---

## 🚫 `disable` 필드

### 의미

`RawAugment.disable?: boolean`

- `true` → 시즌 미사용. builder 모달 / 시뮬 풀에서 제외
- `false` 또는 누락 → 활성 (default)

> 4-29 이전엔 `inSet17?: boolean` (반대 의미). semantic 모호로 (set17 파일 안에
> inSet17 가 있는 게 어색) `disable` 로 rename + 의미 반전.

### 분류 출처

1. **lolchess.gg/augments/set17 canonical** — 매 fetch 후 자동 비교 권장
2. **수동 force disable** (`src/data/disabledContent.ts` `DISABLED_AUGMENT_API_NAMES`) —
   raw 데이터 갱신과 무관하게 강제 차단 (예: 시뮬과 무관한 메타 augment)

### 두 단계 필터

```ts
// loader.ts loadAugments()  ─────── 빌더 selector 용
//   → DISABLED_AUGMENT_API_NAMES 만 강제 차단
//   → disable=true 는 selector 의 "미사용 포함" 체크박스가 직접 제어
const filtered = data.augments.filter(a => !isDisabledAugment(a.apiName));

// serverCatalogs.ts loadServerCatalogs()  ─────── 서버 검증 용
//   → disable=true 도 차단 (검증 단계는 미사용 augment 거부)
const augments = augmentsRaw.filter(
  a => a.disable !== true && !isDisabledAugment(a.apiName),
);
```

### `disabledContent.ts` 에 추가하는 기준

`disable=true` 만으로 충분치 않은 경우:
- raw 데이터 **갱신 후에도 강제 차단** 해야 하는 항목
- 새로 fetch 된 entry (이전 JSON 에 없던 apiName) 는 default false 가 되므로,
  이런 경우 force disable 필요

**현재 등록 5종**:
1. `TFT17_Augment_Concentration` — 17.2 raw 추가 / 게임 풀 미반영
2. `TFT17_Augment_Timebreaker_Timestream` — 동
3. `TFT17_Augment_EmergencySupplies` — 동 (이전 'Psionic_' 접두사 오타로 미적용 회귀)
4. `TFT17_Augment_DarkStar_NeutronStar` — 동
5. `TFT17_Augment_ShieldTank_DivinePaladins` — 동

> **apiName 오타 가드**: `tests/unit/data/augments-disable-filter.test.ts` 가
> DISABLED_AUGMENT_API_NAMES 의 모든 apiName 이 raw JSON 에 실제 존재하는지 검증.
> 오타 시 즉시 실패 → `Psionic_EmergencySupplies` 같은 회귀 재발 방지.

---

## 회귀 가드 (`tests/unit/data/augments-disable-filter.test.ts`)

7 cases:
1. **모든 entry 가 boolean `disable`** — fetch 시 default false 자동 부여 검증
2. **disable=false 가 충분 (>150)** — 통째로 false 되는 사고 방지
3. **`loadServerCatalogs()` 결과 disable!==true 만** — 서버 필터 회귀 가드
4. **결과가 DISABLED_AUGMENT_API_NAMES 와 disjoint**
5. **17.2 신규 disable 5종 제외 검증** — EmergencySupplies 오타 회귀 가드
6. **DISABLED_AUGMENT_API_NAMES 의 apiName 모두 raw 존재** — apiName 오타 가드
7. **lolchess hidden 4종 제외** — SnipersNest, Weightlifting, TourOfTheGalaxy, ShepherdAugment

---

## 패치 fetch 체크리스트

새 패치 (예: 17.3) 가져올 때:

- [ ] **fetch 직전**: `git status` 로 augments JSON unstaged 변경 없는지 확인
- [ ] `pnpm fetch:set17` (또는 `node scripts/fetch-set17.mjs`)
- [ ] 콘솔 로그의 `disable 보존: N개 기존 / M개 신규` 확인
- [ ] `lolchess.gg/augments/set17` 와 신규 entry 대조 → 게임에 안 보이면 disable=true
- [ ] **이미지 검증**: 빌더 모달 열어서 신규 augment 아이콘 정상 로드 확인.
      404 시 `imageMap.ts` 에 PBE fallback 추가 또는 로컬 PNG 다운로드
- [ ] **이름 회귀 점검**: raw template (`@VarName@` 포함) 인 entry 식별
      → 한글 rename 적용
- [ ] `pnpm vitest run tests/unit/data/augments-disable-filter.test.ts` 통과
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 셋 다 통과

---

## 관련 파일 인덱스

| 파일 | 역할 |
|---|---|
| `public/data/tft_set17_augments.json` | augment raw + 사용자 검수 결과 (disable / name / icon) |
| `src/types/index.ts` | `RawAugment` 타입 (`disable?: boolean`), `AUGMENT_TIER_TAGS` |
| `src/data/loader.ts` | client 측 `loadAugments` (DISABLED 만 필터) |
| `src/lib/validation/serverCatalogs.ts` | server 측 (disable + DISABLED 둘 다 필터) |
| `src/data/disabledContent.ts` | `DISABLED_AUGMENT_API_NAMES` 강제 차단 목록 |
| `src/lib/simulator/systems/augment.ts` | tier override (`APINAME_TIER_OVERRIDES`) |
| `src/data/imageMap.ts` | `getAugmentImage` (CDragon URL + PBE fallback) |
| `src/components/builder/AugmentIcon.tsx` | onError fallback 컴포넌트 |
| `src/components/builder/AugmentSelector.tsx` | "미사용 포함" 체크박스 (`showInactive` state) |
| `scripts/fetch-set17.mjs` | fetch + `mergeDisableClassification` 보존 로직 |
| `tests/unit/data/augments-disable-filter.test.ts` | 회귀 가드 7 cases |
