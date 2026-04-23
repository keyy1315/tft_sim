'use client';
import type { ShrineRound, ShrineName } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';
import YasuoTilePicker from './YasuoTilePicker';
import VideoTimeInput from './VideoTimeInput';

export default function ShrineRoundEditor({ index, round }: { index: number; round: ShrineRound }) {
  const updateShrineRound = useActualDataStore(s => s.updateShrineRound);
  const updateRoundMeta = useActualDataStore(s => s.updateRoundMeta);
  const game = useActualDataStore(s => s.currentGame);

  if (!game) return null;
  const shrinesInPlay = game.shrinesInPlay;

  return (
    <div className="space-y-4 text-gray-100">
      <div className="flex gap-2 items-end">
        <label className="flex flex-col">
          <span className="text-sm text-gray-300">라운드명</span>
          <input value={round.roundName}
            onChange={e => updateRoundMeta(index, { roundName: e.target.value })}
            className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded w-20" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm text-gray-300">영상 시작 (mm:ss)</span>
          <VideoTimeInput
            value={round.videoStartTime}
            onChange={v => updateRoundMeta(index, { videoStartTime: v ?? 0 })}
            className="w-24"
          />
        </label>
      </div>

      <label className="flex flex-col">
        <span className="text-sm text-gray-300">선택한 신</span>
        <select value={round.playerChosenShrine ?? ''}
          onChange={e => {
            const v = e.target.value;
            updateShrineRound(index, { playerChosenShrine: v === '' ? undefined : (v as ShrineName) });
          }}
          className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded w-40">
          <option value="">선택...</option>
          {shrinesInPlay.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      {round.playerChosenShrine && !shrinesInPlay.includes(round.playerChosenShrine) && (
        <p className="text-xs text-amber-400">
          ⚠ 현재 shrinesInPlay({shrinesInPlay.join(', ')})에 없는 신 (&quot;{round.playerChosenShrine}&quot;) 선택됨.
          메타데이터를 수정했다면 드롭다운에서 다시 선택해주세요.
        </p>
      )}

      {round.playerChosenShrine === 'yasuo' && (
        <div>
          <span className="text-sm block mb-1 text-gray-300">야스오 칸 설치</span>
          <YasuoTilePicker
            stage={Number(round.roundName.split('-')[0]) as 2 | 3 | 4}
            value={round.playerYasuoTile}
            onChange={tile => updateShrineRound(index, { playerYasuoTile: tile })}
          />
        </div>
      )}
    </div>
  );
}
