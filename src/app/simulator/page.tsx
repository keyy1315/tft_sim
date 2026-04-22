'use client';

import { Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useGameData } from '@/hooks/useGameData';
import { useActiveSet } from '@/hooks/useActiveSet';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { PlacedChampion, HexCoord, RawItem, axialToOffset, offsetToAxial, CombatResult, CombatLog } from '@/types';
import { decodeTeamCode, autoPlaceChampions } from '@/lib/teamCode';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useReplayControls } from '@/hooks/useReplayControls';
import { useDndHandlers } from '@/hooks/useDndHandlers';
import { useViewport } from '@/hooks/useViewport';
import { resolveBilgewaterStatEffects } from '@/lib/simulator/systems/stat';
import { resolveHexBuffs } from '@/data/augmentHexBuffs';
import ChampionGrid from '@/components/builder/ChampionGrid';
import Modal from '@/components/ui/Modal';
import AugmentSelector from '@/components/builder/AugmentSelector';
import AugmentDetailPopup from '@/components/builder/AugmentDetailPopup';
import ChampionCard from '@/components/builder/ChampionCard';
import ItemIcon from '@/components/builder/ItemIcon';
import MfModeSelector from '@/components/builder/MfModeSelector';
import SimulatorLayoutDesktop from './layout/SimulatorLayoutDesktop';
import SimulatorLayoutMobile from './layout/SimulatorLayoutMobile';
import SimulatorLayoutTablet from './layout/SimulatorLayoutTablet';
import type { SimulatorLayoutProps, ItemFilterTab, PoolTab } from './layout/types';

export default function SimulatorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-gray-500">로딩 중...</div>}>
      <SimulatorContent />
    </Suspense>
  );
}

interface HandoffExtras {
  items: Record<string, string[]>;
  /** 팀코드 star=0 → 기본 2성 해석 대체. 분석 원본 성급을 그대로 복원. */
  starLevels: Record<string, number>;
}

interface AnalysisHandoff {
  playerCode: string;
  enemyCode: string;
  extras: {
    player: HandoffExtras;
    enemy: HandoffExtras;
  };
  teamNames?: { player: string | null; enemy: string | null };
  returnTo: { matchId: string; puuid: string };
}

function SimulatorContent() {
  const activeSet = useActiveSet();
  const router = useRouter();
  const viewport = useViewport();
  const { champions, items, traits, augments, teamPlannerMapping, loading } = useGameData(activeSet);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const tm = useTeamManagement({ traits });
  const replay = useReplayControls();
  const [returnTo, setReturnTo] = useState<{ matchId: string; puuid: string } | null>(null);
  const [teamNames, setTeamNames] = useState<{ player: string | null; enemy: string | null }>({ player: null, enemy: null });

  // 분석 페이지에서 넘어온 팀 데이터 — 팀코드 + extras(아이템) 방식.
  useEffect(() => {
    const stored = sessionStorage.getItem('analysis_handoff');
    if (!stored) return;
    if (!champions.length || !items.length || !teamPlannerMapping.length) return;
    sessionStorage.removeItem('analysis_handoff');
    try {
      const handoff = JSON.parse(stored) as AnalysisHandoff;
      const itemMap = new Map(items.map(i => [i.apiName, i]));
      const applyExtras = (arr: PlacedChampion[], extras: HandoffExtras): PlacedChampion[] =>
        arr.map(p => {
          const apiName = p.champion.apiName;
          const overrideStar = extras.starLevels[apiName];
          return {
            ...p,
            starLevel: (overrideStar === 1 || overrideStar === 2 || overrideStar === 3) ? overrideStar : p.starLevel,
            items: (extras.items[apiName] ?? [])
              .map(id => itemMap.get(id))
              .filter((x): x is RawItem => !!x),
          };
        });

      const playerDecoded = decodeTeamCode(handoff.playerCode, teamPlannerMapping, champions);
      const enemyDecoded = decodeTeamCode(handoff.enemyCode, teamPlannerMapping, champions);
      const playerPlaced = autoPlaceChampions(playerDecoded.champions, undefined, 'player');
      const enemyPlaced = autoPlaceChampions(enemyDecoded.champions, undefined, 'enemy');

      tm.updatePlayerTeam(applyExtras(playerPlaced, handoff.extras.player));
      tm.updateEnemyTeam(applyExtras(enemyPlaced, handoff.extras.enemy));
      setReturnTo(handoff.returnTo);
      if (handoff.teamNames) {
        setTeamNames({
          player: handoff.teamNames.player ?? null,
          enemy: handoff.teamNames.enemy ?? null,
        });
      }
    } catch { /* ignore malformed handoff */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champions, items, teamPlannerMapping]);

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

  // Pool state
  const [champSearch, setChampSearch] = useState('');
  const [champCostFilter, setChampCostFilter] = useState<number | null>(null);
  const [activePoolTab, setActivePoolTab] = useState<PoolTab>('champions');
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState<ItemFilterTab>('all');
  const [showTeamCode, setShowTeamCode] = useState(false);
  const [logFilter, setLogFilter] = useState<CombatLog['type'] | 'all'>('all');
  const [isRunning, setIsRunning] = useState(false);
  const [stageNumber, setStageNumber] = useState(4);
  const [hoverUnit, setHoverUnit] = useState<{ placed: PlacedChampion; rect: DOMRect } | null>(null);
  const [hexBuffOverrides, setHexBuffOverrides] = useState<Record<string, Record<string, HexCoord>>>({ player: {}, enemy: {} });
  const [movingHexBuff, setMovingHexBuff] = useState<{ team: 'player' | 'enemy'; apiName: string } | null>(null);

  /** Map player data-row 0-3 → display-row 4-7 for 8-row combat board */
  const toEightRowCoords = useCallback((team: PlacedChampion[], rowOffset: number): PlacedChampion[] => {
    if (rowOffset === 0) return team;
    return team.map(p => {
      const off = axialToOffset(p.position);
      const newPos = offsetToAxial({ row: off.row + rowOffset, col: off.col });
      return { ...p, position: newPos };
    });
  }, []);

  const mappedPlayerForReplay = useMemo(
    () => toEightRowCoords(tm.playerTeam, 4),
    [tm.playerTeam, toEightRowCoords],
  );

  // 칸 버프 계산 (증강 + 팀 구성 변경 시 재계산)
  const playerHexBuffs = useMemo(() =>
    resolveHexBuffs(tm.playerAugments.map(a => a.apiName), tm.playerTeam, hexBuffOverrides.player),
    [tm.playerAugments, tm.playerTeam, hexBuffOverrides.player]
  );
  const enemyHexBuffs = useMemo(() =>
    resolveHexBuffs(tm.enemyAugments.map(a => a.apiName), tm.enemyTeam, hexBuffOverrides.enemy),
    [tm.enemyAugments, tm.enemyTeam, hexBuffOverrides.enemy]
  );

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
        playerHexBuffs,
        enemyHexBuffs,
        stageNumber,
        playerArbiterLaw: tm.playerArbiterLaw ?? undefined,
        enemyArbiterLaw: tm.enemyArbiterLaw ?? undefined,
      });
      replay.setCombatResult(result);
      setIsRunning(false);
      replay.setViewMode('replay');
      replay.setReplayTick(0);
      replay.setIsPlaying(true);
    }, 100);
  }, [tm.playerTeam, tm.enemyTeam, traits, tm.playerAugments, tm.playerAugmentStacks, tm.enemyAugments, tm.enemyAugmentStacks, tm.playerBilgewaterStats, tm.enemyBilgewaterStats, tm.playerPiltoverModules, tm.enemyPiltoverModules, tm.playerIoniaPath, tm.enemyIoniaPath, tm.playerGalio, tm.enemyGalio, playerHexBuffs, enemyHexBuffs, stageNumber, items, toEightRowCoords, replay]);

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
          playerHexBuffs,
          enemyHexBuffs,
          stageNumber,
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
  }, [tm.playerTeam, tm.enemyTeam, traits, tm.playerAugments, tm.playerAugmentStacks, tm.enemyAugments, tm.enemyAugmentStacks, tm.playerBilgewaterStats, tm.enemyBilgewaterStats, tm.playerPiltoverModules, tm.enemyPiltoverModules, tm.playerIoniaPath, tm.enemyIoniaPath, tm.playerGalio, tm.enemyGalio, playerHexBuffs, enemyHexBuffs, stageNumber, items, toEightRowCoords, replay]);

  const onBackToAnalysis = useCallback(() => {
    if (returnTo) {
      router.push(`/lookup/${encodeURIComponent(returnTo.matchId)}/analysis?puuid=${encodeURIComponent(returnTo.puuid)}`);
    }
  }, [returnTo, router]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh] text-gray-500">데이터 로딩 중...</div>;
  }

  const layoutProps: SimulatorLayoutProps = {
    tm, replay, dnd,
    data: { champions, items, traits, augments, teamPlannerMapping },
    hexBuffs: {
      player: playerHexBuffs, enemy: enemyHexBuffs,
      overrides: hexBuffOverrides, setOverrides: setHexBuffOverrides,
      moving: movingHexBuff, setMoving: setMovingHexBuff,
    },
    stageNumber, setStageNumber, isRunning, runSimulation, runMultiple,
    teamNames,
    poolFilters: {
      champSearch, setChampSearch, champCostFilter, setChampCostFilter,
      itemSearch, setItemSearch, itemCategoryFilter, setItemCategoryFilter,
      activePoolTab, setActivePoolTab,
    },
    logFilter, setLogFilter, showTeamCode, setShowTeamCode,
    hoverUnit, setHoverUnit,
    returnTo,
    onBackToAnalysis,
    mappedPlayerForReplay,
  };

  return (
    <DndContext sensors={sensors} onDragStart={dnd.handleDragStart} onDragEnd={dnd.handleDragEnd}>
      <div className="space-y-4">
        {/* 분석에서 넘어왔을 때만 표시되는 복귀 버튼 */}
        {returnTo && (
          <button
            onClick={onBackToAnalysis}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← 매치 분석으로 돌아가기
          </button>
        )}

        {viewport === 'mobile' ? <SimulatorLayoutMobile {...layoutProps} />
          : viewport === 'tablet' ? <SimulatorLayoutTablet {...layoutProps} />
          : <SimulatorLayoutDesktop {...layoutProps} />}

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

      {/* Footer */}
      <footer className="mt-8 py-4 border-t border-gray-800 text-center text-xs text-gray-600">
        <p>TFT Combat Simulator &mdash; Set 17: Space Gods</p>
        <p className="mt-1">Data from CommunityDragon &middot; Not affiliated with Riot Games</p>
      </footer>
    </DndContext>
  );
}
