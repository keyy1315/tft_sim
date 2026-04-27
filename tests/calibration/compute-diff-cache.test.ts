/**
 * One-shot data-generation harness — runs the validation diff for a game and
 * writes `actual-data/diff-<gameId>.json`. Lives under tests/calibration so it
 * shares the documented `console.log` exception. Invoke with:
 *   pnpm test tests/calibration/compute-diff-cache.test.ts --run
 */
import { describe, it } from 'vitest';
import { computeGameDiff, saveDiffCache } from '@/lib/validation/gameDiffer';

const GAME_ID = process.env.DIFF_GAME_ID ?? 'game-20260423-001';
const N = Number(process.env.DIFF_N ?? '10');

describe('compute-diff-cache harness', () => {
  it(`writes diff cache for ${GAME_ID} N=${N}`, async () => {
    const t0 = Date.now();
    const diff = await computeGameDiff(GAME_ID, { n: N, seedBase: 0 });
    await saveDiffCache(GAME_ID, diff);
    const ms = Date.now() - t0;
    // eslint-disable-next-line no-console -- pure measurement
    console.log(
      `[diff-cache] ${GAME_ID} N=${N} rounds=${diff.rounds.length} ` +
        `winnerMatch=${(diff.summary.winnerMatchRate * 100).toFixed(1)}% ` +
        `avgDmgErr=${(diff.summary.avgPlayerDamageErrorPct * 100).toFixed(1)}% ` +
        `time=${ms}ms`,
    );
  }, 600_000);
});
