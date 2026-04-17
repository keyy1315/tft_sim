import type { RawChampion, RawItem, RawTrait, PlacedChampion, HexCoord, UnitRole } from '@/types';
import { mapGameRole } from '@/types';
import type { ParsedParticipant } from '@/lib/riot';
import type { MatchReconstructionResult, UnsupportedReason, AnalysisConfidence } from '@/types/analysis';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { resolveItemId } from '@/lib/analysis/coverageChecker';

/**
 * Riot API 전적 데이터를 시뮬레이터 입력으로 변환한다.
 * 결측 데이터(유닛 위치)는 heuristic으로 보정.
 *
 * 좌표계: player row 4-7, enemy row 0-3, skipMirror: true
 */
export function reconstructMatch(
  playerData: ParsedParticipant,
  opponentData: ParsedParticipant,
  championData: RawChampion[],
  itemData: RawItem[],
  traitData: RawTrait[],
): MatchReconstructionResult {
  const champMap = new Map(championData.map(c => [c.apiName, c]));
  const itemMap = new Map(itemData.map(i => [i.apiName, i]));
  const itemApiNameSet = new Map(itemData.map(i => [i.apiName, true]));

  const heuristicFields: string[] = ['position'];
  const reasons: UnsupportedReason[] = [];

  function buildTeam(
    participant: ParsedParticipant,
    isPlayer: boolean,
  ): PlacedChampion[] {
    const resolved: Array<{ champion: RawChampion; starLevel: number; items: RawItem[] }> = [];

    for (const c of participant.champions) {
      // 소환/특수 유닛 스킵
      const lowerId = c.id.toLowerCase();
      if (lowerId.includes('summon') || lowerId.includes('dummy') || lowerId.includes('pve_')
        || lowerId.includes('follower') || lowerId.includes('fakeunit') || lowerId.includes('core')) continue;
      const champ = champMap.get(c.id);
      if (!champ) {
        if (!reasons.includes('unsupported_champion')) reasons.push('unsupported_champion');
        continue;
      }
      const items: RawItem[] = [];
      for (const rawItemId of c.items) {
        const itemId = resolveItemId(rawItemId, itemApiNameSet);
        const item = itemMap.get(itemId);
        if (item) {
          items.push(item);
        } else {
          if (!reasons.includes('unsupported_item')) reasons.push('unsupported_item');
        }
      }
      resolved.push({ champion: champ, starLevel: c.tier, items });
    }

    return heuristicPlacement(resolved, isPlayer);
  }

  const playerTeam = buildTeam(playerData, true);
  const enemyTeam = buildTeam(opponentData, false);

  // 시너지 해석해서 options에 포함
  const allChampions = [...playerTeam, ...enemyTeam].map(p => ({ champion: p.champion }));
  const resolved = resolveTraits(allChampions, traitData);
  const allTraits = traitData.filter(t => resolved.some(r => r.trait.apiName === t.apiName && r.style > 0));

  const confidence: AnalysisConfidence = reasons.length > 0 ? 'unsupported' : 'estimated';

  return {
    playerTeam,
    enemyTeam,
    options: { skipMirror: true, allTraits },
    confidence,
    reasons,
    heuristicFields,
  };
}

// ── Carry 점수 (배치 우선순위용) ──

function carryScore(champ: RawChampion, starLevel: number, itemCount: number): number {
  return champ.cost * 3 + starLevel * 2 + itemCount;
}

// ── Heuristic 배치 ──

/** Role별 배치 row 우선순위 (player 기준 row 4-7) */
const ROLE_ROW_PRIORITY: Record<UnitRole, number[]> = {
  Tank:       [4, 5],
  Fighter:    [5, 4],
  Specialist: [6, 5],
  Caster:     [6, 7],
  Marksman:   [7, 6],
  Assassin:   [7, 6],
};

/** Column 배정: 탱커는 양쪽, 캐리는 중앙 */
const TANK_COLS = [0, 6, 1, 5, 2, 4, 3];
const CARRY_COLS = [3, 2, 4, 1, 5, 0, 6];

function heuristicPlacement(
  champions: Array<{ champion: RawChampion; starLevel: number; items: RawItem[] }>,
  isPlayer: boolean,
): PlacedChampion[] {
  if (champions.length === 0) return [];

  // carry score로 정렬 (높은 순)
  const sorted = [...champions].sort((a, b) =>
    carryScore(b.champion, b.starLevel, b.items.length) - carryScore(a.champion, a.starLevel, a.items.length)
  );

  const occupied = new Set<string>();
  const coordKey = (r: number, q: number) => `${r},${q}`;

  function findSlot(role: UnitRole, isTank: boolean): HexCoord {
    const rows = ROLE_ROW_PRIORITY[role] ?? [6, 5];
    const cols = isTank ? TANK_COLS : CARRY_COLS;

    for (const row of rows) {
      for (const col of cols) {
        // player: row 4-7 그대로, enemy: row 0-3으로 미러
        const actualRow = isPlayer ? row : 3 - (row - 4);
        if (actualRow < 0 || actualRow > 7) continue;
        const key = coordKey(actualRow, col);
        if (!occupied.has(key)) {
          occupied.add(key);
          return { r: actualRow, q: col };
        }
      }
    }

    // fallback: 빈 칸 아무데나
    for (let r = isPlayer ? 4 : 0; r <= (isPlayer ? 7 : 3); r++) {
      for (let q = 0; q <= 6; q++) {
        const key = coordKey(r, q);
        if (!occupied.has(key)) {
          occupied.add(key);
          return { r, q };
        }
      }
    }
    return { r: isPlayer ? 7 : 0, q: 0 };
  }

  return sorted.map(({ champion, starLevel, items }) => {
    const role = mapGameRole(champion.role);
    const isTank = role === 'Tank';
    const position = findSlot(role, isTank);

    return {
      champion,
      position,
      starLevel,
      items,
    };
  });
}
