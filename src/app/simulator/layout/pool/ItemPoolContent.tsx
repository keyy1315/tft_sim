'use client';

import SearchBar from '@/components/ui/SearchBar';
import DraggableItemIcon from '@/components/builder/DraggableItemIcon';
import { getItemCategory, isDisabledItem } from '@/lib/simulator/systems/item';
import type { ItemFilterTab, SimulatorLayoutProps } from '../types';

const FILTERS: { key: ItemFilterTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'combined', label: '완성' },
  { key: 'artifact', label: '유물' },
  { key: 'radiant', label: '찬란' },
  { key: 'emblem', label: '상징' },
];

export default function ItemPoolContent({ data, poolFilters, tm }: SimulatorLayoutProps) {
  const { itemSearch, setItemSearch, itemCategoryFilter, setItemCategoryFilter } = poolFilters;

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      <SearchBar value={itemSearch} onChange={setItemSearch} placeholder="아이템 검색..." />
      <div className="flex gap-1 shrink-0">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${itemCategoryFilter === key ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
            onClick={() => setItemCategoryFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 overflow-y-auto min-h-0 p-1">
        {data.items.filter(item => {
          if (isDisabledItem(item)) return false;
          const cat = getItemCategory(item);
          if (cat === 'piltover' || cat === 'special' || cat === 'bilgewater') return false;
          if (cat === 'void') {
            const voidTrait = tm.playerTraits.find(t => t.trait.apiName === 'TFT16_Void')
              ?? tm.enemyTraits.find(t => t.trait.apiName === 'TFT16_Void');
            if (!voidTrait || !voidTrait.activeEffect) return false;
          }
          if (itemSearch && !item.name.toLowerCase().includes(itemSearch.toLowerCase())) return false;
          if (itemCategoryFilter !== 'all') {
            if (cat === 'void' || cat === 'darkin') {
              if (itemCategoryFilter !== 'combined') return false;
            } else if (cat !== itemCategoryFilter) return false;
          }
          return true;
        }).map(item => (
          <DraggableItemIcon key={item.apiName} item={item} size={48} />
        ))}
      </div>
    </div>
  );
}
