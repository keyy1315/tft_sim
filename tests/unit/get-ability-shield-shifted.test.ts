/**
 * `getAbilityShield` shifted indexing 회귀 가드 (P2 audit 후속, PR #104 동일 패턴).
 *
 * 진단:
 *   - `getAbilityShield` 가 `shieldVar.value[starLevel]` 로 raw index 접근 →
 *     ★1 → raw[1] (★2 값!), ★2 → raw[2] (★3 값!), ★3 → raw[3] (★4 값!)
 *   - non-filler 변수 (raw[0] > 0 && raw[0] <= raw[1]) 는 ★+1 만큼 over-scaled.
 *   - filler 변수 (raw[0]=0 또는 raw[0] > raw[1]) 는 우연히 정확.
 *
 * 선행 fix:
 *   - PR #102 (Poppy P1): champion-specific helper `applyPoppyShieldAndResists` 로 우회
 *   - PR #103 (Mordekaiser): champion-specific helper `applyMordekaiserProcCast` 로 우회
 *   - PR #104 (P2): `getAbilityDamage` systematic fix — 동일 패턴
 *   - 본 PR: `getAbilityShield` systematic fix
 *
 * 영향 챔프 5개 (champion-specific helper 없는 챔프):
 *   - Illaoi Shield [250, 450, 525]
 *   - Rammus ShieldAP [300, 675, 825]
 *   - Ornn Shield [100, 100, 150]
 *   - Diana Shield [100, 250, 290]
 *   - Poppy Shield [300, 400, 475] — getAbilityShield 호출 자체가 short-circuit (PR #102)
 */
import { describe, it, expect } from 'vitest';
import { getAbilityShield } from '@/lib/simulator/systems/ability';
import type { RawChampion, AbilityVariable } from '@/types';

function makeChampWithShield(opts: {
  apiName: string;
  variables: AbilityVariable[];
  hasApScaling?: boolean;
}): RawChampion {
  const scaleTag = opts.hasApScaling ? '(%i:scaleAP%)' : '';
  return {
    name: opts.apiName,
    apiName: opts.apiName,
    cost: 1,
    traits: [],
    role: 'APTank',
    stats: {
      hp: 800, armor: 50, magicResist: 50, damage: 60,
      attackSpeed: 0.65, range: 1, critChance: 0.25, critMultiplier: 1.4,
      initialMana: 30, mana: 100,
    },
    ability: {
      name: opts.apiName,
      desc: `@ModifiedShield@${scaleTag} 의 보호막을 얻습니다.`,
      icon: '',
      variables: opts.variables,
    },
  } as unknown as RawChampion;
}

describe('getAbilityShield — non-filler 챔프 정확 star mapping (audit P2 후속)', () => {
  it('Illaoi Shield [250, 450, 525] non-filler — ★1=250, ★2=450, ★3=525', () => {
    const champ = makeChampWithShield({
      apiName: 'TFT17_Illaoi',
      variables: [{ name: 'Shield', value: [250, 450, 525, 650, 775] }],
    });
    expect(getAbilityShield(champ, 1, 0)).toBeCloseTo(250, 0);
    expect(getAbilityShield(champ, 2, 0)).toBeCloseTo(450, 0);
    expect(getAbilityShield(champ, 3, 0)).toBeCloseTo(525, 0);
  });

  it('Rammus ShieldAP [300, 675, 825] non-filler — ★ 정확 매핑', () => {
    const champ = makeChampWithShield({
      apiName: 'TFT17_Rammus',
      variables: [{ name: 'ShieldAP', value: [300, 675, 825, 2000, 2500] }],
    });
    expect(getAbilityShield(champ, 1, 0)).toBeCloseTo(300, 0);
    expect(getAbilityShield(champ, 2, 0)).toBeCloseTo(675, 0);
    expect(getAbilityShield(champ, 3, 0)).toBeCloseTo(825, 0);
  });

  it('Diana Shield [100, 250, 290] non-filler — ★ 정확 매핑', () => {
    const champ = makeChampWithShield({
      apiName: 'TFT17_Diana',
      variables: [{ name: 'Shield', value: [100, 250, 290, 375, 460] }],
    });
    expect(getAbilityShield(champ, 1, 0)).toBeCloseTo(100, 0);
    expect(getAbilityShield(champ, 2, 0)).toBeCloseTo(250, 0);
    expect(getAbilityShield(champ, 3, 0)).toBeCloseTo(290, 0);
  });

  it('AP scaling — Illaoi ★1 AP=100 → 250 × 2.0 = 500', () => {
    const champ = makeChampWithShield({
      apiName: 'TFT17_Illaoi',
      variables: [{ name: 'Shield', value: [250, 450, 525, 650, 775] }],
      hasApScaling: true,
    });
    expect(getAbilityShield(champ, 1, 100)).toBeCloseTo(500, 0);
    expect(getAbilityShield(champ, 2, 100)).toBeCloseTo(900, 0);
    expect(getAbilityShield(champ, 3, 100)).toBeCloseTo(1050, 0);
  });
});

describe('getAbilityShield — filler 챔프 회귀 (fix 후에도 정확 유지)', () => {
  it('Sentinel filler raw[0]=0 (Mordekaiser InitialShield 패턴) — ★1=raw[1]', () => {
    const champ = makeChampWithShield({
      apiName: 'TFT17_TestFiller',
      variables: [{ name: 'Shield', value: [0, 300, 375, 500, 650] }],
    });
    expect(getAbilityShield(champ, 1, 0)).toBeCloseTo(300, 0);
    expect(getAbilityShield(champ, 2, 0)).toBeCloseTo(375, 0);
    expect(getAbilityShield(champ, 3, 0)).toBeCloseTo(500, 0);
  });

  it('Sentinel filler raw[0] > raw[1] (Urgot ShieldAmount [200, 150, 175]) — ★1=raw[1]', () => {
    const champ = makeChampWithShield({
      apiName: 'TFT17_TestSentinelLarge',
      variables: [{ name: 'ShieldAmount', value: [200, 150, 175, 200, 225] }],
    });
    // v0=200, v1=150, v0 > v1 → isFiller=true → idx=starLevel.
    expect(getAbilityShield(champ, 1, 0)).toBeCloseTo(150, 0);
    expect(getAbilityShield(champ, 2, 0)).toBeCloseTo(175, 0);
    expect(getAbilityShield(champ, 3, 0)).toBeCloseTo(200, 0);
  });

  it('desc 에 보호막/Shield 없으면 0 반환 (regression guard)', () => {
    const champ: RawChampion = {
      name: 'NoShield', apiName: 'TFT17_NoShield', cost: 1, traits: [], role: 'APCaster',
      stats: { hp: 500, armor: 20, magicResist: 20, damage: 50, attackSpeed: 0.7, range: 4, critChance: 0.25, critMultiplier: 1.4, initialMana: 0, mana: 30 },
      ability: { name: '', desc: '데미지만 입힘', icon: '', variables: [{ name: 'Shield', value: [100, 200, 300] }] },
    } as unknown as RawChampion;
    expect(getAbilityShield(champ, 1, 0)).toBe(0);
  });
});
