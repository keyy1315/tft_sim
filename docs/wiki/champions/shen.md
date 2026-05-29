---
id: shen
type: champion
display_name_kr: 쉔
api_name: TFT17_Shen
cost: 5
traits:
  - 보루
  - 요새
role: Fighter   # raw "APFighter" → mapGameRole() → sim Fighter (codex P2 PR #148 정정)
raw_role: APFighter
current_patch_status: active (17.3 LIVE, 17.4 patch pending — sim 미반영, [[patch-17-4]] 참조)
sim_active: active
last_verified: 2026-05-29 (17.4 patch fact 추가, sim 미반영 명시; 이전: 2026-05-19 codex P2 amend)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Shen entry)"
  - "src/lib/simulator/systems/ability.ts:250 (abilityOverride aoe_circle r=2 + selfBuff AS+0.3 999)"
  - "src/lib/simulator/engine/combatLoop.ts:1508-1525 (applyShenArtifactShield — TFT17_ShenUniqueTrait 보루)"
  - "src/lib/simulator/engine/combatLoop.ts:5710-5748 (passive — 평타 시 stack × BonusDamage 추가)"
  - "src/lib/simulator/engine/combatLoop.ts:6167-6169 (cast 시 shenPassiveStack++)"
  - "docs/01-plan/features/tft-17-3-shen-passive.plan.md (Plan 문서)"
  - "공식 17.3 패치노트 (lolchess.gg)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[patch-17-3]]"
  - "[[patch-17-4]]"
---

# 쉔 (Shen)

## 요약

5코스트 **Fighter** (raw `APFighter` → `mapGameRole()` → sim Fighter, [[role-passive]]), 보루(`TFT17_ShenUniqueTrait`) + 요새 시너지. AS+ 자가 버프 + 균열 AOE active + **누적 passive** (cast 마다 stack +1, 평타 시 stack × BonusDamage 추가, stack 3+ true damage 전환). 17.3 LIVE 에서 passive 너프 (BonusDamage `45/75 → 20/30`) + maxHp buff (`1200 → 1300`) + ShieldHP `0.10 → 0.15`.

> ⚠️ Role 주의: 한글 명세나 traits (요새 — Bastion) 때문에 Tank 처럼 보이지만 raw role 은 `APFighter` 라 sim 에서 **Fighter** 룰 적용 — 마나 (공격당 10, on-hit 0) / 타게팅 weight (2, Tank 3 보다 낮음) / non-target damage reduction ×0.85 모두 Fighter 룰. 보루 trait 활성 시 stats 보강이라 외형상 Tank-like 이지만 sim role 은 Fighter.

## 메커니즘

### Stats (raw, 17.3 LIVE)

| Stat | 값 |
|------|---|
| hp | **1300** (17.3 buff, 이전 1200) |
| armor / magicResist | 65 / 65 |
| damage | 50 |
| attackSpeed | 0.9 |
| range | 1 (melee) |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 10 / 70 |

### Active — cast (aoe_circle r=2)

- abilityOverride (`ability.ts:250`): `{ pattern: 'aoe_circle', radius: 2, selfBuff: { attackSpeed: 0.3, duration: 999 } }`
- **셀프 AS +30%** (영구 누적 — duration: 999 sim 미만료) — 매 cast 마다 multiplicative `unit.stats.attackSpeed *= 1.30`
- **반경 2칸 적 AOE damage** — `ShieldAP × (1+AP/100)` magic
- **ASSlow 0.5** debuff — 적군 AS 절반 감소 (duration 3 ms?)
- raw ability variables (sentinel filler 형식, `readVarByStar` 처리):
  - `BonusDamageOnAttack`: `[50, 20, 30, ...]` → ★1=**20**, ★2=**30** (17.3 nerf, 이전 45/75)
  - `ShieldHP`: `[0.15, 0.15, 0.15, ...]` (17.3 buff, 이전 0.10) — shield = maxHp × 0.15 + AP × ShieldAP
  - `ShieldAP`: `[0, 200, 250, ...]` → ★1=200, ★2=250
  - `ShieldDuration`: `[3, 3, 3, ...]` (초)
  - `ASSlow`: `[0.5, 0.5, ...]` — 적군 AS -50% debuff
  - `BonusAS`: `[0.8, 0.8, ...]` — 자가 AS +80% (selfBuff.attackSpeed 0.3 와 별개?)
  - `DamageHP`: `[0.01, 0.01, ...]` (1% maxHp) — passive scaling
  - `BuffDebuffDuration`: `[3, 3, 3, ...]`

### Passive — `shenPassiveStack` (cast 누적)

**cast 1번 = stack +1** (`combatLoop.ts:6167-6169`):
```
if (unit.champion.apiName === 'TFT17_Shen') unit.shenPassiveStack++;
```

**평타 시 추가 damage** (`combatLoop.ts:5710-5748`):
- 평타 대상에 stack × (BonusDamageOnAttack[★] + DamageHP × maxHp) × (1 + AP/100) 추가
- **stack < 3**: magic damage
- **stack >= 3**: **true damage** 전환 (`isTrueDmg = unit.shenPassiveStack >= 3`)
- 표준 mitigation pipeline 통과 (`applyAbilityMitigation` — true damage 도 shield 흡수 + DR + non-target + invul 일관, codex P1 PR #108)

### Trait — 보루 (TFT17_ShenUniqueTrait)

`applyShenArtifactShield` (`combatLoop.ts:1508-1525`) — 유물(`TFT17_ShenProp`) 인접 아군 단 1명 (unique=1)에게 보호막 + 공격 속도 부여.

## 패치 히스토리

| 패치 | 변경 | sim 적용 |
|------|------|---------|
| 17.2 LIVE | base — hp 1200, BonusDamageOnAttack 45/75, ShieldHP 0.10 | — (legacy) |
| [[patch-17-3]] (2026-05-13) | **3건 변경 동시 적용**: hp `1200 → 1300` (PR #107 1차), ShieldHP `0.10 → 0.15` (PR #107 1차), **BonusDamageOnAttack `45/75 → 20/30`** (PR2 passive 구현 + 너프 동시 — Plan 문서 `tft-17-3-shen-passive.plan.md`) | ✅ 모두 sim 적용 |
| [[patch-17-4]] (2026-05-27) | **2건 변경 (17.3 너프 partial revert)**: 마나 `10/70` → **`20/70`** (initialMana 2배 ↑ — **더 빠른 첫 cast** — 첫 cast 에 필요한 추가 mana 60→50 감소). **BonusDamageOnAttack `20/30` → `25/40`** (17.3 너프 부분 revert, 약간 buff) | ❌ **sim 미반영** — raw data + sim 코드 17.3 기준. [[patch-17-4]] sequence B/C 대기 |

⚠️ **17.4 sim 영향 평가**:
- 마나 변경 (10/70 → 20/70) — `initialMana 10→20` 증가로 첫 cast 에 필요한 추가 mana `maxMana - initialMana = 70-10=60` → `70-20=50` (10 감소). **더 빠른 첫 cast** (buff 방향). `combatLoop.ts:5710-5748` shenPassiveStack 분기 (첫 cast 타이밍 영향). sim 미반영 시 cast 속도 부정확 (raw json `initialMana` 갱신 필요)
- BonusDamageOnAttack `20/30 → 25/40` — `combatLoop.ts:5710-5748` 평타 시 stack × BonusDamage 분기에서 raw vars 직접 read. raw json `BonusDamageOnAttack[★]` 갱신 만으로 sim 자동 반영 (helper 분기 정합)

## sim 적용 상태 — `active`

✅ **활성**:
- stats 17.3 정합 (hp 1300, BonusDamageOnAttack 20/30, ShieldHP 0.15, mana 10/70, AS 0.9, range 1)
- active aoe_circle r=2 + selfBuff AS +0.3 (cast 마다 multiplicative 누적)
- raw ability variables (ShieldHP / ShieldAP / ShieldDuration / ASSlow / BonusAS / BuffDebuffDuration) sentinel filler 처리 (`readVarByStar`)
- **passive cast stack ++** (line 6167-6169) + 평타 시 stack × BonusDamage 추가 (line 5710-5748)
- stack 3+ true damage 전환
- mitigation pipeline 표준 통과 (codex P1 PR #108)
- 보루 시너지 (`applyShenArtifactShield`) — 인접 아군 1명 unique shield + AS

🔍 **검증 필요**:
- selfBuff.attackSpeed `0.3` + raw `BonusAS 0.8` 의 관계 — duplicate? 또는 selfBuff = AOE caster, BonusAS = trait/aura? Plan 문서 / 인게임 측정으로 확정 필요
- `ASSlow 0.5` (적군 AS -50%) sim 적용 위치 — `config.debuff` 분기 또는 별도 적용 점검
- `DamageHP 0.01` (1% maxHp) passive scaling 정확 적용 (`maxHp × 0.01` 추가)
- shield duration (3초) 만료 처리 정합 — `applyShieldOnSelf` helper 검증

## Lint 체크리스트

- [x] entity-wide grep `Shen` — multi-source 확인 (보루 trait helper / passive stack hook / 평타 hook 모두 정합)
- [x] raw stats 17.3 정합 (`public/data/tft_set17_champions.json` 확인)
- [x] **raw role `APFighter` → mapGameRole → sim Fighter** (codex P2 PR #148 정정)
- [x] passive cast counter `shenPassiveStack` 정합 (cast 시 ++ + 평타 시 read)
- [ ] selfBuff.attackSpeed vs BonusAS 관계 확정
- [ ] ASSlow debuff 적용 위치 verify
- [ ] DamageHP 1% maxHp passive scaling 정합 검증

## 관련

- [[role-passive]] — **Fighter** role 마나/타게팅 규칙 (raw APFighter → sim Fighter, 공격당 10 / on-hit 0 / weight 2 / non-target DR ×0.85 — frontmatter `role: Fighter` 정합, PR #162 subagent P2-1 정정)
- [[ability-targeting]] — `aoe_circle` 패턴
- [[patch-17-3]] — 3건 동시 변경 (hp / ShieldHP / BonusDamageOnAttack)
- 코드: `src/lib/simulator/systems/ability.ts:250`, `src/lib/simulator/engine/combatLoop.ts:1508/5710/6167`
- Plan: `docs/01-plan/features/tft-17-3-shen-passive.plan.md` (PR2 passive 구현 + 17.3 너프 동시 적용)
