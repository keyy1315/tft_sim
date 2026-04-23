'use client';
import { useEffect } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';
import RoundList from './RoundList';
import RoundEditor from './RoundEditor';

export default function ActualDataEditor({ gameId }: { gameId: string }) {
  const game = useActualDataStore(s => s.currentGame);
  const loadGame = useActualDataStore(s => s.loadGame);
  const currentRoundIndex = useActualDataStore(s => s.currentRoundIndex);

  useEffect(() => {
    loadGame(gameId).catch(console.error);
  }, [gameId, loadGame]);

  if (!game) return <div className="p-4">Loading...</div>;

  const currentRound = currentRoundIndex !== null ? game.rounds[currentRoundIndex] : null;

  return (
    <div className="flex h-screen">
      <RoundList />
      <main className="flex-1 p-4">
        {currentRound ? (
          <RoundEditor />
        ) : (
          <p className="text-gray-500">좌측에서 라운드를 선택하거나 &quot;+ PvP&quot;/&quot;+ Shrine&quot;으로 추가하세요.</p>
        )}
      </main>
    </div>
  );
}
