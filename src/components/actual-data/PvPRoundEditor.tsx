'use client';
import type { PvPRound } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';
import TeamEditor from './TeamEditor';
import OpponentPanel from './OpponentPanel';
import DamageChartInput from './DamageChartInput';

export default function PvPRoundEditor({ index, round }: { index: number; round: PvPRound }) {
  const updateRoundMeta = useActualDataStore(s => s.updateRoundMeta);
  const updatePvPRound = useActualDataStore(s => s.updatePvPRound);
  const updatePlayerTeam = useActualDataStore(s => s.updatePlayerTeam);
  const updateOpponent = useActualDataStore(s => s.updateOpponent);

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
        <TeamEditor label="내 팀" team={round.playerTeam}
          onChange={t => updatePlayerTeam(index, t)}
          showGrace={{ roundIndex: index }} />
        <OpponentPanel index={index} opponent={round.opponent}
          onChange={o => updateOpponent(index, o)} />
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

      <DamageChartInput
        entries={round.unitDamageChart ?? []}
        onChange={entries => updatePvPRound(index, { unitDamageChart: entries })}
      />
    </div>
  );
}
