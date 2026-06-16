---
id: leblanc
type: champion
display_name_kr: 르블랑
api_name: TFT17_Leblanc
cost: 4
traits:
  - 중재자
  - 길잡이
role: Marksman   # raw "APCarry" → mapGameRole() → sim Marksman (types/index.ts includes('Carry')). carry augment 없음
raw_role: APCarry
current_patch_status: active (17.4 변경 없음 — 17.5 patch pending: Sigil/Bolt Damage 80/120→85/130 (buff, BoltDamage ★1/★2 추정 — 패치노트 'Sigil' 표기). 데이터/sim 미반영, [[patch-17-5]] 참조)
last_verified: 2026-06-16
sim_active: partial   # ability 「현실 분열」 passive 평타 → BasicAttackDamage(scaleAP) 마법 + 사용 시 분신 NumClones(5) 소환해 NumAttacks(5)회 CloneDamageMultiplier% 공격 + 마지막 투사체 BoltDamage(scaleAP) 마법. sim multi maxTargets:3 + damageVar 'BoltDamage' + hitCount 5 → BoltDamage × 5 (3타겟 분배). filler → BoltDamage ★1=80/★2=120/★3=750. 중재자(ADMIN=Arbiter law 시스템 :112)/길잡이(SummonTrait 소환물 materialize) trait. ⚠️ 미반영: passive 평타 마법(BasicAttackDamage — AD=0 라 sim 평타 ~0) / 분신 NumClones×NumAttacks×CloneDamageMultiplier 공격 / 길잡이 tier 버프. calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Leblanc entry — cost 4, role APCarry, traits [중재자/길잡이], hp 850, armor/MR 30/30, AD 0, AS 0.8, range 4, mana 0/40, ability '현실 분열' variables BasicAttackDamage/CloneDamageMultiplier/BoltDamage/NumClones/NumAttacks)"
  - "public/data/tft_set17_traits.json (TFT17_ADMIN = 중재자 bp 2/3 / TFT17_SummonTrait = 길잡이 bp 3/5/7)"
  - "src/lib/simulator/systems/ability.ts:266 (TFT17_Leblanc: { pattern: 'multi', maxTargets: 3, damageVar: 'BoltDamage', hitCount: 5 })"
  - "src/lib/simulator/engine/combatLoop.ts:112-114 ArbiterLaw(중재자=TFT17_ADMIN) playerArbiterLaw / 길잡이=TFT17_SummonTrait 소환물 src/hooks/useTeamManagement.ts:152-180(syncVoyagerSummonInTeam)"
related:
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[lissandra]]"
---

# 르블랑 (LeBlanc)

## 요약

4코스트 **중재자 (`TFT17_ADMIN`)** + **길잡이 (`TFT17_SummonTrait`)** trait. raw role `APCarry`. carry augment 없음.

- **role**: `mapGameRole('APCarry')` → sim **Marksman** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌). AP 캐리지만 role 은 Marksman 으로 매핑. hp 850, range 4, mana 0/40, **AD 0**(평타가 마법 피해로 대체되는 passive).
- **ability "현실 분열"**: 기본 지속 — 평타 시 `BasicAttackDamage`(scaleAP) 마법으로 대체. 사용 시 분신 `NumClones`(5)명 소환 → 함께 `NumAttacks`(5)회 `CloneDamageMultiplier`% 공격, 마지막 공격에 투사체 `BoltDamage`(scaleAP) 마법.

> 🎯 **LeBlanc 는 분신 소환 AP 캐리** — passive 평타 마법 + 분신 다중 공격 + 투사체 BoltDamage. ⚠️ sim 은 **BoltDamage × 5(multi 3타겟)만** 모델 — passive 평타(AD=0 라 sim ~0)·분신 공격은 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Leblanc` apiName 으로 소속 확인 (cost 4, traits 중재자/길잡이, role APCarry). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE — 17.4 변경 없음)

| Stat | 값 |
|------|---|
| hp | 850 |
| armor / magicResist | 30 / 30 |
| damage | **0** (평타 → BasicAttackDamage 마법 대체) |
| attackSpeed | 0.8 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 40 |

> ⚠️ **17.5 patch pending** (데이터 미반영, [[patch-17-5]]): Sigil/Bolt Damage `80/120 → 85/130` (buff). ⚠️ 패치노트 'Sigil Damage' 표기 — 수치상 `BoltDamage` ★1/★2(80/120) 로 추정 (raw var 'Sigil' 부재, 룰 #20 raw diff 미확정).

### Role — Marksman

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Marksman** | 1 | 10 | 0 | ❌ | `mapGameRole('APCarry')` includes 'Carry' → Marksman ([[role-passive]]) |

### Active — 현실 분열 (분신 + 투사체)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| BoltDamage | [0, 80, 120, 750, 540, ...] | ✅ `damageVar 'BoltDamage'` filler(v0=0) → ★1=80/★2=120/★3=750 (scaleAP). `hitCount: 5` 곱연산 |
| NumClones | [5, ...] | (sim hitCount 5 ≈ 분신 5 투사체 근사) |
| BasicAttackDamage | [0, 62, 93, 250, 450, ...] | ⚠️ **미반영** — passive 평타 마법 대체. LeBlanc AD=0 라 sim 평타 ~0 (filler → ★1=62/★2=93/★3=250) |
| CloneDamageMultiplier | [0, 0.25, 0.25, 1.5, 1, ...] | ⚠️ **미반영** — 분신 공격 배율 |
| NumAttacks | [5, ...] | ⚠️ **미반영** — 분신 공격 횟수 |

- sim: `pattern: 'multi', maxTargets: 3, damageVar: 'BoltDamage', hitCount: 5`. 3타겟 분배 `BoltDamage × 5`.
- ⚠️ **passive 평타 미반영**: LeBlanc AD=0 + 평타→`BasicAttackDamage`(scaleAP) 마법 대체가 sim 미구현 → 평타 데미지 ~0 (AP 캐리 주 지속딜 누락 가능).
- ⚠️ **분신 공격 미반영**: 분신 5명 × `NumAttacks`(5) × `CloneDamageMultiplier`% 공격 미모델 (BoltDamage 투사체만).

### Trait — 중재자 (ADMIN/Arbiter) / 길잡이 (SummonTrait)

- **중재자** (`TFT17_ADMIN`, bp 2/3): Arbiter 법률 시스템(`ArbiterLaw`, `playerArbiterLaw`/`enemyArbiterLaw` `:112-114`)로 반영. `applyArbiterEffect`(`:4448`)가 effectId `mana`/`ap`/`armor_mr`/`attack_speed`/`permanent_hp`/`shield` 6종 분기 처리, `unitHasTrait(u, '중재자')`(`:5291`)로 식별.
- **길잡이** (`TFT17_SummonTrait`, bp 3/5/7): 소환물(`TFT17_Summon`)은 `useTeamManagement.syncVoyagerSummonInTeam`(`src/hooks/useTeamManagement.ts:152-180`)로 전투 전 count별 star materialize되어 전투 참여. ⚠️ 길잡이 tier별 전투 버프는 sim trait helper 없음(미반영) ([[lissandra]] 동일).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 850, armor/MR 30, AD 0, AS 0.8, range 4, mana 0/40)
- role Marksman (`mapGameRole('APCarry')`)
- Active `BoltDamage × 5`(multi 3타겟 분배)
- 중재자(Arbiter law) trait / 길잡이 소환물 materialize

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2**: passive 평타 마법(`BasicAttackDamage` scaleAP) 미반영 — LeBlanc AD=0 라 sim 평타 ~0 (AP 캐리 주 지속딜 누락)
- **P2**: 분신 공격(NumClones 5 × NumAttacks 5 × CloneDamageMultiplier) 미반영 — BoltDamage 투사체만
- **P2**: 길잡이 tier별 전투 버프 미반영 (소환물 materialize 는 됨, [[lissandra]] 동일)
- calibration: game-423/424 **부재(미측정)**. 17.5 BoltDamage buff(추정) 데이터 미반영([[patch-17-5]]).

## 관련 문서

- [[role-passive]] — Marksman role 마나/타게팅
- [[lissandra]] — 동류 길잡이 (소환물 materialize 공통)
- [[ability-targeting]] — multi 타게팅
