import { describe, it, expect } from 'vitest';
import { getItemCategory } from '@/lib/simulator/systems/item';
import { PlacedUnitSchema } from '@/lib/actualData/schema';
import {
  toPlacedChampion as actualToPlaced,
  fromPlacedChampion,
} from '@/lib/actualData/unitAdapter';
import { toNRunInput } from '@/lib/validation/schemaAdapter';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import {
  createActualDragEndHandler,
  type ActualDndContext,
} from '@/components/actual-data/actualDndHandlers';
import type {
  PlacedUnit, PvPRound, TeamSnapshot, OpponentSnapshot,
} from '@/lib/actualData/types';
import type { RawItem, RawChampion, DragData, PlacedChampion } from '@/types';
import type { DragEndEvent } from '@dnd-kit/core';

// ─── PR8 1/4: getItemCategory split ──────────────────────────────────────────

const animaSquadItem = (): RawItem => ({
  apiName: 'TFT17_AnimaSquadItem_NovaShield',
  name: 'mock', desc: '', icon: '',
  effects: { ApBonus: 30 },
  composition: [],
} as unknown as RawItem);

const psyOpsItem = (): RawItem => ({
  apiName: 'TFT17_Item_PsyOps_Mock',
  name: 'mock', desc: '', icon: '',
  effects: { AdBonus: 30 },
  composition: [],
} as unknown as RawItem);

describe('PR8 1/4 — item category split (AnimaSquad / PsyOps)', () => {
  it('TFT17_AnimaSquadItem_* → animasquad', () => {
    expect(getItemCategory(animaSquadItem())).toBe('animasquad');
  });

  it('TFT17_Item_PsyOps_* → psyops', () => {
    expect(getItemCategory(psyOpsItem())).toBe('psyops');
  });
});

// ─── PR8 2/4: PlacedUnitSchema novaStrikeSelector ────────────────────────────

describe('PR8 2/4 — PlacedUnitSchema novaStrikeSelector', () => {
  const baseUnit = {
    championId: 'TFT17_Aatrox',
    hex: { q: 0, r: 0 },
    starLevel: 2 as const,
    items: [undefined, undefined, undefined],
  };

  it('novaStrikeSelector: true 를 허용한다', () => {
    const res = PlacedUnitSchema.safeParse({ ...baseUnit, novaStrikeSelector: true });
    expect(res.success).toBe(true);
  });

  it('novaStrikeSelector 미지정도 허용한다 (기존 JSON 호환)', () => {
    const res = PlacedUnitSchema.safeParse(baseUnit);
    expect(res.success).toBe(true);
  });

  it('novaStrikeSelector 비-boolean 은 거부한다', () => {
    const res = PlacedUnitSchema.safeParse({ ...baseUnit, novaStrikeSelector: 'yes' });
    expect(res.success).toBe(false);
  });
});

// ─── PR8 2/4: unitAdapter 양방향 매핑 ─────────────────────────────────────────

describe('PR8 2/4 — unitAdapter novaStrikeSelector 양방향 매핑', () => {
  const aatrox: RawChampion = {
    name: 'Aatrox', apiName: 'TFT17_Aatrox', cost: 5,
    traits: ['DRX'],
    role: 'ADFighter' as RawChampion['role'],
    stats: {
      hp: 1000, armor: 60, magicResist: 60,
      damage: 80, attackSpeed: 0.7, range: 1,
      critChance: 0.25, critMultiplier: 1.4,
      initialMana: 0, mana: 100,
    },
    ability: { name: '', desc: '', icon: '', variables: [] },
  };
  const champCatalog = new Map<string, RawChampion>([[aatrox.apiName, aatrox]]);
  const itemCatalog = new Map<string, RawItem>();

  it('toPlacedChampion 이 boolean 을 전파한다', () => {
    const u: PlacedUnit = {
      championId: 'TFT17_Aatrox',
      hex: { q: 0, r: 0 }, starLevel: 2,
      items: [undefined, undefined, undefined],
      novaStrikeSelector: true,
    };
    const p = actualToPlaced(u, champCatalog, itemCatalog);
    expect(p?.novaStrikeSelector).toBe(true);
  });

  it('fromPlacedChampion 이 boolean 을 전파한다', () => {
    const p: PlacedChampion = {
      champion: aatrox, position: { q: 0, r: 0 }, starLevel: 2, items: [],
      novaStrikeSelector: true,
    };
    const u = fromPlacedChampion(p);
    expect(u.novaStrikeSelector).toBe(true);
  });
});

// ─── PR8 2/4: schemaAdapter.toNRunInput → simulate options 도출 ──────────────

describe('PR8 2/4 — toNRunInput derives playerNovaStrikeSelectorUnit', () => {
  it('playerTeam 의 novaStrikeSelector=true unit 의 apiName 을 옵션에 담는다', () => {
    const catalogs = loadServerCatalogs();
    // Aatrox 가 catalog 에 존재해야 toPlacedChampion 이 통과.
    expect(catalogs.champions.some(c => c.apiName === 'TFT17_Aatrox')).toBe(true);

    const round: PvPRound = {
      type: 'pvp',
      roundName: '4-1',
      videoStartTime: 0,
      playerTeam: {
        units: [
          {
            championId: 'TFT17_Aatrox',
            hex: { q: 0, r: 0 }, starLevel: 2,
            items: [undefined, undefined, undefined],
            novaStrikeSelector: true,
          },
        ],
        augments: [undefined, undefined, undefined, undefined],
        level: 8, hp: 100, hexModifiers: [],
      },
      opponent: {
        units: [],
        augments: [undefined, undefined, undefined, undefined],
        level: 8, hp: 100, hexModifiers: [],
      },
      winner: 'player',
    };

    const { input } = toNRunInput(round, catalogs);
    expect(input.simulateOptions.playerNovaStrikeSelectorUnit).toBe('TFT17_Aatrox');
    expect(input.simulateOptions.enemyNovaStrikeSelectorUnit).toBeUndefined();
  });
});

// ─── PR8 3/4: DragData 'nova-selector' toolKind fingerprint ──────────────────

describe('PR8 3/4 — DragData type fingerprint', () => {
  it("DragData 가 toolKind: 'nova-selector' 를 허용한다 (compile-time + runtime)", () => {
    // 컴파일 타임 검사: DragData 의 'nova-selector' literal 이 사라지면 typecheck 실패.
    const data: DragData = { type: 'tool', toolKind: 'nova-selector' };
    expect(data.type).toBe('tool');
    if (data.type === 'tool') {
      expect(data.toolKind).toBe('nova-selector');
    }
  });
});

// ─── PR8 3/4: createActualDragEndHandler 'nova-selector' 분기 ────────────────

const baseTeam = (units: PlacedUnit[]): TeamSnapshot => ({
  units,
  augments: [undefined, undefined, undefined, undefined],
  level: 6, hp: 100, hexModifiers: [],
});
const baseOpp = (units: PlacedUnit[]): OpponentSnapshot => ({ ...baseTeam(units) });
const makeRound = (player: PlacedUnit[], enemy: PlacedUnit[] = []): PvPRound => ({
  type: 'pvp', roundName: '2-1', videoStartTime: 0,
  playerTeam: baseTeam(player),
  opponent: baseOpp(enemy),
  winner: 'player',
});
const makeEvent = (data: unknown, overId: string | null): DragEndEvent =>
  ({
    active: { data: { current: data }, id: 'a' },
    over: overId ? { id: overId } : null,
  } as unknown as DragEndEvent);

describe("PR8 3/4 — 'nova-selector' drop 핸들러", () => {
  it('NOVA 5종(Aatrox) unit 에 drop 하면 novaStrikeSelector=true', () => {
    const aatrox: PlacedUnit = {
      championId: 'TFT17_Aatrox', hex: { q: 0, r: 3 }, starLevel: 2,
      items: [undefined, undefined, undefined],
    };
    let player: PlacedUnit[] = [aatrox];
    const ctx: ActualDndContext = {
      round: makeRound(player), roundIndex: 0,
      updatePlayerTeam: (_i, p) => { player = p.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    // Aatrox at q=0,r=3 → display row = 4 + dataRow(3) = 7, col = q + floor(r/2) = 0 + 1 = 1
    handler(makeEvent({ type: 'tool', toolKind: 'nova-selector' }, 'cell-7-1'));
    expect(player[0].novaStrikeSelector).toBe(true);
  });

  it('비-NOVA(Ahri) unit 에 drop 하면 변화 없음', () => {
    const ahri: PlacedUnit = {
      championId: 'TFT17_Ahri', hex: { q: 0, r: 3 }, starLevel: 2,
      items: [undefined, undefined, undefined],
    };
    let player: PlacedUnit[] = [ahri];
    const ctx: ActualDndContext = {
      round: makeRound(player), roundIndex: 0,
      updatePlayerTeam: (_i, p) => { player = p.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    handler(makeEvent({ type: 'tool', toolKind: 'nova-selector' }, 'cell-7-1'));
    expect(player[0].novaStrikeSelector).toBeUndefined();
  });

  it('같은 팀 단일성: 기존 보유자 false + 신규 target true', () => {
    const aatrox: PlacedUnit = {
      championId: 'TFT17_Aatrox', hex: { q: 0, r: 3 }, starLevel: 2,
      items: [undefined, undefined, undefined],
      novaStrikeSelector: true,
    };
    const akali: PlacedUnit = {
      championId: 'TFT17_Akali', hex: { q: 1, r: 3 }, starLevel: 2,
      items: [undefined, undefined, undefined],
    };
    let player: PlacedUnit[] = [aatrox, akali];
    const ctx: ActualDndContext = {
      round: makeRound(player), roundIndex: 0,
      updatePlayerTeam: (_i, p) => { player = p.units; },
      updateOpponent: () => {},
    };
    const handler = createActualDragEndHandler(() => ctx);
    // Akali at q=1,r=3 → display row=7, col=1+1=2 → cell-7-2
    handler(makeEvent({ type: 'tool', toolKind: 'nova-selector' }, 'cell-7-2'));
    const a = player.find(u => u.championId === 'TFT17_Aatrox');
    const k = player.find(u => u.championId === 'TFT17_Akali');
    expect(a?.novaStrikeSelector).toBe(false);
    expect(k?.novaStrikeSelector).toBe(true);
  });
});
