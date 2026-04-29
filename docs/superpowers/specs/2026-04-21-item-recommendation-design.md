# Design: 리플레이 UnitDetailPanel 추천 아이템 시스템

**작성일**: 2026-04-21
**Status**: Design approved, ready for implementation plan

## 목적

전투 시뮬레이션 리플레이에서 챔피언 클릭 시 UnitDetailPanel 에 **"이 유닛이 어떤 아이템을 꼈어야 더 좋았을까"** 를 즉시 보여주고, 사용자가 원하면 엔진 시뮬로 검증된 승률 기반 랭킹을 추가로 제공한다.

## 주 사용 맥락

- **A. 전투 결과 복기**: 이번 전투에서 장착한 아이템이 최적이었는지 즉시 확인
- **C. 덱 시너지 반영**: 시너지로 적용된 치유감소/방어력 감소/마저 감소 등 **환경 요인이 반영된** 상태에서 "이 챔피언이 뭘 꼈어야 적을 더 잘 잡았을까" 추천

## 추천 기준 (지표)

**주 지표**: 팀 승률 최대화 (이 유닛 아이템만 치환 시 시뮬 N회 승률)
**보조 지표**: 역할별 본인 기여 가중

| Role | roleScore 공식 |
|------|----------------|
| DAMAGE (Marksman/Assassin/ADFighter/APCaster 등) | `0.7 × winRate + 0.3 × normalize(ownDamage)` |
| TANK (APTank/ADTank) | `0.7 × winRate + 0.3 × normalize(ownTanked)` |
| SUPPORT/Specialist | `winRate` (단독) |

## 2단계 계산 전략

**1차 (즉시)**: `estimateDps` 기반 정적 스코어로 추천 3개 즉시 표시. 클릭 즉시 응답.
**2차 (on-demand)**: "⚡ 엔진 검증" 버튼 클릭 시 해당 3개 조합에 대해 `simulateCombat` N=10회 실행해 승률 + 본인 기여 측정.

이유:
- 1차는 빠르지만 **상대 방어력/치유감소** 반영 안 됨 (정확도 한계)
- 2차가 그 한계를 채움 (비용 크니 사용자 명시적 요청 시에만)

## 모듈 구조

```
src/lib/analysis/
└── itemRecommender.ts          [신규]
    ├── getStaticRecommendations(
    │     champion, teamContext, itemPool, starLevel
    │   ): Recommendation[]
    │     — 1차 즉시 응답
    │
    └── verifyWithSimulation(
          ctx: VerifyContext,
          options: { n: number; seedBase: number; onProgress?: (i,total)=>void }
        ): Promise<VerifiedResult>
          — 2차 비동기. 이벤트 루프 양보로 UI 프리징 방지

src/components/battle/
└── UnitDetailPanel.tsx          [수정]
    └── <RecommendationSection>  [파일 내부 서브 컴포넌트]
          1차 3개 + 엔진 검증 버튼 + 검증 결과 블록

src/types/analysis.ts            [확장]
└── Recommendation, VerifyContext, VerifiedResult 타입
```

**경계 원칙**:
- `itemRecommender.ts` 는 React 의존 없는 순수 TS — `estimateDps`·`simulateCombat` 만 호출
- UI 컴포넌트는 `useState` + async 핸들러로 로컬 상태 관리 (전역 store 불필요)

## 1차 추천 알고리즘

```
입력: targetUnit, playerTeam, activeTraits, allItems
출력: Recommendation[3]

1) 역할 기반 아이템 풀 필터
   - AD 캐리 → AD 계열 풀
   - AP 캐리 → AP 계열 풀
   - Tank   → 방어 계열 풀
   - 기타/Specialist → 전체 풀 (보수적)

2) 아이템 단독 DPS 스코어
   score[item] = estimateDps(champ.stats, isAP, star, [item]) - baseline
   (Tank 는 score = maxHp × (1 + (armor+mr)/100) 형태로 대체)

3) Greedy Top-3 조합
   a. score 상위 6개 후보 압축
   b. 6C3 = 20 조합 모두 열거
   c. 각 조합의 estimateDps(champ.stats, isAP, star, [3개]) 최대 조합 채택

4) Reason 태깅 (설명 한 줄)
   item.effects 상위 키 2개 기반 매핑:
     AD/CritChance      → "공격력 · 치명타"
     AP/SpellDamageAmp  → "주문력 강화"
     ManaOnRoundStart   → "마나 가속"
     Omnivamp           → "피해 흡혈"
     ArmorPenetration   → "방어 관통"
     ... (10개 키 매핑 테이블)

5) 팀 맥락 반영 (1차는 약하게)
   - 동일 유닛 내 중복만 제외 (3슬롯 고유성)
   - 팀원 중복은 허용
   - 시너지 스탯은 champ.stats 에 이미 반영
```

### 재사용 자산
- `itemOptimizer.estimateDps` — 이미 DPS 추정 구현됨
- `itemOptimizer` 내부 아이템 필터 상수 (`OFFENSIVE_COMPONENTS`, `TANK_ITEMS` 등) import

### 의도된 한계
- 상대 방어력/치유감소 반영 X → 2차 시뮬 검증이 채움
- 아이템 간 상호작용 완전 반영 X (DPS modifier 테이블 수준 근사)

## 2차 엔진 검증 로직

```
입력: VerifyContext {
  playerTeam: PlacedChampion[]      // row 0-3 규약 (시뮬 입력)
  enemyTeam:  PlacedChampion[]
  targetApiName: string             // 치환 대상
  targetPosition: HexCoord
  candidates: Recommendation[3]
  simulateOptions: SimulateOptions  // traits/augments/stage 등 원본 전부
}

단계:
1) Baseline — 원본 팀 그대로 N회 시뮬
   수집: winner, targetUnit.totalDamageDealt, totalDamageTaken, duration
   평균 → baseline = { winRate, avgOwnDmg, avgOwnTanked, avgDuration }

2) 각 candidate 별
   mutated = playerTeam.map(p =>
     p.champion.apiName === targetApiName && p.position 일치
       ? { ...p, items: combo.items }
       : p
   )
   N회 시뮬 → 동일 지표 수집

3) roleScore 공식 (§"추천 기준")

4) VerifiedResult 반환
   {
     baseline: { winRate, avgDuration }
     perItem: [{ comboLabel, items, winRate, deltaWinRate, roleScore, ownDmg, ownTanked }]
     bestIndex: number  // roleScore 최대
   }
```

### 구성
- **N 기본값**: 10 (1+3 = 4묶음 × 10 = 40 시뮬 ≈ 1~2초)
- **동시성**: JS 단일 쓰레드라 순차 실행. 각 시뮬 사이 `await new Promise(r => setTimeout(r, 0))` 로 이벤트 루프 양보 → UI 프리징 방지
- **결정론**: `seedBase` 고정이라 동일 입력/동일 추천이면 동일 결과

### targetUnit 매칭
`apiName + position(q,r)` 조합으로 유일성. 같은 챔피언 여러 명(별 레벨/위치 다름) 경우 커버.

### 진행률
`onProgress(current, total)` 콜백. UI 에서 "시뮬 중 8 / 40" 표시.

## UI/UX 통합

### 레이아웃 — 3-column grid

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header (아이콘, 이름, HP/MP/Shield)                     [✕]         │
├──────────────────┬────────────────────────┬─────────────────────────┤
│ 스탯             │ 추천 아이템            │ 시너지                  │
│                  │                        │  [배지] [배지] [배지]    │
│ 공격력    80     │ [Item1]                │                         │
│ 주문력   100     │  +공격력 · 치명타      │ 스킬 《우주 활극》        │
│ 피해증폭  15%    │                        │                         │
│ 방어력    45     │ [Item2]                │ 진은 고정 공속을 가지며  │
│ 마법방어  45     │  +방어 관통            │ 모든 추가 공격 속도의    │
│ 공격속도 0.85    │                        │ N%를 공격력으로 ...      │
│ 치명타    25%    │ [Item3]                │                         │
│ 사거리     6     │  +공속 증가            │                         │
│                  │                        │                         │
│                  │ [⚡ 엔진 검증]          │                         │
│                  │ ──────────────         │                         │
│                  │ Baseline: 62%          │                         │
│                  │ ★ IE    68% (+6%p)    │                         │
│                  │   라위  65% (+3%p)    │                         │
│                  │   구인수 64% (+2%p)   │                         │
└──────────────────┴────────────────────────┴─────────────────────────┘
  240px              260px                     1fr
```

- **데스크톱**: `grid-cols-[240px_260px_minmax(0,1fr)]`
- **모바일**: `grid-cols-1` 세로 스택

### 글씨 크기 상향

| 요소 | 현재 | 변경 |
|------|------|------|
| 스탯 label | `text-[10px]` | `text-xs` |
| 스탯 value | `text-xs` | `text-sm` |
| 시너지 배지 | `text-[10px]` | `text-xs` |
| 스킬 이름 | `text-xs` | `text-sm` |
| 스킬 설명 | `text-[11px]` | `text-xs` |
| 추천 아이템 reason | — | `text-xs` |
| 엔진 검증 표 | — | `text-xs` |

### 추천 아이템 세로 리스트

```tsx
<ul className="space-y-2">
  {recommendations.map((r, i) => (
    <li key={i} className="flex items-center gap-2">
      <ItemIcon item={r.item} size={36} />
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-200 truncate">{r.item.name}</div>
        <div className="text-[11px] text-gray-500 truncate">{r.reason}</div>
      </div>
    </li>
  ))}
</ul>
```

### 엔진 검증 결과

```tsx
{verified && (
  <div className="mt-3 pt-3 border-t border-gray-800 text-xs space-y-1">
    <div className="text-gray-500">Baseline: {percent(verified.baseline.winRate)}</div>
    {verified.perItem.map((v, i) => (
      <div key={i} className={i === verified.bestIndex ? 'text-yellow-300' : 'text-gray-300'}>
        {i === verified.bestIndex ? '★' : ' '} {v.comboLabel}
        <span className="ml-2 tabular-nums">{percent(v.winRate)}</span>
        <span className="ml-1 text-gray-500">({formatDelta(v.deltaWinRate)})</span>
      </div>
    ))}
  </div>
)}
```

### 상태 관리

- `UnitDetailPanel` 을 `key={selectedUnitId}` 로 리마운트 → 유닛 교체 시 `verified` 자동 리셋
- `verifying`(boolean), `verified`(VerifiedResult | null) 로컬 useState
- 진행률 `progress: {i, total}` 선택적 state

### Props 변경

```ts
interface UnitDetailPanelProps {
  unitSnapshot: TickSnapshotUnit;
  meta: { ... + traits + ability (기존 확장 완료) };
  onClose: () => void;
  // NEW
  verifyContext?: VerifyContext;   // 없으면 엔진 검증 버튼 비활성 + "원본 팀 정보 없음"
  allItems: RawItem[];             // 추천 풀
  activeTraits: ActiveTrait[];     // 1차 스코어 계산
}
```

`simulator/page.tsx` 에서 UnitDetailPanel 렌더 시 위 3개 prop 추가 주입.

### Edge Cases

- **AUTO_UNIT (쉔 유물, 비아/바이엔, 티버 등)**: `isAutoUnit(apiName)` true 면 섹션 전체를 `"이 유닛은 아이템 장착 불가"` 한 줄로 대체
- **탱커/서포터 역할 힌트**: 섹션 제목 옆에 role 뱃지 — `🎯 추천 아이템 · 딜 기여 기준` / `· 탱커 기여 기준` / `· 팀 승률 기준`
- **verifyContext 부재**: "엔진 검증" 버튼 disabled + 툴팁 "원본 팀 입력 정보 없음"
- **추천이 3개 미만**: 역할 풀이 좁을 경우 가능 — 2개면 2개만 표시, 0개면 "이 유닛에게 적합한 아이템 없음"

## 두 진입 경로 호환성

리플레이 모드 도달은 두 경로 모두 `tm.playerTeam/enemyTeam + simulateCombat → combatResult` 로 수렴:

1. **직접 편집 진입**: 사용자가 보드에 배치 → "전투 시작"
2. **분석 → 시뮬레이터 handoff**: `decodeTeamCode + autoPlaceChampions('player')` → "전투 시작"

→ 리플레이 진입 시점 상태 동일. 2차 검증은 동일하게 동작.

향후 "리플레이 단독 링크 공유" 같은 기능 추가 시 `playerTeam` 원본 입력 소실 가능 → verifyContext 부재 edge case 로 graceful degradation.

## 구현 순서 (참고용)

1. `src/types/analysis.ts` 타입 확장 (`Recommendation`, `VerifyContext`, `VerifiedResult`)
2. `src/lib/analysis/itemRecommender.ts` 신규:
   - `getStaticRecommendations` — 역할 필터 + estimateDps 기반 Greedy Top-3 + reason 태깅
   - `verifyWithSimulation` — baseline + per-candidate N회 simulateCombat, 순차 + 이벤트 루프 양보
3. `UnitDetailPanel.tsx` 확장:
   - props 3개 추가 (`verifyContext`, `allItems`, `activeTraits`)
   - 3-column 레이아웃 + 글씨 크기 상향
   - `<RecommendationSection>` 서브 컴포넌트 + `useState` 로 verified/verifying 관리
4. `simulator/page.tsx` 에서 UnitDetailPanel 에 위 3개 prop 주입
5. `pnpm lint && pnpm typecheck && pnpm build`

## 범위 외

- "리플레이 단독 공유 URL" 같은 외부 공유 기능
- 메타 빌드 테이블 수동 관리 (옵션 B) — 엔진 검증이 동등 이상의 정확도 제공
- 시뮬 결과 캐시 영속화 (세션 간) — 현재는 컴포넌트 리마운트 시 재계산
- 다유닛 동시 검증 (배치 모드)
- 증강 추천, 시너지 추천 (본 feature 는 아이템만)
