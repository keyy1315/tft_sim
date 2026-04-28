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
import {
  detectPrismTraits,
  hasFiveCostStar3,
  resolvePrismOutcome,
} from '@/lib/simulator/engine/combatLoop';
import type { ActiveTrait, RawTrait, TraitEffect, PlacedChampion, RawChampion } from '@/types';

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

function makeChamp(cost: number): RawChampion {
  return {
    apiName: `TFT17_Test_C${cost}`,
    name: `cost${cost}`,
    cost,
    traits: [],
    role: 'Marksman',
    stats: {
      hp: [0, 1000, 1500, 2500, 0],
      damage: [0, 100, 150, 250, 0],
      attackSpeed: 0.7,
      armor: 30,
      magicResist: 30,
      mana: [0, 0],
      range: 4,
      critChance: 0.25,
      critMultiplier: 1.4,
    },
    abilityName: 't', abilityDesc: '', abilityIcon: '',
    abilityVariables: [], abilityScales: [],
    icon: '', squareIcon: '', tileIcon: '', characterName: '',
  } as unknown as RawChampion;
}

function makePlaced(cost: number, starLevel: number): PlacedChampion {
  return { champion: makeChamp(cost), starLevel, position: { q: 0, r: 0 }, items: [] };
}

describe('hasFiveCostStar3 — 5코3성 boolean', () => {
  it('5코 3성 보유 → true', () => {
    expect(hasFiveCostStar3([makePlaced(5, 3)])).toBe(true);
  });
  it('5코 2성 → false', () => {
    expect(hasFiveCostStar3([makePlaced(5, 2)])).toBe(false);
  });
  it('4코 3성 → false', () => {
    expect(hasFiveCostStar3([makePlaced(4, 3)])).toBe(false);
  });
  it('빈 팀 → false', () => {
    expect(hasFiveCostStar3([])).toBe(false);
  });
  it('5코3성 + 다른 챔프 → true', () => {
    expect(hasFiveCostStar3([makePlaced(2, 2), makePlaced(5, 3), makePlaced(1, 1)])).toBe(true);
  });
});

describe('resolvePrismOutcome — counter + 우선순위', () => {
  const prismActive = { active: true, names: ['암흑의 별(9)'] };
  const noPrism = { active: false, names: [] };
  const enemyPrism = { active: true, names: ['정령족(10)'] };

  it('둘 다 prism 비활성 → null (정상 sim)', () => {
    expect(resolvePrismOutcome(noPrism, noPrism, false, false)).toBeNull();
    expect(resolvePrismOutcome(noPrism, noPrism, true, true)).toBeNull();
  });

  it('player prism + enemy 5코3성 보유 → enemy win (counter)', () => {
    const r = resolvePrismOutcome(prismActive, noPrism, false, true);
    expect(r?.winner).toBe('enemy');
    expect(r?.reason).toContain('5코스트 3성');
  });

  it('enemy prism + player 5코3성 보유 → player win (counter)', () => {
    const r = resolvePrismOutcome(noPrism, enemyPrism, true, false);
    expect(r?.winner).toBe('player');
    expect(r?.reason).toContain('5코스트 3성');
  });

  it('단방 prism + 5코3성 없음 → prism 측 win', () => {
    expect(resolvePrismOutcome(prismActive, noPrism, false, false)?.winner).toBe('player');
    expect(resolvePrismOutcome(noPrism, enemyPrism, false, false)?.winner).toBe('enemy');
  });

  it('단방 prism + 양쪽 5코3성 → 5코3성 측 win이 prism 측 위에 있어야 함 (counter 측)', () => {
    // player prism + 양쪽 5코3성 → counter 무력 (player 도 보유) → player win (prism 측)
    const r = resolvePrismOutcome(prismActive, noPrism, true, true);
    expect(r?.winner).toBe('player');
  });

  it('양쪽 prism + 5코3성 없음 → draw', () => {
    const r = resolvePrismOutcome(prismActive, enemyPrism, false, false);
    expect(r?.winner).toBe('draw');
  });

  it('양쪽 prism + 한쪽만 5코3성 → 5코3성 측 win', () => {
    // 양쪽 prism인 상태에서 player 5코3성 보유 → player win (counter)
    const r1 = resolvePrismOutcome(prismActive, enemyPrism, true, false);
    expect(r1?.winner).toBe('player');
    // 양쪽 prism인 상태에서 enemy 5코3성 보유 → enemy win (counter)
    const r2 = resolvePrismOutcome(prismActive, enemyPrism, false, true);
    expect(r2?.winner).toBe('enemy');
  });

  it('양쪽 prism + 양쪽 5코3성 → draw (counter 서로 무력)', () => {
    const r = resolvePrismOutcome(prismActive, enemyPrism, true, true);
    expect(r?.winner).toBe('draw');
  });
});
