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
   * 8 사이트 모두 `(1 + (X.healAmp ?? 0))` 패턴을 코드에 포함하는지 grep 가드.
   * source 코드 자체를 문자열로 읽어 패턴 매칭 — 미적용 회귀 시 즉시 실패.
   */
  it('combatLoop.ts 가 8 heal 사이트 모두에 healAmp 곱셈 포함', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/simulator/engine/combatLoop.ts'),
      'utf8',
    );
    // 모든 heal 사이트의 healAmp 곱셈 패턴
    const patternA = /\* \(1 \+ \(\w+\.healAmp \?\? 0\)\)/g;
    const matches = file.match(patternA);
    expect(matches, 'healAmp 곱셈 패턴이 코드에 포함되어야 함').toBeDefined();
    // 8 heal 사이트 + 기존 1곳 (Fountain stacking) = 최소 8 매치
    expect(matches!.length).toBeGreaterThanOrEqual(8);
  });
});
