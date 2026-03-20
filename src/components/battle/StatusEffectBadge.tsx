'use client';

import { STATUS_EFFECT_CONFIG, CATEGORY_BORDER } from '@/lib/statusEffectConfig';
import type { StatusEffectType } from '@/types';

interface StatusEffectBadgeProps {
  effects: { type: string; remainingTicks: number }[];
  size: 'sm' | 'md';
  maxDisplay?: number;
}

export default function StatusEffectBadge({
  effects,
  size,
  maxDisplay,
}: StatusEffectBadgeProps) {
  const isMd = size === 'md';
  const max = maxDisplay ?? (isMd ? 4 : 3);
  const displayed = effects.slice(0, max);
  const overflowCount = effects.length - max;

  const badgeSize = isMd ? 16 : 12;
  const fontSize = isMd ? '10px' : '8px';
  const gap = isMd ? '2px' : '1px';

  return (
    <div className="flex items-center justify-center" style={{ gap }}>
      {displayed.map((effect, i) => {
        const cfg = STATUS_EFFECT_CONFIG[effect.type as StatusEffectType];
        if (!cfg) return null;
        const borderColor = CATEGORY_BORDER[cfg.category];
        return (
          <div
            key={i}
            className="flex items-center justify-center rounded-sm"
            style={{
              width: badgeSize,
              height: badgeSize,
              backgroundColor: 'rgba(0,0,0,0.75)',
              border: `1px solid ${borderColor}`,
              fontSize,
              lineHeight: 1,
              color: cfg.color,
            }}
            title={`${cfg.label} (${effect.remainingTicks}틱 남음)`}
          >
            {cfg.icon}
          </div>
        );
      })}
      {overflowCount > 0 && (
        <div
          className="flex items-center justify-center rounded-sm"
          style={{
            width: badgeSize,
            height: badgeSize,
            backgroundColor: '#374151',
            fontSize: isMd ? '8px' : '7px',
            lineHeight: 1,
            color: '#9ca3af',
          }}
          title={`${overflowCount}개 더`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
