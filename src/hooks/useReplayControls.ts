import { useState, useMemo, useRef, useEffect } from 'react';
import { CombatResult, TickSnapshot } from '@/types';
import { TICKS_PER_SECOND } from '@/lib/simulator/models/constants';

type ViewMode = 'setup' | 'replay';

export function useReplayControls() {
  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [replayTick, setReplayTick] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Replay auto-play
  // setIsPlaying(false) is called inside a setInterval callback (async), not in the effect body directly.
  // This is permitted by react-hooks/set-state-in-effect which only flags synchronous calls in the effect body.
  useEffect(() => {
    if (isPlaying && combatResult) {
      const intervalMs = Math.round(1000 / (TICKS_PER_SECOND * playbackSpeed));
      playIntervalRef.current = setInterval(() => {
        setReplayTick(prev => {
          const next = prev + 1;
          if (next >= combatResult.snapshots.length) {
            setIsPlaying(false);
            return combatResult.snapshots.length - 1;
          }
          return next;
        });
      }, intervalMs);
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, combatResult]);

  // Build unit metadata from combat result for ReplayBoard
  const unitMeta = useMemo(() => {
    if (!combatResult) return {};
    const meta: Record<string, {
      championName: string;
      championApiName: string;
      cost: number;
      team: 'player' | 'enemy';
      starLevel: number;
      items: { apiName: string }[];
      maxHp: number;
      maxMana: number;
    }> = {};
    for (const u of [...combatResult.playerUnits, ...combatResult.enemyUnits]) {
      meta[u.id] = {
        championName: u.champion.name,
        championApiName: u.champion.apiName,
        cost: u.champion.cost,
        team: u.team,
        starLevel: u.starLevel,
        items: u.items.map(it => ({ apiName: it.apiName })),
        maxHp: u.maxHp,
        maxMana: u.maxMana,
      };
    }
    return meta;
  }, [combatResult]);

  // Current snapshot
  const currentSnapshot: TickSnapshot | null = useMemo(() => {
    if (!combatResult || combatResult.snapshots.length === 0) return null;
    const idx = Math.min(replayTick, combatResult.snapshots.length - 1);
    return combatResult.snapshots[idx] ?? null;
  }, [combatResult, replayTick]);

  // Events at current tick
  const tickEvents = useMemo(() => {
    if (!currentSnapshot) return [];
    return currentSnapshot.events;
  }, [currentSnapshot]);

  // Selected unit info from snapshot
  const selectedUnitSnap = useMemo(() => {
    if (!selectedUnitId || !currentSnapshot) return null;
    return currentSnapshot.units[selectedUnitId] ?? null;
  }, [selectedUnitId, currentSnapshot]);

  return {
    viewMode,
    setViewMode,
    replayTick,
    setReplayTick,
    playbackSpeed,
    setPlaybackSpeed,
    isPlaying,
    setIsPlaying,
    selectedUnitId,
    setSelectedUnitId,
    combatResult,
    setCombatResult,
    unitMeta,
    currentSnapshot,
    tickEvents,
    selectedUnitSnap,
  };
}
