import type {
  HexModifier,
  OpponentSnapshot,
  PvPRound,
  ShrineRound,
  TeamSnapshot,
} from './types';

export function generateGameId(existingIds: string[], now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;
  const prefix = `game-${datePart}-`;

  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  const nnn = String(max + 1).padStart(3, '0');
  return `${prefix}${nnn}`;
}

export function accumulateHexModifiers(
  base: HexModifier[],
  shrineRounds: ShrineRound[],
): HexModifier[] {
  const result = [...base];
  for (const r of shrineRounds) {
    if (r.playerChosenShrine !== 'yasuo' || !r.playerYasuoTile) continue;
    const stage = Number(r.roundName.split('-')[0]);
    if (stage !== 2 && stage !== 3 && stage !== 4) continue;
    result.push({
      hex: r.playerYasuoTile.hex,
      tileId: r.playerYasuoTile.tileId,
      stageGranted: stage,
    });
  }
  return result;
}

function emptyTeam(): TeamSnapshot {
  return {
    units: [],
    augments: [undefined, undefined, undefined, undefined],
    level: 1,
    hp: 100,
    hexModifiers: [],
  };
}

function emptyOpponent(): OpponentSnapshot {
  return emptyTeam();
}

export function buildNextPvPRound(
  roundName: string,
  prev: PvPRound | null,
  shrineRoundsBetween: ShrineRound[],
): PvPRound {
  const playerTeam: TeamSnapshot = prev
    ? {
        units: prev.playerTeam.units.map((u) => ({ ...u })),
        augments: [...prev.playerTeam.augments] as TeamSnapshot['augments'],
        level: prev.playerTeam.level,
        hp: prev.playerTeam.hp,
        hexModifiers: accumulateHexModifiers(prev.playerTeam.hexModifiers, shrineRoundsBetween),
        graceApplied: prev.playerTeam.graceApplied,
        arbiterLaw: prev.playerTeam.arbiterLaw,
        stargazer: prev.playerTeam.stargazer,
        factoryNew: prev.playerTeam.factoryNew,
      }
    : emptyTeam();

  return {
    type: 'pvp',
    roundName,
    videoStartTime: prev?.videoEndTime ?? 0,
    playerTeam,
    opponent: emptyOpponent(),
    winner: 'draw',
  };
}
