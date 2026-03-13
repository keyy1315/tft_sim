/**
 * 시뮬레이션 상수 — 중앙 관리
 * 분리된 모델(unit.ts, ability.ts, hex.ts)에서도 re-export
 */

// === Tick 설정 ===
export const TICKS_PER_SECOND = 30;
export const TICK_DURATION = 1 / TICKS_PER_SECOND; // ~0.0333s per tick
export const MAX_COMBAT_TIME = 60; // seconds
export const MAX_TICKS = MAX_COMBAT_TIME * TICKS_PER_SECOND; // 1800 ticks

// === 이동 ===
export const MOVE_SPEED = 0.5; // seconds per hex

// === 마나 (legacy 호환, Role별 마나는 mana.ts 사용) ===
export const MANA_PER_ATTACK = 10;
export const MANA_PER_DAMAGE_RATIO = 0.01;

// === Board (hex.ts에서 re-export) ===
export { BOARD_ROWS, BOARD_COLS, HEX_SIZE, HEX_WIDTH, HEX_HEIGHT } from '@/lib/simulator/models/hex';

// === Unit (unit.ts에서 re-export) ===
export { MAX_TEAM_SIZE } from '@/lib/simulator/models/unit';

// === Item effect key mapping ===
export const ITEM_EFFECT_KEYS: Record<string, string> = {
  'AD': 'ad',
  'AP': 'ap',
  'AS': 'as',
  'Health': 'hp',
  'Armor': 'armor',
  'MagicResist': 'magicResist',
  'CritChance': 'critChance',
  'CritDamageToGive': 'critDamage',
  'Mana': 'mana',
  'MRShred': 'magicPen',
  'ARReductionAmount': 'armorPen',
};
