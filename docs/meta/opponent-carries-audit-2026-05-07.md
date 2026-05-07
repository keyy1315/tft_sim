# Opponent Carries ★ Audit — 2026-05-07

> game-20260423-001 baseline의 4x sim duration mismatch 해소 작업 진단 보고서.
> 후속 patch attribution: `docs/meta/diff-attribution-2026-05-06-followup.md`

## Summary

| 챔프 | game-1 ★/R | Gap 카테고리 | Severity | 본 PR fix? | 후속 P |
|------|:---:|----|:---:|:---:|:---:|
| Lissandra | ★1/2/3, 14R | A,D | 🟢 | - | P2 |
| Veigar | ★2, 4R | A,E | 🟡 | - | P3 |
| Mordekaiser | ★2, 4R | C (proc trigger) | 🔴 | - | **P1** |
| Poppy | ★1/2/3, 10R | B + A (ally Resists) | 🔴 | ✅ | - |
| Illaoi | ★1, 3R | A (NumEnemies) | 🟡 | - | P3 |

## Methodology

각 챔프에 대해 3개 소스를 교차 비교:
1. Raw data (`public/data/tft_set17_champions.json` → `ability.variables`)
2. Sim config (`src/lib/simulator/systems/ability.ts` `ABILITY_DEFS[TFT17_X]`)
3. Sim execution (`combatLoop.ts` 핸들러)

★별 변수 값은 `readVarByStar` (line 171) 의 sentinel filler 컨벤션 적용.

Gap 카테고리:
- **A**: 변수 미소비 (raw 변수 존재 but sim 무시)
- **B**: 변수 잘못 사용 (sim 하드코딩 또는 다른 변수 fallback)
- **C**: Mechanic mismatch (proc vs DOT 등 메커니즘 자체 오류)
- **D**: ★ scaling 불일치
- **E**: 시너지 interaction 누락 (Astronaut 등)

## Per-champion findings

### TFT17_Lissandra (1코, ★1/2/3, 14R) — 🟢 P2

**Raw data variables** (★1/2/3, sentinel filler resolved):
| Var | ★1 | ★2 | ★3 | Sim usage |
|-----|:---:|:---:|:---:|:---:|
| Damage | 200 | 250 | 375 | ✅ damageVar (default) |
| SecondaryDamage | 50 | 75 | 115 | ✅ secondaryDamageVar (filler raw[0]=100) |

**Real mechanic** (raw `desc` 해석):
대상에게 단검을 던져 첫 적중 시 Damage 마법, 첫 적중 또는 사거리 끝에서 폭발하며 주변 SecondaryDamage 마법.

**Sim config** (`ability.ts:195`):
- `pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'SecondaryDamage'`

**Verdict**: 🟢 변수 모두 consumed. ★3 scaling raw values (Damage=375, SecondaryDamage=115) 정확성 정밀 검증은 후속 P2.

**후속 PR 우선순위**: P2 (★3 정밀 검증)

---

### TFT17_Veigar (1코, ★2, 4R) — 🟡 P3

**Raw data variables** (★1/2/3):
| Var | ★1 | ★2 | ★3 | Sim usage |
|-----|:---:|:---:|:---:|:---:|
| Damage | 250 | 310 | 465 | ✅ damageVar (default) |
| MiniDamage | 31 | 47 | 70 | ✅ secondaryDamageVar (filler raw[0]=40) |
| MiniMeepsPerAstro | 2 | 2 | 2 | ❌ 미구현 |

**Real mechanic** (raw `desc` 해석):
대상에게 정령유성 (Damage 마법) + 미니유성 N개 (MiniDamage 마법). Astronaut 시너지 활성 시 미니유성 갯수 추가 (`MiniMeepsPerAstro × Astronaut active 카운트`).

**Sim config** (`ability.ts:185`):
- `pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'MiniDamage'`

**Verdict**: 🟡 Astronaut interaction 미구현. Astronaut 활성 시 미니유성 갯수 변화 누락.

**후속 PR 우선순위**: P3 (Astronaut 시너지 통합 시점에 함께)

---

### TFT17_Mordekaiser (2코, ★2, 4R) — 🔴 **P1**

**Raw data variables** (★1/2/3, sentinel filler):
| Var | ★1 | ★2 | ★3 | Sim usage |
|-----|:---:|:---:|:---:|:---:|
| InitialShield | 300 | 375 | 500 | ❌ 미구현 (sim heal:true 만 존재) |
| ShieldPerProc | 75 | 90 | 105 | ❌ 미구현 |
| DamagePerProc | 45 | 70 | 100 | ❌ 미구현 (sim DOT 으로 근사) |
| HealRefund | 0.4 | 0.4 | 0.4 | ❌ 미구현 |
| Duration | 4 | 4 | 4 | ✅ dot.duration |

**Real mechanic** (raw `desc` 해석):
InitialShield 보호막 + Duration초 동안 평타당 N회 proc → DamagePerProc 광역 마법 + ShieldPerProc 보호막 보충 + HealRefund 비율 회복.

**Sim config** (`ability.ts:210`):
- `pattern: 'aoe_circle', radius: 1, heal: true, dot: { duration: 4 }`

**Verdict**: 🔴 **proc trigger 시스템을 DOT으로 잘못 근사**. 실제는 평타당 (1~2회/s) 발동, sim은 매 tick 1회 (DOT total / duration). 시간당 발동 수 mismatch → damage shortfall이 sim duration 4x 빠름의 dominant 원인 후보.

**후속 PR 우선순위**: **P1** (DOT → on-attack proc 변환)

---

### TFT17_Poppy (1코, ★1/2/3, 10R) — 🔴 **이번 PR fix**

**Raw data variables** (★1/2/3, sentinel filler):
| Var | ★1 | ★2 | ★3 | Sim usage |
|-----|:---:|:---:|:---:|:---:|
| Shield | 300 | 400 | 475 | ❌ 미구현 → ✅ **이번 PR** |
| ShieldDuration | 4 | 4 | 4 | ❌ 하드코딩 (4) → ✅ **이번 PR** |
| Resists | 15 | 25 | 60 | ❌ 미구현 (filler raw[0]=36) → ✅ **이번 PR** |
| MeepShield | 100 | 125 | 160 | ❌ 미구현 (Astronaut, scope OUT) |
| MeepsPerAstro | 1 | 1 | 1 | ❌ 미구현 (Astronaut, scope OUT) |

**Real mechanic** (raw `desc` 해석):
ShieldDuration초 동안 Shield 보호막 (AP scaling) + 2칸 내 아군 방어력+마법저항 +Resists (AP scaling).

**Sim config (현재)** (`ability.ts:184`):
- `pattern: 'self_buff', selfBuff: { durability: 0.2, duration: 4 }` (durability 0.2 하드코딩 → Shield 변수 무시 + ally Resists 완전 미구현)

**Sim config (이 PR fix 후)**:
- `pattern: 'self_buff'` + combatLoop `applyPoppyShieldAndResists` 헬퍼 (Shield/ShieldDuration/Resists 변수 + AP scaling + 2칸 radius)

**Verdict**: 🔴 본 PR에서 fix. MeepShield/MeepsPerAstro Astronaut interaction 은 scope OUT.

**후속 PR 우선순위**: N/A (본 PR fix)

---

### TFT17_Illaoi (3코, ★1, 3R) — 🟡 P3

**Raw data variables** (★1/2/3):
| Var | ★1 | ★2 | ★3 | Sim usage |
|-----|:---:|:---:|:---:|:---:|
| Shield | 250 | 450 | 525 | ❌ 미구현 (sim heal:true 만) |
| Duration | 3 | 3 | 3 | ✅ dot.duration |
| HealthDrain | 40 | 55 | 85 | ⚠️ heal:true 로 단일 흡수 (NumEnemies 미반영) |
| NumEnemies | 3 | 3 | 3 | ❌ 미구현 |
| Damage | 80 | 80 | 120 | ❌ 미구현 (마지막 hit) |

**Real mechanic** (raw `desc` 해석):
Shield 보호막 + Duration초 동안 가장 가까운 NumEnemies 명에게서 HealthDrain 비율 흡수 + 종료 시 2칸 AOE Damage hit.

**Sim config** (`ability.ts:215`):
- `pattern: 'aoe_circle', radius: 2, heal: true, dot: { duration: 3 }`

**Verdict**: 🟡 NumEnemies 다중 흡수 미반영 (실제는 N명에서 흡수, sim은 단일). 종료 시 Damage hit 누락.

**후속 PR 우선순위**: P3 (다중 타겟팅 핸들러 신규)

## 후속 PR 우선순위

1. **P1** (Critical): Mordekaiser proc 시스템 (DOT → on-attack proc) — 4R × ★2 영향, sim duration 4x 빠름의 dominant 원인 후보
2. **P2** (Moderate): Lissandra ★3 raw values 정밀 검증 — 14R × 다양 ★
3. **P3** (Low): Veigar Astronaut MeepsPerAstro + Illaoi NumEnemies 다중 흡수 + Bard abduct + IvernMinion synergy

## Verification (this PR)

- `pnpm lint && pnpm typecheck && pnpm build` pass
- `tests/unit/poppy-shield-resists.test.ts` 6 케이스 통과
- 사용자 수동: `pnpm tsx scripts/compute-diff-cache.ts` 후 `actual-data/diff-game-20260423-001.json` winnerMatchRate 변화 측정
