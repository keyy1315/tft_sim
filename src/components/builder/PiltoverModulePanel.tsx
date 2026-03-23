'use client';

import { useState } from 'react';
import { RawItem, ActiveTrait } from '@/types';
import { getPiltoverModuleLimit, canAddPiltoverModule, getItemCategory } from '@/lib/simulator/systems/item';
import { getAllowedModuleApiNames, PILTOVER_MODULE_TIERS } from '@/data/traitModules';
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
  const piltoverTrait = activeTraits.find(t => t.trait.apiName === 'TFT16_Piltover');
  const piltoverCount = piltoverTrait?.count ?? 0;
  const allowedApiNames = getAllowedModuleApiNames(piltoverCount);
  const piltoverItems = allItems.filter(i =>
    getItemCategory(i) === 'piltover' && allowedApiNames.has(i.apiName)
  );

  const [collapsed, setCollapsed] = useState(false);

  if (limit === 0) return null;

  const filteredPiltover = piltoverItems.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // 티어별 그룹핑
  const tierGroups: { tier: number; items: RawItem[] }[] = [];
  for (const tier of [2, 4, 6]) {
    if (piltoverCount < tier) break;
    const tierApiNames = new Set(PILTOVER_MODULE_TIERS[tier] ?? []);
    const tierItems = filteredPiltover.filter(i => tierApiNames.has(i.apiName));
    if (tierItems.length > 0) {
      tierGroups.push({ tier, items: tierItems });
    }
  }

  return (
    <div className="bg-[#111827] rounded-lg border border-cyan-700/30 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-cyan-400">
            필트오버 모듈 ({modules.length}/{limit})
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="lg:hidden text-gray-500 text-xs p-1"
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
        <div className="text-[10px] text-gray-500">8초 후 발동</div>
      </div>

      <div className={`flex gap-1.5 items-center ${collapsed ? 'hidden lg:flex' : 'flex'}`}>
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
          <div className="max-h-[300px] overflow-y-auto space-y-3 p-1">
            {tierGroups.map(({ tier, items: tierItems }) => (
              <div key={tier}>
                <div className="text-[10px] font-bold text-cyan-400 mb-1">{tier} 필트오버</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {tierItems.map((item) => {
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
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
