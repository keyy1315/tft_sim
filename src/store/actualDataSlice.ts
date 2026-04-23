import { create } from 'zustand';
import type {
  ActualGameData,
  ActualGameSummary,
  NewGameMeta,
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
}));
