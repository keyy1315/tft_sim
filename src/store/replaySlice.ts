import { create } from 'zustand';
import { TickSnapshot } from '@/types';

interface ReplayState {
  snapshots: TickSnapshot[];
  replayTick: number;
  playbackSpeed: 1 | 2 | 4;
  setSnapshots: (snapshots: TickSnapshot[]) => void;
  setReplayTick: (tick: number) => void;
  setPlaybackSpeed: (speed: 1 | 2 | 4) => void;
  reset: () => void;
}

export const useReplayStore = create<ReplayState>((set) => ({
  snapshots: [],
  replayTick: 0,
  playbackSpeed: 1,
  setSnapshots: (snapshots) => set({ snapshots }),
  setReplayTick: (tick) => set({ replayTick: tick }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  reset: () => set({ snapshots: [], replayTick: 0, playbackSpeed: 1 }),
}));
