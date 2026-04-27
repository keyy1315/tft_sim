import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import type { CombatResult, CombatUnit, PlacedChampion } from '@/types';
import type { Distribution, NRunInput, NumStats, HpStats } from '@/types/validation';
import { hexKey } from '@/types/validation';

function numStats(samples: number[]): NumStats {
  if (samples.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, samples: [] };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    samples: [...samples],
  };
}

/**
 * Build a stable id → initial-hexKey map for one team.
 * CombatUnit.id format from createCombatUnit: `${team}-${index}` where index
 * matches the team-array index. We use the input PlacedChampion[].position
 * as the canonical hex key, since CombatUnit.position is mutated during combat
 * (movement) and would not be stable across runs.
 */
function buildIdToHexKey(team: 'player' | 'enemy', placed: PlacedChampion[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < placed.length; i++) {
    out.set(`${team}-${i}`, hexKey(placed[i].position));
  }
  return out;
}

function collectDamagePerUnit(units: CombatUnit[], idToKey: Map<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const u of units) {
    const k = idToKey.get(u.id);
    if (k === undefined) continue;
    out.set(k, u.totalDamageDealt);
  }
  return out;
}

function collectSurvivorState(
  units: CombatUnit[],
  idToKey: Map<string, string>,
): Map<string, { alive: boolean; hpPct: number }> {
  const out = new Map<string, { alive: boolean; hpPct: number }>();
  for (const u of units) {
    const k = idToKey.get(u.id);
    if (k === undefined) continue;
    const alive = u.currentHp > 0;
    const hpPct = u.maxHp > 0 ? Math.max(0, Math.min(100, (u.currentHp / u.maxHp) * 100)) : 0;
    out.set(k, { alive, hpPct: alive ? hpPct : 0 });
  }
  return out;
}

export function runN(input: NRunInput, n = 10, seedBase = 0): Distribution {
  const winnerCounts = { player: 0, opponent: 0, draw: 0 };
  const durations: number[] = [];

  const playerDamageSamples = new Map<string, number[]>();
  const opponentDamageSamples = new Map<string, number[]>();
  const playerSurvivorRuns = new Map<string, { aliveCount: number; hpSum: number }>();
  const opponentSurvivorRuns = new Map<string, { aliveCount: number; hpSum: number }>();

  const playerIdToKey = buildIdToHexKey('player', input.playerTeam);
  const opponentIdToKey = buildIdToHexKey('enemy', input.opponentTeam);

  for (let i = 0; i < n; i++) {
    const result: CombatResult = simulateCombat(
      input.playerTeam,
      input.opponentTeam,
      { ...input.simulateOptions, seed: seedBase + i },
    );

    // normalize 'enemy' → 'opponent' in winner counts
    if (result.winner === 'player') winnerCounts.player++;
    else if (result.winner === 'enemy') winnerCounts.opponent++;
    else winnerCounts.draw++;

    durations.push(result.duration);

    const pDmg = collectDamagePerUnit(result.playerUnits, playerIdToKey);
    for (const [k, v] of pDmg) {
      const arr = playerDamageSamples.get(k) ?? [];
      arr.push(v);
      playerDamageSamples.set(k, arr);
    }
    const eDmg = collectDamagePerUnit(result.enemyUnits, opponentIdToKey);
    for (const [k, v] of eDmg) {
      const arr = opponentDamageSamples.get(k) ?? [];
      arr.push(v);
      opponentDamageSamples.set(k, arr);
    }

    const pSurv = collectSurvivorState(result.playerUnits, playerIdToKey);
    for (const [k, s] of pSurv) {
      const cur = playerSurvivorRuns.get(k) ?? { aliveCount: 0, hpSum: 0 };
      if (s.alive) { cur.aliveCount++; cur.hpSum += s.hpPct; }
      playerSurvivorRuns.set(k, cur);
    }
    const eSurv = collectSurvivorState(result.enemyUnits, opponentIdToKey);
    for (const [k, s] of eSurv) {
      const cur = opponentSurvivorRuns.get(k) ?? { aliveCount: 0, hpSum: 0 };
      if (s.alive) { cur.aliveCount++; cur.hpSum += s.hpPct; }
      opponentSurvivorRuns.set(k, cur);
    }
  }

  const playerDamage = new Map<string, NumStats>();
  for (const [k, samples] of playerDamageSamples) playerDamage.set(k, numStats(samples));
  const opponentDamage = new Map<string, NumStats>();
  for (const [k, samples] of opponentDamageSamples) opponentDamage.set(k, numStats(samples));

  const playerSurv = new Map<string, HpStats>();
  for (const [k, v] of playerSurvivorRuns) {
    playerSurv.set(k, {
      aliveCount: v.aliveCount,
      meanHpPercentIfAlive: v.aliveCount === 0 ? 0 : v.hpSum / v.aliveCount,
    });
  }
  const opponentSurv = new Map<string, HpStats>();
  for (const [k, v] of opponentSurvivorRuns) {
    opponentSurv.set(k, {
      aliveCount: v.aliveCount,
      meanHpPercentIfAlive: v.aliveCount === 0 ? 0 : v.hpSum / v.aliveCount,
    });
  }

  return {
    nRuns: n,
    winnerCounts,
    playerWinRate: winnerCounts.player / n,
    playerDamage,
    opponentDamage,
    survivors: { player: playerSurv, opponent: opponentSurv },
    combatDurationTicks: numStats(durations),
  };
}
