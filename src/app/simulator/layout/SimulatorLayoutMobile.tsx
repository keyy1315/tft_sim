'use client';

import { ReactNode, useCallback, useState } from 'react';
import SetupBoard from '@/components/battle/SetupBoard';
import ReplayBoard from '@/components/battle/ReplayBoard';
import BattleControls from '@/components/battle/BattleControls';
import SynergyChip from '@/components/builder/SynergyChip';
import SelectedUnitPanel from '@/components/builder/SelectedUnitPanel';
import SynergyPanel from '@/components/builder/SynergyPanel';
import PiltoverModulePanel from '@/components/builder/PiltoverModulePanel';
import BottomSheet from '@/components/ui/BottomSheet';
import OverflowMenu from '@/components/ui/OverflowMenu';
import { BottomSheetState } from '@/components/ui/bottomSheetLogic';
import { TICKS_PER_SECOND } from '@/lib/simulator/models/constants';
import type { SimulatorLayoutProps } from './types';

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

function MobileDroppableOverlay(_props: SimulatorLayoutProps & MobileOverlayExtra) {
  return null;
}

function MobileAugmentRow(_props: SimulatorLayoutProps) {
  return null;
}

function PoolContentRouter(_props: SimulatorLayoutProps) {
  return <div className="text-xs text-gray-500">Pool placeholder</div>;
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
