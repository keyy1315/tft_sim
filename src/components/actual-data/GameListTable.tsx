'use client';
import Link from 'next/link';
import type { ActualGameSummary } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';

export default function GameListTable({ games }: { games: ActualGameSummary[] }) {
  const deleteGame = useActualDataStore(s => s.deleteGame);

  if (games.length === 0) {
    return <p className="text-gray-400">아직 저장된 게임이 없습니다. &quot;새 게임&quot; 버튼으로 시작하세요.</p>;
  }

  return (
    <table className="w-full text-left text-gray-100">
      <thead className="border-b border-gray-700 text-gray-300">
        <tr>
          <th className="p-2">Game ID</th>
          <th className="p-2">Patch</th>
          <th className="p-2">Placement</th>
          <th className="p-2">Video</th>
          <th className="p-2">Updated</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {games.map(g => (
          <tr key={g.gameId} className="border-b border-gray-700 hover:bg-gray-800">
            <td className="p-2 font-mono">
              <Link href={`/actual-data/${g.gameId}`} className="text-blue-400 underline">
                {g.gameId}
              </Link>
            </td>
            <td className="p-2">{g.patchVersion}</td>
            <td className="p-2">{g.finalPlacement}</td>
            <td className="p-2">{g.videoSource.kind === 'local' ? '📹' : '—'}</td>
            <td className="p-2 text-sm text-gray-400">{new Date(g.updatedAt).toLocaleString()}</td>
            <td className="p-2">
              <button
                onClick={async () => {
                  if (!confirm(`${g.gameId}을(를) 삭제합니까?`)) return;
                  await deleteGame(g.gameId);
                }}
                className="text-red-400 hover:underline text-sm"
              >
                삭제
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
