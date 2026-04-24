import type { HexCoord, PlacedChampion } from '@/types';
import type { SimulateOptions } from '@/lib/simulator/engine/combatLoop';

export interface Survivor {
  hex: HexCoord;
  championId: string;
  alive: boolean;
  /** 0~100; alive=false면 0 */
  hpPercent: number;
}

export interface NumStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  /** 원본 N개 (디버그/차트용) */
  samples: number[];
}

export interface HpStats {
  /** N회 중 생존 횟수 */
  aliveCount: number;
  /** 생존했을 때 평균 HP% (aliveCount=0이면 0) */
  meanHpPercentIfAlive: number;
}

export interface Distribution {
  nRuns: number;
  winnerCounts: { player: number; opponent: number; draw: number };
  playerWinRate: number;
  /** hexKey (e.g. "2,0") → damage stats */
  playerDamage: Map<string, NumStats>;
  opponentDamage: Map<string, NumStats>;
  survivors: {
    player: Map<string, HpStats>;
    opponent: Map<string, HpStats>;
  };
  combatDurationTicks: NumStats;
}

export interface NRunInput {
  playerTeam: PlacedChampion[];
  opponentTeam: PlacedChampion[];
  simulateOptions: Omit<SimulateOptions, 'seed'>;
}

export interface DamageDiff {
  hex: HexCoord;
  championId: string;
  actual: number;
  simMean: number;
  simMedian: number;
  simRange: [number, number];
  /** (simMean - actual) / actual */
  diffPct: number;
}

export interface SurvivorDiff {
  hex: HexCoord;
  championId: string;
  team: 'player' | 'opponent';
  actualAlive: boolean;
  actualHp: number;
  /** 0~1 */
  simAliveRate: number;
  simMeanHp: number;
  aliveMismatch: boolean;
  /** simMeanHp - actualHp (percentage points) */
  hpDiffPoints: number;
}

export interface RoundDiff {
  roundName: string;
  winner: {
    actual: 'player' | 'opponent' | 'draw';
    simPlayerWinRate: number;
    /** majority sim winner === actual winner */
    matched: boolean;
    /** abs(playerWinRate - 0.5) < 0.15 */
    weakSignal: boolean;
  };
  playerDamage: DamageDiff[];
  opponentDamage?: DamageDiff[];
  survivors?: SurvivorDiff[];
  warnings: string[];
}

export interface GameDiff {
  gameId: string;
  computedAt: string;          // ISO
  sourceGameMtime: number;     // epoch ms
  engineSha: string | null;
  nRuns: number;
  seedBase: number;
  rounds: RoundDiff[];
  summary: {
    pvpRoundCount: number;
    /** rounds where majority winner matched actual */
    winnerMatchRate: number;
    /** rounds with weakSignal=true */
    weakSignalRoundCount: number;
    /** mean of all DamageDiff.diffPct across all rounds */
    avgPlayerDamageErrorPct: number;
    /** mean of SurvivorDiff.hpDiffPoints where alive agreement held */
    avgSurvivorHpErrorPts: number;
  };
}

export function hexKey(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}
