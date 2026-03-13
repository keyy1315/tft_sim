'use client';

import { RawChampion, COST_COLORS } from '@/types';
import { getChampionImage } from '@/data/imageMap';
import Image from 'next/image';

interface ChampionCardProps {
  champion: RawChampion;
  size?: number;
  starLevel?: number;
  selected?: boolean;
  onClick?: () => void;
  showName?: boolean;
}

export default function ChampionCard({
  champion, size = 64, starLevel, selected, onClick, showName = true
}: ChampionCardProps) {
  const costColor = COST_COLORS[champion.cost] || COST_COLORS[1];
  const stars = starLevel ? '★'.repeat(starLevel) : '';

  return (
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
}
