'use client';

import { RawChampion, COST_COLORS } from '@/types';
import { getChampionImage } from '@/data/imageMap';
import Tooltip from '@/components/ui/Tooltip';
import { resolveDescription } from '@/lib/utils/text';
import Image from 'next/image';

interface ChampionCardProps {
  champion: RawChampion;
  size?: number;
  starLevel?: number;
  selected?: boolean;
  onClick?: () => void;
  showName?: boolean;
  tooltipDisabled?: boolean;
}

export default function ChampionCard({
  champion, size = 64, starLevel, selected, onClick, showName = true, tooltipDisabled,
}: ChampionCardProps) {
  const costColor = COST_COLORS[champion.cost] || COST_COLORS[1];
  const stars = starLevel ? '★'.repeat(starLevel) : '';

  const card = (
    <div
      className={`relative cursor-pointer transition-all hover:scale-105 ${selected ? 'ring-2 ring-yellow-400' : ''}`}
      onClick={onClick}
      style={{ width: size, minWidth: size }}
    >
      <div
        className="rounded-md overflow-hidden border-2"
        style={{ borderColor: costColor, boxShadow: `0 0 8px ${costColor}40` }}
      >
        <Image
          src={getChampionImage(champion.apiName)}
          alt={champion.name}
          width={size}
          height={size}
          className="object-cover"
          unoptimized
        />
      </div>
      {stars && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs star whitespace-nowrap">
          {stars}
        </div>
      )}
      {showName && (
        <div className="text-center text-[10px] text-gray-300 mt-1 truncate leading-tight">
          {champion.name}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip
      disabled={tooltipDisabled}
      content={
        <div className="max-w-[220px]">
          <div className="font-bold text-yellow-400">{champion.name}</div>
          <div className="text-xs text-gray-400">{champion.cost}코스트 · {champion.traits.join(' · ')}</div>
          {champion.ability.name && (
            <>
              <div className="text-xs text-cyan-400 mt-1 font-bold">{champion.ability.name}</div>
              {champion.ability.desc && (
                <div className="text-xs text-gray-300 mt-0.5 leading-relaxed whitespace-pre-line">{resolveDescription(champion.ability.desc, champion.ability.variables, starLevel)}</div>
              )}
            </>
          )}
        </div>
      }
    >
      {card}
    </Tooltip>
  );
}
