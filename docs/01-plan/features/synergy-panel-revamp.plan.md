# Plan: synergy-panel-revamp — 시너지 패널 UI 개편 + 필트오버/빌지워터 티어별 모듈 시스템

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 시너지 패널에 특성 아이콘이 없어 시각적 식별 어려움. 필트오버 모듈이 티어별 분류 없이 전체 노출. 빌지워터 능력치 아이템 시스템 미구현. 시너지 카드에 불필요한 전체 아이템 목록 표시 |
| **Solution** | 시너지 아이콘 + 등급 배경색 표시, 시너지 hover 툴팁, 필트오버 티어별 모듈 분류, 빌지워터 능력치 아이템 클릭 중첩 시스템 |
| **Function UX Effect** | 한 눈에 활성 시너지 파악 가능. 필트오버 2/4/6 정확한 발명품 선택. 빌지워터 능력치 중첩 구매 + 전투 반영 |
| **Core Value** | 실제 TFT 게임의 시너지 UI/UX를 분석 도구에 충실히 재현하여 시뮬레이션 정확도 향상 |

---

## 1. 요구사항

### FR-01: 시너지 아이콘 + 등급 배경색

- 각 시너지 행에 `/public/data/images/traits/` 아이콘 표시
- `getTraitImage()` 함수 수정: trait JSON의 `icon` 필드에서 파일명 추출 → 실제 파일명과 매칭
- 등급(style)에 따라 배경색 적용: 브론즈(1), 실버(3), 골드(4), 프리즘(5)

### FR-02: 시너지 hover 툴팁

- 현재: `TraitEffectDetail`로 시너지 카드 하단에 설명 표시
- 변경: 시너지 행 hover 시 Tooltip으로 **전 단계 능력치** + **고유 설명** 표시
- `TraitEffectDetail`의 인라인 텍스트 → Tooltip 내부로 이동

### FR-03: 필트오버 티어별 모듈 팝업

필트오버 시너지 단계에 따라 선택 가능한 모듈 제한:

| 시너지 단계 | 선택 가능 모듈 (name) |
|-----------|---------------------|
| 2 필트오버 | 90구경 투망, 폭발 보호막, 전류 과부하, 전자기 펄스, 과열된 축전기, 조정된 발진기, 연속체 톱니바퀴 |
| 4 필트오버 | 거대화 광선, 동적 방어막, 자전관 코일, 초소형 로켓, 가속 관문 |
| 6 필트오버 | 업그레이드!, 방어구 무효화, 메아리 엔진, 채굴 드릴, 우월한 존재 |

**apiName 매핑:**

| 티어 | apiName |
|------|---------|
| T2 | `90CaliberNets`, `BlastShield`, `ElectricalOverload`, `EMP`, `OverclockedCapacitors`, `TunedOscillator`, `ContinuumCogs` |
| T4 | `GigantificationRay`, `KineticBarrier`, `MagnetronCoil`, `MicroRockets`, `AccelerationGate` |
| T6 | `Upgrade`, `ArmorNullifier`, `EchoEngine`, `MiningDrill`, `SuperiorLifeform` |

- 시너지 2/4/6 활성화 시 해당 티어 모듈만 팝업에 표시
- 현재 `PiltoverModulePanel`의 전체 필터 대신 티어별 필터 적용

### FR-04: 빌지워터 아이템 탭

- 빌지워터 시너지 활성화 시 아이템 선택 풀 상단에 "빌지워터" 탭 추가
- 빌지워터 탭: 빌지워터 전용 아이템만 표시
- 일반 아이템/빌지워터 전환 가능

### FR-05: 빌지워터 능력치 아이템 클릭 중첩

- 능력치 아이템 (`TFT16_Item_Bilgewater_*Tier*`): 드래그 불가, 클릭 전용
- 클릭할 때마다 **해당 팀의 모든 빌지워터 챔피언**에게 중첩 적용
- 상태: `bilgewaterStatPurchases: Record<string, number>` (apiName → 구매 횟수)
- 전투 시뮬레이션에서 해당 능력치 반영

### FR-06: 선택된 모듈/능력치 표시

- 필트오버: 시너지 카드 하단에 선택된 모듈 아이콘 표시
- 빌지워터: 시너지 카드 하단에 중첩된 총 능력 요약 표시
  - 예: `주문력: 10%, 공격력: 7%, 체력: 200, 공격 속도: 4%`

### FR-07: 시너지 카드 아이템 목록 제거

- 현재 필트오버/빌지워터 시너지 활성화 시 `TraitEffectDetail`에서 `specialItems`로 전체 아이템 아이콘 표시
- 이 아이템 목록 제거

---

## 2. 구현 설계

### 2.1 trait 이미지 매핑 수정

`getTraitImage(apiName)` → JSON `icon` 필드 기반으로 수정:

```
icon: "ASSETS/UX/TraitIcons/Trait_Icon_16_Freljord.TFT_Set16.png"
→ 파일명: "trait_icon_16_freljord.tft_set16.png"
→ 경로: "/data/images/traits/trait_icon_16_freljord.tft_set16.png"
```

`imageMap.ts`에 `registerTraitImages()` 추가하거나, `getTraitImage`에 icon 필드를 파라미터로 전달.

### 2.2 시너지 Tooltip

`SynergyPanel` 내 각 시너지 행을 `<Tooltip>`으로 감싸기:
- content: 전 단계 효과 테이블 + `trait.desc` 설명
- 각 단계 `trait.effects[]` 순회하며 `minUnits`, `variables` 표시
- 현재 활성 단계 하이라이트

### 2.3 필트오버 티어 데이터

`src/data/specialUnits.ts` 또는 새 파일에 티어 상수:

```ts
export const PILTOVER_MODULE_TIERS: Record<number, string[]> = {
  2: ['90CaliberNets', 'BlastShield', 'ElectricalOverload', 'EMP', 'OverclockedCapacitors', 'TunedOscillator', 'ContinuumCogs'],
  4: ['GigantificationRay', 'KineticBarrier', 'MagnetronCoil', 'MicroRockets', 'AccelerationGate'],
  6: ['Upgrade', 'ArmorNullifier', 'EchoEngine', 'MiningDrill', 'SuperiorLifeform'],
};
```

### 2.4 빌지워터 능력치 상태

`useTeamManagement` hook에 추가:
```ts
const [playerBilgewaterStats, setPlayerBilgewaterStats] = useState<Record<string, number>>({});
const [enemyBilgewaterStats, setEnemyBilgewaterStats] = useState<Record<string, number>>({});
```

- 클릭 시 `count++`, 우클릭/버튼으로 제거 가능
- `simulateCombat` 호출 시 이 데이터 전달 → 빌지워터 챔피언 스탯에 반영

### 2.5 전투 시뮬레이션 반영

`combatLoop.ts` 또는 `stat.ts`에서:
- 빌지워터 trait을 가진 유닛에만 구매한 능력치 적용
- 각 능력치 아이템의 효과값 × 구매 횟수 적용

---

## 3. 변경 파일

| 파일 | 작업 |
|------|------|
| `src/data/imageMap.ts` | `getTraitImage()` 수정 — icon 필드 기반 매핑 |
| `src/data/piltoverModules.ts` | **신규** — 티어별 모듈 상수 + 빌지워터 능력치 아이템 식별 |
| `src/components/builder/SynergyPanel.tsx` | 아이콘 표시, 등급 배경색, Tooltip 감싸기 |
| `src/components/builder/TraitEffectDetail.tsx` | specialItems 제거, Tooltip용 컨텐츠 분리 |
| `src/components/builder/PiltoverModulePanel.tsx` | 티어별 필터 적용 |
| `src/components/builder/BilgewaterShopPanel.tsx` | **신규** — 빌지워터 능력치 클릭 구매 UI |
| `src/hooks/useTeamManagement.ts` | 빌지워터 능력치 상태 추가 |
| `src/app/simulator/page.tsx` | 빌지워터 탭 + 패널 통합, simulateCombat에 빌지워터 데이터 전달 |
| `src/lib/simulator/systems/stat.ts` | 빌지워터 능력치 적용 로직 |
| `src/lib/simulator/engine/combatLoop.ts` | 빌지워터 stats 파라미터 수용 |

---

## 4. 구현 순서

1. `imageMap.ts` — trait 이미지 매핑 수정 + `registerTraitImages()`
2. `piltoverModules.ts` — 티어별 모듈 상수 + 빌지워터 능력치 아이템 식별 함수
3. `SynergyPanel.tsx` — 아이콘 + 등급 배경색 + Tooltip
4. `TraitEffectDetail.tsx` — specialItems 목록 제거, 인라인 설명 간소화
5. `PiltoverModulePanel.tsx` — 티어별 필터 적용
6. `BilgewaterShopPanel.tsx` — 신규 컴포넌트
7. `useTeamManagement.ts` — 빌지워터 능력치 상태
8. `page.tsx` — 빌지워터 탭 통합
9. `stat.ts` + `combatLoop.ts` — 전투 반영
10. 검증: `pnpm lint && pnpm typecheck && pnpm build`

---

## 5. 검증 기준

- [ ] 시너지 행에 trait 아이콘 표시 + 등급별 배경색
- [ ] 시너지 hover → 전 단계 능력치 Tooltip
- [ ] 필트오버 2시너지: T2 모듈 7개만 표시
- [ ] 필트오버 4시너지: T4 모듈 5개만 표시
- [ ] 필트오버 6시너지: T6 모듈 5개만 표시
- [ ] 빌지워터 시너지 활성화 → 아이템 탭에 빌지워터 탭 등장
- [ ] 빌지워터 능력치 아이템 클릭 → 중첩 카운트 증가
- [ ] 빌지워터 능력치가 전투 시뮬레이션에 반영
- [ ] 시너지 카드 하단: 필트오버 모듈 아이콘 / 빌지워터 총 능력 요약
- [ ] 시너지 카드에서 전체 아이템 목록 제거
- [ ] lint 0 errors, 0 warnings + build 성공

---

## 6. MVP 제외

- 빌지워터 고유 아이템(명명 아이템) 특수 효과 시뮬레이션 (출혈, 처형 등)
- 필트오버 모듈 자동 팝업 (시너지 활성화 시 자동으로 팝업 열기)
- 빌지워터 은화 시스템 (라운드당 은화 획득/소비)
