import { useState, useMemo } from 'react';
import { PlacedChampion, HexCoord, RawChampion, RawItem, RawAugment } from '@/types';
import { BOARD_COLS, DEFAULT_STAR_LEVEL } from '@/lib/simulator/models/constants';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { canEquipItem, canAddPiltoverModule } from '@/lib/simulator/systems/item';
import { getDefaultStacks } from '@/lib/simulator/systems/augment';
import { FRELJORD_TURRET, TIBBERS_CHAMPION, AZIR_SOLDIER_CHAMPION, AZIR_MAX_SOLDIERS, isAutoUnit } from '@/data/specialUnits';
import type { IoniaPathType } from '@/data/traitModules';
import { RawTrait } from '@/types';

// === Helper functions ===

function getTeamFromRow(row: number): 'player' | 'enemy' {
  return row < 4 ? 'enemy' : 'player';
}

function parseCellId(id: string): { row: number; col: number } | null {
  const match = id.match(/^cell-(\d+)-(\d+)$/);
  if (!match) return null;
  return { row: parseInt(match[1]), col: parseInt(match[2]) };
}

function getFreljordTurretCount(team: PlacedChampion[]): number {
  const freljordCount = team.filter(p =>
    p.champion.traits.includes('프렐요드') && p.champion.apiName !== 'TFT16_FreljordTurret'
  ).length;
  if (freljordCount >= 7) return 2;
  if (freljordCount >= 5) return 2;
  if (freljordCount >= 3) return 1;
  return 0;
}

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

function syncFreljordTurretsInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const turretCount = getFreljordTurretCount(team);
  const currentTurrets = team.filter(p => p.champion.apiName === 'TFT16_FreljordTurret');
  const nonTurrets = team.filter(p => p.champion.apiName !== 'TFT16_FreljordTurret');

  if (turretCount === 0) {
    return currentTurrets.length > 0 ? nonTurrets : team;
  }

  if (currentTurrets.length === turretCount) return team;

  if (currentTurrets.length > turretCount) {
    return [...nonTurrets, ...currentTurrets.slice(0, turretCount)];
  }

  const result = [...nonTurrets, ...currentTurrets];
  const occupied = new Set(result.map(p => `${p.position.q},${p.position.r}`));
  for (let i = currentTurrets.length; i < turretCount; i++) {
    const pos = findEmptyAdjacentHex({ q: 1, r: 1 }, occupied, 3);
    if (pos) {
      result.push({ champion: FRELJORD_TURRET, position: pos, starLevel: 1, items: [] });
      occupied.add(`${pos.q},${pos.r}`);
    }
  }
  return result;
}

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

function syncAzirSoldiersInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const azir = team.find(p => p.champion.apiName === 'TFT16_Azir');
  const soldiers = team.filter(p => p.champion.apiName === 'TFT16_AzirSoldier');

  if (!azir) {
    return soldiers.length > 0 ? team.filter(p => p.champion.apiName !== 'TFT16_AzirSoldier') : team;
  }

  let result = team.map(p =>
    p.champion.apiName === 'TFT16_AzirSoldier' && p.starLevel !== azir.starLevel
      ? { ...p, starLevel: azir.starLevel } : p
  );

  const currentCount = soldiers.length;
  if (currentCount < AZIR_MAX_SOLDIERS) {
    const occupied = new Set(result.map(p => `${p.position.q},${p.position.r}`));
    for (let i = currentCount; i < AZIR_MAX_SOLDIERS; i++) {
      const pos = findEmptyAdjacentHex(azir.position, occupied);
      if (!pos) break;
      occupied.add(`${pos.q},${pos.r}`);
      result = [...result, {
        champion: AZIR_SOLDIER_CHAMPION,
        position: pos,
        starLevel: azir.starLevel,
        items: [],
      }];
    }
  }
  return result;
}

function syncTeam(team: PlacedChampion[]): PlacedChampion[] {
  return syncFreljordTurretsInTeam(syncAzirSoldiersInTeam(syncTibbersInTeam(team)));
}

// === Exported helpers used by DnD ===
export { getTeamFromRow, parseCellId };

// === Hook ===

export interface UseTeamManagementArgs {
  traits: RawTrait[];
}

export function useTeamManagement({ traits }: UseTeamManagementArgs) {
  const [playerTeam, setPlayerTeamRaw] = useState<PlacedChampion[]>([]);
  const [enemyTeam, setEnemyTeamRaw] = useState<PlacedChampion[]>([]);

  const updatePlayerTeam = (action: PlacedChampion[] | ((prev: PlacedChampion[]) => PlacedChampion[])) => {
    setPlayerTeamRaw(prev => {
      const updated = typeof action === 'function' ? action(prev) : action;
      return syncTeam(updated);
    });
  };
  const updateEnemyTeam = (action: PlacedChampion[] | ((prev: PlacedChampion[]) => PlacedChampion[])) => {
    setEnemyTeamRaw(prev => {
      const updated = typeof action === 'function' ? action(prev) : action;
      return syncTeam(updated);
    });
  };

  // Augment state
  const [playerAugments, setPlayerAugments] = useState<RawAugment[]>([]);
  const [playerAugmentStacks, setPlayerAugmentStacks] = useState<Record<string, number>>({});
  const [enemyAugments, setEnemyAugments] = useState<RawAugment[]>([]);
  const [enemyAugmentStacks, setEnemyAugmentStacks] = useState<Record<string, number>>({});
  const [showAugmentPicker, setShowAugmentPicker] = useState<'player' | 'enemy' | null>(null);
  const [augmentDetailTarget, setAugmentDetailTarget] = useState<{ aug: RawAugment; team: 'player' | 'enemy' } | null>(null);

  // Piltover module state
  const [playerPiltoverModules, setPlayerPiltoverModules] = useState<RawItem[]>([]);
  const [enemyPiltoverModules, setEnemyPiltoverModules] = useState<RawItem[]>([]);

  // Bilgewater stat purchases (apiName → count)
  const [playerBilgewaterStats, setPlayerBilgewaterStats] = useState<Record<string, number>>({});
  const [enemyBilgewaterStats, setEnemyBilgewaterStats] = useState<Record<string, number>>({});

  // Ionia path selection
  const [playerIoniaPath, setPlayerIoniaPath] = useState<IoniaPathType | null>(null);
  const [enemyIoniaPath, setEnemyIoniaPath] = useState<IoniaPathType | null>(null);

  // Galio bench (Hero synergy)
  const [playerGalio, setPlayerGalio] = useState<{ champion: RawChampion; starLevel: number } | null>(null);
  const [enemyGalio, setEnemyGalio] = useState<{ champion: RawChampion; starLevel: number } | null>(null);

  // Selected unit state
  const [selectedCell, setSelectedCell] = useState<HexCoord | null>(null);
  const [selectedCellTeam, setSelectedCellTeam] = useState<'player' | 'enemy'>('player');
  const [showPicker, setShowPicker] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<{ team: 'player' | 'enemy'; index: number } | null>(null);

  // Synergy calculation
  const playerTraits = useMemo(() => resolveTraits(playerTeam, traits), [playerTeam, traits]);
  const enemyTraits = useMemo(() => resolveTraits(enemyTeam, traits), [enemyTeam, traits]);

  // Selected placed unit
  const selectedPlaced = useMemo(() => {
    if (!selectedUnit) return null;
    const team = selectedUnit.team === 'player' ? playerTeam : enemyTeam;
    return team[selectedUnit.index] ?? null;
  }, [selectedUnit, playerTeam, enemyTeam]);

  // === Handlers ===

  const handleCellClick = (pos: HexCoord, team: 'player' | 'enemy') => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    const existing = teamArr.find(p => p.position.q === pos.q && p.position.r === pos.r);
    if (existing) {
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
      starLevel: DEFAULT_STAR_LEVEL,
      items: [],
    }]);
    setShowPicker(false);
  };

  const handleEquipItem = (team: 'player' | 'enemy', index: number, item: RawItem) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    const placed = teamArr[index];
    if (!placed) return;
    if (isAutoUnit(placed.champion.apiName)) return;

    const activeTraits = team === 'player' ? playerTraits : enemyTraits;
    const validation = canEquipItem(item, placed, activeTraits);
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
    const activeTraits = team === 'player' ? playerTraits : enemyTraits;
    const validation = canAddPiltoverModule(item, modules, activeTraits);
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
    if (teamArr[index] && isAutoUnit(teamArr[index].champion.apiName)) return;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      return { ...p, starLevel: level };
    }));
  };

  const handleRemoveUnit = (team: 'player' | 'enemy', index: number) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    if (teamArr[index] && isAutoUnit(teamArr[index].champion.apiName)) return;
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
    if (teamArr[index] && isAutoUnit(teamArr[index].champion.apiName)) return;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const next = p.starLevel >= 3 ? 1 : p.starLevel + 1;
      return { ...p, starLevel: next };
    }));
  };

  const handleBuyBilgewaterStat = (team: 'player' | 'enemy', item: RawItem) => {
    const setStat = team === 'player' ? setPlayerBilgewaterStats : setEnemyBilgewaterStats;
    setStat(prev => ({
      ...prev,
      [item.apiName]: (prev[item.apiName] ?? 0) + 1,
    }));
  };

  const handleRemoveBilgewaterStat = (team: 'player' | 'enemy', apiName: string) => {
    const setStat = team === 'player' ? setPlayerBilgewaterStats : setEnemyBilgewaterStats;
    setStat(prev => {
      const next = { ...prev };
      if (next[apiName] && next[apiName] > 1) {
        next[apiName]--;
      } else {
        delete next[apiName];
      }
      return next;
    });
  };

  const resetAll = () => {
    updatePlayerTeam([]);
    updateEnemyTeam([]);
    setSelectedUnit(null);
    setPlayerAugments([]);
    setPlayerAugmentStacks({});
    setEnemyAugments([]);
    setEnemyAugmentStacks({});
    setPlayerBilgewaterStats({});
    setEnemyBilgewaterStats({});
  };

  return {
    // Team state
    playerTeam,
    enemyTeam,
    updatePlayerTeam,
    updateEnemyTeam,

    // Augment state
    playerAugments,
    playerAugmentStacks,
    enemyAugments,
    enemyAugmentStacks,
    showAugmentPicker,
    setShowAugmentPicker,
    augmentDetailTarget,
    setAugmentDetailTarget,

    // Piltover modules
    playerPiltoverModules,
    enemyPiltoverModules,

    // Bilgewater stats
    playerBilgewaterStats,
    enemyBilgewaterStats,

    // Ionia path
    playerIoniaPath,
    setPlayerIoniaPath,
    enemyIoniaPath,
    setEnemyIoniaPath,

    // Galio bench
    playerGalio,
    setPlayerGalio,
    enemyGalio,
    setEnemyGalio,

    // Selection state
    selectedCell,
    selectedCellTeam,
    showPicker,
    setShowPicker,
    selectedUnit,
    setSelectedUnit,

    // Computed
    playerTraits,
    enemyTraits,
    selectedPlaced,

    // Handlers
    handleCellClick,
    handleUnitClick,
    handleChampionSelect,
    handleEquipItem,
    handleRemoveItem,
    handleAddPiltoverModule,
    handleRemovePiltoverModule,
    handleStarChange,
    handleRemoveUnit,
    handleAddAugment,
    handleRemoveAugment,
    handleAugmentStacksChange,
    handleCycleStars,
    handleBuyBilgewaterStat,
    handleRemoveBilgewaterStat,
    resetAll,
  };
}
