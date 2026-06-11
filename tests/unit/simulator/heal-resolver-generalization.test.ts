/**
 * 회귀 가드 — 일반화 self-heal resolver (heal find generalization).
 * spec: docs/superpowers/specs/2026-06-11-heal-find-generalization-design.md
 */
import { describe, it, expect } from 'vitest';
import { classifyHealVar, resolveSelfHeal, simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { CombatUnit, RawChampion } from '@/types';

const { champions } = loadServerCatalogs();
function champ(api: string): RawChampion { return champions.find(c => c.apiName === api)!; }

/** resolveSelfHeal 는 unit.champion.ability.variables / starLevel / maxHp / stats.ap 만 read.
 *  최소 mock 으로 충분 (나머지 필드 미사용). */
function mockUnit(api: string, opts: { starLevel?: number; maxHp?: number; ap?: number } = {}): CombatUnit {
  return {
    champion: champ(api),
    starLevel: opts.starLevel ?? 1,
    maxHp: opts.maxHp ?? 1000,
    stats: { ap: opts.ap ?? 0 },
  } as unknown as CombatUnit;
}

describe('classifyHealVar — positive 패턴 + exclusion', () => {
  it('positive heal 변수 → amount', () => {
    for (const n of [
      'PercentMaximumHealthHealing', 'APHealing', 'HealingPercentHealth', 'HealingAP',
      'HEALING', 'Heal', 'HealHP', 'HealAP', 'HealAmount', 'APHeal',
      'APHealthGain', 'PercentHPHealthGain',
    ]) {
      expect(classifyHealVar(n)).toBe('amount');
    }
  });

  it('HealthDrain → drain', () => {
    expect(classifyHealVar('HealthDrain')).toBe('drain');
  });

  it('PercentHealing → damagePercent (Fiora — 입힌 피해의 %, maxHp% 아님. codex P2)', () => {
    expect(classifyHealVar('PercentHealing')).toBe('damagePercent');
    // maxHp% 변수("Health" 포함)는 damagePercent 아님 — 'amount' 유지
    expect(classifyHealVar('PercentMaximumHealthHealing')).toBe('amount');
    expect(classifyHealVar('HealingPercentHealth')).toBe('amount');
  });

  it('exclusion — "Health" false-positive / amp / shield / duration 차단 → null', () => {
    for (const n of [
      'HealDuration', 'HealthGainDuration', 'HealingAndShieldingPerAstro', 'MeepsPerAstro',
      'PercentHealingToShield', 'AuraHealing',
      'HealingReduction', 'AllyHealing', 'HealingIncrease',
      'PercentMaximumHealthDamage', 'BonusHealthOnKill', 'BonusHealthPerCast', 'HealthThreshold',
    ]) {
      expect(classifyHealVar(n)).toBeNull();
    }
  });
});

describe('resolveSelfHeal — readVarByStar 일괄 인덱싱 합산', () => {
  it('Reksai ★1 = maxHp×0.065 + APHealing 90 (off-by-one 교정 — 200 아님)', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Reksai', { maxHp: 1000, ap: 0 }), 1)).toBe(155);
  });

  it('IvernMinion ★1 = maxHp×0.08 + HealingAP 80 (edge case readVarByStar)', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_IvernMinion', { maxHp: 1000, ap: 0 }), 1)).toBe(160);
  });

  it('Illaoi ★1 = HealthDrain 40 × min(NumEnemies, aliveCount=1) = 40', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Illaoi', { maxHp: 1000, ap: 0 }), 1)).toBe(40);
  });

  it('Morgana ★1 = 0 (현재 raw data: Shield/Tether/OmnivampPercent 만 존재 — heal 변수 없음)', () => {
    // 플랜 원본: APHealthGain 600 + maxHp×0.15 + APHealing 100 = 850 기대.
    // node -e 확인 결과 현재 tft_set17_champions.json 에 해당 변수 없음 → 실제 값 0.
    expect(resolveSelfHeal(mockUnit('TFT17_Morgana', { maxHp: 1000, ap: 0 }), 1)).toBe(0);
  });

  it('Aatrox ★1 = maxHp×0.10 + HealAP 150 = 250 (신규 반영)', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Aatrox', { maxHp: 1000, ap: 0 }), 1)).toBe(250);
  });

  it('Chogath = 0 (heal 변수 0개 — HealthDamage/HealthOnKill/PerCast 전부 exclusion)', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Chogath', { maxHp: 2000, ap: 0 }), 3)).toBe(0);
  });

  it('Fiora PercentHealing = 입힌 피해의 15% (maxHp 아님 — codex P2 PR #216)', () => {
    // abilityDamageDealt=1000 → 1000×0.15=150 (maxHp 무관). maxHp 1200 이어도 maxHp×0.15=180 아님.
    expect(resolveSelfHeal(mockUnit('TFT17_Fiora', { maxHp: 1200, ap: 0 }), 1, 1000)).toBe(150);
    // damage 0 (또는 미전달) → heal 0 (피해 무관 maxHp% 회복 버그 회귀 가드)
    expect(resolveSelfHeal(mockUnit('TFT17_Fiora', { maxHp: 1200, ap: 0 }), 1)).toBe(0);
  });

  it('AP scaling 적용 — Reksai ap=100 → maxHp×0.065 + 90×2 = 65 + 180 = 245', () => {
    expect(resolveSelfHeal(mockUnit('TFT17_Reksai', { maxHp: 1000, ap: 100 }), 1)).toBe(245);
  });
});

describe('통합 — 5 신규 반영 챔프 cast 후 정상 종료 (heal 배선 crash 없음)', () => {
  const { traits } = loadServerCatalogs();
  function placedU(api: string, q: number, r: number) {
    return { champion: champ(api), starLevel: 2, position: { q, r }, items: [] };
  }
  for (const api of ['TFT17_IvernMinion', 'TFT17_Aatrox', 'TFT17_Rhaast', 'TFT17_TahmKench', 'TFT17_Fiora']) {
    it(`${api} cast → 정상 종료 (heal 반영 crash 없음)`, () => {
      const result = simulateCombat([placedU(api, 4, 3)], [placedU('TFT17_Graves', 4, 4)], {
        seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      });
      expect(result.duration).toBeGreaterThan(0);
    });
  }
});
