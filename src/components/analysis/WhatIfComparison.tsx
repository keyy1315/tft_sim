'use client';

import type { WhatIfComparisonResult } from '@/types/analysis';

interface WhatIfComparisonProps {
  result: WhatIfComparisonResult;
}

function formatDelta(value: number, unit: string = ''): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value * 10) / 10}${unit}`;
}

export default function WhatIfComparison({ result }: WhatIfComparisonProps) {
  const { original, modified, delta } = result;
  const origDuration = Math.round(original.duration * 10) / 10;
  const modDuration = Math.round(modified.duration * 10) / 10;

  return (
    <div className="p-3 rounded bg-gray-800/50 border border-gray-700/50 text-sm space-y-3">
      <div className="font-medium text-gray-200">비교 결과</div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-gray-500"></div>
        <div className="text-gray-400 text-center">원본</div>
        <div className="text-gray-400 text-center">수정본</div>
        <div className="text-gray-400 text-center">변화</div>

        {/* 승패 */}
        <div className="text-gray-400">결과</div>
        <div className={`text-center ${original.winner === 'player' ? 'text-blue-400' : 'text-red-400'}`}>
          {original.winner === 'player' ? '승리' : original.winner === 'enemy' ? '패배' : '무승부'}
        </div>
        <div className={`text-center ${modified.winner === 'player' ? 'text-blue-400' : 'text-red-400'}`}>
          {modified.winner === 'player' ? '승리' : modified.winner === 'enemy' ? '패배' : '무승부'}
        </div>
        <div className={`text-center font-bold ${delta.winnerChanged ? 'text-green-400' : 'text-gray-500'}`}>
          {delta.winnerChanged ? '승패 역전' : '-'}
        </div>

        {/* 전투 시간 */}
        <div className="text-gray-400">전투 시간</div>
        <div className="text-center text-gray-300">{origDuration}초</div>
        <div className="text-center text-gray-300">{modDuration}초</div>
        <div className="text-center text-gray-400">{formatDelta(delta.durationDelta, '초')}</div>
      </div>

      {/* 유닛별 변화 */}
      {delta.unitDeltas.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-gray-700/30">
          <div className="text-xs text-gray-500 mb-1">유닛별 변화</div>
          {delta.unitDeltas.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-gray-300 w-20 truncate">{u.championName}</span>
              <span className={`${u.dpsDelta > 0 ? 'text-green-400' : u.dpsDelta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                DPS {formatDelta(u.dpsDelta)}
              </span>
              <span className={`${u.survivalDelta > 0 ? 'text-green-400' : u.survivalDelta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                생존 {formatDelta(u.survivalDelta / 30, '초')}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500 pt-1 border-t border-gray-700/30">
        배치와 아이템만 반영한 추정치입니다. 증강/특수 시너지 옵션은 반영되지 않았습니다.
      </div>
    </div>
  );
}
