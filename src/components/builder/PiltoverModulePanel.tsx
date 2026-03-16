'use client';

import { useState } from 'react';
import { RawItem, ActiveTrait } from '@/types';
import { getPiltoverModuleLimit, canAddPiltoverModule, getItemCategory } from '@/lib/simulator/systems/item';
import ItemIcon from './ItemIcon';
import Modal from '@/components/ui/Modal';
import SearchBar from '@/components/ui/SearchBar';

interface PiltoverModulePanelProps {
  modules: RawItem[];
  allItems: RawItem[];
  activeTraits: ActiveTrait[];
  onAddModule: (item: RawItem) => void;
  onRemoveModule: (index: number) => void;
}

export default function PiltoverModulePanel({
  modules,
  allItems,
  activeTraits,
  onAddModule,
  onRemoveModule,
}: PiltoverModulePanelProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const limit = getPiltoverModuleLimit(activeTraits);
  const piltoverItems = allItems.filter(i => getItemCategory(i) === 'piltover');

  if (limit === 0) return null;

  const filteredPiltover = piltoverItems.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="bg-[#111827] rounded-lg border border-cyan-700/30 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-cyan-400">
          필트오버 모듈 ({modules.length}/{limit})
        </div>
        <div className="text-[10px] text-gray-500">8초 후 발동</div>
      </div>

      <div className="flex gap-1.5 items-center">
        {modules.map((mod, idx) => (
          <ItemIcon
            key={`${mod.apiName}-${idx}`}
            item={mod}
            size={32}
            onRemove={() => onRemoveModule(idx)}
          />
        ))}
        {Array.from({ length: limit - modules.length }).map((_, i) => (
          <button
            key={`empty-${i}`}
            onClick={i === 0 ? () => setShowPicker(true) : undefined}
            className={`w-8 h-8 rounded border border-dashed ${
              i === 0
                ? 'border-cyan-600/50 text-cyan-500 hover:border-cyan-400 hover:text-cyan-300 cursor-pointer'
                : 'border-gray-700 text-gray-700 cursor-default'
            } flex items-center justify-center text-sm`}
          >
            {i === 0 ? '+' : ''}
          </button>
        ))}
      </div>

      <Modal isOpen={showPicker} onClose={() => setShowPicker(false)} title="필트오버 모듈 선택">
        <div className="space-y-3">
          <SearchBar value={search} onChange={setSearch} placeholder="모듈 검색..." />
          <div className="grid grid-cols-6 gap-1.5 max-h-[250px] overflow-y-auto p-1">
            {filteredPiltover.map((item) => {
              const validation = canAddPiltoverModule(item, modules, activeTraits);
              const disabled = !validation.canEquip;
              return (
                <div
                  key={item.apiName}
                  className={disabled ? 'opacity-30 cursor-not-allowed' : ''}
                  title={disabled ? validation.reason : item.name}
                >
                  <ItemIcon
                    item={item}
                    size={36}
                    onClick={disabled ? undefined : () => {
                      onAddModule(item);
                      setShowPicker(false);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
