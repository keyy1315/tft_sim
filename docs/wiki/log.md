---
name: TFT Domain Wiki — Log
purpose: append-only 변경 기록 (ingest/lint/refactor 이벤트)
format: newest first
---

# TFT Domain Wiki — Log

## 2026-05-19

### Ingest: champions/shen.md — wiki/champions/ 폴더 첫 페이지 (PR #148 + codex P2 amend)

- **Source** (5단계 워크플로우):
  - `public/data/tft_set17_champions.json` (TFT17_Shen entry — 17.3 LIVE stats)
  - `src/lib/simulator/systems/ability.ts:250` (abilityOverride aoe_circle r=2 + selfBuff)
  - `src/lib/simulator/engine/combatLoop.ts:1508-1525` (applyShenArtifactShield — 보루 trait)
  - `combatLoop.ts:5710-5748` (passive 평타 시 stack × BonusDamage)
  - `combatLoop.ts:6167-6169` (cast 시 shenPassiveStack++)
  - `docs/01-plan/features/tft-17-3-shen-passive.plan.md` (Plan 문서)
- **5단계 워크플로우 적용**:
  1. 좁은 grep: TFT17_Shen / shenPassiveStack
  2. 함수 컨텍스트: 평타 hook 분기 (line 5710-) — stack × bonus + isTrueDmg (>= 3)
  3. **entity-wide grep `Shen`**: 보루 trait helper + passive stack hook + 평타 hook + Shen artifact 등 multi-source. 의도된 분리 (trait + champion + carry 별 helper)
  4. cast path 3종: aoe_circle pattern + selfBuff 분기 모두 main pipeline (Shen 자체는 dash 없음 → OOR 진입 안 함)
  5. **actual integration verify**: passive stack ++ (line 6167) + 평타 시 stack read (line 5710) → 일관 정합. PR2 (plan 문서) 구현 완료
- **첫 챔피언 페이지** — `champions/` 폴더 신규 생성. frontmatter 표준 정립 (id/type/display_name_kr/api_name/cost/traits/role/sim_active/sources)
- **17.3 변경 3건 정합**: hp 1200→1300, BonusDamageOnAttack 45/75→20/30, ShieldHP 0.10→0.15 모두 sim 적용 확인
- **codex P2 amend (PR #148 amend)** — frontmatter `role: Tank` 잘못 표기. raw champion JSON 의 role 은 `APFighter` 이고 `mapGameRole()` 가 `*Fighter` → simulator `Fighter` 매핑. Tank vs Fighter 는 마나 (공격당 5/on-hit ✓ vs 10/on-hit 0) + 타게팅 weight (3 vs 2) + non-target reduction (×0.85 적용 안 됨 vs 적용) 모두 다름 → role-passive 룰 잘못 전파 가능. **해소**: `role: Fighter` + `raw_role: APFighter` + 본문 Role 주의 섹션 추가 + index 갱신
- **검증 필요 (잔존)**: selfBuff.attackSpeed 0.3 vs raw BonusAS 0.8 관계 / ASSlow debuff 적용 위치 / DamageHP 1% maxHp passive scaling 정확성

### Refactor: legacy xxxCarryActive flag 4건 deprecate — selectedCarryAugment 단일화 (PR #147)

- **Source**: PR #144 selectedCarryAugment 일반화 후속 cleanup. legacy flag 4건 (PR #135/#136 추가 + leona/gragas legacy) 단순 deprecate
- **제거된 type 필드** (CombatUnit):
  - `gragasCarryActive` (legacy, sim 코드 read 0건 dead)
  - `leonaCarryActive` (legacy, sim 코드 read 0건 dead)
  - `nasusCarryActive` (PR #135, bonusPerKill modifier + stack hook read site 2건)
  - `jaxCarryActive` (PR #136, selfBuff asGain + Jax damage 분기 main+OOR 4 read site)
- **read site 모두 selectedCarryAugment 비교로 교체** (동치 검증):
  - `unit.xxxCarryActive` → `unit.selectedCarryAugment === 'TFT17_Augment_XxxCarry'`
  - cast loop 6 read site + applyCarryDamageModifiers 1 read site = 7 read site 갱신
- **createCombatUnit init 12 site 제거** (4 flag × 3 init site)
- **`applyHeroCarryTransforms` simplify** — 4 flag set 분기 제거. `selectedCarryAugment` + Mordekaiser carry shield (carry data 보유) 만 유지
- **test assertion 갱신** — `.xxxCarryActive).toBe(true/false)` → `.selectedCarryAugment).toBe(...) / .toBeNull()` 14건 sed 일괄 갱신
- **mordekaiserCarryShield 유지**: carry data (shield array 보유) — 단순 boolean 아니라 별도 처리. selectedCarryAugment 와 함께 유지
- **검증**: pnpm typecheck pass, 전체 suite **896/896 pass** ✅
- **효과**: type 8 줄 + 12 init line + 14 test assertion 일관 → CombatUnit type 단순화, selected single-carry semantics 일원화 완료

### Docs: Lint #10 deep cleanup — hero-augment-carry.md stale 표기 전수 정정 (PR #146 + codex P2 amend)

- **Source**: 위키 lint #10 (`hero-augment-carry.md` 의 "❌ 미완" 섹션 stale 표기 — PR #131 부분 정정 후 deep cleanup 후속)
- **Stale 표기 정정 (5건)**:
  - **Aatrox 3-skill cycle counter** ❌ 미완 → ✅ resolved (PR7-C, cycle counter % 3 분기 + slamDamage + N.O.V.A.)
  - **Pyke X-shape onKill 재시전** ❌ 미완 → ✅ resolved (PR7-A, `combatLoop.ts:6544-6580` cascade max 5 chain) — PR #131 1차 정정 후 본 PR cleanup
  - **Poppy `spiritBounceOnKill`** ❌ 미완 → ✅ resolved (PR7-D, `combatLoop.ts:6648-6680` overkill bounce max 50)
  - **정령족 (미프) `spiritEffectPerStack`** ❌ 미완 → ✅ resolved (`combatLoop.ts:6231-6233` 미프 trait + astronautMeepsStack 시 적용)
  - **자폭 (Gragas) 적군 damage path** ❌ 미완 → ✅ resolved (PR #127 — 적군 AOE radius 3 정상 작동)
- **부분 잔존 명시**:
  - **Mordekaiser passive 매초 tick** — 펄스 자체는 구현됨 (applyMordekaiserProcCast / tickMordekaiserProc), radius 증가 (시작 1, 6초마다 +1) 부분만 미반영 가능성 (패치 명세 검증 필요)
  - **statOverrides 잔존** (Lint #5) — Poppy AS / Nasus resists 인게임 측정 대기
  - **Lint #13 (InvaderZed)** — spec 확인 대기
- **frontmatter 갱신**:
  - `sim_active: partial` 유지 (codex P2 amend) — 9/10 carry active 이나 **InvaderZed (Lint #13) 만 minimal** 잔존. carry-specific 메커니즘 모두 sim 도달이라는 일반론은 9/10 만 해당. 위키 lint script 가 frontmatter 의존 시 InvaderZed gap 가려지지 않게 정확한 상태 comment 명시
  - `last_verified: 2026-05-18 → 2026-05-19`
- **변환 흐름 4단계 → 5단계 갱신** (PR #144 selectedCarryAugment 일반화 반영)
- **신규 섹션 "검증 누적 (Lint sub-finding resolved 사례)"** — Lint #5~#16 모두 추적 표
- **Lint 체크리스트** — 신규 carry augment 추가 시 selected single-carry semantics 자동 적용 룰 추가

### Test + wiki cleanup: Lint #14 sub-lint 7건 모두 ✅ resolved (PR #145)

- **Source**: PR #144 + codex P1 amend 가 광범위 selected 가드 일반화 적용 — 7 sub-lint (14-A~G) 자동 해소 효과
- **검증된 sub-lint** (코드 verify 기반):
  - **14-A** Aatrox cycle counter / NOVA selector — 다중 Aatrox 카피 시 selected 만 selectedCarryAugment set → carryCfg=null → cycle 분기 진입 안 함 ✅
  - **14-B** Pyke onKillRecast cascade — non-selected 카피는 carryCfg=null → cascade 진입 안 함 ✅
  - **14-C** Poppy spiritBounceOnKill chain — non-selected 카피는 carryCfg=null → bounce 진입 안 함 + rangeOverride 도 selected 만 적용 (rangeOverride 통합) ✅
  - **14-D** Ivern hexReduction + multi-stun — `applyCarryDamageModifiers` / `applyCarryPostCastEffects` 가 받는 carryCfg 가 non-selected 면 null → IvernMinionCarry 분기 진입 안 함 ✅
  - **14-E** Mord aoe_circle pollution — non-selected 카피는 carryCfg=null → applyMordekaiserProcCast 의 carry shield override 분기 진입 안 함 ✅
  - **14-F** Leona flag dead + abilityOverride pollution — leonaCarryActive 는 legacy 잔존, abilityOverride pollution 은 selectedCarryAugment 가드로 해소 ✅
  - **14-G** Gragas flag dead + abilityOverride pollution — 14-F 와 동일 ✅
- **회귀 가드 test 추가** (`hero-carry-augments.test.ts` 4 case, 전체 20/20 pass):
  - Aatrox 다중 카피 (3성 + 2성) → 3성만 `selectedCarryAugment === 'TFT17_Augment_AatroxCarry'`, 2성 null
  - Pyke 다중 카피 → cascade 가드 검증
  - Poppy 다중 카피 → selected 만 `rangeOverride 4` 적용 (3성 range 4 / 2성 raw)
  - IvernMinion 다중 카피 → hexReduction + multi-stun 가드 검증
- **legacy flag 처리**: jaxCarryActive / nasusCarryActive / leonaCarryActive / gragasCarryActive / mordekaiserCarryShield 는 legacy 호환 유지 — read site 는 모두 selected 가드 동치 (jax/nasus 는 selectedCarryAugment 와 동치, leona/gragas 는 dead flag 후속 정리 후보)
- **남은 lint**: #13 (Zed spec 대기) / #5 잔존 (Poppy/Nasus statOverrides 인게임 verify)

### Refactor: selected-carry-augment 일반화 foundation — Lint #14 1/N (PR #144 + codex P1 amend)

- **Source**: Lint #14 (광범위 abilityOverride pollution audit) — 사용자 결정 Option B (일반화 helper)
- **audit 결과 (Lint #14 sub-lint 카탈로그)**:
  - **14-A** Aatrox cycle counter / NOVA selector — 🔴 selected 가드 없음
  - **14-B** Pyke onKillRecast cascade — 🔴 모든 카피 진입
  - **14-C** Poppy spiritBounceOnKill chain — 🔴 모든 카피
  - **14-D** Ivern hexReduction + multi-stun — 🔴 augmentApiName 검사만
  - **14-E** Mord aoe_circle pollution — 🟡 mordekaiserCarryShield 일부 가드
  - **14-F** Leona flag dead + abilityOverride pollution — 🟡 leonaCarryActive read 0건
  - **14-G** Gragas flag dead + abilityOverride pollution — 🟡 gragasCarryActive read 0건
- **Foundation 변경 (본 PR)**:
  - `src/types/index.ts`: `selectedCarryAugment: string | null` 필드 추가
  - `combatLoop.ts` 3 createCombatUnit site: `selectedCarryAugment: null` 초기화
  - `applyHeroCarryTransforms`: 모든 carry 의 selected target 에 `target.selectedCarryAugment = cfg.augmentApiName` 일관 set (기존 xxxCarryActive flag 도 legacy 호환 유지)
  - `getAbilityConfigForUnit`: 일반화 가드 — `unit.selectedCarryAugment !== carry.augmentApiName` 시 raw fallback. **이전 JaxCarry 한정 가드 (PR #136) 를 모든 carry 로 확장**
- **효과**:
  - **모든 carry 에 Layer 2 (abilityOverride) 가드 일관 적용** — non-selected 카피가 carry pattern 으로 cast 하던 회귀 해소 (Aatrox/Pyke/Poppy/Ivern/Mord/Leona/Gragas 동시)
  - 기존 동작 보존 (selected unit 은 동일 carry 패턴 사용, 단 카피만 있으면 raw fallback)
- **codex P1 amend (PR #144 amend)** — getAbilityConfigForUnit 만 가드한 결과 cast loop 의 `carryCfg = findCarryAugment(...)` 는 여전히 모든 카피에서 non-null. 즉 non-selected Aatrox 도 `carryCfg.augmentApiName === 'TFT17_Augment_AatroxCarry'` 매치 → cycle damage / N.O.V.A. effects 등 carry-specific 분기 진입 (Pyke recast / Poppy bounce / Ivern hexReduction / Mord proc 모두 동일). **해소**: `findSelectedCarryAugment(unit, augNames)` helper 신규 + cast loop 의 `findCarryAugment` 호출 3곳 (basic attack onAttackBonus / main cast carryCfg / OOR cast oorCarryCfg) 교체. `applyCarryAugmentRange` 는 `applyHeroCarryTransforms` 안의 rangeOverride 통합으로 deprecated — selected target 한정 자연스럽게 적용. 결과: getAbilityConfigForUnit + cast loop carryCfg + onAttackBonus + rangeOverride 모두 일관 selected 가드.
- **검증**: pnpm typecheck pass, 전체 suite 892/892 pass ✅
- **후속 sub-PR 계획** (carry-specific Layer 1 가드):
  - 14-A: Aatrox cycle counter / NOVA selector selectedCarryAugment 가드
  - 14-B: Pyke onKillRecast cascade 가드
  - 14-C: Poppy spiritBounceOnKill chain 가드
  - 14-D: Ivern hexReduction + multi-stun 가드 (`applyCarryDamageModifiers` / `applyCarryPostCastEffects` 의 augmentApiName 검사 → selectedCarryAugment 검사 변경)
  - 14-E/F/G: Mord/Leona/Gragas — 기존 dead flag deprecate + selectedCarryAugment 활용

### Test fix: Mordekaiser pre-existing 9 fail 해소 — 전체 suite 892/892 ✅ (PR #143)

- **Source**: PR #141/#142 작업 중 발견된 pre-existing 9 fail (Mordekaiser proc test). 변경 전 dev 도 동일 fail 확인 — 본 PR 들과 무관 누적 fail
- **원인 분석**:
  - `applyMordekaiserProcCast` line 951: `unit.mordekaiserCarryShield !== null` (strict !==) 가드 — `undefined !== null = true` 로 인해 array access TypeError
  - 원인: PR #124 (Mordekaiser shield/mana 17.3 정합) 시 `mordekaiserCarryShield: null` 필드 추가 했으나 **test fixture (`tests/unit/mordekaiser-proc.test.ts`) 갱신 누락**
- **해소 (2-layer)**:
  - **sim 코드 defensive 가드**: `!== null` (strict) → `!= null` (loose) — undefined 도 safe (`combatLoop.ts:951`)
  - **test fixture 갱신**: `tests/unit/mordekaiser-proc.test.ts` makeMordekaiserUnit fixture 에 `mordekaiserCarryShield: null` 추가 (raw 챔프 명시)
- **follow-up test 갱신** (sim 코드 변경의 후속 follow-up):
  - `tests/unit/simulator/heal-amp-integration.test.ts`: healAmp 곱셈 사이트 카운트 `14 → 15` (PR #141 OOR omnivamp heal 추가 반영)
  - `tests/unit/simulator/hero-augment-stat-system.test.ts`: Mordekaiser grep test regex `!== null` → `!= null`
- **검증**: 전체 suite **892/892 pass** ✅ (이전 883 pass / 9 fail → 892 pass / 0 fail)

### Sim fix: main pipeline omnivamp grievousReduction abilityTarget 사용 — Lint #16 ✅ resolved (PR #142)

- **Source**: PR #141 codex P2 amend 시 발견 (OOR fix 일관성 점검 중 main 의 동일 패턴 검출)
- **문제**: main pipeline (`combatLoop.ts:6907`) 의 omnivamp grievousReduction 도 `target.augmentGrievousWounds` 사용 — Aatrox/Pyke/IvernMinion carry 가 main pipeline dash 진입 시 retarget (to_target/to_lowest_hp/to_largest_cluster 등) 가능 → `target` (pre-dash) vs `abilityTarget` (dash 결과) 불일치 → 잘못된 unit 의 healing-reduction state 참조
- **변경**: `target.augmentGrievousWounds` → `abilityTarget.augmentGrievousWounds` (PR #141 OOR fix 와 동일 패턴)
- **검증**:
  - `pnpm typecheck` pass
  - `hero-carry-augments.test.ts` 16/16 pass (no regression)
  - 전체 test suite: 883 pass / 9 fail — **9 fail 은 pre-existing** (Mordekaiser proc test, 변경 전 dev 도 동일 fail 확인됨). 본 PR 변경과 무관
- **dash retarget abilityTarget 룰 main+OOR 양쪽 정합 완료**
- **메모리 룰 후보**: dash retarget 분기에서 grievousReduction / shield / debuff 등 target-specific state 참조 시 `target` (pre-dash) 가 아닌 `abilityTarget` (dash 결과) 사용 필수. main+OOR 양쪽 비대칭 점검 필요 (PR #129 cast path 3종 룰의 응용).

### Sim fix: OOR cast path omnivamp hook 추가 — Lint #15 ✅ resolved (PR #141 + codex P2 amend)

- **Source**: PR #140 Codex P2 amend 시 발견 (Jax damage omnivamp 정합 점검 중 OOR cast path 의 omnivamp hook 부재 검출)
- **문제**: main+OOR cast post-processing 비대칭
  - main pipeline (`combatLoop.ts:6906`): omnivamp hook 있음 (`if (unit.omnivamp > 0 && totalAbilityDmg > 0) { ... applyOmnivampHealWithMeleeShield }`)
  - OOR cast path (`combatLoop.ts:7341`): `triggerFountainHeal` 만 있고 **omnivamp 없음**
  - 결과: OOR cast (Talon/Corki dash, Warwick/MasterYi/Jax self_buff) 시 omnivamp heal 누락 — carry/non-carry 무관 dash/self_buff caster 의 흡혈 sim 미반영
- **변경**:
  - `combatLoop.ts:7340+` (OOR cast log 직후 + triggerFountainHeal 직전): main pipeline 와 동일 패턴 omnivamp hook 추가
  - `grievousReduction` + `healAmp` 모두 main 과 일관 적용
  - `applyOmnivampHealWithMeleeShield` 표준 helper 사용
- **영향 범위**: dash/self_buff cast 발동 챔프 다수
  - dash: Talon (line dash), Corki (to_farthest), Pyke (to_lowest_hp), Aatrox/Briar (to_target), Fizz (to_backline), IvernMinion (to_largest_cluster) 등
  - self_buff: Warwick, MasterYi, Teemo, Jax (JaxCarry), Zed (InvaderZed) 등
  - 모두 OOR cast 진입 가능 — omnivamp 아이템 (흡혈검 등) 보유 시 흡혈 sim 적용
- **검증**:
  - `pnpm typecheck` pass
  - 기존 16/16 test pass 유지 (regression 없음)
  - OOR cast path omnivamp 검증은 actual-data diff 또는 인게임 측정으로 후속 verify
- **codex P2 amend (PR #141 amend)** — grievousReduction 의 `target.augmentGrievousWounds` 사용은 OOR dash retarget (to_lowest_hp/to_farthest/to_backline 등) 시 잘못된 unit 참조. `target` = pre-dash 변수 (main loop findTarget 결과), 실제 damage 는 `abilityTarget` (dash 결과) 기준. → `abilityTarget.augmentGrievousWounds` 로 변경.
- **Lint #16 후보 등록**: main pipeline 의 동일 패턴 (`combatLoop.ts:6907` `target.augmentGrievousWounds`) 도 같은 잠재 버그 — Aatrox/Pyke/IvernMinion carry 가 main pipeline 에서 dash 진입 시 동일 retarget 가능. main+OOR 양쪽 abilityTarget 으로 변경 별도 PR.
- **메모리 룰 후보**: cast loop 의 main+OOR post-cast hook (omnivamp / Fountain / on_cast) 비대칭은 회귀 위험. main 에 hook 추가 시 OOR 도 동시에 추가 점검 필수 (cast path 3종 룰의 응용)

### Sim fix: JaxCarry damage self_buff + damage 양립 분기 — Lint #11-A ✅ resolved (PR #140 + codex P2 amend)

- **Source**: 위키 lint #11-A (JaxCarry damage 필드 self_buff 패턴 미반영, PR #132 검출)
- **설계 결정**: Option A 채택 — self_buff 패턴 + abilityData.damage 양립 분기 신규 추가
  - Option B (필드 dead 명시) 거부 — desc 와 sim 미스매치 유지하면 lint 종결 안 됨
  - Option C (abilityOverride pattern 변경) 거부 — selfBuff.attackSpeed + onAttackBonus 의도 깨짐
- **변경**:
  - `combatLoop.ts` main pipeline self_buff 분기 직후 (line 6953-7001 사이, 6952 다음): `unit.jaxCarryActive` + `carryCfg.abilityData.damage` 가드 시 target magic damage 적용
  - `combatLoop.ts` OOR cast path Illaoi result 직후 (line 7133+, abilityDmg 분기 전): 동일 패턴 (cast path 3종 룰 — PR #129 OOR 누락 회귀 가드). 처치 시 `markTargetDead` 직접 호출
- **표준 적용** (main cast loop 와 일관):
  - damageAmp + Tank 보너스 (invention/madreds/graves) + sniper + mfReplicator
  - spellCanCrit + critMultiplier
  - applyAbilityMitigation pipeline (resistance + DR + non-target reduction + shield + invul)
  - triggerSerpentPoison (별돌보미 뱀 강화 칸 ability 명중 시 중독)
  - totalAbilityDmg / totalRawAbilityDmg 누적 — omnivamp / Fountain heal / on_cast emit 일관
- **selected single-carry semantics** (PR #135 Layer 1 패턴): `unit.jaxCarryActive` 가드 — 다중 Jax 카피 시 selected 만 cast damage 적용
- **테스트** (`hero-carry-augments.test.ts` 1 case 추가, 전체 16/16 pass):
  - JaxCarry cast 시 target magic damage 적용 (totalDamageDealt > 0 + carry cast log 검출)
- **위키 cleanup**: jax-carry.md sim_active partial → active. Lint #11-A ✅ resolved 기록. damage 필드 ❌ → ✅
- **codex P2 amend (PR #140 amend)** — Jax damage 분기가 self_buff 분기 다음에 위치 (line 6953+) 했으나 main pipeline omnivamp/Fountain hook (line 6858-6866) 보다 **뒤에** 있어 Jax damage 가 omnivamp/Fountain heal 에 누락. **해소**: Jax damage 분기를 `applyCarryPostCastEffects` 직후 + omnivamp/Fountain hook 직전 (line 6857 즈음) 으로 이동. self_buff 분기는 그대로 (sequence 변경 무해 — selfBuff.attackSpeed 는 future attack 영향이라 cast damage 와 무관).
- **Lint #15 후보 등록**: OOR cast path 에 omnivamp hook 자체 부재 — `triggerFountainHeal` 만 있고 omnivamp 없음. main 와 OOR 의 cast post-processing 비대칭. 별도 PR (영향: dash/self_buff cast 의 omnivamp heal 모두 누락 — Talon/Corki/Warwick/MasterYi 등)
- **잔존**:
  - **MS (이동속도) gain** — abilityData movementSpeed 필드 없음. desc "AS/MS" 중 MS 부분 sim 미반영 (낮은 우선순위)
  - **statOverrides** 인게임 측정 (HP/AS base/range)

### Archive: docs/meta/ leftover 2 파일 — Phase 2 첫 정리

- **Source**: 사용자 요청 — docs/meta/ leftover 점진 정리
- **변경**:
  - `git rm docs/meta/nova-selector-ui-handoff.md` — PR #85/86/87 머지 완료, 작업 핸드오프 의의 종료
  - `git rm docs/meta/set17-gods-system.md` — "정확하지 않을 수 있음" 명시 추정 데이터. `docs/wiki/raw/lolchess/set17-yasuo-tiles.md` (lolchess.gg 공식 인게임 텍스트 기준) 가 ground truth 로 부분 대체
- **참조 갱신** (4건):
  - `docs/wiki/raw/README.md` — Archived 섹션 2 항목 추가
  - `docs/wiki/raw/lolchess/set17-yasuo-tiles.md` — archived 명시
  - `docs/meta/actual-data-brainstorm.md` — yasuo-tiles 로 대체 명시
  - `docs/superpowers/specs/2026-04-23-actual-data-design.md` — 선행 문서 갱신 (1건) + 참고 자료 archived 표시 (1건)
- **유지 (점진 ingest 별도 PR)**: set17-trait-audit / set17-meta-guide / diff-attribution (2) / opponent-carries-audit / sim-accuracy-followups / simulator-synergy-todos / actual-data-brainstorm / augment-management / tft-coach-app-idea / tft_deck_building / tft_item_abbreviations / user_tft_knowledge
- **메모리 사본 3 파일 유지** — 사용자 룰 `tft_memory_preference`: "TFT 관련은 로컬 메모리 대신 레포 docs/meta/ 에 저장"

### Refactor: docs/meta/wiki/ → docs/wiki/ relocate (Phase 1)

- **Source**: 사용자 요청 — LLM Wiki 구조 prominent 화
- **변경**:
  - `git mv docs/meta/wiki docs/wiki` — 폴더 전체 한 단계 상승. "meta" 계층 의미 모호 해결
  - 17 파일에서 25 ref 갱신 (sed 일괄): wiki 본문 (schema/log/traits/mechanics/augments) + CLAUDE.md + 코드/테스트 주석 + docs/meta leftover + docs/superpowers spec + 메모리 6 파일
  - `docs/meta/` 13 leftover (set17-trait-audit / set17-meta-guide 등) 는 점진 ingest 대상으로 그대로 유지 (Phase 2 후보)
- **PDCA artifact (01-plan/02-design/03-analysis/04-report)** 그대로 유지 — 사용자 결정: wiki 와 별개 process artifact
- **검증**: typecheck pass, hero-augment-stat-system.test.ts 97/97 pass
- **Karpathy 패턴 정합 향상**:
  - `docs/wiki/` 자체가 top-level prominent (이전 `docs/meta/wiki/` 의 "meta" 계층 제거)
  - 3-Layer 폴더 안에서 자연스럽게 표현: `docs/wiki/raw/` (Layer 1) + `docs/wiki/{traits,mechanics,augments,patches}/` (Layer 2) + `schema.md/index.md/log.md` (Layer 3)
- **후속 Phase 후보**:
  - Phase 2: `docs/meta/` 13 leftover 분류 + ingest
  - Phase 3: `docs/migration/`, `docs/todo/` 처리 (각 1 파일)
  - Phase 5 (선택): PDCA 완료 artifact 의 wiki cross-link

### Sim fix: JaxCarry asGain starLevel별 정합 — Lint #11-B ✅ resolved (PR #136 + codex P2 amend)

- **Source**: 위키 lint #11-B (JaxCarry asGain 필드 dead, PR #132 검출)
- **변경**:
  - `src/types/index.ts`: `jaxCarryActive: boolean` 필드 추가 (selected single-carry semantics)
  - `combatLoop.ts` 3 createCombatUnit site: `jaxCarryActive: false` 초기화
  - `applyHeroCarryTransforms` (line ~2270): JaxCarry 활성 시 selected unit 에 `jaxCarryActive = true` (leona/gragas/mord/nasus 패턴 동일)
  - `combatLoop.ts:6926-6938` (main pipeline selfBuff 분기): `unit.jaxCarryActive` + `carryCfg.abilityData.asGain` 시 `asGain[starLevel-1] ?? asGain[0]` 우선 read, fallback `config.selfBuff.attackSpeed`
  - `combatLoop.ts:7071-7081` (OOR cast path selfBuff 분기): 동일 패턴 (oorCarryCfg)
- **설계 결정**:
  - **selected single-carry semantics** (PR #135 codex P2 패턴) — `jaxCarryActive` flag 가드. 다중 Jax 카피 시 selected 1명만 starLevel별 정확 적용, non-selected 는 raw fallback
  - **cast path 3종 양쪽 일관** — main + OOR 둘 다 fix (PR #129 stun OOR 누락 같은 패턴 회귀 가드)
- **★3 +20% 의도 정합**: 이전 selfBuff.attackSpeed fixed 0.15 (모든 starLevel) → asGain [0.15, 0.15, 0.20] starLevel별 우선
- **테스트** (`hero-carry-augments.test.ts` 4 case 추가, 전체 15/15 pass):
  - augment 활성 → jaxCarryActive=true + role=Fighter
  - augment 미활성 → jaxCarryActive=false (raw Jax)
  - 다중 Jax 카피 (3성 + 2성) → 3성만 jaxCarryActive=true (selected single-carry semantics 회귀 가드)
  - **non-selected Jax 는 carry self_buff override 무시 (codex P2 amend 회귀 가드)** — final attackSpeed 가 raw 와 일치
- **위키 cleanup**:
  - `augments/jax-carry.md` asGain ❌ 미반영 → ✅ 활성. Lint #11-B resolved 기록. Lint #11-A 잔존 표기 유지
  - `index.md` Lint #11-B ✅ resolved
- **codex P2 amend (PR #136 amend)** — `getAbilityConfigForUnit` 자체가 모든 Jax 카피에 carry config 반환 → non-selected 도 self_buff 패턴 cast 진입 (raw aoe_circle stun 의도 위반). **해소**: `getAbilityConfigForUnit` 에 JaxCarry-only selected 가드 추가 (line 621-631) — non-selected Jax 면 raw `CHAMPION_ABILITY_PATTERNS` fallback. selfBuff 분기 가드는 defense-in-depth 로 유지.
- **Lint #14 등록 후보**: 다른 carry augment (Aatrox/Pyke/Poppy/Ivern/Zed/Mord 등) 도 동일 abilityOverride pollution 패턴 가능성. selected single-carry semantics 광범위 적용 필요 (별도 PR)
- **Lint #11-A 잔존** — damage[170,250,450] self_buff 패턴 미반영. 별도 PR (설계 결정 필요: single-target damage 분기 추가 vs 필드 dead 명시)

### Sim fix: NasusCarry bonusPerKill — Lint #12 ✅ resolved (PR #135 + codex P2 amend)

- **Source**: 위키 lint #12 (NasusCarry bonusPerKill 필드 dead, PR #132 검출)
- **변경**:
  - `src/types/index.ts:854-861`: `nasusBonkStack: number` 필드 추가 (Shen passive 패턴)
  - `combatLoop.ts` 3 createCombatUnit site: `nasusBonkStack: 0` 초기화
  - `combatLoop.ts:6549-6555` (cast loop markTargetDead 직후): NasusCarry 활성 + `unit.champion.apiName === 'TFT17_Nasus'` + `carryCfg.abilityData.bonusPerKill` 가드 시 `unit.nasusBonkStack++`
  - `combatLoop.ts:1334-1340` (`applyCarryDamageModifiers` modifier #6 추가): `baseDmg += unit.nasusBonkStack × bonusPerKill[starLevel-1]` (NasusCarry 한정)
- **설계 결정**:
  - **inline 분기 (Shen passive 패턴)** 채택 — eventBus listener 대신. cast site 1곳만 hook 으로 충분 (NasusCarry single pattern + OOR/recast 진입 불가)
  - cast loop site 한정 → basic attack kill 제외 (desc "이 스킬로 적을 처치하면" 정합)
  - applyCarryDamageModifiers 통합 helper 에 modifier #6 추가 → main + OOR caller 2 site 자동 일관 (다만 OOR 진입 불가하니 main only)
- **호출 순서**: 단독 적중 → secondary → tankBonus → armorScale → hexReduction → **bonusPerKill** (마지막 — base + scale 후 영구 buff raw 가산 의미)
- **Invariant**: `nasusBonkStack ≤ killCount` (cast kill 만 누적, basic attack kill 제외)
- **codex P2 catch (PR #135 amend)** — `findCarryAugment` 는 champion api 매치하는 **모든 Nasus 카피** 에 NasusCarry config 반환하나 `applyHeroCarryTransforms` 는 "가장 강한 1명" 만 carry transform. 초기 fix 는 `champion.apiName === 'TFT17_Nasus'` 가드만 → non-selected 카피도 stack 누적 → 의도 위반. **해소**: `nasusCarryActive: boolean` flag 추가 (leona/gragas/mordekaiser 패턴), `applyHeroCarryTransforms` 에서 selected unit 에만 set, 두 read site 가드를 `unit.nasusCarryActive` 로 변경.
- **테스트** (`hero-carry-augments.test.ts` 4 case 추가, 전체 11/11 pass):
  - 초기값 nasusBonkStack >= 0 + role='Fighter' 정합
  - cast kill 시 stack ≤ killCount invariant 유지
  - **다중 Nasus 카피 시 selected 1명만 nasusCarryActive (codex P2 회귀 가드)**
  - augment 미활성 (raw Nasus) → stack = 0
- **위키 cleanup**:
  - `augments/nasus-carry.md` sim_active partial → active. Lint #12 resolved 기록. bonusPerKill ❌ 미반영 → ✅ 활성
  - `index.md` Lint #12 ✅ resolved 표기
- **후속**:
  - Lint #11-A/B (Jax damage + asGain) sim 해소 — 다음 PR 후보
  - Lint #13 (Zed) — spec 확인 대기
  - Lint #5 잔존 (Nasus Resists 40→45 인게임 verify) — 사용자 측정 후

### Ingest: augments/ivern-minion-carry.md — 5단계 워크플로우 + 신규 lint 0건 (augments 폴더 완성)

- **Source** (5단계 워크플로우 적용):
  - `src/data/carryAugments.ts:188-204` (IvernMinionCarry entry)
  - `src/lib/simulator/systems/augment.ts:58` (tier='gold')
  - `combatLoop.ts:694-711` (findLargestClusterTarget — cluster radius 2 hex 알고리즘)
  - `combatLoop.ts:713-758` (applyAbilityDash to_largest_cluster 분기, line 734)
  - `combatLoop.ts:1226-1252` (applyCarryPostCastEffects — multi-stun IvernMinionCarry 한정 분기)
  - `combatLoop.ts:1326-1331` (applyCarryDamageModifiers — hexReduction multiplicative falloff IvernMinionCarry 한정)
  - `combatLoop.ts:5618-5660` (onAttackBonus passive — Jax 와 공유 helper)
  - `combatLoop.ts:6820-6824` (IvernMinion abilityOverride.stun 없음 → applyCarryPostCastEffects 별도 분기)
- **5단계 워크플로우 적용 결과**:
  1. 좁은 grep: IvernMinionCarry / to_largest_cluster / hexReduction / spiritEffectPerStack
  2. 함수 컨텍스트: `findLargestClusterTarget` (각 alive 적 중심 radius 2 카운트 → max), `applyCarryPostCastEffects` (caller 2 site main+OOR), `applyCarryDamageModifiers` (5 modifier 통합)
  3. **entity-wide grep `Ivern`**: 4 specific 적용 위치 발견 — dash helper + hexReduction modifier + multi-stun post-cast + onAttackBonus (Jax 공유). 모두 의도된 분리 (drift 아님)
  4. 호출 순서·cast path: dash + hexReduction + multi-stun 모두 helper 통합 → main + OOR 양쪽 일관. PR #76 (multi-stun OOR 누락 회귀 자동 해소) 효과 검증
  5. actual integration verify: 6 필드 (damage/onAttackBonus/hexReduction/stunDuration/dash/spiritEffectPerStack) 모두 read 위치 확인
- **✅ 신규 lint 검출 0건** — PR7-B (17.2b dash to_largest_cluster + aoe_circle r=3 + multi-stun) + PR #76 (helper 통합) + PR #115 (17.3 hexReduction 정합) 누적 fix 효과적.
- **🔍 후속 verify 항목**:
  - 17.3 패치노트 IvernMinion 다른 변경분 (damage / onAttackBonus / stunDuration 변경 여부) verify
  - desc "2칸 내 가장 큰 적 무리에 도약" 해석 — sim 은 cluster 정의 (radius 2 hex) 로 구현. desc 가 "Ivern 으로부터 2칸" 의미일 가능성 → 사용자 의도 확정 필요
  - statOverrides 인게임 측정
- **✅ augments 폴더 완성** — 10 carry augments (Leona/Mord/Gragas/Aatrox/Pyke/Jax/Nasus/Zed/Poppy/Ivern) 전체 위키화 완료
- **다음 후보**:
  - Lint #11-A/B (Jax damage 미반영 + asGain dead) sim 해소 PR
  - Lint #12 (Nasus bonusPerKill dead) sim 해소 PR
  - Lint #13 (Zed augment 실효성 0) sim 해소 PR
  - 챔피언 페이지 진입 (Annie / Galio / Shen / Yasuo)
  - `mechanics/ability-pattern-internals` — 9 pattern 알고리즘 + dash helper 깊이

### Ingest: augments/poppy-carry.md — 5단계 워크플로우 + 신규 lint 0건 (가장 통합 완성도 carry)

- **Source** (5단계 워크플로우 적용):
  - `src/data/carryAugments.ts:150-169` (PoppyCarry entry)
  - `combatLoop.ts:549-554` (applyCarryAugmentRange — rangeOverride 4)
  - `combatLoop.ts:1288-1333` (applyCarryDamageModifiers — armorScale 분기 4번째)
  - `combatLoop.ts:6231-6233` (spiritEffectPerStack — main pipeline only)
  - `combatLoop.ts:6526-6530` (cast loop 사망 처리 overkill 캡처, clamp 전)
  - `combatLoop.ts:6648-6680` (spiritBounceOnKill bouncing loop — main only, MAX 50)
  - `combatLoop.ts:873-920` (applyPoppyShieldAndResists — Set 17 Poppy raw passive, augment 무관, 2 cast path 호출)
- **5단계 워크플로우 적용 결과**:
  1. 좁은 grep: PoppyCarry / rangeOverride / armorScale / spiritBounceOnKill
  2. 함수 컨텍스트: `applyCarryDamageModifiers` (5 modifier 통합 helper, caller 2 site main+OOR), `applyCarryPostCastEffects` (multi-stun/Akali burn 통합)
  3. **entity-wide grep**: `Poppy` 이름 자체 → `applyPoppyShieldAndResists` 별도 helper 발견 (raw Set 17 Poppy passive, augment 와 별개 작동). multi-source 의도된 분리 — drift 아님
  4. 호출 순서/cast path: spiritBounceOnKill 이 main only 인 것 검토 → PoppyCarry abilityOverride `{ pattern: 'single' }` 만, dash/self_buff 둘 다 없음 → **OOR 진입 불가** 확인 (`combatLoop.ts:6977-78` canDashCast 가드) → main only 정합
  5. actual integration verify: 5 필드 (rangeOverride/damage/armorScale/spiritEffect/spiritBounce) 모두 main pipeline read 위치 확인
- **✅ 신규 lint 검출 0건** — PoppyCarry 는 carry augment 중 가장 많은 메커니즘 (range/armorScale/spiritEffect/spiritBounce + raw passive) 이 모두 sim 도달. PR7-D / codex P1 PR #75 (overkill clamp 회귀) / codex P1 #76 (다른 OOR 누락 회귀 자동 해소 helper 통합) 누적 fix 가 효과적.
- **Lint #5 잔존** — AS 0.7→0.75 인게임 verify (`carryAugments.ts:154-155` TODO 주석). 사용자 측정 후 statOverrides.attackSpeed 채움.
- **후속**:
  - augments 나머지 1개 (IvernMinion) ingest — multi-stun (`applyCarryPostCastEffects` line 1232) 이 이미 잘 통합되어 추가 lint 검출 가능성 낮으나 entity-wide grep 으로 검증
  - Lint #5 잔존 — 사용자 측정 대기

### Ingest: augments/jax-carry.md + augments/nasus-carry.md + invader-zed.md — 5단계 워크플로우 + Lint #11/#12/#13 신규 검출

- **Source** (5단계 워크플로우 적용):
  - `src/data/carryAugments.ts:113-129` (NasusCarry), `:205-218` (JaxCarry), `:274-286` (InvaderZed)
  - `src/lib/simulator/engine/combatLoop.ts:618-622` (getAbilityConfigForUnit), `:2220-2267` (applyHeroCarryTransforms role='Fighter')
  - `combatLoop.ts:5618-5660` (onAttackBonus passive — Jax)
  - `combatLoop.ts:6146-6149` (self_buff carry damage override 미적용 주석), `:6226` (rawAbilityDmgBase=0 강제)
  - `combatLoop.ts:6885-6891` (config.selfBuff stat 적용 — selfBuff undefined 시 skip → InvaderZed 효과 0)
  - `combatLoop.ts:1565-1582` (applyZedShadow — augment 무관, trait `TFT17_ZedUniqueTrait` 기반 +40% AD)
  - `src/lib/simulator/systems/ability.ts:251` (TFT17_Zed raw `{ pattern: 'self_buff' }` 분신 stat-only)
  - entity-wide grep `Jax` / `Nasus` / `Zed` → specific helper 함수 부재 확인
- **5단계 워크플로우 적용 결과**:
  1. 좁은 grep: JaxCarry / NasusCarry / InvaderZed → carryAugments.ts entry lookup
  2. 함수 컨텍스트 read: `getAbilityConfigForUnit` (carry.abilityOverride 직접 반환), `resolveAbilityDamage` (self_buff 패턴 미반영), `config.selfBuff` 적용 분기
  3. **entity-wide grep**: `Jax` / `Nasus` / `Zed` 이름 자체 → Jax 는 onAttackBonus passive (line 5618-) 만 별도, Nasus 는 specific helper 0건, Zed 는 trait 기반 applyZedShadow (augment 무관)
  4. 호출 순서/영향 trace: self_buff cast path 가 main + OOR 양쪽 일관 (PR #98 codex P1 회귀 가드). recast 무관 (Pyke 전용)
  5. **actual sim integration verify (결정적)**: `grep "asGain\|bonusPerKill" src/` → carryAugments.ts entry 외 read 위치 **0건** → Jax `asGain`, Nasus `bonusPerKill` 필드 dead 검출. self_buff 패턴 + damage 필드 미반영 (Jax/Zed) 추가 검출
- **⚠️ Lint finding #11-A 검출 — JaxCarry `damage` 필드 sim 미반영**:
  - carryAugments.ts:213 `damage: [170, 250, 450]` + desc "사용: 대상 magic damage" vs combatLoop.ts:6226 self_buff 패턴 rawAbilityDmgBase=0 강제
  - 17.3 patch entry 정합 (PR #115 같은 정합) 만 진행, sim 효과 도달 안 함
- **⚠️ Lint finding #11-B 검출 — JaxCarry `asGain` 필드 dead**:
  - carryAugments.ts:215 `asGain: [0.15, 0.15, 0.20]` 정의되어 있으나 read 위치 0건
  - selfBuff.attackSpeed 0.15 fixed 가 starLevel 분기 없이 대체 → **★3 의도 +20% vs 실제 +15%** (starLevel별 mismatch)
- **⚠️ Lint finding #12 검출 — NasusCarry `bonusPerKill` 필드 dead**:
  - carryAugments.ts:127 `bonusPerKill: [10, 13, 20]` + desc "처치 시 영구 증가" vs read 위치 0건
  - scalingInput "처치 수 / 피해량 +10" UI 표시만, sim 효과 도달 안 함
- **⚠️ Lint finding #13 검출 — InvaderZed augment 실효성 거의 0**:
  - abilityOverride `{ pattern: 'self_buff' }` 만 정의, **selfBuff 필드 부재** → cast 시 stat 변경 0
  - damage `[300, 450, 720]` 정의되어 있으나 self_buff 패턴이라 미반영
  - 실제 sim 효과 = role='Fighter' + mana 50/100 뿐 (raw Zed trait `applyZedShadow` 의 +40% AD 는 augment 무관)
- **메모리/워크플로우 변경 없음** — 5단계 워크플로우 그대로 적용. Lint #11-B 가 starLevel별 mismatch 패턴 (Lint #9 같은) 재발견 — actual sim integration verify (Step 5) 가 핵심 검출 단계.
- **후속 작업 후보**:
  - Lint #11-A/B sim 해소 PR — selfBuff.attackSpeed 를 starLevel별 array 화 + asGain read site 추가 (or 필드 dead 정리)
  - Lint #12 sim 해소 PR — on_kill eventBus listener + `nasusBonkStack` 누적 + cast damage stack 가산 (Shen passive 패턴)
  - Lint #13 sim 해소 PR — InvaderZed 의도된 메커니즘 spec 확인 후 abilityOverride.selfBuff 또는 statOverrides 추가
  - augments 나머지 2개 (Poppy / IvernMinion) ingest

## 2026-05-18

### Ingest: augments/aatrox-carry.md + augments/pyke-carry.md — 5단계 워크플로우 누적 적용 + Lint #10 검출
- **Source** (5단계 워크플로우 적용):
  - `src/data/carryAugments.ts:129` (AatroxCarry) / `:216` (PykeCarry)
  - `src/lib/simulator/engine/combatLoop.ts:6173` (Aatrox cycleIdx % 3 분기)
  - `combatLoop.ts:6195` (slamDamage cycle 2), `:6713-6727` (novaDamage 추가 발동), `:1306` (singleTargetMultiplier 적용), `:4553-4593` (aatroxNovaStrikeSelector setup)
  - `combatLoop.ts:6544-6580` (Pyke onKillRecast cascade max 5 chain)
  - `combatLoop.ts:1275` (Pyke tankBonusMultiplier)
  - `src/lib/simulator/systems/ability.ts:339` (x_shape pattern algorithm)
  - entity-wide grep `Aatrox` / `Pyke` 로 multi-source drift 부재 확인
- **5단계 워크플로우 누적 적용 (메모리 룰)**:
  1. 좁은 grep: AatroxCarry / PykeCarry → entry lookup
  2. 함수 컨텍스트 read: cycle 분기 함수 + cascade loop 함수
  3. **entity-wide grep**: `Aatrox` / `Pyke` 이름 자체 → cycle/cascade specific 처리 발견. multi-source drift 없음 확인
  4. 호출 순서/영향 trace: cycle/onKill 처리가 main pipeline 내부 inline (Mordekaiser proc 같은 separate helper 없음)
  5. actual sim integration verify: novaDamage / slamDamage / singleTargetMultiplier / onKillRecast 모두 main pipeline read 위치 확인
- **⚠️ Lint finding #10 검출 (위키 검출 10번째 사례)**:
  - `mechanics/hero-augment-carry.md` "❌ 미완" 섹션의 "Pyke X-shape onKill 재시전 — onKill hook 분기 필요" 표기가 **stale**
  - 실제: PR7-A (17.2b 후속) 이 이미 `combatLoop.ts:6544-6580` cascade 구현 완료. max 5 chain + tankBonus + secondaryDamage 정합
  - 본 PR 에서 부분 정정 (해당 줄에 obsoleted + 실제 위치 명시). 더 깊은 cleanup 은 후속 PR 후보
- **cast path 3종 후속 verify 항목 등록** (PR #129 sub-rule 적용):
  - Aatrox cycle 분기가 OOR cast path 에 일관 적용되는지
  - Pyke x_shape + onKillRecast 가 OOR cast path 에 일관 적용되는지
  - **확정 검출 아님** — 본 페이지의 "Cast path 전수 확인" 표에 후속 verify 항목으로 등록
- **위키 lint 누적 (10건, 6건 full-cycle)**:
  1~9: 기존
  10. **`hero-augment-carry.md` "Pyke onKill 미구현" stale 표기** — 본 PR 부분 정정, 후속 cleanup PR 후보

### Lint resolved: stunDuration starLevel별 main pipeline 반영 (Lint finding 9 closed)
- **Trigger**: PR #129 (`8abbba0`) 머지 완료 — 직렬 워크플로우
- **위키 lint 사이클 완결 사례 (6번째 full-cycle)**:
  - PR #128 wiki cleanup 중 Codex P2 catch — Lint #9 검출 ("starLevel별 stun sim 정합" 주장이 entry 정합 뿐, main pipeline 미read)
  - PR #129 — Option A 채택. main pipeline 분기 확장 (`carryCfg?.abilityData?.stunDuration?.[starLevel-1] ?? config.stun`)
  - PR #129 추가 Codex P2 catch — **OOR (out-of-range dash) cast path 누락** → main + OOR 양쪽 fix amend
  - 본 cleanup PR — 위키 표기 drift → resolved
- **위키 갱신 내역**:
  - `augments/leona-carry.md` — `sim_active: partial → active`. Lint #6 + #9 모두 resolved. 패치 히스토리 PR #129 row + Lint #9 섹션 (Codex P2 amend 컨텍스트 + workflow 룰 도입 배경 명시)
  - `mechanics/hero-augment-carry.md` Leona row — Lint #6 + #9 모두 resolved + starLevel별 stun sim 적용 명시
  - `index.md` Leona description — Lint #6 + #9 resolved + main/OOR cast path 양쪽 fix 명시
- **5단계 워크플로우 룰 도입 배경 — PR #129 amend 가 근거**:
  - "cast path 3종 전수 확인" sub-rule (호출 순서 trace step 4 보강) — 위키 [[ability-targeting]] 의 "3 호출처 (main / recast / OOR fallback)" 정보를 fix workflow 도우미로 통합
- **sim 정확도 개선 (positive impact)**:
  - LeonaCarry starLevel별 stun [1.0, 1.25, 1.5] sim 적용 (main + OOR cast path 양쪽). 1성 변경 없음, 2★ 1.0→1.25, 3★ 1.0→1.5
- **위키 lint 누적 (9건, 본 PR 후 6건 full-cycle 완결)**:
  1~3: documented/resolved
  4. Ability dead code triad — full-cycle ✅
  5. carryAugments 17.3 drift — full-cycle ✅ (단 Mordekaiser 실제 미반영은 #7)
  6. LeonaCarry duplicate config — full-cycle ✅ (PR #127 + #128). 단 stunDuration starLevel별은 #9 로 분리 → 본 PR 로 완결
  7. Mordekaiser carry source drift — full-cycle ✅
  8. GragasCarry duplicate + radius shadow — full-cycle ✅
  9. **stunDuration starLevel별 main pipeline 미반영 — full-cycle ✅ (PR #129 main+OOR + 본 PR)**

### Lint resolved: LeonaCarry duplicate config + GragasCarry duplicate/radius shadow (Lint #6 + #8 동시 closed)
- **Trigger**: PR #127 (`9e6ddb3`) 머지 완료 — 직렬 워크플로우
- **위키 lint 사이클 완결 사례 — 4번째/5번째 full-cycle (동시 해소)**:
  - PR #123 → Lint #6 검출 (LeonaCarry duplicate const)
  - PR #126 → Lint #8 검출 (GragasCarry duplicate + radius shadow bug — 적군 AOE 무력화)
  - PR #127 → Option B 채택. `LEONA_CARRY_ABILITY` + `GRAGAS_CARRY_ABILITY` const 둘 다 제거 + `getAbilityConfigForUnit` flag 우선 분기 우회 → `carryAugments.ts` entry 단일 source. **동시 해소**.
  - 본 cleanup PR — 두 페이지 (leona-carry.md + gragas-carry.md) drift → resolved 표기
- **위키 갱신 내역**:
  - `augments/leona-carry.md` — Lint #6 → resolved + 패치 히스토리 PR #127 row + sim 적용 상태 `partial → active` + Lint 체크리스트 [x]
  - `augments/gragas-carry.md` — Lint #8 (sub-A + sub-B) → resolved + 패치 히스토리 PR #127 row + sim 적용 상태 `partial → active` (적군 AOE 정상 작동) + Lint 체크리스트 [x][x][x]
  - `mechanics/hero-augment-carry.md` 표 Leona/Gragas row 갱신 (Lint resolved 표기)
  - `index.md` Augments 섹션 갱신 + 우선순위 갱신 (augments 나머지 7개 + flag dead 정리)
- **scope strict 보존 (CLAUDE.md)**: `gragasCarryActive` / `leonaCarryActive` flag 자체는 보존 — 테스트 assertion 8건 호환. flag 자체 dead 정리 (sim 코드 사용처 0) 는 별도 PR 후보 → 우선순위 2번 등록
- **sim 정확도 개선 (positive impact)**:
  - LeonaCarry: stun 1.5 (const) → 1.0 (entry config fixed). ⚠️ **PR #128 Codex P2 catch**: 본 entry 의 "starLevel별 stun 정합" 표기 부정확 — main pipeline 이 `config.stun` fixed 만 read, `abilityData.stunDuration` 은 IvernMinion 분기에서만 사용. **starLevel별 stunDuration 미반영 → Lint #9 신규 등록 (별도 sim 정확도 PR 후보)**
  - GragasCarry: 적군 AOE 반경 3칸 정상 작동 (이전 무력화) — hexReduction 0.45 + tankBonus 0.60 정확 적용
- **위키 lint 누적 (9건, 본 PR 후 5건 full-cycle + 1건 신규)**:
  1~3: documented/resolved
  4. Ability dead code triad — full-cycle ✅
  5. carryAugments 17.3 drift — full-cycle ✅ (단 Mordekaiser 실제 미반영은 #7 에서 발견)
  6. **LeonaCarry duplicate config — full-cycle ✅ (PR #127 + 본 PR). 단 stunDuration starLevel별 적용은 후속 Lint #9 로 분리**
  7. Mordekaiser carry source drift — full-cycle ✅ (PR #124 + #125)
  8. **GragasCarry duplicate + radius shadow — full-cycle ✅ (PR #127 + 본 PR)**
  9. **stunDuration starLevel별 main pipeline 미반영 (PR #128 Codex P2 검출)** — config.stun fixed read, abilityData.stunDuration 은 IvernMinion 분기 전용. LeonaCarry 의 starLevel별 stun [1.0/1.25/1.5] 의도 미반영. **별도 sim 정확도 PR 후보**

### Ingest: augments/gragas-carry.md — 2 lint findings 동시 검출 (Lint #8 sub-A + sub-B)
- **Source** (`feedback_wiki_ingest_verify` 4단계 워크플로우 적용 — entity-wide grep 핵심):
  - `src/data/carryAugments.ts:254` (GragasCarry entry — abilityOverride radius 3)
  - `src/lib/simulator/engine/combatLoop.ts:604` (GRAGAS_CARRY_ABILITY const — radius 0) — entity-wide grep `"Gragas"` 로 발견
  - `combatLoop.ts:626` getAbilityConfigForUnit flag 우선 분기
  - `combatLoop.ts:6259-6299` 자폭 self damage + 적군 AOE inline 분기 (함수 컨텍스트 read)
  - `combatLoop.ts:2264` applyHeroCarryTransforms gragasCarryActive set
- **⚠️ Lint finding #8 (2 sub-findings 동시)**:
  - **Sub-A (LeonaCarry #6 와 동일 패턴)**: `GRAGAS_CARRY_ABILITY` const `radius: 0` vs `carryAugments.ts:GragasCarry.abilityOverride.radius: 3` — 두 source 다른 값
  - **Sub-B (sim 정확도 큰 갭)**: main cast pipeline line 6288 `const aoeRadius = config.radius ?? 3` 에서 `0 ?? 3 = 0` (0 은 nullish 아님). `dist > 0` 인 모든 적 skip → **caster 같은 hex 적군만 hit (사실상 0명)** → patch note "반경 3칸 magic damage" 의도 무력화. PR4 (17.2b 후속) 가 적군 AOE 코드 추가했지만 radius 0 때문에 비활성. carryAugments entry `radius: 3` 의도 sim 미반영
- **Mordekaiser pattern (#7) 과 비교**:
  - GragasCarry: LeonaCarry duplicate const 패턴 (#6) + radius shadow 결과 더 심각 (적군 AOE 무력화)
  - 다행히 source drift (raw vars vs carryAugments) 패턴은 없음 — `applyGragasCast` / `tickGragas` 같은 specific helper 없음. main cast pipeline inline 분기 (line 6259-6299) 가 carryAugments abilityData 직접 read
- **권장 조치** (별도 sim 정확도 PR — index.md 우선순위 1번 등록):
  - **옵션 B 권장**: `LEONA_CARRY_ABILITY` + `GRAGAS_CARRY_ABILITY` const 둘 다 제거 + flag 경로 우회 → carryAugments entry 단일 source. **Lint #6 + #8 동시 해소**
- **Cross-ref 갱신**:
  - `mechanics/hero-augment-carry.md` Gragas row — Lint #8 명시 + [[gragas-carry]] 링크
  - `index.md` Augments 섹션 [[gragas-carry]] 추가 + 우선순위 1번 갱신 (#6+#8 통합 PR 강조)
- **위키 lint 누적 (8건, 3건 full-cycle 완결)**:
  1~5: documented/resolved (4 full-cycle)
  6. LeonaCarry duplicate config — open
  7. Mordekaiser carry source drift — full-cycle ✅
  8. **GragasCarry duplicate config + radius shadow bug — 본 PR 검출, sim 정확도 PR 후보 (Lint #6 와 동시 해소 권장)**
- **entity-wide grep 룰 가치 누적 검증 (3번째)**:
  1. PR #123 Mordekaiser drift 검출 (룰 도입 배경)
  2. PR #124 메모리 적용 후 fix
  3. **본 PR Gragas duplicate + radius shadow 검출** (메모리 룰 enforcement 효과 — 같은 lint cycle 빠른 검출)

### Lint resolved: Mordekaiser carry source-of-truth drift (Lint finding 7 closed)
- **Trigger**: PR #124 (`3678add`) 머지 완료 — 직렬 워크플로우
- **위키 lint 사이클 완결 사례** (도입 후 3번째 full-cycle):
  - PR #123 augments/mordekaiser-carry.md ingest 중 Codex P2 catch — `applyMordekaiserProcCast` 가 raw vars 직접 read → PR #115 미반영 검출 (multi-source drift)
  - PR #124 — Option A 구현: `CombatUnit.mordekaiserCarryShield` 필드 + `applyHeroCarryTransforms` 가 carry abilityData.shield override 저장 + statOverrides mana 적용
  - PR #124 추가 Codex P2 catch — 절대값 mana override 가 item bonus 손실. amend 로 item delta 보존 로직 추가 (`feedback_wiki_ingest_verify` 의 "호출 순서/영향 trace" 룰 도입 배경)
  - 본 cleanup PR — 위키 표기 drift → resolved
- **위키 갱신 내역** (커밋 `c6d9e75`):
  - `augments/mordekaiser-carry.md` — "Multi-source drift" → "✅ resolved (PR #124)" + 패치 히스토리 PR #124 row + sim 적용 상태 partial → active + Lint #7 fix 5단계 명시 + 회귀 가드 3건 명시 + Lint 체크리스트 shield/mana 정합 [x]
  - `mechanics/hero-augment-carry.md` Mordekaiser row: statOverrides ❌ → ✅ + shield/mana sim 정합 명시. statOverrides 채움 정책 노트 보강
- **위키 lint 가치 검증 누적 (7건, 3건 full-cycle 완결)**:
  1~3: documented/resolved
  4. AbilityTargetingType triad dead code → resolved (PR #117/118/119/120)
  5. carryAugments 17.3 drift → resolved (PR #115/116) — **단 Mordekaiser 항목은 실제 미반영이었음 (#123 검출, #124 fix)**
  6. LeonaCarry duplicate config — PR #123 open (sim 클린업 후보)
  7. **Mordekaiser carry source drift — PR #124 + 본 cleanup PR 로 full-cycle 완결 ✅**

### Ingest: augments/leona-carry.md + augments/mordekaiser-carry.md — augments 폴더 정립
- **Source** (`feedback_wiki_ingest_verify` + 함수 컨텍스트 룰 적용):
  - `src/data/carryAugments.ts:171` (LeonaCarry entry) / `:238` (MordekaiserCarry entry)
  - `src/lib/simulator/engine/combatLoop.ts:614` (LEONA_CARRY_ABILITY const) — 함수 컨텍스트 read 로 발견
  - `src/lib/simulator/engine/combatLoop.ts:622-630` (getAbilityConfigForUnit flag 우선 분기 — duplicate config inconsistency 원인)
  - `src/lib/simulator/engine/combatLoop.ts:2249-2250` (applyHeroCarryTransforms leonaCarryActive set)
  - 공식 17.2 / 17.3 패치노트
- **선정 이유**: 10 carry augment 중 가장 패치 변경 많은 2개 (17.2 도입 → 17.2b → 17.3 3회 변경)
- **augments/ 폴더 컨벤션 정립** (schema.md 의 `augments/<id>.md` 첫 entry)
- **⚠️ 신규 Lint finding (위키 검출 6번째 사례) — LeonaCarry duplicate config inconsistency**:
  - `combatLoop.ts:614` `LEONA_CARRY_ABILITY` const `stun: 1.5`
  - `carryAugments.ts:171` `LeonaCarry.abilityOverride` `stun: 1.0`, abilityData `stunDuration: [1.0, 1.25, 1.5]` starLevel별
  - `getAbilityConfigForUnit:626` 가 `leonaCarryActive` flag 우선 분기 → legacy const 우선
  - 결과: starLevel별 stun duration 의도 (`[1.0, 1.25, 1.5]`) 가 sim 에 반영 안 됨. 1성/2성도 1.5초 적용
  - → 별도 sim 클린업 PR 후보 (옵션 A: const 제거 + flag 경로 우회 / 옵션 B: const 가 abilityData 참조 동적화)
  - **GragasCarry 도 동일 패턴 추정** (`GRAGAS_CARRY_ABILITY` const + `gragasCarryActive` flag) — 다음 PR (GragasCarry 페이지) 에서 verify
- **함수 컨텍스트 룰 가치 검증**: `grep LEONA_CARRY_ABILITY` 만 보고 const 정의 발견 → `getAbilityConfigForUnit` 함수 전체 read 로 flag 우선 분기 인식 → duplicate inconsistency 검출. 메모리 `feedback_wiki_ingest_verify` 의 "함수 컨텍스트 read" 룰이 정확히 작동
- **부수 갱신 — hero-augment-carry.md 표**:
  - LeonaCarry row: `baseDamageHpFrac 0.28` (drift) → `0.24` (17.3) + duplicate config lint 명시 + [[leona-carry]] 링크
  - MordekaiserCarry row: shield/mana 17.3 값 명시 + passive 미반영 명시 + [[mordekaiser-carry]] 링크
- **Cross-ref**:
  - `index.md` Augments 섹션 활성화 (_미작성_ → 2 entries)
  - `index.md` 작성 우선순위 갱신 (augments 나머지 8개로 1순위 — Gragas duplicate verify 가치 강조)
- **위키 lint 누적 (6건)**:
  1~5: 기존 (Fountain memory / "8 영웅 증강" / CLAUDE.md weight / dead code triad / carryAugments drift)
  6. **본 ingest — LeonaCarry duplicate config inconsistency**

### Ingest: patches/patch-17-2.md — Set 17 메이저 패치 계보 완결
- **Source** (`feedback_wiki_ingest_verify` 워크플로우):
  - 공식 17.2 패치노트 (URL 동일, 17.2 LIVE 본문 + 17.2b mid-patch 섹션 분리 추출)
  - `public/data/tft_set17_augments.json` (Mordekaiser/Gragas/Leona Carry raw entry verify — line 168/584/66)
  - `src/data/carryAugments.ts` (sim entry verify — line 238/254/171)
- **합성 범위**:
  - Trait 7카테고리 (Anima/Arbiter/Brawler/Challenger/Mecha/Psionic/Meeple/Stargazer/Timebreaker 리워크)
  - Champion ~30건 (1~5코 tier 별)
  - 신규 augment 5건 — **carry augment 3종 (Heat Death/Self-Destruct/Shieldmaiden) 게임 도입 시점** (sim 정식화는 17.2b)
  - 조정 augment ~20건, item/artifact emblem nerf 다수
  - System (Opening Encounters 리워크, Augment Distribution, God Armory, Loot)
  - Bug fixes 30+ (sim 관련 발췌)
- **패치 계보 명확화**:
  - 17.1 (Set 17 출시) → **17.2 (본 페이지)** → 17.2b → 17.3
  - 17.2 = carry augment 게임 도입 vs 17.2b = sim 정식화 — 두 시점 분리 명시
- **Cross-ref**:
  - `mechanics/stargazer-fountain.md` 패치 히스토리 17.2 LIVE row → `[[patch-17-2]]` 링크 + 공식 "Fountain pattern temporarily disabled" 인용
  - `patches/patch-17-2b.md` 도입부 → `[[patch-17-2]]` 부모 링크
  - `index.md` Patches 섹션 + 우선순위 갱신 (patch-17-2 완료 → augments 개별 페이지 1순위)
- **검증 / 미확정 항목**:
  - 17.2 LIVE 정확 날짜 — 공식 페이지 명시 없음
  - 챔프 stat ~30건 sim 코드 정합 — 위키 차원 일괄 verify 안 함 (PR #107 직전 PR 들 추정)
  - Divine Amendment augment sim 적용 상태
  - New Recruit 17.2 (team size+1 + 3 four-costs) vs 17.2b (four-costs 3→1) — `tft_set17_augments.json:8380` 신병 entry 가 17.2b 최종값인지 verify

### Ingest: mechanics/spell-crit.md
- **Source** (`feedback_wiki_ingest_verify` 워크플로우 — 코드 직접 grep 우선):
  - `src/lib/combat/spellCrit.ts` (computeSpellCanCrit / SPELL_CRIT_ITEMS / expectedSpellCritMultiplier / SPELL_CRIT_UNLOCK_BONUS)
  - `src/lib/simulator/engine/combatLoop.ts` (3 cast crit roll + 운명술사/Akali/Graves unit-level 분기)
  - `src/lib/analysis/itemOptimizer.ts:268-273` (estimateDps AP 분기 spellCritMul)
  - `src/lib/analysis/itemRecommender.ts:140` (flatStatBonus +400 프리미엄)
  - PDCA `docs/01-plan/features/spell-crit-mechanic.plan.md` (도입 시점/동기 기록용)
  - PDCA `docs/02-design/features/spell-crit-mechanic.design.md` (구조 참고)
- **합성 범위**:
  - 활성 조건 3 카테고리 (아이템 6종 / 시너지 / unit-level effect)
  - sim 3 cast 경로 crit roll 코드 위치 (line 6482/6595/7080)
  - 운명술사 Innate + (4) tier / Akali Precision (모든 아군) / Graves SharpshooterModule (위력)
  - DPS 추정 적용 (AP 분기 `expectedSpellCritMultiplier`)
  - 추천 적용 (`flatStatBonus` +400 + pickTopCombo / tagReason)
- **PDCA 상태 기록**: spell-crit-mechanic feature Phase: check, Match Rate 97% (세션 reminder 시점). 본 ingest 로 도메인 지식 위키 file back
- **Cross-ref**:
  - `index.md` Mechanics 섹션에 [[spell-crit]] 추가
  - `index.md` 작성 우선순위 갱신 (spell-crit 완료 제거, ability-pattern-internals 신규 후보 추가)
- **검증 / 미확인 항목** (페이지 내 명시):
  - `pickTopCombo` 조합 평가 + `tagReason` "스킬 치명타 언락" — design doc 명시 but 코드 직접 verify 안 함 → Lint 체크리스트 등록
  - Multi-hit 스킬 crit roll 횟수 — hitCount 마다 roll 인지 single roll 인지 미verify
  - non-damaging ability (실드/힐만) — crit roll 무시 분기 검증 필요

### Sim cleanup: Ability interface family 제거 (PR #117 후속, lint #4 보강)
- **Trigger**: PR #119 (`dc7137e`) 머지 완료 — 직렬 워크플로우
- **배경**: PR #117 는 위키 검출 triad 만 제거 (scope strict). PR #119 가 남은 `Ability` interface + 인접 type 까지 정리.
- **제거 (cascaded dead — 모두 호출처 0)**:
  - `EffectType` (7 string union)
  - `AbilityEffect` interface
  - `Ability` interface
  - **총 -18 lines** (PR #117 + #119 합산 -94 lines)
- **위키 갱신 내역**:
  - `mechanics/ability-targeting.md` 패치 히스토리 표에 PR #119 row 추가 (legacy ability 잔재 완전 제거)
  - Lint 체크리스트 — "Ability interface 자체 dead 검증 — 후속 정리 PR 후보" 항목 [x] 처리 + 커밋 `dc7137e` 명시
- **검증 (PR #119)**: pnpm lint/typecheck/build 통과 + `pnpm vitest run tests/unit/simulator/` 449 passed (변화 없음)
- **legacy ability 시스템 → AbilityConfig 통일 완결**: sim 어빌리티 경로가 architecture transition 완료된 상태로 정리됨 (`AbilityConfig` + `findAbilityTargets` 단일 경로)

### Lint resolved: AbilityTargetingType triad dead code (Lint finding 4 closed)
- **Trigger**: PR #117 (`bab401b`) 머지 완료 — 직렬 워크플로우 적용
- **위키 lint 사이클 완결 사례** (도입 후 2번째 full-cycle):
  - PR #113 [[ability-targeting]] ingest 가 dead code triad 3건 검출 (`AbilityTargetingType`, `findAbilityTarget` 단수, `Ability.targeting` 필드)
  - PR #117 (`bab401b`) — 3 식별자 sim 코드에서 제거 (-76 lines, 0 insertions)
  - 본 cleanup PR — 위키 표기 dead → resolved 갱신
- **위키 갱신 내역**:
  - `mechanics/ability-targeting.md` "⚠️ Lint finding — Dead code triad" 섹션 → "✅ Lint finding resolved — Dead code triad 제거" + 커밋 hash `bab401b` 명시
  - `mechanics/ability-targeting.md` 패치 히스토리 표에 "2026-05-18 (PR #117) — legacy triad 제거" row 추가
  - `mechanics/ability-targeting.md` Lint 체크리스트 — triad 항목 [x] 처리 + `Ability` interface 자체 dead 검증 후속 후보 추가
- **Scope strict (PR #117)**: `Ability` interface 자체도 dead 이지만 본 PR 범위 외 — 후속 정리 후보 (CLAUDE.md "Don't refactor beyond what task requires")
- **검증**: pnpm lint/typecheck/build 통과 + `pnpm vitest run tests/unit/simulator/` 449 passed (변화 없음 — sim 정확도 영향 없음 입증)
- **위키 lint 가치 검증 누적**:
  1. Fountain stale memory (PR #109 이전)
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건 (PR #112 로 해소)
  4. **AbilityTargetingType triad dead code (PR #117 + 본 cleanup PR 로 해소 ✅)**
  5. carryAugments.ts 17.3 drift (PR #115 + PR #116 로 해소 ✅)

### Lint resolved: carryAugments.ts 17.3 sim drift (Lint finding 5 closed)
- **Trigger**: PR #115 (`39cbce2`) 머지 완료 — 사용자 직렬 워크플로우 적용
- **위키 lint 사이클 완결 사례** (도입 후 첫 full-cycle):
  - PR #114 ingest 중 [[patch-17-3]] / [[hero-augment-carry]] 가 `carryAugments.ts` 17.3 drift 5+ entries 검출
  - PR #115 로 sim 정합 (Leona/Mord/Jax/Aatrox/IvernMinion 5건)
  - 본 cleanup PR — 위키 표기 drift → resolved 갱신
- **위키 갱신 내역**:
  - `patches/patch-17-3.md` "조정 Augments — Champion augments" 표: ⚠️ drift → ✅ PR #115 머지 완료. sim 정합 칼럼 추가 (✅/🔍 TODO)
  - `patches/patch-17-3.md` "Lint findings" 섹션: drift → resolved 표기 + 커밋 hash 명시
  - `mechanics/hero-augment-carry.md` "17.3 sim drift" 섹션 → "17.3 sim 정합" + PR #115 링크
  - `mechanics/hero-augment-carry.md` 패치 히스토리 17.3 row: "별도 PR 필요" → "PR #115 머지 완료"
  - `mechanics/hero-augment-carry.md` "시뮬 적용 상태" ✅ 활성 항목에 17.3 변경분 5건 정확 반영 추가
- **TODO 잔존 항목** (인게임 verify 후 후속 PR):
  - PoppyCarry Termeepnal AS 0.7 → 0.75 (augment grant vs statOverride 모호)
  - NasusCarry Bonk! resists 40 → 45 (statOverrides 채움 정책)
- **위키 lint 가치 검증 누적**:
  1. Fountain stale memory (PR #109 이전)
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건 (PR #112 로 해소)
  4. AbilityTargetingType triad dead code (별도 클린업 PR 대기)
  5. **carryAugments.ts 17.3 drift (PR #115 로 해소 ✅, 본 cleanup PR)**

### Major rewrite: patches/patch-17-3.md — 공식 패치노트 정상화 후 종합 ingest
- **Trigger**: 사용자 — "17.3 패치노트 정상화 됐을 것 같은데 찾아봐주라"
- **Source** (`feedback_wiki_ingest_verify` 워크플로우):
  - https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-3/ (공식, 정상화 확인)
  - public/data/tft_set17_champions.json (Leona AR/MR 40 확인 등)
  - src/data/carryAugments.ts (17.2b 값 잔존 확인 — drift 검출)
- **이전 상태**: 46 lines, Fountain 만 다룸 + "추가 패치노트 별도 ingest 필요" 메모
- **변경 후**: ~230 lines, 7 카테고리 종합 (System/Traits/27 챔프/5 신규 aug/15+ 조정 aug/items/bug fixes)
- **해소된 미확정 항목**:
  - Fountain (3)/(5) AD/AP 4%/7% — 공식 확정 (이전 "CDragon 미노출" 상태)
  - Stargazer Huntress 좌상단 hex 추가 — 공식 확정 (이전 "별도 보드 데이터 작업" 표시)
- **⚠️ Lint finding (5번째 사례) — `carryAugments.ts` 17.3 drift**:
  - LeonaCarry baseDamageHpFrac 0.28→0.24, secondaryDamage [180,270,405]→[200,300,480]
  - MordekaiserCarry shield [225,250,300]→[175,200,400], mana 40/100→10/40
  - JaxCarry damage [155,230,375]→[170,250,450]
  - AatroxCarry secondaryDamage [100,150,225]→[110,165,275], slamDamage [160,240,360]→[200,300,475], singleTargetMultiplier 2.5→2.0
  - IvernMinionCarry hexReduction 0.45→0.35
  - PoppyCarry (Termeepnal) AS 0.7→0.75, NasusCarry resists 40→45
  → 별도 sim 정확도 PR 후보. PR #107 이 trait/champion json 갱신했으나 carryAugments.ts 누락.
- **부수 갱신**:
  - `mechanics/stargazer-fountain.md` — (3)/(5) 4%/7% 확정 섹션 추가 + 패치노트 공식 URL sources 추가 + Huntress hex 사실 (보드 작업 별도) + periodic heal (1%/2.5% per 2s) sim 적용 검증 추적 항목
  - `mechanics/hero-augment-carry.md` — 17.3 sim drift 5건을 Lint 섹션으로 추가 + 패치 히스토리 표의 17.3 row 갱신
- **위키 도입 후 lint 누적 (5건)**:
  1. Fountain stale memory (PR #109 이전)
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건
  4. AbilityTargetingType triad dead code (PR #113 ability-targeting)
  5. **본 ingest — carryAugments.ts 17.3 drift 5+ entries**

### Ingest: mechanics/ability-targeting.md
- **Source** (`feedback_wiki_ingest_verify` 워크플로우 — 코드 직접 grep, doc 인용 없음):
  - `src/lib/simulator/systems/ability.ts:findAbilityTargets` + `AbilityConfig` 정의
  - `src/types/index.ts:AbilityPattern` (9종 union)
  - `src/types/index.ts:AbilityTargetingType` (8종 — dead 검출 대상)
  - `src/lib/simulator/systems/targeting.ts:findAbilityTarget` (singular — dead 검출 대상)
  - `src/lib/simulator/engine/combatLoop.ts` findAbilityTargets 3 호출 위치
- **합성 범위**:
  - 9 패턴 알고리즘 표 (single/line/aoe_circle/cone/multi/bounce/global/self_buff/x_shape)
  - 시스템 흐름 (findTarget → AbilityConfig → findAbilityTargets pattern 분기)
  - AbilityConfig 핵심 필드 (radius/maxTargets/dash/stun/heal/buff/debuff/hitCount/dot 등)
  - 패턴별 알고리즘 노트 (line 거리순 cap, multi primary 무시, bounce 누적 hit, x_shape diagonal)
- **⚠️ Lint finding (4번째 사례) — Dead code triad**:
  1. `AbilityTargetingType` (types/index.ts:396) — 8 string union, 어떤 코드/데이터도 set/read 안 함
  2. `findAbilityTarget` (singular, targeting.ts:71) — switch 8 케이스 구현되어 있으나 호출처 0
  3. `Ability.targeting` 필드 (types/index.ts:439) — `.targeting` 으로 읽히는 곳 없음
  → sim 정확도 영향 없음 (architecture transition 잔재). 별도 클린업 PR 후보 — index.md 우선순위 3번 등록.
- **Cross-ref**:
  - `index.md` Mechanics 섹션에 [[ability-targeting]] 추가
  - `index.md` 우선순위 갱신: 완료된 항목 (ability-targeting, CLAUDE.md) 제거, dead code 클린업 신규 후보 추가
- **위키 도입 후 lint 누적 (4건, 본 ingest 시점)**:
  1. 메모리 `stargazer_fountain_inactive` stale claim
  2. plan doc "8 영웅 증강" vs 코드 10건
  3. CLAUDE.md targeting weight/mana 표 stale 3건
  4. **본 ingest — AbilityTargetingType 트라이어드 dead code**

### Lint fix (PR #113 Codex P2): ability-targeting damageDecay/dot.duration "미완" 오기재 수정
- **Finding**: Codex 가 `damageDecay` 를 "미사용 같음 (별도 verify 필요)" 으로 적은 부분 지적. 실제 6 챔프 + combatLoop.ts:6479 active.
- **Verify (코드 grep)**:
  - `damageDecay`: TFT16_Yunara/Gangplank/Caitlyn/Ryze + TFT17_Gnar/AurelionSol 사용. `dmg *= (1 - decay)^ti` 적용.
  - 추가 verify — `dot.duration` 도 "일부만" 모호하게 적었으나 8 챔프 (Nasus/Talon/Pantheon/Viktor/Diana/AurelionSol/Bard/Morgana) + main(:6390) + OOR fallback(:7050) 양 경로 active.
- **Fix**: 두 필드 모두 "미완" → "활성" 섹션 이동, 구체적 사용처 + combatLoop 라인 명시.
- **자기-반성**: `feedback_wiki_ingest_verify` 워크플로우 위반. 페이지가 위키 lint 시작점인데 자체 fact 검증 누락. Codex가 정확히 catch — 자기-fix 패턴.

### Ingest: mechanics/role-passive.md
- **Source**:
  - `src/types/index.ts` (UnitRole 6종 type)
  - `src/lib/simulator/systems/mana.ts` (ROLE_MANA_CONFIG + 3 gain helpers)
  - `src/lib/simulator/systems/targeting.ts` (TARGETING_WEIGHT + findTarget)
  - `src/lib/simulator/engine/combatLoop.ts` (FlatManaRestore aggregation, channelerInnateManaGain init)
  - CLAUDE.md (마나 / 타게팅 룰 — *stale claim 검출 대조군*)
- **합성 범위**:
  - 6 Role 마나 표 (공격당 / 초당 / 피격 시) — 코드 ground truth
  - 3 마나 gain 경로 흐름 (attack/tick/damage) + stun 차단 + 보너스 (FlatManaRestore, channelerInnateManaGain)
  - 타게팅 4단계 (taunt → 거리 → role weight → seed RNG)
  - role 변환 시 자동 따라오는 동작 ([[hero-augment-carry]] 와 cross-ref)
- **⚠️ Lint findings (CLAUDE.md vs 코드 stale 3건)**:
  1. **Targeting weight 5/6 role mismatch** — CLAUDE.md `Fighter/Marksman/Caster/Specialist=2, Assassin=1` vs 코드 `Fighter/Assassin=2, Marksman/Caster/Specialist=1`. 사용자 인지 필요 — Patch 15.1 spec 자체가 바뀐 건지 처음부터 잘못 적힌 건지 확인.
  2. **Specialist 마나 "고유"** — CLAUDE.md 표기, 코드는 표준 (10/0/false). spec vs sim 차이.
  3. **Caster CC-마나 차단** — CLAUDE.md "Caster 만", 코드는 모든 role 적용 (attack 자체가 stun 으로 막혀서).
- **Cross-ref**:
  - `index.md` Mechanics 섹션에 [[role-passive]] 추가
  - `index.md` 우선순위: CLAUDE.md 갱신을 신규 후보로 추가, ability-targeting 신규 후보 추가
- **Lint 가치 검증 (3번째)**: 위키 도입 후 stale 검출 사례 누적 — (1) Fountain inactive memory, (2) hero-augment-carry CARRY_AUGMENTS 8 vs 10건, (3) **본 ingest 의 CLAUDE.md weight/mana 표 3건**

### Ingest: mechanics/hero-augment-carry.md
- **Source**:
  - `src/data/carryAugments.ts` (CarryAugmentConfig + CARRY_AUGMENTS 10건)
  - `src/lib/simulator/engine/combatLoop.ts:applyHeroCarryTransforms` + `findStrongestUnitByApi`
  - `wiki/raw/in-game/set17-hero-augments.md` (사용자 인게임 측정)
  - `[[patch-17-2b]]` "Hero Augment Carry 시스템" 섹션
- **합성 범위**:
  - 변환 흐름 (role + statOverrides + ability override + flag)
  - findStrongestUnitByApi tie-break (성급 → 아이템 수 → deterministic)
  - CarryAugmentConfig 구조 (statOverrides 9 필드 + abilityData 27 변수)
  - CARRY_AUGMENTS 표 (10건 — augment / 챔프 / pattern / abilityData / statOverrides / 핵심 변수)
  - role 변환 시 자동 따라오는 것 (mana/AS baseline/타게팅 weight)
  - 패치 히스토리 (17.2 LIVE → 17.2b 도입 → PR7-A/B/C → N.O.V.A.)
  - 시뮬 적용 상태 (active/partial 분리)
  - 미완 (사용자 측정 대기 statOverrides, onKill hook 분기 등)
- **Cross-ref**:
  - `patches/patch-17-2b.md` "Hero Augment Carry 시스템" 섹션을 [[hero-augment-carry]] 링크로 축약 (17.2b 한정 변경분 3건만 남김)
  - `index.md` Mechanics 섹션에 [[hero-augment-carry]] 추가
  - `index.md` "작성 우선순위" 1번 제거 (완료) → 다음 후보는 patches/patch-17-2 또는 mechanics/role-passive
- **Lint 관찰**: CARRY_AUGMENTS 가 10건인데 plan doc 은 "8 영웅 증강"이라 표기 — 이 페이지에서 10건 (Nasus, 8 hero augment, Zed special) 명확화

### Lint fix (PR #110 Codex P2): patches 파일명 prefix 통일
- **Finding**: `patches/17-3.md` frontmatter `id: patch-17-3` 인데 파일명이 `17-3.md`. 다른 entity (traits/mechanics) 는 id와 파일명 일치. patches 만 prefix mismatch — `[[patch-17-3]]` Obsidian 링크 컨벤션 위반 (schema.md "id: 파일명과 일치" 규칙).
- **Verify**: `[[patch-17-3]]` / `[[patch-17-2b]]` 가 9개 파일 27곳 사용 중. id/링크 통일 필요.
- **Fix (옵션 A — 파일명 변경)**:
  - `git mv patches/17-3.md  patches/patch-17-3.md`
  - `git mv patches/17-2b.md patches/patch-17-2b.md`
  - 기존 27개 `[[patch-17-*]]` 링크는 그대로 정합
- **Schema 갱신**: `### patches/<id>.md` 섹션에 "파일명 `patch-` prefix 필수" 명시
- **위 entries 의 path 참조 (예: "Ingest: patches/17-2b.md") 는 append-only 원칙 상 그대로 보존** (그 시점 기준 사실)
- **Lint 가치 검증**: 위키 도입 후 첫 외부 review (Codex) 가 정확히 schema-implementation drift 를 잡음 — 향후 lint script 자동화 시 동일 패턴 검출 가능

### Ingest: patches/17-2b.md
- **Source**: `docs/meta/set17-patch-17-2b-plan.md` (2026-04-30 plan doc)
- **합성 범위**:
  - 17.2b 실제 변경 내역 (증강 5건, 챔프 3건, 시너지 1건, 버그픽스)
  - sim 적용 PR 매핑 (#67, #68, PR2 신병)
  - 17.3 와의 차이 (Fountain 재활성화 등)
  - Hero Augment Carry 시스템 개요 (후속 ingest 후보로 명시)
  - 미완 항목 (사용자 인게임 측정 대기)
  - 데이터 수정 원칙 (`feedback_data_edit` 메모리)
- **제외**: PR 세션 핸드오프, cheat sheet, 작업 순서 등 plan-time noise
- **Cross-ref 추가**: `[[index]]` Patches 섹션, "작성 우선순위" 1번을 hero-augment-carry 로 갱신, `mechanics/stargazer-fountain.md` 17.2b row 에 `[[patch-17-2b]]` 링크
- **Verify**: 코드 grep 으로 5개 augment + 3개 챔프 변경 모두 실제 반영 확인 (`carryAugments.ts`, `disabledContent.ts`, `tft_set17_champions.json`, `tft_set17_augments.json` 신병 line 8380)
- **Archive 결정 대기**: plan doc `set17-patch-17-2b-plan.md` 삭제 여부는 사용자 컨펌 후

### Raw layer 도입: 5 파일 wiki/raw/ 이전
- **Rationale**: Karpathy 패턴 정합 — raw가 위키 내부에 self-contained.
- **Decision (사용자 합의)**: set17-* 9개 중 진짜 raw 5개만 이전. 나머지 4개(plan/audit/guide/gods-system)는 docs/meta/ 유지 후 점진 ingest.
- **이전 (git mv)**:
  - `docs/meta/set17-factory-new-arsenal.md` → `wiki/raw/lolchess/`
  - `docs/meta/set17-graves-factory-tree.md` → `wiki/raw/lolchess/`
  - `docs/meta/set17-stargazer-constellations.md` → `wiki/raw/lolchess/`
  - `docs/meta/set17-yasuo-tiles.md` → `wiki/raw/lolchess/`
  - `docs/meta/set17-hero-augments.md` → `wiki/raw/in-game/`
- **참조 갱신 (perl literal 치환)**: 11곳
  - wiki: `schema.md`, `index.md`(개정), `log.md`(이 파일), `traits/stargazer.md`, `mechanics/stargazer-fountain.md`
  - 외부: `tests/unit/simulator/hero-augment-stat-system.test.ts`, `docs/meta/set17-patch-17-2b-plan.md`, `docs/meta/simulator-synergy-todos.md`, `docs/superpowers/specs/2026-04-23-actual-data-design.md`, `docs/superpowers/specs/2026-04-27-stargazer-tile-overlay-design.md`, `src/data/factoryNewTree.ts`
- **신규**: `wiki/raw/README.md` (raw 카탈로그) + 5 폴더 (lolchess/in-game/cdragon/patch-notes/assets — 후 3개는 빈 폴더 placeholder)
- **schema.md 갱신**: 3-Layer 표 + Raw 폴더 컨벤션 섹션 추가
- **검증**: `grep -rn 'docs/meta/set17-(factory-new-arsenal|...)'` 잔여 0건

### Seed: Schema + Stargazer Fountain
- **Ingest origin**: Karpathy LLM Wiki pattern 도입 결정 (대화 합의)
- **Sources consumed**:
  - `docs/wiki/raw/lolchess/set17-stargazer-constellations.md` (lolchess.gg 2026-04-23 추출)
  - 메모리 `stargazer_fountain_inactive.md` (2026-05-13 업데이트 = 17.3 active)
  - git log: `bfa7794`, `6321f98`, `e6d5365`, `059547c`, `08b5615` 등 Fountain 관련 커밋
  - `src/lib/simulator/engine/combatLoop.ts` (applyStargazerEffects, triggerFountainHeal)
- **Pages created**:
  - `schema.md`
  - `index.md`
  - `log.md` (이 파일)
  - `traits/stargazer.md`
  - `mechanics/stargazer-fountain.md`
  - `patches/17-3.md`
- **Rationale**: Stargazer Fountain 은 17.2 inactive → 17.3 active 로 상태가 바뀐 실제 사례. LLM Wiki 패턴의 lint/patch-history 가치를 즉시 검증 가능한 seed.
- **Follow-up**:
  - 메모리 `stargazer_fountain_inactive.md` 는 이미 17.3 기준으로 최신화되어 있음 → 위키 포인터로만 보강 (메모리 description 갱신)
  - 다음 ingest 후보는 [[index]] "작성 우선순위" 섹션 참조
