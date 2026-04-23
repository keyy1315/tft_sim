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

/**
 * PvP 라운드 종료 → 다음 PvP 라운드 시작까지의 영상상 소요 시간(초).
 * 전투 결산 + 캐러셀/크립/신 선택 등 중간 라운드의 통상 길이에 맞춘 경험치 기반 기본값.
 * 정확한 시작 시각은 사용자가 VideoTimeInput에서 재조정 가능.
 */
export const PVP_TO_PVP_TRANSITION_SECONDS = 35;

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

  const nextStartTime = prev?.videoEndTime != null
    ? prev.videoEndTime + PVP_TO_PVP_TRANSITION_SECONDS
    : 0;

  return {
    type: 'pvp',
    roundName,
    videoStartTime: nextStartTime,
    playerTeam,
    opponent: emptyOpponent(),
    winner: 'draw',
  };
}
