'use client';

import { TickSnapshotUnit, COST_COLORS } from '@/types';
import { getChampionImage } from '@/data/imageMap';

interface UnitDetailPanelProps {
  unitSnapshot: TickSnapshotUnit;
  meta: {
    championName: string;
    championApiName: string;
    cost: number;
    starLevel: number;
    maxHp: number;
    maxMana: number;
  };
  onClose: () => void;
}

const STAR_LABELS: Record<number, string> = { 1: '★', 2: '★★', 3: '★★★' };

interface StatDef {
  label: string;
  value: number;
  format: 'int' | 'float' | 'percent';
}

function formatStat(value: number, format: 'int' | 'float' | 'percent'): string {
  if (format === 'percent') return `${Math.round(value * 100)}%`;
  if (format === 'float') return value.toFixed(2);
  return Math.round(value).toString();
}

export default function UnitDetailPanel({
  unitSnapshot,
  meta,
  onClose,
}: UnitDetailPanelProps) {
  const { stats, damageAmp } = unitSnapshot;
  const costColor = COST_COLORS[meta.cost as keyof typeof COST_COLORS] ?? '#9ca3af';

  const statDefs: StatDef[] = [
    { label: '공격력', value: stats.damage, format: 'int' },
    { label: '주문력', value: stats.ap, format: 'int' },
    { label: '피해증폭', value: damageAmp, format: 'percent' },
    { label: '방어력', value: stats.armor, format: 'int' },
    { label: '마법방어', value: stats.magicResist, format: 'int' },
    { label: '공격속도', value: stats.attackSpeed, format: 'float' },
    { label: '치명타', value: stats.critChance, format: 'percent' },
  ];

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded border flex-shrink-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${getChampionImage(meta.championApiName)})`,
            borderColor: costColor,
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-200">{meta.championName}</span>
            <span className="text-[10px] text-yellow-400">{STAR_LABELS[meta.starLevel]}</span>
          </div>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span>
              HP <span className="text-green-400">{Math.round(unitSnapshot.currentHp)}</span>
              <span className="text-gray-600">/{Math.round(meta.maxHp)}</span>
            </span>
            <span>
              Mana <span className="text-blue-400">{Math.round(unitSnapshot.currentMana)}</span>
              <span className="text-gray-600">/{meta.maxMana}</span>
            </span>
            {unitSnapshot.shield > 0 && (
              <span>
                보호막 <span className="text-gray-200">{Math.round(unitSnapshot.shield)}</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 text-xs px-1"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* Stats grid — 3 columns */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-1">
        {statDefs.map(s => (
          <div key={s.label} className="flex items-baseline justify-between gap-1">
            <span className="text-[10px] text-gray-500">{s.label}</span>
            <span className="text-xs font-mono text-gray-200 tabular-nums">
              {formatStat(s.value, s.format)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
