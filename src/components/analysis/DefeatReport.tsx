'use client';

import type { DefeatReportResult } from '@/types/analysis';
import ConfidenceBadge from '@/components/analysis/ConfidenceBadge';

interface DefeatReportProps {
  result: DefeatReportResult;
}

const SEVERITY_STYLE = {
  critical: { icon: '●', color: 'text-red-400' },
  major: { icon: '▲', color: 'text-amber-400' },
  minor: { icon: '○', color: 'text-blue-400' },
};

export default function DefeatReport({ result }: DefeatReportProps) {
  if (result.factors.length === 0) {
    return (
      <div className="p-3 rounded bg-green-500/10 border border-green-500/30 text-sm text-green-300">
        취약 요인이 발견되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="p-3 rounded bg-gray-800/50 border border-gray-700/50 text-sm space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-200">취약 요인 리포트</span>
        <ConfidenceBadge confidence={result.confidence} />
      </div>

      <ul className="space-y-1">
        {result.factors.map((factor, i) => {
          const style = SEVERITY_STYLE[factor.severity];
          return (
            <li key={i} className={`flex items-start gap-2 ${style.color}`}>
              <span className="shrink-0 mt-0.5">{style.icon}</span>
              <span className="text-gray-300">{factor.message}</span>
            </li>
          );
        })}
      </ul>

      <div className="text-xs text-gray-500 pt-1 border-t border-gray-700/30">
        이 결과는 엔진 기준 추정치이며, 실제 게임 결과와 다를 수 있습니다.
      </div>
    </div>
  );
}
