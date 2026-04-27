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

describe('CONSTELLATION_TILE_PATTERN', () => {
  it('every constellation has at least 10 empowered tiles', async () => {
    const { CONSTELLATION_TILE_PATTERN, isOnEmpoweredTile } = await import(
      '@/lib/actualData/stargazerMapping'
    );
    const ids = StargazerConstellationIdSchema.options;
    for (const id of ids) {
      const tiles = CONSTELLATION_TILE_PATTERN[id];
      expect(tiles.length).toBeGreaterThanOrEqual(10);
      // sample helper check
      expect(isOnEmpoweredTile(tiles[0], id)).toBe(true);
    }
  });

  it('all tiles are within board bounds (4 row × 7 col)', async () => {
    const { CONSTELLATION_TILE_PATTERN } = await import('@/lib/actualData/stargazerMapping');
    for (const id of StargazerConstellationIdSchema.options) {
      for (const t of CONSTELLATION_TILE_PATTERN[id]) {
        // axial r 는 0~3 (board rows), q 는 row 마다 다른 범위 — offset 변환해서 col 확인
        expect(t.r).toBeGreaterThanOrEqual(0);
        expect(t.r).toBeLessThan(4);
        const col = t.q + Math.floor(t.r / 2);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(7);
      }
    }
  });

  it('isOnEmpoweredTile returns false for off-pattern position', async () => {
    const { isOnEmpoweredTile } = await import('@/lib/actualData/stargazerMapping');
    // Mountain 은 (0,0) 강화 안 됨 (강화 칸은 (2,0)(3,0)(4,0)(5,0) 등)
    expect(isOnEmpoweredTile({ q: 0, r: 0 }, 'mountain')).toBe(false);
    expect(isOnEmpoweredTile({ q: 2, r: 0 }, 'mountain')).toBe(true);
  });
});
