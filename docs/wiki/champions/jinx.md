---
id: jinx
type: champion
display_name_kr: 징크스
api_name: TFT17_Jinx
cost: 2
traits:
  - 동물특공대
  - 도전자
role: Marksman   # raw "ADCarry" → mapGameRole() → sim Marksman (types/index.ts includes('Carry')). carry augment 없음
raw_role: ADCarry
current_patch_status: active
sim_active: partial   # ability 「폭발적 성향」 원뿔 로켓 — BaseBullets(16) 발 각 ADDamage(scaleAD) 물리. sim cone + hitCount:16 + damageVar:'ADDamage' (under-damage fix, 로켓 다발 -55%→-28%). ADDamage filler ★1=29/★2=44/★3=70. 도전자(ASTrait) teamwide AS+Burst 정합 / 동물특공대(AnimaSquad) 는 전투 외 shop 시스템(sim 비해당). ⚠️ 미반영: ASPerBullet(0.35) AS-스케일 추가 로켓(hitCount static 한계, base 16 만 — Jinx 잔여 -28% under 라 보수적) / APDamage(부차 scaleAP) / RocketsPerLaunchAttack(6, 평타 로켓 패시브 의심 — sim 미참조)
last_verified: 2026-06-15
sources:
  - "public/data/tft_set17_champions.json (TFT17_Jinx entry — cost 2, role ADCarry, traits [동물특공대/도전자], hp 550, armor/MR 20/20, AD 55, AS 0.75, range 4, mana 20/80, ability '폭발적 성향' variables BaseBullets/ASPerBullet/ADDamage/APDamage/MinimumNumTargets/RocketsPerLaunchAttack/BulletTravelDistance/TotalSpellTime)"
  - "public/data/tft_set17_traits.json (TFT17_AnimaSquad = 동물특공대 bp 3/6 / TFT17_ASTrait = 도전자 bp 2/3/4/5)"
  - "src/lib/simulator/systems/ability.ts:222 (TFT17_Jinx: { pattern: 'cone', radius: 2, hitCount: 16, damageVar: 'ADDamage' })"
  - "src/lib/simulator/engine/combatLoop.ts (cone hitCountTotal = ADDamage × 16 split — findAbilityTargets cone + dot 아님 일반 split)"
  - "src/lib/simulator/engine/combatLoop.ts:519-540 도전자(ASTrait) teamwideAS + :592 Burst set + :5712-5810 dash trigger (AnimaSquad 은 applyAnimaSquadEffects 없음 — 전투 외 shop/tech 시스템, sim 비해당)"
related:
  - "[[role-passive]]"
  - "[[ability-targeting]]"
  - "[[corki]]"
  - "[[caitlyn]]"
---

# 징크스 (Jinx)

## 요약

2코스트 **동물특공대 (`TFT17_AnimaSquad`)** + **도전자 (`TFT17_ASTrait`)** trait. raw role `ADCarry`. carry augment 없음.

- **role**: `mapGameRole('ADCarry')` → sim **Marksman** ([[role-passive]] — 공격당 10 / 초당 0 / 피격 ❌).
- **ability "폭발적 성향"**: 원뿔 범위에 로켓 `ModifiedNumRockets`(`BaseBullets` 16 + `ASPerBullet` 0.35 × AS, scaleAS)발 발사. 각 로켓이 처음 적중한 대상에 `TotalDamage`(=`ADDamage` scaleAD) 물리 피해. `MinimumNumTargets` 2.

> 🎯 **Jinx 는 "로켓 다발" 마크스맨** — 핵심은 **로켓 개수**(16발+). sim 은 `hitCount: 16` 으로 BaseBullets 발 각 ADDamage 를 원뿔 타겟에 split (under-damage fix, 로켓 다발 미모델 시 -55%). AS 높을수록 로켓 증가(ASPerBullet)는 P2.

> ⚠️ **set17 entity confirm**: `TFT17_Jinx` apiName 으로 소속 확인 (cost 2, traits 동물특공대/도전자, role ADCarry). 한글명 list 만으로 후보 선정 금지.

## 메커니즘

### Stats (raw, 17.4 LIVE)

| Stat | 값 |
|------|---|
| hp | 550 |
| armor / magicResist | 20 / 20 |
| damage | 55 |
| attackSpeed | 0.75 |
| range | 4 |
| critChance / critMultiplier | 0.25 / 1.4 |
| initialMana / mana | 20 / 80 |

### Role — Marksman

| 형태 | role | weight | 공격당 마나 | 초당 마나 | 피격 시 마나 | 근거 |
|------|------|--------|-----------|---------|------------|------|
| base (증강 없음) | **Marksman** | 1 | 10 | 0 | ❌ | `mapGameRole('ADCarry')` includes 'Carry' ([[role-passive]]) |

### Active — 폭발적 성향 (원뿔 로켓)

raw desc: "원뿔 범위에 로켓 `@ModifiedNumRockets@`(scaleAS)발을 발사해 각각 처음 적중한 대상에 `@TotalDamage@`(scaleAD) 물리 피해."

| 변수 | raw value | sim 적용 |
|------|-----------|---------|
| BaseBullets | [16, 16, ...] | ✅ `hitCount: 16` (로켓 기본 발수) |
| ASPerBullet | [0.35, ...] | ⚠️ AS-스케일 추가 로켓 미반영 (hitCount static — base 16 만, P2) |
| ADDamage | [3, 29, 44, 70, 110, ...] | ✅ `damageVar: 'ADDamage'` filler(sentinel 3) → ★1=29 / ★2=44 / ★3=70 (scaleAD, bonusAD 반영 #238) |
| APDamage | [0, 3, 5, 7, ...] | ⚠️ 부차 scaleAP 미반영 (작음, P2) |
| MinimumNumTargets | [2, 2, ...] | 원뿔 cone 분배 (split) |
| RocketsPerLaunchAttack | [6, 6, ...] | ⚠️ sim 미참조 (평타 로켓 패시브 의심 — grep 0) |

- sim: `pattern: 'cone', radius: 2, hitCount: 16, damageVar: 'ADDamage'`. `hitCountTotal = ADDamage★ × 16`, cone(≠single) → split 분배. 로켓 다발(16발) 모델 (under-damage fix).
- ⚠️ **ASPerBullet AS-스케일 미반영**: 실제 로켓 수 = 16 + AS 비례 증가. sim 은 base 16 고정 (Jinx 잔여 -28% under 라 보수적 — overshoot 방지). dynamic hitCount 필요(P2).

### Trait — 동물특공대 (AnimaSquad) / 도전자 (ASTrait)

- **동물특공대** (`TFT17_AnimaSquad`, bp 3/6): `applyAnimaSquadEffects` **없음** — 전투 외 shop/tech 시스템(TechPerCombat/Kill → 동물특공대 아이템 제작), scaling.json synergy 항목 없음 → **전투 sim 비해당** (룰 #16: helper 없음 + 이유 명시).
- **도전자** (`TFT17_ASTrait`, bp 2/3/4/5): `applySet17SynergyBuffs` teamwide AS (`:519-540`) + 도전자 unit 새 대상 dash 시 Burst AS (`:592` set / `:5712-5810` trigger).

## sim 통합 상태 — `partial`

✅ **활성**:
- stats 17.4 정합 (hp 550, armor/MR 20, AD 55, AS 0.75, range 4, mana 20/80)
- role Marksman (`mapGameRole('ADCarry')`)
- 원뿔 로켓 16발 × ADDamage(scaleAD, bonusAD #238) split (under-damage fix)
- 도전자(ASTrait) trait — teamwide AS + Burst (동물특공대는 전투 외 shop 시스템 = sim 비해당)

⚠️ **미반영** (Lint 후보):
- **P2**: ASPerBullet AS-스케일 추가 로켓 — hitCount static, base 16 만 (dynamic 필요)
- **P2**: APDamage 부차 scaleAP 미반영 (작음)
- **P2**: RocketsPerLaunchAttack(6) — 평타 로켓 패시브 의심, sim 미참조 (grep 0)
- calibration: Jinx -55%→-28% (sim +60%, game-424 -21.55→-17.03%). 잔여 = AS-스케일 로켓 + duration.

## 관련 문서

- [[role-passive]] — Marksman role 마나/타게팅
- [[corki]] / [[caitlyn]] — 동류 "다발 발사" 마크스맨/스페셜리스트
