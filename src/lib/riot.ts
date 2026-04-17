const RIOT_API_KEY = process.env.RIOT_API_KEY!;
const ASIA_BASE = 'https://asia.api.riotgames.com';

interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

interface TftMatchParticipant {
  puuid: string;
  placement: number;
  units: Array<{
    character_id: string;
    tier: number;
    itemNames: string[];
  }>;
  traits: Array<{
    name: string;
    num_units: number;
    tier_current: number;
    style: number;
  }>;
}

interface TftMatchInfo {
  game_datetime: number;
  game_length: number;
  queue_id: number;
  tft_game_type: string;
  tft_set_number: number;
  participants: TftMatchParticipant[];
}

interface TftMatchDetail {
  metadata: { match_id: string };
  info: TftMatchInfo;
}

async function riotFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'X-Riot-Token': RIOT_API_KEY },
  });
  if (!res.ok) {
    const status = res.status;
    if (status === 404) throw new Error('SUMMONER_NOT_FOUND');
    if (status === 429) throw new Error('RATE_LIMITED');
    throw new Error(`Riot API error: ${status}`);
  }
  return res.json() as Promise<T>;
}

export async function getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount> {
  return riotFetch<RiotAccount>(
    `${ASIA_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
}

export async function getAccountByPuuid(puuid: string): Promise<RiotAccount> {
  return riotFetch<RiotAccount>(
    `${ASIA_BASE}/riot/account/v1/accounts/by-puuid/${puuid}`
  );
}

export async function getMatchIds(puuid: string, count = 20): Promise<string[]> {
  return riotFetch<string[]>(
    `${ASIA_BASE}/tft/match/v1/matches/by-puuid/${puuid}/ids?count=${count}`
  );
}

export async function getMatchDetail(matchId: string): Promise<TftMatchDetail> {
  return riotFetch<TftMatchDetail>(
    `${ASIA_BASE}/tft/match/v1/matches/${matchId}`
  );
}

export interface ParsedTrait {
  name: string;
  numUnits: number;
  style: number;
  tierCurrent: number;
}

export interface ParsedMatch {
  matchId: string;
  placement: number;
  champions: Array<{ id: string; tier: number; items: string[] }>;
  gameDatetime: string;
  gameLength: number;
  queueId: number;
  setId: string;
  traits: ParsedTrait[];
}

export interface ParsedParticipant {
  puuid: string;
  gameName?: string;
  tagLine?: string;
  placement: number;
  champions: Array<{ id: string; tier: number; items: string[] }>;
  traits: ParsedTrait[];
}

export function parseAllParticipants(match: TftMatchDetail): ParsedParticipant[] {
  return match.info.participants
    .map((p) => ({
      puuid: p.puuid,
      placement: p.placement,
      champions: p.units.map((u) => ({
        id: u.character_id,
        tier: u.tier,
        items: u.itemNames ?? [],
      })),
      traits: p.traits
        .filter((t) => t.style >= 1)
        .map((t) => ({
          name: t.name,
          numUnits: t.num_units,
          style: t.style,
          tierCurrent: t.tier_current,
        })),
    }))
    .sort((a, b) => a.placement - b.placement);
}

export function parseMatchForPlayer(match: TftMatchDetail, puuid: string): ParsedMatch | null {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) return null;

  return {
    matchId: match.metadata.match_id,
    placement: participant.placement,
    champions: participant.units.map((u) => ({
      id: u.character_id,
      tier: u.tier,
      items: u.itemNames ?? [],
    })),
    gameDatetime: new Date(match.info.game_datetime).toISOString(),
    gameLength: match.info.game_length,
    queueId: match.info.queue_id,
    setId: `set${match.info.tft_set_number}`,
    traits: participant.traits
      .filter((t) => t.style >= 1)
      .map((t) => ({
        name: t.name,
        numUnits: t.num_units,
        style: t.style,
        tierCurrent: t.tier_current,
      })),
  };
}
