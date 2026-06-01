# Plan: TFT 17.3 패치 데이터 갱신 (PR 1 / 3)

## Executive Summary

| 관점 | 설명 |
|------|------|
| Problem | 17.3 LIVE 패치(2026-05-13)로 챔프 변수, 시너지 효과, 증강 풀이 변경됐으나 로컬 데이터는 17.2 (2026-04-29 fetch) 상태 |
| Solution | CDragon PBE 미러(5/12) 기반 데이터 갱신 + 사용자 작성 필드(role 등) 보존 머지 + 최소 코드 변경 (RekSai 케이스 환원) |
| Function UX Effect | 시뮬레이터에서 17.3 챔프 너프/버프 자동 반영 → opponent damage 정확도 ↑, sim duration mismatch 완화 기대 |
| Core Value | 데이터-only PR로 회귀 리스크 최소화하고 17.3 메커니즘 변경(Shen passive, Stargazer Fountain)은 후속 PR 2/3로 분리. Morgana는 4코 유지 + 너프만이라 PR 1에서 자동 반영 |

---

## 1. 작업 분리 — 옵션 B (3 PR 시퀀스)

| PR | 범위 | 위험도 | 담당 |
|----|------|:-:|------|
| **PR 1 (이 plan)** | 데이터 갱신 + 자동 반영 변경 + RekSai 케이스 환원 (Morgana 4코 너프 자동 반영 포함) | 🟢 Low | data-only |
| PR 2 | Shen passive 변경 (`BonusDamageOnAttack` 너프 + `DamageHP` 제거 + ShieldHP 0.15 활용) | 🟡 Med | sim handler |
| PR 3 | Stargazer Fountain trait helper 신규 (`Fountain_HealPercent`/`Fountain_ManaRegen` 활성화) | 🟡 Med | trait helper |

---

## 2. 데이터 소스 결정

| 소스 | last-modified | 상태 | 채택 |
|------|---|------|:-:|
| CDragon Latest | 2026-05-09 | Morgana 5코 + 리메이크 → **5/9~5/12 사이 PBE 시도였다가 LIVE 미반영 가능성** | ❌ |
| **CDragon PBE** | **2026-05-12** | 17.3 LIVE 직전. 챔프 21명 변수 변경 잡힘. Morgana 4코 유지 + 너프 | **메인** |
| 사용자 보고 (5/13 KST) | 2026-05-13 | 17.3 LIVE 한국 서버. **Morgana 4코 유지 확인** | **검증 기준** |

**Morgana 처리 방침**: 사용자 보고 기준 4코 유지. **PBE 5/12 너프 데이터 채택** (Latest 5/9의 5코 리메이크는 폐기). PR 1에서 자동 반영되며, ability handler 변경 불필요.

---

## 3. 17.3 변경 사항 (PR 1 자동 반영 대상)

### 3.1 챔피언 변수 — 너프/버프 자동 반영 (PBE 기준 21명)

#### 1코스트
| 챔프 | 변수 | 17.2 → 17.3 |
|------|------|---|
| Briar | ADDamage ★4 | 550 → **485** 🔴 |
| Leona | ShieldAmount ★4 | 870 → **760** 🔴 |
| Leona | DefenseToDamageRatio ★1~4 | 1.4/2.1/3.15/5.35 → **1.2/1.8/2.7/4.6** 🔴 |
| TwistedFate | DamageMin ★1~4 | 190/285/430/730 → **180/270/405/690** 🔴 |
| TwistedFate | DamageMax ★1~4 | 380/570/860/1460 → **360/540/810/1380** 🔴 |
| Teemo | MagicDamage ★1~4 | 70/105/190/325 → **65/95/170/300** 🔴 |

#### 2코스트
| 챔프 | 변수 | 17.2 → 17.3 |
|------|------|---|
| Akali | DamageAD ★1~4 | 34/50/80/135 → **37/56/84/140** 🔵 |
| Belveth | ADDamage ★1~4 | 20/30/45/77 → **18/27/41/69** 🔴 |
| Jax | ShieldAP ★4 | 850 → **600** 🔴 |
| Jax | FlatDR ★1~4 | 15/25/35/45 → **15/20/25/30** 🔴 |
| Jinx | ADDamage ★3 | 65 → **70** 🔵 |

#### 3코스트
| 챔프 | 변수 | 17.2 → 17.3 |
|------|------|---|
| Diana | BaseDamage ★1~4 | 50/75/120/190 → **60/90/145/250** 🔵 |
| Diana | Shield ★1~4 | 250/290/375/460 → **275/325/475/460** 🔵 |
| Fizz | DashDamage ★1~4 | 110/165/265/470 → **120/180/290/470** 🔵 |
| Kaisa | ADDamage ★1~4 | 32/48/77/136 → **30/45/72/136** 🔴 |
| Ornn | Shield ★1~4 | 100/150/500/1050 → **125/200/500/1050** 🔵 |
| Samira | Damage ★1~4 | 360/540/860/1555 → **375/560/900/1555** 🔵 |

#### 4코스트
| 챔프 | 변수 | 17.2 → 17.3 |
|------|------|---|
| AurelionSol | DamagePerSecond ★1~4 | 185/280/2000/2000 → **320/480/2000/2000** 🔵 |
| AurelionSol | DamageReductionPerTarget | 0.6 → **0.8** 🔵 |
| Karma | SecondaryDamage ★1~4 | 150/225/1000/1320 → **180/270/1000/1320** 🔵 |
| LeBlanc | BoltDamage ★1~4 | 70/105/750/540 → **80/120/750/540** 🔵 |
| MasterYi | Omnivamp | 0.15 → **0.10** 🔴 |
| Nami | Damage ★1~4 | 410/615/5000/3600 → **440/660/5000/3600** 🔵 |
| Xayah | NumAttacks (신규) | - → **6** 🆕 |
| Xayah | PrimaryTargetBonusDamage (신규) | - → **10/10/15/200** 🆕 |
| Morgana | APHealthGain ★1~4 | 600/700/2500/2500 → **525/625/2500/2500** 🔴 |
| Morgana | PercentHPHealthGain ★1~4 | 0.15/0.15/0.5/- → **0.10/0.10/0.5/-** 🔴 |

#### 5코스트
| 챔프 | 변수 | 17.2 → 17.3 |
|------|------|---|
| Shen | ShieldHP | 0.10 → **0.15** 🔵 |
| Shen | BonusDamageOnAttack ★1~4 (passive 변경, PR 2) | 45/75 → **20/30** 🔴 |
| Shen | DamageHP (PR 2에서 제거) | 0.01 → REMOVED |

### 3.2 사용자 보고했으나 PBE 미잡힘 (PR 1 외 — 추가 조사 필요)

| 챔프 | 사용자 보고 | PBE 5/12 | 가능 원인 |
|------|:-:|:-:|------|
| Lulu (뱀자리) | 너프 | 변화 없음 | trait/item/base stat 측 변경 가능성 |
| MissFortune | 너프 | 변화 없음 | (Stance 별 별도 데이터 가능성) |
| Nunu (Willump) | 너프 | 변화 없음 | base stat 측 |
| Gnar | 너프 | 변화 없음 | base stat 또는 item 측 |

→ **PR 1 범위 외 — CDragon Latest 추가 동기화 후 재조사 (5/14 이후)**

### 3.3 시너지 변경 (자동 반영)

- `TFT17_Stargazer_Fountain`: 변수 hash 정식 이름 해제 (`Fountain_HealPercent`, `Fountain_ManaRegen`, `Fountain_ManaRegen_Teamwide`) → 데이터에만 반영, 핸들러 활성화는 **PR 3**
- `TFT17_MorganaUniqueTrait`: PBE 데이터 채택 시 17.2 구조 유지 (Latest의 `TransformedAbilityDA`/`UntransformedAbilityDA` 신규 변수는 5/9 시도 데이터로 폐기). PR 1 변경 없음.
- `Set17_CarouselMarket_EmpoweredHexTrait`: 변수 변경 (자동 반영, sim 영향 미미)

### 3.4 아이템 변경 (자동 반영)

- 제거 (4개, sim 영향 없음 — 모두 라운드 간 영구 강화 소비 아이템):
  - `TFT17_Consumable_BlessingProsperity`
  - `TFT17_Consumable_BlessingProsperityPlus`
  - `TFT17_Consumable_BlessingWealth`
  - `TFT17_MarketOffering_BlessingWealth`
- **효과 변경된 기존 아이템: 0개** (710개 공통 모두 효과 동일)

### 3.5 Augment 변경

#### 영웅 증강 7개 신규 (active pool 추가)
| apiName | 한국어 |
|---------|--------|
| TFT17_Augment_AatroxCarry | 별빛 연계 |
| TFT17_Augment_LeonaCarry | 방패 여전사 |
| TFT17_Augment_PoppyCarry | 정령단 속도 |
| TFT17_Augment_IvernMinionCarry | 빅뱅 |
| TFT17_Augment_NasusCarry | 꽁! |
| TFT17_Augment_MordekaiserCarry | 뜨거운 죽음 |
| TFT17_Augment_JaxCarry | 저 별을 향해 |

→ sim 측 핸들러 없음. 데이터 풀 갱신만 필요. **PR 1 범위**.

#### 신규/재활성 일반 증강 5개
| apiName | 한국어 | sim 영향 |
|---------|--------|:-:|
| TFT17_Augment_Concentration | 집중 | sim 미반영 (5 챔프 AugmentedDuration 제거 동기화) |
| TFT17_Augment_PrimordianPrismaticAugment | 군체의 심장 | sim 미반영 |
| TFT17_Augment_TourOfTheGalaxy | 은하계 여행 | sim 미반영 |
| TFT17_Augment_Timebreaker_Timestream | 시간의 흐름 | sim 미반영 |
| TFT17_Augment_? (전리품 특이점) | 전리품 특이점 | apiName 미상 — PR 1 외 조사 |

→ 데이터 풀 갱신만 필요. **PR 1 범위**.

#### 사용자 보고 일반 증강 7개 삭제 (apiName 매칭 필요)
- 유연함 상징당 체력, 보석 연꽃 치명타 확률, 에너지 파동 고정 피해량, 4가 함께하길, 탑 체력, 신병, 흡혈의 활력 II
- → CDragon active pool diff 기준으로 자동 처리. apiName 명시적 매칭은 PR 1 외 검증.

### 3.6 케이스 변경 (코드 1줄)

| 17.2 | 17.3 |
|------|------|
| `TFT17_Reksai` | **`TFT17_RekSai`** |

→ `src/lib/simulator/systems/ability.ts` `ABILITY_DEFS` key 변경 + 검색해서 다른 참조 모두 업데이트.

---

## 4. 사용자 보고했으나 본 PR 외 처리 항목

| 항목 | 처리 위치 |
|------|----------|
| 별돌보미 여사냥꾼 보드 7,0 강화칸 추가 | 별도 PR (보드 강화칸 데이터 위치 별도 조사) |
| 지평선의 초점 (HorizonFocus) 비활성화 | 별도 PR (artifact pool 또는 UI 노출 차단) |
| Lulu/MF/Nunu/Gnar 너프 (PBE 미잡힘) | CDragon Latest 재동기화 후 재검증 |

---

## 5. 작업 순서

| 단계 | 작업 |
|------|------|
| 1 | CDragon PBE `ko_kr.json` 다운로드 → `raw-data/tft_set17_pbe.json` (gitignored) |
| 2 | `scripts/fetch-set17.mjs` 보강 — 사용자 작성 필드(`role`, `disable` 등) 보존 머지 로직 |
| 3 | 챔프 데이터 갱신: PBE 기준 단일 소스 (Morgana 포함 모두 PBE) |
| 4 | 시너지 데이터 갱신: PBE 기준 (Stargazer Fountain hash 해제 포함) |
| 5 | 아이템 데이터 갱신: PBE 기준 (축복 4개 제거) |
| 6 | 증강 데이터 갱신: PBE active pool 기준 (영웅 7개 추가, 일반 변경 자동 반영) |
| 7 | `meta` 블록 갱신 (`patch_version: '17.3 LIVE'`, `fetched_at: 2026-05-13`, `source: CDragon PBE 5/12`) |
| 8 | `ability.ts` `TFT17_Reksai` → `TFT17_RekSai` 키 변경 + 전체 grep 후 다른 참조 갱신 |
| 9 | `pnpm lint && pnpm typecheck && pnpm build` 통과 확인 |
| 10 | `pnpm tsx scripts/compute-diff-cache.ts` 재실행 → diff cache 갱신 |
| 11 | golden snapshot 갱신 + winnerMatchRate 변화 측정 |

---

## 6. 사용자 작성 필드 보존 (중요)

기존 데이터 파일에 수동 추가된 필드를 **반드시 보존**:

| 파일 | 보존 대상 |
|------|----------|
| `tft_set17_champions.json` | `role` (73/83 챔프 매핑됨 — `role: 'Tank'/'Marksman'/...` 등) |
| `tft_set17_augments.json` | `disable`, `associatedTraits`, `tags` |
| 모든 파일 | 사용자 작성 임의 필드 (`*_kr` 한국어 보강 등) |

**머지 전략**:
1. 신규 fetch 데이터로 raw 변수/스탯/desc 갱신
2. 기존 파일의 사용자 필드는 apiName 키로 매칭하여 보존
3. raw 데이터 전체 덮어쓰기 금지 — 변경 필드만 부분 적용

---

## 7. 검증

### 7.1 자동 검증 (Definition of Done)

- [ ] `pnpm lint` 통과 (0 error)
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm build` 통과
- [ ] 기존 unit test 모두 통과 (특히 챔프 ability 회귀 가드)

### 7.2 데이터 보존 검증

- [ ] `champions.json` `role` 필드 73/83 그대로 유지
- [ ] `augments.json` `disable` 필드 손실 없음
- [ ] 한국어 보강 필드 손실 없음

### 7.3 메트릭 영향 측정

- [ ] `pnpm tsx scripts/compute-diff-cache.ts` 후 `actual-data/diff-game-20260423-001.json`, `diff-game-20260424-001.json` winnerMatchRate 측정
- [ ] 17.2 baseline 대비 winnerMatchRate ±5pt 변동 모니터링
- [ ] 회귀 잡히면 PR 1 차단, 추가 조사

### 7.4 골든 스냅샷 갱신

- [ ] 변경 영향이 큰 챔프(Briar/Jax/Leona/AurelionSol/Karma/LeBlanc/Nami 등) 회귀 가드 통과 확인
- [ ] golden snapshot 갱신 커밋 분리

---

## 8. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|:-:|:-:|------|
| PBE 5/12와 5/13 LIVE 차이 (CDragon 미반영 변경) | 🟡 Med | Med | 사용자 게임 검증 라운드 1회 후 차이 발견 시 hotfix |
| CDragon Latest 5/14 재동기화로 PBE와 다른 변경 발견 | 🟡 Med | High | PR 1 머지 후 재diff → PR 1.5 hotfix |
| `role` 필드 보존 실패 → sim targeting 무너짐 | 🔴 High | Low | merge 로직 검증 + diff 검사 단계 추가 |
| Xayah 신규 변수(`NumAttacks`/`PrimaryTargetBonusDamage`) → ability handler 미반영 | 🟡 Med | High | 데이터만 갱신, 핸들러 미사용 → 기존 평타 로직 그대로 (sim 회귀 없음) |
| RekSai 케이스 변경 누락 → ABILITY_DEFS lookup 실패 | 🔴 High | Low | grep 전체 검색 + 빌드 통과 확인 |
| Lulu/MissFortune/Nunu/Gnar 너프 (PBE 미잡힘) → 사용자 정보 무반영 | 🟢 Low | High | PR 1.5 또는 PR 4에서 별도 처리 (CDragon Latest 재동기화 후) |

---

## 9. 수정 파일 목록

| # | 파일/작업 | 변경 |
|---|----------|------|
| 1 | `raw-data/tft_set17_pbe.json` | CDragon PBE 5/12 원본 (gitignored) |
| 2 | `scripts/fetch-set17.mjs` | 머지 로직 보강 (사용자 필드 보존) |
| 3 | `public/data/tft_set17_champions.json` | 21명 변수 부분 갱신 (Morgana 너프 포함) + meta 블록 |
| 4 | `public/data/tft_set17_traits.json` | Stargazer Fountain hash 해제 |
| 5 | `public/data/tft_set17_items.json` | 축복 아이템 4개 제거 + meta |
| 6 | `public/data/tft_set17_augments.json` | 영웅 7개 + 일반 변경 + meta |
| 7 | `src/lib/simulator/systems/ability.ts` | `TFT17_Reksai` → `TFT17_RekSai` 키 변경 |
| 8 | `tests/golden/__snapshots__/*` | 영향 챔프 회귀 가드 갱신 |
| 9 | `actual-data/diff-game-*.json` | diff cache 재계산 결과 |

---

## 10. PR 2 / PR 3 후속 작업 미리보기

### PR 2 — Shen passive 변경
- ABILITY_DEFS[TFT17_Shen] passive 변경: `BonusDamageOnAttack` AP 스케일링만 (DamageHP 제거)
- ShieldHP 0.15 활용 (보호막 생성 시 추가 HP 비율 ↑)
- 회귀 가드: Shen passive 데미지 ★별 측정값 검증

### PR 3 — Stargazer Fountain helper
- `applyStargazerFountainBuffs()`: 강화 칸 아군 마나 재생 (`Fountain_ManaRegen_Teamwide` 1.0/s)
- 별돌보미 스킬 캐스팅 시 가장 낮은 체력 아군 회복 (`Fountain_HealPercent` 18~25%)
- 메모리 차단 해제: `stargazer_fountain_inactive.md` 업데이트 (17.3 활성화 표시)

---

## Version History

| Version | Date | 변경 | 작성자 |
|---------|------|------|--------|
| 0.1 | 2026-05-13 | 초안 (PBE 5/12 + Latest 5/9 분석 기반) | Claude (Opus 4.7) |
