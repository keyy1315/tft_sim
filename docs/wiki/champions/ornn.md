---
id: ornn
type: champion
display_name_kr: 오른
api_name: TFT17_Ornn
cost: 3
traits:
  - 우주 그루브
  - 요새
role: Tank   # raw "APTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank')). carry augment 없음
raw_role: APTank
current_patch_status: "active (⚠️ 17.3 데이터 기준 — raw 17.4 partial dataset 이 Ornn 미갱신. 17.4 pending: hp 850→950 ([[patch-17-4]]) / 17.5 pending: GrooveDuration 3→2.5초 ([[patch-17-5]], Groove sim 미반영이라 영향 0). 데이터/sim 미반영)"
last_verified: 2026-06-16
sim_active: partial   # ability 「디스코 지옥불」 passive 전투 시작 임시 완성 아이템 1개 제작(아이템 3개면 무작위 찬란한 아이템) + 사용 시 Shield(ShieldDuration 3) + 원뿔 화염 Damage(scaleAP) + 보호막 소멸 시 GrooveDuration(3) Groove. sim cone r2 (auto-detect 주 damageVar 'Damage' filler v0>v1 → ★1=180/★2=270/★3=430). 보호막 getAbilityShield(Shield). 우주 그루브(SpaceGroove)/요새(ResistTank applyBastionEffects:1926) trait. ⚠️ Shield under-shield: patch-17-3 audit ★1-★3=125/200/500(filler)인데 getAbilityShield 가 선두 100 non-filler 오판→★1=100(Diana 동형). ⚠️ 미반영: passive 임시 아이템 제작/radiant / Groove 자가 트리거 / ShieldDuration(3초 generic 10초 고정 systemic). calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Ornn entry — cost 3, role APTank, traits [우주 그루브/요새], hp 850(17.3), armor/MR 40/40, AD 50, AS 0.65, range 1, mana 40/100, ability '디스코 지옥불' variables Shield/ShieldDuration/Damage/GrooveDuration)"
  - "public/data/tft_set17_traits.json (TFT17_SpaceGroove = 우주 그루브 bp 1/3/5/7/10 / TFT17_ResistTank = 요새 bp 2/4/6)"
  - "src/lib/simulator/systems/ability.ts:250 (TFT17_Ornn: { pattern: 'cone', radius: 2 } — auto-detect 주 damageVar 'Damage')"
  - "src/lib/simulator/engine/combatLoop.ts:6895 secondaryDamageVar(미사용) / getAbilityShield(ability.ts:505) Shield / :1926 applyBastionEffects 요새 / :1826 applySpaceGrooveBuffs 우주 그루브"
related:
  - "[[patch-17-4]]"
  - "[[patch-17-5]]"
  - "[[role-passive]]"
  - "[[diana]]"
  - "[[poppy]]"
---

# 오른 (Ornn)

## 요약

3코스트 **우주 그루브 (`TFT17_SpaceGroove`)** + **요새 (`TFT17_ResistTank`)** trait. raw role `APTank`. carry augment 없음.

- **role**: `mapGameRole('APTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 ✅). hp 850(17.3), armor/MR 40, range 1, mana 40/100.
- **ability "디스코 지옥불"**: 기본 지속 — 전투 시작 시 임시 완성 아이템 1개 제작(아이템 3개면 무작위 완성 아이템이 이번 전투 찬란한 아이템). 사용 시 `ShieldDuration`(3초) `Shield`(scaleAP) 보호막 + 원뿔 범위 화염 `Damage`(scaleAP) 마법. 보호막 소멸 시 `GrooveDuration`(3초) 그루브 상태.

> 🎯 **Ornn 은 보호막 + 원뿔 화염 탱커** — Shield + cone Damage(scaleAP). ⚠️ sim 은 임시 아이템 제작 passive·Groove 자가 트리거 미반영 + Shield under-shield([[diana]] 동형 getAbilityShield 선두 100 non-filler 오판).

> ⚠️ **set17 entity confirm**: `TFT17_Ornn` apiName 으로 소속 확인 (cost 3, traits 우주 그루브/요새, role APTank). ⚠️ `TFT_ArmoryKeyOrnn`(8코 무기고 모루 아이템)과 혼동 금지 — playable Ornn 은 `TFT17_Ornn`.

## 메커니즘

### Stats (raw, ⚠️ 17.3 — 17.4 partial dataset 미갱신)

| Stat | 값 |
|------|---|
| hp | **850** (⚠️ 17.4 → 950) |
| armor / magicResist | 40 / 40 |
| damage | 50 |
| attackSpeed | 0.65 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 40 / 100 |

> ⚠️ **raw 데이터 = 17.3** (raw 17.4 partial dataset 은 Zed/Shen/Jax 만 갱신, Ornn 미갱신). pending: **17.4**([[patch-17-4]]) hp `850→950` / **17.5**([[patch-17-5]]) GrooveDuration `3→2.5초`(Groove sim 미반영이라 영향 0).

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('APTank')` includes 'Tank' ([[role-passive]]) |

### Active — 디스코 지옥불 (보호막 + 원뿔 화염)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| Damage | [200, 180, 270, 430, 590, ...] | ✅ auto-detect 주 `damageVar 'Damage'` filler(v0>v1) → ★1=180/★2=270/★3=430 (scaleAP, cone r2) |
| Shield | [100, 125, 200, 500, 1050, ...] | ⚠️ **under-shield** — patch-17-3 audit Shield AP ★1-★3 = **125/200/500**(filler, 선두 100=17.2). `getAbilityShield` 가 v0=100<v1=125 라 non-filler 오판 → ★1=100/★2=125/★3=200 사용(★1 100 vs 게임 125 = under, [[diana]] 동형) |
| ShieldDuration | [3, ...] | ⚠️ **미반영** — generic shield `remainingTicks 300`(10초) 고정, raw 3초 무시 (systemic) |
| GrooveDuration | [3, ...] | ⚠️ **미반영** — 보호막 소멸 시 Groove 자가 트리거 |

- sim: `pattern: 'cone', radius: 2`. 원뿔 `Damage`(scaleAP) + 보호막(getAbilityShield Shield).
- ⚠️ **passive 미반영**: 전투 시작 임시 완성 아이템 제작 + (아이템 3개 시) 찬란한 아이템 부여 — 메타 아이템 메커니즘 sim 미모델.
- ⚠️ **Shield under-shield / ShieldDuration**: getAbilityShield 선두 100 non-filler 오판으로 ★1 under(게임 125) + 보호막 지속 10초 고정(raw 3초 무시) — generic systemic([[diana]] 동일).

### Trait — 우주 그루브 (SpaceGroove) / 요새 (ResistTank)

- **우주 그루브** (`TFT17_SpaceGroove`, bp 1/3/5/7/10): `applySpaceGrooveBuffs` (`:1826`) — 그루비안 매초 ADAP +N%.
- **요새** (`TFT17_ResistTank`, bp 2/4/6): `applyBastionEffects` (`:1926`) — teamwide Armor/MR + 요새 unit 추가 BonusArmor/BonusMR + 첫 N초 doubled.

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.3 raw (hp 850, armor/MR 40, AD 50, AS 0.65, range 1, mana 40/100) — ⚠️ 17.4 hp 변경 미반영
- role Tank (`mapGameRole('APTank')`)
- 원뿔 `Damage`(scaleAP) + 보호막(getAbilityShield Shield)
- 우주 그루브(ADAP) / 요새(Armor/MR) trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2 (under-shield)**: Shield 선두 100 을 getAbilityShield 가 non-filler 오판 → ★1=100(게임 125, patch-17-3 audit filler 125/200/500) — [[diana]] 동형 getAbilityShield 휴리스틱 한계
- **P2**: passive 임시 완성 아이템 제작/찬란한 아이템 부여 미반영 (메타 메커니즘)
- **P2**: Groove 자가 트리거(`GrooveDuration`) 미반영 + ShieldDuration(3초) generic shield 10초 고정(systemic)
- **P2**: raw 17.3 — hp 17.4(850→950) + GrooveDuration 17.5(3→2.5) 데이터 미반영([[patch-17-4]]/[[patch-17-5]])
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Tank role 마나/타게팅
- [[diana]] — getAbilityShield under-shield(선두 100 non-filler 오판) 공통
- [[poppy]] — 동류 요새(Bastion) 탱커
