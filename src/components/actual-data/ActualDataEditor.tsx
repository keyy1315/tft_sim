'use client';
import { useEffect } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';
import RoundList from './RoundList';

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
          <div>
            <h2 className="font-bold text-lg">
              {currentRound.roundName} ({currentRound.type})
            </h2>
            <p className="text-gray-500 text-sm">
              편집 UI는 다음 태스크에서 추가됩니다.
            </p>
          </div>
        ) : (
          <p className="text-gray-500">좌측에서 라운드를 선택하거나 &quot;+ PvP&quot;/&quot;+ Shrine&quot;으로 추가하세요.</p>
        )}
      </main>
    </div>
  );
}
