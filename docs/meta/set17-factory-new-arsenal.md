# Set 17 최신상 무기고 (Factory New Arsenal)

> 출처: lolchess.gg/rewards/set17/factory-new (2026-04-23 재분석)
> 트리 구조는 DOM 중첩으로 정확히 복원 (e1q6hd205 class nesting)
> 시너지 명: **최신상 (Factory New)** — 그레이브즈 전용

## 개요

- 전투에 참여한 후 무기고 열림 → 가장 강한 아군 **그레이브즈** 영구 업그레이드 구매
- **업그레이드 3회마다** 다음 업그레이드까지 필요한 라운드 수 +1
- 세 가지 루트 **프레임** 중 하나로 시작, 하위 업그레이드 트리

## 프레임 3종 (루트)

| 이름 | 영문 key | 비용 | 효과 |
|-----|---------|------|------|
| **맹공 프레임** (Assault) | `CloseQuarters` | 0 | 사거리 -2, 공격력 전사화. 체력 +250, 모든 피해 흡혈 10%, 공격력 +25% |
| **위력 프레임** (Might) | `SharpshooterModule` | 0 | 정밀 획득, 스킬 피해 +5%. **정밀**: 스킬 치명타 적용, 추가 정밀마다 치명타 피해 +10% |
| **사수 프레임** (Gunner) | `DoubleTap` | 0 | 20% 확률로 2회 공격 |

## 트리 구조 (DOM 정확 복원)

### 맹공 프레임 (CloseQuarters) [0]
```
CloseQuarters [0]
├── LeechingImplants 흡수 임플란트 [0]
│   └── LeechingImplants2 흡수 임플란트+ [2]
│       └── Choke 초크 [5]
├── Buckshot 산탄 사격 [2]
│   └── Buckshot2 산탄 사격+ [3]
│       ├── Buckshot3 산탄 사격++ [3]
│       │   └── LaserBallistics 레이저 탄도학 [6]
│       └── Choke 초크 [5]                ※ 독립 노드 (다른 Choke와 별개)
├── Meltthrough 용융 관통 [2]
│   └── GravBooster 중력 증폭기 [3]
│       └── GravBooster2 중력 증폭기+ [6]
└── EmergencyShielding 긴급 보호막 [0]
    ├── EmergencyShielding2 긴급 보호막+ [2]
    └── HeavyPlating 두꺼운 장갑판 [3]
        ├── Shockwave 충격파 [6]
        ├── SheerMass 순수 질량 [5]
        │   └── Nanomachines 나노머신 [6]
        └── ReactiveArmor 반응형 방어구 [6]
```

### 위력 프레임 (SharpshooterModule) [0]
```
SharpshooterModule [0]
├── BlastRadius 폭발 반경 [2]
│   ├── BlastRadius2 폭발 반경+ [3]
│   │   └── BlastRadius3 폭발 반경++ [6]
│   └── SympatheticDetonation 공감성 폭발 [6]
├── Heartseeker 심장추적자 [2]
│   └── Heartseeker2 심장추적자+ [3]
│       └── Heartseeker3 심장추적자++ [6]
├── Tankbuster 탱커 파괴자 [0]
│   ├── LatentExplosion 지연 폭발 [3]
│   └── APRounds 철갑탄 [3]
│       ├── APRounds2 철갑탄+ [6]
│       └── Choke 초크 [5]               ※ 또 다른 독립 Choke
└── Coolant 냉각수 [2]
    ├── Coolant2 냉각수+ [3]
    │   └── VoidCoefficient 공허 계수 [6]
    └── Fission 분열 [0]                 ※ 냉각수의 하위 (루트 자식 아님)
        └── Fission2 분열+ [3]
            └── Fission3 분열++ [6]
```

### 사수 프레임 (DoubleTap) [0]
```
DoubleTap [0]
├── PrecisionScope 정밀 조준경 [0]
│   ├── PrecisionScope2 정밀 조준경+ [2]
│   │   └── PrecisionScope3 정밀 조준경++ [5]
│   └── AimAssistant 조준 보정 [6]
├── DoubleTap2 한 발에 두 놈 [2]
│   ├── TripleTap 한 발에 세 놈 [3]
│   └── RevUp 엔진 가동 [3]              ※ 한 발에 두 놈의 하위
│       └── RevUp2 엔진 가동+ [6]
├── RipperBullets 파쇄 탄환 [2]
│   └── RipperBullets2 파쇄 탄환+ [3]
└── FragmentationRounds 파편탄 [2]
    └── FragmentationRounds2 파편탄+ [3]
```

## 노드별 효과

### 맹공 프레임 트리
- **LeechingImplants 흡수 임플란트 [0]**: 모든 피해 흡혈 +10%, 공격력 +15%
- **LeechingImplants2 흡수 임플란트+ [2]**: 흡혈 +15%, 공격력 +30%
- **Choke 초크 [5]**: 투사체 분산 -75%
- **Buckshot 산탄 사격 [2]**: 공격 투사체 수 +2, 확산 범위 +20%
- **Buckshot2 산탄 사격+ [3]**: 투사체 +4, 확산 +30%
- **Buckshot3 산탄 사격++ [3]**: 투사체 +6, 확산 +40%
- **LaserBallistics 레이저 탄도학 [6]**: 기본 공격 사거리 +1, 적 관통, 관통 대상당 피해 -50%
- **Meltthrough 용융 관통 [2]**: 매초 2칸 내 적 방어력 -5, 인접 적은 -10
- **GravBooster 중력 증폭기 [3]**: 처치 관여 시 돌진 + 기본 공격 2회 동안 공속 +70%
- **GravBooster2 중력 증폭기+ [6]**: 기본 공격 3회 동안
- **EmergencyShielding 긴급 보호막 [0]**: 체력 40% 시 2.5초 사라지는 최대 체력 50% 보호막
- **EmergencyShielding2 긴급 보호막+ [2]**: 4초, 75% 보호막
- **HeavyPlating 두꺼운 장갑판 [3]**: 체력 +300, 방어력 +30, 마법 저항력 +30
- **Shockwave 충격파 [6]**: 전투 시작 전방 충격파 — 그레이브즈 최대 체력 15% 마법 피해 + 2초 기절
- **SheerMass 순수 질량 [5]**: 최대 체력·크기 +25%
- **Nanomachines 나노머신 [6]**: 매초 최대 체력 3% 회복
- **ReactiveArmor 반응형 방어구 [6]**: 피해 받을 때마다 방어력·마법 저항력 +4 (최대 50회 중첩)

### 위력 프레임 트리
- **BlastRadius 폭발 반경 [2]**: 2차 폭발 반경 +1칸, 추가 칸마다 -50% 피해
- **BlastRadius2 폭발 반경+ [3]**: +2칸, -30% 피해
- **BlastRadius3 폭발 반경++ [6]**: +3칸, -30% 피해
- **SympatheticDetonation 공감성 폭발 [6]**: 가장 가까운 적에 2차 반경 1칸 폭발, 30% 피해
- **Heartseeker 심장추적자 [2]**: 치명타 확률 +10%, 치명타 피해 +5%
- **Heartseeker2 심장추적자+ [3]**: +25%, +10%
- **Heartseeker3 심장추적자++ [6]**: +40%, +18%
- **Tankbuster 탱커 파괴자 [0]**: 탱커 대상 피해 증폭 +15%
- **LatentExplosion 지연 폭발 [3]**: 적 입힌 피해 15% 저장, 처치 관여 시 반경 2칸 방출(물리)
- **APRounds 철갑탄 [3]**: 기본 공격·스킬이 적 방어력 30% 무시
- **APRounds2 철갑탄+ [6]**: 60% 무시
- **Coolant 냉각수 [2]**: 마나 소모량 -10
- **Coolant2 냉각수+ [3]**: -20
- **VoidCoefficient 공허 계수 [6]**: 스킬 사용 시 마나 소모 -15% (최소 10까지)
- **Fission 분열 [0]**: 마나 재생 +2, 공격력 +10%
- **Fission2 분열+ [3]**: 마나 재생 +3, 공격력 +20%
- **Fission3 분열++ [6]**: 마나 재생 +5, 공격력 +30%

### 사수 프레임 트리
- **PrecisionScope 정밀 조준경 [0]**: 사거리 +1, 공격력 +10%
- **PrecisionScope2 정밀 조준경+ [2]**: 사거리 +2, 공격력 +20%
- **PrecisionScope3 정밀 조준경++ [5]**: 사거리 +3, 공격력 +30%
- **AimAssistant 조준 보정 [6]**: 대상과 거리 1칸 멀어질 때마다 추가 피해 +5%
- **DoubleTap2 한 발에 두 놈 [2]**: 30% 확률로 2회 공격
- **TripleTap 한 발에 세 놈 [3]**: 18% 확률로 3회 공격
- **RevUp 엔진 가동 [3]**: 같은 대상 공격마다 공속 +8% (최대 80%)
- **RevUp2 엔진 가동+ [6]**: +15% (최대 150%)
- **RipperBullets 파쇄 탄환 [2]**: 기본 공격 시 적 방어력·마법 저항력 -1
- **RipperBullets2 파쇄 탄환+ [3]**: -2
- **FragmentationRounds 파편탄 [2]**: 기본 공격 시 주변 파편 2개, 15% 피해
- **FragmentationRounds2 파편탄+ [3]**: 파편 3개, 20% 피해

## 시뮬레이터 관점 정리

### 데이터 표현
```ts
type FactoryNewUpgradeId = string   // 영문 key (예: 'LeechingImplants', 'BlastRadius2')

interface TeamFactoryNewState {
  upgradePath: FactoryNewUpgradeId[]       // 선택 순서대로 누적. [0]은 3 프레임 중 1개
  nextUpgradeRoundsRemaining?: number      // 다음 업그레이드까지 남은 라운드 (MVP 선택 기록)
}
```

### 트리 데이터 파일 구조 제안
`src/data/factory_new_upgrades.json`:
```json
{
  "patch_version": "17.1",
  "fetched_at": "2026-04-23",
  "upgrades": [
    {
      "id": "CloseQuarters",
      "nameKo": "맹공 프레임",
      "frameRoot": "assault",
      "cost": 0,
      "parentId": null,
      "effects": { "range": -2, "type": "brawler", "hp": 250, "omnivamp": 0.1, "ad": 0.25 }
    },
    {
      "id": "LeechingImplants",
      "nameKo": "흡수 임플란트",
      "frameRoot": "assault",
      "cost": 0,
      "parentId": "CloseQuarters",
      "effects": { "omnivamp": 0.1, "ad": 0.15 }
    },
    ...
  ]
}
```

### 특기 사항
- **"초크" 3회 중복**: 맹공/위력 양쪽에 나오지만 **각 위치가 독립 노드**. `FactoryNewUpgradeId`는 위치 구분 위해 suffix 필요 가능성 (예: `Choke_assault_leeching`, `Choke_assault_buckshot`, `Choke_might_aprounds`). 또는 부모 경로를 key에 포함해 고유화
- **업그레이드 3회 규칙**: `upgradePath.length % 3 === 0`일 때마다 다음 업그레이드 대기 라운드 +1
- **첫 업그레이드 시점**: 영상 관찰로 확정 필요 (추정 1~2라운드)
- **그레이브즈 복수 보유**: "가장 강한" 그레이브즈 기준 — 별 레벨 우선, 동점이면? (확인 필요)

## 미확인 사항

- **첫 업그레이드까지 필요한 기본 라운드 수**: 1? 2? 3?
- **"가장 강한" 그레이브즈 결정 기준**: 별 레벨 → 장착 아이템 → 뭐?
- **그레이브즈 사망/판매 시 업그레이드 보존**: 업그레이드는 플레이어 소유로 남는지, 그레이브즈 개인 소유인지
