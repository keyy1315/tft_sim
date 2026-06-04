/**
 * 회귀 가드 — synergy scaling 배열 off-by-one (PR #185 Codex catch).
 *
 * `applySet17SynergyBuffs` (combatLoop.ts) 는 활성 tier 를
 *   `ti = trait.effects.findIndex(e => e === activeEffect)` (0-based)
 * 로 구해 `scaling.json synergies[...][ti]` 를 인덱싱한다.
 *
 * 따라서 scaling.json synergies 배열은 raw effects 와 1:1 정렬 (idx 0 = 첫 활성 tier) 이어야 한다.
 * leading inactive `0` 이 있으면 첫 tier 에서 0 이 적용되어 효과가 사라진다.
 *
 * 버그: 도전자/전달자/구원자/불한당 배열에 leading-0 이 있어
 *   2도전자 AS 0 / 2전달자 마나재생 0 / 2불한당 ADAP 0 / 구원자 stat 0 으로 적용되던 것을
 *   scaling.json leading-0 제거로 수정. 습격자(MeleeTrait)는 원래 정상 (leading-0 없음).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getSynergyScaling, setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';

const { traits } = loadServerCatalogs();

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

describe('synergy scaling off-by-one 회귀 가드 (PR #185)', () => {
  it('도전자/전달자/구원자/불한당 첫 tier (idx 0) 효과 non-zero', () => {
    const as = getSynergyScaling('TFT17_ASTrait')!;
    expect((as.teamwideAS as number[])[0]).toBeGreaterThan(0);
    expect((as.championAS as number[])[0]).toBeGreaterThan(0);

    const mana = getSynergyScaling('TFT17_ManaTrait')!;
    expect((mana.teamManaRegen as number[])[0]).toBeGreaterThan(0);
    expect((mana.channelerManaRegen as number[])[0]).toBeGreaterThan(0);

    const ass = getSynergyScaling('TFT17_AssassinTrait')!;
    expect((ass.adap as number[])[0]).toBeGreaterThan(0);

    const rha = getSynergyScaling('TFT17_RhaastUniqueTrait')!;
    expect((rha.offensiveStat as number[])[0]).toBeGreaterThan(0);
    expect((rha.defensiveStat as number[])[0]).toBeGreaterThan(0);
  });

  it('도전자 2도전자(ti=0) teamwideAS=0.1 / championAS=0.2 (raw 첫 tier 정합)', () => {
    const as = getSynergyScaling('TFT17_ASTrait')!;
    expect((as.teamwideAS as number[])[0]).toBeCloseTo(0.1, 3);
    expect((as.championAS as number[])[0]).toBeCloseTo(0.2, 3);
  });

  it('tier breakpoint trait (도전자/전달자/불한당) 배열 길이 = effects 개수 (1:1 정렬)', () => {
    for (const api of ['TFT17_ASTrait', 'TFT17_ManaTrait', 'TFT17_AssassinTrait']) {
      const t = traits.find(x => x.apiName === api)!;
      const sc = getSynergyScaling(api)!;
      const arrFields = Object.keys(sc).filter(k => Array.isArray(sc[k]));
      for (const f of arrFields) {
        expect((sc[f] as number[]).length).toBe(t.effects.length);
      }
    }
  });

  it('습격자(MeleeTrait) 첫 tier 정상 유지 (회귀 가드 — 미수정 대상)', () => {
    const melee = getSynergyScaling('TFT17_MeleeTrait')!;
    expect((melee.championOmnivamp as number[])[0]).toBeCloseTo(0.05, 3);
    expect((melee.championAD as number[])[0]).toBeCloseTo(0.2, 3);
  });
});
