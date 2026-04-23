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
    <div className="border-r p-2 w-48">
      <ul className="space-y-1">
        {game.rounds.map((r, i) => (
          <li key={i}>
            <button onClick={() => setCurrentRound(i)}
              className={`w-full text-left p-1 rounded ${currentIndex === i ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`}>
              {r.roundName} {r.type === 'shrine' ? '◇' : '⚔'}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-1">
        <button onClick={() => addPvPRound(suggestNextRoundName('pvp'))}
          className="w-full text-sm border rounded p-1 hover:bg-gray-50">+ PvP</button>
        <button onClick={() => addShrineRound(suggestNextRoundName('shrine'))}
          className="w-full text-sm border rounded p-1 hover:bg-gray-50">+ Shrine</button>
      </div>
    </div>
  );
}
