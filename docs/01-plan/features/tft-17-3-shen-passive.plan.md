# Plan: TFT 17.3 Shen passive 신규 구현 (PR 2 / 3)

## Executive Summary

| 관점 | 설명 |
|------|------|
| Problem | Shen passive (`BonusDamageOnAttack`) 가 sim 에 완전 미구현. 17.3 패치에서 너프됐지만 (45/75→20/30) sim 에 영향 없음. 5코 Shen 카운터픽 정확도 ↓ |
| Solution | passive 신규 핸들러 구현 — cast 당 1 stack + 평타마다 stack×BonusDamage + DamageHP×maxHp + AP scaling 추가. Stack 3+ 시 magic → true 전환 |
| Function UX Effect | Shen 평타 데미지가 cast 횟수에 따라 증가 → 5코 Shen 활용 게임에서 sim opponent damage 정확도 ↑ |
| Core Value | 5코 캐리 챔프의 mechanic accuracy 향상 — opponent ★ Shen 시뮬 결과의 신뢰도 회복 |

---

## 1. 17.3 LIVE 변경 (lolchess.gg 명시)

> "쉔 보호막 흡수 체력 계수 10% → 15%, 기본 공격 피해 40/60 → 20/30 + 최대 체력 1%, 기본 체력 1,200 → 1,300"

| 변수 | 17.2 | 17.3 LIVE | PR #107 적용 | PR 2 적용 |
|------|:-:|:-:|:-:|:-:|
| ShieldHP | 0.10 | **0.15** | ✅ 1차 | - |
| BonusDamageOnAttack ★1 | 45 | **20** | - | ✅ 너프 적용 |
| BonusDamageOnAttack ★2 | 75 | **30** | - | ✅ 너프 적용 |
| DamageHP | 0.01 | 0.01 (유지) | - | ✅ passive 핸들러에서 활용 |
| stats.hp | 1200 | **1300** | ✅ 2차 | - |

→ DamageHP 는 PR #107 plan 에서 "제거" 로 잘못 표기됐으나 lolchess.gg 재확인 결과 유지.

---

## 2. 작업 범위

### In Scope
- ABILITY_DEFS[TFT17_Shen] 에 cast handler 추가 (stack 누적 + BonusDamage 계산)
- 평타 hook 에 Shen passive 분기 추가 (onAttackBonus 패턴 참고)
- CombatUnit type 확장: `shenPassiveStack` (number, default 0), `shenPassiveBonusDmg` (number, default 0)
- BonusDamageOnAttack 변수 너프 적용 (45/75 → 20/30)
- 회귀 가드 작성 (tests/unit/simulator/shen-passive-1703.test.ts)

### Out of Scope
- active (균열 AOE) 메커니즘 변경 (현재 self_buff + AS slow 그대로)
- Shen 보호막 (ShieldAP/ShieldHP) 활성 핸들러 — 별도 Self_buff Pattern 으로 처리됨

---

## 3. 메커니즘 (사용자 결정)

**Cast 당 1 stack + 평타마다 stack × BonusDamage 적용**

```
cast 1번 → shenPassiveStack = 1
  이후 평타: stack(1) × (BonusDamage[★] + DamageHP × maxHp + AP scaling) magic damage 추가

cast 2번 → shenPassiveStack = 2
  이후 평타: stack(2) × (...) magic damage 추가

cast 3번 → shenPassiveStack = 3
  이후 평타: stack(3) × (...) TRUE damage 로 전환

cast N번 (N >= 3) → shenPassiveStack = N
  이후 평타: stack(N) × (...) TRUE damage 추가
```

### 데미지 계산 공식
```
bonusDmg = (BonusDamageOnAttack[★] + DamageHP × maxHp) × (1 + AP / 100)
attackBonus = bonusDmg × shenPassiveStack
```

- ★1 (initial): BonusDamageOnAttack=20, DamageHP=0.01
- ★2: BonusDamageOnAttack=30, DamageHP=0.01

### Damage Type
- Stack < 3: **Magic damage** — magic resist + magicPen + DR + non-target reduction + shield + invulnerable mitigation 적용
- Stack >= 3: **True damage** — invulnerable 만 체크, 다른 mitigation 우회

---

## 4. 작업 순서

| 단계 | 작업 |
|------|------|
| 1 | Plan 문서 작성 (이 파일) |
| 2 | champions.json 부분 Edit — BonusDamageOnAttack 45/75 → 20/30 |
| 3 | CombatUnit type 확장 (`src/types/combat.ts` 또는 동등 위치) |
| 4 | ABILITY_DEFS[TFT17_Shen] cast handler — combatLoop 의 cast emit 위치에 Shen 분기 추가 |
| 5 | 평타 hook — onAttackBonus 분기 (line 5608~5645) 다음에 Shen passive 분기 추가 |
| 6 | 회귀 가드 작성 — shen-passive-1703.test.ts (cast 1/2/3 후 평타 데미지 + magic→true 전환) |
| 7 | patch-17-3-direct-numbers.test.ts 에 BonusDamageOnAttack 너프 가드 추가 |
| 8 | `pnpm lint && pnpm typecheck && pnpm build` 통과 확인 |
| 9 | `pnpm test` 전체 통과 확인 (+golden snapshot 갱신 필요 시) |
| 10 | diff cache 재계산 → winnerMatchRate 변화 측정 |
| 11 | commit (3 분리: data + sim handler + tests) + push + PR 생성 |

---

## 5. 수정 파일 목록

| # | 파일/작업 | 변경 |
|---|----------|------|
| 1 | `docs/01-plan/features/tft-17-3-shen-passive.plan.md` | 본 plan (NEW) |
| 2 | `public/data/tft_set17_champions.json` | Shen BonusDamageOnAttack 너프 |
| 3 | `src/types/combat.ts` (or types) | CombatUnit shenPassive 필드 추가 |
| 4 | `src/lib/simulator/engine/combatLoop.ts` | Shen ability cast handler + 평타 hook 분기 |
| 5 | `tests/unit/simulator/shen-passive-1703.test.ts` | 회귀 가드 (NEW) |
| 6 | `tests/unit/data/patch-17-3-direct-numbers.test.ts` | BonusDamageOnAttack 너프 가드 추가 |
| 7 | `tests/golden/__snapshots__/golden.test.ts.snap` | Shen 영향 시나리오 갱신 (필요 시) |
| 8 | `actual-data/diff-game-*.json` | diff cache 재계산 결과 |

---

## 6. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|:-:|:-:|------|
| Shen passive 메커니즘 해석 오류 (stack/cast 의미) | 🔴 High | Med | 사용자 확정한 단순 해석 채택 (cast 당 1 stack, 평타마다 stack×bonus) — 실제 게임 검증으로 추후 정정 |
| 평타 hook 추가가 다른 챔프 (꼬마정령/잭스 carry) 와 충돌 | 🟡 Med | Low | 별도 분기 (`if (unit.shenPassiveStack > 0)`) 로 격리, 기존 코드 변경 없음 |
| stack 3+ true damage 가 invulnerable 등 mitigation 우회 → 회귀 (Mordekaiser/Illaoi 류 invul 챔프) | 🟡 Med | Low | true damage 처리 표준 mitigation 사용, golden snapshot 으로 회귀 확인 |
| AP scaling 적용 위치 (stack 곱 전 or 후) | 🟢 Low | Med | `(BonusDamage + DamageHP×maxHp) × (1 + AP/100) × stack` 으로 통일 |
| Cast 시점에 BonusDamage 계산 vs 평타 시점에 계산 | 🟢 Low | Med | **평타 시점 계산** (AP/maxHp 변동 반영) — 단 stack 은 cast 누적 |

---

## 7. 검증 (Definition of Done)

### 7.1 자동 검증
- [ ] `pnpm lint` 통과 (0 error)
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm build` 통과
- [ ] 기존 unit test 모두 통과 (특히 hero-carry-augments / onAttackBonus 회귀 가드)

### 7.2 신규 회귀 가드 (shen-passive-1703.test.ts)
- [ ] Shen cast 0회 (passive 미발동) → 평타 = base AD 만
- [ ] Shen cast 1회 후 평타 → BonusDamage(★별) magic 추가
- [ ] Shen cast 2회 후 평타 → 2× BonusDamage magic 추가
- [ ] Shen cast 3회 후 평타 → 3× BonusDamage **true damage** 전환
- [ ] AP scaling 검증 (AP=100 시 1.5×)
- [ ] DamageHP×maxHp 검증 (maxHp=2000 시 +20 포함)

### 7.3 메트릭 영향 측정
- [ ] diff cache 재실행 → game-2026042{3,4} winnerMatchRate 측정
- [ ] PR #107 baseline (game-20260424=61.9%) 대비 변화 모니터링

---

## 8. PR 분리 (commit 분리)

| commit | 변경 |
|--------|------|
| `feat(data): Shen BonusDamageOnAttack 너프 (45/75→20/30) — 17.3 LIVE` | champions.json 부분 Edit + 데이터 가드 |
| `feat(sim): Shen passive 신규 구현 — cast stack 평타 hook (3+ true)` | type 확장 + ability handler + 평타 분기 |
| `test(sim): Shen passive 회귀 가드 + golden snapshot 갱신` | 신규 가드 + snapshot |
| `chore(diff-cache): Shen passive 적용 후 재계산` | diff cache 결과 |

---

## Version History

| Version | Date | 변경 | 작성자 |
|---------|------|------|--------|
| 0.1 | 2026-05-13 | 초안 (PR #107 머지 후 작성) | Claude (Opus 4.7) |
