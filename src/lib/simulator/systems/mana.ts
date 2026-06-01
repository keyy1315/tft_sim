/**
 * Role별 마나 획득 시스템 (Patch 15.1 Roles Revamped 기준)
 *
 * | Role       | 공격당 마나 | 초당 마나 | 피격 시 마나 |
 * |------------|-----------|---------|------------|
 * | Tank       | 5         | 0       | ✅          |
 * | Fighter    | 10        | 0       | ❌          |
 * | Marksman   | 10        | 0       | ❌          |
 * | Caster     | 7         | 2       | ❌          |
 * | Assassin   | 10        | 0       | ❌          |
 * | Specialist | 10        | 0       | ❌ (고유)    |
 */

import { CombatUnit, UnitRole } from '@/types';

interface ManaConfig {
  manaPerAttack: number;
  manaPerSecond: number;
  manaFromDamage: boolean;
}

const ROLE_MANA_CONFIG: Record<UnitRole, ManaConfig> = {
  Tank:       { manaPerAttack: 5,  manaPerSecond: 0, manaFromDamage: true },
  Fighter:    { manaPerAttack: 10, manaPerSecond: 0, manaFromDamage: false },
  Marksman:   { manaPerAttack: 10, manaPerSecond: 0, manaFromDamage: false },
  Caster:     { manaPerAttack: 7,  manaPerSecond: 2, manaFromDamage: false },
  Assassin:   { manaPerAttack: 10, manaPerSecond: 0, manaFromDamage: false },
  Specialist: { manaPerAttack: 10, manaPerSecond: 0, manaFromDamage: false },
};

export function getManaConfig(role: UnitRole): ManaConfig {
  return ROLE_MANA_CONFIG[role];
}

/**
 * 전달자 (TFT17_ManaTrait) InnateManaGain 곱셈자.
 * raw audit 발견 (PR #64): 0.20 일 때 mana 가산 × 1.20.
 * unit.channelerInnateManaGain 활성 시에만 적용 (전달자 unit 한정).
 */
function channelerMultiplier(unit: CombatUnit): number {
  return 1 + (unit.channelerInnateManaGain ?? 0);
}

/**
 * 공격 시 마나 획득
 * Caster가 스턴 상태이면 마나 획득 불가
 */
export function gainManaOnAttack(unit: CombatUnit): void {
  const isStunned = unit.statusEffects.some(e => e.type === 'stun');
  if (isStunned) return;

  const config = getManaConfig(unit.role);
  // 쇼진의 창 등 아이템 보너스 (FlatManaRestore) 누적 — applyItemStaticEffects 에서
  // 미리 unit.itemFlatManaPerAttack 으로 집계해둠. role 기본값 + item 보너스, channeler 곱셈자.
  const baseGain = config.manaPerAttack + (unit.itemFlatManaPerAttack ?? 0);
  const gain = baseGain * channelerMultiplier(unit);
  unit.currentMana = Math.min(unit.maxMana, unit.currentMana + gain);
}

/**
 * 틱마다 마나 재생 (Caster 전용: 2 마나/초)
 * 스턴 상태이면 재생 중단
 */
export function gainManaPerTick(unit: CombatUnit, tickDuration: number): void {
  const isStunned = unit.statusEffects.some(e => e.type === 'stun');
  if (isStunned) return;

  const config = getManaConfig(unit.role);
  if (config.manaPerSecond <= 0) return;

  const manaGain = config.manaPerSecond * tickDuration * channelerMultiplier(unit);
  unit.currentMana = Math.min(unit.maxMana, unit.currentMana + manaGain);
}

/**
 * 피격 시 마나 획득 (Tank 전용)
 * 피해량의 HP 비율에 비례 (최대 42.5)
 */
export function gainManaOnDamageTaken(unit: CombatUnit, damageTaken: number): void {
  const config = getManaConfig(unit.role);
  if (!config.manaFromDamage) return;

  const baseGain = Math.min(42.5, (damageTaken / unit.maxHp) * 100 * 0.7);
  const manaGain = baseGain * channelerMultiplier(unit);
  unit.currentMana = Math.min(unit.maxMana, unit.currentMana + manaGain);
}
