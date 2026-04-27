import { describe, it, expect } from 'vitest';
import { compareRound } from '@/lib/validation/diffReporter';
import type { PvPRound, TeamSnapshot, OpponentSnapshot } from '@/lib/actualData/types';
import type { Distribution, NumStats, HpStats, Survivor } from '@/types/validation';

/**
 * Phase 5 will extend `TeamSnapshotSchema` with optional `survivors`. Until
 * the schema bump lands, this local alias lets the test inject survivors data
 * without `any` casts.
 */
type SnapshotWithSurvivors = TeamSnapshot & { survivors?: Survivor[] };
type OpponentWithSurvivors = OpponentSnapshot & { survivors?: Survivor[] };

function fakeNumStats(mean: number, samples = [mean]): NumStats {
  return { mean, median: mean, min: Math.min(...samples), max: Math.max(...samples), samples };
}

function fakeDist(overrides: Partial<Distribution> = {}): Distribution {
  return {
    nRuns: 10,
    winnerCounts: { player: 7, opponent: 3, draw: 0 },
    playerWinRate: 0.7,
    playerDamage: new Map([['0,3', fakeNumStats(4000)]]),
    opponentDamage: new Map([['3,3', fakeNumStats(2000)]]),
    survivors: {
      player: new Map([['0,3', { aliveCount: 8, meanHpPercentIfAlive: 60 } as HpStats]]),
      opponent: new Map([['3,3', { aliveCount: 2, meanHpPercentIfAlive: 20 } as HpStats]]),
    },
    combatDurationTicks: fakeNumStats(200),
    ...overrides,
  };
}

function fakeRound(overrides: Partial<PvPRound> = {}): PvPRound {
  return {
    type: 'pvp',
    roundName: '5-5',
    videoStartTime: 0,
    playerTeam: {
      units: [{ championId: 'TFT17_Xayah', hex: { q: 0, r: 3 }, starLevel: 2, items: [null, null, null] }],
      augments: [null, null, null, null],
      level: 8, hp: 70, hexModifiers: [],
    },
    opponent: {
      units: [{ championId: 'TFT17_Leona', hex: { q: 3, r: 3 }, starLevel: 2, items: [null, null, null] }],
      augments: [null, null, null, null],
      level: 8, hp: 50, hexModifiers: [],
    },
    winner: 'player',
    playerDamageChart: [{ unitHex: { q: 0, r: 3 }, championId: 'TFT17_Xayah', damage: 5000 }],
    ...overrides,
  } as PvPRound;
}

describe('diffReporter.compareRound', () => {
  it('computes winner match', () => {
    const diff = compareRound(fakeRound(), fakeDist(), []);
    expect(diff.winner.actual).toBe('player');
    expect(diff.winner.simPlayerWinRate).toBe(0.7);
    expect(diff.winner.matched).toBe(true);
    expect(diff.winner.weakSignal).toBe(false);
  });

  it('flags weak signal when playerWinRate near 50%', () => {
    const dist = fakeDist({ winnerCounts: { player: 4, opponent: 6, draw: 0 }, playerWinRate: 0.4 });
    const diff = compareRound(fakeRound(), dist, []);
    expect(diff.winner.weakSignal).toBe(true);
  });

  it('computes player damage diffPct', () => {
    const diff = compareRound(fakeRound(), fakeDist(), []);
    const xayahDiff = diff.playerDamage.find(d => d.hex.q === 0 && d.hex.r === 3)!;
    expect(xayahDiff.actual).toBe(5000);
    expect(xayahDiff.simMean).toBe(4000);
    expect(xayahDiff.diffPct).toBeCloseTo((4000 - 5000) / 5000, 4);
  });

  it('skips opponent damage when actual chart absent', () => {
    const diff = compareRound(fakeRound(), fakeDist(), []);
    expect(diff.opponentDamage).toBeUndefined();
  });

  it('includes opponent damage diff when actual chart provided', () => {
    const round = fakeRound({
      opponentDamageChart: [{ unitHex: { q: 3, r: 3 }, championId: 'TFT17_Leona', damage: 1500 }],
    });
    const diff = compareRound(round, fakeDist(), []);
    expect(diff.opponentDamage).toHaveLength(1);
    expect(diff.opponentDamage![0].diffPct).toBeCloseTo((2000 - 1500) / 1500, 4);
  });

  it('computes survivor diffs when actual survivors provided', () => {
    const playerTeamWithSurv: SnapshotWithSurvivors = {
      ...fakeRound().playerTeam,
      survivors: [{ hex: { q: 0, r: 3 }, championId: 'TFT17_Xayah', alive: true, hpPercent: 40 }],
    };
    const opponentWithSurv: OpponentWithSurvivors = {
      ...fakeRound().opponent,
      survivors: [{ hex: { q: 3, r: 3 }, championId: 'TFT17_Leona', alive: false, hpPercent: 0 }],
    };
    const round = fakeRound({
      playerTeam: playerTeamWithSurv as TeamSnapshot,
      opponent: opponentWithSurv as OpponentSnapshot,
    });
    const diff = compareRound(round, fakeDist(), []);
    expect(diff.survivors).toHaveLength(2);
    const leonaDiff = diff.survivors!.find(s => s.team === 'opponent')!;
    expect(leonaDiff.actualAlive).toBe(false);
    expect(leonaDiff.simAliveRate).toBe(0.2);
    expect(leonaDiff.aliveMismatch).toBe(false);  // 0.2 < 0.5 → sim says dead too
  });

  it('passes through warnings', () => {
    const diff = compareRound(fakeRound(), fakeDist(), ['warn1', 'warn2']);
    expect(diff.warnings).toEqual(['warn1', 'warn2']);
  });

  it('returns diffPct=0 when both actual and sim are zero (정상 일치)', () => {
    const round = fakeRound({
      playerDamageChart: [{ unitHex: { q: 0, r: 3 }, championId: 'TFT17_Xayah', damage: 0 }],
    });
    const dist = fakeDist({ playerDamage: new Map([['0,3', fakeNumStats(0)]]) });
    const diff = compareRound(round, dist, []);
    expect(diff.playerDamage[0].diffPct).toBe(0);
  });

  it('returns diffPct=null when actual=0 but sim>0 (정의 불가, summary 평균 제외 대상)', () => {
    const round = fakeRound({
      playerDamageChart: [{ unitHex: { q: 0, r: 3 }, championId: 'TFT17_Xayah', damage: 0 }],
    });
    const dist = fakeDist({ playerDamage: new Map([['0,3', fakeNumStats(1500)]]) });
    const diff = compareRound(round, dist, []);
    expect(diff.playerDamage[0].diffPct).toBeNull();
  });
});
