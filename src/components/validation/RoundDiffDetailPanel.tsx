'use client';
import type { RoundDiff } from '@/types/validation';

interface Props {
  round: RoundDiff;
}

function formatDiffPct(p: number | null): string {
  if (p === null) return '—';
  return `${(p * 100).toFixed(0)}%`;
}

function diffPctColorClass(p: number | null): string {
  if (p === null) return 'text-gray-500';
  if (p < -0.1) return 'text-red-400';
  if (p > 0.1) return 'text-green-400';
  return '';
}

export default function RoundDiffDetailPanel({ round }: Props) {
  return (
    <div className="border border-gray-700 rounded p-4 bg-gray-900/50 text-gray-100 text-sm space-y-3">
      <div className="font-semibold">라운드 {round.roundName} 상세</div>

      <div>
        <span className="text-gray-400">Winner:</span> actual={round.winner.actual}, sim player승 {Math.round(round.winner.simPlayerWinRate * 100)}%{round.winner.weakSignal && ' (엣지케이스)'} {round.winner.matched ? '✅' : '❌'}
      </div>

      {round.playerDamage.length > 0 && (
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-1">내 팀 딜량</div>
          <table className="w-full text-xs">
            <thead className="text-gray-500"><tr><th className="text-left">Champ</th><th className="text-right">actual</th><th className="text-right">sim mean (range)</th><th className="text-right">diff</th></tr></thead>
            <tbody>
              {round.playerDamage.map((d, i) => (
                <tr key={i}>
                  <td>{d.championId.replace(/^TFT\d+_/, '')} ({d.hex.q},{d.hex.r})</td>
                  <td className="text-right">{Math.round(d.actual)}</td>
                  <td className="text-right">{Math.round(d.simMean)} ({Math.round(d.simRange[0])}-{Math.round(d.simRange[1])})</td>
                  <td className={`text-right ${diffPctColorClass(d.diffPct)}`} title={d.diffPct === null ? 'actual=0 — 비율 정의 불가' : undefined}>{formatDiffPct(d.diffPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {round.opponentDamage && round.opponentDamage.length > 0 && (
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-1">상대 팀 딜량</div>
          <table className="w-full text-xs">
            <thead className="text-gray-500"><tr><th className="text-left">Champ</th><th className="text-right">actual</th><th className="text-right">sim mean</th><th className="text-right">diff</th></tr></thead>
            <tbody>
              {round.opponentDamage.map((d, i) => (
                <tr key={i}>
                  <td>{d.championId.replace(/^TFT\d+_/, '')} ({d.hex.q},{d.hex.r})</td>
                  <td className="text-right">{Math.round(d.actual)}</td>
                  <td className="text-right">{Math.round(d.simMean)}</td>
                  <td className={`text-right ${diffPctColorClass(d.diffPct)}`} title={d.diffPct === null ? 'actual=0 — 비율 정의 불가' : undefined}>{formatDiffPct(d.diffPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {round.survivors && round.survivors.length > 0 && (
        <div>
          <div className="font-semibold text-xs text-gray-400 mb-1">생존 상태</div>
          <table className="w-full text-xs">
            <thead className="text-gray-500"><tr><th className="text-left">Team/Champ</th><th className="text-right">actual</th><th className="text-right">sim</th><th className="text-right">HP diff</th></tr></thead>
            <tbody>
              {round.survivors.map((s, i) => (
                <tr key={i}>
                  <td>[{s.team === 'player' ? '내' : '상대'}] {s.championId.replace(/^TFT\d+_/, '')}</td>
                  <td className="text-right">{s.actualAlive ? `HP ${s.actualHp}%` : '사망'}</td>
                  <td className="text-right">{(s.simAliveRate * 100).toFixed(0)}% alive, HP {s.simMeanHp.toFixed(0)}%</td>
                  <td className={`text-right ${Math.abs(s.hpDiffPoints) > 20 ? 'text-red-400' : ''}`}>{s.aliveMismatch ? '❌ alive mismatch' : `${s.hpDiffPoints > 0 ? '+' : ''}${s.hpDiffPoints.toFixed(0)} pt`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {round.warnings.length > 0 && (
        <div className="text-yellow-400">
          <div className="font-semibold text-xs mb-1">⚠️ 경고</div>
          <ul className="text-xs list-disc list-inside">
            {round.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
