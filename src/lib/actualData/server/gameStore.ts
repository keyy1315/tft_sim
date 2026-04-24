import { promises as fs } from 'fs';
import { constants as fsConstants } from 'fs';
import path from 'path';
import type { ActualGameData, ActualGameSummary } from '../types';

const DIR = path.join(process.cwd(), 'actual-data');

export async function listGameSummaries(): Promise<ActualGameSummary[]> {
  await ensureDir();
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'));
  const summaries: ActualGameSummary[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(path.join(DIR, f), 'utf-8');
      const data = JSON.parse(raw) as ActualGameData;
      summaries.push({
        gameId: data.gameId,
        videoSource: data.videoSource,
        patchVersion: data.patchVersion,
        finalPlacement: data.finalPlacement,
        updatedAt: data.updatedAt,
      });
    } catch {
      // skip malformed file
    }
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readGame(gameId: string): Promise<ActualGameData | null> {
  try {
    const raw = await fs.readFile(filePath(gameId), 'utf-8');
    return JSON.parse(raw) as ActualGameData;
  } catch (err) {
    if (isFileNotFound(err)) return null;
    throw err;
  }
}

export async function writeGame(data: ActualGameData): Promise<void> {
  await ensureDir();
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath(data.gameId), json, 'utf-8');
}

export async function createGameFile(data: ActualGameData): Promise<void> {
  await ensureDir();
  const json = JSON.stringify(data, null, 2);
  // wx flag: fail if exists
  await fs.writeFile(filePath(data.gameId), json, { encoding: 'utf-8', flag: 'wx' });
}

export async function deleteGame(gameId: string): Promise<boolean> {
  try {
    await fs.unlink(filePath(gameId));
    return true;
  } catch (err) {
    if (isFileNotFound(err)) return false;
    throw err;
  }
}

export async function listGameIds(): Promise<string[]> {
  await ensureDir();
  return (await fs.readdir(DIR))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5));
}

function filePath(gameId: string): string {
  if (!/^[a-z0-9-]+$/i.test(gameId)) throw new Error(`invalid gameId: ${gameId}`);
  return path.join(DIR, `${gameId}.json`);
}

async function ensureDir(): Promise<void> {
  try {
    await fs.access(DIR, fsConstants.F_OK);
  } catch {
    await fs.mkdir(DIR, { recursive: true });
  }
}

function isFileNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  );
}
