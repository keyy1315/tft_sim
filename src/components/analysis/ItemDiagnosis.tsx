'use client';

import type { ItemAnalysisResult } from '@/types/analysis';

interface ItemDiagnosisProps {
  result: ItemAnalysisResult;
}

export default function ItemDiagnosis({ result }: ItemDiagnosisProps) {
  if (result.issues.length === 0) return null;

  return (
    <div className="mt-1 p-2 rounded bg-gray-800/50 border border-gray-700/50 text-xs">
      <div className="font-medium text-gray-300 mb-1">아이템 분석</div>
      <ul className="space-y-0.5 text-gray-400">
        {result.issues.slice(0, 3).map((issue, i) => (
          <li key={i} className="flex items-start gap-1">
            <span className={issue.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}>
              {issue.severity === 'critical' ? '●' : '▲'}
            </span>
            <span>{issue.message}</span>
            {issue.suggestion && (
              <span className="text-blue-400 ml-1">→ {issue.suggestion}</span>
            )}
          </li>
        ))}
        {result.issues.length > 3 && (
          <li className="text-gray-500">+{result.issues.length - 3}건 더</li>
        )}
      </ul>
    </div>
  );
}
