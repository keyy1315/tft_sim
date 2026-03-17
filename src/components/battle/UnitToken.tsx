'use client';

import Image from 'next/image';
import { COST_COLORS } from '@/types';
import { getChampionImage } from '@/data/imageMap';

interface UnitTokenProps {
  championName: string;
  championApiName: string;
  cost: number;
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  starLevel: number;
  items: { apiName: string }[];
  statusEffects: { type: string; remainingTicks: number }[];
  isAlive: boolean;
  team: 'player' | 'enemy';
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

const STATUS_ICONS: Record<string, { label: string; color: string }> = {
  stun: { label: 'S', color: '#fbbf24' },
  slow: { label: 'W', color: '#60a5fa' },
  burn: { label: 'B', color: '#f97316' },
  shield: { label: 'D', color: '#a3e635' },
  invulnerable: { label: 'I', color: '#c084fc' },
  disarm: { label: 'X', color: '#f87171' },
  taunt: { label: 'T', color: '#fb923c' },
};

export default function UnitToken({
  championName,
  championApiName,
  cost,
  currentHp,
  maxHp,
  currentMana,
  maxMana,
  starLevel,
  items,
  statusEffects,
  isAlive,
  team,
  isSelected = false,
  onClick,
  size = 'md',
}: UnitTokenProps) {
  const isMd = size === 'md';
  const w = isMd ? 64 : 48;
  const imgSize = isMd ? 40 : 28;
  const borderColor = isSelected
    ? '#f59e0b'
    : !isAlive
      ? '#374151'
      : COST_COLORS[cost] ?? '#6b7280';

  const hpRatio = maxHp > 0 ? Math.max(0, currentHp) / maxHp : 0;
  const manaRatio = maxMana > 0 ? Math.min(1, currentMana / maxMana) : 0;
  const hpColor = hpRatio > 0.6 ? '#22c55e' : hpRatio > 0.3 ? '#f59e0b' : '#ef4444';
  const teamRing = team === 'player' ? 'ring-blue-500/40' : 'ring-red-500/40';

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${!isAlive ? 'opacity-30 grayscale' : ''}`}
      style={{ width: w }}
    >
      {/* Star level */}
      {starLevel > 0 && (
        <div className="text-[13px] leading-none text-yellow-400 font-bold tracking-tight" style={{ WebkitTextStroke: '1px white' }}>
          {'★'.repeat(starLevel)}
        </div>
      )}

      {/* Portrait */}
      <div
        className={`relative rounded-md overflow-hidden ring-2 ${teamRing}`}
        style={{
          width: imgSize,
          height: imgSize,
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor,
        }}
      >
        <Image
          src={getChampionImage(championApiName)}
          alt={championName}
          className="w-full h-full object-cover"
          draggable={false}
          width={imgSize}
          height={imgSize}
          unoptimized
        />
        {/* Status effect overlay icons */}
        {statusEffects.length > 0 && (
          <div className="absolute top-0 right-0 flex flex-col gap-px">
            {statusEffects.slice(0, 3).map((e, i) => {
              const cfg = STATUS_ICONS[e.type];
              if (!cfg) return null;
              return (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm flex items-center justify-center text-[7px] font-black text-black"
                  style={{ backgroundColor: cfg.color }}
                  title={`${e.type} (${e.remainingTicks} ticks)`}
                >
                  {cfg.label}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HP Bar */}
      <div
        className="rounded-sm overflow-hidden bg-gray-800"
        style={{ width: imgSize, height: isMd ? 7 : 4 }}
      >
        <div
          className="h-full rounded-sm transition-all duration-150"
          style={{ width: `${hpRatio * 100}%`, backgroundColor: hpColor }}
        />
      </div>

      {/* Mana Bar */}
      <div
        className="rounded-sm overflow-hidden bg-gray-800"
        style={{ width: imgSize, height: isMd ? 5 : 3 }}
      >
        <div
          className="h-full rounded-sm transition-all duration-150 bg-blue-500"
          style={{ width: `${manaRatio * 100}%` }}
        />
      </div>

      {/* Item dots */}
      {items.length > 0 && (
        <div className="flex gap-0.5">
          {items.slice(0, 3).map((_, i) => (
            <div
              key={i}
              className="rounded-full bg-yellow-500 border border-gray-900"
              style={{ width: isMd ? 6 : 4, height: isMd ? 6 : 4 }}
            />
          ))}
        </div>
      )}

      {/* Name */}
      {isMd && (
        <div className="text-[8px] text-gray-400 leading-none truncate max-w-full text-center">
          {championName}
        </div>
      )}
    </div>
  );
}
