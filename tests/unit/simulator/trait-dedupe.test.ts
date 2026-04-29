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

describe('resolveTraits — 동일 챔프 dedupe', () => {
  it('룰루 3마리 → 별돌보미 1, 복제자 1 (intrinsic trait dedupe)', () => {
    const team = [
      { champion: findChamp('TFT17_Lulu') },
      { champion: findChamp('TFT17_Lulu') },
      { champion: findChamp('TFT17_Lulu') },
    ];
    const active = resolveTraits(team, traits);
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    const replicator = active.find((t) => t.trait.name === '복제자');
    expect(stargazer?.count).toBe(1);
    expect(replicator?.count).toBe(1);
  });

  it('룰루 1 + TwistedFate 1 → 별돌보미 2 (별개 챔프 각자 카운트)', () => {
    const team = [
      { champion: findChamp('TFT17_Lulu') },
      { champion: findChamp('TFT17_TwistedFate') },
    ];
    const active = resolveTraits(team, traits);
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer?.count).toBe(2);
  });

  it('별돌보미 3마리 + 별돌보미 아닌 챔프에 별돌보미 emblem 1개 → 별돌보미 4 (emblem unit-bound)', () => {
    const team = [
      { champion: findChamp('TFT17_TwistedFate') },
      { champion: findChamp('TFT17_Talon') },
      { champion: findChamp('TFT17_Jax') },
      { champion: findChamp('TFT17_Aatrox'), items: [findItem(STARGAZER_EMBLEM)] },
    ];
    const active = resolveTraits(team, traits);
    const stargazer = active.find((t) => t.trait.name === '별돌보미');
    expect(stargazer?.count).toBe(4);
  });

  it('MF 2마리 (다른 모드) → 각 모드 trait 별개 카운트', () => {
    const mfChamp = findChamp('TFT17_MissFortune');
    const team = [
      { champion: mfChamp, mfMode: 'challenger' as const },
      { champion: mfChamp, mfMode: 'replicator' as const },
    ];
    const active = resolveTraits(team, traits);
    const challenger = active.find((t) => t.trait.name === '도전자');
    const replicator = active.find((t) => t.trait.name === '복제자');
    expect(challenger?.count).toBeGreaterThanOrEqual(1);
    expect(replicator?.count).toBeGreaterThanOrEqual(1);
  });
});
