'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DndContext, DragOverlay, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useGameData } from '@/hooks/useGameData';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { PlacedChampion, HexCoord, axialToOffset, offsetToAxial, RawChampion, RawItem, RawAugment, CombatResult, CombatLog, TickSnapshot, DragData } from '@/types';
import { TICKS_PER_SECOND, BOARD_COLS } from '@/lib/simulator/models/constants';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import ChampionGrid from '@/components/builder/ChampionGrid';
import SetupBoard from '@/components/battle/SetupBoard';
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import ReplayBoard from '@/components/battle/ReplayBoard';
import BattleControls from '@/components/battle/BattleControls';
import UnitToken from '@/components/battle/UnitToken';
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
import { isStackable, getMaxStacks, getDefaultStacks } from '@/lib/simulator/systems/augment';
import { canEquipItem, canAddPiltoverModule, getItemCategory, isDisabledItem } from '@/lib/simulator/systems/item';

type ItemFilterTab = 'all' | 'component' | 'combined' | 'artifact' | 'emblem' | 'radiant';
import PiltoverModulePanel from '@/components/builder/PiltoverModulePanel';

type ViewMode = 'setup' | 'replay';

function getTeamFromRow(row: number): 'player' | 'enemy' {
  return row < 4 ? 'enemy' : 'player';
}

/** Parse droppable cell id → row, col */
function parseCellId(id: string): { row: number; col: number } | null {
  const match = id.match(/^cell-(\d+)-(\d+)$/);
  if (!match) return null;
  return { row: parseInt(match[1]), col: parseInt(match[2]) };
}

const TIBBERS_CHAMPION: RawChampion = {
  name: '티버',
  apiName: 'TFT16_AnnieTibbers',
  cost: 11,
  traits: ['비전 마법사'],
  role: null,
  stats: { armor: 80, attackSpeed: 0.75, critChance: 0.25, critMultiplier: 1.4, damage: 90, hp: 1500, initialMana: 40, magicResist: 80, mana: 100, range: 1 },
  ability: { name: '잉걸불의 분노', desc: '', icon: '', variables: [] },
};

function findEmptyAdjacentHex(pos: HexCoord, occupied: Set<string>, maxRow: number = 3): HexCoord | null {
  const offsets: HexCoord[] = [
    { q: 0, r: -1 }, { q: 1, r: -1 },
    { q: 1, r: 0 }, { q: -1, r: 0 },
    { q: 0, r: 1 }, { q: -1, r: 1 },
  ];
  for (const off of offsets) {
    const c = { q: pos.q + off.q, r: pos.r + off.r };
    const col = c.q + Math.floor(c.r / 2);
    if (c.r >= 0 && c.r <= maxRow && col >= 0 && col < BOARD_COLS) {
      if (!occupied.has(`${c.q},${c.r}`)) return c;
    }
  }
  for (let r = 0; r <= maxRow; r++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const q = col - Math.floor(r / 2);
      if (!occupied.has(`${q},${r}`)) return { q, r };
    }
  }
  return null;
}

/** Ensure Tibbers is present when Annie is, removed when Annie isn't, star synced */
function syncTibbersInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const annie = team.find(p => p.champion.apiName === 'TFT16_Annie');
  const tibbersIdx = team.findIndex(p => p.champion.apiName === 'TFT16_AnnieTibbers');

  if (!annie) {
    return tibbersIdx >= 0 ? team.filter((_, i) => i !== tibbersIdx) : team;
  }

  if (tibbersIdx >= 0) {
    if (team[tibbersIdx].starLevel !== annie.starLevel) {
      return team.map((p, i) => i === tibbersIdx ? { ...p, starLevel: annie.starLevel } : p);
    }
    return team;
  }

  const occupied = new Set(team.map(p => `${p.position.q},${p.position.r}`));
  const pos = findEmptyAdjacentHex(annie.position, occupied);
  if (!pos) return team;

  return [...team, { champion: TIBBERS_CHAMPION, position: pos, starLevel: annie.starLevel, items: [] }];
}

export default function SimulatorPage() {
  const { champions, items, traits, augments, teamPlannerMapping, loading } = useGameData();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [playerTeam, setPlayerTeamRaw] = useState<PlacedChampion[]>([]);
  const [enemyTeam, setEnemyTeamRaw] = useState<PlacedChampion[]>([]);

  const updatePlayerTeam = (action: PlacedChampion[] | ((prev: PlacedChampion[]) => PlacedChampion[])) => {
    setPlayerTeamRaw(prev => syncTibbersInTeam(typeof action === 'function' ? action(prev) : action));
  };
  const updateEnemyTeam = (action: PlacedChampion[] | ((prev: PlacedChampion[]) => PlacedChampion[])) => {
    setEnemyTeamRaw(prev => syncTibbersInTeam(typeof action === 'function' ? action(prev) : action));
  };
  // Augment state
  const [playerAugments, setPlayerAugments] = useState<RawAugment[]>([]);
  const [playerAugmentStacks, setPlayerAugmentStacks] = useState<Record<string, number>>({});
  const [enemyAugments, setEnemyAugments] = useState<RawAugment[]>([]);
  const [enemyAugmentStacks, setEnemyAugmentStacks] = useState<Record<string, number>>({});
  const [showAugmentPicker, setShowAugmentPicker] = useState<'player' | 'enemy' | null>(null);
  const [augmentDetailTarget, setAugmentDetailTarget] = useState<{ aug: RawAugment; team: 'player' | 'enemy' } | null>(null);

  // Piltover module state (per team)
  const [playerPiltoverModules, setPlayerPiltoverModules] = useState<RawItem[]>([]);
  const [enemyPiltoverModules, setEnemyPiltoverModules] = useState<RawItem[]>([]);

  const [selectedCell, setSelectedCell] = useState<HexCoord | null>(null);
  const [selectedCellTeam, setSelectedCellTeam] = useState<'player' | 'enemy'>('player');
  const [showPicker, setShowPicker] = useState(false);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logFilter, setLogFilter] = useState<CombatLog['type'] | 'all'>('all');
  const [selectedUnit, setSelectedUnit] = useState<{ team: 'player' | 'enemy'; index: number } | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);

  // Champion/Item pool state
  const [champSearch, setChampSearch] = useState('');
  const [champCostFilter, setChampCostFilter] = useState<number | null>(null);
  const [activePoolTab, setActivePoolTab] = useState<'champions' | 'items'>('champions');
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState<ItemFilterTab>('all');
  const [showTeamCode, setShowTeamCode] = useState(false);

  // Replay state
  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [replayTick, setReplayTick] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Synergy calculation
  const playerTraits = useMemo(() => resolveTraits(playerTeam, traits), [playerTeam, traits]);
  const enemyTraits = useMemo(() => resolveTraits(enemyTeam, traits), [enemyTeam, traits]);

  // Selected placed unit
  const selectedPlaced = useMemo(() => {
    if (!selectedUnit) return null;
    const team = selectedUnit.team === 'player' ? playerTeam : enemyTeam;
    return team[selectedUnit.index] ?? null;
  }, [selectedUnit, playerTeam, enemyTeam]);

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

  // Replay auto-play
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

  const handleCellClick = (pos: HexCoord, team: 'player' | 'enemy') => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    const existing = teamArr.find(p => p.position.q === pos.q && p.position.r === pos.r);
    if (existing) {
      // Click on occupied cell → select unit
      const idx = teamArr.indexOf(existing);
      setSelectedUnit({ team, index: idx });
    } else {
      setSelectedCell(pos);
      setSelectedCellTeam(team);
      setShowPicker(true);
    }
  };

  const handleUnitClick = (team: 'player' | 'enemy', index: number) => {
    setSelectedUnit(prev => {
      if (prev?.team === team && prev?.index === index) return null;
      return { team, index };
    });
  };

  const handleChampionSelect = (champion: RawChampion) => {
    if (!selectedCell) return;
    const team = selectedCellTeam;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => [...prev, {
      champion,
      position: selectedCell,
      starLevel: 1,
      items: [],
    }]);
    setShowPicker(false);
  };

  const handleEquipItem = (team: 'player' | 'enemy', index: number, item: RawItem) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    const placed = teamArr[index];
    if (!placed) return;

    const traits = team === 'player' ? playerTraits : enemyTraits;
    const validation = canEquipItem(item, placed, traits);
    if (!validation.canEquip) return;

    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      return { ...p, items: [...p.items, item] };
    }));
  };

  const handleRemoveItem = (team: 'player' | 'enemy', index: number, itemIdx: number) => {
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      return { ...p, items: p.items.filter((_item: RawItem, ii: number) => ii !== itemIdx) };
    }));
  };

  const handleAddPiltoverModule = (team: 'player' | 'enemy', item: RawItem) => {
    const modules = team === 'player' ? playerPiltoverModules : enemyPiltoverModules;
    const traits = team === 'player' ? playerTraits : enemyTraits;
    const validation = canAddPiltoverModule(item, modules, traits);
    if (!validation.canEquip) return;

    const setModules = team === 'player' ? setPlayerPiltoverModules : setEnemyPiltoverModules;
    setModules(prev => [...prev, item]);
  };

  const handleRemovePiltoverModule = (team: 'player' | 'enemy', index: number) => {
    const setModules = team === 'player' ? setPlayerPiltoverModules : setEnemyPiltoverModules;
    setModules(prev => prev.filter((_, i) => i !== index));
  };

  const handleStarChange = (team: 'player' | 'enemy', index: number, level: number) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    if (teamArr[index]?.champion.apiName === 'TFT16_AnnieTibbers') return;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      return { ...p, starLevel: level };
    }));
  };

  const handleRemoveUnit = (team: 'player' | 'enemy', index: number) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    if (teamArr[index]?.champion.apiName === 'TFT16_AnnieTibbers') return;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.filter((_, i) => i !== index));
    setSelectedUnit(null);
  };

  const handleAddAugment = (team: 'player' | 'enemy', aug: RawAugment) => {
    const setAugs = team === 'player' ? setPlayerAugments : setEnemyAugments;
    const setStacks = team === 'player' ? setPlayerAugmentStacks : setEnemyAugmentStacks;
    setAugs(prev => {
      if (prev.length >= 3) return prev;
      return [...prev, aug];
    });
    const startStacks = getDefaultStacks(aug);
    setStacks(prev => ({ ...prev, [aug.apiName]: startStacks }));
    setShowAugmentPicker(null);
  };

  const handleRemoveAugment = (team: 'player' | 'enemy', index: number) => {
    const augs = team === 'player' ? playerAugments : enemyAugments;
    const removed = augs[index];
    const setAugs = team === 'player' ? setPlayerAugments : setEnemyAugments;
    const setStacks = team === 'player' ? setPlayerAugmentStacks : setEnemyAugmentStacks;
    setAugs(prev => prev.filter((_, i) => i !== index));
    if (removed) {
      setStacks(prev => {
        const next = { ...prev };
        delete next[removed.apiName];
        return next;
      });
    }
  };

  const handleAugmentStacksChange = (team: 'player' | 'enemy', apiName: string, count: number) => {
    const setStacks = team === 'player' ? setPlayerAugmentStacks : setEnemyAugmentStacks;
    setStacks(prev => ({ ...prev, [apiName]: count }));
  };

  const handleCycleStars = (team: 'player' | 'enemy', index: number) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    if (teamArr[index]?.champion.apiName === 'TFT16_AnnieTibbers') return;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const next = p.starLevel >= 3 ? 1 : p.starLevel + 1;
      return { ...p, starLevel: next };
    }));
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) setActiveDragData(data);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragData(null);
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as DragData | undefined;
    if (!dragData) return;

    const cellInfo = parseCellId(over.id as string);
    if (!cellInfo) return;

    const { row, col } = cellInfo;
    const team = getTeamFromRow(row);
    const dataRow = team === 'player' ? row - 4 : row;
    const pos: HexCoord = { q: col - Math.floor(dataRow / 2), r: dataRow };
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;

    const existingIdx = teamArr.findIndex(p => {
      const off = axialToOffset(p.position);
      return off.row === dataRow && off.col === col;
    });

    if (dragData.type === 'champion') {
      if (existingIdx >= 0) return; // occupied
      setTeam(prev => [...prev, { champion: dragData.champion, position: pos, starLevel: 1, items: [] }]);
    } else if (dragData.type === 'placed-unit') {
      // Move/swap within same team only
      if (dragData.team !== team) return;
      const srcIdx = teamArr.findIndex(p => {
        const off = axialToOffset(p.position);
        const srcOff = axialToOffset(dragData.position);
        return off.row === srcOff.row && off.col === srcOff.col;
      });
      if (srcIdx < 0) return;

      if (existingIdx >= 0 && existingIdx !== srcIdx) {
        // Swap
        setTeam(prev => prev.map((p, i) => {
          if (i === srcIdx) return { ...p, position: prev[existingIdx].position };
          if (i === existingIdx) return { ...p, position: prev[srcIdx].position };
          return p;
        }));
      } else if (existingIdx < 0) {
        // Move
        setTeam(prev => prev.map((p, i) => {
          if (i === srcIdx) return { ...p, position: pos };
          return p;
        }));
      }
    } else if (dragData.type === 'item') {
      if (existingIdx < 0) return; // no unit to equip
      handleEquipItem(team, existingIdx, dragData.item);
    }
  };

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
    if (playerTeam.length === 0 || enemyTeam.length === 0) return;
    setIsRunning(true);
    setCombatResult(null);
    setIsPlaying(false);
    setReplayTick(0);

    setTimeout(() => {
      const mappedPlayer = toEightRowCoords(playerTeam, 4);
      const result = simulateCombat(mappedPlayer, enemyTeam, {
        seed: 42, allTraits: traits, skipMirror: true,
        playerAugments, playerAugmentStacks,
        enemyAugments, enemyAugmentStacks,
      });
      setCombatResult(result);
      setIsRunning(false);
      setViewMode('replay');
      setReplayTick(0);
      setIsPlaying(true);
    }, 100);
  }, [playerTeam, enemyTeam, traits, playerAugments, playerAugmentStacks, enemyAugments, enemyAugmentStacks, toEightRowCoords]);

  const runMultiple = useCallback(() => {
    if (playerTeam.length === 0 || enemyTeam.length === 0) return;
    setIsRunning(true);
    setTimeout(() => {
      const mappedPlayer = toEightRowCoords(playerTeam, 4);
      let playerWins = 0;
      let enemyWins = 0;
      let draws = 0;
      const N = 100;
      let lastResult: CombatResult | null = null;
      for (let i = 0; i < N; i++) {
        const r = simulateCombat(mappedPlayer, enemyTeam, {
          seed: i + 1, allTraits: traits, skipMirror: true,
          playerAugments, playerAugmentStacks,
          enemyAugments, enemyAugmentStacks,
        });
        if (r.winner === 'player') playerWins++;
        else if (r.winner === 'enemy') enemyWins++;
        else draws++;
        lastResult = r;
      }
      if (lastResult) {
        (lastResult as CombatResult & { multiSim?: { playerWins: number; enemyWins: number; draws: number; total: number } }).multiSim = {
          playerWins, enemyWins, draws, total: N,
        };
      }
      setCombatResult(lastResult);
      setIsRunning(false);
      setViewMode('replay');
      setReplayTick(lastResult ? lastResult.snapshots.length - 1 : 0);
    }, 100);
  }, [playerTeam, enemyTeam, traits, playerAugments, playerAugmentStacks, enemyAugments, enemyAugmentStacks, toEightRowCoords]);

  const filteredLogs = useMemo(() => {
    if (!combatResult) return [];
    if (logFilter === 'all') return combatResult.logs.slice(-200);
    return combatResult.logs.filter(l => l.type === logFilter).slice(-200);
  }, [combatResult, logFilter]);

  const multiSim = combatResult && (combatResult as CombatResult & { multiSim?: { playerWins: number; enemyWins: number; draws: number; total: number } }).multiSim;

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh] text-gray-500">데이터 로딩 중...</div>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-200">전투 시뮬레이션</h2>
            {combatResult && (
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode('setup')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    viewMode === 'setup' ? 'bg-blue-600 text-white' : 'bg-[#1f2937] text-gray-400'
                  }`}
                >
                  편집
                </button>
                <button
                  onClick={() => setViewMode('replay')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    viewMode === 'replay' ? 'bg-purple-600 text-white' : 'bg-[#1f2937] text-gray-400'
                  }`}
                >
                  리플레이
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { updatePlayerTeam([]); updateEnemyTeam([]); setSelectedUnit(null); setPlayerAugments([]); setPlayerAugmentStacks({}); setEnemyAugments([]); setEnemyAugmentStacks({}); }}
              className="px-3 py-2 bg-[#1f2937] text-gray-500 hover:text-red-400 rounded-lg text-xs"
            >
              전체 초기화
            </button>
            <button
              onClick={() => setShowTeamCode(prev => !prev)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                showTeamCode ? 'bg-teal-600 text-white' : 'bg-[#1f2937] text-gray-400 hover:text-teal-300'
              }`}
            >
              팀 코드
            </button>
            <button
              onClick={runSimulation}
              disabled={isRunning || playerTeam.length === 0 || enemyTeam.length === 0}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-sm font-bold text-black transition-colors"
            >
              {isRunning ? '전투 중...' : '전투 시작'}
            </button>
            <button
              onClick={runMultiple}
              disabled={isRunning || playerTeam.length === 0 || enemyTeam.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-sm font-bold text-white transition-colors"
            >
              100회 시뮬
            </button>
          </div>
        </div>

        {/* Team Code Panel */}
        {showTeamCode && (
          <TeamCodePanel
            playerTeam={playerTeam}
            enemyTeam={enemyTeam}
            champions={champions}
            teamPlannerMapping={teamPlannerMapping}
            onImport={(team, imported) => {
              if (team === 'player') updatePlayerTeam(imported);
              else updateEnemyTeam(imported);
              setSelectedUnit(null);
            }}
          />
        )}

        {/* ====== SETUP MODE ====== */}
        {viewMode === 'setup' && (
          <>
            {/* 3-column: Synergy panels (left) | Board (center) | Champion/Item pool (right) */}
            <div className="flex gap-3">
              {/* Left: Both Synergy panels + Selected unit */}
              <div className="w-52 shrink-0 space-y-3">
                <SynergyPanel activeTraits={playerTraits} team="player" items={items} />
                <PiltoverModulePanel
                  modules={playerPiltoverModules}
                  allItems={items}
                  activeTraits={playerTraits}
                  onAddModule={(item) => handleAddPiltoverModule('player', item)}
                  onRemoveModule={(idx) => handleRemovePiltoverModule('player', idx)}
                />
                <SynergyPanel activeTraits={enemyTraits} team="enemy" items={items} />
                <PiltoverModulePanel
                  modules={enemyPiltoverModules}
                  allItems={items}
                  activeTraits={enemyTraits}
                  onAddModule={(item) => handleAddPiltoverModule('enemy', item)}
                  onRemoveModule={(idx) => handleRemovePiltoverModule('enemy', idx)}
                />
                {selectedUnit && selectedPlaced && (
                  <SelectedUnitPanel
                    placed={selectedPlaced}
                    team={selectedUnit.team}
                    allItems={items}
                    activeTraits={selectedUnit.team === 'player' ? playerTraits : enemyTraits}
                    onStarChange={(level) => handleStarChange(selectedUnit.team, selectedUnit.index, level)}
                    onEquipItem={(item) => handleEquipItem(selectedUnit.team, selectedUnit.index, item)}
                    onRemoveItem={(itemIdx) => handleRemoveItem(selectedUnit.team, selectedUnit.index, itemIdx)}
                    onRemoveUnit={() => handleRemoveUnit(selectedUnit.team, selectedUnit.index)}
                  />
                )}
              </div>

              {/* Center: 8-row board with droppable overlay */}
              <div className="flex-1 min-w-0">
                <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-3 flex justify-center">
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <SetupBoard
                      playerChampions={playerTeam}
                      enemyChampions={enemyTeam}
                      onCellClick={handleCellClick}
                      onUnitClick={handleUnitClick}
                      onUnitRightClick={handleRemoveUnit}
                      onUnitCycleStars={handleCycleStars}
                      selectedCell={selectedCell}
                      selectedUnit={selectedUnit}
                    />
                    {/* Droppable overlay */}
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
                            if (placed && placedIdx >= 0) {
                              handleCycleStars(team, placedIdx);
                            } else {
                              const pos = offsetToAxial({ row: dataRow, col });
                              handleCellClick(pos, team);
                            }
                          };
                          const cellDblClick = () => {
                            if (placed && placedIdx >= 0) {
                              handleUnitClick(team, placedIdx);
                            }
                          };
                          const cellContextMenu = (e: React.MouseEvent) => {
                            e.preventDefault();
                            if (placed && placedIdx >= 0) {
                              handleRemoveUnit(team, placedIdx);
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
                              onDoubleClick={cellDblClick}
                              onContextMenu={cellContextMenu}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
                {/* Augment slots under the board */}
                <div className="mt-2 flex justify-between px-2">
                  <div>
                    <div className="text-[9px] text-red-400 font-bold mb-1">TEAM B 증강</div>
                    <AugmentSlots
                      augments={enemyAugments}
                      augmentStacks={enemyAugmentStacks}
                      onOpenSelector={() => setShowAugmentPicker('enemy')}
                      onOpenDetail={(aug) => setAugmentDetailTarget({ aug, team: 'enemy' })}
                      onRemove={(i) => handleRemoveAugment('enemy', i)}
                    />
                  </div>
                  <div>
                    <div className="text-[9px] text-blue-400 font-bold mb-1">TEAM A 증강</div>
                    <AugmentSlots
                      augments={playerAugments}
                      augmentStacks={playerAugmentStacks}
                      onOpenSelector={() => setShowAugmentPicker('player')}
                      onOpenDetail={(aug) => setAugmentDetailTarget({ aug, team: 'player' })}
                      onRemove={(i) => handleRemoveAugment('player', i)}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Champion/Item pool */}
              <div className="w-64 shrink-0 bg-[#111827] rounded-xl border border-gray-800 p-3 flex flex-col self-start" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                <div className="flex gap-2 mb-3 shrink-0">
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
                        if (cat === 'piltover' || cat === 'special') return false;
                        if (cat === 'bilgewater') {
                          const bgTrait = playerTraits.find(t => t.trait.apiName === 'TFT16_Bilgewater')
                            ?? enemyTraits.find(t => t.trait.apiName === 'TFT16_Bilgewater');
                          if (!bgTrait || !bgTrait.activeEffect) return false;
                          if (Object.keys(item.effects).length === 0) return false;
                        }
                        if (cat === 'void') {
                          const voidTrait = playerTraits.find(t => t.trait.apiName === 'TFT16_Void')
                            ?? enemyTraits.find(t => t.trait.apiName === 'TFT16_Void');
                          if (!voidTrait || !voidTrait.activeEffect) return false;
                        }
                        if (itemSearch && !item.name.toLowerCase().includes(itemSearch.toLowerCase())) return false;
                        if (itemCategoryFilter !== 'all') {
                          if (cat === 'bilgewater' || cat === 'void' || cat === 'darkin') {
                            if (itemCategoryFilter !== 'combined') return false;
                          } else if (cat !== itemCategoryFilter) return false;
                        }
                        // 상징/찬란은 always show when filter is 'all'
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
        {viewMode === 'replay' && combatResult && (
          <>
            {/* Winner banner */}
            <div className={`text-center p-4 rounded-xl border ${
              combatResult.winner === 'player' ? 'bg-blue-600/10 border-blue-600/30' :
              combatResult.winner === 'enemy' ? 'bg-red-600/10 border-red-600/30' :
              'bg-gray-600/10 border-gray-600/30'
            }`}>
              <div className="text-2xl font-black">
                {combatResult.winner === 'player' ? 'TEAM A 승리!' :
                 combatResult.winner === 'enemy' ? 'TEAM B 승리!' : '무승부'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                전투 시간: {combatResult.duration.toFixed(1)}초
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
              currentTick={replayTick}
              totalTicks={combatResult.snapshots.length}
              playbackSpeed={playbackSpeed}
              isPlaying={isPlaying}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onStepForward={() => setReplayTick(prev => Math.min(prev + 1, combatResult.snapshots.length - 1))}
              onStepBack={() => setReplayTick(prev => Math.max(prev - 1, 0))}
              onSeek={setReplayTick}
              onSpeedChange={setPlaybackSpeed}
              ticksPerSecond={TICKS_PER_SECOND}
            />

            {/* Replay Board + Unit Detail side panel */}
            <div className="flex gap-4">
              {/* Board */}
              <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-3 flex justify-center flex-1 min-w-0">
                <ReplayBoard
                  snapshot={currentSnapshot}
                  unitMeta={unitMeta}
                  selectedUnitId={selectedUnitId}
                  onUnitClick={setSelectedUnitId}
                />
              </div>

              {/* Unit detail panel */}
              <div className="w-56 shrink-0 space-y-3">
                {selectedUnitId && selectedUnitSnap && unitMeta[selectedUnitId] && (
                  <div className="bg-[#111827] rounded-xl border border-gray-800 p-3 space-y-2">
                    <UnitToken
                      championName={unitMeta[selectedUnitId].championName}
                      championApiName={unitMeta[selectedUnitId].championApiName}
                      cost={unitMeta[selectedUnitId].cost}
                      currentHp={selectedUnitSnap.currentHp}
                      maxHp={unitMeta[selectedUnitId].maxHp}
                      currentMana={selectedUnitSnap.currentMana}
                      maxMana={unitMeta[selectedUnitId].maxMana}
                      starLevel={unitMeta[selectedUnitId].starLevel}
                      items={unitMeta[selectedUnitId].items}
                      statusEffects={selectedUnitSnap.statusEffects}
                      isAlive={selectedUnitSnap.isAlive}
                      team={unitMeta[selectedUnitId].team}
                      isSelected
                      size="md"
                    />
                    <div className="text-[10px] text-gray-400 space-y-0.5">
                      <div className="flex justify-between">
                        <span>HP</span>
                        <span className="text-green-400">{Math.round(selectedUnitSnap.currentHp)} / {Math.round(unitMeta[selectedUnitId].maxHp)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mana</span>
                        <span className="text-blue-400">{Math.round(selectedUnitSnap.currentMana)} / {unitMeta[selectedUnitId].maxMana}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>위치</span>
                        <span className="text-gray-300">
                          ({(() => { const off = axialToOffset(selectedUnitSnap.position as HexCoord); return `${off.row}, ${off.col}`; })()})
                        </span>
                      </div>
                      {selectedUnitSnap.statusEffects.length > 0 && (
                        <div className="pt-1 border-t border-gray-700">
                          <span className="text-yellow-400">상태이상:</span>
                          {selectedUnitSnap.statusEffects.map((e, i) => (
                            <div key={i} className="text-yellow-300 pl-2">
                              {e.type} ({e.remainingTicks}t)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* All units list */}
                <div className="bg-[#111827] rounded-xl border border-gray-800 p-2 space-y-1 max-h-[400px] overflow-y-auto">
                  <div className="text-[9px] font-bold text-blue-400 px-1">TEAM A</div>
                  {combatResult.playerUnits.map((u) => {
                    const snap = currentSnapshot?.units[u.id];
                    if (!snap) return null;
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUnitId(u.id)}
                        className={`flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer transition-colors ${
                          selectedUnitId === u.id ? 'bg-blue-900/30' : 'hover:bg-[#1f2937]'
                        } ${!snap.isAlive ? 'opacity-30' : ''}`}
                      >
                        <UnitToken
                          championName={u.champion.name}
                          championApiName={u.champion.apiName}
                          cost={u.champion.cost}
                          currentHp={snap.currentHp}
                          maxHp={u.maxHp}
                          currentMana={snap.currentMana}
                          maxMana={u.maxMana}
                          starLevel={u.starLevel}
                          items={u.items.map(it => ({ apiName: it.apiName }))}
                          statusEffects={snap.statusEffects}
                          isAlive={snap.isAlive}
                          team="player"
                          size="sm"
                        />
                      </div>
                    );
                  })}
                  <div className="text-[9px] font-bold text-red-400 px-1 pt-1">TEAM B</div>
                  {combatResult.enemyUnits.map((u) => {
                    const snap = currentSnapshot?.units[u.id];
                    if (!snap) return null;
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUnitId(u.id)}
                        className={`flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer transition-colors ${
                          selectedUnitId === u.id ? 'bg-red-900/30' : 'hover:bg-[#1f2937]'
                        } ${!snap.isAlive ? 'opacity-30' : ''}`}
                      >
                        <UnitToken
                          championName={u.champion.name}
                          championApiName={u.champion.apiName}
                          cost={u.champion.cost}
                          currentHp={snap.currentHp}
                          maxHp={u.maxHp}
                          currentMana={snap.currentMana}
                          maxMana={u.maxMana}
                          starLevel={u.starLevel}
                          items={u.items.map(it => ({ apiName: it.apiName }))}
                          statusEffects={snap.statusEffects}
                          isAlive={snap.isAlive}
                          team="enemy"
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tick events */}
            {tickEvents.length > 0 && (
              <div className="bg-[#111827] rounded-lg border border-gray-800 p-2">
                <div className="text-[10px] font-bold text-gray-500 mb-1">현재 틱 이벤트</div>
                <div className="space-y-0.5 font-mono text-[10px] max-h-[80px] overflow-y-auto">
                  {tickEvents.map((e, i) => (
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
        {viewMode === 'setup' && combatResult && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-[#111827] rounded-lg border border-gray-800">
              <h4 className="text-xs font-bold text-blue-400 mb-2">TEAM A 유닛</h4>
              {combatResult.playerUnits.map((u) => (
                <div key={u.id} className={`flex items-center gap-2 py-1 ${u.state === 'dead' ? 'opacity-40' : ''}`}>
                  <span className="text-xs text-gray-300 flex-1">{u.champion.name}</span>
                  <span className="text-xs text-green-400">{Math.round(u.currentHp)}/{Math.round(u.maxHp)}</span>
                  <span className="text-xs text-red-400">{Math.round(u.totalDamageDealt)} dmg</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-[#111827] rounded-lg border border-gray-800">
              <h4 className="text-xs font-bold text-red-400 mb-2">TEAM B 유닛</h4>
              {combatResult.enemyUnits.map((u) => (
                <div key={u.id} className={`flex items-center gap-2 py-1 ${u.state === 'dead' ? 'opacity-40' : ''}`}>
                  <span className="text-xs text-gray-300 flex-1">{u.champion.name}</span>
                  <span className="text-xs text-green-400">{Math.round(u.currentHp)}/{Math.round(u.maxHp)}</span>
                  <span className="text-xs text-red-400">{Math.round(u.totalDamageDealt)} dmg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Champion picker modal (for cell click) */}
        <Modal isOpen={showPicker} onClose={() => setShowPicker(false)} title="챔피언 선택">
          <ChampionGrid champions={champions} onSelect={handleChampionSelect} />
        </Modal>

        {/* Augment picker modal */}
        <Modal isOpen={showAugmentPicker !== null} onClose={() => setShowAugmentPicker(null)} title="증강 선택">
          {showAugmentPicker && (
            <AugmentSelector
              augments={augments}
              onSelect={(aug) => handleAddAugment(showAugmentPicker, aug)}
              selectedApiNames={[...playerAugments, ...enemyAugments].map(a => a.apiName)}
            />
          )}
        </Modal>

        {/* Augment detail popup */}
        <AugmentDetailPopup
          augment={augmentDetailTarget?.aug ?? null}
          stacks={augmentDetailTarget ? (augmentDetailTarget.team === 'player' ? playerAugmentStacks : enemyAugmentStacks)[augmentDetailTarget.aug.apiName] ?? 1 : 1}
          onStacksChange={(count) => {
            if (augmentDetailTarget) {
              handleAugmentStacksChange(augmentDetailTarget.team, augmentDetailTarget.aug.apiName, count);
            }
          }}
          onClose={() => setAugmentDetailTarget(null)}
        />

        {/* DragOverlay */}
        <DragOverlay>
          {activeDragData?.type === 'champion' && (
            <div style={{ opacity: 0.7 }}>
              <ChampionCard champion={activeDragData.champion} size={48} showName={false} />
            </div>
          )}
          {activeDragData?.type === 'placed-unit' && (() => {
            const teamArr = activeDragData.team === 'player' ? playerTeam : enemyTeam;
            const placed = teamArr.find(p => p.position.q === activeDragData.position.q && p.position.r === activeDragData.position.r);
            if (!placed) return null;
            return (
              <div style={{ opacity: 0.7 }}>
                <ChampionCard champion={placed.champion} size={48} showName={false} starLevel={placed.starLevel} />
              </div>
            );
          })()}
          {activeDragData?.type === 'item' && (
            <div style={{ opacity: 0.7 }}>
              <ItemIcon item={activeDragData.item} size={32} showTooltip={false} />
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
