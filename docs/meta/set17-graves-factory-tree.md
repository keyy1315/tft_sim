# 그레이브즈 최신상(GravesTrait) 무기고 트리 시스템

> 작성: 2026-04-29
> 출처: https://lolchess.gg/rewards/set17/factory-new
> raw data: `public/data/tft_set17_items.json` (52 entries — 3 frames + 49 upgrades, 1 disabled FrameDefense/FrameSupport)

## 개요

Set 17 그레이브즈 전용 시너지 **`최신상`(GravesTrait)** 의 핵심 메커니즘.
보드 위 그레이브즈 (가장 강한 1명) 가 라운드마다 무기고를 열어 영구 업그레이드를
구매한다. **51개 weapon 노드** 가 **3-path tree** 로 연결되어 있고, 매 라운드 마다
4개 옵션 중 1개를 선택한다 (round 1만 3개).

---

## 🎯 선택 메커니즘

### Round 1 — Root Frame 선택 (3 options)
보드 위 그레이브즈가 등장한 첫 무기고에서 3개 root frame 중 1개:

| Frame | 효과 |
|---|---|
| **맹공 프레임** (CloseQuarters) | 사거리 -2, 공격력 전사로 변환. +HP 250, 흡혈 +10%, AD +25% |
| **위력 프레임** (SharpshooterModule) | 정밀(spellCanCrit) 획득 + 스킬 피해 +5% |
| **사수 프레임** (DoubleTap) | 25% 확률 2회 공격 |

### Round 2 — Root 의 직속 children (4 options)
선택한 root frame 의 **직속 자식 노드 4개** 가 옵션으로 등장.

예: **맹공 프레임 선택** → 다음 라운드 옵션:
- 흡수 임플란트
- 산탄 사격
- 용융 관통
- 긴급 보호막

### Round 3+ — 가지 진행 + sibling pool 랜덤 (4 options)
선택한 weapon 의 **next-tier children** + **남는 자리에 sibling pool 에서 랜덤** 으로 4개 채움.

예: 라운드 2 에 **긴급 보호막** 선택 → 라운드 3 옵션:
- 긴급 보호막+ (next-tier)
- 두꺼운 장갑판 (next-tier)
- (흡수 임플란트 / 산탄 사격 / 용융 관통 중 2개 랜덤) — 라운드 2 sibling pool 에서 채움

매 라운드 **4개 중 1개 선택** → 영구 stat 누적.

> "남는 자리에 2번째 root 의 랜덤 무기고" — 즉 round 2 에 형제였던 weapon 중에서
> 아직 픽 안 된 것을 채움. round 진행될수록 pool 이 점점 줄어듦.

---

## 🌲 51 Weapon Tree 전체 구조

### 🟦 맹공 프레임 path (#3E3F87, 19 노드)

```
맹공 프레임 (cost=0) [root]
├─ 흡수 임플란트 (0)
│  └─ 흡수 임플란트+ (2)
│     └─ 초크 (5) ※ 위력 path 와 공유
├─ 산탄 사격 (2)
│  └─ 산탄 사격+ (3)
│     └─ 산탄 사격++ (3)
│        └─ 레이저 탄도학 (6)
├─ 용융 관통 (2)
│  └─ 중력 증폭기 (3)
│     └─ 중력 증폭기+ (6)
└─ 긴급 보호막 (0)
   ├─ 긴급 보호막+ (2)
   ├─ 두꺼운 장갑판 (3)
   ├─ 충격파 (6)
   ├─ 순수 질량 (5)
   ├─ 나노머신 (6)
   └─ 반응형 방어구 (6)
```

### 🟥 위력 프레임 path (#622B22, 19 노드)

```
위력 프레임 (cost=0) [root]
├─ 폭발 반경 (2)
│  └─ 폭발 반경+ (3)
│     └─ 폭발 반경++ (6)
│        └─ 공감성 폭발 (6)
├─ 심장추적자 (2)
│  └─ 심장추적자+ (3)
│     └─ 심장추적자++ (6)
├─ 탱커 파괴자 (0)
│  ├─ 지연 폭발 (3)
│  └─ 철갑탄 (3)
│     └─ 철갑탄+ (6)
│        └─ 초크 (5) ※ 맹공 path 와 공유
├─ 냉각수 (2)
│  └─ 냉각수+ (3)
│     └─ 공허 계수 (6)
└─ 분열 (0)
   └─ 분열+ (3)
      └─ 분열++ (6)
```

### 🟨 사수 프레임 path (#615A3F, 13 노드)

```
사수 프레임 (cost=0) [root]
├─ 정밀 조준경 (0)
│  └─ 정밀 조준경+ (2)
│     └─ 정밀 조준경++ (5)
│        └─ 조준 보정 (6)
├─ 한 발에 두 놈 (2)
│  └─ 한 발에 세 놈 (3)
├─ 엔진 가동 (3)
│  └─ 엔진 가동+ (6)
├─ 파쇄 탄환 (2)
│  └─ 파쇄 탄환+ (3)
└─ 파편탄 (2)
   └─ 파편탄+ (3)
```

> ⚠️ **트리 정확도 주의**: 위 구조는 lolchess HTML 의 indentation + 색상 그룹 기반
> 추정. **공식 문서 / Riot raw schema 가 없는 상태** 라 sibling group 정확한 분기 (예:
> 긴급 보호막 의 6개 children 이 한 노드 children 인지, 별도 sub-group 인지) 는
> 추가 검증 필요. **시뮬 구현 시 in-game 데이터 채굴 / playtest 결과** 와 대조 권장.

---

## 📋 51 Weapon 카탈로그 (cost / 효과)

| # | 카테고리 | 이름 | apiName 접미사 | cost | 효과 |
|---|---|---|---|---|---|
| 1 | 맹공 root | 맹공 프레임 | CloseQuarters | 0 | 사거리 -2, 공격력 전사. +HP 250 / 흡혈 +10% / AD +25% |
| 2 | 맹공 sub | 흡수 임플란트 | LeechingImplants | 0 | 흡혈 +10%, AD +10% |
| 3 |  | 흡수 임플란트+ | LeechingImplants2 | 2 | 흡혈 +15%, AD +20% |
| 4 |  | 초크 | Choke | 5 | 투사체 분산 75% 감소 (※ 위력 path 와 공유) |
| 5 |  | 산탄 사격 | Buckshot | 2 | 투사체 +2, 확산 +20% |
| 6 |  | 산탄 사격+ | Buckshot2 | 3 | 투사체 +4, 확산 +30% |
| 7 |  | 산탄 사격++ | Buckshot3 | 3 | 투사체 +6, 확산 +40% |
| 8 |  | 레이저 탄도학 | LaserBallistics | 6 | 1칸 추가 비행 + 관통 (관통한 적 1명당 -50% 피해) |
| 9 |  | 용융 관통 | Meltthrough | 2 | 매초 2칸 적 armor -4 (인접 ×2) |
| 10 |  | 중력 증폭기 | GravBooster | 3 | 처치 관여 시 다음 대상으로 dash + AS +40% (2회 공격 동안) |
| 11 |  | 중력 증폭기+ | GravBooster2 | 6 | 동상 + 3회 공격 동안 |
| 12 |  | 긴급 보호막 | EmergencyShielding | 0 | HP 40% 시 maxHp×50% shield 2.5초 |
| 13 |  | 긴급 보호막+ | EmergencyShielding2 | 2 | HP 40% 시 maxHp×75% shield 4초 |
| 14 |  | 두꺼운 장갑판 | HeavyPlating | 3 | +HP 300, +Armor 20, +MR 20 |
| 15 |  | 충격파 | Shockwave | 6 | 전투 시작 시 전방 충격파 (maxHp×15% 마법 + 2초 stun) |
| 16 |  | 순수 질량 | SheerMass | 5 | maxHp +25% (+크기) |
| 17 |  | 나노머신 | Nanomachines | 6 | 매초 maxHp 3% 회복 |
| 18 |  | 반응형 방어구 | ReactiveArmor | 6 | 피격 시 +Armor/MR 4 (최대 50회 stack) |
| 19 |  | (FrameDefense) | FrameDefense | — | **Riot 미구현** (lolchess 미표시) |
| 20 | 위력 root | 위력 프레임 | SharpshooterModule | 0 | 정밀 + 스킬 피해 +5% |
| 21 | 위력 sub | 폭발 반경 | BlastRadius | 2 | 2차 폭발 +1칸 (추가 칸당 -50% 피해) |
| 22 |  | 폭발 반경+ | BlastRadius2 | 3 | +2칸 (-30% per) |
| 23 |  | 폭발 반경++ | BlastRadius3 | 6 | +3칸 (-30% per) |
| 24 |  | 공감성 폭발 | SympatheticDetonation | 6 | 가까운 적 2nd 폭발 (1칸 / 30% 피해) |
| 25 |  | 심장추적자 | Heartseeker | 2 | crit% +0.10 / critDmg +0.05 |
| 26 |  | 심장추적자+ | Heartseeker2 | 3 | crit% +0.25 / critDmg +0.10 |
| 27 |  | 심장추적자++ | Heartseeker3 | 6 | crit% +0.40 / critDmg +0.18 |
| 28 |  | 탱커 파괴자 | Tankbuster | 0 | Tank 상대 +0.15 damage amp |
| 29 |  | 지연 폭발 | LatentExplosion | 3 | 입힌 피해의 15% 저장. 처치 관여 시 적이 2칸 폭발 |
| 30 |  | 철갑탄 | APRounds | 3 | armorPen +0.30 |
| 31 |  | 철갑탄+ | APRounds2 | 6 | armorPen +0.60 |
| 32 |  | 냉각수 | Coolant | 2 | maxMana -10 |
| 33 |  | 냉각수+ | Coolant2 | 3 | maxMana -20 |
| 34 |  | 공허 계수 | VoidCoefficient | 6 | 매 cast 마다 maxMana -15% (최소 -10) |
| 35 |  | 분열 | Fission | 0 | manaRegen +2, AD +10% |
| 36 |  | 분열+ | Fission2 | 3 | manaRegen +3, AD +20% |
| 37 |  | 분열++ | Fission3 | 6 | manaRegen +5, AD +30% |
| 38 |  | (FrameSupport) | FrameSupport | — | **Riot 미구현** (lolchess 미표시) |
| 39 | 사수 root | 사수 프레임 | DoubleTap | 0 | 25% 확률 2회 공격 |
| 40 | 사수 sub | 정밀 조준경 | PrecisionScope | 0 | range +1, AD +12% |
| 41 |  | 정밀 조준경+ | PrecisionScope2 | 2 | range +2, AD +24% |
| 42 |  | 정밀 조준경++ | PrecisionScope3 | 5 | range +3, AD +36% |
| 43 |  | 조준 보정 | AimAssistant | 6 | 1칸 거리당 +5% 피해 |
| 44 |  | 한 발에 두 놈 | DoubleTap2 | 2 | 35% 확률 2회 공격 |
| 45 |  | 한 발에 세 놈 | TripleTap | 3 | 18% 확률 3회 공격 |
| 46 |  | 엔진 가동 | RevUp | 3 | 같은 대상 공격마다 AS +8% (max 80%) |
| 47 |  | 엔진 가동+ | RevUp2 | 6 | AS +15% (max 150%) |
| 48 |  | 파쇄 탄환 | RipperBullets | 2 | 공격 시 적 armor/MR -1 |
| 49 |  | 파쇄 탄환+ | RipperBullets2 | 3 | 공격 시 적 armor/MR -2 |
| 50 |  | 파편탄 | FragmentationRounds | 2 | 공격 시 주변 파편 2개 (15% 피해) |
| 51 |  | 파편탄+ | FragmentationRounds2 | 3 | 주변 파편 3개 (20% 피해) |

> **Backup** (조정, "아무 효과 없음 / 무료") 은 raw data 에 있지만 lolchess 에 미표시.
> Riot 의 pity slot — 실제 게임에서 등장하지 않거나 무효 처리. 시뮬 미구현.

---

## 🛠 시뮬 구현 현황

| Phase | 범위 | 구현 PR | 상태 |
|---|---|---|---|
| **Phase 1** | Frame 3종 (root) — stat / mechanic | #45 | ✅ 머지 완료 (8bccb64) |
| **Phase 2** | 단순 stat upgrade 18종 | #46 | 🟢 OPEN, codex P2 1건 잔여 |
| **Phase 3** | 메커닉 필요 31종 (Buckshot/RevUp/GravBooster/EmergencyShielding 등) | — | ❌ 미구현 |
| **Phase 4** | tree 시각화 + round-by-round 선택 UI + 라운드 진행 시뮬레이션 | — | ❌ 미구현 |

### Phase 1 + 2 누적 18종 (raw effects 직접 가산)
LeechingImplants/2, HeavyPlating, PrecisionScope/2/3, Fission/2/3, Heartseeker/2/3,
Tankbuster, Coolant/2, APRounds/2, SheerMass

### Phase 3 메커닉 잔여 31종 분류
- **단순 트리거 (~6)**: EmergencyShielding/2, LatentExplosion, Shockwave, ReactiveArmor, Backup
- **공격 동작 변경 (~10)**: Buckshot/2/3, LaserBallistics, TripleTap, DoubleTap2, RipperBullets/2, FragmentationRounds/2
- **stacking / 영구효과 (~7)**: RevUp/2, Nanomachines, BlastRadius/2/3, Meltthrough, VoidCoefficient
- **복합 메커닉 (~8)**: GravBooster/2, Choke, AimAssistant, SympatheticDetonation, Heartseeker3 확장

---

## 🚧 Phase 4 — Tree 시스템 구현 계획

### 데이터 구조 (`src/data/factoryNewTree.ts` — 신규)

```ts
export interface FactoryWeaponNode {
  apiName: string;        // raw apiName ('TFT17_GravesTrait_Offense_*')
  suffix: string;         // 짧은 ID (PR #46 의 GRAVES_STAT_UPGRADE_HANDLERS key 와 동일)
  name: string;           // 한글 이름
  cost: 0 | 2 | 3 | 5 | 6;
  path: 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap';
  children: string[];     // child suffix 목록 (직속 자식만)
  parents: string[];      // parent suffix 목록 (다중 path 공유 노드: Choke 등)
}

export const FACTORY_NEW_TREE: Record<string, FactoryWeaponNode>;
export const ROOTS = ['CloseQuarters', 'SharpshooterModule', 'DoubleTap'] as const;
```

### 라운드별 옵션 생성 함수

```ts
/** 라운드별 4개 (또는 round 1 의 3개) weapon 옵션 생성. */
export function getNextRoundOptions(
  pickedSequence: string[], // 이전 라운드 픽 history (suffix)
  rng: SeededRng,
): string[];
```

알고리즘:
- 라운드 1: `ROOTS` 그대로 반환 (3개)
- 라운드 2: `tree[picked[0]].children` 의 child 4개 반환
- 라운드 3+:
  1. `nextChildren = tree[picked.last()].children` 의 진행 가능 노드
  2. 빈 자리 (4 - nextChildren.length) 만큼 `pickedSequence[1]` 의 sibling pool 에서
     `pickedSequence` 에 안 들어간 것을 RNG 로 채움
  3. 4개 unique 반환

### UI 통합

- `src/components/builder/GravesFactorySelector.tsx` (신규) — 라운드별 4-card 선택 UI
- 시뮬 옵션: `playerGravesUpgrades: string[]` 을 일괄 옵션으로 받지 않고,
  `playerGravesPicks: string[]` (라운드 순서 array) 로 받아 라운드 진행 검증

### 회귀 가드 (`tests/unit/data/graves-factory-tree.test.ts`)
- 51 노드 모두 정의됨
- 3 root 만 parent=[] 보유
- 모든 비-root 노드는 최소 1 parent
- 라운드 1 옵션 항상 3개 + roots 와 일치
- 라운드 2 옵션 4개 + 선택 root 의 children 과 일치
- sibling random fill: `pickedSequence[1]` sibling pool 에서만 채움

---

## 📚 관련 파일 인덱스

| 파일 | 역할 | 상태 |
|---|---|---|
| `public/data/tft_set17_items.json` | 52 entries raw data (3 frames + 49 upgrades) | ✅ |
| `src/lib/simulator/engine/combatLoop.ts` | `applyGravesFrameEffects` (Phase 1) + `applyGravesStatUpgrades` (Phase 2) | 🟡 부분 |
| `src/types/index.ts` | `gravesFrame` / `gravesUpgrades` / `gravesTankDamageAmp` | ✅ |
| `src/data/factoryNewTree.ts` | 51 노드 tree 데이터 | ❌ Phase 4 |
| `src/components/builder/GravesFactorySelector.tsx` | 라운드별 선택 UI | ❌ Phase 4 |
| `tests/unit/simulator/graves-frame.test.ts` | Phase 1 회귀 가드 | ✅ |
| `tests/unit/simulator/graves-stat-upgrades.test.ts` | Phase 2 회귀 가드 | ✅ |
| `tests/unit/data/graves-factory-tree.test.ts` | Phase 4 트리 회귀 가드 | ❌ Phase 4 |

---

## 외부 참조

- 공식 보상표: https://lolchess.gg/rewards/set17/factory-new
- 패치 노트: https://lolchess.gg/guide/patch-notes
- CDragon raw: `public/data/tft_set17_items.json` (TFT17_GravesTrait_Offense_*)
