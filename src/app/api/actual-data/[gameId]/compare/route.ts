import { NextResponse } from 'next/server';
import {
  computeGameDiff,
  loadCachedDiff,
  saveDiffCache,
  deleteDiffCache,
} from '@/lib/validation/gameDiffer';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120; // Vercel hint; local dev ignores

type Ctx = { params: Promise<{ gameId: string }> };

const PostBodySchema = z
  .object({
    n: z.number().int().positive().max(50).optional(),
    seedBase: z.number().int().optional(),
  })
  .default({});

export async function POST(req: Request, { params }: Ctx) {
  const { gameId } = await params;

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: 'validation', message: 'invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', message: 'n must be 1..50', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const diff = await computeGameDiff(gameId, {
      n: parsed.data.n ?? 10,
      seedBase: parsed.data.seedBase ?? 0,
    });
    await saveDiffCache(gameId, diff);
    return NextResponse.json({ diff });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') {
      return NextResponse.json(
        { error: 'not_found', message: `game ${gameId} not found` },
        { status: 404 },
      );
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation', message: 'game schema invalid', issues: err.issues },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[compare POST] computeGameDiff failed:', err);
    return NextResponse.json({ error: 'compute_failed', message }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  try {
    const result = await loadCachedDiff(gameId);
    if (!result) {
      return NextResponse.json(
        { error: 'no_cache', message: 'POST to compute' },
        { status: 404 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') {
      return NextResponse.json(
        { error: 'not_found', message: `game ${gameId} not found` },
        { status: 404 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[compare GET] failed:', err);
    return NextResponse.json({ error: 'read_failed', message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  await deleteDiffCache(gameId);
  return new NextResponse(null, { status: 204 });
}
