import { create } from 'zustand';
import { buildNextPvPRound } from '@/lib/actualData/roundFactory';
import type {
  ActualGameData,
  ActualGameSummary,
  NewGameMeta,
  PvPRound,
  ShrineRound,
  TeamSnapshot,
  OpponentSnapshot,
  ActualGameMeta,
} from '@/lib/actualData/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ActualDataState {
  currentGame: ActualGameData | null;
  currentRoundIndex: number | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  gameListCache: ActualGameSummary[] | null;

  // Game lifecycle
  loadGame: (gameId: string) => Promise<void>;
  createGame: (meta: NewGameMeta) => Promise<string>;
  deleteGame: (gameId: string) => Promise<void>;
  saveCurrentGame: () => Promise<void>;
  refreshGameList: () => Promise<void>;

  // Round navigation
  setCurrentRound: (index: number) => void;
  addPvPRound: (roundName: string) => void;
  addShrineRound: (roundName: string) => void;
  removeRound: (index: number) => void;

  // Round field updates
  updateRoundMeta: (index: number, patch: Partial<{ roundName: string; videoStartTime: number; videoEndTime: number; notes: string }>) => void;
  updatePvPRound: (index: number, patch: Partial<Omit<PvPRound, 'type'>>) => void;
  updateShrineRound: (index: number, patch: Partial<Omit<ShrineRound, 'type'>>) => void;
  updatePlayerTeam: (index: number, patch: Partial<TeamSnapshot>) => void;
  updateOpponent: (index: number, patch: Partial<OpponentSnapshot>) => void;

  // Game meta
  updateGameMeta: (patch: Partial<ActualGameMeta>) => void;

  // UI helper
  copyOpponentFromPreviousMeeting: (index: number, riotId: string) => void;

  // Internal setter used by future tasks
  _patchGame: (patch: Partial<ActualGameData>) => void;
}

export const useActualDataStore = create<ActualDataState>((set, get) => ({
  currentGame: null,
  currentRoundIndex: null,
  isDirty: false,
  saveStatus: 'idle',
  saveError: null,
  lastSavedAt: null,
  gameListCache: null,

  loadGame: async (gameId) => {
    const res = await fetch(`/api/actual-data/${gameId}`);
    if (!res.ok) throw new Error(`loadGame failed: ${res.status}`);
    const data = (await res.json()) as ActualGameData;
    set({
      currentGame: data,
      currentRoundIndex: data.rounds.length > 0 ? 0 : null,
      isDirty: false,
      saveStatus: 'idle',
      lastSavedAt: data.updatedAt,
    });
  },

  createGame: async (meta) => {
    const res = await fetch('/api/actual-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`createGame failed: ${err.message ?? res.status}`);
    }
    const { gameId } = (await res.json()) as { gameId: string };
    return gameId;
  },

  deleteGame: async (gameId) => {
    const res = await fetch(`/api/actual-data/${gameId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`deleteGame failed: ${res.status}`);
    }
    // refresh list
    await get().refreshGameList();
  },

  saveCurrentGame: async () => {
    const game = get().currentGame;
    if (!game) return;
    set({ saveStatus: 'saving', saveError: null });
    try {
      const res = await fetch(`/api/actual-data/${game.gameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `save failed: ${res.status}`);
      }
      const { updatedAt } = (await res.json()) as { updatedAt: string };
      set({
        saveStatus: 'saved',
        lastSavedAt: updatedAt,
        isDirty: false,
        currentGame: { ...game, updatedAt },
      });
      // transition saved → idle after 2s
      setTimeout(() => {
        if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
      }, 2000);
    } catch (err) {
      set({
        saveStatus: 'error',
        saveError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  refreshGameList: async () => {
    const res = await fetch('/api/actual-data');
    if (!res.ok) throw new Error(`refreshGameList failed: ${res.status}`);
    const { games } = (await res.json()) as { games: ActualGameSummary[] };
    set({ gameListCache: games });
  },

  _patchGame: (patch) => {
    const g = get().currentGame;
    if (!g) return;
    set({ currentGame: { ...g, ...patch }, isDirty: true });
  },

  setCurrentRound: (index) => set({ currentRoundIndex: index }),

  addPvPRound: (roundName) => {
    const g = get().currentGame;
    if (!g) return;
    let prevPvP: PvPRound | null = null;
    const shrinesBetween: ShrineRound[] = [];
    for (let i = g.rounds.length - 1; i >= 0; i--) {
      const r = g.rounds[i];
      if (r.type === 'pvp') { prevPvP = r; break; }
      if (r.type === 'shrine') shrinesBetween.unshift(r);
    }
    const newRound = buildNextPvPRound(roundName, prevPvP, shrinesBetween);
    const nextRounds = [...g.rounds, newRound];
    set({
      currentGame: { ...g, rounds: nextRounds },
      currentRoundIndex: nextRounds.length - 1,
      isDirty: true,
    });
  },

  addShrineRound: (roundName) => {
    const g = get().currentGame;
    if (!g) return;
    const lastRound = g.rounds.length > 0 ? g.rounds[g.rounds.length - 1] : undefined;
    const newRound: ShrineRound = {
      type: 'shrine',
      roundName,
      videoStartTime: lastRound?.videoEndTime ?? 0,
      playerChosenShrine: g.shrinesInPlay[0],
    };
    const nextRounds = [...g.rounds, newRound];
    set({
      currentGame: { ...g, rounds: nextRounds },
      currentRoundIndex: nextRounds.length - 1,
      isDirty: true,
    });
  },

  removeRound: (index) => {
    const g = get().currentGame;
    if (!g) return;
    const nextRounds = g.rounds.filter((_, i) => i !== index);
    set({
      currentGame: { ...g, rounds: nextRounds },
      currentRoundIndex: nextRounds.length > 0 ? Math.max(0, Math.min(index, nextRounds.length - 1)) : null,
      isDirty: true,
    });
  },

  updateRoundMeta: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const nextRounds = g.rounds.map((r, i) => i === index ? { ...r, ...patch } : r);
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updatePvPRound: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const target = g.rounds[index];
    if (!target || target.type !== 'pvp') return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'pvp' ? { ...r, ...patch } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updateShrineRound: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const target = g.rounds[index];
    if (!target || target.type !== 'shrine') return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'shrine' ? { ...r, ...patch } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updatePlayerTeam: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const target = g.rounds[index];
    if (!target || target.type !== 'pvp') return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'pvp' ? { ...r, playerTeam: { ...r.playerTeam, ...patch } } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updateOpponent: (index, patch) => {
    const g = get().currentGame;
    if (!g) return;
    const target = g.rounds[index];
    if (!target || target.type !== 'pvp') return;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'pvp' ? { ...r, opponent: { ...r.opponent, ...patch } } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },

  updateGameMeta: (patch) => {
    const g = get().currentGame;
    if (!g) return;
    set({ currentGame: { ...g, ...patch }, isDirty: true });
  },

  copyOpponentFromPreviousMeeting: (index, riotId) => {
    const g = get().currentGame;
    if (!g) return;
    let src: OpponentSnapshot | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const r = g.rounds[i];
      if (r.type === 'pvp' && r.opponent.riotId === riotId) {
        src = r.opponent;
        break;
      }
    }
    if (!src) return;
    const snapshot = src;
    const nextRounds = g.rounds.map((r, i) =>
      i === index && r.type === 'pvp' ? { ...r, opponent: { ...snapshot } } : r,
    );
    set({ currentGame: { ...g, rounds: nextRounds }, isDirty: true });
  },
}));
