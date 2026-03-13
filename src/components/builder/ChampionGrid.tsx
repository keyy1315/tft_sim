'use client';

import { useState } from 'react';
import { RawChampion } from '@/types';
import ChampionCard from './ChampionCard';
import SearchBar from '@/components/ui/SearchBar';

interface ChampionGridProps {
  champions: RawChampion[];
  selectedChampion?: RawChampion | null;
  onSelect: (champion: RawChampion) => void;
  filterCost?: number | null;
}

export default function ChampionGrid({ champions, selectedChampion, onSelect, filterCost }: ChampionGridProps) {
  const [search, setSearch] = useState('');
  const [costFilter, setCostFilter] = useState<number | null>(filterCost ?? null);

  const filtered = champions.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.traits.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    if (costFilter && c.cost !== costFilter) return false;
    return true;
  });

  // Sort by cost
  const sorted = [...filtered].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <SearchBar value={search} onChange={setSearch} placeholder="챔피언/특성 검색..." />
      <div className="flex gap-1">
        <button
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${costFilter === null ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
          onClick={() => setCostFilter(null)}
        >
          전체
        </button>
        {[1, 2, 3, 4, 5].map((cost) => (
          <button
            key={cost}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${costFilter === cost ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
            onClick={() => setCostFilter(costFilter === cost ? null : cost)}
          >
            {cost}코스트
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-2 max-h-[400px] overflow-y-auto p-1">
        {sorted.map((c) => (
          <ChampionCard
            key={c.apiName}
            champion={c}
            size={56}
            selected={selectedChampion?.apiName === c.apiName}
            onClick={() => onSelect(c)}
          />
        ))}
      </div>
      {sorted.length === 0 && (
        <div className="text-center text-gray-500 py-8">검색 결과가 없습니다.</div>
      )}
    </div>
  );
}
