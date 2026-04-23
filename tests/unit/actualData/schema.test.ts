import { describe, it, expect } from 'vitest';
import {
  ActualGameDataSchema,
  PvPRoundSchema,
  ShrineRoundSchema,
  HexCoordSchema,
} from '@/lib/actualData/schema';

describe('ActualGameDataSchema', () => {
  const validGame = {
    gameId: 'game-20260423-001',
    videoSource: { kind: 'none' as const },
    patchVersion: '17.1',
    playerRiotId: 'Player#KR1',
    finalPlacement: 3,
    shrinesInPlay: ['yasuo', 'ekko'] as const,
    timeline: [],
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    rounds: [],
  };

  it('accepts a minimal valid game', () => {
    expect(() => ActualGameDataSchema.parse(validGame)).not.toThrow();
  });

  it('rejects duplicate shrines', () => {
    const bad = { ...validGame, shrinesInPlay: ['yasuo', 'yasuo'] };
    expect(() => ActualGameDataSchema.parse(bad)).toThrow();
  });

  it('rejects finalPlacement > 8', () => {
    const bad = { ...validGame, finalPlacement: 9 };
    expect(() => ActualGameDataSchema.parse(bad)).toThrow();
  });

  it('rejects rounds out of order', () => {
    const bad = {
      ...validGame,
      rounds: [
        { type: 'pvp' as const, roundName: '2-5', videoStartTime: 0, playerTeam: minTeam(), opponent: minOpp(), winner: 'player' as const },
        { type: 'pvp' as const, roundName: '2-3', videoStartTime: 0, playerTeam: minTeam(), opponent: minOpp(), winner: 'player' as const },
      ],
    };
    expect(() => ActualGameDataSchema.parse(bad)).toThrow();
  });
});

describe('HexCoordSchema', () => {
  it('accepts valid coord', () => {
    expect(() => HexCoordSchema.parse({ q: 0, r: 0 })).not.toThrow();
  });
  it('rejects non-integers', () => {
    expect(() => HexCoordSchema.parse({ q: 1.5, r: 0 })).toThrow();
  });
});

function minTeam() {
  return {
    units: [],
    augments: [undefined, undefined, undefined, undefined],
    level: 7,
    hp: 80,
    hexModifiers: [],
  };
}
function minOpp() {
  return minTeam();
}
