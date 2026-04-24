import { promises as fs } from 'fs';
import { constants as fsConstants } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const VIDEO_DIR = path.join(process.cwd(), 'actual-data', 'videos');
const EXTENSIONS = ['mp4', 'webm'] as const;
export type VideoExt = (typeof EXTENSIONS)[number];

export const MIME_TO_EXT: Record<string, VideoExt> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export const EXT_TO_MIME: Record<VideoExt, 'video/mp4' | 'video/webm'> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

function assertSafeGameId(gameId: string): void {
  if (!/^[a-z0-9-]+$/i.test(gameId)) throw new Error(`invalid gameId: ${gameId}`);
}

export async function ensureVideoDir(): Promise<void> {
  try {
    await fs.access(VIDEO_DIR, fsConstants.F_OK);
  } catch {
    await fs.mkdir(VIDEO_DIR, { recursive: true });
  }
}

export function videoFilePath(gameId: string, ext: VideoExt): string {
  assertSafeGameId(gameId);
  return path.join(VIDEO_DIR, `${gameId}.${ext}`);
}

export type ExistingVideo = { filePath: string; ext: VideoExt };

export async function findExistingVideo(gameId: string): Promise<ExistingVideo | null> {
  assertSafeGameId(gameId);
  for (const ext of EXTENSIONS) {
    const p = videoFilePath(gameId, ext);
    try {
      await fs.access(p, fsConstants.F_OK);
      return { filePath: p, ext };
    } catch {
      // try next
    }
  }
  return null;
}

export async function deleteExistingVideos(gameId: string): Promise<void> {
  assertSafeGameId(gameId);
  for (const ext of EXTENSIONS) {
    try {
      await fs.unlink(videoFilePath(gameId, ext));
    } catch (err) {
      if (!isFileNotFound(err)) throw err;
    }
  }
}

export async function probeDurationSeconds(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf-8');
    });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const n = Number.parseFloat(out.trim());
      resolve(Number.isFinite(n) ? n : null);
    });
  });
}

function isFileNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  );
}
