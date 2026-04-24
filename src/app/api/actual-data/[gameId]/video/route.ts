import { promises as fs, createReadStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { readGame, writeGame } from '@/lib/actualData/server/gameStore';
import {
  ensureVideoDir,
  findExistingVideo,
  deleteExistingVideos,
  videoFilePath,
  probeDurationSeconds,
  MIME_TO_EXT,
  EXT_TO_MIME,
  MAX_VIDEO_BYTES,
} from '@/lib/actualData/server/videoStore';
import type { VideoSource } from '@/lib/actualData/types';

export const runtime = 'nodejs';
// Long upload support (4GB + slack) — max function execution in seconds
export const maxDuration = 300;

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { gameId } = await params;

  const game = await readGame(gameId);
  if (!game) {
    return NextResponse.json({ error: 'not_found', message: `${gameId} not found` }, { status: 404 });
  }

  const contentType = req.headers.get('content-type')?.split(';')[0].trim() ?? '';
  const ext = MIME_TO_EXT[contentType as keyof typeof MIME_TO_EXT];
  if (!ext) {
    return NextResponse.json(
      { error: 'unsupported_media', message: `Content-Type must be video/mp4 or video/webm (got ${contentType})` },
      { status: 400 },
    );
  }

  const sizeHeader = req.headers.get('content-length');
  const declaredSize = sizeHeader ? Number(sizeHeader) : NaN;
  if (Number.isFinite(declaredSize) && declaredSize > MAX_VIDEO_BYTES) {
    return NextResponse.json(
      { error: 'too_large', message: `file exceeds ${MAX_VIDEO_BYTES} bytes` },
      { status: 413 },
    );
  }

  if (!req.body) {
    return NextResponse.json({ error: 'validation', message: 'empty body' }, { status: 400 });
  }

  await ensureVideoDir();
  // Remove any prior upload (different extension, stale bytes)
  await deleteExistingVideos(gameId);

  const destPath = videoFilePath(gameId, ext);
  let bytesWritten = 0;
  let rejected = false;

  const reader = req.body.getReader();
  const fileStream = createWriteStream(destPath);

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytesWritten += value.byteLength;
      if (bytesWritten > MAX_VIDEO_BYTES) {
        rejected = true;
        fileStream.destroy();
        try { await reader.cancel(); } catch { /* ignore */ }
        break;
      }
      if (!fileStream.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => fileStream.once('drain', () => resolve()));
      }
    }
    if (!rejected) {
      await new Promise<void>((resolve, reject) => {
        fileStream.end(() => resolve());
        fileStream.once('error', reject);
      });
    }
  } catch (err) {
    try { fileStream.destroy(); } catch { /* ignore */ }
    await cleanupPartial(destPath);
    return NextResponse.json(
      { error: 'internal', message: err instanceof Error ? err.message : 'upload failed' },
      { status: 500 },
    );
  }
  if (rejected) {
    await cleanupPartial(destPath);
    return NextResponse.json(
      { error: 'too_large', message: `file exceeds ${MAX_VIDEO_BYTES} bytes` },
      { status: 413 },
    );
  }

  if (bytesWritten === 0) {
    await cleanupPartial(destPath);
    return NextResponse.json({ error: 'validation', message: 'empty body' }, { status: 400 });
  }

  const durationSeconds = await probeDurationSeconds(destPath);
  const uploadedAt = new Date().toISOString();
  const filename = `${gameId}.${ext}`;

  const videoSource: VideoSource = {
    kind: 'local',
    filename,
    mimeType: EXT_TO_MIME[ext],
    sizeBytes: bytesWritten,
    durationSeconds,
    uploadedAt,
  };

  const updated = { ...game, videoSource, updatedAt: uploadedAt };
  await writeGame(updated);

  return NextResponse.json({ videoSource, updatedAt: uploadedAt });
}

export async function GET(req: Request, { params }: Ctx) {
  const { gameId } = await params;
  const existing = await findExistingVideo(gameId);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { filePath, ext } = existing;
  const { size } = await stat(filePath);
  const mime = EXT_TO_MIME[ext];
  const range = req.headers.get('range');

  if (!range) {
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  }

  const parsed = parseRange(range, size);
  if (!parsed) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }
  const { start, end } = parsed;
  const nodeStream = createReadStream(filePath, { start, end });
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
  return new Response(webStream, {
    status: 206,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  const game = await readGame(gameId);
  if (!game) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  await deleteExistingVideos(gameId);
  const updatedAt = new Date().toISOString();
  const updated = { ...game, videoSource: { kind: 'none' as const }, updatedAt };
  await writeGame(updated);
  return NextResponse.json({ videoSource: updated.videoSource, updatedAt });
}

// PATCH: client-reported metadata (e.g., durationSeconds from onLoadedMetadata fallback)
export async function PATCH(req: Request, { params }: Ctx) {
  const { gameId } = await params;
  const game = await readGame(gameId);
  if (!game) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (game.videoSource.kind !== 'local') {
    return NextResponse.json({ error: 'validation', message: 'no video uploaded' }, { status: 400 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'validation', message: 'invalid JSON' }, { status: 400 });
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('durationSeconds' in raw) ||
    (typeof (raw as { durationSeconds: unknown }).durationSeconds !== 'number' &&
      (raw as { durationSeconds: unknown }).durationSeconds !== null)
  ) {
    return NextResponse.json({ error: 'validation', message: 'durationSeconds required (number|null)' }, { status: 400 });
  }
  const duration = (raw as { durationSeconds: number | null }).durationSeconds;
  if (duration !== null && (!Number.isFinite(duration) || duration < 0)) {
    return NextResponse.json({ error: 'validation', message: 'durationSeconds must be >= 0' }, { status: 400 });
  }
  const updatedAt = new Date().toISOString();
  const nextSource: VideoSource = { ...game.videoSource, durationSeconds: duration };
  const updated = { ...game, videoSource: nextSource, updatedAt };
  await writeGame(updated);
  return NextResponse.json({ videoSource: nextSource, updatedAt });
}

function parseRange(header: string, totalSize: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const startStr = match[1];
  const endStr = match[2];
  let start: number;
  let end: number;
  if (startStr === '' && endStr === '') return null;
  if (startStr === '') {
    // suffix: last N bytes
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number(startStr);
    end = endStr === '' ? totalSize - 1 : Number(endStr);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= totalSize) return null;
  if (end >= totalSize) end = totalSize - 1;
  return { start, end };
}

async function cleanupPartial(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}
