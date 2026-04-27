import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ActualGameDataSchema } from '@/lib/actualData/schema';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { toNRunInput } from '@/lib/validation/schemaAdapter';
import { runN } from '@/lib/validation/nRunSimulator';
import { compareRound } from '@/lib/validation/diffReporter';
import type { GameDiff, RoundDiff } from '@/types/validation';

const DATA_DIR = path.join(process.cwd(), 'actual-data');

export function gameFilePath(gameId: string): string {
  return path.join(DATA_DIR, `${gameId}.json`);
}

export function cacheFilePath(gameId: string): string {
  return path.join(DATA_DIR, `diff-${gameId}.json`);
}

export interface ComputeOptions {
  n?: number;
  seedBase?: number;
}

function captureEngineSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return null;
  }
}

function computeSummary(rounds: RoundDiff[]): GameDiff['summary'] {
  const pvpRoundCount = rounds.length;
  if (pvpRoundCount === 0) {
    return {
      pvpRoundCount: 0,
      winnerMatchRate: 0,
      weakSignalRoundCount: 0,
      avgPlayerDamageErrorPct: 0,
      avgSurvivorHpErrorPts: 0,
    };
  }
  const matched = rounds.filter((r) => r.winner.matched).length;
  const weak = rounds.filter((r) => r.winner.weakSignal).length;

  // diffPct=null (actual=0 + simMean>0) 인 entry 는 정의 불가 — 평균에서 제외.
  // 포함하면 zero-actual outlier 가 평균을 0 쪽으로 왜곡해 model error 를
  // systematically underreport 함.
  const allPlayerDmg = rounds.flatMap((r) => r.playerDamage)
    .filter((d): d is typeof d & { diffPct: number } => d.diffPct !== null);
  const avgPlayerDamageErrorPct = allPlayerDmg.length > 0
    ? allPlayerDmg.reduce((a, b) => a + b.diffPct, 0) / allPlayerDmg.length
    : 0;

  const allSurvHp = rounds.flatMap((r) => r.survivors ?? []).filter((s) => !s.aliveMismatch);
  const avgSurvivorHpErrorPts = allSurvHp.length > 0
    ? allSurvHp.reduce((a, b) => a + b.hpDiffPoints, 0) / allSurvHp.length
    : 0;

  return {
    pvpRoundCount,
    winnerMatchRate: matched / pvpRoundCount,
    weakSignalRoundCount: weak,
    avgPlayerDamageErrorPct,
    avgSurvivorHpErrorPts,
  };
}

export async function computeGameDiff(gameId: string, opts: ComputeOptions = {}): Promise<GameDiff> {
  const n = opts.n ?? 10;
  const seedBase = opts.seedBase ?? 0;

  const filePath = gameFilePath(gameId);
  const raw = await fs.readFile(filePath, 'utf-8');
  const stat = await fs.stat(filePath);
  const parsed = ActualGameDataSchema.parse(JSON.parse(raw));

  const catalogs = loadServerCatalogs();

  const pvpRounds = parsed.rounds.filter((r) => r.type === 'pvp');
  const roundDiffs: RoundDiff[] = [];

  // pvpRoundIndex 는 0-based — schemaAdapter 의 NoScoutNoPivot 등 누적 augment
  // stack 자동 추론에 사용. 첫 PvP 라운드 시점 stack=0 (아직 PvP 안 거침).
  // stargazerConstellation 은 game-level — 모든 라운드 공통으로 전달.
  pvpRounds.forEach((round, pvpRoundIndex) => {
    const { input, warnings } = toNRunInput(round, catalogs, {
      pvpRoundIndex,
      stargazerConstellation: parsed.stargazerConstellation,
    });
    const dist = runN(input, n, seedBase);
    roundDiffs.push(compareRound(round, dist, warnings));
  });

  return {
    gameId,
    computedAt: new Date().toISOString(),
    sourceGameMtime: Math.floor(stat.mtimeMs),
    engineSha: captureEngineSha(),
    nRuns: n,
    seedBase,
    rounds: roundDiffs,
    summary: computeSummary(roundDiffs),
  };
}

/**
 * Serialize GameDiff, converting Maps inside (none at the top level — RoundDiff doesn't hold Maps).
 * Distribution lives inside nRunSimulator and is not persisted.
 */
function serializeDiff(diff: GameDiff): string {
  return JSON.stringify(diff, null, 2);
}

export async function saveDiffCache(gameId: string, diff: GameDiff): Promise<void> {
  await fs.writeFile(cacheFilePath(gameId), serializeDiff(diff), 'utf-8');
}

export async function loadCachedDiff(gameId: string): Promise<{
  diff: GameDiff;
  stale: boolean;
  currentGameMtime: number;
} | null> {
  try {
    const cachedRaw = await fs.readFile(cacheFilePath(gameId), 'utf-8');
    const diff = JSON.parse(cachedRaw) as GameDiff;
    const stat = await fs.stat(gameFilePath(gameId));
    const currentGameMtime = Math.floor(stat.mtimeMs);
    return {
      diff,
      stale: diff.sourceGameMtime !== currentGameMtime,
      currentGameMtime,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') return null;
    throw err;
  }
}

export async function deleteDiffCache(gameId: string): Promise<void> {
  try {
    await fs.unlink(cacheFilePath(gameId));
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') return;
    throw err;
  }
}
