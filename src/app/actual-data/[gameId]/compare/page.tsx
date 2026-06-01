'use client';
import { useState, use } from 'react';
import Link from 'next/link';
import { useCompareDiff } from '@/hooks/useCompareDiff';
import GameDiffSummaryCard from '@/components/validation/GameDiffSummaryCard';
import RoundDiffTable from '@/components/validation/RoundDiffTable';
import RoundDiffDetailPanel from '@/components/validation/RoundDiffDetailPanel';
import RunCompareButton from '@/components/validation/RunCompareButton';
import AdminGuard from '@/components/AdminGuard';

export default function ComparePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  return (
    <AdminGuard>
      <CompareContent gameId={gameId} />
    </AdminGuard>
  );
}

function CompareContent({ gameId }: { gameId: string }) {
  const { state, run } = useCompareDiff(gameId);
  const [selectedRoundName, setSelectedRoundName] = useState<string | null>(null);

  const selectedRound = state.kind === 'ready'
    ? state.diff.rounds.find(r => r.roundName === selectedRoundName) ?? state.diff.rounds[0] ?? null
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto text-gray-100">
      <div className="flex items-center mb-4">
        <Link href={`/actual-data/${gameId}`} className="text-blue-400 underline text-sm">← 편집으로 돌아가기</Link>
        <div className="ml-4 text-sm text-gray-400">Game: {gameId}</div>
      </div>

      {state.kind === 'initial' || state.kind === 'loading' ? (
        <div className="text-gray-400">로딩 중...</div>
      ) : state.kind === 'missing' ? (
        <div className="border border-gray-700 rounded p-6 bg-gray-900/50 text-center">
          <p className="mb-3">이 게임은 아직 시뮬 비교를 돌리지 않았습니다.</p>
          <RunCompareButton onClick={() => run()} loading={false}>▶ 비교 실행 (예상 ~30초)</RunCompareButton>
        </div>
      ) : state.kind === 'error' ? (
        <div className="text-red-400">에러: {state.message}</div>
      ) : (
        <div className="space-y-4">
          <GameDiffSummaryCard
            diff={state.diff}
            stale={state.stale}
            onRerun={() => run()}
            loading={false}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-gray-700 rounded p-4 bg-gray-900/50">
              <RoundDiffTable
                rounds={state.diff.rounds}
                selectedRoundName={selectedRound?.roundName ?? null}
                onSelect={setSelectedRoundName}
              />
            </div>
            {selectedRound && <RoundDiffDetailPanel round={selectedRound} />}
          </div>
        </div>
      )}
    </div>
  );
}
