'use client';

import { ActiveTrait, TRAIT_STYLE_COLORS, RawItem } from '@/types';
import TraitEffectDetail from './TraitEffectDetail';

interface SynergyPanelProps {
  activeTraits: ActiveTrait[];
  team: 'player' | 'enemy';
  items: RawItem[];
}

export default function SynergyPanel({ activeTraits, team, items }: SynergyPanelProps) {
  const teamLabel = team === 'player' ? 'TEAM A' : 'TEAM B';
  const teamColor = team === 'player' ? 'text-blue-400' : 'text-red-400';

  if (activeTraits.length === 0) {
    return (
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
        <div className={`text-xs font-bold ${teamColor} mb-2`}>{teamLabel} 시너지</div>
        <div className="text-xs text-gray-500">챔피언을 배치하면 시너지가 표시됩니다.</div>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
      <div className={`text-xs font-bold ${teamColor} mb-2`}>{teamLabel} 시너지</div>
      <div className="space-y-1">
        {activeTraits.map((at) => {
          const color = TRAIT_STYLE_COLORS[at.style] || TRAIT_STYLE_COLORS[0];
          const isActive = at.style > 0;
          const nextTier = at.trait.effects.find(e => e.minUnits > at.count);
          const label = nextTier ? `${at.count}/${nextTier.minUnits}` : `${at.count}`;

          return (
            <div key={at.trait.apiName}>
              <div className={`flex items-center gap-2 px-2 py-1 rounded ${isActive ? 'bg-[#1f2937]' : 'bg-[#111827] opacity-60'}`}>
                <div
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: `${color}30`, color }}
                >
                  {at.count}
                </div>
                <span className={`text-xs flex-1 truncate ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
                  {at.trait.name}
                </span>
                <span className="text-[10px] shrink-0" style={{ color }}>
                  {label}
                </span>
              </div>
              {isActive && <TraitEffectDetail activeTrait={at} items={items} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
