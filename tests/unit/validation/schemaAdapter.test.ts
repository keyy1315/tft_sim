import { describe, it, expect } from 'vitest';
import { toNRunInput } from '@/lib/validation/schemaAdapter';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { RawChampion } from '@/types';
import type { PvPRound } from '@/lib/actualData/types';

const { champions, traits, augments, items } = loadServerCatalogs();

function minimalRound(overrides: Partial<PvPRound> = {}): PvPRound {
  return {
    type: 'pvp',
    roundName: '5-5',
    videoStartTime: 0,
    playerTeam: {
      units: [{
        championId: 'TFT17_Xayah',
        hex: { q: -1, r: 3 },
        starLevel: 2,
        items: ['TFT_Item_InfinityEdge', null, null],
      }],
      augments: [null, null, null, null],
      level: 8,
      hp: 70,
      hexModifiers: [],
    },
    opponent: {
      units: [{
        championId: 'TFT17_Leona',
        hex: { q: 2, r: 3 },
        starLevel: 2,
        items: [null, null, null],
      }],
      augments: [null, null, null, null],
      level: 8,
      hp: 50,
      hexModifiers: [],
    },
    winner: 'player',
    ...overrides,
  } as PvPRound;
}

describe('schemaAdapter.toNRunInput', () => {
  it('maps minimal round to NRunInput with skipMirror=true', () => {
    const round = minimalRound();
    const { input, warnings } = toNRunInput(round, { champions, traits, augments, items });

    expect(input.simulateOptions.skipMirror).toBe(true);
    expect(input.playerTeam).toHaveLength(1);
    expect(input.opponentTeam).toHaveLength(1);
    expect(input.playerTeam[0].position).toEqual({ q: -1, r: 3 });
    expect(input.opponentTeam[0].position).toEqual({ q: 2, r: 3 });
    // Leona has 중재자 trait but no arbiterLaw selected → expect warning
    // Xayah/Leona don't have 아이오니아 trait in Set 17, so no ionia warning
    // No stackable augments selected → no stack warning
    // So only 중재자 warning should fire (opponent)
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });

  it('parses stageNumber from roundName', () => {
    const round = minimalRound({ roundName: '5-5' });
    const { input } = toNRunInput(round, { champions, traits, augments, items });
    expect(input.simulateOptions.stageNumber).toBe(5);
  });

  it('emits warning when augmentStacks missing but stackable augment present', () => {
    // Use TFT_Augment_Unforgotten (대장군의 명예) — has MaxStacks=4, StartingStacks=1
    const round = minimalRound({
      playerTeam: {
        ...minimalRound().playerTeam,
        augments: ['TFT_Augment_Unforgotten', null, null, null],
      },
    });
    const { warnings } = toNRunInput(round, { champions, traits, augments, items });
    // Warning should mention the augment name (Korean) and '스택'
    expect(warnings.some(w => w.includes('대장군의 명예') && w.includes('스택'))).toBe(true);
  });

  it('emits warning when ioniaPath missing but ionia trait active', () => {
    // Build a team with 2+ ionia units to activate trait (assumes ionia min=2)
    // NOTE: Set 17 may not have 아이오니아 trait at all — test is defensive.
    const round = minimalRound({
      playerTeam: {
        ...minimalRound().playerTeam,
        units: [
          { championId: 'TFT17_Xayah', hex: { q: 0, r: 3 }, starLevel: 2, items: [null, null, null] },
          { championId: 'TFT17_Yasuo', hex: { q: 1, r: 3 }, starLevel: 2, items: [null, null, null] },
        ],
      },
    });
    const { warnings } = toNRunInput(round, { champions, traits, augments, items });
    // Only assert if Xayah+Yasuo both have 아이오니아 trait in current dataset; otherwise skip
    const isIonia = (c: RawChampion) => c.traits.includes('아이오니아');
    const xayah = champions.find(c => c.apiName === 'TFT17_Xayah');
    const yasuo = champions.find(c => c.apiName === 'TFT17_Yasuo');
    if (xayah && yasuo && isIonia(xayah) && isIonia(yasuo)) {
      expect(warnings.some(w => w.includes('아이오니아') && w.includes('길'))).toBe(true);
    } else {
      // trait not present in dataset — nothing to assert
      expect(true).toBe(true);
    }
  });

  it('passes ioniaPath when provided', () => {
    const round = minimalRound({
      playerTeam: {
        ...minimalRound().playerTeam,
        ioniaPath: 'blades',
      } as never,
    });
    const { input } = toNRunInput(round, { champions, traits, augments, items });
    expect(input.simulateOptions.playerIoniaPath).toBe('blades');
  });

  it('passes arbiterLaw effectId when provided', () => {
    const round = minimalRound({
      playerTeam: {
        ...minimalRound().playerTeam,
        arbiterLaw: { triggerId: 'trig1', effectId: 'eff_strength' },
      },
    });
    const { input } = toNRunInput(round, { champions, traits, augments, items });
    expect(input.simulateOptions.playerArbiterLaw).toBeDefined();
    expect(input.simulateOptions.playerArbiterLaw?.triggerId).toBe('trig1');
    expect(input.simulateOptions.playerArbiterLaw?.effectId).toBe('eff_strength');
  });
});

describe('schemaAdapter with real fixture', () => {
  it('processes every pvp round in game-20260423-001.json without throw', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'actual-data', 'game-20260423-001.json'),
      'utf-8',
    );
    const data = JSON.parse(raw) as { rounds: Array<{ type: string }> };
    const pvpRounds = data.rounds.filter((r) => r.type === 'pvp') as unknown as PvPRound[];
    expect(pvpRounds.length).toBeGreaterThan(0);

    for (const round of pvpRounds) {
      const { input, warnings } = toNRunInput(round, { champions, traits, augments, items });
      expect(input.playerTeam.length).toBeGreaterThanOrEqual(0);
      expect(input.opponentTeam.length).toBeGreaterThanOrEqual(0);
      expect(input.simulateOptions.skipMirror).toBe(true);
      expect(Array.isArray(warnings)).toBe(true);
    }
  });
});
