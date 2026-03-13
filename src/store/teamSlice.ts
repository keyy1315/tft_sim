import { create } from 'zustand';
import { RawChampion, RawItem, RawAugment, PlacedChampion, ActiveTrait, HexCoord } from '@/types';

function coordMatch(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

interface TeamState {
  placedChampions: PlacedChampion[];
  selectedAugments: RawAugment[];
  activeTraits: ActiveTrait[];
  placeChampion: (champion: RawChampion, position: HexCoord) => void;
  removeChampion: (position: HexCoord) => void;
  moveChampion: (from: HexCoord, to: HexCoord) => void;
  setChampionStar: (position: HexCoord, starLevel: number) => void;
  addChampionItem: (position: HexCoord, item: RawItem) => void;
  removeChampionItem: (position: HexCoord, itemIndex: number) => void;
  setActiveTraits: (traits: ActiveTrait[]) => void;
  addAugment: (aug: RawAugment) => void;
  removeAugment: (index: number) => void;
  clearBoard: () => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  placedChampions: [],
  selectedAugments: [],
  activeTraits: [],
  placeChampion: (champion, position) =>
    set((s) => {
      if (s.placedChampions.length >= 8) return s;
      const existing = s.placedChampions.find(
        (p) => coordMatch(p.position, position)
      );
      if (existing) return s;
      return {
        placedChampions: [
          ...s.placedChampions,
          { champion, position, starLevel: 1, items: [] },
        ],
      };
    }),
  removeChampion: (position) =>
    set((s) => ({
      placedChampions: s.placedChampions.filter(
        (p) => !coordMatch(p.position, position)
      ),
    })),
  moveChampion: (from, to) =>
    set((s) => ({
      placedChampions: s.placedChampions.map((p) =>
        coordMatch(p.position, from) ? { ...p, position: to } : p
      ),
    })),
  setChampionStar: (position, starLevel) =>
    set((s) => ({
      placedChampions: s.placedChampions.map((p) =>
        coordMatch(p.position, position) ? { ...p, starLevel } : p
      ),
    })),
  addChampionItem: (position, item) =>
    set((s) => ({
      placedChampions: s.placedChampions.map((p) =>
        coordMatch(p.position, position) && p.items.length < 3
          ? { ...p, items: [...p.items, item] }
          : p
      ),
    })),
  removeChampionItem: (position, itemIndex) =>
    set((s) => ({
      placedChampions: s.placedChampions.map((p) =>
        coordMatch(p.position, position)
          ? { ...p, items: p.items.filter((_, i) => i !== itemIndex) }
          : p
      ),
    })),
  setActiveTraits: (traits) => set({ activeTraits: traits }),
  addAugment: (aug) =>
    set((s) => s.selectedAugments.length < 3 ? { selectedAugments: [...s.selectedAugments, aug] } : s),
  removeAugment: (index) =>
    set((s) => ({ selectedAugments: s.selectedAugments.filter((_, i) => i !== index) })),
  clearBoard: () => set({ placedChampions: [], selectedAugments: [], activeTraits: [] }),
}));
