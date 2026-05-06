'use client';

import { ReactNode, useCallback, useMemo, useState } from 'react';
import SetupBoard from '@/components/battle/SetupBoard';
import ReplayBoard from '@/components/battle/ReplayBoard';
import BattleControls from '@/components/battle/BattleControls';
import DamageSidebar from '@/components/battle/DamageSidebar';
import UnitDetailPanel from '@/components/battle/UnitDetailPanel';
import { resolveBilgewaterStatEffects } from '@/lib/simulator/systems/stat';
import SynergyChip from '@/components/builder/SynergyChip';
import SelectedUnitPanel from '@/components/builder/SelectedUnitPanel';
import SynergyPanel from '@/components/builder/SynergyPanel';
import PiltoverModulePanel from '@/components/builder/PiltoverModulePanel';
import AugmentSlots from '@/components/builder/AugmentSlots';
import BottomSheet from '@/components/ui/BottomSheet';
import OverflowMenu from '@/components/ui/OverflowMenu';
import { TICKS_PER_SECOND } from '@/lib/simulator/models/constants';
import { useWindowWidth } from '@/hooks/useViewport';
import type { SimulatorLayoutProps } from './types';
import DroppableOverlay from './shared/DroppableOverlay';
import ChampionPoolContent from './pool/ChampionPoolContent';
import ItemPoolContent from './pool/ItemPoolContent';
import BilgewaterPoolContent from './pool/BilgewaterPoolContent';

/**
 * 모바일 뷰포트 폭에 맞춰 cellSize (hexR) 동적 계산.
 * 보드 폭 공식: 7.5 × HEX_W + 75 = 7.5 × hexR × √3 + 75
 * 22 <= hexR <= 36 범위로 제한 (너무 작으면 tap 어려움, 너무 크면 desktop과 동일).
 */
function computeMobileCellSize(viewportWidth: number): number {
  // 카드 패딩/마진 감안 40px
  const usable = viewportWidth - 40;
  const candidate = Math.floor((usable - 75) / (7.5 * Math.sqrt(3)));
  return Math.max(22, Math.min(36, candidate));
}

type MobileTabId = 'pool' | 'unit' | 'synergy' | 'log' | 'damage';

interface MobileTab {
  id: MobileTabId;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export default function SimulatorLayoutMobile(props: SimulatorLayoutProps) {
  const { tm, replay, hexBuffs, teamNames, sheetState, setSheetState } = props;

  const windowWidth = useWindowWidth();
  const cellSize = computeMobileCellSize(windowWidth);

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
    [tm, setSheetState],
  );

  const setupTabs: MobileTab[] = [
    {
      id: 'pool',
      label: '풀',
      // onFocusCapture: 풀 탭 내부 input (검색바) 포커스 시 sheet full 로 올려
      // 가상 키보드 와도 함께 보이도록 함
      content: (
        <div onFocusCapture={() => setSheetState('full')} className="flex flex-col h-full">
          <PoolContentRouter {...props} />
        </div>
      ),
    },
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
          onNovaStrikeSelectorToggle={(next) => tm.handleNovaStrikeSelectorChange(tm.selectedUnit!.team, tm.selectedUnit!.index, next)}
          onEditGravesWeapons={props.onEditGravesWeapons ? () => props.onEditGravesWeapons!(tm.selectedUnit!.team) : undefined}
          teamGravesPicks={tm.selectedUnit!.team === 'player' ? tm.playerGravesPicks : tm.enemyGravesPicks}
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
            stargazerConstellation={tm.enemyStargazerConstellation}
            onStargazerConstellationChange={tm.setEnemyStargazerConstellation}
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
            stargazerConstellation={tm.playerStargazerConstellation}
            onStargazerConstellationChange={tm.setPlayerStargazerConstellation}
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

      {/* Replay winner banner (replay mode only, above board) */}
      {replay.viewMode === 'replay' && replay.combatResult && (
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
      )}

      {/* Board — text-center on wrapper so inline-block 이 자동 중앙 정렬, overflow 시 스크롤 */}
      <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-2 overflow-x-auto text-center">
        <div style={{ position: 'relative', display: 'inline-block', textAlign: 'left' }}>
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
                playerStargazerTiles={props.playerStargazerTiles}
                enemyStargazerTiles={props.enemyStargazerTiles}
                playerStargazerConstellation={tm.playerStargazerConstellation}
                enemyStargazerConstellation={tm.enemyStargazerConstellation}
                playerStargazerEffectVariables={props.playerStargazerInfo.effectVariables}
                enemyStargazerEffectVariables={props.enemyStargazerInfo.effectVariables}
                playerStargazerCount={props.playerStargazerInfo.count}
                enemyStargazerCount={props.enemyStargazerInfo.count}
                cellSize={cellSize}
              />
              <DroppableOverlay
                tm={tm}
                hexBuffs={hexBuffs}
                setHoverUnit={props.setHoverUnit}
                cellSize={cellSize}
                onUnitClick={onUnitClickWithSheet}
                onMovableActivate={() => setSheetState('peek')}
                playerStargazerTiles={props.playerStargazerTiles}
                enemyStargazerTiles={props.enemyStargazerTiles}
                playerStargazerConstellation={tm.playerStargazerConstellation}
                enemyStargazerConstellation={tm.enemyStargazerConstellation}
                playerStargazerInfo={props.playerStargazerInfo}
                enemyStargazerInfo={props.enemyStargazerInfo}
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
              playerStargazerTiles={props.playerStargazerTiles}
              enemyStargazerTiles={props.enemyStargazerTiles}
              playerStargazerConstellation={tm.playerStargazerConstellation}
              enemyStargazerConstellation={tm.enemyStargazerConstellation}
              playerStargazerEffectVariables={props.playerStargazerInfo.effectVariables}
              enemyStargazerEffectVariables={props.enemyStargazerInfo.effectVariables}
              playerStargazerCount={props.playerStargazerInfo.count}
              enemyStargazerCount={props.enemyStargazerInfo.count}
              cellSize={cellSize}
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

      {/* Tick events (replay mode, under the board) */}
      {replay.viewMode === 'replay' && replay.combatResult && (
        <div className="bg-[#111827] rounded-lg border border-gray-800 p-2" style={{ minHeight: 60 }}>
          <div className="text-[10px] font-bold text-gray-500 mb-1">현재 틱 이벤트</div>
          <div className="space-y-0.5 font-mono text-[10px] h-[44px] overflow-y-auto">
            {replay.tickEvents.length > 0 ? replay.tickEvents.map((e, i) => (
              <div
                key={`${e.tick}-${i}`}
                className={
                  e.type === 'death' ? 'text-red-400' :
                  e.type === 'ability' ? 'text-purple-400' :
                  e.type === 'move' ? 'text-gray-600' : 'text-gray-400'
                }
              >
                {e.message}
              </div>
            )) : (
              <div className="text-gray-600">대기 중...</div>
            )}
          </div>
        </div>
      )}

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

function ReplayLogTab({ replay, logFilter, setLogFilter }: SimulatorLayoutProps) {
  const filteredLogs = useMemo(() => {
    if (!replay.combatResult) return [];
    if (logFilter === 'all') return replay.combatResult.logs.slice(-200);
    return replay.combatResult.logs.filter(l => l.type === logFilter).slice(-200);
  }, [replay.combatResult, logFilter]);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-1 shrink-0 overflow-x-auto">
        {(['all', 'attack', 'ability', 'death', 'move'] as const).map(f => (
          <button
            key={f}
            onClick={() => setLogFilter(f)}
            className={`px-2 py-0.5 rounded text-[10px] shrink-0 ${logFilter === f ? 'bg-[#8b5cf6] text-white' : 'bg-[#1f2937] text-gray-500'}`}
          >
            {f === 'all' ? '전체' : f === 'attack' ? '공격' : f === 'ability' ? '스킬' : f === 'death' ? '사망' : '이동'}
          </button>
        ))}
      </div>
      <div
        className="flex-1 overflow-y-auto space-y-0.5 font-mono text-[10px]"
        ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
      >
        {filteredLogs.map((log, i) => (
          <div
            key={`${log.tick}-${i}`}
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
  );
}

function ReplayDamageTab({ replay }: SimulatorLayoutProps) {
  if (!replay.combatResult) {
    return <div className="text-center text-xs text-gray-500 py-6">전투를 시작하면 표시됩니다</div>;
  }
  return (
    <DamageSidebar
      combatResult={replay.combatResult}
      currentSnapshot={replay.currentSnapshot}
      selectedUnitId={replay.selectedUnitId}
      onUnitClick={replay.setSelectedUnitId}
    />
  );
}

function ReplayUnitDetailTab(props: SimulatorLayoutProps) {
  const { tm, replay, data, hexBuffs, stageNumber, mappedPlayerForReplay } = props;
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
