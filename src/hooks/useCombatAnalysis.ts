'use client';

import { useState, useCallback } from 'react';
import type { RawChampion, RawItem, RawTrait } from '@/types';
import type { ParsedParticipant } from '@/lib/riot';
import type { PlacedChampion, CombatResult } from '@/types';
import type {
  CoverageResult, MatchReconstructionResult, DefeatReportResult, WhatIfComparisonResult,
} from '@/types/analysis';
import { loadChampions, loadItems, loadTraits } from '@/data/loader';
import { checkCoverage } from '@/lib/analysis/coverageChecker';
import { reconstructMatch } from '@/lib/analysis/matchAdapter';
import { generateDefeatReport } from '@/lib/analysis/defeatReport';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';

type AnalysisStatus = 'idle' | 'loading' | 'error' | 'unsupported' | 'ready' | 'simulating' | 'done';

interface CombatAnalysisState {
  status: AnalysisStatus;
  error: string | null;
  coverage: CoverageResult | null;
  reconstruction: MatchReconstructionResult | null;
  originalResult: CombatResult | null;
  defeatReport: DefeatReportResult | null;
  whatIfComparison: WhatIfComparisonResult | null;
  selectedOpponent: ParsedParticipant | null;
  participants: ParsedParticipant[];
}

let cachedData: { champions: RawChampion[]; items: RawItem[]; traits: RawTrait[] } | null = null;

async function ensureData() {
  if (cachedData) return cachedData;
  const [champions, items, traits] = await Promise.all([
    loadChampions('set17'),
    loadItems('set17'),
    loadTraits('set17'),
  ]);
  cachedData = { champions, items, traits };
  return cachedData;
}

function getUnitDeathTick(unitId: string, result: CombatResult): number | null {
  const deathLog = result.logs.find(l => l.type === 'death' && l.sourceId === unitId);
  return deathLog ? deathLog.tick : null;
}

export function useCombatAnalysis() {
  const [state, setState] = useState<CombatAnalysisState>({
    status: 'idle',
    error: null,
    coverage: null,
    reconstruction: null,
    originalResult: null,
    defeatReport: null,
    whatIfComparison: null,
    selectedOpponent: null,
    participants: [],
  });

  const setParticipants = useCallback((participants: ParsedParticipant[]) => {
    setState(prev => ({ ...prev, participants }));
  }, []);

  const selectOpponent = useCallback((opponent: ParsedParticipant) => {
    setState(prev => ({
      ...prev,
      selectedOpponent: opponent,
      reconstruction: null,
      defeatReport: null,
      status: 'ready',
    }));
  }, []);

  const checkMatch = useCallback(async (
    matchSetId: string,
    playerParticipant: ParsedParticipant,
    allParticipants: ParsedParticipant[],
  ) => {
    setState(prev => ({ ...prev, status: 'loading', error: null }));

    try {
      const data = await ensureData();

      const parsedMatch = {
        matchId: '',
        setId: matchSetId,
        placement: playerParticipant.placement,
        champions: playerParticipant.champions,
        gameDatetime: '',
        gameLength: 0,
        queueId: 0,
        traits: playerParticipant.traits,
      };

      const coverage = checkCoverage(parsedMatch, allParticipants, data.champions, data.items);

      if (coverage.confidence === 'unsupported') {
        setState(prev => ({
          ...prev,
          status: 'unsupported',
          coverage,
          participants: allParticipants,
        }));
        return;
      }

      // 기본 상대: 바로 윗등수 (2등이면 1등, 1등이면 2등)
      const sorted = [...allParticipants].sort((a, b) => a.placement - b.placement);
      const playerIdx = sorted.findIndex(p => p.puuid === playerParticipant.puuid);
      const defaultOpponent = playerIdx > 0 ? sorted[playerIdx - 1] : sorted[1] ?? sorted[0];

      setState(prev => ({
        ...prev,
        status: 'ready',
        coverage,
        participants: allParticipants,
        selectedOpponent: defaultOpponent,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : '분석 준비 실패',
      }));
    }
  }, []);

  const runSimulation = useCallback(async (playerData: ParsedParticipant) => {
    if (!state.selectedOpponent) return;

    setState(prev => ({ ...prev, status: 'simulating' }));

    try {
      const data = await ensureData();

      const reconstruction = reconstructMatch(
        playerData,
        state.selectedOpponent,
        data.champions,
        data.items,
        data.traits,
      );

      if (reconstruction.confidence === 'unsupported') {
        setState(prev => ({
          ...prev,
          status: 'unsupported',
          reconstruction,
        }));
        return;
      }

      const result = simulateCombat(
        reconstruction.playerTeam,
        reconstruction.enemyTeam,
        {
          seed: 42,
          skipMirror: true,
          allTraits: reconstruction.options.allTraits,
          // 사용자가 PlacedChampion 에 novaStrikeSelector 를 표시한 경우 옵션으로 전달.
          // Riot API 재구성 결과는 일반적으로 미지정 → autoAssignNovaSelector fallback.
          playerNovaStrikeSelectorUnit: reconstruction.playerTeam
            .find((u) => u.novaStrikeSelector === true)?.champion.apiName,
          enemyNovaStrikeSelectorUnit: reconstruction.enemyTeam
            .find((u) => u.novaStrikeSelector === true)?.champion.apiName,
        },
      );

      const defeatReport = result.winner !== 'player'
        ? generateDefeatReport(result)
        : null;

      setState(prev => ({
        ...prev,
        status: 'done',
        reconstruction,
        originalResult: result,
        defeatReport,
        whatIfComparison: null,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : '시뮬레이션 실행 실패',
      }));
    }
  }, [state.selectedOpponent]);

  /** What-if: 수정된 팀으로 재시뮬레이션 후 원본과 비교 */
  const runWhatIf = useCallback((modifiedPlayerTeam: PlacedChampion[]) => {
    if (!state.reconstruction || !state.originalResult) return;

    try {
      const modifiedResult = simulateCombat(
        modifiedPlayerTeam,
        state.reconstruction.enemyTeam,
        {
          seed: 42,
          skipMirror: true,
          allTraits: state.reconstruction.options.allTraits,
          // What-if 에서 사용자가 NOVA 선택기 토글 가능 → modifiedPlayerTeam 우선 스캔.
          playerNovaStrikeSelectorUnit: modifiedPlayerTeam
            .find((u) => u.novaStrikeSelector === true)?.champion.apiName,
          enemyNovaStrikeSelectorUnit: state.reconstruction.enemyTeam
            .find((u) => u.novaStrikeSelector === true)?.champion.apiName,
        },
      );

      // 유닛별 DPS/생존 비교
      const unitDeltas = state.originalResult.playerUnits.map(origUnit => {
        const modUnit = modifiedResult.playerUnits.find(u => u.champion.apiName === origUnit.champion.apiName);
        const origDeathTick = getUnitDeathTick(origUnit.id, state.originalResult!);
        const modDeathTick = modUnit ? getUnitDeathTick(modUnit.id, modifiedResult) : null;
        const totalTicks = state.originalResult!.duration * 30;
        const modTotalTicks = modifiedResult.duration * 30;

        return {
          unitId: origUnit.id,
          championName: origUnit.champion.name,
          dpsDelta: (modUnit?.totalDamageDealt ?? 0) - origUnit.totalDamageDealt,
          survivalDelta: (modDeathTick ?? modTotalTicks) - (origDeathTick ?? totalTicks),
        };
      });

      const comparison: WhatIfComparisonResult = {
        original: state.originalResult,
        modified: modifiedResult,
        delta: {
          winnerChanged: state.originalResult.winner !== modifiedResult.winner,
          durationDelta: modifiedResult.duration - state.originalResult.duration,
          unitDeltas,
        },
      };

      setState(prev => ({ ...prev, whatIfComparison: comparison }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'What-if 시뮬레이션 실패',
      }));
    }
  }, [state.reconstruction, state.originalResult]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      error: null,
      coverage: null,
      reconstruction: null,
      originalResult: null,
      defeatReport: null,
      whatIfComparison: null,
      selectedOpponent: null,
      participants: [],
    });
  }, []);

  return {
    ...state,
    setParticipants,
    selectOpponent,
    checkMatch,
    runSimulation,
    runWhatIf,
    reset,
  };
}
