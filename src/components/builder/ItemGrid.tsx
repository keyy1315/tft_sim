'use client';

import { useState } from 'react';
import { RawItem } from '@/types';
import ItemIcon from './ItemIcon';
import SearchBar from '@/components/ui/SearchBar';

interface ItemGridProps {
  items: RawItem[];
  onSelect: (item: RawItem) => void;
}

type ItemCategory = 'all' | 'component' | 'combined' | 'artifact' | 'special';

export default function ItemGrid({ items, onSelect }: ItemGridProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ItemCategory>('combined');

  const filtered = items.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (category === 'component') return item.composition.length === 0 && !item.apiName.includes('TFT16_');
    if (category === 'combined') return item.composition.length === 2;
    if (category === 'artifact') return item.apiName.includes('Artifact') || item.icon.includes('Artifact');
    if (category === 'special') return item.apiName.includes('TFT16_');
    return true;
  });

  const categories: { key: ItemCategory; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'component', label: '조합재료' },
    { key: 'combined', label: '완성템' },
    { key: 'artifact', label: '유물' },
    { key: 'special', label: '특수' },
  ];

  return (
    <div className="space-y-3">
      <SearchBar value={search} onChange={setSearch} placeholder="아이템 검색..." />
      <div className="flex gap-1 flex-wrap">
        {categories.map(({ key, label }) => (
          <button
            key={key}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              category === key ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1.5 max-h-[300px] overflow-y-auto p-1">
        {filtered.map((item) => (
          <ItemIcon
            key={item.apiName}
            item={item}
            size={36}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </div>
  );
}
