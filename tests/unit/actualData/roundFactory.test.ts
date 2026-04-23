import { describe, it, expect } from 'vitest';
import { accumulateHexModifiers, generateGameId } from '@/lib/actualData/roundFactory';
import type { HexModifier, ShrineRound } from '@/lib/actualData/types';

describe('generateGameId', () => {
  it('produces 001 when no prior ids for today', () => {
    const id = generateGameId([], new Date('2026-04-23T10:00:00Z'));
    expect(id).toBe('game-20260423-001');
  });

  it('increments when today ids exist', () => {
    const id = generateGameId(
      ['game-20260423-001', 'game-20260423-002'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-003');
  });

  it('ignores ids from other dates', () => {
    const id = generateGameId(
      ['game-20260422-005', 'game-20260422-006'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-001');
  });

  it('handles large NNN', () => {
    const id = generateGameId(
      ['game-20260423-099'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-100');
  });
});

describe('accumulateHexModifiers', () => {
  const base: HexModifier[] = [
    { hex: { q: 0, r: 0 }, tileId: 'solar', stageGranted: 2 },
  ];

  it('returns base unchanged when no shrine rounds', () => {
    expect(accumulateHexModifiers(base, [])).toEqual(base);
  });

  it('appends yasuo tile from a shrine round', () => {
    const shrine: ShrineRound = {
      type: 'shrine',
      roundName: '3-4',
      videoStartTime: 0,
      playerChosenShrine: 'yasuo',
      playerYasuoTile: { hex: { q: 1, r: 0 }, tileId: 'cryo' },
    };
    const result = accumulateHexModifiers(base, [shrine]);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      hex: { q: 1, r: 0 },
      tileId: 'cryo',
      stageGranted: 3,
    });
  });

  it('ignores non-yasuo shrine rounds', () => {
    const shrine: ShrineRound = {
      type: 'shrine',
      roundName: '3-4',
      videoStartTime: 0,
      playerChosenShrine: 'ekko',
    };
    expect(accumulateHexModifiers(base, [shrine])).toEqual(base);
  });

  it('derives stageGranted from roundName', () => {
    const shrines: ShrineRound[] = [
      { type: 'shrine', roundName: '2-4', videoStartTime: 0, playerChosenShrine: 'yasuo',
        playerYasuoTile: { hex: { q: 0, r: 1 }, tileId: 'accel' } },
      { type: 'shrine', roundName: '4-4', videoStartTime: 0, playerChosenShrine: 'yasuo',
        playerYasuoTile: { hex: { q: 0, r: 2 }, tileId: 'storm' } },
    ];
    const result = accumulateHexModifiers([], shrines);
    expect(result[0].stageGranted).toBe(2);
    expect(result[1].stageGranted).toBe(4);
  });
});
