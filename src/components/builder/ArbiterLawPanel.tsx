'use client';

import { useState, useEffect } from 'react';
import type { ArbiterLaw } from '@/types';

interface TriggerDef {
  id: string;
  name: string;
  type: string;
  threshold?: number;
  intervalSeconds?: number;
  hpPercent?: number;
  once?: boolean;
}

interface EffectDef {
  id: string;
  name: string;
}

interface LawEntry {
  effect: string;
  silver: number;
  gold: number;
  silverGold?: number;
  goldGold?: number;
}

interface ArbiterLawData {
  triggers: TriggerDef[];
  effects: EffectDef[];
  laws: Record<string, LawEntry[]>;
}

const MVP_EXCLUDED_TRIGGERS = new Set([
  'on_combat_start_per_interest',
  'on_combat_start_if_refreshed',
]);

const MVP_EXCLUDED_EFFECTS = new Set([
  'free_reroll',
  'leona_drop',
  'gold_drop',
]);

interface ArbiterLawPanelProps {
  law: ArbiterLaw | null;
  onChange: (law: ArbiterLaw) => void;
  tier: 'silver' | 'gold';
}

export default function ArbiterLawPanel({ law, onChange, tier }: ArbiterLawPanelProps) {
  const [data, setData] = useState<ArbiterLawData | null>(null);

  useEffect(() => {
    fetch('/data/arbiter_laws.json')
      .then(r => r.json())
      .then((d: ArbiterLawData) => setData(d));
  }, []);

  if (!data) return null;

  const selectedTrigger = law?.triggerId ?? '';
  const selectedEffect = law?.effectId ?? '';
  const availableEffects = selectedTrigger ? (data.laws[selectedTrigger] ?? []) : [];
  const selectedLawEntry = availableEffects.find(e => e.effect === selectedEffect);
  const tierValue = selectedLawEntry ? selectedLawEntry[tier] : null;
  const effectDef = data.effects.find(e => e.id === selectedEffect);

  const handleTriggerChange = (triggerId: string) => {
    const effects = data.laws[triggerId] ?? [];
    const firstEnabled = effects.find(e => !MVP_EXCLUDED_EFFECTS.has(e.effect));
    onChange({ triggerId, effectId: firstEnabled?.effect ?? effects[0]?.effect ?? '' });
  };

  const handleEffectChange = (effectId: string) => {
    onChange({ triggerId: selectedTrigger, effectId });
  };

  return (
    <div className="mt-1.5 space-y-1 bg-gray-900/50 rounded p-1.5 border border-gray-700/50">
      <div className="text-[9px] text-yellow-400 font-bold">
        법률 선택 ({tier === 'gold' ? '골드' : '실버'})
      </div>
      <select
        value={selectedTrigger}
        onChange={e => handleTriggerChange(e.target.value)}
        className="w-full bg-gray-800 text-white text-[10px] rounded px-1 py-0.5 border border-gray-600"
      >
        <option value="">원인 선택...</option>
        {data.triggers.map(t => (
          <option
            key={t.id}
            value={t.id}
            disabled={MVP_EXCLUDED_TRIGGERS.has(t.id)}
          >
            {t.name}{MVP_EXCLUDED_TRIGGERS.has(t.id) ? ' (추후)' : ''}
          </option>
        ))}
      </select>
      {selectedTrigger && availableEffects.length > 0 && (
        <select
          value={selectedEffect}
          onChange={e => handleEffectChange(e.target.value)}
          className="w-full bg-gray-800 text-white text-[10px] rounded px-1 py-0.5 border border-gray-600"
        >
          {availableEffects.map(entry => {
            const eDef = data.effects.find(e => e.id === entry.effect);
            const val = entry[tier];
            const excluded = MVP_EXCLUDED_EFFECTS.has(entry.effect);
            return (
              <option key={entry.effect} value={entry.effect} disabled={excluded}>
                {eDef?.name ?? entry.effect} +{val}{entry.effect === 'shield' || entry.effect === 'attack_speed' ? '%' : ''}{excluded ? ' (추후)' : ''}
              </option>
            );
          })}
        </select>
      )}
      {tierValue != null && effectDef && (
        <div className="text-[9px] text-cyan-400 bg-gray-900 rounded px-1.5 py-0.5 border border-gray-700">
          {effectDef.name}: +{tierValue}{selectedEffect === 'shield' || selectedEffect === 'attack_speed' ? '%' : ''}
        </div>
      )}
    </div>
  );
}
