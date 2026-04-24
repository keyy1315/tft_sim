import { describe, it, expect } from 'vitest';
import {
  parseSlotId,
  setItemAtSlot,
  clearUnitItems,
} from '@/components/actual-data/actualDndHandlers';
import type { PlacedUnit } from '@/lib/actualData/types';

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
