'use client';

import { ActiveTrait } from '@/types';
import { getTraitImage } from '@/data/imageMap';

interface SynergyChipProps {
  team: 'player' | 'enemy';
  teamLabel: string;
  activeTraits: ActiveTrait[];
  onExpand: () => void;
}

/**
 * 모바일 전용 시너지 요약 chip.
 * 활성화된 시너지 아이콘 + 발동 수를 가로로 나열.
 * 탭하면 onExpand() — BottomSheet 의 시너지 탭으로 확장.
 */
export default function SynergyChip({ team, teamLabel, activeTraits, onExpand }: SynergyChipProps) {
  const accentColor = team === 'player' ? 'text-blue-400 border-blue-600/40' : 'text-red-400 border-red-600/40';
  const active = activeTraits.filter(t => t.style > 0);

  return (
    <button
      onClick={onExpand}
      className={`flex-1 min-w-0 flex items-center gap-1 px-2 py-1.5 bg-[#111827] border rounded-lg text-left ${accentColor}`}
    >
      <span className="text-[9px] font-bold truncate max-w-[60px]">{teamLabel}</span>
      <div className="flex items-center gap-0.5 overflow-hidden flex-1">
        {active.length === 0 && <span className="text-[9px] text-gray-600">시너지 없음</span>}
        {active.slice(0, 6).map(t => (
          <div key={t.trait.apiName} className="flex items-center shrink-0">
            <img src={getTraitImage(t.trait.apiName)} alt="" className="w-4 h-4" />
            <span className="text-[9px] ml-0.5">{t.count}</span>
          </div>
        ))}
        {active.length > 6 && <span className="text-[9px] text-gray-500 ml-0.5">+{active.length - 6}</span>}
      </div>
    </button>
  );
}
