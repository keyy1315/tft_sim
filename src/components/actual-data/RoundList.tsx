'use client';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function RoundList() {
  const game = useActualDataStore(s => s.currentGame);
  const currentIndex = useActualDataStore(s => s.currentRoundIndex);
  const setCurrentRound = useActualDataStore(s => s.setCurrentRound);
  const addPvPRound = useActualDataStore(s => s.addPvPRound);
  const addShrineRound = useActualDataStore(s => s.addShrineRound);

  if (!game) return null;

  function suggestNextRoundName(type: 'pvp' | 'shrine'): string {
    if (!game) return type === 'shrine' ? '2-4' : '2-2';
    const last = game.rounds[game.rounds.length - 1];
    if (!last) return type === 'shrine' ? '2-4' : '2-2';
    const [s, r] = last.roundName.split('-').map(Number);
    if (type === 'shrine') {
      if (r < 4) return `${s}-4`;
      return `${s + 1}-4`;
    }
    if (r === 1 || r === 2) return `${s}-${r + 1}`;
    if (r === 3) return `${s}-5`;
    if (r === 5) return `${s}-6`;
    return `${s + 1}-2`;
  }

  return (
    <div className="flex flex-col border-r border-gray-700 w-48 text-gray-100 min-h-0">
      <ul className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {game.rounds.map((r, i) => (
          <li key={i}>
            <button onClick={() => setCurrentRound(i)}
              className={`w-full text-left p-1 rounded ${currentIndex === i ? 'bg-blue-900/50 font-bold' : 'hover:bg-gray-700'}`}>
              {r.roundName} {r.type === 'shrine' ? '◇' : '⚔'}
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-gray-700 p-2 space-y-1 bg-[#0a0e1a]">
        <button onClick={() => addPvPRound(suggestNextRoundName('pvp'))}
          className="w-full text-sm border border-gray-700 rounded p-1 hover:bg-gray-700">+ PvP</button>
        <button onClick={() => addShrineRound(suggestNextRoundName('shrine'))}
          className="w-full text-sm border border-gray-700 rounded p-1 hover:bg-gray-700">+ Shrine</button>
      </div>
    </div>
  );
}
