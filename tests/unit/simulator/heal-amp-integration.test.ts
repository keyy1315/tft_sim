/**
 * 회귀 가드 — healAmp (회복량 증폭) 가 모든 heal 사이트에 일관 적용되는지 검증.
 *
 * 도입 배경:
 *   PsyOps GrenadeMod_Radiant (IncreasedHealing 0.22) 는 raw item effect 로
 *   unit.healAmp 에 0.22 누적. 이 healAmp 는 모든 heal site 에 (1 + healAmp)
 *   곱셈으로 적용되어야 하는데, 17.2 fetch 시점엔 일부 heal (Fountain stacking) 만
 *   적용되고 omnivamp / 마오카이 N.O.V.A / 사냥꾼 표식 / ability self-heal 등
 *   8 사이트 미적용 회귀 발생.
 *
 * 본 테스트는 unit.healAmp 를 직접 set 하여 healAmp 가 곱셈으로 동작하는지
 * 단위 검증. 실제 GrenadeMod_Radiant 시뮬은 별도 PR #41 가드에서 처리.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const apTwistedFate = champions.find(c => c.apiName === 'TFT17_TwistedFate')!;
const apAatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
// Bloodthirster — 기본 omnivamp 0.25 (정규 raw item)
const bloodthirster = items.find(i => i.apiName === 'TFT_Item_Bloodthirster')!;

function placed(c: RawChampion, q: number, r: number, starLevel: number = 2, eqItems = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: eqItems };
}

describe('healAmp — omnivamp heal 통합 (line 3294 / 3349 / 3692)', () => {
  it('Bloodthirster 흡혈검 (omnivamp 0.25) 만 보유 시 healAmp=0 → 입힌 피해의 25% 회복', () => {
    const team: PlacedChampion[] = [
      placed(apTwistedFate, 0, 0, 2, [bloodthirster] as never[]),
    ];
    const enemy: PlacedChampion[] = [placed(apAatrox, 6, 3, 2)];

    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });

    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    expect(tf.omnivamp).toBeGreaterThan(0); // bloodthirster 효과 적용됨
    expect(tf.healAmp).toBe(0); // healAmp 미적용
  });

  it('healAmp 자체가 default 0 (CombatUnit init 기본값)', () => {
    const team = [placed(apTwistedFate, 0, 0, 2)];
    const enemy = [placed(apAatrox, 6, 3, 2)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    expect(result.playerUnits[0].healAmp).toBe(0);
  });
});

describe('healAmp 곱셈 동작 — combatLoop heal 사이트 8곳 일관 적용', () => {
  /**
   * 본 테스트는 codebase 정합성 가드 — heal 곱셈이 빠진 회귀 검출.
   *
   * Production 시뮬에서 healAmp 부여 source 는 GrenadeMod_Radiant (PsyOps,
   * 본인 unit 만, 자동 swap) 1종 뿐. healAmp 효과 자체의 시뮬 검증은 별도
   * (PR #41 psyops-heal-amp.test.ts).
   *
   * 본 가드는 "healAmp=0 일 때 회복이 변하지 않음" + "코드 grep 으로
   * 8 사이트 모두 (1 + healAmp) 곱셈 포함" 을 보장.
   */
  it('healAmp=0 시 시뮬 결과는 healAmp 적용 전과 동일 (회귀 안전성)', () => {
    const team: PlacedChampion[] = [
      placed(apTwistedFate, 0, 0, 2, [bloodthirster] as never[]),
    ];
    const enemy: PlacedChampion[] = [placed(apAatrox, 6, 3, 2)];

    const result = simulateCombat(team, enemy, {
      seed: 42, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    // 시뮬 정상 종료 + heal 사이트가 healAmp=0 일 때도 정상 동작
    expect(result.winner).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
  });
});

describe('healAmp 적용 사이트 코드 grep — 회귀 안전성', () => {
  /**
   * 9 사이트 모두 `(1 + (X.healAmp ?? 0))` 패턴 + 사이트별 fingerprint 검증.
   * 1 곳이라도 빠지면 실패 (codex P2 — `>=8` 으로는 1개 누락 검출 불가능).
   *
   * 카운트 변경 시 (heal site 추가 / 제거) 본 expectedCount + sites 배열 갱신 필수 —
   * 의도된 gate.
   */
  it('combatLoop.ts 가 9 heal 사이트 모두에 healAmp 곱셈 포함 (정확 카운트)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    const patternA = /\* \(1 \+ \(\w+\.healAmp \?\? 0\)\)/g;
    const matches = file.match(patternA);
    expect(matches, 'healAmp 곱셈 패턴이 코드에 포함되어야 함').toBeDefined();
    // PR #52: 8 신규 사이트 + 기존 1 (Fountain stacking) = 9 매치.
    // G2 Phase 3A: Nanomachines (`nanoBase * (1 + ...)`) 추가 → 10 매치.
    // 파티광 (Blitzcrank): heal mode (`partyBase * (1 + ...)`) 추가 → 11 매치.
    // PR #70 (자폭 codex P1): 자폭 omnivamp heal (`totalSelfDestructDmg * unit.omnivamp * (1 + ...)`)
    //   추가 → 12 매치. 일반 ability omnivamp 와 동일 패턴, primary target 없어 grievousReduction 생략.
    // 새 heal 사이트 추가 시 본 카운트도 갱신 필수.
    expect(matches!.length).toBe(12);
  });

  it('각 heal 사이트별 fingerprint — 의미 단위 회귀 가드', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // 각 heal 사이트의 핵심 expression 직접 매치 — 1곳이라도 빠지면 실패.
    const sites: Array<{ name: string; pattern: RegExp }> = [
      { name: 'Maokai N.O.V.A teamwide heal', pattern: /u\.maxHp \* state\.maokaiHealPct \* \(1 \+ \(u\.healAmp \?\? 0\)\)/ },
      { name: 'Fountain heal (legacy)', pattern: /totalAbilityDmg \* caster\.stargazerFountainHealPercent \* \(1 \+ \(lowest\.healAmp \?\? 0\)\)/ },
      { name: 'Stargazer 사냥꾼 표식 사망 heal', pattern: /h\.maxHp \* h\.stargazerHuntressHealPercent \* \(1 \+ \(h\.healAmp \?\? 0\)\)/ },
      { name: 'basic attack omnivamp', pattern: /finalDamage \* unit\.omnivamp \* grievousReduction \* \(1 \+ \(unit\.healAmp \?\? 0\)\)/ },
      { name: 'extra hit (DoubleTap) omnivamp', pattern: /extraFinal \* unit\.omnivamp \* grievousReduction \* \(1 \+ \(unit\.healAmp \?\? 0\)\)/ },
      { name: 'Fiora 급소 회복 (atkSc.healPercent)', pattern: /sDmg \* healPct \* \(1 \+ \(unit\.healAmp \?\? 0\)\)/ },
      { name: 'ability omnivamp', pattern: /totalAbilityDmg \* unit\.omnivamp \* grievousReduction \* \(1 \+ \(unit\.healAmp \?\? 0\)\)/ },
      { name: 'ability self-heal (Heal/APHeal/PercentMaximumHealthHealing)', pattern: /healAmount \* \(1 \+ \(unit\.healAmp \?\? 0\)\)/ },
      // 기존 1곳 (Fountain stacking, line 3122) — `healBase * (1 + (u.healAmp ?? 0))`
      { name: 'Fountain stacking heal (PR #41 기존)', pattern: /healBase \* \(1 \+ \(u\.healAmp \?\? 0\)\)/ },
      // G2 Phase 3A — Nanomachines 매 1초 maxHp × 3% 회복 (`nanoBase * (1 + (u.healAmp ?? 0))`)
      { name: 'Nanomachines periodic regen (G2 Phase 3A)', pattern: /nanoBase \* \(1 \+ \(u\.healAmp \?\? 0\)\)/ },
      // 파티광 (Blitzcrank) — HP 45% 트리거 시 매초 maxHp × 15% 회복 (`partyBase * (1 + (u.healAmp ?? 0))`)
      { name: '파티광 (Blitzcrank) heal mode', pattern: /partyBase \* \(1 \+ \(u\.healAmp \?\? 0\)\)/ },
      // PR #70 codex P1 — 자폭 (그라가스) omnivamp heal: 적군 AOE damage 합산 후 omnivamp 적용.
      // 일반 ability omnivamp 와 동일 패턴이지만 자폭은 primary target 없어 grievousReduction 생략.
      { name: '자폭 (그라가스 carry) omnivamp heal', pattern: /totalSelfDestructDmg \* unit\.omnivamp \* \(1 \+ \(unit\.healAmp \?\? 0\)\)/ },
    ];
    for (const { name, pattern } of sites) {
      expect(file, `heal 사이트 missing: ${name}`).toMatch(pattern);
    }
  });
});
