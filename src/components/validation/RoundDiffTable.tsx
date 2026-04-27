'use client';
import type { RoundDiff } from '@/types/validation';

interface Props {
  rounds: RoundDiff[];
  selectedRoundName: string | null;
  onSelect: (roundName: string) => void;
}

function avgDamagePct(round: RoundDiff): number {
  if (round.playerDamage.length === 0) return 0;
  return round.playerDamage.reduce((a, b) => a + b.diffPct, 0) / round.playerDamage.length;
}

function survSummary(round: RoundDiff): string {
  if (!round.survivors) return '—';
  const mismatches = round.survivors.filter(s => s.aliveMismatch).length;
  return mismatches === 0 ? '✅ all' : `❌ ${mismatches}/${round.survivors.length}`;
}

export default function RoundDiffTable({ rounds, selectedRoundName, onSelect }: Props) {
  return (
    <table className="w-full text-sm text-gray-100">
      <thead className="text-gray-400 text-xs">
        <tr>
          <th className="text-left py-1">라운드</th>
          <th className="text-left py-1">actual</th>
          <th className="text-right py-1">sim winrate</th>
          <th className="text-center py-1">일치</th>
          <th className="text-right py-1">내 딜 오차</th>
          <th className="text-center py-1">생존 오차</th>
        </tr>
      </thead>
      <tbody>
        {rounds.map(r => {
          const isSelected = r.roundName === selectedRoundName;
          return (
            <tr
              key={r.roundName}
              className={`cursor-pointer hover:bg-gray-800 ${isSelected ? 'bg-gray-800' : ''}`}
              onClick={() => onSelect(r.roundName)}
            >
              <td className="py-1">{r.roundName}</td>
              <td className="py-1">{r.winner.actual}</td>
              <td className="py-1 text-right">{Math.round(r.winner.simPlayerWinRate * 100)}%{r.winner.weakSignal && ' ⚠️'}</td>
              <td className="py-1 text-center">{r.winner.matched ? '✅' : '❌'}</td>
              <td className="py-1 text-right">{(avgDamagePct(r) * 100).toFixed(0)}%</td>
              <td className="py-1 text-center">{survSummary(r)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
