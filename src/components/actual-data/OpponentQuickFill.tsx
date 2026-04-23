'use client';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function OpponentQuickFill({ roundIndex }: { roundIndex: number }) {
  const game = useActualDataStore(s => s.currentGame);
  const copy = useActualDataStore(s => s.copyOpponentFromPreviousMeeting);
  if (!game) return null;

  const seen = new Map<string, number>();
  for (let i = 0; i < roundIndex; i++) {
    const r = game.rounds[i];
    if (r.type === 'pvp' && r.opponent.riotId) {
      seen.set(r.opponent.riotId, i);
    }
  }
  const options = Array.from(seen.keys());

  if (options.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span>이전 만남 복사:</span>
      <select onChange={e => { if (e.target.value) copy(roundIndex, e.target.value); }}
        defaultValue="" className="border p-1 rounded">
        <option value="">선택...</option>
        {options.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
    </label>
  );
}
