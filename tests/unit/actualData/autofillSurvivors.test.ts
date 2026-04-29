import { describe, it, expect } from 'vitest';
import { autofillLosingTeamSurvivors } from '@/lib/actualData/autofillSurvivors';
import type { PvPRound } from '@/lib/actualData/types';

function baseRound(overrides: Partial<PvPRound> = {}): PvPRound {
  return {
    type: 'pvp',
    roundName: '5-5',
    videoStartTime: 0,
    playerTeam: {
      units: [
        { championId: 'TFT17_Talon', hex: { q: 0, r: 3 }, starLevel: 3, items: [null, null, null] },
        { championId: 'TFT17_Caitlyn', hex: { q: -1, r: 3 }, starLevel: 2, items: [null, null, null] },
      ],
      augments: [null, null, null, null],
      level: 8,
      hp: 70,
      hexModifiers: [],
    },
    opponent: {
      units: [
        { championId: 'TFT17_Vex', hex: { q: 3, r: 3 }, starLevel: 2, items: [null, null, null] },
      ],
      augments: [null, null, null, null],
      level: 8,
      hp: 50,
      hexModifiers: [],
    },
    winner: 'player',
    ...overrides,
  } as PvPRound;
}

describe('autofillLosingTeamSurvivors', () => {
  it('fills opponent survivors with all dead when winner=player and opponent.survivors empty', () => {
    const round = baseRound({ winner: 'player' });
    const next = autofillLosingTeamSurvivors(round, { winner: 'player' });
    expect(next.opponent.survivors).toHaveLength(1);
    expect(next.opponent.survivors?.[0]).toEqual({
      hex: { q: 3, r: 3 },
      championId: 'TFT17_Vex',
      alive: false,
      hpPercent: 0,
    });
    expect(next.playerTeam.survivors).toBeUndefined();
  });

  it('fills playerTeam survivors when winner=opponent', () => {
    const round = baseRound({ winner: 'opponent' });
    const next = autofillLosingTeamSurvivors(round, { winner: 'opponent' });
    expect(next.playerTeam.survivors).toHaveLength(2);
    expect(next.playerTeam.survivors?.every((s) => !s.alive && s.hpPercent === 0)).toBe(true);
    expect(next.opponent.survivors).toBeUndefined();
  });

  it('does not autofill when patch.winner is undefined (no winner change)', () => {
    const round = baseRound({ winner: 'player' });
    const next = autofillLosingTeamSurvivors(round, { hp: 70 } as Partial<PvPRound>);
    expect(next.opponent.survivors).toBeUndefined();
  });

  it('does not autofill on draw', () => {
    const round = baseRound({ winner: 'draw' });
    const next = autofillLosingTeamSurvivors(round, { winner: 'draw' });
    expect(next.opponent.survivors).toBeUndefined();
    expect(next.playerTeam.survivors).toBeUndefined();
  });

  it('preserves existing opponent.survivors when user already input some', () => {
    const round = baseRound({
      winner: 'player',
      opponent: {
        ...baseRound().opponent,
        survivors: [
          { hex: { q: 3, r: 3 }, championId: 'TFT17_Vex', alive: true, hpPercent: 25 },
        ],
      },
    });
    const next = autofillLosingTeamSurvivors(round, { winner: 'player' });
    expect(next.opponent.survivors).toHaveLength(1);
    expect(next.opponent.survivors?.[0].alive).toBe(true);
    expect(next.opponent.survivors?.[0].hpPercent).toBe(25);
  });

  it('skips when losing team has no units', () => {
    const round = baseRound({
      winner: 'player',
      opponent: { ...baseRound().opponent, units: [] },
    });
    const next = autofillLosingTeamSurvivors(round, { winner: 'player' });
    expect(next.opponent.survivors).toBeUndefined();
  });
});
