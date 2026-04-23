'use client';
import { useEffect, useState } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';
import GameListTable from '@/components/actual-data/GameListTable';
import NewGameDialog from '@/components/actual-data/NewGameDialog';

export default function ActualDataListPage() {
  const games = useActualDataStore(s => s.gameListCache);
  const refresh = useActualDataStore(s => s.refreshGameList);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Actual Data</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded"
        >
          + 새 게임
        </button>
      </div>

      <GameListTable games={games ?? []} />

      {dialogOpen && <NewGameDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
