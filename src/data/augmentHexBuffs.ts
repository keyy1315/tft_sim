import type { HexBuff, HexCoord, PlacedChampion } from '@/types';
import { offsetToAxial, axialToOffset } from '@/types';

/** 칸 버프 증강 resolver: 증강 apiName → 팀 구성 기반 HexBuff 생성 */
export type HexBuffResolver = (team: PlacedChampion[]) => HexBuff;

/** 전방 2열 (offset row 0, 1) */
const FRONT_ROWS = [0, 1];
/** 후방 2열 (offset row 2, 3) */
const BACK_ROWS = [2, 3];
const COLS = 7;

/** offset row → axial HexCoord 배열 */
function fullRow(row: number): HexCoord[] {
  return Array.from({ length: COLS }, (_, col) => offsetToAxial({ row, col }));
}

function fullRows(rows: number[]): HexCoord[] {
  return rows.flatMap(row => fullRow(row));
}

/** 팀 내 offset row 기준 유닛 수 */
function countInRows(team: PlacedChampion[], rows: number[]): number {
  return team.filter(c => rows.includes(axialToOffset(c.position).row)).length;
}

export const HEX_BUFF_AUGMENTS: Record<string, HexBuffResolver> = {
  // 야스오의 황금 칸 — 1칸, 이동 가능
  'TFT17_Augment_YasuoGodAugment_GoldenHex': () => ({
    augmentApiName: 'TFT17_Augment_YasuoGodAugment_GoldenHex',
    positions: [offsetToAxial({ row: 0, col: 3 })],
    movable: true,
    effects: { hp: 250, attackSpeed: 0.25 },
    color: '#FFD700',
    label: '황금 칸',
  }),

  // 중심 잡기 — 전방 1열 중앙 고정
  'TFT_Augment_FindYourCenter': () => ({
    augmentApiName: 'TFT_Augment_FindYourCenter',
    positions: [offsetToAxial({ row: 0, col: 3 })],
    movable: false,
    effects: { damageAmp: 0.15, hpPercent: 0.25 },
    color: '#FF6B35',
    label: '중심 잡기',
  }),

  // 유리 대포 I — 후방 1열 (row 3)
  'TFT_Augment_GlassCannonI': () => ({
    augmentApiName: 'TFT_Augment_GlassCannonI',
    positions: fullRow(3),
    movable: false,
    effects: { hpPercent: -0.2, damageAmp: 0.16 },
    color: '#E74C3C',
    label: '유리 대포 I',
  }),

  // 유리 대포 II — 후방 1열 (row 3)
  'TFT_Augment_GlassCannonII': () => ({
    augmentApiName: 'TFT_Augment_GlassCannonII',
    positions: fullRow(3),
    movable: false,
    effects: { hpPercent: -0.2, damageAmp: 0.25 },
    color: '#C0392B',
    label: '유리 대포 II',
  }),

  // 정렬 — 전방 2열 유닛 수 비례 AR/MR
  'TFT_Augment_Lineup': (team) => {
    const frontCount = countInRows(team, FRONT_ROWS);
    return {
      augmentApiName: 'TFT_Augment_Lineup',
      positions: fullRows(FRONT_ROWS),
      movable: false,
      effects: { armor: 2 * frontCount, magicResist: 2 * frontCount },
      color: '#3498DB',
      label: '정렬',
    };
  },

  // 권투 교습 — 전방 유닛당 체력 +30
  'TFT_Augment_BoxingLessons': (team) => {
    const frontCount = countInRows(team, FRONT_ROWS);
    return {
      augmentApiName: 'TFT_Augment_BoxingLessons',
      positions: fullRows(FRONT_ROWS),
      movable: false,
      effects: { hp: 30 * frontCount },
      color: '#E67E22',
      label: '권투 교습',
    };
  },

  // 진형 유지 — 후방 2열, 전방 유닛당 AP/AD
  'TFT_Augment_HoldTheLine': (team) => {
    const frontCount = countInRows(team, FRONT_ROWS);
    return {
      augmentApiName: 'TFT_Augment_HoldTheLine',
      positions: fullRows(BACK_ROWS),
      movable: false,
      effects: { ap: 10 * frontCount, ad: 9 * frontCount },
      color: '#9B59B6',
      label: '진형 유지',
    };
  },

  // 쌍둥이 수호자 — 전방 정확히 2명일 때만
  'TFT_Augment_TwinGuardians': (team) => {
    const frontUnits = team.filter(c => FRONT_ROWS.includes(axialToOffset(c.position).row));
    const active = frontUnits.length === 2;
    return {
      augmentApiName: 'TFT_Augment_TwinGuardians',
      positions: active ? frontUnits.map(c => c.position) : [],
      movable: false,
      effects: active ? { hp: 100, armor: 45, magicResist: 45 } : {},
      color: '#1ABC9C',
      label: '쌍둥이 수호자',
    };
  },

  // 후방 지원 — 후방 2열 4명 이상 시 전체 아군 AS
  'TFT_Augment_Backup': (team) => {
    const backCount = countInRows(team, BACK_ROWS);
    const active = backCount >= 4;
    return {
      augmentApiName: 'TFT_Augment_Backup',
      positions: active ? fullRows([0, 1, 2, 3]) : [],
      movable: false,
      effects: active ? { attackSpeed: 0.12 } : {},
      color: '#2ECC71',
      label: '후방 지원',
    };
  },
};

/** 증강 목록 + 팀 구성에서 활성 칸 버프 계산 */
export function resolveHexBuffs(
  augmentApiNames: string[],
  team: PlacedChampion[],
): HexBuff[] {
  const buffs: HexBuff[] = [];
  for (const apiName of augmentApiNames) {
    const resolver = HEX_BUFF_AUGMENTS[apiName];
    if (resolver) buffs.push(resolver(team));
  }
  return buffs;
}

/** 해당 apiName이 칸 버프 증강인지 확인 */
export function isHexBuffAugment(apiName: string): boolean {
  return apiName in HEX_BUFF_AUGMENTS;
}
