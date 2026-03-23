# Plan: 상태이상 UI 개선 (Status Effect UI Improvement)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 상태이상 UI 개선 |
| 작성일 | 2026-03-20 |
| 상태 | Plan |

| 관점 | 내용 |
|------|------|
| **Problem** | 상태이상(스턴, 슬로우 등)이 3px 크기 알파벳 한 글자로만 표시되어 전투 분석 시 어떤 CC가 걸렸는지 파악이 불가능함. ReplayBoard에서는 노란 점 하나로만 표시 |
| **Solution** | 아이콘 기반 상태이상 뱃지 + 지속시간 인디케이터 + ReplayBoard SVG 상태이상 오버레이 통합 개선 |
| **Function UX Effect** | 전투 중 유닛 위에 상태이상 아이콘이 명확히 보이고, 남은 시간이 시각적으로 표현됨 |
| **Core Value** | 전투 분석의 핵심인 CC 타이밍/영향도를 한눈에 파악할 수 있는 시뮬레이터 경험 |

---

## 1. 현재 상태 분석

### 1.1 데이터 구조 (이미 구현됨)

엔진 레이어의 상태이상 시스템은 잘 갖춰져 있다:

```typescript
// src/types/index.ts
type StatusEffectType = 'stun' | 'slow' | 'burn' | 'shield' | 'invulnerable' | 'disarm' | 'taunt';

interface StatusEffect {
  type: StatusEffectType;
  sourceId: string;
  remainingTicks: number;
  value?: number;
}
```

`TickSnapshot`에서 유닛별 `statusEffects` 배열을 이미 추적하고 있어 데이터는 충분하다.

### 1.2 현재 UI 문제점

#### UnitToken.tsx (Setup/일반 보드)
```
현재: 초상화 우상단에 3x3px 컬러 사각형 + 7px 알파벳 1글자
┌──────┐
│      S│  ← 스턴을 "S"로 표시, 거의 안 보임
│  img W│  ← 슬로우를 "W"로 표시
│      │
└──────┘
```

- **크기**: 12x12px 사각형에 7px 폰트 → 사실상 안 보임
- **의미**: S=Stun, W=sloW, B=Burn, D=shielD... 직관적이지 않음
- **정보**: 지속시간 표시 없음 (title 툴팁에만 존재)
- **제한**: 최대 3개까지만 표시, 나머지 무시

#### ReplayBoard.tsx (리플레이 보드)
```
현재: 우상단 노란 원 하나 (r=4)
┌──hex──┐
│  ●    │  ← statusEffects.length > 0이면 노란 점 하나
│  img  │
│       │
└───────┘
```

- 상태이상 **종류 구분 불가** — 스턴이든 화상이든 동일한 노란 점
- **개수 표시 없음** — 3개가 걸려도 점 하나
- **지속시간 표시 없음**

### 1.3 실제 분석 시나리오에서의 영향

TFT 전투에서 CC 타이밍은 승패를 좌우하는 핵심 요소다:
- 스턴이 핵심 딜러에게 걸리면 DPS가 0이 됨
- 실드가 언제 터지는지에 따라 생존 여부가 갈림
- 도발로 어그로가 전환되는 시점 파악 필요

현재 UI로는 이 정보를 **전혀 파악할 수 없어** 시뮬레이터의 핵심 가치가 훼손되고 있다.

---

## 2. 변경 사항

### 2.1 R1: 상태이상 아이콘 시스템 통합 정의

알파벳 한 글자 대신 **의미 있는 기호 + 색상 코딩**을 사용한다.

| 상태이상 | 기호 | 색상 | 카테고리 |
|---------|------|------|---------|
| stun | ⚡ | `#fbbf24` (amber) | 디버프 (CC) |
| slow | 🐌 (or ▼) | `#60a5fa` (blue) | 디버프 (CC) |
| burn | 🔥 (or ●) | `#f97316` (orange) | 디버프 (DoT) |
| disarm | ✕ | `#f87171` (red) | 디버프 (CC) |
| taunt | ◎ | `#fb923c` (orange) | 디버프 (CC) |
| shield | 🛡 (or ◆) | `#a3e635` (lime) | 버프 |
| invulnerable | ☆ | `#c084fc` (purple) | 버프 |

> 실제 구현 시 이모지 대신 **SVG 아이콘 또는 유니코드 기호**를 사용하여 렌더링 일관성을 보장한다.
> UnitToken(HTML)과 ReplayBoard(SVG) 양쪽에서 모두 사용할 수 있도록 공통 설정 객체로 관리한다.

### 2.2 R2: UnitToken 상태이상 표시 개선

**변경 전:**
```
초상화 우상단 모서리에 3x3 사각형
```

**변경 후:**
```
┌──────────┐
│  img     │
│          │
│ ⚡▼ 🛡  │  ← 하단에 상태이상 뱃지 행
└──────────┘
[HP bar    ]
[Mana bar  ]
```

- 위치: 초상화 **하단 오버레이** (HP 바 바로 위)
- 크기: 각 뱃지 `16x16px` (md), `12x12px` (sm)
- 배경: 반투명 검정 (`rgba(0,0,0,0.7)`) + 둥근 모서리
- 아이콘: 12px 폰트의 유니코드 기호, 해당 색상
- 지속시간: 뱃지 아래에 얇은 progress bar (remainingTicks 기반)
- 최대 표시: 4개 (화면 공간 고려), 초과 시 `+N` 뱃지 표시
- 버프/디버프 구분: 디버프는 빨간 테두리, 버프는 초록 테두리

### 2.3 R3: ReplayBoard SVG 상태이상 표시 개선

**변경 전:**
```
statusEffects.length > 0이면 노란 원(r=4) 하나
```

**변경 후:**
```
   ★★
 ┌──hex──┐
 │  img  │ ⚡  ← 우측 상단에 아이콘 그룹 (최대 3개)
 │       │ 🛡
 └───────┘
 [HP bar  ]
 [Mana bar]
```

- HEX 우상단에 상태이상 아이콘을 **세로로 나열** (최대 3개)
- 각 아이콘: SVG `<text>` 또는 `<rect>` + `<text>` 조합
- 크기: 각 `10x10` (HEX_R=40 기준 적절한 비율)
- 배경: 해당 상태이상 색상의 원형 또는 둥근 사각형
- 지속시간: 아이콘 하단에 얇은 호(arc) 또는 파이 차트 형태
- 스턴/무적 등 중요 CC는 유닛 전체에 **반투명 오버레이** 추가
  - stun: `rgba(251, 191, 36, 0.2)` 오버레이 + 스턴 이펙트
  - invulnerable: `rgba(192, 132, 252, 0.2)` 오버레이

### 2.4 R4: 상태이상 설정 공유 모듈

`UnitToken`(HTML)과 `ReplayBoard`(SVG) 양쪽에서 동일한 상태이상 정의를 사용하도록 공통 모듈을 분리한다.

```typescript
// src/lib/statusEffectConfig.ts
export const STATUS_EFFECT_CONFIG: Record<StatusEffectType, {
  icon: string;       // 유니코드 기호
  color: string;      // 메인 색상
  bgColor: string;    // 배경 색상
  category: 'debuff-cc' | 'debuff-dot' | 'buff';
  label: string;      // 한글 레이블
}>;
```

---

## 3. 스코프 경계

### 포함 (In Scope)
- 상태이상 공통 설정 모듈 생성
- UnitToken 상태이상 뱃지 리디자인
- ReplayBoard SVG 상태이상 아이콘 리디자인
- 스턴/무적 시 반투명 오버레이 효과
- 지속시간 시각적 인디케이터 (progress bar 또는 arc)

### 제외 (Out of Scope)
- 상태이상 적용/해제 애니메이션 (별도 feature)
- 이벤트 로그에 상태이상 필터 추가
- 상태이상 통계 (총 CC 시간 등) — 분석 feature에서 처리
- 새로운 상태이상 타입 추가 (엔진 변경 필요)

---

## 4. 구현 순서

1. `src/lib/statusEffectConfig.ts` — 공통 설정 모듈 생성 (아이콘, 색상, 카테고리)
2. `src/components/battle/StatusEffectBadge.tsx` — 재사용 가능한 뱃지 컴포넌트 (HTML 버전)
3. `src/components/battle/UnitToken.tsx` — 기존 STATUS_ICONS 제거, 새 뱃지 시스템 적용
4. `src/components/battle/ReplayBoard.tsx` — SVG 상태이상 아이콘 그룹 + 오버레이 구현
5. 스타일 미세조정 및 크기별(sm/md) 테스트

---

## 5. 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/statusEffectConfig.ts` | **신규** — 상태이상 공통 설정 (아이콘, 색상, 카테고리, 레이블) |
| `src/components/battle/StatusEffectBadge.tsx` | **신규** — HTML 상태이상 뱃지 컴포넌트 |
| `src/components/battle/UnitToken.tsx` | STATUS_ICONS 제거 → StatusEffectBadge 사용, 레이아웃 변경 |
| `src/components/battle/ReplayBoard.tsx` | 노란 점 → SVG 아이콘 그룹 + 오버레이 효과 |

---

## 6. 기술 고려사항

### 6.1 성능
- ReplayBoard에 유닛 최대 16개 × 상태이상 최대 3개 = SVG 요소 48개 추가
- tick마다 갱신되므로 불필요한 리렌더 최소화 필요
- SVG `<use>` 태그로 아이콘 정의 재사용 고려

### 6.2 반응형
- UnitToken `size='sm'` 모드에서는 뱃지를 축소하거나 아이콘만 표시
- 모바일 뷰에서 HEX_R이 작아질 경우 상태이상 표시 간소화 (아이콘만, 지속시간 숨김)

### 6.3 접근성
- 각 뱃지에 `title` 속성으로 "스턴 (3틱 남음)" 등 텍스트 제공
- 색상만으로 구분하지 않도록 아이콘 기호도 함께 표시
