/**
 * 회귀 가드 — 일반화 self-heal resolver (heal find generalization).
 * spec: docs/superpowers/specs/2026-06-11-heal-find-generalization-design.md
 */
import { describe, it, expect } from 'vitest';
import { classifyHealVar } from '@/lib/simulator/engine/combatLoop';

describe('classifyHealVar — positive 패턴 + exclusion', () => {
  it('positive heal 변수 → amount', () => {
    for (const n of [
      'PercentMaximumHealthHealing', 'APHealing', 'HealingPercentHealth', 'HealingAP',
      'HEALING', 'Heal', 'HealHP', 'HealAP', 'HealAmount', 'APHeal',
      'APHealthGain', 'PercentHPHealthGain', 'PercentHealing',
    ]) {
      expect(classifyHealVar(n)).toBe('amount');
    }
  });

  it('HealthDrain → drain', () => {
    expect(classifyHealVar('HealthDrain')).toBe('drain');
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
