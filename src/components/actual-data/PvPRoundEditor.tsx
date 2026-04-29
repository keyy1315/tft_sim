'use client';
import { useCallback, useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core';
import type { PvPRound, PlacedUnit } from '@/lib/actualData/types';
import { useActualDataStore } from '@/store/actualDataSlice';
import { useGameData } from '@/hooks/useGameData';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import type { DragData, RawChampion, RawItem, HexCoord } from '@/types';
import { offsetToAxial } from '@/types';
import ChampionCard from '@/components/builder/ChampionCard';
import ItemIcon from '@/components/builder/ItemIcon';
import GravesWeaponModal from '@/components/builder/GravesWeaponModal';
import TeamEditor from './TeamEditor';
import OpponentPanel from './OpponentPanel';
import DamageChartInput from './DamageChartInput';
import SurvivorListPanel from './SurvivorListPanel';
import VideoTimeInput from './VideoTimeInput';
import ActualBoard from './ActualBoard';
import ChampionItemSidebar from './ChampionItemSidebar';
import { createActualDragEndHandler } from './actualDndHandlers';
import RoundDiffInlineCard from '@/components/validation/RoundDiffInlineCard';

export default function PvPRoundEditor({ index, round }: { index: number; round: PvPRound }) {
  const updateRoundMeta = useActualDataStore(s => s.updateRoundMeta);
  const updatePvPRound = useActualDataStore(s => s.updatePvPRound);
  const updatePlayerTeam = useActualDataStore(s => s.updatePlayerTeam);
  const updateOpponent = useActualDataStore(s => s.updateOpponent);
  const gameId = useActualDataStore(s => s.currentGame?.gameId);
  const { champions, items, loading } = useGameData();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // pointerWithin 으로 작은 슬롯 drop 을 우선 매칭하고, 포인터가 헥스 밖으로 살짝 벗어나면
  // rectIntersection 으로 fallback 해 기존 헥스 본체 drop 을 잃지 않는다.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) return pointerHits;
    return rectIntersection(args);
  };

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  // Build a fresh drag-end handler each render so it closes over the latest round/index.
  // Cheap (just function construction), and safer than a ref bridge under React Compiler.
  const handleDragEnd = createActualDragEndHandler(() => ({
    round,
    roundIndex: index,
    updatePlayerTeam,
    updateOpponent,
  }));

  /**
   * Click-fallback placement (when DnD activation threshold isn't met):
   * place the selected champion on the first empty player-side hex.
   */
  const handleChampionClick = useCallback((c: RawChampion) => {
    const occupied = new Set(round.playerTeam.units.map(u => `${u.hex.q},${u.hex.r}`));
    const firstFree = findFirstEmptyHex(occupied);
    if (!firstFree) return;
    const newUnit: PlacedUnit = {
      championId: c.apiName,
      hex: firstFree,
      starLevel: 2,
      items: [undefined, undefined, undefined],
    };
    updatePlayerTeam(index, { units: [...round.playerTeam.units, newUnit] });
  }, [round.playerTeam.units, index, updatePlayerTeam]);

  /**
   * Click-fallback item placement: append to the first player unit with <3 items.
   */
  const handleItemClick = useCallback((item: RawItem) => {
    const idx = round.playerTeam.units.findIndex(u => u.items.filter(Boolean).length < 3);
    if (idx < 0) return;
    const target = round.playerTeam.units[idx];
    const nextSlots = [...target.items] as PlacedUnit['items'];
    for (let i = 0; i < 3; i++) {
      if (!nextSlots[i]) { nextSlots[i] = item.apiName; break; }
    }
    const nextUnits = round.playerTeam.units.map((u, i) =>
      i === idx ? { ...u, items: nextSlots } : u,
    );
    updatePlayerTeam(index, { units: nextUnits });
  }, [round.playerTeam.units, index, updatePlayerTeam]);

  const championCatalog = useMemo(() => new Map(champions.map(c => [c.apiName, c])), [champions]);

  // 그레이브즈 무기고 — 모달 state + onPicksChange 핸들러
  const [gravesModalTeam, setGravesModalTeam] = useState<'player' | 'opponent' | null>(null);
  const hasPlayerGraves = round.playerTeam.units.some(u => u.championId === 'TFT17_Graves');
  const hasOpponentGraves = round.opponent.units.some(u => u.championId === 'TFT17_Graves');
  const playerPicks = round.playerTeam.factoryNew?.upgradePath ?? [];
  const opponentPicks = round.opponent.factoryNew?.upgradePath ?? [];
  const currentPicks = gravesModalTeam === 'player'
    ? playerPicks
    : gravesModalTeam === 'opponent' ? opponentPicks : [];

  const handleGravesPicksChange = useCallback((picks: string[]) => {
    if (gravesModalTeam === 'player') {
      updatePlayerTeam(index, {
        factoryNew: {
          ...round.playerTeam.factoryNew,
          upgradePath: picks,
        },
      });
    } else if (gravesModalTeam === 'opponent') {
      updateOpponent(index, {
        factoryNew: {
          ...round.opponent.factoryNew,
          upgradePath: picks,
        },
      });
    }
  }, [gravesModalTeam, index, round.playerTeam.factoryNew, round.opponent.factoryNew, updatePlayerTeam, updateOpponent]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(e) => {
        const data = e.active.data.current as DragData | undefined;
        if (data) setActiveDrag(data);
      }}
      onDragEnd={(e) => {
        setActiveDrag(null);
        handleDragEnd(e);
      }}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="flex h-full min-h-0 gap-2">
        {/* Center column: meta + opponent bar + board + player bar + rest */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-auto pr-2">
          <div className="flex gap-2 items-end flex-wrap">
            <label className="flex flex-col">
              <span className="text-sm text-gray-300">라운드명</span>
              <input value={round.roundName}
                onChange={e => updateRoundMeta(index, { roundName: e.target.value })}
                className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded w-20" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-gray-300">영상 시작 (mm:ss)</span>
              <VideoTimeInput
                value={round.videoStartTime}
                onChange={v => updateRoundMeta(index, { videoStartTime: v ?? 0 })}
                className="w-24"
                showCaptureButton
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-gray-300">영상 종료 (mm:ss)</span>
              <VideoTimeInput
                value={round.videoEndTime}
                onChange={v => updateRoundMeta(index, { videoEndTime: v })}
                className="w-24"
                allowEmpty
                showCaptureButton
              />
            </label>
          </div>

          {/* Opponent info bar (top) */}
          <div className="bg-[#111827] border border-gray-800 rounded p-2">
            <OpponentPanel index={index} opponent={round.opponent}
              onChange={o => updateOpponent(index, o)} />
          </div>

          {/* Board */}
          <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-2 flex justify-center">
            {loading ? (
              <div className="text-gray-500 py-10">데이터 로딩 중...</div>
            ) : (
              <ActualBoard
                roundIndex={index}
                champions={champions}
                items={items}
              />
            )}
          </div>

          {/* Player info bar (bottom) */}
          <div className="bg-[#111827] border border-gray-800 rounded p-2">
            <TeamEditor label="내 팀" team={round.playerTeam}
              onChange={t => updatePlayerTeam(index, t)}
              showGrace={{ roundIndex: index }} />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-300">승자:</span>
              <select value={round.winner}
                onChange={e => updatePvPRound(index, { winner: e.target.value as 'player' | 'opponent' | 'draw' })}
                className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded">
                <option value="player">내 팀</option>
                <option value="opponent">상대</option>
                <option value="draw">무승부</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <DamageChartInput
              label="내 팀 데미지"
              units={round.playerTeam.units}
              entries={round.playerDamageChart ?? []}
              onChange={entries => updatePvPRound(index, { playerDamageChart: entries })}
              championCatalog={championCatalog}
            />
            <DamageChartInput
              label="상대 팀 데미지"
              units={round.opponent.units}
              entries={round.opponentDamageChart ?? []}
              onChange={entries => updatePvPRound(index, { opponentDamageChart: entries })}
              championCatalog={championCatalog}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <SurvivorListPanel
              label="내 팀 라운드 종료 상태"
              team={round.playerTeam}
              onChange={t => updatePlayerTeam(index, t)}
              championCatalog={championCatalog}
            />
            <SurvivorListPanel
              label="상대 팀 라운드 종료 상태"
              team={round.opponent}
              onChange={o => updateOpponent(index, o)}
              championCatalog={championCatalog}
            />
          </div>

          {gameId && (
            <RoundDiffInlineCard gameId={gameId} currentRoundName={round.roundName} />
          )}
        </div>

        {/* Right-side sidebar */}
        <ChampionItemSidebar
          champions={champions}
          items={items}
          onChampionClick={handleChampionClick}
          onItemClick={handleItemClick}
        />
      </div>

      <DragOverlay>
        {activeDrag?.type === 'champion' && (
          <div style={{ opacity: 0.7 }}>
            <ChampionCard champion={activeDrag.champion} size={48} showName={false} />
          </div>
        )}
        {activeDrag?.type === 'placed-unit' && (() => {
          const team = activeDrag.team === 'player' ? round.playerTeam : round.opponent;
          const u = team.units.find(x => x.hex.q === activeDrag.position.q && x.hex.r === activeDrag.position.r);
          if (!u) return null;
          const c = championCatalog.get(u.championId);
          if (!c) return null;
          return (
            <div style={{ opacity: 0.7 }}>
              <ChampionCard champion={c} size={48} showName={false} starLevel={u.starLevel} />
            </div>
          );
        })()}
        {activeDrag?.type === 'item' && (
          <div style={{ opacity: 0.7 }}>
            <ItemIcon item={activeDrag.item} size={32} showTooltip={false} />
          </div>
        )}
      </DragOverlay>

      {/* 그레이브즈 무기고 — graves placed 시 floating button. round 별로 picks 저장.
          modal open 일 때 button 숨김 → modal isolation 보장 (codex P2: picks 가
          의도하지 않은 팀에 적용되는 mid-flow 전환 방지). z-index 도 modal (z-50) 보다
          낮은 z-40 으로 — modal 안에서도 background button 가시성 차단. */}
      {(hasPlayerGraves || hasOpponentGraves) && gravesModalTeam === null && (
        <div
          className="fixed right-4 flex flex-col gap-2"
          style={{ bottom: '16px', zIndex: 40 }}
        >
          {hasPlayerGraves && (
            <button
              type="button"
              onClick={() => setGravesModalTeam('player')}
              className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-full shadow-lg flex items-center gap-2"
              title="내 팀 그레이브즈 무기고 편집"
            >
              🔧 내 무기고
              {playerPicks.length > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-900 text-blue-100 text-xs rounded-full">
                  {playerPicks.length}
                </span>
              )}
            </button>
          )}
          {hasOpponentGraves && (
            <button
              type="button"
              onClick={() => setGravesModalTeam('opponent')}
              className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-full shadow-lg flex items-center gap-2"
              title="상대 그레이브즈 무기고 편집"
            >
              🔧 상대 무기고
              {opponentPicks.length > 0 && (
                <span className="px-1.5 py-0.5 bg-red-900 text-red-100 text-xs rounded-full">
                  {opponentPicks.length}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      <GravesWeaponModal
        isOpen={gravesModalTeam !== null}
        picks={currentPicks}
        onPicksChange={handleGravesPicksChange}
        onClose={() => setGravesModalTeam(null)}
        unitLabel={
          gravesModalTeam === 'player' ? `내 팀 — 라운드 ${round.roundName}`
          : gravesModalTeam === 'opponent' ? `상대 — 라운드 ${round.roundName}`
          : undefined
        }
      />
    </DndContext>
  );
}

/** Find the first empty player-side hex (data rows 0-3). */
function findFirstEmptyHex(occupied: Set<string>): HexCoord | null {
  for (let r = 0; r <= 3; r++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const hex = offsetToAxial({ row: r, col });
      if (!occupied.has(`${hex.q},${hex.r}`)) return hex;
    }
  }
  return null;
}
