# Plan: TFT 17.3 Stargazer Fountain helper 활성화 (PR 3 / 3)

## Executive Summary

| 관점 | 설명 |
|------|------|
| Problem | 17.3 LIVE 에서 별돌보미 우물(Fountain) 변종 효과 재활성화. PR #107 codex P1 fix 에서 데이터를 hash 로 되돌려 sim no-op 유지. PR 3 에서 데이터 + 핸들러 동시 활성 |
| Solution | Latest 5/9 의 정식 이름 Fountain 변수 다시 적용 + 기존 `applyStargazerEffects` legacy 분기 (line 3312~3326) 의도화 (17.3 LIVE active) |
| Function UX Effect | well 별자리 게임에서 강화 칸 아군 마나 재생 (1.0/s) + 강화 칸 별돌보미 추가 마나 재생 (3.0~5.0/s) + ability 시전 시 가장 낮은 체력 아군 회복 (18~25%) |
| Core Value | 별돌보미 우물 활용 게임 sim 정확도 회복 — 메모리 `stargazer_fountain_inactive.md` 차단 해제 |

---

## 1. 17.3 LIVE 메커니즘 (Latest 5/9 데이터 + lolchess.gg)

> "별돌보미 우물 강화된 칸 효과 완전 재설계"

### 정식 이름 변수 (Latest 5/9 노출)

#### TFT17_Stargazer_Fountain (변종)
| Tier | minUnits | Fountain_HealPercent | Fountain_ManaRegen | Fountain_ManaRegen_Teamwide |
|------|:-:|:-:|:-:|:-:|
| 0 | 3-4 | **0.18** (18%) | **1.0** | **1.0** |
| 1 | 5+ | **0.25** (25%) | **5.0** | **1.0** |

#### TFT17_Stargazer (전체 trait — 모든 변종 공통)
| Tier | minUnits | Fountain_HealPercent | Fountain_ManaRegen | Fountain_ManaRegen_Teamwide |
|------|:-:|:-:|:-:|:-:|
| 0 | 3-4 | 0.18 | **3.0** | 1.0 |
| 1 | 5-6 | 0.25 | **4.0** | 1.0 |
| 2 | 7+ | 0.20 | **5.0** | 1.0 |
| 3 | 8+ | - | - | 1.0 |
| 4 | 9+ | - | - | 1.0 |
| 5 | 10+ | - | - | 1.0 |

### 메커니즘 (desc 기반)
- **강화된 칸 아군**: 마나 재생 `Fountain_ManaRegen_Teamwide` 추가 (1.0/s)
- **강화된 칸 별돌보미**: 추가 마나 재생 `Fountain_ManaRegen` (3.0~5.0/s) + ability 시전 시 체력 가장 낮은 아군 `Fountain_HealPercent` 회복 (18~25%)

### lolchess.gg 명시 추가 효과 (PR 3 외)
- "(3) 공격력/주문력 4%, (5) 공격력/주문력 7%" — Latest 데이터에 노출 안 됨, 별도 변수 미발견 → **PR 3 외 보류**

---

## 2. 기존 핸들러 분석

`applyStargazerEffects` (combatLoop.ts:3312~3326) 에 이미 **legacy 분기**가 있음:

```ts
if (apiName === 'TFT17_Stargazer_Fountain') {
  const legacyHealPct = (eff.Fountain_HealPercent ?? 0) as number;
  const legacyTeamwideMana = (eff.Fountain_ManaRegen_Teamwide ?? 0) as number;
  const legacyOwnerMana = (eff.Fountain_ManaRegen ?? 0) as number;
  if (legacyHealPct > 0 || legacyTeamwideMana > 0 || legacyOwnerMana > 0) {
    for (const u of units) {
      if (!isOnTile(u)) continue;
      if (legacyTeamwideMana > 0) u.augmentManaRegen += legacyTeamwideMana;
      if (isStargazerUnit(u)) {
        if (legacyOwnerMana > 0) u.augmentManaRegen += legacyOwnerMana;
        if (legacyHealPct > 0) u.stargazerFountainHealPercent = legacyHealPct;
      }
    }
    return;
  }
  // 17.2 LIVE — Riot 비활성화 상태. 시뮬도 no-op.
  return;
}
```

→ **데이터를 정식 이름으로 적용하면 자동 활성화**. 핸들러 변경 불필요. 단지 주석/문서를 17.3 LIVE active 로 정비.

### 호출 site 검증
- `triggerFountainHeal` (line 610~) — caster 가 stargazerFountainHealPercent > 0 이고 ability 시전 시 즉발 dmg > 0 일 때 가장 낮은 체력 아군 회복

→ ability cast → totalAbilityDmg 계산 → triggerFountainHeal 호출 → stargazerFountainHealPercent 활용 → 가장 낮은 체력 아군 회복

---

## 3. 작업 범위

### In Scope
- `traits.json` Fountain 정식 이름 변수 다시 적용 (Latest 5/9 데이터)
- `applyStargazerEffects` 주석 정비 — "17.2 비활성" → "17.3 LIVE active"
- `stargazer-fountain-1703-data-only.test.ts` → `stargazer-fountain-1703-active.test.ts` 재변경
  - 기존 가드: 매초 효과 0 (PR 3 까지 비활성) → 변경: stargazerFountainHealPercent / augmentManaRegen 활성 검증
- 메모리 `stargazer_fountain_inactive.md` → 17.3 active 로 갱신 (또는 `stargazer_fountain_active.md` 신규)

### Out of Scope
- AD/AP 4%/7% 효과 (lolchess.gg 명시) — Latest 데이터에 노출 안 됨, 별도 변수 미발견
- `fountainHealPctPerTick` / `fountainStackingAdapPerTick` 매초 효과 (commented-out 상태) — 17.3 LIVE 메커니즘과 다른 PBE 17.2 spec, 활성화 보류
- StackingADAP — hash `{13a2a786}` 매핑 추정만 됨, 정식 변수 미노출

---

## 4. 작업 순서

| 단계 | 작업 |
|------|------|
| 1 | Plan 문서 작성 (이 파일) |
| 2 | `traits.json` Stargazer / Stargazer_Fountain 의 effects 를 Latest 5/9 로 override (Fountain 정식 이름 + 기존 PBE 정식 이름 둘 다 보존) |
| 3 | `applyStargazerEffects` 주석 정비 (combatLoop.ts:3294~3342) — "17.2 비활성" → "17.3 LIVE active" |
| 4 | `stargazer-fountain-1703-data-only.test.ts` → `stargazer-fountain-1703-active.test.ts` 재명명 + active 가드로 변경 |
| 5 | 메모리 `stargazer_fountain_inactive.md` 갱신 (17.3 active 표기) |
| 6 | `pnpm lint && pnpm typecheck && pnpm build` 통과 확인 |
| 7 | `pnpm test` 전체 통과 확인 (+golden snapshot 갱신 필요 시) |
| 8 | diff cache 재계산 → winnerMatchRate 변화 측정 |
| 9 | commit 분리 (data + handler 주석 + tests + memory + diff cache) + push + PR 생성 |

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|:-:|:-:|------|
| Fountain heal 활성화로 well 별자리 게임 시뮬 결과 inflate (17.3 LIVE 의도 초과) | 🟡 Med | Med | desc 기반 conservative 해석, lolchess.gg 명시 메커니즘과 일치 검증 |
| triggerFountainHeal 호출 site 의 사망 처리 누락 (heal 시 부활 등) | 🟢 Low | Low | 기존 코드 (line 610~) 그대로 사용, 회귀 가드로 검증 |
| Latest 5/9 데이터가 17.3 LIVE 와 다름 (PBE 시도였다가 폐기 가능성) | 🟡 Med | Low | 메모리 `project_17-3-data-update-status.md` 의 사용자 게임 검증 (5/13 우물 재활성 확인) 결과 신뢰 |
| Fountain heal 이 가장 낮은 체력 아군 회복 로직 — 별돌보미 자신 포함? | 🟡 Med | Med | 기존 triggerFountainHeal 로직 검토 (caster 본인 포함 여부 확인) |
| augmentManaRegen 누적이 다른 augment 와 중복 적용 | 🟢 Low | Low | 기존 +=  패턴 그대로 사용 (충돌 없음) |

---

## 6. 수정 파일 목록

| # | 파일/작업 | 변경 |
|---|----------|------|
| 1 | `docs/01-plan/features/tft-17-3-stargazer-fountain.plan.md` | 본 plan (NEW) |
| 2 | `public/data/tft_set17_traits.json` | Stargazer / Stargazer_Fountain Fountain 정식 이름 변수 추가 |
| 3 | `src/lib/simulator/engine/combatLoop.ts` | applyStargazerEffects 주석 정비 (의도화) |
| 4 | `tests/unit/simulator/stargazer-fountain-1703-data-only.test.ts` | DELETE (rename → active) |
| 5 | `tests/unit/simulator/stargazer-fountain-1703-active.test.ts` | NEW — active 가드 |
| 6 | `~/.claude/projects/.../memory/stargazer_fountain_inactive.md` | 17.3 active 표기 갱신 |
| 7 | `tests/golden/__snapshots__/golden.test.ts.snap` | well 별자리 영향 시나리오 갱신 (필요 시) |
| 8 | `actual-data/diff-game-*.json` | diff cache 재계산 결과 |

---

## 7. 검증

### 7.1 자동 검증
- [ ] `pnpm lint` 통과
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm build` 통과
- [ ] 기존 unit test 모두 통과

### 7.2 신규 회귀 가드 (stargazer-fountain-1703-active.test.ts)
- [ ] (3) 별돌보미 + well 별자리 → 강화 칸 아군 augmentManaRegen += 1.0
- [ ] (3) 별돌보미 + well 별자리 → 강화 칸 별돌보미 augmentManaRegen += 4.0 (1+3) + stargazerFountainHealPercent = 0.18
- [ ] (5) 별돌보미 + well 별자리 → augmentManaRegen += 6.0 (1+5) + stargazerFountainHealPercent = 0.25
- [ ] 우물 외 별자리 (mountain) 시 Fountain 효과 0
- [ ] 비-별돌보미 unit (강화 칸 안 / 다른 trait) → augmentManaRegen 0 만 추가 (Fountain heal 없음)
- [ ] ability 시전 시 가장 낮은 체력 아군 회복 발생 (triggerFountainHeal 통합 검증)

### 7.3 메트릭 영향
- [ ] diff cache 재실행 → winnerMatchRate 측정. 측정 게임에 well 별자리 + 별돌보미 활성 시 변화 발생 예상

---

## 8. PR 분리 (commit 분리)

| commit | 변경 |
|--------|------|
| `feat(data): Stargazer Fountain 정식 이름 변수 다시 적용 (17.3 LIVE active)` | traits.json + plan 문서 |
| `feat(sim): applyStargazerEffects Fountain 분기 17.3 LIVE active 의도화` | combatLoop.ts 주석/문서 정비 |
| `test(sim): Stargazer Fountain active 가드 — data-only → active` | 기존 가드 rename + active 검증 변경 |
| `chore(memory): stargazer_fountain_inactive 17.3 active 갱신` | 메모리 차단 해제 |
| `chore(diff-cache): Fountain 활성화 후 재계산` | diff cache 결과 |

---

## Version History

| Version | Date | 변경 | 작성자 |
|---------|------|------|--------|
| 0.1 | 2026-05-13 | 초안 (PR #108 머지 후 작성) | Claude (Opus 4.7) |
