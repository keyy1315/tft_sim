'use client';

import { useSearchParams } from 'next/navigation';
import type { SetId } from '@/data/setConfig';
import { DEFAULT_SET, SET_CONFIGS } from '@/data/setConfig';

export function useActiveSet(): SetId {
  const params = useSearchParams();
  const set = params.get('set') as SetId | null;
  if (set && set in SET_CONFIGS) return set;
  return DEFAULT_SET;
}
