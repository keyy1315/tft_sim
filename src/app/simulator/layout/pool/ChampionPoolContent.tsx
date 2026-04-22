'use client';

import { useMemo } from 'react';
import SearchBar from '@/components/ui/SearchBar';
import DraggableChampionCard from '@/components/builder/DraggableChampionCard';
import { useViewport } from '@/hooks/useViewport';
import type { SimulatorLayoutProps } from '../types';

export default function ChampionPoolContent({ data, poolFilters, tm }: SimulatorLayoutProps) {
  const viewport = useViewport();
  const iconSize = viewport === 'tablet' ? 40 : 54;
  const { champSearch, setChampSearch, champCostFilter, setChampCostFilter } = poolFilters;

  const filteredChampions = useMemo(() => {
    let f = data.champions;
    if (champSearch) {
      const s = champSearch.toLowerCase();
      f = f.filter(c => c.name.toLowerCase().includes(s) || c.traits.some(t => t.toLowerCase().includes(s)));
    }
    if (champCostFilter) f = f.filter(c => c.cost === champCostFilter);
    return [...f].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [data.champions, champSearch, champCostFilter]);

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      <SearchBar value={champSearch} onChange={setChampSearch} placeholder="챔피언/특성 검색..." />
      <div className="flex gap-1">
        <button
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${champCostFilter === null ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
          onClick={() => setChampCostFilter(null)}
        >
          전체
        </button>
        {[1, 2, 3, 4, 5].map(cost => (
          <button
            key={cost}
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${champCostFilter === cost ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
            onClick={() => setChampCostFilter(champCostFilter === cost ? null : cost)}
          >
            {cost}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 overflow-y-auto min-h-0 p-1">
        {filteredChampions.map(c => (
          <DraggableChampionCard key={c.apiName} champion={c} size={iconSize} onClick={tm.handleQuickAddChampion} />
        ))}
      </div>
    </div>
  );
}
