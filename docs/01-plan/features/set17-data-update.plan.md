# Plan: Set 17 CommunityDragon 데이터 업데이트

## Executive Summary

| 관점 | 설명 |
|------|------|
| Problem | Set 17 JSON 데이터가 placeholder 상태(스탯 0, 아이템/증강 비어있음)라 Set 17 전투 시뮬레이션 불가 |
| Solution | CommunityDragon PBE `ko_kr.json`에서 Set 17 원본 데이터를 다운로드 후 프로젝트 JSON 포맷으로 변환 |
| Function UX Effect | Set 17 선택 시 실제 챔피언 스탯, 아이템, 시너지, 증강이 표시되고 전투 시뮬레이션 가능 |
| Core Value | Set 17 PBE 데이터가 채워지면 멀티세트 인프라가 완전 동작하여 시뮬레이터 가치 2배 확대 |

---

## 1. 현재 상태

### Set 17 데이터 파일 현황

| 파일 | 상태 | 문제 |
|------|------|------|
| `tft_set17_champions.json` | 63챔 존재 | 스탯 전부 0 (hp, armor, damage, attackSpeed 등) |
| `tft_set17_items.json` | `items: []` | 완전 비어있음 |
| `tft_set17_traits.json` | 24시너지 존재 | `variables: {}` (효과 수치 없음) |
| `tft_set17_augments.json` | `augments: []` | 완전 비어있음 |
| `tft_set17_teamplanner.json` | `mapping: []` | 완전 비어있음 |
| 챔피언 이미지 | 63개 | 정상 |
| 시너지 이미지 | 24개 | 정상 |

### CommunityDragon 데이터 소스

- **URL**: `https://raw.communitydragon.org/pbe/cdragon/tft/ko_kr.json`
- **크기**: ~25MB (전체 TFT 세트 데이터 포함)
- **갱신일**: 2026-04-01 (오늘 업데이트 확인됨)
- **구조**: `{ setData: [...], items: [...] }` — setData 배열 내 `setNumber: 17`이 Set 17 데이터

---

## 2. 작업 범위

### 2.1 다운로드 및 저장

1. CommunityDragon PBE `ko_kr.json` 다운로드
2. `raw-data/tft_set17_ko_kr.json`에 원본 저장 (향후 재처리용)
3. `.gitignore`에 `raw-data/` 추가 (25MB+ 원본은 커밋하지 않음)

### 2.2 데이터 추출 스크립트 (`scripts/extract-set17.mjs`)

Node.js 스크립트로 원본 JSON에서 Set 17 데이터를 프로젝트 포맷으로 변환:

#### Champions 추출
- **소스**: `setData[].champions` (setNumber === 17)
- **변환**: CommunityDragon 포맷 → 프로젝트 `RawChampion` 포맷
  - `name`, `apiName`, `cost`, `traits[]`
  - `stats`: `{ hp, armor, magicResist, damage, attackSpeed, range, critChance, critMultiplier, initialMana, mana }`
  - `ability`: `{ name, desc, icon, variables[] }`
  - `role`: null (CommunityDragon에 없으면 수동 매핑 필요)
- **기존 데이터 머지**: traits_kr (한국어 시너지명) 기존 값 보존
- **출력**: `public/data/tft_set17_champions.json`

#### Items 추출
- **소스**: 전역 `items[]` 중 Set 17 전용 + 공용 아이템
- **필터**: `apiName`에 `TFT17_` 포함 또는 `TFT_Item_` prefix (공용 조합/완성)
- **변환**: `{ name, apiName, composition[], effects{}, desc, icon }`
- **icon 변환**: ASSETS 경로 → 마지막 세그먼트 lowercase + `.tex` → `.png`
- **출력**: `public/data/tft_set17_items.json`

#### Traits 추출
- **소스**: `setData[].traits` (setNumber === 17)
- **변환**: `{ name, apiName, desc, icon, effects[] }`
  - `effects[].variables` 수치 포함 (현재 비어있는 부분 채우기)
- **출력**: `public/data/tft_set17_traits.json`

#### Augments 추출
- **소스**: 전역 `items[]` 중 augment 플래그가 있는 것 또는 `TFT17_Augment_` prefix
- **변환**: `{ name, apiName, desc, effects{}, icon, associatedTraits[], tags[] }`
- **출력**: `public/data/tft_set17_augments.json`

#### TeamPlanner 매핑 추출
- **소스**: `setData[].champions[].characterId` 또는 별도 teamPlanner 필드
- **변환**: `{ apiName, teamPlannerCode }`
- **출력**: `public/data/tft_set17_teamplanner.json`

### 2.3 setConfig 업데이트

`src/data/setConfig.ts`에서 Set 17 상태를 `'pbe'` → 실제 PBE 데이터 반영 확인:
- `patch_version` 업데이트
- `status` 유지 (`'pbe'`)

---

## 3. CommunityDragon JSON 구조 (예상)

```jsonc
{
  "setData": [
    {
      "number": 17,
      "name": "TFTSet17",
      "mutator": "TFTSet17",
      "champions": [
        {
          "name": "아트록스",
          "characterName": "TFT17_Aatrox",
          "cost": 1,
          "traits": ["TFT17_Anima", ...],
          "stats": { "hp": 650, "damage": 55, ... },
          "ability": { "name": "...", "desc": "...", "variables": [...] }
        }
      ],
      "traits": [
        {
          "name": "아니마",
          "apiName": "TFT17_Anima",
          "effects": [{ "minUnits": 3, "variables": { ... } }]
        }
      ]
    }
  ],
  "items": [
    { "name": "...", "apiName": "TFT17_Item_...", ... }
  ]
}
```

---

## 4. 수정 파일 목록

| 순서 | 파일/작업 | 변경 |
|------|----------|------|
| 1 | `raw-data/tft_set17_ko_kr.json` | CommunityDragon 원본 다운로드 저장 |
| 2 | `.gitignore` | `raw-data/` 추가 |
| 3 | `scripts/extract-set17.mjs` | 추출/변환 스크립트 생성 |
| 4 | `public/data/tft_set17_champions.json` | 실제 스탯 + 어빌리티 데이터 |
| 5 | `public/data/tft_set17_items.json` | 아이템 전체 목록 |
| 6 | `public/data/tft_set17_traits.json` | 시너지 variables 수치 채우기 |
| 7 | `public/data/tft_set17_augments.json` | 증강 전체 목록 |
| 8 | `public/data/tft_set17_teamplanner.json` | 팀플래너 매핑 |

---

## 5. 구현 순서

| 단계 | 작업 |
|------|------|
| 1 | CommunityDragon PBE `ko_kr.json` 다운로드 → `raw-data/` 저장 |
| 2 | 원본 JSON 구조 분석 (Set 17 setData 확인) |
| 3 | `scripts/extract-set17.mjs` 작성 — Champions 추출 |
| 4 | Items 추출 로직 추가 |
| 5 | Traits 추출 로직 추가 (variables 수치 포함) |
| 6 | Augments 추출 로직 추가 |
| 7 | TeamPlanner 매핑 추출 로직 추가 |
| 8 | 스크립트 실행 → 5개 JSON 파일 갱신 |
| 9 | `pnpm lint && pnpm typecheck && pnpm build` 검증 |

---

## 6. 주의사항

- **원본 보존**: `raw-data/`에 원본 JSON 저장하여 재처리 가능하게
- **기존 데이터 머지**: `traits_kr` 등 수동 추가한 한국어 데이터는 보존
- **role 필드**: CommunityDragon에 role 정보가 없을 수 있음 → 기존 수동 매핑 유지하거나 null 허용
- **아이콘 파일**: 아이템 아이콘은 다운로드 필요할 수 있음 (별도 작업)
- **필터링**: 소환물/더미 유닛 (`Tibbers`, `Soldier`, `Golem` 등) 제외는 `loader.ts`에서 처리되므로 원본에는 포함해도 무방
- **meta 필드**: 각 JSON의 `meta` 블록에 `patch_version`, `fetched_at`, `source` 기록

---

## 7. MVP 범위

**포함**:
- Champions: 실제 스탯 (HP, AD, AS, Armor, MR, Mana 등)
- Champions: 어빌리티 desc + variables (스케일링 수치)
- Items: 조합식 + 효과 + 설명
- Traits: effects[].variables 수치
- Augments: 전체 목록 + 효과
- TeamPlanner: apiName ↔ code 매핑

**제외 (후속 작업)**:
- 아이템 아이콘 이미지 다운로드
- Set 17 전용 시너지 엔진 로직 구현
- role 필드 수동 매핑 (별도 작업)
- 증강 아이콘 이미지 다운로드
