/**
 * 전적검색(`/api/lookup`) 응답 및 관련 타입.
 * page.tsx 와 store/lookupSlice.ts 양측에서 사용.
 */

export interface LookupChampion {
  id: string;
  tier: number;
  items: string[];
}

export interface LookupTraitData {
  name: string;
  numUnits: number;
  style: number;
  tierCurrent: number;
}

export interface TraitMetaEntry {
  name: string;
  icon: string;
  isUnique: boolean;
  desc: string;
}

export interface ChampionMetaEntry {
  name: string;
  cost: number;
  traits: string[];
}

export interface ItemMetaEntry {
  name: string;
  desc: string;
  icon: string;
}

export interface MatchData {
  match_id: string;
  placement: number;
  champions: LookupChampion[];
  game_datetime: string;
  game_length: number;
  queue_id: number | null;
  set_id: string | null;
  traits: LookupTraitData[] | null;
}

export interface SummonerData {
  gameName: string;
  tagLine: string;
  puuid: string;
}

export interface LookupResult {
  summoner: SummonerData;
  matches: MatchData[];
  traitMeta: Record<string, TraitMetaEntry>;
  championMeta: Record<string, ChampionMetaEntry>;
  itemMeta: Record<string, ItemMetaEntry>;
}
