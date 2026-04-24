import { describe, it, expect } from 'vitest';
import {
  parseSlotId,
  setItemAtSlot,
  clearUnitItems,
} from '@/components/actual-data/actualDndHandlers';
import { createActualDragEndHandler, type ActualDndContext } from '@/components/actual-data/actualDndHandlers';
import type { PlacedUnit, PvPRound, TeamSnapshot, OpponentSnapshot } from '@/lib/actualData/types';
import type { DragEndEvent } from '@dnd-kit/core';

describe('parseSlotId', () => {
  it('player 팀 슬롯 id 를 파싱한다', () => {
    expect(parseSlotId('item-slot-player-1-2-0')).toEqual({
      team: 'player', hex: { q: 1, r: 2 }, slotIdx: 0,
    });
  });

  it('enemy 팀 음수 좌표도 파싱한다', () => {
    expect(parseSlotId('item-slot-enemy--1-3-2')).toEqual({
      team: 'enemy', hex: { q: -1, r: 3 }, slotIdx: 2,
    });
  });

  it('잘못된 포맷은 null 을 반환한다', () => {
    expect(parseSlotId('cell-4-3')).toBeNull();
    expect(parseSlotId('item-slot-foo-1-2-0')).toBeNull();
    expect(parseSlotId('item-slot-player-1-2-9')).toBeNull();
  });
});

const unit = (items: (string | undefined)[]): PlacedUnit => ({
  championId: 'TFT17_Ahri',
  hex: { q: 0, r: 0 },
  starLevel: 2,
  items: [items[0], items[1], items[2]] as PlacedUnit['items'],
});

describe('setItemAtSlot', () => {
  it('빈 슬롯을 지정된 인덱스에 채운다', () => {
    const u = unit([undefined, undefined, undefined]);
    const next = setItemAtSlot(u, 'TFT_Item_BFSword', 1);
    expect(next.items).toEqual([undefined, 'TFT_Item_BFSword', undefined]);
  });

  it('채워진 슬롯을 덮어쓴다 (교체)', () => {
    const u = unit(['TFT_Item_BFSword', 'TFT_Item_RecurveBow', undefined]);
    const next = setItemAtSlot(u, 'TFT_Item_Rabadon', 0);
    expect(next.items).toEqual(['TFT_Item_Rabadon', 'TFT_Item_RecurveBow', undefined]);
  });

  it('원본 객체를 mutate 하지 않는다', () => {
    const u = unit(['A', undefined, undefined]);
    setItemAtSlot(u, 'B', 0);
    expect(u.items).toEqual(['A', undefined, undefined]);
  });
});

describe('clearUnitItems', () => {
  it('3칸 모두 undefined 로 만든다', () => {
    const u = unit(['A', 'B', 'C']);
    const next = clearUnitItems(u);
    expect(next.items).toEqual([undefined, undefined, undefined]);
  });

  it('원본 객체를 mutate 하지 않는다', () => {
    const u = unit(['A', 'B', 'C']);
    clearUnitItems(u);
    expect(u.items).toEqual(['A', 'B', 'C']);
  });
});

const baseTeam = (units: PlacedUnit[]): TeamSnapshot => ({
  units,
  augments: [undefined, undefined, undefined, undefined],
  level: 6,
  hp: 100,
  hexModifiers: [],
});
const baseOpponent = (units: PlacedUnit[]): OpponentSnapshot => ({ ...baseTeam(units) });

const makeRound = (playerUnits: PlacedUnit[], opponentUnits: PlacedUnit[] = []): PvPRound => ({
  type: 'pvp',
  roundName: '2-1',
  videoStartTime: 0,
  playerTeam: baseTeam(playerUnits),
  opponent: baseOpponent(opponentUnits),
  winner: 'player',
});

/** Minimal DragEndEvent stub with just what the handler reads. */
const makeEvent = (dragData: unknown, overId: string | null): DragEndEvent =>
  ({
    active: { data: { current: dragData }, id: 'active' },
    over: overId ? { id: overId } : null,
  } as unknown as DragEndEvent);

describe('createActualDragEndHandler - item slot routing', () => {
  it('item drop 이 정확한 슬롯을 교체한다', () => {
    const unitA: PlacedUnit = {
      championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
      items: ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', undefined],
    };
    let player: PlacedUnit[] = [unitA];
    const ctx: ActualDndContext = {
      round: makeRound(player),
      roundIndex: 0,
      updatePlayerTeam: (_i, patch) => { player = patch.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    handler(makeEvent(
      { type: 'item', item: { apiName: 'TFT_Item_Rabadon' } },
      'item-slot-player-0-3-0',
    ));
    expect(player[0].items).toEqual(['TFT_Item_Rabadon', 'TFT_Item_RecurveBow', undefined]);
  });

  it('item drop 이 지정된 빈 슬롯을 채운다', () => {
    const unitA: PlacedUnit = {
      championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
      items: ['TFT_Item_BFSword', undefined, undefined],
    };
    let player: PlacedUnit[] = [unitA];
    const ctx: ActualDndContext = {
      round: makeRound(player),
      roundIndex: 0,
      updatePlayerTeam: (_i, patch) => { player = patch.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    handler(makeEvent(
      { type: 'item', item: { apiName: 'TFT_Item_Rabadon' } },
      'item-slot-player-0-3-2',
    ));
    expect(player[0].items).toEqual(['TFT_Item_BFSword', undefined, 'TFT_Item_Rabadon']);
  });

  it('item drop 이 헥스 본체 (cell-*) 에서는 기존 자동 채움 동작 유지', () => {
    const unitA: PlacedUnit = {
      championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
      items: [undefined, undefined, undefined],
    };
    let player: PlacedUnit[] = [unitA];
    const ctx: ActualDndContext = {
      round: makeRound(player),
      roundIndex: 0,
      updatePlayerTeam: (_i, patch) => { player = patch.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    // cell id: player 팀은 row 4-7, q=0,r=3 → dataRow=3, col=q+floor(r/2)=0+1=1, display row=4+3=7
    handler(makeEvent(
      { type: 'item', item: { apiName: 'TFT_Item_Rabadon' } },
      'cell-7-1',
    ));
    expect(player[0].items).toEqual(['TFT_Item_Rabadon', undefined, undefined]);
  });
});

describe('createActualDragEndHandler - remove-all tool', () => {
  it('점유된 헥스(cell) 위에 drop 하면 3칸 모두 비운다', () => {
    const unitA: PlacedUnit = {
      championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
      items: ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', 'TFT_Item_Rabadon'],
    };
    let player: PlacedUnit[] = [unitA];
    const ctx: ActualDndContext = {
      round: makeRound(player),
      roundIndex: 0,
      updatePlayerTeam: (_i, patch) => { player = patch.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    handler(makeEvent({ type: 'tool', toolKind: 'remove-all' }, 'cell-7-1'));
    expect(player[0].items).toEqual([undefined, undefined, undefined]);
  });

  it('점유된 유닛의 슬롯 위에 drop 해도 3칸 모두 비운다', () => {
    const unitA: PlacedUnit = {
      championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
      items: ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', undefined],
    };
    let player: PlacedUnit[] = [unitA];
    const ctx: ActualDndContext = {
      round: makeRound(player),
      roundIndex: 0,
      updatePlayerTeam: (_i, patch) => { player = patch.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    handler(makeEvent({ type: 'tool', toolKind: 'remove-all' }, 'item-slot-player-0-3-1'));
    expect(player[0].items).toEqual([undefined, undefined, undefined]);
  });

  it('빈 헥스에 drop 하면 아무 변화 없음', () => {
    let player: PlacedUnit[] = [];
    const ctx: ActualDndContext = {
      round: makeRound(player),
      roundIndex: 0,
      updatePlayerTeam: (_i, patch) => { player = patch.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    handler(makeEvent({ type: 'tool', toolKind: 'remove-all' }, 'cell-7-1'));
    expect(player).toEqual([]);
  });
});
