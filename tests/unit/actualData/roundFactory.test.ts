import { describe, it, expect } from 'vitest';
import {
  accumulateHexModifiers,
  buildNextPvPRound,
  generateGameId,
} from '@/lib/actualData/roundFactory';
import type { HexModifier, PvPRound, ShrineRound } from '@/lib/actualData/types';

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

describe('buildNextPvPRound', () => {
  const prev: PvPRound = {
    type: 'pvp',
    roundName: '2-3',
    videoStartTime: 10,
    playerTeam: {
      units: [{ championId: 'ahri', hex: { q: 0, r: 0 }, starLevel: 2, items: [undefined, undefined, undefined] }],
      augments: ['aug1', undefined, undefined, undefined],
      level: 6,
      hp: 80,
      hexModifiers: [],
    },
    opponent: {
      units: [],
      augments: [undefined, undefined, undefined, undefined],
      level: 6,
      hp: 100,
      hexModifiers: [],
    },
    winner: 'player',
  };

  it('copies playerTeam units/augments/level/hp from prev', () => {
    const next = buildNextPvPRound('2-5', prev, []);
    expect(next.playerTeam.units).toEqual(prev.playerTeam.units);
    expect(next.playerTeam.augments).toEqual(prev.playerTeam.augments);
    expect(next.playerTeam.level).toBe(6);
    expect(next.playerTeam.hp).toBe(80);
  });

  it('accumulates hexModifiers from intervening shrine rounds', () => {
    const next = buildNextPvPRound('2-5', prev, [
      { type: 'shrine', roundName: '2-4', videoStartTime: 20, playerChosenShrine: 'yasuo',
        playerYasuoTile: { hex: { q: 1, r: 0 }, tileId: 'solar' } },
    ]);
    expect(next.playerTeam.hexModifiers).toHaveLength(1);
    expect(next.playerTeam.hexModifiers[0].tileId).toBe('solar');
  });

  it('leaves opponent empty', () => {
    const next = buildNextPvPRound('2-5', prev, []);
    expect(next.opponent.units).toEqual([]);
    expect(next.opponent.level).toBe(1);
    expect(next.opponent.hp).toBe(100);
    expect(next.opponent.riotId).toBeUndefined();
  });

  it('uses prev videoEndTime as new videoStartTime when provided', () => {
    const next = buildNextPvPRound('2-5', { ...prev, videoEndTime: 55 }, []);
    expect(next.videoStartTime).toBe(55);
  });

  it('returns videoStartTime=0 when prev=null', () => {
    const next = buildNextPvPRound('2-2', null, []);
    expect(next.videoStartTime).toBe(0);
    expect(next.playerTeam.units).toEqual([]);
  });

  it('sets winner to draw placeholder', () => {
    const next = buildNextPvPRound('2-5', prev, []);
    expect(next.winner).toBe('draw');
  });
});
