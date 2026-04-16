# Champion Ability Audit — Design Document

> Plan 참조: `docs/01-plan/features/champion-ability-audit.plan.md`

---

## 1. 감사 스크립트 설계 (`scripts/audit-abilities.ts`)

### 1.1 입력/출력

```
Input:
  - public/data/tft_set16_champions.json (106 TFT16 champions)
  - src/lib/simulator/systems/ability.ts (CHAMPION_ABILITY_PATTERNS)

Output:
  - stdout: 불일치 리포트 (severity별 정렬)
  - scripts/audit-report.json (기계 판독용)
```

### 1.2 검출 규칙 (Detection Rules)

총 8개 규칙을 순서대로 적용:

#### Rule 1: 미등록 검출 (`NOT_REGISTERED`)
```
조건: champion.apiName이 CHAMPION_ABILITY_PATTERNS에 없음
제외: 특수 유닛 목록 (SPECIAL_UNITS)
심각도: MAJOR
```

**특수 유닛 제외 목록:**
```ts
const SPECIAL_UNITS = [
  'TFT16_AnnieTibbers',   // 소환수
  'TFT16_AzirSoldier',    // 모래 병사
  'TFT16_MalzaharVoidling', // 공허충
  'TFT16_FreljordProp',   // 장식물
  'TFT16_PiltoverInvention', // 발명품
  'TFT16_RiftHerald',     // 전령
  'TFT16_BaronNashor',    // 내셔 남작
  'TFT16_THex',           // T-헥스
];
```

#### Rule 2: 스턴 누락 (`STUN_MISSING`)
```
조건: desc에 '기절' 또는 'StunDuration' 포함 && ability config에 stun 없음
심각도: MAJOR
```

#### Rule 3: 힐 누락 (`HEAL_MISSING`)
```
조건: desc에 '회복' 또는 '치유' 포함 && ability config에 heal: true 없음
제외: desc에 '흡혈'만 있는 경우 (옴니뱀프로 처리됨)
심각도: MAJOR
```

현재 발견된 힐 누락 7건:
- `Garen`, `Seraphine`, `Swain`, `Singed`, `Taric`, `Ryze`, `Kindred`

#### Rule 4: 대시 누락 (`DASH_MISSING`)
```
조건: desc에 '도약'|'돌진'|'날아' 포함 && ability config에 dash 없음
심각도: MAJOR
```

현재 발견된 대시 누락 5건:
- `Poppy`, `Leblanc`, `Diana`, `Lissandra`, `Volibear`

#### Rule 5: 쉴드 누락 (`SHIELD_MISSING`)
```
조건: desc에 '보호막' 또는 'Shield' 포함 && ability 변수에 Shield 계열 없음
심각도: MINOR (getAbilityShield()가 범용 처리하므로 변수만 있으면 OK)
```

#### Rule 6: 패턴 불일치 (`PATTERN_MISMATCH`)
```
조건: desc 키워드 기반 추정 패턴 vs 등록된 pattern 불일치
  - '주변 적' + '범위' → aoe_circle 예상
  - '가장 먼 적' → dash: to_farthest 예상
  - '직선' + '관통' → line 예상
  - '적 N명' → multi 예상 (maxTargets=N)
심각도: CRITICAL (패턴 자체가 틀리면 타게팅 완전히 다름)
```

#### Rule 7: 버프/디버프 누락 (`BUFF_MISSING`)
```
조건: desc에 '공격 속도 증가'|'공격력 증가' && selfBuff/allyBuff 없음
심각도: MINOR
```

#### Rule 8: 패시브 미구현 (`PASSIVE_NOT_IMPL`)
```
조건: desc에 '<spellPassive>' 태그 존재
심각도: INFO (별도 feature 필요, 참고용)
```

### 1.3 출력 형식

```ts
interface AuditResult {
  champion: string;       // apiName
  name: string;           // 한글 이름
  cost: number;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
  rule: string;           // 규칙 ID
  message: string;        // 상세 설명
  descExcerpt: string;    // description 관련 부분 발췌
  currentConfig?: object; // 현재 ability config (등록된 경우)
  suggestedFix?: object;  // 제안 수정 (가능한 경우)
}
```

**콘솔 출력 예시:**
```
══════════════════════════════════════════════════
  Champion Ability Audit Report
  Total: 106 | Checked: 98 | Special: 8
══════════════════════════════════════════════════

[CRITICAL] (0 issues)

[MAJOR] (23 issues)
  TFT16_Bard (바드): NOT_REGISTERED — ability.ts에 미등록
  TFT16_Garen (가렌): HEAL_MISSING — desc에 '회복' 있으나 heal: true 없음
    desc: "...체력을 @ModifiedHeal@ 회복합니다..."
    fix: { heal: true }
  TFT16_Poppy (뽀삐): DASH_MISSING — desc에 '돌진' 있으나 dash 없음
    desc: "...적에게 돌진해..."
    fix: { dash: 'to_target' }

[MINOR] (12 issues)
  ...

[INFO] (33 issues — passive)
  TFT16_Viego (비에고): PASSIVE_NOT_IMPL — <spellPassive> 존재
  ...

══════════════════════════════════════════════════
  Summary: 0 CRITICAL / 23 MAJOR / 12 MINOR / 33 INFO
══════════════════════════════════════════════════
```

---

## 2. 감사 스크립트 구조

```ts
// scripts/audit-abilities.ts

// 1. 데이터 로드
const champions = loadChampionsJson();
const abilityPatterns = parseAbilityPatternsFromSource();

// 2. 규칙 실행
const rules: AuditRule[] = [
  new NotRegisteredRule(),
  new StunMissingRule(),
  new HealMissingRule(),
  new DashMissingRule(),
  new ShieldMissingRule(),
  new PatternMismatchRule(),
  new BuffMissingRule(),
  new PassiveNotImplRule(),
];

const results: AuditResult[] = [];
for (const champ of champions) {
  if (SPECIAL_UNITS.includes(champ.apiName)) continue;
  for (const rule of rules) {
    const issue = rule.check(champ, abilityPatterns[champ.apiName]);
    if (issue) results.push(issue);
  }
}

// 3. 출력
printReport(results);
writeJsonReport(results);
```

### 2.1 실행 방법

```bash
npx tsx scripts/audit-abilities.ts
```

`tsx`를 devDependency로 사용 (이미 Next.js 프로젝트이므로 ts-node 대신).

---

## 3. ability.ts 수정 설계

### 3.1 수정 우선순위

| 순서 | 대상 | 작업 |
|------|------|------|
| 1 | HEAL_MISSING 7건 | `heal: true` 추가 |
| 2 | DASH_MISSING 5건 | `dash` 필드 추가 (desc에서 대상 유형 파악) |
| 3 | NOT_REGISTERED 11건 | 신규 등록 (단순 패턴만) |
| 4 | PATTERN_MISMATCH | 감사 스크립트 결과 기반 교정 |
| 5 | BUFF_MISSING | selfBuff/allyBuff/debuff 추가 |

### 3.2 미등록 11개 챔피언 예상 config

| 챔피언 | 예상 config |
|--------|------------|
| Atakhan | `{ pattern: 'aoe_circle', radius: 2, heal: true }` |
| Bard | `{ pattern: 'multi', maxTargets: 3 }` — 정령 발사 |
| Blitzcrank | `{ pattern: 'single', stun: 1.0 }` — 후킹은 MVP 외 |
| Kobuko | `{ pattern: 'self_buff' }` — 합체는 MVP 외 |
| Mel | `{ pattern: 'multi', maxTargets: 3 }` — 찬란 발사 |
| Nautilus | `{ pattern: 'single', stun: 2.0 }` — 앵커 |
| Sion | `{ pattern: 'aoe_circle', radius: 2, stun: 1.5 }` |
| Thresh | `{ pattern: 'single', stun: 1.5 }` — 후킹은 MVP 외 |
| Viego | `{ pattern: 'self_buff', selfBuff: { attackSpeed: 0.5, duration: 999 } }` |
| Yorick | `{ pattern: 'self_buff', heal: true }` — 구울은 MVP 외 |
| Azir | `{ pattern: 'multi', maxTargets: 3 }` — 병사는 MVP 외 |

> 실제 config는 각 챔피언의 description을 정밀 분석 후 확정

### 3.3 HEAL_MISSING 수정 상세

| 챔피언 | 현재 config | 추가할 필드 |
|--------|------------|------------|
| Garen | `{ pattern: 'aoe_circle', radius: 1, selfBuff, heal: true }` | **이미 있음 — 재확인 필요** |
| Seraphine | `{ pattern: 'self_buff' }` | `heal: true` |
| Swain | `{ pattern: 'aoe_circle', radius: 2, stun: 1.5 }` | `heal: true` |
| Singed | `{ pattern: 'self_buff' }` | `heal: true` |
| Taric | `{ pattern: 'self_buff' }` | `heal: true` |
| Ryze | `{ pattern: 'bounce', maxTargets: 3, damageDecay: 0.2 }` | `heal: true` |
| Kindred | `{ pattern: 'aoe_circle', radius: 2, dash, selfBuff }` | `heal: true` |

### 3.4 DASH_MISSING 수정 상세

| 챔피언 | 현재 config | desc 키워드 | 추가할 dash |
|--------|------------|------------|------------|
| Poppy | `{ pattern: 'single', stun: 1.0 }` | "적에게 돌진" | `dash: 'to_target'` |
| Leblanc | `{ pattern: 'single', stun: 1.5 }` | "날아가" | `dash: 'to_target'` |
| Diana | `{ pattern: 'aoe_circle', radius: 1 }` | "도약" | `dash: 'to_target'` |
| Lissandra | `{ pattern: 'single', stun: 2.0 }` | "돌진" | `dash: 'to_target'` |
| Volibear | `{ pattern: 'single' }` | "도약" | `dash: 'to_target'` |

---

## 4. combatLoop.ts 영향 분석

현재 combatLoop.ts가 이미 처리하는 것:
- `heal: true` → `Heal` 변수에서 회복량 읽어 적용 ✅
- `dash` → 시전 전 이동 처리 ✅
- `stun` → 대상에게 기절 상태 부여 ✅
- `selfBuff` / `allyBuff` → 스탯 버프 적용 ✅
- `debuff` → 방어력/마저 감소 적용 ✅

**combatLoop.ts 수정 불필요** — ability.ts의 config만 교정하면 전투 로직이 자동 반영됨.

---

## 5. 구현 순서

```
Step 1: 감사 스크립트 작성 (scripts/audit-abilities.ts)
         ↓
Step 2: 스크립트 실행 → 전체 불일치 리포트 확인
         ↓
Step 3: CRITICAL 수정 (패턴 오류)
         ↓
Step 4: MAJOR 수정 (효과 누락 + 미등록)
  4-1: heal 누락 7건 수정
  4-2: dash 누락 5건 수정
  4-3: 미등록 11개 챔피언 추가
         ↓
Step 5: MINOR 수정 (버프/디버프 누락)
         ↓
Step 6: 감사 스크립트 재실행 → 잔여 이슈 확인
         ↓
Step 7: pnpm lint && pnpm typecheck && pnpm build
```

---

## 6. 수정 대상 파일 요약

| 파일 | 작업 | 예상 변경량 |
|------|------|-----------|
| `scripts/audit-abilities.ts` | **신규** | ~200줄 |
| `src/lib/simulator/systems/ability.ts` | **수정** | config 추가/수정 ~30건 |
| `src/lib/simulator/engine/combatLoop.ts` | 수정 없음 | 0줄 |
