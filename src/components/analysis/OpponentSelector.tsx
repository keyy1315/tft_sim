'use client';

import type { ParsedParticipant } from '@/lib/riot';

interface OpponentSelectorProps {
  participants: ParsedParticipant[];
  selected: ParsedParticipant | null;
  playerPuuid: string;
  onSelect: (opponent: ParsedParticipant) => void;
}

export default function OpponentSelector({ participants, selected, playerPuuid, onSelect }: OpponentSelectorProps) {
  const sorted = [...participants]
    .filter(p => p.puuid !== playerPuuid)
    .sort((a, b) => a.placement - b.placement);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400 shrink-0">상대 선택:</span>
      <div className="flex gap-1 flex-wrap">
        {sorted.map(p => (
          <button
            key={p.puuid}
            onClick={() => onSelect(p)}
            className={`px-2 py-1 rounded text-xs border transition-colors ${
              selected?.puuid === p.puuid
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:border-gray-500'
            }`}
          >
            {p.placement}등
            {p.gameName && <span className="ml-1 text-gray-500">{p.gameName}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
