/**
 * 프리즘 시너지 handler 회귀 가드.
 *
 * 알려진 prism trait 4종 (raw data style=6):
 *   - DarkStar (9), Astronaut (10), SpaceGroove (10), Stargazer Mountain (11)
 *
 * detectPrismTraits 는 ActiveTrait[] 에서 prism style 발동 여부 판정.
 * simulateCombat 시작 시 양쪽 prism 체크 → 활성 측 즉시 winner.
 *
 * 현실에서는 9~11명 활성 보드를 unit test 로 만들기 어려워 (resolveTraits dedupe key
 * 가 동일 챔프 중복 drop), mock ActiveTrait 로 detectPrismTraits 검증.
 */
import { describe, it, expect } from 'vitest';
import { detectPrismTraits } from '@/lib/simulator/engine/combatLoop';
import type { ActiveTrait, RawTrait, TraitEffect } from '@/types';

function makeTrait(apiName: string, name: string, count: number, style: number): ActiveTrait {
  const effect: TraitEffect = {
    minUnits: count,
    maxUnits: 25000,
    style,
    variables: {},
  };
  const trait: RawTrait = {
    apiName,
    name,
    desc: '',
    icon: '',
    effects: [effect],
  };
  return { trait, count, activeEffect: effect, style };
}

describe('detectPrismTraits — 4종 prism 활성', () => {
  it.each([
    ['TFT17_DarkStar', '암흑의 별', 9],
    ['TFT17_Astronaut', '정령족', 10],
    ['TFT17_SpaceGroove', '우주 그루브', 10],
    ['TFT17_Stargazer_Mountain', '별돌보미', 11],
  ])('%s style=6 → 활성', (apiName, name, count) => {
    const result = detectPrismTraits([makeTrait(apiName, name, count, 6)]);
    expect(result.active).toBe(true);
    expect(result.names).toHaveLength(1);
    expect(result.names[0]).toContain(name);
    expect(result.names[0]).toContain(`(${count})`);
  });
});

describe('detectPrismTraits — 비활성 케이스', () => {
  it('style=5 (prismatic 일반 tier) → 비활성', () => {
    const result = detectPrismTraits([makeTrait('TFT17_DarkStar', '암흑의 별', 6, 5)]);
    expect(result.active).toBe(false);
  });

  it('non-prism trait apiName + style=6 → 비활성 (whitelist 외)', () => {
    const result = detectPrismTraits([makeTrait('TFT17_HPTank', '싸움꾼', 6, 6)]);
    expect(result.active).toBe(false);
  });

  it('빈 배열 → 비활성', () => {
    const result = detectPrismTraits([]);
    expect(result.active).toBe(false);
  });

  it('activeEffect=null → 비활성', () => {
    const trait: RawTrait = {
      apiName: 'TFT17_DarkStar',
      name: '암흑의 별',
      desc: '',
      icon: '',
      effects: [],
    };
    const result = detectPrismTraits([{ trait, count: 9, activeEffect: null, style: 6 }]);
    expect(result.active).toBe(false);
  });
});

describe('detectPrismTraits — 다중 활성', () => {
  it('player 가 DarkStar(9) + Astronaut(10) 동시 prism', () => {
    const result = detectPrismTraits([
      makeTrait('TFT17_DarkStar', '암흑의 별', 9, 6),
      makeTrait('TFT17_Astronaut', '정령족', 10, 6),
    ]);
    expect(result.active).toBe(true);
    expect(result.names).toHaveLength(2);
  });
});
