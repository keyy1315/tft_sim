import { RawChampion, TeamPlannerEntry, TeamCodeDecodeResult, PlacedChampion, offsetToAxial, mapGameRole } from '@/types';
import { BOARD_COLS } from '@/lib/simulator/models/constants';

const SUFFIX = 'TFTSet16';
const TOTAL_BITS = 128;
const HEADER_BITS = 10;
const SLOT_BITS = 12;
const CODE_BITS = 10;
const STAR_BITS = 2;
const MAX_SLOTS = 9;

function hexToBits(hex: string): string {
  const n = BigInt('0x' + hex);
  return n.toString(2).padStart(TOTAL_BITS, '0');
}

function bitsToHex(bits: string): string {
  const n = BigInt('0b' + bits);
  return n.toString(16).padStart(TOTAL_BITS / 4, '0');
}

export function decodeTeamCode(
  code: string,
  mapping: TeamPlannerEntry[],
  champions: RawChampion[],
): TeamCodeDecodeResult {
  if (!code.endsWith(SUFFIX)) {
    throw new Error('유효하지 않은 팀 코드입니다');
  }

  const hex = code.slice(0, -SUFFIX.length);
  if (hex.length !== 32 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('팀 코드 형식이 올바르지 않습니다');
  }

  const bits = hexToBits(hex);
  const header = parseInt(bits.slice(0, HEADER_BITS), 2);

  if (header > MAX_SLOTS) {
    throw new Error('팀 코드 형식이 올바르지 않습니다');
  }

  const result: TeamCodeDecodeResult = { champions: [], warnings: [] };

  // Always read all 9 slots — some codes have data beyond the header count
  for (let i = 0; i < MAX_SLOTS; i++) {
    const start = HEADER_BITS + i * SLOT_BITS;
    const plannerCode = parseInt(bits.slice(start, start + CODE_BITS), 2);
    const starLevel = parseInt(bits.slice(start + CODE_BITS, start + CODE_BITS + STAR_BITS), 2);

    if (plannerCode === 0) continue;

    const entry = mapping.find(m => m.teamPlannerCode === plannerCode);
    if (!entry) {
      result.warnings.push(`알 수 없는 코드: ${plannerCode}`);
      continue;
    }

    const champion = champions.find(c => c.apiName === entry.apiName);
    if (!champion) {
      result.warnings.push(`챔피언을 찾을 수 없습니다: ${entry.apiName}`);
      continue;
    }

    result.champions.push({
      champion,
      starLevel: starLevel || 2,
    });
  }

  return result;
}

export function encodeTeamCode(
  team: { champion: RawChampion; starLevel: number }[],
  mapping: TeamPlannerEntry[],
): string {
  const count = Math.min(team.length, MAX_SLOTS);
  let bits = count.toString(2).padStart(HEADER_BITS, '0');

  for (let i = 0; i < MAX_SLOTS; i++) {
    if (i < count) {
      const entry = mapping.find(m => m.apiName === team[i].champion.apiName);
      const code = entry?.teamPlannerCode ?? 0;
      // TFT team planner convention: 0=1star(default), 1=1star, 2=2star, 3=3star
      // Encode 1-star as 0 for compatibility with official team planner codes
      const star = team[i].starLevel <= 1 ? 0 : Math.min(team[i].starLevel, 3);
      bits += code.toString(2).padStart(CODE_BITS, '0');
      bits += star.toString(2).padStart(STAR_BITS, '0');
    } else {
      bits += '0'.repeat(SLOT_BITS);
    }
  }

  // Pad to 128 bits
  bits = bits.padEnd(TOTAL_BITS, '0');

  return bitsToHex(bits) + SUFFIX;
}

/** 역할군 기반 전방/후방 분류 */
const FRONT_ROLES = new Set(['Tank', 'Fighter', 'Assassin']);

/**
 * 역할군 기반 자동 배치.
 * - player: 전방 row 0→1, 후방 row 3→2 (이후 toEightRowCoords(+4)로 최종 4→5, 7→6)
 * - enemy:  전방 row 3→2, 후방 row 0→1
 */
export function autoPlaceChampions(
  decoded: { champion: RawChampion; starLevel: number }[],
  cols: number = BOARD_COLS,
  team: 'player' | 'enemy' = 'player',
): PlacedChampion[] {
  const front = decoded.filter(e => FRONT_ROLES.has(mapGameRole(e.champion.role)));
  const back = decoded.filter(e => !FRONT_ROLES.has(mapGameRole(e.champion.role)));

  const placed: PlacedChampion[] = [];

  if (team === 'player') {
    // 전방: row 0 → 1 (최종 4 → 5)
    front.forEach((entry, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      placed.push({ champion: entry.champion, position: offsetToAxial({ row: Math.min(row, 1), col }), starLevel: entry.starLevel, items: [] });
    });
    // 후방: row 3 → 2 (최종 7 → 6)
    back.forEach((entry, idx) => {
      const row = 3 - Math.floor(idx / cols);
      const col = idx % cols;
      placed.push({ champion: entry.champion, position: offsetToAxial({ row: Math.max(row, 2), col }), starLevel: entry.starLevel, items: [] });
    });
  } else {
    // 전방: row 3 → 2
    front.forEach((entry, idx) => {
      const row = 3 - Math.floor(idx / cols);
      const col = idx % cols;
      placed.push({ champion: entry.champion, position: offsetToAxial({ row: Math.max(row, 2), col }), starLevel: entry.starLevel, items: [] });
    });
    // 후방: row 0 → 1
    back.forEach((entry, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      placed.push({ champion: entry.champion, position: offsetToAxial({ row: Math.min(row, 1), col }), starLevel: entry.starLevel, items: [] });
    });
  }

  return placed;
}
