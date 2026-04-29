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

// === 스킬 시전 ===
export const CAST_TIME = 0.5; // 스킬 시전 후 행동 불가 시간 (초)
export const CAST_TICKS = Math.round(CAST_TIME * TICKS_PER_SECOND); // 15틱
export const SELF_BUFF_CAST_TIME = 0.25; // 자기 버프 스킬 시전 시간 (초)
export const SELF_BUFF_CAST_TICKS = Math.round(SELF_BUFF_CAST_TIME * TICKS_PER_SECOND); // 7~8틱

// === 전투 시작 ===
export const INITIAL_ATTACK_DELAY = 0.3; // 전투 시작 시 최대 랜덤 딜레이 (초)

// === 마나 (legacy 호환, Role별 마나는 mana.ts 사용) ===
export const MANA_PER_ATTACK = 10;
export const MANA_PER_DAMAGE_RATIO = 0.01;

// === Board (hex.ts에서 re-export) ===
export { BOARD_ROWS, BOARD_COLS, HEX_SIZE, HEX_WIDTH, HEX_HEIGHT } from '@/lib/simulator/models/hex';

// === Unit (unit.ts에서 re-export) ===
export { MAX_TEAM_SIZE } from '@/lib/simulator/models/unit';

// === Builder ===
export const DEFAULT_STAR_LEVEL = 2;

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
  // 빌지워터 스탯 아이템 키
  'BonusAS': 'as',
  'BonusAD': 'ad',
  'BonusAP': 'ap',
  // 공허 돌연변이 키
  'MaxHealth': 'hp',
  'MaxHP': 'hp',
  'ADAP': 'adap',
  // 유물/찬란한/시너지 전용 아이템의 기본 스탯 키
  'AttackSpeed': 'as',
  'CritDamageBonusPercent': 'critDamage',
  // Set 17 named stat keys (item-effect-engine Phase 5 Part 2)
  // 피바라기 StatOmnivamp(0.2), 공감 임플란트 base ManaRegen(2), Shojin/Archangels ManaRegen(1)
  'StatOmnivamp': 'omnivamp',
  'ManaRegen': 'manaRegen',
};

// === 스탯 이름 한글화 ===
export const STAT_NAME_KO: Record<string, string> = {
  // 기본 스탯
  'AD': '공격력',
  'AP': '주문력',
  'AS': '공격 속도',
  'Health': '체력',
  'MaxHealth': '최대 체력',
  'Armor': '방어력',
  'MagicResist': '마법 저항력',
  'CritChance': '치명타 확률',
  'CritDamageToGive': '치명타 피해',
  'Mana': '마나',
  'ManaReduction': '마나 감소',
  'MRShred': '마법 관통력',
  'ARReductionAmount': '방어 관통력',
  // 빌지워터
  'BonusAS': '공격 속도',
  'BonusAD': '공격력',
  'BonusAP': '주문력',
  'BonusArmorMR': '방어력/마저',
  'BonusHealthPercent': '체력%',
  // 전투 효과
  'DamageAmp': '피해 증폭',
  'BaseDamageAmp': '기본 피해 증폭',
  'DamageRepeat': '피해 반복',
  'DamageReduction': '피해 감소',
  'Omnivamp': '모든 피해 흡혈',
  'StatOmnivamp': '흡혈',
  'HealPercent': '회복%',
  'HealingShielding': '회복/보호막 강화',
  'PercentHealthShield': '체력% 보호막',
  'PercentHealthDamage': '체력% 피해',
  'Tenacity': '강인함',
  'AttackSpeed': '공격 속도',
  'AbilityPower': '주문력',
  'ManaGen': '마나 재생',
  'ManaRegen': '마나 재생',
  'ManaSpent': '마나 소모',
  'Duration': '지속 시간',
  'NumEnemies': '대상 수',
  'NumTargets': '대상 수',
  'NumMissiles': '투사체 수',
  'NumAttacks': '공격 횟수',
  'FlatDamage': '고정 피해',
  'MaxHealthRatio': '최대 체력 비율',
  'BleedDamagePercent': '출혈 피해%',
  'ExecuteThreshold': '처형 기준',
  'BonusSerpents': '뱀 추가',
  'SerpentTimer': '뱀 타이머',
  'HealthRegenInterval': '체력 회복 주기',
  'BonusADPerKill': '처치당 공격력',
  'BonusAPPerKill': '처치당 주문력',
  'ADPerStack': '중첩당 공격력',
  'ASPerStack': '중첩당 공격 속도',
  'Timer': '타이머',
  'TickRate': '발동 주기',
  'SlashADPercent': '베기 공격력%',
  'DashCooldown': '돌진 쿨다운',
  'HexRadius': '범위(칸)',
  'InventionFireTime': '발동 시간',
  'ADAP': '공격력/주문력',
  // 기타
  'SizeIncrease': '크기 증가',
  'MaxHealthGain': '최대 체력 증가',
  'CastBreakpoint': '시전 기준',
  'RepeatSeconds': '반복 주기',
  'ManaRefill': '마나 충전',
  'RefillDuration': '충전 지속',
  'ManaCostIncrease': '마나 비용 증가',
  'FailureMaxHealthDamage': '실패 시 체력% 피해',
  'SuccessMaxHealthDamage': '성공 시 체력% 피해',
  'TankDamageAmp': '탱커 추가 피해',
  'DamageOutput': '피해 출력',
  'NumUnitsToCopy': '복제 유닛 수',
  'PercentHealthOfOriginal': '원본 체력%',
  'GoldChance': '골드 확률',
  'RollsPerCastBreakpoint': '시전당 굴림',
  'DamageRequirement': '필요 피해량',
  'Interval': '간격',
  'BaseDamage': '기본 피해',
  'DamageStored': '저장 피해',
  'ShedRefresh': '탈피 주기',
  'UntargetableDuration': '무적 시간',
  'ArrowBaseADDamage': '화살 공격력',
  'ArrowPercentFalloff': '화살 감쇠',
  'BonusPercentHP': '추가 체력%',
  'FirstHealthThreshold': '체력 기준',
};
