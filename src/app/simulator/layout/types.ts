import { Dispatch, SetStateAction } from 'react';
import { PlacedChampion, HexCoord, HexBuff, TeamPlannerEntry, RawChampion, RawItem, RawTrait, RawAugment, CombatLog } from '@/types';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useReplayControls } from '@/hooks/useReplayControls';
import { useDndHandlers } from '@/hooks/useDndHandlers';

export type ItemFilterTab = 'all' | 'component' | 'combined' | 'artifact' | 'emblem' | 'radiant';
export type PoolTab = 'champions' | 'items' | 'bilgewater';

export interface HexBuffState {
  player: HexBuff[];
  enemy: HexBuff[];
  overrides: Record<string, Record<string, HexCoord>>;
  setOverrides: Dispatch<SetStateAction<Record<string, Record<string, HexCoord>>>>;
  moving: { team: 'player' | 'enemy'; apiName: string } | null;
  setMoving: Dispatch<SetStateAction<{ team: 'player' | 'enemy'; apiName: string } | null>>;
}

export interface PoolFiltersState {
  champSearch: string;
  setChampSearch: Dispatch<SetStateAction<string>>;
  champCostFilter: number | null;
  setChampCostFilter: Dispatch<SetStateAction<number | null>>;
  itemSearch: string;
  setItemSearch: Dispatch<SetStateAction<string>>;
  itemCategoryFilter: ItemFilterTab;
  setItemCategoryFilter: Dispatch<SetStateAction<ItemFilterTab>>;
  activePoolTab: PoolTab;
  setActivePoolTab: Dispatch<SetStateAction<PoolTab>>;
}

export interface SimulatorLayoutProps {
  tm: ReturnType<typeof useTeamManagement>;
  replay: ReturnType<typeof useReplayControls>;
  dnd: ReturnType<typeof useDndHandlers>;
  data: {
    champions: RawChampion[];
    items: RawItem[];
    traits: RawTrait[];
    augments: RawAugment[];
    teamPlannerMapping: TeamPlannerEntry[];
  };
  hexBuffs: HexBuffState;
  stageNumber: number;
  setStageNumber: Dispatch<SetStateAction<number>>;
  isRunning: boolean;
  runSimulation: () => void;
  runMultiple: () => void;
  teamNames: { player: string | null; enemy: string | null };
  poolFilters: PoolFiltersState;
  logFilter: CombatLog['type'] | 'all';
  setLogFilter: Dispatch<SetStateAction<CombatLog['type'] | 'all'>>;
  showTeamCode: boolean;
  setShowTeamCode: Dispatch<SetStateAction<boolean>>;
  hoverUnit: { placed: PlacedChampion; rect: DOMRect } | null;
  setHoverUnit: Dispatch<SetStateAction<{ placed: PlacedChampion; rect: DOMRect } | null>>;
  returnTo: { matchId: string; puuid: string } | null;
  onBackToAnalysis: () => void;
  mappedPlayerForReplay: PlacedChampion[];
}
