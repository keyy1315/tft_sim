import type { PvPRound, TeamSnapshot } from '@/lib/actualData/types';
import type {
  Distribution,
  RoundDiff,
  DamageDiff,
  SurvivorDiff,
  HpStats,
  NumStats,
  Survivor,
} from '@/types/validation';
import { hexKey } from '@/types/validation';
import type { HexCoord } from '@/types';

const WEAK_SIGNAL_THRESHOLD = 0.15;

/**
 * Phase 5 will extend `TeamSnapshotSchema` with an optional `survivors` field.
 * Until that schema bump lands, this local type bridges the gap so diffReporter
 * can read `snapshot.survivors` without casting through `any`.
 */
type SnapshotWithSurvivors = TeamSnapshot & { survivors?: Survivor[] };

function majoritySimWinner(dist: Distribution): 'player' | 'opponent' | 'draw' {
  const { player, opponent, draw } = dist.winnerCounts;
  if (player >= opponent && player >= draw) return 'player';
  if (opponent >= draw) return 'opponent';
  return 'draw';
}

function toDamageDiff(
  hex: HexCoord,
  championId: string,
  actual: number,
  sim: NumStats,
): DamageDiff {
  return {
    hex,
    championId,
    actual,
    simMean: sim.mean,
    simMedian: sim.median,
    simRange: [sim.min, sim.max],
    // actual=0 + simMean=0 → 정상 일치 (0). actual=0 + sim>0 → 정의 불가 (null)
    // — 평균에서 제외돼야 model error 가 systematically underreport 되지 않음.
    diffPct: actual === 0 ? (sim.mean === 0 ? 0 : null) : (sim.mean - actual) / actual,
  };
}

function collectDamageDiffs(
  chart: { unitHex: HexCoord; championId: string; damage: number }[] | undefined,
  dist: Map<string, NumStats>,
): DamageDiff[] | undefined {
  if (!chart) return undefined;
  const out: DamageDiff[] = [];
  for (const entry of chart) {
    const sim = dist.get(hexKey(entry.unitHex));
    if (!sim) continue;
    out.push(toDamageDiff(entry.unitHex, entry.championId, entry.damage, sim));
  }
  return out;
}

function collectSurvivorDiffs(
  team: 'player' | 'opponent',
  snapshot: SnapshotWithSurvivors,
  dist: Map<string, HpStats>,
  nRuns: number,
): SurvivorDiff[] {
  if (!snapshot.survivors) return [];
  const out: SurvivorDiff[] = [];
  for (const s of snapshot.survivors) {
    const key = hexKey(s.hex);
    const simHp = dist.get(key);
    if (!simHp) continue;
    const simAliveRate = simHp.aliveCount / nRuns;
    const simMeanHp = simHp.meanHpPercentIfAlive;
    out.push({
      hex: s.hex,
      championId: s.championId,
      team,
      actualAlive: s.alive,
      actualHp: s.hpPercent,
      simAliveRate,
      simMeanHp,
      aliveMismatch: s.alive !== (simAliveRate > 0.5),
      hpDiffPoints: simMeanHp - s.hpPercent,
    });
  }
  return out;
}

export function compareRound(
  actual: PvPRound,
  distribution: Distribution,
  warnings: string[],
): RoundDiff {
  const simWinner = majoritySimWinner(distribution);
  const actualWinner = actual.winner === 'draw' ? 'draw' : actual.winner;
  const playerWinRate = distribution.playerWinRate;

  const playerDamage = collectDamageDiffs(actual.playerDamageChart, distribution.playerDamage) ?? [];
  const opponentDamage = collectDamageDiffs(actual.opponentDamageChart, distribution.opponentDamage);

  const playerSurv = collectSurvivorDiffs(
    'player',
    actual.playerTeam as SnapshotWithSurvivors,
    distribution.survivors.player,
    distribution.nRuns,
  );
  const opponentSurv = collectSurvivorDiffs(
    'opponent',
    actual.opponent as SnapshotWithSurvivors,
    distribution.survivors.opponent,
    distribution.nRuns,
  );
  const survivors = [...playerSurv, ...opponentSurv];

  return {
    roundName: actual.roundName,
    winner: {
      actual: actualWinner,
      simPlayerWinRate: playerWinRate,
      matched: simWinner === actualWinner,
      weakSignal: Math.abs(playerWinRate - 0.5) < WEAK_SIGNAL_THRESHOLD,
    },
    playerDamage,
    opponentDamage,
    survivors: survivors.length > 0 ? survivors : undefined,
    warnings: [...warnings],
  };
}
