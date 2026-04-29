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

/** 쉔의 "보루" 시너지(TFT17_ShenUniqueTrait)로 자동 소환되는 유물.
 * 이동/공격 없고 이펙트만 담당 (totem). 전투 시작 시 인접 아군에게 shield + attackSpeed 부여. */
export const SHEN_ARTIFACT_CHAMPION: RawChampion = {
  name: '유물',
  apiName: 'TFT17_ShenProp',
  cost: 11,
  traits: [],
  role: null,
  stats: { armor: 60, attackSpeed: 0, critChance: 0, critMultiplier: 1.0, damage: 0, hp: 1000, initialMana: 0, magicResist: 60, mana: 0, range: 0 },
  ability: { name: '수호 유물', desc: '전투 시작 시 인접 아군에게 최대 체력 비례 보호막과 공격 속도를 부여합니다.', icon: '', variables: [] },
};

/**
 * 태고족 우두머리 (TFT17_Enemy_Aatrox).
 * 군체의 심장(TFT17_Augment_PrimordianPrismaticAugment) 활성 + 레벨 10 +
 * 서로 다른 3성 유닛 6명 배치 시 자동 소환 (3성 고정).
 *
 * 사용자가 위치는 변경할 수 있으나 아이템 장착 불가.
 * cost=11 마스킹 (champions.json 의 cost=5 는 traits=[] 라서 일반 풀에서 자연 제외됨).
 * stats / ability 는 17.2 LIVE CDragon raw 데이터 기반.
 */
export const PRIMORDIAN_BOSS_CHAMPION: RawChampion = {
  name: '태고족 우두머리',
  apiName: 'TFT17_Enemy_Aatrox',
  cost: 11,
  traits: [],
  role: 'ADTank' as RawChampion['role'],
  stats: {
    armor: 150,
    attackSpeed: 0.9,
    critChance: 0.25,
    critMultiplier: 1.4,
    damage: 90,
    hp: 8452,
    initialMana: 50,
    magicResist: 150,
    mana: 85,
    range: 1,
  },
  ability: {
    name: '종말의 선지자',
    desc: '기본 지속 효과: 검들이 격자 형태로 날아가 적중한 적에게 물리 피해. 사용 시: 검 20개를 공중으로 날리고 내구력 75%, 착지 시 HexRange=1 칸 적에게 물리 피해.',
    icon: '',
    variables: [
      { name: 'GridADDamage', value: [200, 200, 200, 200, 200, 200, 200] },
      { name: 'GridAPDamage', value: [200, 200, 200, 200, 200, 200, 200] },
      { name: 'SwordAoEADDamage', value: [800, 800, 800, 800, 800, 800, 800] },
      { name: 'SwordAoEAPDamage', value: [800, 800, 800, 800, 800, 800, 800] },
      { name: 'NumSwords', value: [20, 20, 20, 20, 20, 20, 20] },
      { name: 'HexRange', value: [1, 1, 1, 1, 1, 1, 1] },
      { name: 'Durability', value: [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75] },
    ],
  },
};

/**
 * 암흑의 별 (6) tier Supermassive 시너지로 자동 소환되는 소형 블랙홀.
 * 17.2 raw: TFT17_DarkStar_FakeUnit, hp=1, range=0, role='APTank'.
 * 사용자 위치 변경 가능, 아이템 장착 불가, 이동/공격 안 함 (range=0 + attackSpeed=0 강제).
 * (6) DarkStar 시너지 활성 시 2개 자동 보드 추가, 비활성 시 제거.
 */
export const DARKSTAR_BLACKHOLE_CHAMPION: RawChampion = {
  name: '소형 블랙홀',
  apiName: 'TFT17_DarkStar_FakeUnit',
  cost: 11,
  traits: [],
  role: 'APTank' as RawChampion['role'],
  stats: {
    armor: 40,
    attackSpeed: 0, // 시뮬에서 공격 비활성 (raw 4.95 무시)
    critChance: 0,
    critMultiplier: 0,
    damage: 0, // 시뮬에서 damage 비활성 (raw 421 무시)
    hp: 1,
    initialMana: 0,
    magicResist: 40,
    mana: 0,
    range: 0, // 공격 대상 못 잡음 — 이동/공격 자연 비활성
  },
  ability: {
    name: '중력 붕괴',
    desc: '초신성에 의해 생성된 소형 블랙홀입니다.',
    icon: 'ASSETS/Characters/TFT17_DarkStar_FakeUnit/HUD/TFT17_DarkStar_FakeUnit_SmallSplash.TFT_Set17.tex',
    variables: [],
  },
};

export const AUTO_UNIT_API_NAMES = [
  'TFT16_AnnieTibbers',
  'TFT16_FreljordTurret',
  'TFT16_AzirSoldier',
  'TFT17_Summon',
  'TFT17_ShenProp',
  'TFT17_Enemy_Aatrox',
  'TFT17_DarkStar_FakeUnit',
] as const;

/**
 * 자동 소환 unit 중 아이템 장착 불가 (장비 슬롯 사용 차단).
 * - TFT17_Enemy_Aatrox: 군체의 심장으로 소환되는 보스, 사용자 정책상 아이템 장착 불가.
 * - TFT17_ShenProp: 유물 totem, 능력 외 stat slot 없음.
 * - TFT16_AzirSoldier: 모래 병사, 황제 의존이라 아이템 슬롯 비활성.
 * - TFT16_FreljordTurret: 포탑.
 *
 * 비아와 바이엔(TFT17_Summon), 티버(TFT16_AnnieTibbers) 는 일반 챔프처럼 아이템 가능.
 */
export const NO_ITEM_AUTO_UNIT_API_NAMES: ReadonlySet<string> = new Set([
  'TFT16_FreljordTurret',
  'TFT16_AzirSoldier',
  'TFT17_ShenProp',
  'TFT17_Enemy_Aatrox',
  'TFT17_DarkStar_FakeUnit',
]);

export function isAutoUnit(apiName: string): boolean {
  return (AUTO_UNIT_API_NAMES as readonly string[]).includes(apiName);
}

/** 자동 소환 unit 이면서 아이템 장착이 금지된 경우. DnD/UI 가 슬롯 비활성화 시 활용. */
export function isNoItemAutoUnit(apiName: string): boolean {
  return NO_ITEM_AUTO_UNIT_API_NAMES.has(apiName);
}
