/**
 * Caitlyn 단독 baseline DPS — 시너지/아이템 다 빼고 raw DPS 측정.
 *
 * 목적: 라운드 6-2 의 sim DPS 1010 이 (시너지 + 별돌보미 + 운명술사 등으로 부풀려진 건지)
 *      vs (Caitlyn 자체 base 가 이미 너무 높은 건지) 를 격리.
 *
 * 측정:
 *  - 1★ / 2★ / 3★ Caitlyn vs 단일 1★ Aatrox (탱) — items=[], traits 비활성
 *  - DPS, attacks/sec, time to kill
 *  - 챔피언 raw stats (AD, AS, range) 와 손계산 비교
 */
import { describe, it } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const TICK_HZ = 30;

function placedAt(champ: RawChampion, q: number, r: number, starLevel: 1 | 2 | 3): PlacedChampion {
  return { champion: champ, starLevel, position: { q, r }, items: [] };
}

interface RunOut {
  totalDamage: number;
  attackCount: number;
  castCount: number;
  durationTicks: number;
  durationSec: number;
  aliveSec: number;
  dps: number;
  aps: number;
}

function summarize(
  result: ReturnType<typeof simulateCombat>,
  unitId: string,
): RunOut {
  const u = result.playerUnits.find((p) => p.id === unitId);
  if (!u) throw new Error('unit gone');
  let aliveTicks = result.snapshots.length;
  for (let i = 0; i < result.snapshots.length; i++) {
    const snapU = result.snapshots[i].units[u.id];
    if (snapU && !snapU.isAlive) {
      aliveTicks = i;
      break;
    }
  }
  const aliveSec = aliveTicks / TICK_HZ;
  return {
    totalDamage: u.totalDamageDealt,
    attackCount: u.attackCount,
    castCount: u.castCount,
    durationTicks: result.snapshots.length,
    durationSec: result.snapshots.length / TICK_HZ,
    aliveSec,
    dps: aliveSec > 0 ? u.totalDamageDealt / aliveSec : 0,
    aps: aliveSec > 0 ? u.attackCount / aliveSec : 0,
  };
}

describe('Caitlyn baseline DPS (no items, no synergies)', () => {
  it.each([1, 2, 3] as const)('Caitlyn ★%i vs 1★ Aatrox', (star) => {
    const catalogs = loadServerCatalogs();
    const caitlyn = catalogs.champions.find((c) => c.apiName === 'TFT17_Caitlyn');
    const aatrox = catalogs.champions.find((c) => c.apiName === 'TFT17_Aatrox');
    if (!caitlyn || !aatrox) throw new Error('champion missing');

    /* eslint-disable no-console -- pure measurement */
    if (star === 1) {
      console.log(
        `Caitlyn data: AD=${caitlyn.stats.damage}, AS=${caitlyn.stats.attackSpeed}, ` +
          `range=${caitlyn.stats.range}, mana=${caitlyn.stats.mana}/${caitlyn.stats.initialMana ?? 0}, ` +
          `traits=${caitlyn.traits.join(',')}`,
      );
      console.log(
        `Aatrox 1★ HP=${aatrox.stats.hp}, armor=${aatrox.stats.armor}, mr=${aatrox.stats.magicResist}`,
      );
    }
    /* eslint-enable no-console */

    const ally: PlacedChampion[] = [placedAt(caitlyn, -1, 3, star)];
    const enemy: PlacedChampion[] = [placedAt(aatrox, 6, 3, 1)];

    const samples: RunOut[] = [];
    for (let i = 0; i < 5; i++) {
      const result = simulateCombat(ally, enemy, {
        seed: i,
        allTraits: catalogs.traits,
        skipMirror: true,
        stageNumber: 5,
      });
      const cId = result.playerUnits[0]?.id;
      if (!cId) throw new Error('player unit missing');
      samples.push(summarize(result, cId));
    }

    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

    /* eslint-disable no-console -- pure measurement */
    console.log(
      `★${star} avg: dmg=${avg(samples.map((s) => s.totalDamage)).toFixed(0)} | ` +
        `dps=${avg(samples.map((s) => s.dps)).toFixed(0)} | ` +
        `aps=${avg(samples.map((s) => s.aps)).toFixed(2)} | ` +
        `attacks=${avg(samples.map((s) => s.attackCount)).toFixed(1)} | ` +
        `casts=${avg(samples.map((s) => s.castCount)).toFixed(1)} | ` +
        `ttk=${avg(samples.map((s) => s.aliveSec)).toFixed(1)}s | ` +
        `dur=${avg(samples.map((s) => s.durationSec)).toFixed(1)}s`,
    );
    /* eslint-enable no-console */
  }, 30_000);
});
