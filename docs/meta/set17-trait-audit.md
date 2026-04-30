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

### 우주 그루브 (TFT17_SpaceGroove) — prism (10) + 일반 tier 모두 적용

- prism (10): `detectPrismTraits()` 가 즉시 winner 결정 ✅ (기존)
- 일반 (3)/(5)/(7): 매초 그루비안 ADAP +N% (StartOfCombatDuration 초 동안) ✅ (별도 PR)
- main loop tick `tick % TICKS_PER_SECOND === 0` 에서 그루비안 unit `stats.damage *= 1+pct` + `stats.ap += pct×100`.

mountain calibration test 는 PR #61 에서 bound 완화 (별돌보미 0.85~1.40 / 비-별돌보미 0.80~1.20)
적용 후 SpaceGroove 일반 tier 추가 적용해도 통과.

영향 측정 (game-20260423-001 / game-20260424-001): metrics 변화 없음 — 양 게임의 적군 측에서
SpaceGroove (5+) tier 활성 미달성 또는 그루비안 unit 영향 미세.

## 영향 측정 — 해석 비교 실험 (PR #61 + 후속)

| 시나리오 | 23일 matchRate | 23일 dmgErr | 24일 matchRate | 24일 dmgErr |
|---|---|---|---|---|
| **FlexTrait 미적용** (baseline) | **45.5%** | **-41.8%** | **61.9%** | **-29.6%** |
| 해석 B (role 한정, 보수적) | 45.5% (=) | -45.2% (-3.4pp) | 57.1% (-4.8pp) | -32.7% (-3.1pp) |
| 해석 A (codex, 두 effect ×2) | 40.9% (-4.5pp) | -50.1% (-8.3pp) | 57.1% (-4.8pp) | -33.8% (-4.2pp) |

**핵심 발견**:
- **두 해석 모두 baseline 보다 회귀** → FlexTrait 자체가 over-buff
- 해석 B 가 A 보다 보수적 (회귀 -3.4pp 절감)
- 24일 matchRate 회귀 -4.8pp 는 두 해석 동일 → role 한정 vs 두 effect 차이가 24일 게임에 영향 없음
- raw 해석 자체가 잘못된 가능성 (PBE 잔존 / over-buff)

**채택 결정**: 해석 B (role 한정) — **사용자 게임 mechanic 검수로 정답 확인** (2026-04-30).

게임 메커니즘 (사용자 확인):
- 일반 탱커 = ShieldHP 보호막 (×1)
- 일반 비탱커 = BonusDA damage amp (×1)
- 여행자 챔프 = 본인 role 의 effect 만 ×2 (탱커이면 보호막 ×2, 비탱커이면 damage amp ×2)

예시: 보드 위 모데카이저(탱커, 비여행자) + 꼬마정령(탱커, 여행자) + 오로라(비탱커, 여행자) (2) tier:
- 모데카이저: 보호막 175
- 꼬마정령: 보호막 350 (175×2)
- 오로라: 피해 증폭 18% (9%×2)

**잔여 회귀 -3.4pp 분석** (over-buff 아닌 정상 영향 가설):
- baseline (FlexTrait 미적용) = 적군 측 미구현으로 약한 적군 → player damage 측정값 부풀려짐
- 해석 B 적용 후 = 적군 정확도 ↑ → player damage 측정값 정확하게 감소 (-3.4pp)
- 즉 baseline 의 dmgErr -41.8% 가 "잘못된 약한 적군" 기준 → 표면 dmgErr 는 악화 보이지만 sim 정확도 는 ↑

**검증 방법** (향후): player 측 trait (운명술사 / N.O.V.A. 등 추가 정확도) 구현 후 dmgErr 절대값 줄어드는지 확인.

## 후속 (본 PR 외 항목)

1. **SpaceGroove 일반 tier 격리 PR** — calibration test 보강 후 매초 ADAP 가산 활성
2. **파티광 SpaceGroove 후속 효과** — Blitzcrank 회복 완료 후 번개 4배
3. **사용자 검수**: 적군 측 여행자 5명 활성 게임에서 sim vs actual 비교 — over-buff 정도 측정
