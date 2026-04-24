import { describe, it, expect, beforeEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft } from '@/lib/actualData/draftStorage';
import type { ActualGameData } from '@/lib/actualData/types';

beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

function mkGame(gameId: string): ActualGameData {
  return {
    gameId,
    videoSource: { kind: 'none' },
    patchVersion: '17.1',
    playerRiotId: 'AB#CDE',
    finalPlacement: 1,
    shrinesInPlay: ['yasuo', 'ekko'],
    timeline: [],
    createdAt: 'x',
    updatedAt: 'y',
    rounds: [],
  };
}

describe('draftStorage', () => {
  it('round-trips a game', () => {
    saveDraft(mkGame('g1'));
    const loaded = loadDraft('g1');
    expect(loaded?.gameId).toBe('g1');
  });

  it('returns null when no draft', () => {
    expect(loadDraft('missing')).toBeNull();
  });

  it('clears draft', () => {
    saveDraft(mkGame('g1'));
    clearDraft('g1');
    expect(loadDraft('g1')).toBeNull();
  });
});
