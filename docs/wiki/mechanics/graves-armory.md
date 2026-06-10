---
id: graves-armory
type: mechanic
api_name: TFT17_GravesTrait
display_name_kr: 최신상 무기고
parent_entity: "[[graves]]"
current_patch_status: active
sim_active: partial   # 무기고 raw 55 apiName = 게임 실존 49종 전부 sim 구현 (Frame 3종 + stat 가산 ~15종 + flag/hook 메커닉 ~31종) + placeholder 6종(게임 미존재, sim 미구현이 정합). Phase 1 applyGravesFrameEffects(:2359) + Phase 2 stat map(:2440~) + Phase 3A/B/C flag setter(:2462~) + 평타/피격/처치/tick hook. placeholder 6종: FrameDefense/FrameOffense/FrameSupport(게임 내 "선택 금지" placeholder, raw 미구현) + Backup(효과 없음, 구현 불요) + LaserBallistics2/3(게임 무기고 트리 미존재 — lolchess 실게임 보상표 단일 tier 확인, raw 의 잘린 tier 데이터·icon off-by-one). 부분: GravBooster2 동상(chill) raw 미정의 → 미구현(NumAttacks 3 본체는 구현). 별개: graves 평타 원뿔 투사체 passive 는 무기고 아닌 champion ability — [[graves]] P1
last_verified: 2026-06-10
sources:
  - "https://lolchess.gg/rewards/set17/factory-new (무기고 무기 목록 — 한글명/효과)"
  - "public/data/tft_set17_items.json (TFT17_GravesTrait_* 55종 — apiName/desc/변수)"
  - "src/lib/simulator/systems/item.ts:113 (TFT17_GravesTrait_ 시너지 상점템 판정)"
  - "src/lib/simulator/engine/combatLoop.ts:2359 (applyGravesFrameEffects — Frame 3종) / :2440 (Phase 2 stat map) / :2462 (Phase 3A flag setter) / :2521 (Phase 3C 평타 AOE) / :2877 (Buckshot hook) / :2898 (LatentExplosion hook)"
related:
  - "[[graves]]"
  - "[[role-passive]]"
---

# 최신상 무기고 (Graves Armory)

## 요약

**최신상 (`TFT17_GravesTrait`)** 전용 메커니즘. 전투에 참여한 후 무기고를 열어 **가장 강한 아군 그레이브즈 1명**에게 영구 업그레이드를 구매한다. raw apiName **55종** (Frame 6종 + 비-Frame 49종) = **게임 실존 49종 구현 + placeholder 6종**(Frame 3 + Backup + LaserBallistics2/3 — 상세 아래). ⚠️ raw 분류의 "비-Frame 49" 와 "게임 실존 구현 49" 는 우연히 같은 수치이나 다른 집합(전자는 LB2/3·Backup placeholder 포함, 후자는 Frame 활성 3 포함).

- sim 은 **"보유한 업그레이드"를 입력으로 받아** 가장 강한 Graves 에게 적용 (`gravesUpgrades` 배열). 게임 실존 49종 구현, placeholder 6종(게임 미존재 — Frame 3 + Backup + LaserBallistics2/3).
- ⚠️ **라운드 카운터(3회마다 +1, "다음 업그레이드: ?라운드 후")는 sim 미구현 — 의도적**. 시뮬레이터는 **단일 전투** 단위라, "언제/몇 라운드마다 구매하나"는 메타게임 영역(전투 시뮬 범위 밖). [[graves]] Chogath chogath_hp 와 동일 패턴 (라운드 간 누적분만 입력).

> 🎯 **무기고는 graves ingest(#193) 당시 "개요만" 검증됐으나, 이후 Phase 2/3A/3B/3C 로 대거 구현됨** (게임 실존 49종 전부 구현 / placeholder 6). 본 페이지가 55종 전수 검증의 single source.

> ⚠️ **set17 entity confirm**: `TFT17_GravesTrait` apiName + `node -e` 로 무기 55종 (`TFT17_GravesTrait_*`) 확인.

## 메커니즘 구조 (sim 3-Phase)

가장 강한 Graves 1명(`findStrongestUnitByApi`)에게 `gravesUpgrades` 입력을 순차 적용:

| Phase | 함수 | 처리 |
|-------|------|------|
| **Phase 1** | `applyGravesFrameEffects` (`:2359`) | Frame 3종 (맹공/위력/사수) — stat/role/spellCanCrit |
| **Phase 2** | stat map (`:2440~`) | 단순 능치 직접 가산 (AD/HP/crit/마나/방어관통 등) |
| **Phase 3A/B/C** | flag setter (`:2462~`) + hook | 메커닉 — flag set 후 평타/피격/처치/tick hook 에서 효과 발동 |

## 무기 55종 구현 현황

### ① Frame (선택형, 6종 중 3 활성)

| 무기 (apiName suffix) | 한글 | 효과 | sim |
|----------------------|------|------|:---:|
| CloseQuarters | 맹공 프레임 | 사거리−2, 전사 변환, HP+250, AD+25%, 흡혈+10% | ✅ |
| SharpshooterModule | 위력 프레임 | 정밀(spellCanCrit) + 스킬 피해+5% | ✅ |
| DoubleTap | **사수 프레임** | **25% 확률 2회 공격** (`DoubleAttackChance 0.25`) | ✅ |
| FrameDefense | 보강 프레임 | "선택 금지 — 미구현 기능" (게임 내 placeholder) | ❌ |
| FrameOffense | 맹공 프레임(별개) | 원거리 딜러 placeholder | ❌ |
| FrameSupport | 지원 프레임 | "선택 금지 — 미구현 기능" placeholder | ❌ |

> Frame placeholder 3종 모두 게임 미구현 = sim 미구현 정합. 단 근거 차이: **FrameDefense/FrameSupport** = raw desc `"!!선택 금지 - 미구현 기능!!"` / **FrameOffense** = 선택 금지 경고는 없으나 raw `effects {}` empty (실제 효과 없음).

### ② 공격력 / 흡혈 stat (Phase 2 직접 가산)

| 무기 | 효과 | sim |
|------|------|:---:|
| PrecisionScope / 2 / 3 | 정밀 조준경 — AD+12/24/36%, 사거리+1/2/3 | ✅ |
| Fission / 2 / 3 | 분열 — AD+10/20/30%, 마나재생+2/3/5 | ✅ |
| LeechingImplants / 2 | 흡수 임플란트 — AD+10/20%, 흡혈+10/15% | ✅ |

### ③ 치명타 / 탱커 / 마나 (Phase 2)

| 무기 | 효과 | sim |
|------|------|:---:|
| Heartseeker / 2 / 3 | 심장추적자 — 치명타+10/25/40%, 치명피해+5/10/18% | ✅ |
| Tankbuster | 탱커 파괴자 — 탱커 상대 damage amp+15% | ✅ |
| Coolant / 2 | 냉각수 — maxMana−10/20 | ✅ |
| VoidCoefficient | 공허 계수 — 스킬 마나 소모−15% | ✅ |

### ④ 방어 관통 / 감소

| 무기 | 효과 | sim |
|------|------|:---:|
| APRounds / 2 | 철갑탄 — 적 방어력 30/60% 무시 (`armorPen`) | ✅ |
| **RipperBullets / 2** | **파쇄 탄환 — 평타 시 적 armor/MR −1/−2** (`gravesRipperReduce` flag+hook) | ✅ |
| Meltthrough | 용융 관통 — 매초 2칸 내 armor/MR−4, **인접 적 2배(−8)** | ✅ (인접 2배 `hexDistance===1` 분기 PR #212 구현) |

### ⑤ 방어 / 생존 (Phase 2/3A)

| 무기 | 효과 | sim |
|------|------|:---:|
| HeavyPlating | 두꺼운 장갑판 — HP+300, 방어+20, 마저+20 | ✅ |
| SheerMass | 순수 질량 — maxHp×1.25 | ✅ |
| ReactiveArmor | 반응형 방어구 — 피격 시 armor/MR+4 stack (최대 50) | ✅ |
| EmergencyShielding / 2 | 긴급 보호막 — HP 40% 시 maxHp 50/75% shield (2.5/4초) | ✅ |
| Nanomachines | 나노머신 — 매초 maxHp 3% 회복 | ✅ |

### ⑥ 추가 공격 / 공격속도 (Phase 3B)

| 무기 | 효과 | sim |
|------|------|:---:|
| DoubleTap2 | 한 발에 두 놈 — 35% 2회 공격 (DoubleTap 25% max override) | ✅ |
| TripleTap | 한 발에 세 놈 — 18% 3회 공격 | ✅ |
| RevUp / 2 | 엔진 가동 — 같은 대상 연속 공격 AS+8/15% (최대 80/150%) | ✅ |
| GravBooster / 2 | 중력 증폭기 — 처치 관여 시 돌진 + N회 AS+40% (2/3회) | ⚠️ 본체 ✅ / **2 동상 ❌** |

> GravBooster2 의 "동상(chill)" 효과만 raw 미정의 → 미구현 (NumAttacks 3 본체는 구현). **Lint P2**.

### ⑦ 평타 투사체 / AOE (Phase 3C)

| 무기 | 효과 | sim |
|------|------|:---:|
| Buckshot / 2 / 3 | 산탄 사격 — 투사체+2/4/6, 확산+20/30/40% (`:2877` hook) | ✅ |
| FragmentationRounds / 2 | 파편탄 — 평타 시 주변 파편 N개 | ✅ |
| LaserBallistics | 레이저 탄도학 — 평타 관통 + 대상당 피해 감소 (Buckshot 라인 6코 단일 말단) | ✅ |
| ~~LaserBallistics2 / 3~~ | 레이저 탄도학+/++ — 관통 2/3칸 | ➖ **게임 미존재 placeholder** (무기고 트리 미존재 — lolchess 실게임 보상표 단일 tier 확인, raw 의 잘린 tier 데이터·icon off-by-one. Frame/Backup 동류) |
| Choke | 초크 — 투사체 분산−75% | ✅ |
| BlastRadius / 2 / 3 | 폭발 반경 — 2차 폭발 반경+N칸 | ✅ |
| AimAssistant | 조준 보정 — 거리 1칸당 추가 피해 | ✅ |

### ⑧ 처치 / 폭발 트리거

| 무기 | 효과 | sim |
|------|------|:---:|
| LatentExplosion | 지연 폭발 — 피해 15% 저장 → 처치 시 반경 2칸 방출 (`:2898` hook) | ✅ |
| SympatheticDetonation | 공감성 폭발 — 가장 가까운 적 2차 폭발 | ✅ |
| Shockwave | 충격파 — 전투 시작 전방 충격파 (Graves maxHp%) | ✅ |

### ⑨ 미구현 / 특수

| 무기 | 사유 | sim |
|------|------|:---:|
| Backup | 조정 — desc "아무 효과 없음" (raw `effects` 에 AD/AS+5% 있으나 Riot 내부 placeholder 추정, sim 미구현·desc 정합) | ➖ |
| FrameDefense/Offense/Support | 게임 내 "선택 금지" placeholder | ❌ |
| GravBooster2 동상 | raw 미정의 (lolchess UI 추정만) | ❌ 부분 |

## sim 적용 상태 — `partial`

✅ **활성** (49/55):
- Frame 3종 (맹공/위력/사수=DoubleTap 25% 2회)
- stat 가산 ~15종 (PrecisionScope/Fission/LeechingImplants/Heartseeker/Tankbuster/Coolant/APRounds/SheerMass/HeavyPlating)
- flag+hook 메커닉 ~31종 (RipperBullets 파쇄/ReactiveArmor/EmergencyShielding/Nanomachines/Buckshot/LaserBallistics(단일 tier)/Meltthrough(인접 2배)/Frag/BlastRadius/RevUp/GravBooster/LatentExplosion/Shockwave/VoidCoefficient/Choke/AimAssistant/SympatheticDetonation 등)

✅ **resolved**:
- ~~P1 Meltthrough 인접 2배~~ → **PR #212 sim fix** (`hexDistance===1` 시 `gravesMeltthroughArmorMR × 2` = −8 분기). 회귀 가드 `graves-meltthrough-adjacent.test.ts` (인접 적 armor/MR 매초 −8)

⚠️ **미반영 / 부분** (Lint 후보):
- **P2**: GravBooster2 동상(chill) — raw 미정의, NumAttacks 3 본체만 구현
- ➖ FrameDefense/FrameOffense/FrameSupport — 게임 내 선택 금지 placeholder (sim 미구현이 정합, raw 자체 미구현)
- ➖ Backup — 효과 없음 (구현 불요)
- ➖ **LaserBallistics2/3** — 게임 무기고 트리 미존재 placeholder (lolchess 실게임 보상표 단일 tier 확인 — #211 의 "P1 HANDLERS 누락 미구현" 진단 **철회**, raw 의 잘린 tier 데이터·icon off-by-one). Frame/Backup 동류 = sim 미구현이 정합
- ➖ **라운드 카운터** (3회마다 +1, "다음 업그레이드: N라운드 후") — 메타게임, 단일 전투 시뮬 범위 밖 (의도적 미구현, Lint 아님)

## Lint 신규 등록 후보

| # | 항목 | 의미 | Tier | 적용 분기 (룰 #17) | 처리 |
|---|------|------|------|---------------------|------|
| ➖ 철회 | ~~LaserBallistics2/3 미구현~~ | #211 은 `HANDLERS`/`APPLY_ORDER` 누락을 P1 으로 기재했으나, **LB2/3 는 게임 무기고 트리 미존재 placeholder** (lolchess 실게임 보상표 단일 tier 확인, raw 의 잘린 tier 데이터·icon off-by-one) | ~~P1~~ | 해당 없음 (게임 미존재) | **진단 철회** — sim 미구현이 정합. Frame/Backup 동류. 교훈: tiered weapon raw apiName 존재 ≠ 게임 도달 가능 (트리 도달성 확인 필수) |
| ✅ resolved | ~~Meltthrough 인접 2배 미반영~~ | desc "doubled for adjacent enemies". sim `:5444` hexDistance>2 가드로 2칸 내 균등 −4, hexDistance===1 시 2배(−8) 분기 없었음 | ~~P1~~ | per-target — hexDistance===1 시 `2 × gravesMeltthroughArmorMR` | **PR #212 fix 완료** (−8 분기 + 회귀 가드 + diff-cache #213) |
| P2 | GravBooster2 동상(chill) 미반영 | desc "처치 관여 시 돌진+AS". GravBooster2 NumAttacks 3 본체 구현, lolchess UI 의 "동상" 부가효과는 raw 미정의 → 미구현 | **P2** | 해당 없음 (raw 미정의) | raw 에 chill 변수 없어 추정 불가. patch raw 확인 후 |
| info | 라운드 카운터 미구현 | 무기고 구매 타이밍(3회마다 라운드+1)은 메타게임 진행 로직 | info | 해당 없음 (전투 시뮬 범위 밖) | 단일 전투 시뮬 설계상 정상 — 구매 결과(`gravesUpgrades`)만 입력 |

> 📌 **무기고 게임 실존 49종 전부 sim 구현 — Frame 3종 + stat 가산 + flag/hook 메커닉** (raw 55 apiName = 49 구현 + placeholder 6). `partial` 사유는 GravBooster2 동상(P2) + 게임 placeholder 6종(Frame 3 + Backup + LaserBallistics2/3, raw 미구현·미존재 정합) + graves 평타 passive 별개([[graves]] P1). **Meltthrough 인접 2배는 PR #212 resolved**. 라운드 카운터는 의도적 범위 밖.

## Lint 체크리스트

- [x] **set17 entity 소속 0단계** — `node -e` 로 `TFT17_GravesTrait_*` 55종 확인 (apiName/한글명/desc)
- [x] entity-wide grep `GravesTrait` + 55종 suffix sim hit 측정 — base suffix hit 51 이나 **tier별 핸들러 전수 확인 필수**(LaserBallistics hit 는 단일 tier 만 — hit 측정이 tier 구분 못 함). 실구현 49종 / placeholder 6종(Backup, Frame placeholder 3, **LaserBallistics2/3 게임 트리 미존재**). ⚠️ 교훈: raw 에 tier apiName(LB2/3) 존재해도 **게임 무기고 트리 도달 가능 여부**는 별도 확인 — lolchess 실게임 보상표 / 트리 다이어그램 대조 (raw 에 잘린 tier 데이터 잔존 가능)
- [x] **함수 컨텍스트 read (2단계)** — Phase 1 `applyGravesFrameEffects` (`:2359`) + Phase 2 stat map (`:2440-2460`, PrecisionScope/Fission/Heartseeker/APRounds/SheerMass/LeechingImplants/HeavyPlating 직접 가산) + Phase 3A/B/C flag setter (`:2462-2575`, RipperBullets/Buckshot/RevUp/GravBooster/Meltthrough/VoidCoefficient/Choke 등)
- [x] **flag → hook 작동 verify** — `gravesBuckshotProjectiles` (`:2877` 소비) / `gravesLatentStored` (`:2898/2950/2998`) / `gravesRipperReduce` (`:2428` 주석 + 평타 hook) 실제 효과 발동 확인 (flag set 만이 아닌 hook 소비)
- [x] **변수 값 정합** — PrecisionScope AD+12/24/36%·range+1/2/3 / Heartseeker crit+10/25/40% / APRounds armorPen 30/60% / RipperBullets armor/MR−1/−2 / RevUp AS+8/15% max80/150% / Buckshot 투사체+2/4/6 — raw items.json effects 대조
- [x] **미구현 판정** — Backup(효과없음) / FrameDefense·Offense·Support("선택 금지" raw placeholder, 게임 미구현이라 sim 미구현 정합) / GravBooster2 동상(raw 미정의 `:2494` 주석) P2
- [x] **라운드 카운터 = 메타게임 범위 밖** — 무기고 구매 타이밍은 단일 전투 시뮬 무관. `gravesUpgrades` 입력(보유 업그레이드)만 적용 ([[graves]] Chogath chogath_hp 동일 패턴)
- [x] **parent [[graves]] 연계** — 무기고는 최신상 trait 메커니즘. graves 평타 원뿔 투사체 passive(P1)는 champion ability 별개 (무기고 아님)
- [x] **본문 Lint P2 1건 + placeholder/범위밖 명시 → frontmatter `sim_active: partial`** (보수적 minimum, 룰 #8/#15)
- [ ] (선택) GravBooster2 동상 raw 확인 / 무기 변수별 정밀 수치 대조 (현 카테고리 대표 검증)

## 관련

- [[graves]] — 최신상 carry champion. 무기고는 graves 전용 trait 메커니즘. 평타 원뿔 투사체 passive(P1)는 별개 champion ability
- [[role-passive]] — Frame(CloseQuarters) 시 Marksman→Fighter role 변환
- 코드: `src/lib/simulator/engine/combatLoop.ts:2359` (Frame) / `:2440` (stat map) / `:2462` (flag setter) / `:2877` (Buckshot hook) / `:2898` (LatentExplosion hook), `src/lib/simulator/systems/item.ts:113`
- Raw: `public/data/tft_set17_items.json` (TFT17_GravesTrait_* 55종)
- 외부: lolchess.gg/rewards/set17/factory-new (무기 목록)
