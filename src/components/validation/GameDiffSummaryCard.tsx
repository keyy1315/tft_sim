'use client';
import type { GameDiff } from '@/types/validation';
import RunCompareButton from './RunCompareButton';

interface Props {
  diff: GameDiff;
  stale: boolean;
  onRerun: () => void;
  loading: boolean;
}

export default function GameDiffSummaryCard({ diff, stale, onRerun, loading }: Props) {
  const { summary } = diff;
  const nonWeak = summary.pvpRoundCount - summary.weakSignalRoundCount;
  const matchedNonWeak = diff.rounds.filter(r => !r.winner.weakSignal && r.winner.matched).length;
  return (
    <div className="border border-gray-700 rounded p-4 bg-gray-900/50 text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">요약</h2>
        <RunCompareButton onClick={onRerun} loading={loading}>🔄 다시 실행</RunCompareButton>
      </div>
      {stale && <div className="text-yellow-400 mb-2 text-sm">⚠️ 게임이 수정된 후입니다 — 재실행 권장</div>}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-400">Winner 적중률</dt>
        <dd>{Math.round(summary.winnerMatchRate * 100)}% ({diff.rounds.filter(r => r.winner.matched).length}/{summary.pvpRoundCount})</dd>
        <dt className="text-gray-400">엣지케이스 제외</dt>
        <dd>{nonWeak === 0 ? '—' : `${Math.round((matchedNonWeak / nonWeak) * 100)}% (${matchedNonWeak}/${nonWeak})`}</dd>
        <dt className="text-gray-400">내 딜량 평균 오차</dt>
        <dd>{(summary.avgPlayerDamageErrorPct * 100).toFixed(1)}%</dd>
        <dt className="text-gray-400">Survivor HP 평균 오차</dt>
        <dd>{summary.avgSurvivorHpErrorPts.toFixed(1)} pt</dd>
        <dt className="text-gray-400">N / seedBase</dt>
        <dd>{diff.nRuns} / {diff.seedBase}</dd>
        <dt className="text-gray-400">Engine SHA</dt>
        <dd className="font-mono text-xs">{diff.engineSha?.slice(0, 7) ?? '—'}</dd>
        <dt className="text-gray-400">실행 시각</dt>
        <dd className="text-xs">{new Date(diff.computedAt).toLocaleString('ko-KR')}</dd>
      </dl>
    </div>
  );
}
