'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { RawAugment, AugmentTier } from '@/types';
import { getAugmentImage, TIER_BORDER_COLORS } from '@/data/imageMap';
import { getAugmentTier } from '@/lib/simulator/systems/augment';
import SearchBar from '@/components/ui/SearchBar';

interface AugmentSelectorProps {
  augments: RawAugment[];
  onSelect: (aug: RawAugment) => void;
  selectedApiNames: string[];
}

const TIER_FILTERS: { label: string; value: AugmentTier | null }[] = [
  { label: '전체', value: null },
  { label: '실버', value: 'silver' },
  { label: '골드', value: 'gold' },
  { label: '프리즘', value: 'prismatic' },
];

const TIER_FILTER_COLORS: Record<string, string> = {
  silver: 'bg-gray-500',
  gold: 'bg-yellow-600',
  prismatic: 'bg-fuchsia-500',
};

const TIER_LABELS: Record<AugmentTier, string> = {
  silver: '실버',
  gold: '골드',
  prismatic: '프리즘',
};

function formatDesc(desc: string, effects: Record<string, number>): string {
  let result = desc.replace(/<[^>]*>/g, '');
  for (const [key, val] of Object.entries(effects)) {
    if (val == null) continue;
    result = result.replace(new RegExp(`@${key}@`, 'g'), String(val));
  }
  return result;
}

interface TooltipState {
  aug: RawAugment;
  x: number;
  y: number;
}

export default function AugmentSelector({ augments, onSelect, selectedApiNames }: AugmentSelectorProps) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<AugmentTier | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filtered = augments.filter((aug) => {
    if (search) {
      const s = search.toLowerCase();
      if (!aug.name.toLowerCase().includes(s) && !aug.apiName.toLowerCase().includes(s)) return false;
    }
    if (tierFilter && getAugmentTier(aug) !== tierFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const tierOrder: Record<AugmentTier, number> = { silver: 0, gold: 1, prismatic: 2 };
    return tierOrder[getAugmentTier(a)] - tierOrder[getAugmentTier(b)] || a.name.localeCompare(b.name);
  });

  const handleMouseEnter = (aug: RawAugment, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;
    setTooltip({
      aug,
      x: rect.right - gridRect.left + 8,
      y: rect.top - gridRect.top,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500">능력치에 변동이 있거나 훈련봇을 획득하는 증강만 표시됩니다.</p>
      <SearchBar value={search} onChange={setSearch} placeholder="증강 검색..." />
      <div className="flex gap-1">
        {TIER_FILTERS.map((f) => (
          <button
            key={f.label}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              tierFilter === f.value
                ? (f.value ? TIER_FILTER_COLORS[f.value] + ' text-white' : 'bg-[#8b5cf6] text-white')
                : 'bg-[#1f2937] text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setTierFilter(tierFilter === f.value ? null : f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="relative" ref={gridRef}>
        <div className="grid grid-cols-6 gap-2 max-h-[400px] overflow-y-auto p-1">
          {sorted.map((aug) => {
            const tier = getAugmentTier(aug);
            const isSelected = selectedApiNames.includes(aug.apiName);
            return (
              <button
                key={aug.apiName}
                onClick={() => !isSelected && onSelect(aug)}
                disabled={isSelected}
                onMouseEnter={(e) => handleMouseEnter(aug, e)}
                onMouseLeave={() => setTooltip(null)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'opacity-30 cursor-not-allowed border-gray-700'
                    : `${TIER_BORDER_COLORS[tier]} hover:bg-[#1f2937] cursor-pointer`
                }`}
              >
                <Image
                  src={getAugmentImage(aug.icon)}
                  alt={aug.name}
                  className="w-10 h-10 object-contain rounded"
                  loading="lazy"
                  width={40}
                  height={40}
                  unoptimized
                />
                <span className="text-[9px] text-gray-300 text-center leading-tight line-clamp-2 w-full">
                  {aug.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Hover tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 w-56 bg-[#1a1f2e] border border-gray-600 rounded-lg shadow-xl p-3 pointer-events-none"
            style={{
              left: Math.min(tooltip.x, 280),
              top: Math.max(tooltip.y, 0),
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Image
                src={getAugmentImage(tooltip.aug.icon)}
                alt=""
                className="w-8 h-8 object-contain rounded"
                width={32}
                height={32}
                unoptimized
              />
              <div>
                <div className="text-sm font-bold text-gray-100">{tooltip.aug.name}</div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  getAugmentTier(tooltip.aug) === 'silver' ? 'bg-gray-600 text-gray-200' :
                  getAugmentTier(tooltip.aug) === 'gold' ? 'bg-yellow-700 text-yellow-200' :
                  'bg-fuchsia-700 text-fuchsia-200'
                }`}>
                  {TIER_LABELS[getAugmentTier(tooltip.aug)]}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              {formatDesc(tooltip.aug.desc, tooltip.aug.effects)}
            </p>
          </div>
        )}
      </div>
      {sorted.length === 0 && (
        <div className="text-center text-gray-500 py-8">검색 결과가 없습니다.</div>
      )}
    </div>
  );
}
