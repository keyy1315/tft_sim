import { describe, it, expect } from 'vitest';
import {
  CONSTELLATION_TO_TRAIT_API,
  CONSTELLATION_KOREAN_NAME,
  CONSTELLATION_IDS,
  traitApiToConstellationId,
} from '@/lib/actualData/stargazerMapping';
import { StargazerConstellationIdSchema } from '@/lib/actualData/schema';

describe('stargazerMapping', () => {
  it('covers every schema enum value', () => {
    const enumValues = StargazerConstellationIdSchema.options;
    for (const v of enumValues) {
      expect(CONSTELLATION_TO_TRAIT_API[v]).toBeDefined();
      expect(CONSTELLATION_KOREAN_NAME[v]).toBeDefined();
    }
    expect(CONSTELLATION_IDS).toHaveLength(enumValues.length);
  });

  it('maps boar → Wolf (Riot internal name vs in-game label)', () => {
    expect(CONSTELLATION_TO_TRAIT_API.boar).toBe('TFT17_Stargazer_Wolf');
    expect(CONSTELLATION_KOREAN_NAME.boar).toBe('멧돼지');
  });

  it('maps altar → Shield (제단)', () => {
    expect(CONSTELLATION_TO_TRAIT_API.altar).toBe('TFT17_Stargazer_Shield');
    expect(CONSTELLATION_KOREAN_NAME.altar).toBe('제단');
  });

  it('reverse mapping', () => {
    expect(traitApiToConstellationId('TFT17_Stargazer_Mountain')).toBe('mountain');
    expect(traitApiToConstellationId('TFT17_Stargazer_Wolf')).toBe('boar');
    expect(traitApiToConstellationId('TFT17_Stargazer')).toBeNull(); // base
    expect(traitApiToConstellationId('TFT17_NonExistent')).toBeNull();
  });

  it('all 7 trait apiNames are unique', () => {
    const set = new Set(Object.values(CONSTELLATION_TO_TRAIT_API));
    expect(set.size).toBe(Object.keys(CONSTELLATION_TO_TRAIT_API).length);
  });
});
