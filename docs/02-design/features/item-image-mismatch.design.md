# Design: 아이템 이미지-이름-설명 매칭 불일치 수정 (Issue #4)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 아이템 이미지 매칭 불일치 수정 |
| Plan 참조 | `docs/01-plan/features/item-image-mismatch.plan.md` |
| 작성일 | 2026-03-23 |
| 상태 | Design |

---

## 1. 조사 결과

### 1.1 불일치 분류

CommunityDragon 원본 데이터와 CDN 전수 검증 결과, 불일치 아이템은 2가지 유형으로 분류됨.

#### 유형 A: 찬란한 아이템 icon 불일치 (수정 가능, 10개)

세트16에서 아이템 이름이 대거 변경되었으나, CommunityDragon의 nameId/icon 경로는 옛날 이름 기준으로 남아있음.
우리 JSON 파싱 시 이 교차 매핑을 올바르게 반영하지 못해 icon이 뒤섞임.

| # | 우리 apiName | 한글명 | 현재 잘못된 icon | CD 올바른 icon | 로컬 존재 |
|---|-------------|--------|----------------|---------------|:---------:|
| 1 | `CorruptedRedemption` | 찬란한 정령의 형상 | `guardianangelradiant` | `tft_item_spiritvisagerr.tft_tft14_5.png` | X |
| 2 | `Radiant_TitansResolve` | 찬란한 거인의 결의 | `leviathanradiant` | `tft5_item_titansresolveradiant.tft_set13.png` | O |
| 3 | `Radiant_VoidStaff` | 찬란한 공허의 지팡이 | `spectralgauntletradiant` | `tft5_item_statikkshivradiant.tft_set13.png` | X |
| 4 | `Radiant_FrozenHeart` | 찬란한 굳건한 심장 | `frozenheartradiant` | `tft5_item_nightharvesterradiant.tft_set13.png` | O |
| 5 | `Radiant_NashorsBloodrazor` | 찬란한 내셔의 이빨 | `titansresolveradiant` | `tft5_item_leviathanradiant.tft_set13.png` | O |
| 6 | `Radiant_NightHarvester` | 찬란한 밤의 끝자락 | `nightharvesterradiant` | `tft5_item_guardianangelradiant.tft_set13.png` | O |
| 7 | `Radiant_RedBuff` | 찬란한 붉은 덩굴정령 | `bramblevestradiant` | `tft5_item_rapidfirecannonradiant.tft_set13.png` | O |
| 8 | `Radiant_GuardianAngel` | 찬란한 수호자의 맹세 | `guardianangelradiant` | `tft5_item_frozenheartradiant.tft_set13.png` | O |
| 9 | `Radiant_Evenshroud` | 찬란한 저녁갑주 | `frozenheartradiant` | `tft5_item_spectralgauntletradiant.tft_set13.png` | O |
| 10 | `Radiant_KrakenSlayer` | 찬란한 크라켄의 분노 | `rapidfirecannonradiant` | `tft_item_krakenslayerradiant.tft_tft14_5.png` | X |

- **다운로드 필요**: 3개 (spiritvisagerr, statikkshivradiant, krakenslayerradiant)
- **이미 로컬에 있음**: 7개 (JSON icon 필드만 수정하면 됨)
- **CDN 전부 200 OK**

#### 유형 B: 필트오버/빌지워터 아이콘 공유 (라이엇 의도, 5개)

라이엇 원본 데이터(`squareIconPath`) 자체에서 다른 아이템의 아이콘을 가리킴.
CDN에 고유 이미지 없음 (404). 게임 내에서도 동일 아이콘 공유.

| 우리 apiName | 공유하는 아이콘 |
|-------------|---------------|
| `TFT16_Item_Piltover_EchoEngine` (메아리 엔진) | UnstableCore 아이콘 |
| `TFT16_Item_Bilgewater_FirstMatesFlintlock` (일등 항해사의 화승총) | DreadwayCannon 아이콘 |
| `TFT16_Item_Bilgewater_TheList` (보물 태풍) | JollyRoger 아이콘 |
| `TFT16_Item_Bilgewater_CaptainsBrew` (선장의 비법) | JollyRoger 아이콘 |
| `TFT16_Item_Bilgewater_MyronsDark` (보물 태풍) | JollyRoger 아이콘 |

→ 라이엇이 의도적으로 아이콘을 공유. 수정 불가, Issue에 문서화.

---

## 2. 수정 대상 (유형 A — 10개)

### 2.1 이미지 다운로드 (3개)

CommunityDragon CDN에서 로컬에 없는 이미지 3개를 `public/data/images/radiant/`에 다운로드:

```bash
# 1. 찬란한 정령의 형상
curl -o public/data/images/radiant/tft_item_spiritvisagerr.tft_tft14_5.png \
  "https://raw.communitydragon.org/latest/game/assets/maps/tft/icons/items/hexcore/tft_item_spiritvisagerr.tft_tft14_5.png"

# 2. 찬란한 공허의 지팡이
curl -o public/data/images/radiant/tft5_item_statikkshivradiant.tft_set13.png \
  "https://raw.communitydragon.org/latest/game/assets/maps/tft/icons/items/hexcore/tft5_item_statikkshivradiant.tft_set13.png"

# 3. 찬란한 크라켄의 분노
curl -o public/data/images/radiant/tft_item_krakenslayerradiant.tft_tft14_5.png \
  "https://raw.communitydragon.org/latest/game/assets/maps/tft/icons/items/hexcore/tft_item_krakenslayerradiant.tft_tft14_5.png"
```

### 2.2 JSON icon 필드 수정 (10개)

`public/data/tft_set16_items.json`에서 10개 아이템의 `icon` 필드를 CommunityDragon 올바른 값으로 수정:

| # | apiName | 현재 icon (잘못됨) | 수정할 icon |
|---|---------|-------------------|------------|
| 1 | `TFT_Item_CorruptedRedemption` | `tft5_item_guardianangelradiant.tft_set13.png` | `tft_item_spiritvisagerr.tft_tft14_5.png` |
| 2 | `TFT_Item_Radiant_TitansResolve` | `tft5_item_leviathanradiant.tft_set13.png` | `tft5_item_titansresolveradiant.tft_set13.png` |
| 3 | `TFT_Item_Radiant_VoidStaff` | `tft5_item_spectralgauntletradiant.tft_set13.png` | `tft5_item_statikkshivradiant.tft_set13.png` |
| 4 | `TFT_Item_Radiant_FrozenHeart` | `tft5_item_frozenheartradiant.tft_set13.png` | `tft5_item_nightharvesterradiant.tft_set13.png` |
| 5 | `TFT_Item_Radiant_NashorsBloodrazor` | `tft5_item_titansresolveradiant.tft_set13.png` | `tft5_item_leviathanradiant.tft_set13.png` |
| 6 | `TFT_Item_Radiant_NightHarvester` | `tft5_item_nightharvesterradiant.tft_set13.png` | `tft5_item_guardianangelradiant.tft_set13.png` |
| 7 | `TFT_Item_Radiant_RedBuff` | `tft5_item_bramblevestradiant.tft_set13.png` | `tft5_item_rapidfirecannonradiant.tft_set13.png` |
| 8 | `TFT_Item_Radiant_GuardianAngel` | `tft5_item_guardianangelradiant.tft_set13.png` | `tft5_item_frozenheartradiant.tft_set13.png` |
| 9 | `TFT_Item_Radiant_Evenshroud` | `tft5_item_frozenheartradiant.tft_set13.png` | `tft5_item_spectralgauntletradiant.tft_set13.png` |
| 10 | `TFT_Item_Radiant_KrakenSlayer` | `tft5_item_rapidfirecannonradiant.tft_set13.png` | `tft_item_krakenslayerradiant.tft_tft14_5.png` |

### 2.3 imageMap.ts — 변경 없음

`resolveItemPath()`는 이미 `Corrupted` / `Radiant_` apiName을 `/data/images/radiant/`로 라우팅.
icon 파일명만 수정하면 기존 로직으로 올바르게 해석됨.

---

## 3. 유형 B 처리 (수정 불가 → 문서화)

5개 아이템은 라이엇 원본 데이터에서 의도적으로 아이콘을 공유.
Issue #4에 코멘트로 이 사실을 기록하고, 라이엇이 향후 고유 아이콘을 제공하면 업데이트.

---

## 4. 구현 순서

| Step | 내용 | 파일 |
|------|------|------|
| 1 | CommunityDragon CDN에서 이미지 3개 다운로드 | `public/data/images/radiant/` |
| 2 | JSON `icon` 필드 수정 (10개 아이템) | `public/data/tft_set16_items.json` |
| 3 | 이미지 매칭 검증 스크립트 재실행 | — |
| 4 | `pnpm build` 통과 확인 | — |
| 5 | Issue #4에 유형 B 코멘트 | GitHub |

---

## 5. 수용 기준

1. 찬란한 아이템 10개 모두 고유 이미지 표시 (중복 해소)
2. 검증 스크립트에서 찬란한 아이템 중복 아이콘 0개
3. `pnpm build` 통과
4. Issue #4에 유형 B 5개 아이템의 라이엇 원본 문제 기록
