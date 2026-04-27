'use client';
import { useCompareDiff } from '@/hooks/useCompareDiff';
import RunCompareButton from './RunCompareButton';
import type { RoundDiff } from '@/types/validation';

interface Props {
  gameId: string;
  currentRoundName: string;
}

function RoundSummary({ round }: { round: RoundDiff }) {
  const winnerLine = round.winner.matched
    ? `actual=${round.winner.actual}, sim ${Math.round(round.winner.simPlayerWinRate * 100)}% ✅`
    : `actual=${round.winner.actual}, sim ${Math.round(round.winner.simPlayerWinRate * 100)}% ❌`;
  const dmgAvg = round.playerDamage.length === 0
    ? '— 데미지 기록 없음'
    : `평균 오차 ${((round.playerDamage.reduce((a, b) => a + b.diffPct, 0) / round.playerDamage.length) * 100).toFixed(0)}%`;
  const survLine = (() => {
    if (!round.survivors) return '— (데이터 없음)';
    const total = round.survivors.length;
    const matched = round.survivors.filter(s => !s.aliveMismatch).length;
    return `${matched}/${total} 일치`;
  })();
  return (
    <div className="space-y-1">
      <div><span className="text-gray-400">Winner:</span> {winnerLine}{round.winner.weakSignal && ' ⚠️ 엣지케이스'}</div>
      <div><span className="text-gray-400">내 딜량:</span> {dmgAvg}</div>
      <div><span className="text-gray-400">상대 딜량:</span> {round.opponentDamage ? `오차 평균 ${((round.opponentDamage.reduce((a, b) => a + b.diffPct, 0) / round.opponentDamage.length) * 100).toFixed(0)}%` : '— (데이터 없음)'}</div>
      <div><span className="text-gray-400">생존:</span> {survLine}</div>
      {round.warnings.length > 0 && (
        <div className="text-yellow-400">⚠️ {round.warnings.join(' · ')}</div>
      )}
    </div>
  );
}

export default function RoundDiffInlineCard({ gameId, currentRoundName }: Props) {
  const { state, run } = useCompareDiff(gameId);

  return (
    <div className="border border-gray-700 rounded p-3 mt-3 bg-gray-900/50 text-xs text-gray-200">
      <div className="font-semibold text-sm mb-2">🧪 시뮬 비교</div>
      {state.kind === 'initial' || state.kind === 'loading' ? (
        <div className="text-gray-400">{state.kind === 'loading' ? '로딩 중...' : ''}</div>
      ) : state.kind === 'missing' ? (
        <div className="space-y-2">
          <div>이 게임은 아직 시뮬 비교를 돌리지 않았습니다.</div>
          <RunCompareButton onClick={() => run()} loading={false}>▶ 비교 실행 (예상 ~30초)</RunCompareButton>
          <a className="ml-2 text-blue-400 underline" href={`/actual-data/${gameId}/compare`}>전체 보기 →</a>
        </div>
      ) : state.kind === 'error' ? (
        <div className="text-red-400">에러: {state.message}</div>
      ) : (
        <>
          {state.stale && (
            <div className="text-yellow-400 mb-2">
              ⚠️ 데이터 변경됨 — <button type="button" onClick={() => run()} className="underline">▶ 다시 실행</button>
            </div>
          )}
          {(() => {
            const round = state.diff.rounds.find(r => r.roundName === currentRoundName);
            return round
              ? <RoundSummary round={round} />
              : <div className="text-gray-400">이 라운드는 캐시에 포함되지 않았습니다 — 재실행 필요</div>;
          })()}
          <div className="mt-2">
            <a className="text-blue-400 underline" href={`/actual-data/${gameId}/compare`}>전체 보기 →</a>
          </div>
        </>
      )}
    </div>
  );
}
