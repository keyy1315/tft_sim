/**
 * Caitlyn 라운드 6-2 outlier 디버깅 — actual=1168, sim=7381 (+531%).
 *
 * 가설:
 *  H1. sim 의 combat duration 이 actual (26s) 보다 훨씬 길다 → 평타 횟수 과다
 *  H2. Caitlyn 이 sim 에선 끝까지 살고 actual 에선 일찍 죽었다 → 시간 차
 *  H3. 단일 평타/스킬 데미지 계산 자체가 부풀려져 있다 → DPS 자체 버그
 *
 * 측정:
 *  - duration distribution (26s 보다 길게 끌면 H1)
 *  - Caitlyn 의 N runs 평균 attackCount / castCount / time-alive
 *  - DPS = totalDamageDealt / (alive_seconds)
 */
import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { toNRunInput } from '@/lib/validation/schemaAdapter';
import type { PvPRound } from '@/lib/actualData/types';
import type { CombatUnit, CombatResult } from '@/types';

const TICK_HZ = 30;

interface CaitlynStats {
  finalHp: number;
  maxHp: number;
  finalHpPct: number;
  alive: boolean;
  attackCount: number;
  castCount: number;
  totalDamage: number;
  itemDamage: number;
  killCount: number;
  durationTicks: number;
  durationSec: number;
  /** ticks until Caitlyn died (or full duration if alive) */
  aliveTicks: number;
  aliveSec: number;
  dps: number;
  attacksPerSec: number;
}

function findCaitlyn(units: CombatUnit[]): CombatUnit | undefined {
  return units.find((u) => u.champion.apiName === 'TFT17_Caitlyn');
}

function aliveTicks(result: CombatResult, unitId: string): number {
  for (let i = 0; i < result.snapshots.length; i++) {
    const u = result.snapshots[i].units[unitId];
    if (u && !u.isAlive) return i;
  }
  return result.snapshots.length;
}

function summarize(result: CombatResult): CaitlynStats {
  const c = findCaitlyn(result.playerUnits);
  if (!c) throw new Error('Caitlyn not found in playerUnits');
  const aliveT = aliveTicks(result, c.id);
  const aliveSec = aliveT / TICK_HZ;
  const durationSec = result.duration / TICK_HZ;
  return {
    finalHp: c.currentHp,
    maxHp: c.maxHp,
    finalHpPct: c.maxHp > 0 ? (c.currentHp / c.maxHp) * 100 : 0,
    alive: c.currentHp > 0,
    attackCount: c.attackCount,
    castCount: c.castCount,
    totalDamage: c.totalDamageDealt,
    itemDamage: c.itemDamageDealt,
    killCount: c.killCount,
    durationTicks: result.duration,
    durationSec,
    aliveTicks: aliveT,
    aliveSec,
    dps: aliveSec > 0 ? c.totalDamageDealt / aliveSec : 0,
    attacksPerSec: aliveSec > 0 ? c.attackCount / aliveSec : 0,
  };
}

describe('Caitlyn round 6-2 deepdive', () => {
  it('measures Caitlyn behavior across N=10 sim runs vs actual=1168 (26s)', () => {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'actual-data', 'game-20260423-001.json'),
      'utf-8',
    );
    const data = JSON.parse(raw) as { rounds: PvPRound[] };
    const round = data.rounds.find((r) => r.roundName === '6-2');
    if (!round) throw new Error('round 6-2 missing');

    const catalogs = loadServerCatalogs();
    const { input } = toNRunInput(round, catalogs);

    const stats: CaitlynStats[] = [];
    for (let i = 0; i < 10; i++) {
      const result = simulateCombat(
        input.playerTeam,
        input.opponentTeam,
        { ...input.simulateOptions, seed: i },
      );
      stats.push(summarize(result));
    }

    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const min = (xs: number[]): number => Math.min(...xs);
    const max = (xs: number[]): number => Math.max(...xs);

    const actualDmg = 1168;
    const actualSec = 26;
    const actualDps = actualDmg / actualSec;

    const dmgs = stats.map((s) => s.totalDamage);
    const durs = stats.map((s) => s.durationSec);
    const alives = stats.map((s) => s.aliveSec);
    const atkCounts = stats.map((s) => s.attackCount);
    const dpsValues = stats.map((s) => s.dps);
    const apsValues = stats.map((s) => s.attacksPerSec);
    const survivedCount = stats.filter((s) => s.alive).length;

    /* eslint-disable no-console -- pure measurement */
    console.log('=== Caitlyn R6-2 ===');
    console.log(`actual: dmg=${actualDmg}, sec≈${actualSec}, DPS≈${actualDps.toFixed(0)}`);
    console.log('sim N=10 (mean / min / max):');
    console.log(
      `  totalDamage: ${avg(dmgs).toFixed(0)} / ${min(dmgs).toFixed(0)} / ${max(dmgs).toFixed(0)}`,
    );
    console.log(
      `  combat duration (s): ${avg(durs).toFixed(1)} / ${min(durs).toFixed(1)} / ${max(durs).toFixed(1)}`,
    );
    console.log(
      `  Caitlyn alive (s): ${avg(alives).toFixed(1)} / ${min(alives).toFixed(1)} / ${max(alives).toFixed(1)}`,
    );
    console.log(
      `  attackCount: ${avg(atkCounts).toFixed(1)} / ${min(atkCounts).toFixed(0)} / ${max(atkCounts).toFixed(0)}`,
    );
    console.log(
      `  DPS while alive: ${avg(dpsValues).toFixed(0)} / ${min(dpsValues).toFixed(0)} / ${max(dpsValues).toFixed(0)}`,
    );
    console.log(
      `  attacks/sec: ${avg(apsValues).toFixed(2)} / ${min(apsValues).toFixed(2)} / ${max(apsValues).toFixed(2)}`,
    );
    console.log(`  survived: ${survivedCount}/10`);
    console.log(
      `  AS stat: ${stats[0].attackCount > 0 ? '(see attackCount)' : 'no attacks'}`,
    );
    /* eslint-enable no-console */
  }, 30_000);
});
