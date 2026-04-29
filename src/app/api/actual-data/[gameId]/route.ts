import { NextResponse } from 'next/server';
import { readGame, writeGame, deleteGame } from '@/lib/actualData/server/gameStore';
import { deleteExistingVideos } from '@/lib/actualData/server/videoStore';
import { ActualGameDataSchema } from '@/lib/actualData/schema';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  const data = await readGame(gameId);
  if (!data) {
    return NextResponse.json(
      { error: 'not_found', message: `${gameId} not found` },
      { status: 404 },
    );
  }
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { gameId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'validation', message: 'invalid JSON' }, { status: 400 });
  }

  const parsed = ActualGameDataSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', message: 'schema invalid', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (parsed.data.gameId !== gameId) {
    return NextResponse.json(
      { error: 'validation', message: 'gameId mismatch' },
      { status: 400 },
    );
  }

  const existing = await readGame(gameId);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();
  const data = { ...parsed.data, updatedAt };
  await writeGame(data);

  return NextResponse.json({ ok: true, updatedAt });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { gameId } = await params;
  const deleted = await deleteGame(gameId);
  if (!deleted) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  await deleteExistingVideos(gameId);
  return new NextResponse(null, { status: 204 });
}
