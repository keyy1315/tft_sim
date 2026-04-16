'use client';

import { Suspense, useMemo, useState } from 'react';
import { useGameData } from '@/hooks/useGameData';
import { useActiveSet } from '@/hooks/useActiveSet';
import { useUiStore } from '@/store/uiSlice';
import { calculateDamage } from '@/lib/simulator/systems/attack';
import ChampionGrid from '@/components/builder/ChampionGrid';
import ChampionCard from '@/components/builder/ChampionCard';
import StarSelector from '@/components/builder/StarSelector';
import ItemGrid from '@/components/builder/ItemGrid';
import ItemIcon from '@/components/builder/ItemIcon';
import DamageResultPanel from '@/components/analysis/DamageResultPanel';
import Modal from '@/components/ui/Modal';

export default function CalculatorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-gray-500">로딩 중...</div>}>
      <CalculatorContent />
    </Suspense>
  );
}

function CalculatorContent() {
  const activeSet = useActiveSet();
  const { champions, items, loading } = useGameData(activeSet);
  const store = useUiStore();
  const [showItemPicker, setShowItemPicker] = useState(false);

  const result = useMemo(() => {
    if (!store.selectedChampion) return null;
    return calculateDamage(
      store.selectedChampion,
      store.starLevel,
      store.selectedItems,
      [],
      {},
      store.targetArmor,
      store.targetMr
    );
  }, [store.selectedChampion, store.starLevel, store.selectedItems, store.targetArmor, store.targetMr]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh] text-gray-500">데이터 로딩 중...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Champion selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="p-4 bg-[#111827] rounded-xl border border-gray-800">
          <h2 className="text-lg font-bold text-gray-200 mb-4">챔피언 선택</h2>
          <ChampionGrid
            champions={champions}
            selectedChampion={store.selectedChampion}
            onSelect={store.setSelectedChampion}
          />
        </div>

        {store.selectedChampion && (
          <div className="p-4 bg-[#111827] rounded-xl border border-gray-800 space-y-4">
            <div className="flex items-center gap-4">
              <ChampionCard
                champion={store.selectedChampion}
                size={80}
                starLevel={store.starLevel}
                showName={false}
              />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-100">{store.selectedChampion.name}</h3>
                <div className="flex gap-1 mt-1">
                  {store.selectedChampion.traits.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-[#1f2937] rounded text-xs text-gray-400">{t}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  사거리: {store.selectedChampion.stats.range} · 마나: {store.selectedChampion.stats.initialMana}/{store.selectedChampion.stats.mana}
                </div>
              </div>
            </div>

            <StarSelector starLevel={store.starLevel} onChange={store.setStarLevel} />

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">아이템 ({store.selectedItems.length}/3)</span>
                <button
                  onClick={() => setShowItemPicker(true)}
                  disabled={store.selectedItems.length >= 3}
                  className="px-3 py-1 bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-40 rounded text-xs text-white transition-colors"
                >
                  + 아이템 추가
                </button>
              </div>
              <div className="flex gap-2">
                {store.selectedItems.map((item, i) => (
                  <ItemIcon key={i} item={item} size={40} onRemove={() => store.removeItem(i)} />
                ))}
                {Array.from({ length: 3 - store.selectedItems.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-10 h-10 rounded border border-dashed border-gray-600 flex items-center justify-center text-gray-600 text-xs cursor-pointer hover:border-gray-400"
                    onClick={() => setShowItemPicker(true)}
                  >
                    +
                  </div>
                ))}
              </div>
            </div>

            {/* Target dummy */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">대상 방어력</label>
                <input
                  type="range"
                  min={0} max={300} value={store.targetArmor}
                  onChange={(e) => store.setTargetArmor(Number(e.target.value))}
                  className="w-full accent-yellow-500"
                />
                <div className="text-sm text-yellow-400 font-mono text-center">{store.targetArmor}</div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">대상 마법저항력</label>
                <input
                  type="range"
                  min={0} max={300} value={store.targetMr}
                  onChange={(e) => store.setTargetMr(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="text-sm text-purple-400 font-mono text-center">{store.targetMr}</div>
              </div>
            </div>

            {/* Ability info */}
            <div className="p-3 bg-[#1a1f2e] rounded-lg">
              <div className="text-sm font-bold text-purple-400 mb-1">{store.selectedChampion.ability.name}</div>
              <div className="text-xs text-gray-400 leading-relaxed">
                {store.selectedChampion.ability.desc
                  .replace(/<[^>]+>/g, '')
                  .replace(/@\w+@/g, (match) => {
                    const varName = match.replace(/@/g, '').replace('Modified', '');
                    const v = store.selectedChampion!.ability.variables.find(
                      (vr) => varName.includes(vr.name)
                    );
                    return v ? String(v.value[store.starLevel] ?? v.value[1] ?? '?') : '?';
                  })
                  .replace(/\(%i:\w+%\)/g, '')}
              </div>
              {store.selectedChampion.ability.variables.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {store.selectedChampion.ability.variables.map((v) => (
                    <span key={v.name} className="mr-3">
                      {v.name}: [{v.value.slice(1, 4).join(' / ')}]
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Results */}
      <div>
        {result && store.selectedChampion ? (
          <div className="sticky top-20">
            <DamageResultPanel result={result} championName={store.selectedChampion.name} />
          </div>
        ) : (
          <div className="p-8 bg-[#111827] rounded-xl border border-gray-800 text-center">
            <div className="text-4xl mb-4">⚔️</div>
            <div className="text-gray-400">챔피언을 선택하면<br />데미지가 계산됩니다.</div>
          </div>
        )}
      </div>

      {/* Item picker modal */}
      <Modal isOpen={showItemPicker} onClose={() => setShowItemPicker(false)} title="아이템 선택">
        <ItemGrid
          items={items}
          onSelect={(item) => {
            store.addItem(item);
            if (store.selectedItems.length >= 2) setShowItemPicker(false);
          }}
        />
      </Modal>
    </div>
  );
}
