import { describe, it, expect } from 'vitest';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();

function findChamp(api: string): RawChampion {
  const c = champions.find((x) => x.apiName === api);
  if (!c) throw new Error(`champion ${api} missing`);
  return c;
}

function findItem(api: string): RawItem {
  const it = items.find((x) => x.apiName === api);
  if (!it) throw new Error(`item ${api} missing`);
  return it;
}

const STARGAZER_EMBLEM = 'TFT17_Item_StargazerEmblemItem';

describe('resolveTraits — 별돌보미 변종 분기', () => {
  it('constellation 미지정 시 base TFT17_Stargazer trait 활성', () => {
    // TwistedFate, Talon, Jax = 별돌보미 챔프 3명
    const team = [
      { champion: findChamp('TFT17_TwistedFate') },
      { champion: findChamp('TFT17_Talon') },
      { champion: findChamp('TFT17_Jax') },
    ];
    const active = resolveTraits(team, traits);
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer).toBeDefined();
    expect(stargazer!.trait.apiName).toBe('TFT17_Stargazer');
    expect(stargazer!.count).toBe(3);
  });

  it('constellation=mountain 지정 시 TFT17_Stargazer_Mountain trait 활성', () => {
    const team = [
      { champion: findChamp('TFT17_TwistedFate') },
      { champion: findChamp('TFT17_Talon') },
      { champion: findChamp('TFT17_Jax') },
    ];
    const active = resolveTraits(team, traits, { stargazerConstellation: 'mountain' });
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer!.trait.apiName).toBe('TFT17_Stargazer_Mountain');
  });

  it('constellation=boar → TFT17_Stargazer_Wolf (Riot internal name)', () => {
    const team = [
      { champion: findChamp('TFT17_TwistedFate') },
      { champion: findChamp('TFT17_Talon') },
      { champion: findChamp('TFT17_Jax') },
    ];
    const active = resolveTraits(team, traits, { stargazerConstellation: 'boar' });
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer!.trait.apiName).toBe('TFT17_Stargazer_Wolf');
  });
});

describe('resolveTraits — Stargazer Emblem trait counter', () => {
  it('emblem 아이템 1개 = 별돌보미 카운트 +1', () => {
    // TwistedFate, Talon, Jax 3명 + Aatrox(별돌보미 아님) emblem 1개 = 카운트 4
    const aatroxWithEmblem = {
      champion: findChamp('TFT17_Aatrox'),
      items: [findItem(STARGAZER_EMBLEM)],
    };
    const team = [
      { champion: findChamp('TFT17_TwistedFate') },
      { champion: findChamp('TFT17_Talon') },
      { champion: findChamp('TFT17_Jax') },
      aatroxWithEmblem,
    ];
    const active = resolveTraits(team, traits, { stargazerConstellation: 'mountain' });
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer!.count).toBe(4);
  });

  it('emblem 3개 = 카운트 +3 (23일 player 팀 baseline)', () => {
    const team = [
      { champion: findChamp('TFT17_TwistedFate') },
      { champion: findChamp('TFT17_Talon') },
      { champion: findChamp('TFT17_Jax') },
      { champion: findChamp('TFT17_Aatrox'), items: [findItem(STARGAZER_EMBLEM)] },
      { champion: findChamp('TFT17_Milio'), items: [findItem(STARGAZER_EMBLEM)] },
      { champion: findChamp('TFT17_Corki'), items: [findItem(STARGAZER_EMBLEM)] },
    ];
    const active = resolveTraits(team, traits, { stargazerConstellation: 'mountain' });
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer!.count).toBe(6);
    // 산 별자리 minUnits=6 활성 — Mountain_AS/ADAP/Health/Resists 등 활성 effect
    expect(stargazer!.activeEffect).not.toBeNull();
    expect(stargazer!.activeEffect!.minUnits).toBe(6);
  });

  it('emblem 없는 일반 아이템은 trait 카운트 무영향', () => {
    const aatroxWithBF = {
      champion: findChamp('TFT17_Aatrox'),
      items: [findItem('TFT_Item_BFSword')],
    };
    const team = [
      { champion: findChamp('TFT17_TwistedFate') },
      { champion: findChamp('TFT17_Talon') },
      aatroxWithBF,
    ];
    const active = resolveTraits(team, traits);
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer!.count).toBe(2);
  });
});
