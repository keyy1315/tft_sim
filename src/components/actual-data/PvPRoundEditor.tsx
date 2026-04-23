'use client';
import type { PvPRound } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function PvPRoundEditor({ index, round }: { index: number; round: PvPRound }) {
  const updateRoundMeta = useActualDataStore(s => s.updateRoundMeta);
  const updatePvPRound = useActualDataStore(s => s.updatePvPRound);

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
        <label className="flex flex-col">
          <span className="text-sm">영상 종료 (초)</span>
          <input type="number" value={round.videoEndTime ?? ''}
            onChange={e => updateRoundMeta(index, { videoEndTime: e.target.value ? Number(e.target.value) : undefined })}
            className="border p-1 rounded w-24" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded p-2">
          <h3 className="font-semibold mb-2">내 팀</h3>
          <p className="text-sm text-gray-500">TeamEditor는 Task 16에서 추가</p>
        </div>
        <div className="border rounded p-2">
          <h3 className="font-semibold mb-2">상대</h3>
          <p className="text-sm text-gray-500">OpponentPanel은 Task 20에서 추가</p>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <span className="text-sm">승자:</span>
          <select value={round.winner}
            onChange={e => updatePvPRound(index, { winner: e.target.value as 'player' | 'opponent' | 'draw' })}
            className="border p-1 rounded">
            <option value="player">내 팀</option>
            <option value="opponent">상대</option>
            <option value="draw">무승부</option>
          </select>
        </label>
      </div>
    </div>
  );
}
