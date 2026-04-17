import { NextRequest, NextResponse } from 'next/server';
import { getMatchDetail, getAccountByPuuid, parseAllParticipants } from '@/lib/riot';
import type { ParsedParticipant } from '@/lib/riot';

const MAX_CACHE_SIZE = 200;
const matchCache = new Map<string, ParsedParticipant[]>();

function cacheSet(key: string, value: ParsedParticipant[]) {
  if (matchCache.size >= MAX_CACHE_SIZE) {
    const oldest = matchCache.keys().next().value;
    if (oldest !== undefined) matchCache.delete(oldest);
  }
  matchCache.set(key, value);
}

const MATCH_ID_RE = /^[A-Z]{2,4}_\d+$/;

export async function POST(req: NextRequest) {
  const { matchId } = (await req.json()) as { matchId: string };

  if (!matchId || !MATCH_ID_RE.test(matchId)) {
    return NextResponse.json({ error: 'matchId 형식 오류' }, { status: 400 });
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

    cacheSet(matchId, withNames);

    return NextResponse.json({ participants: withNames });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'API 요청 한도 초과' }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
