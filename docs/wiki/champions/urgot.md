---
id: urgot
type: champion
display_name_kr: 우르곳
api_name: TFT17_Urgot
cost: 3
traits:
  - 메카
  - 싸움꾼
  - 습격자
role: Fighter   # raw "ADFighter" → mapGameRole() → sim Fighter (types/index.ts includes('Fighter')). carry augment 없음
raw_role: ADFighter
current_patch_status: active   # 17.4/17.5 변경 없음 (patch-17-4/17-5 champion list 미포함)
last_verified: 2026-06-16
sim_active: partial   # ability 「멈출 수 없는 살상 병기」 passive 근접 폭발(적이 ShotgunRange 내 들어오면 원뿔 ShotgunDamage scaleAD, FalloffPerHex 30% 칸당 감소, ShotgunCooldown 5초 per 인접) + 사용 시 Shield(ShieldAmount scaleAP) + 1칸 이동 + 폭발 쿨다운 초기화. sim cone r2 + selfBuff{durability:0.2, duration:3} + damageVar 'ShotgunDamage'. ShotgunDamage filler(v0>v1) → ★1=85/★2=125/★3=200. 보호막 getAbilityShield(ShieldAmount filler ★1=150/★2=175/★3=200). 메카(Mecha:2299)/싸움꾼(HPTank:2130)/습격자(MeleeTrait:610) trait. ⚠️ passive 근접 폭발이 본질인데 sim 은 cast 시 cone 1회로 근사(반복 발사·ShotgunCooldown·proximity 트리거 미모델). ⚠️ selfBuff durability 0.2 = raw 변수 없는 하드코딩(desc durability 언급 없음) / FalloffPerHex(30% 칸당 감소) 미반영(damageDecay 없음). calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Urgot entry — cost 3, role ADFighter, traits [메카/싸움꾼/습격자], hp 600, armor/MR 45/45, AD 60, AS 0.8, range 2, mana 0/50, ability '멈출 수 없는 살상 병기' variables ShotgunDamage/ShotgunCooldown/ShieldAmount/ShieldDuration/FalloffPerHex)"
  - "public/data/tft_set17_traits.json (TFT17_Mecha = 메카 bp 3/4/6 / TFT17_HPTank = 싸움꾼 bp 2/4/6 / TFT17_MeleeTrait = 습격자 bp 2/4/6)"
  - "src/lib/simulator/systems/ability.ts:247 (TFT17_Urgot: { pattern: 'cone', radius: 2, selfBuff: { durability: 0.2, duration: 3 }, damageVar: 'ShotgunDamage' })"
  - "src/lib/simulator/engine/combatLoop.ts:2299 applyMechaEffects 메카 / :2130 applyBrawlerEffects 싸움꾼(:2126 Urgot 포함) / :610 습격자(MeleeTrait) / getAbilityShield(ability.ts:505) ShieldAmount"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[belveth]]"
  - "[[pantheon]]"
---

# 우르곳 (Urgot)

## 요약

3코스트 **메카 (`TFT17_Mecha`)** + **싸움꾼 (`TFT17_HPTank`)** + **습격자 (`TFT17_MeleeTrait`)** trait. raw role `ADFighter`. carry augment 없음.

- **role**: `mapGameRole('ADFighter')` → sim **Fighter** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌). hp 600, armor/MR 45, range 2, mana 0/50.
- **ability "멈출 수 없는 살상 병기"**: 기본 지속(근접 폭발) — 적이 `ShotgunRange` 칸 내 들어오면 가장 가까운 인접 칸 향해 원뿔 폭발 `ShotgunDamage`(scaleAD), 칸당 `FalloffPerHex`(30%) 감소, 인접 칸마다 `ShotgunCooldown`(5초) 쿨. 사용 시 `ShieldDuration`(3초) `Shield`(`ShieldAmount` scaleAP) + 폭발 반경에 최대 대상 포함되게 1칸 이동 + 폭발 쿨다운 초기화.

> 🎯 **Urgot 은 근접 폭발(shotgun) passive 파이터** — 본질이 **proximity 트리거 반복 발사**인데 sim 은 cast 시 원뿔 `ShotgunDamage` 1회로 근사. Shield + selfBuff 내구력(하드코딩). 반복 발사·FalloffPerHex·쿨다운 미모델.

> ⚠️ **set17 entity confirm**: `TFT17_Urgot` apiName 으로 소속 확인 (cost 3, traits 메카/싸움꾼/습격자, role ADFighter). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE — 17.4 변경 없음)

| Stat | 값 |
|------|---|
| hp | 600 |
| armor / magicResist | 45 / 45 |
| damage | 60 |
| attackSpeed | 0.8 |
| range | 2 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 50 |

### Role — Fighter

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Fighter** | 2 | 10 | 0 | ❌ | `mapGameRole('ADFighter')` includes 'Fighter' ([[role-passive]]) |

### Active — 멈출 수 없는 살상 병기 (근접 폭발 + 보호막)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| ShotgunDamage | [90, 85, 125, 200, 275, ...] | ✅ `damageVar 'ShotgunDamage'` filler(v0>v1) → ★1=85/★2=125/★3=200 (scaleAD, cone r2). ⚠️ 반복 발사 미모델(아래) |
| ShieldAmount | [200, 150, 175, 200, 225, ...] | ✅ `getAbilityShield`(shieldVarNames 'ShieldAmount' pick) filler(v0>v1) → ★1=150/★2=175/★3=200 (scaleAP) |
| ShotgunCooldown | [5, ...] | ⚠️ **미반영** — 인접 칸마다 5초 쿨(반복 발사 주기) |
| FalloffPerHex | [0.3, ...] | ⚠️ **미반영** — 칸당 30% 감소 (config damageDecay 없음) |
| ShieldDuration | [3, ...] | ⚠️ generic shield 10초 고정(raw 3초 무시, systemic) |

- sim: `pattern: 'cone', radius: 2, selfBuff: { durability: 0.2, duration: 3 }, damageVar: 'ShotgunDamage'`. 원뿔 `ShotgunDamage`(scaleAD) + 내구력 버프 + 보호막(getAbilityShield).
- ⚠️ **passive 반복 발사 미모델**: 근접 폭발은 적 proximity 시 `ShotgunCooldown`(5초)마다 반복 발사되는 **passive**인데 sim 은 cast 시 cone 1회로 근사 → 반복 타격·FalloffPerHex·proximity 트리거 미반영.
- ⚠️ **selfBuff durability 0.2 하드코딩**: raw ability 에 Durability 변수 없음(desc 도 내구력 언급 없음) → config 의 durability 0.2 는 raw 근거 없는 하드코딩(검증 필요).

### Trait — 메카 / 싸움꾼 / 습격자

- **메카** (`TFT17_Mecha`, bp 3/4/6): `applyMechaEffects` (`:2299`) — 메카 unit 한정 AD%/AP flat 가산.
- **싸움꾼** (`TFT17_HPTank`, bp 2/4/6): `applyBrawlerEffects` (`:2130`) — teamwide +5% maxHp + 싸움꾼 unit 추가 % maxHp. Urgot 포함(`:2126`).
- **습격자** (`TFT17_MeleeTrait`, bp 2/4/6): `:610` — `MaxPercentHealthShield` + `ShieldAD` (흡혈→보호막 변환).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 600, armor/MR 45, AD 60, AS 0.8, range 2, mana 0/50)
- role Fighter (`mapGameRole('ADFighter')`)
- 원뿔 `ShotgunDamage`(scaleAD) + 보호막(getAbilityShield ShieldAmount) + selfBuff durability(하드코딩)
- 메카(AD/AP) / 싸움꾼(maxHp) / 습격자(shield) trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2 (구조)**: 근접 폭발이 proximity 반복 passive 인데 sim cast 시 cone 1회 근사 — ShotgunCooldown 반복·proximity 트리거·FalloffPerHex(30% 칸당) 미반영
- **P2**: selfBuff durability 0.2 raw 변수 없는 하드코딩(desc durability 없음) — 검증 필요. + selfBuff.duration(3초)도 time-bounded 미적용 — combatLoop 가 duration 미read, durability 가 cast 후 전투 종료까지 영구 적용(systemic, Nasus/Jax/Leona 등 공통)
- **P2**: ShieldDuration(3초) generic shield 10초 고정(systemic)
- **P2(informational)**: ShotgunRange 수치 raw variables 미노출(desc placeholder 만) — 정확한 거리값 불명
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Fighter role 마나/타게팅
- [[belveth]] / [[pantheon]] — 동류 싸움꾼(HPTank)
- [[ability-targeting]] — cone 타게팅
