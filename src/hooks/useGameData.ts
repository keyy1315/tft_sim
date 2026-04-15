'use client';

import { useState, useEffect } from 'react';
import { RawChampion, RawItem, RawTrait, RawAugment, TeamPlannerEntry } from '@/types';
import { loadChampions, loadItems, loadTraits, loadAugments, loadTeamPlannerMapping, loadScalingData } from '@/data/loader';
import { registerTraitImages } from '@/data/imageMap';
import type { SetId } from '@/data/setConfig';
import { DEFAULT_SET } from '@/data/setConfig';

export function useChampions(setId: SetId = DEFAULT_SET) {
  const [state, setState] = useState<{ data: RawChampion[]; loadedSet: string | null }>({ data: [], loadedSet: null });

  useEffect(() => {
    let cancelled = false;
    loadChampions(setId).then((result) => {
      if (!cancelled) setState({ data: result, loadedSet: setId });
    });
    return () => { cancelled = true; };
  }, [setId]);

  return { champions: state.data, loading: state.loadedSet !== setId };
}

export function useItems(setId: SetId = DEFAULT_SET) {
  const [state, setState] = useState<{ data: RawItem[]; loadedSet: string | null }>({ data: [], loadedSet: null });

  useEffect(() => {
    let cancelled = false;
    loadItems(setId).then((result) => {
      if (!cancelled) setState({ data: result, loadedSet: setId });
    });
    return () => { cancelled = true; };
  }, [setId]);

  return { items: state.data, loading: state.loadedSet !== setId };
}

export function useTraits(setId: SetId = DEFAULT_SET) {
  const [state, setState] = useState<{ data: RawTrait[]; loadedSet: string | null }>({ data: [], loadedSet: null });

  useEffect(() => {
    let cancelled = false;
    loadTraits(setId).then((result) => {
      if (!cancelled) {
        registerTraitImages(result);
        setState({ data: result, loadedSet: setId });
      }
    });
    return () => { cancelled = true; };
  }, [setId]);

  return { traits: state.data, loading: state.loadedSet !== setId };
}

export function useAugments(setId: SetId = DEFAULT_SET) {
  const [state, setState] = useState<{ data: RawAugment[]; loadedSet: string | null }>({ data: [], loadedSet: null });

  useEffect(() => {
    let cancelled = false;
    loadAugments(setId).then((result) => {
      if (!cancelled) setState({ data: result, loadedSet: setId });
    });
    return () => { cancelled = true; };
  }, [setId]);

  return { augments: state.data, loading: state.loadedSet !== setId };
}

export function useTeamPlannerMapping(setId: SetId = DEFAULT_SET) {
  const [state, setState] = useState<{ data: TeamPlannerEntry[]; loadedSet: string | null }>({ data: [], loadedSet: null });

  useEffect(() => {
    let cancelled = false;
    loadTeamPlannerMapping(setId).then((result) => {
      if (!cancelled) setState({ data: result, loadedSet: setId });
    });
    return () => { cancelled = true; };
  }, [setId]);

  return { teamPlannerMapping: state.data, loading: state.loadedSet !== setId };
}

export function useGameData(setId: SetId = DEFAULT_SET) {
  const { champions, loading: champLoading } = useChampions(setId);
  const { items, loading: itemsLoading } = useItems(setId);
  const { traits, loading: traitsLoading } = useTraits(setId);
  const { augments, loading: augLoading } = useAugments(setId);
  const { teamPlannerMapping, loading: tpLoading } = useTeamPlannerMapping(setId);

  // 스케일링 데이터 로드 (전투 시뮬레이션용)
  useEffect(() => {
    loadScalingData(setId);
  }, [setId]);

  return {
    champions,
    items,
    traits,
    augments,
    teamPlannerMapping,
    loading: champLoading || itemsLoading || traitsLoading || augLoading || tpLoading,
  };
}
