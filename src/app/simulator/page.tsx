'use client';

import { Suspense, useState, useMemo, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useGameData } from '@/hooks/useGameData';
import { useActiveSet } from '@/hooks/useActiveSet';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { PlacedChampion, axialToOffset, offsetToAxial, CombatResult, CombatLog } from '@/types';
import { TICKS_PER_SECOND, BOARD_COLS } from '@/lib/simulator/models/constants';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useReplayControls } from '@/hooks/useReplayControls';
import { useDndHandlers } from '@/hooks/useDndHandlers';
import { getItemCategory, isDisabledItem } from '@/lib/simulator/systems/item';
import { isBilgewaterStatItem } from '@/data/traitModules';
import { resolveBilgewaterStatEffects } from '@/lib/simulator/systems/stat';
import ChampionGrid from '@/components/builder/ChampionGrid';
import SetupBoard from '@/components/battle/SetupBoard';
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import ReplayBoard from '@/components/battle/ReplayBoard';
import BattleControls from '@/components/battle/BattleControls';
import DamageSidebar from '@/components/battle/DamageSidebar';
import UnitDetailPanel from '@/components/battle/UnitDetailPanel';
import Modal from '@/components/ui/Modal';
import SynergyPanel from '@/components/builder/SynergyPanel';
import SelectedUnitPanel from '@/components/builder/SelectedUnitPanel';
import DraggableChampionCard from '@/components/builder/DraggableChampionCard';
import DraggableItemIcon from '@/components/builder/DraggableItemIcon';
import ChampionCard from '@/components/builder/ChampionCard';
import ItemIcon from '@/components/builder/ItemIcon';
import SearchBar from '@/components/ui/SearchBar';
import TeamCodePanel from '@/components/builder/TeamCodePanel';
import AugmentSlots from '@/components/builder/AugmentSlots';
import AugmentSelector from '@/components/builder/AugmentSelector';
import AugmentDetailPopup from '@/components/builder/AugmentDetailPopup';
import PiltoverModulePanel from '@/components/builder/PiltoverModulePanel';
import MfModeSelector from '@/components/builder/MfModeSelector';

type ItemFilterTab = 'all' | 'component' | 'combined' | 'artifact' | 'emblem' | 'radiant';

export default function SimulatorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-gray-500">로딩 중...</div>}>
      <SimulatorContent />
    </Suspense>
  );
}

function SimulatorContent() {
  const activeSet = useActiveSet();
  const { champions, items, traits, augments, teamPlannerMapping, loading } = useGameData(activeSet);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const tm = useTeamManagement({ traits });
  const replay = useReplayControls();
  const dnd = useDndHandlers({
    playerTeam: tm.playerTeam,
    enemyTeam: tm.enemyTeam,
    updatePlayerTeam: tm.updatePlayerTeam,
    updateEnemyTeam: tm.updateEnemyTeam,
    handleEquipItem: tm.handleEquipItem,
    onChampionPlaced: (team, index, champion) => {
      if (champion.apiName === 'TFT17_MissFortune') {
        tm.setPendingMfPlacement({ team, index });
      }
    },
  });

  // Champion/Item pool state
  const [champSearch, setChampSearch] = useState('');
  const [champCostFilter, setChampCostFilter] = useState<number | null>(null);
  const [activePoolTab, setActivePoolTab] = useState<'champions' | 'items' | 'bilgewater'>('champions');
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState<ItemFilterTab>('all');
  const [showTeamCode, setShowTeamCode] = useState(false);
  const [logFilter, setLogFilter] = useState<CombatLog['type'] | 'all'>('all');
  const [isRunning, setIsRunning] = useState(false);

  // Filtered champions for pool
  const filteredChampions = useMemo(() => {
    let filtered = champions;
    if (champSearch) {
      const s = champSearch.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(s) ||
        c.traits.some(t => t.toLowerCase().includes(s))
      );
    }
    if (champCostFilter) {
      filtered = filtered.filter(c => c.cost === champCostFilter);
    }
    return [...filtered].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [champions, champSearch, champCostFilter]);

  /** Map player data-row 0-3 → display-row 4-7 for 8-row combat board */
  const toEightRowCoords = useCallback((team: PlacedChampion[], rowOffset: number): PlacedChampion[] => {
    if (rowOffset === 0) return team;
    return team.map(p => {
      const off = axialToOffset(p.position);
      const newPos = offsetToAxial({ row: off.row + rowOffset, col: off.col });
      return { ...p, position: newPos };
    });
  }, []);

  const runSimulation = useCallback(() => {
    if (tm.playerTeam.length === 0 || tm.enemyTeam.length === 0) return;
    setIsRunning(true);
    replay.setCombatResult(null);
    replay.setIsPlaying(false);
    replay.setReplayTick(0);

    setTimeout(() => {
      const mappedPlayer = toEightRowCoords(tm.playerTeam, 4);
      const result = simulateCombat(mappedPlayer, tm.enemyTeam, {
        seed: 42, allTraits: traits, skipMirror: true,
        playerAugments: tm.playerAugments, playerAugmentStacks: tm.playerAugmentStacks,
        enemyAugments: tm.enemyAugments, enemyAugmentStacks: tm.enemyAugmentStacks,
        playerBilgewaterEffects: resolveBilgewaterStatEffects(tm.playerBilgewaterStats, items),
        enemyBilgewaterEffects: resolveBilgewaterStatEffects(tm.enemyBilgewaterStats, items),
        playerPiltoverModules: tm.playerPiltoverModules,
        enemyPiltoverModules: tm.enemyPiltoverModules,
        playerIoniaPath: tm.playerIoniaPath ?? undefined,
        enemyIoniaPath: tm.enemyIoniaPath ?? undefined,
        playerGalio: tm.playerGalio,
        enemyGalio: tm.enemyGalio,
      });
      replay.setCombatResult(result);
      setIsRunning(false);
      replay.setViewMode('replay');
      replay.setReplayTick(0);
      replay.setIsPlaying(true);
    }, 100);
  }, [tm.playerTeam, tm.enemyTeam, traits, tm.playerAugments, tm.playerAugmentStacks, tm.enemyAugments, tm.enemyAugmentStacks, tm.playerBilgewaterStats, tm.enemyBilgewaterStats, tm.playerPiltoverModules, tm.enemyPiltoverModules, tm.playerIoniaPath, tm.enemyIoniaPath, tm.playerGalio, tm.enemyGalio, items, toEightRowCoords, replay]);

  const runMultiple = useCallback(() => {
    if (tm.playerTeam.length === 0 || tm.enemyTeam.length === 0) return;
    setIsRunning(true);
    setTimeout(() => {
      const mappedPlayer = toEightRowCoords(tm.playerTeam, 4);
      let playerWins = 0;
      let enemyWins = 0;
      let draws = 0;
      const N = 100;
      let lastResult: CombatResult | null = null;
      for (let i = 0; i < N; i++) {
        const r = simulateCombat(mappedPlayer, tm.enemyTeam, {
          seed: i + 1, allTraits: traits, skipMirror: true,
          playerAugments: tm.playerAugments, playerAugmentStacks: tm.playerAugmentStacks,
          enemyAugments: tm.enemyAugments, enemyAugmentStacks: tm.enemyAugmentStacks,
          playerBilgewaterEffects: resolveBilgewaterStatEffects(tm.playerBilgewaterStats, items),
          enemyBilgewaterEffects: resolveBilgewaterStatEffects(tm.enemyBilgewaterStats, items),
          playerPiltoverModules: tm.playerPiltoverModules,
          enemyPiltoverModules: tm.enemyPiltoverModules,
          playerIoniaPath: tm.playerIoniaPath ?? undefined,
          enemyIoniaPath: tm.enemyIoniaPath ?? undefined,
          playerGalio: tm.playerGalio,
          enemyGalio: tm.enemyGalio,
        });
        if (r.winner === 'player') playerWins++;
        else if (r.winner === 'enemy') enemyWins++;
        else draws++;
        lastResult = r;
      }
      if (lastResult) {
        lastResult.multiSim = { playerWins, enemyWins, draws, total: N };
      }
      replay.setCombatResult(lastResult);
      setIsRunning(false);
      replay.setViewMode('replay');
      replay.setReplayTick(lastResult ? lastResult.snapshots.length - 1 : 0);
    }, 100);
  }, [tm.playerTeam, tm.enemyTeam, traits, tm.playerAugments, tm.playerAugmentStacks, tm.enemyAugments, tm.enemyAugmentStacks, tm.playerBilgewaterStats, tm.enemyBilgewaterStats, tm.playerPiltoverModules, tm.enemyPiltoverModules, tm.playerIoniaPath, tm.enemyIoniaPath, tm.playerGalio, tm.enemyGalio, items, toEightRowCoords, replay]);

  const filteredLogs = useMemo(() => {
    if (!replay.combatResult) return [];
    if (logFilter === 'all') return replay.combatResult.logs.slice(-200);
    return replay.combatResult.logs.filter(l => l.type === logFilter).slice(-200);
  }, [replay.combatResult, logFilter]);

  const multiSim = replay.combatResult?.multiSim;

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh] text-gray-500">데이터 로딩 중...</div>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={dnd.handleDragStart} onDragEnd={dnd.handleDragEnd}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base lg:text-lg font-bold text-gray-200">전투 시뮬레이션</h2>
            {replay.combatResult && (
              <div className="flex gap-1">
                <button
                  onClick={() => replay.setViewMode('setup')}
                  className={`px-2 py-1 lg:px-3 lg:py-1 rounded text-[10px] lg:text-xs font-medium transition-colors ${
                    replay.viewMode === 'setup' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400'
                  }`}
                >
                  편집
                </button>
                <button
                  onClick={() => replay.setViewMode('replay')}
                  className={`px-2 py-1 lg:px-3 lg:py-1 rounded text-[10px] lg:text-xs font-medium transition-colors ${
                    replay.viewMode === 'replay' ? 'bg-purple-600 text-white' : 'bg-[#1f2937] text-gray-400'
                  }`}
                >
                  리플레이
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-1.5 lg:gap-2 flex-wrap">
            <button
              onClick={tm.resetAll}
              className="px-2 py-1.5 lg:px-3 lg:py-2 bg-[#1f2937] text-gray-500 hover:text-red-400 rounded-lg text-[10px] lg:text-xs"
            >
              초기화
            </button>
            <button
              onClick={() => setShowTeamCode(prev => !prev)}
              className={`px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg text-[10px] lg:text-xs font-medium transition-colors ${
                showTeamCode ? 'bg-teal-600 text-white' : 'bg-[#1f2937] text-gray-400 hover:text-teal-300'
              }`}
            >
              팀 코드
            </button>
            <button
              onClick={runSimulation}
              disabled={isRunning || tm.playerTeam.length === 0 || tm.enemyTeam.length === 0}
              className="px-3 py-1.5 lg:px-4 lg:py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-xs lg:text-sm font-bold text-black transition-colors"
            >
              {isRunning ? '전투 중...' : '전투 시작'}
            </button>
            <button
              onClick={runMultiple}
              disabled={isRunning || tm.playerTeam.length === 0 || tm.enemyTeam.length === 0}
              className="px-3 py-1.5 lg:px-4 lg:py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-xs lg:text-sm font-bold text-white transition-colors"
            >
              100회
            </button>
          </div>
        </div>

        {/* Team Code Panel */}
        {showTeamCode && (
          <TeamCodePanel
            playerTeam={tm.playerTeam}
            enemyTeam={tm.enemyTeam}
            champions={champions}
            teamPlannerMapping={teamPlannerMapping}
            onImport={(team, imported) => {
              if (team === 'player') tm.updatePlayerTeam(imported);
              else tm.updateEnemyTeam(imported);
              tm.setSelectedUnit(null);
            }}
          />
        )}

        {/* ====== SETUP MODE ====== */}
        {replay.viewMode === 'setup' && (
          <>
            {/* 3-column: Synergy panels (left) | Board (center) | Champion/Item pool (right) */}
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Board (mobile: first, desktop: center) */}
              <div className="order-1 lg:order-2 lg:flex-1 lg:min-w-0">
                <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-2 lg:p-3 flex justify-center">
                  <div className="h-[320px] sm:h-[420px] lg:h-auto overflow-hidden flex justify-center">
                    <div className="transform scale-[0.5] sm:scale-[0.65] lg:scale-100 origin-top" style={{ position: 'relative', display: 'inline-block' }}>
                    <SetupBoard
                      playerChampions={tm.playerTeam}
                      enemyChampions={tm.enemyTeam}
                      onCellClick={tm.handleCellClick}
                      onUnitClick={tm.handleUnitClick}
                      onUnitRightClick={tm.handleRemoveUnit}
                      onUnitCycleStars={tm.handleCycleStars}
                      selectedCell={tm.selectedCell}
                      selectedUnit={tm.selectedUnit}
                    />
                    {/* Droppable overlay */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      {Array.from({ length: 8 }, (_, row) =>
                        Array.from({ length: BOARD_COLS }, (_, col) => {
                          const team = row < 4 ? 'enemy' : 'player';
                          const teamArr = team === 'player' ? tm.playerTeam : tm.enemyTeam;
                          const dataRow = team === 'player' ? row - 4 : row;
                          const placedIdx = teamArr.findIndex(p => {
                            const off = axialToOffset(p.position);
                            return off.row === dataRow && off.col === col;
                          });
                          const placed = placedIdx >= 0 ? teamArr[placedIdx] : null;

                          const cellClick = () => {
                            if (placed && placedIdx >= 0) {
                              tm.handleUnitClick(team, placedIdx);
                            } else {
                              const pos = offsetToAxial({ row: dataRow, col });
                              tm.handleCellClick(pos, team);
                            }
                          };
                          const cellContextMenu = (e: React.MouseEvent) => {
                            e.preventDefault();
                            if (placed && placedIdx >= 0) {
                              tm.handleRemoveUnit(team, placedIdx);
                            }
                          };

                          return (
                            <DroppableHexCell
                              key={`cell-${row}-${col}`}
                              id={`cell-${row}-${col}`}
                              row={row}
                              col={col}
                              placedUnit={placed ? { team, position: placed.position } : null}
                              onClick={cellClick}
                              onContextMenu={cellContextMenu}
                            />
                          );
                        })
                      )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Augment slots under the board */}
                <div className="mt-2 flex justify-between px-2">
                  <div>
                    <div className="text-[9px] text-red-400 font-bold mb-1">TEAM B 증강</div>
                    <AugmentSlots
                      augments={tm.enemyAugments}
                      augmentStacks={tm.enemyAugmentStacks}
                      onOpenSelector={() => tm.setShowAugmentPicker('enemy')}
                      onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'enemy' })}
                      onRemove={(i) => tm.handleRemoveAugment('enemy', i)}
                    />
                  </div>
                  <div>
                    <div className="text-[9px] text-blue-400 font-bold mb-1">TEAM A 증강</div>
                    <AugmentSlots
                      augments={tm.playerAugments}
                      augmentStacks={tm.playerAugmentStacks}
                      onOpenSelector={() => tm.setShowAugmentPicker('player')}
                      onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'player' })}
                      onRemove={(i) => tm.handleRemoveAugment('player', i)}
                    />
                  </div>
                </div>
              </div>

              {/* Selected Unit Panel (mobile: below board, desktop: hidden here - shown in left column) */}
              {tm.selectedUnit && tm.selectedPlaced && (
                <div className="order-2 lg:hidden">
                  <SelectedUnitPanel
                    placed={tm.selectedPlaced}
                    team={tm.selectedUnit.team}
                    allItems={items}
                    activeTraits={tm.selectedUnit.team === 'player' ? tm.playerTraits : tm.enemyTraits}
                    onStarChange={(level) => tm.handleStarChange(tm.selectedUnit!.team, tm.selectedUnit!.index, level)}
                    onEquipItem={(item) => tm.handleEquipItem(tm.selectedUnit!.team, tm.selectedUnit!.index, item)}
                    onRemoveItem={(itemIdx) => tm.handleRemoveItem(tm.selectedUnit!.team, tm.selectedUnit!.index, itemIdx)}
                    onRemoveVoidItem={() => tm.handleRemoveVoidItem(tm.selectedUnit!.team, tm.selectedUnit!.index)}
                    onRemoveUnit={() => tm.handleRemoveUnit(tm.selectedUnit!.team, tm.selectedUnit!.index)}
                    onMfModeChange={(mode) => tm.handleMfModeChange(tm.selectedUnit!.team, tm.selectedUnit!.index, mode)}
                    onPermanentStackChange={(value) => tm.handlePermanentStackChange(tm.selectedUnit!.team, tm.selectedUnit!.index, value)}
                  />
                </div>
              )}

              {/* Left: Both Synergy panels + Selected unit (desktop) */}
              <div className="order-3 lg:order-1 lg:w-52 lg:shrink-0 space-y-3">
                <SynergyPanel activeTraits={tm.enemyTraits} team="enemy" items={items} piltoverModules={tm.enemyPiltoverModules} bilgewaterStats={tm.enemyBilgewaterStats} ioniaPath={tm.enemyIoniaPath} onIoniaPathChange={tm.setEnemyIoniaPath} />
                <PiltoverModulePanel
                  modules={tm.enemyPiltoverModules}
                  allItems={items}
                  activeTraits={tm.enemyTraits}
                  onAddModule={(item) => tm.handleAddPiltoverModule('enemy', item)}
                  onRemoveModule={(idx) => tm.handleRemovePiltoverModule('enemy', idx)}
                />
                <SynergyPanel activeTraits={tm.playerTraits} team="player" items={items} piltoverModules={tm.playerPiltoverModules} bilgewaterStats={tm.playerBilgewaterStats} ioniaPath={tm.playerIoniaPath} onIoniaPathChange={tm.setPlayerIoniaPath} />
                <PiltoverModulePanel
                  modules={tm.playerPiltoverModules}
                  allItems={items}
                  activeTraits={tm.playerTraits}
                  onAddModule={(item) => tm.handleAddPiltoverModule('player', item)}
                  onRemoveModule={(idx) => tm.handleRemovePiltoverModule('player', idx)}
                />
                {tm.selectedUnit && tm.selectedPlaced && (
                  <div className="hidden lg:block">
                    <SelectedUnitPanel
                      placed={tm.selectedPlaced}
                      team={tm.selectedUnit.team}
                      allItems={items}
                      activeTraits={tm.selectedUnit.team === 'player' ? tm.playerTraits : tm.enemyTraits}
                      onStarChange={(level) => tm.handleStarChange(tm.selectedUnit!.team, tm.selectedUnit!.index, level)}
                      onEquipItem={(item) => tm.handleEquipItem(tm.selectedUnit!.team, tm.selectedUnit!.index, item)}
                      onRemoveItem={(itemIdx) => tm.handleRemoveItem(tm.selectedUnit!.team, tm.selectedUnit!.index, itemIdx)}
                      onRemoveVoidItem={() => tm.handleRemoveVoidItem(tm.selectedUnit!.team, tm.selectedUnit!.index)}
                      onRemoveUnit={() => tm.handleRemoveUnit(tm.selectedUnit!.team, tm.selectedUnit!.index)}
                      onMfModeChange={(mode) => tm.handleMfModeChange(tm.selectedUnit!.team, tm.selectedUnit!.index, mode)}
                      onPermanentStackChange={(value) => tm.handlePermanentStackChange(tm.selectedUnit!.team, tm.selectedUnit!.index, value)}
                    />
                  </div>
                )}
              </div>

              {/* Right: Champion/Item pool */}
              <div className="order-4 lg:order-3 w-full lg:w-64 lg:shrink-0 bg-[#111827] rounded-xl border border-gray-800 p-3 flex flex-col lg:self-start max-h-[50vh] lg:max-h-[calc(100vh-120px)]">
                <div className="flex gap-2 mb-3 shrink-0 flex-wrap">
                  <button
                    onClick={() => setActivePoolTab('champions')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      activePoolTab === 'champions' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400'
                    }`}
                  >
                    챔피언
                  </button>
                  <button
                    onClick={() => setActivePoolTab('items')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      activePoolTab === 'items' ? 'bg-yellow-600 text-white' : 'bg-[#1f2937] text-gray-400'
                    }`}
                  >
                    아이템
                  </button>
                  {(tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0) ||
                    tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0)) && (
                    <button
                      onClick={() => setActivePoolTab('bilgewater')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        activePoolTab === 'bilgewater' ? 'bg-teal-600 text-white' : 'bg-[#1f2937] text-gray-400'
                      }`}
                    >
                      빌지워터
                    </button>
                  )}
                </div>

                {activePoolTab === 'champions' && (
                  <div className="flex flex-col min-h-0 flex-1 gap-2">
                    <div className="shrink-0">
                      <SearchBar value={champSearch} onChange={setChampSearch} placeholder="챔피언/특성 검색..." />
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${champCostFilter === null ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
                        onClick={() => setChampCostFilter(null)}
                      >
                        전체
                      </button>
                      {[1, 2, 3, 4, 5].map(cost => (
                        <button
                          key={cost}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${champCostFilter === cost ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
                          onClick={() => setChampCostFilter(champCostFilter === cost ? null : cost)}
                        >
                          {cost}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 overflow-y-auto min-h-0 p-1">
                      {filteredChampions.map(c => (
                        <DraggableChampionCard key={c.apiName} champion={c} size={44} />
                      ))}
                    </div>
                  </div>
                )}

                {activePoolTab === 'items' && (
                  <div className="flex flex-col min-h-0 flex-1 gap-2">
                    <div className="shrink-0">
                      <SearchBar value={itemSearch} onChange={setItemSearch} placeholder="아이템 검색..." />
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {([
                        { key: 'all' as ItemFilterTab, label: '전체' },
                        { key: 'combined' as ItemFilterTab, label: '완성' },
                        { key: 'artifact' as ItemFilterTab, label: '유물' },
                        { key: 'radiant' as ItemFilterTab, label: '찬란' },
                        { key: 'emblem' as ItemFilterTab, label: '상징' },
                      ]).map(({ key, label }) => (
                        <button
                          key={key}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${itemCategoryFilter === key ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-400'}`}
                          onClick={() => setItemCategoryFilter(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 overflow-y-auto min-h-0 p-1">
                      {items.filter(item => {
                        if (isDisabledItem(item)) return false;
                        const cat = getItemCategory(item);
                        if (cat === 'piltover' || cat === 'special' || cat === 'bilgewater') return false;
                        if (cat === 'void') {
                          const voidTrait = tm.playerTraits.find(t => t.trait.apiName === 'TFT16_Void')
                            ?? tm.enemyTraits.find(t => t.trait.apiName === 'TFT16_Void');
                          if (!voidTrait || !voidTrait.activeEffect) return false;
                        }
                        if (itemSearch && !item.name.toLowerCase().includes(itemSearch.toLowerCase())) return false;
                        if (itemCategoryFilter !== 'all') {
                          if (cat === 'void' || cat === 'darkin') {
                            if (itemCategoryFilter !== 'combined') return false;
                          } else if (cat !== itemCategoryFilter) return false;
                        }
                        return true;
                      }).map(item => (
                        <DraggableItemIcon key={item.apiName} item={item} size={32} />
                      ))}
                    </div>
                  </div>
                )}

                {activePoolTab === 'bilgewater' && (
                  <div className="flex flex-col min-h-0 flex-1 gap-2">
                    <div className="text-[10px] font-bold text-teal-400 shrink-0">능력치 (클릭으로 구매 — 빌지워터 챔피언 전체 적용)</div>
                    <div className="grid grid-cols-6 gap-1.5 overflow-y-auto min-h-0 p-1">
                      {items.filter(item => isBilgewaterStatItem(item.apiName)).map(item => {
                        const playerCount = tm.playerBilgewaterStats[item.apiName] ?? 0;
                        const enemyCount = tm.enemyBilgewaterStats[item.apiName] ?? 0;
                        const totalCount = playerCount + enemyCount;
                        return (
                          <div
                            key={item.apiName}
                            className="relative"
                            onContextMenu={(e) => {
                              e.preventDefault();
                              const hasBWPlayer = tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
                              const hasBWEnemy = tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
                              if (hasBWPlayer && playerCount > 0) tm.handleRemoveBilgewaterStat('player', item.apiName);
                              else if (hasBWEnemy && enemyCount > 0) tm.handleRemoveBilgewaterStat('enemy', item.apiName);
                            }}
                          >
                            <ItemIcon
                              item={item}
                              size={32}
                              onClick={() => {
                                const hasBWPlayer = tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
                                const hasBWEnemy = tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
                                if (hasBWPlayer) tm.handleBuyBilgewaterStat('player', item);
                                else if (hasBWEnemy) tm.handleBuyBilgewaterStat('enemy', item);
                              }}
                            />
                            {totalCount > 0 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-600 rounded-full text-[8px] text-white flex items-center justify-center font-bold pointer-events-none">
                                {totalCount}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[10px] font-bold text-teal-400 shrink-0 mt-2">장비 아이템 (드래그로 장착)</div>
                    <div className="grid grid-cols-6 gap-1.5 overflow-y-auto min-h-0 p-1">
                      {items.filter(item => {
                        if (!item.apiName.includes('TFT16_Item_Bilgewater_')) return false;
                        if (isBilgewaterStatItem(item.apiName)) return false;
                        if (Object.keys(item.effects).length === 0) return false;
                        return true;
                      }).map(item => (
                        <DraggableItemIcon key={item.apiName} item={item} size={32} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ====== REPLAY MODE ====== */}
        {replay.viewMode === 'replay' && replay.combatResult && (
          <>
            {/* Winner banner */}
            <div className={`text-center p-4 rounded-xl border ${
              replay.combatResult.winner === 'player' ? 'bg-blue-600/10 border-blue-600/30' :
              replay.combatResult.winner === 'enemy' ? 'bg-red-600/10 border-red-600/30' :
              'bg-gray-600/10 border-gray-600/30'
            }`}>
              <div className="text-2xl font-black">
                {replay.combatResult.winner === 'player' ? 'TEAM A 승리!' :
                 replay.combatResult.winner === 'enemy' ? 'TEAM B 승리!' : '무승부'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                전투 시간: {replay.combatResult.duration.toFixed(1)}초
              </div>
              {multiSim && (
                <div className="mt-2 flex gap-4 justify-center text-xs">
                  <span className="text-blue-400">A 승: {multiSim.playerWins}회 ({(multiSim.playerWins / multiSim.total * 100).toFixed(1)}%)</span>
                  <span className="text-red-400">B 승: {multiSim.enemyWins}회 ({(multiSim.enemyWins / multiSim.total * 100).toFixed(1)}%)</span>
                  <span className="text-gray-400">무승부: {multiSim.draws}회</span>
                </div>
              )}
            </div>

            {/* Battle Controls */}
            <BattleControls
              currentTick={replay.replayTick}
              totalTicks={replay.combatResult.snapshots.length}
              playbackSpeed={replay.playbackSpeed}
              isPlaying={replay.isPlaying}
              onPlay={() => replay.setIsPlaying(true)}
              onPause={() => replay.setIsPlaying(false)}
              onStepForward={() => replay.setReplayTick(prev => Math.min(prev + 1, replay.combatResult!.snapshots.length - 1))}
              onStepBack={() => replay.setReplayTick(prev => Math.max(prev - 1, 0))}
              onSeek={replay.setReplayTick}
              onSpeedChange={replay.setPlaybackSpeed}
              ticksPerSecond={TICKS_PER_SECOND}
            />

            {/* Replay Board + Damage Sidebar */}
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
              {/* Board */}
              <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-2 lg:p-3 flex justify-center flex-1 min-w-0">
                <div className="h-[310px] sm:h-[420px] lg:h-auto overflow-hidden">
                  <div className="transform scale-[0.48] sm:scale-[0.65] lg:scale-100 origin-top">
                    <ReplayBoard
                      snapshot={replay.currentSnapshot}
                      unitMeta={replay.unitMeta}
                      selectedUnitId={replay.selectedUnitId}
                      onUnitClick={replay.setSelectedUnitId}
                    />
                  </div>
                </div>
              </div>

              {/* Damage Sidebar */}
              <DamageSidebar
                combatResult={replay.combatResult}
                currentSnapshot={replay.currentSnapshot}
                selectedUnitId={replay.selectedUnitId}
                onUnitClick={replay.setSelectedUnitId}
              />
            </div>

            {/* Unit Detail Panel — 챔피언 클릭 시 보드 하단에 표시 */}
            {replay.selectedUnitId && replay.selectedUnitSnap && replay.unitMeta[replay.selectedUnitId] && (
              <UnitDetailPanel
                unitSnapshot={replay.selectedUnitSnap}
                meta={replay.unitMeta[replay.selectedUnitId]}
                onClose={() => replay.setSelectedUnitId(null)}
              />
            )}

            {/* Tick events */}
            {replay.tickEvents.length > 0 && (
              <div className="bg-[#111827] rounded-lg border border-gray-800 p-2">
                <div className="text-[10px] font-bold text-gray-500 mb-1">현재 틱 이벤트</div>
                <div className="space-y-0.5 font-mono text-[10px] max-h-[80px] overflow-y-auto">
                  {replay.tickEvents.map((e, i) => (
                    <div key={i} className={
                      e.type === 'death' ? 'text-red-400' :
                      e.type === 'ability' ? 'text-purple-400' :
                      e.type === 'move' ? 'text-gray-600' : 'text-gray-400'
                    }>
                      {e.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full battle log */}
            <div className="p-4 bg-[#111827] rounded-xl border border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-bold text-gray-300">전투 로그</h4>
                <div className="flex gap-1 ml-auto">
                  {(['all', 'attack', 'ability', 'death', 'move'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setLogFilter(f)}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        logFilter === f ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-500'
                      }`}
                    >
                      {f === 'all' ? '전체' : f === 'attack' ? '공격' : f === 'ability' ? '스킬' : f === 'death' ? '사망' : '이동'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-0.5 font-mono text-xs">
                {filteredLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`py-0.5 px-2 rounded ${
                      log.type === 'death' ? 'bg-red-900/20 text-red-400' :
                      log.type === 'ability' ? 'text-purple-400' :
                      log.type === 'move' ? 'text-gray-500' :
                      'text-gray-400'
                    }`}
                  >
                    <span className="text-gray-600 mr-2">[{log.time.toFixed(1)}s]</span>
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ====== SETUP MODE: show last result summary ====== */}
        {replay.viewMode === 'setup' && replay.combatResult && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-[#111827] rounded-lg border border-gray-800">
              <h4 className="text-xs font-bold text-blue-400 mb-2">TEAM A 유닛</h4>
              {replay.combatResult.playerUnits.map((u) => (
                <div key={u.id} className={`flex items-center gap-2 py-1 ${u.state === 'dead' ? 'opacity-40' : ''}`}>
                  <span className="text-xs text-gray-300 flex-1">{u.champion.name}</span>
                  <span className="text-xs text-green-400">{Math.round(u.currentHp)}/{Math.round(u.maxHp)}</span>
                  <span className="text-xs text-red-400">{Math.round(u.totalDamageDealt)} dmg</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-[#111827] rounded-lg border border-gray-800">
              <h4 className="text-xs font-bold text-red-400 mb-2">TEAM B 유닛</h4>
              {replay.combatResult.enemyUnits.map((u) => (
                <div key={u.id} className={`flex items-center gap-2 py-1 ${u.state === 'dead' ? 'opacity-40' : ''}`}>
                  <span className="text-xs text-gray-300 flex-1">{u.champion.name}</span>
                  <span className="text-xs text-green-400">{Math.round(u.currentHp)}/{Math.round(u.maxHp)}</span>
                  <span className="text-xs text-red-400">{Math.round(u.totalDamageDealt)} dmg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MF mode selection popup */}
        <MfModeSelector
          isOpen={tm.pendingMfPlacement !== null}
          onSelect={(mode) => {
            if (tm.pendingMfPlacement) {
              tm.handleMfModeChange(tm.pendingMfPlacement.team, tm.pendingMfPlacement.index, mode);
            }
          }}
          onClose={() => tm.setPendingMfPlacement(null)}
        />

        {/* Champion picker modal (for cell click) */}
        <Modal isOpen={tm.showPicker} onClose={() => tm.setShowPicker(false)} title="챔피언 선택">
          <ChampionGrid champions={champions} onSelect={tm.handleChampionSelect} />
        </Modal>

        {/* Augment picker modal */}
        <Modal isOpen={tm.showAugmentPicker !== null} onClose={() => tm.setShowAugmentPicker(null)} title="증강 선택">
          {tm.showAugmentPicker && (
            <AugmentSelector
              augments={augments}
              onSelect={(aug) => tm.handleAddAugment(tm.showAugmentPicker!, aug)}
              selectedApiNames={[...tm.playerAugments, ...tm.enemyAugments].map(a => a.apiName)}
            />
          )}
        </Modal>

        {/* Augment detail popup */}
        <AugmentDetailPopup
          augment={tm.augmentDetailTarget?.aug ?? null}
          stacks={tm.augmentDetailTarget ? (tm.augmentDetailTarget.team === 'player' ? tm.playerAugmentStacks : tm.enemyAugmentStacks)[tm.augmentDetailTarget.aug.apiName] ?? 1 : 1}
          onStacksChange={(count) => {
            if (tm.augmentDetailTarget) {
              tm.handleAugmentStacksChange(tm.augmentDetailTarget.team, tm.augmentDetailTarget.aug.apiName, count);
            }
          }}
          onClose={() => tm.setAugmentDetailTarget(null)}
        />

        {/* DragOverlay */}
        <DragOverlay>
          {dnd.activeDragData?.type === 'champion' && (
            <div style={{ opacity: 0.7 }}>
              <ChampionCard champion={dnd.activeDragData.champion} size={48} showName={false} />
            </div>
          )}
          {dnd.activeDragData?.type === 'placed-unit' && (() => {
            const dragData = dnd.activeDragData;
            const teamArr = dragData.team === 'player' ? tm.playerTeam : tm.enemyTeam;
            const placed = teamArr.find(p => p.position.q === dragData.position.q && p.position.r === dragData.position.r);
            if (!placed) return null;
            return (
              <div style={{ opacity: 0.7 }}>
                <ChampionCard champion={placed.champion} size={48} showName={false} starLevel={placed.starLevel} />
              </div>
            );
          })()}
          {dnd.activeDragData?.type === 'item' && (
            <div style={{ opacity: 0.7 }}>
              <ItemIcon item={dnd.activeDragData.item} size={32} showTooltip={false} />
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
