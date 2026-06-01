/**
 * `getAbilityDamage` shifted indexing 회귀 가드 (P2 후속, audit doc 2026-05-07).
 *
 * 진단:
 *   - `getAbilityDamage` 가 `parsed.damageValues[starLevel]` 로 raw index 접근 →
 *     ★1 → raw[1] (★2 값!), ★2 → raw[2] (★3 값!), ★3 → raw[3] (★4 값!)
 *   - non-filler 변수 (raw[0] > 0 && raw[0] <= raw[1]) 는 ★+1 만큼 over-scaled.
 *   - filler 변수 (raw[0]=0 또는 raw[0] > raw[1]) 는 우연히 정확.
 *
 * Fix: `readVarByStar` 패턴 차용 (combatLoop.ts:172) — filler 자동 판별.
 *
 * 회귀 가드: 영향 챔프 14개 중 대표 ★ 정확성 검증.
 *   - Lissandra Damage [200, 250, 375] non-filler
 *   - Veigar Damage [250, 310, 465] non-filler
 *   - Caitlyn Damage [145, 170, 255] non-filler
 *   - Samira Damage [260, 360, 540] non-filler
 *   - Nami Damage [260, 410, 615] non-filler
 *   - Milio Damage [200, 255, 380] non-filler
 *   - filler 회귀: Mordekaiser InitialShield [0, 300, 375, 500] 영향 없음 검증
 */
import { describe, it, expect } from 'vitest';
import { getAbilityDamage } from '@/lib/simulator/systems/ability';
import type { RawChampion, AbilityVariable } from '@/types';

function makeChamp(opts: {
  apiName: string;
  variables: AbilityVariable[];
  desc?: string;
}): RawChampion {
  return {
    name: opts.apiName,
    apiName: opts.apiName,
    cost: 1,
    traits: [],
    role: 'APCaster',
    stats: {
      hp: 500, armor: 20, magicResist: 20, damage: 50,
      attackSpeed: 0.7, range: 4, critChance: 0.25, critMultiplier: 1.4,
      initialMana: 0, mana: 30,
    },
    ability: {
      name: opts.apiName,
      desc: opts.desc ?? '@ModifiedDamage@(%i:scaleAP%) 의 마법 피해',
      icon: '',
      variables: opts.variables,
    },
  } as unknown as RawChampion;
}

describe('getAbilityDamage — non-filler 챔프 정확 star mapping (P2 fix)', () => {
  it('Lissandra Damage [200, 250, 375] non-filler — ★1=200, ★2=250, ★3=375 (AP=0)', () => {
    const champ = makeChamp({
      apiName: 'TFT17_Lissandra',
      variables: [{ name: 'Damage', value: [200, 250, 375, 600, 1020] }],
    });
    expect(getAbilityDamage(champ, 1, 0).damage).toBeCloseTo(200, 0);
    expect(getAbilityDamage(champ, 2, 0).damage).toBeCloseTo(250, 0);
    expect(getAbilityDamage(champ, 3, 0).damage).toBeCloseTo(375, 0);
  });

  it('Veigar Damage [250, 310, 465] non-filler — ★ 정확 매핑', () => {
    const champ = makeChamp({
      apiName: 'TFT17_Veigar',
      variables: [{ name: 'Damage', value: [250, 310, 465, 700, 1190] }],
    });
    expect(getAbilityDamage(champ, 1, 0).damage).toBeCloseTo(250, 0);
    expect(getAbilityDamage(champ, 2, 0).damage).toBeCloseTo(310, 0);
    expect(getAbilityDamage(champ, 3, 0).damage).toBeCloseTo(465, 0);
  });

  it('Caitlyn Damage [145, 170, 255] non-filler — ★ 정확 매핑', () => {
    const champ = makeChamp({
      apiName: 'TFT17_Caitlyn',
      variables: [{ name: 'Damage', value: [145, 170, 255, 380, 670] }],
    });
    expect(getAbilityDamage(champ, 1, 0).damage).toBeCloseTo(145, 0);
    expect(getAbilityDamage(champ, 2, 0).damage).toBeCloseTo(170, 0);
    expect(getAbilityDamage(champ, 3, 0).damage).toBeCloseTo(255, 0);
  });

  it('Samira Damage [260, 360, 540] non-filler — ★ 정확 매핑', () => {
    const champ = makeChamp({
      apiName: 'TFT17_Samira',
      variables: [{ name: 'Damage', value: [260, 360, 540, 810, 1380] }],
    });
    expect(getAbilityDamage(champ, 1, 0).damage).toBeCloseTo(260, 0);
    expect(getAbilityDamage(champ, 2, 0).damage).toBeCloseTo(360, 0);
    expect(getAbilityDamage(champ, 3, 0).damage).toBeCloseTo(540, 0);
  });

  it('AP scaling 정확 — Lissandra ★1 AP=100 → 200 × 2.0 = 400', () => {
    const champ = makeChamp({
      apiName: 'TFT17_Lissandra',
      variables: [{ name: 'Damage', value: [200, 250, 375, 600, 1020] }],
    });
    expect(getAbilityDamage(champ, 1, 100).damage).toBeCloseTo(400, 0);
    expect(getAbilityDamage(champ, 2, 100).damage).toBeCloseTo(500, 0);
    expect(getAbilityDamage(champ, 3, 100).damage).toBeCloseTo(750, 0);
  });
});

describe('getAbilityDamage — filler 챔프 회귀 (fix 후에도 정확 유지)', () => {
  it('Sentinel filler raw[0]=0 — ★1=raw[1], ★2=raw[2], ★3=raw[3]', () => {
    // 예: Mordekaiser InitialShield 패턴 (raw[0]=0). damage variable 도 동일 패턴 검증.
    // 0 sentinel filler 는 readVarByStar 에서 isFiller=true → idx=starLevel.
    const champ = makeChamp({
      apiName: 'TFT17_TestFiller',
      variables: [{ name: 'Damage', value: [0, 300, 375, 500, 650] }],
    });
    expect(getAbilityDamage(champ, 1, 0).damage).toBeCloseTo(300, 0);
    expect(getAbilityDamage(champ, 2, 0).damage).toBeCloseTo(375, 0);
    expect(getAbilityDamage(champ, 3, 0).damage).toBeCloseTo(500, 0);
  });

  it('Sentinel filler raw[0] > raw[1] (Poppy Shield 패턴) — ★1=raw[1]', () => {
    // Poppy Shield [300, 400, 475, 575, 675, 390, 390] 패턴: raw[0]=300, raw[1]=400.
    // 그러나 Poppy Shield 는 non-filler (300 <= 400). 다른 예: Resists [36, 15, 25] (raw[0]>raw[1]).
    const champ = makeChamp({
      apiName: 'TFT17_TestSentinelLarge',
      variables: [{ name: 'Damage', value: [36, 15, 25, 60, 100] }],
    });
    // v0=36, v1=15, v0 > v1 → isFiller=true → idx=starLevel.
    expect(getAbilityDamage(champ, 1, 0).damage).toBeCloseTo(15, 0);
    expect(getAbilityDamage(champ, 2, 0).damage).toBeCloseTo(25, 0);
    expect(getAbilityDamage(champ, 3, 0).damage).toBeCloseTo(60, 0);
  });
});
