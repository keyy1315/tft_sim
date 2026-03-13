'use client';

import { useState, useMemo } from 'react';
import { useGameData } from '@/hooks/useGameData';
import { useTeamStore } from '@/store/teamSlice';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { calculateStats } from '@/lib/simulator/systems/stat';
import { HexCoord, axialToOffset, RawChampion } from '@/types';
import ChampionGrid from '@/components/builder/ChampionGrid';
import ChampionCard from '@/components/builder/ChampionCard';
import HexBoard from '@/components/battle/HexBoard';
import TraitBar from '@/components/builder/TraitBar';
import StarSelector from '@/components/builder/StarSelector';
import ItemGrid from '@/components/builder/ItemGrid';
import ItemIcon from '@/components/builder/ItemIcon';
import Modal from '@/components/ui/Modal';

export default function TeamBuilderPage() {
  const { champions, items, traits, loading } = useGameData();
  const store = useTeamStore();
  const [selectedCell, setSelectedCell] = useState<HexCoord | null>(null);
  const [showChampionPicker, setShowChampionPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);

  // Resolve traits — derived value, no useEffect + setState needed
  const activeTraits = useMemo(() => {
    if (traits.length === 0) return [];
    return resolveTraits(store.placedChampions, traits);
  }, [store.placedChampions, traits]);

  // Sync activeTraits to store when they change
  const prevActiveTraitsRef = useMemo(() => {
    store.setActiveTraits(activeTraits);
    return activeTraits;
  }, [activeTraits, store]);

  const selectedPlaced = useMemo(() => {
    if (!selectedCell) return null;
    return store.placedChampions.find(
      p => p.position.q === selectedCell.q && p.position.r === selectedCell.r
    ) || null;
  }, [selectedCell, store.placedChampions]);

  // Team stats
  const teamStats = useMemo(() => {
    let totalDps = 0;
    let totalHp = 0;
    const costs: number[] = [];
    for (const p of store.placedChampions) {
      const { stats } = calculateStats(p.champion, p.starLevel, p.items);
      const critMult = 1 + stats.critChance * (stats.critMultiplier - 1);
      totalDps += stats.damage * stats.attackSpeed * critMult;
      totalHp += stats.hp;
      costs.push(p.champion.cost);
    }
    return { totalDps, totalHp, costs };
  }, [store.placedChampions]);

  const handleCellClick = (pos: HexCoord) => {
    setSelectedCell(pos);
    const placed = store.placedChampions.find(
      p => p.position.q === pos.q && p.position.r === pos.r
    );
    if (!placed) {
      setShowChampionPicker(true);
    }
  };

  const handleChampionSelect = (champion: RawChampion) => {
    if (selectedCell) {
      store.placeChampion(champion, selectedCell);
      setShowChampionPicker(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh] text-gray-500">데이터 로딩 중...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Board */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-200">팀 빌더</h2>
          <div className="flex gap-2">
            <span className="text-sm text-gray-400">
              {store.placedChampions.length}/8 챔피언
            </span>
            <button
              onClick={store.clearBoard}
              className="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded text-xs"
            >
              초기화
            </button>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-gray-800 p-4 flex justify-center">
          <HexBoard
            rows={4}
            placedChampions={store.placedChampions}
            onCellClick={handleCellClick}
            selectedCell={selectedCell}
          />
        </div>

        {/* Selected champion detail */}
        {selectedPlaced && (
          <div className="p-4 bg-[#111827] rounded-xl border border-gray-800 space-y-3">
            <div className="flex items-center gap-4">
              <ChampionCard champion={selectedPlaced.champion} size={64} starLevel={selectedPlaced.starLevel} showName={false} />
              <div className="flex-1">
                <h3 className="font-bold text-gray-100">{selectedPlaced.champion.name}</h3>
                <div className="text-xs text-gray-500">{selectedPlaced.champion.traits.join(', ')}</div>
              </div>
              <button
                onClick={() => { store.removeChampion(selectedPlaced.position); setSelectedCell(null); }}
                className="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded text-xs"
              >
                제거
              </button>
            </div>
            <StarSelector
              starLevel={selectedPlaced.starLevel}
              onChange={(l) => store.setChampionStar(selectedPlaced.position, l)}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">아이템:</span>
              {selectedPlaced.items.map((item, i) => (
                <ItemIcon
                  key={i}
                  item={item}
                  size={32}
                  onRemove={() => store.removeChampionItem(selectedPlaced.position, i)}
                />
              ))}
              {selectedPlaced.items.length < 3 && (
                <button
                  onClick={() => setShowItemPicker(true)}
                  className="w-8 h-8 rounded border border-dashed border-gray-600 text-gray-600 text-xs hover:border-gray-400"
                >
                  +
                </button>
              )}
            </div>
          </div>
        )}

        {/* Team stats */}
        {store.placedChampions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#111827] rounded-lg text-center border border-gray-800">
              <div className="text-xs text-gray-500">팀 DPS</div>
              <div className="text-xl font-bold text-red-400">{Math.round(teamStats.totalDps)}</div>
            </div>
            <div className="p-3 bg-[#111827] rounded-lg text-center border border-gray-800">
              <div className="text-xs text-gray-500">총 체력</div>
              <div className="text-xl font-bold text-green-400">{Math.round(teamStats.totalHp)}</div>
            </div>
            <div className="p-3 bg-[#111827] rounded-lg text-center border border-gray-800">
              <div className="text-xs text-gray-500">평균 코스트</div>
              <div className="text-xl font-bold text-yellow-400">
                {teamStats.costs.length > 0 ? (teamStats.costs.reduce((a, b) => a + b, 0) / teamStats.costs.length).toFixed(1) : '-'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Traits panel */}
      <div className="space-y-4">
        <div className="p-4 bg-[#111827] rounded-xl border border-gray-800">
          <h3 className="text-sm font-bold text-gray-300 mb-3">활성 시너지</h3>
          <TraitBar activeTraits={store.activeTraits} />
        </div>

        {/* Champion list on board */}
        <div className="p-4 bg-[#111827] rounded-xl border border-gray-800">
          <h3 className="text-sm font-bold text-gray-300 mb-3">배치된 챔피언</h3>
          <div className="space-y-1">
            {store.placedChampions.map((p) => {
              const off = axialToOffset(p.position);
              return (
                <div
                  key={`${p.position.q}-${p.position.r}`}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-[#1f2937] cursor-pointer"
                  onClick={() => setSelectedCell(p.position)}
                >
                  <ChampionCard champion={p.champion} size={28} starLevel={p.starLevel} showName={false} />
                  <span className="text-xs text-gray-300 flex-1">{p.champion.name}</span>
                  <span className="text-[10px] text-gray-500">({off.row},{off.col})</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Champion picker modal */}
      <Modal isOpen={showChampionPicker} onClose={() => setShowChampionPicker(false)} title="챔피언 선택">
        <ChampionGrid champions={champions} onSelect={handleChampionSelect} />
      </Modal>

      {/* Item picker modal */}
      <Modal isOpen={showItemPicker} onClose={() => setShowItemPicker(false)} title="아이템 선택">
        <ItemGrid
          items={items}
          onSelect={(item) => {
            if (selectedPlaced) {
              store.addChampionItem(selectedPlaced.position, item);
              if (selectedPlaced.items.length >= 2) setShowItemPicker(false);
            }
          }}
        />
      </Modal>
    </div>
  );
}
