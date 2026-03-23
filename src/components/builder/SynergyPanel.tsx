'use client';

import { useState } from 'react';
import { ActiveTrait, TRAIT_STYLE_COLORS, RawItem } from '@/types';
import { getTraitImage } from '@/data/imageMap';
import { resolveDescription } from '@/lib/utils/text';
import Tooltip from '@/components/ui/Tooltip';
import Image from 'next/image';
import { IONIA_PATH_NAMES, IONIA_PATH_DESCRIPTIONS, getIoniaPathEffectText } from '@/data/traitModules';
import type { IoniaPathType } from '@/data/traitModules';

interface SynergyPanelProps {
  activeTraits: ActiveTrait[];
  team: 'player' | 'enemy';
  items: RawItem[];
  piltoverModules?: RawItem[];
  bilgewaterStats?: Record<string, number>;
  ioniaPath?: IoniaPathType | null;
  onIoniaPathChange?: (path: IoniaPathType) => void;
}

function TraitTooltipContent({ at }: { at: ActiveTrait }) {
  return (
    <div className="max-w-[260px]">
      <div className="font-bold text-yellow-400 mb-1">{at.trait.name}</div>
      {at.trait.desc && (
        <div className="text-xs text-gray-300 mb-2 leading-relaxed whitespace-pre-line">
          {resolveDescription(at.trait.desc, at.activeEffect?.variables ?? {})}
        </div>
      )}
      <div className="space-y-0.5">
        {at.trait.effects.map((eff) => {
          const isActive = at.activeEffect === eff;
          const vars = Object.entries(eff.variables).filter(([, v]) => v != null);
          return (
            <div
              key={eff.minUnits}
              className={`text-xs px-1.5 py-0.5 rounded ${isActive ? 'bg-yellow-900/40 text-yellow-300 font-bold' : 'text-gray-400'}`}
            >
              <span className="mr-1.5">({eff.minUnits})</span>
              {vars.map(([key, val]) => {
                const display = typeof val === 'number' && val > 0 && val < 1
                  ? `${(val * 100).toFixed(0)}%`
                  : String(val);
                return <span key={key} className="mr-2">{key}: {display}</span>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BilgewaterStatsSummary({ stats, allItems }: { stats: Record<string, number>; allItems: RawItem[] }) {
  if (Object.keys(stats).length === 0) return null;

  const totals: Record<string, number> = {};
  for (const [apiName, count] of Object.entries(stats)) {
    const item = allItems.find(i => i.apiName === apiName);
    if (!item) continue;
    for (const [key, value] of Object.entries(item.effects)) {
      if (typeof value === 'number') {
        totals[key] = (totals[key] ?? 0) + value * count;
      }
    }
  }

  const parts: string[] = [];
  if (totals['BonusAD']) parts.push(`공격력 +${(totals['BonusAD'] * 100).toFixed(0)}%`);
  if (totals['BonusAP']) parts.push(`주문력 +${Math.round(totals['BonusAP'])}`);
  if (totals['BonusAS']) parts.push(`공속 +${(totals['BonusAS'] * 100).toFixed(0)}%`);
  if (totals['BonusHealthPercent']) parts.push(`체력 +${(totals['BonusHealthPercent'] * 100).toFixed(0)}%`);
  if (totals['BonusArmorMR']) parts.push(`방마저 +${Math.round(totals['BonusArmorMR'])}`);

  if (parts.length === 0) return null;

  return (
    <div className="text-[9px] text-teal-400 pl-7 mt-0.5">
      {parts.join(' | ')}
    </div>
  );
}

function PiltoverModulesSummary({ modules }: { modules: RawItem[] }) {
  if (modules.length === 0) return null;
  return (
    <div className="flex gap-1 pl-7 mt-0.5">
      {modules.map((m, i) => (
        <Image
          key={`${m.apiName}-${i}`}
          src={`/data/images/tft_set16_piltover/${m.icon?.split('/').pop()?.toLowerCase() ?? `${m.apiName.toLowerCase()}.tft_set16.png`}`}
          alt={m.name}
          width={16}
          height={16}
          className="rounded border border-gray-600"
          unoptimized
        />
      ))}
    </div>
  );
}

export default function SynergyPanel({ activeTraits, team, items, piltoverModules = [], bilgewaterStats = {}, ioniaPath, onIoniaPathChange }: SynergyPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const teamLabel = team === 'player' ? 'TEAM A' : 'TEAM B';
  const teamColor = team === 'player' ? 'text-blue-400' : 'text-red-400';
  const ioniaActive = activeTraits.some(t => t.trait.apiName === 'TFT16_Ionia' && t.activeEffect);

  if (activeTraits.length === 0) {
    return (
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
        <div className="flex items-center justify-between">
          <div className={`text-xs font-bold ${teamColor}`}>{teamLabel} 시너지</div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="lg:hidden text-gray-500 text-xs p-1"
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
        <div className={`text-xs text-gray-500 mt-2 ${collapsed ? 'hidden lg:block' : 'block'}`}>
          챔피언을 배치하면 시너지가 표시됩니다.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
      <div className="flex items-center justify-between">
        <div className={`text-xs font-bold ${teamColor}`}>{teamLabel} 시너지</div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="lg:hidden text-gray-500 text-xs p-1"
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>
      <div className={`space-y-1 mt-2 ${collapsed ? 'hidden lg:block' : 'block'}`}>
        {activeTraits.map((at) => {
          const color = TRAIT_STYLE_COLORS[at.style] || TRAIT_STYLE_COLORS[0];
          const isActive = at.style > 0;
          const nextTier = at.trait.effects.find(e => e.minUnits > at.count);
          const label = nextTier ? `${at.count}/${nextTier.minUnits}` : `${at.count}`;
          const isPiltover = at.trait.apiName === 'TFT16_Piltover';
          const isBilgewater = at.trait.apiName === 'TFT16_Bilgewater';

          return (
            <div key={at.trait.apiName}>
              <Tooltip content={<TraitTooltipContent at={at} />}>
                <div
                  className={`flex items-center gap-2 px-2 py-1 rounded ${isActive ? '' : 'opacity-60'}`}
                  style={isActive ? { backgroundColor: `${color}20` } : { backgroundColor: '#111827' }}
                >
                  <Image
                    src={getTraitImage(at.trait.apiName)}
                    alt={at.trait.name}
                    width={16}
                    height={16}
                    className="shrink-0"
                    unoptimized
                  />
                  <span className={`text-xs flex-1 truncate ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
                    {at.trait.name}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color }}>
                    {label}
                  </span>
                </div>
              </Tooltip>
              {isActive && isPiltover && <PiltoverModulesSummary modules={piltoverModules} />}
              {isActive && isBilgewater && <BilgewaterStatsSummary stats={bilgewaterStats} allItems={items} />}
              {isActive && at.trait.apiName === 'TFT16_Ionia' && ioniaActive && onIoniaPathChange && (
                <div className="mt-1 space-y-0.5">
                  <select
                    value={ioniaPath ?? ''}
                    onChange={e => onIoniaPathChange(e.target.value as IoniaPathType)}
                    className="w-full bg-gray-800 text-white text-[10px] rounded px-1 py-0.5 border border-gray-600"
                  >
                    <option value="">길 선택...</option>
                    {Object.entries(IONIA_PATH_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>{name} — {IONIA_PATH_DESCRIPTIONS[key as IoniaPathType]}</option>
                    ))}
                  </select>
                  {ioniaPath && at.activeEffect && (
                    <div className="text-[9px] text-yellow-400 bg-gray-900 rounded px-1.5 py-0.5 border border-gray-700">
                      ⚔ {IONIA_PATH_NAMES[ioniaPath]}: {getIoniaPathEffectText(ioniaPath, at.activeEffect.variables)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
