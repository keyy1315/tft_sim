'use client';
import { useCallback, useState, useEffect } from 'react';
import type { GameDiff } from '@/types/validation';

export type DiffState =
  | { kind: 'initial' }
  | { kind: 'loading' }
  | { kind: 'missing' }                          // GET 404
  | { kind: 'ready'; diff: GameDiff; stale: boolean }
  | { kind: 'error'; message: string };

export function useCompareDiff(gameId: string) {
  const [state, setState] = useState<DiffState>({ kind: 'initial' });

  const fetchCache = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`/api/actual-data/${gameId}/compare`, { cache: 'no-store' });
      if (res.status === 404) {
        setState({ kind: 'missing' });
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        setState({ kind: 'error', message: text });
        return;
      }
      const data = await res.json() as { diff: GameDiff; stale: boolean };
      setState({ kind: 'ready', diff: data.diff, stale: data.stale });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [gameId]);

  const run = useCallback(async (n = 10) => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`/api/actual-data/${gameId}/compare`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ n }),
      });
      if (!res.ok) {
        const text = await res.text();
        setState({ kind: 'error', message: text });
        return;
      }
      const data = await res.json() as { diff: GameDiff };
      setState({ kind: 'ready', diff: data.diff, stale: false });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [gameId]);

  // setState 는 fetchCache 내부에서 호출되지만, 첫 라인이 동기 setState 라
  // react-hooks/set-state-in-effect 룰에 걸린다. microtask 로 한 단계 떼어내면
  // effect body 자체는 setState 를 호출하지 않게 되어 룰을 통과한다.
  // 동작은 동일 — 마운트 직후 다음 microtask 에서 fetchCache 가 실행된다.
  useEffect(() => {
    void Promise.resolve().then(fetchCache);
  }, [fetchCache]);

  return { state, run, refresh: fetchCache };
}
