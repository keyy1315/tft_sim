import { create } from 'zustand';
import { PlacedChampion } from '@/types';

type BattleStatus = 'idle' | 'running' | 'paused' | 'finished';

interface BattleState {
  playerTeam: PlacedChampion[];
  enemyTeam: PlacedChampion[];
  status: BattleStatus;
  currentTick: number;
  setPlayerTeam: (team: PlacedChampion[]) => void;
  setEnemyTeam: (team: PlacedChampion[]) => void;
  setStatus: (status: BattleStatus) => void;
  setCurrentTick: (tick: number) => void;
}

export const useBattleStore = create<BattleState>((set) => ({
  playerTeam: [],
  enemyTeam: [],
  status: 'idle',
  currentTick: 0,
  setPlayerTeam: (team) => set({ playerTeam: team }),
  setEnemyTeam: (team) => set({ enemyTeam: team }),
  setStatus: (status) => set({ status }),
  setCurrentTick: (tick) => set({ currentTick: tick }),
}));
