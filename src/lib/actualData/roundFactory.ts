import type { HexModifier, ShrineRound } from './types';

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
