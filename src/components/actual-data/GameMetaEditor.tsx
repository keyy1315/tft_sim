'use client';
import { useActualDataStore } from '@/store/actualDataSlice';
import type { ShrineName, ActualGameData } from '@/lib/actualData/types';

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
      <div className="bg-white p-6 rounded shadow-lg w-[420px] space-y-3">
        <h2 className="font-bold text-lg">게임 메타 편집</h2>

        <label className="flex flex-col text-sm">
          <span>Patch</span>
          <input
            value={game.patchVersion}
            onChange={(e) => updateGameMeta({ patchVersion: e.target.value })}
            className="border p-1 rounded"
          />
        </label>

        <label className="flex flex-col text-sm">
          <span>Player Riot ID</span>
          <input
            value={game.playerRiotId}
            onChange={(e) => updateGameMeta({ playerRiotId: e.target.value })}
            className="border p-1 rounded"
          />
        </label>

        <label className="flex flex-col text-sm">
          <span>Final Placement (1~8)</span>
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
            className="border p-1 rounded w-20"
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-xs">신 1</span>
            <select
              value={game.shrinesInPlay[0]}
              onChange={(e) =>
                updateGameMeta({
                  shrinesInPlay: [e.target.value as ShrineName, game.shrinesInPlay[1]],
                })
              }
              className="w-full border p-1 rounded"
            >
              {SHRINES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-xs">신 2</span>
            <select
              value={game.shrinesInPlay[1]}
              onChange={(e) =>
                updateGameMeta({
                  shrinesInPlay: [game.shrinesInPlay[0], e.target.value as ShrineName],
                })
              }
              className="w-full border p-1 rounded"
            >
              {SHRINES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-3 py-1 border rounded">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
