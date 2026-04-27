import { describe, it, expect } from 'vitest';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';

describe('loadServerCatalogs', () => {
  it('loads set17 catalogs', () => {
    const cat = loadServerCatalogs();
    expect(cat.champions.length).toBeGreaterThan(0);
    expect(cat.traits.length).toBeGreaterThan(0);
    expect(cat.items.length).toBeGreaterThan(0);
    expect(cat.augments.length).toBeGreaterThan(0);
  });

  it('caches results (same ref)', () => {
    const a = loadServerCatalogs();
    const b = loadServerCatalogs();
    expect(b).toBe(a);
  });
});
