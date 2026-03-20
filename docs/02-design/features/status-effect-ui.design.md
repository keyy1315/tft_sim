# Design: 상태이상 UI 개선 (Status Effect UI Improvement)

> Plan 참조: `docs/01-plan/features/status-effect-ui.plan.md`

---

## 1. 아키텍처 개요

```
src/lib/statusEffectConfig.ts          ← [신규] 공통 설정 (아이콘, 색상, 카테고리)
         │
         ├──→ src/components/battle/StatusEffectBadge.tsx  ← [신규] HTML 뱃지 (UnitToken용)
         │         │
         │         └──→ UnitToken.tsx     ← [수정] STATUS_ICONS 제거, 뱃지 시스템 적용
         │
         └──→ ReplayBoard.tsx            ← [수정] 노란 점 → SVG 아이콘 그룹 + 오버레이
```

**핵심 원칙**: 상태이상 정의(아이콘/색상/카테고리)는 `statusEffectConfig.ts`에서 한 번만 정의하고, HTML(UnitToken)과 SVG(ReplayBoard) 양쪽에서 참조한다.

---

## 2. 모듈 상세 설계

### 2.1 `src/lib/statusEffectConfig.ts` — 공통 설정 모듈

```typescript
import type { StatusEffectType } from '@/types';

export type StatusCategory = 'debuff-cc' | 'debuff-dot' | 'buff';

export interface StatusEffectStyle {
  icon: string;           // 유니코드 기호 (SVG <text>에서도 사용 가능)
  color: string;          // 메인 색상 (아이콘/텍스트 색)
  bgColor: string;        // 배경 색상 (뱃지 배경)
  category: StatusCategory;
  label: string;          // 한글 레이블 (tooltip용)
}

export const STATUS_EFFECT_CONFIG: Record<StatusEffectType, StatusEffectStyle> = {
  stun:         { icon: '⚡', color: '#fbbf24', bgColor: 'rgba(251,191,36,0.2)',  category: 'debuff-cc',  label: '기절' },
  slow:         { icon: '▼',  color: '#60a5fa', bgColor: 'rgba(96,165,250,0.2)',  category: 'debuff-cc',  label: '둔화' },
  burn:         { icon: '●',  color: '#f97316', bgColor: 'rgba(249,115,22,0.2)',  category: 'debuff-dot', label: '화상' },
  disarm:       { icon: '✕',  color: '#f87171', bgColor: 'rgba(248,113,113,0.2)', category: 'debuff-cc',  label: '무장해제' },
  taunt:        { icon: '◎',  color: '#fb923c', bgColor: 'rgba(251,146,60,0.2)',  category: 'debuff-cc',  label: '도발' },
  shield:       { icon: '◆',  color: '#a3e635', bgColor: 'rgba(163,230,53,0.2)',  category: 'buff',       label: '보호막' },
  invulnerable: { icon: '☆',  color: '#c084fc', bgColor: 'rgba(192,132,252,0.2)', category: 'buff',       label: '무적' },
};

/** 카테고리별 테두리 색상 */
export const CATEGORY_BORDER: Record<StatusCategory, string> = {
  'debuff-cc':  '#ef4444',  // red
  'debuff-dot': '#f97316',  // orange
  'buff':       '#22c55e',  // green
};
```

**설계 결정**:
- 이모지 대신 **유니코드 기호** 사용 → SVG `<text>`에서 크로스 브라우저 렌더링이 안정적
- `bgColor`는 `rgba` 형태로 정의 → 오버레이에 직접 사용 가능
- `category`로 버프/디버프를 구분하여 테두리 색상 분기

---

### 2.2 `src/components/battle/StatusEffectBadge.tsx` — HTML 뱃지 컴포넌트

UnitToken 내부에서 사용하는 HTML 기반 뱃지.

```typescript
interface StatusEffectBadgeProps {
  effects: { type: string; remainingTicks: number }[];
  size: 'sm' | 'md';
  /** 최대 표시 개수 (초과 시 +N 뱃지) */
  maxDisplay?: number;
}
```

#### 레이아웃 (md 기준)

```
┌──────────────────────────────┐
│  [⚡]  [▼]  [◆]  [+1]      │  ← 가로 배치, gap-0.5
└──────────────────────────────┘
     각 뱃지: 16x16px (md) / 12x12px (sm)
```

#### 단일 뱃지 구조

```
┌──────────────┐
│  ⚡          │  16x16, rounded-sm
│  ▔▔▔▔       │  하단 2px progress bar (remainingTicks 비율)
└──────────────┘
   border: 1px CATEGORY_BORDER 색상
   background: rgba(0,0,0,0.75)
   icon color: STATUS_EFFECT_CONFIG.color
```

#### 상세 스펙

| 속성 | md | sm |
|------|----|----|
| 뱃지 크기 | 16x16px | 12x12px |
| 아이콘 폰트 | 10px | 8px |
| progress bar 높이 | 2px | 1px |
| 최대 표시 | 4개 | 3개 |
| gap | 2px | 1px |
| 배경 | `rgba(0,0,0,0.75)` | `rgba(0,0,0,0.75)` |
| 테두리 | 1px, `CATEGORY_BORDER[category]` | 1px, `CATEGORY_BORDER[category]` |
| border-radius | 2px | 2px |

#### progress bar 계산

엔진의 tick 기반 시스템에서 `remainingTicks`를 비율로 변환하기 위해 **초기 지속시간 추정**이 필요하다. 그러나 현재 `StatusEffect`에 `initialTicks`가 없으므로:

- **간소화**: progress bar 없이 뱃지만 표시
- remainingTicks는 tooltip에만 표시: `title="기절 (3틱 남음)"`
- 추후 엔진에 `initialTicks` 필드가 추가되면 progress bar 활성화 가능

> **결정**: progress bar는 이번 스코프에서 **제외**. `initialTicks` 없이 비율 계산이 불가능하므로 뱃지 + tooltip으로 충분한 정보를 제공한다.

#### 초과 뱃지 (+N)

```
effects.length > maxDisplay 일 때:
[⚡] [▼] [◆] [+1]
                 ↑ 남은 개수, bg: #374151, color: #9ca3af, 같은 크기
```

#### 접근성

- 각 뱃지에 `title` 속성: `"기절 (3틱 남음)"` 형식
- 아이콘 + 색상 + 테두리 색상으로 삼중 구분 (색각 이상 대응)

---

### 2.3 `UnitToken.tsx` 수정 — 기존 코드 변경 상세

#### 삭제할 코드

```typescript
// 삭제: 기존 STATUS_ICONS 상수 (lines 25-33)
const STATUS_ICONS: Record<string, { label: string; color: string }> = { ... };

// 삭제: 기존 상태이상 오버레이 (lines 102-119)
{statusEffects.length > 0 && (
  <div className="absolute top-0 right-0 flex flex-col gap-px">
    ...
  </div>
)}
```

#### 추가할 코드 위치

초상화(Portrait) `<div>` 와 HP Bar 사이에 StatusEffectBadge를 삽입한다.

**변경 전 구조**:
```
★★★
[Portrait + 우상단 status 오버레이]
[HP Bar]
[Mana Bar]
[Item dots]
[Name]
```

**변경 후 구조**:
```
★★★
[Portrait]                          ← 오버레이 제거, 깨끗한 초상화
[StatusEffectBadge]                 ← 초상화 아래, HP 바 위
[HP Bar]
[Mana Bar]
[Item dots]
[Name]
```

#### 조건부 렌더링

```typescript
{/* Status effect badges — 상태이상이 있을 때만 렌더 */}
{isAlive && statusEffects.length > 0 && (
  <StatusEffectBadge
    effects={statusEffects}
    size={size}
    maxDisplay={isMd ? 4 : 3}
  />
)}
```

- 사망 유닛(`!isAlive`)에는 표시하지 않음
- `statusEffects`가 빈 배열이면 DOM 요소 자체 없음 (레이아웃 안 밀림)

---

### 2.4 `ReplayBoard.tsx` 수정 — SVG 상태이상 개선 상세

#### 2.4.1 삭제할 코드

```typescript
// 삭제: 기존 단일 노란 점 (lines 198-201)
{unitSnap.statusEffects.length > 0 && (
  <circle cx={cx + HEX_R - 6} cy={cy - HEX_R + 6} r={4} fill="#fbbf24" />
)}
```

#### 2.4.2 새로운 SVG 상태이상 아이콘 그룹

HEX 우측 상단에 최대 3개 아이콘을 세로로 나열한다.

```
HEX_R = 40 기준:

      ★★★
   ┌────────┐
   │        │ [⚡]  ← cx + HEX_R - 2, cy - HEX_R + 8
   │  img   │ [▼]  ← cx + HEX_R - 2, cy - HEX_R + 20
   │        │ [◆]  ← cx + HEX_R - 2, cy - HEX_R + 32
   └────────┘
   [HP bar   ]
   [Mana bar ]
```

#### 단일 아이콘 SVG 구조

```svg
<g>
  <!-- 배경 원 -->
  <circle cx={iconX} cy={iconY} r={6} fill={cfg.bgColor} stroke={borderColor} strokeWidth={1} />
  <!-- 아이콘 문자 -->
  <text x={iconX} y={iconY + 1} textAnchor="middle" dominantBaseline="central"
        fontSize={8} fontWeight="bold" fill={cfg.color}>
    {cfg.icon}
  </text>
</g>
```

#### 좌표 계산

```typescript
const ICON_R = 6;        // 아이콘 원 반지름
const ICON_GAP = 14;     // 아이콘 간 세로 간격
const ICON_X_OFFSET = HEX_R - 2;   // HEX 우측 경계에서 안쪽으로
const ICON_Y_START = -HEX_R + 10;  // HEX 상단에서 아래로

// i번째 아이콘 (0-indexed)
const iconX = cx + ICON_X_OFFSET;
const iconY = cy + ICON_Y_START + i * ICON_GAP;
```

#### 2.4.3 중요 상태이상 오버레이 (stun, invulnerable)

스턴이나 무적 상태일 때 HEX 전체에 반투명 색상을 덮어 시각적 강조를 한다.

```typescript
// statusEffects에서 stun 또는 invulnerable이 있는지 확인
const hasStun = unitSnap.statusEffects.some(e => e.type === 'stun');
const hasInvulnerable = unitSnap.statusEffects.some(e => e.type === 'invulnerable');

// HEX 배경 위, 초상화 위에 오버레이
{hasStun && (
  <polygon
    points={hexPoints(cx, cy, HEX_R - 1)}
    fill="rgba(251,191,36,0.25)"
    stroke="none"
    style={{ pointerEvents: 'none' }}
  />
)}
{hasInvulnerable && (
  <polygon
    points={hexPoints(cx, cy, HEX_R - 1)}
    fill="rgba(192,132,252,0.25)"
    stroke="none"
    style={{ pointerEvents: 'none' }}
  />
)}
```

**오버레이 렌더링 순서**: Hex 배경 → 초상화 → **오버레이** → 별 레벨 → HP/Mana → 아이콘 그룹

이렇게 하면 오버레이가 초상화를 살짝 덮어 "이 유닛은 지금 스턴 상태"라는 것이 즉각 보인다.

#### 2.4.4 최대 3개 제한 + 초과 표시

ReplayBoard는 공간이 제한적이므로 최대 3개까지만 표시한다.
4개 이상일 때는 3번째 자리에 `+N` 텍스트를 표시한다.

```typescript
const maxSvgIcons = 3;
const displayEffects = unitSnap.statusEffects.slice(0, maxSvgIcons);
const overflowCount = unitSnap.statusEffects.length - maxSvgIcons;

// overflowCount > 0이면 마지막 아이콘 자리에 "+N" 표시
```

---

## 3. 데이터 흐름

```
Engine (combatLoop.ts)
  → statusEffects[] in CombatUnit
    → TickSnapshot.units[id].statusEffects[]
      → ReplayBoard: SVG 아이콘 그룹 + 오버레이
      → UnitToken: StatusEffectBadge (HTML)
```

**변경 없음**: 엔진 레이어와 타입 정의는 수정하지 않는다. UI 레이어만 변경한다.

---

## 4. 파일별 변경 명세

| 파일 | 작업 | 변경 라인(예상) |
|------|------|---------------|
| `src/lib/statusEffectConfig.ts` | **신규 생성** | ~30줄 |
| `src/components/battle/StatusEffectBadge.tsx` | **신규 생성** | ~60줄 |
| `src/components/battle/UnitToken.tsx` | STATUS_ICONS 삭제, import 추가, 렌더링 위치 변경 | -20줄 / +10줄 |
| `src/components/battle/ReplayBoard.tsx` | 노란 점 삭제, SVG 아이콘 그룹 + 오버레이 추가 | -3줄 / +40줄 |

**총 변경**: 신규 2파일(~90줄), 수정 2파일(순증 ~30줄)

---

## 5. 구현 순서

```
Step 1: statusEffectConfig.ts 생성
        → pnpm typecheck (타입 확인)

Step 2: StatusEffectBadge.tsx 생성
        → pnpm lint && pnpm typecheck

Step 3: UnitToken.tsx 수정
        → pnpm lint && pnpm typecheck && pnpm build

Step 4: ReplayBoard.tsx 수정
        → pnpm lint && pnpm typecheck && pnpm build

Step 5: 최종 통합 검증
        → pnpm lint && pnpm typecheck && pnpm build
```

각 Step 후 `pnpm lint && pnpm typecheck`를 실행하여 점진적으로 검증한다.

---

## 6. 제외 사항 (Plan 스코프 확인)

- ~~progress bar (지속시간 인디케이터)~~ → `initialTicks` 없이 구현 불가, 제외
- 상태이상 적용/해제 애니메이션 → 별도 feature
- 이벤트 로그 상태이상 필터 → 별도 feature
- 상태이상 통계 (총 CC 시간) → 분석 feature
