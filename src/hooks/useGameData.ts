'use client';

import { useState, useEffect } from 'react';
import { RawChampion, RawItem, RawTrait, RawAugment, TeamPlannerEntry } from '@/types';
import { loadChampions, loadItems, loadTraits, loadAugments, loadTeamPlannerMapping } from '@/data/loader';

export function useChampions() {
  const [champions, setChampions] = useState<RawChampion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChampions().then((data) => {
      setChampions(data);
      setLoading(false);
    });
  }, []);

  return { champions, loading };
}

export function useItems() {
  const [items, setItems] = useState<RawItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  return { items, loading };
}

export function useTraits() {
  const [traits, setTraits] = useState<RawTrait[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTraits().then((data) => {
      setTraits(data);
      setLoading(false);
    });
  }, []);

  return { traits, loading };
}

export function useAugments() {
  const [augments, setAugments] = useState<RawAugment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAugments().then((data) => {
      setAugments(data);
      setLoading(false);
    });
  }, []);

  return { augments, loading };
}

export function useTeamPlannerMapping() {
  const [teamPlannerMapping, setTeamPlannerMapping] = useState<TeamPlannerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamPlannerMapping().then((data) => {
      setTeamPlannerMapping(data);
      setLoading(false);
    });
  }, []);

  return { teamPlannerMapping, loading };
}

export function useGameData() {
  const { champions, loading: champLoading } = useChampions();
  const { items, loading: itemsLoading } = useItems();
  const { traits, loading: traitsLoading } = useTraits();
  const { augments, loading: augLoading } = useAugments();
  const { teamPlannerMapping, loading: tpLoading } = useTeamPlannerMapping();

  return {
    champions,
    items,
    traits,
    augments,
    teamPlannerMapping,
    loading: champLoading || itemsLoading || traitsLoading || augLoading || tpLoading,
  };
}
