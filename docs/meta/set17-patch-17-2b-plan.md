# Set 17.2b 마이크로 패치 — 시뮬 적용 계획

> 작성일: 2026-04-30
> 출처: 공식 patch notes "17.2 April 29th Mid-Patch Update" 섹션
> 라이브 출시: 2026-04-29
> 출처 URL: <https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-2/>

## 17.2b 변경 내역 (전체)

### 신의 제안 (Market Offerings)

- 스레쉬의 판도라 좌석: 빈도 감소, 스테이지 3 전용 — **시뮬 무관 (이미 disabled)**

### 증강

| 증강 (한글) | apiName | 변경 |
|---|---|---|
| 군체의 심장 | `TFT17_Augment_PrimordianPrismaticAugment` | 버그로 비활성화 |
| 뜨거운 죽음 (모데카이저) | `TFT17_Augment_MordekaiserCarry` | 보호막 175/200/250 → **225/250/300 AP** |
| 신병 | (raw 누락) | 4코스트 수 3 → **1** |
| 자폭 (그라가스) | `TFT17_Augment_GragasCarry` | 체력 비용 30%→**20%**, 헥스당 감소 55%→**45%** |
| 방패 여전사 (레오나) | `TFT17_Augment_LeonaCarry` | 능력 데미지 110/165/250 → **90/135/225 AD** |

### 시너지

| 시너지 | 변경 | 시뮬 영향 |
|---|---|---|
| Timebreaker | XP 2/3/4/4/4 → 1/2/2/3/4, 리롤 1/2/2/3/3 → 1/1/2/2/3 | **없음 (econ trait, 전투 외)** |

### 챔프 (champions.json)

| 챔프 | apiName | variable | 현재 [1성/2성/3성] | 17.2b [1성/2성/3성] | 4성 |
|---|---|---|---|---|---|
| 브라이어 | `TFT17_Briar` | `ADDamage` | 130/195/320 | **120/180/285** | 550 보존 |
| 레오나 | `TFT17_Leona` | `ShieldAmount` | 420/500/685 | **420/480/620** | 870 보존 |
| 잭스 | `TFT17_Jax` | (확인 필요) | 400/500/625 | **400/470/550** | (확인 필요) 보존 |

### 버그 수정

- 블리츠크랭크 부활 상호작용
- 마스터 이 돌진 속도/타게팅 로직
- 케일의 명품(Craftmanship) 골드 획득
- 바루스 별교차의 축복(Starcrossed) 지속시간
- 유연한 / 사다리 오르기(Climb the Ladder) 증강 → 소환수 제외

## 데이터 수정 원칙 (사용자 강조)

**전체 덮어쓰기 절대 금지**. raw data 파일 수정 시 반드시 변경된 필드만 부분 Edit. 17.2 작업 시 전체 augment JSON 덮어쓰기로 사용자가 직접 작성한 임의 필드 (특히 raw 에 desc 없던 augment 의 한글 제목) 가 모두 날아간 사고 발생. 같은 사고 재발 방지.

## PR 분리 전략

작업량과 위험도에 따라 3개 PR 로 분리. 각 PR 은 독립적으로 머지 가능.

---

## PR1 — 직접 수치 변경 + 군체의 심장 disabled

**브랜치**: `feature/patch-17-2b-direct-numbers`
**예상 시간**: 30분
**위험도**: 낮음 (raw value 배열 1개 위치 변경 × 3 + Set 1줄 추가)

### 변경 파일

#### 1. `public/data/tft_set17_champions.json`

**브라이어 ADDamage** (line ~367)

```json
// before
"value": [3.299999952316284, 130, 195, 320, 550, 3.299999952316284, 3.299999952316284]
// after
"value": [3.299999952316284, 120, 180, 285, 550, 3.299999952316284, 3.299999952316284]
```

해석: index `[plus, 1성, 2성, 3성, 4성, reserved, reserved]`. 4성 550 보존.

**레오나 ShieldAmount** (line ~4887)

```json
// before
"value": [0, 420, 500, 685, 870, 0, 0]
// after
"value": [0, 420, 480, 620, 870, 0, 0]
```

1성 420 / 4성 870 보존, 2성·3성만 변경.

**잭스 ShieldAmount** (위치 확인 필요)

```json
// before
"value": [..., 400, 500, 625, ?, ...]
// after
"value": [..., 400, 470, 550, ?, ...]
```

#### 2. `src/data/disabledContent.ts`

`DISABLED_AUGMENT_API_NAMES` Set 에 추가:

```ts
'TFT17_Augment_PrimordianPrismaticAugment',  // 군체의 심장 — 17.2b 버그로 비활성화
```

기존 패턴 (집중/시간의흐름/중성자별 등) 과 동일.

### 검증

- [ ] `pnpm lint && pnpm typecheck && pnpm build`
- [ ] 기존 회귀 가드 테스트 통과
- [ ] 추가: 17.2b 회귀 가드 (브라이어/레오나/잭스 stat 매핑)

### Q3 — disable 일관성 + 모달 필터링 (별도 코멘트 첨부)

PR1 본문이 아닌 **별도 분석 코멘트** 로 정리:

- raw augments JSON 의 `disable: true` 항목 카운트 + apiName 리스트
- `DISABLED_AUGMENT_API_NAMES` Set 와 비교 — 누락/중복 확인
- 모달 필터링 코드 위치 (`loader.ts` / `serverCatalogs.ts`) 의 disable 처리 흐름 인덱싱

---

## PR2 — 신병 (New Recruit) augment 추가

**브랜치**: `feature/patch-17-2b-new-recruit`
**예상 시간**: 1시간
**위험도**: 중 (raw JSON 신규 객체 추가, 사용자 작성 필드 절대 보존)

### 작업

1. **CommunityDragon fetch** — 신병 (TFT_Augment_NewRecruit 또는 유사) raw 객체
   - URL 후보: `https://raw.communitydragon.org/latest/cdragon/tft/en_us.json` (검색)
   - 또는: `https://raw.communitydragon.org/latest/cdragon/tft/ko_kr.json` (한글)
2. **raw JSON 추가** — `public/data/tft_set17_augments.json`
   - 기존 객체 0개 수정, 신규 객체 1개 append (배열 마지막 또는 적절한 위치)
   - 17.2b 수치: 4코스트 수 = **1** (effects 의 NumChampsToGrant 또는 유사)
   - `disable: false`
3. **검증**
   - 기존 augment 들의 사용자 작성 필드 (예: 한글 desc/name) 변경 없는지 git diff 확인 — **반드시 추가 분만 보이도록**
   - 모달/빌더에서 신병 정상 노출

### 결정 필요사항

- 한글 name/desc — CDragon `ko_kr.json` 에서 가져오거나, 사용자 별도 제공
- effects 변수 이름 정확 매칭 (NumChampsToGrant vs 다른 이름)

---

## PR3 — Hero Augment stat/ability 시스템 (큰 리팩토링)

**브랜치**: `feature/hero-augment-stat-system`
**예상 시간**: 2-3시간
**위험도**: 중-높음 (시뮬 로직 변경, 회귀 가드 필수)

### 배경 — 사용자 명시 (메모 보존)

> "영웅 증강이 있는 챔피언들 (레오나, 나서스, 뽀삐, 그라가스, 파이크, 아트록스, 잭스, 꼬마정령) 은 챔피언의 역할군이 변경되면서 (ex: 레오나는 보드 위의 가장 강한 아군 레오나가 공격력 전사로 변경됨) 스킬과 챔피언의 능력치도 변경됨. 해당 부분을 인지하여 '영웅 증강' 의 유닛 스탯을 따로 작성 할 수 있도록 구현"

### 현재 상태 분석

`src/data/carryAugments.ts` 의 `CARRY_AUGMENTS`:

| augment | abilityData | stat override |
|---|---|---|
| `NasusCarry` | ✅ damage [280/420/670] | ❌ |
| `AatroxCarry` | ✅ damage [140/210/315] | ❌ |
| `PoppyCarry` | ✅ damage [100/150/240] | ❌ |
| `LeonaCarry` (방패 여전사) | ❌ | ❌ |
| `IvernMinionCarry` (꼬마정령) | ✅ damage [200/300/480] | ❌ |
| `JaxCarry` | ✅ damage [60/90/140], selfBuff AS+0.3 | ❌ |
| `PykeCarry` | ✅ damage [200/300/480] | ❌ |
| `MordekaiserCarry` (뜨거운 죽음) | ❌ | ❌ |
| `GragasCarry` (자폭) | ❌ | ❌ |

### 구현 범위 (사용자 결정 — 17.2b 한정)

> "일단 지금 나온 레오나의 스킬 피해량 ad, 그라가스의 체력 소모 및 스킬 피해량의 칸당 감소량만 적용. 나머지 데이터는 내가 찾아볼게"

**본 PR 범위**:

1. **`CarryAugmentConfig` 타입 확장**
   - `statOverrides?: Partial<{ hp, armor, magicResist, damage, attackSpeed, range, mana, ... }>`
   - `abilityData` 의 `damage` 외 augment 전용 변수 (shield, healthCost, hexReduction 등) 정의 가능하도록 generic 변수 슬롯 추가
2. **레오나 (방패 여전사) abilityData 추가** — damage `[90, 135, 225]`, type=`physical`
3. **그라가스 (자폭) abilityData 추가** — `healthCost: 0.20`, `hexReduction: 0.45`, damage 는 게임 내 표기 확인 필요 (현재 raw Gragas Damage 변수 그대로 쓰는지 검증)
4. **`applyHeroCarryTransforms` 확장** — `statOverrides` 적용 코드 (현재는 role 만 변경)
5. **자폭 selfDamage 로직 수정** — 현재 `selfDamageHpFloor: 1` 만 있음. 17.2b 의 healthCost 20% (자기 maxHp 의 20%) + hex 거리당 추가 감소 45% 정확히 구현
6. **회귀 가드** — augment 활성 vs 비활성 비교 테스트 (레오나 damage / 그라가스 self-damage)

**본 PR 범위 외 (사용자가 직접 찾아볼 데이터)**:

- 모데카이저 (뜨거운 죽음) shield 225/250/300 — 사용자가 stat/ability 데이터 제공 후 후속 PR
- 나서스/뽀삐/파이크/아트록스/잭스/꼬마정령의 변환 후 stat (HP/AS/range 등) — 사용자가 게임에서 확인 후 제공

### 검증

- [ ] augment 비활성 시 기존 stat 그대로 (회귀 없음)
- [ ] augment 활성 시 statOverrides 정확히 적용
- [ ] 레오나 carry damage = 90/135/225 (1성/2성/3성)
- [ ] 그라가스 자폭 self-damage = maxHp × 0.20, hex distance 비례 감소 0.45
- [ ] `pnpm lint && pnpm typecheck && pnpm build`
- [ ] 모든 기존 hero augment 테스트 통과

---

## 작업 순서 (다른 세션 인계용)

1. ~~**PR1 부터 시작**~~ ✅ **머지 완료** (PR #67) — 직접 수치 변경 + 군체의 심장 disabled
2. ~~PR1 머지 후 **PR3 (Hero Augment 시스템)** 먼저 진행~~ — **본 PR 진행 중** (PR2 신병 추가는 후순위로 미룸 — 사용자 결정)
3. **PR3 머지 후 PR2** — 신병 CDragon fetch 후 추가
4. **후속 PR** — 사용자 인게임 stat 측정 결과로 statOverrides 채우기 + 복잡 메커니즘 (3-skill cycle / X-shape / bouncing / 미프) 시뮬 적용

각 PR 별로 codex 리뷰 결과 확인 → 수정 → 멘션 → 머지.

## PR3 본 PR 적용 항목 (2026-04-30 작업)

✅ **본 PR 적용**:
- `CarryAugmentConfig.statOverrides` 슬롯 (사용자 추후 채움)
- `CarryAbilityData` 확장 (shield/healthCost/hexReduction/asGain/secondaryDamage 등 27 변수)
- 8 영웅 증강 모두 `abilityData` 채움 (사용자 인게임 데이터 기반)
- 17.2b 변경분 정확 반영:
  - 그라가스 자폭 `healthCost: 0.20`, `hexReduction: 0.45`
  - 모데카이저 뜨거운 죽음 `shield: [225, 250, 300]`
  - 레오나 방패 여전사 `damage: [90, 135, 225]`
- `applyHeroCarryTransforms` generic 화 (CARRY_AUGMENTS iterate, statOverrides 적용)
- 자폭 self-damage 가 `maxHp × healthCost` 정확 적용
- 회귀 가드 19 tests 신규

⏭️ **후속 PR (구현 미완)**:
- 자폭 적군 damage / hexReduction / 탱커 +60% 시뮬 적용 (현재 적군 damage flow skip 구조)
- augment-specific damage 시뮬 분기 (레오나 90/135/225, 잭스 starLevel asGain, 모데 shield 등)
- 파이크 X-shape 멀티 타겟 + onKill 재시전
- 꼬마정령 multi-stun + 미프 스케일
- 아트록스 3-skill cycle + N.O.V.A.
- 뽀삐 bouncing projectile + 미프
- `statOverrides` 슬롯 사용자 인게임 측정 후 채움

## 참고 문서

- 17.2 trait audit: [`set17-trait-audit.md`](./set17-trait-audit.md)
- 영웅 증강 시뮬 처리: `src/data/carryAugments.ts` + `src/lib/simulator/engine/combatLoop.ts:1500-1533`
- disabled augment 패턴: `src/data/disabledContent.ts`
- 데이터 수정 원칙 (전체 덮어쓰기 금지) — 메모리 `feedback_data_edit.md`
