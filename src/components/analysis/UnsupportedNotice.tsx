'use client';

import type { CoverageResult } from '@/types/analysis';

interface UnsupportedNoticeProps {
  coverage: CoverageResult;
}

const REASON_LABELS: Record<string, string> = {
  not_set17: 'Set 17이 아닌 매치입니다',
  unsupported_champion: '미지원 챔피언이 포함되어 있습니다',
  unsupported_item: '미지원 아이템이 포함되어 있습니다',
};

export default function UnsupportedNotice({ coverage }: UnsupportedNoticeProps) {
  if (!coverage.isSet17) {
    return (
      <div className="p-3 rounded bg-gray-800/50 border border-gray-700/50 text-sm text-gray-400">
        이 매치는 Set 17이 아니므로 분석할 수 없습니다.
      </div>
    );
  }

  return (
    <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm space-y-1">
      <div className="font-medium text-red-300">가상 대전을 실행할 수 없습니다</div>
      <ul className="text-red-400/80 text-xs space-y-0.5">
        {coverage.reasons.map((reason, i) => (
          <li key={i}>• {REASON_LABELS[reason] ?? reason}</li>
        ))}
        {coverage.unsupportedChampionIds.length > 0 && (
          <li className="text-gray-500">미지원 챔피언: {coverage.unsupportedChampionIds.join(', ')}</li>
        )}
        {coverage.unsupportedItemIds.length > 0 && (
          <li className="text-gray-500">미지원 아이템: {coverage.unsupportedItemIds.join(', ')}</li>
        )}
      </ul>
    </div>
  );
}
