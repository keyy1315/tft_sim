# Diff Attribution 분석 — game-20260423-001 (2026-05-06)

> 별돌보미 매핑 fix (PR #88) 머지 후 baseline. **winnerMatchRate 45.5%**, **avgPlayerDamageErrorPct -52.2%** 의 잔여 오차 원인을 데이터 기반으로 분석. 다음 PR 방향 결정용.

## 요약 — 잔여 오차의 dominant cause

**미구현 hero augments + artifacts** 가 잔여 오차의 가장 큰 비중. Set 17 핵심 trait 4개 (별돌보미/운명술사/N.O.V.A./정령족) 는 모두 sim 구현됐지만, **bench-level augment/artifact 효과 누락**이 raw 손실을 만들고 있음.

## 원본 메트릭

| 메트릭 | 값 | 비고 |
|--------|---|------|
| winnerMatchRate | 45.5% (10/22) | 50% 목표 미달 |
| avgPlayerDamageErrorPct | **-52.2%** | 모든 carry 일관 과소평가 (TwistedFate 만 +40% 단독 양수) |
| avgSurvivorHpErrorPts | 5.77 | 별돌보미 fix 전 9.4 → 개선됨 |

## 핵심 발견

### 1. Stage-bimodal mismatch pattern

Stage 별 winner mismatch 가 **bimodal**:

| Stage | mismatch 패턴 | 해석 |
|-------|--------------|------|
| 2-4 (5건) | actual=opponent, sim=player | sim **과대평가** — 초반 sim 이 player 이긴다고 잘못 예측 |
| 5+ (5건) | actual=player, sim=opponent | sim **과소평가** — 후반 player 의 진짜 승리를 사망/패배로 오판 |

→ **stage-dependent 보정이 누락**되어 있다는 강력한 신호. 후반 augment/artifact 효과가 누적되는데 sim 은 이를 모름.

### 2. 챔프별 damage diff (player team, 22 PvP 라운드)

| 챔프 | rounds | mean diff | median | 비고 |
|------|--------|-----------|--------|------|
| **TwistedFate** | 22 | **+40.2%** | +37% | **단독 양수** — sim 이 과대평가 |
| Caitlyn | 14 | -64.3% | -63% | mark+headshot 구현됨 |
| Aatrox | 17 | -67.2% | -73% | NOVA capstone 구현됨 |
| Jax | 18 | -73.1% | -77% | 요새 trait |
| Milio | 10 | -73.2% | -95% | 운명술사 |
| Talon | 22 | **-83.3%** | -84% | **모든 라운드** 큰 적자 |
| Corki | 7 | -93.1% | -95% | 정령족 carry |
| Riven | 1 | -97.7% | — | outlier (★1, 1 라운드만) |

→ TwistedFate **단독 +40%** 와 나머지 -60%~-93% 의 양극화. TF 의 sim 수치가 부풀려지는 동시에 다른 carry 들은 systemic 누락.

### 3. 미구현 augments (전투 영향) — game-20260423-001

| Augment | 적용 라운드 | 효과 (전투) | 시뮬 | 비고 |
|---------|------------|------------|------|------|
| `VarusGodAugment_BoonOfStars` | **player ×7, opp ×1** | Health + PercentIncrease | ❌ | **stage 4+ player 핵심 augment** |
| `Augment_GiantAndMighty` | player ×11 | FlatHealth + PercentHealth | ❌ | 후반 player tank 강화 누락 |
| `Augment_ExclusiveCustomization` | player ×16 | Gold + NumRemovers | ⚠ 경제만 | NumRemovers UX 영향 |
| `EkkoGodAugment` | opp ×6 | NumRemovers_TOOLTIPONLY | ❌ | 실효는 다른 매커니즘에서 |
| `Augment_SeraphimsStaff` | opp ×2 | APThreshold + IncreasedMana | ❌ | opp Caster 마나 가속 |
| `Augment_NoScoutNoPivot` | player ×22 | ADScale/APScale/HPScale per stack | ✅ | 매 라운드 stack 적용 (정상) |
| `Augment_IvernMinionCarry` | opp ×7 | carry augment | ✅ | |
| `Augment_JaxCarry` | opp ×1 | carry augment | ✅ | |

**경제계 augment** (경제 라운드 골드만 영향, 시뮬 무관 정상): SavingsAccount, MoneyMonsoon, HomeCooking, TreasureHunt, EarlyLearning — sim 무시 OK.

→ **player 팀 핵심 buff augment 2개 (BoonOfStars, GiantAndMighty) 가 미구현** — stage 4+ 에서 player 데미지 + 생존력 모두 sim 과소평가의 직접 원인.

### 4. 미구현 artifacts / anomaly items

| Item | 보유 unit | 효과 | 시뮬 |
|------|----------|------|------|
| `Item_Artifact_EvelynnArtifact` | player Talon (6-2) | TFT17 신규 artifact | ❌ |
| `Item_Artifact_AegisOfDusk` | opp Galio (6-2) | TFT 일반 artifact | ❌ |
| `Item_Artifact_SeekersArmguard` | (사용처 확인 필요) | TFT 일반 artifact | ❌ |
| `Item_TearOfTheGoddess` | opp Lissandra (2-1) | 마나 시작 boost | ❌ |
| `EkkoOffering_AnomalyItem` | opp Galio (6-2) | 에코 anomaly | ⚠ 1 hit |
| `Item_FlexTraitEmblemItem` | opp Rammus (6-2) | 가변 emblem | ✅ |

→ Player Talon 의 **`EvelynnArtifact` 단독 누락**으로 Talon 데미지 -83% 의 일부 설명 가능. Talon 6-2 라운드 carry 슬롯이 이 artifact.

### 5. Survivor 예측 정확도 (alive mismatch)

| 챔프 | rounds | aliveMismatch | 비율 |
|------|--------|---------------|------|
| Jax | 19 | 11 | **58%** |
| Talon | 20 | 10 | **50%** |
| Caitlyn | 12 | 7 | 58% |
| TwistedFate | 15 | 9 | 60% |
| Corki | 8 | 6 | 75% |

→ **모든 carry 가 50% 이상 alive 예측 실패**. sim 의 전투 종료 조건 또는 데미지 교환이 부정확. augment 누락 + artifact 누락이 누적된 결과.

## Attribution 우선순위 (다음 PR 후보)

### 🔥 Tier 1 — 즉시 큰 임팩트 예상

1. **`VarusGodAugment_BoonOfStars` 구현**
   - player 팀이 stage 4+ 7개 라운드에서 보유. stage 5+ 5/5 mismatch 의 가장 가능성 높은 cause.
   - effects: Health + PercentIncrease (정확한 수치는 augment JSON 확인)
   - 예상 임팩트: winnerMatchRate +20-30%pt 가능

2. **`Augment_GiantAndMighty` 구현**
   - player ×11 라운드. tank 강화 augment.
   - effects: FlatHealth + PercentHealth + (hash key)
   - 예상 임팩트: Jax/Aatrox 생존율 개선, alive mismatch 축소

3. **`Item_Artifact_EvelynnArtifact` 구현**
   - player Talon 6-2 carry slot. Talon -83% 의 일부.
   - 예상 임팩트: Talon 6-2 round dmg 정확도 개선

### 🟡 Tier 2 — 중간 임팩트

4. **TwistedFate +40% 과대평가 진단**
   - mana gain (Caster role +2/sec) 가속 의심
   - 별돌보미 Mountain (count=5) → AP +15 적용 시 double-counting 의심
   - 진단 후 수정 (몇 시간 작업)

5. **Anomaly items 시뮬 인식 확장**
   - `EkkoOffering_AnomalyItem`, `EvelynnArtifact` 등 set 17 신규 artifact 시리즈
   - artifact data JSON 에서 effects 를 읽어 일괄 처리 인프라 필요

### 🟢 Tier 3 — 작은 임팩트

6. **`Item_TearOfTheGoddess`** (마나 시작) — 대부분 component 라 제한적
7. **`SeraphimsStaff`** opponent 측만 ×2 — 데이터 부족

## 권장 next PR — Tier 1 #1 (BoonOfStars)

이유:
- 7 라운드에 직접 영향 (가장 빈도 높음)
- effects 가 비교적 단순 (Health + PercentIncrease) — 1-2시간 작업
- 후속 augment 구현의 패턴 정립 (후속 GiantAndMighty 도 비슷)
- 측정 트리거: PR 후 diff cache 재실행 → winnerMatchRate +pt 기대

## Out of scope (이번 분석에서 다루지 않음)

- 모바일 보드 매핑 회귀 가드
- 인덱싱 / 데이터 무결성
- pvp 외 라운드 (shrine 등)

## 재실행 / 재현

```bash
pnpm vitest run tests/calibration/compute-diff-cache.test.ts
# → actual-data/diff-game-20260423-001.json 갱신
# → 본 문서의 메트릭 재측정 가능
```

---

**작성일**: 2026-05-06
**baseline engineSha**: `3d94dceabd23dae8090b10550433656be75e9b34` (PR #89 amend 전 시점)
**다음 baseline**: 위 작업 (Tier 1) 머지 후 재측정

---

## 2026-05-06 후속 진행 — Tier 1 결과 + 추가 발견

### Tier 1 #1 (BoonOfStars) — PR #91 머지 완료 ✅

| 메트릭 | Before | After | Δ |
|--------|--------|-------|---|
| winnerMatchRate | 45.5% | **50.0%** | **+4.5pt** ✅ trigger 도달 |
| avgPlayerDamageErrorPct | -52.2% | -49.7% | +2.5pt 개선 |
| avgSurvivorHpErrorPts | 5.77 | 8.47 | over-correction (후속 진단) |

### Tier 1 #2 (GiantAndMighty) — 이미 동작 중 ✅

`augment.ts` 의 generic key handler (`FlatHealth` line 284, `PercentHealth` line 470) 가
GiantAndMighty 의 effects 를 자동 매칭. apiName-specific 분기 없이 동작.

**원인**: PR #90 분석 시 `apiName` 만 grep 해서 false negative — 실제로는 effect-key 매칭으로
sim 자동 적용. **본 PR**은 회귀 가드만 추가.

### Tier 1 #3 (EvelynnArtifact) — 별도 PR 필요

- **Basic stats** (AD/AP/AS) 는 generic 매칭으로 일부 적용 가능성
- **Unique mechanics** (target switch teleport / 12% execute / kill DecayingAS) 는 별도 구현 필요
- **다른 artifacts** (AegisOfDusk, SeekersArmguard) 도 비슷 — 일괄 인프라 PR 권장

### 회귀: 분석 시 false negative 회피 가이드

augment/item 미구현 진단 시 다음 두 단계로 확인:
1. `apiName` grep — 명시 분기 존재 여부
2. `effects` key 들 grep — generic handler 매칭 여부 (FlatHealth/PercentHealth/AD/AP/HP/etc.)

둘 다 0 hits 일 때만 진짜 미구현. 본 분석은 #1 만 했으나 augment.ts 의 generic 처리로 일부
auto-implemented 였음.

### 다음 작업 후보 (재정리)

1. **EvelynnArtifact 등 set 17 artifacts 일괄 처리 인프라** — Talon 6-2 carry 등 직접 영향
2. **TwistedFate +40% 과대평가 진단** — mana / Mountain count 의심
3. **SeraphimsStaff + ArchangelsStaff 상호작용** — opponent ×2 보유, 90% AP threshold 마나 추가
