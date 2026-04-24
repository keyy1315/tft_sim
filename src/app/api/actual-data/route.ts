import { NextResponse } from 'next/server';
import { listGameSummaries, createGameFile, listGameIds } from '@/lib/actualData/server/gameStore';
import { generateGameId } from '@/lib/actualData/roundFactory';
import type { ActualGameData, NewGameMeta } from '@/lib/actualData/types';
import { ShrineNameSchema } from '@/lib/actualData/schema';
import { z } from 'zod';

export const runtime = 'nodejs';

const NewGameBodySchema = z.object({
  patchVersion: z.string().min(1),
  playerRiotId: z.string().regex(/^.{2,16}#[A-Z0-9]{2,5}$/i),
  shrinesInPlay: z.tuple([ShrineNameSchema, ShrineNameSchema])
    .refine(([a, b]) => a !== b, { message: 'shrinesInPlay must be distinct' }),
});

export async function GET() {
  const games = await listGameSummaries();
  return NextResponse.json({ games });
}

export async function POST(req: Request) {
  let body: NewGameMeta;
  try {
    const raw = await req.json();
    body = NewGameBodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: 'validation', message: 'invalid body', issues: err instanceof z.ZodError ? err.issues : [] },
      { status: 400 },
    );
  }

  const existingIds = await listGameIds();
  const gameId = generateGameId(existingIds);
  const now = new Date().toISOString();

  const data: ActualGameData = {
    gameId,
    videoSource: { kind: 'none' },
    patchVersion: body.patchVersion,
    playerRiotId: body.playerRiotId,
    finalPlacement: 8,
    shrinesInPlay: body.shrinesInPlay,
    timeline: [],
    createdAt: now,
    updatedAt: now,
    rounds: [],
  };

  try {
    await createGameFile(data);
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'EEXIST') {
      // rare: retry once with N+1
      const retryId = generateGameId([...existingIds, gameId]);
      await createGameFile({ ...data, gameId: retryId });
      return NextResponse.json({ gameId: retryId, createdAt: now, updatedAt: now }, { status: 201 });
    }
    throw err;
  }

  return NextResponse.json({ gameId, createdAt: now, updatedAt: now }, { status: 201 });
}
