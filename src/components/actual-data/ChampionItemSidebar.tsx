'use client';

import { useMemo, useState } from 'react';
import type { RawChampion, RawItem } from '@/types';
import { getItemCategory, isDisabledItem } from '@/lib/simulator/systems/item';
import DraggableChampionCard from '@/components/builder/DraggableChampionCard';
import DraggableItemIcon from '@/components/builder/DraggableItemIcon';
import SearchBar from '@/components/ui/SearchBar';
import DraggableItemRemoverTool from './DraggableItemRemoverTool';
import DraggableNovaSelectorTool from './DraggableNovaSelectorTool';

type Tab = 'champions' | 'items' | 'tools';
type CostFilter = null | 1 | 2 | 3 | 4 | 5;
type ItemTab = 'combined' | 'artifact' | 'radiant' | 'emblem' | 'all';

interface Props {
  champions: RawChampion[];
  items: RawItem[];
  /** Click fallback for non-DnD placement — receives either a champion or item selection. */
  onChampionClick?: (c: RawChampion) => void;
  onItemClick?: (i: RawItem) => void;
}

/**
 * Right-side always-open panel for the actual-data editor.
 *
 * Mirrors /simulator's pool UX: champions + items in tabs, drag to place on board
 * (click also works when DnD activation threshold isn't met).
 */
export default function ChampionItemSidebar({ champions, items, onChampionClick, onItemClick }: Props) {
  const [tab, setTab] = useState<Tab>('champions');

  return (
    <aside className="flex flex-col border-l border-gray-800 bg-[#0d1117] w-[340px] flex-shrink-0">
      <div className="flex items-center border-b border-gray-800 px-2 py-1.5">
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            className={`px-2 py-1 rounded ${tab === 'champions' ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
            onClick={() => setTab('champions')}
          >
            챔피언
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded ${tab === 'items' ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
            onClick={() => setTab('items')}
          >
            아이템
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded ${tab === 'tools' ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
            onClick={() => setTab('tools')}
          >
            도구
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'champions' && <ChampionSection champions={champions} onChampionClick={onChampionClick} />}
        {tab === 'items' && <ItemSection items={items} onItemClick={onItemClick} />}
        {tab === 'tools' && <ToolsSection />}
      </div>
    </aside>
  );
}

function ChampionSection({ champions, onChampionClick }: { champions: RawChampion[]; onChampionClick?: (c: RawChampion) => void }) {
  const [search, setSearch] = useState('');
  const [costFilter, setCostFilter] = useState<CostFilter>(null);

  const filtered = useMemo(() => {
    const list = champions.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
          !c.traits.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
      if (costFilter && c.cost !== costFilter) return false;
      return true;
    });
    return [...list].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [champions, search, costFilter]);

  return (
    <div className="flex flex-col h-full p-2 space-y-2">
      <SearchBar value={search} onChange={setSearch} placeholder="챔피언/특성 검색..." />
      <div className="flex gap-1 flex-wrap">
        <button
          type="button"
          className={`px-2 py-0.5 rounded text-[11px] font-medium ${costFilter === null ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
          onClick={() => setCostFilter(null)}
        >전체</button>
        {[1, 2, 3, 4, 5].map((cost) => (
          <button
            key={cost}
            type="button"
            className={`px-2 py-0.5 rounded text-[11px] font-medium ${costFilter === cost ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
            onClick={() => setCostFilter(costFilter === cost ? null : cost as CostFilter)}
          >{cost}</button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 overflow-y-auto pr-1 flex-1">
        {filtered.map(c => (
          <DraggableChampionCard
            key={c.apiName}
            champion={c}
            size={56}
            onClick={onChampionClick}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-4 text-center text-gray-500 py-4 text-xs">검색 결과가 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function ItemSection({ items, onItemClick }: { items: RawItem[]; onItemClick?: (i: RawItem) => void }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<ItemTab>('combined');

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      const cat = getItemCategory(item);
      if (isDisabledItem(item)) return false;
      if (cat === 'piltover' || cat === 'special') return false;
      if (cat === 'bilgewater') return false;
      if (cat === 'void') return false;
      if (tab === 'all') return true;
      if (tab === 'combined' && (cat === 'darkin' || cat === 'animasquad' || cat === 'psyops')) return true;
      return cat === tab;
    });
  }, [items, search, tab]);

  const tabs: { key: ItemTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'combined', label: '완성템' },
    { key: 'artifact', label: '유물' },
    { key: 'radiant', label: '찬란' },
    { key: 'emblem', label: '상징' },
  ];

  return (
    <div className="flex flex-col h-full p-2 space-y-2">
      <SearchBar value={search} onChange={setSearch} placeholder="아이템 검색..." />
      <div className="flex gap-1 flex-wrap">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`px-2 py-0.5 rounded text-[11px] font-medium ${tab === key ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'}`}
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5 overflow-y-auto pr-1 flex-1">
        {filtered.map(item => (
          <div key={item.apiName} onClick={onItemClick ? () => onItemClick(item) : undefined}>
            <DraggableItemIcon item={item} size={36} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-5 text-center text-gray-500 py-4 text-xs">검색 결과가 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function ToolsSection() {
  return (
    <div className="flex flex-col h-full p-2 space-y-3">
      <p className="text-[11px] text-gray-400 leading-relaxed">
        유닛 위로 드래그해서 사용합니다.
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        <DraggableItemRemoverTool size={44} />
        <DraggableNovaSelectorTool size={44} />
      </div>
    </div>
  );
}
