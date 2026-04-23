'use client';
import { useEffect, useState } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';
import RoundList from './RoundList';
import RoundEditor from './RoundEditor';
import GameMetaEditor from './GameMetaEditor';
import SaveStatusBar from './SaveStatusBar';

export default function ActualDataEditor({ gameId }: { gameId: string }) {
  const game = useActualDataStore(s => s.currentGame);
  const loadGame = useActualDataStore(s => s.loadGame);
  const currentRoundIndex = useActualDataStore(s => s.currentRoundIndex);
  const [metaOpen, setMetaOpen] = useState(false);

  useEffect(() => {
    loadGame(gameId).catch(console.error);
  }, [gameId, loadGame]);

  if (!game) return <div className="p-4 text-gray-300">Loading...</div>;

  const currentRound = currentRoundIndex !== null ? game.rounds[currentRoundIndex] : null;

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-gray-100">
      <header className="border-b border-gray-700 p-2 flex justify-between items-center">
        <h1 className="font-bold">{game.gameId}</h1>
        <div className="flex items-center gap-3">
          <SaveStatusBar />
          <button
            onClick={() => setMetaOpen(true)}
            className="px-2 py-1 border border-gray-700 text-gray-200 hover:bg-gray-700 rounded text-sm"
          >
            게임 메타 편집
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <RoundList />
        <main className="flex-1 p-4 overflow-auto">
          {currentRound ? (
            <RoundEditor />
          ) : (
            <p className="text-gray-400">좌측에서 라운드를 선택하거나 &quot;+ PvP&quot;/&quot;+ Shrine&quot;으로 추가하세요.</p>
          )}
        </main>
      </div>
      {metaOpen && <GameMetaEditor onClose={() => setMetaOpen(false)} />}
    </div>
  );
}
