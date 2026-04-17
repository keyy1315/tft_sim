import { RawChampion } from '@/types';

export const FRELJORD_TURRET: RawChampion = {
  name: '얼어붙은 포탑',
  apiName: 'TFT16_FreljordTurret',
  cost: 0,
  traits: [],
  role: null,
  stats: { armor: 40, attackSpeed: 1.0, critChance: 0, critMultiplier: 1.5, damage: 50, hp: 800, initialMana: 0, magicResist: 40, mana: 0, range: 3 },
  ability: { name: '냉기 사격', desc: '전방: 체력 버프, 후방: 피해 증폭', icon: '', variables: [] },
};

export const TIBBERS_CHAMPION: RawChampion = {
  name: '티버',
  apiName: 'TFT16_AnnieTibbers',
  cost: 11,
  traits: ['비전 마법사'],
  role: null,
  stats: { armor: 80, attackSpeed: 0.75, critChance: 0.25, critMultiplier: 1.4, damage: 90, hp: 1500, initialMana: 40, magicResist: 80, mana: 100, range: 1 },
  ability: { name: '잉걸불의 분노', desc: '', icon: '', variables: [] },
};

export const AZIR_SOLDIER_CHAMPION: RawChampion = {
  name: '모래 병사',
  apiName: 'TFT16_AzirSoldier',
  cost: 11,
  traits: [],
  role: null,
  stats: { armor: 50, attackSpeed: 0.8, critChance: 0.25, critMultiplier: 1.4, damage: 0, hp: 750, initialMana: 0, magicResist: 50, mana: 100, range: 1 },
  ability: { name: '보초병', desc: '이동/기본공격 불가. 황제 사망 시 함께 사망.', icon: '', variables: [] },
};

export const AZIR_MAX_SOLDIERS = 2;

export const VOYAGER_SUMMON_CHAMPION: RawChampion = {
  name: '비아와 바이엔',
  apiName: 'TFT17_Summon',
  cost: 11,
  traits: [],
  role: 'APTank' as RawChampion['role'],
  stats: { armor: 0, attackSpeed: 0.6, critChance: 0.25, critMultiplier: 1.4, damage: 20, hp: 320, initialMana: 0, magicResist: 0, mana: 50, range: 1 },
  ability: { name: '울음소리', desc: 'AA 추가 마법 피해 + 보호막 + 아군 AP 버프', icon: '', variables: [] },
};

export const AUTO_UNIT_API_NAMES = [
  'TFT16_AnnieTibbers',
  'TFT16_FreljordTurret',
  'TFT16_AzirSoldier',
  'TFT17_Summon',
] as const;

export function isAutoUnit(apiName: string): boolean {
  return (AUTO_UNIT_API_NAMES as readonly string[]).includes(apiName);
}
