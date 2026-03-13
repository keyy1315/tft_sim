'use client';

import { RawItem } from '@/types';
import { getItemImage } from '@/data/imageMap';
import Tooltip from '@/components/ui/Tooltip';
import Image from 'next/image';

interface ItemIconProps {
  item: RawItem;
  size?: number;
  onClick?: () => void;
  onRemove?: () => void;
  showTooltip?: boolean;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/@\w+@/g, '').replace(/%i:\w+%/g, '');
}

export default function ItemIcon({ item, size = 32, onClick, onRemove, showTooltip = true }: ItemIconProps) {
  const isArtifact = item.apiName.includes('Artifact');
  const borderClass = isArtifact ? 'border-purple-500' : item.composition.length === 2 ? 'border-yellow-600' : 'border-gray-500';

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
      content={
        <div className="max-w-[200px]">
          <div className="font-bold text-yellow-400">{item.name}</div>
          <div className="text-xs text-gray-300 mt-1">{stripHtml(item.desc)}</div>
          {Object.entries(item.effects).length > 0 && (
            <div className="mt-1 text-xs text-gray-400">
              {Object.entries(item.effects).map(([k, v]) => (
                <div key={k}>{k}: {typeof v === 'number' ? (v < 1 && v > 0 ? `${(v * 100).toFixed(0)}%` : v) : v}</div>
              ))}
            </div>
          )}
        </div>
      }
    >
      {icon}
    </Tooltip>
  );
}
