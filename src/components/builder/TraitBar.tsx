'use client';

import { ActiveTrait, TRAIT_STYLE_COLORS } from '@/types';

interface TraitBarProps {
  activeTraits: ActiveTrait[];
}

export default function TraitBar({ activeTraits }: TraitBarProps) {
  if (activeTraits.length === 0) {
    return <div className="text-sm text-gray-500 py-2">챔피언을 배치하면 시너지가 표시됩니다.</div>;
  }

  return (
    <div className="space-y-1.5">
      {activeTraits.map((at) => {
        const color = TRAIT_STYLE_COLORS[at.style] || TRAIT_STYLE_COLORS[0];
        const isActive = at.style > 0;
        const nextTier = at.trait.effects.find(e => e.minUnits > at.count);
        const label = nextTier ? `${at.count}/${nextTier.minUnits}` : `${at.count}`;

        return (
          <div
            key={at.trait.apiName}
            className={`flex items-center gap-2 px-2 py-1 rounded ${isActive ? 'bg-[#1f2937]' : 'bg-[#111827] opacity-60'}`}
          >
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: `${color}30`, color }}
            >
              {at.count}
            </div>
            <span className={`text-sm flex-1 ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
              {at.trait.name}
            </span>
            <span className="text-xs" style={{ color }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
