import type { CombatResult, PlacedChampion } from '@/types';
import type { SimulateOptions } from '@/lib/simulator/engine/combatLoop';

// ── 정확도 등급 ──
export type AnalysisConfidence = 'static' | 'estimated' | 'unsupported';

// ── 재현 불가 사유 ──
export type UnsupportedReason =
  | 'unsupported_champion'
  | 'unsupported_item'
  | 'not_set17';

// ── 커버리지 판정 결과 ──
export interface CoverageResult {
  confidence: AnalysisConfidence;
  reasons: UnsupportedReason[];
  supportedChampionIds: string[];
  unsupportedChampionIds: string[];
  supportedItemIds: string[];
  unsupportedItemIds: string[];
  isSet17: boolean;
}

// ── 매치 재구성 결과 ──
export interface MatchReconstructionResult {
  playerTeam: PlacedChampion[];
  enemyTeam: PlacedChampion[];
  options: Partial<SimulateOptions>;
  confidence: AnalysisConfidence;
  reasons: UnsupportedReason[];
  heuristicFields: string[];
}

// ── 아이템 분석 결과 ──
export interface ItemAnalysisResult {
  confidence: 'static';
  issues: ItemIssue[];
}

export interface ItemIssue {
  championId: string;
  itemId: string;
  type: 'stat_mismatch' | 'better_alternative';
  severity: 'warning' | 'critical';
  message: string;
  suggestion?: string;
}

// ── 취약 요인 리포트 ──
export interface DefeatReportResult {
  confidence: 'estimated';
  combatResult: CombatResult;
  factors: VulnerabilityFactor[];
  summary: string;
}

export interface VulnerabilityFactor {
  type: 'carry_died_early' | 'damage_spread' | 'targeting_issue'
       | 'no_frontline' | 'cc_chain' | 'item_inefficiency';
  severity: 'minor' | 'major' | 'critical';
  message: string;
  tickRange?: [number, number];
  unitIds: string[];
}

// ── What-if 비교 결과 ──
export interface WhatIfComparisonResult {
  original: CombatResult;
  modified: CombatResult;
  delta: {
    winnerChanged: boolean;
    durationDelta: number;
    unitDeltas: Array<{
      unitId: string;
      championName: string;
      dpsDelta: number;
      survivalDelta: number;
    }>;
  };
}
