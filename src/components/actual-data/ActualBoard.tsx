'use client';

import { useMemo, MouseEvent } from 'react';
import type { RawChampion, RawItem, RawTrait, PlacedChampion } from '@/types';
import { axialToOffset } from '@/types';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import SetupBoardCore from '@/components/battle/SetupBoardCore';
import DroppableHexCell from '@/components/battle/DroppableHexCell';
import { useActualDataStore } from '@/store/actualDataSlice';
import { toPlacedChampion } from '@/lib/actualData/unitAdapter';
import type { PlacedUnit, TeamSnapshot, OpponentSnapshot, StargazerConstellationId } from '@/lib/actualData/types';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { CONSTELLATION_TILE_PATTERN } from '@/lib/actualData/stargazerMapping';
import ActualItemSlotsOverlay from './ActualItemSlotsOverlay';

interface ActualBoardProps {
  roundIndex: number;
  champions: RawChampion[];
  items: RawItem[];
  /** 트레잇 활성 검사용 — 별돌보미(3+) 시너지 발동 여부 판정. */
  traits: RawTrait[];
  /** 게임-level 별자리 (각 팀에 동일 적용). 미설정 또는 별돌보미 미활성 팀은 강화 칸 미표시. */
  stargazerConstellation: StargazerConstellationId | null;
  cellSize?: number;
}

/**
 * Hex board for the actual-data PvP round editor.
 *
 * Mirrors the /simulator SetupBoard:
 *   - Opponent team at top rows (0-3, stored as `opponent.units`)
 *   - Player team at bottom rows (4-7, stored as `playerTeam.units`)
 *
 * Reads the PvP round directly from the zustand store so drag handlers don't need
 * to be re-wired via prop drilling. Emits changes through updatePlayerTeam /
 * updateOpponent.
 */
export default function ActualBoard({ roundIndex, champions, items, traits, stargazerConstellation, cellSize = 44 }: ActualBoardProps) {
  const round = useActualDataStore(s => {
    const r = s.currentGame?.rounds[roundIndex];
    return r && r.type === 'pvp' ? r : null;
  });
  const updatePlayerTeam = useActualDataStore(s => s.updatePlayerTeam);
  const updateOpponent = useActualDataStore(s => s.updateOpponent);

  const championCatalog = useMemo(() => new Map(champions.map(c => [c.apiName, c])), [champions]);
  const itemCatalog = useMemo(() => new Map(items.map(i => [i.apiName, i])), [items]);

  const playerPlaced = useMemo<PlacedChampion[]>(() => {
    if (!round) return [];
    return round.playerTeam.units
      .map(u => toPlacedChampion(u, championCatalog, itemCatalog))
      .filter((p): p is PlacedChampion => p !== null);
  }, [round, championCatalog, itemCatalog]);

  const enemyPlaced = useMemo<PlacedChampion[]>(() => {
    if (!round) return [];
    return round.opponent.units
      .map(u => toPlacedChampion(u, championCatalog, itemCatalog))
      .filter((p): p is PlacedChampion => p !== null);
  }, [round, championCatalog, itemCatalog]);

  // 별돌보미(3+) 활성 시 강화 칸 표시 (게임-level 별자리 + 팀별 활성 검사).
  // resolveTraits 에 stargazerConstellation 옵션을 넘기면 base 'TFT17_Stargazer' 가 변종
  // (TFT17_Stargazer_Wolf 등) 으로 mapping 되어 activeEffect.variables 에 별자리별 수치 포함.
  const playerStargazerActive = useMemo(() => {
    if (!stargazerConstellation || traits.length === 0 || playerPlaced.length === 0) return null;
    const active = resolveTraits(playerPlaced, traits, { stargazerConstellation });
    const sg = active.find(t => t.trait.name === '별돌보미' && t.style > 0);
    return sg && sg.count >= 3 ? sg : null;
  }, [stargazerConstellation, traits, playerPlaced]);

  const enemyStargazerActive = useMemo(() => {
    if (!stargazerConstellation || traits.length === 0 || enemyPlaced.length === 0) return null;
    const active = resolveTraits(enemyPlaced, traits, { stargazerConstellation });
    const sg = active.find(t => t.trait.name === '별돌보미' && t.style > 0);
    return sg && sg.count >= 3 ? sg : null;
  }, [stargazerConstellation, traits, enemyPlaced]);

  const playerStargazerTiles = useMemo(
    () => (playerStargazerActive && stargazerConstellation
      ? CONSTELLATION_TILE_PATTERN[stargazerConstellation]
      : []),
    [playerStargazerActive, stargazerConstellation],
  );
  const enemyStargazerTiles = useMemo(
    () => (enemyStargazerActive && stargazerConstellation
      ? CONSTELLATION_TILE_PATTERN[stargazerConstellation]
      : []),
    [enemyStargazerActive, stargazerConstellation],
  );

  if (!round) return null;

  /** Remove the unit at the given hex (context-menu shortcut). */
  const handleRemoveUnit = (team: 'player' | 'enemy', index: number) => {
    if (team === 'player') {
      const nextUnits = round.playerTeam.units.filter((_, i) => i !== index);
      updatePlayerTeam(roundIndex, { units: nextUnits });
    } else {
      const nextUnits = round.opponent.units.filter((_, i) => i !== index);
      updateOpponent(roundIndex, { units: nextUnits });
    }
  };

  /** Clear a single item slot on a unit at the given hex. */
  const handleRemoveItemSlot = (team: 'player' | 'enemy', hexKey: string, slotIdx: 0 | 1 | 2) => {
    const units = team === 'player' ? round.playerTeam.units : round.opponent.units;
    const unitIdx = units.findIndex(u => `${u.hex.q},${u.hex.r}` === hexKey);
    if (unitIdx < 0) return;
    const target = units[unitIdx];
    const nextItems = [...target.items] as PlacedUnit['items'];
    nextItems[slotIdx] = undefined;
    const nextUnits = units.map((u, i) => (i === unitIdx ? { ...u, items: nextItems } : u));
    if (team === 'player') updatePlayerTeam(roundIndex, { units: nextUnits });
    else updateOpponent(roundIndex, { units: nextUnits });
  };

  /** 1★ → 2★ → 3★ → 1★ cycle on unit click (matches /simulator). */
  const handleCycleStars = (team: 'player' | 'enemy', index: number) => {
    const snap: TeamSnapshot | OpponentSnapshot = team === 'player' ? round.playerTeam : round.opponent;
    const u = snap.units[index];
    if (!u) return;
    const next: 1 | 2 | 3 = u.starLevel === 1 ? 2 : u.starLevel === 2 ? 3 : 1;
    const nextUnits: PlacedUnit[] = snap.units.map((x, i) => i === index ? { ...x, starLevel: next } : x);
    if (team === 'player') updatePlayerTeam(roundIndex, { units: nextUnits });
    else updateOpponent(roundIndex, { units: nextUnits });
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <SetupBoardCore
        playerChampions={playerPlaced}
        enemyChampions={enemyPlaced}
        onCellClick={() => { /* empty cells handled via overlay; parent uses click on champion sidebar */ }}
        onUnitClick={handleRemoveUnit}
        onUnitRightClick={handleRemoveUnit}
        onUnitCycleStars={handleCycleStars}
        playerStargazerTiles={playerStargazerTiles}
        enemyStargazerTiles={enemyStargazerTiles}
        playerStargazerConstellation={playerStargazerActive ? stargazerConstellation : null}
        enemyStargazerConstellation={enemyStargazerActive ? stargazerConstellation : null}
        playerStargazerEffectVariables={playerStargazerActive?.activeEffect?.variables ?? null}
        enemyStargazerEffectVariables={enemyStargazerActive?.activeEffect?.variables ?? null}
        playerStargazerCount={playerStargazerActive?.count ?? 0}
        enemyStargazerCount={enemyStargazerActive?.count ?? 0}
        cellSize={cellSize}
      />

      {/* Droppable + draggable overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: BOARD_COLS }, (_, col) => {
            const team: 'player' | 'enemy' = row < 4 ? 'enemy' : 'player';
            const dataRow = team === 'player' ? row - 4 : row;
            const teamArr = team === 'player' ? playerPlaced : enemyPlaced;
            const placedIdx = teamArr.findIndex(p => {
              const off = axialToOffset(p.position);
              return off.row === dataRow && off.col === col;
            });
            const placed = placedIdx >= 0 ? teamArr[placedIdx] : null;

            const cellClick = () => {
              if (placed && placedIdx >= 0) {
                handleCycleStars(team, placedIdx);
              }
            };

            const cellContextMenu = (e: MouseEvent) => {
              e.preventDefault();
              if (placed && placedIdx >= 0) handleRemoveUnit(team, placedIdx);
            };

            return (
              <DroppableHexCell
                key={`cell-${row}-${col}`}
                id={`cell-${row}-${col}`}
                row={row}
                col={col}
                placedUnit={placed ? { team, position: placed.position } : null}
                onClick={cellClick}
                onContextMenu={cellContextMenu}
                cellSize={cellSize}
              />
            );
          })
        )}
      </div>

      {/* Item slot overlay — placed on top so slot droppables win pointer events over the hex cell. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <ActualItemSlotsOverlay
          playerUnits={round.playerTeam.units}
          opponentUnits={round.opponent.units}
          cellSize={cellSize}
          onRemoveItem={handleRemoveItemSlot}
        />
      </div>
    </div>
  );
}

