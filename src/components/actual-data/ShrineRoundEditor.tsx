'use client';
import type { ShrineRound, ShrineName } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function ShrineRoundEditor({ index, round }: { index: number; round: ShrineRound }) {
  const updateShrineRound = useActualDataStore(s => s.updateShrineRound);
  const updateRoundMeta = useActualDataStore(s => s.updateRoundMeta);
  const game = useActualDataStore(s => s.currentGame);

  if (!game) return null;
  const shrinesInPlay = game.shrinesInPlay;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <label className="flex flex-col">
          <span className="text-sm">라운드명</span>
          <input value={round.roundName}
            onChange={e => updateRoundMeta(index, { roundName: e.target.value })}
            className="border p-1 rounded w-20" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">영상 시작 (초)</span>
          <input type="number" value={round.videoStartTime}
            onChange={e => updateRoundMeta(index, { videoStartTime: Number(e.target.value) })}
            className="border p-1 rounded w-24" />
        </label>
      </div>

      <label className="flex flex-col">
        <span className="text-sm">선택한 신</span>
        <select value={round.playerChosenShrine}
          onChange={e => updateShrineRound(index, { playerChosenShrine: e.target.value as ShrineName })}
          className="border p-1 rounded w-40">
          {shrinesInPlay.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      {round.playerChosenShrine === 'yasuo' && (
        <p className="text-sm text-gray-500">
          YasuoTilePicker는 Task 18에서 추가.
        </p>
      )}
    </div>
  );
}
