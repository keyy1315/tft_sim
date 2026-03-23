# Plan: 아이템 이미지-이름-설명 매칭 불일치 수정 (Issue #4)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 아이템 이미지 매칭 불일치 수정 |
| 작성일 | 2026-03-23 |
| 상태 | Plan |
| Issue | https://github.com/keyy1315/tft_sim/issues/4 |

| 관점 | 내용 |
|------|------|
| **Problem** | `tft_set16_items.json`에서 14개 아이템의 `icon` 필드가 다른 아이템의 이미지를 가리킴. 6개 이미지 파일이 2~4개 아이템에 중복 사용되어, 서로 다른 아이템에 같은 이미지가 표시됨 |
| **Solution** | JSON의 잘못된 `icon` 필드를 CommunityDragon에서 올바른 아이콘 파일명으로 수정하고, 누락된 이미지 파일을 다운로드 |
| **Function UX Effect** | 모든 아이템에 고유한 이미지가 표시되어, 아이템 선택 시 이름·설명과 이미지가 정확히 일치 |
| **Core Value** | 아이템 식별 혼동 제거로 시뮬레이터 사용성 및 신뢰도 향상 |

---

## 1. 원인 분석

### 1.1 이미지 매핑 코드 — 문제 없음

`src/data/imageMap.ts`의 `resolveItemPath()`, `getItemImage()` 로직은 정상 동작.
문제는 **코드가 아닌 소스 데이터**에 있음.

### 1.2 근본 원인 — JSON `icon` 필드 오류

`public/data/tft_set16_items.json`에서 CommunityDragon 데이터를 파싱할 때
일부 아이템의 `icon` 필드가 잘못된 파일명을 가리키고 있음.

### 1.3 불일치 전체 목록 (14개 아이템, 6개 중복 그룹)

#### 그룹 1: 필트오버 모듈
| 아이템 | 현재 icon (잘못됨) | 올바른 icon |
|--------|-------------------|-------------|
| `EchoEngine` (메아리 엔진) | `unstablecore` 이미지 사용 | 고유 이미지 필요 |

#### 그룹 2: 빌지워터 대포 계열
| 아이템 | 현재 icon (잘못됨) | 올바른 icon |
|--------|-------------------|-------------|
| `FirstMatesFlintlock` (일등 항해사의 화승총) | `dreadwaycannon` 이미지 사용 | 고유 이미지 필요 |

#### 그룹 3: 빌지워터 해적 계열 (4개 → 1개 이미지 공유)
| 아이템 | 현재 icon (잘못됨) | 올바른 icon |
|--------|-------------------|-------------|
| `TheList` (보물 태풍) | `jollyroger` 이미지 사용 | 고유 이미지 필요 |
| `CaptainsBrew` (선장의 비법) | `jollyroger` 이미지 사용 | 고유 이미지 필요 |
| `MyronsDark` (보물 태풍) | `jollyroger` 이미지 사용 | 고유 이미지 필요 |

#### 그룹 4: 찬란한 아이템 — 수호자의 맹세 계열
| 아이템 | 현재 icon (잘못됨) | 올바른 icon |
|--------|-------------------|-------------|
| `CorruptedRedemption` (찬란한 정령의 형상) | `guardianangelradiant` 이미지 사용 | 고유 이미지 필요 |

#### 그룹 5: 찬란한 아이템 — 굳건한 심장 계열
| 아이템 | 현재 icon (잘못됨) | 올바른 icon |
|--------|-------------------|-------------|
| `Radiant_Evenshroud` (찬란한 저녁갑주) | `frozenheartradiant` 이미지 사용 | 고유 이미지 필요 |

#### 그룹 6: 찬란한 아이템 — 덤불 조끼 계열
| 아이템 | 현재 icon (잘못됨) | 올바른 icon |
|--------|-------------------|-------------|
| `Radiant_RedBuff` (찬란한 붉은 덩굴정령) | `bramblevestradiant` 이미지 사용 | 고유 이미지 필요 |

### 1.4 누락된 이미지 파일

위 잘못 참조된 아이템들의 고유 이미지 파일이 `public/data/images/` 하위에 존재하지 않음.
CommunityDragon에서 올바른 파일명을 찾아 다운로드해야 함.

---

## 2. 해결 방안

### 2.1 CommunityDragon에서 올바른 아이콘 조회

CommunityDragon TFT 데이터 엔드포인트에서 각 아이템의 실제 `icon` 경로를 확인:
```
https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/tftitems.json
```

각 아이템의 `apiName`으로 검색하여 올바른 icon 경로 획득.

### 2.2 이미지 다운로드

CommunityDragon CDN에서 이미지를 다운로드하여 적절한 디렉토리에 저장:
```
https://raw.communitydragon.org/latest/game/{icon_path_lowercased}.png
```

### 2.3 JSON icon 필드 수정

`tft_set16_items.json`의 해당 아이템들의 `icon` 필드를 올바른 파일명으로 업데이트.

---

## 3. 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `public/data/tft_set16_items.json` | 잘못된 `icon` 필드 수정 (최대 9개 아이템) |
| `public/data/images/*/` | 누락 이미지 파일 다운로드 추가 |
| `src/data/imageMap.ts` | 변경 없음 (코드 문제 아님) |

---

## 4. 수용 기준

1. 모든 아이템이 고유 이미지를 표시 (중복 아이콘 0개)
2. `icon` 필드와 실제 이미지 파일이 1:1 대응
3. `pnpm build` 통과
4. Issue #4 해결로 close 가능
