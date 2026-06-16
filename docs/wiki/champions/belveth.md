---
id: belveth
type: champion
display_name_kr: 벨베스
api_name: TFT17_Belveth
cost: 2
traits:
  - 태고족
  - 도전자
  - 습격자
role: Fighter   # raw "ADFighter" → mapGameRole() → sim Fighter (types/index.ts). carry augment 없음
raw_role: ADFighter
current_patch_status: active (⚠️ 17.3 데이터 기준 — raw 17.4 partial dataset 이 Bel'Veth 미갱신. 17.4 pending: ADDamage 18/27/41/69→20/30/45/77 (17.3 너프 revert, [[patch-17-4]]) / 17.5 pending: ADDamage 20/30/45→22/33/50 (buff, [[patch-17-5]]). 모두 데이터/sim 미반영)
last_verified: 2026-06-16
sim_active: partial   # ability 「파도 가르기」 SlashDuration(2초) 동안 TotalNumSlashes(scaleAS)회 베기, 각 TotalDamage(=ADDamage scaleAD + APDamage scaleAP) 물리. sim single + hitCount 12(BaseNumSlashes, 곱연산 :6753). auto-detect 주 damageVar 'ADDamage' filler(v0>v1) → ★1=18/★2=27/★3=41. 태고족(Primordian :2275)/도전자(ASTrait :592)/습격자(MeleeTrait :610) trait 반영. ⚠️ slash 수 AS 스케일(TotalNumSlashes scaleAS) 미반영 — sim hitCount 12 고정(AS 스택 캐릭인데 고AS 시 under). APDamage 부차 scaleAP 미반영(auto-detect ADDamage 우선). calibration: game-423/424 부재(미측정)
sources:
  - "public/data/tft_set17_champions.json (TFT17_Belveth entry — cost 2, role ADFighter, traits [태고족/도전자/습격자], hp 750, armor/MR 45/45, AD 47, AS 0.75, range 2, mana 0/50, ability '파도 가르기' variables ADDamage/APDamage/BaseNumSlashes/BonusASBreakpoint/SlashDuration/NumProcsPerSimulatedAttack)"
  - "public/data/tft_set17_traits.json (TFT17_Primordian = 태고족 bp 2/3 / TFT17_ASTrait = 도전자 bp 2/3/4/5 / TFT17_MeleeTrait = 습격자 bp 2/4/6)"
  - "src/lib/simulator/systems/ability.ts:226 (TFT17_Belveth: { pattern: 'single', hitCount: 12 } — auto-detect 주 damageVar 'ADDamage')"
  - "src/lib/simulator/engine/combatLoop.ts:6753 single hitCount 곱연산 / :2275 applyPrimordianEffects 태고족(:2273 Belveth 포함) / :592 도전자(ASTrait) Burst AS / :610 습격자(MeleeTrait) shield"
related:
  - "[[patch-17-5]]"
  - "[[patch-17-4]]"
  - "[[role-passive]]"
  - "[[briar]]"
  - "[[reksai]]"
---

# 벨베스 (Bel'Veth)

## 요약

2코스트 **태고족 (`TFT17_Primordian`)** + **도전자 (`TFT17_ASTrait`)** + **습격자 (`TFT17_MeleeTrait`)** trait. raw role `ADFighter`. carry augment 없음.

- **role**: `mapGameRole('ADFighter')` → sim **Fighter** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌). hp 750, armor/MR 45, range 2, mana 0/50.
- **ability "파도 가르기"**: 현재 대상을 `SlashDuration`(2초) 동안 연속 `TotalNumSlashes`(scaleAS)회 베어 각각 `TotalDamage`(=`ADDamage` scaleAD + `APDamage` scaleAP) 물리.

> 🎯 **Bel'Veth 는 연속 베기 AS 파이터** — `TotalNumSlashes` 가 **공격속도 비례**(scaleAS)라 AS 스택 시 베기 수 증가. ⚠️ sim 은 `hitCount: 12`(BaseNumSlashes) **고정** → AS 스케일 미반영(고AS 시 under). 도전자/습격자로 AS 쌓는 캐릭이라 갭 존재.

> ⚠️ **set17 entity confirm**: `TFT17_Belveth` apiName 으로 소속 확인 (cost 2, traits 태고족/도전자/습격자, role ADFighter). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, ⚠️ 17.3 — 17.4 partial dataset 미갱신)

| Stat | 값 |
|------|---|
| hp | 750 |
| armor / magicResist | 45 / 45 |
| damage | 47 |
| attackSpeed | 0.75 |
| range | 2 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 0 / 50 |

> ⚠️ **raw 데이터 = 17.3** (raw 17.4 partial dataset 은 Zed/Shen/Jax 만 갱신, Bel'Veth 미갱신). ability `ADDamage` pending 누적:
> - **17.4** ([[patch-17-4]]): `ADDamage` `18/27/41/69 → 20/30/45/77` (17.3 너프 **revert**, raw 현재 ★2~ 18/27/41 = **17.3 값**)
> - **17.5** ([[patch-17-5]]): `ADDamage` `20/30/45 → 22/33/50` (buff)

### Role — Fighter

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Fighter** | 2 | 10 | 0 | ❌ | `mapGameRole('ADFighter')` → Fighter ([[role-passive]]) |

### Active — 파도 가르기 (연속 베기)

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| ADDamage | [50, 18, 27, 41, 69, ...] | ✅ auto-detect 주 `damageVar 'ADDamage'` filler(v0>v1) → ★1=18/★2=27/★3=41 (scaleAD) — ⚠️ 17.3 값(위 patch 박스) |
| APDamage | [0, 3, 5, 7, 12, ...] | ⚠️ **미반영** — auto-detect ADDamage 우선, APDamage(scaleAP) 부차 무시. filler → ★1=3/★2=5/★3=7 |
| BaseNumSlashes | [12, ...] | ✅ `hitCount: 12` (single 곱연산 `:6753`) — 단 baseline 만, AS 스케일 미반영 |
| BonusASBreakpoint | [25, ...] | ⚠️ **미반영** — AS 비례 추가 베기 기준점 (TotalNumSlashes scaleAS 산식) |
| SlashDuration | [2, ...] | (sim 즉발 hitCount 곱연산, 2초 분산 미모델) |
| NumProcsPerSimulatedAttack | [4, ...] | ⚠️ **미반영** — 시뮬 공격당 proc 수 |

- sim: `pattern: 'single', hitCount: 12`. 단일 대상 `ADDamage × 12` (`combatLoop:6753` single hitCount 곱연산).
- ⚠️ **slash 수 AS 스케일 미반영**: 실제 `TotalNumSlashes` 는 `BaseNumSlashes`(12) + AS 비례 추가(`BonusASBreakpoint` 25 기준). sim 은 12 고정 → 도전자/습격자로 고AS 달성 시 베기 수 under.
- ⚠️ **APDamage 부차 미반영**: TotalDamage = ADDamage + APDamage 인데 auto-detect 가 ADDamage 만 pick(★2=27 대비 APDamage ★2=5 작음).

### Trait — 태고족 / 도전자 / 습격자

- **태고족** (`TFT17_Primordian`, bp 2/3): `applyPrimordianEffects` (`:2275`) — (3) tier `DamageMultiplier` 1.45 → 태고족 unit damageAmp +0.45. Bel'Veth 포함(`:2273` Briar/Belveth/RekSai).
- **도전자** (`TFT17_ASTrait`, bp 2/3/4/5): `:592` — 새 대상 dash 시 AS +BurstPercent% × BurstDuration 초 (Burst).
- **습격자** (`TFT17_MeleeTrait`, bp 2/4/6): `:610` — `MaxPercentHealthShield` + `ShieldAD` (흡혈→보호막 변환 `:494`).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.3 raw (hp 750, armor/MR 45, AD 47, AS 0.75, range 2, mana 0/50) — ⚠️ 17.4/17.5 ADDamage 변경 미반영(위 박스)
- role Fighter (`mapGameRole('ADFighter')`)
- 연속 베기 `ADDamage × hitCount 12`(single 곱연산)
- 태고족(damageAmp) / 도전자(Burst AS) / 습격자(shield) trait

⚠️ **미반영 / mis-model** (Lint 후보):
- **P2**: slash 수 AS 스케일(`TotalNumSlashes` scaleAS / `BonusASBreakpoint`) 미반영 — sim hitCount 12 고정, AS 스택 캐릭이라 고AS 시 under
- **P2**: APDamage 부차 scaleAP 미반영 (auto-detect ADDamage 우선)
- **P2**: raw 데이터 17.3 — ADDamage 17.4 revert(18/27/41→20/30/45) + 17.5 buff(→22/33/50) 데이터/sim 미반영([[patch-17-4]]/[[patch-17-5]])
- calibration: game-423/424 **부재(미측정)**.

## 관련 문서

- [[role-passive]] — Fighter role 마나/타게팅
- [[briar]] — 동류 태고족
- [[reksai]] — 동류 태고족
