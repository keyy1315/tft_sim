'use client';

import type { AnalysisConfidence } from '@/types/analysis';

const BADGE_CONFIG: Record<AnalysisConfidence, { label: string; className: string }> = {
  static: {
    label: '정적 분석',
    className: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  estimated: {
    label: '추정 시뮬레이션',
    className: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  unsupported: {
    label: '재현 불가',
    className: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
};

interface ConfidenceBadgeProps {
  confidence: AnalysisConfidence;
}

export default function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const config = BADGE_CONFIG[confidence];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${config.className}`}>
      {config.label}
    </span>
  );
}
