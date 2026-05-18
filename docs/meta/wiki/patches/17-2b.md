---
id: patch-17-2b
type: patch
live_date: 2026-04-29
status: LIVE (obsoleted by 17.3)
last_verified: 2026-05-18
sources:
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-2/ (April 29th Mid-Patch Update 섹션)
  - public/data/tft_set17_champions.json
  - public/data/tft_set17_augments.json
  - src/data/disabledContent.ts
  - src/data/carryAugments.ts
  # 원본 plan doc (docs/meta/set17-patch-17-2b-plan.md) 는 ingest 완료 후 archive (2026-05-18). 이력은 wiki/log.md 참조
related:
  - "[[patch-17-3]]"
  - "[[stargazer-fountain]]"
---

# Patch 17.2b — 2026-04-29 Mid-Patch Update

17.2 LIVE 의 마이크로 패치. 17.3 LIVE (2026-05-13) 로 부분 갈음됨.

## 변경 내역

### 증강 (Augments)

| 증강 | apiName | 변경 | sim 적용 |
|------|--------|------|---------|
| 군체의 심장 | `TFT17_Augment_PrimordianPrismaticAugment` | 버그로 **비활성화** | `disabledContent.ts` Set 추가 |
| 뜨거운 죽음 (모데카이저) | `TFT17_Augment_MordekaiserCarry` | shield `175/200/250` → **`225/250/300`** AP | `carryAugments.ts` `shield` 갱신 |
| 자폭 (그라가스) | `TFT17_Augment_GragasCarry` | healthCost `30%` → **`20%`**, hexReduction `55%` → **`45%`** | `carryAugments.ts` `healthCost: 0.20`, `hexReduction: 0.45` |
| 방패 여전사 (레오나) | `TFT17_Augment_LeonaCarry` | damage `110/165/250` → **`90/135/225`** AD | `carryAugments.ts` `damage: [90,135,225]` (physical) |
| 신병 | `TFT17_Augment_NewRecruit` (raw 추가) | 4코스트 수 `3` → **`1`** | `tft_set17_augments.json` 신규 entry |

### 챔피언 (champions.json)

| 챔프 | apiName | variable | 기존 [1성/2성/3성/4성] | 17.2b [1성/2성/3성/4성] |
|------|---------|---------|----------------------|------------------------|
| 브라이어 | `TFT17_Briar` | `ADDamage` | 130/195/320/550 | **120/180/285**/550 |
| 레오나 | `TFT17_Leona` | `ShieldAmount` | 420/500/685/870 | 420/**480/620**/870 |
| 잭스 | `TFT17_Jax` | `ShieldAmount` | 400/500/625/? | 400/**470/550**/? |

> 4성 수치는 보존. raw `value` 배열 인덱스 = `[plus, 1성, 2성, 3성, 4성, reserved, reserved]`

### 시너지

| 시너지 | 변경 | sim 영향 |
|--------|------|---------|
| Timebreaker | XP `2/3/4/4/4` → `1/2/2/3/4`, 리롤 `1/2/2/3/3` → `1/1/2/2/3` | **없음** (econ trait, 전투 외) |

### 버그 수정 (sim 무관 또는 minor)

- 블리츠크랭크 부활 상호작용
- 마스터 이 돌진 속도/타게팅 로직
- 케일의 명품 (Craftmanship) 골드 획득
- 바루스 별교차의 축복 (Starcrossed) 지속시간
- 유연한 / 사다리 오르기 증강 → 소환수 제외

## sim 적용 PR 그룹

| PR | 내용 | 머지 |
|----|------|------|
| #67 | 직접 수치 변경 (브라이어/레오나/잭스 + 군체의 심장 disabled) | ✅ |
| #68 + PR3 후속 | Hero Augment statOverrides 시스템 + 자폭/뜨거운 죽음/방패 여전사 abilityData | ✅ |
| PR2 신병 추가 | CDragon fetch → augments.json 신규 entry | ✅ (line 8380 "신병") |

> PR #67~#85 17.2b 작업 전체 머지 완료 (메모리 `project_17-2b-status.md`).

## 17.2b → 17.3 차이

[[patch-17-3]] 에서 추가 변경:
- **[[stargazer-fountain]] 재활성화** — 17.2b 까지 비활성, 17.3 LIVE 에서 active
- Shen passive `BonusDamageOnAttack` 너프 (45/75 → 20/30) — PR #108
- 기타 Set 17.3 데이터 갱신 — PR #107

## Hero Augment Carry 시스템 (17.2b 도입)

17.2b 작업 중 PR #68/PR3 가 도입한 **carryAugments.ts** 시스템은 별도 메커니즘 페이지화 가치 있음 (현재 미작성). 핵심 골격:

- `CarryAugmentConfig.statOverrides` — augment 활성 시 챔프 stat 변경 (HP/armor/MR/AS/range 등)
- `CarryAbilityData` 확장 — `damage` 외 27개 변수 (shield/healthCost/hexReduction/asGain/secondaryDamage 등)
- `applyHeroCarryTransforms` — CARRY_AUGMENTS iterate, role + statOverrides + abilityData 일괄 적용
- 8 영웅 증강 모두 `abilityData` 채움 (사용자 인게임 데이터 기반)

→ 후속 ingest 후보: `mechanics/hero-augment-carry.md`

## 미완 (사용자 인게임 측정 후 채움 대상)

> 17.2b plan 시점에 "사용자가 게임에서 확인 후 제공" 으로 보류된 항목들. 17.3 시점에도 동일하게 보류 중일 수 있음.

- 나서스/뽀삐/파이크/아트록스/잭스/꼬마정령 — augment 활성 시 변환된 stat (HP/AS/range 등)
- 자폭 (그라가스) 적군 damage / hexReduction / 탱커 +60% 시뮬 적용 (현재 적군 damage flow skip 구조)
- augment-specific damage 시뮬 분기 (레오나 90/135/225, 잭스 starLevel asGain, 모데 shield 등 일부)
- 복잡 메커니즘: 파이크 X-shape + onKill / 꼬마정령 multi-stun + 미프 / 아트록스 3-skill cycle + N.O.V.A. / 뽀삐 bouncing + 미프

## 데이터 수정 원칙 (사용자 강조)

17.2 작업 중 사고 발생 — raw augment JSON 전체 덮어쓰기로 사용자 작성 임의 필드(특히 desc 없던 augment 의 한글 제목)가 모두 날아감.
**규칙**: raw data 파일 수정 시 **변경 필드만 부분 Edit**. 전체 덮어쓰기 절대 금지. → 메모리 `feedback_data_edit.md`

## Lint 체크리스트

- [ ] 17.3 머지 후 17.2b 항목 중 obsoleted 된 것 (예: Fountain inactive) 표시 확인 — 이 페이지 status: `LIVE (obsoleted by 17.3)` 반영됨 ✓
- [ ] `mechanics/hero-augment-carry.md` ingest 시 이 페이지의 "Hero Augment Carry 시스템" 섹션 → 그쪽으로 이동, 여기는 링크만
- [ ] 미완 항목 — 후속 sim 작업 머지 시마다 줄여 나감
