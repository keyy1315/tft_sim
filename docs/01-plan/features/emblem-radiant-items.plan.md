# Plan: 상징 & 찬란 아이템 추가 (Emblem & Radiant Items)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 상징 & 찬란 아이템 시스템 |
| 작성일 | 2026-03-16 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | lolchess.gg 배치툴에 있는 상징(22개) / 찬란(=타락한 10개) 아이템이 누락됨 |
| **Solution** | CommunityDragon에서 데이터/아이콘 추출 → items JSON 추가 → 카테고리 필터 + UI 반영 |
| **Function UX Effect** | 아이템 사이드바에 상징/찬란 탭 추가, 상징 장착 시 해당 시너지 자동 부여 |
| **Core Value** | lolchess.gg 수준의 완전한 아이템 목록으로 시뮬레이션 정확도 향상 |

---

## 1. 현재 상태 분석

### 1.1 lolchess.gg 배치툴 아이템 탭 구조

| 탭 | 의미 | 현재 구현 |
|---|---|---|
| 일반 | 완성템 + 조합재료 | ✅ 구현됨 |
| **상징** | 시너지 상징(엠블럼) | ❌ 미구현 |
| 유물 | Artifact | ✅ 구현됨 |
| **찬란** | 강화된 아이템 (Set 16에서는 Corrupted) | ❌ Corrupted 아이템 숨김 처리 중 |
| 암시장 | 빌지워터 시너지 아이템 | ✅ 시너지 조건부 |
| 발명품 | 필트오버 모듈 | ✅ PiltoverModulePanel |
| 변이 | 공허 돌연변이 | ✅ 시너지 조건부 |

### 1.2 raw 데이터 분석 결과

**상징 아이템 (22개)** — `TFT16_Item_*EmblemItem`
- 난동꾼, 기원자, 학살자, 토벌자, 원거리 사격, 기동타격대, 방해꾼, 요들, 총잡이, 공허, 필트오버, 전쟁기계, 빌지워터, 프렐요드, 파수꾼, 비전 마법사, 녹서스, 자운, 이쉬탈, 아이오니아, 데마시아, 엄호대
- 효과: 장착 챔피언에 해당 시너지 1 추가
- composition이 있는 것(뒤집개+재료)과 없는 것 혼재

**찬란(Corrupted) 아이템 (10개)** — `TFT_Item_Corrupted*`
- 보석 건틀릿, 무한의 대검, 쇼진의 창, 라바돈의 죽음모자, 정의의 손길, 정령의 형상, 워모그의 갑옷, 구인수의 격노검, 죽음의 검, 가고일 돌갑옷
- 일반 완성템의 강화 버전 (같은 이름, 더 높은 스탯)
- Set 16에서는 "찬란" 대신 "타락한(Corrupted)" 아이콘 사용

---

## 2. 구현 범위

### 2.1 R1: 상징 아이템 데이터 추가

- `tft_set16_items.json`에 22개 상징 아이템 추가
- CommunityDragon에서 상징 아이콘 22개 다운로드 → `public/data/images/emblems/`
- `ItemCategory`에 `'emblem'` 추가
- `getItemCategory`: `apiName.includes('EmblemItem')` → `'emblem'`
- 상징은 **챔피언에 직접 장착** 가능 (일반 아이템 슬롯 사용)

### 2.2 R2: 찬란(Corrupted) 아이템 활성화

- 현재 `isCorruptedItem`으로 숨김 처리 중 → 숨김 해제
- `ItemCategory`에 `'radiant'` 추가 (UI 표시명은 "찬란")
- `getItemCategory`: `apiName.includes('Corrupted')` → `'radiant'`
- 찬란 아이템은 챔피언당 **1개만** 장착 가능 (유물과 동일 규칙)
- 찬란 아이콘은 기존 아이템 아이콘 재사용 (별도 다운로드 불필요)

### 2.3 R3: UI 반영

#### 사이드바 아이템 탭 필터 확장
현재: `전체 | 완성 | 유물 | 조합`
변경: `전체 | 완성 | 유물 | 찬란 | 상징 | 조합`

#### 아이템 선택 모달(ItemGrid) 탭 확장
현재: `전체 | 조합재료 | 완성템 | 유물`
변경: `전체 | 조합재료 | 완성템 | 유물 | 찬란 | 상징`

### 2.4 범위 외

- 상징 장착 시 시너지 자동 부여 (trait 시스템 연동) — 별도 feature
- 아이템 조합 시스템 (뒤집개 + 재료 → 상징)
- 찬란 아이템 특수 이펙트 시각화

---

## 3. 수정 대상 파일

| 파일 | 변경 |
|------|------|
| `public/data/tft_set16_items.json` | 상징 22개 추가 |
| `public/data/images/emblems/` | 상징 아이콘 22개 다운로드 |
| `src/types/index.ts` | `ItemCategory`에 `'emblem'`, `'radiant'` 추가 |
| `src/lib/simulator/systems/item.ts` | `getItemCategory` 확장, `isCorruptedItem` 숨김 해제, 찬란 1개 제한 |
| `src/data/imageMap.ts` | 상징 아이콘 경로 매핑 |
| `src/components/builder/ItemGrid.tsx` | 탭 2개 추가 |
| `src/app/simulator/page.tsx` | 사이드바 필터 확장 |

---

## 4. 구현 순서

1. CommunityDragon에서 상징 아이콘 22개 다운로드
2. `tft_set16_items.json`에 상징 22개 데이터 추가
3. `ItemCategory` 타입에 `'emblem'`, `'radiant'` 추가
4. `getItemCategory` 확장 + Corrupted 숨김 해제
5. `imageMap.ts` 상징 경로 매핑
6. `ItemGrid.tsx` + `page.tsx` 탭/필터 추가
7. `canEquipItem`에 찬란 1개 제한 추가
8. 빌드 검증

---

## 5. 데이터

### 5.1 상징 아이템 목록 (22개)

| apiName | 이름 | 아이콘 |
|---------|------|--------|
| TFT16_Item_BrawlerEmblemItem | 난동꾼 상징 | TFT16_Emblem_Bruiser.TFT_Set16.tex |
| TFT16_Item_InvokerEmblemItem | 기원자 상징 | TFT16_Emblem_Invoker.TFT_Set16.tex |
| TFT16_Item_SlayerEmblemItem | 학살자 상징 | TFT16_Emblem_Slayer.TFT_Set16.tex |
| TFT16_Item_VanquisherEmblemItem | 토벌자 상징 | TFT16_Emblem_Vanquisher.TFT_Set16.tex |
| TFT16_Item_LongshotEmblemItem | 원거리 사격 상징 | TFT16_Emblem_Longshot.TFT_Set16.tex |
| TFT16_Item_RapidfireEmblemItem | 기동타격대 상징 | TFT16_Emblem_Quickstriker.TFT_Set16.tex |
| TFT16_Item_MagusEmblemItem | 방해꾼 상징 | TFT16_Emblem_Disruptor.TFT_Set16.tex |
| TFT16_Item_YordleEmblemItem | 요들 상징 | TFT16_Emblem_Yordle.TFT_Set16.tex |
| TFT16_Item_GunslingerEmblemItem | 총잡이 상징 | TFT16_Emblem_Gunslinger.TFT_Set16.tex |
| TFT16_Item_VoidEmblemItem | 공허 상징 | TFT16_Emblem_Void.TFT_Set16.tex |
| TFT16_Item_PiltoverEmblemItem | 필트오버 상징 | TFT16_Emblem_Piltover.TFT_Set16.tex |
| TFT16_Item_JuggernautEmblemItem | 전쟁기계 상징 | TFT16_Emblem_Juggernaut.TFT_Set16.tex |
| TFT16_Item_BilgewaterEmblemItem | 빌지워터 상징 | TFT16_Emblem_Bilgewater.TFT_Set16.tex |
| TFT16_Item_FreljordEmblemItem | 프렐요드 상징 | TFT16_Emblem_Freljord.TFT_Set16.tex |
| TFT16_Item_WardenEmblemItem | 파수꾼 상징 | TFT16_Emblem_Warden.TFT_Set16.tex |
| TFT16_Item_SorcererEmblemItem | 비전 마법사 상징 | TFT16_Emblem_Arcanist.TFT_Set16.tex |
| TFT16_Item_NoxusEmblemItem | 녹서스 상징 | TFT16_Emblem_Noxus.TFT_Set16.tex |
| TFT16_Item_ZaunEmblemItem | 자운 상징 | TFT16_Emblem_Zaun.TFT_Set16.tex |
| TFT16_Item_IxtalEmblemItem | 이쉬탈 상징 | TFT16_Emblem_Ixtal.TFT_Set16.tex |
| TFT16_Item_IoniaEmblemItem | 아이오니아 상징 | TFT16_Emblem_Ionia.TFT_Set16.tex |
| TFT16_Item_DemaciaEmblemItem | 데마시아 상징 | TFT16_Emblem_Demacia.TFT_Set16.tex |
| TFT16_Item_DefenderEmblemItem | 엄호대 상징 | TFT16_Emblem_Defender.TFT_Set16.tex |

### 5.2 찬란(Corrupted) 아이템 목록 (10개)

| apiName | 이름 (일반과 동일) |
|---------|------|
| TFT_Item_CorruptedJeweledGauntlet | 보석 건틀릿 |
| TFT_Item_CorruptedInfinityEdge | 무한의 대검 |
| TFT_Item_CorruptedSpearOfShojin | 쇼진의 창 |
| TFT_Item_CorruptedRabadonsDeathcap | 라바돈의 죽음모자 |
| TFT_Item_CorruptedHandOfJustice | 정의의 손길 |
| TFT_Item_CorruptedRedemption | 정령의 형상 |
| TFT_Item_CorruptedWarmogsArmor | 워모그의 갑옷 |
| TFT_Item_CorruptedGuinsoosRageblade | 구인수의 격노검 |
| TFT_Item_CorruptedDeathblade | 죽음의 검 |
| TFT_Item_CorruptedGargoyleStoneplate | 가고일 돌갑옷 |
