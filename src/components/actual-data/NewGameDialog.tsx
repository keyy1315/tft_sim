'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActualDataStore } from '@/store/actualDataSlice';
import type { ShrineName } from '@/lib/actualData/types';

const SHRINES: ShrineName[] = ['ahri', 'aurelionSol', 'ekko', 'evelynn', 'kayle', 'soraka', 'thresh', 'varus', 'yasuo'];

export default function NewGameDialog({ onClose }: { onClose: () => void }) {
  const [patchVersion, setPatchVersion] = useState('17.1');
  const [playerRiotId, setPlayerRiotId] = useState('');
  const [shrine1, setShrine1] = useState<ShrineName>('yasuo');
  const [shrine2, setShrine2] = useState<ShrineName>('ekko');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const createGame = useActualDataStore(s => s.createGame);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (shrine1 === shrine2) {
      setError('두 신은 서로 달라야 합니다');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const gameId = await createGame({
        patchVersion,
        playerRiotId,
        shrinesInPlay: [shrine1, shrine2],
      });
      router.push(`/actual-data/${gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 text-gray-100 p-6 rounded shadow-lg w-96 space-y-3">
        <h2 className="text-lg font-bold">새 게임 만들기</h2>

        <label className="block">
          <span className="text-sm text-gray-300">Patch Version</span>
          <input
            value={patchVersion}
            onChange={e => setPatchVersion(e.target.value)}
            className="w-full border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-300">Player Riot ID (name#TAG)</span>
          <input
            value={playerRiotId}
            onChange={e => setPlayerRiotId(e.target.value)}
            className="w-full border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
            pattern=".{2,16}#[A-Za-z0-9]{2,5}"
            required
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-sm text-gray-300">신 1</span>
            <select
              value={shrine1}
              onChange={e => setShrine1(e.target.value as ShrineName)}
              className="w-full border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
            >
              {SHRINES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-sm text-gray-300">신 2</span>
            <select
              value={shrine2}
              onChange={e => setShrine2(e.target.value as ShrineName)}
              className="w-full border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded"
            >
              {SHRINES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1 border border-gray-700 text-gray-200 hover:bg-gray-700 rounded">
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {submitting ? '생성 중...' : '만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
