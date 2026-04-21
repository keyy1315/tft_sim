'use client';

import type { CombatResult, CombatUnit } from '@/types';
import type { MatchReconstructionResult } from '@/types/analysis';
import ChampionCard from '@/components/builder/ChampionCard';

interface MatchResultSummaryProps {
  result: CombatResult;
  reconstruction: MatchReconstructionResult;
  playerName?: string;
  opponentName?: string;
}

function hpPercentColor(pct: number): string {
  if (pct >= 90) return 'bg-green-600/80';
  if (pct >= 60) return 'bg-yellow-600/80';
  return 'bg-orange-600/80';
}

function sumDamage(units: CombatUnit[]): number {
  return units.reduce((s, u) => s + u.totalDamageDealt, 0);
}

export default function MatchResultSummary({
  result, reconstruction, playerName, opponentName,
}: MatchResultSummaryProps) {
  const playerDamage = sumDamage(result.playerUnits);
  const enemyDamage = sumDamage(result.enemyUnits);

  const winner = result.winner;
  const bannerStyle =
    winner === 'player' ? 'bg-blue-600/10 border-blue-600/30 text-blue-300' :
    winner === 'enemy'  ? 'bg-red-600/10 border-red-600/30 text-red-300' :
    'bg-gray-600/10 border-gray-600/30 text-gray-300';
  const winnerLabel =
    winner === 'player' ? 'TEAM A 승리' :
    winner === 'enemy'  ? 'TEAM B 승리' : '무승부';

  const survivors: CombatUnit[] = winner === 'draw'
    ? []
    : (winner === 'player' ? result.playerUnits : result.enemyUnits).filter(u => u.state !== 'dead');
  const survivorTotal = winner === 'player' ? result.playerUnits.length
                      : winner === 'enemy'  ? result.enemyUnits.length : 0;

  const playerStrong = playerDamage >= enemyDamage;

  // reconstruction 은 현재 표시에 사용하지 않지만 향후 상대/플레이어 팀 컨텍스트 확장 여지를 위해 prop 으로 유지.
  void reconstruction;

  return (
    <section className="rounded-lg border bg-gray-800/50 border-gray-700/50 overflow-hidden">
      {/* 배너 */}
      <header className={`p-3 border-b border-gray-700/50 ${bannerStyle}`}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-bold text-base">
            {winnerLabel}
            <span className="ml-2 text-xs text-gray-400 font-normal">
              전투 시간 {result.duration.toFixed(1)}초
            </span>
          </div>
          {(playerName || opponentName) && (
            <div className="text-xs text-gray-400 truncate">
              {playerName ?? '나'} <span className="text-gray-600">vs</span> {opponentName ?? '상대'}
            </div>
          )}
        </div>
      </header>

      {/* 양팀 총 딜량 */}
      <div className="grid grid-cols-2 divide-x divide-gray-700/50 text-sm">
        <div className="p-3">
          <div className="text-[10px] font-bold text-blue-400 mb-1">TEAM A 총 피해량</div>
          <div className={`font-mono ${playerStrong ? 'text-blue-200 font-bold' : 'text-gray-400'}`}>
            {playerDamage.toLocaleString()}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-bold text-red-400 mb-1">TEAM B 총 피해량</div>
          <div className={`font-mono ${!playerStrong ? 'text-red-200 font-bold' : 'text-gray-400'}`}>
            {enemyDamage.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 생존 유닛 */}
      <div className="p-3 border-t border-gray-700/50">
        {winner === 'draw' ? (
          <div className="text-xs text-gray-500">무승부 — 생존 유닛 없음</div>
        ) : (
          <>
            <div className="text-[10px] font-bold text-gray-400 mb-2">
              {winner === 'player' ? 'TEAM A' : 'TEAM B'} 생존 유닛 ({survivors.length} / {survivorTotal})
            </div>
            {survivors.length === 0 ? (
              <div className="text-xs text-gray-500">생존 유닛 없음</div>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {survivors.map(u => {
                  const pct = u.maxHp > 0 ? Math.round((u.currentHp / u.maxHp) * 100) : 0;
                  return (
                    <li key={u.id} className="relative">
                      <ChampionCard
                        champion={u.champion}
                        starLevel={u.starLevel}
                        size={44}
                        showName={false}
                      />
                      <div
                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-white font-bold px-1.5 py-0.5 rounded ${hpPercentColor(pct)}`}
                      >
                        {pct}%
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
