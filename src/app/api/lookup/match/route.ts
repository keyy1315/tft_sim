import { NextRequest, NextResponse } from 'next/server';
import { getMatchDetail, getAccountByPuuid, parseAllParticipants } from '@/lib/riot';
import type { ParsedParticipant } from '@/lib/riot';

const matchCache = new Map<string, ParsedParticipant[]>();

export async function POST(req: NextRequest) {
  const { matchId } = (await req.json()) as { matchId: string };

  if (!matchId) {
    return NextResponse.json({ error: 'matchId 필요' }, { status: 400 });
  }

  try {
    const cached = matchCache.get(matchId);
    if (cached) {
      return NextResponse.json({ participants: cached });
    }

    const detail = await getMatchDetail(matchId);
    const participants = parseAllParticipants(detail);

    const withNames = await Promise.all(
      participants.map(async (p) => {
        try {
          const account = await getAccountByPuuid(p.puuid);
          return { ...p, gameName: account.gameName, tagLine: account.tagLine };
        } catch {
          return p;
        }
      })
    );

    matchCache.set(matchId, withNames);

    return NextResponse.json({ participants: withNames });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'API 요청 한도 초과' }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
