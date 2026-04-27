import { describe, it, expect, afterEach } from 'vitest';
import {
  computeGameDiff,
  loadCachedDiff,
  saveDiffCache,
  deleteDiffCache,
  cacheFilePath,
} from '@/lib/validation/gameDiffer';
import fs from 'node:fs';

const TEST_GAME_ID = 'game-20260423-001';

afterEach(() => {
  try {
    fs.unlinkSync(cacheFilePath(TEST_GAME_ID));
  } catch {
    // file did not exist — ignore
  }
});

describe('gameDiffer', () => {
  it('computes GameDiff for all pvp rounds', async () => {
    const diff = await computeGameDiff(TEST_GAME_ID, { n: 2, seedBase: 0 });
    expect(diff.gameId).toBe(TEST_GAME_ID);
    expect(diff.rounds.length).toBeGreaterThan(0);
    expect(diff.summary.pvpRoundCount).toBe(diff.rounds.length);
    expect(diff.nRuns).toBe(2);
    expect(typeof diff.sourceGameMtime).toBe('number');
  }, 120_000);

  it('save + load roundtrips', async () => {
    const diff = await computeGameDiff(TEST_GAME_ID, { n: 1, seedBase: 0 });
    await saveDiffCache(TEST_GAME_ID, diff);
    const loaded = await loadCachedDiff(TEST_GAME_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.diff.gameId).toBe(TEST_GAME_ID);
    expect(loaded!.stale).toBe(false);
  }, 120_000);

  it('deleteDiffCache is idempotent', async () => {
    await deleteDiffCache(TEST_GAME_ID);
    await deleteDiffCache(TEST_GAME_ID);
    expect(true).toBe(true);
  });

  it('returns null for non-existent game cache', async () => {
    const result = await loadCachedDiff('nonexistent-game-id');
    expect(result).toBeNull();
  });
});
