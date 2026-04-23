import { describe, it, expect } from 'vitest';
import { inferGraceFromShrines } from '@/lib/actualData/graceInference';
import type { ShrineRound } from '@/lib/actualData/types';

function sr(playerChosenShrine: ShrineRound['playerChosenShrine'], roundName = '2-4'): ShrineRound {
  return { type: 'shrine', roundName, videoStartTime: 0, playerChosenShrine };
}

describe('inferGraceFromShrines', () => {
  it('returns null when no shrine rounds', () => {
    expect(inferGraceFromShrines([])).toBeNull();
  });

  it('returns yasuo grace when 3x yasuo', () => {
    const result = inferGraceFromShrines([sr('yasuo'), sr('yasuo'), sr('yasuo')]);
    expect(result).toEqual({ kind: 'yasuo_grace', appliesHexMultiplier: 1.5 });
  });

  it('does not return yasuo grace when only 2x yasuo', () => {
    const result = inferGraceFromShrines([sr('yasuo'), sr('yasuo'), sr('ekko')]);
    expect(result).toEqual({ kind: 'other_grace', shrine: 'yasuo' });
  });

  it('returns other_grace when non-yasuo god chosen 2+ times', () => {
    const result = inferGraceFromShrines([sr('ekko'), sr('ekko'), sr('thresh')]);
    expect(result).toEqual({ kind: 'other_grace', shrine: 'ekko' });
  });

  it('returns null when all three different gods', () => {
    expect(inferGraceFromShrines([sr('ekko'), sr('thresh'), sr('varus')])).toBeNull();
  });

  it('returns other_grace for 2x yasuo without a 3rd', () => {
    expect(inferGraceFromShrines([sr('yasuo'), sr('yasuo')])).toEqual({
      kind: 'other_grace',
      shrine: 'yasuo',
    });
  });
});
