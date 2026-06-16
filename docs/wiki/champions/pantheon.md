---
id: pantheon
type: champion
display_name_kr: 판테온
api_name: TFT17_Pantheon
cost: 2
traits:
  - 시간 균열자
  - 싸움꾼
  - 복제자
role: Tank   # raw "ADTank" → mapGameRole() → sim Tank (types/index.ts includes('Tank')). carry augment 없음
raw_role: ADTank
current_patch_status: active
sim_active: partial   # ability 「고급 방어술」 보호막 + 내구력 4초 + 원뿔 매초 TrueDamagePerSecond(scaleAD) 물리 DOT. sim cone r2 + selfBuff{durability:0.15} + dot{duration:4, perSecond:true} → 원뿔 DOT = TrueDamagePerSecond × 4 (Bard/Viktor/AurelionSol 동형 perSecond). 유일 damage var = TrueDamagePerSecond(fuzzy includes 'Damage' pick), filler(v0=0) → ★1=30/★2=45/★3=70. 보호막 getAbilityShield 가 APShield(scaleAP)만 반영. 시간 균열자/싸움꾼/복제자 trait 정합. ⚠️ P0: PercentHealthShield(최대 체력 6%) 미반영 — getAbilityShield 가 APShield 우선 find + maxHp 인자 부재(Pantheon 유일 보유, 미측정으로 fix 보류). ⚠️ P2: var 명 'TrueDamagePerSecond' vs desc '물리 피해(scaleAD)' 불일치 — sim 은 desc 따라 physical(armor 적용). calibration: game-424 존재하나 playerDamage 미측정(enemy/non-carry), perSecond fix 후 diff-cache 변동 없음
last_verified: 2026-06-16
sources:
  - "public/data/tft_set17_champions.json (TFT17_Pantheon entry — cost 2, role ADTank, traits [시간 균열자/싸움꾼/복제자], hp 900, armor/MR 45/45, AD 50, AS 0.6, range 1, mana 20/80, ability '고급 방어술' variables APShield/Duration/Durability/TrueDamagePerSecond/PercentHealthShield)"
  - "public/data/tft_set17_traits.json (TFT17_Timebreaker = 시간 균열자 bp 2/3/4 / TFT17_HPTank = 싸움꾼 bp 2/4/6 / TFT17_APTrait = 복제자 bp 2/4)"
  - "src/lib/simulator/systems/ability.ts:238 (TFT17_Pantheon: { pattern: 'cone', radius: 2, selfBuff: { durability: 0.15, duration: 4 }, dot: { duration: 4, perSecond: true } } — fuzzy damageVar 'TrueDamagePerSecond')"
  - "src/lib/simulator/engine/combatLoop.ts:6813 (main) / :7676 (OOR) dot.perSecond → dotTotal = TrueDamagePerSecond × duration(4) / :2100 applyTimebreakerEffects / :2117 싸움꾼(HPTank) / :1855 applyReplicatorTrait 복제자(:1851 Pantheon 포함) / getAbilityShield(ability.ts:505) 보호막"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[aurelionsol]]"
  - "[[ezreal]]"
---

# 판테온 (Pantheon)

## 요약

2코스트 **시간 균열자 (`TFT17_Timebreaker`)** + **싸움꾼 (`TFT17_HPTank`)** + **복제자 (`TFT17_APTrait`)** trait. raw role `ADTank`. carry augment 없음.

- **role**: `mapGameRole('ADTank')` → sim **Tank** ([[role-passive]] — 공격당 5 / 초당 0 / 피격 ✅). range 1 (근접), hp 900, armor/MR 45/45.
- **ability "고급 방어술"**: `Duration`(4)초 동안 보호막(`APShield`/`PercentHealthShield`, scaleHealth+scaleAP) + `Durability`(15%) 획득. 지속시간 동안 원뿔 범위 내 적에 **매초** `TrueDamagePerSecond`(scaleAD) 물리.

> 🎯 **Pantheon 은 방어형 원뿔 DOT 탱커** — 원뿔 피해 `TrueDamagePerSecond` 가 **매초** 적용이라 [[aurelionsol]]·Bard·Viktor 와 동일하게 `dot.perSecond` 로 × Duration(4) 반영. 보호막은 generic `getAbilityShield` 로 APShield(scaleAP)만 처리 — PercentHealthShield(체력% 성분)는 미반영.

> ⚠️ **set17 entity confirm**: `TFT17_Pantheon` apiName 으로 소속 확인 (cost 2, traits 시간 균열자/싸움꾼/복제자, role ADTank). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 900 |
| armor / magicResist | 45 / 45 |
| damage | 50 |
| attackSpeed | 0.6 |
| range | 1 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 20 / 80 |

### Role — Tank

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Tank** | 3 | 5 | 0 | ✅ | `mapGameRole('ADTank')` includes 'Tank' ([[role-passive]]) |

### Active — 고급 방어술 (보호막 + 원뿔 DOT)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| APShield | [0, 275, 300, 500, ...] | ✅ `getAbilityShield`(ability.ts:505) — shieldVarNames 'Shield' 포함 첫 변수로 APShield pick. filler(v0=0) → ★1=275/★2=300/★3=500. scaleAP 부분만(`baseValue × (1+ap/100)`) |
| PercentHealthShield | [0.06, ...] | ⚠️ **미반영** — `getAbilityShield` 가 APShield 를 먼저 find(둘 다 'Shield' 포함, 변수 순서상 APShield 우선)하여 PercentHealthShield 는 사용 안 됨. `getAbilityShield` 시그니처에 maxHp 없어 최대 체력 6% 보호막 가산 로직 부재 → 보호막 과소(★1 ~+54, 체력 상승 비례) |
| Duration | [4, ...] | ✅ `dot.duration: 4` + selfBuff.duration |
| Durability | [0.15, ...] | ✅ `selfBuff: { durability: 0.15, duration: 4 }` — 받는 피해 15% 감소 |
| TrueDamagePerSecond | [0, 30, 45, 70, 120, ...] | ✅ fuzzy `damageVar` (includes 'Damage') filler(v0=0) → ★1=30/★2=45/★3=70 (scaleAD, **매초**) |

- sim: `pattern: 'cone', radius: 2, selfBuff: { durability: 0.15, duration: 4 }, dot: { duration: 4, perSecond: true }`. `dot.perSecond` → 원뿔 DOT 총량 = `TrueDamagePerSecond★ × Duration(4)` (매초값 × 4, [[aurelionsol]] 동형).
- ⚠️ **var 명 vs desc 불일치**: raw var 명은 `TrueDamagePerSecond` 이나 desc 는 "scaleAD **물리** 피해" → sim 은 desc 따라 **physical**(armor 적용) 처리(`resolveDamageType` desc '물리 피해' → 'ad'). 실제가 고정/관통 피해면 sim 이 과소일 수 있음(armor 감소).

### Trait — 시간 균열자 / 싸움꾼 / 복제자

- **시간 균열자** (`TFT17_Timebreaker`, bp 2/3/4): `applyTimebreakerEffects` (`:2100`) — teamwide AS + 시간 균열자 unit 추가 AS.
- **싸움꾼** (`TFT17_HPTank`, bp 2/4/6): `applyBrawlerEffects` (`:2117`) — teamwide +5% maxHp + 싸움꾼 unit 추가 % maxHp.
- **복제자** (`TFT17_APTrait`, bp 2/4): `applyReplicatorTrait` (`:1855`) — 복제자 보유 unit `mfReplicatorEffectiveness` (`:1861-1862`, Pantheon 포함 `:1850`).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 900, armor/MR 45, AD 50, AS 0.6, range 1, mana 20/80)
- role Tank (`mapGameRole('ADTank')`)
- 보호막 APShield(scaleAP, getAbilityShield) + 내구력(selfBuff durability 0.15) + 원뿔 DOT(`TrueDamagePerSecond★ × Duration(4)`, dot.perSecond)
- 시간 균열자 / 싸움꾼 / 복제자 trait

⚠️ **미반영 / 주의** (Lint 후보):
- **P0**: PercentHealthShield(최대 체력 6%) 미반영 — `getAbilityShield` 가 APShield 를 먼저 find(변수 순서)하여 PercentHealthShield 미사용 + maxHp 인자 부재. 보호막 과소 → 탱커 생존성 과소. fix 시 cast-time 1회 helper (main `:6780` + OOR `:7550` 양쪽 `unit.maxHp × pct` 가산) 필요. Pantheon 은 ability PercentHealthShield 보유 **유일** 챔프(blast radius = Pantheon)라 미측정으로 sim fix 보류.
- **P2**: var 명 `TrueDamagePerSecond` vs desc '물리 피해(scaleAD)' 불일치 — sim 은 physical(armor 적용). 실제 true/고정이면 과소
- calibration: game-424 에 존재하나 playerDamage 미측정(enemy/non-carry) — perSecond fix 후 diff-cache 변동 없음. correctness fix ([[aurelionsol]] 동형, unit test 검증).

## 관련 문서

- [[role-passive]] — Tank role 마나/타게팅
- [[aurelionsol]] — dot.perSecond 동형 (초당값 × duration)
- [[ezreal]] — 동류 시간 균열자
