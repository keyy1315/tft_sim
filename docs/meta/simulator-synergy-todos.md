# 시뮬레이터 시너지 구현 TODO

> 작성일: 2026-04-23
> 용도: actual-data 기록 툴에 포함되지만 **시뮬 엔진에는 미구현**인 시너지들의 추후 구현 가이드
> 연관 스펙: `docs/superpowers/specs/2026-04-23-actual-data-design.md`

## 현황

| 시너지 | 이름 | actual-data 기록 | 시뮬 엔진 구현 |
|-------|------|--------------|------------|
| 중재자 | Arbiter | ✅ Phase 1 | ✅ **이미 구현** (`ArbiterLaw`) |
| 별돌보미 | Stargazer | ✅ Phase 1 | ❌ **Phase 2 TODO** |
| 최신상 | Factory New | ✅ Phase 1 | ❌ **Phase 2 TODO** |

Phase 1 완료 시점에 actual-data JSON은 완성되지만, 시뮬 투입 시 별돌보미/최신상 효과는 반영되지 않아 diff가 부정확. Phase 2에서 이 두 시너지 엔진 구현.

---

## TODO 1 — 별돌보미 (Stargazer) 시뮬 엔진 구현

### 구현 범위
- 게임 레벨 `stargazerConstellation` 값을 읽어 7개 별자리 중 하나의 효과 적용
- 팀 레벨 `stargazer.revealedTiles` 좌표들에 있는 아군에게 효과 적용
- (3) 별돌보미 시너지 활성 조건 체크 — 보드에 별돌보미 유닛 3명 이상이어야 효과 발동

### 별자리별 능력치 표 (시뮬 엔진 입력)

> 출처: `docs/meta/set17-stargazer-constellations.md`
> 색 아이콘 누락된 스탯은 `?` — 영상/툴팁 확인으로 확정 필요

#### 1. 제단 (altar)
| 시너지 티어 | 기본 효과 (강화 칸 아군) | 추가 효과 (강화 칸 별돌보미, 제물 60회 이상 시) |
|-----------|--------------------|------------------------------------|
| (3)+ | 체력 +8%, 공속 +8% | AD +20%, AP +18% (의심) |

- 발동 조건: 챔피언 사망 1회 = 제물 1회
- 60회 제물 누적 시 강화 효과 해금

#### 2. 멧돼지 (boar)
| 티어 | 골드 / AD% / AP% | 기본 효과 (강화 칸) |
|-----|----------------|----------------|
| (3) | 1골드 / 2% / 10% | 체력·AD·AP +8% |
| (4) | 2골드 / 8% / 15% | 동일 |
| (5) | 4골드 / 15% / 25% | 동일 |
| (6) | 6골드 / 22% / 30% | 동일 |

- 골드는 PvP 승리 후 자동 획득 (시뮬 외부)
- AD/AP% 는 강화 칸 별돌보미에 **추가** 적용

#### 3. 우물 (well)
| 티어 | 마나 재생 | 스킬 피해 → 체력 회복 |
|-----|---------|----------------|
| (3) | +1 | 18% |
| (5) | +5 | 25% |

- 강화 칸 아군: 마나 재생
- 별돌보미: 스킬로 체력 가장 낮은 아군에게 자체 회복 적용

#### 4. 여사냥꾼 (huntress)
| 티어 | 공속 (강화 칸 아군) | 표식 수 (전투 시작 시 체력 가장 높은 적) |
|-----|----------------|------------------------|
| (3) | +15% | 3 |
| (5) | +30% (강화 칸 별돌보미) | 5 |
| (7) | +45% (강화 칸 별돌보미) | 7 |

- 공속 +15%는 기본(모든 강화 칸 아군), 높은 티어 % 는 별돌보미 전용 추가
- 표식 적 사망 시 최대 체력 10% 회복

#### 5. 메달 (medal)
| 티어 | 피해 증폭 (강화 칸 아군) |
|-----|------------------|
| (3) | +12%, 아군 3성 유닛 하나당 +6.5% 추가 |

- 단순 구조 — 3성 유닛 수 카운트로 배수 계산

#### 6. 산 (mountain)
| 티어 | 강화 칸 별돌보미 누적 효과 |
|-----|--------------------|
| (3) | 체력 +12% |
| (4) | +AD·AP +12% |
| (5) | +방어력·마법 저항력 +12 |
| (6) | +공속 +12% |
| (7) | +내구력 +6% |
| (8) | 그 외 모든 추가 효과 10% 증가 |
| (9~11) | 후반 대형 효과 (별자리 고유 텍스트) |

- 플레이어 대상 전투 5회마다 별돌보미 상징 획득 (시뮬 외부)

#### 7. 뱀 (snake)
| 티어 | 내구력 (강화 칸 아군) | 중독 피해 (강화 칸 별돌보미) |
|-----|----------------|--------------------|
| (3) | +5% | 25% |
| (5) | +10% | 40% |
| (7) | +15% | 60% |

- 중독: 입힌 피해 일부를 3초에 걸쳐 마법 피해로 재적용

### 시뮬 엔진 구현 체크리스트
- [ ] `src/lib/simulator/systems/stargazer.ts` 신설
- [ ] 전투 루프 시작 시 강화 칸 점유 아군 탐색 (hex 기준)
- [ ] 각 별자리별 효과 스탯 적용 (AD/AP/HP/AS/내구력/MR/방어력 등)
- [ ] `docs/meta/set17-stargazer-constellations.md` 데이터를 `src/data/stargazer_constellations.json`으로 변환
- [ ] 3/5/7 티어 조건 체크 (시너지 활성 단계)
- [ ] 별돌보미 유닛 여부에 따라 기본/추가 효과 분리 적용
- [ ] 누적 카운터(제물·표식)는 MVP 제외, 전투 시작 시점 이미 달성된 상태 가정

### 미해결
- 색 아이콘 누락된 스탯이 AD/AP 중 어느 쪽인지 확정 (인게임 툴팁)
- 플레이어 레벨별 강화 칸 개수 공식

---

## TODO 2 — 최신상 (Factory New) 시뮬 엔진 구현

### 구현 범위
- 팀의 `factoryNew.upgradePath` 배열 순회 → 그레이브즈(가장 강한 1명)에게 누적 효과 적용
- 프레임(루트)은 그레이브즈의 기본 특성/능력치를 변경
- 하위 업그레이드는 스탯 버프 또는 특수 메커닉 추가

### 프레임 3종 기본 효과 (`upgradePath[0]`)

| key | 이름 | 효과 |
|-----|------|------|
| `CloseQuarters` | 맹공 프레임 | 사거리 -2, 공격력 전사화, 체력 +250, 흡혈 +10%, AD +25% |
| `SharpshooterModule` | 위력 프레임 | 정밀 획득, 스킬 피해 +5% (정밀 = 스킬 치명타 가능) |
| `DoubleTap` | 사수 프레임 | 20% 확률로 2회 공격 |

### 하위 업그레이드 효과

> 정확한 트리 구조 + 전체 노드 효과: `docs/meta/set17-factory-new-arsenal.md` 참고

**단순 스탯 버프 (엔진 구현 쉬움)**:
- `LeechingImplants` / `LeechingImplants2` — 흡혈, AD
- `HeavyPlating` — 체력, 방어력, 마법 저항력
- `PrecisionScope` / + / ++ — 사거리, AD
- `Fission` / + / ++ — 마나 재생, AD
- `Heartseeker` / + / ++ — 치명타 확률·피해
- `Tankbuster` — 탱커 대상 피해 증폭
- `Coolant` / + — 마나 소모 감소
- `APRounds` / + — 적 방어력 무시 %

**특수 메커닉 (별도 구현 필요)**:
- `Buckshot` 계열 — 투사체 수 증가
- `Choke` — 투사체 분산 감소
- `LaserBallistics` — 관통, 관통 대상당 피해 감소
- `Meltthrough` — 매초 주변 적 방어력 감소
- `GravBooster` / + — 처치 관여 시 돌진 + 공속 버프
- `EmergencyShielding` / + — 저체력 시 보호막
- `Shockwave` — 전투 시작 전방 충격파 + 기절
- `SheerMass` — 크기 증가 (히트박스 영향?)
- `Nanomachines` — 초당 체력 회복
- `ReactiveArmor` — 피해 받을 때마다 방어력 누적
- `BlastRadius` 계열 — 2차 폭발 반경
- `SympatheticDetonation` — 2차 반경 폭발
- `LatentExplosion` — 피해 저장 + 처치 시 방출
- `VoidCoefficient` — 스킬마다 마나 감소 %
- `AimAssistant` — 거리 기반 추가 피해
- `DoubleTap2` / `TripleTap` — 2회/3회 공격 확률
- `RevUp` / + — 연속 공격 시 공속 증가
- `RipperBullets` / + — 기본 공격 시 방어력/마법 저항력 감소
- `FragmentationRounds` / + — 기본 공격 시 파편

### 시뮬 엔진 구현 체크리스트
- [ ] `src/lib/simulator/systems/factoryNew.ts` 신설
- [ ] 데이터 파일 `src/data/factory_new_upgrades.json` 생성 (트리 구조 + 효과 파라미터 정규화)
- [ ] "초크" 중복 이름 처리: id에 parent path 포함하거나 별도 suffix (`Choke_A`, `Choke_B`, `Choke_C`)
- [ ] `upgradePath` 순회해 각 업그레이드 `applyToUnit(graves)` 적용
- [ ] 프레임 루트는 특성/능력치 근본 변경 (role, 사거리, 공격력 수식)
- [ ] 특수 메커닉은 이벤트 훅으로 구현 (전투 시작 시, 매초, 공격 시, 처치 시, 피해 받을 시 등)
- [ ] "가장 강한" 그레이브즈 1명만 대상: 별 레벨 → 장착 아이템 순 tie break (임시 규칙)
- [ ] `nextUpgradeRoundsRemaining` 관리 (actual-data에 기록된 값 그대로 시뮬 입력 가능)

### 미해결
- 첫 업그레이드 필요 라운드 수
- 그레이브즈 사망/판매 시 업그레이드 persists 여부
- "가장 강한" 기준 정확한 룰

---

## TODO 3 — 암흑의 별 (DarkStar) — Tier별 잔여 효과

> 작성일: 2026-04-28 (PR #31 후속)
> 상태: (4) ADAP=45% 만 구현됨. 나머지 tier 효과 후속 PR 필요.

### 현재 구현 (PR #31)
- (4) AD/AP +45% (ADAP=45) — `applyDarkStarEffects` (combatLoop.ts)

### 후속 PR 범위

#### (2) 블랙홀 execute
- 8% maxHP 이하 적을 집어삼키는 블랙홀 생성 (ExecuteHPPercent=0.08)
- 메커니즘 추정: 매 N초 또는 처치 trigger 시 black hole 소환 → execute zone
- 단순 구현: 매 tick 마다 적군 중 currentHp/maxHp <= 0.08 인 unit 즉사 처리
- 정확 구현: 시각적 black hole entity 추가 + 소환 cooldown

#### (6) Supermassive (가장 강한 1명)
- 가장 강한 암흑의 별 unit → "초대질량 상태" → 암흑의 별 효과 +85% (SupermassivePercentBonus=0.85)
- "가장 강한" 기준: 별 레벨 → cost → 장착 아이템 수 순 tie break (Graves 패턴 동일)
- 효과 +85%: ADAP=45 가 supermassive unit 한정 ADAP=45*1.85=83.25 (?)
- 추가: 소형 블랙홀 2개 생성 (small execute zones)
- 변수 PercentHealth=0.30 — supermassive unit 추가 maxHp +30% 가능성 (확인 필요)

#### (9) 모든 Supermassive — **프리즘 시너지**
- 모든 암흑의 별 unit 이 Supermassive 상태
- **10레벨 달성 시 모두를 빨아들임** = 무조건 승리 (prism 시너지 패턴)
- 시뮬 처리: 플레이어가 (9) DarkStar 활성 + 레벨 10 → `winner = 'player'` 즉시 반환
- 단, 레벨 정보를 sim 입력에 포함해야 함 (현재 stageNumber 만 있음)

### 참고 변수
- `ExecuteHPPercent: 0.08` — (2) execute 임계값
- `ADAP: 45` — (4)+ AD/AP %
- `SupermassivePercentBonus: 0.85` — (6) 효과 +85%
- `PercentHealth: 0.30` — (?) supermassive HP bonus 추정

---

## TODO 4 — 정령족 (Astronaut) — Tier별 잔여 효과

> 작성일: 2026-04-28
> 상태: BonusHealth flat 만 구현됨 (`applyAstronautEffects`). Meeps 메커니즘 + (10) prism 후속 PR 필요.

### 현재 구현
- (3)/(5)/(7)/(10) 모두 정령족 unit `maxHp += BonusHealth` (100/400/400/500)

### 후속 PR 범위

#### Meeps 챔프별 메커니즘
- 각 정령족 챔프 ability 의 "Meep Bonus" 텍스트 (`TFT17_Astronaut_IsActive` 조건):
  - **Bard**: combat start 시 가장 가까운 N 명 정령족 동료에게 추가 Meep 부여
  - **Gnar**: 5번째 attack 마다 부메랑 + Meep 들이 추가 공격
  - **Fizz**: spell 시 Mega Meep 소환 (knockup + secondary damage)
  - **Rammus**: 보호막 + 공격 받을 때 incoming damage 감소 + N회 후 폭발
  - **Poppy**: 보호막 + 인접 정령족에 Armor/MR + Meep shield
  - **Corki**: 미사일 polish + Explosive Meep
  - **Veigar**: 메타 추가 mini Meepteor
  - **IvernMinion**: heal + slam + Meep 들이 healing 증폭
- 각 챔프 ability 처리 시 `unit.unitHasTrait('정령족') && trait.style >= 1` 체크 후 추가 효과
- Meeps 카운터 개념: trait.activeEffect.variables.Meeps (2/3/4/6) 값을 챔프 ability ModifiedNumMeeps 인자로 전달

#### (7) tier 복제 슬롯 (게임-level)
- 대기석 복제 슬롯 → 챔피언 1성 복사본 + 골드 — sim 외 (라운드 사이 메커니즘)

#### (10) 정령군주 넷 소환 — **프리즘 시너지**
- desc: "정령군주 넷 소환!" — 4성 정령군주 (Meeplord) 4마리 등장
- raw data 조사:
  - `TFT17_Astronaut` effects (10) variables: `Meeps=6, BonusHealth=500` 외 별도 prism 변수 **없음**
  - "정령군주" / "Meeplord" 별도 apiName **존재 안 함** (`grep TFT17.*[Ll]ord` 0건)
  - Meep 챔프 entity: TFT3_BardMeep, TFT14_AnimaSquadMeep 만 — TFT17 별도 정의 없음
  - 게임 내 hidden behavior — CommunityDragon 에 메커니즘 정의 없음
- DarkStar (9) 와 동일한 prism 패턴: 게임 메타 효과 → sim 직접 처리 대신 special-case
- 시뮬 처리 안:
  1. (10) Astronaut 활성 조건 감지 → `winner = 'player'` 즉시 반환 (또는 더미 강력한 4성 unit 4마리 spawn)
  2. 보드에 정령군주 챔프 4마리를 시뮬 시작 시 자동 추가 (champ data 별도 필요 — 게임 내부 데이터)

### 참고 변수
- `Meeps: 2/3/4/6` — Meep 카운트 (각 tier)
- `BonusHealth: 100/400/400/500` — flat HP

---

## 프리즘 시너지 일반 패턴

> 작성일: 2026-04-28

set 17 의 일부 trait 는 최고 tier (보통 10명 한계) 활성 시 **무조건 승리** 효과.
공통 특징:
- desc 의 마지막 행에 "정령군주 넷 소환!", "10레벨 달성 시 모두를 빨아들임" 등 표현
- raw data 의 effects variables 에 별도 prism 메커니즘 변수 없음
- CommunityDragon 외부 (게임 내부) 에서 처리되는 메커니즘

### 알려진 프리즘 trait
- **암흑의 별 (DarkStar) (9)** — "10레벨 달성 시 모두를 빨아들임"
- **정령족 (Astronaut) (10)** — "정령군주 넷 소환!"

### 시뮬 통합 가이드
- prism 발동 조건 감지: trait.style 가 (9)/(10) 행 style 값 + 플레이어 레벨 10
- 처리 전략:
  1. **단순**: prism 발동 시 즉시 `winner = 'player'` 반환 (실용적)
  2. **시각적**: hidden 4성 unit 들을 board 에 추가 후 정상 sim
  3. **혼합**: prism 발동 표시 log 만 남기고 actual 결과는 (1)
- actual-data 기록: 게임 결과로 자동 반영 — sim 입력에는 prism flag 만 추가

---

## TODO 5 — 중재자 (Arbiter) — **이미 구현됨**

`src/components/builder/ArbiterLawPanel.tsx`, `src/types/index.ts:331`, `src/data/arbiter_laws.json` 있음.
actual-data 툴에서는 기존 타입 그대로 재사용. 구현 작업 없음.

---

## 참고

- 별돌보미 세부: `docs/meta/set17-stargazer-constellations.md`
- 최신상 세부: `docs/meta/set17-factory-new-arsenal.md`
- 중재자 기존 구현: `src/components/builder/ArbiterLawPanel.tsx`
- 전체 Phase 경계: `docs/superpowers/specs/2026-04-23-actual-data-design.md` §12
