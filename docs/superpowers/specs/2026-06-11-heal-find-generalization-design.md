# 일반화 self-heal resolver — 설계 spec

- **날짜**: 2026-06-11
- **대상**: `src/lib/simulator/engine/combatLoop.ts` config.heal 블록 (현재 `:7056-7102`)
- **동기**: champion ingest 누적으로 `config.heal:true` 인데 sim heal 이 0인 챔프 다수 발견 (IvernMinion #215 / Reksai #195 / Gragas #202 계열). 챔프별 healVar 후보 추가 방식이 한계 — 신규 챔프마다 누락 재발.

## 1. 문제 정의

현재 heal 로직은 단일 게이트 변수 find 에 의존한다.

```ts
const healVar = unit.champion.ability.variables.find(v =>
  v.name === 'Heal' || v.name === 'APHeal' || v.name === 'PercentMaximumHealthHealing'
  || v.name === 'HealthDrain' || v.name === 'HEALING');
if (healVar) {
  // ... 이 게이트 안에서만 apHealingVar('APHealing') / pctHealthHealVar('HealingPercentHealth') 추가 read
}
```

게이트 변수가 없으면 `healVar=undefined` → **블록 전체 skip** (게이트 안의 보조 변수 read 도 unreachable).

`config.heal:true` set17 챔프 10명 중 heal 변수 실측:

| 챔프 | heal 변수 (raw) | 현재 sim |
|------|----------------|---------|
| Reksai | `PercentMaximumHealthHealing` 0.065 / `APHealing` [90,200,220,260] | ✅ (단 APHealing ★1 indexing off-by-one — 아래) |
| Gragas | `HEALING` [0,415,470,630] / `HealingPercentHealth` 0.085 | ✅ both |
| Illaoi | `HealthDrain` [40,55,85,130] (×NumEnemies) | ✅ (단 ★1 indexing off-by-one) |
| Galio | `Heal` [0,900,1300,3000] | ✅ |
| **IvernMinion** | `HealingPercentHealth` 0.08 / `HealingAP` [80,380,430,600] | ❌ **0** (게이트 변수 0개) |
| **Aatrox** | `HealHP` 0.10 / `HealAP` [150,300,375,575] | ❌ **0** |
| **Rhaast** | `HealAmount` [1,500,550,650] | ❌ **0** |
| **TahmKench** | `HealHP` 0.085 / `HealAP` [0,300,360,1500] / (`PercentHealingToShield` 0.4) | ❌ **0** |
| **Fiora** | `PercentHealing` 0.15 | ❌ **0** |
| Chogath | `PercentMaximumHealthDamage` 0.08 / `BonusHealthOnKill` / `BonusHealthPerCast` | ➖ 0 (heal 변수 아님 — 전부 damage/HP성장) |
| Morgana | (heal 변수 0개 — Shield/Tether/Omnivamp) | ➖ 0 (config.heal:true 이나 heal 변수 없음 → 계속 0) |

→ **5챔프(IvernMinion/Aatrox/Rhaast/TahmKench/Fiora) heal 완전 미반영**.

> ⚠️ **데이터 소스 정정 (구현 중 발견)**: 위 표는 sim 실제 로드 소스인 **`public/data/tft_set17_champions.json`** 기준. 최초 분석에 쓴 `raw-data/tft_en_us.json` 은 Morgana ability 가 다름(APHealthGain/APHealing 등 — 다른 패치/리워크 버전). **sim ground truth = `public/data`**. Morgana 는 public data 에 heal 변수 0개 → 미반영 대상 아님 (Chogath 동류). Fiora 도 public data 엔 `AuraHealing` 없음 → 보수 제외 우려 moot.

## 2. 핵심 함정 — "Health" 가 "heal" 을 포함

`/heal/i` 단순 매칭은 **"Health" 를 false-positive** 로 잡는다 (`H-e-a-l-th`):
- Chogath `PercentMaximumHealthDamage` (피해!), `BonusHealthOnKill` / `BonusHealthPerCast` (영구 HP 성장 — `chogath_hp` #208 별도 처리)
- → heal 로 오인 시 Chogath 에 없던 heal/잘못된 회복 **신규 버그 유발**

따라서 단순 substring 금지. **positive 패턴 + exclusion 가드** 필요.

## 3. 설계

### 3.1 분류 함수 (순수, 테스트 가능)

```ts
/**
 * ability 변수명이 self-heal 변수인지 판별 (positive 패턴 + exclusion).
 * 'drain' = HealthDrain (×NumEnemies special) / 'amount' = 일반 heal 금액 (값 크기로
 * maxHp% vs AP-scaled 는 resolver 가 결정) / null = heal 아님.
 */
function classifyHealVar(name: string): 'drain' | 'amount' | null {
  // 1) exclusion 먼저 — Health/Heal 포함해도 heal 금액 아님
  if (/Duration|Shield|Shielding|ToShield|PerAstro|Aura|Cooldown|Ratio|Threshold|Damage|OnKill|PerCast/i.test(name)) {
    return null;
  }
  // 2) positive heal 패턴
  if (/^HealthDrain$/i.test(name)) return 'drain';
  if (/Healing|^Heal(HP|AP|Amount)?$|HealthGain|PercentHealing/i.test(name)) {
    return 'amount';
  }
  return null;
}
```

> 함수는 매칭 여부 + drain 특수 분기만 판정. `amount` 의 maxHp% vs AP-scaled 세부 분기는 resolver 가 `readVarByStar` 결과 값 크기(`< 1`)로 결정 (3.2).

**positive 패턴 근거**:
- `Healing` — Healing/HealingAP/HealingPercentHealth/APHealing/HEALING (대소문자 무시)
- `^Heal(HP|AP|Amount)?$` — Heal/HealHP/HealAP/HealAmount
- `HealthGain` — APHealthGain/PercentHPHealthGain (Morgana)
- `PercentHealing` — Fiora
- `^HealthDrain$` — Illaoi (special)

**exclusion 근거** (각 토큰이 차단하는 실제 변수):
- `Duration` → HealDuration/HealthGainDuration
- `Shield`/`Shielding`/`ToShield` → HealingAndShieldingPerAstro/PercentHealingToShield
- `PerAstro` → HealingAndShieldingPerAstro/MeepsPerAstro
- `Aura` → AuraHealing (보수적 제외 — 아군 aura 가능성)
- `Damage` → PercentMaximumHealthDamage (Chogath)
- `OnKill`/`PerCast` → BonusHealthOnKill/BonusHealthPerCast (Chogath HP성장)
- `Threshold`/`Ratio`/`Cooldown` → 방어적

### 3.2 값 분류 + star 인덱싱

매칭된 변수마다:
- `drain` (HealthDrain) → `readVarByStar(v.value, star) × (1+ap/100) × min(NumEnemies, aliveTargetCount)` (기존 Illaoi 로직 보존)
- 값 `< 1` → maxHp%: `unit.maxHp × readVarByStar(v.value, star)`
- 값 `≥ 1` → AP-scaled: `readVarByStar(v.value, star) × (1+ap/100)`

> 값 분류용 representative 값 = `readVarByStar(v.value, star)` 결과 (star별 값). `< 1` 판정도 그 값 기준.

**star 인덱싱 = `readVarByStar` (filler-aware) 일괄**. 기존 인라인 코드의 `Math.min(star, len-1)` 대체. 이로 인한 변화:
- Reksai `APHealing` [90,200,220,260]: v0=90<v1=200 non-filler → ★1=idx0=**90** (현재 min→200, off-by-one 교정. reksai.md 위키 의도 ★1=90 과 일치)
- Illaoi `HealthDrain` [40,55,85,130]: non-filler → ★1=idx0=**40** (현재 min→55)
- Gragas `HEALING` [0,…] / Galio `Heal` [0,…]: zero-filler → idx=star, **불변**

> edge case 인정: IvernMinion `HealingAP` [80,380,…,80,80] 는 ratio 380/80=4.75<5 라 readVarByStar 가 non-filler 로 오판 → ★1=80 (실 의도 380 가능). **외부 검증 안 하기로 결정 (사용자 승인) — 0 보다는 개선, 위키에 edge case 표기**.

### 3.3 resolver 구조 (isolation)

현재 인라인 heal 블록(`:7056-7102`, ~47줄) → 순수 helper 추출:

```ts
/** cast 시 시전자 self-heal 총량 계산 (healAmp 적용 전, maxHp cap 전). */
function resolveSelfHeal(unit: CombatUnit, aliveTargetCount: number): number {
  let healAmount = 0;
  for (const v of unit.champion.ability.variables ?? []) {
    const kind = classifyHealVar(v.name);
    if (!kind) continue;
    const val = readVarByStar(v.value, unit.starLevel);
    if (kind === 'drain') {
      const numEnemiesVar = unit.champion.ability.variables.find(x => x.name === 'NumEnemies');
      const cap = numEnemiesVar ? readVarByStar(numEnemiesVar.value, unit.starLevel) || 1 : 1;
      healAmount += val * (1 + unit.stats.ap / 100) * Math.min(cap, Math.max(1, aliveTargetCount));
    } else if (val < 1) {
      healAmount += unit.maxHp * val;
    } else {
      healAmount += val * (1 + unit.stats.ap / 100);
    }
  }
  return Math.round(healAmount);
}
```

cast loop 호출부:
```ts
if (config.heal) {
  const healAmount = resolveSelfHeal(unit, aliveTargets.length);
  if (healAmount > 0) {
    const finalHeal = healAmount * (1 + (unit.healAmp ?? 0));
    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + finalHeal);
  }
}
```

> 결정론 유지 — `Math.random()` 무사용, 입력 동일 시 동일 결과 (Replay 보장).

## 4. 영향 범위 (회귀 가드)

| 분류 | 챔프 | 변화 | 회귀 가드 |
|------|------|------|----------|
| 신규 반영 (0→heal) | IvernMinion / Aatrox / Rhaast / TahmKench / Fiora (5) | heal 반영 시작 | 각 챔프 시나리오 heal snapshot 신규 |
| indexing 교정 | Reksai(APHealing ★1 200→90) / Illaoi(HealthDrain ★1 55→40) | ★1 heal 값 변경 | 기존 golden snapshot 갱신 |
| 불변 (검증됨) | Gragas / Galio / Chogath / Morgana (heal 변수 0개) | 없음 | 기존 snapshot 불변 확인 |

회귀 가드 테스트 신규: `heal-resolver-generalization.test.ts` — classifyHealVar 단위 테스트(positive/exclusion 케이스, 특히 Chogath HealthDamage/HealthOnKill 차단) + 6 신규 챔프 heal snapshot + Reksai/Illaoi 교정값 검증.

## 5. 보수적 제외 — 위키 "🔍 검증 필요" 표기

코드는 exclusion 패턴으로 보수 처리. public/data 기준 실제로 매칭되는 모호 변수는 없으나(아래는 raw/타 set 대비 방어), exclusion 토큰이 미래 ingest 시 false-positive 를 막는다:
- **`AuraHealing`** (raw Fiora) — 아군 aura 가능성 → `Aura` exclusion. (단 public/data Fiora 엔 부재 — PercentHealing 만 반영)
- **`PercentHealingToShield`** (raw TahmKench) — heal→shield 변환 비율 → `Shield`/`ToShield` exclusion. (public/data TahmKench 매칭 변수는 HealHP/HealAP 뿐)
- **`HealingReduction`/`AllyHealing`/`HealingIncrease`** — amp/ally/debuff → `Reduction`/`Ally`/`Increase` exclusion (code review Task 1 추가)

## 6. 비범위 (YAGNI)

- HealDuration over-time heal → 기존대로 cast 순간 lump-sum (Illaoi 주석 정합)
- set16 챔프 heal 정확도 — 본 resolver 가 set 무관 동작하나 set16 회귀 검증은 비범위 (set17 focus). 단 set16 snapshot 불변 확인은 포함
- raw-data(타 패치/set) 의 AuraHealing/PercentHealingToShield 실 semantics fix — public/data 도달 시 별도 검증

## 7. 후속 (구현 후)

- diff-cache 재생성 (engineSha 갱신 — heal 변경이 actual-data diff 에 반영되는지)
- 위키 P1 resolved 갱신: ivernminion.md / reksai.md / gragas.md(이미 resolved 라 영향 확인) + aatrox/rhaast/tahmkench/fiora/morgana 페이지(미작성 — heal 항목만 우선 or 다음 ingest 시)
- 메모리 `champion-ingest-status` heal find 일반화 과제 resolved 갱신
