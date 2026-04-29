import { Dispatch, SetStateAction } from 'react';
import { PlacedChampion, HexCoord, HexBuff, TeamPlannerEntry, RawChampion, RawItem, RawTrait, RawAugment, CombatLog } from '@/types';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useReplayControls } from '@/hooks/useReplayControls';
import { useDndHandlers } from '@/hooks/useDndHandlers';
import type { BottomSheetState } from '@/components/ui/bottomSheetLogic';

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
  /** A 팀(player) 별돌보미 강화 칸 좌표 (데이터 row 0-3 기준). */
  playerStargazerTiles: ReadonlyArray<HexCoord>;
  /** B 팀(enemy) 별돌보미 강화 칸 좌표. */
  enemyStargazerTiles: ReadonlyArray<HexCoord>;
  /** A 팀 별돌보미 활성 trait 정보 — hover tooltip 효과 텍스트 표시용. */
  playerStargazerInfo: { effectVariables: Record<string, number | null | undefined> | null; count: number };
  /** B 팀 동일. */
  enemyStargazerInfo: { effectVariables: Record<string, number | null | undefined> | null; count: number };
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
  /** 모바일 BottomSheet 상태 — 뷰포트 간 lift up 으로 DnD 핸들러에서 접근 */
  sheetState: BottomSheetState;
  setSheetState: Dispatch<SetStateAction<BottomSheetState>>;
  /** 그레이브즈 무기고 모달 open — SelectedUnitPanel 의 "편집" 버튼에서 호출. */
  onEditGravesWeapons?: (team: 'player' | 'enemy') => void;
}
