'use client';

import { PlacedChampion, RawItem, ActiveTrait } from '@/types';
import ChampionCard from './ChampionCard';
import StarSelector from './StarSelector';
import ItemIcon from './ItemIcon';
import ItemGrid from './ItemGrid';
import Modal from '@/components/ui/Modal';
import { useState } from 'react';
import { getItemCategory } from '@/lib/simulator/systems/item';
import { resolveDescription } from '@/lib/utils/text';

interface SelectedUnitPanelProps {
  placed: PlacedChampion;
  team: 'player' | 'enemy';
  allItems: RawItem[];
  activeTraits: ActiveTrait[];
  onStarChange: (level: number) => void;
  onEquipItem: (item: RawItem) => void;
  onRemoveItem: (itemIdx: number) => void;
  onRemoveUnit: () => void;
}

export default function SelectedUnitPanel({
  placed,
  team,
  allItems,
  activeTraits,
  onStarChange,
  onEquipItem,
  onRemoveItem,
  onRemoveUnit,
}: SelectedUnitPanelProps) {
  const [showItemPicker, setShowItemPicker] = useState(false);
  const teamColor = team === 'player' ? 'border-blue-600/30' : 'border-red-600/30';
  const teamLabel = team === 'player' ? 'A' : 'B';

  const artifactCount = placed.items.filter(i => getItemCategory(i) === 'artifact').length;

  return (
    <div className={`bg-[#111827] rounded-xl border ${teamColor} p-3 space-y-3`}>
      <div className="flex items-center gap-3">
        <ChampionCard
          champion={placed.champion}
          size={48}
          starLevel={placed.starLevel}
          showName={false}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-200 truncate">{placed.champion.name}</div>
          <div className="text-[10px] text-gray-500">{teamLabel} / {placed.champion.cost}코스트</div>
        </div>
        <button
          onClick={onRemoveUnit}
          className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs hover:bg-red-900/50"
        >
          제거
        </button>
      </div>

      <StarSelector starLevel={placed.starLevel} onChange={onStarChange} />

      <div>
        <div className="text-xs text-gray-400 mb-1.5">
          아이템 ({placed.items.length}/3)
          {artifactCount > 0 && <span className="ml-1 text-purple-400">유물 {artifactCount}/1</span>}
        </div>
        <div className="flex gap-1.5 items-center">
          {placed.items.map((item, idx) => (
            <ItemIcon
              key={`${item.apiName}-${idx}`}
              item={item}
              size={32}
              onRemove={() => onRemoveItem(idx)}
            />
          ))}
          {placed.items.length < 3 && (
            <button
              onClick={() => setShowItemPicker(true)}
              className="w-8 h-8 rounded border border-dashed border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300 flex items-center justify-center text-sm"
            >
              +
            </button>
          )}
        </div>
      </div>

      <div className="text-[10px] text-gray-500 space-y-0.5">
        <div>특성: {placed.champion.traits.join(', ')}</div>
      </div>

      {placed.champion.ability.name && (
        <div className="border-t border-gray-700 pt-2">
          <div className="text-xs text-cyan-400 font-bold">{placed.champion.ability.name}</div>
          {placed.champion.ability.desc && (
            <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
              {resolveDescription(placed.champion.ability.desc, placed.champion.ability.variables, placed.starLevel)}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showItemPicker} onClose={() => setShowItemPicker(false)} title="아이템 선택">
        <ItemGrid
          items={allItems}
          activeTraits={activeTraits}
          champion={placed}
          onSelect={(item) => {
            onEquipItem(item);
            setShowItemPicker(false);
          }}
        />
      </Modal>
    </div>
  );
}
