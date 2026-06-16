---
id: missfortune
type: champion
display_name_kr: 미스 포츈
api_name: TFT17_MissFortune
cost: 3
traits:
  - 기동총격여신
  - 특성 선택
role: Fighter   # raw role null → mapGameRole(null) → sim Fighter (types/index.ts:40 default). carry augment 없음 (모드 선택 unique 메커니즘)
raw_role: null
current_patch_status: "active (모드 spell 은 MF_MODE_CONFIG(types/index.ts:267, UI 전용·sim 미사용): 복제자 [280,420,670] — patch-17-4 250/375/600→275/415/660 과 불일치(raw diff 미확보). sim cast 는 base multi+Tier placeholder)"
last_verified: 2026-06-16
sim_active: partial   # ability 「기동총격여신 무기고」 모드 선택(전달자/도전자/복제자) → 모드별 스킬·특성 결정. sim: mfMode(placed.mfMode) 로 resolveMfTraits(trait.ts:6)+combatLoop:393 가 '특성 선택'→모드 trait(MF_MODE_CONFIG) 치환, 복제자 모드 mfReplicatorEffectiveness(damageAmp :6857) 반영. role null→Fighter(types:40). ⚠️ **ability 데미지 미모델**: 모드 spell 은 MF_MODE_CONFIG(types:267, UI 전용·sim 미사용), base ability vars 는 Tier multiplier 뿐 → config multi maxTargets 3 + auto-detect Tier1Damage(=2) pick 으로 cast 데미지 placeholder. 스탠스(TFT17_Item_MissFortuneUnique*Stance)=시스템 아이템(item.ts:118 분류만). calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_MissFortune entry — cost 3, role null, traits [기동총격여신/특성 선택], hp 650, armor/MR 30/30, AD 50, AS 0.75, range 6, mana 0/100, ability '기동총격여신 무기고' variables Tier1Damage~Tier5Damage)"
  - "public/data/tft_set17_traits.json (TFT17_MissFortuneUniqueTrait = 기동총격여신 (minUnits 1, effects 1 tier) / TFT17_MissFortuneUndeterminedTrait = 특성 선택 (effects []))"
  - "src/lib/simulator/systems/ability.ts:241 (TFT17_MissFortune: { pattern: 'multi', maxTargets: 3 } — 모드별 다름, auto-detect Tier1Damage)"
  - "src/lib/simulator/systems/trait.ts:6 resolveMfTraits(mfMode → 모드 trait 치환) / src/lib/simulator/engine/combatLoop.ts:393 mfMode baseTraits 치환 / :1862 mfReplicatorEffectiveness(복제자) / :6857 damageAmp 적용 / item.ts:118 MissFortuneUnique Stance 시스템 아이템"
related:
  - "[[patch-17-4]]"
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[leblanc]]"
---

# 미스 포츈 (Miss Fortune)

## 요약

3코스트 **기동총격여신 (`TFT17_MissFortuneUniqueTrait`)** + **특성 선택 (`TFT17_MissFortuneUndeterminedTrait`)** trait. raw role **null** (모드 선택형). carry augment 없음.

- **role**: raw role `null` → `mapGameRole(null)` → sim **Fighter** (`types/index.ts:40` default). hp 650, range 6, mana 0/100.
- **ability "기동총격여신 무기고"**: 배치 시 **전달자/도전자/복제자 모드** 중 선택 → 선택 모드에 따라 스킬·특성(`특성 선택` → 해당 모드 trait) 결정. base ability vars 는 `Tier1Damage`~`Tier5Damage`(모드/티어 multiplier).

> 🎯 **Miss Fortune 은 모드 선택형 유닛** — 전달자/도전자/복제자 모드로 스킬·특성이 달라짐. sim 은 **모드→trait 치환 + 복제자 damageAmp** 는 반영하나, **모드별 실제 spell 데미지는 sim 미반영**(모드 spell 은 MF_MODE_CONFIG 에 있으나 UI 전용·sim 미사용, sim cast 는 base Tier placeholder).

> ⚠️ **set17 entity confirm**: `TFT17_MissFortune` apiName 으로 소속 확인 (cost 3, role null, traits 기동총격여신/특성 선택). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 650 |
| armor / magicResist | 30 / 30 |
| damage | 50 |
| attackSpeed | 0.75 |
| range | 6 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 100 |

> ⚠️ **모드별 spell = MF_MODE_CONFIG(코드 상수), UI 전용·sim 미사용**: 모드 ability damage 는 `src/types/index.ts:267` `MF_MODE_CONFIG` 에 정의 — 전달자 [75,115,180] / 도전자 [132,198,320] / **복제자 [280,420,670]**. 단 `modeCfg.ability.damage` 는 `SelectedUnitPanel`(UI) 표시 전용이고 **sim 은 미사용**(grep 0건) — sim cast 는 base `multi` + Tier auto-detect placeholder. ⚠️ 복제자 [280,420,670] 은 patch-17-4 표기 "250/375/600→275/415/660" 과도 **불일치**(raw json diff 미확보, 룰 #20 확정 필요).

### Role — Fighter (raw null default)

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (모드 미선택) | **Fighter** | 2 | 10 | 0 | ❌ | raw role `null` → `mapGameRole(null)` default Fighter (`types/index.ts:40`) |

### Active — 기동총격여신 무기고 (모드 선택)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Tier1~5Damage | [2] / [2.5] / [3.3] / [0,4.5,4.5,9,...] / [0,6,6,60,...] (앞 4개 유효, 5~7=0) | ⚠️ multiplier 값. auto-detect 주 damageVar 가 `Tier1Damage`(=2) pick → cast 데미지 placeholder. 모드별 실제 spell 미모델 |

- sim: `pattern: 'multi', maxTargets: 3`. ⚠️ **모드별 ability 미모델**: 모드 spell(MF_MODE_CONFIG)은 UI 전용·sim 미사용이고 base ability vars 는 Tier multiplier 뿐이라 auto-detect 가 Tier1Damage(multiplier 2)를 damageVar 로 pick → cast 데미지가 placeholder(실제 모드 spell 데미지 부재). 모드 시스템의 **데미지** 측면은 sim 미반영.
- ⚠️ **모드별 ability/특성**: 전달자/도전자/복제자 모드 각각 다른 스킬·특성인데, sim 은 trait 치환 + 복제자 damageAmp 만 반영(아래), spell 자체는 base multi 근사.

### Trait — 기동총격여신 / 특성 선택 (모드 시스템)

- **기동총격여신** (`TFT17_MissFortuneUniqueTrait`, minUnits 1): unique trait — 모드 선택 메커니즘 자체.
- **특성 선택** (`TFT17_MissFortuneUndeterminedTrait`, effects []): placeholder trait. **모드 선택 시** `resolveMfTraits`(`trait.ts:6`)+`combatLoop:393`가 `MF_MODE_CONFIG[mfMode]`로 '특성 선택'→실제 모드 trait(전달자/도전자/복제자) 치환.
- **복제자 모드**: `mfReplicatorEffectiveness`(`:1862`) 적용 → cast 데미지에 `abilityDamageAmp += mfReplicatorEffectiveness`(`:6857`). ✅ 복제자 damageAmp 반영.
- ⚠️ **trait helper**: 기동총격여신/특성 선택 trait 는 `apply<Trait>Effects` 또는 `unitHasTrait` 분기 **없음**(grep 0건) — 모드 시스템(resolveMfTraits/combatLoop:393 치환)으로 처리되는 구조라 champion-specific helper 불필요(미구현 아님). 단 generic 경로 존재는 verify 완료.
- **스탠스**: `TFT17_Item_MissFortuneUnique*Stance` 는 `isSystemItem`(`item.ts:118`)에서 시스템 아이템으로 **분류만** (스탠스 효과 적용 핸들러 별도 없음).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 650, armor/MR 30, AD 50, AS 0.75, range 6, mana 0/100)
- role Fighter (raw null → default)
- 모드→trait 치환(resolveMfTraits / combatLoop:393) + 복제자 모드 mfReplicatorEffectiveness(damageAmp)

⚠️ **미반영 / mis-model** (Lint 후보):
- **P1**: 모드별 ability spell 데미지 sim 미반영 — MF_MODE_CONFIG(types:267, UI 전용)에 모드 spell 있으나 sim 미사용, base Tier multiplier auto-detect 로 cast 데미지 placeholder. ⚠️ MF_MODE_CONFIG 복제자 [280,420,670] vs patch-17-4 275/415/660 불일치(raw diff 확인 필요)
- **P2**: 스탠스(MissFortuneUnique*Stance) 효과 미반영 — item.ts:118 분류만
- **P2**: 복제자 mfReplicatorEffectiveness OOR cast path 미적용 가능성 — main(:6857)/recast(:7047) 적용, MF range 6 라 OOR cast 시 damageAmp 누락 가능(verify 권장)
- **P2**: 복제자 외 모드(전달자/도전자) 고유 스킬 효과 미모델 (trait 치환만)
- **P2**: 복제자 모드 spell raw 17.3(17.4 250/375/600→275/415/660) 미반영([[patch-17-4]])
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Fighter role(raw null default) 마나/타게팅
- [[leblanc]] — 동류 복제자(mfReplicatorEffectiveness) damageAmp
- [[ability-targeting]] — multi 타게팅
