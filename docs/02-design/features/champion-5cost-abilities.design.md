# Design: 5코스트 챔피언 스킬 + 고유 시너지 정확도 개선

Plan 참조: [`docs/01-plan/features/champion-5cost-abilities.plan.md`](../../01-plan/features/champion-5cost-abilities.plan.md)

---

## 1. 현재 구현 현황

### 1.1 재사용 (핵심 패턴 확인 완료)

| 항목 | 위치 | 역할 |
|------|------|------|
| `AUTO_UNIT_API_NAMES` | `src/data/specialUnits.ts:45-54` | 자동 소환 유닛 판별 집합 |
| `VOYAGER_SUMMON_CHAMPION` 정의 | `src/data/specialUnits.ts:35-43` | 비아/바이엔 데이터 템플릿 |
| `syncVoyagerSummonInTeam(team)` | `src/hooks/useTeamManagement.ts:135-158` | **길잡이 trait ≥ 3 → `TFT17_Summon` 자동 추가/제거** |
| `syncTeam` 훅 | `useTeamManagement.ts:` (updatePlayerTeam/updateEnemyTeam 내부) | 팀 변경 시 파생 상태 갱신 |
| `getChampionImage(apiName)` | `src/data/imageMap.ts:7-19` | `TFT17_ShenProp` → `/data/images/tft_set17_champions/shenprop_square.tft_set17.png` 자동 매핑 |
| `isAutoUnit` 가드 | `useTeamManagement.ts:301,350,360,400` | 아이템/별/삭제/사이클 조작 차단 |

### 1.2 조사 결과 — 쉔 유물

| 항목 | 결과 |
|------|-----|
| CommunityDragon apiName | **`TFT17_ShenProp`** 확정 (`tft17_shenprop/` 디렉토리) |
| 아이콘 URL | `https://raw.communitydragon.org/latest/game/assets/characters/tft17_shenprop/hud/tft17_shenprop_square.tft_set17.png` (HTTP 200, 128×128 RGBA PNG, 20.6KB) |
| 로컬 champions.json entry | 없음 — 수동 정의 필요 (`specialUnits.ts`) |
| 로컬 이미지 | 없음 — 다운로드해 `public/data/images/tft_set17_champions/shenprop_square.tft_set17.png` 저장 |
| Trait 정보 | `TFT17_ShenUniqueTrait`, unique=true, breakpoints=[1], desc = "배치할 수 있는 유물 소환 + 전투 시작 시 인접 아군 보호막/공속" |
| 발동 조건 | 쉔 1명 (unique trait 이라 breakpoint=1) → 쉔이 팀에 있으면 **항상** 소환 |

### 1.3 Unique Trait Audit 결과 (FR-06 완료)

| # | Trait | apiName | 엔진 참조 | 구현 상태 |
|---|-------|---------|-----------|----------|
| 1 | 보루 (쉔) | `TFT17_ShenUniqueTrait` | **없음** | ❌ 완전 미구현 |
| 2 | 파멸자 (벡스) | `TFT17_VexUniqueTrait` | **없음** | ❌ 완전 미구현 |
| 3 | 신성결투가 (피오라) | `TFT17_FioraUniqueTrait` | **없음** | ❌ 완전 미구현 |
| 4 | 어둠의 여인 (모르가나) | `TFT17_MorganaUniqueTrait` | **없음** | ❌ 완전 미구현 |
| 5 | 말살자 (진) | `TFT17_JhinUniqueTrait` | **없음** | ❌ 완전 미구현 |
| 6 | 파티광 (블리츠) | `TFT17_BlitzcrankUniqueTrait` | **없음** | ❌ 완전 미구현 |
| 7 | 은하계 사냥꾼 (제드) | `TFT17_ZedUniqueTrait` | **없음** | ❌ 완전 미구현 |
| 8 | 지휘관 (소나) | `TFT17_SonaUniqueTrait` | `item.ts:113` `TFT17_SonaUnique_` 아이템 스킵 | 🟡 PvP 메타 의도 스킵 |
| 9 | 최신상 (그레이브즈) | `TFT17_GravesTrait` | `item.ts:112` `TFT17_GravesTrait_` 아이템 스킵 | 🟡 PvP 메타 의도 스킵 |

**결론**: 7개는 완전 미구현, 2개는 의도적 스킵. Phase B 에서 **정적 버프형 3종** (말살자·어둠의 여인·보루) 을 우선 구현.

### 1.4 이번에 구현할 것

| # | 항목 | 우선순위 |
|---|------|---------|
| A1 | `TFT17_ShenProp` 유물 정의 + `AUTO_UNIT_API_NAMES` 추가 | P0 |
| A2 | `syncShenArtifactInTeam(team)` 훅 추가 및 `syncTeam` 체인에 연결 | P0 |
| A3 | 유물 아이콘 로컬 저장 | P0 |
| A4 | 보루 trait 효과 (인접 아군 보호막 + 공속) | P0 |
| B1 | 말살자(진) — 적 전체 방어력/마저 정적 감소 | P0 |
| B2 | 어둠의 여인(모르가나) — 아군 스킬 피해 정적 감소 | P0 |
| C1 | 쉔 스킬 `selfBuff.shield` 추가 | P1 |
| C2 | 모르가나 스킬 `selfBuff.shield + transformed:true` 추가 | P1 |

**범위 외 (별도 feature)**: 제드 분신, 진 패시브 공속 전환, 벡스 첫 피격 이벤트, 파티광 HP 임계치 로직.

---

## 2. 데이터 흐름

```
[편집창에서 쉔 배치]
      │
      ▼
updatePlayerTeam(prev => [...prev, {champion: shen, ...}])
      │
      ▼
syncTeam(updated)
      │
      ├─ syncVoyagerSummonInTeam()   ← 기존 (길잡이 ≥ 3)
      │
      └─ syncShenArtifactInTeam()    ← NEW (쉔 있음 → TFT17_ShenProp 추가)
                │
                ▼
        [보드에 유물 자동 배치 + isAutoUnit 가드로 아이템/별 조작 차단]

[전투 시작 — resolveTraits(...)]
      │
      ▼
활성 trait 집합에 TFT17_ShenUniqueTrait 포함 (쉔 1명)
      │
      ▼
trait effect 적용 단계 (combatLoop init)
      │
      └─ TFT17_ShenUniqueTrait 핸들러 — 유물 주변 인접 6칸 아군에 shield + AS 부여

[쉔 제거]
      │
      ▼
updatePlayerTeam → syncTeam
      │
      └─ syncShenArtifactInTeam — 쉔 없음 + 유물 있음 → 유물 제거
```

---

## 3. 모듈 설계

### 3.1 유물 유닛 정의 (A1)

**파일**: `src/data/specialUnits.ts`

```ts
export const SHEN_ARTIFACT_CHAMPION: RawChampion = {
  name: '유물',
  apiName: 'TFT17_ShenProp',
  cost: 11,                     // 자동 소환 유닛 규약 (비아/바이엔/티버와 동일)
  traits: [],
  role: null,                   // 이동/공격 없음 (totem)
  stats: {
    hp: 1000,                   // 타겟 불가이므로 명목상 수치 (정확 수치는 Do 단계에서 CD 확인 보완)
    armor: 60, magicResist: 60,
    damage: 0, attackSpeed: 0, range: 0,
    critChance: 0, critMultiplier: 1.0,
    initialMana: 0, mana: 0,
  },
  ability: {
    name: '수호 유물',
    desc: '전투 시작 시 인접 아군에게 최대 체력 비례 보호막과 공격 속도를 부여합니다.',
    icon: '',
    variables: [],
  },
};

export const AUTO_UNIT_API_NAMES = [
  'TFT16_AnnieTibbers',
  'TFT16_FreljordTurret',
  'TFT16_AzirSoldier',
  'TFT17_Summon',
  'TFT17_ShenProp',    // NEW
] as const;
```

**근거**: 스탯 값은 TFT 원본 데이터에 PvE 엔트리가 노출되지 않아 추정치. Do 단계에서 `tft17_shenprop/` 의 `.bin` 파일을 직접 파싱하는 대안은 과도 — 게임 플레이에 영향 없는 totem 이므로 합리적 기본값 사용.

### 3.2 `syncShenArtifactInTeam` 훅 (A2)

**파일**: `src/hooks/useTeamManagement.ts`

```ts
import { SHEN_ARTIFACT_CHAMPION, /* 기존 imports */ } from '@/data/specialUnits';

function syncShenArtifactInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const hasShen = team.some(p => p.champion.apiName === 'TFT17_Shen');
  const hasArtifact = team.some(p => p.champion.apiName === 'TFT17_ShenProp');

  if (hasShen && !hasArtifact) {
    const shen = team.find(p => p.champion.apiName === 'TFT17_Shen')!;
    const occupied = new Set(team.map(p => `${p.position.q},${p.position.r}`));
    const pos = findEmptyAdjacentHex(shen.position, occupied, 2);  // 쉔 근처에서 탐색
    if (!pos) return team;  // 빈 슬롯 없으면 소환 보류
    return [...team, {
      champion: SHEN_ARTIFACT_CHAMPION,
      position: pos,
      starLevel: 1,
      items: [],
    }];
  }

  if (!hasShen && hasArtifact) {
    return team.filter(p => p.champion.apiName !== 'TFT17_ShenProp');
  }

  return team;
}
```

**체인 연결** — 기존 `syncTeam()` 안에 `syncVoyagerSummonInTeam` 다음에 순차 호출:

```ts
function syncTeam(team: PlacedChampion[]): PlacedChampion[] {
  let updated = team;
  updated = syncVoyagerSummonInTeam(updated);
  updated = syncShenArtifactInTeam(updated);   // NEW
  return updated;
}
```

### 3.3 유물 아이콘 확보 (A3)

Do 단계에서 한 번:

```bash
curl -o public/data/images/tft_set17_champions/shenprop_square.tft_set17.png \
  'https://raw.communitydragon.org/latest/game/assets/characters/tft17_shenprop/hud/tft17_shenprop_square.tft_set17.png'
```

`imageMap.ts:7-19` 의 `getChampionImage('TFT17_ShenProp')` 가 규칙적으로 위 경로를 생성 — **코드 변경 불필요**.

### 3.4 보루 trait 효과 (A4)

**파일**: `src/lib/simulator/systems/trait.ts` (혹은 새 파일 `traits/shenBastion.ts`)

엔진의 기존 trait 핸들러 패턴을 따른다. 현재 trait.ts 에서 `TFT17_*` trait 을 어떻게 처리하는지 Do 단계에서 확인 후 동일 패턴으로 작성.

**의사 코드**:

```ts
function applyShenBastionTrait(
  playerTeam: CombatUnit[],
  activeTraits: ResolvedTrait[],
) {
  const bastion = activeTraits.find(t => t.trait.apiName === 'TFT17_ShenUniqueTrait');
  if (!bastion) return;

  const artifact = playerTeam.find(u => u.champion.apiName === 'TFT17_ShenProp');
  if (!artifact) return;

  const shieldPct = resolveVar(bastion, 'PercentHealthShield', 0.15);  // 15% 기본
  const asPct     = resolveVar(bastion, 'AttackSpeed', 0.25);          // 25% 기본

  for (const ally of playerTeam) {
    if (ally.id === artifact.id) continue;
    if (hexDistance(ally.position, artifact.position) > 1) continue;
    ally.shield += ally.maxHp * shieldPct;
    ally.stats.attackSpeed *= (1 + asPct);
  }
}
```

### 3.5 말살자(진) 정적 감소 (B1)

**파일**: `src/lib/simulator/systems/trait.ts` (또는 동일 위치)

```ts
function applyJhinAnnihilatorTrait(
  enemyTeam: CombatUnit[],
  activeTraits: ResolvedTrait[],
) {
  const annih = activeTraits.find(t => t.trait.apiName === 'TFT17_JhinUniqueTrait');
  if (!annih) return;
  const reductionPct = resolveVar(annih, 'PctResists', 0.15);
  for (const e of enemyTeam) {
    e.stats.armor *= (1 - reductionPct);
    e.stats.magicResist *= (1 - reductionPct);
  }
}
```

### 3.6 어둠의 여인(모르가나) 정적 감소 (B2)

```ts
function applyMorganaDarklightTrait(
  playerTeam: CombatUnit[],
  activeTraits: ResolvedTrait[],
) {
  const trait = activeTraits.find(t => t.trait.apiName === 'TFT17_MorganaUniqueTrait');
  if (!trait) return;
  const reduction = resolveVar(trait, 'UntransformedAbilityDA', 0.10);  // 10% 기본
  for (const ally of playerTeam) {
    ally.abilityDamageReduction = (ally.abilityDamageReduction ?? 0) + reduction;
  }
  // 변신 중 추가 감소는 Phase C 에서 transformed flag 추가 후 적용
}
```

**주의**: `CombatUnit` 타입에 `abilityDamageReduction` 필드가 없을 수 있음 → Do 단계에서 타입 확장 결정 (`damageReduction` 기존 필드 재사용 vs 새 필드). 일단 `damageReduction` 재사용으로 시작 → 마법/스킬 특이적 반영은 차후.

### 3.7 쉔/모르가나 스킬 selfBuff (C1, C2)

**파일**: `src/lib/simulator/systems/ability.ts`

```diff
- TFT17_Shen:        { pattern: 'aoe_circle', radius: 2, selfBuff: { attackSpeed: 0.3, duration: 999 } },
+ TFT17_Shen:        {
+   pattern: 'aoe_circle', radius: 2,
+   selfBuff: { shield: 'ModifiedShield', duration: 'ShieldDuration' },  // 변수 바인딩
+ },

- TFT17_Morgana:     { pattern: 'multi', maxTargets: 3, heal: true, dot: { duration: 5 } },
+ TFT17_Morgana:     {
+   pattern: 'multi', maxTargets: 3, dot: { duration: 'Duration' },
+   selfBuff: { shield: 'ModifiedShield', duration: 'Duration' },
+   heal: true,  // omnivamp 패시브 근사 유지
+ },
```

`ability.ts` 의 `selfBuff.shield/duration` 이 **문자열 variable 바인딩 vs 고정 수치**를 지원하는지 Do 단계에서 확인. 미지원이면 `applyAbility()` 쪽 로직 소폭 확장.

---

## 4. 타입 변경

- `CombatUnit` 에 `abilityDamageReduction?: number` 추가 가능성 (B2 정밀도 향상 시).
- `AbilityConfig.selfBuff` 가 현재 숫자만 받는다면 `string | number` 로 확장해 variable 바인딩 허용.

두 변경 모두 **Do 단계에서 기존 구조 확인 후 최소 변경**. 초안은 `damageReduction` 재사용 + `selfBuff.shield` 고정 수치로 시작.

---

## 5. 구현 순서

1. **Phase A — 쉔 유물 소환** (FR-01~05, FR-08 분리)
   1. 유물 아이콘 다운로드 → `public/data/images/tft_set17_champions/shenprop_square.tft_set17.png`
   2. `specialUnits.ts`: `SHEN_ARTIFACT_CHAMPION` 정의 + `AUTO_UNIT_API_NAMES` 추가
   3. `useTeamManagement.ts`: `syncShenArtifactInTeam()` 추가, `syncTeam()` 체인 연결
   4. 편집창 수동 테스트: 쉔 배치 → 유물 표시 / 쉔 제거 → 유물 사라짐
2. **Phase A — 보루 trait 엔진** (FR-03)
   5. `trait.ts` 의 TFT17 trait 핸들러 위치 파악 후 `TFT17_ShenUniqueTrait` 핸들러 추가
   6. 전투 시작 시 인접 아군에 shield + AS 적용
   7. 시뮬 전투 돌려 유물 인접 아군 `shield`, `stats.attackSpeed` 증가 확인
3. **Phase B — 정적 trait 2종**
   8. `TFT17_JhinUniqueTrait` 적 전체 방어력/마저 감소
   9. `TFT17_MorganaUniqueTrait` 아군 `damageReduction` 증가
4. **Phase C — 쉔/모르가나 스킬 selfBuff** (선택)
   10. `ability.ts` 두 챔피언 config 수정
5. **검증**: `pnpm lint && pnpm typecheck && pnpm build` + §7 수동 QA

---

## 6. 경계 조건

| 상황 | 기대 동작 |
|------|----------|
| 쉔 배치 시 빈 슬롯 없음 | 유물 소환 보류 (return team). 다른 유닛 제거 후 재소환. |
| 쉔 이동 (드래그) | 위치 변경 시 `syncShenArtifactInTeam` 은 이미 유물 있음 → 변화 없음. 유물은 원래 위치 유지 (이동 동반 여부는 P2, 별도 논의) |
| 쉔 2명? | unique trait breakpoint=1 이라 유물 1개만 소환. `hasArtifact` 체크로 중복 방지. |
| TEAM A / B 양측 모두 쉔 | 각 팀별 `syncTeam` 호출이라 양쪽 독립적으로 유물 소환 |
| `isAutoUnit` 가드 | 기존 4개 분기(301,350,360,400) 가 `TFT17_ShenProp` 에도 즉시 적용되어 아이템/별/삭제 차단 |
| 전투 중 유물 사망 | `combatLoop` 의 사망 처리 그대로 — 사후 효과 없음 (보호막은 이미 부여됨) |
| `TFT17_ShenUniqueTrait` variables 에 `PercentHealthShield`/`AttackSpeed` 없음 | 기본값 fallback (15% / 25%) — trait desc 의 % 스케일 힌트 기반 추정 |

---

## 7. 테스트 시나리오

### 7.1 쉔 유물 소환 (Phase A)

- [ ] TEAM A 에 쉔 배치 → 옆에 유물 자동 배치. 아이콘 정상 표시.
- [ ] 유물 우클릭 삭제 시도 → `isAutoUnit` 가드로 불가.
- [ ] 유물 드래그로 아이템 올리기 시도 → 불가.
- [ ] 쉔 제거 → 유물 자동 제거.
- [ ] 전투 시작 → 유물 인접 아군의 `currentShield` 양수, `stats.attackSpeed` 증가.
- [ ] 유물이 TEAM A 적진 쪽에 배치되는 시나리오 회피 (쉔 인접 탐색 우선).

### 7.2 정적 trait (Phase B)

- [ ] 진만 배치 → 전투 시작 시 적 전체 `stats.armor`, `stats.magicResist` 15% 감소.
- [ ] 모르가나만 배치 → 아군 전체 `damageReduction` 10% 증가.

### 7.3 스킬 selfBuff (Phase C)

- [ ] 쉔 스킬 발동 시 `currentShield` 증가 ( `ModifiedShield` 변수값 반영).
- [ ] 모르가나 스킬 발동 시 `currentShield` 증가 + `duration` 종료 시 소멸.

### 7.4 회귀

- [ ] 길잡이 ≥ 3 이면 비아/바이엔 자동 소환 정상 (기존 동작 유지).
- [ ] 티버/포탑/모래병사 자동 소환 영향 없음.
- [ ] 팀 코드 import/export 에서 유물/비아·바이엔은 제외 (기존 규약 유지 — encoder 가 AUTO_UNIT 제외하는지 Do 단계 확인).
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 통과.

---

## 8. 위험 요소 & 완화

| 위험 | 완화 |
|------|------|
| `TFT17_ShenUniqueTrait` variables 가 실제 JSON 에 없음 | 기본값 (15%/25%) hardcode. Do 단계에서 `traits.json` 확인 후 실제 변수 발견 시 resolveVar 로 전환 |
| `syncTeam` 이 이미 많은 로직 체인 (비아/바이엔 + 향후 추가) → 복잡도 | 각 sync 함수는 순수 함수 (input team → output team) 로 유지. 부작용 없음 |
| trait.ts 의 핸들러 패턴이 파악 안 되면 Phase A4/B 지연 | Do 단계 초반에 `trait.ts` 한 번 정독. 기존 TFT17 trait (요새/선봉대 등) 코드 패턴 따르면 충분 |
| 유물 소환 위치가 쉔에서 멀리 떨어진 슬롯에 배치됨 | `findEmptyAdjacentHex(shen.position, occupied, 2)` — 쉔 인접 반경 2 까지 우선 탐색 |
| `CombatUnit.abilityDamageReduction` 미지원 | 기존 `damageReduction` 재사용. 스킬 전용 감소가 아닌 전체 감소로 근사. Phase B2 는 이 근사로 충분 |

---

## 9. 범위 외

- 제드 분신 소환 (별도 feature `zed-clone-summon` 권장)
- 진 패시브 고정 공속 + AS→AD 변환 (별도 `jhin-passive-conversion`)
- 벡스 파멸자 첫 피격 이벤트 훅 (별도 `vex-doomed-mark`)
- 블리츠 파티광 HP 임계치 자가회복 (별도 `blitzcrank-partyfoul`)
- 피오라 신성결투가 1대1 자동승 (PvP 메타 — 시뮬 스킵)
- 소나 지휘관 / 그레이브즈 최신상 — 이미 `isDisabledItem` 스킵, 유지
- 모르가나 변신 종료 시 최종 폭발 (Phase C 선택)
- 쉔 패시브 누적 추가 피해 (3회째 고정 피해)
- 5코 이외 챔피언 스킬 audit
