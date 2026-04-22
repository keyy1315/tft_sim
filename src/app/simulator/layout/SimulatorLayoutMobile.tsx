'use client';

import { MouseEvent, ReactNode, useCallback, useState } from 'react';
import SetupBoard from '@/components/battle/SetupBoard';
import ReplayBoard from '@/components/battle/ReplayBoard';
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import BattleControls from '@/components/battle/BattleControls';
import SynergyChip from '@/components/builder/SynergyChip';
import SelectedUnitPanel from '@/components/builder/SelectedUnitPanel';
import SynergyPanel from '@/components/builder/SynergyPanel';
import PiltoverModulePanel from '@/components/builder/PiltoverModulePanel';
import AugmentSlots from '@/components/builder/AugmentSlots';
import BottomSheet from '@/components/ui/BottomSheet';
import OverflowMenu from '@/components/ui/OverflowMenu';
import { BottomSheetState } from '@/components/ui/bottomSheetLogic';
import { BOARD_COLS, TICKS_PER_SECOND } from '@/lib/simulator/models/constants';
import { axialToOffset, offsetToAxial } from '@/types';
import type { SimulatorLayoutProps } from './types';
import ChampionPoolContent from './pool/ChampionPoolContent';
import ItemPoolContent from './pool/ItemPoolContent';
import BilgewaterPoolContent from './pool/BilgewaterPoolContent';

const MOBILE_CELL_SIZE = 36;

type MobileTabId = 'pool' | 'unit' | 'synergy' | 'log' | 'damage';

interface MobileTab {
  id: MobileTabId;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export default function SimulatorLayoutMobile(props: SimulatorLayoutProps) {
  const { tm, replay, hexBuffs, teamNames } = props;

  const [sheetState, setSheetState] = useState<BottomSheetState>('peek');
  const [activeTabId, setActiveTabId] = useState<MobileTabId>(
    replay.viewMode === 'replay' ? 'log' : 'pool',
  );

  const playerLabel = teamNames.player ?? 'TEAM A';
  const enemyLabel = teamNames.enemy ?? 'TEAM B';

  const onUnitClickWithSheet = useCallback(
    (team: 'player' | 'enemy', index: number) => {
      tm.handleUnitClick(team, index);
      setActiveTabId('unit');
      setSheetState('half');
    },
    [tm],
  );

  const setupTabs: MobileTab[] = [
    { id: 'pool', label: '풀', content: <PoolContentRouter {...props} /> },
    {
      id: 'unit',
      label: '유닛',
      content: tm.selectedUnit && tm.selectedPlaced ? (
        <SelectedUnitPanel
          placed={tm.selectedPlaced}
          team={tm.selectedUnit.team}
          allItems={props.data.items}
          activeTraits={tm.selectedUnit.team === 'player' ? tm.playerTraits : tm.enemyTraits}
          onStarChange={(l) => tm.handleStarChange(tm.selectedUnit!.team, tm.selectedUnit!.index, l)}
          onEquipItem={(i) => tm.handleEquipItem(tm.selectedUnit!.team, tm.selectedUnit!.index, i)}
          onRemoveItem={(i) => tm.handleRemoveItem(tm.selectedUnit!.team, tm.selectedUnit!.index, i)}
          onRemoveVoidItem={() => tm.handleRemoveVoidItem(tm.selectedUnit!.team, tm.selectedUnit!.index)}
          onRemoveUnit={() => tm.handleRemoveUnit(tm.selectedUnit!.team, tm.selectedUnit!.index)}
          onMfModeChange={(m) => tm.handleMfModeChange(tm.selectedUnit!.team, tm.selectedUnit!.index, m)}
          onPermanentStackChange={(v) => tm.handlePermanentStackChange(tm.selectedUnit!.team, tm.selectedUnit!.index, v)}
        />
      ) : (
        <div className="text-center text-xs text-gray-500 py-6">보드의 유닛을 선택하세요</div>
      ),
    },
    {
      id: 'synergy',
      label: '시너지',
      content: (
        <div className="space-y-3">
          <SynergyPanel
            activeTraits={tm.enemyTraits}
            team="enemy"
            items={props.data.items}
            champions={props.data.champions}
            piltoverModules={tm.enemyPiltoverModules}
            bilgewaterStats={tm.enemyBilgewaterStats}
            ioniaPath={tm.enemyIoniaPath}
            onIoniaPathChange={tm.setEnemyIoniaPath}
            arbiterLaw={tm.enemyArbiterLaw}
            onArbiterLawChange={tm.setEnemyArbiterLaw}
          />
          <PiltoverModulePanel
            modules={tm.enemyPiltoverModules}
            allItems={props.data.items}
            activeTraits={tm.enemyTraits}
            onAddModule={(i) => tm.handleAddPiltoverModule('enemy', i)}
            onRemoveModule={(i) => tm.handleRemovePiltoverModule('enemy', i)}
          />
          <SynergyPanel
            activeTraits={tm.playerTraits}
            team="player"
            items={props.data.items}
            champions={props.data.champions}
            piltoverModules={tm.playerPiltoverModules}
            bilgewaterStats={tm.playerBilgewaterStats}
            ioniaPath={tm.playerIoniaPath}
            onIoniaPathChange={tm.setPlayerIoniaPath}
            arbiterLaw={tm.playerArbiterLaw}
            onArbiterLawChange={tm.setPlayerArbiterLaw}
          />
          <PiltoverModulePanel
            modules={tm.playerPiltoverModules}
            allItems={props.data.items}
            activeTraits={tm.playerTraits}
            onAddModule={(i) => tm.handleAddPiltoverModule('player', i)}
            onRemoveModule={(i) => tm.handleRemovePiltoverModule('player', i)}
          />
        </div>
      ),
    },
  ];

  const replayTabs: MobileTab[] = [
    { id: 'log', label: '로그', content: <ReplayLogTab {...props} /> },
    { id: 'damage', label: '데미지', content: <ReplayDamageTab {...props} /> },
    {
      id: 'unit',
      label: '유닛',
      disabled: !replay.selectedUnitId,
      content: <ReplayUnitDetailTab {...props} />,
    },
  ];

  const tabs = replay.viewMode === 'setup' ? setupTabs : replayTabs;

  return (
    <div className="space-y-2">
      <MobileHeader {...props} />

      {/* Board */}
      <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-2 overflow-x-auto">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {replay.viewMode === 'setup' && (
            <>
              <SetupBoard
                playerChampions={tm.playerTeam}
                enemyChampions={tm.enemyTeam}
                onCellClick={tm.handleCellClick}
                onUnitClick={onUnitClickWithSheet}
                onUnitRightClick={tm.handleRemoveUnit}
                onUnitCycleStars={tm.handleCycleStars}
                selectedCell={tm.selectedCell}
                selectedUnit={tm.selectedUnit}
                playerHexBuffs={hexBuffs.player}
                enemyHexBuffs={hexBuffs.enemy}
                movingHexBuffApiName={hexBuffs.moving?.apiName}
                cellSize={MOBILE_CELL_SIZE}
              />
              <MobileDroppableOverlay
                {...props}
                cellSize={MOBILE_CELL_SIZE}
                onUnitClick={onUnitClickWithSheet}
              />
            </>
          )}
          {replay.viewMode === 'replay' && replay.combatResult && (
            <ReplayBoard
              snapshot={replay.currentSnapshot}
              unitMeta={replay.unitMeta}
              selectedUnitId={replay.selectedUnitId}
              onUnitClick={(id) => {
                replay.setSelectedUnitId(id);
                if (id) {
                  setActiveTabId('unit');
                  setSheetState('half');
                }
              }}
              cellSize={MOBILE_CELL_SIZE}
            />
          )}
        </div>
      </div>

      {/* Synergy chips (setup mode only) */}
      {replay.viewMode === 'setup' && (
        <div className="flex gap-2">
          <SynergyChip
            team="enemy"
            teamLabel={enemyLabel}
            activeTraits={tm.enemyTraits}
            onExpand={() => {
              setActiveTabId('synergy');
              setSheetState('full');
            }}
          />
          <SynergyChip
            team="player"
            teamLabel={playerLabel}
            activeTraits={tm.playerTraits}
            onExpand={() => {
              setActiveTabId('synergy');
              setSheetState('full');
            }}
          />
        </div>
      )}

      {/* Augment row (setup mode only) */}
      {replay.viewMode === 'setup' && <MobileAugmentRow {...props} />}

      {/* Battle controls (replay mode only) */}
      {replay.viewMode === 'replay' && replay.combatResult && (
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
      )}

      {/* Bottom sheet */}
      <BottomSheet
        state={sheetState}
        onStateChange={setSheetState}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={(id) => setActiveTabId(id as MobileTabId)}
      />
    </div>
  );
}

// --- Placeholder helpers (Tasks 4.3–4.5 replace these) -----------------------

function MobileHeader({
  tm, replay, isRunning, runSimulation, runMultiple,
  stageNumber, setStageNumber, showTeamCode, setShowTeamCode,
}: SimulatorLayoutProps) {
  const canRun = !isRunning && tm.playerTeam.length > 0 && tm.enemyTeam.length > 0;
  const overflowItems = [
    { label: '초기화', onClick: tm.resetAll },
    {
      label: showTeamCode ? '팀 코드 닫기' : '팀 코드 열기',
      onClick: () => setShowTeamCode(v => !v),
      active: showTeamCode,
    },
    { label: '100회 시뮬', onClick: runMultiple, disabled: !canRun },
    {
      label: replay.viewMode === 'setup' ? '리플레이 보기' : '편집으로',
      onClick: () => replay.setViewMode(replay.viewMode === 'setup' ? 'replay' : 'setup'),
      disabled: !replay.combatResult,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-bold text-gray-200 flex-1 truncate">전투 시뮬레이션</h2>
      <button
        onClick={runSimulation}
        disabled={!canRun}
        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-xs font-bold text-black transition-colors"
      >
        {isRunning ? '전투 중...' : '▶ 시작'}
      </button>
      <OverflowMenu items={overflowItems} ariaLabel="more simulator options">
        <div>
          <label className="text-[10px] text-gray-400 block mb-1">Stage</label>
          <select
            value={stageNumber}
            onChange={(e) => setStageNumber(Number(e.target.value))}
            className="w-full bg-[#1f2937] text-gray-300 text-xs rounded px-2 py-1 border border-gray-600"
          >
            {[1, 2, 3, 4, 5, 6, 7].map(s => (
              <option key={s} value={s}>Stage {s}</option>
            ))}
          </select>
        </div>
      </OverflowMenu>
    </div>
  );
}

interface MobileOverlayExtra {
  cellSize: number;
  onUnitClick: (team: 'player' | 'enemy', index: number) => void;
}

function MobileDroppableOverlay({
  tm, hexBuffs, setHoverUnit, cellSize, onUnitClick,
}: SimulatorLayoutProps & MobileOverlayExtra) {
  const { playerTeam, enemyTeam } = tm;
  const { player: playerHexBuffs, enemy: enemyHexBuffs, moving, setMoving, setOverrides } = hexBuffs;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: BOARD_COLS }, (_, col) => {
          const team = row < 4 ? 'enemy' : 'player';
          const teamArr = team === 'player' ? playerTeam : enemyTeam;
          const dataRow = team === 'player' ? row - 4 : row;
          const placedIdx = teamArr.findIndex(p => {
            const off = axialToOffset(p.position);
            return off.row === dataRow && off.col === col;
          });
          const placed = placedIdx >= 0 ? teamArr[placedIdx] : null;

          const cellClick = () => {
            if (moving) {
              const pos = offsetToAxial({ row: dataRow, col });
              setOverrides(prev => ({
                ...prev,
                [moving.team]: { ...prev[moving.team], [moving.apiName]: pos },
              }));
              setMoving(null);
              return;
            }
            const buffs = team === 'player' ? playerHexBuffs : enemyHexBuffs;
            const movableBuff = buffs.find(b => b.movable && b.positions.some(p => {
              const off = axialToOffset(p);
              return off.row === dataRow && off.col === col;
            }));
            if (movableBuff && !placed) {
              setMoving({ team, apiName: movableBuff.augmentApiName });
              return;
            }
            if (placed && placedIdx >= 0) onUnitClick(team, placedIdx);
            else tm.handleCellClick(offsetToAxial({ row: dataRow, col }), team);
          };

          const cellContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            if (placed && placedIdx >= 0) tm.handleRemoveUnit(team, placedIdx);
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
              onMouseEnter={placed ? (rect) => setHoverUnit({ placed, rect }) : undefined}
              onMouseLeave={() => setHoverUnit(null)}
              cellSize={cellSize}
            />
          );
        })
      )}
    </div>
  );
}

function MobileAugmentRow({ tm, teamNames }: SimulatorLayoutProps) {
  const playerLabel = teamNames.player ?? 'TEAM A';
  const enemyLabel = teamNames.enemy ?? 'TEAM B';
  return (
    <div className="flex justify-between px-2 gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-red-400 font-bold mb-1 truncate">{enemyLabel} 증강</div>
        <AugmentSlots
          augments={tm.enemyAugments}
          augmentStacks={tm.enemyAugmentStacks}
          onOpenSelector={() => tm.setShowAugmentPicker('enemy')}
          onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'enemy' })}
          onRemove={(i) => tm.handleRemoveAugment('enemy', i)}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-blue-400 font-bold mb-1 truncate">{playerLabel} 증강</div>
        <AugmentSlots
          augments={tm.playerAugments}
          augmentStacks={tm.playerAugmentStacks}
          onOpenSelector={() => tm.setShowAugmentPicker('player')}
          onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'player' })}
          onRemove={(i) => tm.handleRemoveAugment('player', i)}
        />
      </div>
    </div>
  );
}

function PoolContentRouter(props: SimulatorLayoutProps) {
  const { poolFilters, tm } = props;
  const bwPlayerActive = tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const bwEnemyActive = tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const showBilgewaterTab = bwPlayerActive || bwEnemyActive;

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => poolFilters.setActivePoolTab('champions')}
          className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'champions' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}
        >
          챔피언
        </button>
        <button
          onClick={() => poolFilters.setActivePoolTab('items')}
          className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'items' ? 'bg-yellow-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}
        >
          아이템
        </button>
        {showBilgewaterTab && (
          <button
            onClick={() => poolFilters.setActivePoolTab('bilgewater')}
            className={`px-3 py-1 rounded text-xs font-medium ${poolFilters.activePoolTab === 'bilgewater' ? 'bg-teal-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}
          >
            빌지워터
          </button>
        )}
      </div>
      {poolFilters.activePoolTab === 'champions' && <ChampionPoolContent {...props} />}
      {poolFilters.activePoolTab === 'items' && <ItemPoolContent {...props} />}
      {poolFilters.activePoolTab === 'bilgewater' && showBilgewaterTab && <BilgewaterPoolContent {...props} />}
    </div>
  );
}

function ReplayLogTab(_props: SimulatorLayoutProps) {
  return <div className="text-xs text-gray-500">Log placeholder</div>;
}

function ReplayDamageTab(_props: SimulatorLayoutProps) {
  return <div className="text-xs text-gray-500">Damage placeholder</div>;
}

function ReplayUnitDetailTab(_props: SimulatorLayoutProps) {
  return <div className="text-center text-xs text-gray-500 py-6">보드의 유닛을 선택하세요</div>;
}
