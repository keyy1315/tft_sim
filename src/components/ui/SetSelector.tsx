'use client';

import { AVAILABLE_SETS, SET_CONFIGS } from '@/data/setConfig';
import type { SetId } from '@/data/setConfig';

interface SetSelectorProps {
  activeSet: SetId;
  onSetChange: (setId: SetId) => void;
}

export default function SetSelector({ activeSet, onSetChange }: SetSelectorProps) {
  return (
    <div className="flex gap-0.5 bg-[#111827] rounded-lg p-0.5">
      {AVAILABLE_SETS.map(setId => {
        const cfg = SET_CONFIGS[setId];
        const isActive = activeSet === setId;
        return (
          <button
            key={setId}
            onClick={() => onSetChange(setId)}
            className={`px-2 py-0.5 rounded text-[11px] lg:text-xs font-medium transition-colors ${
              isActive
                ? 'bg-yellow-600 text-black'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {cfg.label}
            {cfg.status === 'pbe' && (
              <span className="ml-1 text-[9px] opacity-60">PBE</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
