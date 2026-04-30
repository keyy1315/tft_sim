# Set 17 Trait — 17.2 hash 변수 audit

> 작성일: 2026-04-30
> 출처: `public/data/tft_set17_traits.json` (CDragon 17.2 fetch)
> 검증 대상: 시뮬 코드 ↔ raw effects 매핑 정확도

## 데이터 적용 상태 ✅

- **fetched**: 2026-04-29 (17.2 LIVE 이후)
- **patch_version**: 25.S1.1 (champions.json), CDragon source
- **17.2 hash 변수**: **141개** (652 total 변수 중) — 13 trait 분포
- 시그니처: `{xxxxxxxx}` (8 hex hash) — 17.2 변수 이름 hash 화 표시

## Set 17 시너지 매핑 (44 trait)

### ✅ 시뮬 처리 34종

도전자, 별돌보미 (6 변종), 선봉대, 초능력, 말살자, 시간 균열자, 습격자, 동물특공대, 운명술사, 보루, 불한당, 암흑의 별, 태고족, 우주 그루브 (prism only), 중재자, 길잡이, 구원자, 싸움꾼, 요새, 정령족, 전달자, 메카, 최신상, N.O.V.A., 저격수, 어둠의 여인, 파멸자 (PR #60), 은하계 사냥꾼 (PR #60), 파티광 (PR #60), 복제자 (PR #60), 여행자 (본 PR), 우주 그루브 일반 tier (본 PR — 보류).

### ⏭️ 시뮬 외부 정상 미구현 (라운드 간/PVE — 구현 불필요)

- **지휘관 (Sona)**: N라운드마다 무작위 지휘 모드
- **예언자 (TahmKench)**: 라운드마다 보상
- **신성 결투가 (Fiora)**: 1대1 항상 승리 + PVE 회복
- **동물특공대 Tech 시스템**: 라운드 간 기술 점수
- **태고족 PercentMoreSwarmlings**: army size (정령군주 추가 소환)
- **별돌보미 Wolf_Gold / Mountain_RoundsPerEmblem**: 라운드 간 골드/emblem 누적

## Hash 변수 보유 13 trait — desc 변수 ↔ 시뮬 매핑

| trait | hash 변수 수 | desc 변수 → 코드 사용 | 비고 |
|---|---|---|---|
| Stargazer (base) | 89 | MinUnits 만 (변종으로 위임) | ✅ |
| Stargazer Mountain | 18 | RoundsPerEmblem 미사용 | ✅ (라운드 간 OK) |
| Stargazer Fountain | 8 | PR #43 hash 마이그레이션 처리 | ✅ |
| Stargazer Wolf | 4 | Wolf_Gold 미사용 | ✅ (라운드 간 OK) |
| Stargazer Medallion | 3 | 모두 처리 | ✅ |
| FlexTrait | 5 | **BonusDA / ShieldHP 미사용** | ❌ → ✅ (본 PR) |
| SpaceGroove | 2 | **ADAPPerSecond / StartOfCombatDuration 미사용** | 일반 tier 보류 (calibration test fragility) |
| Timebreaker | 3 | 모두 처리 | ✅ |
| AnimaSquad | 2 | Tech 시스템 (sim 외부) | ⏭️ |
| ADMIN | 2 | DamageInstances/HealthThreshold/ShieldDuration 모두 처리 | ✅ |
| PsyOps | 2 | 모두 처리 | ✅ |
| Primordian | 2 | PercentMoreSwarmlings (sim 외부) | ⏭️ |
| MorganaUnique | 1 | TransformedDurability raw 미정의 | 단순 표시 누락 |

## 발견된 미구현 (본 PR 적용 대상)

### 여행자 (TFT17_FlexTrait) — **시뮬 완전 미구현이었음**

raw effects (tier별 — minUnits=2/3/4/5/6):
- BonusDA: 0.09 / 0.15 / 0.18 / 0.22 / 0.27 (비탱커 damage amp)
- ShieldHP: 175 / 250 / 350 / 500 / 700 (탱커 shield HP)
- ShieldDuration: 15 (모든 tier 동일)

desc 메커니즘:
- 모든 아군 탱커 (role==='Tank'): ShieldHP 보호막 ShieldDuration 초
- 그 외 아군 (비탱커): BonusDA 만큼 damage amp
- 여행자 챔프 (`unitHasTrait('여행자')`): 위 두 효과 모두 ×2

본 PR `applyFlexTraitBuffs()` helper 로 적용.

### 우주 그루브 (TFT17_SpaceGroove) — prism (10) 만 처리, 일반 tier 보류

- prism (10): `detectPrismTraits()` 가 즉시 winner 결정 ✅
- 일반 (3)/(5)/(7): 매초 그루비안 ADAP +N% (StartOfCombatDuration 초 동안)

본 PR `applySpaceGrooveBuffs()` helper 가 그루비안 unit 에 `spaceGrooveAdapPerSec` /
`spaceGrooveDurationSec` 필드 set 까지만 적용. main loop tick 매초 ADAP 가산은 **보류**.

**보류 이유**: stargazer-mountain-applied calibration test (23일 game round 6-2) 가 sim flow
변동에 fragile — 적군 5명 여행자 + SpaceGroove 매초 ADAP 적용 시 mountain trait 의 비-별돌보미
unit AS ratio 가 0.83 까지 변동. test bound 완화 또는 격리 시점 별도 PR.

## 영향 측정 (본 PR — 여행자만 적용)

| game | matchRate | dmgErr |
|---|---|---|
| game-20260423-001 (mountain) | 45.5% (변화 없음) | -41.8% → **-45.2%** (-3.4pp) |
| game-20260424-001 (well) | 61.9% → **57.1%** (-4.8pp) | -29.6% → **-32.7%** (-3.1pp) |

**회귀 분석**:
- 23일 게임: 적군 5명 여행자 (Aurora/Karma/Pyke/GiantMech/Tinybot) 활성 → 적군 stats 강화
- 24일 게임도 적군 측 여행자 활성 가능
- 결과: player damage 측정값 감소 + winner 예측 더 player-loss 편향

**개선 가능 점**:
- 여행자 "능력치 두 배" 해석 재검토 (BonusDA × 2 vs 본인 한정 stat 두 배 — 후자가 약함)
- 적용 후 실제 게임 결과와 비교해 over-buff 여부 확인 (사용자 검수 필요)

## 후속 (본 PR 외 항목)

1. **SpaceGroove 일반 tier 격리 PR** — calibration test 보강 후 매초 ADAP 가산 활성
2. **파티광 SpaceGroove 후속 효과** — Blitzcrank 회복 완료 후 번개 4배
3. **사용자 검수**: 적군 측 여행자 5명 활성 게임에서 sim vs actual 비교 — over-buff 정도 측정
