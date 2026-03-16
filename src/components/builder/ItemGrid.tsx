'use client';

import { useState } from 'react';
import { RawItem, ActiveTrait, PlacedChampion } from '@/types';
import { getItemCategory, canEquipItem, isDisabledItem } from '@/lib/simulator/systems/item';
import ItemIcon from './ItemIcon';
import SearchBar from '@/components/ui/SearchBar';

interface ItemGridProps {
  items: RawItem[];
  onSelect: (item: RawItem) => void;
  activeTraits?: ActiveTrait[];
  champion?: PlacedChampion;
}

type ItemTab = 'all' | 'component' | 'combined' | 'artifact' | 'emblem' | 'radiant';

export default function ItemGrid({ items, onSelect, activeTraits, champion }: ItemGridProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<ItemTab>('combined');

  // 빌지워터 시너지 활성 여부
  const bgTrait = activeTraits?.find(t => t.trait.apiName === 'TFT16_Bilgewater');
  const bilgewaterActive = bgTrait && bgTrait.activeEffect;

  // 공허 시너지 활성 여부
  const voidTrait = activeTraits?.find(t => t.trait.apiName === 'TFT16_Void');
  const voidActive = voidTrait && voidTrait.activeEffect;

  const filtered = items.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    const cat = getItemCategory(item);

    // 비활성 아이템 숨김
    if (isDisabledItem(item)) return false;
    // 필트오버 → 항상 숨김 (팀 모듈 슬롯 전용)
    if (cat === 'piltover') return false;
    // 특수 → 항상 숨김
    if (cat === 'special') return false;
    // 빌지워터 → 시너지 활성 시에만 표시
    if (cat === 'bilgewater') {
      if (!bilgewaterActive) return false;
      if (Object.keys(item.effects).length === 0) return false;
    }
    // 공허 돌연변이 → 시너지 활성 시에만 표시
    if (cat === 'void') {
      if (!voidActive) return false;
    }

    if (tab === 'all') return true;
    if (tab === 'combined' && (cat === 'bilgewater' || cat === 'void' || cat === 'darkin')) return true;
    return cat === tab;
  });

  const tabs: { key: ItemTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'combined', label: '완성템' },
    { key: 'artifact', label: '유물' },
    { key: 'radiant', label: '찬란' },
    { key: 'emblem', label: '상징' },
  ];

  return (
    <div className="space-y-3">
      <SearchBar value={search} onChange={setSearch} placeholder="아이템 검색..." />
      <div className="flex gap-1 flex-wrap">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              tab === key ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1.5 max-h-[300px] overflow-y-auto p-1">
        {filtered.map((item) => {
          const validation = activeTraits && champion
            ? canEquipItem(item, champion, activeTraits)
            : { canEquip: true };
          const disabled = !validation.canEquip;

          return (
            <div
              key={item.apiName}
              className={disabled ? 'opacity-30 cursor-not-allowed' : ''}
              title={disabled ? validation.reason : item.name}
            >
              <ItemIcon
                item={item}
                size={36}
                onClick={disabled ? undefined : () => onSelect(item)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
