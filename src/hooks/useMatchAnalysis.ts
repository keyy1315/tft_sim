'use client';

import { useState, useCallback } from 'react';
import type { RawChampion, RawItem, RawTrait } from '@/types';
import type { ItemAnalysisResult, CoverageResult } from '@/types/analysis';
import { loadChampions, loadItems, loadTraits } from '@/data/loader';
import { checkCoverage, resolveItemId } from '@/lib/analysis/coverageChecker';
import { analyzeItems } from '@/lib/analysis/itemAnalyzer';

interface MatchInput {
  setId: string | null;
  placement: number;
  champions: Array<{ id: string; tier: number; items: string[] }>;
  traits: Array<{ name: string; numUnits: number; style: number; tierCurrent: number }> | null;
}

interface AnalysisResult {
  coverage: CoverageResult;
  items: ItemAnalysisResult | null;
  isFirstPlace: boolean;
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

export function useMatchAnalysis() {
  const [results, setResults] = useState<Map<string, AnalysisResult>>(new Map());

  const analyze = useCallback(async (matchId: string, match: MatchInput) => {
    if (results.has(matchId)) return results.get(matchId)!;

    const data = await ensureData();

    const parsedMatch = {
      matchId,
      setId: match.setId ?? '',
      placement: 0,
      champions: match.champions,
      gameDatetime: '',
      gameLength: 0,
      queueId: 0,
      traits: (match.traits ?? []).map(t => ({
        name: t.name,
        numUnits: t.numUnits,
        style: t.style,
        tierCurrent: t.tierCurrent,
      })),
    };

    const participants = [{
      puuid: '',
      placement: 0,
      champions: match.champions,
      traits: parsedMatch.traits,
    }];

    const coverage = checkCoverage(parsedMatch, participants, data.champions, data.items);

    const isFirstPlace = match.placement === 1;
    let items: ItemAnalysisResult | null = null;

    if (coverage.isSet17 && !isFirstPlace) {
      const itemApiNameSet = new Map(data.items.map(i => [i.apiName, true]));
      const resolvedChampions = match.champions.map(c => ({
        ...c,
        items: c.items.map(id => resolveItemId(id, itemApiNameSet)),
      }));

      items = analyzeItems(
        resolvedChampions,
        data.champions,
        data.items,
        data.traits,
      );
    }

    const result: AnalysisResult = { coverage, items, isFirstPlace };
    setResults(prev => new Map(prev).set(matchId, result));
    return result;
  }, [results]);

  /** 새 유저 검색 시 호출. matchId 동일해도 유저별로 덱이 달라 분석 결과가 달라지므로
   *  캐시를 비워 재계산하도록 한다. */
  const reset = useCallback(() => {
    setResults(new Map());
  }, []);

  return { results, analyze, reset };
}
