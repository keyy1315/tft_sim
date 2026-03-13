import { create } from 'zustand';
import { RawChampion, RawItem } from '@/types';

interface UiState {
  selectedChampion: RawChampion | null;
  starLevel: number;
  selectedItems: RawItem[];
  targetArmor: number;
  targetMr: number;
  selectedUnitId: string | null;
  activePanel: string | null;
  setSelectedChampion: (c: RawChampion | null) => void;
  setStarLevel: (l: number) => void;
  addItem: (item: RawItem) => void;
  removeItem: (index: number) => void;
  setTargetArmor: (v: number) => void;
  setTargetMr: (v: number) => void;
  setSelectedUnitId: (id: string | null) => void;
  setActivePanel: (panel: string | null) => void;
  reset: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedChampion: null,
  starLevel: 1,
  selectedItems: [],
  targetArmor: 40,
  targetMr: 40,
  selectedUnitId: null,
  activePanel: null,
  setSelectedChampion: (c) => set({ selectedChampion: c }),
  setStarLevel: (l) => set({ starLevel: l }),
  addItem: (item) => set((s) => s.selectedItems.length < 3 ? { selectedItems: [...s.selectedItems, item] } : s),
  removeItem: (index) => set((s) => ({ selectedItems: s.selectedItems.filter((_, i) => i !== index) })),
  setTargetArmor: (v) => set({ targetArmor: v }),
  setTargetMr: (v) => set({ targetMr: v }),
  setSelectedUnitId: (id) => set({ selectedUnitId: id }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  reset: () => set({ selectedChampion: null, starLevel: 1, selectedItems: [], targetArmor: 40, targetMr: 40, selectedUnitId: null, activePanel: null }),
}));
