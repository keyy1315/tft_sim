'use client';

import { useCallback, useMemo, useState } from 'react';
import SetupBoard from '@/components/battle/SetupBoard';
import ReplayBoard from '@/components/battle/ReplayBoard';
import BattleControls from '@/components/battle/BattleControls';
import DamageSidebar from '@/components/battle/DamageSidebar';
import UnitDetailPanel from '@/components/battle/UnitDetailPanel';
import AugmentSlots from '@/components/builder/AugmentSlots';
import SynergyPanel from '@/components/builder/SynergyPanel';
import PiltoverModulePanel from '@/components/builder/PiltoverModulePanel';
import SelectedUnitPanel from '@/components/builder/SelectedUnitPanel';
import TeamCodePanel from '@/components/builder/TeamCodePanel';
import { TICKS_PER_SECOND } from '@/lib/simulator/models/constants';
import { resolveBilgewaterStatEffects } from '@/lib/simulator/systems/stat';
import { useWindowWidth } from '@/hooks/useViewport';
import type { SimulatorLayoutProps } from './types';
import DroppableOverlay from './shared/DroppableOverlay';
import ChampionPoolContent from './pool/ChampionPoolContent';
import ItemPoolContent from './pool/ItemPoolContent';
import BilgewaterPoolContent from './pool/BilgewaterPoolContent';

type TabletSideTab = 'pool' | 'synergy' | 'unit';

/**
 * 태블릿 뷰포트(768~1023px)에서 2-column grid 의 left(보드) 폭을 기준으로 cellSize 계산.
 * grid-cols-[2fr_1fr] + gap-3 + 전체 px-N 고려. 28~48 범위로 제한.
 */
function computeTabletCellSize(viewportWidth: number): number {
  const leftColWidth = (viewportWidth * 2) / 3 - 60;
  const candidate = Math.floor((leftColWidth - 75) / (7.5 * Math.sqrt(3)));
  return Math.max(28, Math.min(48, candidate));
}

export default function SimulatorLayoutTablet(props: SimulatorLayoutProps) {
  const {
    tm, replay, hexBuffs, setHoverUnit, setShowTeamCode, showTeamCode,
    runSimulation, runMultiple, stageNumber, setStageNumber, isRunning,
    teamNames, data,
  } = props;

  const windowWidth = useWindowWidth();
  const cellSize = computeTabletCellSize(windowWidth);

  const [sideTab, setSideTab] = useState<TabletSideTab>('pool');

  const playerLabel = teamNames.player ?? 'TEAM A';
  const enemyLabel = teamNames.enemy ?? 'TEAM B';

  const onUnitClickWithTab = useCallback((team: 'player' | 'enemy', index: number) => {
    tm.handleUnitClick(team, index);
    setSideTab('unit');
  }, [tm]);

  const canRun = !isRunning && tm.playerTeam.length > 0 && tm.enemyTeam.length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-gray-200">전투 시뮬레이션</h2>
          {replay.combatResult && (
            <div className="flex gap-1">
              <button
                onClick={() => replay.setViewMode('setup')}
                className={`px-2 py-1 rounded text-xs font-medium ${replay.viewMode === 'setup' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}
              >
                편집
              </button>
              <button
                onClick={() => replay.setViewMode('replay')}
                className={`px-2 py-1 rounded text-xs font-medium ${replay.viewMode === 'replay' ? 'bg-purple-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}
              >
                리플레이
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={tm.resetAll} className="px-2 py-1.5 bg-[#1f2937] text-gray-500 hover:text-red-400 rounded-lg text-xs">
            초기화
          </button>
          <button
            onClick={() => setShowTeamCode(v => !v)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium ${showTeamCode ? 'bg-teal-600 text-white' : 'bg-[#1f2937] text-gray-400'}`}
          >
            팀 코드
          </button>
          <select
            value={stageNumber}
            onChange={e => setStageNumber(Number(e.target.value))}
            className="bg-[#1f2937] text-gray-300 text-xs rounded-lg px-2 py-1.5 border border-gray-600"
          >
            {[1, 2, 3, 4, 5, 6, 7].map(s => (
              <option key={s} value={s}>Stage {s}</option>
            ))}
          </select>
          <button
            onClick={runSimulation}
            disabled={!canRun}
            className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-xs font-bold text-black"
          >
            {isRunning ? '전투 중...' : '전투 시작'}
          </button>
          <button
            onClick={runMultiple}
            disabled={!canRun}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-xs font-bold text-white"
          >
            100회
          </button>
        </div>
      </div>

      {showTeamCode && (
        <TeamCodePanel
          playerTeam={tm.playerTeam}
          enemyTeam={tm.enemyTeam}
          champions={data.champions}
          teamPlannerMapping={data.teamPlannerMapping}
          onImport={(team, imp) => {
            if (team === 'player') tm.updatePlayerTeam(imp);
            else tm.updateEnemyTeam(imp);
            tm.setSelectedUnit(null);
          }}
        />
      )}

      {/* 2-column grid: 2fr (보드) | 1fr (side panel) */}
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        {/* Left: Board + Augments + (replay controls) */}
        <div className="min-w-0 space-y-2">
          <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-2 overflow-x-auto text-center">
            <div style={{ position: 'relative', display: 'inline-block', textAlign: 'left' }}>
              {replay.viewMode === 'setup' ? (
                <>
                  <SetupBoard
                    playerChampions={tm.playerTeam}
                    enemyChampions={tm.enemyTeam}
                    onCellClick={tm.handleCellClick}
                    onUnitClick={onUnitClickWithTab}
                    onUnitRightClick={tm.handleRemoveUnit}
                    onUnitCycleStars={tm.handleCycleStars}
                    selectedCell={tm.selectedCell}
                    selectedUnit={tm.selectedUnit}
                    playerHexBuffs={hexBuffs.player}
                    enemyHexBuffs={hexBuffs.enemy}
                    movingHexBuffApiName={hexBuffs.moving?.apiName}
                    cellSize={cellSize}
                  />
                  <DroppableOverlay
                    tm={tm}
                    hexBuffs={hexBuffs}
                    setHoverUnit={setHoverUnit}
                    cellSize={cellSize}
                    onUnitClick={onUnitClickWithTab}
                  />
                </>
              ) : (
                replay.combatResult && (
                  <ReplayBoard
                    snapshot={replay.currentSnapshot}
                    unitMeta={replay.unitMeta}
                    selectedUnitId={replay.selectedUnitId}
                    onUnitClick={(id) => {
                      replay.setSelectedUnitId(id);
                      if (id) setSideTab('unit');
                    }}
                    cellSize={cellSize}
                  />
                )
              )}
            </div>
          </div>

          {replay.viewMode === 'setup' && (
            <div className="flex justify-between px-2 gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-red-400 font-bold mb-1 truncate">{enemyLabel} 증강</div>
                <AugmentSlots
                  augments={tm.enemyAugments}
                  augmentStacks={tm.enemyAugmentStacks}
                  onOpenSelector={() => tm.setShowAugmentPicker('enemy')}
                  onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'enemy' })}
                  onRemove={(i) => tm.handleRemoveAugment('enemy', i)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-blue-400 font-bold mb-1 truncate">{playerLabel} 증강</div>
                <AugmentSlots
                  augments={tm.playerAugments}
                  augmentStacks={tm.playerAugmentStacks}
                  onOpenSelector={() => tm.setShowAugmentPicker('player')}
                  onOpenDetail={(aug) => tm.setAugmentDetailTarget({ aug, team: 'player' })}
                  onRemove={(i) => tm.handleRemoveAugment('player', i)}
                />
              </div>
            </div>
          )}

          {replay.viewMode === 'replay' && replay.combatResult && (
            <>
              <div className={`text-center p-2 rounded-lg border ${
                replay.combatResult.winner === 'player' ? 'bg-blue-600/10 border-blue-600/30' :
                replay.combatResult.winner === 'enemy' ? 'bg-red-600/10 border-red-600/30' :
                'bg-gray-600/10 border-gray-600/30'
              }`}>
                <div className="text-sm font-black">
                  {replay.combatResult.winner === 'player' ? `${playerLabel} 승리!` :
                   replay.combatResult.winner === 'enemy' ? `${enemyLabel} 승리!` : '무승부'}
                </div>
                <div className="text-[10px] text-gray-400">
                  전투 시간: {replay.combatResult.duration.toFixed(1)}초
                </div>
              </div>
              <BattleControls
                currentTick={replay.replayTick}
                totalTicks={replay.combatResult.snapshots.length}
                playbackSpeed={replay.playbackSpeed}
                isPlaying={replay.isPlaying}
                onPlay={() => replay.setIsPlaying(true)}
                onPause={() => replay.setIsPlaying(false)}
                onStepForward={() => replay.setReplayTick(p => Math.min(p + 1, replay.combatResult!.snapshots.length - 1))}
                onStepBack={() => replay.setReplayTick(p => Math.max(p - 1, 0))}
                onSeek={replay.setReplayTick}
                onSpeedChange={replay.setPlaybackSpeed}
                ticksPerSecond={TICKS_PER_SECOND}
              />
            </>
          )}
        </div>

        {/* Right: Tabbed side panel */}
        <div className="bg-[#111827] rounded-xl border border-gray-800 flex flex-col max-h-[calc(100vh-140px)] overflow-hidden">
          <div className="flex border-b border-gray-800 shrink-0">
            <button
              onClick={() => setSideTab('pool')}
              className={`flex-1 px-2 py-2 text-xs font-medium ${sideTab === 'pool' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
            >
              {replay.viewMode === 'setup' ? '풀' : '데미지'}
            </button>
            <button
              onClick={() => setSideTab('synergy')}
              className={`flex-1 px-2 py-2 text-xs font-medium ${sideTab === 'synergy' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
            >
              시너지
            </button>
            <button
              onClick={() => setSideTab('unit')}
              className={`flex-1 px-2 py-2 text-xs font-medium ${sideTab === 'unit' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
            >
              유닛
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {sideTab === 'pool' && replay.viewMode === 'setup' && <TabletPoolRouter {...props} />}
            {sideTab === 'pool' && replay.viewMode === 'replay' && replay.combatResult && (
              <DamageSidebar
                combatResult={replay.combatResult}
                currentSnapshot={replay.currentSnapshot}
                selectedUnitId={replay.selectedUnitId}
                onUnitClick={replay.setSelectedUnitId}
              />
            )}
            {sideTab === 'synergy' && <TabletSynergyContent {...props} />}
            {sideTab === 'unit' && <TabletUnitContent {...props} />}
          </div>
        </div>
      </div>

      {/* Replay: full log below */}
      {replay.viewMode === 'replay' && replay.combatResult && <TabletReplayLog {...props} />}
    </div>
  );
}

// --- Helper components --------------------------------------------------------

function TabletPoolRouter(props: SimulatorLayoutProps) {
  const { poolFilters, tm } = props;
  const bwPlayerActive = tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const bwEnemyActive = tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const showBW = bwPlayerActive || bwEnemyActive;

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
        {showBW && (
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
      {poolFilters.activePoolTab === 'bilgewater' && showBW && <BilgewaterPoolContent {...props} />}
    </div>
  );
}

function TabletSynergyContent({ tm, data }: SimulatorLayoutProps) {
  return (
    <div className="space-y-3">
      <SynergyPanel
        activeTraits={tm.enemyTraits}
        team="enemy"
        items={data.items}
        champions={data.champions}
        piltoverModules={tm.enemyPiltoverModules}
        bilgewaterStats={tm.enemyBilgewaterStats}
        ioniaPath={tm.enemyIoniaPath}
        onIoniaPathChange={tm.setEnemyIoniaPath}
        arbiterLaw={tm.enemyArbiterLaw}
        onArbiterLawChange={tm.setEnemyArbiterLaw}
      />
      <PiltoverModulePanel
        modules={tm.enemyPiltoverModules}
        allItems={data.items}
        activeTraits={tm.enemyTraits}
        onAddModule={(i) => tm.handleAddPiltoverModule('enemy', i)}
        onRemoveModule={(i) => tm.handleRemovePiltoverModule('enemy', i)}
      />
      <SynergyPanel
        activeTraits={tm.playerTraits}
        team="player"
        items={data.items}
        champions={data.champions}
        piltoverModules={tm.playerPiltoverModules}
        bilgewaterStats={tm.playerBilgewaterStats}
        ioniaPath={tm.playerIoniaPath}
        onIoniaPathChange={tm.setPlayerIoniaPath}
        arbiterLaw={tm.playerArbiterLaw}
        onArbiterLawChange={tm.setPlayerArbiterLaw}
      />
      <PiltoverModulePanel
        modules={tm.playerPiltoverModules}
        allItems={data.items}
        activeTraits={tm.playerTraits}
        onAddModule={(i) => tm.handleAddPiltoverModule('player', i)}
        onRemoveModule={(i) => tm.handleRemovePiltoverModule('player', i)}
      />
    </div>
  );
}

function TabletUnitContent(props: SimulatorLayoutProps) {
  const { tm, replay, data, hexBuffs, stageNumber, mappedPlayerForReplay } = props;

  if (replay.viewMode === 'setup') {
    if (!tm.selectedUnit || !tm.selectedPlaced) {
      return <div className="text-center text-xs text-gray-500 py-6">보드의 유닛을 선택하세요</div>;
    }
    return (
      <SelectedUnitPanel
        placed={tm.selectedPlaced}
        team={tm.selectedUnit.team}
        allItems={data.items}
        activeTraits={tm.selectedUnit.team === 'player' ? tm.playerTraits : tm.enemyTraits}
        onStarChange={(l) => tm.handleStarChange(tm.selectedUnit!.team, tm.selectedUnit!.index, l)}
        onEquipItem={(i) => tm.handleEquipItem(tm.selectedUnit!.team, tm.selectedUnit!.index, i)}
        onRemoveItem={(i) => tm.handleRemoveItem(tm.selectedUnit!.team, tm.selectedUnit!.index, i)}
        onRemoveVoidItem={() => tm.handleRemoveVoidItem(tm.selectedUnit!.team, tm.selectedUnit!.index)}
        onRemoveUnit={() => tm.handleRemoveUnit(tm.selectedUnit!.team, tm.selectedUnit!.index)}
        onMfModeChange={(m) => tm.handleMfModeChange(tm.selectedUnit!.team, tm.selectedUnit!.index, m)}
        onPermanentStackChange={(v) => tm.handlePermanentStackChange(tm.selectedUnit!.team, tm.selectedUnit!.index, v)}
      />
    );
  }

  if (!replay.selectedUnitId || !replay.selectedUnitSnap || !replay.unitMeta[replay.selectedUnitId]) {
    return <div className="text-center text-xs text-gray-500 py-6">보드의 유닛을 선택하세요</div>;
  }
  const selMeta = replay.unitMeta[replay.selectedUnitId];
  const target = selMeta.team === 'player'
    ? mappedPlayerForReplay.find(p => p.champion.apiName === selMeta.championApiName)
    : undefined;
  const verifyContext = target ? {
    playerTeam: mappedPlayerForReplay,
    enemyTeam: tm.enemyTeam,
    targetApiName: selMeta.championApiName,
    targetPosition: target.position,
    simulateOptions: {
      seed: 42,
      allTraits: data.traits,
      skipMirror: true,
      playerAugments: tm.playerAugments,
      playerAugmentStacks: tm.playerAugmentStacks,
      enemyAugments: tm.enemyAugments,
      enemyAugmentStacks: tm.enemyAugmentStacks,
      playerBilgewaterEffects: resolveBilgewaterStatEffects(tm.playerBilgewaterStats, data.items),
      enemyBilgewaterEffects: resolveBilgewaterStatEffects(tm.enemyBilgewaterStats, data.items),
      playerPiltoverModules: tm.playerPiltoverModules,
      enemyPiltoverModules: tm.enemyPiltoverModules,
      playerIoniaPath: tm.playerIoniaPath ?? undefined,
      enemyIoniaPath: tm.enemyIoniaPath ?? undefined,
      playerGalio: tm.playerGalio,
      enemyGalio: tm.enemyGalio,
      playerHexBuffs: hexBuffs.player,
      enemyHexBuffs: hexBuffs.enemy,
      stageNumber,
      playerArbiterLaw: tm.playerArbiterLaw ?? undefined,
      enemyArbiterLaw: tm.enemyArbiterLaw ?? undefined,
    },
  } : undefined;

  return (
    <UnitDetailPanel
      key={replay.selectedUnitId}
      unitSnapshot={replay.selectedUnitSnap}
      meta={selMeta}
      onClose={() => replay.setSelectedUnitId(null)}
      allItems={data.items}
      verifyContext={verifyContext}
      activeTraits={selMeta.team === 'player' ? tm.playerTraits : tm.enemyTraits}
    />
  );
}

function TabletReplayLog({ replay, logFilter, setLogFilter }: SimulatorLayoutProps) {
  const filteredLogs = useMemo(() => {
    if (!replay.combatResult) return [];
    if (logFilter === 'all') return replay.combatResult.logs.slice(-200);
    return replay.combatResult.logs.filter(l => l.type === logFilter).slice(-200);
  }, [replay.combatResult, logFilter]);

  return (
    <div className="p-4 bg-[#111827] rounded-xl border border-gray-800" style={{ minHeight: 280 }}>
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-sm font-bold text-gray-300">전투 로그</h4>
        <div className="flex gap-1 ml-auto">
          {(['all', 'attack', 'ability', 'death', 'move'] as const).map(f => (
            <button
              key={f}
              onClick={() => setLogFilter(f)}
              className={`px-2 py-0.5 rounded text-[10px] ${logFilter === f ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-500'}`}
            >
              {f === 'all' ? '전체' : f === 'attack' ? '공격' : f === 'ability' ? '스킬' : f === 'death' ? '사망' : '이동'}
            </button>
          ))}
        </div>
      </div>
      <div
        className="h-[200px] overflow-y-auto space-y-0.5 font-mono text-xs"
        ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
      >
        {filteredLogs.map((log, i) => (
          <div
            key={`${log.tick}-${i}`}
            className={`py-0.5 px-2 rounded ${
              log.type === 'death' ? 'bg-red-900/20 text-red-400' :
              log.type === 'ability' ? 'text-purple-400' :
              log.type === 'move' ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            <span className="text-gray-600 mr-2">[{log.time.toFixed(1)}s]</span>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
