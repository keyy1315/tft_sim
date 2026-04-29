'use client';
import { useActualDataStore } from '@/store/actualDataSlice';
import type {
  ShrineName,
  ActualGameData,
  StargazerConstellationId,
} from '@/lib/actualData/types';
import {
  CONSTELLATION_IDS,
  CONSTELLATION_KOREAN_NAME,
} from '@/lib/actualData/stargazerMapping';

const SHRINES: ShrineName[] = [
  'ahri',
  'aurelionSol',
  'ekko',
  'evelynn',
  'kayle',
  'soraka',
  'thresh',
  'varus',
  'yasuo',
];

export default function GameMetaEditor({ onClose }: { onClose: () => void }) {
  const game = useActualDataStore((s) => s.currentGame);
  const updateGameMeta = useActualDataStore((s) => s.updateGameMeta);
  if (!game) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-gray-800 border border-gray-700 text-gray-100 p-6 rounded shadow-lg w-[420px] space-y-3">
        <h2 className="font-bold text-lg">게임 메타 편집</h2>

        <label className="flex flex-col text-sm">
          <span className="text-gray-300">Patch</span>
          <input
            value={game.patchVersion}
            onChange={(e) => updateGameMeta({ patchVersion: e.target.value })}
            className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="text-gray-300">Player Riot ID</span>
          <input
            value={game.playerRiotId}
            onChange={(e) => updateGameMeta({ playerRiotId: e.target.value })}
            className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="text-gray-300">Final Placement (1~8)</span>
          <input
            type="number"
            min={1}
            max={8}
            value={game.finalPlacement}
            onChange={(e) =>
              updateGameMeta({
                finalPlacement: Math.min(
                  8,
                  Math.max(1, Number(e.target.value)),
                ) as ActualGameData['finalPlacement'],
              })
            }
            className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded w-20"
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-xs text-gray-300">신 1</span>
            <select
              value={game.shrinesInPlay[0]}
              onChange={(e) =>
                updateGameMeta({
                  shrinesInPlay: [e.target.value as ShrineName, game.shrinesInPlay[1]],
                })
              }
              className="w-full border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
            >
              {SHRINES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-xs text-gray-300">신 2</span>
            <select
              value={game.shrinesInPlay[1]}
              onChange={(e) =>
                updateGameMeta({
                  shrinesInPlay: [game.shrinesInPlay[0], e.target.value as ShrineName],
                })
              }
              className="w-full border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
            >
              {SHRINES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col text-sm">
          <span className="text-gray-300">별돌보미 별자리</span>
          <select
            value={game.stargazerConstellation ?? ''}
            onChange={(e) =>
              updateGameMeta({
                stargazerConstellation: e.target.value === ''
                  ? undefined
                  : (e.target.value as StargazerConstellationId),
              })
            }
            className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
          >
            <option value="">(미선택)</option>
            {CONSTELLATION_IDS.map((id) => (
              <option key={id} value={id}>
                {CONSTELLATION_KOREAN_NAME[id]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-3 py-1 border border-gray-700 text-gray-200 hover:bg-gray-700 rounded">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
