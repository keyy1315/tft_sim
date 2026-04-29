'use client';

import { RawItem } from '@/types';
import { getItemImage } from '@/data/imageMap';
import { STAT_NAME_KO } from '@/lib/simulator/models/constants';
import Tooltip from '@/components/ui/Tooltip';
import { resolveDescription } from '@/lib/utils/text';
import Image from 'next/image';

interface ItemIconProps {
  item: RawItem;
  size?: number;
  onClick?: () => void;
  onRemove?: () => void;
  showTooltip?: boolean;
  tooltipDisabled?: boolean;
}

export default function ItemIcon({ item, size = 32, onClick, onRemove, showTooltip = true, tooltipDisabled }: ItemIconProps) {
  const isArtifact = item.apiName.includes('Artifact');
  const isRadiant = item.apiName.includes('Corrupted') || item.apiName.includes('Radiant_');
  const isEmblem = item.apiName.includes('EmblemItem');
  const isDarkin = item.apiName.includes('TheDarkin');
  const borderClass = isRadiant ? 'border-fuchsia-500' : isDarkin ? 'border-red-500' : isEmblem ? 'border-cyan-500' : isArtifact ? 'border-purple-500' : item.composition.length === 2 ? 'border-yellow-600' : 'border-gray-500';

  const icon = (
    <div
      className={`relative rounded border ${borderClass} cursor-pointer hover:brightness-125 transition-all`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <Image
        src={getItemImage(item.apiName)}
        alt={item.name}
        width={size}
        height={size}
        className="rounded object-cover"
        unoptimized
      />
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full text-[8px] text-white flex items-center justify-center hover:bg-red-500"
        >
          ✕
        </button>
      )}
    </div>
  );

  if (!showTooltip) return icon;

  return (
    <Tooltip
      disabled={tooltipDisabled}
      content={
        <div className="max-w-[200px]">
          <div className="font-bold text-yellow-400">{item.name}</div>
          <div className="text-xs text-gray-300 mt-1 whitespace-pre-line">{resolveDescription(item.desc, item.effects)}</div>
          {(() => {
            // hash key ({hex8}) / null / 내부 변수는 표시하지 않음.
            // desc 에서 이미 치환된 변수(Duration, BurnPercent 등)도 중복 표기 방지 위해 STAT_NAME_KO 에 매핑된 것만 노출.
            const visible = Object.entries(item.effects).filter(
              ([k, v]) => !k.startsWith('{') && v != null && STAT_NAME_KO[k] != null,
            );
            if (visible.length === 0) return null;
            return (
              <div className="mt-1 text-xs text-gray-400">
                {visible.map(([k, v]) => (
                  <div key={k}>
                    {STAT_NAME_KO[k]}: {typeof v === 'number' ? (v < 1 && v > 0 ? `${(v * 100).toFixed(0)}%` : v) : v}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      }
    >
      {icon}
    </Tooltip>
  );
}
