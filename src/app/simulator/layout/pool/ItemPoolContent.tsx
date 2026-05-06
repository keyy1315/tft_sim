'use client';

import SearchBar from '@/components/ui/SearchBar';
import DraggableItemIcon from '@/components/builder/DraggableItemIcon';
import { getItemCategory, isDisabledItem } from '@/lib/simulator/systems/item';
import { useViewport } from '@/hooks/useViewport';
import type { ItemFilterTab, SimulatorLayoutProps } from '../types';

// 2-row 레이아웃: row1 = combined 계열, row2 = specialty 계열.
// 7 개 버튼이 한 줄에 너무 좁아 보이는 이슈 회피 (PR9 fix).
const FILTER_ROWS: ReadonlyArray<ReadonlyArray<{ key: ItemFilterTab; label: string }>> = [
  [
    { key: 'all', label: '전체' },
    { key: 'combined', label: '완성' },
    { key: 'animasquad', label: '동물특공대' },
    { key: 'psyops', label: '초능력' },
  ],
  [
    { key: 'artifact', label: '유물' },
    { key: 'radiant', label: '찬란' },
    { key: 'emblem', label: '상징' },
  ],
];

export default function ItemPoolContent({ data, poolFilters, tm }: SimulatorLayoutProps) {
  const viewport = useViewport();
  const iconSize = viewport === 'tablet' ? 36 : 48;
  const { itemSearch, setItemSearch, itemCategoryFilter, setItemCategoryFilter } = poolFilters;

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      <SearchBar value={itemSearch} onChange={setItemSearch} placeholder="아이템 검색..." />
      <div className="flex flex-col gap-1 shrink-0">
        {FILTER_ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-1 flex-wrap">
            {row.map(({ key, label }) => (
              <button
                key={key}
                className={`px-2 py-0.5 rounded text-[10px] font-medium ${itemCategoryFilter === key ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
                onClick={() => setItemCategoryFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-0.5 overflow-y-auto min-h-0 p-1">
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
            // 동물특공대/초능력은 본인 탭 또는 '완성' 통합 탭 둘 다 노출
            if (cat === 'animasquad' || cat === 'psyops') {
              if (itemCategoryFilter !== 'combined' && itemCategoryFilter !== cat) return false;
            } else if (cat === 'void' || cat === 'darkin') {
              if (itemCategoryFilter !== 'combined') return false;
            } else if (cat !== itemCategoryFilter) return false;
          }
          return true;
        }).map(item => (
          <DraggableItemIcon key={item.apiName} item={item} size={iconSize} />
        ))}
      </div>
    </div>
  );
}
